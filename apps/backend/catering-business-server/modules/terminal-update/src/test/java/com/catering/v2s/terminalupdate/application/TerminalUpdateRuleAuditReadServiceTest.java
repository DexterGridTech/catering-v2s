package com.catering.v2s.terminalupdate.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleAuditReadException;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRuleAuditReadPersistence;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalUpdateRuleAuditReadServiceTest {
    @Test
    void returnsOwnerPageOnlyForTheVisibleProjectTarget() {
        TerminalUpdateRuleAuditReadPersistence persistence = mock(TerminalUpdateRuleAuditReadPersistence.class);
        TerminalUpdateRuleAuditReadService service = new TerminalUpdateRuleAuditReadService(persistence);
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "gw");
        UUID projectRef = UUID.randomUUID();
        UUID ruleRef = UUID.randomUUID();
        Set<UUID> visibleProjects = Set.of(projectRef);
        var projection = new AuditHistoryResultSetReader.AuthorizedProjection(true, true, List.of(), 0);
        when(persistence.read(scope, visibleProjects, projectRef, ruleRef, 1, 20)).thenReturn(projection);

        AuditHistoryPage result = service.read(scope, visibleProjects, projectRef, ruleRef, 1, 20);

        assertEquals(0, result.total());
        verify(persistence).read(scope, visibleProjects, projectRef, ruleRef, 1, 20);
    }

    @Test
    void rejectsOwnerPageAboveTheSharedAuditBound() {
        TerminalUpdateRuleAuditReadService service = new TerminalUpdateRuleAuditReadService(
                mock(TerminalUpdateRuleAuditReadPersistence.class));
        assertThrows(IllegalArgumentException.class, () -> service.read(
                new AuditReadScope(UUID.randomUUID(), "gw"), Set.of(UUID.randomUUID()),
                UUID.randomUUID(), UUID.randomUUID(), 1, 101));
    }

    @Test
    void hidesUnknownRuleAndRejectsProjectOutsideVisibleFacts() {
        TerminalUpdateRuleAuditReadPersistence persistence = mock(TerminalUpdateRuleAuditReadPersistence.class);
        TerminalUpdateRuleAuditReadService service = new TerminalUpdateRuleAuditReadService(persistence);
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "gw");
        UUID projectRef = UUID.randomUUID();
        UUID ruleRef = UUID.randomUUID();
        Set<UUID> visibleProjects = Set.of(projectRef);
        when(persistence.read(scope, visibleProjects, projectRef, ruleRef, 1, 20))
                .thenReturn(new AuditHistoryResultSetReader.AuthorizedProjection(false, false, List.of(), 0));
        TerminalUpdateRuleAuditReadException notFound = assertThrows(TerminalUpdateRuleAuditReadException.class,
                () -> service.read(scope, visibleProjects, projectRef, ruleRef, 1, 20));
        assertEquals(TerminalUpdateRuleAuditReadException.Kind.NOT_FOUND, notFound.kind());

        when(persistence.read(scope, Set.of(), projectRef, ruleRef, 1, 20))
                .thenReturn(new AuditHistoryResultSetReader.AuthorizedProjection(true, false, List.of(), 0));
        TerminalUpdateRuleAuditReadException denied = assertThrows(TerminalUpdateRuleAuditReadException.class,
                () -> service.read(scope, Set.of(), projectRef, ruleRef, 1, 20));
        assertEquals(TerminalUpdateRuleAuditReadException.Kind.NOT_AUTHORIZED, denied.kind());
    }
}
