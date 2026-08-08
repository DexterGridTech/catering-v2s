ALTER TABLE fulfillment_production.production_tag_definition
    ADD COLUMN IF NOT EXISTS tag_kind TEXT NOT NULL DEFAULT 'OTHER';

ALTER TABLE fulfillment_production.production_tag_definition
    DROP CONSTRAINT IF EXISTS production_tag_definition_tag_kind_check;

ALTER TABLE fulfillment_production.production_tag_definition
    ADD CONSTRAINT production_tag_definition_tag_kind_check
    CHECK (tag_kind IN ('PRODUCTION', 'PACKAGE', 'LABEL', 'HANDOFF', 'REVIEW', 'OTHER'));
