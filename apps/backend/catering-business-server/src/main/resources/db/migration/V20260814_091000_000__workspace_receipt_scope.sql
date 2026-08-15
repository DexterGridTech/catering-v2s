-- A platform administrator is global, but every workspace command receipt is
-- still owned by exactly one logical workspace key. Scope the key and lock to it.
ALTER TABLE platform_workspace.workspace_command_receipt
    ADD COLUMN group_workspace_key VARCHAR(64);

UPDATE platform_workspace.workspace_command_receipt
   SET group_workspace_key = convert_from(decode(response_json ->> 'groupWorkspaceKey', 'base64'), 'UTF8')
 WHERE group_workspace_key IS NULL;

ALTER TABLE platform_workspace.workspace_command_receipt
    ALTER COLUMN group_workspace_key SET NOT NULL,
    DROP CONSTRAINT workspace_command_receipt_pkey,
    ADD CONSTRAINT workspace_command_receipt_pkey PRIMARY KEY (group_workspace_key, idempotency_key);
