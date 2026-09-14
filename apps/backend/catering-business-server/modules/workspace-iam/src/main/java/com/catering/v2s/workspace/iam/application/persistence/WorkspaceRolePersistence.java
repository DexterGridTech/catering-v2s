package com.catering.v2s.workspace.iam.application.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for workspace role commands and owner-local reads. */
@Repository
public class WorkspaceRolePersistence {
    private final JdbcTemplate jdbc;

    public WorkspaceRolePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int insert(
            UUID roleId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String serviceNodeType,
            String description,
            long createdAt,
            long updatedAt,
            String pageAccessKeysJson,
            String actionCapabilityKeysJson) {
        return jdbc.update(
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_INSERT_INTO_WORKSPACE_ROLE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_SERVICE_NODE_TYPE_DESCRIPTION_STATUS_VERSION
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_PAGE_ACCESS_KEYS_CAPABILITY_KEYS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_ENABLED,
                roleId,
                workspaceUuid,
                groupWorkspaceKey,
                name,
                serviceNodeType,
                description,
                createdAt,
                updatedAt,
                pageAccessKeysJson,
                actionCapabilityKeysJson);
    }

    public int update(
            String name,
            String description,
            String pageAccessKeysJson,
            String actionCapabilityKeysJson,
            long now,
            UUID roleId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            long expectedVersion) {
        return jdbc.update(
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_UPDATE_WORKSPACE_ROLE_NAME_DESCRIPTION_PAGE_ACCESS_KEYS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_CAPABILITY_KEYS_VERSION
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                name,
                description,
                pageAccessKeysJson,
                actionCapabilityKeysJson,
                now,
                roleId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public int transitionStatus(
            String status,
            long now,
            UUID roleId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            long expectedVersion) {
        return jdbc.update(
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_UPDATE_WORKSPACE_ROLE_STATUS_VERSION
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_VERSION,
                status,
                now,
                roleId,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public PageRows page(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String organizationType,
            String status,
            int page,
            int pageSize,
            String sort,
            String direction) {
        String orderBy = "NAME".equals(sort)
                ? WorkspaceRoleServiceSql.ROLE_NAME_ORDER
                : WorkspaceRoleServiceSql.ROLE_UPDATED_AT_ORDER;
        String sql =
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CTE_FILTERED_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_SERVICE_NODE_TYPE_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGE_ACCESS_KEYS_CAPABILITY_KEYS_TOTAL
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_WORKSPACE_ROLE
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_WHERE
                        + WorkspaceRoleServiceSql.ROLE_PAGE_WHERE
                        + WorkspaceRoleServiceSql.ROLE_PAGE_ORDER_PREFIX
                        + orderBy
                        + WorkspaceRoleServiceSql.SQL_SPACE
                        + direction
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_VALUE_SEPARATOR_PAGE_TOTAL_TOTAL
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_FROM_CLAUSE_PAGED_TOTAL_WORKSPACE_UUID
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_GROUP_WORKSPACE_KEY_NAME_DESCRIPTION
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_UPDATED_AT_EPOCH_MILLIS_PAGE_ACCESS_KEYS_CAPABILITY_KEYS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_PAGED_TOTAL
                        + orderBy
                        + WorkspaceRoleServiceSql.SQL_SPACE
                        + direction
                        + WorkspaceRoleServiceSql.ROLE_PAGE_ORDER_SUFFIX;
        return jdbc.query(
                sql,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, name);
                    statement.setString(4, name);
                    statement.setString(5, organizationType);
                    statement.setString(6, organizationType);
                    statement.setString(7, status);
                    statement.setString(8, status);
                    statement.setInt(9, pageSize);
                    statement.setInt(10, (page - 1) * pageSize);
                },
                result -> {
                    List<RoleRow> items = new ArrayList<>();
                    long total = 0;
                    while (result.next()) {
                        total = result.getLong(13);
                        if (result.getObject(1) != null) items.add(row(result));
                    }
                    return new PageRows(List.copyOf(items), total);
                });
    }

    public RoleRow role(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId) {
        return jdbc.query(
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME_DESCRIPTION
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_VERSION
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_CAPABILITY_KEYS
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_FROM_CLAUSE_WORKSPACE_ROLE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, roleId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? row(result) : null);
    }

    public List<RoleRow> roles(UUID workspaceUuid, String groupWorkspaceKey, List<UUID> roleIds) {
        LinkedHashSet<UUID> requested = new LinkedHashSet<>(roleIds);
        List<UUID> ids = new ArrayList<>(requested);
        String placeholders = String.join(
                WorkspaceRoleServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(ids.size(), WorkspaceRoleServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NAME_DESCRIPTION_ALTERNATE_A
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_VERSION_ALTERNATE_A
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_CAPABILITY_KEYS_ALTERNATE_A
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_FROM_CLAUSE_WORKSPACE_ROLE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION
                        + placeholders
                        + WorkspaceRoleServiceSql.SQL_CLOSE_PAREN,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 3, ids.get(index));
                },
                (row, index) -> row(row));
    }

    public int appendAudit(
            UUID auditId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            String action,
            long now,
            String changesJson) {
        return jdbc.update(
                WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_WORKSPACE_ROLE
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_PARAMETER_PLACEHOLDER
                        + WorkspaceRoleServiceSql.WORKSPACE_ROLE_SERVICE_CONTINUATION_CAST_AS_JSONB,
                auditId,
                workspaceUuid,
                groupWorkspaceKey,
                roleId.toString(),
                actorType,
                actorId,
                actorDisplaySnapshot,
                action,
                now,
                changesJson);
    }

    private static RoleRow row(ResultSet result) throws SQLException {
        return new RoleRow(
                result.getObject(1, UUID.class),
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getLong(8),
                result.getLong(9),
                result.getLong(10),
                result.getString(11),
                result.getString(12));
    }

    public record PageRows(List<RoleRow> items, long total) {}

    public record RoleRow(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String description,
            String serviceNodeType,
            String status,
            long version,
            long createdAt,
            long updatedAt,
            String pageAccessKeysJson,
            String actionCapabilityKeysJson) {}
}
