CREATE SCHEMA terminal_control;

CREATE TABLE terminal_control.online_operation (
    operation_id UUID PRIMARY KEY,
    request_id UUID NOT NULL,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    store_ref UUID NOT NULL,
    terminal_ref UUID NOT NULL,
    binding_generation BIGINT NOT NULL,
    target_node_id VARCHAR(128),
    target_session_id VARCHAR(128),
    target_session_sequence BIGINT,
    status VARCHAR(16) NOT NULL,
    command_name VARCHAR(128) NOT NULL,
    parameters JSONB NOT NULL,
    result JSONB,
    error_code VARCHAR(128),
    last_report_id UUID,
    execution_started_at TIMESTAMPTZ,
    first_unknown_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_terminal_control_generation CHECK (binding_generation > 0),
    CONSTRAINT ck_terminal_control_status CHECK (status IN (
        'NOT_SENT', 'QUEUED', 'CLAIMED', 'RECEIVED', 'STARTED', 'UNKNOWN', 'COMPLETED', 'FAILED'
    )),
    CONSTRAINT ck_terminal_control_target CHECK (
        (status IN ('NOT_SENT') AND target_node_id IS NULL AND target_session_id IS NULL AND target_session_sequence IS NULL)
        OR (status <> 'NOT_SENT' AND target_node_id IS NOT NULL AND target_session_id IS NOT NULL
            AND target_session_sequence IS NOT NULL AND target_session_sequence > 0)
    ),
    CONSTRAINT ck_terminal_control_command_json CHECK (jsonb_typeof(parameters) = 'object'),
    CONSTRAINT ck_terminal_control_result_json CHECK (result IS NULL OR jsonb_typeof(result) = 'object')
);

CREATE INDEX ix_terminal_control_operation_target_status
    ON terminal_control.online_operation (target_node_id, target_session_id, status, created_at);

CREATE OR REPLACE FUNCTION terminal_control.claim_online_operation(
    p_operation_id UUID,
    p_node_id VARCHAR
)
RETURNS TABLE (
    operation_id UUID,
    request_id UUID,
    terminal_ref UUID,
    binding_generation BIGINT,
    target_session_id VARCHAR,
    command_name VARCHAR,
    parameters JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, terminal_control
AS $$
    UPDATE terminal_control.online_operation operation
       SET status = 'CLAIMED', updated_at = clock_timestamp()
      FROM terminal_connection.latest_state session,
           terminal_binding.latest_binding binding
     WHERE operation.operation_id = p_operation_id
       AND operation.status = 'QUEUED'
       AND operation.target_node_id = p_node_id
       AND session.workspace_uuid = operation.workspace_uuid
       AND session.group_workspace_key = operation.group_workspace_key
       AND session.terminal_ref = operation.terminal_ref
       AND session.node_id = operation.target_node_id
       AND session.session_id = operation.target_session_id
       AND session.session_sequence = operation.target_session_sequence
       AND session.disconnected_at_epoch_millis IS NULL
       AND binding.workspace_uuid = operation.workspace_uuid
       AND binding.group_workspace_key = operation.group_workspace_key
       AND binding.terminal_ref = operation.terminal_ref
       AND binding.generation = operation.binding_generation
       AND binding.binding_status = 'ACTIVE'
    RETURNING operation.operation_id, operation.request_id, operation.terminal_ref,
              operation.binding_generation, operation.target_session_id,
              operation.command_name, operation.parameters
$$;

REVOKE ALL ON FUNCTION terminal_control.claim_online_operation(UUID, VARCHAR) FROM PUBLIC;

CREATE OR REPLACE FUNCTION terminal_control.accept_terminal_report(
    p_report_id UUID,
    p_operation_id UUID,
    p_request_id UUID,
    p_binding_generation BIGINT,
    p_node_id VARCHAR,
    p_session_id VARCHAR,
    p_phase VARCHAR,
    p_occurred_at TIMESTAMPTZ,
    p_result JSONB,
    p_error_code VARCHAR
)
RETURNS TABLE (accepted BOOLEAN, accepted_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, terminal_control
AS $$
DECLARE
    current_status VARCHAR(16);
    current_report_id UUID;
BEGIN
    IF p_phase NOT IN ('RECEIVED', 'STARTED', 'UNKNOWN', 'COMPLETED', 'FAILED') THEN
        RETURN QUERY SELECT FALSE, clock_timestamp();
        RETURN;
    END IF;

    SELECT operation.status, operation.last_report_id
      INTO current_status, current_report_id
      FROM terminal_control.online_operation operation
      JOIN terminal_binding.latest_binding binding
        ON binding.workspace_uuid = operation.workspace_uuid
       AND binding.group_workspace_key = operation.group_workspace_key
       AND binding.terminal_ref = operation.terminal_ref
       AND binding.generation = operation.binding_generation
       AND binding.binding_status = 'ACTIVE'
      JOIN terminal_connection.latest_state session
        ON session.workspace_uuid = operation.workspace_uuid
       AND session.group_workspace_key = operation.group_workspace_key
       AND session.terminal_ref = operation.terminal_ref
       AND session.node_id = p_node_id
       AND session.session_id = p_session_id
       AND session.disconnected_at_epoch_millis IS NULL
     WHERE operation.operation_id = p_operation_id
       AND operation.request_id = p_request_id
       AND operation.binding_generation = p_binding_generation
       AND operation.status IN ('CLAIMED', 'RECEIVED', 'STARTED', 'UNKNOWN', 'COMPLETED', 'FAILED')
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, clock_timestamp();
        RETURN;
    END IF;

    IF current_report_id = p_report_id THEN
        RETURN QUERY SELECT TRUE, clock_timestamp();
        RETURN;
    END IF;

    UPDATE terminal_control.online_operation operation
       SET status = CASE
               WHEN operation.status IN ('COMPLETED', 'FAILED') THEN operation.status
               WHEN p_phase IN ('COMPLETED', 'FAILED') THEN p_phase
               WHEN operation.status = 'UNKNOWN' THEN 'UNKNOWN'
               WHEN p_phase = 'UNKNOWN' THEN 'UNKNOWN'
               WHEN p_phase = 'STARTED' THEN 'STARTED'
               WHEN p_phase = 'RECEIVED' AND operation.status IN ('CLAIMED', 'QUEUED') THEN 'RECEIVED'
               ELSE operation.status
           END,
           last_report_id = p_report_id,
           execution_started_at = CASE
               WHEN p_phase = 'STARTED' THEN COALESCE(operation.execution_started_at, p_occurred_at)
               ELSE operation.execution_started_at
           END,
           first_unknown_at = CASE
               WHEN p_phase = 'UNKNOWN' THEN COALESCE(operation.first_unknown_at, p_occurred_at)
               ELSE operation.first_unknown_at
           END,
           result = CASE
               WHEN operation.status NOT IN ('COMPLETED', 'FAILED') AND p_phase IN ('COMPLETED', 'FAILED')
                   THEN p_result
               ELSE operation.result
           END,
           error_code = CASE
               WHEN operation.status NOT IN ('COMPLETED', 'FAILED') AND p_phase IN ('UNKNOWN', 'COMPLETED', 'FAILED')
                   THEN p_error_code
               ELSE operation.error_code
           END,
           updated_at = clock_timestamp()
     WHERE operation.operation_id = p_operation_id;

    RETURN QUERY SELECT TRUE, clock_timestamp();
END;
$$;

REVOKE ALL ON FUNCTION terminal_control.accept_terminal_report(
    UUID, UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, JSONB, VARCHAR
) FROM PUBLIC;
