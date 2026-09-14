package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/** Workspace-isolated idempotency receipt for business-channel owner commands. */
@Service
public final class BusinessChannelCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    private final BusinessChannelCommandReceiptPersistence persistence;
    private final TimeProvider time;

    @org.springframework.beans.factory.annotation.Autowired
    public BusinessChannelCommandReceiptService(
            BusinessChannelCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    /** Compatibility constructor for focused tests and direct owner construction. */
    public BusinessChannelCommandReceiptService(org.springframework.jdbc.core.JdbcTemplate jdbc, TimeProvider time) {
        this(new BusinessChannelCommandReceiptPersistence(jdbc), time);
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

        String requestHash = Sha256Hex.digest(canonicalRequest);
        persistence.lock(workspaceUuid, groupWorkspaceKey, idempotencyKey);
        BusinessChannelCommandReceiptPersistence.Receipt prior = persistence
                .find(workspaceUuid, groupWorkspaceKey, idempotencyKey)
                .orElse(null);
        if (prior != null) {
            if (!requestHash.equals(prior.requestHash()))
                throw problem("IDEMPOTENCY_CONFLICT", 409, "idempotency key was used for another command");
            return read(prior.responseJson(), responseType);
        }

        T result;
        try (var commandScope = OwnerOperationDiagnostics.beginCommand()) {
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
            return JSON.readValue(responseJson, responseType);
        } catch (Exception failure) {
            throw problem("RECEIPT_CORRUPT", 500, "business-channel command receipt is not readable", failure);
        }
    }

    private static String write(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception failure) {
            throw problem("RECEIPT_CORRUPT", 500, "business-channel command readback is not writable", failure);
        }
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message) {
        return new BusinessChannelCommandApi.Problem(code, status, message);
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new BusinessChannelCommandApi.Problem(code, status, message, cause);
    }
}
