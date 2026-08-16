package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stores the exact terminal commercial-group readback for a required-idempotency update. */
@Service
public final class CommercialGroupCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public CommercialGroupCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public CommercialGroupReadback execute(
            UUID workspaceUuid,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<CommercialGroupReadback> command) {
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(? || ':' || ?))", workspaceUuid.toString(), key);
        Receipt existing = jdbc.query(
                "SELECT request_hash, response_json::text FROM organization.commercial_group_command_receipt WHERE "
                        + "workspace_uuid=? AND idempotency_key=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash()))
                throw new OrganizationHierarchyCommandReceiptService.OrganizationIdempotencyConflictException();
            CommercialGroupReadback replay = deserialize(existing.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, existing.responseJson())) {
                jdbc.update(
                        "UPDATE organization.commercial_group_command_receipt SET response_json=?::jsonb WHERE "
                                + "workspace_uuid=? AND idempotency_key=?",
                        serialize(replay),
                        workspaceUuid,
                        key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            CommercialGroupReadback result = command.get();
            jdbc.update(
                    "INSERT INTO organization.commercial_group_command_receipt (workspace_uuid, idempotency_key, "
                            + "commercial_group_uuid, request_hash, response_json, state, created_at_epoch_millis) "
                            + "VALUES "
                            + "(?, ?, ?, ?, ?::jsonb, 'SUCCEEDED', ?)",
                    workspaceUuid,
                    key,
                    result.id(),
                    requestHash,
                    serialize(result),
                    time.currentEpochMillis());
            return result;
        }
    }

    private static CommercialGroupReadback deserialize(String value) {
        try {
            return JSON.readValue(value, CommercialGroupReadback.class);
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
            return JSON.writeValueAsString(value);
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
            return Sha256Hex.digest(value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Receipt(String requestHash, String responseJson) {}
}
