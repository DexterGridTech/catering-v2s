package com.catering.v2s.platform.iam.application;

import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.application.persistence.PlatformCommandReceiptPersistence;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-local receipt for platform-admin mutations; persisted snapshots avoid a later read changing a replay. */
@Service
public final class PlatformCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final PlatformCommandReceiptPersistence persistence;
    private final TimeProvider time;

    @Autowired
    public PlatformCommandReceiptService(PlatformCommandReceiptPersistence persistence, TimeProvider time) {
        this.persistence = persistence;
        this.time = time;
    }

    /** Test-only compatibility constructor; production injects the typed persistence boundary. */
    public PlatformCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this(new PlatformCommandReceiptPersistence(jdbc), time);
    }

    public PlatformAuthenticationService.PlatformAdminReadback execute(
            String key,
            String canonicalRequest,
            Supplier<PlatformAuthenticationService.PlatformAdminReadback> command) {
        if (key == null || key.length() < 16 || key.length() > 128)
            throw new PlatformAuthenticationService.InvalidAdministratorInputException();
        String hash = sha256(canonicalRequest);
        persistence.lock(key);
        PlatformCommandReceiptPersistence.Receipt prior = persistence.find(key).orElse(null);
        if (prior != null) {
            if (!hash.equals(prior.requestHash())) throw new PlatformIdempotencyConflictException();
            PlatformAuthenticationService.PlatformAdminReadback replay = deserialize(prior.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, prior.responseJson())) {
                persistence.upgradeLegacyResponse(serialize(replay), key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            PlatformAuthenticationService.PlatformAdminReadback result = command.get();
            persistence.insert(key, hash, serialize(result), time.currentEpochMillis());
            return result;
        }
    }

    private static String serialize(PlatformAuthenticationService.PlatformAdminReadback value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException("platform receipt serialization failed", failure);
        }
    }

    private static PlatformAuthenticationService.PlatformAdminReadback deserialize(String json) {
        try {
            return JSON.readValue(json, PlatformAuthenticationService.PlatformAdminReadback.class);
        } catch (Exception directFailure) {
            try {
                ObjectNode legacy = LegacyReceiptJson.decode(JSON, json, java.util.Set.of(), java.util.Set.of());
                legacy.set("createdAtEpochMillis", legacy.remove("createdAt"));
                legacy.set("updatedAtEpochMillis", legacy.remove("updatedAt"));
                legacy.set("lastLoginAtEpochMillis", legacy.remove("lastLoginAt"));
                return JSON.treeToValue(legacy, PlatformAuthenticationService.PlatformAdminReadback.class);
            } catch (Exception legacyFailure) {
                legacyFailure.addSuppressed(directFailure);
                throw new PlatformReceiptCorruptException(legacyFailure);
            }
        }
    }

    private static String sha256(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (NullPointerException failure) {
            throw new IllegalStateException(failure);
        }
    }

    public static final class PlatformIdempotencyConflictException extends RuntimeException {}

    public static final class PlatformReceiptCorruptException extends RuntimeException {
        public PlatformReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
