-- ============================================================
-- 001_initial_schema.sql
-- Core tables for IPO Monitoring & Group Investment Tracker
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── IPO code sequence ────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS ipo_code_seq START 1001 INCREMENT 1;

-- ── Profiles (extends auth.users) ───────────────────────────
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT        NOT NULL UNIQUE,
  full_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── IPOs ─────────────────────────────────────────────────────
CREATE TABLE public.ipos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_code       TEXT        NOT NULL UNIQUE,
  ipo_name       TEXT        NOT NULL,
  ipo_price      NUMERIC(15,2) NOT NULL CHECK (ipo_price > 0),
  start_date     DATE,
  end_date       DATE,
  status         TEXT        NOT NULL DEFAULT 'DRAFT'
                              CHECK (status IN ('DRAFT','OPEN','CLOSED','PROCESSING','COMPLETED','CANCELLED')),
  overall_profit NUMERIC(15,2),
  created_by     UUID        REFERENCES public.profiles(id),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Auto-generate IPO code from sequence
CREATE OR REPLACE FUNCTION generate_ipo_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.ipo_code := 'IPO' || LPAD(nextval('ipo_code_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_ipo_code
  BEFORE INSERT ON public.ipos
  FOR EACH ROW EXECUTE FUNCTION generate_ipo_code();

-- ── IPO Participations ───────────────────────────────────────
CREATE TABLE public.ipo_participations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_id             UUID        NOT NULL REFERENCES public.ipos(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participation_type TEXT        NOT NULL CHECK (participation_type IN ('INVESTOR','ACCOUNT_HOLDER')),
  application_number TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_participation_per_ipo UNIQUE (ipo_id, user_id),
  CONSTRAINT investor_requires_app_number CHECK (
    participation_type = 'ACCOUNT_HOLDER'
    OR (participation_type = 'INVESTOR' AND application_number IS NOT NULL AND application_number <> '')
  )
);

-- ── IPO Results ──────────────────────────────────────────────
CREATE TABLE public.ipo_results (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id        UUID        NOT NULL UNIQUE REFERENCES public.ipo_participations(id) ON DELETE CASCADE,
  applied                 BOOLEAN     NOT NULL DEFAULT FALSE,
  allotted                BOOLEAN     NOT NULL DEFAULT FALSE,
  lots                    INTEGER     NOT NULL DEFAULT 0 CHECK (lots >= 0),
  applied_from            TEXT,
  refund_amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
  final_settlement_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  result_status           TEXT        NOT NULL DEFAULT 'PENDING'
                                       CHECK (result_status IN ('PENDING','ALLOTTED','NOT_ALLOTTED','REFUNDED')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Result Import Sessions ───────────────────────────────────
CREATE TABLE public.ipo_result_imports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_id        UUID        NOT NULL REFERENCES public.ipos(id) ON DELETE CASCADE,
  imported_by   UUID        REFERENCES public.profiles(id),
  source_type   TEXT        NOT NULL DEFAULT 'PASTE' CHECK (source_type IN ('PASTE','CSV','EXCEL')),
  total_rows    INTEGER     NOT NULL DEFAULT 0,
  success_rows  INTEGER     NOT NULL DEFAULT 0,
  failed_rows   INTEGER     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED')),
  error_log     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Updated_at trigger function ──────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at  BEFORE UPDATE ON public.profiles  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ipos_updated_at      BEFORE UPDATE ON public.ipos      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_results_updated_at   BEFORE UPDATE ON public.ipo_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();
