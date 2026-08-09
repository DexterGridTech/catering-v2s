package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class OrganizationGroupWorkspaceInitializationTaskReadServiceTest {
    @Test
    void emptyBatchAndBlankDetailNeverIssueAnOwnerQuery() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        OrganizationGroupWorkspaceInitializationTaskReadService service = new OrganizationGroupWorkspaceInitializationTaskReadService(jdbc);

        assertTrue(service.listInitializationFacts(java.util.List.of()).isEmpty());
        assertTrue(service.initializationFact(" ").isEmpty());
        verifyNoInteractions(jdbc);
    }

    @Test
    void nonEmptyBatchUsesOneOrganizationOnlyBoundedQuery() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var expected = java.util.Map.of("gw", new com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup.InitializationState("gw", true));
        when(jdbc.query(any(String.class), any(PreparedStatementSetter.class), any(ResultSetExtractor.class))).thenReturn(expected);

        var actual = new OrganizationGroupWorkspaceInitializationTaskReadService(jdbc).listInitializationFacts(java.util.List.of("gw", "gw"));

        assertEquals(expected, actual);
        verify(jdbc, times(1)).query(contains("organization.commercial_group"), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        verifyNoMoreInteractions(jdbc);
    }
}
