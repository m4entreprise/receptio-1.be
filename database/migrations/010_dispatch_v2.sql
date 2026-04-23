-- =========================================================
-- Migration 010 — Dispatch V2
-- Conditions riches · Actions flexibles · Chaîne de fallback
-- Round-robin natif · Opérateur AND / OR / TOUJOURS
-- =========================================================

BEGIN;

-- ─── Étape 1 : Préserver l'ancien champ conditions ─────────────────────────
ALTER TABLE dispatch_rules RENAME COLUMN conditions TO conditions_legacy;

-- ─── Étape 2 : Nouvelles colonnes ──────────────────────────────────────────
ALTER TABLE dispatch_rules
  ADD COLUMN condition_operator VARCHAR(10) NOT NULL DEFAULT 'ALWAYS'
    CHECK (condition_operator IN ('AND', 'OR', 'ALWAYS')),
  ADD COLUMN conditions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN action           JSONB,
  ADD COLUMN fallback_chain   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN round_robin_index INTEGER NOT NULL DEFAULT 0;

-- ─── Étape 3 : Migration des données existantes ────────────────────────────

UPDATE dispatch_rules SET
  -- Opérateur de condition
  condition_operator = CASE
    WHEN condition_type = 'always' THEN 'ALWAYS'
    ELSE 'AND'
  END,

  -- Tableau de conditions (format V2)
  conditions = CASE
    WHEN condition_type = 'intent' THEN
      jsonb_build_array(
        jsonb_build_object(
          'id',         gen_random_uuid()::text,
          'type',       'intent',
          'intents',    COALESCE(conditions_legacy->'intents', '[]'::jsonb),
          'match_mode', 'any'
        )
      )
    ELSE '[]'::jsonb
  END,

  -- Action principale (format V2)
  action = CASE
    WHEN target_type = 'agent' AND target_staff_id IS NOT NULL THEN
      jsonb_build_object(
        'type',          'route_agent',
        'agent_id',      target_staff_id::text,
        'ring_duration', 30
      )
    WHEN target_type = 'group' AND target_group_id IS NOT NULL THEN
      jsonb_build_object(
        'type',                  'route_group',
        'group_id',              target_group_id::text,
        'distribution_strategy', COALESCE(distribution_strategy, 'sequential'),
        'agent_order',           COALESCE(agent_order, '[]'::jsonb),
        'retry', jsonb_build_object(
          'max_attempts',           3,
          'ring_duration',          30,
          'between_attempts_delay', 2
        )
      )
    ELSE
      jsonb_build_object(
        'type',          'voicemail',
        'greeting_text', 'Veuillez laisser votre message après le bip.'
      )
  END,

  -- Chaîne de fallback (format V2)
  fallback_chain = CASE
    WHEN fallback_type = 'voicemail' THEN
      jsonb_build_array(
        jsonb_build_object(
          'id',    gen_random_uuid()::text,
          'label', 'Messagerie vocale',
          'action', jsonb_build_object(
            'type',          'voicemail',
            'greeting_text', 'Veuillez laisser votre message après le bip.'
          )
        )
      )

    WHEN fallback_type = 'agent' AND fallback_staff_id IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'id',    gen_random_uuid()::text,
          'label', 'Responsable',
          'action', jsonb_build_object(
            'type',          'route_agent',
            'agent_id',      fallback_staff_id::text,
            'ring_duration', 30
          )
        ),
        jsonb_build_object(
          'id',    gen_random_uuid()::text,
          'label', 'Messagerie vocale',
          'action', jsonb_build_object(
            'type',          'voicemail',
            'greeting_text', 'Veuillez laisser votre message après le bip.'
          )
        )
      )

    WHEN fallback_type = 'group' AND fallback_group_id IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'id',    gen_random_uuid()::text,
          'label', 'Groupe de secours',
          'action', jsonb_build_object(
            'type',                  'route_group',
            'group_id',              fallback_group_id::text,
            'distribution_strategy', 'simultaneous',
            'agent_order',           '[]'::jsonb,
            'retry', jsonb_build_object(
              'max_attempts',           1,
              'ring_duration',          30,
              'between_attempts_delay', 0
            )
          )
        ),
        jsonb_build_object(
          'id',    gen_random_uuid()::text,
          'label', 'Messagerie vocale',
          'action', jsonb_build_object(
            'type',          'voicemail',
            'greeting_text', 'Veuillez laisser votre message après le bip.'
          )
        )
      )

    ELSE '[]'::jsonb
  END;

-- ─── Étape 4 : Contraintes post-migration ──────────────────────────────────
ALTER TABLE dispatch_rules ALTER COLUMN action SET NOT NULL;

-- ─── Étape 5 : Suppression des colonnes obsolètes ──────────────────────────
ALTER TABLE dispatch_rules
  DROP COLUMN IF EXISTS condition_type,
  DROP COLUMN IF EXISTS conditions_legacy,
  DROP COLUMN IF EXISTS target_type,
  DROP COLUMN IF EXISTS target_group_id,
  DROP COLUMN IF EXISTS target_staff_id,
  DROP COLUMN IF EXISTS distribution_strategy,
  DROP COLUMN IF EXISTS agent_order,
  DROP COLUMN IF EXISTS fallback_type,
  DROP COLUMN IF EXISTS fallback_group_id,
  DROP COLUMN IF EXISTS fallback_staff_id,
  DROP COLUMN IF EXISTS position_x,
  DROP COLUMN IF EXISTS position_y;

-- ─── Étape 6 : Index de performance ────────────────────────────────────────

-- Index composite pour la résolution rapide (requête principale du moteur)
CREATE INDEX IF NOT EXISTS idx_dispatch_rules_enabled_priority
  ON dispatch_rules(company_id, priority ASC)
  WHERE enabled = true;

-- Index GIN pour les requêtes sur le type d'action (ex: tous les routes_group)
CREATE INDEX IF NOT EXISTS idx_dispatch_rules_action_type
  ON dispatch_rules USING gin(action jsonb_path_ops);

COMMIT;
