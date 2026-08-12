-- M-03: receipt identity follows its owner isolation boundary.  Historical asset
-- receipts remain explicitly LEGACY because release rows do not encode whether the
-- original command was scoped staging release or globally shared active release.

ALTER TABLE contract.contract_command_receipt
    ADD COLUMN workspace_uuid UUID;

UPDATE contract.contract_command_receipt receipt
   SET workspace_uuid = contract.workspace_uuid
  FROM contract.store_contract contract
 WHERE contract.id = receipt.contract_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM contract.contract_command_receipt
         WHERE workspace_uuid IS NULL
    ) THEN
        RAISE EXCEPTION 'CONTRACT_RECEIPT_WORKSPACE_BACKFILL_FAILED';
    END IF;
END $$;

ALTER TABLE contract.contract_command_receipt
    ALTER COLUMN workspace_uuid SET NOT NULL,
    DROP CONSTRAINT contract_command_receipt_pkey,
    ADD PRIMARY KEY (workspace_uuid, idempotency_key);

ALTER TABLE platform_asset.asset_command_receipt
    ADD COLUMN scope_key VARCHAR(48) NOT NULL DEFAULT 'legacy';

ALTER TABLE platform_asset.asset_command_receipt
    DROP CONSTRAINT asset_command_receipt_pkey,
    ADD PRIMARY KEY (scope_key, idempotency_key);
