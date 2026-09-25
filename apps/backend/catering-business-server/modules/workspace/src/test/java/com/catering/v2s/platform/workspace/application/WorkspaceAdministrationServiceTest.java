package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.asset.api.WorkspaceLogoAssetCommand;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceAdministrationPersistence;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class WorkspaceAdministrationServiceTest {
    @Test
    void updateDisplayUsesReturningReadbackAndCarriesLegacyIdIntoAudit() {
        WorkspaceAdministrationPersistence persistence = mock(WorkspaceAdministrationPersistence.class);
        TimeProvider time = mock(TimeProvider.class);
        WorkspaceLogoAssetCommand assets = mock(WorkspaceLogoAssetCommand.class);
        WorkspaceCommandReceiptService receipts = mock(WorkspaceCommandReceiptService.class);
        WorkspaceIamSummaryLookup workspaceIam = mock(WorkspaceIamSummaryLookup.class);
        UUID workspaceUuid = UUID.randomUUID();
        UUID previousLogo = UUID.randomUUID();
        UUID nextLogo = UUID.randomUUID();
        String key = "workspace-key";
        String idempotencyKey = "idempotency-key-1234";
        WorkspaceAdministrationReadback current =
                readback(workspaceUuid, key, "Old Name", "Old Title", previousLogo, "old notes", 4);
        WorkspaceAdministrationReadback updated =
                readback(workspaceUuid, key, "New Name", "New Title", nextLogo, "new notes", 5);

        when(time.currentEpochMillis()).thenReturn(101L, 202L);
        when(receipts.execute(anyString(), anyString(), anyString(), any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(3)).get());
        when(persistence.findByKey(key)).thenReturn(Optional.of(current));
        when(persistence.updateDisplay(
                        eq("New Name"),
                        eq("new name"),
                        eq("New Title"),
                        eq("new notes"),
                        eq(nextLogo.toString()),
                        eq(101L),
                        eq(key),
                        eq(4L)))
                .thenReturn(Optional.of(new WorkspaceAdministrationPersistence.UpdateResult(41L, updated)));

        WorkspaceAdministrationReadback actual = new WorkspaceAdministrationService(
                        persistence, time, assets, receipts, workspaceIam)
                .updateDisplay(
                        key,
                        "New Name",
                        "New Title",
                        "new notes",
                        "REPLACE",
                        nextLogo,
                        "asset-bind-grant-012345678901234567890123456789",
                        4,
                        idempotencyKey,
                        AuditActor.system());

        assertEquals(updated, actual);
        verify(assets).claim(nextLogo, workspaceUuid, key, "asset-bind-grant-012345678901234567890123456789");
        verify(assets).release(previousLogo, workspaceUuid);
        verify(persistence)
                .updateDisplay("New Name", "new name", "New Title", "new notes", nextLogo.toString(), 101L, key, 4L);
        verify(persistence)
                .insertAudit(
                        any(UUID.class),
                        eq(updated),
                        eq(41L),
                        eq("GROUP_WORKSPACE_UPDATED"),
                        any(AuditActor.class),
                        anyLong(),
                        contains("fieldKey"));
        assertTrue(updated.version() > current.version());
    }

    @Test
    void transitionStatusRejectsUnknownStatusBeforeAnyDatabaseWrite() {
        WorkspaceAdministrationPersistence persistence = mock(WorkspaceAdministrationPersistence.class);
        TimeProvider time = mock(TimeProvider.class);
        WorkspaceCommandReceiptService receipts = mock(WorkspaceCommandReceiptService.class);
        WorkspaceAdministrationService service =
                new WorkspaceAdministrationService(persistence, time, null, receipts, null);
        when(receipts.execute(anyString(), anyString(), anyString(), any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(3)).get());

        assertThrows(
                WorkspaceAdministrationService.WorkspaceStatusInvalidException.class,
                () -> service.transitionStatus(
                        "workspace-key", "ARCHIVED", 4, "idempotency-key-1234", AuditActor.system()));

        verifyNoInteractions(persistence, time);
    }

    @Test
    void transitionStatusUsesCasThenAuthoritativeReadbackAndAudit() {
        WorkspaceAdministrationPersistence persistence = mock(WorkspaceAdministrationPersistence.class);
        TimeProvider time = mock(TimeProvider.class);
        WorkspaceCommandReceiptService receipts = mock(WorkspaceCommandReceiptService.class);
        WorkspaceAdministrationReadback updated =
                readback(UUID.randomUUID(), "workspace-key", "Name", "Title", UUID.randomUUID(), "notes", 5);
        when(time.currentEpochMillis()).thenReturn(900L);
        when(receipts.execute(anyString(), anyString(), anyString(), any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(3)).get());
        when(persistence.transitionStatus("DISABLED", 900L, "workspace-key", 4L))
                .thenReturn(1);
        when(persistence.findByKey("workspace-key")).thenReturn(Optional.of(updated));
        when(persistence.findLegacyId(updated.workspaceUuid(), updated.groupWorkspaceKey()))
                .thenReturn(41L);

        WorkspaceAdministrationReadback actual = new WorkspaceAdministrationService(
                        persistence, time, null, receipts, null)
                .transitionStatus("workspace-key", "DISABLED", 4, "idempotency-key-1234", AuditActor.system());

        assertEquals(updated, actual);
        verify(persistence).transitionStatus("DISABLED", 900L, "workspace-key", 4L);
        verify(persistence).findByKey("workspace-key");
        verify(persistence).findLegacyId(updated.workspaceUuid(), updated.groupWorkspaceKey());
        verify(persistence)
                .insertAudit(
                        any(UUID.class),
                        eq(updated),
                        eq(41L),
                        eq("GROUP_WORKSPACE_STATUS_CHANGED"),
                        any(AuditActor.class),
                        eq(900L),
                        contains("status"));
    }

    private static WorkspaceAdministrationReadback readback(
            UUID workspaceUuid, String key, String name, String title, UUID logo, String notes, long version) {
        return new WorkspaceAdministrationReadback(
                workspaceUuid, key, name, title, logo.toString(), notes, "ENABLED", 10, version, 1, 20, false);
    }
}
