package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.asset.api.WorkspaceLogoAssetCommand;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class WorkspaceAdministrationServiceTest {
    @Test
    void updateDisplayUsesReturningReadbackAndCarriesLegacyIdIntoAudit() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
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
        ResultSet currentRow = row(current);
        ResultSet updatedRow = row(updated);

        when(time.currentEpochMillis()).thenReturn(101L, 202L);
        when(receipts.execute(anyString(), anyString(), anyString(), any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(3)).get());
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    when(currentRow.next()).thenReturn(true);
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    return extractor.extractData(currentRow);
                });
        when(jdbc.query(contains("RETURNING id"), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    when(updatedRow.getLong("id")).thenReturn(41L);
                    RowMapper<?> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(updatedRow, 0));
                });

        WorkspaceAdministrationReadback actual = new WorkspaceAdministrationService(
                        jdbc, time, assets, receipts, workspaceIam)
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
        verify(jdbc).query(contains("RETURNING id"), any(RowMapper.class), any(Object[].class));
        ArgumentCaptor<Object[]> auditArguments = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("INSERT INTO platform_workspace.audit_event"), auditArguments.capture());
        assertEquals("41", auditArguments.getValue()[3]);
        verify(jdbc, never())
                .queryForObject(
                        contains("SELECT id FROM platform_workspace.group_workspace"),
                        eq(Long.class),
                        eq(workspaceUuid),
                        eq(key));
        assertTrue(updated.version() > current.version());
    }

    private static WorkspaceAdministrationReadback readback(
            UUID workspaceUuid, String key, String name, String title, UUID logo, String notes, long version) {
        return new WorkspaceAdministrationReadback(
                workspaceUuid, key, name, title, logo.toString(), notes, "ENABLED", 10, version, 1, 20, false);
    }

    private static ResultSet row(WorkspaceAdministrationReadback value) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("workspace_uuid", UUID.class)).thenReturn(value.workspaceUuid());
        when(row.getString("group_workspace_key")).thenReturn(value.groupWorkspaceKey());
        when(row.getString("name")).thenReturn(value.name());
        when(row.getString("operations_title")).thenReturn(value.operationsTitle());
        when(row.getString("logo_asset_ref")).thenReturn(value.logoAssetRef());
        when(row.getString("notes")).thenReturn(value.notes());
        when(row.getString("status")).thenReturn(value.status());
        when(row.getLong("status_changed_at_epoch_millis")).thenReturn(value.statusChangedAtEpochMillis());
        when(row.getLong("version")).thenReturn(value.version());
        when(row.getLong("created_at_epoch_millis")).thenReturn(value.createdAtEpochMillis());
        when(row.getLong("updated_at_epoch_millis")).thenReturn(value.updatedAtEpochMillis());
        return row;
    }
}
