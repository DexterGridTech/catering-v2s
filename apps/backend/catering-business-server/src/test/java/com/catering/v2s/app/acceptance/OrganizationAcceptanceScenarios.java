package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.StreamSupport;

final class OrganizationAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    OrganizationAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
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
        updateStoreBody.put("expectedVersion", version);
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
}
