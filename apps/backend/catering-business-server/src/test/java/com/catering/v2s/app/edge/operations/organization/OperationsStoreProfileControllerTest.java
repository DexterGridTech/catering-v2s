package com.catering.v2s.app.edge.operations.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.StoreContractViewState;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsStoreProfileControllerTest {
    @Test
    void forwardsTypedStateAndPagingWithoutAnyClientClassification() {
        UUID workspaceId = UUID.randomUUID(); UUID storeId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(UUID.randomUUID(), workspaceId, "store-profile-test", UUID.randomUUID(), UUID.randomUUID(), storeId, 7L, 1L, Set.of(), Set.of(), "tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        ContractTaskReadService reads = mock(ContractTaskReadService.class);
        when(reads.fixedStoreContractPage(workspaceId, "store-profile-test", storeId, ContractTaskReadService.FixedStoreContractViewState.PENDING_EFFECTIVE, 2, 10)).thenReturn(new ContractTaskReadService.FixedStoreContractPage(
            "store-profile-test", new ContractTaskReadService.Project(UUID.randomUUID(), "PRJ-01", "项目一"), 2, 10, 1L,
            List.of(new ContractTaskReadService.StoreContractView(UUID.randomUUID(), "store-profile-test", new ContractTaskReadService.Reference(UUID.randomUUID(), "PRJ-01", "项目一"), new ContractTaskReadService.Reference(storeId, "STORE-01", "门店一"), new ContractTaskReadService.Reference(UUID.randomUUID(), "TEN-01", "经营主体一"), "一期", "HT-001", LocalDate.of(2026, 8, 2), null, null, Map.of(), 0L, "VALID", 1L, "MANUAL", 1L, 1L, List.of(), "一期"))
        ));
        var controller = new OperationsStoreProfileController(new OperationsSessionResolver(authentication), mock(BusinessEntityService.class), mock(OrganizationOverviewTaskReadService.class), reads);
        var request = new EdgeRequestContext("test-rate-limit", "test-correlation", null, OperationsSessionCookie.fromCookie("operations-session"), null, null, null);

        var page = controller.contracts(request, "store-profile-test", 7L, StoreContractViewState.PENDING_EFFECTIVE, 2, 10);

        assertEquals(1L, page.metadata().total());
        assertEquals("HT-001", page.items().getFirst().contractNo());
        verify(reads).fixedStoreContractPage(workspaceId, "store-profile-test", storeId, ContractTaskReadService.FixedStoreContractViewState.PENDING_EFFECTIVE, 2, 10);
    }
}
