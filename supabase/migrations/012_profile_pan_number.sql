-- =============================================================================
-- Migration 012: Optional PAN number on profiles
-- =============================================================================
-- 1. profiles.pan_number (optional, validated format ABCDE1234F)
-- 2. handle_new_user stores pan_number from the registration metadata
-- 3. update_my_pan(p_pan) lets a signed-in user add / change / clear their own PAN
-- Safe to run more than once.
-- =============================================================================

-- ── 1. Column + format constraint ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pan_number TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_pan_number_format_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_pan_number_format_check
      CHECK (pan_number IS NULL OR pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
  END IF;
END $$;

-- ── 2. Registration trigger: keep the 006 behaviour, also store the PAN ──────
-- A malformed PAN in the metadata is ignored (stored as NULL) so it can never
-- make sign-up fail with "Database error saving new user".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role        TEXT    := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  v_is_approved BOOLEAN := FALSE;
  v_status      TEXT    := 'PENDING';
  v_pan         TEXT    := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'pan_number', '')));
BEGIN
  IF v_role = 'admin' OR (NEW.raw_user_meta_data->>'is_approved')::BOOLEAN = TRUE THEN
    v_is_approved := TRUE;
    v_status := 'APPROVED';
  END IF;

  IF v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    v_pan := NULL;
  END IF;

  INSERT INTO public.profiles(id, username, full_name, email, role, is_approved, approval_status, approved_at, pan_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role,
    v_is_approved,
    v_status,
    CASE WHEN v_is_approved THEN NOW() ELSE NULL END,
    v_pan
  )
  ON CONFLICT (id) DO UPDATE SET
    username   = EXCLUDED.username,
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    pan_number = COALESCE(EXCLUDED.pan_number, public.profiles.pan_number);
  RETURN NEW;
END;
$$;

-- ── 3. Self-service PAN update (users cannot UPDATE profiles directly) ───────
CREATE OR REPLACE FUNCTION public.update_my_pan(p_pan TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pan TEXT := UPPER(TRIM(COALESCE(p_pan, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_pan = '' THEN
    v_pan := NULL;  -- clearing the PAN is allowed (it is optional)
  ELSIF v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PAN format. Expected 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).');
  END IF;

  UPDATE public.profiles
  SET pan_number = v_pan, updated_at = NOW()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'pan_number', v_pan);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_pan(TEXT) TO authenticated;