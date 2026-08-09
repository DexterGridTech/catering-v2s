package com.catering.v2s.app.edge.platform.contract;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;

import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformContractOverviewControllerTest {
    private static final String KEY = "platform-contract-test";

    @Test
    void platformFiltersAdaptOnlyIntoTheCanonicalContractQuery() {
        UUID workspaceUuid = UUID.randomUUID();
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session")).thenReturn(new PlatformSessionReadback(UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE));
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        when(workspaces.requireEnabled(KEY)).thenReturn(new WorkspaceAdministrationReadback(workspaceUuid, KEY, "Test workspace", "Operations", null, null, "ENABLED", 1L, 1L, 1L, 1L, true));
        ContractTaskReadService reads = mock(ContractTaskReadService.class);
        UUID storeId = UUID.randomUUID(); UUID tenantId = UUID.randomUUID();
        when(reads.platformOverviewTaskPage(eq(workspaceUuid), eq(KEY), org.mockito.ArgumentMatchers.<ContractTaskReadService.ContractListQuery>argThat(query -> query.projectId() == null && storeId.equals(query.storeId()) && "CT-01".equals(query.contractNo()) && "一期".equals(query.phaseName()) && tenantId.equals(query.tenantId()) && "ITEM-1".equals(query.itemCode()) && "VALID".equals(query.status()) && "CONTRACT_NO".equals(query.sort()) && "ASC".equals(query.direction()) && query.page() == 2 && query.pageSize() == 40))).thenReturn(new ContractTaskReadService.ContractPage(new ContractTaskReadService.ContractPageMetadata(KEY, null, null, 2, 40, 0L, "CONTRACT_NO", "ASC"), List.of()));
        PlatformContractOverviewController controller = new PlatformContractOverviewController(new PlatformSessionResolver(authentication), reads, mock(ExtensionDefinitionService.class), workspaces);
        EdgeRequestContext request = new EdgeRequestContext("test-fingerprint", "test-correlation", PlatformSessionCookie.fromCookie("platform-session"), null, null, null, null);

        controller.page(request, KEY, "CT-01", storeId, "一期", tenantId, "ITEM-1", "VALID", "CONTRACT_NO", "ASC", 2, 40);

        verify(reads).platformOverviewTaskPage(eq(workspaceUuid), eq(KEY), org.mockito.ArgumentMatchers.<ContractTaskReadService.ContractListQuery>argThat(query -> query.projectId() == null && storeId.equals(query.storeId()) && "CT-01".equals(query.contractNo()) && "一期".equals(query.phaseName()) && tenantId.equals(query.tenantId()) && "ITEM-1".equals(query.itemCode()) && "VALID".equals(query.status()) && "CONTRACT_NO".equals(query.sort()) && "ASC".equals(query.direction()) && query.page() == 2 && query.pageSize() == 40));
    }
}
