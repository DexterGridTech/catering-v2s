package com.catering.v2s.contract.application.persistence;

/** SQL text fragments owned by ContractTaskReadService; B3 relocates text only and does not change execution. */
public final class ContractTaskReadServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CONTRACT_NO_ORDER = "c.contract_no";
    public static final String EFFECTIVE_FROM_ORDER = "c.effective_from";
    public static final String UPDATED_AT_ORDER = "c.updated_at_epoch_millis";
    public static final String CONTRACT_NO_COLUMN = "contract_no";
    public static final String EFFECTIVE_FROM_COLUMN = "effective_from";
    public static final String UPDATED_AT_COLUMN = "updated_at_epoch_millis";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String SQL_SPACE = " ";
    public static final String CONTRACT_PAGE_TIE_BREAKER_SUFFIX = ", c.id ASC LIMIT ? OFFSET ?";
    public static final String FIXED_STORE_VIEW_CURRENT =
            "c.status='ACTIVE' AND c.effective_from<=? AND (c.effective_to IS NULL OR c.effective_to>=?)";
    public static final String FIXED_STORE_VIEW_PENDING = "c.status='ACTIVE' AND c.effective_from>?";
    public static final String FIXED_STORE_VIEW_HISTORY = "c.status='ACTIVE' AND c.effective_to<?";
    public static final String FIXED_STORE_VIEW_INVALID = "c.status='INVALID'";
    public static final String DERIVED_STORE_STATUS_GROUP_SUFFIX = ") GROUP BY store_id";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_GROUP_WORKSPACE_KEY_CONTRACT_NO_CODE_NAME = "SELECT c.id, c.group_workspace_key, c.contract_no, p.id, p.code, p.name, c.store_id, s.code, s.name, ";
    public static final String CONTRACT_TASK_READ_SERVICE_TENANT_ID_CODE_NAME_PHASE_NAME_SNAPSHOT = "c.tenant_id, t.code, t.name, c.phase_name_snapshot, c.notes, c.effective_from, c.effective_to, ";
    public static final String CONTRACT_TASK_READ_SERVICE_STATUS = "c.status, c.version, c.created_at_epoch_millis, c.updated_at_epoch_millis, ";
    public static final String CONTRACT_TASK_READ_SERVICE_EXTENSION_VALUES_TEXT_EXTENSION_RULE_REVISION_ITEMS_JSON = "c.extension_values::text, c.extension_rule_revision, c.items_json::text";
    public static final String CONTRACT_TASK_READ_SERVICE_FROM_CLAUSE_STORE_STORE_ID = " FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN ";
    public static final String CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ORGANIZATION_NODE_PROJECT_ID = "organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON ";
    public static final String CONTRACT_TASK_READ_SERVICE_TENANT_ID = "t.id=c.tenant_id";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_GROUP_WORKSPACE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT workspace_uuid FROM platform_workspace.group_workspace WHERE group_workspace_key=?";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME_WORKSPACE_UUID = "SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_PROJECT = "group_workspace_key=? AND node_type='PROJECT'";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_STATUS_WORKSPACE_UUID = "SELECT id, code, name, status FROM organization.store WHERE workspace_uuid=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_PROJECT_ID_CODE_ILIKE = "group_workspace_key=? AND project_id=? AND (?='' OR code ILIKE ? ESCAPE '!' OR name ILIKE ? ";
    public static final String CONTRACT_TASK_READ_SERVICE_ESCAPE_CODE = "ESCAPE '!') ORDER BY code LIMIT ? OFFSET ?";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_STATUS_WORKSPACE_UUID_ALTERNATE_A = "SELECT id, code, name, status FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_PROJECT_ID = "group_workspace_key=? AND project_id=?";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "SELECT COUNT(*) FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_PROJECT_ID_CODE_ILIKE_ESCAPE = "project_id=? AND (?='' OR code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!')";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_PROJECT_PHASE_NAME_PHASE_NAME_PROJECT_ID_DISPLAY_ORDER = "SELECT phase_name FROM organization.project_phase_name WHERE project_id=? ORDER BY display_order";
    public static final String CONTRACT_TASK_READ_SERVICE_CTE_SELECTED_CODE_NAME_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = """
            WITH project AS (SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? \
            AND group_workspace_key=? AND node_type='PROJECT'),
            filtered AS MATERIALIZED (SELECT s.id, s.code, s.name, s.status, COUNT(*) OVER () AS total FROM \
            organization.store s JOIN project p ON p.id=s.project_id WHERE s.workspace_uuid=? AND \
            s.group_workspace_key=? AND (?='' OR s.code ILIKE ? ESCAPE '!' OR s.name ILIKE ? ESCAPE '!')),
            paged AS (SELECT * FROM filtered ORDER BY code, id LIMIT ? OFFSET ?),
            selected AS (SELECT s.id, t.id AS tenant_id, t.code AS tenant_code, t.name AS tenant_name FROM \
            organization.store s JOIN organization.tenant t ON t.id=s.tenant_id JOIN project p ON p.id=s.project_id \
            WHERE s.id=? AND s.workspace_uuid=? AND s.group_workspace_key=?),
            phases AS (SELECT COALESCE(jsonb_agg(phase_name ORDER BY display_order), '[]'::jsonb)::text AS value FROM \
            organization.project_phase_name WHERE project_id=?)
            SELECT p.id, p.code, p.name, COALESCE((SELECT MAX(total) FROM paged), (SELECT COUNT(*) FROM filtered)),
                   selected.tenant_id, selected.tenant_code, selected.tenant_name,
                   COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'status', \
                   status) ORDER BY code, id) FROM paged), '[]'::jsonb)::text,
                   phases.value
            FROM project p CROSS JOIN phases LEFT JOIN selected ON TRUE
            """;
    public static final String CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_ID = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_id=? ORDER BY ";
    public static final String CONTRACT_TASK_READ_SERVICE_CONTRACT_NO = "c.contract_no";
    public static final String CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_ID_ALTERNATE_A = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_id=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_SELECT_COUNT = "SELECT COUNT(*)";
    public static final String CONTRACT_TASK_READ_SERVICE_ORDER_BY_CONTRACT_NO = " ORDER BY c.contract_no LIMIT ? OFFSET ?";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME = "SELECT p.id, p.code, p.name FROM organization.store s JOIN organization.organization_node p ON ";
    public static final String CONTRACT_TASK_READ_SERVICE_PROJECT_ID_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = "p.id=s.project_id WHERE s.id=? AND s.workspace_uuid=? AND s.group_workspace_key=?";
    public static final String CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROJECT_ID = " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND (?::uuid IS NULL OR s.project_id=?)";
    public static final String CONTRACT_TASK_READ_SERVICE_CONDITION_STORE_ID_TENANT_ID_TEXT = " AND (?::uuid IS NULL OR c.store_id=?) AND (?::uuid IS NULL OR c.tenant_id=?) AND (?::text IS NULL ";
    public static final String CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_CONTRACT_NO_ILIKE_ESCAPE = "OR c.contract_no ILIKE ? ESCAPE '!')";
    public static final String CONTRACT_TASK_READ_SERVICE_CONDITION_TEXT_PHASE_NAME_SNAPSHOT_ILIKE_ESCAPE = " AND (?::text IS NULL OR c.phase_name_snapshot ILIKE ? ESCAPE '!')";
    public static final String CONTRACT_TASK_READ_SERVICE_CONDITION_JSONB_ARRAY_ELEMENTS_TEXT_ITEMS_JSON = " AND (?::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.items_json) ci WHERE ";
    public static final String CONTRACT_TASK_READ_SERVICE_CODE_ILIKE_ESCAPE = "ci->>'code' ILIKE ? ESCAPE '!'))";
    public static final String CONTRACT_TASK_READ_SERVICE_CONDITION_DATE_EFFECTIVE_FROM_EFFECTIVE_TO = " AND (?::date IS NULL OR c.effective_from>=?) AND (?::date IS NULL OR c.effective_to IS NULL OR ";
    public static final String CONTRACT_TASK_READ_SERVICE_EFFECTIVE_TO_TEXT_STATUS = "c.effective_to<=?) AND (?::text IS NULL OR c.status=?)";
    public static final String CONTRACT_TASK_READ_SERVICE_FROM_CLAUSE_STORE_STORE_ID_ALTERNATE_A = " FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN ";
    public static final String CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ORGANIZATION_NODE_PROJECT_ID_ALTERNATE_A = "organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON ";
    public static final String CONTRACT_TASK_READ_SERVICE_TENANT_ID_ALTERNATE_A = "t.id=c.tenant_id";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_SELECT_COUNT_ALTERNATE_A = "SELECT COUNT(*)";
    public static final String CONTRACT_TASK_READ_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String CONTRACT_TASK_READ_SERVICE_CTE_PROJECT_META_NAME_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_NODE_TYPE = """
            WITH project_meta AS (SELECT id, name FROM organization.organization_node WHERE ?::uuid IS NOT NULL AND \
            id=? AND workspace_uuid=? AND group_workspace_key=? AND node_type='PROJECT'),
            filtered AS MATERIALIZED (SELECT c.id AS contract_id, c.group_workspace_key, c.contract_no, p.id AS \
            project_id, p.code, p.name, c.store_id, s.code, s.name, c.tenant_id, t.code, t.name, \
            c.phase_name_snapshot, c.notes, c.effective_from, c.effective_to, c.status, c.version, \
            c.created_at_epoch_millis, c.updated_at_epoch_millis, c.extension_values::text, c.extension_rule_revision, \
            c.items_json::text, COUNT(*) OVER () AS total
            FROM contract.store_contract c JOIN organization.store s ON s.id=c.store_id JOIN \
            organization.organization_node p ON p.id=s.project_id JOIN organization.tenant t ON t.id=c.tenant_id
            WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid \
            IS NULL OR c.store_id=?) AND (?::uuid IS NULL OR c.tenant_id=?) AND (?::text IS NULL OR c.contract_no \
            ILIKE ? ESCAPE '!') AND (?::text IS NULL OR c.phase_name_snapshot ILIKE ? ESCAPE '!') AND (?::text IS NULL \
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.items_json) ci WHERE ci->>'code' ILIKE ? ESCAPE '!')) AND \
            (?::date IS NULL OR c.effective_from>=?) AND (?::date IS NULL OR c.effective_to IS NULL OR \
            c.effective_to<=?) AND (?::text IS NULL OR c.status=?)),
            paged AS (SELECT * FROM filtered ORDER BY __ORDER__ __DIRECTION__, contract_id ASC LIMIT ? OFFSET ?), \
            page_total AS (SELECT COALESCE(MAX(total), (SELECT COUNT(*) FROM filtered)) AS total FROM paged)
            SELECT paged.*, page_total.total, project_meta.id, project_meta.name FROM page_total LEFT JOIN paged ON \
            TRUE LEFT JOIN project_meta ON TRUE ORDER BY paged.__ORDER__ __DIRECTION__, paged.contract_id ASC
            """;
    public static final String CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY = " WHERE c.id=? AND c.workspace_uuid=? AND c.group_workspace_key=?";
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME_WORKSPACE_UUID_ALTERNATE_A = "SELECT id, code, name FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND ";
    
    public static final String CONTRACT_TASK_READ_SERVICE_SELECT_STORE_ID_FILTER_STATUS_ACTIVE = "SELECT store_id, CASE WHEN COUNT(*) FILTER (WHERE status='ACTIVE' AND effective_from<=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_OPEN_PAREN_EFFECTIVE_TO_OPERATING_FILTER = "(effective_to IS NULL OR effective_to>=?))>0 THEN 'OPERATING' WHEN COUNT(*) FILTER (WHERE ";
    public static final String CONTRACT_TASK_READ_SERVICE_STATUS_ACTIVE_EFFECTIVE_FROM_PREPARING = "status='ACTIVE' AND effective_from>?)>0 THEN 'PREPARING' ELSE 'NOT_OPERATING' END AS ";
    public static final String CONTRACT_TASK_READ_SERVICE_STORE_CONTRACT_DERIVED_STATUS_WORKSPACE_UUID = "derived_status FROM contract.store_contract WHERE workspace_uuid=? AND ";
    public static final String CONTRACT_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY = "group_workspace_key=? ";
    public static final String CONTRACT_TASK_READ_SERVICE_CONDITION_STORE_ID = "AND store_id IN (";
}
