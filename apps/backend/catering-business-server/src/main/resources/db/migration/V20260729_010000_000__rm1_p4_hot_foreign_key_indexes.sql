-- RM1 P4: indexes are limited to the seven foreign-key access paths proven by current owner reads.
CREATE INDEX ix_workspace_role_assignment_account ON workspace_iam.role_assignment (account_id);
CREATE INDEX ix_workspace_role_assignment_service_node ON workspace_iam.role_assignment (service_node_type, service_node_id);
CREATE INDEX ix_contract_store_contract_store ON contract.store_contract (store_id);
CREATE INDEX ix_organization_store_project ON organization.store (project_id);
CREATE INDEX ix_organization_store_head_company ON organization.store (head_company_id);
CREATE INDEX ix_workspace_password_reset_account ON workspace_iam.password_reset (account_id);
CREATE INDEX ix_platform_session_platform_admin ON platform_iam.platform_session (platform_admin_id);
