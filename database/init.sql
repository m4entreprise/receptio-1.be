-- Receptio Database Schema
-- Version 1.0 - MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table (for dashboard access)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    caller_number VARCHAR(50),
    caller_name VARCHAR(255),
    direction VARCHAR(20) DEFAULT 'inbound',
    status VARCHAR(50) DEFAULT 'received',
    duration INTEGER DEFAULT 0,
    recording_url TEXT,
    recording_path TEXT,
    call_sid VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'fr',
    confidence DECIMAL(3,2),
    segments JSONB DEFAULT NULL, -- Structured transcript with speaker roles: [{role: 'agent'|'client', text, ts}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Call summaries (AI-generated)
CREATE TABLE IF NOT EXISTS call_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    summary TEXT,
    intent VARCHAR(100),
    sentiment VARCHAR(50),
    actions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations (for Offre B - real-time AI agent)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    state VARCHAR(50) DEFAULT 'active',
    context JSONB DEFAULT '{}',
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Call events (for analytics and debugging)
CREATE TABLE IF NOT EXISTS call_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Business rules (configurable per company)
CREATE TABLE IF NOT EXISTS business_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    rule_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    conditions JSONB DEFAULT '{}',
    actions JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_base_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_company_id ON calls(company_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_transcriptions_call_id ON transcriptions(call_id);
CREATE INDEX IF NOT EXISTS idx_call_summaries_call_id ON call_summaries(call_id);
CREATE INDEX IF NOT EXISTS idx_conversations_call_id ON conversations(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_timestamp ON call_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_company_id ON business_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_company_id ON knowledge_base_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_enabled ON knowledge_base_entries(enabled);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_companies_updated_at'
          AND tgrelid = 'companies'::regclass
    ) THEN
        CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_users_updated_at'
          AND tgrelid = 'users'::regclass
    ) THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_conversations_updated_at'
          AND tgrelid = 'conversations'::regclass
    ) THEN
        CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_business_rules_updated_at'
          AND tgrelid = 'business_rules'::regclass
    ) THEN
        CREATE TRIGGER update_business_rules_updated_at BEFORE UPDATE ON business_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_knowledge_base_entries_updated_at'
          AND tgrelid = 'knowledge_base_entries'::regclass
    ) THEN
        CREATE TRIGGER update_knowledge_base_entries_updated_at BEFORE UPDATE ON knowledge_base_entries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Staff table (tenant members: secretaries, agents, etc.)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    role VARCHAR(100) DEFAULT 'secrétaire',
    voicemail_message TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_company_id ON staff(company_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_staff_updated_at'
          AND tgrelid = 'staff'::regclass
    ) THEN
        CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Smart routing: queue columns on calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS queue_status VARCHAR(30) DEFAULT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS queue_reason TEXT DEFAULT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_queue_status ON calls(company_id, queue_status) WHERE queue_status IS NOT NULL;

-- Outbound calls: extra columns on calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS initiated_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS destination_number VARCHAR(50) DEFAULT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS live_transcript TEXT DEFAULT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS live_summary TEXT DEFAULT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outbound_call_sid VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(company_id, direction);
CREATE INDEX IF NOT EXISTS idx_calls_initiated_by ON calls(initiated_by_staff_id) WHERE initiated_by_staff_id IS NOT NULL;

-- Staff groups: logical groupings for dispatch/call routing
CREATE TABLE IF NOT EXISTS staff_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    role VARCHAR(255),
    schedule JSONB DEFAULT '{"monday":{"enabled":true,"open":"08:00","close":"18:00"},"tuesday":{"enabled":true,"open":"08:00","close":"18:00"},"wednesday":{"enabled":true,"open":"08:00","close":"18:00"},"thursday":{"enabled":true,"open":"08:00","close":"18:00"},"friday":{"enabled":true,"open":"08:00","close":"18:00"},"saturday":{"enabled":false,"open":"08:00","close":"18:00"},"sunday":{"enabled":false,"open":"08:00","close":"18:00"}}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_groups_company_id ON staff_groups(company_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_staff_groups_updated_at'
          AND tgrelid = 'staff_groups'::regclass
    ) THEN
        CREATE TRIGGER update_staff_groups_updated_at BEFORE UPDATE ON staff_groups
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Junction table: which staff members belong to which group
CREATE TABLE IF NOT EXISTS staff_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES staff_groups(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_group_members_group_id ON staff_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_staff_group_members_staff_id ON staff_group_members(staff_id);

-- Dispatch rules: call routing configuration per company
CREATE TABLE IF NOT EXISTS dispatch_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    condition_type VARCHAR(50) DEFAULT 'always',
    conditions JSONB DEFAULT '{}',
    target_type VARCHAR(50) DEFAULT 'group',
    target_group_id UUID REFERENCES staff_groups(id) ON DELETE SET NULL,
    target_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    distribution_strategy VARCHAR(50) DEFAULT 'sequential',
    agent_order JSONB DEFAULT '[]',
    fallback_type VARCHAR(50) DEFAULT 'voicemail',
    fallback_group_id UUID REFERENCES staff_groups(id) ON DELETE SET NULL,
    fallback_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatch_rules_company_id ON dispatch_rules(company_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_dispatch_rules_updated_at'
          AND tgrelid = 'dispatch_rules'::regclass
    ) THEN
        CREATE TRIGGER update_dispatch_rules_updated_at BEFORE UPDATE ON dispatch_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Super admins table (platform-level, no company_id)
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Audit log for impersonation sessions
CREATE TABLE IF NOT EXISTS impersonation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    super_admin_email VARCHAR(255) NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_super_admin ON impersonation_logs(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_company ON impersonation_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_created_at ON impersonation_logs(created_at DESC);

-- Licences par entreprise (activation historique)
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

-- Tarifs de facturation (configurables par super admin)
CREATE TABLE IF NOT EXISTS billing_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    rate_cents INTEGER NOT NULL DEFAULT 0,
    rate_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
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

-- Historique des tarifs de facturation (audit trail pour la facturation correcte)
CREATE TABLE IF NOT EXISTS billing_rates_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate_key VARCHAR(50) NOT NULL,
    rate_cents INTEGER NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_to TIMESTAMP WITH TIME ZONE,
    changed_by_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brh_rate_key ON billing_rates_history(rate_key);
CREATE INDEX IF NOT EXISTS idx_brh_effective ON billing_rates_history(rate_key, effective_from, effective_to);

-- Amorcer l'historique avec les tarifs initiaux (effective_from = 2020-01-01 pour couvrir tout l'historique)
INSERT INTO billing_rates_history (rate_key, rate_cents, effective_from)
SELECT key, rate_cents, '2020-01-01 00:00:00+00'::timestamptz FROM billing_rates
ON CONFLICT DO NOTHING;

-- Insert demo company for testing
INSERT INTO companies (name, email, phone_number, settings) VALUES
('Demo Company', 'demo@receptio.be', '+32470123456', '{"timezone": "Europe/Brussels", "language": "fr"}')
ON CONFLICT (email) DO NOTHING;
