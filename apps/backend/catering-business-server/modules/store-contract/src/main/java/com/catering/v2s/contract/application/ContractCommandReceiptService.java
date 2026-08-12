package com.catering.v2s.contract.application;

import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-local, exact terminal readback persistence for required-idempotency contract commands. */
@Service
public final class ContractCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc; private final TimeProvider time;
    public ContractCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) { this.jdbc = jdbc; this.time = time; }
    public StoreContractReadback execute(UUID workspaceUuid, String key, String canonicalRequest, Supplier<StoreContractReadback> command) {
        if (workspaceUuid == null || key == null || key.length() < 16 || key.length() > 128) throw new ContractCommandService.ContractValidationException();
        String hash = hash(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))", workspaceUuid.toString(), key);
        Receipt prior = jdbc.query("SELECT request_hash, response_json::text FROM contract.contract_command_receipt WHERE workspace_uuid=? AND idempotency_key=?", statement -> {
            statement.setObject(1, workspaceUuid);
            statement.setString(2, key);
        }, result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (prior != null) { if (!hash.equals(prior.hash())) throw new ContractIdempotencyConflictException(); return read(prior.json()); }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            StoreContractReadback result = command.get();
            jdbc.update("INSERT INTO contract.contract_command_receipt (workspace_uuid, idempotency_key, contract_id, request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, ?)", workspaceUuid, key, result.id(), hash, write(result), time.currentEpochMillis());
            return result;
        }
    }
    private static StoreContractReadback read(String value) { try { return JSON.readValue(value, StoreContractReadback.class); } catch (Exception exception) { throw new ContractReceiptCorruptException(exception); } }
    private static String write(StoreContractReadback value) { try { return JSON.writeValueAsString(value); } catch (Exception exception) { throw new IllegalStateException(exception); } }
    private static String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception exception) { throw new IllegalStateException(exception); } }
    private record Receipt(String hash, String json) { }
    public static final class ContractIdempotencyConflictException extends RuntimeException { }
    public static final class ContractReceiptCorruptException extends RuntimeException { public ContractReceiptCorruptException(Throwable cause) { super(cause); } }
}
