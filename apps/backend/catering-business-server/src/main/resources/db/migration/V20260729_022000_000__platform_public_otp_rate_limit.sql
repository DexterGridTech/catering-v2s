CREATE TABLE platform_iam.platform_public_otp_rate_limit_bucket (
    purpose VARCHAR(40) NOT NULL,
    dimension VARCHAR(16) NOT NULL CHECK (dimension IN ('ACCOUNT', 'MOBILE', 'SOURCE')),
    fingerprint CHAR(64) NOT NULL,
    window_started_at_epoch_millis BIGINT NOT NULL,
    failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0),
    locked_until_epoch_millis BIGINT,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT pk_platform_public_otp_rate_limit_bucket PRIMARY KEY (purpose, dimension, fingerprint)
);
