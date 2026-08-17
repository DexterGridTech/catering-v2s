package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class OrganizationOverviewQueryTest {
    @Test
    void preservesStoreFiltersForSamePredicateCountAndBoundedRead() {
        var jdbc = new RecordingJdbcTemplate();
        UUID headCompanyId = UUID.randomUUID();
        var query = new OrganizationOverviewTaskReadService.Query(
                "STORE",
                "Store",
                "S-1",
                null,
                null,
                "ENABLED",
                "MANUAL",
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                headCompanyId,
                "NAME",
                "ASC",
                null);
        var page = new OrganizationOverviewTaskReadService(jdbc)
                .page(UUID.randomUUID(), "workspace-a", "STORE", query, 2, 20);

        assertEquals(73, page.metadata().total());
        assertEquals(
                jdbc.countSql.replace("SELECT count(*)", ""),
                jdbc.listSql.substring(
                        jdbc.listSql.indexOf(" FROM organization.store"), jdbc.listSql.indexOf(" ORDER BY")));
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
        assertTrue(
                jdbc.listSql.contains("s.notes"),
                "store detail/list projection must carry the contract-declared notes field");
        assertTrue(jdbc.listSql.contains("s.head_company_id=?"));
        assertTrue(jdbc.countSql.contains("s.head_company_id=?"));
        assertTrue(jdbc.filterOptionsSql.contains("'HEAD_COMPANY'"));
    }

    @Test
    void projectsBrandAliasFromTheOrganizationOwner() {
        var jdbc = new RecordingJdbcTemplate();
        var entities = mock(BusinessEntityService.class);
        UUID workspaceId = UUID.randomUUID();
        var brand = new OrganizationEntityReadback(
                UUID.randomUUID(),
                "BRAND",
                workspaceId,
                "workspace-a",
                "B-1",
                "Brand",
                null,
                null,
                "ENABLED",
                1L,
                "Brand alias",
                "Brand remark",
                null,
                0L,
                1L,
                2L,
                Map.of());
        when(entities.pageBusinessEntities(
                        workspaceId, "workspace-a", "BRAND", null, null, null, null, null, "UPDATED_AT", "DESC", 1, 20))
                .thenReturn(new BusinessEntityService.BusinessEntityPage(
                        List.of(new BusinessEntityService.BusinessEntityPageItem("BRAND", brand)), 1L, 1, 20));

        var page = new OrganizationOverviewTaskReadService(jdbc, null, entities)
                .page(
                        workspaceId,
                        "workspace-a",
                        "BUSINESS_ENTITY",
                        new OrganizationOverviewTaskReadService.Query(
                                "BRAND", null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC"),
                        1,
                        20);

        assertEquals("Brand alias", page.items().getFirst().alias());
    }

    @Test
    void rejectsUnsupportedCategoryFiltersAndOrderingBeforeQuerying() {
        var service = new OrganizationOverviewTaskReadService(new RecordingJdbcTemplate());
        assertThrows(
                IllegalArgumentException.class,
                () -> service.page(
                        UUID.randomUUID(),
                        "workspace-a",
                        "BUSINESS_ENTITY",
                        new OrganizationOverviewTaskReadService.Query(
                                "BRAND", null, null, "Brand Legal", null, null, null, null, null, null, "NAME", "ASC"),
                        1,
                        20));
        assertThrows(
                IllegalArgumentException.class,
                () -> service.page(
                        UUID.randomUUID(),
                        "workspace-a",
                        "STORE",
                        new OrganizationOverviewTaskReadService.Query(
                                "STORE", null, null, null, null, null, null, null, null, null, "CREATED_AT", "ASC"),
                        1,
                        20));
        assertThrows(
                IllegalArgumentException.class,
                () -> service.page(
                        UUID.randomUUID(),
                        "workspace-a",
                        "STORE",
                        new OrganizationOverviewTaskReadService.Query(
                                "STORE", null, null, null, null, null, null, null, null, null, "NAME", "SIDEWAYS"),
                        1,
                        20));
    }

    @Test
    void platformOverviewKeepsWhitespaceAroundDynamicOrderClauses() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new OrganizationOverviewTaskReadService(jdbc);

        service.platformOverviewTaskPage(
                UUID.randomUUID(),
                "workspace-a",
                "HIERARCHY",
                new OrganizationOverviewTaskReadService.Query(
                        null, null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC", null),
                1,
                20);

        String sql = jdbc.platformSql.replaceAll("\\s+", " ");
        assertTrue(sql.contains("ORDER BY updated_at DESC, id DESC"));
        assertTrue(sql.contains(") ORDER BY updated_at DESC, id DESC) FROM paged"));
        assertFalse(sql.contains("ORDER BYupdated_at"));
        assertTrue(sql.contains("b.alias, b.remark AS notes, b.status"));
        assertTrue(sql.contains("t.legal_name, t.credit_code, NULL::text, t.remark, t.status"));
        assertTrue(sql.contains("h.legal_name, h.credit_code, NULL::text, h.remark, h.status"));
        assertFalse(sql.contains("alias, remark AS notes, status"));
    }

    @Test
    void platformOverviewUsesExplicitColumnsForMaterializedCteProjections() {
        var jdbc = new RecordingJdbcTemplate();
        new OrganizationOverviewTaskReadService(jdbc)
                .platformOverviewTaskPage(
                        UUID.randomUUID(),
                        "workspace-a",
                        "HIERARCHY",
                        OrganizationOverviewTaskReadService.Query.empty(),
                        1,
                        20);

        String sql = jdbc.platformSql.replaceAll("\\s+", " ");
        assertFalse(sql.contains("SELECT item.*"));
        assertFalse(sql.contains("SELECT * FROM filtered"));
        assertTrue(sql.contains(
                "SELECT item.id, item.category, item.type, item.code, item.name, item.status, item.source, "
                        + "item.version, item.created_at, item.updated_at, item.notes, item.legal_name, "
                        + "item.credit_code, item.alias, item.path, item.project, item.brand, item.tenant, "
                        + "item.head_company, item.project_filter_id, item.brand_filter_id, "
                        + "item.tenant_filter_id, item.head_filter_id, item.project_phases, "
                        + "COUNT(*) OVER () AS total FROM all_items item"));
        assertTrue(sql.contains("SELECT filtered.id, filtered.category, filtered.type, filtered.code, filtered.name, "
                + "filtered.status, filtered.source, filtered.version, filtered.created_at, "
                + "filtered.updated_at, filtered.notes, filtered.legal_name, filtered.credit_code, "
                + "filtered.alias, filtered.path, filtered.project, filtered.brand, filtered.tenant, "
                + "filtered.head_company, filtered.project_filter_id, filtered.brand_filter_id, "
                + "filtered.tenant_filter_id, filtered.head_filter_id, filtered.project_phases, "
                + "filtered.total FROM filtered"));
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql;
        private Object[] countArgs;
        private String listSql;
        private Object[] listArgs;
        private String filterOptionsSql;
        private String platformSql;

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countSql = sql;
            countArgs = args;
            return requiredType.cast(73L);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            if (sql.startsWith("SELECT s.id")) {
                listSql = sql;
                listArgs = args;
            }
            if (sql.startsWith("SELECT kind")) filterOptionsSql = sql;
            return List.of();
        }

        @SuppressWarnings("unchecked")
        @Override
        public <T> T query(String sql, PreparedStatementSetter setter, ResultSetExtractor<T> extractor) {
            platformSql = sql;
            return (T) new OrganizationOverviewTaskReadService.Page(
                    new OrganizationOverviewTaskReadService.Metadata(
                            "workspace-a", "HIERARCHY", 1, 20, 0L, "UPDATED_AT", "DESC"),
                    List.of(),
                    "AVAILABLE",
                    0L,
                    List.of(),
                    List.of(),
                    "AVAILABLE",
                    0L,
                    List.of());
        }
    }
}
