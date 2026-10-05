-- ============================================================
-- 002_indexes.sql  — Performance indexes
-- ============================================================

CREATE INDEX idx_ipos_status       ON public.ipos(status);
CREATE INDEX idx_ipos_created_at   ON public.ipos(created_at DESC);
CREATE INDEX idx_participations_ipo  ON public.ipo_participations(ipo_id);
CREATE INDEX idx_participations_user ON public.ipo_participations(user_id);
CREATE INDEX idx_results_participation ON public.ipo_results(participation_id);
CREATE INDEX idx_imports_ipo        ON public.ipo_result_imports(ipo_id);
