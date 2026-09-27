package com.catering.v2s.terminalbinding.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader.AuthorizedProjection;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.terminalbinding.api.TerminalBindingAuditReadException;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingAuditReadPersistence;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalBindingAuditReadServiceTest {
    @Test
    void returnsTheBoundedPageOnlyForFoundAuthorizedTarget() {
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "group");
        Set<UUID> visibleStores = Set.of(UUID.randomUUID());
        UUID terminalRef = UUID.randomUUID();
        TerminalBindingAuditReadPersistence persistence = mock(TerminalBindingAuditReadPersistence.class);
        when(persistence.read(scope, visibleStores, terminalRef, 2, 10))
                .thenReturn(new AuthorizedProjection(true, true, List.of(), 13));
        var service = new TerminalBindingAuditReadService(persistence);

        AuditHistoryPage page = service.read(scope, visibleStores, terminalRef, 2, 10);

        assertEquals(new AuditHistoryPage(List.of(), 2, 10, 13), page);
    }

    @Test
    void distinguishesMissingAndOutOfScopeTargets() {
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "group");
        Set<UUID> visibleStores = Set.of(UUID.randomUUID());
        UUID terminalRef = UUID.randomUUID();
        TerminalBindingAuditReadPersistence persistence = mock(TerminalBindingAuditReadPersistence.class);
        var service = new TerminalBindingAuditReadService(persistence);
        when(persistence.read(scope, visibleStores, terminalRef, 1, 20))
                .thenReturn(new AuthorizedProjection(false, false, List.of(), 0));

        TerminalBindingAuditReadException missing = assertThrows(
                TerminalBindingAuditReadException.class, () -> service.read(scope, visibleStores, terminalRef, 1, 20));
        assertEquals(TerminalBindingAuditReadException.Kind.NOT_FOUND, missing.kind());

        when(persistence.read(scope, visibleStores, terminalRef, 1, 20))
                .thenReturn(new AuthorizedProjection(true, false, List.of(), 0));
        TerminalBindingAuditReadException denied = assertThrows(
                TerminalBindingAuditReadException.class, () -> service.read(scope, visibleStores, terminalRef, 1, 20));
        assertEquals(TerminalBindingAuditReadException.Kind.NOT_AUTHORIZED, denied.kind());
    }
}
