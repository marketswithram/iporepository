-- ============================================================
-- 007_user_activity_history_and_auth_fix.sql
-- 1. Fix existing admin-created users in auth.users & auth.identities
-- 2. Update admin_create_user to prevent "Database error querying schema"
-- 3. Create user_activity_logs table, automatic profile triggers & backfill
-- ============================================================

-- ── 1. Fix existing auth.users with NULL token columns ────────
-- GoTrue expects non-null string tokens; scanning NULL produces
-- 500: Database error querying schema
UPDATE auth.users
SET 
  confirmation_token      = COALESCE(confirmation_token, ''),
  recovery_token          = COALESCE(recovery_token, ''),
  email_change_token_new  = COALESCE(email_change_token_new, ''),
  email_change            = COALESCE(email_change, ''),
  phone_change            = COALESCE(phone_change, ''),
  phone_change_token      = COALESCE(phone_change_token, ''),
  reauthentication_token  = COALESCE(reauthentication_token, ''),
  is_sso_user             = COALESCE(is_sso_user, false),
  email_confirmed_at      = COALESCE(email_confirmed_at, NOW())
WHERE confirmation_token IS NULL 
   OR recovery_token IS NULL 
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR email_confirmed_at IS NULL;

-- ── 2. Ensure all auth.users have matching auth.identities ────
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Update admin_create_user to insert complete GoTrue schema 
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

  -- Insert into auth.users with all non-null token defaults expected by GoTrue
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
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_sso_user,
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
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    v_now,
    v_now
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email',
    v_user_id::text,
    v_now,
    v_now,
    v_now
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert or update profile
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

-- ── 4. Create user_activity_logs Table ───────────────────────
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  action_title TEXT NOT NULL,
  details      TEXT,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.user_activity_logs;
CREATE POLICY "Admins can view all activity logs"
  ON public.user_activity_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON public.user_activity_logs;
CREATE POLICY "Authenticated can insert activity logs"
  ON public.user_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 5. Trigger on public.profiles to automatically log all events
CREATE OR REPLACE FUNCTION public.trg_log_profile_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- ON INSERT:
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.user_activity_logs (
      user_id,
      action_type,
      action_title,
      details,
      actor_id,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      CASE WHEN NEW.is_approved THEN 'CREATED_AND_APPROVED' ELSE 'CREATED' END,
      CASE WHEN NEW.is_approved THEN 'Account Created & Auto-Approved' ELSE 'New Registration Submitted' END,
      CASE 
        WHEN NEW.is_approved THEN 'Account for ' || NEW.full_name || ' (@' || NEW.username || ') was created with immediate approval.'
        ELSE 'User @' || NEW.username || ' submitted registration, awaiting admin approval.'
      END,
      auth.uid(),
      jsonb_build_object('username', NEW.username, 'email', NEW.email, 'approval_status', NEW.approval_status, 'is_active', NEW.is_active, 'role', NEW.role),
      NEW.created_at
    );
    RETURN NEW;
  END IF;

  -- ON UPDATE:
  IF (TG_OP = 'UPDATE') THEN
    -- Check approval change
    IF (OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
      INSERT INTO public.user_activity_logs (
        user_id,
        action_type,
        action_title,
        details,
        actor_id,
        metadata,
        created_at
      ) VALUES (
        NEW.id,
        CASE 
          WHEN NEW.approval_status = 'APPROVED' THEN 'APPROVED'
          WHEN NEW.approval_status = 'REJECTED' THEN 'REJECTED'
          ELSE 'APPROVAL_STATUS_CHANGED'
        END,
        CASE 
          WHEN NEW.approval_status = 'APPROVED' THEN 'User Approved'
          WHEN NEW.approval_status = 'REJECTED' THEN 'User Registration Rejected'
          ELSE 'Approval Status Changed'
        END,
        'Approval status updated from ' || COALESCE(OLD.approval_status, 'NONE') || ' to ' || NEW.approval_status || '.',
        auth.uid(),
        jsonb_build_object('old_status', OLD.approval_status, 'new_status', NEW.approval_status),
        NOW()
      );
    END IF;

    -- Check is_active change
    IF (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
      INSERT INTO public.user_activity_logs (
        user_id,
        action_type,
        action_title,
        details,
        actor_id,
        metadata,
        created_at
      ) VALUES (
        NEW.id,
        CASE WHEN NEW.is_active THEN 'ACTIVATED' ELSE 'DEACTIVATED' END,
        CASE WHEN NEW.is_active THEN 'User Account Activated' ELSE 'User Account Deactivated' END,
        CASE 
          WHEN NEW.is_active THEN 'User @' || NEW.username || ' account was reactivated by administrator.'
          ELSE 'User @' || NEW.username || ' account was deactivated / suspended by administrator.'
        END,
        auth.uid(),
        jsonb_build_object('is_active', NEW.is_active),
        NOW()
      );
    END IF;

    -- Check role change
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
      INSERT INTO public.user_activity_logs (
        user_id,
        action_type,
        action_title,
        details,
        actor_id,
        metadata,
        created_at
      ) VALUES (
        NEW.id,
        'ROLE_CHANGED',
        'User Role Changed',
        'Role updated from ' || OLD.role || ' to ' || NEW.role || '.',
        auth.uid(),
        jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role),
        NOW()
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_activity_logger ON public.profiles;
CREATE TRIGGER trg_profile_activity_logger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_profile_changes();

-- ── 6. Backfill existing profile creation & approval events ───
INSERT INTO public.user_activity_logs (user_id, action_type, action_title, details, created_at, metadata)
SELECT 
  p.id,
  CASE WHEN p.is_approved THEN 'CREATED_AND_APPROVED' ELSE 'CREATED' END,
  CASE WHEN p.is_approved THEN 'Account Created & Approved' ELSE 'New Registration Submitted' END,
  'Account registered for @' || p.username || ' (' || p.email || ').',
  p.created_at,
  jsonb_build_object('username', p.username, 'email', p.email, 'approval_status', p.approval_status)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_activity_logs l WHERE l.user_id = p.id
);

-- Backfill separate approval events if approved after created_at
INSERT INTO public.user_activity_logs (user_id, action_type, action_title, details, created_at, metadata)
SELECT 
  p.id,
  'APPROVED',
  'User Approved',
  'User @' || p.username || ' was approved with platform access.',
  p.approved_at,
  jsonb_build_object('username', p.username, 'email', p.email)
FROM public.profiles p
WHERE p.is_approved = true 
  AND p.approved_at IS NOT NULL 
  AND p.approved_at > p.created_at + INTERVAL '5 seconds'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_activity_logs l 
    WHERE l.user_id = p.id AND l.action_type = 'APPROVED'
  );
