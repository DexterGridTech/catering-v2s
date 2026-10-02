CREATE DATABASE IF NOT EXISTS terminal_connection_history;

CREATE TABLE IF NOT EXISTS terminal_connection_history.connection_history (
    event_id VARCHAR(36) NOT NULL,
    event_time_epoch_millis BIGINT NOT NULL,
    event_type VARCHAR(24) NOT NULL,
    workspace_uuid VARCHAR(36) NOT NULL,
    terminal_ref VARCHAR(36) NOT NULL,
    node_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    session_sequence BIGINT NOT NULL,
    rtt_ms DOUBLE NULL,
    close_reason VARCHAR(48) NULL
)
DUPLICATE KEY(event_id)
DISTRIBUTED BY HASH(event_id) BUCKETS 1
PROPERTIES (
    "replication_num" = "1"
);
