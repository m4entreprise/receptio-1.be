-- Migration 005 : moteur QA enrichi, alertes et debug
-- Applique après 004_call_intents.sql

ALTER TABLE analysis_templates
  ADD COLUMN IF NOT EXISTS system_prompt TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS flag_definitions JSONB NOT NULL DEFAULT '[]';

ALTER TABLE call_analysis_results
  ADD COLUMN IF NOT EXISTS flags_detail JSONB,
  ADD COLUMN IF NOT EXISTS resume TEXT,
  ADD COLUMN IF NOT EXISTS coaching_tip TEXT,
  ADD COLUMN IF NOT EXISTS model VARCHAR(64),
  ADD COLUMN IF NOT EXISTS prompt_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS retries SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_response TEXT;

CREATE TABLE IF NOT EXISTS qa_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  call_id UUID NOT NULL REFERENCES calls(id),
  flag_type VARCHAR(64) NOT NULL,
  agent_id UUID REFERENCES staff(id),
  extrait TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_alerts_company_ack_created
  ON qa_alerts (company_id, acknowledged, created_at DESC);
