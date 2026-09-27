package com.catering.v2s.businesschannel.application.persistence;

/**
 * Shared, pure SQL projection builders for business-channel persistence execution.
 *
 * <p>This class deliberately has no JDBC handle, transaction, owner command, lock, receipt, or business mutation. The
 * persistence execution classes own the SQL sinks; this helper only keeps the channel projection shape from drifting
 * between channel, template, and task-read queries.
 */
final class BusinessChannelQuerySupport {
    static final int BOUNDED_READ_LIMIT = 100;

    private BusinessChannelQuerySupport() {}

    static String channelSelect(String suffix) {
        return channelProjection(BusinessChannelQuerySupportSql.JOIN_BIZ_CHANNEL_TEMPLATE_JOIN_001
                        + BusinessChannelQuerySupportSql
                                .BUSINESS_CHANNEL_QUERY_SUPPORT_JOIN_CONDITION_TEMPLATE_REF_WORKSPACE_UUID
                        + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_GROUP_WORKSPACE_KEY)
                + suffix;
    }

    static String channelCommandSelect(String suffix) {
        return channelSelect(suffix);
    }

    static String insertedChannelProjection() {
        return channelSelect("")
                .replace(
                        BusinessChannelQuerySupportSql.FROM_CLAUSE_BIZ_CHANNEL_FROM_002,
                        BusinessChannelQuerySupportSql
                                .BUSINESS_CHANNEL_QUERY_SUPPORT_FROM_CLAUSE_INSERTED_FROM_INSERTED_C);
    }

    static String channelProjection(String templateJoin) {
        return BusinessChannelQuerySupportSql.SELECT_CHANNEL_REF_WS_UUID_003
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_NODE_TYPE_TARGET_NODE_REF_CHANNEL_CODE
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CHANNEL_NAME
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_PROJECT_REF
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_OPERATOR_KIND
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_DINE_IN_FORM
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_STATUS_TEMPLATE_STATUS_VERSION_TEMPLATE_VERSION
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_TEMPLATE_PROJECT_STATUS_TEMPLATE_PROJECT_STATUS
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_PROJECT_TARGET_PROJECT_REF
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CASE_TARGET_NODE_TYPE_PROJECT_TARGET_PROJECT_STATUS
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_NODE_STATUS
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_STORE_PROJECT_STATUS_TARGET_STORE_PROJECT_STATUS
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_STORE_STATUS_TARGET_STORE_STATUS
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_TENANT
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_TARGET_BRAND_TARGET_BRAND_REF_STATUS_TARGET_BRAND_STATUS
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_BINDING_STATUS_BINDING_LIFECYCLE_STATUS_PROVIDER
                + BusinessChannelQuerySupportSql.FROM_CLAUSE_BIZ_CHANNEL_FROM_ALT_A_004
                + templateJoin
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_ORGANIZATION_NODE_TEMPLATE_PROJECT
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_JOIN_CONDITION_TEMPLATE_PROJECT_PROJECT_REF_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TEMPLATE_PROJECT_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_ORGANIZATION_NODE_TARGET_PROJECT
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_JOIN_CONDITION_TARGET_NODE_TYPE_PROJECT_TARGET_PROJECT_TEXT
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_PROJECT_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_PROJECT_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_STORE_TARGET_STORE
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_JOIN_CONDITION_TARGET_NODE_TYPE_STORE_TARGET_STORE_TEXT
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_STORE_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_STORE_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_ORGANIZATION_NODE_TARGET_STORE_PROJECT
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_JOIN_CONDITION_TARGET_STORE_PROJECT_TARGET_STORE_PROJECT_ID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_STORE_PROJECT_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_STORE_PROJECT_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_TENANT_TARGET_TENANT_TARGET_STORE_TENANT_ID
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_TENANT_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_TENANT_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_BRAND_TARGET_BRAND_TARGET_STORE_BRAND_ID
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_BRAND_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_TARGET_BRAND_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_OWNER_BINDING_BINDING_BINDING_REF
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_BINDING_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_PROVIDER_PROFILE_ENABLEMENT_PROVIDER
                + BusinessChannelQuerySupportSql
                        .BUSINESS_CHANNEL_QUERY_SUPPORT_JOIN_CONDITION_PROVIDER_PROVIDER_CODE_WORKSPACE_UUID
                + BusinessChannelQuerySupportSql.BUSINESS_CHANNEL_QUERY_SUPPORT_CONDITION_PROVIDER_GROUP_WORKSPACE_KEY;
    }
}
