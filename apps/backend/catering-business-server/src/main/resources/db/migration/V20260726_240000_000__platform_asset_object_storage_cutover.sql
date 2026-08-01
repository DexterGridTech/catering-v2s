-- R5 static display bytes are external-object facts. Existing BYTEA bytes must never be dropped silently.
DO $$
DECLARE legacy_rows BIGINT;
BEGIN
    IF to_regclass('platform_asset.asset_content') IS NOT NULL THEN
        SELECT count(*) INTO legacy_rows FROM platform_asset.asset_content;
        IF legacy_rows <> 0 THEN
            RAISE EXCEPTION 'R5_ASSET_OBJECT_CUTOVER_PRECONDITION_FAILED: platform_asset.asset_content has % rows; migrate object bytes and record readback before applying this migration', legacy_rows;
        END IF;
        DROP TABLE platform_asset.asset_content;
    END IF;
END $$;

ALTER TABLE platform_asset.staged_asset
    ADD COLUMN IF NOT EXISTS bucket_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS object_key VARCHAR(512);

DO $$
DECLARE incomplete_rows TEXT;
BEGIN
    SELECT string_agg(asset_ref::text, ',' ORDER BY asset_ref) INTO incomplete_rows
      FROM platform_asset.staged_asset
     WHERE bucket_name IS NULL OR btrim(bucket_name) = '' OR object_key IS NULL OR btrim(object_key) = '';
    IF incomplete_rows IS NOT NULL THEN
        RAISE EXCEPTION 'R5_ASSET_OBJECT_METADATA_PRECONDITION_FAILED: asset refs % require object metadata migration', incomplete_rows;
    END IF;
END $$;

ALTER TABLE platform_asset.staged_asset
    ALTER COLUMN bucket_name SET NOT NULL,
    ALTER COLUMN object_key SET NOT NULL,
    ADD CONSTRAINT uq_platform_asset_bucket_object UNIQUE (bucket_name, object_key),
    ADD CONSTRAINT ck_platform_asset_bucket_name_non_blank CHECK (btrim(bucket_name) <> ''),
    ADD CONSTRAINT ck_platform_asset_object_key_non_blank CHECK (btrim(object_key) <> ''),
    ADD CONSTRAINT ck_platform_asset_content_type_static CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'video/mp4'));
