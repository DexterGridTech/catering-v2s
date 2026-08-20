package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Workspace-isolated idempotency receipt for business-channel owner commands. */
@Service
public final class BusinessChannelCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public BusinessChannelCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
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
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))",
                workspaceUuid.toString(),
                groupWorkspaceKey + ":" + idempotencyKey);
        Receipt prior = jdbc.query(
                "SELECT request_hash, response_json::text FROM business_channel.command_receipt "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, idempotencyKey);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (prior != null) {
            if (!requestHash.equals(prior.requestHash()))
                throw problem("IDEMPOTENCY_CONFLICT", 409, "idempotency key was used for another command");
            return read(prior.responseJson(), responseType);
        }

        T result;
        try (var commandScope = OwnerOperationDiagnostics.beginCommand()) {
            result = command.get();
        }
        jdbc.update(
                "INSERT INTO business_channel.command_receipt "
                        + "(receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, operation_id, "
                        + "request_hash, response_json, created_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
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

    private record Receipt(String requestHash, String responseJson) {}
}
