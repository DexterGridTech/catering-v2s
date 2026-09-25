package com.catering.v2s.platform.workspace.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceDetail;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceSummary;
import com.catering.v2s.platform.workspace.application.persistence.JdbcGroupWorkspaceRepository;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class JdbcGroupWorkspaceRepositoryTest {
    @Test
    void listAndDetailKeepRepositoryReadbackShape() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PlatformExecutionContext context = mock(PlatformExecutionContext.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.getString("group_workspace_key")).thenReturn("workspace-key");
            when(row.getString("name")).thenReturn("Workspace");
            when(row.getString("commercial_group_status")).thenReturn("INITIALIZED");
            when(row.getLong("id")).thenReturn(7L);
            when(row.getObject("workspace_uuid", UUID.class)).thenReturn(UUID.randomUUID());
            when(row.getString("workspace_status")).thenReturn("ENABLED");
            when(row.getObject("commercial_group_id", Long.class)).thenReturn(null);
            return List.of(mapper.mapRow(row, 0));
        });

        JdbcGroupWorkspaceRepository repository = new JdbcGroupWorkspaceRepository(jdbc);

        List<GroupWorkspaceSummary> summaries = repository.list(context, "  Workspace  ", "workspace-key");
        var detail = repository.detail(context, "workspace-key");

        assertEquals("workspace-key", summaries.getFirst().groupWorkspaceKey());
        assertEquals("INITIALIZED", summaries.getFirst().commercialGroupStatus());
        assertTrue(detail.isPresent());
        GroupWorkspaceDetail readback = detail.get();
        assertEquals("workspace-key", readback.groupWorkspaceKey());
        assertEquals("ENABLED", readback.workspaceStatus());
    }
}
