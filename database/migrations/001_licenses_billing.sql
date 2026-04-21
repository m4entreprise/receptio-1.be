-- Migration 001 : Licences par entreprise + Tarifs de facturation
-- À exécuter sur la base existante : psql $DATABASE_URL -f migrations/001_licenses_billing.sql

-- Licences par entreprise (historique d'activation)
CREATE TABLE IF NOT EXISTS company_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    license_key VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(company_id, license_key)
);

CREATE INDEX IF NOT EXISTS idx_company_licenses_company_id ON company_licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_company_licenses_active ON company_licenses(company_id, active);
CREATE INDEX IF NOT EXISTS idx_company_licenses_activated_at ON company_licenses(activated_at);

-- Tarifs de facturation (configurables par le super admin)
CREATE TABLE IF NOT EXISTS billing_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    rate_cents INTEGER NOT NULL DEFAULT 0,
    rate_type VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly' | 'per_minute'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO billing_rates (key, label, rate_cents, rate_type) VALUES
    ('offer_a',          'Offre A — Répondeur classique',   2900, 'monthly'),
    ('offer_b',          'Offre B — Répondeur IA',          4900, 'monthly'),
    ('smart_routing',    'Routage intelligent',              1500, 'monthly'),
    ('outbound_license', 'Licence appels sortants',          1000, 'monthly'),
    ('inbound_per_min',  'Appels entrants (par minute)',        3, 'per_minute'),
    ('outbound_per_min', 'Appels sortants (par minute)',        8, 'per_minute')
ON CONFLICT (key) DO NOTHING;
