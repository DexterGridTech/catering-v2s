package com.catering.v2s.contract.application;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class ContractFixedStoreQueryTest {
    @Test
    void currentUsesShanghaiBusinessDateAndTheSamePredicateForTotalAndPage() {
        var jdbc = new RecordingJdbcTemplate();
        TimeProvider time = () -> Instant.parse("2026-07-31T16:30:00Z").toEpochMilli();
        var service = new ContractTaskReadService(jdbc, new BusinessDateProvider(time));

        var page = service.fixedStoreContractPage(
                UUID.randomUUID(),
                "workspace-a",
                UUID.randomUUID(),
                ContractTaskReadService.FixedStoreContractViewState.CURRENT,
                3,
                20);

        assertEquals(73L, page.total());
        assertEquals(LocalDate.of(2026, 8, 1), jdbc.countArgs[3]);
        assertEquals(
                jdbc.countSql.replace("SELECT COUNT(*)", ""),
                jdbc.pageSql.substring(
                        jdbc.pageSql.indexOf(" FROM contract.store_contract"), jdbc.pageSql.indexOf(" ORDER BY")));
        assertEquals(20, jdbc.pageArgs[5]);
        assertEquals(40, jdbc.pageArgs[6]);
    }

    @Test
    void eachDeclaredStateHasOnlyItsOwnerPredicate() {
        var jdbc = new RecordingJdbcTemplate();
        var service =
                new ContractTaskReadService(jdbc, new BusinessDateProvider(() -> Instant.parse("2026-07-31T16:30:00Z")
                        .toEpochMilli()));
        UUID workspaceId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        service.fixedStoreContractPage(
                workspaceId,
                "workspace-a",
                storeId,
                ContractTaskReadService.FixedStoreContractViewState.PENDING_EFFECTIVE,
                1,
                20);
        assertEquals(1, occurrences(jdbc.countSql, "c.status='ACTIVE'"));
        assertEquals(1, occurrences(jdbc.countSql, "c.effective_from>?"));
        service.fixedStoreContractPage(
                workspaceId,
                "workspace-a",
                storeId,
                ContractTaskReadService.FixedStoreContractViewState.HISTORY,
                1,
                20);
        assertEquals(1, occurrences(jdbc.countSql, "c.status='ACTIVE'"));
        assertEquals(1, occurrences(jdbc.countSql, "c.effective_to<?"));
        service.fixedStoreContractPage(
                workspaceId,
                "workspace-a",
                storeId,
                ContractTaskReadService.FixedStoreContractViewState.INVALID,
                1,
                20);
        assertEquals(1, occurrences(jdbc.countSql, "c.status='INVALID'"));
    }

    @Test
    void terminalCollectionUsesPersistedActiveStatusWithoutCalendarPredicates() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new ContractTaskReadService(jdbc, null);
        UUID workspaceId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        service.activeTerminalStoreContracts(workspaceId, "workspace-a", storeId);

        assertTrue(jdbc.pageSql.contains("c.status='ACTIVE'"));
        assertTrue(jdbc.pageSql.endsWith("ORDER BY c.id"));
        String whereClause = jdbc.pageSql.substring(jdbc.pageSql.indexOf(" WHERE "), jdbc.pageSql.indexOf(" ORDER BY"));
        assertFalse(whereClause.contains("effective_from"));
        assertFalse(whereClause.contains("effective_to"));
        assertArrayEquals(new Object[] {workspaceId, "workspace-a", storeId}, jdbc.pageArgs);
    }

    private static int occurrences(String value, String token) {
        return value.split(java.util.regex.Pattern.quote(token), -1).length - 1;
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql;
        private Object[] countArgs;
        private String pageSql;
        private Object[] pageArgs;

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countSql = sql;
            countArgs = args;
            return requiredType.cast(73L);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            if (sql.startsWith("SELECT c.id")) {
                pageSql = sql;
                pageArgs = args;
            }
            return List.of();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T query(String sql, PreparedStatementSetter setter, ResultSetExtractor<T> extractor) {
            if (sql.startsWith("SELECT p.id"))
                return (T) new ContractTaskReadService.Project(UUID.randomUUID(), "PRJ-01", "项目一");
            return null;
        }
    }
}
