-- Categories already own opaque UUID primary keys.  This migration moves their
-- hierarchy and product relations to those keys before any category may be
-- physically deleted and its business code reused.
ALTER TABLE catalog.catalog_category
    ADD COLUMN IF NOT EXISTS parent_category_ref UUID,
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

UPDATE catalog.catalog_category child
SET parent_category_ref = parent.category_ref
FROM catalog.catalog_category parent
WHERE child.parent_category_ref IS NULL
  AND child.parent_code IS NOT NULL
  AND parent.data_node_ref = child.data_node_ref
  AND parent.brand_ref = child.brand_ref
  AND parent.code = child.parent_code;

DO $$
DECLARE
    dangling RECORD;
BEGIN
    SELECT child.data_node_ref, child.brand_ref, child.code, child.parent_code
      INTO dangling
      FROM catalog.catalog_category child
     WHERE child.parent_code IS NOT NULL
       AND child.parent_category_ref IS NULL
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'CATEGORY_PARENT_MAPPING_UNRESOLVED scope=% brand=% category=% parentCode=%',
            dangling.data_node_ref, dangling.brand_ref, dangling.code, dangling.parent_code;
    END IF;
END $$;

-- R08 must precede every relationship path that resolves an item-local SKU ref.
DO $$
DECLARE item_row RECORD; sku JSONB; rebuilt JSONB;
BEGIN
  FOR item_row IN SELECT item_ref, sections FROM catalog.catalog_item WHERE sections ? 'skus' LOOP
    IF jsonb_typeof(item_row.sections->'skus') <> 'array' THEN RAISE EXCEPTION 'SKU_REFERENCE_MAPPING_UNRESOLVED item=%', item_row.item_ref; END IF;
    rebuilt := '[]'::jsonb;
    FOR sku IN SELECT value FROM jsonb_array_elements(item_row.sections->'skus') LOOP
      IF COALESCE(sku->>'productSkuRef','') = '' AND COALESCE(sku->>'skuCode',sku->>'code','') = '' THEN RAISE EXCEPTION 'SKU_REFERENCE_MAPPING_UNRESOLVED item=% missing skuCode', item_row.item_ref; END IF;
      rebuilt := rebuilt || jsonb_build_array(jsonb_set(sku, '{productSkuRef}', to_jsonb(CASE WHEN COALESCE(sku->>'productSkuRef','') ~* '^[0-9a-f]{8}-' THEN sku->>'productSkuRef' ELSE substr(md5(item_row.item_ref::text || ':' || COALESCE(sku->>'skuCode',sku->>'code')),1,8)||'-'||substr(md5(item_row.item_ref::text || ':' || COALESCE(sku->>'skuCode',sku->>'code')),9,4)||'-4'||substr(md5(item_row.item_ref::text || ':' || COALESCE(sku->>'skuCode',sku->>'code')),14,3)||'-a'||substr(md5(item_row.item_ref::text || ':' || COALESCE(sku->>'skuCode',sku->>'code')),18,3)||'-'||substr(md5(item_row.item_ref::text || ':' || COALESCE(sku->>'skuCode',sku->>'code')),21,12) END), true));
    END LOOP;
    UPDATE catalog.catalog_item SET sections=jsonb_set(sections,'{skus}',rebuilt,true) WHERE item_ref=item_row.item_ref;
  END LOOP;
END $$;

-- R09: composite components persist their catalog item/SKU identities as scoped opaque refs.
-- Legacy code fields remain labels only after the exact, same-scope conversion.
DO $$
DECLARE
    item_row RECORD;
    group_value JSONB;
    component JSONB;
    source_components JSONB;
    rebuilt_groups JSONB;
    rebuilt_components JSONB;
    raw_item_text TEXT;
    raw_sku_text TEXT;
    resolved_item_ref UUID;
    resolved_sku_ref UUID;
BEGIN
    FOR item_row IN
        SELECT item_ref, data_node_ref, brand_ref, sections
          FROM catalog.catalog_item
         WHERE sections ? 'compositeGroups'
    LOOP
        IF jsonb_typeof(item_row.sections -> 'compositeGroups') <> 'array' THEN
            RAISE EXCEPTION 'COMPOSITE_COMPONENT_REFERENCE_MAPPING_UNRESOLVED item=%: compositeGroups must be an array', item_row.item_ref;
        END IF;
        rebuilt_groups := '[]'::jsonb;
        FOR group_value IN SELECT value FROM jsonb_array_elements(item_row.sections -> 'compositeGroups') AS value LOOP
            IF jsonb_typeof(group_value) <> 'object' THEN
                RAISE EXCEPTION 'COMPOSITE_COMPONENT_REFERENCE_MAPPING_UNRESOLVED item=%: composite group must be an object', item_row.item_ref;
            END IF;
            source_components := CASE
                WHEN group_value ? 'components' THEN group_value -> 'components'
                WHEN group_value ? 'items' THEN group_value -> 'items'
                ELSE NULL
            END;
            IF source_components IS NULL OR jsonb_typeof(source_components) <> 'array' THEN
                RAISE EXCEPTION 'COMPOSITE_COMPONENT_REFERENCE_MAPPING_UNRESOLVED item=%: components must be an array', item_row.item_ref;
            END IF;
            rebuilt_components := '[]'::jsonb;
            FOR component IN SELECT value FROM jsonb_array_elements(source_components) AS value LOOP
                IF jsonb_typeof(component) <> 'object' THEN
                    RAISE EXCEPTION 'COMPOSITE_COMPONENT_REFERENCE_MAPPING_UNRESOLVED item=%: component must be an object', item_row.item_ref;
                END IF;
                raw_item_text := COALESCE(component ->> 'itemRef', component ->> 'componentItemRef', component ->> 'componentItemCode', component ->> 'itemCode', component ->> 'componentCode', '');
                IF raw_item_text = '' AND component ? 'itemRefs' THEN
                    IF jsonb_typeof(component -> 'itemRefs') <> 'array' OR jsonb_array_length(component -> 'itemRefs') <> 1 OR jsonb_typeof(component -> 'itemRefs' -> 0) <> 'string' THEN
                        RAISE EXCEPTION 'COMPOSITE_COMPONENT_REFERENCE_MAPPING_UNRESOLVED item=%: itemRefs must contain exactly one string', item_row.item_ref;
                    END IF;
                    raw_item_text := component -> 'itemRefs' ->> 0;
                END IF;
                IF raw_item_text = '' THEN
                    RAISE EXCEPTION 'COMPOSITE_COMPONENT_ITEM_REFERENCE_MAPPING_UNRESOLVED item=%: component item ref is required', item_row.item_ref;
                END IF;
                BEGIN
                    SELECT target.item_ref INTO STRICT resolved_item_ref
                      FROM catalog.catalog_item target
                     WHERE target.data_node_ref = item_row.data_node_ref
                       AND target.brand_ref = item_row.brand_ref
                       AND (target.item_ref::text = raw_item_text OR target.code = raw_item_text);
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        RAISE EXCEPTION 'COMPOSITE_COMPONENT_ITEM_REFERENCE_MAPPING_UNRESOLVED scope=% brand=% item=% value=%', item_row.data_node_ref, item_row.brand_ref, item_row.item_ref, raw_item_text;
                    WHEN TOO_MANY_ROWS THEN
                        RAISE EXCEPTION 'COMPOSITE_COMPONENT_ITEM_REFERENCE_MAPPING_AMBIGUOUS scope=% brand=% item=% value=%', item_row.data_node_ref, item_row.brand_ref, item_row.item_ref, raw_item_text;
                END;
                raw_sku_text := COALESCE(component ->> 'productSkuRef', component ->> 'skuRef', component ->> 'skuCode', component ->> 'sku', '');
                resolved_sku_ref := NULL;
                IF raw_sku_text <> '' THEN
                    BEGIN
                        SELECT (sku.value ->> 'productSkuRef')::uuid INTO STRICT resolved_sku_ref
                          FROM catalog.catalog_item target
                          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(target.sections -> 'skus', '[]'::jsonb)) AS sku(value)
                         WHERE target.data_node_ref = item_row.data_node_ref
                           AND target.brand_ref = item_row.brand_ref
                           AND target.item_ref = resolved_item_ref
                           AND (sku.value ->> 'productSkuRef' = raw_sku_text OR sku.value ->> 'skuCode' = raw_sku_text OR sku.value ->> 'code' = raw_sku_text)
                           AND (sku.value ->> 'productSkuRef') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
                    EXCEPTION
                        WHEN NO_DATA_FOUND THEN
                            RAISE EXCEPTION 'COMPOSITE_COMPONENT_PRODUCT_SKU_REFERENCE_MAPPING_UNRESOLVED item=% componentItemRef=% sku=%', item_row.item_ref, resolved_item_ref, raw_sku_text;
                        WHEN TOO_MANY_ROWS THEN
                            RAISE EXCEPTION 'COMPOSITE_COMPONENT_PRODUCT_SKU_REFERENCE_MAPPING_AMBIGUOUS item=% componentItemRef=% sku=%', item_row.item_ref, resolved_item_ref, raw_sku_text;
                    END;
                END IF;
                component := jsonb_set(component, '{itemRef}', to_jsonb(resolved_item_ref::text), true);
                component := jsonb_set(component, '{productSkuRef}', COALESCE(to_jsonb(resolved_sku_ref::text), 'null'::jsonb), true);
                rebuilt_components := rebuilt_components || jsonb_build_array(component);
            END LOOP;
            group_value := group_value - 'items';
            group_value := jsonb_set(group_value, '{components}', rebuilt_components, true);
            rebuilt_groups := rebuilt_groups || jsonb_build_array(group_value);
        END LOOP;
        UPDATE catalog.catalog_item
           SET sections = jsonb_set(sections, '{compositeGroups}', rebuilt_groups, true)
         WHERE item_ref = item_row.item_ref;
    END LOOP;
END $$;

-- R12: order-option values are dictionary-owned opaque UUIDs. `optionValueRefs`
-- may be a legacy array of raw values, but it must still resolve exactly once.
DO $$
DECLARE
    item_row RECORD;
    group_value JSONB;
    option_value JSONB;
    source_values JSONB;
    rebuilt_groups JSONB;
    rebuilt_values JSONB;
    raw_value_text TEXT;
    resolved_value_ref UUID;
BEGIN
    FOR item_row IN
        SELECT item_ref, data_node_ref, brand_ref, sections
          FROM catalog.catalog_item
         WHERE sections ? 'orderOptions'
    LOOP
        IF jsonb_typeof(item_row.sections -> 'orderOptions') <> 'array' THEN
            RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%: orderOptions must be an array', item_row.item_ref;
        END IF;
        rebuilt_groups := '[]'::jsonb;
        FOR group_value IN SELECT value FROM jsonb_array_elements(item_row.sections -> 'orderOptions') AS value LOOP
            IF jsonb_typeof(group_value) <> 'object' THEN
                RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%: order option group must be an object', item_row.item_ref;
            END IF;
            source_values := CASE
                WHEN group_value ? 'values' THEN group_value -> 'values'
                WHEN group_value ? 'options' THEN group_value -> 'options'
                WHEN group_value ? 'optionValues' THEN group_value -> 'optionValues'
                WHEN group_value ? 'optionValueRefs' THEN group_value -> 'optionValueRefs'
                ELSE NULL
            END;
            IF source_values IS NULL OR jsonb_typeof(source_values) <> 'array' THEN
                RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%: values must be an array', item_row.item_ref;
            END IF;
            rebuilt_values := '[]'::jsonb;
            FOR option_value IN SELECT source.value FROM jsonb_array_elements(source_values) AS source(value) LOOP
                IF jsonb_typeof(option_value) = 'string' THEN
                    raw_value_text := option_value #>> '{}';
                    option_value := jsonb_build_object('attributeValueRef', raw_value_text);
                ELSIF jsonb_typeof(option_value) = 'object' THEN
                    raw_value_text := COALESCE(option_value ->> 'attributeValueRef', option_value ->> 'valueRef', option_value ->> 'optionValueRef', option_value ->> 'optionValueCode', option_value ->> 'valueCode', option_value ->> 'code', '');
                ELSE
                    RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%: option value must be a string or object', item_row.item_ref;
                END IF;
                IF raw_value_text = '' THEN
                    RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%: option value ref is required', item_row.item_ref;
                END IF;
                BEGIN
                    SELECT entry_ref INTO STRICT resolved_value_ref
                      FROM catalog.dictionary_entry entry
                     WHERE entry.data_node_ref = item_row.data_node_ref
                       AND entry.brand_ref = item_row.brand_ref
                       AND entry.dictionary_kind = 'SKU_ATTRIBUTE_VALUE'
                       AND entry.status <> 'VOIDED'
                       AND (entry.entry_ref::text = raw_value_text OR entry.code = raw_value_text);
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED scope=% brand=% item=% value=%', item_row.data_node_ref, item_row.brand_ref, item_row.item_ref, raw_value_text;
                    WHEN TOO_MANY_ROWS THEN
                        RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_AMBIGUOUS scope=% brand=% item=% value=%', item_row.data_node_ref, item_row.brand_ref, item_row.item_ref, raw_value_text;
                END;
                option_value := jsonb_set(option_value, '{attributeValueRef}', to_jsonb(resolved_value_ref::text), true);
                rebuilt_values := rebuilt_values || jsonb_build_array(option_value);
            END LOOP;
            group_value := group_value - 'options' - 'optionValues' - 'optionValueRefs';
            group_value := jsonb_set(group_value, '{values}', rebuilt_values, true);
            rebuilt_groups := rebuilt_groups || jsonb_build_array(group_value);
        END LOOP;
        UPDATE catalog.catalog_item
           SET sections = jsonb_set(sections, '{orderOptions}', rebuilt_groups, true)
         WHERE item_ref = item_row.item_ref;
    END LOOP;
END $$;

-- Declared R09/R12 persistence paths must now contain UUID values only.
DO $$
DECLARE bad RECORD;
BEGIN
    SELECT item.item_ref INTO bad
      FROM catalog.catalog_item item,
           LATERAL jsonb_array_elements(COALESCE(item.sections -> 'compositeGroups', '[]'::jsonb)) group_value,
           LATERAL jsonb_array_elements(COALESCE(group_value -> 'components', '[]'::jsonb)) component
     WHERE COALESCE(component ->> 'itemRef', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (component ->> 'productSkuRef' IS NOT NULL AND component ->> 'productSkuRef' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
     LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'COMPOSITE_COMPONENT_REFERENCE_MAPPING_UNRESOLVED item=%', bad.item_ref; END IF;

    SELECT item.item_ref INTO bad
      FROM catalog.catalog_item item,
           LATERAL jsonb_array_elements(COALESCE(item.sections -> 'orderOptions', '[]'::jsonb)) AS option_group(group_json),
           LATERAL jsonb_array_elements(COALESCE(option_group.group_json -> 'values', '[]'::jsonb)) AS option_entry(value_json)
     WHERE COALESCE(option_entry.value_json ->> 'attributeValueRef', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'ORDER_OPTION_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%', bad.item_ref; END IF;
END $$;

-- R11: production tag detail rows retain labels but persist their relationship in tagRef.
DO $$
DECLARE item_row RECORD; tag JSONB; rebuilt JSONB; value_text TEXT; resolved UUID;
BEGIN
  FOR item_row IN SELECT item_ref,data_node_ref,brand_ref,sections FROM catalog.catalog_item WHERE sections ? 'productionTags' LOOP
    IF jsonb_typeof(item_row.sections->'productionTags') <> 'array' THEN RAISE EXCEPTION 'PRODUCTION_TAG_DETAIL_MAPPING_UNRESOLVED item=%',item_row.item_ref; END IF;
    rebuilt := '[]'::jsonb;
    FOR tag IN SELECT value FROM jsonb_array_elements(item_row.sections->'productionTags') LOOP
      value_text := COALESCE(tag->>'tagRef',tag->>'code');
      IF value_text IS NULL OR value_text='' THEN RAISE EXCEPTION 'PRODUCTION_TAG_DETAIL_MAPPING_UNRESOLVED item=%',item_row.item_ref; END IF;
      BEGIN SELECT tag_ref INTO STRICT resolved FROM fulfillment_production.production_tag_definition definition WHERE definition.data_node_ref=item_row.data_node_ref AND definition.brand_ref=item_row.brand_ref AND (definition.tag_ref::text=value_text OR definition.code=value_text) AND definition.status <> 'VOIDED'; EXCEPTION WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'PRODUCTION_TAG_DETAIL_MAPPING_UNRESOLVED item=%',item_row.item_ref; WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'PRODUCTION_TAG_DETAIL_MAPPING_AMBIGUOUS item=%',item_row.item_ref; END;
      rebuilt := rebuilt || jsonb_build_array(jsonb_set(tag,'{tagRef}',to_jsonb(resolved::text),true));
    END LOOP;
    UPDATE catalog.catalog_item SET sections=jsonb_set(sections,'{productionTags}',rebuilt,true) WHERE item_ref=item_row.item_ref;
  END LOOP;
END $$;

-- R07: production tag arrays are cross-owner opaque refs; resolve only in the same scope and brand.
DO $$
DECLARE item_row RECORD; raw JSONB; value_text TEXT; resolved UUID; rebuilt JSONB;
BEGIN
  FOR item_row IN SELECT item_ref,data_node_ref,brand_ref,sections FROM catalog.catalog_item WHERE sections ? 'productionTagRefs' LOOP
    IF jsonb_typeof(item_row.sections->'productionTagRefs') <> 'array' THEN RAISE EXCEPTION 'PRODUCTION_TAG_REFERENCE_MAPPING_UNRESOLVED item=%',item_row.item_ref; END IF;
    rebuilt := '[]'::jsonb;
    FOR raw IN SELECT value FROM jsonb_array_elements(item_row.sections->'productionTagRefs') LOOP
      value_text := raw#>>'{}';
      BEGIN SELECT tag_ref INTO STRICT resolved FROM fulfillment_production.production_tag_definition tag WHERE tag.data_node_ref=item_row.data_node_ref AND tag.brand_ref=item_row.brand_ref AND (tag.tag_ref::text=value_text OR tag.code=value_text) AND tag.status <> 'VOIDED'; EXCEPTION WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'PRODUCTION_TAG_REFERENCE_MAPPING_UNRESOLVED item=% value=%',item_row.item_ref,value_text; WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'PRODUCTION_TAG_REFERENCE_MAPPING_AMBIGUOUS item=% value=%',item_row.item_ref,value_text; END;
      rebuilt := rebuilt || jsonb_build_array(resolved::text);
    END LOOP;
    UPDATE catalog.catalog_item SET sections=jsonb_set(sections,'{productionTagRefs}',rebuilt,true) WHERE item_ref=item_row.item_ref;
  END LOOP;
END $$;

-- R05/R06: SKU dimensions and SKU rows store dictionary entry UUIDs.
DO $$
DECLARE item_row RECORD; dimension JSONB; attribute_value JSONB; sku JSONB; rebuilt_dimensions JSONB; rebuilt_values JSONB; rebuilt_skus JSONB; raw_text TEXT; resolved UUID;
BEGIN
  FOR item_row IN SELECT item_ref,data_node_ref,brand_ref,sections FROM catalog.catalog_item LOOP
    IF item_row.sections ? 'skuVariantDimensions' THEN
      IF jsonb_typeof(item_row.sections->'skuVariantDimensions') <> 'array' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_REFERENCE_MAPPING_UNRESOLVED item=%', item_row.item_ref; END IF;
      rebuilt_dimensions := '[]'::jsonb;
      FOR dimension IN SELECT value FROM jsonb_array_elements(item_row.sections->'skuVariantDimensions') LOOP
        raw_text := COALESCE(dimension->>'attributeRef',dimension->>'attributeCode',dimension->>'dimensionCode','');
        IF raw_text = '' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_REFERENCE_MAPPING_UNRESOLVED item=% missing attribute', item_row.item_ref; END IF;
        BEGIN SELECT entry_ref INTO STRICT resolved FROM catalog.dictionary_entry entry WHERE entry.data_node_ref=item_row.data_node_ref AND entry.brand_ref=item_row.brand_ref AND entry.dictionary_kind='SKU_ATTRIBUTE' AND (entry.entry_ref::text=raw_text OR entry.code=raw_text) AND entry.status <> 'VOIDED'; EXCEPTION WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_REFERENCE_MAPPING_UNRESOLVED item=% value=%',item_row.item_ref,raw_text; WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_REFERENCE_MAPPING_AMBIGUOUS item=% value=%',item_row.item_ref,raw_text; END;
        dimension := jsonb_set(dimension,'{attributeRef}',to_jsonb(resolved::text),true);
        IF dimension ? 'values' THEN
          IF jsonb_typeof(dimension->'values') <> 'array' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%',item_row.item_ref; END IF;
          rebuilt_values := '[]'::jsonb;
          FOR attribute_value IN SELECT dimension_value.value FROM jsonb_array_elements(dimension->'values') AS dimension_value(value) LOOP
            raw_text := COALESCE(attribute_value->>'valueRef',attribute_value->>'attributeValueRef',attribute_value->>'valueCode',attribute_value->>'attributeValueCode',attribute_value->>'code','');
            IF raw_text = '' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=% missing value',item_row.item_ref; END IF;
            BEGIN SELECT entry_ref INTO STRICT resolved FROM catalog.dictionary_entry entry WHERE entry.data_node_ref=item_row.data_node_ref AND entry.brand_ref=item_row.brand_ref AND entry.dictionary_kind='SKU_ATTRIBUTE_VALUE' AND (entry.entry_ref::text=raw_text OR entry.code=raw_text) AND entry.status <> 'VOIDED'; EXCEPTION WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=% value=%',item_row.item_ref,raw_text; WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_AMBIGUOUS item=% value=%',item_row.item_ref,raw_text; END;
            rebuilt_values := rebuilt_values || jsonb_build_array(jsonb_set(attribute_value,'{valueRef}',to_jsonb(resolved::text),true));
          END LOOP;
          dimension := jsonb_set(dimension,'{values}',rebuilt_values,true);
        END IF;
        rebuilt_dimensions := rebuilt_dimensions || jsonb_build_array(dimension);
      END LOOP;
      UPDATE catalog.catalog_item SET sections=jsonb_set(sections,'{skuVariantDimensions}',rebuilt_dimensions,true) WHERE item_ref=item_row.item_ref;
    END IF;
    IF item_row.sections ? 'skus' THEN
      IF jsonb_typeof(item_row.sections->'skus') <> 'array' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%',item_row.item_ref; END IF;
      rebuilt_skus := '[]'::jsonb;
      FOR sku IN SELECT value FROM jsonb_array_elements(item_row.sections->'skus') LOOP
        IF sku ? 'attributeValueRefs' THEN
          IF jsonb_typeof(sku->'attributeValueRefs') <> 'array' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%',item_row.item_ref; END IF;
          rebuilt_values := '[]'::jsonb;
          FOR attribute_value IN SELECT sku_value.value FROM jsonb_array_elements(sku->'attributeValueRefs') AS sku_value(value) LOOP
            raw_text := COALESCE(attribute_value->>'attributeValueRef',attribute_value->>'valueRef',attribute_value->>'valueCode',attribute_value->>'attributeValueCode','');
            IF raw_text = '' THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=% missing value',item_row.item_ref; END IF;
            BEGIN SELECT entry_ref INTO STRICT resolved FROM catalog.dictionary_entry entry WHERE entry.data_node_ref=item_row.data_node_ref AND entry.brand_ref=item_row.brand_ref AND entry.dictionary_kind='SKU_ATTRIBUTE_VALUE' AND (entry.entry_ref::text=raw_text OR entry.code=raw_text) AND entry.status <> 'VOIDED'; EXCEPTION WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=% value=%',item_row.item_ref,raw_text; WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_AMBIGUOUS item=% value=%',item_row.item_ref,raw_text; END;
            rebuilt_values := rebuilt_values || jsonb_build_array(jsonb_set(attribute_value,'{attributeValueRef}',to_jsonb(resolved::text),true));
          END LOOP;
          sku := jsonb_set(sku,'{attributeValueRefs}',rebuilt_values,true);
        END IF;
        rebuilt_skus := rebuilt_skus || jsonb_build_array(sku);
      END LOOP;
      UPDATE catalog.catalog_item SET sections=jsonb_set(sections,'{skus}',rebuilt_skus,true) WHERE item_ref=item_row.item_ref;
    END IF;
  END LOOP;
END $$;

-- R05/R06 require the post-backfill form; legacy dimension/value codes are rejected rather than persisted as identities.
DO $$
DECLARE bad RECORD;
BEGIN
  SELECT item_ref INTO bad FROM catalog.catalog_item item, LATERAL jsonb_array_elements(COALESCE(item.sections->'skuVariantDimensions','[]'::jsonb)) dimension
   WHERE COALESCE(dimension->>'attributeRef','') <> '' AND dimension->>'attributeRef' !~* '^[0-9a-f]{8}-';
  IF FOUND THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_REFERENCE_MAPPING_UNRESOLVED item=%',bad.item_ref; END IF;
  SELECT item_ref INTO bad FROM catalog.catalog_item item, LATERAL jsonb_array_elements(COALESCE(item.sections->'skus','[]'::jsonb)) AS sku(value_json), LATERAL jsonb_array_elements(COALESCE(sku.value_json->'attributeValueRefs','[]'::jsonb)) AS sku_attribute_value(value_json)
   WHERE COALESCE(sku_attribute_value.value_json->>'attributeValueRef','') <> '' AND sku_attribute_value.value_json->>'attributeValueRef' !~* '^[0-9a-f]{8}-';
  IF FOUND THEN RAISE EXCEPTION 'SKU_ATTRIBUTE_VALUE_REFERENCE_MAPPING_UNRESOLVED item=%',bad.item_ref; END IF;
END $$;

-- R03/R04: dictionary relationship arrays resolve exactly once within the catalog owner scope.
DO $$
DECLARE item_row RECORD; path_name TEXT; v_dictionary_kind TEXT; raw JSONB; value_text TEXT; resolved UUID; rebuilt JSONB;
BEGIN
  FOR item_row IN SELECT item_ref,data_node_ref,brand_ref,sections FROM catalog.catalog_item LOOP
    FOR path_name,v_dictionary_kind IN SELECT * FROM (VALUES ('tagRefs','TAG'),('salesUnitRefs','SALES_UNIT')) AS p(path_name,v_dictionary_kind) LOOP
      IF NOT (item_row.sections ? path_name) THEN CONTINUE; END IF;
      IF jsonb_typeof(item_row.sections->path_name) <> 'array' THEN RAISE EXCEPTION 'DICTIONARY_REFERENCE_MAPPING_UNRESOLVED item=% path=%',item_row.item_ref,path_name; END IF;
      rebuilt := '[]'::jsonb;
      FOR raw IN SELECT value FROM jsonb_array_elements(item_row.sections->path_name) LOOP
        value_text := raw#>>'{}';
        BEGIN SELECT entry_ref INTO STRICT resolved FROM catalog.dictionary_entry entry WHERE entry.data_node_ref=item_row.data_node_ref AND entry.brand_ref=item_row.brand_ref AND entry.dictionary_kind=v_dictionary_kind AND (entry.entry_ref::text=value_text OR entry.code=value_text) AND entry.status <> 'VOIDED'; EXCEPTION WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'DICTIONARY_REFERENCE_MAPPING_UNRESOLVED item=% path=% value=%',item_row.item_ref,path_name,value_text; WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'DICTIONARY_REFERENCE_MAPPING_AMBIGUOUS item=% path=% value=%',item_row.item_ref,path_name,value_text; END;
        rebuilt := rebuilt || jsonb_build_array(resolved::text);
      END LOOP;
      UPDATE catalog.catalog_item SET sections=jsonb_set(sections,ARRAY[path_name],rebuilt,true) WHERE item_ref=item_row.item_ref;
    END LOOP;
  END LOOP;
END $$;

WITH ranked AS (
    SELECT category_ref,
           row_number() OVER (
             PARTITION BY data_node_ref, brand_ref, parent_category_ref
             ORDER BY display_order, code, category_ref
           ) - 1 AS next_display_order
      FROM catalog.catalog_category
)
UPDATE catalog.catalog_category category
SET display_order = ranked.next_display_order
FROM ranked
WHERE category.category_ref = ranked.category_ref;

DO $$
DECLARE
    item_row RECORD;
    raw_ref JSONB;
    raw_text TEXT;
    resolved_ref UUID;
    mapped JSONB;
BEGIN
    FOR item_row IN
        SELECT item_ref, data_node_ref, brand_ref, sections
          FROM catalog.catalog_item
         WHERE sections ? 'categoryRefs'
    LOOP
        IF jsonb_typeof(item_row.sections -> 'categoryRefs') <> 'array' THEN
            RAISE EXCEPTION 'CATEGORY_REFERENCE_MAPPING_UNRESOLVED item=%: categoryRefs must be an array', item_row.item_ref;
        END IF;
        mapped := '[]'::jsonb;
        FOR raw_ref IN SELECT value FROM jsonb_array_elements(item_row.sections -> 'categoryRefs') AS value LOOP
            IF jsonb_typeof(raw_ref) <> 'string' THEN
                RAISE EXCEPTION 'CATEGORY_REFERENCE_MAPPING_UNRESOLVED item=%: categoryRefs must contain strings', item_row.item_ref;
            END IF;
            raw_text := raw_ref #>> '{}';
            BEGIN
                SELECT category_ref INTO STRICT resolved_ref
                  FROM catalog.catalog_category
                 WHERE data_node_ref = item_row.data_node_ref
                   AND brand_ref = item_row.brand_ref
                   AND (category_ref::text = raw_text OR code = raw_text);
            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    RAISE EXCEPTION 'CATEGORY_REFERENCE_MAPPING_UNRESOLVED scope=% brand=% item=% value=%',
                        item_row.data_node_ref, item_row.brand_ref, item_row.item_ref, raw_text;
                WHEN TOO_MANY_ROWS THEN
                    RAISE EXCEPTION 'CATEGORY_REFERENCE_MAPPING_AMBIGUOUS scope=% brand=% item=% value=%',
                        item_row.data_node_ref, item_row.brand_ref, item_row.item_ref, raw_text;
            END;
            mapped := mapped || jsonb_build_array(resolved_ref::text);
        END LOOP;
        UPDATE catalog.catalog_item
           SET sections = jsonb_set(sections, '{categoryRefs}', mapped, true)
         WHERE item_ref = item_row.item_ref;
    END LOOP;
END $$;

DO $$
DECLARE
    blocking RECORD;
BEGIN
    SELECT category.data_node_ref, category.brand_ref, category.code, item.item_ref
      INTO blocking
      FROM catalog.catalog_category category
      JOIN catalog.catalog_item item
        ON item.data_node_ref = category.data_node_ref
       AND item.brand_ref = category.brand_ref
       AND item.status <> 'VOIDED'
       AND jsonb_exists(item.sections -> 'categoryRefs', category.category_ref::text)
     WHERE category.status = 'VOIDED'
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'CATEGORY_VOIDED_REFERENCE_BLOCKS_MIGRATION scope=% brand=% category=% item=%',
            blocking.data_node_ref, blocking.brand_ref, blocking.code, blocking.item_ref;
    END IF;
END $$;

UPDATE catalog.catalog_category SET status = 'ENABLED' WHERE status = 'DISABLED';
DELETE FROM catalog.catalog_category WHERE status = 'VOIDED';

CREATE INDEX IF NOT EXISTS ix_catalog_category_scope_parent_ref_order
    ON catalog.catalog_category (data_node_ref, brand_ref, parent_category_ref, display_order, code);
