ALTER TABLE store_terminal.terminal
    ADD CONSTRAINT uq_store_terminal_workspace_group_terminal_ref
        UNIQUE (workspace_uuid, group_workspace_key, terminal_ref);

CREATE SCHEMA terminal_binding;

CREATE TABLE terminal_binding.latest_binding (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    terminal_ref UUID NOT NULL,
    generation BIGINT NOT NULL,
    credential_digest BYTEA NOT NULL,
    binding_status VARCHAR(16) NOT NULL,
    bound_device_id VARCHAR(128),
    activated_at_epoch_millis BIGINT NOT NULL,
    ended_at_epoch_millis BIGINT,
    end_reason VARCHAR(48),
    most_recent_ended_generation BIGINT,
    most_recent_ended_credential_digest BYTEA,
    most_recent_ended_at_epoch_millis BIGINT,
    most_recent_ended_reason VARCHAR(48),
    CONSTRAINT pk_terminal_binding_latest_binding
        PRIMARY KEY (workspace_uuid, group_workspace_key, terminal_ref),
    CONSTRAINT fk_terminal_binding_terminal
        FOREIGN KEY (workspace_uuid, group_workspace_key, terminal_ref)
        REFERENCES store_terminal.terminal (workspace_uuid, group_workspace_key, terminal_ref),
    CONSTRAINT uk_terminal_binding_credential_digest UNIQUE (credential_digest),
    CONSTRAINT ck_terminal_binding_generation_positive CHECK (generation > 0),
    CONSTRAINT ck_terminal_binding_activated_at_non_negative CHECK (activated_at_epoch_millis >= 0),
    CONSTRAINT ck_terminal_binding_credential_digest_length CHECK (octet_length(credential_digest) = 32),
    CONSTRAINT ck_terminal_binding_status CHECK (binding_status IN ('ACTIVE', 'ENDED')),
    CONSTRAINT ck_terminal_binding_device_id_state CHECK (
        (binding_status = 'ACTIVE' AND bound_device_id IS NOT NULL AND length(bound_device_id) BETWEEN 1 AND 128)
        OR (binding_status = 'ENDED' AND bound_device_id IS NULL)
    ),
    CONSTRAINT ck_terminal_binding_current_state CHECK (
        (binding_status = 'ACTIVE'
            AND ended_at_epoch_millis IS NULL
            AND end_reason IS NULL)
        OR
        (binding_status = 'ENDED'
            AND ended_at_epoch_millis IS NOT NULL
            AND end_reason IS NOT NULL
            AND end_reason IN ('DEVICE_CANCELLED', 'OPERATIONS_CANCELLED', 'TERMINAL_VOIDED', 'REACTIVATED'))
    ),
    CONSTRAINT ck_terminal_binding_recent_ended_state CHECK (
        (most_recent_ended_generation IS NULL
            AND most_recent_ended_credential_digest IS NULL
            AND most_recent_ended_at_epoch_millis IS NULL
            AND most_recent_ended_reason IS NULL)
        OR
        (most_recent_ended_generation > 0
            AND most_recent_ended_generation <= generation
            AND most_recent_ended_credential_digest IS NOT NULL
            AND octet_length(most_recent_ended_credential_digest) = 32
            AND most_recent_ended_at_epoch_millis IS NOT NULL
            AND most_recent_ended_reason IS NOT NULL
            AND most_recent_ended_reason IN ('DEVICE_CANCELLED', 'OPERATIONS_CANCELLED', 'TERMINAL_VOIDED', 'REACTIVATED'))
    ),
    CONSTRAINT ck_terminal_binding_recent_ended_generation CHECK (
        (binding_status = 'ACTIVE'
            AND ((generation = 1 AND most_recent_ended_generation IS NULL)
                OR (generation > 1
                    AND most_recent_ended_generation IS NOT NULL
                    AND most_recent_ended_generation = generation - 1)))
        OR (binding_status = 'ENDED'
            AND most_recent_ended_generation IS NOT NULL
            AND most_recent_ended_generation = generation)
    ),
    CONSTRAINT ck_terminal_binding_ended_is_latest CHECK (
        binding_status <> 'ENDED'
        OR (most_recent_ended_generation = generation
            AND most_recent_ended_credential_digest = credential_digest
            AND most_recent_ended_at_epoch_millis = ended_at_epoch_millis
            AND most_recent_ended_reason = end_reason)
    )
);

CREATE TABLE terminal_binding.audit_event (
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
    reason VARCHAR(48) NOT NULL,
    changes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT ck_terminal_binding_audit_actor CHECK (
        (actor_type IN ('SYSTEM', 'TERMINAL_DEVICE') AND actor_id IS NULL)
        OR (actor_type NOT IN ('SYSTEM', 'TERMINAL_DEVICE') AND actor_id IS NOT NULL)
    ),
    CONSTRAINT ck_terminal_binding_audit_device_actor CHECK (
        actor_type <> 'TERMINAL_DEVICE' OR actor_display_snapshot = '终端设备'
    ),
    CONSTRAINT ck_terminal_binding_audit_entity CHECK (entity_type = 'TERMINAL_BINDING'),
    CONSTRAINT ck_terminal_binding_audit_reason CHECK (
        reason IN ('ACTIVATED', 'REACTIVATED', 'DEVICE_CANCELLED', 'OPERATIONS_CANCELLED', 'TERMINAL_VOIDED')
    ),
    CONSTRAINT ck_terminal_binding_audit_changes_array CHECK (jsonb_typeof(changes_json) = 'array'),
    CONSTRAINT ck_terminal_binding_audit_occurred_at_non_negative CHECK (occurred_at_epoch_millis >= 0)
);

CREATE INDEX ix_terminal_binding_audit_event_target_time
    ON terminal_binding.audit_event (
        workspace_uuid,
        group_workspace_key,
        entity_type,
        entity_ref_text,
        occurred_at_epoch_millis DESC,
        id DESC
    );

CREATE TABLE terminal_binding.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_json JSONB NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_terminal_binding_command_receipt_key
        UNIQUE (workspace_uuid, group_workspace_key, idempotency_key),
    CONSTRAINT ck_terminal_binding_receipt_request_hash
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_terminal_binding_receipt_created_at_non_negative
        CHECK (created_at_epoch_millis >= 0)
);

CREATE SCHEMA terminal_connection;

CREATE SEQUENCE terminal_connection.session_sequence
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;

CREATE TABLE terminal_connection.latest_state (
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    terminal_ref UUID NOT NULL,
    node_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    session_sequence BIGINT NOT NULL,
    connected_at_epoch_millis BIGINT NOT NULL,
    disconnected_at_epoch_millis BIGINT,
    last_activity_at_epoch_millis BIGINT NOT NULL,
    last_rtt_ms DOUBLE PRECISION NOT NULL,
    close_reason VARCHAR(48),
    CONSTRAINT pk_terminal_connection_latest_state
        PRIMARY KEY (workspace_uuid, group_workspace_key, terminal_ref),
    CONSTRAINT fk_terminal_connection_terminal
        FOREIGN KEY (workspace_uuid, group_workspace_key, terminal_ref)
        REFERENCES store_terminal.terminal (workspace_uuid, group_workspace_key, terminal_ref),
    CONSTRAINT ck_terminal_connection_sequence_positive CHECK (session_sequence > 0),
    CONSTRAINT ck_terminal_connection_connected_at_non_negative CHECK (connected_at_epoch_millis >= 0),
    CONSTRAINT ck_terminal_connection_disconnected_at CHECK (
        disconnected_at_epoch_millis IS NULL OR disconnected_at_epoch_millis >= connected_at_epoch_millis
    ),
    CONSTRAINT ck_terminal_connection_last_activity_at CHECK (
        last_activity_at_epoch_millis >= connected_at_epoch_millis
        AND (disconnected_at_epoch_millis IS NULL OR last_activity_at_epoch_millis <= disconnected_at_epoch_millis)
    ),
    CONSTRAINT ck_terminal_connection_last_rtt CHECK (
        last_rtt_ms >= 0 AND last_rtt_ms <> 'Infinity'::double precision AND last_rtt_ms <> 'NaN'::double precision
    ),
    CONSTRAINT ck_terminal_connection_session_state CHECK (
        (disconnected_at_epoch_millis IS NULL AND close_reason IS NULL)
        OR (disconnected_at_epoch_millis IS NOT NULL
            AND close_reason IS NOT NULL
            AND close_reason IN (
            'ACTIVATION_CANCELLED', 'CREDENTIAL_INVALID', 'GROUP_WORKSPACE_DISABLED', 'TERMINAL_DISABLED',
            'SESSION_REPLACED', 'REDIRECT_TO_NEXT_NODE', 'NODE_BUSY', 'AUTHENTICATION_TIMEOUT',
            'HEARTBEAT_TIMEOUT', 'SERVER_ERROR', 'NETWORK_ERROR', 'PROTOCOL_ERROR', 'MESSAGE_TOO_BIG', 'UNKNOWN'
        ))
    )
);
