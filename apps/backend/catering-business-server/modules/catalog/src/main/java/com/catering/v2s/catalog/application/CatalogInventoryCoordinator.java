package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogOwnerService;
import com.catering.v2s.catalog.application.CatalogTaskReadService;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.inventory.application.InventoryOwnerService;
import com.catering.v2s.inventory.application.InventoryTaskReadService;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.fulfillment.production.application.ProductionTagTaskReadService;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.asset.application.PlatformAssetService.AssetReadback;
import com.catering.v2s.platform.asset.application.PlatformAssetService.StageReadback;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
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
    private static final Set<String> CATALOG_READS = Set.of(
        "getOperationsCatalogWorkbenchContext", "getOperationsCatalogNavigation", "getOperationsCatalogItems", "getOperationsCatalogItem",
        "getOperationsCatalogDictionary", "getOperationsLocalCatalogCopyCandidates", "getOperationsBrandCatalogCopyCandidates", "getOperationsCatalogShapeManifest"
    );
    private static final Set<String> CATALOG_WRITES = Set.of(
        "createOperationsCatalogItem", "saveOperationsCatalogItem", "transitionOperationsCatalogItemStatus", "createOperationsCatalogCategory", "updateOperationsCatalogCategory",
        "moveOperationsCatalogCategory", "deleteOperationsCatalogCategory", "createOperationsCatalogDictionaryEntry", "updateOperationsCatalogDictionaryEntry",
        "reorderOperationsCatalogDictionaryEntry", "transitionOperationsCatalogDictionaryEntryStatus", "preflightOperationsTemporaryCatalogItemPromotion", "executeOperationsTemporaryCatalogItemPromotion"
    );
    private static final Set<String> INVENTORY_READS = Set.of("getOperationsInventoryTargets", "getOperationsInventoryTarget", "getOperationsInventoryTargetChangeSummary", "getOperationsInventoryTargetBusinessHistory", "getOperationsInventoryTargetConsumptionReferences", "getOperationsInventoryTargetLedger", "getOperationsInventoryTargetDiagnostics");
    private static final Set<String> INVENTORY_WRITES = Set.of("countOperationsInventoryTarget", "increaseOperationsInventoryTarget", "adjustOperationsInventoryTarget", "updateOperationsInventoryTargetConfiguration");
    private static final Set<String> PRODUCTION_WRITES = Set.of("createOperationsProductionTag", "updateOperationsProductionTag", "transitionOperationsProductionTagStatus");
    private static final Set<String> CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS = Set.of(
        "ensureCatalogInventoryTarget", "saveCatalogProductBom"
    );

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
    private final InventoryTaskReadService inventoryReads;
    private final ProductionTagTaskReadService productionReads;

    /** Edge supplies decoded request data; route selection stays in named methods. */
    public record CommandRequest(String sessionCredential, String dataNodeRef, String requestedBrandRef,
                                 String correlationId, String requestId, ObjectNode body, String idempotencyKey,
                                 String testFailurePoint, Map<String, String> assetBindGrants) { }

    public CatalogInventoryCoordinator(CatalogOwnerApi catalog, InventoryOwnerApi inventory, ProductionTagOwnerApi production, PlatformAssetService assets, ObjectMapper mapper, TimeProvider time, CatalogScopeLookup catalogScopes) {
        this(catalog, inventory, production, assets, mapper, time, catalogScopes, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CatalogInventoryCoordinator(CatalogOwnerApi catalog, InventoryOwnerApi inventory, ProductionTagOwnerApi production, PlatformAssetService assets, ObjectMapper mapper, TimeProvider time, CatalogScopeLookup catalogScopes, CommandExecutionContextResolver commandContexts) {
        this.catalog = catalog; this.inventory = inventory; this.production = production; this.assets = assets; this.assetCommands = assets; this.mapper = mapper; this.time = time; this.catalogScopes = catalogScopes; this.commandContexts = commandContexts;
        this.catalogReads = new CatalogTaskReadService(catalog);
        this.inventoryReads = new InventoryTaskReadService(inventory);
        this.productionReads = new ProductionTagTaskReadService(production);
    }

    @Transactional(readOnly = true)
    public JsonNode readCatalogWorkbenchContext(String dataNodeRef, String brandRef, String requestId, String dataNodeType, String headCompanyRef,
                                                UUID workspaceUuid, String groupWorkspaceKey) {
        JsonNode result = catalogReads.workbenchContext(dataNodeRef, brandRef, requestId);
        enrichWorkbenchContext(result, dataNodeRef, brandRef, dataNodeType, headCompanyRef, workspaceUuid, groupWorkspaceKey);
        return result;
    }

    @Transactional(readOnly = true)
    public JsonNode readCatalogNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.navigation(dataNodeRef, brandRef, request, requestId);
    }

    @Transactional(readOnly = true)
    public JsonNode readCatalogItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        JsonNode result = catalogReads.items(dataNodeRef, brandRef, request, requestId);
        enrichCatalogItems(result, dataNodeRef, brandRef, requestId, dataNodeType);
        return result;
    }

    @Transactional(readOnly = true)
    public JsonNode readCatalogItem(String dataNodeRef, String brandRef, String itemCode, ObjectNode request, String requestId) {
        JsonNode result = catalogReads.item(dataNodeRef, brandRef, itemCode, requestId);
        enrichInventory(result, dataNodeRef, brandRef, request, requestId);
        return result;
    }

    @Transactional(readOnly = true)
    public JsonNode readCatalogDictionary(String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId) {
        return catalogReads.dictionary(dataNodeRef, brandRef, dictionaryKind, request, requestId);
    }

    public JsonNode readLocalCatalogCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.localCopyCandidates(dataNodeRef, brandRef, request, requestId);
    }

    public JsonNode readBrandCatalogCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return catalogReads.brandCopyCandidates(dataNodeRef, brandRef, request, requestId);
    }

    public JsonNode readCatalogShapeManifest(String requestId) { return catalogReads.shapeManifest(requestId); }

    @Transactional(readOnly = true)
    public JsonNode readInventoryTargets(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        ObjectNode inventoryRequest = request;
        JsonNode prefetchedCatalog = null;
        if (hasQuery(request, "keyword") || hasQuery(request, "categoryRef")) {
            ObjectNode catalogQuery = request.deepCopy();
            catalogQuery.put("itemCodesOnly", true); catalogQuery.remove("stockView"); catalogQuery.remove("cursor"); catalogQuery.remove("pageSize");
            // Cross-owner prefilter remains deliberately unclassified until its
            // query shape is proven as one source-bound task read.
            prefetchedCatalog = catalog.readItems(dataNodeRef, brandRef, catalogQuery, requestId);
            inventoryRequest = request.deepCopy();
            ArrayNode allowedCodes = inventoryRequest.putArray("catalogItemCodes");
            prefetchedCatalog.path("data").path("items").forEach(item -> { if (item.hasNonNull("code")) allowedCodes.add(item.path("code").asText()); });
            inventoryRequest.remove("categoryRef");
        }
        JsonNode result = inventoryReads.targets(dataNodeRef, brandRef, inventoryRequest, requestId, dataNodeType);
        enrichInventoryTargets(result, dataNodeRef, brandRef, requestId, prefetchedCatalog);
        return result;
    }

    public JsonNode readInventoryTarget(String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType) {
        JsonNode result = inventoryReads.target(dataNodeRef, brandRef, targetRef, requestId, dataNodeType);
        enrichInventoryTarget(result, dataNodeRef, brandRef, requestId);
        return result;
    }

    public JsonNode readInventoryTargetChangeSummary(String targetRef, String period) { return inventoryReads.changeSummary(targetRef, period); }

    public JsonNode readInventoryTargetBusinessHistory(String targetRef, ObjectNode request, String requestId) {
        return inventoryReads.businessHistory(targetRef, request, requestId);
    }

    public JsonNode readInventoryTargetConsumptionReferences(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId) {
        JsonNode result = inventoryReads.consumptionReferences(dataNodeRef, brandRef, targetRef, request, requestId);
        enrichInventoryConsumptionReferences(result, dataNodeRef, brandRef, requestId);
        return result;
    }

    public JsonNode readInventoryTargetLedger(String targetRef, ObjectNode request, String requestId) { return inventoryReads.ledger(targetRef, request, requestId); }

    public JsonNode readInventoryTargetDiagnostics(String targetRef, String requestId) { return inventoryReads.diagnostics(targetRef, requestId); }

    public JsonNode readProductionTags(String dataNodeRef, String brandRef, String requestId) {
        return productionReads.tags(dataNodeRef, brandRef, requestId);
    }

    /**
     * The command transaction boundary: fresh workspace facts, scope, brand and
     * opaque grant are resolved before any owner receipt or business read.
     * The legacy string dispatcher remains only for BP-U06's deferred cutover.
     */
    private JsonNode executeWorkspaceCommand(String sessionCredential, WorkspaceCommandOperationToken token,
                                             String requestedDataNodeRef, String requestedBrandRef,
                                             String correlationId, String requestId, ObjectNode request,
                                             String idempotencyKey, String testFailurePoint,
                                             Map<String, String> catalogAssetBindGrants,
                                             List<String> coordinatedInventoryDefinitionCommands) {
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = requireCommandContexts().resolveCatalog(
            sessionCredential, token, requestedDataNodeRef,
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(requestedBrandRef), correlationId, requestId
        );
        return dispatchWorkspaceCommand(context, request, idempotencyKey, testFailurePoint,
            catalogAssetBindGrants, coordinatedInventoryDefinitionCommands);
    }

    @Transactional public JsonNode createCatalogItem(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_ITEM); }
    @Transactional public JsonNode saveCatalogItem(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.SAVE_OPERATIONS_CATALOG_ITEM); }

    /**
     * One save composition: catalog remains authoritative for the item and global asset-reference
     * judgment; inventory and asset owners receive only their typed, immutable command inputs.
     */
    public CatalogOwnerApi.CatalogItemSaveReadback saveCatalogItem(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                                    CatalogOwnerApi.CatalogItemSaveCommand command,
                                                                    List<CatalogAssetCommandApi.AssetBinding> submittedBindings,
                                                                    String idempotencyKey) {
        ObjectNode request = canonicalSaveRequest(command.canonicalRequestJson());
        CatalogAuthorizationScope scope = context.ownerScope();
        Set<String> previousAssetRefs = catalogItemAssetRefs(scope.dataNodeId().toString(), scope.brandRef(), command.itemCode(), context.requestId());
        CatalogOwnerApi.CatalogItemSaveCommand normalizedCommand = new CatalogOwnerApi.CatalogItemSaveCommand(command.itemCode(), canonicalLocalJson(request));
        CatalogOwnerApi.CatalogItemSaveReadback readback = catalog.saveCatalogItem(context, normalizedCommand, idempotencyKey);
        coordinateSaveInventory(context, request, idempotencyKey);
        settleWorkspaceCatalogAssets(context, request, previousAssetRefs, idempotencyKey, submittedBindings);
        return readback;
    }
    @Transactional public JsonNode transitionCatalogItemStatus(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS); }
    @Transactional public JsonNode createCatalogCategory(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_CATEGORY); }
    @Transactional public JsonNode updateCatalogCategory(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_CATALOG_CATEGORY); }
    @Transactional public JsonNode moveCatalogCategory(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.MOVE_OPERATIONS_CATALOG_CATEGORY); }
    @Transactional public JsonNode deleteCatalogCategory(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.DELETE_OPERATIONS_CATALOG_CATEGORY); }
    @Transactional public JsonNode createCatalogDictionaryEntry(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY); }
    @Transactional public JsonNode updateCatalogDictionaryEntry(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY); }
    @Transactional public JsonNode reorderCatalogDictionaryEntry(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY); }
    @Transactional public JsonNode transitionCatalogDictionaryEntryStatus(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS); }
    @Transactional public JsonNode createProductionTag(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_PRODUCTION_TAG); }
    @Transactional public JsonNode updateProductionTag(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_PRODUCTION_TAG); }
    @Transactional public JsonNode transitionProductionTagStatus(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS); }
    @Transactional public JsonNode preflightLocalCatalogCopy(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY); }
    @Transactional public JsonNode executeLocalCatalogCopy(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY); }
    @Transactional public JsonNode preflightTemporaryCatalogPromotion(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION); }
    @Transactional public JsonNode executeTemporaryCatalogPromotion(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION); }
    @Transactional public JsonNode preflightBrandCatalogCopy(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY); }
    @Transactional public JsonNode executeBrandCatalogCopy(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_BRAND_CATALOG_COPY); }
    @Transactional public JsonNode countInventoryTarget(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.COUNT_OPERATIONS_INVENTORY_TARGET); }
    @Transactional public JsonNode increaseInventoryTarget(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.INCREASE_OPERATIONS_INVENTORY_TARGET); }
    @Transactional public JsonNode adjustInventoryTarget(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.ADJUST_OPERATIONS_INVENTORY_TARGET); }
    @Transactional public JsonNode updateInventoryTargetConfiguration(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION); }
    @Transactional public JsonNode releaseCatalogAsset(CommandRequest request) { return execute(request, CatalogInventoryWorkspaceCommandTokens.RELEASE_OPERATIONS_CATALOG_STAGED_ASSET); }

    private JsonNode execute(CommandRequest request, WorkspaceCommandOperationToken token) {
        return executeWorkspaceCommand(request.sessionCredential(), token, request.dataNodeRef(), request.requestedBrandRef(),
            request.correlationId(), request.requestId(), request.body(), request.idempotencyKey(), request.testFailurePoint(),
            request.assetBindGrants(), token.operationId().equals("saveOperationsCatalogItem") ? CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS.stream().sorted().toList() : List.of());
    }

    @Transactional
    public JsonNode stageWorkspaceAsset(String sessionCredential, WorkspaceCommandOperationToken token,
                                        String requestedDataNodeRef, String requestedBrandRef,
                                        String correlationId, String requestId, String fileName, String mediaType,
                                        String contentDigest, byte[] bytes, String idempotencyKey, String testFailurePoint) {
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = requireCommandContexts().resolveCatalog(
            sessionCredential, token, requestedDataNodeRef,
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(requestedBrandRef), correlationId, requestId
        );
        if (fileName == null || fileName.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "fileName is required");
        if (mediaType == null || mediaType.isBlank() || bytes == null || bytes.length == 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "multipart content is required");
        if (!stagedDigestMatches(contentDigest, bytes)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "contentDigest does not match content");
        failForManagedTestPoint(testFailurePoint, "asset-processing", "ASSET_PROCESSING_FAILED", 422, "资产处理失败");
        try {
            StageReadback staged = assets.stageCatalogContent(context, mediaType, bytes.length, new ByteArrayInputStream(bytes), idempotencyKey);
            AssetReadback asset = assets.require(staged.assetRef());
            ObjectNode result = mapper.createObjectNode().put("assetRef", staged.assetRef().toString()).put("bindGrant", staged.bindGrant())
                .put("status", asset.status()).put("mediaType", staged.contentType()).put("contentDigest", staged.sha256()).putNull("readyAt").put("version", asset.version());
            ObjectNode readback = mapper.createObjectNode().put("revision", REVISION).put("requestId", context.requestId());
            readback.set("result", result); readback.put("version", asset.version());
            return readback;
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权");
        }
    }

    private JsonNode dispatchWorkspaceCommand(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request,
                                               String idempotencyKey, String testFailurePoint,
                                               Map<String, String> catalogAssetBindGrants,
                                               List<String> coordinatedInventoryDefinitionCommands) {
        CatalogAuthorizationScope scope = context.ownerScope();
            String operationId = context.operationToken().operationId();
            String dataNodeRef = scope.dataNodeId().toString();
            String brandRef = scope.brandRef();
            if ("saveOperationsCatalogItem".equals(operationId)) requireCatalogSaveInventoryDefinitionCommands(coordinatedInventoryDefinitionCommands);
            if (CATALOG_WRITES.contains(operationId)) {
                if ("transitionOperationsCatalogItemStatus".equals(operationId) && "VOIDED".equals(request.path("targetStatus").asText())) {
                    String itemRef = catalogItemRef(dataNodeRef, brandRef, request.path("itemCode").asText(), context.requestId());
                    JsonNode dependencies = inventory.catalogItemVoidDependencies(dataNodeRef, brandRef, itemRef, context.requestId());
                    if (dependencies.path("hasDependentFacts").asBoolean(false)) throw new CatalogOwnerApi.Problem("DEPENDENT_FACTS_BLOCK_VOID", 422, "库存对象或 BOM 仍存在，不能作废商品");
                }
                Set<String> previousAssetRefs = "saveOperationsCatalogItem".equals(operationId)
                    ? catalogItemAssetRefs(dataNodeRef, brandRef, request.path("itemCode").asText(), context.requestId()) : Set.of();
                JsonNode result = catalog.write(context, request, idempotencyKey);
                if ("saveOperationsCatalogItem".equals(operationId)) {
                    coordinateSaveInventory(context, request, idempotencyKey);
                    settleWorkspaceCatalogAssets(context, request, previousAssetRefs, idempotencyKey, assetBindings(catalogAssetBindGrants));
                }
                return result;
            }
            if (operationId.equals("preflightOperationsLocalCatalogCopy") || operationId.equals("executeOperationsLocalCatalogCopy")) {
                return dispatchWorkspaceLocalCopy(context, request, idempotencyKey);
            }
            if (operationId.equals("preflightOperationsBrandCatalogCopy") || operationId.equals("executeOperationsBrandCatalogCopy")) {
                return dispatchWorkspaceBrandCopy(context, request, idempotencyKey, testFailurePoint);
            }
            if (INVENTORY_WRITES.contains(operationId)) return inventory.write(context, request, idempotencyKey);
            if (operationId.equals("transitionOperationsProductionTagStatus") && "VOIDED".equals(request.path("targetStatus").asText())) {
                String tagRef = productionTagRef(dataNodeRef, brandRef, request.path("tagCode").asText(), context.requestId());
                if (tagRef != null && catalog.productionTagReferenced(dataNodeRef, brandRef, tagRef)) throw new ProductionTagOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, "生产标签仍被商品引用，不能作废");
            }
            if (PRODUCTION_WRITES.contains(operationId)) return production.write(context, request, idempotencyKey);
            if (operationId.equals("releaseOperationsCatalogStagedAsset")) return releaseWorkspaceAsset(context, request, idempotencyKey);
        throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "operation is not a catalog-inventory workspace command");
    }

    private JsonNode dispatchWorkspaceLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        boolean execute = "executeOperationsLocalCatalogCopy".equals(context.operationToken().operationId());
        ObjectNode catalogRequest = request.deepCopy();
        JsonNode catalogPreflight = catalogCopyPreflight(context, catalogRequest);
        CopyReferencePlan catalogPlan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightInventoryIfSelected(context, request, catalogPlan);
        String catalogDigest = preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), "");
        JsonNode merged = mergeCopyPreflight(catalogPreflight, owners, combined, !execute);
        if (!execute) return merged;
        if (!request.path("preflightDigest").asText("").equals(combined)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (preflightData(catalogPreflight) instanceof ObjectNode mergedData) enforceMergedClosureLimit(mergedData);
        CopyReferencePlan executionPlan = catalogPlan.merge(ownerReferencePlan(owners.inventoryJudgement()));
        catalogRequest.put("preflightDigest", catalogDigest); applyCopyReferencePlan(catalogRequest, executionPlan);
        JsonNode result = catalog.copy(context, catalogRequest, idempotencyKey);
        if (owners.inventoryDigest() != null && !owners.inventoryDigest().isBlank()) {
            ObjectNode inventoryRequest = request.deepCopy(); inventoryRequest.put("inventoryPreflightDigest", owners.inventoryDigest());
            applyCopyReferencePlan(inventoryRequest, executionPlan);
            result = appendOwnerReadback(result, inventory.copy(context, inventoryRequest, idempotencyKey), "inventory");
        }
        return result;
    }

    /** Typed local-copy composition with catalog and inventory owner-native commands. */
    public record LocalCopyPreflightReadback(String canonicalJson) { }

    public LocalCopyPreflightReadback preflightLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                          CatalogOwnerApi.LocalCopyPreflightCommand command) {
        JsonNode catalogPreflight = parseLocalCopyJson(catalog.preflightLocalCopy(context, command).canonicalJson());
        CopyReferencePlan plan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightLocalInventory(context, command, plan);
        String combined = combinedDigest(preflightData(catalogPreflight).path("preflightDigest").asText(), owners.inventoryDigest(), "");
        return new LocalCopyPreflightReadback(canonicalLocalCopyJson(mergeCopyPreflight(catalogPreflight, owners, combined)));
    }

    public record LocalCopyExecutionReadback(CatalogOwnerApi.CopyExecutionReadback catalog,
                                             List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks) { }

    public LocalCopyExecutionReadback executeLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                              CatalogOwnerApi.LocalCopyExecuteCommand command,
                                              String submittedDigest, String idempotencyKey) {
        CatalogOwnerApi.LocalCopyPreflightCommand current = new CatalogOwnerApi.LocalCopyPreflightCommand(command.sourceItemCode(), command.targetItemCode(), command.selectedSections());
        JsonNode catalogPreflight = parseLocalCopyJson(catalog.preflightLocalCopy(context, current).canonicalJson());
        CopyReferencePlan plan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightLocalInventory(context, current, plan);
        String combined = combinedDigest(preflightData(catalogPreflight).path("preflightDigest").asText(), owners.inventoryDigest(), "");
        if (!combined.equals(submittedDigest)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        CatalogOwnerApi.CopyExecutionReadback catalogReadback = catalog.executeLocalCopy(context, new CatalogOwnerApi.LocalCopyExecuteCommand(
            command.sourceItemCode(), command.targetItemCode(), command.selectedSections(), preflightData(catalogPreflight).path("preflightDigest").asText(),
            command.expectedSourceVersion(), command.expectedTargetVersion(), canonicalReferencePlan(plan)), idempotencyKey);
        java.util.ArrayList<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks = new java.util.ArrayList<>(catalogReadback.ownerReadbacks());
        if (owners.inventoryDigest() != null && !owners.inventoryDigest().isBlank()) {
            InventoryOwnerApi.LocalCopyExecutionReadback inventoryReadback = inventory.executeLocalCopy(context,
                new InventoryOwnerApi.LocalCopyExecuteCommand(command.sourceItemCode(), command.targetItemCode(), command.selectedSections(), owners.inventoryDigest(), canonicalReferencePlan(plan)), idempotencyKey);
            ownerReadbacks.add(new CatalogOwnerApi.CopyOwnerReadback(inventoryReadback.owner(), inventoryReadback.status(), inventoryReadback.version()));
        }
        return new LocalCopyExecutionReadback(catalogReadback, List.copyOf(ownerReadbacks));
    }

    private OwnerPreflight preflightLocalInventory(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                   CatalogOwnerApi.LocalCopyPreflightCommand command, CopyReferencePlan plan) {
        if (!containsInventorySection(mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()))) return new OwnerPreflight("", "", null, null);
        InventoryOwnerApi.LocalCopyPreflightReadback readback = inventory.preflightLocalCopy(context,
            new InventoryOwnerApi.LocalCopyPreflightCommand(command.targetItemCode(), command.selectedSections(), canonicalReferencePlan(plan)));
        return new OwnerPreflight(readback.preflightDigest(), "", parseLocalCopyJson(readback.canonicalJson()), null);
    }

    /** One brand-copy composition operation: owners return typed opaque readbacks; this coordinator only merges them. */
    public BrandCopyPreflightReadback preflightBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                         CatalogOwnerApi.BrandCopyPreflightCommand command) {
        JsonNode catalogPreflight = parseLocalCopyJson(catalog.preflightBrandCopy(context, command).canonicalJson());
        CopyReferencePlan catalogPlan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightBrandOwners(context, command, catalogPlan);
        String combined = combinedDigest(preflightData(catalogPreflight).path("preflightDigest").asText(), owners.inventoryDigest(), owners.productionDigest());
        return new BrandCopyPreflightReadback(canonicalLocalCopyJson(mergeCopyPreflight(catalogPreflight, owners, combined)));
    }

    public record BrandCopyExecutionReadback(CatalogOwnerApi.CopyExecutionReadback catalog,
                                             List<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks) { }

    public BrandCopyExecutionReadback executeBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                     CatalogOwnerApi.BrandCopyExecuteCommand command,
                                                     String submittedDigest, String idempotencyKey) {
        return executeBrandCopy(context, command, submittedDigest, idempotencyKey, null);
    }

    public BrandCopyExecutionReadback executeBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                     CatalogOwnerApi.BrandCopyExecuteCommand command,
                                                     String submittedDigest, String idempotencyKey, String testFailurePoint) {
        CatalogOwnerApi.BrandCopyPreflightCommand current = new CatalogOwnerApi.BrandCopyPreflightCommand(command.selectedItemCodes(), command.targetDataNodeRef());
        JsonNode catalogPreflight = parseLocalCopyJson(catalog.preflightBrandCopy(context, current).canonicalJson());
        CopyReferencePlan catalogPlan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightBrandOwners(context, current, catalogPlan);
        String catalogDigest = preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), owners.productionDigest());
        if (!combined.equals(submittedDigest)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (preflightData(catalogPreflight) instanceof ObjectNode data) enforceMergedClosureLimit(data);
        CopyReferencePlan executionPlan = catalogPlan.merge(ownerReferencePlan(owners.inventoryJudgement())).merge(ownerReferencePlan(owners.productionJudgement()));
        CatalogOwnerApi.CopyExecutionReadback catalogReadback = catalog.executeBrandCopy(context, new CatalogOwnerApi.BrandCopyExecuteCommand(
            command.selectedItemCodes(), command.targetDataNodeRef(), catalogDigest, command.expectedSourceVersion(), command.expectedTargetVersion(), canonicalReferencePlan(executionPlan)), idempotencyKey);
        failForManagedTestPoint(testFailurePoint, "owner-failure", "RESULT_UNKNOWN", 500, "受控 owner failure fixture");
        java.util.ArrayList<CatalogOwnerApi.CopyOwnerReadback> ownerReadbacks = new java.util.ArrayList<>(catalogReadback.ownerReadbacks());
        InventoryOwnerApi.LocalCopyExecutionReadback inventoryReadback = inventory.executeBrandCopy(context, new InventoryOwnerApi.BrandCopyExecuteCommand(
            command.selectedItemCodes(), command.targetDataNodeRef(), owners.inventoryDigest(), canonicalReferencePlan(executionPlan)), idempotencyKey);
        ownerReadbacks.add(new CatalogOwnerApi.CopyOwnerReadback(inventoryReadback.owner(), inventoryReadback.status(), inventoryReadback.version()));
        ProductionTagOwnerApi.BrandCopyExecutionReadback productionReadback = production.executeBrandCopy(context, new ProductionTagOwnerApi.BrandCopyExecuteCommand(
            command.selectedItemCodes(), command.targetDataNodeRef(), owners.productionDigest(), canonicalReferencePlan(executionPlan)), idempotencyKey);
        ownerReadbacks.add(new CatalogOwnerApi.CopyOwnerReadback(productionReadback.owner(), productionReadback.status(), productionReadback.version()));
        return new BrandCopyExecutionReadback(catalogReadback, List.copyOf(ownerReadbacks));
    }

    private OwnerPreflight preflightBrandOwners(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                CatalogOwnerApi.BrandCopyPreflightCommand command, CopyReferencePlan catalogPlan) {
        String plan = canonicalReferencePlan(catalogPlan);
        InventoryOwnerApi.LocalCopyPreflightReadback inventoryReadback = inventory.preflightBrandCopy(context,
            new InventoryOwnerApi.BrandCopyPreflightCommand(command.selectedItemCodes(), command.targetDataNodeRef(), plan));
        ProductionTagOwnerApi.BrandCopyPreflightReadback productionReadback = production.preflightBrandCopy(context,
            new ProductionTagOwnerApi.BrandCopyPreflightCommand(command.selectedItemCodes(), command.targetDataNodeRef(), plan));
        return new OwnerPreflight(inventoryReadback.preflightDigest(), productionReadback.preflightDigest(),
            parseLocalCopyJson(inventoryReadback.canonicalJson()), parseLocalCopyJson(productionReadback.canonicalJson()));
    }

    public record BrandCopyPreflightReadback(String canonicalJson) { }

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
    private String canonicalLocalCopyJson(JsonNode value) { try { return mapper.writeValueAsString(value); } catch (Exception failure) { throw new IllegalStateException("copy composition could not encode readback", failure); } }
    private String canonicalReferencePlan(CopyReferencePlan plan) { ObjectNode value = mapper.createObjectNode(); value.set("closureItemRefs", plan.closureItemRefs().deepCopy()); value.set("productionTagRefs", plan.productionTagRefs().deepCopy()); value.set("referenceMappings", plan.referenceMappings().deepCopy()); return canonicalLocalCopyJson(value); }

    private JsonNode dispatchWorkspaceBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey, String testFailurePoint) {
        boolean execute = "executeOperationsBrandCatalogCopy".equals(context.operationToken().operationId());
        ObjectNode catalogRequest = request.deepCopy();
        JsonNode catalogPreflight = catalogCopyPreflight(context, catalogRequest);
        CopyReferencePlan catalogPlan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightBrandOwners(context, request, catalogPlan);
        String catalogDigest = preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), owners.productionDigest());
        JsonNode merged = mergeCopyPreflight(catalogPreflight, owners, combined, !execute);
        if (!execute) return merged;
        if (!request.path("preflightDigest").asText("").equals(combined)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (preflightData(catalogPreflight) instanceof ObjectNode mergedData) enforceMergedClosureLimit(mergedData);
        CopyReferencePlan executionPlan = catalogPlan.merge(ownerReferencePlan(owners.inventoryJudgement())).merge(ownerReferencePlan(owners.productionJudgement()));
        catalogRequest.put("preflightDigest", catalogDigest); applyCopyReferencePlan(catalogRequest, executionPlan);
        JsonNode result = catalog.copy(context, catalogRequest, idempotencyKey);
        failForManagedTestPoint(testFailurePoint, "owner-failure", "RESULT_UNKNOWN", 500, "受控 owner failure fixture");
        ObjectNode inventoryRequest = request.deepCopy(); inventoryRequest.put("inventoryPreflightDigest", owners.inventoryDigest()); applyCopyReferencePlan(inventoryRequest, executionPlan);
        result = appendOwnerReadback(result, inventory.copy(context, inventoryRequest, idempotencyKey), "inventory");
        ObjectNode productionRequest = request.deepCopy(); productionRequest.put("productionPreflightDigest", owners.productionDigest()); applyCopyReferencePlan(productionRequest, executionPlan);
        return appendOwnerReadback(result, production.copy(context, productionRequest, idempotencyKey), "fulfillment-production");
    }

    private OwnerPreflight preflightBrandOwners(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, CopyReferencePlan catalogPlan) {
        ObjectNode ownerRequest = request.deepCopy(); applyCopyReferencePlan(ownerRequest, catalogPlan);
        JsonNode inventoryJudgement = inventory.preflightCopy(context, ownerRequest);
        JsonNode productionJudgement = production.preflightCopy(context, ownerRequest);
        return new OwnerPreflight(inventoryJudgement.path("digest").asText(), productionJudgement.path("digest").asText(), inventoryJudgement, productionJudgement);
    }

    /**
     * The coordinator may combine owner digests, but catalog preflight itself
     * must stay catalog-only.  This remains true when the live command token is
     * the execute variant, so it cannot be routed through {@link CatalogOwnerApi#copy}.
     */
    JsonNode catalogCopyPreflight(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        return catalog.preflightCopy(context, request);
    }

    private OwnerPreflight preflightInventoryIfSelected(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, CopyReferencePlan catalogPlan) {
        if (!containsInventorySection(request.path("selectedSections"))) return new OwnerPreflight("", "", null, null);
        ObjectNode ownerRequest = request.deepCopy(); applyCopyReferencePlan(ownerRequest, catalogPlan);
        ownerRequest.put("targetItemCode", request.path("targetItemCode").asText());
        JsonNode judgement = inventory.preflightCopy(context, ownerRequest);
        return new OwnerPreflight(judgement.path("digest").asText(), "", judgement, null);
    }

    private void coordinateSaveInventory(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = context.ownerScope();
        JsonNode sections = request.path("sections"); JsonNode configuration = sections.path("inventoryConfiguration");
        JsonNode expectedVersions = sections.path("expectedInventoryVersions"); JsonNode draft = sections.path("catalogDraft");
        if (!configuration.path("nodes").isArray() && !draft.path("inventoryBom").isArray()) return;
        CatalogInventoryProjection projection = catalogInventoryProjection(scope.dataNodeId().toString(), scope.brandRef(), request.path("itemCode").asText(), context.requestId());
        java.util.Map<String, Long> versions = new java.util.HashMap<>();
        if (expectedVersions.isArray()) expectedVersions.forEach(expected -> versions.put(expected.path("targetRef").asText(), expected.path("version").asLong()));
        if (configuration.path("nodes").isArray()) for (JsonNode sourceNode : configuration.path("nodes")) {
            if (!sourceNode.isObject()) continue;
            ObjectNode node = (ObjectNode) sourceNode; String mode = node.path("mode").asText("NONE");
            if ("NONE".equals(mode) || "BOM".equals(mode)) continue;
            String targetRef = node.path("targetRef").asText(""); String itemCode = node.path("itemCode").asText(request.path("itemCode").asText(""));
            String skuCode = node.hasNonNull("skuCode") ? node.path("skuCode").asText() : null;
            String itemRef = opaqueProjectionRef(node, "itemRef", projection.itemRef(), "inventoryConfiguration.itemRef");
            String productSkuRef = skuCode == null ? null : opaqueProjectionRef(node, "productSkuRef", projection.productSkuRef(skuCode), "inventoryConfiguration.productSkuRef");
            ObjectNode ensure = mapper.createObjectNode().put("itemRef", itemRef).put("itemCode", itemCode).put("mode", mode);
            if (productSkuRef == null) ensure.putNull("productSkuRef"); else ensure.put("productSkuRef", productSkuRef);
            if (skuCode == null) ensure.putNull("skuCode"); else ensure.put("skuCode", skuCode);
            if (!targetRef.isBlank()) ensure.put("targetRef", targetRef);
            String unit = node.path("consumptionUnit").asText(node.path("unit").asText(node.path("configuration").path("countingUnit").asText("")));
            if (!unit.isBlank()) ensure.put("consumptionUnit", unit);
            if (node.path("configuration").isObject()) ensure.set("configuration", node.path("configuration"));
            if (!targetRef.isBlank() && node.path("configuration").isObject() && node.path("configuration").size() > 0) {
                Long expected = versions.get(targetRef); if (expected == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory target version is required"); ensure.put("expectedVersion", expected);
            }
            InventoryTargetEnsureReadback ensured = parseCatalogSaveOwnerReadback(inventory.ensureCatalogItemSaveTarget(
                context, new InventoryOwnerApi.CatalogItemSaveEnsureTargetCommand(canonicalLocalJson(ensure)),
                idempotencyKey + ":ensure:" + itemRef + ":" + (productSkuRef == null ? "ITEM" : productSkuRef)).canonicalJson());
            node.put("targetRef", ensured.targetRef());
        }
        if (draft.path("inventoryBom").isArray()) {
            java.util.Map<String, ArrayNode> grouped = new java.util.LinkedHashMap<>(); java.util.Map<String, ObjectNode> commands = new java.util.LinkedHashMap<>(); java.util.Map<String, Long> versionsByKey = new java.util.HashMap<>();
            draft.path("inventoryBom").forEach(entry -> {
                if (!"BOM".equals(entry.path("mode").asText("NONE"))) return;
                String skuCode = entry.hasNonNull("skuCode") ? entry.path("skuCode").asText() : ""; String optionValueCode = entry.hasNonNull("optionValueCode") ? entry.path("optionValueCode").asText() : "";
                if (!skuCode.isBlank() && !optionValueCode.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM owner 不能同时指定 SKU 与选项值");
                String itemRef = opaqueProjectionRef(entry, "itemRef", projection.itemRef(), "inventoryBom.itemRef"); String productSkuRef = skuCode.isBlank() ? null : opaqueProjectionRef(entry, "productSkuRef", projection.productSkuRef(skuCode), "inventoryBom.productSkuRef"); String optionValueRef = optionValueCode.isBlank() ? null : opaqueProjectionRef(entry, "optionValueRef", projection.optionValueRef(optionValueCode), "inventoryBom.optionValueRef");
                String key = itemRef + "|" + (productSkuRef == null ? "" : productSkuRef) + "|" + (optionValueRef == null ? "" : optionValueRef);
                grouped.computeIfAbsent(key, ignored -> mapper.createArrayNode()).add(entry);
                commands.computeIfAbsent(key, ignored -> { ObjectNode command = mapper.createObjectNode().put("itemRef", itemRef).put("itemCode", entry.path("itemCode").asText(request.path("itemCode").asText(""))); if (productSkuRef == null) command.putNull("productSkuRef"); else command.put("productSkuRef", productSkuRef); if (optionValueRef == null) command.putNull("optionValueRef"); else command.put("optionValueRef", optionValueRef); if (skuCode.isBlank()) command.putNull("skuCode"); else command.put("skuCode", skuCode); if (optionValueCode.isBlank()) command.putNull("optionValueCode"); else command.put("optionValueCode", optionValueCode); return command; });
                if (entry.has("version")) versionsByKey.putIfAbsent(key, entry.path("version").asLong());
            });
            grouped.forEach((key, entries) -> { ObjectNode command = commands.get(key).deepCopy(); command.set("rows", entries); command.put("expectedVersion", versionsByKey.getOrDefault(key, 0L)); inventory.saveCatalogItemProductBom(context, new InventoryOwnerApi.CatalogItemSaveBomCommand(canonicalLocalJson(command)), idempotencyKey + ":bom:" + key); });
        }
    }

    private JsonNode releaseWorkspaceAsset(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        UUID ref; try { ref = UUID.fromString(required(request, "assetRef", "")); } catch (IllegalArgumentException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "assetRef is invalid"); }
        assets.lockCatalogReferences(Set.of(ref));
        if (catalog.assetReferencedAnywhere(ref.toString())) throw new CatalogOwnerApi.Problem("ASSET_REFERENCE_PROTECTED", 409, "图片资产仍被商品引用，不能释放");
        try {
            AssetReadback readback = assets.releaseCatalogStaged(ref, request.path("expectedVersion").asLong(1), idempotencyKey, context);
            ObjectNode result = mapper.createObjectNode().put("assetRef", readback.assetRef().toString()).put("disposition", "RELEASED").put("releasedAt", time.currentEpochMillis()).put("version", readback.version());
            ObjectNode response = mapper.createObjectNode().put("revision", REVISION).put("requestId", context.requestId()); response.set("result", result); response.put("version", readback.version()); return response;
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) { throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权"); }
        catch (PlatformAssetService.AssetIdempotencyConflictException failure) { throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他资产释放请求"); }
        catch (PlatformAssetService.AssetClaimRejectedException failure) { throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "待释放资产不存在或版本已变化"); }
    }

    private void settleWorkspaceCatalogAssets(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request,
                                               Set<String> previousAssetRefs, String idempotencyKey,
                                               List<CatalogAssetCommandApi.AssetBinding> submittedBindings) {
        Set<String> nextAssetRefs = catalogAssetRefs(request.path("sections").path("catalogDraft"));
        java.util.List<CatalogAssetCommandApi.AssetBinding> bindings = new java.util.ArrayList<>();
        java.util.List<CatalogAssetCommandApi.PriorAssetReference> releasable = new java.util.ArrayList<>();
        try {
            for (String ref : nextAssetRefs) bindings.add(optionalAssetBinding(ref, submittedBindings));
        Set<String> candidates = new java.util.LinkedHashSet<>(previousAssetRefs); candidates.removeAll(nextAssetRefs);
        Set<String> stillReferenced = catalog.assetRefsStillReferenced(candidates);
        for (String ref : candidates) {
            if (stillReferenced.contains(ref)) continue;
                releasable.add(new CatalogAssetCommandApi.PriorAssetReference(UUID.fromString(ref)));
            }
            assetCommands.settleCatalogSaveAssets(context, new CatalogAssetCommandApi.SaveSettlementCommand(bindings, releasable, idempotencyKey));
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef");
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权");
        } catch (PlatformAssetService.AssetClaimRejectedException failure) {
            throw new CatalogOwnerApi.Problem("ASSET_REFERENCE_PROTECTED", 409, "图片资产尚未准备好或已失效、版本已变化或仍被引用");
        }
    }

    /** Exact payload owned by inventory's catalog-save task envelope. */
    private record InventoryTargetEnsureReadback(String targetRef, long version, boolean created) { }

    private String requiredInventoryTargetRef(JsonNode readback) {
        if (readback == null || !readback.isObject()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback is invalid");
        }
        String targetRef = readback.path("targetRef").asText();
        if (targetRef.isBlank()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback targetRef is required");
        }
        return targetRef;
    }

    private InventoryTargetEnsureReadback parseCatalogSaveOwnerReadback(String canonicalJson) {
        try {
            var envelope = mapper.readTree(canonicalJson);
            if (!envelope.path("data").isObject()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback data is invalid");
            }
            JsonNode data = envelope.path("data");
            if (!data.hasNonNull("targetRef") || !data.path("version").canConvertToLong() || !data.path("created").isBoolean()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback fields are invalid");
            }
            InventoryTargetEnsureReadback readback = mapper.treeToValue(data, InventoryTargetEnsureReadback.class);
            if (readback == null || readback.targetRef() == null || readback.targetRef().isBlank()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback targetRef is required");
            }
            return readback;
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback is invalid", failure);
        }
    }

    private String canonicalLocalJson(JsonNode value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception failure) { throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog save composition cannot encode owner request", failure); }
    }

    private ObjectNode canonicalSaveRequest(String canonicalRequestJson) {
        try {
            JsonNode parsed = mapper.readTree(canonicalRequestJson);
            if (!parsed.isObject()) throw new IllegalArgumentException("request must be object");
            ObjectNode request = (ObjectNode) parsed;
            JsonNode draft = request.path("sections").path("catalogDraft");
            if (draft.isObject()) {
                promoteMaterialRoleFromOpaqueProfile((ObjectNode) draft);
                omitTypedNullFields(draft, "/sections/catalogDraft");
            }
            return request;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog save request is invalid", failure);
        }
    }

    /**
     * The generated catalog draft has no typed materialRole field; the edge
     * request therefore preserves it only inside the opaque item profile.
     * Promote that one public catalog field before the owner command while
     * leaving the rest of the profile opaque and owner-owned.
     */
    private static void promoteMaterialRoleFromOpaqueProfile(ObjectNode draft) {
        JsonNode explicit = draft.get("materialRole");
        if (explicit != null && !explicit.isNull()) return;
        JsonNode opaque = draft.path("productionProfiles").path("item").path("materialRole");
        if (opaque.isTextual() && !opaque.asText().isBlank()) draft.set("materialRole", opaque.deepCopy());
    }

    /**
     * Jackson 3 materializes omitted nullable record components before this
     * request crosses into the catalog owner.  Catalog draft save is a merge:
     * an omitted field preserves the owner fact, while an empty collection or
     * scalar remains an explicit replacement.  Restore omission only for the
     * typed draft tree; raw CanonicalJsonDocument values remain opaque owner
     * JSON and are not rewritten.
     */
    private static void omitTypedNullFields(JsonNode value, String path) {
        if (value == null || value.isNull() || isOpaqueCanonicalDocument(path)) return;
        if (value.isObject()) {
            ObjectNode object = (ObjectNode) value;
            List<String> nullFields = new java.util.ArrayList<>();
            object.fields().forEachRemaining(entry -> {
                String childPath = path + "/" + entry.getKey();
                if (entry.getValue().isNull()) nullFields.add(entry.getKey());
                else omitTypedNullFields(entry.getValue(), childPath);
            });
            nullFields.forEach(object::remove);
        } else if (value.isArray()) {
            value.forEach(entry -> omitTypedNullFields(entry, path + "[]"));
        }
    }

    private static boolean isOpaqueCanonicalDocument(String path) {
        return "/sections/catalogDraft/attributes".equals(path)
            || "/sections/catalogDraft/productionProfiles/item".equals(path)
            || "/sections/catalogDraft/productionProfiles/sku".equals(path)
            || "/sections/catalogDraft/productionProfiles/optionValue".equals(path);
    }

    private static List<CatalogAssetCommandApi.AssetBinding> assetBindings(Map<String, String> grants) {
        return grants.entrySet().stream().map(entry -> new CatalogAssetCommandApi.AssetBinding(UUID.fromString(entry.getKey()), entry.getValue())).toList();
    }

    private static CatalogAssetCommandApi.AssetBinding optionalAssetBinding(String assetRef, List<CatalogAssetCommandApi.AssetBinding> submittedBindings) {
        UUID ref;
        try { ref = UUID.fromString(assetRef); } catch (IllegalArgumentException failure) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef"); }
        return submittedBindings.stream().filter(binding -> binding != null && ref.equals(binding.assetRef())).findFirst()
            .orElse(new CatalogAssetCommandApi.AssetBinding(ref, null));
    }

    private CommandExecutionContextResolver requireCommandContexts() {
        if (commandContexts == null) throw new IllegalStateException("CommandExecutionContextResolver is required for workspace commands");
        return commandContexts;
    }

    private String productionTagRef(String dataNodeRef, String brandRef, String tagCode, String requestId) {
        if (tagCode == null || tagCode.isBlank()) return null;
        JsonNode entries = production.read("getOperationsProductionTags", dataNodeRef, brandRef, mapper.createObjectNode(), requestId)
            .path("data").path("entries");
        if (entries.isArray()) for (JsonNode entry : entries) if (tagCode.equals(entry.path("code").asText())) return entry.path("tagRef").asText(null);
        return null;
    }

    private void enrichWorkbenchContext(JsonNode result, String dataNodeRef, String brandRef, String dataNodeType, String headCompanyRef, UUID workspaceUuid, String groupWorkspaceKey) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        ObjectNode data = (ObjectNode) envelope.path("data");
        if (headCompanyRef == null || headCompanyRef.isBlank()) data.putNull("headCompanyRef"); else data.put("headCompanyRef", headCompanyRef);
        boolean sourceAvailable = false;
        if ("STORE".equals(dataNodeType) && headCompanyRef != null && !headCompanyRef.isBlank()) {
            try { catalogScopes.resolveCatalogCopySource(workspaceUuid, groupWorkspaceKey, dataNodeType, UUID.fromString(dataNodeRef), brandRef); sourceAvailable = true; }
            catch (RuntimeException ignored) { sourceAvailable = false; }
        }
        data.put("copySourceAvailable", sourceAvailable);
        data.with("actionAvailability").put("canCopy", sourceAvailable);
    }

    /** Brand copy source is an organization fact, never request authority. */
    String resolveBrandCopySource(ObjectNode request, UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, String targetDataNodeRef, String brandRef) {
        try {
            UUID source = catalogScopes.resolveCatalogCopySource(workspaceUuid, groupWorkspaceKey, dataNodeType, UUID.fromString(targetDataNodeRef), brandRef);
            return source.toString();
        } catch (RuntimeException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "复制来源不属于当前品牌与目标门店的组织授权范围");
        }
    }

    private boolean containsInventorySection(JsonNode sections) { if (!sections.isArray()) return false; for (JsonNode section : sections) if (List.of("ITEM_BOM", "SKU_BOM", "OPTION_VALUE_BOM").contains(section.asText())) return true; return false; }
    // NOT_APPLICABLE_WITH_REASON: CatalogOwnerApi copy preflight is a distinct canonical owner payload;
    // the typed CopyPreflightReadback and legacy copy entrypoint deliberately do not share detail's HTTP envelope.
    private JsonNode preflightData(JsonNode preflight) { return preflight != null && preflight.path("data").isObject() ? preflight.path("data") : preflight; }

    /**
     * Copy commands deliberately carry only opaque identities.  Codes remain in
     * mapping entries as read labels, never as traversal, persistence or rewrite
     * identity.  This is a fail-closed coordinator boundary: an owner that has
     * not produced the reference plan cannot be composed into a copy transaction.
     */
    CopyReferencePlan copyReferencePlan(JsonNode ownerResponse) {
        ArrayNode normalizedMappings = normalizedReferenceMappings(ownerResponse, true);
        ArrayNode itemRefs = mapper.createArrayNode();
        ArrayNode productionTagRefs = mapper.createArrayNode();
        java.util.LinkedHashSet<String> itemSeen = new java.util.LinkedHashSet<>();
        java.util.LinkedHashSet<String> tagSeen = new java.util.LinkedHashSet<>();
        for (JsonNode mapping : normalizedMappings) {
            if ("CATALOG_ITEM".equals(mapping.path("objectType").asText()) && itemSeen.add(mapping.path("sourceRef").asText())) itemRefs.add(mapping.path("sourceRef").asText());
            if ("PRODUCTION_TAG".equals(mapping.path("objectType").asText()) && tagSeen.add(mapping.path("sourceRef").asText())) productionTagRefs.add(mapping.path("sourceRef").asText());
        }
        JsonNode closureEdges = preflightData(ownerResponse).path("closureEdges");
        if (closureEdges.isArray()) for (JsonNode edge : closureEdges) {
            if (!"PRODUCTION_TAG".equals(edge.path("referenceKind").asText())) continue;
            String tagRef = requiredOpaqueCopyRef(edge, "toRef");
            if (tagSeen.add(tagRef)) productionTagRefs.add(tagRef);
        }
        if (itemRefs.isEmpty()) throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "复制预检未提供商品 closureItemRefs");
        return new CopyReferencePlan(itemRefs, productionTagRefs, normalizedMappings);
    }

    private ArrayNode normalizedReferenceMappings(JsonNode ownerResponse, boolean required) {
        JsonNode data = preflightData(ownerResponse);
        JsonNode mappings = data.path("referenceMappings");
        if (!mappings.isArray()) mappings = data.path("mappings");
        if (!mappings.isArray() || mappings.isEmpty()) {
            if (required) throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "复制预检未提供 opaque referenceMappings");
            return mapper.createArrayNode();
        }
        ArrayNode normalizedMappings = mapper.createArrayNode();
        java.util.LinkedHashMap<String, ObjectNode> bySource = new java.util.LinkedHashMap<>();
        for (JsonNode mapping : mappings) {
            if (!mapping.isObject()) throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings must contain objects");
            String objectType = mapping.path("objectType").asText(mapping.path("referenceKind").asText(""));
            String sourceRef = requiredOpaqueCopyRef(mapping, "sourceRef");
            String targetRef = requiredOpaqueCopyRef(mapping, "targetRef");
            String key = objectType + "|" + sourceRef;
            ObjectNode existing = bySource.get(key);
            ObjectNode normalized = mapper.createObjectNode().put("objectType", objectType).put("sourceRef", sourceRef).put("targetRef", targetRef);
            copyOptionalText(normalized, mapping, "targetCode");
            copyOptionalText(normalized, mapping, "targetSkuCode");
            copyOptionalText(normalized, mapping, "targetOptionValueCode");
            if (existing != null && !existing.path("targetRef").asText().equals(targetRef)) {
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "复制映射的 sourceRef 不能对应多个 targetRef");
            }
            if (existing == null) { bySource.put(key, normalized); normalizedMappings.add(normalized); }
        }
        return normalizedMappings;
    }

    private CopyReferencePlan ownerReferencePlan(JsonNode ownerResponse) {
        if (ownerResponse == null) return CopyReferencePlan.empty(mapper);
        return new CopyReferencePlan(mapper.createArrayNode(), mapper.createArrayNode(), normalizedReferenceMappings(ownerResponse, false));
    }

    private void applyCopyReferencePlan(ObjectNode request, CopyReferencePlan plan) {
        request.remove("closureItemCodes");
        request.remove("productionTagCodes");
        request.set("closureItemRefs", plan.closureItemRefs().deepCopy());
        request.set("productionTagRefs", plan.productionTagRefs().deepCopy());
        request.set("referenceMappings", plan.referenceMappings().deepCopy());
    }

    private String requiredOpaqueCopyRef(JsonNode source, String key) {
        String value = source.path(key).asText("");
        try { return UUID.fromString(value).toString(); }
        catch (IllegalArgumentException failure) { throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference"); }
    }

    private static void copyOptionalText(ObjectNode target, JsonNode source, String key) {
        if (source.hasNonNull(key) && !source.path(key).asText().isBlank()) target.put(key, source.path(key).asText());
    }
    private String combinedDigest(String catalogDigest, String inventoryDigest, String productionDigest) { return digest(catalogDigest + "|" + inventoryDigest + "|" + productionDigest); }
    private JsonNode mergeCopyPreflight(JsonNode catalogPreflight, OwnerPreflight owners, String combined) {
        return mergeCopyPreflight(catalogPreflight, owners, combined, true);
    }
    private JsonNode mergeCopyPreflight(JsonNode catalogPreflight, OwnerPreflight owners, String combined, boolean enforceClosureLimit) {
        if (!(catalogPreflight instanceof ObjectNode envelope)) return catalogPreflight;
        ObjectNode data = preflightData(catalogPreflight) instanceof ObjectNode object ? object : null;
        if (data == null) return catalogPreflight;
        data.put("preflightDigest", combined);
        int inventoryBlocking = appendOwnerArrays(data, owners.inventoryJudgement());
        int productionBlocking = appendOwnerArrays(data, owners.productionJudgement());
        int ownerBlocking = inventoryBlocking + productionBlocking;
        int ownerConfirmations = Math.max(0, ownerResultCount(owners.inventoryJudgement()) - inventoryBlocking)
            + Math.max(0, ownerResultCount(owners.productionJudgement()) - productionBlocking);
        data.put("blockingCount", data.path("blockingCount").asInt(0) + ownerBlocking);
        data.put("confirmationRequiredCount", data.path("confirmationRequiredCount").asInt(0) + Math.max(0, ownerConfirmations));
        int closureCount = uniqueClosureCount(data.path("closureItems"));
        data.put("closureCount", closureCount);
        if (enforceClosureLimit) enforceMergedClosureLimit(data);
        return envelope;
    }

    /**
     * Catalog preflight enforces the catalog-only closure before owner facts are
     * appended.  The merged preflight is the user-visible execution plan, so
     * the same policy limit must be applied again after cross-owner de-duplication.
     * The limit is read from the catalog owner's response; no second numeric
     * declaration is introduced in the edge coordinator.
     */
    void enforceMergedClosureLimit(ObjectNode data) {
        int closureLimit = data.path("closureLimit").asInt(0);
        int closureCount = uniqueClosureCount(data.path("closureItems"));
        if (closureLimit > 0 && closureCount > closureLimit) {
            throw new CatalogOwnerApi.Problem(
                "COPY_CLOSURE_TOO_LARGE",
                422,
                "复制闭包超过上限: actual=" + closureCount + ", limit=" + closureLimit
            );
        }
    }

    private int appendOwnerArrays(ObjectNode target, JsonNode owner) {
        if (owner == null) return 0;
        JsonNode ownerData = preflightData(owner);
        appendArray(target, "closureItems", ownerData, "closureItems", false);
        appendArray(target, "mappingPreview", ownerData, "mappingPreview", false);
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

    private int ownerResultCount(JsonNode owner) {
        if (owner == null) return 0;
        JsonNode ownerData = preflightData(owner);
        return ownerData.path("compatibilityResults").isArray() ? ownerData.path("compatibilityResults").size() : 0;
    }
    private int appendArray(ObjectNode target, String targetName, JsonNode owner, String sourceName, boolean versions) {
        if (owner == null || !owner.path(sourceName).isArray()) return 0;
        int appended = 0;
        for (JsonNode node : owner.path(sourceName)) {
            ObjectNode copy = mapper.createObjectNode();
            if ("objectVersions".equals(targetName)) {
                copy.put("objectType", node.path("objectType").asText("STOCK_TARGET"));
                String code = node.hasNonNull("code") ? node.path("code").asText() : node.path("itemCode").asText();
                copy.put("code", code).put("sourceVersion", node.path("sourceVersion").asLong()).put("targetVersion", node.path("targetVersion").asLong());
            } else if ("compatibilityResults".equals(targetName)) {
                copy.put("objectType", node.path("objectType").asText("STOCK_TARGET"));
                copy.put("result", node.path("result").asText("REUSE"));
                copy.put("reason", node.path("reason").asText(""));
            } else if ("referenceRewritePreview".equals(targetName)) {
                copy.put("fromCode", node.hasNonNull("fromCode") ? node.path("fromCode").asText() : node.path("itemCode").asText());
                copy.put("toCode", node.hasNonNull("toCode") ? node.path("toCode").asText() : node.path("itemCode").asText());
                copy.put("referenceKind", node.path("referenceKind").asText("STOCK_BOM"));
            } else if ("closureItems".equals(targetName)) {
                copy.put("objectType", node.path("objectType").asText("STOCK_TARGET"));
                copy.put("code", node.path("code").asText(node.path("itemCode").asText()));
                copy.put("name", node.path("name").asText(copy.path("code").asText()));
                copy.put("action", node.path("action").asText("REUSE_OR_CREATE"));
            } else if ("mappingPreview".equals(targetName)) {
                copy.put("fromCode", node.path("fromCode").asText(node.path("itemCode").asText()));
                copy.put("toCode", node.path("toCode").asText(copy.path("fromCode").asText()));
                copy.put("referenceKind", node.path("referenceKind").asText("STOCK_TARGET"));
                copy.put("status", node.path("status").asText("REWRITE"));
            } else {
                continue;
            }
            target.withArray(targetName).add(copy);
            appended++;
        }
        return appended;
    }
    private int uniqueClosureCount(JsonNode items) {
        java.util.Set<String> keys = new java.util.LinkedHashSet<>();
        if (items != null && items.isArray()) items.forEach(item -> keys.add(item.path("objectType").asText("") + "|" + item.path("sourceRef").asText(item.path("ref").asText(item.path("code").asText("")))));
        return keys.size();
    }
    private JsonNode appendOwnerReadback(JsonNode result, JsonNode owner, String ownerName) { if (result instanceof ObjectNode envelope && envelope.path("data").isObject()) envelope.with("data").withArray("ownerReadbacks").add(owner); return result; }
    private String digest(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private record OwnerPreflight(String inventoryDigest, String productionDigest, JsonNode inventoryJudgement, JsonNode productionJudgement) { }

    record CopyReferencePlan(ArrayNode closureItemRefs, ArrayNode productionTagRefs, ArrayNode referenceMappings) {
        static CopyReferencePlan empty(ObjectMapper mapper) {
            return new CopyReferencePlan(mapper.createArrayNode(), mapper.createArrayNode(), mapper.createArrayNode());
        }

        CopyReferencePlan merge(CopyReferencePlan other) {
            if (other == null || other.referenceMappings().isEmpty()) return this;
            ArrayNode mergedItems = closureItemRefs.deepCopy();
            ArrayNode mergedTags = productionTagRefs.deepCopy();
            ArrayNode mergedMappings = referenceMappings.deepCopy();
            java.util.Set<String> itemRefs = new java.util.LinkedHashSet<>();
            mergedItems.forEach(value -> itemRefs.add(value.asText()));
            other.closureItemRefs().forEach(value -> { if (itemRefs.add(value.asText())) mergedItems.add(value.asText()); });
            java.util.Set<String> tagRefs = new java.util.LinkedHashSet<>();
            mergedTags.forEach(value -> tagRefs.add(value.asText()));
            other.productionTagRefs().forEach(value -> { if (tagRefs.add(value.asText())) mergedTags.add(value.asText()); });
            java.util.Map<String, String> targetsBySource = new java.util.LinkedHashMap<>();
            mergedMappings.forEach(value -> targetsBySource.put(value.path("objectType").asText() + "|" + value.path("sourceRef").asText(), value.path("targetRef").asText()));
            for (JsonNode mapping : other.referenceMappings()) {
                String key = mapping.path("objectType").asText() + "|" + mapping.path("sourceRef").asText();
                String target = mapping.path("targetRef").asText();
                String previous = targetsBySource.putIfAbsent(key, target);
                if (previous != null && !previous.equals(target)) {
                    throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "多个 owner 对同一 sourceRef 给出了冲突 targetRef");
                }
                if (previous == null) mergedMappings.add(mapping.deepCopy());
            }
            return new CopyReferencePlan(mergedItems, mergedTags, mergedMappings);
        }
    }

    private void enrichInventory(JsonNode detail, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
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
            if (definitionData.isObject() && definitionData.path("nodes").isArray()) {
                data.set("inventoryBom", definitionData.path("nodes"));
                if (data.path("item").isObject()) ((ObjectNode) data.path("item")).set("inventoryBom", definitionData.path("nodes").deepCopy());
            }
        }
        // Cross-owner detail enrichment remains deliberately unclassified until
        // its combined query shape has a source-bound read budget proof.
        JsonNode tagPage = production.readTags(dataNodeRef, brandRef, requestId);
        java.util.Map<String, String> tagNames = new java.util.HashMap<>();
        tagPage.path("data").path("entries").forEach(tag -> tagNames.put(tag.path("code").asText(), tag.path("name").asText()));
        data.path("productionTags").forEach(tag -> { if (tag instanceof ObjectNode row) row.put("name", tagNames.getOrDefault(tag.path("code").asText(), tag.path("name").asText())); });
    }

    /** Catalog owns code lookup; the inventory task API receives only its opaque item ref. */
    private String catalogItemRef(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        if (itemCode == null || itemCode.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCode is required for catalog lookup");
        JsonNode detail = catalog.read("getOperationsCatalogItem", dataNodeRef, brandRef, mapper.createObjectNode().put("itemCode", itemCode), requestId);
        JsonNode item = detail.path("data").path("item");
        return requiredOpaqueTaskRef(item, "itemRef", "catalog item task read");
    }

    private String requiredOpaqueTaskRef(JsonNode source, String key, String subject) {
        String value = source == null ? "" : source.path(key).asText("");
        try { return UUID.fromString(value).toString(); }
        catch (IllegalArgumentException failure) { throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, subject + " must return " + key + " as an opaque UUID ref"); }
    }

    private void enrichInventoryTargets(JsonNode result, String dataNodeRef, String brandRef, String requestId, JsonNode prefetchedCatalog) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        JsonNode catalogPage = prefetchedCatalog;
        if (catalogPage == null) {
            ArrayNode codes = mapper.createArrayNode(); envelope.path("data").path("items").forEach(item -> { if (item.hasNonNull("productCode")) codes.add(item.path("productCode").asText()); });
            if (codes.isEmpty()) return;
            ObjectNode lookup = mapper.createObjectNode(); lookup.set("itemCodes", codes); lookup.put("pageSize", Math.min(codes.size(), 100)); catalogPage = catalog.readItems(dataNodeRef, brandRef, lookup, requestId);
        }
        java.util.Map<String, JsonNode> items = new java.util.HashMap<>();
        catalogPage.path("data").path("items").forEach(item -> items.put(item.path("code").asText(), item));
        ArrayNode itemCodes = mapper.createArrayNode(); items.keySet().forEach(itemCodes::add);
        JsonNode skuNames = catalog.skuNamesByItemCodes(dataNodeRef, brandRef, itemCodes);
        envelope.path("data").path("items").forEach(item -> {
            if (!(item instanceof ObjectNode row)) return;
            JsonNode catalogItem = items.get(row.path("productCode").asText());
            if (catalogItem == null) return;
            row.put("productName", catalogItem.path("name").asText(row.path("productName").asText()));
            row.put("categoryName", catalogItem.path("categoryRefs").isArray() && catalogItem.path("categoryRefs").size() > 0 ? catalogItem.path("categoryRefs").get(0).asText() : null);
            if (catalogItem.hasNonNull("materialRole")) row.put("materialRole", catalogItem.path("materialRole").asText()); else row.putNull("materialRole");
            String skuCode = row.path("skuCode").asText("");
            if (!skuCode.isBlank()) row.put("skuName", skuNames.path(row.path("productCode").asText()).path(skuCode).asText(skuCode));
        });
    }

    private void enrichInventoryTarget(JsonNode result, String dataNodeRef, String brandRef, String requestId) {
        if (!(result instanceof ObjectNode current) || !current.path("target").isObject()) return;
        String code = current.path("target").path("productCode").asText("");
        if (code.isBlank()) return;
        JsonNode detail = catalog.readItem(dataNodeRef, brandRef, code, requestId);
        JsonNode item = detail.path("data").path("item");
        if (item.isObject()) {
            ObjectNode target = (ObjectNode) current.path("target");
            target.put("productName", item.path("name").asText(target.path("productName").asText()));
            target.put("productShape", item.path("shapeKey").asText(target.path("productShape").asText()));
            String skuCode = target.path("skuCode").asText("");
            if (!skuCode.isBlank() && item.path("skus").isArray()) {
                item.path("skus").forEach(sku -> {
                    if (skuCode.equals(sku.path("skuCode").asText())) target.put("skuName", sku.path("skuName").asText(skuCode));
                });
            }
        }
    }

    /**
     * The inventory owner owns BOM/reference rows; catalog owns the human name.
     * Resolve names once for the page as a task read, never once per reference,
     * and attach the explicit scope used for the displayed relationship.
     */
    private void enrichInventoryConsumptionReferences(JsonNode result, String dataNodeRef, String brandRef, String requestId) {
        if (!(result instanceof ObjectNode root)) return;
        // NOT_APPLICABLE_WITH_REASON: InventoryOwnerService.references is a raw inventory task-read;
        // it is not a CatalogOwner detail/page envelope consumer.
        JsonNode dataNode = root.path("data").isObject() ? root.path("data") : root;
        if (!(dataNode instanceof ObjectNode data) || !data.path("entries").isArray()) return;
        ArrayNode itemCodes = mapper.createArrayNode();
        java.util.LinkedHashSet<String> uniqueCodes = new java.util.LinkedHashSet<>();
        data.path("entries").forEach(entry -> {
            String sourceCode = entry.path("sourceCode").asText("");
            if (!sourceCode.isBlank() && uniqueCodes.add(sourceCode)) itemCodes.add(sourceCode);
        });
        java.util.Map<String, String> names = new java.util.HashMap<>();
        java.util.Map<String, String> statuses = new java.util.HashMap<>();
        if (!itemCodes.isEmpty()) {
            ObjectNode lookup = mapper.createObjectNode();
            lookup.set("itemCodes", itemCodes);
            lookup.put("itemCodesOnly", true);
            JsonNode catalogPage = catalog.readItems(dataNodeRef, brandRef, lookup, requestId);
            JsonNode catalogData = catalogPage.path("data");
            catalogData.path("items").forEach(item -> {
                String code = item.path("code").asText("");
                if (!code.isBlank()) {
                    names.put(code, item.path("name").asText(code));
                    statuses.put(code, item.path("status").asText("ACTIVE"));
                }
            });
        }
        data.path("entries").forEach(entry -> {
            if (!(entry instanceof ObjectNode row)) return;
            String sourceCode = row.path("sourceCode").asText("");
            row.put("sourceName", names.getOrDefault(sourceCode, sourceCode));
            row.put("status", statuses.getOrDefault(sourceCode, row.path("status").asText("ACTIVE")));
            row.putObject("ownerScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", dataNodeRef)
                .put("brandRef", brandRef);
        });
    }

    private void enrichCatalogItems(JsonNode result, String dataNodeRef, String brandRef, String requestId, String dataNodeType) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        ArrayNode codes = mapper.createArrayNode(); envelope.path("data").path("items").forEach(item -> { if (item.hasNonNull("code")) codes.add(item.path("code").asText()); });
        if (codes.isEmpty()) return;
        if (!Set.of("STORE", "HEAD_COMPANY").contains(dataNodeType)) return;
        ObjectNode lookup = mapper.createObjectNode().set("itemCodes", codes);
        JsonNode inventoryPage = inventory.readCatalogInventorySummary(dataNodeRef, brandRef, lookup, requestId, dataNodeType);
        JsonNode inventoryItems = inventoryPage.path("data").path("items");
        java.util.Map<String, Integer> targetCounts = new java.util.HashMap<>();
        java.util.Map<String, Integer> bomCounts = new java.util.HashMap<>();
        if (inventoryItems.isArray()) {
            inventoryItems.forEach(item -> {
                String code = item.path("productCode").asText();
                targetCounts.put(code, item.path("targetCount").asInt(0));
                bomCounts.put(code, item.path("bomCount").asInt(0));
            });
        }
        JsonNode items = envelope.path("data").path("items");
        if (items.isArray()) {
            items.forEach(item -> {
                if (item instanceof ObjectNode row) {
                    String code = row.path("code").asText();
                    row.put("stockTargetCount", targetCounts.getOrDefault(code, 0));
                    row.put("bomCount", bomCounts.getOrDefault(code, 0));
                }
            });
        }
    }

    private void coordinateSaveInventory(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, String dataNodeType,
                                         UUID workspaceUuid, String groupWorkspaceKey, OperationsOwnerScopeGrant ownerScopeGrant) {
        JsonNode sections = request.path("sections");
        JsonNode configuration = sections.path("inventoryConfiguration");
        JsonNode expectedVersions = sections.path("expectedInventoryVersions");
        JsonNode draft = sections.path("catalogDraft");
        if (!configuration.path("nodes").isArray() && !draft.path("inventoryBom").isArray()) return;
        CatalogInventoryProjection projection = catalogInventoryProjection(dataNodeRef, brandRef, request.path("itemCode").asText(), requestId);
        java.util.Map<String, Long> versions = new java.util.HashMap<>();
        if (expectedVersions.isArray()) expectedVersions.forEach(expected -> versions.put(expected.path("targetRef").asText(), expected.path("version").asLong()));
        if (configuration.path("nodes").isArray()) for (JsonNode sourceNode : configuration.path("nodes")) {
            if (!sourceNode.isObject()) continue;
            ObjectNode node = (ObjectNode) sourceNode;
            String mode = node.path("mode").asText("NONE");
            if ("NONE".equals(mode)) continue;
            if ("BOM".equals(mode)) continue;
            String targetRef = node.path("targetRef").asText("");
            String itemCode = node.path("itemCode").asText(request.path("itemCode").asText(""));
            String skuCode = node.hasNonNull("skuCode") ? node.path("skuCode").asText() : null;
            String itemRef = opaqueProjectionRef(node, "itemRef", projection.itemRef(), "inventoryConfiguration.itemRef");
            String productSkuRef = skuCode == null ? null : opaqueProjectionRef(node, "productSkuRef", projection.productSkuRef(skuCode), "inventoryConfiguration.productSkuRef");
            ObjectNode ensure = mapper.createObjectNode().put("itemRef", itemRef).put("itemCode", itemCode).put("mode", mode);
            if (productSkuRef == null) ensure.putNull("productSkuRef"); else ensure.put("productSkuRef", productSkuRef);
            if (skuCode == null) ensure.putNull("skuCode"); else ensure.put("skuCode", skuCode);
            if (!targetRef.isBlank()) ensure.put("targetRef", targetRef);
            String unit = node.path("consumptionUnit").asText(node.path("unit").asText(node.path("configuration").path("countingUnit").asText("")));
            if (!unit.isBlank()) ensure.put("consumptionUnit", unit);
            if (node.path("configuration").isObject()) ensure.set("configuration", node.path("configuration"));
            if (!targetRef.isBlank() && node.path("configuration").isObject() && node.path("configuration").size() > 0) {
                Long expected = versions.get(targetRef);
                if (expected == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory target version is required");
                ensure.put("expectedVersion", expected);
            }
            JsonNode ensured = inventory.ensureCatalogInventoryTarget(dataNodeRef, brandRef, ensure, requestId,
                idempotencyKey + ":ensure:" + itemRef + ":" + (productSkuRef == null ? "ITEM" : productSkuRef),
                workspaceUuid, groupWorkspaceKey, dataNodeType, ownerScopeGrant);
            targetRef = requiredInventoryTargetRef(ensured);
            node.put("targetRef", targetRef);
        }
        if (draft.path("inventoryBom").isArray()) {
            java.util.Map<String, ArrayNode> grouped = new java.util.LinkedHashMap<>();
            java.util.Map<String, ObjectNode> groupCommands = new java.util.LinkedHashMap<>();
            java.util.Map<String, Long> bomVersions = new java.util.HashMap<>();
            draft.path("inventoryBom").forEach(entry -> {
                if (!"BOM".equals(entry.path("mode").asText("NONE"))) return;
                String skuCode = entry.hasNonNull("skuCode") ? entry.path("skuCode").asText() : "";
                String optionValueCode = entry.hasNonNull("optionValueCode") ? entry.path("optionValueCode").asText() : "";
                if (!skuCode.isBlank() && !optionValueCode.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM owner 不能同时指定 SKU 与选项值");
                String itemRef = opaqueProjectionRef(entry, "itemRef", projection.itemRef(), "inventoryBom.itemRef");
                String productSkuRef = skuCode.isBlank() ? null : opaqueProjectionRef(entry, "productSkuRef", projection.productSkuRef(skuCode), "inventoryBom.productSkuRef");
                String optionValueRef = optionValueCode.isBlank() ? null : opaqueProjectionRef(entry, "optionValueRef", projection.optionValueRef(optionValueCode), "inventoryBom.optionValueRef");
                String key = itemRef + "|" + (productSkuRef == null ? "" : productSkuRef) + "|" + (optionValueRef == null ? "" : optionValueRef);
                grouped.computeIfAbsent(key, ignored -> mapper.createArrayNode()).add(entry);
                groupCommands.computeIfAbsent(key, ignored -> {
                    ObjectNode command = mapper.createObjectNode().put("itemRef", itemRef).put("itemCode", entry.path("itemCode").asText(request.path("itemCode").asText("")));
                    if (productSkuRef == null) command.putNull("productSkuRef"); else command.put("productSkuRef", productSkuRef);
                    if (optionValueRef == null) command.putNull("optionValueRef"); else command.put("optionValueRef", optionValueRef);
                    if (skuCode.isBlank()) command.putNull("skuCode"); else command.put("skuCode", skuCode);
                    if (optionValueCode.isBlank()) command.putNull("optionValueCode"); else command.put("optionValueCode", optionValueCode);
                    return command;
                });
                if (entry.has("version")) bomVersions.putIfAbsent(key, entry.path("version").asLong());
            });
            grouped.forEach((key, entries) -> {
                ObjectNode command = groupCommands.get(key).deepCopy();
                command.set("rows", entries);
                command.put("expectedVersion", bomVersions.getOrDefault(key, 0L));
                inventory.saveCatalogProductBom(dataNodeRef, brandRef, command, requestId, idempotencyKey + ":bom:" + key,
                    workspaceUuid, groupWorkspaceKey, dataNodeType, ownerScopeGrant);
            });
        }
    }

    /**
     * Catalog code is used once for the owner task read; all downstream inventory
     * commands and their idempotency grouping use only the owner-returned refs.
     */
    private CatalogInventoryProjection catalogInventoryProjection(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        JsonNode detail = catalog.read("getOperationsCatalogItem", dataNodeRef, brandRef, mapper.createObjectNode().put("itemCode", itemCode), requestId);
        JsonNode item = detail.path("data").path("item");
        String itemRef = requiredOpaqueTaskRef(item, "itemRef", "catalog item task read");
        java.util.Map<String, String> skuRefs = new java.util.LinkedHashMap<>();
        if (item.path("skus").isArray()) item.path("skus").forEach(sku -> {
            String code = sku.path("skuCode").asText("");
            if (!code.isBlank()) skuRefs.put(code, requiredOpaqueTaskRef(sku, "productSkuRef", "catalog SKU task read"));
        });
        java.util.Map<String, String> optionValueRefs = new java.util.LinkedHashMap<>();
        if (item.path("skuVariantDimensions").isArray()) item.path("skuVariantDimensions").forEach(dimension -> {
            if (dimension.path("values").isArray()) dimension.path("values").forEach(value -> {
                String code = value.path("valueCode").asText("");
                if (!code.isBlank()) optionValueRefs.put(code, requiredOpaqueTaskRef(value, "valueRef", "catalog option-value task read"));
            });
        });
        if (item.path("orderOptions").isArray()) item.path("orderOptions").forEach(group -> {
            if (group.path("values").isArray()) group.path("values").forEach(value -> {
                String code = value.path("code").asText("");
                if (!code.isBlank() && value.hasNonNull("attributeValueRef")) optionValueRefs.putIfAbsent(code, requiredOpaqueTaskRef(value, "attributeValueRef", "catalog option-value task read"));
            });
        });
        return new CatalogInventoryProjection(itemRef, Map.copyOf(skuRefs), Map.copyOf(optionValueRefs));
    }

    private String opaqueProjectionRef(JsonNode source, String key, String derived, String subject) {
        if (source != null && source.hasNonNull(key) && !source.path(key).asText().isBlank()) return requiredOpaqueTaskRef(source, key, subject);
        if (derived == null || derived.isBlank()) throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, subject + " is required as an opaque UUID ref");
        return requiredOpaqueTaskRef(mapper.createObjectNode().put(key, derived), key, subject);
    }

    private record CatalogInventoryProjection(String itemRef, Map<String, String> productSkuRefs, Map<String, String> optionValueRefs) {
        String productSkuRef(String skuCode) { return productSkuRefs.get(skuCode); }
        String optionValueRef(String optionValueCode) { return optionValueRefs.get(optionValueCode); }
    }

    private static void requireCatalogSaveInventoryDefinitionCommands(List<String> commands) {
        Set<String> declared = commands == null ? Set.of() : Set.copyOf(commands);
        if (!CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS.equals(declared)) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "商品保存没有获准的库存定义命令集");
        }
    }

    private Set<String> catalogItemAssetRefs(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        if (itemCode == null || itemCode.isBlank()) return Set.of();
        ObjectNode query = mapper.createObjectNode().put("itemCode", itemCode);
        JsonNode detail = catalog.read("getOperationsCatalogItem", dataNodeRef, brandRef, query, requestId);
        JsonNode detailRoot = detail.path("data");
        return catalogAssetRefs(detailRoot.path("item"));
    }

    /**
     * A catalog save is the business reference decision for an image.  Activate every
     * submitted staged ref after the catalog write, then release removed refs only when
     * the catalog owner confirms no other non-voided item still points at them.
     */
    private void settleCatalogAssets(String dataNodeRef, String brandRef, ObjectNode request, Set<String> previousAssetRefs, String requestId, String idempotencyKey,
                                     UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType,
                                     Map<String, String> catalogAssetBindGrants, OperationsOwnerScopeGrant ownerScopeGrant) {
        Set<String> nextAssetRefs = catalogAssetRefs(request.path("sections").path("catalogDraft"));
        for (String ref : nextAssetRefs) {
            try {
                assets.claimCatalogStaged(UUID.fromString(ref), workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType,
                    catalogAssetBindGrants.get(ref), ownerScopeGrant);
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef");
            } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
                throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权");
            } catch (PlatformAssetService.AssetClaimRejectedException failure) {
                throw new CatalogOwnerApi.Problem("ASSET_NOT_READY", 409, "图片资产尚未准备好或已失效");
            }
        }
        Set<String> candidates = new java.util.LinkedHashSet<>(previousAssetRefs); candidates.removeAll(nextAssetRefs);
        Set<String> stillReferenced = catalog.assetRefsStillReferenced(candidates);
        for (String ref : candidates) {
            if (stillReferenced.contains(ref)) continue;
            try {
                assets.releaseUnreferencedCatalogAsset(UUID.fromString(ref), idempotencyKey + ":asset-release:" + ref,
                    workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType, ownerScopeGrant);
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef");
            } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
                throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权");
            } catch (PlatformAssetService.AssetClaimRejectedException failure) {
                throw new CatalogOwnerApi.Problem("ASSET_REFERENCE_PROTECTED", 409, "图片资产释放失败，资产版本已变化或仍被引用");
            }
        }
    }

    private Set<String> assetRefs(JsonNode values) {
        if (!values.isArray()) return Set.of();
        Set<String> refs = new java.util.LinkedHashSet<>();
        values.forEach(value -> {
            String ref = value.isTextual() ? value.asText() : value.path("assetRef").asText("");
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

    @Transactional
    public JsonNode stageAsset(UUID workspaceUuid, String groupWorkspaceKey, String fileName, String mediaType, String contentDigest, byte[] bytes, String requestId, String idempotencyKey, String testFailurePoint, OperationsOwnerScopeGrant ownerScopeGrant) {
        requireOwnerScopeGrant("stageOperationsCatalogAsset", ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ownerScopeGrant == null ? null : ownerScopeGrant.targetType(), ownerScopeGrant == null || ownerScopeGrant.targetId() == null ? null : ownerScopeGrant.targetId().toString());
        if (fileName == null || fileName.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "fileName is required");
        if (mediaType == null || mediaType.isBlank() || bytes == null || bytes.length == 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "multipart content is required");
        if (!stagedDigestMatches(contentDigest, bytes)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "contentDigest does not match content");
        // The fixture catalog includes an asset-processing failure case, but
        // the real asset processor is intentionally not faulted by ordinary
        // malformed input (those are validation failures).  Keep the fault
        // seam explicit, disabled by default, and only available to the
        // managed API runner so this case exercises the declared typed
        // problem without making production behavior client-controlled.
        failForManagedTestPoint(testFailurePoint, "asset-processing", "ASSET_PROCESSING_FAILED", 422, "资产处理失败");
        StageReadback staged;
        try {
            staged = assets.stageCatalogContent(workspaceUuid, groupWorkspaceKey, ownerScopeGrant.targetId().toString(), ownerScopeGrant.targetType(),
                mediaType, bytes.length, new ByteArrayInputStream(bytes), idempotencyKey, ownerScopeGrant);
        } catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权");
        }
        AssetReadback asset = assets.require(staged.assetRef());
        ObjectNode result = mapper.createObjectNode().put("assetRef", staged.assetRef().toString()).put("bindGrant", staged.bindGrant()).put("status", asset.status()).put("mediaType", staged.contentType()).put("contentDigest", staged.sha256()).putNull("readyAt").put("version", asset.version());
        ObjectNode readback = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId); readback.set("result", result); readback.put("version", asset.version()); return readback;
    }

    private JsonNode releaseAsset(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                                  UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant) {
        UUID ref; try { ref = UUID.fromString(required(request, "assetRef", "")); } catch (IllegalArgumentException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "assetRef is invalid"); }
        assets.lockCatalogReferences(Set.of(ref));
        if (catalog.assetReferencedAnywhere(ref.toString())) throw new CatalogOwnerApi.Problem("ASSET_REFERENCE_PROTECTED", 409, "图片资产仍被商品引用，不能释放");
        long expected = request.path("expectedVersion").asLong(1); AssetReadback readback;
        try {
            readback = assets.releaseCatalogStaged(ref, expected, idempotencyKey, workspaceUuid, groupWorkspaceKey,
                dataNodeRef, dataNodeType, ownerScopeGrant);
        }
        catch (PlatformAssetService.AssetOwnerScopeForbiddenException failure) { throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "图片资产命令缺少匹配的数据节点写授权"); }
        catch (PlatformAssetService.AssetIdempotencyConflictException failure) { throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他资产释放请求"); }
        catch (PlatformAssetService.AssetClaimRejectedException failure) { throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "待释放资产不存在或版本已变化"); }
        ObjectNode result = mapper.createObjectNode().put("assetRef", readback.assetRef().toString()).put("disposition", "RELEASED").put("releasedAt", time.currentEpochMillis()).put("version", readback.version());
        ObjectNode response = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId); response.set("result", result); response.put("version", readback.version()); return response;
    }

    private boolean stagedDigestMatches(String expected, byte[] bytes) {
        if (expected == null || expected.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "contentDigest is required");
        try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)).equals(expected); }
        catch (Exception ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "contentDigest is invalid"); }
    }

    private static void requireOwnerScopeGrant(String operationId, OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, String dataNodeRef) {
        boolean mutation = CATALOG_WRITES.contains(operationId) || INVENTORY_WRITES.contains(operationId) || PRODUCTION_WRITES.contains(operationId)
            || operationId.startsWith("preflightOperations") || operationId.startsWith("executeOperations")
            || "releaseOperationsCatalogStagedAsset".equals(operationId) || "stageOperationsCatalogAsset".equals(operationId);
        if (!mutation) return;
        try {
            if (grant != null && grant.matches(workspaceUuid, groupWorkspaceKey, dataNodeType, UUID.fromString(dataNodeRef))) return;
        } catch (RuntimeException ignored) {
            // Fall through to a typed denial without leaking the malformed selector.
        }
        throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "当前命令缺少匹配的数据节点写授权");
    }

    private static String required(ObjectNode request, String key, String fallback) { JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) { if (fallback != null && !fallback.isBlank()) return fallback; throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required"); } return value.asText(); }
    private static void failForManagedTestPoint(String actual, String expected, String code, int status, String message) {
        if (expected.equals(actual) && "true".equalsIgnoreCase(System.getenv("V2S_CATALOG_TEST_FAULTS"))) {
            throw new CatalogOwnerApi.Problem(code, status, message);
        }
    }
    private static int parsePageCursor(String value) {
        if (value == null || value.isBlank()) return 0;
        try { int parsed = Integer.parseInt(value); if (parsed < 0) throw new NumberFormatException(); return parsed; }
        catch (NumberFormatException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor must be a non-negative opaque cursor"); }
    }
    private static int parsePageSize(String value, int fallback) {
        if (value == null || value.isBlank()) return fallback;
        try { int parsed = Integer.parseInt(value); if (parsed < 1 || parsed > 100) throw new NumberFormatException(); return parsed; }
        catch (NumberFormatException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "pageSize must be between 1 and 100"); }
    }
    private static boolean hasQuery(ObjectNode request, String key) { JsonNode value = request == null ? null : request.get(key); return value != null && !value.isNull() && !value.asText().isBlank(); }
}
