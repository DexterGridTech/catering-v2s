package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceCommandAuthorizationPersistence;
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
    private final WorkspaceCommandAuthorizationPersistence persistence;
    private final WorkspaceAssignmentScopeLookup assignments;
    private final OrganizationTaskPathLookup taskPaths;

    public WorkspaceCommandAuthorizationService(JdbcTemplate jdbc) {
        this(new WorkspaceCommandAuthorizationPersistence(jdbc), null, null);
    }

    public WorkspaceCommandAuthorizationService(
            JdbcTemplate jdbc, WorkspaceAssignmentScopeLookup assignments, OrganizationTaskPathLookup taskPaths) {
        this(new WorkspaceCommandAuthorizationPersistence(jdbc), assignments, taskPaths);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceCommandAuthorizationService(
            WorkspaceCommandAuthorizationPersistence persistence,
            WorkspaceAssignmentScopeLookup assignments,
            OrganizationTaskPathLookup taskPaths) {
        this.persistence = persistence;
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
     * Consumes the target path already resolved for this same owner command. The path stays invocation-local: this
     * avoids reopening the identical organization task-path read while retaining the final active-assignment and
     * capability checks at the workspace-IAM command boundary.
     */
    @Transactional(readOnly = true)
    public void requireUserManagementAction(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            String targetOrganizationType,
            OrganizationTaskPathLookup.TaskPath validatedTarget,
            UserManagementAction action) {
        if (validatedTarget == null
                || targetOrganizationType == null
                || !targetOrganizationType.equals(validatedTarget.targetType())) {
            throw new AuthorizationDeniedException();
        }
        requireUserManagementCapabilityOnValidatedScope(
                workspaceUuid, groupWorkspaceKey, actorAssignmentId, targetOrganizationType, action, validatedTarget);
    }

    /**
     * A command can have an endpoint-fixed capability target while its selected operation scope is an aggregate
     * ancestor. The caller has already proved that selected scope against the concrete target; reuse that one
     * invocation-local path for the final authorization rather than resolving it again.
     */
    @Transactional(readOnly = true)
    public void requireUserManagementActionOnValidatedScope(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            String capabilityTargetType,
            OrganizationTaskPathLookup.TaskPath validatedScope,
            UserManagementAction action) {
        if (validatedScope == null || capabilityTargetType == null) throw new AuthorizationDeniedException();
        requireUserManagementCapabilityOnValidatedScope(
                workspaceUuid, groupWorkspaceKey, actorAssignmentId, capabilityTargetType, action, validatedScope);
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
        OrganizationTaskPathLookup.CommandTaskPathFacts target = taskPaths.commandTaskPathFacts(
                workspaceUuid,
                groupWorkspaceKey,
                assignment.serviceNodeType(),
                assignment.serviceNodeId(),
                scopeTargetType,
                scopeTargetId,
                false);
        if (!target.assignmentScopeAllowed()) throw new AuthorizationDeniedException();
        requireCapability(workspaceUuid, groupWorkspaceKey, actorAssignmentId, capabilityTargetType, action);
    }

    private void requireUserManagementCapabilityOnValidatedScope(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            String capabilityTargetType,
            UserManagementAction action,
            OrganizationTaskPathLookup.TaskPath validatedTarget) {
        if (assignments == null || taskPaths == null) throw new AuthorizationDeniedException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment =
                assignments.requireActiveScope(workspaceUuid, groupWorkspaceKey, actorAssignmentId);
        if (!OrganizationTaskPathLookup.scopeAllows(
                assignment.serviceNodeType(), assignment.serviceNodeId(), validatedTarget)) {
            throw new AuthorizationDeniedException();
        }
        requireCapability(workspaceUuid, groupWorkspaceKey, actorAssignmentId, capabilityTargetType, action);
    }

    private void requireCapability(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            String capabilityTargetType,
            UserManagementAction action) {
        String capability = WorkspaceAuthorizationCatalog.requiredUserManagementCapabilityForTarget(
                        capabilityTargetType, action)
                .orElseThrow(AuthorizationDeniedException::new);
        if (!persistence.hasCapability(workspaceUuid, groupWorkspaceKey, actorAssignmentId, capability)) {
            throw new AuthorizationDeniedException();
        }
    }

    public static final class AuthorizationDeniedException extends RuntimeException {}
}
