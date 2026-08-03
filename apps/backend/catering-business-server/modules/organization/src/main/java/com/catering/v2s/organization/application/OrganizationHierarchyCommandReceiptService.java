package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stores the exact terminal hierarchy readback for each required-idempotency owner command. */
@Service
public final class OrganizationHierarchyCommandReceiptService {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public OrganizationHierarchyCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public OrganizationNodeReadback execute(UUID workspaceUuid, String idempotencyKey, String canonicalRequest, Supplier<OrganizationNodeReadback> command) {
        if (workspaceUuid == null) throw new OrganizationHierarchyService.OrganizationValidationException();
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(? || ':' || ?))", workspaceUuid.toString(), key);
        Receipt existing = jdbc.query(
            "SELECT request_hash, response_json::text FROM organization.organization_command_receipt WHERE workspace_uuid=? AND idempotency_key=?",
            statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); },
            result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null
        );
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new OrganizationIdempotencyConflictException();
            return deserialize(existing.responseJson());
        }
        OrganizationNodeReadback result = command.get();
        jdbc.update(
            "INSERT INTO organization.organization_command_receipt (workspace_uuid, idempotency_key, entity_id, request_hash, response_json, state, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, 'SUCCEEDED', ?)",
            workspaceUuid, key, result.id(), requestHash, serialize(result), time.currentEpochMillis()
        );
        return result;
    }

    private static OrganizationNodeReadback deserialize(String value) {
        try {
            return new OrganizationNodeReadback(
                UUID.fromString(read(value, "id")),
                UUID.fromString(read(value, "workspaceUuid")),
                read(value, "groupWorkspaceKey"),
                nullableUuid(value, "parentId"),
                read(value, "nodeType"),
                read(value, "code"),
                read(value, "name"),
                nullable(value, "notes"),
                read(value, "status"),
                Long.parseLong(read(value, "version")),
                Long.parseLong(read(value, "createdAtEpochMillis")),
                Long.parseLong(read(value, "updatedAtEpochMillis")),
                readList(value, "phaseNames"),
                readMap(value, "extensionValues"),
                Long.parseLong(optional(value, "extensionRuleRevision", "0"))
            );
        } catch (RuntimeException exception) {
            throw new OrganizationReceiptCorruptException(exception);
        }
    }

    private static String serialize(OrganizationNodeReadback value) {
        return "{" + field("id", value.id().toString()) + "," + field("workspaceUuid", value.workspaceUuid().toString()) + ","
            + field("groupWorkspaceKey", value.groupWorkspaceKey()) + "," + field("parentId", value.parentId() == null ? null : value.parentId().toString()) + ","
            + field("nodeType", value.nodeType()) + "," + field("code", value.code()) + "," + field("name", value.name()) + ","
            + field("notes", value.notes()) + "," + field("status", value.status()) + "," + field("version", String.valueOf(value.version())) + ","
            + field("createdAtEpochMillis", String.valueOf(value.createdAtEpochMillis())) + "," + field("updatedAtEpochMillis", String.valueOf(value.updatedAtEpochMillis())) + ","
            + field("phaseNames", encodeList(value.phaseNames())) + "," + field("extensionValues", encodeMap(value.extensionValues())) + ","
            + field("extensionRuleRevision", String.valueOf(value.extensionRuleRevision())) + "}";
    }

    private static String encodeList(List<String> values) {
        return String.join(",", values.stream().map(value -> Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8))).toList());
    }

    private static List<String> readList(String json, String name) {
        String encoded = read(json, name);
        if (encoded.isEmpty()) return List.of();
        List<String> values = new ArrayList<>();
        for (String part : encoded.split(",", -1)) values.add(new String(Base64.getDecoder().decode(part), StandardCharsets.UTF_8));
        return List.copyOf(values);
    }

    private static String encodeMap(Map<String, String> values) {
        return values.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(entry ->
            Base64.getEncoder().encodeToString(entry.getKey().getBytes(StandardCharsets.UTF_8)) + ":" + Base64.getEncoder().encodeToString(entry.getValue().getBytes(StandardCharsets.UTF_8))
        ).reduce((left, right) -> left + "," + right).orElse("");
    }

    private static Map<String, String> readMap(String json, String name) {
        String encoded = optional(json, name, "");
        if (encoded.isEmpty()) return Map.of();
        Map<String, String> values = new java.util.LinkedHashMap<>();
        for (String part : encoded.split(",", -1)) {
            String[] pair = part.split(":", -1);
            if (pair.length != 2 || values.put(new String(Base64.getDecoder().decode(pair[0]), StandardCharsets.UTF_8), new String(Base64.getDecoder().decode(pair[1]), StandardCharsets.UTF_8)) != null) throw new IllegalStateException("invalid extension receipt");
        }
        return Map.copyOf(values);
    }

    private static String requiredKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128) throw new OrganizationHierarchyService.OrganizationValidationException();
        return value;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String field(String name, String value) {
        return "\"" + name + "\":\"" + (value == null ? "-" : Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8))) + "\"";
    }

    private static String read(String json, String name) {
        Matcher matcher = stringField(name).matcher(json);
        if (!matcher.find() || "-".equals(matcher.group(1))) throw new IllegalStateException("missing receipt field");
        return new String(Base64.getDecoder().decode(matcher.group(1)), StandardCharsets.UTF_8);
    }

    private static String nullable(String json, String name) {
        Matcher matcher = stringField(name).matcher(json);
        if (!matcher.find() || "-".equals(matcher.group(1))) return null;
        return new String(Base64.getDecoder().decode(matcher.group(1)), StandardCharsets.UTF_8);
    }

    private static String optional(String json, String name, String fallback) {
        Matcher matcher = stringField(name).matcher(json);
        return matcher.find() ? new String(Base64.getDecoder().decode(matcher.group(1)), StandardCharsets.UTF_8) : fallback;
    }

    /** PostgreSQL jsonb canonical text inserts whitespace around separators. */
    private static Pattern stringField(String name) {
        return Pattern.compile("\\\"" + Pattern.quote(name) + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    }

    private static UUID nullableUuid(String json, String name) {
        String value = nullable(json, name);
        return value == null ? null : UUID.fromString(value);
    }

    private record Receipt(String requestHash, String responseJson) { }

    public static final class OrganizationIdempotencyConflictException extends RuntimeException { }
    public static final class OrganizationReceiptCorruptException extends RuntimeException {
        public OrganizationReceiptCorruptException(Throwable cause) { super(cause); }
    }
}
