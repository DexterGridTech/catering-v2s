-- R5 additive migration. R3 history remains immutable; legacy bigint/revision/timestamp columns stay transitional.
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT count(*) INTO policy_count
      FROM pg_policies
     WHERE schemaname IN ('platform_workspace', 'organization')
       AND policyname IN (
           'platform_admin_group_workspace_access',
           'platform_admin_commercial_group_access',
           'platform_admin_commercial_group_audit_access',
           'platform_admin_commercial_group_idempotency_access');
    IF policy_count <> 4 THEN
        RAISE EXCEPTION 'R5_R3_POLICY_PRECONDITION_FAILED: expected 4 policies, got %', policy_count;
    END IF;
    IF EXISTS (
        SELECT 1 FROM platform_workspace.group_workspace WHERE length(group_workspace_key) > 64
    ) THEN
        RAISE EXCEPTION 'R5_GROUP_WORKSPACE_KEY_LENGTH_PRECONDITION_FAILED';
    END IF;
END $$;

ALTER TABLE platform_workspace.group_workspace
    ADD COLUMN workspace_uuid UUID,
    ADD COLUMN name_normalized VARCHAR(200),
    ADD COLUMN operations_title VARCHAR(120),
    ADD COLUMN logo_asset_ref VARCHAR(128),
    ADD COLUMN notes VARCHAR(2000),
    ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD COLUMN created_at_epoch_millis BIGINT,
    ADD COLUMN updated_at_epoch_millis BIGINT,
    ADD COLUMN status_changed_at_epoch_millis BIGINT;
UPDATE platform_workspace.group_workspace
   SET workspace_uuid = md5('group-workspace:' || id::text)::uuid,
       name_normalized = lower(trim(name)),
       operations_title = name,
       version = revision,
       created_at_epoch_millis = floor(extract(epoch FROM created_at) * 1000)::BIGINT,
       updated_at_epoch_millis = floor(extract(epoch FROM created_at) * 1000)::BIGINT,
       status_changed_at_epoch_millis = floor(extract(epoch FROM created_at) * 1000)::BIGINT;
ALTER TABLE platform_workspace.group_workspace
    ALTER COLUMN workspace_uuid SET NOT NULL,
    ALTER COLUMN name_normalized SET NOT NULL,
    ALTER COLUMN created_at_epoch_millis SET NOT NULL,
    ALTER COLUMN updated_at_epoch_millis SET NOT NULL,
    ALTER COLUMN status_changed_at_epoch_millis SET NOT NULL,
    ALTER COLUMN group_workspace_key TYPE VARCHAR(64);
ALTER TABLE platform_workspace.group_workspace
    ADD CONSTRAINT uq_group_workspace_uuid_key UNIQUE (workspace_uuid, group_workspace_key),
    ADD CONSTRAINT uq_group_workspace_name_normalized UNIQUE (name_normalized);

ALTER TABLE organization.commercial_group
    ADD COLUMN commercial_group_uuid UUID,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD COLUMN created_at_epoch_millis BIGINT;
UPDATE organization.commercial_group
   SET commercial_group_uuid = md5('commercial-group:' || id::text)::uuid,
       version = revision,
       created_at_epoch_millis = floor(extract(epoch FROM created_at) * 1000)::BIGINT;
ALTER TABLE organization.commercial_group
    ALTER COLUMN commercial_group_uuid SET NOT NULL,
    ALTER COLUMN created_at_epoch_millis SET NOT NULL,
    ADD CONSTRAINT uq_commercial_group_uuid UNIQUE (commercial_group_uuid);

ALTER TABLE platform_workspace.group_workspace DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_workspace.group_workspace NO FORCE ROW LEVEL SECURITY;
DROP POLICY platform_admin_group_workspace_access ON platform_workspace.group_workspace;
ALTER TABLE organization.commercial_group DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization.commercial_group NO FORCE ROW LEVEL SECURITY;
DROP POLICY platform_admin_commercial_group_access ON organization.commercial_group;
ALTER TABLE organization.commercial_group_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization.commercial_group_audit NO FORCE ROW LEVEL SECURITY;
DROP POLICY platform_admin_commercial_group_audit_access ON organization.commercial_group_audit;
ALTER TABLE organization.commercial_group_idempotency DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization.commercial_group_idempotency NO FORCE ROW LEVEL SECURITY;
DROP POLICY platform_admin_commercial_group_idempotency_access ON organization.commercial_group_idempotency;

CREATE SCHEMA platform_iam;
CREATE SCHEMA platform_asset;
CREATE SCHEMA extension;
CREATE SCHEMA workspace_iam;
CREATE SCHEMA contract;

CREATE TABLE platform_iam.platform_admin (
    id UUID PRIMARY KEY, login_name VARCHAR(64) NOT NULL, login_name_normalized VARCHAR(64) NOT NULL,
    display_name VARCHAR(120) NOT NULL, mobile_mask_source VARCHAR(32), status VARCHAR(16) NOT NULL CHECK (status IN ('ENABLED','DISABLED')),
    version BIGINT NOT NULL CHECK (version > 0), created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_platform_admin_login UNIQUE (login_name_normalized)
);
CREATE TABLE platform_iam.platform_credential (
    platform_admin_id UUID PRIMARY KEY REFERENCES platform_iam.platform_admin(id) ON DELETE RESTRICT,
    password_hash VARCHAR(255) NOT NULL, algorithm VARCHAR(64) NOT NULL, changed_at_epoch_millis BIGINT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0), locked_until_epoch_millis BIGINT, version BIGINT NOT NULL CHECK (version > 0)
);
CREATE TABLE platform_iam.platform_session (
    id UUID PRIMARY KEY, platform_admin_id UUID NOT NULL REFERENCES platform_iam.platform_admin(id) ON DELETE RESTRICT,
    token_hash CHAR(64) NOT NULL UNIQUE, status VARCHAR(16) NOT NULL, expires_at_epoch_millis BIGINT NOT NULL,
    created_at_epoch_millis BIGINT NOT NULL, last_seen_at_epoch_millis BIGINT, revoked_at_epoch_millis BIGINT, version BIGINT NOT NULL CHECK (version > 0)
);
CREATE TABLE platform_iam.platform_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE platform_iam.platform_audit (id UUID PRIMARY KEY, event_type VARCHAR(96) NOT NULL, subject_ref UUID, created_at_epoch_millis BIGINT NOT NULL, detail_json JSONB NOT NULL);

CREATE TABLE platform_asset.staged_asset (
    asset_ref UUID PRIMARY KEY, usage VARCHAR(64) NOT NULL, workspace_uuid UUID, group_workspace_key VARCHAR(64), storage_key VARCHAR(512) NOT NULL UNIQUE,
    content_type VARCHAR(160) NOT NULL, size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0), sha256 CHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL, expires_at_epoch_millis BIGINT, claimed_by_type VARCHAR(64), claimed_by_id UUID,
    created_at_epoch_millis BIGINT NOT NULL, activated_at_epoch_millis BIGINT, released_at_epoch_millis BIGINT, version BIGINT NOT NULL CHECK (version > 0),
    CONSTRAINT fk_asset_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);
CREATE TABLE platform_asset.asset_cleanup (asset_ref UUID PRIMARY KEY REFERENCES platform_asset.staged_asset(asset_ref) ON DELETE RESTRICT, reason VARCHAR(240) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error_code VARCHAR(128), next_attempt_at_epoch_millis BIGINT, completed_at_epoch_millis BIGINT);

CREATE TABLE extension.extension_definition (
    id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, host_type VARCHAR(32) NOT NULL,
    version BIGINT NOT NULL CHECK (version > 0), created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL,
    CONSTRAINT uq_extension_host UNIQUE (workspace_uuid, group_workspace_key, host_type),
    CONSTRAINT fk_extension_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key)
);
CREATE TABLE extension.extension_definition_field (definition_id UUID NOT NULL REFERENCES extension.extension_definition(id) ON DELETE RESTRICT, field_key VARCHAR(64) NOT NULL, label VARCHAR(120) NOT NULL, field_type VARCHAR(32) NOT NULL, required BOOLEAN NOT NULL, display_order INTEGER NOT NULL, config_json JSONB NOT NULL, PRIMARY KEY (definition_id, field_key));

CREATE TABLE organization.organization_node (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, parent_id UUID, node_type VARCHAR(16) NOT NULL CHECK (node_type IN ('GROUP','REGION','PROJECT')), code VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, phase_names JSONB NOT NULL DEFAULT '[]', status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_organization_node_code UNIQUE (workspace_uuid, group_workspace_key, node_type, code), CONSTRAINT fk_organization_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE organization.project_phase_name (project_id UUID NOT NULL REFERENCES organization.organization_node(id) ON DELETE RESTRICT, phase_name VARCHAR(120) NOT NULL, display_order INTEGER NOT NULL CHECK (display_order >= 0), PRIMARY KEY(project_id, phase_name), UNIQUE(project_id, display_order));
CREATE TABLE organization.brand (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, code VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_brand_code UNIQUE (workspace_uuid, group_workspace_key, code), CONSTRAINT fk_brand_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE organization.tenant (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, code VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, legal_name VARCHAR(240), credit_code VARCHAR(64), status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_tenant_code UNIQUE (workspace_uuid, group_workspace_key, code), CONSTRAINT fk_tenant_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE organization.head_company (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, code VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, legal_name VARCHAR(240), credit_code VARCHAR(64), status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_head_company_code UNIQUE (workspace_uuid, group_workspace_key, code), CONSTRAINT fk_head_company_workspace FOREIGN KEY (workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE organization.head_company_brand_authorization (head_company_id UUID NOT NULL REFERENCES organization.head_company(id) ON DELETE RESTRICT, brand_id UUID NOT NULL REFERENCES organization.brand(id) ON DELETE RESTRICT, authorized_at_epoch_millis BIGINT NOT NULL, PRIMARY KEY(head_company_id, brand_id));
CREATE TABLE organization.store (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, project_id UUID NOT NULL REFERENCES organization.organization_node(id) ON DELETE RESTRICT, tenant_id UUID NOT NULL REFERENCES organization.tenant(id) ON DELETE RESTRICT, brand_id UUID NOT NULL REFERENCES organization.brand(id) ON DELETE RESTRICT, head_company_id UUID REFERENCES organization.head_company(id) ON DELETE RESTRICT, code VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_store_code UNIQUE(workspace_uuid, group_workspace_key, code), CONSTRAINT fk_store_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
ALTER TABLE organization.organization_node ADD CONSTRAINT uq_organization_node_workspace_ref UNIQUE (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.brand ADD CONSTRAINT uq_brand_workspace_ref UNIQUE (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.tenant ADD CONSTRAINT uq_tenant_workspace_ref UNIQUE (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.head_company ADD CONSTRAINT uq_head_company_workspace_ref UNIQUE (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.store ADD CONSTRAINT fk_store_project_workspace FOREIGN KEY (project_id, workspace_uuid, group_workspace_key) REFERENCES organization.organization_node (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.store ADD CONSTRAINT fk_store_tenant_workspace FOREIGN KEY (tenant_id, workspace_uuid, group_workspace_key) REFERENCES organization.tenant (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.store ADD CONSTRAINT fk_store_brand_workspace FOREIGN KEY (brand_id, workspace_uuid, group_workspace_key) REFERENCES organization.brand (id, workspace_uuid, group_workspace_key);
ALTER TABLE organization.store ADD CONSTRAINT fk_store_head_company_workspace FOREIGN KEY (head_company_id, workspace_uuid, group_workspace_key) REFERENCES organization.head_company (id, workspace_uuid, group_workspace_key);

CREATE TABLE workspace_iam.workspace_account (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, mobile_normalized VARCHAR(32) NOT NULL, login_name_normalized VARCHAR(120) NOT NULL, display_name VARCHAR(120) NOT NULL, status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_workspace_mobile UNIQUE(workspace_uuid, group_workspace_key, mobile_normalized), CONSTRAINT uq_workspace_login UNIQUE(workspace_uuid, group_workspace_key, login_name_normalized), CONSTRAINT fk_account_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE workspace_iam.workspace_role (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, service_node_type VARCHAR(32) NOT NULL, description VARCHAR(500), status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, CONSTRAINT uq_workspace_role_name UNIQUE(workspace_uuid, group_workspace_key, name), CONSTRAINT fk_role_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE workspace_iam.role_page_access (role_id UUID NOT NULL REFERENCES workspace_iam.workspace_role(id) ON DELETE RESTRICT, page_design_key VARCHAR(120) NOT NULL, PRIMARY KEY(role_id, page_design_key));
CREATE TABLE workspace_iam.role_capability (role_id UUID NOT NULL REFERENCES workspace_iam.workspace_role(id) ON DELETE RESTRICT, capability_key VARCHAR(120) NOT NULL, PRIMARY KEY(role_id, capability_key));
CREATE TABLE workspace_iam.invitation (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, mobile_normalized VARCHAR(32) NOT NULL, status VARCHAR(32) NOT NULL, expires_at_epoch_millis BIGINT NOT NULL, version BIGINT NOT NULL, CONSTRAINT fk_invitation_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE workspace_iam.role_assignment (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, account_id UUID NOT NULL REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT, role_id UUID NOT NULL REFERENCES workspace_iam.workspace_role(id) ON DELETE RESTRICT, source_invitation_id UUID NOT NULL REFERENCES workspace_iam.invitation(id) ON DELETE RESTRICT, service_node_type VARCHAR(32) NOT NULL, service_node_id UUID NOT NULL, status VARCHAR(16) NOT NULL, version BIGINT NOT NULL, CONSTRAINT fk_assignment_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE workspace_iam.workspace_session (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, account_id UUID NOT NULL REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT, token_hash CHAR(64) NOT NULL UNIQUE, current_assignment_id UUID REFERENCES workspace_iam.role_assignment(id) ON DELETE RESTRICT, visible_data_node_id UUID, context_version BIGINT NOT NULL, authorization_revision BIGINT NOT NULL, status VARCHAR(16) NOT NULL, expires_at_epoch_millis BIGINT NOT NULL, revoked_at_epoch_millis BIGINT, CONSTRAINT fk_session_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));

CREATE TABLE contract.store_contract (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, contract_no VARCHAR(120) NOT NULL, store_id UUID NOT NULL REFERENCES organization.store(id) ON DELETE RESTRICT, tenant_id UUID NOT NULL REFERENCES organization.tenant(id) ON DELETE RESTRICT, effective_from DATE NOT NULL, effective_to DATE, phase_name_snapshot VARCHAR(120), notes VARCHAR(2000), status VARCHAR(16) NOT NULL CHECK(status IN ('ACTIVE','INVALID')), invalidated_at_epoch_millis BIGINT, version BIGINT NOT NULL, created_at_epoch_millis BIGINT NOT NULL, updated_at_epoch_millis BIGINT NOT NULL, CONSTRAINT uq_contract_no UNIQUE(workspace_uuid, group_workspace_key, contract_no), CONSTRAINT fk_contract_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE contract.store_contract_item (contract_id UUID NOT NULL REFERENCES contract.store_contract(id) ON DELETE RESTRICT, line_no INTEGER NOT NULL, item_code VARCHAR(120) NOT NULL, item_name VARCHAR(240) NOT NULL, PRIMARY KEY(contract_id, line_no), CONSTRAINT uq_contract_item_code UNIQUE(contract_id, item_code));

CREATE TABLE platform_iam.platform_credential_reset (id UUID PRIMARY KEY, platform_admin_id UUID NOT NULL REFERENCES platform_iam.platform_admin(id) ON DELETE RESTRICT, generation_key_hash CHAR(64) NOT NULL UNIQUE, status VARCHAR(32) NOT NULL, expires_at_epoch_millis BIGINT NOT NULL, completed_at_epoch_millis BIGINT, version BIGINT NOT NULL);
CREATE TABLE platform_workspace.workspace_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, workspace_uuid UUID, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE platform_workspace.workspace_audit (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, event_type VARCHAR(96) NOT NULL, detail_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE platform_asset.asset_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, asset_ref UUID, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE platform_asset.asset_audit (id UUID PRIMARY KEY, asset_ref UUID, event_type VARCHAR(96) NOT NULL, detail_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE extension.extension_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, definition_id UUID, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE extension.extension_audit (id UUID PRIMARY KEY, definition_id UUID, event_type VARCHAR(96) NOT NULL, detail_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE organization.brand_extension_value (brand_id UUID NOT NULL REFERENCES organization.brand(id) ON DELETE RESTRICT, field_key VARCHAR(64) NOT NULL, value_json JSONB NOT NULL, definition_version BIGINT NOT NULL, PRIMARY KEY (brand_id, field_key));
CREATE TABLE organization.tenant_extension_value (tenant_id UUID NOT NULL REFERENCES organization.tenant(id) ON DELETE RESTRICT, field_key VARCHAR(64) NOT NULL, value_json JSONB NOT NULL, definition_version BIGINT NOT NULL, PRIMARY KEY (tenant_id, field_key));
CREATE TABLE organization.head_company_extension_value (head_company_id UUID NOT NULL REFERENCES organization.head_company(id) ON DELETE RESTRICT, field_key VARCHAR(64) NOT NULL, value_json JSONB NOT NULL, definition_version BIGINT NOT NULL, PRIMARY KEY (head_company_id, field_key));
CREATE TABLE organization.store_extension_value (store_id UUID NOT NULL REFERENCES organization.store(id) ON DELETE RESTRICT, field_key VARCHAR(64) NOT NULL, value_json JSONB NOT NULL, definition_version BIGINT NOT NULL, PRIMARY KEY (store_id, field_key));
CREATE TABLE organization.organization_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, entity_id UUID, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE organization.organization_audit (id UUID PRIMARY KEY, entity_id UUID, event_type VARCHAR(96) NOT NULL, detail_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE workspace_iam.workspace_credential (account_id UUID PRIMARY KEY REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT, password_hash VARCHAR(255) NOT NULL, algorithm VARCHAR(64) NOT NULL, changed_at_epoch_millis BIGINT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until_epoch_millis BIGINT, version BIGINT NOT NULL);
CREATE TABLE workspace_iam.invitation_assignment_intent (invitation_id UUID NOT NULL REFERENCES workspace_iam.invitation(id) ON DELETE RESTRICT, role_id UUID NOT NULL REFERENCES workspace_iam.workspace_role(id) ON DELETE RESTRICT, service_node_type VARCHAR(32) NOT NULL, service_node_id UUID NOT NULL, PRIMARY KEY(invitation_id, role_id, service_node_id));
CREATE TABLE workspace_iam.otp_grant (id UUID PRIMARY KEY, workspace_uuid UUID NOT NULL, group_workspace_key VARCHAR(64) NOT NULL, purpose VARCHAR(64) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, subject_ref UUID, status VARCHAR(32) NOT NULL, expires_at_epoch_millis BIGINT NOT NULL, used_at_epoch_millis BIGINT, attempt_count INTEGER NOT NULL DEFAULT 0, CONSTRAINT fk_otp_workspace FOREIGN KEY(workspace_uuid, group_workspace_key) REFERENCES platform_workspace.group_workspace(workspace_uuid, group_workspace_key));
CREATE TABLE workspace_iam.password_reset (id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES workspace_iam.workspace_account(id) ON DELETE RESTRICT, generation_key_hash CHAR(64) NOT NULL UNIQUE, status VARCHAR(32) NOT NULL, expires_at_epoch_millis BIGINT NOT NULL, completed_at_epoch_millis BIGINT, version BIGINT NOT NULL);
CREATE TABLE workspace_iam.workspace_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE workspace_iam.workspace_audit (id UUID PRIMARY KEY, account_id UUID, event_type VARCHAR(96) NOT NULL, detail_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE contract.store_contract_extension_value (contract_id UUID NOT NULL REFERENCES contract.store_contract(id) ON DELETE RESTRICT, field_key VARCHAR(64) NOT NULL, value_json JSONB NOT NULL, definition_version BIGINT NOT NULL, PRIMARY KEY(contract_id, field_key));
CREATE TABLE contract.contract_command_receipt (idempotency_key VARCHAR(128) PRIMARY KEY, contract_id UUID, request_hash CHAR(64) NOT NULL, response_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
CREATE TABLE contract.contract_audit (id UUID PRIMARY KEY, contract_id UUID, event_type VARCHAR(96) NOT NULL, detail_json JSONB NOT NULL, created_at_epoch_millis BIGINT NOT NULL);
