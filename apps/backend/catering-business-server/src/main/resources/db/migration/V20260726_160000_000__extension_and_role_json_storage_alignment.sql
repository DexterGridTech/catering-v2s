-- R5 storage alignment: retain only the JSONB shapes proven by the accepted v2 heritage.
DO $$
DECLARE
    row_count BIGINT;
BEGIN
    SELECT count(*) INTO row_count FROM extension.extension_definition_field;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_EXTENSION_DEFINITION_FIELD_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM organization.brand_extension_value;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_BRAND_EXTENSION_VALUE_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM organization.tenant_extension_value;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_EXTENSION_VALUE_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM organization.head_company_extension_value;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_EXTENSION_VALUE_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM organization.store_extension_value;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_STORE_EXTENSION_VALUE_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM contract.store_contract_extension_value;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_STORE_CONTRACT_EXTENSION_VALUE_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM workspace_iam.role_capability;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_ROLE_CAPABILITY_NOT_EMPTY', DETAIL = row_count::text; END IF;
    SELECT count(*) INTO row_count FROM workspace_iam.role_page_access;
    IF row_count <> 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_ROLE_PAGE_ACCESS_NOT_EMPTY', DETAIL = row_count::text; END IF;
END $$;

ALTER TABLE organization.brand
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_brand_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object');
ALTER TABLE organization.tenant
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_tenant_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object');
ALTER TABLE organization.head_company
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_head_company_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object');
ALTER TABLE organization.store
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_store_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object');
ALTER TABLE contract.store_contract
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_store_contract_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object');

ALTER TABLE workspace_iam.workspace_role
    ADD COLUMN capability_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN page_access_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT ck_workspace_role_capability_keys_array CHECK (jsonb_typeof(capability_keys) = 'array'),
    ADD CONSTRAINT ck_workspace_role_page_access_keys_array CHECK (jsonb_typeof(page_access_keys) = 'array');

DROP TABLE extension.extension_definition_field;
DROP TABLE organization.brand_extension_value;
DROP TABLE organization.tenant_extension_value;
DROP TABLE organization.head_company_extension_value;
DROP TABLE organization.store_extension_value;
DROP TABLE contract.store_contract_extension_value;
DROP TABLE workspace_iam.role_capability;
DROP TABLE workspace_iam.role_page_access;

ALTER TABLE extension.extension_definition
    ADD COLUMN definitions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE extension.extension_definition
    DROP CONSTRAINT extension_definition_pkey,
    DROP CONSTRAINT uq_extension_host,
    DROP COLUMN id,
    DROP COLUMN workspace_uuid,
    DROP COLUMN created_at_epoch_millis;
ALTER TABLE extension.extension_definition RENAME COLUMN host_type TO entity_type;
ALTER TABLE extension.extension_definition RENAME COLUMN version TO revision;
ALTER TABLE extension.extension_definition
    ADD CONSTRAINT extension_definition_pkey PRIMARY KEY (group_workspace_key, entity_type),
    ADD CONSTRAINT ck_extension_definition_definitions_array CHECK (jsonb_typeof(definitions) = 'array'),
    ADD CONSTRAINT ck_extension_definition_revision_positive CHECK (revision > 0);
