package com.catering.v2s.extension.application;

import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.application.persistence.ExtensionCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExtensionCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final ExtensionCommandReceiptPersistence persistence;

    @Autowired
    public ExtensionCommandReceiptService(ExtensionCommandReceiptPersistence persistence) {
        this.persistence = persistence;
    }

    /** Compatibility constructor for focused tests and direct owner construction. */
    public ExtensionCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this(new ExtensionCommandReceiptPersistence(jdbc, time));
    }

    @Transactional
    public ExtensionDefinitionReadback execute(
            String key,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String request,
            Supplier<ExtensionDefinitionReadback> command) {
        if (key == null || key.length() < 16 || key.length() > 128)
            throw new ExtensionDefinitionService.DefinitionInvalidException();
        String requestHash = sha256(request);
        ExtensionCommandReceiptPersistence.Receipt existing =
                claim(key, workspaceUuid, groupWorkspaceKey, entityType, requestHash);
        if (existing != null) {
            if (!existing.requestHash().equals(requestHash)) throw new ExtensionIdempotencyConflictException();
            try {
                return JSON.readValue(existing.responseJson(), ExtensionDefinitionReadback.class);
            } catch (Exception failure) {
                throw new ExtensionReceiptCorruptException(failure);
            }
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            ExtensionDefinitionReadback response = command.get();
            int updated;
            try {
                updated = persistence.complete(workspaceUuid, key, JSON.writeValueAsString(response));
            } catch (Exception failure) {
                throw new ExtensionReceiptCorruptException(failure);
            }
            if (updated != 1) {
                throw new ExtensionReceiptCorruptException(
                        new IllegalStateException("extension command receipt is not terminal"));
            }
            return response;
        }
    }
    /** Insert, rather than an absent-row lock, is the workspace-scoped receipt linearization point. */
    private ExtensionCommandReceiptPersistence.Receipt claim(
            String key, UUID workspaceUuid, String groupWorkspaceKey, String entityType, String requestHash) {
        int claimed = persistence.claim(key, workspaceUuid, groupWorkspaceKey, entityType, requestHash);
        if (claimed == 1) {
            return null;
        }
        ExtensionCommandReceiptPersistence.Receipt existing = persistence.find(workspaceUuid, key);
        if (existing == null || !"SUCCEEDED".equals(existing.state()))
            throw new ExtensionReceiptCorruptException(
                    new IllegalStateException("extension command receipt is not terminal"));
        return existing;
    }

    private static String sha256(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (Exception failure) {
            throw new ExtensionReceiptCorruptException(failure);
        }
    }

    public static final class ExtensionIdempotencyConflictException extends RuntimeException {}

    public static final class ExtensionReceiptCorruptException extends RuntimeException {
        public ExtensionReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
