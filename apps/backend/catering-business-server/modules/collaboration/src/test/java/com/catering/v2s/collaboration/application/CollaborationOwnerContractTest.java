package com.catering.v2s.collaboration.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowMapper;

class CollaborationOwnerContractTest {
    @Test
    void bindingReadbackDoesNotExposeOpaqueAuthorizationOrCredentialFields() {
        assertFalse(hasRecordComponent("authorizationRef"));
        assertFalse(hasRecordComponent("token"));
        assertFalse(hasRecordComponent("rawPayload"));
    }

    @Test
    void operationsCommandContextMustMatchTheServerResolvedGrantVersion() {
        UUID workspace = UUID.randomUUID();
        OperationsOwnerScopeGrant current = new OperationsOwnerScopeGrant(
                workspace,
                "workspace-key",
                "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE",
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                "PROJECT",
                UUID.randomUUID(),
                "PROJECT",
                UUID.randomUUID(),
                List.of(),
                42L);
        OperationsOwnerScopeGrant legacy = new OperationsOwnerScopeGrant(
                workspace,
                "workspace-key",
                "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE",
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                "PROJECT",
                current.targetId(),
                "PROJECT",
                UUID.randomUUID(),
                List.of());

        assertTrue(current.matchesExpectedContextVersion(42L));
        assertFalse(current.matchesExpectedContextVersion(41L));
        assertFalse(legacy.matchesExpectedContextVersion(42L));
    }

    @Test
    void operationsOwnerRejectsStaleContextBeforeReceiptReplayOrWrite() {
        UUID workspace = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        CollaborationCatalogSource source = mock(CollaborationCatalogSource.class);
        CollaborationCommandReceiptService receipts = mock(CollaborationCommandReceiptService.class);
        when(source.providerProfile("TEST_PROVIDER"))
                .thenReturn(new CollaborationCatalogSource.ProviderProfileDefinition(
                        "TEST_PROVIDER",
                        "Test provider",
                        "TEST_SYSTEM",
                        List.of("TAKEAWAY"),
                        List.of("TAKEAWAY"),
                        List.of("PROJECT"),
                        List.of("PROJECT"),
                        "EXTERNAL_GRANT",
                        "External grant",
                        "LOCAL_ONLY",
                        "Local only",
                        "AVAILABLE",
                        "Available"));
        CollaborationOwnerService service = new CollaborationOwnerService(
                mock(JdbcTemplate.class),
                mock(TimeProvider.class),
                source,
                mock(PlatformGovernanceAuthorization.class),
                receipts);
        OperationsOwnerScopeGrant grant = new OperationsOwnerScopeGrant(
                workspace,
                "workspace-key",
                "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE",
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                "PROJECT",
                target,
                "PROJECT",
                UUID.randomUUID(),
                List.of(),
                7L);
        CollaborationCommandApi.CreateOperationsBindingCommand command =
                new CollaborationCommandApi.CreateOperationsBindingCommand(
                        workspace,
                        "workspace-key",
                        "TEST_PROVIDER",
                        "TAKEAWAY",
                        "PROJECT",
                        target.toString(),
                        null,
                        null,
                        6L,
                        "context-stale-00001",
                        AuditActor.system(),
                        grant);

        CollaborationCommandApi.Problem problem =
                assertThrows(CollaborationCommandApi.Problem.class, () -> service.createOperationsBinding(command));
        assertEquals("AUTHORIZATION_REQUIRED", problem.code());
        verifyNoInteractions(receipts);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void providerBindingPageFiltersAndPaginatesInSqlWithACompleteTotal() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    rows.add(mapper.mapRow(bindingRow(UUID.randomUUID(), 11L), 0));
                    rows.add(mapper.mapRow(bindingRow(UUID.randomUUID(), 11L), 1));
                    return rows;
                });
        CollaborationOwnerService service = new CollaborationOwnerService(
                jdbc,
                mock(TimeProvider.class),
                mock(CollaborationCatalogSource.class),
                mock(PlatformGovernanceAuthorization.class),
                mock(CollaborationCommandReceiptService.class));
        UUID workspace = UUID.randomUUID();

        CollaborationReadback.OwnerBindingPage page = service.pageBindings(
                workspace, "workspace-key", "TEST_PROVIDER", "needle", null, "BINDING_NAME", "DESC", 2, 5);

        assertEquals(2, page.items().size());
        assertEquals("needle", page.metadata().bindingName());
        assertNull(page.metadata().nodeQueryText());
        assertEquals("BINDING_NAME", page.metadata().sortKey());
        assertEquals("DESC", page.metadata().sortDirection());
        assertEquals(2, page.metadata().page());
        assertEquals(5, page.metadata().pageSize());
        assertEquals(11L, page.metadata().total());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> setter = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc).query(sql.capture(), setter.capture(), any(RowMapper.class));
        assertTrue(sql.getValue().contains("workspace_uuid=? AND group_workspace_key=? AND provider_code=?"));
        assertTrue(sql.getValue().contains("COUNT(*) OVER() AS total"));
        assertTrue(sql.getValue().contains("binding_display_name"));
        assertTrue(sql.getValue().contains("node_ref"));
        assertTrue(sql.getValue().contains("owner_node_display"));
        assertTrue(sql.getValue().contains("WITH RECURSIVE"));
        assertTrue(sql.getValue().contains("node_paths"));
        assertTrue(sql.getValue().contains("organization.organization_node"));
        assertTrue(sql.getValue().contains("node_display_name"));
        assertTrue(sql.getValue().contains("node_display_path"));
        assertTrue(sql.getValue().contains("string_agg"));
        assertTrue(sql.getValue().contains("LIMIT ? OFFSET ?"));
        assertFalse(sql.getValue().contains("binding_ref > ?"));

        PreparedStatement statement = mock(PreparedStatement.class);
        setter.getValue().setValues(statement);
        verify(statement).setObject(4, workspace);
        verify(statement).setString(5, "workspace-key");
        verify(statement).setObject(6, workspace);
        verify(statement).setString(7, "workspace-key");
        verify(statement).setObject(8, workspace);
        verify(statement).setString(9, "workspace-key");
        verify(statement).setObject(10, workspace);
        verify(statement).setString(11, "workspace-key");
        verify(statement).setString(12, "workspace-key");
        verify(statement).setObject(13, workspace);
        verify(statement).setString(14, "workspace-key");
        verify(statement).setObject(15, workspace);
        verify(statement).setString(16, "workspace-key");
        verify(statement).setString(17, "%needle%");
        verify(statement).setString(18, "%needle%");
        verify(statement).setString(19, "%needle%");
        verify(statement).setString(20, "%needle%");
        verify(statement).setInt(21, 5);
        verify(statement).setLong(22, 5L);
    }

    private static ResultSet bindingRow(UUID bindingRef, long total) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("binding_ref", UUID.class)).thenReturn(bindingRef);
        when(row.getString("provider_code")).thenReturn("TEST_PROVIDER");
        when(row.getString("capability_class")).thenReturn("TAKEAWAY");
        when(row.getString("node_type")).thenReturn("STORE");
        when(row.getString("node_ref")).thenReturn(UUID.randomUUID().toString());
        when(row.getString("binding_display_name")).thenReturn("Binding");
        when(row.getString("external_owner_id")).thenReturn("external-owner");
        when(row.getString("status")).thenReturn("EFFECTIVE");
        when(row.getLong("version")).thenReturn(1L);
        when(row.getLong("created_at_epoch_millis")).thenReturn(1_785_000_000_000L);
        when(row.getLong("status_changed_at_epoch_millis")).thenReturn(1_785_000_000_001L);
        when(row.getLong("total")).thenReturn(total);
        return row;
    }

    private static boolean hasRecordComponent(String name) {
        return java.util.Arrays.stream(CollaborationReadback.OwnerBinding.class.getRecordComponents())
                .anyMatch(component -> component.getName().equals(name));
    }
}
