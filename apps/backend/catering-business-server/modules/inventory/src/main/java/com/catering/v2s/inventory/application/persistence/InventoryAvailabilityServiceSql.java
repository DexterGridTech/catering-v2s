package com.catering.v2s.inventory.application.persistence;

/** SQL text fragments owned by InventoryAvailabilityService; B3 relocates text only and does not change execution. */
public final class InventoryAvailabilityServiceSql {
    public static final String SELECT_PREFIX = "SELECT ";
    public static final String TARGET_SELECT_COLUMNS =
            "target_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,balance,configuration::text,"
                    + "version,updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                    + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                    + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                    + "counting_unit_precision,counting_unit_conversion_factor,definition_status,inventory_mode,"
                    + "component_eligible";
    public static final String IDENTITY_OR_JOINER = " OR ";
    public static final String IDENTITY_PREDICATE = "(item_ref=? AND product_sku_ref IS NOT DISTINCT FROM ?)";
    public static final String SQL_CLOSE_PAREN = ")";
    public static final String INVENTORY_AVAILABILITY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF = " FROM inventory.stock_target WHERE data_node_ref=? AND ";
    public static final String INVENTORY_AVAILABILITY_SERVICE_CONTINUATION_BRAND_REF_DEFINITION_STATUS_ENABLED = "brand_ref=? AND definition_status='ENABLED' AND (";
}
