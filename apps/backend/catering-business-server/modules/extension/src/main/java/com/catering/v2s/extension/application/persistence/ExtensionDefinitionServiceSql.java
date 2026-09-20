package com.catering.v2s.extension.application.persistence;

/** SQL text owned by ExtensionDefinitionPersistence. */
public final class ExtensionDefinitionServiceSql {
    public static final String EXTENSION_DEFINITION_SERVICE_SELECT_EXTENSION_DEFINITION =
            "SELECT definitions::text, revision, updated_at_epoch_millis FROM extension.extension_definition WHERE ";
    public static final String EXTENSION_DEFINITION_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE = "workspace_uuid=? AND group_workspace_key=? AND entity_type=?";
    public static final String EXTENSION_DEFINITION_SERVICE_SELECT_ENTITY_TYPE_DEFINITIONS_TEXT_REVISION =
            "SELECT entity_type, definitions::text, revision, updated_at_epoch_millis FROM ";
    public static final String EXTENSION_DEFINITION_SERVICE_EXTENSION_DEFINITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "extension.extension_definition WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY ";
    public static final String EXTENSION_DEFINITION_SERVICE_ENTITY_TYPE = "entity_type";
    public static final String EXTENSION_DEFINITION_SERVICE_INSERT_INTO_EXTENSION_DEFINITION = "INSERT INTO extension.extension_definition (workspace_uuid, group_workspace_key, entity_type, ";
    public static final String EXTENSION_DEFINITION_SERVICE_DEFINITIONS_REVISION_UPDATED_AT_EPOCH_MILLIS = "definitions, revision, updated_at_epoch_millis) VALUES (?, ?, ?, CAST(? AS JSONB), 1, ";
    public static final String EXTENSION_DEFINITION_SERVICE_PARAMETER_PLACEHOLDER = "?)";
    public static final String EXTENSION_DEFINITION_SERVICE_UPDATE_EXTENSION_DEFINITION_DEFINITIONS_REVISION = "UPDATE extension.extension_definition SET definitions=CAST(? AS JSONB), revision=?, ";
    public static final String EXTENSION_DEFINITION_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "updated_at_epoch_millis=? WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String EXTENSION_DEFINITION_SERVICE_ENTITY_TYPE_REVISION = "entity_type=? AND revision=?";
    public static final String EXTENSION_DEFINITION_SERVICE_SELECT_EXTENSION_DEFINITION_DEFINITIONS_TEXT_REVISION_WORKSPACE_UUID = "SELECT definitions::text, revision FROM extension.extension_definition WHERE workspace_uuid=? AND ";
    public static final String EXTENSION_DEFINITION_SERVICE_GROUP_WORKSPACE_KEY_ENTITY_TYPE = "group_workspace_key=? AND entity_type=?";
    public static final String EXTENSION_DEFINITION_SERVICE_SELECT_DEFINITION_HISTORY_CHANGES = """
            SELECT changes_json::text
              FROM extension.audit_event
             WHERE workspace_uuid=?
               AND group_workspace_key=?
               AND entity_type='EXTENSION_DEFINITION'
               AND entity_ref_text=?
               AND action='EXTENSION_DEFINITION_REPLACED'
             ORDER BY occurred_at_epoch_millis, id
            """;
    public static final String EXTENSION_DEFINITION_SERVICE_INSERT_INTO_AUDIT_EVENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ENTITY_TYPE = "INSERT INTO extension.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String EXTENSION_DEFINITION_SERVICE_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT = "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String EXTENSION_DEFINITION_SERVICE_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_EXTENSION_DEFINITION = "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'EXTENSION_DEFINITION', ?, ?, ?, ";
    public static final String EXTENSION_DEFINITION_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_A = "?, ";
    public static final String EXTENSION_DEFINITION_SERVICE_EXTENSION_DEFINITION_REPLACED = "'EXTENSION_DEFINITION_REPLACED', ?, CAST(? AS JSONB))";
}
