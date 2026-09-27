package com.catering.v2s.contract.application.persistence;

/** SQL text fragments owned by ContractCommandService; B3 relocates text only and does not change execution. */
public final class ContractCommandServiceSql {
    public static final String INSERT_INTO_STORE_CONTRACT_WS_001 =
            "INSERT INTO contract.store_contract (id, workspace_uuid, group_workspace_key, contract_no, ";
    public static final String CONTRACT_COMMAND_SERVICE_STORE_ID_TENANT_ID_EFFECTIVE_FROM_EFFECTIVE_TO =
            "store_id, tenant_id, effective_from, effective_to, phase_name_snapshot, notes, ";
    public static final String CONTRACT_COMMAND_SERVICE_ITEMS_JSON_EXTENSION_VALUES_EXTENSION_RULE_REVISION =
            "items_json, extension_values, extension_rule_revision, ";
    public static final String CONTRACT_COMMAND_SERVICE_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS =
            "status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ";
    public static final String CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER = "?, ";
    public static final String CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ACTIVE =
            "?, ?, ?, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB), ?, 'ACTIVE', 1, ?, ?)";
    public static final String UPDATE_STORE_CONTRACT_EFFECTIVE_FROM_002 =
            "UPDATE contract.store_contract SET effective_from=?, effective_to=?, phase_name_snapshot=?, ";
    public static final String CONTRACT_COMMAND_SERVICE_NOTES_ITEMS_JSON_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "notes=?, items_json=CAST(? AS JSONB), version=version+1, updated_at_epoch_millis=? ";
    public static final String CONTRACT_COMMAND_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE =
            "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE' AND ";
    public static final String CONTRACT_COMMAND_SERVICE_VERSION = "version=?";
    public static final String INSERT_INTO_STORE_CONTRACT_WS_ALT_A_003 =
            "INSERT INTO contract.store_contract (id, workspace_uuid, group_workspace_key, contract_no, ";
    public static final String CONTRACT_COMMAND_SERVICE_STORE_ID_TENANT_ID_EFFECTIVE_FROM_EFFECTIVE_TO_ALTERNATE_A =
            "store_id, tenant_id, effective_from, effective_to, phase_name_snapshot, notes, ";
    public static final String CONTRACT_COMMAND_SERVICE_ITEMS_JSON = "items_json, ";
    public static final String STATUS_VER_CREATED_AT_EPOCH_ALT_A_004 =
            "status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ";
    public static final String CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_A = "?, ";
    public static final String CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ACTIVE_ALTERNATE_A =
            "?, ?, ?, ?, ?, CAST(? AS JSONB), 'ACTIVE', 1, ?, ?)";
    public static final String UPDATE_STORE_CONTRACT_EFFECTIVE_FROM_ALT_A_005 =
            "UPDATE contract.store_contract SET effective_from=?, effective_to=?, phase_name_snapshot=?, ";
    public static final String CONTRACT_COMMAND_SERVICE_NOTES_ITEMS_JSON_VERSION_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "notes=?, items_json=CAST(? AS JSONB), version=version+1, updated_at_epoch_millis=? ";
    public static final String WHERE_WS_UUID_GRP_WS_ALT_A_006 =
            "WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE' AND ";
    public static final String CONTRACT_COMMAND_SERVICE_VERSION_ALTERNATE_A = "version=?";
    public static final String UPDATE_STORE_CONTRACT_STATUS_INVALID_007 =
            "UPDATE contract.store_contract SET status='INVALID', invalidated_at_epoch_millis=?, ";
    public static final String CONTRACT_COMMAND_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_WORKSPACE_UUID =
            "version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND ";
    public static final String CONTRACT_COMMAND_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ACTIVE_VERSION =
            "group_workspace_key=? AND status='ACTIVE' AND version=?";
    public static final String CONTRACT_COMMAND_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CONTRACT_NO_STORE_ID =
            "SELECT id, workspace_uuid, group_workspace_key, contract_no, store_id, tenant_id, effective_from, ";
    public static final String CONTRACT_COMMAND_SERVICE_EFFECTIVE_TO_PHASE_NAME_SNAPSHOT_NOTES_STATUS =
            "effective_to, phase_name_snapshot, notes, status, version, items_json::text FROM ";
    public static final String CONTRACT_COMMAND_SERVICE_STORE_CONTRACT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "contract.store_contract WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String SELECT_WS_UUID_GRP_WS_ALT_A_008 =
            ("SELECT id, workspace_uuid, group_workspace_key, contract_no, store_id, t" + "enant_id, effective_from, ");
    public static final String CONTRACT_COMMAND_SERVICE_EFFECTIVE_TO_PHASE_NAME_SNAPSHOT_NOTES_STATUS_ALTERNATE_A =
            "effective_to, phase_name_snapshot, notes, status, version, items_json::text, ";
    public static final String CONTRACT_COMMAND_SERVICE_STORE_CONTRACT_EXTENSION_VALUES_TEXT_WORKSPACE_UUID =
            "extension_values::text FROM contract.store_contract WHERE id=? AND workspace_uuid=? AND ";
    public static final String CONTRACT_COMMAND_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=?";
    public static final String SELECT_WS_UUID_GRP_WS_ALT_B_009 =
            ("SELECT id, workspace_uuid, group_workspace_key, contract_no, store_id, t" + "enant_id, effective_from, ");
    public static final String CONTRACT_COMMAND_SERVICE_EFFECTIVE_TO_PHASE_NAME_SNAPSHOT_NOTES_STATUS_ALTERNATE_B =
            "effective_to, phase_name_snapshot, notes, status, version, items_json::text FROM ";
    public static final String CONTRACT_COMMAND_SERVICE_STORE_CONTRACT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A =
            "contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY ";
    public static final String CONTRACT_COMMAND_SERVICE_CONTRACT_NO = "contract_no";
    public static final String CONTRACT_COMMAND_SERVICE_SELECT_STORE_CONTRACT_EXTENSION_VALUES_TEXT =
            "SELECT extension_values::text FROM contract.store_contract WHERE id=?";
    public static final String CONTRACT_COMMAND_SERVICE_UPDATE_STORE_CONTRACT_EXTENSION_VALUES_EXTENSION_RULE_REVISION =
            "UPDATE contract.store_contract SET extension_values=CAST(? AS JSONB), extension_rule_revision=? ";
    public static final String CONTRACT_COMMAND_SERVICE_WHERE_WHERE_ID = "WHERE id=?";
    public static final String UPDATE_STORE_CONTRACT_EXTENSION_VALUES_ALT_A_010 =
            ("UPDATE contract.store_contract SET extension_values=CAST(? AS JSONB), ex"
                    + "tension_rule_revision=? WHERE ");
    public static final String CONTRACT_COMMAND_SERVICE_ID = "id=?";
    public static final String CONTRACT_COMMAND_SERVICE_SELECT_STORE_CONTRACT_EXTENSION_VALUES_TEXT_ALTERNATE_A =
            "SELECT extension_values::text FROM contract.store_contract WHERE id=?";
    public static final String UPDATE_STORE_CONTRACT_EXTENSION_VALUES_ALT_B_011 =
            "UPDATE contract.store_contract SET extension_values=CAST(? AS JSONB), extension_rule_revision=? ";
    public static final String CONTRACT_COMMAND_SERVICE_WHERE_WHERE_ID_ALTERNATE_A = "WHERE id=?";
    public static final String UPDATE_STORE_CONTRACT_EXTENSION_VALUES_ALT_C_012 =
            ("UPDATE contract.store_contract SET extension_values=CAST(? AS JSONB), ex"
                    + "tension_rule_revision=? WHERE ");
    public static final String CONTRACT_COMMAND_SERVICE_ID_ALTERNATE_A = "id=?";
    public static final String INSERT_INTO_AUDIT_EVENT_WS_013 =
            "INSERT INTO contract.audit_event (id, workspace_uuid, group_workspace_key, entity_type, ";
    public static final String CONTRACT_COMMAND_SERVICE_ENTITY_REF_TEXT_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT =
            "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, ";
    public static final String CONTRACT_COMMAND_SERVICE_OCCURRED_AT_EPOCH_MILLIS_CHANGES_JSON_STORE_CONTRACT =
            "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'STORE_CONTRACT', ?, ?, ?, ?, ?, ";
    public static final String CONTRACT_COMMAND_SERVICE_PARAMETER_PLACEHOLDER_ALTERNATE_B = "?, ";
    public static final String CONTRACT_COMMAND_SERVICE_CAST_AS_JSONB = "CAST(? AS JSONB))";
}
