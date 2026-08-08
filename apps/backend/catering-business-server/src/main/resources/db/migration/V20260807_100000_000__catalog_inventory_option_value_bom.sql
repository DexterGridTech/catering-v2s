-- Option values are BOM owners but never independent stock targets.  Keep the
-- owner identity explicit so the same catalog item can have separate BOMs for
-- item, SKU and option value without a second truth in JSON.
ALTER TABLE inventory.stock_bom
    ADD COLUMN IF NOT EXISTS option_value_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_bom_owner_identity
    ON inventory.stock_bom (
        data_node_ref,
        brand_ref,
        item_code,
        COALESCE(sku_code, ''),
        COALESCE(option_value_code, '')
    );

CREATE INDEX IF NOT EXISTS ix_stock_bom_option_value
    ON inventory.stock_bom (data_node_ref, brand_ref, item_code, option_value_code)
    WHERE option_value_code IS NOT NULL;
