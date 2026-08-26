-- SKU rows are independently rendered in the catalog table and therefore need
-- their own authoritative update timestamp for detail/list readback.
ALTER TABLE catalog.catalog_sku
    ADD COLUMN updated_at_epoch_millis BIGINT NOT NULL DEFAULT 0;

UPDATE catalog.catalog_sku sku
SET updated_at_epoch_millis = item.updated_at_epoch_millis
FROM catalog.catalog_item item
WHERE item.item_ref = sku.item_ref
  AND sku.updated_at_epoch_millis = 0;

ALTER TABLE catalog.catalog_sku
    ALTER COLUMN updated_at_epoch_millis DROP DEFAULT;
