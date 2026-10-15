-- ============================================================
-- 009_fix_default_status_and_publish_drafts.sql
-- Fixes:
--   1. Update create_ipo_with_details RPC default from DRAFT → OPEN
--   2. Publish IPO1006 (HD Fire Protect IPO) from DRAFT → OPEN
-- ============================================================

-- ── 1. Re-create the RPC with OPEN as the default status ───
CREATE OR REPLACE FUNCTION public.create_ipo_with_details(
  p_ipo_name    TEXT,
  p_ipo_price   NUMERIC,
  p_start_date  DATE,
  p_end_date    DATE,
  p_status      TEXT,
  p_created_by  UUID,
  p_details     JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ipo_id      UUID;
  v_ipo_code    TEXT;
  v_result      JSONB;
  v_status      TEXT;
BEGIN
  -- Resolve effective status (default to OPEN when empty/null)
  v_status := COALESCE(NULLIF(TRIM(p_status), ''), 'OPEN');

  -- 1. Authorization: must be admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only active administrators can create IPOs.';
  END IF;

  -- 2. Validate input
  IF p_ipo_name IS NULL OR TRIM(p_ipo_name) = '' THEN
    RAISE EXCEPTION 'IPO name cannot be empty.';
  END IF;
  IF p_ipo_price IS NULL OR p_ipo_price <= 0 THEN
    RAISE EXCEPTION 'IPO price must be a positive number.';
  END IF;
  IF p_end_date IS NOT NULL AND p_start_date IS NOT NULL AND p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be on or after start date.';
  END IF;

  -- 3. Insert into ipos
  INSERT INTO public.ipos (
    ipo_name,
    ipo_price,
    start_date,
    end_date,
    status,
    created_by
  )
  VALUES (
    TRIM(p_ipo_name),
    p_ipo_price,
    p_start_date,
    p_end_date,
    v_status,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id, ipo_code INTO v_ipo_id, v_ipo_code;

  -- 4. If details provided, insert into ipo_details
  IF p_details IS NOT NULL AND p_details <> '{}'::jsonb THEN
    INSERT INTO public.ipo_details (
      ipo_id,
      company_name,
      ipo_type,
      market_segment,
      exchanges,
      sale_type,
      issue_type,
      face_value,
      min_price,
      max_price,
      cutoff_price,
      lot_size,
      min_investment,
      issue_size,
      fresh_issue,
      ofs_percentage,
      ofs_shares,
      pre_issue_shares,
      post_issue_shares,
      company_proceeds,
      currency,
      allotment_date,
      refund_date,
      demat_credit_date,
      listing_date,
      gmp_data,
      subscription_data,
      reservation_quota,
      issue_details,
      lot_size_details,
      kpi_data,
      financials_data,
      company_details,
      company_contact,
      official_documents,
      faq_data,
      raw_json,
      source,
      imported_at
    ) VALUES (
      v_ipo_id,
      COALESCE(p_details->>'company_name', TRIM(p_ipo_name)),
      p_details->>'ipo_type',
      p_details->>'market_segment',
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(p_details->'exchanges')),
        '{}'::TEXT[]
      ),
      p_details->>'sale_type',
      p_details->>'issue_type',
      (p_details->>'face_value')::NUMERIC,
      (p_details->>'min_price')::NUMERIC,
      (p_details->>'max_price')::NUMERIC,
      (p_details->>'cutoff_price')::NUMERIC,
      (p_details->>'lot_size')::INTEGER,
      (p_details->>'min_investment')::NUMERIC,
      p_details->>'issue_size',
      (p_details->>'fresh_issue')::BOOLEAN,
      (p_details->>'ofs_percentage')::NUMERIC,
      (p_details->>'ofs_shares')::NUMERIC,
      (p_details->>'pre_issue_shares')::NUMERIC,
      (p_details->>'post_issue_shares')::NUMERIC,
      (p_details->>'company_proceeds')::NUMERIC,
      COALESCE(p_details->>'currency', 'INR'),
      (p_details->>'allotment_date')::DATE,
      (p_details->>'refund_date')::DATE,
      (p_details->>'demat_credit_date')::DATE,
      (p_details->>'listing_date')::DATE,
      COALESCE(p_details->'gmp', '{}'::jsonb),
      COALESCE(p_details->'subscription', '{}'::jsonb),
      COALESCE(p_details->'reservation_quota', '{}'::jsonb),
      COALESCE(p_details->'issue_details', '{}'::jsonb),
      COALESCE(p_details->'lot_size_details', '[]'::jsonb),
      COALESCE(p_details->'kpi', '{}'::jsonb),
      COALESCE(p_details->'financials', '{}'::jsonb),
      COALESCE(p_details->'company_details', '{}'::jsonb),
      COALESCE(p_details->'company_contact', '{}'::jsonb),
      COALESCE(p_details->'official_documents', '{}'::jsonb),
      COALESCE(p_details->'faq', '[]'::jsonb),
      p_details->'raw_json',
      COALESCE(p_details->>'source', 'IPO Gyani'),
      NOW()
    );
  END IF;

  SELECT jsonb_build_object(
    'id', v_ipo_id,
    'ipo_code', v_ipo_code,
    'ipo_name', p_ipo_name,
    'ipo_price', p_ipo_price,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'status', v_status
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ipo_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ipo_with_details TO service_role;

-- ── 2. Publish IPO1006 (HD Fire Protect IPO) which is stuck in DRAFT ──
UPDATE public.ipos
SET status = 'OPEN'
WHERE ipo_code = 'IPO1006'
  AND status = 'DRAFT';
