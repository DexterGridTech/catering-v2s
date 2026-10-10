CREATE TABLE terminal_update.terminal_report (
    report_row_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    terminal_ref UUID NOT NULL,
    binding_generation BIGINT NOT NULL CHECK (binding_generation > 0),
    device_id VARCHAR(128) NOT NULL CHECK (length(device_id) BETWEEN 1 AND 128),
    report_key VARCHAR(64) NOT NULL,
    task_id UUID,
    report_id UUID NOT NULL,
    report_sequence BIGINT NOT NULL CHECK (report_sequence > 0),
    body_hash CHAR(64) NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
    actual JSONB NOT NULL CHECK (jsonb_typeof(actual) = 'object'),
    recent JSONB NOT NULL CHECK (jsonb_typeof(recent) = 'object'),
    changed_at_epoch_millis BIGINT NOT NULL CHECK (changed_at_epoch_millis >= 0),
    received_at_epoch_millis BIGINT NOT NULL CHECK (received_at_epoch_millis > 0),
    CONSTRAINT fk_terminal_update_report_terminal FOREIGN KEY (workspace_uuid, group_workspace_key, terminal_ref)
        REFERENCES store_terminal.terminal(workspace_uuid, group_workspace_key, terminal_ref),
    CONSTRAINT ck_terminal_update_report_key CHECK (
        (task_id IS NULL AND report_key = 'observation')
        OR (task_id IS NOT NULL AND report_key = task_id::text)
    ),
    CONSTRAINT uq_terminal_update_report_binding_key UNIQUE
        (workspace_uuid, group_workspace_key, terminal_ref, binding_generation, report_key),
    CONSTRAINT uq_terminal_update_report_binding_sequence UNIQUE
        (workspace_uuid, group_workspace_key, terminal_ref, binding_generation, report_sequence),
    CONSTRAINT uq_terminal_update_report_binding_id UNIQUE
        (workspace_uuid, group_workspace_key, terminal_ref, binding_generation, report_id)
);

CREATE INDEX ix_terminal_update_report_task_history
    ON terminal_update.terminal_report
       (workspace_uuid, group_workspace_key, terminal_ref, received_at_epoch_millis DESC, task_id DESC)
    WHERE task_id IS NOT NULL;

CREATE INDEX ix_terminal_update_report_current
    ON terminal_update.terminal_report
       (workspace_uuid, group_workspace_key, terminal_ref, binding_generation DESC, report_sequence DESC);
