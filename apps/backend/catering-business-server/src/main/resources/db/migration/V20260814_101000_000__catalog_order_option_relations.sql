-- P3-1 option groups and option values need stable identities.  Their former
-- JSON nesting cannot act as a parent key once values carry typed references.

CREATE TABLE catalog.catalog_order_option_group (
    order_option_group_ref UUID PRIMARY KEY,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    group_code TEXT NOT NULL,
    group_name TEXT NOT NULL,
    selection_mode TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL,
    CHECK (display_order >= 0),
    UNIQUE (item_ref, group_code),
    UNIQUE (item_ref, display_order)
);

CREATE TABLE catalog.catalog_order_option_value (
    order_option_value_ref UUID PRIMARY KEY,
    order_option_group_ref UUID NOT NULL REFERENCES catalog.catalog_order_option_group (order_option_group_ref),
    value_code TEXT NOT NULL,
    value_name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    attribute_value_ref UUID REFERENCES catalog.dictionary_entry (entry_ref),
    extra_price BIGINT,
    production_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
    display_order INTEGER NOT NULL,
    CHECK (display_order >= 0),
    UNIQUE (order_option_group_ref, value_code),
    UNIQUE (order_option_group_ref, display_order)
);
CREATE INDEX ix_catalog_order_option_value_attribute
    ON catalog.catalog_order_option_value (attribute_value_ref, order_option_group_ref);
