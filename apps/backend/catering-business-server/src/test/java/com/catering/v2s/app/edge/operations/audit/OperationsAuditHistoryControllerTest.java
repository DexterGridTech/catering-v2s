package com.catering.v2s.app.edge.operations.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.read.OperationsAuditTaskReadService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Every operations audit host must retain a typed edge dispatch; no entity type may fall through to session recovery.
 */
class OperationsAuditHistoryControllerTest {
    private static final String WORKSPACE_KEY = "operations-audit-test";

    @Test
    void dispatchesEveryContractualAuditEntityThroughTheCurrentWorkspaceSession() {
        Fixture fixture = fixture();
        UUID id = UUID.randomUUID();
        for (String entityType : List.of(
                "WORKSPACE_ACCOUNT",
                "WORKSPACE_INVITATION",
                "COMMERCIAL_GROUP",
                "ORGANIZATION_NODE",
                "BRAND",
                "TENANT",
                "HEAD_COMPANY",
                "STORE",
                "STORE_SERVICE_POINT_AREA",
                "STORE_SERVICE_POINT",
                "STORE_QR_CONFIGURATION",
                "STORE_TERMINAL",
                "TERMINAL_BINDING",
                "STORE_CONTRACT")) {
            assertEquals(
                    0L,
                    fixture.controller
                            .history(fixture.request, WORKSPACE_KEY, entityType, id.toString(), 1, 10)
                            .total());
        }
        verify(fixture.reads, org.mockito.Mockito.times(14))
                .read(org.mockito.ArgumentMatchers.same(fixture.readFacts), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void invalidAuditIdentifierOrPageFailsBeforeReader() {
        Fixture fixture = fixture();
        assertThrows(
                com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class,
                () -> fixture.controller.history(
                        fixture.request, WORKSPACE_KEY, "WORKSPACE_ACCOUNT", "not-a-uuid", 1, 10));
        assertThrows(
                com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class,
                () -> fixture.controller.history(
                        fixture.request,
                        WORKSPACE_KEY,
                        "WORKSPACE_ACCOUNT",
                        UUID.randomUUID().toString(),
                        0,
                        10));
        assertThrows(
                com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class,
                () -> fixture.controller.history(
                        fixture.request,
                        WORKSPACE_KEY,
                        "WORKSPACE_ACCOUNT",
                        UUID.randomUUID().toString(),
                        Long.MAX_VALUE,
                        2));
        assertThrows(
                com.catering.v2s.app.edge.problem.InvalidEdgeRequestException.class,
                () -> fixture.controller.history(
                        fixture.request,
                        WORKSPACE_KEY,
                        "WORKSPACE_ACCOUNT",
                        UUID.randomUUID().toString(),
                        Long.MAX_VALUE,
                        1));
        org.mockito.Mockito.verifyNoInteractions(fixture.reads);
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                WORKSPACE_KEY,
                UUID.randomUUID(),
                assignmentId,
                com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(),
                1L,
                1L,
                Set.of(),
                Set.of(),
                "Operations tester");
        WorkspaceAuthenticationService authentication = mock(WorkspaceAuthenticationService.class);
        when(authentication.session("operations-session")).thenReturn(session);
        var readFacts = mock(com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts.class);
        when(readFacts.sessionReadback()).thenReturn(session);
        when(readFacts.groupWorkspaceKey()).thenReturn(session.groupWorkspaceKey());
        when(authentication.readAuthorizationFacts("operations-session")).thenReturn(readFacts);
        OperationsAuditTaskReadService reads = mock(OperationsAuditTaskReadService.class);
        AuditHistoryPage empty = new AuditHistoryPage(List.of(), 1L, 10L, 0L);
        when(reads.read(org.mockito.ArgumentMatchers.same(readFacts), org.mockito.ArgumentMatchers.any()))
                .thenReturn(empty);
        OperationsAuditHistoryController controller =
                new OperationsAuditHistoryController(new OperationsSessionResolver(authentication), reads);
        EdgeRequestContext request = new EdgeRequestContext(
                "fingerprint",
                "correlation",
                null,
                OperationsSessionCookie.fromCookie("operations-session"),
                null,
                null,
                null);
        return new Fixture(controller, request, session, readFacts, reads);
    }

    private record Fixture(
            OperationsAuditHistoryController controller,
            EdgeRequestContext request,
            WorkspaceSessionReadback session,
            com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts readFacts,
            OperationsAuditTaskReadService reads) {}
}
