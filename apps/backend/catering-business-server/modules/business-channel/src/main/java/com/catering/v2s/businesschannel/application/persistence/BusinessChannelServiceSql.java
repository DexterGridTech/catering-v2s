package com.catering.v2s.businesschannel.application.persistence;

/** SQL text owned by BusinessChannelService; B3 relocates text without changing execution. */
public final class BusinessChannelServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ", ";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_SEPARATOR = " ";
    public static final String CHANNEL_REF_SORT_EXPRESSION = "c.channel_ref";
    public static final String CHANNEL_NAME_SORT_EXPRESSION = "c.channel_name";
    public static final String CHANNEL_CODE_SORT_EXPRESSION = "COALESCE(c.channel_code, '')";
    public static final String TEMPLATE_NAME_SORT_EXPRESSION = "COALESCE(t.template_name, '')";
    public static final String CHANNEL_STATUS_SORT_EXPRESSION = "c.status";
    public static final String BINDING_STATUS_SORT_EXPRESSION =
            "CASE WHEN t.access_kind='INTERNAL' THEN 0 WHEN c.binding_ref IS NULL THEN 1 ELSE 2 END";
    public static final String CHANNEL_REF_ORDER_SUFFIX = ", c.channel_ref";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TARGET_NODE_TYPE_TARGET_NODE_R = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.target_node_type=? AND c.target_node_r";
    
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_STATUS = " AND c.status=?";
    public static final String BUSINESS_CHANNEL_SERVICE_BUSINESS_CHANNEL_TEMPLATE_LEFT_JOIN_BUSINESS_CHANNEL_B = "LEFT JOIN business_channel.business_channel_template t ";
    public static final String BUSINESS_CHANNEL_SERVICE_JOIN_CONDITION_TEMPLATE_REF_WORKSPACE_UUID = "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_GROUP_WORKSPACE_KEY = "AND t.group_workspace_key=c.group_workspace_key ";
    public static final String BUSINESS_CHANNEL_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String BUSINESS_CHANNEL_SERVICE_LIMIT = " LIMIT ?";
    public static final String BUSINESS_CHANNEL_SERVICE_SELECT_CHANNEL_REF_TEMPLATE_REF_TARGET_NODE_TYPE_TARGET_NODE_REF = "SELECT c.channel_ref, c.template_ref, c.target_node_type, c.target_node_ref, c.channel_name, ";
    public static final String BUSINESS_CHANNEL_SERVICE_BINDING_REF_VERSION_ACCESS_KIND_ORDER_KIND = "c.binding_ref, c.version, t.access_kind, t.order_kind, t.provider_code ";
    public static final String BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_FROM_BUSINESS_CHANNEL_BUSINE = "FROM business_channel.business_channel c ";
    public static final String BUSINESS_CHANNEL_SERVICE_JOIN_BUSINESS_CHANNEL_TEMPLATE_TEMPLATE_REF = "JOIN business_channel.business_channel_template t ON t.template_ref=c.template_ref ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "AND t.workspace_uuid=c.workspace_uuid AND t.group_workspace_key=c.group_workspace_key ";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?";
    public static final String BUSINESS_CHANNEL_SERVICE_UPDATE_BUSINESS_CHANNEL_CHANNEL_NAME_BINDING_REF = "UPDATE business_channel.business_channel SET channel_name=?, binding_ref=?, ";
    public static final String BUSINESS_CHANNEL_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_CHANNEL_REF = "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION = "AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_CHANNEL_SERVICE_UPDATE_BUSINESS_CHANNEL_STATUS = "UPDATE business_channel.business_channel SET status=?, ";
    public static final String BUSINESS_CHANNEL_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_CHANNEL_REF_ALTERNATE_A = "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_A = "AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_CHANNEL_SERVICE_UPDATE_BUSINESS_CHANNEL_BINDING_REF = "UPDATE business_channel.business_channel SET binding_ref=null, ";
    public static final String BUSINESS_CHANNEL_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_CHANNEL_REF_ALTERNATE_B = "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION_ALTERNATE_B = "AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_CHANNEL_SERVICE_CTE_BUSINESS_CHANNEL_INSERTED = "WITH inserted AS (INSERT INTO business_channel.business_channel ";
    public static final String BUSINESS_CHANNEL_SERVICE_OPEN_PAREN_CHANNEL_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TARGET_NODE_TYPE = "(channel_ref, workspace_uuid, group_workspace_key, target_node_type, target_node_ref, ";
    public static final String BUSINESS_CHANNEL_SERVICE_TEMPLATE_REF_CHANNEL_CODE_CHANNEL_NAME_BINDING_REF = "template_ref, channel_code, channel_name, binding_ref, status, version, ";
    public static final String BUSINESS_CHANNEL_SERVICE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS = "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ";
    public static final String BUSINESS_CHANNEL_SERVICE_1 = "1, ?, ?) ";
    public static final String BUSINESS_CHANNEL_SERVICE_RETURNING = "RETURNING *) ";
    public static final String BUSINESS_CHANNEL_SERVICE_SELECT_TEMPLATE_PROJECT_REF_ACCESS_KIND_OPERATOR_KIND = "SELECT template.project_ref, template.access_kind, template.operator_kind, template.order_kind, ";
    public static final String BUSINESS_CHANNEL_SERVICE_TEMPLATE_DINE_IN_FORM_PROVIDER_CODE_STORE_VISIBILITY_SCOPE = "template.dine_in_form, template.provider_code, template.store_visibility_scope, ";
    public static final String BUSINESS_CHANNEL_SERVICE_TEMPLATE_STATUS = "template.status, EXISTS (SELECT 1 ";
    public static final String BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_CHANNEL = "FROM business_channel.business_channel channel ";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_CHANNEL_WORKSPACE_UUID_TEMPLATE = "WHERE channel.workspace_uuid=template.workspace_uuid ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_CHANNEL_GROUP_WORKSPACE_KEY_TEMPLATE = "AND channel.group_workspace_key=template.group_workspace_key ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_CHANNEL_CHANNEL_CODE_STATUS_VOIDED = "AND channel.channel_code=? AND channel.status <> 'VOIDED') AS channel_code_in_use ";
    public static final String BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_BUSINESS_CHANNEL_TEMPLATE_TEMPLATE = "FROM business_channel.business_channel_template template ";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_TEMPLATE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "WHERE template.workspace_uuid=? AND template.group_workspace_key=? ";
    public static final String BUSINESS_CHANNEL_SERVICE_CONDITION_TEMPLATE_TEMPLATE_REF = "AND template.template_ref=? FOR UPDATE";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF_ALTERNATE_A = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_OF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? FOR UPDATE OF c";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CHANNEL_REF_ALTERNATE_B = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?";
    public static final String BUSINESS_CHANNEL_SERVICE_CTE_ANCESTRY = "WITH RECURSIVE ancestry AS (";
    public static final String BUSINESS_CHANNEL_SERVICE_SELECT_SOURCE_REF_PARENT_ID_NODE_TYPE_STATUS = "SELECT id AS source_ref, id, parent_id, node_type, status, 0 AS depth ";
    public static final String BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_FROM_ORGANIZATION_ORGANIZATI = "FROM organization.organization_node ";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_WHERE_ID_IN = "WHERE id IN (";
    public static final String BUSINESS_CHANNEL_SERVICE_CLOSE_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = ") AND workspace_uuid=? AND group_workspace_key=? ";
    public static final String BUSINESS_CHANNEL_SERVICE_UNION_CHILD_SOURCE_REF_PARENT_PARENT_ID = "UNION ALL SELECT child.source_ref, parent.id, parent.parent_id, ";
    public static final String BUSINESS_CHANNEL_SERVICE_PARENT_NODE_TYPE_STATUS_CHILD = "parent.node_type, parent.status, child.depth+1 ";
    public static final String BUSINESS_CHANNEL_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_CHILD_PARENT_ID = "FROM organization.organization_node parent JOIN ancestry child ON parent.id=child.parent_id ";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=? ) ";
    public static final String BUSINESS_CHANNEL_SERVICE_SELECT_ANCESTRY_SOURCE_REF_NODE_TYPE_STATUS_DEPTH = "SELECT source_ref, node_type, id, status FROM ancestry ORDER BY source_ref, depth DESC";
    public static final String BUSINESS_CHANNEL_SERVICE_INSERT_INTO_AUDIT_EVENT_EVENT_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "INSERT INTO business_channel.audit_event (event_ref, workspace_uuid, group_workspace_key, ";
    public static final String BUSINESS_CHANNEL_SERVICE_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT_ENTITY_TYPE = "actor_type, actor_id, actor_display_snapshot, entity_type, entity_ref, action, ";
    public static final String BUSINESS_CHANNEL_SERVICE_CHANGES_JSON_OCCURRED_AT_EPOCH_MILLIS = "changes_json, occurred_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
    public static final String CHANNEL_LOCK_SUFFIX = " FOR UPDATE OF c";
    public static final String BUSINESS_CHANNEL_SERVICE_WHERE_C_WORKSPACE_UUID_AND_C_GROUP_WORKSPACE_KEY_AND_C_TARGET_NODE_TYPE_AND_TARGET_NODE_TYPE_AND_C_TARGET_NODE_REF = """
    \sWHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.target_node_type=? AND c.target_node_ref=?""";

}
