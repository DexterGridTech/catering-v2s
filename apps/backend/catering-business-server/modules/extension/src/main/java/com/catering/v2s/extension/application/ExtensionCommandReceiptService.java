package com.catering.v2s.extension.application;

import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExtensionCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    public ExtensionCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) { this.jdbc = jdbc; this.time = time; }

    @Transactional
    public ExtensionDefinitionReadback execute(String key, UUID workspaceUuid, String groupWorkspaceKey, String entityType, String request, Supplier<ExtensionDefinitionReadback> command) {
        if (key == null || key.length() < 16 || key.length() > 128) throw new ExtensionDefinitionService.DefinitionInvalidException();
        String requestHash = sha256(request);
        Receipt existing = claim(key, workspaceUuid, groupWorkspaceKey, entityType, requestHash);
        if (existing != null) {
            if (!existing.requestHash().equals(requestHash)) throw new ExtensionIdempotencyConflictException();
            try { return JSON.readValue(existing.responseJson(), ExtensionDefinitionReadback.class); }
            catch (Exception failure) { throw new ExtensionReceiptCorruptException(failure); }
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            ExtensionDefinitionReadback response = command.get();
            try {
                jdbc.update("UPDATE extension.extension_command_receipt SET response_json=CAST(? AS JSONB), state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND state='IN_PROGRESS'", JSON.writeValueAsString(response), workspaceUuid, key);
            } catch (Exception failure) { throw new ExtensionReceiptCorruptException(failure); }
            return response;
        }
    }
    /** Insert, rather than an absent-row lock, is the workspace-scoped receipt linearization point. */
    private Receipt claim(String key, UUID workspaceUuid, String groupWorkspaceKey, String entityType, String requestHash) {
        try {
            jdbc.update("INSERT INTO extension.extension_command_receipt (idempotency_key, workspace_uuid, group_workspace_key, entity_type, request_hash, response_json, state, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?, '{}'::jsonb, 'IN_PROGRESS', ?)", key, workspaceUuid, groupWorkspaceKey, entityType, requestHash, time.currentEpochMillis());
            return null;
        } catch (DuplicateKeyException duplicate) {
            Receipt existing = jdbc.query("SELECT request_hash, response_json::text, state FROM extension.extension_command_receipt WHERE workspace_uuid=? AND idempotency_key=?", statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); }, result -> result.next() ? new Receipt(result.getString(1), result.getString(2), result.getString(3)) : null);
            if (existing == null || !"SUCCEEDED".equals(existing.state())) throw new ExtensionReceiptCorruptException(duplicate);
            return existing;
        }
    }
    private static String sha256(String value) { try { return Sha256Hex.digest(value); } catch (Exception failure) { throw new ExtensionReceiptCorruptException(failure); } }
    private record Receipt(String requestHash, String responseJson, String state) { }
    public static final class ExtensionIdempotencyConflictException extends RuntimeException { }
    public static final class ExtensionReceiptCorruptException extends RuntimeException { public ExtensionReceiptCorruptException(Throwable cause) { super(cause); } }
}
