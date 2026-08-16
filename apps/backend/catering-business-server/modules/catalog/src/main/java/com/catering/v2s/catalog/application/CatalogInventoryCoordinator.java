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
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
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
            "getOperationsCatalogItem",
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

    public JsonNode readProductionTags(String dataNodeRef, String brandRef, String requestId) {
        return primaryRead(() -> production.readTags(dataNodeRef, brandRef, requestId));
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
        Set<String> previousAssetRefs = catalogItemAssetRefs(
                scope.dataNodeId().toString(), scope.brandRef(), command.itemCode(), context.requestId());
        CatalogOwnerApi.CatalogItemSaveCommand normalizedCommand =
                new CatalogOwnerApi.CatalogItemSaveCommand(command.itemCode(), canonicalLocalJson(request));
        CatalogOwnerApi.CatalogItemSaveReadback readback =
                catalog.saveCatalogItem(context, normalizedCommand, idempotencyKey);
        coordinateSaveInventory(context, request, idempotencyKey);
        settleWorkspaceCatalogAssets(context, request, previousAssetRefs, idempotencyKey, submittedBindings);
        return readback;
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
        return new LocalCopyPreflightReadback(
                canonicalLocalCopyJson(mergeCopyPreflight(catalogPreflight, owners, combined)));
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
        JsonNode catalogPreflight =
                parseLocalCopyJson(catalog.preflightLocalCopy(context, current).canonicalJson());
        CopyReferencePlan plan = copyReferencePlan(catalogPreflight);
        OwnerPreflight owners = preflightLocalInventory(context, current, plan);
        String combined = combinedDigest(
                preflightData(catalogPreflight).path("preflightDigest").asText(), owners.inventoryDigest(), "");
        if (!combined.equals(submittedDigest))
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        JsonNode mergedPreflight = mergeCopyPreflight(catalogPreflight, owners, combined);
        validateCompatibilityDispositions(
                preflightData(mergedPreflight).path("compatibilityResults"), command.compatibilityDispositions());
        List<CatalogOwnerApi.CompatibilityDisposition> catalogDispositions = filterCatalogCompatibilityDispositions(
                preflightData(catalogPreflight).path("compatibilityResults"), command.compatibilityDispositions());
        CopyReferencePlan executionPlan = plan.merge(ownerReferencePlan(owners.inventoryJudgement()));
        CatalogOwnerApi.CopyExecutionReadback catalogReadback = catalog.executeLocalCopy(
                context,
                new CatalogOwnerApi.LocalCopyExecuteCommand(
                        command.sourceItemCode(),
                        command.targetItemCode(),
                        command.selectedSections(),
                        preflightData(catalogPreflight).path("preflightDigest").asText(),
                        command.expectedSourceVersion(),
                        command.expectedTargetVersion(),
                        canonicalReferencePlan(plan),
                        catalogDispositions),
                idempotencyKey);
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
                    idempotencyKey);
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
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections())))
            return new OwnerPreflight("", "", null, null);
        InventoryOwnerApi.LocalCopyPreflightReadback readback = inventory.preflightLocalCopy(
                context,
                new InventoryOwnerApi.LocalCopyPreflightCommand(
                        command.targetItemCode(), command.selectedSections(), canonicalReferencePlan(plan)));
        return new OwnerPreflight(readback.preflightDigest(), "", parseLocalCopyJson(readback.canonicalJson()), null);
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
        JsonNode catalogPreflight =
                parseLocalCopyJson(catalog.preflightBrandCopy(context, current).canonicalJson());
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
                preflightData(catalogPreflight).path("compatibilityResults"), command.compatibilityDispositions());
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
                idempotencyKey);
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
                idempotencyKey);
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
        InventoryOwnerApi.LocalCopyPreflightReadback inventoryReadback = inventory.preflightBrandCopy(
                context,
                new InventoryOwnerApi.BrandCopyPreflightCommand(
                        command.selectedItemCodes(), command.targetDataNodeRef(), plan));
        ProductionTagOwnerApi.BrandCopyPreflightReadback productionReadback = production.preflightBrandCopy(
                context,
                new ProductionTagOwnerApi.BrandCopyPreflightCommand(
                        command.selectedItemCodes(), command.targetDataNodeRef(), plan));
        return new OwnerPreflight(
                inventoryReadback.preflightDigest(),
                productionReadback.preflightDigest(),
                parseLocalCopyJson(inventoryReadback.canonicalJson()),
                parseLocalCopyJson(productionReadback.canonicalJson()));
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
        value.set("productionTagRefs", plan.productionTagRefs().deepCopy());
        value.set("referenceMappings", plan.referenceMappings().deepCopy());
        return canonicalLocalCopyJson(value);
    }

    private void coordinateSaveInventory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = context.ownerScope();
        JsonNode sections = request.path("sections");
        JsonNode configuration = sections.path("inventoryConfiguration");
        JsonNode expectedVersions = sections.path("expectedInventoryVersions");
        JsonNode draft = sections.path("catalogDraft");
        if (!configuration.path("nodes").isArray()
                && !draft.path("inventoryBom").isArray()) return;
        CatalogInventoryProjection projection = catalogInventoryProjection(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request.path("itemCode").asText(),
                context.requestId());
        java.util.Map<String, Long> versions = new java.util.HashMap<>();
        if (expectedVersions.isArray())
            expectedVersions.forEach(expected -> versions.put(
                    expected.path("targetRef").asText(),
                    expected.path("version").asLong()));
        if (configuration.path("nodes").isArray())
            for (JsonNode sourceNode : configuration.path("nodes")) {
                if (!sourceNode.isObject()) continue;
                ObjectNode node = (ObjectNode) sourceNode;
                String mode = node.path("mode").asText("NONE");
                if ("NONE".equals(mode) || "BOM".equals(mode)) continue;
                String targetRef = node.path("targetRef").asText("");
                String itemCode =
                        node.path("itemCode").asText(request.path("itemCode").asText(""));
                String skuCode =
                        node.hasNonNull("skuCode") ? node.path("skuCode").asText() : null;
                if (node.hasNonNull("productSkuRef") && (skuCode == null || skuCode.isBlank())) {
                    throw new CatalogOwnerApi.Problem(
                            "VALIDATION_ERROR", 422, "inventoryConfiguration.productSkuRef requires skuCode");
                }
                String itemRef =
                        opaqueProjectionRef(node, "itemRef", projection.itemRef(), "inventoryConfiguration.itemRef");
                String productSkuRef = skuCode == null
                        ? null
                        : opaqueProjectionRef(
                                node,
                                "productSkuRef",
                                projection.productSkuRef(skuCode),
                                "inventoryConfiguration.productSkuRef");
                ObjectNode ensure = mapper.createObjectNode()
                        .put("itemRef", itemRef)
                        .put("itemCode", itemCode)
                        .put("mode", mode);
                if (productSkuRef == null) ensure.putNull("productSkuRef");
                else ensure.put("productSkuRef", productSkuRef);
                if (skuCode == null) ensure.putNull("skuCode");
                else ensure.put("skuCode", skuCode);
                if (!targetRef.isBlank()) ensure.put("targetRef", targetRef);
                String unit = node.path("consumptionUnit")
                        .asText(node.path("unit")
                                .asText(node.path("configuration")
                                        .path("countingUnit")
                                        .asText("")));
                if (!unit.isBlank()) ensure.put("consumptionUnit", unit);
                if (node.path("configuration").isObject()) ensure.set("configuration", node.path("configuration"));
                if (!targetRef.isBlank()
                        && node.path("configuration").isObject()
                        && node.path("configuration").size() > 0) {
                    Long expected = versions.get(targetRef);
                    if (expected == null)
                        throw new CatalogOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "inventory target version is required");
                    ensure.put("expectedVersion", expected);
                }
                InventoryTargetEnsureReadback ensured = parseCatalogSaveOwnerReadback(inventory
                        .ensureCatalogItemSaveTarget(
                                context,
                                new InventoryOwnerApi.CatalogItemSaveEnsureTargetCommand(canonicalLocalJson(ensure)),
                                idempotencyKey + ":ensure:" + itemRef + ":"
                                        + (productSkuRef == null ? "ITEM" : productSkuRef))
                        .canonicalJson());
                node.put("targetRef", ensured.targetRef());
            }
        if (draft.path("inventoryBom").isArray()) {
            java.util.Map<String, ArrayNode> grouped = new java.util.LinkedHashMap<>();
            java.util.Map<String, ObjectNode> commands = new java.util.LinkedHashMap<>();
            java.util.Map<String, Long> versionsByKey = new java.util.HashMap<>();
            draft.path("inventoryBom").forEach(entry -> {
                if (!"BOM".equals(entry.path("mode").asText("NONE"))) return;
                String skuCode =
                        entry.hasNonNull("skuCode") ? entry.path("skuCode").asText() : "";
                String optionValueCode = entry.hasNonNull("optionValueCode")
                        ? entry.path("optionValueCode").asText()
                        : "";
                if (!skuCode.isBlank() && !optionValueCode.isBlank()) {
                    throw new CatalogOwnerApi.Problem(
                            "VALIDATION_ERROR",
                            422,
                            /*
                             * Keep this argument on its own physical line.
                             */
                            "BOM owner 不能同时指定 SKU 与选项值");
                }
                String itemRef = opaqueProjectionRef(entry, "itemRef", projection.itemRef(), "inventoryBom.itemRef");
                String productSkuRef = skuCode.isBlank()
                        ? null
                        : opaqueProjectionRef(
                                entry,
                                "productSkuRef",
                                projection.productSkuRef(skuCode),
                                "inventoryBom.productSkuRef");
                String optionValueRef = optionValueCode.isBlank()
                        ? null
                        : opaqueProjectionRef(
                                entry,
                                "optionValueRef",
                                projection.optionValueRef(optionValueCode),
                                "inventoryBom.optionValueRef");
                String key = itemRef + "|" + (productSkuRef == null ? "" : productSkuRef) + "|"
                        + (optionValueRef == null ? "" : optionValueRef);
                grouped.computeIfAbsent(key, ignored -> mapper.createArrayNode())
                        .add(entry);
                commands.computeIfAbsent(key, ignored -> {
                    ObjectNode command = mapper.createObjectNode()
                            .put("itemRef", itemRef)
                            .put(
                                    "itemCode",
                                    entry.path("itemCode")
                                            .asText(request.path("itemCode").asText("")));
                    if (productSkuRef == null) command.putNull("productSkuRef");
                    else command.put("productSkuRef", productSkuRef);
                    if (optionValueRef == null) command.putNull("optionValueRef");
                    else command.put("optionValueRef", optionValueRef);
                    if (skuCode.isBlank()) command.putNull("skuCode");
                    else command.put("skuCode", skuCode);
                    if (optionValueCode.isBlank()) command.putNull("optionValueCode");
                    else command.put("optionValueCode", optionValueCode);
                    return command;
                });
                if (entry.has("version"))
                    versionsByKey.putIfAbsent(key, entry.path("version").asLong());
            });
            grouped.forEach((key, entries) -> {
                ObjectNode command = commands.get(key).deepCopy();
                command.set("rows", entries);
                command.put("expectedVersion", versionsByKey.getOrDefault(key, 0L));
                inventory.saveCatalogItemProductBom(
                        context,
                        new InventoryOwnerApi.CatalogItemSaveBomCommand(canonicalLocalJson(command)),
                        idempotencyKey + ":bom:" + key);
            });
        }
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
                    "ASSET_" + "REFERENCE_PROTEC"
                            /* format-wrap */
                            + "TED",
                    409,
                    "图片资产尚未准备好或已失效、版本已变化或仍被引用",
                    /* format-wrap */
                    failure);
        }
    }

    /** Exact payload owned by inventory's catalog-save task envelope. */
    private record InventoryTargetEnsureReadback(String targetRef, long version, boolean created) {}

    private String requiredInventoryTargetRef(JsonNode readback) {
        if (readback == null || !readback.isObject()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory save owner readback is invalid");
        }
        String targetRef = readback.path("targetRef").asText();
        if (targetRef.isBlank()) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "inventory save owner readback targetRef is required");
        }
        return targetRef;
    }

    private InventoryTargetEnsureReadback parseCatalogSaveOwnerReadback(String canonicalJson) {
        try {
            var envelope = mapper.readTree(canonicalJson);
            if (!envelope.path("data").isObject()) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN", 500, "inventory save owner readback data is invalid");
            }
            JsonNode data = envelope.path("data");
            if (!data.hasNonNull("targetRef")
                    || !data.path("version").canConvertToLong()
                    || !data.path("created").isBoolean()) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN", 500, "inventory save owner readback fields are invalid");
            }
            InventoryTargetEnsureReadback readback = mapper.treeToValue(data, InventoryTargetEnsureReadback.class);
            if (readback == null
                    || readback.targetRef() == null
                    || readback.targetRef().isBlank()) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN", 500, "inventory save owner readback targetRef is required");
            }
            return readback;
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "inventory save owner readback is invalid", failure);
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
                promoteMaterialRoleFromOpaqueProfile((ObjectNode) draft);
                omitTypedNullFields(draft, "/sections/catalogDraft");
            }
            return request;
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog save request is invalid", failure);
        }
    }

    /**
     * The generated catalog draft has no typed materialRole field; the edge request therefore preserves it only inside
     * the opaque item profile. Promote that one public catalog field before the owner command while leaving the rest of
     * the profile opaque and owner-owned.
     */
    private static void promoteMaterialRoleFromOpaqueProfile(ObjectNode draft) {
        JsonNode explicit = draft.get("materialRole");
        if (explicit != null && !explicit.isNull()) return;
        JsonNode opaque = draft.path("productionProfiles").path("item").path("materialRole");
        if (opaque.isTextual() && !opaque.asText().isBlank()) draft.set("materialRole", opaque.deepCopy());
    }

    /**
     * Jackson 3 materializes omitted nullable record components before this request crosses into the catalog owner.
     * Catalog draft save is a merge: an omitted field preserves the owner fact, while an empty collection or scalar
     * remains an explicit replacement. Restore omission only for the typed draft tree; raw CanonicalJsonDocument values
     * remain opaque owner JSON and are not rewritten.
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
        ArrayNode productionTagRefs = mapper.createArrayNode();
        java.util.LinkedHashSet<String> itemSeen = new java.util.LinkedHashSet<>();
        java.util.LinkedHashSet<String> tagSeen = new java.util.LinkedHashSet<>();
        for (JsonNode mapping : normalizedMappings) {
            if ("CATALOG_ITEM".equals(mapping.path("objectType").asText())
                    && itemSeen.add(mapping.path("sourceRef").asText()))
                itemRefs.add(mapping.path("sourceRef").asText());
            if ("PRODUCTION_TAG".equals(mapping.path("objectType").asText())
                    && tagSeen.add(mapping.path("sourceRef").asText()))
                productionTagRefs.add(mapping.path("sourceRef").asText());
        }
        JsonNode closureEdges = preflightData(ownerResponse).path("closureEdges");
        if (closureEdges.isArray())
            for (JsonNode edge : closureEdges) {
                if (!"PRODUCTION_TAG".equals(edge.path("referenceKind").asText())) continue;
                String tagRef = requiredOpaqueCopyRef(edge, "toRef");
                if (tagSeen.add(tagRef)) productionTagRefs.add(tagRef);
            }
        if (itemRefs.isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("复制预检未提供商品 closureItemRefs"));
        }
        return new CopyReferencePlan(itemRefs, productionTagRefs, normalizedMappings);
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
        request.set("productionTagRefs", plan.productionTagRefs().deepCopy());
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
        validateCompatibilityRows(data.path("compatibilityResults"));
        data.put("confirmationRequiredCount", requiredCompatibilityCount(data.path("compatibilityResults")));
        int closureCount = uniqueClosureCount(data.path("closureItems"));
        data.put("closureCount", closureCount);
        if (enforceClosureLimit) enforceMergedClosureLimit(data);
        return envelope;
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
                    "COPY_CLOSUR" + "E_TOO_LARGE",
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
            throw new CatalogOwnerApi.Problem(
                    ("VALIDATION_ERROR"),
                    (422),
                    /* format-wrap */
                    ("复制兼容性处置与预检事实不一致"));
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
            if (!seen.add(requiredCompatibilityId(row, "compatibility result"))
                    || row.path("objectType").asText().isBlank()
                    || row.path("result").asText().isBlank()
                    || !row.path("reason").isTextual()
                    || !CatalogInventoryShapeManifest.COPY_COMPATIBILITY_REASON_CODES.contains(
                            row.path("reasonCode").asText())
                    || !validCanonicalTuple(row.path("canonicalTuple"))) {
                {
                    throw new CatalogOwnerApi.Problem(
                            ("RESULT_UNKNOWN"),
                            (500),
                            /* format-wrap */
                            ("复制预检包含重复兼容性事实身份"));
                }
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
            JsonNode productionJudgement) {}

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
            other.closureItemRefs().forEach(value -> {
                if (itemRefs.add(value.asText())) mergedItems.add(value.asText());
            });
            java.util.Set<String> tagRefs = new java.util.LinkedHashSet<>();
            mergedTags.forEach(value -> tagRefs.add(value.asText()));
            other.productionTagRefs().forEach(value -> {
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
                            "REFERENCE_MAPPING_UNR" + "ESOLVED",
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
            if (definitionData.isObject() && definitionData.path("nodes").isArray()) {
                data.set("inventoryBom", definitionData.path("nodes"));
                if (data.path("item").isObject()) {
                    ((ObjectNode) data.path("item"))
                            .set("inventoryBom", definitionData.path("nodes").deepCopy());
                    enrichSkuVoidAvailability(data.path("item"), definitionData.path("nodes"));
                }
                enrichCatalogItemVoidAvailability(data, definitionData.path("nodes"));
            }
        }
        // Cross-owner detail enrichment remains deliberately unclassified until
        // its combined query shape has a source-bound read budget proof.
        JsonNode tagPage = production.readTags(dataNodeRef, brandRef, requestId);
        java.util.Map<String, String> tagNames = new java.util.HashMap<>();
        tagPage.path("data")
                .path("entries")
                .forEach(tag ->
                        tagNames.put(tag.path("code").asText(), tag.path("name").asText()));
        data.path("productionTags").forEach(tag -> {
            if (tag instanceof ObjectNode row)
                row.put(
                        "name",
                        tagNames.getOrDefault(
                                tag.path("code").asText(), tag.path("name").asText()));
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
            for (JsonNode row : rows) {
                String targetRef = row.path("targetRef").asText();
                boolean known = false;
                for (JsonNode reference : references)
                    if (targetRef.equals(reference.path("referenceRef").asText())) {
                        known = true;
                        break;
                    }
                if (known) continue;
                references.addObject().put("referenceKind", "INVENTORY_TARGET").put("referenceRef", targetRef);
                facts.addObject().put("factKind", "INVENTORY_TARGET").put("factRef", targetRef);
            }
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
        if (!inventoryNodes.isArray()) return;
        inventoryNodes.forEach(node -> {
            String targetRef = node.path("targetRef").asText("");
            if (targetRef.isBlank()) return;
            boolean known = false;
            for (JsonNode reference : references) {
                if (targetRef.equals(reference.path("referenceRef").asText(""))) {
                    known = true;
                    break;
                }
            }
            if (known) return;
            references.addObject().put("referenceKind", "INVENTORY_TARGET").put("referenceRef", targetRef);
            facts.addObject().put("factKind", "INVENTORY_BOM").put("factRef", targetRef);
        });
        if (references.size() > 0) availability.put("canVoid", false);
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
        JsonNode catalogPage = prefetchedCatalog;
        if (catalogPage == null) {
            ArrayNode refs = mapper.createArrayNode();
            envelope.path("data").path("items").forEach(item -> {
                if (item.hasNonNull("itemRef")) refs.add(item.path("itemRef").asText());
            });
            if (refs.isEmpty()) return;
            ObjectNode lookup = mapper.createObjectNode();
            lookup.set("itemRefs", refs);
            lookup.put("pageSize", Math.min(refs.size(), 100));
            catalogPage = catalog.readItems(dataNodeRef, brandRef, lookup, requestId);
        }
        java.util.Map<String, JsonNode> items = new java.util.HashMap<>();
        catalogPage
                .path("data")
                .path("items")
                .forEach(item -> items.put(item.path("itemRef").asText(), item));
        java.util.Map<String, String> categoryNames = categoryNames(dataNodeRef, brandRef, requestId, catalogPage);
        envelope.path("data").path("items").forEach(item -> {
            if (!(item instanceof ObjectNode row)) return;
            JsonNode catalogItem = items.get(row.path("itemRef").asText());
            if (catalogItem == null) return;
            row.put(
                    "productName",
                    catalogItem.path("name").asText(row.path("productName").asText()));
            String categoryRef = catalogItem.path("categoryRefs").isArray()
                            && catalogItem.path("categoryRefs").size() > 0
                    ? catalogItem.path("categoryRefs").get(0).asText("")
                    : "";
            if (categoryRef.isBlank()) row.putNull("categoryName");
            else row.put("categoryName", categoryNames.getOrDefault(categoryRef, ""));
            if (catalogItem.hasNonNull("materialRole"))
                row.put("materialRole", catalogItem.path("materialRole").asText());
            else row.putNull("materialRole");
            String skuRef = row.path("productSkuRef").asText("");
            if (!skuRef.isBlank() && catalogItem.path("skus").isArray())
                catalogItem.path("skus").forEach(sku -> {
                    if (skuRef.equals(sku.path("productSkuRef").asText()))
                        row.put(
                                "skuName",
                                sku.path("skuName").asText(row.path("skuName").asText()));
                });
        });
    }

    /** Resolve category refs once from the catalog navigation task-read; never display an opaque UUID as a name. */
    private java.util.Map<String, String> categoryNames(
            String dataNodeRef, String brandRef, String requestId, JsonNode catalogPage) {
        java.util.Set<String> refs = new java.util.LinkedHashSet<>();
        catalogPage.path("data").path("items").forEach(item -> item.path("categoryRefs")
                .forEach(value -> {
                    if (value.isTextual() && !value.asText().isBlank()) refs.add(value.asText());
                }));
        if (refs.isEmpty()) return java.util.Map.of();
        JsonNode navigation = catalogReads.navigation(dataNodeRef, brandRef, mapper.createObjectNode(), requestId);
        java.util.Map<String, String> names = new java.util.HashMap<>();
        navigation.path("data").path("tree").forEach(node -> {
            String ref = node.path("categoryRef").asText("");
            String name = node.path("name").asText("");
            if (refs.contains(ref) && !name.isBlank()) names.put(ref, name);
        });
        return names;
    }

    private void enrichInventoryTarget(JsonNode result, String dataNodeRef, String brandRef, String requestId) {
        if (!(result instanceof ObjectNode current) || !current.path("target").isObject()) return;
        ObjectNode target = (ObjectNode) current.path("target");
        String itemRef = target.path("itemRef").asText("");
        if (itemRef.isBlank()) return;
        ObjectNode lookup = mapper.createObjectNode();
        lookup.putArray("itemRefs").add(itemRef);
        JsonNode item = catalog.readItems(dataNodeRef, brandRef, lookup, requestId)
                .path("data")
                .path("items")
                .path(0);
        if (item.isObject()) {
            target.put(
                    "productName",
                    item.path("name").asText(target.path("productName").asText()));
            target.put(
                    "productShape",
                    item.path("shapeKey").asText(target.path("productShape").asText()));
            String skuRef = target.path("productSkuRef").asText("");
            if (!skuRef.isBlank() && item.path("skus").isArray()) {
                item.path("skus").forEach(sku -> {
                    if (skuRef.equals(sku.path("productSkuRef").asText()))
                        target.put(
                                "skuName",
                                sku.path("skuName")
                                        .asText(target.path("skuName").asText()));
                });
            }
        }
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
        java.util.Map<String, Integer> targetCounts = new java.util.HashMap<>();
        java.util.Map<String, Integer> bomCounts = new java.util.HashMap<>();
        if (inventoryItems.isArray()) {
            inventoryItems.forEach(item -> {
                String itemRef = item.path("itemRef").asText();
                targetCounts.put(itemRef, item.path("targetCount").asInt(0));
                bomCounts.put(itemRef, item.path("bomCount").asInt(0));
            });
        }
        JsonNode items = envelope.path("data").path("items");
        if (items.isArray()) {
            items.forEach(item -> {
                if (item instanceof ObjectNode row) {
                    String itemRef = row.path("itemRef").asText();
                    row.put("stockTargetCount", targetCounts.getOrDefault(itemRef, 0));
                    row.put("bomCount", bomCounts.getOrDefault(itemRef, 0));
                }
            });
        }
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
        if (item.path("orderOptions").isArray())
            item.path("orderOptions").forEach(group -> {
                if (group.path("values").isArray())
                    group.path("values").forEach(value -> {
                        String code = value.path("code").asText("");
                        if (!code.isBlank() && value.hasNonNull("attributeValueRef"))
                            optionValueRefs.putIfAbsent(
                                    code,
                                    requiredOpaqueTaskRef(
                                            value, "attributeValueRef", "catalog option-value task read"));
                    });
            });
        return new CatalogInventoryProjection(itemRef, Map.copyOf(skuRefs), Map.copyOf(optionValueRefs));
    }

    private String opaqueProjectionRef(JsonNode source, String key, String derived, String subject) {
        if (source != null
                && source.hasNonNull(key)
                && !source.path(key).asText().isBlank()) return requiredOpaqueTaskRef(source, key, subject);
        if (derived == null || derived.isBlank())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, subject + " is required as an opaque UUID ref");
        return requiredOpaqueTaskRef(mapper.createObjectNode().put(key, derived), key, subject);
    }

    private record CatalogInventoryProjection(
            String itemRef, Map<String, String> productSkuRefs, Map<String, String> optionValueRefs) {
        String productSkuRef(String skuCode) {
            return productSkuRefs.get(skuCode);
        }

        String optionValueRef(String optionValueCode) {
            return optionValueRefs.get(optionValueCode);
        }
    }

    private Set<String> catalogItemAssetRefs(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        if (itemCode == null || itemCode.isBlank()) return Set.of();
        JsonNode detail = catalog.readItem(dataNodeRef, brandRef, itemCode, requestId);
        JsonNode detailRoot = detail.path("data");
        return catalogAssetRefs(detailRoot.path("item"));
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
        if (expected.equals(actual) && "true".equalsIgnoreCase(System.getenv("V2S_CATALOG_TEST_FAULTS"))) {
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
