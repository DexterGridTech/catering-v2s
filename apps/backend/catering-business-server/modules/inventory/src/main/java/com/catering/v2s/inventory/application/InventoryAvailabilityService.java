package com.catering.v2s.inventory.application;

import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Light inventory owner. It never writes catalog or organization schemas. */

/** Concrete Inventory availability owner. */
@Service
public class InventoryAvailabilityService {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final String CATALOG_ITEM_SAVE_REQUIREMENT =
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM";
    private static final String ITEM_BASE_UNIT_ARGS = "商品基础计量单位判断参数不完整";
    private static final String SKU_BASE_UNIT_ARGS = "SKU 基础计量单位判断参数不完整";
    private static final String INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT = "单位快照不完整";
    private static final String SALES_MENU_STATE_UNKNOWN = "库存状态无法转换为销售菜单可用事实";
    private static final String TARGET_SELECT_COLUMNS =
            "target_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,balance,configuration::text,"
                    + "version,updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                    + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                    + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                    + "counting_unit_precision,counting_unit_conversion_factor,definition_status,inventory_mode,"
                    + "component_eligible";
    /** Mapping types consumed by inventory copy; catalog may carry other owner mappings in the same plan. */
    private static final Set<String> INVENTORY_COPY_MAPPING_TYPES = Set.of(
            "CATALOG_ITEM",
            "PRODUCT_SKU",
            "CATALOG_UNIT",
            "CATALOG_ORDER_OPTION_DEFINITION",
            "CATALOG_ORDER_OPTION_DEFINITION_VALUE",
            "STOCK_TARGET");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    public InventoryAvailabilityService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public List<InventoryOwnerApi.InventoryAvailabilityFact> readSalesMenuAvailability(
            String dataNodeRef, String brandRef, Set<InventoryOwnerApi.InventoryTargetRef> targetRefs) {
        requireSalesMenuAvailabilityScope(dataNodeRef, brandRef);
        Set<InventoryOwnerApi.InventoryTargetRef> requestedIdentities = normalizedInventoryTargetRefs(targetRefs);
        Map<TargetIdentity, TargetRow> targets = targetRowsByIdentities(
                dataNodeRef,
                brandRef,
                requestedIdentities.stream()
                        .map(identity -> new TargetIdentity(identity.itemRef(), identity.productSkuRef()))
                        .toList(),
                false);
        return requestedIdentities.stream()
                .map(identity -> salesMenuAvailabilityFact(
                        identity, targets.get(new TargetIdentity(identity.itemRef(), identity.productSkuRef()))))
                .toList();
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(java.sql.ResultSet result) throws java.sql.SQLException {
        UUID ref = result.getObject(1, UUID.class);
        if (ref == null || result.getString(2) == null || result.getString(3) == null || result.getString(4) == null)
            throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "单位快照不完整");
        return new InventoryOwnerApi.UnitSnapshot(
                ref, result.getString(2), result.getString(3), result.getString(4), result.getInt(5));
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(java.sql.ResultSet result, int firstColumn)
            throws java.sql.SQLException {
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

    private InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(JsonNode node, String field) {
        if (node == null || !node.isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an object");
        UUID ref;
        try {
            ref = UUID.fromString(node.path("unitRef").asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + ".unitRef is required", failure);
        }
        String code = node.path("code").asText();
        String name = node.path("name").asText();
        String dimension = node.path("unitDimension").asText();
        if (code.isBlank()
                || name.isBlank()
                || !Set.of("COUNT", "WEIGHT", "VOLUME", "SERVICE_DURATION", "PACKAGE")
                        .contains(dimension)
                || !node.has("precision")
                || !node.path("precision").canConvertToInt()
                || node.path("precision").asInt() < 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is incomplete");
        return new InventoryOwnerApi.UnitSnapshot(
                ref, code, name, dimension, node.path("precision").asInt());
    }

    private InventoryConfiguration configurationReadback(JsonNode configuration) {
        BigDecimal factor = decimalNode(configuration, "conversionFactor");
        InventoryOwnerApi.UnitSnapshot counting = configuration.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(configuration.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        UUID countingRef = configuration.hasNonNull("countingUnitRef")
                ? requiredUuid(configuration, "countingUnitRef")
                : counting == null ? null : counting.unitRef();
        if (countingRef != null && counting == null)
            throw new InventoryOwnerApi.Problem("UNIT_SNAPSHOT_REQUIRED", 422, "盘点单位快照缺失");
        return new InventoryConfiguration(
                configuration.path("allowNegative").asBoolean(false),
                configuration.hasNonNull("lowStockThreshold") ? decimalNode(configuration, "lowStockThreshold") : null,
                countingRef,
                factor.signum() <= 0 ? BigDecimal.ONE : factor,
                counting);
    }

    private Map<TargetIdentity, TargetRow> targetRowsByIdentities(
            String scope, String brand, List<TargetIdentity> identities) {
        return targetRowsByIdentities(scope, brand, identities, true);
    }

    private Map<TargetIdentity, TargetRow> targetRowsByIdentities(
            String scope, String brand, List<TargetIdentity> identities, boolean requireCompleteConsumptionUnit) {
        if (identities.isEmpty()) return Map.of();
        String predicates = String.join(
                " OR ",
                java.util.Collections.nCopies(
                        identities.size(), "(item_ref=? AND product_sku_ref IS NOT DISTINCT FROM ?)"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        for (TargetIdentity identity : identities) {
            args.add(identity.itemRef());
            args.add(identity.productSkuRef());
        }
        String sql = "SELECT "
                + TARGET_SELECT_COLUMNS
                + " FROM inventory.stock_target WHERE data_node_ref=? AND "
                + "brand_ref=? AND definition_status='ENABLED' AND ("
                + predicates + ")";
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
                    statement.setString(1, scope);
                    statement.setString(2, brand);
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
                            throw new InventoryOwnerApi.Problem(
                                    ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("目标库存对象引用不唯一"));
                    }
                    return result;
                });
    }

    private static TargetRow targetRow(java.sql.ResultSet row) throws java.sql.SQLException {
        return targetRow(row, 1, null);
    }

    private static TargetRow targetRowWithConsumptionUnitSnapshot(java.sql.ResultSet row) throws java.sql.SQLException {
        return targetRowWithConsumptionUnitSnapshot(row, 1);
    }

    private static TargetRow targetRowWithConsumptionUnitSnapshot(java.sql.ResultSet row, int firstColumn)
            throws java.sql.SQLException {
        return targetRow(row, firstColumn, requiredUnitSnapshot(row, firstColumn + 10));
    }

    private static TargetRow targetRow(java.sql.ResultSet row, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot)
            throws java.sql.SQLException {
        return targetRow(row, 1, consumptionUnitSnapshot);
    }

    private static TargetRow targetRow(
            java.sql.ResultSet row, int firstColumn, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot)
            throws java.sql.SQLException {
        boolean hasUnitConfigurationColumns = row.getMetaData().getColumnCount() >= firstColumn + 22;
        return new TargetRow(
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
                consumptionUnitSnapshot,
                hasUnitConfigurationColumns ? unitSnapshot(row, firstColumn + 15) : null,
                hasUnitConfigurationColumns ? row.getBigDecimal(firstColumn + 20) : null,
                hasUnitConfigurationColumns ? row.getString(firstColumn + 21) : "ENABLED",
                hasUnitConfigurationColumns ? row.getString(firstColumn + 22) : null,
                row.getMetaData().getColumnCount() >= firstColumn + 23 && row.getBoolean(firstColumn + 23));
    }

    private static InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(java.sql.ResultSet result, int firstColumn)
            throws java.sql.SQLException {
        InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, firstColumn);
        if (snapshot == null)
            throw new InventoryOwnerApi.Problem(
                    "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT);
        return snapshot;
    }

    private JsonNode json(String text) {
        if (text == null || text.isBlank())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is missing");
        try {
            JsonNode parsed = mapper.readTree(text);
            if (parsed == null || parsed.isNull())
                throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is null");
            return parsed;
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception ex) {
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is invalid", ex);
        }
    }

    private InventoryOwnerApi.InventoryAvailabilityFact salesMenuAvailabilityFact(
            InventoryOwnerApi.InventoryTargetRef identity, TargetRow target) {
        if (target == null) return InventoryOwnerApi.InventoryAvailabilityFact.notApplicable(identity);

        JsonNode configuration = json(target.configuration());
        String stockState = state(target.balance(), configuration);
        return switch (stockState) {
            case "OK", "LOW" -> InventoryOwnerApi.InventoryAvailabilityFact.available(identity, target.ref());
            case "OUT" -> InventoryOwnerApi.InventoryAvailabilityFact.autoUnavailable(
                    identity, target.ref(), InventoryOwnerApi.InventoryAvailabilityReason.OUT_OF_STOCK);
            case "NEGATIVE" -> configurationReadback(configuration).allowNegative()
                    ? InventoryOwnerApi.InventoryAvailabilityFact.available(identity, target.ref())
                    : InventoryOwnerApi.InventoryAvailabilityFact.autoUnavailable(
                            identity, target.ref(), InventoryOwnerApi.InventoryAvailabilityReason.NEGATIVE_NOT_ALLOWED);
            case "UNKNOWN" -> InventoryOwnerApi.InventoryAvailabilityFact.unknown(identity, target.ref());
            default -> throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, SALES_MENU_STATE_UNKNOWN);
        };
    }

    private BigDecimal decimalNode(JsonNode node, String key) {
        JsonNode value = node.path(key);
        return value.isNumber()
                ? value.decimalValue()
                : value.isTextual() ? new BigDecimal(value.asText()) : BigDecimal.ZERO;
    }

    private static BigDecimal decimalValue(ObjectNode req, String key) {
        JsonNode v = req.get(key);
        if (v == null || (!v.isNumber() && !v.isTextual()))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal");
        try {
            return new BigDecimal(v.asText());
        } catch (NumberFormatException ex) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal", ex);
        }
    }

    private static UUID requiredUuid(JsonNode node, String key) {
        if (node == null || !node.hasNonNull(key) || !node.path(key).isTextual())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        try {
            return UUID.fromString(node.path(key).asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be a UUID", failure);
        }
    }

    private static void requireSalesMenuAvailabilityScope(String dataNodeRef, String brandRef) {
        // This task API has no caller-supplied data-node type: its owner contract is STORE-only by construction.
        requireStoreDataNodeType("STORE");
        requireScope(dataNodeRef, brandRef);
    }

    private static Set<InventoryOwnerApi.InventoryTargetRef> normalizedInventoryTargetRefs(
            Set<InventoryOwnerApi.InventoryTargetRef> targetRefs) {
        if (targetRefs == null || targetRefs.isEmpty()) return Set.of();
        LinkedHashSet<InventoryOwnerApi.InventoryTargetRef> normalized = new LinkedHashSet<>();
        for (InventoryOwnerApi.InventoryTargetRef identity : targetRefs) {
            if (identity == null)
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "targetRefs must contain itemRef/productSkuRef identities");
            normalized.add(identity);
        }
        return normalized;
    }

    static void requireStoreDataNodeType(String dataNodeType) {
        if (!"STORE".equals(dataNodeType)) {
            throw new InventoryOwnerApi.Problem(
                    ("SCOPE_FORBIDDEN"),
                    (403),
                    /* format-wrap */
                    ("库存余额、流水与库存动作仅支持门店数据节点"));
        }
    }

    private static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    static String state(BigDecimal balance, JsonNode config) {
        if (config.path("unknown").asBoolean(false)) return "UNKNOWN";
        if (balance.signum() < 0) return "NEGATIVE";
        if (balance.signum() == 0) return "OUT";
        JsonNode thresholdNode =
                config.has("lowStockThreshold") ? config.path("lowStockThreshold") : config.path("threshold");
        BigDecimal threshold;
        try {
            threshold = thresholdNode.isNumber()
                    ? thresholdNode.decimalValue()
                    : thresholdNode.isTextual() ? new BigDecimal(thresholdNode.asText()) : BigDecimal.ZERO;
        } catch (NumberFormatException ignored) {
            threshold = BigDecimal.ZERO;
        }
        return threshold.signum() > 0 && balance.compareTo(threshold) < 0 ? "LOW" : "OK";
    }





    private record TargetRow(
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





    private record TargetIdentity(UUID itemRef, UUID productSkuRef) {}
















}
