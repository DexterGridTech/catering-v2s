package com.catering.v2s.salesmenu.infrastructure;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScheduleKind;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC implementation of the sales-menu owner persistence boundary. */
@Repository
public class JdbcSalesMenuRepository implements SalesMenuRepository {
    private final JdbcTemplate jdbc;

    public JdbcSalesMenuRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<SalesMenuAggregate> find(SalesMenuTarget target) {
        return find(target, false);
    }

    @Override
    public Optional<SalesMenuAggregate> findForUpdate(SalesMenuTarget target) {
        return find(target, true);
    }

    private Optional<SalesMenuAggregate> find(SalesMenuTarget target, boolean lock) {
        String sql = "SELECT c.collection_ref,c.workspace_uuid,c.group_workspace_key,c.store_ref,c.name,"
                + "c.archived_at_epoch_millis,c.version,c.current_draft_version_ref,c.latest_published_version_ref,"
                + "d.revision draft_revision,d.schedule_kind draft_schedule_kind,d.schedule_start_local_time "
                + "draft_start,d.schedule_end_local_time draft_end,p.revision published_revision,"
                + "publication.source_draft_revision latest_published_source_draft_revision,"
                + "p.schedule_kind published_schedule_kind,p.schedule_start_local_time published_start,"
                + "p.schedule_end_local_time published_end "
                + "FROM sales_menu.sales_collection c "
                + "JOIN sales_menu.sales_collection_version d ON d.version_ref=c.current_draft_version_ref "
                + "AND d.collection_ref=c.collection_ref "
                + "LEFT JOIN sales_menu.sales_collection_version p ON p.version_ref=c.latest_published_version_ref "
                + "AND p.collection_ref=c.collection_ref "
                + "LEFT JOIN sales_menu.sales_publication publication "
                + "ON publication.published_version_ref=p.version_ref "
                + "AND publication.collection_ref=c.collection_ref "
                + "WHERE c.collection_ref=? AND c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_ref=?"
                // The published version is an optional LEFT JOIN. Lock only the owning collection row;
                // PostgreSQL rejects an unqualified FOR UPDATE when the query contains a nullable join.
                + (lock ? " FOR UPDATE OF c" : "");
        List<AggregateRow> rows = jdbc.query(
                sql,
                JdbcSalesMenuRepository::aggregateRow,
                target.salesMenuRef(),
                target.scope().workspaceUuid(),
                target.scope().groupWorkspaceKey(),
                target.scope().storeRef());
        return rows.stream().findFirst().map(JdbcSalesMenuRepository::aggregate);
    }

    @Override
    public boolean compareAndSetVersion(SalesMenuTarget target, long expectedVersion) {
        return jdbc.update(
                        "UPDATE sales_menu.sales_collection SET version=version+1 WHERE collection_ref=? "
                                + "AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND version=?",
                        target.salesMenuRef(),
                        target.scope().workspaceUuid(),
                        target.scope().groupWorkspaceKey(),
                        target.scope().storeRef(),
                        expectedVersion)
                == 1;
    }

    @Override
    public void lockCommandReceipt(UUID workspaceUuid, String operationId, String idempotencyKey) {
        AdvisoryLock.acquire(jdbc, "sales-menu-receipt", workspaceUuid + ":" + operationId, idempotencyKey);
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... arguments) {
        return jdbc.query(sql, rowMapper, arguments);
    }

    @Override
    public int update(String sql, Object... arguments) {
        return jdbc.update(sql, arguments);
    }

    private static AggregateRow aggregateRow(ResultSet result, int ignored) throws SQLException {
        return new AggregateRow(
                result.getObject("collection_ref", UUID.class),
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("store_ref", UUID.class),
                result.getString("name"),
                result.getObject("archived_at_epoch_millis", Long.class),
                result.getLong("version"),
                result.getObject("draft_revision", Long.class),
                result.getObject("published_revision", Long.class),
                result.getObject("latest_published_source_draft_revision", Long.class),
                result.getString("draft_schedule_kind"),
                localTime(result.getTime("draft_start")),
                localTime(result.getTime("draft_end")),
                result.getString("published_schedule_kind"),
                localTime(result.getTime("published_start")),
                localTime(result.getTime("published_end")));
    }

    private static SalesMenuAggregate aggregate(AggregateRow row) {
        SalesMenuScope scope = new SalesMenuScope(row.workspaceUuid(), row.groupWorkspaceKey(), row.storeRef());
        return new SalesMenuAggregate(
                row.collectionRef(),
                scope,
                row.name(),
                row.archivedAtEpochMillis() != null,
                row.version(),
                row.draftRevision(),
                row.publishedRevision(),
                row.latestPublishedSourceDraftRevision(),
                schedule(row.draftScheduleKind(), row.draftStart(), row.draftEnd()),
                row.publishedScheduleKind() == null
                        ? null
                        : schedule(row.publishedScheduleKind(), row.publishedStart(), row.publishedEnd()));
    }

    private static SalesMenuSchedule schedule(String kindValue, LocalTime startValue, LocalTime endValue) {
        SalesMenuScheduleKind kind = SalesMenuScheduleKind.valueOf(kindValue);
        if (kind == SalesMenuScheduleKind.ALL_DAY) return SalesMenuSchedule.allDay();
        return SalesMenuSchedule.daily(startValue, endValue);
    }

    private static LocalTime localTime(Time value) {
        return value == null ? null : value.toLocalTime();
    }

    private record AggregateRow(
            UUID collectionRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            String name,
            Long archivedAtEpochMillis,
            long version,
            Long draftRevision,
            Long publishedRevision,
            Long latestPublishedSourceDraftRevision,
            String draftScheduleKind,
            LocalTime draftStart,
            LocalTime draftEnd,
            String publishedScheduleKind,
            LocalTime publishedStart,
            LocalTime publishedEnd) {}
}
