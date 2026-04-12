-- Migration 004 : intents configurables par tenant
-- Applique après 003_analytics_qa.sql

-- Table des intents de qualification configurés par tenant
CREATE TABLE IF NOT EXISTS call_intents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  label        VARCHAR(100) NOT NULL,
  description  TEXT,
  keywords     TEXT,                        -- mots-clés séparés par virgule pour aider l'IA
  color        VARCHAR(20) DEFAULT '#344453',
  position     INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_intents_company ON call_intents(company_id, is_active);

-- On conserve la colonne `intent` sur call_summaries (VARCHAR libre), elle stocke désormais
-- le label de l'intent configuré (ou 'autre' si non reconnu).
