package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-local exact-readback receipt for workspace-IAM commands. */
@Service
public final class WorkspaceIamCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public WorkspaceIamCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public <T> T execute(
            UUID workspaceUuid, String key, String canonicalRequest, Class<T> resultType, Supplier<T> command) {
        if (workspaceUuid == null) throw new WorkspaceInvitationService.InvitationValidationException();
        if (key == null || key.length() < 16 || key.length() > 128) {
            throw new WorkspaceInvitationService.InvitationValidationException();
        }
        String requestHash = sha256(canonicalRequest);
        AdvisoryLock.acquire(jdbc, "workspace-iam-receipt", workspaceUuid.toString(), key);
        Receipt prior = jdbc.query(
                "SELECT request_hash, response_json::text "
                        + "FROM workspace_iam.workspace_command_receipt WHERE workspace_uuid=? AND idempotency_key=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, key);
                },
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (prior != null) {
            if (!requestHash.equals(prior.requestHash())) {
                throw new WorkspaceIamIdempotencyConflictException();
            }
            return read(prior.responseJson(), resultType);
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            T result = command.get();
            jdbc.update(
                    "INSERT INTO workspace_iam.workspace_command_receipt "
                            + "(workspace_uuid, idempotency_key, request_hash, response_json, created_at_epoch_millis) "
                            + "VALUES (?, ?, ?, ?::jsonb, ?)",
                    workspaceUuid,
                    key,
                    requestHash,
                    write(result),
                    time.currentEpochMillis());
            return result;
        }
    }

    private static <T> T read(String value, Class<T> resultType) {
        try {
            return JSON.readValue(value, resultType);
        } catch (Exception exception) {
            throw new WorkspaceIamReceiptCorruptException(exception);
        }
    }

    private static String write(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("workspace-IAM receipt serialization failed", exception);
        }
    }

    private static String sha256(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (NullPointerException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private record Receipt(String requestHash, String responseJson) {}

    public static final class WorkspaceIamIdempotencyConflictException extends RuntimeException {}

    public static final class WorkspaceIamReceiptCorruptException extends RuntimeException {
        public WorkspaceIamReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
