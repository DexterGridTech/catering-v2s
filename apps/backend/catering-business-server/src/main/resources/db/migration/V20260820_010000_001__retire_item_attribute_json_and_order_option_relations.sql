-- Dexter 已裁定清库：商品属性与点单选项均已迁移为 catalog 定义库/关系事实。
-- 不保留 catalog_item.attributes 的兼容写入，也不保留 item-owned 点单组选项表。

DROP TABLE IF EXISTS catalog.catalog_order_option_value;
DROP FUNCTION IF EXISTS catalog.validate_catalog_order_option_value_relation();
DROP TABLE IF EXISTS catalog.catalog_order_option_group;

ALTER TABLE catalog.catalog_item
    DROP COLUMN IF EXISTS attributes;
