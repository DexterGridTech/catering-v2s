package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceAssignmentScopeService implements WorkspaceAssignmentScopeLookup {
    private final JdbcTemplate jdbc;

    public WorkspaceAssignmentScopeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public AssignmentScope requireActiveScope(UUID workspaceUuid, String groupWorkspaceKey, UUID assignmentId) {
        return jdbc.query(
                "SELECT service_node_type, service_node_id FROM workspace_iam.role_assignment WHERE id=? AND "
                        + "workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE'",
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) {
                        throw new AssignmentScopeNotFoundException();
                    }
                    return new AssignmentScope(result.getString(1), result.getObject(2, UUID.class));
                });
    }

    public static final class AssignmentScopeNotFoundException extends RuntimeException {}
}
