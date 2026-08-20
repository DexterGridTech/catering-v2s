package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
                updated.json(), "PROJECT", "updated", "BUSINESS: replacement reads back the complete new aggregate");

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
                "PROJECT",
                "updated",
                "BUSINESS: detail read returns the complete current aggregate after stale rejection");
        assertFalse(
                platformDetail.json().has("cursor")
                        || platformDetail.json().has("pageSize")
                        || platformDetail.json().has("total"),
                "BUSINESS: whole-definition detail does not pretend to be a paginated list");

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
                "CONTRACT",
                "initial",
                "BUSINESS: contract detail reads the complete owner aggregate");
    }

    private static Map<String, Object> definitionBody(long expectedVersion, List<Map<String, Object>> fields) {
        return Map.of("expectedVersion", expectedVersion, "definitions", fields);
    }

    private static List<Map<String, Object>> fields(String hostType, String suffix) {
        List<Map<String, Object>> fields = new ArrayList<>();
        fields.add(field(hostType.toLowerCase() + "Area", "面积-" + suffix, "NUMBER", List.of(), 0));
        String kindKey = hostType.toLowerCase() + "Kind";
        String kindLabel = "类型-" + suffix;
        List<String> kindOptions = List.of("PRIMARY", "SECONDARY");
        fields.add(field(kindKey, kindLabel, "SELECT", kindOptions, 1));
        return fields;
    }

    private static Map<String, Object> field(
            String key, String label, String type, List<String> options, int displayOrder) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("key", key);
        value.put("label", label);
        value.put("type", type);
        value.put("required", true);
        value.put("options", options);
        value.put("status", "ENABLED");
        value.put("displayOrder", displayOrder);
        return value;
    }

    private static void assertDefinition(JsonNode json, String hostType, String suffix, String message) {
        assertEquals(hostType, json.path("entityType").asText(), message + ": host type");
        assertEquals(2, json.path("definitions").size(), message + ": complete field set");
        assertEquals(
                "类型-" + suffix,
                json.path("definitions").get(1).path("label").asText(),
                message + ": selected field label");
        assertEquals(
                2,
                json.path("definitions").get(1).path("options").size(),
                message + ": SELECT options remain part of the aggregate");
        assertTrue(json.path("revision").asLong() >= 1, message + ": revision is present");
    }
}
