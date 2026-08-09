package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPage;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformWorkspaceAdministrationTaskReadServiceTest {
    @Test
    void pageUsesOnlyTheThreeNamedOwnerStages() {
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        OrganizationGroupWorkspaceInitializationLookup initialization = mock(OrganizationGroupWorkspaceInitializationLookup.class);
        PlatformAssetService assets = mock(PlatformAssetService.class);
        WorkspaceIamSummaryLookup iam = mock(WorkspaceIamSummaryLookup.class);
        WorkspaceAdministrationReadback item = new WorkspaceAdministrationReadback(UUID.randomUUID(), "gw", "name", "title", null, null, "ENABLED", 1, 1, 1, 1, true);
        WorkspaceAdministrationPage page = new WorkspaceAdministrationPage(List.of(item), 1, 20, 1, "NAME", "ASC");
        WorkspaceAdministrationPageRequest request = new WorkspaceAdministrationPageRequest(null, null, null, null, 1, 20, "NAME", "ASC");
        when(workspaces.list(request)).thenReturn(page);
        when(initialization.listInitializationFacts(List.of("gw"))).thenReturn(Map.of("gw", new OrganizationGroupWorkspaceInitializationLookup.InitializationState("gw", true)));
        when(assets.requireActivePublicReferences(any())).thenReturn(Map.of());

        var result = new PlatformWorkspaceAdministrationTaskReadService(workspaces, initialization, assets, iam).page(request);

        assertSame(page, result.workspacePage());
        verify(workspaces).list(request);
        verify(initialization).listInitializationFacts(List.of("gw"));
        verify(assets).requireActivePublicReferences(any());
        verifyNoMoreInteractions(workspaces, initialization, assets, iam);
    }

    @Test
    void detailUsesExactlyTheFrozenFourOwnerStages() {
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        OrganizationGroupWorkspaceInitializationLookup initialization = mock(OrganizationGroupWorkspaceInitializationLookup.class);
        PlatformAssetService assets = mock(PlatformAssetService.class);
        WorkspaceIamSummaryLookup iam = mock(WorkspaceIamSummaryLookup.class);
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(UUID.randomUUID(), "gw", "name", "title", null, null, "ENABLED", 1, 1, 1, 1, true);
        when(workspaces.require("gw")).thenReturn(workspace);
        when(initialization.initializationFact("gw")).thenReturn(java.util.Optional.empty());
        when(assets.requireActivePublicReferences(any())).thenReturn(Map.of());
        when(iam.accountAndRoleSummary(workspace.workspaceUuid())).thenReturn(new WorkspaceIamSummaryLookup.AccountAndRoleSummary(3, 4));

        var result = new PlatformWorkspaceAdministrationTaskReadService(workspaces, initialization, assets, iam).detail("gw");

        assertSame(workspace, result.workspace());
        verify(workspaces).require("gw");
        verify(initialization).initializationFact("gw");
        verify(assets).requireActivePublicReferences(any());
        verify(iam).accountAndRoleSummary(workspace.workspaceUuid());
        verifyNoMoreInteractions(workspaces, initialization, assets, iam);
    }
}
