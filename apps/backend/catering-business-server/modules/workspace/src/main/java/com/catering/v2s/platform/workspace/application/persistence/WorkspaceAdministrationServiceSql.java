package com.catering.v2s.platform.workspace.application.persistence;

/** SQL text owned by WorkspaceAdministrationPersistence; B3 relocates text without changing execution. */
public final class WorkspaceAdministrationServiceSql {
    public static final String WORKSPACE_NAME_ORDER = "name_normalized";
    public static final String WORKSPACE_KEY_ORDER = "group_workspace_key";
    public static final String WORKSPACE_UPDATED_AT_ORDER = "updated_at_epoch_millis";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SQL_SPACE = " ";
    public static final String ORDER_BY_STABLE_SUFFIX = ", group_workspace_key ASC";
    public static final String CREATE = "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
            + "name_normalized, operations_title, logo_asset_ref, notes, status, revision, version, "
            + "created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) "
            + "VALUES "
            + "(?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, 1, ?, ?, ?)";
    public static final String PAGE_PREFIX = "SELECT workspace_uuid, group_workspace_key, name, operations_title, logo_asset_ref, notes, status, "
            + "status_changed_at_epoch_millis, version, created_at_epoch_millis, updated_at_epoch_millis, "
            + "count(*) OVER() AS total_count FROM platform_workspace.group_workspace WHERE (CAST(? AS "
            + "text) "
            + "IS NULL OR name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR group_workspace_key "
            + "= ?) "
            + "AND (CAST(? AS text) IS NULL OR operations_title ILIKE '%' || ? || '%') AND (CAST(? AS "
            + "text) IS "
            + "NULL OR status = ?) ORDER BY ";
    public static final String PAGE_SUFFIX = " LIMIT ? OFFSET ?";
    public static final String REQUIRE = "SELECT workspace_uuid, group_workspace_key, name, operations_title, logo_asset_ref, notes, status, "
            + "status_changed_at_epoch_millis, version, created_at_epoch_millis, updated_at_epoch_millis "
            + "FROM "
            + "platform_workspace.group_workspace WHERE group_workspace_key=?";
    public static final String STATUS = "SELECT status FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND "
            + "group_workspace_key=?";
    public static final String UPDATE = "UPDATE platform_workspace.group_workspace SET name=?, name_normalized=?, operations_title=?, notes=?, "
            + "logo_asset_ref=?, version=version+1, updated_at_epoch_millis=? WHERE group_workspace_key=? "
            + "AND version=? RETURNING id, workspace_uuid, group_workspace_key, name, operations_title, "
            + "logo_asset_ref, notes, status, status_changed_at_epoch_millis, version, "
            + "created_at_epoch_millis, updated_at_epoch_millis";
    public static final String TRANSITION_STATUS = "UPDATE platform_workspace.group_workspace SET status=?, version=version+1, updated_at_epoch_millis=?, "
            + "status_changed_at_epoch_millis=? WHERE group_workspace_key=? AND version=?";
    public static final String LEGACY_ID = "SELECT id FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND group_workspace_key=?";
    public static final String AUDIT = "INSERT INTO platform_workspace.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
            + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
            + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'GROUP_WORKSPACE', ?, ?, ?, ?, ?, "
            + "?, "
            + "CAST(? AS JSONB))";
}
