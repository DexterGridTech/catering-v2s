package com.catering.v2s.organization.application.persistence;

/**
 * SQL text fragments owned by OrganizationOverviewTaskReadService; B3 relocates text only and does not change
 * execution.
 */
public final class OrganizationOverviewTaskReadServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String STORE_ALIAS_PREFIX = "s.";
    public static final String STORE_ID_COLUMN = "s.id";
    public static final String STORE_PROJECT_ID_COLUMN = "s.project_id";
    public static final String SQL_SPACE = " ";
    public static final String NODE_PATH_TARGET_ID_COLUMN = "target_id";
    public static final String NODE_PATH_CLOSE_SUFFIX = ") ";
    public static final String SORT_DIRECTION_ASC = "ASC";
    public static final String SORT_DIRECTION_DESC = "DESC";
    public static final String
            ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_FILTERED_WORKSPACE_UUID_TEXT_WORKSPACE_KEY_CATEGORY =
                    """
            WITH RECURSIVE params AS (
                SELECT ?::uuid AS workspace_uuid, ?::text AS workspace_key, ?::text AS category,
                       ?::text AS type, ?::text AS name_pattern, ?::text AS code_pattern,
                       ?::text AS legal_name_pattern, ?::text AS credit_code_pattern, ?::text AS status,
                       ?::text AS source, ?::uuid AS project_id, ?::uuid AS brand_id,
                       ?::uuid AS tenant_id, ?::uuid AS head_company_id, ?::uuid AS scope_node_id
            ), nodes AS (
                SELECT n.id, n.parent_id, n.node_type, n.code, n.name, n.status, n.version,
                       n.created_at_epoch_millis, n.updated_at_epoch_millis, n.notes
                  FROM organization.organization_node n, params p
                 WHERE n.workspace_uuid=p.workspace_uuid AND n.group_workspace_key=p.workspace_key
            ), visible_scope AS (
                SELECT n.id, n.parent_id, n.node_type FROM nodes n, params p WHERE n.id=p.scope_node_id
                UNION ALL
                SELECT child.id, child.parent_id, child.node_type FROM nodes child JOIN visible_scope parent ON \
                child.parent_id=parent.id
            ), ancestry AS (
                SELECT n.id AS target_id, n.id, n.parent_id, n.code, n.name, 0 AS depth FROM nodes n
                UNION ALL
                SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1
                  FROM nodes parent JOIN ancestry ON ancestry.parent_id=parent.id
            ), node_paths AS (
                SELECT target_id, jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'resolved', true) \
                ORDER BY depth DESC) AS value
                  FROM ancestry GROUP BY target_id
            ), project_phases AS (
                SELECT phase.project_id, jsonb_agg(phase.phase_name ORDER BY phase.display_order) AS value
                  FROM organization.project_phase_name phase JOIN nodes node ON node.id=phase.project_id
                 GROUP BY phase.project_id
            ), business_rows AS (
                SELECT b.id, b.code, b.name, NULL::text AS legal_name, NULL::text AS credit_code, b.alias, b.remark AS \
                notes, b.status, b.version, b.created_at_epoch_millis, b.updated_at_epoch_millis, 'BRAND'::text AS type
                  FROM organization.brand b, params p WHERE b.workspace_uuid=p.workspace_uuid AND \
                  b.group_workspace_key=p.workspace_key
                UNION ALL
                SELECT t.id, t.code, t.name, t.legal_name, t.credit_code, NULL::text, t.remark, t.status, t.version, \
                t.created_at_epoch_millis, t.updated_at_epoch_millis, 'TENANT'::text
                  FROM organization.tenant t, params p WHERE t.workspace_uuid=p.workspace_uuid AND \
                  t.group_workspace_key=p.workspace_key
                UNION ALL
                SELECT h.id, h.code, h.name, h.legal_name, h.credit_code, NULL::text, h.remark, h.status, h.version, \
                h.created_at_epoch_millis, h.updated_at_epoch_millis, 'HEAD_COMPANY'::text
                  FROM organization.head_company h, params p WHERE h.workspace_uuid=p.workspace_uuid AND \
                  h.group_workspace_key=p.workspace_key
            ), all_items AS (
                SELECT n.id, 'HIERARCHY'::text AS category, n.node_type AS type, n.code, n.name, n.status, \
                'MANUAL'::text AS source,
                       n.version, n.created_at_epoch_millis AS created_at, n.updated_at_epoch_millis AS updated_at, \
                       n.notes,
                       NULL::text AS legal_name, NULL::text AS credit_code, NULL::text AS alias, paths.value AS path,
                       NULL::jsonb AS project, NULL::jsonb AS brand, NULL::jsonb AS tenant, NULL::jsonb AS head_company,
                       n.id AS project_filter_id, NULL::uuid AS brand_filter_id, NULL::uuid AS tenant_filter_id, \
                       NULL::uuid AS head_filter_id,
                       COALESCE(phases.value, '[]'::jsonb) AS project_phases
                  FROM nodes n JOIN node_paths paths ON paths.target_id=n.id LEFT JOIN project_phases phases ON \
                  phases.project_id=n.id
                 WHERE n.node_type IN ('REGION', 'PROJECT')
                UNION ALL
                SELECT b.id, 'BUSINESS_ENTITY', b.type, b.code, b.name, b.status, 'MANUAL', b.version, \
                b.created_at_epoch_millis, b.updated_at_epoch_millis, b.notes,
                       b.legal_name, b.credit_code, b.alias,
                       jsonb_build_array(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name, 'resolved', \
                       true)),
                       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb
                  FROM business_rows b
                UNION ALL
                SELECT s.id, 'STORE', 'STORE', s.code, s.name, s.status, 'MANUAL', s.version, \
                s.created_at_epoch_millis, s.updated_at_epoch_millis, s.notes,
                       NULL, NULL, NULL,
                       paths.value || jsonb_build_array(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, \
                       'resolved', true)),
                       jsonb_build_object('id', project.id, 'code', project.code, 'name', project.name, 'resolved', \
                       true),
                       jsonb_build_object('id', brand.id, 'code', brand.code, 'name', brand.name, 'resolved', true),
                       jsonb_build_object('id', tenant.id, 'code', tenant.code, 'name', tenant.name, 'resolved', true),
                       CASE WHEN head.id IS NULL THEN NULL ELSE jsonb_build_object('id', head.id, 'code', head.code, \
                       'name', head.name, 'resolved', true) END,
                       s.project_id, s.brand_id, s.tenant_id, s.head_company_id, '[]'::jsonb
                  FROM organization.store s
                  JOIN nodes project ON project.id=s.project_id
                  JOIN node_paths paths ON paths.target_id=s.project_id
                  JOIN organization.brand brand ON brand.id=s.brand_id
                  JOIN organization.tenant tenant ON tenant.id=s.tenant_id
                  LEFT JOIN organization.head_company head ON head.id=s.head_company_id
                  CROSS JOIN params p
                 WHERE s.workspace_uuid=p.workspace_uuid AND s.group_workspace_key=p.workspace_key
                   AND (p.scope_node_id IS NULL OR s.id=p.scope_node_id OR s.project_id IN (SELECT id FROM \
                   visible_scope WHERE node_type='PROJECT'))
            ), filtered AS MATERIALIZED (
                SELECT item.id, item.category, item.type, item.code, item.name, item.status, item.source,
                       item.version, item.created_at, item.updated_at, item.notes,
                       item.legal_name, item.credit_code, item.alias, item.path,
                       item.project, item.brand, item.tenant, item.head_company,
                       item.project_filter_id, item.brand_filter_id, item.tenant_filter_id,
                       item.head_filter_id, item.project_phases, COUNT(*) OVER () AS total
                  FROM all_items item CROSS JOIN params p
                 WHERE item.category=p.category
                   AND (p.type IS NULL OR item.type=p.type)
                   AND (p.name_pattern IS NULL OR item.name ILIKE p.name_pattern ESCAPE '!')
                   AND (p.code_pattern IS NULL OR item.code ILIKE p.code_pattern ESCAPE '!')
                   AND (p.legal_name_pattern IS NULL OR item.legal_name ILIKE p.legal_name_pattern ESCAPE '!')
                   AND (p.credit_code_pattern IS NULL OR item.credit_code ILIKE p.credit_code_pattern ESCAPE '!')
                   AND (p.status IS NULL OR item.status=p.status)
                   AND (p.source IS NULL OR (p.source='MANUAL' AND item.source='MANUAL'))
                   AND (p.project_id IS NULL OR item.project_filter_id=p.project_id)
                   AND (p.brand_id IS NULL OR item.brand_filter_id=p.brand_id)
                   AND (p.tenant_id IS NULL OR item.tenant_filter_id=p.tenant_id)
                   AND (p.head_company_id IS NULL OR item.head_filter_id=p.head_company_id)
            ), paged AS (
                SELECT filtered.id, filtered.category, filtered.type, filtered.code, filtered.name, filtered.status,
                       filtered.source, filtered.version, filtered.created_at, filtered.updated_at, filtered.notes,
                       filtered.legal_name, filtered.credit_code, filtered.alias, filtered.path,
                       filtered.project, filtered.brand, filtered.tenant, filtered.head_company,
                       filtered.project_filter_id, filtered.brand_filter_id, filtered.tenant_filter_id,
                       filtered.head_filter_id, filtered.project_phases, filtered.total
                  FROM filtered
                 ORDER BY""";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_EMPTY_LITERAL = " ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_LIMIT_FILTERED =
            """
                 LIMIT ? OFFSET ?
            ), filter_options AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'code', code, 'name', name) ORDER \
                BY kind, code), '[]'::jsonb) AS value
                  FROM (
                    SELECT 'PROJECT'::text AS kind, n.id, n.code, n.name FROM nodes n WHERE n.node_type='PROJECT'
                    UNION ALL SELECT 'BRAND', b.id, b.code, b.name FROM organization.brand b, params p WHERE \
                    b.workspace_uuid=p.workspace_uuid AND b.group_workspace_key=p.workspace_key
                    UNION ALL SELECT 'TENANT', t.id, t.code, t.name FROM organization.tenant t, params p WHERE \
                    t.workspace_uuid=p.workspace_uuid AND t.group_workspace_key=p.workspace_key
                    UNION ALL SELECT 'HEAD_COMPANY', h.id, h.code, h.name FROM organization.head_company h, params p \
                    WHERE h.workspace_uuid=p.workspace_uuid AND h.group_workspace_key=p.workspace_key
                  ) options
            )
            SELECT COALESCE((SELECT MAX(total) FROM paged), (SELECT COUNT(*) FROM filtered)),
                   COALESCE((SELECT MAX(updated_at) FROM paged), 0),
                   COALESCE((SELECT jsonb_agg(jsonb_build_object(
                       'id', id, 'category', category, 'type', type, 'code', code, 'name', name,
                       'path', path, 'status', status, 'source', source, 'version', version,
                       'createdAt', created_at, 'updatedAt', updated_at, 'notes', notes,
                       'legalName', legal_name, 'unifiedSocialCreditCode', credit_code, 'alias', alias,
                       'project', project, 'brand', brand, 'tenant', tenant, 'headCompany', head_company,
                       'projectPhases', project_phases
                   ) ORDER BY""";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_EMPTY_LITERAL_ALTERNATE_A = " ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_PROJECT_CODE_NAME_BRAND =
            "SELECT project.id, project.code, project.name, brand.id, brand.code, brand.name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_CODE_NAME_HEAD =
            "tenant.id, tenant.code, tenant.name, head.id, head.code, head.name ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE_STORE_FROM_ORGANIZATION_STORE_STOR =
            "FROM organization.store store ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT_STORE_PROJECT_ID =
            "JOIN organization.organization_node project ON project.id=store.project_id ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_WORKSPACE_UUID_STORE =
            "AND project.workspace_uuid=store.workspace_uuid ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_GROUP_WORKSPACE_KEY_STORE =
            "AND project.group_workspace_key=store.group_workspace_key ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_BRAND_STORE_BRAND_ID =
            "JOIN organization.brand brand ON brand.id=store.brand_id ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_BRAND_WORKSPACE_UUID_STORE =
            "AND brand.workspace_uuid=store.workspace_uuid ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_BRAND_GROUP_WORKSPACE_KEY_STORE =
            "AND brand.group_workspace_key=store.group_workspace_key ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_TENANT_STORE_TENANT_ID =
            "JOIN organization.tenant tenant ON tenant.id=store.tenant_id ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TENANT_WORKSPACE_UUID_STORE =
            "AND tenant.workspace_uuid=store.workspace_uuid ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TENANT_GROUP_WORKSPACE_KEY_STORE =
            "AND tenant.group_workspace_key=store.group_workspace_key ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_HEAD_STORE_HEAD_COMPANY_ID =
            "LEFT JOIN organization.head_company head ON head.id=store.head_company_id ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_HEAD_WORKSPACE_UUID_STORE =
            "AND head.workspace_uuid=store.workspace_uuid ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_HEAD_GROUP_WORKSPACE_KEY_STORE =
            "AND head.group_workspace_key=store.group_workspace_key ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE store.workspace_uuid=? AND store.group_workspace_key=? AND store.id=?";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET_PARENT_ID_NODE_TYPE_CODE =
            "WITH RECURSIVE target AS (SELECT id, parent_id, node_type, code, name, status, version, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CREATED_AT_EPOCH_MILLIS =
            "created_at_epoch_millis, updated_at_epoch_millis, notes, extension_values::text AS ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE =
            "extension_values FROM organization.organization_node WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION_PROJECT =
            "group_workspace_key=? AND id=? AND node_type IN ('REGION','PROJECT')), ancestry AS (SELECT id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_PARENT_ID_CODE_NAME_DEPTH =
            "parent_id, code, name, 0 AS depth FROM target UNION ALL SELECT parent.id, parent.parent_id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE_PARENT_CODE_NAME_ANCESTRY =
            "parent.code, parent.name, ancestry.depth+1 FROM organization.organization_node parent JOIN ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_PARENT_ID_PARENT_WORKSPACE_UUID =
            "ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PARENT_GROUP_WORKSPACE_KEY_TARGET_PARENT_ID =
            "parent.group_workspace_key=?) SELECT target.id, target.parent_id, target.node_type, target.code, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NAME_STATUS_VERSION =
            "target.name, target.status, target.version, target.created_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET =
            "target.updated_at_epoch_millis, target.notes, target.extension_values, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH =
            "array_agg(ancestry.id ORDER BY ancestry.depth ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_DESC_DIRECTION_PATH_IDS_ARRAY_AGG_ANCESTRY_CODE =
            "DESC) AS path_ids, array_agg(ancestry.code ORDER BY ancestry.depth DESC) AS path_codes, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_ARRAY_AGG_NAME_DEPTH_PATH_NAMES =
            "array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS path_names FROM target JOIN ancestry ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_JOIN_CONDITION_TARGET_PARENT_ID_NODE_TYPE_CODE =
            "ON true GROUP BY target.id, target.parent_id, target.node_type, target.code, target.name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS =
            "target.status, target.version, target.created_at_epoch_millis, target.updated_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NOTES_EXTENSION_VALUES =
            "target.notes, target.extension_values";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET_BRAND_TEXT_ENTITY_TYPE =
            "WITH target AS (SELECT id, 'BRAND'::text AS entity_type, code, name, NULL::text AS legal_name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TEXT_CREDIT_CODE_ALIAS_REMARK =
            "NULL::text AS credit_code, alias, remark AS notes, status, version, created_at_epoch_millis, ";
    public static final String UPDATE_BRAND_UPDATED_AT_EPOCH_001 =
            "updated_at_epoch_millis, extension_values::text AS extension_values FROM organization.brand ";
    public static final String WHERE_WS_UUID_GRP_WS_002 =
            "WHERE workspace_uuid=? AND group_workspace_key=? AND id=? UNION ALL SELECT id, 'TENANT', code, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_LEGAL_NAME_CREDIT_CODE_REMARK =
            "name, legal_name, credit_code, NULL, remark, status, version, created_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UPDATE_TENANT =
            "updated_at_epoch_millis, extension_values::text FROM organization.tenant WHERE workspace_uuid=? ";
    public static final String CONDITION_GRP_WS_KEY_HEAD_003 =
            "AND group_workspace_key=? AND id=? UNION ALL SELECT id, 'HEAD_COMPANY', code, name, legal_name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CREDIT_CODE_REMARK_STATUS_VERSION =
            "credit_code, NULL, remark, status, version, created_at_epoch_millis, updated_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY =
            "extension_values::text FROM organization.head_company WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_TARGET_ENTITY_TYPE_CODE =
            "group_workspace_key=? AND id=?) SELECT target.id, target.entity_type, target.code, target.name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_LEGAL_NAME_CREDIT_CODE_ALIAS =
            "target.legal_name, target.credit_code, target.alias, target.notes, target.status, target.version, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_ALTERNATE_A =
            "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.extension_values FROM target";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET_CODE_NAME_STATUS =
            "WITH RECURSIVE target AS (SELECT s.id, s.code, s.name, s.status, s.version, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CREATED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "s.created_at_epoch_millis, s.updated_at_epoch_millis, s.notes, s.extension_values::text AS ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_EXTENSION_VALUES_PROJECT_ID_CODE_PROJECT_CODE =
            "extension_values, p.id AS project_id, p.code AS project_code, p.name AS project_name, b.id AS ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_ID_CODE_BRAND_CODE_NAME =
            "brand_id, b.code AS brand_code, b.name AS brand_name, t.id AS tenant_id, t.code AS tenant_code, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_TENANT_NAME_HEAD_ID_CODE =
            "t.name AS tenant_name, h.id AS head_id, h.code AS head_code, h.name AS head_name FROM ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ID =
            "organization.store s JOIN organization.organization_node p ON p.id=s.project_id JOIN ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_TENANT_BRAND_BRAND_ID_TENANT_ID =
            "organization.brand b ON b.id=s.brand_id JOIN organization.tenant t ON t.id=s.tenant_id LEFT ";
    public static final String JOIN_HEAD_COMPANY_HEAD_COMPANY_004 =
            "JOIN organization.head_company h ON h.id=s.head_company_id WHERE s.workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_ANCESTRY_TARGET_PROJECT_ID =
            "s.group_workspace_key=? AND s.id=?), ancestry AS (SELECT target.project_id AS target_id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NODE_PARENT_ID_CODE_NAME =
            "node.id, node.parent_id, node.code, node.name, 0 AS depth FROM target JOIN ";
    public static final String ALT_ORG_NODE_TARGET_PROJECT_005 =
            "organization.organization_node node ON node.id=target.project_id UNION ALL SELECT ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_TARGET_ID_PARENT_PARENT_ID =
            "ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth+1 ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE_ANCESTRY_PARENT_PARENT_ID =
            "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PARENT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "parent.workspace_uuid=? AND parent.group_workspace_key=?) ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_TARGET_CODE_NAME =
            "SELECT target.id, target.code, target.name, ";
    public static final String TARGET_STATUS_VER_CREATED_AT_ALT_A_006 =
            "target.status, target.version, target.created_at_epoch_millis, target.updated_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_NOTES_EXTENSION_VALUES_PROJECT_ID =
            "target.notes, target.extension_values, target.project_id, target.project_code, target.project_name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_BRAND_ID_BRAND_CODE_BRAND_NAME =
            "target.brand_id, target.brand_code, target.brand_name, target.tenant_id, target.tenant_code, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_TENANT_NAME_HEAD_ID_HEAD_CODE =
            "target.tenant_name, target.head_id, target.head_code, target.head_name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ARRAY_AGG_ANCESTRY_DEPTH_PATH_IDS =
            "array_agg(ancestry.id ORDER BY ancestry.depth DESC) AS path_ids, array_agg(ancestry.code ORDER ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_DEPTH_PATH_CODES_ARRAY_AGG =
            "BY ancestry.depth DESC) AS path_codes, array_agg(ancestry.name ORDER BY ancestry.depth DESC) AS ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_PATH_NAMES_TARGET_ID_PROJECT_ID =
            "path_names FROM target JOIN ancestry ON ancestry.target_id=target.project_id GROUP BY ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_CODE_NAME_STATUS =
            "target.id, target.code, target.name, target.status, target.version, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_ALTERNATE_B =
            "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.notes, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_EXTENSION_VALUES_PROJECT_ID_PROJECT_CODE =
            "target.extension_values, target.project_id, target.project_code, target.project_name, ";
    public static final String TARGET_BRAND_ID_BRAND_CODE_ALT_A_007 =
            "target.brand_id, target.brand_code, target.brand_name, target.tenant_id, target.tenant_code, ";
    public static final String TARGET_TENANT_NAME_HEAD_ID_ALT_A_008 =
            "target.tenant_name, target.head_id, target.head_code, target.head_name";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP =
            "SELECT commercial_group.commercial_group_code, commercial_group.commercial_group_name, node.id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NODE_PARENT_ID_NODE_TYPE_CODE =
            "node.parent_id, node.node_type, node.code, node.name, node.status, node.notes, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NODE_UPDATED_AT_EPOCH_MILLIS =
            "node.updated_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PHASES_PHASE_NAMES_VARCHAR =
            "COALESCE(phases.phase_names, ARRAY[]::varchar[]) AS phase_names FROM ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_COMMERCIAL_GROUP =
            "organization.commercial_group commercial_group ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE_NODE_WORKSPACE_UUID =
            "LEFT JOIN organization.organization_node node ON node.workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NODE_GROUP_WORKSPACE_KEY_NODE_TYPE_REGION =
            "node.group_workspace_key=? AND node.node_type IN ('REGION','PROJECT') ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_LATERAL =
            "LEFT JOIN LATERAL (SELECT array_agg(phase_name ORDER BY display_order) AS phase_names FROM ";
    public static final String ALT_PROJECT_PHASE_NAME_PROJECT_009 =
            "organization.project_phase_name WHERE project_id=node.id) phases ON true ";
    public static final String WHERE_COMMERCIAL_GRP_WS_KEY_010 =
            "WHERE commercial_group.group_workspace_key=? ORDER BY node.node_type, node.code, node.id";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_ID_BRAND_ID =
            " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND (?::uuid IS NULL ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ID_HEAD_COMPANY_ID =
            "OR s.tenant_id=?) AND (?::uuid IS NULL OR s.head_company_id=?)";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORDER_BY = " ORDER BY ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_TARGET = "WITH RECURSIVE target AS (";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_ANCESTRY =
            " AND s.id=?), ancestry AS (";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_TARGET_PROJECT_ID_TARGET_ID_NODE =
            "SELECT target.project_id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_NODE_PROJECT_ID =
            "FROM target JOIN organization.organization_node node ON node.id=target.project_id ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UNION_ANCESTRY_TARGET_ID_PARENT_PARENT_ID =
            "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_DEPTH_PARENT =
            "ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_PARENT_ID_PARENT =
            "ancestry.parent_id=parent.id";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CLOSE_PAREN_PATHS_TARGET_ID_ARRAY_AGG_DEPTH =
            "), paths AS (SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ANCESTRY_DEPTH_PATH_CODES_ARRAY_AGG_NAME =
            "BY depth DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_BY_TARGET_ID = "GROUP BY target_id) ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_TARGET_CODE_NAME_STATUS =
            "SELECT target.id, target.code, target.name, target.status, target.version, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_ALTERNATE_C =
            ("target.extension_rule_revision, target.created_at_epoch_millis, target.u"
                    + "pdated_at_epoch_millis, target.notes, target.extension_values, ");
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_PROJECT_ID_PROJECT_CODE_PROJECT_NAME =
            "target.project_id, target.project_code, target.project_name, target.brand_id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_BRAND_CODE_BRAND_NAME_TENANT_ID =
            "target.brand_code, target.brand_name, target.tenant_id, target.tenant_code, target.tenant_name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TARGET_HEAD_ID_HEAD_CODE_HEAD_NAME =
            "target.head_id, target.head_code, target.head_name, paths.path_ids, paths.path_codes, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PATHS_PATH_NAMES_TARGET_ID_PROJECT_ID =
            "paths.path_names FROM target JOIN paths ON paths.target_id=target.project_id";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_SELECT_COUNT = "SELECT count(*)";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE = " FROM";
    public static final String CONDITION_PROJECT_ID_BRAND_ID_ALT_A_011 =
            " AND (?::uuid IS NULL OR s.project_id=?) AND (?::uuid IS NULL OR s.brand_id=?) AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_OPEN_PAREN_TENANT_ID_HEAD_COMPANY_ID =
            "(?::uuid IS NULL OR s.tenant_id=?) AND (?::uuid IS NULL OR s.head_company_id=?)";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TEXT = " AND (?::text IS NULL OR ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_AND_1_0 = " AND 1=0";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_VISIBLE_SCOPE_PARENT_ID_NODE_TYPE =
            " IN (WITH RECURSIVE visible_scope(id, parent_id, node_type) AS (SELECT id, parent_id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORGANIZATION_NODE_NODE_TYPE_WORKSPACE_UUID =
            "node_type FROM organization.organization_node WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_CHILD_PARENT_ID =
            "group_workspace_key=? AND id=? UNION ALL SELECT child.id, child.parent_id, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_VISIBLE_SCOPE_CHILD_NODE_TYPE_PARENT =
            "child.node_type FROM organization.organization_node child JOIN visible_scope parent ON ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CHILD_PARENT_ID_PARENT_WORKSPACE_UUID =
            "child.parent_id=parent.id WHERE child.workspace_uuid=? AND child.group_workspace_key=?) ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_VISIBLE_SCOPE_NODE_TYPE_PROJECT =
            "SELECT id FROM visible_scope WHERE node_type='PROJECT'))";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CTE_ANCESTRY = "WITH RECURSIVE ancestry AS (";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_NODE_TARGET_ID_PARENT_ID_CODE =
            "SELECT node.id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth FROM ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE =
            "organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_NODE = "AND node.id IN (";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_KIND_CODE_NAME_PROJECT =
            "SELECT kind, id, code, name FROM (SELECT 'PROJECT' AS kind, id, code, name FROM ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_ALTERNATE_A =
            "organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_NODE_TYPE_PROJECT_CODE_NAME =
            "node_type='PROJECT' UNION ALL SELECT 'BRAND', id, code, name FROM organization.brand WHERE ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_TENANT_CODE =
            "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT 'TENANT', id, code, name FROM ";
    public static final String ALT_TENANT_WS_UUID_GRP_012 =
            "organization.tenant WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_CODE_NAME_WORKSPACE_UUID =
            "'HEAD_COMPANY', id, code, name FROM organization.head_company WHERE workspace_uuid=? AND ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_OPTIONS_KIND_CODE =
            "group_workspace_key=?) options ORDER BY kind, code";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_CODE_NAME_STATUS_VERSION =
            "SELECT s.id, s.code, s.name, s.status, s.version, s.created_at_epoch_millis, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UPDATED_AT_EPOCH_MILLIS_NOTES_PROJECT_ID_CODE =
            ("s.updated_at_epoch_millis, s.extension_rule_revision, s.extension_values"
                    + "::text, s.notes, p.id AS project_id, p.code AS project_code, p.name AS ");
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PROJECT_NAME = "project_name, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_ID_CODE_BRAND_CODE_NAME_ALTERNATE_A =
            "b.id AS brand_id, b.code AS brand_code, b.name AS brand_name, t.id AS tenant_id, t.code AS ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_CODE = "tenant_code, ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_TENANT_NAME_HEAD_ID_CODE_ALTERNATE_A =
            "t.name AS tenant_name, h.id AS head_id, h.code AS head_code, h.name AS head_name FROM ";
    public static final String ALT_ORG_NODE_STORE_PROJECT_ALT_A_013 =
            "organization.store s JOIN organization.organization_node p ON p.id=s.project_id JOIN ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_BRAND = "organization.brand ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_BRAND_ID_TENANT_ID =
            "b ON b.id=s.brand_id JOIN organization.tenant t ON t.id=s.tenant_id LEFT JOIN ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_HEAD_COMPANY =
            "organization.head_company ";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_ID =
            "h ON h.id=s.head_company_id WHERE s.workspace_uuid=? AND s.group_workspace_key=?";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_ORGANIZATION_EXTENSION_VALUES_TEXT =
            "SELECT extension_values::text FROM organization.";
    public static final String ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String PLATFORM_FILTER_OPTIONS_SUFFIX = ") FROM paged), '[]'::jsonb)::text,\n"
            + """
                   filter_options.value::text
              FROM filter_options
            """;
    public static final String STORE_PAGE_ORDER_SUFFIX = ", s.id DESC LIMIT ? OFFSET ?";
    public static final String BASE_FILTER_NAME_SUFFIX = "name ILIKE ? ESCAPE '!') AND (?::text IS NULL OR ";
    public static final String BASE_FILTER_CODE_SUFFIX = "code ILIKE ? ESCAPE '!') AND (?::text IS NULL OR ";
    public static final String BASE_FILTER_STATUS_SUFFIX = "status=?)";
    public static final String OPTIONAL_TYPE_FILTER_PREFIX = " AND ";
    public static final String OPTIONAL_TYPE_FILTER_SUFFIX = "=?";
    public static final String VISIBLE_STORE_PREDICATE_PREFIX = " AND (";
    public static final String VISIBLE_STORE_ID_MATCH = "=?::uuid OR ";
    public static final String NODE_PATH_PARENT_SELECT =
            "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ";
    public static final String NODE_PATH_PARENT_FROM =
            "ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ";
    public static final String NODE_PATH_PARENT_WHERE =
            "ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?";
    public static final String NODE_PATH_SELECT_PROJECTION =
            ") SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth ";
    public static final String NODE_PATH_SELECT_PROJECTION_SUFFIX =
            "DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY ";
    public static final String PLATFORM_NAME_ORDER_PREFIX = "name ";
    public static final String PLATFORM_CODE_ORDER_PREFIX = "code ";
    public static final String PLATFORM_UPDATED_ORDER_PREFIX = "updated_at ";
    public static final String ORDER_ID_DESC_SUFFIX = ", id DESC";
    public static final String STORE_NAME_ORDER = "s.name";
    public static final String STORE_CODE_ORDER = "s.code";
    public static final String STORE_UPDATED_ORDER = "s.updated_at_epoch_millis";
}
