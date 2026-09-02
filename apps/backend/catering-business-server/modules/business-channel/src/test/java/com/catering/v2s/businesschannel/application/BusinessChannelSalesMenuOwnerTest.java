package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowMapper;

class BusinessChannelSalesMenuOwnerTest {
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final String GROUP = "sales-menu-group";
    private static final String STORE = UUID.randomUUID().toString();

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void eligibleChannelsUseAStoreBoundOpaqueKeysetWithoutAHiddenTotal() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceStatusLookup workspaceStatuses = mock(WorkspaceStatusLookup.class);
        when(workspaceStatuses.requireStatus(WORKSPACE, GROUP)).thenReturn("ENABLED");
        UUID firstRef = UUID.randomUUID();
        UUID secondRef = UUID.randomUUID();
        UUID thirdRef = UUID.randomUUID();
        ResultSet first = eligibleRow(firstRef, "Alpha", "DINE_IN", "ENABLED");
        ResultSet second = eligibleRow(secondRef, "Bravo", "TAKEAWAY", "DISABLED");
        ResultSet third = eligibleRow(thirdRef, "Charlie", "DINE_IN", "ENABLED");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(first, 0), mapper.mapRow(second, 1), mapper.mapRow(third, 2));
                });

        BusinessChannelOwnerService service = readService(jdbc, workspaceStatuses);
        BusinessChannelOwnerApi.SalesMenuEligibleChannelPage firstPage =
                service.listSalesMenuEligibleChannels(WORKSPACE, GROUP, STORE, null, 2, "CHANNEL_NAME", "ASC");

        assertNull(firstPage.cursor());
        assertEquals(
                List.of(firstRef, secondRef),
                firstPage.items().stream()
                        .map(BusinessChannelOwnerApi.SalesMenuEligibleChannel::channelRef)
                        .toList());
        assertEquals("INTERNAL", firstPage.items().get(0).accessKind());
        assertEquals("STORE", firstPage.items().get(0).operatorKind());
        assertEquals("DINE_IN", firstPage.items().get(0).orderKind());
        assertEquals("DISABLED", firstPage.items().get(1).status());
        assertNotNull(firstPage.nextCursor());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> setters = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc, times(1)).query(sql.capture(), setters.capture(), any(RowMapper.class));
        assertTrue(sql.getValue().contains("c.target_node_type='STORE'"));
        assertTrue(sql.getValue().contains("c.target_node_ref=?"));
        assertTrue(sql.getValue().contains("t.access_kind='INTERNAL'"));
        assertTrue(sql.getValue().contains("t.operator_kind='STORE'"));
        assertTrue(sql.getValue().contains("t.order_kind IN ('DINE_IN','TAKEAWAY')"));
        assertTrue(sql.getValue().contains("target_store.id IS NOT NULL"));
        assertTrue(sql.getValue().contains("LIMIT ?"));
        assertTrue(!sql.getValue().contains("COUNT("));
        assertTrue(!sql.getValue().contains("OFFSET"));

        BusinessChannelOwnerApi.SalesMenuEligibleChannelPage secondPage = service.listSalesMenuEligibleChannels(
                WORKSPACE, GROUP, STORE, firstPage.nextCursor(), 2, "CHANNEL_NAME", "ASC");
        assertEquals(firstPage.nextCursor(), secondPage.cursor());

        ArgumentCaptor<String> pageSql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> pageSetters = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc, times(2)).query(pageSql.capture(), pageSetters.capture(), any(RowMapper.class));
        String secondSql = pageSql.getAllValues().get(1);
        assertTrue(secondSql.contains("COALESCE(c.channel_name, '') > ?"));
        assertTrue(secondSql.contains("c.channel_ref > ?"));
        PreparedStatement statement = mock(PreparedStatement.class);
        pageSetters.getAllValues().get(1).setValues(statement);
        verify(statement).setObject(4, "Bravo");
        verify(statement).setObject(5, "Bravo");
        verify(statement).setObject(6, secondRef);
        verify(statement).setObject(7, 3);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void cursorIsBoundToTheCompleteStoreAndSortIdentity() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceStatusLookup workspaceStatuses = mock(WorkspaceStatusLookup.class);
        when(workspaceStatuses.requireStatus(WORKSPACE, GROUP)).thenReturn("ENABLED");
        ResultSet row = eligibleRow(UUID.randomUUID(), "Alpha", "DINE_IN", "ENABLED");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(
                            mapper.mapRow(row, 0),
                            mapper.mapRow(eligibleRow(UUID.randomUUID(), "Bravo", "DINE_IN", "ENABLED"), 1));
                });
        BusinessChannelOwnerService service = readService(jdbc, workspaceStatuses);
        String cursor = service.listSalesMenuEligibleChannels(WORKSPACE, GROUP, STORE, null, 1, "CHANNEL_NAME", "ASC")
                .nextCursor();

        BusinessChannelCommandApi.Problem problem = assertThrows(
                BusinessChannelCommandApi.Problem.class,
                () -> service.listSalesMenuEligibleChannels(
                        WORKSPACE, GROUP, UUID.randomUUID().toString(), cursor, 1, "CHANNEL_NAME", "ASC"));
        assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void requireSalesMenuChannelReturnsExactFactsAndRejectsIneligibleRowsAsTypedProblem() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID channelRef = UUID.randomUUID();
        ResultSet row = eligibleRow(channelRef, "Counter", "TAKEAWAY", "DISABLED");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(row, 0));
                });
        BusinessChannelOwnerService service = readService(jdbc, mock(WorkspaceStatusLookup.class));

        BusinessChannelOwnerApi.SalesMenuChannelJudgment judgment =
                service.requireSalesMenuChannel(WORKSPACE, GROUP, STORE, channelRef);
        assertEquals(channelRef, judgment.channelRef());
        assertEquals(STORE, judgment.storeRef());
        assertEquals("INTERNAL", judgment.accessKind());
        assertEquals("STORE", judgment.operatorKind());
        assertEquals("TAKEAWAY", judgment.orderKind());
        assertEquals("DISABLED", judgment.status());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(PreparedStatementSetter.class), any(RowMapper.class));
        assertTrue(sql.getValue().contains("c.channel_ref=?"));
        assertTrue(sql.getValue().contains("c.target_node_type='STORE'"));
        assertTrue(sql.getValue().contains("c.target_node_ref=?"));
        assertTrue(sql.getValue().contains("t.access_kind='INTERNAL'"));
        assertTrue(sql.getValue().contains("t.order_kind IN ('DINE_IN','TAKEAWAY')"));

        JdbcTemplate emptyJdbc = mock(JdbcTemplate.class);
        when(emptyJdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenReturn(List.of());
        BusinessChannelCommandApi.Problem problem = assertThrows(
                BusinessChannelCommandApi.Problem.class, () -> readService(emptyJdbc, mock(WorkspaceStatusLookup.class))
                        .requireSalesMenuChannel(WORKSPACE, GROUP, STORE, UUID.randomUUID()));
        assertEquals("SALES_MENU_CHANNEL_INELIGIBLE", problem.code());
        assertEquals("当前只处理门店内部堂食/外带入口", problem.getMessage());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void channelTargetReadCanProveStoreOwnershipWithoutApplyingSalesMenuEligibility() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID channelRef = UUID.randomUUID();
        ResultSet row = eligibleRow(channelRef, "External counter", "TAKEAWAY", "ENABLED");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(row, 0));
                });

        assertTrue(readService(jdbc, mock(WorkspaceStatusLookup.class))
                .salesMenuChannelBelongsToStore(WORKSPACE, GROUP, STORE, channelRef));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(PreparedStatementSetter.class), any(RowMapper.class));
        assertTrue(sql.getValue().contains("c.channel_ref=?"));
        assertTrue(sql.getValue().contains("c.target_node_type='STORE'"));
        assertTrue(sql.getValue().contains("c.target_node_ref=?"));
        assertTrue(sql.getValue().contains("target_store.id IS NOT NULL"));
        assertTrue(!sql.getValue().contains("t.access_kind='INTERNAL'"));
        assertTrue(!sql.getValue().contains("t.order_kind IN ('DINE_IN','TAKEAWAY')"));
    }

    private static BusinessChannelOwnerService readService(JdbcTemplate jdbc, WorkspaceStatusLookup workspaceStatuses) {
        return new BusinessChannelOwnerService(
                jdbc,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CollaborationCatalogReadApi.class),
                mock(CollaborationBindingReadApi.class),
                workspaceStatuses,
                mock(BusinessChannelCommandReceiptService.class));
    }

    private static ResultSet eligibleRow(UUID channelRef, String channelName, String orderKind, String status)
            throws Exception {
        ResultSet row = mock(ResultSet.class);
        UUID templateRef = UUID.randomUUID();
        when(row.next()).thenReturn(true);
        when(row.getObject("workspace_uuid", UUID.class)).thenReturn(WORKSPACE);
        when(row.getString("group_workspace_key")).thenReturn(GROUP);
        when(row.getObject("channel_ref", UUID.class)).thenReturn(channelRef);
        when(row.getObject("template_ref", UUID.class)).thenReturn(templateRef);
        when(row.getString("target_node_type")).thenReturn("STORE");
        when(row.getString("target_node_ref")).thenReturn(STORE);
        when(row.getString("channel_code")).thenReturn("CHANNEL-" + channelName.toUpperCase());
        when(row.getString("channel_name")).thenReturn(channelName);
        when(row.getObject("binding_ref", UUID.class)).thenReturn(null);
        when(row.getString("template_access_kind")).thenReturn("INTERNAL");
        when(row.getString("status")).thenReturn(status);
        when(row.getLong("version")).thenReturn(3L);
        when(row.getString("template_name")).thenReturn("Store template");
        when(row.getString("template_operator_kind")).thenReturn("STORE");
        when(row.getString("template_order_kind")).thenReturn(orderKind);
        when(row.getString("template_status")).thenReturn("ENABLED");
        when(row.getLong("template_version")).thenReturn(2L);
        when(row.getString("target_node_status")).thenReturn("ENABLED");
        when(row.getString("target_store_status")).thenReturn("ENABLED");
        when(row.getString("binding_lifecycle_status")).thenReturn(null);
        return row;
    }
}
