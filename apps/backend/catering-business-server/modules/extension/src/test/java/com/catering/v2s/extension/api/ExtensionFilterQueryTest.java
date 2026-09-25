package com.catering.v2s.extension.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ExtensionFilterQueryTest {
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final ExtensionDefinitionReadback DEFINITION = new ExtensionDefinitionReadback(
            "extension-test",
            "BRAND",
            7,
            1,
            List.of(
                    field("text", "TEXT", true, true, List.of()),
                    field("number", "NUMBER", true, true, List.of()),
                    field("date", "DATE", true, true, List.of()),
                    field("boolean", "BOOLEAN", true, true, List.of()),
                    field("select", "SELECT", true, true, List.of("直营", "联营")),
                    field("hidden", "TEXT", false, false, List.of())),
            "ENABLED",
            List.of());

    @Test
    void emptyArrayIsNoConditionAndDoesNotReadDefinitionOrRevision() {
        AtomicInteger lookups = new AtomicInteger();
        ExtensionDefinitionLookup lookup = (workspace, key, host) -> {
            lookups.incrementAndGet();
            return DEFINITION;
        };

        ExtensionFilterQuery.Prepared prepared =
                ExtensionFilterQuery.prepare(lookup, WORKSPACE, "extension-test", "BRAND", "[]", "not-a-revision");

        assertTrue(prepared.isEmpty());
        assertEquals(null, prepared.definitionRevision());
        assertEquals("TRUE", prepared.predicate("extension_values"));
        assertEquals(List.of(), prepared.parameters());
        assertEquals(0, lookups.get());
    }

    @Test
    void parsesAllFiveTypesAndBuildsOneOwnerPredicateWithTypedParameters() {
        String wire = "["
                + "{\"fieldKey\":\"text\",\"type\":\"TEXT\",\"value\":\" Alpha!%_ \"},"
                + "{\"fieldKey\":\"number\",\"type\":\"NUMBER\",\"value\":\"12.50\"},"
                + "{\"fieldKey\":\"date\",\"type\":\"DATE\",\"value\":\"2026-09-15\"},"
                + "{\"fieldKey\":\"boolean\",\"type\":\"BOOLEAN\",\"value\":\"true\"},"
                + "{\"fieldKey\":\"select\",\"type\":\"SELECT\",\"value\":\"直营\"}"
                + "]";
        ExtensionFilterQuery.Prepared prepared = ExtensionFilterQuery.prepare(
                (workspace, key, host) -> DEFINITION,
                WORKSPACE,
                "extension-test",
                "BRAND",
                URLEncoder.encode(wire, StandardCharsets.UTF_8),
                "7");

        assertEquals(7L, prepared.definitionRevision());
        assertTrue(prepared.predicate("extension_values").contains("ESCAPE '!'"));
        String predicate = prepared.predicate("extension_values");
        assertTrue(predicate.contains("jsonb_typeof"));
        assertTrue(predicate.contains("to_jsonb(?::numeric)"));
        assertTrue(predicate.contains("to_jsonb(?::text)"));
        assertTrue(predicate.contains("to_jsonb(?::boolean)"));
        assertFalse(predicate.contains("->> ?)::numeric"));
        assertFalse(predicate.contains("->> ?)::date"));
        assertFalse(predicate.contains("->> ?)::boolean"));
        assertEquals(
                List.of(
                        "text",
                        "text",
                        "%alpha!!!%!_%",
                        "number",
                        "number",
                        new BigDecimal("12.50"),
                        "date",
                        "date",
                        "2026-09-15",
                        "boolean",
                        "boolean",
                        true,
                        "select",
                        "直营"),
                prepared.parameters());
    }

    @Test
    void rejectsMalformedOrStaleRequestsBeforeOwnerQueryAndAggregatesSemanticReasons() {
        AtomicInteger lookups = new AtomicInteger();
        ExtensionDefinitionLookup lookup = (workspace, key, host) -> {
            lookups.incrementAndGet();
            return DEFINITION;
        };
        assertThrows(
                ExtensionFilterQuery.InvalidFilterException.class,
                () -> ExtensionFilterQuery.prepare(lookup, WORKSPACE, "extension-test", "BRAND", "%5B", "7"));
        assertEquals(0, lookups.get());

        ExtensionFilterQuery.DefinitionRevisionStaleException stale = assertThrows(
                ExtensionFilterQuery.DefinitionRevisionStaleException.class,
                () -> ExtensionFilterQuery.prepare(
                        lookup,
                        WORKSPACE,
                        "extension-test",
                        "BRAND",
                        "[{\"fieldKey\":\"text\",\"type\":\"TEXT\",\"value\":\"x\"}]",
                        "6"));
        assertEquals(7L, stale.currentRevision());

        ExtensionFilterQuery.InvalidFilterException invalid = assertThrows(
                ExtensionFilterQuery.InvalidFilterException.class,
                () -> ExtensionFilterQuery.prepare(
                        lookup,
                        WORKSPACE,
                        "extension-test",
                        "BRAND",
                        "[{\"fieldKey\":\"hidden\",\"type\":\"TEXT\",\"value\":\"x\"},"
                                + "{\"fieldKey\":\"missing\",\"type\":\"TEXT\",\"value\":\"x\"},"
                                + "{\"fieldKey\":\"number\",\"type\":\"TEXT\",\"value\":\"x\"},"
                                + "{\"fieldKey\":\"select\",\"type\":\"SELECT\",\"value\":\"失效\"}]",
                        "7"));
        assertEquals(
                List.of("FIELD_NOT_SEARCHABLE", "UNKNOWN_FIELD_KEY", "TYPE_MISMATCH", "OPTION_INVALID"),
                invalid.reasons().stream()
                        .map(ExtensionFilterQuery.InvalidReason::reason)
                        .toList());
        assertEquals(2, lookups.get());
    }

    @Test
    void rejectsOversizedEncodedWireBeforeDecodeOrDefinitionLookup() {
        AtomicInteger lookups = new AtomicInteger();

        ExtensionFilterQuery.InvalidFilterException oversized = assertThrows(
                ExtensionFilterQuery.InvalidFilterException.class,
                () -> ExtensionFilterQuery.prepare(
                        (workspace, key, host) -> {
                            lookups.incrementAndGet();
                            return DEFINITION;
                        },
                        WORKSPACE,
                        "extension-test",
                        "BRAND",
                        "x".repeat(ExtensionFilterQuery.MAX_ENCODED_LENGTH + 1),
                        "7"));

        assertEquals("QUERY_TOO_LONG", oversized.reasons().getFirst().reason());
        assertEquals(0, lookups.get());
    }

    @Test
    void rejectsMissingRevisionAndInvalidTypedValuesBeforeDefinitionLookup() {
        AtomicInteger lookups = new AtomicInteger();
        ExtensionDefinitionLookup lookup = (workspace, key, host) -> {
            lookups.incrementAndGet();
            return DEFINITION;
        };
        ExtensionFilterQuery.InvalidFilterException missingRevision = assertThrows(
                ExtensionFilterQuery.InvalidFilterException.class,
                () -> ExtensionFilterQuery.prepare(
                        lookup,
                        WORKSPACE,
                        "extension-test",
                        "BRAND",
                        "[{\"fieldKey\":\"number\",\"type\":\"NUMBER\",\"value\":\"1\"}]",
                        null));
        assertEquals(
                "DEFINITION_REVISION_REQUIRED",
                missingRevision.reasons().getFirst().reason());
        assertEquals(0, lookups.get());

        ExtensionFilterQuery.InvalidFilterException invalidNumber = assertThrows(
                ExtensionFilterQuery.InvalidFilterException.class,
                () -> ExtensionFilterQuery.prepare(
                        lookup,
                        WORKSPACE,
                        "extension-test",
                        "BRAND",
                        "[{\"fieldKey\":\"number\",\"type\":\"NUMBER\",\"value\":\"NaN\"}]",
                        "7"));
        assertEquals("NUMBER_INVALID", invalidNumber.reasons().getFirst().reason());
        assertEquals(1, lookups.get());
    }

    private static ExtensionDefinitionReadback.Field field(
            String key, String type, boolean listDisplay, boolean searchable, List<String> options) {
        return new ExtensionDefinitionReadback.Field(
                key, key, type, listDisplay, searchable, false, options, "ENABLED", 0, null);
    }
}
