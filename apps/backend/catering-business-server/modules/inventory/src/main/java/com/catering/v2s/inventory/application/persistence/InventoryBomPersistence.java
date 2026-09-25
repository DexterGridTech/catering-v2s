package com.catering.v2s.inventory.application.persistence;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for Inventory BOM target admission facts. */
@Repository
public class InventoryBomPersistence {
    private final JdbcTemplate jdbc;

    public InventoryBomPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public InventoryOwnerApi.UnitSnapshot readConsumptionUnitSnapshot(UUID targetRef) {
        return jdbc
                .query(
                        InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_SELECT_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF,
                        (result, row) -> requiredConsumptionUnitSnapshot(result),
                        targetRef)
                .stream()
                .findFirst()
                .orElseThrow(() ->
                        new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "库存对象必须保存有效消耗单位快照"));
    }

    public InventoryOwnerApi.CountingUnitConfiguration readCountingUnitConfiguration(
            UUID targetRef, InventoryOwnerApi.UnitSnapshot consumption) {
        return jdbc
                .query(
                        InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_SELECT_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_PRECISION_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_PRECISION_COUNTING_UNIT_CONVERSION_FACTOR
                                + InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF_ALTERNATE_A,
                        (result, row) -> new InventoryOwnerApi.CountingUnitConfiguration(
                                unitSnapshot(result, 1), result.getBigDecimal(6)),
                        targetRef)
                .stream()
                .findFirst()
                .orElse(new InventoryOwnerApi.CountingUnitConfiguration(consumption, BigDecimal.ONE));
    }

    public Map<TargetIdentity, CatalogTargetDisplay> readCatalogTargetDisplays(
            String scope, String brand, Collection<UUID> itemRefs) {
        LinkedHashSet<UUID> distinctItemRefs = new LinkedHashSet<>(itemRefs);
        if (distinctItemRefs.isEmpty()) return Map.of();
        UUID[] values = distinctItemRefs.toArray(UUID[]::new);
        Map<TargetIdentity, CatalogTargetDisplay> result = new LinkedHashMap<>();
        jdbc.query(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_CATALOG_SKU_ITEM_SKU
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_JOIN_CONDITION_SKU_ITEM_REF_ITEM_DATA_NODE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ITEM_ITEM_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        UUID skuRef = rows.getObject(4, UUID.class);
                        result.putIfAbsent(
                                new TargetIdentity(itemRef, null),
                                new CatalogTargetDisplay(rows.getString(2), rows.getString(3), null, null));
                        if (skuRef != null)
                            result.put(
                                    new TargetIdentity(itemRef, skuRef),
                                    new CatalogTargetDisplay(
                                            rows.getString(2),
                                            rows.getString(3),
                                            rows.getString(5),
                                            rows.getString(6)));
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    public int updateTargetConfiguration(
            String configuration,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            long updatedAt,
            String scope,
            String brand,
            UUID targetRef,
            long expectedVersion) {
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_STOCK_TARGET_CONFIGURATION
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_PRECISION
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_COUNTING_UNIT_CONVERSION_FACTOR_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_BRAND_REF_TARGET_REF_VERSION,
                configuration,
                countingUnit == null ? null : countingUnit.unitRef(),
                countingUnit == null ? null : countingUnit.code(),
                countingUnit == null ? null : countingUnit.name(),
                countingUnit == null ? null : countingUnit.unitDimension(),
                countingUnit == null ? null : countingUnit.precision(),
                conversionFactor,
                updatedAt,
                scope,
                brand,
                targetRef,
                expectedVersion);
    }

    public int insertTarget(
            UUID targetRef,
            String scope,
            String brand,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String measureMode,
            String mode,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            String configuration,
            long createdAt,
            long updatedAt) {
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_INSERT_INTO
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_SKU_CODE_MEASURE_MODE_INVENTORY_MODE_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_PRECISION
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_DEFINITION_STATUS_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_VALUES_ENABLED
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_JOIN_CONDITION_ON_CONFLICT_DO_NOTHING,
                targetRef,
                scope,
                brand,
                itemRef,
                productSkuRef,
                itemCode,
                skuCode,
                measureMode,
                mode,
                consumptionUnit.unitRef(),
                consumptionUnit.code(),
                consumptionUnit.name(),
                consumptionUnit.unitDimension(),
                consumptionUnit.precision(),
                countingUnit == null ? null : countingUnit.unitRef(),
                countingUnit == null ? null : countingUnit.code(),
                countingUnit == null ? null : countingUnit.name(),
                countingUnit == null ? null : countingUnit.unitDimension(),
                countingUnit == null ? null : countingUnit.precision(),
                conversionFactor,
                configuration,
                createdAt,
                updatedAt);
    }

    public List<UUID> findTargetRefsByItem(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ITEM_REF_TARGET_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, itemRef);
                },
                (result, rowNumber) -> result.getObject(1, UUID.class));
    }

    public Map<UUID, List<CatalogMaterialTargetRow>> readTargetsByItemRefs(
            String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(itemRefs);
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(
                InventoryBomServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(refs.size(), InventoryBomServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        Map<UUID, List<CatalogMaterialTargetRow>> rowsByItem = new LinkedHashMap<>();
        jdbc.query(
                        InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT
                                + InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_ITEM_REF_TARGET_REF_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_NAME
                                + InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_BRAND_REF_ITEM_REF
                                + placeholders
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CLOSE_PAREN
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ORDER_BY_ITEM_REF_TARGET_REF,
                        (result, row) -> new CatalogMaterialTargetRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                requiredUnitSnapshot(result, 3)),
                        args.toArray())
                .forEach(row -> rowsByItem
                        .computeIfAbsent(row.itemRef(), ignored -> new ArrayList<>())
                        .add(row));
        return rowsByItem;
    }

    public int deleteOptionValueBoms(String scope, String brand, Collection<UUID> optionValueRefs) {
        List<UUID> refs = optionValueRefs.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        if (refs.isEmpty()) return 0;
        String placeholders = String.join(
                InventoryBomServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(refs.size(), InventoryBomServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.addAll(refs);
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_DELETE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_OPTION_VALUE_REF
                        + placeholders
                        + InventoryBomServiceSql.SQL_CLOSE_PAREN,
                arguments.toArray());
    }

    public List<CatalogBomRow> readOptionValueBoms(
            String scope, String brand, UUID sourceItemRef, Collection<UUID> optionValueRefs) {
        List<UUID> refs = new ArrayList<>(optionValueRefs);
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                InventoryBomServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(refs.size(), InventoryBomServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.add(sourceItemRef);
        arguments.addAll(refs);
        return jdbc.query(
                InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_SELECT_PRODUCT_SKU_REF_OPTION_VALUE_REF_SKU_CODE_OPTION_VALUE_CODE
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_PRODUCT_SKU_REF_OPTION_VALUE_REF
                        + placeholders
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CLOSE_PAREN_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ORDER_BY_OPTION_VALUE_REF,
                statement -> {
                    for (int index = 0; index < arguments.size(); index++)
                        statement.setObject(index + 1, arguments.get(index));
                },
                (result, rowNumber) -> new CatalogBomRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getString(3),
                        result.getString(4),
                        result.getLong(5),
                        result.getString(6)));
    }

    public int upsertCopiedOptionValueBom(
            UUID bomRef,
            String scope,
            String brand,
            UUID targetItemRef,
            UUID optionValueRef,
            String targetItemCode,
            String optionValueCode,
            String rows,
            long version,
            long updatedAt) {
        return jdbc.update(
                InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_INSERT_INTO_INVENTORY_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE_VERSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_PARAMETER_PLACEHOLDER_CAST_AS_JSONB
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_JOIN_CONDITION_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_00_0000_0000_000000000000_UU
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_OPEN_PAREN_OPTION_VALUE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_WHERE_DEFINITION_STATUS_ENABLED,
                bomRef,
                scope,
                brand,
                targetItemRef,
                null,
                optionValueRef,
                targetItemCode,
                null,
                optionValueCode,
                version,
                rows,
                updatedAt);
    }

    public ModeSwitchCounts readModeSwitchCounts(UUID targetRef, String scope, String brand) {
        long[] counts = jdbc.queryForObject(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_OPEN_PAREN_STOCK_TARGET_LEDGER_TARGET
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_JOIN_CONDITION_TARGET_TARGET_REF_LEDGER
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_TARGET_DATA_NODE_REF_BRAND_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_OPEN_PAREN_LATERAL_BOM_JSONB_ARRAY_ELEMENTS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CASE_JSONB_TYPEOF_BOM_ROWS_LINE
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_LINE_TARGET_REF,
                (result, rowNumber) -> new long[] {result.getLong(1), result.getLong(2)},
                targetRef,
                scope,
                brand,
                scope,
                brand,
                targetRef.toString());
        return new ModeSwitchCounts(counts[0], counts[1]);
    }

    public int updateDirectDefinition(
            String measureMode,
            String configuration,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            boolean componentEligible,
            long version,
            long updatedAt,
            UUID targetRef,
            String scope,
            String brand) {
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_STOCK_TARGET_MEASURE_MODE_INVENTORY_MODE_DIRECT
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONFIGURATION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_REF_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_PRECISION_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_WHERE_TARGET_REF_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS,
                measureMode,
                configuration,
                countingUnit == null ? null : countingUnit.unitRef(),
                countingUnit == null ? null : countingUnit.code(),
                countingUnit == null ? null : countingUnit.name(),
                countingUnit == null ? null : countingUnit.unitDimension(),
                countingUnit == null ? null : countingUnit.precision(),
                conversionFactor,
                componentEligible,
                version,
                updatedAt,
                targetRef,
                scope,
                brand);
    }

    public int insertDirectDefinition(
            UUID targetRef,
            String scope,
            String brand,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String measureMode,
            String inventoryMode,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            boolean componentEligible,
            String configuration,
            long createdAt,
            long updatedAt) {
        return jdbc.update(
                InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_INSERT_INTO_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ITEM_CODE_SKU_CODE_MEASURE_MODE_INVENTORY_MODE
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_NAME_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_DIMENSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_NAME
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_CONVERSION_FACTOR
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COMPONENT_ELIGIBLE_CONFIGURATION_BALANCE_VERSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_VALUES_ENABLED_ALTERNATE_A,
                targetRef,
                scope,
                brand,
                itemRef,
                productSkuRef,
                itemCode,
                skuCode,
                measureMode,
                inventoryMode,
                consumptionUnit.unitRef(),
                consumptionUnit.code(),
                consumptionUnit.name(),
                consumptionUnit.unitDimension(),
                consumptionUnit.precision(),
                countingUnit == null ? null : countingUnit.unitRef(),
                countingUnit == null ? null : countingUnit.code(),
                countingUnit == null ? null : countingUnit.name(),
                countingUnit == null ? null : countingUnit.unitDimension(),
                countingUnit == null ? null : countingUnit.precision(),
                conversionFactor,
                componentEligible,
                configuration,
                createdAt,
                updatedAt);
    }

    public int updateBomDefinition(String rows, long version, long updatedAt, UUID bomRef, String scope, String brand) {
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_STOCK_BOM_ROWS_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_WHERE_BOM_REF_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS,
                rows,
                version,
                updatedAt,
                bomRef,
                scope,
                brand);
    }

    public int insertBomDefinition(
            UUID bomRef,
            String scope,
            String brand,
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode,
            String rows,
            long updatedAt) {
        return jdbc.update(
                InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_INSERT_INTO_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_ALTERNATE_A
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_OPTION_VALUE_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_VALUES_ENABLED_ALTERNATE_B,
                bomRef,
                scope,
                brand,
                itemRef,
                productSkuRef,
                optionValueRef,
                itemCode,
                skuCode,
                optionValueCode,
                rows,
                updatedAt);
    }

    public int disableTargetDefinitions(String scope, String brand, Collection<UUID> refs, long updatedAt) {
        List<UUID> ordered =
                refs.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ordered.isEmpty()) return 0;
        List<Object> arguments = new ArrayList<>();
        arguments.add(updatedAt);
        arguments.addAll(ordered);
        arguments.add(scope);
        arguments.add(brand);
        String placeholders = String.join(
                InventoryBomServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(ordered.size(), InventoryBomServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_STOCK_TARGET_DEFINITION_STATUS_DISABLED_VERSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_B
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_WHERE_TARGET_REF
                        + placeholders
                        + InventoryBomServiceSql.TARGET_DISABLE_SCOPE_SUFFIX,
                arguments.toArray());
    }

    public int disableBomDefinitions(String scope, String brand, Collection<UUID> refs, long updatedAt) {
        List<UUID> ordered =
                refs.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ordered.isEmpty()) return 0;
        List<Object> arguments = new ArrayList<>();
        arguments.add(updatedAt);
        arguments.addAll(ordered);
        arguments.add(scope);
        arguments.add(brand);
        String placeholders = String.join(
                InventoryBomServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(ordered.size(), InventoryBomServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_STOCK_BOM_DEFINITION_STATUS_DISABLED_VERSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_C
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_WHERE_BOM_REF
                        + placeholders
                        + InventoryBomServiceSql.BOM_DISABLE_SCOPE_SUFFIX,
                arguments.toArray());
    }

    public List<RuleTargetFact> readRuleTargetFacts(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_TARGET_REF_ITEM_REF_PRODUCT_SKU_REF_VERSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_PRECISION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_COUNTING_UNIT_DIMENSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_MEASURE_MODE_COMPONENT_ELIGIBLE
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ORDER_BY_PRODUCT_SKU_REF_TARGET_REF,
                (result, rowNumber) -> new RuleTargetFact(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getLong(4),
                        result.getBigDecimal(5),
                        result.getString(6),
                        result.getString(7),
                        unitSnapshot(result, 8),
                        unitSnapshot(result, 13),
                        result.getBigDecimal(18),
                        result.getString(19),
                        result.getBoolean(20)),
                scope,
                brand,
                itemRef);
    }

    public List<RuleBomFact> readRuleBomFacts(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_BOM_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_ORDER_BY_PRODUCT_SKU_REF_OPTION_VALUE_REF_BOM_REF,
                (result, rowNumber) -> new RuleBomFact(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getObject(4, UUID.class),
                        result.getLong(5),
                        result.getString(6),
                        result.getString(7)),
                scope,
                brand,
                itemRef);
    }

    public List<CurrentBomRow> readCurrentBomRows(
            String scope, String brand, UUID itemRef, UUID productSkuRef, UUID optionValueRef) {
        String sql = optionValueRef != null
                ? InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_PRODUCT_SKU_REF_OPTION_VALUE_REF
                : productSkuRef == null
                        ? InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_SELECT_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF_ALTERNATE_A
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ALTERNATE_A
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF
                        : InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_SELECT_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF_ALTERNATE_B
                                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ALTERNATE_B
                                + InventoryBomServiceSql
                                        .INVENTORY_BOM_SERVICE_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ALTERNATE_A;
        sql += InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED;
        return jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, itemRef);
                    if (optionValueRef != null) statement.setObject(4, optionValueRef);
                    else if (productSkuRef != null) statement.setObject(4, productSkuRef);
                },
                result -> {
                    List<CurrentBomRow> rows = new ArrayList<>();
                    while (result.next()) rows.add(new CurrentBomRow(result.getLong(1), result.getString(2)));
                    return rows;
                });
    }

    public int upsertCatalogBomRows(
            UUID bomRef,
            String scope,
            String brand,
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode,
            long version,
            String rows,
            long updatedAt) {
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_INSERT_INTO_ALTERNATE_A
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_INVENTORY_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE_VERSION_ROWS_UPDATED_AT_EPOCH_MILLIS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_VALUES_VALUES_CAST_AS_JSONB_ON_CONF
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_OPTION_VALUE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_DEFINITION_STATUS_ENABLED
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SET_DO_UPDATE_SET
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_VERSION_EXCLUDED_VERSION_ROWS_EXCLUDED_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS,
                bomRef,
                scope,
                brand,
                itemRef,
                productSkuRef,
                optionValueRef,
                itemCode,
                skuCode,
                optionValueCode,
                version,
                rows,
                updatedAt);
    }

    public List<TargetRecord> readTargetByIdentity(String scope, String brand, UUID itemRef, UUID productSkuRef) {
        return jdbc.query(
                InventoryBomServiceSql.SELECT_PREFIX
                        + InventoryBomServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_PRODUCT_SKU_REF,
                (result, rowNumber) -> targetRecord(result, 1, true),
                scope,
                brand,
                itemRef,
                productSkuRef);
    }

    public Map<UUID, TargetRecord> readTargetsByRefs(
            String scope,
            String brand,
            Collection<UUID> targetRefs,
            boolean enabledOnly,
            boolean requireCompleteConsumptionUnit) {
        if (targetRefs.isEmpty()) return Map.of();
        UUID[] values = targetRefs.toArray(UUID[]::new);
        String statusPredicate = enabledOnly
                ? InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_A
                : "";
        return jdbc.query(
                InventoryBomServiceSql.SELECT_PREFIX
                        + InventoryBomServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_BRAND_REF
                        + statusPredicate
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_TARGET_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, TargetRecord> resolved = new LinkedHashMap<>();
                    while (result.next()) {
                        TargetRecord row = targetRecord(result, 1, requireCompleteConsumptionUnit);
                        if (resolved.putIfAbsent(row.ref(), row) != null)
                            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "目标库存对象引用不唯一");
                    }
                    return resolved;
                });
    }

    public CatalogDefinitionRecords readCatalogDefinitionFacts(
            String scope,
            String brand,
            UUID catalogItemRef,
            boolean includeDirectTargets,
            boolean includeComponentTargets) {
        String targetPredicate = includeDirectTargets
                ? InventoryBomServiceSql.TARGET_FILTER_ITEM
                : InventoryBomServiceSql.TARGET_FILTER_NONE;
        if (includeComponentTargets)
            targetPredicate += (includeDirectTargets ? InventoryBomServiceSql.TARGET_FILTER_OR : "")
                    + InventoryBomServiceSql.TARGET_FILTER_COMPONENT;
        String sql = InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CTE_BOM_ROWS
                + InventoryBomServiceSql
                        .INVENTORY_BOM_SERVICE_SELECT_PRODUCT_SKU_REF_OPTION_VALUE_REF_SKU_CODE_OPTION_VALUE_CODE_ALTERNATE_A
                + InventoryBomServiceSql
                        .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF_ALTERNATE_A
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_B
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CLOSE_PAREN_COMPONENT_TARGET_REFS
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_LINE_VALUE_TARGET_REF_COMPONENT_TARGET_REF
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_LATERAL_JSONB_ARRAY_ELEMENTS
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CASE_JSONB_TYPEOF_BOM_ROWS
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_THEN_BOM_ROWS_LINE
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CLOSE_PAREN_TARGET_ROW_KIND
                + InventoryBomServiceSql.TARGET_SELECT_COLUMNS
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_VALUE_SEPARATOR_TEXT_BIGINT
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_DATA_NODE_REF_BRAND_REF
                + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_TARGET_DEFINITION_STATUS_ENABLED
                + targetPredicate
                + InventoryBomServiceSql.SQL_CLOSE_PAREN_WITH_SPACE
                + InventoryBomServiceSql.COMBINED_TARGET_BOM_TAIL;
        List<TargetRecord> directTargets = new ArrayList<>();
        Map<UUID, TargetRecord> componentTargets = new LinkedHashMap<>();
        List<CatalogBomRow> bomOwners = new ArrayList<>();
        jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, catalogItemRef);
                    statement.setString(4, scope);
                    statement.setString(5, brand);
                    if (includeDirectTargets) statement.setObject(6, catalogItemRef);
                },
                result -> {
                    while (result.next()) {
                        if ("TARGET".equals(result.getString(1))) {
                            TargetRecord row = targetRecord(result, 2, true);
                            if (includeDirectTargets && catalogItemRef.equals(row.itemRef())) directTargets.add(row);
                            if (includeComponentTargets) componentTargets.put(row.ref(), row);
                        } else {
                            bomOwners.add(new CatalogBomRow(
                                    result.getObject(26, UUID.class),
                                    result.getObject(27, UUID.class),
                                    result.getString(28),
                                    result.getString(29),
                                    result.getLong(30),
                                    result.getString(31)));
                        }
                    }
                    return null;
                });
        return new CatalogDefinitionRecords(
                List.copyOf(directTargets), List.copyOf(bomOwners), Map.copyOf(componentTargets));
    }

    public ConsumptionTargetPage readConsumptionTargetCandidates(
            String scope, String brand, String keyword, String pattern, int limit, long offset) {
        List<ConsumptionTargetRecord> rows = jdbc.query(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_TARGET_TARGET_REF_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ITEM_NAME_SKU_SKU_NAME
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_TARGET_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_TARGET_CONSUMPTION_UNIT_PRECISION
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_STOCK_TARGET_TARGET
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_TARGET
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ITEM_DATA_NODE_REF_TARGET_BRAND_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CATALOG_SKU_SKU_PRODUCT_SKU_REF_TARGET
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_SKU_ITEM_REF_TARGET
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_WHERE_TARGET_DATA_NODE_REF_BRAND_REF
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_CONDITION_TARGET_DEFINITION_STATUS_ENABLED_COMPONENT_ELIGIBLE
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_TARGET_CONSUMPTION_UNIT_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_ITEM_NAME_ILIKE_SHORT_NAME
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ALTERNATIVE_TARGET_ITEM_CODE_ILIKE_SKU
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ALTERNATIVE_TARGET_SKU_CODE_ILIKE
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ORDER_BY_ITEM_NAME_SKU_SKU_NAME,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, keyword);
                    statement.setString(4, pattern);
                    statement.setString(5, pattern);
                    statement.setString(6, pattern);
                    statement.setString(7, pattern);
                    statement.setString(8, pattern);
                    statement.setInt(9, limit);
                    statement.setLong(10, offset);
                },
                (result, rowNumber) -> new ConsumptionTargetRecord(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        result.getString(5),
                        result.getString(6),
                        result.getString(7),
                        unitSnapshot(result, 8),
                        result.getLong(13)));
        return new ConsumptionTargetPage(rows, rows.isEmpty() ? 0L : rows.get(0).total());
    }

    public List<InventorySummaryRecord> readInventoryDeductionSummaries(
            String scope, String brand, Collection<UUID> itemRefs, Collection<UUID> productSkuRefs) {
        UUID[] requestedItemRefs = itemRefs.toArray(UUID[]::new);
        UUID[] requestedSkuRefs = productSkuRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_DIRECT_FACT_KIND_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_REF_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONSUMPTION_UNIT_PRECISION_INTEGER_BOM_LINE_COUNT
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_PRODUCT_SKU_REF_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ALTERNATIVE_PRODUCT_SKU_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_UNION_BOM_FACT_KIND_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_TEXT_INTEGER_JSONB_TYPEOF_ROWS
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_THEN_JSONB_ARRAY_LENGTH_ROWS_BOM_LINE_COUNT
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_BOM_DATA_NODE_REF_BRAND_REF
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_OPTION_VALUE_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_PRODUCT_SKU_REF_ITEM_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ALTERNATIVE_PRODUCT_SKU_REF_ALTERNATE_A
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF_FACT_KIND,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", requestedItemRefs));
                    statement.setArray(4, statement.getConnection().createArrayOf("uuid", requestedSkuRefs));
                    statement.setString(5, scope);
                    statement.setString(6, brand);
                    statement.setArray(7, statement.getConnection().createArrayOf("uuid", requestedItemRefs));
                    statement.setArray(8, statement.getConnection().createArrayOf("uuid", requestedSkuRefs));
                },
                (result, rowNumber) -> new InventorySummaryRecord(
                        result.getString(1),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        unitSnapshot(result, 5),
                        result.getInt(10)));
    }

    public TargetRecord readTarget(String scope, String brand, UUID targetRef) {
        return jdbc.queryForObject(
                InventoryBomServiceSql.SELECT_PREFIX
                        + InventoryBomServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_TARGET_REF
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_C,
                (result, rowNumber) -> targetRecord(result, 1, true),
                scope,
                brand,
                targetRef);
    }

    public long readGeneration(String scope, String brand) {
        Long value = jdbc.queryForObject(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_SELECT_STOCK_TARGET_VERSION_DATA_NODE_REF_BRAND_REF,
                Long.class,
                scope,
                brand);
        return value == null ? 0L : value;
    }

    public ReceiptRecord readReceipt(String scope, String key) {
        List<ReceiptRecord> rows = jdbc.query(
                InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                        + InventoryBomServiceSql.INVENTORY_BOM_SERVICE_CONDITION_IDEMPOTENCY_KEY,
                (result, rowNumber) -> new ReceiptRecord(result.getString(1), result.getString(2), result.getString(3)),
                scope,
                key);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public int saveReceipt(
            UUID receiptRef,
            String scope,
            String key,
            String operation,
            String requestHash,
            String response,
            long createdAt) {
        return jdbc.update(
                InventoryBomServiceSql.INVENTORY_BOM_SERVICE_INSERT_INTO_ALTERNATE_B
                        + InventoryBomServiceSql
                                .INVENTORY_BOM_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB,
                receiptRef,
                scope,
                key,
                operation,
                requestHash,
                response,
                createdAt);
    }

    private static TargetRecord targetRecord(ResultSet result, int firstColumn, boolean requireCompleteUnit)
            throws SQLException {
        InventoryOwnerApi.UnitSnapshot consumption = requireCompleteUnit
                ? requiredUnitSnapshot(result, firstColumn + 10)
                : unitSnapshot(result, firstColumn + 10);
        boolean hasUnitConfigurationColumns = result.getMetaData().getColumnCount() >= firstColumn + 22;
        return new TargetRecord(
                result.getObject(firstColumn, UUID.class),
                result.getObject(firstColumn + 1, UUID.class),
                result.getObject(firstColumn + 2, UUID.class),
                result.getString(firstColumn + 3),
                result.getString(firstColumn + 4),
                result.getString(firstColumn + 5),
                result.getBigDecimal(firstColumn + 6),
                result.getString(firstColumn + 7),
                result.getLong(firstColumn + 8),
                result.getLong(firstColumn + 9),
                consumption,
                hasUnitConfigurationColumns ? unitSnapshot(result, firstColumn + 15) : null,
                hasUnitConfigurationColumns ? result.getBigDecimal(firstColumn + 20) : null,
                hasUnitConfigurationColumns ? result.getString(firstColumn + 21) : "ENABLED",
                hasUnitConfigurationColumns ? result.getString(firstColumn + 22) : null,
                result.getMetaData().getColumnCount() >= firstColumn + 23 && result.getBoolean(firstColumn + 23));
    }

    public Map<UUID, ResolvedTargetFact> resolveBomTargets(String scope, String brand, List<UUID> targetRefs) {
        LinkedHashSet<UUID> distinctRefs = new LinkedHashSet<>(targetRefs);
        if (distinctRefs.isEmpty()) return Map.of();
        UUID[] values = distinctRefs.toArray(UUID[]::new);
        String sql = ResolvedBomTargetsSql.RESOLVED_BOM_TARGETS_SELECT_TARGET_REF_DEFINITION_STATUS_COMPONENT_ELIGIBLE
                + ResolvedBomTargetsSql.RESOLVED_BOM_TARGETS_STOCK_TARGET_CONSUMPTION_UNIT_REF
                + ResolvedBomTargetsSql.RESOLVED_BOM_TARGETS_WHERE_DATA_NODE_REF_BRAND_REF_TARGET_REF;
        return jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, ResolvedTargetFact> facts = new LinkedHashMap<>();
                    while (result.next()) {
                        UUID ref = result.getObject(1, UUID.class);
                        ResolvedTargetFact previous = facts.putIfAbsent(
                                ref,
                                new ResolvedTargetFact(
                                        result.getString(2), result.getBoolean(3), result.getObject(4, UUID.class)));
                        if (previous != null)
                            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "目标库存对象引用不唯一");
                    }
                    return facts;
                });
    }

    private static InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(ResultSet result, int firstColumn)
            throws SQLException {
        InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, firstColumn);
        if (snapshot == null) throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "单位快照不完整");
        return snapshot;
    }

    private static InventoryOwnerApi.UnitSnapshot requiredConsumptionUnitSnapshot(ResultSet result)
            throws SQLException {
        InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, 1);
        if (snapshot == null)
            throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "库存对象必须保存有效消耗单位快照");
        return snapshot;
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(ResultSet result, int firstColumn) throws SQLException {
        UUID ref = result.getObject(firstColumn, UUID.class);
        String code = result.getString(firstColumn + 1);
        String name = result.getString(firstColumn + 2);
        String dimension = result.getString(firstColumn + 3);
        if (ref == null || code == null || name == null || dimension == null) return null;
        return new InventoryOwnerApi.UnitSnapshot(ref, code, name, dimension, result.getInt(firstColumn + 4));
    }

    public record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

    public record CatalogTargetDisplay(String itemCode, String itemName, String skuCode, String skuName) {}

    public record CatalogMaterialTargetRow(
            UUID itemRef, UUID targetRef, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    public record CatalogBomRow(
            UUID productSkuRef,
            UUID optionValueRef,
            String skuCode,
            String optionValueCode,
            long version,
            String rows) {}

    public record ResolvedTargetFact(String definitionStatus, boolean componentEligible, UUID consumptionUnitRef) {}

    public record ModeSwitchCounts(long ledgerCount, long activeBomReference) {}

    public record RuleTargetFact(
            UUID ref,
            UUID itemRef,
            UUID productSkuRef,
            long version,
            BigDecimal balance,
            String configuration,
            String definitionStatus,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal countingFactor,
            String measureMode,
            boolean componentEligible) {}

    public record RuleBomFact(
            UUID ref,
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            long version,
            String rows,
            String definitionStatus) {}

    public record CurrentBomRow(long version, String rows) {}

    public record TargetRecord(
            UUID ref,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String measureMode,
            BigDecimal balance,
            String configuration,
            long version,
            long updatedAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot,
            InventoryOwnerApi.UnitSnapshot countingUnitSnapshot,
            BigDecimal countingUnitConversionFactor,
            String definitionStatus,
            String inventoryMode,
            boolean componentEligible) {}

    public record CatalogDefinitionRecords(
            List<TargetRecord> directTargets,
            List<CatalogBomRow> bomOwners,
            Map<UUID, TargetRecord> componentTargets) {}

    public record ConsumptionTargetRecord(
            UUID targetRef,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String itemName,
            String skuName,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot,
            long total) {}

    public record ConsumptionTargetPage(List<ConsumptionTargetRecord> rows, long total) {}

    public record InventorySummaryRecord(
            String factKind,
            UUID itemRef,
            UUID productSkuRef,
            String inventoryMode,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot,
            int bomLineCount) {}

    public record ReceiptRecord(String operation, String requestHash, String response) {}
}
