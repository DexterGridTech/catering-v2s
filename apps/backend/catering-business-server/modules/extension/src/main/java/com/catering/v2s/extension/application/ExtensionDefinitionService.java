package com.catering.v2s.extension.application;

import com.catering.v2s.extension.api.ExtensionHostTypes;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExtensionDefinitionService implements ExtensionDefinitionLookup {
    private static final List<String> MANAGEMENT_HOST_TYPES = List.of(ExtensionHostTypes.BRAND, ExtensionHostTypes.TENANT, ExtensionHostTypes.HEAD_COMPANY, ExtensionHostTypes.STORE, ExtensionHostTypes.CONTRACT, ExtensionHostTypes.COMMERCIAL_GROUP, ExtensionHostTypes.REGION, ExtensionHostTypes.PROJECT);
    private static final Set<String> HOST_TYPES = Set.copyOf(MANAGEMENT_HOST_TYPES);
    private static final Set<String> AUDIT_FIELDS = Set.of("fieldDefinitions", "revision");
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final ExtensionCommandReceiptService receipts;
    private final PlatformGovernanceAuthorization platformAuthorization;
    /**
     * Convenience construction is retained for internal readers only. It must never make the
     * edge-facing draft command authorization-optional outside the Spring owner graph.
     */
    public ExtensionDefinitionService(JdbcTemplate jdbc, TimeProvider time) {
        this(jdbc, time, new ExtensionCommandReceiptService(jdbc, time), actor -> {
            throw new IllegalStateException("platform authorization is required");
        });
    }
    @org.springframework.beans.factory.annotation.Autowired
    public ExtensionDefinitionService(JdbcTemplate jdbc, TimeProvider time, ExtensionCommandReceiptService receipts, PlatformGovernanceAuthorization platformAuthorization) { this.jdbc = jdbc; this.time = time; this.receipts = receipts; this.platformAuthorization = platformAuthorization; }

    @Override @Transactional(readOnly = true, noRollbackFor = DefinitionNotFoundException.class)
    public ExtensionDefinitionReadback requireDefinition(UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        validateHost(hostType);
        return jdbc.query("SELECT definitions::text, revision, updated_at_epoch_millis FROM extension.extension_definition WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=?", statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, groupWorkspaceKey); statement.setString(3, hostType); }, result -> {
            if (!result.next()) throw new DefinitionNotFoundException();
            return new ExtensionDefinitionReadback(groupWorkspaceKey, hostType, result.getLong(2), result.getLong(3), readFields(result.getString(1)));
        });
    }

    @Transactional(readOnly = true)
    public List<ExtensionDefinitionReadback> listDefinitions(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
            "SELECT entity_type, definitions::text, revision, updated_at_epoch_millis FROM extension.extension_definition WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY entity_type",
            (row, index) -> new ExtensionDefinitionReadback(
                groupWorkspaceKey, row.getString(1), row.getLong(3), row.getLong(4), readFields(row.getString(2))
            ),
            workspaceUuid,
            groupWorkspaceKey
        );
    }

    /**
     * Platform configuration is available for every supported business object before its first
     * persisted field definition. This management read deliberately differs from the strict
     * lookup used by operations writes: an unconfigured object has revision zero, not an active
     * empty definition.
     */
    @Transactional(readOnly = true)
    public List<ExtensionDefinitionReadback> listManagementDefinitions(UUID workspaceUuid, String groupWorkspaceKey) {
        java.util.Map<String, ExtensionDefinitionReadback> configured = listDefinitions(workspaceUuid, groupWorkspaceKey).stream()
            .collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback::hostType, value -> value));
        return MANAGEMENT_HOST_TYPES.stream().map(hostType -> configured.getOrDefault(hostType, unconfigured(groupWorkspaceKey, hostType))).toList();
    }

    /** See {@link #listManagementDefinitions(UUID, String)}; this must not replace strict owner lookup. */
    @Transactional(readOnly = true)
    public ExtensionDefinitionReadback managementDefinition(UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        validateHost(hostType);
        try { return requireDefinition(workspaceUuid, groupWorkspaceKey, hostType); }
        catch (DefinitionNotFoundException absent) { return unconfigured(groupWorkspaceKey, hostType); }
    }

    private static ExtensionDefinitionReadback unconfigured(String groupWorkspaceKey, String hostType) {
        return new ExtensionDefinitionReadback(groupWorkspaceKey, hostType, 0, 0, List.of());
    }

    @Transactional
    public ExtensionDefinitionReadback replace(UUID workspaceUuid, String groupWorkspaceKey, String hostType, long expectedVersion, List<Field> fields) {
        return replace(workspaceUuid, groupWorkspaceKey, hostType, expectedVersion, fields, AuditActor.system());
    }
    @Transactional
    public ExtensionDefinitionReadback replace(UUID workspaceUuid, String groupWorkspaceKey, String hostType, long expectedVersion, List<Field> fields, AuditActor actor) {
        validateHost(hostType);
        List<Field> normalized = normalize(fields);
        Long existing = jdbc.query("SELECT revision FROM extension.extension_definition WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=?", statement -> { statement.setObject(1, workspaceUuid); statement.setString(2, groupWorkspaceKey); statement.setString(3, hostType); }, result -> result.next() ? result.getLong(1) : null);
        List<ExtensionDefinitionReadback.Field> beforeFields = existing == null ? List.of() : requireDefinition(workspaceUuid, groupWorkspaceKey, hostType).fields();
        long nextVersion;
        long now = time.currentEpochMillis();
        if (existing == null) {
            if (expectedVersion != 0) throw new DefinitionVersionConflictException();
            nextVersion = 1;
            jdbc.update("INSERT INTO extension.extension_definition (workspace_uuid, group_workspace_key, entity_type, definitions, revision, updated_at_epoch_millis) VALUES (?, ?, ?, CAST(? AS JSONB), 1, ?)", workspaceUuid, groupWorkspaceKey, hostType, json(normalized), now);
        } else {
            if (existing != expectedVersion) throw new DefinitionVersionConflictException();
            java.util.Map<String, String> existingTypes = requireDefinition(workspaceUuid, groupWorkspaceKey, hostType).fields().stream().collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, ExtensionDefinitionReadback.Field::fieldType));
            if (normalized.stream().anyMatch(field -> existingTypes.containsKey(field.fieldKey()) && !existingTypes.get(field.fieldKey()).equals(field.fieldType()))) throw new DefinitionInvalidException();
            nextVersion = expectedVersion + 1;
            jdbc.update("UPDATE extension.extension_definition SET definitions=CAST(? AS JSONB), revision=?, updated_at_epoch_millis=? WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type=?", json(normalized), nextVersion, now, workspaceUuid, groupWorkspaceKey, hostType);
        }
        audit(workspaceUuid, groupWorkspaceKey, hostType, existing, nextVersion, beforeFields, normalized, actor); return requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
    }
    @Transactional
    public ExtensionDefinitionReadback replace(UUID workspaceUuid, String groupWorkspaceKey, String hostType, long expectedVersion, List<Field> fields, AuditActor actor, String idempotencyKey) {
        List<Field> normalized = normalize(fields);
        return receipts.execute(idempotencyKey, workspaceUuid, groupWorkspaceKey, hostType, hostType + "|" + expectedVersion + "|" + json(normalized), () -> replace(workspaceUuid, groupWorkspaceKey, hostType, expectedVersion, normalized, actor));
    }
    /**
     * Edge-facing whole-group replacement. Every key is an administrator-defined, stable entity
     * value anchor. Existing keys are preserved by the UI, while a newly added field must supply
     * its own valid key; this owner never silently renames or randomly allocates one.
     */
    @Transactional
    public ExtensionDefinitionReadback replaceDraft(UUID workspaceUuid, String groupWorkspaceKey, String hostType, long expectedVersion, List<DraftField> fields, AuditActor actor, String idempotencyKey) {
        platformAuthorization.requireEnabledPlatformAdministrator(actor);
        validateHost(hostType);
        if (fields == null || fields.stream().anyMatch(java.util.Objects::isNull)) throw new DefinitionInvalidException();
        return receipts.execute(idempotencyKey, workspaceUuid, groupWorkspaceKey, hostType, draftRequest(hostType, expectedVersion, fields), () -> {
            List<Field> ownerFields = new java.util.ArrayList<>();
            for (int index = 0; index < fields.size(); index++) {
                DraftField field = fields.get(index);
                String key = field.fieldKey();
                if (key == null || key.isBlank()) throw new DefinitionInvalidException();
                ownerFields.add(new Field(key, field.label(), field.fieldType(), field.required(), field.options(), field.status(), field.displayOrder(), field.displaySuffix()));
            }
            return replace(workspaceUuid, groupWorkspaceKey, hostType, expectedVersion, ownerFields, actor);
        });
    }
    private static String draftRequest(String hostType, long expectedVersion, List<DraftField> fields) {
        StringBuilder value = new StringBuilder();
        requestPart(value, hostType); requestPart(value, expectedVersion); requestPart(value, fields.size());
        for (DraftField field : fields) {
            requestPart(value, field.fieldKey()); requestPart(value, field.label()); requestPart(value, field.fieldType()); requestPart(value, field.required());
            if (field.options() == null) requestPart(value, null);
            else { requestPart(value, field.options().size()); for (String option : field.options()) requestPart(value, option); }
            requestPart(value, field.status()); requestPart(value, field.displayOrder()); requestPart(value, field.displaySuffix());
        }
        return value.toString();
    }
    private static void requestPart(StringBuilder value, Object part) {
        if (part == null) { value.append("-1:"); return; }
        String text = String.valueOf(part); value.append(text.length()).append(':').append(text);
    }
    private void audit(UUID workspaceUuid, String groupWorkspaceKey, String hostType, Long previousRevision, long revision, List<ExtensionDefinitionReadback.Field> before, List<Field> after, AuditActor actor) { AuditChangePolicy policy = new AuditChangePolicy("EXTENSION_DEFINITION", "EXTENSION_DEFINITION_REPLACED", AUDIT_FIELDS); List<AuditChange> changes = List.of(new AuditChange("fieldDefinitions", summarize(before), summarize(after)), new AuditChange("revision", previousRevision == null ? null : previousRevision.toString(), String.valueOf(revision))).stream().filter(change -> !Objects.equals(change.beforeValue(), change.afterValue())).toList(); jdbc.update("INSERT INTO extension.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'EXTENSION_DEFINITION', ?, ?, ?, ?, 'EXTENSION_DEFINITION_REPLACED', ?, CAST(? AS JSONB))", UUID.randomUUID(), workspaceUuid, groupWorkspaceKey, hostType, actor.actorType(), actor.actorId(), actor.displaySnapshot(), time.currentEpochMillis(), auditJson(policy.allow(changes))); }
    private static String summarize(List<?> fields) { return fields.stream().map(ExtensionDefinitionService::describe).sorted().reduce((left, right) -> left + ";" + right).orElse(""); }
    private static String describe(Object value) { if (value instanceof Field field) return field.fieldKey() + "|" + field.label() + "|" + field.fieldType() + "|" + field.required(); if (value instanceof ExtensionDefinitionReadback.Field field) return field.fieldKey() + "|" + field.label() + "|" + field.fieldType() + "|" + field.required(); throw new IllegalArgumentException("unknown extension field"); }
    private static String auditJson(List<AuditChange> changes) { return AuditChangeJson.write(changes); }
    private static void validateHost(String value) { if (!HOST_TYPES.contains(value)) throw new DefinitionInvalidException(); }
    private static List<Field> normalize(List<Field> fields) {
        if (fields == null || fields.stream().anyMatch(java.util.Objects::isNull) || fields.stream().map(Field::fieldKey).distinct().count() != fields.size()) throw new DefinitionInvalidException();
        java.util.ArrayList<Field> normalized = new java.util.ArrayList<>();
        for (int index = 0; index < fields.size(); index++) {
            Field field = fields.get(index);
            String key = field.fieldKey(); String label = field.label() == null ? null : field.label().trim(); String type = field.fieldType();
            List<String> options = field.options() == null ? List.of() : field.options().stream().map(value -> value == null ? null : value.trim()).toList();
            String status = field.status() == null ? "ENABLED" : field.status(); int order = field.displayOrder() == null ? index : field.displayOrder();
            String suffix = field.displaySuffix() == null || field.displaySuffix().isBlank() ? null : field.displaySuffix().trim();
            if (key == null || !key.matches("[a-z][A-Za-z0-9_]{0,79}") || label == null || label.isEmpty() || label.length() > 120 || !Set.of("TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT").contains(type) || !Set.of("ENABLED", "DISABLED").contains(status) || order < 0 || (suffix != null && suffix.length() > 20) || options.stream().anyMatch(value -> value == null || value.isEmpty() || value.length() > 120) || options.stream().distinct().count() != options.size() || ("SELECT".equals(type) && options.isEmpty()) || (!"SELECT".equals(type) && !options.isEmpty())) throw new DefinitionInvalidException();
            normalized.add(new Field(key, label, type, field.required(), List.copyOf(options), status, order, suffix));
        }
        if (normalized.stream().map(Field::displayOrder).distinct().count() != normalized.size()) throw new DefinitionInvalidException();
        normalized.sort(java.util.Comparator.comparingInt(Field::displayOrder));
        return List.copyOf(normalized);
    }
    public record Field(String fieldKey, String label, String fieldType, boolean required, List<String> options, String status, Integer displayOrder, String displaySuffix) { }
    public record DraftField(String fieldKey, String label, String fieldType, boolean required, List<String> options, String status, Integer displayOrder, String displaySuffix) { }
    private static String json(List<Field> fields) {
        ArrayNode values = JSON.createArrayNode();
        for (Field field : fields) {
            var node = values.addObject();
            node.put("key", field.fieldKey()); node.put("label", field.label()); node.put("type", field.fieldType()); node.put("required", field.required());
            node.putPOJO("options", field.options()); node.put("status", field.status()); node.put("displayOrder", field.displayOrder());
            if (field.displaySuffix() != null) node.put("displaySuffix", field.displaySuffix());
        }
        return values.toString();
    }
    /**
     * Applies the common extension-field semantics without taking ownership of a business
     * record. The calling business owner persists the returned JSON in its own transaction.
     */
    public static String mergeValues(ExtensionDefinitionReadback definition, String currentValuesJson, Map<String, String> requestedValues) {
        if (definition == null) throw new DefinitionInvalidException();
        ObjectNode merged;
        try {
            JsonNode parsed = JSON.readTree(currentValuesJson == null ? "{}" : currentValuesJson);
            if (!parsed.isObject()) throw new DefinitionInvalidException();
            merged = (ObjectNode) parsed;
        } catch (java.io.IOException failure) {
            throw new DefinitionInvalidException();
        }
        Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream()
            .collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, field -> field));
        Map<String, String> requested = requestedValues == null ? Map.of() : requestedValues;
        for (Map.Entry<String, String> entry : requested.entrySet()) {
            ExtensionDefinitionReadback.Field field = fields.get(entry.getKey());
            if (field == null) throw new DefinitionInvalidException();
            if ("DISABLED".equals(field.status())) continue;
            if (isJsonNull(entry.getValue())) {
                merged.remove(entry.getKey());
                continue;
            }
            if (!validJsonValue(field, entry.getValue())) throw new DefinitionInvalidException();
            try { merged.set(entry.getKey(), JSON.readTree(entry.getValue())); }
            catch (java.io.IOException failure) { throw new DefinitionInvalidException(); }
        }
        if (fields.values().stream().filter(field -> "ENABLED".equals(field.status()) && field.required())
            .anyMatch(field -> !merged.hasNonNull(field.fieldKey()) || !validJsonValue(field, merged.get(field.fieldKey()).toString()))) {
            throw new DefinitionInvalidException();
        }
        return merged.toString();
    }

    /** Decodes the durable JSON object into the owner readback representation. */
    public static Map<String, String> readValues(String source) {
        try {
            JsonNode parsed = JSON.readTree(source == null ? "{}" : source);
            if (!parsed.isObject()) throw new DefinitionInvalidException();
            Map<String, String> values = new LinkedHashMap<>();
            parsed.fields().forEachRemaining(entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return Map.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new DefinitionInvalidException();
        }
    }
    private static List<ExtensionDefinitionReadback.Field> readFields(String source) {
        try {
            JsonNode values = JSON.readTree(source); if (!values.isArray()) throw new DefinitionInvalidException();
            java.util.ArrayList<ExtensionDefinitionReadback.Field> fields = new java.util.ArrayList<>();
            for (JsonNode value : values) {
                if (!value.isObject()) throw new DefinitionInvalidException();
                List<String> options = new java.util.ArrayList<>();
                if (!value.path("options").isArray()) throw new DefinitionInvalidException();
                value.path("options").forEach(option -> options.add(option.asText()));
                fields.add(new ExtensionDefinitionReadback.Field(value.path("key").asText(), value.path("label").asText(), value.path("type").asText(), value.path("required").asBoolean(), List.copyOf(options), value.path("status").asText("ENABLED"), value.path("displayOrder").asInt(), value.path("displaySuffix").isMissingNode() || value.path("displaySuffix").isNull() ? null : value.path("displaySuffix").asText()));
            }
            return List.copyOf(fields);
        } catch (java.io.IOException failure) { throw new DefinitionInvalidException(); }
    }
    private static boolean isJsonNull(String value) { return value == null || "null".equals(value.trim()); }
    private static boolean validJsonValue(ExtensionDefinitionReadback.Field field, String value) {
        if (isJsonNull(value)) return false;
        try {
            JsonNode json = JSON.readTree(value);
            return switch (field.fieldType()) {
                case "TEXT" -> json.isTextual();
                case "NUMBER" -> json.isNumber();
                case "DATE" -> json.isTextual() && json.asText().matches("\\d{4}-\\d{2}-\\d{2}");
                case "BOOLEAN" -> json.isBoolean();
                case "SELECT" -> json.isTextual() && field.options().contains(json.asText());
                default -> false;
            };
        } catch (java.io.IOException failure) { return false; }
    }
    public static final class DefinitionNotFoundException extends RuntimeException { }
    public static final class DefinitionVersionConflictException extends RuntimeException { }
    public static final class DefinitionInvalidException extends RuntimeException { }
}
