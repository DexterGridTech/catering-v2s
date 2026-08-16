package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.UserManagementAction;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-side action authorization. Page entry remains independent and is never inferred here. */
@Service
public class WorkspaceCommandAuthorizationService {
    private final JdbcTemplate jdbc;
    private final WorkspaceAssignmentScopeLookup assignments;
    private final OrganizationTaskPathLookup taskPaths;

    public WorkspaceCommandAuthorizationService(JdbcTemplate jdbc) {
        this(jdbc, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceCommandAuthorizationService(
            JdbcTemplate jdbc, WorkspaceAssignmentScopeLookup assignments, OrganizationTaskPathLookup taskPaths) {
        this.jdbc = jdbc;
        this.assignments = assignments;
        this.taskPaths = taskPaths;
    }

    @Transactional(readOnly = true)
    public void requireUserManagementAction(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            String targetOrganizationType,
            UUID targetOrganizationId,
            UserManagementAction action) {
        requireUserManagementCapabilityOnScope(
                workspaceUuid,
                groupWorkspaceKey,
                actorAssignmentId,
                targetOrganizationType,
                action,
                targetOrganizationType,
                targetOrganizationId);
    }

    /**
     * The endpoint-fixed user-management capability and the server-resolved scope target are deliberately separate. A
     * GROUP role may, for example, operate the aggregate HEAD_COMPANY page while its first owner query is the
     * commercial-group root.
     */
    @Transactional(readOnly = true)
    public void requireUserManagementCapabilityOnScope(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            String capabilityTargetType,
            UserManagementAction action,
            String scopeTargetType,
            UUID scopeTargetId) {
        if (assignments == null || taskPaths == null) throw new AuthorizationDeniedException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment =
                assignments.requireActiveScope(workspaceUuid, groupWorkspaceKey, actorAssignmentId);
        OrganizationTaskPathLookup.TaskPath target =
                taskPaths.requireTaskPath(workspaceUuid, groupWorkspaceKey, scopeTargetType, scopeTargetId);
        if (!taskPaths.isScopeAllowed(
                workspaceUuid, groupWorkspaceKey, assignment.serviceNodeType(), assignment.serviceNodeId(), target))
            throw new AuthorizationDeniedException();
        String capability = WorkspaceAuthorizationCatalog.requiredUserManagementCapabilityForTarget(
                        capabilityTargetType, action)
                .orElseThrow(AuthorizationDeniedException::new);
        Boolean allowed = jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM workspace_iam.role_assignment assignment "
                        + "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id "
                        + "WHERE assignment.id=? AND assignment.workspace_uuid=? "
                        + "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' "
                        + "AND role.workspace_uuid=assignment.workspace_uuid "
                        + "AND role.group_workspace_key=assignment.group_workspace_key "
                        + "AND role.status='ENABLED' AND jsonb_exists(role.capability_keys, ?))",
                statement -> {
                    statement.setObject(1, actorAssignmentId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setString(4, capability);
                },
                result -> result.next() && result.getBoolean(1));
        if (!Boolean.TRUE.equals(allowed)) {
            throw new AuthorizationDeniedException();
        }
    }

    public static final class AuthorizationDeniedException extends RuntimeException {}
}
