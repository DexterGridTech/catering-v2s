package com.catering.v2s.businesschannel.application.persistence;

/** SQL text owned by BusinessChannelTaskReadService; B3 relocates text without changing execution. */
public final class BusinessChannelTaskReadServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ", ";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_SEPARATOR = " ";
    public static final String CHANNEL_REF_SORT_EXPRESSION = "c.channel_ref";
    public static final String CHANNEL_NAME_SORT_EXPRESSION = "COALESCE(c.channel_name, '')";
    public static final String CHANNEL_CODE_SORT_EXPRESSION = "COALESCE(c.channel_code, '')";
    public static final String TEMPLATE_NAME_SORT_EXPRESSION = "COALESCE(t.template_name, '')";
    public static final String ACCESS_KIND_SORT_EXPRESSION = "t.access_kind";
    public static final String OPERATOR_KIND_SORT_EXPRESSION = "t.operator_kind";
    public static final String ORDER_KIND_SORT_EXPRESSION = "t.order_kind";
    public static final String STATUS_SORT_EXPRESSION = "c.status";
    public static final String BINDING_STATUS_SORT_EXPRESSION =
            "CAST(CASE WHEN t.access_kind='INTERNAL' THEN 0 WHEN c.binding_ref IS NULL THEN 1 ELSE 2 END AS TEXT)";
    public static final String CHANNEL_REF_ORDER_SUFFIX = ", c.channel_ref";
    public static final String CURSOR_LESS_OPERATOR = "<";
    public static final String CURSOR_GREATER_OPERATOR = ">";
    public static final String WHERE_WS_UUID_GRP_WS_001 =
            " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.target_node_type='STORE'";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_TARGET_NODE_REF_TARGET_STORE =
            " AND c.target_node_ref=? AND target_store.id IS NOT NULL";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_ACCESS_KIND_INTERNAL_OPERATOR_KIND_STORE =
            " AND t.access_kind='INTERNAL' AND t.operator_kind='STORE'";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_ORDER_KIND_DINE_IN_TAKEAWAY =
            " AND t.order_kind IN ('DINE_IN','TAKEAWAY')";
    public static final String JOIN_BIZ_CHANNEL_TEMPLATE_JOIN_002 =
            "JOIN business_channel.business_channel_template t ";
    public static final String JOIN_CONDITION_TEMPLATE_REF_WS_003 =
            "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_GROUP_WORKSPACE_KEY =
            "AND t.group_workspace_key=c.group_workspace_key ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_LIMIT = " LIMIT ?";
    public static final String WHERE_WS_UUID_GRP_WS_004 =
            "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? ";
    public static final String CONDITION_TARGET_NODE_TYPE_STORE_005 =
            "AND c.target_node_type='STORE' AND c.target_node_ref=? ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_TARGET_STORE_ACCESS_KIND_INTERNAL =
            "AND target_store.id IS NOT NULL AND t.access_kind='INTERNAL' ";
    public static final String CONDITION_OPERATOR_KIND_STORE_ORD_006 =
            "AND t.operator_kind='STORE' AND t.order_kind IN ('DINE_IN','TAKEAWAY')";
    public static final String WHERE_WS_UUID_GRP_WS_ALT_A_007 =
            "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? ";
    public static final String CONDITION_TARGET_NODE_TYPE_STORE_ALT_A_008 =
            "AND c.target_node_type='STORE' AND c.target_node_ref=? ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_TARGET_STORE =
            "AND target_store.id IS NOT NULL";
    public static final String WHERE_WS_UUID_GRP_WS_ALT_B_009 =
            "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?";
    public static final String WHERE_WS_UUID_GRP_WS_010 =
            "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.binding_ref=?";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_ORDER_BY_CHANNEL_REF = " ORDER BY channel_ref";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CTE_ANCESTRY = "WITH RECURSIVE ancestry AS (";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_SELECT_SOURCE_REF_PARENT_ID_NODE_TYPE_STATUS =
            "SELECT id AS source_ref, id, parent_id, node_type, status, 0 AS depth ";
    public static final String FROM_CLAUSE_ORG_NODE_FROM_011 = "FROM organization.organization_node ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_WHERE_WHERE_ID_IN = "WHERE id IN (";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CLOSE_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            ") AND workspace_uuid=? AND group_workspace_key=? ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_UNION_CHILD_SOURCE_REF_PARENT_PARENT_ID =
            "UNION ALL SELECT child.source_ref, parent.id, parent.parent_id, ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_PARENT_NODE_TYPE_STATUS_CHILD =
            "parent.node_type, parent.status, child.depth+1 ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_CHILD_PARENT_ID =
            "FROM organization.organization_node parent JOIN ancestry child ON parent.id=child.parent_id ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=? ) ";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_SELECT_ANCESTRY_SOURCE_REF_NODE_TYPE_STATUS_DEPTH =
            "SELECT source_ref, node_type, id, status FROM ancestry ORDER BY source_ref, depth DESC";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION_CHANNEL_REF = " AND c.channel_ref > ?";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CONDITION = " AND (";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_PARAMETER_PLACEHOLDER = " ? OR (";
    public static final String BUSINESS_CHANNEL_TASK_READ_SERVICE_CHANNEL_REF = " = ? AND c.channel_ref > ?))";
}
