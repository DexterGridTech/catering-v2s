package com.catering.v2s.app.edge.operations.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.StoreContractCreateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreContractItem;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.contract.application.ContractCommandService;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
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
        StoreContractCreateRequest request = JSON.readValue("{\"projectId\":\"00000000-0000-0000-0000-000000000001\",\"storeId\":\"00000000-0000-0000-0000-000000000002\",\"contractNo\":\"HT-001\",\"effectiveFrom\":\"2026-08-01\",\"extensionValues\":{\"remark\":\"test\"},\"items\":[{\"code\":\"SKU-1\",\"name\":\"商品一\"}]}", StoreContractCreateRequest.class);

        assertEquals(Map.of("remark", "\"test\""), ContractWireMapper.requestValues(request.extensionValues()));
    }

    @Test
    void candidatesUseScopedProjectAndReadSelectedStoreTenantFromOwner() {
        Fixture fixture = fixture();
        UUID requestedProjectId = UUID.randomUUID();
        UUID scopedProjectId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        when(fixture.user.resolveTaskScope(fixture.session, "PROJECT", requestedProjectId))
            .thenReturn(new OrganizationTaskPathLookup.TaskPath("PROJECT", scopedProjectId, List.of(scopedProjectId), "集团 / 项目"));
        when(fixture.reads.candidates(fixture.workspaceId, KEY, scopedProjectId, "门店", 1, 50)).thenReturn(new ContractTaskReadService.CandidatePage(
            KEY,
            new ContractTaskReadService.Project(scopedProjectId, "PRJ-01", "项目一"),
            new ContractTaskReadService.CandidateMetadata("门店", 1, 50, 1L),
            List.of(new ContractTaskReadService.StoreCandidate(storeId, "STORE-01", "门店一", "ENABLED")),
            List.of("一期")
        ));
        when(fixture.entities.requireStoreContractContext(fixture.workspaceId, KEY, storeId))
            .thenReturn(new StoreContractLookup.StoreContractContext(storeId, tenantId, scopedProjectId, "ENABLED", List.of("一期")));
        when(fixture.entities.requireEntity("TENANT", fixture.workspaceId, KEY, tenantId))
            .thenReturn(new OrganizationEntityReadback(tenantId, "TENANT", fixture.workspaceId, KEY, "TEN-01", "经营主体一", null, null, "ENABLED", 1L, null, null, null, 0L, 10L, 11L, Map.of()));

        var result = fixture.controller.candidates(fixture.request, KEY, fixture.session.contextVersion(), requestedProjectId, "门店", storeId, 1, 50);

        assertEquals(scopedProjectId.toString(), result.project().id());
        assertEquals("经营主体一", result.selectedStoreTenant().name());
        verify(fixture.user).resolveTaskScope(fixture.session, "PROJECT", requestedProjectId);
        verify(fixture.reads).candidates(fixture.workspaceId, KEY, scopedProjectId, "门店", 1, 50);
        verify(fixture.entities).requireStoreContractContext(fixture.workspaceId, KEY, storeId);
        verify(fixture.entities).requireEntity("TENANT", fixture.workspaceId, KEY, tenantId);
    }

    @Test
    void createUsesScopedProjectForOwnerCommandInsteadOfRawPageSelection() {
        Fixture fixture = fixture();
        UUID requestedProjectId = UUID.randomUUID();
        UUID scopedProjectId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID contractId = UUID.randomUUID();
        when(fixture.user.resolveTaskScope(fixture.session, "PROJECT", requestedProjectId))
            .thenReturn(new OrganizationTaskPathLookup.TaskPath("PROJECT", scopedProjectId, List.of(scopedProjectId), "集团 / 项目"));
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
            fixture.actor
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
                requestedProjectId.toString(),
                storeId.toString(),
                "一期",
                "HT-001",
                "2026-07-30",
                null,
                "备注",
                JsonNodeFactory.instance.objectNode(),
                List.of(new StoreContractItem("SKU-1", "货号一")),
                "一期"
            )
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("HT-001", response.getBody().contractNo());
        assertEquals(scopedProjectId.toString(), response.getBody().project().id());
        verify(fixture.user).resolveTaskScope(fixture.session, "PROJECT", requestedProjectId);
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
            fixture.actor
        );
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, KEY, accountId, UUID.randomUUID(), UUID.randomUUID(), 11L, 7L, Set.of(), Set.of(), "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        ContractCommandService contracts = mock(ContractCommandService.class);
        ContractTaskReadService reads = mock(ContractTaskReadService.class);
        ExtensionDefinitionService definitions = mock(ExtensionDefinitionService.class);
        WorkspaceUserService user = mock(WorkspaceUserService.class);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OperationsContractController controller = new OperationsContractController(new OperationsSessionResolver(authentication), contracts, reads, definitions, user, entities);
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);
        AuditActor actor = new AuditActor("WORKSPACE_ACCOUNT", accountId, "Operations tester");
        return new Fixture(controller, contracts, reads, user, entities, request, session, workspaceId, actor);
    }

    private record Fixture(
        OperationsContractController controller,
        ContractCommandService contracts,
        ContractTaskReadService reads,
        WorkspaceUserService user,
        BusinessEntityService entities,
        EdgeRequestContext request,
        WorkspaceSessionReadback session,
        UUID workspaceId,
        AuditActor actor
    ) { }
}
