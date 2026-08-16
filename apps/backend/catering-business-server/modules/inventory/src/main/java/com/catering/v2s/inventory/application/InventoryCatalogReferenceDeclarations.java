package com.catering.v2s.inventory.application;

import java.util.List;

/** Generated from catalog-inventory-reference-path-matrix.json; do not edit. */
final class InventoryCatalogReferenceDeclarations {
    record Source(String tableName, String columnName) {}

    static List<Source> sourcesFor(String objectType) {
        return switch (objectType) {
            case "CATALOG_ITEM" -> List.of(new Source("stock_target", "item_ref"), new Source("stock_bom", "item_ref"));
            case "PRODUCT_SKU" -> List.of(
                    new Source("stock_target", "product_sku_ref"), new Source("stock_bom", "product_sku_ref"));
            case "SKU_ATTRIBUTE_VALUE" -> List.of(new Source("stock_bom", "option_value_ref"));
            default -> List.of();
        };
    }

    private InventoryCatalogReferenceDeclarations() {}
}
