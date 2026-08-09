package com.catering.v2s.platform.iam.application;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-local receipt for platform-admin mutations; persisted snapshots avoid a later read changing a replay. */
@Service
public final class PlatformCommandReceiptService {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    public PlatformCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) { this.jdbc = jdbc; this.time = time; }
    public PlatformAuthenticationService.PlatformAdminReadback execute(String key, String canonicalRequest, Supplier<PlatformAuthenticationService.PlatformAdminReadback> command) {
        if (key == null || key.length() < 16 || key.length() > 128) throw new PlatformAuthenticationService.InvalidAdministratorInputException();
        String hash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", key);
        Receipt prior = jdbc.query("SELECT request_hash, response_json::text FROM platform_iam.platform_command_receipt WHERE idempotency_key=?", statement -> statement.setString(1, key), result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (prior != null) { if (!hash.equals(prior.requestHash())) throw new PlatformIdempotencyConflictException(); return deserialize(prior.responseJson()); }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            PlatformAuthenticationService.PlatformAdminReadback result = command.get();
            jdbc.update("INSERT INTO platform_iam.platform_command_receipt (idempotency_key, request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?::jsonb, ?)", key, hash, serialize(result), time.currentEpochMillis());
            return result;
        }
    }
    private static String serialize(PlatformAuthenticationService.PlatformAdminReadback value) { return "{" + field("id", value.id().toString()) + "," + field("loginName", value.loginName()) + "," + field("displayName", value.displayName()) + "," + field("mobile", value.mobile()) + "," + field("status", value.status()) + "," + field("builtIn", String.valueOf(value.builtIn())) + "," + field("version", String.valueOf(value.version())) + "," + field("createdAt", String.valueOf(value.createdAtEpochMillis())) + "," + field("updatedAt", String.valueOf(value.updatedAtEpochMillis())) + "," + field("lastLoginAt", value.lastLoginAtEpochMillis() == null ? null : String.valueOf(value.lastLoginAtEpochMillis())) + "," + field("auditSummary", value.auditSummary()) + "}"; }
    private static PlatformAuthenticationService.PlatformAdminReadback deserialize(String json) { try { return new PlatformAuthenticationService.PlatformAdminReadback(UUID.fromString(read(json, "id")), read(json, "loginName"), read(json, "displayName"), nullable(json, "mobile"), read(json, "status"), Boolean.parseBoolean(optionalRead(json, "builtIn", "false")), Long.parseLong(read(json, "version")), Long.parseLong(read(json, "createdAt")), Long.parseLong(read(json, "updatedAt")), nullable(json, "lastLoginAt") == null ? null : Long.valueOf(read(json, "lastLoginAt")), read(json, "auditSummary")); } catch (RuntimeException failure) { throw new PlatformReceiptCorruptException(failure); } }
    private static String field(String name, String value) { return "\"" + name + "\":\"" + (value == null ? "-" : Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8))) + "\""; }
    private static String read(String json, String name) { String value = encoded(json, name); if ("-".equals(value)) throw new IllegalStateException("missing receipt field"); return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8); }
    private static String nullable(String json, String name) { String value = encoded(json, name); return "-".equals(value) ? null : new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8); }
    private static String optionalRead(String json, String name, String fallback) { Matcher match = Pattern.compile("\\\"" + Pattern.quote(name) + "\\\":\\\"([^\\\"]*)\\\"").matcher(json); return match.find() ? new String(Base64.getDecoder().decode(match.group(1)), StandardCharsets.UTF_8) : fallback; }
    private static String encoded(String json, String name) { Matcher match = Pattern.compile("\\\"" + Pattern.quote(name) + "\\\":\\\"([^\\\"]*)\\\"").matcher(json); if (!match.find()) throw new IllegalStateException("missing receipt field"); return match.group(1); }
    private static String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }
    private record Receipt(String requestHash, String responseJson) { }
    public static final class PlatformIdempotencyConflictException extends RuntimeException { }
    public static final class PlatformReceiptCorruptException extends RuntimeException { public PlatformReceiptCorruptException(Throwable cause) { super(cause); } }
}
