-- ============================================================
-- 005_investor_account_holder_profit.sql
-- Investor / Account-Holder Profit Distribution
-- ============================================================

-- ── 1. Add investor_user_id to ipo_participations ────────────
-- When participation_type = 'ACCOUNT_HOLDER', user_id is the
-- account holder and investor_user_id is the actual investor.
-- When participation_type = 'INVESTOR', both are the same person.
ALTER TABLE public.ipo_participations
  ADD COLUMN IF NOT EXISTS investor_user_id UUID REFERENCES public.profiles(id);

-- Back-fill: for existing rows, investor = user (safe default)
UPDATE public.ipo_participations
SET investor_user_id = user_id
WHERE investor_user_id IS NULL;

-- ── 2. Add amount_contributed to ipo_participations ──────────
ALTER TABLE public.ipo_participations
  ADD COLUMN IF NOT EXISTS amount_contributed NUMERIC(15,2);

-- ── 3. user_ipo_profits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_ipo_profits (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_id               UUID          NOT NULL REFERENCES public.ipos(id) ON DELETE CASCADE,
  user_id              UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investor_share       NUMERIC(15,2) NOT NULL DEFAULT 0,
  account_holder_share NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_profit         NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_ipo_profit UNIQUE (ipo_id, user_id)
);

CREATE TRIGGER trg_user_ipo_profits_updated_at
  BEFORE UPDATE ON public.user_ipo_profits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. RLS for user_ipo_profits ──────────────────────────────
ALTER TABLE public.user_ipo_profits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ipo_profits_select" ON public.user_ipo_profits
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_ipo_profits_admin_all" ON public.user_ipo_profits
  FOR ALL USING (public.is_admin());

-- ── 5. Updated get_ipo_participant_list (11 columns) ─────────
-- Must DROP first because the return type (OUT column names/types) changed
DROP FUNCTION IF EXISTS public.get_ipo_participant_list(UUID);
CREATE OR REPLACE FUNCTION public.get_ipo_participant_list(p_ipo_id UUID)
RETURNS TABLE (
  serial             INTEGER,
  investor_name      TEXT,
  amount_contributed NUMERIC,
  applied_from       TEXT,
  lots               INTEGER,
  applied_amount     NUMERIC,
  allotted           TEXT,
  refund             TEXT,
  profit_share       TEXT,
  tax_reserve        TEXT,
  final_settlement   TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY inv.full_name, ah.full_name)::INTEGER AS serial,
    inv.full_name                                                       AS investor_name,
    COALESCE(p.amount_contributed, i.ipo_price, 0)                     AS amount_contributed,
    ah.full_name                                                        AS applied_from,
    COALESCE(r.lots, 1)                                                 AS lots,
    COALESCE(
      p.amount_contributed,
      COALESCE(r.lots, 1) * i.ipo_price,
      i.ipo_price
    )                                                                   AS applied_amount,
    ''::TEXT  AS allotted,
    ''::TEXT  AS refund,
    ''::TEXT  AS profit_share,
    ''::TEXT  AS tax_reserve,
    ''::TEXT  AS final_settlement
  FROM public.ipo_participations p
  JOIN public.ipos     i   ON i.id  = p.ipo_id
  JOIN public.profiles ah  ON ah.id = p.user_id
  JOIN public.profiles inv ON inv.id = COALESCE(p.investor_user_id, p.user_id)
  LEFT JOIN public.ipo_results r ON r.participation_id = p.id
  WHERE p.ipo_id = p_ipo_id
  ORDER BY inv.full_name, ah.full_name;
$$;

-- ── 6. submit_ipo_results — updated with 80/20 distribution ──
CREATE OR REPLACE FUNCTION public.submit_ipo_results(
  p_ipo_id         UUID,
  p_import_id      UUID,
  p_overall_profit NUMERIC,
  p_results        JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row            JSONB;
  v_rows_ok        INTEGER := 0;
  v_result_status  TEXT;
  v_profit_share   NUMERIC;
  v_investor_uid   UUID;
  v_account_uid    UUID;
  v_investor_share NUMERIC;
  v_account_share  NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ipos WHERE id = p_ipo_id AND status NOT IN ('CANCELLED')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'IPO is cancelled');
  END IF;

  -- Duplicate prevention: clear previous profit records for this IPO
  DELETE FROM public.user_ipo_profits WHERE ipo_id = p_ipo_id;

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
      COALESCE((v_row->>'applied')::BOOLEAN, true),
      COALESCE((v_row->>'allotted')::BOOLEAN, false),
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

    -- Profit distribution
    v_profit_share := COALESCE((v_row->>'profit_amount')::NUMERIC, 0);

    SELECT
      COALESCE(pp.investor_user_id, pp.user_id),
      pp.user_id
    INTO v_investor_uid, v_account_uid
    FROM public.ipo_participations pp
    WHERE pp.id = (v_row->>'participation_id')::UUID;

    IF v_investor_uid IS NULL THEN
      CONTINUE;
    END IF;

    IF v_investor_uid = v_account_uid THEN
      v_investor_share := v_profit_share;
      v_account_share  := 0;
    ELSE
      v_investor_share := ROUND(v_profit_share * 0.8, 2);
      v_account_share  := ROUND(v_profit_share * 0.2, 2);
    END IF;

    -- Investor profit
    INSERT INTO public.user_ipo_profits (ipo_id, user_id, investor_share, account_holder_share, total_profit)
    VALUES (p_ipo_id, v_investor_uid, v_investor_share, 0, v_investor_share)
    ON CONFLICT (ipo_id, user_id) DO UPDATE SET
      investor_share = public.user_ipo_profits.investor_share + EXCLUDED.investor_share,
      total_profit   = public.user_ipo_profits.total_profit   + EXCLUDED.investor_share,
      updated_at     = NOW();

    -- Account holder profit (only if different person)
    IF v_investor_uid != v_account_uid AND v_account_share > 0 THEN
      INSERT INTO public.user_ipo_profits (ipo_id, user_id, investor_share, account_holder_share, total_profit)
      VALUES (p_ipo_id, v_account_uid, 0, v_account_share, v_account_share)
      ON CONFLICT (ipo_id, user_id) DO UPDATE SET
        account_holder_share = public.user_ipo_profits.account_holder_share + EXCLUDED.account_holder_share,
        total_profit         = public.user_ipo_profits.total_profit         + EXCLUDED.account_holder_share,
        updated_at           = NOW();
    END IF;

    v_rows_ok := v_rows_ok + 1;
  END LOOP;

  UPDATE public.ipos
  SET status = 'COMPLETED', overall_profit = p_overall_profit, completed_at = NOW()
  WHERE id = p_ipo_id;

  IF p_import_id IS NOT NULL THEN
    UPDATE public.ipo_result_imports
    SET status = 'COMPLETED', success_rows = v_rows_ok
    WHERE id = p_import_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'rows_submitted', v_rows_ok);

EXCEPTION WHEN OTHERS THEN
  IF p_import_id IS NOT NULL THEN
    UPDATE public.ipo_result_imports
    SET status = 'FAILED', error_log = jsonb_build_object('error', SQLERRM)
    WHERE id = p_import_id;
  END IF;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ── 7. get_user_profit_loss_summary — uses user_ipo_profits ──
DROP FUNCTION IF EXISTS public.get_user_profit_loss_summary();
DROP FUNCTION IF EXISTS public.get_user_profit_loss_summary(UUID);
CREATE OR REPLACE FUNCTION public.get_user_profit_loss_summary(p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_ipos',         COUNT(DISTINCT p.ipo_id),
    'total_allotted',     COUNT(DISTINCT p.ipo_id) FILTER (WHERE r.allotted = TRUE),
    'total_not_allotted', GREATEST(0, COUNT(DISTINCT p.ipo_id) - COUNT(DISTINCT p.ipo_id) FILTER (WHERE r.allotted = TRUE)),
    'total_profit',
      COALESCE((SELECT SUM(up.total_profit) FROM public.user_ipo_profits up
                WHERE up.user_id = v_uid AND up.total_profit > 0), 0),
    'total_loss',
      COALESCE((SELECT ABS(SUM(up.total_profit)) FROM public.user_ipo_profits up
                WHERE up.user_id = v_uid AND up.total_profit < 0), 0),
    'net_profit',
      COALESCE((SELECT SUM(up.total_profit) FROM public.user_ipo_profits up
                WHERE up.user_id = v_uid), 0),
    'total_refund',     COALESCE(SUM(r.refund_amount), 0),
    'total_tax',        COALESCE(SUM(r.tax_amount), 0),
    'total_settlement', COALESCE(SUM(r.final_settlement_amount), 0)
  )
  INTO v_result
  FROM public.ipo_participations p
  LEFT JOIN public.ipo_results r ON r.participation_id = p.id
  WHERE p.user_id = v_uid OR p.investor_user_id = v_uid;

  RETURN v_result;
END;
$$;

-- ── 8. get_user_ipo_profit_detail ────────────────────────────
DROP FUNCTION IF EXISTS public.get_user_ipo_profit_detail();
DROP FUNCTION IF EXISTS public.get_user_ipo_profit_detail(UUID);
CREATE OR REPLACE FUNCTION public.get_user_ipo_profit_detail(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  ipo_id               UUID,
  ipo_name             TEXT,
  ipo_code             TEXT,
  completed_at         TIMESTAMPTZ,
  investor_share       NUMERIC,
  account_holder_share NUMERIC,
  total_profit         NUMERIC
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    up.ipo_id, i.ipo_name, i.ipo_code, i.completed_at,
    up.investor_share, up.account_holder_share, up.total_profit
  FROM public.user_ipo_profits up
  JOIN public.ipos i ON i.id = up.ipo_id
  WHERE up.user_id = COALESCE(p_user_id, auth.uid())
  ORDER BY i.completed_at DESC NULLS LAST;
$$;

-- ── 9. get_all_users_for_selection (investor dropdown) ───────
CREATE OR REPLACE FUNCTION public.get_all_users_for_selection()
RETURNS TABLE (
  id        UUID,
  username  TEXT,
  full_name TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, username, full_name
  FROM public.profiles
  WHERE is_active = TRUE
  ORDER BY full_name;
$$;

-- ── 10. Allow all users/investors to view IPO details ────────
DROP POLICY IF EXISTS "ipos_select_user" ON public.ipos;
DROP POLICY IF EXISTS "ipos_select_all" ON public.ipos;
CREATE POLICY "ipos_select_all" ON public.ipos
  FOR SELECT USING (TRUE);
