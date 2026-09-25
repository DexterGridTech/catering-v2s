package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.persistence.WorkspaceAuditAuthorizationPersistence;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workspace-IAM-owned task authorization for the operations audit modal.
 *
 * <p>The audit modal is a read-only child of an already approved host detail. It therefore has no independent action
 * capability. Its authorization is exactly the host entity's role-node read scope: page access is a frontend navigation
 * projection and is never consumed here. A selected data node is UI context only: it never narrows a task read already
 * granted by the current role node.
 */
@Service
public class WorkspaceAuditAuthorizationService {
    private final WorkspaceAuditAuthorizationPersistence persistence;
    private final OrganizationTaskPathLookup taskPaths;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceAuditAuthorizationService(
            WorkspaceAuditAuthorizationPersistence persistence, OrganizationTaskPathLookup taskPaths) {
        this.persistence = persistence;
        this.taskPaths = taskPaths;
    }

    public WorkspaceAuditAuthorizationService(
            org.springframework.jdbc.core.JdbcTemplate jdbc, OrganizationTaskPathLookup taskPaths) {
        this(new WorkspaceAuditAuthorizationPersistence(jdbc), taskPaths);
    }

    @Transactional(readOnly = true)
    public void requireGroupHost(WorkspaceSessionReadback session) {
        Assignment assignment = requireCurrentAssignment(session);
        if (!ServiceNodeTypes.GROUP.equals(assignment.nodeType())) denyAccess();
        requireScope(session, assignment, ServiceNodeTypes.GROUP, assignment.nodeId());
    }

    @Transactional(readOnly = true)
    public void requireScopedHost(WorkspaceSessionReadback session, String targetType, UUID targetId) {
        Assignment assignment = requireCurrentAssignment(session);
        requireScope(session, assignment, targetType, targetId);
    }

    @Transactional(readOnly = true)
    public void requireWorkspaceSubject(WorkspaceSessionReadback session, String entityType, UUID subjectId) {
        Assignment actor = requireCurrentAssignment(session);
        List<WorkspaceAuditAuthorizationPersistence.SubjectTarget> rows =
                persistence.subjectTargets(entityType, subjectId, session.workspaceUuid(), session.groupWorkspaceKey());
        List<SubjectTarget> targets = rows.stream()
                .map(row -> new SubjectTarget(row.targetType(), row.targetId()))
                .toList();
        if (targets.isEmpty()) denyAccess();
        boolean allowed = "WORKSPACE_INVITATION".equals(entityType)
                ? targets.stream().allMatch(target -> isScopeAllowed(session, actor, target))
                : targets.stream().anyMatch(target -> isScopeAllowed(session, actor, target));
        if (!allowed) denyAccess();
    }

    private Assignment requireCurrentAssignment(WorkspaceSessionReadback session) {
        if (session == null || session.currentAssignmentId() == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAuditAuthorizationPersistence.Assignment assignment = persistence.assignment(
                session.currentAssignmentId(),
                session.accountId(),
                session.workspaceUuid(),
                session.groupWorkspaceKey());
        if (assignment == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        return new Assignment(assignment.nodeType(), assignment.nodeId());
    }

    private void requireScope(
            WorkspaceSessionReadback session, Assignment assignment, String targetType, UUID targetId) {
        if (!isScopeAllowed(session, assignment, new SubjectTarget(targetType, targetId))) denyAccess();
    }

    private boolean isScopeAllowed(WorkspaceSessionReadback session, Assignment assignment, SubjectTarget target) {
        if (target.targetType() == null || target.targetId() == null) return false;
        try {
            var taskPath = taskPaths.requireTaskPath(
                    session.workspaceUuid(), session.groupWorkspaceKey(), target.targetType(), target.targetId());
            return taskPaths.isScopeAllowed(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    assignment.nodeType(),
                    assignment.nodeId(),
                    taskPath);
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private static void denyAccess() {
        throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
    }

    static record Assignment(String nodeType, UUID nodeId) {}

    static record SubjectTarget(String targetType, UUID targetId) {}
}
