package com.catering.v2s.app.edge.platform.extension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceStatus;
import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformExtensionDefinitionControllerTest {
    private static final String WORKSPACE_KEY = "platform-extension";

    @Test
    void platformExtensionGetsUseTypedOwnerTaskReadBoundaries() {
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session"))
                .thenReturn(new PlatformSessionReadback(
                        UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform", Long.MAX_VALUE));
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        UUID workspaceId = UUID.randomUUID();
        when(workspaces.require(WORKSPACE_KEY))
                .thenReturn(new WorkspaceAdministrationReadback(
                        workspaceId,
                        WORKSPACE_KEY,
                        "Workspace",
                        "Operations",
                        null,
                        null,
                        "ENABLED",
                        1L,
                        1L,
                        1L,
                        1L,
                        true));
        ExtensionDefinitionService definitions = mock(ExtensionDefinitionService.class);
        when(definitions.platformManagementDefinitions(workspaceId, WORKSPACE_KEY))
                .thenReturn(List.of(new ExtensionDefinitionReadback(
                        WORKSPACE_KEY, "BRAND", 1L, 2L, List.of(), "ENABLED", List.of())));
        when(definitions.platformManagementDefinition(workspaceId, WORKSPACE_KEY, "BRAND"))
                .thenReturn(new ExtensionDefinitionReadback(
                        WORKSPACE_KEY, "BRAND", 1L, 2L, List.of(), "ENABLED", List.of()));
        PlatformExtensionDefinitionController controller = new PlatformExtensionDefinitionController(
                new PlatformSessionResolver(authentication), workspaces, definitions);
        EdgeRequestContext request = new EdgeRequestContext(
                "fingerprint",
                "correlation",
                PlatformSessionCookie.fromCookie("platform-session"),
                null,
                null,
                null,
                null);

        assertEquals(1, controller.list(request, WORKSPACE_KEY).items().size());
        assertEquals(
                "BRAND",
                controller.detail(request, WORKSPACE_KEY, "BRAND").entityType().wire());
        assertEquals(
                GroupWorkspaceStatus.ENABLED,
                controller.detail(request, WORKSPACE_KEY, "BRAND").workspaceStatus());
        assertEquals(
                List.of(), controller.detail(request, WORKSPACE_KEY, "BRAND").blockers());

        verify(definitions).platformManagementDefinitions(eq(workspaceId), eq(WORKSPACE_KEY));
        verify(definitions).platformManagementDefinition(eq(workspaceId), eq(WORKSPACE_KEY), eq("BRAND"));
    }
}
