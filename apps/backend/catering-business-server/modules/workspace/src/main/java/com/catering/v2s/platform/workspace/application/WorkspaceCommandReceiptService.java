package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceCommandReceiptPersistence;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/** Persists the exact terminal owner readback for a required-idempotency workspace command. */
@Service
public final class WorkspaceCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final WorkspaceCommandReceiptPersistence persistence;
    private final TimeProvider time;

    public WorkspaceCommandReceiptService(WorkspaceCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
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
        String requestHash = CommandReceiptSupport.requestHash(canonicalRequest);
        persistence.lock(groupWorkspaceKey, key);
        WorkspaceCommandReceiptPersistence.Receipt existing =
                persistence.find(groupWorkspaceKey, key).orElse(null);
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new WorkspaceIdempotencyConflictException();
            WorkspaceAdministrationReadback replay = deserialize(existing.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, existing.responseJson())) {
                persistence.upgradeLegacyResponse(groupWorkspaceKey, key, serialize(replay));
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            WorkspaceAdministrationReadback result = command.get();
            if (!groupWorkspaceKey.equals(result.groupWorkspaceKey()))
                throw new WorkspaceReceiptCorruptException(
                        new IllegalStateException("receipt scope does not match command result"));
            persistence.insert(
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
        if (value == null) return null;
        try {
            return CommandReceiptSupport.deserialize(
                    JSON, value, WorkspaceAdministrationReadback.class, "workspace receipt deserialization failed");
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
            return CommandReceiptSupport.serialize(JSON, value, "workspace receipt serialization failed");
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
            return CommandReceiptSupport.requestHash(value);
        } catch (NullPointerException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static final class WorkspaceIdempotencyConflictException extends RuntimeException {}

    public static final class WorkspaceReceiptCorruptException extends RuntimeException {
        public WorkspaceReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
