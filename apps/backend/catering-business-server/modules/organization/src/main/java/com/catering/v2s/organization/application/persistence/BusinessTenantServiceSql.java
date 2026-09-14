package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by BusinessTenantService; B3 relocates text only and does not change execution. */
public final class BusinessTenantServiceSql {
    public static final String BUSINESS_TENANT_SERVICE_INSERT_INTO_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME = "INSERT INTO organization.tenant (id, workspace_uuid, group_workspace_key, code, name, legal_name, ";
    public static final String BUSINESS_TENANT_SERVICE_CONTINUATION_CREDIT_CODE_REMARK_STATUS_VERSION = "credit_code, remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) ";
    public static final String BUSINESS_TENANT_SERVICE_VALUES_ENABLED = "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)";
    public static final String BUSINESS_TENANT_SERVICE_UPDATE_TENANT_CODE_NAME_LEGAL_NAME_CREDIT_CODE = "UPDATE organization.tenant SET code=?, name=?, legal_name=?, credit_code=?, remark=?, version=version+1, ";
    public static final String BUSINESS_TENANT_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION = "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_TENANT_SERVICE_UPDATE_TENANT_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS = "UPDATE organization.tenant SET status=?, version=version+1, updated_at_epoch_millis=? ";
    public static final String BUSINESS_TENANT_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_VERSION = "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?";
    public static final String BUSINESS_TENANT_SERVICE_CONDITION_AND_ID = " AND id<>?";
    public static final String BUSINESS_TENANT_SERVICE_SELECT_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT EXISTS(SELECT 1 FROM organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String BUSINESS_TENANT_SERVICE_CONDITION_STATUS_VOIDED_CODE = "AND status <> 'VOIDED' AND code=?";
    public static final String BUSINESS_TENANT_SERVICE_UPDATE_TENANT_EXTENSION_VALUES_EXTENSION_RULE_REVISION = "UPDATE organization.tenant SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?";
    public static final String BUSINESS_TENANT_SERVICE_UPDATE_TENANT_EXTENSION_VALUES_EXTENSION_RULE_REVISION_ALTERNATE_A = "UPDATE organization.tenant SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?";
    public static final String BUSINESS_TENANT_SERVICE_UPDATE_TENANT_EXTENSION_VALUES_EXTENSION_RULE_REVISION_ALTERNATE_B = "UPDATE organization.tenant SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?";
    public static final String BUSINESS_TENANT_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE = "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String BUSINESS_TENANT_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT = "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String BUSINESS_TENANT_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON = "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))";
    public static final String CODE_CONFLICT_EXISTS_SUFFIX = "organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? AND status <> 'VOIDED' AND ";
    public static final String CODE_NAME_CONFLICT_SEPARATOR = ") AS code_conflict, EXISTS(SELECT 1 FROM ";
    public static final String NAME_CONFLICT_PREDICATE = "lower(btrim(name))=?";
}
