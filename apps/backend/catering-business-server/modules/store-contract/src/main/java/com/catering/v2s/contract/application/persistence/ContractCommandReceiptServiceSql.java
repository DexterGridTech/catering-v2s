package com.catering.v2s.contract.application.persistence;

/** SQL text fragments owned by ContractCommandReceiptService; B3 relocates text only and does not change execution. */
public final class ContractCommandReceiptServiceSql {
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_SELECT_RECEIPT_REQUEST_HASH_RESPONSE_JSON_TEXT = "SELECT receipt.request_hash, receipt.response_json::text FROM (SELECT ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_CONTINUATION_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT_ADVISORY = "pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))) advisory ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_CONTINUATION_CONTRACT_COMMAND_RECEIPT_RECEIPT_WORKSPACE_UUID = "LEFT JOIN contract.contract_command_receipt receipt ON receipt.workspace_uuid=? ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_CONDITION_RECEIPT_IDEMPOTENCY_KEY = "AND receipt.idempotency_key=?";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_INSERT_INTO_CONTRACT_COMMAND_RECEIPT = "INSERT INTO contract.contract_command_receipt (workspace_uuid, idempotency_key, contract_id, ";
    public static final String CONTRACT_COMMAND_RECEIPT_SERVICE_CONTINUATION_REQUEST_HASH_RESPONSE_JSON_CREATED_AT_EPOCH_MILLIS = "request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, ?)";
}
