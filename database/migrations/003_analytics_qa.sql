-- =====================================================
-- Migration 003 : Analytics QA tables
-- =====================================================

-- 1. Templates d'analyse QA (versionnés, jamais mutés si déjà utilisés)
CREATE TABLE IF NOT EXISTS analysis_templates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name             VARCHAR(255) NOT NULL,
  call_type        VARCHAR(50)  DEFAULT '*',     -- 'sinistre' | 'nouvelle_affaire' | '*'
  prompt_template  TEXT         NOT NULL,
  output_schema    JSONB,
  version          INTEGER      DEFAULT 1,
  is_active        BOOLEAN      DEFAULT true,
  superseded_by    UUID         REFERENCES analysis_templates(id),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Critères paramétrables par template
CREATE TABLE IF NOT EXISTS analysis_criteria (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  UUID REFERENCES analysis_templates(id) ON DELETE CASCADE NOT NULL,
  label        VARCHAR(255) NOT NULL,
  description  TEXT,
  weight       INTEGER      DEFAULT 10,              -- % contribution au score global
  type         VARCHAR(20)  DEFAULT 'boolean',       -- 'boolean' | 'score_0_5' | 'text'
  required     BOOLEAN      DEFAULT false,
  position     INTEGER      DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Résultats d'analyse IA (liés à une version figée du template)
CREATE TABLE IF NOT EXISTS call_analysis_results (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id          UUID REFERENCES calls(id) ON DELETE CASCADE NOT NULL,
  template_id      UUID REFERENCES analysis_templates(id) NOT NULL,
  template_version INTEGER NOT NULL,
  scores           JSONB,     -- {"criteria_id": true | 4 | "bon travail"}
  global_score     INTEGER,   -- 0-100, pondéré par weight
  verbatims        JSONB,     -- {"criteria_id": "L'agent a dit..."}
  flags            JSONB,     -- ["manquement_script", "prospect_chaud"]
  processed_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_analysis_templates_company
  ON analysis_templates(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_analysis_criteria_template
  ON analysis_criteria(template_id, position);

CREATE INDEX IF NOT EXISTS idx_call_analysis_results_call
  ON call_analysis_results(call_id);

CREATE INDEX IF NOT EXISTS idx_call_analysis_results_template
  ON call_analysis_results(template_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_analysis_results_processed
  ON call_analysis_results(processed_at DESC);
