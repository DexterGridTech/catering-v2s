package com.catering.v2s.app.edge.operations.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.StoreContractCreateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreContractInvalidateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreContractItem;
import com.catering.v2s.app.edge.generated.wire.StoreContractUpdateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.contract.application.ContractCommandService;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.JsonNodeFactory;

class OperationsContractControllerScopeAndCandidateTest {
    private static final String KEY = "operations-contract-scope-test";
    private static final String IDEMPOTENCY_KEY = "operations-contract-scope-idempotency";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void parsesObjectExtensionValuesWithTheGeneratedJackson3RequestType() throws Exception {
        StoreContractCreateRequest request = JSON.readValue("{\"storeId\":\"00000000-0000-0000-0000-000000000002\",\"contractNo\":\"HT-001\",\"effectiveFrom\":\"2026-08-01\",\"extensionValues\":{\"remark\":\"test\"},\"items\":[{\"code\":\"SKU-1\",\"name\":\"商品一\"}]}", StoreContractCreateRequest.class);

        assertEquals(Map.of("remark", "\"test\""), ContractWireMapper.requestValues(request.extensionValues()));
    }

    @Test
    void candidatesUseTheRetainedSelectedProjectAndReadSelectedStoreTenantFromOwner() {
        Fixture fixture = fixture();
        UUID selectedProjectId = selectedProjectId(fixture);
        UUID storeId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        selectedProject(fixture, selectedProjectId);
        when(fixture.reads.candidates(fixture.workspaceId, KEY, selectedProjectId, storeId, "门店", 1, 50)).thenReturn(new ContractTaskReadService.CandidatePage(
            KEY,
            new ContractTaskReadService.Project(selectedProjectId, "PRJ-01", "项目一"),
            new ContractTaskReadService.CandidateMetadata("门店", 1, 50, 1L),
            List.of(new ContractTaskReadService.StoreCandidate(storeId, "STORE-01", "门店一", "ENABLED")),
            List.of("一期")
        ));
        when(fixture.entities.requireStoreContractContext(fixture.workspaceId, KEY, storeId))
            .thenReturn(new StoreContractLookup.StoreContractContext(storeId, tenantId, selectedProjectId, "ENABLED", List.of("一期")));
        when(fixture.entities.requireEntity("TENANT", fixture.workspaceId, KEY, tenantId))
            .thenReturn(new OrganizationEntityReadback(tenantId, "TENANT", fixture.workspaceId, KEY, "TEN-01", "经营主体一", null, null, "ENABLED", 1L, null, null, null, 0L, 10L, 11L, Map.of()));

        var result = fixture.controller.candidates(fixture.request, KEY, fixture.session.contextVersion(), "门店", storeId, 1, 50);

        assertEquals(selectedProjectId.toString(), result.project().id());
        assertEquals("经营主体一", result.selectedStoreTenant().get("name").asText());
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.reads).candidates(fixture.workspaceId, KEY, selectedProjectId, storeId, "门店", 1, 50);
        verify(fixture.entities).requireStoreContractContext(fixture.workspaceId, KEY, storeId);
        verify(fixture.entities).requireEntity("TENANT", fixture.workspaceId, KEY, tenantId);
    }

    @Test
    void extensionDefinitionIsWorkspaceScopedAssociationMetadataWithoutProjectRangeResolution() {
        Fixture fixture = fixture();
        when(fixture.definitions.managementDefinition(fixture.workspaceId, KEY, "CONTRACT"))
            .thenReturn(new ExtensionDefinitionReadback(KEY, "CONTRACT", 2L, 10L, List.of()));

        var result = fixture.controller.extensionDefinition(fixture.request, KEY, fixture.session.contextVersion());

        assertEquals("CONTRACT", result.entityType().wire());
        verify(fixture.definitions).managementDefinition(fixture.workspaceId, KEY, "CONTRACT");
        verifyNoInteractions(fixture.user);
    }

    @Test
    void createUsesStoreOwnerProjectAndPassesServerResolvedGrantToContractOwner() {
        Fixture fixture = fixture();
        UUID scopedProjectId = selectedProjectId(fixture);
        UUID storeId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID contractId = UUID.randomUUID();
        selectedProject(fixture, scopedProjectId);
        var grant = new com.catering.v2s.organization.api.OperationsOwnerScopeGrant(fixture.workspaceId, KEY, "REQ_CREATE_OPERATIONS_CONTRACT", "BC-CONTRACT-CREATE", "PROJECT", scopedProjectId, "PROJECT", scopedProjectId, List.of(scopedProjectId));
        when(fixture.entities.requireStoreContractContext(fixture.workspaceId, KEY, storeId))
            .thenReturn(new StoreContractLookup.StoreContractContext(storeId, tenantId, scopedProjectId, "ENABLED", List.of("一期")));
        when(fixture.capabilityScopes.resolve(fixture.session, "REQ_CREATE_OPERATIONS_CONTRACT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", scopedProjectId)))
            .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(WorkspaceCapabilityScopeResolver.Decision.ALLOW, "BC-CONTRACT-CREATE", new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(fixture.workspaceId, KEY, "PROJECT", scopedProjectId, "PROJECT", scopedProjectId, List.of(scopedProjectId))));
        when(fixture.contracts.create(
            fixture.workspaceId,
            KEY,
            "HT-001",
            storeId,
            scopedProjectId,
            LocalDate.parse("2026-07-30"),
            null,
            "一期",
            "备注",
            List.of(new ContractCommandService.ItemInput("SKU-1", "货号一")),
            Map.of(),
            IDEMPOTENCY_KEY,
            fixture.actor,
            grant
        )).thenReturn(new StoreContractReadback(
            contractId,
            fixture.workspaceId,
            KEY,
            "HT-001",
            storeId,
            tenantId,
            LocalDate.parse("2026-07-30"),
            null,
            "一期",
            "备注",
            "VALID",
            3L,
            List.of(new StoreContractReadback.Item(1, "SKU-1", "货号一"))
        ));
        when(fixture.reads.view(fixture.workspaceId, KEY, contractId)).thenReturn(new ContractTaskReadService.StoreContractView(
            contractId,
            KEY,
            new ContractTaskReadService.Reference(scopedProjectId, "PRJ-01", "项目一"),
            new ContractTaskReadService.Reference(storeId, "STORE-01", "门店一"),
            new ContractTaskReadService.Reference(tenantId, "TEN-01", "经营主体一"),
            "一期",
            "HT-001",
            LocalDate.parse("2026-07-30"),
            null,
            "备注",
            Map.of(),
            0L,
            "VALID",
            3L,
            "MANUAL",
            10L,
            11L,
            List.of(new ContractTaskReadService.Item("SKU-1", "货号一")),
            "一期"
        ));

        var response = fixture.controller.create(
            fixture.request,
            KEY,
            IDEMPOTENCY_KEY,
            new StoreContractCreateRequest(
                storeId.toString(),
                "一期",
                "HT-001",
                "2026-07-30",
                null,
                "备注",
                JsonNodeFactory.instance.objectNode(),
                null,
                List.of(new StoreContractItem("SKU-1", "货号一")),
                "一期"
            )
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("HT-001", response.getBody().contractNo());
        assertEquals(scopedProjectId.toString(), response.getBody().project().id());
        verify(fixture.entities).requireStoreContractContext(fixture.workspaceId, KEY, storeId);
        verify(fixture.user).resolveSelectedProjectScope(fixture.session, null);
        verify(fixture.capabilityScopes).resolve(fixture.session, "REQ_CREATE_OPERATIONS_CONTRACT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", scopedProjectId));
        verify(fixture.contracts).create(
            fixture.workspaceId,
            KEY,
            "HT-001",
            storeId,
            scopedProjectId,
            LocalDate.parse("2026-07-30"),
            null,
            "一期",
            "备注",
            List.of(new ContractCommandService.ItemInput("SKU-1", "货号一")),
            Map.of(),
            IDEMPOTENCY_KEY,
            fixture.actor,
            grant
        );
    }

    @Test
    void updateAndInvalidateRejectAContractOutsideTheRetainedSelectedProjectBeforeCommands() {
        Fixture fixture = fixture();
        UUID selectedProjectId = selectedProjectId(fixture);
        UUID foreignProjectId = UUID.randomUUID();
        UUID contractId = UUID.randomUUID();
        when(fixture.reads.view(fixture.workspaceId, KEY, contractId))
            .thenReturn(contractView(contractId, foreignProjectId));
        when(fixture.user.resolveSelectedProjectScope(fixture.session, foreignProjectId))
            .thenThrow(new WorkspaceUserService.TaskScopeDeniedException());

        assertThrows(
            WorkspaceUserService.TaskScopeDeniedException.class,
            () -> fixture.controller.update(
                fixture.request,
                KEY,
                contractId,
                IDEMPOTENCY_KEY,
                new StoreContractUpdateRequest("一期", "2026-07-30", null, "备注", JsonNodeFactory.instance.objectNode(), null, 3L, List.of(new StoreContractItem("SKU-1", "货号一")), "一期")
            )
        );
        assertThrows(
            WorkspaceUserService.TaskScopeDeniedException.class,
            () -> fixture.controller.invalidate(fixture.request, KEY, contractId, IDEMPOTENCY_KEY, new StoreContractInvalidateRequest(3L))
        );

        verify(fixture.user, times(2)).resolveSelectedProjectScope(fixture.session, foreignProjectId);
        verifyNoInteractions(fixture.contracts, fixture.capabilityScopes);
        assertEquals(selectedProjectId, fixture.session.scopeContext().project().dataNodeId());
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate project = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate("PROJECT", projectId, "项目一", "PRJ-01", List.of("集团", "项目一"), null, projectId, null, null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, KEY, accountId, UUID.randomUUID(), new WorkspaceSessionEntryReadback.ScopeContext(null, project, null, null), 11L, 7L, Set.of(), Set.of(), "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        ContractCommandService contracts = mock(ContractCommandService.class);
        ContractTaskReadService reads = mock(ContractTaskReadService.class);
        ExtensionDefinitionService definitions = mock(ExtensionDefinitionService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        WorkspaceCapabilityScopeResolver capabilityScopes = mock(WorkspaceCapabilityScopeResolver.class);
        OperationsContractController controller = new OperationsContractController(new OperationsSessionResolver(authentication), contracts, reads, definitions, user, entities, capabilityScopes);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester");
        return new Fixture(controller, contracts, reads, definitions, user, entities, capabilityScopes, request, session, workspaceId, actor);
    }

    private record Fixture(
        OperationsContractController controller,
        ContractCommandService contracts,
        ContractTaskReadService reads,
        ExtensionDefinitionService definitions,
        WorkspaceUserService user,
        BusinessEntityService entities,
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

    private static ContractTaskReadService.StoreContractView contractView(UUID contractId, UUID projectId) {
        UUID storeId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        return new ContractTaskReadService.StoreContractView(
            contractId,
            KEY,
            new ContractTaskReadService.Reference(projectId, "PRJ-01", "项目一"),
            new ContractTaskReadService.Reference(storeId, "STORE-01", "门店一"),
            new ContractTaskReadService.Reference(tenantId, "TEN-01", "经营主体一"),
            "一期",
            "HT-001",
            LocalDate.parse("2026-07-30"),
            null,
            "备注",
            Map.of(),
            0L,
            "VALID",
            3L,
            "MANUAL",
            10L,
            11L,
            List.of(new ContractTaskReadService.Item("SKU-1", "货号一")),
            "一期"
        );
    }
}
