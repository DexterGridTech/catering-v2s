package com.catering.v2s.collaboration.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence execution for collaboration enablement and owner-binding facts. */
@Repository
public class CollaborationOwnerPersistence {
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";

    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public CollaborationOwnerPersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public enum EnablementKind {
        EXTERNAL_SYSTEM(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_COLLABORATION_EXTERNAL_SYSTEM_ENABLEMENT,
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_EXTERNAL_SYSTEM_CODE_ALTERNATE_A),
        PROVIDER_PROFILE(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_COLLABORATION_PROVIDER_PROFILE_ENABLEMENT,
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PROVIDER_CODE);

        private final String table;
        private final String codeColumn;

        EnablementKind(String table, String codeColumn) {
            this.table = table;
            this.codeColumn = codeColumn;
        }
    }

    public record EnablementRow(String status, long version) {}

    public record EnablementSnapshot(String kind, String code, EnablementRow enablement) {}

    public record BindingPageRow(BindingRow binding, String nodePathJson, long total) {}

    public record AuditRecord(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityRef,
            String entityType,
            String action,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            String changesJson) {}

    public record BindingRow(
            UUID bindingRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String externalSystemCode,
            String providerCode,
            String capabilityClass,
            String nodeType,
            String nodeRef,
            String bindingDisplayName,
            String externalOwnerId,
            String authorizationRef,
            String status,
            Long unbindRequestedAt,
            Long externalRevokedAt,
            Long deletedAt,
            long version,
            long createdAt,
            long statusChangedAt,
            long updatedAt) {}

    public List<EnablementSnapshot> readTree(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_EXTERNAL_SYSTEM_ENABLEMENT_KIND_EXTERNAL_SYSTEM_CODE_CODE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_EXTERNAL_SYSTEM_ENABLEMENT_WORKSPACE_UUID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_GROUP_WORKSPACE_KEY_PROVIDER_PROFILE_ENABLEMENT_KIND
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PROVIDER_CODE_CODE_STATUS_VERSION
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_PROVIDER_PROFILE_ENABLEMENT_FROM_COLLABORATION_PROVIDER_
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, workspaceUuid);
                    statement.setString(4, groupWorkspaceKey);
                },
                (result, rowNumber) -> new EnablementSnapshot(
                        result.getString("enablement_kind"),
                        result.getString("code"),
                        new EnablementRow(result.getString("status"), result.getLong("version"))));
    }

    public EnablementRow readEnablement(
            EnablementKind kind, UUID workspaceUuid, String groupWorkspaceKey, String code) {
        return jdbc.query(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_STATUS_VERSION + kind.table
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B
                        + kind.codeColumn
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SQL_PUNCTUATION,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, code);
                },
                result -> result.next() ? new EnablementRow(result.getString(1), result.getLong(2)) : null);
    }

    public EnablementRow readEnablementForUpdate(
            EnablementKind kind, UUID workspaceUuid, String groupWorkspaceKey, String code) {
        return jdbc.query(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_STATUS_VERSION_ALTERNATE_A + kind.table
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_C
                        + kind.codeColumn
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FOR_UPDATE,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, code);
                },
                result -> result.next() ? new EnablementRow(result.getString(1), result.getLong(2)) : null);
    }

    public Map<String, EnablementRow> readEnablements(
            EnablementKind kind, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                        CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT
                                + kind.codeColumn
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_VALUE_SEPARATOR_STATUS_VERSION
                                + kind.table
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_D,
                        statement -> {
                            statement.setObject(1, workspaceUuid);
                            statement.setString(2, groupWorkspaceKey);
                        },
                        (result, rowNumber) -> Map.entry(
                                result.getString(1), new EnablementRow(result.getString(2), result.getLong(3))))
                .stream()
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    public void lockEnablement(EnablementKind kind, UUID workspaceUuid, String groupWorkspaceKey, String code) {
        AdvisoryLock.acquireHashTextPair(
                jdbc, workspaceUuid.toString(), groupWorkspaceKey + ":" + kind.table + ":" + code);
    }

    public int insertEnablement(
            EnablementKind kind, UUID workspaceUuid, String groupWorkspaceKey, String code, String targetStatus) {
        long now = time.currentEpochMillis();
        return jdbc.update(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_INSERT_INTO + kind.table
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_OPEN_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + kind.codeColumn
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_VALUE_SEPARATOR_STATUS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_VALUES_VALUES_1,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                targetStatus,
                now,
                now);
    }

    public int updateEnablement(
            EnablementKind kind,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String targetStatus,
            long expectedVersion) {
        long now = time.currentEpochMillis();
        return jdbc.update(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UPDATE + kind.table
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SET_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + kind.codeColumn
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_VERSION,
                targetStatus,
                now,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                expectedVersion);
    }

    public BindingRow readBinding(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        return jdbc.query(
                bindingSelect(CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY),
                statement -> {
                    statement.setObject(1, bindingRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? mapBinding(result) : null);
    }

    public BindingRow readBindingForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        return jdbc.query(
                bindingSelect(CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A),
                statement -> {
                    statement.setObject(1, bindingRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? mapBinding(result) : null);
    }

    public BindingRow readBindingByReference(UUID bindingRef) {
        return jdbc.query(
                bindingSelect(CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_ALTERNATE_A),
                statement -> statement.setObject(1, bindingRef),
                result -> result.next() ? mapBinding(result) : null);
    }

    public List<BindingPageRow> pageBindings(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String bindingName,
            String nodeQueryText,
            String sortKey,
            String sortDirection,
            int pageSize,
            long offset) {
        String sql = CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CTE_OWNER_BINDINGS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_BINDING_REF_PROVIDER_CODE_CAPABILITY_CLASS_NODE_TYPE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_DISPLAY_NAME_EXTERNAL_OWNER_ID_STATUS_VERSION
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_OWNER_BINDING_STATUS_CHANGED_AT_EPOCH_MILLIS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROVIDER_CODE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_REQUESTED_NODES
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_OWNER_BINDINGS_NODE_TYPE_NODE_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_SEEDS_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT_ID
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_REQUESTED_NODE_TYPE_NODE_REF_NODE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_ORGANIZATION_NODE_NODE_CODE_NAME_REQUESTED
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_REGION_PROJECT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_REQUESTED_NODE_REF_NODE_TEXT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_NODE_GROUP_WORKSPACE_KEY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_REQUESTED_NODE_TYPE_NODE_REF_PROJECT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STORE_PROJECT_CODE_NAME_REQUESTED
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_STORE_NODE_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT_STORE_PROJECT_ID
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_PROJECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_ANCESTRY_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT_ID
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PATH_NODE_TYPE_CODE_NAME_DEPTH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT_ID_PATH_NODE_TYPE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NODE_SEEDS_DEPTH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UNION_ANCESTRY_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PARENT_NODE_TYPE_CODE_NAME
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PARENT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_ANCESTRY_PARENT_ID_PARENT_WORKSPACE_UUID
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_PARENT_GROUP_WORKSPACE_KEY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_PATHS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_TARGET_NODE_TYPE_TARGET_NODE_REF_JSONB_AGG_JSONB_BUILD_OBJECT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NAME_NODE_TYPE_PATH_NODE_TYPE_DEPTH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_ANCESTRY_TARGET_NODE_TYPE_TARGET_NODE_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_OWNER_NODE_PATH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_COMMERCIAL_GROUP_NODE_TYPE_COMMERCIAL_GROUP_UUID_TEXT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JSONB_BUILD_ARRAY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NAME_COMMERCIAL_GROUP_NAME_NODE_TYPE_NODE_PATH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_REQUESTED_NODES_GROUP_NODE_REQUESTED
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_COMMERCIAL_GROUP
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_REQUESTED_NODE_REF_GROUP_NODE_COMMERCIAL_GROUP_UUID
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_GROUP_NODE_GROUP_WORKSPACE_KEY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_NODE_SEEDS_NODE_TARGET_NODE_TYPE_TARGET_NODE_REF_NODE_PATHS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_NODE_PATHS_TARGET_NODE_TYPE_NODE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_NODE_PATHS_TARGET_NODE_REF_NODE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_NODE_TARGET_NODE_TYPE_REGION_PROJECT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UNION_HEAD_COMPANY_TEXT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_REF_HEAD_COMPANY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NAME_HEAD_COMPANY_NODE_TYPE_NODE_PATH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_REQUESTED_NODES_REQUESTED
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_HEAD_COMPANY_NODE_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_HEAD_COMPANY_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_STORE_TEXT_NODE_PATHS_NODE_PATH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_REF_STORE_CODE_NAME
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_REQUESTED_NODES_REQUESTED_ALTERNATE_A
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_STORE_NODE_REF_ALTERNATE_A
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_NODE_PATHS_TARGET_NODE_TYPE_STORE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_NODE_PATHS_TARGET_NODE_REF_STORE_TEXT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_BINDING_BINDING_REF_PROVIDER_CODE_CAPABILITY_CLASS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_NODE_TYPE_NODE_REF_BINDING_DISPLAY_NAME
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_EXTERNAL_OWNER_ID_STATUS_VERSION
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NODE_PATH_TEXT_TOTAL
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_OWNER_NODE_PATH_BINDING_NODE_PATH
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_NODE_PATH_NODE_TYPE_BINDING_NODE_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_TEXT_BINDING_BINDING_DISPLAY_NAME_ILIKE
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_TEXT_CONCAT_WS_BINDING_NODE_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NODE_PATH_TEXT
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_ILIKE_ESCAPE
                + bindingOrderBy(sortKey, sortDirection)
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_LIMIT_LIMIT_OFFSET;
        return jdbc.query(
                sql,
                statement -> {
                    int index = 1;
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setString(index++, providerCode);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setString(index++, bindingName);
                    statement.setString(index++, bindingName == null ? null : likePattern(bindingName));
                    statement.setString(index++, nodeQueryText);
                    statement.setString(index++, nodeQueryText == null ? null : likePattern(nodeQueryText));
                    statement.setInt(index++, pageSize);
                    statement.setLong(index, offset);
                },
                (result, rowNumber) -> new BindingPageRow(
                        new BindingRow(
                                result.getObject("binding_ref", UUID.class),
                                workspaceUuid,
                                groupWorkspaceKey,
                                null,
                                result.getString("provider_code"),
                                result.getString("capability_class"),
                                result.getString("node_type"),
                                result.getString("node_ref"),
                                result.getString("binding_display_name"),
                                result.getString("external_owner_id"),
                                null,
                                result.getString("status"),
                                null,
                                null,
                                null,
                                result.getLong("version"),
                                result.getLong("created_at_epoch_millis"),
                                result.getLong("status_changed_at_epoch_millis"),
                                0L),
                        result.getString("node_path"),
                        result.getLong("total")));
    }

    public List<BindingRow> findBindingsForNode(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode, String nodeType, String nodeRef) {
        return jdbc.query(
                        CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_BINDING_REF_EXTERNAL_SYSTEM_CODE_PROVIDER_CODE_CAPABILITY_CLASS
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NODE_TYPE_NODE_REF
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_DISPLAY_NAME
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UNBIND_REQUESTED_AT_EPOCH_MILLIS
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_DELETE_DELETED_AT_EPOCH_MILLIS_VERSION_CREATED_AT_EPOCH_MILLIS
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_OWNER_BINDING_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_PROVIDER_CODE_NODE_TYPE_NODE_REF_BINDING_REF,
                        statement -> {
                            statement.setObject(1, workspaceUuid);
                            statement.setString(2, groupWorkspaceKey);
                            statement.setString(3, providerCode);
                            statement.setString(4, nodeType);
                            statement.setString(5, nodeRef);
                        },
                        (result, rowNumber) -> mapBinding(result))
                .stream()
                .toList();
    }

    public BindingRow insertBinding(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String externalSystemCode,
            String providerCode,
            String capabilityClass,
            String nodeType,
            String nodeRef,
            String bindingDisplayName,
            String externalOwnerId,
            String initialStatus) {
        UUID bindingRef = UUID.randomUUID();
        long now = time.currentEpochMillis();
        return jdbc.query(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_INSERT_INTO_OWNER_BINDING_BINDING_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_EXTERNAL_SYSTEM_CODE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_DISPLAY_NAME_ALTERNATE_A
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CREATED_AT_EPOCH_MILLIS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_VALUES_VALUES_NULL_1_RETURNING
                        + bindingColumns(),
                statement -> {
                    statement.setObject(1, bindingRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setString(4, externalSystemCode);
                    statement.setString(5, providerCode);
                    statement.setString(6, capabilityClass);
                    statement.setString(7, nodeType);
                    statement.setString(8, nodeRef);
                    statement.setString(9, bindingDisplayName);
                    statement.setString(10, externalOwnerId);
                    statement.setString(11, initialStatus);
                    statement.setLong(12, now);
                    statement.setLong(13, now);
                    statement.setLong(14, now);
                },
                result -> result.next() ? mapBinding(result) : null);
    }

    public int updateBinding(
            UUID bindingRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String bindingDisplayName,
            String externalOwnerId,
            long expectedVersion) {
        return jdbc.update(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UPDATE_OWNER_BINDING_BINDING_DISPLAY_NAME_EXTERNAL_OWNER_ID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_BINDING_REF
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION_STATUS,
                bindingDisplayName,
                externalOwnerId,
                time.currentEpochMillis(),
                bindingRef,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion,
                "DELETED");
    }

    public BindingRow deleteBinding(
            UUID bindingRef, UUID workspaceUuid, String groupWorkspaceKey, long expectedVersion) {
        long now = time.currentEpochMillis();
        return jdbc.query(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UPDATE_OWNER_BINDING_STATUS_DELETED_AT_EPOCH_MILLIS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION_STATUS_ALTERNATE_A
                        + bindingColumns(),
                statement -> {
                    statement.setString(1, "DELETED");
                    statement.setLong(2, now);
                    statement.setLong(3, now);
                    statement.setLong(4, now);
                    statement.setObject(5, bindingRef);
                    statement.setObject(6, workspaceUuid);
                    statement.setString(7, groupWorkspaceKey);
                    statement.setLong(8, expectedVersion);
                    statement.setString(9, "DELETED");
                },
                result -> result.next() ? mapBinding(result) : null);
    }

    public int applyAuthorization(
            UUID bindingRef, String externalOwnerId, String authorizationReference, long expectedVersion) {
        long now = time.currentEpochMillis();
        return jdbc.update(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UPDATE_OWNER_BINDING_EXTERNAL_OWNER_ID_AUTHORIZATION_REF_STATUS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_VERSION,
                externalOwnerId,
                authorizationReference,
                "EFFECTIVE",
                now,
                now,
                bindingRef,
                expectedVersion);
    }

    public int applyRevocation(UUID bindingRef, long expectedVersion) {
        long now = time.currentEpochMillis();
        return jdbc.update(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UPDATE_OWNER_BINDING_EXTERNAL_REVOKED_AT_EPOCH_MILLIS_STATUS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS_ALTERNATE_B
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_VERSION_ALTERNATE_A,
                now,
                "INVALID",
                now,
                now,
                bindingRef,
                expectedVersion);
    }

    public String readNodePath(BindingRow row) {
        return jdbc.query(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CTE_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_TEXT_TARGET_TYPE_TARGET_ID_WORKSPACE_UUID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PARAMETER_PLACEHOLDER_TEXT_GROUP_WORKSPACE_KEY
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_STORE_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_TARGET_TARGET_TYPE_TARGET_ID_STORE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STORE_PROJECT_ID_TARGET_TYPE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_STORE_TARGET_TARGET_ID_WORKSPACE_UUID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_STORE_GROUP_WORKSPACE_KEY_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_SEEDS
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_TARGET_TARGET_TYPE_TARGET_ID_NODE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_ORGANIZATION_NODE_NODE_CODE_NAME_DEPTH
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_TARGET_TARGET_TYPE_REGION_PROJECT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_NODE_WORKSPACE_UUID_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_NODE_GROUP_WORKSPACE_KEY_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UNION_STORE_TARGET_TARGET_TYPE_TARGET_ID_PROJECT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PROJECT_PARENT_ID_NODE_TYPE_CODE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PROJECT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_PROJECT_STORE_TARGET_PROJECT_ID_WORKSPACE_UUID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_PROJECT_GROUP_WORKSPACE_KEY_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_ANCESTRY
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_NODE_SEEDS_TARGET_TYPE_TARGET_ID_PARENT_ID_NODE_TYPE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UNION_ANCESTRY_TARGET_TYPE_TARGET_ID_PARENT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_PARENT_NODE_TYPE_CODE_NAME_ALTERNATE_A
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_TARGET_FROM_ANCESTRY_JOIN_TARGET_ON
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JOIN_ORGANIZATION_NODE_PARENT_ANCESTRY_PARENT_ID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_PARENT_WORKSPACE_UUID_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_PARENT_GROUP_WORKSPACE_KEY_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_PATH
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT_TARGET_TYPE_TARGET_ID_JSONB_AGG_JSONB_BUILD_OBJECT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_ANCESTRY_NAME_NODE_TYPE_DEPTH_PATH
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_GROUP_BY_TARGET_TYPE_TARGET_ID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_SELECT_CASE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHEN_TARGET_TARGET_TYPE_COMMERCIAL_GROUP
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_OPEN_PAREN_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_REF_GROUP_NODE_COMMERCIAL_GROUP_UUID_CODE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NAME_GROUP_NODE_COMMERCIAL_GROUP_NAME_NODE_TYPE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_COMMERCIAL_GROUP_FROM_ORGANIZATION_COMMERCIAL
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_GROUP_NODE_COMMERCIAL_GROUP_UUID_TARGET_TARGET_ID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_GROUP_NODE_GROUP_WORKSPACE_KEY_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHEN_TARGET_TARGET_TYPE_HEAD_COMPANY_JSONB_BUILD_ARRAY
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_REF_HEAD_COMPANY_CODE_NAME
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_HEAD_COMPANY_NODE_TYPE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHERE_HEAD_COMPANY
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_TARGET_TARGET_ID_HEAD_COMPANY_WORKSPACE_UUID
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_HEAD_COMPANY_GROUP_WORKSPACE_KEY_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_WHEN_TARGET_TARGET_TYPE_STORE_NODE_PATH
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_REF_STORE_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STORE_TARGET_CODE_NAME_NODE_TYPE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_STORE_TARGET_FROM_STORE_TARGET_JSONB
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_ELSE_TARGET_NODE_PATH_PATH_TEXT
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NODE_PATH_TARGET_TYPE_TARGET
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CONDITION_NODE_PATH_TARGET_ID_TARGET,
                statement -> {
                    statement.setString(1, row.nodeType());
                    statement.setObject(2, UUID.fromString(row.nodeRef()));
                    statement.setObject(3, row.workspaceUuid());
                    statement.setString(4, row.groupWorkspaceKey());
                },
                result -> result.next() ? result.getString("node_path") : "[]");
    }

    public void writeAudit(AuditRecord record) {
        jdbc.update(
                CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_INSERT_INTO_AUDIT_EVENT_EVENT_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT_ENTITY_TYPE
                        + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CHANGES_JSON_OCCURRED_AT_EPOCH_MILLIS,
                UUID.randomUUID(),
                record.workspaceUuid(),
                record.groupWorkspaceKey(),
                record.actorType(),
                record.actorId(),
                record.actorDisplaySnapshot(),
                record.entityType(),
                record.entityRef(),
                record.action(),
                record.changesJson(),
                time.currentEpochMillis());
    }

    private static String bindingSelect(String predicate) {
        return CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_SELECT + bindingColumns()
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_OWNER_BINDING_FROM_COLLABORATION_OWNER_BIN + predicate;
    }

    private static String bindingColumns() {
        return CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_REF
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_CAPABILITY_CLASS_NODE_TYPE_NODE_REF_BINDING_DISPLAY_NAME
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_STATUS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_DELETE_DELETED_AT_EPOCH_MILLIS
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS;
    }

    private static BindingRow mapBinding(ResultSet result) throws SQLException {
        return new BindingRow(
                result.getObject("binding_ref", UUID.class),
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getString("external_system_code"),
                result.getString("provider_code"),
                result.getString("capability_class"),
                result.getString("node_type"),
                result.getString("node_ref"),
                result.getString("binding_display_name"),
                result.getString("external_owner_id"),
                result.getString("authorization_ref"),
                result.getString("status"),
                result.getObject("unbind_requested_at_epoch_millis", Long.class),
                result.getObject("external_revoked_at_epoch_millis", Long.class),
                result.getObject("deleted_at_epoch_millis", Long.class),
                result.getLong("version"),
                result.getLong("created_at_epoch_millis"),
                result.getLong("status_changed_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"));
    }

    private static String bindingOrderBy(String sortKey, String sortDirection) {
        String expression = switch (sortKey) {
            case "NODE" -> CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_NODE_PATH_TEXT_BINDING_NODE_REF;
            case "BUSINESS" -> CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_CAPABILITY_CLASS;
            case "EXTERNAL_OWNER_ID" -> CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_EXTERNAL_OWNER_ID;
            case "STATUS" -> CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_STATUS;
            default -> CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_BINDING_DISPLAY_NAME;
        };
        return expression + " " + (ASC.equals(sortDirection) ? ASC : DESC)
                + CollaborationOwnerServiceSql.COLLABORATION_OWNER_SERVICE_BINDING_BINDING_REF;
    }

    private static String likePattern(String value) {
        return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
