-- Collaboration runtime facts only. The external-platform catalogue remains checked-in contract source.
CREATE SCHEMA IF NOT EXISTS collaboration;

CREATE TABLE collaboration.external_system_enablement (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    external_system_code VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    PRIMARY KEY (workspace_uuid, group_workspace_key, external_system_code),
    CONSTRAINT fk_collaboration_external_system_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE TABLE collaboration.provider_profile_enablement (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    provider_code VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    PRIMARY KEY (workspace_uuid, group_workspace_key, provider_code),
    CONSTRAINT fk_collaboration_provider_profile_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE TABLE collaboration.owner_binding (
    binding_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    external_system_code VARCHAR(120) NOT NULL,
    provider_code VARCHAR(120) NOT NULL,
    capability_class VARCHAR(80),
    node_type VARCHAR(80) NOT NULL,
    node_ref TEXT NOT NULL,
    binding_display_name TEXT,
    external_owner_id TEXT,
    authorization_ref TEXT,
    status VARCHAR(32) NOT NULL,
    unbind_requested_at_epoch_millis BIGINT,
    external_revoked_at_epoch_millis BIGINT,
    deleted_at_epoch_millis BIGINT,
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_collaboration_binding_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

-- No external_owner_id uniqueness: one external owner can legitimately back two provider capabilities/channels.
CREATE INDEX idx_collaboration_binding_provider_page
    ON collaboration.owner_binding (workspace_uuid, group_workspace_key, provider_code, binding_ref);

CREATE INDEX idx_collaboration_binding_node_lookup
    ON collaboration.owner_binding (workspace_uuid, group_workspace_key, provider_code, node_type, node_ref);

-- C-04 remains open: protocol in-progress/failure states are not frozen as a database enum in this migration.
CREATE TABLE collaboration.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    operation_id VARCHAR(160) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json) = 'object'),
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_collaboration_command_receipt_key
        UNIQUE (workspace_uuid, group_workspace_key, idempotency_key),
    CONSTRAINT fk_collaboration_receipt_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE TABLE collaboration.audit_event (
    event_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_ref VARCHAR(240) NOT NULL,
    action VARCHAR(120) NOT NULL,
    changes_json JSONB NOT NULL CHECK (jsonb_typeof(changes_json) = 'array'),
    occurred_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_collaboration_audit_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE INDEX idx_collaboration_audit_scope_time
    ON collaboration.audit_event (workspace_uuid, group_workspace_key, occurred_at_epoch_millis, event_ref);
