package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

final class ExtensionAcceptanceScenarios {
    private static final List<String> HOST_TYPES = List.of(
            "BRAND",
            "TENANT",
            "HEAD_COMPANY",
            "STORE",
            "CONTRACT",
            "COMMERCIAL_GROUP",
            "REGION",
            "PROJECT",
            "SERVICE_POINT");

    private final BackendAcceptanceTest host;

    ExtensionAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "pagination.extension-host-catalog-closed-set",
            module = "EXTENSION",
            operation = "extensionHostCatalogClosedSet")
    void extensionHostCatalogClosedSet(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.WorkspaceFixture workspace = host.workspaceOnly();
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session session = host.platformLogin(context);

        Response catalog = context.get(
                PLATFORM_EXTENSION_ENTITY_CATALOG,
                "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey() + "/extension-definitions",
                session.cookie(),
                Set.of(200));
        Set<String> actual = new LinkedHashSet<>();
        catalog.json()
                .path("items")
                .forEach(item -> actual.add(item.path("entityType").asText()));
        assertEquals(
                new LinkedHashSet<>(HOST_TYPES),
                actual,
                "BUSINESS: extension host catalog is the exact fixed management host set");
        assertEquals(9, actual.size(), "BUSINESS: fixed host catalog size is a closed-set fact, not a row count");

        Response unknown = context.get(
                PLATFORM_EXTENSION_DEFINITION,
                "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey() + "/extension-definitions/UNKNOWN",
                session.cookie(),
                Set.of(422));
        assertFalse(unknown.problemCode().isBlank(), "BUSINESS: an unknown host type is rejected with a typed problem");
    }

    @AcceptanceScenario(
            id = "pagination.extension-definition-aggregate-closure",
            module = "EXTENSION",
            operation = "extensionDefinitionAggregateClosure")
    void extensionDefinitionAggregateClosure(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String base = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/extension-definitions/";

        for (String hostType : HOST_TYPES) {
            Response created = context.put(
                    PLATFORM_REPLACE_EXTENSION_DEFINITION,
                    base + hostType,
                    platform.cookie(),
                    definitionBody(0, fields(hostType, "initial")),
                    Map.of("Idempotency-Key", "extension-aggregate-" + hostType.toLowerCase() + "-0001"),
                    Set.of(200));
            assertDefinition(
                    created.json(),
                    "replaceExtensionDefinition",
                    hostType,
                    "initial",
                    "BUSINESS: complete definition replace returns the full aggregate");
        }

        Response catalog = context.get(
                PLATFORM_EXTENSION_ENTITY_CATALOG,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/extension-definitions",
                platform.cookie(),
                Set.of(200));
        assertEquals(9, catalog.json().path("items").size(), "BUSINESS: catalog keeps the fixed nine host categories");
        assertEquals(
                2,
                catalog.json().path("items").get(0).path("configuredFieldCount").asInt(),
                "BUSINESS: catalog reports configured field count without paging the definition aggregate");

        Response updated = context.put(
                PLATFORM_REPLACE_EXTENSION_DEFINITION,
                base + "PROJECT",
                platform.cookie(),
                definitionBody(1, fields("PROJECT", "updated")),
                Map.of("Idempotency-Key", "extension-aggregate-project-0002"),
                Set.of(200));
        assertEquals(
                2,
                updated.json().path("revision").asLong(),
                "BUSINESS: whole-definition replacement advances revision");
        assertDefinition(
                updated.json(),
                "replaceExtensionDefinition",
                "PROJECT",
                "updated",
                "BUSINESS: replacement reads back the complete new aggregate");

        Response stale = context.put(
                PLATFORM_REPLACE_EXTENSION_DEFINITION,
                base + "PROJECT",
                platform.cookie(),
                definitionBody(1, fields("PROJECT", "stale")),
                Map.of("Idempotency-Key", "extension-aggregate-project-stale"),
                Set.of(409));
        assertTrue(
                stale.problemCode().contains("VERSION") || stale.problemCode().contains("CONFLICT"),
                "BUSINESS: stale whole-definition replacement is rejected by CAS");

        Response platformDetail =
                context.get(PLATFORM_EXTENSION_DEFINITION, base + "PROJECT", platform.cookie(), Set.of(200));
        assertDefinition(
                platformDetail.json(),
                "getExtensionDefinition",
                "PROJECT",
                "updated",
                "BUSINESS: detail read returns the complete current aggregate after stale rejection");
        assertFalse(
                platformDetail.json().has("cursor")
                        || platformDetail.json().has("pageSize")
                        || platformDetail.json().has("total"),
                "BUSINESS: whole-definition detail does not pretend to be a paginated list");

        long workspaceVersion = context.get(
                        PLATFORM_GROUP_WORKSPACE_DETAIL,
                        "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey(),
                        platform.cookie(),
                        Set.of(200))
                .json()
                .path("version")
                .asLong();
        RouteIdentity workspaceStatus = new RouteIdentity(
                "transitionPlatformGroupWorkspaceStatus", "/api/platform/group-workspaces/{groupWorkspaceKey}/status");
        String disableKey = "extension-workspace-disable-" + UUID.randomUUID();
        context.post(
                workspaceStatus,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/status",
                platform.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", workspaceVersion, "idempotencyKey", disableKey),
                Map.of("Idempotency-Key", disableKey),
                Set.of(200));
        Response disabledDetail =
                context.get(PLATFORM_EXTENSION_DEFINITION, base + "PROJECT", platform.cookie(), Set.of(200));
        assertDisabledDefinition(
                disabledDetail.json(),
                "getExtensionDefinition",
                "PROJECT",
                "updated",
                "BUSINESS: disabled workspace returns exact workspace blocker and field facts");

        long disabledWorkspaceVersion = context.get(
                        PLATFORM_GROUP_WORKSPACE_DETAIL,
                        "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey(),
                        platform.cookie(),
                        Set.of(200))
                .json()
                .path("version")
                .asLong();
        String enableKey = "extension-workspace-enable-" + UUID.randomUUID();
        context.post(
                workspaceStatus,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/status",
                platform.cookie(),
                Map.of(
                        "targetStatus",
                        "ENABLED",
                        "expectedVersion",
                        disabledWorkspaceVersion,
                        "idempotencyKey",
                        enableKey),
                Map.of("Idempotency-Key", enableKey),
                Set.of(200));
        Response restoredDetail =
                context.get(PLATFORM_EXTENSION_DEFINITION, base + "PROJECT", platform.cookie(), Set.of(200));
        assertDefinition(
                restoredDetail.json(),
                "getExtensionDefinition",
                "PROJECT",
                "updated",
                "BUSINESS: restoring workspace exposes unchanged field facts");

        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        String operationBase = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
        assertDefinition(
                context.get(
                                OPERATIONS_ORGANIZATION_STORE_EXTENSION_DEFINITION,
                                operationBase + "/organization/stores/extension-definition?expectedContextVersion="
                                        + operations.contextVersion(),
                                operations.cookie(),
                                Set.of(200))
                        .json(),
                "getOperationsOrganizationStoreExtensionDefinition",
                "STORE",
                "initial",
                "BUSINESS: store detail reads the complete owner aggregate");
        for (String hostType : List.of("BRAND", "TENANT", "HEAD_COMPANY")) {
            assertDefinition(
                    context.get(
                                    OPERATIONS_ORGANIZATION_BUSINESS_ENTITY_EXTENSION_DEFINITION,
                                    operationBase + "/organization/business-entities/extension-definition"
                                            + "?expectedContextVersion="
                                            + operations.contextVersion()
                                            + "&entityType="
                                            + hostType,
                                    operations.cookie(),
                                    Set.of(200))
                            .json(),
                    "getOperationsOrganizationBusinessEntityExtensionDefinition",
                    hostType,
                    "initial",
                    "BUSINESS: business-entity detail reads the complete owner aggregate");
        }
        for (String hostType : List.of("COMMERCIAL_GROUP", "REGION", "PROJECT")) {
            assertDefinition(
                    context.get(
                                    OPERATIONS_ORGANIZATION_HIERARCHY_EXTENSION_DEFINITION,
                                    operationBase
                                            + "/organization/hierarchy/extension-definition?expectedContextVersion="
                                            + operations.contextVersion()
                                            + "&entityType="
                                            + hostType,
                                    operations.cookie(),
                                    Set.of(200))
                            .json(),
                    "getOperationsOrganizationHierarchyExtensionDefinition",
                    hostType,
                    hostType.equals("PROJECT") ? "updated" : "initial",
                    "BUSINESS: hierarchy detail reads the complete owner aggregate");
        }
        assertDefinition(
                context.get(
                                OPERATIONS_CONTRACT_EXTENSION_DEFINITION,
                                operationBase + "/contracts/extension-definition?expectedContextVersion="
                                        + operations.contextVersion(),
                                operations.cookie(),
                                Set.of(200))
                        .json(),
                "getOperationsContractExtensionDefinition",
                "CONTRACT",
                "initial",
                "BUSINESS: contract detail reads the complete owner aggregate");
    }

    @AcceptanceScenario(
            id = "extension.typed-filter-validation-and-recovery",
            module = "EXTENSION",
            operation = "extensionFilterValidationAndRecovery")
    void typedFilterValidationAndRecovery(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("GROUP", Set.of("BC-ORG-BRAND-CREATE"));
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        List<Map<String, Object>> definitions = typedFlatFields();
        replaceDefinition(context, fixture.groupWorkspaceKey(), platform.cookie(), "BRAND", definitions);
        long definitionRevision = 1L;

        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        Response created = context.post(
                OPERATIONS_ORGANIZATION_BRAND_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/brands",
                operations.cookie(),
                Map.of(
                        "code",
                        "acceptance-extension-brand",
                        "name",
                        "Acceptance Extension Brand",
                        "alias",
                        "AEB",
                        "remark",
                        "typed-filter",
                        "extensionValues",
                        List.of(
                                extensionSet("brandText", "\"Alpha!%_\""),
                                extensionSet("brandNumber", "12.50"),
                                extensionSet("brandDate", "\"2026-09-15\""),
                                extensionSet("brandBoolean", "true"),
                                extensionSet("brandSelect", "\"直营\""))),
                Set.of(201));
        String listBase = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey()
                + "/organization/brands?expectedContextVersion=" + operations.contextVersion()
                + "&page=1&pageSize=1";
        Response typed = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                listBase
                        + "&extensionFilters="
                        + filterWire(
                                new FilterSpec("brandText", "TEXT", "Alpha!%_"),
                                new FilterSpec("brandNumber", "NUMBER", "12.50"),
                                new FilterSpec("brandDate", "DATE", "2026-09-15"),
                                new FilterSpec("brandBoolean", "BOOLEAN", "true"),
                                new FilterSpec("brandSelect", "SELECT", "直营"))
                        + "&definitionRevision="
                        + definitionRevision,
                operations.cookie(),
                Set.of(200));
        assertEquals(1, typed.json().path("items").size(), "BUSINESS: typed extension AND filters keep one row");
        assertEquals(
                definitionRevision,
                typed.json().path("metadata").path("definitionRevision").asLong(),
                "BUSINESS: filtered page returns the definition revision used by the owner");
        JsonNode extensionValues = typed.json().path("items").get(0).path("extensionValues");
        assertEquals("Alpha!%_", extensionValues.path("brandText").asText(), "BUSINESS: TEXT raw value is returned");
        assertEquals(12.5, extensionValues.path("brandNumber").asDouble(), "BUSINESS: NUMBER raw value is returned");
        assertEquals("2026-09-15", extensionValues.path("brandDate").asText(), "BUSINESS: DATE raw value is returned");
        assertTrue(extensionValues.path("brandBoolean").asBoolean(), "BUSINESS: BOOLEAN raw value is returned");
        assertEquals("直营", extensionValues.path("brandSelect").asText(), "BUSINESS: SELECT raw value is returned");
        assertEquals(
                created.json().path("id").asText(),
                typed.json().path("items").get(0).path("id").asText(),
                "BUSINESS: filter result identity is owner-scoped");

        assertEquals(
                1,
                host.update(
                        "UPDATE organization.brand SET extension_values = jsonb_build_object("
                                + "'brandNumber', 'legacy-number', 'brandDate', '2026-02-30') WHERE id=?",
                        UUID.fromString(created.json().path("id").asText())),
                "BUSINESS: malformed legacy extension values fixture is written");
        Response malformedNumber = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                listBase
                        + "&extensionFilters="
                        + filterWire(new FilterSpec("brandNumber", "NUMBER", "12.50"))
                        + "&definitionRevision="
                        + definitionRevision,
                operations.cookie(),
                Set.of(200));
        assertEquals(
                0,
                malformedNumber.json().path("metadata").path("total").asInt(),
                "BUSINESS: a legacy non-number JSON value is a safe non-match, not a 500");
        Response malformedDate = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                listBase
                        + "&extensionFilters="
                        + filterWire(new FilterSpec("brandDate", "DATE", "2026-09-15"))
                        + "&definitionRevision="
                        + definitionRevision,
                operations.cookie(),
                Set.of(200));
        assertEquals(
                0,
                malformedDate.json().path("metadata").path("total").asInt(),
                "BUSINESS: a legacy invalid date string is a safe non-match, not a 500");

        Response empty = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                listBase + "&extensionFilters=%5B%5D",
                operations.cookie(),
                Set.of(200));
        assertTrue(
                empty.json().path("metadata").path("definitionRevision").isNull(),
                "BUSINESS: an empty extension filter array does not trigger a revision comparison");

        Response invalid = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                listBase
                        + "&extensionFilters="
                        + filterWire(
                                new FilterSpec("disabled", "TEXT", "x"),
                                new FilterSpec("missing", "TEXT", "x"),
                                new FilterSpec("brandNumber", "TEXT", "x"),
                                new FilterSpec("brandSelect", "SELECT", "不存在"),
                                new FilterSpec("brandText", "TEXT", "x"),
                                new FilterSpec("brandText", "TEXT", "y"))
                        + "&definitionRevision="
                        + definitionRevision,
                operations.cookie(),
                Set.of(400));
        assertEquals(
                "EXTENSION_FILTER_INVALID",
                invalid.problemCode(),
                "BUSINESS: invalid filters use the typed problem code");
        Set<String> invalidReasons = new java.util.LinkedHashSet<>();
        invalid.json()
                .path("details")
                .path("invalidFields")
                .forEach(reason -> invalidReasons.add(reason.path("reason").asText()));
        assertEquals(
                Set.of(
                        "MAX_CONDITIONS_EXCEEDED",
                        "FIELD_DISABLED",
                        "UNKNOWN_FIELD_KEY",
                        "TYPE_MISMATCH",
                        "OPTION_INVALID",
                        "DUPLICATE_FIELD_KEY"),
                invalidReasons,
                "BUSINESS: invalid filters aggregate the full typed validation reason set");

        Response stale = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                listBase
                        + "&extensionFilters="
                        + filterWire(new FilterSpec("brandText", "TEXT", "x"))
                        + "&definitionRevision=0",
                operations.cookie(),
                Set.of(409));
        assertEquals(
                "EXTENSION_DEFINITION_REVISION_STALE",
                stale.problemCode(),
                "BUSINESS: a stale extension revision is a typed retryable conflict");
        assertEquals(
                definitionRevision,
                stale.json().path("details").path("currentDefinitionRevision").asLong(),
                "BUSINESS: stale response exposes the current definition revision");
        assertTrue(stale.json().path("details").path("retryable").asBoolean(), "BUSINESS: stale recovery is retryable");
    }

    static Map<String, Object> definitionBody(long expectedVersion, List<Map<String, Object>> fields) {
        return Map.of("expectedVersion", expectedVersion, "definitions", fields);
    }

    static void replaceDefinition(
            BackendAcceptanceTest.ScenarioContext context,
            String groupWorkspaceKey,
            String platformCookie,
            String hostType,
            List<Map<String, Object>> fields)
            throws Exception {
        context.put(
                PLATFORM_REPLACE_EXTENSION_DEFINITION,
                "/api/platform/group-workspaces/" + groupWorkspaceKey + "/extension-definitions/" + hostType,
                platformCookie,
                definitionBody(0, fields),
                Map.of("Idempotency-Key", "extension-filter-" + hostType.toLowerCase() + "-" + UUID.randomUUID()),
                Set.of(200));
    }

    static List<Map<String, Object>> typedFlatFields() {
        return List.of(
                filterField("brandText", "文本匹配", "TEXT", List.of(), 0, true, true, "ENABLED"),
                filterField("brandNumber", "数值", "NUMBER", List.of(), 1, true, true, "ENABLED"),
                filterField("brandDate", "日期", "DATE", List.of(), 2, true, true, "ENABLED"),
                filterField("brandBoolean", "布尔", "BOOLEAN", List.of(), 3, true, true, "ENABLED"),
                filterField("brandSelect", "来源", "SELECT", List.of("直营", "联营"), 4, true, true, "ENABLED"),
                filterField("disabled", "禁用字段", "TEXT", List.of(), 5, false, false, "DISABLED"));
    }

    static List<Map<String, Object>> typedFlatFieldsFor(String prefix) {
        return List.of(
                filterField(prefix + "Text", "文本匹配", "TEXT", List.of(), 0, true, true, "ENABLED"),
                filterField(prefix + "Number", "数值", "NUMBER", List.of(), 1, true, true, "ENABLED"),
                filterField(prefix + "Date", "日期", "DATE", List.of(), 2, true, true, "ENABLED"),
                filterField(prefix + "Boolean", "布尔", "BOOLEAN", List.of(), 3, true, true, "ENABLED"),
                // spotless:off
                filterField(prefix + "Select", "来源", "SELECT", List.of("直营", "联营"), 4, true, true,
                    "ENABLED"),
                // spotless:on
                filterField(prefix + "Disabled", "禁用字段", "TEXT", List.of(), 5, false, false, "DISABLED"));
    }

    static List<Map<String, Object>> typedExtensionValues(String prefix, String textValue) {
        return List.of(
                extensionSet(prefix + "Text", jsonQuote(textValue)),
                extensionSet(prefix + "Number", "12.50"),
                extensionSet(prefix + "Date", jsonQuote("2026-09-15")),
                extensionSet(prefix + "Boolean", "true"),
                extensionSet(prefix + "Select", jsonQuote("直营")));
    }

    static FilterSpec[] typedFilterSpecs(String prefix, String textValue) {
        return new FilterSpec[] {
            new FilterSpec(prefix + "Text", "TEXT", textValue),
            new FilterSpec(prefix + "Number", "NUMBER", "12.50"),
            new FilterSpec(prefix + "Date", "DATE", "2026-09-15"),
            new FilterSpec(prefix + "Boolean", "BOOLEAN", "true"),
            new FilterSpec(prefix + "Select", "SELECT", "直营")
        };
    }

    private static Map<String, Object> filterField(
            String key,
            String label,
            String type,
            List<String> options,
            int displayOrder,
            boolean listDisplay,
            boolean searchable,
            String status) {
        Map<String, Object> field = new LinkedHashMap<>();
        field.put("key", key);
        field.put("label", label);
        field.put("type", type);
        field.put("listDisplay", listDisplay);
        field.put("searchable", searchable);
        field.put("required", false);
        field.put("options", options);
        field.put("status", status);
        field.put("displayOrder", displayOrder);
        return field;
    }

    static Map<String, Object> extensionSet(String fieldKey, String valueJson) {
        return Map.of("fieldKey", fieldKey, "valueJson", valueJson, "mode", "SET");
    }

    static String filterWire(FilterSpec... filters) {
        String json = List.of(filters).stream()
                .map(filter -> "{\"fieldKey\":" + jsonQuote(filter.fieldKey())
                        + ",\"type\":" + jsonQuote(filter.type())
                        + ",\"value\":" + jsonQuote(filter.value()) + "}")
                .collect(java.util.stream.Collectors.joining(",", "[", "]"));
        return URLEncoder.encode(json, StandardCharsets.UTF_8);
    }

    private static String jsonQuote(String value) {
        return "\""
                + value.replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r")
                + "\"";
    }

    record FilterSpec(String fieldKey, String type, String value) {}

    static List<Map<String, Object>> singleTextFilterFields(String key, String label) {
        return List.of(filterField(key, label, "TEXT", List.of(), 0, true, true, "ENABLED"));
    }

    private static List<Map<String, Object>> fields(String hostType, String suffix) {
        List<Map<String, Object>> fields = new ArrayList<>();
        // spotless:off
        fields.add(field(hostType, hostType.toLowerCase() + "Area", "面积-" + suffix, "NUMBER", List.of(), 0,
            "ENABLED"));
        // spotless:on
        String kindKey = hostType.toLowerCase() + "Kind";
        String kindLabel = "类型-" + suffix;
        List<String> kindOptions = List.of("PRIMARY", "SECONDARY");
        fields.add(field(hostType, kindKey, kindLabel, "SELECT", kindOptions, 1, "DISABLED"));
        return fields;
    }

    private static Map<String, Object> field(
            String hostType,
            String key,
            String label,
            String type,
            List<String> options,
            int displayOrder,
            String status) {
        Map<String, Object> value = new LinkedHashMap<>();
        boolean flatHost =
                Set.of("BRAND", "TENANT", "HEAD_COMPANY", "STORE", "CONTRACT").contains(hostType);
        value.put("key", key);
        value.put("label", label);
        value.put("type", type);
        value.put("listDisplay", flatHost ? displayOrder == 0 : null);
        value.put("searchable", flatHost ? displayOrder == 0 : null);
        value.put("required", true);
        value.put("options", options);
        value.put("status", status);
        value.put("displayOrder", displayOrder);
        return value;
    }

    private static void assertDefinition(
            JsonNode json, String operationId, String hostType, String suffix, String message) {
        assertEquals(
                hostType,
                oracle(json, operationId, "/entityType", JsonNodeType.STRING, message)
                        .asText(),
                message + ": host type");
        assertEquals(
                expectedDefinitions(hostType, suffix),
                oracle(json, operationId, "/definitions", JsonNodeType.ARRAY, message),
                message + ": complete ordered field facts");
        assertTrue(
                oracle(json, operationId, "/revision", JsonNodeType.NUMBER, message)
                                .asLong()
                        >= 1,
                message + ": revision is present");
        assertOracleEquals(
                json,
                operationId,
                "/workspaceStatus",
                JsonNodeFactory.instance.textNode("ENABLED"),
                JsonNodeType.STRING,
                message + ": workspace status");
        assertOracleEquals(
                json,
                operationId,
                "/definitions/0/status",
                JsonNodeFactory.instance.textNode("ENABLED"),
                JsonNodeType.STRING,
                message + ": first field status");
        assertOracleEquals(
                json,
                operationId,
                "/definitions/1/status",
                JsonNodeFactory.instance.textNode("DISABLED"),
                JsonNodeType.STRING,
                message + ": second field status");
        assertEquals(
                JsonNodeFactory.instance.arrayNode(),
                oracle(json, operationId, "/blockers", JsonNodeType.ARRAY, message),
                message + ": workspace blockers empty");
    }

    private static void assertDisabledDefinition(
            JsonNode json, String operationId, String hostType, String suffix, String message) {
        assertEquals(
                hostType,
                oracle(json, operationId, "/entityType", JsonNodeType.STRING, message)
                        .asText(),
                message + ": host type");
        assertEquals(
                expectedDefinitions(hostType, suffix),
                oracle(json, operationId, "/definitions", JsonNodeType.ARRAY, message),
                message + ": disabled workspace preserves ordered field facts");
        assertOracleEquals(
                json,
                operationId,
                "/workspaceStatus",
                JsonNodeFactory.instance.textNode("DISABLED"),
                JsonNodeType.STRING,
                message + ": workspace status");
        assertOracleEquals(
                json,
                operationId,
                "/definitions/0/status",
                JsonNodeFactory.instance.textNode("ENABLED"),
                JsonNodeType.STRING,
                message + ": first field status");
        assertOracleEquals(
                json,
                operationId,
                "/definitions/1/status",
                JsonNodeFactory.instance.textNode("DISABLED"),
                JsonNodeType.STRING,
                message + ": second field status");
        ArrayNode expectedBlockers = JsonNodeFactory.instance.arrayNode();
        ObjectNode blocker = expectedBlockers.addObject();
        blocker.put("type", "WORKSPACE");
        blocker.put("status", "DISABLED");
        assertEquals(
                expectedBlockers,
                oracle(json, operationId, "/blockers", JsonNodeType.ARRAY, message),
                message + ": workspace blocker");
    }

    private static JsonNode oracle(
            JsonNode json, String operationId, String pointer, JsonNodeType type, String message) {
        JsonNode value = json.at(pointer);
        assertFalse(value.isMissingNode(), message + ": missing pointer " + pointer);
        assertEquals(type, value.getNodeType(), message + ": wrong JSON type at " + pointer);
        return value;
    }

    private static void assertOracleEquals(
            JsonNode json, String operationId, String pointer, JsonNode expected, JsonNodeType type, String message) {
        assertEquals(expected, oracle(json, operationId, pointer, type, message), message + ": exact value");
    }

    private static ArrayNode expectedDefinitions(String hostType, String suffix) {
        ArrayNode result = JsonNodeFactory.instance.arrayNode();
        result.add(expectedField(
                hostType.toLowerCase() + "Area",
                "面积-" + suffix,
                "NUMBER",
                true,
                isFlatHost(hostType) ? true : null,
                isFlatHost(hostType) ? true : null,
                List.of(),
                "ENABLED",
                0));
        result.add(expectedField(
                hostType.toLowerCase() + "Kind",
                "类型-" + suffix,
                "SELECT",
                true,
                isFlatHost(hostType) ? false : null,
                isFlatHost(hostType) ? false : null,
                List.of("PRIMARY", "SECONDARY"),
                "DISABLED",
                1));
        return result;
    }

    private static ObjectNode expectedField(
            String key,
            String label,
            String type,
            boolean required,
            Boolean listDisplay,
            Boolean searchable,
            List<String> options,
            String status,
            int displayOrder) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        result.put("key", key);
        result.put("label", label);
        result.put("type", type);
        if (listDisplay == null) result.putNull("listDisplay");
        else result.put("listDisplay", listDisplay);
        if (searchable == null) result.putNull("searchable");
        else result.put("searchable", searchable);
        result.put("required", required);
        ArrayNode optionValues = result.putArray("options");
        options.forEach(optionValues::add);
        result.put("status", status);
        result.put("displayOrder", displayOrder);
        result.putNull("displaySuffix");
        return result;
    }

    private static boolean isFlatHost(String hostType) {
        return Set.of("BRAND", "TENANT", "HEAD_COMPANY", "STORE", "CONTRACT").contains(hostType);
    }
}
