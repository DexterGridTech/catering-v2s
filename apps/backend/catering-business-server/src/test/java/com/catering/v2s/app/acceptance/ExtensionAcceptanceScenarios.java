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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

final class ExtensionAcceptanceScenarios {
    private static final List<String> HOST_TYPES =
            List.of("BRAND", "TENANT", "HEAD_COMPANY", "STORE", "CONTRACT", "COMMERCIAL_GROUP", "REGION", "PROJECT");

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
        assertEquals(8, actual.size(), "BUSINESS: fixed host catalog size is a closed-set fact, not a row count");

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
        assertEquals(8, catalog.json().path("items").size(), "BUSINESS: catalog keeps the fixed eight host categories");
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

    private static Map<String, Object> definitionBody(long expectedVersion, List<Map<String, Object>> fields) {
        return Map.of("expectedVersion", expectedVersion, "definitions", fields);
    }

    private static List<Map<String, Object>> fields(String hostType, String suffix) {
        List<Map<String, Object>> fields = new ArrayList<>();
        fields.add(field(hostType.toLowerCase() + "Area", "面积-" + suffix, "NUMBER", List.of(), 0, "ENABLED"));
        String kindKey = hostType.toLowerCase() + "Kind";
        String kindLabel = "类型-" + suffix;
        List<String> kindOptions = List.of("PRIMARY", "SECONDARY");
        fields.add(field(kindKey, kindLabel, "SELECT", kindOptions, 1, "DISABLED"));
        return fields;
    }

    private static Map<String, Object> field(
            String key, String label, String type, List<String> options, int displayOrder, String status) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("key", key);
        value.put("label", label);
        value.put("type", type);
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
                hostType.toLowerCase() + "Area", "面积-" + suffix, "NUMBER", true, List.of(), "ENABLED", 0));
        result.add(expectedField(
                hostType.toLowerCase() + "Kind",
                "类型-" + suffix,
                "SELECT",
                true,
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
            List<String> options,
            String status,
            int displayOrder) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        result.put("key", key);
        result.put("label", label);
        result.put("type", type);
        result.put("required", required);
        ArrayNode optionValues = result.putArray("options");
        options.forEach(optionValues::add);
        result.put("status", status);
        result.put("displayOrder", displayOrder);
        result.putNull("displaySuffix");
        return result;
    }
}
