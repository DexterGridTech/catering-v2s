-- Published menus retain the ordered Catalog image collection effective at publish time.
-- References remain opaque; Catalog and asset owners enforce their lifecycle.
ALTER TABLE sales_menu.sales_version_item
    ADD COLUMN published_catalog_image_asset_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT ck_sales_version_item_published_catalog_image_asset_refs
        CHECK (
            jsonb_typeof(published_catalog_image_asset_refs) = 'array'
            AND jsonb_array_length(published_catalog_image_asset_refs) <= 6
        );
