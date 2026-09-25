package com.catering.v2s.extension.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * The single owner-side boundary for the extension filter query parameter. It deliberately returns SQL fragments only
 * after the wire shape, definition revision, definition semantics, and typed value have all been validated.
 */
public final class ExtensionFilterQuery {
    public static final int MAX_ENCODED_LENGTH = 16_384;
    public static final int MAX_RAW_FILTERS = 64;
    public static final int MAX_VALUE_LENGTH = 2_000;
    private static final Set<String> FILTER_KEYS = Set.of("fieldKey", "type", "value");
    private static final Set<String> TYPES = Set.of("TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT");
    private static final ObjectMapper JSON = new ObjectMapper();

    private ExtensionFilterQuery() {}

    /**
     * Parses and validates one request. No definition lookup occurs until all raw wire checks and revision checks pass;
     * an absent or empty array returns without looking up a definition.
     */
    public static Prepared prepare(
            ExtensionDefinitionLookup definitions,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            String encodedFilters,
            String revisionText) {
        List<RawFilter> raw = parseWire(encodedFilters);
        if (raw.isEmpty()) return Prepared.empty();

        Long requestedRevision = parseRevision(revisionText);
        if (requestedRevision == null) {
            throw invalid(List.of(new InvalidReason(null, "DEFINITION_REVISION_REQUIRED", null)));
        }
        ExtensionDefinitionReadback definition =
                definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
        if (definition.version() != requestedRevision) {
            throw new DefinitionRevisionStaleException(definition.version());
        }
        return validateAndBuild(definition, raw);
    }

    /** Validates only the raw wire shape. This is useful for unit tests and preserves the lookup ordering contract. */
    public static List<RawFilter> parseWire(String encodedFilters) {
        if (encodedFilters == null) return List.of();
        if (encodedFilters.length() > MAX_ENCODED_LENGTH) {
            throw invalid(List.of(new InvalidReason(null, "QUERY_TOO_LONG", null)));
        }
        if (encodedFilters.isBlank()) {
            throw invalid(List.of(new InvalidReason(null, "JSON_INVALID", null)));
        }
        String decoded;
        try {
            decoded = encodedFilters.trim().startsWith("[")
                    ? encodedFilters.trim()
                    : URLDecoder.decode(encodedFilters, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException failure) {
            throw invalid(List.of(new InvalidReason(null, "PERCENT_DECODE_INVALID", null)), failure);
        }
        try {
            JsonNode array = JSON.readTree(decoded);
            if (array == null || !array.isArray()) {
                throw invalid(List.of(new InvalidReason(null, "TOP_LEVEL_ARRAY_REQUIRED", null)));
            }
            if (array.size() > MAX_RAW_FILTERS) {
                throw invalid(List.of(new InvalidReason(null, "TOO_MANY_FILTERS", null)));
            }
            List<RawFilter> filters = new ArrayList<>();
            List<InvalidReason> reasons = new ArrayList<>();
            for (JsonNode item : array) {
                if (item == null || !item.isObject()) {
                    reasons.add(new InvalidReason(null, "ITEM_OBJECT_REQUIRED", null));
                    continue;
                }
                Set<String> names = new HashSet<>();
                item.fieldNames().forEachRemaining(names::add);
                if (!names.equals(FILTER_KEYS)) {
                    reasons.add(new InvalidReason(textOrNull(item.get("fieldKey"), null), "ITEM_SHAPE_INVALID", null));
                    continue;
                }
                JsonNode fieldKey = item.get("fieldKey");
                JsonNode type = item.get("type");
                JsonNode value = item.get("value");
                if (!fieldKey.isTextual() || fieldKey.asText().isBlank()) {
                    reasons.add(new InvalidReason(textOrNull(fieldKey, null), "FIELD_KEY_INVALID", null));
                    continue;
                }
                if (!type.isTextual() || !TYPES.contains(type.asText())) {
                    reasons.add(new InvalidReason(fieldKey.asText(), "TYPE_INVALID", null));
                    continue;
                }
                if (!value.isTextual()
                        || value.asText().isBlank()
                        || value.asText().length() > MAX_VALUE_LENGTH) {
                    reasons.add(new InvalidReason(fieldKey.asText(), "VALUE_INVALID", type.asText()));
                    continue;
                }
                filters.add(new RawFilter(fieldKey.asText(), type.asText(), value.asText()));
            }
            if (!reasons.isEmpty()) throw invalid(reasons);
            return List.copyOf(filters);
        } catch (InvalidFilterException failure) {
            throw failure;
        } catch (Exception failure) {
            throw invalid(List.of(new InvalidReason(null, "JSON_INVALID", null)), failure);
        }
    }

    public static Long parseRevision(String value) {
        if (value == null) return null;
        if (!value.matches("0|[1-9][0-9]*")) {
            throw invalid(List.of(new InvalidReason(null, "DEFINITION_REVISION_INVALID", null)));
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException failure) {
            throw invalid(List.of(new InvalidReason(null, "DEFINITION_REVISION_INVALID", null)), failure);
        }
    }

    private static Prepared validateAndBuild(ExtensionDefinitionReadback definition, List<RawFilter> raw) {
        List<ExtensionDefinitionReadback.Field> fields = definition.fields();
        var byKey = fields.stream()
                .collect(java.util.stream.Collectors.toMap(
                        ExtensionDefinitionReadback.Field::fieldKey, value -> value, (left, right) -> left));
        List<InvalidReason> reasons = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        long searchableCount = fields.stream()
                .filter(field -> Boolean.TRUE.equals(field.searchable()) && "ENABLED".equals(field.status()))
                .count();
        if (raw.size() > searchableCount) {
            reasons.add(new InvalidReason(null, "MAX_CONDITIONS_EXCEEDED", null));
        }
        List<Condition> conditions = new ArrayList<>();
        for (RawFilter filter : raw) {
            ExtensionDefinitionReadback.Field field = byKey.get(filter.fieldKey());
            if (!seen.add(filter.fieldKey())) {
                reasons.add(new InvalidReason(filter.fieldKey(), "DUPLICATE_FIELD_KEY", null));
                continue;
            }
            if (field == null) {
                reasons.add(new InvalidReason(filter.fieldKey(), "UNKNOWN_FIELD_KEY", null));
                continue;
            }
            if (!"ENABLED".equals(field.status())) {
                reasons.add(new InvalidReason(filter.fieldKey(), "FIELD_DISABLED", field.fieldType()));
                continue;
            }
            if (!Boolean.TRUE.equals(field.searchable())) {
                reasons.add(new InvalidReason(filter.fieldKey(), "FIELD_NOT_SEARCHABLE", field.fieldType()));
                continue;
            }
            if (!field.fieldType().equals(filter.type())) {
                reasons.add(new InvalidReason(filter.fieldKey(), "TYPE_MISMATCH", field.fieldType()));
                continue;
            }
            try {
                conditions.add(condition(field, filter));
            } catch (IllegalArgumentException failure) {
                reasons.add(new InvalidReason(filter.fieldKey(), failure.getMessage(), field.fieldType()));
            }
        }
        if (!reasons.isEmpty()) throw invalid(reasons);
        return new Prepared(List.copyOf(conditions), definition.version());
    }

    private static Condition condition(ExtensionDefinitionReadback.Field field, RawFilter filter) {
        String value = filter.value();
        return switch (filter.type()) {
            case "TEXT" -> new Condition(filter.fieldKey(), "TEXT", value.trim().toLowerCase(Locale.ROOT), null);
            case "NUMBER" -> new Condition(filter.fieldKey(), "NUMBER", parseNumber(value), null);
            case "DATE" -> new Condition(filter.fieldKey(), "DATE", parseDate(value), null);
            case "BOOLEAN" -> new Condition(filter.fieldKey(), "BOOLEAN", parseBoolean(value), null);
            case "SELECT" -> {
                if (!field.options().contains(value)) throw new IllegalArgumentException("OPTION_INVALID");
                yield new Condition(filter.fieldKey(), "SELECT", value, null);
            }
            default -> throw new IllegalArgumentException("TYPE_INVALID");
        };
    }

    private static BigDecimal parseNumber(String value) {
        try {
            BigDecimal parsed = new BigDecimal(value.trim());
            if (!parsed.toString().equalsIgnoreCase("nan") && !parsed.toString().equalsIgnoreCase("infinity")) {
                return parsed;
            }
        } catch (NumberFormatException ignored) {
            // handled below with a typed reason
        }
        throw new IllegalArgumentException("NUMBER_INVALID");
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException failure) {
            throw new IllegalArgumentException("DATE_INVALID", failure);
        }
    }

    private static Boolean parseBoolean(String value) {
        if ("true".equals(value)) return Boolean.TRUE;
        if ("false".equals(value)) return Boolean.FALSE;
        throw new IllegalArgumentException("BOOLEAN_INVALID");
    }

    private static String textOrNull(JsonNode node, String fallback) {
        return node != null && node.isTextual() ? node.asText() : fallback;
    }

    private static InvalidFilterException invalid(List<InvalidReason> reasons) {
        return new InvalidFilterException(List.copyOf(reasons));
    }

    private static InvalidFilterException invalid(List<InvalidReason> reasons, Throwable cause) {
        return new InvalidFilterException(List.copyOf(reasons), cause);
    }

    public record RawFilter(String fieldKey, String type, String value) {}

    private record Condition(String fieldKey, String type, Object value, Object unused) {}

    public record InvalidReason(String fieldKey, String reason, String expectedType) {}

    public static final class Prepared {
        private final List<Condition> conditions;
        private final Long definitionRevision;

        private Prepared(List<Condition> conditions, Long definitionRevision) {
            this.conditions = conditions;
            this.definitionRevision = definitionRevision;
        }

        public static Prepared empty() {
            return new Prepared(List.of(), null);
        }

        public boolean isEmpty() {
            return conditions.isEmpty();
        }

        public Long definitionRevision() {
            return definitionRevision;
        }

        public String predicate(String jsonColumn) {
            if (conditions.isEmpty()) return "TRUE";
            return conditions.stream()
                    .map(condition -> predicateFor(jsonColumn, condition))
                    .collect(java.util.stream.Collectors.joining(" AND ", "(", ")"));
        }

        public List<Object> parameters() {
            List<Object> values = new ArrayList<>();
            for (Condition condition : conditions) {
                values.add(condition.fieldKey());
                switch (condition.type()) {
                    case "TEXT" -> {
                        values.add(condition.fieldKey());
                        values.add("%" + escapeLike(String.valueOf(condition.value())) + "%");
                    }
                    case "NUMBER", "BOOLEAN" -> {
                        values.add(condition.fieldKey());
                        values.add(condition.value());
                    }
                    case "DATE" -> {
                        values.add(condition.fieldKey());
                        values.add(String.valueOf(condition.value()));
                    }
                    case "SELECT" -> values.add(condition.value());
                    default -> throw new IllegalStateException("unsupported extension filter type");
                }
            }
            return List.copyOf(values);
        }

        private static String predicateFor(String jsonColumn, Condition condition) {
            String jsonValue = jsonColumn + " -> ?";
            String textValue = jsonColumn + " ->> ?";
            return switch (condition.type()) {
                case "TEXT" -> "jsonb_typeof(" + jsonValue + ") = 'string' AND lower(COALESCE(" + textValue
                        + ", '')) LIKE lower(?) ESCAPE '!'";
                case "NUMBER" -> "jsonb_typeof(" + jsonValue + ") = 'number' AND " + jsonValue
                        + " = to_jsonb(?::numeric)";
                case "DATE" -> "jsonb_typeof(" + jsonValue + ") = 'string' AND " + jsonValue + " = to_jsonb(?::text)";
                case "BOOLEAN" -> "jsonb_typeof(" + jsonValue + ") = 'boolean' AND " + jsonValue
                        + " = to_jsonb(?::boolean)";
                case "SELECT" -> jsonValue + " = to_jsonb(?::text)";
                default -> throw new IllegalStateException("unsupported extension filter type");
            };
        }

        private static String escapeLike(String value) {
            return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        }
    }

    public static final class InvalidFilterException extends RuntimeException {
        private final List<InvalidReason> reasons;

        public InvalidFilterException(List<InvalidReason> reasons) {
            this(reasons, null);
        }

        public InvalidFilterException(List<InvalidReason> reasons, Throwable cause) {
            super(null, cause);
            this.reasons = reasons;
        }

        public List<InvalidReason> reasons() {
            return reasons;
        }
    }

    public static final class DefinitionRevisionStaleException extends RuntimeException {
        private final long currentRevision;

        public DefinitionRevisionStaleException(long currentRevision) {
            this.currentRevision = currentRevision;
        }

        public long currentRevision() {
            return currentRevision;
        }
    }
}
