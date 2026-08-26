-- CP-02: collapse production guidance to one optional item-owned tag.
-- The preflight exposes only safe categories and counts.  It never emits item refs,
-- tag refs, names, notes, instructions, or JSON values.

CREATE OR REPLACE FUNCTION pg_temp.catalog_production_tag_resolution()
RETURNS TABLE(
    item_ref UUID,
    canonical_ref UUID,
    resolution TEXT,
    item_tag_state TEXT,
    relation_count BIGINT,
    relation_ref UUID
)
LANGUAGE SQL
AS $$
WITH item_tag_source AS (
    SELECT
        item.item_ref,
        item.preparation_profile -> 'productionTagRefs' AS tag_node
    FROM catalog.catalog_item item
),
item_tag_elements AS (
    SELECT
        source.item_ref,
        source.tag_node,
        element.value,
        CASE
            WHEN jsonb_typeof(element.value) = 'string'
             AND element.value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                THEN (element.value #>> '{}')::UUID
            ELSE NULL::UUID
        END AS tag_ref
    FROM item_tag_source source
    LEFT JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(source.tag_node) = 'array' THEN source.tag_node
            ELSE '[]'::jsonb
        END
    ) AS element(value) ON TRUE
),
item_tag_stats AS (
    SELECT
        elements.item_ref,
        elements.tag_node,
        count(elements.value) AS value_count,
        count(*) FILTER (
            WHERE elements.value IS NOT NULL
              AND NOT (
                    jsonb_typeof(elements.value) = 'string'
                AND elements.value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              )
        ) AS invalid_value_count,
        count(DISTINCT elements.tag_ref) AS distinct_ref_count,
        (array_agg(elements.tag_ref ORDER BY elements.tag_ref))[1] AS item_tag_ref
    FROM item_tag_elements elements
    GROUP BY elements.item_ref, elements.tag_node
),
item_tags AS (
    SELECT
        stats.item_ref,
        CASE
            WHEN stats.tag_node IS NULL THEN 'MISSING'
            WHEN jsonb_typeof(stats.tag_node) <> 'array' THEN 'MALFORMED'
            WHEN stats.invalid_value_count > 0 THEN 'MALFORMED'
            WHEN stats.value_count = 0 THEN 'EMPTY'
            WHEN stats.distinct_ref_count > 1 THEN 'CONFLICT'
            ELSE 'SINGLE'
        END AS item_tag_state,
        CASE
            WHEN stats.invalid_value_count = 0 AND stats.distinct_ref_count <= 1
                THEN stats.item_tag_ref
            ELSE NULL::UUID
        END AS item_tag_ref
    FROM item_tag_stats stats
),
relations AS (
    SELECT
        relation.item_ref,
        count(*) AS relation_count,
        (array_agg(relation.ref ORDER BY relation.ref))[1] AS relation_ref
    FROM catalog.catalog_item_reference relation
    WHERE relation.kind = 'PRODUCTION_TAG'
    GROUP BY relation.item_ref
)
SELECT
    items.item_ref,
    CASE
        WHEN items.item_tag_state IN ('MALFORMED', 'CONFLICT')
          OR COALESCE(relations.relation_count, 0) > 1
          OR (
                items.item_tag_ref IS NOT NULL
            AND relations.relation_ref IS NOT NULL
            AND items.item_tag_ref <> relations.relation_ref
          )
            THEN NULL::UUID
        ELSE COALESCE(items.item_tag_ref, relations.relation_ref)
    END AS canonical_ref,
    CASE
        WHEN items.item_tag_state IN ('MALFORMED', 'CONFLICT')
          OR COALESCE(relations.relation_count, 0) > 1
          OR (
                items.item_tag_ref IS NOT NULL
            AND relations.relation_ref IS NOT NULL
            AND items.item_tag_ref <> relations.relation_ref
          )
            THEN 'CONFLICT'
        ELSE 'RESOLVED'
    END AS resolution,
    items.item_tag_state,
    COALESCE(relations.relation_count, 0),
    relations.relation_ref
FROM item_tags items
LEFT JOIN relations ON relations.item_ref = items.item_ref
$$;

CREATE OR REPLACE FUNCTION pg_temp.catalog_production_tag_migration_preflight()
RETURNS TABLE(category TEXT, finding_count BIGINT, disposition TEXT)
LANGUAGE SQL
AS $$
WITH resolved AS (
    SELECT * FROM pg_temp.catalog_production_tag_resolution()
),
nested_sources AS (
    SELECT
        sku.item_ref,
        'SKU'::TEXT AS source_kind,
        sku.product_sku_ref AS source_ref,
        CASE
            WHEN sku.preparation_override IS NOT NULL
             AND jsonb_typeof(sku.preparation_override) = 'object'
             AND jsonb_typeof(sku.preparation_override -> 'profile') = 'object'
                THEN sku.preparation_override -> 'profile' -> 'productionTagRefs'
            ELSE NULL::jsonb
        END AS tag_node,
        (
            sku.preparation_override IS NOT NULL
            AND (
                   jsonb_typeof(sku.preparation_override) <> 'object'
                OR NOT (sku.preparation_override ? 'mode')
                OR NOT (sku.preparation_override ? 'profile')
                OR sku.preparation_override ->> 'mode' NOT IN ('INHERIT_ITEM', 'OVERRIDE')
                OR (
                    sku.preparation_override ->> 'mode' = 'INHERIT_ITEM'
                    AND sku.preparation_override -> 'profile' IS NOT NULL
                )
                OR (
                    sku.preparation_override ->> 'mode' = 'OVERRIDE'
                    AND jsonb_typeof(sku.preparation_override -> 'profile') <> 'object'
                )
                OR (
                    jsonb_typeof(sku.preparation_override -> 'profile') = 'object'
                    AND ((sku.preparation_override -> 'profile') - 'productionTagRefs'
                         - 'productionDisplayName' - 'estimatedPreparationSeconds'
                         - 'preparationNotes') <> '{}'::jsonb
                )
            )
        ) AS shape_invalid
    FROM catalog.catalog_sku sku
    UNION ALL
    SELECT
        config.item_ref,
        'OPTION'::TEXT AS source_kind,
        value_override.item_order_option_value_override_ref AS source_ref,
        CASE
            WHEN jsonb_typeof(value_override.preparation_effect) = 'object'
                THEN value_override.preparation_effect -> 'addProductionTagRefs'
            ELSE NULL::jsonb
        END AS tag_node,
        (
            value_override.preparation_effect IS NOT NULL
            AND (
                   jsonb_typeof(value_override.preparation_effect) <> 'object'
                OR (
                    jsonb_typeof(value_override.preparation_effect) = 'object'
                    AND (value_override.preparation_effect - 'addProductionTagRefs'
                         - 'instruction' - 'preparationSecondsDelta') <> '{}'::jsonb
                )
            )
        ) AS shape_invalid
    FROM catalog.catalog_item_order_option_value_override value_override
    JOIN catalog.catalog_item_order_option_config config
      ON config.item_order_option_config_ref = value_override.item_order_option_config_ref
),
nested_elements AS (
    SELECT
        source.item_ref,
        source.source_kind,
        source.source_ref,
        source.shape_invalid,
        source.tag_node,
        element.value,
        CASE
            WHEN jsonb_typeof(element.value) = 'string'
             AND element.value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                THEN (element.value #>> '{}')::UUID
            ELSE NULL::UUID
        END AS tag_ref
    FROM nested_sources source
    LEFT JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(source.tag_node) = 'array' THEN source.tag_node
            ELSE '[]'::jsonb
        END
    ) AS element(value) ON TRUE
),
nested_stats AS (
    SELECT
        elements.item_ref,
        elements.source_kind,
        elements.source_ref,
        elements.shape_invalid,
        elements.tag_node,
        count(elements.value) AS value_count,
        count(*) FILTER (
            WHERE elements.value IS NOT NULL
              AND NOT (
                    jsonb_typeof(elements.value) = 'string'
                AND elements.value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              )
        ) AS invalid_value_count,
        count(DISTINCT elements.tag_ref) AS distinct_ref_count,
        (array_agg(elements.tag_ref ORDER BY elements.tag_ref))[1] AS nested_tag_ref
    FROM nested_elements elements
    GROUP BY elements.item_ref, elements.source_kind, elements.source_ref, elements.shape_invalid, elements.tag_node
),
nested_classified AS (
    SELECT
        nested.*,
        CASE
            WHEN nested.shape_invalid THEN 'MALFORMED'
            WHEN nested.tag_node IS NULL THEN 'MISSING'
            WHEN jsonb_typeof(nested.tag_node) <> 'array' THEN 'MALFORMED'
            WHEN nested.invalid_value_count > 0 THEN 'MALFORMED'
            WHEN nested.value_count = 0 THEN 'EMPTY'
            WHEN nested.distinct_ref_count > 1 THEN 'CONFLICT'
            ELSE 'SINGLE'
        END AS nested_tag_state
    FROM nested_stats nested
),
findings AS (
    SELECT 'MALFORMED'::TEXT AS category,
           count(*)::BIGINT AS finding_count,
           'DEXTER_DECISION_REQUIRED'::TEXT AS disposition
    FROM resolved
    WHERE item_tag_state = 'MALFORMED'
    UNION ALL
    SELECT 'CONFLICT_ITEM_MULTI'::TEXT,
           count(*)::BIGINT,
           'DEXTER_DECISION_REQUIRED'::TEXT
    FROM resolved
    WHERE item_tag_state = 'CONFLICT'
    UNION ALL
    SELECT 'CONFLICT_RELATION_EXTRA'::TEXT,
           count(*)::BIGINT,
           'DEXTER_DECISION_REQUIRED'::TEXT
    FROM resolved
    WHERE resolution = 'CONFLICT'
      AND item_tag_state NOT IN ('MALFORMED', 'CONFLICT')
      AND (
            relation_count > 1
         OR (item_tag_state = 'SINGLE' AND relation_count = 1 AND canonical_ref IS NULL)
      )
    UNION ALL
    SELECT 'MALFORMED'::TEXT,
           count(*)::BIGINT,
           'DEXTER_DECISION_REQUIRED'::TEXT
    FROM nested_classified nested
    WHERE nested.nested_tag_state = 'MALFORMED'
    UNION ALL
    SELECT 'CONFLICT_SKU_CLEAR'::TEXT,
           count(*)::BIGINT,
           'DEXTER_DECISION_REQUIRED'::TEXT
    FROM nested_classified nested
    JOIN resolved item ON item.item_ref = nested.item_ref
    WHERE nested.source_kind = 'SKU'
      AND nested.nested_tag_state = 'EMPTY'
      AND item.canonical_ref IS NOT NULL
    UNION ALL
    SELECT 'CONFLICT_NESTED_DIFFERENT'::TEXT,
           count(*)::BIGINT,
           'DEXTER_DECISION_REQUIRED'::TEXT
    FROM nested_classified nested
    JOIN resolved item ON item.item_ref = nested.item_ref
    WHERE nested.nested_tag_state = 'SINGLE'
      AND (
            item.canonical_ref IS NULL
         OR nested.nested_tag_ref <> item.canonical_ref
      )
    UNION ALL
    SELECT 'EMPTY', count(*)::BIGINT, 'SAFE'::TEXT
    FROM resolved
    WHERE resolution = 'RESOLVED' AND canonical_ref IS NULL
    UNION ALL
    SELECT 'SAFE_SINGLE', count(*)::BIGINT, 'SAFE'::TEXT
    FROM resolved
    WHERE resolution = 'RESOLVED'
      AND canonical_ref IS NOT NULL
      AND NOT (relation_count = 0 AND item_tag_state = 'SINGLE')
    UNION ALL
    SELECT 'SAFE_RELATION_REPAIR', count(*)::BIGINT, 'SAFE'::TEXT
    FROM resolved
    WHERE resolution = 'RESOLVED'
      AND canonical_ref IS NOT NULL
      AND relation_count = 0
      AND item_tag_state = 'SINGLE'
    UNION ALL
    SELECT 'SAFE_REDUNDANT_NESTED', count(*)::BIGINT, 'SAFE'::TEXT
    FROM nested_classified nested
    JOIN resolved item ON item.item_ref = nested.item_ref
    WHERE (
            nested.nested_tag_state = 'EMPTY'
        AND (nested.source_kind = 'OPTION' OR item.canonical_ref IS NULL)
       )
       OR (
            nested.nested_tag_state = 'SINGLE'
        AND item.canonical_ref IS NOT NULL
        AND nested.nested_tag_ref = item.canonical_ref
       )
)
SELECT category, finding_count, disposition
FROM findings
WHERE finding_count > 0
$$;

DO $$
DECLARE
    finding RECORD;
    blocking_count BIGINT := 0;
BEGIN
    FOR finding IN SELECT * FROM pg_temp.catalog_production_tag_migration_preflight() LOOP
        RAISE NOTICE 'CATALOG_PRODUCTION_TAG_PREFLIGHT category=% count=% disposition=%',
            finding.category, finding.finding_count, finding.disposition;
        IF finding.disposition = 'DEXTER_DECISION_REQUIRED' THEN
            blocking_count := blocking_count + finding.finding_count;
        END IF;
    END LOOP;
    IF blocking_count > 0 THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_PREFLIGHT_FAILED blocking_categories=%', blocking_count;
    END IF;
END
$$;

-- The old checks require the retiring tag fields.  They are removed only after the
-- read-only preflight has passed; the replacement checks are installed after DML.
ALTER TABLE catalog.catalog_item
    DROP CONSTRAINT ck_catalog_item_preparation_profile;
ALTER TABLE catalog.catalog_sku
    DROP CONSTRAINT ck_catalog_sku_preparation_override;
ALTER TABLE catalog.catalog_item_order_option_value_override
    DROP CONSTRAINT ck_catalog_item_option_preparation_effect;

-- Re-run the exact same predicate inside the same Flyway transaction before any DML.
DO $$
DECLARE
    finding RECORD;
    blocking_count BIGINT := 0;
BEGIN
    FOR finding IN SELECT * FROM pg_temp.catalog_production_tag_migration_preflight() LOOP
        RAISE NOTICE 'CATALOG_PRODUCTION_TAG_PREFLIGHT_RECHECK category=% count=% disposition=%',
            finding.category, finding.finding_count, finding.disposition;
        IF finding.disposition = 'DEXTER_DECISION_REQUIRED' THEN
            blocking_count := blocking_count + finding.finding_count;
        END IF;
    END LOOP;
    IF blocking_count > 0 THEN
        RAISE EXCEPTION 'CATALOG_PRODUCTION_TAG_PREFLIGHT_RECHECK_FAILED blocking_categories=%', blocking_count;
    END IF;
END
$$;

DELETE FROM catalog.catalog_item_reference
WHERE kind = 'PRODUCTION_TAG';

INSERT INTO catalog.catalog_item_reference(item_ref, kind, ref)
SELECT item_ref, 'PRODUCTION_TAG', canonical_ref
FROM pg_temp.catalog_production_tag_resolution()
WHERE resolution = 'RESOLVED'
  AND canonical_ref IS NOT NULL;

UPDATE catalog.catalog_item
SET preparation_profile = preparation_profile - 'productionTagRefs'
WHERE preparation_profile IS NOT NULL;

UPDATE catalog.catalog_sku
SET preparation_override = jsonb_set(
        preparation_override,
        '{profile}',
        (preparation_override -> 'profile') - 'productionTagRefs',
        TRUE
    )
WHERE preparation_override IS NOT NULL
  AND jsonb_typeof(preparation_override -> 'profile') = 'object';

UPDATE catalog.catalog_item_order_option_value_override
SET preparation_effect = preparation_effect - 'addProductionTagRefs'
WHERE preparation_effect IS NOT NULL;

ALTER TABLE catalog.catalog_item
    ADD CONSTRAINT ck_catalog_item_preparation_profile
    CHECK (
        preparation_profile IS NULL
        OR (
            jsonb_typeof(preparation_profile) = 'object'
            AND (preparation_profile - 'productionDisplayName'
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
            AND (
                preparation_override -> 'profile' IS NULL
                OR ((preparation_override -> 'profile') - 'productionDisplayName'
                    - 'estimatedPreparationSeconds' - 'preparationNotes') = '{}'::jsonb
            )
        )
    );

ALTER TABLE catalog.catalog_item_order_option_value_override
    ADD CONSTRAINT ck_catalog_item_option_preparation_effect
    CHECK (
        preparation_effect IS NULL
        OR (
            jsonb_typeof(preparation_effect) = 'object'
            AND (preparation_effect - 'instruction' - 'preparationSecondsDelta') = '{}'::jsonb
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

CREATE UNIQUE INDEX ux_catalog_item_reference_production_tag_item_ref
    ON catalog.catalog_item_reference (item_ref)
    WHERE kind = 'PRODUCTION_TAG';
