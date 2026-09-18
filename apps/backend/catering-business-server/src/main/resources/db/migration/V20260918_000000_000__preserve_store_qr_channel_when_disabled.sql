-- A disabled QR configuration may retain its selected channel for a later re-enable.
-- Enabled configurations still require a channel; no persisted value is rewritten here.
ALTER TABLE organization.store_qr_configuration
    DROP CONSTRAINT ck_store_qr_configuration_enabled_channel;

ALTER TABLE organization.store_qr_configuration
    ADD CONSTRAINT ck_store_qr_configuration_enabled_channel
    CHECK (NOT enabled OR channel_ref IS NOT NULL);
