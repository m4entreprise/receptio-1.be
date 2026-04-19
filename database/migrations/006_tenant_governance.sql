ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS disabled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

UPDATE users
SET status = 'active',
    activated_at = COALESCE(activated_at, created_at)
WHERE status IS DISTINCT FROM 'active' OR activated_at IS NULL;

UPDATE users
SET role = 'owner'
WHERE role = 'admin'
  AND id IN (
    SELECT DISTINCT ON (company_id) id
    FROM users
    WHERE company_id IS NOT NULL
    ORDER BY company_id, created_at ASC
  );

UPDATE users
SET role = 'agent'
WHERE role NOT IN ('owner', 'admin', 'agent');

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_company_id ON user_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(20),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  target_label VARCHAR(255),
  before_json JSONB,
  after_json JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created_at ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

UPDATE companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{memberAccessPolicy,agent}',
  COALESCE(settings #> '{memberAccessPolicy,agent}', '{
    "callsRead": true,
    "callDetailRead": true,
    "callRecordingsRead": true,
    "callTransfer": false,
    "callDelete": false,
    "outboundRead": true,
    "outboundCreate": true,
    "outboundManage": false,
    "outboundAllRead": false,
    "analyticsRead": false,
    "staffManage": false,
    "knowledgeBaseManage": false,
    "settingsManage": false,
    "intentsManage": false,
    "qaManage": false,
    "auditLogsRead": false,
    "memberManage": false,
    "outboundScope": "own"
  }'::jsonb),
  true
)
WHERE settings #> '{memberAccessPolicy,agent}' IS NULL;
