package com.catering.v2s.app.edge.platform.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.read.PlatformAuditHistoryTaskReadService;
import com.catering.v2s.audit.read.PlatformAuditHistoryTaskReadService.PlatformAuditHistoryQuery;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.iam.application.PlatformIamAuditHistoryService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** Guards platform-session-authorized workspace-IAM audit dispatch, including permanent invitation governance. */
class PlatformAuditHistoryControllerTest {
    private static final String WORKSPACE_KEY = "platform-audit-test";

    @Test
    void workspaceInvitationTargetCreatesTypedQueryAndDelegatesOnce() {
        Fixture fixture = fixture();
        UUID invitationId = UUID.randomUUID();
        when(fixture.reads.read(any(), any())).thenReturn(new com.catering.v2s.audit.contract.AuditHistoryPage(List.of(), 1L, 20L, 0L));

        var result = fixture.controller.history(
            fixture.request, WORKSPACE_KEY, "WORKSPACE_INVITATION", invitationId.toString(), 1, 20);

        assertEquals(0L, result.total());
        verify(fixture.authentication).requireActiveSession("platform-session");
        ArgumentCaptor<PlatformAuditHistoryQuery> query = ArgumentCaptor.forClass(PlatformAuditHistoryQuery.class);
        verify(fixture.reads).read(any(), query.capture());
        assertEquals(new PlatformAuditHistoryQuery.WorkspaceInvitation(
            new com.catering.v2s.audit.contract.AuditTarget("WORKSPACE_INVITATION", invitationId.toString()), WORKSPACE_KEY, 1, 20), query.getValue());
    }

    @Test
    void platformAdminTargetDoesNotRequireAWorkspaceInput() {
        Fixture fixture = fixture();
        UUID platformAdminId = UUID.randomUUID();
        when(fixture.reads.read(any(), any())).thenReturn(new com.catering.v2s.audit.contract.AuditHistoryPage(List.of(), 1L, 20L, 0L));

        fixture.controller.history(fixture.request, null, "PLATFORM_ADMIN", platformAdminId.toString(), 1, 20);

        ArgumentCaptor<PlatformAuditHistoryQuery> query = ArgumentCaptor.forClass(PlatformAuditHistoryQuery.class);
        verify(fixture.reads).read(any(), query.capture());
        assertEquals(new PlatformAuditHistoryQuery.PlatformAdmin(
            new com.catering.v2s.audit.contract.AuditTarget("PLATFORM_ADMIN", platformAdminId.toString()), 1, 20), query.getValue());
    }

    @Test
    void workspaceHostedTargetWithoutWorkspaceKeyFailsBeforeReader() {
        Fixture fixture = fixture();
        assertThrows(com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class, () -> fixture.controller.history(
            fixture.request, null, "WORKSPACE_INVITATION", UUID.randomUUID().toString(), 1, 20));
        verifyNoInteractions(fixture.reads);
    }

    @Test
    void invalidPageOrUuidFailsBeforeReader() {
        Fixture fixture = fixture();
        assertThrows(com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class, () -> fixture.controller.history(
            fixture.request, WORKSPACE_KEY, "WORKSPACE_ACCOUNT", "not-a-uuid", 1, 20));
        assertThrows(com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class, () -> fixture.controller.history(
            fixture.request, WORKSPACE_KEY, "WORKSPACE_ACCOUNT", UUID.randomUUID().toString(), 0, 20));
        assertThrows(com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class, () -> fixture.controller.history(
            fixture.request, WORKSPACE_KEY, "WORKSPACE_ACCOUNT", UUID.randomUUID().toString(), Long.MAX_VALUE, 2));
        assertThrows(com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class, () -> fixture.controller.history(
            fixture.request, WORKSPACE_KEY, "WORKSPACE_ACCOUNT", UUID.randomUUID().toString(), Long.MAX_VALUE, 1));
        verifyNoInteractions(fixture.reads);
    }

    private static Fixture fixture() {
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session"))
            .thenReturn(new PlatformSessionReadback(UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE));
        PlatformAuditHistoryTaskReadService reads = mock(PlatformAuditHistoryTaskReadService.class);
        PlatformAuditHistoryController controller = new PlatformAuditHistoryController(new PlatformSessionResolver(authentication), reads);
        EdgeRequestContext request = new EdgeRequestContext("test-fingerprint", "test-correlation",
            PlatformSessionCookie.fromCookie("platform-session"), null, null, null, null);
        return new Fixture(controller, authentication, reads, request);
    }

    private record Fixture(
        PlatformAuditHistoryController controller,
        PlatformAuthenticationService authentication,
        PlatformAuditHistoryTaskReadService reads,
        EdgeRequestContext request
    ) { }
}
