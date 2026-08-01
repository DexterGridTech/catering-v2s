-- R5 correction pack: persist only facts already required by frozen owner contracts.
ALTER TABLE organization.brand
    ADD COLUMN alias VARCHAR(120),
    ADD COLUMN remark VARCHAR(2000),
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0 CONSTRAINT ck_brand_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);

ALTER TABLE organization.tenant
    ADD COLUMN remark VARCHAR(2000),
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0 CONSTRAINT ck_tenant_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);

ALTER TABLE organization.head_company
    ADD COLUMN remark VARCHAR(2000),
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0 CONSTRAINT ck_head_company_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);

ALTER TABLE organization.store
    ADD COLUMN notes VARCHAR(2000),
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0 CONSTRAINT ck_store_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);

ALTER TABLE contract.store_contract
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0 CONSTRAINT ck_store_contract_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);

-- Typed upgrade preconditions intentionally stop before constraints and identify every offending row.
DO $$
DECLARE
    offender_ids TEXT;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE legal_name IS NULL;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_LEGAL_NAME_NULL', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE btrim(legal_name) = '';
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_LEGAL_NAME_BLANK', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE credit_code IS NULL;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_CREDIT_CODE_NULL', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE btrim(credit_code) = '';
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_CREDIT_CODE_BLANK', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE length(credit_code) > 32;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_CREDIT_CODE_TOO_LONG', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE credit_code IS NOT NULL AND (workspace_uuid, group_workspace_key, credit_code) IN (SELECT workspace_uuid, group_workspace_key, credit_code FROM organization.tenant WHERE credit_code IS NOT NULL GROUP BY workspace_uuid, group_workspace_key, credit_code HAVING count(*) > 1);
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_TENANT_CREDIT_CODE_DUPLICATE', DETAIL = offender_ids; END IF;

    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE legal_name IS NULL;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_LEGAL_NAME_NULL', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE btrim(legal_name) = '';
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_LEGAL_NAME_BLANK', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE credit_code IS NULL;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_CREDIT_CODE_NULL', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE btrim(credit_code) = '';
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_CREDIT_CODE_BLANK', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE length(credit_code) > 32;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_CREDIT_CODE_TOO_LONG', DETAIL = offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE credit_code IS NOT NULL AND (workspace_uuid, group_workspace_key, credit_code) IN (SELECT workspace_uuid, group_workspace_key, credit_code FROM organization.head_company WHERE credit_code IS NOT NULL GROUP BY workspace_uuid, group_workspace_key, credit_code HAVING count(*) > 1);
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'R5_HEAD_COMPANY_CREDIT_CODE_DUPLICATE', DETAIL = offender_ids; END IF;
END $$;

ALTER TABLE organization.tenant
    ALTER COLUMN legal_name SET NOT NULL,
    ALTER COLUMN credit_code TYPE VARCHAR(32),
    ALTER COLUMN credit_code SET NOT NULL,
    ADD CONSTRAINT ck_tenant_legal_name_not_blank CHECK (btrim(legal_name) <> ''),
    ADD CONSTRAINT ck_tenant_credit_code_not_blank CHECK (btrim(credit_code) <> ''),
    ADD CONSTRAINT uq_tenant_credit_code UNIQUE (workspace_uuid, group_workspace_key, credit_code);

ALTER TABLE organization.head_company
    ALTER COLUMN legal_name SET NOT NULL,
    ALTER COLUMN credit_code TYPE VARCHAR(32),
    ALTER COLUMN credit_code SET NOT NULL,
    ADD CONSTRAINT ck_head_company_legal_name_not_blank CHECK (btrim(legal_name) <> ''),
    ADD CONSTRAINT ck_head_company_credit_code_not_blank CHECK (btrim(credit_code) <> ''),
    ADD CONSTRAINT uq_head_company_credit_code UNIQUE (workspace_uuid, group_workspace_key, credit_code);
