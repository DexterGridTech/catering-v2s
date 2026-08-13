-- A content-addressed object is immutable physical storage, not a business asset identity.
-- Workspace logos require a fresh logical asset and one-time grant for every staging command,
-- while catalog images deliberately retain content-level logical reference reuse.
ALTER TABLE platform_asset.staged_asset
    DROP CONSTRAINT IF EXISTS staged_asset_storage_key_key,
    DROP CONSTRAINT IF EXISTS uq_platform_asset_bucket_object;

CREATE INDEX IF NOT EXISTS ix_platform_asset_bucket_object_reference
    ON platform_asset.staged_asset (bucket_name, object_key);

CREATE INDEX IF NOT EXISTS ix_platform_asset_storage_key_reference
    ON platform_asset.staged_asset (storage_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_asset_catalog_bucket_object
    ON platform_asset.staged_asset (bucket_name, object_key)
    WHERE usage = 'CATALOG_ITEM_IMAGE';

ALTER TABLE platform_asset.staged_asset
    ADD CONSTRAINT ck_platform_asset_usage
    CHECK (usage IN ('GROUP_WORKSPACE_LOGO', 'CATALOG_ITEM_IMAGE'));
