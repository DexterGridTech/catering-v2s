-- Published menus retain the Catalog image reference that was effective at publish time.
-- The reference is opaque by design; Catalog and asset owners enforce its lifecycle.
ALTER TABLE sales_menu.sales_version_item
    ADD COLUMN published_primary_image_asset_ref UUID;
