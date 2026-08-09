package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationEntityReadback;
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

/** Persists an exact terminal business-entity readback for a required-idempotency owner command. */
@Service
public final class BusinessEntityCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public BusinessEntityCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public OrganizationEntityReadback execute(UUID workspaceUuid, String idempotencyKey, String canonicalRequest, Supplier<OrganizationEntityReadback> command) {
        return execute(workspaceUuid, idempotencyKey, canonicalRequest, command, OrganizationEntityReadback::id, BusinessEntityCommandReceiptService::serialize, BusinessEntityCommandReceiptService::deserialize);
    }

    /** Persists and replays the immutable 204 action acknowledgement for a single R-24 command. */
    public BrandAuthorizationAcknowledgement executeAuthorizationAcknowledgement(UUID workspaceUuid, UUID headCompanyId, String idempotencyKey, String canonicalRequest, Runnable command) {
        Receipt existing = claim(workspaceUuid, idempotencyKey, canonicalRequest);
        if (existing != null) return BrandAuthorizationAcknowledgement.INSTANCE;
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            command.run();
            jdbc.update(
                "UPDATE organization.organization_command_receipt SET entity_id=?, response_json=CAST(? AS JSONB), state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND state='IN_PROGRESS'",
                headCompanyId, "{\"status\":204}", workspaceUuid, idempotencyKey
            );
            return BrandAuthorizationAcknowledgement.INSTANCE;
        }
    }

    private <T> T execute(UUID workspaceUuid, String idempotencyKey, String canonicalRequest, Supplier<T> command, java.util.function.Function<T, UUID> entityId, java.util.function.Function<T, String> serializer, java.util.function.Function<String, T> deserializer) {
        Receipt existing = claim(workspaceUuid, idempotencyKey, canonicalRequest);
        if (existing != null) return deserializer.apply(existing.responseJson());
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            T result = command.get();
            jdbc.update(
                "UPDATE organization.organization_command_receipt SET entity_id=?, response_json=?::jsonb, state='SUCCEEDED' WHERE workspace_uuid=? AND idempotency_key=? AND state='IN_PROGRESS'",
                entityId.apply(result), serializer.apply(result), workspaceUuid, requiredKey(idempotencyKey)
            );
            return result;
        }
    }

    /**
     * The insert is the linearization point. A duplicate insert waits for the creator transaction,
     * then rereads its terminal receipt; no absent-row lock is used.
     */
    private Receipt claim(UUID workspaceUuid, String idempotencyKey, String canonicalRequest) {
        if (workspaceUuid == null) throw new BusinessEntityService.OrganizationValidationException();
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        int claimed = jdbc.update(
            "INSERT INTO organization.organization_command_receipt (workspace_uuid, idempotency_key, request_hash, response_json, state, created_at_epoch_millis) VALUES (?, ?, ?, '{}'::jsonb, 'IN_PROGRESS', ?) ON CONFLICT (workspace_uuid, idempotency_key) DO NOTHING",
            workspaceUuid, key, requestHash, time.currentEpochMillis()
        );
        if (claimed == 1) return null;
        Receipt existing = jdbc.query(
            "SELECT request_hash, response_json::text, state FROM organization.organization_command_receipt WHERE workspace_uuid=? AND idempotency_key=?",
            statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); },
            result -> result.next() ? new Receipt(result.getString(1), result.getString(2), result.getString(3)) : null
        );
        if (existing == null || !"SUCCEEDED".equals(existing.state())) throw new BusinessEntityReceiptCorruptException(new IllegalStateException("organization command receipt is not terminal"));
        if (!requestHash.equals(existing.requestHash())) throw new BusinessEntityIdempotencyConflictException();
        return existing;
    }

    private static OrganizationEntityReadback deserialize(String source) {
        try {
            return JSON.readValue(source, OrganizationEntityReadback.class);
        } catch (Exception exception) {
            throw new BusinessEntityReceiptCorruptException(exception);
        }
    }

    private static String serialize(OrganizationEntityReadback value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("business entity receipt serialization failed", exception);
        }
    }

    private static String requiredKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128) throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Receipt(String requestHash, String responseJson, String state) { }

    public enum BrandAuthorizationAcknowledgement { INSTANCE }

    public static final class BusinessEntityIdempotencyConflictException extends RuntimeException { }
    public static final class BusinessEntityReceiptCorruptException extends RuntimeException {
        public BusinessEntityReceiptCorruptException(Throwable cause) { super(cause); }
    }
}
