package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.BusinessEntityCommandReceiptPersistence;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Persists an exact terminal business-entity readback for a required-idempotency owner command. */
@Service
public final class BusinessEntityCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final BusinessEntityCommandReceiptPersistence persistence;
    private final TimeProvider time;

    public BusinessEntityCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this(new BusinessEntityCommandReceiptPersistence(jdbc), time);
    }

    @Autowired
    public BusinessEntityCommandReceiptService(
            BusinessEntityCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    public OrganizationEntityReadback execute(
            UUID workspaceUuid,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<OrganizationEntityReadback> command) {
        return execute(
                workspaceUuid,
                idempotencyKey,
                canonicalRequest,
                command,
                OrganizationEntityReadback::id,
                BusinessEntityCommandReceiptService::serialize,
                BusinessEntityCommandReceiptService::deserialize);
    }

    /** Persists and replays the immutable 204 action acknowledgement for a single R-24 command. */
    public BrandAuthorizationAcknowledgement executeAuthorizationAcknowledgement(
            UUID workspaceUuid, UUID headCompanyId, String idempotencyKey, String canonicalRequest, Runnable command) {
        Receipt existing = claim(workspaceUuid, idempotencyKey, canonicalRequest);
        if (existing != null) return BrandAuthorizationAcknowledgement.INSTANCE;
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            command.run();
            persistence.markAuthorizationSucceeded(
                    headCompanyId,
                    workspaceUuid,
                    idempotencyKey);
            return BrandAuthorizationAcknowledgement.INSTANCE;
        }
    }

    private <T> T execute(
            UUID workspaceUuid,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<T> command,
            java.util.function.Function<T, UUID> entityId,
            java.util.function.Function<T, String> serializer,
            java.util.function.Function<String, T> deserializer) {
        Receipt existing = claim(workspaceUuid, idempotencyKey, canonicalRequest);
        if (existing != null) return deserializer.apply(existing.responseJson());
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            T result = command.get();
            persistence.markSucceeded(
                    entityId.apply(result),
                    serializer.apply(result),
                    workspaceUuid,
                    requiredKey(idempotencyKey));
            return result;
        }
    }

    /**
     * The insert is the linearization point. A duplicate insert waits for the creator transaction, then rereads its
     * terminal receipt; no absent-row lock is used.
     */
    private Receipt claim(UUID workspaceUuid, String idempotencyKey, String canonicalRequest) {
        if (workspaceUuid == null) throw new BusinessEntityService.OrganizationValidationException();
        String key = requiredKey(idempotencyKey);
        String requestHash = CommandReceiptSupport.requestHash(canonicalRequest);
        int claimed = persistence.claim(
                workspaceUuid,
                key,
                requestHash,
                time.currentEpochMillis());
        if (CommandReceiptSupport.claimOutcome(claimed) == CommandReceiptSupport.ClaimOutcome.CLAIMED) return null;
        BusinessEntityCommandReceiptPersistence.Receipt stored = persistence.read(workspaceUuid, key);
        Receipt existing = stored == null ? null : new Receipt(stored.requestHash(), stored.responseJson(), stored.state());
        if (existing == null || !"SUCCEEDED".equals(existing.state()))
            throw new BusinessEntityReceiptCorruptException(
                    new IllegalStateException("organization command receipt is not terminal"));
        if (!requestHash.equals(existing.requestHash())) throw new BusinessEntityIdempotencyConflictException();
        return existing;
    }

    private static OrganizationEntityReadback deserialize(String source) {
        if (source == null) return null;
        try {
            return CommandReceiptSupport.deserialize(
                    JSON, source, OrganizationEntityReadback.class, "business entity receipt deserialization failed");
        } catch (Exception exception) {
            throw new BusinessEntityReceiptCorruptException(exception);
        }
    }

    private static String serialize(OrganizationEntityReadback value) {
        try {
            return CommandReceiptSupport.serialize(JSON, value, "business entity receipt serialization failed");
        } catch (Exception exception) {
            throw new IllegalStateException("business entity receipt serialization failed", exception);
        }
    }

    private static String requiredKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128)
            throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static String sha256(String value) {
        try {
            return CommandReceiptSupport.requestHash(value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Receipt(String requestHash, String responseJson, String state) {}

    public enum BrandAuthorizationAcknowledgement {
        INSTANCE
    }

    public static final class BusinessEntityIdempotencyConflictException extends RuntimeException {}

    public static final class BusinessEntityReceiptCorruptException extends RuntimeException {
        public BusinessEntityReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
