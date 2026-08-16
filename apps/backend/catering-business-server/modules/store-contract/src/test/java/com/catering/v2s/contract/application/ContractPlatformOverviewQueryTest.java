package com.catering.v2s.contract.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class ContractPlatformOverviewQueryTest {
    @Test
    void preservesAllCanonicalBusinessFiltersForSamePredicateCountAndBoundedRead() {
        var jdbc = new RecordingJdbcTemplate();
        var page = new ContractTaskReadService(jdbc)
                .list(
                        UUID.randomUUID(),
                        "workspace-a",
                        new ContractTaskReadService.ContractListQuery(
                                UUID.randomUUID(),
                                UUID.randomUUID(),
                                UUID.randomUUID(),
                                "CT",
                                "Phase",
                                "item-1",
                                null,
                                null,
                                "VALID",
                                "CONTRACT_NO",
                                "ASC",
                                3,
                                20));

        assertEquals(73, page.metadata().total());
        assertEquals(
                jdbc.countSql.replace("SELECT COUNT(*)", ""),
                jdbc.listSql.substring(
                        jdbc.listSql.indexOf(" FROM contract.store_contract"), jdbc.listSql.indexOf(" ORDER BY")));
        assertEquals(20, jdbc.countArgs.length);
        assertEquals(22, jdbc.listArgs.length);
        assertEquals(20, jdbc.listArgs[20]);
        assertEquals(40, jdbc.listArgs[21]);
        org.junit.jupiter.api.Assertions.assertTrue(jdbc.countSql.contains("s.project_id=?"));
        org.junit.jupiter.api.Assertions.assertTrue(jdbc.countSql.contains("c.store_id=?"));
        org.junit.jupiter.api.Assertions.assertTrue(jdbc.countSql.contains("c.tenant_id=?"));
        org.junit.jupiter.api.Assertions.assertFalse(jdbc.countSql.contains("s.name ILIKE"));
        org.junit.jupiter.api.Assertions.assertFalse(jdbc.countSql.contains("t.code ILIKE"));
        assertEquals(1, occurrences(jdbc.listSql, "LIMIT ? OFFSET ?"));
    }

    @Test
    void rejectsUnknownFilterOrOrderingBeforeQuerying() {
        var service = new ContractTaskReadService(new RecordingJdbcTemplate());
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> service.list(
                        UUID.randomUUID(),
                        "workspace-a",
                        new ContractTaskReadService.ContractListQuery(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "PENDING",
                                "UPDATED_AT",
                                "DESC",
                                1,
                                20)));
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> service.list(
                        UUID.randomUUID(),
                        "workspace-a",
                        new ContractTaskReadService.ContractListQuery(
                                null, null, null, null, null, null, null, null, null, "CREATED_AT", "DESC", 1, 20)));
        assertThrows(
                ContractCommandService.ContractValidationException.class,
                () -> service.list(
                        UUID.randomUUID(),
                        "workspace-a",
                        new ContractTaskReadService.ContractListQuery(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "UPDATED_AT",
                                "SIDEWAYS",
                                1,
                                20)));
    }

    @Test
    void taskPageUsesUniqueContractAndProjectTieBreakers() {
        var jdbc = new RecordingJdbcTemplate();
        new ContractTaskReadService(jdbc)
                .platformOverviewTaskPage(
                        UUID.randomUUID(), "workspace-a", ContractTaskReadService.ContractListQuery.empty());

        org.junit.jupiter.api.Assertions.assertTrue(jdbc.taskSql.contains("c.id AS contract_id"));
        org.junit.jupiter.api.Assertions.assertTrue(jdbc.taskSql.contains("p.id AS project_id"));
        org.junit.jupiter.api.Assertions.assertTrue(
                jdbc.taskSql.contains("ORDER BY updated_at_epoch_millis DESC, contract_id ASC"));
        org.junit.jupiter.api.Assertions.assertTrue(
                jdbc.taskSql.contains("ORDER BY paged.updated_at_epoch_millis DESC, paged.contract_id ASC"));
        org.junit.jupiter.api.Assertions.assertFalse(
                jdbc.taskSql.contains("ORDER BY updated_at_epoch_millis DESC, id ASC"));
        org.junit.jupiter.api.Assertions.assertFalse(
                jdbc.taskSql.contains("ORDER BY paged.updated_at_epoch_millis DESC, paged.id ASC"));
    }

    private static int occurrences(String value, String token) {
        return value.split(java.util.regex.Pattern.quote(token), -1).length - 1;
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql;
        private Object[] countArgs;
        private String listSql;
        private Object[] listArgs;
        private String taskSql;

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countSql = sql;
            countArgs = args;
            return requiredType.cast(73L);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            if (sql.startsWith("SELECT c.id")) {
                listSql = sql;
                listArgs = args;
            }
            return List.of();
        }

        @Override
        public <T> T query(String sql, PreparedStatementSetter setter, ResultSetExtractor<T> extractor) {
            taskSql = sql;
            return null;
        }
    }
}
