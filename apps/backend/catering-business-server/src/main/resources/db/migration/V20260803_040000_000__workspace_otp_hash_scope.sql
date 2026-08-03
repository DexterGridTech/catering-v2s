-- An OTP value is validated only within its purpose and subject.  A global
-- token-hash uniqueness constraint turns ordinary six-digit collisions (and
-- the controlled DEV fixed OTP) into false write failures.
ALTER TABLE workspace_iam.otp_grant
    DROP CONSTRAINT IF EXISTS otp_grant_token_hash_key;

CREATE INDEX ix_workspace_otp_grant_subject_verify
    ON workspace_iam.otp_grant (subject_ref, purpose, token_hash, status);
