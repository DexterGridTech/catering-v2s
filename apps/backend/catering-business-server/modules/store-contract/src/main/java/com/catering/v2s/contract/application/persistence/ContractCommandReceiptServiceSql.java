package com.catering.v2s.contract.application.persistence;

/** SQL text fragments owned by ContractCommandReceiptService; B3 relocates text only and does not change execution. */
public final class ContractCommandReceiptServiceSql {
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_SELECT_RECEIPT_REQUEST_HASH_RESPONSE_JSON_TEXT =
            "SELECT receipt.request_hash, receipt.response_json::text FROM contract.contract_command_receipt receipt ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_CONTRACT_COMMAND_RECEIPT_RECEIPT_WORKSPACE_UUID =
            "WHERE receipt.workspace_uuid=? ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_CONDITION_RECEIPT_IDEMPOTENCY_KEY =
            "AND receipt.idempotency_key=?";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_INSERT_INTO_CONTRACT_COMMAND_RECEIPT = "INSERT INTO contract.contract_command_receipt (workspace_uuid, idempotency_key, contract_id, ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_REQUEST_HASH_RESPONSE_JSON_CREATED_AT_EPOCH_MILLIS = "request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, ?)";
}
