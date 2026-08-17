package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class OrganizationOverviewTaskReadServiceTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformHierarchyTreeUsesOneOrganizationProjection() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> service.platformHierarchyTree(UUID.randomUUID(), "organization-test"));

        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformOverviewPageUsesOneTypedCteProjectionForEveryCategory() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rows = mock(ResultSet.class);
        when(rows.next()).thenReturn(true);
        when(rows.getLong(1)).thenReturn(0L);
        when(rows.getLong(2)).thenReturn(0L);
        when(rows.getString(3)).thenReturn("[]");
        when(rows.getString(4)).thenReturn("[]");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows));
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        for (String category : List.of("HIERARCHY", "BUSINESS_ENTITY", "STORE")) {
            var page = service.platformOverviewTaskPage(
                    UUID.randomUUID(),
                    "organization-test",
                    category,
                    new OrganizationOverviewTaskReadService.Query(
                            null, null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC"),
                    1,
                    20);
            assertEquals(0L, page.metadata().total());
        }

        verify(jdbc, org.mockito.Mockito.times(3))
                .query(
                        org.mockito.ArgumentMatchers.contains("WITH RECURSIVE params"),
                        any(PreparedStatementSetter.class),
                        any(ResultSetExtractor.class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformManagementBaseDetailUsesOneOrganizationProjectionWithoutDefinitionLookup() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSet rows = mock(ResultSet.class);
                    when(rows.next()).thenReturn(false);
                    return ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows);
                });
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> service.platformManagementBaseDetail(
                        UUID.randomUUID(), "organization-test", "HIERARCHY", UUID.randomUUID()));

        verify(jdbc)
                .query(
                        org.mockito.ArgumentMatchers.contains("WITH RECURSIVE target"),
                        any(PreparedStatementSetter.class),
                        any(ResultSetExtractor.class));
        verify(jdbc, org.mockito.Mockito.never()).queryForObject(anyString(), any(Class.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformManagementDetailCtesUseExplicitTargetColumns() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSet rows = mock(ResultSet.class);
                    when(rows.next()).thenReturn(false);
                    return ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows);
                });
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        for (String category : List.of("HIERARCHY", "BUSINESS_ENTITY", "STORE")) {
            assertThrows(
                    BusinessEntityService.OrganizationNotFoundException.class,
                    () -> service.platformManagementBaseDetail(
                            UUID.randomUUID(), "organization-test", category, UUID.randomUUID()));
        }

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbc, org.mockito.Mockito.times(3))
                .query(sqlCaptor.capture(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        List<String> statements = sqlCaptor.getAllValues().stream()
                .map(sql -> sql.replaceAll("\\s+", " "))
                .toList();

        assertFalse(statements.stream().anyMatch(sql -> sql.contains("SELECT target.*")));
        assertFalse(statements.stream().anyMatch(sql -> sql.contains("SELECT * FROM target")));
        assertTrue(statements.stream()
                .anyMatch(sql ->
                        sql.contains("SELECT target.id, target.parent_id, target.node_type, target.code, target.name, "
                                + "target.status, target.version, target.created_at_epoch_millis, "
                                + "target.updated_at_epoch_millis, target.notes, target.extension_values, "
                                + "array_agg(ancestry.id")));
        assertTrue(statements.stream()
                .anyMatch(sql -> sql.contains(
                        "SELECT target.id, target.entity_type, target.code, target.name, target.legal_name, "
                                + "target.credit_code, target.alias, target.notes, target.status, target.version, "
                                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, "
                                + "target.extension_values FROM target")));
        assertTrue(statements.stream()
                .anyMatch(sql ->
                        sql.contains("SELECT target.id, target.code, target.name, target.status, target.version, "
                                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.notes, "
                                + "target.extension_values, target.project_id, target.project_code, "
                                + "target.project_name, target.brand_id, target.brand_code, target.brand_name, "
                                + "target.tenant_id, target.tenant_code, target.tenant_name, target.head_id, "
                                + "target.head_code, target.head_name, array_agg(ancestry.id")));
    }
}
