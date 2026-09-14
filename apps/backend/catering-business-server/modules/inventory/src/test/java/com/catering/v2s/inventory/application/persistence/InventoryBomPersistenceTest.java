package com.catering.v2s.inventory.application.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class InventoryBomPersistenceTest {
    @Test
    @SuppressWarnings("unchecked")
    void tenBomRowsUseOneBoundedLookupAndPreserveResolvedFacts() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        List<UUID> submitted = new ArrayList<>();
        for (int index = 0; index < 10; index++) submitted.add(UUID.randomUUID());
        Map<UUID, InventoryBomPersistence.ResolvedTargetFact> resolved = new LinkedHashMap<>();
        submitted.forEach(ref -> resolved.put(
                ref,
                new InventoryBomPersistence.ResolvedTargetFact("ENABLED", true, UUID.randomUUID())));
        String sql = ResolvedBomTargetsSql.RESOLVED_BOM_TARGETS_SELECT_TARGET_REF_DEFINITION_STATUS_COMPONENT_ELIGIBLE
                + ResolvedBomTargetsSql.RESOLVED_BOM_TARGETS_CONTINUATION_STOCK_TARGET_CONSUMPTION_UNIT_REF
                + ResolvedBomTargetsSql.RESOLVED_BOM_TARGETS_WHERE_DATA_NODE_REF_BRAND_REF_TARGET_REF;
        when(jdbc.query(
                        eq(sql),
                        any(PreparedStatementSetter.class),
                        any(ResultSetExtractor.class)))
                .thenReturn(resolved);

        Map<UUID, InventoryBomPersistence.ResolvedTargetFact> actual =
                new InventoryBomPersistence(jdbc).resolveBomTargets("scope", "brand", submitted);

        assertEquals(resolved, actual);
        verify(jdbc, times(1))
                .query(eq(sql), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
    }
}
