-- ============================================================
-- 004_functions_triggers.sql
-- Business logic RPC functions
-- ============================================================

-- ── 1. submit_ipo_results (atomic transaction) ───────────────
-- Called by admin after previewing import. Updates all results
-- and marks the IPO as COMPLETED in a single transaction.
CREATE OR REPLACE FUNCTION public.submit_ipo_results(
  p_ipo_id         UUID,
  p_import_id      UUID,
  p_overall_profit NUMERIC,
  p_results        JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row          JSONB;
  v_rows_ok      INTEGER := 0;
  v_result_status TEXT;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Allow import from OPEN, CLOSED, or PROCESSING (not COMPLETED/CANCELLED)
  IF NOT EXISTS (
    SELECT 1 FROM public.ipos
    WHERE id = p_ipo_id AND status NOT IN ('COMPLETED', 'CANCELLED')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'IPO is already completed or cancelled');
  END IF;

  -- Loop through each result row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_result_status := CASE
      WHEN (v_row->>'allotted')::BOOLEAN THEN 'ALLOTTED'
      WHEN (v_row->>'applied')::BOOLEAN  THEN 'NOT_ALLOTTED'
      ELSE 'REFUNDED'
    END;

    INSERT INTO public.ipo_results (
      participation_id, applied, allotted, lots, applied_from,
      refund_amount, profit_amount, tax_amount, final_settlement_amount, result_status
    ) VALUES (
      (v_row->>'participation_id')::UUID,
      (v_row->>'applied')::BOOLEAN,
      (v_row->>'allotted')::BOOLEAN,
      COALESCE((v_row->>'lots')::INTEGER, 0),
      v_row->>'applied_from',
      COALESCE((v_row->>'refund_amount')::NUMERIC, 0),
      COALESCE((v_row->>'profit_amount')::NUMERIC, 0),
      COALESCE((v_row->>'tax_amount')::NUMERIC, 0),
      COALESCE((v_row->>'final_settlement_amount')::NUMERIC, 0),
      v_result_status
    )
    ON CONFLICT (participation_id) DO UPDATE SET
      applied                 = EXCLUDED.applied,
      allotted                = EXCLUDED.allotted,
      lots                    = EXCLUDED.lots,
      applied_from            = EXCLUDED.applied_from,
      refund_amount           = EXCLUDED.refund_amount,
      profit_amount           = EXCLUDED.profit_amount,
      tax_amount              = EXCLUDED.tax_amount,
      final_settlement_amount = EXCLUDED.final_settlement_amount,
      result_status           = EXCLUDED.result_status,
      updated_at              = NOW();

    v_rows_ok := v_rows_ok + 1;
  END LOOP;

  -- Mark IPO as COMPLETED
  UPDATE public.ipos
  SET status = 'COMPLETED', overall_profit = p_overall_profit, completed_at = NOW()
  WHERE id = p_ipo_id;

  -- Update import session
  IF p_import_id IS NOT NULL THEN
    UPDATE public.ipo_result_imports
    SET status = 'COMPLETED', success_rows = v_rows_ok
    WHERE id = p_import_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'rows_submitted', v_rows_ok);

EXCEPTION WHEN OTHERS THEN
  -- Roll back happens automatically
  IF p_import_id IS NOT NULL THEN
    UPDATE public.ipo_result_imports SET status = 'FAILED', error_log = jsonb_build_object('error', SQLERRM) WHERE id = p_import_id;
  END IF;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ── 2. get_user_profit_loss_summary ─────────────────────────
-- Called from user's Profit & Loss page
CREATE OR REPLACE FUNCTION public.get_user_profit_loss_summary()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_ipos',         COUNT(DISTINCT p.id),
    'total_allotted',     COUNT(DISTINCT p.id) FILTER (WHERE r.allotted = TRUE),
    'total_not_allotted', COUNT(DISTINCT p.id) FILTER (WHERE r.applied = TRUE AND r.allotted = FALSE),
    'total_profit',       COALESCE(SUM(r.profit_amount) FILTER (WHERE r.profit_amount > 0), 0),
    'total_loss',         COALESCE(ABS(SUM(r.profit_amount)) FILTER (WHERE r.profit_amount < 0), 0),
    'net_profit',         COALESCE(SUM(r.profit_amount), 0),
    'total_refund',       COALESCE(SUM(r.refund_amount), 0),
    'total_tax',          COALESCE(SUM(r.tax_amount), 0),
    'total_settlement',   COALESCE(SUM(r.final_settlement_amount), 0)
  )
  INTO v_result
  FROM public.ipo_participations p
  LEFT JOIN public.ipo_results r ON r.participation_id = p.id
  WHERE p.user_id = auth.uid();

  RETURN v_result;
END;
$$;

-- ── 3. get_admin_dashboard_stats ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_users',          (SELECT COUNT(*) FROM public.profiles WHERE role = 'user'),
    'active_ipos',          (SELECT COUNT(*) FROM public.ipos WHERE status = 'OPEN'),
    'completed_ipos',       (SELECT COUNT(*) FROM public.ipos WHERE status = 'COMPLETED'),
    'total_participations', (SELECT COUNT(*) FROM public.ipo_participations),
    'total_group_profit',   (SELECT COALESCE(SUM(overall_profit), 0) FROM public.ipos WHERE status = 'COMPLETED')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ── 4. get_ipo_participant_list (for clipboard copy) ─────────
CREATE OR REPLACE FUNCTION public.get_ipo_participant_list(p_ipo_id UUID)
RETURNS TABLE (
  serial           INTEGER,
  full_name        TEXT,
  username         TEXT,
  participation_type TEXT,
  application_number TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.participation_type, pr.full_name)::INTEGER,
    pr.full_name,
    pr.username,
    p.participation_type,
    p.application_number
  FROM public.ipo_participations p
  JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.ipo_id = p_ipo_id
  ORDER BY p.participation_type, pr.full_name;
$$;

-- ── 5. get_ipo_result_report (admin reports) ─────────────────
CREATE OR REPLACE FUNCTION public.get_ipo_result_report(p_ipo_id UUID)
RETURNS TABLE (
  participation_id        UUID,
  username                TEXT,
  full_name               TEXT,
  participation_type      TEXT,
  application_number      TEXT,
  applied                 BOOLEAN,
  allotted                BOOLEAN,
  lots                    INTEGER,
  applied_from            TEXT,
  refund_amount           NUMERIC,
  profit_amount           NUMERIC,
  tax_amount              NUMERIC,
  final_settlement_amount NUMERIC,
  result_status           TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    p.id,
    pr.username,
    pr.full_name,
    p.participation_type,
    p.application_number,
    r.applied,
    r.allotted,
    r.lots,
    r.applied_from,
    r.refund_amount,
    r.profit_amount,
    r.tax_amount,
    r.final_settlement_amount,
    r.result_status
  FROM public.ipo_participations p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.ipo_results r ON r.participation_id = p.id
  WHERE p.ipo_id = p_ipo_id
  ORDER BY p.participation_type, pr.full_name;
$$;
