-- ============================================================
-- 011 — Dispatch Flow : graphe visuel de routage d'appels
-- Remplace la logique de priorité linéaire par un vrai DAG
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_flows (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  nodes      JSONB       NOT NULL DEFAULT '[]',
  edges      JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_flows_company ON dispatch_flows(company_id);

CREATE OR REPLACE FUNCTION dispatch_flows_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_flows_updated_at ON dispatch_flows;
CREATE TRIGGER trg_dispatch_flows_updated_at
  BEFORE UPDATE ON dispatch_flows
  FOR EACH ROW EXECUTE FUNCTION dispatch_flows_updated_at();
