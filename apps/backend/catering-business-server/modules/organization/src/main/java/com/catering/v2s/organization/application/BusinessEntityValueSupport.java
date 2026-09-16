package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditValueState;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.api.ExtensionValueSemantics;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** Pure value helpers shared by the four organization entity command targets. */
final class BusinessEntityValueSupport {
    private static final ObjectMapper JSON = new ObjectMapper();

    private BusinessEntityValueSupport() {}

    static String text(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit)
            throw new BusinessEntityService.OrganizationValidationException();
        return normalized;
    }

    static String optional(String value, int limit) {
        if (value == null || value.isBlank()) return null;
        return text(value, limit);
    }

    static boolean isJsonNull(String value) {
        return value == null || "null".equals(value.trim());
    }

    static boolean validJsonValue(ExtensionDefinitionReadback.Field field, String value) {
        if (isJsonNull(value)) return false;
        try {
            JsonNode json = JSON.readTree(value);
            return switch (field.fieldType()) {
                case "TEXT" -> json.isTextual();
                case "NUMBER" -> json.isNumber();
                case "DATE" -> json.isTextual() && ExtensionValueSemantics.isCanonicalDate(json.asText());
                case "BOOLEAN" -> json.isBoolean();
                case "SELECT" -> json.isTextual() && field.options().contains(json.asText());
                default -> false;
            };
        } catch (java.io.IOException failure) {
            return false;
        }
    }

    static String extensionJson(Map<String, String> values) {
        ObjectNode object = JSON.createObjectNode();
        if (values == null) return object.toString();
        values.forEach((key, rawValue) -> {
            try {
                if (rawValue == null) object.putNull(key);
                else object.set(key, JSON.readTree(rawValue));
            } catch (java.io.IOException failure) {
                throw new BusinessEntityService.OrganizationValidationException(failure);
            }
        });
        return object.toString();
    }

    static List<AuditChange> createdChanges(com.catering.v2s.organization.api.OrganizationEntityReadback value) {
        return List.of(
                new AuditChange("code", null, value.code()),
                new AuditChange("name", null, value.name()),
                new AuditChange("status", null, value.status()));
    }

    static List<AuditChange> changed(
            com.catering.v2s.organization.api.OrganizationEntityReadback before,
            com.catering.v2s.organization.api.OrganizationEntityReadback after) {
        return List.of(
                        new AuditChange("code", before.code(), after.code()),
                        new AuditChange("name", before.name(), after.name()),
                        new AuditChange("status", before.status(), after.status()))
                .stream()
                .filter(change -> !Objects.equals(change.beforeValue(), change.afterValue()))
                .toList();
    }

    static Set<String> extensionKeys(ExtensionDefinitionReadback definition) {
        if (definition == null || definition.fields() == null) return Set.of();
        return definition.fields().stream()
                .map(ExtensionDefinitionReadback.Field::fieldKey)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    static ExtensionDefinitionReadback optionalDefinition(
            ExtensionDefinitionLookup definitions,
            java.util.UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType) {
        try {
            return definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
        } catch (com.catering.v2s.extension.application.ExtensionDefinitionService.DefinitionNotFoundException absent) {
            return null;
        }
    }

    static List<AuditChange> withExtensionChanges(
            List<AuditChange> coreChanges,
            com.catering.v2s.organization.api.OrganizationEntityReadback before,
            com.catering.v2s.organization.api.OrganizationEntityReadback after,
            ExtensionDefinitionReadback definition,
            ExtensionSubmission submission) {
        return java.util.stream.Stream.concat(
                        (coreChanges == null ? List.<AuditChange>of() : coreChanges).stream(),
                        extensionChanges(before, after, definition, submission).stream())
                .toList();
    }

    /**
     * Produces the same typed, labelled extension diff for every organization owner. The definition is the exact
     * definition already used by the command path; arbitrary payload keys never become audit keys.
     */
    static List<AuditChange> extensionChanges(
            com.catering.v2s.organization.api.OrganizationEntityReadback before,
            com.catering.v2s.organization.api.OrganizationEntityReadback after,
            ExtensionDefinitionReadback definition,
            ExtensionSubmission submission) {
        if (definition == null || definition.fields() == null || definition.fields().isEmpty()) return List.of();
        Map<String, ExtensionSubmission.Mode> intent = submission == null
                ? Map.of()
                : submission.fields().stream()
                        .collect(Collectors.toMap(
                                ExtensionSubmission.ExtensionFieldValue::fieldKey,
                                ExtensionSubmission.ExtensionFieldValue::mode,
                                (left, right) -> right));
        Map<String, String> beforeValues = before == null || before.extensionValues() == null
                ? Map.of()
                : before.extensionValues();
        Map<String, String> afterValues = after == null || after.extensionValues() == null
                ? Map.of()
                : after.extensionValues();
        return definition.fields().stream()
                .map(field -> extensionChange(field, beforeValues, afterValues, intent))
                .filter(Objects::nonNull)
                .toList();
    }

    private static AuditChange extensionChange(
            ExtensionDefinitionReadback.Field field,
            Map<String, String> beforeValues,
            Map<String, String> afterValues,
            Map<String, ExtensionSubmission.Mode> intent) {
        String key = field.fieldKey();
        AuditCell before = extensionCell(field, beforeValues, key, false);
        boolean explicitlyCleared = intent.get(key) == ExtensionSubmission.Mode.CLEAR
                && before.state() != AuditValueState.MISSING;
        AuditCell after = extensionCell(field, afterValues, key, explicitlyCleared);
        if (before.sameAs(after)) return null;
        return new AuditChange(
                key,
                field.label(),
                before.state(),
                before.value(),
                after.state(),
                after.value());
    }

    private static AuditCell extensionCell(
            ExtensionDefinitionReadback.Field field,
            Map<String, String> values,
            String key,
            boolean cleared) {
        if (!values.containsKey(key))
            return new AuditCell(cleared ? AuditValueState.CLEARED : AuditValueState.MISSING, null);
        String raw = values.get(key);
        if (isJsonNull(raw)) return new AuditCell(AuditValueState.NULL, null);
        return new AuditCell(AuditValueState.VALUE, displayValue(field, raw));
    }

    private static String displayValue(ExtensionDefinitionReadback.Field field, String raw) {
        try {
            JsonNode json = JSON.readTree(raw);
            return switch (field.fieldType()) {
                case "TEXT", "DATE", "SELECT" -> json.isTextual() ? json.asText() : json.toString();
                case "BOOLEAN" -> json.isBoolean() ? Boolean.toString(json.booleanValue()) : json.toString();
                case "NUMBER" -> json.isNumber() ? canonicalNumber(json) : json.toString();
                default -> json.isValueNode() ? json.asText() : json.toString();
            };
        } catch (java.io.IOException failure) {
            return raw;
        }
    }

    private static String canonicalNumber(JsonNode value) {
        BigDecimal decimal = value.decimalValue().stripTrailingZeros();
        return decimal.scale() < 0 ? decimal.setScale(0).toPlainString() : decimal.toPlainString();
    }

    private record AuditCell(AuditValueState state, String value) {
        private boolean sameAs(AuditCell other) {
            return state == other.state && Objects.equals(value, other.value);
        }
    }

    static String auditJson(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    static String canonical(String operation, Object... values) {
        StringBuilder result = new StringBuilder(operation);
        for (Object value : values) {
            String safe = value instanceof Map<?, ?> map
                    ? map.entrySet().stream()
                            .sorted(Map.Entry.comparingByKey(java.util.Comparator.comparing(String::valueOf)))
                            .map(entry -> String.valueOf(entry.getKey()) + "=" + String.valueOf(entry.getValue()))
                            .collect(java.util.stream.Collectors.joining("\\u001f"))
                    : String.valueOf(value == null ? "<null>" : value);
            result.append('|').append(safe.length()).append(':').append(safe);
        }
        return result.toString();
    }

    static String entityType(String value) {
        String type = Objects.requireNonNullElse(value, "").toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("BRAND", "TENANT", com.catering.v2s.organization.api.BusinessEntityTypes.HEAD_COMPANY)
                .contains(type))
            throw new BusinessEntityService.OrganizationValidationException();
        return type;
    }

    static String table(String type) {
        return switch (type) {
            case "BRAND" -> "brand";
            case "TENANT" -> "tenant";
            case com.catering.v2s.organization.api.BusinessEntityTypes.HEAD_COMPANY -> "head_company";
            case com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE -> "store";
            default -> throw new BusinessEntityService.OrganizationValidationException();
        };
    }

    static void requireMutable(String status) {
        if ("VOIDED".equals(status)) throw new BusinessEntityService.OrganizationConflictException();
    }
}
