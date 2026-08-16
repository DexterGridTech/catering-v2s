package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.asset.api.WorkspaceLogoAssetCommand;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPage;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Workspace owner command surface; R3 bigint identity remains transitional only. */
@Service
public class WorkspaceAdministrationService implements WorkspaceStatusLookup {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceLogoAssetCommand assets;
    private final WorkspaceCommandReceiptService receipts;
    private final WorkspaceIamSummaryLookup workspaceIam;

    public WorkspaceAdministrationService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceLogoAssetCommand assets,
            WorkspaceCommandReceiptService receipts,
            WorkspaceIamSummaryLookup workspaceIam) {
        this.jdbc = jdbc;
        this.time = time;
        this.assets = assets;
        this.receipts = receipts;
        this.workspaceIam = workspaceIam;
    }

    @Transactional
    public WorkspaceAdministrationReadback create(
            String key,
            String name,
            String operationsTitle,
            UUID logoAssetRef,
            String logoBindGrant,
            String notes,
            String idempotencyKey) {
        return create(
                key, name, operationsTitle, logoAssetRef, logoBindGrant, notes, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public WorkspaceAdministrationReadback create(
            String key,
            String name,
            String operationsTitle,
            UUID logoAssetRef,
            String logoBindGrant,
            String notes,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                key,
                idempotencyKey,
                canonical("create", key, name, operationsTitle, String.valueOf(logoAssetRef), notes),
                () -> createNew(key, name, operationsTitle, logoAssetRef, logoBindGrant, notes, actor));
    }

    private WorkspaceAdministrationReadback createNew(
            String key,
            String name,
            String operationsTitle,
            UUID logoAssetRef,
            String logoBindGrant,
            String notes,
            AuditActor actor) {
        String normalizedKey = requiredKey(key);
        String normalizedName = requiredName(name);
        long now = time.currentEpochMillis();
        UUID workspaceUuid = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                            + "name_normalized, operations_title, logo_asset_ref, notes, status, revision, version, "
                            + "created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) "
                            + "VALUES "
                            + "(?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, 1, ?, ?, ?)",
                    workspaceUuid,
                    normalizedKey,
                    name.trim(),
                    normalizedName,
                    requiredTitle(operationsTitle, name),
                    requiredLogo(logoAssetRef).toString(),
                    optionalNotes(notes),
                    now,
                    now,
                    now);
        } catch (DuplicateKeyException exception) {
            throw new WorkspaceConflictException(exception);
        }
        assets.claim(logoAssetRef, workspaceUuid, normalizedKey, requiredGrant(logoBindGrant));
        WorkspaceAdministrationReadback created = require(normalizedKey);
        audit(
                created,
                "GROUP_WORKSPACE_CREATED",
                now,
                actor,
                "[{\"fieldKey\":\"groupWorkspaceKey\",\"after\":\"" + json(created.groupWorkspaceKey())
                        + "\"},{\"fieldKey\":\"name\",\"after\":\"" + json(created.name())
                        + "\"},{\"fieldKey\":\"operationsTitle\",\"after\":\"" + json(created.operationsTitle())
                        + "\"},{\"fieldKey\":\"logo\",\"after\":\"已配置\"}"
                        + (created.notes() == null
                                ? "]"
                                : ",{\"fieldKey\":\"notes\",\"after\":\"" + json(created.notes()) + "\"}]"));
        return created;
    }

    @Transactional(readOnly = true)
    public WorkspaceAdministrationPage list(WorkspaceAdministrationPageRequest request) {
        String orderBy = orderBy(request.sortKey(), request.sortDirection());
        List<PageRow> rows = jdbc.query(
                "SELECT workspace_uuid, group_workspace_key, name, operations_title, logo_asset_ref, notes, status, "
                        + "status_changed_at_epoch_millis, version, created_at_epoch_millis, updated_at_epoch_millis, "
                        + "count(*) OVER() AS total_count FROM platform_workspace.group_workspace WHERE (CAST(? AS "
                        + "text) "
                        + "IS NULL OR name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR group_workspace_key "
                        + "= ?) "
                        + "AND (CAST(? AS text) IS NULL OR operations_title ILIKE '%' || ? || '%') AND (CAST(? AS "
                        + "text) IS "
                        + "NULL OR status = ?) ORDER BY "
                        + orderBy + " LIMIT ? OFFSET ?",
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
        List<WorkspaceAdministrationReadback> items =
                rows.stream().map(PageRow::workspace).toList();
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        return new WorkspaceAdministrationPage(
                items, request.page(), request.pageSize(), total, request.sortKey(), request.sortDirection());
    }

    @Transactional(readOnly = true)
    public WorkspaceAdministrationReadback require(String key) {
        return jdbc.query(
                "SELECT workspace_uuid, group_workspace_key, name, operations_title, logo_asset_ref, notes, status, "
                        + "status_changed_at_epoch_millis, version, created_at_epoch_millis, updated_at_epoch_millis "
                        + "FROM "
                        + "platform_workspace.group_workspace WHERE group_workspace_key=?",
                statement -> statement.setString(1, requiredKey(key)),
                result -> {
                    if (!result.next()) throw new WorkspaceNotFoundException();
                    return map(result);
                });
    }

    /** Owner-checked selected-workspace boundary for every dependent task. */
    @Transactional(readOnly = true)
    public WorkspaceAdministrationReadback requireEnabled(String key) {
        WorkspaceAdministrationReadback workspace = require(key);
        if (!"ENABLED".equals(workspace.status())) throw new WorkspaceDisabledException();
        return workspace;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnabled(UUID workspaceUuid, String groupWorkspaceKey) {
        Boolean enabled = jdbc.query(
                "SELECT status='ENABLED' FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND "
                        + "group_workspace_key=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                },
                result -> result.next() && result.getBoolean(1));
        return Boolean.TRUE.equals(enabled);
    }

    @Transactional
    public WorkspaceAdministrationReadback updateDisplay(
            String key,
            String name,
            String operationsTitle,
            String notes,
            String logoIntent,
            UUID nextLogoAssetRef,
            String logoBindGrant,
            long expectedVersion,
            String idempotencyKey) {
        return updateDisplay(
                key,
                name,
                operationsTitle,
                notes,
                logoIntent,
                nextLogoAssetRef,
                logoBindGrant,
                expectedVersion,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public WorkspaceAdministrationReadback updateDisplay(
            String key,
            String name,
            String operationsTitle,
            String notes,
            String logoIntent,
            UUID nextLogoAssetRef,
            String logoBindGrant,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                key,
                idempotencyKey,
                canonical(
                        "updateDisplay",
                        key,
                        name,
                        operationsTitle,
                        notes,
                        logoIntent,
                        String.valueOf(nextLogoAssetRef),
                        String.valueOf(expectedVersion)),
                () -> updateDisplayNew(
                        key,
                        name,
                        operationsTitle,
                        notes,
                        logoIntent,
                        nextLogoAssetRef,
                        logoBindGrant,
                        expectedVersion,
                        actor));
    }

    private WorkspaceAdministrationReadback updateDisplayNew(
            String key,
            String name,
            String operationsTitle,
            String notes,
            String logoIntent,
            UUID nextLogoAssetRef,
            String logoBindGrant,
            long expectedVersion,
            AuditActor actor) {
        WorkspaceAdministrationReadback current = require(key);
        UUID previousLogoAssetRef = current.logoAssetRef() == null ? null : UUID.fromString(current.logoAssetRef());
        String resolvedIntent = requiredLogoIntent(logoIntent);
        UUID targetLogo =
                switch (resolvedIntent) {
                    case "KEEP" -> keepOrRemoveLogo(previousLogoAssetRef, nextLogoAssetRef, logoBindGrant, true);
                    case "REMOVE" -> keepOrRemoveLogo(null, nextLogoAssetRef, logoBindGrant, false);
                    case "REPLACE" -> requiredLogo(nextLogoAssetRef);
                    default -> throw new WorkspaceInputInvalidException();
                };
        if ("REPLACE".equals(resolvedIntent))
            assets.claim(
                    targetLogo, current.workspaceUuid(), current.groupWorkspaceKey(), requiredGrant(logoBindGrant));
        int changed = jdbc.update(
                "UPDATE platform_workspace.group_workspace SET name=?, name_normalized=?, operations_title=?, notes=?, "
                        + "logo_asset_ref=?, version=version+1, updated_at_epoch_millis=? WHERE group_workspace_key=? "
                        + "AND "
                        + "version=?",
                name.trim(),
                requiredName(name),
                requiredTitle(operationsTitle, name),
                optionalNotes(notes),
                targetLogo == null ? null : targetLogo.toString(),
                time.currentEpochMillis(),
                requiredKey(key),
                expectedVersion);
        if (changed == 0) throw new WorkspaceVersionConflictException();
        if (previousLogoAssetRef != null && !previousLogoAssetRef.equals(targetLogo))
            assets.release(previousLogoAssetRef, current.workspaceUuid());
        WorkspaceAdministrationReadback updated = require(key);
        audit(
                updated,
                "GROUP_WORKSPACE_UPDATED",
                time.currentEpochMillis(),
                actor,
                updateChanges(current, updated, resolvedIntent));
        return updated;
    }

    @Transactional
    public WorkspaceAdministrationReadback transitionStatus(
            String key, String status, long expectedVersion, String idempotencyKey) {
        return transitionStatus(key, status, expectedVersion, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public WorkspaceAdministrationReadback transitionStatus(
            String key, String status, long expectedVersion, String idempotencyKey, AuditActor actor) {
        return receipts.execute(
                key,
                idempotencyKey,
                canonical("transitionStatus", key, status, String.valueOf(expectedVersion)),
                () -> transitionStatusNew(key, status, expectedVersion, actor));
    }

    private WorkspaceAdministrationReadback transitionStatusNew(
            String key, String status, long expectedVersion, AuditActor actor) {
        if (!"ENABLED".equals(status) && !"DISABLED".equals(status)) throw new WorkspaceStatusInvalidException();
        long now = time.currentEpochMillis();
        int changed = jdbc.update(
                "UPDATE platform_workspace.group_workspace SET status=?, version=version+1, updated_at_epoch_millis=?, "
                        + "status_changed_at_epoch_millis=? WHERE group_workspace_key=? AND version=?",
                status,
                now,
                now,
                requiredKey(key),
                expectedVersion);
        if (changed == 0) throw new WorkspaceVersionConflictException();
        WorkspaceAdministrationReadback updated = require(key);
        audit(
                updated,
                "GROUP_WORKSPACE_STATUS_CHANGED",
                now,
                actor,
                "[{\"fieldKey\":\"status\",\"after\":\"" + json(updated.status()) + "\"}]");
        return updated;
    }

    @Transactional(readOnly = true)
    public long accountCount(UUID workspaceUuid) {
        return workspaceIam.accountCount(workspaceUuid);
    }

    @Transactional(readOnly = true)
    public long roleCount(UUID workspaceUuid) {
        return workspaceIam.roleCount(workspaceUuid);
    }

    private void audit(
            WorkspaceAdministrationReadback workspace,
            String action,
            long occurredAt,
            AuditActor actor,
            String changesJson) {
        Long legacyId = jdbc.queryForObject(
                "SELECT id FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND group_workspace_key=?",
                Long.class,
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey());
        jdbc.update(
                "INSERT INTO platform_workspace.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
                        + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                        + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'GROUP_WORKSPACE', ?, ?, ?, ?, ?, "
                        + "?, "
                        + "CAST(? AS JSONB))",
                UUID.randomUUID(),
                workspace.workspaceUuid(),
                workspace.groupWorkspaceKey(),
                String.valueOf(legacyId),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                occurredAt,
                AuditChangeJson.write(AuditChangeJson.read(changesJson)));
    }

    private static String updateChanges(
            WorkspaceAdministrationReadback before, WorkspaceAdministrationReadback after, String logoIntent) {
        List<String> changes = new ArrayList<>();
        if (!Objects.equals(before.name(), after.name())) changes.add(change("name", before.name(), after.name()));
        if (!Objects.equals(before.operationsTitle(), after.operationsTitle()))
            changes.add(change("operationsTitle", before.operationsTitle(), after.operationsTitle()));
        if (!Objects.equals(before.notes(), after.notes())) changes.add(change("notes", before.notes(), after.notes()));
        if (!Objects.equals(before.logoAssetRef(), after.logoAssetRef()))
            changes.add(change(
                    "logo",
                    before.logoAssetRef() == null ? "未配置" : "已配置",
                    after.logoAssetRef() == null ? "未配置" : "已配置"));
        if (changes.isEmpty() && "KEEP".equals(logoIntent)) return "[]";
        return "[" + String.join(",", changes) + "]";
    }

    private static String change(String field, String before, String after) {
        return "{\"fieldKey\":\"" + field + "\",\"before\":" + nullableJson(before) + ",\"after\":"
                + nullableJson(after) + "}";
    }

    private static String nullableJson(String value) {
        return value == null ? "null" : "\"" + json(value) + "\"";
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private static WorkspaceAdministrationReadback map(java.sql.ResultSet result) throws java.sql.SQLException {
        return map(result, false);
    }

    private static WorkspaceAdministrationReadback map(java.sql.ResultSet result, boolean commercialGroupInitialized)
            throws java.sql.SQLException {
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
                commercialGroupInitialized);
    }

    private record PageRow(WorkspaceAdministrationReadback workspace, long total) {}

    private static String orderBy(String sortKey, String sortDirection) {
        String column =
                switch (sortKey) {
                    case "NAME" -> "name_normalized";
                    case "WORKSPACE_KEY" -> "group_workspace_key";
                    case "UPDATED_AT" -> "updated_at_epoch_millis";
                    default -> throw new WorkspaceInputInvalidException();
                };
        return column + " " + sortDirection + ", group_workspace_key ASC";
    }

    private static UUID keepOrRemoveLogo(UUID value, UUID stagedAssetRef, String bindGrant, boolean keep) {
        if (stagedAssetRef != null || (bindGrant != null && !bindGrant.isBlank()))
            throw new WorkspaceInputInvalidException();
        return keep ? value : null;
    }

    private static String requiredKey(String value) {
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,63}"))
            throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String requiredName(String value) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > 200)
            throw new WorkspaceInputInvalidException();
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static String requiredTitle(String value, String name) {
        String result = value == null || value.isBlank() ? name : value.trim();
        if (result.length() > 120) throw new WorkspaceInputInvalidException();
        return result;
    }

    private static UUID requiredLogo(UUID value) {
        if (value == null) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String requiredGrant(String value) {
        if (value == null || value.length() < 32 || value.length() > 256) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String optionalNotes(String value) {
        if (value != null && value.length() > 500) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String requiredLogoIntent(String value) {
        if (!"KEEP".equals(value) && !"REPLACE".equals(value) && !"REMOVE".equals(value))
            throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String canonical(String operation, String... values) {
        StringBuilder result = new StringBuilder(operation);
        for (String value : values) {
            String safe = value == null ? "<null>" : value;
            result.append('|').append(safe.length()).append(':').append(safe);
        }
        return result.toString();
    }

    public static final class WorkspaceConflictException extends RuntimeException {
        public WorkspaceConflictException() {}

        public WorkspaceConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class WorkspaceNotFoundException extends RuntimeException {}

    public static final class WorkspaceDisabledException extends RuntimeException {}

    public static final class WorkspaceVersionConflictException extends RuntimeException {}

    public static final class WorkspaceStatusInvalidException extends RuntimeException {}

    public static final class WorkspaceInputInvalidException extends RuntimeException {}
}
