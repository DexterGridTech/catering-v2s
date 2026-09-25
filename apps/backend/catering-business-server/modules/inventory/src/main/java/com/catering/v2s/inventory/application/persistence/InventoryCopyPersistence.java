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
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for Inventory copy facts and materialization. */
@Repository
public class InventoryCopyPersistence {
    private final JdbcTemplate jdbc;

    public InventoryCopyPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public InventoryOwnerApi.UnitSnapshot readConsumptionUnitSnapshot(UUID targetRef) {
        return jdbc
                .query(
                        InventoryCopyServiceSql
                                        .INVENTORY_COPY_SERVICE_SELECT_CONSUMPTION_UNIT_REF_CONSUMPTION_UNIT_CODE_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION_CONSUMPTION_UNIT_NAME_CONSUMPTION_UNIT_DIMENSION_CONSUMPTION_UNIT_PRECISION
                                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_TARGET_REF,
                        (result, rowNumber) -> requiredUnitSnapshot(result, 1),
                        targetRef)
                .stream()
                .findFirst()
                .orElseThrow(() ->
                        new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "库存对象必须保存有效消耗单位快照"));
    }

    public int[] copyCatalogItems(List<TargetWrite> rows) {
        return jdbc.batchUpdate(
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_INSERT_INTO
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_INVENTORY_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_ITEM_CODE_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_ITEM_CODE
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_VALUE_SEPARATOR_SKU_CODE_MEASURE_MODE_INVENTORY_MODE_CONSUMPTION_UNIT_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONSUMPTION_UNIT_NAME
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_COUNTING_UNIT_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_COUNTING_UNIT_PRECISION
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_PARAMETER_PLACEHOLDER_CAST_AS_JSONB_0_1_ON_CONFLIC,
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement statement, int index) throws SQLException {
                        TargetWrite row = rows.get(index);
                        statement.setObject(1, row.targetRef());
                        statement.setString(2, row.dataNodeRef());
                        statement.setString(3, row.brandRef());
                        statement.setObject(4, row.itemRef());
                        statement.setObject(5, row.productSkuRef());
                        statement.setString(6, row.itemCode());
                        statement.setString(7, row.skuCode());
                        statement.setString(8, row.measureMode());
                        statement.setString(9, row.inventoryMode());
                        setUnit(statement, 10, row.consumptionUnit());
                        setUnit(statement, 15, row.countingUnit());
                        statement.setBigDecimal(20, row.conversionFactor());
                        statement.setString(21, row.configuration());
                        statement.setLong(22, row.createdAt());
                        statement.setLong(23, row.updatedAt());
                    }

                    @Override
                    public int getBatchSize() {
                        return rows.size();
                    }
                });
    }

    public int[] copyCatalogSkus(List<BomWrite> rows) {
        return jdbc.batchUpdate(
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_INSERT_INTO_ALTERNATE_A
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_INVENTORY_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ITEM_CODE_SKU_CODE_OPTION_VALUE_CODE_VERSION_ROWS_UPDATED_AT_EPOCH_MILLIS
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_VALUES_VALUES_CAST_AS_JSONB_ON_CONF
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_OPTION_VALUE_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_DEFINITION_STATUS_ENABLED
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SET_DO_UPDATE_SET
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_VERSION_EXCLUDED_VERSION_ROWS_EXCLUDED_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS_ROWS_UPDATED_AT_EPOCH_MILLIS_EXCLUDED_UPDATED_AT_EPOCH_MILLIS,
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement statement, int index) throws SQLException {
                        BomWrite row = rows.get(index);
                        statement.setObject(1, UUID.randomUUID());
                        statement.setString(2, row.dataNodeRef());
                        statement.setString(3, row.brandRef());
                        statement.setObject(4, row.itemRef());
                        statement.setObject(5, row.productSkuRef());
                        statement.setObject(6, row.optionValueRef());
                        statement.setString(7, row.itemCode());
                        statement.setString(8, row.skuCode());
                        statement.setString(9, row.optionValueCode());
                        statement.setLong(10, row.version());
                        statement.setString(11, row.rows());
                        statement.setLong(12, row.updatedAt());
                    }

                    @Override
                    public int getBatchSize() {
                        return rows.size();
                    }
                });
    }

    public List<CatalogTargetDisplay> readCatalogTargetDisplays(String scope, String brand, Collection<UUID> itemRefs) {
        LinkedHashSet<UUID> orderedRefs = new LinkedHashSet<>(itemRefs);
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_FROM_CLAUSE_CATALOG_SKU_ITEM_SKU
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_JOIN_CONDITION_SKU_ITEM_REF_ITEM_DATA_NODE_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONDITION_ITEM_ITEM_REF,
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

    public Map<TargetIdentity, TargetRecord> readTargetRowsByIdentities(
            String scope, String brand, List<TargetIdentity> identities, boolean requireCompleteConsumptionUnit) {
        if (identities.isEmpty()) return Map.of();
        String predicates = String.join(
                InventoryCopyServiceSql.IDENTITY_OR_JOINER,
                java.util.Collections.nCopies(identities.size(), InventoryCopyServiceSql.IDENTITY_PREDICATE));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        for (TargetIdentity identity : identities) {
            args.add(identity.itemRef());
            args.add(identity.productSkuRef());
        }
        String sql = InventoryCopyServiceSql.SELECT_PREFIX
                + InventoryCopyServiceSql.TARGET_SELECT_COLUMNS
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_BRAND_REF_DEFINITION_STATUS_ENABLED
                + predicates
                + InventoryCopyServiceSql.SQL_CLOSE_PAREN;
        return jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.size(); index++) statement.setObject(index + 1, args.get(index));
                },
                result -> {
                    Map<TargetIdentity, TargetRecord> rows = new LinkedHashMap<>();
                    while (result.next()) {
                        TargetRecord row = targetRecord(result, 1, requireCompleteConsumptionUnit);
                        TargetIdentity identity = new TargetIdentity(row.itemRef(), row.productSkuRef());
                        if (rows.putIfAbsent(identity, row) != null)
                            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "目标库存对象引用不唯一");
                    }
                    return rows;
                });
    }

    public List<TargetRecord> readTargetsByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryCopyServiceSql.SELECT_PREFIX
                        + InventoryCopyServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_ALTERNATE_A
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_BRAND_REF_DEFINITION_STATUS_ENABLED_ITEM_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_TARGET_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (result, rowNumber) -> targetRecord(result, 1, true));
    }

    public Map<UUID, TargetRecord> readTargetsByRefs(
            String scope,
            String brand,
            Collection<UUID> targetRefs,
            boolean enabledOnly,
            boolean requireCompleteConsumptionUnit) {
        if (targetRefs.isEmpty()) return Map.of();
        UUID[] values = targetRefs.toArray(UUID[]::new);
        String statusPredicate =
                enabledOnly ? InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED : "";
        return jdbc.query(
                InventoryCopyServiceSql.SELECT_PREFIX
                        + InventoryCopyServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_ALTERNATE_B
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_BRAND_REF
                        + statusPredicate
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONDITION_TARGET_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, TargetRecord> rows = new LinkedHashMap<>();
                    while (result.next()) {
                        TargetRecord row = targetRecord(result, 1, requireCompleteConsumptionUnit);
                        if (rows.putIfAbsent(row.ref(), row) != null)
                            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "目标库存对象引用不唯一");
                    }
                    return rows;
                });
    }

    public List<BomOwnerRecord> readBomOwnersByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SELECT
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ITEM_CODE
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_STOCK_BOM_VERSION_ROWS_TEXT_DATA_NODE_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONDITION_ITEM_REF
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (result, rowNumber) -> new BomOwnerRecord(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        result.getString(5),
                        result.getString(6),
                        result.getLong(7),
                        result.getString(8)));
    }

    public List<TargetConfigurationRecord> readTargetConfigurationsByItemRefs(
            String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_SELECT_STOCK_TARGET_ITEM_REF_TARGET_REF_CONFIGURATION_TEXT
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_BRAND_REF_ITEM_REF_TARGET_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (result, rowNumber) -> new TargetConfigurationRecord(
                        result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3)));
    }

    public List<String> readBomRowsByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SELECT_STOCK_BOM_ROWS_TEXT_DATA_NODE_REF_BRAND_REF
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONDITION_ITEM_REF_ALTERNATE_A
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_ORDER_BY_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF_ALTERNATE_A,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (result, rowNumber) -> result.getString(1));
    }

    public TargetRecord readTarget(String scope, String brand, UUID targetRef) {
        return jdbc.queryForObject(
                InventoryCopyServiceSql.SELECT_PREFIX
                        + InventoryCopyServiceSql.TARGET_SELECT_COLUMNS
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF_BRAND_REF_TARGET_REF
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_CONDITION_DEFINITION_STATUS_ENABLED_ALTERNATE_A,
                (result, rowNumber) -> targetRecord(result, 1, true),
                scope,
                brand,
                targetRef);
    }

    public Map<UUID, ChangeSnapshotRecord> readChangeSnapshots(Collection<UUID> targetRefs, long nowEpochMillis) {
        if (targetRefs.isEmpty()) return Map.of();
        String values = String.join(
                InventoryCopyServiceSql.VALUE_SEPARATOR,
                java.util.Collections.nCopies(targetRefs.size(), InventoryCopyServiceSql.UUID_VALUE_ROW));
        String sql = InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CTE_SELECTED_TARGET_REF
                + values
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CLOSE_PAREN_BOUNDS_BIGINT_NOW_EPOCH
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_AGGREGATE_TARGET_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_TODAY_CHANGE
                + InventoryCopyServiceSql
                        .INVENTORY_COPY_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_A
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SEVEN_DAY_CHANGE
                + InventoryCopyServiceSql
                        .INVENTORY_COPY_SERVICE_DELTA_FILTER_OCCURRED_AT_EPOCH_MILLIS_NOW_EPOCH_ALTERNATE_B
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_THIRTY_DAY_CHANGE
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_FROM_CLAUSE_BOUNDS_TARGET_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_GROUP_BY_TARGET_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_LATEST_TARGET_REF_OPERATION_ID_OCCURRED_AT_EPOCH_MILLIS
                + InventoryCopyServiceSql
                        .INVENTORY_COPY_SERVICE_OPEN_PAREN_TARGET_REF_OCCURRED_AT_EPOCH_MILLIS_ENTRY_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_ROW_NUMBER_WINDOW_FUNCTION
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_FROM_CLAUSE_SELECTED_TARGET_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SELECT_ALTERNATE_A
                + InventoryCopyServiceSql
                        .INVENTORY_COPY_SERVICE_S_TARGET_REF_A_TODAY_CHANGE_A_SEVEN_DAY_CHANGE_A_THIRTY_DAY_CHANGE_LATEST_OPERATION_ID_LATEST_OPERATION_ID_LATEST_OCCURRED_AT_EPOCH_MILLIS
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_FROM_CLAUSE_LATEST_TARGET_REF
                + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_LATEST_TARGET_REF;
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

    public long readGeneration(String scope, String brand) {
        Long value = jdbc.queryForObject(
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_SELECT_STOCK_TARGET_VERSION_DATA_NODE_REF_BRAND_REF,
                Long.class,
                scope,
                brand);
        return value == null ? 0L : value;
    }

    public ReceiptRecord readReceipt(String scope, String key) {
        List<ReceiptRecord> rows = jdbc.query(
                InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                        + InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_CONDITION_IDEMPOTENCY_KEY,
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
                InventoryCopyServiceSql.INVENTORY_COPY_SERVICE_INSERT_INTO_ALTERNATE_B
                        + InventoryCopyServiceSql
                                .INVENTORY_COPY_SERVICE_INVENTORY_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID_REQUEST_HASH_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB,
                receiptRef,
                scope,
                key,
                operation,
                requestHash,
                response,
                createdAt);
    }

    private static void setUnit(
            java.sql.PreparedStatement statement, int firstParameter, InventoryOwnerApi.UnitSnapshot unit)
            throws SQLException {
        if (unit == null) {
            statement.setObject(firstParameter, null);
            statement.setString(firstParameter + 1, null);
            statement.setString(firstParameter + 2, null);
            statement.setString(firstParameter + 3, null);
            statement.setObject(firstParameter + 4, null);
            return;
        }
        statement.setObject(firstParameter, unit.unitRef());
        statement.setString(firstParameter + 1, unit.code());
        statement.setString(firstParameter + 2, unit.name());
        statement.setString(firstParameter + 3, unit.unitDimension());
        statement.setInt(firstParameter + 4, unit.precision());
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

    public record TargetWrite(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String measureMode,
            String inventoryMode,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal conversionFactor,
            String configuration,
            long createdAt,
            long updatedAt) {}

    public record BomWrite(
            String dataNodeRef,
            String brandRef,
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode,
            long version,
            String rows,
            long updatedAt) {}

    public record CatalogTargetDisplay(
            UUID itemRef, String itemCode, String itemName, UUID productSkuRef, String skuCode, String skuName) {}

    public record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

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

    public record BomOwnerRecord(
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode,
            long version,
            String rows) {}

    public record TargetConfigurationRecord(UUID itemRef, UUID targetRef, String configuration) {}

    public record ChangeSnapshotRecord(
            BigDecimal today, BigDecimal sevenDays, BigDecimal thirtyDays, String lastSource, Long lastAt) {}

    public record ReceiptRecord(String operation, String requestHash, String response) {}
}
