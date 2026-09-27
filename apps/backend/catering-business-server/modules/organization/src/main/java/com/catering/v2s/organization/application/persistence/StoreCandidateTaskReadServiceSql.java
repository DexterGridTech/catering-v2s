package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by StoreCandidateTaskReadService; B3 relocates text only and does not change execution. */
public final class StoreCandidateTaskReadServiceSql {
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_CODE_NAME =
            "SELECT n.id, n.code, n.name FROM organization.organization_node n WHERE n.id IN (";
    public static final String SELECT_BRAND_CODE_NAME_WS_001 =
            "SELECT id, code, name FROM organization.brand WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_STATUS_ENABLED = "AND status='ENABLED'";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME =
            "SELECT DISTINCT t.id, t.code, t.name FROM organization.tenant t JOIN organization.store s ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_JOIN_CONDITION_TENANT_ID_WORKSPACE_UUID =
            "ON s.tenant_id=t.id AND s.workspace_uuid=t.workspace_uuid AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID =
            "s.group_workspace_key=t.group_workspace_key WHERE t.workspace_uuid=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            "t.group_workspace_key=? AND t.status='ENABLED' AND s.status='ENABLED' AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_PROJECT_ID_BRAND_ID =
            "s.project_id=? AND s.brand_id=?";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME =
            "SELECT DISTINCT h.id, h.code, h.name FROM organization.head_company h JOIN ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_ALTERNATIVE_STORE_HEAD_COMPANY_ID =
            "organization.store s ON s.head_company_id=h.id AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_WORKSPACE_UUID =
            "s.workspace_uuid=h.workspace_uuid AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY =
            "s.group_workspace_key=h.group_workspace_key ";
    public static final String WHERE_WS_UUID_GRP_WS_002 =
            "WHERE h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_STATUS_ENABLED_BRAND_ID_TENANT_ID =
            "s.status='ENABLED' AND s.brand_id=? AND s.tenant_id=? AND EXISTS (SELECT 1 FROM ";
    public static final String ALT_HEAD_COMPANY_BRAND_AUTH_003 =
            "organization.head_company_brand_authorization a WHERE a.head_company_id=h.id ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_BRAND_ID = "AND a.brand_id=?)";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_WORKSPACE_UUID =
            "SELECT s.id, s.code, s.name FROM organization.store s WHERE s.workspace_uuid=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED_PROJECT_ID =
            "s.group_workspace_key=? AND s.status='ENABLED' AND s.project_id IN (";
    public static final String SELECT_STORE_CODE_NAME_WS_004 =
            "SELECT id, code, name FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_PROJECT_ID =
            "AND (CAST(? AS uuid) IS NULL OR project_id=?)";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_ALTERNATE_A =
            "SELECT DISTINCT t.id, t.code, t.name FROM organization.tenant t JOIN organization.store s ON ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_TENANT_ID_WORKSPACE_UUID =
            "s.tenant_id=t.id AND s.workspace_uuid=t.workspace_uuid AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_WORKSPACE_UUID_ALTERNATE_A =
            "s.group_workspace_key=t.group_workspace_key WHERE t.workspace_uuid=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_PROJECT_ID =
            "t.group_workspace_key=? AND (CAST(? AS uuid) IS NULL OR s.project_id=?)";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CTE_CANDIDATES = "WITH candidates AS (";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CLOSE_PAREN_CANDIDATES_FILTERED_CODE_NAME_TEXT =
            "), filtered AS (SELECT id, code, name FROM candidates WHERE CAST(? AS text) IS NULL OR ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CODE_ILIKE_ESCAPE_NAME =
            "code ILIKE ? ESCAPE '!' OR name ILIKE ? ESCAPE '!'), summary AS (SELECT count(*) AS total, ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_FILTERED_BOOL_OR_SELECTED_EXISTS_RANKED =
            "COALESCE(bool_or(id=CAST(? AS uuid)), false) AS selected_exists FROM filtered), ranked AS (";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_FILTERED_CODE_NAME_PAGE_RANK =
            "SELECT id, code, name, row_number() OVER(ORDER BY code, id) AS page_rank FROM filtered), ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_RANKED_PAGED_PAGE_RANK =
            "paged AS (SELECT * FROM ranked WHERE page_rank>? AND page_rank<=?) SELECT paged.id, ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_PAGED_CODE_NAME_SUMMARY =
            "paged.code, paged.name, summary.total, paged.page_rank, ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SUMMARY_SELECTED_EXISTS =
            "summary.selected_exists FROM summary ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_PAGED_PAGE_RANK =
            "LEFT JOIN paged ON TRUE ORDER BY paged.page_rank";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_WORKSPACE_UUID =
            "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_PROJECT_STATUS =
            "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED'";
    public static final String SELECT_ORG_NODE_WS_UUID_ALT_A_005 =
            "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND ";
    public static final String GRP_WS_KEY_NODE_TYPE_ALT_A_006 =
            "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id IN (";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CTE_ORGANIZATION_NODE_DESCENDANTS =
            "WITH RECURSIVE descendants(id) AS (SELECT id FROM organization.organization_node WHERE ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            "id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_UNION_UNION_ALL_SELECT = "UNION ALL SELECT ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_DESCENDANTS_CHILD_PARENT =
            "child.id FROM organization.organization_node child JOIN descendants parent ON ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CHILD_PARENT_ID_PARENT_WORKSPACE_UUID =
            "child.parent_id=parent.id WHERE child.workspace_uuid=? ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_CHILD_GROUP_WORKSPACE_KEY =
            "AND child.group_workspace_key=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_DESCENDANTS_CHILD_STATUS_ENABLED =
            "child.status='ENABLED') SELECT id FROM descendants)";
    public static final String SELECT_ORG_NODE_WS_UUID_ALT_B_007 =
            "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND ";
    public static final String GRP_WS_KEY_NODE_TYPE_ALT_B_008 =
            "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id=?";
    public static final String SELECT_ORG_NODE_WS_UUID_ALT_C_009 =
            "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND ";
    public static final String GRP_WS_KEY_NODE_TYPE_ALT_C_010 =
            "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id=(";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_PROJECT_ID_WORKSPACE_UUID =
            "SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED_ALTERNATE_A =
            "group_workspace_key=? AND status='ENABLED')";
    public static final String SELECT_ORG_NODE_WS_UUID_ALT_D_011 =
            "SELECT n.id FROM organization.organization_node n WHERE n.workspace_uuid=? AND ";
    public static final String GRP_WS_KEY_NODE_TYPE_ALT_D_012 =
            "n.group_workspace_key=? AND n.node_type='PROJECT' AND n.status='ENABLED' AND n.id IN (";
    public static final String SELECT_STORE_PROJECT_ID_WS_ALT_A_013 =
            "SELECT DISTINCT project_id FROM organization.store WHERE workspace_uuid=? AND ";
    public static final String GRP_WS_KEY_HEAD_COMPANY_014 =
            "group_workspace_key=? AND head_company_id=? AND status='ENABLED')";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_ALTERNATE_B =
            "SELECT store.id, store.code, store.name FROM organization.store store WHERE ?='STORE' AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "store.workspace_uuid=? AND store.group_workspace_key=? AND (?::uuid IS NULL OR ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_STORE_PROJECT_ID_TENANT_CODE =
            "store.project_id=?) UNION ALL SELECT DISTINCT tenant.id, tenant.code, tenant.name FROM ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_ALTERNATIVE_STORE_TENANT_TENANT_ID =
            "organization.tenant tenant JOIN organization.store store ON store.tenant_id=tenant.id AND ";

    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_WHERE_TENANT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE ?='TENANT' AND tenant.workspace_uuid=? AND tenant.group_workspace_key=? AND ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_OPEN_PAREN_STORE_PROJECT_ID =
            "(?::uuid IS NULL OR store.project_id=?)";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP_COMMERCIAL_GROUP_UUID =
            "SELECT commercial_group.commercial_group_uuid AS id, ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE_CODE =
            "commercial_group.commercial_group_code AS code, ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_NAME_NAME =
            "commercial_group.commercial_group_name AS name ";
    public static final String FROM_CLAUSE_COMMERCIAL_GRP_FROM_015 =
            "FROM organization.commercial_group commercial_group ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_JOIN_GROUP_WORKSPACE_JOIN_PLATFORM_WORKSPACE_GROU =
            "JOIN platform_workspace.group_workspace group_workspace ";
    public static final String JOIN_CONDITION_GRP_WS_COMMERCIAL_016 =
            "ON group_workspace.id=commercial_group.group_workspace_id ";
    public static final String WHERE_GRP_WS_UUID_GRP_017 =
            "WHERE group_workspace.workspace_uuid=? AND group_workspace.group_workspace_key=? ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY =
            "AND commercial_group.group_workspace_key=?";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_ORGANIZATION_NODE_NODE_CODE_NAME =
            "SELECT node.id, node.code, node.name FROM organization.organization_node node ";
    public static final String WHERE_NODE_WS_UUID_GRP_018 =
            "WHERE node.workspace_uuid=? AND node.group_workspace_key=? AND node.node_type=? ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_NODE_STATUS_ENABLED =
            "AND node.status='ENABLED'";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_HEAD_COMPANY_CODE_NAME_ALTERNATE_A =
            "SELECT head_company.id, head_company.code, head_company.name ";
    public static final String FROM_CLAUSE_HEAD_COMPANY_FROM_019 = "FROM organization.head_company head_company ";
    public static final String WHERE_HEAD_COMPANY_WS_UUID_020 =
            "WHERE head_company.workspace_uuid=? AND head_company.group_workspace_key=? ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_HEAD_COMPANY_STATUS_ENABLED =
            "AND head_company.status='ENABLED'";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_SELECT_STORE_CODE_NAME_ALTERNATE_C =
            "SELECT store.id, store.code, store.name FROM organization.store store ";
    public static final String WHERE_STORE_WS_UUID_GRP_021 =
            "WHERE store.workspace_uuid=? AND store.group_workspace_key=? AND store.status='ENABLED' ";
    public static final String STORE_CANDIDATE_TASK_READ_SERVICE_CONDITION_STORE_PROJECT_ID =
            "AND (CAST(? AS uuid) IS NULL OR store.project_id=?)";
    public static final String STORE_WS_UUID_TENANT_WS_022 =
            """
    store.workspace_uuid=tenant.workspace_uuid AND store.group_workspace_key=tenant.group_workspace_key\s""";
}
