package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.ResultSetExtractor;

class OrganizationOverviewTaskReadServiceTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformHierarchyTreeUsesOneOrganizationProjection() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(BusinessEntityService.OrganizationNotFoundException.class, () ->
            service.platformHierarchyTree(UUID.randomUUID(), "organization-test")
        );

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
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class))).thenAnswer(invocation ->
            ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows)
        );
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        for (String category : List.of("HIERARCHY", "BUSINESS_ENTITY", "STORE")) {
            var page = service.platformOverviewTaskPage(UUID.randomUUID(), "organization-test", category,
                new OrganizationOverviewTaskReadService.Query(null, null, null, null, null, null, null, null, null, null, "UPDATED_AT", "DESC"), 1, 20);
            assertEquals(0L, page.metadata().total());
        }

        verify(jdbc, org.mockito.Mockito.times(3)).query(org.mockito.ArgumentMatchers.contains("WITH RECURSIVE params"), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformManagementBaseDetailUsesOneOrganizationProjectionWithoutDefinitionLookup() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class))).thenAnswer(invocation -> {
            ResultSet rows = mock(ResultSet.class);
            when(rows.next()).thenReturn(false);
            return ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows);
        });
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(BusinessEntityService.OrganizationNotFoundException.class, () ->
            service.platformManagementBaseDetail(UUID.randomUUID(), "organization-test", "HIERARCHY", UUID.randomUUID())
        );

        verify(jdbc).query(org.mockito.ArgumentMatchers.contains("WITH RECURSIVE target"), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        verify(jdbc, org.mockito.Mockito.never()).queryForObject(anyString(), any(Class.class), any(Object[].class));
    }
}
