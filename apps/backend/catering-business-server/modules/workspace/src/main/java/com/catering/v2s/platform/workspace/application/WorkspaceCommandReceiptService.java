package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Persists the exact terminal owner readback for a required-idempotency workspace command. */
@Service
public final class WorkspaceCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public WorkspaceCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public WorkspaceAdministrationReadback execute(
            String groupWorkspaceKey,
            String idempotencyKey,
            String canonicalRequest,
            Supplier<WorkspaceAdministrationReadback> command) {
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank())
            throw new WorkspaceAdministrationService.WorkspaceInputInvalidException();
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(? || ':' || ?))", groupWorkspaceKey, key);
        Receipt existing = jdbc.query(
                "SELECT request_hash, response_json::text FROM platform_workspace.workspace_command_receipt WHERE "
                        + "group_workspace_key=? AND idempotency_key=?",
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, key);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new WorkspaceIdempotencyConflictException();
            WorkspaceAdministrationReadback replay = deserialize(existing.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, existing.responseJson())) {
                jdbc.update(
                        "UPDATE platform_workspace.workspace_command_receipt SET response_json=?::jsonb WHERE "
                                + "group_workspace_key=? AND idempotency_key=?",
                        serialize(replay),
                        groupWorkspaceKey,
                        key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            WorkspaceAdministrationReadback result = command.get();
            if (!groupWorkspaceKey.equals(result.groupWorkspaceKey()))
                throw new WorkspaceReceiptCorruptException(
                        new IllegalStateException("receipt scope does not match command result"));
            jdbc.update(
                    "INSERT INTO platform_workspace.workspace_command_receipt (group_workspace_key, workspace_uuid, "
                            + "idempotency_key, request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, "
                            + "?, "
                            + "?::jsonb, ?)",
                    groupWorkspaceKey,
                    result.workspaceUuid(),
                    key,
                    requestHash,
                    serialize(result),
                    time.currentEpochMillis());
            return result;
        }
    }

    private WorkspaceAdministrationReadback deserialize(String value) {
        try {
            return JSON.readValue(value, WorkspaceAdministrationReadback.class);
        } catch (Exception directFailure) {
            try {
                return JSON.treeToValue(
                        LegacyReceiptJson.decode(JSON, value, Set.of(), Set.of()),
                        WorkspaceAdministrationReadback.class);
            } catch (Exception legacyFailure) {
                legacyFailure.addSuppressed(directFailure);
                throw new WorkspaceReceiptCorruptException(legacyFailure);
            }
        }
    }

    private String serialize(WorkspaceAdministrationReadback value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException("workspace receipt serialization failed", failure);
        }
    }

    private static String requiredKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128)
            throw new WorkspaceAdministrationService.WorkspaceInputInvalidException();
        return value;
    }

    private static String sha256(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (NullPointerException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Receipt(String requestHash, String responseJson) {}

    public static final class WorkspaceIdempotencyConflictException extends RuntimeException {}

    public static final class WorkspaceReceiptCorruptException extends RuntimeException {
        public WorkspaceReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
