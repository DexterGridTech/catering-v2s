package com.catering.v2s.app.edge.platform.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.extension.application.ExtensionAuditHistoryService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.iam.application.PlatformIamAuditHistoryService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceAuditHistoryService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Guards the retired platform invitation audit dispatch while retaining account audit owner reads. */
class PlatformAuditHistoryControllerTest {
    private static final String WORKSPACE_KEY = "platform-audit-test";

    @Test
    void retiredInvitationTargetIsRejectedBeforeAnyOwnerRead() {
        Fixture fixture = fixture();

        assertThrows(InvalidEdgeRequestException.class, () -> fixture.controller.history(
            fixture.request, WORKSPACE_KEY, "WORKSPACE_INVITATION", UUID.randomUUID().toString(), 1, 20));

        verify(fixture.authentication).requireActiveSession("platform-session");
        verifyNoInteractions(fixture.groupWorkspaceAudit, fixture.workspaces, fixture.platformIamAudit,
            fixture.workspaceIamAudit, fixture.extensionAudit, fixture.contractAudit);
    }

    @Test
    void workspaceAccountTargetStillUsesAuthorizedWorkspaceIamOwnerRead() {
        Fixture fixture = fixture();
        UUID workspaceUuid = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(
            workspaceUuid, WORKSPACE_KEY, "Test workspace", "Operations", null, null,
            "ENABLED", 1L, 1L, 1L, 1L, true);
        AuditReadScope scope = new AuditReadScope(workspaceUuid, WORKSPACE_KEY);
        AuditTarget target = new AuditTarget("WORKSPACE_ACCOUNT", accountId.toString());
        when(fixture.workspaces.requireEnabled(WORKSPACE_KEY)).thenReturn(workspace);
        when(fixture.workspaceIamAudit.read(eq(scope), eq(target), eq(1L), eq(20L)))
            .thenReturn(new AuditHistoryPage(List.of(), 1L, 20L, 0L));

        var result = fixture.controller.history(fixture.request, WORKSPACE_KEY, "WORKSPACE_ACCOUNT", accountId.toString(), 1, 20);

        assertEquals(0L, result.total());
        verify(fixture.workspaces).requireEnabled(WORKSPACE_KEY);
        verify(fixture.workspaceIamAudit).read(scope, target, 1, 20);
    }

    private static Fixture fixture() {
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session"))
            .thenReturn(new PlatformSessionReadback(UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE));
        PlatformWorkspaceAuditHistoryService groupWorkspaceAudit = mock(PlatformWorkspaceAuditHistoryService.class);
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        PlatformIamAuditHistoryService platformIamAudit = mock(PlatformIamAuditHistoryService.class);
        WorkspaceIamAuditHistoryService workspaceIamAudit = mock(WorkspaceIamAuditHistoryService.class);
        ExtensionAuditHistoryService extensionAudit = mock(ExtensionAuditHistoryService.class);
        ContractAuditHistoryService contractAudit = mock(ContractAuditHistoryService.class);
        PlatformAuditHistoryController controller = new PlatformAuditHistoryController(
            new PlatformSessionResolver(authentication), groupWorkspaceAudit, workspaces, platformIamAudit,
            workspaceIamAudit, extensionAudit, contractAudit);
        EdgeRequestContext request = new EdgeRequestContext("test-fingerprint", "test-correlation",
            PlatformSessionCookie.fromCookie("platform-session"), null, null, null, null);
        return new Fixture(controller, authentication, groupWorkspaceAudit, workspaces, platformIamAudit,
            workspaceIamAudit, extensionAudit, contractAudit, request);
    }

    private record Fixture(
        PlatformAuditHistoryController controller,
        PlatformAuthenticationService authentication,
        PlatformWorkspaceAuditHistoryService groupWorkspaceAudit,
        WorkspaceAdministrationService workspaces,
        PlatformIamAuditHistoryService platformIamAudit,
        WorkspaceIamAuditHistoryService workspaceIamAudit,
        ExtensionAuditHistoryService extensionAudit,
        ContractAuditHistoryService contractAudit,
        EdgeRequestContext request
    ) { }
}
