ALTER TABLE platform_asset.staged_asset
    DROP CONSTRAINT ck_platform_asset_usage,
    ADD CONSTRAINT ck_platform_asset_usage CHECK (
        usage IN ('GROUP_WORKSPACE_LOGO', 'CATALOG_ITEM_IMAGE', 'SALES_MENU_ITEM_IMAGE',
                  'STORE_SERVICE_POINT_IMAGE', 'TERMINAL_UPDATE_PACKAGE')
    );

ALTER TABLE platform_asset.staged_asset
    DROP CONSTRAINT ck_platform_asset_content_type_static,
    ADD CONSTRAINT ck_platform_asset_content_type_static CHECK (
        content_type IN ('image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'application/zip')
    );
