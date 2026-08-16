-- C1-2: dictionary values have two persisted meanings.  Reclassify only from
-- owning relational references; an unreferenced legacy row is intentionally a
-- migration stop because its meaning cannot be inferred safely.
ALTER TABLE catalog.dictionary_entry
    ADD COLUMN IF NOT EXISTS parent_entry_ref UUID;

DO $$
BEGIN
    IF EXISTS (
        WITH reference_rows AS (
            SELECT value_row.value_ref AS entry_ref, 'SKU' AS source_kind
              FROM catalog.catalog_sku_variant_axis_value value_row
              JOIN catalog.catalog_sku_variant_axis axis
                ON axis.sku_variant_axis_ref = value_row.sku_variant_axis_ref
              JOIN catalog.catalog_item item ON item.item_ref = axis.item_ref
              JOIN catalog.dictionary_entry entry ON entry.entry_ref = value_row.value_ref
             WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
               AND entry.data_node_ref = item.data_node_ref
               AND entry.brand_ref = item.brand_ref
            UNION ALL
            SELECT relation.attribute_value_ref, 'SKU'
              FROM catalog.catalog_sku_attribute_value relation
              JOIN catalog.catalog_sku sku ON sku.product_sku_ref = relation.product_sku_ref
              JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
              JOIN catalog.dictionary_entry entry ON entry.entry_ref = relation.attribute_value_ref
             WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
               AND entry.data_node_ref = item.data_node_ref
               AND entry.brand_ref = item.brand_ref
            UNION ALL
            SELECT value_row.attribute_value_ref, 'ORDER'
              FROM catalog.catalog_order_option_value value_row
              JOIN catalog.catalog_order_option_group group_row
                ON group_row.order_option_group_ref = value_row.order_option_group_ref
              JOIN catalog.catalog_item item ON item.item_ref = group_row.item_ref
              JOIN catalog.dictionary_entry entry ON entry.entry_ref = value_row.attribute_value_ref
             WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
               AND entry.data_node_ref = item.data_node_ref
               AND entry.brand_ref = item.brand_ref
            UNION ALL
            SELECT bom.option_value_ref, 'ORDER'
              FROM inventory.stock_bom bom
              JOIN catalog.dictionary_entry entry ON entry.entry_ref = bom.option_value_ref
             WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
               AND entry.data_node_ref = bom.data_node_ref
               AND entry.brand_ref = bom.brand_ref
        )
        SELECT entry_ref
          FROM reference_rows
         GROUP BY entry_ref
        HAVING COUNT(DISTINCT source_kind) > 1
    ) THEN
        RAISE EXCEPTION 'CATALOG_DICTIONARY_VALUE_HAS_AMBIGUOUS_OWNER_KIND';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM catalog.dictionary_entry entry
         WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
           AND NOT EXISTS (
               SELECT 1
                 FROM catalog.catalog_sku_variant_axis_value value_row
                 JOIN catalog.catalog_sku_variant_axis axis
                   ON axis.sku_variant_axis_ref = value_row.sku_variant_axis_ref
                 JOIN catalog.catalog_item item ON item.item_ref = axis.item_ref
                WHERE value_row.value_ref = entry.entry_ref
                  AND item.data_node_ref = entry.data_node_ref
                  AND item.brand_ref = entry.brand_ref
           )
           AND NOT EXISTS (
               SELECT 1
                 FROM catalog.catalog_sku_attribute_value relation
                 JOIN catalog.catalog_sku sku ON sku.product_sku_ref = relation.product_sku_ref
                 JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
                WHERE relation.attribute_value_ref = entry.entry_ref
                  AND item.data_node_ref = entry.data_node_ref
                  AND item.brand_ref = entry.brand_ref
           )
           AND NOT EXISTS (
               SELECT 1
                 FROM catalog.catalog_order_option_value value_row
                 JOIN catalog.catalog_order_option_group group_row
                   ON group_row.order_option_group_ref = value_row.order_option_group_ref
                 JOIN catalog.catalog_item item ON item.item_ref = group_row.item_ref
                WHERE value_row.attribute_value_ref = entry.entry_ref
                  AND item.data_node_ref = entry.data_node_ref
                  AND item.brand_ref = entry.brand_ref
           )
           AND NOT EXISTS (
               SELECT 1
                 FROM inventory.stock_bom bom
                WHERE bom.option_value_ref = entry.entry_ref
                  AND bom.data_node_ref = entry.data_node_ref
                  AND bom.brand_ref = entry.brand_ref
           )
    ) THEN
        RAISE EXCEPTION 'CATALOG_DICTIONARY_UNCLASSIFIED_VALUE_EXISTS';
    END IF;

    IF EXISTS (
        WITH parent_candidates AS (
            SELECT relation.attribute_value_ref AS entry_ref, relation.attribute_ref AS parent_entry_ref
              FROM catalog.catalog_sku_attribute_value relation
              JOIN catalog.catalog_sku sku ON sku.product_sku_ref = relation.product_sku_ref
              JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
              JOIN catalog.dictionary_entry entry ON entry.entry_ref = relation.attribute_value_ref
             WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
               AND entry.data_node_ref = item.data_node_ref
               AND entry.brand_ref = item.brand_ref
            UNION
            SELECT value_row.value_ref, axis.attribute_ref
              FROM catalog.catalog_sku_variant_axis_value value_row
              JOIN catalog.catalog_sku_variant_axis axis
                ON axis.sku_variant_axis_ref = value_row.sku_variant_axis_ref
              JOIN catalog.catalog_item item ON item.item_ref = axis.item_ref
              JOIN catalog.dictionary_entry entry ON entry.entry_ref = value_row.value_ref
             WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
               AND entry.data_node_ref = item.data_node_ref
               AND entry.brand_ref = item.brand_ref
        )
        SELECT entry_ref
          FROM parent_candidates
         GROUP BY entry_ref
        HAVING COUNT(DISTINCT parent_entry_ref) > 1
    ) THEN
        RAISE EXCEPTION 'CATALOG_DICTIONARY_VALUE_HAS_MULTIPLE_ATTRIBUTE_PARENTS';
    END IF;
END $$;

UPDATE catalog.dictionary_entry entry
   SET dictionary_kind = 'ORDER_OPTION_VALUE'
 WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
   AND NOT EXISTS (
       SELECT 1
         FROM catalog.catalog_sku_attribute_value relation
         JOIN catalog.catalog_sku sku ON sku.product_sku_ref = relation.product_sku_ref
         JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
        WHERE relation.attribute_value_ref = entry.entry_ref
          AND item.data_node_ref = entry.data_node_ref
          AND item.brand_ref = entry.brand_ref
   )
   AND (
       EXISTS (
           SELECT 1
             FROM catalog.catalog_order_option_value value_row
             JOIN catalog.catalog_order_option_group group_row
               ON group_row.order_option_group_ref = value_row.order_option_group_ref
             JOIN catalog.catalog_item item ON item.item_ref = group_row.item_ref
            WHERE value_row.attribute_value_ref = entry.entry_ref
              AND item.data_node_ref = entry.data_node_ref
              AND item.brand_ref = entry.brand_ref
       )
       OR EXISTS (
           SELECT 1
             FROM inventory.stock_bom bom
            WHERE bom.option_value_ref = entry.entry_ref
              AND bom.data_node_ref = entry.data_node_ref
              AND bom.brand_ref = entry.brand_ref
       )
   );

WITH parent_candidates AS (
    SELECT relation.attribute_value_ref AS entry_ref, relation.attribute_ref AS parent_entry_ref
      FROM catalog.catalog_sku_attribute_value relation
      JOIN catalog.catalog_sku sku ON sku.product_sku_ref = relation.product_sku_ref
      JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
      JOIN catalog.dictionary_entry entry ON entry.entry_ref = relation.attribute_value_ref
     WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
       AND entry.data_node_ref = item.data_node_ref
       AND entry.brand_ref = item.brand_ref
    UNION
    SELECT value_row.value_ref, axis.attribute_ref
      FROM catalog.catalog_sku_variant_axis_value value_row
      JOIN catalog.catalog_sku_variant_axis axis
        ON axis.sku_variant_axis_ref = value_row.sku_variant_axis_ref
      JOIN catalog.catalog_item item ON item.item_ref = axis.item_ref
      JOIN catalog.dictionary_entry entry ON entry.entry_ref = value_row.value_ref
     WHERE entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
       AND entry.data_node_ref = item.data_node_ref
       AND entry.brand_ref = item.brand_ref
), unique_parent AS (
    SELECT entry_ref, MIN(parent_entry_ref::text)::uuid AS parent_entry_ref
      FROM parent_candidates
     GROUP BY entry_ref
    HAVING COUNT(DISTINCT parent_entry_ref) = 1
)
UPDATE catalog.dictionary_entry entry
   SET parent_entry_ref = unique_parent.parent_entry_ref
  FROM unique_parent
 WHERE entry.entry_ref = unique_parent.entry_ref
   AND entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE';

ALTER TABLE catalog.dictionary_entry
    ADD CONSTRAINT uk_catalog_dictionary_entry_ref_scope
    UNIQUE (entry_ref, data_node_ref, brand_ref);

ALTER TABLE catalog.dictionary_entry
    ADD CONSTRAINT fk_catalog_dictionary_parent_same_scope
    FOREIGN KEY (parent_entry_ref, data_node_ref, brand_ref)
    REFERENCES catalog.dictionary_entry (entry_ref, data_node_ref, brand_ref);

ALTER TABLE catalog.dictionary_entry
    ADD CONSTRAINT ck_catalog_dictionary_parent_kind
    CHECK ((dictionary_kind = 'SKU_ATTRIBUTE_VALUE') = (parent_entry_ref IS NOT NULL));

CREATE OR REPLACE FUNCTION catalog.validate_dictionary_attribute_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.parent_entry_ref IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM catalog.dictionary_entry parent
            WHERE parent.entry_ref = NEW.parent_entry_ref
              AND parent.data_node_ref = NEW.data_node_ref
              AND parent.brand_ref = NEW.brand_ref
              AND parent.dictionary_kind = 'SKU_ATTRIBUTE'
       ) THEN
        RAISE EXCEPTION 'CATALOG_DICTIONARY_PARENT_MUST_BE_SKU_ATTRIBUTE';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_catalog_dictionary_attribute_parent
BEFORE INSERT OR UPDATE OF parent_entry_ref, dictionary_kind, data_node_ref, brand_ref
ON catalog.dictionary_entry
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_dictionary_attribute_parent();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM catalog.catalog_sku_attribute_value relation
          JOIN catalog.catalog_sku sku ON sku.product_sku_ref = relation.product_sku_ref
          JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
          JOIN catalog.dictionary_entry attribute_entry ON attribute_entry.entry_ref = relation.attribute_ref
          JOIN catalog.dictionary_entry value_entry ON value_entry.entry_ref = relation.attribute_value_ref
         WHERE attribute_entry.data_node_ref = item.data_node_ref
           AND attribute_entry.brand_ref = item.brand_ref
           AND value_entry.data_node_ref = item.data_node_ref
           AND value_entry.brand_ref = item.brand_ref
           AND (attribute_entry.dictionary_kind <> 'SKU_ATTRIBUTE'
                OR value_entry.dictionary_kind <> 'SKU_ATTRIBUTE_VALUE'
                OR value_entry.parent_entry_ref IS DISTINCT FROM relation.attribute_ref)
    ) THEN
        RAISE EXCEPTION 'CATALOG_SKU_ATTRIBUTE_VALUE_RELATION_IS_INVALID';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM catalog.catalog_sku_variant_axis_value value_row
          JOIN catalog.catalog_sku_variant_axis axis
            ON axis.sku_variant_axis_ref = value_row.sku_variant_axis_ref
          JOIN catalog.catalog_item item ON item.item_ref = axis.item_ref
          JOIN catalog.dictionary_entry attribute_entry ON attribute_entry.entry_ref = axis.attribute_ref
          JOIN catalog.dictionary_entry value_entry ON value_entry.entry_ref = value_row.value_ref
         WHERE attribute_entry.data_node_ref = item.data_node_ref
           AND attribute_entry.brand_ref = item.brand_ref
           AND value_entry.data_node_ref = item.data_node_ref
           AND value_entry.brand_ref = item.brand_ref
           AND (attribute_entry.dictionary_kind <> 'SKU_ATTRIBUTE'
                OR value_entry.dictionary_kind <> 'SKU_ATTRIBUTE_VALUE'
                OR value_entry.parent_entry_ref IS DISTINCT FROM axis.attribute_ref)
    ) THEN
        RAISE EXCEPTION 'CATALOG_SKU_VARIANT_AXIS_VALUE_RELATION_IS_INVALID';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM catalog.catalog_order_option_value value_row
          JOIN catalog.catalog_order_option_group group_row
            ON group_row.order_option_group_ref = value_row.order_option_group_ref
          JOIN catalog.catalog_item item ON item.item_ref = group_row.item_ref
          JOIN catalog.dictionary_entry value_entry ON value_entry.entry_ref = value_row.attribute_value_ref
         WHERE value_row.attribute_value_ref IS NOT NULL
           AND value_entry.data_node_ref = item.data_node_ref
           AND value_entry.brand_ref = item.brand_ref
           AND (value_entry.dictionary_kind <> 'ORDER_OPTION_VALUE'
                OR value_entry.parent_entry_ref IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'CATALOG_ORDER_OPTION_VALUE_RELATION_IS_INVALID';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION catalog.validate_catalog_sku_attribute_value_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM catalog.catalog_sku sku
          JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
          JOIN catalog.dictionary_entry attribute_entry
            ON attribute_entry.entry_ref = NEW.attribute_ref
           AND attribute_entry.data_node_ref = item.data_node_ref
           AND attribute_entry.brand_ref = item.brand_ref
           AND attribute_entry.dictionary_kind = 'SKU_ATTRIBUTE'
          JOIN catalog.dictionary_entry value_entry
            ON value_entry.entry_ref = NEW.attribute_value_ref
           AND value_entry.data_node_ref = item.data_node_ref
           AND value_entry.brand_ref = item.brand_ref
           AND value_entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
           AND value_entry.parent_entry_ref = NEW.attribute_ref
         WHERE sku.product_sku_ref = NEW.product_sku_ref
    ) THEN
        RAISE EXCEPTION 'CATALOG_SKU_ATTRIBUTE_VALUE_RELATION_IS_INVALID';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_catalog_sku_attribute_value_relation
BEFORE INSERT OR UPDATE OF product_sku_ref, attribute_ref, attribute_value_ref
ON catalog.catalog_sku_attribute_value
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_catalog_sku_attribute_value_relation();

CREATE OR REPLACE FUNCTION catalog.validate_catalog_sku_variant_axis_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM catalog.catalog_item item
          JOIN catalog.dictionary_entry attribute_entry
            ON attribute_entry.entry_ref = NEW.attribute_ref
           AND attribute_entry.data_node_ref = item.data_node_ref
           AND attribute_entry.brand_ref = item.brand_ref
           AND attribute_entry.dictionary_kind = 'SKU_ATTRIBUTE'
         WHERE item.item_ref = NEW.item_ref
    ) THEN
        RAISE EXCEPTION 'CATALOG_SKU_VARIANT_AXIS_MUST_REFERENCE_SKU_ATTRIBUTE';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_catalog_sku_variant_axis_relation
BEFORE INSERT OR UPDATE OF item_ref, attribute_ref
ON catalog.catalog_sku_variant_axis
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_catalog_sku_variant_axis_relation();

CREATE OR REPLACE FUNCTION catalog.validate_catalog_sku_variant_axis_value_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM catalog.catalog_sku_variant_axis axis
          JOIN catalog.catalog_item item ON item.item_ref = axis.item_ref
          JOIN catalog.dictionary_entry value_entry
            ON value_entry.entry_ref = NEW.value_ref
           AND value_entry.data_node_ref = item.data_node_ref
           AND value_entry.brand_ref = item.brand_ref
           AND value_entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
           AND value_entry.parent_entry_ref = axis.attribute_ref
         WHERE axis.sku_variant_axis_ref = NEW.sku_variant_axis_ref
    ) THEN
        RAISE EXCEPTION 'CATALOG_SKU_VARIANT_AXIS_VALUE_RELATION_IS_INVALID';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_catalog_sku_variant_axis_value_relation
BEFORE INSERT OR UPDATE OF sku_variant_axis_ref, value_ref
ON catalog.catalog_sku_variant_axis_value
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_catalog_sku_variant_axis_value_relation();

CREATE OR REPLACE FUNCTION catalog.validate_catalog_order_option_value_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.attribute_value_ref IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM catalog.catalog_order_option_group group_row
          JOIN catalog.catalog_item item ON item.item_ref = group_row.item_ref
          JOIN catalog.dictionary_entry value_entry
            ON value_entry.entry_ref = NEW.attribute_value_ref
           AND value_entry.data_node_ref = item.data_node_ref
           AND value_entry.brand_ref = item.brand_ref
           AND value_entry.dictionary_kind = 'ORDER_OPTION_VALUE'
           AND value_entry.parent_entry_ref IS NULL
         WHERE group_row.order_option_group_ref = NEW.order_option_group_ref
    ) THEN
        RAISE EXCEPTION 'CATALOG_ORDER_OPTION_VALUE_RELATION_IS_INVALID';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_catalog_order_option_value_relation
BEFORE INSERT OR UPDATE OF order_option_group_ref, attribute_value_ref
ON catalog.catalog_order_option_value
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_catalog_order_option_value_relation();
