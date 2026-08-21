-- 商品属性与点单选项定义属于 catalog owner。库存对象/BOM 仍由 inventory owner 管理，
-- 因此这里只保存不透明的 stock_target_ref，不建立跨 schema 外键。

CREATE TABLE catalog.catalog_attribute_definition (
    attribute_definition_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CHECK (value_type IN ('TEXT', 'SINGLE_SELECT', 'MULTI_SELECT')),
    UNIQUE (data_node_ref, brand_ref, code)
);
CREATE INDEX ix_catalog_attribute_definition_scope_code
    ON catalog.catalog_attribute_definition (data_node_ref, brand_ref, code);

CREATE TABLE catalog.catalog_attribute_definition_option (
    attribute_definition_option_ref UUID PRIMARY KEY,
    attribute_definition_ref UUID NOT NULL
        REFERENCES catalog.catalog_attribute_definition (attribute_definition_ref),
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    CHECK (display_order >= 0),
    UNIQUE (attribute_definition_ref, display_order)
);

CREATE TABLE catalog.catalog_item_attribute_assignment (
    item_attribute_assignment_ref UUID PRIMARY KEY,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    attribute_definition_ref UUID NOT NULL
        REFERENCES catalog.catalog_attribute_definition (attribute_definition_ref),
    text_value TEXT,
    UNIQUE (item_ref, attribute_definition_ref)
);
CREATE INDEX ix_catalog_item_attribute_assignment_definition
    ON catalog.catalog_item_attribute_assignment (attribute_definition_ref, item_ref);

CREATE TABLE catalog.catalog_item_attribute_selection (
    item_attribute_assignment_ref UUID NOT NULL
        REFERENCES catalog.catalog_item_attribute_assignment (item_attribute_assignment_ref),
    attribute_definition_option_ref UUID NOT NULL
        REFERENCES catalog.catalog_attribute_definition_option (attribute_definition_option_ref),
    PRIMARY KEY (item_attribute_assignment_ref, attribute_definition_option_ref)
);

CREATE TABLE catalog.catalog_order_option_definition (
    order_option_definition_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    name TEXT NOT NULL,
    selection_mode TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at_epoch_millis BIGINT NOT NULL,
    updated_at_epoch_millis BIGINT NOT NULL,
    CHECK (selection_mode IN ('SINGLE', 'MULTIPLE'))
);
CREATE INDEX ix_catalog_order_option_definition_scope_name
    ON catalog.catalog_order_option_definition (data_node_ref, brand_ref, name);

CREATE TABLE catalog.catalog_order_option_definition_value (
    order_option_definition_value_ref UUID PRIMARY KEY,
    order_option_definition_ref UUID NOT NULL
        REFERENCES catalog.catalog_order_option_definition (order_option_definition_ref),
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    CHECK (display_order >= 0),
    UNIQUE (order_option_definition_ref, display_order)
);

CREATE TABLE catalog.catalog_order_option_definition_material (
    order_option_definition_material_ref UUID PRIMARY KEY,
    order_option_definition_value_ref UUID NOT NULL
        REFERENCES catalog.catalog_order_option_definition_value (order_option_definition_value_ref),
    material_item_ref UUID NOT NULL,
    stock_target_ref UUID NOT NULL,
    consumption_unit TEXT NOT NULL,
    UNIQUE (order_option_definition_value_ref, material_item_ref, stock_target_ref)
);
CREATE INDEX ix_catalog_order_option_definition_material_value
    ON catalog.catalog_order_option_definition_material (order_option_definition_value_ref);

CREATE TABLE catalog.catalog_item_order_option_config (
    item_order_option_config_ref UUID PRIMARY KEY,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    order_option_definition_ref UUID NOT NULL
        REFERENCES catalog.catalog_order_option_definition (order_option_definition_ref),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    min_selection_count INTEGER,
    max_selection_count INTEGER,
    UNIQUE (item_ref, order_option_definition_ref),
    CHECK ((min_selection_count IS NULL OR min_selection_count >= 0)
        AND (max_selection_count IS NULL OR max_selection_count >= 0)
        AND (min_selection_count IS NULL OR max_selection_count IS NULL
             OR min_selection_count <= max_selection_count))
);
CREATE INDEX ix_catalog_item_order_option_config_definition
    ON catalog.catalog_item_order_option_config (order_option_definition_ref, item_ref);

CREATE TABLE catalog.catalog_item_order_option_value_override (
    item_order_option_value_override_ref UUID PRIMARY KEY,
    item_order_option_config_ref UUID NOT NULL
        REFERENCES catalog.catalog_item_order_option_config (item_order_option_config_ref),
    order_option_definition_value_ref UUID NOT NULL
        REFERENCES catalog.catalog_order_option_definition_value (order_option_definition_value_ref),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    extra_price BIGINT,
    UNIQUE (item_order_option_config_ref, order_option_definition_value_ref)
);

CREATE TABLE catalog.catalog_item_order_option_material_quantity (
    item_order_option_value_override_ref UUID NOT NULL
        REFERENCES catalog.catalog_item_order_option_value_override (item_order_option_value_override_ref),
    order_option_definition_material_ref UUID NOT NULL
        REFERENCES catalog.catalog_order_option_definition_material (order_option_definition_material_ref),
    actual_quantity NUMERIC(24, 6) NOT NULL,
    PRIMARY KEY (item_order_option_value_override_ref, order_option_definition_material_ref),
    CHECK (actual_quantity > 0)
);

-- 商品分类已裁定为可空单选；清库前提下可直接收紧关系，不保留 array 兼容层。
ALTER TABLE catalog.catalog_item_category
    ADD CONSTRAINT uq_catalog_item_category_single_category UNIQUE (item_ref);
