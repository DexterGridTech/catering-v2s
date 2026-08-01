-- Anonymous operations recovery is separate from the administrator-issued password_reset generation.
CREATE TABLE workspace_iam.operations_password_recovery (
    id UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    account_id UUID REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT,
    flow_token_hash CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    expires_at_epoch_millis BIGINT NOT NULL,
    completion_grant_hash CHAR(64),
    completion_grant_expires_at_epoch_millis BIGINT,
    completed_at_epoch_millis BIGINT,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL
);

CREATE INDEX ix_operations_password_recovery_account_active
    ON workspace_iam.operations_password_recovery (account_id, status)
    WHERE account_id IS NOT NULL AND status IN ('PENDING', 'OTP_VERIFIED');
CREATE INDEX ix_operations_password_recovery_grant
    ON workspace_iam.operations_password_recovery (completion_grant_hash)
    WHERE completion_grant_hash IS NOT NULL;
