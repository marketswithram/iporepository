-- =============================================================================
-- Migration 011: Repair source_type constraint + "Include admin" default participant
-- =============================================================================
-- 1. Repair ipo_result_imports.source_type CHECK so 'AUTOMATED' is accepted.
--    (Migration 010 wrapped this in EXCEPTION WHEN OTHERS, so a failure there was
--     silent. This version drops whatever source_type check exists and fails loudly.)
-- 2. Add ipo_participations.is_admin_default to mark the optional default admin
--    participant ("markets with ram") that the admin can include per IPO.
-- 3. Add set_ipo_admin_participation(ipo_id, include) RPC used by the checkbox on
--    /admin/ipos/:ipoId.
-- 4. Make get_ipo_participant_list show "markets with ram" for the admin row so the
--    copied Excel TSV matches what the app displays.
-- Safe to run more than once.
-- =============================================================================

-- ── 1. source_type constraint ────────────────────────────────────────────────
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.ipo_result_imports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.ipo_result_imports DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.ipo_result_imports
  ADD CONSTRAINT ipo_result_imports_source_type_check
  CHECK (source_type IN ('PASTE', 'CSV', 'EXCEL', 'AUTOMATED'));

-- ── 2. Default admin participant marker ──────────────────────────────────────
ALTER TABLE public.ipo_participations
  ADD COLUMN IF NOT EXISTS is_admin_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_admin_default_per_ipo
  ON public.ipo_participations (ipo_id)
  WHERE is_admin_default;

-- ── 3. Toggle RPC ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_ipo_admin_participation(
  p_ipo_id  UUID,
  p_include BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_status   TEXT;
  v_price    NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT status, ipo_price INTO v_status, v_price FROM public.ipos WHERE id = p_ipo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'IPO not found');
  END IF;

  IF v_status IN ('COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin participation cannot be changed once the IPO is ' || v_status || '.'
    );
  END IF;

  IF p_include THEN
    IF EXISTS (SELECT 1 FROM public.ipo_participations WHERE ipo_id = p_ipo_id AND is_admin_default) THEN
      RETURN jsonb_build_object('success', true, 'included', true);
    END IF;

    IF EXISTS (SELECT 1 FROM public.ipo_participations WHERE ipo_id = p_ipo_id AND user_id = v_admin_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This admin account already has its own participation in this IPO.'
      );
    END IF;

    INSERT INTO public.ipo_participations (
      ipo_id, user_id, participation_type, application_number,
      investor_user_id, amount_contributed, is_admin_default
    ) VALUES (
      p_ipo_id, v_admin_id, 'INVESTOR', 'ADMIN',
      v_admin_id, v_price, TRUE
    );
  ELSE
    DELETE FROM public.ipo_participations
    WHERE ipo_id = p_ipo_id AND is_admin_default;
  END IF;

  RETURN jsonb_build_object('success', true, 'included', p_include);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_ipo_admin_participation(UUID, BOOLEAN) TO authenticated;

-- ── 4. Participant list: show "markets with ram" for the admin row ───────────
CREATE OR REPLACE FUNCTION public.get_ipo_participant_list(p_ipo_id UUID)
RETURNS TABLE (
  serial             INTEGER,
  investor_name      TEXT,
  amount_contributed NUMERIC,
  applied_from       TEXT,
  lots               INTEGER,
  applied_amount     NUMERIC,
  allotted           TEXT,
  refund             TEXT,
  profit_share       TEXT,
  tax_reserve        TEXT,
  final_settlement   TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY b.investor_name, b.applied_from)::INTEGER AS serial,
    b.investor_name,
    b.amount_contributed,
    b.applied_from,
    b.lots,
    b.applied_amount,
    ''::TEXT  AS allotted,
    ''::TEXT  AS refund,
    ''::TEXT  AS profit_share,
    ''::TEXT  AS tax_reserve,
    ''::TEXT  AS final_settlement
  FROM (
    SELECT
      CASE WHEN p.is_admin_default THEN 'markets with ram' ELSE inv.full_name END AS investor_name,
      COALESCE(p.amount_contributed, i.ipo_price, 0)                              AS amount_contributed,
      CASE WHEN p.is_admin_default THEN 'markets with ram' ELSE ah.full_name END  AS applied_from,
      COALESCE(r.lots, 1)                                                         AS lots,
      COALESCE(
        p.amount_contributed,
        COALESCE(r.lots, 1) * i.ipo_price,
        i.ipo_price
      )                                                                           AS applied_amount
    FROM public.ipo_participations p
    JOIN public.ipos     i   ON i.id  = p.ipo_id
    JOIN public.profiles ah  ON ah.id = p.user_id
    JOIN public.profiles inv ON inv.id = COALESCE(p.investor_user_id, p.user_id)
    LEFT JOIN public.ipo_results r ON r.participation_id = p.id
    WHERE p.ipo_id = p_ipo_id
  ) b
  ORDER BY b.investor_name, b.applied_from;
$$;