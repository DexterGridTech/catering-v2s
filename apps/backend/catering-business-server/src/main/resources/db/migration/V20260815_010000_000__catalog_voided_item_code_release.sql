-- A VOIDED item is deliberately absent from every public code lookup, so it
-- must not reserve a business code.  ARCHIVED items remain in the active
-- namespace because historical views still expose them.
ALTER TABLE catalog.catalog_item
    DROP CONSTRAINT IF EXISTS catalog_item_data_node_ref_brand_ref_code_key;

CREATE UNIQUE INDEX ux_catalog_item_active_code
    ON catalog.catalog_item (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';
