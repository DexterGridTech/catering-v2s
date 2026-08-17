package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stores the exact terminal hierarchy readback for each required-idempotency owner command. */
@Service
public final class OrganizationHierarchyCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public OrganizationHierarchyCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public OrganizationNodeReadback execute(
            UUID workspaceUuid,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<OrganizationNodeReadback> command) {
        if (workspaceUuid == null) throw new OrganizationHierarchyService.OrganizationValidationException();
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        AdvisoryLock.acquire(jdbc, "org-hierarchy-receipt", workspaceUuid.toString(), key);
        Receipt existing = jdbc.query(
                "SELECT request_hash, response_json::text FROM organization.organization_command_receipt WHERE "
                        + "workspace_uuid=? AND idempotency_key=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new OrganizationIdempotencyConflictException();
            OrganizationNodeReadback replay = deserialize(existing.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, existing.responseJson())) {
                jdbc.update(
                        "UPDATE organization.organization_command_receipt SET response_json=?::jsonb WHERE "
                                + "workspace_uuid=? AND idempotency_key=?",
                        serialize(replay),
                        workspaceUuid,
                        key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            OrganizationNodeReadback result = command.get();
            jdbc.update(
                    "INSERT INTO organization.organization_command_receipt (workspace_uuid, idempotency_key, "
                            + "entity_id, request_hash, response_json, state, created_at_epoch_millis) VALUES (?, ?, "
                            + "?, ?, "
                            + "?::jsonb, 'SUCCEEDED', ?)",
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
        try {
            return JSON.readValue(value, OrganizationNodeReadback.class);
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
            return JSON.writeValueAsString(value);
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
            return Sha256Hex.digest(value);
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
