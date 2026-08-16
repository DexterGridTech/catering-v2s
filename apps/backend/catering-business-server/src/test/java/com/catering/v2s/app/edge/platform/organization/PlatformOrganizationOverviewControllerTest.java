package com.catering.v2s.app.edge.platform.organization;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformOrganizationOverviewControllerTest {
    @Test
    void pageUsesTheNamedPlatformOverviewTaskReader() {
        PlatformSessionResolver sessions = mock(PlatformSessionResolver.class);
        PlatformSessionResolver.PlatformReadSessionFacts readFacts =
                mock(PlatformSessionResolver.PlatformReadSessionFacts.class);
        PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace =
                mock(PlatformSessionResolver.EnabledSelectedWorkspaceFact.class);
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        OrganizationOverviewTaskReadService overview = mock(OrganizationOverviewTaskReadService.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        UUID workspaceId = UUID.randomUUID();
        when(sessions.requireRead(request)).thenReturn(readFacts);
        when(readFacts.requireEnabledSelectedWorkspace(workspaces, "organization-test"))
                .thenReturn(workspace);
        when(workspace.workspaceUuid()).thenReturn(workspaceId);
        when(overview.platformOverviewTaskPage(any(), any(), any(), any(), any(Integer.class), any(Integer.class)))
                .thenReturn(new OrganizationOverviewTaskReadService.Page(
                        new OrganizationOverviewTaskReadService.Metadata(
                                "organization-test", "HIERARCHY", 1, 20, 0L, "UPDATED_AT", "DESC"),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of(),
                        List.of(),
                        "AVAILABLE",
                        0L,
                        List.of()));
        PlatformOrganizationOverviewController controller = new PlatformOrganizationOverviewController(
                sessions,
                workspaces,
                overview,
                mock(StoreCandidateTaskReadService.class),
                mock(ExtensionDefinitionService.class));

        controller.page(
                request,
                "organization-test",
                "HIERARCHY",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "UPDATED_AT",
                "DESC",
                1,
                20);

        verify(overview)
                .platformOverviewTaskPage(
                        workspaceId,
                        "organization-test",
                        "HIERARCHY",
                        new OrganizationOverviewTaskReadService.Query(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "UPDATED_AT",
                                "DESC",
                                null),
                        1,
                        20);
    }
}
