package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup.AccountAndRoleSummary;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class WorkspaceIamSummaryReadServiceTest {
    @Test
    void aggregateSummaryUsesOneOwnerQueryInsteadOfTheLegacyCounts() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspace = UUID.randomUUID();
        AccountAndRoleSummary expected = new AccountAndRoleSummary(3, 4);
        when(jdbc.queryForObject(any(String.class), any(RowMapper.class), eq(workspace), eq(workspace)))
                .thenReturn(expected);

        AccountAndRoleSummary actual = new WorkspaceIamSummaryReadService(jdbc).accountAndRoleSummary(workspace);

        assertEquals(expected, actual);
        verify(jdbc, times(1))
                .queryForObject(contains("workspace_account"), any(RowMapper.class), eq(workspace), eq(workspace));
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void accountCountReadsTheTypedOwnerCountAndNormalizesNullToZero() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspace = UUID.randomUUID();
        when(jdbc.queryForObject(any(String.class), eq(Long.class), eq(workspace)))
                .thenReturn(7L);

        long actual = new WorkspaceIamSummaryReadService(jdbc).accountCount(workspace);

        assertEquals(7L, actual);
        verify(jdbc).queryForObject(contains("workspace_account"), eq(Long.class), eq(workspace));
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void roleCountReadsTheTypedOwnerCountAndNormalizesNullToZero() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID workspace = UUID.randomUUID();
        when(jdbc.queryForObject(any(String.class), eq(Long.class), eq(workspace)))
                .thenReturn(null);

        long actual = new WorkspaceIamSummaryReadService(jdbc).roleCount(workspace);

        assertEquals(0L, actual);
        verify(jdbc).queryForObject(contains("workspace_role"), eq(Long.class), eq(workspace));
        verifyNoMoreInteractions(jdbc);
    }
}
