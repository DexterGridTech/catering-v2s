package com.catering.v2s.storeterminal.persistence;

/** SQL owned by StoreTerminalOwnerPersistence. */
public final class StoreTerminalOwnerPersistenceSql {
    public static final String SELECT_DETAIL =
            """
        SELECT terminal_ref, workspace_uuid, group_workspace_key, store_ref, name, name_normalized,
               device_type, status, version, activation_code, configuration::text AS configuration_json,
               created_at_epoch_millis, updated_at_epoch_millis
        FROM store_terminal.terminal
        WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND terminal_ref=?
        """;

    public static final String SELECT_DETAIL_FOR_UPDATE = SELECT_DETAIL + " FOR UPDATE";

    public static final String INSERT_TERMINAL =
            """
        INSERT INTO store_terminal.terminal(
          terminal_ref, workspace_uuid, group_workspace_key, store_ref, name, name_normalized,
          device_type, status, version, activation_code, configuration, created_at_epoch_millis, updated_at_epoch_millis
        ) VALUES (?,?,?,?,?,?,?,'ENABLED',1,?,?::jsonb,?,?)
        ON CONFLICT (workspace_uuid, group_workspace_key, activation_code) DO NOTHING
        RETURNING terminal_ref
        """;

    public static final String REPLACE_TERMINAL =
            """
        UPDATE store_terminal.terminal
        SET name=?, name_normalized=?, device_type=?, configuration=?::jsonb, version=version+1,
            updated_at_epoch_millis=?
        WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND terminal_ref=?
          AND status <> 'VOIDED' AND version=?
        """;

    public static final String TRANSITION_STATUS =
            """
        UPDATE store_terminal.terminal
        SET status=?, version=version+1, updated_at_epoch_millis=?
        WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND terminal_ref=?
          AND status <> 'VOIDED' AND version=?
        """;

    public static final String FIND_RECEIPT =
            """
        SELECT request_hash, response_json::text AS response_json
        FROM store_terminal.command_receipt
        WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?
        """;

    public static final String INSERT_RECEIPT =
            """
        INSERT INTO store_terminal.command_receipt(
          receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, request_hash, response_json,
          created_at_epoch_millis
        ) VALUES (?,?,?,?,?,?::jsonb,?)
        """;

    private StoreTerminalOwnerPersistenceSql() {}
}
