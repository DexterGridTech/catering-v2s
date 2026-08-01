-- R5 public invitation lifecycle support. No raw OTP, password, invitation token or grant is stored.
CREATE TABLE workspace_iam.invitation_public_progress (
    invitation_id UUID PRIMARY KEY REFERENCES workspace_iam.invitation(id) ON DELETE RESTRICT,
    verification_grant_hash CHAR(64),
    verification_grant_expires_at_epoch_millis BIGINT,
    login_name_normalized VARCHAR(120),
    display_name VARCHAR(120),
    password_hash VARCHAR(255),
    credential_ready_at_epoch_millis BIGINT,
    completion_account_id UUID REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT,
    completed_at_epoch_millis BIGINT,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX ix_invitation_public_progress_grant
    ON workspace_iam.invitation_public_progress (verification_grant_hash)
    WHERE verification_grant_hash IS NOT NULL;
