package com.catering.v2s.inventory.application;

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
@Service
public class InventoryOwnerService implements InventoryOwnerApi {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final String CATALOG_ITEM_SAVE_REQUIREMENT =
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM";
    private static final String ITEM_BASE_UNIT_ARGS = "商品基础计量单位判断参数不完整";
    private static final String SKU_BASE_UNIT_ARGS = "SKU 基础计量单位判断参数不完整";
    private static final String INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT = "单位快照不完整";
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

    public InventoryOwnerService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    @Override
    public JsonNode readTargets(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        return targets(dataNodeRef, brandRef, requestId, request);
    }

    @Override
    public JsonNode readTarget(
            String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        return current(dataNodeRef, brandRef, requestId, targetRef);
    }

    @Override
    public JsonNode readTargetChangeSummary(
            String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        target(dataNodeRef, brandRef, targetRef);
        return changeSummaryData(targetRef, period);
    }

    @Override
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

    @Override
    public JsonNode readTargetConsumptionReferences(
            String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return references(dataNodeRef, brandRef, requestId, targetRef, request);
    }

    @Override
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

    @Override
    public JsonNode readTargetDiagnostics(String targetRef, String requestId) {
        return diagnostics(requestId, targetRef);
    }

    @Override
    @Transactional
    public JsonNode read(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        return switch (operationId) {
            case "getOperationsInventoryTargets" -> targets(dataNodeRef, brandRef, requestId, request);
            case "getOperationsInventoryTarget" -> current(
                    dataNodeRef, brandRef, requestId, required(request, "targetRef"));
            case "getOperationsInventoryTargetChangeSummary" -> {
                String targetRef = required(request, "targetRef");
                target(dataNodeRef, brandRef, targetRef);
                yield changeSummaryData(targetRef, optional(request, "period"));
            }
            case "getOperationsInventoryTargetBusinessHistory" -> {
                String targetRef = required(request, "targetRef");
                target(dataNodeRef, brandRef, targetRef);
                yield history(requestId, targetRef, request);
            }
            case "getOperationsInventoryTargetConsumptionReferences" -> references(
                    dataNodeRef, brandRef, requestId, required(request, "targetRef"), request);
            case "getOperationsInventoryTargetLedger" -> {
                String targetRef = required(request, "targetRef");
                target(dataNodeRef, brandRef, targetRef);
                yield ledger(requestId, targetRef, request);
            }
            case "getOperationsInventoryTargetDiagnostics" -> diagnostics(requestId, required(request, "targetRef"));
            default -> throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "inventory read operation is not registered");
        };
    }

    @Override
    @Transactional
    public JsonNode write(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            String dataNodeType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return writeCore(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey, () -> {
            requireStoreDataNodeType(dataNodeType);
            requireOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    dataNodeType,
                    dataNodeRef,
                    inventoryWriteCapabilityForTarget(dataNodeType),
                    ownerScopeGrant);
        });
    }

    @Override
    @Transactional
    public JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "inventory", null);
        return writeCore(
                context.operationToken().operationId(),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireStoreDataNodeType(scope.dataNodeType()));
    }

    @Override
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

    @Override
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

    @Override
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

    @Override
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

    @Override
    @Transactional
    public void validateCatalogUnitLifecycle(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID unitRef,
            CatalogUnitLifecycleChange intendedChange) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (unitRef == null || intendedChange == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "单位生命周期判断参数不完整");
        AdvisoryLock.acquire(jdbc, 0x554E4954, unitRef);
        List<UUID> targetRefs = jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                        + "AND (consumption_unit_ref=? OR counting_unit_ref=?) FOR UPDATE",
                (result, row) -> result.getObject(1, UUID.class),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                unitRef,
                unitRef);
        long ledgerCount = jdbc.queryForObject(
                "SELECT count(*) FROM inventory.stock_ledger ledger WHERE ledger.consumption_unit_ref=? "
                        + "AND EXISTS (SELECT 1 FROM inventory.stock_target target "
                        + "WHERE target.target_ref=ledger.target_ref "
                        + "AND target.data_node_ref=? AND target.brand_ref=?)",
                Long.class,
                unitRef,
                scope.dataNodeId().toString(),
                scope.brandRef());
        long bomCount = jdbc.queryForObject(
                "SELECT count(*) FROM inventory.stock_bom bom WHERE EXISTS ("
                        + "SELECT 1 FROM jsonb_array_elements(bom.rows) line "
                        + "WHERE line->'consumptionUnitSnapshot'->>'unitRef'=? )",
                Long.class,
                unitRef.toString());
        if ((intendedChange == CatalogUnitLifecycleChange.UPDATE_DEFINITION
                        || intendedChange == CatalogUnitLifecycleChange.DELETE)
                && (!targetRefs.isEmpty() || ledgerCount > 0 || bomCount > 0)) {
            String message = intendedChange == CatalogUnitLifecycleChange.DELETE
                    ? "该计量单位正在使用，不能删除。"
                    : "该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择";
            throw new InventoryOwnerApi.Problem(
                    "CATALOG_UNIT_IN_USE",
                    409,
                    /* format-wrap */
                    message);
        }
    }

    @Override
    @Transactional
    public void validateCatalogItemBaseMeasureUnitTransition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID itemRef,
            UnitSnapshot itemBaseMeasureUnit,
            List<CatalogSkuBaseMeasureUnit> skuBaseMeasureUnits) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (itemRef == null || skuBaseMeasureUnits == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, ITEM_BASE_UNIT_ARGS);
        lockCatalogItemRefs(List.of(itemRef));
        lockProductSkuRefs(skuBaseMeasureUnits.stream()
                .map(CatalogSkuBaseMeasureUnit::productSkuRef)
                .toList());
        Map<UUID, UnitSnapshot> skuUnits = new LinkedHashMap<>();
        for (CatalogSkuBaseMeasureUnit entry : skuBaseMeasureUnits) {
            if (entry.productSkuRef() == null)
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, SKU_BASE_UNIT_ARGS);
            skuUnits.put(entry.productSkuRef(), entry.unitSnapshot());
        }
        List<TargetConsumptionUnitRow> targets = jdbc.query(
                "SELECT target_ref,product_sku_ref,consumption_unit_ref FROM inventory.stock_target "
                        + "WHERE data_node_ref=? AND brand_ref=? AND item_ref=? FOR UPDATE",
                (result, row) -> new TargetConsumptionUnitRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class)),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                itemRef);
        for (TargetConsumptionUnitRow target : targets) {
            UnitSnapshot candidate =
                    target.productSkuRef() == null ? itemBaseMeasureUnit : skuUnits.get(target.productSkuRef());
            if (candidate == null || !java.util.Objects.equals(candidate.unitRef(), target.consumptionUnitRef()))
                throw new InventoryOwnerApi.Problem(
                        "CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED",
                        409,
                        /* format-wrap */
                        "基础计量单位变更会改变既有库存对象的消费单位");
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

    /** Typed M1 command helper. It owns mutation facts and never delegates to the legacy JSON dispatcher. */
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

    /** JSON is used only as the persisted canonical receipt payload, never as a public command boundary. */
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

    /** Builds the full owner-native configuration readback inside the command transaction. */
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

    private JsonNode writeCore(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        requireScope(dataNodeRef, brandRef);
        authorization.run();
        String key = requireIdempotencyKey(idempotencyKey);

        recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);

        JsonNode receiptRequest = receiptRequest(request, brandRef);
        JsonNode replay = replay(dataNodeRef, key, operationId, receiptRequest);
        if (replay != null) return replay;
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result =
                    switch (operationId) {
                        case "countOperationsInventoryTarget" -> adjust(
                                dataNodeRef, brandRef, requestId, request, "COUNT");
                        case "increaseOperationsInventoryTarget" -> adjust(
                                dataNodeRef, brandRef, requestId, request, "INCREASE");
                        case "adjustOperationsInventoryTarget" -> adjust(
                                dataNodeRef, brandRef, requestId, request, "ADJUST");
                        case "updateOperationsInventoryTargetConfiguration" -> updateConfiguration(
                                dataNodeRef, brandRef, requestId, request);
                        default -> throw new InventoryOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "inventory write operation is not registered");
                    };
            saveReceipt(dataNodeRef, key, operationId, receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional
    public JsonNode copy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return copyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, requestId, idempotencyKey, () -> {
            requireCatalogDefinitionDataNodeType(targetDataNodeType);
            requireOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    targetDataNodeType,
                    targetDataNodeRef,
                    CatalogTargetCapability.forDataNodeType(targetDataNodeType),
                    ownerScopeGrant);
        });
    }

    @Override
    @Transactional
    public JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return copyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    private JsonNode copyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        return copyCore(
                sourceDataNodeRef,
                targetDataNodeRef,
                brandRef,
                request,
                requestId,
                idempotencyKey,
                authorization,
                null);
    }

    private JsonNode copyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization,
            PreparedCopy prepared) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        JsonNode judgement;
        if (prepared == null) {
            recheckCopySourceFactsBeforeReceipt(sourceDataNodeRef, brandRef, request);
            judgement = preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization);
        } else {
            ensurePreparedSourceClosure(prepared.sourceClosure(), request);
            judgement = prepared.judgement();
        }

        String currentFingerprint = judgement.path("digest").asText();
        String blocker = judgement.path("firstBlockingProblem").asText("");
        if (!blocker.isBlank()) throw new InventoryOwnerApi.Problem(blocker, 422, "库存复制存在不兼容事实");
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isBlank()) {
            JsonNode replay =
                    replay(targetDataNodeRef, receiptKey, "coordinatedCopy", receiptRequest(request, brandRef));
            if (replay != null) {
                if (prepared != null) recheckCopySourceFactsBeforeReceipt(sourceDataNodeRef, brandRef, request);
                return replayCopyIfCurrent(replay, currentFingerprint);
            }
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            if (request.hasNonNull("inventoryPreflightDigest")) {
                String expected = request.path("inventoryPreflightDigest").asText();
                if (!expected.equals(currentFingerprint)) {
                    throw new InventoryOwnerApi.Problem(
                            ("STALE_COPY_PREFLIGHT"),
                            (409),
                            /* format-wrap */
                            ("库存复制预检已失效，请重新预检"));
                }
            }
            Map<UUID, ReferenceMapping> mappings = referenceMappings(request);
            List<UUID> closureItemRefs = requiredOpaqueRefArray(request, "closureItemRefs");
            LocalCopySectionPlan localSections = localCopySectionPlan(request);
            SourceCopyClosure sourceClosure = prepared == null
                    ? sourceCopyClosure(sourceDataNodeRef, brandRef, closureItemRefs, localSections)
                    : prepared.sourceClosure();
            int copied = 0;
            List<TargetRow> sourceRows = sourceClosure.targets();
            List<BomOwnerRow> sourceBomOwners = sourceClosure.bomOwners();
            // First materialize every target in the closure.  Only after the complete
            // identity map exists may BOM references be rewritten; this prevents an
            // order-dependent source UUID from leaking into a target BOM.
            List<PlannedTarget> plannedTargets = sourceRows.stream()
                    .map(row -> {
                        ReferenceMapping item = mappingFor(mappings, row.itemRef(), "CATALOG_ITEM");
                        ReferenceMapping sku = row.productSkuRef() == null
                                ? null
                                : mappingFor(mappings, row.productSkuRef(), "PRODUCT_SKU");
                        ReferenceMapping target = mappingFor(mappings, row.ref(), "STOCK_TARGET");
                        return new PlannedTarget(row, item, sku, target);
                    })
                    .toList();
            lockCatalogItemRefs(plannedTargets.stream()
                    .map(target -> target.itemMapping().targetRef())
                    .toList());
            lockProductSkuRefs(plannedTargets.stream()
                    .map(PlannedTarget::skuMapping)
                    .filter(java.util.Objects::nonNull)
                    .map(ReferenceMapping::targetRef)
                    .toList());
            int[] insertedTargets = jdbc.batchUpdate(
                    "INSERT INTO "
                            + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_"
                            + "code"
                            + ",sku_code,measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,"
                            + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                            + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                            + "counting_unit_precision,counting_unit_conversion_factor,configuration,balance,version,"
                            + "created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,"
                            + "?,?,?,?,?,?,CAST(? AS JSONB),0,1,?,?) ON CONFLICT DO NOTHING",
                    new BatchPreparedStatementSetter() {
                        @Override
                        public void setValues(java.sql.PreparedStatement statement, int index)
                                throws java.sql.SQLException {
                            PlannedTarget target = plannedTargets.get(index);
                            ReferenceMapping sku = target.skuMapping();
                            statement.setObject(1, target.targetMapping().targetRef());
                            statement.setString(2, targetDataNodeRef);
                            statement.setString(3, brandRef);
                            statement.setObject(4, target.itemMapping().targetRef());
                            statement.setObject(5, sku == null ? null : sku.targetRef());
                            statement.setString(
                                    6, requiredLabel(target.itemMapping().targetCode(), "CATALOG_ITEM targetCode"));
                            statement.setString(
                                    7,
                                    sku == null
                                            ? null
                                            : requiredLabel(sku.targetSkuCode(), "PRODUCT_SKU targetSkuCode"));
                            InventoryOwnerApi.UnitSnapshot consumption =
                                    mappedUnitSnapshot(target.source().consumptionUnitSnapshot(), mappings);
                            InventoryConfiguration sourceConfiguration =
                                    configurationReadback(json(target.source().configuration()));
                            InventoryOwnerApi.UnitSnapshot counting =
                                    mappedUnitSnapshot(sourceConfiguration.countingUnitSnapshot(), mappings);
                            String inventoryMode = json(target.source().configuration())
                                    .path("mode")
                                    .asText("");
                            if (inventoryMode.isBlank())
                                throw new InventoryOwnerApi.Problem(
                                        "RESULT_UNKNOWN",
                                        500,
                                        /* format-wrap */
                                        "库存对象缺少 inventory mode");
                            statement.setString(8, target.source().measureMode());
                            statement.setString(9, inventoryMode);
                            statement.setObject(10, consumption.unitRef());
                            statement.setString(11, consumption.code());
                            statement.setString(12, consumption.name());
                            statement.setString(13, consumption.unitDimension());
                            statement.setInt(14, consumption.precision());
                            statement.setObject(15, counting == null ? null : counting.unitRef());
                            statement.setString(16, counting == null ? null : counting.code());
                            statement.setString(17, counting == null ? null : counting.name());
                            statement.setString(18, counting == null ? null : counting.unitDimension());
                            if (counting == null) statement.setObject(19, null);
                            else statement.setInt(19, counting.precision());
                            statement.setBigDecimal(20, sourceConfiguration.conversionFactor());
                            statement.setString(
                                    21,
                                    mappedConfiguration(
                                            target.source().configuration(),
                                            inventoryMode,
                                            counting,
                                            sourceConfiguration.conversionFactor()));
                            statement.setLong(22, time.currentEpochMillis());
                            statement.setLong(23, time.currentEpochMillis());
                        }

                        @Override
                        public int getBatchSize() {
                            return plannedTargets.size();
                        }
                    });
            copied += java.util.Arrays.stream(insertedTargets)
                    .map(value -> value > 0 ? value : 0)
                    .sum();
            Map<UUID, UUID> targetRefs = new java.util.LinkedHashMap<>();
            Map<TargetIdentity, TargetRow> targetsByIdentity = prepared == null
                    ? targetRowsByIdentities(
                            targetDataNodeRef,
                            brandRef,
                            plannedTargets.stream()
                                    .map(target -> new TargetIdentity(
                                            target.itemMapping().targetRef(),
                                            target.skuMapping() == null
                                                    ? null
                                                    : target.skuMapping().targetRef()))
                                    .toList())
                    : postInsertTargetRows(plannedTargets, prepared.preflightTargetRows(), mappings);
            for (PlannedTarget planned : plannedTargets) {
                TargetRow target = targetsByIdentity.get(new TargetIdentity(
                        planned.itemMapping().targetRef(),
                        planned.skuMapping() == null
                                ? null
                                : planned.skuMapping().targetRef()));
                if (target == null) {
                    throw new InventoryOwnerApi.Problem(
                            ("RESULT_UNKNOWN"),
                            (500),
                            /* format-wrap */
                            ("库存对象创建后无法读取"));
                }
                targetRefs.put(planned.source().ref(), target.ref());
            }
            List<PreparedBom> rewrittenBoms = sourceBomOwners.stream()
                    .map(owner ->
                            rewrittenBom(sourceDataNodeRef, targetDataNodeRef, brandRef, owner, targetRefs, mappings))
                    .toList();
            // An option-value BOM belongs only to a catalog order-option definition value.  It must
            // serialize with that definition-value lifecycle exactly like the direct BOM save path;
            // SKU dictionary values are not an alias for this reference.
            lockCatalogOptionValueRefs(rewrittenBoms.stream()
                    .map(PreparedBom::option)
                    .filter(java.util.Objects::nonNull)
                    .map(ReferenceMapping::targetRef)
                    .toList());
            int[] upsertedBoms = jdbc.batchUpdate(
                    "INSERT INTO "
                            + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_valu"
                            + "e_re"
                            + "f,item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                            + "VALUES(?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT "
                            + "(data_node_ref,brand_ref,item_ref,(COALESCE(product_sku_ref, "
                            + "'00000000-0000-0000-0000-000000000000'::uuid)),(COALESCE(option_value_ref, "
                            + "'00000000-0000-0000-0000-000000000000'::uuid))) WHERE definition_status='ENABLED' "
                            + "DO UPDATE SET "
                            + "version=EXCLUDED.version,rows=EXCLUDED.rows,updated_at_epoch_millis=EXCLUDED.updated_at_"
                            + "epoc"
                            + "h_millis",
                    new BatchPreparedStatementSetter() {
                        @Override
                        public void setValues(java.sql.PreparedStatement statement, int index)
                                throws java.sql.SQLException {
                            PreparedBom bom = rewrittenBoms.get(index);
                            statement.setObject(1, UUID.randomUUID());
                            statement.setString(2, targetDataNodeRef);
                            statement.setString(3, brandRef);
                            statement.setObject(4, bom.item().targetRef());
                            statement.setObject(
                                    5, bom.sku() == null ? null : bom.sku().targetRef());
                            statement.setObject(
                                    6,
                                    bom.option() == null ? null : bom.option().targetRef());
                            statement.setString(7, requiredLabel(bom.item().targetCode(), "CATALOG_ITEM targetCode"));
                            statement.setString(
                                    8,
                                    bom.sku() == null
                                            ? null
                                            : requiredLabel(bom.sku().targetSkuCode(), "PRODUCT_SKU targetSkuCode"));
                            statement.setString(
                                    9,
                                    bom.option() == null
                                            ? null
                                            : requiredLabel(
                                                    bom.option().targetOptionValueCode(),
                                                    "CATALOG_ORDER_OPTION_DEFINITION_VALUE targetOptionValueCode"));
                            statement.setLong(10, bom.version());
                            statement.setString(11, bom.rows());
                            statement.setLong(12, time.currentEpochMillis());
                        }

                        @Override
                        public int getBatchSize() {
                            return rewrittenBoms.size();
                        }
                    });
            copied += java.util.Arrays.stream(upsertedBoms)
                    .map(value -> value > 0 ? value : 0)
                    .sum();
            if (!sourceDataNodeRef.equals(targetDataNodeRef)) {
                List<UUID> targetItemRefs = sourceClosure.itemRefs().stream()
                        .map(sourceItemRef -> mappingFor(mappings, sourceItemRef, "CATALOG_ITEM")
                                .targetRef())
                        .toList();
                verifyTargetNoOwnerReference(targetDataNodeRef, brandRef, targetItemRefs, sourceDataNodeRef);
            }
            ObjectNode result = mapper.createObjectNode()
                    .put("owner", "inventory")
                    .put(
                            "status",
                            copied == 0 && !sourceClosure.skipped().isEmpty()
                                    ? "SKIPPED"
                                    : (copied == 0 ? "CONFLICT" : "COMMITTED"))
                    .put("version", copied);
            ArrayNode skipped = result.putArray("skipped");
            sourceClosure.skipped().forEach(entry -> skipped.addObject()
                    .put("section", entry.section())
                    .put("reasonCode", entry.reasonCode()));
            result.put(
                    "receiptObjectFingerprint",
                    preflightCopyCoreWithState(
                                    sourceDataNodeRef,
                                    targetDataNodeRef,
                                    brandRef,
                                    request,
                                    authorization,
                                    sourceClosure,
                                    targetsByIdentity)
                            .judgement()
                            .path("digest")
                            .asText());
            if (!receiptKey.isBlank())
                saveReceipt(
                        targetDataNodeRef, receiptKey, "coordinatedCopy", receiptRequest(request, brandRef), result);
            return result;
        }
    }

    private JsonNode replayCopyIfCurrent(JsonNode replay, String currentFingerprint) {
        if (!currentFingerprint.equals(replay.path("receiptObjectFingerprint").asText())) {
            {
                throw new InventoryOwnerApi.Problem(
                        ("STALE_COPY_PREFLIGHT"),
                        (409),
                        /* format-wrap */
                        ("库存复制对象事实已变化，请重新预检"));
            }
        }
        return replay;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode preflightCopy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, () -> {
            requireCatalogDefinitionDataNodeType(targetDataNodeType);
            requireOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    targetDataNodeType,
                    targetDataNodeRef,
                    CatalogTargetCapability.forDataNodeType(targetDataNodeType),
                    ownerScopeGrant);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return preflightCopyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryOwnerApi.LocalCopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyPreflightCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
        JsonNode result = preflightCopy(context, request);
        // CanonicalJsonDocument crosses the owner boundary as an envelope.  The
        // coordinator validates envelope.data before it composes any owner fact.
        ObjectNode envelope = envelope(context.requestId(), result);
        try {
            return new InventoryOwnerApi.LocalCopyPreflightReadback(
                    envelope.path("data").path("digest").asText(), mapper.writeValueAsString(envelope));
        } catch (Exception failure) {
            throw new IllegalStateException("inventory owner could not encode copy readback", failure);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryOwnerApi.CopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode().put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return prepareCopyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Override
    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey) {
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
        try {
            return copyExecutionReadback(copy(context, request, idempotencyKey));
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalStateException("inventory owner could not encode copy readback", failure);
        }
    }

    @Override
    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey,
            InventoryOwnerApi.CopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedCopy prepared))
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory local copy preparation is invalid");
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return copyExecutionReadback(copyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()),
                prepared));
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryOwnerApi.LocalCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyPreflightCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", command.targetDataNodeRef());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
        JsonNode result = preflightCopy(context, request);
        // Keep the brand-copy path identical to local-copy: consumers never
        // infer whether this owner happened to return a bare or wrapped JSON object.
        ObjectNode envelope = envelope(context.requestId(), result);
        try {
            return new InventoryOwnerApi.LocalCopyPreflightReadback(
                    envelope.path("data").path("digest").asText(), mapper.writeValueAsString(envelope));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryOwnerApi.CopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", command.targetDataNodeRef());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return prepareCopyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Override
    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        ObjectNode request = mapper.createObjectNode()
                .put("targetDataNodeRef", command.targetDataNodeRef())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
            return copyExecutionReadback(copy(context, request, idempotencyKey));
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    @Override
    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey,
            InventoryOwnerApi.CopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedCopy prepared))
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory brand copy preparation is invalid");
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode()
                .put("targetDataNodeRef", command.targetDataNodeRef())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return copyExecutionReadback(copyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()),
                prepared));
    }

    private void applyCatalogReferencePlan(ObjectNode request, String canonicalPlan) {
        try {
            JsonNode plan = mapper.readTree(canonicalPlan);
            if (plan == null || !plan.isObject()) throw new IllegalArgumentException();
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
    }

    private PreparedCopy prepareCopyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            Runnable authorization) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        List<UUID> closureItemRefs = requiredOpaqueRefArray(request, "closureItemRefs");
        LocalCopySectionPlan localSections = localCopySectionPlan(request);
        SourceCopyClosure sourceClosure =
                sourceCopyClosure(sourceDataNodeRef, brandRef, closureItemRefs, localSections);
        PreflightCopyResult computed = preflightCopyCoreWithState(
                sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization, sourceClosure, null);
        JsonNode judgement = computed.judgement();
        ObjectNode envelope = envelope(requestId, judgement);
        try {
            return new PreparedCopy(
                    sourceClosure,
                    judgement,
                    computed.targetRows(),
                    new InventoryOwnerApi.LocalCopyPreflightReadback(
                            envelope.path("data").path("digest").asText(), mapper.writeValueAsString(envelope)));
        } catch (Exception failure) {
            throw new IllegalStateException("inventory owner could not encode copy preparation", failure);
        }
    }

    private void ensurePreparedSourceClosure(SourceCopyClosure sourceClosure, ObjectNode request) {
        List<UUID> requested = requiredOpaqueRefArray(request, "closureItemRefs");
        if (!new LinkedHashSet<>(sourceClosure.itemRefs()).containsAll(requested)) {
            String problemMessage = "库存复制准备的来源闭包与执行请求不一致";
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, problemMessage);
        }
    }

    private InventoryOwnerApi.LocalCopyExecutionReadback copyExecutionReadback(JsonNode result) {
        if (result == null
                || !result.isObject()
                || result.path("owner").asText().isBlank()
                || result.path("status").asText().isBlank()
                || !result.path("version").canConvertToLong()) {
            throw new InventoryOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "inventory copy readback is missing a required field");
        }
        List<InventoryOwnerApi.LocalCopySkippedReadback> skipped = new ArrayList<>();
        if (result.path("skipped").isArray())
            for (JsonNode entry : result.path("skipped")) {
                String section = entry.path("section").asText();
                String reasonCode = entry.path("reasonCode").asText();
                if (section.isBlank() || reasonCode.isBlank())
                    throw new InventoryOwnerApi.Problem(
                            "RESULT_UNKNOWN", 500, "inventory copy skipped result is invalid");
                skipped.add(new InventoryOwnerApi.LocalCopySkippedReadback(section, reasonCode));
            }
        return new InventoryOwnerApi.LocalCopyExecutionReadback(
                result.path("owner").asText(),
                result.path("status").asText(),
                result.path("version").asLong(),
                List.copyOf(skipped));
    }

    private JsonNode preflightCopyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            Runnable authorization) {
        return preflightCopyCoreWithState(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization, null, null)
                .judgement();
    }

    private PreflightCopyResult preflightCopyCoreWithState(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            Runnable authorization,
            SourceCopyClosure preparedSourceClosure,
            Map<TargetIdentity, TargetRow> preparedTargetRows) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        Map<UUID, ReferenceMapping> mappingsBySource = new LinkedHashMap<>(referenceMappings(request));
        List<UUID> closureItemRefs = requiredOpaqueRefArray(request, "closureItemRefs");
        LocalCopySectionPlan localSections = localCopySectionPlan(request);
        ObjectNode snapshot = mapper.createObjectNode();
        ArrayNode versions = snapshot.putArray("versions");
        ArrayNode closureItems = snapshot.putArray("closureItems");
        ArrayNode referenceMappings = snapshot.putArray("referenceMappings");
        ArrayNode mappings = snapshot.putArray("mappingPreview");
        ArrayNode compatibility = snapshot.putArray("compatibilityResults");
        ArrayNode rewrites = snapshot.putArray("referenceRewritePreview");
        ArrayNode bomOwners = snapshot.putArray("bomOwners");
        String firstBlocking = "";
        SourceCopyClosure sourceClosure = preparedSourceClosure == null
                ? sourceCopyClosure(sourceDataNodeRef, brandRef, closureItemRefs, localSections)
                : preparedSourceClosure;
        if (sourceDataNodeRef.equals(targetDataNodeRef)) {
            addLocalCatalogUnitIdentityMappings(mappingsBySource, sourceClosure);
        }
        for (Map.Entry<UUID, ReferenceMapping> entry : mappingsBySource.entrySet()) {
            ReferenceMapping mapping = entry.getValue();
            if (!"CATALOG_UNIT".equals(mapping.objectType())) continue;
            referenceMappings
                    .addObject()
                    .put("objectType", mapping.objectType())
                    .put("sourceRef", entry.getKey().toString())
                    .put("targetRef", mapping.targetRef().toString())
                    .put("targetCode", mapping.targetCode())
                    .put("targetUnitName", mapping.targetUnitName())
                    .put("targetUnitDimension", mapping.targetUnitDimension())
                    .put("targetUnitPrecision", mapping.targetUnitPrecision());
        }
        for (BomOwnerRow owner : sourceClosure.bomOwners()) {
            bomOwners
                    .addObject()
                    .put("code", bomOwnerIdentity(owner))
                    .put("itemCode", owner.itemCode())
                    .put("version", owner.version());
            JsonNode rows = json(owner.rows());
            if (!rows.isArray()) {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存 BOM 行不是有效数组"));
            }
            if (owner.optionValueRef() != null) {
                ReferenceMapping optionValue =
                        mappingFor(mappingsBySource, owner.optionValueRef(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
                rewrites.addObject()
                        .put("sourceRef", owner.optionValueRef().toString())
                        .put("targetRef", optionValue.targetRef().toString())
                        .put("referenceKind", "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
            }
        }
        List<TargetRow> allSourceRows = sourceClosure.targets();
        Map<UUID, UUID> plannedTargetRefs = new LinkedHashMap<>();
        List<TargetIdentity> targetIdentities = allSourceRows.stream()
                .map(source -> new TargetIdentity(
                        mappingFor(mappingsBySource, source.itemRef(), "CATALOG_ITEM")
                                .targetRef(),
                        source.productSkuRef() == null
                                ? null
                                : mappingFor(mappingsBySource, source.productSkuRef(), "PRODUCT_SKU")
                                        .targetRef()))
                .toList();
        Map<TargetIdentity, TargetRow> existingTargetsByIdentity = preparedTargetRows == null
                ? targetRowsByIdentities(targetDataNodeRef, brandRef, targetIdentities)
                : preparedTargetRows;
        // The closure is recursive over inventory-owned BOM target references,
        // not merely over catalog item codes. Every component item must be
        // materialized before a BOM targetRef can be rewritten.
        for (TargetRow source : allSourceRows) {
            mappedUnitSnapshot(source.consumptionUnitSnapshot(), mappingsBySource);
            InventoryConfiguration sourceConfiguration = configurationReadback(json(source.configuration()));
            mappedUnitSnapshot(sourceConfiguration.countingUnitSnapshot(), mappingsBySource);
            ReferenceMapping itemMapping = mappingFor(mappingsBySource, source.itemRef(), "CATALOG_ITEM");
            ReferenceMapping skuMapping = source.productSkuRef() == null
                    ? null
                    : mappingFor(mappingsBySource, source.productSkuRef(), "PRODUCT_SKU");
            TargetRow existing = existingTargetsByIdentity.get(
                    new TargetIdentity(itemMapping.targetRef(), skuMapping == null ? null : skuMapping.targetRef()));
            ReferenceMapping suppliedTarget = mappingsBySource.get(source.ref());
            if (suppliedTarget != null && !"STOCK_TARGET".equals(suppliedTarget.objectType())) {
                {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存对象 sourceRef 的映射类型不正确"));
                }
            }
            UUID targetRef = suppliedTarget == null
                    ? (existing == null ? UUID.randomUUID() : existing.ref())
                    : suppliedTarget.targetRef();
            if (existing != null && !existing.ref().equals(targetRef)) {
                {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存对象预检 targetRef 与目标事实不一致"));
                }
            }
            plannedTargetRefs.put(source.ref(), targetRef);
            String result = existing == null ? "CREATE" : "REUSE";
            String reason = existing == null
                    ? "目标库存对象不存在"
                            /* format-wrap */
                            + "，将创建且余额从零开始"
                    : "库存对象身份一致，可复用";
            String problem = "";
            String reasonCode = existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED";
            if (existing != null && !java.util.Objects.equals(existing.measureMode(), source.measureMode())) {
                result = "BLOCKED";
                reason = "消耗单位不一致";
                problem = "CONSUMPTION_UNIT_INCOMPATIBLE";
                reasonCode = "CONSUMPTION_UNIT_INCOMPATIBLE";
                if (firstBlocking.isBlank()) firstBlocking = problem;
            }
            String identityCode = targetIdentityCode(
                    requiredLabel(itemMapping.targetCode(), "CATALOG_ITEM targetCode"),
                    skuMapping == null ? null : requiredLabel(skuMapping.targetSkuCode(), "PRODUCT_SKU targetSkuCode"));
            List<String> tupleParts = skuMapping == null
                    ? List.of("ITEM", requiredLabel(itemMapping.targetCode(), "CATALOG_ITEM targetCode"))
                    : List.of(
                            "SKU",
                            requiredLabel(itemMapping.targetCode(), "CATALOG_ITEM targetCode"),
                            requiredLabel(skuMapping.targetSkuCode(), "PRODUCT_SKU targetSkuCode"));
            ObjectNode canonicalTuple = canonicalTuple(targetDataNodeRef, brandRef, "STOCK_TARGET", tupleParts);
            closureItems
                    .addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("code", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("name", source.itemCode())
                    .put("action", result);
            compatibility
                    .addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("compatibilityId", stockTargetCompatibilityId(source))
                    .put("code", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("result", result)
                    .put("reason", reason)
                    .put("reasonCode", reasonCode)
                    .put("problemCode", problem)
                    .set("canonicalTuple", canonicalTuple.deepCopy());
            versions.addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("code", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("sourceVersion", source.version())
                    .put("targetVersion", existing == null ? 0 : existing.version());
            mappings.addObject()
                    .put("fromCode", source.ref().toString())
                    .put("toCode", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("referenceKind", "STOCK_TARGET")
                    .put("status", existing == null ? "CREATE" : "REUSE")
                    .set("canonicalTuple", canonicalTuple.deepCopy());
            referenceMappings
                    .addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("sourceRef", source.ref().toString())
                    .put("targetRef", targetRef.toString())
                    .put("targetCode", identityCode)
                    .put("targetSkuCode", skuMapping == null ? null : skuMapping.targetSkuCode());
        }
        for (BomOwnerRow owner : sourceClosure.bomOwners()) {
            JsonNode rows = json(owner.rows());
            for (JsonNode row : rows) {
                String sourceRef = row.path("targetRef")
                        .asText(row.path("componentTargetRef").asText(""));
                UUID sourceTargetRef;
                try {
                    sourceTargetRef = UUID.fromString(sourceRef);
                } catch (IllegalArgumentException failure) {
                    throw new InventoryOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            422,
                            "库存 BOM 组件必须为 opaque targetRef",
                            /* format-wrap */
                            failure);
                }
                UUID targetRef = plannedTargetRefs.get(sourceTargetRef);
                if (targetRef == null) {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存 BOM 组件不在复制闭包中"));
                }
                mappedUnitSnapshot(
                        requiredUnitSnapshot(row.path("consumptionUnitSnapshot"), "BOM consumptionUnitSnapshot"),
                        mappingsBySource);
                rewrites.addObject()
                        .put("sourceRef", sourceRef)
                        .put("targetRef", targetRef.toString())
                        .put("referenceKind", "STOCK_BOM");
            }
        }
        ArrayNode skipped = snapshot.putArray("skipped");
        sourceClosure.skipped().forEach(entry -> skipped.addObject()
                .put("section", entry.section())
                .put("reasonCode", entry.reasonCode()));
        snapshot.put("firstBlockingProblem", firstBlocking);
        ObjectNode result = mapper.createObjectNode()
                .put("owner", "inventory")
                .put("firstBlockingProblem", firstBlocking)
                .put("digest", hash(copyDigestSnapshot(snapshot)));
        result.set("closureItems", closureItems);
        result.set("referenceMappings", referenceMappings);
        result.set("mappingPreview", mappings);
        result.set("versions", versions);
        result.set("compatibilityResults", compatibility);
        result.set("referenceRewritePreview", rewrites);
        result.set("skipped", skipped.deepCopy());
        return new PreflightCopyResult(result, existingTargetsByIdentity);
    }

    @Override
    public JsonNode readCatalogInventoryDefinition(String scope, String brand, String itemRef, String requestId) {
        requireScope(scope, brand);
        return readCatalogInventoryDefinition(scope, brand, itemRef, requestId, null, true);
    }

    private JsonNode readCatalogInventoryDefinition(
            String scope,
            String brand,
            String itemRef,
            String requestId,
            Map<UUID, TargetRow> preloadedComponentTargets,
            boolean includeDirectTargets) {
        requireScope(scope, brand);
        UUID catalogItemRef = opaqueRef(itemRef, "itemRef");
        ObjectNode data = mapper.createObjectNode().put("itemRef", catalogItemRef.toString());
        ArrayNode nodes = data.putObject("inventoryRules").putArray("nodes");
        CatalogDefinitionFacts definitionFacts = loadCatalogDefinitionFacts(
                scope, brand, catalogItemRef, includeDirectTargets, preloadedComponentTargets);
        List<TargetRow> targets = definitionFacts.directTargets();
        List<TargetRow> displayTargets = new ArrayList<>(targets);
        displayTargets.addAll(definitionFacts.componentTargets().values());
        Set<TargetIdentity> displayIdentities = displayTargets.stream()
                .map(target -> new TargetIdentity(target.itemRef(), target.productSkuRef()))
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        // A BOM owner is not required to own a stock target itself.  Its display
        // facts still belong to catalog, however: never substitute the opaque
        // item ref (or the stored code) for the operator-facing item name.
        definitionFacts
                .bomOwners()
                .forEach(owner -> displayIdentities.add(new TargetIdentity(catalogItemRef, owner.productSkuRef())));
        Map<TargetIdentity, CatalogTargetDisplay> targetDisplays =
                catalogTargetDisplays(scope, brand, displayIdentities);
        for (TargetRow row : targets) {
            CatalogTargetDisplay display = requiredCatalogTargetDisplay(targetDisplays, row);
            ObjectNode node = nodes.addObject();
            ObjectNode owner = node.putObject("owner")
                    .put("ownerType", row.productSkuRef() == null ? "ITEM" : "SKU")
                    .put("itemRef", catalogItemRef.toString());
            if (row.productSkuRef() == null) owner.putNull("productSkuRef");
            else owner.put("productSkuRef", row.productSkuRef().toString());
            owner.putNull("optionValueRef").put("itemCode", row.itemCode());
            if (row.skuCode() == null) owner.putNull("skuCode");
            else owner.put("skuCode", row.skuCode());
            owner.putNull("optionValueCode");
            node.put("itemCode", row.itemCode())
                    .put("itemName", display.itemName())
                    .put("mode", "DIRECT")
                    .put("componentEligible", row.componentEligible())
                    .putNull("disabledReason");
            node.putArray("allowedModes").add("NONE").add("DIRECT").add("BOM");
            node.put("defaultMode", "DIRECT");
            ObjectNode direct = configurationNode(row)
                    .put("targetRef", row.ref().toString())
                    .put("version", row.version());
            direct.set("consumptionUnitSnapshot", mapper.valueToTree(row.consumptionUnitSnapshot()));
            node.set("directConfiguration", direct);
            node.putNull("bom");
            node.put("skuCode", row.skuCode() == null ? null : row.skuCode());
            node.putNull("optionValueCode");
        }
        List<CatalogBomRow> bomOwners = definitionFacts.bomOwners();
        Map<UUID, TargetRow> componentTargets = definitionFacts.componentTargets();
        for (CatalogBomRow ownerRow : bomOwners) {
            JsonNode rows = json(ownerRow.rows());
            if (!rows.isArray()) continue;
            ObjectNode node = nodes.addObject();
            String ownerType = ownerRow.optionValueRef() != null
                    ? "OPTION_VALUE"
                    : ownerRow.productSkuRef() != null ? "SKU" : "ITEM";
            ObjectNode owner =
                    node.putObject("owner").put("ownerType", ownerType).put("itemRef", catalogItemRef.toString());
            if (ownerRow.productSkuRef() == null) owner.putNull("productSkuRef");
            else owner.put("productSkuRef", ownerRow.productSkuRef().toString());
            if (ownerRow.optionValueRef() == null) owner.putNull("optionValueRef");
            else owner.put("optionValueRef", ownerRow.optionValueRef().toString());
            owner.putNull("itemCode");
            if (ownerRow.skuCode() == null) owner.putNull("skuCode");
            else owner.put("skuCode", ownerRow.skuCode());
            if (ownerRow.optionValueCode() == null) owner.putNull("optionValueCode");
            else owner.put("optionValueCode", ownerRow.optionValueCode());
            ObjectNode bom = node.putObject("bom").put("version", ownerRow.version());
            ArrayNode lines = bom.putArray("lines");
            for (JsonNode row : rows) {
                UUID componentTargetRef = bomTargetRef(row);
                TargetRow componentTarget = componentTargets.get(componentTargetRef);
                if (componentTarget == null)
                    throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 BOM 组件对象无法读取");
                CatalogTargetDisplay display = requiredCatalogTargetDisplay(targetDisplays, componentTarget);
                ObjectNode line = lines.addObject()
                        .put("targetRef", componentTargetRef.toString())
                        .put("itemRef", componentTarget.itemRef().toString())
                        .put("itemCode", componentTarget.itemCode())
                        .put("itemName", display.itemName())
                        .put("lineSign", normalizeLineSign(row.path("lineSign").asText("POSITIVE")))
                        .put(
                                "quantity",
                                row.path("quantity")
                                        .asText(row.path("quantityPerUnit").asText("0")));
                if (componentTarget.productSkuRef() == null) line.putNull("productSkuRef");
                else line.put("productSkuRef", componentTarget.productSkuRef().toString());
                if (componentTarget.skuCode() == null) line.putNull("skuCode");
                else line.put("skuCode", componentTarget.skuCode());
                if (componentTarget.skuCode() == null) line.putNull("skuName");
                else line.put("skuName", display.skuName());
                line.set(
                        "consumptionUnitSnapshot",
                        row.path("consumptionUnitSnapshot").isObject()
                                ? row.path("consumptionUnitSnapshot").deepCopy()
                                : mapper.valueToTree(componentTarget.consumptionUnitSnapshot()));
            }
            CatalogTargetDisplay ownerDisplay = requiredCatalogTargetDisplay(
                    targetDisplays, new TargetIdentity(catalogItemRef, ownerRow.productSkuRef()));
            node.put("itemCode", ownerDisplay.itemCode())
                    .put("itemName", ownerDisplay.itemName())
                    .put("mode", "BOM")
                    .put("skuCode", ownerRow.skuCode() == null ? null : ownerRow.skuCode())
                    .put("optionValueCode", ownerRow.optionValueCode() == null ? null : ownerRow.optionValueCode())
                    .putNull("disabledReason")
                    .putNull("directConfiguration");
            node.putArray("allowedModes").add("NONE").add("BOM");
            node.put("defaultMode", "BOM");
        }
        return envelope(requestId, data);
    }

    /**
     * A stock target keeps catalog references as identity only. The catalog name is deliberately resolved in this
     * explicit task read: neither a target code nor a local UI cache is a user-facing name.
     */
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

    @Override
    @Transactional(readOnly = true)
    public JsonNode catalogItemVoidDependencies(String scope, String brand, String itemRef, String requestId) {
        requireScope(scope, brand);
        UUID catalogItemRef = opaqueRef(itemRef, "itemRef");
        return catalogVoidDependencyJson(catalogVoidDependenciesReadback(
                scope, brand, new CatalogVoidSubject(CatalogVoidSubjectKind.CATALOG_ITEM, catalogItemRef)));
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode catalogSkuVoidDependencies(String scope, String brand, String skuRef, String requestId) {
        requireScope(scope, brand);
        UUID productSkuRef = opaqueRef(skuRef, "productSkuRef");
        return catalogVoidDependencyJson(catalogVoidDependenciesReadback(
                scope, brand, new CatalogVoidSubject(CatalogVoidSubjectKind.PRODUCT_SKU, productSkuRef)));
    }

    @Override
    @Transactional(readOnly = true)
    public List<JsonNode> catalogSkuVoidDependenciesByRefs(
            String scope, String brand, List<UUID> skuRefs, String requestId) {
        requireScope(scope, brand);
        List<UUID> ordered = skuRefs == null
                ? List.of()
                : skuRefs.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ordered.isEmpty()) return List.of();
        Map<UUID, CatalogVoidDependencyReadback> readbacks =
                catalogVoidDependenciesReadbacks(scope, brand, CatalogVoidSubjectKind.PRODUCT_SKU, ordered);
        return ordered.stream()
                .map(ref -> {
                    CatalogVoidDependencyReadback readback = readbacks.get(ref);
                    if (readback == null) {
                        String reason = "inventory SKU void dependency readback is missing";
                        throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, reason);
                    }
                    return (JsonNode) catalogVoidDependencyJson(readback);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogItemVoidDependencyReadback catalogItemVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemRef) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        UUID catalogItemRef = opaqueRef(itemRef, "itemRef");
        CatalogVoidDependencyReadback judgement = catalogVoidDependenciesReadback(
                dataNodeRef,
                scope.brandRef(),
                new CatalogVoidSubject(CatalogVoidSubjectKind.CATALOG_ITEM, catalogItemRef));
        return new CatalogItemVoidDependencyReadback(
                judgement.hasInboundBomReferences(),
                judgement.ownedActiveStockTargetCount(),
                judgement.ownedActiveProductBomCount());
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogVoidDependencyReadback catalogVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, CatalogVoidSubject subject) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        requireCatalogVoidSubject(subject);
        return catalogVoidDependenciesReadback(scope.dataNodeId().toString(), scope.brandRef(), subject);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CatalogVoidDependencyReadback> catalogVoidDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubjectKind kind,
            List<UUID> references) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        if (kind == null) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog void subject kind is required");
        }
        List<UUID> ordered = references == null
                ? List.of()
                : references.stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        if (ordered.isEmpty()) return List.of();
        Map<UUID, CatalogVoidDependencyReadback> readbacks =
                catalogVoidDependenciesReadbacks(scope.dataNodeId().toString(), scope.brandRef(), kind, ordered);
        return ordered.stream()
                .map(ref -> {
                    CatalogVoidDependencyReadback readback = readbacks.get(ref);
                    if (readback == null)
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, "inventory void dependency readback is missing");
                    return readback;
                })
                .toList();
    }

    @Override
    @Transactional
    public CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitions(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        requireCatalogVoidSubject(subject);
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        ObjectNode request = mapper.createObjectNode()
                .put("subjectKind", subject.kind().name())
                .put("subjectRef", subject.ref().toString());
        JsonNode receiptRequest = typedReceiptRequest(request, dataNodeRef, scope.brandRef());
        CatalogVoidInventoryRetirementReadback replay = replayTyped(
                dataNodeRef,
                key,
                "retireCatalogVoidInventoryDefinitions",
                receiptRequest,
                CatalogVoidInventoryRetirementReadback.class);
        if (replay != null) return replay;

        lockCatalogVoidSubjectRows(dataNodeRef, scope.brandRef(), subject);
        CatalogVoidDependencyReadback judgement =
                catalogVoidDependenciesReadback(dataNodeRef, scope.brandRef(), subject);
        if (judgement.hasInboundBomReferences()) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID",
                    422,
                    /* format-wrap */
                    "库存 BOM 仍引用该对象：" + inboundReferenceSummary(judgement));
        }

        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        int retiredTargets = jdbc.update(
                "UPDATE inventory.stock_target SET definition_status='DISABLED',version=version+1,"
                        + "updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED'",
                time.currentEpochMillis(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref());
        int retiredBoms = jdbc.update(
                "UPDATE inventory.stock_bom SET definition_status='DISABLED',version=version+1,"
                        + "updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED'",
                time.currentEpochMillis(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref());
        long remaining = countActiveOwnedDefinitions(dataNodeRef, scope.brandRef(), subject);
        if (remaining != 0L) {
            throw new InventoryOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    /* format-wrap */
                    "库存 owner 退休后仍存在启用定义");
        }
        CatalogVoidInventoryRetirementReadback result =
                new CatalogVoidInventoryRetirementReadback(subject, retiredTargets, retiredBoms, remaining);
        saveTypedReceipt(dataNodeRef, key, "retireCatalogVoidInventoryDefinitions", receiptRequest, result);
        return result;
    }

    /**
     * Retires one catalog item's own inventory definitions inside a batch item transaction. The catalog owner holds the
     * batch-start item locks and supplies the immutable graph judgement; this owner still rechecks its current
     * inventory rows in the write statement. The statement also writes the nested owner receipt, so the optimized path
     * removes round trips without removing owner idempotency or the final readback.
     */
    @Override
    @Transactional
    public CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitionsForBatch(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        requireCatalogVoidSubject(subject);
        String key = requireIdempotencyKey(idempotencyKey);
        if (subject.kind() != CatalogVoidSubjectKind.CATALOG_ITEM) {
            return retireCatalogVoidInventoryDefinitions(context, subject, key);
        }

        String dataNodeRef = scope.dataNodeId().toString();
        String operation = "retireCatalogVoidInventoryDefinitions";
        ObjectNode request = mapper.createObjectNode()
                .put("subjectKind", subject.kind().name())
                .put("subjectRef", subject.ref().toString());
        JsonNode receiptRequest = typedReceiptRequest(request, dataNodeRef, scope.brandRef());
        String requestHash = hash(receiptRequest);
        String inboundSql = "inbound_rows";
        CatalogVoidBatchSqlOutcome outcome = jdbc.queryForObject(
                "WITH receipt_lock AS MATERIALIZED ("
                        + "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)),hashtext(CAST(? AS text)))"
                        + "), prior_receipt AS MATERIALIZED ("
                        + "SELECT operation_id,request_hash,response::text AS response "
                        + "FROM inventory.command_receipt CROSS JOIN receipt_lock "
                        + "WHERE data_node_ref=? AND idempotency_key=?"
                        + "), owned_targets AS MATERIALIZED ("
                        + "SELECT target.target_ref,target.item_ref,target.definition_status "
                        + "FROM inventory.stock_target target CROSS JOIN receipt_lock "
                        + "WHERE target.data_node_ref=? AND target.brand_ref=? AND target.item_ref=? "
                        + "FOR UPDATE"
                        + "), owned_boms AS MATERIALIZED ("
                        + "SELECT bom.bom_ref,bom.definition_status "
                        + "FROM inventory.stock_bom bom CROSS JOIN receipt_lock "
                        + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.item_ref=? "
                        + "FOR UPDATE"
                        + "), "
                        + inboundSql + " AS MATERIALIZED ("
                        + "SELECT bom.bom_ref,ot.target_ref,ot.definition_status AS target_status,"
                        + "bom.item_code AS source_code,source_item.name AS source_name "
                        + "FROM inventory.stock_bom bom CROSS JOIN receipt_lock "
                        + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bom.rows)='array' "
                        + "THEN bom.rows ELSE '[]'::jsonb END) AS e(entry) "
                        + "JOIN owned_targets ot ON ot.target_ref::text=COALESCE(e.entry->>'targetRef',"
                        + "e.entry->>'componentTargetRef') "
                        + "LEFT JOIN catalog.catalog_item source_item ON source_item.item_ref=bom.item_ref "
                        + "AND source_item.data_node_ref=? AND source_item.brand_ref=? "
                        + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' "
                        + "AND bom.item_ref IS DISTINCT FROM ? "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) "
                        + "FOR UPDATE OF bom"
                        + "), retired_targets AS ("
                        + "UPDATE inventory.stock_target target SET definition_status='DISABLED',"
                        + "version=target.version+1,updated_at_epoch_millis=? "
                        + "WHERE target.target_ref IN (SELECT target_ref FROM owned_targets) "
                        + "AND target.definition_status='ENABLED' "
                        + "AND NOT EXISTS (SELECT 1 FROM " + inboundSql + ") "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) "
                        + "RETURNING target.target_ref"
                        + "), retired_boms AS ("
                        + "UPDATE inventory.stock_bom bom SET definition_status='DISABLED',"
                        + "version=bom.version+1,updated_at_epoch_millis=? "
                        + "WHERE bom.bom_ref IN (SELECT bom_ref FROM owned_boms) "
                        + "AND bom.definition_status='ENABLED' "
                        + "AND NOT EXISTS (SELECT 1 FROM " + inboundSql + ") "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) "
                        + "RETURNING bom.bom_ref"
                        + "), outcome AS ("
                        + "SELECT "
                        + "(SELECT COUNT(*) FROM " + inboundSql + ") AS inbound_count,"
                        + "COALESCE((SELECT bool_and(target_status='ENABLED' "
                        + "AND NULLIF(BTRIM(source_code),'') IS NOT NULL "
                        + "AND NULLIF(BTRIM(source_name),'') IS NOT NULL) FROM " + inboundSql + "),TRUE) "
                        + "AS inbound_resolvable,"
                        + "COALESCE((SELECT string_agg(DISTINCT COALESCE(NULLIF(BTRIM(source_name),''),"
                        + "NULLIF(BTRIM(source_code),''),'未知商品'),', ') FROM " + inboundSql + "),'') "
                        + "AS inbound_summary,"
                        + "(SELECT COUNT(*) FROM retired_targets) AS retired_target_count,"
                        + "(SELECT COUNT(*) FROM retired_boms) AS retired_bom_count,"
                        + "((SELECT COUNT(*) FROM owned_targets WHERE definition_status='ENABLED') "
                        + "- (SELECT COUNT(*) FROM retired_targets) + "
                        + "(SELECT COUNT(*) FROM owned_boms WHERE definition_status='ENABLED') "
                        + "- (SELECT COUNT(*) FROM retired_boms)) AS remaining_count"
                        + "), response_payload AS ("
                        + "SELECT jsonb_build_object('subject',jsonb_build_object('kind',CAST(? AS text),"
                        + "'ref',CAST(? AS text)),'retiredStockTargetCount',retired_target_count,"
                        + "'retiredProductBomCount',retired_bom_count,"
                        + "'remainingActiveOwnedDefinitionCount',remaining_count) AS response "
                        + "FROM outcome WHERE inbound_count=0 AND inbound_resolvable AND remaining_count=0 "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt)"
                        + "), written_receipt AS ("
                        + "INSERT INTO inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,"
                        + "operation_id,request_hash,response,created_at_epoch_millis) "
                        + "SELECT ?,?,?,?,?,response,? FROM response_payload "
                        + "RETURNING response::text AS response"
                        + ") SELECT outcome.inbound_count,outcome.inbound_resolvable,outcome.inbound_summary,"
                        + "outcome.retired_target_count,outcome.retired_bom_count,outcome.remaining_count,"
                        + "prior_receipt.operation_id,prior_receipt.request_hash,prior_receipt.response,"
                        + "written_receipt.response FROM outcome LEFT JOIN prior_receipt ON TRUE "
                        + "LEFT JOIN written_receipt ON TRUE",
                (result, rowNumber) -> new CatalogVoidBatchSqlOutcome(
                        result.getLong(1),
                        result.getBoolean(2),
                        result.getString(3),
                        result.getLong(4),
                        result.getLong(5),
                        result.getLong(6),
                        result.getString(7),
                        result.getString(8),
                        result.getString(9),
                        result.getString(10)),
                "inventory-receipt",
                key,
                dataNodeRef,
                key,
                dataNodeRef,
                scope.brandRef(),
                subject.ref(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref(),
                dataNodeRef,
                scope.brandRef(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref(),
                time.currentEpochMillis(),
                time.currentEpochMillis(),
                subject.kind().name(),
                subject.ref().toString(),
                UUID.randomUUID(),
                dataNodeRef,
                key,
                operation,
                requestHash,
                time.currentEpochMillis());

        if (outcome.priorOperation() != null) {
            if (!operation.equals(outcome.priorOperation()) || !requestHash.equals(outcome.priorRequestHash())) {
                throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
            }
            if (outcome.priorResponse() == null) {
                throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存作废回执缺少响应");
            }
            try {
                return mapper.treeToValue(json(outcome.priorResponse()), CatalogVoidInventoryRetirementReadback.class);
            } catch (Exception failure) {
                String reason = "幂等回执与当前 owner readback 不兼容";
                throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, reason, failure);
            }
        }
        if (outcome.inboundCount() > 0L) {
            if (!outcome.inboundResolvable()) {
                String reason = "库存 BOM 引用了无法唯一解析的库存对象";
                throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, reason);
            }
            String summary =
                    outcome.inboundSummary() == null || outcome.inboundSummary().isBlank()
                            ? "库存 BOM"
                            : outcome.inboundSummary();
            String reason = "库存 BOM 仍引用该对象：" + summary;
            throw new InventoryOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, reason);
        }
        if (outcome.remainingCount() != 0L || outcome.writtenResponse() == null) {
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 owner 退休后仍存在启用定义");
        }
        return new CatalogVoidInventoryRetirementReadback(
                subject, outcome.retiredTargetCount(), outcome.retiredBomCount(), outcome.remainingCount());
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogReferenceDependenciesReadback catalogReferenceDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, String reference) {
        UUID catalogReference = opaqueRef(reference, "reference");
        return catalogReferenceDependenciesByRefs(context, objectType, List.of(catalogReference))
                .get(0);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CatalogReferenceDependenciesReadback> catalogReferenceDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, List<UUID> references) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        List<InventoryCatalogReferenceDeclarations.Source> declarations =
                InventoryCatalogReferenceDeclarations.sourcesFor(objectType);
        if (declarations.isEmpty())
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "catalog dependency objectType is not supported");

        List<UUID> orderedReferences =
                references == null ? List.of() : new ArrayList<>(new LinkedHashSet<>(references));
        if (orderedReferences.isEmpty()) return List.of();
        Map<UUID, List<CatalogReferenceDependencySource>> sourcesByReference = new LinkedHashMap<>();
        orderedReferences.forEach(reference -> sourcesByReference.put(reference, new ArrayList<>()));
        for (InventoryCatalogReferenceDeclarations.Source declaration : declarations) {
            Map<UUID, Long> counts = dependencyCounts(
                    dataNodeRef,
                    scope.brandRef(),
                    declaration.tableName(),
                    declaration.columnName(),
                    orderedReferences);
            orderedReferences.forEach(reference -> sourcesByReference
                    .get(reference)
                    .add(new CatalogReferenceDependencySource(
                            declaration.tableName(), declaration.columnName(), counts.getOrDefault(reference, 0L))));
        }
        return orderedReferences.stream()
                .map(reference -> {
                    List<CatalogReferenceDependencySource> sources = sourcesByReference.get(reference);
                    long total = sources.stream()
                            .mapToLong(CatalogReferenceDependencySource::count)
                            .sum();
                    return new CatalogReferenceDependenciesReadback(objectType, reference, total, List.copyOf(sources));
                })
                .toList();
    }

    private Map<UUID, Long> dependencyCounts(
            String dataNodeRef, String brandRef, String tableName, String columnName, List<UUID> references) {
        UUID[] values = references.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT " + columnName + ",COUNT(*) FROM inventory." + tableName + " WHERE data_node_ref=? "
                        + "AND brand_ref=? AND " + columnName + " = ANY(?::uuid[]) GROUP BY " + columnName,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, Long> counts = new LinkedHashMap<>();
                    while (result.next()) counts.put(result.getObject(1, UUID.class), result.getLong(2));
                    return counts;
                });
    }

    private void requireCatalogVoidSubject(InventoryOwnerApi.CatalogVoidSubject subject) {
        if (subject == null || subject.kind() == null || subject.ref() == null) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog void subject is required");
        }
    }

    private static String catalogVoidOwnerColumn(InventoryOwnerApi.CatalogVoidSubjectKind kind) {
        return switch (kind) {
            case CATALOG_ITEM -> "item_ref";
            case PRODUCT_SKU -> "product_sku_ref";
            case OPTION_VALUE -> throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "option value is not a catalog void subject");
        };
    }

    private InventoryOwnerApi.CatalogVoidDependencyReadback catalogVoidDependenciesReadback(
            String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> readbacks =
                catalogVoidDependenciesReadbacks(scope, brand, subject.kind(), List.of(subject.ref()));
        InventoryOwnerApi.CatalogVoidDependencyReadback result = readbacks.get(subject.ref());
        if (result == null)
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "inventory void dependency readback is missing");
        return result;
    }

    /**
     * Reads the complete owner/component projection in one scoped set-based query. The query intentionally does not
     * reuse the generic declared-reference scanner: item/SKU ownership, disabled-target detection, owner exclusion and
     * source identity are all part of this lifecycle judgement's invariant.
     */
    private Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> catalogVoidDependenciesReadbacks(
            String scope, String brand, InventoryOwnerApi.CatalogVoidSubjectKind kind, Collection<UUID> subjects) {
        List<UUID> orderedSubjects = subjects == null
                ? List.of()
                : subjects.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (orderedSubjects.isEmpty()) return Map.of();
        String ownerColumn = catalogVoidOwnerColumn(kind);
        UUID[] subjectRefs = orderedSubjects.toArray(UUID[]::new);
        String sql = "WITH input AS (SELECT ?::text AS scope, ?::text AS brand, ?::uuid[] AS subject_refs), "
                + "owned_targets AS ("
                + "SELECT target.target_ref,target.definition_status,target.item_ref,target.product_sku_ref "
                + "FROM inventory.stock_target target CROSS JOIN input "
                + "WHERE target.data_node_ref=input.scope AND target.brand_ref=input.brand "
                + "AND target." + ownerColumn + "=ANY(input.subject_refs)), "
                + "owned_boms AS ("
                + "SELECT bom.bom_ref,bom.definition_status,bom.item_ref,bom.product_sku_ref,bom.option_value_ref "
                + "FROM inventory.stock_bom bom CROSS JOIN input "
                + "WHERE bom.data_node_ref=input.scope AND bom.brand_ref=input.brand "
                + "AND bom." + ownerColumn + "=ANY(input.subject_refs)), "
                + "inbound AS ("
                + "SELECT ot." + ownerColumn + " AS subject_ref,bom.bom_ref,bom.item_ref,bom.product_sku_ref,"
                + "bom.option_value_ref,ot.target_ref,bom.item_code,source_item.name,ot.definition_status "
                + "FROM inventory.stock_bom bom CROSS JOIN input "
                + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bom.rows)='array' "
                + "THEN bom.rows ELSE '[]'::jsonb END) AS e(entry) "
                + "JOIN owned_targets ot ON ot.target_ref::text=COALESCE(e.entry->>'targetRef',"
                + "e.entry->>'componentTargetRef') "
                + "LEFT JOIN catalog.catalog_item source_item ON source_item.item_ref=bom.item_ref "
                + "AND source_item.data_node_ref=input.scope AND source_item.brand_ref=input.brand "
                + "WHERE bom.data_node_ref=input.scope AND bom.brand_ref=input.brand "
                + "AND bom.definition_status='ENABLED' "
                + "AND "
                + (kind == InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM
                        ? "bom.item_ref IS DISTINCT FROM ot.item_ref"
                        : "bom.product_sku_ref IS DISTINCT FROM ot.product_sku_ref")
                + ") "
                + "SELECT 'TARGET' AS fact_kind,target.target_ref AS fact_ref,target." + ownerColumn
                + " AS subject_ref,target.definition_status,NULL::uuid AS source_item_ref,NULL::uuid AS source_sku_ref,"
                + "NULL::uuid AS source_option_value_ref,target.target_ref AS target_ref,NULL::text AS source_code,"
                + "NULL::text AS source_name,target.definition_status AS matched_target_status "
                + "FROM owned_targets target "
                + "UNION ALL SELECT 'BOM',bom.bom_ref,bom." + ownerColumn
                + ",bom.definition_status,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text "
                + "FROM owned_boms bom "
                + "UNION ALL SELECT 'INBOUND',inbound.bom_ref,inbound.subject_ref,'ENABLED',"
                + "inbound.item_ref,inbound.product_sku_ref,inbound.option_value_ref,inbound.target_ref,"
                + "inbound.item_code,inbound.name,inbound.definition_status FROM inbound "
                + "ORDER BY subject_ref,fact_kind,fact_ref";
        List<VoidDependencyFact> facts = jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", subjectRefs));
                },
                (result, rowNumber) -> new VoidDependencyFact(
                        result.getString(1),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        result.getObject(5, UUID.class),
                        result.getObject(6, UUID.class),
                        result.getObject(7, UUID.class),
                        result.getObject(8, UUID.class),
                        result.getString(9),
                        result.getString(10),
                        result.getString(11)));

        Map<UUID, VoidDependencyAccumulator> accumulators = new LinkedHashMap<>();
        orderedSubjects.forEach(ref -> accumulators.put(
                ref, new VoidDependencyAccumulator(new InventoryOwnerApi.CatalogVoidSubject(kind, ref))));
        for (VoidDependencyFact fact : facts) {
            VoidDependencyAccumulator accumulator = accumulators.get(fact.subjectRef());
            if (accumulator == null) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "库存作废判断返回了未知 subject");
            }
            switch (fact.factKind()) {
                case "TARGET" -> {
                    accumulator.ownedTargetRefsAllStatus.add(fact.factRef());
                    if ("ENABLED".equals(fact.definitionStatus())) {
                        accumulator.ownedActiveTargetRefs.add(fact.factRef());
                    } else {
                        accumulator.ownedDisabledTargetRefs.add(fact.factRef());
                    }
                }
                case "BOM" -> {
                    if ("ENABLED".equals(fact.definitionStatus())) accumulator.ownedActiveProductBomCount++;
                }
                case "INBOUND" -> {
                    if (!"ENABLED".equals(fact.matchedTargetStatus())) {
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                /* format-wrap */
                                "库存 BOM 引用了非当前启用库存对象");
                    }
                    if (fact.sourceCode() == null
                            || fact.sourceCode().isBlank()
                            || fact.sourceName() == null
                            || fact.sourceName().isBlank())
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                /* format-wrap */
                                "库存 BOM 引用的来源商品无法唯一解析");
                    CatalogVoidInboundKey key = new CatalogVoidInboundKey(
                            fact.sourceItemRef(),
                            fact.sourceSkuRef(),
                            fact.sourceOptionValueRef(),
                            fact.targetRef(),
                            fact.sourceCode(),
                            fact.sourceName());
                    accumulator.inboundCounts.merge(key, 1L, Long::sum);
                }
                default -> throw new InventoryOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        500,
                        /* format-wrap */
                        "库存作废判断返回了未知 fact 类型");
            }
        }
        Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> result = new LinkedHashMap<>();
        accumulators.forEach((ref, accumulator) -> result.put(ref, accumulator.readback()));
        return Map.copyOf(result);
    }

    private ObjectNode catalogVoidDependencyJson(InventoryOwnerApi.CatalogVoidDependencyReadback readback) {
        ObjectNode result = mapper.createObjectNode()
                .put("subjectKind", readback.subject().kind().name())
                .put("subjectRef", readback.subject().ref().toString())
                .put(
                        "itemRef",
                        readback.subject().kind() == InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM
                                ? readback.subject().ref().toString()
                                : "")
                .put("hasDependentFacts", readback.hasInboundBomReferences())
                .put("stockTargetCount", readback.ownedActiveStockTargetCount())
                .put("productBomCount", readback.ownedActiveProductBomCount());
        ArrayNode targetRefs = result.putArray("ownedTargetRefsAllStatus");
        readback.ownedTargetRefsAllStatus().stream().sorted().forEach(ref -> targetRefs.add(ref.toString()));
        ArrayNode activeTargetRefs = result.putArray("ownedActiveTargetRefs");
        readback.ownedActiveTargetRefs().stream().sorted().forEach(ref -> activeTargetRefs.add(ref.toString()));
        ArrayNode disabledTargetRefs = result.putArray("ownedDisabledTargetRefs");
        readback.ownedDisabledTargetRefs().stream().sorted().forEach(ref -> disabledTargetRefs.add(ref.toString()));
        ArrayNode references = result.putArray("inboundBomReferences");
        readback.inboundBomReferences().forEach(reference -> references
                .addObject()
                .put("sourceKind", reference.sourceKind().name())
                .put(
                        "sourceItemRef",
                        reference.sourceItemRef() == null
                                ? null
                                : reference.sourceItemRef().toString())
                .put(
                        "sourceSkuRef",
                        reference.sourceSkuRef() == null
                                ? null
                                : reference.sourceSkuRef().toString())
                .put(
                        "sourceOptionValueRef",
                        reference.sourceOptionValueRef() == null
                                ? null
                                : reference.sourceOptionValueRef().toString())
                .put("targetRef", reference.targetRef().toString())
                .put("sourceCode", reference.sourceCode())
                .put("sourceName", reference.sourceName())
                .put("count", reference.count()));
        ArrayNode facts = result.putArray("dependentFacts");
        readback.inboundBomReferences().forEach(reference -> facts.addObject()
                .put("factKind", "INVENTORY_BOM")
                .put("factRef", reference.targetRef().toString())
                .put("count", reference.count()));
        return result;
    }

    private String inboundReferenceSummary(InventoryOwnerApi.CatalogVoidDependencyReadback readback) {
        return readback.inboundBomReferences().stream()
                .map(reference -> reference.sourceName() + " x" + reference.count())
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private void lockCatalogVoidSubjectRows(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND " + ownerColumn
                        + "=? ORDER BY target_ref FOR UPDATE",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        jdbc.query(
                "SELECT bom_ref FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND " + ownerColumn
                        + "=? ORDER BY bom_ref FOR UPDATE",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        List<UUID> ownedTargetRefs = jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND " + ownerColumn
                        + "=? ORDER BY target_ref",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        if (ownedTargetRefs.isEmpty()) return;
        String placeholders = String.join(",", Collections.nCopies(ownedTargetRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.addAll(ownedTargetRefs.stream().map(UUID::toString).toList());
        jdbc.query(
                "SELECT bom.bom_ref FROM inventory.stock_bom bom CROSS JOIN LATERAL jsonb_array_elements("
                        + "CASE WHEN jsonb_typeof(bom.rows)='array' THEN bom.rows ELSE '[]'::jsonb END) e(entry) "
                        + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' AND "
                        + "COALESCE(e.entry->>'targetRef',e.entry->>'componentTargetRef') IN (" + placeholders + ") "
                        + "ORDER BY bom.bom_ref FOR UPDATE",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                arguments.toArray());
    }

    private long countActiveOwnedDefinitions(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        Long count = jdbc.queryForObject(
                "SELECT (SELECT COUNT(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED') + "
                        + "(SELECT COUNT(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED')",
                Long.class,
                scope,
                brand,
                subject.ref(),
                scope,
                brand,
                subject.ref());
        return count == null ? 0L : count;
    }

    @Override
    public JsonNode readCatalogInventorySummary(
            String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        requireCatalogDefinitionDataNodeType(dataNodeType);
        requireScope(scope, brand);
        return inventoryDeductionSummaries(
                scope,
                brand,
                requestId,
                uuidArray(request == null ? null : request.path("itemRefs"), "itemRefs"),
                uuidArray(request == null ? null : request.path("productSkuRefs"), "productSkuRefs"));
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode readCatalogInventoryConsumptionTargetCandidates(
            String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        requireCatalogDefinitionDataNodeType(dataNodeType);
        requireScope(scope, brand);
        return consumptionTargetCandidates(scope, brand, request, requestId);
    }

    @Override
    @Transactional
    public JsonNode ensureCatalogInventoryTarget(
            String scope,
            String brand,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return ensureCatalogInventoryTargetCore(scope, brand, request, requestId, idempotencyKey, () -> {
            requireCatalogDefinitionDataNodeType(dataNodeType);
            requireCatalogDefinitionOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    dataNodeType,
                    scope,
                    CatalogTargetCapability.forDataNodeType(dataNodeType),
                    ownerScopeGrant);
        });
    }

    @Override
    @Transactional
    public JsonNode ensureCatalogInventoryTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", CATALOG_ITEM_SAVE_REQUIREMENT);
        return ensureCatalogInventoryTargetCore(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    private JsonNode ensureCatalogInventoryTargetCore(
            String scope,
            String brand,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        requireScope(scope, brand);
        authorization.run();
        UUID itemRef = requiredOpaqueRef(request, "itemRef");
        UUID productSkuRef = optionalOpaqueRef(request, "productSkuRef");
        lockCatalogItemRefs(List.of(itemRef));
        lockProductSkuRefs(productSkuRef == null ? List.of() : List.of(productSkuRef));
        String itemCode = optional(request, "itemCode");
        String skuCode = optional(request, "skuCode");
        String mode = required(request, "mode");
        String measureMode = required(request, "measureMode");
        if (!Set.of("COUNTED", "WEIGHED").contains(measureMode))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "measureMode is not supported");
        if (!Set.of("DIRECT", "BOM").contains(mode)) {
            throw new InventoryOwnerApi.Problem(
                    ("VALIDATION_ERROR"),
                    (422),
                    /* format-wrap */
                    ("库存对象只能由独立库存控制或 BOM 规则创建"));
        }
        String targetRef = optional(request, "targetRef");
        if (targetRef != null && !targetRef.isBlank()) {
            TargetRow existing = target(scope, brand, targetRef);
            if (!itemRef.equals(existing.itemRef())
                    || !java.util.Objects.equals(productSkuRef, existing.productSkuRef())) {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存对象身份与商品/SKU 引用不一致"));
            }
            if (request.path("configuration").isObject()
                    && request.path("configuration").size() > 0) {
                if (!request.has("expectedVersion"))
                    throw new InventoryOwnerApi.Problem(
                            "VALIDATION_ERROR", 422, "inventory target version is required");
                long expected = requiredLong(request, "expectedVersion");
                ObjectNode configuration = json(existing.configuration()).isObject()
                        ? (ObjectNode) json(existing.configuration()).deepCopy()
                        : mapper.createObjectNode();
                configuration.setAll((ObjectNode) request.path("configuration"));
                configuration.put("mode", mode);
                if (!configuration.has("allowNegative")) configuration.put("allowNegative", false);
                InventoryOwnerApi.UnitSnapshot consumption = consumptionUnitSnapshot(existing.ref());
                InventoryOwnerApi.CountingUnitConfiguration counting =
                        countingUnitConfiguration(configuration, consumption);
                writeCountingConfiguration(configuration, counting);
                InventoryOwnerApi.UnitSnapshot countingSnapshot = counting.countingUnitSnapshot();
                if (jdbc.update(
                                "UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),"
                                        + "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,"
                                        + "counting_unit_dimension=?,counting_unit_precision=?,"
                                        + "counting_unit_conversion_factor=?,version=version+1,updated_at_epoch_mil"
                                        + "lis=? WHERE data_node_ref=? "
                                        + "AND "
                                        + "brand_ref=? AND target_ref=? AND version=?",
                                canonical(configuration),
                                countingSnapshot == null ? null : countingSnapshot.unitRef(),
                                countingSnapshot == null ? null : countingSnapshot.code(),
                                countingSnapshot == null ? null : countingSnapshot.name(),
                                countingSnapshot == null ? null : countingSnapshot.unitDimension(),
                                countingSnapshot == null ? null : countingSnapshot.precision(),
                                counting.conversionFactor(),
                                time.currentEpochMillis(),
                                scope,
                                brand,
                                existing.ref(),
                                expected)
                        != 1) {
                    throw new InventoryOwnerApi.Problem(("VERSION_CONFLICT"), (409), ("库存对象版本已变化"));
                }
                return mapper.createObjectNode()
                        .put("targetRef", targetRef)
                        .put("version", expected + 1)
                        .put("created", false);
            }
            return mapper.createObjectNode()
                    .put("targetRef", targetRef)
                    .put("version", existing.version())
                    .put("created", false);
        }
        InventoryOwnerApi.UnitSnapshot consumptionUnit =
                requiredUnitSnapshot(request.path("consumptionUnitSnapshot"), "consumptionUnitSnapshot");
        ObjectNode configuration = request.path("configuration").isObject()
                ? (ObjectNode) request.path("configuration").deepCopy()
                : mapper.createObjectNode();
        configuration.put("mode", mode);
        if (!configuration.has("allowNegative")) configuration.put("allowNegative", false);
        InventoryOwnerApi.CountingUnitConfiguration countingUnit =
                countingUnitConfiguration(configuration, consumptionUnit);
        writeCountingConfiguration(configuration, countingUnit);
        int inserted = jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,consumption"
                        + "_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                        + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                        + "counting_unit_precision,counting_unit_conversion_factor,configuration,balance,version,"
                        + "definition_status,created_at_epoch_millis,updated_at_epoch_millis)"
                        + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),0,1,'ENABLED',?,?)"
                        + " ON CONFLICT DO NOTHING",
                UUID.randomUUID(),
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
                countingUnit.countingUnitSnapshot() == null
                        ? null
                        : countingUnit.countingUnitSnapshot().unitRef(),
                countingUnit.countingUnitSnapshot() == null
                        ? null
                        : countingUnit.countingUnitSnapshot().code(),
                countingUnit.countingUnitSnapshot() == null
                        ? null
                        : countingUnit.countingUnitSnapshot().name(),
                countingUnit.countingUnitSnapshot() == null
                        ? null
                        : countingUnit.countingUnitSnapshot().unitDimension(),
                countingUnit.countingUnitSnapshot() == null
                        ? null
                        : countingUnit.countingUnitSnapshot().precision(),
                countingUnit.conversionFactor(),
                canonical(configuration),
                time.currentEpochMillis(),
                time.currentEpochMillis());
        TargetRow created = targetByIdentity(scope, brand, itemRef, productSkuRef);
        return mapper.createObjectNode()
                .put("targetRef", created.ref().toString())
                .put("version", created.version())
                .put("created", inserted == 1);
    }

    @Override
    @Transactional
    public JsonNode saveCatalogProductBom(
            String scope,
            String brand,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return saveCatalogProductBomCore(scope, brand, request, requestId, idempotencyKey, () -> {
            requireCatalogDefinitionDataNodeType(dataNodeType);
            requireCatalogDefinitionOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    dataNodeType,
                    scope,
                    CatalogTargetCapability.forDataNodeType(dataNodeType),
                    ownerScopeGrant);
        });
    }

    @Override
    @Transactional
    public JsonNode saveCatalogProductBom(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", CATALOG_ITEM_SAVE_REQUIREMENT);
        return saveCatalogProductBomCore(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Override
    @Transactional
    public CatalogItemSaveReadback ensureCatalogItemSaveTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveEnsureTargetCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", CATALOG_ITEM_SAVE_REQUIREMENT);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        requireCatalogDefinitionDataNodeType(scope.dataNodeType());
        ObjectNode request = canonicalSaveRequest(command == null ? null : command.canonicalRequestJson());
        String receiptKey =
                catalogSaveReceiptKey(idempotencyKey, "ensureCatalogInventoryTarget", command.canonicalRequestJson());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        recheckCatalogItemSaveTargetBeforeReceipt(dataNodeRef, scope.brandRef(), request);
        CatalogItemSaveReadback replay = replayTyped(
                dataNodeRef, receiptKey, "ensureCatalogInventoryTarget", receiptRequest, CatalogItemSaveReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            CatalogItemSaveReadback result = new CatalogItemSaveReadback(canonical(envelope(
                    context.requestId(),
                    ensureCatalogInventoryTargetCore(
                            dataNodeRef,
                            scope.brandRef(),
                            request,
                            context.requestId(),
                            idempotencyKey,
                            () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType())))));
            saveTypedReceipt(dataNodeRef, receiptKey, "ensureCatalogInventoryTarget", receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional
    public CatalogItemSaveReadback saveCatalogItemProductBom(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveBomCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", CATALOG_ITEM_SAVE_REQUIREMENT);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        requireCatalogDefinitionDataNodeType(scope.dataNodeType());
        ObjectNode request = canonicalSaveRequest(command == null ? null : command.canonicalRequestJson());
        String receiptKey =
                catalogSaveReceiptKey(idempotencyKey, "saveCatalogProductBom", command.canonicalRequestJson());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        recheckCatalogItemSaveBomBeforeReceipt(dataNodeRef, scope.brandRef(), request);
        CatalogItemSaveReadback replay = replayTyped(
                dataNodeRef, receiptKey, "saveCatalogProductBom", receiptRequest, CatalogItemSaveReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            CatalogItemSaveReadback result = new CatalogItemSaveReadback(canonical(envelope(
                    context.requestId(),
                    saveCatalogProductBomCore(
                            dataNodeRef,
                            scope.brandRef(),
                            request,
                            context.requestId(),
                            idempotencyKey,
                            () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType())))));
            saveTypedReceipt(dataNodeRef, receiptKey, "saveCatalogProductBom", receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional
    public CatalogItemSaveReadback replaceCatalogInventoryRules(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogInventoryRulesReplaceCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", CATALOG_ITEM_SAVE_REQUIREMENT);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        requireCatalogDefinitionDataNodeType(scope.dataNodeType());
        if (command == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog inventory rules command is required");
        ObjectNode request = canonicalSaveRequest(command.canonicalRequestJson());
        String canonicalRequest = canonical(request);
        String receiptKey = catalogSaveReceiptKey(idempotencyKey, "replaceCatalogInventoryRules", canonicalRequest);
        JsonNode receiptRequest = typedReceiptRequest(
                new CatalogInventoryRulesReplaceCommand(canonicalRequest), dataNodeRef, scope.brandRef());
        CatalogItemSaveReadback replay = replayTyped(
                dataNodeRef, receiptKey, "replaceCatalogInventoryRules", receiptRequest, CatalogItemSaveReadback.class);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result = replaceCatalogInventoryRulesCore(
                    dataNodeRef, scope.brandRef(), request, context.requestId(), scope.dataNodeType());
            CatalogItemSaveReadback readback = new CatalogItemSaveReadback(canonical(result));
            saveTypedReceipt(dataNodeRef, receiptKey, "replaceCatalogInventoryRules", receiptRequest, readback);
            return readback;
        }
    }

    @Override
    @Transactional
    public CatalogMaterialStockTargetReadback resolveCatalogMaterialStockTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID materialItemRef) {
        CatalogAuthorizationScope scope = requireCatalogOrderOptionDefinitionContext(context);
        if (materialItemRef == null) {
            throw new InventoryOwnerApi.Problem(
                    "INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL",
                    422,
                    /* format-wrap */
                    "扣料原材料必须选择已有库存对象的商品");
        }
        lockCatalogItemRefs(List.of(materialItemRef));
        List<UUID> targetRefs = jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                        + "AND item_ref=? ORDER BY target_ref FOR UPDATE",
                statement -> {
                    statement.setString(1, scope.dataNodeId().toString());
                    statement.setString(2, scope.brandRef());
                    statement.setObject(3, materialItemRef);
                },
                (result, rowNumber) -> result.getObject(1, UUID.class));
        if (targetRefs.isEmpty()) {
            throw new InventoryOwnerApi.Problem(
                    "INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL",
                    422,
                    /* format-wrap */
                    "扣料原材料必须先建立库存对象");
        }
        if (targetRefs.size() != 1) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "扣料原材料的库存对象无法唯一确定");
        }
        TargetRow target = target(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                targetRefs.getFirst().toString());
        return new CatalogMaterialStockTargetReadback(
                materialItemRef, targetRefs.getFirst(), consumptionUnitSnapshot(target.ref()));
    }

    @Override
    @Transactional
    public List<CatalogMaterialStockTargetReadback> resolveCatalogMaterialStockTargets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, Collection<UUID> materialItemRefs) {
        CatalogAuthorizationScope scope = requireCatalogOrderOptionDefinitionContext(context);
        List<UUID> refs = materialItemRefs == null ? List.of() : new ArrayList<>(new LinkedHashSet<>(materialItemRefs));
        if (refs.isEmpty()) return List.of();
        if (refs.stream().anyMatch(java.util.Objects::isNull))
            throw new InventoryOwnerApi.Problem(
                    "INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL",
                    422,
                    /* format-wrap */
                    "扣料原材料必须选择已有库存对象的商品");
        String dataNodeRef = scope.dataNodeId().toString();
        lockCatalogItemRefs(refs);
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, List<CatalogMaterialTargetRow>> rowsByItem = new LinkedHashMap<>();
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(scope.brandRef());
        args.addAll(refs);
        jdbc.query(
                        "SELECT"
                                + " item_ref,target_ref,consumption_unit_ref,consumption_unit_code,"
                                + " consumption_unit_name,"
                                + "consumption_unit_dimension,consumption_unit_precision"
                                + " FROM inventory.stock_target WHERE data_node_ref=? AND"
                                + " brand_ref=? AND item_ref IN (" + placeholders + ") "
                                + "ORDER BY item_ref,target_ref",
                        (result, row) -> new CatalogMaterialTargetRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                requiredUnitSnapshot(result, 3)),
                        args.toArray())
                .forEach(row -> rowsByItem
                        .computeIfAbsent(row.itemRef(), ignored -> new ArrayList<>())
                        .add(row));
        List<CatalogMaterialStockTargetReadback> result = new ArrayList<>();
        for (UUID ref : refs) {
            List<CatalogMaterialTargetRow> rows = rowsByItem.getOrDefault(ref, List.of());
            if (rows.isEmpty())
                throw new InventoryOwnerApi.Problem(
                        "INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL",
                        422,
                        /* format-wrap */
                        "扣料原材料必须先建立库存对象");
            if (rows.size() != 1)
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "扣料原材料的库存对象无法唯一确定");
            CatalogMaterialTargetRow row = rows.getFirst();
            result.add(new CatalogMaterialStockTargetReadback(ref, row.targetRef(), row.consumptionUnitSnapshot()));
        }
        return List.copyOf(result);
    }

    @Override
    @Transactional
    public OptionValueBomDeleteReadback deleteCatalogOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOptionValueBomDeleteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireCatalogOrderOptionDefinitionContext(context);
        List<UUID> optionValueRefs = command == null || command.optionValueRefs() == null
                ? List.of()
                : command.optionValueRefs().stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        if (optionValueRefs.isEmpty()) return new OptionValueBomDeleteReadback(List.of(), 0L);
        lockCatalogOptionValueRefs(optionValueRefs);
        String placeholders = String.join(",", java.util.Collections.nCopies(optionValueRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope.dataNodeId().toString());
        arguments.add(scope.brandRef());
        arguments.addAll(optionValueRefs);
        int deleted = jdbc.update(
                "DELETE FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND option_value_ref IN ("
                        + placeholders + ")",
                arguments.toArray());
        return new OptionValueBomDeleteReadback(optionValueRefs, deleted);
    }

    @Override
    @Transactional
    public OptionValueBomCopyReadback copyCatalogOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOptionValueBomCopyCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTemporaryPromotionOptionBomContext(context);
        if (command == null
                || command.sourceItemRef() == null
                || command.targetItemRef() == null
                || command.targetItemCode() == null
                || command.targetItemCode().isBlank()) {
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    /* format-wrap */
                    "临时商品转正的点单选项扣料信息不完整");
        }
        List<UUID> optionValueRefs = command.optionValueRefs() == null
                ? List.of()
                : command.optionValueRefs().stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        if (optionValueRefs.isEmpty()) return new OptionValueBomCopyReadback(List.of(), 0L);
        CatalogOptionValueBomCopyCommand normalizedCommand = new CatalogOptionValueBomCopyCommand(
                command.sourceItemRef(), command.targetItemRef(), command.targetItemCode(), optionValueRefs);
        String dataNodeRef = scope.dataNodeId().toString();
        String receiptKey = requireIdempotencyKey(idempotencyKey) + "|copyCatalogOptionValueBoms";
        JsonNode receiptRequest = typedReceiptRequest(normalizedCommand, dataNodeRef, scope.brandRef());
        OptionValueBomCopyReadback replay = replayTyped(
                dataNodeRef,
                receiptKey,
                "copyCatalogOptionValueBoms",
                receiptRequest,
                OptionValueBomCopyReadback.class);
        if (replay != null) return replay;
        lockCatalogItemRefs(List.of(command.sourceItemRef(), command.targetItemRef()));
        lockCatalogOptionValueRefs(optionValueRefs);
        String placeholders = String.join(",", java.util.Collections.nCopies(optionValueRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope.dataNodeId().toString());
        arguments.add(scope.brandRef());
        arguments.add(command.sourceItemRef());
        arguments.addAll(optionValueRefs);
        List<CatalogBomRow> sourceRows = jdbc.query(
                "SELECT product_sku_ref,option_value_ref,sku_code,option_value_code,version,rows::text FROM "
                        + "inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                        + "AND product_sku_ref IS NULL AND option_value_ref IN (" + placeholders + ") "
                        + "ORDER BY option_value_ref FOR UPDATE",
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
        for (CatalogBomRow source : sourceRows) {
            int copied = jdbc.update(
                    "INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,optio"
                            + "n_value_ref,"
                            + "item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) VALUES(?,"
                            + "?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?) "
                            + "ON CONFLICT (data_node_ref,brand_ref,item_ref,(COALESCE(product_sku_ref,'00000000-00"
                            + "00-0000-0000-000000000000'::uuid)),"
                            + "(COALESCE(option_value_ref,'00000000-0000-0000-0000-000000000000'::uuid))) "
                            + "WHERE definition_status='ENABLED' DO NOTHING",
                    UUID.randomUUID(),
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    command.targetItemRef(),
                    null,
                    source.optionValueRef(),
                    command.targetItemCode(),
                    null,
                    source.optionValueCode(),
                    1L,
                    source.rows(),
                    time.currentEpochMillis());
            if (copied != 1) {
                throw new InventoryOwnerApi.Problem(
                        "VERSION_CONFLICT",
                        409,
                        /* format-wrap */
                        "转正商品的点单选项扣料信息已变化");
            }
        }
        OptionValueBomCopyReadback result = new OptionValueBomCopyReadback(optionValueRefs, sourceRows.size());
        saveTypedReceipt(dataNodeRef, receiptKey, "copyCatalogOptionValueBoms", receiptRequest, result);
        return result;
    }

    private ObjectNode canonicalSaveRequest(String canonicalRequestJson) {
        if (canonicalRequestJson == null || canonicalRequestJson.isBlank())
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "canonical inventory save request is required");
        try {
            JsonNode parsed = mapper.readTree(canonicalRequestJson);
            if (!parsed.isObject())
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "canonical inventory save request must be an object");
            return (ObjectNode) parsed;
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "canonical inventory save request is invalid", failure);
        }
    }

    /**
     * The catalog owner sends one derived owner set. This method is deliberately the only inventory write used by a
     * catalog whole-save: all identity, mode, component and lifecycle decisions happen before either table is changed.
     */
    private JsonNode replaceCatalogInventoryRulesCore(
            String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        UUID itemRef = requiredOpaqueRef(request, "itemRef");
        String itemCode = required(request, "itemCode");
        String measureMode = optional(request, "measureMode");
        if (measureMode == null || measureMode.isBlank()) measureMode = "COUNTED";
        if (!Set.of("COUNTED", "WEIGHED").contains(measureMode))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "measureMode is not supported");
        JsonNode nodesNode = request.path("nodes");
        if (!nodesNode.isArray())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "inventoryRules.nodes must be an array");

        LinkedHashMap<String, ObjectNode> submitted = new LinkedHashMap<>();
        LinkedHashMap<String, OwnerIdentity> identities = new LinkedHashMap<>();
        for (JsonNode raw : nodesNode) {
            if (!(raw instanceof ObjectNode node))
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "inventoryRules.nodes must contain objects");
            OwnerIdentity identity = parseRuleOwner(node.path("owner"), itemRef);
            if (submitted.putIfAbsent(identity.key(), node) != null)
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "同一库存 owner 不能重复提交");
            identities.put(identity.key(), identity);
            validateSubmittedRule(node, identity);
        }

        // The standard catalog-item lifecycle lock serializes every inventory-rule write for this item with catalog
        // lifecycle work.  Do not take a second namespace-specific lock for the same item: it adds a database round
        // trip without protecting another fact.  SKU/option locks still protect the distinct owner identities.
        lockCatalogItemRefs(List.of(itemRef));
        lockProductSkuRefs(
                identities.values().stream().map(OwnerIdentity::productSkuRef).toList());
        lockCatalogOptionValueRefs(
                identities.values().stream().map(OwnerIdentity::optionValueRef).toList());
        List<RuleFact> targets = loadRuleTargetFacts(scope, brand, itemRef);
        List<RuleFact> boms = loadRuleBomFacts(scope, brand, itemRef);
        Map<UUID, TargetRow> bomComponentTargets = loadSubmittedBomComponentTargets(scope, brand, submitted);
        ResolvedBomTargets resolvedBomTargets =
                ResolvedBomTargets.load(jdbc, scope, brand, submittedBomTargetRefs(submitted));
        Map<String, RuleFact> targetByIdentity = factsByIdentity(targets);
        Map<String, RuleFact> bomByIdentity = factsByIdentity(boms);
        LinkedHashSet<String> allKeys = new LinkedHashSet<>();
        allKeys.addAll(targetByIdentity.keySet());
        allKeys.addAll(bomByIdentity.keySet());
        allKeys.addAll(submitted.keySet());

        LinkedHashSet<UUID> targetRefsToDisable = new LinkedHashSet<>();
        LinkedHashSet<UUID> bomRefsToDisable = new LinkedHashSet<>();
        for (String key : allKeys) {
            ObjectNode node = submitted.get(key);
            String mode = node == null ? "NONE" : node.path("mode").asText("NONE");
            RuleFact target = targetByIdentity.get(key);
            RuleFact bom = bomByIdentity.get(key);
            if (target != null && target.enabled() && !"DIRECT".equals(mode)) targetRefsToDisable.add(target.ref());
            if (bom != null && bom.enabled() && !"BOM".equals(mode)) bomRefsToDisable.add(bom.ref());
            if ("DIRECT".equals(mode) && bom != null && bom.enabled()) bomRefsToDisable.add(bom.ref());
            if ("BOM".equals(mode) && target != null && target.enabled()) targetRefsToDisable.add(target.ref());
        }
        disableTargetDefinitions(scope, brand, targetRefsToDisable);
        disableBomDefinitions(scope, brand, bomRefsToDisable);

        for (String key : allKeys) {
            OwnerIdentity identity = identities.get(key);
            if (identity == null) {
                RuleFact fact = targetByIdentity.get(key);
                if (fact == null) fact = bomByIdentity.get(key);
                identity = fact.owner();
            }
            RuleFact target = targetByIdentity.get(key);
            RuleFact bom = bomByIdentity.get(key);
            if (target != null && bom != null && target.enabled() && bom.enabled()) {
                String detail = "同一库存 owner 不能同时存在两种扣减方式";
                throw new InventoryOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", 409, detail);
            }
            ObjectNode node = submitted.get(key);
            String requestedMode = node == null ? "NONE" : node.path("mode").asText("NONE");
            String currentMode =
                    target != null && target.enabled() ? "DIRECT" : bom != null && bom.enabled() ? "BOM" : null;
            if (currentMode != null && !currentMode.equals(requestedMode))
                enforceModeSwitchGuard(scope, brand, identity, currentMode, target, boms, targets);
            if (node != null) validateExpectedDefinitionVersion(node, requestedMode, target, bom);
            if ("DIRECT".equals(requestedMode)) {
                UnitSnapshot supplied =
                        requiredUnitSnapshot(node.path("consumptionUnitSnapshot"), "consumptionUnitSnapshot");
                if (target != null
                        && target.enabled()
                        && target.consumptionUnit() != null
                        && !target.consumptionUnit().unitRef().equals(supplied.unitRef())) {
                    String detail = "基础计量单位变更会改变既有库存对象的消费单位";
                    throw new InventoryOwnerApi.Problem("CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED", 409, detail);
                }
                validateDirectConfiguration(node.path("directConfiguration"), supplied);
            } else if ("BOM".equals(requestedMode)) {
                validateBomLines(
                        identity,
                        node.path("bom").path("lines"),
                        bom == null ? null : bom.rows(),
                        bomComponentTargets,
                        resolvedBomTargets);
            } else if (!"NONE".equals(requestedMode)) {
                String detail = "库存扣减方式不在当前契约闭集内";
                throw new InventoryOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", 422, detail);
            }
        }

        for (String key : allKeys) {
            OwnerIdentity identity = identities.get(key);
            if (identity == null) {
                RuleFact fact = targetByIdentity.get(key);
                if (fact == null) fact = bomByIdentity.get(key);
                identity = fact.owner();
            }
            ObjectNode node = submitted.get(key);
            String mode = node == null ? "NONE" : node.path("mode").asText("NONE");
            RuleFact target = targetByIdentity.get(key);
            RuleFact bom = bomByIdentity.get(key);
            if ("DIRECT".equals(mode)) {
                saveDirectDefinition(scope, brand, itemCode, measureMode, identity, target, node);
            } else if ("BOM".equals(mode)) {
                saveBomDefinition(scope, brand, itemCode, identity, bom, node, bomComponentTargets, resolvedBomTargets);
            }
        }
        boolean noInventoryDefinitions = submitted.values().stream()
                .allMatch(node -> "NONE".equals(node.path("mode").asText("NONE")));
        if (noInventoryDefinitions && targets.isEmpty() && boms.isEmpty()) {
            ObjectNode empty = mapper.createObjectNode().put("itemRef", itemRef.toString());
            empty.putObject("inventoryRules").putArray("nodes");
            return envelope(requestId, empty);
        }
        boolean hasActiveDirectDefinitions = allKeys.stream().anyMatch(key -> {
            ObjectNode node = submitted.get(key);
            return node != null && "DIRECT".equals(node.path("mode").asText("NONE"));
        });
        return readCatalogInventoryDefinition(
                scope, brand, itemRef.toString(), requestId, bomComponentTargets, hasActiveDirectDefinitions);
    }

    private OwnerIdentity parseRuleOwner(JsonNode ownerNode, UUID itemRef) {
        if (ownerNode == null || !ownerNode.isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory rule owner is required");
        String type = ownerNode.path("ownerType").asText("");
        UUID submittedItem = requiredOpaqueRef((ObjectNode) ownerNode, "itemRef");
        if (!itemRef.equals(submittedItem)) {
            String detail = "库存 owner 不属于当前商品";
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, detail);
        }
        UUID sku = optionalOpaqueRef((ObjectNode) ownerNode, "productSkuRef");
        UUID option = optionalOpaqueRef((ObjectNode) ownerNode, "optionValueRef");
        if (!Set.of("ITEM", "SKU", "OPTION_VALUE").contains(type)) {
            String detail = "库存 owner 类型不被允许";
            throw new InventoryOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", 422, detail);
        }
        if ("ITEM".equals(type) && (sku != null || option != null)
                || "SKU".equals(type) && (sku == null || option != null)
                || "OPTION_VALUE".equals(type) && (sku != null || option == null)) {
            String detail = "库存 owner 引用与 ownerType 不一致";
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, detail);
        }
        return new OwnerIdentity(
                type,
                submittedItem,
                sku,
                option,
                ownerNode.path("itemCode").asText(null),
                ownerNode.path("skuCode").asText(null),
                ownerNode.path("optionValueCode").asText(null));
    }

    private void validateSubmittedRule(JsonNode node, OwnerIdentity identity) {
        String mode = node.path("mode").asText("");
        if (!Set.of("NONE", "DIRECT", "BOM").contains(mode)) {
            String detail = "库存扣减方式不被允许";
            throw new InventoryOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", 422, detail);
        }
        if ("OPTION_VALUE".equals(identity.ownerType()) && "DIRECT".equals(mode)) {
            String detail = "点单选项值不能直接扣本品库存";
            throw new InventoryOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", 422, detail);
        }
        if ("DIRECT".equals(mode) && !node.path("directConfiguration").isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "直接扣本品库存必须提供配置");
        if ("BOM".equals(mode) && !node.path("bom").isObject())
            throw new InventoryOwnerApi.Problem("INVENTORY_BOM_EMPTY", 422, "BOM 必须提供非空组件行");
    }

    private void validateExpectedDefinitionVersion(JsonNode node, String mode, RuleFact target, RuleFact bom) {
        if ("DIRECT".equals(mode) && target != null && target.enabled()) {
            JsonNode expected = node.get("expectedTargetVersion");
            if (expected == null || expected.isNull() || expected.asLong(-1) != target.version())
                throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        }
        if ("BOM".equals(mode) && bom != null && bom.enabled()) {
            JsonNode expected = node.get("expectedBomVersion");
            if (expected == null || expected.isNull() || expected.asLong(-1) != bom.version())
                throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "商品 BOM 版本已变化");
        }
    }

    private void validateDirectConfiguration(JsonNode raw, InventoryOwnerApi.UnitSnapshot consumption) {
        if (!(raw instanceof ObjectNode configuration))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "directConfiguration is required");
        if (!configuration.has("allowNegative")
                || !configuration.path("allowNegative").isBoolean())
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "directConfiguration.allowNegative must be boolean");
        countingUnitConfiguration(configuration, consumption);
    }

    private void validateBomLines(
            OwnerIdentity owner,
            JsonNode rawLines,
            JsonNode existingRows,
            Map<UUID, TargetRow> componentTargets,
            ResolvedBomTargets resolvedTargets) {
        if (!rawLines.isArray() || rawLines.isEmpty())
            throw new InventoryOwnerApi.Problem("INVENTORY_BOM_EMPTY", 422, "BOM 不能为空");
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (JsonNode rawLine : rawLines) {
            if (!(rawLine instanceof ObjectNode line))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行必须为对象");
            UUID targetRef = requiredBomTargetRef(line);
            if (!refs.add(targetRef)) {
                String detail = "BOM 组件不能重复";
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, detail);
            }
            String sign = normalizeLineSign(line.path("lineSign").asText(""));
            if (!Set.of("POSITIVE", "NEGATIVE").contains(sign))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行方向无效");
            BigDecimal quantity = decimalValue(line, "quantity");
            if (quantity.signum() <= 0) {
                String detail = "BOM 行实际用量必须为正数";
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, detail);
            }
        }
        Set<UUID> existingRefs = existingBomTargetRefs(existingRows);
        for (UUID targetRef : refs) {
            TargetRow component = componentTargets.get(targetRef);
            if (component == null) {
                throw new InventoryOwnerApi.Problem(
                        "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                        422,
                        /* format-wrap */
                        "BOM 组件必须是当前范围内已有且可用的库存对象");
            }
            resolvedTargets.requireResolved(targetRef);
            if (!existingRefs.contains(targetRef)) {
                if (!"ENABLED".equals(component.definitionStatus())
                        || !component.componentEligible()
                        || component.consumptionUnitSnapshot() == null) {
                    throw new InventoryOwnerApi.Problem(
                            "INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE",
                            422,
                            /* format-wrap */
                            "BOM 组件必须是当前范围内已有且可用的库存对象");
                }
                resolvedTargets.requireNewAdmission(targetRef);
            }
            if (owner.itemRef().equals(component.itemRef())
                    && java.util.Objects.equals(owner.productSkuRef(), component.productSkuRef())) {
                String detail = "BOM 不能引用自身库存对象";
                throw new InventoryOwnerApi.Problem("INVENTORY_BOM_SELF_REFERENCE", 422, detail);
            }
        }
    }

    private Map<UUID, TargetRow> loadSubmittedBomComponentTargets(
            String scope, String brand, Map<String, ObjectNode> submitted) {
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (ObjectNode node : submitted.values()) {
            if (!"BOM".equals(node.path("mode").asText("NONE"))) continue;
            JsonNode lines = node.path("bom").path("lines");
            if (!lines.isArray()) continue;
            for (JsonNode raw : lines) {
                if (raw instanceof ObjectNode line) refs.add(requiredBomTargetRef(line));
            }
        }
        return loadTargetsByRefs(scope, brand, refs, false, false);
    }

    private List<UUID> submittedBomTargetRefs(Map<String, ObjectNode> submitted) {
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (ObjectNode node : submitted.values()) {
            if (!"BOM".equals(node.path("mode").asText("NONE"))) continue;
            JsonNode lines = node.path("bom").path("lines");
            if (!lines.isArray()) continue;
            for (JsonNode raw : lines) {
                if (!(raw instanceof ObjectNode line))
                    throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行必须为对象");
                refs.add(requiredBomTargetRef(line));
            }
        }
        return List.copyOf(refs);
    }

    private static UUID requiredBomTargetRef(ObjectNode line) {
        String target = optional(line, "targetRef");
        String legacy = optional(line, "componentTargetRef");
        if ((target == null || target.isBlank()) && (legacy == null || legacy.isBlank())) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "BOM 组件必须选择已有库存对象");
        }
        if (target != null && !target.isBlank() && legacy != null && !legacy.isBlank() && !target.equals(legacy)) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "BOM 组件引用不一致");
        }
        try {
            return UUID.fromString(target == null || target.isBlank() ? legacy : target);
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "BOM 组件库存对象不存在",
                    failure);
        }
    }

    private static Set<UUID> existingBomTargetRefs(JsonNode existingRows) {
        if (existingRows == null || !existingRows.isArray()) return Set.of();
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        existingRows.forEach(raw -> {
            if (!(raw instanceof ObjectNode line)) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        500,
                        /* format-wrap */
                        "库存 BOM 行不是有效对象");
            }
            refs.add(requiredBomTargetRef(line));
        });
        return Set.copyOf(refs);
    }

    private static JsonNode existingBomLine(JsonNode existingRows, UUID targetRef) {
        if (existingRows == null || !existingRows.isArray()) return null;
        for (JsonNode raw : existingRows) {
            if (!(raw instanceof ObjectNode line)) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        500,
                        /* format-wrap */
                        "库存 BOM 行不是有效对象");
            }
            if (targetRef.equals(requiredBomTargetRef(line))) return line;
        }
        return null;
    }

    private void enforceModeSwitchGuard(
            String scope,
            String brand,
            OwnerIdentity owner,
            String currentMode,
            RuleFact currentTarget,
            List<RuleFact> allBoms,
            List<RuleFact> allTargets) {
        long balance = currentTarget != null
                        && currentTarget.balance() != null
                        && currentTarget.balance().signum() != 0
                ? 1L
                : 0L;
        long ledger = 0L;
        long activeBomReference = 0L;
        if (currentTarget != null) {
            long[] counts = jdbc.queryForObject(
                    "SELECT "
                            + "(SELECT COUNT(*) FROM inventory.stock_ledger ledger JOIN inventory.stock_target target "
                            + "ON target.target_ref=ledger.target_ref WHERE ledger.target_ref=? "
                            + "AND target.data_node_ref=? AND target.brand_ref=?), "
                            + "(SELECT COUNT(*) FROM inventory.stock_bom bom CROSS JOIN LATERAL jsonb_array_elements("
                            + "CASE WHEN jsonb_typeof(bom.rows)='array' THEN bom.rows ELSE '[]'::jsonb END) line "
                            + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' "
                            + "AND line->>'targetRef'=?)",
                    (result, rowNumber) -> new long[] {result.getLong(1), result.getLong(2)},
                    currentTarget.ref(),
                    scope,
                    brand,
                    scope,
                    brand,
                    currentTarget.ref().toString());
            ledger = counts[0];
            activeBomReference = counts[1];
        }
        long historical = 0L;
        for (RuleFact fact : allTargets) if (fact.owner().key().equals(owner.key()) && !fact.enabled()) historical++;
        for (RuleFact fact : allBoms) if (fact.owner().key().equals(owner.key()) && !fact.enabled()) historical++;
        ObjectNode details = mapper.createObjectNode();
        ArrayNode blocking = details.putArray("blockingFacts");
        blocking.addObject().put("kind", "BALANCE").put("count", balance);
        blocking.addObject().put("kind", "LEDGER").put("count", ledger);
        blocking.addObject().put("kind", "BOM_REFERENCE").put("count", activeBomReference);
        blocking.addObject().put("kind", "HISTORICAL_DEFINITION").put("count", historical);
        if (balance > 0 || ledger > 0 || activeBomReference > 0 || historical > 0) {
            String detail = "库存扣减方式切换被既有库存事实阻断";
            throw new InventoryOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED", 409, detail, details);
        }
    }

    private void saveDirectDefinition(
            String scope,
            String brand,
            String itemCode,
            String measureMode,
            OwnerIdentity owner,
            RuleFact current,
            JsonNode node) {
        InventoryOwnerApi.UnitSnapshot supplied =
                requiredUnitSnapshot(node.path("consumptionUnitSnapshot"), "consumptionUnitSnapshot");
        ObjectNode configuration = normalizedDirectConfiguration(node.path("directConfiguration"));
        InventoryOwnerApi.UnitSnapshot consumption =
                current != null && current.consumptionUnit() != null ? current.consumptionUnit() : supplied;
        boolean componentEligible = node.path("componentEligible").asBoolean(false);
        InventoryOwnerApi.CountingUnitConfiguration counting = countingUnitConfiguration(configuration, consumption);
        writeCountingConfiguration(configuration, counting);
        String skuCode = owner.productSkuRef() == null ? null : owner.skuCode();
        if (current != null && current.enabled()) {
            boolean unchanged = Objects.equals(current.measureMode(), measureMode)
                    && current.componentEligible() == componentEligible
                    && Objects.equals(current.consumptionUnit(), consumption)
                    && Objects.equals(current.countingUnit(), counting.countingUnitSnapshot())
                    && (current.countingFactor() == null
                            ? counting.conversionFactor() == null
                            : counting.conversionFactor() != null
                                    && current.countingFactor().compareTo(counting.conversionFactor()) == 0)
                    && canonicalDirectConfiguration(json(current.configuration()), consumption)
                            .equals(configuration);
            if (unchanged) return;
            long next = current.version() + 1L;
            InventoryOwnerApi.UnitSnapshot stored =
                    current.consumptionUnit() == null ? consumption : current.consumptionUnit();
            InventoryOwnerApi.UnitSnapshot countingSnapshot = counting.countingUnitSnapshot();
            jdbc.update(
                    "UPDATE inventory.stock_target SET measure_mode=?,inventory_mode='DIRECT',"
                            + "configuration=CAST(? AS JSONB),"
                            + "counting_unit_ref=?,counting_unit_code=?,counting_unit_name=?,counting_unit_dimension=?,"
                            + "counting_unit_precision=?,counting_unit_conversion_factor=?,component_eligible=?,"
                            + "version=?,updated_at_epoch_millis=? "
                            + "WHERE target_ref=? AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'",
                    measureMode,
                    canonical(configuration),
                    countingSnapshot == null ? null : countingSnapshot.unitRef(),
                    countingSnapshot == null ? null : countingSnapshot.code(),
                    countingSnapshot == null ? null : countingSnapshot.name(),
                    countingSnapshot == null ? null : countingSnapshot.unitDimension(),
                    countingSnapshot == null ? null : countingSnapshot.precision(),
                    counting.conversionFactor(),
                    componentEligible,
                    next,
                    time.currentEpochMillis(),
                    current.ref(),
                    scope,
                    brand);
            return;
        }
        InventoryOwnerApi.UnitSnapshot countingSnapshot = counting.countingUnitSnapshot();
        jdbc.update(
                "INSERT INTO inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,"
                        + "item_code,sku_code,measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,"
                        + "consumption_unit_name,"
                        + "consumption_unit_dimension,consumption_unit_precision,counting_unit_ref,counting_unit_code,"
                        + "counting_unit_name,counting_unit_dimension,counting_unit_precision,"
                        + "counting_unit_conversion_factor,"
                        + "component_eligible,configuration,balance,version,definition_status,created_at_epoch_millis,"
                        + "updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),0,1,'ENABLED',?,?)",
                UUID.randomUUID(),
                scope,
                brand,
                owner.itemRef(),
                owner.productSkuRef(),
                itemCode,
                skuCode,
                measureMode,
                "DIRECT",
                consumption.unitRef(),
                consumption.code(),
                consumption.name(),
                consumption.unitDimension(),
                consumption.precision(),
                countingSnapshot == null ? null : countingSnapshot.unitRef(),
                countingSnapshot == null ? null : countingSnapshot.code(),
                countingSnapshot == null ? null : countingSnapshot.name(),
                countingSnapshot == null ? null : countingSnapshot.unitDimension(),
                countingSnapshot == null ? null : countingSnapshot.precision(),
                counting.conversionFactor(),
                componentEligible,
                canonical(configuration),
                time.currentEpochMillis(),
                time.currentEpochMillis());
    }

    private void saveBomDefinition(
            String scope,
            String brand,
            String itemCode,
            OwnerIdentity owner,
            RuleFact current,
            JsonNode node,
            Map<UUID, TargetRow> componentTargets,
            ResolvedBomTargets resolvedTargets) {
        ArrayNode normalized = normalizeBomLines(
                scope,
                brand,
                owner,
                node.path("bom").path("lines"),
                current == null ? null : current.rows(),
                componentTargets,
                resolvedTargets);
        String skuCode = owner.productSkuRef() == null ? null : owner.skuCode();
        String optionCode = owner.optionValueRef() == null ? null : owner.optionValueCode();
        if (current != null && current.enabled()) {
            if (current.rows() != null && current.rows().equals(normalized)) return;
            jdbc.update(
                    "UPDATE inventory.stock_bom SET rows=CAST(? AS JSONB),version=?,updated_at_epoch_millis=? "
                            + "WHERE bom_ref=? AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'",
                    canonical(normalized),
                    current.version() + 1L,
                    time.currentEpochMillis(),
                    current.ref(),
                    scope,
                    brand);
            return;
        }
        jdbc.update(
                "INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,"
                        + "option_value_ref,item_code,sku_code,option_value_code,version,rows,definition_status,"
                        + "updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,1,CAST(? AS JSONB),'ENABLED',?)",
                UUID.randomUUID(),
                scope,
                brand,
                owner.itemRef(),
                owner.productSkuRef(),
                owner.optionValueRef(),
                itemCode,
                skuCode,
                optionCode,
                canonical(normalized),
                time.currentEpochMillis());
    }

    private ArrayNode normalizeBomLines(
            String scope,
            String brand,
            OwnerIdentity owner,
            JsonNode rawLines,
            JsonNode existingRows,
            Map<UUID, TargetRow> componentTargets,
            ResolvedBomTargets resolvedTargets) {
        Map<UUID, JsonNode> oldLines = new LinkedHashMap<>();
        if (existingRows != null && existingRows.isArray())
            existingRows.forEach(line -> {
                if (!(line instanceof ObjectNode object)) {
                    throw new InventoryOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            500,
                            /* format-wrap */
                            "库存 BOM 行不是有效对象");
                }
                oldLines.put(requiredBomTargetRef(object), line);
            });
        Set<UUID> existingRefs = existingBomTargetRefs(existingRows);
        ArrayNode normalized = mapper.createArrayNode();
        rawLines.forEach(raw -> {
            if (!(raw instanceof ObjectNode line))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行必须为对象");
            UUID targetRef = requiredBomTargetRef(line);
            TargetRow component = componentTargets.get(targetRef);
            ObjectNode result = normalized
                    .addObject()
                    .put("targetRef", targetRef.toString())
                    .put("lineSign", normalizeLineSign(line.path("lineSign").asText("POSITIVE")))
                    .put("quantity", decimal(decimalValue(line, "quantity")));
            JsonNode old = oldLines.get(targetRef);
            if (existingRefs.contains(targetRef)) {
                if (old == null || !old.path("consumptionUnitSnapshot").isObject())
                    throw new InventoryOwnerApi.Problem(
                            "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED",
                            422,
                            /* format-wrap */
                            "既有 BOM 组件缺少单位快照");
                result.set(
                        "consumptionUnitSnapshot",
                        old.path("consumptionUnitSnapshot").deepCopy());
            } else {
                resolvedTargets.requireNewAdmission(targetRef);
                if (component == null || component.consumptionUnitSnapshot() == null)
                    throw new InventoryOwnerApi.Problem(
                            "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED",
                            422,
                            /* format-wrap */
                            "BOM 组件单位快照不完整");
                result.set("consumptionUnitSnapshot", mapper.valueToTree(component.consumptionUnitSnapshot()));
            }
        });
        return normalized;
    }

    private void disableTargetDefinitions(String scope, String brand, Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        List<UUID> ordered = refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        if (ordered.isEmpty()) return;
        List<Object> arguments = new ArrayList<>();
        arguments.add(time.currentEpochMillis());
        arguments.addAll(ordered);
        arguments.add(scope);
        arguments.add(brand);
        jdbc.update(
                "UPDATE inventory.stock_target SET definition_status='DISABLED',version=version+1,"
                        + "updated_at_epoch_millis=? "
                        + "WHERE target_ref IN ("
                        + String.join(",", Collections.nCopies(ordered.size(), "?"))
                        + ") AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'",
                arguments.toArray());
    }

    private void disableBomDefinitions(String scope, String brand, Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        List<UUID> ordered = refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        if (ordered.isEmpty()) return;
        List<Object> arguments = new ArrayList<>();
        arguments.add(time.currentEpochMillis());
        arguments.addAll(ordered);
        arguments.add(scope);
        arguments.add(brand);
        jdbc.update(
                "UPDATE inventory.stock_bom SET definition_status='DISABLED',version=version+1,"
                        + "updated_at_epoch_millis=? "
                        + "WHERE bom_ref IN ("
                        + String.join(",", Collections.nCopies(ordered.size(), "?"))
                        + ") AND data_node_ref=? AND brand_ref=? AND definition_status='ENABLED'",
                arguments.toArray());
    }

    private List<RuleFact> loadRuleTargetFacts(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                "SELECT target_ref,item_ref,product_sku_ref,version,balance,configuration::text,definition_status,"
                        + "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,"
                        + "consumption_unit_precision,counting_unit_ref,counting_unit_code,counting_unit_name,"
                        + "counting_unit_dimension,counting_unit_precision,counting_unit_conversion_factor,"
                        + "measure_mode,component_eligible "
                        + "FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                        + "ORDER BY product_sku_ref NULLS FIRST,target_ref FOR UPDATE",
                (result, rowNumber) -> {
                    OwnerIdentity owner = new OwnerIdentity(
                            result.getObject(3, UUID.class) == null ? "ITEM" : "SKU",
                            result.getObject(2, UUID.class),
                            result.getObject(3, UUID.class),
                            null,
                            null,
                            null,
                            null);
                    return new RuleFact(
                            result.getObject(1, UUID.class),
                            owner,
                            result.getLong(4),
                            result.getBigDecimal(5),
                            result.getString(6),
                            result.getString(7),
                            unitSnapshot(result, 8),
                            unitSnapshot(result, 13),
                            result.getBigDecimal(18),
                            null,
                            false,
                            result.getString(19),
                            result.getBoolean(20));
                },
                scope,
                brand,
                itemRef);
    }

    private List<RuleFact> loadRuleBomFacts(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                "SELECT bom_ref,item_ref,product_sku_ref,option_value_ref,version,rows::text,definition_status "
                        + "FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                        + "ORDER BY product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST,bom_ref FOR UPDATE",
                (result, rowNumber) -> {
                    UUID sku = result.getObject(3, UUID.class);
                    UUID option = result.getObject(4, UUID.class);
                    OwnerIdentity owner = new OwnerIdentity(
                            option != null ? "OPTION_VALUE" : sku != null ? "SKU" : "ITEM",
                            result.getObject(2, UUID.class),
                            sku,
                            option,
                            null,
                            null,
                            null);
                    return new RuleFact(
                            result.getObject(1, UUID.class),
                            owner,
                            result.getLong(5),
                            null,
                            null,
                            result.getString(7),
                            null,
                            null,
                            null,
                            json(result.getString(6)),
                            true,
                            null,
                            false);
                },
                scope,
                brand,
                itemRef);
    }

    private Map<String, RuleFact> factsByIdentity(List<RuleFact> facts) {
        Map<String, RuleFact> result = new LinkedHashMap<>();
        for (RuleFact fact : facts) {
            RuleFact previous = result.get(fact.owner().key());
            if (previous == null) {
                result.put(fact.owner().key(), fact);
                continue;
            }
            if (previous.enabled() && fact.enabled()) {
                String detail = "库存 owner 定义不唯一";
                throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 500, detail);
            }
            // Historical definitions remain for audit.  They must not shadow the one current definition, and multiple
            // disabled snapshots are resolved deterministically so a later save can recreate the active definition.
            if (!previous.enabled() && fact.enabled()
                    || (!previous.enabled() && !fact.enabled() && fact.version() > previous.version()))
                result.put(fact.owner().key(), fact);
        }
        return result;
    }

    private record OwnerIdentity(
            String ownerType,
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode) {
        String key() {
            return ownerType + ":" + itemRef + ":" + (productSkuRef == null ? "-" : productSkuRef) + ":"
                    + (optionValueRef == null ? "-" : optionValueRef);
        }
    }

    private record RuleFact(
            UUID ref,
            OwnerIdentity owner,
            long version,
            BigDecimal balance,
            String configuration,
            String definitionStatus,
            InventoryOwnerApi.UnitSnapshot consumptionUnit,
            InventoryOwnerApi.UnitSnapshot countingUnit,
            BigDecimal countingFactor,
            JsonNode rows,
            boolean bom,
            String measureMode,
            boolean componentEligible) {
        boolean enabled() {
            return "ENABLED".equals(definitionStatus);
        }
    }

    private record CurrentBomRow(long version, JsonNode rows) {}

    private record VoidDependencyFact(
            String factKind,
            UUID factRef,
            UUID subjectRef,
            String definitionStatus,
            UUID sourceItemRef,
            UUID sourceSkuRef,
            UUID sourceOptionValueRef,
            UUID targetRef,
            String sourceCode,
            String sourceName,
            String matchedTargetStatus) {}

    private record CatalogVoidInboundKey(
            UUID sourceItemRef,
            UUID sourceSkuRef,
            UUID sourceOptionValueRef,
            UUID targetRef,
            String sourceCode,
            String sourceName) {}

    private static final class VoidDependencyAccumulator {
        private final InventoryOwnerApi.CatalogVoidSubject subject;
        private final Set<UUID> ownedTargetRefsAllStatus = new LinkedHashSet<>();
        private final Set<UUID> ownedActiveTargetRefs = new LinkedHashSet<>();
        private final Set<UUID> ownedDisabledTargetRefs = new LinkedHashSet<>();
        private final Map<CatalogVoidInboundKey, Long> inboundCounts = new LinkedHashMap<>();
        private long ownedActiveProductBomCount;

        private VoidDependencyAccumulator(InventoryOwnerApi.CatalogVoidSubject subject) {
            this.subject = subject;
        }

        private InventoryOwnerApi.CatalogVoidDependencyReadback readback() {
            List<InventoryOwnerApi.CatalogVoidInboundBomReference> inbound = inboundCounts.entrySet().stream()
                    .map(entry -> {
                        CatalogVoidInboundKey key = entry.getKey();
                        InventoryOwnerApi.CatalogVoidSubjectKind sourceKind = key.sourceOptionValueRef() != null
                                ? InventoryOwnerApi.CatalogVoidSubjectKind.OPTION_VALUE
                                : key.sourceSkuRef() != null
                                        ? InventoryOwnerApi.CatalogVoidSubjectKind.PRODUCT_SKU
                                        : InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM;
                        return new InventoryOwnerApi.CatalogVoidInboundBomReference(
                                sourceKind,
                                key.sourceItemRef(),
                                key.sourceSkuRef(),
                                key.sourceOptionValueRef(),
                                key.targetRef(),
                                key.sourceCode(),
                                key.sourceName(),
                                entry.getValue());
                    })
                    .toList();
            return new InventoryOwnerApi.CatalogVoidDependencyReadback(
                    subject,
                    ownedTargetRefsAllStatus,
                    ownedActiveTargetRefs,
                    ownedDisabledTargetRefs,
                    ownedActiveTargetRefs.size(),
                    ownedActiveProductBomCount,
                    inbound);
        }
    }

    private String catalogSaveReceiptKey(String idempotencyKey, String operation, String canonicalRequestJson) {
        try {
            String digest = Sha256Hex.digest(canonicalRequestJson);
            return requireIdempotencyKey(idempotencyKey) + "|" + operation + "|" + digest;
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    private void recheckCatalogItemSaveTargetBeforeReceipt(String scope, String brand, ObjectNode request) {
        UUID itemRef = requiredOpaqueRef(request, "itemRef");
        UUID productSkuRef = optionalOpaqueRef(request, "productSkuRef");
        String targetRef = optional(request, "targetRef");
        if (targetRef != null && !targetRef.isBlank()) {
            TargetRow existing = target(scope, brand, targetRef);
            if (!itemRef.equals(existing.itemRef())
                    || !java.util.Objects.equals(productSkuRef, existing.productSkuRef())) {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存对象身份与商品/SKU 引用不一致"));
            }
        }
        required(request, "mode");
    }

    private void recheckCatalogItemSaveBomBeforeReceipt(String scope, String brand, ObjectNode request) {
        requiredOpaqueRef(request, "itemRef");
        JsonNode rows = request.path("rows");
        if (!rows.isArray()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM rows must be an array");
        rows.forEach(row -> {
            if (!(row instanceof ObjectNode line))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行必须为对象");
            requiredBomTargetRef(line);
        });
    }

    private JsonNode saveCatalogProductBomCore(
            String scope,
            String brand,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        requireScope(scope, brand);
        authorization.run();
        UUID itemRef = requiredOpaqueRef(request, "itemRef");
        UUID productSkuRef = optionalOpaqueRef(request, "productSkuRef");
        UUID optionValueRef = optionalOpaqueRef(request, "optionValueRef");
        lockCatalogItemRefs(List.of(itemRef));
        lockProductSkuRefs(productSkuRef == null ? List.of() : List.of(productSkuRef));
        lockCatalogOptionValueRefs(optionValueRef == null ? List.of() : List.of(optionValueRef));
        String itemCode = optional(request, "itemCode");
        String skuCode = optional(request, "skuCode");
        String optionValueCode = optional(request, "optionValueCode");
        if (productSkuRef != null && optionValueRef != null) {
            throw new InventoryOwnerApi.Problem(
                    ("VALIDATION_ERROR"),
                    (422),
                    /* format-wrap */
                    ("BOM owner 不能同时指定 SKU 与选项值"));
        }
        JsonNode rows = request.path("rows");
        if (!rows.isArray()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM rows must be an array");
        long expected = request.has("expectedVersion") ? requiredLong(request, "expectedVersion") : 0L;
        List<UUID> targetRefs = new ArrayList<>();
        rows.forEach(row -> {
            if (!(row instanceof ObjectNode line))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行必须为对象");
            targetRefs.add(requiredBomTargetRef(line));
            BigDecimal quantity = decimalValue((ObjectNode) row, "quantity");
            String lineSign = normalizeLineSign(row.path("lineSign").asText("POSITIVE"));
            if (!Set.of("POSITIVE", "NEGATIVE").contains(lineSign) || quantity.signum() == 0) {
                throw new InventoryOwnerApi.Problem(
                        ("VALIDATION_ERROR"),
                        (422),
                        /* format-wrap */
                        ("BOM 组件数量与行方向必须有效"));
            }
            if (("POSITIVE".equals(lineSign) && quantity.signum() < 0)
                    || ("NEGATIVE".equals(lineSign) && quantity.signum() > 0))
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行方向与数量符号不一致");
        });
        String currentSql = optionValueRef != null
                ? "SELECT version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                        + "AND item_ref=? AND "
                        + "product_sku_ref IS NULL AND option_value_ref=?"
                : (productSkuRef == null
                        ? "SELECT version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                                + "AND "
                                + "item_ref=? AND product_sku_ref IS NULL AND option_value_ref IS NULL"
                        : "SELECT version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                                + "AND "
                                + "item_ref=? AND product_sku_ref=? AND option_value_ref IS NULL");
        currentSql += " AND definition_status='ENABLED' FOR UPDATE";
        List<CurrentBomRow> current = jdbc.query(
                currentSql,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, itemRef);
                    if (optionValueRef != null) statement.setObject(4, optionValueRef);
                    else if (productSkuRef != null) statement.setObject(4, productSkuRef);
                },
                result -> {
                    List<CurrentBomRow> values = new ArrayList<>();
                    while (result.next()) values.add(new CurrentBomRow(result.getLong(1), json(result.getString(2))));
                    return values;
                });
        CurrentBomRow existing = current.isEmpty() ? null : current.get(0);
        if ((existing == null ? 0L : existing.version()) != expected)
            throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "商品 BOM 版本已变化");
        Map<UUID, TargetRow> componentTargets =
                loadTargetsByRefs(scope, brand, new LinkedHashSet<>(targetRefs), false, false);
        ResolvedBomTargets resolvedTargets = ResolvedBomTargets.load(jdbc, scope, brand, targetRefs);
        // The current BOM row is read under the same row lock as the version check.  Admission is then state-aware:
        // only target refs added or replaced by this submission must be enabled and component-eligible.
        validateBomLines(
                new OwnerIdentity(
                        optionValueRef != null ? "OPTION_VALUE" : productSkuRef != null ? "SKU" : "ITEM",
                        itemRef,
                        productSkuRef,
                        optionValueRef,
                        itemCode,
                        skuCode,
                        optionValueCode),
                rows,
                existing == null ? null : existing.rows(),
                componentTargets,
                resolvedTargets);
        ArrayNode normalized = mapper.createArrayNode();
        rows.forEach(row -> {
            ObjectNode rawLine = (ObjectNode) row;
            UUID componentTargetRef = requiredBomTargetRef(rawLine);
            ObjectNode line = normalized
                    .addObject()
                    .put("lineSign", normalizeLineSign(row.path("lineSign").asText("POSITIVE")))
                    .put("targetRef", componentTargetRef.toString())
                    .put(
                            "quantity",
                            row.path("quantity")
                                    .asText(row.path("quantityPerUnit").asText("0")));
            JsonNode oldLine = existingBomLine(existing == null ? null : existing.rows(), componentTargetRef);
            if (oldLine != null && oldLine.path("consumptionUnitSnapshot").isObject())
                line.set(
                        "consumptionUnitSnapshot",
                        oldLine.path("consumptionUnitSnapshot").deepCopy());
            else {
                TargetRow component = componentTargets.get(componentTargetRef);
                if (component == null || component.consumptionUnitSnapshot() == null)
                    throw new InventoryOwnerApi.Problem(
                            "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED",
                            422,
                            /* format-wrap */
                            "BOM 组件单位快照不完整");
                line.set("consumptionUnitSnapshot", mapper.valueToTree(component.consumptionUnitSnapshot()));
            }
            line.put("ownerRef", itemRef.toString());
            if (productSkuRef == null) line.putNull("productSkuRef");
            else line.put("productSkuRef", productSkuRef.toString());
            if (optionValueRef == null) line.putNull("optionValueRef");
            else line.put("optionValueRef", optionValueRef.toString());
        });
        long next = expected + 1;
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT "
                        + "(data_node_ref,brand_ref,item_ref,(COALESCE(product_sku_ref, "
                        + "'00000000-0000-0000-0000-000000000000'::uuid)),(COALESCE(option_value_ref, "
                        + "'00000000-0000-0000-0000-000000000000'::uuid))) WHERE definition_status='ENABLED' "
                        + "DO UPDATE SET "
                        + "version=EXCLUDED.version,rows=EXCLUDED.rows,updated_at_epoch_millis=EXCLUDED.updated_at_epoc"
                        + "h_mi"
                        + "llis",
                UUID.randomUUID(),
                scope,
                brand,
                itemRef,
                productSkuRef,
                optionValueRef,
                itemCode,
                skuCode,
                optionValueCode,
                next,
                canonical(normalized),
                time.currentEpochMillis());
        return mapper.createObjectNode()
                .put("itemRef", itemRef.toString())
                .put("version", next)
                .put("saved", true);
    }

    private TargetRow targetByIdentity(String scope, String brand, UUID itemRef, UUID productSkuRef) {
        List<TargetRow> rows = jdbc.query(
                "SELECT "
                        + TARGET_SELECT_COLUMNS
                        + " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                        + "AND definition_status='ENABLED' AND item_ref=? "
                        + "AND product_sku_ref IS NOT DISTINCT FROM ?",
                (r, n) -> targetRowWithConsumptionUnitSnapshot(r),
                scope,
                brand,
                itemRef,
                productSkuRef);
        if (rows.size() != 1) {
            throw new InventoryOwnerApi.Problem(("RESULT_UNKNOWN"), (500), ("库存对象创建后无法读取"));
        }
        return rows.get(0);
    }

    private TargetRow findTargetByIdentity(String scope, String brand, UUID itemRef, UUID productSkuRef) {
        List<TargetRow> rows = jdbc.query(
                "SELECT "
                        + TARGET_SELECT_COLUMNS
                        + " FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                        + "AND item_ref=? AND product_sku_ref IS NOT DISTINCT FROM ?",
                (r, n) -> targetRowWithConsumptionUnitSnapshot(r),
                scope,
                brand,
                itemRef,
                productSkuRef);
        if (rows.size() > 1) {
            throw new InventoryOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("目标库存对象引用不唯一"));
        }
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<TargetIdentity, TargetRow> targetRowsByIdentities(
            String scope, String brand, List<TargetIdentity> identities) {
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
        Map<TargetIdentity, TargetRow> result = new LinkedHashMap<>();
        for (TargetRow row : jdbc.query(
                "SELECT "
                        + TARGET_SELECT_COLUMNS
                        + " FROM inventory.stock_target WHERE data_node_ref=? AND "
                        + "brand_ref=? AND definition_status='ENABLED' AND ("
                        + predicates + ")",
                (row, number) -> targetRowWithConsumptionUnitSnapshot(row),
                args.toArray())) {
            result.put(new TargetIdentity(row.itemRef(), row.productSkuRef()), row);
        }
        return result;
    }

    /**
     * The prepared copy already read target identities during preflight. After the INSERT, reuse those immutable rows
     * and synthesize only the rows whose target identity was absent. The INSERT shape is deterministic for a
     * newly-created target, so a second full target SELECT would only re-read facts already owned by this command.
     */
    private Map<TargetIdentity, TargetRow> postInsertTargetRows(
            List<PlannedTarget> plannedTargets,
            Map<TargetIdentity, TargetRow> preflightTargetRows,
            Map<UUID, ReferenceMapping> mappings) {
        Map<TargetIdentity, TargetRow> result = new LinkedHashMap<>();
        for (PlannedTarget planned : plannedTargets) {
            TargetIdentity identity = new TargetIdentity(
                    planned.itemMapping().targetRef(),
                    planned.skuMapping() == null ? null : planned.skuMapping().targetRef());
            TargetRow existing = preflightTargetRows.get(identity);
            result.put(identity, existing == null ? insertedTargetRow(planned, mappings) : existing);
        }
        return result;
    }

    private TargetRow insertedTargetRow(PlannedTarget planned, Map<UUID, ReferenceMapping> mappings) {
        TargetRow source = planned.source();
        ReferenceMapping sku = planned.skuMapping();
        InventoryOwnerApi.UnitSnapshot consumption = mappedUnitSnapshot(source.consumptionUnitSnapshot(), mappings);
        InventoryConfiguration sourceConfiguration = configurationReadback(json(source.configuration()));
        InventoryOwnerApi.UnitSnapshot counting =
                mappedUnitSnapshot(sourceConfiguration.countingUnitSnapshot(), mappings);
        String inventoryMode = json(source.configuration()).path("mode").asText("");
        if (inventoryMode.isBlank())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存对象缺少 inventory mode");
        return new TargetRow(
                planned.targetMapping().targetRef(),
                planned.itemMapping().targetRef(),
                sku == null ? null : sku.targetRef(),
                requiredLabel(planned.itemMapping().targetCode(), "CATALOG_ITEM targetCode"),
                sku == null ? null : requiredLabel(sku.targetSkuCode(), "PRODUCT_SKU targetSkuCode"),
                source.measureMode(),
                BigDecimal.ZERO,
                mappedConfiguration(
                        source.configuration(), inventoryMode, counting, sourceConfiguration.conversionFactor()),
                1L,
                time.currentEpochMillis(),
                consumption,
                counting,
                sourceConfiguration.conversionFactor(),
                "ENABLED",
                inventoryMode,
                source.componentEligible());
    }

    private List<TargetRow> loadTargetsByItemRef(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                "SELECT "
                        + TARGET_SELECT_COLUMNS
                        + " FROM inventory.stock_target WHERE data_node_ref=? AND "
                        + "brand_ref=? AND definition_status='ENABLED' AND item_ref=? "
                        + "ORDER BY product_sku_ref NULLS FIRST",
                (r, n) -> targetRowWithConsumptionUnitSnapshot(r),
                scope,
                brand,
                itemRef);
    }

    private List<TargetRow> loadTargetsByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT "
                        + TARGET_SELECT_COLUMNS
                        + " FROM inventory.stock_target WHERE data_node_ref=? AND "
                        + "brand_ref=? AND definition_status='ENABLED' AND item_ref = ANY(?::uuid[]) "
                        + "ORDER BY item_ref,product_sku_ref "
                        + "NULLS FIRST,target_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (r, n) -> targetRowWithConsumptionUnitSnapshot(r));
    }

    private Map<UUID, TargetRow> loadTargetsByRefs(String scope, String brand, Set<UUID> targetRefs) {
        return loadTargetsByRefs(scope, brand, targetRefs, true, true);
    }

    private Map<UUID, TargetRow> loadTargetsByRefs(
            String scope, String brand, Set<UUID> targetRefs, boolean requireCompleteConsumptionUnit) {
        return loadTargetsByRefs(scope, brand, targetRefs, true, requireCompleteConsumptionUnit);
    }

    private Map<UUID, TargetRow> loadTargetsByRefs(
            String scope,
            String brand,
            Set<UUID> targetRefs,
            boolean enabledOnly,
            boolean requireCompleteConsumptionUnit) {
        if (targetRefs.isEmpty()) return Map.of();
        UUID[] values = targetRefs.toArray(UUID[]::new);
        String statusPredicate = enabledOnly ? "AND definition_status='ENABLED' " : "";
        return jdbc.query(
                "SELECT "
                        + TARGET_SELECT_COLUMNS
                        + " FROM inventory.stock_target WHERE data_node_ref=? AND "
                        + "brand_ref=? "
                        + statusPredicate
                        + "AND target_ref = ANY(?::uuid[])",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, TargetRow> resolved = new LinkedHashMap<>();
                    while (result.next()) {
                        TargetRow row = requireCompleteConsumptionUnit
                                ? targetRowWithConsumptionUnitSnapshot(result)
                                : targetRow(result, unitSnapshot(result, 11));
                        if (resolved.putIfAbsent(row.ref(), row) != null)
                            throw new InventoryOwnerApi.Problem(
                                    ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("目标库存对象引用不唯一"));
                    }
                    return resolved;
                });
    }

    /**
     * Reads the catalog item's direct targets, enabled BOM owners, and BOM component targets in one owner-local round
     * trip. The BOM JSON remains the source of component identity; the target predicate only avoids a second target
     * lookup after that identity has been observed. A caller-provided component projection is still honored for the
     * copy path and therefore never replaced by this read.
     */
    private CatalogDefinitionFacts loadCatalogDefinitionFacts(
            String scope,
            String brand,
            UUID catalogItemRef,
            boolean includeDirectTargets,
            Map<UUID, TargetRow> preloadedComponentTargets) {
        boolean includeComponentTargets = preloadedComponentTargets == null;
        String targetPredicate = includeDirectTargets ? "target.item_ref=?" : "FALSE";
        if (includeComponentTargets)
            targetPredicate += (includeDirectTargets ? " OR " : "")
                    + "target.target_ref::text IN (SELECT target_ref FROM component_target_refs)";
        List<CatalogBomRow> bomOwners = new ArrayList<>();
        List<TargetRow> directTargets = new ArrayList<>();
        Map<UUID, TargetRow> componentTargets = new LinkedHashMap<>();
        String sql = "WITH bom_rows AS ("
                + "SELECT product_sku_ref,option_value_ref,sku_code,option_value_code,version,rows::text AS bom_rows "
                + "FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                + "AND definition_status='ENABLED'"
                + "), component_target_refs AS ("
                + "SELECT DISTINCT COALESCE(line.value->>'targetRef',line.value->>'componentTargetRef') AS target_ref "
                + "FROM bom_rows CROSS JOIN LATERAL jsonb_array_elements("
                + "CASE WHEN jsonb_typeof(bom_rows.bom_rows::jsonb)='array' "
                + "THEN bom_rows.bom_rows::jsonb ELSE '[]'::jsonb END) line"
                + ") SELECT * FROM (SELECT 'TARGET' AS row_kind," + TARGET_SELECT_COLUMNS
                + ",NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::bigint,NULL::text "
                + "FROM inventory.stock_target target WHERE target.data_node_ref=? AND target.brand_ref=? "
                + "AND target.definition_status='ENABLED' AND (" + targetPredicate + ") "
                + "UNION ALL SELECT 'BOM',NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text,"
                + "NULL::numeric,NULL::text,NULL::bigint,NULL::bigint,NULL::uuid,NULL::text,NULL::text,NULL::text,"
                + "NULL::integer,NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::integer,NULL::numeric,NULL::text,"
                + "NULL::text,NULL::boolean,bom_rows.product_sku_ref,bom_rows.option_value_ref,bom_rows.sku_code,"
                + "bom_rows.option_value_code,bom_rows.version,bom_rows.bom_rows FROM bom_rows "
                + ") AS combined ORDER BY (row_kind='TARGET') DESC,4 NULLS FIRST,28 NULLS FIRST,29 NULLS FIRST";
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
                            TargetRow row = targetRowWithConsumptionUnitSnapshot(result, 2);
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
        return new CatalogDefinitionFacts(
                List.copyOf(directTargets),
                List.copyOf(bomOwners),
                preloadedComponentTargets == null ? Map.copyOf(componentTargets) : preloadedComponentTargets);
    }

    private UUID bomTargetRef(JsonNode row) {
        String value =
                row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 BOM 组件引用无法解析", failure);
        }
    }

    private ObjectNode configurationNode(TargetRow row) {
        InventoryConfiguration configuration = configurationReadback(json(row.configuration()));
        ObjectNode result = mapper.createObjectNode().put("allowNegative", configuration.allowNegative());
        if (configuration.lowStockThreshold() == null) result.putNull("lowStockThreshold");
        else result.put("lowStockThreshold", decimal(configuration.lowStockThreshold()));
        setNullableSnapshot(result, "countingUnitSnapshot", configuration.countingUnitSnapshot());
        result.put("conversionFactor", decimal(configuration.conversionFactor()));
        return result;
    }

    private ObjectNode normalizedDirectConfiguration(JsonNode raw) {
        if (raw == null || !raw.isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "directConfiguration must be an object");
        ObjectNode normalized = (ObjectNode) raw.deepCopy();
        normalized.remove("targetRef");
        normalized.remove("version");
        normalized.remove("consumptionUnitSnapshot");
        normalized.put("mode", "DIRECT");
        return normalized;
    }

    private ObjectNode canonicalDirectConfiguration(JsonNode raw, InventoryOwnerApi.UnitSnapshot consumptionUnit) {
        ObjectNode normalized = normalizedDirectConfiguration(raw);
        InventoryOwnerApi.CountingUnitConfiguration counting = countingUnitConfiguration(normalized, consumptionUnit);
        writeCountingConfiguration(normalized, counting);
        return normalized;
    }

    private String requiredInventoryMode(String configurationJson) {
        String mode = json(configurationJson).path("mode").asText("");
        if (!Set.of("DIRECT", "BOM").contains(mode))
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存对象缺少有效 inventory mode");
        return mode;
    }

    private List<BomOwnerRow> loadBomOwnersByItemRef(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                "SELECT "
                        + "item_ref,product_sku_ref,option_value_ref,item_code,sku_code,option_value_code,version,rows:"
                        + ":tex"
                        + "t FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_ref=? ORDER BY "
                        + "product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST",
                (r, n) -> new BomOwnerRow(
                        r.getObject(1, UUID.class),
                        r.getObject(2, UUID.class),
                        r.getObject(3, UUID.class),
                        r.getString(4),
                        r.getString(5),
                        r.getString(6),
                        r.getLong(7),
                        r.getString(8)),
                scope,
                brand,
                itemRef);
    }

    private List<BomOwnerRow> loadBomOwnersByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT "
                        + "item_ref,product_sku_ref,option_value_ref,item_code,sku_code,option_value_code,"
                        + "version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                        + "AND item_ref = ANY(?::uuid[]) "
                        + "ORDER BY item_ref,product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (r, n) -> new BomOwnerRow(
                        r.getObject(1, UUID.class),
                        r.getObject(2, UUID.class),
                        r.getObject(3, UUID.class),
                        r.getString(4),
                        r.getString(5),
                        r.getString(6),
                        r.getLong(7),
                        r.getString(8)));
    }

    private List<TargetConfigurationRow> loadTargetConfigurationsByItemRefs(
            String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT item_ref,target_ref,configuration::text FROM inventory.stock_target WHERE data_node_ref=? AND "
                        + "brand_ref=? AND item_ref = ANY(?::uuid[]) ORDER BY item_ref,target_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (r, n) -> new TargetConfigurationRow(
                        r.getObject(1, UUID.class), r.getObject(2, UUID.class), r.getString(3)));
    }

    private List<String> loadBomRowsByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return List.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                        + "AND item_ref = ANY(?::uuid[]) "
                        + "ORDER BY item_ref,product_sku_ref NULLS FIRST,option_value_ref NULLS FIRST",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                (r, n) -> r.getString(1));
    }

    /** Resolve the same recursive target-reference closure that preflight validates before copy writes it. */
    private SourceCopyClosure sourceCopyClosure(
            String scope, String brand, List<UUID> initialItemRefs, LocalCopySectionPlan localSections) {
        if (localSections != null) return localSourceCopyClosure(scope, brand, initialItemRefs, localSections);
        LinkedHashSet<UUID> itemRefs = new LinkedHashSet<>();
        ArrayDeque<UUID> pendingItemRefs = new ArrayDeque<>();
        for (UUID itemRef : initialItemRefs) if (itemRefs.add(itemRef)) pendingItemRefs.add(itemRef);
        Map<UUID, TargetRow> targetsByRef = new LinkedHashMap<>();
        Map<String, BomOwnerRow> bomOwnersByIdentity = new LinkedHashMap<>();
        while (!pendingItemRefs.isEmpty()) {
            List<UUID> frontier = new ArrayList<>();
            while (!pendingItemRefs.isEmpty()) frontier.add(pendingItemRefs.removeFirst());
            Map<UUID, List<TargetRow>> targetsByItem = new LinkedHashMap<>();
            for (TargetRow target : loadTargetsByItemRefs(scope, brand, frontier))
                targetsByItem
                        .computeIfAbsent(target.itemRef(), ignored -> new ArrayList<>())
                        .add(target);
            Map<UUID, List<BomOwnerRow>> ownersByItem = new LinkedHashMap<>();
            for (BomOwnerRow owner : loadBomOwnersByItemRefs(scope, brand, frontier))
                ownersByItem
                        .computeIfAbsent(owner.itemRef(), ignored -> new ArrayList<>())
                        .add(owner);
            for (UUID itemRef : frontier) {
                for (TargetRow target : targetsByItem.getOrDefault(itemRef, List.of())) {
                    assertSourceNoOwnerReference(target, scope);
                    targetsByRef.putIfAbsent(target.ref(), target);
                }
                for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of())) {
                    if (bomOwnersByIdentity.putIfAbsent(bomOwnerIdentity(owner), owner) != null) continue;
                    JsonNode rows = json(owner.rows());
                    if (!rows.isArray()) {
                        throw new InventoryOwnerApi.Problem(
                                ("REFERENCE_MAPPING_UNRESOLVED"),
                                (422),
                                /* format-wrap */
                                ("库存 BOM 行不是有效数组"));
                    }
                }
            }
            LinkedHashSet<UUID> componentRefs = new LinkedHashSet<>();
            for (UUID itemRef : frontier)
                for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of()))
                    for (JsonNode row : json(owner.rows())) {
                        try {
                            componentRefs.add(UUID.fromString(row.path("targetRef")
                                    .asText(row.path("componentTargetRef").asText(""))));
                        } catch (IllegalArgumentException failure) {
                            String failureMessage = "库存 BOM 组件不在复制闭包中";
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                        }
                    }
            Map<UUID, TargetRow> componentsByRef = loadTargetsByRefs(scope, brand, componentRefs);
            for (UUID itemRef : frontier)
                for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of()))
                    for (JsonNode row : json(owner.rows())) {
                        UUID componentRef;
                        try {
                            componentRef = UUID.fromString(row.path("targetRef")
                                    .asText(row.path("componentTargetRef").asText("")));
                        } catch (IllegalArgumentException failure) {
                            String failureMessage = "库存 BOM 组件不在复制闭包中";
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                        }
                        TargetRow component = componentsByRef.get(componentRef);
                        if (component == null)
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, "库存 BOM 组件不在复制闭包中");
                        if (itemRefs.add(component.itemRef())) pendingItemRefs.add(component.itemRef());
                    }
        }
        return new SourceCopyClosure(
                List.copyOf(itemRefs),
                List.copyOf(targetsByRef.values()),
                List.copyOf(bomOwnersByIdentity.values()),
                List.of());
    }

    /**
     * Local copy transfers only the explicitly selected BOM ownership class; component targets are dependencies, not
     * implicit BOM selections.
     */
    private SourceCopyClosure localSourceCopyClosure(
            String scope, String brand, List<UUID> initialItemRefs, LocalCopySectionPlan sections) {
        LinkedHashSet<UUID> itemRefs = new LinkedHashSet<>(initialItemRefs);
        Map<UUID, TargetRow> targetsByRef = new LinkedHashMap<>();
        List<BomOwnerRow> selectedOwners = new ArrayList<>();
        Set<String> presentSections = new LinkedHashSet<>();
        List<BomOwnerRow> sourceOwners = loadBomOwnersByItemRefs(scope, brand, initialItemRefs);
        Map<UUID, List<BomOwnerRow>> ownersByItem = new LinkedHashMap<>();
        for (BomOwnerRow owner : sourceOwners)
            ownersByItem
                    .computeIfAbsent(owner.itemRef(), ignored -> new ArrayList<>())
                    .add(owner);
        LinkedHashSet<UUID> componentRefs = new LinkedHashSet<>();
        for (UUID itemRef : initialItemRefs)
            for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of())) {
                String section = sectionForBomOwner(owner);
                if (!sections.selected().contains(section)) continue;
                presentSections.add(section);
                selectedOwners.add(owner);
                JsonNode rows = json(owner.rows());
                if (!rows.isArray()) {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存 BOM 行不是有效数组"));
                }
                for (JsonNode row : rows)
                    try {
                        componentRefs.add(UUID.fromString(row.path("targetRef")
                                .asText(row.path("componentTargetRef").asText(""))));
                    } catch (IllegalArgumentException failure) {
                        String failureMessage = "库存 BOM 组件不在复制闭包中";
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                    }
            }
        Map<UUID, TargetRow> componentsByRef = loadTargetsByRefs(scope, brand, componentRefs);
        for (UUID itemRef : initialItemRefs)
            for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of())) {
                if (!sections.selected().contains(sectionForBomOwner(owner))) continue;
                for (JsonNode row : json(owner.rows())) {
                    UUID componentRef;
                    try {
                        componentRef = UUID.fromString(row.path("targetRef")
                                .asText(row.path("componentTargetRef").asText("")));
                    } catch (IllegalArgumentException failure) {
                        String failureMessage = "库存 BOM 组件不在复制闭包中";
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                    }
                    TargetRow component = componentsByRef.get(componentRef);
                    if (component == null)
                        throw new InventoryOwnerApi.Problem(
                                ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("库存 BOM 组件不在复制闭包中"));
                    assertSourceNoOwnerReference(component, scope);
                    itemRefs.add(component.itemRef());
                    targetsByRef.putIfAbsent(component.ref(), component);
                }
            }
        List<InventoryOwnerApi.LocalCopySkippedReadback> skipped = sections.selected().stream()
                .filter(section -> !presentSections.contains(section))
                .map(section -> new InventoryOwnerApi.LocalCopySkippedReadback(section, "SKIPPED_SOURCE_ABSENT"))
                .toList();
        return new SourceCopyClosure(
                List.copyOf(itemRefs), List.copyOf(targetsByRef.values()), List.copyOf(selectedOwners), skipped);
    }

    /**
     * A local copy reuses the same catalog-unit identity. Inventory-owned BOM component targets can be outside the
     * catalog item's own serialized closure, so the coordinator cannot supply their unit mapping from catalog facts.
     * The source snapshot is already the immutable unit fact needed for this same-scope identity mapping; cross-scope
     * copies still require an explicit catalog-provided mapping.
     */
    private void addLocalCatalogUnitIdentityMappings(
            Map<UUID, ReferenceMapping> mappings, SourceCopyClosure sourceClosure) {
        for (TargetRow target : sourceClosure.targets()) {
            addLocalCatalogUnitIdentityMapping(mappings, target.consumptionUnitSnapshot());
            addLocalCatalogUnitIdentityMapping(mappings, target.countingUnitSnapshot());
        }
        for (BomOwnerRow owner : sourceClosure.bomOwners()) {
            for (JsonNode row : json(owner.rows())) {
                addLocalCatalogUnitIdentityMapping(
                        mappings,
                        requiredUnitSnapshot(row.path("consumptionUnitSnapshot"), "BOM consumptionUnitSnapshot"));
            }
        }
    }

    private static void addLocalCatalogUnitIdentityMapping(
            Map<UUID, ReferenceMapping> mappings, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) return;
        mappings.putIfAbsent(
                snapshot.unitRef(),
                new ReferenceMapping(
                        "CATALOG_UNIT",
                        snapshot.unitRef(),
                        snapshot.code(),
                        null,
                        null,
                        snapshot.name(),
                        snapshot.unitDimension(),
                        snapshot.precision()));
    }

    private LocalCopySectionPlan localCopySectionPlan(ObjectNode request) {
        if (!request.has("selectedSections")) return null;
        LinkedHashSet<String> selected = new LinkedHashSet<>();
        JsonNode values = request.path("selectedSections");
        if (values.isArray())
            for (JsonNode value : values)
                if (Set.of("SKU_BOM", "OPTION_VALUE_BOM", "ITEM_BOM").contains(value.asText()))
                    selected.add(value.asText());
        return new LocalCopySectionPlan(Set.copyOf(selected));
    }

    private static String sectionForBomOwner(BomOwnerRow owner) {
        if (owner.productSkuRef() != null) return "SKU_BOM";
        if (owner.optionValueRef() != null) return "OPTION_VALUE_BOM";
        return "ITEM_BOM";
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

    private void assertSourceNoOwnerReference(TargetRow row, String sourceScope) {
        assertJsonNoOwnerReference(json(row.configuration()), sourceScope);
    }

    private void verifyTargetNoOwnerReference(
            String targetScope, String brand, List<UUID> itemRefs, String sourceScope) {
        for (TargetConfigurationRow row : loadTargetConfigurationsByItemRefs(targetScope, brand, itemRefs))
            assertJsonNoOwnerReference(json(row.configuration()), sourceScope);
        for (String rows : loadBomRowsByItemRefs(targetScope, brand, itemRefs))
            assertJsonNoOwnerReference(json(rows), sourceScope);
    }

    private void assertJsonNoOwnerReference(JsonNode node, String sourceScope) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                JsonNode value = entry.getValue();
                if (Set.of("headCompanyRef", "ownerRef", "dataNodeRef", "scopeRef", "originScopeRef")
                                .contains(entry.getKey())
                        && value.isTextual()
                        && sourceScope.equals(value.asText())) {
                    {
                        throw new InventoryOwnerApi.Problem(
                                ("OWNER_REFERENCE_LEAK"),
                                (422),
                                /* format-wrap */
                                ("库存目标仍含来源 owner 引用"));
                    }
                }
                assertJsonNoOwnerReference(value, sourceScope);
            }
        } else if (node.isArray()) node.forEach(value -> assertJsonNoOwnerReference(value, sourceScope));
    }

    private PreparedBom rewrittenBom(
            String sourceScope,
            String targetScope,
            String brand,
            BomOwnerRow source,
            Map<UUID, UUID> targetRefs,
            Map<UUID, ReferenceMapping> mappings) {
        JsonNode parsed = json(source.rows());
        if (!parsed.isArray()) {
            throw new InventoryOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("库存 BOM 行不是有效数组"));
        }
        ArrayNode rewritten = mapper.createArrayNode();
        for (JsonNode line : parsed) {
            if (!line.isObject()) {
                throw new InventoryOwnerApi.Problem(("VALIDATION_ERROR"), (422), ("库存 BOM 行不是对象"));
            }
            ObjectNode row = (ObjectNode) line.deepCopy();
            String sourceRef =
                    row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
            UUID mapped;
            try {
                mapped = targetRefs.get(UUID.fromString(sourceRef));
            } catch (IllegalArgumentException failure) {
                mapped = null;
            }
            if (mapped == null) {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存 BOM 组件不在复制闭包中"));
            }
            InventoryOwnerApi.UnitSnapshot consumption = mappedUnitSnapshot(
                    requiredUnitSnapshot(row.path("consumptionUnitSnapshot"), "BOM consumptionUnitSnapshot"), mappings);
            row.put("targetRef", mapped.toString());
            row.remove("componentTargetRef");
            row.remove("unit");
            row.remove("consumptionUnit");
            row.remove("countingUnit");
            row.set("consumptionUnitSnapshot", mapper.valueToTree(consumption));
            ReferenceMapping itemMapping = mappingFor(mappings, source.itemRef(), "CATALOG_ITEM");
            ReferenceMapping skuMapping =
                    source.productSkuRef() == null ? null : mappingFor(mappings, source.productSkuRef(), "PRODUCT_SKU");
            ReferenceMapping optionMapping = source.optionValueRef() == null
                    ? null
                    : mappingFor(mappings, source.optionValueRef(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
            row.put("ownerRef", itemMapping.targetRef().toString());
            if (skuMapping == null) row.putNull("productSkuRef");
            else row.put("productSkuRef", skuMapping.targetRef().toString());
            if (optionMapping == null) row.putNull("optionValueRef");
            else row.put("optionValueRef", optionMapping.targetRef().toString());
            rewritten.add(row);
        }
        assertJsonNoOwnerReference(rewritten, sourceScope);
        ReferenceMapping itemMapping = mappingFor(mappings, source.itemRef(), "CATALOG_ITEM");
        ReferenceMapping skuMapping =
                source.productSkuRef() == null ? null : mappingFor(mappings, source.productSkuRef(), "PRODUCT_SKU");
        ReferenceMapping optionMapping = source.optionValueRef() == null
                ? null
                : mappingFor(mappings, source.optionValueRef(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
        return new PreparedBom(itemMapping, skuMapping, optionMapping, source.version(), canonical(rewritten));
    }

    private String targetIdentityCode(String itemCode, String skuCode) {
        return itemCode + (skuCode == null || skuCode.isBlank() ? "" : "::" + skuCode);
    }

    private ObjectNode canonicalTuple(String ownerRef, String brandRef, String objectType, List<String> parts) {
        ObjectNode tuple = mapper.createObjectNode()
                .put("ownerRef", ownerRef)
                .put("brandRef", brandRef)
                .put("objectType", objectType);
        ArrayNode values = tuple.putArray("parts");
        parts.forEach(values::add);
        return tuple;
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

    private ObjectNode consumptionTargetCandidates(String scope, String brand, ObjectNode request, String requestId) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        String keyword = optional(request, "keyword");
        if (keyword == null) keyword = "";
        final String normalizedKeyword = keyword.trim();
        String pattern = "%" + normalizedKeyword + "%";
        ObjectNode data = mapper.createObjectNode();
        ArrayNode items = data.putArray("items");
        final long[] total = {0L};
        jdbc.query(
                "SELECT target.target_ref,target.item_ref,target.product_sku_ref,target.item_code,target.sku_code,"
                        + "item.name,sku.sku_name,target.consumption_unit_ref,target.consumption_unit_code,"
                        + "target.consumption_unit_name,target.consumption_unit_dimension,"
                        + "target.consumption_unit_precision,"
                        + "COUNT(*) OVER() FROM inventory.stock_target target "
                        + "JOIN catalog.catalog_item item ON item.item_ref=target.item_ref "
                        + "AND item.data_node_ref=target.data_node_ref AND item.brand_ref=target.brand_ref "
                        + "LEFT JOIN catalog.catalog_sku sku ON sku.product_sku_ref=target.product_sku_ref "
                        + "AND sku.item_ref=target.item_ref "
                        + "WHERE target.data_node_ref=? AND target.brand_ref=? "
                        + "AND target.definition_status='ENABLED' AND target.component_eligible=TRUE "
                        + "AND target.consumption_unit_ref IS NOT NULL "
                        + "AND (?='' OR item.name ILIKE ? OR COALESCE(item.short_name,'') ILIKE ? "
                        + "OR target.item_code ILIKE ? OR COALESCE(sku.sku_name,'') ILIKE ? "
                        + "OR COALESCE(target.sku_code,'') ILIKE ?) "
                        + "ORDER BY item.name,sku.sku_name NULLS FIRST,target.target_ref LIMIT ? OFFSET ?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, normalizedKeyword);
                    statement.setString(4, pattern);
                    statement.setString(5, pattern);
                    statement.setString(6, pattern);
                    statement.setString(7, pattern);
                    statement.setString(8, pattern);
                    statement.setInt(9, pageSize + 1);
                    statement.setLong(10, offset);
                },
                result -> {
                    while (result.next()) {
                        if (items.size() <= pageSize) {
                            String itemName = result.getString(6);
                            requireCatalogBusinessName(itemName, "耗用对象缺少商品名称");
                            ObjectNode item = items.addObject()
                                    .put(
                                            "targetRef",
                                            result.getObject(1, UUID.class).toString())
                                    .put(
                                            "itemRef",
                                            result.getObject(2, UUID.class).toString())
                                    .put("itemCode", result.getString(4))
                                    .put("itemName", itemName);
                            UUID skuRef = result.getObject(3, UUID.class);
                            if (skuRef == null) item.putNull("productSkuRef");
                            else item.put("productSkuRef", skuRef.toString());
                            String skuCode = result.getString(5);
                            if (skuCode == null) {
                                item.putNull("skuCode");
                                item.putNull("skuName");
                            } else {
                                String skuName = result.getString(7);
                                requireCatalogBusinessName(skuName, "耗用对象缺少规格名称");
                                item.put("skuCode", skuCode).put("skuName", skuName);
                            }
                            item.putObject("consumptionUnitSnapshot")
                                    .put(
                                            "unitRef",
                                            result.getObject(8, UUID.class).toString())
                                    .put("code", result.getString(9))
                                    .put("name", result.getString(10))
                                    .put("unitDimension", result.getString(11))
                                    .put("precision", result.getInt(12));
                        }
                        total[0] = result.getLong(13);
                    }
                    return null;
                });
        boolean hasNext = items.size() > pageSize;
        if (hasNext) items.remove(items.size() - 1);
        data.put("total", total[0])
                .put(
                        "cursor",
                        request == null || request.path("cursor").isMissingNode()
                                ? "0"
                                : request.path("cursor").asText("0"));
        if (hasNext) data.put("nextCursor", Long.toString(offset + pageSize));
        else data.putNull("nextCursor");
        return envelope(requestId, data);
    }

    /**
     * Task reads consume the catalog name field, never substitute the identity code as a display name. A business may
     * legitimately give a SKU a name with the same characters as its code, so equality is not corrupt data.
     */
    private void requireCatalogBusinessName(String name, String missingMessage) {
        if (name == null || name.isBlank()) throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, missingMessage);
    }

    /**
     * Keeps the internal count-only probe used by inventory target maintenance separate from the catalog-list deduction
     * summary. The latter is an owner-declared DIRECT/BOM/NONE projection; this probe only reports how many inventory
     * targets are attached to each requested catalog item and must not be used to infer a deduction mode.
     */
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

    /**
     * Returns the owner-declared deduction mode for a bounded set of catalog items and SKUs.
     *
     * <p>The catalog owner must not infer DIRECT/BOM/NONE from the number of inventory rows: a disabled historical row,
     * an option-value BOM, and a SKU-grain definition all make that inference wrong. This task-read therefore joins
     * only enabled item/SKU-owned facts, keeps the consumption-unit snapshot from stock_target, and counts the BOM
     * lines from the BOM owner's JSON. Both request dimensions are handled in one owner query and one connection.
     */
    private ObjectNode inventoryDeductionSummaries(
            String scope, String brand, String requestId, List<UUID> itemRefs, List<UUID> productSkuRefs) {
        ObjectNode data = mapper.createObjectNode();
        ArrayNode items = data.putArray("items");
        if (itemRefs.isEmpty() && productSkuRefs.isEmpty()) {
            data.put("total", 0).put("generation", generation(scope, brand));
            return envelope(requestId, data);
        }
        UUID[] requestedItemRefs = itemRefs.toArray(UUID[]::new);
        UUID[] requestedSkuRefs = productSkuRefs.toArray(UUID[]::new);
        String sql = "SELECT 'DIRECT' AS fact_kind,item_ref,product_sku_ref,inventory_mode,"
                + "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,"
                + "consumption_unit_precision,NULL::integer AS bom_line_count "
                + "FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                + "AND definition_status='ENABLED' AND ((product_sku_ref IS NULL AND item_ref=ANY(?::uuid[])) "
                + "OR (product_sku_ref IS NOT NULL AND product_sku_ref=ANY(?::uuid[]))) "
                + "UNION ALL SELECT 'BOM' AS fact_kind,item_ref,product_sku_ref,NULL::text,NULL::uuid,NULL::text,"
                + "NULL::text,NULL::text,NULL::integer,CASE WHEN jsonb_typeof(rows)='array' "
                + "THEN jsonb_array_length(rows) ELSE -1 END AS bom_line_count "
                + "FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? "
                + "AND definition_status='ENABLED' AND option_value_ref IS NULL "
                + "AND ((product_sku_ref IS NULL AND item_ref=ANY(?::uuid[])) "
                + "OR (product_sku_ref IS NOT NULL AND product_sku_ref=ANY(?::uuid[]))) "
                + "ORDER BY item_ref,product_sku_ref NULLS FIRST,fact_kind";
        Map<SummaryKey, InventorySummaryFacts> found = new LinkedHashMap<>();
        jdbc.query(
                sql,
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
                result -> {
                    while (result.next()) {
                        UUID summaryItemRef = result.getObject(2, UUID.class);
                        UUID summarySkuRef = result.getObject(3, UUID.class);
                        // A SKU is globally identified by product_sku_ref. The caller's SKU-summary request
                        // intentionally has no itemRef, whereas the persistence row still carries its parent
                        // itemRef. Normalize both sides to the same lookup identity; item-grain summaries retain
                        // itemRef because they have no SKU identity.
                        SummaryKey key = new SummaryKey(summarySkuRef == null ? summaryItemRef : null, summarySkuRef);
                        if (found.containsKey(key))
                            // spotless:off
                            throw new InventoryOwnerApi.Problem(
                                "RESULT_UNKNOWN",
                                500,
                                "同一商品或规格存在多个启用中的库存扣减定义"
                            );
                            // spotless:on
                        String factKind = result.getString(1);
                        if ("DIRECT".equals(factKind)) {
                            if (!"DIRECT".equals(result.getString(4)))
                                // spotless:off
                                throw new InventoryOwnerApi.Problem(
                                    "RESULT_UNKNOWN",
                                    500,
                                    "库存扣减方式与库存对象定义不一致"
                                );
                                // spotless:on
                            InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, 5);
                            if (snapshot == null)
                                // spotless:off
                                throw new InventoryOwnerApi.Problem(
                                    "RESULT_UNKNOWN",
                                    500,
                                    "直接扣减对象的消费单位快照缺失"
                                );
                                // spotless:on
                            found.put(key, new InventorySummaryFacts("DIRECT", snapshot, null));
                        } else if ("BOM".equals(factKind)) {
                            int lineCount = result.getInt(10);
                            if (lineCount < 1)
                                // spotless:off
                                throw new InventoryOwnerApi.Problem(
                                    "RESULT_UNKNOWN",
                                    500,
                                    "启用中的用料扣减定义没有有效用料行"
                                );
                                // spotless:on
                            found.put(key, new InventorySummaryFacts("BOM", null, lineCount));
                        } else {
                            // spotless:off
                            throw new InventoryOwnerApi.Problem(
                                "RESULT_UNKNOWN",
                                500,
                                "库存扣减事实类型无法识别"
                            );
                            // spotless:on
                        }
                    }
                    return null;
                });
        LinkedHashSet<SummaryKey> requested = new LinkedHashSet<>();
        itemRefs.forEach(itemRef -> requested.add(new SummaryKey(itemRef, null)));
        productSkuRefs.forEach(skuRef -> requested.add(new SummaryKey(null, skuRef)));
        for (SummaryKey key : requested) {
            InventorySummaryFacts facts = found.get(key);
            ObjectNode row = items.addObject();
            if (key.itemRef() == null) row.putNull("itemRef");
            else row.put("itemRef", key.itemRef().toString());
            if (key.productSkuRef() == null) row.putNull("productSkuRef");
            else row.put("productSkuRef", key.productSkuRef().toString());
            if (facts == null) {
                row.put("mode", "NONE").putNull("consumptionUnitSnapshot").putNull("bomLineCount");
            } else {
                row.put("mode", facts.mode());
                if (facts.consumptionUnitSnapshot() == null) row.putNull("consumptionUnitSnapshot");
                else row.set("consumptionUnitSnapshot", mapper.valueToTree(facts.consumptionUnitSnapshot()));
                if (facts.bomLineCount() == null) row.putNull("bomLineCount");
                else row.put("bomLineCount", facts.bomLineCount());
            }
        }
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

    private static List<String> textArray(JsonNode value) {
        if (value == null || !value.isArray()) return List.of();
        java.util.LinkedHashSet<String> result = new java.util.LinkedHashSet<>();
        value.forEach(entry -> {
            if (entry.isTextual() && !entry.asText().isBlank()) result.add(entry.asText());
        });
        return List.copyOf(result);
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

    /** One ledger set-read supplies the three summary windows and the bounded recent-change projection. */
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
    /** Revalidates the mutable target/version before any receipt replay can return. */
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

    /** Every selected source item/BOM must still resolve before a copy receipt may be replayed. */
    private void recheckCopySourceFactsBeforeReceipt(String sourceScope, String brand, ObjectNode request) {
        List<UUID> refs = requiredOpaqueRefArray(request, "closureItemRefs");
        LocalCopySectionPlan localSections = localCopySectionPlan(request);
        SourceCopyClosure closure = sourceCopyClosure(sourceScope, brand, refs, localSections);
        if (localSections != null) return;
        if (closure.itemRefs().size() != refs.size()) {
            {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存复制来源事实已变化"));
            }
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

    private String bomOwnerIdentity(BomOwnerRow owner) {
        return owner.itemRef() + "::"
                + (owner.optionValueRef() == null
                        ? (owner.productSkuRef() == null ? "ITEM" : "SKU:" + owner.productSkuRef())
                        : "OPTION_VALUE:" + owner.optionValueRef());
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

    private ArrayNode ledgerEntries(String targetRef, int limit) {
        ArrayNode entries = mapper.createArrayNode();
        jdbc.query(
                "SELECT entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_millis,"
                        + "consumption_unit_ref,consumption_unit_code,consumption_unit_name,consumption_unit_dimension,"
                        + "consumption_unit_precision "
                        + "FROM inventory.stock_ledger WHERE target_ref=? ORDER BY occurred_at_epoch_millis DESC LIMIT "
                        + limit,
                s -> s.setObject(1, UUID.fromString(targetRef)),
                r -> {
                    while (r.next()) {
                        ObjectNode entry = entries.addObject()
                                .put("entryRef", r.getObject(1, UUID.class).toString())
                                .put("source", r.getString(2))
                                .put("reasonCode", r.getString(6) == null ? "" : r.getString(6))
                                .put("beforeQuantity", decimal(r.getBigDecimal(4)))
                                .put("changeQuantity", decimal(r.getBigDecimal(3)))
                                .put("afterQuantity", decimal(r.getBigDecimal(5)))
                                .put("occurredAt", r.getLong(7));
                        setNullableSnapshot(entry, "consumptionUnitSnapshot", unitSnapshot(r, 8));
                    }
                    return null;
                });
        return entries;
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

    /** Planned opaque target refs are execution artifacts; semantic copy facts remain in the digest. */
    private ObjectNode copyDigestSnapshot(ObjectNode snapshot) {
        ObjectNode stable = snapshot.deepCopy();
        for (String field : List.of("referenceMappings", "referenceRewritePreview")) {
            JsonNode rows = stable.path(field);
            if (!rows.isArray()) continue;
            for (JsonNode row : rows) if (row instanceof ObjectNode object) object.putNull("targetRef");
        }
        return stable;
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

    private InventoryOwnerApi.UnitSnapshot mappedUnitSnapshot(
            InventoryOwnerApi.UnitSnapshot source, Map<UUID, ReferenceMapping> mappings) {
        if (source == null) return null;
        ReferenceMapping mapping = mappings.get(source.unitRef());
        if (mapping == null || !"CATALOG_UNIT".equals(mapping.objectType()))
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "库存复制所需单位引用未完成映射");
        if (mapping.targetUnitName() == null
                || mapping.targetUnitDimension() == null
                || mapping.targetUnitPrecision() == null)
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "库存复制所需单位快照不完整");
        return new InventoryOwnerApi.UnitSnapshot(
                mapping.targetRef(),
                requiredLabel(mapping.targetCode(), "CATALOG_UNIT targetCode"),
                mapping.targetUnitName(),
                mapping.targetUnitDimension(),
                mapping.targetUnitPrecision());
    }

    private String mappedConfiguration(
            String sourceJson,
            String inventoryMode,
            InventoryOwnerApi.UnitSnapshot counting,
            BigDecimal conversionFactor) {
        JsonNode parsed = json(sourceJson);
        if (!parsed.isObject())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存配置 JSON fact is not an object");
        ObjectNode configuration = (ObjectNode) parsed.deepCopy();
        configuration.put("mode", inventoryMode);
        writeCountingConfiguration(
                configuration,
                new InventoryOwnerApi.CountingUnitConfiguration(
                        counting, conversionFactor == null ? BigDecimal.ONE : conversionFactor));
        return canonical(configuration);
    }

    private void setNullableSnapshot(ObjectNode target, String field, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) target.putNull(field);
        else target.set(field, mapper.valueToTree(snapshot));
    }

    private static String required(ObjectNode req, String key) {
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

    private static UUID opaqueRef(String value, String key) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", exception);
        }
    }

    static UUID optionalOpaqueRef(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", exception);
        }
    }

    private static List<UUID> requiredOpaqueRefArray(ObjectNode request, String key) {
        JsonNode values = request == null ? null : request.get(key);
        if (values == null || !values.isArray() || values.isEmpty())
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must contain opaque UUID refs");
        List<UUID> refs = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isTextual())
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must contain opaque UUID refs");
            try {
                refs.add(UUID.fromString(value.asText()));
            } catch (IllegalArgumentException exception) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, key + " cannot contain a business code", exception);
            }
        }
        return refs.stream().distinct().toList();
    }

    private static Map<UUID, ReferenceMapping> referenceMappings(ObjectNode request) {
        JsonNode values = request == null ? null : request.get("referenceMappings");
        if (values == null || !values.isArray())
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings is required for inventory copy");
        Map<UUID, ReferenceMapping> result = new LinkedHashMap<>();
        for (JsonNode value : values) {
            if (!value.isObject())
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings must contain objects");
            UUID sourceRef = opaqueRefValue(value, "sourceRef");
            UUID targetRef = opaqueRefValue(value, "targetRef");
            String objectType = value.path("objectType").asText("");
            if (!INVENTORY_COPY_MAPPING_TYPES.contains(objectType)) continue;
            if (result.putIfAbsent(
                            sourceRef,
                            new ReferenceMapping(
                                    objectType,
                                    targetRef,
                                    value.path("targetCode").asText(null),
                                    value.path("targetSkuCode").asText(null),
                                    value.path("targetOptionValueCode").asText(null),
                                    value.path("targetUnitName").asText(null),
                                    value.path("targetUnitDimension").asText(null),
                                    value.hasNonNull("targetUnitPrecision")
                                            ? value.path("targetUnitPrecision").asInt()
                                            : null))
                    != null) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "referenceMappings contains duplicate inventory sourceRef");
            }
        }
        // Digest-producing copy preflight must preserve the request order. A hash-table copy can reorder mappings
        // between the preflight and execute requests even when the underlying facts are unchanged.
        return result;
    }

    private static UUID opaqueRefValue(JsonNode node, String key) {
        String value = node.path(key).asText("");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", exception);
        }
    }

    private static ReferenceMapping mappingFor(
            Map<UUID, ReferenceMapping> mappings, UUID sourceRef, String objectType) {
        ReferenceMapping mapping = mappings.get(sourceRef);
        if (mapping == null || !objectType.equals(mapping.objectType()))
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "库存复制所需的引用关系无法确定");
        return mapping;
    }

    private static String requiredLabel(String value, String field) {
        if (value == null || value.isBlank())
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, field + " is required as a read label");
        return value;
    }

    private static String optional(ObjectNode req, String key) {
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

    static void requireCatalogDefinitionDataNodeType(String dataNodeType) {
        if (!Set.of("STORE", "HEAD_COMPANY").contains(dataNodeType)) {
            throw new InventoryOwnerApi.Problem(
                    ("SCOPE_FORBIDDEN"),
                    (403),
                    /* format-wrap */
                    ("商品库存定义只支持门店或总公司数据节点"));
        }
    }

    private static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    private static void requireOwnerScopeGrant(
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

    private static CatalogAuthorizationScope requireTypedContext(
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

    private static CatalogAuthorizationScope requireCatalogOrderOptionDefinitionContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String operationId = context.operationToken().operationId();
        if (Set.of(
                        "createOperationsCatalogOrderOptionDefinition",
                        "updateOperationsCatalogOrderOptionDefinition",
                        "saveOperationsCatalogItem")
                .contains(operationId)) {
            return scope;
        }
        throw new InventoryOwnerApi.Problem(
                "SCOPE_FORBIDDEN",
                403,
                /* format-wrap */
                "当前操作无权维护点单选项的扣料原材料");
    }

    private static CatalogAuthorizationScope requireTemporaryPromotionOptionBomContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if ("executeOperationsTemporaryCatalogItemPromotion"
                .equals(context.operationToken().operationId())) return scope;
        throw new InventoryOwnerApi.Problem(
                "SCOPE_FORBIDDEN",
                403,
                /* format-wrap */
                "当前操作无权复制临时商品的点单选项扣料信息");
    }

    private static CatalogAuthorizationScope requireCopyContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String operationId = context.operationToken().operationId();
        if (!Set.of(
                        "preflightOperationsBrandCatalogCopy",
                        "executeOperationsBrandCatalogCopy",
                        "preflightOperationsLocalCatalogCopy",
                        "executeOperationsLocalCatalogCopy")
                .contains(operationId)) {
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory copy context is not authorized");
        }
        return scope;
    }

    private static String copySourceDataNodeRef(CatalogAuthorizationScope scope) {
        return switch (scope.copySourcePolicy()) {
            case TARGET_SCOPE -> scope.dataNodeId().toString();
            case ORGANIZATION_JUDGMENT -> {
                if (scope.copySourceDataNodeId() == null)
                    throw new InventoryOwnerApi.Problem(
                            "SCOPE_FORBIDDEN", 403, "inventory copy source judgment is required");
                yield scope.copySourceDataNodeId().toString();
            }
            default -> throw new InventoryOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "inventory copy source policy is not authorized");
        };
    }

    private static void requireCatalogDefinitionOwnerScopeGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            String dataNodeRef,
            String expectedCapability,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || expectedCapability == null) {
            throw new InventoryOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "catalog inventory definition owner scope grant is required");
        }
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null
                    && ownerScopeGrant.matchesRequirementAndCapability(
                            workspaceUuid,
                            groupWorkspaceKey,
                            dataNodeType,
                            targetId,
                            CATALOG_ITEM_SAVE_REQUIREMENT,
                            expectedCapability)) {
                return;
            }
        } catch (RuntimeException ignored) {
        }
        throw new InventoryOwnerApi.Problem(
                "SCOPE_FORBIDDEN", 403, "catalog inventory definition owner scope grant is required");
    }

    private static String inventoryWriteCapabilityForTarget(String dataNodeType) {
        return "STORE".equals(dataNodeType) ? "EDIT_STORE_INVENTORY" : null;
    }
    /** Must stay byte-for-byte compatible with CatalogOwnerService's SKU lifecycle lock. */
    private void lockProductSkuRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x43534B55, refs);
    }
    /** Must stay byte-for-byte compatible with CatalogOwnerService's item lifecycle lock. */
    private void lockCatalogItemRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
    }
    /**
     * Catalog option-value definitions share no dictionary lifecycle, but their BOM cleanup still needs a stable lock.
     */
    private void lockCatalogOptionValueRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x434F5056, refs);
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

    private record CatalogDefinitionFacts(
            List<TargetRow> directTargets, List<CatalogBomRow> bomOwners, Map<UUID, TargetRow> componentTargets) {}

    private record CurrentLedgerFacts(Map<String, ObjectNode> summaries, ArrayNode recentChanges) {}

    private record TargetConsumptionUnitRow(UUID targetRef, UUID productSkuRef, UUID consumptionUnitRef) {}

    private record CatalogMaterialTargetRow(
            UUID itemRef, UUID targetRef, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    private record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

    private record CatalogTargetDisplay(String itemCode, String itemName, String skuCode, String skuName) {}

    private record SummaryKey(UUID itemRef, UUID productSkuRef) {}

    private record InventorySummaryFacts(
            String mode, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot, Integer bomLineCount) {}

    private record TargetConfigurationRow(UUID itemRef, UUID targetRef, String configuration) {}

    private record PlannedTarget(
            TargetRow source,
            ReferenceMapping itemMapping,
            ReferenceMapping skuMapping,
            ReferenceMapping targetMapping) {}

    private record BomOwnerRow(
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode,
            long version,
            String rows) {}

    private String stockTargetCompatibilityId(TargetRow source) {
        return "STOCK_TARGET:" + source.itemRef() + ":"
                + (source.productSkuRef() == null ? "-" : source.productSkuRef());
    }

    private record CatalogBomRow(
            UUID productSkuRef,
            UUID optionValueRef,
            String skuCode,
            String optionValueCode,
            long version,
            String rows) {}

    private record PreparedBom(
            ReferenceMapping item, ReferenceMapping sku, ReferenceMapping option, long version, String rows) {}

    private record LocalCopySectionPlan(Set<String> selected) {}

    private record SourceCopyClosure(
            List<UUID> itemRefs,
            List<TargetRow> targets,
            List<BomOwnerRow> bomOwners,
            List<InventoryOwnerApi.LocalCopySkippedReadback> skipped) {}

    private record PreflightCopyResult(JsonNode judgement, Map<TargetIdentity, TargetRow> targetRows) {}

    private record PreparedCopy(
            SourceCopyClosure sourceClosure,
            JsonNode judgement,
            Map<TargetIdentity, TargetRow> preflightTargetRows,
            InventoryOwnerApi.LocalCopyPreflightReadback readback)
            implements InventoryOwnerApi.CopyExecutionPreparation {
        @Override
        public InventoryOwnerApi.LocalCopyPreflightReadback preflight() {
            return readback;
        }
    }

    private record ReferenceMapping(
            String objectType,
            UUID targetRef,
            String targetCode,
            String targetSkuCode,
            String targetOptionValueCode,
            String targetUnitName,
            String targetUnitDimension,
            Integer targetUnitPrecision) {}

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

    private record CatalogVoidBatchSqlOutcome(
            long inboundCount,
            boolean inboundResolvable,
            String inboundSummary,
            long retiredTargetCount,
            long retiredBomCount,
            long remainingCount,
            String priorOperation,
            String priorRequestHash,
            String priorResponse,
            String writtenResponse) {}

    private record Receipt(String operation, String requestHash, JsonNode response) {}
}
