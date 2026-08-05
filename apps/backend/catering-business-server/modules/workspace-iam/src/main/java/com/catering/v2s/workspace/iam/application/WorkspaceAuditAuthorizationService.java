package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workspace-IAM-owned task authorization for the operations audit modal.
 *
 * <p>The audit modal is a read-only child of an already approved host detail. It therefore has no
 * independent action capability. Its authorization is exactly the host entity's role-node read
 * scope: page access is a frontend navigation projection and is never consumed here. A selected
 * data node is UI context only: it never narrows a task read already granted by the current role
 * node.
 */
@Service
public class WorkspaceAuditAuthorizationService {
    private final JdbcTemplate jdbc;
    private final OrganizationTaskPathLookup taskPaths;

    public WorkspaceAuditAuthorizationService(
        JdbcTemplate jdbc,
        OrganizationTaskPathLookup taskPaths
    ) {
        this.jdbc = jdbc;
        this.taskPaths = taskPaths;
    }

    @Transactional(readOnly = true)
    public void requireGroupHost(WorkspaceSessionReadback session) {
        Assignment assignment = requireCurrentAssignment(session);
        if (!"GROUP".equals(assignment.nodeType())) denyAccess();
        requireScope(session, assignment, "GROUP", assignment.nodeId());
    }

    @Transactional(readOnly = true)
    public void requireScopedHost(
        WorkspaceSessionReadback session,
        String targetType,
        UUID targetId
    ) {
        Assignment assignment = requireCurrentAssignment(session);
        requireScope(session, assignment, targetType, targetId);
    }

    @Transactional(readOnly = true)
    public void requireWorkspaceSubject(
        WorkspaceSessionReadback session,
        String entityType,
        UUID subjectId
    ) {
        Assignment actor = requireCurrentAssignment(session);
        List<SubjectTarget> targets = switch (entityType) {
            case "WORKSPACE_ACCOUNT" ->
                jdbc.query(
                    "SELECT DISTINCT target.service_node_type, target.service_node_id FROM workspace_iam.role_assignment target "
                        + "WHERE target.account_id=? AND target.workspace_uuid=? AND target.group_workspace_key=? "
                        + "AND target.status='ACTIVE'",
                    (row, index) -> new SubjectTarget(row.getString(1), row.getObject(2, UUID.class)),
                    subjectId, session.workspaceUuid(), session.groupWorkspaceKey()
                );
            case "WORKSPACE_INVITATION" ->
                jdbc.query(
                    "SELECT target.service_node_type, target.service_node_id FROM workspace_iam.invitation invitation "
                        + "JOIN workspace_iam.invitation_assignment_intent target ON target.invitation_id=invitation.id "
                        + "WHERE invitation.id=? AND invitation.workspace_uuid=? AND invitation.group_workspace_key=?",
                    (row, index) -> new SubjectTarget(row.getString(1), row.getObject(2, UUID.class)),
                    subjectId, session.workspaceUuid(), session.groupWorkspaceKey()
                );
            default -> throw new IllegalArgumentException("unsupported workspace audit subject");
        };
        if (targets.isEmpty()) denyAccess();
        boolean allowed = "WORKSPACE_INVITATION".equals(entityType)
            ? targets.stream().allMatch(target -> isScopeAllowed(session, actor, target))
            : targets.stream().anyMatch(target -> isScopeAllowed(session, actor, target));
        if (!allowed) denyAccess();
    }

    private Assignment requireCurrentAssignment(WorkspaceSessionReadback session) {
        if (session == null || session.currentAssignmentId() == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        List<Assignment> assignments = jdbc.query(
            "SELECT assignment.service_node_type, assignment.service_node_id "
                + "FROM workspace_iam.role_assignment assignment "
                + "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id "
                + "WHERE assignment.id=? AND assignment.account_id=? AND assignment.workspace_uuid=? "
                + "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' "
                + "AND role.status='ENABLED'",
            (row, index) -> new Assignment(row.getString(1), row.getObject(2, UUID.class)),
            session.currentAssignmentId(), session.accountId(), session.workspaceUuid(), session.groupWorkspaceKey()
        );
        if (assignments.size() != 1) throw new WorkspaceAuthenticationService.SessionInvalidException();
        return assignments.getFirst();
    }

    private void requireScope(
        WorkspaceSessionReadback session,
        Assignment assignment,
        String targetType,
        UUID targetId
    ) {
        if (!isScopeAllowed(session, assignment, new SubjectTarget(targetType, targetId))) denyAccess();
    }

    private boolean isScopeAllowed(
        WorkspaceSessionReadback session,
        Assignment assignment,
        SubjectTarget target
    ) {
        if (target.targetType() == null || target.targetId() == null) return false;
        try {
            var taskPath = taskPaths.requireTaskPath(
                session.workspaceUuid(), session.groupWorkspaceKey(), target.targetType(), target.targetId()
            );
            return taskPaths.isScopeAllowed(
                session.workspaceUuid(), session.groupWorkspaceKey(), assignment.nodeType(), assignment.nodeId(), taskPath
            );
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private static void denyAccess() {
        throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
    }

    static record Assignment(String nodeType, UUID nodeId) { }
    static record SubjectTarget(String targetType, UUID targetId) { }
}
