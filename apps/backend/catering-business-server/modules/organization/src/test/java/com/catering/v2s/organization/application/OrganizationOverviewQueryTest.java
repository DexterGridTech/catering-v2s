package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationEntityReadback;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class OrganizationOverviewQueryTest {
    @Test void preservesStoreFiltersForSamePredicateCountAndBoundedRead() {
        var jdbc = new RecordingJdbcTemplate();
        UUID headCompanyId = UUID.randomUUID();
        var query = new OrganizationOverviewTaskReadService.Query("STORE", "Store", "S-1", null, null, "ENABLED", "MANUAL", UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), headCompanyId, "NAME", "ASC", null);
        var page = new OrganizationOverviewTaskReadService(jdbc).page(UUID.randomUUID(), "workspace-a", "STORE", query, 2, 20);

        assertEquals(73, page.metadata().total());
        assertEquals(jdbc.countSql.replace("SELECT count(*)", ""), jdbc.listSql.substring(jdbc.listSql.indexOf(" FROM organization.store"), jdbc.listSql.indexOf(" ORDER BY")));
        assertEquals(16, jdbc.countArgs.length);
        assertEquals(18, jdbc.listArgs.length);
        assertEquals(headCompanyId, jdbc.countArgs[14]);
        assertEquals(headCompanyId, jdbc.countArgs[15]);
        assertEquals(headCompanyId, jdbc.listArgs[14]);
        assertEquals(headCompanyId, jdbc.listArgs[15]);
        assertEquals(20, jdbc.listArgs[16]);
        assertEquals(20L, jdbc.listArgs[17]);
        assertEquals("NAME", page.metadata().sort());
        assertEquals("ASC", page.metadata().direction());
        assertTrue(jdbc.listSql.contains("ORDER BY s.name ASC, s.id DESC LIMIT ? OFFSET ?"));
        assertTrue(jdbc.listSql.contains("s.notes"), "store detail/list projection must carry the contract-declared notes field");
        assertTrue(jdbc.listSql.contains("s.head_company_id=?"));
        assertTrue(jdbc.countSql.contains("s.head_company_id=?"));
        assertTrue(jdbc.filterOptionsSql.contains("'HEAD_COMPANY'"));
    }

    @Test void projectsBrandAliasFromTheOrganizationOwner() {
        var jdbc = new RecordingJdbcTemplate();
        var entities = mock(BusinessEntityService.class);
        UUID workspaceId = UUID.randomUUID();
        var brand = new OrganizationEntityReadback(UUID.randomUUID(), "BRAND", workspaceId, "workspace-a", "B-1", "Brand", null, null, "ENABLED", 1L, "Brand alias", "Brand remark", null, 0L, 1L, 2L, Map.of());
        when(entities.pageBusinessEntities(workspaceId, "workspace-a", "BRAND", null, null, null, null, null, "UPDATED_AT", "DESC", 1, 20)).thenReturn(new BusinessEntityService.BusinessEntityPage(List.of(new BusinessEntityService.BusinessEntityPageItem("BRAND", brand)), 1L, 1, 20));

        var page = new OrganizationOverviewTaskReadService(jdbc, null, entities).page(workspaceId, "workspace-a", "BUSINESS_ENTITY", new OrganizationOverviewTaskReadService.Query("BRAND", null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC"), 1, 20);

        assertEquals("Brand alias", page.items().getFirst().alias());
    }

    @Test void rejectsUnsupportedCategoryFiltersAndOrderingBeforeQuerying() {
        var service = new OrganizationOverviewTaskReadService(new RecordingJdbcTemplate());
        assertThrows(IllegalArgumentException.class, () -> service.page(UUID.randomUUID(), "workspace-a", "BUSINESS_ENTITY", new OrganizationOverviewTaskReadService.Query("BRAND", null, null, "Brand Legal", null, null, null, null, null, null, "NAME", "ASC"), 1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.page(UUID.randomUUID(), "workspace-a", "STORE", new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, null, null, null, "CREATED_AT", "ASC"), 1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.page(UUID.randomUUID(), "workspace-a", "STORE", new OrganizationOverviewTaskReadService.Query("STORE", null, null, null, null, null, null, null, null, null, "NAME", "SIDEWAYS"), 1, 20));
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql; private Object[] countArgs; private String listSql; private Object[] listArgs; private String filterOptionsSql;
        @Override public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) { countSql = sql; countArgs = args; return requiredType.cast(73L); }
        @Override public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) { if (sql.startsWith("SELECT s.id")) { listSql = sql; listArgs = args; } if (sql.startsWith("SELECT kind")) filterOptionsSql = sql; return List.of(); }
    }
}
