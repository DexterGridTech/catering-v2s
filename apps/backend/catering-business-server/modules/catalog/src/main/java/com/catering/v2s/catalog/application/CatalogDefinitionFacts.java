package com.catering.v2s.catalog.application;

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
final class CatalogDefinitionFacts {
    static final int BOUNDED_LIST_LIMIT = 500;
    private final JdbcTemplate jdbc;

    CatalogDefinitionFacts(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    List<CatalogOwnerApi.AttributeDefinitionReadback> listAttributes(String scope, String brand) {
        return jdbc.query(
                "WITH bounded_definition AS ("
                        + "SELECT attribute_definition_ref,code,name,value_type,version "
                        + "FROM catalog.catalog_attribute_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? "
                        + "ORDER BY name,code,attribute_definition_ref LIMIT ?) "
                        + "SELECT definition.attribute_definition_ref,definition.code,definition.name,"
                        + "definition.value_type,definition.version,option.attribute_definition_option_ref,"
                        + "option.name,option.display_order "
                        + "FROM bounded_definition definition "
                        + "LEFT JOIN catalog.catalog_attribute_definition_option option "
                        + "ON option.attribute_definition_ref=definition.attribute_definition_ref "
                        + "ORDER BY definition.name,definition.code,definition.attribute_definition_ref,"
                        + "option.display_order,option.attribute_definition_option_ref",
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
                                            result.getLong(5)));
                        UUID optionRef = result.getObject(6, UUID.class);
                        if (optionRef != null)
                            optionsByDefinition
                                    .computeIfAbsent(definitionRef, ignored -> new ArrayList<>())
                                    .add(new CatalogOwnerApi.AttributeDefinitionOption(
                                            optionRef, result.getString(7), result.getInt(8)));
                    }
                    requireBounded(definitions.size());
                    return definitions.values().stream()
                            .map(definition -> new CatalogOwnerApi.AttributeDefinitionReadback(
                                    definition.ref(),
                                    definition.code(),
                                    definition.name(),
                                    definition.valueType(),
                                    List.copyOf(optionsByDefinition.getOrDefault(definition.ref(), List.of())),
                                    definition.version()))
                            .toList();
                },
                scope,
                brand,
                BOUNDED_LIST_LIMIT + 1);
    }

    CatalogOwnerApi.AttributeDefinitionReadback createAttribute(
            String scope, String brand, CatalogOwnerApi.AttributeDefinitionCreateCommand command, long now) {
        validateAttribute(command.code(), command.name(), command.valueType(), command.options());
        UUID ref = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO catalog.catalog_attribute_definition(attribute_definition_ref,data_node_ref,brand_"
                            /* format-wrap */
                            +
                            /* format-wrap */
                            "ref,code,name,value_type,version,created_at_epoch_millis,updated_at_epoch_millis) "
                            +
                            /* format-wrap */
                            "VALUES(?"
                            + ",?,?,?,?,?,1,?,?)",
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

    CatalogOwnerApi.AttributeDefinitionReadback updateAttribute(
            String scope, String brand, CatalogOwnerApi.AttributeDefinitionUpdateCommand command, long now) {
        AttributeRow current = requireAttribute(scope, brand, command.definitionRef());
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
                    "UPDATE catalog.catalog_attribute_definition SET code=?,name=?,version=version+1,updated_at_epo"
                            + "ch_millis=? WHERE attribute_definition_ref=? AND version=?",
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

    CatalogOwnerApi.AttributeDefinitionDeleteReadback deleteAttribute(
            String scope, String brand, CatalogOwnerApi.AttributeDefinitionDeleteCommand command) {
        AttributeRow row = requireAttribute(scope, brand, command.definitionRef());
        if (row.version() != command.expectedVersion())
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品属性定义版本已变化");
        long assignmentCount = jdbc.queryForObject(
                "SELECT count(*) FROM catalog.catalog_item_attribute_assignment WHERE attribute_definition_ref=?",
                Long.class,
                row.ref());
        // This command is an aggregate cascade. Remove children in FK order instead
        // of leaking the database constraint as an unresolved HTTP 500.
        jdbc.update(
                "DELETE FROM catalog.catalog_item_attribute_selection WHERE item_attribute_assignment_ref IN "
                        + "(SELECT item_attribute_assignment_ref FROM catalog.catalog_item_attribute_assignment "
                        + "WHERE attribute_definition_ref=?)",
                row.ref());
        jdbc.update(
                "DELETE FROM catalog.catalog_item_attribute_assignment WHERE attribute_definition_ref=?", row.ref());
        jdbc.update(
                "DELETE FROM catalog.catalog_attribute_definition_option WHERE attribute_definition_ref=?", row.ref());
        if (jdbc.update(
                        "DELETE FROM catalog.catalog_attribute_definition WHERE attribute_definition_ref=? AND vers"
                                + "ion=?",
                        row.ref(),
                        command.expectedVersion())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品属性定义版本已变化");
        return new CatalogOwnerApi.AttributeDefinitionDeleteReadback(row.ref(), assignmentCount);
    }

    List<CatalogOwnerApi.OrderOptionDefinitionReadback> listOrderOptions(String scope, String brand) {
        List<OrderOptionRow> rows = jdbc.query(
                "SELECT order_option_definition_ref,code,name,selection_mode,version FROM catalog.catalog_order_opt"
                        + "ion_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? ORDER BY name,code,order_option_definition_ref LIM"
                        + "IT ?",
                (result, row) -> new OrderOptionRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getLong(5)),
                scope,
                brand,
                BOUNDED_LIST_LIMIT + 1);
        requireBounded(rows.size());
        return rows.stream().map(this::orderOptionReadback).toList();
    }

    CatalogOwnerApi.OrderOptionDefinitionReadback createOrderOption(
            String scope, String brand, CatalogOwnerApi.OrderOptionDefinitionCreateCommand command, long now) {
        validateOrderOption(command.code(), command.name(), command.selectionMode(), command.values());
        UUID ref = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO catalog.catalog_order_option_definition(order_option_definition_ref,data_node_ref,"
                            +
                            /* format-wrap */
                            "brand_ref,code,name,selection_mode,version,created_at_epoch_millis,"
                            +
                            /* format-wrap */
                            "updated_at_epoch_millis"
                            + ") VALUES(?,?,?,?,?,?,1,?,?)",
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

    CatalogOwnerApi.OrderOptionDefinitionMutationReadback updateOrderOption(
            String scope, String brand, CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command, long now) {
        OrderOptionRow current = requireOrderOption(scope, brand, command.definitionRef());
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
                "UPDATE catalog.catalog_order_option_definition SET name=?,selection_mode=?,version=version+1,updat"
                        + "ed_at_epoch_millis=? WHERE order_option_definition_ref=? AND version=?",
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

    CatalogOwnerApi.OrderOptionDefinitionDeleteReadback deleteOrderOption(
            String scope, String brand, CatalogOwnerApi.OrderOptionDefinitionDeleteCommand command) {
        OrderOptionRow row = requireOrderOption(scope, brand, command.definitionRef());
        if (row.version() != command.expectedVersion())
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "点单选项定义版本已变化");
        List<UUID> valueRefs = new ArrayList<>(valuesByRef(row.ref()).keySet());
        lockOrderOptionValueRefs(valueRefs);
        long configCount = jdbc.queryForObject(
                "SELECT count(*) FROM catalog.catalog_item_order_option_config WHERE order_option_definition_ref=?",
                Long.class,
                row.ref());
        jdbc.update(
                "DELETE FROM catalog.catalog_item_order_option_value_override WHERE "
                        + "item_order_option_config_ref IN (SELECT item_order_option_config_ref FROM "
                        + "catalog.catalog_item_order_option_config WHERE order_option_definition_ref=?)",
                row.ref());
        jdbc.update(
                "DELETE FROM catalog.catalog_item_order_option_config WHERE order_option_definition_ref=?", row.ref());
        jdbc.update(
                "DELETE FROM catalog.catalog_order_option_definition_material WHERE "
                        + "order_option_definition_value_ref IN (SELECT order_option_definition_value_ref FROM "
                        + "catalog.catalog_order_option_definition_value WHERE order_option_definition_ref=?)",
                row.ref());
        jdbc.update(
                "DELETE FROM catalog.catalog_order_option_definition_value WHERE " + "order_option_definition_ref=?",
                row.ref());
        if (jdbc.update(
                        "DELETE FROM catalog.catalog_order_option_definition WHERE order_option_definition_ref=? AN"
                                + "D version=?",
                        row.ref(),
                        command.expectedVersion())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "点单选项定义版本已变化");
        return new CatalogOwnerApi.OrderOptionDefinitionDeleteReadback(row.ref(), valueRefs, configCount);
    }

    private CatalogOwnerApi.AttributeDefinitionReadback attributeReadback(AttributeRow row) {
        List<CatalogOwnerApi.AttributeDefinitionOption> options = jdbc.query(
                "SELECT attribute_definition_option_ref,name,display_order FROM catalog.catalog_attribute_definitio"
                        +
                        /* format-wrap */
                        "n_option WHERE attribute_definition_ref=? ORDER BY display_order,"
                        +
                        /* format-wrap */
                        "attribute_definition_option_ref",
                (result, index) -> new CatalogOwnerApi.AttributeDefinitionOption(
                        result.getObject(1, UUID.class), result.getString(2), result.getInt(3)),
                row.ref());
        return new CatalogOwnerApi.AttributeDefinitionReadback(
                row.ref(), row.code(), row.name(), row.valueType(), options, row.version());
    }

    private CatalogOwnerApi.OrderOptionDefinitionReadback orderOptionReadback(OrderOptionRow row) {
        List<ValueReadbackRow> valueRows = jdbc.query(
                "SELECT order_option_definition_value_ref,code,name,display_order FROM catalog.catalog_order_option"
                        +
                        /* format-wrap */
                        "_definition_value WHERE order_option_definition_ref=? ORDER BY display_order,"
                        +
                        /* format-wrap */
                        "order_option_defi"
                        + "nition_value_ref",
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
                row.ref(), row.code(), row.name(), row.selectionMode(), values, row.version());
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
        String placeholders = String.join(",", java.util.Collections.nCopies(refs.size(), "?"));
        Map<UUID, List<CatalogOwnerApi.OrderOptionMaterialReadback>> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT material.order_option_definition_value_ref,material.order_option_definition_material_ref,"
                        + "material.material_item_ref,material_item.name,material.stock_target_ref,"
                        + "material.consumption_unit_ref,material.consumption_unit_code,material.consumption_unit_name,"
                        + "material.consumption_unit_dimension,material.consumption_unit_precision "
                        + "FROM catalog.catalog_order_option_definition_material material JOIN catalog.catalog_item "
                        + "material_item ON material_item.item_ref=material.material_item_ref WHERE material."
                        + "order_option_definition_value_ref IN (" + placeholders + ") ORDER BY "
                        + "material.order_option_definition_value_ref,material.order_option_definition_material_ref",
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
                "DELETE FROM catalog.catalog_attribute_definition_option WHERE attribute_definition_ref=?",
                definitionRef);
        for (CatalogOwnerApi.AttributeDefinitionOption option : options)
            jdbc.update(
                    "INSERT INTO catalog.catalog_attribute_definition_option(attribute_definition_option_ref,attrib"
                            + "ute_definition_ref,name,display_order) VALUES(?,?,?,?)",
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
                        "UPDATE catalog.catalog_order_option_definition_value SET name=?,display_order=? WHERE orde"
                                + "r_option_definition_value_ref=?",
                        value.name(),
                        value.displayOrder(),
                        ref);
            else
                jdbc.update(
                        "INSERT INTO catalog.catalog_order_option_definition_value(order_option_definition_value_re"
                                +
                                /* format-wrap */
                                "f,order_option_definition_ref,data_node_ref,brand_ref,code,name,display_order)"
                                +
                                /* format-wrap */
                                " VALUES("
                                + "?,?,?,?,?,?,?)",
                        ref,
                        definitionRef,
                        scope,
                        brand,
                        value.code(),
                        value.name(),
                        value.displayOrder());
            jdbc.update(
                    "DELETE FROM catalog.catalog_order_option_definition_material WHERE order_option_definition_val"
                            + "ue_ref=?",
                    ref);
            for (CatalogOwnerApi.OrderOptionMaterialTemplate material : value.materials()) {
                if (material.consumptionUnitSnapshot() == null)
                    throw new CatalogOwnerApi.Problem(
                            "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED",
                            422,
                            /* format-wrap */
                            "点单选项原料必须保存消耗单位快照");
                jdbc.update(
                        "INSERT INTO catalog.catalog_order_option_definition_material(order_option_definition_mater"
                                + "ial_ref,order_option_definition_value_ref,material_item_ref,stock_target_ref,"
                                + "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_uni"
                                + "t_dimension,consumption_unit_precision) VALUES(?,?,?,?,?,?,?,?,?)",
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
                    "DELETE FROM catalog.catalog_item_order_option_value_override WHERE "
                            + "order_option_definition_value_ref=?",
                    ref);
            jdbc.update(
                    "DELETE FROM catalog.catalog_order_option_definition_material WHERE "
                            + "order_option_definition_value_ref=?",
                    ref);
            jdbc.update(
                    "DELETE FROM catalog.catalog_order_option_definition_value WHERE "
                            + "order_option_definition_value_ref=?",
                    ref);
        });
    }

    private boolean sameAttributeOptions(
            UUID definitionRef, List<CatalogOwnerApi.AttributeDefinitionOption> submitted) {
        List<CatalogOwnerApi.AttributeDefinitionOption> current = jdbc.query(
                "SELECT attribute_definition_option_ref,name,display_order FROM catalog.catalog_attribute_definitio"
                        +
                        /* format-wrap */
                        "n_option WHERE attribute_definition_ref=? ORDER BY display_order,"
                        +
                        /* format-wrap */
                        "attribute_definition_option_ref",
                (result, index) -> new CatalogOwnerApi.AttributeDefinitionOption(
                        result.getObject(1, UUID.class), result.getString(2), result.getInt(3)),
                definitionRef);
        return current.equals(submitted);
    }

    private boolean attributeUsed(UUID definitionRef) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE attribute_definition_"
                        + "ref=?)",
                Boolean.class,
                definitionRef));
    }

    private AttributeRow requireAttribute(String scope, String brand, UUID ref) {
        List<AttributeRow> rows = jdbc.query(
                "SELECT attribute_definition_ref,code,name,value_type,version FROM catalog.catalog_attribute_defini"
                        + "tion WHERE data_node_ref=? AND brand_ref=? AND attribute_definition_ref=?",
                (result, index) -> new AttributeRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getLong(5)),
                scope,
                brand,
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品属性定义不存在");
        return rows.getFirst();
    }

    private OrderOptionRow requireOrderOption(String scope, String brand, UUID ref) {
        List<OrderOptionRow> rows = jdbc.query(
                "SELECT order_option_definition_ref,code,name,selection_mode,version FROM catalog.catalog_order_opt"
                        + "ion_definition WHERE data_node_ref=? AND brand_ref=? AND order_option_definition_ref=?",
                (result, index) -> new OrderOptionRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getLong(5)),
                scope,
                brand,
                ref);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "点单选项定义不存在");
        return rows.getFirst();
    }

    private Map<UUID, ValueRow> valuesByRef(UUID definitionRef) {
        return jdbc.query(
                "SELECT order_option_definition_value_ref,code,name,display_order FROM catalog.catalog_order_option"
                        +
                        /* format-wrap */
                        "_definition_value WHERE order_option_definition_ref=? ORDER BY display_order,"
                        +
                        /* format-wrap */
                        "order_option_defi"
                        + "nition_value_ref",
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

    private record AttributeRow(UUID ref, String code, String name, String valueType, long version) {}

    private record OrderOptionRow(UUID ref, String code, String name, String selectionMode, long version) {}

    private record ValueReadbackRow(UUID ref, String code, String name, int displayOrder) {}

    private record ValueRow(UUID ref, String code, String name, int displayOrder) {}
}
