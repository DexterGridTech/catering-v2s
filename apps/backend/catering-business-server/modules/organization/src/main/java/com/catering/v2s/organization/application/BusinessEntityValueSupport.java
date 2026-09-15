package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionValueSemantics;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

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
