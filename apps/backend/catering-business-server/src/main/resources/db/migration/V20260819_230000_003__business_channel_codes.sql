-- User-entered business-channel identities. Existing legacy rows remain readable; all new writes require codes.
ALTER TABLE business_channel.business_channel_template
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(240);

ALTER TABLE business_channel.business_channel
    ADD COLUMN IF NOT EXISTS channel_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_channel_template_project_code
    ON business_channel.business_channel_template (workspace_uuid, group_workspace_key, project_ref, template_code)
    WHERE template_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_channel_group_channel_code
    ON business_channel.business_channel (workspace_uuid, group_workspace_key, channel_code)
    WHERE channel_code IS NOT NULL;
