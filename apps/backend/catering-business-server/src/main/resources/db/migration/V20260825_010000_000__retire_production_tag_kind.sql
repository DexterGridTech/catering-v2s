-- A production tag is now the single business classification assigned to an item.
-- The former internal kind split had no approved user or routing semantics and must
-- not survive as a hidden second classifier after the public contract retires it.
ALTER TABLE fulfillment_production.production_tag_definition
    DROP CONSTRAINT production_tag_definition_tag_kind_check;

ALTER TABLE fulfillment_production.production_tag_definition
    DROP COLUMN tag_kind;
