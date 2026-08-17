ALTER TABLE catalog.dictionary_entry
    ADD CONSTRAINT ck_catalog_dictionary_entry_kind
    CHECK (dictionary_kind IN ('TAG', 'SALES_UNIT', 'SKU_ATTRIBUTE', 'SKU_ATTRIBUTE_VALUE', 'ORDER_OPTION_VALUE'));
