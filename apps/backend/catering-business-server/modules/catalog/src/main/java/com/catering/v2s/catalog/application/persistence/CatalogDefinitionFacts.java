package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.application.persistence.CatalogDefinitionFactsSql;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

/** Catalog-owned definition aggregates. Inventory resolution/deletion is intentionally composed by the coordinator. */
public class CatalogDefinitionFacts {
    static final int BOUNDED_LIST_LIMIT = 500;
    private final JdbcTemplate jdbc;

    public CatalogDefinitionFacts(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CatalogOwnerApi.AttributeDefinitionReadback> listAttributes(
            String scope, String brand, String candidateUsage) {
        boolean candidate = candidateOnly(candidateUsage);
        String statusPredicate = candidate ? CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CONDITION_STATUS_ENABLED : "";
        return jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CTE_BOUNDED_DEFINITION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_CODE_NAME_STATUS
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ATTRIBUTE_DEFINITION_FROM_CATALOG_CATALOG_ATTRIBU
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF
                        + statusPredicate + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_EMPTY_LITERAL
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ORDER_BY_NAME_CODE_ATTRIBUTE_DEFINITION_REF
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_DEFINITION_ATTRIBUTE_DEFINITION_REF_CODE_NAME
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DEFINITION_STATUS_VALUE_TYPE_VERSION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_OPTION_ATTRIBUTE_DEFINITION_OPTION_REF
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_OPTION_NAME_DISPLAY_ORDER
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_FROM_CLAUSE_BOUNDED_DEFINITION_DEFINITION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_OPTION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_JOIN_CONDITION_OPTION_ATTRIBUTE_DEFINITION_REF_DEFINITION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ORDER_BY_DEFINITION_NAME_CODE_ATTRIBUTE_DEFINITION_REF
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_OPTION_DISPLAY_ORDER_ATTRIBUTE_DEFINITION_OPTION_REF,
                (ResultSetExtractor<List<CatalogOwnerApi.AttributeDefinitionReadback>>) result -> {
                    Map<UUID, AttributeRow> definitions = new LinkedHashMap<>();
                    Map<UUID, List<CatalogOwnerApi.AttributeDefinitionOption>> optionsByDefinition =
                            new LinkedHashMap<>();
                    while (result.next()) {
                        UUID definitionRef = result.getObject(1, UUID.class);
                        if (!definitions.containsKey(definitionRef))
                            definitions.put(
                                    definitionRef,
                                    new AttributeRow(
                                            definitionRef,
                                            result.getString(2),
                                            result.getString(3),
                                            result.getString(4),
                                            result.getString(5),
                                            result.getLong(6)));
                        UUID optionRef = result.getObject(7, UUID.class);
                        if (optionRef != null)
                            optionsByDefinition
                                    .computeIfAbsent(definitionRef, ignored -> new ArrayList<>())
                                    .add(new CatalogOwnerApi.AttributeDefinitionOption(
                                            optionRef, result.getString(8), result.getInt(9)));
                    }
                    requireBounded(definitions.size());
                    return definitions.values().stream()
                            .map(definition -> new CatalogOwnerApi.AttributeDefinitionReadback(
                                    definition.ref(),
                                    definition.code(),
                                    definition.name(),
                                    definition.status(),
                                    definition.valueType(),
                                    List.copyOf(optionsByDefinition.getOrDefault(definition.ref(), List.of())),
                                    definition.version()))
                            .toList();
                },
                scope,
                brand,
                BOUNDED_LIST_LIMIT + 1);
    }

    public CatalogOwnerApi.AttributeDefinitionReadback createAttribute(
            String scope, String brand, CatalogOwnerApi.AttributeDefinitionCreateCommand command, long now) {
        validateAttribute(command.code(), command.name(), command.valueType(), command.options());
        UUID ref = UUID.randomUUID();
        try {
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ATTRIBUTE_DEFINITION
                            /* format-wrap */
                            +
                            /* format-wrap */
                            CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_REF_CODE_NAME_STATUS
                            +
                            /* format-wrap */
                            CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_VALUES_ENABLED,
                    ref,
                    scope,
                    brand,
                    command.code(),
                    command.name(),
                    command.valueType(),
                    now,
                    now);
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "商品属性编码已存在", failure);
        }
        replaceAttributeOptions(ref, command.options());
        return attributeReadback(requireAttribute(scope, brand, ref));
    }

    public CatalogOwnerApi.AttributeDefinitionReadback updateAttribute(
            String scope, String brand, CatalogOwnerApi.AttributeDefinitionUpdateCommand command, long now) {
        lockDefinition(command.definitionRef());
        AttributeRow current = requireAttribute(scope, brand, command.definitionRef());
        // spotless:off
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem(
                    "VOIDED_RECORD_IMMUTABLE", 409, "已作废的商品属性定义不可修改");
        // spotless:on
        // The definition type is creation-time fact.  An update can only change its own code/name
        // and, before use, its selectable values; it must never rely on a caller echoing a type.
        boolean shapeChange = !sameAttributeOptions(current.ref(), command.options());
        if (shapeChange && attributeUsed(current.ref()))
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_DEFINITION_CHANGE_REQUIRES_DECISION",
                    409,
                    /* format-wrap */
                    "已使用商品属性的类型或选项暂不能修改");
        validateAttribute(command.code(), command.name(), current.valueType(), command.options());
        int changed;
        try {
            changed = jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_SET_CODE_NAME_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_ATTRIBUTE_DEFINITION_REF_VERSION_AND_STATUS_VOIDED,
                    command.code(),
                    command.name(),
                    now,
                    current.ref(),
                    command.expectedVersion());
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "商品属性编码已存在", failure);
        }
        if (changed != 1)
            throw new CatalogOwnerApi.Problem(
                    "VERSION_CONFLICT",
                    409,
                    /* format-wrap */
                    "商品属性定义版本已变化");
        if (shapeChange) replaceAttributeOptions(current.ref(), command.options());
        return attributeReadback(requireAttribute(scope, brand, current.ref()));
    }

    public List<CatalogOwnerApi.OrderOptionDefinitionReadback> listOrderOptions(
            String scope, String brand, String candidateUsage) {
        boolean candidate = candidateOnly(candidateUsage);
        String statusPredicate = candidate ? CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CONDITION_STATUS_ENABLED_ALTERNATE_A : "";
        List<OrderOptionRow> rows = jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_ORDER_OPTION_DEFINITION_REF_CODE_NAME_STATUS
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_WHERE_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + statusPredicate + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ORDER_BY_NAME_CODE_ORDER_OPTION_DEFINITION_REF_LIMIT_NAME_CODE_ORDER_OPTION_DEFINITION_REF_LIMIT,
                (result, row) -> new OrderOptionRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getLong(6)),
                scope,
                brand,
                BOUNDED_LIST_LIMIT + 1);
        requireBounded(rows.size());
        return rows.stream().map(this::orderOptionReadback).toList();
    }

    private static boolean candidateOnly(String candidateUsage) {
        if (candidateUsage == null || candidateUsage.isBlank()) return false;
        if (!"ITEM_ASSIGNMENT".equals(candidateUsage))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "candidateUsage is not supported");
        return true;
    }

    public CatalogOwnerApi.OrderOptionDefinitionReadback createOrderOption(
            String scope, String brand, CatalogOwnerApi.OrderOptionDefinitionCreateCommand command, long now) {
        validateOrderOption(command.code(), command.name(), command.selectionMode(), command.values());
        UUID ref = UUID.randomUUID();
        try {
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION
                            +
                            /* format-wrap */
                            CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_BRAND_REF_CODE_NAME_STATUS
                            +
                            /* format-wrap */
                            CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_B
                            + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CLOSE_PAREN_ENABLED,
                    ref,
                    scope,
                    brand,
                    command.code(),
                    command.name(),
                    command.selectionMode(),
                    now,
                    now);
            // A new definition has no persisted values; avoid a guaranteed empty-set read before inserting them.
            replaceOrderOptionValues(scope, brand, ref, Map.of(), command.values());
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "点单选项编码已存在", failure);
        }
        return orderOptionReadback(requireOrderOption(scope, brand, ref));
    }

    public CatalogOwnerApi.OrderOptionDefinitionMutationReadback updateOrderOption(
            String scope, String brand, CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command, long now) {
        lockDefinition(command.definitionRef());
        OrderOptionRow current = requireOrderOption(scope, brand, command.definitionRef());
        // spotless:off
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem(
                    "VOIDED_RECORD_IMMUTABLE", 409, "已作废的点单选项定义不可修改");
        // spotless:on
        if (command.code() != null
                && !command.code().isBlank()
                && !current.code().equals(command.code()))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "点单选项编码创建后不可修改");
        validateOrderOption(current.code(), command.name(), command.selectionMode(), command.values());
        Map<UUID, ValueRow> existing = valuesByRef(current.ref());
        lockOrderOptionValueRefs(existing.keySet());
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        for (CatalogOwnerApi.OrderOptionValueCommand value : command.values())
            if (value.valueRef() != null) retained.add(value.valueRef());
        List<UUID> deleted = existing.keySet().stream()
                .filter(ref -> !retained.contains(ref))
                .toList();
        int changed = jdbc.update(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_SET_NAME_SELECTION_MODE_UPDATED_AT_EPOCH_MILLIS_WHERE_ORDER_OPTION_DEFINITION_REF
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CONDITION_VERSION_STATUS_VOIDED,
                command.name(),
                command.selectionMode(),
                now,
                current.ref(),
                command.expectedVersion());
        if (changed != 1)
            throw new CatalogOwnerApi.Problem(
                    "VERSION_CONFLICT",
                    409,
                    /* format-wrap */
                    "点单选项定义版本已变化");
        try {
            replaceOrderOptionValues(scope, brand, current.ref(), existing, command.values());
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "点单选项编码已存在", failure);
        }
        return new CatalogOwnerApi.OrderOptionDefinitionMutationReadback(
                orderOptionReadback(requireOrderOption(scope, brand, current.ref())), deleted);
    }

    private CatalogOwnerApi.AttributeDefinitionReadback attributeReadback(AttributeRow row) {
        List<CatalogOwnerApi.AttributeDefinitionOption> options = jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ATTRIBUTE_DEFINITIO
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_N_OPTION_ATTRIBUTE_DEFINITION_REF_DISPLAY_ORDER
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF,
                (result, index) -> new CatalogOwnerApi.AttributeDefinitionOption(
                        result.getObject(1, UUID.class), result.getString(2), result.getInt(3)),
                row.ref());
        return new CatalogOwnerApi.AttributeDefinitionReadback(
                row.ref(), row.code(), row.name(), row.status(), row.valueType(), options, row.version());
    }

    private CatalogOwnerApi.OrderOptionDefinitionReadback orderOptionReadback(OrderOptionRow row) {
        List<ValueReadbackRow> valueRows = jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ORDER_OPTION
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DEFINITION_VALUE_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_VALUE_REF,
                (result, index) -> new ValueReadbackRow(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getInt(4)),
                row.ref());
        Map<UUID, List<CatalogOwnerApi.OrderOptionMaterialReadback>> materialsByValue = materialsByValueRefs(
                valueRows.stream().map(ValueReadbackRow::ref).toList());
        List<CatalogOwnerApi.OrderOptionValueReadback> values = valueRows.stream()
                .map(value -> new CatalogOwnerApi.OrderOptionValueReadback(
                        value.ref(),
                        value.code(),
                        value.name(),
                        value.displayOrder(),
                        materialsByValue.getOrDefault(value.ref(), List.of())))
                .toList();
        return new CatalogOwnerApi.OrderOptionDefinitionReadback(
                row.ref(), row.code(), row.name(), row.status(), row.selectionMode(), values, row.version());
    }

    private List<CatalogOwnerApi.OrderOptionMaterialReadback> materials(UUID valueRef) {
        return materialsByValueRefs(List.of(valueRef)).getOrDefault(valueRef, List.of());
    }

    private Map<UUID, List<CatalogOwnerApi.OrderOptionMaterialReadback>> materialsByValueRefs(
            Collection<UUID> valueRefs) {
        List<UUID> refs = valueRefs == null
                ? List.of()
                : valueRefs.stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .toList();
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogDefinitionFactsSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(refs.size(), CatalogDefinitionFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, List<CatalogOwnerApi.OrderOptionMaterialReadback>> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_MATERIAL
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_MATERIAL_MATERIAL_ITEM_REF_MATERIAL_ITEM_NAME
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_MATERIAL
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_MATERIAL_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_FROM_CLAUSE_CATALOG_ITEM_MATERIAL
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_MATERIAL_ITEM_ITEM_REF_MATERIAL_MATERIAL_ITEM_REF
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF + placeholders + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CLOSE_PAREN_ORDER_BY
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_MATERIAL_ALTERNATE_A,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                rows -> {
                    while (rows.next()) {
                        UUID valueRef = rows.getObject(1, UUID.class);
                        result.computeIfAbsent(valueRef, ignored -> new ArrayList<>())
                                .add(new CatalogOwnerApi.OrderOptionMaterialReadback(
                                        rows.getObject(2, UUID.class),
                                        rows.getObject(3, UUID.class),
                                        rows.getString(4),
                                        rows.getObject(5, UUID.class),
                                        new InventoryOwnerApi.UnitSnapshot(
                                                rows.getObject(6, UUID.class),
                                                rows.getString(7),
                                                rows.getString(8),
                                                rows.getString(9),
                                                rows.getInt(10))));
                    }
                    return null;
                });
        result.replaceAll((ignored, materials) -> List.copyOf(materials));
        return Map.copyOf(result);
    }

    private void replaceAttributeOptions(UUID definitionRef, List<CatalogOwnerApi.AttributeDefinitionOption> options) {
        jdbc.update(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DELETE_CATALOG_ATTRIBUTE_DEFINITION_OPTIO_ATTRIBUTE_DEFINITION_REF,
                definitionRef);
        for (CatalogOwnerApi.AttributeDefinitionOption option : options)
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_OPTION_ATTRIBUTE_DEFINITION_OPTION_REF_ATTRIBUTE_DEFINITION_REF_NAME_DISPLAY_ORDER_VALUES_ATTRIBUTE_DEFINITION_REF_NAME_DISPLAY_ORDER_VALUES,
                    option.optionRef() == null ? UUID.randomUUID() : option.optionRef(),
                    definitionRef,
                    option.name(),
                    option.displayOrder());
    }

    private void replaceOrderOptionValues(
            String scope, String brand, UUID definitionRef, List<CatalogOwnerApi.OrderOptionValueCommand> submitted) {
        replaceOrderOptionValues(scope, brand, definitionRef, valuesByRef(definitionRef), submitted);
    }

    private void replaceOrderOptionValues(
            String scope,
            String brand,
            UUID definitionRef,
            Map<UUID, ValueRow> existing,
            List<CatalogOwnerApi.OrderOptionValueCommand> submitted) {
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        for (CatalogOwnerApi.OrderOptionValueCommand value : submitted) {
            UUID ref = value.valueRef() == null ? UUID.randomUUID() : value.valueRef();
            if (value.valueRef() != null && !existing.containsKey(ref))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "点单选项值不属于当前定义");
            if (existing.containsKey(ref) && !existing.get(ref).code().equals(value.code()))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR",
                        422,
                        /* format-wrap */
                        "点单选项值编码创建后不能修改");
            retained.add(ref);
            if (existing.containsKey(ref))
                jdbc.update(
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_VALUE_SET_NAME_DISPLAY_ORDER_WHERE_ORDER_OPTION_DEFINITION_VALUE_REF_NAME_DISPLAY_ORDER_WHERE_ORDER_OPTION_DEFINITION_VALUE_REF,
                        value.name(),
                        value.displayOrder(),
                        ref);
            else
                jdbc.update(
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_ORDER_OPTION_DEFINITION_VA
                                +
                                /* format-wrap */
                                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_REF_DATA_NODE_REF_BRAND_REF_CODE
                                +
                                /* format-wrap */
                                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_VALUES
                                + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_PARAMETER_PLACEHOLDER,
                        ref,
                        definitionRef,
                        scope,
                        brand,
                        value.code(),
                        value.name(),
                        value.displayOrder());
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DELETE_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_WHERE_ORDER_OPTION_DEFINITION_VALUE_REF_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_WHERE_ORDER_OPTION_DEFINITION_VALUE_REF,
                    ref);
            for (CatalogOwnerApi.OrderOptionMaterialTemplate material : value.materials()) {
                if (material.consumptionUnitSnapshot() == null)
                    throw new CatalogOwnerApi.Problem(
                            "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED",
                            422,
                            /* format-wrap */
                            "点单选项原料必须保存消耗单位快照");
                jdbc.update(
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_INSERT_INTO_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_MATERIAL_ORDER_OPTION_DEFINITION_MATERIAL_REF_ORDER_OPTION_DEFINITION_VALUE_REF_MATERIAL_ITEM_REF_STOCK_TARGET_REF
                                + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_VALUES_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_VALUES,
                        UUID.randomUUID(),
                        ref,
                        material.materialItemRef(),
                        material.stockTargetRef(),
                        material.consumptionUnitSnapshot().unitRef(),
                        material.consumptionUnitSnapshot().code(),
                        material.consumptionUnitSnapshot().name(),
                        material.consumptionUnitSnapshot().unitDimension(),
                        material.consumptionUnitSnapshot().precision());
            }
        }
        existing.keySet().stream().filter(ref -> !retained.contains(ref)).forEach(ref -> {
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DELETE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_DELETE_FROM_CATALOG_CATALOG_
                            + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A,
                    ref);
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DELETE_CATALOG_ORDER_OPTION_DEFINITION_MA_DELETE_FROM_CATALOG_CATALOG_
                            + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_B,
                    ref);
            jdbc.update(
                    CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DELETE_CATALOG_ORDER_OPTION_DEFINITION_VA_DELETE_FROM_CATALOG_CATALOG_
                            + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ALTERNATIVE_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_C,
                    ref);
        });
    }

    private boolean sameAttributeOptions(
            UUID definitionRef, List<CatalogOwnerApi.AttributeDefinitionOption> submitted) {
        List<CatalogOwnerApi.AttributeDefinitionOption> current = jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ATTRIBUTE_DEFINITIO_ALTERNATE_A
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_N_OPTION_ATTRIBUTE_DEFINITION_REF_DISPLAY_ORDER_ALTERNATE_A
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ATTRIBUTE_DEFINITION_OPTION_REF_ALTERNATE_A,
                (result, index) -> new CatalogOwnerApi.AttributeDefinitionOption(
                        result.getObject(1, UUID.class), result.getString(2), result.getInt(3)),
                definitionRef);
        return current.equals(submitted);
    }

    private boolean attributeUsed(UUID definitionRef) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_EXISTS_SELECT_FROM_CATALOG_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_WHERE_ATTRIBUTE_DEFINITION_REF_CATALOG_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_WHERE_ATTRIBUTE_DEFINITION_REF,
                Boolean.class,
                definitionRef));
    }

    private boolean orderOptionReferenced(UUID definitionRef) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ITEM_ORDER_OPTION_CONFIG_SELECT_EXISTS_SELECT_1_FROM_
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_WHERE_ORDER_OPTION_DEFINITION_REF,
                Boolean.class,
                definitionRef));
    }

    private void lockDefinition(UUID definitionRef) {
        if (definitionRef == null)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef is required");
        AdvisoryLock.acquire(jdbc, 0x43415444, definitionRef);
    }

    private static void validateLifecycleTarget(String targetStatus, String subject) {
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(targetStatus))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, subject + "状态不合法");
    }

    public CatalogOwnerApi.AttributeDefinitionReadback transitionAttributeStatus(
            String scope, String brand, CatalogOwnerApi.AttributeDefinitionStatusTransitionCommand command, long now) {
        lockDefinition(command.definitionRef());
        AttributeRow current = requireAttribute(scope, brand, command.definitionRef());
        validateLifecycleTarget(command.targetStatus(), "商品属性定义");
        // spotless:off
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem(
                    "VOIDED_RECORD_IMMUTABLE", 409, "已作废的商品属性定义不可修改");
        // spotless:on
        if (current.version() != command.expectedVersion())
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品属性定义版本已变化");
        // spotless:off
        if ("VOIDED".equals(command.targetStatus()) && attributeUsed(current.ref()))
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID", 422, "商品属性定义仍被商品引用，不能作废");
        // spotless:on
        // spotless:off
        if (jdbc.update(
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_ATTRIBUTE_DEFINITION_STATUS_VERSION
                                + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS
                                + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_WHERE_ATTRIBUTE_DEFINITION_REF_VERSION_STATUS_VOIDED,
                        command.targetStatus(),
                        now,
                        current.ref(),
                        command.expectedVersion())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品属性定义版本已变化");
        // spotless:on
        return attributeReadback(requireAttribute(scope, brand, current.ref()));
    }

    private AttributeRow requireAttribute(String scope, String brand, UUID ref) {
        List<AttributeRow> rows = jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_ATTRIBUTE_DEFINITION_REF_CODE_NAME_STATUS_ALTERNATE_A
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_FROM_CATALOG_CATALOG_ATTRIBUTE_DEFINITION_WHERE_DATA_NODE_REF_AND_BRAND_REF_AND_ATTRIBUTE_DEFINITION_REF_AND_BRAND_REF_AND_ATTRIBUTE_DEFINITION_REF,
                (result, index) -> new AttributeRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getLong(6)),
                scope,
                brand,
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品属性定义不存在");
        return rows.getFirst();
    }

    private OrderOptionRow requireOrderOption(String scope, String brand, UUID ref) {
        List<OrderOptionRow> rows = jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_ORDER_OPTION_DEFINITION_REF_CODE_NAME_STATUS_ALTERNATE_A
                        + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_FROM_CATALOG_CATALOG_ORDER_OPTION_DEFINITION_WHERE_DATA_NODE_REF_AND_BRAND_REF_AND_ORDER_OPTION_DEFINITION_REF_AND_BRAND_REF_AND_ORDER_OPTION_DEFINITION_REF,
                (result, index) -> new OrderOptionRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getLong(6)),
                scope,
                brand,
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "点单选项定义不存在");
        return rows.getFirst();
    }

    public CatalogOwnerApi.OrderOptionDefinitionReadback transitionOrderOptionStatus(
            String scope,
            String brand,
            CatalogOwnerApi.OrderOptionDefinitionStatusTransitionCommand command,
            long now) {
        lockDefinition(command.definitionRef());
        OrderOptionRow current = requireOrderOption(scope, brand, command.definitionRef());
        validateLifecycleTarget(command.targetStatus(), "点单选项定义");
        // spotless:off
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem(
                    "VOIDED_RECORD_IMMUTABLE", 409, "已作废的点单选项定义不可修改");
        // spotless:on
        if (current.version() != command.expectedVersion())
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "点单选项定义版本已变化");
        // spotless:off
        if ("VOIDED".equals(command.targetStatus()) && orderOptionReferenced(current.ref()))
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID", 422, "点单选项定义仍被商品引用，不能作废");
        // spotless:on
        // spotless:off
        if (jdbc.update(
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_CATALOG_ORDER_OPTION_DEFINITION_STATUS_VERSION
                                + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A
                                + CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_WHERE_ORDER_OPTION_DEFINITION_REF_VERSION_STATUS_VOIDED,
                        command.targetStatus(),
                        now,
                        current.ref(),
                        command.expectedVersion())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "点单选项定义版本已变化");
        // spotless:on
        return orderOptionReadback(requireOrderOption(scope, brand, current.ref()));
    }

    private Map<UUID, ValueRow> valuesByRef(UUID definitionRef) {
        return jdbc.query(
                CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_SELECT_CATALOG_ORDER_OPTION_ALTERNATE_A
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_DEFINITION_VALUE_ORDER_OPTION_DEFINITION_REF_DISPLAY_ORDER_ALTERNATE_A
                        +
                        /* format-wrap */
                        CatalogDefinitionFactsSql.CATALOG_DEFINITION_FACTS_ORDER_OPTION_DEFINITION_VALUE_REF_ALTERNATE_A,
                rows -> {
                    Map<UUID, ValueRow> values = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID ref = rows.getObject(1, UUID.class);
                        values.put(ref, new ValueRow(ref, rows.getString(2), rows.getString(3), rows.getInt(4)));
                    }
                    return values;
                },
                definitionRef);
    }

    /**
     * Inventory serializes option-value BOM saves/deletes on this same namespace. Definition aggregate mutation
     * acquires it before deleting a value or replacing its compulsory-material template, so an in-flight BOM write
     * cannot outlive the definition fact it names.
     */
    private void lockOrderOptionValueRefs(Collection<UUID> refs) {
        refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .forEach(ref -> AdvisoryLock.acquire(jdbc, 0x434F5056, ref));
    }

    private static void validateAttribute(
            String code, String name, String valueType, List<CatalogOwnerApi.AttributeDefinitionOption> options) {
        if (blank(code)
                || blank(name)
                || !List.of("TEXT", "SINGLE_SELECT", "MULTI_SELECT").contains(valueType))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "商品属性定义不完整");
        boolean select = !"TEXT".equals(valueType);
        if (select != !options.isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    /* format-wrap */
                    "文本属性不能有选项，选择型属性必须有选项");
        validateOrders(
                options.stream()
                        .map(CatalogOwnerApi.AttributeDefinitionOption::displayOrder)
                        .toList(),
                "商品属性选项排序");
        if (options.stream().anyMatch(option -> blank(option.name())))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "商品属性选项名称不能为空");
    }

    private static void validateOrderOption(
            String code, String name, String mode, List<CatalogOwnerApi.OrderOptionValueCommand> values) {
        if (blank(code) || blank(name) || !List.of("SINGLE", "MULTIPLE").contains(mode) || values.isEmpty())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "点单选项定义不完整");
        validateOrders(
                values.stream()
                        .map(CatalogOwnerApi.OrderOptionValueCommand::displayOrder)
                        .toList(),
                "点单选项排序");
        if (values.stream().anyMatch(value -> blank(value.code()) || blank(value.name())))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "点单选项编码和名称不能为空");
    }

    private static void validateOrders(Collection<Integer> orders, String name) {
        if (orders.stream().anyMatch(order -> order == null || order < 0)
                || new LinkedHashSet<>(orders).size() != orders.size())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, name + "必须从零开始且不能重复");
    }

    private static void requireBounded(int found) {
        if (found > BOUNDED_LIST_LIMIT)
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_DEFINITION_LIMIT_EXCEEDED",
                    422,
                    /* format-wrap */
                    "商品定义库条目超过500条，请先整理后再查看");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private record AttributeRow(UUID ref, String code, String name, String status, String valueType, long version) {}

    private record OrderOptionRow(
            UUID ref, String code, String name, String status, String selectionMode, long version) {}

    private record ValueReadbackRow(UUID ref, String code, String name, int displayOrder) {}

    private record ValueRow(UUID ref, String code, String name, int displayOrder) {}
}
