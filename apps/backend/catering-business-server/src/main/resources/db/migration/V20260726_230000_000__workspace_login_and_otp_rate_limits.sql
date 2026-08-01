CREATE TABLE workspace_iam.workspace_login_rate_limit_bucket (
    group_workspace_key VARCHAR(64) NOT NULL,
    dimension VARCHAR(16) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    window_started_at_epoch_millis BIGINT NOT NULL,
    failed_attempts INTEGER NOT NULL,
    locked_until_epoch_millis BIGINT,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT pk_workspace_login_rate_limit_bucket PRIMARY KEY (group_workspace_key, dimension, fingerprint),
    CONSTRAINT ck_workspace_login_rate_limit_dimension CHECK (dimension IN ('ACCOUNT', 'SOURCE')),
    CONSTRAINT ck_workspace_login_rate_limit_failed_attempts CHECK (failed_attempts >= 0)
);

CREATE TABLE workspace_iam.otp_rate_limit_bucket (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    purpose VARCHAR(64) NOT NULL,
    subject_ref UUID NOT NULL,
    window_started_at_epoch_millis BIGINT NOT NULL,
    send_count INTEGER NOT NULL,
    verify_failed_attempts INTEGER NOT NULL,
    locked_until_epoch_millis BIGINT,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT pk_workspace_otp_rate_limit_bucket PRIMARY KEY (workspace_uuid, group_workspace_key, purpose, subject_ref),
    CONSTRAINT fk_workspace_otp_rate_limit_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key),
    CONSTRAINT ck_workspace_otp_rate_limit_send_count CHECK (send_count >= 0),
    CONSTRAINT ck_workspace_otp_rate_limit_verify_attempts CHECK (verify_failed_attempts >= 0)
);
