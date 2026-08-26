package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.foundation.runtime.RuntimeEnvironmentKeys;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application coordinator: reads may task-join facts, writes call owner commands in one REQUIRED transaction. */
@Service
public class CatalogInventoryCoordinator {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final String COPY_SOURCE_UNAVAILABLE = "COPY_SOURCE_UNAVAILABLE";
    private static final Set<String> CATALOG_READS = Set.of(
            "getOperationsCatalogWorkbenchContext",
            "getOperationsCatalogNavigation",
            "getOperationsCatalogItems",
            "getOperationsCatalogCategoryCandidates",
            "getOperationsCatalogItem",
            "getOperationsCatalogItemSkus",
            "getOperationsCatalogDictionary",
            "getOperationsLocalCatalogCopyCandidates",
            "getOperationsBrandCatalogCopyCandidates",
            "getOperationsCatalogShapeManifest");
    private static final Set<String> INVENTORY_READS = Set.of(
            "getOperationsInventoryTargets",
            "getOperationsInventoryTarget",
            "getOperationsInventoryTargetChangeSummary",
            "getOperationsInventoryTargetBusinessHistory",
            "getOperationsInventoryTargetConsumptionReferences",
            "getOperationsInventoryTargetLedger",
            "getOperationsInventoryTargetDiagnostics");

    private final CatalogOwnerApi catalog;
    private final InventoryOwnerApi inventory;
    private final ProductionTagOwnerApi production;
    private final PlatformAssetService assets;
    private final CatalogAssetCommandApi assetCommands;
    private final ObjectMapper mapper;
    private final TimeProvider time;
    private final CatalogScopeLookup catalogScopes;
    private final CommandExecutionContextResolver commandContexts;
    private final CatalogTaskReadService catalogReads;

    public CatalogInventoryCoordinator(
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            ProductionTagOwnerApi production,
            PlatformAssetService assets,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogScopeLookup catalogScopes) {
        this(catalog, inventory, production, assets, mapper, time, catalogScopes, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CatalogInventoryCoordinator(
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            ProductionTagOwnerApi production,
            PlatformAssetService assets,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogScopeLookup catalogScopes,
            CommandExecutionContextResolver commandContexts) {
        this.catalog = catalog;
        this.inventory = inventory;
        this.production = production;
        this.assets = assets;
        this.assetCommands = assets;
        this.mapper = mapper;
        this.time = time;
        this.catalogScopes = catalogScopes;
        this.commandContexts = commandContexts;
        this.catalogReads = new CatalogTaskReadService(catalog);
    }

    public JsonNode readCatalogWorkbenchContext(
            String dataNodeRef,
            String brandRef,
            String requestId,
            String dataNodeType,
            String headCompanyRef,
            UUID workspaceUuid,
            String groupWorkspaceKey) {
        JsonNode result = catalogReads.workbenchContext(dataNodeRef, brandRef, requestId);
        enrichWorkbenchContext(
                result, dataNodeRef, brandRef, dataNodeType, headCompanyRef, workspaceUuid, groupWorkspaceKey);
        return result;
    }

    public JsonNode readCatalogNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.navigation(dataNodeRef, brandRef, request, requestId);
    }

    public JsonNode readCatalogItems(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        JsonNode result = catalogReads.items(dataNodeRef, brandRef, request, requestId);
        enrichCatalogItems(result, dataNodeRef, brandRef, requestId, dataNodeType);
        return result;
    }

    public JsonNode readCatalogCategoryCandidates(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.categoryCandidates(dataNodeRef, brandRef, request, requestId);
    }

    public JsonNode readCatalogItemSkus(
            String dataNodeRef,
            String brandRef,
            String itemCode,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        JsonNode result = catalogReads.itemSkus(dataNodeRef, brandRef, itemCode, request, requestId);
        enrichCatalogSkuItems(result, dataNodeRef, brandRef, requestId, dataNodeType);
        return result;
    }

    public JsonNode readCatalogItem(
            String dataNodeRef, String brandRef, String itemCode, ObjectNode request, String requestId) {
        JsonNode result = catalogReads.item(dataNodeRef, brandRef, itemCode, requestId);
        enrichInventory(result, dataNodeRef, brandRef, request, requestId);
        return result;
    }

    public JsonNode readCatalogDictionary(
            String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId) {
        return catalogReads.dictionary(dataNodeRef, brandRef, dictionaryKind, request, requestId);
    }

    public JsonNode readLocalCatalogCopyCandidates(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.localCopyCandidates(dataNodeRef, brandRef, request, requestId);
    }

    public JsonNode readBrandCatalogCopyCandidates(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.brandCopyCandidates(dataNodeRef, brandRef, request, requestId);
    }

    public JsonNode readCatalogShapeManifest(String requestId) {
        return catalogReads.shapeManifest(requestId);
    }

    /** Bounded library reads stay in the catalog owner; the edge must not reconstruct either definition aggregate. */
    public CatalogOwnerApi.AttributeDefinitionListReadback listAttributeDefinitions(
            String dataNodeRef, String brandRef) {
        return catalog.listAttributeDefinitions(dataNodeRef, brandRef);
    }

    /** Unit-library filtering is a catalog owner read; the coordinator does not derive its membership. */
    @Transactional(readOnly = true)
    public CatalogOwnerApi.UnitDefinitionListReadback listUnitDefinitions(
            String dataNodeRef,
            String brandRef,
            boolean includeInactive,
            CatalogOwnerApi.UnitDimension dimension,
            String query,
            String status) {
        return catalog.listUnitDefinitions(dataNodeRef, brandRef, includeInactive, dimension, query, status);
    }

    /** Bounded library reads stay in the catalog owner; the edge must not reconstruct either definition aggregate. */
    public CatalogOwnerApi.OrderOptionDefinitionListReadback listOrderOptionDefinitions(
            String dataNodeRef, String brandRef) {
        return catalog.listOrderOptionDefinitions(dataNodeRef, brandRef);
    }

    /**
     * The edge submits only a material product. Inventory resolves its usable StockTarget before catalog writes the
     * definition template; catalog never reads the inventory schema.
     */
    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionReadback createOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionCreateCommand command,
            String idempotencyKey) {
        return catalog.createOrderOptionDefinition(context, resolveMaterialTargets(context, command), idempotencyKey);
    }

    /**
     * A removed value is detected only as an aggregate update difference and its BOM is removed in this transaction.
     */
    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionMutationReadback updateOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogOwnerApi.OrderOptionDefinitionMutationReadback result =
                catalog.updateOrderOptionDefinition(context, resolveMaterialTargets(context, command), idempotencyKey);
        deleteOptionValueBoms(context, result.deletedDefinitionValueRefs(), idempotencyKey);
        return result;
    }

    /** Whole-group deletion cascades current config facts and only matching option-value BOM rows. */
    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionDeleteReadback deleteOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionDeleteCommand command,
            String idempotencyKey) {
        CatalogOwnerApi.OrderOptionDefinitionDeleteReadback result =
                catalog.deleteOrderOptionDefinition(context, command, idempotencyKey);
        deleteOptionValueBoms(context, result.deletedDefinitionValueRefs(), idempotencyKey);
        return result;
    }

    /**
     * A temporary item promoted under a new code receives a new item identity. Catalog copies its relational definition
     * facts, then inventory clones only the matching option-value BOM owners in this REQUIRED transaction.
     */
    @Transactional
    public CatalogOwnerApi.CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionExecuteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = context.ownerScope();
        JsonNode sourceDetail = catalog.readItem(
                scope.dataNodeId().toString(), scope.brandRef(), command.itemCode(), context.requestId());
        UUID sourceItemRef = requiredUuid(sourceDetail.path("data").path("item").path("itemRef"), "临时商品引用");
        CatalogOwnerApi.CatalogItemCommandReadback result =
                catalog.executeTemporaryCatalogItemPromotion(context, command, idempotencyKey);
        if (command.itemCode().equals(command.formalCode())) return result;
        JsonNode detail = catalog.readItem(
                scope.dataNodeId().toString(), scope.brandRef(), command.formalCode(), context.requestId());
        copyPromotedInventoryTargets(
                context,
                sourceItemRef,
                sourceDetail.path("data").path("item"),
                requiredUuid(result.resourceRef(), "转正商品引用"),
                detail.path("data").path("item"),
                idempotencyKey);
        List<UUID> valueRefs =
                definitionValueRefs(detail.path("data").path("item").path("orderOptionConfigs"));
        if (!valueRefs.isEmpty()) {
            inventory.copyCatalogOptionValueBoms(
                    context,
                    new InventoryOwnerApi.CatalogOptionValueBomCopyCommand(
                            sourceItemRef,
                            requiredUuid(result.resourceRef(), "转正商品引用"),
                            command.formalCode(),
                            valueRefs),
                    idempotencyKey + ":temporary-promotion-option-value-boms");
        }
        return result;
    }

    private void copyPromotedInventoryTargets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID sourceItemRef,
            JsonNode sourceItem,
            UUID targetItemRef,
            JsonNode targetItem,
            String idempotencyKey) {
        JsonNode definition = inventory.readCatalogInventoryDefinition(
                context.ownerScope().dataNodeId().toString(),
                context.ownerScope().brandRef(),
                sourceItemRef.toString(),
                context.requestId());
        JsonNode sourceNodes = definition.path("data").path("inventoryRules").path("nodes");
        if (!sourceNodes.isArray()) return;
        String measureMode = sourceItem.path("measureMode").asText("");
        if (measureMode.isBlank())
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    /* format-wrap */
                    "临时商品缺少 measureMode");
        for (JsonNode sourceNode : sourceNodes) {
            String mode = sourceNode.path("mode").asText("");
            if (mode.isBlank())
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        500,
                        /* format-wrap */
                        "临时商品库存对象缺少 inventory mode");
            if (!"DIRECT".equals(mode)) continue;
            String skuCode = sourceNode.path("skuCode").asText("");
            JsonNode targetSku = skuCode.isBlank() ? null : findSku(targetItem.path("skus"), skuCode);
            String productSkuRef =
                    targetSku == null ? null : requiredOpaqueTaskRef(targetSku, "productSkuRef", "转正商品 SKU");
            JsonNode consumption =
                    skuCode.isBlank() ? targetItem.path("baseMeasureUnit") : targetSku.path("baseMeasureUnit");
            if (!consumption.isObject())
                throw new CatalogOwnerApi.Problem(
                        "BASE_MEASURE_UNIT_REQUIRED",
                        422,
                        /* format-wrap */
                        "转正商品库存对象缺少基础计量单位");
            ObjectNode request = mapper.createObjectNode()
                    .put("itemRef", targetItemRef.toString())
                    .put("itemCode", targetItem.path("code").asText())
                    .put("mode", mode)
                    .put("measureMode", measureMode)
                    .set("consumptionUnitSnapshot", consumption.deepCopy());
            if (productSkuRef == null) request.putNull("productSkuRef");
            else request.put("productSkuRef", productSkuRef);
            if (skuCode.isBlank()) request.putNull("skuCode");
            else request.put("skuCode", skuCode);
            ObjectNode configuration = sourceNode.path("configuration").isObject()
                    ? ((ObjectNode) sourceNode.path("configuration")).deepCopy()
                    : mapper.createObjectNode();
            JsonNode counting = configuration.path("countingUnitSnapshot");
            if (counting.isObject() && counting.hasNonNull("unitRef"))
                configuration.put("countingUnitRef", counting.path("unitRef").asText());
            request.set("configuration", configuration);
            inventory.ensureCatalogItemSaveTarget(
                    context,
                    new InventoryOwnerApi.CatalogItemSaveEnsureTargetCommand(canonicalLocalJson(request)),
                    idempotencyKey + ":temporary-promotion-target:" + (skuCode.isBlank() ? "ITEM" : skuCode));
        }
    }

    private static JsonNode findSku(JsonNode skus, String skuCode) {
        if (skus.isArray())
            for (JsonNode sku : skus) if (skuCode.equals(sku.path("skuCode").asText())) return sku;
        throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "转正商品缺少源 SKU");
    }

    private static List<UUID> definitionValueRefs(JsonNode configs) {
        if (!configs.isArray()) return List.of();
        java.util.LinkedHashSet<UUID> refs = new java.util.LinkedHashSet<>();
        for (JsonNode config : configs)
            if (config.path("values").isArray())
                for (JsonNode value : config.path("values"))
                    refs.add(requiredUuid(value.path("definitionValueRef"), "点单选项库值引用"));
        return List.copyOf(refs);
    }

    private static UUID requiredUuid(JsonNode value, String field) {
        if (!value.isTextual())
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    field +
                            /* format-wrap */
                            "缺失，无法复制转正后的扣料事实");
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException invalid) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    field +
                            /* format-wrap */
                            "无效，无法复制转正后的扣料事实",
                    invalid);
        }
    }

    private static UUID requiredUuid(String value, String field) {
        if (value == null || value.isBlank())
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    field +
                            /* format-wrap */
                            "缺失，无法复制转正后的扣料事实");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException invalid) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    field +
                            /* format-wrap */
                            "无效，无法复制转正后的扣料事实",
                    invalid);
        }
    }

    public JsonNode readInventoryTargets(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        // Catalog name/code/category predicates are part of the explicit inventory
        // page task-read. Do not materialize the complete catalog into an
        // application-side IN list: the owner query applies scoped EXISTS and
        // only pages inventory rows.
        JsonNode result =
                primaryRead(() -> inventory.readTargets(dataNodeRef, brandRef, request, requestId, dataNodeType));
        enrichInventoryTargets(result, dataNodeRef, brandRef, requestId, null);
        return result;
    }

    public JsonNode readInventoryConsumptionTargetCandidates(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        return primaryRead(() -> inventory.readCatalogInventoryConsumptionTargetCandidates(
                dataNodeRef, brandRef, request, requestId, dataNodeType));
    }

    public JsonNode readInventoryTarget(
            String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType) {
        JsonNode result =
                primaryRead(() -> inventory.readTarget(dataNodeRef, brandRef, targetRef, requestId, dataNodeType));
        enrichInventoryTarget(result, dataNodeRef, brandRef, requestId);
        return result;
    }

    public JsonNode readInventoryTargetChangeSummary(
            String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType) {
        return primaryRead(
                () -> inventory.readTargetChangeSummary(dataNodeRef, brandRef, targetRef, period, dataNodeType));
    }

    public JsonNode readInventoryTargetBusinessHistory(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        return primaryRead(() -> inventory.readTargetBusinessHistory(
                dataNodeRef, brandRef, targetRef, request, requestId, dataNodeType));
    }

    public JsonNode readInventoryTargetConsumptionReferences(
            String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId) {
        JsonNode result = primaryRead(
                () -> inventory.readTargetConsumptionReferences(dataNodeRef, brandRef, targetRef, request, requestId));
        enrichInventoryConsumptionReferences(result, dataNodeRef, brandRef, requestId);
        return result;
    }

    public JsonNode readInventoryTargetLedger(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        return primaryRead(
                () -> inventory.readTargetLedger(dataNodeRef, brandRef, targetRef, request, requestId, dataNodeType));
    }

    public JsonNode readInventoryTargetDiagnostics(String targetRef, String requestId) {
        return primaryRead(() -> inventory.readTargetDiagnostics(targetRef, requestId));
    }

    public JsonNode readProductionTags(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return primaryRead(() -> production.readTags(dataNodeRef, brandRef, request, requestId));
    }

    /**
     * One save composition: catalog remains authoritative for the item and global asset-reference judgment; inventory
     * and asset owners receive only their typed, immutable command inputs.
     */
    @Transactional
    public CatalogOwnerApi.CatalogItemSaveReadback saveCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemSaveCommand command,
            List<CatalogAssetCommandApi.AssetBinding> submittedBindings,
            String idempotencyKey) {
        ObjectNode request = canonicalSaveRequest(command.canonicalRequestJson());
        CatalogAuthorizationScope scope = context.ownerScope();
        CatalogOwnerApi.CatalogItemSaveCommand normalizedCommand =
                new CatalogOwnerApi.CatalogItemSaveCommand(command.itemCode(), canonicalLocalJson(request));
        CatalogOwnerApi.CatalogItemSaveReadback readback =
                catalog.saveCatalogItem(context, normalizedCommand, idempotencyKey);
        Set<String> previousAssetRefs = readback.projection() == null
                ? catalogItemAssetRefs(
                        scope.dataNodeId().toString(), scope.brandRef(), command.itemCode(), context.requestId())
                : readback.projection().previousAssetRefs();
        CatalogInventoryProjection projection = readback.projection() == null
                ? catalogInventoryProjection(
                        scope.dataNodeId().toString(),
                        scope.brandRef(),
                        request.path("itemCode").asText(),
                        context.requestId())
                : catalogInventoryProjection(scope.dataNodeId().toString(), scope.brandRef(), readback.projection());
        JsonNode inventoryReadback = coordinateReplaceInventoryRules(context, request, projection, idempotencyKey);
        settleWorkspaceCatalogAssets(context, request, previousAssetRefs, idempotencyKey, submittedBindings);
        return mergeInventorySaveReadback(readback, inventoryReadback);
    }

    private CatalogOwnerApi.CatalogItemSaveReadback mergeInventorySaveReadback(
            CatalogOwnerApi.CatalogItemSaveReadback catalogReadback, JsonNode inventoryReadback) {
        try {
            ObjectNode root = (ObjectNode) mapper.readTree(catalogReadback.canonicalJson());
            JsonNode inventoryRules = inventoryReadback == null ? null : inventoryReadback.path("inventoryRules");
            if (inventoryRules == null || !inventoryRules.isObject())
                inventoryRules = inventoryReadback == null
                        ? null
                        : inventoryReadback.path("data").path("inventoryRules");
            if (inventoryRules == null || !inventoryRules.isObject())
                inventoryRules = mapper.createObjectNode().putArray("nodes");
            if (root.path("result") instanceof ObjectNode result) {
                result.set("inventoryRules", inventoryRules.deepCopy());
            } else throw new IllegalStateException("catalog save readback result is not an object");
            return new CatalogOwnerApi.CatalogItemSaveReadback(canonicalLocalJson(root), catalogReadback.projection());
        } catch (Exception failure) {
            throw inventoryRulesReadbackProblem(failure);
        }
    }

    private CatalogOwnerApi.Problem inventoryRulesReadbackProblem(Exception failure) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品库存规则保存后无法读取", failure);
    }
    /** Typed local-copy composition with catalog and inventory owner-native commands. */
    public record LocalCopyPreflightReadback(String canonicalJson) {}

    public LocalCopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        JsonNode catalogPreflight =
                parseLocalCopyJson(catalog.preflightLocalCopy(context, command).canonicalJson());
        CopyReferencePlan plan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightLocalInventory(context, command, plan);
        String combined = combinedDigest(
                preflightData(catalogPreflight).path("preflightDigest").asText(), owners.inventoryDigest(), "");
        JsonNode merged = mergeCopyPreflight(catalogPreflight, owners, combined);
        return new LocalCopyPreflightReadback(canonicalLocalCopyJson(merged));
    }

    public record LocalCopyExecutionReadback(
            CatalogOwnerApi.CopyExecutionReadback catalog, List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks) {}

    @Transactional
    public LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String submittedDigest,
            String idempotencyKey) {
        CatalogOwnerApi.LocalCopyPreflightCommand current = new CatalogOwnerApi.LocalCopyPreflightCommand(
                command.sourceItemCode(), command.targetItemCode(), command.selectedSections());
        CatalogOwnerApi.LocalCopyExecutionPreparation catalogPreparation = catalog.prepareLocalCopy(context, current);
        JsonNode catalogPreflight =
                parseLocalCopyJson(catalogPreparation.preflight().canonicalJson());
        // mergeCopyPreflight mutates the catalog envelope in place by appending
        // owner facts. Preserve the catalog-only compatibility boundary before
        // that merge so catalog never receives an inventory disposition.
        JsonNode catalogCompatibilityResults =
                preflightData(catalogPreflight).path("compatibilityResults").deepCopy();
        CopyReferencePlan plan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightLocalInventory(context, current, plan);
        String catalogDigest =
                preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), "");
        if (!combined.equals(submittedDigest))
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        JsonNode mergedPreflight = mergeCopyPreflight(catalogPreflight, owners, combined);
        validateCompatibilityDispositions(
                preflightData(mergedPreflight).path("compatibilityResults"), command.compatibilityDispositions());
        List<CatalogOwnerApi.CompatibilityDisposition> catalogDispositions = filterCatalogCompatibilityDispositions(
                catalogCompatibilityResults, command.compatibilityDispositions());
        CopyReferencePlan executionPlan = plan.merge(ownerReferencePlan(owners.inventoryJudgement()));
        CatalogOwnerApi.CopyExecutionReadback catalogReadback = catalog.executeLocalCopy(
                context,
                new CatalogOwnerApi.LocalCopyExecuteCommand(
                        command.sourceItemCode(),
                        command.targetItemCode(),
                        command.selectedSections(),
                        catalogDigest,
                        command.expectedSourceVersion(),
                        command.expectedTargetVersion(),
                        canonicalReferencePlan(plan),
                        catalogDispositions),
                idempotencyKey,
                catalogPreparation);
        java.util.ArrayList<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks =
                new java.util.ArrayList<>(catalogReadback.ownerReadbacks());
        List<CatalogOwnerApi.CopySkippedReadback> skipped = new java.util.ArrayList<>(catalogReadback.skipped());
        if (owners.inventoryDigest() != null && !owners.inventoryDigest().isBlank()) {
            InventoryOwnerApi.LocalCopyExecutionReadback inventoryReadback = inventory.executeLocalCopy(
                    context,
                    new InventoryOwnerApi.LocalCopyExecuteCommand(
                            command.sourceItemCode(),
                            command.targetItemCode(),
                            command.selectedSections(),
                            owners.inventoryDigest(),
                            canonicalReferencePlan(executionPlan)),
                    idempotencyKey,
                    owners.inventoryPreparation());
            ownerReadbacks.add(new CatalogOwnerApi.CopyOwnerReadback(
                    inventoryReadback.owner(), inventoryReadback.status(), inventoryReadback.version()));
            inventoryReadback
                    .skipped()
                    .forEach(entry ->
                            skipped.add(new CatalogOwnerApi.CopySkippedReadback(entry.section(), entry.reasonCode())));
        }
        CatalogOwnerApi.CopyExecutionReadback mergedCatalogReadback = new CatalogOwnerApi.CopyExecutionReadback(
                catalogReadback.preflightDigest(),
                catalogReadback.created(),
                catalogReadback.reused(),
                List.copyOf(skipped),
                catalogReadback.referenceMappings(),
                catalogReadback.targetVersions(),
                List.copyOf(ownerReadbacks));
        return new LocalCopyExecutionReadback(mergedCatalogReadback, List.copyOf(ownerReadbacks));
    }

    private OwnerPreflight preflightLocalInventory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command,
            CopyReferencePlan plan) {
        if (!containsInventorySection(
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()))) {
            return new OwnerPreflight("", "", null, null, null);
        }
        InventoryOwnerApi.CopyExecutionPreparation preparation = inventory.prepareLocalCopy(
                context,
                new InventoryOwnerApi.LocalCopyPreflightCommand(
                        command.targetItemCode(), command.selectedSections(), canonicalReferencePlan(plan)));
        InventoryOwnerApi.LocalCopyPreflightReadback readback = preparation.preflight();
        JsonNode judgement = parseLocalCopyJson(readback.canonicalJson());
        return new OwnerPreflight(readback.preflightDigest(), "", judgement, null, preparation);
    }

    /**
     * One brand-copy composition operation: owners return typed opaque readbacks; this coordinator only merges them.
     */
    public BrandCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        JsonNode catalogPreflight =
                parseLocalCopyJson(catalog.preflightBrandCopy(context, command).canonicalJson());
        CopyReferencePlan catalogPlan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightBrandOwners(context, command, catalogPlan);
        String combined = combinedDigest(
                preflightData(catalogPreflight).path("preflightDigest").asText(),
                owners.inventoryDigest(),
                owners.productionDigest());
        return new BrandCopyPreflightReadback(
                canonicalLocalCopyJson(mergeCopyPreflight(catalogPreflight, owners, combined)));
    }

    public record BrandCopyExecutionReadback(
            CatalogOwnerApi.CopyExecutionReadback catalog, List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks) {}

    @Transactional
    public BrandCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String submittedDigest,
            String idempotencyKey) {
        return executeBrandCopy(context, command, submittedDigest, idempotencyKey, null);
    }

    @Transactional
    public BrandCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String submittedDigest,
            String idempotencyKey,
            String testFailurePoint) {
        CatalogOwnerApi.BrandCopyPreflightCommand current =
                new CatalogOwnerApi.BrandCopyPreflightCommand(command.selectedItemCodes(), command.targetDataNodeRef());
        CatalogOwnerApi.BrandCopyExecutionPreparation catalogPreparation = catalog.prepareBrandCopy(context, current);
        JsonNode catalogPreflight =
                parseLocalCopyJson(catalogPreparation.preflight().canonicalJson());
        // The merged envelope is mutable; retain the catalog-only rows before
        // owner compatibility facts are appended for the catalog command.
        JsonNode catalogCompatibilityResults =
                preflightData(catalogPreflight).path("compatibilityResults").deepCopy();
        CopyReferencePlan catalogPlan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightBrandOwners(context, current, catalogPlan);
        String catalogDigest =
                preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), owners.productionDigest());
        if (!combined.equals(submittedDigest))
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (preflightData(catalogPreflight) instanceof ObjectNode data) enforceMergedClosureLimit(data);
        JsonNode mergedPreflight = mergeCopyPreflight(catalogPreflight, owners, combined);
        validateCompatibilityDispositions(
                preflightData(mergedPreflight).path("compatibilityResults"), command.compatibilityDispositions());
        CopyReferencePlan executionPlan = catalogPlan
                .merge(ownerReferencePlan(owners.inventoryJudgement()))
                .merge(ownerReferencePlan(owners.productionJudgement()));
        List<CatalogOwnerApi.CompatibilityDisposition> catalogDispositions = filterCatalogCompatibilityDispositions(
                catalogCompatibilityResults, command.compatibilityDispositions());
        CatalogOwnerApi.CopyExecutionReadback catalogReadback = catalog.executeBrandCopy(
                context,
                new CatalogOwnerApi.BrandCopyExecuteCommand(
                        command.selectedItemCodes(),
                        command.targetDataNodeRef(),
                        catalogDigest,
                        command.expectedSourceVersion(),
                        command.expectedTargetVersion(),
                        canonicalReferencePlan(executionPlan),
                        catalogDispositions),
                idempotencyKey,
                catalogPreparation);
        failForManagedTestPoint(
                testFailurePoint,
                "owner-failure",
                "RESULT_UNKNOWN",
                500,
                /* format-wrap */
                "受控 owner failure fixture");
        java.util.ArrayList<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks =
                new java.util.ArrayList<>(catalogReadback.ownerReadbacks());
        InventoryOwnerApi.LocalCopyExecutionReadback inventoryReadback = inventory.executeBrandCopy(
                context,
                new InventoryOwnerApi.BrandCopyExecuteCommand(
                        command.selectedItemCodes(),
                        command.targetDataNodeRef(),
                        owners.inventoryDigest(),
                        canonicalReferencePlan(executionPlan)),
                idempotencyKey,
                owners.inventoryPreparation());
        ownerReadbacks.add(new CatalogOwnerApi.CopyOwnerReadback(
                inventoryReadback.owner(), inventoryReadback.status(), inventoryReadback.version()));
        ProductionTagOwnerApi.BrandCopyExecutionReadback productionReadback = production.executeBrandCopy(
                context,
                new ProductionTagOwnerApi.BrandCopyExecuteCommand(
                        command.selectedItemCodes(),
                        command.targetDataNodeRef(),
                        owners.productionDigest(),
                        canonicalReferencePlan(executionPlan)),
                idempotencyKey);
        ownerReadbacks.add(new CatalogOwnerApi.CopyOwnerReadback(
                productionReadback.owner(), productionReadback.status(), productionReadback.version()));
        return new BrandCopyExecutionReadback(catalogReadback, List.copyOf(ownerReadbacks));
    }

    private OwnerPreflight preflightBrandOwners(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command,
            CopyReferencePlan catalogPlan) {
        String plan = canonicalReferencePlan(catalogPlan);
        InventoryOwnerApi.CopyExecutionPreparation inventoryPreparation = inventory.prepareBrandCopy(
                context,
                new InventoryOwnerApi.BrandCopyPreflightCommand(
                        command.selectedItemCodes(), command.targetDataNodeRef(), plan));
        InventoryOwnerApi.LocalCopyPreflightReadback inventoryReadback = inventoryPreparation.preflight();
        ProductionTagOwnerApi.BrandCopyPreflightReadback productionReadback = production.preflightBrandCopy(
                context,
                new ProductionTagOwnerApi.BrandCopyPreflightCommand(
                        command.selectedItemCodes(), command.targetDataNodeRef(), plan));
        return new OwnerPreflight(
                inventoryReadback.preflightDigest(),
                productionReadback.preflightDigest(),
                parseLocalCopyJson(inventoryReadback.canonicalJson()),
                parseLocalCopyJson(productionReadback.canonicalJson()),
                inventoryPreparation);
    }

    public record BrandCopyPreflightReadback(String canonicalJson) {}

    private JsonNode parseLocalCopyJson(String canonicalJson) {
        try {
            var envelope = mapper.readTree(canonicalJson);
            if (!envelope.path("data").isObject()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "owner copy readback data is invalid");
            }
            return envelope;
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "owner copy readback is invalid", failure);
        }
    }

    private String canonicalLocalCopyJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException("copy composition could not encode readback", failure);
        }
    }

    private String canonicalReferencePlan(CopyReferencePlan plan) {
        ObjectNode value = mapper.createObjectNode();
        value.set("closureItemRefs", plan.closureItemRefs().deepCopy());
        value.set(
                "productionTagDefinitionRefs",
                plan.productionTagDefinitionRefs().deepCopy());
        value.set("referenceMappings", plan.referenceMappings().deepCopy());
        return canonicalLocalCopyJson(value);
    }

    /**
     * Rebuilds the inventory owner set from the catalog task-read after catalog save. Client owner refs are only
     * evidence to validate; the command sent to inventory uses this derived set so the UI cannot create a second owner
     * grain or pair a SKU/option with the wrong item.
     */
    private JsonNode coordinateReplaceInventoryRules(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ObjectNode request,
            CatalogInventoryProjection projection,
            String idempotencyKey) {
        JsonNode submitted = request.path("sections").path("inventoryRules").path("nodes");
        if (!submitted.isArray()) {
            String detail = "商品库存规则必须为 owner 节点列表";
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, detail);
        }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> countingUnits =
                countingUnitDefinitions(projection.dataNodeRef(), projection.brandRef(), submitted);
        ObjectNode command = mapper.createObjectNode()
                .put("itemRef", projection.itemRef())
                .put("itemCode", projection.itemCode())
                .put("measureMode", projection.measureMode());
        ArrayNode derived = command.putArray("nodes");
        Set<String> consumedSubmitted = new java.util.HashSet<>();
        String shape = projection.shapeKey();
        if (!Set.of("COMPOSITE", "SERVICE", "BENEFIT_SHELL").contains(shape)) {
            appendDerivedInventoryRule(
                    derived, submitted, consumedSubmitted, projection, countingUnits, "ITEM", null, null);
        }
        if ("SKU_VARIANT_SALE_COUNTED".equals(shape)) {
            for (Map.Entry<String, String> sku : projection.productSkuRefs().entrySet())
                appendDerivedInventoryRule(
                        derived, submitted, consumedSubmitted, projection, countingUnits, "SKU", sku.getKey(), null);
        }
        if (Set.of("STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED").contains(shape)) {
            for (Map.Entry<String, String> option : projection.optionValueRefs().entrySet())
                appendDerivedInventoryRule(
                        derived,
                        submitted,
                        consumedSubmitted,
                        projection,
                        countingUnits,
                        "OPTION_VALUE",
                        null,
                        option.getKey());
        }
        for (JsonNode raw : submitted) {
            String key = submittedOwnerKey(raw.path("owner"));
            if (!consumedSubmitted.contains(key)) {
                String detail = "提交的库存 owner 不属于当前商品形态";
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, detail);
            }
        }
        InventoryOwnerApi.CatalogItemSaveReadback inventoryReadback = inventory.replaceCatalogInventoryRules(
                context,
                new InventoryOwnerApi.CatalogInventoryRulesReplaceCommand(canonicalLocalJson(command)),
                idempotencyKey + ":inventory-rules");
        try {
            return mapper.readTree(inventoryReadback.canonicalJson());
        } catch (Exception failure) {
            throw inventoryRulesReadbackProblem(failure);
        }
    }

    private void appendDerivedInventoryRule(
            ArrayNode target,
            JsonNode submitted,
            Set<String> consumedSubmitted,
            CatalogInventoryProjection projection,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> countingUnits,
            String ownerType,
            String skuCode,
            String optionValueCode) {
        JsonNode source = findSubmittedInventoryRule(submitted, projection, ownerType, skuCode, optionValueCode);
        if (source != null) consumedSubmitted.add(submittedOwnerKey(source.path("owner")));
        ObjectNode node = target.addObject();
        ObjectNode owner = node.putObject("owner").put("ownerType", ownerType).put("itemRef", projection.itemRef());
        if ("SKU".equals(ownerType)) {
            owner.put("productSkuRef", projection.productSkuRef(skuCode));
            owner.putNull("optionValueRef");
            owner.put("itemCode", projection.itemCode());
            owner.put("skuCode", skuCode);
            owner.putNull("optionValueCode");
        } else if ("OPTION_VALUE".equals(ownerType)) {
            owner.putNull("productSkuRef");
            owner.put("optionValueRef", projection.optionValueRef(optionValueCode));
            owner.put("itemCode", projection.itemCode());
            owner.putNull("skuCode");
            owner.put("optionValueCode", optionValueCode);
        } else {
            owner.putNull("productSkuRef");
            owner.putNull("optionValueRef");
            owner.put("itemCode", projection.itemCode());
            owner.putNull("skuCode");
            owner.putNull("optionValueCode");
        }
        String mode = source == null ? "NONE" : source.path("mode").asText("NONE");
        if (!allowedModes(projection.shapeKey(), "ITEM".equals(ownerType) ? "CATALOG_ITEM" : ownerType)
                .contains(mode)) {
            String detail = "该商品形态的库存 owner 不允许此扣减方式";
            throw new CatalogOwnerApi.Problem("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", 422, detail);
        }
        node.put("mode", mode);
        // Catalog derives this capability; inventory receives only the snapshot and never reads catalog schema.
        node.put("componentEligible", "MATERIAL".equals(projection.shapeKey()) && "ITEM".equals(ownerType));
        JsonNode effectiveUnit = "SKU".equals(ownerType)
                ? projection.consumptionUnitSnapshot(skuCode)
                : projection.consumptionUnitSnapshot(null);
        if (effectiveUnit == null || !effectiveUnit.isObject()) node.putNull("consumptionUnitSnapshot");
        else node.set("consumptionUnitSnapshot", effectiveUnit.deepCopy());
        copyNullable(source, node, "expectedTargetVersion");
        copyNullable(source, node, "expectedBomVersion");
        if (source != null && source.path("directConfiguration").isObject())
            node.set(
                    "directConfiguration",
                    enrichCountingUnitSnapshot(
                            projection, (ObjectNode) source.path("directConfiguration"), countingUnits));
        else node.putNull("directConfiguration");
        if (source != null && source.path("bom").isObject())
            node.set("bom", source.path("bom").deepCopy());
        else node.putNull("bom");
    }

    private JsonNode findSubmittedInventoryRule(
            JsonNode submitted,
            CatalogInventoryProjection projection,
            String ownerType,
            String skuCode,
            String optionValueCode) {
        if (!submitted.isArray()) return null;
        String expectedRef = "SKU".equals(ownerType)
                ? projection.productSkuRef(skuCode)
                : "OPTION_VALUE".equals(ownerType) ? projection.optionValueRef(optionValueCode) : projection.itemRef();
        for (JsonNode candidate : submitted) {
            JsonNode owner = candidate.path("owner");
            if (!ownerType.equals(owner.path("ownerType").asText())) continue;
            if (expectedRef != null
                    && (expectedRef.equals(owner.path("productSkuRef").asText(null))
                            || expectedRef.equals(owner.path("optionValueRef").asText(null))
                            || expectedRef.equals(owner.path("itemRef").asText(null)))) return candidate;
            if ("SKU".equals(ownerType)
                    && skuCode != null
                    && skuCode.equals(owner.path("skuCode").asText(null))) return candidate;
            if ("OPTION_VALUE".equals(ownerType)
                    && optionValueCode != null
                    && optionValueCode.equals(owner.path("optionValueCode").asText(null))) return candidate;
        }
        return null;
    }

    private ObjectNode enrichCountingUnitSnapshot(
            CatalogInventoryProjection projection,
            ObjectNode sourceConfiguration,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> countingUnits) {
        ObjectNode configuration = sourceConfiguration.deepCopy();
        String countingUnitRef = configuration.path("countingUnitRef").asText("");
        if (countingUnitRef.isBlank()) {
            configuration.putNull("countingUnitSnapshot");
            return configuration;
        }
        UUID ref;
        try {
            ref = UUID.fromString(countingUnitRef);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "盘点单位引用无效", failure);
        }
        CatalogOwnerApi.UnitDefinitionReadback unit = countingUnits.get(ref);
        if (unit == null) {
            String detail = "盘点单位不存在";
            throw new CatalogOwnerApi.Problem("UNIT_SNAPSHOT_REQUIRED", 422, detail);
        }
        ObjectNode snapshot = mapper.createObjectNode()
                .put("unitRef", unit.unitRef().toString())
                .put("code", unit.code())
                .put("name", unit.name())
                .put("unitDimension", unit.unitDimension().name())
                .put("precision", unit.precision());
        configuration.set("countingUnitSnapshot", snapshot);
        return configuration;
    }

    private Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> countingUnitDefinitions(
            String dataNodeRef, String brandRef, JsonNode submitted) {
        Set<UUID> refs = new java.util.LinkedHashSet<>();
        for (JsonNode node : submitted) {
            JsonNode configuration = node.path("directConfiguration");
            String rawRef = configuration.path("countingUnitRef").asText("").trim();
            if (rawRef.isBlank()) continue;
            try {
                refs.add(UUID.fromString(rawRef));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "盘点单位引用无效", failure);
            }
        }
        if (refs.isEmpty()) return Map.of();
        return catalog.listUnitDefinitions(dataNodeRef, brandRef, true, null, null, null).units().stream()
                .filter(unit -> refs.contains(unit.unitRef()))
                .collect(java.util.stream.Collectors.toMap(
                        CatalogOwnerApi.UnitDefinitionReadback::unitRef,
                        unit -> unit,
                        (left, right) -> left,
                        java.util.LinkedHashMap::new));
    }

    private String submittedOwnerKey(JsonNode owner) {
        return owner.path("ownerType").asText("") + ":"
                + owner.path("itemRef").asText("") + ":"
                + owner.path("productSkuRef").asText("") + ":"
                + owner.path("optionValueRef").asText("");
    }

    private void copyNullable(JsonNode source, ObjectNode target, String field) {
        if (source != null && source.has(field))
            target.set(field, source.path(field).deepCopy());
        else target.putNull(field);
    }

    private CatalogOwnerApi.OrderOptionDefinitionCreateCommand resolveMaterialTargets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionCreateCommand command) {
        return new CatalogOwnerApi.OrderOptionDefinitionCreateCommand(
                command.code(), command.name(), command.selectionMode(), resolveValues(context, command.values()));
    }

    private CatalogOwnerApi.OrderOptionDefinitionUpdateCommand resolveMaterialTargets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command) {
        return new CatalogOwnerApi.OrderOptionDefinitionUpdateCommand(
                command.definitionRef(),
                command.expectedVersion(),
                command.code(),
                command.name(),
                command.selectionMode(),
                resolveValues(context, command.values()));
    }

    private List<CatalogOwnerApi.OrderOptionValueCommand> resolveValues(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            List<CatalogOwnerApi.OrderOptionValueCommand> values) {
        List<CatalogOwnerApi.OrderOptionValueCommand> resolved = new ArrayList<>();
        Map<UUID, InventoryOwnerApi.CatalogMaterialStockTargetReadback> targetsByMaterialRef = new LinkedHashMap<>();
        List<UUID> materialRefs = values.stream()
                .flatMap(value -> value.materials().stream())
                .map(CatalogOwnerApi.OrderOptionMaterialTemplate::materialItemRef)
                .toList();
        inventory
                .resolveCatalogMaterialStockTargets(context, materialRefs)
                .forEach(target -> targetsByMaterialRef.put(target.materialItemRef(), target));
        for (CatalogOwnerApi.OrderOptionValueCommand value : values) {
            List<CatalogOwnerApi.OrderOptionMaterialTemplate> materials = new ArrayList<>();
            for (CatalogOwnerApi.OrderOptionMaterialTemplate material : value.materials()) {
                InventoryOwnerApi.CatalogMaterialStockTargetReadback target =
                        targetsByMaterialRef.get(material.materialItemRef());
                materials.add(new CatalogOwnerApi.OrderOptionMaterialTemplate(
                        target.materialItemRef(), target.stockTargetRef(), target.consumptionUnitSnapshot()));
            }
            resolved.add(new CatalogOwnerApi.OrderOptionValueCommand(
                    value.valueRef(), value.code(), value.name(), value.displayOrder(), List.copyOf(materials)));
        }
        return List.copyOf(resolved);
    }

    private void deleteOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, List<UUID> valueRefs, String idempotencyKey) {
        if (valueRefs == null || valueRefs.isEmpty()) return;
        inventory.deleteCatalogOptionValueBoms(
                context,
                new InventoryOwnerApi.CatalogOptionValueBomDeleteCommand(List.copyOf(valueRefs)),
                idempotencyKey);
    }

    private void settleWorkspaceCatalogAssets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ObjectNode request,
            Set<String> previousAssetRefs,
            String idempotencyKey,
            List<CatalogAssetCommandApi.AssetBinding> submittedBindings) {
        Set<String> nextAssetRefs = catalogAssetRefs(request.path("sections").path("catalogDraft"));
        java.util.List<CatalogAssetCommandApi.AssetBinding> bindings = new java.util.ArrayList<>();
        java.util.List<CatalogAssetCommandApi.PriorAssetReference> releasable = new java.util.ArrayList<>();
        try {
            for (String ref : nextAssetRefs) bindings.add(optionalAssetBinding(ref, submittedBindings));
            Set<String> candidates = new java.util.LinkedHashSet<>(previousAssetRefs);
            candidates.removeAll(nextAssetRefs);
            Set<String> stillReferenced = catalog.assetRefsStillReferenced(candidates);
            for (String ref : candidates) {
                if (stillReferenced.contains(ref)) continue;
                releasable.add(new CatalogAssetCommandApi.PriorAssetReference(UUID.fromString(ref)));
            }
            CatalogAssetCommandApi.SaveSettlementReadback settlement = assetCommands.settleCatalogSaveAssets(
                    context, new CatalogAssetCommandApi.SaveSettlementCommand(bindings, releasable, idempotencyKey));
            settlement.claimed().forEach(metadata -> {
                if (metadata.sizeBytes() > CatalogInventoryShapeManifest.CATALOG_ITEM_IMAGE_MAX_BYTES) {
                    throw new CatalogOwnerApi.Problem(
                            "VALIDATION_ERROR",
                            422,
                            "catalog images cannot exceed " + CatalogInventoryShapeManifest.CATALOG_ITEM_IMAGE_MAX_BYTES
                                    + " bytes");
                }
            });
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef", failure);
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("SCOPE_FORBIDDEN"),
                        (403),
                        ("图片资产命令缺少匹配的数据节点写授权"),
                        /* format-wrap */
                        (failure));
            }
        } catch (PlatformAssetService.AssetClaimRejectedException failure) {
            throw new CatalogOwnerApi.Problem(
                    "ASSET_REFERENCE_PROTEC"
                            /* format-wrap */
                            + "TED",
                    409,
                    "图片资产尚未准备好或已失效、版本已变化或仍被引用",
                    /* format-wrap */
                    failure);
        }
    }

    private String canonicalLocalJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "catalog save composition cannot encode owner request", failure);
        }
    }

    private ObjectNode canonicalSaveRequest(String canonicalRequestJson) {
        try {
            JsonNode parsed = mapper.readTree(canonicalRequestJson);
            if (!parsed.isObject()) throw new IllegalArgumentException("request must be object");
            ObjectNode request = (ObjectNode) parsed;
            CatalogJsonDocumentSizePolicy.validateCatalogDraft(request);
            JsonNode draft = request.path("sections").path("catalogDraft");
            if (draft.isObject()) {
                omitTypedNullFields(draft, "/sections/catalogDraft");
                /*
                 * The generated save DTO materializes nullable catalog-draft members even when the HTTP
                 * request omitted them.  A SKU lifecycle-only envelope is not a catalog-draft mutation, so
                 * those materialized nulls must not become synthetic catalog changes before the owner validates
                 * the transition.  Non-null values remain visible and are still rejected by the owner as a mixed
                 * transition/catalog save.
                 */
                JsonNode transitions = request.path("skuTransitions");
                if (transitions.isArray() && !transitions.isEmpty() && draft instanceof ObjectNode draftObject) {
                    if (draftObject.path("categoryRef").isNull()) draftObject.remove("categoryRef");
                    if (draftObject.path("preparationProfile").isNull()) draftObject.remove("preparationProfile");
                }
            }
            return request;
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog save request is invalid", failure);
        }
    }

    /**
     * Jackson 3 materializes omitted nullable record components before this request crosses into the catalog owner.
     * Catalog draft save is a merge: an omitted field preserves the owner fact, while an empty collection or scalar
     * remains an explicit replacement. Restore omission only for the typed draft tree; raw CanonicalJsonDocument values
     * remain opaque owner JSON and are not rewritten.
     */
    private static void omitTypedNullFields(JsonNode value, String path) {
        if (value == null || value.isNull()) return;
        if (value.isObject()) {
            ObjectNode object = (ObjectNode) value;
            List<String> nullFields = new java.util.ArrayList<>();
            object.fields().forEachRemaining(entry -> {
                String childPath = path + "/" + entry.getKey();
                // `categoryRef: null` is an explicit business action: remove
                // the product's category.  It must cross the coordinator as a
                // typed null instead of being mistaken for an omitted field.
                if (entry.getValue().isNull() && !isExplicitNullableTypedField(childPath))
                    nullFields.add(entry.getKey());
                else omitTypedNullFields(entry.getValue(), childPath);
            });
            nullFields.forEach(object::remove);
        } else if (value.isArray()) {
            value.forEach(entry -> omitTypedNullFields(entry, path + "[]"));
        }
    }

    private static boolean isExplicitNullableTypedField(String path) {
        return "/sections/catalogDraft/categoryRef".equals(path)
                || path.endsWith("/preparationProfile")
                || path.endsWith("/preparationOverride/profile")
                || path.endsWith("/preparationEffect");
    }

    private static CatalogAssetCommandApi.AssetBinding optionalAssetBinding(
            String assetRef, List<CatalogAssetCommandApi.AssetBinding> submittedBindings) {
        UUID ref;
        try {
            ref = UUID.fromString(assetRef);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef", failure);
        }
        return submittedBindings.stream()
                .filter(binding -> binding != null && ref.equals(binding.assetRef()))
                .findFirst()
                .orElse(new CatalogAssetCommandApi.AssetBinding(ref, null));
    }

    private void enrichWorkbenchContext(
            JsonNode result,
            String dataNodeRef,
            String brandRef,
            String dataNodeType,
            String headCompanyRef,
            UUID workspaceUuid,
            String groupWorkspaceKey) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        ObjectNode data = (ObjectNode) envelope.path("data");
        if (headCompanyRef == null || headCompanyRef.isBlank()) data.putNull("headCompanyRef");
        else data.put("headCompanyRef", headCompanyRef);
        boolean sourceAvailable = false;
        if ("STORE".equals(dataNodeType) && headCompanyRef != null && !headCompanyRef.isBlank()) {
            try {
                catalogScopes.resolveCatalogCopySource(
                        workspaceUuid, groupWorkspaceKey, dataNodeType, UUID.fromString(dataNodeRef), brandRef);
                sourceAvailable = true;
            } catch (RuntimeException ignored) {
                sourceAvailable = false;
            }
        }
        data.put("copySourceAvailable", sourceAvailable);
        ObjectNode actions = data.with("actionAvailability");
        actions.put("canCopy", sourceAvailable);
        ArrayNode reasons = actions.withArray("reasons");
        reasons.removeAll();
        if (!sourceAvailable) reasons.add(COPY_SOURCE_UNAVAILABLE);
    }

    private boolean containsInventorySection(JsonNode sections) {
        if (!sections.isArray()) return false;
        for (JsonNode section : sections)
            if (List.of("ITEM_BOM", "SKU_BOM", "OPTION_VALUE_BOM").contains(section.asText())) return true;
        return false;
    }
    // NOT_APPLICABLE_WITH_REASON: CatalogOwnerApi copy preflight is a distinct canonical owner payload;
    // the typed CopyPreflightReadback and legacy copy entrypoint deliberately do not share detail's HTTP envelope.
    private JsonNode preflightData(JsonNode preflight) {
        return preflight != null && preflight.path("data").isObject() ? preflight.path("data") : preflight;
    }

    /**
     * Copy commands deliberately carry only opaque identities. Codes remain in mapping entries as read labels, never as
     * traversal, persistence or rewrite identity. This is a fail-closed coordinator boundary: an owner that has not
     * produced the reference plan cannot be composed into a copy transaction.
     */
    CopyReferencePlan copyReferencePlan(JsonNode ownerResponse) {
        ArrayNode normalizedMappings = normalizedReferenceMappings(ownerResponse, true);
        ArrayNode itemRefs = mapper.createArrayNode();
        ArrayNode productionTagDefinitionRefs = mapper.createArrayNode();
        java.util.LinkedHashSet<String> itemSeen = new java.util.LinkedHashSet<>();
        java.util.LinkedHashSet<String> tagSeen = new java.util.LinkedHashSet<>();
        for (JsonNode mapping : normalizedMappings) {
            if ("CATALOG_ITEM".equals(mapping.path("objectType").asText())
                    && itemSeen.add(mapping.path("sourceRef").asText()))
                itemRefs.add(mapping.path("sourceRef").asText());
            if ("PRODUCTION_TAG".equals(mapping.path("objectType").asText())
                    && tagSeen.add(mapping.path("sourceRef").asText()))
                productionTagDefinitionRefs.add(mapping.path("sourceRef").asText());
        }
        JsonNode closureEdges = preflightData(ownerResponse).path("closureEdges");
        if (closureEdges.isArray())
            for (JsonNode edge : closureEdges) {
                if (!"PRODUCTION_TAG".equals(edge.path("referenceKind").asText())) continue;
                String tagRef = requiredOpaqueCopyRef(edge, "toRef");
                if (tagSeen.add(tagRef)) productionTagDefinitionRefs.add(tagRef);
            }
        if (itemRefs.isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("复制预检未提供商品 closureItemRefs"));
        }
        return new CopyReferencePlan(itemRefs, productionTagDefinitionRefs, normalizedMappings);
    }

    private ArrayNode normalizedReferenceMappings(JsonNode ownerResponse, boolean required) {
        JsonNode data = preflightData(ownerResponse);
        JsonNode mappings = data.path("referenceMappings");
        if (!mappings.isArray()) mappings = data.path("mappings");
        if (!mappings.isArray() || mappings.isEmpty()) {
            if (required)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "复制预检未提供 opaque referenceMappings");
            return mapper.createArrayNode();
        }
        ArrayNode normalizedMappings = mapper.createArrayNode();
        java.util.LinkedHashMap<String, ObjectNode> bySource = new java.util.LinkedHashMap<>();
        for (JsonNode mapping : mappings) {
            if (!mapping.isObject())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings must contain objects");
            String objectType = mapping.path("objectType")
                    .asText(mapping.path("referenceKind").asText(""));
            String sourceRef = requiredOpaqueCopyRef(mapping, "sourceRef");
            String targetRef = requiredOpaqueCopyRef(mapping, "targetRef");
            String key = objectType + "|" + sourceRef;
            ObjectNode existing = bySource.get(key);
            ObjectNode normalized = mapper.createObjectNode()
                    .put("objectType", objectType)
                    .put("sourceRef", sourceRef)
                    .put("targetRef", targetRef);
            copyOptionalText(normalized, mapping, "targetCode");
            copyOptionalText(normalized, mapping, "targetSkuCode");
            copyOptionalText(normalized, mapping, "targetOptionValueCode");
            copyOptionalText(normalized, mapping, "targetUnitName");
            copyOptionalText(normalized, mapping, "targetUnitDimension");
            if (mapping.hasNonNull("targetUnitPrecision"))
                normalized.put(
                        "targetUnitPrecision",
                        mapping.path("targetUnitPrecision").asInt());
            if (existing != null && !existing.path("targetRef").asText().equals(targetRef)) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "复制映射的 sourceRef 不能对应多个 targetRef");
            }
            if (existing == null) {
                bySource.put(key, normalized);
                normalizedMappings.add(normalized);
            }
        }
        return normalizedMappings;
    }

    private CopyReferencePlan ownerReferencePlan(JsonNode ownerResponse) {
        if (ownerResponse == null) return CopyReferencePlan.empty(mapper);
        return new CopyReferencePlan(
                mapper.createArrayNode(), mapper.createArrayNode(), normalizedReferenceMappings(ownerResponse, false));
    }

    private void applyCopyReferencePlan(ObjectNode request, CopyReferencePlan plan) {
        request.remove("closureItemCodes");
        request.remove("productionTagCodes");
        request.set("closureItemRefs", plan.closureItemRefs().deepCopy());
        request.set(
                "productionTagDefinitionRefs",
                plan.productionTagDefinitionRefs().deepCopy());
        request.set("referenceMappings", plan.referenceMappings().deepCopy());
    }

    private String requiredOpaqueCopyRef(JsonNode source, String key) {
        String value = source.path(key).asText("");
        try {
            return UUID.fromString(value).toString();
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", failure);
        }
    }

    private static void copyOptionalText(ObjectNode target, JsonNode source, String key) {
        if (source.hasNonNull(key) && !source.path(key).asText().isBlank())
            target.put(key, source.path(key).asText());
    }

    private String combinedDigest(String catalogDigest, String inventoryDigest, String productionDigest) {
        return digest(catalogDigest + "|" + inventoryDigest + "|" + productionDigest);
    }

    private JsonNode mergeCopyPreflight(JsonNode catalogPreflight, OwnerPreflight owners, String combined) {
        return mergeCopyPreflight(catalogPreflight, owners, combined, true);
    }

    private JsonNode mergeCopyPreflight(
            JsonNode catalogPreflight, OwnerPreflight owners, String combined, boolean enforceClosureLimit) {
        if (!(catalogPreflight instanceof ObjectNode envelope)) return catalogPreflight;
        ObjectNode data = preflightData(catalogPreflight) instanceof ObjectNode object ? object : null;
        if (data == null) return catalogPreflight;
        data.put("preflightDigest", combined);
        int inventoryBlocking = appendOwnerArrays(data, owners.inventoryJudgement());
        int productionBlocking = appendOwnerArrays(data, owners.productionJudgement());
        int ownerBlocking = inventoryBlocking + productionBlocking;
        data.put("blockingCount", data.path("blockingCount").asInt(0) + ownerBlocking);
        normalizeCompatibilityRows(data);
        validateCompatibilityRows(data.path("compatibilityResults"));
        data.put("confirmationRequiredCount", requiredCompatibilityCount(data.path("compatibilityResults")));
        int closureCount = uniqueClosureCount(data.path("closureItems"));
        data.put("closureCount", closureCount);
        if (enforceClosureLimit) enforceMergedClosureLimit(data);
        return envelope;
    }

    /**
     * Catalog and owner preflights can describe the same semantic fact while composing their closure arrays. Keep one
     * exact row per identity at the public boundary; conflicting rows remain a hard owner-result failure.
     */
    private void normalizeCompatibilityRows(ObjectNode data) {
        JsonNode value = data.path("compatibilityResults");
        if (!value.isArray() || value.isEmpty()) return;
        ArrayNode normalized = mapper.createArrayNode();
        java.util.LinkedHashMap<String, JsonNode> byId = new java.util.LinkedHashMap<>();
        for (JsonNode row : value) {
            String id = requiredCompatibilityId(row, "compatibility result");
            JsonNode previous = byId.putIfAbsent(id, row);
            if (previous == null) {
                normalized.add(row);
            } else if (!previous.equals(row)) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        500,
                        /* format-wrap */
                        "复制预检包含冲突兼容性事实身份: " + id);
            }
        }
        data.set("compatibilityResults", normalized);
    }

    /**
     * Catalog preflight enforces the catalog-only closure before owner facts are appended. The merged preflight is the
     * user-visible execution plan, so the same policy limit must be applied again after cross-owner de-duplication. The
     * limit is read from the catalog owner's response; no second numeric declaration is introduced in the edge
     * coordinator.
     */
    void enforceMergedClosureLimit(ObjectNode data) {
        int closureLimit = data.path("closureLimit").asInt(0);
        int closureCount = uniqueClosureCount(data.path("closureItems"));
        if (closureLimit > 0 && closureCount > closureLimit) {
            throw new CatalogOwnerApi.Problem(
                    "COPY_CLOSURE_TOO_LARGE",
                    422,
                    /* format-wrap */
                    "复制闭包超过上限: actual=" + closureCount + ", limit=" + closureLimit);
        }
    }

    private int appendOwnerArrays(ObjectNode target, JsonNode owner) {
        if (owner == null) return 0;
        JsonNode ownerData = preflightData(owner);
        appendArray(target, "closureItems", ownerData, "closureItems", false);
        appendArray(target, "referenceMappings", ownerData, "referenceMappings", false);
        appendArray(target, "mappingPreview", ownerData, "mappingPreview", false);
        appendArray(target, "skipped", ownerData, "skipped", false);
        appendArray(target, "objectVersions", ownerData, "versions", true);
        int blocking = 0;
        if (ownerData.path("compatibilityResults").isArray()) {
            for (JsonNode result : ownerData.path("compatibilityResults")) {
                if ("BLOCKED".equals(result.path("result").asText())) blocking++;
            }
        }
        appendArray(target, "compatibilityResults", ownerData, "compatibilityResults", false);
        appendArray(target, "referenceRewritePreview", ownerData, "referenceRewritePreview", false);
        return blocking;
    }

    private int appendArray(ObjectNode target, String targetName, JsonNode owner, String sourceName, boolean versions) {
        if (owner == null || !owner.path(sourceName).isArray()) return 0;
        int appended = 0;
        for (JsonNode node : owner.path(sourceName)) {
            ObjectNode copy = mapper.createObjectNode();
            if ("objectVersions".equals(targetName)) {
                copy.put("objectType", node.path("objectType").asText("STOCK_TARGET"));
                String code = node.hasNonNull("code")
                        ? node.path("code").asText()
                        : node.path("itemCode").asText();
                copy.put("code", code)
                        .put("sourceVersion", node.path("sourceVersion").asLong())
                        .put("targetVersion", node.path("targetVersion").asLong());
            } else if ("compatibilityResults".equals(targetName)) {
                copy.put("objectType", node.path("objectType").asText("STOCK_TARGET"));
                copy.put("compatibilityId", requiredCompatibilityId(node, "owner compatibility result"));
                copy.put("result", node.path("result").asText("REUSE"));
                copy.put("reason", node.path("reason").asText(""));
                copyRequiredNode(copy, node, "reasonCode", "owner compatibility result");
                copyRequiredNode(copy, node, "canonicalTuple", "owner compatibility result");
            } else if ("referenceRewritePreview".equals(targetName)) {
                copyRequiredNode(copy, node, "sourceRef", "owner reference rewrite");
                copyRequiredNode(copy, node, "targetRef", "owner reference rewrite");
                copyRequiredNode(copy, node, "referenceKind", "owner reference rewrite");
            } else if ("closureItems".equals(targetName)) {
                copy.put("objectType", node.path("objectType").asText("STOCK_TARGET"));
                copy.put("code", node.path("code").asText(node.path("itemCode").asText()));
                copy.put("name", node.path("name").asText(copy.path("code").asText()));
                copy.put("action", node.path("action").asText("REUSE_OR_CREATE"));
            } else if ("referenceMappings".equals(targetName)) {
                copyRequiredNode(copy, node, "objectType", "owner reference mapping");
                copyRequiredNode(copy, node, "sourceRef", "owner reference mapping");
                copyRequiredNode(copy, node, "targetRef", "owner reference mapping");
                copyRequiredNode(copy, node, "targetCode", "owner reference mapping");
                copyOptionalText(copy, node, "targetSkuCode");
                copyOptionalText(copy, node, "targetOptionValueCode");
            } else if ("mappingPreview".equals(targetName)) {
                copy.put(
                        "fromCode",
                        node.path("fromCode").asText(node.path("itemCode").asText()));
                copy.put(
                        "toCode",
                        node.path("toCode").asText(copy.path("fromCode").asText()));
                copy.put("referenceKind", node.path("referenceKind").asText("STOCK_TARGET"));
                copy.put("status", node.path("status").asText("REWRITE"));
                copyRequiredNode(copy, node, "canonicalTuple", "owner mapping preview");
            } else if ("skipped".equals(targetName)) {
                copy.put("section", node.path("section").asText());
                copy.put("reasonCode", node.path("reasonCode").asText());
            } else {
                continue;
            }
            target.withArray(targetName).add(copy);
            appended++;
        }
        return appended;
    }

    static void validateCompatibilityDispositions(
            JsonNode compatibilityResults, List<CatalogOwnerApi.CompatibilityDisposition> submitted) {
        validateCompatibilityRows(compatibilityResults);
        Set<String> expected = new java.util.LinkedHashSet<>();
        for (JsonNode row : compatibilityResults) {
            String id = requiredCompatibilityId(row, "compatibility result");
            if (!"BLOCKED".equals(row.path("result").asText())) expected.add(id);
        }
        Set<String> actual = new java.util.LinkedHashSet<>();
        if (submitted == null)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "compatibilityDispositions is required");
        for (CatalogOwnerApi.CompatibilityDisposition disposition : submitted) {
            if (disposition == null
                    || disposition.compatibilityId() == null
                    || disposition.compatibilityId().isBlank()
                    || !"CONFIRM".equals(disposition.disposition())
                    || !actual.add(disposition.compatibilityId())) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "复制兼容性处置无效或重复");
            }
        }
        if (!expected.equals(actual)) {
            Set<String> missing = new java.util.LinkedHashSet<>(expected);
            missing.removeAll(actual);
            Set<String> unexpected = new java.util.LinkedHashSet<>(actual);
            unexpected.removeAll(expected);
            throw new CatalogOwnerApi.Problem(
                    ("VALIDATION_ERROR"),
                    (422),
                    /* format-wrap */
                    "复制兼容性处置与预检事实不一致");
        }
    }

    static int requiredCompatibilityCount(JsonNode compatibilityResults) {
        validateCompatibilityRows(compatibilityResults);
        int count = 0;
        for (JsonNode row : compatibilityResults) {
            if (!"BLOCKED".equals(row.path("result").asText())) count++;
        }
        return count;
    }

    static void validateCompatibilityDispositions(JsonNode compatibilityResults, JsonNode submitted) {
        if (submitted == null || !submitted.isArray()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "compatibilityDispositions is required");
        }
        List<CatalogOwnerApi.CompatibilityDisposition> values = new ArrayList<>();
        for (JsonNode row : submitted) {
            if (row == null || !row.isObject()) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "复制兼容性处置无效或重复");
            }
            values.add(new CatalogOwnerApi.CompatibilityDisposition(
                    row.path("compatibilityId").asText(null),
                    row.path("disposition").asText(null)));
        }
        validateCompatibilityDispositions(compatibilityResults, values);
    }

    private static String requiredCompatibilityId(JsonNode row, String owner) {
        String id = row == null ? "" : row.path("compatibilityId").asText("");
        if (id.isBlank())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, owner + " is missing compatibilityId");
        return id;
    }

    private static void validateCompatibilityRows(JsonNode compatibilityResults) {
        if (compatibilityResults == null || !compatibilityResults.isArray()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制预检缺少兼容性事实");
        }
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (JsonNode row : compatibilityResults) {
            String compatibilityId = requiredCompatibilityId(row, "compatibility result");
            if (!seen.add(compatibilityId))
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        500,
                        /* format-wrap */
                        "复制预检包含重复兼容性事实身份: " + compatibilityId);
            if (row.path("objectType").asText().isBlank()
                    || row.path("result").asText().isBlank()
                    || !row.path("reason").isTextual()
                    || !CatalogInventoryShapeManifest.COPY_COMPATIBILITY_REASON_CODES.contains(
                            row.path("reasonCode").asText())
                    || !validCanonicalTuple(row.path("canonicalTuple"))) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        500,
                        "复制预检兼容性事实无效: "
                                + compatibilityId
                                + " objectType="
                                + row.path("objectType").asText()
                                + " result="
                                + row.path("result").asText()
                                + " reasonCode="
                                + row.path("reasonCode").asText());
            }
        }
    }

    private static void copyRequiredNode(ObjectNode target, JsonNode source, String key, String owner) {
        if (source == null || !source.has(key) || source.path(key).isNull()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, owner + " is missing " + key);
        }
        target.set(key, source.path(key).deepCopy());
    }

    private static boolean validCanonicalTuple(JsonNode value) {
        // ownerRef is the opaque scope identity.  brandRef is the owner's
        // scoped business identifier and is not required to be a UUID (the
        // current catalog contract uses values such as "BRAND").
        if (value == null
                || !value.isObject()
                || !opaqueUuid(value, "ownerRef")
                || !value.path("brandRef").isTextual()
                || value.path("brandRef").asText().isBlank()
                || value.path("objectType").asText().isBlank()
                || !value.path("parts").isArray()) return false;
        for (JsonNode part : value.path("parts")) if (!part.isTextual()) return false;
        return true;
    }

    private static boolean opaqueUuid(JsonNode value, String key) {
        if (value == null
                || !value.path(key).isTextual()
                || value.path(key).asText().isBlank()) return false;
        try {
            UUID.fromString(value.path(key).asText());
            return true;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private List<CatalogOwnerApi.CompatibilityDisposition> filterCatalogCompatibilityDispositions(
            JsonNode catalogResults, List<CatalogOwnerApi.CompatibilityDisposition> submitted) {
        Set<String> catalogIds = new java.util.LinkedHashSet<>();
        if (catalogResults != null && catalogResults.isArray())
            for (JsonNode row : catalogResults)
                catalogIds.add(requiredCompatibilityId(row, "catalog compatibility result"));
        return submitted.stream()
                .filter(value -> catalogIds.contains(value.compatibilityId()))
                .toList();
    }

    private int uniqueClosureCount(JsonNode items) {
        java.util.Set<String> keys = new java.util.LinkedHashSet<>();
        if (items != null && items.isArray())
            items.forEach(item -> keys.add(item.path("objectType").asText("") + "|"
                    + item.path("sourceRef")
                            .asText(item.path("ref").asText(item.path("code").asText("")))));
        return keys.size();
    }

    private String digest(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private record OwnerPreflight(
            String inventoryDigest,
            String productionDigest,
            JsonNode inventoryJudgement,
            JsonNode productionJudgement,
            InventoryOwnerApi.CopyExecutionPreparation inventoryPreparation) {}

    record CopyReferencePlan(
            ArrayNode closureItemRefs, ArrayNode productionTagDefinitionRefs, ArrayNode referenceMappings) {
        static CopyReferencePlan empty(ObjectMapper mapper) {
            return new CopyReferencePlan(mapper.createArrayNode(), mapper.createArrayNode(), mapper.createArrayNode());
        }

        CopyReferencePlan merge(CopyReferencePlan other) {
            if (other == null || other.referenceMappings().isEmpty()) return this;
            ArrayNode mergedItems = closureItemRefs.deepCopy();
            ArrayNode mergedTags = productionTagDefinitionRefs.deepCopy();
            ArrayNode mergedMappings = referenceMappings.deepCopy();
            java.util.Set<String> itemRefs = new java.util.LinkedHashSet<>();
            mergedItems.forEach(value -> itemRefs.add(value.asText()));
            other.closureItemRefs().forEach(value -> {
                if (itemRefs.add(value.asText())) mergedItems.add(value.asText());
            });
            java.util.Set<String> tagRefs = new java.util.LinkedHashSet<>();
            mergedTags.forEach(value -> tagRefs.add(value.asText()));
            other.productionTagDefinitionRefs().forEach(value -> {
                if (tagRefs.add(value.asText())) mergedTags.add(value.asText());
            });
            java.util.Map<String, String> targetsBySource = new java.util.LinkedHashMap<>();
            mergedMappings.forEach(value -> targetsBySource.put(
                    value.path("objectType").asText() + "|"
                            + value.path("sourceRef").asText(),
                    value.path("targetRef").asText()));
            for (JsonNode mapping : other.referenceMappings()) {
                String key = mapping.path("objectType").asText() + "|"
                        + mapping.path("sourceRef").asText();
                String target = mapping.path("targetRef").asText();
                String previous = targetsBySource.putIfAbsent(key, target);
                if (previous != null && !previous.equals(target)) {
                    throw new CatalogOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            422,
                            /* format-wrap */
                            "多个 owner 对同一 sourceRef 给出了冲突 targetRef");
                }
                if (previous == null) mergedMappings.add(mapping.deepCopy());
            }
            return new CopyReferencePlan(mergedItems, mergedTags, mergedMappings);
        }
    }

    private void enrichInventory(
            JsonNode detail, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        if (!(detail instanceof ObjectNode root)) return;
        JsonNode dataNode = root.path("data");
        if (!(dataNode instanceof ObjectNode data)) return;
        JsonNode item = data.path("item");
        String itemRef = requiredOpaqueTaskRef(item, "itemRef", "catalog item detail");
        if (!itemRef.isBlank()) {
            JsonNode definition = inventory.readCatalogInventoryDefinition(dataNodeRef, brandRef, itemRef, requestId);
            // NOT_APPLICABLE_WITH_REASON: InventoryOwnerApi defines this as a raw definition graph;
            // its legacy enveloped compatibility is a different owner contract, not a CatalogOwner detail response.
            JsonNode definitionData = definition.path("data").isObject() ? definition.path("data") : definition;
            JsonNode inventoryRules = definitionData.path("inventoryRules");
            if (definitionData.isObject()
                    && inventoryRules.isObject()
                    && inventoryRules.path("nodes").isArray()) {
                ObjectNode completedRules = completeInventoryRules(item, inventoryRules);
                data.set("inventoryRules", completedRules.deepCopy());
                if (data.path("item").isObject()) {
                    ((ObjectNode) data.path("item")).set("inventoryRules", completedRules.deepCopy());
                    enrichOrderOptionBomVersions(data.path("item"), completedRules.path("nodes"));
                    ArrayNode targetFacts = inventoryTargetFacts(completedRules.path("nodes"));
                    enrichSkuVoidAvailability(data.path("item"), targetFacts);
                    enrichCatalogItemVoidAvailability(data, targetFacts);
                }
            }
        }
        // Catalog detail already receives production-tag names from the production owner
        // selected-ref readback; do not re-read the full candidate page to overwrite them.
    }

    /**
     * Inventory returns only persisted definitions. The catalog detail contract is the complete derived owner set,
     * including explicit NONE nodes, so the coordinator fills the shape-owned zero state without moving ownership of
     * any inventory fact into catalog JSON.
     */
    private ObjectNode completeInventoryRules(JsonNode item, JsonNode persistedRules) {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode nodes = result.putArray("nodes");
        String shape = item.path("shapeKey").asText("");
        String itemRef = item.path("itemRef").asText("");
        String itemCode = item.path("code").asText("");
        String itemName = item.path("name").asText("");
        if (itemRef.isBlank() || itemCode.isBlank())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品库存 owner 投影缺少商品引用");
        if (itemName.isBlank() || itemName.equals(itemCode))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品库存 owner 投影缺少商品名称");
        if (!Set.of("COMPOSITE", "SERVICE", "BENEFIT_SHELL").contains(shape))
            appendCompleteInventoryRule(
                    nodes, persistedRules.path("nodes"), shape, "ITEM", itemRef, null, null, itemCode, itemName);
        if ("SKU_VARIANT_SALE_COUNTED".equals(shape) && item.path("skus").isArray())
            item.path("skus")
                    .forEach(sku -> appendCompleteInventoryRule(
                            nodes,
                            persistedRules.path("nodes"),
                            shape,
                            "SKU",
                            itemRef,
                            sku.path("productSkuRef").asText(""),
                            null,
                            itemCode,
                            itemName,
                            sku.path("skuCode").asText("")));
        if (Set.of("STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED").contains(shape)
                && item.path("orderOptionConfigs").isArray())
            item.path("orderOptionConfigs").forEach(config -> {
                if (!config.path("values").isArray()) return;
                config.path("values")
                        .forEach(value -> appendCompleteInventoryRule(
                                nodes,
                                persistedRules.path("nodes"),
                                shape,
                                "OPTION_VALUE",
                                itemRef,
                                null,
                                value.path("definitionValueRef").asText(""),
                                itemCode,
                                itemName,
                                null,
                                value.path("name").asText("")));
            });
        return result;
    }

    private void appendCompleteInventoryRule(
            ArrayNode output,
            JsonNode persisted,
            String shape,
            String ownerType,
            String itemRef,
            String productSkuRef,
            String optionValueRef,
            String itemCode,
            String itemName,
            String... displayCodes) {
        JsonNode existing = findInventoryRule(persisted, ownerType, itemRef, productSkuRef, optionValueRef);
        ObjectNode node = existing != null && existing.isObject()
                ? ((ObjectNode) existing).deepCopy()
                : mapper.createObjectNode();
        ObjectNode owner = node.putObject("owner").put("ownerType", ownerType).put("itemRef", itemRef);
        if (productSkuRef == null || productSkuRef.isBlank()) owner.putNull("productSkuRef");
        else owner.put("productSkuRef", productSkuRef);
        if (optionValueRef == null || optionValueRef.isBlank()) owner.putNull("optionValueRef");
        else owner.put("optionValueRef", optionValueRef);
        owner.put("itemCode", itemCode);
        owner.putNull("skuCode");
        owner.putNull("optionValueCode");
        if ("SKU".equals(ownerType) && displayCodes.length > 0) owner.put("skuCode", displayCodes[0]);
        if ("OPTION_VALUE".equals(ownerType) && displayCodes.length > 1)
            owner.put("optionValueCode", persistedDisplayCode(existing, "optionValueCode", displayCodes[1]));
        node.put("itemCode", itemCode).put("itemName", itemName);
        node.putNull("skuCode").putNull("optionValueCode");
        if ("SKU".equals(ownerType) && displayCodes.length > 0) node.put("skuCode", displayCodes[0]);
        if ("OPTION_VALUE".equals(ownerType) && displayCodes.length > 1)
            node.put("optionValueCode", persistedDisplayCode(existing, "optionValueCode", displayCodes[1]));
        ArrayNode allowed = node.putArray("allowedModes");
        allowedModes(shape, "ITEM".equals(ownerType) ? "CATALOG_ITEM" : ownerType)
                .forEach(allowed::add);
        node.put("defaultMode", "NONE");
        node.putNull("disabledReason");
        if (existing == null) {
            node.put("mode", "NONE");
            node.putNull("directConfiguration");
            node.putNull("bom");
        }
        output.add(node);
    }

    private String persistedDisplayCode(JsonNode existing, String field, String fallback) {
        String ownerCode =
                existing == null ? "" : existing.path("owner").path(field).asText("");
        if (!ownerCode.isBlank()) return ownerCode;
        String nodeCode = existing == null ? "" : existing.path(field).asText("");
        return nodeCode.isBlank() ? fallback : nodeCode;
    }

    private JsonNode findInventoryRule(
            JsonNode persisted, String ownerType, String itemRef, String productSkuRef, String optionValueRef) {
        if (!persisted.isArray()) return null;
        for (JsonNode node : persisted) {
            JsonNode owner = node.path("owner");
            if (!ownerType.equals(owner.path("ownerType").asText())) continue;
            if (!itemRef.equals(owner.path("itemRef").asText())) continue;
            String actualSku = owner.path("productSkuRef").asText("");
            String actualOption = owner.path("optionValueRef").asText("");
            if (java.util.Objects.equals(productSkuRef == null ? "" : productSkuRef, actualSku)
                    && java.util.Objects.equals(optionValueRef == null ? "" : optionValueRef, actualOption)) {
                return node;
            }
        }
        return null;
    }

    private List<String> allowedModes(String shape, String ownerType) {
        try {
            JsonNode admission = mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON)
                    .path("typeEffects")
                    .path("shapeNodeAdmission")
                    .path(shape)
                    .path("allowedModesByNodeType")
                    .path(ownerType);
            if (!admission.isArray()) {
                String detail = "形态节点准入契约不可用";
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, detail);
            }
            List<String> result = new ArrayList<>();
            admission.forEach(value -> result.add(value.asText()));
            return List.copyOf(result);
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态节点准入契约不可用", failure);
        }
    }

    private ArrayNode inventoryTargetFacts(JsonNode inventoryNodes) {
        ArrayNode facts = mapper.createArrayNode();
        if (!inventoryNodes.isArray()) return facts;
        inventoryNodes.forEach(node -> {
            JsonNode owner = node.path("owner");
            JsonNode direct = node.path("directConfiguration");
            if (direct.isObject() && direct.hasNonNull("targetRef")) {
                ObjectNode fact = facts.addObject()
                        .put("targetRef", direct.path("targetRef").asText())
                        .put("factKind", "INVENTORY_TARGET")
                        .put("reasonLabel", "已配置库存对象");
                if (owner.hasNonNull("productSkuRef"))
                    fact.put("productSkuRef", owner.path("productSkuRef").asText());
            }
            if (node.path("bom").path("lines").isArray())
                node.path("bom").path("lines").forEach(line -> facts.addObject()
                        .put("targetRef", line.path("targetRef").asText())
                        .put("factKind", "INVENTORY_BOM")
                        .put("reasonLabel", "已配置用料")
                        .put("productSkuRef", owner.path("productSkuRef").asText("")));
        });
        return facts;
    }

    /**
     * BOM optimistic concurrency is an owner readback fact, not a user-visible control. Every definition value gets an
     * explicit version; the absence of an owner row is the verified initial version zero, never a guessed overwrite.
     */
    private void enrichOrderOptionBomVersions(JsonNode itemNode, JsonNode inventoryNodes) {
        if (!(itemNode instanceof ObjectNode item)
                || !item.path("orderOptionConfigs").isArray()) return;
        java.util.Map<String, Long> versions = new java.util.LinkedHashMap<>();
        if (inventoryNodes.isArray())
            inventoryNodes.forEach(node -> {
                String ref = node.path("owner").path("optionValueRef").asText("");
                JsonNode bom = node.path("bom");
                if (ref.isBlank() || !bom.path("version").canConvertToLong()) return;
                Long previous = versions.putIfAbsent(ref, bom.path("version").asLong());
                if (previous != null
                        && previous.longValue() != bom.path("version").asLong())
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "同一选项扣料版本不一致");
            });
        item.path("orderOptionConfigs").forEach(config -> {
            if (!config.path("values").isArray()) return;
            config.path("values").forEach(value -> {
                if (!(value instanceof ObjectNode object)) return;
                String ref = object.path("definitionValueRef").asText("");
                object.put("bomVersion", versions.getOrDefault(ref, 0L));
            });
        });
    }

    /** Inventory owns stock/BOM references; merge only the typed SKU blocking facts into the catalog read model. */
    private void enrichSkuVoidAvailability(JsonNode itemNode, JsonNode inventoryNodes) {
        if (!(itemNode instanceof ObjectNode item) || !item.path("skus").isArray() || !inventoryNodes.isArray()) return;
        java.util.Map<String, java.util.List<JsonNode>> blockers = new java.util.LinkedHashMap<>();
        inventoryNodes.forEach(node -> {
            String skuRef = node.path("productSkuRef").asText("");
            String targetRef = node.path("targetRef").asText("");
            if (!skuRef.isBlank() && !targetRef.isBlank())
                blockers.computeIfAbsent(skuRef, ignored -> new java.util.ArrayList<>())
                        .add(node);
        });
        item.path("skus").forEach(value -> {
            if (!(value instanceof ObjectNode sku)) return;
            String skuRef = sku.path("productSkuRef").asText("");
            java.util.List<JsonNode> rows = blockers.getOrDefault(skuRef, java.util.List.of());
            if (rows.isEmpty()) return;
            ObjectNode availability = sku.path("voidAvailability").isObject()
                    ? (ObjectNode) sku.path("voidAvailability")
                    : sku.putObject("voidAvailability");
            ArrayNode references = availability.path("blockingReferences").isArray()
                    ? (ArrayNode) availability.path("blockingReferences")
                    : availability.putArray("blockingReferences");
            ArrayNode facts = availability.path("dependentFacts").isArray()
                    ? (ArrayNode) availability.path("dependentFacts")
                    : availability.putArray("dependentFacts");
            ArrayNode reasons = availability.path("blockingReasons").isArray()
                    ? (ArrayNode) availability.path("blockingReasons")
                    : availability.putArray("blockingReasons");
            java.util.Map<String, java.util.Set<String>> targetRefsByReason = new java.util.LinkedHashMap<>();
            for (JsonNode row : rows) {
                String targetRef = row.path("targetRef").asText();
                String factKind = row.path("factKind").asText("");
                String reasonLabel = row.path("reasonLabel").asText("");
                if (factKind.isBlank())
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存作废限制事实缺少类型");
                if (!reasonLabel.isBlank())
                    targetRefsByReason
                            .computeIfAbsent(reasonLabel, ignored -> new java.util.LinkedHashSet<>())
                            .add(targetRef);
                boolean known = false;
                for (JsonNode reference : references)
                    if (targetRef.equals(reference.path("referenceRef").asText())) {
                        known = true;
                        break;
                    }
                if (known) continue;
                references.addObject().put("referenceKind", "INVENTORY_TARGET").put("referenceRef", targetRef);
                facts.addObject().put("factKind", factKind).put("factRef", targetRef);
            }
            appendInventoryVoidBlockingReasons(reasons, targetRefsByReason);
            availability.put("canVoid", false);
        });
    }

    /**
     * Catalog owns the item lifecycle, but inventory owns the target/BOM facts that can keep that item from being
     * voided. The detail edge must expose the same blocking identity that the command-side owner judgement sees.
     */
    private void enrichCatalogItemVoidAvailability(ObjectNode data, JsonNode inventoryNodes) {
        ObjectNode action = data.path("actionAvailability").isObject()
                ? (ObjectNode) data.path("actionAvailability")
                : data.putObject("actionAvailability");
        ObjectNode availability = action.path("voidAvailability").isObject()
                ? (ObjectNode) action.path("voidAvailability")
                : action.putObject("voidAvailability");
        ArrayNode references = availability.path("blockingReferences").isArray()
                ? (ArrayNode) availability.path("blockingReferences")
                : availability.putArray("blockingReferences");
        ArrayNode facts = availability.path("dependentFacts").isArray()
                ? (ArrayNode) availability.path("dependentFacts")
                : availability.putArray("dependentFacts");
        ArrayNode reasons = availability.path("blockingReasons").isArray()
                ? (ArrayNode) availability.path("blockingReasons")
                : availability.putArray("blockingReasons");
        java.util.Map<String, java.util.Set<String>> targetRefsByReason = new java.util.LinkedHashMap<>();
        if (!inventoryNodes.isArray()) return;
        inventoryNodes.forEach(node -> {
            String targetRef = node.path("targetRef").asText("");
            if (targetRef.isBlank()) return;
            String factKind = node.path("factKind").asText("");
            String reasonLabel = node.path("reasonLabel").asText("");
            if (factKind.isBlank())
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存作废限制事实缺少类型");
            if (!reasonLabel.isBlank())
                targetRefsByReason.computeIfAbsent(reasonLabel, ignored -> new java.util.LinkedHashSet<>()).add(targetRef);
            boolean known = false;
            for (JsonNode reference : references) {
                if (targetRef.equals(reference.path("referenceRef").asText(""))) {
                    known = true;
                    break;
                }
            }
            if (known) return;
            references.addObject().put("referenceKind", "INVENTORY_TARGET").put("referenceRef", targetRef);
            facts.addObject().put("factKind", factKind).put("factRef", targetRef);
        });
        appendInventoryVoidBlockingReasons(reasons, targetRefsByReason);
        if (references.size() > 0) availability.put("canVoid", false);
    }

    /**
     * Direct stock targets and BOM consumption are different user-visible blocking facts.  Both item and SKU
     * detail projections consume this single helper so inventory cannot disable a void action without preserving
     * the business reason that the inventory definition supplied.
     */
    private static void appendInventoryVoidBlockingReasons(
            ArrayNode reasons, java.util.Map<String, java.util.Set<String>> targetRefsByReason) {
        targetRefsByReason.forEach((label, targetRefs) -> {
            boolean present = false;
            for (JsonNode reason : reasons) {
                if (label.equals(reason.path("label").asText())) {
                    present = true;
                    break;
                }
            }
            if (!present)
                reasons.addObject().put("label", label).put("count", targetRefs.size()).putArray("relatedItemNames");
        });
    }

    private String requiredOpaqueTaskRef(JsonNode source, String key, String subject) {
        String value = source == null ? "" : source.path(key).asText("");
        try {
            return UUID.fromString(value).toString();
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    subject + " must return " + key + " as an opaque UUID ref",
                    failure);
        }
    }

    private void enrichInventoryTargets(
            JsonNode result, String dataNodeRef, String brandRef, String requestId, JsonNode prefetchedCatalog) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        List<UUID> orderedItemRefs = new ArrayList<>();
        envelope.path("data").path("items").forEach(item -> {
            if (item.hasNonNull("itemRef")) {
                try {
                    orderedItemRefs.add(UUID.fromString(item.path("itemRef").asText()));
                } catch (IllegalArgumentException ignored) {
                    // Inventory owner facts are expected to be UUID refs; malformed refs remain explicitly un-enriched.
                }
            }
        });
        if (orderedItemRefs.isEmpty()) return;
        java.util.Map<UUID, CatalogOwnerApi.InventoryDisplayFact> factsByItemRef = new java.util.HashMap<>();
        catalog.readInventoryDisplayFacts(dataNodeRef, brandRef, orderedItemRefs)
                .forEach(fact -> factsByItemRef.put(fact.itemRef(), fact));
        envelope.path("data").path("items").forEach(item -> {
            if (!(item instanceof ObjectNode row)) return;
            CatalogOwnerApi.InventoryDisplayFact fact;
            try {
                fact = factsByItemRef.get(UUID.fromString(row.path("itemRef").asText()));
            } catch (IllegalArgumentException ignored) {
                fact = null;
            }
            if (fact == null || !fact.present()) {
                row.putNull("productName")
                        .putNull("skuName")
                        .putNull("categoryName")
                        .putNull("materialRole");
                return;
            }
            row.put("productName", fact.itemName());
            if (fact.skuName() == null) row.putNull("skuName");
            else row.put("skuName", fact.skuName());
            if (fact.categoryDisplayName() == null) row.putNull("categoryName");
            else row.put("categoryName", fact.categoryDisplayName());
            if (fact.materialRole() == null) row.putNull("materialRole");
            else row.put("materialRole", fact.materialRole());
        });
    }

    private void enrichInventoryTarget(JsonNode result, String dataNodeRef, String brandRef, String requestId) {
        if (!(result instanceof ObjectNode current) || !current.path("target").isObject()) return;
        ObjectNode target = (ObjectNode) current.path("target");
        String itemRef = target.path("itemRef").asText("");
        if (itemRef.isBlank()) return;
        UUID itemUuid;
        try {
            itemUuid = UUID.fromString(itemRef);
        } catch (IllegalArgumentException ignored) {
            return;
        }
        String skuRef = target.path("productSkuRef").asText("");
        UUID skuUuid = null;
        if (!skuRef.isBlank()) {
            try {
                skuUuid = UUID.fromString(skuRef);
            } catch (IllegalArgumentException ignored) {
                return;
            }
        }
        CatalogOwnerApi.InventoryTargetDisplayFact fact =
                catalog.readInventoryTargetDisplayFact(dataNodeRef, brandRef, itemUuid, skuUuid);
        if (!fact.present()) return;
        target.put("productName", fact.itemName());
        if (fact.shapeKey() != null) target.put("productShape", fact.shapeKey());
        if (skuUuid != null && fact.skuName() != null) target.put("skuName", fact.skuName());
    }

    /**
     * The inventory owner owns BOM/reference rows; catalog owns the human name. Resolve names once for the page as a
     * task read, never once per reference, and attach the explicit scope used for the displayed relationship.
     */
    private void enrichInventoryConsumptionReferences(
            JsonNode result, String dataNodeRef, String brandRef, String requestId) {
        if (!(result instanceof ObjectNode root)) return;
        // NOT_APPLICABLE_WITH_REASON: InventoryOwnerService.references is a raw inventory task-read;
        // it is not a CatalogOwner detail/page envelope consumer.
        JsonNode dataNode = root.path("data").isObject() ? root.path("data") : root;
        if (!(dataNode instanceof ObjectNode data) || !data.path("entries").isArray()) return;
        ArrayNode itemRefs = mapper.createArrayNode();
        java.util.LinkedHashSet<String> uniqueRefs = new java.util.LinkedHashSet<>();
        data.path("entries").forEach(entry -> {
            String sourceItemRef = entry.path("sourceItemRef").asText("");
            if (!sourceItemRef.isBlank() && uniqueRefs.add(sourceItemRef)) itemRefs.add(sourceItemRef);
        });
        java.util.Map<String, String> names = new java.util.HashMap<>();
        java.util.Map<String, String> statuses = new java.util.HashMap<>();
        if (!itemRefs.isEmpty()) {
            ObjectNode lookup = mapper.createObjectNode();
            lookup.set("itemRefs", itemRefs);
            JsonNode catalogPage = catalog.readItems(dataNodeRef, brandRef, lookup, requestId);
            JsonNode catalogData = catalogPage.path("data");
            catalogData.path("items").forEach(item -> {
                String itemRef = item.path("itemRef").asText("");
                if (!itemRef.isBlank()) {
                    names.put(
                            itemRef, item.path("name").asText(item.path("code").asText()));
                    statuses.put(itemRef, item.path("status").asText("ACTIVE"));
                }
            });
        }
        data.path("entries").forEach(entry -> {
            if (!(entry instanceof ObjectNode row)) return;
            String sourceItemRef = row.path("sourceItemRef").asText("");
            String sourceCode = row.path("sourceCode").asText("");
            row.put("sourceName", names.getOrDefault(sourceItemRef, sourceCode));
            row.put(
                    "status",
                    statuses.getOrDefault(sourceItemRef, row.path("status").asText("ACTIVE")));
            row.putObject("ownerScope")
                    .put("ownerType", "DATA_NODE")
                    .put("ownerRef", dataNodeRef)
                    .put("brandRef", brandRef);
        });
    }

    private void enrichCatalogItems(
            JsonNode result, String dataNodeRef, String brandRef, String requestId, String dataNodeType) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        ArrayNode itemRefs = mapper.createArrayNode();
        envelope.path("data").path("items").forEach(item -> {
            if (item.hasNonNull("itemRef")) itemRefs.add(item.path("itemRef").asText());
        });
        if (itemRefs.isEmpty()) return;
        if (!Set.of("STORE", "HEAD_COMPANY").contains(dataNodeType)) return;
        ObjectNode lookup = mapper.createObjectNode().set("itemRefs", itemRefs);
        JsonNode inventoryPage =
                inventory.readCatalogInventorySummary(dataNodeRef, brandRef, lookup, requestId, dataNodeType);
        JsonNode inventoryItems = inventoryPage.path("data").path("items");
        java.util.Map<String, JsonNode> summariesByItemRef = new java.util.HashMap<>();
        if (inventoryItems.isArray()) {
            inventoryItems.forEach(item -> {
                String itemRef = item.path("itemRef").asText();
                if (!itemRef.isBlank()) summariesByItemRef.put(itemRef, item);
            });
        }
        JsonNode items = envelope.path("data").path("items");
        if (items.isArray()) {
            items.forEach(item -> {
                if (item instanceof ObjectNode row) {
                    String itemRef = row.path("itemRef").asText();
                    if (row.path("skuTotalCount").asInt(0) > 0) {
                        putInventoryDeductionSummary(row, "SKU", null);
                    } else {
                        putInventoryDeductionSummary(row, "ITEM", summariesByItemRef.get(itemRef));
                    }
                }
            });
        }
    }

    private void enrichCatalogSkuItems(
            JsonNode result, String dataNodeRef, String brandRef, String requestId, String dataNodeType) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        ArrayNode skuRefs = mapper.createArrayNode();
        envelope.path("data").path("items").forEach(item -> {
            if (item.hasNonNull("productSkuRef"))
                skuRefs.add(item.path("productSkuRef").asText());
        });
        if (skuRefs.isEmpty()) return;
        ObjectNode lookup = mapper.createObjectNode().set("productSkuRefs", skuRefs);
        JsonNode inventoryPage =
                inventory.readCatalogInventorySummary(dataNodeRef, brandRef, lookup, requestId, dataNodeType);
        java.util.Map<String, JsonNode> summariesBySkuRef = new java.util.HashMap<>();
        inventoryPage.path("data").path("items").forEach(item -> {
            String skuRef = item.path("productSkuRef").asText();
            if (!skuRef.isBlank()) summariesBySkuRef.put(skuRef, item);
        });
        envelope.path("data").path("items").forEach(item -> {
            if (item instanceof ObjectNode row) {
                putInventoryDeductionSummary(
                        row,
                        "SKU",
                        summariesBySkuRef.get(row.path("productSkuRef").asText()));
            }
        });
    }

    private void putInventoryDeductionSummary(ObjectNode row, String grain, JsonNode source) {
        ObjectNode summary = row.putObject("inventoryDeductionSummary").put("grain", grain);
        if (source == null) {
            summary.putNull("mode").putNull("consumptionUnitSnapshot").putNull("bomLineCount");
            return;
        }
        if (source.path("mode").isMissingNode() || source.path("mode").isNull()) summary.putNull("mode");
        else summary.put("mode", source.path("mode").asText());
        JsonNode snapshot = source.path("consumptionUnitSnapshot");
        if (snapshot.isObject()) summary.set("consumptionUnitSnapshot", snapshot.deepCopy());
        else summary.putNull("consumptionUnitSnapshot");
        JsonNode bomLineCount = source.path("bomLineCount");
        if (bomLineCount.isIntegralNumber()) summary.put("bomLineCount", bomLineCount.asInt());
        else summary.putNull("bomLineCount");
    }

    /**
     * Catalog code is used once for the owner task read; all downstream inventory commands and their idempotency
     * grouping use only the owner-returned refs.
     */
    private CatalogInventoryProjection catalogInventoryProjection(
            String dataNodeRef, String brandRef, String itemCode, String requestId) {
        JsonNode detail = catalog.readItem(dataNodeRef, brandRef, itemCode, requestId);
        JsonNode item = detail.path("data").path("item");
        String itemRef = requiredOpaqueTaskRef(item, "itemRef", "catalog item task read");
        java.util.Map<String, String> skuRefs = new java.util.LinkedHashMap<>();
        if (item.path("skus").isArray())
            item.path("skus").forEach(sku -> {
                String code = sku.path("skuCode").asText("");
                if (!code.isBlank())
                    skuRefs.put(code, requiredOpaqueTaskRef(sku, "productSkuRef", "catalog SKU task read"));
            });
        java.util.Map<String, String> optionValueRefs = new java.util.LinkedHashMap<>();
        if (item.path("skuVariantDimensions").isArray())
            item.path("skuVariantDimensions").forEach(dimension -> {
                if (dimension.path("values").isArray())
                    dimension.path("values").forEach(value -> {
                        String code = value.path("valueCode").asText("");
                        if (!code.isBlank())
                            optionValueRefs.put(
                                    code, requiredOpaqueTaskRef(value, "valueRef", "catalog option-value task read"));
                    });
            });
        if (item.path("orderOptionConfigs").isArray())
            item.path("orderOptionConfigs").forEach(config -> {
                if (config.path("values").isArray())
                    config.path("values").forEach(value -> {
                        String ref = value.path("definitionValueRef").asText("");
                        String code = value.path("valueCode")
                                .asText(value.path("name").asText(""));
                        if (!ref.isBlank() && !code.isBlank()) optionValueRefs.put(code, ref);
                    });
            });
        JsonNode itemBaseMeasureUnit = item.path("baseMeasureUnit").isObject()
                ? item.path("baseMeasureUnit").deepCopy()
                : null;
        String measureMode = item.path("measureMode").asText("");
        if (measureMode.isBlank()) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品缺少 measureMode");
        java.util.Map<String, JsonNode> skuBaseMeasureUnits = new java.util.LinkedHashMap<>();
        if (item.path("skus").isArray())
            item.path("skus").forEach(sku -> {
                String code = sku.path("skuCode").asText("");
                if (!code.isBlank() && sku.path("baseMeasureUnit").isObject())
                    skuBaseMeasureUnits.put(code, sku.path("baseMeasureUnit").deepCopy());
            });
        return new CatalogInventoryProjection(
                dataNodeRef,
                brandRef,
                itemRef,
                item.path("code").asText(itemCode),
                item.path("shapeKey").asText(""),
                measureMode,
                Map.copyOf(skuRefs),
                Map.copyOf(optionValueRefs),
                itemBaseMeasureUnit,
                Map.copyOf(skuBaseMeasureUnits));
    }

    private CatalogInventoryProjection catalogInventoryProjection(
            String dataNodeRef, String brandRef, CatalogOwnerApi.CatalogItemSaveProjection projection) {
        String measureMode = projection.measureMode();
        if (measureMode == null || measureMode.isBlank())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品缺少 measureMode");
        Map<String, JsonNode> skuBaseMeasureUnits = new java.util.LinkedHashMap<>();
        projection.skuBaseMeasureUnits().forEach((code, unit) -> skuBaseMeasureUnits.put(code, unitSnapshotJson(unit)));
        return new CatalogInventoryProjection(
                dataNodeRef,
                brandRef,
                projection.itemRef().toString(),
                projection.itemCode(),
                projection.shapeKey(),
                measureMode,
                Map.copyOf(projection.productSkuRefs()),
                Map.copyOf(projection.optionValueRefs()),
                unitSnapshotJson(projection.itemBaseMeasureUnit()),
                Map.copyOf(skuBaseMeasureUnits));
    }

    private JsonNode unitSnapshotJson(InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) return null;
        return mapper.createObjectNode()
                .put("unitRef", snapshot.unitRef().toString())
                .put("code", snapshot.code())
                .put("name", snapshot.name())
                .put("unitDimension", snapshot.unitDimension())
                .put("precision", snapshot.precision());
    }

    private record CatalogInventoryProjection(
            String dataNodeRef,
            String brandRef,
            String itemRef,
            String itemCode,
            String shapeKey,
            String measureMode,
            Map<String, String> productSkuRefs,
            Map<String, String> optionValueRefs,
            JsonNode itemBaseMeasureUnit,
            Map<String, JsonNode> skuBaseMeasureUnits) {
        String productSkuRef(String skuCode) {
            return productSkuRefs.get(skuCode);
        }

        String optionValueRef(String optionValueCode) {
            return optionValueRefs.get(optionValueCode);
        }

        JsonNode consumptionUnitSnapshot(String skuCode) {
            if (skuCode != null && !skuCode.isBlank()) {
                JsonNode skuUnit = skuBaseMeasureUnits.get(skuCode);
                if (skuUnit != null) return skuUnit;
            }
            return itemBaseMeasureUnit;
        }
    }

    private Set<String> catalogItemAssetRefs(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        if (itemCode == null || itemCode.isBlank()) return Set.of();
        return catalog.readAssetReferences(dataNodeRef, brandRef, itemCode).assetRefs().stream()
                .map(UUID::toString)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    private Set<String> assetRefs(JsonNode values) {
        if (!values.isArray()) return Set.of();
        Set<String> refs = new java.util.LinkedHashSet<>();
        values.forEach(value -> {
            String ref =
                    value.isTextual() ? value.asText() : value.path("assetRef").asText("");
            if (!ref.isBlank()) refs.add(ref);
        });
        return refs;
    }

    private Set<String> catalogAssetRefs(JsonNode catalogDraft) {
        Set<String> refs = new java.util.LinkedHashSet<>(assetRefs(catalogDraft.path("images")));
        JsonNode skus = catalogDraft.path("skus");
        if (skus.isArray()) skus.forEach(sku -> refs.addAll(assetRefs(sku.path("mediaRefs"))));
        return refs;
    }

    private static JsonNode primaryRead(java.util.function.Supplier<JsonNode> read) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, read);
    }

    private static String required(ObjectNode request, String key, String fallback) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            if (fallback != null && !fallback.isBlank()) return fallback;
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        }
        return value.asText();
    }

    private static void failForManagedTestPoint(
            String actual, String expected, String code, int status, String message) {
        if (expected.equals(actual)
                && "true".equalsIgnoreCase(System.getenv(RuntimeEnvironmentKeys.V2S_CATALOG_TEST_FAULTS))) {
            throw new CatalogOwnerApi.Problem(code, status, message);
        }
    }

    private static int parsePageCursor(String value) {
        if (value == null || value.isBlank()) return 0;
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < 0) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException ex) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "cursor must be a non-negative opaque cursor", ex);
        }
    }

    private static int parsePageSize(String value, int fallback) {
        if (value == null || value.isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < 1 || parsed > 100) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException ex) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "pageSize must be between 1 and 100", ex);
        }
    }
}
