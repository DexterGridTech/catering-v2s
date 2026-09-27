package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for active workspace role-assignment scope reads. */
@Repository
public class WorkspaceAssignmentScopePersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceAssignmentScopePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public WorkspaceAssignmentScopeLookup.AssignmentScope findActiveScope(
            UUID workspaceUuid, String groupWorkspaceKey, UUID assignmentId) {
        return jdbc.query(
                WorkspaceAssignmentScopeServiceSql.SELECT_ROLE_ASSIGN_SVC_NODE_001
                        + WorkspaceAssignmentScopeServiceSql
                                .WORKSPACE_ASSIGNMENT_SCOPE_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE,
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new WorkspaceAssignmentScopeLookup.AssignmentScope(
                                result.getString(1), result.getObject(2, UUID.class))
                        : null);
    }
}
