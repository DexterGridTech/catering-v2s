package com.catering.v2s.platform.workspace.application.persistence;

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

/** Typed persistence implementation for the workspace task-read port. */
@Repository
public class JdbcGroupWorkspaceRepository implements GroupWorkspaceRepository {
    private final JdbcTemplate jdbcTemplate;

    public JdbcGroupWorkspaceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<GroupWorkspaceSummary> list(PlatformExecutionContext context, String name, String groupWorkspaceKey) {
        return jdbcTemplate.query(
                JdbcGroupWorkspaceRepositorySql.LIST,
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
                JdbcGroupWorkspaceRepositorySql.DETAIL, (resultSet, rowNum) -> mapDetail(resultSet), groupWorkspaceKey);
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
                resultSet.getObject("workspace_uuid", java.util.UUID.class),
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
