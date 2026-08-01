-- R5 membership readback requires assignment-level lifecycle timestamps.
ALTER TABLE workspace_iam.role_assignment
    ADD COLUMN created_at_epoch_millis BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN updated_at_epoch_millis BIGINT NOT NULL DEFAULT 0;

ALTER TABLE workspace_iam.role_assignment
    ALTER COLUMN created_at_epoch_millis DROP DEFAULT,
    ALTER COLUMN updated_at_epoch_millis DROP DEFAULT;
