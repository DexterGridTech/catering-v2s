package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stores the exact terminal commercial-group readback for a required-idempotency update. */
@Service
public final class CommercialGroupCommandReceiptService {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public CommercialGroupCommandReceiptService(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public CommercialGroupReadback execute(UUID workspaceUuid, String idempotencyKey, String canonicalRequest, Supplier<CommercialGroupReadback> command) {
        String key = requiredKey(idempotencyKey);
        String requestHash = sha256(canonicalRequest);
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(? || ':' || ?))", workspaceUuid.toString(), key);
        Receipt existing = jdbc.query(
            "SELECT request_hash, response_json::text FROM organization.commercial_group_command_receipt WHERE workspace_uuid=? AND idempotency_key=?",
            statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, key); },
            result -> result.next() ? new Receipt(result.getString(1), result.getString(2)) : null
        );
        if (existing != null) {
            if (!requestHash.equals(existing.requestHash())) throw new OrganizationHierarchyCommandReceiptService.OrganizationIdempotencyConflictException();
            return deserialize(existing.responseJson());
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            CommercialGroupReadback result = command.get();
            jdbc.update(
                "INSERT INTO organization.commercial_group_command_receipt (workspace_uuid, idempotency_key, commercial_group_uuid, request_hash, response_json, state, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?::jsonb, 'SUCCEEDED', ?)",
                workspaceUuid, key, result.id(), requestHash, serialize(result), time.currentEpochMillis()
            );
            return result;
        }
    }

    private static CommercialGroupReadback deserialize(String value) {
        try {
            return new CommercialGroupReadback(
                UUID.fromString(read(value, "id")), read(value, "groupWorkspaceKey"), read(value, "commercialGroupCode"), read(value, "commercialGroupName"),
                Long.parseLong(read(value, "revision")), read(value, "createdByPlatformSubject"), Long.parseLong(read(value, "createdAtEpochMillis")), Long.parseLong(read(value, "updatedAtEpochMillis")),
                readMap(value, "extensionValues"), Long.parseLong(read(value, "extensionRuleRevision"))
            );
        } catch (RuntimeException exception) {
            throw new OrganizationHierarchyCommandReceiptService.OrganizationReceiptCorruptException(exception);
        }
    }

    private static String serialize(CommercialGroupReadback value) {
        return "{" + field("id", value.id().toString()) + "," + field("groupWorkspaceKey", value.groupWorkspaceKey()) + ","
            + field("commercialGroupCode", value.commercialGroupCode()) + "," + field("commercialGroupName", value.commercialGroupName()) + ","
            + field("revision", String.valueOf(value.revision())) + "," + field("createdByPlatformSubject", value.createdByPlatformSubject()) + ","
            + field("createdAtEpochMillis", String.valueOf(value.createdAtEpochMillis())) + "," + field("updatedAtEpochMillis", String.valueOf(value.updatedAtEpochMillis())) + ","
            + field("extensionValues", encodeMap(value.extensionValues())) + "," + field("extensionRuleRevision", String.valueOf(value.extensionRuleRevision())) + "}";
    }

    private static String encodeMap(Map<String, String> values) {
        return values.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(entry ->
            Base64.getEncoder().encodeToString(entry.getKey().getBytes(StandardCharsets.UTF_8)) + ":" + Base64.getEncoder().encodeToString(entry.getValue().getBytes(StandardCharsets.UTF_8))
        ).reduce((left, right) -> left + "," + right).orElse("");
    }

    private static Map<String, String> readMap(String json, String name) {
        String encoded = read(json, name);
        if (encoded.isEmpty()) return Map.of();
        Map<String, String> values = new java.util.LinkedHashMap<>();
        for (String part : encoded.split(",", -1)) {
            String[] pair = part.split(":", -1);
            if (pair.length != 2 || values.put(new String(Base64.getDecoder().decode(pair[0]), StandardCharsets.UTF_8), new String(Base64.getDecoder().decode(pair[1]), StandardCharsets.UTF_8)) != null) throw new IllegalStateException("invalid commercial-group receipt");
        }
        return Map.copyOf(values);
    }

    private static String requiredKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128) throw new OrganizationHierarchyService.OrganizationValidationException();
        return value;
    }

    private static String sha256(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String field(String name, String value) {
        return "\"" + name + "\":\"" + Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8)) + "\"";
    }

    private static String read(String json, String name) {
        Matcher matcher = stringField(name).matcher(json);
        if (!matcher.find()) throw new IllegalStateException("missing receipt field");
        return new String(Base64.getDecoder().decode(matcher.group(1)), StandardCharsets.UTF_8);
    }

    private static Pattern stringField(String name) {
        return Pattern.compile("\\\"" + Pattern.quote(name) + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    }

    private record Receipt(String requestHash, String responseJson) { }
}
