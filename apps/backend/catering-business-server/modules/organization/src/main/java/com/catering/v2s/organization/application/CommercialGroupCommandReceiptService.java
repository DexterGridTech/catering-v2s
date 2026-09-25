package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.application.persistence.CommercialGroupCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stores the exact terminal commercial-group readback for a required-idempotency update. */
@Service
public final class CommercialGroupCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final CommercialGroupCommandReceiptPersistence persistence;
    private final TimeProvider time;

    public CommercialGroupCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this(jdbc, new CommercialGroupCommandReceiptPersistence(jdbc), time);
    }

    @Autowired
    public CommercialGroupCommandReceiptService(
            JdbcTemplate jdbc, CommercialGroupCommandReceiptPersistence persistence, TimeProvider time) {
        this.jdbc = jdbc;
        this.persistence = persistence;
        this.time = time;
    }

    public CommercialGroupReadback execute(
            UUID workspaceUuid,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<CommercialGroupReadback> command) {
        String key = requiredKey(idempotencyKey);
        String requestHash = CommandReceiptSupport.requestHash(canonicalRequest);
        AdvisoryLock.acquire(jdbc, "commercial-group-receipt", workspaceUuid.toString(), key);
        CommercialGroupCommandReceiptPersistence.Receipt stored = persistence.read(workspaceUuid, key);
        Receipt existing = stored == null ? null : new Receipt(stored.requestHash(), stored.responseJson());
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash()))
                throw new OrganizationHierarchyCommandReceiptService.OrganizationIdempotencyConflictException();
            CommercialGroupReadback replay = deserialize(existing.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, existing.responseJson())) {
                persistence.replaceResponse(serialize(replay), workspaceUuid, key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            CommercialGroupReadback result = command.get();
            persistence.insertSucceeded(
                    workspaceUuid, key, result.id(), requestHash, serialize(result), time.currentEpochMillis());
            return result;
        }
    }

    private static CommercialGroupReadback deserialize(String value) {
        if (value == null) return null;
        try {
            return CommandReceiptSupport.deserialize(
                    JSON, value, CommercialGroupReadback.class, "commercial group receipt deserialization failed");
        } catch (Exception directFailure) {
            try {
                return JSON.treeToValue(
                        LegacyReceiptJson.decode(JSON, value, Set.of(), Set.of("extensionValues")),
                        CommercialGroupReadback.class);
            } catch (Exception legacyFailure) {
                legacyFailure.addSuppressed(directFailure);
                throw new OrganizationHierarchyCommandReceiptService.OrganizationReceiptCorruptException(legacyFailure);
            }
        }
    }

    private static String serialize(CommercialGroupReadback value) {
        try {
            return CommandReceiptSupport.serialize(JSON, value, "commercial group receipt serialization failed");
        } catch (Exception failure) {
            throw new IllegalStateException("commercial group receipt serialization failed", failure);
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
}
