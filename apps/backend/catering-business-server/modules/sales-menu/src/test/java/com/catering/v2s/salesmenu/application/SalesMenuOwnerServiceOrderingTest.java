package com.catering.v2s.salesmenu.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;

class SalesMenuOwnerServiceOrderingTest {
    private static final UUID VERSION = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID CURRENT = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID OTHER = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID SECTION = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final String SECTION_TABLE = "sales_menu.sales_version_section";
    private static final String ITEM_TABLE = "sales_menu.sales_version_item";

    @Test
    void sectionMoveFindsAdjacentSectionAcrossTheWholeVersionEvenWithOrderHoles() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        stubMoveRows(repository, 10L, 2L, 100L, OTHER);
        SalesMenuOwnerService service = service(repository);

        invokeMove(service, SECTION_TABLE, "section_ref", null, SalesMenuMoveDirection.UP);

        List<String> queries = capturedQueries(repository);
        assertEquals(3, queries.size());
        assertTrue(queries.get(1).contains("WHERE version_ref=? AND (display_order < ?"));
        assertFalse(queries.get(1).contains("AND section_ref=? AND (display_order"));
        assertTrue(queries.get(1).contains("ORDER BY display_order DESC,section_ref DESC"));
        assertTrue(queries.get(2).contains("WHERE version_ref=?"));
        assertFalse(queries.get(2).contains("section_ref=?"));

        ArgumentCaptor<String> updates = ArgumentCaptor.forClass(String.class);
        verify(repository, times(3)).update(updates.capture(), any(Object[].class));
        assertEquals(3, updates.getAllValues().size());
    }

    @Test
    void itemMoveKeepsTheAdjacentSearchInsideTheCurrentSection() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        stubMoveRows(repository, 10L, 2L, 100L, OTHER);
        SalesMenuOwnerService service = service(repository);

        invokeMove(service, ITEM_TABLE, "sales_item_ref", SECTION, SalesMenuMoveDirection.UP);

        List<String> queries = capturedQueries(repository);
        assertTrue(queries.get(1).contains("WHERE version_ref=? AND section_ref=? AND (display_order < ?"));
        assertTrue(queries.get(2).contains("WHERE version_ref=? AND section_ref=?"));
    }

    @Test
    void sectionMoveReturnsTypedBoundaryProblemWhenNoWholeVersionNeighborExists() throws Exception {
        SalesMenuRepository repository = mock(SalesMenuRepository.class);
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    if (sql.contains("ORDER BY")) return List.of();
                    ResultSet result = mock(ResultSet.class);
                    when(result.getObject("section_ref", UUID.class)).thenReturn(CURRENT);
                    when(result.getLong("display_order")).thenReturn(0L);
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1, RowMapper.class);
                    return List.of(mapper.mapRow(result, 0));
                });
        SalesMenuOwnerService service = service(repository);

        SalesMenuOwnerApi.Problem problem = assertThrows(
                SalesMenuOwnerApi.Problem.class,
                () -> invokeMove(service, SECTION_TABLE, "section_ref", null, SalesMenuMoveDirection.DOWN));

        assertEquals("MOVE_NOT_ALLOWED", problem.code());
    }

    private static SalesMenuOwnerService service(SalesMenuRepository repository) {
        TimeProvider time = () -> 1_788_000_000_000L;
        return new SalesMenuOwnerService(repository, time, new ObjectMapper());
    }

    private static void stubMoveRows(
            SalesMenuRepository repository, long currentOrder, long adjacentOrder, long maxOrder, UUID adjacentRef) {
        when(repository.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    @SuppressWarnings("unchecked")
                    RowMapper<Object> mapper = invocation.getArgument(1, RowMapper.class);
                    ResultSet result = mock(ResultSet.class);
                    if (sql.contains("ORDER BY")) {
                        when(result.getObject(1, UUID.class)).thenReturn(adjacentRef);
                        when(result.getLong(2)).thenReturn(adjacentOrder);
                    } else if (sql.contains("COALESCE")) {
                        when(result.getLong(1)).thenReturn(maxOrder);
                    } else {
                        when(result.getObject("section_ref", UUID.class)).thenReturn(CURRENT);
                        when(result.getLong("display_order")).thenReturn(currentOrder);
                    }
                    return List.of(mapper.mapRow(result, 0));
                });
        when(repository.update(anyString(), any(Object[].class))).thenReturn(1);
    }

    private static List<String> capturedQueries(SalesMenuRepository repository) {
        ArgumentCaptor<String> queries = ArgumentCaptor.forClass(String.class);
        verify(repository, times(3)).query(queries.capture(), any(RowMapper.class), any(Object[].class));
        return queries.getAllValues();
    }

    private static void invokeMove(
            SalesMenuOwnerService service,
            String table,
            String refColumn,
            UUID section,
            SalesMenuMoveDirection direction)
            throws Exception {
        Method move = SalesMenuOwnerService.class.getDeclaredMethod(
                "move", String.class, String.class, UUID.class, UUID.class, SalesMenuMoveDirection.class, UUID.class);
        move.setAccessible(true);
        try {
            move.invoke(service, table, refColumn, VERSION, CURRENT, direction, section);
        } catch (InvocationTargetException failure) {
            if (failure.getCause() instanceof RuntimeException runtimeFailure) throw runtimeFailure;
            throw failure;
        }
    }
}
