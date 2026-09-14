package com.catering.v2s.platform.iam.application.persistence;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for platform-admin audit-history projections. */
@Repository
public class PlatformIamAuditHistoryPersistence {
    private final JdbcTemplate jdbc;

    public PlatformIamAuditHistoryPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean administratorExists(String entityRef) {
        return Boolean.TRUE.equals(jdbc.query(
                PlatformIamAuditHistoryServiceSql.ADMIN_EXISTS,
                statement -> statement.setString(1, entityRef),
                result -> result.next() && result.getBoolean(1)));
    }

    public long countEvents(String entityRef) {
        return jdbc.queryForObject(PlatformIamAuditHistoryServiceSql.COUNT, Long.class, entityRef);
    }

    public List<AuditHistoryItem> readPage(String entityRef, long pageSize, long offset) {
        return jdbc.query(
                PlatformIamAuditHistoryServiceSql.PAGE,
                (result, rowNumber) -> new AuditHistoryItem(
                        result.getObject("id", UUID.class),
                        result.getLong("occurred_at_epoch_millis"),
                        result.getString("actor_display_snapshot"),
                        result.getString("action"),
                        new com.catering.v2s.audit.contract.AuditTarget(
                                result.getString("entity_type"), result.getString("entity_ref_text")),
                        com.catering.v2s.audit.contract.AuditChangeJson.read(result.getString("changes_json"))),
                entityRef,
                pageSize,
                offset);
    }

    public AuditHistoryResultSetReader.TargetProjection readTargetPage(
            String platformAdminId, long pageSize, long offset) {
        return jdbc.query(
                PlatformIamAuditHistoryServiceSql.TARGET_PAGE,
                statement -> {
                    statement.setString(1, platformAdminId);
                    statement.setString(2, platformAdminId);
                    statement.setLong(3, pageSize);
                    statement.setLong(4, offset);
                },
                AuditHistoryResultSetReader::readTarget);
    }
}
