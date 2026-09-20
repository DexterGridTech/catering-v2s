package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.application.persistence.CatalogItemDefinitionFactsSql;
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
public class CatalogItemDefinitionFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogItemDefinitionFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<UUID, ArrayNode> readAttributeAssignments(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, ArrayNode> result = emptyArrays(refs);
        Map<UUID, ObjectNode> assignments = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ASSIGNMENT_ITEM_REF_ASSIGNMENT_ITEM_ATTRIBUTE_ASSIGNMENT_REF_DEFINITION_ATTRIBUTE_DEFINITION_REF_ASSIGNMENT_ITEM_ATTRIBUTE_ASSIGNMENT_REF_DEFINITION_ATTRIBUTE_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_CODE_DEFINITION_NAME_DEFINITION_VALUE_TYPE_ASSIGNMENT_TEXT_VALUE_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF_OPTION_ROW_NAME
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ASSIGNMENT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION_ON_DEFINITION_ATTRIBUTE_DEFINITION_REF_ASSIGNMENT_ATTRIBUTE_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_LEFT_JOIN_CATALOG_CATALOG_ITEM_ATTRIBUTE_SELECTION_SELECTION_ON_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ASSIGNMENT_ITEM_ATTRIBUTE_ASSIGNMENT_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_LEFT_JOIN_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_OPTION_OPTION_ROW_ON_OPTION_ROW_ATTRIBUTE_DEFINITION_REF_DEFINITION_ATTRIBUTE_DEFINITION_REF_DEFINITION_ATTRIBUTE_DEFINITION_REF_AND_OPTION_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF_SELECTION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_ASSIGNMENT_ITEM_REF
                        + placeholders(refs)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ASSIGNMENT_ITEM_REF_DEFINITION_CODE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF,
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
                            assignment.putArray("selectedOptionNames");
                            assignments.put(assignmentRef, assignment);
                        }
                        UUID optionRef = rows.getObject(8, UUID.class);
                        if (optionRef != null) {
                            String optionName = rows.getString(9);
                            if (optionName == null || optionName.isBlank()) {
                                String message = "商品属性选项名称暂时无法读取";
                                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 503, message);
                            }
                            assignment.withArray("optionRefs").add(optionRef.toString());
                            assignment.withArray("selectedOptionNames").add(optionName);
                        }
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    public CopyAttributeFacts readCopyAttributeFacts(String scope, String brand, Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return CopyAttributeFacts.empty();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, ArrayNode> assignmentsByItem = emptyArrays(refs);
        Map<UUID, ObjectNode> assignmentsByRef = new LinkedHashMap<>();
        Map<UUID, LinkedHashSet<UUID>> selectedOptionsByAssignment = new LinkedHashMap<>();
        Map<UUID, CopyAttributeDefinitionBuilder> definitions = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ASSIGNMENT_ITEM_REF_ASSIGNMENT_ITEM_ATTRIBUTE_ASSIGNMENT_REF_DEFINITION_ATTRIBUTE_DEFINITION_REF_DEFINITION_CODE_DEFINITION_VALUE_TYPE_DEFINITION_VERSION_ASSIGNMENT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_TEXT_VALUE_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ASSIGNMENT_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ATTRIBUTE_DEFINITION_REF_ASSIGNMENT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ATTRIBUTE_SELECTION_SELECTION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ASSIGNMENT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_OPTION_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_ATTRIBUTE_DEFINITION_REF_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_DATA_NODE_REF_BRAND_REF_ASSIGNMENT
                        + placeholders(refs)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ASSIGNMENT_ITEM_REF_DEFINITION_CODE_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_ATTRIBUTE_DEFINITION_OPTION_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        UUID assignmentRef = rows.getObject(2, UUID.class);
                        UUID definitionRef = rows.getObject(3, UUID.class);
                        ObjectNode assignment = assignmentsByRef.get(assignmentRef);
                        if (assignment == null) {
                            assignment = assignmentsByItem.get(itemRef).addObject();
                            assignment.put("definitionRef", definitionRef.toString());
                            assignment.put("code", rows.getString(4));
                            assignment.put("name", rows.getString(5));
                            assignment.put("valueType", rows.getString(6));
                            if (rows.getObject(8) == null) assignment.putNull("textValue");
                            else assignment.put("textValue", rows.getString(8));
                            assignment.putArray("optionRefs");
                            assignmentsByRef.put(assignmentRef, assignment);
                        }
                        UUID selectedOptionRef = rows.getObject(9, UUID.class);
                        if (selectedOptionRef != null
                                && selectedOptionsByAssignment
                                        .computeIfAbsent(assignmentRef, ignored -> new LinkedHashSet<>())
                                        .add(selectedOptionRef))
                            assignment.withArray("optionRefs").add(selectedOptionRef.toString());
                        CopyAttributeDefinitionBuilder definition = definitions.get(definitionRef);
                        if (definition == null) {
                            definition = new CopyAttributeDefinitionBuilder(
                                    definitionRef,
                                    rows.getString(4),
                                    rows.getString(5),
                                    rows.getString(6),
                                    rows.getLong(7));
                            definitions.put(definitionRef, definition);
                        }
                        UUID optionRef = rows.getObject(10, UUID.class);
                        if (optionRef != null) definition.addOption(optionRef, rows.getString(11), rows.getInt(12));
                    }
                    return null;
                });
        Map<UUID, CopyAttributeDefinition> typedDefinitions = new LinkedHashMap<>();
        definitions.forEach((ref, definition) -> typedDefinitions.put(ref, definition.build()));
        return new CopyAttributeFacts(Map.copyOf(assignmentsByItem), Map.copyOf(typedDefinitions));
    }

    public Map<UUID, ArrayNode> readOrderOptionConfigs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, ArrayNode> result = emptyArrays(refs);
        Map<UUID, ObjectNode> configs = new LinkedHashMap<>();
        Map<String, ObjectNode> values = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_CONFIG_ITEM_REF_ITEM_ORDER_OPTION_CONFIG_REF_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_NAME_SELECTION_MODE_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONFIG_MIN_SELECTION_COUNT_MAX_SELECTION_COUNT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF_VALUE_DEFINITION_NAME_VALUE_DEFINITION_DISPLAY_ORDER_VALUE_DEFINITION_NAME_VALUE_DEFINITION_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_PREPARATION_EFFECT_TEXT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_DEFINITION_ON_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG_ORDER_OPTION_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_REF_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_LEFT_JOIN_CATALOG_CATALOG_ITEM_ORDER_OPTION_VALUE_OVERRIDE_OVERRIDE_ON_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG_ITEM_ORDER_OPTION_CONFIG_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_AND_OVERRIDE_ORDER_OPTION_DEFINITION_VALUE_REF_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF
                        + placeholders(refs)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_CONFIG_ITEM_REF_DISPLAY_ORDER_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF,
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
                            config.put("displayOrder", rows.getInt(6));
                            config.put("required", rows.getBoolean(7));
                            if (rows.getObject(8) == null) config.putNull("minSelectionCount");
                            else config.put("minSelectionCount", rows.getInt(8));
                            if (rows.getObject(9) == null) config.putNull("maxSelectionCount");
                            else config.put("maxSelectionCount", rows.getInt(9));
                            config.putArray("values");
                            configs.put(configRef, config);
                        }
                        UUID definitionValueRef = rows.getObject(10, UUID.class);
                        ObjectNode value = values.get(valueKey(configRef, definitionValueRef));
                        if (value == null) {
                            value = config.withArray("values").addObject();
                            value.put("definitionValueRef", definitionValueRef.toString());
                            value.put("name", rows.getString(11));
                            value.put("displayOrder", rows.getInt(12));
                            value.put("defaultValue", rows.getObject(13) != null && rows.getBoolean(14));
                            if (rows.getObject(15) == null) value.putNull("extraPrice");
                            else value.put("extraPrice", rows.getLong(15));
                            value.set(
                                    "preparationEffect",
                                    normalizedPreparationEffect(
                                            definitionValueRef,
                                            rows.getInt(6),
                                            rows.getInt(12),
                                            parseNullable(rows.getString(16))));
                            values.put(valueKey(configRef, definitionValueRef), value);
                        }
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    /**
     * The list and detail owner projections expose the same normalized option effect. Keep the relation metadata
     * derived from the current definition/config order rather than leaking the persisted JSON shape to consumers.
     */
    public JsonNode normalizedPreparationEffect(
            UUID definitionValueRef, int optionGroupDisplayOrder, int optionValueDisplayOrder, JsonNode storedEffect) {
        if (definitionValueRef == null || storedEffect == null || !storedEffect.isObject()) return mapper.nullNode();
        ObjectNode effect = mapper.createObjectNode()
                .put("definitionValueRef", definitionValueRef.toString())
                .put("optionGroupDisplayOrder", optionGroupDisplayOrder)
                .put("optionValueDisplayOrder", optionValueDisplayOrder);
        if (storedEffect.has("instruction"))
            effect.set("instruction", storedEffect.get("instruction").deepCopy());
        if (storedEffect.has("preparationSecondsDelta"))
            effect.set(
                    "preparationSecondsDelta",
                    storedEffect.get("preparationSecondsDelta").deepCopy());
        return effect;
    }

    /**
     * Local item-copy is same-scope: the option definition/value identities remain the same while the item owner
     * changes. Publish those opaque value mappings in the catalog preflight so inventory can rewrite each option-value
     * BOM owner without treating a missing mapping as permission to guess.
     */
    public ArrayNode localCopyOptionValueMappings(UUID itemRef) {
        ArrayNode result = mapper.createArrayNode();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CTE_RELATED_ITEMS_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MAPPINGS_SORT_ORDER_OBJECT_TYPE_SOURCE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF_CODE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONFIG_ITEM_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_MATERIAL_MATERIAL_ITEM_REF_MATERIAL_ITEM
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_ITEM_MATERIAL_ITEM
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF_PRODUCT_SKU_SKU
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_RELATED_ITEMS_SKU_ITEM_ITEM_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SKU_STATUS_VOIDED_OBJECT_TYPE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MAPPINGS_SORT_ORDER_SOURCE_REF,
                statement -> {
                    statement.setObject(1, itemRef);
                    statement.setObject(2, itemRef);
                    statement.setObject(3, itemRef);
                    statement.setObject(4, itemRef);
                },
                rows -> {
                    while (rows.next()) {
                        String objectType = rows.getString(1);
                        ObjectNode mapping = result.addObject()
                                .put("objectType", objectType)
                                .put("sourceRef", rows.getObject(2, UUID.class).toString())
                                .put("targetRef", rows.getObject(2, UUID.class).toString());
                        if ("CATALOG_ORDER_OPTION_DEFINITION_VALUE".equals(objectType))
                            mapping.put("targetOptionValueCode", rows.getString(3));
                        else if ("CATALOG_ITEM".equals(objectType)) mapping.put("targetCode", rows.getString(3));
                        else mapping.put("targetSkuCode", rows.getString(4));
                    }
                    return null;
                });
        return result;
    }

    public void replaceAttributeAssignments(String scope, String brand, UUID itemRef, ArrayNode submitted) {
        List<AttributeAssignment> assignments = normalizeAttributes(submitted);
        Map<UUID, UUID> existing = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_ITEM_ATTRIBUTE_ASSIGNMENT_REF_FROM_CATALOG_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_WHERE_ITEM_REF_CATALOG_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_WHERE_ITEM_REF,
                rows -> {
                    Map<UUID, UUID> values = new LinkedHashMap<>();
                    while (rows.next()) values.put(rows.getObject(1, UUID.class), rows.getObject(2, UUID.class));
                    return values;
                },
                itemRef);
        Map<UUID, AttributeDefinition> definitions = loadAttributeDefinitions(scope, brand, assignments);
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        List<Object[]> inserts = new ArrayList<>();
        List<Object[]> updates = new ArrayList<>();
        List<Object[]> selections = new ArrayList<>();
        for (AttributeAssignment assignment : assignments) {
            AttributeDefinition definition = required(
                    definitions,
                    assignment.definitionRef(),
                    /* format-wrap */
                    "商品属性定义不存在或不属于当前范围");
            // spotless:off
            requireBindableDefinition(
                    definition.status(),
                    existing.containsKey(assignment.definitionRef()),
                    "新绑定的商品属性定义必须处于启用状态");
            // spotless:on
            validateAttributeAssignment(definition, assignment);
            retained.add(assignment.definitionRef());
            UUID assignmentRef = existing.get(assignment.definitionRef());
            if (assignmentRef == null) {
                assignmentRef = UUID.randomUUID();
                inserts.add(new Object[] {assignmentRef, itemRef, assignment.definitionRef(), assignment.textValue()});
            } else {
                updates.add(new Object[] {assignment.textValue(), assignmentRef});
            }
            for (UUID optionRef : assignment.optionRefs()) selections.add(new Object[] {assignmentRef, optionRef});
        }
        List<UUID> retainedExistingRefs = assignments.stream()
                .map(assignment -> existing.get(assignment.definitionRef()))
                .filter(java.util.Objects::nonNull)
                .toList();
        List<UUID> removedRefs = existing.entrySet().stream()
                .filter(entry -> !retained.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .toList();
        List<UUID> refsRequiringSelectionDelete = new ArrayList<>(retainedExistingRefs);
        refsRequiringSelectionDelete.addAll(removedRefs);
        if (!refsRequiringSelectionDelete.isEmpty())
            jdbc.update(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DELETE_CATALOG_ITEM_ATTRIBUTE_SELECTION_ITEM_ATTRIBUTE_ASSIGNMENT_REF
                            + placeholders(refsRequiringSelectionDelete)
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN,
                    refsRequiringSelectionDelete.toArray());
        if (!removedRefs.isEmpty())
            jdbc.update(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DELETE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_ATTRIBUTE_ASSIGNMENT_REF
                            + placeholders(removedRefs)
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_A,
                    removedRefs.toArray());
        if (!inserts.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_REF_TEXT_VALUE,
                    inserts);
        if (!updates.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_UPDATE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_TEXT_VALUE
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ITEM_ATTRIBUTE_ASSIGNMENT_REF,
                    updates);
        if (!selections.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ATTRIBUTE_SELECTION
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF,
                    selections);
    }

    public void replaceOrderOptionConfigs(String scope, String brand, UUID itemRef, ArrayNode submitted) {
        List<OrderOptionConfig> configs = normalizeOrderOptions(submitted);
        Map<UUID, UUID> existing = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ORDER_OPTION_DEFINITION_REF_ITEM_ORDER_OPTION_CONFIG_REF_FROM_CATALOG_CATALOG_ITEM_ORDER_OPTION_CONFIG_WHERE_ITEM_REF_CATALOG_CATALOG_ITEM_ORDER_OPTION_CONFIG_WHERE_ITEM_REF,
                rows -> {
                    Map<UUID, UUID> values = new LinkedHashMap<>();
                    while (rows.next()) values.put(rows.getObject(1, UUID.class), rows.getObject(2, UUID.class));
                    return values;
                },
                itemRef);
        Map<UUID, OrderOptionDefinition> definitions = loadOrderOptionDefinitions(scope, brand, configs);
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        List<Object[]> inserts = new ArrayList<>();
        List<Object[]> updates = new ArrayList<>();
        List<Object[]> overrides = new ArrayList<>();
        for (OrderOptionConfig config : configs) {
            OrderOptionDefinition definition = required(
                    definitions,
                    config.definitionRef(),
                    /* format-wrap */
                    "点单选项定义不存在或不属于当前范围");
            // spotless:off
            requireBindableDefinition(
                    definition.status(),
                    existing.containsKey(config.definitionRef()),
                    "新绑定的点单选项定义必须处于启用状态");
            // spotless:on
            validateOrderOptionConfig(definition, config);
            retained.add(config.definitionRef());
            UUID configRef = existing.get(config.definitionRef());
            if (configRef == null) {
                configRef = UUID.randomUUID();
                inserts.add(new Object[] {
                    configRef,
                    itemRef,
                    config.definitionRef(),
                    config.displayOrder(),
                    config.required(),
                    config.minSelectionCount(),
                    config.maxSelectionCount()
                });
            } else {
                updates.add(new Object[] {
                    config.displayOrder(),
                    config.required(),
                    config.minSelectionCount(),
                    config.maxSelectionCount(),
                    configRef
                });
            }
            for (OrderOptionValueOverride override : config.values()) {
                UUID overrideRef = UUID.randomUUID();
                overrides.add(new Object[] {
                    overrideRef, configRef, override.definitionValueRef(), override.isDefault(), override.extraPrice()
                });
            }
        }
        List<UUID> retainedExistingRefs = configs.stream()
                .map(config -> existing.get(config.definitionRef()))
                .filter(java.util.Objects::nonNull)
                .toList();
        List<UUID> removedRefs = existing.entrySet().stream()
                .filter(entry -> !retained.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .toList();
        List<UUID> refsRequiringOverrideDelete = new ArrayList<>(retainedExistingRefs);
        refsRequiringOverrideDelete.addAll(removedRefs);
        if (!refsRequiringOverrideDelete.isEmpty())
            jdbc.update(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DELETE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_DELETE_FROM_CATALOG_CATALOG_
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ITEM_ORDER_OPTION_CONFIG_REF
                            + placeholders(refsRequiringOverrideDelete)
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_B,
                    refsRequiringOverrideDelete.toArray());
        if (!removedRefs.isEmpty())
            jdbc.update(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DELETE_CATALOG_ITEM_ORDER_OPTION_CONFIG_ITEM_ORDER_OPTION_CONFIG_REF
                            + placeholders(removedRefs)
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_C,
                    removedRefs.toArray());
        if (!inserts.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ORDER_OPTION_CONFIG
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_REF
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MAX_SELECTION_COUNT
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUES,
                    inserts);
        if (!updates.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_UPDATE_CATALOG_ITEM_ORDER_OPTION_CONFIG_DISPLAY_ORDER_IS_REQUIRED
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MIN_SELECTION_COUNT,
                    updates);
        if (!overrides.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ITEM_ORDER_OPTION_VALUE_OV
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ITEM_ORDER_OPTION_VALUE_OVERRIDE_R
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_IS_DEFAULT_EXTRA_PRICE,
                    overrides);
    }

    /**
     * A temporary item promoted under a new code remains in the same catalog scope. Its library references are
     * therefore already canonical: copy the current relational facts instead of serializing a legacy JSON fallback.
     * Inventory-owned option-value BOM rows are deliberately copied by the application coordinator.
     */
    public void copyCurrentFactsWithinScope(String scope, String brand, UUID sourceItemRef, UUID targetItemRef) {
        ArrayNode sourceAssignments =
                readAttributeAssignments(List.of(sourceItemRef)).get(sourceItemRef);
        ArrayNode sourceConfigs = readOrderOptionConfigs(List.of(sourceItemRef)).get(sourceItemRef);
        copyCurrentFactsWithinScope(scope, brand, targetItemRef, sourceAssignments, sourceConfigs);
    }

    public void copyCurrentFactsWithinScope(
            String scope, String brand, UUID targetItemRef, ArrayNode sourceAssignments, ArrayNode sourceConfigs) {
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
     * Temporary promotion only needs the two item-definition families that are copied to a fresh target. Presence is
     * decided by the caller's shared set probe so an absent family does not open another empty relation read.
     */
    public TemporaryPromotionFacts readTemporaryPromotionFacts(
            String scope, String brand, UUID itemRef, boolean attributesPresent, boolean orderOptionsPresent) {
        ArrayNode assignments = attributesPresent
                ? readAttributeAssignments(List.of(itemRef)).getOrDefault(itemRef, mapper.createArrayNode())
                : mapper.createArrayNode();
        ArrayNode configs = orderOptionsPresent
                ? readOrderOptionConfigs(List.of(itemRef)).getOrDefault(itemRef, mapper.createArrayNode())
                : mapper.createArrayNode();
        return new TemporaryPromotionFacts(assignments, configs, definitionValueRefs(configs));
    }

    /** A new promotion target has no existing definition rows, so empty source families need no replacement call. */
    public void copyTemporaryPromotionFactsWithinScope(
            String scope, String brand, UUID targetItemRef, TemporaryPromotionFacts facts) {
        if (facts == null) return;
        if (facts.hasAttributeAssignments())
            replaceAttributeAssignments(
                    scope, brand, targetItemRef, facts.attributeAssignments().deepCopy());
        if (facts.hasOrderOptionConfigs())
            replaceOrderOptionConfigs(
                    scope, brand, targetItemRef, facts.orderOptionConfigs().deepCopy());
    }

    private static List<UUID> definitionValueRefs(ArrayNode configs) {
        if (configs == null || configs.isEmpty()) return List.of();
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (JsonNode config : configs) {
            if (!config.path("values").isArray()) continue;
            for (JsonNode value : config.path("values")) refs.add(requiredUuid(value, "definitionValueRef"));
        }
        return List.copyOf(refs);
    }

    /**
     * The copy closure follows an option definition through every item configuration, not through an obsolete JSON
     * field. Materials are catalog-item references and must therefore join the normal item closure before inventory may
     * rewrite its option-value BOM owners.
     */
    public List<UUID> orderOptionMaterialItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return List.of();
        List<UUID> refs = distinct(itemRefs);
        return jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ITEM_ORDER_OPTION_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_VALUE_VALUE_ROW_ON_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_CONFIG_ORDER_OPTION_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_MATERIAL_ON_MATERIAL_ORDER_OPTION_DEFINITION_VALUE_REF_VALUE_ROW_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_CONFIG_ITEM_REF_ALTERNATE_B
                        + placeholders(refs)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_MATERIAL_MATERIAL_ITEM_REF,
                statement -> bind(statement, refs),
                (rows, index) -> rows.getObject(1, UUID.class));
    }

    public Map<UUID, List<UUID>> orderOptionMaterialItemRefsByTypedFacts(
            Map<UUID, List<UUID>> orderOptionDefinitionRefsByItem, Collection<CopyOrderOptionDefinition> definitions) {
        if (orderOptionDefinitionRefsByItem == null
                || orderOptionDefinitionRefsByItem.isEmpty()
                || definitions == null
                || definitions.isEmpty()) return Map.of();
        Map<UUID, CopyOrderOptionDefinition> definitionsByRef = new LinkedHashMap<>();
        definitions.forEach(definition -> definitionsByRef.put(definition.ref(), definition));
        Map<UUID, LinkedHashSet<UUID>> grouped = new LinkedHashMap<>();
        orderOptionDefinitionRefsByItem.forEach((itemRef, definitionRefs) -> {
            if (definitionRefs == null) return;
            for (UUID definitionRef : definitionRefs) {
                CopyOrderOptionDefinition definition = definitionsByRef.get(definitionRef);
                if (definition == null) continue;
                for (CopyOrderOptionValue value : definition.values())
                    for (CopyOrderOptionMaterial material : value.materials())
                        if (material.materialItemRef() != null)
                            grouped.computeIfAbsent(itemRef, ignored -> new LinkedHashSet<>())
                                    .add(material.materialItemRef());
            }
        });
        Map<UUID, List<UUID>> result = new LinkedHashMap<>();
        grouped.forEach((itemRef, materials) -> result.put(itemRef, List.copyOf(materials)));
        return Map.copyOf(result);
    }

    /** Returns every unique order-option definition referenced by the supplied item closure. */
    public List<CopyOrderOptionDefinition> copyOrderOptionDefinitions(String scope, String brand, Collection<UUID> itemRefs) {
        return copyOrderOptionFacts(scope, brand, itemRefs).definitions();
    }

    public CopyOrderOptionFacts copyOrderOptionFacts(String scope, String brand, Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return CopyOrderOptionFacts.empty();
        List<UUID> refs = distinct(itemRefs);
        Map<UUID, ArrayNode> configsByItem = emptyArrays(refs);
        Map<UUID, ObjectNode> configs = new LinkedHashMap<>();
        Map<String, ObjectNode> values = new LinkedHashMap<>();
        Map<UUID, LinkedHashSet<UUID>> definitionRefsByItem = new LinkedHashMap<>();
        Map<UUID, CopyOrderOptionDefinitionBuilder> definitionBuilders = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_CONFIG_ITEM_REF_ITEM_ORDER_OPTION_CONFIG_REF_DEFINITION_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_CODE_NAME_SELECTION_MODE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONFIG_DISPLAY_ORDER_IS_REQUIRED_MIN_SELECTION_COUNT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_CODE_NAME_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_CODE_MATERIAL_STOCK_TARGET_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_C
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ORDER_OPTION_DEFINITION_REF_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_DEFINITION_ALTERNATE_C
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_REF_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_LEFT_JOIN
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_ITEM_ORDER_OPTION_CONFIG_REF_CONFIG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OVERRIDE_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_D
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_CATALOG_ITEM
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_DEFINITION_DATA_NODE_REF_BRAND_REF_CONFIG
                        + placeholders(refs)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ORDER_BY
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONFIG_ITEM_REF_DISPLAY_ORDER_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ORDER_OPTION_DEFINITION_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_DEFINITION_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ORDER_OPTION_DEFINITION_MATERIAL_R,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        UUID configRef = rows.getObject(2, UUID.class);
                        UUID definitionRef = rows.getObject(3, UUID.class);
                        CopyOrderOptionDefinitionBuilder definition = definitionBuilders.get(definitionRef);
                        if (definition == null) {
                            definition = new CopyOrderOptionDefinitionBuilder(
                                    definitionRef,
                                    rows.getString(4),
                                    rows.getString(5),
                                    rows.getString(6),
                                    rows.getLong(7));
                            definitionBuilders.put(definitionRef, definition);
                        }
                        definitionRefsByItem
                                .computeIfAbsent(itemRef, ignored -> new LinkedHashSet<>())
                                .add(definitionRef);
                        UUID definitionValueRef = rows.getObject(12, UUID.class);
                        if (definitionValueRef == null) continue;
                        ObjectNode config = configs.get(configRef);
                        if (config == null) {
                            config = configsByItem.get(itemRef).addObject();
                            config.put("definitionRef", definitionRef.toString());
                            config.put("name", rows.getString(5));
                            config.put("selectionMode", rows.getString(6));
                            config.put("displayOrder", rows.getInt(8));
                            config.put("required", rows.getBoolean(9));
                            if (rows.getObject(10) == null) config.putNull("minSelectionCount");
                            else config.put("minSelectionCount", rows.getInt(10));
                            if (rows.getObject(11) == null) config.putNull("maxSelectionCount");
                            else config.put("maxSelectionCount", rows.getInt(11));
                            config.putArray("values");
                            configs.put(configRef, config);
                        }
                        String valueKey = valueKey(configRef, definitionValueRef);
                        ObjectNode value = values.get(valueKey);
                        if (value == null) {
                            value = config.withArray("values").addObject();
                            value.put("definitionValueRef", definitionValueRef.toString());
                            value.put("name", rows.getString(14));
                            value.put("displayOrder", rows.getInt(15));
                            value.put("defaultValue", rows.getObject(16) != null && rows.getBoolean(17));
                            if (rows.getObject(18) == null) value.putNull("extraPrice");
                            else value.put("extraPrice", rows.getLong(18));
                            values.put(valueKey, value);
                        }
                        CopyOrderOptionValueBuilder optionValue = definition.value(
                                definitionValueRef, rows.getString(13), rows.getString(14), rows.getInt(15));
                        UUID materialRef = rows.getObject(19, UUID.class);
                        if (materialRef != null) {
                            UUID materialItemRef = rows.getObject(20, UUID.class);
                            String materialItemCode = rows.getString(21);
                            if (materialItemRef == null || materialItemCode == null || materialItemCode.isBlank()) {
                                // spotless:off
                                throw new CatalogOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED",
                                    422,
                                    "点单选项扣料原材料不存在"
                                );
                                // spotless:on
                            }
                            optionValue.addMaterial(new CopyOrderOptionMaterial(
                                    materialRef,
                                    materialItemRef,
                                    materialItemCode,
                                    rows.getObject(22, UUID.class),
                                    new InventoryOwnerApi.UnitSnapshot(
                                            rows.getObject(23, UUID.class),
                                            rows.getString(24),
                                            rows.getString(25),
                                            rows.getString(26),
                                            rows.getInt(27))));
                        }
                    }
                    return null;
                });
        List<CopyOrderOptionDefinition> definitions = definitionBuilders.values().stream()
                .map(CopyOrderOptionDefinitionBuilder::build)
                .sorted(java.util.Comparator.comparing(CopyOrderOptionDefinition::code))
                .toList();
        Map<UUID, List<UUID>> refsByItem = new LinkedHashMap<>();
        definitionRefsByItem.forEach((itemRef, refsForItem) -> refsByItem.put(itemRef, List.copyOf(refsForItem)));
        return new CopyOrderOptionFacts(definitions, Map.copyOf(refsByItem), Map.copyOf(configsByItem));
    }

    /**
     * Computes the reusable/copyable definition identities without writing. Business code locates an equivalent target
     * definition, while the returned opaque refs are the only relationships later persisted or rewritten.
     */
    public OrderOptionCopyPlan planOrderOptionCopy(
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
    public void copyOrderOptionConfigs(
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
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION
                            +
                            /* format-wrap */
                            CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_BRAND_REF_CODE_NAME_SELECTION_MODE
                            +
                            /* format-wrap */
                            CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS
                            + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_VALUES_1,
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
                        CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION_VA
                                +
                                /* format-wrap */
                                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_REF_DATA_NODE_REF_BRAND_REF_CODE
                                +
                                /* format-wrap */
                                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUES_ALTERNATE_A
                                + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_PARAMETER_PLACEHOLDER,
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
                            CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION_MA
                                    +
                                    /* format-wrap */
                                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ATERIAL_REF
                                    +
                                    /* format-wrap */
                                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_STOCK_TARGET_REF
                                    + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_VALUES_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_VALUES,
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

    public List<String> orderOptionCopyConflictCodes(
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
    public String orderOptionCopyFingerprint(String scope, String brand, Collection<UUID> sourceItems) {
        return orderOptionCopyFingerprint(copyOrderOptionDefinitions(scope, brand, sourceItems));
    }

    public String orderOptionCopyFingerprint(Collection<CopyOrderOptionDefinition> definitions) {
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
        Map<UUID, ArrayNode> sourceConfigs = readOrderOptionConfigs(copiedItemRefs.keySet());
        for (Map.Entry<UUID, UUID> item : copiedItemRefs.entrySet()) {
            ArrayNode sourceConfig = sourceConfigs.get(item.getKey());
            ArrayNode rewritten = sourceConfig == null ? mapper.createArrayNode() : sourceConfig.deepCopy();
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
        Map<UUID, CopyOrderOptionDefinition> definitions = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ORDER_OPTION_DEFINITION_REF_CODE_NAME_SELECTION_MODE_VERSION_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_VERSION_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_ORDER_OPTION_DEFINITION_REF
                        + placeholders(refs)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_CODE_ORDER_OPTION_DEFINITION_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, CopyOrderOptionDefinition> result = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        result.put(
                                ref,
                                new CopyOrderOptionDefinition(
                                        ref,
                                        rows.getString(2),
                                        rows.getString(3),
                                        rows.getString(4),
                                        rows.getLong(5),
                                        List.of()));
                    }
                    return result;
                });
        Map<UUID, List<CopyOrderOptionValue>> valuesByDefinition =
                copyOrderOptionValuesByDefinitions(definitions.keySet());
        definitions.replaceAll((ref, definition) -> new CopyOrderOptionDefinition(
                definition.ref(),
                definition.code(),
                definition.name(),
                definition.selectionMode(),
                definition.version(),
                valuesByDefinition.getOrDefault(ref, List.of())));
        return definitions;
    }

    private Map<String, CopyOrderOptionDefinition> targetOrderOptionDefinitions(
            String scope, String brand, Collection<String> codes) {
        if (codes == null || codes.isEmpty()) return Map.of();
        List<String> distinctCodes = new ArrayList<>(new LinkedHashSet<>(codes));
        String placeholders = String.join(
                CatalogItemDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(distinctCodes.size(), CatalogItemDefinitionFactsSql.PARAMETER_PLACEHOLDER));
        Map<String, CopyOrderOptionDefinitionBuilder> definitions = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_DEFINITION_ORDER_OPTION_DEFINITION_REF_CODE_NAME
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_SELECTION_MODE_VERSION_VALUE_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_CODE_NAME_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_E
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_CODE_MATERIAL_STOCK_TARGET_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_F
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ORDER_OPTION_DEFINITION_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MA_MATERIAL_ALTERNATE_C
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_MATERIAL_ITEM_ITEM_REF_MATERIAL
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_DEFINITION_DATA_NODE_REF_BRAND_REF_CODE
                        + placeholders
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_CODE_ORDER_OPTION_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_DISPLAY_ORDER_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ORDER_OPTION_DEFINITION_MATERIAL_R_ALTERNATE_A,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    for (int index = 0; index < distinctCodes.size(); index++)
                        statement.setString(index + 3, distinctCodes.get(index));
                },
                rows -> {
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        String code = rows.getString(2);
                        CopyOrderOptionDefinitionBuilder definition = definitions.get(code);
                        if (definition == null) {
                            definition = new CopyOrderOptionDefinitionBuilder(
                                    ref, code, rows.getString(3), rows.getString(4), rows.getLong(5));
                            definitions.put(code, definition);
                        } else if (!definition.ref.equals(ref)) {
                            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "点单选项编码不唯一");
                        }
                        UUID valueRef = rows.getObject(6, UUID.class);
                        if (valueRef == null) continue;
                        CopyOrderOptionValueBuilder value =
                                definition.value(valueRef, rows.getString(7), rows.getString(8), rows.getInt(9));
                        UUID materialRef = rows.getObject(10, UUID.class);
                        if (materialRef == null) continue;
                        UUID materialItemRef = rows.getObject(11, UUID.class);
                        String materialItemCode = rows.getString(12);
                        if (materialItemRef == null || materialItemCode == null || materialItemCode.isBlank()) {
                            // spotless:off
                            throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                "点单选项扣料原材料不存在"
                            );
                            // spotless:on
                        }
                        value.addMaterial(new CopyOrderOptionMaterial(
                                materialRef,
                                materialItemRef,
                                materialItemCode,
                                rows.getObject(13, UUID.class),
                                new InventoryOwnerApi.UnitSnapshot(
                                        rows.getObject(14, UUID.class),
                                        rows.getString(15),
                                        rows.getString(16),
                                        rows.getString(17),
                                        rows.getInt(18))));
                    }
                    return null;
                });
        Map<String, CopyOrderOptionDefinition> result = new LinkedHashMap<>();
        definitions.forEach((code, definition) -> result.put(code, definition.build()));
        return Map.copyOf(result);
    }

    private List<CopyOrderOptionValue> copyOrderOptionValues(UUID definitionRef) {
        return copyOrderOptionValuesByDefinitions(List.of(definitionRef)).getOrDefault(definitionRef, List.of());
    }

    private Map<UUID, List<CopyOrderOptionValue>> copyOrderOptionValuesByDefinitions(Collection<UUID> definitionRefs) {
        List<UUID> refs = definitionRefs == null ? List.of() : distinct(definitionRefs);
        if (refs.isEmpty()) return Map.of();
        Map<UUID, Map<UUID, CopyOrderOptionValueBuilder>> valuesByDefinition = new LinkedHashMap<>();
        String placeholders = placeholders(refs);
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_VALUE_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CODE_VALUE_ROW_NAME_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_MATERIAL_ITEM_REF_MATERIAL_ITEM_CODE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ALTERNATE_G
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_MATERIAL_ON_MATERIAL_ORDER_OPTION_DEFINITION_VALUE_REF_VALUE_ROW_ORDER_OPTION_DEFINITION_VALUE_REF_LEFT_JOIN_CATALOG_LEFT_JOIN_CATALOG_CATALOG_ITEM
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_MATERIAL_ITEM_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_REF_ALTERNATE_A + placeholders + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ORDER_BY_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_C,
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) {
                        UUID definitionRef = rows.getObject(1, UUID.class);
                        UUID valueRef = rows.getObject(2, UUID.class);
                        Map<UUID, CopyOrderOptionValueBuilder> values =
                                valuesByDefinition.computeIfAbsent(definitionRef, ignored -> new LinkedHashMap<>());
                        CopyOrderOptionValueBuilder value = values.get(valueRef);
                        if (value == null) {
                            value = new CopyOrderOptionValueBuilder(
                                    valueRef, rows.getString(3), rows.getString(4), rows.getInt(5));
                            values.put(valueRef, value);
                        }
                        UUID materialRef = rows.getObject(6, UUID.class);
                        if (materialRef != null) {
                            UUID materialItemRef = rows.getObject(7, UUID.class);
                            String materialItemCode = rows.getString(8);
                            if (materialItemRef == null || materialItemCode == null || materialItemCode.isBlank()) {
                                String problemMessage = "点单选项扣料原材料不存在";
                                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, problemMessage);
                            }
                            value.addMaterial(new CopyOrderOptionMaterial(
                                    materialRef,
                                    materialItemRef,
                                    materialItemCode,
                                    rows.getObject(9, UUID.class),
                                    new InventoryOwnerApi.UnitSnapshot(
                                            rows.getObject(10, UUID.class),
                                            rows.getString(11),
                                            rows.getString(12),
                                            rows.getString(13),
                                            rows.getInt(14))));
                        }
                    }
                    return null;
                });
        Map<UUID, List<CopyOrderOptionValue>> result = new LinkedHashMap<>();
        valuesByDefinition.forEach((definitionRef, values) -> result.put(
                definitionRef,
                values.values().stream().map(CopyOrderOptionValueBuilder::build).toList()));
        return Map.copyOf(result);
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
    public void copyAttributeAssignments(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Map<UUID, UUID> copiedItemRefs,
            long now) {
        if (copiedItemRefs == null || copiedItemRefs.isEmpty()) return;
        List<UUID> sourceItems = distinct(copiedItemRefs.keySet());
        List<CopyAttributeAssignment> assignments = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG_ASSIGNMENT_ITEM_REF_ATTRIBUTE_DEFINITION_REF_TEXT_VALUE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ASSIGNMENT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_JOIN_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION_ON_DEFINITION_ATTRIBUTE_DEFINITION_REF_ASSIGNMENT_ATTRIBUTE_DEFINITION_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_DEFINITION_DATA_NODE_REF_BRAND_REF_ASSIGNMENT
                        + placeholders(sourceItems)
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ASSIGNMENT_ITEM_REF_ATTRIBUTE_DEFINITION_REF,
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
                        CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_ATTRIBUTE_DEFINITION
                                +
                                /* format-wrap */
                                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CONDITION_AND_REF_CODE_NAME_VALUE_TYPE
                                +
                                /* format-wrap */
                                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A
                                + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUES_VALUES_1,
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
                            CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_OPTION_ATTRIBUTE_DEFINITION_OPTION_REF_ATTRIBUTE_DEFINITION_REF_NAME_DISPLAY_ORDER_VALUES_ATTRIBUTE_DEFINITION_REF_NAME_DISPLAY_ORDER_VALUES,
                            targetOptionRef,
                            targetRef,
                            option.name(),
                            option.displayOrder());
                    copiedOptions.add(new CopyAttributeOption(targetOptionRef, option.name(), option.displayOrder()));
                    optionMappings.put(option.ref(), targetOptionRef);
                }
                target = new CopyAttributeDefinition(
                        targetRef, source.code(), source.name(), source.valueType(), 1L, List.copyOf(copiedOptions));
            } else {
                for (int index = 0; index < source.options().size(); index++)
                    optionMappings.put(
                            source.options().get(index).ref(),
                            target.options().get(index).ref());
            }
            definitionMappings.put(source.ref(), target.ref());
        }
        Map<UUID, Map<UUID, List<UUID>>> selectedOptionsByItem = assignmentOptionRefsByItems(sourceItems);
        for (CopyAttributeAssignment source : assignments) {
            UUID targetItemRef = copiedItemRefs.get(source.itemRef());
            UUID targetAssignmentRef = UUID.randomUUID();
            jdbc.update(
                    CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ITEM_REF_ATTRIBUTE_DEFINITION_REF_TEXT_VALUE_VALUES_ITEM_REF_ATTRIBUTE_DEFINITION_REF_TEXT_VALUE_VALUES,
                    targetAssignmentRef,
                    targetItemRef,
                    required(definitionMappings, source.definitionRef(), "商品属性复制引用未完成映射"),
                    source.textValue());
            for (UUID sourceOptionRef : selectedOptionsByItem
                    .getOrDefault(source.itemRef(), Map.of())
                    .getOrDefault(source.definitionRef(), List.of()))
                jdbc.update(
                        CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_INSERT_INTO_CATALOG_CATALOG_ITEM_ATTRIBUTE_SELECTION_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ATTRIBUTE_DEFINITION_OPTION_REF_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ATTRIBUTE_DEFINITION_OPTION_REF_VALUES,
                        targetAssignmentRef,
                        required(optionMappings, sourceOptionRef, "商品属性选项复制引用未完成映射"));
        }
    }

    public List<String> attributeCopyConflictCodes(
            String sourceScope,
            String sourceBrand,
            String targetScope,
            String targetBrand,
            Collection<UUID> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) return List.of();
        return attributeCopyConflictCodes(
                targetScope,
                targetBrand,
                readCopyAttributeFacts(sourceScope, sourceBrand, sourceItems)
                        .definitions()
                        .values());
    }

    public List<String> attributeCopyConflictCodes(
            String targetScope, String targetBrand, Collection<CopyAttributeDefinition> sourceDefinitions) {
        if (sourceDefinitions == null || sourceDefinitions.isEmpty()) return List.of();
        Map<String, CopyAttributeDefinition> target =
                targetAttributeDefinitions(targetScope, targetBrand, sourceDefinitions);
        return sourceDefinitions.stream()
                .filter(value -> target.containsKey(value.code()) && !value.sameShape(target.get(value.code())))
                .map(CopyAttributeDefinition::code)
                .sorted()
                .toList();
    }

    /** Stable source fingerprint so a changed referenced definition invalidates an earlier copy preflight. */
    public String attributeCopyFingerprint(String scope, String brand, Collection<UUID> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) return "";
        return attributeCopyFingerprint(
                readCopyAttributeFacts(scope, brand, sourceItems).definitions().values());
    }

    public String attributeCopyFingerprint(Collection<CopyAttributeDefinition> definitions) {
        if (definitions == null || definitions.isEmpty()) return "";
        List<String> parts = new ArrayList<>();
        definitions.stream()
                .sorted(java.util.Comparator.comparing(CopyAttributeDefinition::code)
                        .thenComparing(CopyAttributeDefinition::valueType)
                        .thenComparingLong(CopyAttributeDefinition::version)
                        .thenComparing(definition -> definition.ref().toString()))
                .forEach(definition -> {
                    String prefix = definition.code() + ":" + definition.valueType() + ":" + definition.version();
                    if (definition.options().isEmpty()) {
                        parts.add(prefix + "::null");
                        return;
                    }
                    definition.options().stream()
                            .sorted(java.util.Comparator.comparingInt(CopyAttributeOption::displayOrder)
                                    .thenComparing(option -> option.ref().toString()))
                            .forEach(option -> parts.add(prefix + ":" + (option.name() == null ? "" : option.name())
                                    + ":" + option.displayOrder()));
                });
        return String.join("|", parts);
    }

    private Map<UUID, CopyAttributeDefinition> copyAttributeDefinitions(String scope, String brand, List<UUID> refs) {
        Map<UUID, List<CopyAttributeOption>> optionsByDefinition = copyAttributeOptionsByDefinitions(refs);
        Map<UUID, CopyAttributeDefinition> definitions = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_CODE_NAME_VALUE_TYPE
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_DATA_NODE_REF_BRAND_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_REF
                        + placeholders(refs) + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ALTERNATE_D,
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
                                        rows.getLong(5),
                                        optionsByDefinition.getOrDefault(ref, List.of())));
                    }
                    return values;
                });
        return Map.copyOf(definitions);
    }

    private Map<String, CopyAttributeDefinition> targetAttributeDefinitions(
            String scope, String brand, Collection<CopyAttributeDefinition> source) {
        List<String> codes = source.stream().map(CopyAttributeDefinition::code).toList();
        if (codes.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogItemDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogItemDefinitionFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, CopyAttributeDefinitionBuilder> definitions = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_DEFINITION_ATTRIBUTE_DEFINITION_REF_CODE_NAME
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_NAME_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_OPTION_ROW_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_ATTRIBUTE_DEFINITION_REF_DEFINITION_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_DATA_NODE_REF_BRAND_REF_CODE
                        + placeholders + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_CODE_ATTRIBUTE_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF_ALTERNATE_A,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    for (int index = 0; index < codes.size(); index++) statement.setString(index + 3, codes.get(index));
                },
                rows -> {
                    Map<UUID, CopyAttributeDefinitionBuilder> values = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        CopyAttributeDefinitionBuilder definition = values.get(ref);
                        if (definition == null) {
                            definition = new CopyAttributeDefinitionBuilder(
                                    ref, rows.getString(2), rows.getString(3), rows.getString(4), rows.getLong(5));
                            values.put(ref, definition);
                        }
                        UUID optionRef = rows.getObject(6, UUID.class);
                        if (optionRef != null) definition.addOption(optionRef, rows.getString(7), rows.getInt(8));
                    }
                    return values;
                });
        Map<String, CopyAttributeDefinition> result = new LinkedHashMap<>();
        definitions.values().forEach(definition -> {
            CopyAttributeDefinition value = definition.build();
            result.put(value.code(), value);
        });
        return Map.copyOf(result);
    }

    private List<CopyAttributeOption> copyAttributeOptions(UUID definitionRef) {
        return copyAttributeOptionsByDefinitions(List.of(definitionRef)).getOrDefault(definitionRef, List.of());
    }

    private Map<UUID, List<CopyAttributeOption>> copyAttributeOptionsByDefinitions(Collection<UUID> definitionRefs) {
        List<UUID> refs = definitionRefs == null ? List.of() : distinct(definitionRefs);
        if (refs.isEmpty()) return Map.of();
        String placeholders = placeholders(refs);
        Map<UUID, List<CopyAttributeOption>> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_CATALOG
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO + placeholders
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ATTRIBUTE_DEFINITION_REF,
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next())
                        result.computeIfAbsent(rows.getObject(1, UUID.class), ignored -> new ArrayList<>())
                                .add(new CopyAttributeOption(
                                        rows.getObject(2, UUID.class), rows.getString(3), rows.getInt(4)));
                    return null;
                });
        result.replaceAll((ignored, options) -> List.copyOf(options));
        return Map.copyOf(result);
    }

    private List<UUID> assignmentOptionRefs(UUID itemRef, UUID definitionRef) {
        return assignmentOptionRefsByItems(List.of(itemRef))
                .getOrDefault(itemRef, Map.of())
                .getOrDefault(definitionRef, List.of());
    }

    private Map<UUID, Map<UUID, List<UUID>>> assignmentOptionRefsByItems(Collection<UUID> itemRefs) {
        List<UUID> refs = itemRefs == null ? List.of() : distinct(itemRefs);
        if (refs.isEmpty()) return Map.of();
        String placeholders = placeholders(refs);
        Map<UUID, Map<UUID, List<UUID>>> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ASSIGNMENT_ITEM_REF_ATTRIBUTE_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ASSIGNMENT_ALTERNATE_B
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ITEM_ATTRIBUTE_SELECTION_SELECTION_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION_ITEM_ATTRIBUTE_ASSIGNMENT_REF_ASSIGNMENT_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ASSIGNMENT_ITEM_REF_ALTERNATE_A + placeholders
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_ASSIGNMENT_ITEM_REF_ATTRIBUTE_DEFINITION_REF_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_SELECTION_ATTRIBUTE_DEFINITION_OPTION_REF_ALTERNATE_A,
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next())
                        result.computeIfAbsent(rows.getObject(1, UUID.class), ignored -> new LinkedHashMap<>())
                                .computeIfAbsent(rows.getObject(2, UUID.class), ignored -> new ArrayList<>())
                                .add(rows.getObject(3, UUID.class));
                    return null;
                });
        result.values().forEach(byDefinition -> byDefinition.replaceAll((ignored, options) -> List.copyOf(options)));
        return Map.copyOf(result);
    }

    private Map<UUID, AttributeDefinition> loadAttributeDefinitions(
            String scope, String brand, List<AttributeAssignment> assignments) {
        List<UUID> refs = assignments.stream()
                .map(AttributeAssignment::definitionRef)
                .distinct()
                .toList();
        if (refs.isEmpty()) return Map.of();
        Map<UUID, AttributeDefinition> definitions = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_DEFINITION_ATTRIBUTE_DEFINITION_REF_VALUE_TYPE_STATUS
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_ATTRIBUTE_DEFINITION_OPTION_REF_FROM_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION_LEFT_JOIN_CATALOG_ATTRIBUTE_DEFINITION_DEFINITION_LEFT_JOIN
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_OPTION_OPTION_ROW_ON_OPTION_ROW_ATTRIBUTE_DEFINITION_REF_DEFINITION_ATTRIBUTE_DEFINITION_REF_WHERE_DEFINITION_WHERE_DEFINITION_DATA_NODE_REF_AND
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_BRAND_REF_ATTRIBUTE_DEFINITION_REF
                        + placeholders(refs) + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_ATTRIBUTE_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_OPTION_ROW_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF_ALTERNATE_B,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, String> valueTypes = new LinkedHashMap<>();
                    Map<UUID, String> statuses = new LinkedHashMap<>();
                    Map<UUID, List<UUID>> optionRefs = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        valueTypes.putIfAbsent(ref, rows.getString(2));
                        statuses.putIfAbsent(ref, rows.getString(3));
                        UUID optionRef = rows.getObject(4, UUID.class);
                        if (optionRef != null)
                            optionRefs
                                    .computeIfAbsent(ref, ignored -> new ArrayList<>())
                                    .add(optionRef);
                    }
                    Map<UUID, AttributeDefinition> values = new LinkedHashMap<>();
                    valueTypes.forEach((ref, valueType) -> values.put(
                            ref,
                            new AttributeDefinition(
                                    valueType, statuses.get(ref), optionRefs.getOrDefault(ref, List.of()))));
                    return values;
                });
        return Map.copyOf(definitions);
    }

    private Map<UUID, OrderOptionDefinition> loadOrderOptionDefinitions(
            String scope, String brand, List<OrderOptionConfig> configs) {
        List<UUID> refs = configs.stream()
                .map(OrderOptionConfig::definitionRef)
                .distinct()
                .toList();
        if (refs.isEmpty()) return Map.of();
        Map<UUID, OrderOptionDefinition> definitions = jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_DEFINITION_ORDER_OPTION_DEFINITION_REF_SELECTION_MODE_STATUS
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ALTERNATIVE_CATALOG_ORDER_OPTION_DEFINITION
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DEFINITION_ALTERNATE_A
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_DATA_NODE_REF_BRAND_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_DEFINITION_ORDER_OPTION_DEFINITION_REF
                        + placeholders(refs) + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_CLOSE_PAREN_DEFINITION_ORDER_OPTION_DEFINITION_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_VALUE_ROW_DISPLAY_ORDER_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    bind(statement, refs, 3);
                },
                rows -> {
                    Map<UUID, String> selectionModes = new LinkedHashMap<>();
                    Map<UUID, String> statuses = new LinkedHashMap<>();
                    Map<UUID, Set<UUID>> valueRefs = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        selectionModes.putIfAbsent(ref, rows.getString(2));
                        statuses.putIfAbsent(ref, rows.getString(3));
                        UUID valueRef = rows.getObject(4, UUID.class);
                        if (valueRef != null)
                            valueRefs
                                    .computeIfAbsent(ref, ignored -> new LinkedHashSet<>())
                                    .add(valueRef);
                    }
                    Map<UUID, OrderOptionDefinition> values = new LinkedHashMap<>();
                    selectionModes.forEach((ref, selectionMode) -> values.put(
                            ref,
                            new OrderOptionDefinition(
                                    selectionMode, statuses.get(ref), valueRefs.getOrDefault(ref, Set.of()))));
                    return values;
                });
        return Map.copyOf(definitions);
    }

    private Set<UUID> definitionValues(UUID definitionRef) {
        return jdbc.query(
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_VALUE_ROW_ORDER_OPTION_DEFINITION_VALUE_REF
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ORDER_OPTION_DEFINITION_VA_VALUE_ROW
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_WHERE_VALUE_ROW_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER
                        + CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_VALUE_REF,
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
                CatalogItemDefinitionFactsSql.CATALOG_ITEM_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_OPTION_REF_FROM_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_OPTION_WHERE_BY_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF,
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

    /**
     * A disabled definition may remain on an existing item, but a submitted definition ref that was not already
     * attached is a new binding and must be enabled. The caller owns the current-vs-submitted ref comparison; this
     * helper deliberately does not infer change from the definition's descriptive fields.
     */
    private static void requireBindableDefinition(String status, boolean alreadyAttached, String message) {
        if (!alreadyAttached && !"ENABLED".equals(status))
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
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
        LinkedHashSet<Integer> displayOrders = new LinkedHashSet<>();
        for (JsonNode node : submitted) {
            UUID definitionRef = requiredUuid(node, "definitionRef");
            if (!definitions.add(definitionRef)) throw problem("商品不能重复选择同一个点单选项");
            Integer displayOrder = nullableInt(node, "displayOrder");
            if (displayOrder == null || displayOrder < 0 || !displayOrders.add(displayOrder))
                throw problem("点单选项显示顺序必须是从零开始且不能重复");
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
                    definitionRef,
                    displayOrder,
                    node.path("required").asBoolean(false),
                    min,
                    max,
                    List.copyOf(overrides)));
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

    private JsonNode parseNullable(String value) {
        if (value == null) return null;
        try {
            return mapper.readTree(value);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "选项制作变化读取失败", failure);
        }
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
        return String.join(
                CatalogItemDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemDefinitionFactsSql.PARAMETER_PLACEHOLDER));
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

    private record AttributeDefinition(String valueType, String status, List<UUID> optionRefs) {}

    private record AttributeAssignment(UUID definitionRef, String textValue, List<UUID> optionRefs) {}

    private record OrderOptionDefinition(String selectionMode, String status, Set<UUID> valueRefs) {}

    private record OrderOptionConfig(
            UUID definitionRef,
            int displayOrder,
            boolean required,
            Integer minSelectionCount,
            Integer maxSelectionCount,
            List<OrderOptionValueOverride> values) {}

    private record OrderOptionValueOverride(UUID definitionValueRef, boolean isDefault, Long extraPrice) {}

    public record CopyOrderOptionDefinition(
            UUID ref,
            String code,
            String name,
            String selectionMode,
            long version,
            List<CopyOrderOptionValue> values) {}

    public record CopyOrderOptionFacts(
            List<CopyOrderOptionDefinition> definitions,
            Map<UUID, List<UUID>> definitionRefsByItem,
            Map<UUID, ArrayNode> configsByItem) {
        public static CopyOrderOptionFacts empty() {
            return new CopyOrderOptionFacts(List.of(), Map.of(), Map.of());
        }
    }

    public record CopyOrderOptionValue(
            UUID ref, String code, String name, int displayOrder, List<CopyOrderOptionMaterial> materials) {}

    public record CopyOrderOptionMaterial(
            UUID ref,
            UUID materialItemRef,
            String materialItemCode,
            UUID stockTargetRef,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    public record OrderOptionCopyPlan(
            Map<UUID, UUID> definitionMappings,
            Map<UUID, UUID> valueMappings,
            Map<UUID, UUID> materialMappings,
            List<String> conflictCodes) {
        public static OrderOptionCopyPlan empty() {
            return new OrderOptionCopyPlan(Map.of(), Map.of(), Map.of(), List.of());
        }
    }

    private static final class CopyOrderOptionDefinitionBuilder {
        private final UUID ref;
        private final String code;
        private final String name;
        private final String selectionMode;
        private final long version;
        private final Map<UUID, CopyOrderOptionValueBuilder> values = new LinkedHashMap<>();

        private CopyOrderOptionDefinitionBuilder(
                UUID ref, String code, String name, String selectionMode, long version) {
            this.ref = ref;
            this.code = code;
            this.name = name;
            this.selectionMode = selectionMode;
            this.version = version;
        }

        private CopyOrderOptionValueBuilder value(UUID ref, String code, String name, int displayOrder) {
            return values.computeIfAbsent(
                    ref, ignored -> new CopyOrderOptionValueBuilder(ref, code, name, displayOrder));
        }

        private CopyOrderOptionDefinition build() {
            return new CopyOrderOptionDefinition(
                    ref,
                    code,
                    name,
                    selectionMode,
                    version,
                    values.values().stream()
                            .map(CopyOrderOptionValueBuilder::build)
                            .toList());
        }
    }

    private static final class CopyOrderOptionValueBuilder {
        private final UUID ref;
        private final String code;
        private final String name;
        private final int displayOrder;
        private final Map<UUID, CopyOrderOptionMaterial> materials = new LinkedHashMap<>();

        private CopyOrderOptionValueBuilder(UUID ref, String code, String name, int displayOrder) {
            this.ref = ref;
            this.code = code;
            this.name = name;
            this.displayOrder = displayOrder;
        }

        private void addMaterial(CopyOrderOptionMaterial material) {
            materials.putIfAbsent(material.ref(), material);
        }

        private CopyOrderOptionValue build() {
            return new CopyOrderOptionValue(ref, code, name, displayOrder, List.copyOf(materials.values()));
        }
    }

    private record CopyAttributeAssignment(UUID itemRef, UUID definitionRef, String textValue) {}

    private record CopyAttributeOption(UUID ref, String name, int displayOrder) {}

    public record CopyAttributeFacts(Map<UUID, ArrayNode> assignmentsByItem, Map<UUID, CopyAttributeDefinition> definitions) {
        public static CopyAttributeFacts empty() {
            return new CopyAttributeFacts(Map.of(), Map.of());
        }
    }

    public record TemporaryPromotionFacts(
            ArrayNode attributeAssignments, ArrayNode orderOptionConfigs, List<UUID> optionValueRefs) {
        public TemporaryPromotionFacts {
            optionValueRefs = optionValueRefs == null ? List.of() : List.copyOf(optionValueRefs);
        }

        boolean hasAttributeAssignments() {
            return attributeAssignments != null && !attributeAssignments.isEmpty();
        }

        boolean hasOrderOptionConfigs() {
            return orderOptionConfigs != null && !orderOptionConfigs.isEmpty();
        }
    }

    public record CopyAttributeDefinition(
            UUID ref, String code, String name, String valueType, long version, List<CopyAttributeOption> options) {
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

    private static final class CopyAttributeDefinitionBuilder {
        private final UUID ref;
        private final String code;
        private final String name;
        private final String valueType;
        private final long version;
        private final Map<UUID, CopyAttributeOption> options = new LinkedHashMap<>();

        private CopyAttributeDefinitionBuilder(UUID ref, String code, String name, String valueType, long version) {
            this.ref = ref;
            this.code = code;
            this.name = name;
            this.valueType = valueType;
            this.version = version;
        }

        private void addOption(UUID ref, String name, int displayOrder) {
            options.putIfAbsent(ref, new CopyAttributeOption(ref, name, displayOrder));
        }

        private CopyAttributeDefinition build() {
            return new CopyAttributeDefinition(
                    ref,
                    code,
                    name,
                    valueType,
                    version,
                    options.values().stream()
                            .sorted(java.util.Comparator.comparingInt(CopyAttributeOption::displayOrder)
                                    .thenComparing(option -> option.ref().toString()))
                            .toList());
        }
    }
}
