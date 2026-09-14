package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace capability and active-assignment facts. */
@Repository
public class WorkspaceCapabilityScopePersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceCapabilityScopePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public WorkspaceAssignmentScopeLookup.AssignmentScope requireActiveAssignmentCapability(
            UUID assignmentId, UUID workspaceUuid, String groupWorkspaceKey, String capability) {
        return jdbc.query(
                WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_SELECT_ASSIGNMENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONTINUATION_ROLE_ASSIGNMENT_ASSIGNMENT
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_JOIN_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ID
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_WHERE_ASSIGNMENT_WORKSPACE_UUID
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ASSIGNMENT_GROUP_WORKSPACE_KEY_STATUS_ACTIVE
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ROLE_WORKSPACE_UUID_ASSIGNMENT
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ROLE_GROUP_WORKSPACE_KEY_ASSIGNMENT
                        + WorkspaceCapabilityScopeResolverSql.WORKSPACE_CAPABILITY_SCOPE_RESOLVER_CONDITION_ROLE_STATUS_ENABLED_JSONB_EXISTS,
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setString(4, capability);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("workspace assignment scope unavailable");
                    return new WorkspaceAssignmentScopeLookup.AssignmentScope(
                            result.getString(1), result.getObject(2, UUID.class));
                });
    }
}
