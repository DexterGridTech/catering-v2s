-- R10/R13/R14: inventory keeps product codes only as read labels.  Target and
-- BOM identity is the catalog-owned opaque UUID tuple; no cross-schema FK is
-- introduced because the owners still coordinate through REQUIRED commands.
ALTER TABLE inventory.stock_target
    ADD COLUMN IF NOT EXISTS item_ref UUID,
    ADD COLUMN IF NOT EXISTS product_sku_ref UUID;

ALTER TABLE inventory.stock_bom
    ADD COLUMN IF NOT EXISTS item_ref UUID,
    ADD COLUMN IF NOT EXISTS product_sku_ref UUID,
    ADD COLUMN IF NOT EXISTS option_value_ref UUID;

DO $$
DECLARE
    target_row RECORD;
    resolved_item_ref UUID;
    resolved_sku_ref UUID;
BEGIN
    FOR target_row IN
        SELECT target_ref, data_node_ref, brand_ref, item_code, sku_code
          FROM inventory.stock_target
         WHERE item_ref IS NULL
    LOOP
        BEGIN
            SELECT item_ref INTO STRICT resolved_item_ref
              FROM catalog.catalog_item
             WHERE data_node_ref = target_row.data_node_ref
               AND brand_ref = target_row.brand_ref
               AND code = target_row.item_code;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE EXCEPTION 'INVENTORY_ITEM_REFERENCE_MAPPING_UNRESOLVED target=% scope=% brand=% itemCode=%',
                    target_row.target_ref, target_row.data_node_ref, target_row.brand_ref, target_row.item_code;
            WHEN TOO_MANY_ROWS THEN
                RAISE EXCEPTION 'INVENTORY_ITEM_REFERENCE_MAPPING_AMBIGUOUS target=% scope=% brand=% itemCode=%',
                    target_row.target_ref, target_row.data_node_ref, target_row.brand_ref, target_row.item_code;
        END;

        resolved_sku_ref := NULL;
        IF target_row.sku_code IS NOT NULL THEN
            BEGIN
                SELECT (sku.value ->> 'productSkuRef')::uuid INTO STRICT resolved_sku_ref
                  FROM catalog.catalog_item item
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item.sections -> 'skus', '[]'::jsonb)) AS sku(value)
                 WHERE item.item_ref = resolved_item_ref
                   AND sku.value ->> 'skuCode' = target_row.sku_code
                   AND (sku.value ->> 'productSkuRef') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    RAISE EXCEPTION 'INVENTORY_PRODUCT_SKU_REFERENCE_MAPPING_UNRESOLVED target=% itemRef=% skuCode=%',
                        target_row.target_ref, resolved_item_ref, target_row.sku_code;
                WHEN TOO_MANY_ROWS THEN
                    RAISE EXCEPTION 'INVENTORY_PRODUCT_SKU_REFERENCE_MAPPING_AMBIGUOUS target=% itemRef=% skuCode=%',
                        target_row.target_ref, resolved_item_ref, target_row.sku_code;
            END;
        END IF;

        UPDATE inventory.stock_target
           SET item_ref = resolved_item_ref,
               product_sku_ref = resolved_sku_ref
         WHERE target_ref = target_row.target_ref;
    END LOOP;
END $$;

DO $$
DECLARE
    bom_row RECORD;
    resolved_item_ref UUID;
    resolved_sku_ref UUID;
    resolved_option_ref UUID;
BEGIN
    FOR bom_row IN
        SELECT bom_ref, data_node_ref, brand_ref, item_code, sku_code, option_value_code
          FROM inventory.stock_bom
         WHERE item_ref IS NULL
    LOOP
        BEGIN
            SELECT item_ref INTO STRICT resolved_item_ref
              FROM catalog.catalog_item
             WHERE data_node_ref = bom_row.data_node_ref
               AND brand_ref = bom_row.brand_ref
               AND code = bom_row.item_code;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE EXCEPTION 'INVENTORY_BOM_ITEM_REFERENCE_MAPPING_UNRESOLVED bom=% scope=% brand=% itemCode=%',
                    bom_row.bom_ref, bom_row.data_node_ref, bom_row.brand_ref, bom_row.item_code;
            WHEN TOO_MANY_ROWS THEN
                RAISE EXCEPTION 'INVENTORY_BOM_ITEM_REFERENCE_MAPPING_AMBIGUOUS bom=% scope=% brand=% itemCode=%',
                    bom_row.bom_ref, bom_row.data_node_ref, bom_row.brand_ref, bom_row.item_code;
        END;

        resolved_sku_ref := NULL;
        IF bom_row.sku_code IS NOT NULL THEN
            BEGIN
                SELECT (sku.value ->> 'productSkuRef')::uuid INTO STRICT resolved_sku_ref
                  FROM catalog.catalog_item item
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item.sections -> 'skus', '[]'::jsonb)) AS sku(value)
                 WHERE item.item_ref = resolved_item_ref
                   AND sku.value ->> 'skuCode' = bom_row.sku_code
                   AND (sku.value ->> 'productSkuRef') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    RAISE EXCEPTION 'INVENTORY_BOM_PRODUCT_SKU_REFERENCE_MAPPING_UNRESOLVED bom=% itemRef=% skuCode=%',
                        bom_row.bom_ref, resolved_item_ref, bom_row.sku_code;
                WHEN TOO_MANY_ROWS THEN
                    RAISE EXCEPTION 'INVENTORY_BOM_PRODUCT_SKU_REFERENCE_MAPPING_AMBIGUOUS bom=% itemRef=% skuCode=%',
                        bom_row.bom_ref, resolved_item_ref, bom_row.sku_code;
            END;
        END IF;

        resolved_option_ref := NULL;
        IF bom_row.option_value_code IS NOT NULL THEN
            BEGIN
                SELECT entry_ref INTO STRICT resolved_option_ref
                  FROM catalog.dictionary_entry
                 WHERE data_node_ref = bom_row.data_node_ref
                   AND brand_ref = bom_row.brand_ref
                   AND dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
                   AND code = bom_row.option_value_code;
            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    RAISE EXCEPTION 'INVENTORY_BOM_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED bom=% scope=% brand=% optionValueCode=%',
                        bom_row.bom_ref, bom_row.data_node_ref, bom_row.brand_ref, bom_row.option_value_code;
                WHEN TOO_MANY_ROWS THEN
                    RAISE EXCEPTION 'INVENTORY_BOM_OPTION_VALUE_REFERENCE_MAPPING_AMBIGUOUS bom=% scope=% brand=% optionValueCode=%',
                        bom_row.bom_ref, bom_row.data_node_ref, bom_row.brand_ref, bom_row.option_value_code;
            END;
        END IF;

        UPDATE inventory.stock_bom
           SET item_ref = resolved_item_ref,
               product_sku_ref = resolved_sku_ref,
               option_value_ref = resolved_option_ref
         WHERE bom_ref = bom_row.bom_ref;
    END LOOP;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM inventory.stock_target WHERE item_ref IS NULL) THEN
        RAISE EXCEPTION 'INVENTORY_ITEM_REFERENCE_MAPPING_UNRESOLVED: stock_target item_ref remains null';
    END IF;
    IF EXISTS (SELECT 1 FROM inventory.stock_bom WHERE item_ref IS NULL) THEN
        RAISE EXCEPTION 'INVENTORY_BOM_ITEM_REFERENCE_MAPPING_UNRESOLVED: stock_bom item_ref remains null';
    END IF;
END $$;

ALTER TABLE inventory.stock_target
    ALTER COLUMN item_ref SET NOT NULL;
ALTER TABLE inventory.stock_bom
    ALTER COLUMN item_ref SET NOT NULL;

ALTER TABLE inventory.stock_target
    DROP CONSTRAINT IF EXISTS stock_target_data_node_ref_brand_ref_item_code_sku_code_key;
DROP INDEX IF EXISTS inventory.ux_stock_target_identity;
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_target_catalog_identity_ref
    ON inventory.stock_target (data_node_ref, brand_ref, item_ref, COALESCE(product_sku_ref, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS ix_stock_target_scope_item_ref
    ON inventory.stock_target (data_node_ref, brand_ref, item_ref);

ALTER TABLE inventory.stock_bom
    DROP CONSTRAINT IF EXISTS stock_bom_data_node_ref_brand_ref_item_code_sku_code_key;
DROP INDEX IF EXISTS inventory.ux_stock_bom_owner_identity;
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_bom_catalog_owner_identity_ref
    ON inventory.stock_bom (data_node_ref, brand_ref, item_ref, COALESCE(product_sku_ref, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(option_value_ref, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS ix_stock_bom_scope_item_ref
    ON inventory.stock_bom (data_node_ref, brand_ref, item_ref);
