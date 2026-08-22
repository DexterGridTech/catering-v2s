package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Relational item facts that reference the catalog-owned definition libraries. It intentionally does not re-use
 * {@code dictionary_entry}, the retired item-owned order option tables, or JSON payloads as identities.
 */
final class CatalogItemDefinitionFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogItemDefinitionFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    Map<UUID, ArrayNode> readAttributeAssignments(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, ArrayNode> result = emptyArrays(refs);
        Map<UUID, ObjectNode> assignments = new LinkedHashMap<>();
        jdbc.query(
                "SELECT assignment.item_ref,assignment.item_attribute_assignment_ref,definition.attribute_definitio"
                        + "n_ref,"
                        + "definition.code,definition.name,definition.value_type,assignment.text_value,selection.at"
                        + "tribute_definition_option_ref "
                        + "FROM catalog.catalog_item_attribute_assignment assignment "
                        + "JOIN catalog.catalog_attribute_definition definition ON definition.attribute_definition_"
                        + "ref=assignment.attribute_definition_ref "
                        + "LEFT JOIN catalog.catalog_item_attribute_selection selection ON selection.item_attribute"
                        + "_assignment_ref=assignment.item_attribute_assignment_ref "
                        + "WHERE assignment.item_ref IN ("
                        + placeholders(refs)
                        + ") ORDER BY assignment.item_ref,definition.code,definition.attribute_definition_ref,selec"
                        + "tion.attribute_definition_option_ref",
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        UUID assignmentRef = rows.getObject(2, UUID.class);
                        ObjectNode assignment = assignments.get(assignmentRef);
                        if (assignment == null) {
                            assignment = result.get(itemRef).addObject();
                            assignment.put(
                                    "definitionRef",
                                    rows.getObject(3, UUID.class).toString());
                            assignment.put("code", rows.getString(4));
                            assignment.put("name", rows.getString(5));
                            assignment.put("valueType", rows.getString(6));
                            if (rows.getObject(7) == null) assignment.putNull("textValue");
                            else assignment.put("textValue", rows.getString(7));
                            assignment.putArray("optionRefs");
                            assignments.put(assignmentRef, assignment);
                        }
                        UUID optionRef = rows.getObject(8, UUID.class);
                        if (optionRef != null)
                            assignment.withArray("optionRefs").add(optionRef.toString());
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    Map<UUID, ArrayNode> readOrderOptionConfigs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, ArrayNode> result = emptyArrays(refs);
        Map<UUID, ObjectNode> configs = new LinkedHashMap<>();
        Map<String, ObjectNode> values = new LinkedHashMap<>();
        jdbc.query(
                "SELECT config.item_ref,config.item_order_option_config_ref,definition.order_option_definition_ref,"
                        + "definition.name,definition.selection_mode,config.is_required,config.min_selection_count,"
                        + "config.max_selection_count,"
                        + "value_definition.order_option_definition_value_ref,value_definition.name,value_definitio"
                        + "n.display_order,"
                        + "override.item_order_option_value_override_ref,override.is_default,override.extra_price "
                        + "FROM catalog.catalog_item_order_option_config config "
                        + "JOIN catalog.catalog_order_option_definition definition ON definition.order_option_defin"
                        + "ition_ref=config.order_option_definition_ref "
                        + "JOIN catalog.catalog_order_option_definition_value value_definition ON value_definition."
                        + "order_option_definition_ref=definition.order_option_definition_ref "
                        + "LEFT JOIN catalog.catalog_item_order_option_value_override override ON override.item_ord"
                        + "er_option_config_ref=config.item_order_option_config_ref "
                        + "AND override.order_option_definition_value_ref=value_definition.order_option_definition_"
                        + "value_ref "
                        + "WHERE config.item_ref IN ("
                        + placeholders(refs)
                        + ") ORDER BY config.item_ref,definition.name,definition.order_option_definition_ref,value_"
                        + "definition.display_order,value_definition.order_option_definition_value_ref",
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        UUID configRef = rows.getObject(2, UUID.class);
                        ObjectNode config = configs.get(configRef);
                        if (config == null) {
                            config = result.get(itemRef).addObject();
                            config.put(
                                    "definitionRef",
                                    rows.getObject(3, UUID.class).toString());
                            config.put("name", rows.getString(4));
                            config.put("selectionMode", rows.getString(5));
                            config.put("required", rows.getBoolean(6));
                            if (rows.getObject(7) == null) config.putNull("minSelectionCount");
                            else config.put("minSelectionCount", rows.getInt(7));
                            if (rows.getObject(8) == null) config.putNull("maxSelectionCount");
                            else config.put("maxSelectionCount", rows.getInt(8));
                            config.putArray("values");
                            configs.put(configRef, config);
                        }
                        UUID definitionValueRef = rows.getObject(9, UUID.class);
                        ObjectNode value = values.get(valueKey(configRef, definitionValueRef));
                        if (value == null) {
                            value = config.withArray("values").addObject();
                            value.put("definitionValueRef", definitionValueRef.toString());
                            value.put("name", rows.getString(10));
                            value.put("displayOrder", rows.getInt(11));
                            value.put("defaultValue", rows.getObject(12) != null && rows.getBoolean(13));
                            if (rows.getObject(14) == null) value.putNull("extraPrice");
                            else value.put("extraPrice", rows.getLong(14));
                            values.put(valueKey(configRef, definitionValueRef), value);
                        }
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    /**
     * Local item-copy is same-scope: the option definition/value identities remain the same while the item owner
     * changes. Publish those opaque value mappings in the catalog preflight so inventory can rewrite each option-value
     * BOM owner without treating a missing mapping as permission to guess.
     */
    ArrayNode localCopyOptionValueMappings(UUID itemRef) {
        ArrayNode result = mapper.createArrayNode();
        LinkedHashSet<UUID> relatedItemRefs = new LinkedHashSet<>();
        relatedItemRefs.add(itemRef);
        jdbc.query(
                "SELECT DISTINCT value_definition.order_option_definition_value_ref,value_definition.code "
                        + "FROM catalog.catalog_item_order_option_config config "
                        + "JOIN catalog.catalog_order_option_definition_value value_definition "
                        + "ON value_definition.order_option_definition_ref=config.order_option_definition_ref "
                        + "WHERE config.item_ref=? "
                        + "ORDER BY value_definition.order_option_definition_value_ref",
                rows -> {
                    while (rows.next()) {
                        String valueRef = rows.getObject(1, UUID.class).toString();
                        result.addObject()
                                .put("objectType", "CATALOG_ORDER_OPTION_DEFINITION_VALUE")
                                .put("sourceRef", valueRef)
                                .put("targetRef", valueRef)
                                .put("targetOptionValueCode", rows.getString(2));
                    }
                    return null;
                },
                itemRef);
        jdbc.query(
                "SELECT DISTINCT material.material_item_ref,material_item.code "
                        + "FROM catalog.catalog_item_order_option_config config "
                        + "JOIN catalog.catalog_order_option_definition_value value_definition "
                        + "ON value_definition.order_option_definition_ref=config.order_option_definition_ref "
                        + "JOIN catalog.catalog_order_option_definition_material material "
                        + "ON material.order_option_definition_value_ref=value_definition.order_option_definition_v"
                        + "alue_ref "
                        + "JOIN catalog.catalog_item material_item ON material_item.item_ref=material.material_item"
                        + "_ref "
                        + "WHERE config.item_ref=? "
                        + "ORDER BY material.material_item_ref",
                rows -> {
                    while (rows.next()) {
                        String materialRef = rows.getObject(1, UUID.class).toString();
                        relatedItemRefs.add(UUID.fromString(materialRef));
                        result.addObject()
                                .put("objectType", "CATALOG_ITEM")
                                .put("sourceRef", materialRef)
                                .put("targetRef", materialRef)
                                .put("targetCode", rows.getString(2));
                    }
                    return null;
                },
                itemRef);
        List<UUID> orderedItemRefs = List.copyOf(relatedItemRefs);
        jdbc.query(
                "SELECT product_sku_ref,sku_code FROM catalog.catalog_sku WHERE item_ref IN ("
                        + placeholders(orderedItemRefs)
                        + ") ORDER BY product_sku_ref",
                statement -> bind(statement, orderedItemRefs),
                rows -> {
                    while (rows.next()) {
                        String skuRef = rows.getObject(1, UUID.class).toString();
                        result.addObject()
                                .put("objectType", "PRODUCT_SKU")
                                .put("sourceRef", skuRef)
                                .put("targetRef", skuRef)
                                .put("targetSkuCode", rows.getString(2));
                    }
                    return null;
                });
        return result;
    }

    void replaceAttributeAssignments(String scope, String brand, UUID itemRef, ArrayNode submitted) {
        List<AttributeAssignment> assignments = normalizeAttributes(submitted);
        Map<UUID, AttributeDefinition> definitions = loadAttributeDefinitions(scope, brand, assignments);
        Map<UUID, UUID> existing = jdbc.query(
                "SELECT attribute_definition_ref,item_attribute_assignment_ref FROM catalog.catalog_item_attribute_"
                        + "assignment WHERE item_ref=?",
                rows -> {
                    Map<UUID, UUID> values = new LinkedHashMap<>();
                    while (rows.next()) values.put(rows.getObject(1, UUID.class), rows.getObject(2, UUID.class));
                    return values;
                },
                itemRef);
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        for (AttributeAssignment assignment : assignments) {
            AttributeDefinition definition = required(
                    definitions,
                    assignment.definitionRef(),
                    /* format-wrap */
                    "商品属性定义不存在或不属于当前范围");
            validateAttributeAssignment(definition, assignment);
            retained.add(assignment.definitionRef());
            UUID assignmentRef = existing.get(assignment.definitionRef());
            if (assignmentRef == null) {
                assignmentRef = UUID.randomUUID();
                jdbc.update(
                        "INSERT INTO catalog.catalog_item_attribute_assignment(item_attribute_assignment_ref,item_r"
                                + "ef,attribute_definition_ref,text_value) VALUES(?,?,?,?)",
                        assignmentRef,
                        itemRef,
                        assignment.definitionRef(),
                        assignment.textValue());
            } else {
                jdbc.update(
                        "UPDATE catalog.catalog_item_attribute_assignment SET text_value=? WHERE item_attribute_ass"
                                + "ignment_ref=?",
                        assignment.textValue(),
                        assignmentRef);
                jdbc.update(
                        "DELETE FROM catalog.catalog_item_attribute_selection WHERE item_attribute_assignment_ref=?",
                        assignmentRef);
            }
            for (UUID optionRef : assignment.optionRefs())
                jdbc.update(
                        "INSERT INTO catalog.catalog_item_attribute_selection(item_attribute_assignment_ref,attribu"
                                + "te_definition_option_ref) VALUES(?,?)",
                        assignmentRef,
                        optionRef);
        }
        existing.entrySet().stream()
                .filter(entry -> !retained.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .forEach(ref -> {
                    jdbc.update(
                            "DELETE FROM catalog.catalog_item_attribute_selection WHERE "
                                    + "item_attribute_assignment_ref=?",
                            ref);
                    jdbc.update(
                            "DELETE FROM catalog.catalog_item_attribute_assignment WHERE "
                                    + "item_attribute_assignment_ref=?",
                            ref);
                });
    }

    void replaceOrderOptionConfigs(String scope, String brand, UUID itemRef, ArrayNode submitted) {
        List<OrderOptionConfig> configs = normalizeOrderOptions(submitted);
        Map<UUID, OrderOptionDefinition> definitions = loadOrderOptionDefinitions(scope, brand, configs);
        Map<UUID, UUID> existing = jdbc.query(
                "SELECT order_option_definition_ref,item_order_option_config_ref FROM catalog.catalog_item_order_op"
                        + "tion_config WHERE item_ref=?",
                rows -> {
                    Map<UUID, UUID> values = new LinkedHashMap<>();
                    while (rows.next()) values.put(rows.getObject(1, UUID.class), rows.getObject(2, UUID.class));
                    return values;
                },
                itemRef);
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        for (OrderOptionConfig config : configs) {
            OrderOptionDefinition definition = required(
                    definitions,
                    config.definitionRef(),
                    /* format-wrap */
                    "点单选项定义不存在或不属于当前范围");
            validateOrderOptionConfig(definition, config);
            retained.add(config.definitionRef());
            UUID configRef = existing.get(config.definitionRef());
            if (configRef == null) {
                configRef = UUID.randomUUID();
                jdbc.update(
                        "INSERT INTO catalog.catalog_item_order_option_config(item_order_option_config_ref,item_ref"
                                +
                                /* format-wrap */
                                ",order_option_definition_ref,is_required,min_selection_count,"
                                +
                                /* format-wrap */
                                "max_selection_count) VALU"
                                + "ES(?,?,?,?,?,?)",
                        configRef,
                        itemRef,
                        config.definitionRef(),
                        config.required(),
                        config.minSelectionCount(),
                        config.maxSelectionCount());
            } else {
                jdbc.update(
                        "UPDATE catalog.catalog_item_order_option_config SET is_required=?,min_selection_count=?,ma"
                                + "x_selection_count=? WHERE item_order_option_config_ref=?",
                        config.required(),
                        config.minSelectionCount(),
                        config.maxSelectionCount(),
                        configRef);
                deleteOrderOptionConfigChildren(configRef);
            }
            for (OrderOptionValueOverride override : config.values()) {
                UUID overrideRef = UUID.randomUUID();
                jdbc.update(
                        "INSERT INTO catalog.catalog_item_order_option_value_override(item_order_option_value_overr"
                                +
                                /* format-wrap */
                                "ide_ref,item_order_option_config_ref,order_option_definition_value_ref,"
                                +
                                /* format-wrap */
                                "is_default,extr"
                                + "a_price) VALUES(?,?,?,?,?)",
                        overrideRef,
                        configRef,
                        override.definitionValueRef(),
                        override.isDefault(),
                        override.extraPrice());
            }
        }
        existing.entrySet().stream()
                .filter(entry -> !retained.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .forEach(ref -> {
                    deleteOrderOptionConfigChildren(ref);
                    jdbc.update(
                            "DELETE FROM catalog.catalog_item_order_option_config WHERE "
                                    + "item_order_option_config_ref=?",
                            ref);
                });
    }

    private void deleteOrderOptionConfigChildren(UUID configRef) {
        jdbc.update(
                "DELETE FROM catalog.catalog_item_order_option_value_override WHERE "
                        + "item_order_option_config_ref=?",
                configRef);
    }

    /**
     * A temporary item promoted under a new code remains in the same catalog scope. Its library references are
     * therefore already canonical: copy the current relational facts instead of serializing a legacy JSON fallback.
     * Inventory-owned option-value BOM rows are deliberately copied by the application coordinator.
     */
    void copyCurrentFactsWithinScope(String scope, String brand, UUID sourceItemRef, UUID targetItemRef) {
        ArrayNode sourceAssignments =
                readAttributeAssignments(List.of(sourceItemRef)).get(sourceItemRef);
        ArrayNode sourceConfigs = readOrderOptionConfigs(List.of(sourceItemRef)).get(sourceItemRef);
        replaceAttributeAssignments(
                scope,
                brand,
                targetItemRef,
                sourceAssignments == null ? mapper.createArrayNode() : sourceAssignments.deepCopy());
        replaceOrderOptionConfigs(
                scope,
                brand,
                targetItemRef,
                sourceConfigs == null ? mapper.createArrayNode() : sourceConfigs.deepCopy());
    }

    /**
     * The copy closure follows an option definition through every item configuration, not through an obsolete JSON
     * field. Materials are catalog-item references and must therefore join the normal item closure before inventory may
     * rewrite its option-value BOM owners.
     */
    List<UUID> orderOptionMaterialItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return List.of();
        List<UUID> refs = distinct(itemRefs);
        return jdbc.query(
                "SELECT DISTINCT material.material_item_ref FROM catalog.catalog_item_order_option_config config "
                        + "JOIN catalog.catalog_order_option_definition_value value_row ON value_row.order_option_d"
                        + "efinition_ref=config.order_option_definition_ref "
                        + "JOIN catalog.catalog_order_option_definition_material material ON material.order_option_"
                        + "definition_value_ref=value_row.order_option_definition_value_ref "
                        + "WHERE config.item_ref IN ("
                        + placeholders(refs)
                        + ") ORDER BY material.material_item_ref",
                statement -> bind(statement, refs),
                (rows, index) -> rows.getObject(1, UUID.class));
    }

    /** Returns every unique order-option definition referenced by the supplied item closure. */
    List<CopyOrderOptionDefinition> copyOrderOptionDefinitions(String scope, String brand, Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return List.of();
        List<UUID> refs = distinct(itemRefs);
        List<UUID> definitionRefs = jdbc.query(
                "SELECT DISTINCT definition.order_option_definition_ref FROM catalog.catalog_item_order_option_conf"
                        + "ig config "
                        + "JOIN catalog.catalog_order_option_definition definition ON definition.order_option_defin"
                        + "ition_ref=config.order_option_definition_ref "
                        + "WHERE definition.data_node_ref=? AND definition.brand_ref=? AND config.item_ref IN ("
                        + placeholders(refs)
                        + ") ORDER BY definition.order_option_definition_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                (rows, index) -> rows.getObject(1, UUID.class));
        return loadCopyOrderOptionDefinitions(scope, brand, definitionRefs).values().stream()
                .sorted(java.util.Comparator.comparing(CopyOrderOptionDefinition::code))
                .toList();
    }

    /**
     * Computes the reusable/copyable definition identities without writing. Business code locates an equivalent target
     * definition, while the returned opaque refs are the only relationships later persisted or rewritten.
     */
    OrderOptionCopyPlan planOrderOptionCopy(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Collection<CopyOrderOptionDefinition> sourceDefinitions,
            Map<UUID, UUID> targetItemRefs,
            Map<UUID, UUID> suppliedDefinitionRefs,
            Map<UUID, UUID> suppliedValueRefs) {
        if (sourceDefinitions == null || sourceDefinitions.isEmpty()) return OrderOptionCopyPlan.empty();
        Map<String, CopyOrderOptionDefinition> targetByCode = targetOrderOptionDefinitions(
                targetScope,
                targetBrand,
                sourceDefinitions.stream().map(CopyOrderOptionDefinition::code).toList());
        Map<UUID, UUID> definitionMappings = new LinkedHashMap<>();
        Map<UUID, UUID> valueMappings = new LinkedHashMap<>();
        Map<UUID, UUID> materialMappings = new LinkedHashMap<>();
        List<String> conflicts = new ArrayList<>();
        for (CopyOrderOptionDefinition source : sourceDefinitions) {
            CopyOrderOptionDefinition target = targetByCode.get(source.code());
            if (target != null
                    && !sameOrderOptionShape(source, target, sourceScope, sourceBrand, targetScope, targetBrand)) {
                conflicts.add(source.code());
                continue;
            }
            UUID targetDefinitionRef = target == null
                    ? plannedRef(suppliedDefinitionRefs, source.ref())
                    : requiredPlannedRef(suppliedDefinitionRefs, source.ref(), target.ref());
            definitionMappings.put(source.ref(), targetDefinitionRef);
            Map<String, CopyOrderOptionValue> targetValues = target == null
                    ? Map.of()
                    : target.values().stream()
                            .collect(java.util.stream.Collectors.toMap(CopyOrderOptionValue::code, value -> value));
            for (CopyOrderOptionValue sourceValue : source.values()) {
                CopyOrderOptionValue targetValue = targetValues.get(sourceValue.code());
                UUID targetValueRef = targetValue == null
                        ? plannedRef(suppliedValueRefs, sourceValue.ref())
                        : requiredPlannedRef(suppliedValueRefs, sourceValue.ref(), targetValue.ref());
                valueMappings.put(sourceValue.ref(), targetValueRef);
                if (targetValue == null) {
                    for (CopyOrderOptionMaterial sourceMaterial : sourceValue.materials())
                        materialMappings.put(sourceMaterial.ref(), UUID.randomUUID());
                    continue;
                }
                Map<String, CopyOrderOptionMaterial> targetMaterials = targetValue.materials().stream()
                        .collect(java.util.stream.Collectors.toMap(
                                CatalogItemDefinitionFacts::materialIdentity, material -> material));
                for (CopyOrderOptionMaterial sourceMaterial : sourceValue.materials()) {
                    CopyOrderOptionMaterial targetMaterial = targetMaterials.get(materialIdentity(sourceMaterial));
                    if (targetMaterial == null)
                        throw new CatalogOwnerApi.Problem(
                                "CATALOG_COPY_DEFINITION_CONFLICT",
                                422,
                                /* format-wrap */
                                "同编码点单选项定义的扣料原料不一致: " + source.code());
                    materialMappings.put(sourceMaterial.ref(), targetMaterial.ref());
                }
            }
        }
        return new OrderOptionCopyPlan(
                Map.copyOf(definitionMappings),
                Map.copyOf(valueMappings),
                Map.copyOf(materialMappings),
                List.copyOf(conflicts));
    }

    /**
     * Writes a preflighted catalog-only definition/config closure. Inventory-owned BOMs are deliberately left to the
     * public inventory command, which consumes the same value mappings in the surrounding REQUIRED transaction.
     */
    void copyOrderOptionConfigs(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Collection<CopyOrderOptionDefinition> sourceDefinitions,
            Map<UUID, UUID> copiedItemRefs,
            Map<UUID, UUID> targetItemRefs,
            Map<UUID, UUID> targetStockTargetRefs,
            OrderOptionCopyPlan plan,
            Map<UUID, InventoryOwnerApi.UnitSnapshot> unitSnapshots,
            long now) {
        if (copiedItemRefs == null
                || copiedItemRefs.isEmpty()
                || sourceDefinitions == null
                || sourceDefinitions.isEmpty()) return;
        if (!plan.conflictCodes().isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    422,
                    "同编码点单选项定义的选择方式、选项或扣料原料不一致:" + " " +
                            /* format-wrap */
                            String.join(",", plan.conflictCodes()));
        Map<String, CopyOrderOptionDefinition> existing = targetOrderOptionDefinitions(
                targetScope,
                targetBrand,
                sourceDefinitions.stream().map(CopyOrderOptionDefinition::code).toList());
        for (CopyOrderOptionDefinition source : sourceDefinitions) {
            if (existing.containsKey(source.code())) continue;
            UUID targetDefinitionRef = required(
                    plan.definitionMappings(),
                    source.ref(),
                    /* format-wrap */
                    "点单选项定义复制引用未完成映射");
            jdbc.update(
                    "INSERT INTO catalog.catalog_order_option_definition(order_option_definition_ref,data_node_ref,"
                            +
                            /* format-wrap */
                            "brand_ref,code,name,selection_mode,version,created_at_epoch_millis,"
                            +
                            /* format-wrap */
                            "updated_at_epoch_millis"
                            + ") VALUES(?,?,?,?,?,?,1,?,?)",
                    targetDefinitionRef,
                    targetScope,
                    targetBrand,
                    source.code(),
                    source.name(),
                    source.selectionMode(),
                    now,
                    now);
            for (CopyOrderOptionValue sourceValue : source.values()) {
                UUID targetValueRef = required(
                        plan.valueMappings(),
                        sourceValue.ref(),
                        /* format-wrap */
                        "点单选项值复制引用未完成映射");
                jdbc.update(
                        "INSERT INTO catalog.catalog_order_option_definition_value(order_option_definition_value_re"
                                +
                                /* format-wrap */
                                "f,order_option_definition_ref,data_node_ref,brand_ref,code,name,display_order)"
                                +
                                /* format-wrap */
                                " VALUES("
                                + "?,?,?,?,?,?,?)",
                        targetValueRef,
                        targetDefinitionRef,
                        targetScope,
                        targetBrand,
                        sourceValue.code(),
                        sourceValue.name(),
                        sourceValue.displayOrder());
                for (CopyOrderOptionMaterial sourceMaterial : sourceValue.materials()) {
                    UUID targetMaterialItemRef = required(
                            targetItemRefs,
                            sourceMaterial.materialItemRef(),
                            /* format-wrap */
                            "点单选项扣料原材料复制引用未完成映射");
                    UUID targetStockTargetRef = required(
                            targetStockTargetRefs,
                            sourceMaterial.stockTargetRef(),
                            /* format-wrap */
                            "点单选项扣料库存对象复制引用未完成映射");
                    UUID targetMaterialRef = required(
                            plan.materialMappings(),
                            sourceMaterial.ref(),
                            /* format-wrap */
                            "点单选项扣料原料复制引用未完成映射");
                    InventoryOwnerApi.UnitSnapshot unit = sourceMaterial.consumptionUnitSnapshot();
                    if (unit == null)
                        throw new CatalogOwnerApi.Problem(
                                "RESULT_UNKNOWN",
                                500,
                                /* format-wrap */
                                "点单选项原料缺少消耗单位快照");
                    InventoryOwnerApi.UnitSnapshot mappedUnit =
                            unitSnapshots == null ? null : unitSnapshots.get(unit.unitRef());
                    if (mappedUnit == null)
                        throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                /* format-wrap */
                                "点单选项原料单位复制引用未完成映射");
                    jdbc.update(
                            "INSERT INTO catalog.catalog_order_option_definition_material(order_option_definition_m"
                                    +
                                    /* format-wrap */
                                    "aterial_ref,order_option_definition_value_ref,material_item_ref,"
                                    +
                                    /* format-wrap */
                                    "stock_target_ref,"
                                    + "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption"
                                    + "_unit_dimension,consumption_unit_precision) VALUES(?,?,?,?,?,?,?,?,?)",
                            targetMaterialRef,
                            targetValueRef,
                            targetMaterialItemRef,
                            targetStockTargetRef,
                            mappedUnit.unitRef(),
                            mappedUnit.code(),
                            mappedUnit.name(),
                            mappedUnit.unitDimension(),
                            mappedUnit.precision());
                }
            }
        }
        copyOrderOptionConfigurations(targetScope, targetBrand, copiedItemRefs, plan);
    }

    List<String> orderOptionCopyConflictCodes(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Collection<UUID> sourceItems,
            Map<UUID, UUID> targetItemRefs,
            Map<UUID, UUID> suppliedDefinitionRefs,
            Map<UUID, UUID> suppliedValueRefs) {
        OrderOptionCopyPlan plan = planOrderOptionCopy(
                sourceScope,
                sourceBrand,
                targetScope,
                targetBrand,
                copyOrderOptionDefinitions(sourceScope, sourceBrand, sourceItems),
                targetItemRefs,
                suppliedDefinitionRefs,
                suppliedValueRefs);
        return plan.conflictCodes();
    }

    /** Stable source fingerprint makes definition/config shape changes stale an earlier copy preflight. */
    String orderOptionCopyFingerprint(String scope, String brand, Collection<UUID> sourceItems) {
        List<CopyOrderOptionDefinition> definitions = copyOrderOptionDefinitions(scope, brand, sourceItems);
        List<String> facts = new ArrayList<>();
        for (CopyOrderOptionDefinition definition : definitions) {
            facts.add("D:" + definition.code() + ":" + definition.selectionMode() + ":" + definition.version());
            for (CopyOrderOptionValue value : definition.values()) {
                facts.add("V:" + definition.code() + ":" + value.code() + ":" + value.name() + ":"
                        + value.displayOrder());
                for (CopyOrderOptionMaterial material : value.materials())
                    facts.add("M:" + definition.code() + ":" + value.code() + ":" + material.materialItemCode() + ":"
                            + material.stockTargetRef() + ":" + unitIdentity(material.consumptionUnitSnapshot()));
            }
        }
        return String.join("|", facts);
    }

    private void copyOrderOptionConfigurations(
            String targetScope, String targetBrand, Map<UUID, UUID> copiedItemRefs, OrderOptionCopyPlan plan) {
        for (Map.Entry<UUID, UUID> item : copiedItemRefs.entrySet()) {
            ArrayNode sourceConfigs =
                    readOrderOptionConfigs(List.of(item.getKey())).get(item.getKey());
            ArrayNode rewritten = sourceConfigs == null ? mapper.createArrayNode() : sourceConfigs.deepCopy();
            for (JsonNode configNode : rewritten) {
                if (!(configNode instanceof ObjectNode config))
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "点单选项商品配置不是对象");
                config.put(
                        "definitionRef",
                        required(
                                        plan.definitionMappings(),
                                        requiredUuid(config, "definitionRef"),
                                        /* format-wrap */
                                        "点单选项定义复制引用未完成映射")
                                .toString());
                for (JsonNode valueNode : config.withArray("values")) {
                    if (!(valueNode instanceof ObjectNode value))
                        throw new CatalogOwnerApi.Problem(
                                "RESULT_UNKNOWN",
                                500,
                                /* format-wrap */
                                "点单选项商品配置值不是对象");
                    value.put(
                            "definitionValueRef",
                            required(
                                            plan.valueMappings(),
                                            requiredUuid(value, "definitionValueRef"),
                                            /* format-wrap */
                                            "点单选项值复制引用未完成映射")
                                    .toString());
                }
            }
            replaceOrderOptionConfigs(targetScope, targetBrand, item.getValue(), rewritten);
        }
    }

    private Map<UUID, CopyOrderOptionDefinition> loadCopyOrderOptionDefinitions(
            String scope, String brand, Collection<UUID> definitionRefs) {
        if (definitionRefs == null || definitionRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(definitionRefs);
        return jdbc.query(
                "SELECT order_option_definition_ref,code,name,selection_mode,version FROM catalog.catalog_order_opt"
                        + "ion_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? AND order_option_definition_ref IN ("
                        + placeholders(refs)
                        + ") ORDER BY code,order_option_definition_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, CopyOrderOptionDefinition> definitions = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        definitions.put(
                                ref,
                                new CopyOrderOptionDefinition(
                                        ref,
                                        rows.getString(2),
                                        rows.getString(3),
                                        rows.getString(4),
                                        rows.getLong(5),
                                        copyOrderOptionValues(ref)));
                    }
                    return definitions;
                });
    }

    private Map<String, CopyOrderOptionDefinition> targetOrderOptionDefinitions(
            String scope, String brand, Collection<String> codes) {
        if (codes == null || codes.isEmpty()) return Map.of();
        List<String> distinctCodes = new ArrayList<>(new LinkedHashSet<>(codes));
        String placeholders = String.join(",", Collections.nCopies(distinctCodes.size(), "?"));
        return jdbc.query(
                "SELECT order_option_definition_ref,code,name,selection_mode,version FROM catalog.catalog_order_opt"
                        + "ion_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? AND code IN ("
                        + placeholders
                        + ") ORDER BY code,order_option_definition_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    for (int index = 0; index < distinctCodes.size(); index++)
                        statement.setString(index + 3, distinctCodes.get(index));
                },
                rows -> {
                    Map<String, CopyOrderOptionDefinition> definitions = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        CopyOrderOptionDefinition definition = new CopyOrderOptionDefinition(
                                ref,
                                rows.getString(2),
                                rows.getString(3),
                                rows.getString(4),
                                rows.getLong(5),
                                copyOrderOptionValues(ref));
                        if (definitions.putIfAbsent(definition.code(), definition) != null)
                            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "点单选项编码不唯一");
                    }
                    return definitions;
                });
    }

    private List<CopyOrderOptionValue> copyOrderOptionValues(UUID definitionRef) {
        return jdbc.query(
                "SELECT value_row.order_option_definition_value_ref,value_row.code,value_row.name,value_row.display"
                        + "_order,"
                        + "material.order_option_definition_material_ref,material.material_item_ref,material_item.c"
                        + "ode,material.stock_target_ref,"
                        + "material.consumption_unit_ref,material.consumption_unit_code,material.consumption_unit_name,"
                        + "material.consumption_unit_dimension,material.consumption_unit_precision "
                        + "FROM catalog.catalog_order_option_definition_value value_row "
                        + "LEFT JOIN catalog.catalog_order_option_definition_material material ON material.order_op"
                        + "tion_definition_value_ref=value_row.order_option_definition_value_ref "
                        + "LEFT JOIN catalog.catalog_item material_item ON material_item.item_ref=material.material"
                        + "_item_ref "
                        + "WHERE value_row.order_option_definition_ref=? "
                        + "ORDER BY value_row.display_order,value_row.order_option_definition_value_ref,material.or"
                        + "der_option_definition_material_ref",
                rows -> {
                    Map<UUID, CopyOrderOptionValueBuilder> values = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID valueRef = rows.getObject(1, UUID.class);
                        String valueCode = rows.getString(2);
                        String valueName = rows.getString(3);
                        int displayOrder = rows.getInt(4);
                        CopyOrderOptionValueBuilder value = values.computeIfAbsent(
                                valueRef,
                                ignored ->
                                        new CopyOrderOptionValueBuilder(valueRef, valueCode, valueName, displayOrder));
                        UUID materialRef = rows.getObject(5, UUID.class);
                        if (materialRef != null) {
                            UUID materialItemRef = rows.getObject(6, UUID.class);
                            String materialItemCode = rows.getString(7);
                            if (materialItemRef == null || materialItemCode == null || materialItemCode.isBlank())
                                throw new CatalogOwnerApi.Problem(
                                        "REFERENCE_MAPPING_UNRESOLVED",
                                        422,
                                        /* format-wrap */
                                        "点单选项扣料原材料不存在");
                            value.materials.add(new CopyOrderOptionMaterial(
                                    materialRef,
                                    materialItemRef,
                                    materialItemCode,
                                    rows.getObject(8, UUID.class),
                                    new InventoryOwnerApi.UnitSnapshot(
                                            rows.getObject(9, UUID.class),
                                            rows.getString(10),
                                            rows.getString(11),
                                            rows.getString(12),
                                            rows.getInt(13))));
                        }
                    }
                    return values.values().stream()
                            .map(CopyOrderOptionValueBuilder::build)
                            .toList();
                },
                definitionRef);
    }

    private static boolean sameOrderOptionShape(
            CopyOrderOptionDefinition source,
            CopyOrderOptionDefinition target,
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand) {
        if (!source.selectionMode().equals(target.selectionMode())
                || source.values().size() != target.values().size()) return false;
        for (int index = 0; index < source.values().size(); index++) {
            CopyOrderOptionValue left = source.values().get(index);
            CopyOrderOptionValue right = target.values().get(index);
            if (!left.code().equals(right.code())
                    || !left.name().equals(right.name())
                    || left.displayOrder() != right.displayOrder()
                    || left.materials().size() != right.materials().size()) return false;
            List<String> leftMaterials = left.materials().stream()
                    .map(CatalogItemDefinitionFacts::materialIdentity)
                    .sorted()
                    .toList();
            List<String> rightMaterials = right.materials().stream()
                    .map(CatalogItemDefinitionFacts::materialIdentity)
                    .sorted()
                    .toList();
            if (!leftMaterials.equals(rightMaterials)) return false;
        }
        return true;
    }

    private static String materialIdentity(CopyOrderOptionMaterial material) {
        return material.materialItemCode() + "|" + unitIdentity(material.consumptionUnitSnapshot());
    }

    private static String unitIdentity(InventoryOwnerApi.UnitSnapshot unit) {
        if (unit == null)
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    /* format-wrap */
                    "点单选项原料缺少消耗单位快照");
        return unit.code() + "|" + unit.name() + "|" + unit.unitDimension() + "|" + unit.precision();
    }

    private static UUID plannedRef(Map<UUID, UUID> supplied, UUID sourceRef) {
        UUID targetRef = supplied == null ? null : supplied.get(sourceRef);
        return targetRef == null ? UUID.randomUUID() : targetRef;
    }

    private static UUID requiredPlannedRef(Map<UUID, UUID> supplied, UUID sourceRef, UUID existingTargetRef) {
        UUID suppliedTargetRef = supplied == null ? null : supplied.get(sourceRef);
        if (suppliedTargetRef != null && !suppliedTargetRef.equals(existingTargetRef))
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "预检目标点单选项引用与已存在事实不一致");
        return existingTargetRef;
    }

    /**
     * Brand copy creates/reuses attribute definitions by the one approved mutable business code, then rewrites each
     * assignment and selected option to target opaque refs. A same-code semantic mismatch is a hard pre-write block.
     */
    void copyAttributeAssignments(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Map<UUID, UUID> copiedItemRefs,
            long now) {
        if (copiedItemRefs == null || copiedItemRefs.isEmpty()) return;
        List<UUID> sourceItems = distinct(copiedItemRefs.keySet());
        List<CopyAttributeAssignment> assignments = jdbc.query(
                "SELECT assignment.item_ref,assignment.attribute_definition_ref,assignment.text_value FROM catalog."
                        + "catalog_item_attribute_assignment assignment "
                        + "JOIN catalog.catalog_attribute_definition definition ON definition.attribute_definition_"
                        + "ref=assignment.attribute_definition_ref "
                        + "WHERE definition.data_node_ref=? AND definition.brand_ref=? AND assignment.item_ref IN ("
                        + placeholders(sourceItems)
                        + ") ORDER BY assignment.item_ref,assignment.attribute_definition_ref",
                statement -> {
                    statement.setString(1, sourceScope);
                    statement.setString(2, sourceBrand);
                    bind(statement, sourceItems, 3);
                },
                (rows, index) -> new CopyAttributeAssignment(
                        rows.getObject(1, UUID.class), rows.getObject(2, UUID.class), rows.getString(3)));
        if (assignments.isEmpty()) return;
        LinkedHashSet<UUID> definitionRefs = new LinkedHashSet<>();
        assignments.forEach(assignment -> definitionRefs.add(assignment.definitionRef()));
        Map<UUID, CopyAttributeDefinition> sourceDefinitions =
                copyAttributeDefinitions(sourceScope, sourceBrand, List.copyOf(definitionRefs));
        Map<String, CopyAttributeDefinition> targetByCode =
                targetAttributeDefinitions(targetScope, targetBrand, sourceDefinitions.values());
        Map<UUID, UUID> definitionMappings = new LinkedHashMap<>();
        Map<UUID, UUID> optionMappings = new LinkedHashMap<>();
        for (CopyAttributeDefinition source : sourceDefinitions.values()) {
            CopyAttributeDefinition target = targetByCode.get(source.code());
            if (target != null && !source.sameShape(target))
                throw new CatalogOwnerApi.Problem(
                        "CATALOG_COPY_DEFINITION_CONFLICT",
                        422,
                        /* format-wrap */
                        "同编码商品属性定义的类型或选项不一致: " + source.code());
            if (target == null) {
                UUID targetRef = UUID.randomUUID();
                jdbc.update(
                        "INSERT INTO catalog.catalog_attribute_definition(attribute_definition_ref,data_node_ref,br"
                                +
                                /* format-wrap */
                                "and_ref,code,name,value_type,version,created_at_epoch_millis,"
                                +
                                /* format-wrap */
                                "updated_at_epoch_millis) "
                                + "VALUES(?,?,?,?,?,?,1,?,?)",
                        targetRef,
                        targetScope,
                        targetBrand,
                        source.code(),
                        source.name(),
                        source.valueType(),
                        now,
                        now);
                List<CopyAttributeOption> copiedOptions = new ArrayList<>();
                for (CopyAttributeOption option : source.options()) {
                    UUID targetOptionRef = UUID.randomUUID();
                    jdbc.update(
                            "INSERT INTO catalog.catalog_attribute_definition_option(attribute_definition_option_re"
                                    + "f,attribute_definition_ref,name,display_order) VALUES(?,?,?,?)",
                            targetOptionRef,
                            targetRef,
                            option.name(),
                            option.displayOrder());
                    copiedOptions.add(new CopyAttributeOption(targetOptionRef, option.name(), option.displayOrder()));
                    optionMappings.put(option.ref(), targetOptionRef);
                }
                target = new CopyAttributeDefinition(
                        targetRef, source.code(), source.name(), source.valueType(), List.copyOf(copiedOptions));
            } else {
                for (int index = 0; index < source.options().size(); index++)
                    optionMappings.put(
                            source.options().get(index).ref(),
                            target.options().get(index).ref());
            }
            definitionMappings.put(source.ref(), target.ref());
        }
        for (CopyAttributeAssignment source : assignments) {
            UUID targetItemRef = copiedItemRefs.get(source.itemRef());
            UUID targetAssignmentRef = UUID.randomUUID();
            jdbc.update(
                    "INSERT INTO catalog.catalog_item_attribute_assignment(item_attribute_assignment_ref,item_ref,a"
                            + "ttribute_definition_ref,text_value) VALUES(?,?,?,?)",
                    targetAssignmentRef,
                    targetItemRef,
                    required(definitionMappings, source.definitionRef(), "商品属性复制引用未完成映射"),
                    source.textValue());
            for (UUID sourceOptionRef : assignmentOptionRefs(source.itemRef(), source.definitionRef()))
                jdbc.update(
                        "INSERT INTO catalog.catalog_item_attribute_selection(item_attribute_assignment_ref,attribu"
                                + "te_definition_option_ref) VALUES(?,?)",
                        targetAssignmentRef,
                        required(optionMappings, sourceOptionRef, "商品属性选项复制引用未完成映射"));
        }
    }

    List<String> attributeCopyConflictCodes(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Collection<UUID> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) return List.of();
        List<UUID> refs = distinct(sourceItems);
        List<UUID> definitionRefs = jdbc.query(
                "SELECT DISTINCT assignment.attribute_definition_ref FROM catalog.catalog_item_attribute_assignment"
                        + " assignment "
                        + "JOIN catalog.catalog_attribute_definition definition ON definition.attribute_definition_"
                        + "ref=assignment.attribute_definition_ref "
                        + "WHERE definition.data_node_ref=? AND definition.brand_ref=? AND assignment.item_ref IN ("
                        + placeholders(refs) + ")",
                statement -> {
                    statement.setString(1, sourceScope);
                    statement.setString(2, sourceBrand);
                    bind(statement, refs, 3);
                },
                (rows, index) -> rows.getObject(1, UUID.class));
        if (definitionRefs.isEmpty()) return List.of();
        Map<UUID, CopyAttributeDefinition> source = copyAttributeDefinitions(sourceScope, sourceBrand, definitionRefs);
        Map<String, CopyAttributeDefinition> target =
                targetAttributeDefinitions(targetScope, targetBrand, source.values());
        return source.values().stream()
                .filter(value -> target.containsKey(value.code()) && !value.sameShape(target.get(value.code())))
                .map(CopyAttributeDefinition::code)
                .sorted()
                .toList();
    }

    /** Stable source fingerprint so a changed referenced definition invalidates an earlier copy preflight. */
    String attributeCopyFingerprint(String scope, String brand, Collection<UUID> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) return "";
        List<UUID> refs = distinct(sourceItems);
        List<String> parts = jdbc.query(
                "SELECT definition.code,definition.value_type,definition.version,option_row.name,option_row.display"
                        + "_order "
                        + "FROM catalog.catalog_item_attribute_assignment assignment "
                        + "JOIN catalog.catalog_attribute_definition definition ON definition.attribute_definition_"
                        + "ref=assignment.attribute_definition_ref "
                        + "LEFT JOIN catalog.catalog_attribute_definition_option option_row ON option_row.attribute"
                        + "_definition_ref=definition.attribute_definition_ref "
                        + "WHERE definition.data_node_ref=? AND definition.brand_ref=? AND assignment.item_ref IN ("
                        + placeholders(refs)
                        + ") ORDER BY definition.code,definition.value_type,definition.version,option_row.display_o"
                        + "rder,option_row.attribute_definition_option_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                (rows, index) -> rows.getString(1) + ":" + rows.getString(2) + ":" + rows.getLong(3) + ":"
                        + (rows.getString(4) == null ? "" : rows.getString(4)) + ":" + rows.getObject(5));
        return String.join("|", parts);
    }

    private Map<UUID, CopyAttributeDefinition> copyAttributeDefinitions(String scope, String brand, List<UUID> refs) {
        Map<UUID, CopyAttributeDefinition> definitions = jdbc.query(
                "SELECT attribute_definition_ref,code,name,value_type FROM catalog.catalog_attribute_definition WHE"
                        + "RE data_node_ref=? AND brand_ref=? AND attribute_definition_ref IN ("
                        + placeholders(refs) + ")",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, CopyAttributeDefinition> values = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        values.put(
                                ref,
                                new CopyAttributeDefinition(
                                        ref,
                                        rows.getString(2),
                                        rows.getString(3),
                                        rows.getString(4),
                                        copyAttributeOptions(ref)));
                    }
                    return values;
                });
        return Map.copyOf(definitions);
    }

    private Map<String, CopyAttributeDefinition> targetAttributeDefinitions(
            String scope, String brand, Collection<CopyAttributeDefinition> source) {
        List<String> codes = source.stream().map(CopyAttributeDefinition::code).toList();
        if (codes.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        Map<String, CopyAttributeDefinition> result = jdbc.query(
                "SELECT attribute_definition_ref,code,name,value_type FROM catalog.catalog_attribute_definition WHE"
                        + "RE data_node_ref=? AND brand_ref=? AND code IN ("
                        + placeholders + ")",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    for (int index = 0; index < codes.size(); index++) statement.setString(index + 3, codes.get(index));
                },
                rows -> {
                    Map<String, CopyAttributeDefinition> values = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        CopyAttributeDefinition definition = new CopyAttributeDefinition(
                                ref,
                                rows.getString(2),
                                rows.getString(3),
                                rows.getString(4),
                                copyAttributeOptions(ref));
                        values.put(definition.code(), definition);
                    }
                    return values;
                });
        return Map.copyOf(result);
    }

    private List<CopyAttributeOption> copyAttributeOptions(UUID definitionRef) {
        return jdbc.query(
                "SELECT attribute_definition_option_ref,name,display_order FROM catalog.catalog_attribute_definitio"
                        +
                        /* format-wrap */
                        "n_option WHERE attribute_definition_ref=? ORDER BY display_order,"
                        +
                        /* format-wrap */
                        "attribute_definition_option_ref",
                (rows, index) ->
                        new CopyAttributeOption(rows.getObject(1, UUID.class), rows.getString(2), rows.getInt(3)),
                definitionRef);
    }

    private List<UUID> assignmentOptionRefs(UUID itemRef, UUID definitionRef) {
        return jdbc.query(
                "SELECT selection.attribute_definition_option_ref FROM catalog.catalog_item_attribute_assignment as"
                        + "signment "
                        + "JOIN catalog.catalog_item_attribute_selection selection ON selection.item_attribute_assi"
                        + "gnment_ref=assignment.item_attribute_assignment_ref "
                        + "WHERE assignment.item_ref=? AND assignment.attribute_definition_ref=? ORDER BY selection"
                        + ".attribute_definition_option_ref",
                (rows, index) -> rows.getObject(1, UUID.class),
                itemRef,
                definitionRef);
    }

    private Map<UUID, AttributeDefinition> loadAttributeDefinitions(
            String scope, String brand, List<AttributeAssignment> assignments) {
        List<UUID> refs =
                assignments.stream().map(AttributeAssignment::definitionRef).toList();
        if (refs.isEmpty()) return Map.of();
        Map<UUID, AttributeDefinition> definitions = jdbc.query(
                "SELECT attribute_definition_ref,value_type FROM catalog.catalog_attribute_definition WHERE data_no"
                        + "de_ref=? AND brand_ref=? AND attribute_definition_ref IN ("
                        + placeholders(refs) + ")",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, AttributeDefinition> values = new LinkedHashMap<>();
                    while (rows.next())
                        values.put(
                                rows.getObject(1, UUID.class),
                                new AttributeDefinition(rows.getString(2), optionRefs(rows.getObject(1, UUID.class))));
                    return values;
                });
        return Map.copyOf(definitions);
    }

    private Map<UUID, OrderOptionDefinition> loadOrderOptionDefinitions(
            String scope, String brand, List<OrderOptionConfig> configs) {
        List<UUID> refs = configs.stream().map(OrderOptionConfig::definitionRef).toList();
        if (refs.isEmpty()) return Map.of();
        Map<UUID, OrderOptionDefinition> definitions = jdbc.query(
                "SELECT order_option_definition_ref,selection_mode FROM catalog.catalog_order_option_definition WHE"
                        + "RE data_node_ref=? AND brand_ref=? AND order_option_definition_ref IN ("
                        + placeholders(refs) + ")",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, OrderOptionDefinition> values = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        values.put(ref, new OrderOptionDefinition(rows.getString(2), definitionValues(ref)));
                    }
                    return values;
                });
        return Map.copyOf(definitions);
    }

    private Set<UUID> definitionValues(UUID definitionRef) {
        return jdbc.query(
                "SELECT value_row.order_option_definition_value_ref "
                        + "FROM catalog.catalog_order_option_definition_value value_row "
                        + "WHERE value_row.order_option_definition_ref=? ORDER BY value_row.display_order,value_row"
                        + ".order_option_definition_value_ref",
                rows -> {
                    LinkedHashSet<UUID> values = new LinkedHashSet<>();
                    while (rows.next()) {
                        values.add(rows.getObject(1, UUID.class));
                    }
                    return values;
                },
                definitionRef);
    }

    private List<UUID> optionRefs(UUID definitionRef) {
        return jdbc.query(
                "SELECT attribute_definition_option_ref FROM catalog.catalog_attribute_definition_option WHERE attr"
                        + "ibute_definition_ref=? ORDER BY display_order,attribute_definition_option_ref",
                (rows, row) -> rows.getObject(1, UUID.class),
                definitionRef);
    }

    private static void validateAttributeAssignment(AttributeDefinition definition, AttributeAssignment assignment) {
        boolean text = "TEXT".equals(definition.valueType());
        if (text) {
            if (assignment.textValue() == null || !assignment.optionRefs().isEmpty())
                throw problem("文本商品属性必须填写文本，且不能选择选项");
            return;
        }
        if (assignment.textValue() != null
                ||
                /* format-wrap */
                assignment.optionRefs().isEmpty()) throw problem("选择型商品属性必须选择定义中的选项");
        if ("SINGLE_SELECT".equals(definition.valueType())
                && assignment.optionRefs().size() != 1) throw problem("单选商品属性只能选择一个选项");
        if (!definition.optionRefs().containsAll(assignment.optionRefs())) {
            throw problem("商品属性选项不属于所选定义");
        }
    }

    private static void validateOrderOptionConfig(OrderOptionDefinition definition, OrderOptionConfig config) {
        boolean multiple = "MULTIPLE".equals(definition.selectionMode());
        if (multiple != (config.minSelectionCount() != null && config.maxSelectionCount() != null))
            throw problem("多选点单选项必须同时填写最少和最多可选数；单选点单选项不" +
                    /* format-wrap */
                    "能"
                    + "填写该范围");
        if (multiple && (config.minSelectionCount() < 0 || config.maxSelectionCount() < config.minSelectionCount()))
            throw problem("点单选项的可选数量范围无效");
        if (multiple && config.maxSelectionCount() > definition.valueRefs().size()) {
            throw problem("点单选项的最多可选数不能超过库中的选项数");
        }
        if (!config.required()
                && multiple
                &&
                /* format-wrap */
                config.minSelectionCount() > 0) {
            throw problem("非必选的多选点单选项最少可选数必须为零");
        }
        if (config.values().size() != definition.valueRefs().size()) {
            throw problem("商品必须保留点单选项库中的全部选项");
        }
        LinkedHashSet<UUID> submitted = new LinkedHashSet<>();
        int defaultCount = 0;
        for (OrderOptionValueOverride override : config.values()) {
            if (!submitted.add(override.definitionValueRef())
                    || !definition.valueRefs().contains(override.definitionValueRef()))
                throw problem("商品点单选项包含不属于所选定义的值");
            if (override.isDefault()) defaultCount++;
        }
        if ("SINGLE".equals(definition.selectionMode())
                &&
                /* format-wrap */
                defaultCount > 1) throw problem("单选点单选项最多只能设一个默认项");
        if (multiple && defaultCount > config.maxSelectionCount()) {
            throw problem("默认点单选项数量不能超过最多可选数");
        }
    }

    private static List<AttributeAssignment> normalizeAttributes(ArrayNode submitted) {
        if (submitted == null) return List.of();
        List<AttributeAssignment> values = new ArrayList<>();
        LinkedHashSet<UUID> definitions = new LinkedHashSet<>();
        for (JsonNode node : submitted) {
            UUID definitionRef = requiredUuid(node, "definitionRef");
            if (!definitions.add(definitionRef)) throw problem("商品属性不能重复选择同一属性定义");
            String text = node.hasNonNull("textValue") ? node.path("textValue").asText() : null;
            values.add(new AttributeAssignment(definitionRef, text, uuidArray(node.path("optionRefs"), "optionRefs")));
        }
        return List.copyOf(values);
    }

    private static List<OrderOptionConfig> normalizeOrderOptions(ArrayNode submitted) {
        if (submitted == null) return List.of();
        List<OrderOptionConfig> values = new ArrayList<>();
        LinkedHashSet<UUID> definitions = new LinkedHashSet<>();
        for (JsonNode node : submitted) {
            UUID definitionRef = requiredUuid(node, "definitionRef");
            if (!definitions.add(definitionRef)) throw problem("商品不能重复选择同一个点单选项");
            Integer min = nullableInt(node, "minSelectionCount");
            Integer max = nullableInt(node, "maxSelectionCount");
            List<OrderOptionValueOverride> overrides = new ArrayList<>();
            if (!node.path("values").isArray()) throw problem("商品点单选项必须包含库中的选项");
            for (JsonNode value : node.path("values")) {
                overrides.add(new OrderOptionValueOverride(
                        requiredUuid(value, "definitionValueRef"),
                        value.path("defaultValue").asBoolean(false),
                        value.hasNonNull("extraPrice")
                                ? value.path("extraPrice").asLong()
                                : null));
            }
            values.add(new OrderOptionConfig(
                    definitionRef, node.path("required").asBoolean(false), min, max, List.copyOf(overrides)));
        }
        return List.copyOf(values);
    }

    private static UUID requiredUuid(JsonNode node, String field) {
        if (!node.hasNonNull(field)) throw problem(field + " is required");
        try {
            return UUID.fromString(node.path(field).asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, field + " must be an opaque UUID", failure);
        }
    }

    private static List<UUID> uuidArray(JsonNode node, String field) {
        if (!node.isArray()) throw problem(field + " must be an array");
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (JsonNode value : node) {
            if (!value.isTextual()) throw problem(field + " must contain opaque UUID refs");
            UUID ref;
            try {
                ref = UUID.fromString(value.asText());
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, field + " must contain opaque UUID refs", failure);
            }
            if (!refs.add(ref)) throw problem(field + " cannot contain duplicates");
        }
        return List.copyOf(refs);
    }

    private static Integer nullableInt(JsonNode node, String field) {
        if (!node.hasNonNull(field)) return null;
        if (!node.path(field).canConvertToInt()) throw problem(field + " must be an integer");
        return node.path(field).asInt();
    }

    private static CatalogOwnerApi.Problem problem(String message) {
        return new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, message);
    }

    private static <T> T required(Map<UUID, T> values, UUID ref, String message) {
        T value = values.get(ref);
        if (value == null) throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
        return value;
    }

    private static List<UUID> distinct(Collection<UUID> refs) {
        return new ArrayList<>(new LinkedHashSet<>(refs));
    }

    private static Map<UUID, ArrayNode> emptyArrays(Collection<UUID> refs) {
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode()));
        return result;
    }

    private static String placeholders(List<UUID> refs) {
        return String.join(",", Collections.nCopies(refs.size(), "?"));
    }

    private static void bind(java.sql.PreparedStatement statement, List<UUID> refs) throws java.sql.SQLException {
        bind(statement, refs, 1);
    }

    private static void bind(java.sql.PreparedStatement statement, List<UUID> refs, int offset)
            throws java.sql.SQLException {
        for (int index = 0; index < refs.size(); index++) statement.setObject(offset + index, refs.get(index));
    }

    private static String valueKey(UUID configRef, UUID valueRef) {
        return configRef + ":" + valueRef;
    }

    private record AttributeDefinition(String valueType, List<UUID> optionRefs) {}

    private record AttributeAssignment(UUID definitionRef, String textValue, List<UUID> optionRefs) {}

    private record OrderOptionDefinition(String selectionMode, Set<UUID> valueRefs) {}

    private record OrderOptionConfig(
            UUID definitionRef,
            boolean required,
            Integer minSelectionCount,
            Integer maxSelectionCount,
            List<OrderOptionValueOverride> values) {}

    private record OrderOptionValueOverride(UUID definitionValueRef, boolean isDefault, Long extraPrice) {}

    record CopyOrderOptionDefinition(
            UUID ref,
            String code,
            String name,
            String selectionMode,
            long version,
            List<CopyOrderOptionValue> values) {}

    record CopyOrderOptionValue(
            UUID ref, String code, String name, int displayOrder, List<CopyOrderOptionMaterial> materials) {}

    record CopyOrderOptionMaterial(
            UUID ref,
            UUID materialItemRef,
            String materialItemCode,
            UUID stockTargetRef,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    record OrderOptionCopyPlan(
            Map<UUID, UUID> definitionMappings,
            Map<UUID, UUID> valueMappings,
            Map<UUID, UUID> materialMappings,
            List<String> conflictCodes) {
        static OrderOptionCopyPlan empty() {
            return new OrderOptionCopyPlan(Map.of(), Map.of(), Map.of(), List.of());
        }
    }

    private static final class CopyOrderOptionValueBuilder {
        private final UUID ref;
        private final String code;
        private final String name;
        private final int displayOrder;
        private final List<CopyOrderOptionMaterial> materials = new ArrayList<>();

        private CopyOrderOptionValueBuilder(UUID ref, String code, String name, int displayOrder) {
            this.ref = ref;
            this.code = code;
            this.name = name;
            this.displayOrder = displayOrder;
        }

        private CopyOrderOptionValue build() {
            return new CopyOrderOptionValue(ref, code, name, displayOrder, List.copyOf(materials));
        }
    }

    private record CopyAttributeAssignment(UUID itemRef, UUID definitionRef, String textValue) {}

    private record CopyAttributeOption(UUID ref, String name, int displayOrder) {}

    private record CopyAttributeDefinition(
            UUID ref, String code, String name, String valueType, List<CopyAttributeOption> options) {
        boolean sameShape(CopyAttributeDefinition other) {
            if (!valueType.equals(other.valueType()) || options.size() != other.options.size()) return false;
            for (int index = 0; index < options.size(); index++) {
                CopyAttributeOption left = options.get(index);
                CopyAttributeOption right = other.options.get(index);
                if (!left.name().equals(right.name()) || left.displayOrder() != right.displayOrder()) return false;
            }
            return true;
        }
    }
}
