package com.catering.v2s.catalog.application.persistence;

/** SQL text fragments owned by CatalogItemReferenceFacts; B3 relocates text only and does not change execution. */
public final class CatalogItemReferenceFactsSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_SELECT_CATALOG_ITEM_REFERENCE_ITEM_REF_KIND_REF =
            "SELECT item_ref,kind,ref FROM catalog.catalog_item_reference WHERE item_ref IN (";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_DELETE_CATALOG_ITEM_REFERENCE_ITEM_REF =
            "DELETE FROM catalog.catalog_item_reference WHERE item_ref=?";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_DELETE_CATALOG_ITEM_REFERENCE_ITEM_REF_ALTERNATE_A =
            "DELETE FROM catalog.catalog_item_reference WHERE item_ref=?";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_INSERT_INTO_CATALOG_ITEM_REFERENCE_ITEM_REF_KIND_REF =
            "INSERT INTO catalog.catalog_item_reference(item_ref,kind,ref) VALUES(?,?,?)";
    public static final String
            CATALOG_ITEM_REFERENCE_FACTS_INSERT_INTO_CATALOG_ITEM_REFERENCE_ITEM_REF_KIND_REF_ALTERNATE_A =
                    "INSERT INTO catalog.catalog_item_reference(item_ref,kind,ref) VALUES(?,?,?)";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_SELECT_CATALOG_ITEM_RELATION_ITEM =
            "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_reference relation JOIN catalog.catalog_item item ";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_JOIN_CONDITION_ITEM_ITEM_REF_RELATION_KIND =
            "ON item.item_ref=relation.item_ref WHERE relation.kind=? AND relation.ref=? AND ";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_ITEM_DATA_NODE_REF_BRAND_REF_STATUS =
            "item.data_node_ref=? AND item.brand_ref=? AND item.status <> 'VOIDED')";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_SELECT_CATALOG_ITEM_RELATION_REF =
            "SELECT DISTINCT relation.ref FROM catalog.catalog_item_reference relation JOIN catalog.catalog_item ";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_ITEM_ITEM_REF_RELATION_KIND =
            "item ON item.item_ref=relation.item_ref WHERE relation.kind=? AND item.data_node_ref=? AND ";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_ITEM_BRAND_REF_STATUS_VOIDED =
            "item.brand_ref=? AND item.status <> 'VOIDED' AND relation.ref IN (";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_CLOSE_PAREN_ITEM_REF_KIND_REF =
            ") ORDER BY item_ref,kind,ref";
    public static final String CATALOG_ITEM_REFERENCE_FACTS_CLOSE_PAREN = ")";
}
