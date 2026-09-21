-- ProductionTagDefinition is a catalog-owned entity from the reset boundary onward.
-- No rows are copied: reset drops the old owner data and the catalog seed recreates
-- the approved fixture set after this migration has established the target shape.

CREATE TABLE catalog.production_tag_definition (
    tag_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT production_tag_definition_status_check CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))
);

CREATE INDEX ix_catalog_production_tag_scope_status
    ON catalog.production_tag_definition (data_node_ref, brand_ref, status, code);

CREATE UNIQUE INDEX ux_catalog_production_tag_active_code
    ON catalog.production_tag_definition (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';

CREATE TABLE catalog.production_tag_command_receipt (
    receipt_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_json JSONB,
    created_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT production_tag_command_receipt_scope_key UNIQUE (data_node_ref, idempotency_key)
);

-- The old schema is intentionally retired rather than kept as a compatibility
-- layer.  All data is recreated by reset + seed; there is no data migration.
DROP SCHEMA IF EXISTS fulfillment_production CASCADE;

-- Fail closed inside the same Flyway transaction.  The integration test repeats
-- this readback, but a migration must not commit a partial or over-broad cutover
-- merely because its downstream test was skipped.
DO $$
DECLARE
    actual_relation_names TEXT[];
    expected_relation_names CONSTANT TEXT[] := ARRAY[
        'production_tag_command_receipt',
        'production_tag_command_receipt_pkey',
        'production_tag_command_receipt_scope_key',
        'production_tag_definition',
        'production_tag_definition_pkey'
    ];
BEGIN
    IF to_regclass('catalog.production_tag_definition') IS NULL
        OR to_regclass('catalog.production_tag_command_receipt') IS NULL THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_CUTOVER_TARGET_MISSING';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'fulfillment_production')
        OR to_regclass('fulfillment_production.production_tag_definition') IS NOT NULL
        OR to_regclass('fulfillment_production.command_receipt') IS NOT NULL THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_CUTOVER_OLD_SCHEMA_PRESENT';
    END IF;

    IF to_regclass('catalog.ix_catalog_production_tag_scope_status') IS NULL
        OR to_regclass('catalog.ux_catalog_production_tag_active_code') IS NULL THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_CUTOVER_INDEX_MISSING';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'catalog'
           AND t.relname = 'production_tag_definition'
           AND c.conname = 'production_tag_definition_status_check'
    ) OR NOT EXISTS (
        SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'catalog'
           AND t.relname = 'production_tag_command_receipt'
           AND c.conname = 'production_tag_command_receipt_scope_key'
    ) THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_CUTOVER_CONSTRAINT_MISSING';
    END IF;

    SELECT COALESCE(array_agg(c.relname ORDER BY c.relname), ARRAY[]::TEXT[])
      INTO actual_relation_names
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'catalog'
       AND c.relname LIKE 'production_tag%'
       AND c.relkind IN ('r', 'i', 'p');
    IF actual_relation_names <> expected_relation_names THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_CUTOVER_EXTRA_RELATIONS actual=% expected=%',
            actual_relation_names, expected_relation_names;
    END IF;
END
$$;
