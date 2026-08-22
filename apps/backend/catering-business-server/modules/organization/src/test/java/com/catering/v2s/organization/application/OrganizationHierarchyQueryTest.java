package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationNodeReadback;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class OrganizationHierarchyQueryTest {
    @Test
    void requireNodeLoadsRegionWithOneCompleteOwnerRead() throws Exception {
        var jdbc = new RecordingJdbcTemplate(node("REGION"));

        var result = new OrganizationHierarchyService(jdbc, () -> 1L)
                .requireNode(UUID.randomUUID(), "group", jdbc.nodeId, "REGION");

        assertEquals("REGION", result.nodeType());
        assertEquals(1, jdbc.nodeQueryCount);
        assertEquals(0, jdbc.phaseQueryCount);
    }

    @Test
    void requireNodeLoadsProjectPhasesInTheSameOwnerRead() throws Exception {
        var jdbc = new RecordingJdbcTemplate(node("PROJECT"));

        var result = new OrganizationHierarchyService(jdbc, () -> 1L)
                .requireNode(UUID.randomUUID(), "group", jdbc.nodeId, "PROJECT");

        assertEquals(List.of("phase-1"), result.phaseNames());
        assertEquals(1, jdbc.nodeQueryCount);
        assertEquals(0, jdbc.phaseQueryCount);
    }

    private static OrganizationNodeReadback node(String nodeType) {
        UUID id = UUID.randomUUID();
        return new OrganizationNodeReadback(
                id,
                UUID.randomUUID(),
                "group",
                null,
                nodeType,
                "code",
                "name",
                null,
                "ENABLED",
                1L,
                1L,
                1L,
                List.of(),
                java.util.Map.of(),
                0L);
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private final OrganizationNodeReadback node;
        private final UUID nodeId;
        private int nodeQueryCount;
        private int phaseQueryCount;

        private RecordingJdbcTemplate(OrganizationNodeReadback node) {
            this.node = node;
            this.nodeId = node.id();
        }

        @Override
        public <T> T query(String sql, PreparedStatementSetter setter, ResultSetExtractor<T> extractor) {
            nodeQueryCount++;
            ResultSet result = mock(ResultSet.class);
            try {
                when(result.next()).thenReturn(true);
                when(result.getString("node_type")).thenReturn(node.nodeType());
                when(result.getObject("id", UUID.class)).thenReturn(node.id());
                when(result.getObject("workspace_uuid", UUID.class)).thenReturn(node.workspaceUuid());
                when(result.getString("group_workspace_key")).thenReturn(node.groupWorkspaceKey());
                when(result.getObject("parent_id", UUID.class)).thenReturn(node.parentId());
                when(result.getString("code")).thenReturn(node.code());
                when(result.getString("name")).thenReturn(node.name());
                when(result.getString("notes")).thenReturn(node.notes());
                when(result.getString("status")).thenReturn(node.status());
                when(result.getLong("version")).thenReturn(node.version());
                when(result.getLong("created_at_epoch_millis")).thenReturn(node.createdAtEpochMillis());
                when(result.getLong("updated_at_epoch_millis")).thenReturn(node.updatedAtEpochMillis());
                when(result.getString("extension_values")).thenReturn("{}");
                when(result.getLong("extension_rule_revision")).thenReturn(node.extensionRuleRevision());
                java.sql.Array phases = mock(java.sql.Array.class);
                when(phases.getArray())
                        .thenReturn(node.nodeType().equals("PROJECT") ? new String[] {"phase-1"} : new String[0]);
                when(result.getArray("phase_names")).thenReturn(phases);
                return extractor.extractData(result);
            } catch (Exception exception) {
                throw new AssertionError(exception);
            }
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            phaseQueryCount++;
            try {
                ResultSet result = mock(ResultSet.class);
                when(result.getString(1)).thenReturn("phase-1");
                return List.of(rowMapper.mapRow(result, 0));
            } catch (Exception exception) {
                throw new AssertionError(exception);
            }
        }
    }
}
