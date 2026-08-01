-- An idempotency receipt is claimed before a first extension definition exists.
-- The receipt retains its workspace/type scope and replay identity, but cannot FK a row that its
-- own command creates afterwards. Existing definition/workspace constraints remain unchanged.
ALTER TABLE extension.extension_command_receipt
    DROP CONSTRAINT fk_extension_receipt_definition;
