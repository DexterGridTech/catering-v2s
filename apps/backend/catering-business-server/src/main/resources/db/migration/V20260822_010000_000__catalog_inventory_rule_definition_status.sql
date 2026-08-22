-- Catalog inventory rule lifecycle.  A disabled row is an immutable historical definition
-- snapshot; only the inventory owner may move a definition between active and historical state.
ALTER TABLE inventory.stock_target
    ADD COLUMN definition_status TEXT NOT NULL DEFAULT 'ENABLED';
ALTER TABLE inventory.stock_bom
    ADD COLUMN definition_status TEXT NOT NULL DEFAULT 'ENABLED';

UPDATE inventory.stock_target
SET inventory_mode='DIRECT'
WHERE inventory_mode='INDEPENDENT_STOCK';
UPDATE inventory.stock_target
SET configuration=jsonb_set(configuration, '{mode}', '"DIRECT"'::jsonb, true)
WHERE configuration->>'mode'='INDEPENDENT_STOCK';

ALTER TABLE inventory.stock_target
    ALTER COLUMN inventory_mode SET DEFAULT 'DIRECT';

ALTER TABLE inventory.stock_target
    ADD CONSTRAINT stock_target_definition_status_check
        CHECK (definition_status IN ('ENABLED', 'DISABLED')),
    ADD CONSTRAINT stock_target_inventory_mode_check
        CHECK (inventory_mode IN ('DIRECT', 'BOM'));
ALTER TABLE inventory.stock_bom
    ADD CONSTRAINT stock_bom_definition_status_check
        CHECK (definition_status IN ('ENABLED', 'DISABLED'));

DROP INDEX IF EXISTS inventory.ux_stock_target_catalog_identity_ref;
DROP INDEX IF EXISTS inventory.ux_stock_bom_catalog_owner_identity_ref;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM inventory.stock_bom
        WHERE definition_status='ENABLED'
          AND (jsonb_typeof(rows) <> 'array' OR jsonb_array_length(rows)=0)
    ) THEN
        RAISE EXCEPTION 'INVENTORY_BOM_EMPTY: existing enabled BOM definition is empty';
    END IF;
END $$;

CREATE UNIQUE INDEX ux_inventory_stock_target_active_identity
    ON inventory.stock_target (
        data_node_ref,
        brand_ref,
        item_ref,
        COALESCE(product_sku_ref, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE definition_status='ENABLED';
CREATE UNIQUE INDEX ux_inventory_stock_bom_active_identity
    ON inventory.stock_bom (
        data_node_ref,
        brand_ref,
        item_ref,
        COALESCE(product_sku_ref, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(option_value_ref, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE definition_status='ENABLED';
CREATE INDEX ix_inventory_stock_target_definition_status
    ON inventory.stock_target (data_node_ref, brand_ref, item_ref, definition_status);
CREATE INDEX ix_inventory_stock_bom_definition_status
    ON inventory.stock_bom (data_node_ref, brand_ref, item_ref, definition_status);
