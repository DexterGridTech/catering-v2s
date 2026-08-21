-- Dexter 裁定：点单选项组及其可选项各自拥有 scope 内唯一业务编码，创建后不可修改。
-- 此批采用清库，不设计旧业务数据迁移；下列 backfill 只令已经执行前一条 additive migration 的空库可升级。

ALTER TABLE catalog.catalog_order_option_definition
    ADD COLUMN code TEXT;

UPDATE catalog.catalog_order_option_definition
SET code = order_option_definition_ref::text
WHERE code IS NULL;

ALTER TABLE catalog.catalog_order_option_definition
    ALTER COLUMN code SET NOT NULL,
    ADD CONSTRAINT uq_catalog_order_option_definition_scope_code UNIQUE (data_node_ref, brand_ref, code),
    ADD CONSTRAINT uq_catalog_order_option_definition_scope_ref
        UNIQUE (order_option_definition_ref, data_node_ref, brand_ref);

ALTER TABLE catalog.catalog_order_option_definition_value
    ADD COLUMN data_node_ref TEXT,
    ADD COLUMN brand_ref TEXT,
    ADD COLUMN code TEXT;

UPDATE catalog.catalog_order_option_definition_value value_row
SET data_node_ref = definition.data_node_ref,
    brand_ref = definition.brand_ref,
    code = value_row.order_option_definition_value_ref::text
FROM catalog.catalog_order_option_definition definition
WHERE definition.order_option_definition_ref = value_row.order_option_definition_ref
  AND (value_row.data_node_ref IS NULL OR value_row.brand_ref IS NULL OR value_row.code IS NULL);

ALTER TABLE catalog.catalog_order_option_definition_value
    ALTER COLUMN data_node_ref SET NOT NULL,
    ALTER COLUMN brand_ref SET NOT NULL,
    ALTER COLUMN code SET NOT NULL,
    ADD CONSTRAINT uq_catalog_order_option_definition_value_scope_code
        UNIQUE (data_node_ref, brand_ref, code),
    ADD CONSTRAINT fk_catalog_order_option_definition_value_scope
        FOREIGN KEY (order_option_definition_ref, data_node_ref, brand_ref)
        REFERENCES catalog.catalog_order_option_definition (order_option_definition_ref, data_node_ref, brand_ref);

CREATE INDEX ix_catalog_order_option_definition_scope_code
    ON catalog.catalog_order_option_definition (data_node_ref, brand_ref, code);
CREATE INDEX ix_catalog_order_option_definition_value_scope_code
    ON catalog.catalog_order_option_definition_value (data_node_ref, brand_ref, code);
