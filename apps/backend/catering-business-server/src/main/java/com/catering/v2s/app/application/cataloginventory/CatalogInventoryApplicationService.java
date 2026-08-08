package com.catering.v2s.app.application.cataloginventory;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogOwnerService;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.inventory.application.InventoryOwnerService;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.asset.application.PlatformAssetService.AssetReadback;
import com.catering.v2s.platform.asset.application.PlatformAssetService.StageReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application coordinator: reads may task-join facts, writes call owner commands in one REQUIRED transaction. */
@Service
public class CatalogInventoryApplicationService {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final Set<String> CATALOG_READS = Set.of(
        "getOperationsCatalogWorkbenchContext", "getOperationsCatalogNavigation", "getOperationsCatalogItems", "getOperationsCatalogItem",
        "getOperationsCatalogDictionary", "getOperationsLocalCatalogCopyCandidates", "getOperationsBrandCatalogCopyCandidates", "getOperationsCatalogShapeManifest"
    );
    private static final Set<String> CATALOG_WRITES = Set.of(
        "createOperationsCatalogItem", "saveOperationsCatalogItem", "transitionOperationsCatalogItemStatus", "createOperationsCatalogCategory", "updateOperationsCatalogCategory",
        "moveOperationsCatalogCategory", "transitionOperationsCatalogCategoryStatus", "createOperationsCatalogDictionaryEntry", "updateOperationsCatalogDictionaryEntry",
        "reorderOperationsCatalogDictionaryEntry", "transitionOperationsCatalogDictionaryEntryStatus", "preflightOperationsTemporaryCatalogItemPromotion", "executeOperationsTemporaryCatalogItemPromotion"
    );
    private static final Set<String> INVENTORY_READS = Set.of("getOperationsInventoryTargets", "getOperationsInventoryTarget", "getOperationsInventoryTargetChangeSummary", "getOperationsInventoryTargetBusinessHistory", "getOperationsInventoryTargetConsumptionReferences", "getOperationsInventoryTargetLedger", "getOperationsInventoryTargetDiagnostics");
    private static final Set<String> INVENTORY_WRITES = Set.of("countOperationsInventoryTarget", "increaseOperationsInventoryTarget", "adjustOperationsInventoryTarget", "updateOperationsInventoryTargetConfiguration");
    private static final Set<String> PRODUCTION_WRITES = Set.of("createOperationsProductionTag", "updateOperationsProductionTag", "transitionOperationsProductionTagStatus");

    private final CatalogOwnerApi catalog;
    private final InventoryOwnerApi inventory;
    private final ProductionTagOwnerApi production;
    private final PlatformAssetService assets;
    private final ObjectMapper mapper;
    private final TimeProvider time;
    private final CatalogScopeLookup catalogScopes;

    public CatalogInventoryApplicationService(CatalogOwnerApi catalog, InventoryOwnerApi inventory, ProductionTagOwnerApi production, PlatformAssetService assets, ObjectMapper mapper, TimeProvider time, CatalogScopeLookup catalogScopes) {
        this.catalog = catalog; this.inventory = inventory; this.production = production; this.assets = assets; this.mapper = mapper; this.time = time; this.catalogScopes = catalogScopes;
    }

    @Transactional
    public JsonNode dispatch(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, boolean diagnosticsGranted, UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, String headCompanyRef) {
        return dispatch(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey, diagnosticsGranted, workspaceUuid, groupWorkspaceKey, dataNodeType, headCompanyRef, null);
    }

    @Transactional
    public JsonNode dispatch(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, boolean diagnosticsGranted, UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, String headCompanyRef, String testFailurePoint) {
        if (operationId == null || operationId.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "operationId is required");
        if ("getOperationsInventoryTargetDiagnostics".equals(operationId) && !diagnosticsGranted) throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "高级诊断权限未授予");
        if ("getOperationsCatalogItems".equals(operationId)) CatalogOwnerService.validateItemPageQuery(request);
        if ("getOperationsInventoryTargets".equals(operationId)) InventoryOwnerService.validateTargetPageQuery(request);
        if ("HEAD_COMPANY".equals(dataNodeType) && (INVENTORY_READS.contains(operationId) || INVENTORY_WRITES.contains(operationId))) {
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "总公司商品库不提供余额、流水或门店库存动作");
        }
        if (CATALOG_READS.contains(operationId)) {
            JsonNode result = catalog.read(operationId, dataNodeRef, brandRef, request, requestId);
            if ("getOperationsCatalogWorkbenchContext".equals(operationId)) enrichWorkbenchContext(result, dataNodeRef, brandRef, dataNodeType, headCompanyRef, workspaceUuid, groupWorkspaceKey);
            if ("getOperationsCatalogItem".equals(operationId)) enrichInventory(result, dataNodeRef, brandRef, request, requestId);
            if ("getOperationsCatalogItems".equals(operationId)) enrichCatalogItems(result, dataNodeRef, brandRef, requestId, dataNodeType);
            return result;
        }
        if (CATALOG_WRITES.contains(operationId)) {
            if ("transitionOperationsCatalogItemStatus".equals(operationId)
                && "VOIDED".equals(request.path("targetStatus").asText())) {
                JsonNode inventoryDependencies = inventory.catalogItemVoidDependencies(
                    dataNodeRef, brandRef, request.path("itemCode").asText(), requestId);
                if (inventoryDependencies.path("hasDependentFacts").asBoolean(false)) {
                    throw new CatalogOwnerApi.Problem("DEPENDENT_FACTS_BLOCK_VOID", 422, "库存对象或 BOM 仍存在，不能作废商品");
                }
            }
            Set<String> previousImages = "saveOperationsCatalogItem".equals(operationId)
                ? catalogItemImageRefs(dataNodeRef, brandRef, request.path("itemCode").asText(), requestId)
                : Set.of();
            JsonNode result = catalog.write(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey);
            if ("saveOperationsCatalogItem".equals(operationId)) {
                coordinateSaveInventory(dataNodeRef, brandRef, request, requestId, idempotencyKey, dataNodeType);
                settleCatalogAssets(dataNodeRef, brandRef, request, previousImages, requestId, idempotencyKey);
            }
            return result;
        }
        if ("preflightOperationsLocalCatalogCopy".equals(operationId) || "executeOperationsLocalCatalogCopy".equals(operationId)) {
            return dispatchLocalCopy(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey);
        }
        if ("preflightOperationsBrandCatalogCopy".equals(operationId) || "executeOperationsBrandCatalogCopy".equals(operationId)) {
            String source = resolveBrandCopySource(request, workspaceUuid, groupWorkspaceKey, dataNodeType, dataNodeRef, brandRef);
            if (source.equals(dataNodeRef)) throw new CatalogOwnerApi.Problem("COPY_SOURCE_TARGET_SAME", 422, "copy source and target must differ");
            return dispatchBrandCopy(operationId, source, dataNodeRef, brandRef, request, requestId, idempotencyKey, testFailurePoint);
        }
        if (INVENTORY_READS.contains(operationId)) {
            ObjectNode inventoryRequest = request;
            JsonNode prefetchedCatalog = null;
            if ("getOperationsInventoryTargets".equals(operationId) && (hasQuery(request, "keyword") || hasQuery(request, "categoryRef"))) {
                ObjectNode catalogQuery = request.deepCopy(); catalogQuery.put("itemCodesOnly", true); catalogQuery.remove("stockView"); catalogQuery.remove("cursor"); catalogQuery.remove("pageSize");
                prefetchedCatalog = catalog.read("getOperationsCatalogItems", dataNodeRef, brandRef, catalogQuery, requestId);
                inventoryRequest = request.deepCopy(); ArrayNode allowedCodes = inventoryRequest.putArray("catalogItemCodes"); prefetchedCatalog.path("data").path("items").forEach(item -> { if (item.hasNonNull("code")) allowedCodes.add(item.path("code").asText()); }); inventoryRequest.remove("categoryRef");
            }
            JsonNode result = inventory.read(operationId, dataNodeRef, brandRef, inventoryRequest, requestId, dataNodeType);
            if ("getOperationsInventoryTargets".equals(operationId)) enrichInventoryTargets(result, dataNodeRef, brandRef, requestId, prefetchedCatalog);
            if ("getOperationsInventoryTarget".equals(operationId)) enrichInventoryTarget(result, dataNodeRef, brandRef, requestId);
            if ("getOperationsInventoryTargetConsumptionReferences".equals(operationId)) {
                enrichInventoryConsumptionReferences(result, dataNodeRef, brandRef, requestId);
            }
            return result;
        }
        if (INVENTORY_WRITES.contains(operationId)) return inventory.write(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey, dataNodeType);
        if ("getOperationsProductionTags".equals(operationId)) return production.read(operationId, dataNodeRef, brandRef, request, requestId);
        if ("transitionOperationsProductionTagStatus".equals(operationId) && "VOIDED".equals(request.path("targetStatus").asText()) && catalog.productionTagReferenced(dataNodeRef, brandRef, request.path("tagCode").asText())) throw new ProductionTagOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, "生产标签仍被商品引用，不能作废");
        if (PRODUCTION_WRITES.contains(operationId)) return production.write(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey);
        if ("stageOperationsCatalogAsset".equals(operationId)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "stageOperationsCatalogAsset requires multipart/form-data");
        if ("releaseOperationsCatalogStagedAsset".equals(operationId)) return releaseAsset(dataNodeRef, brandRef, request, requestId, idempotencyKey);
        throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "operationId is not in the P2 operation registry");
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

    private JsonNode dispatchLocalCopy(String operationId, String scope, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        boolean execute = "executeOperationsLocalCatalogCopy".equals(operationId);
        ObjectNode catalogRequest = request.deepCopy();
        JsonNode catalogPreflight = catalog.copy("preflightOperationsLocalCatalogCopy", scope, scope, brandRef, catalogRequest, requestId, null);
        OwnerPreflight owners = preflightInventoryIfSelected(scope, scope, brandRef, request, catalogRequest, catalogPreflight);
        String catalogDigest = preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), "");
        JsonNode merged = mergeCopyPreflight(catalogPreflight, owners, combined, execute ? false : true);
        if (!execute) return merged;
        if (!request.path("preflightDigest").asText("").equals(combined)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (preflightData(catalogPreflight) instanceof ObjectNode mergedData) enforceMergedClosureLimit(mergedData);
        catalogRequest.put("preflightDigest", catalogDigest);
        JsonNode result = catalog.copy(operationId, scope, scope, brandRef, catalogRequest, requestId, idempotencyKey);
        if (owners.inventoryDigest() != null && !owners.inventoryDigest().isBlank()) {
            ObjectNode inventoryRequest = request.deepCopy(); inventoryRequest.put("inventoryPreflightDigest", owners.inventoryDigest()); inventoryRequest.set("closureItemCodes", combinedClosureCodes(arrayOf(request.path("sourceItemCode").asText()), owners.inventoryJudgement()));
            result = appendOwnerReadback(result, inventory.copy(scope, scope, brandRef, inventoryRequest, requestId, idempotencyKey), "inventory");
        }
        return result;
    }

    private JsonNode dispatchBrandCopy(String operationId, String source, String target, String brandRef, ObjectNode request, String requestId, String idempotencyKey, String testFailurePoint) {
        boolean execute = "executeOperationsBrandCatalogCopy".equals(operationId);
        ObjectNode catalogRequest = request.deepCopy();
        JsonNode catalogPreflight = catalog.copy("preflightOperationsBrandCatalogCopy", source, target, brandRef, catalogRequest, requestId, null);
        OwnerPreflight owners = preflightBrandOwners(source, target, brandRef, request, catalogPreflight);
        String catalogDigest = preflightData(catalogPreflight).path("preflightDigest").asText();
        String combined = combinedDigest(catalogDigest, owners.inventoryDigest(), owners.productionDigest());
        JsonNode merged = mergeCopyPreflight(catalogPreflight, owners, combined, execute ? false : true);
        if (!execute) return merged;
        if (!request.path("preflightDigest").asText("").equals(combined)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (preflightData(catalogPreflight) instanceof ObjectNode mergedData) enforceMergedClosureLimit(mergedData);
            catalogRequest.put("preflightDigest", catalogDigest);
            ArrayNode closureCodes = combinedClosureCodes(codesFrom(catalogPreflight), owners.inventoryJudgement());
            catalogRequest.set("closureItemCodes", closureCodes);
            JsonNode result = catalog.copy(operationId, source, target, brandRef, catalogRequest, requestId, idempotencyKey);
            if ("owner-failure".equals(testFailurePoint) && "true".equalsIgnoreCase(System.getenv("V2S_CATALOG_TEST_FAULTS"))) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "受控 owner failure fixture");
            }
            ObjectNode ownerRequest = request.deepCopy(); ownerRequest.set("closureItemCodes", closureCodes.deepCopy()); ownerRequest.put("inventoryPreflightDigest", owners.inventoryDigest());
        result = appendOwnerReadback(result, inventory.copy(source, target, brandRef, ownerRequest, requestId, idempotencyKey), "inventory");
        ObjectNode productionRequest = request.deepCopy(); productionRequest.set("productionTagCodes", catalog.referencedProductionTagCodes(source, brandRef, ownerRequest)); productionRequest.put("productionPreflightDigest", owners.productionDigest());
        return appendOwnerReadback(result, production.copy(source, target, brandRef, productionRequest, requestId, idempotencyKey), "fulfillment-production");
    }

    private OwnerPreflight preflightBrandOwners(String source, String target, String brandRef, ObjectNode request, JsonNode catalogPreflight) {
        ObjectNode ownerRequest = request.deepCopy(); ownerRequest.set("closureItemCodes", combinedClosureCodes(codesFrom(catalogPreflight), null));
        ownerRequest.set("productionTagCodes", catalog.referencedProductionTagCodes(source, brandRef, ownerRequest));
        JsonNode inventoryJudgement = inventory.preflightCopy(source, target, brandRef, ownerRequest);
        JsonNode productionJudgement = production.preflightCopy(source, target, brandRef, ownerRequest);
        return new OwnerPreflight(inventoryJudgement.path("digest").asText(), productionJudgement.path("digest").asText(), inventoryJudgement, productionJudgement);
    }

    private OwnerPreflight preflightInventoryIfSelected(String source, String target, String brandRef, ObjectNode request, ObjectNode ownerRequest, JsonNode catalogPreflight) {
        if (!containsInventorySection(request.path("selectedSections"))) return new OwnerPreflight("", "", null, null);
        ownerRequest.putArray("closureItemCodes").add(request.path("sourceItemCode").asText());
        ownerRequest.put("targetItemCode", request.path("targetItemCode").asText());
        JsonNode judgement = inventory.preflightCopy(source, target, brandRef, ownerRequest);
        return new OwnerPreflight(judgement.path("digest").asText(), "", judgement, null);
    }

    private boolean containsInventorySection(JsonNode sections) { if (!sections.isArray()) return false; for (JsonNode section : sections) if (List.of("ITEM_BOM", "SKU_BOM", "OPTION_VALUE_BOM").contains(section.asText())) return true; return false; }
    private JsonNode preflightData(JsonNode preflight) { return preflight != null && preflight.path("data").isObject() ? preflight.path("data") : preflight; }
    private ArrayNode codesFrom(JsonNode preflight) { ArrayNode codes = mapper.createArrayNode(); java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>(); preflightData(preflight).path("closureItems").forEach(item -> { if ("CATALOG_ITEM".equals(item.path("objectType").asText()) && item.hasNonNull("code") && seen.add(item.path("code").asText())) codes.add(item.path("code").asText()); }); return codes; }
    ArrayNode combinedClosureCodes(ArrayNode catalogCodes, JsonNode inventoryJudgement) {
        ArrayNode codes = mapper.createArrayNode();
        java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>();
        if (catalogCodes != null) catalogCodes.forEach(code -> { if (code.isTextual() && !code.asText().isBlank() && seen.add(code.asText())) codes.add(code.asText()); });
        if (inventoryJudgement != null) preflightData(inventoryJudgement).path("closureItems").forEach(item -> {
            String itemCode = item.path("itemCode").asText("");
            if (!itemCode.isBlank() && seen.add(itemCode)) codes.add(itemCode);
        });
        return codes;
    }
    private ArrayNode arrayOf(String value) { return mapper.createArrayNode().add(value); }
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
        appendArray(target, "closureItems", owner, "closureItems", false);
        appendArray(target, "mappingPreview", owner, "mappingPreview", false);
        appendArray(target, "objectVersions", owner, "versions", true);
        int blocking = 0;
        if (owner.path("compatibilityResults").isArray()) {
            for (JsonNode result : owner.path("compatibilityResults")) {
                if ("BLOCKED".equals(result.path("result").asText())) blocking++;
            }
        }
        appendArray(target, "compatibilityResults", owner, "compatibilityResults", false);
        appendArray(target, "referenceRewritePreview", owner, "referenceRewritePreview", false);
        return blocking;
    }

    private int ownerResultCount(JsonNode owner) {
        return owner != null && owner.path("compatibilityResults").isArray() ? owner.path("compatibilityResults").size() : 0;
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
        if (items != null && items.isArray()) items.forEach(item -> keys.add(item.path("objectType").asText("") + "|" + item.path("code").asText("")));
        return keys.size();
    }
    private JsonNode appendOwnerReadback(JsonNode result, JsonNode owner, String ownerName) { if (result instanceof ObjectNode envelope && envelope.path("data").isObject()) envelope.with("data").withArray("ownerReadbacks").add(owner); return result; }
    private String digest(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private record OwnerPreflight(String inventoryDigest, String productionDigest, JsonNode inventoryJudgement, JsonNode productionJudgement) { }

    private void enrichInventory(JsonNode detail, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        if (!(detail instanceof ObjectNode root)) return;
        ObjectNode data = root.path("data").isObject() ? (ObjectNode) root.path("data") : root;
        String itemCode = request.path("itemCode").asText(data.path("item").path("code").asText(""));
        if (!itemCode.isBlank()) {
            JsonNode definition = inventory.readCatalogInventoryDefinition(dataNodeRef, brandRef, itemCode, requestId);
            // Inventory definition is a raw read model in the OpenAPI surface;
            // tolerate the legacy enveloped form while preserving the owner
            // response shape.  Otherwise a valid definition silently drops
            // the detail BOM at the coordinator boundary.
            JsonNode definitionData = definition.path("data").isObject() ? definition.path("data") : definition;
            if (definitionData.isObject() && definitionData.path("nodes").isArray()) {
                data.set("inventoryBom", definitionData.path("nodes"));
                if (data.path("item").isObject()) ((ObjectNode) data.path("item")).set("inventoryBom", definitionData.path("nodes").deepCopy());
            }
        }
        JsonNode tagPage = production.read("getOperationsProductionTags", dataNodeRef, brandRef, mapper.createObjectNode(), requestId);
        java.util.Map<String, String> tagNames = new java.util.HashMap<>();
        tagPage.path("data").path("entries").forEach(tag -> tagNames.put(tag.path("code").asText(), tag.path("name").asText()));
        data.path("productionTags").forEach(tag -> { if (tag instanceof ObjectNode row) row.put("name", tagNames.getOrDefault(tag.path("code").asText(), tag.path("name").asText())); });
    }

    private void enrichInventoryTargets(JsonNode result, String dataNodeRef, String brandRef, String requestId, JsonNode prefetchedCatalog) {
        if (!(result instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return;
        JsonNode catalogPage = prefetchedCatalog;
        if (catalogPage == null) {
            ArrayNode codes = mapper.createArrayNode(); envelope.path("data").path("items").forEach(item -> { if (item.hasNonNull("productCode")) codes.add(item.path("productCode").asText()); });
            if (codes.isEmpty()) return;
            ObjectNode lookup = mapper.createObjectNode(); lookup.set("itemCodes", codes); lookup.put("pageSize", Math.min(codes.size(), 100)); catalogPage = catalog.read("getOperationsCatalogItems", dataNodeRef, brandRef, lookup, requestId);
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
        JsonNode detail = catalog.read("getOperationsCatalogItem", dataNodeRef, brandRef, mapper.createObjectNode().put("itemCode", code), requestId);
        JsonNode item = detail.path("data").path("item").isObject() ? detail.path("data").path("item") : detail.path("item");
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
            JsonNode catalogPage = catalog.read("getOperationsCatalogItems", dataNodeRef, brandRef, lookup, requestId);
            JsonNode catalogData = catalogPage.path("data").isObject() ? catalogPage.path("data") : catalogPage;
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

    private void coordinateSaveInventory(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, String dataNodeType) {
        JsonNode sections = request.path("sections");
        JsonNode configuration = sections.path("inventoryConfiguration");
        JsonNode expectedVersions = sections.path("expectedInventoryVersions");
        JsonNode draft = sections.path("catalogDraft");
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
            ObjectNode ensure = mapper.createObjectNode().put("itemCode", itemCode).put("mode", mode);
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
            JsonNode ensured = inventory.ensureCatalogInventoryTarget(dataNodeRef, brandRef, ensure, requestId, idempotencyKey + ":ensure:" + itemCode + ":" + (skuCode == null ? "ITEM" : skuCode));
            targetRef = ensured.path("targetRef").asText("");
            node.put("targetRef", targetRef);
        }
        if (draft.path("inventoryBom").isArray()) {
            java.util.Map<String, ArrayNode> grouped = new java.util.LinkedHashMap<>();
            java.util.Map<String, Long> bomVersions = new java.util.HashMap<>();
            draft.path("inventoryBom").forEach(entry -> {
                if (!"BOM".equals(entry.path("mode").asText("NONE"))) return;
                String skuCode = entry.hasNonNull("skuCode") ? entry.path("skuCode").asText() : "";
                String optionValueCode = entry.hasNonNull("optionValueCode") ? entry.path("optionValueCode").asText() : "";
                if (!skuCode.isBlank() && !optionValueCode.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM owner 不能同时指定 SKU 与选项值");
                String key = request.path("itemCode").asText() + "|" + skuCode + "|" + optionValueCode;
                grouped.computeIfAbsent(key, ignored -> mapper.createArrayNode()).add(entry);
                if (entry.has("version")) bomVersions.putIfAbsent(key, entry.path("version").asLong());
            });
            grouped.forEach((key, entries) -> {
                String[] identity = key.split("\\|", -1);
                ObjectNode command = mapper.createObjectNode().put("itemCode", identity[0]);
                if (identity.length > 1 && !identity[1].isBlank()) command.put("skuCode", identity[1]); else command.putNull("skuCode");
                if (identity.length > 2 && !identity[2].isBlank()) command.put("optionValueCode", identity[2]); else command.putNull("optionValueCode");
                command.set("rows", entries);
                command.put("expectedVersion", bomVersions.getOrDefault(key, 0L));
                inventory.saveCatalogProductBom(dataNodeRef, brandRef, command, requestId, idempotencyKey + ":bom:" + key);
            });
        }
    }

    private Set<String> catalogItemImageRefs(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        if (itemCode == null || itemCode.isBlank()) return Set.of();
        ObjectNode query = mapper.createObjectNode().put("itemCode", itemCode);
        JsonNode detail = catalog.read("getOperationsCatalogItem", dataNodeRef, brandRef, query, requestId);
        JsonNode detailRoot = detail.path("data").isObject() ? detail.path("data") : detail;
        return assetRefs(detailRoot.path("item").path("images"));
    }

    /**
     * A catalog save is the business reference decision for an image.  Activate every
     * submitted staged ref after the catalog write, then release removed refs only when
     * the catalog owner confirms no other non-voided item still points at them.
     */
    private void settleCatalogAssets(String dataNodeRef, String brandRef, ObjectNode request, Set<String> previousImages, String requestId, String idempotencyKey) {
        Set<String> nextImages = assetRefs(request.path("sections").path("catalogDraft").path("images"));
        for (String ref : nextImages) {
            try {
                assets.claimCatalogStaged(UUID.fromString(ref));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef");
            } catch (PlatformAssetService.AssetClaimRejectedException failure) {
                throw new CatalogOwnerApi.Problem("ASSET_NOT_READY", 409, "图片资产尚未准备好或已失效");
            }
        }
        for (String ref : previousImages) {
            if (nextImages.contains(ref) || catalog.assetReferenced(dataNodeRef, brandRef, ref)) continue;
            try {
                AssetReadback current = assets.require(UUID.fromString(ref));
                assets.releaseCatalogStaged(UUID.fromString(ref), current.version(), idempotencyKey + ":asset-release:" + ref);
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "images contains an invalid assetRef");
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

    private JsonNode coordinateCopyOwners(JsonNode catalogResult, String source, String target, String brandRef, ObjectNode request, String requestId, boolean brandCopy) {
        if (!(catalogResult instanceof ObjectNode envelope) || !envelope.path("data").isObject()) return catalogResult;
        ObjectNode data = (ObjectNode) envelope.path("data");
        ObjectNode ownerRequest = request.deepCopy();
        if (brandCopy) {
            ArrayNode codes = ownerRequest.putArray("closureItemCodes");
            for (String group : new String[]{"created", "reused"}) data.path(group).forEach(row -> { if (row.hasNonNull("code")) codes.add(row.path("code").asText()); });
        }
        JsonNode inventoryReadback = inventory.copy(source, target, brandRef, ownerRequest, requestId);
        ArrayNode readbacks = data.withArray("ownerReadbacks");
        readbacks.add(inventoryReadback);
        if (brandCopy) {
            ObjectNode productionRequest = request.deepCopy();
            productionRequest.set("productionTagCodes", catalog.referencedProductionTagCodes(source, brandRef, ownerRequest));
            readbacks.add(production.copy(source, target, brandRef, productionRequest, requestId));
        }
        return envelope;
    }

    public JsonNode stageAsset(String dataNodeRef, String fileName, String mediaType, String contentDigest, byte[] bytes, String requestId, String idempotencyKey, String testFailurePoint) {
        if (fileName == null || fileName.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "fileName is required");
        if (mediaType == null || mediaType.isBlank() || bytes == null || bytes.length == 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "multipart content is required");
        if (!stagedDigestMatches(contentDigest, bytes)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "contentDigest does not match content");
        // The fixture catalog includes an asset-processing failure case, but
        // the real asset processor is intentionally not faulted by ordinary
        // malformed input (those are validation failures).  Keep the fault
        // seam explicit, disabled by default, and only available to the
        // managed API runner so this case exercises the declared typed
        // problem without making production behavior client-controlled.
        if ("asset-processing".equals(testFailurePoint) && "true".equalsIgnoreCase(System.getenv("V2S_CATALOG_TEST_FAULTS"))) {
            throw new CatalogOwnerApi.Problem("ASSET_PROCESSING_FAILED", 422, "资产处理失败");
        }
        StageReadback staged = assets.stageContent("CATALOG_ITEM_IMAGE", mediaType, bytes.length, new ByteArrayInputStream(bytes), idempotencyKey);
        AssetReadback asset = assets.require(staged.assetRef());
        ObjectNode result = mapper.createObjectNode().put("assetRef", staged.assetRef().toString()).put("status", asset.status()).put("mediaType", staged.contentType()).put("contentDigest", staged.sha256()).putNull("readyAt").put("version", asset.version());
        ObjectNode readback = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId); readback.set("result", result); readback.put("version", asset.version()); return readback;
    }

    private JsonNode releaseAsset(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        UUID ref; try { ref = UUID.fromString(required(request, "assetRef", "")); } catch (IllegalArgumentException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "assetRef is invalid"); }
        if (catalog.assetReferenced(dataNodeRef, brandRef, ref.toString())) throw new CatalogOwnerApi.Problem("ASSET_REFERENCE_PROTECTED", 409, "图片资产仍被商品引用，不能释放");
        long expected = request.path("expectedVersion").asLong(1); AssetReadback readback;
        try { readback = assets.releaseCatalogStaged(ref, expected, idempotencyKey); }
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

    private static String required(ObjectNode request, String key, String fallback) { JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) { if (fallback != null && !fallback.isBlank()) return fallback; throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required"); } return value.asText(); }
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
