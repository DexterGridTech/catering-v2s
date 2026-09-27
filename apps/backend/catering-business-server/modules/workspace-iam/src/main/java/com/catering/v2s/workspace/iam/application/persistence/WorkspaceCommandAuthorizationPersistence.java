package com.catering.v2s.workspace.iam.application.persistence;

import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace-IAM capability facts. */
@Repository
public class WorkspaceCommandAuthorizationPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceCommandAuthorizationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean hasCapability(
            UUID workspaceUuid, String groupWorkspaceKey, UUID actorAssignmentId, String capability) {
        Boolean allowed = jdbc.query(
                WorkspaceCommandAuthorizationServiceSql
                                .WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_SELECT_ROLE_ASSIGNMENT_ASSIGNMENT
                        + WorkspaceCommandAuthorizationServiceSql
                                .WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ID
                        + WorkspaceCommandAuthorizationServiceSql
                                .WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_WHERE_ASSIGNMENT_WORKSPACE_UUID
                        + WorkspaceCommandAuthorizationServiceSql.CONDITION_ASSIGN_GRP_WS_KEY_001
                        + WorkspaceCommandAuthorizationServiceSql
                                .WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ROLE_WORKSPACE_UUID_ASSIGNMENT
                        + WorkspaceCommandAuthorizationServiceSql
                                .WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ROLE_GROUP_WORKSPACE_KEY_ASSIGNMENT
                        + WorkspaceCommandAuthorizationServiceSql
                                .WORKSPACE_COMMAND_AUTHORIZATION_SERVICE_CONDITION_ROLE_STATUS_ENABLED_JSONB_EXISTS,
                statement -> {
                    statement.setObject(1, actorAssignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setString(4, capability);
                },
                result -> result.next() && result.getBoolean(1));
        return Boolean.TRUE.equals(allowed);
    }
}
