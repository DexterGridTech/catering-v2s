package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static com.catering.v2s.app.acceptance.ExtensionAcceptanceScenarios.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class CommercialContractAcceptanceScenarios {
    private static final RouteIdentity PLATFORM_CONTRACT_OVERVIEW_PAGE = new RouteIdentity(
            "getPlatformContractOverviewPage", "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview");
    private static final RouteIdentity PLATFORM_CONTRACT_OVERVIEW_DETAIL = new RouteIdentity(
            "getPlatformContractOverviewDetail",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}");

    private final BackendAcceptanceTest host;

    CommercialContractAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "pagination.contract-page-owner-boundary",
            module = "CONTRACT",
            operation = "getOperationsContracts")
    void operationsContractPageOwnerBoundary(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        Set<String> expectedContractNos = new java.util.LinkedHashSet<>();
        for (int index = 0; index < 23; index++) {
            BackendAcceptanceTest.Fixture store = host.siblingStoreFixture(fixture, Set.of());
            String contractNo = "ACCEPT-PAGE-" + String.format("%02d", index);
            expectedContractNos.add(contractNo);
            context.post(
                    OPERATIONS_CONTRACT_CREATE,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                    session.cookie(),
                    Map.of(
                            "storeId",
                            store.storeId().toString(),
                            "phaseName",
                            "Opening",
                            "contractNo",
                            contractNo,
                            "effectiveFrom",
                            "2026-01-01",
                            "effectiveTo",
                            "2026-12-31",
                            "note",
                            "page-boundary",
                            "items",
                            List.of(Map.of("code", "PAGE-ITEM-" + index, "name", "Page item " + index)),
                            "extensionValues",
                            List.of()),
                    Set.of(201));
        }
        BackendAcceptanceTest.Fixture foreign = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE"));
        host.completeInvitation(context, foreign);
        BackendAcceptanceTest.Session foreignSession = host.login(context, foreign);
        context.post(
                OPERATIONS_CONTRACT_CREATE,
                "/api/operations/group-workspaces/" + foreign.groupWorkspaceKey() + "/contracts",
                foreignSession.cookie(),
                Map.of(
                        "storeId", foreign.storeId().toString(),
                        "phaseName", "Opening",
                        "contractNo", "ACCEPT-PAGE-FOREIGN",
                        "effectiveFrom", "2026-01-01",
                        "effectiveTo", "2026-12-31",
                        "note", "foreign-workspace",
                        "items", List.of(Map.of("code", "FOREIGN", "name", "Foreign")),
                        "extensionValues", List.of()),
                Set.of(201));

        Set<String> actualContractNos = new java.util.LinkedHashSet<>();
        for (int page = 1; page <= 3; page++) {
            BackendAcceptanceTest.Response response = context.get(
                    OPERATIONS_CONTRACT_LIST,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey()
                            + "/contracts?expectedContextVersion=" + session.contextVersion()
                            + "&pageSize=10&page=" + page,
                    session.cookie(),
                    Set.of(200));
            JsonNode metadata = response.json().path("metadata");
            assertEquals(page, metadata.path("page").asInt(), "BUSINESS: contract page identity is preserved");
            assertEquals(10, metadata.path("pageSize").asInt(), "BUSINESS: contract page size is preserved");
            assertEquals(23, metadata.path("total").asInt(), "BUSINESS: total is the complete project match count");
            JsonNode items = response.json().path("items");
            assertEquals(page < 3 ? 10 : 3, items.size(), "BUSINESS: contract page boundary is owner-enforced");
            for (JsonNode item : items) {
                String contractNo = item.path("contractNo").asText();
                assertTrue(expectedContractNos.contains(contractNo), "BUSINESS: contract belongs to requested project");
                assertFalse("ACCEPT-PAGE-FOREIGN".equals(contractNo), "BUSINESS: foreign workspace contract is hidden");
                assertTrue(actualContractNos.add(contractNo), "BUSINESS: contract pages do not repeat an item");
            }
        }
        assertEquals(expectedContractNos, actualContractNos, "BUSINESS: contract pages cover the complete set");
    }

    @AcceptanceScenario(
            id = "contract.extension-filtered-list",
            module = "CONTRACT",
            operation = "getOperationsContracts")
    void operationsContractExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE"));
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        replaceDefinition(
                context,
                fixture.groupWorkspaceKey(),
                platform.cookie(),
                "CONTRACT",
                typedFlatFieldsFor("contractFilter"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        createFilteredContract(context, fixture, operations, "A", "contractFilter", "match-value");
        createFilteredContract(context, fixture, operations, "B", "contractFilter", "match-value");
        createFilteredContract(context, fixture, operations, "C", "contractFilter", "different-value");
        String requestBase = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts"
                + "?expectedContextVersion=" + operations.contextVersion()
                + "&phaseName=Opening&pageSize=1&extensionFilters="
                + filterWire(typedFilterSpecs("contractFilter", "match-value"))
                + "&definitionRevision=1";
        Response page =
                context.get(OPERATIONS_CONTRACT_LIST, requestBase + "&page=1", operations.cookie(), Set.of(200));
        assertContractExtensionPage(page, 1, "contractFilter", "operations contract list");
        Response secondPage =
                context.get(OPERATIONS_CONTRACT_LIST, requestBase + "&page=2", operations.cookie(), Set.of(200));
        assertContractExtensionPage(secondPage, 2, "contractFilter", "operations contract list");
        assertNotEquals(
                page.json().path("items").get(0).path("id").asText(),
                secondPage.json().path("items").get(0).path("id").asText(),
                "BUSINESS: operations contract pages do not repeat an item");
    }

    @AcceptanceScenario(
            id = "contract.platform-extension-filtered-list",
            module = "CONTRACT",
            operation = "getPlatformContractOverviewPage")
    void platformContractExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE"));
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        replaceDefinition(
                context,
                fixture.groupWorkspaceKey(),
                platform.cookie(),
                "CONTRACT",
                typedFlatFieldsFor("contractFilter"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        createFilteredContract(context, fixture, operations, "A", "contractFilter", "match-value");
        createFilteredContract(context, fixture, operations, "B", "contractFilter", "match-value");
        createFilteredContract(context, fixture, operations, "C", "contractFilter", "different-value");
        String requestBase = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/contract-overview"
                + "?phaseName=Opening&pageSize=1&extensionFilters="
                + filterWire(typedFilterSpecs("contractFilter", "match-value"))
                + "&definitionRevision=1";
        Response page =
                context.get(PLATFORM_CONTRACT_OVERVIEW_PAGE, requestBase + "&page=1", platform.cookie(), Set.of(200));
        assertContractExtensionPage(page, 1, "contractFilter", "platform contract overview");
        Response secondPage =
                context.get(PLATFORM_CONTRACT_OVERVIEW_PAGE, requestBase + "&page=2", platform.cookie(), Set.of(200));
        assertContractExtensionPage(secondPage, 2, "contractFilter", "platform contract overview");
        assertNotEquals(
                page.json()
                        .path("items")
                        .get(0)
                        .path("contractRef")
                        .path("code")
                        .asText(),
                secondPage
                        .json()
                        .path("items")
                        .get(0)
                        .path("contractRef")
                        .path("code")
                        .asText(),
                "BUSINESS: platform contract pages do not repeat an item");
    }

    private void createFilteredContract(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session operations,
            String suffix,
            String fieldPrefix,
            String textValue)
            throws Exception {
        context.post(
                OPERATIONS_CONTRACT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                operations.cookie(),
                Map.of(
                        "storeId",
                        fixture.storeId().toString(),
                        "phaseName",
                        "Opening",
                        "contractNo",
                        "ACCEPT-FILTER-CONTRACT-" + suffix,
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "extension-filter",
                        "items",
                        List.of(Map.of("code", "FILTER-ITEM", "name", "Filter item")),
                        "extensionValues",
                        typedExtensionValues(fieldPrefix, textValue)),
                Set.of(201));
    }

    private static void assertContractExtensionPage(Response page, int expectedPage, String fieldPrefix, String label) {
        JsonNode metadata = page.json().path("metadata");
        assertEquals(expectedPage, metadata.path("page").asInt(), "BUSINESS: " + label + " preserves page identity");
        assertEquals(1, metadata.path("pageSize").asInt(), "BUSINESS: " + label + " preserves page size");
        assertEquals(
                2, metadata.path("total").asInt(), "BUSINESS: " + label + " totals the core and extension matches");
        assertEquals(
                1, page.json().path("items").size(), "BUSINESS: " + label + " keeps one filtered contract per page");
        assertEquals(
                1,
                metadata.path("definitionRevision").asLong(),
                "BUSINESS: " + label + " returns the definition revision used by the owner");
        JsonNode values = page.json().path("items").get(0).path("extensionValues");
        assertEquals(
                "match-value",
                values.path(fieldPrefix + "Text").asText(),
                "BUSINESS: " + label + " returns TEXT raw value");
        assertEquals(
                12.5,
                values.path(fieldPrefix + "Number").asDouble(),
                "BUSINESS: " + label + " returns NUMBER raw value");
        assertEquals(
                "2026-09-15",
                values.path(fieldPrefix + "Date").asText(),
                "BUSINESS: " + label + " returns DATE raw value");
        assertTrue(
                values.path(fieldPrefix + "Boolean").asBoolean(), "BUSINESS: " + label + " returns BOOLEAN raw value");
        assertEquals(
                "直营", values.path(fieldPrefix + "Select").asText(), "BUSINESS: " + label + " returns SELECT raw value");
    }

    @AcceptanceScenario(
            id = "contract.lifecycle-preserves-fields",
            module = "CONTRACT",
            operation = "commercialContractLifecycle")
    void commercialContractLifecyclePreservesFields(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE", "BC-CONTRACT-EDIT", "BC-CONTRACT-INVALIDATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response created = context.post(
                OPERATIONS_CONTRACT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                session.cookie(),
                Map.of(
                        "storeId",
                        fixture.storeId().toString(),
                        "phaseName",
                        "Opening",
                        "contractNo",
                        "ACCEPT-CONTRACT-001",
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "created-by-http",
                        "items",
                        List.of(
                                Map.of("code", "LATTE", "name", "Latte"),
                                Map.of("code", "ESPRESSO", "name", "Espresso")),
                        "extensionValues",
                        List.of()),
                Set.of(201));
        String contractId = created.json().path("id").asText();
        assertEquals(
                "VALID", created.json().path("status").asText(), "BUSINESS: active owner status maps to wire VALID");
        assertEquals(
                "ACCEPT-CONTRACT-001",
                created.json().path("contractNo").asText(),
                "BUSINESS: contract number is written");
        assertEquals(
                fixture.storeId().toString(),
                created.json().path("store").path("id").asText(),
                "BUSINESS: contract remains bound to the selected store");
        assertEquals(
                "LATTE",
                created.json().path("items").get(0).path("code").asText(),
                "BUSINESS: contract item code is written");
        assertEquals(1, created.json().path("revision").asInt(), "BUSINESS: contract starts at revision one");
        BackendAcceptanceTest.Response updated = context.patch(
                OPERATIONS_CONTRACT_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId,
                session.cookie(),
                Map.of(
                        "phaseName",
                        "Opening",
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "updated-by-http",
                        "items",
                        List.of(
                                Map.of("code", "LATTE", "name", "Latte Updated"),
                                Map.of("code", "ESPRESSO", "name", "Espresso Updated")),
                        "extensionValues",
                        List.of(),
                        "expectedVersion",
                        1),
                Set.of(200));
        assertEquals("updated-by-http", updated.json().path("note").asText(), "BUSINESS: update writes the note");
        assertEquals(
                "Latte Updated",
                updated.json().path("items").get(0).path("name").asText(),
                "BUSINESS: update writes item labels");
        assertEquals(2, updated.json().path("revision").asInt(), "BUSINESS: update uses CAS revision two");
        BackendAcceptanceTest.Response invalidated = context.post(
                OPERATIONS_CONTRACT_INVALIDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId
                        + "/invalidate",
                session.cookie(),
                Map.of("expectedVersion", 2),
                Set.of(200));
        assertEquals(
                "INVALID", invalidated.json().path("status").asText(), "BUSINESS: invalidation maps to wire INVALID");
        assertEquals(3, invalidated.json().path("revision").asInt(), "BUSINESS: invalidation is versioned");
        BackendAcceptanceTest.Response detail = context.get(
                OPERATIONS_CONTRACT,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId
                        + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertEquals(
                "INVALID",
                detail.json().path("status").asText(),
                "BUSINESS: invalid contract remains readable as history");
        assertEquals(
                "Latte Updated",
                detail.json().path("items").get(0).path("name").asText(),
                "BUSINESS: invalidation preserves contract items");

        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        BackendAcceptanceTest.Response platformPage = context.get(
                PLATFORM_CONTRACT_OVERVIEW_PAGE,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                        + "/contract-overview?contractNo=ACCEPT-CONTRACT-001&page=1&pageSize=50",
                platform.cookie(),
                Set.of(200));
        assertEquals(1, platformPage.json().path("items").size(), "BUSINESS: filtered overview has one contract");
        assertEquals(
                "ACCEPT-CONTRACT-001",
                oracle(
                                platformPage.json(),
                                "getPlatformContractOverviewPage",
                                "/items/0/contractRef/code",
                                JsonNodeType.STRING,
                                "platform contract overview identity")
                        .asText(),
                "BUSINESS: overview identity matches the HTTP-created contract");
        assertEquals(
                "Opening",
                oracle(
                                platformPage.json(),
                                "getPlatformContractOverviewPage",
                                "/items/0/phaseName",
                                JsonNodeType.STRING,
                                "platform contract overview phase")
                        .asText(),
                "BUSINESS: platform overview preserves the contract phase");
        assertEquals(
                expectedItems("LATTE", "Latte Updated", "ESPRESSO", "Espresso Updated"),
                oracle(
                        platformPage.json(),
                        "getPlatformContractOverviewPage",
                        "/items/0/items",
                        JsonNodeType.ARRAY,
                        "platform contract overview items"),
                "BUSINESS: platform overview preserves ordered item facts");

        BackendAcceptanceTest.Response platformDetail = context.get(
                PLATFORM_CONTRACT_OVERVIEW_DETAIL,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/contract-overview/" + contractId,
                platform.cookie(),
                Set.of(200));
        assertEquals(
                "Opening",
                oracle(
                                platformDetail.json(),
                                "getPlatformContractOverviewDetail",
                                "/phaseName",
                                JsonNodeType.STRING,
                                "platform contract overview detail phase")
                        .asText(),
                "BUSINESS: platform detail preserves the contract phase");
        assertEquals(
                expectedItems("LATTE", "Latte Updated", "ESPRESSO", "Espresso Updated"),
                oracle(
                        platformDetail.json(),
                        "getPlatformContractOverviewDetail",
                        "/items",
                        JsonNodeType.ARRAY,
                        "platform contract overview detail items"),
                "BUSINESS: platform detail preserves ordered item facts");

        BackendAcceptanceTest.Response nullPhaseContract = context.post(
                OPERATIONS_CONTRACT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                session.cookie(),
                Map.of(
                        "storeId", fixture.storeId().toString(),
                        "phaseName", "Opening",
                        "contractNo", "ACCEPT-CONTRACT-NULL-PHASE",
                        "effectiveFrom", "2026-01-01",
                        "effectiveTo", "2026-12-31",
                        "note", "nullable-phase-fixture",
                        "items", List.of(Map.of("code", "MOCHA", "name", "Mocha")),
                        "extensionValues", List.of()),
                Set.of(201));
        String nullPhaseContractId = nullPhaseContract.json().path("id").asText();
        assertEquals(
                1,
                host.update(
                        "UPDATE contract.store_contract SET phase_name_snapshot=NULL WHERE id=?",
                        java.util.UUID.fromString(nullPhaseContractId)),
                "BUSINESS: nullable phase fixture changes the persisted raw fact");
        BackendAcceptanceTest.Response nullPhasePage = context.get(
                PLATFORM_CONTRACT_OVERVIEW_PAGE,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                        + "/contract-overview?contractNo=ACCEPT-CONTRACT-NULL-PHASE&page=1&pageSize=50",
                platform.cookie(),
                Set.of(200));
        assertEquals(
                1, nullPhasePage.json().path("items").size(), "BUSINESS: nullable phase overview has one contract");
        assertEquals(
                "ACCEPT-CONTRACT-NULL-PHASE",
                oracle(
                                nullPhasePage.json(),
                                "getPlatformContractOverviewPage",
                                "/items/0/contractRef/code",
                                JsonNodeType.STRING,
                                "nullable phase overview identity")
                        .asText(),
                "BUSINESS: nullable phase overview preserves contract identity");
        oracleNull(
                nullPhasePage.json(),
                "getPlatformContractOverviewPage",
                "/items/0/phaseName",
                "nullable phase overview raw fact");
        assertEquals(
                expectedItems("MOCHA", "Mocha"),
                oracle(
                        nullPhasePage.json(),
                        "getPlatformContractOverviewPage",
                        "/items/0/items",
                        JsonNodeType.ARRAY,
                        "nullable phase overview items"),
                "BUSINESS: nullable phase overview preserves ordered item facts");

        BackendAcceptanceTest.Response nullPhaseDetail = context.get(
                PLATFORM_CONTRACT_OVERVIEW_DETAIL,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/contract-overview/"
                        + nullPhaseContractId,
                platform.cookie(),
                Set.of(200));
        oracleNull(
                nullPhaseDetail.json(),
                "getPlatformContractOverviewDetail",
                "/phaseName",
                "nullable phase detail raw fact");
        assertEquals(
                expectedItems("MOCHA", "Mocha"),
                oracle(
                        nullPhaseDetail.json(),
                        "getPlatformContractOverviewDetail",
                        "/items",
                        JsonNodeType.ARRAY,
                        "nullable phase detail items"),
                "BUSINESS: nullable phase detail preserves ordered item facts");
    }

    @AcceptanceScenario(
            id = "contract.create-rejects-disabled-store-or-tenant",
            module = "CONTRACT",
            operation = "createOperationsContract")
    void createRejectsDisabledStoreOrTenant(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        for (String status : List.of("DISABLED", "VOIDED")) {
            String contractNo = "ACCEPT-" + status + "-STORE";
            host.update("UPDATE organization.store SET status=? WHERE id=?", status, fixture.storeId());
            BackendAcceptanceTest.Response blockedStore = context.post(
                    OPERATIONS_CONTRACT_CREATE,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                    session.cookie(),
                    Map.of(
                            "storeId",
                            fixture.storeId().toString(),
                            "phaseName",
                            "Opening",
                            "contractNo",
                            contractNo,
                            "effectiveFrom",
                            "2026-01-01",
                            "effectiveTo",
                            "2026-12-31",
                            "note",
                            status.toLowerCase(java.util.Locale.ROOT) + "-store",
                            "items",
                            List.of(Map.of("code", "BLOCKED-STORE-" + status, "name", "Blocked Store")),
                            "extensionValues",
                            List.of()),
                    Set.of(422));
            assertEquals(
                    "PLATFORM_COMMON_VALIDATION_FAILED",
                    blockedStore.problemCode(),
                    "BUSINESS: " + status + " store is rejected by contract create admission");
            assertEquals(
                    0,
                    host.count(
                            "SELECT count(*) FROM contract.store_contract WHERE workspace_uuid=? AND contract_no=?",
                            fixture.workspaceUuid(),
                            contractNo),
                    "BUSINESS: " + status + " store create writes no contract");
            host.update("UPDATE organization.store SET status='ENABLED' WHERE id=?", fixture.storeId());
        }
        for (String status : List.of("DISABLED", "VOIDED")) {
            String contractNo = "ACCEPT-" + status + "-TENANT";
            host.update("UPDATE organization.tenant SET status=? WHERE id=?", status, fixture.tenantId());
            BackendAcceptanceTest.Response blockedTenant = context.post(
                    OPERATIONS_CONTRACT_CREATE,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                    session.cookie(),
                    Map.of(
                            "storeId",
                            fixture.storeId().toString(),
                            "phaseName",
                            "Opening",
                            "contractNo",
                            contractNo,
                            "effectiveFrom",
                            "2026-01-01",
                            "effectiveTo",
                            "2026-12-31",
                            "note",
                            status.toLowerCase(java.util.Locale.ROOT) + "-tenant",
                            "items",
                            List.of(Map.of("code", "BLOCKED-TENANT-" + status, "name", "Blocked Tenant")),
                            "extensionValues",
                            List.of()),
                    Set.of(422));
            assertEquals(
                    "PLATFORM_COMMON_VALIDATION_FAILED",
                    blockedTenant.problemCode(),
                    "BUSINESS: " + status + " tenant is rejected by contract create admission");
            assertEquals(
                    0,
                    host.count(
                            "SELECT count(*) FROM contract.store_contract WHERE workspace_uuid=? AND contract_no=?",
                            fixture.workspaceUuid(),
                            contractNo),
                    "BUSINESS: " + status + " tenant create writes no contract");
            host.update("UPDATE organization.tenant SET status='ENABLED' WHERE id=?", fixture.tenantId());
        }
    }

    @AcceptanceScenario(
            id = "contract.stale-edit-preserves-fixed-bindings",
            module = "CONTRACT",
            operation = "staleContractEditPreservesBindings")
    void staleContractEditPreservesFixedBindings(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE", "BC-CONTRACT-EDIT"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response created = context.post(
                OPERATIONS_CONTRACT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                session.cookie(),
                Map.of(
                        "storeId",
                        fixture.storeId().toString(),
                        "phaseName",
                        "Opening",
                        "contractNo",
                        "ACCEPT-CONTRACT-STALE",
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "initial",
                        "items",
                        List.of(Map.of("code", "LATTE", "name", "Latte")),
                        "extensionValues",
                        List.of()),
                Set.of(201));
        String contractId = created.json().path("id").asText();
        BackendAcceptanceTest.Response updated = context.patch(
                OPERATIONS_CONTRACT_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId,
                session.cookie(),
                Map.of(
                        "phaseName",
                        "Opening",
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "first-writer",
                        "items",
                        List.of(Map.of("code", "LATTE", "name", "Latte")),
                        "extensionValues",
                        List.of(),
                        "expectedVersion",
                        1),
                Set.of(200));
        assertEquals(
                2,
                updated.json().path("revision").asInt(),
                "BUSINESS: first contract edit advances the owner revision");
        BackendAcceptanceTest.Response stale = context.patch(
                OPERATIONS_CONTRACT_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId,
                session.cookie(),
                Map.of(
                        "phaseName",
                        "Opening",
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "stale-writer",
                        "items",
                        List.of(Map.of("code", "LATTE", "name", "Latte")),
                        "extensionValues",
                        List.of(),
                        "expectedVersion",
                        1),
                Set.of(409));
        assertEquals(
                "CONTRACT_VERSION_CONFLICT",
                stale.problemCode(),
                "BUSINESS: stale contract edit is rejected by the contract owner");
        BackendAcceptanceTest.Response detail = context.get(
                OPERATIONS_CONTRACT,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId
                        + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertEquals(
                "first-writer",
                detail.json().path("note").asText(),
                "BUSINESS: stale edit cannot overwrite the accepted note");
        assertEquals(
                "ACCEPT-CONTRACT-STALE",
                detail.json().path("contractNo").asText(),
                "BUSINESS: contract number remains fixed after a stale edit");
        assertEquals(
                fixture.storeId().toString(),
                detail.json().path("store").path("id").asText(),
                "BUSINESS: stale edit cannot change the fixed store binding");
    }

    @AcceptanceScenario(
            id = "contract.invalidation-updates-store-derived-status",
            module = "CONTRACT",
            operation = "contractInvalidationUpdatesStoreStatus")
    void contractInvalidationUpdatesStoreDerivedStatus(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE", "BC-CONTRACT-INVALIDATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response created = context.post(
                OPERATIONS_CONTRACT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts",
                session.cookie(),
                Map.of(
                        "storeId",
                        fixture.storeId().toString(),
                        "phaseName",
                        "Opening",
                        "contractNo",
                        "ACCEPT-CONTRACT-DERIVED",
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "derived-status",
                        "items",
                        List.of(Map.of("code", "LATTE", "name", "Latte")),
                        "extensionValues",
                        List.of()),
                Set.of(201));
        String contractId = created.json().path("id").asText();
        BackendAcceptanceTest.Response operating = context.get(
                OPERATIONS_ORGANIZATION_STORE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/"
                        + fixture.storeId() + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertEquals(
                "ENABLED",
                operating.json().path("status").asText(),
                "BUSINESS: contract state does not change store master status");
        assertEquals(
                "OPERATING",
                operating.json().path("contractDerivedStatus").asText(),
                "BUSINESS: an effective valid contract makes the store derived status operating");
        BackendAcceptanceTest.Response invalidated = context.post(
                OPERATIONS_CONTRACT_INVALIDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId
                        + "/invalidate",
                session.cookie(),
                Map.of("expectedVersion", 1),
                Set.of(200));
        assertEquals(
                "INVALID", invalidated.json().path("status").asText(), "BUSINESS: contract invalidation is persisted");
        BackendAcceptanceTest.Response notOperating = context.get(
                OPERATIONS_ORGANIZATION_STORE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/"
                        + fixture.storeId() + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertEquals(
                "ENABLED",
                notOperating.json().path("status").asText(),
                "BUSINESS: invalidating a contract does not disable store master data");
        assertEquals(
                "NOT_OPERATING",
                notOperating.json().path("contractDerivedStatus").asText(),
                "BUSINESS: invalidating the only effective contract recomputes derived status");
    }

    private static ArrayNode expectedItems(String... codeNamePairs) {
        assertEquals(0, codeNamePairs.length % 2, "BUSINESS: contract item fixture has code/name pairs");
        ArrayNode items = JsonNodeFactory.instance.arrayNode();
        for (int index = 0; index < codeNamePairs.length; index += 2) {
            ObjectNode item = items.addObject();
            item.put("code", codeNamePairs[index]);
            item.put("name", codeNamePairs[index + 1]);
        }
        return items;
    }

    private static JsonNode oracle(
            JsonNode json, String operationId, String pointer, JsonNodeType type, String message) {
        JsonNode value = json.at(pointer);
        assertFalse(value.isMissingNode(), operationId + ": " + message + ": missing " + pointer);
        assertEquals(type, value.getNodeType(), operationId + ": " + message + ": wrong type " + pointer);
        assertFalse(value.isNull(), operationId + ": " + message + ": null " + pointer);
        return value;
    }

    private static JsonNode oracleNull(JsonNode json, String operationId, String pointer, String message) {
        JsonNode value = json.at(pointer);
        assertFalse(value.isMissingNode(), operationId + ": " + message + ": missing " + pointer);
        assertTrue(value.isNull(), operationId + ": " + message + ": expected null " + pointer);
        return value;
    }
}
