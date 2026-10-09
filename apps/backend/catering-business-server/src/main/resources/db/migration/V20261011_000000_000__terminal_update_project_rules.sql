CREATE TABLE terminal_update.project_rule (
    rule_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    project_ref UUID NOT NULL,
    target_mode VARCHAR(16) NOT NULL CHECK (target_mode IN ('ALL', 'STORE_REFS')),
    store_refs JSONB NOT NULL CHECK (jsonb_typeof(store_refs) = 'array'),
    full_artifact_ref UUID NOT NULL REFERENCES terminal_update.artifact(artifact_ref),
    hot_artifact_ref UUID REFERENCES terminal_update.artifact(artifact_ref),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
    n_seconds BIGINT NOT NULL CHECK (n_seconds BETWEEN 60 AND 86400 AND n_seconds % 60 = 0),
    hot_strategy VARCHAR(16) NOT NULL CHECK (hot_strategy IN ('IMMEDIATE', 'IDLE')),
    m_seconds BIGINT CHECK (m_seconds IS NULL OR (m_seconds BETWEEN 60 AND 86400 AND m_seconds % 60 = 0)),
    description VARCHAR(500),
    created_at_epoch_millis BIGINT NOT NULL CHECK (created_at_epoch_millis > 0),
    updated_at_epoch_millis BIGINT NOT NULL CHECK (updated_at_epoch_millis > 0),
    revision BIGINT NOT NULL CHECK (revision > 0),
    CHECK ((target_mode = 'ALL' AND jsonb_array_length(store_refs) = 0)
        OR (target_mode = 'STORE_REFS' AND jsonb_array_length(store_refs) > 0)),
    CHECK ((hot_artifact_ref IS NULL AND m_seconds IS NULL) OR (hot_artifact_ref IS NOT NULL AND m_seconds IS NOT NULL))
);

CREATE INDEX ix_terminal_update_project_rule_scope
    ON terminal_update.project_rule(workspace_uuid, group_workspace_key, project_ref, status, rule_ref);

CREATE TABLE terminal_update.rule_topic_snapshot (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    project_ref UUID NOT NULL,
    collection_hash CHAR(64) NOT NULL CHECK (collection_hash ~ '^[0-9a-f]{64}$'),
    topic_time_epoch_millis BIGINT NOT NULL CHECK (topic_time_epoch_millis >= 0),
    PRIMARY KEY (workspace_uuid, group_workspace_key, project_ref)
);

ALTER TABLE terminal_update.audit_event DROP CONSTRAINT IF EXISTS audit_event_entity_type_check;
ALTER TABLE terminal_update.audit_event ADD CONSTRAINT ck_terminal_update_audit_entity_type
    CHECK (entity_type IN ('TERMINAL_UPDATE_ARTIFACT', 'TERMINAL_UPDATE_RULE'));
ALTER TABLE terminal_update.audit_event DROP CONSTRAINT IF EXISTS audit_event_action_check;
ALTER TABLE terminal_update.audit_event ADD CONSTRAINT ck_terminal_update_audit_action
    CHECK (action IN ('STAGE', 'REGISTER', 'RELEASE_STAGE', 'CREATE', 'ENABLE', 'DISABLE'));

CREATE FUNCTION terminal_update.read_rule_topic_time(
    p_workspace_uuid UUID,
    p_group_workspace_key VARCHAR,
    p_store_ref UUID,
    p_project_ref UUID
)
RETURNS TABLE (topic_time_epoch_millis BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT coalesce(snapshot.topic_time_epoch_millis, 0)::BIGINT
      FROM organization.store store
      JOIN organization.organization_node project
        ON project.id = store.project_id
       AND project.node_type = 'PROJECT'
       AND project.workspace_uuid = store.workspace_uuid
       AND project.group_workspace_key = store.group_workspace_key
      LEFT JOIN terminal_update.rule_topic_snapshot snapshot
        ON snapshot.workspace_uuid = store.workspace_uuid
       AND snapshot.group_workspace_key = store.group_workspace_key
       AND snapshot.project_ref = project.id
     WHERE store.workspace_uuid = p_workspace_uuid
       AND store.group_workspace_key = p_group_workspace_key
       AND store.id = p_store_ref
       AND store.project_id = p_project_ref
       AND store.status = 'ENABLED'
       AND project.status = 'ENABLED'
$$;

REVOKE ALL ON FUNCTION terminal_update.read_rule_topic_time(UUID, VARCHAR, UUID, UUID) FROM PUBLIC;
