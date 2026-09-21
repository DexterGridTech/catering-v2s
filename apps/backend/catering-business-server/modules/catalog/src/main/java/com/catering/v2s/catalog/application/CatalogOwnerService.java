package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;

/** Catalog owner. All catalog facts and command receipts stay inside catalog schema. */
@Service
public class CatalogOwnerService implements CatalogOwnerApi, CatalogTemporaryPromotionOwner {
    private final CatalogAttributeDefinitionService attributeDefinitionService;
    private final CatalogUnitDefinitionService unitDefinitionService;
    private final CatalogOrderOptionDefinitionService orderOptionDefinitionService;
    private final CatalogCategoryService categoryService;
    private final CatalogDictionaryService dictionaryService;
    private final CatalogCommandRouter commandRouter;
    private final CatalogItemService itemService;
    private final CatalogCopyService copyService;
    private final CatalogWorkbenchReadService workbenchReadService;

    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory) {
        this(
                jdbc,
                mapper,
                time,
                assetReferenceLocks,
                productionTags,
                inventory,
                null,
                new CatalogAttributeDefinitionService(jdbc, time),
                new CatalogUnitDefinitionService(jdbc, time, inventory),
                new CatalogOrderOptionDefinitionService(jdbc, time),
                new CatalogCategoryService(jdbc, mapper, time),
                new CatalogDictionaryService(jdbc, mapper, time),
                null);
    }

    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions) {
        this(
                jdbc,
                mapper,
                time,
                assetReferenceLocks,
                productionTags,
                inventory,
                transactions,
                new CatalogAttributeDefinitionService(jdbc, time),
                new CatalogUnitDefinitionService(jdbc, time, inventory),
                new CatalogOrderOptionDefinitionService(jdbc, time),
                new CatalogCategoryService(jdbc, mapper, time),
                new CatalogDictionaryService(jdbc, mapper, time),
                null);
    }

    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions,
            CatalogAttributeDefinitionService attributeDefinitionService,
            CatalogUnitDefinitionService unitDefinitionService,
            CatalogOrderOptionDefinitionService orderOptionDefinitionService,
            CatalogCategoryService categoryService,
            CatalogDictionaryService dictionaryService,
            CatalogCommandRouter commandRouter) {
        this(
                jdbc,
                mapper,
                time,
                assetReferenceLocks,
                productionTags,
                inventory,
                transactions,
                attributeDefinitionService,
                unitDefinitionService,
                orderOptionDefinitionService,
                categoryService,
                dictionaryService,
                commandRouter,
                null,
                null,
                null);
    }

    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions,
            CatalogAttributeDefinitionService attributeDefinitionService,
            CatalogUnitDefinitionService unitDefinitionService,
            CatalogOrderOptionDefinitionService orderOptionDefinitionService,
            CatalogCategoryService categoryService,
            CatalogDictionaryService dictionaryService,
            CatalogCommandRouter commandRouter,
            CatalogItemService itemService) {
        this(
                jdbc,
                mapper,
                time,
                assetReferenceLocks,
                productionTags,
                inventory,
                transactions,
                attributeDefinitionService,
                unitDefinitionService,
                orderOptionDefinitionService,
                categoryService,
                dictionaryService,
                commandRouter,
                itemService,
                null,
                null);
    }

    @Autowired
    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions,
            CatalogAttributeDefinitionService attributeDefinitionService,
            CatalogUnitDefinitionService unitDefinitionService,
            CatalogOrderOptionDefinitionService orderOptionDefinitionService,
            CatalogCategoryService categoryService,
            CatalogDictionaryService dictionaryService,
            CatalogCommandRouter commandRouter,
            CatalogItemService itemService,
            CatalogCopyService copyService,
            CatalogWorkbenchReadService workbenchReadService) {
        this.attributeDefinitionService = attributeDefinitionService;
        this.unitDefinitionService = unitDefinitionService;
        this.orderOptionDefinitionService = orderOptionDefinitionService;
        this.categoryService = categoryService;
        this.dictionaryService = dictionaryService == null ? new CatalogDictionaryService(jdbc, mapper, time) : dictionaryService;
        this.itemService = itemService == null
                ? new CatalogItemService(jdbc, mapper, time, assetReferenceLocks, productionTags, inventory, transactions)
                : itemService;
        this.copyService = copyService == null
                ? new CatalogCopyService(jdbc, mapper, time, assetReferenceLocks, productionTags, inventory, transactions)
                : copyService;
        this.workbenchReadService = workbenchReadService == null
                ? new CatalogWorkbenchReadService(
                        jdbc, mapper, time, assetReferenceLocks, productionTags, inventory, transactions)
                : workbenchReadService;
        this.commandRouter = commandRouter == null
                ? new CatalogCommandRouter(categoryService, this.dictionaryService, this.itemService)
                : commandRouter;
    }

    @Override
    public JsonNode readWorkbenchContext(String dataNodeRef, String brandRef, String requestId) {
        return workbenchReadService.readWorkbenchContext(dataNodeRef, brandRef, requestId);
    }

    @Override
    public JsonNode readNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return workbenchReadService.readNavigation(dataNodeRef, brandRef, request, requestId);
    }

    @Override
    public JsonNode readItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return workbenchReadService.readItems(dataNodeRef, brandRef, request, requestId);
    }

    @Override
    public JsonNode readCategoryCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return workbenchReadService.readCategoryCandidates(dataNodeRef, brandRef, request, requestId);
    }

    @Override
    public List<CatalogOwnerApi.InventoryDisplayFact> readInventoryDisplayFacts(
            String dataNodeRef, String brandRef, List<UUID> orderedItemRefs) {
        return workbenchReadService.readInventoryDisplayFacts(dataNodeRef, brandRef, orderedItemRefs);
    }

    @Override
    public CatalogOwnerApi.InventoryTargetDisplayFact readInventoryTargetDisplayFact(
            String dataNodeRef, String brandRef, UUID itemRef, UUID productSkuRef) {
        return workbenchReadService.readInventoryTargetDisplayFact(dataNodeRef, brandRef, itemRef, productSkuRef);
    }

    @Override
    public CatalogOwnerApi.SalesMenuCandidatePage readSalesMenuCandidatePage(
            CatalogOwnerApi.SalesMenuCandidatePageQuery query) {
        return workbenchReadService.readSalesMenuCandidatePage(query);
    }

    @Override
    public Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> readSalesMenuItemFacts(
            String dataNodeRef, String brandRef, Set<UUID> itemRefs) {
        return workbenchReadService.readSalesMenuItemFacts(dataNodeRef, brandRef, itemRefs);
    }

    @Override
    public Map<UUID, CatalogOwnerApi.SalesMenuItemReferenceFact> readSalesMenuItemReferenceFacts(
            String dataNodeRef, String brandRef, Set<UUID> itemRefs) {
        return workbenchReadService.readSalesMenuItemReferenceFacts(dataNodeRef, brandRef, itemRefs);
    }

    @Override
    public JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        return itemService.readItem(dataNodeRef, brandRef, itemCode, requestId);
    }

    @Override
    public JsonNode readItemSkus(
            String dataNodeRef, String brandRef, String itemCode, ObjectNode request, String requestId) {
        return itemService.readItemSkus(dataNodeRef, brandRef, itemCode, request, requestId);
    }

    @Override
    public CatalogOwnerApi.AttributeDefinitionListReadback listAttributeDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage) {
        return attributeDefinitionService.listAttributeDefinitions(dataNodeRef, brandRef, candidateUsage);
    }

    @Override
    public CatalogOwnerApi.AttributeDefinitionReadback createAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionCreateCommand command,
            String idempotencyKey) {
        return attributeDefinitionService.createAttributeDefinition(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.AttributeDefinitionReadback updateAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionUpdateCommand command,
            String idempotencyKey) {
        return attributeDefinitionService.updateAttributeDefinition(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.AttributeDefinitionReadback transitionAttributeDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        return attributeDefinitionService.transitionAttributeDefinitionStatus(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.UnitDefinitionListReadback listUnitDefinitions(
            String dataNodeRef,
            String brandRef,
            boolean includeInactive,
            CatalogOwnerApi.UnitDimension dimension,
            String query,
            String status) {
        return unitDefinitionService.listUnitDefinitions(
                dataNodeRef, brandRef, includeInactive, dimension, query, status);
    }

    @Override
    public CatalogOwnerApi.UnitDefinitionReadback createUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionCreateCommand command,
            String idempotencyKey) {
        return unitDefinitionService.createUnitDefinition(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.UnitDefinitionReadback updateUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionUpdateCommand command,
            String idempotencyKey) {
        return unitDefinitionService.updateUnitDefinition(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.UnitDefinitionReadback transitionUnitStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        return unitDefinitionService.transitionUnitStatus(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.OrderOptionDefinitionListReadback listOrderOptionDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage) {
        return orderOptionDefinitionService.listOrderOptionDefinitions(dataNodeRef, brandRef, candidateUsage);
    }

    @Override
    public CatalogOwnerApi.OrderOptionDefinitionReadback createOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionCreateCommand command,
            String idempotencyKey) {
        return orderOptionDefinitionService.createOrderOptionDefinition(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.OrderOptionDefinitionMutationReadback updateOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command,
            String idempotencyKey) {
        return orderOptionDefinitionService.updateOrderOptionDefinition(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.OrderOptionDefinitionReadback transitionOrderOptionDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        return orderOptionDefinitionService.transitionOrderOptionDefinitionStatus(context, command, idempotencyKey);
    }

    @Override
    public JsonNode readDictionary(
            String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId) {
        return dictionaryService.readDictionary(dataNodeRef, brandRef, dictionaryKind, request, requestId);
    }

    @Override
    public JsonNode readLocalCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return copyService.readLocalCopyCandidates(dataNodeRef, brandRef, request, requestId);
    }

    @Override
    public JsonNode readBrandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return copyService.readBrandCopyCandidates(dataNodeRef, brandRef, request, requestId);
    }

    @Override
    public JsonNode readShapeManifest(String requestId) {
        return copyService.readShapeManifest(requestId);
    }

    @Override
    public JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        requireTypedContext(context, "catalog");
        return commandRouter.route(context, request, idempotencyKey, null);
    }

    @Override
    public CatalogOwnerApi.CategoryReadback createCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryCreateCommand command,
            String idempotencyKey) {
        return categoryService.createCategory(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CategoryReadback updateCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryUpdateCommand command,
            String idempotencyKey) {
        return categoryService.updateCategory(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CategoryReadback moveCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryMoveCommand command,
            String idempotencyKey) {
        return categoryService.moveCategory(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CategoryReadback transitionCategoryStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryStatusTransitionCommand command,
            String idempotencyKey) {
        return categoryService.transitionCategoryStatus(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.DictionaryCommandReadback createDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryCreateCommand command,
            String idempotencyKey) {
        return dictionaryService.createDictionaryEntry(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.DictionaryCommandReadback updateDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryUpdateCommand command,
            String idempotencyKey) {
        return dictionaryService.updateDictionaryEntry(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.DictionaryViewReadback reorderDictionaryEntries(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryReorderCommand command,
            String idempotencyKey) {
        return dictionaryService.reorderDictionaryEntries(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.DictionaryCommandReadback transitionDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryTransitionCommand command,
            String idempotencyKey) {
        return dictionaryService.transitionDictionaryEntry(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CatalogItemCommandReadback createCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemCreateCommand command,
            String idempotencyKey) {
        return itemService.createCatalogItem(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CatalogItemCommandReadback transitionCatalogItemStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemStatusTransitionCommand command,
            String idempotencyKey) {
        return itemService.transitionCatalogItemStatus(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback transitionCatalogItemStatuses(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand command,
            String idempotencyKey) {
        return itemService.transitionCatalogItemStatuses(context, command, idempotencyKey);
    }

    @Override
    public UUID resolveCatalogItemRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemCode) {
        return itemService.resolveCatalogItemRef(context, itemCode);
    }

    @Override
    public boolean catalogItemReferencedByOtherItems(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID itemRef) {
        return itemService.catalogItemReferencedByOtherItems(context, itemRef);
    }

    /**
     * Named owner boundary for the whole save; free request fields stay canonical text until this owner validates them.
     */
    @Override
    public CatalogOwnerApi.CatalogItemSaveReadback saveCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemSaveCommand command,
            String idempotencyKey) {
        return itemService.saveCatalogItem(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.TemporaryPromotionPreflightReadback preflightTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionPreflightCommand command,
            String idempotencyKey) {
        return itemService.preflightTemporaryCatalogItemPromotion(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionExecuteCommand command,
            String idempotencyKey) {
        return itemService.executeTemporaryCatalogItemPromotion(context, command, idempotencyKey);
    }

    @Override
    public CatalogTemporaryPromotionExecution executeTemporaryCatalogItemPromotionWithProjection(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionExecuteCommand command,
            String idempotencyKey) {
        return itemService.executeTemporaryCatalogItemPromotionWithProjection(context, command, idempotencyKey);
    }

    @Override
    public JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        return copyService.copy(context, request, idempotencyKey);
    }

    @Override
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        return copyService.preflightCopy(context, request);
    }

    @Override
    public CatalogOwnerApi.CopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        return copyService.preflightLocalCopy(context, command);
    }

    @Override
    public CatalogOwnerApi.LocalCopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        return copyService.prepareLocalCopy(context, command);
    }

    @Override
    public CatalogOwnerApi.CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey) {
        return copyService.executeLocalCopy(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey,
            CatalogOwnerApi.LocalCopyExecutionPreparation preparation) {
        return copyService.executeLocalCopy(context, command, idempotencyKey, preparation);
    }

    @Override
    public CatalogOwnerApi.CopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        return copyService.preflightBrandCopy(context, command);
    }

    @Override
    public CatalogOwnerApi.BrandCopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        return copyService.prepareBrandCopy(context, command);
    }

    @Override
    public CatalogOwnerApi.CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        return copyService.executeBrandCopy(context, command, idempotencyKey);
    }

    @Override
    public CatalogOwnerApi.CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey,
            CatalogOwnerApi.BrandCopyExecutionPreparation preparation) {
        return copyService.executeBrandCopy(context, command, idempotencyKey, preparation);
    }

    static List<String> validatedLocalCopySections(ArrayNode selectedSections) {
        return CatalogOwnerValueSupport.validatedLocalCopySections(selectedSections);
    }

    @Override
    public boolean itemExists(String dataNodeRef, String brandRef, String itemCode) {
        return itemService.itemExists(dataNodeRef, brandRef, itemCode);
    }

    @Override
    public boolean productionTagReferenced(String dataNodeRef, String brandRef, String tagRef) {
        return itemService.productionTagReferenced(dataNodeRef, brandRef, tagRef);
    }

    @Override
    public boolean assetReferenced(String dataNodeRef, String brandRef, String assetRef) {
        return itemService.assetReferenced(dataNodeRef, brandRef, assetRef);
    }

    @Override
    public boolean assetReferencedAnywhere(String assetRef) {
        return itemService.assetReferencedAnywhere(assetRef);
    }

    @Override
    public java.util.Set<String> assetRefsStillReferenced(java.util.Set<String> assetRefs) {
        return itemService.assetRefsStillReferenced(assetRefs);
    }

    @Override
    public CatalogOwnerApi.CatalogAssetReferenceReadback readAssetReferences(
            String dataNodeRef, String brandRef, String itemCode) {
        return itemService.readAssetReferences(dataNodeRef, brandRef, itemCode);
    }

    @Override
    public void requireAssetUnreferencedAnywhere(UUID assetRef) {
        itemService.requireAssetUnreferencedAnywhere(assetRef);
    }

    @Override
    public JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef) {
        return itemService.inventoryConsumptionReferences(dataNodeRef, brandRef, targetRef);
    }

    @Override
    public JsonNode skuNamesByItemCodes(String dataNodeRef, String brandRef, JsonNode itemCodes) {
        return itemService.skuNamesByItemCodes(dataNodeRef, brandRef, itemCodes);
    }

    static void validateCatalogCode(String code) {
        CatalogOwnerValueSupport.validateCatalogCode(code);
    }

    static Set<String> catalogAssetRefs(JsonNode sections) {
        return CatalogOwnerValueSupport.catalogAssetRefs(sections);
    }

    /**
     * The catalog owner exposes only the typed external-order identity facts needed by the governance surface. It
     * deliberately does not pass an arbitrary source payload through the edge read model; absent facts remain absent
     * instead of being guessed from the current catalog name or price.
     */
    static JsonNode externalIdentityFact(ObjectMapper mapper, JsonNode sections) {
        return CatalogOwnerValueSupport.externalIdentityFact(mapper, sections);
    }

    public static void validateItemPageQuery(ObjectNode request) {
        CatalogOwnerValueSupport.validateItemPageQuery(request);
    }

    private static CatalogAuthorizationScope requireTypedContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String expectedOwner) {
        if (context == null
                || context.operationToken() == null
                || context.ownerScope() == null
                || context.ownerGrant() == null
                || context.workspaceUuid() == null
                || context.groupWorkspaceKey() == null
                || context.groupWorkspaceKey().isBlank()
                || !"operations-admin".equals(context.consumerFace())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog execution context is required");
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner())
                || scope.dataNodeId() == null
                || scope.brandRef() == null
                || scope.brandRef().isBlank()
                || !token.allowedDataNodeTypes().contains(scope.dataNodeType())
                || capability == null
                || !context.ownerGrant()
                        .verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog execution context is not authorized");
        }
        return scope;
    }

    static boolean expandsCatalogItemClosure(String referenceKind) {
        return Set.of("CATALOG_ITEM", "COMPOSITE_COMPONENT", "BOM_COMPONENT").contains(referenceKind);
    }

    static String copyReferenceObjectType(String referenceKind) {
        return CatalogOwnerValueSupport.copyReferenceObjectType(referenceKind);
    }

    /** Stable product compatibility bit: skuCode -> sorted(attributeCode,valueCode) pairs. */
    static String skuStructureFingerprint(JsonNode sections) {
        return CatalogOwnerValueSupport.skuStructureFingerprint(sections);
    }

    static String dictionaryObjectType(String dictionaryKind) {
        return CatalogOwnerValueSupport.dictionaryObjectType(dictionaryKind);
    }
}
