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
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for Inventory target facts and ledger projections. */
@Repository
public class InventoryTargetPersistence {
    private final JdbcTemplate jdbc;

    public InventoryTargetPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int updateConfiguration(
            String scope,
            String brand,
            UUID targetRef,
            long expectedVersion,
            String configuration,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            long updatedAt) {
        return jdbc.update(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_CONFIGURATION
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_COUNTING_UNIT_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_COUNTING_UNIT_PRECISION_COUNTING_UNIT_CONVERSION_FACTOR_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_BRAND_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_TARGET_REF_VERSION,
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

    public InventoryOwnerApi.UnitSnapshot readConsumptionUnitSnapshot(UUID targetRef) {
        return jdbc
                .query(
                        InventoryTargetServiceSql
                                        .INVENTORY_TARGET_SERVICE_SELECT_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                                + InventoryTargetServiceSql
                                        .INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF,
                        (result, rowNumber) -> requiredUnitSnapshot(result, 1),
                        targetRef)
                .stream()
                .findFirst()
                .orElseThrow(() ->
                        new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "库存对象必须保存有效消耗单位快照"));
    }

    public int insertLedgerEntry(
            UUID entryRef,
            UUID targetRef,
            String operation,
            BigDecimal delta,
            BigDecimal before,
            BigDecimal after,
            String reasonCode,
            String note,
            long occurredAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnit) {
        return jdbc.update(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_INSERT_INTO
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_STOCK_LEDGER_ENTRY_REF_TARGET_REF_OPERATION_ID
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_REASON_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_VALUES
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_VALUE_SEPARATOR,
                entryRef,
                targetRef,
                operation,
                delta,
                before,
                after,
                reasonCode,
                note,
                occurredAt,
                consumptionUnit.unitRef(),
                consumptionUnit.code(),
                consumptionUnit.name(),
                consumptionUnit.unitDimension(),
                consumptionUnit.precision());
    }

    public int updateBalance(UUID targetRef, long expectedVersion, BigDecimal after, long updatedAt) {
        return jdbc.update(
                InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_BALANCE_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_TARGET_REF_VERSION,
                after,
                updatedAt,
                targetRef,
                expectedVersion);
    }

    public ChangePeriodRecord readChangePeriod(UUID targetRef, long since) {
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_DELTA
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_STOCK_LEDGER_DELTA_TARGET_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_OCCURRED_AT_EPOCH_MILLIS,
                statement -> {
                    statement.setObject(1, targetRef);
                    statement.setLong(2, since);
                },
                result -> result.next()
                        ? new ChangePeriodRecord(result.getBigDecimal(1), result.getBigDecimal(2), result.getLong(3))
                        : new ChangePeriodRecord(BigDecimal.ZERO, BigDecimal.ZERO, 0));
    }

    public List<RecentChangeRecord> readRecentChanges(UUID targetRef) {
        return jdbc.query(
                InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_SELECT_STOCK_LEDGER_OPERATION_ID_DELTA_OCCURRED_AT_EPOCH_MILLIS_TARGET_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS,
                statement -> statement.setObject(1, targetRef),
                (result, rowNumber) ->
                        new RecentChangeRecord(result.getString(1), result.getBigDecimal(2), result.getLong(3)));
    }

    public List<CatalogTargetDisplay> readCatalogTargetDisplays(String scope, String brand, Collection<UUID> itemRefs) {
        LinkedHashSet<UUID> orderedRefs = new LinkedHashSet<>(itemRefs);
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_CATALOG_SKU_ITEM_SKU
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_JOIN_CONDITION_SKU_ITEM_REF_ITEM_DATA_NODE_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_ITEM_ITEM_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (result, rowNumber) -> new CatalogTargetDisplay(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getObject(4, UUID.class),
                        result.getString(5),
                        result.getString(6)));
    }

    public List<TargetPageRecord> readTargetPage(
            String scope,
            String brand,
            String keyword,
            String categoryRef,
            boolean includeSubCategories,
            String stockView,
            long offset,
            int pageSize,
            Collection<UUID> catalogItemRefs) {
        String viewPredicate = stockViewPredicate(stockView);
        StringBuilder sql = new StringBuilder(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CTE_CATALOG_CATEGORY_SCOPE_CATEGORY_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_DATA_NODE_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_BRAND_REF_CATEGORY_REF_TEXT_STATUS
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_UNION_CATALOG_CATEGORY_CHILD_CATEGORY_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CATALOG_CATEGORY_SCOPE_PARENT_CHILD_PARENT_CATEGORY_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_BOOLEAN
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_VOIDED
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_BASE_TARGET_REF_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_MEASURE_MODE_BALANCE_CONFIGURATION_TEXT
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_UPDATED_AT_EPOCH_MILLIS
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_NULLIF_CONFIGURATION_LOW_STOCK_THRESHOLD_NUMERIC
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_STOCK_TARGET_CONFIGURATION_UNKNOWN_UNKNOWN_FLAG
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF);
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.add(categoryRef);
        args.add(scope);
        args.add(brand);
        args.add(includeSubCategories);
        args.add(scope);
        args.add(brand);
        if ((keyword != null && !keyword.isBlank()) || (categoryRef != null && !categoryRef.isBlank())) {
            sql.append(
                    InventoryTargetServiceSql
                                    .INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_ITEM_AND_EXISTS_SELECT_1_FROM_CAT
                            + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CATALOG_ITEM_ITEM_REF
                            + InventoryTargetServiceSql
                                    .INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_STATUS
                            + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_VOIDED_ALTERNATE_A);
            args.add(scope);
            args.add(brand);
            if (keyword != null && !keyword.isBlank()) {
                sql.append(InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_ITEM_NAME_CHR_SHORT_NAME
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CATALOG_ITEM_CODE_ILIKE);
                args.add(keyword);
            }
            if (categoryRef != null && !categoryRef.isBlank()) {
                sql.append(InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_CATALOG_CATEGORY_SCOPE_RELATION
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CATEGORY_CATEGORY_REF_RELATION
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_RELATION_ITEM_REF_CATALOG_ITEM);
            }
            sql.append(InventoryTargetServiceSql.CLOSE_PAREN);
        }
        List<UUID> orderedItemRefs = new ArrayList<>(new LinkedHashSet<>(catalogItemRefs));
        if (!orderedItemRefs.isEmpty()) {
            sql.append(InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_ITEM_REF)
                    .append(String.join(
                            InventoryTargetServiceSql.VALUE_SEPARATOR,
                            java.util.Collections.nCopies(
                                    orderedItemRefs.size(), InventoryTargetServiceSql.PARAMETER_PLACEHOLDER)))
                    .append(InventoryTargetServiceSql.CLOSE_PAREN);
            args.addAll(orderedItemRefs);
        }
        sql.append(InventoryTargetServiceSql.CLASSIFIED_AGGREGATE_PREFIX)
                .append(viewPredicate)
                .append(InventoryTargetServiceSql.CLASSIFIED_VIEW_AND_PAGED_PREFIX)
                .append(viewPredicate)
                .append(InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ORDER_BY_ITEM_CODE_SKU_CODE_TARGET_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_P_TARGET_REF_P_ITEM_REF_P_PRODUCT_SKU_REF_P_ITEM_CODE_P_SKU_CODE_UNKNOWN_COUNT_A_VIEW_COUNT_FROM
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_PAGED_AGGREGATE_ITEM_CODE_SKU_CODE
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_TARGET_REF);
        args.add(offset);
        args.add(pageSize + 1);
        return jdbc.query(
                sql.toString(),
                (result, rowNumber) -> new TargetPageRecord(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        result.getString(5),
                        result.getString(6),
                        result.getBigDecimal(7),
                        result.getString(8),
                        result.getLong(9),
                        result.getLong(10),
                        result.getString(11),
                        result.getLong(12),
                        result.getLong(13),
                        result.getLong(14),
                        result.getLong(15),
                        result.getLong(16),
                        result.getLong(17),
                        result.getLong(18)),
                args.toArray());
    }

    public Map<UUID, Long> readTargetCounts(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return Map.of();
        String placeholders = String.join(
                InventoryTargetServiceSql.VALUE_SEPARATOR,
                java.util.Collections.nCopies(orderedRefs.size(), InventoryTargetServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(orderedRefs);
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_STOCK_TARGET_ITEM_REF_DATA_NODE_REF_BRAND_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_ITEM_REF_ALTERNATE_A
                        + placeholders
                        + InventoryTargetServiceSql.TARGET_COUNT_GROUP_SUFFIX,
                args.toArray(),
                result -> {
                    Map<UUID, Long> counts = new LinkedHashMap<>();
                    while (result.next()) counts.put(result.getObject(1, UUID.class), result.getLong(2));
                    return counts;
                });
    }

    public List<CurrentLedgerFactRecord> readCurrentLedgerFacts(UUID targetRef, long now) {
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CTE_SELECTED_TARGET_REF_PERIODS_PERIOD
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_OPEN_PAREN_TODAY_SUMMARY
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ROW_KIND_PERIOD_SORT_ORDER_LEDGER
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_THEN_LEDGER_DELTA
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_INCREASE_LEDGER_DELTA
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ALIAS_KEYWORD
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_DECREASE_LEDGER_ENTRY_REF_ENTRY_COUNT
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECTED_DELTA_BIGINT_OCCURRED_AT
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_STOCK_LEDGER_LEDGER_TARGET_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_LEDGER_OCCURRED_AT_EPOCH_MILLIS_SINCE_PERIOD
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_RECENT_ROW_KIND_TEXT_PERIOD
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_INCREASE_NUMERIC_DECREASE_BIGINT
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ENTRY_COUNT_LEDGER_OPERATION_ID_DELTA
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_SELECTED_LEDGER_TARGET_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ORDER_BY
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_LEDGER_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ROW_KIND_PERIOD_SORT_ORDER_INCREASE
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SUMMARY
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ROW_KIND_PERIOD_SORT_ORDER_INCREASE_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_RECENT_SORT_ORDER,
                statement -> {
                    statement.setObject(1, targetRef);
                    statement.setLong(2, now - periodDurationMillis("TODAY"));
                    statement.setLong(3, now - periodDurationMillis("7D"));
                    statement.setLong(4, now - periodDurationMillis("30D"));
                },
                (result, rowNumber) -> new CurrentLedgerFactRecord(
                        result.getString(1),
                        result.getString(2),
                        result.getLong(3),
                        result.getBigDecimal(4),
                        result.getBigDecimal(5),
                        result.getLong(6),
                        result.getString(7),
                        result.getBigDecimal(8),
                        result.getLong(9)));
    }

    public ChangeSummaryRecord readChangeSummary(UUID targetRef, long since) {
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_DELTA_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_STOCK_LEDGER_DELTA_TARGET_REF_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_OCCURRED_AT_EPOCH_MILLIS_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, targetRef);
                    statement.setLong(2, since);
                },
                result -> result.next()
                        ? new ChangeSummaryRecord(result.getBigDecimal(1), result.getBigDecimal(2), result.getLong(3))
                        : new ChangeSummaryRecord(BigDecimal.ZERO, BigDecimal.ZERO, 0));
    }

    public List<HistoryRecord> readHistory(UUID targetRef, int limit, long offset) {
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ENTRY_REF_OPERATION_ID_DELTA_BALANCE_BEFORE_BALANCE_AFTER_REASON_CODE_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_PRECISION_COUNT_OVER_CONSUMPTION_UNIT_PRECISION_COUNT_OVER
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_LEDGER_TARGET_REF_OPERATION_ID_INCREASE
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF,
                statement -> {
                    statement.setObject(1, targetRef);
                    statement.setInt(2, limit + 1);
                    statement.setLong(3, offset);
                },
                (result, rowNumber) -> new HistoryRecord(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getBigDecimal(3),
                        result.getBigDecimal(4),
                        result.getBigDecimal(5),
                        result.getString(6),
                        result.getLong(7),
                        unitSnapshot(result, 8),
                        result.getLong(13)));
    }

    public List<ReferenceRecord> readReferences(String scope, String brand, String targetRef, int limit, long offset) {
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CTE_EXPANDED
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_SELECT_ITEM_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SOURCE_KIND
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ENTRY_QUANTITY_QUANTITY_PER_UNIT
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_UNIT_REF_CONSUMPTION_UNIT_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_CODE_CONSUMPTION_UNIT_CODE
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_NAME_CONSUMPTION_UNIT_NAME
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ENTRY
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_OPEN_PAREN_ENTRY_CONSUMPTION_UNIT_SNAPSHOT_PRECISION_INTEGER
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ENTRY_TIMING_AS_TIMING_ORD_COUNT_OVER_AS_TOTAL_COUNT_OVER_AS_TOTAL
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_BOM_FROM_INVENTORY_STOCK_BOM_SB
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_LATERAL_JSONB_ARRAY_ELEMENTS_JSONB_TYPEOF_ROWS
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ROWS_ORDINALITY_ENTRY_ORD
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CONDITION_JSONB_PATH_EXISTS_JSONB_TYPEOF_ROWS
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ELSE_ELSE_JSONB_END
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_TARGET_REF_COMPONENT_TARGET_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_JSONB_BUILD_OBJECT_TARGET_REF_TO_JSONB_TEXT
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CONDITION_ENTRY_TARGET_REF_COMPONENT_TARGET_REF
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CLOSE_PAREN
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ITEM_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_TIMING_TOTAL
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_FROM_CLAUSE_EXPANDED_ITEM_CODE_SKU_CODE_ORD,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, targetRef);
                    statement.setString(4, targetRef);
                    statement.setInt(5, limit + 1);
                    statement.setLong(6, offset);
                },
                (result, rowNumber) -> new ReferenceRecord(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getString(6),
                        unitSnapshot(result, 7),
                        result.getString(12),
                        result.getLong(13)));
    }

    public List<LedgerRecord> readLedger(UUID targetRef, int limit, long offset) {
        return jdbc.query(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_ALTERNATE_A
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ENTRY_REF_OPERATION_ID_DELTA_BALANCE_BEFORE_BALANCE_AFTER_REASON_CODE_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_ALTERNATE_A
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_PRECISION_COUNT_OVER_CONSUMPTION_UNIT_PRECISION_COUNT_OVER_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_LEDGER_TARGET_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF_ALTERNATE_A,
                statement -> {
                    statement.setObject(1, targetRef);
                    statement.setInt(2, limit + 1);
                    statement.setLong(3, offset);
                },
                (result, rowNumber) -> new LedgerRecord(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getBigDecimal(3),
                        result.getBigDecimal(4),
                        result.getBigDecimal(5),
                        result.getString(6),
                        result.getLong(7),
                        unitSnapshot(result, 8),
                        result.getLong(13)));
    }

    public int insertAdjustmentLedgerEntry(
            UUID entryRef,
            UUID targetRef,
            String operation,
            BigDecimal delta,
            BigDecimal before,
            BigDecimal after,
            String reasonCode,
            String note,
            long occurredAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnit) {
        return jdbc.update(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_INSERT_INTO_ALTERNATE_A
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_STOCK_LEDGER_ENTRY_REF_TARGET_REF_OPERATION_ID_ALTERNATE_A
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_REASON_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_NOTE_OCCURRED_AT_EPOCH_MILLIS_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONSUMPTION_UNIT_NAME
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_PARAMETER_PLACEHOLDER,
                entryRef,
                targetRef,
                operation,
                delta,
                before,
                after,
                reasonCode,
                note,
                occurredAt,
                consumptionUnit.unitRef(),
                consumptionUnit.code(),
                consumptionUnit.name(),
                consumptionUnit.unitDimension(),
                consumptionUnit.precision());
    }

    public int updateAdjustmentBalance(UUID targetRef, long expectedVersion, BigDecimal after, long updatedAt) {
        return jdbc.update(
                InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_BALANCE_VERSION_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_TARGET_REF_VERSION_ALTERNATE_A,
                after,
                updatedAt,
                targetRef,
                expectedVersion);
    }

    public int updateConfigurationForCommand(
            String scope,
            String brand,
            UUID targetRef,
            long expectedVersion,
            String configuration,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            long updatedAt) {
        return jdbc.update(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_UPDATE_STOCK_TARGET_CONFIGURATION_ALTERNATE_A
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME_COUNTING_UNIT_DIMENSION_COUNTING_UNIT_REF_COUNTING_UNIT_CODE_COUNTING_UNIT_NAME_COUNTING_UNIT_DIMENSION
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_COUNTING_UNIT_PRECISION_COUNTING_UNIT_CONVERSION_FACTOR_VERSION_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND_UPDATED_AT_EPOCH_MILLIS_WHERE_DATA_NODE_REF_AND_ALTERNATE_A
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_BRAND_REF_TARGET_REF_VERSION,
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

    public TargetRecord readTarget(String scope, String brand, UUID targetRef) {
        return jdbc.queryForObject(
                InventoryTargetServiceSql.SELECT_PREFIX
                        + InventoryTargetServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_TARGET_REF
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_A,
                (result, rowNumber) -> targetRecord(result, 1, true),
                scope,
                brand,
                targetRef);
    }

    public Map<UUID, ChangeSnapshotRecord> readChangeSnapshots(Collection<UUID> targetRefs, long nowEpochMillis) {
        if (targetRefs.isEmpty()) return Map.of();
        String values = String.join(
                InventoryTargetServiceSql.VALUE_SEPARATOR,
                java.util.Collections.nCopies(targetRefs.size(), InventoryTargetServiceSql.UUID_VALUE_ROW));
        String sql = InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CTE_SELECTED_TARGET_REF
                + values
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CLOSE_PAREN_BOUNDS_BIGINT_NOW_EPOCH
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_AGGREGATE_TARGET_REF
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_TODAY_CHANGE
                + InventoryTargetServiceSql
                        .INVENTORY_TARGET_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_A
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SEVEN_DAY_CHANGE
                + InventoryTargetServiceSql
                        .INVENTORY_TARGET_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_B
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_THIRTY_DAY_CHANGE
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_BOUNDS_TARGET_REF
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_GROUP_BY_TARGET_REF
                + InventoryTargetServiceSql
                        .INVENTORY_TARGET_SERVICE_LATEST_TARGET_REF_OPERATION_ID_OCCURRED_AT_EPOCH_MILLIS
                + InventoryTargetServiceSql
                        .INVENTORY_TARGET_SERVICE_OPEN_PAREN_TARGET_REF_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_ALTERNATE_A
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_SELECTED_TARGET_REF
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_ALTERNATE_B
                + InventoryTargetServiceSql
                        .INVENTORY_TARGET_SERVICE_S_TARGET_REF_A_TODAY_CHANGE_A_SEVEN_DAY_CHANGE_A_THIRTY_DAY_CHANGE_LATEST_OPERATION_ID_LATEST_OPERATION_ID_LATEST_OCCURRED_AT_EPOCH_MILLIS
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_FROM_CLAUSE_LATEST_TARGET_REF
                + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_LATEST_TARGET_REF;
        List<Object> args = new ArrayList<>(targetRefs);
        args.add(nowEpochMillis);
        return jdbc.query(sql, args.toArray(), result -> {
            Map<UUID, ChangeSnapshotRecord> snapshots = new LinkedHashMap<>();
            while (result.next()) {
                Long lastAt = result.getObject(6) == null ? null : result.getLong(6);
                snapshots.put(
                        result.getObject(1, UUID.class),
                        new ChangeSnapshotRecord(
                                result.getBigDecimal(2) == null ? BigDecimal.ZERO : result.getBigDecimal(2),
                                result.getBigDecimal(3) == null ? BigDecimal.ZERO : result.getBigDecimal(3),
                                result.getBigDecimal(4) == null ? BigDecimal.ZERO : result.getBigDecimal(4),
                                result.getString(5),
                                lastAt));
            }
            return snapshots;
        });
    }

    public List<RecentChangeRecord> readRecentChangesForDetail(UUID targetRef) {
        return jdbc.query(
                InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_SELECT_STOCK_LEDGER_OPERATION_ID_DELTA_OCCURRED_AT_EPOCH_MILLIS_TARGET_REF_ALTERNATE_A
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_ALTERNATE_A,
                statement -> statement.setObject(1, targetRef),
                (result, rowNumber) ->
                        new RecentChangeRecord(result.getString(1), result.getBigDecimal(2), result.getLong(3)));
    }

    public long readGeneration(String scope, String brand) {
        Long value = jdbc.queryForObject(
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_SELECT_STOCK_TARGET_VERSION_DATA_NODE_REF_BRAND_REF,
                Long.class,
                scope,
                brand);
        return value == null ? 0L : value;
    }

    public ReceiptRecord readReceipt(String scope, String key) {
        List<ReceiptRecord> rows = jdbc.query(
                InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                        + InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_CONDITION_IDEMPOTENCY_KEY,
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
                InventoryTargetServiceSql.INVENTORY_TARGET_SERVICE_INSERT_INTO_ALTERNATE_B
                        + InventoryTargetServiceSql
                                .INVENTORY_TARGET_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB,
                receiptRef,
                scope,
                key,
                operation,
                requestHash,
                response,
                createdAt);
    }

    private static String stockViewPredicate(String stockView) {
        return switch (stockView == null || stockView.isBlank() ? "ALL" : stockView) {
            case "ALL" -> InventoryTargetServiceSql.STOCK_VIEW_ALL_PREDICATE;
            case "NEEDS_ATTENTION" -> InventoryTargetServiceSql.STOCK_VIEW_NEEDS_ATTENTION_PREDICATE;
            case "LOW", "OUT", "NEGATIVE", "UNKNOWN" -> InventoryTargetServiceSql.STOCK_VIEW_STATE_PREFIX
                    + stockView
                    + InventoryTargetServiceSql.STOCK_VIEW_STATE_SUFFIX;
            default -> throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "stockView is not supported");
        };
    }

    private static long periodDurationMillis(String period) {
        return switch (period) {
            case "TODAY" -> 86400000L;
            case "7D" -> 7 * 86400000L;
            case "30D" -> 30 * 86400000L;
            default -> throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "period is not supported");
        };
    }

    private static TargetRecord targetRecord(ResultSet row, int firstColumn, boolean requireCompleteUnit)
            throws SQLException {
        InventoryOwnerApi.UnitSnapshot consumption =
                requireCompleteUnit ? requiredUnitSnapshot(row, firstColumn + 10) : unitSnapshot(row, firstColumn + 10);
        boolean hasUnitConfigurationColumns = row.getMetaData().getColumnCount() >= firstColumn + 22;
        return new TargetRecord(
                row.getObject(firstColumn, UUID.class),
                row.getObject(firstColumn + 1, UUID.class),
                row.getObject(firstColumn + 2, UUID.class),
                row.getString(firstColumn + 3),
                row.getString(firstColumn + 4),
                row.getString(firstColumn + 5),
                row.getBigDecimal(firstColumn + 6),
                row.getString(firstColumn + 7),
                row.getLong(firstColumn + 8),
                row.getLong(firstColumn + 9),
                consumption,
                hasUnitConfigurationColumns ? unitSnapshot(row, firstColumn + 15) : null,
                hasUnitConfigurationColumns ? row.getBigDecimal(firstColumn + 20) : null,
                hasUnitConfigurationColumns ? row.getString(firstColumn + 21) : "ENABLED",
                hasUnitConfigurationColumns ? row.getString(firstColumn + 22) : null,
                row.getMetaData().getColumnCount() >= firstColumn + 23 && row.getBoolean(firstColumn + 23));
    }

    private static InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(ResultSet result, int firstColumn)
            throws SQLException {
        InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, firstColumn);
        if (snapshot == null) throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "单位快照不完整");
        return snapshot;
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(ResultSet result, int firstColumn) throws SQLException {
        String refValue = result.getString(firstColumn);
        UUID ref;
        try {
            ref = refValue == null ? null : UUID.fromString(refValue);
        } catch (IllegalArgumentException failure) {
            return null;
        }
        String code = result.getString(firstColumn + 1);
        String name = result.getString(firstColumn + 2);
        String dimension = result.getString(firstColumn + 3);
        if (ref == null || code == null || name == null || dimension == null) return null;
        return new InventoryOwnerApi.UnitSnapshot(ref, code, name, dimension, result.getInt(firstColumn + 4));
    }

    public record ChangePeriodRecord(BigDecimal increase, BigDecimal decrease, long entryCount) {}

    public record RecentChangeRecord(String operationId, BigDecimal delta, long occurredAt) {}

    public record CatalogTargetDisplay(
            UUID itemRef, String itemCode, String itemName, UUID productSkuRef, String skuCode, String skuName) {}

    public record TargetPageRecord(
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
            String stockState,
            long allCount,
            long attentionCount,
            long lowCount,
            long outCount,
            long negativeCount,
            long unknownCount,
            long viewCount) {}

    public record CurrentLedgerFactRecord(
            String rowKind,
            String period,
            long sortOrder,
            BigDecimal increase,
            BigDecimal decrease,
            long entryCount,
            String operationId,
            BigDecimal delta,
            long occurredAt) {}

    public record ChangeSummaryRecord(BigDecimal increase, BigDecimal decrease, long entryCount) {}

    public record HistoryRecord(
            UUID entryRef,
            String operationId,
            BigDecimal delta,
            BigDecimal balanceBefore,
            BigDecimal balanceAfter,
            String reasonCode,
            long occurredAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            long total) {}

    public record ReferenceRecord(
            UUID sourceItemRef,
            String sourceCode,
            String sourceSkuCode,
            String sourceOptionValueCode,
            String sourceKind,
            String quantity,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            String timing,
            long total) {}

    public record LedgerRecord(
            UUID entryRef,
            String operationId,
            BigDecimal delta,
            BigDecimal balanceBefore,
            BigDecimal balanceAfter,
            String reasonCode,
            long occurredAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            long total) {}

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

    public record ChangeSnapshotRecord(
            BigDecimal today, BigDecimal sevenDays, BigDecimal thirtyDays, String lastSource, Long lastAt) {}

    public record ReceiptRecord(String operation, String requestHash, String response) {}
}
