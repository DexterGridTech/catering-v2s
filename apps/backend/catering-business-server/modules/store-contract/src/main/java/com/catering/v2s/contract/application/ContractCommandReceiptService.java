package com.catering.v2s.contract.application;

import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-local, exact terminal readback persistence for required-idempotency contract commands. */
@Service
public final class ContractCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public ContractCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public StoreContractReadback execute(
            UUID workspaceUuid, String key, String canonicalRequest, Supplier<StoreContractReadback> command) {
        if (workspaceUuid == null || key == null || key.length() < 16 || key.length() > 128)
            throw new ContractCommandService.ContractValidationException();
        String hash = hash(canonicalRequest);
        Receipt prior = jdbc.query(
                "SELECT receipt.request_hash, receipt.response_json::text FROM (SELECT "
                        + "pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))) advisory "
                        + "LEFT JOIN contract.contract_command_receipt receipt ON receipt.workspace_uuid=? "
                        + "AND receipt.idempotency_key=?",
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
        if (prior != null) {
            if (!hash.equals(prior.hash())) throw new ContractIdempotencyConflictException();
            return read(prior.json());
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            StoreContractReadback result = command.get();
            jdbc.update(
                    "INSERT INTO contract.contract_command_receipt (workspace_uuid, idempotency_key, contract_id, "
                            + "request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, ?)",
                    workspaceUuid,
                    key,
                    result.id(),
                    hash,
                    write(result),
                    time.currentEpochMillis());
            return result;
        }
    }

    private static StoreContractReadback read(String value) {
        try {
            return JSON.readValue(value, StoreContractReadback.class);
        } catch (Exception exception) {
            throw new ContractReceiptCorruptException(exception);
        }
    }

    private static String write(StoreContractReadback value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String hash(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (NullPointerException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Receipt(String hash, String json) {}

    public static final class ContractIdempotencyConflictException extends RuntimeException {}

    public static final class ContractReceiptCorruptException extends RuntimeException {
        public ContractReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
