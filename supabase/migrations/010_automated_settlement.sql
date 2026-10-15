-- =============================================================================
-- Migration 010: Automated IPO Settlement Support & Audit Snapshots
-- =============================================================================
-- 1. Extend ipo_result_imports source_type to allow 'AUTOMATED'
-- 2. Create ipo_settlement_runs for storing calculation snapshots & audit trail
-- 3. Grant proper permissions and RLS policies
-- =============================================================================

-- 1. Extend source_type check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ipo_result_imports_source_type_check'
  ) THEN
    ALTER TABLE public.ipo_result_imports DROP CONSTRAINT ipo_result_imports_source_type_check;
  END IF;
  
  ALTER TABLE public.ipo_result_imports
    ADD CONSTRAINT ipo_result_imports_source_type_check
    CHECK (source_type IN ('PASTE', 'CSV', 'EXCEL', 'AUTOMATED'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update source_type check constraint: %', SQLERRM;
END $$;

-- 2. Create settlement runs / snapshot table for calculation audit
CREATE TABLE IF NOT EXISTS public.ipo_settlement_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_id                  UUID NOT NULL REFERENCES public.ipos(id) ON DELETE CASCADE,
  published_by            UUID REFERENCES public.profiles(id),
  effective_selling_price NUMERIC(15,4) NOT NULL,
  total_selling_charges   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_allotted_lots     INTEGER NOT NULL DEFAULT 0,
  total_profit            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_tax_reserve       NUMERIC(15,2) NOT NULL DEFAULT 0,
  distributable_profit    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_contributed       NUMERIC(15,2) NOT NULL DEFAULT 0,
  sum_profit_shares       NUMERIC(15,2) NOT NULL DEFAULT 0,
  rounding_residual       NUMERIC(15,4) NOT NULL DEFAULT 0,
  tax_rate                NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  selected_applicants     JSONB NOT NULL DEFAULT '[]'::JSONB,
  settlement_summary      JSONB NOT NULL DEFAULT '{}'::JSONB,
  status                  TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast query by ipo
CREATE INDEX IF NOT EXISTS idx_settlement_runs_ipo ON public.ipo_settlement_runs(ipo_id);
CREATE INDEX IF NOT EXISTS idx_settlement_runs_date ON public.ipo_settlement_runs(published_at DESC);

-- Enable RLS
ALTER TABLE public.ipo_settlement_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "settlement_runs_admin_all" ON public.ipo_settlement_runs;
DROP POLICY IF EXISTS "settlement_runs_select_admin" ON public.ipo_settlement_runs;

-- Admin-only full access policy
CREATE POLICY "settlement_runs_admin_all" ON public.ipo_settlement_runs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Permissions
GRANT ALL ON TABLE public.ipo_settlement_runs TO authenticated;
