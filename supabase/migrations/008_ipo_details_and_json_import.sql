-- ============================================================
-- 008_ipo_details_and_json_import.sql
-- IPO Details, Canonical Model Storage, and Atomic Creation
-- ============================================================

-- ── 1. Create ipo_details table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.ipo_details (
  ipo_id            UUID          PRIMARY KEY REFERENCES public.ipos(id) ON DELETE CASCADE,
  company_name      TEXT,
  ipo_type          TEXT,
  market_segment    TEXT,
  exchanges         TEXT[]        DEFAULT '{}',
  sale_type         TEXT,
  issue_type        TEXT,
  face_value        NUMERIC(15,2),
  min_price         NUMERIC(15,2),
  max_price         NUMERIC(15,2),
  cutoff_price      NUMERIC(15,2),
  lot_size          INTEGER,
  min_investment    NUMERIC(15,2),
  issue_size        TEXT,
  fresh_issue       BOOLEAN,
  ofs_percentage    NUMERIC(8,2),
  ofs_shares        NUMERIC(20,2),
  pre_issue_shares  NUMERIC(20,2),
  post_issue_shares NUMERIC(20,2),
  company_proceeds  NUMERIC(15,2),
  currency          TEXT          DEFAULT 'INR',
  allotment_date    DATE,
  refund_date       DATE,
  demat_credit_date DATE,
  listing_date      DATE,
  gmp_data          JSONB         DEFAULT '{}'::JSONB,
  subscription_data JSONB         DEFAULT '{}'::JSONB,
  reservation_quota JSONB         DEFAULT '{}'::JSONB,
  issue_details     JSONB         DEFAULT '{}'::JSONB,
  lot_size_details  JSONB         DEFAULT '[]'::JSONB,
  kpi_data          JSONB         DEFAULT '{}'::JSONB,
  financials_data   JSONB         DEFAULT '{}'::JSONB,
  company_details   JSONB         DEFAULT '{}'::JSONB,
  company_contact   JSONB         DEFAULT '{}'::JSONB,
  official_documents JSONB        DEFAULT '{}'::JSONB,
  faq_data          JSONB         DEFAULT '[]'::JSONB,
  raw_json          JSONB,
  source            TEXT          DEFAULT 'IPO Gyani',
  imported_at       TIMESTAMPTZ   DEFAULT NOW(),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER trg_ipo_details_updated_at
  BEFORE UPDATE ON public.ipo_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. Enable RLS and Permissions on ipo_details ──────────────
ALTER TABLE public.ipo_details ENABLE ROW LEVEL SECURITY;

-- Grant permissions to standard Supabase roles
GRANT ALL ON TABLE public.ipo_details TO authenticated;
GRANT SELECT ON TABLE public.ipo_details TO anon;
GRANT ALL ON TABLE public.ipo_details TO service_role;

-- Allow public and users to SELECT ipo_details for published (OPEN) IPOs or participating users or admins
DROP POLICY IF EXISTS "ipo_details_select_public" ON public.ipo_details;
CREATE POLICY "ipo_details_select_public" ON public.ipo_details
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.ipos i
      WHERE i.id = ipo_details.ipo_id
        AND (
          i.status = 'OPEN'
          OR EXISTS (
            SELECT 1 FROM public.ipo_participations p
            WHERE p.ipo_id = i.id AND p.user_id = auth.uid()
          )
        )
    )
  );

-- Admins can insert, update, delete
DROP POLICY IF EXISTS "ipo_details_insert_admin" ON public.ipo_details;
CREATE POLICY "ipo_details_insert_admin" ON public.ipo_details
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ipo_details_update_admin" ON public.ipo_details;
CREATE POLICY "ipo_details_update_admin" ON public.ipo_details
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "ipo_details_delete_admin" ON public.ipo_details;
CREATE POLICY "ipo_details_delete_admin" ON public.ipo_details
  FOR DELETE USING (public.is_admin());

-- ── 3. Atomic creation function ──────────────────────────────
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
BEGIN
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
    COALESCE(NULLIF(p_status, ''), 'OPEN'),
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
    )
    VALUES (
      v_ipo_id,
      p_details->>'company_name',
      p_details->>'ipo_type',
      p_details->>'market_segment',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_details->'exchanges', '[]'::jsonb))),
      p_details->>'sale_type',
      p_details->>'issue_type',
      (p_details->>'face_value')::numeric,
      (p_details->>'min_price')::numeric,
      (p_details->>'max_price')::numeric,
      (p_details->>'cutoff_price')::numeric,
      (p_details->>'lot_size')::integer,
      (p_details->>'min_investment')::numeric,
      p_details->>'issue_size',
      (p_details->>'fresh_issue')::boolean,
      (p_details->>'ofs_percentage')::numeric,
      (p_details->>'ofs_shares')::numeric,
      (p_details->>'pre_issue_shares')::numeric,
      (p_details->>'post_issue_shares')::numeric,
      (p_details->>'company_proceeds')::numeric,
      COALESCE(p_details->>'currency', 'INR'),
      (p_details->>'allotment_date')::date,
      (p_details->>'refund_date')::date,
      (p_details->>'demat_credit_date')::date,
      (p_details->>'listing_date')::date,
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
    'status', COALESCE(NULLIF(p_status, ''), 'OPEN')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ipo_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ipo_with_details TO service_role;

