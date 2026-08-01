-- R5 asset bytes and binding grants are owned by platform-asset; no filesystem fallback is used.
CREATE TABLE platform_asset.asset_content (
    asset_ref UUID PRIMARY KEY REFERENCES platform_asset.staged_asset(asset_ref) ON DELETE RESTRICT,
    content_bytes BYTEA NOT NULL,
    content_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    sha256 CHAR(64) NOT NULL
);
CREATE TABLE platform_asset.asset_bind_grant (
    asset_ref UUID PRIMARY KEY REFERENCES platform_asset.staged_asset(asset_ref) ON DELETE RESTRICT,
    grant_hash CHAR(64) NOT NULL,
    expires_at_epoch_millis BIGINT NOT NULL,
    consumed_at_epoch_millis BIGINT
);
