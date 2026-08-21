-- Unit definitions are catalog facts.  Inventory stores copied immutable unit snapshots, never a catalog FK.
CREATE TABLE catalog.unit_definition (
    unit_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    dimension TEXT NOT NULL,
    precision INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CHECK (dimension IN ('COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE')),
    CHECK (precision >= 0),
    CHECK (status IN ('ENABLED', 'DISABLED')),
    UNIQUE (data_node_ref, brand_ref, code)
);
CREATE INDEX ix_catalog_unit_definition_scope_status
    ON catalog.unit_definition (data_node_ref, brand_ref, status, name, code);

-- Catalog item/SKU snapshots use the current effective base unit at save time.  No legacy unit array is retained.
ALTER TABLE catalog.catalog_item
    ADD COLUMN sales_unit_ref UUID,
    ADD COLUMN sales_unit_code TEXT,
    ADD COLUMN sales_unit_name TEXT,
    ADD COLUMN sales_unit_dimension TEXT,
    ADD COLUMN sales_unit_precision INTEGER,
    ADD COLUMN base_measure_unit_ref UUID,
    ADD COLUMN base_measure_unit_code TEXT,
    ADD COLUMN base_measure_unit_name TEXT,
    ADD COLUMN base_measure_unit_dimension TEXT,
    ADD COLUMN base_measure_unit_precision INTEGER;
ALTER TABLE catalog.catalog_sku
    ADD COLUMN sales_unit_override_ref UUID,
    ADD COLUMN base_measure_unit_override_ref UUID,
    ADD COLUMN sales_unit_ref UUID,
    ADD COLUMN sales_unit_code TEXT,
    ADD COLUMN sales_unit_name TEXT,
    ADD COLUMN sales_unit_dimension TEXT,
    ADD COLUMN sales_unit_precision INTEGER,
    ADD COLUMN base_measure_unit_ref UUID,
    ADD COLUMN base_measure_unit_code TEXT,
    ADD COLUMN base_measure_unit_name TEXT,
    ADD COLUMN base_measure_unit_dimension TEXT,
    ADD COLUMN base_measure_unit_precision INTEGER;
ALTER TABLE catalog.catalog_order_option_definition_material
    ADD COLUMN consumption_unit_ref UUID,
    ADD COLUMN consumption_unit_code TEXT,
    ADD COLUMN consumption_unit_name TEXT,
    ADD COLUMN consumption_unit_dimension TEXT,
    ADD COLUMN consumption_unit_precision INTEGER;
ALTER TABLE catalog.catalog_order_option_definition_material
    DROP COLUMN IF EXISTS consumption_unit;

-- Sales units are scalar catalog facts, never members of the unordered
-- reference set or the dictionary/tag library.
ALTER TABLE catalog.catalog_item_reference
    DROP CONSTRAINT IF EXISTS catalog_item_reference_kind_check;
DELETE FROM catalog.catalog_item_reference WHERE kind='SALES_UNIT';
ALTER TABLE catalog.catalog_item_reference
    ADD CONSTRAINT catalog_item_reference_kind_check CHECK (kind IN ('PRODUCTION_TAG', 'CATALOG_TAG'));
DELETE FROM catalog.dictionary_entry WHERE dictionary_kind='SALES_UNIT';

ALTER TABLE catalog.catalog_item
    ADD CONSTRAINT catalog_item_sales_unit_dimension_check CHECK (sales_unit_dimension IS NULL OR sales_unit_dimension IN ('COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE')),
    ADD CONSTRAINT catalog_item_base_measure_unit_dimension_check CHECK (base_measure_unit_dimension IS NULL OR base_measure_unit_dimension IN ('COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE')),
    ADD CONSTRAINT catalog_item_sales_unit_precision_check CHECK (sales_unit_precision IS NULL OR sales_unit_precision >= 0),
    ADD CONSTRAINT catalog_item_base_measure_unit_precision_check CHECK (base_measure_unit_precision IS NULL OR base_measure_unit_precision >= 0);

ALTER TABLE catalog.catalog_sku
    ADD CONSTRAINT catalog_sku_sales_unit_dimension_check CHECK (sales_unit_dimension IS NULL OR sales_unit_dimension IN ('COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE')),
    ADD CONSTRAINT catalog_sku_base_measure_unit_dimension_check CHECK (base_measure_unit_dimension IS NULL OR base_measure_unit_dimension IN ('COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE')),
    ADD CONSTRAINT catalog_sku_sales_unit_precision_check CHECK (sales_unit_precision IS NULL OR sales_unit_precision >= 0),
    ADD CONSTRAINT catalog_sku_base_measure_unit_precision_check CHECK (base_measure_unit_precision IS NULL OR base_measure_unit_precision >= 0);

-- measure_mode used to overload inventory control mode and a unit string.  New facts separate mode from consumption.
ALTER TABLE inventory.stock_target
    ADD COLUMN inventory_mode TEXT NOT NULL DEFAULT 'INDEPENDENT_STOCK',
    ADD COLUMN consumption_unit_ref UUID,
    ADD COLUMN consumption_unit_code TEXT,
    ADD COLUMN consumption_unit_name TEXT,
    ADD COLUMN consumption_unit_dimension TEXT,
    ADD COLUMN consumption_unit_precision INTEGER,
    ADD COLUMN counting_unit_ref UUID,
    ADD COLUMN counting_unit_code TEXT,
    ADD COLUMN counting_unit_name TEXT,
    ADD COLUMN counting_unit_dimension TEXT,
    ADD COLUMN counting_unit_precision INTEGER,
    ADD COLUMN counting_unit_conversion_factor NUMERIC(24, 12);
CREATE INDEX ix_inventory_stock_target_consumption_unit ON inventory.stock_target (consumption_unit_ref);
CREATE INDEX ix_inventory_stock_target_counting_unit ON inventory.stock_target (counting_unit_ref);

ALTER TABLE inventory.stock_ledger
    ADD COLUMN consumption_unit_ref UUID,
    ADD COLUMN consumption_unit_code TEXT,
    ADD COLUMN consumption_unit_name TEXT,
    ADD COLUMN consumption_unit_dimension TEXT,
    ADD COLUMN consumption_unit_precision INTEGER;
CREATE INDEX ix_inventory_stock_ledger_consumption_unit ON inventory.stock_ledger (consumption_unit_ref);

-- Each BOM may consume several target units, so its immutable snapshots live on each JSONB line rather than a
-- misleading single header unit column.
