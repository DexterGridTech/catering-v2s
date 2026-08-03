package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class OrganizationOverviewQueryTest {
    @Test void preservesStoreFiltersForSamePredicateCountAndBoundedRead() {
        var jdbc = new RecordingJdbcTemplate();
        var query = new OrganizationOverviewTaskReadService.Query("STORE", "Store", "S-1", "ENABLED", "MANUAL", UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "NAME", "ASC");
        var page = new OrganizationOverviewTaskReadService(jdbc).page(UUID.randomUUID(), "workspace-a", "STORE", query, 2, 20);

        assertEquals(73, page.metadata().total());
        assertEquals(jdbc.countSql.replace("SELECT count(*)", ""), jdbc.listSql.substring(jdbc.listSql.indexOf(" FROM organization.store"), jdbc.listSql.indexOf(" ORDER BY")));
        assertEquals(14, jdbc.countArgs.length);
        assertEquals(16, jdbc.listArgs.length);
        assertEquals(20, jdbc.listArgs[14]);
        assertEquals(20L, jdbc.listArgs[15]);
        assertEquals("NAME", page.metadata().sort());
        assertEquals("ASC", page.metadata().direction());
        assertTrue(jdbc.listSql.contains("ORDER BY s.name ASC, s.id DESC LIMIT ? OFFSET ?"));
        assertTrue(jdbc.listSql.contains("s.notes"), "store detail/list projection must carry the contract-declared notes field");
    }

    @Test void rejectsUnsupportedCategoryFiltersAndOrderingBeforeQuerying() {
        var service = new OrganizationOverviewTaskReadService(new RecordingJdbcTemplate());
        assertThrows(IllegalArgumentException.class, () -> service.page(UUID.randomUUID(), "workspace-a", "BUSINESS_ENTITY", new OrganizationOverviewTaskReadService.Query("BRAND", null, null, null, null, null, UUID.randomUUID(), null, "NAME", "ASC"), 1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.page(UUID.randomUUID(), "workspace-a", "STORE", new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, null, "CREATED_AT", "ASC"), 1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.page(UUID.randomUUID(), "workspace-a", "STORE", new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, null, "NAME", "SIDEWAYS"), 1, 20));
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql; private Object[] countArgs; private String listSql; private Object[] listArgs;
        @Override public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) { countSql = sql; countArgs = args; return requiredType.cast(73L); }
        @Override public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) { if (sql.startsWith("SELECT s.id")) { listSql = sql; listArgs = args; } return List.of(); }
    }
}
