package com.catering.v2s.workspace.iam.application.persistence;

import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts;
import java.sql.Array;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed execution boundary for workspace-IAM audit history and authorized projections. */
@Repository
public class WorkspaceIamAuditHistoryPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public WorkspaceIamAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean targetExists(String entityType, String targetTable, String entityRef, AuditReadScope scope) {
        return Boolean.TRUE.equals(jdbc.query(
                WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_WORKSPACE_IAM_SELECT_EXISTS_SELECT_1_FROM_
                        + targetTable
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_WHERE_TEXT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setString(1, entityRef);
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                },
                result -> result.next() && result.getBoolean(1)));
    }

    public long countEvents(AuditReadScope scope, AuditTarget target) {
        return jdbc.queryForObject(
                WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_ENTITY_TYPE_ENTITY_REF_TEXT,
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityType(),
                target.entityRef());
    }

    public List<AuditHistoryItem> readPage(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        return jdbc.query(
                WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_GROUP_WORKSPACE_KEY_ENTITY_TYPE_ENTITY_REF_TEXT
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_DESC_DIRECTION_DESC_ID_DESC_LIMIT_OFFSET,
                (result, ignored) -> new AuditHistoryItem(
                        result.getObject("id", UUID.class),
                        result.getLong("occurred_at_epoch_millis"),
                        result.getString("actor_display_snapshot"),
                        result.getString("action"),
                        new AuditTarget(result.getString("entity_type"), result.getString("entity_ref_text")),
                        AuditChangeJson.read(result.getString("changes_json"))),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityType(),
                target.entityRef(),
                pageSize,
                (page - 1) * pageSize);
    }

    public AuditHistoryResultSetReader.TargetProjection readPlatformProjection(
            String entityRef, AuditReadScope scope, String entityType, String targetTable, long pageSize, long offset) {
        return jdbc.query(
                WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_CTE_LATERAL.formatted(
                        targetTable),
                statement -> {
                    statement.setString(1, entityRef);
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                    statement.setObject(4, scope.workspaceUuid());
                    statement.setString(5, scope.groupWorkspaceKey());
                    statement.setString(6, entityType);
                    statement.setString(7, entityRef);
                    statement.setLong(8, pageSize);
                    statement.setLong(9, offset);
                },
                AuditHistoryResultSetReader::readTarget);
    }

    public AuditHistoryResultSetReader.AuthorizedProjection readOperations(
            WorkspaceReadAuthorizationFacts facts, AuditTarget target, long pageSize, long offset) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        operationsSql(target.entityType()),
                        statement -> {
                            statement.setObject(1, uuid(target.entityRef()));
                            statement.setObject(2, facts.workspaceUuid());
                            statement.setString(3, facts.groupWorkspaceKey());
                            int index = 4;
                            if ("WORKSPACE_ACCOUNT".equals(target.entityType())) {
                                statement.setObject(index++, facts.workspaceUuid());
                                statement.setString(index++, facts.groupWorkspaceKey());
                            }
                            statement.setString(index++, facts.assignmentNodeType());
                            statement.setObject(index++, facts.assignmentNodeId());
                            statement.setArray(index++, uuidArray(statement, ids(facts, "REGION")));
                            statement.setArray(index++, uuidArray(statement, ids(facts, "PROJECT")));
                            statement.setArray(index++, uuidArray(statement, ids(facts, "HEAD_COMPANY")));
                            statement.setArray(index++, uuidArray(statement, ids(facts, "STORE")));
                            statement.setObject(index++, facts.workspaceUuid());
                            statement.setString(index++, facts.groupWorkspaceKey());
                            statement.setString(index++, target.entityType());
                            statement.setString(index++, target.entityRef());
                            statement.setLong(index++, pageSize);
                            statement.setLong(index, offset);
                        },
                        AuditHistoryResultSetReader::readAuthorized));
    }

    private static String operationsSql(String type) {
        boolean account = "WORKSPACE_ACCOUNT".equals(type);
        String table = account ? "workspace_account" : "invitation";
        String targets = account
                ? WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_ROLE_ASSIGNMENT
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_ASSIGNMENT_ACCOUNT_ID_SUBJECT_WORKSPACE_UUID
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_ASSIGNMENT_GROUP_WORKSPACE_KEY_STATUS_ACTIVE
                : WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_SELECT_INTENT_SERVICE_NODE_TYPE_SERVICE_NODE_ID
                        + WorkspaceIamAuditHistoryServiceSql
                                .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_INVITATION_ASSIGNMENT_INTENT;
        String allowed = WorkspaceIamAuditHistoryServiceSql.ALLOWED_TARGET_SCOPE;
        String authorization = account
                ? WorkspaceIamAuditHistoryServiceSql.AUTHORIZATION_EXISTS_PREFIX
                        + targets
                        + WorkspaceIamAuditHistoryServiceSql.AUTHORIZATION_EXISTS_SUFFIX
                        + allowed
                        + WorkspaceIamAuditHistoryServiceSql.SQL_CLOSE_PAREN
                : WorkspaceIamAuditHistoryServiceSql.AUTHORIZATION_NOT_EXISTS_PREFIX
                        + targets
                        + WorkspaceIamAuditHistoryServiceSql.AUTHORIZATION_NOT_EXISTS_SUFFIX
                        + allowed
                        + WorkspaceIamAuditHistoryServiceSql.SQL_CLOSE_PARENS;
        return WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_CTE_WORKSPACE_IAM_SUBJECT_ENTITY_INPUT_VALUE
                + table
                + WorkspaceIamAuditHistoryServiceSql.ENTITY_JOIN_SUFFIX
                + WorkspaceIamAuditHistoryServiceSql.AUTH_SCOPE_PREFIX
                + authorization
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_THEN_SUBJECT_AUTHORIZED_AUDIT_ROWS_EVENT_AUDIT_ID
                + WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_EVENT
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_EVENT_ENTITY_REF_TEXT_CHANGES_JSON_TEXT
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUDIT_EVENT_EVENT_FOUND
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_EVENT_WORKSPACE_UUID
                + WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUDIT_ROWS
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_OCCURRED_AT_EPOCH_MILLIS_AUDIT_ID_TOTAL_ROWS
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUDIT_ROWS_TOTAL_AUTH_SCOPE_FOUND
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE_AUTHORIZED_TOTAL_ROWS_TOTAL
                + WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_PAGE_ROWS
                + WorkspaceIamAuditHistoryServiceSql.WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_AUTH_SCOPE
                + WorkspaceIamAuditHistoryServiceSql
                        .WORKSPACE_IAM_AUDIT_HISTORY_SERVICE_JOIN_PAGE_ROWS_JOIN_TOTAL_ROWS_LEFT_JOIN_PA;
    }

    private static List<UUID> ids(WorkspaceReadAuthorizationFacts facts, String type) {
        return facts.visibleOrganizationFacts().candidates().stream()
                .filter(value -> type.equals(value.dataNodeType()))
                .map(value -> value.dataNodeId())
                .toList();
    }

    private static Array uuidArray(java.sql.PreparedStatement statement, List<UUID> values) throws SQLException {
        return statement.getConnection().createArrayOf("uuid", values.toArray(UUID[]::new));
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("operations audit target must be a UUID", invalid);
        }
    }
}
