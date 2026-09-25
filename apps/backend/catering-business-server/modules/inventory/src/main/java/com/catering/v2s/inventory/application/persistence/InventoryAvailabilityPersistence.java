package com.catering.v2s.inventory.application.persistence;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for the Inventory sales-menu availability read model. */
@Repository
public class InventoryAvailabilityPersistence {
    private final JdbcTemplate jdbc;

    public InventoryAvailabilityPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

    public record TargetRow(
            UUID ref,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String measureMode,
            java.math.BigDecimal balance,
            String configuration,
            long version,
            long updatedAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot,
            InventoryOwnerApi.UnitSnapshot countingUnitSnapshot,
            java.math.BigDecimal countingUnitConversionFactor,
            String definitionStatus,
            String inventoryMode,
            boolean componentEligible) {}

    public Map<TargetIdentity, TargetRow> readTargets(
            String dataNodeRef,
            String brandRef,
            List<TargetIdentity> identities,
            boolean requireCompleteConsumptionUnit) {
        if (identities == null || identities.isEmpty()) return Map.of();
        String predicates = String.join(
                InventoryAvailabilityServiceSql.IDENTITY_OR_JOINER,
                java.util.Collections.nCopies(identities.size(), InventoryAvailabilityServiceSql.IDENTITY_PREDICATE));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        for (TargetIdentity identity : identities) {
            args.add(identity.itemRef());
            args.add(identity.productSkuRef());
        }
        String sql = InventoryAvailabilityServiceSql.SELECT_PREFIX
                + InventoryAvailabilityServiceSql.TARGET_SELECT_COLUMNS
                + InventoryAvailabilityServiceSql.INVENTORY_AVAILABILITY_SERVICE_FROM_CLAUSE_STOCK_TARGET_DATA_NODE_REF
                + InventoryAvailabilityServiceSql.INVENTORY_AVAILABILITY_SERVICE_BRAND_REF_DEFINITION_STATUS_ENABLED
                + predicates
                + InventoryAvailabilityServiceSql.SQL_CLOSE_PAREN;
        if (requireCompleteConsumptionUnit) {
            Map<TargetIdentity, TargetRow> result = new LinkedHashMap<>();
            for (TargetRow row :
                    jdbc.query(sql, (row, number) -> targetRowWithConsumptionUnitSnapshot(row), args.toArray())) {
                result.put(new TargetIdentity(row.itemRef(), row.productSkuRef()), row);
            }
            return result;
        }
        return jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    int parameter = 3;
                    for (TargetIdentity identity : identities) {
                        statement.setObject(parameter++, identity.itemRef());
                        statement.setObject(parameter++, identity.productSkuRef());
                    }
                },
                resultSet -> {
                    Map<TargetIdentity, TargetRow> result = new LinkedHashMap<>();
                    while (resultSet.next()) {
                        TargetRow row = targetRow(resultSet, unitSnapshot(resultSet, 11));
                        TargetIdentity identity = new TargetIdentity(row.itemRef(), row.productSkuRef());
                        if (result.putIfAbsent(identity, row) != null)
                            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "目标库存对象引用不唯一");
                    }
                    return result;
                });
    }

    private static TargetRow targetRowWithConsumptionUnitSnapshot(ResultSet row) throws SQLException {
        return targetRow(row, requiredUnitSnapshot(row, 11));
    }

    private static TargetRow targetRow(ResultSet row, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot)
            throws SQLException {
        boolean hasUnitConfigurationColumns = row.getMetaData().getColumnCount() >= 23;
        return new TargetRow(
                row.getObject(1, UUID.class),
                row.getObject(2, UUID.class),
                row.getObject(3, UUID.class),
                row.getString(4),
                row.getString(5),
                row.getString(6),
                row.getBigDecimal(7),
                row.getString(8),
                row.getLong(9),
                row.getLong(10),
                consumptionUnitSnapshot,
                hasUnitConfigurationColumns ? unitSnapshot(row, 16) : null,
                hasUnitConfigurationColumns ? row.getBigDecimal(21) : null,
                hasUnitConfigurationColumns ? row.getString(22) : "ENABLED",
                hasUnitConfigurationColumns ? row.getString(23) : null,
                row.getMetaData().getColumnCount() >= 24 && row.getBoolean(24));
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
}
