package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowMapper;

class ResolvedBomTargetsTest {
    @Test
    @SuppressWarnings("unchecked")
    void tenBomRowsUseOneBoundedLookupAndKeepTheFirstMissingDiagnostic() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        List<UUID> submitted = new ArrayList<>();
        for (int index = 0; index < 10; index++) submitted.add(UUID.randomUUID());
        UUID missing = submitted.get(7);
        List<UUID> resolved =
                submitted.stream().filter(ref -> !ref.equals(missing)).toList();
        when(jdbc.query(
                        eq(ResolvedBomTargets.STATEMENT_TEMPLATE),
                        any(PreparedStatementSetter.class),
                        any(RowMapper.class)))
                .thenReturn(resolved);

        ResolvedBomTargets targets = ResolvedBomTargets.load(jdbc, "scope", "brand", submitted);

        for (int index = 0; index < 7; index++) targets.requireResolved(submitted.get(index));
        InventoryOwnerApi.Problem failure =
                assertThrows(InventoryOwnerApi.Problem.class, () -> targets.requireResolved(missing));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", failure.code());
        verify(jdbc, times(1))
                .query(
                        eq(ResolvedBomTargets.STATEMENT_TEMPLATE),
                        any(PreparedStatementSetter.class),
                        any(RowMapper.class));
    }
}
