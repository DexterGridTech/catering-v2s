-- Store-owned area, service-point and QR configuration facts.
-- The tables are additive. VOIDED rows remain queryable for audit/history and
-- active code uniqueness is deliberately scoped to non-VOIDED rows.
ALTER TABLE business_channel.business_channel_template
    ADD COLUMN url_rule TEXT;

ALTER TABLE platform_asset.staged_asset
    DROP CONSTRAINT IF EXISTS ck_platform_asset_usage;
ALTER TABLE platform_asset.staged_asset
    ADD CONSTRAINT ck_platform_asset_usage
    CHECK (usage IN ('GROUP_WORKSPACE_LOGO', 'CATALOG_ITEM_IMAGE', 'SALES_MENU_ITEM_IMAGE', 'STORE_SERVICE_POINT_IMAGE'));

CREATE TABLE organization.store_service_point_area (
    area_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    store_ref UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(64) NOT NULL,
    area_type VARCHAR(16) NOT NULL CHECK (area_type IN ('TABLE_AREA', 'SCAN_AREA')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED')),
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_store_service_point_area_store
        FOREIGN KEY (store_ref) REFERENCES organization.store(id) ON DELETE RESTRICT,
    CONSTRAINT fk_store_service_point_area_workspace
        FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key),
    CONSTRAINT ck_store_service_point_area_name_non_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_store_service_point_area_code_non_blank CHECK (btrim(code) <> '')
);
ALTER TABLE organization.store_service_point_area
    ADD CONSTRAINT uq_store_service_point_area_scope_ref
    UNIQUE (area_ref, workspace_uuid, group_workspace_key, store_ref);

CREATE INDEX idx_store_service_point_area_store_order
    ON organization.store_service_point_area (workspace_uuid, group_workspace_key, store_ref, display_order, area_ref);
CREATE UNIQUE INDEX uq_store_service_point_area_active_code
    ON organization.store_service_point_area (workspace_uuid, group_workspace_key, store_ref, code)
    WHERE status <> 'VOIDED';

CREATE TABLE organization.store_service_point (
    point_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    store_ref UUID NOT NULL,
    area_ref UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(64) NOT NULL,
    point_type VARCHAR(16) NOT NULL CHECK (point_type IN ('TABLE', 'SCAN')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED')),
    display_order BIGINT NOT NULL CHECK (display_order >= 0),
    seat_capacity BIGINT,
    table_shape VARCHAR(32),
    reservable BOOLEAN,
    image_asset_ref UUID,
    extension_values JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(extension_values) = 'object'),
    extension_rule_revision BIGINT,
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_store_service_point_store
        FOREIGN KEY (store_ref) REFERENCES organization.store(id) ON DELETE RESTRICT,
    CONSTRAINT fk_store_service_point_area
        FOREIGN KEY (area_ref, workspace_uuid, group_workspace_key, store_ref)
        REFERENCES organization.store_service_point_area(area_ref, workspace_uuid, group_workspace_key, store_ref)
        ON DELETE RESTRICT,
    CONSTRAINT fk_store_service_point_workspace
        FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key),
    CONSTRAINT ck_store_service_point_name_non_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_store_service_point_code_non_blank CHECK (btrim(code) <> ''),
    CONSTRAINT ck_store_service_point_seat_capacity CHECK (seat_capacity IS NULL OR seat_capacity > 0),
    CONSTRAINT ck_store_service_point_table_attributes CHECK (
        (point_type = 'TABLE'
            AND seat_capacity IS NOT NULL
            AND table_shape IS NOT NULL
            AND reservable IS NOT NULL)
        OR (point_type = 'SCAN'
            AND seat_capacity IS NULL
            AND table_shape IS NULL
            AND reservable IS NULL
            AND image_asset_ref IS NULL)
    )
);

CREATE INDEX idx_store_service_point_area_order
    ON organization.store_service_point (workspace_uuid, group_workspace_key, store_ref, area_ref, display_order, point_ref);
CREATE UNIQUE INDEX uq_store_service_point_active_code
    ON organization.store_service_point (workspace_uuid, group_workspace_key, store_ref, code)
    WHERE status <> 'VOIDED';

CREATE TABLE organization.store_qr_configuration (
    store_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    channel_ref UUID,
    version BIGINT NOT NULL CHECK (version > 0),
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT fk_store_qr_configuration_store
        FOREIGN KEY (store_ref) REFERENCES organization.store(id) ON DELETE RESTRICT,
    CONSTRAINT fk_store_qr_configuration_workspace
        FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key),
    CONSTRAINT uq_store_qr_configuration_workspace_store UNIQUE (workspace_uuid, group_workspace_key, store_ref),
    CONSTRAINT ck_store_qr_configuration_enabled_channel CHECK (enabled OR channel_ref IS NULL)
);

CREATE INDEX idx_store_qr_configuration_workspace_store
    ON organization.store_qr_configuration (workspace_uuid, group_workspace_key, store_ref);

INSERT INTO organization.store_qr_configuration(
    store_ref, workspace_uuid, group_workspace_key, enabled, channel_ref, version,
    created_at_epoch_millis, updated_at_epoch_millis)
SELECT id, workspace_uuid, group_workspace_key, FALSE, NULL, 1,
       COALESCE(created_at_epoch_millis, 0), COALESCE(updated_at_epoch_millis, 0)
FROM organization.store
ON CONFLICT (store_ref) DO NOTHING;

CREATE TABLE organization.store_service_point_command_receipt (
    receipt_ref UUID PRIMARY KEY,
    workspace_uuid UUID NOT NULL,
    group_workspace_key VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    target_kind VARCHAR(32) NOT NULL,
    target_ref UUID NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_store_service_point_command_receipt_key
        UNIQUE (workspace_uuid, group_workspace_key, idempotency_key),
    CONSTRAINT fk_store_service_point_command_receipt_workspace
        FOREIGN KEY (workspace_uuid, group_workspace_key)
        REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);
