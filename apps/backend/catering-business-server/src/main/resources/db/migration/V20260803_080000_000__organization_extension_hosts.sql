ALTER TABLE organization.commercial_group
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_commercial_group_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object'),
    ADD CONSTRAINT ck_commercial_group_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);

ALTER TABLE organization.organization_node
    ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_organization_node_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object'),
    ADD CONSTRAINT ck_organization_node_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);
