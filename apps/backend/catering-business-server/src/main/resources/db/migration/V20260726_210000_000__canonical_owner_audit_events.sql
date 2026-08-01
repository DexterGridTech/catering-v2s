-- R5 canonical audit facts. Legacy audit tables remain untouched until writer/reader cutover
-- and the separately recorded typed precondition prove that retirement is safe.
CREATE TABLE platform_iam.audit_event (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_ref_text VARCHAR(128) NOT NULL,
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    action VARCHAR(120) NOT NULL,
    occurred_at_epoch_millis BIGINT NOT NULL,
    changes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT ck_platform_iam_audit_event_actor CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_platform_iam_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_platform_iam_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);
CREATE INDEX ix_platform_iam_audit_event_target_time ON platform_iam.audit_event (entity_type, entity_ref_text, occurred_at_epoch_millis DESC, id DESC);

CREATE TABLE platform_workspace.audit_event (
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
    CONSTRAINT fk_platform_workspace_audit_event_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace (workspace_uuid, group_workspace_key),
    CONSTRAINT ck_platform_workspace_audit_event_actor CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_platform_workspace_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_platform_workspace_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);
CREATE INDEX ix_platform_workspace_audit_event_target_time ON platform_workspace.audit_event (workspace_uuid, group_workspace_key, entity_type, entity_ref_text, occurred_at_epoch_millis DESC, id DESC);

CREATE TABLE organization.audit_event (
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
    CONSTRAINT fk_organization_audit_event_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace (workspace_uuid, group_workspace_key),
    CONSTRAINT ck_organization_audit_event_actor CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_organization_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_organization_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);
CREATE INDEX ix_organization_audit_event_target_time ON organization.audit_event (workspace_uuid, group_workspace_key, entity_type, entity_ref_text, occurred_at_epoch_millis DESC, id DESC);

CREATE TABLE extension.audit_event (
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
    CONSTRAINT fk_extension_audit_event_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace (workspace_uuid, group_workspace_key),
    CONSTRAINT ck_extension_audit_event_actor CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_extension_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_extension_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);
CREATE INDEX ix_extension_audit_event_target_time ON extension.audit_event (workspace_uuid, group_workspace_key, entity_type, entity_ref_text, occurred_at_epoch_millis DESC, id DESC);

CREATE TABLE workspace_iam.audit_event (
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
    CONSTRAINT fk_workspace_iam_audit_event_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace (workspace_uuid, group_workspace_key),
    CONSTRAINT ck_workspace_iam_audit_event_actor CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_workspace_iam_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_workspace_iam_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);
CREATE INDEX ix_workspace_iam_audit_event_target_time ON workspace_iam.audit_event (workspace_uuid, group_workspace_key, entity_type, entity_ref_text, occurred_at_epoch_millis DESC, id DESC);

CREATE TABLE contract.audit_event (
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
    CONSTRAINT fk_contract_audit_event_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace (workspace_uuid, group_workspace_key),
    CONSTRAINT ck_contract_audit_event_actor CHECK ((actor_type = 'SYSTEM' AND actor_id IS NULL) OR (actor_type <> 'SYSTEM' AND actor_id IS NOT NULL)),
    CONSTRAINT ck_contract_audit_event_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_contract_audit_event_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);
CREATE INDEX ix_contract_audit_event_target_time ON contract.audit_event (workspace_uuid, group_workspace_key, entity_type, entity_ref_text, occurred_at_epoch_millis DESC, id DESC);
