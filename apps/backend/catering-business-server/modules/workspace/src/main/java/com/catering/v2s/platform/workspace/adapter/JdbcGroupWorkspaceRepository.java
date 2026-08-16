package com.catering.v2s.platform.workspace.adapter;

import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.workspace.api.CommercialGroupSummary;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceDetail;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceSummary;
import com.catering.v2s.platform.workspace.application.GroupWorkspaceRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcGroupWorkspaceRepository implements GroupWorkspaceRepository {
    private final JdbcTemplate jdbcTemplate;

    public JdbcGroupWorkspaceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<GroupWorkspaceSummary> list(PlatformExecutionContext context, String name, String groupWorkspaceKey) {
        return jdbcTemplate.query(
                """
            SELECT gw.group_workspace_key, gw.name,
                   CASE WHEN cg.id IS NULL THEN 'NOT_INITIALIZED' ELSE 'INITIALIZED' END AS commercial_group_status
              FROM platform_workspace.group_workspace gw
              LEFT JOIN organization.commercial_group cg
                ON cg.group_workspace_key = gw.group_workspace_key AND cg.group_workspace_id = gw.id
             WHERE (CAST(? AS VARCHAR) IS NULL OR gw.name ILIKE '%' || CAST(? AS VARCHAR) || '%')
               AND (CAST(? AS VARCHAR) IS NULL OR gw.group_workspace_key = CAST(? AS VARCHAR))
             ORDER BY gw.name, gw.group_workspace_key
            """,
                (resultSet, rowNum) -> new GroupWorkspaceSummary(
                        resultSet.getString("group_workspace_key"),
                        resultSet.getString("name"),
                        resultSet.getString("commercial_group_status")),
                blankToNull(name),
                blankToNull(name),
                blankToNull(groupWorkspaceKey),
                blankToNull(groupWorkspaceKey));
    }

    @Override
    public Optional<GroupWorkspaceDetail> detail(PlatformExecutionContext context, String groupWorkspaceKey) {
        List<GroupWorkspaceDetail> rows = jdbcTemplate.query(
                """
            SELECT gw.id, gw.group_workspace_key, gw.name, gw.status AS workspace_status,
                   CASE WHEN cg.id IS NULL THEN 'NOT_INITIALIZED' ELSE 'INITIALIZED' END AS commercial_group_status,
                   cg.id AS commercial_group_id, cg.commercial_group_code, cg.commercial_group_name,
                   cg.extension_values::text AS commercial_group_extension_values, cg.extension_rule_revision,
                   cg.version, cg.created_at_epoch_millis
              FROM platform_workspace.group_workspace gw
              LEFT JOIN organization.commercial_group cg
                ON cg.group_workspace_key = gw.group_workspace_key AND cg.group_workspace_id = gw.id
             WHERE gw.group_workspace_key = ?
            """,
                (resultSet, rowNum) -> mapDetail(resultSet),
                groupWorkspaceKey);
        return rows.stream().findFirst();
    }

    private static GroupWorkspaceDetail mapDetail(ResultSet resultSet) throws SQLException {
        Long commercialGroupId = resultSet.getObject("commercial_group_id", Long.class);
        CommercialGroupSummary readback = commercialGroupId == null
                ? null
                : new CommercialGroupSummary(
                        commercialGroupId,
                        resultSet.getString("commercial_group_code"),
                        resultSet.getString("commercial_group_name"),
                        resultSet.getString("commercial_group_extension_values"),
                        resultSet.getLong("extension_rule_revision"),
                        resultSet.getLong("version"),
                        resultSet.getLong("created_at_epoch_millis"));
        return new GroupWorkspaceDetail(
                resultSet.getLong("id"),
                resultSet.getString("group_workspace_key"),
                resultSet.getString("name"),
                resultSet.getString("workspace_status"),
                resultSet.getString("commercial_group_status"),
                readback);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
