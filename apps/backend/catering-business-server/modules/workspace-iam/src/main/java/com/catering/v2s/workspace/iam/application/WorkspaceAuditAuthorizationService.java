package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workspace-IAM-owned task authorization for the operations audit modal.
 *
 * <p>The audit modal is a read-only child of an already approved host detail. It therefore has no
 * independent action capability. Page entry is checked independently, while assignment and
 * selected-data-node scope are re-read from owner facts on every request.
 */
@Service
public class WorkspaceAuditAuthorizationService {
    private final JdbcTemplate jdbc;
    private final OrganizationNodeLookup nodes;
    private final StoreAssignmentLookup enterableStores;
    private final StoreContractLookup stores;

    public WorkspaceAuditAuthorizationService(
        JdbcTemplate jdbc,
        OrganizationNodeLookup nodes,
        StoreAssignmentLookup enterableStores,
        StoreContractLookup stores
    ) {
        this.jdbc = jdbc;
        this.nodes = nodes;
        this.enterableStores = enterableStores;
        this.stores = stores;
    }

    @Transactional(readOnly = true)
    public void requireGroupHost(WorkspaceSessionReadback session, String requiredPageKey) {
        Assignment assignment = requireCurrentAssignment(session);
        requirePage(session, requiredPageKey);
        if (!"GROUP".equals(assignment.nodeType())) deny();
    }

    @Transactional(readOnly = true)
    public void requireScopedHost(
        WorkspaceSessionReadback session,
        String requiredPageKey,
        UUID targetHierarchyNodeId,
        UUID targetStoreId
    ) {
        Assignment assignment = requireCurrentAssignment(session);
        requirePage(session, requiredPageKey);
        if (session.visibleDataNodeId() == null) deny();

        ScopePoint visible = scopePoint(session, session.visibleDataNodeId());
        ScopePoint target = targetStoreId == null
            ? nodePoint(session, targetHierarchyNodeId)
            : storePoint(session, targetStoreId);
        if (!contains(session, assignment, visible) || !contains(session, visible, target)) deny();
    }

    @Transactional(readOnly = true)
    public void requireWorkspaceSubject(
        WorkspaceSessionReadback session,
        String entityType,
        UUID subjectId
    ) {
        Assignment actor = requireCurrentAssignment(session);
        String requiredPageKey = WorkspaceAuthorizationCatalog.userManagementPageForTargetType(actor.nodeType()).orElse(null);
        if (requiredPageKey == null) deny();
        requirePage(session, requiredPageKey);

        String relation = switch (entityType) {
            case "WORKSPACE_ACCOUNT" ->
                "SELECT EXISTS(SELECT 1 FROM workspace_iam.role_assignment target "
                    + "WHERE target.account_id=? AND target.workspace_uuid=? AND target.group_workspace_key=? "
                    + "AND target.status='ACTIVE' AND target.service_node_type=? AND target.service_node_id=?)";
            case "WORKSPACE_INVITATION" ->
                "SELECT EXISTS(SELECT 1 FROM workspace_iam.invitation invitation "
                    + "JOIN workspace_iam.invitation_assignment_intent target ON target.invitation_id=invitation.id "
                    + "WHERE invitation.id=? AND invitation.workspace_uuid=? AND invitation.group_workspace_key=? "
                    + "AND target.service_node_type=? AND target.service_node_id=?)";
            default -> throw new IllegalArgumentException("unsupported workspace audit subject");
        };
        Boolean visible = jdbc.query(
            relation,
            statement -> {
                statement.setObject(1, subjectId);
                statement.setObject(2, session.workspaceUuid());
                statement.setString(3, session.groupWorkspaceKey());
                statement.setString(4, actor.nodeType());
                statement.setObject(5, actor.nodeId());
            },
            result -> result.next() && result.getBoolean(1)
        );
        if (!Boolean.TRUE.equals(visible)) deny();
    }

    private Assignment requireCurrentAssignment(WorkspaceSessionReadback session) {
        if (session == null || session.currentAssignmentId() == null) deny();
        return jdbc.query(
            "SELECT assignment.service_node_type, assignment.service_node_id "
                + "FROM workspace_iam.role_assignment assignment "
                + "JOIN workspace_iam.workspace_role role ON role.id=assignment.role_id "
                + "WHERE assignment.id=? AND assignment.account_id=? AND assignment.workspace_uuid=? "
                + "AND assignment.group_workspace_key=? AND assignment.status='ACTIVE' "
                + "AND role.status='ENABLED'",
            statement -> {
                statement.setObject(1, session.currentAssignmentId());
                statement.setObject(2, session.accountId());
                statement.setObject(3, session.workspaceUuid());
                statement.setString(4, session.groupWorkspaceKey());
            },
            result -> {
                if (!result.next()) {
                    deny();
                    return null;
                }
                return new Assignment(result.getString(1), result.getObject(2, UUID.class));
            }
        );
    }

    private static void requirePage(WorkspaceSessionReadback session, String requiredPageKey) {
        if (requiredPageKey == null || session.pageAccessKeys() == null
            || !session.pageAccessKeys().contains(requiredPageKey)) deny();
    }

    private ScopePoint scopePoint(WorkspaceSessionReadback session, UUID id) {
        if (enterableStores.isEnterableStore(
            session.workspaceUuid(), session.groupWorkspaceKey(), id
        )) {
            return storePoint(session, id);
        }
        return nodePoint(session, id);
    }

    private ScopePoint storePoint(WorkspaceSessionReadback session, UUID storeId) {
        var context = stores.requireStoreContractContext(
            session.workspaceUuid(), session.groupWorkspaceKey(), storeId
        );
        return new ScopePoint("STORE", storeId, context.projectId());
    }

    private ScopePoint nodePoint(WorkspaceSessionReadback session, UUID nodeId) {
        if (nodeId == null) deny();
        OrganizationNodeReadback node = nodes.requireNode(
            session.workspaceUuid(), session.groupWorkspaceKey(), nodeId, null
        );
        if (!"ENABLED".equals(node.status())) deny();
        return new ScopePoint(node.nodeType(), node.id(), node.id());
    }

    private boolean contains(
        WorkspaceSessionReadback session,
        Assignment assignment,
        ScopePoint candidate
    ) {
        return switch (assignment.nodeType()) {
            case "GROUP" -> true;
            case "REGION" -> hierarchyContains(session, assignment.nodeId(), candidate.hierarchyNodeId());
            case "PROJECT" -> assignment.nodeId().equals(candidate.hierarchyNodeId());
            case "STORE" -> "STORE".equals(candidate.kind()) && assignment.nodeId().equals(candidate.id());
            case "HEAD_COMPANY" -> false;
            default -> false;
        };
    }

    private boolean contains(
        WorkspaceSessionReadback session,
        ScopePoint visible,
        ScopePoint target
    ) {
        if ("STORE".equals(visible.kind())) {
            return "STORE".equals(target.kind()) && visible.id().equals(target.id());
        }
        return hierarchyContains(session, visible.hierarchyNodeId(), target.hierarchyNodeId());
    }

    private boolean hierarchyContains(
        WorkspaceSessionReadback session,
        UUID ancestorId,
        UUID candidateId
    ) {
        UUID current = candidateId;
        while (current != null) {
            if (ancestorId.equals(current)) return true;
            OrganizationNodeReadback node = nodes.requireNode(
                session.workspaceUuid(), session.groupWorkspaceKey(), current, null
            );
            current = node.parentId();
        }
        return false;
    }

    private static void deny() {
        throw new WorkspaceAuthenticationService.SessionInvalidException();
    }

    private record Assignment(String nodeType, UUID nodeId) { }
    private record ScopePoint(String kind, UUID id, UUID hierarchyNodeId) { }
}
