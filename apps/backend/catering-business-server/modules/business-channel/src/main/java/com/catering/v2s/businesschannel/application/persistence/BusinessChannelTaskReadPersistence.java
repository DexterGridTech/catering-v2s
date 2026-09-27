package com.catering.v2s.businesschannel.application.persistence;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import java.sql.PreparedStatement;
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

/** Typed JDBC execution boundary for task-shaped business-channel reads. */
@Repository
public class BusinessChannelTaskReadPersistence {
    private final JdbcTemplate jdbc;

    public BusinessChannelTaskReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<BusinessChannelPersistence.ChannelProjection> listSalesMenuEligibleChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String storeRef,
            UUID cursorTieBreaker,
            String cursorSortValue,
            int limit,
            String sortKey,
            String sortDirection) {
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, storeRef));
        StringBuilder predicate = new StringBuilder(BusinessChannelTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_001
                + BusinessChannelTaskReadServiceSql
                        .BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_TARGET_NODE_REF_TARGET_STORE
                + BusinessChannelTaskReadServiceSql
                        .BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_ACCESS_KIND_INTERNAL_OPERATOR_KIND_STORE
                + BusinessChannelTaskReadServiceSql
                        .BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_ORDER_KIND_DINE_IN_TAKEAWAY);
        if (cursorTieBreaker != null) {
            if (sortKey == null) {
                predicate.append(
                        BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_CHANNEL_REF);
                arguments.add(cursorTieBreaker);
            } else {
                String expression = salesMenuChannelSortExpression(sortKey);
                String comparison = BusinessChannelTaskReadServiceSql.SORT_DIRECTION_DESC.equals(sortDirection)
                        ? BusinessChannelTaskReadServiceSql.CURSOR_LESS_OPERATOR
                        : BusinessChannelTaskReadServiceSql.CURSOR_GREATER_OPERATOR;
                predicate
                        .append(BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION)
                        .append(expression)
                        .append(' ')
                        .append(comparison)
                        .append(
                                BusinessChannelTaskReadServiceSql
                                        .BUSINESS_CHANNEL_TASK_READ_SERVICE_PARAMETER_PLACEHOLDER)
                        .append(expression)
                        .append(BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_CHANNEL_REF);
                arguments.add(cursorSortValue);
                arguments.add(cursorSortValue);
                arguments.add(cursorTieBreaker);
            }
        }
        return query(
                BusinessChannelQuerySupport.channelProjection(
                                BusinessChannelTaskReadServiceSql.JOIN_BIZ_CHANNEL_TEMPLATE_JOIN_002
                                        + BusinessChannelTaskReadServiceSql.JOIN_CONDITION_TEMPLATE_REF_WS_003
                                        + BusinessChannelTaskReadServiceSql
                                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_GROUP_WORKSPACE_KEY)
                        + predicate
                        + BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_ORDER_BY
                        + salesMenuChannelOrderBy(sortKey, sortDirection)
                        + BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_LIMIT,
                append(arguments, limit + 1));
    }

    public List<BusinessChannelPersistence.ChannelProjection> requireSalesMenuChannel(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        return query(
                BusinessChannelQuerySupport.channelSelect(BusinessChannelTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_004
                        + BusinessChannelTaskReadServiceSql.CONDITION_TARGET_NODE_TYPE_STORE_005
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_TARGET_STORE_ACCESS_KIND_INTERNAL
                        + BusinessChannelTaskReadServiceSql.CONDITION_OPERATOR_KIND_STORE_ORD_006),
                List.of(workspaceUuid, groupWorkspaceKey, channelRef, storeRef));
    }

    public boolean salesMenuChannelBelongsToStore(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        return !query(
                        BusinessChannelQuerySupport.channelSelect(
                                BusinessChannelTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_ALT_A_007
                                        + BusinessChannelTaskReadServiceSql.CONDITION_TARGET_NODE_TYPE_STORE_ALT_A_008
                                        + BusinessChannelTaskReadServiceSql
                                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_TARGET_STORE),
                        List.of(workspaceUuid, groupWorkspaceKey, channelRef, storeRef))
                .isEmpty();
    }

    public Optional<BusinessChannelPersistence.ChannelProjection> readChannelWithTemplateProvider(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return query(
                        BusinessChannelQuerySupport.channelCommandSelect(
                                BusinessChannelTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_ALT_B_009),
                        List.of(workspaceUuid, groupWorkspaceKey, channelRef))
                .stream()
                .findFirst();
    }

    public List<BusinessChannelPersistence.ChannelProjection> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        return query(
                BusinessChannelQuerySupport.channelSelect(BusinessChannelTaskReadServiceSql.WHERE_WS_UUID_GRP_WS_010
                        + BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_ORDER_BY_CHANNEL_REF),
                List.of(workspaceUuid, groupWorkspaceKey, bindingRef));
    }

    public Map<UUID, List<BusinessChannelReadback.StatusDimension>> readOrganizationAncestors(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> nodeRefs) {
        if (workspaceUuid == null || groupWorkspaceKey == null || nodeRefs == null || nodeRefs.isEmpty()) {
            return Map.of();
        }
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(nodeRefs));
        String placeholders = refs.stream()
                .map(ignored -> BusinessChannelTaskReadServiceSql.PARAMETER_PLACEHOLDER)
                .collect(Collectors.joining(BusinessChannelTaskReadServiceSql.PLACEHOLDER_SEPARATOR));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors = new LinkedHashMap<>();
        jdbc.query(
                BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_CTE_ANCESTRY
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_SELECT_SOURCE_REF_PARENT_ID_NODE_TYPE_STATUS
                        + BusinessChannelTaskReadServiceSql.FROM_CLAUSE_ORG_NODE_FROM_011
                        + BusinessChannelTaskReadServiceSql.BUSINESS_CHANNEL_TASK_READ_SERVICE_WHERE_WHERE_ID_IN
                        + placeholders
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_CLOSE_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_UNION_CHILD_SOURCE_REF_PARENT_PARENT_ID
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_PARENT_NODE_TYPE_STATUS_CHILD
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_CHILD_PARENT_ID
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                        + BusinessChannelTaskReadServiceSql
                                .BUSINESS_CHANNEL_TASK_READ_SERVICE_SELECT_ANCESTRY_SOURCE_REF_NODE_TYPE_STATUS_DEPTH,
                statement -> bind(statement, arguments),
                result -> {
                    while (result.next()) {
                        UUID sourceRef = result.getObject("source_ref", UUID.class);
                        ancestors
                                .computeIfAbsent(sourceRef, ignored -> new ArrayList<>())
                                .add(new BusinessChannelReadback.StatusDimension(
                                        "ORGANIZATION_" + result.getString("node_type"),
                                        result.getObject("id", UUID.class).toString(),
                                        result.getString("status")));
                    }
                    return null;
                });
        return ancestors;
    }

    private List<BusinessChannelPersistence.ChannelProjection> query(String sql, List<Object> arguments) {
        return jdbc.query(
                sql, statement -> bind(statement, arguments), BusinessChannelPersistence::mapChannelProjection);
    }

    private static String salesMenuChannelOrderBy(String sortKey, String sortDirection) {
        if (sortKey == null) return BusinessChannelTaskReadServiceSql.CHANNEL_REF_SORT_EXPRESSION;
        return salesMenuChannelSortExpression(sortKey)
                + BusinessChannelTaskReadServiceSql.SORT_SEPARATOR
                + direction(sortDirection)
                + BusinessChannelTaskReadServiceSql.CHANNEL_REF_ORDER_SUFFIX;
    }

    private static String salesMenuChannelSortExpression(String sortKey) {
        return switch (sortKey) {
            case "CHANNEL_NAME" -> BusinessChannelTaskReadServiceSql.CHANNEL_NAME_SORT_EXPRESSION;
            case "CHANNEL_CODE" -> BusinessChannelTaskReadServiceSql.CHANNEL_CODE_SORT_EXPRESSION;
            case "TEMPLATE_NAME" -> BusinessChannelTaskReadServiceSql.TEMPLATE_NAME_SORT_EXPRESSION;
            case "ACCESS_KIND" -> BusinessChannelTaskReadServiceSql.ACCESS_KIND_SORT_EXPRESSION;
            case "OPERATOR_KIND" -> BusinessChannelTaskReadServiceSql.OPERATOR_KIND_SORT_EXPRESSION;
            case "ORDER_KIND" -> BusinessChannelTaskReadServiceSql.ORDER_KIND_SORT_EXPRESSION;
            case "STATUS" -> BusinessChannelTaskReadServiceSql.STATUS_SORT_EXPRESSION;
            case "BINDING_STATUS" -> BusinessChannelTaskReadServiceSql.BINDING_STATUS_SORT_EXPRESSION;
            default -> throw new BusinessChannelCommandApi.Problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
    }

    private static String direction(String sortDirection) {
        return BusinessChannelTaskReadServiceSql.SORT_DIRECTION_DESC.equals(sortDirection)
                ? BusinessChannelTaskReadServiceSql.SORT_DIRECTION_DESC
                : BusinessChannelTaskReadServiceSql.SORT_DIRECTION_ASC;
    }

    private static void bind(PreparedStatement statement, List<Object> arguments) throws SQLException {
        for (int index = 0; index < arguments.size(); index++) statement.setObject(index + 1, arguments.get(index));
    }

    private static List<Object> append(List<Object> values, Object value) {
        List<Object> result = new ArrayList<>(values);
        result.add(value);
        return result;
    }
}
