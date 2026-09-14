package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceIamCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/** Owner-local exact-readback receipt for workspace-IAM commands. */
@Service
public final class WorkspaceIamCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final WorkspaceIamCommandReceiptPersistence persistence;
    private final TimeProvider time;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceIamCommandReceiptService(WorkspaceIamCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    public WorkspaceIamCommandReceiptService(org.springframework.jdbc.core.JdbcTemplate jdbc, TimeProvider time) {
        this(new WorkspaceIamCommandReceiptPersistence(jdbc), time);
    }

    public <T> T execute(
            UUID workspaceUuid, String key, String canonicalRequest, Class<T> resultType, Supplier<T> command) {
        if (workspaceUuid == null) throw new WorkspaceInvitationService.InvitationValidationException();
        if (key == null || key.length() < 16 || key.length() > 128) {
            throw new WorkspaceInvitationService.InvitationValidationException();
        }
        String requestHash = sha256(canonicalRequest);
        persistence.acquireLock(workspaceUuid, key);
        WorkspaceIamCommandReceiptPersistence.ReceiptRow stored = persistence.find(workspaceUuid, key);
        Receipt prior = stored == null ? null : new Receipt(stored.requestHash(), stored.responseJson());
        if (prior != null) {
            if (!requestHash.equals(prior.requestHash())) {
                throw new WorkspaceIamIdempotencyConflictException();
            }
            return read(prior.responseJson(), resultType);
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            T result = command.get();
            persistence.insert(workspaceUuid, key, requestHash, write(result), time.currentEpochMillis());
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
