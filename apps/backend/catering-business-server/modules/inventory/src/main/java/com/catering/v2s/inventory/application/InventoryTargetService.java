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

/** Concrete Inventory target owner. */
@Service
public class InventoryTargetService {
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

    public InventoryTargetService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    public JsonNode readTargets(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        return targets(dataNodeRef, brandRef, requestId, request);
    }

    public JsonNode readTarget(
            String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        return current(dataNodeRef, brandRef, requestId, targetRef);
    }

    public JsonNode readTargetChangeSummary(
            String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        target(dataNodeRef, brandRef, targetRef);
        return changeSummaryData(targetRef, period);
    }

    public JsonNode readTargetBusinessHistory(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        target(dataNodeRef, brandRef, targetRef);
        return history(requestId, targetRef, request);
    }

    public JsonNode readTargetConsumptionReferences(
            String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return references(dataNodeRef, brandRef, requestId, targetRef, request);
    }

    public JsonNode readTargetLedger(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        target(dataNodeRef, brandRef, targetRef);
        return ledger(requestId, targetRef, request);
    }

    public JsonNode readTargetDiagnostics(String targetRef, String requestId) {
        return diagnostics(requestId, targetRef);
    }

    @Transactional
    public InventoryMutationReadback countTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CountTargetCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "inventory", null);
        requireStoreDataNodeType(scope.dataNodeType());
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        TargetRow current;

        current = recheckTypedTargetBeforeReceipt(
                dataNodeRef, scope.brandRef(), command.targetRef(), command.expectedVersion());

        InventoryMutationReadback replay = replayTyped(
                dataNodeRef, key, "countOperationsInventoryTarget", receiptRequest, InventoryMutationReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            requireCommandNote(command.note());
            BigDecimal counted = requireCountedQuantity(command.countedQuantity(), command.zeroConfirmation());
            BigDecimal normalized = normalizeQuantity(command.countingUnitRef(), current, counted);
            InventoryMutationReadback result = writeTypedInventoryChange(
                    current,
                    command.expectedVersion(),
                    normalized.subtract(current.balance()),
                    "COUNT",
                    null,
                    command.note());
            saveTypedReceipt(dataNodeRef, key, "countOperationsInventoryTarget", receiptRequest, result);
            return result;
        }
    }

    @Transactional
    public InventoryMutationReadback increaseTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            IncreaseTargetCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "inventory", null);
        requireStoreDataNodeType(scope.dataNodeType());
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        TargetRow current;

        current = recheckTypedTargetBeforeReceipt(
                dataNodeRef, scope.brandRef(), command.targetRef(), command.expectedVersion());

        InventoryMutationReadback replay = replayTyped(
                dataNodeRef, key, "increaseOperationsInventoryTarget", receiptRequest, InventoryMutationReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            requireCommandNote(command.note());
            BigDecimal quantity = requirePositiveQuantity(command.quantity());
            InventoryMutationReadback result = writeTypedInventoryChange(
                    current,
                    command.expectedVersion(),
                    normalizeQuantity(command.countingUnitRef(), current, quantity),
                    "INCREASE",
                    null,
                    command.note());
            saveTypedReceipt(dataNodeRef, key, "increaseOperationsInventoryTarget", receiptRequest, result);
            return result;
        }
    }

    @Transactional
    public InventoryMutationReadback adjustTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            AdjustTargetCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "inventory", null);
        requireStoreDataNodeType(scope.dataNodeType());
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        TargetRow current;

        current = recheckTypedTargetBeforeReceipt(
                dataNodeRef, scope.brandRef(), command.targetRef(), command.expectedVersion());

        InventoryMutationReadback replay = replayTyped(
                dataNodeRef, key, "adjustOperationsInventoryTarget", receiptRequest, InventoryMutationReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            requireCommandNote(command.note());
            if (!Set.of("INCREASE", "DECREASE").contains(command.direction()))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "direction is not supported");
            if (!Set.of("RECOUNT", "RECEIPT", "WASTE", "TRANSFER", "CORRECTION", "OTHER")
                    .contains(command.reasonCode()))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "reasonCode is not supported");
            BigDecimal delta =
                    normalizeQuantity(command.countingUnitRef(), current, requirePositiveQuantity(command.quantity()));
            if ("DECREASE".equals(command.direction())) delta = delta.negate();
            InventoryMutationReadback result = writeTypedInventoryChange(
                    current, command.expectedVersion(), delta, "ADJUST", command.reasonCode(), command.note());
            saveTypedReceipt(dataNodeRef, key, "adjustOperationsInventoryTarget", receiptRequest, result);
            return result;
        }
    }

    @Transactional
    public InventoryTargetCurrentReadback updateTargetConfiguration(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UpdateTargetConfigurationCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "inventory", null);
        requireStoreDataNodeType(scope.dataNodeType());
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        TargetRow current;

        current = recheckTypedTargetBeforeReceipt(
                dataNodeRef, scope.brandRef(), command.targetRef(), command.expectedVersion());

        InventoryTargetCurrentReadback replay = replayTyped(
                dataNodeRef,
                key,
                "updateOperationsInventoryTargetConfiguration",
                receiptRequest,
                InventoryTargetCurrentReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            InventoryOwnerApi.UnitSnapshot consumption = consumptionUnitSnapshot(current.ref());
            InventoryConfiguration configuration =
                    requireConfiguration(command.configuration(), consumption.precision());
            JsonNode configurationNode = mapper.valueToTree(configuration);
            InventoryOwnerApi.UnitSnapshot countingSnapshot = configuration.countingUnitSnapshot();
            int changed = jdbc.update(
                    "UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),"
                            + "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,counting_unit_dimension=?,"
                            + "counting_unit_precision=?,counting_unit_conversion_factor=?,version=version+1,update"
                            + "d_at_epoch_millis=? WHERE data_node_ref=? AND "
                            + "brand_ref=? "
                            + "AND target_ref=? AND version=?",
                    canonical(configurationNode),
                    countingSnapshot == null ? null : countingSnapshot.unitRef(),
                    countingSnapshot == null ? null : countingSnapshot.code(),
                    countingSnapshot == null ? null : countingSnapshot.name(),
                    countingSnapshot == null ? null : countingSnapshot.unitDimension(),
                    countingSnapshot == null ? null : countingSnapshot.precision(),
                    configuration.conversionFactor(),
                    time.currentEpochMillis(),
                    dataNodeRef,
                    scope.brandRef(),
                    command.targetRef(),
                    command.expectedVersion());
            if (changed != 1) {
                throw new InventoryOwnerApi.Problem(("VERSION_CONFLICT"), (409), ("库存对象版本已变化"));
            }
            InventoryTargetCurrentReadback result = currentTyped(dataNodeRef, scope.brandRef(), command.targetRef());
            saveTypedReceipt(dataNodeRef, key, "updateOperationsInventoryTargetConfiguration", receiptRequest, result);
            return result;
        }
    }

    private TargetRow recheckTypedTargetBeforeReceipt(
            String scope, String brand, UUID targetRef, long expectedVersion) {
        if (targetRef == null) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "targetRef is required");
        TargetRow current = target(scope, brand, targetRef.toString());
        if (current.version() != expectedVersion && current.version() != expectedVersion + 1L) {
            throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        }
        return current;
    }

    private BigDecimal requireCountedQuantity(BigDecimal quantity, boolean zeroConfirmation) {
        if (quantity == null || quantity.signum() < 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "quantity must be positive");
        if (quantity.signum() == 0 && !zeroConfirmation)
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "zeroConfirmation is required for a zero count");
        return quantity;
    }

    private BigDecimal requirePositiveQuantity(BigDecimal quantity) {
        if (quantity == null || quantity.signum() <= 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "quantity must be positive");
        return quantity;
    }

    private void requireCommandNote(String note) {
        if (note != null && note.length() > 200)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "note must be at most 200 characters");
    }

    private InventoryConfiguration requireConfiguration(
            InventoryConfiguration configuration, int consumptionPrecision) {
        if (configuration == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration is required");
        BigDecimal factor = configuration.conversionFactor();
        if (factor == null) factor = BigDecimal.ONE;
        if (factor.signum() <= 0)
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "configuration.conversionFactor must be positive");
        if (configuration.countingUnitRef() == null && factor.compareTo(BigDecimal.ONE) != 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "没有盘点单位时换算因子必须为1");
        if (configuration.countingUnitRef() != null
                && (configuration.countingUnitSnapshot() == null
                        || !configuration
                                .countingUnitRef()
                                .equals(configuration.countingUnitSnapshot().unitRef())))
            throw new InventoryOwnerApi.Problem("UNIT_SNAPSHOT_REQUIRED", 422, "盘点单位快照与引用不一致");
        if (configuration.lowStockThreshold() != null
                && configuration.lowStockThreshold().signum() < 0)
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "configuration.lowStockThreshold cannot be negative");
        BigDecimal lowStockThreshold = configuration.lowStockThreshold() == null
                ? null
                : truncateTowardZero(configuration.lowStockThreshold(), consumptionPrecision);
        return new InventoryConfiguration(
                configuration.allowNegative(),
                lowStockThreshold,
                configuration.countingUnitRef(),
                factor,
                configuration.countingUnitSnapshot());
    }

    private BigDecimal normalizeQuantity(UUID countingUnitRef, TargetRow row, BigDecimal input) {
        InventoryOwnerApi.UnitSnapshot consumption = row.consumptionUnitSnapshot();
        if (consumption == null)
            throw new InventoryOwnerApi.Problem(
                    "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT);
        InventoryOwnerApi.CountingUnitConfiguration counting = new InventoryOwnerApi.CountingUnitConfiguration(
                row.countingUnitSnapshot(),
                row.countingUnitConversionFactor() == null ? BigDecimal.ONE : row.countingUnitConversionFactor());
        InventoryOwnerApi.UnitSnapshot source =
                counting.countingUnitSnapshot() == null ? consumption : counting.countingUnitSnapshot();
        BigDecimal sourceQuantity = truncateTowardZero(input, source.precision());
        if (countingUnitRef == null || countingUnitRef.equals(consumption.unitRef()))
            return truncateTowardZero(sourceQuantity, consumption.precision());
        if (counting.countingUnitSnapshot() == null
                || !countingUnitRef.equals(counting.countingUnitSnapshot().unitRef())) {
            throw new InventoryOwnerApi.Problem(
                    ("CONSUMPTION_UNIT_INCOMPATIBLE"),
                    (422),
                    /* format-wrap */
                    ("输入单位不属于库存对象单位集合"));
        }
        if (!consumption.unitDimension().equals(counting.countingUnitSnapshot().unitDimension())) {
            throw new InventoryOwnerApi.Problem(
                    ("CONSUMPTION_UNIT_INCOMPATIBLE"),
                    (422),
                    /* format-wrap */
                    ("盘点单位必须与消耗单位同类别"));
        }
        if (counting.conversionFactor() == null || counting.conversionFactor().signum() <= 0)
            throw new InventoryOwnerApi.Problem(
                    "CONSUMPTION_UNIT_INCOMPATIBLE",
                    422,
                    /* format-wrap */
                    "库存换算因子必须为正数");
        return truncateTowardZero(sourceQuantity.multiply(counting.conversionFactor()), consumption.precision());
    }

    private InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot(UUID targetRef) {
        return jdbc
                .query(
                        "SELECT consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_d"
                                + "imension,consumption_unit_precision "
                                + "FROM inventory.stock_target WHERE target_ref=?",
                        (result, row) -> unitSnapshot(result),
                        targetRef)
                .stream()
                .findFirst()
                .orElseThrow(() -> new InventoryOwnerApi.Problem(
                        "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED",
                        422,
                        /* format-wrap */
                        "库存对象必须保存有效消耗单位快照"));
    }

    private InventoryOwnerApi.CountingUnitConfiguration countingUnitConfiguration(
            UUID targetRef, InventoryOwnerApi.UnitSnapshot consumption) {
        return jdbc
                .query(
                        "SELECT counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,cou"
                                + "nting_unit_precision,counting_unit_conversion_factor "
                                + "FROM inventory.stock_target WHERE target_ref=?",
                        (result, row) -> {
                            InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, 1);
                            return new InventoryOwnerApi.CountingUnitConfiguration(snapshot, result.getBigDecimal(6));
                        },
                        targetRef)
                .stream()
                .findFirst()
                .orElse(new InventoryOwnerApi.CountingUnitConfiguration(consumption, BigDecimal.ONE));
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

    private static BigDecimal truncateTowardZero(BigDecimal value, int precision) {
        return value.setScale(precision, RoundingMode.DOWN);
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

    private InventoryOwnerApi.CountingUnitConfiguration countingUnitConfiguration(
            ObjectNode configuration, InventoryOwnerApi.UnitSnapshot consumptionUnit) {
        if (!configuration.has("allowNegative")
                || !configuration.path("allowNegative").isBoolean())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration.allowNegative must be boolean");
        UUID countingRef = optionalUuid(configuration, "countingUnitRef");
        InventoryOwnerApi.UnitSnapshot counting = countingRef == null
                ? null
                : requiredUnitSnapshot(
                        configuration.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot");
        if (counting != null && !countingRef.equals(counting.unitRef()))
            throw new InventoryOwnerApi.Problem("UNIT_SNAPSHOT_REQUIRED", 422, "盘点单位快照与引用不一致");
        if (counting != null && !consumptionUnit.unitDimension().equals(counting.unitDimension()))
            throw new InventoryOwnerApi.Problem(
                    "CONSUMPTION_UNIT_INCOMPATIBLE",
                    422,
                    /* format-wrap */
                    "盘点单位必须与消耗单位同类别");
        BigDecimal factor = configuration.hasNonNull("conversionFactor")
                ? decimalValue(configuration, "conversionFactor")
                : BigDecimal.ONE;
        if (factor.signum() <= 0)
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "configuration.conversionFactor must be positive");
        if (counting == null && factor.compareTo(BigDecimal.ONE) != 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "没有盘点单位时换算因子必须为1");
        return new InventoryOwnerApi.CountingUnitConfiguration(counting, factor);
    }

    private void writeCountingConfiguration(
            ObjectNode configuration, InventoryOwnerApi.CountingUnitConfiguration counting) {
        if (counting.countingUnitSnapshot() == null) {
            configuration.putNull("countingUnitRef");
            configuration.putNull("countingUnitSnapshot");
            configuration.put("conversionFactor", BigDecimal.ONE);
            return;
        }
        configuration.put(
                "countingUnitRef", counting.countingUnitSnapshot().unitRef().toString());
        configuration.set("countingUnitSnapshot", mapper.valueToTree(counting.countingUnitSnapshot()));
        configuration.put("conversionFactor", counting.conversionFactor());
    }

    private InventoryMutationReadback writeTypedInventoryChange(
            TargetRow row, long expectedVersion, BigDecimal delta, String operation, String reasonCode, String note) {
        JsonNode config = json(row.configuration());
        BigDecimal after = row.balance().add(delta);
        if (after.signum() < 0 && !config.path("allowNegative").asBoolean(false))
            throw new InventoryOwnerApi.Problem("NEGATIVE_STOCK_NOT_ALLOWED", 422, "库存不能为负");
        UUID entryRef = UUID.randomUUID();
        long now = time.currentEpochMillis();
        InventoryOwnerApi.UnitSnapshot unit = consumptionUnitSnapshot(row.ref());
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balance_after,"
                        + "reas"
                        + "on_code,note,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,consump"
                        + "tion_unit_name,consumption_unit_dimension,consumption_unit_precision) VALUES(?,?,?,?,?"
                        + ",?,?,?,?,?,?,?,?,?)",
                entryRef,
                row.ref(),
                operation,
                delta,
                row.balance(),
                after,
                reasonCode,
                note,
                now,
                unit.unitRef(),
                unit.code(),
                unit.name(),
                unit.unitDimension(),
                unit.precision());
        if (jdbc.update(
                        "UPDATE inventory.stock_target SET balance=?,version=version+1,updated_at_epoch_millis=? WHERE "
                                + "target_ref=? AND version=?",
                        after,
                        now,
                        row.ref(),
                        expectedVersion)
                != 1) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        return new InventoryMutationReadback(
                row.ref(), row.balance(), delta, after, entryRef, state(after, config), row.version() + 1);
    }

    private JsonNode typedReceiptRequest(Object command, String dataNodeRef, String brandRef) {
        ObjectNode request = mapper.valueToTree(command);
        request.put("dataNodeRef", dataNodeRef);
        request.put("receiptBrandRef", brandRef);
        return request;
    }

    private <T> T replayTyped(String scope, String key, String operation, JsonNode request, Class<T> readbackType) {
        JsonNode replay = replay(scope, key, operation, request);
        if (replay == null) return null;
        try {
            return mapper.treeToValue(replay, readbackType);
        } catch (Exception failure) {
            {
                throw new InventoryOwnerApi.Problem(
                        ("IDEMPOTENCY_MISMATCH"), (409), ("幂等回执与当前 owner readback 不兼容"), (failure));
            }
        }
    }

    private void saveTypedReceipt(String scope, String key, String operation, JsonNode request, Object readback) {
        saveReceipt(scope, key, operation, request, mapper.valueToTree(readback));
    }

    private InventoryTargetCurrentReadback currentTyped(String scope, String brand, UUID targetRef) {
        TargetRow row = target(scope, brand, targetRef.toString());
        JsonNode configuration = json(row.configuration());
        InventoryConfiguration typedConfiguration = configurationReadback(configuration);
        BigDecimal threshold =
                configuration.hasNonNull("lowStockThreshold") ? decimalNode(configuration, "lowStockThreshold") : null;
        String stockState = state(row.balance(), configuration);
        return new InventoryTargetCurrentReadback(
                targetReadback(row, typedConfiguration),
                row.balance(),
                typedConfiguration,
                row.version(),
                stockState,
                false,
                "UNKNOWN".equals(stockState),
                threshold,
                threshold == null ? null : threshold.subtract(row.balance()),
                new InventoryChangeSummaryReadback(
                        changePeriodReadback(targetRef, "TODAY"),
                        changePeriodReadback(targetRef, "7D"),
                        changePeriodReadback(targetRef, "30D")),
                recentChangeReadbacks(targetRef),
                new InventoryDiagnosticsAvailabilityReadback(false, "permission_required"));
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

    private InventoryTargetReadback targetReadback(TargetRow row, InventoryConfiguration configuration) {
        InventoryOwnerApi.UnitSnapshot consumption = row.consumptionUnitSnapshot();
        return new InventoryTargetReadback(
                row.ref(),
                row.itemRef(),
                row.productSkuRef(),
                "PRODUCT",
                row.itemCode(),
                null,
                row.measureMode(),
                row.skuCode(),
                null,
                consumption,
                configuration.countingUnitSnapshot(),
                unitLabel(configuration.countingUnitSnapshot()) + " -> " + unitLabel(consumption) + " × "
                        + decimal(configuration.conversionFactor()),
                "INTERNAL",
                new InventoryOwnerApi.InventoryConversionFacts(
                        configuration.countingUnitSnapshot(), consumption, configuration.conversionFactor()));
    }

    private InventoryChangePeriodReadback changePeriodReadback(UUID targetRef, String period) {
        long since = periodStart(period);
        return jdbc.query(
                "SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0), COALESCE(SUM(CASE WHEN delta<0 THEN "
                        + "-delta ELSE 0 END),0), COUNT(*) FROM inventory.stock_ledger WHERE target_ref=? AND "
                        + "occurred_at_epoch_millis>=?",
                statement -> {
                    statement.setObject(1, targetRef);
                    statement.setLong(2, since);
                },
                result -> result.next()
                        ? new InventoryChangePeriodReadback(
                                result.getBigDecimal(1),
                                result.getBigDecimal(2),
                                result.getBigDecimal(1).subtract(result.getBigDecimal(2)),
                                result.getLong(3))
                        : new InventoryChangePeriodReadback(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0));
    }

    private List<InventoryRecentChangeReadback> recentChangeReadbacks(UUID targetRef) {
        return jdbc.query(
                "SELECT operation_id,delta,occurred_at_epoch_millis FROM inventory.stock_ledger WHERE target_ref=? "
                        + "ORDER BY occurred_at_epoch_millis DESC LIMIT 20",
                statement -> statement.setObject(1, targetRef),
                (result, rowNumber) -> new InventoryRecentChangeReadback(
                        result.getLong(3), result.getString(1), result.getBigDecimal(2), result.getString(1)));
    }

    private Map<TargetIdentity, CatalogTargetDisplay> catalogTargetDisplays(
            String scope, String brand, Collection<TargetIdentity> identities) {
        Set<UUID> itemRefs = identities.stream()
                .map(TargetIdentity::itemRef)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (itemRefs.isEmpty()) return Map.of();
        Map<TargetIdentity, CatalogTargetDisplay> result = new LinkedHashMap<>();
        UUID[] values = itemRefs.toArray(UUID[]::new);
        jdbc.query(
                "SELECT item.item_ref,item.code,item.name,sku.product_sku_ref,sku.sku_code,sku.sku_name "
                        + "FROM catalog.catalog_item item LEFT JOIN catalog.catalog_sku sku "
                        + "ON sku.item_ref=item.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.item_ref=ANY(?::uuid[])",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        String itemCode = rows.getString(2);
                        String itemName = rows.getString(3);
                        UUID skuRef = rows.getObject(4, UUID.class);
                        requireCatalogBusinessName(itemName, "耗用对象缺少商品名称");
                        // The item display is valid whether or not it has SKU rows.
                        // A LEFT JOIN with existing SKUs has no null-SKU row, so add the
                        // item identity independently before the optional SKU identity.
                        result.putIfAbsent(
                                new TargetIdentity(itemRef, null),
                                new CatalogTargetDisplay(itemCode, itemName, null, null));
                        if (skuRef != null)
                            result.put(
                                    new TargetIdentity(itemRef, skuRef),
                                    new CatalogTargetDisplay(itemCode, itemName, rows.getString(5), rows.getString(6)));
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    private CatalogTargetDisplay requiredCatalogTargetDisplay(
            Map<TargetIdentity, CatalogTargetDisplay> displays, TargetRow target) {
        return requiredCatalogTargetDisplay(displays, new TargetIdentity(target.itemRef(), target.productSkuRef()));
    }

    private CatalogTargetDisplay requiredCatalogTargetDisplay(
            Map<TargetIdentity, CatalogTargetDisplay> displays, TargetIdentity target) {
        CatalogTargetDisplay display = displays.get(target);
        // spotless:off
        if (display == null)
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "耗用对象缺少商品名称");
        // spotless:on
        requireCatalogBusinessName(display.itemName(), "耗用对象缺少商品名称");
        if (target.productSkuRef() != null) {
            requireCatalogBusinessName(display.skuName(), "耗用对象缺少规格名称");
        }
        return display;
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

    private ObjectNode targets(String scope, String brand, String requestId, ObjectNode request) {
        validateTargetPageQuery(request);
        if (request.path("countOnly").asBoolean(false))
            return targetCounts(scope, brand, requestId, uuidArray(request.path("itemRefs"), "itemRefs"));
        String keyword = optional(request, "keyword");
        String categoryRef = optional(request, "categoryRef");
        boolean includeSubCategories = request.path("includeSubCategories").asBoolean(false);
        String stockView = optional(request, "stockView");
        long offset = parseCursor(request, "cursor");
        int pageSize = parsePageSize(request, "pageSize", 20);
        List<UUID> catalogItemRefs = uuidArray(request.path("catalogItemRefs"), "catalogItemRefs");
        if (request.has("catalogItemRefs") && catalogItemRefs.isEmpty())
            return emptyTargetPage(requestId, scope, brand);
        String viewPredicate = stockView == null || stockView.isBlank() || "ALL".equals(stockView)
                ? "TRUE"
                : "NEEDS_ATTENTION".equals(stockView) ? "stock_state <> 'OK'" : "stock_state='" + stockView + "'";
        StringBuilder sql = new StringBuilder("WITH RECURSIVE catalog_category_scope(category_ref) AS ("
                + "SELECT c.category_ref FROM catalog.catalog_category c WHERE c.data_node_ref=? AND "
                + "c.brand_ref=? AND c.category_ref::text=?::text AND c.status <> 'VOIDED' "
                + "UNION ALL SELECT child.category_ref FROM catalog.catalog_category child JOIN "
                + "catalog_category_scope parent ON child.parent_category_ref=parent.category_ref "
                + "WHERE child.data_node_ref=? AND child.brand_ref=? AND ?::boolean = TRUE AND child.status <> "
                + "'VOIDED'), "
                + "base AS (SELECT st.target_ref, st.item_ref, st.product_sku_ref, st.item_code, st.sku_code, "
                + "st.measure_mode, st.balance, st.configuration::text AS configuration, st.version, "
                + "st.updated_at_epoch_millis, "
                + "COALESCE(NULLIF(st.configuration->>'lowStockThreshold','')::numeric,0) AS threshold, "
                + "st.configuration->>'unknown'='true' AS unknown_flag FROM inventory.stock_target st "
                + "WHERE st.data_node_ref=? AND st.brand_ref=?");
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
            sql.append(" AND EXISTS (SELECT 1 FROM catalog.catalog_item catalog_item WHERE "
                    + "catalog_item.item_ref=st.item_ref "
                    + "AND catalog_item.data_node_ref=? AND catalog_item.brand_ref=? AND catalog_item.status "
                    + "<> 'VOIDED'");
            args.add(scope);
            args.add(brand);
            if (keyword != null && !keyword.isBlank()) {
                sql.append(" AND (catalog_item.name || chr(1) || COALESCE(catalog_item.short_name, '') || chr(1) || "
                        + "catalog_item.code) ILIKE '%' || ? || '%'");
                args.add(keyword);
            }
            if (categoryRef != null && !categoryRef.isBlank()) {
                sql.append(
                        " AND EXISTS (SELECT 1 FROM catalog.catalog_item_category relation JOIN catalog_category_scope "
                                + "category ON category.category_ref=relation.category_ref WHERE "
                                + "relation.item_ref=catalog_item.item_ref)");
            }
            sql.append(")");
        }
        if (!catalogItemRefs.isEmpty()) {
            sql.append(" AND st.item_ref IN (")
                    .append(String.join(",", java.util.Collections.nCopies(catalogItemRefs.size(), "?")))
                    .append(")");
            args.addAll(catalogItemRefs);
        }
        sql.append("), classified AS (SELECT target_ref, item_ref, product_sku_ref, item_code, sku_code, "
                        + "measure_mode, balance, configuration, version, updated_at_epoch_millis, threshold, "
                        + "unknown_flag, CASE WHEN unknown_flag THEN 'UNKNOWN' WHEN balance < 0 THEN 'NEGATIVE' "
                        + "WHEN balance = 0 THEN 'OUT' WHEN threshold > 0 AND balance < threshold THEN 'LOW' ELSE "
                        + "'OK' END AS stock_state FROM base), aggregate AS (SELECT COUNT(*) AS all_count, "
                        + "COUNT(*) FILTER (WHERE stock_state <> 'OK') AS attention_count, COUNT(*) FILTER (WHERE "
                        + "stock_state='LOW') AS low_count, COUNT(*) FILTER (WHERE stock_state='OUT') AS "
                        + "out_count, COUNT(*) FILTER (WHERE stock_state='NEGATIVE') AS negative_count, COUNT(*) "
                        + "FILTER (WHERE stock_state='UNKNOWN') AS unknown_count, COUNT(*) FILTER (WHERE ")
                .append(viewPredicate)
                .append(") AS view_count FROM classified), paged AS (SELECT target_ref, item_ref, product_sku_ref, "
                        + "item_code, sku_code, measure_mode, balance, configuration, version, "
                        + "updated_at_epoch_millis, stock_state FROM classified WHERE ")
                .append(viewPredicate)
                .append(" ORDER BY item_code, sku_code NULLS FIRST, target_ref OFFSET ? LIMIT ?) SELECT "
                        + "p.target_ref,p.item_ref,p.product_sku_ref,p.item_code,p.sku_code,p.measure_mode,p.balanc"
                        + "e,p.configuration,p.version,p.updated_at_epoch_millis,p.stock_state,a.all_count,a.attent"
                        + "ion_count,a.low_count,a.out_count,a.negative_count,a.unknown_count,a.view_count FROM "
                        + "aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.item_code,p.sku_code NULLS "
                        + "FIRST,p.target_ref");
        args.add(offset);
        args.add(pageSize + 1);
        List<TargetPageRow> rows = jdbc.query(
                sql.toString(),
                (r, n) -> {
                    UUID ref = r.getObject(1, UUID.class);
                    TargetRow target = ref == null
                            ? null
                            : new TargetRow(
                                    ref,
                                    r.getObject(2, UUID.class),
                                    r.getObject(3, UUID.class),
                                    r.getString(4),
                                    r.getString(5),
                                    r.getString(6),
                                    r.getBigDecimal(7),
                                    r.getString(8),
                                    r.getLong(9),
                                    r.getLong(10),
                                    null,
                                    null,
                                    null,
                                    "ENABLED",
                                    null,
                                    false);
                    return new TargetPageRow(
                            target,
                            r.getString(11),
                            r.getLong(12),
                            r.getLong(13),
                            r.getLong(14),
                            r.getLong(15),
                            r.getLong(16),
                            r.getLong(17),
                            r.getLong(18));
                },
                args.toArray());
        long total = rows.isEmpty() ? 0 : rows.get(0).allCount();
        long viewTotal = rows.isEmpty() ? 0 : rows.get(0).viewCount();
        boolean hasNext = rows.stream().filter(row -> row.target() != null).count() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, Math.min(pageSize, rows.size())));
        java.util.Map<UUID, ChangeSnapshot> snapshots = loadChangeSnapshots(rows.stream()
                .map(TargetPageRow::target)
                .filter(java.util.Objects::nonNull)
                .toList());
        Map<TargetIdentity, CatalogTargetDisplay> targetDisplays = catalogTargetDisplays(
                scope,
                brand,
                rows.stream()
                        .map(TargetPageRow::target)
                        .filter(java.util.Objects::nonNull)
                        .map(target -> new TargetIdentity(target.itemRef(), target.productSkuRef()))
                        .toList());
        ObjectNode data = mapper.createObjectNode();
        ArrayNode items = data.putArray("items");
        for (TargetPageRow row : rows)
            if (row.target() != null)
                items.add(targetListRow(
                        row.target(),
                        requiredCatalogTargetDisplay(targetDisplays, row.target()),
                        row.stockState(),
                        "UNKNOWN".equals(row.stockState()),
                        snapshots.get(row.target().ref())));
        ObjectNode counts = data.putObject("counts")
                .put("ALL", total)
                .put("NEEDS_ATTENTION", rows.isEmpty() ? 0 : rows.get(0).attentionCount())
                .put("LOW", rows.isEmpty() ? 0 : rows.get(0).lowCount())
                .put("OUT", rows.isEmpty() ? 0 : rows.get(0).outCount())
                .put("NEGATIVE", rows.isEmpty() ? 0 : rows.get(0).negativeCount())
                .put("UNKNOWN", rows.isEmpty() ? 0 : rows.get(0).unknownCount());
        data.put("total", viewTotal).put("generation", generation(scope, brand));
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize));
        else data.putNull("cursor");
        return envelope(requestId, data);
    }

    private void requireCatalogBusinessName(String name, String missingMessage) {
        if (name == null || name.isBlank()) throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, missingMessage);
    }

    private ObjectNode targetCounts(String scope, String brand, String requestId, List<UUID> itemRefs) {
        ObjectNode data = mapper.createObjectNode();
        ArrayNode items = data.putArray("items");
        if (itemRefs.isEmpty()) {
            data.put("total", 0).put("generation", generation(scope, brand));
            return envelope(requestId, data);
        }
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        Map<UUID, Long> counts = new LinkedHashMap<>();
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(itemRefs);
        jdbc.query(
                "SELECT item_ref,COUNT(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                        + "AND item_ref IN (" + placeholders + ") GROUP BY item_ref",
                args.toArray(),
                result -> {
                    while (result.next()) counts.put(result.getObject(1, UUID.class), result.getLong(2));
                    return null;
                });
        for (UUID itemRef : itemRefs)
            items.addObject().put("itemRef", itemRef.toString()).put("targetCount", counts.getOrDefault(itemRef, 0L));
        data.put("total", items.size()).put("generation", generation(scope, brand));
        return envelope(requestId, data);
    }

    private ObjectNode emptyTargetPage(String requestId, String scope, String brand) {
        ObjectNode data = mapper.createObjectNode();
        data.putArray("items");
        data.putObject("counts")
                .put("ALL", 0)
                .put("NEEDS_ATTENTION", 0)
                .put("LOW", 0)
                .put("OUT", 0)
                .put("NEGATIVE", 0)
                .put("UNKNOWN", 0);
        data.put("total", 0).put("generation", generation(scope, brand)).putNull("cursor");
        return envelope(requestId, data);
    }

    public static void validateTargetPageQuery(ObjectNode request) {
        if (request == null) return;
        Set<String> allowed = Set.of(
                "dataNodeRef",
                "keyword",
                "categoryRef",
                "includeSubCategories",
                "stockView",
                "cursor",
                "pageSize",
                "catalogItemRefs",
                "countOnly",
                "itemRefs");
        request.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field))
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "unknown inventory page query field: " + field);
        });
        String stockView = optional(request, "stockView");
        if (stockView != null
                && !Set.of("ALL", "NEEDS_ATTENTION", "LOW", "OUT", "NEGATIVE", "UNKNOWN")
                        .contains(stockView))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "stockView is not supported");
        parsePageSize(request, "pageSize", 20);
        parseCursor(request, "cursor");
        uuidArray(request.path("catalogItemRefs"), "catalogItemRefs");
        uuidArray(request.path("itemRefs"), "itemRefs");
    }

    private static int parsePageSize(ObjectNode request, String key, int fallback) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(value.asText());
            if (parsed < 1 || parsed > 100) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException ex) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be between 1 and 100", ex);
        }
    }

    private static long parseCursor(ObjectNode request, String key) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return 0L;
        try {
            long parsed = Long.parseLong(value.asText());
            if (parsed < 0) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException ex) {
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, key + " must be a non-negative opaque cursor", ex);
        }
    }

    private static List<UUID> uuidArray(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return List.of();
        if (!value.isArray()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an array");
        java.util.LinkedHashSet<UUID> result = new java.util.LinkedHashSet<>();
        for (JsonNode entry : value) {
            if (!entry.isTextual())
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must contain UUID values");
            try {
                result.add(UUID.fromString(entry.asText()));
            } catch (IllegalArgumentException failure) {
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, field + " must contain UUID values", failure);
            }
        }
        return List.copyOf(result);
    }

    private ObjectNode current(String scope, String brand, String requestId, String targetRef) {
        TargetRow row = target(scope, brand, targetRef);
        JsonNode configuration = json(row.configuration());
        ObjectNode data = mapper.createObjectNode();
        CatalogTargetDisplay targetDisplay = requiredCatalogTargetDisplay(
                catalogTargetDisplays(scope, brand, List.of(new TargetIdentity(row.itemRef(), row.productSkuRef()))),
                row);
        data.set("target", targetDetail(row, targetDisplay));
        ObjectNode config = data.putObject("configuration")
                .put("allowNegative", configuration.path("allowNegative").asBoolean(false));
        if (configuration.hasNonNull("lowStockThreshold"))
            config.put(
                    "lowStockThreshold",
                    decimal(configuration.path("lowStockThreshold").decimalValue()));
        else config.putNull("lowStockThreshold");
        InventoryOwnerApi.UnitSnapshot counting = configuration.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(configuration.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        setNullableSnapshot(config, "countingUnitSnapshot", counting);
        config.put(
                "conversionFactor",
                decimal(
                        decimalNode(configuration, "conversionFactor").signum() <= 0
                                ? BigDecimal.ONE
                                : decimalNode(configuration, "conversionFactor")));
        data.put("balance", decimal(row.balance())).put("version", row.version());
        String stockState = state(row.balance(), configuration);
        data.put("stockState", stockState).put("stale", false).put("unknown", "UNKNOWN".equals(stockState));
        BigDecimal threshold = decimalNode(configuration, "lowStockThreshold");
        data.put("threshold", decimal(threshold));
        data.put("gap", decimal(threshold.subtract(row.balance())));
        CurrentLedgerFacts ledgerFacts = currentLedgerFacts(targetRef);
        ObjectNode changes = data.putObject("changeSummary");
        changes.set("today", currentLedgerSummary(ledgerFacts.summaries(), "TODAY"));
        changes.set("sevenDays", currentLedgerSummary(ledgerFacts.summaries(), "7D"));
        changes.set("thirtyDays", currentLedgerSummary(ledgerFacts.summaries(), "30D"));
        data.set("recentChanges", ledgerFacts.recentChanges());
        data.putObject("diagnosticsAvailability").put("canRead", false).put("reason", "permission_required");
        return data;
    }

    private CurrentLedgerFacts currentLedgerFacts(String targetRef) {
        Map<String, ObjectNode> summaries = new LinkedHashMap<>();
        ArrayNode recentChanges = mapper.createArrayNode();
        long now = time.currentEpochMillis();
        jdbc.query(
                "WITH selected(target_ref) AS (VALUES (?::uuid)), periods(period,since,sort_order) AS (VALUES"
                        + " ('TODAY',?,1),('7D',?,2),('30D',?,3)), summary AS (SELECT 'SUMMARY' AS"
                        + " row_kind,p.period,p.sort_order,COALESCE(SUM(CASE WHEN ledger.delta>0"
                        + " THEN ledger.delta ELSE 0"
                        + " END),0) AS increase,COALESCE(SUM(CASE WHEN ledger.delta<0 THEN -ledger.delta ELSE 0 END),0)"
                        + " AS"
                        + " decrease,COUNT(ledger.entry_ref) AS entry_count,NULL::text AS operation_id,NULL::numeric AS"
                        + " delta,NULL::bigint AS occurred_at FROM periods p CROSS JOIN selected s LEFT JOIN"
                        + " inventory.stock_ledger ledger ON ledger.target_ref=s.target_ref AND"
                        + " ledger.occurred_at_epoch_millis>=p.since GROUP BY p.period,p.sort_order), recent AS (SELECT"
                        + " 'RECENT' AS row_kind,NULL::text AS period,100 AS sort_order,NULL::numeric AS"
                        + " increase,NULL::numeric AS decrease,NULL::bigint AS"
                        + " entry_count,ledger.operation_id,ledger.delta,ledger.occurred_at_epoch_millis AS occurred_at"
                        + " FROM inventory.stock_ledger ledger JOIN selected s ON s.target_ref=ledger.target_ref"
                        + " ORDER BY"
                        + " ledger.occurred_at_epoch_millis DESC,ledger.entry_ref DESC LIMIT 20) SELECT"
                        + " row_kind,period,sort_order,increase,decrease,entry_count,operation_id,delta,occurred_at"
                        + " FROM"
                        + " summary UNION ALL SELECT"
                        + " row_kind,period,sort_order,increase,decrease,entry_count,operation_id,delta,occurred_at"
                        + " FROM"
                        + " recent ORDER BY sort_order",
                statement -> {
                    statement.setObject(1, UUID.fromString(targetRef));
                    statement.setLong(2, now - periodDurationMillis("TODAY"));
                    statement.setLong(3, now - periodDurationMillis("7D"));
                    statement.setLong(4, now - periodDurationMillis("30D"));
                },
                result -> {
                    while (result.next()) {
                        if ("SUMMARY".equals(result.getString(1))) {
                            String period = result.getString(2);
                            BigDecimal increase = result.getBigDecimal(4);
                            BigDecimal decrease = result.getBigDecimal(5);
                            summaries.put(
                                    period,
                                    mapper.createObjectNode()
                                            .put("increase", decimal(increase))
                                            .put("decrease", decimal(decrease))
                                            .put("netChange", decimal(increase.subtract(decrease)))
                                            .put("entryCount", result.getLong(6)));
                        } else {
                            recentChanges
                                    .addObject()
                                    .put("occurredAt", result.getLong(9))
                                    .put("changeType", result.getString(7))
                                    .put("quantity", decimal(result.getBigDecimal(8)))
                                    .put("source", result.getString(7));
                        }
                    }
                    return null;
                });
        return new CurrentLedgerFacts(Map.copyOf(summaries), recentChanges);
    }

    private ObjectNode currentLedgerSummary(Map<String, ObjectNode> summaries, String period) {
        ObjectNode summary = summaries.get(period);
        if (summary != null) return summary;
        return mapper.createObjectNode()
                .put("increase", "0")
                .put("decrease", "0")
                .put("netChange", "0")
                .put("entryCount", 0);
    }

    private ObjectNode changeSummaryData(String targetRef, String period) {
        long since = periodStart(period);
        ObjectNode data = mapper.createObjectNode()
                .put("period", period == null ? "TODAY" : period)
                .put("increase", "0")
                .put("decrease", "0")
                .put("netChange", "0")
                .put("entryCount", 0);
        jdbc.query(
                "SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0), COALESCE(SUM(CASE WHEN delta<0 THEN "
                        + "-delta ELSE 0 END),0), COUNT(*) FROM inventory.stock_ledger WHERE target_ref=? AND "
                        + "occurred_at_epoch_millis>=?",
                s -> {
                    s.setObject(1, UUID.fromString(targetRef));
                    s.setLong(2, since);
                },
                r -> {
                    if (r.next()) {
                        BigDecimal increase = r.getBigDecimal(1);
                        BigDecimal decrease = r.getBigDecimal(2);
                        data.put("increase", decimal(increase))
                                .put("decrease", decimal(decrease))
                                .put("netChange", decimal(increase.subtract(decrease)))
                                .put("entryCount", r.getLong(3));
                    }
                    return null;
                });
        return data;
    }

    private ObjectNode history(String requestId, String targetRef, ObjectNode request) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        final long[] total = {0L};
        jdbc.query(
                "SELECT "
                        + "entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_mill"
                        + "is,consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dim"
                        + "ension,"
                        + "consumption_unit_precision,C"
                        + "OUNT(*) OVER() "
                        + "FROM inventory.stock_ledger WHERE target_ref=? AND operation_id IN ('COUNT','INCREASE') "
                        + "ORDER BY occurred_at_epoch_millis DESC,entry_ref DESC LIMIT ? OFFSET ?",
                statement -> {
                    statement.setObject(1, UUID.fromString(targetRef));
                    statement.setInt(2, pageSize + 1);
                    statement.setLong(3, offset);
                },
                result -> {
                    while (result.next()) {
                        if (entries.size() <= pageSize) {
                            ObjectNode entry = entries.addObject()
                                    .put(
                                            "entryRef",
                                            result.getObject(1, UUID.class).toString())
                                    .put("action", result.getString(2))
                                    .put("quantity", decimal(result.getBigDecimal(3)))
                                    .put("beforeQuantity", decimal(result.getBigDecimal(4)))
                                    .put("afterQuantity", decimal(result.getBigDecimal(5)))
                                    .put("occurredAt", result.getLong(7))
                                    .put("source", result.getString(2))
                                    .put("reasonCode", result.getString(6) == null ? "" : result.getString(6));
                            setNullableSnapshot(entry, "consumptionUnitSnapshot", unitSnapshot(result, 8));
                        }
                        total[0] = result.getLong(13);
                    }
                    return null;
                });
        boolean hasNext = entries.size() > pageSize;
        if (hasNext) entries.remove(entries.size() - 1);
        data.put("total", total[0]);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize));
        else data.putNull("cursor");
        return data;
    }

    private ObjectNode references(String scope, String brand, String requestId, String targetRef, ObjectNode request) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        final long[] total = {0L};
        // The reference zone is independently pageable; do not materialize the
        // whole BOM graph just to slice one target's page in Java.
        jdbc.query(
                "WITH expanded AS ("
                        + "SELECT sb.item_ref,sb.item_code,sb.sku_code,sb.option_value_code,entry->>'nodeType' AS "
                        + "source_kind,"
                        + "COALESCE(entry->>'quantity',entry->>'quantityPerUnit','0') AS quantity,"
                        + "entry->'consumptionUnitSnapshot'->>'unitRef' AS consumption_unit_ref,"
                        + "entry->'consumptionUnitSnapshot'->>'code' AS consumption_unit_code,"
                        + "entry->'consumptionUnitSnapshot'->>'name' AS consumption_unit_name,"
                        + "entry->'consumptionUnitSnapshot'->>'unitDimension' AS consumption_unit_dimension,"
                        + "(entry->'consumptionUnitSnapshot'->>'precision')::integer AS consumption_unit_precision,"
                        + "entry->>'timing' AS timing,ord,COUNT(*) OV"
                        + "ER() AS total "
                        + "FROM inventory.stock_bom sb "
                        + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(sb.rows)='array' THEN "
                        + "sb.rows ELSE '[]'::jsonb END) WITH ORDINALITY AS e(entry,ord) "
                        + "WHERE sb.data_node_ref=? AND sb.brand_ref=? "
                        + "AND sb.definition_status='ENABLED' "
                        + "AND jsonb_path_exists(CASE WHEN jsonb_typeof(sb.rows)='array' THEN sb.rows "
                        + "ELSE '[]'::jsonb END, "
                        + "'$[*] ? (@.targetRef == $targetRef || @.componentTargetRef == $targetRef)', "
                        + "jsonb_build_object('targetRef',to_jsonb(CAST(? AS text)))) "
                        + "AND COALESCE(entry->>'targetRef',entry->>'componentTargetRef')=?"
                        + ") SELECT "
                        + "item_ref,item_code,sku_code,option_value_code,source_kind,quantity,consumption_unit_ref,"
                        + "consumption_unit_code,consumption_unit_name,consumption_unit_dimension,consumption_unit_"
                        + "precision,"
                        + "timing,total "
                        + "FROM expanded ORDER BY item_code,sku_code NULLS FIRST,ord LIMIT ? OFFSET ?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, targetRef);
                    statement.setString(4, targetRef);
                    statement.setInt(5, pageSize + 1);
                    statement.setLong(6, offset);
                },
                result -> {
                    while (result.next()) {
                        if (entries.size() <= pageSize) {
                            ObjectNode entry = entries.addObject()
                                    .put(
                                            "sourceItemRef",
                                            result.getObject(1, UUID.class).toString())
                                    .put("sourceCode", result.getString(2))
                                    .put("sourceKind", result.getString(5) == null ? "ITEM" : result.getString(5))
                                    .put("quantity", result.getString(6) == null ? "0" : result.getString(6))
                                    .put("timing", result.getString(12) == null ? "BOM" : result.getString(12));
                            setNullableSnapshot(entry, "consumptionUnitSnapshot", unitSnapshot(result, 7));
                            if (result.getString(4) == null) entry.putNull("sourceOptionValueCode");
                            else entry.put("sourceOptionValueCode", result.getString(4));
                            if (result.getString(3) == null) entry.putNull("sourceSkuCode");
                            else entry.put("sourceSkuCode", result.getString(3));
                        }
                        total[0] = result.getLong(13);
                    }
                    return null;
                });
        boolean hasNext = entries.size() > pageSize;
        if (hasNext) entries.remove(entries.size() - 1);
        data.put("total", total[0]);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize));
        else data.putNull("cursor");
        return data;
    }

    private ObjectNode ledger(String requestId, String targetRef, ObjectNode request) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        final long[] total = {0L};
        jdbc.query(
                "SELECT "
                        + "entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_mill"
                        + "is,consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dim"
                        + "ension,"
                        + "consumption_unit_precision,C"
                        + "OUNT(*) OVER() "
                        + "FROM inventory.stock_ledger WHERE target_ref=? "
                        + "ORDER BY occurred_at_epoch_millis DESC,entry_ref DESC LIMIT ? OFFSET ?",
                statement -> {
                    statement.setObject(1, UUID.fromString(targetRef));
                    statement.setInt(2, pageSize + 1);
                    statement.setLong(3, offset);
                },
                result -> {
                    while (result.next()) {
                        if (entries.size() <= pageSize) {
                            ObjectNode entry = entries.addObject()
                                    .put(
                                            "entryRef",
                                            result.getObject(1, UUID.class).toString())
                                    .put("source", result.getString(2))
                                    .put("reasonCode", result.getString(6) == null ? "" : result.getString(6))
                                    .put("beforeQuantity", decimal(result.getBigDecimal(4)))
                                    .put("changeQuantity", decimal(result.getBigDecimal(3)))
                                    .put("afterQuantity", decimal(result.getBigDecimal(5)))
                                    .put("occurredAt", result.getLong(7));
                            setNullableSnapshot(entry, "consumptionUnitSnapshot", unitSnapshot(result, 8));
                        }
                        total[0] = result.getLong(13);
                    }
                    return null;
                });
        boolean hasNext = entries.size() > pageSize;
        if (hasNext) entries.remove(entries.size() - 1);
        data.put("total", total[0]);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize));
        else data.putNull("cursor");
        return data;
    }

    private ObjectNode diagnostics(String requestId, String targetRef) {
        ObjectNode data = mapper.createObjectNode();
        ObjectNode permission = data.putObject("permission");
        permission.put("granted", true).putNull("reason");
        data.putArray("queries");
        data.putArray("timings");
        data.putArray("warnings");
        return data;
    }

    private ObjectNode adjust(String scope, String brand, String requestId, ObjectNode request, String operation) {
        String targetRef = required(request, "targetRef");
        long expected = requiredLong(request, "expectedVersion");
        TargetRow row = target(scope, brand, targetRef);
        if (row.version() != expected) {
            throw new InventoryOwnerApi.Problem(("VERSION_CONFLICT"), (409), ("库存对象版本已变化"));
        }
        rejectUnsupportedActionFields(request, operation);
        BigDecimal input = "COUNT".equals(operation)
                ? decimalValue(request, "countedQuantity")
                : decimalValue(request, "quantity");
        if (input.signum() < 0 || (!"COUNT".equals(operation) && input.signum() <= 0))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "quantity must be positive");
        if ("COUNT".equals(operation)
                && input.signum() == 0
                && !request.path("zeroConfirmation").asBoolean(false))
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "zeroConfirmation is required for a zero count");
        BigDecimal normalized = normalizeQuantity(request, row, input);
        BigDecimal delta = "COUNT".equals(operation) ? normalized.subtract(row.balance()) : normalized;
        if ("ADJUST".equals(operation) && "DECREASE".equals(optional(request, "direction"))) delta = delta.negate();
        BigDecimal after = row.balance().add(delta);
        JsonNode config = json(row.configuration());
        if (after.signum() < 0 && !config.path("allowNegative").asBoolean(false))
            throw new InventoryOwnerApi.Problem("NEGATIVE_STOCK_NOT_ALLOWED", 422, "库存不能为负");
        UUID entryRef = UUID.randomUUID();
        long now = time.currentEpochMillis();
        InventoryOwnerApi.UnitSnapshot consumption = consumptionUnitSnapshot(row.ref());
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balance_after,"
                        + "reas"
                        + "on_code,note,occurred_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                        + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision) VALUES(?,?,"
                        + "?,?,?,?,?,?,?,?,?,?,?,?)",
                entryRef,
                row.ref(),
                operation,
                delta,
                row.balance(),
                after,
                optional(request, "reasonCode"),
                optional(request, "note"),
                now,
                consumption.unitRef(),
                consumption.code(),
                consumption.name(),
                consumption.unitDimension(),
                consumption.precision());
        if (jdbc.update(
                        "UPDATE inventory.stock_target SET balance=?,version=version+1,updated_at_epoch_millis=? WHERE "
                                + "target_ref=? AND version=?",
                        after,
                        now,
                        row.ref(),
                        expected)
                != 1) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        ObjectNode result = mapper.createObjectNode()
                .put("targetRef", row.ref().toString())
                .put("before", decimal(row.balance()))
                .put("change", decimal(delta))
                .put("after", decimal(after))
                .put("ledgerEntryRef", entryRef.toString())
                .put("stockState", state(after, config))
                .put("version", expected + 1);
        return command(requestId, result, expected + 1);
    }

    private ObjectNode updateConfiguration(String scope, String brand, String requestId, ObjectNode request) {
        String targetRef = required(request, "targetRef");
        long expected = requiredLong(request, "expectedVersion");
        JsonNode config = request.get("configuration");
        if (config == null || !config.isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration 必须为对象");
        TargetRow row = target(scope, brand, targetRef);
        ObjectNode normalized = normalizeConfiguration((ObjectNode) config, row);
        if (jdbc.update(
                        "UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),"
                                + "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,counting_unit_dime"
                                + "nsion=?,"
                                + "counting_unit_precision=?,counting_unit_conversion_factor=?,version=version+1,up"
                                + "dated_at_epoch_millis=? WHERE data_node_ref=? AND "
                                + "brand_ref=? AND target_ref=? AND version=?",
                        canonical(normalized),
                        normalized.hasNonNull("countingUnitSnapshot")
                                ? requiredUnitSnapshot(normalized.path("countingUnitSnapshot"), "countingUnitSnapshot")
                                        .unitRef()
                                : null,
                        normalized.hasNonNull("countingUnitSnapshot")
                                ? requiredUnitSnapshot(normalized.path("countingUnitSnapshot"), "countingUnitSnapshot")
                                        .code()
                                : null,
                        normalized.hasNonNull("countingUnitSnapshot")
                                ? requiredUnitSnapshot(normalized.path("countingUnitSnapshot"), "countingUnitSnapshot")
                                        .name()
                                : null,
                        normalized.hasNonNull("countingUnitSnapshot")
                                ? requiredUnitSnapshot(normalized.path("countingUnitSnapshot"), "countingUnitSnapshot")
                                        .unitDimension()
                                : null,
                        normalized.hasNonNull("countingUnitSnapshot")
                                ? requiredUnitSnapshot(normalized.path("countingUnitSnapshot"), "countingUnitSnapshot")
                                        .precision()
                                : null,
                        decimalNode(normalized, "conversionFactor"),
                        time.currentEpochMillis(),
                        scope,
                        brand,
                        UUID.fromString(targetRef),
                        expected)
                != 1) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        return current(scope, brand, requestId, targetRef);
    }

    private void rejectUnsupportedActionFields(ObjectNode request, String operation) {
        Set<String> allowed =
                switch (operation) {
                    case "COUNT" -> Set.of(
                            "dataNodeRef",
                            "targetRef",
                            "expectedVersion",
                            "countedQuantity",
                            "countingUnitRef",
                            "note",
                            "zeroConfirmation");
                    case "INCREASE" -> Set.of(
                            "dataNodeRef", "targetRef", "expectedVersion", "quantity", "countingUnitRef", "note");
                    case "ADJUST" -> Set.of(
                            "dataNodeRef",
                            "targetRef",
                            "expectedVersion",
                            "direction",
                            "quantity",
                            "countingUnitRef",
                            "reasonCode",
                            "note");
                    default -> Set.of();
                };
        request.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field))
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "unknown inventory action field: " + field);
        });
        String note = optional(request, "note");
        if (note != null && note.length() > 200)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "note must be at most 200 characters");
        if (request.has("remark"))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "remark is not supported; use note");
        if ("ADJUST".equals(operation)) {
            String direction = required(request, "direction");
            if (!Set.of("INCREASE", "DECREASE").contains(direction))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "direction is not supported");
            String reason = required(request, "reasonCode");
            if (!Set.of("RECOUNT", "RECEIPT", "WASTE", "TRANSFER", "CORRECTION", "OTHER")
                    .contains(reason))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "reasonCode is not supported");
        }
    }

    private BigDecimal normalizeQuantity(ObjectNode request, TargetRow row, BigDecimal input) {
        return normalizeQuantity(optionalUuid(request, "countingUnitRef"), row, input);
    }

    private ObjectNode normalizeConfiguration(ObjectNode config, TargetRow row) {
        Set<String> allowed = Set.of(
                "mode",
                "allowNegative",
                "lowStockThreshold",
                "countingUnitRef",
                "countingUnitSnapshot",
                "conversionFactor");
        config.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field))
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "unknown inventory configuration field: " + field);
        });
        if (!config.has("allowNegative") || !config.path("allowNegative").isBoolean())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration.allowNegative must be boolean");
        if (config.hasNonNull("lowStockThreshold")) {
            BigDecimal threshold = decimalValue(config, "lowStockThreshold");
            if (threshold.signum() < 0)
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "configuration.lowStockThreshold cannot be negative");
        }
        ObjectNode normalized = (ObjectNode) config.deepCopy();
        InventoryOwnerApi.CountingUnitConfiguration counting =
                countingUnitConfiguration(normalized, consumptionUnitSnapshot(row.ref()));
        writeCountingConfiguration(normalized, counting);
        return normalized;
    }

    private void recheckWriteFactsBeforeReceipt(String operationId, String scope, String brand, ObjectNode request) {
        if (!Set.of(
                        "countOperationsInventoryTarget",
                        "increaseOperationsInventoryTarget",
                        "adjustOperationsInventoryTarget",
                        "updateOperationsInventoryTargetConfiguration")
                .contains(operationId)) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory write operation is not registered");
        }
        TargetRow current = target(scope, brand, required(request, "targetRef"));
        long expected = requiredLong(request, "expectedVersion");
        if (current.version() != expected && current.version() != expected + 1L) {
            throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        }
    }

    private TargetRow target(String scope, String brand, String ref) {
        try {
            UUID id = UUID.fromString(ref);
            return jdbc.queryForObject(
                    "SELECT "
                            + TARGET_SELECT_COLUMNS
                            + " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref=? "
                            + "AND definition_status='ENABLED'",
                    (r, n) -> targetRowWithConsumptionUnitSnapshot(r),
                    scope,
                    brand,
                    id);
        } catch (EmptyResultDataAccessException | IllegalArgumentException ex) {
            throw new InventoryOwnerApi.Problem("NOT_FOUND", 404, "库存对象不存在", ex);
        }
    }

    private java.util.Map<UUID, ChangeSnapshot> loadChangeSnapshots(List<TargetRow> targets) {
        if (targets == null || targets.isEmpty()) return java.util.Map.of();
        String values = String.join(",", java.util.Collections.nCopies(targets.size(), "(?::uuid)"));
        String sql = "WITH selected(target_ref) AS (VALUES " + values + "), bounds AS (SELECT ?::bigint AS now_epoch), "
                + "aggregate AS (SELECT l.target_ref, "
                + "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 86400000),0) AS "
                + "today_change, "
                + "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 604800000),0) AS "
                + "seven_day_change, "
                + "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 2592000000),0) AS "
                + "thirty_day_change "
                + "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref CROSS JOIN bounds b "
                + "GROUP BY l.target_ref), "
                + "latest AS (SELECT l.target_ref,l.operation_id,l.occurred_at_epoch_millis,ROW_NUMBER() OVER "
                + "(PARTITION BY l.target_ref ORDER BY l.occurred_at_epoch_millis DESC,l.entry_ref DESC) AS "
                + "row_number "
                + "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref) "
                + "SELECT "
                + "s.target_ref,a.today_change,a.seven_day_change,a.thirty_day_change,latest.operation_id,latest.oc"
                + "curred_at_epoch_millis "
                + "FROM selected s LEFT JOIN aggregate a ON a.target_ref=s.target_ref LEFT JOIN latest ON "
                + "latest.target_ref=s.target_ref AND latest.row_number=1";
        List<Object> args = new ArrayList<>();
        for (TargetRow target : targets) args.add(target.ref());
        args.add(time.currentEpochMillis());
        java.util.Map<UUID, ChangeSnapshot> snapshots = new java.util.HashMap<>();
        jdbc.query(sql, args.toArray(), result -> {
            while (result.next()) {
                UUID ref = result.getObject(1, UUID.class);
                Long lastAt = result.getObject(6) == null ? null : result.getLong(6);
                snapshots.put(
                        ref,
                        new ChangeSnapshot(
                                result.getBigDecimal(2) == null ? BigDecimal.ZERO : result.getBigDecimal(2),
                                result.getBigDecimal(3) == null ? BigDecimal.ZERO : result.getBigDecimal(3),
                                result.getBigDecimal(4) == null ? BigDecimal.ZERO : result.getBigDecimal(4),
                                result.getString(5),
                                lastAt));
            }
            return null;
        });
        return snapshots;
    }

    private ObjectNode targetListRow(
            TargetRow row,
            CatalogTargetDisplay display,
            String queriedState,
            boolean queriedUnknown,
            ChangeSnapshot snapshot) {
        JsonNode config = json(row.configuration());
        BigDecimal threshold = decimalNode(config, "lowStockThreshold");
        String stockState = queriedState == null ? state(row.balance(), config) : queriedState;
        BigDecimal factor = decimalNode(config, "conversionFactor");
        if (factor.signum() <= 0) factor = BigDecimal.ONE;
        InventoryOwnerApi.UnitSnapshot consumption = consumptionUnitSnapshot(row.ref());
        InventoryOwnerApi.UnitSnapshot counting = config.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(config.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        BigDecimal today = snapshot == null ? BigDecimal.ZERO : snapshot.today();
        BigDecimal seven = snapshot == null ? BigDecimal.ZERO : snapshot.sevenDays();
        BigDecimal thirty = snapshot == null ? BigDecimal.ZERO : snapshot.thirtyDays();
        ObjectNode result = mapper.createObjectNode()
                .put("targetRef", row.ref().toString())
                .put("itemRef", row.itemRef().toString())
                .put("targetType", inventoryTargetType(row.productSkuRef()))
                .put("productCode", display.itemCode())
                .put("productName", display.itemName())
                .putNull("productSkuRef")
                .putNull("skuCode")
                .putNull("skuName")
                .putNull("categoryName")
                .putNull("materialRole")
                .put(
                        "conversionSummary",
                        unitLabel(counting) + " -> " + unitLabel(consumption) + " × " + decimal(factor))
                .put("balance", decimal(row.balance()))
                .put("stockState", stockState)
                .put("stale", false)
                .put("unknown", queriedUnknown || "UNKNOWN".equals(stockState))
                .put("threshold", decimal(threshold))
                .put("gap", decimal(threshold.subtract(row.balance())))
                .put("changeToday", decimal(today))
                .put("change7d", decimal(seven))
                .put("change30d", decimal(thirty))
                .put("authorityType", "INTERNAL");
        setNullableSnapshot(result, "consumptionUnitSnapshot", consumption);
        setNullableSnapshot(result, "countingUnitSnapshot", counting);
        setConversionFacts(result, counting, consumption, factor);
        if (snapshot == null || snapshot.lastSource() == null) result.putNull("lastChangeSource");
        else result.put("lastChangeSource", snapshot.lastSource());
        if (snapshot == null || snapshot.lastAt() == null) result.putNull("lastChangeAt");
        else result.put("lastChangeAt", snapshot.lastAt());
        if (row.productSkuRef() != null)
            result.put("productSkuRef", row.productSkuRef().toString());
        if (row.productSkuRef() != null)
            result.put("skuCode", display.skuCode()).put("skuName", display.skuName());
        return result;
    }

    private ObjectNode targetDetail(TargetRow row, CatalogTargetDisplay display) {
        JsonNode config = json(row.configuration());
        BigDecimal factor = decimalNode(config, "conversionFactor");
        if (factor.signum() <= 0) factor = BigDecimal.ONE;
        InventoryOwnerApi.UnitSnapshot consumption = row.consumptionUnitSnapshot();
        InventoryOwnerApi.UnitSnapshot counting = config.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(config.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        ObjectNode result = mapper.createObjectNode()
                .put("targetRef", row.ref().toString())
                .put("itemRef", row.itemRef().toString())
                .put("targetType", inventoryTargetType(row.productSkuRef()))
                .put("productCode", display.itemCode())
                .put("productName", display.itemName())
                .put("productShape", row.measureMode());
        if (row.productSkuRef() == null) result.putNull("productSkuRef");
        else result.put("productSkuRef", row.productSkuRef().toString());
        if (row.productSkuRef() == null) result.putNull("skuCode").putNull("skuName");
        else result.put("skuCode", display.skuCode()).put("skuName", display.skuName());
        result.put(
                        "conversionSummary",
                        unitLabel(counting) + " -> " + unitLabel(consumption) + " × " +
                                /* format-wrap */
                                decimal(factor))
                .put("authorityType", "INTERNAL");
        setNullableSnapshot(result, "consumptionUnitSnapshot", consumption);
        setNullableSnapshot(result, "countingUnitSnapshot", counting);
        setConversionFacts(result, counting, consumption, factor);
        return result;
    }

    private void setConversionFacts(
            ObjectNode target,
            InventoryOwnerApi.UnitSnapshot counting,
            InventoryOwnerApi.UnitSnapshot consumption,
            BigDecimal factor) {
        ObjectNode facts = target.putObject("conversionFacts");
        if (counting == null) facts.putNull("countingUnitSnapshot");
        else facts.set("countingUnitSnapshot", mapper.valueToTree(counting));
        facts.set("consumptionUnitSnapshot", mapper.valueToTree(consumption));
        facts.put("conversionFactor", decimal(factor));
    }

    private ArrayNode recentChanges(String targetRef) {
        ArrayNode entries = mapper.createArrayNode();
        jdbc.query(
                "SELECT operation_id,delta,occurred_at_epoch_millis FROM inventory.stock_ledger WHERE target_ref=? "
                        + "ORDER BY occurred_at_epoch_millis DESC LIMIT 20",
                s -> s.setObject(1, UUID.fromString(targetRef)),
                r -> {
                    while (r.next())
                        entries.addObject()
                                .put("occurredAt", r.getLong(3))
                                .put("changeType", r.getString(1))
                                .put("quantity", decimal(r.getBigDecimal(2)))
                                .put("source", r.getString(1));
                    return null;
                });
        return entries;
    }

    private long generation(String scope, String brand) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                scope,
                brand);
        return value == null ? 0 : value;
    }

    private JsonNode receiptRequest(JsonNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String scope, String key, String operation, JsonNode request) {
        AdvisoryLock.acquire(jdbc, "inventory-receipt", scope, key);
        List<Receipt> rows = jdbc.query(
                "SELECT operation_id,request_hash,response::text FROM inventory.command_receipt WHERE data_node_ref=? "
                        + "AND idempotency_key=?",
                (r, n) -> new Receipt(r.getString(1), r.getString(2), json(r.getString(3))),
                scope,
                key);
        if (rows.isEmpty()) return null;
        Receipt row = rows.get(0);
        if (!row.operation().equals(operation) || !row.requestHash().equals(hash(request)))
            throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return row.response();
    }

    private void saveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_has"
                        + "h,re"
                        + "sponse,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                scope,
                key,
                operation,
                hash(request),
                canonical(response),
                time.currentEpochMillis());
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private ObjectNode command(String requestId, JsonNode result, long version) {
        ObjectNode node = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId);
        node.set("result", result);
        node.put("version", version);
        return node;
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

    private String canonical(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", ex);
        }
    }

    private String hash(JsonNode value) {
        try {
            return Sha256Hex.digest(canonical(value));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
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

    private static UUID optionalUuid(ObjectNode request, String key) {
        if (request == null || !request.hasNonNull(key)) return null;
        if (!request.path(key).isTextual() || request.path(key).asText().isBlank())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be a UUID or null");
        try {
            return UUID.fromString(request.path(key).asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be a UUID", failure);
        }
    }

    private static String unitLabel(InventoryOwnerApi.UnitSnapshot unit) {
        return unit == null ? "库存消耗单位" : unit.name();
    }

    private void setNullableSnapshot(ObjectNode target, String field, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) target.putNull(field);
        else target.set(field, mapper.valueToTree(snapshot));
    }

    static String required(ObjectNode req, String key) {
        String value = optional(req, key);
        if (value == null || value.isBlank())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

    static UUID requiredOpaqueRef(ObjectNode request, String key) {
        String value = required(request, key);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", exception);
        }
    }

    static String optional(ObjectNode req, String key) {
        JsonNode v = req == null ? null : req.get(key);
        return v == null || v.isNull() ? null : v.asText();
    }

    static String normalizeLineSign(String value) {
        return switch (value) {
            case "COMPONENT", "ADD", "POSITIVE" -> "POSITIVE";
            case "REMOVE", "SUBTRACT", "NEGATIVE" -> "NEGATIVE";
            default -> value;
        };
    }

    private static long requiredLong(ObjectNode req, String key) {
        JsonNode v = req == null ? null : req.get(key);
        if (v == null || !v.isIntegralNumber())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return v.asLong();
    }

    static String requireIdempotencyKey(String key) {
        if (key == null || key.isBlank())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        return key.trim();
    }

    static long periodDurationMillis(String period) {
        return switch (period == null ? "TODAY" : period) {
            case "TODAY" -> 86400000L;
            case "7D" -> 7 * 86400000L;
            case "30D" -> 30 * 86400000L;
            default -> throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "period is not supported");
        };
    }

    static boolean isBusinessHistoryOperation(String operation) {
        return "COUNT".equals(operation) || "INCREASE".equals(operation);
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

    static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    static void requireOwnerScopeGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            String dataNodeRef,
            String expectedCapability,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || expectedCapability == null)
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory owner scope grant is required");
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null
                    && ownerScopeGrant.matchesCapability(
                            workspaceUuid, groupWorkspaceKey, dataNodeType, targetId, expectedCapability)) return;
        } catch (RuntimeException ignored) {
        }
        throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory owner scope grant is required");
    }

    static CatalogAuthorizationScope requireTypedContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String expectedOwner,
            String requiredRequirement) {
        if (context == null
                || context.operationToken() == null
                || context.ownerScope() == null
                || context.ownerGrant() == null
                || context.workspaceUuid() == null
                || context.groupWorkspaceKey() == null
                || context.groupWorkspaceKey().isBlank()
                || !"operations-admin".equals(context.consumerFace())) {
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory execution context is required");
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner())
                || (requiredRequirement != null && !requiredRequirement.equals(token.requirementId()))
                || scope.dataNodeId() == null
                || scope.brandRef() == null
                || scope.brandRef().isBlank()
                || !token.allowedDataNodeTypes().contains(scope.dataNodeType())
                || capability == null
                || !context.ownerGrant()
                        .verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new InventoryOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "inventory execution context is not authorized");
        }
        return scope;
    }

    static String inventoryWriteCapabilityForTarget(String dataNodeType) {
        return "STORE".equals(dataNodeType) ? "EDIT_STORE_INVENTORY" : null;
    }

    private long periodStart(String period) {
        return time.currentEpochMillis() - periodDurationMillis(period);
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

    static String inventoryTargetType(UUID productSkuRef) {
        return productSkuRef == null ? "CATALOG_ITEM" : "SKU";
    }

    JsonNode legacyAdjust(String scope, String brand, String requestId, ObjectNode request, String operation) {
        return adjust(scope, brand, requestId, request, operation);
    }

    JsonNode legacyUpdateConfiguration(String scope, String brand, String requestId, ObjectNode request) {
        return updateConfiguration(scope, brand, requestId, request);
    }

    void legacyRecheckWriteFacts(String operationId, String scope, String brand, ObjectNode request) {
        recheckWriteFactsBeforeReceipt(operationId, scope, brand, request);
    }

    JsonNode legacyReceiptRequest(ObjectNode request, String brandRef) {
        return receiptRequest(request, brandRef);
    }

    JsonNode legacyReplay(String scope, String key, String operation, JsonNode request) {
        return replay(scope, key, operation, request);
    }

    void legacySaveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        saveReceipt(scope, key, operation, request, response);
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


    private record CurrentLedgerFacts(Map<String, ObjectNode> summaries, ArrayNode recentChanges) {}



    private record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

    private record CatalogTargetDisplay(String itemCode, String itemName, String skuCode, String skuName) {}












    private record TargetPageRow(
            TargetRow target,
            String stockState,
            long allCount,
            long attentionCount,
            long lowCount,
            long outCount,
            long negativeCount,
            long unknownCount,
            long viewCount) {}

    private record ChangeSnapshot(
            BigDecimal today, BigDecimal sevenDays, BigDecimal thirtyDays, String lastSource, Long lastAt) {}


    private record Receipt(String operation, String requestHash, JsonNode response) {}
}
