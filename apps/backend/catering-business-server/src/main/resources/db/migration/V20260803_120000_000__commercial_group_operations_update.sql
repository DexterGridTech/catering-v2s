ALTER TABLE organization.commercial_group
    ADD COLUMN updated_at_epoch_millis BIGINT;

UPDATE organization.commercial_group
   SET updated_at_epoch_millis = created_at_epoch_millis
 WHERE updated_at_epoch_millis IS NULL;

ALTER TABLE organization.commercial_group
    ALTER COLUMN updated_at_epoch_millis SET NOT NULL;

CREATE TABLE organization.commercial_group_command_receipt (
    workspace_uuid UUID NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    commercial_group_uuid UUID NOT NULL REFERENCES organization.commercial_group(commercial_group_uuid) ON DELETE RESTRICT,
    request_hash CHAR(64) NOT NULL,
    response_json JSONB NOT NULL,
    state VARCHAR(16) NOT NULL CHECK (state IN ('SUCCEEDED')),
    created_at_epoch_millis BIGINT NOT NULL,
    PRIMARY KEY (workspace_uuid, idempotency_key)
);
