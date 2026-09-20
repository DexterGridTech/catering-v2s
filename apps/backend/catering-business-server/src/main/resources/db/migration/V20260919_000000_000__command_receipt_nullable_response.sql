-- R-3.2: a historical command claim may legitimately have no response payload.
-- Keep receipt ownership and DML in each owner; this migration only removes the
-- schema-level prohibition that made a claim-only replay look corrupt.
ALTER TABLE platform_iam.platform_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE platform_workspace.workspace_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE platform_asset.asset_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE extension.extension_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE organization.organization_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE workspace_iam.workspace_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE contract.contract_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE organization.commercial_group_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE collaboration.command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE business_channel.command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

-- Normalize the remaining owner-local payload column names without changing their owner tables or keys.
ALTER TABLE catalog.command_receipt
    RENAME COLUMN response TO response_json;
ALTER TABLE catalog.command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE inventory.command_receipt
    RENAME COLUMN response TO response_json;
ALTER TABLE inventory.command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE fulfillment_production.command_receipt
    RENAME COLUMN response TO response_json;
ALTER TABLE fulfillment_production.command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

ALTER TABLE sales_menu.sales_command_receipt
    RENAME COLUMN readback_json TO response_json;
ALTER TABLE sales_menu.sales_command_receipt
    ALTER COLUMN response_json DROP NOT NULL;

-- Store service-point commands historically had claim identity only.  Keep that history and give future claims the
-- same nullable response_json slot; no production backfill is implied.
ALTER TABLE organization.store_service_point_command_receipt
    ADD COLUMN response_json JSONB;
