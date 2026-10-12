CREATE TABLE terminal_control.remote_session (
    session_id UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    project_ref UUID NOT NULL,
    store_ref UUID NOT NULL,
    terminal_ref UUID NOT NULL,
    binding_generation BIGINT NOT NULL CHECK (binding_generation > 0),
    device_identity VARCHAR(128) NOT NULL,
    target_node_id VARCHAR(128) NOT NULL,
    target_session_id VARCHAR(128) NOT NULL,
    target_session_sequence BIGINT NOT NULL CHECK (target_session_sequence > 0),
    actor_account_ref UUID NOT NULL,
    actor_session_ref UUID NOT NULL,
    request_id UUID NOT NULL,
    start_operation_id UUID NOT NULL,
    topology_kind VARCHAR(32),
    peer_module_name VARCHAR(128),
    peer_node_id VARCHAR(128),
    state VARCHAR(16) NOT NULL CHECK (state IN ('STARTING', 'ACTIVE', 'ENDED')),
    reason VARCHAR(64),
    description_json JSONB,
    ready_screens_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ready_screens_json) = 'array'),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deadline_at TIMESTAMPTZ NOT NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    CONSTRAINT uq_terminal_remote_session_request UNIQUE (workspace_uuid, actor_account_ref, request_id),
    CONSTRAINT ck_terminal_remote_session_peer CHECK (
      (topology_kind = 'LAPTOP_PAIRED' AND peer_module_name IS NOT NULL AND peer_node_id IS NOT NULL)
      OR (topology_kind IS NULL AND peer_module_name IS NULL AND peer_node_id IS NULL)
      OR (topology_kind IN ('MOBILE_SINGLE','LAPTOP_SINGLE','LAPTOP_DUAL')
          AND peer_module_name IS NULL AND peer_node_id IS NULL)
    ),
    CONSTRAINT ck_terminal_remote_session_description CHECK
      (description_json IS NULL OR jsonb_typeof(description_json) = 'object')
);

CREATE UNIQUE INDEX uq_terminal_remote_session_active_terminal
    ON terminal_control.remote_session(workspace_uuid, group_workspace_key, terminal_ref)
    WHERE state IN ('STARTING', 'ACTIVE');

CREATE INDEX ix_terminal_remote_session_project_started
    ON terminal_control.remote_session(workspace_uuid, group_workspace_key, project_ref, started_at DESC, session_id DESC);

CREATE TABLE terminal_control.audit_event (
    id UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL CHECK (entity_type = 'TERMINAL_REMOTE_CONTROL_SESSION'),
    entity_ref_text VARCHAR(128) NOT NULL,
    actor_type VARCHAR(48) NOT NULL,
    actor_id UUID,
    actor_display_snapshot VARCHAR(160) NOT NULL,
    action VARCHAR(120) NOT NULL CHECK (action IN ('START', 'END')),
    occurred_at_epoch_millis BIGINT NOT NULL CHECK (occurred_at_epoch_millis >= 0),
    changes_json JSONB NOT NULL,
    CHECK ((actor_type IN ('SYSTEM', 'TERMINAL_DEVICE') AND actor_id IS NULL)
        OR (actor_type NOT IN ('SYSTEM', 'TERMINAL_DEVICE') AND actor_id IS NOT NULL))
);

CREATE INDEX ix_terminal_control_audit_entity_time
    ON terminal_control.audit_event(workspace_uuid, group_workspace_key, entity_type, entity_ref_text,
       occurred_at_epoch_millis DESC, id DESC);
