package com.catering.v2s.terminalcontrol.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlAuditReadException;
import com.catering.v2s.terminalcontrol.application.persistence.TerminalRemoteControlAuditReadPersistence;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalRemoteControlAuditReadServiceTest {
    @Test
    void returnsAuditOnlyForVisibleProjectAndSessionTarget() {
        TerminalRemoteControlAuditReadPersistence persistence = mock(TerminalRemoteControlAuditReadPersistence.class);
        TerminalRemoteControlAuditReadService service = new TerminalRemoteControlAuditReadService(persistence);
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "gw");
        UUID projectRef = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        Set<UUID> visibleProjects = Set.of(projectRef);
        when(persistence.read(scope, visibleProjects, projectRef, sessionId, 1, 20))
                .thenReturn(new AuditHistoryResultSetReader.AuthorizedProjection(true, true, List.of(), 2));

        AuditHistoryPage result = service.read(scope, visibleProjects, projectRef, sessionId, 1, 20);

        assertEquals(2, result.total());
        verify(persistence).read(scope, visibleProjects, projectRef, sessionId, 1, 20);
    }

    @Test
    void mapsMissingAndInvisibleSessionSeparatelyAndKeepsTheSharedPageBound() {
        TerminalRemoteControlAuditReadPersistence persistence = mock(TerminalRemoteControlAuditReadPersistence.class);
        TerminalRemoteControlAuditReadService service = new TerminalRemoteControlAuditReadService(persistence);
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "gw");
        UUID projectRef = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        when(persistence.read(scope, Set.of(projectRef), projectRef, sessionId, 1, 20))
                .thenReturn(new AuditHistoryResultSetReader.AuthorizedProjection(false, false, List.of(), 0));
        var missing = assertThrows(TerminalRemoteControlAuditReadException.class,
                () -> service.read(scope, Set.of(projectRef), projectRef, sessionId, 1, 20));
        assertEquals(TerminalRemoteControlAuditReadException.Kind.NOT_FOUND, missing.kind());

        when(persistence.read(scope, Set.of(), projectRef, sessionId, 1, 20))
                .thenReturn(new AuditHistoryResultSetReader.AuthorizedProjection(true, false, List.of(), 0));
        var denied = assertThrows(TerminalRemoteControlAuditReadException.class,
                () -> service.read(scope, Set.of(), projectRef, sessionId, 1, 20));
        assertEquals(TerminalRemoteControlAuditReadException.Kind.NOT_AUTHORIZED, denied.kind());

        assertThrows(IllegalArgumentException.class,
                () -> service.read(scope, Set.of(projectRef), projectRef, sessionId, 1, 101));
    }
}
