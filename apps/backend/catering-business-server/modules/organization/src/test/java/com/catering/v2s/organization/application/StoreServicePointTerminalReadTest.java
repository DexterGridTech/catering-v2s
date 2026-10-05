package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class StoreServicePointTerminalReadTest {
    private static final UUID WORKSPACE = UUID.fromString("10000000-0000-4000-8000-000000000001");
    private static final UUID STORE = UUID.fromString("20000000-0000-4000-8000-000000000001");
    private static final UUID AREA = UUID.fromString("30000000-0000-4000-8000-000000000001");
    private static final UUID POINT = UUID.fromString("40000000-0000-4000-8000-000000000001");

    @Test
    void servicePointCollectionReadsEnabledPointsWithoutParentAreaFiltering() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            assertTrue(sql.contains("AND status='ENABLED'"));
            assertTrue(sql.contains("ORDER BY point_ref"));
            assertFalse(sql.contains("JOIN organization.store_service_point_area"));
            assertFalse(sql.contains("area_status"));
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(pointRow(), 0));
        });

        List<StoreServicePointOwnerApi.TerminalPoint> points =
                service(jdbc).readTerminalPoints(WORKSPACE, "group-a", STORE);

        assertEquals(1, points.size());
        assertEquals(POINT, points.getFirst().pointRef());
        assertEquals("ENABLED", points.getFirst().status());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void exactAreaReadReturnsDisabledOwnFact() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            assertTrue(sql.contains("status <> 'VOIDED'"));
            RowMapper mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(areaRow(), 0));
        });

        StoreServicePointOwnerApi.TerminalArea area = service(jdbc).readTerminalArea(WORKSPACE, "group-a", STORE, AREA);

        assertEquals(AREA, area.areaRef());
        assertEquals("DISABLED", area.status());
        assertEquals(1700000000000L, area.updatedAt());
    }

    private static StoreServicePointService service(JdbcTemplate jdbc) {
        return new StoreServicePointService(jdbc, null, null, null, null, null);
    }

    private static ResultSet areaRow() throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("area_ref", UUID.class)).thenReturn(AREA);
        when(row.getObject("store_ref", UUID.class)).thenReturn(STORE);
        when(row.getString("name")).thenReturn("已停用区域");
        when(row.getString("code")).thenReturn("AREA-1");
        when(row.getString("area_type")).thenReturn("TABLE_AREA");
        when(row.getString("status")).thenReturn("DISABLED");
        when(row.getLong("display_order")).thenReturn(1L);
        when(row.getLong("version")).thenReturn(2L);
        when(row.getLong("created_at_epoch_millis")).thenReturn(1600000000000L);
        when(row.getLong("updated_at_epoch_millis")).thenReturn(1700000000000L);
        return row;
    }

    private static ResultSet pointRow() throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("point_ref", UUID.class)).thenReturn(POINT);
        when(row.getObject("store_ref", UUID.class)).thenReturn(STORE);
        when(row.getObject("area_ref", UUID.class)).thenReturn(AREA);
        when(row.getString("name")).thenReturn("服务点");
        when(row.getString("code")).thenReturn("POINT-1");
        when(row.getString("point_type")).thenReturn("TABLE");
        when(row.getString("status")).thenReturn("ENABLED");
        when(row.getLong("display_order")).thenReturn(1L);
        when(row.getObject("seat_capacity")).thenReturn(null);
        when(row.getString("table_shape")).thenReturn(null);
        when(row.getObject("reservable")).thenReturn(null);
        when(row.getObject("image_asset_ref", UUID.class)).thenReturn(null);
        when(row.getString("extension_values")).thenReturn("{}");
        when(row.getObject("extension_rule_revision")).thenReturn(null);
        when(row.getLong("version")).thenReturn(1L);
        when(row.getLong("created_at_epoch_millis")).thenReturn(1600000000000L);
        when(row.getLong("updated_at_epoch_millis")).thenReturn(1700000000000L);
        return row;
    }
}
