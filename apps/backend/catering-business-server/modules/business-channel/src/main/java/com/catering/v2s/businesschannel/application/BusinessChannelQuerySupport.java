package com.catering.v2s.businesschannel.application;

/**
 * Shared, pure SQL projection builders for channel task reads and channel lifecycle commands.
 *
 * <p>This class deliberately contains no JDBC handle, transaction, owner command, lock, receipt, or business
 * mutation. It prevents the two channel read paths from drifting while leaving each target responsible for its own
 * facts, mapping, authorization, and transaction boundary.
 */
final class BusinessChannelQuerySupport {
    static final int BOUNDED_READ_LIMIT = 100;

    private BusinessChannelQuerySupport() {}

    static String channelSelect(String suffix) {
        return channelProjection(
                        "JOIN business_channel.business_channel_template t "
                                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                                + "AND t.group_workspace_key=c.group_workspace_key ")
                + suffix;
    }

    static String channelCommandSelect(String suffix) {
        return channelSelect(suffix);
    }

    static String insertedChannelProjection() {
        return channelSelect("")
                .replace("FROM business_channel.business_channel c ", "FROM inserted c ");
    }

    static String channelProjection(String templateJoin) {
        return "SELECT c.channel_ref, c.workspace_uuid, c.group_workspace_key, c.template_ref, "
                + "c.target_node_type, c.target_node_ref, c.channel_code, "
                + "c.channel_name, c.binding_ref, t.access_kind AS template_access_kind, c.status, c.version, "
                + "t.project_ref AS template_project_ref, t.template_name, t.template_code, "
                + "t.operator_kind AS template_operator_kind, t.order_kind AS template_order_kind, "
                + "t.dine_in_form AS template_dine_in_form, t.provider_code AS template_provider_code, "
                + "t.status AS template_status, t.version AS template_version, "
                + "template_project.status AS template_project_status, "
                + "target_project.id AS target_project_ref, "
                + "CASE WHEN c.target_node_type='PROJECT' THEN target_project.status ELSE target_store.status END "
                + "AS target_node_status, target_store.project_id AS target_store_project_ref, "
                + "target_store_project.status AS target_store_project_status, "
                + "target_store.status AS target_store_status, "
                + "target_tenant.id AS target_tenant_ref, target_tenant.status AS target_tenant_status, "
                + "target_brand.id AS target_brand_ref, target_brand.status AS target_brand_status, "
                + "binding.status AS binding_lifecycle_status, provider.status AS provider_status "
                + "FROM business_channel.business_channel c "
                + templateJoin
                + "LEFT JOIN organization.organization_node template_project "
                + "ON template_project.id=t.project_ref AND template_project.workspace_uuid=c.workspace_uuid "
                + "AND template_project.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.organization_node target_project "
                + "ON c.target_node_type='PROJECT' AND target_project.id::text=c.target_node_ref "
                + "AND target_project.workspace_uuid=c.workspace_uuid "
                + "AND target_project.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.store target_store "
                + "ON c.target_node_type='STORE' AND target_store.id::text=c.target_node_ref "
                + "AND target_store.workspace_uuid=c.workspace_uuid "
                + "AND target_store.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.organization_node target_store_project "
                + "ON target_store_project.id=target_store.project_id "
                + "AND target_store_project.workspace_uuid=c.workspace_uuid "
                + "AND target_store_project.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.tenant target_tenant ON target_tenant.id=target_store.tenant_id "
                + "AND target_tenant.workspace_uuid=c.workspace_uuid "
                + "AND target_tenant.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.brand target_brand ON target_brand.id=target_store.brand_id "
                + "AND target_brand.workspace_uuid=c.workspace_uuid "
                + "AND target_brand.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN collaboration.owner_binding binding ON binding.binding_ref=c.binding_ref "
                + "AND binding.workspace_uuid=c.workspace_uuid AND binding.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN collaboration.provider_profile_enablement provider "
                + "ON provider.provider_code=t.provider_code AND provider.workspace_uuid=c.workspace_uuid "
                + "AND provider.group_workspace_key=c.group_workspace_key ";
    }
}
