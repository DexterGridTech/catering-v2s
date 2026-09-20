package com.catering.v2s.businesschannel.application.persistence;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateChannelCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.audit.contract.AuditActor;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for business-channel instances and channel-owned read facts. */
@Repository
public class BusinessChannelPersistence {
    public static final int BOUNDED_READ_LIMIT = BusinessChannelQuerySupport.BOUNDED_READ_LIMIT;
    private final JdbcTemplate jdbc;

    public BusinessChannelPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record ChannelProjection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            UUID templateRef,
            String targetNodeType,
            String targetNodeRef,
            String channelCode,
            String channelName,
            UUID bindingRef,
            String templateAccessKind,
            String status,
            long version,
            UUID templateProjectRef,
            String templateName,
            String templateCode,
            String templateOperatorKind,
            String templateOrderKind,
            String templateDineInForm,
            String templateProviderCode,
            String templateStatus,
            long templateVersion,
            String templateProjectStatus,
            UUID targetProjectRef,
            String targetNodeStatus,
            UUID targetStoreProjectRef,
            String targetStoreProjectStatus,
            String targetStoreStatus,
            UUID targetTenantRef,
            String targetTenantStatus,
            UUID targetBrandRef,
            String targetBrandStatus,
            String bindingLifecycleStatus,
            String providerStatus) {}

    public List<ChannelProjection> pageChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String ownerNodeType,
            String ownerNodeRef,
            String status,
            String sortKey,
            String sortDirection,
            int limit) {
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, ownerNodeType, ownerNodeRef));
        StringBuilder predicate = new StringBuilder(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_C_WORKSPACE_UUID_AND_C_GROUP_WORKSPACE_KEY_AND_C_TARGET_NODE_TYPE_AND_TARGET_NODE_TYPE_AND_C_TARGET_NODE_REF);
        if (status != null) {
            predicate.append(BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_STATUS);
            arguments.add(status);
        }
        return query(
                BusinessChannelQuerySupport.channelProjection(BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_BUSINESS_CHANNEL_TEMPLATE_LEFT_JOIN_BUSINESS_CHANNEL_B
                                + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_JOIN_CONDITION_TEMPLATE_REF_WORKSPACE_UUID
                                + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_GROUP_WORKSPACE_KEY)
                        + predicate
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_ORDER_BY
                        + channelOrderBy(sortKey, sortDirection)
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_LIMIT,
                append(arguments, limit + 1));
    }

    public Optional<BusinessChannelReadback.ChannelCommandContext> readChannelCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return jdbc.query(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_SELECT_CHANNEL_REF_TEMPLATE_REF_TARGET_NODE_TYPE_TARGET_NODE_REF
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_BINDING_REF_VERSION_ACCESS_KIND_ORDER_KIND
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_FROM_BUSINESS_CHANNEL_BUSINE
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_JOIN_BUSINESS_CHANNEL_TEMPLATE_TEMPLATE_REF
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> result.next()
                        ? Optional.of(new BusinessChannelReadback.ChannelCommandContext(
                                result.getObject("channel_ref", UUID.class),
                                result.getObject("template_ref", UUID.class),
                                result.getString("target_node_type"),
                                result.getString("target_node_ref"),
                                result.getString("channel_name"),
                                result.getObject("binding_ref", UUID.class),
                                result.getLong("version"),
                                result.getString("access_kind"),
                                result.getString("order_kind"),
                                result.getString("provider_code")))
                        : Optional.empty());
    }

    public ChannelProjection insertChannel(
            CreateChannelCommand command, UUID channelRef, String channelCode, String initialStatus, long now) {
        try {
            return jdbc.query(
                    BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CTE_BUSINESS_CHANNEL_INSERTED
                            + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_OPEN_PAREN_CHANNEL_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TARGET_NODE_TYPE
                            + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_TEMPLATE_REF_CHANNEL_CODE_CHANNEL_NAME_BINDING_REF
                            + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                            + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_1
                            + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_RETURNING
                            + BusinessChannelQuerySupport.insertedChannelProjection(),
                    statement -> {
                        statement.setObject(1, channelRef);
                        statement.setObject(2, command.workspaceUuid());
                        statement.setString(3, command.groupWorkspaceKey());
                        statement.setString(4, command.ownerNodeType());
                        statement.setString(5, command.ownerNodeRef());
                        statement.setObject(6, command.templateRef());
                        statement.setString(7, channelCode);
                        statement.setString(8, command.channelName());
                        statement.setObject(9, command.bindingRef());
                        statement.setString(10, initialStatus);
                        statement.setLong(11, now);
                        statement.setLong(12, now);
                    },
                    result -> result.next() ? mapChannelProjection(result, 0) : null);
        } catch (org.springframework.dao.DuplicateKeyException failure) {
            throw failure;
        }
    }

    public int updateChannel(
            UUID channelRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String channelName,
            UUID bindingRef,
            long now,
            long expectedVersion) {
        return jdbc.update(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_UPDATE_BUSINESS_CHANNEL_CHANNEL_NAME_BINDING_REF
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_CHANNEL_REF
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION,
                channelName,
                bindingRef,
                now,
                channelRef,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public int transitionChannel(
            UUID channelRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetStatus,
            long now,
            long expectedVersion) {
        return jdbc.update(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_UPDATE_BUSINESS_CHANNEL_STATUS
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_CHANNEL_REF_ALTERNATE_A
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_A,
                targetStatus,
                now,
                channelRef,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public int detachChannel(
            UUID channelRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            long now,
            long expectedVersion) {
        return jdbc.update(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_UPDATE_BUSINESS_CHANNEL_BINDING_REF
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_CHANNEL_REF_ALTERNATE_B
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_B,
                now,
                channelRef,
                workspaceUuid,
                groupWorkspaceKey,
                expectedVersion);
    }

    public Optional<ChannelProjection> readChannel(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef, boolean forUpdate) {
        if (forUpdate) {
            return jdbc.query(
                    BusinessChannelQuerySupport.channelSelect(BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_OF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF),
                    statement -> {
                        statement.setObject(1, workspaceUuid);
                        statement.setString(2, groupWorkspaceKey);
                        statement.setObject(3, channelRef);
                    },
                    result -> result.next() ? Optional.of(mapChannelProjection(result, 0)) : Optional.empty());
        }
        return query(
                        BusinessChannelQuerySupport.channelSelect(forUpdate
                                ? BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_OF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF
                                : BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF_ALTERNATE_A),
                        List.of(workspaceUuid, groupWorkspaceKey, channelRef))
                .stream()
                .findFirst();
    }

    public Optional<ChannelProjection> readCommandChannel(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef, boolean forUpdate) {
        String suffix = BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF_ALTERNATE_B
                + (forUpdate ? BusinessChannelServiceSql.CHANNEL_LOCK_SUFFIX : "");
        if (forUpdate) {
            return jdbc.query(
                    BusinessChannelQuerySupport.channelCommandSelect(suffix),
                    statement -> {
                        statement.setObject(1, workspaceUuid);
                        statement.setString(2, groupWorkspaceKey);
                        statement.setObject(3, channelRef);
                    },
                    result -> result.next() ? Optional.of(mapChannelProjection(result, 0)) : Optional.empty());
        }
        return query(
                BusinessChannelQuerySupport.channelCommandSelect(suffix),
                List.of(workspaceUuid, groupWorkspaceKey, channelRef))
                .stream()
                .findFirst();
    }

    public Map<UUID, List<BusinessChannelReadback.StatusDimension>> readOrganizationAncestors(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> nodeRefs) {
        if (workspaceUuid == null || groupWorkspaceKey == null || nodeRefs == null || nodeRefs.isEmpty()) {
            return Map.of();
        }
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(nodeRefs));
        String placeholders = refs.stream()
                .map(ignored -> BusinessChannelServiceSql.PARAMETER_PLACEHOLDER)
                .collect(Collectors.joining(BusinessChannelServiceSql.PLACEHOLDER_SEPARATOR));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors = new LinkedHashMap<>();
        jdbc.query(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CTE_ANCESTRY
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_SELECT_SOURCE_REF_PARENT_ID_NODE_TYPE_STATUS
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_FROM_ORGANIZATION_ORGANIZATI
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_WHERE_ID_IN
                        + placeholders
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CLOSE_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_UNION_CHILD_SOURCE_REF_PARENT_PARENT_ID
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_PARENT_NODE_TYPE_STATUS_CHILD
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_CHILD_PARENT_ID
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_SELECT_ANCESTRY_SOURCE_REF_NODE_TYPE_STATUS_DEPTH,
                statement -> bind(statement, arguments),
                result -> {
                    while (result.next()) {
                        UUID sourceRef = result.getObject("source_ref", UUID.class);
                        ancestors.computeIfAbsent(sourceRef, ignored -> new ArrayList<>())
                                .add(new BusinessChannelReadback.StatusDimension(
                                        "ORGANIZATION_" + result.getString("node_type"),
                                        result.getObject("id", UUID.class).toString(),
                                        result.getString("status")));
                    }
                    return null;
                });
        return ancestors;
    }

    public void recordAudit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityRef,
            String action,
            AuditActor actor,
            String entityType,
            String changesJson,
            long occurredAtEpochMillis) {
        jdbc.update(
                BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_INSERT_INTO_AUDIT_EVENT_EVENT_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT_ENTITY_TYPE
                        + BusinessChannelServiceSql.BUSINESS_CHANNEL_SERVICE_CHANGES_JSON_OCCURRED_AT_EPOCH_MILLIS,
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                entityType,
                entityRef,
                action,
                changesJson,
                occurredAtEpochMillis);
    }

    private List<ChannelProjection> query(String sql, List<Object> arguments) {
        return jdbc.query(sql, statement -> bind(statement, arguments), BusinessChannelPersistence::mapChannelProjection);
    }

    static ChannelProjection mapChannelProjection(ResultSet result, int rowNumber) throws SQLException {
        return new ChannelProjection(
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("channel_ref", UUID.class),
                result.getObject("template_ref", UUID.class),
                result.getString("target_node_type"),
                result.getString("target_node_ref"),
                result.getString("channel_code"),
                result.getString("channel_name"),
                result.getObject("binding_ref", UUID.class),
                result.getString("template_access_kind"),
                result.getString("status"),
                result.getLong("version"),
                result.getObject("template_project_ref", UUID.class),
                result.getString("template_name"),
                result.getString("template_code"),
                result.getString("template_operator_kind"),
                result.getString("template_order_kind"),
                result.getString("template_dine_in_form"),
                result.getString("template_provider_code"),
                result.getString("template_status"),
                result.getLong("template_version"),
                result.getString("template_project_status"),
                result.getObject("target_project_ref", UUID.class),
                result.getString("target_node_status"),
                result.getObject("target_store_project_ref", UUID.class),
                result.getString("target_store_project_status"),
                result.getString("target_store_status"),
                result.getObject("target_tenant_ref", UUID.class),
                result.getString("target_tenant_status"),
                result.getObject("target_brand_ref", UUID.class),
                result.getString("target_brand_status"),
                result.getString("binding_lifecycle_status"),
                result.getString("provider_status"));
    }

    private static void bind(PreparedStatement statement, List<Object> arguments) throws SQLException {
        for (int index = 0; index < arguments.size(); index++) statement.setObject(index + 1, arguments.get(index));
    }

    private static List<Object> append(List<Object> values, Object value) {
        List<Object> result = new ArrayList<>(values);
        result.add(value);
        return result;
    }

    private static String channelOrderBy(String sortKey, String sortDirection) {
        if (sortKey == null) return BusinessChannelServiceSql.CHANNEL_REF_SORT_EXPRESSION;
        String expression = switch (sortKey) {
            case "CHANNEL_NAME" -> BusinessChannelServiceSql.CHANNEL_NAME_SORT_EXPRESSION;
            case "CHANNEL_CODE" -> BusinessChannelServiceSql.CHANNEL_CODE_SORT_EXPRESSION;
            case "TEMPLATE_NAME" -> BusinessChannelServiceSql.TEMPLATE_NAME_SORT_EXPRESSION;
            case "STATUS" -> BusinessChannelServiceSql.CHANNEL_STATUS_SORT_EXPRESSION;
            case "BINDING_STATUS" -> BusinessChannelServiceSql.BINDING_STATUS_SORT_EXPRESSION;
            default -> throw new BusinessChannelCommandApi.Problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
        return expression
                + BusinessChannelServiceSql.SORT_SEPARATOR
                + direction(sortDirection)
                + BusinessChannelServiceSql.CHANNEL_REF_ORDER_SUFFIX;
    }

    private static String direction(String sortDirection) {
        return BusinessChannelServiceSql.SORT_DIRECTION_DESC.equals(sortDirection)
                ? BusinessChannelServiceSql.SORT_DIRECTION_DESC
                : BusinessChannelServiceSql.SORT_DIRECTION_ASC;
    }
}
