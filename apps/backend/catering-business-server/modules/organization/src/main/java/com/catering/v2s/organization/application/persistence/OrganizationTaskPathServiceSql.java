package com.catering.v2s.organization.application.persistence;

/** SQL text fragments owned by OrganizationTaskPathService; B3 relocates text only and does not change execution. */
public final class OrganizationTaskPathServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_COMMERCIAL_GROUP_UUID =
            "SELECT commercial_group_uuid,commercial_group_code,commercial_group_name FROM ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY =
            "organization.commercial_group WHERE group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CTE_GROUP_FACT_COMMERCIAL_GROUP_UUID_GROUP_ID =
            "WITH RECURSIVE group_fact AS (SELECT commercial_group_uuid AS group_id FROM";
    public static final String ALT_COMMERCIAL_GRP_WS_KEY_001 =
            " organization.commercial_group WHERE group_workspace_key=?), store_fact AS (SELECT";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_PROJECT_ID_TENANT_ID_BRAND_ID =
            " store.project_id, store.tenant_id, store.brand_id, store.code, group_fact.group_id FROM";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT =
            " organization.store store JOIN organization.organization_node project ON";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID =
            " project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE =
            " project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_PROJECT_STATUS_ENABLED_STORE =
            " project.status='ENABLED' CROSS JOIN group_fact WHERE store.id=? AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ANCESTRY =
            " store.workspace_uuid=? AND store.group_workspace_key=?), ancestry AS (SELECT";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_PROJECT_ID_TARGET_ID_NODE =
            " store_fact.project_id AS target_id, node.id, node.parent_id, node.node_type, node.code,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_NODE_NAME_DEPTH =
            " node.name, 0 AS depth FROM store_fact JOIN organization.organization_node node ON";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_STORE_FACT_PROJECT_ID_WORKSPACE_UUID =
            " node.id=store_fact.project_id AND node.workspace_uuid=? AND node.group_workspace_key=? AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_STATUS_ENABLED_ANCESTRY =
            " node.status='ENABLED' UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_NODE_TYPE_CODE_NAME =
            " parent.node_type, parent.code, parent.name, ancestry.depth+1 FROM";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ANCESTRY_ORGANIZATION_NODE_PARENT_PARENT_ID =
            " organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS =
            " parent.workspace_uuid=? AND parent.group_workspace_key=? AND parent.status='ENABLED') ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT = "SELECT";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_PROJECT_ID_TENANT_ID_BRAND_ID =
            " store_fact.project_id, store_fact.tenant_id, store_fact.brand_id, store_fact.code,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_TARGET_ID_NODE_TYPE_FILTER =
            " ancestry.target_id, max(ancestry.node_type) FILTER (WHERE ancestry.depth=0) AS target_type,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_ANCESTOR_IDS =
            " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS ancestor_ids,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_PATH_NODE_REFS =
            " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS path_node_refs,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_CODE_DEPTH =
            " array_agg(ancestry.code ORDER BY ancestry.depth DESC) AS path_node_codes,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NAME_DEPTH =
            " array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS path_node_names,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NODE_TYPE_DEPTH =
            " array_agg(ancestry.node_type ORDER BY ancestry.depth DESC) AS path_node_types,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STRING_AGG_ANCESTRY_CODE_NAME =
            " string_agg(ancestry.code || ' ' || ancestry.name, ' / ' ORDER BY ancestry.depth DESC)";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_DISPLAY_PATH_GROUP_ID =
            " AS display_path, store_fact.group_id FROM store_fact JOIN ancestry ON";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_TARGET_ID_STORE_FACT_PROJECT_ID =
            " ancestry.target_id=store_fact.project_id GROUP BY store_fact.project_id,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_TENANT_ID_BRAND_ID_CODE =
            " store_fact.tenant_id, store_fact.brand_id, store_fact.code, ancestry.target_id,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_FACT_GROUP_ID = " store_fact.group_id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CTE_COMMERCIAL_GROUP_GROUP_FACT_COMMERCIAL_GROUP_UUID =
            "WITH group_fact AS (SELECT commercial_group_uuid FROM organization.commercial_group";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHERE_GROUP_WORKSPACE_KEY_STORE_STORE_ID_PROJECT_ID =
            " WHERE group_workspace_key=?) SELECT store.id AS store_id, store.project_id FROM";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ALTERNATE_A =
            " organization.store store JOIN organization.organization_node project ON";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_A =
            " project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE_ALTERNATE_A =
            " project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_PROJECT_STATUS_ENABLED_STORE_ALTERNATE_A =
            " project.status='ENABLED' CROSS JOIN group_fact WHERE store.id IN (";
    public static final String CTE_GRP_FACT_COMMERCIAL_GRP_ALT_A_002 =
            "WITH RECURSIVE group_fact AS (SELECT commercial_group_uuid AS group_id FROM";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY_PARAMS =
            " organization.commercial_group WHERE group_workspace_key=?), params AS (SELECT ?::uuid AS";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_TEXT_GROUP_WORKSPACE_KEY_TARGET_ID =
            " workspace_uuid, ?::text AS group_workspace_key, ?::uuid AS target_id, group_fact.group_id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE = " FROM";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_ANCESTRY_NODE_TARGET_ID =
            " group_fact), ancestry AS (SELECT node.id AS target_id, node.id, node.parent_id,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_NODE_NODE_TYPE_CODE_NAME =
            " node.node_type, node.code, node.name, 0 AS depth FROM organization.organization_node node";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARAMS_NODE_WORKSPACE_UUID =
            " CROSS JOIN params WHERE node.workspace_uuid=params.workspace_uuid AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_GROUP_WORKSPACE_KEY_PARAMS_STATUS =
            " node.group_workspace_key=params.group_workspace_key AND node.status='ENABLED' AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PARAMS_TARGET_ID_ANCESTRY =
            " node.id=params.target_id UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_NODE_TYPE_CODE_NAME_ALTERNATE_A =
            " parent.node_type, parent.code, parent.name, ancestry.depth+1 FROM";
    public static final String ALT_ANCESTRY_ORG_NODE_PARENT_ALT_A_003 =
            " organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CROSS_JOIN = " CROSS JOIN";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARAMS_PARENT_WORKSPACE_UUID =
            " params WHERE parent.workspace_uuid=params.workspace_uuid AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_GROUP_WORKSPACE_KEY_PARAMS_STATUS =
            " parent.group_workspace_key=params.group_workspace_key AND parent.status='ENABLED') SELECT";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_TARGET_ID_NODE_TYPE_FILTER_ALTERNATE_A =
            " ancestry.target_id, max(ancestry.node_type) FILTER (WHERE ancestry.depth=0) AS target_type,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_ANCESTOR_IDS_ALTERNATE_A =
            " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS ancestor_ids,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_PATH_NODE_REFS_ALTERNATE_A =
            " array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS path_node_refs,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_CODE_DEPTH_ALTERNATE_A =
            " array_agg(ancestry.code ORDER BY ancestry.depth DESC) AS path_node_codes,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NAME_DEPTH_ALTERNATE_A =
            " array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS path_node_names,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_ANCESTRY_NODE_TYPE_DEPTH_ALTERNATE_A =
            " array_agg(ancestry.node_type ORDER BY ancestry.depth DESC) AS path_node_types,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STRING_AGG_ANCESTRY_CODE = " string_agg(ancestry.code";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_NAME_DEPTH_DISPLAY_PATH =
            " || ' ' || ancestry.name, ' / ' ORDER BY ancestry.depth DESC) AS display_path,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARAMS_GROUP_ID = " params.group_id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARAMS_GROUP_ID_TARGET_ID =
            " AS group_id FROM ancestry CROSS JOIN params GROUP BY ancestry.target_id, params.group_id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_STORE_STATUS_ENABLED =
            " AND store.status='ENABLED'";
    public static final String CTE_GRP_FACT_COMMERCIAL_GRP_ALT_B_004 =
            "WITH group_fact AS (SELECT commercial_group_uuid AS group_id FROM";
    public static final String ALT_COMMERCIAL_GRP_WS_KEY_ALT_A_005 =
            " organization.commercial_group WHERE group_workspace_key=?), store_fact AS (SELECT";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_STORE_ID_PROJECT_ID_CODE =
            " store.id AS store_id, store.project_id, store.code AS store_code, store.name AS store_name,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_PARENT_ID_REGION_ID_CODE =
            " project.parent_id AS region_id, project.code AS project_code, project.name AS project_name,";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_REGION_CODE_REGION_CODE_NAME =
            " region.code AS region_code, region.name AS region_name, group_fact.group_id FROM";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ALTERNATE_B =
            " organization.store store JOIN organization.organization_node project ON";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_B =
            " project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE_ALTERNATE_B =
            " project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_PROJECT_STATUS_ENABLED_REGION =
            " project.status='ENABLED' JOIN organization.organization_node region ON";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_REGION_PROJECT_PARENT_ID_WORKSPACE_UUID =
            " region.id=project.parent_id AND region.workspace_uuid=project.workspace_uuid AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_REGION_GROUP_WORKSPACE_KEY_PROJECT_NODE_TYPE =
            " region.group_workspace_key=project.group_workspace_key AND region.node_type='REGION' AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_FACT_REGION_STATUS_ENABLED_STORE =
            " region.status='ENABLED' CROSS JOIN group_fact WHERE store.id=? AND";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            " store.workspace_uuid=? AND store.group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CTE_REQUESTED_TARGET_TYPE_TARGET_ID =
            "WITH RECURSIVE requested(target_type, target_id) AS (";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_SELECT_JSONB_TO_RECORDSET_TARGET_TYPE_TARGET_ID_REQUEST_TEXT =
                    "SELECT target_type, target_id FROM jsonb_to_recordset(?::jsonb) AS request(target_type text, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ID = "target_id uuid)";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_COMMERCIAL_GROUP = "), commercial_group AS (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_COMMERCIAL_GROUP_UUID_ALTERNATE_A =
            "SELECT commercial_group_uuid AS id, commercial_group_code, commercial_group_name FROM ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP_GROUP_WORKSPACE_KEY_ALTERNATE_A =
                    "organization.commercial_group WHERE group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_TARGET_ROWS = "), target_rows AS (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_REQUESTED_TARGET_TYPE_TARGET_ID_COMMERCIAL_GROUP =
            "SELECT requested.target_type, requested.target_id, commercial_group.id AS group_id, node.id AS ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_ID_HEAD_COMPANY_HEAD_COMPANY_ID_STORE =
            "node_id, head_company.id AS head_company_id, store.id AS store_id, store.project_id ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_COMMERCIAL_GROUP_FROM_REQUESTED_CROSS_JOIN_CO =
                    "FROM requested CROSS JOIN commercial_group ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ORGANIZATION_NODE_NODE_REQUESTED_TARGET_TYPE_REGION =
            "LEFT JOIN organization.organization_node node ON requested.target_type IN ('REGION','PROJECT') AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_REQUESTED_TARGET_ID_WORKSPACE_UUID =
            "node.id=requested.target_id AND node.workspace_uuid=? AND node.group_workspace_key=? ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_REQUESTED_TARGET_TYPE =
            "LEFT JOIN organization.head_company head_company ON requested.target_type='HEAD_COMPANY' AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_REQUESTED_TARGET_ID_WORKSPACE_UUID =
            "head_company.id=requested.target_id AND head_company.workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_GROUP_WORKSPACE_KEY =
            "head_company.group_workspace_key=? ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_REQUESTED_TARGET_TYPE =
            "LEFT JOIN organization.store store ON requested.target_type='STORE' AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_REQUESTED_TARGET_ID_WORKSPACE_UUID =
            "store.id=requested.target_id AND store.workspace_uuid=? AND store.group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_NODE_SEEDS_TARGET_TYPE_TARGET_ID_PARENT_ID =
            "), node_seeds(target_type, target_id, id, parent_id, code, name, node_type) AS (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_TARGET_TYPE_TARGET_ID_NODE_PARENT_ID =
            "SELECT target_type, target_id, node.id, node.parent_id, node.code, node.name, node.node_type ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_TARGET_ROWS_FROM_TARGET_ROWS_JOIN =
            "FROM target_rows JOIN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_NODE_TARGET_ROWS_NODE_ID =
            "organization.organization_node node ON node.id=target_rows.node_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_UNION_TARGET_ROWS_TARGET_TYPE_TARGET_ID_PROJECT =
            "UNION ALL SELECT target_rows.target_type, target_rows.target_id, project.id, project.parent_id, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_PROJECT_CODE_NAME_NODE_TYPE =
            "project.code, project.name, project.node_type FROM target_rows ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT =
            "JOIN organization.organization_node project ON ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_TARGET_ROWS_PROJECT_ID_WORKSPACE_UUID =
            "project.id=target_rows.project_id AND project.workspace_uuid=? AND project.group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_ANCESTRY_TARGET_TYPE_TARGET_ID_PARENT_ID =
            "), ancestry(target_type, target_id, id, parent_id, code, name, node_type, depth) AS (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_NODE_SEEDS_TARGET_TYPE_TARGET_ID_PARENT_ID_CODE =
            "SELECT target_type, target_id, id, parent_id, code, name, node_type, 0 AS depth FROM node_seeds ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_UNION_ANCESTRY_TARGET_TYPE_TARGET_ID_PARENT =
            "UNION ALL SELECT ancestry.target_type, ancestry.target_id, parent.id, parent.parent_id, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_CODE_NAME_NODE_TYPE =
            "parent.code, parent.name, parent.node_type, ancestry.depth + 1 ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PARENT =
            "FROM organization.organization_node parent JOIN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_PARENT_ID_PARENT_WORKSPACE_UUID =
            "ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_GROUP_WORKSPACE_KEY =
            "parent.group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_NODE_PATHS = "), node_paths AS (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_TARGET_TYPE_TARGET_ID_ARRAY_AGG_DEPTH =
            "SELECT target_type, target_id, array_agg(id ORDER BY depth DESC) AS ancestor_ids, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_DEPTH_PATH_NODE_REFS_CODE =
            "array_agg(id ORDER BY depth DESC) AS path_node_refs, array_agg(code ORDER BY depth DESC) AS ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PATH_NODE_CODES_ARRAY_AGG_NAME_DEPTH =
            "path_node_codes, array_agg(name ORDER BY depth DESC) AS path_node_names, array_agg(node_type ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ORDER_BY_DEPTH_PATH_NODE_TYPES_STRING_AGG_CODE =
            "ORDER BY depth DESC) AS path_node_types, string_agg(code || ' ' || name, ' / ' ORDER BY depth ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_DESC_DIRECTION_ANCESTRY_DISPLAY_PATH_TARGET_TYPE_TARGET_ID =
                    "DESC) AS display_path FROM ancestry GROUP BY target_type, target_id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_TARGET_ROWS_TARGET_TYPE_TARGET_ID =
            ") SELECT target_rows.target_type, target_rows.target_id, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID =
            "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_GROUP_ID = "ARRAY[target_rows.group_id] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT =
            "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_PREPEND_TARGET_ROWS_GROUP_ID_NODE_PATHS =
            "array_prepend(target_rows.group_id, node_paths.ancestor_ids) ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID =
                    "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_GROUP_ID_HEAD_COMPANY_ID =
            "ARRAY[target_rows.group_id, target_rows.head_company_id] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID =
            "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_ARRAY_PREPEND_TARGET_ROWS_GROUP_ID =
            "IS NOT NULL THEN array_append(array_prepend(target_rows.group_id, node_paths.ancestor_ids), ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_STORE_ID_ANCESTOR_IDS =
            "target_rows.store_id) END AS ancestor_ids, ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_A =
                    "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_GROUP_ID_ALTERNATE_A =
            "ARRAY[target_rows.group_id] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_A =
            "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_REFS = "node_paths.path_node_refs ";
    public static final String WHEN_TARGET_ROWS_TARGET_TYPE_ALT_A_006 =
            "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_TARGET_ROWS_HEAD_COMPANY_ID =
            "ARRAY[target_rows.head_company_id] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_A =
            "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_REFS_TARGET_ROWS =
            "IS NOT NULL THEN array_append(node_paths.path_node_refs, target_rows.store_id) END AS ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PATH_NODE_REFS = "path_node_refs, ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_B =
                    "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_CODE =
            "ARRAY[commercial_group.commercial_group_code] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_B =
            "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_CODES =
            "node_paths.path_node_codes ";
    public static final String WHEN_TARGET_ROWS_TARGET_TYPE_ALT_B_007 =
            "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_CODE = "ARRAY[head_company.code] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_B =
            "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_CODES_STORE =
            "IS NOT NULL THEN array_append(node_paths.path_node_codes, store.code) END AS path_node_codes, ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_C =
                    "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_COMMERCIAL_GROUP_COMMERCIAL_GROUP_NAME =
            "ARRAY[commercial_group.commercial_group_name] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_C =
            "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_NAMES =
            "node_paths.path_node_names ";
    public static final String WHEN_TARGET_ROWS_TARGET_TYPE_ALT_C_008 =
            "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_NAME = "ARRAY[head_company.name] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_C =
            "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_NAMES_STORE =
            "IS NOT NULL THEN array_append(node_paths.path_node_names, store.name) END AS path_node_names, ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_D =
                    "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_GROUP = "ARRAY['GROUP'] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_D =
            "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_PATH_NODE_TYPES =
            "node_paths.path_node_types ";
    public static final String WHEN_TARGET_ROWS_TARGET_TYPE_ALT_D_009 =
            "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY = "ARRAY['HEAD_COMPANY'] ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_D =
            "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_APPEND_NODE_PATHS_PATH_NODE_TYPES_STORE =
            "IS NOT NULL THEN array_append(node_paths.path_node_types, 'STORE') END AS path_node_types, ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_CASE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID_ALTERNATE_E =
                    "CASE WHEN target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_COMMERCIAL_GROUP =
            "commercial_group.commercial_group_name || '（' || commercial_group.commercial_group_code || '）' ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT_ALTERNATE_E =
            "WHEN target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_DISPLAY_PATH = "node_paths.display_path ";
    public static final String WHEN_TARGET_ROWS_TARGET_TYPE_ALT_E_010 =
            "WHEN target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL THEN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_CODE_NAME =
            "head_company.code || ' ' || head_company.name ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHEN_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID_ALTERNATE_E =
            "WHEN target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_DISPLAY_PATH_STORE_CODE =
            "IS NOT NULL THEN node_paths.display_path || ' / ' || store.code || ' ' || store.name END AS ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_DISPLAY_PATH = "display_path ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_COMMERCIAL_GROUP_FROM_TARGET_ROWS_CROSS_JOIN_ =
                    "FROM target_rows CROSS JOIN commercial_group ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_TARGET_TYPE_TARGET_ROWS =
            "LEFT JOIN node_paths ON node_paths.target_type=target_rows.target_type AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_PATHS_TARGET_ID_TARGET_ROWS =
            "node_paths.target_id=target_rows.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_TARGET_ROWS_HEAD_COMPANY_ID =
            "LEFT JOIN organization.head_company head_company ON head_company.id=target_rows.head_company_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_TARGET_ROWS_STORE_ID =
            "LEFT JOIN organization.store store ON store.id=target_rows.store_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHERE_TARGET_ROWS_TARGET_TYPE_TARGET_ID_GROUP_ID =
            "WHERE (target_rows.target_type='GROUP' AND target_rows.target_id=target_rows.group_id) ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_TARGET_ROWS_TARGET_TYPE_REGION_PROJECT =
            "OR (target_rows.target_type IN ('REGION','PROJECT') AND node_paths.target_id IS NOT NULL) ";
    public static final String
            ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_TARGET_ROWS_TARGET_TYPE_HEAD_COMPANY_HEAD_COMPANY_ID =
                    "OR (target_rows.target_type='HEAD_COMPANY' AND target_rows.head_company_id IS NOT NULL) ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_TARGET_ROWS_TARGET_TYPE_STORE_STORE_ID =
            "OR (target_rows.target_type='STORE' AND target_rows.store_id IS NOT NULL AND node_paths.target_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_IS_NOT_NULL = "IS NOT NULL)";
    public static final String SELECT_ORG_NODE_PARENT_ID_011 =
            "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            "workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (";
    public static final String SELECT_ORG_NODE_PARENT_ID_ALT_A_012 =
            "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE ";
    public static final String WS_UUID_GRP_WS_KEY_ALT_A_013 =
            "workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CTE_COMMERCIAL_GROUP_GROUP_ROOT_COMMERCIAL_GROUP_UUID =
            "WITH group_root AS (SELECT commercial_group_uuid FROM organization.commercial_group WHERE ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY =
            "group_workspace_key=?) SELECT group_root.commercial_group_uuid, company.id, company.code, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_COMPANY_NAME_VERSION_BRAND =
            "company.name, company.version, brand.version, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_AUTHORIZATION_FACT_AUTHORIZED_AT_EPOCH_MILLIS =
            "authorization_fact.authorized_at_epoch_millis FROM ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_HEAD_COMPANY_GROUP_ROOT_COMPANY =
            "group_root CROSS JOIN organization.head_company company JOIN ";
    public static final String ALT_HEAD_COMPANY_BRAND_AUTH_014 =
            "organization.head_company_brand_authorization authorization_fact ON ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_BRAND_AUTHORIZATION_FACT_HEAD_COMPANY_ID_COMPANY =
            "authorization_fact.head_company_id=company.id JOIN organization.brand brand ON ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_BRAND_AUTHORIZATION_FACT_BRAND_ID_COMPANY =
            "brand.id=authorization_fact.brand_id WHERE company.id=? AND company.workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_COMPANY_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            "company.group_workspace_key=? AND company.status='ENABLED' AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_AUTHORIZATION_FACT_BRAND_ID =
            "authorization_fact.brand_id=? ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_BRAND_STATUS_ENABLED =
            "AND brand.status='ENABLED'";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_PROJECT_ID_CODE_NAME_PARENT_ID =
            "SELECT s.id, s.project_id, s.code, s.name, p.id, p.parent_id, p.code, p.name, r.id, r.code, r.name ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PROJECT_ID =
            "FROM organization.store s JOIN organization.organization_node p ON p.id=s.project_id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "AND p.workspace_uuid=s.workspace_uuid AND p.group_workspace_key=s.group_workspace_key ";
    public static final String CONDITION_ORG_NODE_TYPE_PROJECT_015 =
            "AND p.node_type='PROJECT' AND p.status='ENABLED' JOIN organization.organization_node r ";
    public static final String JOIN_CONDITION_PARENT_ID_WS_016 =
            "ON r.id=p.parent_id AND r.workspace_uuid=p.workspace_uuid AND r.group_workspace_key=";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION_STATUS =
            "p.group_workspace_key AND r.node_type='REGION' AND r.status='ENABLED' WHERE s.id=? AND ";
    public static final String WS_UUID_GRP_WS_KEY_ALT_B_017 =
            "s.workspace_uuid=? AND s.group_workspace_key=? AND s.status='ENABLED'";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_GROUP_ROOT_COMMERCIAL_GROUP_UUID_STORE_PROJECT_ID =
            "SELECT group_root.commercial_group_uuid, store.id, store.project_id, store.code, store.name, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_REGION_PROJECT_CODE_NAME =
            "region.id, project.code, project.name, region.code, region.name, store.brand_id, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_VERSION = "store.version ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_STORE_GROUP_ROOT =
            "FROM organization.commercial_group group_root JOIN organization.store store ON ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_GROUP_WORKSPACE_KEY_GROUP_ROOT =
            "store.group_workspace_key=group_root.group_workspace_key JOIN ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ALTERNATIVE_ORGANIZATION_NODE =
            "organization.organization_node ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_STORE_PROJECT_ID_WORKSPACE_UUID_ALTERNATE_C =
            "project ON project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_STORE_NODE_TYPE_ALTERNATE_C =
            "project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' AND ";
    public static final String ORG_NODE_PROJECT_STATUS_ENABLED_ALT_A_018 =
            "project.status='ENABLED' JOIN organization.organization_node region ON ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_REGION_PROJECT_PARENT_ID = "region.id=project.parent_id ";
    public static final String CONDITION_REGION_WS_UUID_PROJECT_019 =
            "AND region.workspace_uuid=project.workspace_uuid AND region.group_workspace_key=";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PROJECT_GROUP_WORKSPACE_KEY_REGION_NODE_TYPE =
            "project.group_workspace_key AND region.node_type='REGION' AND region.status='ENABLED' WHERE ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_ROOT_GROUP_WORKSPACE_KEY_STORE_WORKSPACE_UUID =
            "group_root.group_workspace_key=? AND store.id=? AND store.workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_STORE_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            "store.group_workspace_key=? AND store.status='ENABLED'";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_STORE_PROJECT_ID_CODE_NAME_WORKSPACE_UUID =
            "SELECT id, project_id, code, name FROM organization.store WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_A = "group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_AND_ID_IN = " AND id IN (";
    public static final String SELECT_HEAD_COMPANY_CODE_NAME_020 =
            ("SELECT id, code, name FROM organization.head_company WHERE workspace_uui"
                    + "d=? AND group_workspace_key=?");
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_AND_ID_IN_ALTERNATE_A = " AND id IN (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CTE_ANCESTRY = "WITH RECURSIVE ancestry AS (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_NODE_TARGET_ID_PARENT_ID_NODE_TYPE =
            "SELECT node.id AS target_id, node.id, node.parent_id, node.node_type, node.code, node.name, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_DEPTH = "0 AS depth ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_NODE_WORKSPACE_UUID =
            "FROM organization.organization_node node WHERE node.workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_NODE_GROUP_WORKSPACE_KEY = "node.group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_NODE = " AND node.id IN (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_UNION_ALL = ") UNION ALL ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_ANCESTRY_TARGET_ID_PARENT_PARENT_ID =
            "SELECT ancestry.target_id, parent.id, parent.parent_id, parent.node_type, parent.code, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_PARENT_NAME_ANCESTRY_DEPTH =
            "parent.name, ancestry.depth + 1 ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID =
            "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHERE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CLOSE_PAREN_TARGET_ID_NODE_TYPE_FILTER_DEPTH =
            ") SELECT target_id, max(node_type) FILTER (WHERE depth=0) AS target_type, array_agg(id ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ORDER_BY_DEPTH_ANCESTOR_IDS_ARRAY_AGG_PATH_NODE_REFS =
            "ORDER BY depth DESC) AS ancestor_ids, array_agg(id ORDER BY depth DESC) AS path_node_refs, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_CODE_DEPTH_PATH_NODE_CODES =
            "array_agg(code ORDER BY depth DESC) AS path_node_codes, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_NAME_DEPTH_PATH_NODE_NAMES =
            "array_agg(name ORDER BY depth DESC) AS path_node_names, ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ARRAY_AGG_NODE_TYPE_DEPTH_PATH_NODE_TYPES =
            "array_agg(node_type ORDER BY depth DESC) AS path_node_types, string_agg(code ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_ANCESTRY_NAME_DEPTH_DISPLAY_PATH_TARGET_ID =
            "|| ' ' || name, ' / ' ORDER BY depth DESC) AS display_path FROM ancestry GROUP BY target_id";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_NODE_NODE_TYPE_WORKSPACE_UUID =
            "SELECT id, node_type FROM organization.organization_node WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            "group_workspace_key=? AND status='ENABLED' AND id IN (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_SELECT_ID_FROM_ORGANIZATION =
            "SELECT id FROM organization.";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ENABLED =
            " WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' AND id IN (";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_CONDITION_STATUS_ENABLED = " AND status='ENABLED'";
    public static final String SELECT_ORG_NODE_PARENT_ID_ALT_B_021 =
            "SELECT id, parent_id, node_type, code, name FROM organization.organization_node WHERE id=? AND ";
    public static final String WS_UUID_GRP_WS_KEY_ALT_C_022 =
            "workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'";
    public static final String ORGANIZATION_TASK_PATH_SERVICE_SELECT_ORGANIZATION_CODE_NAME =
            "SELECT id, code, name FROM organization.";
    public static final String WHERE_WS_UUID_GRP_WS_ALT_A_023 =
            " WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ENABLED'";
    public static final String STORE_FACT_SELECT_SUFFIX =
            (") SELECT store_id, project_id, store_code, store_name, region_id, projec"
                    + "t_code, project_name, region_code, region_name, group_id FROM store_fact");
    public static final String STORE_MEMBERSHIP_SCOPE_SUFFIX =
            ") AND store.workspace_uuid=? AND store.group_workspace_key=?";
    public static final String ENABLED_STATUS_FILTER_PREFIX = " AND ";
    public static final String ENABLED_STATUS_FILTER_SUFFIX = ".status='ENABLED'";
}
