-- A VOIDED SKU is no longer a public code occupant.  ARCHIVED remains
-- visible to historical views and therefore keeps its code occupied.
ALTER TABLE catalog.catalog_sku
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE catalog.catalog_sku
    DROP CONSTRAINT catalog_sku_status_check;

ALTER TABLE catalog.catalog_sku
    ADD CONSTRAINT catalog_sku_status_check
    CHECK (status IN ('ENABLED', 'DISABLED', 'ARCHIVED', 'VOIDED'));

ALTER TABLE catalog.catalog_sku
    DROP CONSTRAINT catalog_sku_item_ref_sku_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_sku_active_code
    ON catalog.catalog_sku (item_ref, sku_code)
    WHERE status <> 'VOIDED';

DROP INDEX IF EXISTS catalog.ux_catalog_sku_default_per_item;
CREATE UNIQUE INDEX ux_catalog_sku_default_per_item
    ON catalog.catalog_sku (item_ref)
    WHERE is_default AND status NOT IN ('ARCHIVED', 'VOIDED');

DROP INDEX IF EXISTS catalog.ux_catalog_sku_variant_digest_per_item;
CREATE UNIQUE INDEX ux_catalog_sku_variant_digest_per_item
    ON catalog.catalog_sku (item_ref, variant_combination_digest)
    WHERE status NOT IN ('ARCHIVED', 'VOIDED');
