package com.catering.v2s.workspace.iam.application.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace audit authorization subject reads. */
@Repository
public class WorkspaceAuditAuthorizationPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceAuditAuthorizationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<SubjectTarget> subjectTargets(
            String entityType, UUID subjectId, UUID workspaceUuid, String groupWorkspaceKey) {
        return switch (entityType) {
            case "WORKSPACE_ACCOUNT" -> jdbc.query(
                    WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_SELECT_TARGET_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_ROLE_ASSIGNMENT_TARGET
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_WHERE_TARGET_ACCOUNT_ID_WORKSPACE_UUID
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_TARGET_GROUP_WORKSPACE_KEY
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_CONDITION_TARGET_STATUS_ACTIVE,
                    (row, index) -> new SubjectTarget(row.getString(1), row.getObject(2, UUID.class)),
                    subjectId,
                    workspaceUuid,
                    groupWorkspaceKey);
            case "WORKSPACE_INVITATION" -> jdbc.query(
                    WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_SELECT_INVITATION_TARGET_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_INVITATION
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_JOIN_INVITATION_ASSIGNMENT_INTENT_TARGET
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_TARGET_INVITATION_ID_INVITATION
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_WHERE_INVITATION_WORKSPACE_UUID
                            + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_INVITATION_GROUP_WORKSPACE_KEY,
                    (row, index) -> new SubjectTarget(row.getString(1), row.getObject(2, UUID.class)),
                    subjectId,
                    workspaceUuid,
                    groupWorkspaceKey);
            default -> throw new IllegalArgumentException("unsupported workspace audit subject");
        };
    }

    public Assignment assignment(
            UUID assignmentId, UUID accountId, UUID workspaceUuid, String groupWorkspaceKey) {
        List<Assignment> assignments = jdbc.query(
                WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_SELECT_ASSIGNMENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                        + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_FROM_CLAUSE_ROLE_ASSIGNMENT_ASSIGNMENT
                        + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_JOIN_WORKSPACE_ROLE_ROLE_ASSIGNMENT_ROLE_ID
                        + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_WHERE_ASSIGNMENT_ACCOUNT_ID_WORKSPACE_UUID
                        + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_CONDITION_ASSIGNMENT_GROUP_WORKSPACE_KEY_STATUS_ACTIVE
                        + WorkspaceAuditAuthorizationServiceSql.WORKSPACE_AUDIT_AUTHORIZATION_SERVICE_CONDITION_ROLE_STATUS_ENABLED,
                (row, index) -> new Assignment(row.getString(1), row.getObject(2, UUID.class)),
                assignmentId,
                accountId,
                workspaceUuid,
                groupWorkspaceKey);
        return assignments.size() == 1 ? assignments.getFirst() : null;
    }

    public record Assignment(String nodeType, UUID nodeId) {}

    public record SubjectTarget(String targetType, UUID targetId) {}
}
