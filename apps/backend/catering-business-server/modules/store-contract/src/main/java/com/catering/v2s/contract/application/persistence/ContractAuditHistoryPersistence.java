package com.catering.v2s.contract.application.persistence;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for store-contract audit projections. */
@Repository
public class ContractAuditHistoryPersistence {
    private final JdbcTemplate jdbc;

    public ContractAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AuditHistoryPage read(AuditReadScope scope, AuditTarget target, long page, long pageSize) {
        Boolean exists = jdbc.query(
                ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_SELECT_STORE_CONTRACT_TEXT_WORKSPACE_UUID
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setString(1, target.entityRef());
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                },
                result -> result.next() && result.getBoolean(1));
        if (!Boolean.TRUE.equals(exists))
            throw new com.catering.v2s.contract.application.ContractCommandService.ContractNotFoundException();
        long total = jdbc.queryForObject(
                ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_SELECT_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CONTINUATION_ENTITY_TYPE_STORE_CONTRACT_ENTITY_REF_TEXT,
                Long.class,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityRef());
        List<AuditHistoryItem> items = jdbc.query(
                ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_SELECT_OCCURRED_AT_EPOCH_MILLIS
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CONTINUATION_AUDIT_EVENT_CHANGES_JSON_TEXT_WORKSPACE_UUID
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CONDITION_ENTITY_TYPE
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_DESC_DIRECTION
                        + ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CONTINUATION_ID_DESC_LIMIT_OFFSET,
                (r, n) -> new AuditHistoryItem(
                        r.getObject("id", UUID.class),
                        r.getLong("occurred_at_epoch_millis"),
                        r.getString("actor_display_snapshot"),
                        r.getString("action"),
                        new AuditTarget(r.getString("entity_type"), r.getString("entity_ref_text")),
                        AuditChangeJson.read(r.getString("changes_json"))),
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                target.entityRef(),
                pageSize,
                (page - 1) * pageSize);
        return new AuditHistoryPage(items, page, pageSize, total);
    }

    public AuditHistoryPage readStoreContract(AuditReadScope scope, String contractId, long page, long pageSize) {
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.TargetProjection value = jdbc.query(
                ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CTE_LATERAL,
                statement -> {
                    statement.setString(1, contractId);
                    statement.setObject(2, scope.workspaceUuid());
                    statement.setString(3, scope.groupWorkspaceKey());
                    statement.setObject(4, scope.workspaceUuid());
                    statement.setString(5, scope.groupWorkspaceKey());
                    statement.setString(6, contractId);
                    statement.setLong(7, pageSize);
                    statement.setLong(8, offset);
                },
                AuditHistoryResultSetReader::readTarget);
        if (!value.targetExists())
            throw new com.catering.v2s.contract.application.ContractCommandService.ContractNotFoundException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }

    public AuditHistoryPage readOperationsAuditProjection(
            AuditReadScope scope, VisibleOrganizationFacts visibleFacts, AuditTarget target, UUID contractId,
            long page, long pageSize) {
        AuditHistoryResultSetReader.AuthorizedProjection value = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        ContractAuditHistoryServiceSql.CONTRACT_AUDIT_HISTORY_SERVICE_CTE_LATERAL_STORE_ID_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_FOUND,
                        statement -> {
                            statement.setObject(1, contractId);
                            statement.setObject(2, scope.workspaceUuid());
                            statement.setString(3, scope.groupWorkspaceKey());
                            statement.setArray(4, storeIds(statement, visibleFacts));
                            statement.setObject(5, scope.workspaceUuid());
                            statement.setString(6, scope.groupWorkspaceKey());
                            statement.setString(7, target.entityRef());
                            statement.setLong(8, pageSize);
                            statement.setLong(9, Math.multiplyExact(page - 1, pageSize));
                        },
                        AuditHistoryResultSetReader::readAuthorized));
        if (!value.found())
            throw new com.catering.v2s.contract.application.ContractCommandService.ContractNotFoundException();
        if (!value.authorized())
            throw new com.catering.v2s.contract.application.ContractCommandService.ContractAuthorizationException();
        return new AuditHistoryPage(value.items(), page, pageSize, value.total());
    }

    private static Array storeIds(java.sql.PreparedStatement statement, VisibleOrganizationFacts facts)
            throws SQLException {
        return statement
                .getConnection()
                .createArrayOf(
                        "uuid",
                        facts.candidates().stream()
                                .filter(value -> "STORE".equals(value.dataNodeType()))
                                .map(value -> value.dataNodeId())
                                .toArray(UUID[]::new));
    }
}
