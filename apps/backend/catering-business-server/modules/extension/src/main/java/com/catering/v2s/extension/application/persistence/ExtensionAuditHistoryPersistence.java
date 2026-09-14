package com.catering.v2s.extension.application.persistence;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence execution boundary for extension-definition audit projections. */
@Repository
public class ExtensionAuditHistoryPersistence {
    private final JdbcTemplate jdbc;

    public ExtensionAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean targetExists(String groupWorkspaceKey, String entityType) {
        return Boolean.TRUE.equals(jdbc.query(
                ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_SELECT_EXTENSION_DEFINITION_GROUP_WORKSPACE_KEY + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CONTINUATION_ENTITY_TYPE,
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, entityType);
                },
                result -> result.next() && result.getBoolean(1)));
    }

    public long countEvents(AuditReadScope scope, AuditTarget target) {
        return jdbc.queryForObject(
                ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CONTINUATION_ENTITY_TYPE_EXTENSION_DEFINITION_ENTITY_REF_TEXT,
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityRef());
    }

    public List<AuditHistoryItem> readPage(AuditReadScope scope, AuditTarget target, long pageSize, long offset) {
        return jdbc.query(
                ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS
                        + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CONTINUATION_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID
                        + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY
                        + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CONDITION_ENTITY_TYPE_EXTENSION_DEFINITION_ENTITY_REF_TEXT
                        + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS
                        + ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_DESC_DIRECTION_DESC_ID_DESC_LIMIT_OFFSET,
                (result, ignored) -> new AuditHistoryItem(
                        result.getObject("id", UUID.class),
                        result.getLong("occurred_at_epoch_millis"),
                        result.getString("actor_display_snapshot"),
                        result.getString("action"),
                        new AuditTarget(result.getString("entity_type"), result.getString("entity_ref_text")),
                        com.catering.v2s.audit.contract.AuditChangeJson.read(result.getString("changes_json"))),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityRef(),
                pageSize,
                offset);
    }

    public AuditHistoryResultSetReader.TargetProjection readExtensionDefinition(
            AuditReadScope scope, String entityType, long pageSize, long offset) {
        return jdbc.query(
                ExtensionAuditHistoryServiceSql.EXTENSION_AUDIT_HISTORY_SERVICE_CTE_LATERAL,
                statement -> {
                    statement.setString(1, scope.groupWorkspaceKey());
                    statement.setString(2, entityType);
                    statement.setObject(3, scope.workspaceUuid());
                    statement.setString(4, scope.groupWorkspaceKey());
                    statement.setString(5, entityType);
                    statement.setLong(6, pageSize);
                    statement.setLong(7, offset);
                },
                AuditHistoryResultSetReader::readTarget);
    }
}
