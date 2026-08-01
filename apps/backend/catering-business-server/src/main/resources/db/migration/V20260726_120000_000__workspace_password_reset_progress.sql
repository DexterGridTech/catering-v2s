-- R5 public password-reset progress.  Secrets are stored only as SHA-256 hashes.
CREATE TABLE workspace_iam.password_reset_progress (
    password_reset_id UUID PRIMARY KEY REFERENCES workspace_iam.password_reset(id) ON DELETE RESTRICT,
    password_reset_grant_hash CHAR(64),
    password_reset_grant_expires_at_epoch_millis BIGINT,
    completed_at_epoch_millis BIGINT,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX ix_password_reset_progress_grant
    ON workspace_iam.password_reset_progress (password_reset_grant_hash)
    WHERE password_reset_grant_hash IS NOT NULL;
