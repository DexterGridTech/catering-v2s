package com.catering.v2s.platform.workspace.application.persistence;

import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution for platform workspace administration facts. */
@Repository
public class WorkspaceAdministrationPersistence {
    private final JdbcTemplate jdbc;

    public WorkspaceAdministrationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record PageResult(List<WorkspaceAdministrationReadback> items, long total) {}

    public record UpdateResult(long legacyId, WorkspaceAdministrationReadback readback) {}

    public void create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String displayName,
            String normalizedName,
            String operationsTitle,
            String logoAssetRef,
            String notes,
            long now) {
        jdbc.update(
                WorkspaceAdministrationServiceSql.CREATE,
                workspaceUuid,
                groupWorkspaceKey,
                displayName,
                normalizedName,
                operationsTitle,
                logoAssetRef,
                notes,
                now,
                now,
                now);
    }

    public PageResult page(WorkspaceAdministrationPageRequest request) {
        String orderBy = orderBy(request.sortKey(), request.sortDirection());
        List<PageRow> rows = jdbc.query(
                WorkspaceAdministrationServiceSql.PAGE_PREFIX + orderBy + WorkspaceAdministrationServiceSql.PAGE_SUFFIX,
                (result, row) -> new PageRow(map(result), result.getLong("total_count")),
                request.name(),
                request.name(),
                request.groupWorkspaceKey(),
                request.groupWorkspaceKey(),
                request.operationsTitle(),
                request.operationsTitle(),
                request.status(),
                request.status(),
                request.pageSize(),
                request.offset());
        List<WorkspaceAdministrationReadback> items = rows.stream().map(PageRow::workspace).toList();
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        return new PageResult(items, total);
    }

    public Optional<WorkspaceAdministrationReadback> findByKey(String groupWorkspaceKey) {
        return Optional.ofNullable(jdbc.query(
                WorkspaceAdministrationServiceSql.REQUIRE,
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> result.next() ? map(result) : null));
    }

    public Optional<String> findStatus(UUID workspaceUuid, String groupWorkspaceKey) {
        return Optional.ofNullable(jdbc.query(
                WorkspaceAdministrationServiceSql.STATUS,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                },
                result -> result.next() ? result.getString(1) : null));
    }

    public Optional<UpdateResult> updateDisplay(
            String displayName,
            String normalizedName,
            String operationsTitle,
            String notes,
            String logoAssetRef,
            long now,
            String groupWorkspaceKey,
            long expectedVersion) {
        List<UpdateResult> rows = jdbc.query(
                WorkspaceAdministrationServiceSql.UPDATE,
                (result, row) -> new UpdateResult(result.getLong("id"), map(result)),
                displayName,
                normalizedName,
                operationsTitle,
                notes,
                logoAssetRef,
                now,
                groupWorkspaceKey,
                expectedVersion);
        return rows.stream().findFirst();
    }

    public int transitionStatus(
            String status, long now, String groupWorkspaceKey, long expectedVersion) {
        return jdbc.update(
                WorkspaceAdministrationServiceSql.TRANSITION_STATUS,
                status,
                now,
                now,
                groupWorkspaceKey,
                expectedVersion);
    }

    public Long findLegacyId(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.queryForObject(
                WorkspaceAdministrationServiceSql.LEGACY_ID,
                Long.class,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public void insertAudit(
            UUID eventId,
            WorkspaceAdministrationReadback workspace,
            long legacyId,
            String action,
            com.catering.v2s.audit.contract.AuditActor actor,
            long occurredAt,
            String changesJson) {
        jdbc.update(
                WorkspaceAdministrationServiceSql.AUDIT,
                eventId,
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey(),
                String.valueOf(legacyId),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                occurredAt,
                changesJson);
    }

    private static WorkspaceAdministrationReadback map(ResultSet result) throws SQLException {
        return new WorkspaceAdministrationReadback(
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getString("name"),
                result.getString("operations_title"),
                result.getString("logo_asset_ref"),
                result.getString("notes"),
                result.getString("status"),
                result.getLong("status_changed_at_epoch_millis"),
                result.getLong("version"),
                result.getLong("created_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"),
                false);
    }

    private static String orderBy(String sortKey, String sortDirection) {
        String column =
                switch (sortKey) {
                    case "NAME" -> WorkspaceAdministrationServiceSql.WORKSPACE_NAME_ORDER;
                    case "WORKSPACE_KEY" -> WorkspaceAdministrationServiceSql.WORKSPACE_KEY_ORDER;
                    case "UPDATED_AT" -> WorkspaceAdministrationServiceSql.WORKSPACE_UPDATED_AT_ORDER;
                    default -> throw new IllegalArgumentException("invalid workspace sort key");
                };
        return column + WorkspaceAdministrationServiceSql.SQL_SPACE + sortDirection
                + WorkspaceAdministrationServiceSql.ORDER_BY_STABLE_SUFFIX;
    }

    private record PageRow(WorkspaceAdministrationReadback workspace, long total) {}
}
