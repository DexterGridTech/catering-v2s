-- P3-1 catalog model.  The database may be rebuilt, so this migration creates
-- the relational source of truth without a backfill, compatibility read, or dual write.
-- Cross-owner references remain typed UUID values; no cross-schema foreign keys are introduced.

CREATE TABLE catalog.catalog_sku (
    product_sku_ref UUID PRIMARY KEY,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    sku_code TEXT NOT NULL,
    sku_name TEXT NOT NULL,
    sku_barcode TEXT,
    standard_sale_price BIGINT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    display_order INTEGER NOT NULL,
    variant_combination_digest TEXT NOT NULL,
    CHECK (status IN ('ENABLED', 'DISABLED', 'ARCHIVED')),
    CHECK (display_order >= 0),
    UNIQUE (item_ref, sku_code),
    UNIQUE (item_ref, product_sku_ref)
);
CREATE INDEX ix_catalog_sku_item_status_order
    ON catalog.catalog_sku (item_ref, status, display_order);
CREATE UNIQUE INDEX ux_catalog_sku_default_per_item
    ON catalog.catalog_sku (item_ref)
    WHERE is_default AND status <> 'ARCHIVED';
CREATE UNIQUE INDEX ux_catalog_sku_variant_digest_per_item
    ON catalog.catalog_sku (item_ref, variant_combination_digest)
    WHERE status <> 'ARCHIVED';

CREATE TABLE catalog.catalog_sku_attribute_value (
    product_sku_ref UUID NOT NULL REFERENCES catalog.catalog_sku (product_sku_ref),
    attribute_ref UUID NOT NULL REFERENCES catalog.dictionary_entry (entry_ref),
    attribute_value_ref UUID NOT NULL REFERENCES catalog.dictionary_entry (entry_ref),
    PRIMARY KEY (product_sku_ref, attribute_ref)
);
CREATE INDEX ix_catalog_sku_attribute_value_ref
    ON catalog.catalog_sku_attribute_value (attribute_value_ref, product_sku_ref);

CREATE TABLE catalog.catalog_item_category (
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    category_ref UUID NOT NULL REFERENCES catalog.catalog_category (category_ref),
    PRIMARY KEY (item_ref, category_ref)
);
CREATE INDEX ix_catalog_item_category_category_item
    ON catalog.catalog_item_category (category_ref, item_ref);

CREATE TABLE catalog.catalog_composite_group (
    composite_group_ref UUID PRIMARY KEY,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    group_code TEXT NOT NULL,
    group_name TEXT NOT NULL,
    selection_rule TEXT NOT NULL,
    min_selections INTEGER NOT NULL DEFAULT 0,
    max_selections INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL,
    CHECK (min_selections >= 0),
    CHECK (max_selections >= min_selections),
    CHECK (display_order >= 0),
    UNIQUE (item_ref, group_code),
    UNIQUE (item_ref, display_order)
);

CREATE TABLE catalog.catalog_composite_component (
    composite_component_ref UUID PRIMARY KEY,
    composite_group_ref UUID NOT NULL REFERENCES catalog.catalog_composite_group (composite_group_ref),
    component_item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    product_sku_ref UUID,
    quantity NUMERIC(24, 6) NOT NULL,
    unit TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    extra_price BIGINT,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    display_order INTEGER NOT NULL,
    CHECK (quantity > 0),
    CHECK (status IN ('ENABLED', 'DISABLED', 'ARCHIVED')),
    CHECK (display_order >= 0),
    UNIQUE (composite_group_ref, display_order),
    FOREIGN KEY (component_item_ref, product_sku_ref)
        REFERENCES catalog.catalog_sku (item_ref, product_sku_ref)
);
CREATE INDEX ix_catalog_composite_component_item
    ON catalog.catalog_composite_component (component_item_ref, product_sku_ref);

CREATE TABLE catalog.catalog_item_reference (
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    kind TEXT NOT NULL,
    ref UUID NOT NULL,
    PRIMARY KEY (item_ref, kind, ref),
    CHECK (kind IN (
        'PRODUCTION_TAG',
        'CATALOG_TAG',
        'SALES_UNIT'
    ))
);
CREATE INDEX ix_catalog_item_reference_lookup
    ON catalog.catalog_item_reference (kind, ref, item_ref);

-- These are ordered media facts, not members of the unordered reference set.
-- ITEM_IMAGE is item-owned; SKU_MEDIA is SKU-owned.  Keeping their owners
-- explicit preserves foreign keys and avoids a polymorphic relation.
CREATE TABLE catalog.catalog_item_image (
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    asset_ref UUID NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (item_ref, display_order),
    UNIQUE (item_ref, asset_ref),
    CHECK (display_order >= 0)
);
CREATE INDEX ix_catalog_item_image_asset_item
    ON catalog.catalog_item_image (asset_ref, item_ref);

CREATE TABLE catalog.catalog_sku_media (
    product_sku_ref UUID NOT NULL REFERENCES catalog.catalog_sku (product_sku_ref),
    asset_ref UUID NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (product_sku_ref, display_order),
    UNIQUE (product_sku_ref, asset_ref),
    CHECK (display_order >= 0)
);
CREATE INDEX ix_catalog_sku_media_asset_sku
    ON catalog.catalog_sku_media (asset_ref, product_sku_ref);

CREATE TABLE catalog.catalog_sku_variant_axis (
    sku_variant_axis_ref UUID PRIMARY KEY,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    attribute_ref UUID NOT NULL REFERENCES catalog.dictionary_entry (entry_ref),
    display_order INTEGER NOT NULL,
    CHECK (display_order >= 0),
    UNIQUE (item_ref, attribute_ref),
    UNIQUE (item_ref, display_order)
);

CREATE TABLE catalog.catalog_sku_variant_axis_value (
    sku_variant_axis_ref UUID NOT NULL REFERENCES catalog.catalog_sku_variant_axis (sku_variant_axis_ref),
    value_ref UUID NOT NULL REFERENCES catalog.dictionary_entry (entry_ref),
    display_order INTEGER NOT NULL,
    CHECK (display_order >= 0),
    PRIMARY KEY (sku_variant_axis_ref, value_ref),
    UNIQUE (sku_variant_axis_ref, display_order)
);
