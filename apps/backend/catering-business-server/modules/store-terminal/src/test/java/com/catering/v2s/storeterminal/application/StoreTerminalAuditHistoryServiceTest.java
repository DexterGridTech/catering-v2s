package com.catering.v2s.storeterminal.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.storeterminal.persistence.StoreTerminalAuditHistoryPersistence;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StoreTerminalAuditHistoryServiceTest {
    @Test
    void routesOnlyStoreTerminalTargetsToOwnerPersistence() {
        StoreTerminalAuditHistoryPersistence persistence = mock(StoreTerminalAuditHistoryPersistence.class);
        StoreTerminalAuditHistoryService service = new StoreTerminalAuditHistoryService(persistence);
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "group");
        VisibleOrganizationFacts visible = mock(VisibleOrganizationFacts.class);
        when(visible.candidates()).thenReturn(List.of());
        AuditTarget target = new AuditTarget("STORE_TERMINAL", UUID.randomUUID().toString());
        AuditHistoryPage expected = new AuditHistoryPage(List.of(), 1, 20, 0);
        when(persistence.readOperationsAuditProjection(
                        scope, visible, target, UUID.fromString(target.entityRef()), 1, 20))
                .thenReturn(expected);

        assertEquals(expected, service.readOperationsAuditProjection(scope, visible, target, 1, 20));
    }

    @Test
    void rejectsWrongEntityAndUnsupportedPageBeforeReading() {
        StoreTerminalAuditHistoryService service =
                new StoreTerminalAuditHistoryService(mock(StoreTerminalAuditHistoryPersistence.class));
        AuditReadScope scope = new AuditReadScope(UUID.randomUUID(), "group");
        VisibleOrganizationFacts visible = mock(VisibleOrganizationFacts.class);
        assertThrows(
                IllegalArgumentException.class,
                () -> service.readOperationsAuditProjection(
                        scope,
                        visible,
                        new AuditTarget("STORE", UUID.randomUUID().toString()),
                        1,
                        20));
        assertThrows(
                IllegalArgumentException.class,
                () -> service.readOperationsAuditProjection(
                        scope, visible, new AuditTarget("STORE_TERMINAL", "not-a-uuid"), 1, 20));
        assertThrows(
                IllegalArgumentException.class,
                () -> service.readOperationsAuditProjection(
                        scope,
                        visible,
                        new AuditTarget("STORE_TERMINAL", UUID.randomUUID().toString()),
                        1,
                        101));
    }
}
