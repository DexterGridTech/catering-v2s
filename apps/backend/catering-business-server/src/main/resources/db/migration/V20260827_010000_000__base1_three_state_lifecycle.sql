-- Base-1 master-data lifecycle convergence.
-- Dexter 2026-08-27 D03=C explicitly revises only the option-value part of
-- V20260820_010000_002__catalog_order_option_definition_business_codes.sql:
-- option groups remain scope-unique; option values are unique within their parent definition.
--
-- Inventory stock_target/stock_bom definition_status remains intentionally excluded:
-- ENABLED is the single current definition and DISABLED is an immutable historical snapshot.

CREATE OR REPLACE FUNCTION pg_temp.base1_assert_status_values(
    table_name TEXT,
    column_name TEXT,
    allowed_values TEXT[]
) RETURNS VOID AS $$
DECLARE
    offending_values TEXT;
BEGIN
    EXECUTE format(
        'SELECT string_agg(DISTINCT %1$I::text, '','' ORDER BY %1$I::text)
           FROM %2$s
          WHERE %1$I IS NULL OR NOT (%1$I::text = ANY ($1))',
        column_name,
        table_name
    )
    USING allowed_values
    INTO offending_values;

    IF offending_values IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'BASE1_UNKNOWN_STATUS_PRECONDITION_FAILED',
            DETAIL = table_name || '.' || column_name || '=' || offending_values;
    END IF;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.base1_assert_no_duplicate(
    duplicate_query TEXT,
    label TEXT
) RETURNS VOID AS $$
DECLARE
    duplicate_groups BIGINT;
BEGIN
    EXECUTE format('SELECT count(*) FROM (%s) duplicate_groups', duplicate_query)
    INTO duplicate_groups;

    IF duplicate_groups > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'BASE1_BUSINESS_KEY_DUPLICATE_PRECONDITION_FAILED',
            DETAIL = label || '=' || duplicate_groups::text;
    END IF;
END
$$ LANGUAGE plpgsql;

SELECT pg_temp.base1_assert_status_values('organization.organization_node', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('organization.brand', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('organization.tenant', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('organization.head_company', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('organization.store', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('workspace_iam.workspace_account', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('workspace_iam.workspace_role', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('business_channel.business_channel_template', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('business_channel.business_channel', 'status', ARRAY['DRAFT','EFFECTIVE','DISABLED']);
SELECT pg_temp.base1_assert_status_values('catalog.unit_definition', 'status', ARRAY['ENABLED','DISABLED']);
SELECT pg_temp.base1_assert_status_values('catalog.catalog_category', 'status', ARRAY['ENABLED','DISABLED','VOIDED']);
SELECT pg_temp.base1_assert_status_values('catalog.catalog_item', 'status', ARRAY['DRAFT','ENABLED','DISABLED','ARCHIVED','VOIDED']);
SELECT pg_temp.base1_assert_status_values('catalog.catalog_sku', 'status', ARRAY['ENABLED','DISABLED','ARCHIVED','VOIDED']);
SELECT pg_temp.base1_assert_status_values('catalog.catalog_composite_component', 'status', ARRAY['ENABLED','DISABLED','ARCHIVED']);

DO $$
DECLARE
    archived_components BIGINT;
BEGIN
    SELECT count(*) INTO archived_components
      FROM catalog.catalog_composite_component
     WHERE status = 'ARCHIVED';
    IF archived_components > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'BASE1_COMPONENT_ARCHIVED_PRECONDITION_FAILED',
            DETAIL = 'catalog.catalog_composite_component.status=ARCHIVED';
    END IF;
END $$;

DO $$
DECLARE
    invalid_fields BIGINT;
BEGIN
    SELECT count(*) INTO invalid_fields
      FROM extension.extension_definition definition
      CROSS JOIN LATERAL jsonb_array_elements(definition.definitions) AS field(field_value)
     WHERE jsonb_typeof(field.field_value) <> 'object';
    IF invalid_fields > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'BASE1_EXTENSION_FIELD_SHAPE_PRECONDITION_FAILED',
            DETAIL = 'extension.extension_definition.definitions[] must be object';
    END IF;

    SELECT count(*) INTO invalid_fields
      FROM extension.extension_definition definition
      CROSS JOIN LATERAL jsonb_array_elements(definition.definitions) AS field(field_value)
     WHERE field.field_value ? 'status'
       AND field.field_value->'status' <> 'null'::jsonb
       AND (
            jsonb_typeof(field.field_value->'status') <> 'string'
            OR field.field_value->>'status' NOT IN ('ENABLED', 'DISABLED')
       );
    IF invalid_fields > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'BASE1_EXTENSION_FIELD_STATUS_PRECONDITION_FAILED',
            DETAIL = 'extension.extension_definition.definitions[].status';
    END IF;
END $$;

ALTER TABLE business_channel.business_channel
    DROP CONSTRAINT business_channel_status_check;

UPDATE business_channel.business_channel
   SET status = CASE status
       WHEN 'DRAFT' THEN 'DISABLED'
       WHEN 'EFFECTIVE' THEN 'ENABLED'
       WHEN 'DISABLED' THEN 'DISABLED'
   END
 WHERE status IN ('DRAFT', 'EFFECTIVE', 'DISABLED');

SELECT pg_temp.base1_assert_status_values('business_channel.business_channel', 'status', ARRAY['ENABLED','DISABLED']);

ALTER TABLE business_channel.business_channel
    ADD CONSTRAINT business_channel_status_check
    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));

UPDATE catalog.catalog_item
   SET status = CASE status
       WHEN 'DRAFT' THEN 'DISABLED'
       WHEN 'ARCHIVED' THEN 'VOIDED'
       ELSE status
   END
 WHERE status IN ('DRAFT', 'ARCHIVED');

UPDATE catalog.catalog_sku
   SET status = 'VOIDED'
 WHERE status = 'ARCHIVED';

ALTER TABLE catalog.catalog_item
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE catalog.catalog_item
    DROP CONSTRAINT catalog_item_status_check,
    ADD CONSTRAINT catalog_item_status_check
    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));

ALTER TABLE catalog.catalog_sku
    DROP CONSTRAINT catalog_sku_status_check,
    ADD CONSTRAINT catalog_sku_status_check
    CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));

ALTER TABLE organization.organization_node
    DROP CONSTRAINT ck_organization_node_status,
    ADD CONSTRAINT ck_organization_node_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE organization.brand
    DROP CONSTRAINT ck_brand_status,
    ADD CONSTRAINT ck_brand_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE organization.tenant
    DROP CONSTRAINT ck_tenant_status,
    ADD CONSTRAINT ck_tenant_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE organization.head_company
    DROP CONSTRAINT ck_head_company_status,
    ADD CONSTRAINT ck_head_company_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE organization.store
    DROP CONSTRAINT ck_store_status,
    ADD CONSTRAINT ck_store_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE workspace_iam.workspace_account
    DROP CONSTRAINT ck_workspace_account_status,
    ADD CONSTRAINT ck_workspace_account_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE workspace_iam.workspace_role
    DROP CONSTRAINT ck_workspace_role_status,
    ADD CONSTRAINT ck_workspace_role_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE business_channel.business_channel_template
    DROP CONSTRAINT business_channel_template_status_check,
    ADD CONSTRAINT business_channel_template_status_check CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));
ALTER TABLE catalog.unit_definition
    DROP CONSTRAINT unit_definition_status_check,
    ADD CONSTRAINT unit_definition_status_check CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));

ALTER TABLE catalog.catalog_attribute_definition ADD COLUMN status VARCHAR(16);
UPDATE catalog.catalog_attribute_definition SET status = 'ENABLED' WHERE status IS NULL;
ALTER TABLE catalog.catalog_attribute_definition
    ALTER COLUMN status SET NOT NULL,
    ADD CONSTRAINT ck_catalog_attribute_definition_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));

ALTER TABLE catalog.catalog_order_option_definition ADD COLUMN status VARCHAR(16);
UPDATE catalog.catalog_order_option_definition SET status = 'ENABLED' WHERE status IS NULL;
ALTER TABLE catalog.catalog_order_option_definition
    ALTER COLUMN status SET NOT NULL,
    ADD CONSTRAINT ck_catalog_order_option_definition_status CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'));

ALTER TABLE catalog.catalog_composite_component
    DROP CONSTRAINT catalog_composite_component_status_check,
    ADD CONSTRAINT catalog_composite_component_status_check CHECK (status IN ('ENABLED', 'DISABLED'));

UPDATE extension.extension_definition AS definition
   SET definitions = (
       SELECT COALESCE(
           jsonb_agg(
               CASE
                   WHEN NOT (field_value ? 'status') OR field_value->'status' = 'null'::jsonb
                       THEN jsonb_set(field_value, '{status}', '"ENABLED"'::jsonb, true)
                   ELSE field_value
               END
               ORDER BY ordinal
           ),
           '[]'::jsonb
       )
       FROM jsonb_array_elements(definition.definitions) WITH ORDINALITY AS field(field_value, ordinal)
   )
 WHERE jsonb_path_exists(
       definitions,
       '$[*] ? (!(exists (@.status)) || @.status == null)'
   );

ALTER TABLE extension.extension_definition
    ADD CONSTRAINT ck_extension_definition_field_status
    CHECK (
        NOT jsonb_path_exists(
            definitions,
            '$[*] ? (!(exists (@.status)) || @.status == null || (@.status != "ENABLED" && @.status != "DISABLED"))'
        )
    );

SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, node_type, code
       FROM organization.organization_node
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, node_type, code
     HAVING count(*) > 1',
    'organization.organization_node.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, code
       FROM organization.brand
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, code
     HAVING count(*) > 1',
    'organization.brand.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, lower(btrim(name))
       FROM organization.brand
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, lower(btrim(name))
     HAVING count(*) > 1',
    'organization.brand.name'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, code
       FROM organization.tenant
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, code
     HAVING count(*) > 1',
    'organization.tenant.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, credit_code
       FROM organization.tenant
      WHERE status <> ''VOIDED'' AND credit_code IS NOT NULL
      GROUP BY workspace_uuid, group_workspace_key, credit_code
     HAVING count(*) > 1',
    'organization.tenant.credit_code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, lower(btrim(name))
       FROM organization.tenant
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, lower(btrim(name))
     HAVING count(*) > 1',
    'organization.tenant.name'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, code
       FROM organization.head_company
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, code
     HAVING count(*) > 1',
    'organization.head_company.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, credit_code
       FROM organization.head_company
      WHERE status <> ''VOIDED'' AND credit_code IS NOT NULL
      GROUP BY workspace_uuid, group_workspace_key, credit_code
     HAVING count(*) > 1',
    'organization.head_company.credit_code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, lower(btrim(name))
       FROM organization.head_company
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, lower(btrim(name))
     HAVING count(*) > 1',
    'organization.head_company.name'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, code
       FROM organization.store
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, code
     HAVING count(*) > 1',
    'organization.store.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, lower(btrim(name))
       FROM organization.store
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, lower(btrim(name))
     HAVING count(*) > 1',
    'organization.store.name'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, name
       FROM workspace_iam.workspace_role
      WHERE status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, name
     HAVING count(*) > 1',
    'workspace_iam.workspace_role.name'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, project_ref, template_code
       FROM business_channel.business_channel_template
      WHERE template_code IS NOT NULL AND status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, project_ref, template_code
     HAVING count(*) > 1',
    'business_channel.business_channel_template.template_code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT workspace_uuid, group_workspace_key, channel_code
       FROM business_channel.business_channel
      WHERE channel_code IS NOT NULL AND status <> ''VOIDED''
      GROUP BY workspace_uuid, group_workspace_key, channel_code
     HAVING count(*) > 1',
    'business_channel.business_channel.channel_code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT data_node_ref, brand_ref, code
       FROM catalog.catalog_category
      WHERE status <> ''VOIDED''
      GROUP BY data_node_ref, brand_ref, code
     HAVING count(*) > 1',
    'catalog.catalog_category.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT data_node_ref, brand_ref, code
       FROM catalog.catalog_attribute_definition
      WHERE status <> ''VOIDED''
      GROUP BY data_node_ref, brand_ref, code
     HAVING count(*) > 1',
    'catalog.catalog_attribute_definition.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT data_node_ref, brand_ref, code
       FROM catalog.catalog_order_option_definition
      WHERE status <> ''VOIDED''
      GROUP BY data_node_ref, brand_ref, code
     HAVING count(*) > 1',
    'catalog.catalog_order_option_definition.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT data_node_ref, brand_ref, code
       FROM catalog.unit_definition
      WHERE status <> ''VOIDED''
      GROUP BY data_node_ref, brand_ref, code
     HAVING count(*) > 1',
    'catalog.unit_definition.code'
);
SELECT pg_temp.base1_assert_no_duplicate(
    'SELECT order_option_definition_ref, code
       FROM catalog.catalog_order_option_definition_value
      GROUP BY order_option_definition_ref, code
     HAVING count(*) > 1',
    'catalog.catalog_order_option_definition_value.parent_code'
);

CREATE UNIQUE INDEX ux_organization_node_active_code
    ON organization.organization_node (workspace_uuid, group_workspace_key, node_type, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_brand_active_code
    ON organization.brand (workspace_uuid, group_workspace_key, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_brand_active_name
    ON organization.brand (workspace_uuid, group_workspace_key, lower(btrim(name)))
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_tenant_active_code
    ON organization.tenant (workspace_uuid, group_workspace_key, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_tenant_active_credit_code
    ON organization.tenant (workspace_uuid, group_workspace_key, credit_code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_tenant_active_name
    ON organization.tenant (workspace_uuid, group_workspace_key, lower(btrim(name)))
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_head_company_active_code
    ON organization.head_company (workspace_uuid, group_workspace_key, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_head_company_active_credit_code
    ON organization.head_company (workspace_uuid, group_workspace_key, credit_code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_head_company_active_name
    ON organization.head_company (workspace_uuid, group_workspace_key, lower(btrim(name)))
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_store_active_code
    ON organization.store (workspace_uuid, group_workspace_key, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_store_active_name
    ON organization.store (workspace_uuid, group_workspace_key, lower(btrim(name)))
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_workspace_role_active_name
    ON workspace_iam.workspace_role (workspace_uuid, group_workspace_key, name)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_business_channel_template_active_project_code
    ON business_channel.business_channel_template (workspace_uuid, group_workspace_key, project_ref, template_code)
    WHERE template_code IS NOT NULL AND status <> 'VOIDED';
CREATE UNIQUE INDEX ux_business_channel_active_group_code
    ON business_channel.business_channel (workspace_uuid, group_workspace_key, channel_code)
    WHERE channel_code IS NOT NULL AND status <> 'VOIDED';
CREATE UNIQUE INDEX ux_catalog_category_active_code
    ON catalog.catalog_category (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_catalog_attribute_definition_active_code
    ON catalog.catalog_attribute_definition (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_catalog_order_option_definition_active_code
    ON catalog.catalog_order_option_definition (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';
CREATE UNIQUE INDEX ux_catalog_unit_definition_active_code
    ON catalog.unit_definition (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';

ALTER TABLE catalog.catalog_order_option_definition_value
    ADD CONSTRAINT uq_catalog_order_option_definition_value_parent_code
    UNIQUE (order_option_definition_ref, code);

ALTER TABLE organization.organization_node DROP CONSTRAINT uq_organization_node_code;
ALTER TABLE organization.brand DROP CONSTRAINT uq_brand_code;
DROP INDEX organization.uq_brand_normalized_name;
ALTER TABLE organization.tenant DROP CONSTRAINT uq_tenant_code;
ALTER TABLE organization.tenant DROP CONSTRAINT uq_tenant_credit_code;
DROP INDEX organization.uq_tenant_normalized_name;
ALTER TABLE organization.head_company DROP CONSTRAINT uq_head_company_code;
ALTER TABLE organization.head_company DROP CONSTRAINT uq_head_company_credit_code;
DROP INDEX organization.uq_head_company_normalized_name;
ALTER TABLE organization.store DROP CONSTRAINT uq_store_code;
DROP INDEX organization.uq_store_normalized_name;
ALTER TABLE workspace_iam.workspace_role DROP CONSTRAINT uq_workspace_role_name;
DROP INDEX business_channel.uq_business_channel_template_project_code;
DROP INDEX business_channel.uq_business_channel_group_channel_code;
ALTER TABLE catalog.catalog_category DROP CONSTRAINT catalog_category_data_node_ref_brand_ref_code_key;
ALTER TABLE catalog.catalog_attribute_definition DROP CONSTRAINT catalog_attribute_definition_data_node_ref_brand_ref_code_key;
DROP INDEX catalog.ix_catalog_attribute_definition_scope_code;
ALTER TABLE catalog.catalog_order_option_definition DROP CONSTRAINT uq_catalog_order_option_definition_scope_code;
DROP INDEX catalog.ix_catalog_order_option_definition_scope_code;
ALTER TABLE catalog.unit_definition DROP CONSTRAINT unit_definition_data_node_ref_brand_ref_code_key;
ALTER TABLE catalog.catalog_order_option_definition_value DROP CONSTRAINT uq_catalog_order_option_definition_value_scope_code;

DROP INDEX catalog.ux_catalog_sku_default_per_item;
CREATE UNIQUE INDEX ux_catalog_sku_default_per_item
    ON catalog.catalog_sku (item_ref)
    WHERE is_default AND status <> 'VOIDED';

DROP INDEX catalog.ux_catalog_sku_variant_digest_per_item;
CREATE UNIQUE INDEX ux_catalog_sku_variant_digest_per_item
    ON catalog.catalog_sku (item_ref, variant_combination_digest)
    WHERE status <> 'VOIDED';
