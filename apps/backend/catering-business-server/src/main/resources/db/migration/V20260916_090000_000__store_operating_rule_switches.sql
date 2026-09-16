ALTER TABLE organization.store
    ADD COLUMN operating_rule_switches JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT ck_store_operating_rule_switches_object
        CHECK (jsonb_typeof(operating_rule_switches) = 'object');
