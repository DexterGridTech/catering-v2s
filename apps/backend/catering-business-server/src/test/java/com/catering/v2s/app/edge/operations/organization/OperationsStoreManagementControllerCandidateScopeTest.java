package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.OrganizationStoreCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreSortDirection;
import com.catering.v2s.app.edge.generated.wire.OrganizationStoreSortKey;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

class OperationsStoreManagementControllerCandidateScopeTest {
    private static final String KEY = "operations-store-scope-test";
    private static final String IDEMPOTENCY_KEY = "operations-store-scope-idempotency";
    private static final ObjectMapper JSON = new ObjectMapper();

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
                        eq(20)))
                .thenReturn(new OrganizationOverviewTaskReadService.Page(
                        new OrganizationOverviewTaskReadService.Metadata(KEY, "STORE", 2, 20, 0L, "UPDATED_AT", "DESC"),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of(),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of()));

        fixture.controller.list(
                fixture.request,
                KEY,
                fixture.session.contextVersion(),
                "门店",
                "STORE-01",
                null,
                null,
                null,
                2,
                20,
                null,
                null);

        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.overview)
                .page(
                        fixture.workspaceId,
                        KEY,
                        "STORE",
                        new OrganizationOverviewTaskReadService.Query(
                                "STORE",
                                "门店",
                                "STORE-01",
                                null,
                                null,
                                null,
                                null,
                                scopedProjectId,
                                null,
                                null,
                                null,
                                null,
                                null,
                                scopedProjectId,
                                null,
                                null),
                        2,
                        20);
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
                        eq(20)))
                .thenReturn(new OrganizationOverviewTaskReadService.Page(
                        new OrganizationOverviewTaskReadService.Metadata(KEY, "STORE", 1, 20, 0L, "UPDATED_AT", "DESC"),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of(),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of()));

        fixture.controller.list(
                fixture.request,
                KEY,
                fixture.session.contextVersion(),
                null,
                null,
                null,
                null,
                null,
                1,
                20,
                null,
                null);

        verify(fixture.overview)
                .page(
                        fixture.workspaceId,
                        KEY,
                        "STORE",
                        new OrganizationOverviewTaskReadService.Query(
                                "STORE", null, null, null, null, null, null, projectId, null, null, null, null,
                                null, projectId, null, null),
                        1,
                        20);
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
    }

    @Test
    void listRejectsMissingSelectedProjectBeforeOwnerRead() {
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                UUID.randomUUID(),
                KEY,
                UUID.randomUUID(),
                UUID.randomUUID(),
                WorkspaceSessionEntryReadback.ScopeContext.empty(),
                9L,
                5L,
                Set.of(),
                Set.of(),
                "Operations tester");
        Fixture fixture = fixture(session);
        when(fixture.user.resolveSelectedProjectScope(session, null))
                .thenThrow(new WorkspaceAuthenticationService.SessionInvalidException());

        assertThrows(
                WorkspaceAuthenticationService.SessionInvalidException.class,
                () -> fixture.controller.list(
                        fixture.request,
                        KEY,
                        session.contextVersion(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        1,
                        20,
                        null,
                        null));

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
                        eq(20)))
                .thenReturn(new OrganizationOverviewTaskReadService.Page(
                        new OrganizationOverviewTaskReadService.Metadata(KEY, "STORE", 1, 20, 0L, "CODE", "ASC"),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of(),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of()));

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
                20,
                null,
                null);

        verify(fixture.overview)
                .page(
                        fixture.workspaceId,
                        KEY,
                        "STORE",
                        new OrganizationOverviewTaskReadService.Query(
                                "STORE", null, null, null, null, null, null, projectId, null, null, null, "CODE", "ASC",
                                projectId, null, null),
                        1,
                        20);
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
    }

    @Test
    void detailReusesScopedStoreProjectionWithoutASecondOwnerDetailRead() {
        Fixture fixture = fixture();
        UUID storeId = UUID.randomUUID();
        UUID projectId = selectedProjectId(fixture);
        OrganizationOverviewTaskReadService.Item detail = storeDetail(storeId, projectId);
        when(fixture.overview.detail(fixture.workspaceId, KEY, "STORE", storeId))
                .thenReturn(detail);
        when(fixture.user.resolveSelectedProjectScope(fixture.session, projectId))
                .thenReturn(projectPath(projectId));
        when(fixture.entities.requireEntity("STORE", fixture.workspaceId, KEY, storeId))
                .thenReturn(storeEntity(detail, fixture.workspaceId));
        when(fixture.contracts.derivedStoreStatus(fixture.workspaceId, KEY, storeId))
                .thenReturn("OPERATING");

        var response = fixture.controller.detail(fixture.request, KEY, storeId, fixture.session.contextVersion());

        assertEquals(storeId.toString(), response.id());
        assertEquals(projectId.toString(), response.project().id());
        assertEquals("OPERATING", response.contractDerivedStatus());
        verify(fixture.overview, times(1)).detail(fixture.workspaceId, KEY, "STORE", storeId);
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, projectId);
        verify(fixture.entities).requireEntity("STORE", fixture.workspaceId, KEY, storeId);
        verify(fixture.contracts).derivedStoreStatus(fixture.workspaceId, KEY, storeId);
    }

    @Test
    void detailPreservesScopeDeniedFailureBeforeBaseReadback() {
        Fixture fixture = fixture();
        UUID storeId = UUID.randomUUID();
        UUID projectId = selectedProjectId(fixture);
        OrganizationOverviewTaskReadService.Item detail = storeDetail(storeId, projectId);
        when(fixture.overview.detail(fixture.workspaceId, KEY, "STORE", storeId))
                .thenReturn(detail);
        when(fixture.user.resolveSelectedProjectScope(fixture.session, projectId))
                .thenThrow(new WorkspaceUserService.TaskScopeDeniedException());

        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> fixture.controller.detail(fixture.request, KEY, storeId, fixture.session.contextVersion()));

        verify(fixture.overview, times(1)).detail(fixture.workspaceId, KEY, "STORE", storeId);
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, projectId);
        verifyNoInteractions(fixture.entities, fixture.contracts);
    }

    @Test
    void detailPreservesAbsentStoreFailureBeforeScopeAndBaseReadback() {
        Fixture fixture = fixture();
        UUID storeId = UUID.randomUUID();
        when(fixture.overview.detail(fixture.workspaceId, KEY, "STORE", storeId))
                .thenThrow(new BusinessEntityService.OrganizationNotFoundException());

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> fixture.controller.detail(fixture.request, KEY, storeId, fixture.session.contextVersion()));

        verify(fixture.overview, times(1)).detail(fixture.workspaceId, KEY, "STORE", storeId);
        verifyNoInteractions(fixture.user, fixture.entities, fixture.contracts);
    }

    @Test
    void createUsesOwnerProjectFactAndPassesAProjectGrantToTheOwnerWrite() {
        Fixture fixture = fixture();
        UUID scopedProjectId = selectedProjectId(fixture);
        UUID brandId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID headCompanyId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        var grant = new com.catering.v2s.organization.api.OperationsOwnerScopeGrant(
                fixture.workspaceId,
                KEY,
                "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE",
                "BC-ORG-STORE-CREATE",
                "PROJECT",
                scopedProjectId,
                "PROJECT",
                scopedProjectId,
                List.of(scopedProjectId));
        selectedProject(fixture, scopedProjectId);
        when(fixture.capabilityScopes.resolveUsingResolvedTaskPath(
                        fixture.session,
                        "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE",
                        new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", scopedProjectId),
                        projectPath(scopedProjectId)))
                .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(
                        WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                        "BC-ORG-STORE-CREATE",
                        new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                fixture.workspaceId,
                                KEY,
                                "PROJECT",
                                scopedProjectId,
                                "PROJECT",
                                scopedProjectId,
                                List.of(scopedProjectId))));
        var extensionSubmission = new com.catering.v2s.extension.api.ExtensionSubmission(
                List.of(new com.catering.v2s.extension.api.ExtensionSubmission.ExtensionFieldValue(
                        "remark", "\"test\"", com.catering.v2s.extension.api.ExtensionSubmission.Mode.SET)));
        var command = new OperationsStoreCommandApi.CreateStoreCommand(
                fixture.workspaceId,
                KEY,
                scopedProjectId,
                tenantId,
                brandId,
                headCompanyId,
                "STORE-01",
                "门店一",
                "备注",
                extensionSubmission,
                IDEMPOTENCY_KEY,
                fixture.actor,
                grant);
        when(fixture.entities.createStore(command))
                .thenReturn(new OrganizationEntityReadback(
                        storeId,
                        "STORE",
                        fixture.workspaceId,
                        KEY,
                        "STORE-01",
                        "门店一",
                        null,
                        null,
                        "ENABLED",
                        3L,
                        null,
                        null,
                        "备注",
                        0L,
                        10L,
                        11L,
                        Map.of()));
        when(fixture.overview.readStoreDetail(
                        new OperationsStoreCommandApi.StoreDetailQuery(fixture.workspaceId, KEY, storeId)))
                .thenReturn(new OperationsStoreCommandApi.StoreOrganizationDetailReadback(
                        new OperationsStoreCommandApi.Reference(scopedProjectId, "PRJ-01", "项目一"),
                        new OperationsStoreCommandApi.Reference(brandId, "BR-01", "品牌一"),
                        new OperationsStoreCommandApi.Reference(tenantId, "TEN-01", "经营主体一"),
                        new OperationsStoreCommandApi.Reference(headCompanyId, "HC-01", "总公司一")));
        when(fixture.contracts.readDerivedStoreStatus(
                        new com.catering.v2s.contract.api.OperationsStoreContractCommandApi.StoreStatusQuery(
                                fixture.workspaceId, KEY, storeId)))
                .thenReturn(
                        new com.catering.v2s.contract.api.OperationsStoreContractCommandApi.StoreDerivedStatusReadback(
                                "OPERATING"));
        when(fixture.overview.detail(fixture.workspaceId, KEY, "STORE", storeId))
                .thenReturn(new OrganizationOverviewTaskReadService.Item(
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
                        null));
        when(fixture.contracts.derivedStoreStatus(fixture.workspaceId, KEY, storeId))
                .thenReturn("OPERATING");

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
                        JSON.createObjectNode().put("remark", "test")));

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("门店一", response.getBody().name());
        assertEquals(scopedProjectId.toString(), response.getBody().project().id());
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.capabilityScopes)
                .resolveUsingResolvedTaskPath(
                        fixture.session,
                        "REQ_CREATE_OPERATIONS_ORGANIZATION_STORE",
                        new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", scopedProjectId),
                        projectPath(scopedProjectId));
        verify(fixture.entities)
                .createStore(new OperationsStoreCommandApi.CreateStoreCommand(
                        fixture.workspaceId,
                        KEY,
                        scopedProjectId,
                        tenantId,
                        brandId,
                        headCompanyId,
                        "STORE-01",
                        "门店一",
                        "备注",
                        new com.catering.v2s.extension.api.ExtensionSubmission(
                                List.of(new com.catering.v2s.extension.api.ExtensionSubmission.ExtensionFieldValue(
                                        "remark",
                                        "\"test\"",
                                        com.catering.v2s.extension.api.ExtensionSubmission.Mode.SET))),
                        IDEMPOTENCY_KEY,
                        fixture.actor,
                        grant));
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate project =
                new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        "PROJECT",
                        projectId,
                        "项目一",
                        "PRJ-01",
                        List.of("集团", "项目一"),
                        null,
                        projectId,
                        null,
                        /* format-wrap */
                        null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                KEY,
                accountId,
                UUID.randomUUID(),
                new WorkspaceSessionEntryReadback.ScopeContext(null, project, null, null),
                9L,
                5L,
                Set.of(),
                Set.of(),
                "Operations tester");
        return fixture(session);
    }

    private static Fixture fixture(WorkspaceSessionReadback session) {
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        var readFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts.class);
        when(readFacts.sessionReadback()).thenReturn(session);
        when(readFacts.groupWorkspaceKey()).thenReturn(session.groupWorkspaceKey());
        when(authentication.readAuthorizationFacts("operations-session")).thenReturn(readFacts);
        var commandFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts.class);
        when(commandFacts.sessionReadback()).thenReturn(session);
        when(authentication.commandAuthorizationFacts("operations-session")).thenReturn(commandFacts);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OrganizationOverviewTaskReadService overview = mock(OrganizationOverviewTaskReadService.class);
        ContractTaskReadService contracts = mock(ContractTaskReadService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        OperationsStoreManagementController controller = new OperationsStoreManagementController(
                new OperationsSessionResolver(authentication), entities, overview, contracts, user, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext(
                "test-rate-limit-fingerprint",
                "test-correlation",
                null,
                OperationsSessionCookie.fromCookie("operations-session"),
                null,
                null,
                null);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName());
        return new Fixture(
                controller,
                entities,
                overview,
                contracts,
                user,
                capabilityScopes,
                request,
                session,
                session.workspaceUuid(),
                actor);
    }

    private record Fixture(
            OperationsStoreManagementController controller,
            BusinessEntityService entities,
            OrganizationOverviewTaskReadService overview,
            ContractTaskReadService contracts,
            WorkspaceUserService user,
            WorkspaceCapabilityScopeResolver capabilityScopes,
            EdgeRequestContext request,
            WorkspaceSessionReadback session,
            UUID workspaceId,
            AuditActor actor) {}

    private static UUID selectedProjectId(Fixture fixture) {
        return fixture.session.scopeContext().project().dataNodeId();
    }

    private static void selectedProject(Fixture fixture, UUID projectId) {
        when(fixture.user.resolveSelectedProjectScope(fixture.session, null)).thenReturn(projectPath(projectId));
    }

    private static OrganizationTaskPathLookup.TaskPath projectPath(UUID projectId) {
        return new OrganizationTaskPathLookup.TaskPath(
                "PROJECT", projectId, List.of(projectId), /* format-wrap */ "集团 / 项目");
    }

    private static OrganizationOverviewTaskReadService.Item storeDetail(UUID storeId, UUID projectId) {
        UUID brandId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID headCompanyId = UUID.randomUUID();
        return new OrganizationOverviewTaskReadService.Item(
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
                new OrganizationOverviewTaskReadService.Reference(projectId, "PRJ-01", "项目一", true),
                new OrganizationOverviewTaskReadService.Reference(brandId, "BR-01", "品牌一", true),
                new OrganizationOverviewTaskReadService.Reference(tenantId, "TEN-01", "经营主体一", true),
                new OrganizationOverviewTaskReadService.Reference(headCompanyId, "HC-01", "总公司一", true),
                List.of(),
                List.of(),
                null);
    }

    private static OrganizationEntityReadback storeEntity(
            OrganizationOverviewTaskReadService.Item detail, UUID workspaceId) {
        return new OrganizationEntityReadback(
                detail.id(),
                "STORE",
                workspaceId,
                detail.groupWorkspaceKey(),
                detail.code(),
                detail.name(),
                null,
                null,
                detail.status(),
                detail.version(),
                null,
                null,
                detail.notes(),
                0L,
                detail.createdAt(),
                detail.updatedAt(),
                Map.of());
    }
}
