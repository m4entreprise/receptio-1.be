ALTER TABLE user_invitations
  DROP CONSTRAINT IF EXISTS user_invitations_company_id_email_status_key;

DROP INDEX IF EXISTS idx_user_invitations_pending_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invitations_pending_unique
  ON user_invitations(company_id, lower(email))
  WHERE status = 'pending';
