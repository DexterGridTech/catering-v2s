package com.catering.v2s.storeterminal.persistence;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup.VisibleOrganizationFacts;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import java.sql.Array;
import java.sql.SQLException;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** JDBC boundary for the store-terminal-owned audit table. */
@Repository
public class StoreTerminalAuditHistoryPersistence {
    private final JdbcTemplate jdbc;

    public StoreTerminalAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AuditHistoryPage readOperationsAuditProjection(
            AuditReadScope scope,
            VisibleOrganizationFacts visibleFacts,
            AuditTarget target,
            UUID terminalRef,
            long page,
            long pageSize) {
        long offset = Math.multiplyExact(page - 1, pageSize);
        AuditHistoryResultSetReader.AuthorizedProjection projection = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> jdbc.query(
                        StoreTerminalAuditHistoryServiceSql.STORE_TERMINAL_AUDIT_HISTORY_AUTHORIZED_TARGET,
                        statement -> {
                            statement.setObject(1, terminalRef);
                            statement.setObject(2, scope.workspaceUuid());
                            statement.setString(3, scope.groupWorkspaceKey());
                            statement.setArray(4, visibleStoreIds(statement, visibleFacts));
                            statement.setObject(5, scope.workspaceUuid());
                            statement.setString(6, scope.groupWorkspaceKey());
                            statement.setString(7, target.entityRef());
                            statement.setLong(8, pageSize);
                            statement.setLong(9, offset);
                        },
                        AuditHistoryResultSetReader::readAuthorized));
        if (!projection.found()) {
            throw new com.catering.v2s.storeterminal.application.StoreTerminalAuditHistoryService
                    .TerminalNotFoundException();
        }
        if (!projection.authorized()) {
            throw new com.catering.v2s.storeterminal.application.StoreTerminalAuditHistoryService
                    .TerminalAuthorizationException();
        }
        return new AuditHistoryPage(projection.items(), page, pageSize, projection.total());
    }

    private static Array visibleStoreIds(java.sql.PreparedStatement statement, VisibleOrganizationFacts facts)
            throws SQLException {
        UUID[] storeIds = facts.candidates().stream()
                .filter(candidate -> "STORE".equals(candidate.dataNodeType()))
                .map(candidate -> candidate.dataNodeId())
                .toArray(UUID[]::new);
        return statement.getConnection().createArrayOf("uuid", storeIds);
    }
}
