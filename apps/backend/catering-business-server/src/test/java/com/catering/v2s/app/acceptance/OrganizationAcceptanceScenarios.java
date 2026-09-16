package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static com.catering.v2s.app.acceptance.ExtensionAcceptanceScenarios.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.StreamSupport;

final class OrganizationAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    OrganizationAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "org.commercial-group-workspace-initialization",
            module = "ORG",
            operation = "initializeCommercialGroup")
    void commercialGroupWorkspaceInitialization(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.WorkspaceFixture workspace = host.workspaceOnly();
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session session = host.platformLogin(context);
        String idempotencyKey = "acceptance-commercial-group-" + java.util.UUID.randomUUID();
        BackendAcceptanceTest.Response initialized = context.post(
                PLATFORM_COMMERCIAL_GROUP_INITIALIZE,
                "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey() + "/commercial-group",
                session.cookie(),
                Map.of(
                        "groupCode",
                        "ACCEPTANCE-GROUP",
                        "groupName",
                        "Acceptance Commercial Group",
                        "idempotencyKey",
                        idempotencyKey,
                        "extensionValues",
                        Map.of()),
                Map.of("Idempotency-Key", idempotencyKey),
                Set.of(201));
        assertEquals(
                workspace.groupWorkspaceKey(),
                initialized.json().path("groupWorkspaceKey").asText(),
                "BUSINESS: initialization writes the requested workspace identity");
        assertEquals(
                "ACCEPTANCE-GROUP",
                initialized.json().path("groupCode").asText(),
                "BUSINESS: initialization returns the commercial-group code from the owner");
        assertFalse(
                initialized.json().path("id").asText().isBlank(),
                "BUSINESS: initialization returns the newly established commercial-group identity");

        BackendAcceptanceTest.Response detail = context.get(
                PLATFORM_GROUP_WORKSPACE_DETAIL,
                "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey(),
                session.cookie(),
                Set.of(200));
        JsonNode commercialGroup = detail.json().path("commercialGroup");
        assertTrue(
                commercialGroup.path("initialized").asBoolean(false),
                "BUSINESS: the workspace projection reports commercial-group initialization");
        assertEquals(
                "Acceptance Commercial Group",
                commercialGroup.path("root").path("groupName").asText(),
                "BUSINESS: detail readback uses the persisted commercial-group name");
        assertTrue(
                commercialGroup.path("root").path("extensionValues").isObject(),
                "BUSINESS: detail readback returns the extension projection even when no definition is configured");
    }

    @AcceptanceScenario(id = "org.project-state-and-readback", module = "ORG", operation = "organizationProjectState")
    void organizationProjectStateAndReadback(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("PROJECT", Set.of("BC-ORG-PROJECT-EDIT", "BC-ORG-PROJECT-STATUS"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response updated = context.patch(
                OPERATIONS_ORGANIZATION_NODE_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/hierarchy/" + fixture.projectId(),
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-project",
                        "name",
                        "Acceptance Project Updated",
                        "parentId",
                        fixture.regionId().toString(),
                        "phases",
                        List.of(Map.of("name", "Opening")),
                        "notes",
                        "updated-by-http",
                        "expectedVersion",
                        1,
                        "extensionValues",
                        List.of()),
                Set.of(200));
        assertEquals(
                "Acceptance Project Updated",
                updated.json().path("name").asText(),
                "BUSINESS: project write is read back from the owner");
        assertEquals("updated-by-http", updated.json().path("notes").asText(), "BUSINESS: project notes are persisted");
        assertEquals(2, updated.json().path("revision").asInt(), "BUSINESS: CAS write advances project revision");
        BackendAcceptanceTest.Response disabled = context.post(
                OPERATIONS_ORGANIZATION_NODE_STATUS,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/hierarchy/" + fixture.projectId()
                        + "/status",
                session.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", 2),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabled.json().path("status").asText(),
                "BUSINESS: project status transition is persisted");
        assertEquals(3, disabled.json().path("revision").asInt(), "BUSINESS: status transition is versioned");
        BackendAcceptanceTest.Response hierarchyRead = context.get(
                OPERATIONS_ORGANIZATION_HIERARCHY,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/hierarchy",
                session.cookie(),
                Set.of(200));
        JsonNode project = StreamSupport.stream(
                        hierarchyRead.json().path("items").spliterator(), false)
                .filter(node ->
                        fixture.projectId().toString().equals(node.path("id").asText()))
                .findFirst()
                .orElseThrow();
        assertEquals("DISABLED", project.path("status").asText(), "BUSINESS: hierarchy read uses the persisted state");
        assertEquals(
                "Acceptance Project Updated",
                project.path("name").asText(),
                "BUSINESS: hierarchy read uses the persisted fields");
    }

    @AcceptanceScenario(id = "org.store-state-and-derived-status", module = "ORG", operation = "organizationStoreState")
    void organizationStoreStateAndDerivedStatus(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("PROJECT", Set.of("BC-ORG-STORE-CREATE", "BC-ORG-STORE-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        Map<String, Object> createStoreBody = new LinkedHashMap<>();
        createStoreBody.put("brandId", fixture.brandId().toString());
        createStoreBody.put("tenantId", fixture.tenantId().toString());
        createStoreBody.put("headCompanyId", null);
        createStoreBody.put("code", "acceptance-store-http");
        createStoreBody.put("name", "Acceptance HTTP Store");
        createStoreBody.put("notes", "created-by-http");
        createStoreBody.put("extensionValues", List.of());
        BackendAcceptanceTest.Response created = context.post(
                OPERATIONS_ORGANIZATION_STORE_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores",
                session.cookie(),
                createStoreBody,
                Set.of(201));
        String storeId = created.json().path("id").asText();
        assertTrue(!storeId.isBlank(), "BUSINESS: store create returns the written identifier");
        assertEquals("ENABLED", created.json().path("status").asText(), "BUSINESS: store starts enabled");
        assertEquals(
                "NOT_OPERATING",
                created.json().path("contractDerivedStatus").asText(),
                "BUSINESS: a store without a valid contract is not operating independently of store master status");
        assertEquals("Acceptance HTTP Store", created.json().path("name").asText(), "BUSINESS: store name is written");
        long version = created.json().path("revision").asLong();
        Map<String, Object> updateStoreBody = new LinkedHashMap<>();
        updateStoreBody.put("name", "Acceptance HTTP Store Updated");
        updateStoreBody.put("headCompanyId", null);
        updateStoreBody.put("notes", "updated-by-http");
        updateStoreBody.put("extensionValues", List.of());
        updateStoreBody.put("extensionRuleRevision", 0);
        updateStoreBody.put("expectedVersion", version);
        updateStoreBody.put("operatingRuleSwitches", acceptanceStoreOperatingRuleSwitches());
        BackendAcceptanceTest.Response updated = context.patch(
                OPERATIONS_ORGANIZATION_STORE_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/" + storeId,
                session.cookie(),
                updateStoreBody,
                Set.of(200));
        assertEquals(
                "Acceptance HTTP Store Updated",
                updated.json().path("name").asText(),
                "BUSINESS: store update is read back");
        assertEquals(version + 1, updated.json().path("revision").asLong(), "BUSINESS: store update is CAS versioned");
        BackendAcceptanceTest.Response disabled = context.post(
                OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/" + storeId
                        + "/status",
                session.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", version + 1),
                Set.of(200));
        assertEquals(
                "DISABLED", disabled.json().path("status").asText(), "BUSINESS: store status transition is persisted");
        assertEquals(
                "NOT_OPERATING",
                disabled.json().path("contractDerivedStatus").asText(),
                "BUSINESS: disabling the store does not rewrite contract-derived status");
        BackendAcceptanceTest.Response detail = context.get(
                OPERATIONS_ORGANIZATION_STORE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/" + storeId
                        + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertEquals(
                "Acceptance HTTP Store Updated",
                detail.json().path("name").asText(),
                "BUSINESS: fresh detail returns the write");
        assertEquals("DISABLED", detail.json().path("status").asText(), "BUSINESS: fresh detail returns the status");
    }

    @AcceptanceScenario(
            id = "org.store-operating-rule-read-write-and-assignment-scope",
            module = "ORG",
            operation = "getOperationsOrganizationStoreOperatingRule")
    void storeOperatingRuleReadWriteAndAssignmentScope(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture projectFixture =
                host.fixture("PROJECT", Set.of("BC-ORG-STORE-EDIT"));
        host.completeInvitation(context, projectFixture);
        BackendAcceptanceTest.Session projectSession = selectStore(context, projectFixture, host.login(context, projectFixture));

        BackendAcceptanceTest.Response projectRead = context.get(
                OPERATIONS_ORGANIZATION_STORE_OPERATING_RULE,
                "/api/operations/group-workspaces/" + projectFixture.groupWorkspaceKey()
                        + "/organization/stores/" + projectFixture.storeId()
                        + "/operating-rule-switches?expectedContextVersion=" + projectSession.contextVersion(),
                projectSession.cookie(),
                Set.of(200));
        assertOperatingRules(
                projectRead.json(),
                acceptanceStoreOperatingRuleSwitches(),
                "BUSINESS: project assignment reads the selected Store rule owner fact");
        long version = projectRead.json().path("revision").asLong();

        Map<String, Object> parentClosedChildOpen = new LinkedHashMap<>(acceptanceStoreOperatingRuleSwitches());
        parentClosedChildOpen.put("catalogManagementEnabled", false);
        parentClosedChildOpen.put("externalCatalogSyncEnabled", true);
        parentClosedChildOpen.put("openPlatformDeveloperCode", "acceptance-developer");
        Map<String, Object> updateStoreBody = new LinkedHashMap<>();
        updateStoreBody.put("name", "Acceptance Store");
        updateStoreBody.put("headCompanyId", null);
        updateStoreBody.put("notes", "rule-scope-update");
        updateStoreBody.put("extensionValues", List.of());
        updateStoreBody.put("extensionRuleRevision", 0);
        updateStoreBody.put("expectedVersion", version);
        updateStoreBody.put("operatingRuleSwitches", parentClosedChildOpen);
        BackendAcceptanceTest.Response updated = context.patch(
                OPERATIONS_ORGANIZATION_STORE_UPDATE,
                "/api/operations/group-workspaces/" + projectFixture.groupWorkspaceKey()
                        + "/organization/stores/" + projectFixture.storeId(),
                projectSession.cookie(),
                updateStoreBody,
                Map.of("Idempotency-Key", "acceptance-store-operating-rule-" + UUID.randomUUID()),
                Set.of(200));
        assertOperatingRules(
                updated.json(),
                parentClosedChildOpen,
                "BUSINESS: parent false and child true are retained as a legal stored combination");

        BackendAcceptanceTest.Response projectReadback = context.get(
                OPERATIONS_ORGANIZATION_STORE_OPERATING_RULE,
                "/api/operations/group-workspaces/" + projectFixture.groupWorkspaceKey()
                        + "/organization/stores/" + projectFixture.storeId()
                        + "/operating-rule-switches?expectedContextVersion=" + projectSession.contextVersion(),
                projectSession.cookie(),
                Set.of(200));
        assertOperatingRules(
                projectReadback.json(),
                parentClosedChildOpen,
                "BUSINESS: project readback returns the persisted rule map after update");

        BackendAcceptanceTest.Fixture storeFixture = host.storeUserFixture(projectFixture, Set.of());
        host.completeInvitation(context, storeFixture);
        BackendAcceptanceTest.Session storeSession = selectStore(context, storeFixture, host.login(context, storeFixture));
        BackendAcceptanceTest.Response storeRead = context.get(
                OPERATIONS_ORGANIZATION_STORE_OPERATING_RULE,
                "/api/operations/group-workspaces/" + storeFixture.groupWorkspaceKey()
                        + "/organization/stores/" + storeFixture.storeId()
                        + "/operating-rule-switches?expectedContextVersion=" + storeSession.contextVersion(),
                storeSession.cookie(),
                Set.of(200));
        assertOperatingRules(
                storeRead.json(),
                parentClosedChildOpen,
                "BUSINESS: Store assignment reads only its own selected Store rule fact");
    }

    private static BackendAcceptanceTest.Session selectStore(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session)
            throws Exception {
        BackendAcceptanceTest.Response selected = context.post(
                OPERATIONS_WORKSPACE_SESSION_DATA_NODE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/session/data-node",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId(),
                        "dataNodeType", "STORE",
                        "requiredContextVersion", session.contextVersion()),
                Set.of(200));
        assertEquals(
                fixture.storeId().toString(),
                selected.json().path("scopeContext").path("store").path("dataNodeRef").asText(),
                "BUSINESS: operating-rule scenario selects the intended Store");
        return new BackendAcceptanceTest.Session(
                session.cookie(), selected.json(), selected.json().path("contextVersion").asLong());
    }

    private static void assertOperatingRules(
            JsonNode store, Map<String, Object> expected, String message) {
        JsonNode values = store.path("operatingRuleSwitches");
        assertTrue(values.isObject(), message + ": values object");
        assertEquals(expected.size(), values.size(), message + ": complete value count");
        expected.forEach((key, value) -> {
            assertTrue(values.has(key), message + ": key " + key);
            assertEquals(String.valueOf(value), values.path(key).asText(), message + ": value " + key);
        });
    }

    @AcceptanceScenario(
            id = "org.business-entity-fields-and-status",
            module = "ORG",
            operation = "businessEntityFieldsAndStatus")
    void businessEntityFieldsAndStatus(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture(
                "GROUP",
                Set.of(
                        "BC-ORG-BRAND-CREATE",
                        "BC-ORG-BRAND-EDIT",
                        "BC-ORG-BRAND-STATUS",
                        "BC-ORG-TENANT-CREATE",
                        "BC-ORG-TENANT-STATUS",
                        "BC-ORG-HEAD-COMPANY-CREATE",
                        "BC-ORG-HEAD-COMPANY-STATUS"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);

        BackendAcceptanceTest.Response brand = context.post(
                OPERATIONS_ORGANIZATION_BRAND_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/brands",
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-http-brand",
                        "name",
                        "Acceptance HTTP Brand",
                        "alias",
                        "AHB",
                        "remark",
                        "brand-remark",
                        "extensionValues",
                        List.of()),
                Set.of(201));
        assertEquals("acceptance-http-brand", brand.json().path("code").asText(), "BUSINESS: brand code is written");
        assertEquals("AHB", brand.json().path("alias").asText(), "BUSINESS: brand alias is written");
        assertEquals("ENABLED", brand.json().path("status").asText(), "BUSINESS: brand starts enabled by owner policy");
        BackendAcceptanceTest.Response brandUpdated = context.patch(
                OPERATIONS_ORGANIZATION_BRAND_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/brands/"
                        + brand.json().path("id").asText(),
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-http-brand",
                        "name",
                        "Acceptance HTTP Brand Updated",
                        "alias",
                        "AHBU",
                        "remark",
                        "updated-brand-remark",
                        "expectedVersion",
                        1,
                        "extensionValues",
                        List.of()),
                Set.of(200));
        assertEquals(
                "Acceptance HTTP Brand Updated",
                brandUpdated.json().path("name").asText(),
                "BUSINESS: brand edit preserves the business fields through owner readback");
        assertEquals(2, brandUpdated.json().path("revision").asInt(), "BUSINESS: brand edit is versioned");
        BackendAcceptanceTest.Response brandDisabled = context.post(
                OPERATIONS_ORGANIZATION_BRAND_STATUS,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/brands/"
                        + brand.json().path("id").asText() + "/status",
                session.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", 2),
                Set.of(200));
        assertEquals(
                "DISABLED",
                brandDisabled.json().path("status").asText(),
                "BUSINESS: brand status transition is persisted");

        BackendAcceptanceTest.Response tenant = context.post(
                OPERATIONS_ORGANIZATION_TENANT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/tenants",
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-http-tenant",
                        "name",
                        "Acceptance HTTP Tenant",
                        "legalName",
                        "Acceptance HTTP Tenant Ltd",
                        "unifiedSocialCreditCode",
                        "91310000HTTPACCEPT",
                        "remark",
                        "tenant-remark",
                        "extensionValues",
                        List.of()),
                Set.of(201));
        assertEquals(
                "Acceptance HTTP Tenant Ltd",
                tenant.json().path("legalName").asText(),
                "BUSINESS: tenant legal identity is written as a distinct field");
        assertEquals(
                "91310000HTTPACCEPT",
                tenant.json().path("unifiedSocialCreditCode").asText(),
                "BUSINESS: tenant credit code is not conflated with its business code");
        BackendAcceptanceTest.Response tenantDisabled = context.post(
                OPERATIONS_ORGANIZATION_TENANT_STATUS,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/tenants/"
                        + tenant.json().path("id").asText() + "/status",
                session.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", 1),
                Set.of(200));
        assertEquals(
                "DISABLED",
                tenantDisabled.json().path("status").asText(),
                "BUSINESS: tenant status is independent and persisted");

        BackendAcceptanceTest.Response headCompany = context.post(
                OPERATIONS_ORGANIZATION_HEAD_COMPANY_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies",
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-http-head-company",
                        "name",
                        "Acceptance HTTP Head Company",
                        "legalName",
                        "Acceptance HTTP Head Company Ltd",
                        "unifiedSocialCreditCode",
                        "91310000HEADHTTP",
                        "remark",
                        "head-company-remark",
                        "extensionValues",
                        List.of()),
                Set.of(201));
        assertEquals(
                "Acceptance HTTP Head Company Ltd",
                headCompany.json().path("legalName").asText(),
                "BUSINESS: head-company legal profile is written");
        assertTrue(
                headCompany.json().path("authorizedBrands").isArray()
                        && headCompany.json().path("authorizedBrands").isEmpty(),
                "BUSINESS: a new head company has no implicit brand authorization");
        BackendAcceptanceTest.Response headCompanyDisabled = context.post(
                OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies/"
                        + headCompany.json().path("id").asText() + "/status",
                session.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", 1),
                Set.of(200));
        assertEquals(
                "DISABLED",
                headCompanyDisabled.json().path("status").asText(),
                "BUSINESS: head-company status is persisted separately from brand and tenant status");
    }

    @AcceptanceScenario(
            id = "org.brand-extension-filtered-list",
            module = "ORG",
            operation = "getOperationsOrganizationBrands")
    void brandExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        organizationExtensionFilteredList(
                context,
                "BRAND",
                OPERATIONS_ORGANIZATION_BRANDS,
                "/organization/brands",
                Set.of("BC-ORG-BRAND-CREATE"));
    }

    @AcceptanceScenario(
            id = "org.tenant-extension-filtered-list",
            module = "ORG",
            operation = "getOperationsOrganizationTenants")
    void tenantExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        organizationExtensionFilteredList(
                context,
                "TENANT",
                OPERATIONS_ORGANIZATION_TENANTS,
                "/organization/tenants",
                Set.of("BC-ORG-TENANT-CREATE"));
    }

    @AcceptanceScenario(
            id = "org.head-company-extension-filtered-list",
            module = "ORG",
            operation = "getOperationsOrganizationHeadCompanies")
    void headCompanyExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        organizationExtensionFilteredList(
                context,
                "HEAD_COMPANY",
                OPERATIONS_ORGANIZATION_HEAD_COMPANIES,
                "/organization/head-companies",
                Set.of("BC-ORG-HEAD-COMPANY-CREATE"));
    }

    @AcceptanceScenario(
            id = "org.store-extension-filtered-list",
            module = "ORG",
            operation = "getOperationsOrganizationStores")
    void storeExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        organizationExtensionFilteredList(
                context,
                "STORE",
                OPERATIONS_ORGANIZATION_STORES,
                "/organization/stores",
                Set.of("BC-ORG-STORE-CREATE"));
    }

    @AcceptanceScenario(
            id = "org.platform-organization-extension-filtered-list",
            module = "ORG",
            operation = "getPlatformOrganizationOverviewPage")
    void platformOrganizationExtensionFilteredList(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture(
                "GROUP",
                Set.of(
                        "BC-ORG-BRAND-CREATE",
                        "BC-ORG-TENANT-CREATE",
                        "BC-ORG-HEAD-COMPANY-CREATE"));
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        for (String hostType : List.of("BRAND", "TENANT", "HEAD_COMPANY", "STORE")) {
            replaceDefinition(
                    context,
                    fixture.groupWorkspaceKey(),
                    platform.cookie(),
                    hostType,
                    typedFlatFieldsFor("organizationFilter"));
        }
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        for (String hostType : List.of("BRAND", "TENANT", "HEAD_COMPANY")) {
            createOrganizationExtensionEntity(
                    context, fixture, operations, hostType, "A", "organizationFilter", "platform-match");
            createOrganizationExtensionEntity(
                    context, fixture, operations, hostType, "B", "organizationFilter", "platform-match");
            createOrganizationExtensionEntity(
                    context, fixture, operations, hostType, "C", "organizationFilter", "platform-non-match");
        }
        BackendAcceptanceTest.Fixture projectFixture = host.projectUserFixture(
                fixture, Set.of("BC-ORG-STORE-CREATE"));
        host.completeInvitation(context, projectFixture);
        BackendAcceptanceTest.Session projectOperations = host.login(context, projectFixture);
        for (String suffix : List.of("A", "B")) {
            createOrganizationExtensionEntity(
                    context, fixture, projectOperations, "STORE", suffix, "organizationFilter", "platform-match");
        }
        createOrganizationExtensionEntity(
                context, fixture, projectOperations, "STORE", "C", "organizationFilter", "platform-non-match");
        for (String hostType : List.of("BRAND", "TENANT", "HEAD_COMPANY", "STORE")) {
            assertPlatformOrganizationIdentity(context, fixture, platform, hostType, "organizationFilter");
        }
        Response hierarchyPage = context.get(
                PLATFORM_ORGANIZATION_OVERVIEW,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                        + "/organization-overview?category=HIERARCHY&page=1&pageSize=10",
                platform.cookie(),
                Set.of(200));
        assertFalse(
                hierarchyPage.json().path("items").isEmpty(),
                "BUSINESS: platform hierarchy overview returns hierarchy items");
        JsonNode hierarchyItem = hierarchyPage.json().path("items").get(0);
        assertTrue(
                hierarchyItem.has("extensionFields"),
                "BUSINESS: hierarchy overview keeps the legacy extension field projection");
        assertFalse(
                hierarchyItem.has("extensionValues"),
                "BUSINESS: hierarchy overview does not expose flat raw extension values");
        assertFalse(
                hierarchyItem.has("extensionRuleRevision"),
                "BUSINESS: hierarchy overview does not expose the flat definition revision");
    }

    @AcceptanceScenario(
            id = "extension.authorization-scope-isolation",
            module = "EXTENSION",
            operation = "getOperationsOrganizationBrands")
    void extensionAuthorizationScopeIsolation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture first = host.fixture("GROUP", Set.of("BC-ORG-BRAND-CREATE"));
        BackendAcceptanceTest.Fixture second = host.fixture("GROUP", Set.of("BC-ORG-BRAND-CREATE"));
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        replaceDefinition(context, first.groupWorkspaceKey(), platform.cookie(), "BRAND", typedFlatFieldsFor("scopeFilter"));
        replaceDefinition(context, second.groupWorkspaceKey(), platform.cookie(), "BRAND", typedFlatFieldsFor("scopeFilter"));
        host.completeInvitation(context, first);
        host.completeInvitation(context, second);
        BackendAcceptanceTest.Session firstOperations = host.login(context, first);
        BackendAcceptanceTest.Session secondOperations = host.login(context, second);
        createOrganizationExtensionEntity(context, first, firstOperations, "BRAND", "A", "scopeFilter", "same-value");
        createOrganizationExtensionEntity(context, second, secondOperations, "BRAND", "B", "scopeFilter", "same-value");

        Response page = context.get(
                OPERATIONS_ORGANIZATION_BRANDS,
                "/api/operations/group-workspaces/" + first.groupWorkspaceKey()
                        + "/organization/brands?expectedContextVersion=" + firstOperations.contextVersion()
                        + "&queryText=ExtensionFilter&extensionFilters="
                        + filterWire(typedFilterSpecs("scopeFilter", "same-value"))
                        + "&definitionRevision=1&page=1&pageSize=10",
                firstOperations.cookie(),
                Set.of(200));
        assertEquals(1, page.json().path("metadata").path("total").asInt(),
                "BUSINESS: extension filtering cannot cross workspace scope");
        assertEquals("ExtensionFilterBRANDA", page.json().path("items").get(0).path("name").asText(),
                "BUSINESS: scoped extension result belongs to the requesting workspace");
    }

    private static void assertPlatformOrganizationIdentity(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session platform,
            String hostType,
            String fieldPrefix)
            throws Exception {
        String category = "STORE".equals(hostType) ? "STORE" : "BUSINESS_ENTITY";
        String requestBase = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                + "/organization-overview?category=" + category
                + "&type=" + hostType
                + "&name=ExtensionFilter"
                + ("STORE".equals(hostType) ? "&projectId=" + fixture.projectId() : "")
                + "&pageSize=1&extensionFilters="
                + filterWire(typedFilterSpecs(fieldPrefix, "platform-match"))
                + "&definitionRevision=1";
        Response page = context.get(
                PLATFORM_ORGANIZATION_OVERVIEW,
                requestBase + "&page=1",
                platform.cookie(),
                Set.of(200));
        Response secondPage = context.get(
                PLATFORM_ORGANIZATION_OVERVIEW,
                requestBase + "&page=2",
                platform.cookie(),
                Set.of(200));
        assertPlatformOrganizationPage(page, 1, hostType, category, fieldPrefix);
        assertPlatformOrganizationPage(secondPage, 2, hostType, category, fieldPrefix);
        assertNotEquals(
                page.json().path("items").get(0).path("id").asText(),
                secondPage.json().path("items").get(0).path("id").asText(),
                "BUSINESS: platform " + hostType + " pages do not repeat an item");
    }

    private static void assertPlatformOrganizationPage(
            Response page, int expectedPage, String hostType, String category, String fieldPrefix) {
        assertOrganizationExtensionPage(
                page,
                expectedPage,
                fieldPrefix,
                "platform " + hostType + " organization overview page",
                "platform-match");
        JsonNode item = page.json().path("items").get(0);
        assertEquals(category, item.path("category").asText(), "BUSINESS: platform page keeps category identity");
        assertEquals(hostType, item.path("type").asText(), "BUSINESS: platform page keeps type identity");
        assertTrue(
                item.path("name").asText().startsWith("ExtensionFilter" + hostType),
                "BUSINESS: platform page does not leak another organization identity");
        assertFalse(
                item.has("extensionFields"),
                "BUSINESS: flat platform page does not expose the hierarchy extension field projection");
        assertTrue(
                item.path("extensionValues").isObject(),
                "BUSINESS: flat platform page exposes raw extension values");
        assertTrue(
                item.has("extensionRuleRevision"),
                "BUSINESS: flat platform page exposes the applied definition revision");
    }

    private void organizationExtensionFilteredList(
            BackendAcceptanceTest.ScenarioContext context,
            String hostType,
            RouteIdentity listRoute,
            String endpoint,
            Set<String> capabilities)
            throws Exception {
        String target = "STORE".equals(hostType) ? "PROJECT" : "GROUP";
        BackendAcceptanceTest.Fixture fixture = host.fixture(target, capabilities);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String fieldKey = "organizationFilter";
        replaceDefinition(
                context,
                fixture.groupWorkspaceKey(),
                platform.cookie(),
                hostType,
                typedFlatFieldsFor(fieldKey));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        createOrganizationExtensionEntity(context, fixture, operations, hostType, "A", fieldKey, "match-value");
        createOrganizationExtensionEntity(context, fixture, operations, hostType, "B", fieldKey, "match-value");
        createOrganizationExtensionEntity(context, fixture, operations, hostType, "C", fieldKey, "different-value");

        String coreQuery = "BRAND".equals(hostType) ? "&queryText=ExtensionFilter" : "&name=ExtensionFilter";
        String requestBase = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + endpoint
                + "?expectedContextVersion=" + operations.contextVersion()
                + coreQuery
                + "&pageSize=1&extensionFilters="
                + filterWire(typedFilterSpecs(fieldKey, "match-value"))
                + "&definitionRevision=1";
        Response page = context.get(listRoute, requestBase + "&page=1", operations.cookie(), Set.of(200));
        assertOrganizationExtensionPage(page, 1, fieldKey, "operations " + hostType + " page");
        Response secondPage = context.get(listRoute, requestBase + "&page=2", operations.cookie(), Set.of(200));
        assertOrganizationExtensionPage(secondPage, 2, fieldKey, "operations " + hostType + " page");
        assertNotEquals(
                page.json().path("items").get(0).path("id").asText(),
                secondPage.json().path("items").get(0).path("id").asText(),
                "BUSINESS: operations " + hostType + " pages do not repeat an item");
    }

    private static void createOrganizationExtensionEntity(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session operations,
            String hostType,
            String suffix,
            String fieldPrefix,
            String textValue)
            throws Exception {
        String normalizedHost = hostType.toLowerCase().replace('_', '-');
        String name = "ExtensionFilter" + hostType + suffix;
        List<Map<String, Object>> extensionValues = typedExtensionValues(fieldPrefix, textValue);
        if ("BRAND".equals(hostType)) {
            context.post(
                    OPERATIONS_ORGANIZATION_BRAND_CREATE,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/brands",
                    operations.cookie(),
                    Map.of(
                            "code", "acceptance-filter-" + normalizedHost + "-" + suffix.toLowerCase(),
                            "name", name,
                            "alias", "AFB" + suffix,
                            "remark", "extension-filter",
                            "extensionValues", extensionValues),
                    Set.of(201));
            return;
        }
        if ("TENANT".equals(hostType)) {
            context.post(
                    OPERATIONS_ORGANIZATION_TENANT_CREATE,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/tenants",
                    operations.cookie(),
                    Map.of(
                            "code", "acceptance-filter-" + normalizedHost + "-" + suffix.toLowerCase(),
                            "name", name,
                            "legalName", name + " Ltd",
                            "unifiedSocialCreditCode", "91310000FILTERTENANT" + suffix,
                            "remark", "extension-filter",
                            "extensionValues", extensionValues),
                    Set.of(201));
            return;
        }
        if ("HEAD_COMPANY".equals(hostType)) {
            context.post(
                    OPERATIONS_ORGANIZATION_HEAD_COMPANY_CREATE,
                    "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies",
                    operations.cookie(),
                    Map.of(
                            "code", "acceptance-filter-" + normalizedHost + "-" + suffix.toLowerCase(),
                            "name", name,
                            "legalName", name + " Ltd",
                            "unifiedSocialCreditCode", "91310000FILTERHEAD" + suffix,
                            "remark", "extension-filter",
                            "extensionValues", extensionValues),
                    Set.of(201));
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("brandId", fixture.brandId().toString());
        body.put("tenantId", fixture.tenantId().toString());
        body.put("headCompanyId", null);
        body.put("code", "acceptance-filter-" + normalizedHost + "-" + suffix.toLowerCase());
        body.put("name", name);
        body.put("notes", "extension-filter");
        body.put("extensionValues", extensionValues);
        context.post(
                OPERATIONS_ORGANIZATION_STORE_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores",
                operations.cookie(),
                body,
                Set.of(201));
    }

    private static void assertOrganizationExtensionPage(Response page, int expectedPage, String fieldPrefix, String label) {
        assertOrganizationExtensionPage(page, expectedPage, fieldPrefix, label, "match-value");
    }

    private static void assertOrganizationExtensionPage(
            Response page, int expectedPage, String fieldPrefix, String label, String expectedTextValue) {
        JsonNode metadata = page.json().path("metadata");
        assertEquals(expectedPage, metadata.path("page").asInt(), "BUSINESS: " + label + " preserves page identity");
        assertEquals(1, metadata.path("pageSize").asInt(), "BUSINESS: " + label + " preserves page size");
        assertEquals(2, metadata.path("total").asInt(), "BUSINESS: " + label + " totals the core and extension matches");
        assertEquals(1, page.json().path("items").size(), "BUSINESS: " + label + " returns one item per page");
        assertEquals(
                1,
                metadata.path("definitionRevision").asLong(),
                "BUSINESS: " + label + " returns the applied definition revision");
        JsonNode values = page.json().path("items").get(0).path("extensionValues");
        assertEquals(
                expectedTextValue,
                values.path(fieldPrefix + "Text").asText(),
                "BUSINESS: " + label + " returns TEXT raw value");
        assertEquals(12.5, values.path(fieldPrefix + "Number").asDouble(), "BUSINESS: " + label + " returns NUMBER raw value");
        assertEquals("2026-09-15", values.path(fieldPrefix + "Date").asText(), "BUSINESS: " + label + " returns DATE raw value");
        assertTrue(values.path(fieldPrefix + "Boolean").asBoolean(), "BUSINESS: " + label + " returns BOOLEAN raw value");
        assertEquals("直营", values.path(fieldPrefix + "Select").asText(), "BUSINESS: " + label + " returns SELECT raw value");
    }

    @AcceptanceScenario(
            id = "org.hierarchy-create-preserves-phase-order",
            module = "ORG",
            operation = "hierarchyCreatePreservesPhaseOrder")
    void hierarchyCreatePreservesPhaseOrder(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("GROUP", Set.of("BC-ORG-REGION-CREATE", "BC-ORG-PROJECT-CREATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response region = context.post(
                OPERATIONS_ORGANIZATION_REGION_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/hierarchy/regions",
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-http-region",
                        "name",
                        "Acceptance HTTP Region",
                        "notes",
                        "region-created-by-http",
                        "extensionValues",
                        List.of()),
                Set.of(201));
        String regionId = region.json().path("id").asText();
        assertEquals(
                "REGION", region.json().path("nodeType").asText(), "BUSINESS: region endpoint creates a region node");
        assertEquals("ENABLED", region.json().path("status").asText(), "BUSINESS: region starts enabled");
        BackendAcceptanceTest.Response project = context.post(
                OPERATIONS_ORGANIZATION_PROJECT_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/hierarchy/regions/" + regionId
                        + "/projects",
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-http-project",
                        "name",
                        "Acceptance HTTP Project",
                        "notes",
                        "project-created-by-http",
                        "phases",
                        List.of(Map.of("name", "Opening"), Map.of("name", "Peak"), Map.of("name", "Closing")),
                        "extensionValues",
                        List.of()),
                Set.of(201));
        assertEquals(
                regionId,
                project.json().path("parentId").asText(),
                "BUSINESS: project remains under the selected region");
        assertEquals(
                List.of("Opening", "Peak", "Closing"),
                StreamSupport.stream(project.json().path("phases").spliterator(), false)
                        .map(node -> node.path("name").asText())
                        .toList(),
                "BUSINESS: project phase list is persisted in user order");
        assertEquals(
                "Acceptance HTTP Project",
                project.json().path("name").asText(),
                "BUSINESS: project name is read back from the owner");
    }

    @AcceptanceScenario(
            id = "org.head-company-brand-authorization-lifecycle",
            module = "ORG",
            operation = "headCompanyBrandAuthorizationLifecycle")
    void headCompanyBrandAuthorizationLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("HEAD_COMPANY", Set.of("BC-ORG-HEAD-COMPANY-BRAND"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response added = context.post(
                OPERATIONS_HEAD_COMPANY_BRAND_ADD,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies/"
                        + fixture.headCompanyId() + "/brand-authorizations",
                session.cookie(),
                Map.of("brandId", fixture.brandId().toString()),
                Set.of(204));
        assertEquals(204, added.status(), "CONTRACT: adding a head-company brand authorization returns no content");
        BackendAcceptanceTest.Response afterAdd = context.get(
                OPERATIONS_ORGANIZATION_HEAD_COMPANY,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies/"
                        + fixture.headCompanyId() + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertTrue(
                StreamSupport.stream(afterAdd.json().path("authorizedBrands").spliterator(), false)
                        .anyMatch(value -> fixture.brandId()
                                .toString()
                                .equals(value.path("id").asText())),
                "BUSINESS: authorized brand is immediately visible on head-company detail");
        BackendAcceptanceTest.Response removed = context.delete(
                OPERATIONS_HEAD_COMPANY_BRAND_REMOVE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies/"
                        + fixture.headCompanyId() + "/brand-authorizations/" + fixture.brandId(),
                session.cookie(),
                Set.of(204));
        assertEquals(204, removed.status(), "CONTRACT: removing a head-company brand authorization returns no content");
        BackendAcceptanceTest.Response afterRemove = context.get(
                OPERATIONS_ORGANIZATION_HEAD_COMPANY,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/head-companies/"
                        + fixture.headCompanyId() + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(200));
        assertTrue(
                afterRemove.json().path("authorizedBrands").isArray()
                        && afterRemove.json().path("authorizedBrands").isEmpty(),
                "BUSINESS: removing authorization takes effect without stale detail state");
    }

    @AcceptanceScenario(
            id = "pagination.organization-page-owner-boundary",
            module = "ORG",
            operation = "organizationPageOwnerBoundary")
    void organizationPageOwnerBoundary(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        BackendAcceptanceTest.Fixture foreign = host.fixture("PROJECT", Set.of());

        Set<UUID> brandIds = union(Set.of(fixture.brandId()), Set.copyOf(host.createBrandCandidates(fixture, 19)));
        Set<UUID> tenantIds = union(Set.of(fixture.tenantId()), Set.copyOf(host.createTenantCandidates(fixture, 19)));
        Set<UUID> headCompanyIds = Set.copyOf(host.createHeadCompanyCandidates(fixture, 20));
        Set<UUID> storeIds = union(Set.of(fixture.storeId()), Set.copyOf(host.createStoreCandidates(fixture, 19)));
        String prefix = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
        String contextQuery = "?expectedContextVersion=" + operations.contextVersion();

        JsonNode brandsPageOne = context.get(
                        OPERATIONS_ORGANIZATION_BRANDS,
                        prefix + "/organization/brands" + contextQuery + "&page=1&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        JsonNode brandsPageTwo = context.get(
                        OPERATIONS_ORGANIZATION_BRANDS,
                        prefix + "/organization/brands" + contextQuery + "&page=2&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        assertPagePair(brandsPageOne, brandsPageTwo, brandIds, "brands");
        assertFalse(ids(brandsPageOne).contains(foreign.brandId()), "BUSINESS: foreign workspace brand is not visible");

        JsonNode tenantsPageOne = context.get(
                        OPERATIONS_ORGANIZATION_TENANTS,
                        prefix + "/organization/tenants" + contextQuery + "&page=1&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        JsonNode tenantsPageTwo = context.get(
                        OPERATIONS_ORGANIZATION_TENANTS,
                        prefix + "/organization/tenants" + contextQuery + "&page=2&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        assertPagePair(tenantsPageOne, tenantsPageTwo, tenantIds, "tenants");
        assertFalse(
                ids(tenantsPageOne).contains(foreign.tenantId()), "BUSINESS: foreign workspace tenant is not visible");

        JsonNode headCompaniesPageOne = context.get(
                        OPERATIONS_ORGANIZATION_HEAD_COMPANIES,
                        prefix + "/organization/head-companies" + contextQuery
                                + "&page=1&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        JsonNode headCompaniesPageTwo = context.get(
                        OPERATIONS_ORGANIZATION_HEAD_COMPANIES,
                        prefix + "/organization/head-companies" + contextQuery
                                + "&page=2&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        assertPagePair(headCompaniesPageOne, headCompaniesPageTwo, headCompanyIds, "head companies");

        JsonNode storesPageOne = context.get(
                        OPERATIONS_ORGANIZATION_STORES,
                        prefix + "/organization/stores" + contextQuery + "&page=1&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        JsonNode storesPageTwo = context.get(
                        OPERATIONS_ORGANIZATION_STORES,
                        prefix + "/organization/stores" + contextQuery + "&page=2&pageSize=10&sort=CODE&direction=ASC",
                        operations.cookie(),
                        Set.of(200))
                .json();
        assertPagePair(storesPageOne, storesPageTwo, storeIds, "stores");

        UUID selectedBrand = ids(brandsPageTwo).iterator().next();
        JsonNode operationCandidates = context.get(
                        OPERATIONS_ORGANIZATION_CANDIDATES,
                        prefix + "/organization/candidates?expectedContextVersion=" + operations.contextVersion()
                                + "&subjectType=BRAND&queryText=Acceptance&page=1&pageSize=10&selectedId="
                                + selectedBrand,
                        operations.cookie(),
                        Set.of(200))
                .json();
        assertEquals(
                brandIds.size(),
                operationCandidates.path("metadata").path("total").asInt());
        assertEquals(10, operationCandidates.path("items").size());
        assertFalse(
                ids(operationCandidates).contains(selectedBrand),
                "BUSINESS: selected candidate does not replace page member");
        assertEquals(
                selectedBrand.toString(),
                operationCandidates.path("metadata").path("selectedId").asText());

        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String platformPrefix = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey();
        Set<UUID> allBusinessEntities = union(union(brandIds, tenantIds), headCompanyIds);
        List<JsonNode> overviewPages = new ArrayList<>();
        int overviewPageCount = (allBusinessEntities.size() + 9) / 10;
        for (int page = 1; page <= overviewPageCount; page++) {
            overviewPages.add(context.get(
                            PLATFORM_ORGANIZATION_OVERVIEW,
                            platformPrefix
                                    + "/organization-overview?category=BUSINESS_ENTITY&sort=CODE&direction=ASC"
                                    + "&page=" + page + "&pageSize=10",
                            platform.cookie(),
                            Set.of(200))
                    .json());
        }
        assertPageTraversal(overviewPages, allBusinessEntities, "platform business entities");
        assertTrue(
                overviewPages.stream().noneMatch(page -> ids(page).contains(foreign.brandId())),
                "BUSINESS: platform overview excludes foreign workspace");

        UUID selectedStore = ids(storesPageTwo).iterator().next();
        JsonNode platformCandidates = context.get(
                        PLATFORM_ORGANIZATION_CANDIDATES,
                        platformPrefix
                                + "/organization-overview/candidates?subjectType=STORE&candidateUsage=CONTRACT_LIST"
                                + "&page=1&pageSize=10&selectedId="
                                + selectedStore
                                + "&projectId="
                                + fixture.projectId(),
                        platform.cookie(),
                        Set.of(200))
                .json();
        assertEquals(
                storeIds.size(),
                platformCandidates.path("metadata").path("total").asInt());
        assertEquals(10, platformCandidates.path("items").size());
        assertFalse(
                ids(platformCandidates).contains(selectedStore),
                "BUSINESS: platform selected candidate does not replace page member");
        assertEquals(
                selectedStore.toString(),
                platformCandidates.path("metadata").path("selectedId").asText());
    }

    private static void assertPagePair(JsonNode first, JsonNode second, Set<UUID> expected, String label) {
        assertEquals(
                expected.size(),
                first.path("metadata").path("total").asInt(),
                "CONTRACT: " + label + " total is full match count");
        assertEquals(
                expected.size(),
                second.path("metadata").path("total").asInt(),
                "CONTRACT: " + label + " total is stable across pages");
        Set<UUID> actual = union(ids(first), ids(second));
        int rowCount = first.path("items").size() + second.path("items").size();
        assertEquals(rowCount, actual.size(), "BUSINESS: " + label + " pages do not repeat rows");
        assertEquals(expected, actual, "BUSINESS: " + label + " pages contain the complete matching set");
        assertEquals(
                Math.min(10, expected.size()),
                first.path("items").size(),
                "BUSINESS: " + label + " first page is bounded");
        assertEquals(
                Math.max(0, expected.size() - 10),
                second.path("items").size(),
                "BUSINESS: " + label + " second page reaches the remainder");
    }

    private static void assertPageTraversal(List<JsonNode> pages, Set<UUID> expected, String label) {
        assertFalse(pages.isEmpty(), "BUSINESS: " + label + " returns at least one page");
        Set<UUID> actual = new java.util.LinkedHashSet<>();
        for (int index = 0; index < pages.size(); index++) {
            JsonNode page = pages.get(index);
            assertEquals(
                    expected.size(),
                    page.path("metadata").path("total").asInt(),
                    "CONTRACT: " + label + " total is full match count on every page");
            int expectedRows = index == pages.size() - 1 ? expected.size() - (pages.size() - 1) * 10 : 10;
            assertEquals(expectedRows, page.path("items").size(), "BUSINESS: " + label + " page boundary");
            for (UUID id : ids(page)) {
                assertTrue(actual.add(id), "BUSINESS: " + label + " pages do not repeat rows");
            }
        }
        assertEquals(expected, Set.copyOf(actual), "BUSINESS: " + label + " pages cover the complete matching set");
    }

    private static Set<UUID> ids(JsonNode page) {
        Set<UUID> result = new java.util.LinkedHashSet<>();
        page.path("items")
                .forEach(item -> result.add(UUID.fromString(item.path("id").asText())));
        return Set.copyOf(result);
    }

    private static Set<UUID> union(Set<UUID> first, Set<UUID> second) {
        Set<UUID> result = new java.util.LinkedHashSet<>(first);
        result.addAll(second);
        return Set.copyOf(result);
    }
}
