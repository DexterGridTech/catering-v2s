CREATE SCHEMA store_terminal;

CREATE TABLE store_terminal.terminal (
    terminal_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    store_ref UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    name_normalized VARCHAR(120) NOT NULL,
    device_type VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    version BIGINT NOT NULL,
    activation_code VARCHAR(8) NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT ck_store_terminal_configuration_object
        CHECK (jsonb_typeof(configuration) = 'object'),
    CONSTRAINT ck_store_terminal_status
        CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))
);

CREATE UNIQUE INDEX uq_store_terminal_group_activation_code
    ON store_terminal.terminal (workspace_uuid, group_workspace_key, activation_code);

CREATE UNIQUE INDEX ux_store_terminal_store_active_name
    ON store_terminal.terminal (workspace_uuid, group_workspace_key, store_ref, name_normalized)
    WHERE status <> 'VOIDED';

CREATE TABLE store_terminal.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_json JSONB,
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_store_terminal_command_receipt_key
        UNIQUE (workspace_uuid, group_workspace_key, idempotency_key)
);

CREATE TABLE store_terminal.audit_event (
    id UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_ref_text VARCHAR(128) NOT NULL,
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    action VARCHAR(120) NOT NULL,
    occurred_at_epoch_millis BIGINT NOT NULL,
    changes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT fk_store_terminal_audit_event_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace (workspace_uuid, group_workspace_key),
    CONSTRAINT ck_store_terminal_audit_event_actor
        CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_store_terminal_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_store_terminal_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);

CREATE INDEX ix_store_terminal_audit_event_target_time
    ON store_terminal.audit_event (
        workspace_uuid,
        group_workspace_key,
        entity_type,
        entity_ref_text,
        occurred_at_epoch_millis DESC,
        id DESC
    );
