package com.catering.v2s.collaboration.application;

import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.application.persistence.CollaborationCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Workspace-isolated idempotency receipt for collaboration owner commands. */
@Service
public final class CollaborationCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    private final CollaborationCommandReceiptPersistence persistence;
    private final TimeProvider time;

    @Autowired
    public CollaborationCommandReceiptService(CollaborationCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    /** Compatibility constructor for focused tests and direct owner construction. */
    public CollaborationCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this(new CollaborationCommandReceiptPersistence(jdbc), time);
    }

    public <T> T execute(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String idempotencyKey,
            String operationId,
            String canonicalRequest,
            Class<T> responseType,
            Supplier<T> command) {
        if (workspaceUuid == null) throw problem("VALIDATION_ERROR", 422, "workspaceUuid is required");
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank())
            throw problem("VALIDATION_ERROR", 422, "groupWorkspaceKey is required");
        if (idempotencyKey == null || idempotencyKey.length() < 16 || idempotencyKey.length() > 128)
            throw problem("VALIDATION_ERROR", 422, "idempotencyKey is invalid");
        if (operationId == null || operationId.isBlank())
            throw problem("VALIDATION_ERROR", 422, "operationId is required");
        if (canonicalRequest == null) throw new IllegalArgumentException("canonicalRequest is required");

        String requestHash = CommandReceiptSupport.requestHash(canonicalRequest);
        persistence.lock(workspaceUuid, groupWorkspaceKey, idempotencyKey);
        CollaborationCommandReceiptPersistence.Receipt prior = persistence
                .find(workspaceUuid, groupWorkspaceKey, idempotencyKey)
                .orElse(null);
        if (prior != null) {
            if (!requestHash.equals(prior.requestHash()))
                throw problem("IDEMPOTENCY_CONFLICT", 409, "idempotency key was used for another command");
            return read(prior.responseJson(), responseType);
        }

        T result;
        var commandScope = OwnerOperationDiagnostics.beginCommand();
        try (commandScope) {
            if (commandScope == null) throw new IllegalStateException("owner command diagnostics unavailable");
            result = command.get();
        }
        persistence.insert(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                idempotencyKey,
                operationId,
                requestHash,
                write(result),
                time.currentEpochMillis());
        return result;
    }

    private static <T> T read(String responseJson, Class<T> responseType) {
        try {
            return CommandReceiptSupport.deserializeNullable(
                    JSON, responseJson, responseType, "collaboration command receipt is not readable");
        } catch (Exception failure) {
            throw problem("RECEIPT_CORRUPT", 500, "collaboration command receipt is not readable", failure);
        }
    }

    private static String write(Object value) {
        try {
            return CommandReceiptSupport.serialize(JSON, value, "collaboration command readback is not writable");
        } catch (Exception failure) {
            throw problem("RECEIPT_CORRUPT", 500, "collaboration command readback is not writable", failure);
        }
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message) {
        return new CollaborationCommandApi.Problem(code, status, message);
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new CollaborationCommandApi.Problem(code, status, message, cause);
    }
}
