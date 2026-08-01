ALTER TABLE platform_iam.platform_admin
    ADD COLUMN is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT ck_platform_admin_is_builtin_boolean CHECK (is_builtin IN (TRUE, FALSE));

CREATE TABLE platform_iam.platform_login_rate_limit_bucket (
    dimension VARCHAR(16) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    window_started_at_epoch_millis BIGINT NOT NULL,
    failed_attempts INTEGER NOT NULL,
    locked_until_epoch_millis BIGINT,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT pk_platform_login_rate_limit_bucket PRIMARY KEY (dimension, fingerprint),
    CONSTRAINT ck_platform_login_rate_limit_dimension CHECK (dimension IN ('ACCOUNT', 'SOURCE')),
    CONSTRAINT ck_platform_login_rate_limit_failed_attempts CHECK (failed_attempts >= 0)
);

CREATE INDEX ix_platform_login_rate_limit_bucket_updated
    ON platform_iam.platform_login_rate_limit_bucket (updated_at_epoch_millis);
