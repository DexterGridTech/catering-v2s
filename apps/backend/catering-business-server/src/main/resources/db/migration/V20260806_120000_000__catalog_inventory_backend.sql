-- CI-P2: owner-local facts for catalog, light inventory and production tags.
-- Cross-owner references are typed values, not cross-schema DML or foreign keys.
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS fulfillment_production;

CREATE TABLE IF NOT EXISTS catalog.catalog_item (
    item_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    shape_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    sections JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_item_code TEXT,
    source_scope_ref TEXT,
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, brand_ref, code),
    CHECK (status IN ('DRAFT', 'ENABLED', 'DISABLED', 'ARCHIVED', 'VOIDED')),
    CHECK (shape_key IN ('STANDARD_SALE_COUNTED', 'SKU_VARIANT_SALE_COUNTED', 'STANDARD_SALE_WEIGHED', 'MATERIAL', 'COMPOSITE', 'SERVICE', 'BENEFIT_SHELL'))
);
CREATE INDEX IF NOT EXISTS ix_catalog_item_scope_status ON catalog.catalog_item (data_node_ref, brand_ref, status, code);

CREATE TABLE IF NOT EXISTS catalog.catalog_category (
    category_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_code TEXT,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, brand_ref, code),
    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))
);
CREATE INDEX IF NOT EXISTS ix_catalog_category_scope_parent ON catalog.catalog_category (data_node_ref, brand_ref, parent_code, code);

CREATE TABLE IF NOT EXISTS catalog.dictionary_entry (
    entry_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    dictionary_kind TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    display_order INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, brand_ref, dictionary_kind, code),
    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))
);

CREATE TABLE IF NOT EXISTS catalog.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, idempotency_key)
);

CREATE TABLE IF NOT EXISTS inventory.stock_target (
    target_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    item_code TEXT NOT NULL,
    sku_code TEXT,
    measure_mode TEXT NOT NULL DEFAULT 'NO_SKU',
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    balance NUMERIC(24, 6) NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, brand_ref, item_code, sku_code)
);
CREATE INDEX IF NOT EXISTS ix_stock_target_scope_item ON inventory.stock_target (data_node_ref, brand_ref, item_code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_target_identity ON inventory.stock_target (data_node_ref, brand_ref, item_code, COALESCE(sku_code, ''));

CREATE TABLE IF NOT EXISTS inventory.stock_ledger (
    entry_ref UUID PRIMARY KEY,
    target_ref UUID NOT NULL,
    operation_id TEXT NOT NULL,
    delta NUMERIC(24, 6) NOT NULL,
    balance_before NUMERIC(24, 6) NOT NULL,
    balance_after NUMERIC(24, 6) NOT NULL,
    reason_code TEXT,
    note TEXT,
    occurred_at_epoch_millis BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_target_time ON inventory.stock_ledger (target_ref, occurred_at_epoch_millis DESC);

CREATE TABLE IF NOT EXISTS inventory.stock_bom (
    bom_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    item_code TEXT NOT NULL,
    sku_code TEXT,
    version BIGINT NOT NULL DEFAULT 1,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, brand_ref, item_code, sku_code)
);

CREATE TABLE IF NOT EXISTS inventory.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, idempotency_key)
);

CREATE TABLE IF NOT EXISTS fulfillment_production.production_tag_definition (
    tag_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    code TEXT NOT NULL,
    tag_kind TEXT NOT NULL DEFAULT 'OTHER',
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, brand_ref, code),
    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED')),
    CHECK (tag_kind IN ('PRODUCTION', 'PACKAGE', 'LABEL', 'HANDOFF', 'REVIEW', 'OTHER'))
);
CREATE INDEX IF NOT EXISTS ix_production_tag_scope_status ON fulfillment_production.production_tag_definition (data_node_ref, brand_ref, status, code);

CREATE TABLE IF NOT EXISTS fulfillment_production.command_receipt (
    receipt_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL,
    UNIQUE (data_node_ref, idempotency_key)
);
