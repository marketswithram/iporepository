-- ============================================================
-- 003_rls_policies.sql  — Row Level Security
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipo_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipo_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipo_result_imports ENABLE ROW LEVEL SECURITY;

-- ── Admin helper function (SECURITY DEFINER = bypass RLS) ───
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
$$;

-- ── Helper: check_existing_participation (used by Apply page) ──
CREATE OR REPLACE FUNCTION public.check_existing_participation(p_ipo_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ipo_participations
    WHERE ipo_id = p_ipo_id AND user_id = auth.uid()
  );
$$;

-- ── PROFILES ────────────────────────────────────────────────
-- Users can view only their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

-- Admins can update any profile; users cannot update via API
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- Profile is auto-created by trigger — no direct INSERT for users
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── IPOs ────────────────────────────────────────────────────
-- Users see OPEN ipos + any IPO they have a participation in + admin sees all
CREATE POLICY "ipos_select_user" ON public.ipos
  FOR SELECT USING (
    status = 'OPEN'
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.ipo_participations p
      WHERE p.ipo_id = id AND p.user_id = auth.uid()
    )
  );

-- Admin only: insert, update, delete
CREATE POLICY "ipos_insert_admin"  ON public.ipos FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "ipos_update_admin"  ON public.ipos FOR UPDATE USING (public.is_admin());
CREATE POLICY "ipos_delete_admin"  ON public.ipos FOR DELETE USING (public.is_admin());

-- ── IPO PARTICIPATIONS ──────────────────────────────────────
-- Users see only their own participations; admins see all
CREATE POLICY "participations_select" ON public.ipo_participations
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Users can insert their own participation in an OPEN ipo
CREATE POLICY "participations_insert" ON public.ipo_participations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.ipos WHERE id = ipo_id AND status = 'OPEN')
  );

-- No user updates/deletes
CREATE POLICY "participations_update_admin" ON public.ipo_participations FOR UPDATE USING (public.is_admin());
CREATE POLICY "participations_delete_admin" ON public.ipo_participations FOR DELETE USING (public.is_admin());

-- ── IPO RESULTS ─────────────────────────────────────────────
-- Users see only their own result
CREATE POLICY "results_select" ON public.ipo_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ipo_participations p
      WHERE p.id = participation_id AND p.user_id = auth.uid()
    ) OR public.is_admin()
  );

-- Only admins can write results
CREATE POLICY "results_insert_admin" ON public.ipo_results FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "results_update_admin" ON public.ipo_results FOR UPDATE USING (public.is_admin());
CREATE POLICY "results_delete_admin" ON public.ipo_results FOR DELETE USING (public.is_admin());

-- ── IMPORTS ─────────────────────────────────────────────────
CREATE POLICY "imports_admin_all" ON public.ipo_result_imports
  FOR ALL USING (public.is_admin());

-- ── Auto-create profile on signup ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, username, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
