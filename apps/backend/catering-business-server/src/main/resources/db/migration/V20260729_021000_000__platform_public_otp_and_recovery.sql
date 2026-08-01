-- Public OTP and anonymous recovery state is platform-IAM owner data.
ALTER TABLE platform_iam.platform_admin
    ADD COLUMN mobile_normalized VARCHAR(32);

CREATE UNIQUE INDEX uq_platform_admin_mobile_normalized
    ON platform_iam.platform_admin (mobile_normalized)
    WHERE mobile_normalized IS NOT NULL;

ALTER TABLE platform_iam.platform_login_rate_limit_bucket
    ALTER COLUMN dimension TYPE VARCHAR(40);

CREATE TABLE platform_iam.platform_otp_grant (
    id UUID PRIMARY KEY,
    purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('PLATFORM_LOGIN', 'PLATFORM_PASSWORD_RECOVERY')),
    platform_admin_id UUID REFERENCES platform_iam.platform_admin(id) ON DELETE RESTRICT,
    recovery_flow_id UUID,
    mobile_fingerprint CHAR(64) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'USED', 'SUPERSEDED')),
    expires_at_epoch_millis BIGINT NOT NULL,
    used_at_epoch_millis BIGINT,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT ck_platform_otp_grant_subject CHECK (
        (purpose = 'PLATFORM_LOGIN' AND recovery_flow_id IS NULL)
        OR (purpose = 'PLATFORM_PASSWORD_RECOVERY' AND recovery_flow_id IS NOT NULL)
    )
);

CREATE INDEX ix_platform_otp_grant_login_active
    ON platform_iam.platform_otp_grant (purpose, mobile_fingerprint, status, expires_at_epoch_millis);

CREATE TABLE platform_iam.platform_password_recovery_flow (
    id UUID PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    login_name_normalized VARCHAR(64) NOT NULL,
    mobile_normalized VARCHAR(32) NOT NULL,
    platform_admin_id UUID REFERENCES platform_iam.platform_admin(id) ON DELETE RESTRICT,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'VERIFIED', 'COMPLETED')),
    expires_at_epoch_millis BIGINT NOT NULL,
    verified_at_epoch_millis BIGINT,
    completed_at_epoch_millis BIGINT,
    created_at_epoch_millis BIGINT NOT NULL,
    version BIGINT NOT NULL CHECK (version > 0)
);

ALTER TABLE platform_iam.platform_otp_grant
    ADD CONSTRAINT fk_platform_otp_grant_recovery_flow
    FOREIGN KEY (recovery_flow_id) REFERENCES platform_iam.platform_password_recovery_flow(id) ON DELETE RESTRICT;

CREATE INDEX ix_platform_password_recovery_flow_active
    ON platform_iam.platform_password_recovery_flow (token_hash, status, expires_at_epoch_millis);
