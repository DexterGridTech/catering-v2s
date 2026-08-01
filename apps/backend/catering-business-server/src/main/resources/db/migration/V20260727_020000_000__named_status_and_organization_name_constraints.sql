-- CR04 named invariants for active runtime-owned state machines.
DO $$
DECLARE offender_ids TEXT;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM platform_workspace.group_workspace WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_GROUP_WORKSPACE_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM platform_iam.platform_admin WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_PLATFORM_ADMIN_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(asset_ref::text, ',' ORDER BY asset_ref::text) INTO offender_ids FROM platform_asset.staged_asset WHERE status NOT IN ('STAGED','ACTIVE','RELEASED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_PLATFORM_ASSET_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.organization_node WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_ORGANIZATION_NODE_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.brand WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_BRAND_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.tenant WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_TENANT_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.head_company WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_HEAD_COMPANY_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM organization.store WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_STORE_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM workspace_iam.workspace_account WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_WORKSPACE_ACCOUNT_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM workspace_iam.workspace_role WHERE status NOT IN ('ENABLED','DISABLED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_WORKSPACE_ROLE_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM workspace_iam.role_assignment WHERE status NOT IN ('ACTIVE','REVOKED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_ROLE_ASSIGNMENT_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM workspace_iam.invitation WHERE status NOT IN ('PENDING','CONSENTED','COMPLETED','CANCELLED','EXPIRED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_INVITATION_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM workspace_iam.workspace_session WHERE status NOT IN ('ACTIVE','REVOKED');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_WORKSPACE_SESSION_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids FROM contract.store_contract WHERE status NOT IN ('ACTIVE','INVALID');
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_STORE_CONTRACT_STATUS_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
END $$;

ALTER TABLE platform_workspace.group_workspace DROP CONSTRAINT IF EXISTS group_workspace_status_check;
ALTER TABLE platform_workspace.group_workspace ADD CONSTRAINT ck_group_workspace_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE platform_iam.platform_admin DROP CONSTRAINT IF EXISTS platform_admin_status_check;
ALTER TABLE platform_iam.platform_admin ADD CONSTRAINT ck_platform_admin_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE platform_asset.staged_asset ADD CONSTRAINT ck_staged_asset_status CHECK (status IN ('STAGED','ACTIVE','RELEASED'));
ALTER TABLE organization.organization_node ADD CONSTRAINT ck_organization_node_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE organization.brand ADD CONSTRAINT ck_brand_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE organization.tenant ADD CONSTRAINT ck_tenant_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE organization.head_company ADD CONSTRAINT ck_head_company_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE organization.store ADD CONSTRAINT ck_store_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE workspace_iam.workspace_account ADD CONSTRAINT ck_workspace_account_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE workspace_iam.workspace_role ADD CONSTRAINT ck_workspace_role_status CHECK (status IN ('ENABLED','DISABLED'));
ALTER TABLE workspace_iam.role_assignment ADD CONSTRAINT ck_role_assignment_status CHECK (status IN ('ACTIVE','REVOKED'));
ALTER TABLE workspace_iam.invitation ADD CONSTRAINT ck_invitation_status CHECK (status IN ('PENDING','CONSENTED','COMPLETED','CANCELLED','EXPIRED'));
ALTER TABLE workspace_iam.workspace_session ADD CONSTRAINT ck_workspace_session_status CHECK (status IN ('ACTIVE','REVOKED'));
ALTER TABLE contract.store_contract DROP CONSTRAINT IF EXISTS store_contract_status_check;
ALTER TABLE contract.store_contract ADD CONSTRAINT ck_store_contract_status CHECK (status IN ('ACTIVE','INVALID'));

DO $$
DECLARE offender_ids TEXT;
BEGIN
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids
      FROM (
        SELECT id FROM organization.tenant WHERE btrim(name)=''
        UNION SELECT id FROM organization.head_company WHERE btrim(name)=''
        UNION SELECT id FROM organization.store WHERE btrim(name)=''
      ) invalid;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_ORGANIZATION_NAME_BLANK_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
    SELECT string_agg(id::text, ',' ORDER BY id::text) INTO offender_ids
      FROM (
        SELECT id FROM organization.tenant WHERE (workspace_uuid,group_workspace_key,lower(btrim(name))) IN (SELECT workspace_uuid,group_workspace_key,lower(btrim(name)) FROM organization.tenant GROUP BY 1,2,3 HAVING count(*)>1)
        UNION SELECT id FROM organization.head_company WHERE (workspace_uuid,group_workspace_key,lower(btrim(name))) IN (SELECT workspace_uuid,group_workspace_key,lower(btrim(name)) FROM organization.head_company GROUP BY 1,2,3 HAVING count(*)>1)
        UNION SELECT id FROM organization.store WHERE (workspace_uuid,group_workspace_key,lower(btrim(name))) IN (SELECT workspace_uuid,group_workspace_key,lower(btrim(name)) FROM organization.store GROUP BY 1,2,3 HAVING count(*)>1)
      ) duplicates;
    IF offender_ids IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='R5_ORGANIZATION_NAME_DUPLICATE_PRECONDITION_FAILED', DETAIL=offender_ids; END IF;
END $$;

ALTER TABLE organization.brand ADD CONSTRAINT ck_brand_name_non_blank CHECK (btrim(name)<>'');
ALTER TABLE organization.tenant ADD CONSTRAINT ck_tenant_name_non_blank CHECK (btrim(name)<>'');
ALTER TABLE organization.head_company ADD CONSTRAINT ck_head_company_name_non_blank CHECK (btrim(name)<>'');
ALTER TABLE organization.store ADD CONSTRAINT ck_store_name_non_blank CHECK (btrim(name)<>'');
CREATE UNIQUE INDEX uq_tenant_normalized_name ON organization.tenant(workspace_uuid,group_workspace_key,lower(btrim(name)));
CREATE UNIQUE INDEX uq_head_company_normalized_name ON organization.head_company(workspace_uuid,group_workspace_key,lower(btrim(name)));
CREATE UNIQUE INDEX uq_store_normalized_name ON organization.store(workspace_uuid,group_workspace_key,lower(btrim(name)));

ALTER TABLE extension.extension_definition DROP CONSTRAINT IF EXISTS extension_definition_version_check;
