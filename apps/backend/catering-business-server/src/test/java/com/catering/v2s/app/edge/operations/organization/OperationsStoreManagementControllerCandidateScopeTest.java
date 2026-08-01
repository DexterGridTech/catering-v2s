package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

import com.catering.v2s.app.edge.generated.wire.OrganizationStoreCreateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import tools.jackson.databind.node.JsonNodeFactory;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class OperationsStoreManagementControllerCandidateScopeTest {
    private static final String KEY = "operations-store-scope-test";
    private static final String IDEMPOTENCY_KEY = "operations-store-scope-idempotency";

    @Test
    void candidatesDelegateAssignmentVisibleNodeAndCascadeFiltersToOwner() {
        Fixture fixture = fixture();
        UUID projectId = UUID.randomUUID();
        UUID brandId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        StoreCandidateTaskReadService.Page page = new StoreCandidateTaskReadService.Page(
            KEY,
            new StoreCandidateTaskReadService.DataScope("PROJECT", fixture.session.visibleDataNodeId(), "集团 / 项目"),
            List.of(new StoreCandidateTaskReadService.Candidate(projectId, "PRJ-01", "项目一", null)),
            List.of(new StoreCandidateTaskReadService.Candidate(brandId, "BR-01", "品牌一", null)),
            List.of(new StoreCandidateTaskReadService.Candidate(tenantId, "TEN-01", "经营主体一", null)),
            List.of()
        );
        when(fixture.storeCandidates.candidates(fixture.workspaceId, KEY, fixture.session.currentAssignmentId(), fixture.session.visibleDataNodeId(), projectId, brandId, tenantId))
            .thenReturn(page);

        var result = fixture.controller.candidates(fixture.request, KEY, fixture.session.contextVersion(), projectId, brandId, tenantId);

        assertEquals(page, result);
        verify(fixture.storeCandidates).candidates(fixture.workspaceId, KEY, fixture.session.currentAssignmentId(), fixture.session.visibleDataNodeId(), projectId, brandId, tenantId);
    }

    @Test
    void listPassesProjectFilterToOwnerQueryWithoutLocalSlicing() {
        Fixture fixture = fixture();
        UUID projectId = UUID.randomUUID();
        UUID scopedProjectId = UUID.randomUUID();
        when(fixture.user.resolveTaskScope(fixture.session, "PROJECT", projectId))
            .thenReturn(new OrganizationTaskPathLookup.TaskPath("PROJECT", scopedProjectId, List.of(scopedProjectId), "集团 / 项目"));
        when(fixture.overview.page(
            eq(fixture.workspaceId),
            eq(KEY),
            eq("STORE"),
            any(OrganizationOverviewTaskReadService.Query.class),
            eq(2),
            eq(20)
        )).thenReturn(new OrganizationOverviewTaskReadService.Page(
            new OrganizationOverviewTaskReadService.Metadata(KEY, "STORE", 2, 20, 0L, "UPDATED_AT", "DESC"),
            List.of(),
            "AVAILABLE",
            0L,
            List.of(),
            List.of(),
            "AVAILABLE",
            0L,
            List.of()
        ));

        fixture.controller.list(fixture.request, KEY, fixture.session.contextVersion(), "门店", projectId, "STORE-01", null, 2, 20);

        verify(fixture.user).resolveTaskScope(fixture.session, "PROJECT", projectId);
        verify(fixture.overview).page(
            fixture.workspaceId,
            KEY,
            "STORE",
            new OrganizationOverviewTaskReadService.Query("STORE", "门店", "STORE-01", null, null, scopedProjectId, null, null, null, null, fixture.session.visibleDataNodeId()),
            2,
            20
        );
    }

    @Test
    void listWithoutProjectFilterPassesVisibleDataNodeToOwnerQuery() {
        Fixture fixture = fixture();
        when(fixture.overview.page(
            eq(fixture.workspaceId),
            eq(KEY),
            eq("STORE"),
            any(OrganizationOverviewTaskReadService.Query.class),
            eq(1),
            eq(20)
        )).thenReturn(new OrganizationOverviewTaskReadService.Page(
            new OrganizationOverviewTaskReadService.Metadata(KEY, "STORE", 1, 20, 0L, "UPDATED_AT", "DESC"),
            List.of(), "AVAILABLE", 0L, List.of(), List.of(), "AVAILABLE", 0L, List.of()
        ));

        fixture.controller.list(fixture.request, KEY, fixture.session.contextVersion(), null, null, null, null, 1, 20);

        verify(fixture.overview).page(
            fixture.workspaceId,
            KEY,
            "STORE",
            new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, null, null, null, fixture.session.visibleDataNodeId()),
            1,
            20
        );
        verifyNoInteractions(fixture.user);
    }

    @Test
    void listRejectsMissingVisibleScopeBeforeOwnerRead() {
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
            UUID.randomUUID(), UUID.randomUUID(), KEY, UUID.randomUUID(), UUID.randomUUID(), null,
            9L, 5L, Set.of(), Set.of(), "Operations tester"
        );
        Fixture fixture = fixture(session);

        assertThrows(
            WorkspaceAuthenticationService.SessionInvalidException.class,
            () -> fixture.controller.list(fixture.request, KEY, session.contextVersion(), null, null, null, null, 1, 20)
        );

        verifyNoInteractions(fixture.overview, fixture.user);
    }

    @Test
    void createUsesOnlyWorkspaceIamResolvedProjectForOwnerWrite() {
        Fixture fixture = fixture();
        UUID requestedProjectId = UUID.randomUUID();
        UUID scopedProjectId = UUID.randomUUID();
        UUID brandId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID headCompanyId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        when(fixture.user.resolveTaskScope(fixture.session, "PROJECT", requestedProjectId))
            .thenReturn(new OrganizationTaskPathLookup.TaskPath("PROJECT", scopedProjectId, List.of(scopedProjectId), "集团 / 项目"));
        when(fixture.entities.createStore(
            fixture.workspaceId,
            KEY,
            scopedProjectId,
            tenantId,
            brandId,
            headCompanyId,
            "STORE-01",
            "门店一",
            "备注",
            Map.of(),
            IDEMPOTENCY_KEY,
            fixture.actor
        )).thenReturn(new OrganizationEntityReadback(storeId, "STORE", fixture.workspaceId, KEY, "STORE-01", "门店一", null, null, "ENABLED", 3L, null, null, "备注", 0L, 10L, 11L, Map.of()));
        when(fixture.overview.detail(fixture.workspaceId, KEY, "STORE", storeId)).thenReturn(new OrganizationOverviewTaskReadService.Item(
            storeId,
            KEY,
            "STORE",
            "STORE",
            "STORE-01",
            "门店一",
            List.of(),
            "ENABLED",
            "MANUAL",
            3L,
            10L,
            11L,
            new OrganizationOverviewTaskReadService.Reference(scopedProjectId, "PRJ-01", "项目一", true),
            new OrganizationOverviewTaskReadService.Reference(brandId, "BR-01", "品牌一", true),
            new OrganizationOverviewTaskReadService.Reference(tenantId, "TEN-01", "经营主体一", true),
            new OrganizationOverviewTaskReadService.Reference(headCompanyId, "HC-01", "总公司一", true),
            List.of(),
            List.of()
        ));
        when(fixture.contracts.derivedStoreStatus(fixture.workspaceId, KEY, storeId)).thenReturn("OPERATING");

        var response = fixture.controller.create(
            fixture.request,
            KEY,
            IDEMPOTENCY_KEY,
            new OrganizationStoreCreateRequest(
                requestedProjectId.toString(),
                brandId.toString(),
                tenantId.toString(),
                headCompanyId.toString(),
                "STORE-01",
                "门店一",
                "备注",
                JsonNodeFactory.instance.objectNode()
            )
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("门店一", response.getBody().name());
        assertEquals(scopedProjectId.toString(), response.getBody().project().id());
        verify(fixture.user).resolveTaskScope(fixture.session, "PROJECT", requestedProjectId);
        verify(fixture.entities).createStore(
            fixture.workspaceId,
            KEY,
            scopedProjectId,
            tenantId,
            brandId,
            headCompanyId,
            "STORE-01",
            "门店一",
            "备注",
            Map.of(),
            IDEMPOTENCY_KEY,
            fixture.actor
        );
    }

    @Test
    void candidatesRejectMissingAssignmentBeforeOwnerRead() {
        UUID workspaceId = UUID.randomUUID();
        UUID visibleNodeId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
            UUID.randomUUID(),
            workspaceId,
            KEY,
            UUID.randomUUID(),
            null,
            visibleNodeId,
            9L,
            5L,
            Set.of(),
            Set.of(),
            "Operations tester"
        );
        Fixture fixture = fixture(session);

        assertThrows(
            WorkspaceAuthenticationService.SessionInvalidException.class,
            () -> fixture.controller.candidates(fixture.request, KEY, fixture.session.contextVersion(), null, null, null)
        );

        verifyNoInteractions(fixture.storeCandidates);
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, KEY, accountId, UUID.randomUUID(), UUID.randomUUID(), 9L, 5L, Set.of(), Set.of(), "Operations tester");
        return fixture(session);
    }

    private static Fixture fixture(WorkspaceSessionReadback session) {
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        StoreCandidateTaskReadService storeCandidates = mock(StoreCandidateTaskReadService.class);
        OrganizationOverviewTaskReadService overview = mock(OrganizationOverviewTaskReadService.class);
        ContractTaskReadService contracts = mock(ContractTaskReadService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        OperationsStoreManagementController controller = new OperationsStoreManagementController(new OperationsSessionResolver(authentication), entities, storeCandidates, overview, contracts, user);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName());
        return new Fixture(controller, entities, storeCandidates, overview, contracts, user, request, session, session.workspaceUuid(), actor);
    }

    private record Fixture(
        OperationsStoreManagementController controller,
        BusinessEntityService entities,
        StoreCandidateTaskReadService storeCandidates,
        OrganizationOverviewTaskReadService overview,
        ContractTaskReadService contracts,
        WorkspaceUserService user,
        EdgeRequestContext request,
        WorkspaceSessionReadback session,
        UUID workspaceId,
        AuditActor actor
    ) { }
}
