package com.catering.v2s.organization.application.persistence;

/**
 * SQL text fragments owned by OrganizationGroupWorkspaceInitializationTaskReadService; B3 relocates text only and does
 * not change execution.
 */
public final class OrganizationGroupWorkspaceInitializationTaskReadServiceSql {
    public static final String ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP =
            "SELECT group_workspace_key FROM organization.commercial_group WHERE group_workspace_key = ";
    public static final String ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_TEXT = "ANY(?::text[])";
    public static final String
            ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP_UUID =
                    "SELECT commercial_group_uuid, commercial_group_code, commercial_group_name, version, ";
    public static final String ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_AUDIT_COLUMNS_PREFIX =
            "created_by_platform_subject, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_COMMERCIAL_GROUP =
            "extension_values::text, extension_rule_revision FROM organization.commercial_group WHERE ";
    public static final String ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY =
            "group_workspace_key=?";
}
