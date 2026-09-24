package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class StoreTerminalAreaReadTest {
    private static final UUID WORKSPACE = UUID.fromString("10000000-0000-4000-8000-000000000001");
    private static final String GROUP = "group-a";
    private static final UUID STORE = UUID.fromString("20000000-0000-4000-8000-000000000001");

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void readsRequestedAreaReferencesInRequestOrderIncludingVoidedAndChangedTypes() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID voidedArea = UUID.fromString("30000000-0000-4000-8000-000000000003");
        UUID enabledArea = UUID.fromString("30000000-0000-4000-8000-000000000001");
        UUID absentArea = UUID.fromString("30000000-0000-4000-8000-000000000009");
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(1L);
        stubAreaRows(
                jdbc,
                List.of(
                        new AreaRow(enabledArea, "大厅", "TABLE-01", "TABLE_AREA", "ENABLED", 10),
                        new AreaRow(voidedArea, "旧扫码区", "SCAN-01", "SCAN_AREA", "VOIDED", 20)));

        List<StoreServicePointOwnerApi.AreaReference> result = service(jdbc).readAreasByRefs(
                WORKSPACE, GROUP, STORE, List.of(voidedArea, enabledArea, absentArea, voidedArea));

        assertEquals(List.of(voidedArea, enabledArea), result.stream().map(StoreServicePointOwnerApi.AreaReference::areaRef).toList());
        assertEquals("VOIDED", result.getFirst().status());
        assertEquals("SCAN_AREA", result.getFirst().areaType());
        assertEquals("ENABLED", result.getLast().status());
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void filtersAreaCandidatesBeforeCursorPagingAndBindsCursorToSearchQuery() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(1L, 25L, 1L, 25L, 1L);
        List<AreaRow> firstQueryRows = areaRows(1, 22);
        List<AreaRow> secondQueryRows = areaRows(21, 26);
        AtomicInteger queryIndex = new AtomicInteger();
        List<String> sql = new ArrayList<>();
        List<Object[]> arguments = new ArrayList<>();
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            sql.add(invocation.getArgument(0));
            Object[] invocationArguments = invocation.getArguments();
            Object[] queryArguments = invocationArguments.length == 3 && invocationArguments[2] instanceof Object[] values
                    ? values
                    : Arrays.copyOfRange(invocationArguments, 2, invocationArguments.length);
            arguments.add(queryArguments);
            RowMapper mapper = invocation.getArgument(1);
            List<AreaRow> rows = queryIndex.getAndIncrement() == 0 ? firstQueryRows : secondQueryRows;
            return rows.stream().map(row -> mapAreaRow(mapper, row)).toList();
        });

        StoreServicePointOwnerApi owner = service(jdbc);
        StoreServicePointOwnerApi.AreaCandidatePage firstPage = owner.searchTerminalAreaCandidates(
                WORKSPACE, GROUP, STORE, " tea!%_ ", null, 20);
        StoreServicePointOwnerApi.AreaCandidatePage secondPage = owner.searchTerminalAreaCandidates(
                WORKSPACE, GROUP, STORE, "tea!%_", firstPage.nextCursor(), 20);

        assertEquals(25L, firstPage.total());
        assertEquals(20, firstPage.items().size());
        assertNotNull(firstPage.nextCursor());
        assertEquals(25L, secondPage.total());
        assertEquals(5, secondPage.items().size());
        assertNull(secondPage.nextCursor());
        assertEquals(areaRows(1, 21).get(19).areaRef(), firstPage.items().getLast().areaRef());
        assertEquals(areaRows(21, 26).getFirst().areaRef(), secondPage.items().getFirst().areaRef());
        assertTrue(sql.getFirst().contains("area_type='TABLE_AREA'"));
        assertTrue(sql.getFirst().contains("status='ENABLED'"));
        assertTrue(sql.getFirst().contains("name ILIKE ? ESCAPE '!' OR code ILIKE ? ESCAPE '!'"));
        assertTrue(sql.getFirst().contains("ORDER BY display_order, area_ref LIMIT ?"));
        assertTrue(sql.getLast().contains("display_order > ? OR (display_order = ? AND area_ref > ?)"));
        assertTrue(Arrays.asList(arguments.getFirst()).contains("%tea!!!%!_%"));
        assertTrue(Arrays.asList(arguments.getLast()).contains(firstPage.items().getLast().areaRef()));

        assertThrows(
                BusinessEntityService.OrganizationValidationException.class,
                () -> owner.searchTerminalAreaCandidates(WORKSPACE, GROUP, STORE, "different", firstPage.nextCursor(), 20));
        assertEquals(2, sql.size());
    }

    @Test
    void emptyReferenceReadStillValidatesStoreButDoesNotQueryAreas() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(1L);

        assertTrue(service(jdbc).readAreasByRefs(WORKSPACE, GROUP, STORE, List.of()).isEmpty());

        verify(jdbc).queryForObject(anyString(), eq(Long.class), any(Object[].class));
        verify(jdbc, org.mockito.Mockito.never()).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    private static StoreServicePointService service(JdbcTemplate jdbc) {
        return new StoreServicePointService(jdbc, null, null, null, null, null);
    }

    private static List<AreaRow> areaRows(int firstInclusive, int lastExclusive) {
        List<AreaRow> rows = new ArrayList<>();
        for (int index = firstInclusive; index < lastExclusive; index++) {
            rows.add(new AreaRow(
                    UUID.fromString("30000000-0000-4000-8000-%012d".formatted(index)),
                    "桌台区 " + index,
                    "AREA-%02d".formatted(index),
                    "TABLE_AREA",
                    "ENABLED",
                    index));
        }
        return rows;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void stubAreaRows(JdbcTemplate jdbc, List<AreaRow> rows) {
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1);
            return rows.stream().map(row -> mapAreaRow(mapper, row)).toList();
        });
    }

    private static Object mapAreaRow(RowMapper<?> mapper, AreaRow row) {
        try {
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getObject("area_ref", UUID.class)).thenReturn(row.areaRef());
            when(resultSet.getObject("store_ref", UUID.class)).thenReturn(STORE);
            when(resultSet.getString("name")).thenReturn(row.name());
            when(resultSet.getString("code")).thenReturn(row.code());
            when(resultSet.getString("area_type")).thenReturn(row.areaType());
            when(resultSet.getString("status")).thenReturn(row.status());
            when(resultSet.getLong("display_order")).thenReturn(row.displayOrder());
            return mapper.mapRow(resultSet, 0);
        } catch (Exception failure) {
            throw new AssertionError(failure);
        }
    }

    private record AreaRow(UUID areaRef, String name, String code, String areaType, String status, long displayOrder) {}
}
