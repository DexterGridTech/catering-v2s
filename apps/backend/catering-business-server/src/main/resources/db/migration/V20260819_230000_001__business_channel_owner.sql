-- Business-channel owner facts. Cross-owner binding references are opaque and intentionally have no FK.
-- C-02 keeps target_node_type and target_node_ref as separate facts; C-08/C-09 remain unresolved and are not
-- represented by a runtime rule table or a new quantitative compliance control.
CREATE SCHEMA IF NOT EXISTS business_channel;

CREATE TABLE business_channel.business_channel_template (
    template_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    project_ref UUID NOT NULL,
    template_name VARCHAR(240) NOT NULL,
    access_kind VARCHAR(16) NOT NULL CHECK (access_kind IN ('INTERNAL', 'EXTERNAL')),
    operator_kind VARCHAR(16) NOT NULL CHECK (operator_kind IN ('PROJECT', 'STORE')),
    order_kind VARCHAR(32) NOT NULL CHECK (order_kind IN ('DINE_IN', 'TAKEAWAY', 'GROUP_BUY')),
    dine_in_form VARCHAR(16),
    provider_code VARCHAR(120),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT ck_business_channel_template_provider CHECK (
        (access_kind = 'INTERNAL' AND provider_code IS NULL)
        OR (access_kind = 'EXTERNAL' AND provider_code IS NOT NULL)
    ),
    CONSTRAINT ck_business_channel_template_dine_in_form CHECK (
        (order_kind = 'DINE_IN' AND access_kind = 'INTERNAL' AND dine_in_form IN ('POS', 'QR', 'KIOSK'))
        OR (order_kind <> 'DINE_IN' AND dine_in_form IS NULL)
    ),
    CONSTRAINT fk_business_channel_template_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE INDEX idx_business_channel_template_page
    ON business_channel.business_channel_template (workspace_uuid, group_workspace_key, project_ref, template_ref);

CREATE TABLE business_channel.business_channel (
    channel_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    target_node_type VARCHAR(16) NOT NULL CHECK (target_node_type IN ('PROJECT', 'STORE')),
    target_node_ref TEXT NOT NULL,
    template_ref UUID NOT NULL,
    -- C-03 is pending: nullable/opaque, read back exactly, never generated, and deliberately not unique.
    channel_code TEXT,
    channel_name VARCHAR(240) NOT NULL,
    binding_ref UUID,
    status VARCHAR(16) NOT NULL CHECK (status IN ('DRAFT', 'EFFECTIVE', 'DISABLED')),
    stop_reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_business_channel_channel_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE INDEX idx_business_channel_channel_page
    ON business_channel.business_channel (
        workspace_uuid,
        group_workspace_key,
        target_node_type,
        target_node_ref,
        channel_ref
    );

CREATE INDEX idx_business_channel_template_lookup
    ON business_channel.business_channel (workspace_uuid, group_workspace_key, template_ref, channel_ref);

CREATE TABLE business_channel.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    operation_id VARCHAR(160) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json) = 'object'),
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_business_channel_command_receipt_key
        UNIQUE (workspace_uuid, group_workspace_key, idempotency_key),
    CONSTRAINT fk_business_channel_receipt_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE TABLE business_channel.audit_event (
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
    CONSTRAINT ck_business_channel_audit_event_actor CHECK (
        (actor_type = 'SYSTEM' AND actor_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)
    ),
    CONSTRAINT fk_business_channel_audit_workspace FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);

CREATE INDEX idx_business_channel_audit_scope_time
    ON business_channel.audit_event (workspace_uuid, group_workspace_key, occurred_at_epoch_millis, event_ref);
