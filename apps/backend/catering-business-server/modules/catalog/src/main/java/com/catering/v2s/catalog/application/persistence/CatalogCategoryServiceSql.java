package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogCategoryService; B3 relocates text only and does not change execution. */
public final class CatalogCategoryServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_NAME_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE catalog.catalog_category SET name=?,version=version+1,updated_at_epoch_millis=? WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_REF = "category_ref=?";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_UPDATE_CATALOG_CATALOG_CATEG =
            "UPDATE catalog.catalog_category SET ";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_CATEGORY_REF =
            "parent_category_ref=?,display_order=?,version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE = "WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_REF_ALTERNATE_A = "category_ref=?";
    public static final String CATALOG_CATEGORY_SERVICE_CTE_ANCESTORS_CATEGORY_REF_PARENT_CATEGORY_REF_DEPTH =
            "WITH RECURSIVE ancestors(category_ref,parent_category_ref,depth) AS (";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF =
            "SELECT category_ref,parent_category_ref,1 FROM catalog.catalog_category ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF = "WHERE data_node_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_BRAND_REF_CATEGORY_REF_STATUS_VOIDED =
            "AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ANCESTORS =
            "SELECT parent.category_ref,parent.parent_category_ref,ancestors.depth+1 ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_ANCESTORS_PARENT =
            "FROM catalog.catalog_category parent JOIN ancestors ON ";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_CATEGORY_REF_ANCESTORS_PARENT_CATEGORY_REF =
            "parent.category_ref=ancestors.parent_category_ref WHERE parent.data_node_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_BRAND_REF_STATUS_VOIDED =
            "parent.brand_ref=? AND parent.status <> 'VOIDED'), ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_DEPTH =
            "subtree(category_ref,depth) AS (SELECT category_ref,1 FROM catalog.catalog_category WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS =
            "data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_CHILD_CATEGORY_REF_SUBTREE_DEPTH =
            "SELECT child.category_ref,subtree.depth+1 FROM catalog.catalog_category child ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_SUBTREE_CHILD_PARENT_CATEGORY_REF_CATEGORY_REF =
            "JOIN subtree ON child.parent_category_ref=subtree.category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF =
            "WHERE child.data_node_ref=? AND child.brand_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_ANCESTORS_CHILD_STATUS_VOIDED_DEPTH =
            "AND child.status <> 'VOIDED') SELECT COALESCE((SELECT MAX(depth) FROM ancestors),0), ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_DEPTH = "COALESCE((SELECT MAX(depth) FROM subtree),0)";
    public static final String CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_DEPTH =
            "WITH RECURSIVE subtree(category_ref,depth) AS (SELECT category_ref,1 FROM catalog.catalog_category ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS =
            "WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_SUBTREE_CHILD_CATEGORY_REF_DEPTH =
            "SELECT child.category_ref,subtree.depth+1 FROM catalog.catalog_category child JOIN subtree ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_CONDITION_CHILD_PARENT_CATEGORY_REF_SUBTREE_CATEGORY_REF =
            "ON child.parent_category_ref=subtree.category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
            "WHERE child.data_node_ref=? AND child.brand_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_SUBTREE_CHILD_STATUS_VOIDED_DEPTH =
            "AND child.status <> 'VOIDED') SELECT COALESCE(MAX(depth),0) FROM subtree";
    public static final String
            CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_DISPLAY_ORDER_VERSION_UPDATED_AT_EPOCH_MILLIS =
                    "UPDATE catalog.catalog_category SET display_order=?,version=version+1,updated_at_epoch_millis=? WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_REF_ALTERNATE_B = "category_ref=?";
    public static final String
            CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_DISPLAY_ORDER_VERSION_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A =
                    "UPDATE catalog.catalog_category SET display_order=?,version=version+1,updated_at_epoch_millis=? WHERE ";

    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF =
            "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref IN (";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_A =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_PARENT_CATEGORY_REF =
            "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND parent_category_ref IS ";
    public static final String CATALOG_CATEGORY_SERVICE_NOT_PREDICATE_PREFIX = "NOT ";
    public static final String CATALOG_CATEGORY_SERVICE_STATUS_VOIDED_CATEGORY_REF =
            "DISTINCT FROM ? AND status <> 'VOIDED' ORDER BY category_ref FOR UPDATE";
    public static final String CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF =
            "WITH RECURSIVE subtree(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS_ALTERNATE_A =
            "data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_CHILD_CATEGORY_REF_PARENT =
            "child.category_ref FROM catalog.catalog_category child JOIN subtree parent ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF =
            "child.parent_category_ref=parent.category_ref WHERE child.data_node_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_BRAND_REF = "child.brand_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_SUBTREE_CHILD_STATUS_VOIDED_CATEGORY_REF =
            "AND child.status <> 'VOIDED') SELECT category_ref FROM subtree ORDER BY category_ref";
    public static final String CATALOG_CATEGORY_SERVICE_INSERT_INTO_CATALOG_CATEGORY_INSERT_INTO_CATALOG_CATALOG_ =
            "INSERT INTO catalog.catalog_category ";
    public static final String CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CATEGORY_REF_DATA_NODE_REF_BRAND_REF_CODE =
            "(category_ref,data_node_ref,brand_ref,code,name,parent_category_ref,display_order,create";

    public static final String CATALOG_CATEGORY_SERVICE_CTE_RECEIPT_LOCK_PG_ADVISORY_XACT_LOCK_HASHTEXT =
            "WITH RECURSIVE receipt_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(CAST(? AS ";
    public static final String CATALOG_CATEGORY_SERVICE_TEXT_HASHTEXT_CURRENT_CATEGORY_CATEGORY_REF =
            "text)),hashtext(CAST(? AS text)))), current_category AS MATERIALIZED (SELECT category_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_RECEIPT_LOCK_STATUS_VERSION_DATA_NODE_REF =
            "status,version FROM catalog.catalog_category CROSS JOIN receipt_lock WHERE data_node_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_BRAND_REF_CATEGORY_REF_STATUS_VOIDED =
            "brand_ref=? AND category_ref=? AND status <> 'VOIDED' FOR UPDATE), prior_receipt AS MATERIALIZED ";
    public static final String
            CATALOG_CATEGORY_SERVICE_OPEN_PAREN_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
                    "(SELECT operation_id,request_hash,response_json::text AS response FROM catalog.command_receipt CROSS ";
    public static final String
            CATALOG_CATEGORY_SERVICE_JOIN_RECEIPT_LOCK_DATA_NODE_REF_IDEMPOTENCY_KEY_UPDATED_CATEGORY =
                    "JOIN receipt_lock WHERE data_node_ref=? AND idempotency_key=?), updated_category AS (UPDATE ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_CATEGORY_NAME_VERSION =
            "catalog.catalog_category category SET name=?,version=category.version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_CURRENT_CATEGORY_CURRENT_CATEGORY_CATEGORY_REF =
            "FROM current_category current WHERE category.category_ref=current.category_ref AND ";
    public static final String CATALOG_CATEGORY_SERVICE_PRIOR_RECEIPT_CURRENT_VERSION_CATEGORY_CATEGORY_REF =
            "current.version=? AND NOT EXISTS (SELECT 1 FROM prior_receipt) RETURNING category.category_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_CODE_NAME_STATUS =
            "category.code,category.name,category.status,category.parent_category_ref,category.version,";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_DISPLAY_ORDER = "category.display_order), ";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATED_CATEGORY_CATEGORY_SUBTREE_CATEGORY_REF =
            "category_subtree(category_ref) AS (SELECT category_ref FROM updated_category UNION ALL SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_SUBTREE_CHILD_CATEGORY_REF_PARENT =
            "child.category_ref FROM catalog.catalog_category child JOIN category_subtree parent ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_A =
            "child.parent_category_ref=parent.category_ref WHERE child.data_node_ref=? AND child.brand_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_CHILD_STATUS_VOIDED_DELETION_AVAILABILITY =
            "AND child.status <> 'VOIDED'), deletion_availability AS (SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_CATEGORY_REF_SUBTREE_SIZE =
            "COUNT(DISTINCT subtree.category_ref) AS subtree_size,";
    public static final String CATALOG_CATEGORY_SERVICE_ITEM_ITEM_REF_BLOCKING_REFERENCE_COUNT =
            "COUNT(DISTINCT item.item_ref) AS blocking_reference_count,";
    public static final String CATALOG_CATEGORY_SERVICE_JSONB_AGG_JSONB_BUILD_OBJECT_REFERENCE_KIND =
            "COALESCE((SELECT jsonb_agg(jsonb_build_object('referenceKind',";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_REFERENCE_REF_REFS_ITEM_REF =
            "'CATALOG_ITEM','referenceRef',refs.item_ref,'code',refs.code,'name',refs.name,'direction',";
    public static final String CATALOG_CATEGORY_SERVICE_INBOUND_REFS_CODE_ITEM =
            "'INBOUND') ORDER BY refs.code) FROM (SELECT DISTINCT item.item_ref,item.code,item.name FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_CATEGORY =
            "category_subtree subtree_refs JOIN catalog.catalog_item_category relation_refs ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_RELATION_REFS_CATEGORY_REF_SUBTREE_REFS_ITEM =
            "relation_refs.category_ref=subtree_refs.category_ref JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_CATEGORY_SERVICE_ITEM_ITEM_REF_RELATION_REFS_DATA_NODE_REF =
            "item.item_ref=relation_refs.item_ref AND item.data_node_ref=? AND item.brand_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_SUBTREE_ITEM_STATUS_VOIDED_REFS =
            "item.status <> 'VOIDED') refs),'[]'::jsonb) AS blocking_reference_facts FROM category_subtree ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_CATEGORY_SUBTREE =
            "subtree LEFT JOIN catalog.catalog_item_category ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_RELATION_CATEGORY_REF_SUBTREE_ITEM =
            "relation ON relation.category_ref=subtree.category_ref LEFT JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_CATEGORY_SERVICE_ITEM_ITEM_REF_RELATION_DATA_NODE_REF =
            "item.item_ref=relation.item_ref AND item.data_node_ref=? AND item.brand_ref=? AND item.status <> ";
    public static final String CATALOG_CATEGORY_SERVICE_VOIDED_RESPONSE_JSONB_BUILD_OBJECT_CATEGORY_REF =
            "'VOIDED'), response AS (SELECT jsonb_build_object('categoryRef',category.category_ref,'code',";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_CODE_NAME_STATUS_ALTERNATE_A =
            "category.code,'name',category.name,'status',category.status,'parentCategoryRef',";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_PARENT_CATEGORY_REF_VERSION =
            "category.parent_category_ref,'version',";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_VERSION_DISPLAY_ORDER_DELETION_AVAILABILITY =
            "category.version,'displayOrder',category.display_order,'deletionAvailability',jsonb_build_object(";
    public static final String CATALOG_CATEGORY_SERVICE_CAN_DELETE_AVAILABILITY_BLOCKING_REFERENCE_COUNT_SUBTREE_SIZE =
            "'canDelete',availability.blocking_reference_count=0,'subtreeSize',availability.subtree_size,";
    public static final String CATALOG_CATEGORY_SERVICE_BLOCKING_REFERENCE_COUNT_AVAILABILITY_BLOCKING_REFERENCES =
            "'blockingReferenceCount',availability.blocking_reference_count,'blockingReferences',";
    public static final String CATALOG_CATEGORY_SERVICE_AVAILABILITY_BLOCKING_REFERENCE_FACTS_BODY =
            "availability.blocking_reference_facts)) AS body ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_UPDATED_CATEGORY_CATEGORY =
            "FROM updated_category category CROSS JOIN ";
    public static final String CATALOG_CATEGORY_SERVICE_COMMAND_RECEIPT =
            "deletion_availability availability), written_receipt AS (INSERT INTO catalog.command_receipt(";
    public static final String CATALOG_CATEGORY_SERVICE_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID =
            "receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response_json,";
    public static final String CATALOG_CATEGORY_SERVICE_CREATED_AT_EPOCH_MILLIS = "created_at_epoch_millis) ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_RESPONSE_BODY_TEXT =
            "SELECT ?,?,?,?,?,body,? FROM response RETURNING response_json::text AS response) SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_CATEGORY_CATEGORY_REF_VERSION_PRIOR_RECEIPT =
            "current_category.category_ref,current_category.version,prior_receipt.operation_id,";
    public static final String CATALOG_CATEGORY_SERVICE_PRIOR_RECEIPT_REQUEST_HASH_RESPONSE_REPLAY_RESPONSE =
            "prior_receipt.request_hash,prior_receipt.response AS replay_response,written_receipt.response AS ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_CATEGORY_WRITTEN_RESPONSE =
            "written_response FROM receipt_lock LEFT JOIN current_category ON TRUE ";
    public static final String CATALOG_CATEGORY_SERVICE_PRIOR_RECEIPT_LEFT_JOIN_PRIOR_RECEIPT_ON_T =
            "LEFT JOIN prior_receipt ON TRUE ";
    public static final String CATALOG_CATEGORY_SERVICE_WRITTEN_RECEIPT_LEFT_JOIN_WRITTEN_RECEIPT_ON =
            "LEFT JOIN written_receipt ON TRUE";
    public static final String CATALOG_CATEGORY_SERVICE_CTE_RECEIPT_LOCK_PG_ADVISORY_XACT_LOCK_HASHTEXT_ALTERNATE_A =
            "WITH RECURSIVE receipt_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(CAST(? AS ";
    public static final String CATALOG_CATEGORY_SERVICE_TEXT_HASHTEXT_HIERARCHY_LOCK =
            "text)),hashtext(CAST(? AS text)))), hierarchy_lock AS MATERIALIZED (SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT =
            "pg_advisory_xact_lock(hashtext(CAST(? AS text)),hashtext(CAST(? AS text)))), ";
    public static final String CATALOG_CATEGORY_SERVICE_LOCKED_CATEGORIES_CATEGORY_CATEGORY_REF_CODE =
            "locked_categories AS MATERIALIZED (SELECT category.category_ref,category.code,category.name,";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_PARENT_CATEGORY_REF_VERSION_DISPLAY_ORDER =
            "category.parent_category_ref,category.version,category.display_order FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_HIERARCHY_LOCK_CATALOG_CATEGORY_CATEGORY =
            "catalog.catalog_category category CROSS JOIN receipt_lock CROSS JOIN hierarchy_lock WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_DATA_NODE_REF_BRAND_REF_STATUS =
            "category.data_node_ref=? AND category.brand_ref=? AND category.status <> 'VOIDED' FOR UPDATE), ";
    public static final String CATALOG_CATEGORY_SERVICE_MOVE_INPUT_CATEGORY_REF_TEXT_ACTION =
            "move_input AS MATERIALIZED (SELECT ?::uuid AS category_ref,?::text AS action,";
    public static final String CATALOG_CATEGORY_SERVICE_PARAMETER_PLACEHOLDER_REQUESTED_PARENT_REF =
            "?::uuid AS requested_parent_ref,?::bigint AS expected_version,?::bigint AS updated_at), ";
    public static final String CATALOG_CATEGORY_SERVICE_LOCKED_CATEGORIES_CURRENT_CATEGORY_CATEGORY =
            "current_category AS MATERIALIZED (SELECT category.* FROM locked_categories category ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_MOVE_INPUT_INPUT_CATEGORY_REF_CATEGORY_PRIOR_RECEIPT =
            "JOIN move_input input ON input.category_ref=category.category_ref), prior_receipt AS MATERIALIZED ";
    public static final String
            CATALOG_CATEGORY_SERVICE_OPEN_PAREN_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT_ALTERNATE_A =
                    "(SELECT operation_id,request_hash,response_json::text AS response FROM catalog.command_receipt ";
    public static final String CATALOG_CATEGORY_SERVICE_RECEIPT_LOCK_DATA_NODE_REF_IDEMPOTENCY_KEY_REQUESTED_PARENT =
            "CROSS JOIN receipt_lock WHERE data_node_ref=? AND idempotency_key=?), requested_parent AS ";
    public static final String CATALOG_CATEGORY_SERVICE_MOVE_INPUT_CATEGORY_INPUT =
            "MATERIALIZED (SELECT category.* FROM locked_categories category JOIN move_input input ON ";
    public static final String CATALOG_CATEGORY_SERVICE_INPUT_REQUESTED_PARENT_REF_CATEGORY_CATEGORY_REF =
            "input.requested_parent_ref=category.category_ref), subtree(category_ref,depth) AS ";
    public static final String CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CURRENT_CATEGORY_CATEGORY_REF_CHILD =
            "(SELECT category_ref,1 FROM current_category UNION ALL SELECT child.category_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_DEPTH_CHILD =
            "subtree.depth+1 FROM locked_categories child JOIN subtree ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_PARENT_CATEGORY_REF_SUBTREE_CATEGORY_REF =
            "child.parent_category_ref=subtree.category_ref), parent_ancestors(category_ref,parent_category_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_REQUESTED_PARENT_DEPTH_CATEGORY_REF_PARENT_CATEGORY_REF =
            "depth) AS (SELECT category_ref,parent_category_ref,1 FROM requested_parent UNION ALL SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_PARENT_ANCESTORS =
            "parent.category_ref,parent.parent_category_ref,parent_ancestors.depth+1 FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_ANCESTORS_LOCKED_CATEGORIES_PARENT =
            "locked_categories parent JOIN parent_ancestors ON ";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_CATEGORY_REF_PARENT_ANCESTORS_PARENT_CATEGORY_REF =
            "parent.category_ref=parent_ancestors.parent_category_ref), siblings AS (SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_SIBLING_CATEGORY_REF_DISPLAY_ORDER_LAG =
            "sibling.category_ref,sibling.display_order,LAG(sibling.category_ref) OVER (ORDER BY ";
    public static final String CATALOG_CATEGORY_SERVICE_SIBLING_DISPLAY_ORDER_CODE_PREVIOUS_REF =
            "sibling.display_order,sibling.code) AS previous_ref,LAG(sibling.display_order) OVER (ORDER BY ";
    public static final String CATALOG_CATEGORY_SERVICE_SIBLING_DISPLAY_ORDER_CODE_PREVIOUS_DISPLAY_ORDER =
            "sibling.display_order,sibling.code) AS previous_display_order,LEAD(sibling.category_ref) OVER ";
    public static final String CATALOG_CATEGORY_SERVICE_OPEN_PAREN_SIBLING_DISPLAY_ORDER_CODE_NEXT_REF =
            "(ORDER BY sibling.display_order,sibling.code) AS next_ref,LEAD(sibling.display_order) OVER ";
    public static final String
            CATALOG_CATEGORY_SERVICE_OPEN_PAREN_LOCKED_CATEGORIES_SIBLING_DISPLAY_ORDER_CODE_NEXT_DISPLAY_ORDER =
                    "(ORDER BY sibling.display_order,sibling.code) AS next_display_order FROM locked_categories sibling ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_CATEGORY_CURRENT_SIBLING_PARENT_CATEGORY_REF =
            "CROSS JOIN current_category current WHERE sibling.parent_category_ref IS NOT DISTINCT FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_SIBLINGS_CURRENT_PARENT_CATEGORY_REF_CURRENT_SIBLING_SIBLING =
            "current.parent_category_ref), current_sibling AS MATERIALIZED (SELECT sibling.* FROM siblings ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_CATEGORY_SIBLING_CURRENT_CATEGORY_REF_MOVE_PLAN =
            "sibling JOIN current_category current ON sibling.category_ref=current.category_ref), move_plan AS ";
    public static final String CATALOG_CATEGORY_SERVICE_INPUT_ACTION_REQUESTED_PARENT_REF_EXPECTED_VERSION =
            "MATERIALIZED (SELECT input.action,input.requested_parent_ref,input.expected_version,";
    public static final String CATALOG_CATEGORY_SERVICE_INPUT_UPDATED_AT = "input.updated_at,";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_CATEGORY_REF_CURRENT_CATEGORY_REF_VERSION =
            "current.category_ref AS current_category_ref,current.version AS current_version,";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_DISPLAY_ORDER_CURRENT_DISPLAY_ORDER_CURRENT_SIBLING =
            "current.display_order AS current_display_order,current_sibling.previous_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_SIBLING_PREVIOUS_DISPLAY_ORDER_NEXT_REF =
            "current_sibling.previous_display_order,current_sibling.next_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_PARENT_ANCESTORS_CURRENT_SIBLING_NEXT_DISPLAY_ORDER_DEPTH =
            "current_sibling.next_display_order,COALESCE((SELECT MAX(depth) FROM parent_ancestors),0) ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_TARGET_DEPTH_DEPTH_SUBTREE_DEPTH =
            "AS target_depth,COALESCE((SELECT MAX(depth) FROM subtree),0) AS subtree_depth,";
    public static final String CATALOG_CATEGORY_SERVICE_LOCKED_CATEGORIES_CATEGORY_DISPLAY_ORDER =
            "COALESCE((SELECT MAX(category.display_order) FROM locked_categories category WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_REQUESTED_PARENT_REF_CATEGORY_PARENT_CATEGORY_REF =
            "category.parent_category_ref IS NOT DISTINCT FROM input.requested_parent_ref),-1)+1 ";
    public static final String CATALOG_CATEGORY_SERVICE_REPARENT_DISPLAY_ORDER_CURRENT_CATEGORY_REF_NOT_FOUND =
            "AS reparent_display_order,CASE WHEN current.category_ref IS NULL THEN 'NOT_FOUND' WHEN ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_VERSION_INPUT_EXPECTED_VERSION =
            "current.version <> input.expected_version AND current.version <> input.expected_version+1 THEN ";
    public static final String CATALOG_CATEGORY_SERVICE_VERSION_CONFLICT_INPUT_ACTION_REPARENT =
            "'VERSION_CONFLICT' WHEN input.action NOT IN ('REPARENT','UP','DOWN') THEN 'VALIDATION_ERROR' ";
    public static final String CATALOG_CATEGORY_SERVICE_WHEN_INPUT_ACTION_REPARENT_REQUESTED_PARENT_REF =
            "WHEN input.action='REPARENT' AND input.requested_parent_ref IS NOT NULL AND ";
    public static final String CATALOG_CATEGORY_SERVICE_REQUESTED_PARENT_CATEGORY_REF_NOT_FOUND_INPUT =
            "requested_parent.category_ref IS NULL THEN 'NOT_FOUND' WHEN input.action='REPARENT' AND ";
    public static final String CATALOG_CATEGORY_SERVICE_INPUT_REQUESTED_PARENT_REF_CURRENT_CATEGORY_REF =
            "input.requested_parent_ref=current.category_ref THEN 'HIERARCHY_SELF' WHEN input.action='REPARENT' ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_SUBTREE_CATEGORY_REF_INPUT_REQUESTED_PARENT_REF =
            "AND EXISTS (SELECT 1 FROM subtree WHERE category_ref=input.requested_parent_ref) THEN ";
    public static final String CATALOG_CATEGORY_SERVICE_HIERARCHY_CYCLE_INPUT_ACTION_REPARENT =
            "'HIERARCHY_CYCLE' WHEN input.action='REPARENT' AND ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_DEPTH_ALTERNATE_A =
            "COALESCE((SELECT MAX(depth) FROM parent_ancestors),0)+COALESCE((SELECT MAX(depth) FROM subtree),0)>";
    public static final String CATALOG_CATEGORY_SERVICE_THEN_CATEGORY_DEPTH_EXCEEDED_INPUT_ACTION_CURRENT_SIBLING =
            " THEN 'CATEGORY_DEPTH_EXCEEDED' WHEN input.action='UP' AND current_sibling.previous_ref IS NULL ";
    public static final String CATALOG_CATEGORY_SERVICE_THEN_MOVE_BOUNDARY_INPUT_ACTION_DOWN =
            "THEN 'MOVE_BOUNDARY' WHEN input.action='DOWN' AND current_sibling.next_ref IS NULL THEN ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_CATEGORY_MOVE_BOUNDARY_VALIDATION_CODE_INPUT_CURRENT =
            "'MOVE_BOUNDARY' END AS validation_code FROM move_input input LEFT JOIN current_category current ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CURRENT_SIBLING_UPDATED_CATEGORIES =
            "TRUE LEFT JOIN requested_parent ON TRUE LEFT JOIN current_sibling ON TRUE), updated_categories AS ";
    public static final String
            CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CATALOG_CATEGORY_CATEGORY_PARENT_CATEGORY_REF_PLAN_ACTION =
                    "(UPDATE catalog.catalog_category category SET parent_category_ref=CASE WHEN plan.action='REPARENT' ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF =
            "AND category.category_ref=plan.current_category_ref THEN plan.requested_parent_ref ELSE ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_PARENT_CATEGORY_REF_DISPLAY_ORDER_PLAN =
            "category.parent_category_ref END,display_order=CASE WHEN plan.action='REPARENT' AND ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF =
            "category.category_ref=plan.current_category_ref THEN plan.reparent_display_order WHEN ";
    public static final String CATALOG_CATEGORY_SERVICE_PLAN_ACTION_CATEGORY_CATEGORY_REF =
            "plan.action='UP' AND category.category_ref=plan.current_category_ref THEN ";
    public static final String CATALOG_CATEGORY_SERVICE_PLAN_PREVIOUS_DISPLAY_ORDER_ACTION_CATEGORY =
            "plan.previous_display_order WHEN plan.action='UP' AND category.category_ref=plan.previous_ref THEN ";
    public static final String CATALOG_CATEGORY_SERVICE_PLAN_CURRENT_DISPLAY_ORDER_ACTION_DOWN =
            "plan.current_display_order WHEN plan.action='DOWN' AND ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF_ALTERNATE_A =
            "category.category_ref=plan.current_category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_THEN_PLAN_NEXT_DISPLAY_ORDER_ACTION_DOWN =
            "THEN plan.next_display_order WHEN plan.action='DOWN' AND category.category_ref=plan.next_ref THEN ";
    public static final String CATALOG_CATEGORY_SERVICE_PLAN_CURRENT_DISPLAY_ORDER_CATEGORY_DISPLAY_ORDER =
            "plan.current_display_order ELSE category.display_order END,version=category.version+1,";
    public static final String
            CATALOG_CATEGORY_SERVICE_UPDATE_MOVE_PLAN_UPDATED_AT_EPOCH_MILLIS_PLAN_UPDATED_AT_VALIDATION_CODE =
                    "updated_at_epoch_millis=plan.updated_at FROM move_plan plan WHERE plan.validation_code IS NULL ";
    public static final String
            CATALOG_CATEGORY_SERVICE_CONDITION_PRIOR_RECEIPT_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF =
                    "AND NOT EXISTS (SELECT 1 FROM prior_receipt) AND (category.category_ref=plan.current_category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_ALTERNATIVE_CATEGORY_CATEGORY_REF_PLAN_PREVIOUS_REF =
            "OR category.category_ref=plan.previous_ref OR category.category_ref=plan.next_ref) RETURNING ";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_CATEGORY_REF_CODE_NAME =
            "category.category_ref,category.code,category.name,category.status,category.parent_category_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATED_CATEGORIES =
            "category.version,category.display_order), updated_current AS MATERIALIZED (SELECT category.* FROM updated_categories ";
    public static final String CATALOG_CATEGORY_SERVICE_EMPTY_LITERAL = "";
    public static final String CATALOG_CATEGORY_SERVICE_MOVE_PLAN_CATEGORY_PLAN_CATEGORY_REF_CURRENT_CATEGORY_REF =
            "category JOIN move_plan plan ON category.category_ref=plan.current_category_ref), ";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATED_CURRENT_READBACK_SUBTREE_CATEGORY_REF =
            "readback_subtree(category_ref) AS (SELECT category_ref FROM updated_current UNION ALL SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_READBACK_SUBTREE_CHILD_CATEGORY_REF_PARENT =
            "child.category_ref FROM locked_categories child JOIN readback_subtree parent ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_B =
            "child.parent_category_ref=parent.category_ref), deletion_availability AS (SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_CATEGORY_REF_SUBTREE_SIZE_ITEM =
            "COUNT(DISTINCT subtree.category_ref) AS subtree_size,COUNT(DISTINCT item.item_ref) AS ";
    public static final String CATALOG_CATEGORY_SERVICE_BLOCKING_REFERENCE_COUNT =
            "blocking_reference_count,COALESCE((SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_JSONB_AGG_JSONB_BUILD_OBJECT_REFERENCE_KIND_CATALOG_ITEM =
            "jsonb_agg(jsonb_build_object('referenceKind','CATALOG_ITEM','referenceRef',refs.item_ref,";
    public static final String CATALOG_CATEGORY_SERVICE_CODE_REFS_NAME_DIRECTION =
            "'code',refs.code,'name',refs.name,'direction','INBOUND') ORDER BY refs.code) FROM (SELECT DISTINCT ";
    public static final String CATALOG_CATEGORY_SERVICE_READBACK_SUBTREE_ITEM_ITEM_REF_CODE_NAME =
            "item.item_ref,item.code,item.name FROM readback_subtree subtree_refs JOIN ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_CATEGORY_RELATION_REFS_CATEGORY_REF_SUBTREE_REFS =
            "catalog.catalog_item_category relation_refs ON relation_refs.category_ref=subtree_refs.category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_RELATION_REFS_DATA_NODE_REF =
            "JOIN catalog.catalog_item item ON item.item_ref=relation_refs.item_ref AND item.data_node_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_ITEM_BRAND_REF_STATUS_VOIDED =
            "AND item.brand_ref=? AND item.status <> 'VOIDED') refs),'[]'::jsonb) AS blocking_reference_facts ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_READBACK_SUBTREE_SUBTREE =
            "FROM readback_subtree subtree ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_CATEGORY_RELATION_CATEGORY_REF_SUBTREE =
            "LEFT JOIN catalog.catalog_item_category relation ON relation.category_ref=subtree.category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_ITEM_ITEM_REF_RELATION_DATA_NODE_REF =
            "LEFT JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref AND item.data_node_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_ITEM_BRAND_REF_STATUS_VOIDED_ALTERNATE_A =
            "AND item.brand_ref=? AND item.status <> 'VOIDED'), response AS (SELECT jsonb_build_object(";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_REF_CATEGORY_CODE_NAME =
            "'categoryRef',category.category_ref,'code',category.code,'name',category.name,'status',";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_STATUS_PARENT_CATEGORY_REF_VERSION =
            "category.status,'parentCategoryRef',category.parent_category_ref,'version',category.version,";
    public static final String CATALOG_CATEGORY_SERVICE_DISPLAY_ORDER = "'displayOrder',";
    public static final String CATALOG_CATEGORY_SERVICE_CATEGORY_DISPLAY_ORDER_ALTERNATE_A = "category.display_order,";
    public static final String CATALOG_CATEGORY_SERVICE_DELETION_AVAILABILITY =
            "'deletionAvailability',jsonb_build_object('canDelete',availability.blocking_reference_count=0,";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_SIZE_AVAILABILITY_BLOCKING_REFERENCE_COUNT =
            "'subtreeSize',availability.subtree_size,'blockingReferenceCount',";
    public static final String CATALOG_CATEGORY_SERVICE_AVAILABILITY_BLOCKING_REFERENCE_COUNT_BLOCKING_REFERENCES =
            "availability.blocking_reference_count,'blockingReferences',";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATED_CURRENT_AVAILABILITY_BLOCKING_REFERENCE_FACTS_BODY =
            "availability.blocking_reference_facts)) AS body FROM updated_current ";
    public static final String CATALOG_CATEGORY_SERVICE_DELETION_AVAILABILITY_CATEGORY_AVAILABILITY_WRITTEN_RECEIPT =
            "category CROSS JOIN deletion_availability availability), written_receipt AS (INSERT INTO ";
    public static final String CATALOG_CATEGORY_SERVICE_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY =
            "catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,";
    public static final String CATALOG_CATEGORY_SERVICE_RESPONSE_REQUEST_HASH_CREATED_AT_EPOCH_MILLIS_BODY =
            "request_hash,response_json,created_at_epoch_millis) SELECT ?,?,?,?,?,body,? FROM response ";
    public static final String CATALOG_CATEGORY_SERVICE_RETURNING_RESPONSE_TEXT =
            "RETURNING response_json::text AS response) ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_PLAN_VALIDATION_CODE_CURRENT_CATEGORY_CATEGORY_REF =
            "SELECT plan.validation_code,current_category.category_ref,current_category.version,";
    public static final String CATALOG_CATEGORY_SERVICE_PRIOR_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE =
            "prior_receipt.operation_id,prior_receipt.request_hash,prior_receipt.response AS replay_response,";
    public static final String CATALOG_CATEGORY_SERVICE_MOVE_PLAN_WRITTEN_RECEIPT_RESPONSE_WRITTEN_RESPONSE_PLAN =
            "written_receipt.response AS written_response FROM receipt_lock LEFT JOIN move_plan plan ON TRUE ";
    public static final String CATALOG_CATEGORY_SERVICE_PRIOR_RECEIPT_LEFT_JOIN_CURRENT_CATEGORY_O =
            "LEFT JOIN current_category ON TRUE LEFT JOIN prior_receipt ON TRUE ";
    public static final String CATALOG_CATEGORY_SERVICE_WRITTEN_RECEIPT_LEFT_JOIN_WRITTEN_RECEIPT_ON_ALTERNATE_A =
            "LEFT JOIN written_receipt ON TRUE";
    public static final String CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS =
            "UPDATE catalog.catalog_category SET status=?,version=version+1,updated_at_epoch_millis=? ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF =
            "WHERE data_node_ref=? AND brand_ref=? AND category_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_VERSION_STATUS_VOIDED =
            "AND version=? AND status <> 'VOIDED'";
    public static final String
            CATALOG_CATEGORY_SERVICE_CTE_ANCESTORS_CATEGORY_REF_PARENT_CATEGORY_REF_DEPTH_ALTERNATE_A =
                    "WITH RECURSIVE ancestors(category_ref,parent_category_ref,depth) AS (";
    public static final String
            CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_A =
                    "SELECT category_ref,parent_category_ref,1 FROM catalog.catalog_category ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF_ALTERNATE_A = "WHERE data_node_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_BRAND_REF_CATEGORY_REF_STATUS_VOIDED_ALTERNATE_A =
            "AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL ";
    public static final String
            CATALOG_CATEGORY_SERVICE_SELECT_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ANCESTORS_ALTERNATE_A =
                    "SELECT parent.category_ref,parent.parent_category_ref,ancestors.depth+1 ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_PARENT =
            "FROM catalog.catalog_category parent ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_ANCESTORS_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF =
            "JOIN ancestors ON parent.category_ref=ancestors.parent_category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_PARENT_DATA_NODE_REF_BRAND_REF_STATUS =
            "WHERE parent.data_node_ref=? AND parent.brand_ref=? AND parent.status <> 'VOIDED') ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_ANCESTORS_DEPTH =
            "SELECT COALESCE(MAX(depth),0) FROM ancestors";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_B =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String
            CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_A =
                    "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_STATUS_VOIDED = "status <> 'VOIDED'";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_C =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String
            CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_B =
                    "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_STATUS_VOIDED_ALTERNATE_A = "status <> 'VOIDED' FOR UPDATE";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_D =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String
            CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_C =
                    "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=?";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_E =
            "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF =
            "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_CATEGORY_REF = "AND category_ref=? FOR UPDATE";
    public static final String CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_ALTERNATE_A =
            "WITH RECURSIVE subtree(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_CHILD =
            "data_node_ref=? AND brand_ref=? AND category_ref=? UNION ALL SELECT child.category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_SUBTREE_CHILD_PARENT =
            "FROM catalog.catalog_category child JOIN subtree parent ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_CONDITION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF =
            "ON child.parent_category_ref=parent.category_ref ";
    public static final String CATALOG_CATEGORY_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_ALTERNATE_B =
            "WHERE child.data_node_ref=? AND child.brand_ref=?) ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_SUBTREE_CATEGORY_REF =
            "SELECT category_ref FROM subtree ORDER BY category_ref";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_ITEM_CATEGORY_ITEM_CODE_RELATION =
            "SELECT DISTINCT item.code FROM catalog.catalog_item_category relation ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_CATALOG_ITEM_ITEM = "JOIN catalog.catalog_item item ";
    public static final String CATALOG_CATEGORY_SERVICE_JOIN_CONDITION_ITEM_ITEM_REF_RELATION_DATA_NODE_REF =
            "ON item.item_ref=relation.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_ITEM_STATUS_VOIDED_RELATION =
            "item.status <> 'VOIDED' AND relation.category_ref IN (";
    public static final String CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_ALTERNATE_B =
            "WITH RECURSIVE subtree(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE ";
    public static final String CATALOG_CATEGORY_SERVICE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS_ALTERNATE_B =
            "data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL SELECT ";
    public static final String CATALOG_CATEGORY_SERVICE_SUBTREE_CHILD_CATEGORY_REF_PARENT_ALTERNATE_A =
            "child.category_ref FROM catalog.catalog_category child JOIN subtree parent ON ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_C =
            "child.parent_category_ref=parent.category_ref WHERE child.data_node_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_CHILD_BRAND_REF_STATUS_VOIDED =
            "child.brand_ref=? AND child.status <> 'VOIDED') ";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_SUBTREE_ITEM_ITEM_REF_CODE_NAME =
            "SELECT (SELECT COUNT(*) FROM subtree), item.item_ref, item.code, item.name ";
    public static final String CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_ANCHOR = "FROM (SELECT 1) anchor LEFT JOIN ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_CATEGORY_RELATION_CATEGORY_REF =
            "catalog.catalog_item_category relation ON relation.category_ref IN ";
    public static final String CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CATEGORY_REF = "(SELECT category_ref FROM ";
    public static final String CATALOG_CATEGORY_SERVICE_CATALOG_ITEM_SUBTREE_ITEM_ITEM_REF_RELATION =
            "subtree) LEFT JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref AND ";
    public static final String CATALOG_CATEGORY_SERVICE_ITEM_DATA_NODE_REF_BRAND_REF_STATUS =
            "item.data_node_ref=? AND item.brand_ref=? AND item.status <> 'VOIDED' ORDER BY item.code";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_DISPLAY_ORDER_DATA_NODE_REF =
            "SELECT COALESCE(MAX(display_order), -1) + 1 FROM catalog.catalog_category WHERE data_node_ref=? AND ";
    public static final String CATALOG_CATEGORY_SERVICE_BRAND_REF_PARENT_CATEGORY_REF_STATUS_VOIDED =
            "brand_ref=? AND parent_category_ref IS NOT DISTINCT FROM ? AND status <> 'VOIDED'";
    public static final String CATALOG_CATEGORY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT =
            "SELECT operation_id,request_hash,response_json::text FROM catalog.command_receipt WHERE data_node_ref=? ";
    public static final String CATALOG_CATEGORY_SERVICE_CONDITION_IDEMPOTENCY_KEY = "AND idempotency_key=?";
    public static final String CATALOG_CATEGORY_SERVICE_INSERT_INTO_COMMAND_RECEIPT =
            "INSERT INTO catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,";
    public static final String CATALOG_CATEGORY_SERVICE_RESPONSE_CREATED_AT_EPOCH_MILLIS =
            "response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)";
    public static final String CATALOG_CATEGORY_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CATEGORY_REF =
            ") AND status <> 'VOIDED' ORDER BY category_ref FOR UPDATE";
    public static final String CATALOG_CATEGORY_SERVICE_CLOSE_PAREN_ITEM_CODE = ") ORDER BY item.code";
    public static final String
            CATALOG_CATEGORY_SERVICE_CATEGORY_REF_DATA_NODE_REF_BRAND_REF_CODE_NAME_PARENT_CATEGORY_REF_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_VALUES =
                    """
    (category_ref,data_node_ref,brand_ref,code,name,parent_category_ref,display_order,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?)""";
}
