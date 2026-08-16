-- VOIDED dictionary entries and production tags remain visible for history but
-- no longer occupy a reusable business code.
ALTER TABLE catalog.dictionary_entry
    DROP CONSTRAINT dictionary_entry_data_node_ref_brand_ref_dictionary_kind_co_key;

CREATE UNIQUE INDEX ux_catalog_dictionary_active_code
    ON catalog.dictionary_entry (data_node_ref, brand_ref, dictionary_kind, code)
    WHERE status <> 'VOIDED';

ALTER TABLE fulfillment_production.production_tag_definition
    DROP CONSTRAINT production_tag_definition_data_node_ref_brand_ref_code_key;

CREATE UNIQUE INDEX ux_production_tag_active_code
    ON fulfillment_production.production_tag_definition (data_node_ref, brand_ref, code)
    WHERE status <> 'VOIDED';
