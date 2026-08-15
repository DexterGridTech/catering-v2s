-- A physical object is content-addressed and shared; a catalog asset row is workspace-owned.
DROP INDEX platform_asset.uq_platform_asset_catalog_bucket_object;

CREATE UNIQUE INDEX uq_platform_asset_catalog_workspace_bucket_object
    ON platform_asset.staged_asset (workspace_uuid, bucket_name, object_key)
    WHERE usage = 'CATALOG_ITEM_IMAGE';
