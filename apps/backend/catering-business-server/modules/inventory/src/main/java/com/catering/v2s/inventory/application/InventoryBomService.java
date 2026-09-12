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

/** Concrete Inventory bom owner. */
@Service
public class InventoryBomService {
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

    public InventoryBomService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
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

    @Transactional(readOnly = true)
    public JsonNode readCatalogInventoryConsumptionTargetCandidates(
            String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        requireCatalogDefinitionDataNodeType(dataNodeType);
        requireScope(scope, brand);
        return consumptionTargetCandidates(scope, brand, request, requestId);
    }

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

    private void requireCatalogBusinessName(String name, String missingMessage) {
        if (name == null || name.isBlank()) throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, missingMessage);
    }

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

    private long generation(String scope, String brand) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                scope,
                brand);
        return value == null ? 0 : value;
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

    private void lockProductSkuRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x43534B55, refs);
    }

    private void lockCatalogItemRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
    }

    private void lockCatalogOptionValueRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x434F5056, refs);
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



    private record CatalogMaterialTargetRow(
            UUID itemRef, UUID targetRef, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    private record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

    private record CatalogTargetDisplay(String itemCode, String itemName, String skuCode, String skuName) {}

    private record SummaryKey(UUID itemRef, UUID productSkuRef) {}

    private record InventorySummaryFacts(
            String mode, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot, Integer bomLineCount) {}



    private record CatalogBomRow(
            UUID productSkuRef,
            UUID optionValueRef,
            String skuCode,
            String optionValueCode,
            long version,
            String rows) {}










    private record Receipt(String operation, String requestHash, JsonNode response) {}
}
