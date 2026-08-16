package com.catering.v2s.platform.iam.application;

import com.catering.v2s.platform.foundation.json.LegacyReceiptJson;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-local receipt for platform-admin mutations; persisted snapshots avoid a later read changing a replay. */
@Service
public final class PlatformCommandReceiptService {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public PlatformCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public PlatformAuthenticationService.PlatformAdminReadback execute(
            String key,
            String canonicalRequest,
            Supplier<PlatformAuthenticationService.PlatformAdminReadback> command) {
        if (key == null || key.length() < 16 || key.length() > 128)
            throw new PlatformAuthenticationService.InvalidAdministratorInputException();
        String hash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", key);
        Receipt prior = jdbc.query(
                "SELECT request_hash, response_json::text FROM platform_iam.platform_command_receipt WHERE "
                        + "idempotency_key=?",
                statement -> statement.setString(1, key),
                result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (prior != null) {
            if (!hash.equals(prior.requestHash())) throw new PlatformIdempotencyConflictException();
            PlatformAuthenticationService.PlatformAdminReadback replay = deserialize(prior.responseJson());
            if (LegacyReceiptJson.looksLikeLegacy(JSON, prior.responseJson())) {
                jdbc.update(
                        "UPDATE platform_iam.platform_command_receipt SET response_json=?::jsonb WHERE "
                                + "idempotency_key=?",
                        serialize(replay),
                        key);
            }
            return replay;
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            PlatformAuthenticationService.PlatformAdminReadback result = command.get();
            jdbc.update(
                    "INSERT INTO platform_iam.platform_command_receipt (idempotency_key, request_hash, response_json, "
                            + "created_at_epoch_millis) VALUES (?, ?, ?::jsonb, ?)",
                    key,
                    hash,
                    serialize(result),
                    time.currentEpochMillis());
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

    private record Receipt(String requestHash, String responseJson) {}

    public static final class PlatformIdempotencyConflictException extends RuntimeException {}

    public static final class PlatformReceiptCorruptException extends RuntimeException {
        public PlatformReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }
}
