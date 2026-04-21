-- Migration 002 : Historique des tarifs de facturation
-- Permet de facturer correctement même si un tarif change en cours de période
-- À exécuter après 001_licenses_billing.sql

CREATE TABLE IF NOT EXISTS billing_rates_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate_key VARCHAR(50) NOT NULL,
    rate_cents INTEGER NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_to TIMESTAMP WITH TIME ZONE, -- NULL = tarif encore en vigueur
    changed_by_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brh_rate_key ON billing_rates_history(rate_key);
CREATE INDEX IF NOT EXISTS idx_brh_effective ON billing_rates_history(rate_key, effective_from, effective_to);

-- Amorcer l'historique avec les tarifs actuels
-- effective_from = 2020-01-01 pour couvrir tous les appels passés
INSERT INTO billing_rates_history (rate_key, rate_cents, effective_from)
SELECT key, rate_cents, '2020-01-01 00:00:00+00'::timestamptz
FROM billing_rates
ON CONFLICT DO NOTHING;
