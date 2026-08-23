-- CIPG: replace free-form identification and generic preparation JSON with owner-local facts.
-- The preflight is deliberately fail-closed.  It reports only safe categories and counts;
-- identifier values, notes, instructions and raw JSON never enter NOTICE output.

CREATE OR REPLACE FUNCTION pg_temp.cipg_migration_preflight()
RETURNS TABLE(category TEXT, finding_count BIGINT, disposition TEXT)
LANGUAGE SQL
AS $$
WITH item_identifier_rows AS (
    SELECT
        item.item_ref,
        item.data_node_ref,
        item.brand_ref,
        item.shape_key,
        'ITEM'::TEXT AS owner_grain,
        element.ordinality,
        element.value AS identifier
    FROM catalog.catalog_item item
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(item.sections -> 'identifiers') = 'array'
                THEN item.sections -> 'identifiers'
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS element(value, ordinality)
),
sku_identifier_rows AS (
    SELECT
        sku.item_ref,
        item.data_node_ref,
        item.brand_ref,
        item.shape_key,
        'SKU'::TEXT AS owner_grain,
        1::BIGINT AS ordinality,
        jsonb_build_object('kind', 'BARCODE', 'code', '', 'value', sku.sku_barcode) AS identifier,
        sku.product_sku_ref
    FROM catalog.catalog_sku sku
    JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
    WHERE sku.sku_barcode IS NOT NULL
      AND btrim(sku.sku_barcode) <> ''
),
identifier_rows AS (
    SELECT item_ref, data_node_ref, brand_ref, shape_key, owner_grain, ordinality, identifier, NULL::UUID AS product_sku_ref
    FROM item_identifier_rows
    UNION ALL
    SELECT item_ref, data_node_ref, brand_ref, shape_key, owner_grain, ordinality, identifier, product_sku_ref
    FROM sku_identifier_rows
),
identifier_typed AS (
    SELECT
        rows.*,
        NULLIF(rows.identifier ->> 'kind', '') AS identifier_type,
        rows.identifier ->> 'code' AS legacy_code,
        rows.identifier ->> 'value' AS identifier_value,
        jsonb_typeof(rows.identifier -> 'value') AS identifier_value_type
    FROM identifier_rows rows
),
identifier_valid AS (
    SELECT
        typed.*,
        CASE
            WHEN typed.identifier_type = 'MNEMONIC' THEN lower(btrim(typed.identifier_value))
            ELSE btrim(typed.identifier_value)
        END AS normalized_value
    FROM identifier_typed typed
    WHERE typed.identifier_type IN ('BARCODE', 'PLU', 'MNEMONIC')
      AND COALESCE(typed.legacy_code, '') = ''
      AND typed.identifier_value_type = 'string'
      AND btrim(COALESCE(typed.identifier_value, '')) <> ''
      AND length(btrim(typed.identifier_value)) <= 160
      AND typed.identifier_value !~ E'[\\x00-\\x1F\\x7F-\\x9F]'
      AND (
            (typed.shape_key = 'STANDARD_SALE_COUNTED' AND typed.owner_grain = 'ITEM' AND typed.identifier_type IN ('BARCODE', 'MNEMONIC'))
         OR (typed.shape_key = 'SKU_VARIANT_SALE_COUNTED' AND typed.owner_grain = 'SKU' AND typed.identifier_type IN ('BARCODE', 'MNEMONIC'))
         OR (typed.shape_key = 'STANDARD_SALE_WEIGHED' AND typed.owner_grain = 'ITEM' AND typed.identifier_type IN ('BARCODE', 'PLU', 'MNEMONIC'))
         OR (typed.shape_key IN ('MATERIAL', 'COMPOSITE') AND typed.owner_grain = 'ITEM' AND typed.identifier_type IN ('BARCODE', 'MNEMONIC'))
         OR (typed.shape_key = 'SERVICE' AND typed.owner_grain = 'ITEM' AND typed.identifier_type = 'MNEMONIC')
      )
),
identifier_duplicate_keys AS (
    SELECT data_node_ref, brand_ref, identifier_type, normalized_value
    FROM identifier_valid
    GROUP BY data_node_ref, brand_ref, identifier_type, normalized_value
    HAVING count(*) > 1
),
item_profiles AS (
    SELECT
        item.item_ref,
        item.shape_key,
        item.sections,
        CASE
            WHEN jsonb_typeof(item.sections -> 'productionProfiles') = 'object'
                THEN item.sections -> 'productionProfiles'
            ELSE '{}'::jsonb
        END AS profiles,
        CASE
            WHEN jsonb_typeof(item.sections -> 'productionProfiles') IS NULL
                OR jsonb_typeof(item.sections -> 'productionProfiles') = 'object'
                THEN TRUE
            ELSE FALSE
        END AS profile_container_valid
    FROM catalog.catalog_item item
),
item_profile_values AS (
    SELECT
        profiles.*,
        profiles.profiles -> 'item' AS item_profile,
        profiles.profiles -> 'sku' AS sku_profile,
        profiles.profiles -> 'optionValue' AS option_value_profile,
        jsonb_array_length(
            CASE
                WHEN jsonb_typeof(profiles.sections -> 'productionTagRefs') = 'array'
                    THEN profiles.sections -> 'productionTagRefs'
                ELSE '[]'::jsonb
            END
        ) AS top_level_tag_count
    FROM item_profiles profiles
),
item_profile_key_findings AS (
    SELECT DISTINCT values.item_ref
    FROM item_profile_values values
    CROSS JOIN LATERAL jsonb_object_keys(
        CASE
            WHEN jsonb_typeof(values.item_profile) = 'object' THEN values.item_profile
            ELSE '{}'::jsonb
        END
    ) AS keys(key)
    WHERE keys.key NOT IN ('printName', 'estimatedPreparationSeconds', 'preparationNotes', 'materialRole')
),
production_tag_refs AS (
    SELECT relation.item_ref, relation.ref::TEXT AS ref
    FROM catalog.catalog_item_reference relation
    WHERE relation.kind = 'PRODUCTION_TAG'
    UNION
    SELECT values.item_ref, jsonb_array_elements_text(values.sections -> 'productionTagRefs') AS ref
    FROM item_profile_values values
    WHERE jsonb_typeof(values.sections -> 'productionTagRefs') = 'array'
),
production_tag_counts AS (
    SELECT item_ref, count(*) AS tag_count
    FROM production_tag_refs
    GROUP BY item_ref
),
meaningful_item_profiles AS (
    SELECT
        values.item_ref,
        values.shape_key,
        values.item_profile,
        COALESCE(tags.tag_count, 0) AS tag_count
    FROM item_profile_values values
    LEFT JOIN production_tag_counts tags ON tags.item_ref = values.item_ref
    WHERE jsonb_typeof(values.item_profile) = 'object'
      AND (
            (values.item_profile - 'materialRole') <> '{}'::jsonb
         OR COALESCE(tags.tag_count, 0) > 0
      )
),
profile_disallowed_shapes AS (
    SELECT item_ref
    FROM meaningful_item_profiles
    WHERE shape_key NOT IN ('STANDARD_SALE_COUNTED', 'SKU_VARIANT_SALE_COUNTED', 'STANDARD_SALE_WEIGHED')
),
generic_target_profiles AS (
    SELECT item_ref
    FROM item_profile_values
    WHERE (jsonb_typeof(sku_profile) <> 'object' AND sku_profile IS NOT NULL)
       OR (jsonb_typeof(option_value_profile) <> 'object' AND option_value_profile IS NOT NULL)
       OR (jsonb_typeof(sku_profile) = 'object' AND sku_profile <> '{}'::jsonb)
       OR (jsonb_typeof(option_value_profile) = 'object' AND option_value_profile <> '{}'::jsonb)
),
material_role_conflicts AS (
    SELECT item_ref
    FROM item_profile_values
    WHERE jsonb_typeof(item_profile) = 'object'
      AND item_profile ? 'materialRole'
      AND item_profile ->> 'materialRole' IS DISTINCT FROM sections ->> 'materialRole'
),
profile_value_findings AS (
    SELECT item_ref
    FROM item_profile_values
    WHERE jsonb_typeof(item_profile) IS NOT NULL
      AND jsonb_typeof(item_profile) <> 'object'
    UNION
    SELECT item_ref
    FROM item_profile_values
    WHERE jsonb_typeof(item_profile) = 'object'
      AND (
            (item_profile ? 'printName' AND jsonb_typeof(item_profile -> 'printName') NOT IN ('string', 'null'))
         OR (item_profile ? 'printName' AND length(item_profile ->> 'printName') > 120)
         OR (item_profile ? 'preparationNotes' AND jsonb_typeof(item_profile -> 'preparationNotes') NOT IN ('string', 'null'))
         OR (item_profile ? 'preparationNotes' AND length(item_profile ->> 'preparationNotes') > 1000)
         OR (item_profile ? 'estimatedPreparationSeconds'
             AND jsonb_typeof(item_profile -> 'estimatedPreparationSeconds') <> 'null'
             AND ((jsonb_typeof(item_profile -> 'estimatedPreparationSeconds') <> 'number')
                  OR (item_profile ->> 'estimatedPreparationSeconds') !~ '^[0-9]+$'))
      )
),
top_level_tag_shape_findings AS (
    SELECT item_ref
    FROM item_profile_values
    WHERE sections ? 'productionTagRefs'
      AND jsonb_typeof(sections -> 'productionTagRefs') <> 'array'
    UNION
    SELECT item_ref
    FROM item_profile_values
    WHERE jsonb_typeof(sections -> 'productionTagRefs') = 'array'
      AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(sections -> 'productionTagRefs') AS refs(value)
          WHERE refs.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
)
SELECT 'IDENTIFIER_TYPE_UNKNOWN_OR_EMPTY', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'::TEXT
FROM identifier_typed
WHERE identifier_type IS NULL OR identifier_type NOT IN ('BARCODE', 'PLU', 'MNEMONIC')
UNION ALL
SELECT 'IDENTIFIER_LEGACY_CODE_NONEMPTY', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM identifier_typed
WHERE COALESCE(legacy_code, '') <> ''
UNION ALL
SELECT 'IDENTIFIER_VALUE_INVALID', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM identifier_typed
WHERE identifier_type IN ('BARCODE', 'PLU', 'MNEMONIC')
  AND (
        identifier_value_type <> 'string'
     OR btrim(COALESCE(identifier_value, '')) = ''
     OR length(btrim(COALESCE(identifier_value, ''))) > 160
     OR COALESCE(identifier_value, '') ~ E'[\\x00-\\x1F\\x7F-\\x9F]'
  )
UNION ALL
SELECT 'IDENTIFIER_SHAPE_OR_GRAIN_NOT_ALLOWED', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM identifier_typed
WHERE identifier_type IN ('BARCODE', 'PLU', 'MNEMONIC')
  AND identifier_value_type = 'string'
  AND btrim(COALESCE(identifier_value, '')) <> ''
  AND NOT (
        (shape_key = 'STANDARD_SALE_COUNTED' AND owner_grain = 'ITEM' AND identifier_type IN ('BARCODE', 'MNEMONIC'))
     OR (shape_key = 'SKU_VARIANT_SALE_COUNTED' AND owner_grain = 'SKU' AND identifier_type IN ('BARCODE', 'MNEMONIC'))
     OR (shape_key = 'STANDARD_SALE_WEIGHED' AND owner_grain = 'ITEM' AND identifier_type IN ('BARCODE', 'PLU', 'MNEMONIC'))
     OR (shape_key IN ('MATERIAL', 'COMPOSITE') AND owner_grain = 'ITEM' AND identifier_type IN ('BARCODE', 'MNEMONIC'))
     OR (shape_key = 'SERVICE' AND owner_grain = 'ITEM' AND identifier_type = 'MNEMONIC')
  )
UNION ALL
SELECT 'IDENTIFIER_NORMALIZED_DUPLICATE', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM identifier_valid valid
WHERE EXISTS (
    SELECT 1
    FROM identifier_duplicate_keys duplicate_key
    WHERE duplicate_key.data_node_ref = valid.data_node_ref
      AND duplicate_key.brand_ref = valid.brand_ref
      AND duplicate_key.identifier_type = valid.identifier_type
      AND duplicate_key.normalized_value = valid.normalized_value
)
UNION ALL
SELECT 'PREPARATION_PROFILE_CONTAINER_INVALID', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM item_profile_values
WHERE NOT profile_container_valid
UNION ALL
SELECT 'PREPARATION_ITEM_PROFILE_UNKNOWN_FIELD', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM item_profile_key_findings
UNION ALL
SELECT 'PREPARATION_ITEM_PROFILE_VALUE_INVALID', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM profile_value_findings
UNION ALL
SELECT 'PREPARATION_MATERIAL_ROLE_CONFLICT', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM material_role_conflicts
UNION ALL
SELECT 'PREPARATION_GENERIC_TARGET_AMBIGUOUS', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM generic_target_profiles
UNION ALL
SELECT 'PREPARATION_SHAPE_NOT_ALLOWED', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM profile_disallowed_shapes
UNION ALL
SELECT 'PREPARATION_TAG_REF_INVALID', count(*)::BIGINT, 'DEXTER_DECISION_REQUIRED'
FROM top_level_tag_shape_findings
$$;

DO $$
DECLARE
    finding RECORD;
    blocking_count BIGINT := 0;
BEGIN
    FOR finding IN SELECT * FROM pg_temp.cipg_migration_preflight() LOOP
        RAISE NOTICE 'CIPG_MIGRATION_PREFLIGHT category=% count=% disposition=%',
            finding.category, finding.finding_count, finding.disposition;
        blocking_count := blocking_count + finding.finding_count;
    END LOOP;
    IF blocking_count > 0 THEN
        RAISE EXCEPTION 'CIPG_MIGRATION_PREFLIGHT_FAILED blocking_categories=%', blocking_count;
    END IF;
END
$$;

CREATE TABLE catalog.product_identifier (
    identifier_ref UUID PRIMARY KEY,
    data_node_ref TEXT NOT NULL,
    brand_ref TEXT NOT NULL,
    item_ref UUID NOT NULL REFERENCES catalog.catalog_item (item_ref),
    product_sku_ref UUID,
    identifier_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    CHECK (identifier_type IN ('BARCODE', 'PLU', 'MNEMONIC')),
    CHECK (btrim(identifier_value) <> ''),
    CHECK (length(identifier_value) <= 160),
    CHECK (identifier_value !~ E'[\\x00-\\x1F\\x7F-\\x9F]'),
    CHECK (btrim(normalized_value) <> ''),
    CHECK (length(normalized_value) <= 160),
    CHECK (normalized_value !~ E'[\\x00-\\x1F\\x7F-\\x9F]'),
    CHECK (display_order >= 0),
    UNIQUE (data_node_ref, brand_ref, identifier_type, normalized_value),
    FOREIGN KEY (item_ref, product_sku_ref)
        REFERENCES catalog.catalog_sku (item_ref, product_sku_ref)
);
CREATE INDEX ix_catalog_product_identifier_item_order
    ON catalog.product_identifier (item_ref, product_sku_ref, display_order, identifier_ref);
CREATE INDEX ix_catalog_product_identifier_lookup
    ON catalog.product_identifier (data_node_ref, brand_ref, identifier_type, normalized_value);

ALTER TABLE catalog.catalog_item
    ADD COLUMN preparation_profile JSONB;
ALTER TABLE catalog.catalog_sku
    ADD COLUMN preparation_override JSONB;
ALTER TABLE catalog.catalog_item_order_option_value_override
    ADD COLUMN preparation_effect JSONB;

-- The typed whole-save contract already carries the business order of option groups.  The
-- previous relation had no owner column for that fact, so materialize a deterministic
-- initial order before the new read/write path starts treating it as authoritative.
ALTER TABLE catalog.catalog_item_order_option_config
    ADD COLUMN display_order INTEGER;
WITH ranked_option_groups AS (
    SELECT config.item_order_option_config_ref,
           row_number() OVER (
               PARTITION BY config.item_ref
               ORDER BY definition.name, definition.order_option_definition_ref
           ) - 1 AS display_order
    FROM catalog.catalog_item_order_option_config config
    JOIN catalog.catalog_order_option_definition definition
      ON definition.order_option_definition_ref = config.order_option_definition_ref
)
UPDATE catalog.catalog_item_order_option_config config
SET display_order = ranked.display_order
FROM ranked_option_groups ranked
WHERE ranked.item_order_option_config_ref = config.item_order_option_config_ref;
ALTER TABLE catalog.catalog_item_order_option_config
    ALTER COLUMN display_order SET NOT NULL,
    ADD CONSTRAINT ck_catalog_item_order_option_config_display_order CHECK (display_order >= 0),
    ADD CONSTRAINT uq_catalog_item_order_option_config_item_display_order UNIQUE (item_ref, display_order);

ALTER TABLE catalog.catalog_item
    ADD CONSTRAINT ck_catalog_item_preparation_profile
    CHECK (
        preparation_profile IS NULL
        OR (
            jsonb_typeof(preparation_profile) = 'object'
            AND preparation_profile ? 'productionTagRefs'
            AND jsonb_typeof(preparation_profile -> 'productionTagRefs') = 'array'
            AND (preparation_profile - 'productionTagRefs' - 'productionDisplayName'
                 - 'estimatedPreparationSeconds' - 'preparationNotes') = '{}'::jsonb
            AND (NOT preparation_profile ? 'productionDisplayName'
                 OR jsonb_typeof(preparation_profile -> 'productionDisplayName') IN ('string', 'null'))
            AND (NOT preparation_profile ? 'preparationNotes'
                 OR jsonb_typeof(preparation_profile -> 'preparationNotes') IN ('string', 'null'))
            AND (NOT preparation_profile ? 'estimatedPreparationSeconds'
                 OR jsonb_typeof(preparation_profile -> 'estimatedPreparationSeconds') IN ('number', 'null'))
            AND (NOT preparation_profile ? 'productionDisplayName'
                 OR preparation_profile -> 'productionDisplayName' IS NULL
                 OR length(preparation_profile ->> 'productionDisplayName') <= 120)
            AND (NOT preparation_profile ? 'preparationNotes'
                 OR preparation_profile -> 'preparationNotes' IS NULL
                 OR length(preparation_profile ->> 'preparationNotes') <= 1000)
            AND (NOT preparation_profile ? 'estimatedPreparationSeconds'
                 OR preparation_profile -> 'estimatedPreparationSeconds' IS NULL
                 OR (preparation_profile ->> 'estimatedPreparationSeconds') ~ '^[0-9]+$')
        )
    );

ALTER TABLE catalog.catalog_sku
    ADD CONSTRAINT ck_catalog_sku_preparation_override
    CHECK (
        preparation_override IS NULL
        OR (
            jsonb_typeof(preparation_override) = 'object'
            AND preparation_override ? 'mode'
            AND preparation_override ? 'profile'
            AND (preparation_override - 'mode' - 'profile') = '{}'::jsonb
            AND preparation_override ->> 'mode' IN ('INHERIT_ITEM', 'OVERRIDE')
            AND (
                (preparation_override ->> 'mode' = 'INHERIT_ITEM' AND preparation_override -> 'profile' IS NULL)
                OR (preparation_override ->> 'mode' = 'OVERRIDE'
                    AND jsonb_typeof(preparation_override -> 'profile') = 'object')
            )
        )
    );

ALTER TABLE catalog.catalog_item_order_option_value_override
    ADD CONSTRAINT ck_catalog_item_option_preparation_effect
    CHECK (
        preparation_effect IS NULL
        OR (
            jsonb_typeof(preparation_effect) = 'object'
            AND preparation_effect ? 'addProductionTagRefs'
            AND jsonb_typeof(preparation_effect -> 'addProductionTagRefs') = 'array'
            AND (preparation_effect - 'addProductionTagRefs' - 'instruction'
                 - 'preparationSecondsDelta') = '{}'::jsonb
            AND (NOT preparation_effect ? 'instruction'
                 OR jsonb_typeof(preparation_effect -> 'instruction') IN ('string', 'null'))
            AND (NOT preparation_effect ? 'preparationSecondsDelta'
                 OR jsonb_typeof(preparation_effect -> 'preparationSecondsDelta') IN ('number', 'null'))
            AND (NOT preparation_effect ? 'instruction'
                 OR preparation_effect -> 'instruction' IS NULL
                 OR length(preparation_effect ->> 'instruction') <= 1000)
            AND (NOT preparation_effect ? 'preparationSecondsDelta'
                 OR preparation_effect -> 'preparationSecondsDelta' IS NULL
                 OR (preparation_effect ->> 'preparationSecondsDelta') ~ '^[0-9]+$')
        )
    );

-- The same read-only predicate is deliberately executed again after DDL and before any DML.
DO $$
DECLARE
    finding RECORD;
    blocking_count BIGINT := 0;
BEGIN
    FOR finding IN SELECT * FROM pg_temp.cipg_migration_preflight() LOOP
        RAISE NOTICE 'CIPG_MIGRATION_PREFLIGHT_RECHECK category=% count=% disposition=%',
            finding.category, finding.finding_count, finding.disposition;
        blocking_count := blocking_count + finding.finding_count;
    END LOOP;
    IF blocking_count > 0 THEN
        RAISE EXCEPTION 'CIPG_MIGRATION_PREFLIGHT_RECHECK_FAILED blocking_categories=%', blocking_count;
    END IF;
END
$$;

WITH legacy_identifiers AS (
    SELECT
        item.item_ref,
        item.data_node_ref,
        item.brand_ref,
        item.shape_key,
        element.ordinality,
        element.value ->> 'kind' AS identifier_type,
        btrim(element.value ->> 'value') AS identifier_value
    FROM catalog.catalog_item item
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(item.sections -> 'identifiers') = 'array'
                THEN item.sections -> 'identifiers'
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS element(value, ordinality)
),
valid_identifiers AS (
    SELECT
        legacy.*,
        CASE WHEN legacy.identifier_type = 'MNEMONIC'
             THEN lower(legacy.identifier_value)
             ELSE legacy.identifier_value END AS normalized_value,
        row_number() OVER (PARTITION BY legacy.item_ref ORDER BY legacy.ordinality) - 1 AS display_order
    FROM legacy_identifiers legacy
)
INSERT INTO catalog.product_identifier (
    identifier_ref,
    data_node_ref,
    brand_ref,
    item_ref,
    product_sku_ref,
    identifier_type,
    identifier_value,
    normalized_value,
    display_order
)
SELECT
    md5('CIPG:item:' || item_ref::TEXT || ':' || ordinality::TEXT)::UUID,
    data_node_ref,
    brand_ref,
    item_ref,
    NULL,
    identifier_type,
    identifier_value,
    normalized_value,
    display_order
FROM valid_identifiers;

INSERT INTO catalog.product_identifier (
    identifier_ref,
    data_node_ref,
    brand_ref,
    item_ref,
    product_sku_ref,
    identifier_type,
    identifier_value,
    normalized_value,
    display_order
)
SELECT
    md5('CIPG:sku:' || sku.product_sku_ref::TEXT)::UUID,
    item.data_node_ref,
    item.brand_ref,
    sku.item_ref,
    sku.product_sku_ref,
    'BARCODE',
    btrim(sku.sku_barcode),
    btrim(sku.sku_barcode),
    0
FROM catalog.catalog_sku sku
JOIN catalog.catalog_item item ON item.item_ref = sku.item_ref
WHERE sku.sku_barcode IS NOT NULL
  AND btrim(sku.sku_barcode) <> '';

WITH item_tags AS (
    SELECT relation.item_ref, relation.ref::TEXT AS tag_ref
    FROM catalog.catalog_item_reference relation
    WHERE relation.kind = 'PRODUCTION_TAG'
    UNION
    SELECT item.item_ref, jsonb_array_elements_text(item.sections -> 'productionTagRefs') AS tag_ref
    FROM catalog.catalog_item item
    WHERE jsonb_typeof(item.sections -> 'productionTagRefs') = 'array'
),
tag_values AS (
    SELECT item_ref, jsonb_agg(to_jsonb(tag_ref) ORDER BY tag_ref) AS production_tag_refs
    FROM item_tags
    GROUP BY item_ref
),
profiles AS (
    SELECT
        item.item_ref,
        item.sections,
        CASE WHEN jsonb_typeof(item.sections -> 'productionProfiles') = 'object'
             THEN item.sections -> 'productionProfiles' ELSE '{}'::jsonb END AS production_profiles,
        tags.production_tag_refs
    FROM catalog.catalog_item item
    LEFT JOIN tag_values tags ON tags.item_ref = item.item_ref
),
prepared AS (
    SELECT
        profiles.item_ref,
        profiles.production_profiles -> 'item' AS item_profile,
        COALESCE(profiles.production_tag_refs, '[]'::jsonb) AS production_tag_refs
    FROM profiles
)
UPDATE catalog.catalog_item item
SET preparation_profile = CASE
    WHEN prepared.production_tag_refs <> '[]'::jsonb
      OR (jsonb_typeof(prepared.item_profile) = 'object'
          AND (prepared.item_profile - 'materialRole') <> '{}'::jsonb)
    THEN jsonb_build_object(
        'productionTagRefs', prepared.production_tag_refs,
        'productionDisplayName', prepared.item_profile -> 'printName',
        'estimatedPreparationSeconds', prepared.item_profile -> 'estimatedPreparationSeconds',
        'preparationNotes', prepared.item_profile -> 'preparationNotes'
    )
    ELSE NULL
END
FROM prepared
WHERE item.item_ref = prepared.item_ref;

-- The old JSON keys are removed only after all deterministic facts are materialized.
UPDATE catalog.catalog_item
SET sections = sections - 'identifiers' - 'productionProfiles' - 'productionTagRefs';

ALTER TABLE catalog.catalog_sku
    DROP COLUMN sku_barcode;
