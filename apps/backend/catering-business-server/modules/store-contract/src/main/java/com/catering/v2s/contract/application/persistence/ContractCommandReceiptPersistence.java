package com.catering.v2s.contract.application.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for store-contract command receipt replay facts. */
@Repository
public class ContractCommandReceiptPersistence {
    private final JdbcTemplate jdbc;

    public ContractCommandReceiptPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Receipt(String requestHash, String responseJson) {}

    public Receipt find(UUID workspaceUuid, String key) {
        return jdbc.query(
                ContractCommandReceiptServiceSql.CONTRACT_COMMAND_RECEIPT_SERVICE_SELECT_RECEIPT_REQUEST_HASH_RESPONSE_JSON_TEXT
                        + ContractCommandReceiptServiceSql.CONTRACT_COMMAND_RECEIPT_SERVICE_CONTINUATION_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT_ADVISORY
                        + ContractCommandReceiptServiceSql.CONTRACT_COMMAND_RECEIPT_SERVICE_CONTINUATION_CONTRACT_COMMAND_RECEIPT_RECEIPT_WORKSPACE_UUID
                        + ContractCommandReceiptServiceSql.CONTRACT_COMMAND_RECEIPT_SERVICE_CONDITION_RECEIPT_IDEMPOTENCY_KEY,
                statement -> {
                    statement.setString(1, workspaceUuid.toString());
                    statement.setString(2, key);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, key);
                },
                result -> {
                    if (!result.next() || result.getString(1) == null) return null;
                    return new Receipt(result.getString(1), result.getString(2));
                });
    }

    public int insert(
            UUID workspaceUuid,
            String key,
            UUID resultId,
            String requestHash,
            String responseJson,
            long createdAtEpochMillis) {
        return jdbc.update(
                ContractCommandReceiptServiceSql.CONTRACT_COMMAND_RECEIPT_SERVICE_INSERT_INTO_CONTRACT_COMMAND_RECEIPT
                        + ContractCommandReceiptServiceSql.CONTRACT_COMMAND_RECEIPT_SERVICE_CONTINUATION_REQUEST_HASH_RESPONSE_JSON_CREATED_AT_EPOCH_MILLIS,
                workspaceUuid,
                key,
                resultId,
                requestHash,
                responseJson,
                createdAtEpochMillis);
    }
}
