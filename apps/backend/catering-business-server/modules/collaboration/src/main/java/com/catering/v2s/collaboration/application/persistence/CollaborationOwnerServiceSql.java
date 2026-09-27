package com.catering.v2s.collaboration.application.persistence;

/** SQL text fragments owned by CollaborationOwnerPersistence. */
public final class CollaborationOwnerServiceSql {
    public static final String SELECT_EXTERNAL_SYSTEM_ENABLEMENT_KIND_001 =
            "SELECT 'EXTERNAL_SYSTEM' AS enablement_kind, external_system_code AS code, status, version ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_EXTERNAL_SYSTEM_ENABLEMENT_WORKSPACE_UUID =
            "FROM collaboration.external_system_enablement WHERE workspace_uuid=? ";
    public static final String CONDITION_GRP_WS_KEY_PROV_002 =
            "AND group_workspace_key=? UNION ALL SELECT 'PROVIDER_PROFILE' AS enablement_kind, ";
    public static final String COLLABORATION_OWNER_SERVICE_PROVIDER_CODE_CODE_STATUS_VERSION =
            "provider_code AS code, status, version ";
    public static final String FROM_CLAUSE_PROV_PROFILE_ENABLEMENT_003 =
            "FROM collaboration.provider_profile_enablement ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE workspace_uuid=? AND group_workspace_key=?";
    public static final String COLLABORATION_OWNER_SERVICE_CTE_OWNER_BINDINGS = "WITH RECURSIVE owner_bindings AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_BINDING_REF_PROVIDER_CODE_CAPABILITY_CLASS_NODE_TYPE =
            "SELECT binding_ref, provider_code, capability_class, node_type, node_ref, ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_DISPLAY_NAME_EXTERNAL_OWNER_ID_STATUS_VERSION =
            "binding_display_name, external_owner_id, status, version, created_at_epoch_millis, ";
    public static final String COLLABORATION_OWNER_SERVICE_OWNER_BINDING_STATUS_CHANGED_AT_EPOCH_MILLIS =
            "status_changed_at_epoch_millis FROM collaboration.owner_binding ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROVIDER_CODE =
            "WHERE workspace_uuid=? AND group_workspace_key=? AND provider_code=?";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_REQUESTED_NODES = "), requested_nodes AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_OWNER_BINDINGS_NODE_TYPE_NODE_REF =
            "SELECT DISTINCT node_type, node_ref FROM owner_bindings";
    public static final String
            COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_SEEDS_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT_ID =
                    "), node_seeds(target_node_type, target_node_ref, id, parent_id, path_node_type, code, name) AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_REQUESTED_NODE_TYPE_NODE_REF_NODE =
            "SELECT requested.node_type, requested.node_ref, node.id, node.parent_id, node.node_type, ";
    public static final String COLLABORATION_OWNER_SERVICE_ORGANIZATION_NODE_NODE_CODE_NAME_REQUESTED =
            "node.code, node.name FROM requested_nodes requested JOIN organization.organization_node node ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_REGION_PROJECT =
            "ON requested.node_type IN ('REGION','PROJECT') AND requested.node_type=node.node_type ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_REQUESTED_NODE_REF_NODE_TEXT =
            "AND requested.node_ref=node.id::text WHERE node.workspace_uuid=? ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_NODE_GROUP_WORKSPACE_KEY =
            "AND node.group_workspace_key=? UNION ALL ";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_REQUESTED_NODE_TYPE_NODE_REF_PROJECT =
            "SELECT requested.node_type, requested.node_ref, project.id, project.parent_id, project.node_type, ";
    public static final String COLLABORATION_OWNER_SERVICE_STORE_PROJECT_CODE_NAME_REQUESTED =
            "project.code, project.name FROM requested_nodes requested JOIN organization.store store ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_STORE_NODE_REF =
            "ON requested.node_type='STORE' AND requested.node_ref=store.id::text ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_ORGANIZATION_NODE_PROJECT_STORE_PROJECT_ID =
            "JOIN organization.organization_node project ON project.id=store.project_id ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE store.workspace_uuid=? AND store.group_workspace_key=? ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_PROJECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "AND project.workspace_uuid=? AND project.group_workspace_key=?";
    public static final String
            COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_ANCESTRY_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT_ID =
                    "), ancestry(target_node_type, target_node_ref, id, parent_id, ";
    public static final String COLLABORATION_OWNER_SERVICE_PATH_NODE_TYPE_CODE_NAME_DEPTH =
            "path_node_type, code, name, depth) AS (";
    public static final String
            COLLABORATION_OWNER_SERVICE_SELECT_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT_ID_PATH_NODE_TYPE =
                    "SELECT target_node_type, target_node_ref, id, parent_id, path_node_type, code, name, ";
    public static final String COLLABORATION_OWNER_SERVICE_NODE_SEEDS_DEPTH = "0 AS depth FROM node_seeds ";
    public static final String COLLABORATION_OWNER_SERVICE_UNION_ANCESTRY_TARGET_NODE_TYPE_TARGET_NODE_REF_PARENT =
            "UNION ALL SELECT ancestry.target_node_type, ancestry.target_node_ref, parent.id, parent.parent_id, ";
    public static final String COLLABORATION_OWNER_SERVICE_PARENT_NODE_TYPE_CODE_NAME =
            "parent.node_type, parent.code, parent.name, ancestry.depth + 1 ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PARENT =
            "FROM organization.organization_node parent ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_ANCESTRY_PARENT_ID_PARENT_WORKSPACE_UUID =
            "JOIN ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_PARENT_GROUP_WORKSPACE_KEY =
            "AND parent.group_workspace_key=?";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_PATHS = "), node_paths AS (";
    public static final String SELECT_TARGET_NODE_TYPE_TARGET_004 =
            "SELECT target_node_type, target_node_ref, jsonb_agg(jsonb_build_object('ref', id, 'code', code, ";
    public static final String COLLABORATION_OWNER_SERVICE_NAME_NODE_TYPE_PATH_NODE_TYPE_DEPTH =
            "'name', name, 'nodeType', path_node_type) ORDER BY depth DESC) AS node_path ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_ANCESTRY_TARGET_NODE_TYPE_TARGET_NODE_REF =
            "FROM ancestry GROUP BY target_node_type, target_node_ref";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_OWNER_NODE_PATH = "), owner_node_path AS (";
    public static final String
            COLLABORATION_OWNER_SERVICE_SELECT_COMMERCIAL_GROUP_NODE_TYPE_COMMERCIAL_GROUP_UUID_TEXT =
                    "SELECT 'COMMERCIAL_GROUP' AS node_type, commercial_group_uuid::text AS node_ref, ";
    public static final String COLLABORATION_OWNER_SERVICE_JSONB_BUILD_ARRAY =
            "jsonb_build_array(jsonb_build_object('ref', commercial_group_uuid, 'code', commercial_group_code, ";
    public static final String COLLABORATION_OWNER_SERVICE_NAME_COMMERCIAL_GROUP_NAME_NODE_TYPE_NODE_PATH =
            "'name', commercial_group_name, 'nodeType', 'GROUP')) AS node_path ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_REQUESTED_NODES_GROUP_NODE_REQUESTED =
            "FROM organization.commercial_group group_node JOIN requested_nodes requested ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_COMMERCIAL_GROUP =
            "ON requested.node_type='COMMERCIAL_GROUP' ";
    public static final String
            COLLABORATION_OWNER_SERVICE_CONDITION_REQUESTED_NODE_REF_GROUP_NODE_COMMERCIAL_GROUP_UUID =
                    "AND requested.node_ref=group_node.commercial_group_uuid::text ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_GROUP_NODE_GROUP_WORKSPACE_KEY =
            "WHERE group_node.group_workspace_key=? UNION ALL ";
    public static final String
            COLLABORATION_OWNER_SERVICE_SELECT_NODE_SEEDS_NODE_TARGET_NODE_TYPE_TARGET_NODE_REF_NODE_PATHS =
                    "SELECT node.target_node_type, node.target_node_ref, node_paths.node_path FROM node_seeds node ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_NODE_PATHS_TARGET_NODE_TYPE_NODE =
            "JOIN node_paths ON node_paths.target_node_type=node.target_node_type ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_NODE_PATHS_TARGET_NODE_REF_NODE =
            "AND node_paths.target_node_ref=node.target_node_ref ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_NODE_TARGET_NODE_TYPE_REGION_PROJECT =
            "WHERE node.target_node_type IN ('REGION','PROJECT') ";
    public static final String COLLABORATION_OWNER_SERVICE_UNION_HEAD_COMPANY_TEXT =
            "UNION ALL SELECT 'HEAD_COMPANY', head_company.id::text, ";
    public static final String COLLABORATION_OWNER_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_REF_HEAD_COMPANY =
            "jsonb_build_array(jsonb_build_object('ref', head_company.id, 'code', head_company.code, ";
    public static final String COLLABORATION_OWNER_SERVICE_NAME_HEAD_COMPANY_NODE_TYPE_NODE_PATH =
            "'name', head_company.name, 'nodeType', 'HEAD_COMPANY')) AS node_path ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_REQUESTED_NODES_REQUESTED =
            "FROM organization.head_company head_company JOIN requested_nodes requested ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_HEAD_COMPANY_NODE_REF =
            "ON requested.node_type='HEAD_COMPANY' AND requested.node_ref=head_company.id::text ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_HEAD_COMPANY_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE head_company.workspace_uuid=? AND head_company.group_workspace_key=? UNION ALL ";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_STORE_TEXT_NODE_PATHS_NODE_PATH =
            "SELECT 'STORE', store.id::text, node_paths.node_path || jsonb_build_array(jsonb_build_object(";
    public static final String COLLABORATION_OWNER_SERVICE_REF_STORE_CODE_NAME =
            "'ref', store.id, 'code', store.code, 'name', store.name, 'nodeType', 'STORE')) AS node_path ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_REQUESTED_NODES_REQUESTED_ALTERNATE_A =
            "FROM organization.store store JOIN requested_nodes requested ";
    public static final String
            COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_REQUESTED_NODE_TYPE_STORE_NODE_REF_ALTERNATE_A =
                    "ON requested.node_type='STORE' AND requested.node_ref=store.id::text ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_NODE_PATHS_TARGET_NODE_TYPE_STORE =
            "JOIN node_paths ON node_paths.target_node_type='STORE' ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_NODE_PATHS_TARGET_NODE_REF_STORE_TEXT =
            "AND node_paths.target_node_ref=store.id::text ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_STORE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A =
            "WHERE store.workspace_uuid=? AND store.group_workspace_key=?";
    public static final String
            COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_BINDING_BINDING_REF_PROVIDER_CODE_CAPABILITY_CLASS =
                    ") SELECT binding.binding_ref, binding.provider_code, binding.capability_class, ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_NODE_TYPE_NODE_REF_BINDING_DISPLAY_NAME =
            "binding.node_type, binding.node_ref, binding.binding_display_name, ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_EXTERNAL_OWNER_ID_STATUS_VERSION =
            "binding.external_owner_id, binding.status, binding.version, ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING =
            "binding.created_at_epoch_millis, binding.status_changed_at_epoch_millis, ";
    public static final String COLLABORATION_OWNER_SERVICE_NODE_PATH_TEXT_TOTAL =
            "node_path.node_path::text AS node_path, COUNT(*) OVER() AS total ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_OWNER_NODE_PATH_BINDING_NODE_PATH =
            "FROM owner_bindings binding LEFT JOIN owner_node_path node_path ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_NODE_PATH_NODE_TYPE_BINDING_NODE_REF =
            "ON node_path.node_type=binding.node_type AND node_path.node_ref=binding.node_ref ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_TEXT_BINDING_BINDING_DISPLAY_NAME_ILIKE =
            "WHERE (?::text IS NULL OR COALESCE(binding.binding_display_name, '') ILIKE ? ESCAPE E'\\\\') ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_TEXT_CONCAT_WS_BINDING_NODE_REF =
            "AND (?::text IS NULL OR CONCAT_WS(' ', binding.node_ref, ";
    public static final String COLLABORATION_OWNER_SERVICE_NODE_PATH_TEXT = "COALESCE(node_path.node_path::text, '')) ";
    public static final String COLLABORATION_OWNER_SERVICE_ILIKE_ESCAPE = "ILIKE ? ESCAPE E'\\\\') ORDER BY ";
    public static final String COLLABORATION_OWNER_SERVICE_LIMIT_LIMIT_OFFSET = " LIMIT ? OFFSET ?";
    public static final String SELECT_BINDING_REF_EXTERNAL_SYSTEM_005 =
            "SELECT binding_ref, external_system_code, provider_code, capability_class, ";
    public static final String COLLABORATION_OWNER_SERVICE_NODE_TYPE_NODE_REF = "node_type, node_ref, ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_DISPLAY_NAME =
            "binding_display_name, external_owner_id, authorization_ref, status, ";
    public static final String COLLABORATION_OWNER_SERVICE_UNBIND_REQUESTED_AT_EPOCH_MILLIS =
            "unbind_requested_at_epoch_millis, external_revoked_at_epoch_millis, ";
    public static final String DELETE_DELETED_AT_EPOCH_MS_006 =
            "deleted_at_epoch_millis, version, created_at_epoch_millis, ";
    public static final String STATUS_CHANGED_AT_EPOCH_MS_007 =
            "status_changed_at_epoch_millis, updated_at_epoch_millis ";
    public static final String FROM_CLAUSE_OWNER_BINDING_WS_008 =
            "FROM collaboration.owner_binding WHERE workspace_uuid=? AND group_workspace_key=? ";
    public static final String CONDITION_PROV_CODE_NODE_TYPE_009 =
            "AND provider_code=? AND node_type=? AND node_ref=? ORDER BY binding_ref";
    public static final String COLLABORATION_OWNER_SERVICE_INSERT_INTO = "INSERT INTO ";
    public static final String COLLABORATION_OWNER_SERVICE_VALUE_SEPARATOR_STATUS =
            ", status, version, created_at_epoch_millis, updated_at_epoch_millis) ";
    public static final String COLLABORATION_OWNER_SERVICE_VALUES_VALUES_1 = "VALUES (?, ?, ?, ?, 1, ?, ?)";
    public static final String COLLABORATION_OWNER_SERVICE_SET_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS =
            " SET status=?, version=version+1, updated_at_epoch_millis=? ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A =
            "WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String INSERT_INTO_OWNER_BINDING_REF_010 =
            "INSERT INTO collaboration.owner_binding (binding_ref, workspace_uuid, group_workspace_key, ";
    public static final String COLLABORATION_OWNER_SERVICE_EXTERNAL_SYSTEM_CODE =
            "external_system_code, provider_code, capability_class, node_type, node_ref, ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_DISPLAY_NAME_ALTERNATE_A =
            "binding_display_name, external_owner_id, authorization_ref, status, version, ";
    public static final String COLLABORATION_OWNER_SERVICE_CREATED_AT_EPOCH_MILLIS =
            "created_at_epoch_millis, status_changed_at_epoch_millis, updated_at_epoch_millis) ";
    public static final String COLLABORATION_OWNER_SERVICE_VALUES_VALUES_NULL_1_RETURNING =
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?) RETURNING ";
    public static final String COLLABORATION_OWNER_SERVICE_UPDATE_OWNER_BINDING_BINDING_DISPLAY_NAME_EXTERNAL_OWNER_ID =
            "UPDATE collaboration.owner_binding SET binding_display_name=?, external_owner_id=?, ";
    public static final String COLLABORATION_OWNER_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_BINDING_REF =
            "version=version+1, updated_at_epoch_millis=? WHERE binding_ref=? ";
    public static final String CONDITION_WS_UUID_GRP_WS_011 =
            "AND workspace_uuid=? AND group_workspace_key=? AND version=? AND status<>?";
    public static final String COLLABORATION_OWNER_SERVICE_UPDATE_OWNER_BINDING_STATUS_DELETED_AT_EPOCH_MILLIS =
            "UPDATE collaboration.owner_binding SET status=?, deleted_at_epoch_millis=?, ";
    public static final String COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS =
            "status_changed_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF = "WHERE binding_ref=? ";
    public static final String CONDITION_WS_UUID_GRP_WS_ALT_A_012 =
            "AND workspace_uuid=? AND group_workspace_key=? AND version=? AND status<>? RETURNING ";
    public static final String UPDATE_OWNER_BINDING_EXTERNAL_OWNER_013 =
            "UPDATE collaboration.owner_binding SET external_owner_id=?, authorization_ref=?, status=?, ";
    public static final String COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS_ALTERNATE_A =
            "status_changed_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_VERSION =
            "WHERE binding_ref=? AND version=?";
    public static final String UPDATE_OWNER_BINDING_EXTERNAL_REVOKED_014 =
            "UPDATE collaboration.owner_binding SET external_revoked_at_epoch_millis=?, status=?, ";
    public static final String COLLABORATION_OWNER_SERVICE_STATUS_CHANGED_AT_EPOCH_MILLIS_ALTERNATE_B =
            "status_changed_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_VERSION_ALTERNATE_A =
            "WHERE binding_ref=? AND version=?";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            "WHERE binding_ref=? AND workspace_uuid=? AND group_workspace_key=?";
    public static final String WHERE_BINDING_REF_WS_UUID_ALT_A_015 =
            "WHERE binding_ref=? AND workspace_uuid=? AND group_workspace_key=? FOR UPDATE";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_BINDING_REF_ALTERNATE_A = "WHERE binding_ref=?";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_OWNER_BINDING_FROM_COLLABORATION_OWNER_BIN =
            " FROM collaboration.owner_binding ";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_STATUS_VERSION = "SELECT status, version FROM ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B =
            " WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_STATUS_VERSION_ALTERNATE_A =
            "SELECT status, version FROM ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_C =
            " WHERE workspace_uuid=? AND group_workspace_key=? AND ";
    public static final String WHERE_WS_UUID_GRP_WS_ALT_D_016 = " WHERE workspace_uuid=? AND group_workspace_key=?";
    public static final String COLLABORATION_OWNER_SERVICE_CTE_TARGET = "WITH RECURSIVE target AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_TEXT_TARGET_TYPE_TARGET_ID_WORKSPACE_UUID =
            "SELECT ?::text AS target_type, ?::uuid AS target_id, ?::uuid AS workspace_uuid, ";
    public static final String COLLABORATION_OWNER_SERVICE_PARAMETER_PLACEHOLDER_TEXT_GROUP_WORKSPACE_KEY =
            "?::text AS group_workspace_key";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_STORE_TARGET = "), store_target AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_TARGET_TARGET_TYPE_TARGET_ID_STORE =
            "SELECT target.target_type, target.target_id, store.id, store.code, store.name, ";
    public static final String COLLABORATION_OWNER_SERVICE_STORE_PROJECT_ID_TARGET_TYPE =
            "store.project_id FROM target JOIN organization.store store ON target.target_type='STORE' ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_STORE_TARGET_TARGET_ID_WORKSPACE_UUID =
            "AND store.id=target.target_id AND store.workspace_uuid=target.workspace_uuid ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_STORE_GROUP_WORKSPACE_KEY_TARGET =
            "AND store.group_workspace_key=target.group_workspace_key";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_SEEDS = "), node_seeds AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_TARGET_TARGET_TYPE_TARGET_ID_NODE =
            "SELECT target.target_type, target.target_id, node.id, node.parent_id, node.node_type, ";
    public static final String COLLABORATION_OWNER_SERVICE_ORGANIZATION_NODE_NODE_CODE_NAME_DEPTH =
            "node.code, node.name, 0 AS depth FROM target JOIN organization.organization_node node ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_CONDITION_TARGET_TARGET_TYPE_REGION_PROJECT =
            "ON target.target_type IN ('REGION','PROJECT') AND node.id=target.target_id ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_NODE_WORKSPACE_UUID_TARGET =
            "AND node.workspace_uuid=target.workspace_uuid ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_NODE_GROUP_WORKSPACE_KEY_TARGET =
            "AND node.group_workspace_key=target.group_workspace_key ";
    public static final String COLLABORATION_OWNER_SERVICE_UNION_STORE_TARGET_TARGET_TYPE_TARGET_ID_PROJECT =
            "UNION ALL SELECT store_target.target_type, store_target.target_id, project.id, ";
    public static final String COLLABORATION_OWNER_SERVICE_PROJECT_PARENT_ID_NODE_TYPE_CODE =
            "project.parent_id, project.node_type, project.code, project.name, 0 AS depth ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_ORGANIZATION_NODE_PROJECT =
            "FROM store_target JOIN target ON TRUE JOIN organization.organization_node project ";
    public static final String JOIN_CONDITION_PROJECT_STORE_TARGET_017 =
            "ON project.id=store_target.project_id AND project.workspace_uuid=target.workspace_uuid ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_PROJECT_GROUP_WORKSPACE_KEY_TARGET =
            "AND project.group_workspace_key=target.group_workspace_key";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_ANCESTRY = "), ancestry AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_NODE_SEEDS_TARGET_TYPE_TARGET_ID_PARENT_ID_NODE_TYPE =
            "SELECT target_type, target_id, id, parent_id, node_type, code, name, depth FROM node_seeds ";
    public static final String COLLABORATION_OWNER_SERVICE_UNION_ANCESTRY_TARGET_TYPE_TARGET_ID_PARENT =
            "UNION ALL SELECT ancestry.target_type, ancestry.target_id, parent.id, parent.parent_id, ";
    public static final String COLLABORATION_OWNER_SERVICE_PARENT_NODE_TYPE_CODE_NAME_ALTERNATE_A =
            "parent.node_type, parent.code, parent.name, ancestry.depth+1 ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_TARGET_FROM_ANCESTRY_JOIN_TARGET_ON =
            "FROM ancestry JOIN target ON TRUE ";
    public static final String COLLABORATION_OWNER_SERVICE_JOIN_ORGANIZATION_NODE_PARENT_ANCESTRY_PARENT_ID =
            "JOIN organization.organization_node parent ON parent.id=ancestry.parent_id ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_PARENT_WORKSPACE_UUID_TARGET =
            "AND parent.workspace_uuid=target.workspace_uuid ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_PARENT_GROUP_WORKSPACE_KEY_TARGET =
            "AND parent.group_workspace_key=target.group_workspace_key";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_NODE_PATH = "), node_path AS (";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT_TARGET_TYPE_TARGET_ID_JSONB_AGG_JSONB_BUILD_OBJECT =
            "SELECT target_type, target_id, jsonb_agg(jsonb_build_object('ref', id, 'code', code, ";
    public static final String COLLABORATION_OWNER_SERVICE_ANCESTRY_NAME_NODE_TYPE_DEPTH_PATH =
            "'name', name, 'nodeType', node_type) ORDER BY depth DESC) AS path FROM ancestry ";
    public static final String COLLABORATION_OWNER_SERVICE_GROUP_BY_TARGET_TYPE_TARGET_ID =
            "GROUP BY target_type, target_id";
    public static final String COLLABORATION_OWNER_SERVICE_CLOSE_PAREN_SELECT_CASE = ") SELECT CASE ";
    public static final String COLLABORATION_OWNER_SERVICE_WHEN_TARGET_TARGET_TYPE_COMMERCIAL_GROUP =
            "WHEN target.target_type='COMMERCIAL_GROUP' THEN ";
    public static final String COLLABORATION_OWNER_SERVICE_OPEN_PAREN_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT =
            "(SELECT jsonb_build_array(jsonb_build_object(";
    public static final String COLLABORATION_OWNER_SERVICE_REF_GROUP_NODE_COMMERCIAL_GROUP_UUID_CODE =
            "'ref', group_node.commercial_group_uuid, 'code', group_node.commercial_group_code, ";
    public static final String COLLABORATION_OWNER_SERVICE_NAME_GROUP_NODE_COMMERCIAL_GROUP_NAME_NODE_TYPE =
            "'name', group_node.commercial_group_name, 'nodeType', 'GROUP')) ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_COMMERCIAL_GROUP_FROM_ORGANIZATION_COMMERCIAL =
            "FROM organization.commercial_group ";
    public static final String COLLABORATION_OWNER_SERVICE_GROUP_NODE_COMMERCIAL_GROUP_UUID_TARGET_TARGET_ID =
            "group_node WHERE group_node.commercial_group_uuid=target.target_id ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_GROUP_NODE_GROUP_WORKSPACE_KEY_TARGET =
            "AND group_node.group_workspace_key=target.group_workspace_key) ";
    public static final String COLLABORATION_OWNER_SERVICE_WHEN_TARGET_TARGET_TYPE_HEAD_COMPANY_JSONB_BUILD_ARRAY =
            "WHEN target.target_type='HEAD_COMPANY' THEN (SELECT jsonb_build_array(jsonb_build_object(";
    public static final String COLLABORATION_OWNER_SERVICE_REF_HEAD_COMPANY_CODE_NAME =
            "'ref', head_company.id, 'code', head_company.code, 'name', head_company.name, ";
    public static final String COLLABORATION_OWNER_SERVICE_HEAD_COMPANY_NODE_TYPE =
            "'nodeType', 'HEAD_COMPANY')) FROM organization.head_company head_company ";
    public static final String COLLABORATION_OWNER_SERVICE_WHERE_HEAD_COMPANY = "WHERE head_company.id=";
    public static final String COLLABORATION_OWNER_SERVICE_TARGET_TARGET_ID_HEAD_COMPANY_WORKSPACE_UUID =
            "target.target_id AND head_company.workspace_uuid=target.workspace_uuid ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_HEAD_COMPANY_GROUP_WORKSPACE_KEY_TARGET =
            "AND head_company.group_workspace_key=target.group_workspace_key) ";
    public static final String COLLABORATION_OWNER_SERVICE_WHEN_TARGET_TARGET_TYPE_STORE_NODE_PATH =
            "WHEN target.target_type='STORE' THEN COALESCE(node_path.path, '[]'::jsonb) || ";
    public static final String COLLABORATION_OWNER_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_REF_STORE_TARGET =
            "COALESCE((SELECT jsonb_build_array(jsonb_build_object('ref', store_target.id, 'code', ";
    public static final String COLLABORATION_OWNER_SERVICE_STORE_TARGET_CODE_NAME_NODE_TYPE =
            "store_target.code, 'name', store_target.name, 'nodeType', 'STORE')) ";
    public static final String COLLABORATION_OWNER_SERVICE_FROM_CLAUSE_STORE_TARGET_FROM_STORE_TARGET_JSONB =
            "FROM store_target), '[]'::jsonb) ";
    public static final String COLLABORATION_OWNER_SERVICE_ELSE_TARGET_NODE_PATH_PATH_TEXT =
            "ELSE COALESCE(node_path.path, '[]'::jsonb) END::text AS node_path FROM target ";
    public static final String COLLABORATION_OWNER_SERVICE_NODE_PATH_TARGET_TYPE_TARGET =
            "LEFT JOIN node_path ON node_path.target_type=target.target_type ";
    public static final String COLLABORATION_OWNER_SERVICE_CONDITION_NODE_PATH_TARGET_ID_TARGET =
            "AND node_path.target_id=target.target_id";
    public static final String COLLABORATION_OWNER_SERVICE_COLLABORATION_EXTERNAL_SYSTEM_ENABLEMENT =
            "collaboration.external_system_enablement";
    public static final String COLLABORATION_OWNER_SERVICE_COLLABORATION_PROVIDER_PROFILE_ENABLEMENT =
            "collaboration.provider_profile_enablement";
    public static final String COLLABORATION_OWNER_SERVICE_OPEN_PAREN_WORKSPACE_UUID_GROUP_WORKSPACE_KEY =
            " (workspace_uuid, group_workspace_key, ";
    public static final String COLLABORATION_OWNER_SERVICE_EXTERNAL_SYSTEM_CODE_ALTERNATE_A = "external_system_code";
    public static final String COLLABORATION_OWNER_SERVICE_PROVIDER_CODE = "provider_code";
    public static final String COLLABORATION_OWNER_SERVICE_UPDATE = "UPDATE ";
    public static final String COLLABORATION_OWNER_SERVICE_VERSION = "=? AND version=?";
    public static final String COLLABORATION_OWNER_SERVICE_SELECT = "SELECT ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_REF =
            "binding_ref, workspace_uuid, group_workspace_key, external_system_code, provider_code, ";
    public static final String COLLABORATION_OWNER_SERVICE_CAPABILITY_CLASS_NODE_TYPE_NODE_REF_BINDING_DISPLAY_NAME =
            "capability_class, node_type, node_ref, binding_display_name, external_owner_id, authorization_ref, ";
    public static final String COLLABORATION_OWNER_SERVICE_STATUS =
            "status, unbind_requested_at_epoch_millis, external_revoked_at_epoch_millis, ";
    public static final String COLLABORATION_OWNER_SERVICE_DELETE_DELETED_AT_EPOCH_MILLIS =
            "deleted_at_epoch_millis, version, created_at_epoch_millis, status_changed_at_epoch_millis, ";
    public static final String COLLABORATION_OWNER_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS = "updated_at_epoch_millis";
    public static final String COLLABORATION_OWNER_SERVICE_SQL_PUNCTUATION = "=?";
    public static final String COLLABORATION_OWNER_SERVICE_FOR_UPDATE = "=? FOR UPDATE";
    public static final String COLLABORATION_OWNER_SERVICE_VALUE_SEPARATOR_STATUS_VERSION = ", status, version FROM ";
    public static final String COLLABORATION_OWNER_SERVICE_ASC_DIRECTION = "ASC";
    public static final String COLLABORATION_OWNER_SERVICE_DESC_DIRECTION = "DESC";
    public static final String COLLABORATION_OWNER_SERVICE_NODE_PATH_TEXT_BINDING_NODE_REF =
            "COALESCE(node_path.node_path::text, binding.node_ref)";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_CAPABILITY_CLASS =
            "COALESCE(binding.capability_class, '')";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_EXTERNAL_OWNER_ID =
            "COALESCE(binding.external_owner_id, '')";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_STATUS = "binding.status";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_BINDING_DISPLAY_NAME =
            "COALESCE(binding.binding_display_name, '')";
    public static final String COLLABORATION_OWNER_SERVICE_EMPTY_LITERAL = " ";
    public static final String COLLABORATION_OWNER_SERVICE_BINDING_BINDING_REF = " NULLS LAST, binding.binding_ref ASC";

    public static final String INSERT_INTO_AUDIT_EVENT_REF_018 =
            "INSERT INTO collaboration.audit_event (event_ref, workspace_uuid, group_workspace_key, ";
    public static final String COLLABORATION_OWNER_SERVICE_ACTOR_TYPE_ACTOR_ID_ACTOR_DISPLAY_SNAPSHOT_ENTITY_TYPE =
            "actor_type, actor_id, actor_display_snapshot, entity_type, entity_ref, action, ";
    public static final String COLLABORATION_OWNER_SERVICE_CHANGES_JSON_OCCURRED_AT_EPOCH_MILLIS =
            "changes_json, occurred_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
}
