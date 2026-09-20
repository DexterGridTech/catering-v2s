package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.OrganizationHierarchyCommandReceiptPersistence;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stores the exact terminal hierarchy readback for each required-idempotency owner command. */
@Service
public final class OrganizationHierarchyCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final OrganizationHierarchyCommandReceiptPersistence persistence;
    private final TimeProvider time;

    public OrganizationHierarchyCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this(jdbc, new OrganizationHierarchyCommandReceiptPersistence(jdbc), time);
    }

    @Autowired
    public OrganizationHierarchyCommandReceiptService(
            JdbcTemplate jdbc, OrganizationHierarchyCommandReceiptPersistence persistence, TimeProvider time) {
        this.jdbc = jdbc;
        this.persistence = persistence;
        this.time = time;
    }

    public OrganizationNodeReadback execute(
            UUID workspaceUuid,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<OrganizationNodeReadback> command) {
        if (workspaceUuid == null) throw new OrganizationHierarchyService.OrganizationValidationException();
        String key = requiredKey(idempotencyKey);
        String requestHash = CommandReceiptSupport.requestHash(canonicalRequest);
        AdvisoryLock.acquire(jdbc, "org-hierarchy-receipt", workspaceUuid.toString(), key);
        OrganizationHierarchyCommandReceiptPersistence.Receipt stored = persistence.read(workspaceUuid, key);
        Receipt existing = stored == null ? null : new Receipt(stored.requestHash(), stored.responseJson());
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new OrganizationIdempotencyConflictException();
            OrganizationNodeReadback replay = deserialize(existing.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, existing.responseJson())) {
                persistence.replaceResponse(
                        serialize(replay),
                        workspaceUuid,
                        key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            OrganizationNodeReadback result = command.get();
            persistence.insertSucceeded(
                    workspaceUuid,
                    key,
                    result.id(),
                    requestHash,
                    serialize(result),
                    time.currentEpochMillis());
            return result;
        }
    }

    private static OrganizationNodeReadback deserialize(String value) {
        if (value == null) return null;
        try {
            return CommandReceiptSupport.deserialize(
                    JSON, value, OrganizationNodeReadback.class, "organization hierarchy receipt deserialization failed");
        } catch (Exception directFailure) {
            try {
                return JSON.treeToValue(
                        LegacyReceiptJson.decode(JSON, value, Set.of("phaseNames"), Set.of("extensionValues")),
                        OrganizationNodeReadback.class);
            } catch (Exception legacyFailure) {
                legacyFailure.addSuppressed(directFailure);
                throw new OrganizationReceiptCorruptException(legacyFailure);
            }
        }
    }

    private static String serialize(OrganizationNodeReadback value) {
        try {
            return CommandReceiptSupport.serialize(
                    JSON, value, "organization hierarchy receipt serialization failed");
        } catch (Exception failure) {
            throw new IllegalStateException("organization hierarchy receipt serialization failed", failure);
        }
    }

    private static String requiredKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128)
            throw new OrganizationHierarchyService.OrganizationValidationException();
        return value;
    }

    private static String sha256(String value) {
        try {
            return CommandReceiptSupport.requestHash(value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Receipt(String requestHash, String responseJson) {}

    public static final class OrganizationIdempotencyConflictException extends RuntimeException {}

    public static final class OrganizationReceiptCorruptException extends RuntimeException {
        public OrganizationReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
