package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogWorkbenchReadService; B3 relocates text only and does not change execution. */
public final class CatalogWorkbenchReadServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_ITEM_REF_NAME_SKU =
            "SELECT item.item_ref,item.name,sku.sku_name,item.sections->>'materialRole',category.name ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM =
            "FROM catalog.catalog_item item ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_LATERAL_CATALOG_SKU_SKU_NAME =
            "LEFT JOIN LATERAL (SELECT catalog_sku.sku_name ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_SKU_FROM_CATALOG_CATALOG_SKU =
            "FROM catalog.catalog_sku ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_CATALOG_SKU_ITEM_REF_ITEM_STATUS =
            "WHERE catalog_sku.item_ref=item.item_ref AND catalog_sku.status <> 'VOIDED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_CATALOG_SKU_IS_DEFAULT_DISPLAY_ORDER_SKU_CODE =
            "ORDER BY catalog_sku.is_default DESC,catalog_sku.display_order,catalog_sku.sku_code ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_LIMIT_SKU = "LIMIT 1) sku ON TRUE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_LATERAL_CATALOG_CATEGORY_NAME =
            "LEFT JOIN LATERAL (SELECT catalog_category.name ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_CATEGORY_RELATION =
            "FROM catalog.catalog_item_category relation ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_CATEGORY_JOIN_CATALOG_CATALOG_CATEGOR =
            "JOIN catalog.catalog_category ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATALOG_CATEGORY_CATEGORY_REF_RELATION =
            "ON catalog_category.category_ref=relation.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_ITEM =
            "WHERE relation.item_ref=item.item_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_CATEGORY_DATA_NODE_REF_ITEM =
            "AND catalog_category.data_node_ref=item.data_node_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_CATEGORY_BRAND_REF_ITEM =
            "AND catalog_category.brand_ref=item.brand_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_CATEGORY_STATUS_VOIDED =
            "AND catalog_category.status <> 'VOIDED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_RELATION_CATEGORY_REF =
            "ORDER BY relation.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_LIMIT_CATEGORY = "LIMIT 1) category ON TRUE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF =
            "WHERE item.data_node_ref=? AND item.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_ITEM_REF = "AND item.item_ref IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATALOG_ITEM_ITEM_ITEM_REF_NAME_SHAPE_KEY =
            "SELECT item.item_ref,item.name,item.shape_key,sku.sku_name FROM catalog.catalog_item item ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_SKU_SKU_NAME =
            "LEFT JOIN LATERAL (SELECT catalog_sku.sku_name FROM catalog.catalog_sku WHERE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_SKU_ITEM_REF_ITEM_STATUS =
            "catalog_sku.item_ref=item.item_ref AND catalog_sku.status <> 'VOIDED' AND ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PARAMETER_PLACEHOLDER_CATALOG_SKU_PRODUCT_SKU_REF =
            "?::uuid IS NOT NULL AND catalog_sku.product_sku_ref=? ORDER BY catalog_sku.product_sku_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_LIMIT_SKU_ITEM_DATA_NODE_REF_BRAND_REF =
            "LIMIT 1) sku ON TRUE WHERE item.data_node_ref=? AND item.brand_ref=? AND item.item_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED =
            "AND item.status <> 'VOIDED'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHAPE_KEY =
            "SELECT i.item_ref,i.code,i.name,i.shape_key,i.status,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_NULLIF_SECTIONS_STANDARD_SALE_PRICE_BIGINT =
            "NULLIF(i.sections->>'standardSalePrice','')::bigint AS default_price,i.version ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF =
            "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_VOIDED = "AND i.status <> 'VOIDED'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CODE_ILIKE_NAME =
            " AND (i.code ILIKE ? OR i.name ILIKE ?)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_CATEGORY_RELATION =
            " AND EXISTS (SELECT 1 FROM catalog.catalog_item_category relation ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_CATEGORY_CATEGORY_CATEGORY_REF_RELATION =
            "JOIN catalog.catalog_category category ON category.category_ref=relation.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_CATEGORY_REF =
            "WHERE relation.item_ref=i.item_ref AND relation.category_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_DATA_NODE_REF_BRAND_REF =
            "AND category.data_node_ref=i.data_node_ref AND category.brand_ref=i.brand_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_STATUS_VOIDED =
            "AND category.status <> 'VOIDED')";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CODE_ITEM_REF =
            " AND (i.code > ? OR (i.code = ? AND i.item_ref > ?))";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_CODE_ITEM_REF =
            " ORDER BY i.code,i.item_ref LIMIT ?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHAPE_KEY_ALTERNATE_A =
            "SELECT i.item_ref,i.code,i.name,i.shape_key,i.status,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_NULLIF_SECTIONS_STANDARD_SALE_PRICE_BIGINT_ALTERNATE_A =
            "NULLIF(i.sections->>'standardSalePrice','')::bigint AS default_price,i.version ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_ALTERNATE_A =
                    "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_REF = "AND i.item_ref IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CTE_VISIBLE_CATEGORIES_CATEGORY_REF_CODE_NAME =
            "WITH RECURSIVE visible_categories AS MATERIALIZED (SELECT category_ref,code,name,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_CATEGORY =
            "parent_category_ref,version,display_order FROM catalog.catalog_category WHERE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_DATA_NODE_REF_BRAND_REF_STATUS_VOIDED =
            "data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'), category_order(category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_ORDER_PATH_CATEGORY_CATEGORY_REF_LPAD =
            "order_path) AS (SELECT category.category_ref,ARRAY[LPAD(category.display_order::text,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VISIBLE_CATEGORIES_CATEGORY_CODE_TEXT =
            "10,'0') || ':' || category.code]::text[] FROM visible_categories category WHERE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VISIBLE_CATEGORIES_CATEGORY_PARENT_CATEGORY_REF =
            "category.parent_category_ref IS NULL OR NOT EXISTS (SELECT 1 FROM visible_categories ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PARENT_CATEGORY_REF_CATEGORY_PARENT_CATEGORY_REF =
            "parent WHERE parent.category_ref=category.parent_category_ref) UNION ALL SELECT ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CHILD_CATEGORY_REF_ARRAY_APPEND_PARENT =
            "child.category_ref,array_append(parent.order_path,LPAD(child.display_order::text,10,'0') ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VISIBLE_CATEGORIES_CHILD_CODE_PARENT =
            "|| ':' || child.code) FROM category_order parent JOIN visible_categories child ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF =
            "child.parent_category_ref=parent.category_ref), category_subtree(root_category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VISIBLE_CATEGORIES_CATEGORY_REF =
            "category_ref) AS (SELECT category_ref,category_ref FROM visible_categories UNION SELECT ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_SUBTREE =
            "subtree.root_category_ref,child.category_ref FROM category_subtree subtree JOIN ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VISIBLE_CATEGORIES_CHILD_PARENT_CATEGORY_REF_SUBTREE =
            "visible_categories child ON child.parent_category_ref=subtree.category_ref), direct_counts ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_RELATION_CATEGORY_REF =
            "AS (SELECT relation.category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ITEM_ITEM_REF_DIRECT_COUNT =
            "COUNT(DISTINCT item.item_ref) AS direct_count ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_RELATION_ITEM =
            "FROM catalog.catalog_item_category relation JOIN catalog.catalog_item item ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ITEM_ITEM_REF_RELATION =
            "item.item_ref=relation.item_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF_STATUS =
            "WHERE item.data_node_ref=? AND item.brand_ref=? AND item.status <> 'VOIDED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_RELATION_CATEGORY_REF =
            "GROUP BY relation.category_ref), ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_ITEMS_SUBTREE_ROOT_CATEGORY_REF_ITEM =
            "blocking_items AS (SELECT DISTINCT subtree.root_category_ref,item.item_ref,item.code,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ITEM_NAME = "item.name ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_CATEGORY_SUBTREE_RELATION =
            "FROM category_subtree subtree JOIN catalog.catalog_item_category relation ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATALOG_ITEM_RELATION_CATEGORY_REF_SUBTREE_ITEM =
                    "ON relation.category_ref=subtree.category_ref JOIN catalog.catalog_item item ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_ITEM_ITEM_REF_RELATION_DATA_NODE_REF =
            "ON item.item_ref=relation.item_ref AND item.data_node_ref=? AND item.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED_SUBTREE_SIZES =
            "AND item.status <> 'VOIDED'), subtree_sizes AS (SELECT root_category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_SUBTREE_CATEGORY_REF_SUBTREE_SIZE =
            "COUNT(DISTINCT category_ref) AS subtree_size FROM category_subtree ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_ROOT_CATEGORY_REF_SUBTREE_COUNTS =
            "GROUP BY root_category_ref), subtree_counts AS (SELECT root_category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_ITEMS_ITEM_REF_SUBTREE_COUNT_ROOT_CATEGORY_REF =
            "COUNT(DISTINCT item_ref) AS subtree_count FROM blocking_items GROUP BY root_category_ref), ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_STATS_ROOT_CATEGORY_REF =
            "blocking_stats AS (SELECT root_category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ITEM_REF_BLOCKING_REFERENCE_COUNT =
            "COUNT(DISTINCT item_ref) AS blocking_reference_count,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JSONB_AGG_JSONB_BUILD_OBJECT_REFERENCE_KIND_CATALOG_ITEM =
            "COALESCE(jsonb_agg(jsonb_build_object('referenceKind','CATALOG_ITEM','referenceRef',";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ITEM_REF_CODE_NAME_DIRECTION =
            "item_ref,'code',code,'name',name,'direction','INBOUND') ORDER BY code),";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_ITEMS_BLOCKING_REFERENCE_FACTS =
            "'[]'::jsonb) AS blocking_reference_facts FROM blocking_items ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_ROOT_CATEGORY_REF =
            "GROUP BY root_category_ref) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CATEGORY_REF =
            "SELECT c.category_ref,c.code,c.name,c.parent_category_ref,c.version,c.display_order,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_DIRECT_COUNTS_DIRECT_COUNT_SUBTREE_COUNTS_SUBTREE_COUNT =
            "COALESCE(direct_counts.direct_count,0),COALESCE(subtree_counts.subtree_count,0),";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SUBTREE_SIZES_SUBTREE_SIZE =
            "COALESCE(subtree_sizes.subtree_size,1),";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_STATS_BLOCKING_REFERENCE_COUNT =
            "COALESCE(blocking_stats.blocking_reference_count,0),";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_STATS_BLOCKING_REFERENCE_FACTS =
            "COALESCE(blocking_stats.blocking_reference_facts,'[]'::jsonb) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_ORDER_ORDERED =
            "FROM visible_categories c LEFT JOIN category_order ordered ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_DIRECT_COUNTS_ORDERED_CATEGORY_REF =
            "ordered.category_ref=c.category_ref LEFT JOIN direct_counts ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_DIRECT_COUNTS_CATEGORY_REF =
            "direct_counts.category_ref=c.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SUBTREE_COUNTS_ROOT_CATEGORY_REF_CATEGORY_REF =
            "LEFT JOIN subtree_counts ON subtree_counts.root_category_ref=c.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SUBTREE_SIZES_ROOT_CATEGORY_REF_CATEGORY_REF =
            "LEFT JOIN subtree_sizes ON subtree_sizes.root_category_ref=c.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BLOCKING_STATS_ROOT_CATEGORY_REF_CATEGORY_REF =
            "LEFT JOIN blocking_stats ON blocking_stats.root_category_ref=c.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_ORDERED_ORDER_PATH_PARENT_CATEGORY_REF =
            "ORDER BY ordered.order_path NULLS LAST,c.parent_category_ref NULLS FIRST,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_DISPLAY_ORDER_CODE = "c.display_order,c.code";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_ENTRY_ENTRY_REF_CODE_NAME =
            "SELECT entry.entry_ref, entry.code, entry.name, COUNT(DISTINCT item.item_ref) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_DICTIONARY_ENTRY_ENTRY =
            "FROM catalog.dictionary_entry entry ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_ITEM_REFERENCE_RELATION_REF_ENTRY_ENTRY_REF =
            "LEFT JOIN catalog.catalog_item_reference relation ON relation.ref=entry.entry_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_RELATION_KIND = "AND relation.kind=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_ITEM_ITEM_ITEM_REF_RELATION =
            "LEFT JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_DATA_NODE_REF_ENTRY_BRAND_REF =
            "AND item.data_node_ref=entry.data_node_ref AND item.brand_ref=entry.brand_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED_ALTERNATE_A =
            "AND item.status <> 'VOIDED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_ENTRY_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND =
            "WHERE entry.data_node_ref=? AND entry.brand_ref=? AND entry.dictionary_kind='TAG' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ENTRY_STATUS_ENABLED =
            "AND entry.status='ENABLED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_ENTRY_ENTRY_REF_CODE_NAME =
            "GROUP BY entry.entry_ref, entry.code, entry.name, entry.display_order ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_ENTRY_DISPLAY_ORDER_CODE_NAME =
            "ORDER BY entry.display_order, entry.code, entry.name";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_SHAPE_KEY_VERSION =
            "SELECT shape_key, COUNT(*), COALESCE(MAX(version),0), ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FILTER = "COUNT(*) FILTER (WHERE ";

    public static final String CATALOG_WORKBENCH_READ_SERVICE_FILTER_STATUS_DISABLED =
            "COUNT(*) FILTER (WHERE status='DISABLED'), ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FILTER_UPDATED_AT_EPOCH_MILLIS =
            "COUNT(*) FILTER (WHERE updated_at_epoch_millis >= ?), ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FILTER_ALTERNATE_A = "COUNT(*) FILTER (WHERE ";

    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_ITEM_CATEGORY_RELATION_ITEM_REF_CATALOG_ITEM =
            "catalog.catalog_item_category relation WHERE relation.item_ref=catalog_item.item_ref)) ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_STATUS_VOIDED =
                    "FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_SHAPE_KEY = "GROUP BY shape_key";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_RELATION_REF_ITEM_REF =
            "SELECT relation.ref, COUNT(DISTINCT relation.item_ref) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_REFERENCE_RELATION =
            "FROM catalog.catalog_item_reference relation ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_RELATION =
            "JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_KIND_ITEM_DATA_NODE_REF =
            "WHERE relation.kind=? AND item.data_node_ref=? AND item.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED_RELATION =
            "AND item.status <> 'VOIDED' AND relation.ref IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN = ") ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_RELATION_REF = "GROUP BY relation.ref";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CTE_CATEGORY_TREE = "WITH RECURSIVE category_tree AS (";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CATEGORY_REF_ALTERNATE_A =
                    "SELECT c.category_ref,c.code,c.name,c.parent_category_ref,c.display_order,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_REF_PATH_REFS =
            "ARRAY[c.category_ref]::uuid[] AS path_refs,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_TEXT =
            "jsonb_build_array(jsonb_build_object('categoryRef',c.category_ref::text,'code',c.code,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_NAME_PATH_JSON = "'name',c.name)) AS path_json ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF =
            "FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_PARENT_CATEGORY_REF =
            "AND c.status = 'ENABLED' AND c.parent_category_ref IS NULL ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNION_UNION_ALL = "UNION ALL ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_CHILD_CATEGORY_REF_CODE_NAME =
            "SELECT child.category_ref,child.code,child.name,child.parent_category_ref,child.display_order,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PARENT_PATH_REFS_CHILD_CATEGORY_REF =
            "parent.path_refs || child.category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PARENT_PATH_JSON_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT =
            "parent.path_json || jsonb_build_array(jsonb_build_object('categoryRef',";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CHILD_CATEGORY_REF_TEXT_CODE =
            "child.category_ref::text,'code',child.code,'name',child.name)) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_TREE_CHILD_PARENT =
            "FROM catalog.catalog_category child JOIN category_tree parent ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PARENT_CATEGORY_REF_CHILD_PARENT_CATEGORY_REF =
            "parent.category_ref=child.parent_category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_STATUS =
            "WHERE child.data_node_ref=? AND child.brand_ref=? AND child.status = 'ENABLED'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_ALTERNATE_A = ") ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_TREE_MATCHED_CATEGORY_REF =
            "EXISTS (SELECT 1 FROM category_tree matched WHERE category_tree.category_ref = ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_MATCHED_PATH_REFS = "ANY(matched.path_refs) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_LOWER_MATCHED_CODE_LIKE =
            "AND (LOWER(matched.code) LIKE ? OR LOWER(matched.name) LIKE ?))";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_DISPLAY_ORDER_NAME =
            " WHERE (display_order>? OR (display_order=? AND name>?) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_DISPLAY_ORDER_NAME_CODE =
            "OR (display_order=? AND name=? AND code>?) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_DISPLAY_ORDER_NAME_CODE_CATEGORY_REF =
            "OR (display_order=? AND name=? AND code=? AND category_ref>?))";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_1 = "), 1) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_TREE_DESCENDANT_PATH_REFS =
            "FROM category_tree descendant WHERE ?::uuid = ANY(descendant.path_refs)) > ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VALUE_SEPARATOR_MATCHING_CATEGORY_TREE_CATEGORY_REF_CODE =
            ", matching AS (SELECT category_tree.category_ref,category_tree.code,category_tree.name,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_TREE_PARENT_CATEGORY_REF_DISPLAY_ORDER =
            "category_tree.parent_category_ref,category_tree.display_order,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATALOG_CATEGORY_CHILD_DATA_NODE_REF =
            "EXISTS (SELECT 1 FROM catalog.catalog_category child WHERE child.data_node_ref=? AND ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CHILD_BRAND_REF = "child.brand_ref=? ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CHILD_PARENT_CATEGORY_REF_CATEGORY_TREE_CATEGORY_REF =
                    "AND child.parent_category_ref=category_tree.category_ref AND child.status = 'ENABLED'),";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_TREE_PATH_JSON = "category_tree.path_json,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_DISPLAY_ORDER_NAME_CODE_CATEGORY_REF =
            " ORDER BY display_order,name,code,category_ref LIMIT ?) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_PAGED_TOTAL =
            "SELECT paged.*,aggregate.total FROM aggregate LEFT JOIN paged ON TRUE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_PAGED_DISPLAY_ORDER_NAME_CODE =
            "ORDER BY paged.display_order,paged.name,paged.code,paged.category_ref";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CTE_CATEGORY_SCOPE_CATEGORY_REF =
            "WITH RECURSIVE category_scope(category_ref) AS (";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_DATA_NODE_REF_BRAND_REF =
                    "SELECT c.category_ref FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? AND ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_REF_TEXT_STATUS_VOIDED =
            "c.category_ref::text=? AND c.status <> 'VOIDED' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNION_CATEGORY_SCOPE_CHILD_CATEGORY_REF_PARENT =
            "UNION ALL SELECT child.category_ref FROM catalog.catalog_category child JOIN category_scope parent ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF =
                    "ON child.parent_category_ref=parent.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_STATUS_ALTERNATE_A =
            "WHERE child.data_node_ref=? AND child.brand_ref=? AND ? = TRUE AND child.status <> 'VOIDED') ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_VALUE_SEPARATOR_FILTERED_ITEM_REF_CODE_NAME =
            ", filtered AS (SELECT i.item_ref, i.code, i.name, i.short_name, i.shape_key, i.status, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SECTIONS_TEXT_PREPARATION_PROFILE_VERSION =
            "i.sections::text AS sections, i.preparation_profile, i.version, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF =
            "i.updated_at_epoch_millis, i.source_scope_ref, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SALES_UNIT_REF =
            "i.sales_unit_ref, i.sales_unit_code, i.sales_unit_name, i.sales_unit_dimension, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SALES_UNIT_PRECISION =
            "i.sales_unit_precision, i.base_measure_unit_ref, i.base_measure_unit_code, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BASE_MEASURE_UNIT_NAME =
            "i.base_measure_unit_name, i.base_measure_unit_dimension, i.base_measure_unit_precision ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_ALTERNATE_B =
                    "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CODE = " AND i.code IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_REF_ALTERNATE_A = " AND i.item_ref IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_TEXT = " AND (?::text IS NULL)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_NAME_CHR_SHORT_NAME_CODE =
            " AND (i.name || chr(1) || COALESCE(i.short_name, '') || chr(1) || i.code) ILIKE '%' || ? || '%'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_VOIDED_ALTERNATE_A =
            " AND i.status <> 'VOIDED'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS = " AND i.status=?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SHAPE_KEY = " AND i.shape_key=?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_TEXT_ALTERNATE_A = " AND (?::text IS NULL)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_SCOPE_RELATION =
            " AND EXISTS (SELECT 1 FROM catalog.catalog_item_category relation JOIN category_scope c ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_REF_RELATION_ITEM_REF =
            "c.category_ref=relation.category_ref WHERE relation.item_ref=i.item_ref)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_REFERENCE_RELATION =
            " AND EXISTS (SELECT 1 FROM catalog.catalog_item_reference relation ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_KIND_REF =
            "WHERE relation.item_ref=i.item_ref AND relation.kind=? AND relation.ref=?)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_REFERENCE_RELATION_ALTERNATE_A =
            " AND EXISTS (SELECT 1 FROM catalog.catalog_item_reference relation ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_KIND_REF_ALTERNATE_A =
            "WHERE relation.item_ref=i.item_ref AND relation.kind=? AND relation.ref=?)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_CATEGORY_RELATION_ALTERNATE_A =
            " AND NOT EXISTS (SELECT 1 FROM catalog.catalog_item_category relation WHERE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_RELATION_ITEM_REF = "relation.item_ref=i.item_ref)";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_DISABLED = " AND i.status='DISABLED'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_UPDATED_AT_EPOCH_MILLIS =
            " AND i.updated_at_epoch_millis >= ?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SOURCE_SCOPE_REF =
            " AND i.source_scope_ref IS NULL";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SOURCE_SCOPE_REF_ALTERNATE_A =
            " AND i.source_scope_ref IS NOT NULL";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SECTIONS_SOURCE_SOURCE_TYPE_OWNERSHIP_SOURCE =
            " AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource') ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_TEMPORARY_EXTERNAL_ORDER_TEMPORARY =
            "IN ('TEMPORARY','EXTERNAL_ORDER_TEMPORARY')";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_CODE =
            " AND i.status='ENABLED' AND i.code <> ?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_FILTERED_AGGREGATE_TOTAL_PAGED_ITEM_REF =
            "), aggregate AS (SELECT COUNT(*) AS total FROM filtered), paged AS (SELECT item_ref, code, name, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SHORT_NAME_SHAPE_KEY_STATUS_SECTIONS =
            "short_name, shape_key, status, sections, preparation_profile, version, updated_at_epoch_millis, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SOURCE_SCOPE_REF =
            "source_scope_ref, sales_unit_ref, sales_unit_code, sales_unit_name, sales_unit_dimension, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SALES_UNIT_PRECISION_ALTERNATE_A =
            "sales_unit_precision, base_measure_unit_ref, base_measure_unit_code, base_measure_unit_name, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FILTERED =
            "base_measure_unit_dimension, base_measure_unit_precision FROM filtered ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_CODE_ITEM_REF_ALTERNATE_A =
            "ORDER BY code OFFSET ? LIMIT ?) SELECT p.item_ref, p.code, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_NAME_SHORT_NAME_SHAPE_KEY_STATUS =
            "p.name, p.short_name, p.shape_key, p.status, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_OPEN_PAREN_SECTIONS_JSONB_BUILD_OBJECT =
            "(COALESCE(p.sections::jsonb,'{}'::jsonb) || jsonb_build_object(";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PREPARATION_PROFILE =
            "'preparationProfile',p.preparation_profile,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SALES_UNIT_REF_ALTERNATE_A =
            "'salesUnitRef',p.sales_unit_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SALES_UNIT_SNAPSHOT_SALES_UNIT_REF_JSONB_BUILD_OBJECT =
            "'salesUnitSnapshot',CASE WHEN p.sales_unit_ref IS NULL THEN NULL ELSE jsonb_build_object(";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNIT_REF_SALES_UNIT_REF_CODE_SALES_UNIT_CODE =
            "'unitRef',p.sales_unit_ref,'code',p.sales_unit_code,'name',p.sales_unit_name,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNIT_DIMENSION =
            "'unitDimension',p.sales_unit_dimension,'precision',p.sales_unit_precision) END,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BASE_MEASURE_UNIT_REF =
            "'baseMeasureUnitRef',p.base_measure_unit_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_BASE_MEASURE_UNIT_SNAPSHOT_BASE_MEASURE_UNIT_REF =
            "'baseMeasureUnitSnapshot',CASE WHEN p.base_measure_unit_ref IS NULL THEN NULL ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_ELSE_JSONB_BUILD_OBJECT = "ELSE jsonb_build_object(";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNIT_REF =
            "'unitRef',p.base_measure_unit_ref,'code',p.base_measure_unit_code,'name',p.base_measure_unit_name,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNIT_DIMENSION_ALTERNATE_A =
            "'unitDimension',p.base_measure_unit_dimension,'precision',p.base_measure_unit_precision) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_TEXT_VERSION = "END))::text, p.version, ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_PAGED_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF_TOTAL =
            "p.updated_at_epoch_millis, p.source_scope_ref, a.total FROM aggregate a LEFT JOIN paged p ON ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CODE = "TRUE ORDER BY p.code";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CTE_SELECTED_ITEM_REF_CATEGORY_REF_RELATION =
            "WITH RECURSIVE selected(item_ref,category_ref) AS (SELECT relation.item_ref,relation.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_RELATION_CATEGORY =
            "FROM catalog.catalog_item_category relation JOIN catalog.catalog_category category ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_RELATION_ITEM_REF =
            "ON category.category_ref=relation.category_ref WHERE relation.item_ref IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_CATEGORY_DATA_NODE_REF_BRAND_REF =
            ") AND category.data_node_ref=? AND category.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_STATUS_VOIDED_ALTERNATE_A =
            "AND category.status <> 'VOIDED'), ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_PATHS_LEAF_REF_CATEGORY_REF_PARENT_CATEGORY_REF =
            "category_paths(leaf_ref,category_ref,parent_category_ref,path_nodes) AS (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF =
            "SELECT category.category_ref,category.category_ref,category.parent_category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JSONB_BUILD_ARRAY =
            "jsonb_build_array(jsonb_build_object('categoryRef',category.category_ref::text,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CODE_CATEGORY_NAME =
            "'code',category.code,'name',category.name)) ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_CATEGORY =
            "FROM selected JOIN catalog.catalog_category category ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_SELECTED =
            "ON category.category_ref=selected.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_UNION_PATHS_LEAF_REF_PARENT_CATEGORY_REF =
            "UNION ALL SELECT paths.leaf_ref,parent.category_ref,parent.parent_category_ref,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_PARENT =
            "jsonb_build_array(jsonb_build_object('categoryRef',parent.category_ref::text,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CODE_PARENT_NAME_PATHS =
            "'code',parent.code,'name',parent.name)) || paths.path_nodes ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_PATHS_PATHS =
            "FROM category_paths paths ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_CATEGORY_PARENT_DATA_NODE_REF_BRAND_REF =
            "JOIN catalog.catalog_category parent ON parent.data_node_ref=? AND parent.brand_ref=? ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_PARENT_CATEGORY_REF_PATHS_PARENT_CATEGORY_REF =
            "AND parent.category_ref=paths.parent_category_ref AND parent.status <> 'VOIDED') ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_SELECTED_ITEM_REF_CATEGORY_REF_PATHS_PATH_NODES =
            "SELECT selected.item_ref,selected.category_ref,paths.path_nodes FROM selected ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_PATHS_PATHS_LEAF_REF_SELECTED_CATEGORY_REF =
            "LEFT JOIN category_paths paths ON paths.leaf_ref=selected.category_ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_PATHS_PARENT_CATEGORY_REF =
            "AND paths.parent_category_ref IS NULL";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_RELATION_ITEM_REF_ENTRY_ENTRY_REF =
            "SELECT relation.item_ref,entry.entry_ref,entry.code,entry.name ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_REFERENCE_RELATION_ALTERNATE_A =
            "FROM catalog.catalog_item_reference relation ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_DICTIONARY_ENTRY_ENTRY_ENTRY_REF_RELATION_REF =
            "LEFT JOIN catalog.dictionary_entry entry ON entry.entry_ref=relation.ref ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ENTRY_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND =
            "AND entry.data_node_ref=? AND entry.brand_ref=? AND entry.dictionary_kind='TAG' ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_KIND_ITEM_REF =
            "WHERE relation.kind=? AND relation.item_ref IN (";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME =
                    "SELECT item_ref,sales_unit_ref,sales_unit_code,sales_unit_name,sales_unit_dimension,sales_unit_pre";

    public static final String CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF =
            "FROM catalog.catalog_item WHERE item_ref IN (";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF =
            "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED =
            ") AND item.status <> 'VOIDED'";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_STATUS_VOIDED_ITEM_REF =
            ") AND i.status <> 'VOIDED' ORDER BY i.item_ref";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CYCLE_BLOCKED = " AS cycle_blocked,";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CATEGORY_TREE_DEPTH_BLOCKED =
            " AS depth_blocked FROM category_tree WHERE ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_MATCHING_AGGREGATE_TOTAL_PAGED =
            "), aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS (SELECT * FROM matching";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_RELATION_ITEM_REF_ENTRY_DISPLAY_ORDER =
            ") ORDER BY relation.item_ref,entry.display_order NULLS LAST,entry.code NULLS ";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_RELATION_REF = "LAST,relation.ref";
    public static final String CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_ALTERNATE_B = ")";
    public static final String CATEGORY_ROOT_PARENT_FILTER = "category_tree.parent_category_ref IS NULL";
    public static final String CATEGORY_PARENT_FILTER = "category_tree.parent_category_ref=?";
    public static final String CYCLE_BLOCKED_NONE = "false";
    public static final String CYCLE_BLOCKED_CURRENT = "(?::uuid = ANY(category_tree.path_refs))";
    public static final String CATEGORY_DEPTH_BLOCKED_PREFIX = "(array_length(category_tree.path_refs, 1) >= ";
    public static final String DESCENDANT_DEPTH_EXPRESSION_PREFIX = "array_length(descendant.path_refs, 1) - ";
    public static final String CATEGORY_REPARENT_DEPTH_BLOCKED_PREFIX =
            "(array_length(category_tree.path_refs, 1) + (SELECT COALESCE(MAX(";
    public static final String CATEGORY_DESCENDANT_POSITION_SQL = "array_position(descendant.path_refs, ?::uuid) + 1";
    public static final String SMART_VIEW_EXTERNAL_ORDER_TEMP =
            " AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')"
                    + "='EXTERNAL_ORDER_TEMPORARY'";
    public static final String SMART_VIEW_AUTO_SYNC =
            " AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')"
                    + "='AUTO_SYNC'";
    public static final String SQL_LIST_CLOSE = ")";
    public static final String SQL_SPACE = " ";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_COALESCE_SECTIONS_SOURCE_SECTIONS_SOURCETYPE_SECTIONS_OWNERSHIPSOURCE_EXTERNAL_ORDER_TEMPORARY_SOURCETYPE_SECTIONS_OWNERSHIPSOURCE_EXTERNAL_ORDER_TEMPORARY =
                    """
    COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='EXTERNAL_ORDER_TEMPORARY'),\s""";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_COALESCE_SECTIONS_SOURCE_SECTIONS_SOURCETYPE_SECTIONS_OWNERSHIPSOURCE_AUTO_SYNC_COUNT_FILTER_NOT_EXISTS_SELECT_FROM =
                    """
    COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='AUTO_SYNC'), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM\s""";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION =
                    """
    SELECT item_ref,sales_unit_ref,sales_unit_code,sales_unit_name,sales_unit_dimension,sales_unit_precision,""";
    public static final String
            CATALOG_WORKBENCH_READ_SERVICE_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION =
                    """
    base_measure_unit_ref,base_measure_unit_code,base_measure_unit_name,base_measure_unit_dimension,base_measure_unit_precision\s""";
}
