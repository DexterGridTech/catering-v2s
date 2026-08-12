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
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreCreateRequestExtensionValuesItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreSortDirection;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreSortKey;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
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
    void candidatesUseTheRetainedSelectedProjectAndCascadeFiltersToOwner() {
        Fixture fixture = fixture();
        UUID projectId = selectedProjectId(fixture);
        UUID brandId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        StoreCandidateTaskReadService.Page page = new StoreCandidateTaskReadService.Page(
            KEY,
            new StoreCandidateTaskReadService.DataScope("PROJECT", projectId, "集团 / 项目"),
            List.of(new StoreCandidateTaskReadService.Candidate(projectId, "PRJ-01", "项目一", null)),
            List.of(new StoreCandidateTaskReadService.Candidate(brandId, "BR-01", "品牌一", null)),
            List.of(new StoreCandidateTaskReadService.Candidate(tenantId, "TEN-01", "经营主体一", null)),
            List.of()
        );
        selectedProject(fixture, projectId);
        when(fixture.storeCandidates.operationsStoreCandidates(fixture.workspaceId, KEY, fixture.session.currentAssignmentId(), projectId, projectId, brandId, tenantId))
            .thenReturn(page);

        var result = fixture.controller.candidates(fixture.request, KEY, fixture.session.contextVersion(), brandId, tenantId);

        assertEquals(page, result);
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.storeCandidates).operationsStoreCandidates(fixture.workspaceId, KEY, fixture.session.currentAssignmentId(), projectId, projectId, brandId, tenantId);
    }

    @Test
    void listUsesRetainedSelectedProjectWithoutAClientProjectFilter() {
        Fixture fixture = fixture();
        UUID scopedProjectId = selectedProjectId(fixture);
        selectedProject(fixture, scopedProjectId);
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

        fixture.controller.list(fixture.request, KEY, fixture.session.contextVersion(), "门店", "STORE-01", null, null, null, 2, 20);

        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.overview).page(
            fixture.workspaceId,
            KEY,
            "STORE",
            new OrganizationOverviewTaskReadService.Query("STORE", "门店", "STORE-01", null, null, null, null, scopedProjectId, null, null, null, null, scopedProjectId),
            2,
            20
        );
    }

    @Test
    void listUsesSelectedProjectForBothProjectAndOwnerScopePredicate() {
        Fixture fixture = fixture();
        UUID projectId = selectedProjectId(fixture);
        selectedProject(fixture, projectId);
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

        fixture.controller.list(fixture.request, KEY, fixture.session.contextVersion(), null, null, null, null, null, 1, 20);

        verify(fixture.overview).page(
            fixture.workspaceId,
            KEY,
            "STORE",
            new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, projectId, null, null, null, null, projectId),
            1,
            20
        );
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
    }

    @Test
    void listRejectsMissingSelectedProjectBeforeOwnerRead() {
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
            UUID.randomUUID(), UUID.randomUUID(), KEY, UUID.randomUUID(), UUID.randomUUID(), WorkspaceSessionEntryReadback.ScopeContext.empty(),
            9L, 5L, Set.of(), Set.of(), "Operations tester"
        );
        Fixture fixture = fixture(session);
        when(fixture.user.resolveSelectedProjectScope(session, null)).thenThrow(new WorkspaceAuthenticationService.SessionInvalidException());

        assertThrows(
            WorkspaceAuthenticationService.SessionInvalidException.class,
            () -> fixture.controller.list(fixture.request, KEY, session.contextVersion(), null, null, null, null, null, 1, 20)
        );

        verifyNoInteractions(fixture.overview);
        verify(fixture.user).resolveSelectedProjectScope(session, null);
    }

    @Test
    void listPassesGeneratedSortAndDirectionToOwnerWithoutChangingScopePredicate() {
        Fixture fixture = fixture();
        UUID projectId = selectedProjectId(fixture);
        selectedProject(fixture, projectId);
        when(fixture.overview.page(
            eq(fixture.workspaceId),
            eq(KEY),
            eq("STORE"),
            any(OrganizationOverviewTaskReadService.Query.class),
            eq(1),
            eq(20)
        )).thenReturn(new OrganizationOverviewTaskReadService.Page(
            new OrganizationOverviewTaskReadService.Metadata(KEY, "STORE", 1, 20, 0L, "CODE", "ASC"),
            List.of(), "AVAILABLE", 0L, List.of(), List.of(), "AVAILABLE", 0L, List.of()
        ));

        fixture.controller.list(
            fixture.request,
            KEY,
            fixture.session.contextVersion(),
            null,
            null,
            null,
            OrganizationStoreSortKey.CODE,
            OrganizationStoreSortDirection.ASC,
            1,
            20
        );

        verify(fixture.overview).page(
            fixture.workspaceId,
            KEY,
            "STORE",
            new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, projectId, null, null, "CODE", "ASC", projectId),
            1,
            20
        );
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
    }

    @Test
    void createUsesOwnerProjectFactAndPassesAProjectGrantToTheOwnerWrite() {
        Fixture fixture = fixture();
        UUID scopedProjectId = selectedProjectId(fixture);
        UUID brandId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID headCompanyId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        var grant = new com.catering.v2s.organization.api.OperationsOwnerScopeGrant(fixture.workspaceId, KEY, "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE", "BC-ORG-STORE-CREATE", "PROJECT", scopedProjectId, "PROJECT", scopedProjectId, List.of(scopedProjectId));
        selectedProject(fixture, scopedProjectId);
        when(fixture.capabilityScopes.resolve(fixture.session, "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", scopedProjectId)))
            .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-ORG-STORE-CREATE", new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(fixture.workspaceId, KEY, "PROJECT", scopedProjectId, "PROJECT", scopedProjectId, List.of(scopedProjectId))));
        var command = new OperationsStoreCommandApi.CreateStoreCommand(
            fixture.workspaceId, KEY, scopedProjectId, tenantId, brandId, headCompanyId,
            "STORE-01", "门店一", "备注", new com.catering.v2s.extension.api.ExtensionSubmission(List.of()),
            IDEMPOTENCY_KEY, fixture.actor, grant
        );
        when(fixture.entities.createStore(command)).thenReturn(new OrganizationEntityReadback(storeId, "STORE", fixture.workspaceId, KEY, "STORE-01", "门店一", null, null, "ENABLED", 3L, null, null, "备注", 0L, 10L, 11L, Map.of()));
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
            "备注",
            null,
            null,
            new OrganizationOverviewTaskReadService.Reference(scopedProjectId, "PRJ-01", "项目一", true),
            new OrganizationOverviewTaskReadService.Reference(brandId, "BR-01", "品牌一", true),
            new OrganizationOverviewTaskReadService.Reference(tenantId, "TEN-01", "经营主体一", true),
            new OrganizationOverviewTaskReadService.Reference(headCompanyId, "HC-01", "总公司一", true),
            List.of(),
            List.of(),
            null
        ));
        when(fixture.contracts.derivedStoreStatus(fixture.workspaceId, KEY, storeId)).thenReturn("OPERATING");

        var response = fixture.controller.create(
            fixture.request,
            KEY,
            IDEMPOTENCY_KEY,
            new OrganizationStoreCreateRequest(
                brandId.toString(),
                tenantId.toString(),
                headCompanyId.toString(),
                "STORE-01",
                "门店一",
                "备注",
                List.of(new OrganizationStoreCreateRequestExtensionValuesItem("remark", "\"test\"", "SET"))
            )
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("门店一", response.getBody().name());
        assertEquals(scopedProjectId.toString(), response.getBody().project().id());
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.capabilityScopes).resolve(fixture.session, "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", scopedProjectId));
        verify(fixture.entities).createStore(new OperationsStoreCommandApi.CreateStoreCommand(
            fixture.workspaceId, KEY, scopedProjectId, tenantId, brandId, headCompanyId,
            "STORE-01", "门店一", "备注", new com.catering.v2s.extension.api.ExtensionSubmission(List.of(new com.catering.v2s.extension.api.ExtensionSubmission.ExtensionFieldValue("remark", "\"test\"", com.catering.v2s.extension.api.ExtensionSubmission.Mode.SET))),
            IDEMPOTENCY_KEY, fixture.actor, grant
        ));
    }

    @Test
    void candidatesRejectMissingAssignmentBeforeOwnerRead() {
        UUID workspaceId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
            UUID.randomUUID(),
            workspaceId,
            KEY,
            UUID.randomUUID(),
            null,
            WorkspaceSessionEntryReadback.ScopeContext.empty(),
            9L,
            5L,
            Set.of(),
            Set.of(),
            "Operations tester"
        );
        Fixture fixture = fixture(session);

        assertThrows(
            WorkspaceAuthenticationService.SessionInvalidException.class,
            () -> fixture.controller.candidates(fixture.request, KEY, fixture.session.contextVersion(), null, null)
        );

        verifyNoInteractions(fixture.storeCandidates);
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate project = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate("PROJECT", projectId, "项目一", "PRJ-01", List.of("集团", "项目一"), null, projectId, null, null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, KEY, accountId, UUID.randomUUID(), new WorkspaceSessionEntryReadback.ScopeContext(null, project, null, null), 9L, 5L, Set.of(), Set.of(), "Operations tester");
        return fixture(session);
    }

    private static Fixture fixture(WorkspaceSessionReadback session) {
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        var readFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts.class);
        when(readFacts.sessionReadback()).thenReturn(session);
        when(authentication.readAuthorizationFacts("operations-session")).thenReturn(readFacts);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        StoreCandidateTaskReadService storeCandidates = mock(StoreCandidateTaskReadService.class);
        OrganizationOverviewTaskReadService overview = mock(OrganizationOverviewTaskReadService.class);
        ContractTaskReadService contracts = mock(ContractTaskReadService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        OperationsStoreManagementController controller = new OperationsStoreManagementController(new OperationsSessionResolver(authentication), entities, storeCandidates, overview, contracts, user, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName());
        return new Fixture(controller, entities, storeCandidates, overview, contracts, user, capabilityScopes, request, session, session.workspaceUuid(), actor);
    }

    private record Fixture(
        OperationsStoreManagementController controller,
        BusinessEntityService entities,
        StoreCandidateTaskReadService storeCandidates,
        OrganizationOverviewTaskReadService overview,
        ContractTaskReadService contracts,
        WorkspaceUserService user,
        WorkspaceCapabilityScopeResolver capabilityScopes,
        EdgeRequestContext request,
        WorkspaceSessionReadback session,
        UUID workspaceId,
        AuditActor actor
    ) { }

    private static UUID selectedProjectId(Fixture fixture) {
        return fixture.session.scopeContext().project().dataNodeId();
    }

    private static void selectedProject(Fixture fixture, UUID projectId) {
        when(fixture.user.resolveSelectedProjectScope(fixture.session, null))
            .thenReturn(new OrganizationTaskPathLookup.TaskPath("PROJECT", projectId, List.of(projectId), "集团 / 项目"));
    }
}
