-- ============================================================
-- 006_user_approval_and_management.sql
-- User Approval Workflow & Admin Manual User Creation
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Add approval columns to profiles ──────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

-- ── 2. Backfill existing users as APPROVED ───────────────────
-- Ensure all current users & admins are approved and not locked out
UPDATE public.profiles
SET is_approved = TRUE,
    approval_status = 'APPROVED',
    approved_at = NOW()
WHERE is_approved IS FALSE;

-- ── 3. Update handle_new_user trigger ────────────────────────
-- New self-registered users start as PENDING / is_approved = FALSE
-- Admin users or users explicitly created with is_approved=true start as APPROVED
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  v_is_approved BOOLEAN := FALSE;
  v_status TEXT := 'PENDING';
BEGIN
  IF v_role = 'admin' OR (NEW.raw_user_meta_data->>'is_approved')::BOOLEAN = TRUE THEN
    v_is_approved := TRUE;
    v_status := 'APPROVED';
  END IF;

  INSERT INTO public.profiles(id, username, full_name, email, role, is_approved, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role,
    v_is_approved,
    v_status,
    CASE WHEN v_is_approved THEN NOW() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    username        = EXCLUDED.username,
    full_name       = EXCLUDED.full_name,
    email           = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- ── 4. Admin function to approve or reject a user ────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_approval(
  p_user_id UUID,
  p_status  TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_approved BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins can approve users');
  END IF;

  IF p_status NOT IN ('APPROVED', 'REJECTED', 'PENDING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status. Must be APPROVED, REJECTED, or PENDING');
  END IF;

  v_is_approved := (p_status = 'APPROVED');

  UPDATE public.profiles
  SET is_approved     = v_is_approved,
      approval_status = p_status,
      approved_at     = CASE WHEN v_is_approved THEN NOW() ELSE NULL END,
      approved_by     = CASE WHEN v_is_approved THEN auth.uid() ELSE NULL END,
      updated_at      = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'approval_status', p_status,
    'is_approved', v_is_approved
  );
END;
$$;

-- ── 5. Admin function to manually create a new user ──────────
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email     TEXT,
  p_password  TEXT,
  p_username  TEXT,
  p_full_name TEXT,
  p_role      TEXT DEFAULT 'user'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_encrypted_pw TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admins can create users');
  END IF;

  -- Validation
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;
  IF p_username IS NULL OR p_username = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username is required');
  END IF;

  -- Check if username or email exists in profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already exists');
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username already exists');
  END IF;

  -- Encrypt password with pgcrypto
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert into auth.users directly
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    v_encrypted_pw,
    v_now,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('username', p_username, 'full_name', p_full_name, 'role', p_role, 'is_approved', true),
    'authenticated',
    'authenticated',
    v_now,
    v_now
  );

  -- Insert or update profile (also handled by trigger if present)
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    email,
    role,
    is_active,
    is_approved,
    approval_status,
    approved_at,
    approved_by,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_username,
    p_full_name,
    p_email,
    p_role,
    TRUE,
    TRUE,
    'APPROVED',
    v_now,
    auth.uid(),
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    username        = EXCLUDED.username,
    full_name       = EXCLUDED.full_name,
    role            = EXCLUDED.role,
    is_approved     = TRUE,
    approval_status = 'APPROVED',
    approved_at     = v_now,
    approved_by     = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'username', p_username,
    'full_name', p_full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_approval(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

