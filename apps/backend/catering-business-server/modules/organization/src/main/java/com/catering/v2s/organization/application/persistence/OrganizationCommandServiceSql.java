package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by OrganizationCommandService; B3 relocates text only and does not change execution. */
public final class OrganizationCommandServiceSql {
    public static final String ORGANIZATION_COMMAND_SERVICE_SELECT_GROUP_WORKSPACE_KEY = "SELECT group_workspace_key, request_fingerprint, commercial_group_id, commercial_group_code, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_IDEMPOTENCY_COMMERCIAL_GROUP_NAME = "commercial_group_name FROM organization.commercial_group_idempotency WHERE ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_WORKSPACE_UUID_IDEMPOTENCY_KEY = "workspace_uuid = ? AND idempotency_key = ?";
    public static final String ORGANIZATION_COMMAND_SERVICE_INSERT_INTO_COMMERCIAL_GROUP_IDEMPOTENCY_WORKSPACE_UUID_IDEMPOTENCY_KEY = "INSERT INTO organization.commercial_group_idempotency (workspace_uuid, idempotency_key, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_REQUEST_FINGERPRINT = "group_workspace_key, request_fingerprint) VALUES (?, ?, ?, ?)";
    public static final String ORGANIZATION_COMMAND_SERVICE_INSERT_INTO_COMMERCIAL_GROUP = """
                INSERT INTO organization.commercial_group
                    (group_workspace_key, group_workspace_id, commercial_group_code, commercial_group_name, \
                    created_by_platform_subject, commercial_group_uuid, created_at_epoch_millis, \
                    updated_at_epoch_millis, extension_values, extension_rule_revision)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), ?)
                RETURNING id
                """;
    public static final String ORGANIZATION_COMMAND_SERVICE_UPDATE_COMMERCIAL_GROUP_IDEMPOTENCY_COMMERCIAL_GROUP_ID = "UPDATE organization.commercial_group_idempotency SET commercial_group_id = ?, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_CODE_COMMERCIAL_GROUP_NAME_WORKSPACE_UUID = "commercial_group_code = ?, commercial_group_name = ? WHERE workspace_uuid = ? AND ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_IDEMPOTENCY_KEY = "idempotency_key = ?";
    public static final String ORGANIZATION_COMMAND_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE = "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT = "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_GROUP_WORKSPACE = "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'GROUP_WORKSPACE', ?, ?, ?, ?, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_INITIALIZED = "'COMMERCIAL_GROUP_INITIALIZED', ?, CAST(? AS JSONB))";
    public static final String ORGANIZATION_COMMAND_SERVICE_UPDATE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE = "UPDATE organization.commercial_group SET commercial_group_code=?, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_NAME_EXTENSION_VALUES = "commercial_group_name=?, extension_values=CAST(? AS JSONB), ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_EXTENSION_RULE_REVISION_VERSION_UPDATED_AT_EPOCH_MILLIS = "extension_rule_revision=?, version=version+1, updated_at_epoch_millis=? WHERE ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY_VERSION = "commercial_group_uuid=? AND group_workspace_key=? AND version=? RETURNING ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_UUID = "commercial_group_uuid, group_workspace_key, commercial_group_code, commercial_group_name, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_VERSION = "version, created_by_platform_subject, created_at_epoch_millis, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis, extension_values::text, extension_rule_revision";
    public static final String ORGANIZATION_COMMAND_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE_ALTERNATE_A = "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT_ALTERNATE_A = "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_COMMERCIAL_GROUP = "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'COMMERCIAL_GROUP', ?, ?, ?, ?, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_UPDATED = "'COMMERCIAL_GROUP_UPDATED', ?, CAST(? AS JSONB))";
    public static final String ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_UUID = "SELECT commercial_group_uuid, commercial_group_code, commercial_group_name, version, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_CREATED_BY_PLATFORM_SUBJECT = "created_by_platform_subject, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP = "extension_values::text, extension_rule_revision FROM organization.commercial_group WHERE ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY = "group_workspace_key=?";
    public static final String ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY = "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?";
    public static final String ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID = "SELECT EXISTS(SELECT 1 FROM organization.commercial_group WHERE commercial_group_uuid=? AND ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ALTERNATE_A = "group_workspace_key=?)";
    public static final String ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE_COMMERCIAL_GROUP_NAME = "SELECT commercial_group_code, commercial_group_name FROM organization.commercial_group WHERE ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_UUID_GROUP_WORKSPACE_KEY = "commercial_group_uuid=? AND group_workspace_key=?";
    public static final String ORGANIZATION_COMMAND_SERVICE_SELECT_COMMERCIAL_GROUP_UUID_ALTERNATE_A = "SELECT commercial_group_uuid, version, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_COMMERCIAL_GROUP_ALTERNATE_A = "extension_values::text, extension_rule_revision FROM organization.commercial_group WHERE ";
    public static final String ORGANIZATION_COMMAND_SERVICE_CONTINUATION_ID = "id=?";
}
