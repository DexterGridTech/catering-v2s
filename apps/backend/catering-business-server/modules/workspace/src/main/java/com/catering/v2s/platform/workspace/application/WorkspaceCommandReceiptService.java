package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Persists the exact terminal owner readback for a required-idempotency workspace command. */
@Service
public final class WorkspaceCommandReceiptService {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public WorkspaceCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public WorkspaceAdministrationReadback execute(String groupWorkspaceKey, String idempotencyKey, String canonicalRequest, Supplier<WorkspaceAdministrationReadback> command) {
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank()) throw new WorkspaceAdministrationService.WorkspaceInputInvalidException();
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(? || ':' || ?))", groupWorkspaceKey, key);
        Receipt existing = jdbc.query("SELECT request_hash, response_json::text FROM platform_workspace.workspace_command_receipt WHERE group_workspace_key=? AND idempotency_key=?", statement -> {
            statement.setString(1, groupWorkspaceKey);
            statement.setString(2, key);
        }, result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null);
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new WorkspaceIdempotencyConflictException();
            return deserialize(existing.responseJson());
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            WorkspaceAdministrationReadback result = command.get();
            if (!groupWorkspaceKey.equals(result.groupWorkspaceKey())) throw new WorkspaceReceiptCorruptException(new IllegalStateException("receipt scope does not match command result"));
            jdbc.update("INSERT INTO platform_workspace.workspace_command_receipt (group_workspace_key, workspace_uuid, idempotency_key, request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, ?)", groupWorkspaceKey, result.workspaceUuid(), key, requestHash, serialize(result), time.currentEpochMillis());
            return result;
        }
    }

    private WorkspaceAdministrationReadback deserialize(String value) {
        try {
            return new WorkspaceAdministrationReadback(UUID.fromString(read(value, "workspaceUuid")), read(value, "groupWorkspaceKey"), read(value, "name"), read(value, "operationsTitle"), nullable(value, "logoAssetRef"), nullable(value, "notes"), read(value, "status"), Long.parseLong(read(value, "statusChangedAtEpochMillis")), Long.parseLong(read(value, "version")), Long.parseLong(read(value, "createdAtEpochMillis")), Long.parseLong(read(value, "updatedAtEpochMillis")), optionalBoolean(value, "commercialGroupInitialized"));
        } catch (RuntimeException exception) { throw new WorkspaceReceiptCorruptException(exception); }
    }
    private String serialize(WorkspaceAdministrationReadback value) {
        return "{" + field("workspaceUuid", value.workspaceUuid().toString()) + "," + field("groupWorkspaceKey", value.groupWorkspaceKey()) + "," + field("name", value.name()) + "," + field("operationsTitle", value.operationsTitle()) + "," + field("logoAssetRef", value.logoAssetRef()) + "," + field("notes", value.notes()) + "," + field("status", value.status()) + "," + field("statusChangedAtEpochMillis", String.valueOf(value.statusChangedAtEpochMillis())) + "," + field("version", String.valueOf(value.version())) + "," + field("createdAtEpochMillis", String.valueOf(value.createdAtEpochMillis())) + "," + field("updatedAtEpochMillis", String.valueOf(value.updatedAtEpochMillis())) + "," + field("commercialGroupInitialized", String.valueOf(value.commercialGroupInitialized())) + "}";
    }
    private static String requiredKey(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new WorkspaceAdministrationService.WorkspaceInputInvalidException(); return value; }
    private static String sha256(String value) { try { return Sha256Hex.digest(value); } catch (NullPointerException exception) { throw new IllegalStateException(exception); } }
    private static String field(String name, String value) { return "\"" + name + "\":\"" + (value == null ? "-" : Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8))) + "\""; }
    private static String read(String json, String name) { String value = encoded(json, name); if ("-".equals(value)) throw new IllegalStateException("missing receipt field: " + name); return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8); }
    private static String nullable(String json, String name) { String value = encoded(json, name); return "-".equals(value) ? null : new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8); }
    private static String encoded(String json, String name) { Matcher matcher = Pattern.compile("\\\"" + Pattern.quote(name) + "\\\":\\\"([^\\\"]*)\\\"").matcher(json); if (!matcher.find()) throw new IllegalStateException("missing receipt field: " + name); return matcher.group(1); }
    private static boolean optionalBoolean(String json, String name) { String value = nullable(json, name); return value != null && Boolean.parseBoolean(value); }

    private record Receipt(String requestHash, String responseJson) { }
    public static final class WorkspaceIdempotencyConflictException extends RuntimeException { }
    public static final class WorkspaceReceiptCorruptException extends RuntimeException { public WorkspaceReceiptCorruptException(Throwable cause) { super(cause); } }
}
