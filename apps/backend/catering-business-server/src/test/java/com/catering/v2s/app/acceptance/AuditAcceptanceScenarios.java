package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

final class AuditAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    AuditAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "pagination.platform-page-owner-boundary",
            module = "PLATFORM",
            operation = "platformPageOwnerBoundary")
    void platformPageOwnerBoundary(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.WorkspaceFixture auditWorkspace = host.workspaceOnly();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);

        BackendAcceptanceTest.Response adminPage = context.get(
                PLATFORM_ADMIN_PAGE, "/api/platform/admin-users?page=1&pageSize=5", platform.cookie(), Set.of(200));
        assertPageMetadata(adminPage.json(), 1, 5);
        assertTrue(
                adminPage.json().path("total").asLong() >= 1,
                "BUSINESS: platform administrators page has complete total");

        List<BackendAcceptanceTest.WorkspaceFixture> workspaces = new ArrayList<>();
        workspaces.add(auditWorkspace);
        for (int index = 0; index < 6; index++) workspaces.add(host.workspaceOnly());
        BackendAcceptanceTest.Response workspacePage1 = context.get(
                PLATFORM_GROUP_WORKSPACES,
                "/api/platform/group-workspaces?page=1&pageSize=3",
                platform.cookie(),
                Set.of(200));
        BackendAcceptanceTest.Response workspacePage2 = context.get(
                PLATFORM_GROUP_WORKSPACES,
                "/api/platform/group-workspaces?page=2&pageSize=3",
                platform.cookie(),
                Set.of(200));
        assertPageMetadata(workspacePage1.json(), 1, 3);
        assertPageMetadata(workspacePage2.json(), 2, 3);
        assertTrue(
                workspacePage1.json().path("total").asLong() >= workspaces.size(),
                "BUSINESS: group-workspace page total covers every fixture");
        Set<String> workspaceIds = new LinkedHashSet<>();
        addIds(workspaceIds, workspacePage1.json().path("items"), "groupWorkspaceKey");
        addIds(workspaceIds, workspacePage2.json().path("items"), "groupWorkspaceKey");
        assertEquals(
                workspacePage1.json().path("items").size()
                        + workspacePage2.json().path("items").size(),
                workspaceIds.size(),
                "BUSINESS: adjacent group-workspace pages do not repeat a row");

        long version = context.get(
                        PLATFORM_GROUP_WORKSPACE_DETAIL,
                        "/api/platform/group-workspaces/" + auditWorkspace.groupWorkspaceKey(),
                        platform.cookie(),
                        Set.of(200))
                .json()
                .path("version")
                .asLong();
        for (int index = 0; index < 6; index++) {
            String idempotencyKey = "audit-platform-update-" + UUID.randomUUID();
            BackendAcceptanceTest.Response updated = context.patch(
                    PLATFORM_GROUP_WORKSPACE_UPDATE,
                    "/api/platform/group-workspaces/" + auditWorkspace.groupWorkspaceKey(),
                    platform.cookie(),
                    Map.of(
                            "name",
                            "Acceptance audit workspace " + index,
                            "operationsTitle",
                            "Acceptance audit operations " + index,
                            "notes",
                            "page-boundary-" + index,
                            "logoIntent",
                            "KEEP",
                            "expectedVersion",
                            version,
                            "idempotencyKey",
                            idempotencyKey),
                    Map.of("Idempotency-Key", idempotencyKey),
                    Set.of(200));
            version = updated.json().path("version").asLong();
        }
        List<String> platformAuditIds = collectAuditPages(
                context,
                PLATFORM_AUDIT_HISTORY,
                "/api/platform/audit-history?entityType=GROUP_WORKSPACE&entityId=" + auditWorkspace.groupWorkspaceKey(),
                platform.cookie(),
                2);
        assertTrue(platformAuditIds.size() > 2, "BUSINESS: platform audit fixture crosses one page");

        BackendAcceptanceTest.Fixture operationsFixture = host.fixture("PROJECT", Set.of("BC-ORG-STORE-EDIT"));
        host.completeInvitation(context, operationsFixture);
        BackendAcceptanceTest.Session operations = host.login(context, operationsFixture);
        String storeId = operationsFixture.storeId().toString();
        long storeVersion = context.get(
                        OPERATIONS_ORGANIZATION_STORE,
                        "/api/operations/group-workspaces/" + operationsFixture.groupWorkspaceKey()
                                + "/organization/stores/" + storeId
                                + "?expectedContextVersion=" + operations.contextVersion(),
                        operations.cookie(),
                        Set.of(200))
                .json()
                .path("revision")
                .asLong();
        for (int index = 0; index < 6; index++) {
            Map<String, Object> updateStoreBody = new LinkedHashMap<>();
            updateStoreBody.put("name", "Acceptance audit store " + index);
            updateStoreBody.put("headCompanyId", null);
            updateStoreBody.put("notes", "operations-page-boundary-" + index);
            updateStoreBody.put("extensionValues", List.of());
            updateStoreBody.put("expectedVersion", storeVersion);
            BackendAcceptanceTest.Response updated = context.patch(
                    OPERATIONS_ORGANIZATION_STORE_UPDATE,
                    "/api/operations/group-workspaces/" + operationsFixture.groupWorkspaceKey()
                            + "/organization/stores/" + storeId,
                    operations.cookie(),
                    updateStoreBody,
                    Set.of(200));
            storeVersion = updated.json().path("revision").asLong();
        }
        List<String> operationsAuditIds = collectAuditPages(
                context,
                OPERATIONS_AUDIT_HISTORY,
                "/api/operations/audit-history?groupWorkspaceKey=" + operationsFixture.groupWorkspaceKey()
                        + "&entityType=STORE&entityId=" + storeId,
                operations.cookie(),
                2);
        assertTrue(operationsAuditIds.size() > 2, "BUSINESS: operations audit fixture crosses one page");
    }

    private static List<String> collectAuditPages(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.RouteIdentity route,
            String basePath,
            String cookie,
            int pageSize)
            throws Exception {
        BackendAcceptanceTest.Response first =
                context.get(route, basePath + "&page=1&pageSize=" + pageSize, cookie, Set.of(200));
        long total = first.json().path("total").asLong();
        assertTrue(total > pageSize, "BUSINESS: audit fixture has more members than one page");
        Set<String> ids = new LinkedHashSet<>();
        long pageCount = (total + pageSize - 1) / pageSize;
        for (long page = 1; page <= pageCount; page++) {
            BackendAcceptanceTest.Response result = page == 1
                    ? first
                    : context.get(route, basePath + "&page=" + page + "&pageSize=" + pageSize, cookie, Set.of(200));
            assertPageMetadata(result.json(), page, pageSize);
            JsonNode items = result.json().path("items");
            assertTrue(items.isArray() && items.size() <= pageSize, "BUSINESS: audit page stays within pageSize");
            addIds(ids, items, "id");
        }
        assertEquals(total, ids.size(), "BUSINESS: audit pages cover total without duplicates or omissions");
        return new ArrayList<>(ids);
    }

    private static void assertPageMetadata(JsonNode page, long expectedPage, long expectedPageSize) {
        assertEquals(expectedPage, page.path("page").asLong(), "BUSINESS: page metadata echoes requested page");
        assertEquals(
                expectedPageSize, page.path("pageSize").asLong(), "BUSINESS: page metadata echoes requested pageSize");
        assertTrue(
                page.path("total").asLong() >= page.path("items").size(), "BUSINESS: total is not current page length");
    }

    private static void addIds(Set<String> target, JsonNode items, String field) {
        assertTrue(items.isArray(), "BUSINESS: paged response returns an items array");
        items.forEach(item -> {
            String value = item.path(field).asText("");
            assertTrue(!value.isBlank(), "BUSINESS: every paged item has a stable identity");
            target.add(value);
        });
    }
}
