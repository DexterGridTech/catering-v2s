package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Catalog owner. All catalog facts and command receipts stay inside catalog schema. */
@Service
public class CatalogOwnerService implements CatalogOwnerApi {
    private static final String BATCH_STATUS_OPERATION_ID = "batchTransitionOperationsCatalogItemStatus";
    /** Must stay equal to CatalogItemPageQuery.pageSize.maximum and the batch request maxItems. */
    private static final int CATALOG_ITEM_BATCH_LIMIT = 100;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;
    private final CatalogAssetReferenceLock assetReferenceLocks;
    private final ProductionTagOwnerApi productionTags;
    private final InventoryOwnerApi inventory;
    private final CatalogSkuFacts skuFacts;
    private final CatalogItemCategoryFacts categoryFacts;
    private final CatalogCompositeFacts compositeFacts;
    /**
     * Isolated legacy relation owner retained only by temporary-promotion paths pending their separate contract
     * cutover.
     */
    private final CatalogItemDefinitionFacts itemDefinitionFacts;

    private final CatalogDefinitionFacts definitionFacts;
    private final CatalogUnitDefinitionFacts unitDefinitionFacts;
    private final CatalogSkuVariantAxisFacts skuVariantAxisFacts;
    private final CatalogItemMediaFacts itemMediaFacts;
    private final CatalogSkuMediaFacts skuMediaFacts;
    private final CatalogItemReferenceFacts itemReferenceFacts;
    private final PlatformTransactionManager transactions;

    public CatalogOwnerService(
            JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time, CatalogAssetReferenceLock assetReferenceLocks) {
        this(jdbc, mapper, time, assetReferenceLocks, null, null, null);
    }

    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            ProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory) {
        this(jdbc, mapper, time, assetReferenceLocks, productionTags, inventory, null);
    }

    @Autowired
    public CatalogOwnerService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            ProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.copyLimits = CopyLimitPolicy.load(mapper);
        this.time = time;
        this.assetReferenceLocks = assetReferenceLocks;
        this.productionTags = productionTags;
        this.inventory = inventory;
        this.transactions = transactions;
        this.skuFacts = new CatalogSkuFacts(jdbc, mapper);
        this.categoryFacts = new CatalogItemCategoryFacts(jdbc, mapper);
        this.compositeFacts = new CatalogCompositeFacts(jdbc, mapper);
        this.itemDefinitionFacts = new CatalogItemDefinitionFacts(jdbc, mapper);
        this.definitionFacts = new CatalogDefinitionFacts(jdbc);
        this.unitDefinitionFacts = new CatalogUnitDefinitionFacts(jdbc);
        this.skuVariantAxisFacts = new CatalogSkuVariantAxisFacts(jdbc, mapper);
        this.itemMediaFacts = new CatalogItemMediaFacts(jdbc, mapper);
        this.skuMediaFacts = new CatalogSkuMediaFacts(jdbc, mapper);
        this.itemReferenceFacts = new CatalogItemReferenceFacts(jdbc, mapper);
    }

    @Override
    public JsonNode readWorkbenchContext(String dataNodeRef, String brandRef, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return workbenchContext(dataNodeRef, brandRef, requestId);
    }

    @Override
    public JsonNode readNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return navigation(dataNodeRef, brandRef, requestId, request);
    }

    @Override
    public JsonNode readItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return items(dataNodeRef, brandRef, requestId, request);
    }

    @Override
    public List<CatalogOwnerApi.InventoryDisplayFact> readInventoryDisplayFacts(
            String dataNodeRef, String brandRef, List<UUID> orderedItemRefs) {
        requireScope(dataNodeRef, brandRef);
        if (orderedItemRefs == null || orderedItemRefs.isEmpty()) return List.of();

        List<UUID> distinctItemRefs = new ArrayList<>(new LinkedHashSet<>(orderedItemRefs));
        String placeholders = String.join(",", Collections.nCopies(distinctItemRefs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(distinctItemRefs);
        List<CatalogOwnerApi.InventoryDisplayFact> projectedFacts = jdbc.query(
                "SELECT item.item_ref,item.name,sku.sku_name,item.sections->>'materialRole',category.name "
                        + "FROM catalog.catalog_item item "
                        + "LEFT JOIN LATERAL (SELECT catalog_sku.sku_name "
                        + "FROM catalog.catalog_sku "
                        + "WHERE catalog_sku.item_ref=item.item_ref AND catalog_sku.status <> 'VOIDED' "
                        + "ORDER BY catalog_sku.is_default DESC,catalog_sku.display_order,catalog_sku.sku_code "
                        + "LIMIT 1) sku ON TRUE "
                        + "LEFT JOIN LATERAL (SELECT catalog_category.name "
                        + "FROM catalog.catalog_item_category relation "
                        + "JOIN catalog.catalog_category "
                        + "ON catalog_category.category_ref=relation.category_ref "
                        + "WHERE relation.item_ref=item.item_ref "
                        + "AND catalog_category.data_node_ref=item.data_node_ref "
                        + "AND catalog_category.brand_ref=item.brand_ref "
                        + "AND catalog_category.status <> 'VOIDED' "
                        + "ORDER BY relation.category_ref "
                        + "LIMIT 1) category ON TRUE "
                        + "WHERE item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.item_ref IN ("
                        + placeholders
                        + ") AND item.status <> 'VOIDED'",
                (rows, row) -> new CatalogOwnerApi.InventoryDisplayFact(
                        rows.getObject(1, UUID.class),
                        rows.getString(2),
                        rows.getString(3),
                        rows.getString(4),
                        rows.getString(5)),
                args.toArray());
        Map<UUID, CatalogOwnerApi.InventoryDisplayFact> factsByItemRef = new LinkedHashMap<>();
        projectedFacts.forEach(fact -> factsByItemRef.put(fact.itemRef(), fact));
        return orderedItemRefs.stream()
                .map(itemRef ->
                        factsByItemRef.getOrDefault(itemRef, CatalogOwnerApi.InventoryDisplayFact.absent(itemRef)))
                .toList();
    }

    @Override
    public JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return detail(dataNodeRef, brandRef, requestId, itemCode);
    }

    @Override
    public CatalogOwnerApi.AttributeDefinitionListReadback listAttributeDefinitions(
            String dataNodeRef, String brandRef) {
        requireScope(dataNodeRef, brandRef);
        return new CatalogOwnerApi.AttributeDefinitionListReadback(
                definitionFacts.listAttributes(dataNodeRef, brandRef));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.AttributeDefinitionReadback createAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "createOperationsCatalogAttributeDefinition");
        return definitionFacts.createAttribute(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.AttributeDefinitionReadback updateAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "updateOperationsCatalogAttributeDefinition");
        return definitionFacts.updateAttribute(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.AttributeDefinitionDeleteReadback deleteAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionDeleteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "deleteOperationsCatalogAttributeDefinition");
        return definitionFacts.deleteAttribute(scope.dataNodeId().toString(), scope.brandRef(), command);
    }

    @Override
    public CatalogOwnerApi.UnitDefinitionListReadback listUnitDefinitions(
            String dataNodeRef, String brandRef, boolean includeInactive, CatalogOwnerApi.UnitDimension dimension) {
        requireScope(dataNodeRef, brandRef);
        List<CatalogOwnerApi.UnitDefinitionReadback> units =
                unitDefinitionFacts.list(dataNodeRef, brandRef, includeInactive, dimension);
        Set<UUID> referencedUnitRefs = new LinkedHashSet<>();
        units.stream()
                .filter(unit -> unitDefinitionFacts.isReferenced(unit.unitRef()))
                .forEach(unit -> referencedUnitRefs.add(unit.unitRef()));
        return new CatalogOwnerApi.UnitDefinitionListReadback(units, referencedUnitRefs);
    }

    @Override
    @Transactional
    public CatalogOwnerApi.UnitDefinitionReadback createUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "createOperationsCatalogUnit");
        return unitDefinitionFacts.create(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.UnitDefinitionReadback updateUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "updateOperationsCatalogUnit");
        inventory.validateCatalogUnitLifecycle(
                context,
                command.unitRef(),
                unitDefinitionFacts.definitionShapeChanges(command)
                        ? InventoryOwnerApi.CatalogUnitLifecycleChange.UPDATE_DEFINITION
                        : InventoryOwnerApi.CatalogUnitLifecycleChange.RENAME);
        return unitDefinitionFacts.update(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.UnitDefinitionReadback disableUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionDisableCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "disableOperationsCatalogUnit");
        inventory.validateCatalogUnitLifecycle(
                context, command.unitRef(), InventoryOwnerApi.CatalogUnitLifecycleChange.DISABLE);
        return unitDefinitionFacts.disable(
                scope.dataNodeId().toString(), scope.brandRef(), command.unitRef(), command.expectedVersion(), now());
    }

    @Override
    @Transactional
    public void deleteUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionDeleteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "deleteOperationsCatalogUnit");
        inventory.validateCatalogUnitLifecycle(
                context, command.unitRef(), InventoryOwnerApi.CatalogUnitLifecycleChange.DELETE);
        unitDefinitionFacts.delete(
                scope.dataNodeId().toString(), scope.brandRef(), command.unitRef(), command.expectedVersion());
    }

    @Override
    public CatalogOwnerApi.OrderOptionDefinitionListReadback listOrderOptionDefinitions(
            String dataNodeRef, String brandRef) {
        requireScope(dataNodeRef, brandRef);
        return new CatalogOwnerApi.OrderOptionDefinitionListReadback(
                definitionFacts.listOrderOptions(dataNodeRef, brandRef));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionReadback createOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "createOperationsCatalogOrderOptionDefinition");
        return definitionFacts.createOrderOption(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionMutationReadback updateOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "updateOperationsCatalogOrderOptionDefinition");
        return definitionFacts.updateOrderOption(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionDeleteReadback deleteOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionDeleteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "deleteOperationsCatalogOrderOptionDefinition");
        return definitionFacts.deleteOrderOption(scope.dataNodeId().toString(), scope.brandRef(), command);
    }

    @Override
    public JsonNode readDictionary(
            String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return dictionary(dataNodeRef, brandRef, requestId, dictionaryKind, request);
    }

    @Override
    public JsonNode readLocalCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return copyCandidates("getOperationsLocalCatalogCopyCandidates", dataNodeRef, brandRef, requestId, request);
    }

    @Override
    public JsonNode readBrandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return copyCandidates("getOperationsBrandCatalogCopyCandidates", dataNodeRef, brandRef, requestId, request);
    }

    @Override
    public JsonNode readShapeManifest(String requestId) {
        return shapeManifest(requestId);
    }

    @Override
    @Transactional
    public JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        return executeWrite(
                context,
                context.operationToken().operationId(),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryReadback createCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "createOperationsCatalogCategory");
        ObjectNode request =
                mapper.createObjectNode().put("code", command.code()).put("name", command.name());
        putNullableUuid(request, "parentCategoryRef", command.parentCategoryRef());
        JsonNode result = executeWrite(
                "createOperationsCatalogCategory",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        return categoryReadback(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                UUID.fromString(result.path("result").path("categoryRef").asText()));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryReadback updateCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "updateOperationsCatalogCategory");
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("name", command.name());
        executeWrite(
                "updateOperationsCatalogCategory",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        return categoryReadback(scope.dataNodeId().toString(), scope.brandRef(), command.categoryRef());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryReadback moveCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryMoveCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "moveOperationsCatalogCategory");
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("action", command.action().name());
        putNullableUuid(request, "parentCategoryRef", command.parentCategoryRef());
        executeWrite(
                "moveOperationsCatalogCategory",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        return categoryReadback(scope.dataNodeId().toString(), scope.brandRef(), command.categoryRef());
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryDeleteReadback deleteCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryDeleteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "deleteOperationsCatalogCategory");
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion());
        JsonNode result = executeWrite(
                "deleteOperationsCatalogCategory",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        JsonNode value = result.path("result");
        return new CatalogOwnerApi.CategoryDeleteReadback(
                UUID.fromString(value.path("categoryRef").asText()),
                value.path("deletedSubtreeSize").asLong(),
                textValues(value.path("deletedCategoryCodes")));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.DictionaryCommandReadback createDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "createOperationsCatalogDictionaryEntry");
        ObjectNode request =
                dictionaryRequest(command.dictionaryKind(), "code", command.code(), null, command.name(), null);
        putNullableUuid(request, "parentEntryRef", command.parentEntryRef());
        return dictionaryCommandReadback(executeWrite(
                "createOperationsCatalogDictionaryEntry",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.DictionaryCommandReadback updateDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "updateOperationsCatalogDictionaryEntry");
        return dictionaryCommandReadback(executeWrite(
                "updateOperationsCatalogDictionaryEntry",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                dictionaryRequest(
                        command.dictionaryKind(),
                        "entryCode",
                        command.entryCode(),
                        command.expectedVersion(),
                        command.name(),
                        null),
                context.requestId(),
                idempotencyKey));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.DictionaryViewReadback reorderDictionaryEntries(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryReorderCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "reorderOperationsCatalogDictionaryEntry");
        ObjectNode request = mapper.createObjectNode().put("dictionaryKind", command.dictionaryKind());
        ArrayNode codes = request.putArray("orderedCodes");
        command.orderedCodes().forEach(codes::add);
        return dictionaryViewReadback(executeWrite(
                "reorderOperationsCatalogDictionaryEntry",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.DictionaryCommandReadback transitionDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                typedCommandScope(context, "transitionOperationsCatalogDictionaryEntryStatus");
        return dictionaryCommandReadback(executeWrite(
                context,
                "transitionOperationsCatalogDictionaryEntryStatus",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                dictionaryRequest(
                        command.dictionaryKind(),
                        "entryCode",
                        command.entryCode(),
                        command.expectedVersion(),
                        null,
                        command.targetStatus()),
                context.requestId(),
                idempotencyKey));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CatalogItemCommandReadback createCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "createOperationsCatalogItem");
        ObjectNode request = mapper.createObjectNode()
                .put("name", command.name())
                .put("code", command.code())
                .put("shapeKey", command.shapeKey());
        if (command.categoryRef() == null) request.putNull("categoryRef");
        else request.put("categoryRef", command.categoryRef().toString());
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            generation(scope.dataNodeId().toString(), scope.brandRef());
        }
        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "createOperationsCatalogItem",
                request);
        if (replay != null) return catalogItemCommandReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            ObjectNode result =
                    createItem(scope.dataNodeId().toString(), scope.brandRef(), context.requestId(), request);
            saveTypedReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    idempotencyKey,
                    "createOperationsCatalogItem",
                    request,
                    result);
            return catalogItemCommandReadback(result);
        }
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CatalogItemCommandReadback transitionCatalogItemStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogItemStatus");
        ObjectNode request = mapper.createObjectNode()
                .put("itemCode", command.itemCode())
                .put("expectedVersion", command.expectedVersion())
                .put("targetStatus", command.targetStatus());
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            recheckTypedItemReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    command.itemCode(),
                    command.expectedVersion(),
                    command.targetStatus());
        }
        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "transitionOperationsCatalogItemStatus",
                request);
        if (replay != null) return catalogItemCommandReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            ObjectNode result = transitionItem(
                    context, scope.dataNodeId().toString(), scope.brandRef(), context.requestId(), request);
            saveTypedReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    idempotencyKey,
                    "transitionOperationsCatalogItemStatus",
                    request,
                    result);
            return catalogItemCommandReadback(result);
        }
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback transitionCatalogItemStatuses(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, BATCH_STATUS_OPERATION_ID);
        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> items = validateBatchStatusCommand(command);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (receiptKey.isEmpty()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        }
        CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand normalized =
                new CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand(command.targetStatus(), items);
        ObjectNode canonicalRequest = batchStatusRequest(normalized);
        if (transactions == null) {
            return executeBatchStatusWithReceipt(context, scope, normalized, canonicalRequest, receiptKey);
        }
        TransactionTemplate receiptTransaction = new TransactionTemplate(transactions);
        return receiptTransaction.execute(
                status -> executeBatchStatusWithReceipt(context, scope, normalized, canonicalRequest, receiptKey));
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback executeBatchStatusWithReceipt(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogAuthorizationScope scope,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand command,
            ObjectNode canonicalRequest,
            String receiptKey) {
        String dataNodeRef = scope.dataNodeId().toString();
        String brandRef = scope.brandRef();
        lockBatchStatusReceipt(dataNodeRef, receiptKey);
        ObjectNode scopedRequest = receiptRequest(canonicalRequest, brandRef);
        JsonNode replay = replay(dataNodeRef, receiptKey, BATCH_STATUS_OPERATION_ID, scopedRequest);
        if (replay != null) return batchStatusReadback(replay);

        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionResult> results = command.items().stream()
                .map(item -> executeBatchStatusItem(context, dataNodeRef, brandRef, command.targetStatus(), item))
                .toList();
        ObjectNode response = batchStatusResponse(context.requestId(), results);
        saveReceipt(dataNodeRef, receiptKey, BATCH_STATUS_OPERATION_ID, scopedRequest, response);
        return batchStatusReadback(response);
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionResult executeBatchStatusItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item) {
        try {
            if (transactions == null) {
                return executeBatchStatusItemInTransaction(context, dataNodeRef, brandRef, targetStatus, item);
            }
            TransactionTemplate itemTransaction = new TransactionTemplate(transactions);
            itemTransaction.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);
            return itemTransaction.execute(
                    status -> executeBatchStatusItemInTransaction(context, dataNodeRef, brandRef, targetStatus, item));
        } catch (RuntimeException failure) {
            CatalogOwnerApi.Problem problem = findCatalogProblem(failure);
            return new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(
                    item.itemRef(), false, problem == null ? "RESULT_UNKNOWN" : problem.code(), null);
        }
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionResult executeBatchStatusItemInTransaction(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item) {
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand();
                var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            ItemRow current = requireItemByRef(dataNodeRef, brandRef, item.itemRef());
            long nextVersion = transitionItemState(
                    context,
                    dataNodeRef,
                    brandRef,
                    context.requestId(),
                    current,
                    item.expectedVersion(),
                    targetStatus,
                    true);
            return new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(item.itemRef(), true, null, nextVersion);
        }
    }

    private List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> validateBatchStatusCommand(
            CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand command) {
        if (command == null
                || command.targetStatus() == null
                || !CatalogOwnerTypes.STATUSES.contains(command.targetStatus())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 400, "targetStatus is not supported");
        }
        if (command.items() == null
                || command.items().isEmpty()
                || command.items().size() > CATALOG_ITEM_BATCH_LIMIT) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 400, "items must contain between 1 and 100 entries");
        }
        Set<UUID> seen = new LinkedHashSet<>();
        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> normalized = new ArrayList<>();
        for (CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item : command.items()) {
            if (item == null || item.itemRef() == null || item.expectedVersion() < 1L) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 400, "items must contain itemRef and expectedVersion");
            }
            if (!seen.add(item.itemRef())) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 400, "items must not contain duplicate itemRef");
            }
            normalized.add(item);
        }
        return List.copyOf(normalized);
    }

    private ObjectNode batchStatusRequest(CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetStatus", command.targetStatus());
        ArrayNode items = request.putArray("items");
        command.items().stream()
                .sorted(java.util.Comparator.comparing((CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item) ->
                                item.itemRef().toString())
                        .thenComparingLong(CatalogOwnerApi.CatalogItemBatchStatusTransitionItem::expectedVersion))
                .forEach(item -> items.addObject()
                        .put("itemRef", item.itemRef().toString())
                        .put("expectedVersion", item.expectedVersion()));
        return request;
    }

    private ObjectNode batchStatusResponse(
            String requestId, List<CatalogOwnerApi.CatalogItemBatchStatusTransitionResult> results) {
        ObjectNode response = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ArrayNode resultArray = response.putArray("results");
        results.forEach(result -> {
            ObjectNode item = resultArray
                    .addObject()
                    .put("itemRef", result.itemRef().toString())
                    .put("ok", result.ok());
            if (result.failureCode() == null) item.putNull("failureCode");
            else item.put("failureCode", result.failureCode());
            if (result.version() == null) item.putNull("version");
            else item.put("version", result.version());
        });
        return response;
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback batchStatusReadback(JsonNode response) {
        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionResult> results = new ArrayList<>();
        for (JsonNode item : response.path("results")) {
            UUID itemRef;
            try {
                itemRef = UUID.fromString(item.path("itemRef").asText());
            } catch (IllegalArgumentException invalid) {
                {
                    throw new CatalogOwnerApi.Problem(
                            ("RESULT_UNKNOWN"),
                            (500),
                            ("批量状态回执中的 itemRef 无效"),
                            /* format-wrap */
                            (invalid));
                }
            }
            String failureCode = item.path("failureCode").isNull()
                            || item.path("failureCode").isMissingNode()
                    ? null
                    : item.path("failureCode").asText();
            Long version = item.path("version").isIntegralNumber()
                    ? item.path("version").asLong()
                    : null;
            results.add(new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(
                    itemRef, item.path("ok").asBoolean(), failureCode, version));
        }
        return new CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback(
                response.path("revision").asText(), response.path("requestId").asText(), List.copyOf(results));
    }

    private void lockBatchStatusReceipt(String dataNodeRef, String receiptKey) {
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))",
                dataNodeRef,
                receiptKey);
    }

    private CatalogOwnerApi.Problem findCatalogProblem(Throwable failure) {
        Throwable cursor = failure;
        while (cursor != null) {
            if (cursor instanceof CatalogOwnerApi.Problem problem) return problem;
            cursor = cursor.getCause();
        }
        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public UUID resolveCatalogItemRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemCode) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogItemStatus");
        return requireItem(scope.dataNodeId().toString(), scope.brandRef(), itemCode)
                .ref();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean catalogItemReferencedByOtherItems(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID itemRef) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogItemStatus");
        if (itemRef == null)
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef is required");
        return itemReferencedByOtherItems(scope.dataNodeId().toString(), scope.brandRef(), itemRef);
    }

    /**
     * Named owner boundary for the whole save; free request fields stay canonical text until this owner validates them.
     */
    @Override
    @Transactional
    public CatalogOwnerApi.CatalogItemSaveReadback saveCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CatalogItemSaveCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request;
        try {
            JsonNode parsed = mapper.readTree(command.canonicalRequestJson());
            if (!parsed.isObject()) throw new IllegalArgumentException("request must be object");
            request = (ObjectNode) parsed;
            CatalogJsonDocumentSizePolicy.validateCatalogDraft(request);
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog save request is invalid", failure);
        }
        if (command.itemCode() == null
                || command.itemCode().isBlank()
                || !command.itemCode().equals(request.path("itemCode").asText())) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "itemCode is required and must match the save request");
        }
        return new CatalogOwnerApi.CatalogItemSaveReadback(canonicalJson(executeWrite(
                context,
                "saveOperationsCatalogItem",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey)));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.TemporaryPromotionPreflightReadback preflightTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionPreflightCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                typedCommandScope(context, "preflightOperationsTemporaryCatalogItemPromotion");
        ObjectNode request = temporaryPromotionRequest(
                command.itemCode(),
                command.formalCode(),
                command.shapeKey(),
                command.name(),
                command.shortName(),
                command.materialRole(),
                command.expectedSourceVersion(),
                null,
                null);
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            recheckTypedItemReceipt(scope.dataNodeId().toString(), scope.brandRef(), command.itemCode(), null, null);
        }
        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "preflightOperationsTemporaryCatalogItemPromotion",
                request);
        if (replay != null) return temporaryPromotionPreflightReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            ObjectNode result =
                    promotionPreflight(scope.dataNodeId().toString(), scope.brandRef(), context.requestId(), request);
            saveTypedReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    idempotencyKey,
                    "preflightOperationsTemporaryCatalogItemPromotion",
                    request,
                    result);
            return temporaryPromotionPreflightReadback(result);
        }
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionExecuteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "executeOperationsTemporaryCatalogItemPromotion");
        ObjectNode request = temporaryPromotionRequest(
                command.itemCode(),
                command.formalCode(),
                command.shapeKey(),
                command.name(),
                command.shortName(),
                command.materialRole(),
                command.expectedSourceVersion(),
                command.expectedVersion(),
                command.preflightDigest());
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            recheckTypedItemReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    command.itemCode(),
                    command.expectedVersion(),
                    null);
        }
        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "executeOperationsTemporaryCatalogItemPromotion",
                request);
        if (replay != null) return catalogItemCommandReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            ObjectNode result =
                    promotionExecute(scope.dataNodeId().toString(), scope.brandRef(), context.requestId(), request);
            saveTypedReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    idempotencyKey,
                    "executeOperationsTemporaryCatalogItemPromotion",
                    request,
                    result);
            return catalogItemCommandReadback(result);
        }
    }

    private ObjectNode temporaryPromotionRequest(
            String itemCode,
            String formalCode,
            String shapeKey,
            String name,
            String shortName,
            String materialRole,
            long expectedSourceVersion,
            Long expectedVersion,
            String preflightDigest) {
        ObjectNode request = mapper.createObjectNode()
                .put("itemCode", itemCode)
                .put("formalCode", formalCode)
                .put("shapeKey", shapeKey)
                .put("name", name)
                .put("expectedSourceVersion", expectedSourceVersion);
        if (shortName != null) request.put("shortName", shortName);
        if (materialRole != null) request.put("materialRole", materialRole);
        if (expectedVersion != null) request.put("expectedVersion", expectedVersion);
        if (preflightDigest != null) request.put("preflightDigest", preflightDigest);
        return request;
    }

    private JsonNode requiredCanonicalObject(String canonicalJson, String field) {
        CatalogJsonDocumentSizePolicy.requireWithin(field, canonicalJson);
        try {
            JsonNode value = mapper.readTree(canonicalJson);
            if (value == null || !value.isObject()) throw new IllegalArgumentException();
            return value;
        } catch (Exception invalid) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, field + " must be a canonical JSON object", invalid);
        }
    }

    private void recheckTypedItemReceipt(
            String scope, String brand, String itemCode, Long expectedVersion, String targetStatus) {
        ItemRow current = requireItem(scope, brand, itemCode);
        if (expectedVersion != null
                && current.version() != expectedVersion
                && current.version() != expectedVersion + 1L) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        if ("VOIDED".equals(current.status()) && !"VOIDED".equals(targetStatus)) {
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 422, "已作废商品不可修改");
        }
    }

    private JsonNode replayTyped(
            String dataNodeRef, String brandRef, String idempotencyKey, String operationId, ObjectNode request) {
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        return receiptKey.isEmpty()
                ? null
                : replay(dataNodeRef, receiptKey, operationId, receiptRequest(request, brandRef));
    }

    private void saveTypedReceipt(
            String dataNodeRef,
            String brandRef,
            String idempotencyKey,
            String operationId,
            ObjectNode request,
            JsonNode response) {
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isEmpty())
            saveReceipt(dataNodeRef, receiptKey, operationId, receiptRequest(request, brandRef), response);
    }

    private CatalogOwnerApi.CatalogItemCommandReadback catalogItemCommandReadback(JsonNode response) {
        JsonNode value = response.path("result");
        List<CatalogOwnerApi.CatalogItemOwnerReadback> ownerReadbacks = new ArrayList<>();
        for (JsonNode owner : value.path("ownerReadbacks")) {
            ownerReadbacks.add(new CatalogOwnerApi.CatalogItemOwnerReadback(
                    owner.path("owner").asText(),
                    owner.path("status").asText(),
                    owner.path("version").asLong()));
        }
        JsonNode availability = value.path("actionAvailability");
        return new CatalogOwnerApi.CatalogItemCommandReadback(
                value.path("operation").asText(),
                value.path("resourceRef").asText(),
                value.path("status").asText(),
                value.path("version").asLong(),
                List.copyOf(ownerReadbacks),
                new CatalogOwnerApi.CatalogItemActionAvailability(
                        availability.path("canEdit").asBoolean(),
                        availability.path("canEnable").asBoolean(),
                        availability.path("canDisable").asBoolean()));
    }

    private CatalogOwnerApi.TemporaryPromotionPreflightReadback temporaryPromotionPreflightReadback(JsonNode response) {
        JsonNode data = response.path("data");
        JsonNode item = data.path("item");
        JsonNode proposed = data.path("proposed");
        List<CatalogOwnerApi.TemporaryPromotionChange> changes = new ArrayList<>();
        for (JsonNode change : data.path("changes"))
            changes.add(new CatalogOwnerApi.TemporaryPromotionChange(
                    change.path("field").asText(), nullableText(change, "before"), nullableText(change, "after")));
        return new CatalogOwnerApi.TemporaryPromotionPreflightReadback(
                new CatalogOwnerApi.TemporaryPromotionItem(
                        item.path("code").asText(),
                        item.path("name").asText(),
                        item.path("shapeKey").asText()),
                new CatalogOwnerApi.TemporaryPromotionProposed(
                        proposed.path("code").asText(),
                        proposed.path("name").asText(),
                        proposed.path("shapeKey").asText(),
                        nullableText(proposed, "materialRole")),
                data.path("source").asText(),
                data.path("sourceVersion").asLong(),
                data.path("formalCodeAvailable").asBoolean(),
                textValues(data.path("requiredFields")),
                textValues(data.path("blockedReasons")),
                List.copyOf(changes),
                data.path("preflightDigest").asText(),
                data.path("canPromote").asBoolean());
    }

    private static String nullableText(JsonNode object, String field) {
        return object.path(field).isNull() || object.path(field).isMissingNode()
                ? null
                : object.path(field).asText();
    }

    private static UUID nullableUuid(JsonNode object, String field) {
        String value = nullableText(object, field);
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

    private CatalogAuthorizationScope typedCommandScope(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String operationId) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        if (!operationId.equals(context.operationToken().operationId())) {
            throw new CatalogOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "catalog command token does not match owner command");
        }
        return scope;
    }

    private static void putNullableUuid(ObjectNode target, String field, UUID value) {
        if (value == null) target.putNull(field);
        else target.put(field, value.toString());
    }

    private void putNullableUnitSnapshot(ObjectNode target, String field, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) target.putNull(field);
        else target.set(field, mapper.valueToTree(snapshot));
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(
            java.sql.ResultSet rows, int refIndex, int codeIndex, int nameIndex, int dimensionIndex, int precisionIndex)
            throws java.sql.SQLException {
        UUID ref = rows.getObject(refIndex, UUID.class);
        if (ref == null) return null;
        return new InventoryOwnerApi.UnitSnapshot(
                ref,
                rows.getString(codeIndex),
                rows.getString(nameIndex),
                rows.getString(dimensionIndex),
                rows.getInt(precisionIndex));
    }

    private ObjectNode dictionaryRequest(
            String dictionaryKind,
            String codeField,
            String code,
            Long expectedVersion,
            String name,
            String targetStatus) {
        ObjectNode request =
                mapper.createObjectNode().put("dictionaryKind", dictionaryKind).put(codeField, code);
        if (expectedVersion != null) request.put("expectedVersion", expectedVersion);
        if (name != null) request.put("name", name);
        if (targetStatus != null) request.put("targetStatus", targetStatus);
        return request;
    }

    private CatalogOwnerApi.CategoryReadback categoryReadback(String scope, String brand, UUID categoryRef) {
        CategoryRow category = category(scope, brand, categoryRef);
        List<UUID> subtree = categorySubtreeRefs(scope, brand, categoryRef);
        List<String> blocking = categoryReferencedItems(scope, brand, subtree);
        return new CatalogOwnerApi.CategoryReadback(
                category.ref(),
                category.code(),
                category.name(),
                category.parentCategoryRef(),
                category.version(),
                category.displayOrder(),
                new CatalogOwnerApi.CategoryDeletionAvailability(
                        blocking.isEmpty(), subtree.size(), blocking.size(), blocking));
    }

    private CatalogOwnerApi.DictionaryCommandReadback dictionaryCommandReadback(JsonNode response) {
        JsonNode result = response.path("result");
        return new CatalogOwnerApi.DictionaryCommandReadback(
                nullableUuid(result, "entryRef"),
                result.path("dictionaryKind").asText(),
                result.path("code").asText(),
                result.path("name").asText(),
                result.path("status").asText(),
                nullableUuid(result, "parentEntryRef"),
                result.path("version").asLong());
    }

    private CatalogOwnerApi.DictionaryViewReadback dictionaryViewReadback(JsonNode response) {
        JsonNode data = response.path("data");
        List<CatalogOwnerApi.DictionaryEntryView> entries = new ArrayList<>();
        for (JsonNode entry : data.path("entries")) {
            JsonNode availability = entry.path("voidAvailability");
            List<CatalogOwnerApi.DictionaryBlockingReference> blocking = new ArrayList<>();
            for (JsonNode reference : availability.path("blockingReferences")) {
                blocking.add(new CatalogOwnerApi.DictionaryBlockingReference(
                        reference.path("referenceKind").asText(),
                        reference.path("referenceRef").asText()));
            }
            List<CatalogOwnerApi.DictionaryDependentFact> dependencies = new ArrayList<>();
            for (JsonNode dependency : availability.path("dependentFacts")) {
                dependencies.add(new CatalogOwnerApi.DictionaryDependentFact(
                        dependency.path("factKind").asText(),
                        dependency.path("factRef").asText()));
            }
            entries.add(new CatalogOwnerApi.DictionaryEntryView(
                    entry.path("entryRef").asText(),
                    entry.path("code").asText(),
                    entry.path("name").asText(),
                    entry.path("status").asText(),
                    nullableUuid(entry, "parentEntryRef"),
                    entry.path("ownerType").asText(),
                    entry.path("ownerRef").asText(),
                    entry.path("brandRef").asText(),
                    entry.path("version").asLong(),
                    entry.path("updatedAt").asLong(),
                    new CatalogOwnerApi.DictionaryVoidAvailability(
                            availability.path("canVoid").asBoolean(),
                            List.copyOf(blocking),
                            List.copyOf(dependencies))));
        }
        return new CatalogOwnerApi.DictionaryViewReadback(
                data.path("dictionaryKind").asText(),
                List.copyOf(entries),
                data.path("cursor").isNull() ? null : data.path("cursor").asText(),
                data.path("total").asLong(),
                data.path("generation").asText());
    }

    private static List<String> textValues(JsonNode values) {
        List<String> result = new ArrayList<>();
        if (values.isArray()) values.forEach(value -> result.add(value.asText()));
        return List.copyOf(result);
    }

    private JsonNode executeWrite(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        return executeWrite(null, operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey);
    }

    private JsonNode executeWrite(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        requireScope(dataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        CatalogCoordinationSnapshot coordinationSnapshot;
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            coordinationSnapshot = recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);
        }
        ObjectNode receiptRequest = receiptRequest(request, brandRef);
        if (!receiptKey.isEmpty()) {
            JsonNode replay = replay(dataNodeRef, receiptKey, operationId, receiptRequest);
            if (replay != null) return replay;
        }
        try (var command = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            JsonNode result =
                    switch (operationId) {
                        case "createOperationsCatalogItem" -> createItem(dataNodeRef, brandRef, requestId, request);
                        case "saveOperationsCatalogItem" -> saveItem(
                                commandContext, dataNodeRef, brandRef, requestId, request, coordinationSnapshot);
                        case "transitionOperationsCatalogItemStatus" -> transitionItem(
                                commandContext, dataNodeRef, brandRef, requestId, request);
                        case "createOperationsCatalogCategory" -> createCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "updateOperationsCatalogCategory" -> updateCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "moveOperationsCatalogCategory" -> moveCategory(dataNodeRef, brandRef, requestId, request);
                        case "deleteOperationsCatalogCategory" -> deleteCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "createOperationsCatalogDictionaryEntry" -> createDictionary(
                                dataNodeRef, brandRef, requestId, request);
                        case "updateOperationsCatalogDictionaryEntry" -> updateDictionary(
                                dataNodeRef, brandRef, requestId, request);
                        case "reorderOperationsCatalogDictionaryEntry" -> reorderDictionary(
                                dataNodeRef, brandRef, requestId, request);
                        case "transitionOperationsCatalogDictionaryEntryStatus" -> transitionDictionary(
                                commandContext, dataNodeRef, brandRef, requestId, request);
                        case "preflightOperationsTemporaryCatalogItemPromotion" -> promotionPreflight(
                                dataNodeRef, brandRef, requestId, request);
                        case "executeOperationsTemporaryCatalogItemPromotion" -> promotionExecute(
                                dataNodeRef, brandRef, requestId, request);
                        default -> throw new CatalogOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "catalog write operation is not registered");
                    };
            if (!receiptKey.isEmpty()) saveReceipt(dataNodeRef, receiptKey, operationId, receiptRequest, result);
            return result;
        }
    }

    /**
     * Revalidates the owner fact before receipt lookup. A fresh mutation sees the submitted version; an unchanged
     * replay sees exactly one successor version. Any later state/revision change therefore fails before a historic
     * receipt can escape.
     */
    private CatalogCoordinationSnapshot recheckWriteFactsBeforeReceipt(
            String operationId, String scope, String brand, ObjectNode request) {
        if (Set.of(
                        "saveOperationsCatalogItem",
                        "transitionOperationsCatalogItemStatus",
                        "preflightOperationsTemporaryCatalogItemPromotion",
                        "executeOperationsTemporaryCatalogItemPromotion")
                .contains(operationId)) {
            ItemRow current = requireItem(scope, brand, required(request, "itemCode"));
            long expected = "saveOperationsCatalogItem".equals(operationId)
                    ? requiredCatalogExpectedVersion(request)
                    : requiredLong(request, "expectedVersion", -1);
            if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
            }
            if ("VOIDED".equals(current.status())
                    && !"VOIDED".equals(request.path("targetStatus").asText())) {
                throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 422, "已作废商品不可修改");
            }
            return "saveOperationsCatalogItem".equals(operationId) ? new CatalogCoordinationSnapshot(current) : null;
        }
        switch (operationId) {
            case "updateOperationsCatalogCategory", "moveOperationsCatalogCategory" -> {
                CategoryRow current = lockCategory(scope, brand, UUID.fromString(required(request, "categoryRef")));
                long expected = requiredLong(request, "expectedVersion", -1);
                if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
                }
            }
            case "deleteOperationsCatalogCategory" -> {
                CategoryRow current =
                        findLockedCategory(scope, brand, UUID.fromString(required(request, "categoryRef")));
                long expected = requiredLong(request, "expectedVersion", -1);
                if (current != null
                        && expected >= 0
                        && current.version() != expected
                        && current.version() != expected + 1L) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
                }
            }
            case "updateOperationsCatalogDictionaryEntry", "transitionOperationsCatalogDictionaryEntryStatus" -> {
                String kind = requiredDictionaryKind(request);
                String code = required(request, "entryCode");
                Long version = jdbc.queryForObject(
                        "SELECT version FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                                + "dictionary_kind=? AND code=?",
                        Long.class,
                        scope,
                        brand,
                        kind,
                        code);
                long expected = requiredLong(request, "expectedVersion", -1);
                if (version == null || (expected >= 0 && version != expected && version != expected + 1L)) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "字典版本已变化");
                }
            }
            case "reorderOperationsCatalogDictionaryEntry" -> dictionaryGeneration(
                    scope, brand, requiredDictionaryKind(request));
            case "createOperationsCatalogItem",
                    "createOperationsCatalogCategory",
                    "createOperationsCatalogDictionaryEntry" -> generation(scope, brand);
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "catalog write operation is not registered");
        }
        return null;
    }

    @Override
    @Transactional
    public JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        if (scope.copySourcePolicy() == WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE) {
            return copyLocal(
                    context,
                    context.operationToken().operationId(),
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    request,
                    context.requestId(),
                    idempotencyKey);
        }
        return executeCopy(
                context.operationToken().operationId(),
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        String sourceDataNodeRef = copySourceDataNodeRef(scope);
        String targetDataNodeRef = scope.dataNodeId().toString();
        if (scope.copySourcePolicy() == WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE) {
            return localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request);
        }
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), request);
        return copyPreflight(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), plan);
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogOwnerApi.CopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        ObjectNode result = localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request);
        ObjectNode envelope = envelope(context.requestId(), result);
        return new CatalogOwnerApi.CopyPreflightReadback(
                envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        ObjectNode catalogRepreflight = localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                catalogRepreflight.path("compatibilityResults"), command.compatibilityDispositions());
        return copyExecutionReadback(copyLocal(
                context,
                "executeOperationsLocalCatalogCopy",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey));
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogOwnerApi.CopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", command.targetDataNodeRef());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        JsonNode result = preflightCopy(context, request);
        ObjectNode envelope = envelope(context.requestId(), result);
        return new CatalogOwnerApi.CopyPreflightReadback(
                envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("targetDataNodeRef", command.targetDataNodeRef())
                .put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        CatalogCopyPlan plan =
                catalogCopyPlan(copySourceDataNodeRef(scope), scope.dataNodeId().toString(), scope.brandRef(), request);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                copyPreflight(copySourceDataNodeRef(scope), scope.dataNodeId().toString(), scope.brandRef(), plan)
                        .path("compatibilityResults"),
                command.compatibilityDispositions());
        return copyExecutionReadback(copy(context, request, idempotencyKey));
    }

    private void applyLocalCopyReferencePlan(ObjectNode request, String canonicalPlan) {
        if (canonicalPlan == null || canonicalPlan.isBlank()) return;
        try {
            JsonNode plan = mapper.readTree(canonicalPlan);
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field : List.of("closureItemRefs", "productionTagRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "copy reference plan is invalid", failure);
        }
    }

    private String canonicalLocalCopyJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException("catalog owner could not encode copy readback", failure);
        }
    }

    /** Converts the owner result before it leaves this owner boundary. */
    private CatalogOwnerApi.CopyExecutionReadback copyExecutionReadback(JsonNode result) {
        JsonNode data = requiredCopyData(result, "catalog");
        return new CatalogOwnerApi.CopyExecutionReadback(
                requiredCopyText(data, "preflightDigest", "catalog"),
                copyObjects(data, "created"),
                copyObjects(data, "reused"),
                copySkipped(data),
                copyReferenceMappings(data, "referenceMappings"),
                copyTargetVersions(data),
                copyOwnerReadbacks(data));
    }

    private JsonNode requiredCopyData(JsonNode result, String owner) {
        JsonNode data = result == null ? null : result.path("data");
        if (data == null || !data.isObject()) throw copyReadbackProblem(owner, "data");
        return data;
    }

    private String requiredCopyText(JsonNode data, String field, String owner) {
        JsonNode value = data.path(field);
        if (!value.isTextual() || value.asText().isBlank()) throw copyReadbackProblem(owner, field);
        return value.asText();
    }

    private List<CatalogOwnerApi.CopyObjectReadback> copyObjects(JsonNode data, String field) {
        JsonNode values = data.path(field);
        if (!values.isArray()) throw copyReadbackProblem("catalog", field);
        List<CatalogOwnerApi.CopyObjectReadback> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("objectType").asText().isBlank()
                    || value.path("code").asText().isBlank()) throw copyReadbackProblem("catalog", field);
            result.add(new CatalogOwnerApi.CopyObjectReadback(
                    value.path("objectType").asText(), value.path("code").asText()));
        }
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.CopySkippedReadback> copySkipped(JsonNode data) {
        JsonNode values = data.path("skipped");
        if (!values.isArray()) throw copyReadbackProblem("catalog", "skipped");
        List<CatalogOwnerApi.CopySkippedReadback> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("section").asText().isBlank()
                    || value.path("reasonCode").asText().isBlank()) {
                throw copyReadbackProblem("catalog", "skipped");
            }
            result.add(new CatalogOwnerApi.CopySkippedReadback(
                    value.path("section").asText(), value.path("reasonCode").asText()));
        }
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.CopyReferenceMapping> copyReferenceMappings(JsonNode data, String field) {
        JsonNode values = data.path(field);
        if (!values.isArray()) throw copyReadbackProblem("catalog", field);
        List<CatalogOwnerApi.CopyReferenceMapping> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("objectType").asText().isBlank()
                    || value.path("sourceRef").asText().isBlank()
                    || value.path("targetRef").asText().isBlank()) throw copyReadbackProblem("catalog", field);
            result.add(new CatalogOwnerApi.CopyReferenceMapping(
                    value.path("objectType").asText(),
                    value.path("sourceRef").asText(),
                    value.path("targetRef").asText(),
                    nullableCopyText(value, "targetCode"),
                    nullableCopyText(value, "targetSkuCode"),
                    nullableCopyText(value, "targetOptionValueCode")));
        }
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.CopyTargetVersion> copyTargetVersions(JsonNode data) {
        JsonNode values = data.path("targetVersions");
        if (!values.isArray()) throw copyReadbackProblem("catalog", "targetVersions");
        List<CatalogOwnerApi.CopyTargetVersion> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("targetRef").asText().isBlank()
                    || !value.path("version").canConvertToLong())
                throw copyReadbackProblem("catalog", "targetVersions");
            result.add(new CatalogOwnerApi.CopyTargetVersion(
                    value.path("targetRef").asText(), value.path("version").asLong()));
        }
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.CopyOwnerReadback> copyOwnerReadbacks(JsonNode data) {
        JsonNode values = data.path("ownerReadbacks");
        if (!values.isArray()) throw copyReadbackProblem("catalog", "ownerReadbacks");
        List<CatalogOwnerApi.CopyOwnerReadback> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("owner").asText().isBlank()
                    || value.path("status").asText().isBlank()
                    || !value.path("version").canConvertToLong())
                throw copyReadbackProblem("catalog", "ownerReadbacks");
            result.add(new CatalogOwnerApi.CopyOwnerReadback(
                    value.path("owner").asText(),
                    value.path("status").asText(),
                    value.path("version").asLong()));
        }
        return List.copyOf(result);
    }

    private String nullableCopyText(JsonNode value, String field) {
        return value.hasNonNull(field) ? value.path(field).asText() : null;
    }

    private CatalogOwnerApi.Problem copyReadbackProblem(String owner, String field) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, owner + " copy readback is missing: " + field);
    }

    private JsonNode executeCopy(
            String operationId,
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        if (operationId.contains("Local"))
            return copyLocal(null, operationId, sourceDataNodeRef, brandRef, request, requestId, idempotencyKey);
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, brandRef, request);
        List<String> selected = plan.selected();
        CatalogClosure graph = plan.graph();
        List<ItemRow> source = graph.items();
        long sourceVersion = plan.sourceVersion();
        long targetVersion = plan.targetVersion();
        String currentDigest = plan.digest();
        CopyCompatibility compatibility =
                validateCopyCompatibility(sourceDataNodeRef, targetDataNodeRef, brandRef, graph, request, true);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                copyPreflight(sourceDataNodeRef, targetDataNodeRef, brandRef, plan)
                        .path("compatibilityResults"),
                request.path("compatibilityDispositions"));
        assertNoOwnerReferenceLeak(graph, compatibility.mapping(), sourceDataNodeRef);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay =
                    replay(targetDataNodeRef, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef));
            if (replay != null) return replayCopyIfCurrent(replay, currentDigest);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            long expectedSource = requiredLong(request, "expectedSourceVersion", -1);
            long expectedTarget = requiredLong(request, "expectedTargetVersion", -1);
            String submittedDigest = required(request, "preflightDigest");
            if (expectedSource != sourceVersion
                    || expectedTarget != targetVersion
                    || !submittedDigest.equals(currentDigest)) {
                {
                    throw new CatalogOwnerApi.Problem(
                            ("STALE_COPY_PREFLIGHT"),
                            (409),
                            /* format-wrap */
                            ("复制预检已失效，请重新预检"));
                }
            }
            lockCatalogAssetRefs(
                    source.stream().map(row -> json(row.sectionsJson())).toArray(JsonNode[]::new));
            ArrayNode created = mapper.createArrayNode();
            ArrayNode reused = mapper.createArrayNode();
            List<CopyCategory> categories = new ArrayList<>();
            for (CategoryRow row : graph.categories()) {
                UUID targetRef = UUID.fromString(compatibility
                        .mapping()
                        .get(new ReferenceKey("CATALOG_CATEGORY", row.ref().toString())));
                UUID targetParentRef = row.parentCategoryRef() == null
                        ? null
                        : UUID.fromString(compatibility
                                .mapping()
                                .get(new ReferenceKey(
                                        "CATALOG_CATEGORY",
                                        row.parentCategoryRef().toString())));
                categories.add(new CopyCategory(targetRef, targetDataNodeRef, brandRef, row, targetParentRef));
            }
            List<Object[]> categoryRows = categories.stream()
                    .map(value -> new Object[] {
                        value.targetRef(),
                        value.dataNodeRef(),
                        value.brandRef(),
                        value.source().code(),
                        value.source().name(),
                        value.source().parentCode(),
                        value.targetParentRef(),
                        value.source().status(),
                        value.source().displayOrder(),
                        1L,
                        now(),
                        now()
                    })
                    .toList();
            int[] categoryChanges = categoryRows.isEmpty()
                    ? new int[0]
                    : jdbc.batchUpdate(
                            "INSERT INTO catalog.catalog_category "
                                    + "(category_ref,data_node_ref,brand_ref,code,name,parent_code,parent_category_ref,"
                                    + "stat"
                                    + "us,display_order,version,created_at_epoch_millis,updated_at_epoch_millis) "
                                    + "VALUES "
                                    + "(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (data_node_ref,brand_ref,code) DO NOTHING",
                            categoryRows);
            for (int index = 0; index < categories.size(); index++)
                (categoryChanges[index] == 1 ? created : reused)
                        .addObject()
                        .put("objectType", "CATALOG_CATEGORY")
                        .put("code", categories.get(index).source().code());
            List<CopyDictionary> dictionaries = new ArrayList<>();
            for (DictionaryRow row : graph.dictionaries()) {
                UUID targetRef = UUID.fromString(compatibility
                        .mapping()
                        .get(new ReferenceKey(row.objectType(), row.ref().toString())));
                UUID targetParentRef = row.parentEntryRef() == null
                        ? null
                        : UUID.fromString(requiredMappedReference(
                                compatibility.mapping(),
                                new ReferenceKey(
                                        "SKU_ATTRIBUTE", row.parentEntryRef().toString())));
                dictionaries.add(new CopyDictionary(targetRef, targetDataNodeRef, brandRef, row, targetParentRef));
            }
            List<Object[]> dictionaryRows = dictionaries.stream()
                    .map(value -> new Object[] {
                        value.targetRef(),
                        value.dataNodeRef(),
                        value.brandRef(),
                        value.source().dictionaryKind(),
                        value.source().code(),
                        value.source().name(),
                        value.source().status(),
                        value.targetParentRef(),
                        value.source().displayOrder(),
                        1L,
                        now(),
                        now()
                    })
                    .toList();
            int[] dictionaryChanges = dictionaryRows.isEmpty()
                    ? new int[0]
                    : jdbc.batchUpdate(
                            "INSERT INTO catalog.dictionary_entry "
                                    + "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,status,parent_entry"
                                    + "_ref"
                                    + ",display_order,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES "
                                    + "(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT "
                                    + "(data_node_ref,brand_ref,dictionary_kind,code) WHERE status <> 'VOIDED' DO "
                                    + "NOTHING",
                            dictionaryRows);
            for (int index = 0; index < dictionaries.size(); index++)
                (dictionaryChanges[index] == 1 ? created : reused)
                        .addObject()
                        .put("objectType", dictionaries.get(index).source().objectType())
                        .put("code", dictionaries.get(index).source().code());
            List<UnitCopy> units = graph.units().stream()
                    .map(row -> new UnitCopy(
                            UUID.fromString(requiredMappedReference(
                                    compatibility.mapping(),
                                    new ReferenceKey("CATALOG_UNIT", row.ref().toString()))),
                            targetDataNodeRef,
                            brandRef,
                            row))
                    .toList();
            int[] unitChanges = copyUnitDefinitions(units);
            for (int index = 0; index < units.size(); index++)
                (unitChanges[index] == 1 ? created : reused)
                        .addObject()
                        .put("objectType", "CATALOG_UNIT")
                        .put("code", units.get(index).source().code());
            List<PreparedCopyItem> items = new ArrayList<>();
            for (ItemRow row : source) {
                ObjectNode rewrittenSections =
                        (ObjectNode) rewriteReferences(json(row.sectionsJson()), compatibility.mapping());
                ArrayNode copiedSkus = normalizeSkuFacts(rewrittenSections);
                ArrayNode copiedCategoryRefs = categoryRefs(rewrittenSections);
                ArrayNode copiedCompositeGroups = compositeGroups(rewrittenSections);
                ArrayNode copiedSkuVariantDimensions =
                        submittedSkuVariantDimensions(rewrittenSections.path("skuVariantDimensions"));
                validateShapeOwnedSections(shapeRule(row.shapeKey()), rewrittenSections.path("inventoryBom"));
                JsonNode copiedImages = rewrittenSections.path("images");
                JsonNode copiedProductionTagRefs = rewrittenSections.path("productionTagRefs");
                JsonNode copiedTagRefs = rewrittenSections.path("tagRefs");
                removeRelationalSectionFacts(rewrittenSections);
                UUID targetRef = UUID.fromString(compatibility
                        .mapping()
                        .get(new ReferenceKey("CATALOG_ITEM", row.ref().toString())));
                removeShortName(rewrittenSections);
                items.add(new PreparedCopyItem(
                        targetRef,
                        targetDataNodeRef,
                        brandRef,
                        sourceDataNodeRef,
                        row,
                        rewrittenSections,
                        copiedSkus,
                        copiedCategoryRefs,
                        copiedCompositeGroups,
                        copiedSkuVariantDimensions,
                        copiedImages,
                        new CatalogItemReferenceFacts.CopyValues(copiedProductionTagRefs, copiedTagRefs)));
            }
            List<Object[]> itemRows = items.stream()
                    .map(value -> new Object[] {
                        value.targetRef(),
                        value.dataNodeRef(),
                        value.brandRef(),
                        value.source().code(),
                        value.source().name(),
                        value.source().shortName(),
                        value.source().shapeKey(),
                        value.source().status(),
                        canonicalJson(value.sections()),
                        value.source().code(),
                        value.sourceScopeRef(),
                        now(),
                        now()
                    })
                    .toList();
            int[] itemChanges = itemRows.isEmpty()
                    ? new int[0]
                    : jdbc.batchUpdate(
                            "INSERT INTO catalog.catalog_item (item_ref, data_node_ref, brand_ref, code, name, "
                                    + "short_name, shape_key, status, sections, source_item_code, "
                                    + "source_scope_ref, version, created_at_epoch_millis, updated_at_epoch_millis) "
                                    + "VALUES "
                                    + "(?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), ?, ?, 1, ?, ?) ON "
                                    + "CONFLICT DO NOTHING",
                            itemRows);
            Map<UUID, ArrayNode> copiedSkusByItem = new LinkedHashMap<>();
            Map<UUID, ArrayNode> copiedCategoriesByItem = new LinkedHashMap<>();
            Map<UUID, ArrayNode> copiedCompositeGroupsByItem = new LinkedHashMap<>();
            Map<UUID, ArrayNode> copiedSkuVariantDimensionsByItem = new LinkedHashMap<>();
            Map<UUID, JsonNode> copiedImagesByItem = new LinkedHashMap<>();
            Map<UUID, CatalogItemReferenceFacts.CopyValues> copiedReferencesByItem = new LinkedHashMap<>();
            Map<UUID, UUID> copiedDefinitionItemsBySource = new LinkedHashMap<>();
            for (int index = 0; index < items.size(); index++) {
                PreparedCopyItem item = items.get(index);
                boolean changed = itemChanges[index] == 1;
                (changed ? created : reused)
                        .addObject()
                        .put("objectType", "CATALOG_ITEM")
                        .put("code", item.source().code());
                if (!changed) continue;
                copiedDefinitionItemsBySource.put(item.source().ref(), item.targetRef());
                copiedSkusByItem.put(item.targetRef(), item.skus());
                copiedCategoriesByItem.put(item.targetRef(), item.categoryRefs());
                copiedCompositeGroupsByItem.put(item.targetRef(), item.compositeGroups());
                copiedSkuVariantDimensionsByItem.put(item.targetRef(), item.skuVariantDimensions());
                copiedImagesByItem.put(item.targetRef(), item.images());
                copiedReferencesByItem.put(item.targetRef(), item.references());
            }
            skuFacts.insertForCopy(copiedSkusByItem);
            for (int index = 0; index < items.size(); index++) {
                PreparedCopyItem item = items.get(index);
                if (itemChanges[index] == 1)
                    writeCopiedEffectiveUnitFacts(
                            targetDataNodeRef, brandRef, item.targetRef(), item.sections(), item.skus());
            }
            skuMediaFacts.insertForCopy(copiedSkusByItem);
            categoryFacts.insertForCopy(copiedCategoriesByItem);
            itemMediaFacts.insertForCopy(copiedImagesByItem);
            itemReferenceFacts.insertForCopy(copiedReferencesByItem);
            compositeFacts.insertForCopy(copiedCompositeGroupsByItem);
            skuVariantAxisFacts.insertForCopy(copiedSkuVariantDimensionsByItem);
            itemDefinitionFacts.copyAttributeAssignments(
                    sourceDataNodeRef, brandRef, targetDataNodeRef, brandRef, copiedDefinitionItemsBySource, now());
            CatalogItemDefinitionFacts.OrderOptionCopyPlan orderOptionPlan = itemDefinitionFacts.planOrderOptionCopy(
                    sourceDataNodeRef,
                    brandRef,
                    targetDataNodeRef,
                    brandRef,
                    graph.orderOptionDefinitions(),
                    uuidMappings(compatibility.mapping(), "CATALOG_ITEM"),
                    uuidMappings(compatibility.mapping(), "CATALOG_ORDER_OPTION_DEFINITION"),
                    uuidMappings(compatibility.mapping(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE"));
            itemDefinitionFacts.copyOrderOptionConfigs(
                    sourceDataNodeRef,
                    brandRef,
                    targetDataNodeRef,
                    brandRef,
                    graph.orderOptionDefinitions(),
                    copiedDefinitionItemsBySource,
                    uuidMappings(compatibility.mapping(), "CATALOG_ITEM"),
                    uuidMappings(suppliedReferenceMappings(request), "STOCK_TARGET"),
                    orderOptionPlan,
                    unitSnapshotMappings(compatibility.mapping(), graph.units()),
                    now());
            verifyTargetNoOwnerReferenceLeak(targetDataNodeRef, brandRef, graph, sourceDataNodeRef);
            ObjectNode data = mapper.createObjectNode().put("preflightDigest", submittedDigest);
            data.set("created", created);
            data.set("reused", reused);
            data.putArray("skipped");
            ArrayNode mappings = data.putArray("mappings");
            compatibility.mapping().forEach((from, to) -> mappings.addObject()
                    .put("sourceRef", from.ref())
                    .put("targetRef", to)
                    .put("referenceKind", from.objectType()));
            ArrayNode referenceMappings = data.putArray("referenceMappings");
            Map<String, ItemRow> targetItemsByRef = itemsByRef(
                    targetDataNodeRef,
                    brandRef,
                    source.stream().map(ItemRow::code).toList());
            compatibility
                    .mapping()
                    .forEach((from, to) -> referenceMappings.add(
                            "PRODUCTION_TAG".equals(from.objectType())
                                    ? productionReferenceMappingRow(request, from, to)
                                    : referenceMappingRow(from, to, graph, targetItemsByRef)));
            ArrayNode targetVersions = data.putArray("targetVersions");
            loadItems(
                            targetDataNodeRef,
                            brandRef,
                            source.stream().map(ItemRow::code).toList())
                    .forEach(row -> targetVersions
                            .addObject()
                            .put("targetRef", row.ref().toString())
                            .put("version", row.version()));
            ArrayNode ownerReadbacks = data.putArray("ownerReadbacks");
            ownerReadbacks
                    .addObject()
                    .put("owner", "catalog")
                    .put("status", "COMMITTED")
                    .put("version", 1);
            ObjectNode result = envelope(requestId, data);
            long postTargetVersion = targetScopeVersion(targetDataNodeRef, brandRef, request, graph);
            result.put(
                    "receiptObjectFingerprint",
                    copyDigest(
                            sourceDataNodeRef,
                            targetDataNodeRef,
                            brandRef,
                            selected,
                            graph,
                            sourceVersion,
                            postTargetVersion));
            if (idempotencyKey != null && !idempotencyKey.isBlank())
                saveReceipt(
                        targetDataNodeRef,
                        idempotencyKey.trim(),
                        operationId,
                        receiptRequest(request, brandRef),
                        result);
            return result;
        }
    }

    private JsonNode copyLocal(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String operationId,
            String scope,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        LocalCopyPlan plan = localCopyPlan(scope, brandRef, request);
        ItemRow source = plan.source();
        ItemRow target = plan.target();
        ArrayNode selectedSections = plan.selectedSections();
        String digest = plan.digest();
        CompatibilityCheck compatibility = plan.compatibility();
        List<UnitRow> localUnits = plan.units();
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                localCompatibilityResults(scope, brandRef, plan), request.path("compatibilityDispositions"));
        if (requiredLong(request, "expectedSourceVersion", -1) != source.version()) {
            String staleReason = "复制来源事实已变化，请重新预检";
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, staleReason);
        }
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay = replay(scope, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef));
            if (replay != null) return replayCopyIfCurrent(replay, digest);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand();
                var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            long expectedSource = requiredLong(request, "expectedSourceVersion", -1);
            long expectedTarget = requiredLong(request, "expectedTargetVersion", -1);
            boolean sourceVersionMatches = expectedSource == source.version();
            boolean targetVersionMatches = expectedTarget == target.version();
            String submittedDigest = required(request, "preflightDigest");
            boolean digestMatches = submittedDigest.equals(digest);
            if (!sourceVersionMatches || !targetVersionMatches || !digestMatches) {
                String staleReason = "复制预检已失效，请重新预检";
                throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, staleReason);
            }
            if (compatibility.blocking())
                throw new CatalogOwnerApi.Problem(compatibility.problemCode(), 422, compatibility.reason());
            ObjectNode merged = (ObjectNode) json(target.sectionsJson()).deepCopy();
            JsonNode sourceSections = json(source.sectionsJson());
            ArrayNode copiedSkus = null;
            ArrayNode copiedCompositeGroups = null;
            ArrayNode copiedSkuVariantDimensions = null;
            boolean copyBasicInfo = selectedSectionsElements(selectedSections).contains("BASIC_INFO");
            for (JsonNode section : selectedSections) {
                String key = sectionKey(section.asText());
                if ("BASIC_INFO".equals(section.asText())) {
                    // The list-facing short name is a column fact.  The local-copy
                    // update below carries it beside the JSON section payload.
                } else if ("SKU_STRUCTURE".equals(section.asText())) {
                    if (hasLocalCopySourceFacts(sourceSections, "skus", "skuVariantDimensions")) {
                        copiedSkus = clonedSkuFacts((ArrayNode) sourceSections.path("skus"));
                        merged.set("skus", copiedSkus.deepCopy());
                        copiedSkuVariantDimensions =
                                submittedSkuVariantDimensions(sourceSections.path("skuVariantDimensions"));
                        merged.set("skuVariantDimensions", copiedSkuVariantDimensions.deepCopy());
                    }
                } else if ("PACKAGE_STRUCTURE".equals(section.asText())) {
                    if (hasLocalCopySourceFacts(sourceSections, "compositeGroups")) {
                        copiedCompositeGroups = compositeGroups(sourceSections.path("compositeGroups"));
                        merged.set("compositeGroups", copiedCompositeGroups.deepCopy());
                    }
                } else if ("ORDER_OPTIONS".equals(section.asText())) {
                    // Order-option assignments are relational catalog facts.  They are copied by the
                    // owner aggregate, never by reintroducing the retired item JSON section.
                    itemDefinitionFacts.copyCurrentFactsWithinScope(scope, brandRef, source.ref(), target.ref());
                } else if (sourceSections.has(key))
                    merged.set(key, sourceSections.path(key).deepCopy());
            }
            validateShapeOwnedSections(shapeRule(target.shapeKey()), merged.path("inventoryBom"));
            if (copiedSkuVariantDimensions != null && copiedSkus != null) {
                skuVariantAxisFacts.validateRetirements(target.ref(), copiedSkuVariantDimensions, copiedSkus);
            }
            lockCatalogAssetRefs(json(source.sectionsJson()), json(target.sectionsJson()), merged);
            Set<UUID> archivedSkuRefs = copiedSkus == null ? Set.of() : skuFacts.existingRefs(target.ref());
            requireSkuRetirementUnreferenced(commandContext, archivedSkuRefs);
            ObjectNode persistedSections = merged.deepCopy();
            String copiedShortName = copyBasicInfo ? source.shortName() : target.shortName();
            removeShortName(persistedSections);
            removeRelationalSectionFacts(persistedSections);
            int changed = jdbc.update(
                    "UPDATE catalog.catalog_item SET name=?,short_name=?,sections=CAST(? AS JSONB),"
                            + "version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
                            + "brand_ref=? "
                            + "AND code=? AND version=?",
                    copyBasicInfo ? source.name() : target.name(),
                    copiedShortName,
                    canonicalJson(persistedSections),
                    now(),
                    scope,
                    brandRef,
                    target.code(),
                    target.version());
            if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "目标商品版本已变化");
            if (copiedSkus != null) {
                skuFacts.replace(target.ref(), copiedSkus, archivedSkuRefs);
                skuMediaFacts.replace(copiedSkus);
            }
            if (copyBasicInfo || copiedSkus != null) {
                ArrayNode effectiveSkus = copiedSkus;
                if (effectiveSkus == null)
                    effectiveSkus = skuFacts.readByItemRefs(List.of(target.ref()))
                            .getOrDefault(target.ref(), mapper.createArrayNode());
                writeCopiedEffectiveUnitFacts(scope, brandRef, target.ref(), merged, effectiveSkus);
            }
            if (copiedCompositeGroups != null) compositeFacts.replace(target.ref(), copiedCompositeGroups);
            if (copiedSkuVariantDimensions != null)
                skuVariantAxisFacts.replace(target.ref(), copiedSkuVariantDimensions);
            ObjectNode data = mapper.createObjectNode().put("preflightDigest", digest);
            data.putArray("created");
            data.putArray("reused")
                    .addObject()
                    .put("objectType", "CATALOG_ITEM")
                    .put("code", target.code());
            data.set("skipped", localCopySkipped(source, selectedSections));
            data.putArray("referenceMappings")
                    .addObject()
                    .put("objectType", "CATALOG_ITEM")
                    .put("sourceRef", source.ref().toString())
                    .put("targetRef", target.ref().toString())
                    .put("targetCode", target.code());
            localUnits.forEach(
                    unit -> data.withArray("referenceMappings").add(unitReferenceMappingRow(unit, unit.ref())));
            data.putArray("targetVersions")
                    .addObject()
                    .put("targetRef", target.ref().toString())
                    .put("version", target.version() + 1);
            data.putArray("ownerReadbacks")
                    .addObject()
                    .put("owner", "catalog")
                    .put("status", "COMMITTED")
                    .put("version", target.version() + 1);
            ObjectNode result = envelope(requestId, data);
            ItemRow updatedTarget = requireItem(scope, brandRef, target.code());
            result.put(
                    "receiptObjectFingerprint", localCopyDigest(source, updatedTarget, selectedSections, localUnits));
            if (idempotencyKey != null && !idempotencyKey.isBlank())
                saveReceipt(scope, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef), result);
            return result;
        }
    }

    private ObjectNode localCopyPreflight(String scope, String brandRef, ObjectNode request) {
        LocalCopyPlan plan = localCopyPlan(scope, brandRef, request);
        ItemRow source = plan.source();
        ItemRow target = plan.target();
        CompatibilityCheck compatibility = plan.compatibility();
        List<UnitRow> localUnits = plan.units();
        ObjectNode data = mapper.createObjectNode();
        data.putObject("sourceScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", scope)
                .put("brandRef", brandRef);
        data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", scope)
                .put("brandRef", brandRef);
        data.putArray("selectedItems")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", source.code())
                .put("name", source.name());
        data.putArray("closureItems")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", source.code())
                .put("name", source.name())
                .put("action", "REPLACE");
        ArrayNode closureEdges = data.putArray("closureEdges");
        localUnits.forEach(unit -> closureEdges
                .addObject()
                .put("fromRef", source.ref().toString())
                .put("toRef", unit.ref().toString())
                .put("referenceKind", "CATALOG_UNIT"));
        data.putArray("objectVersions")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", source.code())
                .put("sourceVersion", source.version())
                .put("targetVersion", target.version());
        localUnits.forEach(unit -> data.withArray("objectVersions")
                .addObject()
                .put("objectType", "CATALOG_UNIT")
                .put("code", unit.code())
                .put("sourceVersion", unit.version())
                .put("targetVersion", unit.version()));
        ArrayNode localReferenceMappings = data.putArray("referenceMappings");
        localReferenceMappings
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", source.ref().toString())
                .put("targetRef", target.ref().toString())
                .put("targetCode", target.code());
        for (UnitRow unit : localUnits) {
            localReferenceMappings.add(unitReferenceMappingRow(unit, unit.ref()));
            data.withArray("closureItems")
                    .addObject()
                    .put("objectType", "CATALOG_UNIT")
                    .put("code", unit.code())
                    .put("name", unit.name())
                    .put("action", "REUSE");
        }
        if (selectedSectionsElements(plan.selectedSections()).contains("ORDER_OPTIONS")
                || selectedSectionsElements(plan.selectedSections()).contains("OPTION_VALUE_BOM")) {
            itemDefinitionFacts.localCopyOptionValueMappings(source.ref()).forEach(localReferenceMappings::add);
        }
        ArrayNode mappingPreview = data.putArray("mappingPreview");
        mappingPreview
                .addObject()
                .put("fromCode", source.code())
                .put("toCode", target.code())
                .put("referenceKind", "CATALOG_ITEM")
                .put("status", compatibility.result())
                .set("canonicalTuple", canonicalTuple(scope, brandRef, "CATALOG_ITEM", source.code()));
        localUnits.forEach(unit -> mappingPreview
                .addObject()
                .put("fromCode", unit.code())
                .put("toCode", unit.code())
                .put("referenceKind", "CATALOG_UNIT")
                .put("status", "REUSE")
                .set("canonicalTuple", canonicalTuple(scope, brandRef, "CATALOG_UNIT", unit.code())));
        data.putArray("compatibilityResults")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("compatibilityId", "CATALOG_ITEM:" + source.ref())
                .put("result", compatibility.result())
                .put("reason", compatibility.reason())
                .put("reasonCode", compatibility.reasonCode())
                .set("canonicalTuple", canonicalTuple(scope, brandRef, "CATALOG_ITEM", source.code()));
        ArrayNode rewritePreview = data.putArray("referenceRewritePreview");
        localUnits.forEach(unit -> rewritePreview
                .addObject()
                .put("objectType", "CATALOG_UNIT")
                .put("sourceRef", unit.ref().toString())
                .put("targetRef", unit.ref().toString())
                .put("referenceKind", "CATALOG_UNIT")
                .put("status", "IDENTITY"));
        data.set("skipped", localCopySkipped(source, plan.selectedSections()));
        data.put("preflightDigest", plan.digest())
                .put("selectedCount", 1)
                .put("selectedLimit", 1)
                .put("closureCount", 1 + localUnits.size())
                .put("closureLimit", copyLimits.closureItemCount())
                .put("blockingCount", compatibility.blocking() ? 1 : 0)
                .put("confirmationRequiredCount", compatibility.blocking() ? 0 : 1);
        return data;
    }

    private ArrayNode localCompatibilityResults(String scope, String brandRef, LocalCopyPlan plan) {
        ArrayNode results = mapper.createArrayNode();
        results.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("compatibilityId", "CATALOG_ITEM:" + plan.source().ref())
                .put("result", plan.compatibility().result())
                .put("reason", plan.compatibility().reason())
                .put("reasonCode", plan.compatibility().reasonCode())
                .set(
                        "canonicalTuple",
                        canonicalTuple(
                                scope, brandRef, "CATALOG_ITEM", plan.source().code()));
        return results;
    }

    private LocalCopyPlan localCopyPlan(String scope, String brandRef, ObjectNode request) {
        String sourceCode = required(request, "sourceItemCode");
        String targetCode = required(request, "targetItemCode");
        if (sourceCode.equals(targetCode)) {
            throw new CatalogOwnerApi.Problem(("VALIDATION_ERROR"), (422), ("复制来源与目标不能相同"));
        }
        ItemRow source = requireItem(scope, brandRef, sourceCode);
        ItemRow target = requireItem(scope, brandRef, targetCode);
        List<UnitRow> units = loadUnits(scope, brandRef, unitReferences(json(source.sectionsJson())));
        ArrayNode selectedSections =
                request.path("selectedSections").isArray() ? (ArrayNode) request.path("selectedSections") : null;
        validatedLocalCopySections(selectedSections);
        CompatibilityCheck compatibility = source.shapeKey().equals(target.shapeKey())
                ? new CompatibilityCheck(
                        "CONFIRMABLE_REUSE",
                        "同形态商品可复制",
                        null,
                        "REUSE_CONFIRMATION_REQUIRED",
                        /* format-wrap */
                        false)
                : new CompatibilityCheck(
                        "BLO"
                                /* format-wrap */
                                + "CKED",
                        "商品形态结构不兼容",
                        "STRUCTURE_INCOMPATIBLE",
                        "STRUCTURE_INCOMPATIBLE",
                        /* format-wrap */
                        true);
        if (!compatibility.blocking()) {
            for (String ref : itemReferenceRefs(json(source.sectionsJson()))) {
                if (!itemExistsByRef(scope, brandRef, ref)) {
                    compatibility = new CompatibilityCheck(
                            "BLOCKED",
                            "BOM 引用无法在当前商品库解析",
                            "REFERENCE_MAPPING_UNRESOLVED",
                            "REFERENCE_MAPPING_UNRESOLVED",
                            true);
                    break;
                }
            }
        }
        return new LocalCopyPlan(
                source,
                target,
                selectedSections,
                localCopyDigest(source, target, selectedSections, units),
                compatibility,
                units);
    }

    static List<String> validatedLocalCopySections(ArrayNode selectedSections) {
        if (selectedSections == null || selectedSections.isEmpty()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "selectedSections is required");
        }
        List<String> validated = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode section : selectedSections) {
            if (!section.isTextual() || section.asText().isBlank()) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "selectedSections contains an unknown section");
            }
            String value = section.asText();
            sectionKey(value);
            if (!seen.add(value)) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "selectedSections contains duplicate section");
            }
            validated.add(value);
        }
        return List.copyOf(validated);
    }

    private ArrayNode localCopySkipped(ItemRow source, ArrayNode selectedSections) {
        JsonNode sourceSections = json(source.sectionsJson());
        ArrayNode skipped = mapper.createArrayNode();
        for (JsonNode selected : selectedSections) {
            String section = selected.asText();
            if (Set.of("SKU_BOM", "OPTION_VALUE_BOM", "ITEM_BOM").contains(section) || "BASIC_INFO".equals(section))
                continue;
            if ("ORDER_OPTIONS".equals(section)) {
                ArrayNode configs = itemDefinitionFacts
                        .readOrderOptionConfigs(List.of(source.ref()))
                        .getOrDefault(source.ref(), mapper.createArrayNode());
                if (!configs.isEmpty()) continue;
            }
            if (!sourceSections.has(sectionKey(section))) {
                skipped.addObject().put("section", section).put("reasonCode", "SKIPPED_SOURCE_ABSENT");
            }
        }
        return skipped;
    }

    /**
     * A hydrated empty relationship is not source content and must never erase the target during a partial local copy.
     */
    private static boolean hasLocalCopySourceFacts(JsonNode sections, String... keys) {
        for (String key : keys) {
            JsonNode value = sections.path(key);
            if (value.isArray() && !value.isEmpty()) return true;
            if (value.isObject() && !value.isEmpty()) return true;
        }
        return false;
    }

    private static String sectionKey(String section) {
        return switch (section) {
            case "BASIC_INFO" -> "basicInfo";
            case "SKU_STRUCTURE" -> "skus";
            case "SKU_BOM" -> "skuBom";
            case "OPTION_VALUE_BOM" -> "optionValueBom";
            case "ITEM_BOM" -> "inventoryBom";
            case "ORDER_OPTIONS" -> "orderOptionConfigs";
            case "PACKAGE_STRUCTURE" -> "compositeGroups";
            case "PRODUCTION_PROMPTS" -> "productionProfiles";
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "selectedSections contains an unknown section");
        };
    }

    private String localCopyDigest(ItemRow source, ItemRow target, ArrayNode sections, List<UnitRow> units) {
        ArrayList<String> values = new ArrayList<>();
        sections.forEach(section -> values.add(section.asText()));
        Collections.sort(values);
        if (units != null)
            units.stream()
                    .sorted(java.util.Comparator.comparing(UnitRow::code).thenComparing(UnitRow::ref))
                    .forEach(unit -> values.add(
                            "UNIT:" + unit.ref() + ":" + unit.code() + ":" + unit.name() + ":" + unit.unitDimension()
                                    + ":" + unit.precision() + ":" + unit.status() + ":" + unit.version()));
        return digest(source.code() + "|" + target.code() + "|" + source.version() + "|" + target.version() + "|"
                + String.join(",", values));
    }

    /** A local copy owns new child identities; sharing a source SKU ref would make two items claim one fact. */
    private ArrayNode clonedSkuFacts(ArrayNode sourceSkus) {
        ArrayNode copied = mapper.createArrayNode();
        if (sourceSkus == null) return copied;
        for (JsonNode sourceSku : sourceSkus) {
            if (!sourceSku.isObject())
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "source SKU is invalid");
            ObjectNode clone = ((ObjectNode) sourceSku).deepCopy();
            clone.put("productSkuRef", UUID.randomUUID().toString());
            copied.add(clone);
        }
        return copied;
    }

    /**
     * A receipt can be read only after current owner facts are loaded; it can leave this owner only when its stored
     * post-command fingerprint still equals those facts. Older receipts without the marker fail closed.
     */
    private JsonNode replayCopyIfCurrent(JsonNode replay, String currentFingerprint) {
        if (!currentFingerprint.equals(replay.path("receiptObjectFingerprint").asText())) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("STALE_COPY_PREFLIGHT"),
                        (409),
                        /* format-wrap */
                        ("复制对象事实已变化，请重新预检"));
            }
        }
        return replay;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean itemExists(String dataNodeRef, String brandRef, String itemCode) {
        if (dataNodeRef == null || brandRef == null || itemCode == null) return false;
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND status "
                        + "<> 'VOIDED'",
                Integer.class,
                dataNodeRef,
                brandRef,
                itemCode);
        return count != null && count > 0;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean productionTagReferenced(String dataNodeRef, String brandRef, String tagRef) {
        if (dataNodeRef == null || brandRef == null || tagRef == null || tagRef.isBlank()) return false;
        UUID ref;
        try {
            ref = UUID.fromString(tagRef);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "production tag reference must be UUID", failure);
        }
        return itemReferenceFacts.referenced(dataNodeRef, brandRef, CatalogItemReferenceFacts.PRODUCTION_TAG, ref);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean assetReferenced(String dataNodeRef, String brandRef, String assetRef) {
        requireScope(dataNodeRef, brandRef);
        if (assetRef == null || assetRef.isBlank()) return false;
        try {
            UUID ref = UUID.fromString(assetRef);
            return itemMediaFacts.referenced(dataNodeRef, brandRef, ref)
                    || skuMediaFacts.referenced(dataNodeRef, brandRef, ref);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean assetReferencedAnywhere(String assetRef) {
        return assetRefsStillReferenced(java.util.Set.of(assetRef)).contains(assetRef);
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Set<String> assetRefsStillReferenced(java.util.Set<String> assetRefs) {
        if (assetRefs == null || assetRefs.isEmpty()) return java.util.Set.of();
        java.util.Set<String> candidates = assetRefs.stream()
                .filter(ref -> ref != null && !ref.isBlank())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        if (candidates.isEmpty()) return java.util.Set.of();
        java.util.Set<UUID> refs = new java.util.LinkedHashSet<>();
        for (String candidate : candidates)
            try {
                refs.add(UUID.fromString(candidate));
            } catch (IllegalArgumentException ignored) {
            }
        // Asset references are intentionally shared across catalog scopes.  Keep
        // that global lifecycle judgment, but evaluate the whole candidate set
        // with one query per owning media table instead of 2N EXISTS probes.
        java.util.Set<UUID> referencedRefs =
                new java.util.LinkedHashSet<>(itemMediaFacts.referencedRefs(null, null, refs));
        referencedRefs.addAll(skuMediaFacts.referencedRefs(null, null, refs));
        java.util.Set<String> referenced = new java.util.LinkedHashSet<>();
        for (String candidate : candidates)
            try {
                if (referencedRefs.contains(UUID.fromString(candidate))) referenced.add(candidate);
            } catch (IllegalArgumentException ignored) {
            }
        return java.util.Set.copyOf(referenced);
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogOwnerApi.CatalogAssetReferenceReadback readAssetReferences(
            String dataNodeRef, String brandRef, String itemCode) {
        requireScope(dataNodeRef, brandRef);
        if (itemCode == null || itemCode.isBlank()) return new CatalogOwnerApi.CatalogAssetReferenceReadback(List.of());
        List<UUID> refs = jdbc.query(
                "SELECT asset_ref FROM ("
                        + "SELECT image.asset_ref FROM catalog.catalog_item_image image "
                        + "JOIN catalog.catalog_item item ON item.item_ref=image.item_ref "
                        + "WHERE item.data_node_ref=? AND item.brand_ref=? AND item.code=? "
                        + "AND item.status <> 'VOIDED' "
                        + "UNION "
                        + "SELECT media.asset_ref FROM catalog.catalog_sku_media media "
                        + "JOIN catalog.catalog_sku sku ON sku.product_sku_ref=media.product_sku_ref "
                        + "JOIN catalog.catalog_item item ON item.item_ref=sku.item_ref "
                        + "WHERE item.data_node_ref=? AND item.brand_ref=? AND item.code=? "
                        + "AND item.status <> 'VOIDED'"
                        + ") asset_refs ORDER BY asset_ref",
                (rows, row) -> rows.getObject(1, UUID.class),
                dataNodeRef,
                brandRef,
                itemCode,
                dataNodeRef,
                brandRef,
                itemCode);
        return new CatalogOwnerApi.CatalogAssetReferenceReadback(List.copyOf(refs));
    }

    @Override
    @Transactional(readOnly = true)
    public void requireAssetUnreferencedAnywhere(UUID assetRef) {
        if (assetRef == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "assetRef is required");
        if (assetReferencedAnywhere(assetRef.toString())) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("ASSET_REFERENCE_PROTECTED"),
                        (409),
                        /* format-wrap */
                        ("图片资产仍被商品引用，不能释放"));
            }
        }
    }

    private void lockCatalogAssetRefs(JsonNode... sections) {
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (JsonNode section : sections) {
            if (section == null) continue;
            for (String ref : catalogAssetRefs(section)) {
                try {
                    refs.add(UUID.fromString(ref));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }
        assetReferenceLocks.lockCatalogReferences(refs);
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef) {
        requireScope(dataNodeRef, brandRef);
        if (targetRef == null || targetRef.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "targetRef is required");
        ArrayNode entries = mapper.createArrayNode();
        jdbc.query(
                "SELECT code,name,status,sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND status <> 'VOIDED' ORDER BY code",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                },
                result -> {
                    while (result.next()) {
                        String sourceCode = result.getString(1);
                        String sourceName = result.getString(2);
                        String sourceStatus = result.getString(3);
                        JsonNode sections = json(result.getString(4));
                        JsonNode bom = sections.path("inventoryBom");
                        if (!bom.isArray()) continue;
                        bom.forEach(node -> {
                            if (!targetRef.equals(node.path("targetRef").asText())) return;
                            ObjectNode entry = entries.addObject()
                                    .put("sourceCode", sourceCode)
                                    .put("sourceKind", node.path("nodeType").asText("ITEM"))
                                    .put("sourceName", sourceName)
                                    .put("quantity", node.path("quantity").asText("0"))
                                    .put("unit", node.path("unit").asText(""))
                                    .put("timing", "BOM")
                                    .put("status", sourceStatus);
                            entry.putObject("ownerScope")
                                    .put("ownerType", "DATA_NODE")
                                    .put("ownerRef", dataNodeRef)
                                    .put("brandRef", brandRef);
                        });
                    }
                    return null;
                });
        return entries;
    }

    @Override
    public JsonNode skuNamesByItemCodes(String dataNodeRef, String brandRef, JsonNode itemCodes) {
        requireScope(dataNodeRef, brandRef);
        if (itemCodes == null || !itemCodes.isArray() || itemCodes.isEmpty()) return mapper.createObjectNode();
        List<String> codes = stringValues(itemCodes);
        if (codes.isEmpty()) return mapper.createObjectNode();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(codes);
        ObjectNode result = mapper.createObjectNode();
        jdbc.query(
                "SELECT item.code,sku.sku_code,sku.sku_name FROM catalog.catalog_item item JOIN catalog.catalog_sku "
                        + "sku ON sku.item_ref=item.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.code "
                        + "IN ("
                        + placeholders
                        + ") AND item.status <> 'VOIDED' AND sku.status <> 'ARCHIVED' ORDER BY "
                        + "item.code,sku.display_order,sku.sku_code",
                args.toArray(),
                rows -> {
                    while (rows.next()) {
                        String itemCode = rows.getString(1);
                        ObjectNode names = result.with(itemCode);
                        String skuCode = rows.getString(2);
                        String skuName = rows.getString(3);
                        if (skuCode != null && skuName != null && !skuName.isBlank()) names.put(skuCode, skuName);
                    }
                    return null;
                });
        return result;
    }

    private ObjectNode workbenchContext(String dataNodeRef, String brandRef, String requestId) {
        ObjectNode data = mapper.createObjectNode();
        data.put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef);
        data.put("scopeName", dataNodeRef).put("scopeCode", dataNodeRef).putNull("headCompanyRef");
        data.put("copySourceAvailable", false);
        data.putObject("actionAvailability")
                .put("canCreate", true)
                .put("canEdit", true)
                .put("canCopy", false)
                .putArray("reasons")
                .add("COPY_SOURCE_UNAVAILABLE");
        data.put("contextVersion", generation(dataNodeRef, brandRef))
                .put("authorizationRevision", CatalogOwnerTypes.REVISION);
        return envelope(requestId, data);
    }

    private ObjectNode navigation(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode();
        Long allCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> "
                        + "'VOIDED'",
                Long.class,
                dataNodeRef,
                brandRef);
        data.put("allCount", allCount == null ? 0L : allCount);
        ArrayNode tree = data.putArray("tree");
        jdbc.query(
                "SELECT c.category_ref, c.code, c.name, c.parent_category_ref, c.version, c.display_order, "
                        + "(SELECT COUNT(*) FROM catalog.catalog_item_category relation JOIN catalog.catalog_item item "
                        + "ON item.item_ref=relation.item_ref WHERE relation.category_ref=c.category_ref AND "
                        + "item.data_node_ref=c.data_node_ref AND item.brand_ref=c.brand_ref AND item.status <> "
                        + "'VOIDED'), "
                        + "(SELECT COUNT(*) FROM catalog.catalog_category child WHERE "
                        + "child.data_node_ref=c.data_node_ref AND child.brand_ref=c.brand_ref AND "
                        + "child.parent_category_ref=c.category_ref AND child.status <> 'VOIDED'), "
                        + "(SELECT COUNT(DISTINCT item.item_ref) FROM catalog.catalog_item_category relation JOIN "
                        + "catalog.catalog_item item ON item.item_ref=relation.item_ref JOIN "
                        + "catalog.catalog_category subtree ON subtree.category_ref=relation.category_ref WHERE "
                        + "item.data_node_ref=c.data_node_ref AND item.brand_ref=c.brand_ref AND item.status <> "
                        + "'VOIDED' AND subtree.data_node_ref=c.data_node_ref AND subtree.brand_ref=c.brand_ref "
                        + "AND subtree.status <> 'VOIDED' AND (subtree.category_ref=c.category_ref OR "
                        + "subtree.parent_category_ref=c.category_ref)), "
                        + "(SELECT string_agg(DISTINCT item.name, '、' ORDER BY item.name) FROM "
                        + "catalog.catalog_item_category relation JOIN catalog.catalog_item item ON "
                        + "item.item_ref=relation.item_ref JOIN catalog.catalog_category subtree ON "
                        + "subtree.category_ref=relation.category_ref WHERE item.data_node_ref=c.data_node_ref AND "
                        + "item.brand_ref=c.brand_ref AND item.status <> 'VOIDED' AND "
                        + "subtree.data_node_ref=c.data_node_ref AND subtree.brand_ref=c.brand_ref AND "
                        + "subtree.status <> 'VOIDED' AND (subtree.category_ref=c.category_ref OR "
                        + "subtree.parent_category_ref=c.category_ref)) "
                        + "FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? AND c.status <> "
                        + "'VOIDED' ORDER BY c.parent_category_ref NULLS FIRST, c.display_order, c.code",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                },
                result -> {
                    while (result.next()) {
                        String categoryRef = result.getObject(1, UUID.class).toString();
                        long directCount = result.getLong(7);
                        long childCount = result.getLong(8);
                        long blockingCount = result.getLong(9);
                        ObjectNode node = tree.addObject()
                                .put("categoryRef", categoryRef)
                                .put("code", result.getString(2))
                                .put("name", result.getString(3))
                                .put("version", result.getLong(5))
                                .put("displayOrder", result.getInt(6));
                        if (result.getObject(4) == null) node.putNull("parentCategoryRef");
                        else
                            node.put(
                                    "parentCategoryRef",
                                    result.getObject(4, UUID.class).toString());
                        node.put("count", directCount).put("countSemantics", "SELF_ONLY");
                        ObjectNode deletion = node.putObject("deletionAvailability");
                        deletion.put("canDelete", blockingCount == 0)
                                .put("subtreeSize", 1 + childCount)
                                .put("blockingReferenceCount", blockingCount);
                        ArrayNode labels = deletion.putArray("blockingReferenceLabels");
                        String joinedLabels = result.getString(10);
                        if (joinedLabels != null && !joinedLabels.isBlank())
                            for (String label : joinedLabels.split("、")) labels.add(label);
                    }
                    return null;
                });
        ArrayNode tags = data.putArray("tags");
        jdbc.query(
                "SELECT entry.entry_ref, entry.code, entry.name, COUNT(DISTINCT item.item_ref) "
                        + "FROM catalog.dictionary_entry entry "
                        + "LEFT JOIN catalog.catalog_item_reference relation ON relation.ref=entry.entry_ref "
                        + "AND relation.kind=? "
                        + "LEFT JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref "
                        + "AND item.data_node_ref=entry.data_node_ref AND item.brand_ref=entry.brand_ref "
                        + "AND item.status <> 'VOIDED' "
                        + "WHERE entry.data_node_ref=? AND entry.brand_ref=? AND entry.dictionary_kind='TAG' "
                        + "AND entry.status='ENABLED' "
                        + "GROUP BY entry.entry_ref, entry.code, entry.name, entry.display_order "
                        + "ORDER BY entry.display_order, entry.code, entry.name",
                statement -> {
                    statement.setString(1, CatalogItemReferenceFacts.CATALOG_TAG);
                    statement.setString(2, dataNodeRef);
                    statement.setString(3, brandRef);
                },
                result -> {
                    while (result.next())
                        tags.addObject()
                                .put("tagRef", result.getObject(1, UUID.class).toString())
                                .put("code", result.getString(2))
                                .put("name", result.getString(3))
                                .put("count", result.getLong(4));
                    return null;
                });
        ArrayNode views = data.putArray("smartViews");
        Map<String, Long> smartCounts = new LinkedHashMap<>();
        ArrayNode counts = data.putArray("shapeCounts");
        Map<String, Long> shapeCounts = new LinkedHashMap<>();
        long[] generation = {0L};
        jdbc.query(
                "SELECT shape_key, COUNT(*), COALESCE(MAX(version),0), "
                        + "COUNT(*) FILTER (WHERE "
                        + "COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='EXTE"
                        + "RNAL_ORDER_TEMPORARY'), "
                        + "COUNT(*) FILTER (WHERE status='DISABLED'), "
                        + "COUNT(*) FILTER (WHERE status='ARCHIVED'), "
                        + "COUNT(*) FILTER (WHERE updated_at_epoch_millis >= ?), "
                        + "COUNT(*) FILTER (WHERE "
                        + "COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='AUTO"
                        + "_SYNC') "
                        + "FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' "
                        + "GROUP BY shape_key",
                statement -> {
                    statement.setLong(1, now() - 7L * 24L * 60L * 60L * 1000L);
                    statement.setString(2, dataNodeRef);
                    statement.setString(3, brandRef);
                },
                result -> {
                    while (result.next()) {
                        shapeCounts.put(result.getString(1), result.getLong(2));
                        generation[0] = Math.max(generation[0], result.getLong(3));
                        smartCounts.merge("EXTERNAL_ORDER_TEMP", result.getLong(4), Long::sum);
                        smartCounts.merge("INACTIVE", result.getLong(5), Long::sum);
                        smartCounts.merge("ARCHIVED", result.getLong(6), Long::sum);
                        smartCounts.merge("RECENTLY_UPDATED", result.getLong(7), Long::sum);
                        smartCounts.merge("AUTO_SYNC", result.getLong(8), Long::sum);
                    }
                    return null;
                });
        for (CatalogInventoryShapeManifest.SmartViewRule view : CatalogInventoryShapeManifest.SMART_VIEWS) {
            views.addObject()
                    .put("viewKey", view.viewKey())
                    .put("label", view.label())
                    .put("count", smartCounts.getOrDefault(view.viewKey(), 0L));
        }
        for (String shape : CatalogOwnerTypes.SHAPES)
            counts.addObject().put("shapeKey", shape).put("count", shapeCounts.getOrDefault(shape, 0L));
        Long uncategorizedCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_item item WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status <> 'VOIDED' "
                        + "AND NOT EXISTS (SELECT 1 FROM catalog.catalog_item_category relation WHERE "
                        + "relation.item_ref=item.item_ref)",
                Long.class,
                dataNodeRef,
                brandRef);
        data.put("uncategorizedCount", uncategorizedCount == null ? 0L : uncategorizedCount);
        data.put("generation", generation[0]);
        return envelope(requestId, data);
    }

    private ObjectNode items(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        validateItemPageQuery(request);
        String keyword = optional(request, "keyword");
        String smartViewKey = optional(request, "smartViewKey");
        String shapeKey = optional(request, "shapeKey");
        String categoryRef = optional(request, "categoryRef");
        UUID tagRef = optionalUuid(request, "tagRef");
        boolean uncategorized = parseBoolean(request, "uncategorized", false);
        boolean includeSubCategories = parseBoolean(request, "includeSubCategories", false);
        String status = optional(request, "status");
        String source = optional(request, "source");
        String queryGeneration = optional(request, "queryGeneration");
        boolean itemCodesOnly = request.path("itemCodesOnly").asBoolean(false);
        long offset = itemCodesOnly ? 0 : parseCursor(request, "cursor");
        int pageSize = itemCodesOnly ? 5000 : parsePageSize(request, "pageSize", 20);
        List<String> itemCodes = textArray(request.path("itemCodes"));
        List<UUID> itemRefs = uuidArray(request.path("itemRefs"), "itemRefs");
        if (request.has("itemCodes") && itemCodes.isEmpty()) {
            ObjectNode empty = mapper.createObjectNode();
            empty.putArray("items");
            empty.put("total", 0)
                    .putNull("cursor")
                    .put("generation", generation(dataNodeRef, brandRef))
                    .put("queryGeneration", queryGeneration == null ? "" : queryGeneration);
            return envelope(requestId, empty);
        }
        if (request.has("itemRefs") && itemRefs.isEmpty()) {
            ObjectNode empty = mapper.createObjectNode();
            empty.putArray("items");
            empty.put("total", 0)
                    .putNull("cursor")
                    .put("generation", generation(dataNodeRef, brandRef))
                    .put("queryGeneration", queryGeneration == null ? "" : queryGeneration);
            return envelope(requestId, empty);
        }

        StringBuilder sql = new StringBuilder("WITH RECURSIVE category_scope(category_ref) AS ("
                + "SELECT c.category_ref FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? AND "
                + "c.category_ref::text=? AND c.status <> 'VOIDED' "
                + "UNION ALL SELECT child.category_ref FROM catalog.catalog_category child JOIN category_scope parent "
                + "ON child.parent_category_ref=parent.category_ref "
                + "WHERE child.data_node_ref=? AND child.brand_ref=? AND ? = TRUE AND child.status <> 'VOIDED') "
                + ", filtered AS (SELECT i.item_ref, i.code, i.name, i.short_name, i.shape_key, i.status, "
                + "i.sections::text, i.version, i.updated_at_epoch_millis, i.source_scope_ref "
                + "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=?");
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.add(categoryRef);
        args.add(dataNodeRef);
        args.add(brandRef);
        args.add(includeSubCategories);
        args.add(dataNodeRef);
        args.add(brandRef);
        if (!itemCodes.isEmpty()) {
            sql.append(" AND i.code IN (")
                    .append(String.join(",", Collections.nCopies(itemCodes.size(), "?")))
                    .append(")");
            args.addAll(itemCodes);
        }
        if (!itemRefs.isEmpty()) {
            sql.append(" AND i.item_ref IN (")
                    .append(String.join(",", Collections.nCopies(itemRefs.size(), "?")))
                    .append(")");
            args.addAll(itemRefs);
        }
        if (keyword == null || keyword.isBlank()) sql.append(" AND (?::text IS NULL)");
        else
            sql.append(
                    " AND (i.name || chr(1) || COALESCE(i.short_name, '') || chr(1) || i.code) ILIKE '%' || ? || '%'");
        if (keyword == null || keyword.isBlank()) args.add(null);
        else args.add(keyword);
        // VOIDED is never a public business-read state.  An explicit status
        // filter may narrow the visible set, but cannot reintroduce it.
        sql.append(" AND i.status <> 'VOIDED'");
        if (status != null && !status.isBlank()) {
            sql.append(" AND i.status=?");
            args.add(status);
        }
        if (shapeKey != null && !shapeKey.isBlank()) {
            sql.append(" AND i.shape_key=?");
            args.add(shapeKey);
        }
        if (categoryRef == null || categoryRef.isBlank()) sql.append(" AND (?::text IS NULL)");
        else
            sql.append(" AND EXISTS (SELECT 1 FROM catalog.catalog_item_category relation JOIN category_scope c ON "
                    + "c.category_ref=relation.category_ref WHERE relation.item_ref=i.item_ref)");
        if (categoryRef == null || categoryRef.isBlank()) args.add(null);
        if (tagRef != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM catalog.catalog_item_reference relation "
                    + "WHERE relation.item_ref=i.item_ref AND relation.kind=? AND relation.ref=?)");
            args.add(CatalogItemReferenceFacts.CATALOG_TAG);
            args.add(tagRef);
        }
        if (uncategorized)
            sql.append(" AND NOT EXISTS (SELECT 1 FROM catalog.catalog_item_category relation WHERE "
                    + "relation.item_ref=i.item_ref)");
        if (smartViewKey != null && !smartViewKey.isBlank()) {
            switch (smartViewKey) {
                case "ALL" -> {}
                case "EXTERNAL_ORDER_TEMP" -> sql.append(" AND "
                        + "COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')"
                        + "='EXTERNAL_ORDER_TEMPORARY'");
                case "INACTIVE" -> sql.append(" AND i.status='DISABLED'");
                case "ARCHIVED" -> sql.append(" AND i.status='ARCHIVED'");
                case "RECENTLY_UPDATED" -> sql.append(" AND i.updated_at_epoch_millis >= ?")
                        .append(" ");
                case "AUTO_SYNC" -> sql.append(" AND "
                        + "COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')"
                        + "='AUTO_SYNC'");
                default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "smartViewKey is not supported");
            }
            if ("RECENTLY_UPDATED".equals(smartViewKey)) args.add(now() - 7L * 24L * 60L * 60L * 1000L);
        }
        if (source != null && !source.isBlank()) {
            switch (source) {
                case "SELF_MANAGED" -> sql.append(" AND i.source_scope_ref IS NULL");
                case "COPIED" -> sql.append(" AND i.source_scope_ref IS NOT NULL");
                case "AUTO_SYNC" -> sql.append(" AND "
                        + "COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')"
                        + "='AUTO_SYNC'");
                case "TEMPORARY" -> sql.append(
                        " AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource') "
                                + "IN ('TEMPORARY','EXTERNAL_ORDER_TEMPORARY')");
                default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "source is not supported");
            }
        }
        sql.append("), aggregate AS (SELECT COUNT(*) AS total FROM filtered), paged AS (SELECT item_ref, code, name, "
                + "short_name, shape_key, status, sections, version, updated_at_epoch_millis, "
                + "source_scope_ref FROM filtered ORDER BY code OFFSET ? LIMIT ?) SELECT p.item_ref, p.code, "
                + "p.name, p.short_name, p.shape_key, p.status, p.sections, p.version, "
                + "p.updated_at_epoch_millis, p.source_scope_ref, a.total FROM aggregate a LEFT JOIN paged p ON "
                + "TRUE ORDER BY p.code");
        args.add(offset);
        args.add(pageSize + 1);
        List<PageItemRow> rows = jdbc.query(
                sql.toString(),
                (result, row) -> new PageItemRow(
                        result.getObject(1, UUID.class) == null
                                ? null
                                : new ItemRow(
                                        result.getObject(1, UUID.class),
                                        result.getString(2),
                                        result.getString(3),
                                        result.getString(4),
                                        result.getString(5),
                                        result.getString(6),
                                        result.getString(7),
                                        result.getLong(8),
                                        result.getLong(9),
                                        result.getString(10)),
                        result.getLong(11)),
                args.toArray());
        Map<UUID, ItemRow> hydratedByRef = new LinkedHashMap<>();
        hydrateItemFacts(rows.stream()
                        .map(PageItemRow::item)
                        .filter(java.util.Objects::nonNull)
                        .toList())
                .forEach(item -> hydratedByRef.put(item.ref(), item));
        rows = rows.stream()
                .map(row -> row.item() == null
                        ? row
                        : new PageItemRow(hydratedByRef.get(row.item().ref()), row.total()))
                .toList();
        boolean hasNext = rows.stream().filter(row -> row.item() != null).count() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        ObjectNode data = mapper.createObjectNode();
        ArrayNode array = data.putArray("items");
        rows.stream().filter(row -> row.item() != null).forEach(row -> array.add(itemSummary(row.item())));
        long total = rows.isEmpty() ? 0 : rows.get(0).total();
        data.put("total", total)
                .put("generation", generation(dataNodeRef, brandRef))
                .put("queryGeneration", queryGeneration == null ? "" : queryGeneration);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize));
        else data.putNull("cursor");
        return envelope(requestId, data);
    }

    private ObjectNode detail(String dataNodeRef, String brandRef, String requestId, String code) {
        ItemRow row = hydrateItemFacts(List.of(requireItem(dataNodeRef, brandRef, code)))
                .getFirst();
        JsonNode sections = json(row.sectionsJson());
        ObjectNode data = mapper.createObjectNode().set("item", itemDetail(row, sections, dataNodeRef, brandRef));
        ArrayNode tabs = data.putArray("tabs");
        detailTabs(row.shapeKey()).forEach(tab -> tabs.addObject()
                .put("tabKey", tab.asText())
                .put("visible", true)
                .put("disabled", false)
                .putNull("reason"));
        ArrayNode references = data.putArray("references");
        LinkedHashSet<String> refs = itemReferenceRefs(sections);
        Map<String, String> itemCodes = itemCodesByRef(dataNodeRef, brandRef, refs);
        refs.forEach(ref -> references
                .addObject()
                .put("referenceKind", "ITEM")
                .put("referenceRef", ref)
                .put("code", itemCodes.getOrDefault(ref, ""))
                .put("direction", "OUTBOUND"));
        List<InboundItemReference> inboundReferences = inboundItemReferences(dataNodeRef, brandRef, row.ref());
        inboundReferences.forEach(reference -> references
                .addObject()
                .put("referenceKind", "ITEM")
                .put("referenceRef", reference.itemRef().toString())
                .put("code", reference.code())
                .put("direction", "INBOUND"));
        ArrayNode inventoryBom = data.putArray("inventoryBom");
        JsonNode bom = sections.path("inventoryBom");
        if (bom.isArray()) bom.forEach(entry -> inventoryBom.add(bomEntry(entry)));
        ArrayNode productionTags = data.putArray("productionTags");
        productionTags.addAll(
                productionTagDetails(dataNodeRef, brandRef, sections.path("productionTagRefs"), requestId));
        data.set("compositeGroups", compositeGroups(sections.path("compositeGroups")));
        List<String> deniedFields = sourceDeniedFields(row, sections);
        ObjectNode governance = data.putObject("governance");
        ArrayNode governanceDenied = governance.putArray("deniedFields");
        deniedFields.forEach(governanceDenied::add);
        JsonNode externalIdentity = externalIdentityFact(mapper, sections);
        if (externalIdentity == null) governance.putNull("externalIdentity");
        else governance.set("externalIdentity", externalIdentity.deepCopy());
        ObjectNode action = data.putObject("actionAvailability")
                .put("canEdit", !Set.of("ARCHIVED", "VOIDED").contains(row.status()))
                .put("canEnable", !Set.of("ENABLED", "ARCHIVED", "VOIDED").contains(row.status()))
                .put("canDisable", "ENABLED".equals(row.status()))
                .put("canArchive", "DISABLED".equals(row.status()));
        ObjectNode voidAvailability = action.putObject("voidAvailability");
        voidAvailability.put(
                "canVoid",
                !Set.of("ARCHIVED", "VOIDED").contains(row.status())
                        && !hasItemDependencies(row)
                        && inboundReferences.isEmpty());
        ArrayNode blockingReferences = voidAvailability.putArray("blockingReferences");
        inboundReferences.forEach(reference -> blockingReferences
                .addObject()
                .put("referenceKind", "ITEM")
                .put("referenceRef", reference.itemRef().toString()));
        ArrayNode dependentFacts = voidAvailability.putArray("dependentFacts");
        if (hasItemDependencies(row))
            dependentFacts
                    .addObject()
                    .put("factKind", "CATALOG_ITEM_DEPENDENCY")
                    .put("factRef", row.ref().toString());
        inboundReferences.forEach(reference -> dependentFacts
                .addObject()
                .put("factKind", "CATALOG_ITEM_INBOUND_REFERENCE")
                .put("factRef", reference.itemRef().toString()));
        ArrayNode denied = data.putArray("deniedFields");
        deniedFields.forEach(denied::add);
        boolean sourceOwnedCatalog = "AUTO_SYNC".equals(sourceFact(row, sections));
        data.putObject("fieldOwnership")
                .put("catalog", sourceOwnedCatalog ? "SOURCE" : "CATALOG")
                .put("inventory", "INVENTORY")
                .put("asset", "ASSET");
        data.putObject("queryIdentity")
                .put("dataNodeRef", dataNodeRef)
                .put("brandRef", brandRef)
                .put("generation", generation(dataNodeRef, brandRef));
        return envelope(requestId, data);
    }

    private ArrayNode detailTabs(String shapeKey) {
        try {
            JsonNode tabs = mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON)
                    .path("tabRules")
                    .path(shapeKey)
                    .path("visible");
            return tabs.isArray() ? (ArrayNode) tabs : mapper.createArrayNode();
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态页签契约不可用", failure);
        }
    }

    private ObjectNode dictionary(
            String dataNodeRef, String brandRef, String requestId, String kind, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode().put("dictionaryKind", kind);
        ArrayNode entries = data.putArray("entries");
        UUID parentEntryRef = optionalUuid(request, "parentEntryRef");
        if (parentEntryRef != null && !"SKU_ATTRIBUTE_VALUE".equals(kind)) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("VALIDATION_ERROR"), (422), ("parentEntryRef 仅适用于 SKU_ATTRIBUTE_VALUE"));
            }
        }
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity = cursorIdentity(
                "dictionary",
                dataNodeRef,
                brandRef,
                kind,
                parentEntryRef == null ? null : parentEntryRef.toString(),
                Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, queryIdentity);
        DictionaryListing listing =
                loadDictionaryListing(dataNodeRef, brandRef, kind, parentEntryRef, cursor, pageSize, queryIdentity);
        DictionaryReferenceSnapshot references =
                dictionaryReferenceSnapshot(dataNodeRef, brandRef, kind, listing.entryRefs());
        for (DictionaryEntryRow row : listing.entries()) {
            String entryRef = row.entryRef().toString();
            boolean referenced = references.isReferenced(row.entryRef());
            ObjectNode entry = entries.addObject()
                    .put("entryRef", entryRef)
                    .put("code", row.code())
                    .put("name", row.name())
                    .put("status", row.status())
                    .put("ownerType", "DATA_NODE")
                    .put("ownerRef", dataNodeRef)
                    .put("brandRef", brandRef)
                    .put("version", row.version())
                    .put("updatedAt", row.updatedAt());
            putNullableUuid(entry, "parentEntryRef", row.parentEntryRef());
            ObjectNode voidAvailability = entry.putObject("voidAvailability");
            voidAvailability.put("canVoid", !"VOIDED".equals(row.status()) && !referenced);
            ArrayNode blocking = voidAvailability.putArray("blockingReferences");
            if (referenced)
                blocking.addObject().put("referenceKind", "CATALOG_ITEM").put("referenceRef", entryRef);
            voidAvailability.putArray("dependentFacts");
        }
        data.put("total", listing.total()).put("generation", listing.generation());
        if (listing.cursor() == null) data.putNull("cursor");
        else data.put("cursor", listing.cursor());
        return envelope(requestId, data);
    }

    private ObjectNode copyCandidates(
            String operationId, String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode();
        boolean brandCopy = "getOperationsBrandCatalogCopyCandidates".equals(operationId);
        String sourceDataNodeRef = brandCopy ? required(request, "sourceDataNodeRef") : dataNodeRef;
        data.putObject("sourceScope")
                .put("ownerType", brandCopy ? "HEAD_COMPANY" : "DATA_NODE")
                .put("ownerRef", sourceDataNodeRef)
                .put("brandRef", brandRef);
        data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", dataNodeRef)
                .put("brandRef", brandRef);
        if (brandCopy) data.put("copySourceAvailable", true);
        ArrayNode entries = data.putArray("items");
        String keyword = optional(request, "keyword");
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity =
                cursorIdentity(operationId, sourceDataNodeRef, brandRef, keyword, Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, queryIdentity);
        String cursorPredicate = cursor == null ? "" : " WHERE code > ? OR (code = ? AND item_ref > ?)";
        String sql = "WITH matching AS (SELECT item_ref, code, name, short_name, shape_key, status, sections::text, "
                + "version, updated_at_epoch_millis, source_scope_ref FROM "
                + "catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' AND "
                + "(?::text IS NULL OR (name || chr(1) || COALESCE(short_name, '') || chr(1) || code) "
                + "ILIKE '%' || ? || '%')), aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS "
                + "(SELECT item_ref,code,name,short_name,shape_key,status,sections,version,"
                + "updated_at_epoch_millis,source_scope_ref FROM matching"
                + cursorPredicate
                + " ORDER BY code NULLS LAST, item_ref LIMIT ?) SELECT "
                + "p.item_ref,p.code,p.name,p.short_name,p.shape_key,p.status,p.sections,"
                + "p.version,p.updated_at_epoch_millis,p.source_scope_ref,a.total FROM aggregate a LEFT JOIN "
                + "paged p ON "
                + "TRUE ORDER BY p.code NULLS LAST,p.item_ref";
        List<Object> arguments = new ArrayList<>();
        arguments.add(sourceDataNodeRef);
        arguments.add(brandRef);
        arguments.add(keyword);
        arguments.add(keyword);
        if (cursor != null) {
            arguments.add(cursor.sortKey());
            arguments.add(cursor.sortKey());
            arguments.add(cursor.tieBreaker());
        }
        arguments.add(pageSize + 1);
        List<CopyPageRow> pageRows = jdbc.query(
                sql,
                (result, row) -> {
                    UUID itemRef = result.getObject(1, UUID.class);
                    ItemRow item = itemRef == null
                            ? null
                            : new ItemRow(
                                    itemRef,
                                    result.getString(2),
                                    result.getString(3),
                                    result.getString(4),
                                    result.getString(5),
                                    result.getString(6),
                                    result.getString(7),
                                    result.getLong(8),
                                    result.getLong(9),
                                    result.getString(10));
                    return new CopyPageRow(item, result.getLong(11));
                },
                arguments.toArray());
        List<CopyPageRow> presentRows =
                pageRows.stream().filter(row -> row.item() != null).toList();
        boolean hasNext = presentRows.size() > pageSize;
        if (hasNext) presentRows = presentRows.subList(0, pageSize);
        presentRows.stream().map(CopyPageRow::item).forEach(row -> entries.addObject()
                .put("code", row.code())
                .put("name", row.name())
                .put("shapeKey", row.shapeKey())
                .put("status", row.status())
                .put("compatibilityHint", "REVIEW_REQUIRED")
                .put("version", row.version()));
        long total = pageRows.isEmpty() ? 0 : pageRows.get(0).total();
        data.put("total", total).put("generation", generation(dataNodeRef, brandRef));
        if (hasNext) {
            CopyPageRow last = presentRows.get(presentRows.size() - 1);
            data.put(
                    "cursor",
                    OpaqueCollectionCursor.encode(
                            queryIdentity, last.item().code(), last.item().ref()));
        } else data.putNull("cursor");
        return envelope(requestId, data);
    }

    private ObjectNode shapeManifest(String requestId) {
        try {
            JsonNode manifest = mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON);
            ObjectNode data = mapper.createObjectNode();
            data.put("manifestRevision", CatalogInventoryShapeManifest.REVISION);
            data.put("manifestDigest", CatalogInventoryShapeManifest.MANIFEST_DIGEST);
            data.set("shapeKeys", manifest.path("shapeKeys"));
            data.set("capabilityValues", manifest.path("capabilityValues"));
            data.set("controlKinds", manifest.path("controlKinds"));
            data.set("fields", manifest.path("fields"));
            data.set("enumLabels", manifest.path("enumLabels"));
            for (String key : List.of(
                    "modeRules",
                    "shapeRules",
                    "fieldRules",
                    "tabRules",
                    "linkageRules",
                    "typeEffects",
                    "saveSections",
                    "detailSections")) data.set(key, manifest.path(key));
            return envelope(requestId, data);
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态契约不可用", ex);
        }
    }

    private ObjectNode createItem(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "code");
        String name = required(request, "name");
        String shape = required(request, "shapeKey");
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shape);
        if (!rule.createAllowed() || rule.visibleButDisabled())
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "shapeKey is not creatable in the current manifest");
        ObjectNode sections = mapper.createObjectNode();
        applyDerivedShapeFields(sections, rule);
        long now = now();
        UUID itemRef = UUID.randomUUID();
        String shortName = removeShortName(sections);
        try {
            jdbc.update(
                    "INSERT INTO catalog.catalog_item (item_ref, data_node_ref, brand_ref, code, name, short_name, "
                            + "shape_key, status, sections, version, created_at_epoch_millis, "
                            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', CAST(? AS JSONB), 1, "
                            + "?, ?)",
                    itemRef,
                    dataNodeRef,
                    brandRef,
                    code,
                    name,
                    shortName,
                    shape,
                    canonicalJson(sections),
                    now,
                    now);
        } catch (DuplicateKeyException ex) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "编码已存在", ex);
        }
        if (request.hasNonNull("categoryRef")) {
            UUID categoryRef;
            try {
                categoryRef = UUID.fromString(request.path("categoryRef").asText());
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRef must be an opaque UUID", failure);
            }
            lockCategories(dataNodeRef, brandRef, List.of(categoryRef));
            categoryFacts.replace(itemRef, singleCategoryRef(categoryRef));
        }
        return itemCommand(requestId, itemRef, "DRAFT", 1L, false);
    }

    private ObjectNode saveItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ObjectNode request,
            CatalogCoordinationSnapshot coordinationSnapshot) {
        String code = required(request, "itemCode");
        ObjectNode sectionsRequest =
                request.has("sections") && request.get("sections").isObject()
                        ? (ObjectNode) request.get("sections")
                        : mapper.createObjectNode();
        ObjectNode draft = sectionsRequest.has("catalogDraft")
                        && sectionsRequest.get("catalogDraft").isObject()
                ? ((ObjectNode) sectionsRequest.get("catalogDraft")).deepCopy()
                : sectionsRequest.deepCopy();
        rejectRetiredItemOwnedCatalogFields(sectionsRequest);
        rejectRetiredItemOwnedCatalogFields(draft);
        long expected = requiredCatalogExpectedVersion(request);
        // This is the same invocation and no write occurs between receipt
        // recheck and this owner command.  Reusing that immutable fact removes
        // only the duplicate pre-write load; the UPDATE version predicate and
        // post-write readback remain independent correctness boundaries.
        ItemRow current = coordinationSnapshot != null
                        && code.equals(coordinationSnapshot.current().code())
                ? coordinationSnapshot.current()
                : requireItem(dataNodeRef, brandRef, code);
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废商品不可修改");
        JsonNode skuTransitions = request.path("skuTransitions");
        if (skuTransitions.isArray() && !skuTransitions.isEmpty()) {
            validateSkuTransitionSave(current, sectionsRequest);
            return voidSkuTransitions(
                    commandContext, dataNodeRef, brandRef, requestId, current, expected, (ArrayNode) skuTransitions);
        }
        ObjectNode sections = (ObjectNode) json(current.sectionsJson()).deepCopy();
        validateSourceOwnedFields(current, sections, draft);
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(current.shapeKey());
        validateClientDerivedFields(draft, rule);
        removeClientDerivedCatalogFacts(draft);
        applyDerivedShapeFields(sections, rule);
        draft.fields().forEachRemaining(entry -> {
            // Inventory definitions are owned by inventory.stock_target/stock_bom and
            // are coordinated separately in the same REQUIRED transaction.  Keeping a
            // second catalog JSON copy would make the detail surface drift from the
            // owner fact, so the catalog owner deliberately ignores this section.
            if (!"inventoryBom".equals(entry.getKey()))
                sections.set(entry.getKey(), entry.getValue().deepCopy());
        });
        sectionsRequest.fields().forEachRemaining(entry -> {
            if (!Set.of("catalogDraft", "expectedCatalogVersion", "expectedInventoryVersions")
                    .contains(entry.getKey()))
                sections.set(entry.getKey(), entry.getValue().deepCopy());
        });
        removeRetiredGovernanceFacts(sections);
        ArrayNode nextSkus = normalizeSkuFacts(sections);
        ArrayNode nextCategoryRefs =
                sections.has("categoryRef") ? categoryRefArray(sections.path("categoryRef")) : categoryRefs(sections);
        ArrayNode nextCompositeGroups = compositeGroups(sections);
        ArrayNode nextAttributeAssignments =
                requiredArray(sections.path("attributeAssignments"), "attributeAssignments");
        ArrayNode nextOrderOptionConfigs = requiredArray(sections.path("orderOptionConfigs"), "orderOptionConfigs");
        ArrayNode nextSkuVariantDimensions = submittedSkuVariantDimensions(sections.path("skuVariantDimensions"));
        JsonNode nextImages = sections.path("images");
        JsonNode nextProductionTagRefs = sections.path("productionTagRefs");
        JsonNode nextTagRefs = sections.path("tagRefs");
        // inventoryBom is coordinated by the inventory owner and intentionally
        // not persisted in catalog JSON.  It is still a declared catalog
        // reference path, so validate the submitted canonical draft before the
        // coordinator can hand it across the owner boundary.
        ObjectNode referencePayload = sections.deepCopy();
        if (draft.has("inventoryBom"))
            referencePayload.set("inventoryBom", draft.path("inventoryBom").deepCopy());
        if (sectionsRequest.has("inventoryBom"))
            referencePayload.set(
                    "inventoryBom", sectionsRequest.path("inventoryBom").deepCopy());
        validateShapeOwnedSections(rule, referencePayload.path("inventoryBom"));
        skuVariantAxisFacts.validateRetirements(current.ref(), nextSkuVariantDimensions, nextSkus);
        validateSkuCombinations(nextSkus, nextSkuVariantDimensions, rule);
        validateDeclaredOpaqueReferences(dataNodeRef, brandRef, referencePayload, current.ref());
        validateUnitAssignments(commandContext, current.ref(), dataNodeRef, brandRef, sections, nextSkus, rule);
        Set<UUID> existingSkuRefs = skuFacts.existingRefs(current.ref());
        Set<UUID> retainedSkuRefs = new LinkedHashSet<>();
        nextSkus.forEach(sku ->
                retainedSkuRefs.add(UUID.fromString(sku.path("productSkuRef").asText())));
        Set<UUID> archivedSkuRefs = new LinkedHashSet<>(existingSkuRefs);
        archivedSkuRefs.removeAll(retainedSkuRefs);
        requireSkuRetirementUnreferenced(commandContext, archivedSkuRefs);
        ObjectNode persistedSections = sections.deepCopy();
        // A partial catalogDraft omits unchanged facts.  Preserve the existing
        // column value on omission, while an explicit JSON null still clears it.
        boolean shortNameSubmitted = persistedSections.has("shortName");
        String nextShortName = shortNameSubmitted ? removeShortName(persistedSections) : current.shortName();
        removeRelationalSectionFacts(persistedSections);
        String sectionJson = canonicalJson(persistedSections);
        String nextName = draft.has("name") ? required(draft, "name") : current.name();
        lockAndValidateCategoryRefs(dataNodeRef, brandRef, sections);
        lockCatalogAssetRefs(json(current.sectionsJson()), sections);
        int changed = jdbc.update(
                "UPDATE catalog.catalog_item SET name=?, short_name=?, sections=CAST(? AS JSONB), "
                        + "version=version+1, updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? "
                        + "AND "
                        + "code=? AND version=? AND status NOT IN ('ARCHIVED','VOIDED')",
                nextName,
                nextShortName,
                sectionJson,
                now(),
                dataNodeRef,
                brandRef,
                code,
                expected);
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        skuFacts.replace(current.ref(), nextSkus, archivedSkuRefs);
        replaceEffectiveUnitFacts(dataNodeRef, brandRef, current.ref(), sections, nextSkus);
        skuMediaFacts.replace(nextSkus);
        categoryFacts.replace(current.ref(), nextCategoryRefs);
        compositeFacts.replace(current.ref(), nextCompositeGroups);
        itemDefinitionFacts.replaceAttributeAssignments(dataNodeRef, brandRef, current.ref(), nextAttributeAssignments);
        itemDefinitionFacts.replaceOrderOptionConfigs(dataNodeRef, brandRef, current.ref(), nextOrderOptionConfigs);
        skuVariantAxisFacts.replace(current.ref(), nextSkuVariantDimensions);
        itemMediaFacts.replace(current.ref(), nextImages);
        itemReferenceFacts.replace(current.ref(), nextProductionTagRefs, nextTagRefs);
        return itemSaveReadback(requestId, dataNodeRef, brandRef, code, expected + 1);
    }

    private void validateUnitAssignments(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            UUID itemRef,
            String scope,
            String brand,
            ObjectNode sections,
            ArrayNode skus,
            CatalogInventoryShapeManifest.ShapeRule rule) {
        CatalogOwnerApi.UnitDefinitionReadback itemBase = optionalUuid(sections, "baseMeasureUnitRef") == null
                ? null
                : unitDefinitionFacts.requireActive(scope, brand, optionalUuid(sections, "baseMeasureUnitRef"));
        UUID itemSalesRef = optionalUuid(sections, "salesUnitRef");
        if (itemSalesRef != null) unitDefinitionFacts.requireActive(scope, brand, itemSalesRef);
        boolean hasEffectiveSalesUnit = itemSalesRef != null;
        List<InventoryOwnerApi.CatalogSkuBaseMeasureUnit> skuBaseMeasureUnits = new ArrayList<>();
        for (JsonNode sku : skus) {
            UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
            UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
            if (salesOverride != null) {
                unitDefinitionFacts.requireActive(scope, brand, salesOverride);
                hasEffectiveSalesUnit = true;
            }
            CatalogOwnerApi.UnitDefinitionReadback effectiveBase =
                    baseOverride == null ? itemBase : unitDefinitionFacts.requireActive(scope, brand, baseOverride);
            skuBaseMeasureUnits.add(new InventoryOwnerApi.CatalogSkuBaseMeasureUnit(
                    UUID.fromString(sku.path("productSkuRef").asText()), unitSnapshot(effectiveBase)));
        }
        if (inventory != null)
            inventory.validateCatalogItemBaseMeasureUnitTransition(
                    commandContext, itemRef, unitSnapshot(itemBase), skuBaseMeasureUnits);
        if (rule.usageCapabilities().stream().anyMatch(capability -> "SELLABLE".equals(capability.name()))
                && !hasEffectiveSalesUnit)
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_EFFECTIVE_SALES_UNIT_REQUIRED",
                    422,
                    /* format-wrap */
                    "可销售商品必须有有效销售单位");
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(CatalogOwnerApi.UnitDefinitionReadback unit) {
        return unit == null
                ? null
                : new InventoryOwnerApi.UnitSnapshot(
                        unit.unitRef(),
                        unit.code(),
                        unit.name(),
                        unit.unitDimension().name(),
                        unit.precision());
    }

    /** Persist catalog refs and effective base snapshots; inventory receives the snapshot, never a lookup key. */
    private void replaceEffectiveUnitFacts(
            String scope, String brand, UUID itemRef, ObjectNode sections, ArrayNode skus) {
        CatalogOwnerApi.UnitDefinitionReadback itemBase = optionalUuid(sections, "baseMeasureUnitRef") == null
                ? null
                : unitDefinitionFacts.requireActive(scope, brand, optionalUuid(sections, "baseMeasureUnitRef"));
        CatalogOwnerApi.UnitDefinitionReadback itemSales = optionalUuid(sections, "salesUnitRef") == null
                ? null
                : unitDefinitionFacts.requireActive(scope, brand, optionalUuid(sections, "salesUnitRef"));
        writeItemUnitSnapshots(itemRef, itemSales, itemBase);
        for (JsonNode sku : skus) {
            UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
            UUID effectiveRef = sku.hasNonNull("baseMeasureUnitOverrideRef")
                    ? UUID.fromString(sku.path("baseMeasureUnitOverrideRef").asText())
                    : itemBase == null ? null : itemBase.unitRef();
            CatalogOwnerApi.UnitDefinitionReadback salesOverride = nullableUuid(sku, "salesUnitOverrideRef") == null
                    ? null
                    : unitDefinitionFacts.requireActive(scope, brand, nullableUuid(sku, "salesUnitOverrideRef"));
            CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                    effectiveRef == null || !sku.hasNonNull("baseMeasureUnitOverrideRef")
                            ? null
                            : unitDefinitionFacts.requireActive(scope, brand, effectiveRef);
            CatalogOwnerApi.UnitDefinitionReadback effectiveSales = salesOverride == null ? itemSales : salesOverride;
            CatalogOwnerApi.UnitDefinitionReadback effectiveBase = baseOverride == null ? itemBase : baseOverride;
            writeSkuUnitFacts(skuRef, salesOverride, baseOverride, effectiveSales, effectiveBase);
        }
    }

    private void writeItemUnitSnapshots(
            UUID itemRef, CatalogOwnerApi.UnitDefinitionReadback sales, CatalogOwnerApi.UnitDefinitionReadback base) {
        jdbc.update(
                "UPDATE catalog.catalog_item SET sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_di"
                        + "mension=?,sales_unit_precision=?,"
                        + "base_measure_unit_ref=?,base_measure_unit_code=?,base_measure_unit_name=?,base_measure_u"
                        + "nit_dimension=?,base_measure_unit_precision=? WHERE item_ref=?",
                sales == null ? null : sales.unitRef(),
                sales == null ? null : sales.code(),
                sales == null ? null : sales.name(),
                sales == null ? null : sales.unitDimension().name(),
                sales == null ? null : sales.precision(),
                base == null ? null : base.unitRef(),
                base == null ? null : base.code(),
                base == null ? null : base.name(),
                base == null ? null : base.unitDimension().name(),
                base == null ? null : base.precision(),
                itemRef);
    }

    private void writeSkuUnitFacts(
            UUID skuRef,
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,
            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback sales,
            CatalogOwnerApi.UnitDefinitionReadback base) {
        jdbc.update(
                "UPDATE catalog.catalog_sku SET sales_unit_override_ref=?,base_measure_unit_override_ref=?,"
                        + "sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_dimension=?,sales_unit_p"
                        + "recision=?,"
                        + "base_measure_unit_ref=?,base_measure_unit_code=?,base_measure_unit_name=?,base_measure_u"
                        + "nit_dimension=?,base_measure_unit_precision=? "
                        + "WHERE product_sku_ref=?",
                salesOverride == null ? null : salesOverride.unitRef(),
                baseOverride == null ? null : baseOverride.unitRef(),
                sales == null ? null : sales.unitRef(),
                sales == null ? null : sales.code(),
                sales == null ? null : sales.name(),
                sales == null ? null : sales.unitDimension().name(),
                sales == null ? null : sales.precision(),
                base == null ? null : base.unitRef(),
                base == null ? null : base.code(),
                base == null ? null : base.name(),
                base == null ? null : base.unitDimension().name(),
                base == null ? null : base.precision(),
                skuRef);
    }

    private void writeCopiedEffectiveUnitFacts(
            String scope, String brand, UUID itemRef, ObjectNode sections, ArrayNode skus) {
        UUID itemSalesRef = nullableUuid(sections, "salesUnitRef");
        UUID itemBaseRef = nullableUuid(sections, "baseMeasureUnitRef");
        CatalogOwnerApi.UnitDefinitionReadback itemSales =
                itemSalesRef == null ? null : unitDefinitionFacts.requireInScope(scope, brand, itemSalesRef);
        CatalogOwnerApi.UnitDefinitionReadback itemBase =
                itemBaseRef == null ? null : unitDefinitionFacts.requireInScope(scope, brand, itemBaseRef);
        writeItemUnitSnapshots(itemRef, itemSales, itemBase);
        if (skus == null || !skus.isArray()) return;
        for (JsonNode sku : skus) {
            UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
            UUID salesOverrideRef = nullableUuid(sku, "salesUnitOverrideRef");
            UUID baseOverrideRef = nullableUuid(sku, "baseMeasureUnitOverrideRef");
            CatalogOwnerApi.UnitDefinitionReadback salesOverride = salesOverrideRef == null
                    ? null
                    : unitDefinitionFacts.requireInScope(scope, brand, salesOverrideRef);
            CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                    baseOverrideRef == null ? null : unitDefinitionFacts.requireInScope(scope, brand, baseOverrideRef);
            writeSkuUnitFacts(
                    skuRef,
                    salesOverride,
                    baseOverride,
                    salesOverride == null ? itemSales : salesOverride,
                    baseOverride == null ? itemBase : baseOverride);
        }
    }

    private int[] copyUnitDefinitions(List<UnitCopy> units) {
        if (units == null || units.isEmpty()) return new int[0];
        int[] changes = jdbc.batchUpdate(
                "INSERT INTO catalog.unit_definition(unit_ref,data_node_ref,brand_ref,code,name,dimension,precision"
                        + ",status,version,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?, ?,1,?,?) ON CONFLICT(data_node_ref,brand_ref,code) DO NOTHING",
                units.stream()
                        .map(unit -> new Object[] {
                            unit.targetRef(),
                            unit.dataNodeRef(),
                            unit.brandRef(),
                            unit.source().code(),
                            unit.source().name(),
                            unit.source().unitDimension(),
                            unit.source().precision(),
                            unit.source().status(),
                            now(),
                            now()
                        })
                        .toList());
        for (UnitCopy unit : units) {
            CatalogOwnerApi.UnitDefinitionReadback target =
                    unitDefinitionFacts.requireInScope(unit.dataNodeRef(), unit.brandRef(), unit.targetRef());
            if (!unit.source().code().equals(target.code())
                    || !unit.source().name().equals(target.name())
                    || !unit.source()
                            .unitDimension()
                            .equals(target.unitDimension().name())
                    || unit.source().precision() != target.precision())
                throw new CatalogOwnerApi.Problem(
                        "CATALOG_COPY_UNIT_CONFLICT",
                        422,
                        "目标计量单位与源定义不一致: " + unit.source().code());
        }
        return changes;
    }

    private Map<UUID, InventoryOwnerApi.UnitSnapshot> unitSnapshotMappings(
            Map<ReferenceKey, String> mappings, List<UnitRow> units) {
        if (units == null || units.isEmpty()) return Map.of();
        Map<UUID, InventoryOwnerApi.UnitSnapshot> result = new LinkedHashMap<>();
        for (UnitRow unit : units) {
            String targetRef =
                    mappings.get(new ReferenceKey("CATALOG_UNIT", unit.ref().toString()));
            if (targetRef == null || targetRef.isBlank())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "单位复制引用未完成映射");
            try {
                result.put(
                        unit.ref(),
                        new InventoryOwnerApi.UnitSnapshot(
                                UUID.fromString(targetRef),
                                unit.code(),
                                unit.name(),
                                unit.unitDimension(),
                                unit.precision()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "单位复制 targetRef 无效",
                        failure);
            }
        }
        return Map.copyOf(result);
    }

    /**
     * Cross-owner lifecycle judgement stays at Inventory's public API; catalog never reads inventory tables directly.
     */
    private void requireSkuRetirementUnreferenced(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext, Set<UUID> archivedSkuRefs) {
        if (archivedSkuRefs.isEmpty()) return;
        if (commandContext == null || inventory == null) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    "SKU retirement requires the catalog execution context and inventory owner API");
        }
        CatalogAuthorizationScope scope = commandContext.ownerScope();
        String dataNodeRef = scope.dataNodeId().toString();
        String brandRef = scope.brandRef();
        lockProductSkuRefs(archivedSkuRefs);
        List<UUID> orderedSkuRefs = new ArrayList<>(archivedSkuRefs);
        Map<UUID, List<SkuInboundReference>> catalogReferencesBySku =
                skuInboundReferencesByRefs(dataNodeRef, brandRef, orderedSkuRefs);
        Map<UUID, InventoryOwnerApi.CatalogReferenceDependenciesReadback> inventoryDependenciesBySku =
                inventory.catalogReferenceDependenciesByRefs(commandContext, "PRODUCT_SKU", orderedSkuRefs).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                InventoryOwnerApi.CatalogReferenceDependenciesReadback::reference,
                                value -> value,
                                (left, right) -> left,
                                LinkedHashMap::new));
        for (UUID skuRef : orderedSkuRefs) {
            List<SkuInboundReference> catalogReferences = catalogReferencesBySku.getOrDefault(skuRef, List.of());
            if (!catalogReferences.isEmpty()) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID",
                        422,
                        "product SKU " + skuRef + " is still referenced by catalog facts: "
                                + skuInboundSources(catalogReferences));
            }
            InventoryOwnerApi.CatalogReferenceDependenciesReadback dependencies =
                    inventoryDependenciesBySku.get(skuRef);
            if (dependencies == null) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "SKU inventory dependency readback is missing");
            }
            if (dependencies.hasDependentFacts()) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID",
                        422,
                        "product SKU " + skuRef + " is still referenced by inventory facts: "
                                + inventoryDependencySources(dependencies));
            }
        }
    }

    private void validateSkuTransitionSave(ItemRow current, ObjectNode sections) {
        if (sections == null || !sections.path("catalogDraft").isObject()) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "skuTransitions requires the catalog save envelope");
        }
        java.util.Iterator<String> fields = sections.path("catalogDraft").fieldNames();
        Set<String> allowed = Set.of("name", "shapeKey", "images", "productionTagRefs", "categoryRef");
        while (fields.hasNext()) {
            String field = fields.next();
            if (!allowed.contains(field))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with catalog section changes");
        }
        if (sections.path("inventoryConfiguration").path("nodes").isArray()
                && !sections.path("inventoryConfiguration").path("nodes").isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with inventory changes");
        }
        if (sections.path("expectedInventoryVersions").isArray()
                && !sections.path("expectedInventoryVersions").isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with inventory changes");
        }
        JsonNode draft = sections.path("catalogDraft");
        if (!current.name().equals(required(draft, "name"))
                || !current.shapeKey().equals(required(draft, "shapeKey"))) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with catalog changes");
        }
        JsonNode currentSections = json(current.sectionsJson());
        for (String field : List.of("images", "productionTagRefs", "categoryRef")) {
            JsonNode currentValue = currentSections.path(field);
            if (draft.has(field) && !canonicalJson(currentValue).equals(canonicalJson(draft.path(field)))) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with catalog changes");
            }
        }
    }

    private ObjectNode voidSkuTransitions(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ItemRow current,
            long expectedCatalogVersion,
            ArrayNode transitions) {
        if (commandContext == null || inventory == null) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    "SKU VOID requires the catalog execution context and inventory owner API");
        }
        if (current.version() != expectedCatalogVersion) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        if (transitions.isEmpty())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skuTransitions must not be empty");
        List<SkuTransitionRequest> requested = new ArrayList<>();
        Set<UUID> seen = new LinkedHashSet<>();
        for (JsonNode transition : transitions) {
            if (!transition.isObject())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skuTransitions must contain objects");
            UUID skuRef = requiredUuid(transition, "skuRef");
            if (!seen.add(skuRef))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "skuTransitions must not contain duplicate skuRef");
            String targetStatus = required(transition, "targetStatus");
            if (!"VOIDED".equals(targetStatus))
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "SKU transitions only support VOIDED");
            long expectedVersion = requiredLong(transition, "expectedVersion", -1);
            if (expectedVersion < 0)
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "sku transition expectedVersion is required");
            requested.add(new SkuTransitionRequest(skuRef, targetStatus, expectedVersion));
        }
        requested.stream().map(SkuTransitionRequest::skuRef).sorted().forEach(skuRef -> {
            if (!current.ref().equals(findSkuItemRef(dataNodeRef, brandRef, skuRef))) {
                throw new CatalogOwnerApi.Problem(
                        "SCOPE_FORBIDDEN", 403, "SKU does not belong to the current catalog item");
            }
            CatalogSkuFacts.LifecycleRow lifecycle = skuFacts.lockLifecycle(current.ref(), skuRef);
            SkuTransitionRequest requestedTransition = requested.stream()
                    .filter(value -> value.skuRef().equals(skuRef))
                    .findFirst()
                    .orElseThrow();
            if (lifecycle.version() != requestedTransition.expectedVersion())
                throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "SKU 版本已变化");
            if ("VOIDED".equals(lifecycle.status()))
                throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废 SKU 不可修改");
            if ("ARCHIVED".equals(lifecycle.status()))
                throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已归档 SKU 不可作废");
        });
        Set<UUID> refs = requested.stream()
                .map(SkuTransitionRequest::skuRef)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        requireSkuRetirementUnreferenced(commandContext, refs);
        lockCatalogItemForUpdate(dataNodeRef, brandRef, current.ref(), expectedCatalogVersion);
        if (jdbc.update(
                        "UPDATE catalog.catalog_item SET version=version+1,updated_at_epoch_millis=? WHERE item_ref=? "
                                + "AND data_node_ref=? AND brand_ref=? AND version=? AND status <> 'VOIDED'",
                        now(),
                        current.ref(),
                        dataNodeRef,
                        brandRef,
                        expectedCatalogVersion)
                != 1) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        requested.forEach(
                transition -> skuFacts.markVoided(current.ref(), transition.skuRef(), transition.expectedVersion()));
        ArrayNode readback = mapper.createArrayNode();
        requested.forEach(transition -> {
            ObjectNode result = readback.addObject();
            result.put("skuRef", transition.skuRef().toString())
                    .put("targetStatus", "VOIDED")
                    .put("version", transition.expectedVersion() + 1)
                    .put("canVoid", false);
            result.putArray("blockingReferences");
            result.putArray("dependentFacts");
        });
        return itemSaveReadback(requestId, dataNodeRef, brandRef, current.code(), expectedCatalogVersion + 1, readback);
    }

    private UUID findSkuItemRef(String dataNodeRef, String brandRef, UUID skuRef) {
        List<UUID> refs = jdbc.query(
                "SELECT sku.item_ref FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "sku.product_sku_ref=?",
                (result, row) -> result.getObject(1, UUID.class),
                dataNodeRef,
                brandRef,
                skuRef);
        if (refs.isEmpty()) {
            Boolean exists = jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE product_sku_ref=?)", Boolean.class, skuRef);
            if (Boolean.TRUE.equals(exists))
                throw new CatalogOwnerApi.Problem(
                        "SCOPE_FORBIDDEN", 403, "SKU does not belong to the current data scope");
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "SKU 不存在");
        }
        return refs.get(0);
    }

    private void lockCatalogItemForUpdate(String dataNodeRef, String brandRef, UUID itemRef, long expectedVersion) {
        List<Long> versions = jdbc.query(
                "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref=? FOR "
                        + "UPDATE",
                (result, row) -> result.getLong(1),
                dataNodeRef,
                brandRef,
                itemRef);
        if (versions.isEmpty() || versions.get(0) != expectedVersion)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
    }

    private Map<UUID, List<SkuInboundReference>> skuInboundReferencesByRefs(
            String dataNodeRef, String brandRef, Collection<UUID> skuRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(skuRefs));
        if (orderedRefs.isEmpty()) return Map.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT component.product_sku_ref,component.composite_component_ref,"
                        + "owner_item.item_ref,owner_item.code FROM "
                        + "catalog.catalog_composite_component component JOIN catalog.catalog_composite_group "
                        + "group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item "
                        + "owner_item ON owner_item.item_ref=group_row.item_ref JOIN catalog.catalog_sku target_sku ON "
                        + "target_sku.product_sku_ref=component.product_sku_ref WHERE owner_item.data_node_ref=? AND "
                        + "owner_item.brand_ref=? "
                        + "AND "
                        + "owner_item.status <> 'VOIDED' AND component.product_sku_ref = ANY(?::uuid[]) "
                        + "AND component.status <> "
                        + "'ARCHIVED' AND owner_item.item_ref <> target_sku.item_ref ORDER BY "
                        + "component.product_sku_ref,owner_item.code,component.composite_component_ref",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, List<SkuInboundReference>> referencesBySku = new LinkedHashMap<>();
                    while (result.next()) {
                        UUID skuRef = result.getObject(1, UUID.class);
                        referencesBySku
                                .computeIfAbsent(skuRef, ignored -> new ArrayList<>())
                                .add(new SkuInboundReference(
                                        result.getObject(2, UUID.class),
                                        result.getObject(3, UUID.class),
                                        result.getString(4)));
                    }
                    return referencesBySku;
                });
    }

    private String skuInboundSources(List<SkuInboundReference> references) {
        return references.stream()
                .map(reference -> reference.ownerCode() + "(" + reference.componentRef() + ")")
                .sorted()
                .collect(java.util.stream.Collectors.joining(","));
    }

    /** The same transaction lock is intentionally duplicated in Inventory: foundation has no JDBC dependency. */
    private void lockProductSkuRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .forEach(ref -> AdvisoryLock.acquire(jdbc, 0x43534B55, ref));
    }

    /** Must stay byte-for-byte compatible with InventoryOwnerService's item lifecycle lock. */
    private void lockCatalogItemRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .forEach(ref -> AdvisoryLock.acquire(jdbc, 0x4349544D, ref));
    }

    /** Must stay byte-for-byte compatible with InventoryOwnerService's BOM option-value lock. */
    private void lockSkuAttributeValueRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .forEach(ref -> AdvisoryLock.acquire(jdbc, 0x43534156, ref));
    }

    /** Assigns server-owned SKU identities and normalizes the relation payload before the sole relational write. */
    private ArrayNode normalizeSkuFacts(ObjectNode sections) {
        JsonNode submitted = sections.path("skus");
        if (submitted.isMissingNode() || submitted.isNull()) {
            ArrayNode empty = mapper.createArrayNode();
            sections.set("skus", empty);
            return empty;
        }
        if (!submitted.isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skus must be an array");
        ArrayNode skus = (ArrayNode) submitted;
        Set<UUID> refs = new LinkedHashSet<>();
        Set<String> codes = new LinkedHashSet<>();
        int defaults = 0;
        for (int index = 0; index < skus.size(); index++) {
            JsonNode value = skus.get(index);
            if (!value.isObject())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skus must contain objects");
            ObjectNode sku = (ObjectNode) value;
            String rawRef = sku.path("productSkuRef").asText("").trim();
            UUID ref;
            try {
                ref = rawRef.isBlank() ? UUID.randomUUID() : UUID.fromString(rawRef);
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "productSkuRef must be UUID", failure);
            }
            if (!refs.add(ref))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "productSkuRef must be unique within an item");
            sku.put("productSkuRef", ref.toString());
            String code = required(sku, "skuCode");
            if (!codes.add(code))
                throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "skuCode must be unique within an item");
            required(sku, "skuName");
            if (!sku.has("displayOrder")) sku.put("displayOrder", index);
            if (sku.path("displayOrder").asInt(-1) < 0)
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "sku displayOrder must not be negative");
            if (sku.path("isDefault").asBoolean(false)) defaults++;
            if (defaults > 1) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "only one SKU may be default");
            sku.put("variantCombinationDigest", skuVariantCombinationDigest(sku));
        }
        return skus;
    }

    private ArrayNode categoryRefs(ObjectNode sections) {
        JsonNode submitted = sections.path("categoryRefs");
        if (submitted.isMissingNode() || submitted.isNull()) {
            ArrayNode empty = mapper.createArrayNode();
            sections.set("categoryRefs", empty);
            return empty;
        }
        if (!submitted.isArray())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs must be an array of UUID refs");
        return (ArrayNode) submitted;
    }

    /**
     * Validates the complete SKU combination before the catalog row or any relation row is written. The database
     * partial unique index remains the concurrency boundary; this owner check gives one command a typed error and
     * preserves its all-or-nothing behaviour for invalid full-array saves.
     */
    private void validateSkuCombinations(ArrayNode skus, ArrayNode axes, CatalogInventoryShapeManifest.ShapeRule rule) {
        Map<String, Set<String>> allowed = new LinkedHashMap<>();
        for (JsonNode axis : axes) {
            String attributeRef = axis.path("attributeRef").asText("");
            Set<String> values = new LinkedHashSet<>();
            if (axis.path("values").isArray())
                axis.path("values")
                        .forEach(value -> values.add(value.path("valueRef").asText("")));
            allowed.put(attributeRef, values);
        }
        Set<String> activeDigests = new LinkedHashSet<>();
        boolean requiredMatrix = "REQUIRED_MATRIX".equals(rule.skuMode()) && !allowed.isEmpty();
        for (JsonNode sku : skus) {
            Set<String> skuAttributes = new LinkedHashSet<>();
            if (sku.path("attributeValueRefs").isArray())
                for (JsonNode value : sku.path("attributeValueRefs")) {
                    String attributeRef = value.path("attributeRef").asText("");
                    String valueRef = value.path("attributeValueRef").asText("");
                    if (!skuAttributes.add(attributeRef)) {
                        throw new CatalogOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "a SKU can contain only one value for each attribute");
                    }
                    if (!allowed.containsKey(attributeRef)
                            || !allowed.get(attributeRef).contains(valueRef)) {
                        throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                "SKU attribute value must belong to this item's selected variant axis");
                    }
                }
            if (Set.of("ARCHIVED", "VOIDED").contains(sku.path("status").asText("ENABLED"))) continue;
            if (requiredMatrix && !skuAttributes.equals(allowed.keySet())) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR",
                        422,
                        "required SKU matrix combinations must select exactly one value from every axis");
            }
            String digest = sku.path("variantCombinationDigest").asText("").trim();
            if (digest.isEmpty())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "variantCombinationDigest is required");
            if (!activeDigests.add(digest)) {
                throw new CatalogOwnerApi.Problem(
                        "DUPLICATE_VARIANT_COMBINATION",
                        409,
                        "active SKU variant combinations must be unique within an item");
            }
        }
    }

    /**
     * Enforces the shape-owned portions of a save at the owner boundary. The wire nodeType is intentionally ignored:
     * the coordinator and Inventory derive the semantic node from skuCode/optionValueCode and opaque refs.
     */
    private void validateShapeOwnedSections(CatalogInventoryShapeManifest.ShapeRule rule, JsonNode inventoryBom) {
        JsonNode manifest = generatedCatalogManifest();
        if (inventoryBom == null || !inventoryBom.isArray() || inventoryBom.isEmpty()) return;
        JsonNode admission = manifest.path("typeEffects")
                .path("shapeNodeAdmission")
                .path(rule.shapeKey().name());
        if (!admission.path("inventoryBom").asBoolean(false)) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "该商品形态不支持库存 BOM");
        }
        JsonNode allowedNodeTypes = admission.path("allowedNodeTypes");
        if (!allowedNodeTypes.isArray()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态节点准入契约不可用");
        }
        for (JsonNode entry : inventoryBom) {
            if (!entry.isObject())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "inventoryBom must contain objects");
            String skuCode = entry.path("skuCode").asText("").trim();
            String optionValueCode = entry.path("optionValueCode").asText("").trim();
            if (!skuCode.isBlank() && !optionValueCode.isBlank()) {
                {
                    throw new CatalogOwnerApi.Problem(
                            ("VALIDATION_ERROR"),
                            (422),
                            /* format-wrap */
                            ("BOM owner 不能同时指定 SKU 与选项值"));
                }
            }
            String semanticNodeType =
                    !optionValueCode.isBlank() ? "OPTION_VALUE" : !skuCode.isBlank() ? "SKU" : "CATALOG_ITEM";
            if (!containsText(allowedNodeTypes, semanticNodeType)) {
                {
                    throw new CatalogOwnerApi.Problem(
                            ("VALIDATION_ERROR"),
                            (422),
                            /* format-wrap */
                            ("该商品形态不允许此 BOM 引用节点: " + semanticNodeType));
                }
            }
            String submittedMode = entry.path("mode").asText("").trim();
            if (!submittedMode.isBlank()) {
                JsonNode eligibleModes = manifest.path("typeEffects")
                        .path("modeEligibilityByShape")
                        .path(rule.shapeKey().name())
                        .path(semanticNodeType);
                if (!eligibleModes.isArray() || !containsText(eligibleModes, submittedMode)) {
                    throw new CatalogOwnerApi.Problem(
                            "VALIDATION_ERROR",
                            422,
                            "该商品形态的" + " " + semanticNodeType + " 节点不允许库存模式: "
                                    /* format-wrap */
                                    + submittedMode);
                }
            }
        }
    }

    private JsonNode generatedCatalogManifest() {
        try {
            return mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态契约不可用", failure);
        }
    }

    /**
     * These values describe normalized owner facts. The wire contract rejects them, while this defensive boundary keeps
     * an older direct caller from recreating a second write authority before P3-2 has stopped sending them.
     */
    private void removeClientDerivedCatalogFacts(ObjectNode draft) {
        draft.remove("skuSummary");
        draft.remove("ordering");
        draft.remove("listedSalePrice");
        draft.remove("priceGranularity");
        draft.remove("missingPriceCount");
        JsonNode skus = draft.get("skus");
        if (skus instanceof ArrayNode skuDrafts) {
            skuDrafts.forEach(sku -> {
                if (sku instanceof ObjectNode skuDraft) skuDraft.remove("version");
            });
        }
    }

    /** Retired item-local payloads are rejected instead of being silently ignored or persisted in sections. */
    private static void rejectRetiredItemOwnedCatalogFields(ObjectNode payload) {
        for (String field : List.of("attributes", "orderOptions")) {
            if (payload.has(field))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR",
                        422,
                        /* format-wrap */
                        "商品属性和点单选项请从对应库维护");
        }
    }

    private ArrayNode compositeGroups(ObjectNode sections) {
        JsonNode submitted = sections.path("compositeGroups");
        if (submitted.isMissingNode() || submitted.isNull()) {
            ArrayNode empty = mapper.createArrayNode();
            sections.set("compositeGroups", empty);
            return empty;
        }
        if (!submitted.isArray())
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "compositeGroups must be an array");
        return (ArrayNode) submitted;
    }

    private String skuVariantCombinationDigest(ObjectNode sku) {
        List<String> values = new ArrayList<>();
        JsonNode refs = sku.path("attributeValueRefs");
        if (refs.isArray())
            for (JsonNode value : refs) {
                UUID attribute = requiredUuidValue(value.path("attributeRef"), "attributeValueRefs[].attributeRef");
                UUID selected =
                        requiredUuidValue(value.path("attributeValueRef"), "attributeValueRefs[].attributeValueRef");
                values.add(attribute + ":" + selected);
            }
        Collections.sort(values);
        return digest(String.join("|", values));
    }

    /** The shape manifest is the only authority for fields derived from shapeKey. */
    private CatalogInventoryShapeManifest.ShapeRule shapeRule(String shapeKey) {
        try {
            return CatalogInventoryShapeManifest.SHAPE_RULES.stream()
                    .filter(rule -> rule.shapeKey().name().equals(shapeKey))
                    .findFirst()
                    .orElseThrow(
                            () -> new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shapeKey is not supported"));
        } catch (CatalogOwnerApi.Problem problem) {
            throw problem;
        }
    }

    private void applyDerivedShapeFields(ObjectNode sections, CatalogInventoryShapeManifest.ShapeRule rule) {
        sections.put("shapeKey", rule.shapeKey().name());
        sections.put("itemKind", rule.itemKind());
        sections.put("measureMode", rule.measureMode());
        sections.put("skuMode", rule.skuMode());
        sections.put("priceGranularity", rule.priceGranularity());
        ArrayNode capabilities = sections.putArray("usageCapabilities");
        rule.usageCapabilities().forEach(capability -> capabilities.add(capability.name()));
    }

    private void validateClientDerivedFields(ObjectNode draft, CatalogInventoryShapeManifest.ShapeRule rule) {
        validateDerivedText(draft, "itemKind", rule.itemKind());
        validateDerivedText(draft, "measureMode", rule.measureMode());
        validateDerivedText(draft, "skuMode", rule.skuMode());
        validateDerivedText(draft, "priceGranularity", rule.priceGranularity());
        JsonNode capabilities = draft.get("usageCapabilities");
        if (capabilities != null && !capabilities.isNull()) {
            if (!capabilities.isArray() || !capabilities.toString().equals(capabilityJson(rule))) {
                throw new CatalogOwnerApi.Problem(
                        "SHAPE_DERIVATION_CONFLICT", 422, "usageCapabilities must be derived from shapeKey");
            }
        }
        JsonNode shape = draft.get("shapeKey");
        if (shape != null && !shape.isNull() && !rule.shapeKey().name().equals(shape.asText())) {
            throw new CatalogOwnerApi.Problem(
                    "SHAPE_DERIVATION_CONFLICT", 422, "shapeKey cannot change after creation");
        }
    }

    private String capabilityJson(CatalogInventoryShapeManifest.ShapeRule rule) {
        ArrayNode expected = mapper.createArrayNode();
        rule.usageCapabilities().forEach(capability -> expected.add(capability.name()));
        return expected.toString();
    }

    private void validateDerivedText(ObjectNode draft, String field, String expected) {
        JsonNode value = draft.get(field);
        if (value != null && !value.isNull() && !expected.equals(value.asText())) {
            throw new CatalogOwnerApi.Problem(
                    "SHAPE_DERIVATION_CONFLICT", 422, field + " must be derived from shapeKey");
        }
    }

    private ObjectNode transitionItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ObjectNode request) {
        String code = required(request, "itemCode");
        long expected = requiredLong(request, "expectedVersion", 1);
        String target = required(request, "targetStatus");
        if (!CatalogOwnerTypes.STATUSES.contains(target))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "状态不在闭集");
        ItemRow current = requireItem(dataNodeRef, brandRef, code);
        long nextVersion =
                transitionItemState(commandContext, dataNodeRef, brandRef, requestId, current, expected, target, false);
        return itemCommand(requestId, current.ref(), target, nextVersion, false);
    }

    /** Shared lifecycle semantics for single and batch commands; batch adds only same-state no-op behavior. */
    private long transitionItemState(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ItemRow current,
            long expected,
            String target,
            boolean sameStateIsNoOp) {
        if (sameStateIsNoOp && target.equals(current.status())) return current.version();
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废记录不可修改");
        if (expected != current.version()) {
            throw new CatalogOwnerApi.Problem(("VERSION_CONFLICT"), (409), ("商品版本已变化"));
        }
        if ("ENABLED".equals(target) && !"ENABLED".equals(current.status())) validateItemActivation(current);
        if ("VOIDED".equals(target)) requireItemRetirementUnreferenced(commandContext, current);
        if ("VOIDED".equals(target) && itemReferencedByOtherItems(dataNodeRef, brandRef, current)) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_BLOCKS_VOID"),
                    (422),
                    /* format-wrap */
                    ("商品仍被其他商品引用，不能作废"));
        }
        if ("VOIDED".equals(target) && hasItemDependencies(current)) {
            throw new CatalogOwnerApi.Problem(
                    ("DEPENDENT_FACTS_BLOCK_VOID"),
                    (422),
                    /* format-wrap */
                    ("商品仍有依赖事实，不能作废"));
        }
        if ("VOIDED".equals(target)) lockCatalogAssetRefs(json(current.sectionsJson()));
        if (jdbc.update(
                        "UPDATE catalog.catalog_item SET status=?, version=version+1, updated_at_epoch_millis=? WHERE "
                                + "item_ref=? AND data_node_ref=? AND brand_ref=? AND version=?",
                        target,
                        now(),
                        current.ref(),
                        dataNodeRef,
                        brandRef,
                        expected)
                != 1) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        return expected + 1;
    }

    /** Inventory owns its references, so item retirement cannot use only catalog-side facts. */
    private void requireItemRetirementUnreferenced(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext, ItemRow current) {
        if (commandContext == null || inventory == null) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    "item void requires the catalog execution context and inventory owner API");
        }
        lockCatalogItemRefs(List.of(current.ref()));
        InventoryOwnerApi.CatalogReferenceDependenciesReadback dependencies = inventory.catalogReferenceDependencies(
                commandContext, "CATALOG_ITEM", current.ref().toString());
        if (dependencies.hasDependentFacts()) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID",
                    422,
                    /* format-wrap */
                    "商品仍被库存事实引用，不能作废：" + inventoryDependencySources(dependencies));
        }
    }

    private void validateItemActivation(ItemRow row) {
        JsonNode sections = json(row.sectionsJson());
        String priceGranularity = sections.path("priceGranularity").asText("ITEM");
        if ("SKU".equals(priceGranularity)) {
            JsonNode skus = sections.path("skus");
            boolean hasEnabled = false;
            if (skus.isArray())
                for (JsonNode sku : skus) {
                    if (!"ENABLED".equals(sku.path("status").asText("ENABLED"))) continue;
                    hasEnabled = true;
                    if (!sku.path("standardSalePrice").isIntegralNumber()) {
                        throw new CatalogOwnerApi.Problem(
                                ("VALIDATION_ERROR"),
                                (422),
                                /* format-wrap */
                                ("启用前请为每个启用 SKU 补齐标准价"));
                    }
                }
            if (!hasEnabled) {
                throw new CatalogOwnerApi.Problem(
                        ("VALIDATION_ERROR"),
                        (422),
                        /* format-wrap */
                        ("启用前请至少维护一个启用 SKU"));
            }
            return;
        }
        if (!sections.path("standardSalePrice").isIntegralNumber())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "启用前请补齐商品标准价");
    }

    private ObjectNode createCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "code");
        String name = required(request, "name");
        UUID parentCategoryRef = optionalUuid(request, "parentCategoryRef");
        if (parentCategoryRef != null) validateCategoryParent(dataNodeRef, brandRef, parentCategoryRef);
        UUID categoryRef = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO catalog.catalog_category "
                            + "(category_ref,data_node_ref,brand_ref,code,name,parent_category_ref,display_order,create"
                            + "d_at"
                            + "_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?)",
                    categoryRef,
                    dataNodeRef,
                    brandRef,
                    code,
                    name,
                    parentCategoryRef,
                    nextCategoryDisplayOrder(dataNodeRef, brandRef, parentCategoryRef),
                    now(),
                    now());
        } catch (DuplicateKeyException ex) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "分类编码已存在", ex);
        }
        return categoryCommand(requestId, category(dataNodeRef, brandRef, categoryRef));
    }

    private ObjectNode updateCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        CategoryRow current = lockCategory(dataNodeRef, brandRef, categoryRef);
        requireCategoryVersion(current, expected);
        jdbc.update(
                "UPDATE catalog.catalog_category SET name=?,version=version+1,updated_at_epoch_millis=? WHERE "
                        + "category_ref=?",
                required(request, "name"),
                now(),
                categoryRef);
        return categoryCommand(requestId, category(dataNodeRef, brandRef, categoryRef));
    }

    private ObjectNode moveCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        String action = required(request, "action");
        CategoryRow current = lockCategory(dataNodeRef, brandRef, categoryRef);
        requireCategoryVersion(current, expected);
        switch (action) {
            case "REPARENT" -> {
                UUID parentCategoryRef = optionalUuid(request, "parentCategoryRef");
                if (categoryRef.equals(parentCategoryRef))
                    throw new CatalogOwnerApi.Problem("HIERARCHY_CYCLE", 422, "分类不能以自身作为父分类");
                if (parentCategoryRef != null) validateCategoryParent(dataNodeRef, brandRef, parentCategoryRef);
                if (parentCategoryRef != null && categoryHasChildren(dataNodeRef, brandRef, categoryRef))
                    throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "分类层级最多支持两级");
                lockCategorySiblings(dataNodeRef, brandRef, current.parentCategoryRef());
                lockCategorySiblings(dataNodeRef, brandRef, parentCategoryRef);
                jdbc.update(
                        "UPDATE catalog.catalog_category SET "
                                + "parent_category_ref=?,display_order=?,version=version+1,updated_at_epoch_millis=? "
                                + "WHERE "
                                + "category_ref=?",
                        parentCategoryRef,
                        nextCategoryDisplayOrder(dataNodeRef, brandRef, parentCategoryRef),
                        now(),
                        categoryRef);
            }
            case "UP", "DOWN" -> moveCategoryAmongSiblings(dataNodeRef, brandRef, current, action);
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "category move action is not supported");
        }
        return categoryCommand(requestId, category(dataNodeRef, brandRef, categoryRef));
    }

    private ObjectNode deleteCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        List<UUID> subtree = categorySubtreeRefs(dataNodeRef, brandRef, categoryRef);
        List<CategoryRow> locked = lockCategories(dataNodeRef, brandRef, subtree);
        CategoryRow root = locked.stream()
                .filter(row -> row.ref().equals(categoryRef))
                .findFirst()
                .orElseThrow(() -> new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在"));
        requireCategoryVersion(root, expected);
        List<String> blockingItems = categoryReferencedItems(dataNodeRef, brandRef, subtree);
        if (!blockingItems.isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_BLOCKS_DELETE"),
                    (422),
                    /* format-wrap */
                    ("分类或其子分类仍被商品引用，不能删除"));
        }
        String placeholders = String.join(",", Collections.nCopies(subtree.size(), "?"));
        jdbc.update(
                "DELETE FROM catalog.catalog_category WHERE category_ref IN (" + placeholders + ")", subtree.toArray());
        ObjectNode result = mapper.createObjectNode()
                .put("categoryRef", categoryRef.toString())
                .put("deletedSubtreeSize", subtree.size());
        ArrayNode deletedCategoryCodes = result.putArray("deletedCategoryCodes");
        locked.stream().map(CategoryRow::code).sorted().forEach(deletedCategoryCodes::add);
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .set("result", result);
    }

    private void validateCategoryParent(String scope, String brand, UUID parentCategoryRef) {
        CategoryRow parent = lockCategory(scope, brand, parentCategoryRef);
        if (parent.parentCategoryRef() != null)
            throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "分类层级最多支持两级");
    }

    private void moveCategoryAmongSiblings(String scope, String brand, CategoryRow current, String action) {
        List<CategoryRow> siblings = lockCategorySiblings(scope, brand, current.parentCategoryRef());
        siblings.sort(
                java.util.Comparator.comparingInt(CategoryRow::displayOrder).thenComparing(CategoryRow::code));
        int index = java.util.stream.IntStream.range(0, siblings.size())
                .filter(i -> siblings.get(i).ref().equals(current.ref()))
                .findFirst()
                .orElseThrow(() -> new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在"));
        int neighborIndex = "UP".equals(action) ? index - 1 : index + 1;
        if (neighborIndex < 0 || neighborIndex >= siblings.size())
            throw new CatalogOwnerApi.Problem("MOVE_BOUNDARY", 422, "分类已位于当前层级边界");
        CategoryRow neighbor = siblings.get(neighborIndex);
        long now = now();
        jdbc.update(
                "UPDATE catalog.catalog_category SET display_order=?,version=version+1,updated_at_epoch_millis=? WHERE "
                        + "category_ref=?",
                neighbor.displayOrder(),
                now,
                current.ref());
        jdbc.update(
                "UPDATE catalog.catalog_category SET display_order=?,version=version+1,updated_at_epoch_millis=? WHERE "
                        + "category_ref=?",
                current.displayOrder(),
                now,
                neighbor.ref());
    }

    private ObjectNode createDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String kind = requiredDictionaryKind(request),
                code = required(request, "code"),
                name = required(request, "name");
        UUID parentEntryRef = optionalUuid(request, "parentEntryRef");
        validateDictionaryParent(dataNodeRef, brandRef, kind, parentEntryRef);
        int displayOrder = nextDictionaryDisplayOrder(dataNodeRef, brandRef, kind);
        UUID entryRef = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO catalog.dictionary_entry "
                            + "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,parent_entry_ref,display_or"
                            + "der,"
                            + "created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    entryRef,
                    dataNodeRef,
                    brandRef,
                    kind,
                    code,
                    name,
                    parentEntryRef,
                    displayOrder,
                    now(),
                    now());
        } catch (DuplicateKeyException ex) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "字典编码已存在", ex);
        }
        return dictionaryCommand(requestId, entryRef, kind, code, name, "ENABLED", parentEntryRef, 1L);
    }

    private ObjectNode updateDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String kind = requiredDictionaryKind(request),
                code = required(request, "entryCode"),
                name = required(request, "name");
        long expected = requiredLong(request, "expectedVersion", 1);
        if (jdbc.update(
                        "UPDATE catalog.dictionary_entry SET name=?,version=version+1,updated_at_epoch_millis=? WHERE "
                                + "data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND version=? AND "
                                + "status <> 'VOIDED'",
                        name,
                        now(),
                        dataNodeRef,
                        brandRef,
                        kind,
                        code,
                        expected)
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "字典版本已变化");
        return dictionaryCommand(
                requestId,
                dictionaryEntryRef(dataNodeRef, brandRef, kind, code),
                kind,
                code,
                name,
                dictionaryStatus(dataNodeRef, brandRef, kind, code),
                dictionaryParentRef(dataNodeRef, brandRef, kind, code),
                expected + 1);
    }

    private ObjectNode reorderDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String kind = requiredDictionaryKind(request);
        JsonNode codes = request.get("orderedCodes");
        if (codes == null || !codes.isArray())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "orderedCodes 必须为数组");

        List<DictionaryRow> locked = lockDictionaryEntriesForReorder(dataNodeRef, brandRef, kind);
        List<DictionaryRow> current = locked.stream()
                .sorted(java.util.Comparator.comparingInt(DictionaryRow::displayOrder)
                        .thenComparing(DictionaryRow::code))
                .toList();
        List<String> orderedCodes = dictionaryOrderCodes(codes);
        validateDictionaryOrder(current, orderedCodes);

        long updatedAt = now();
        for (int index = 0; index < current.size(); index++) {
            jdbc.update(
                    "UPDATE catalog.dictionary_entry SET display_order=?,version=version+1,updated_at_epoch_millis=? "
                            + "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?",
                    index,
                    updatedAt,
                    dataNodeRef,
                    brandRef,
                    kind,
                    orderedCodes.get(index));
        }
        return dictionary(dataNodeRef, brandRef, requestId, kind, request);
    }

    private ObjectNode transitionDictionary(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ObjectNode request) {
        String kind = requiredDictionaryKind(request),
                code = required(request, "entryCode"),
                status = required(request, "targetStatus");
        long expected = requiredLong(request, "expectedVersion", 1);
        if (!CatalogInventoryShapeManifest.accepts("dictionaryEntryStatus", status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典状态不合法");
        if ("VOIDED".equals(status)) {
            if (dictionaryReferenced(dataNodeRef, brandRef, kind, code)) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID",
                        422,
                        /* format-wrap */
                        "字典条目仍被商品引用，不能作废");
            }
            requireInventoryDictionaryReferenceUnreferenced(commandContext, dataNodeRef, brandRef, kind, code);
        }
        if (jdbc.update(
                        "UPDATE catalog.dictionary_entry SET status=?,version=version+1,updated_at_epoch_millis=? "
                                + "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND "
                                + "version=? "
                                + "AND status <> 'VOIDED'",
                        status,
                        now(),
                        dataNodeRef,
                        brandRef,
                        kind,
                        code,
                        expected)
                != 1) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "字典版本已变化");
        }
        return dictionaryCommand(
                requestId,
                dictionaryEntryRef(dataNodeRef, brandRef, kind, code),
                kind,
                code,
                dictionaryName(dataNodeRef, brandRef, kind, code),
                status,
                dictionaryParentRef(dataNodeRef, brandRef, kind, code),
                expected + 1);
    }

    /** Inventory owns BOM facts, so its public judgement closes the catalog lifecycle boundary. */
    private void requireInventoryDictionaryReferenceUnreferenced(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String kind,
            String code) {
        // SKU sales-attribute values are catalog-owned dictionary facts.  Their
        // old inventory dependency probe used the retired SKU_ATTRIBUTE_VALUE
        // reference type; inventory now accepts only the dedicated order-option
        // definition-value type.  Product/order-option BOM lifecycle is handled
        // by the definition aggregate's explicit cascade command, so a generic
        // dictionary transition must not call the retired probe.
        return;
    }

    /** Caller is already scoped by the typed Inventory owner API; only source shape and count are exposed. */
    private static String inventoryDependencySources(
            InventoryOwnerApi.CatalogReferenceDependenciesReadback dependencies) {
        return dependencies.sources().stream()
                .filter(source -> source.count() > 0)
                .map(source -> inventoryDependencyLabel(source.tableName()) + " x" + source.count())
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private static String inventoryDependencyLabel(String tableName) {
        if ("stock_target".equals(tableName)) return "库存对象";
        if ("stock_bom".equals(tableName)) return "BOM";
        return "库存事实";
    }

    private ObjectNode promotionPreflight(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ItemRow row = requireItem(dataNodeRef, brandRef, required(request, "itemCode"));
        JsonNode sections = json(row.sectionsJson());
        boolean temporary = temporaryItem(row, sections);
        String formalCode = required(request, "formalCode");
        validateCatalogCode(formalCode);
        String shapeKey = required(request, "shapeKey");
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shapeKey);
        String name = required(request, "name");
        long expectedSourceVersion = requiredLong(request, "expectedSourceVersion", -1);
        if (expectedSourceVersion < 0)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedSourceVersion is required");
        ArrayNode blockedReasons = mapper.createArrayNode();
        if (!temporary) blockedReasons.add("当前商品不是外部订单临时商品");
        if (expectedSourceVersion != row.version()) blockedReasons.add("VERSION_CONFLICT");
        if (rule.visibleButDisabled()) blockedReasons.add(rule.disabledReason());
        String materialRole = optional(request, "materialRole");
        if ("MATERIAL".equals(shapeKey) && (materialRole == null || materialRole.isBlank()))
            blockedReasons.add("MATERIAL_ROLE_REQUIRED");
        boolean formalCodeAvailable = formalCodeAvailable(dataNodeRef, brandRef, formalCode, row.ref());
        if (!formalCodeAvailable) blockedReasons.add("DUPLICATE_CODE");
        ObjectNode item = mapper.createObjectNode()
                .put("code", row.code())
                .put("name", row.name())
                .put("shapeKey", row.shapeKey());
        ObjectNode proposed = mapper.createObjectNode()
                .put("code", formalCode)
                .put("name", name)
                .put("shapeKey", shapeKey);
        if (materialRole == null) proposed.putNull("materialRole");
        else proposed.put("materialRole", materialRole);
        ObjectNode detail = mapper.createObjectNode().set("item", item);
        detail.put(
                "source",
                firstText(sections, "source", "sourceType", "ownershipSource") == null
                        ? "TEMPORARY"
                        : firstText(sections, "source", "sourceType", "ownershipSource"));
        detail.set("proposed", proposed);
        detail.put("sourceVersion", row.version()).put("formalCodeAvailable", formalCodeAvailable);
        ArrayNode requiredFields = detail.putArray("requiredFields");
        requiredFields.add("formalCode").add("shapeKey").add("name");
        if ("MATERIAL".equals(shapeKey)) requiredFields.add("materialRole");
        detail.putArray("blockedReasons").addAll(blockedReasons);
        detail.set("changes", promotionChanges(row, formalCode, shapeKey, name, materialRole));
        detail.put("preflightDigest", promotionDigest(row, request, rule));
        detail.put("canPromote", temporary && blockedReasons.isEmpty());
        return envelope(requestId, detail);
    }

    private ObjectNode promotionExecute(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "itemCode");
        long expected = requiredLong(request, "expectedVersion", -1);
        long expectedSourceVersion = requiredLong(request, "expectedSourceVersion", -1);
        if (expected < 0 || expectedSourceVersion < 0)
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "expectedVersion and expectedSourceVersion are required");
        String formalCode = required(request, "formalCode");
        validateCatalogCode(formalCode);
        String shapeKey = required(request, "shapeKey");
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shapeKey);
        String name = required(request, "name");
        String submittedDigest = required(request, "preflightDigest");
        ItemRow row = requireItem(dataNodeRef, brandRef, code);
        JsonNode sections = json(row.sectionsJson());
        if (!temporaryItem(row, sections)) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "只有外部订单临时商品可以转正");
        }
        if (expected != row.version()
                || expectedSourceVersion != row.version()
                || !submittedDigest.equals(promotionDigest(row, request, rule))) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("STALE_COPY_PREFLIGHT"),
                        (409),
                        /* format-wrap */
                        ("临时商品来源或转正资料已变化，请重新预检"));
            }
        }
        String materialRole = optional(request, "materialRole");
        if ("MATERIAL".equals(shapeKey) && (materialRole == null || materialRole.isBlank()))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "MATERIAL_ROLE_REQUIRED");
        if (!formalCodeAvailable(dataNodeRef, brandRef, formalCode, row.ref())) {
            throw new CatalogOwnerApi.Problem(
                    ("DUPLICATE_CODE"),
                    (409),
                    /* format-wrap */
                    ("正式商品编码已存在或已被历史记录占用"));
        }
        ObjectNode promotedSections = promotedSections(row, rule, materialRole, optional(request, "shortName"));
        ArrayNode promotedCategoryRefs = categoryRefs(promotedSections);
        ArrayNode promotedCompositeGroups = compositeGroups(promotedSections);
        ArrayNode promotedSkuVariantDimensions =
                submittedSkuVariantDimensions(promotedSections.path("skuVariantDimensions"));
        validateShapeOwnedSections(rule, promotedSections.path("inventoryBom"));
        JsonNode promotedImages = promotedSections.path("images");
        JsonNode promotedProductionTagRefs = promotedSections.path("productionTagRefs");
        JsonNode promotedTagRefs = promotedSections.path("tagRefs");
        String promotedShortName = removeShortName(promotedSections);
        ArrayNode promotedSkus = clonedSkuFacts((ArrayNode) promotedSections.path("skus"));
        if (formalCode.equals(code)) {
            removeRelationalSectionFacts(promotedSections);
            if (jdbc.update(
                            "UPDATE catalog.catalog_item SET "
                                    + "name=?,short_name=?,shape_key=?,status='DRAFT',sections=CAST(? AS JSONB),"
                                    + "version=version+1,updated_at_epoch_millis=? "
                                    + "WHERE "
                                    + "data_node_ref=? AND brand_ref=? AND code=? AND version=?",
                            name,
                            promotedShortName,
                            shapeKey,
                            canonicalJson(promotedSections),
                            now(),
                            dataNodeRef,
                            brandRef,
                            code,
                            expected)
                    != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "临时商品版本已变化");
            writeCopiedEffectiveUnitFacts(dataNodeRef, brandRef, row.ref(), promotedSections, promotedSkus);
            return itemCommand(requestId, row.ref(), "DRAFT", expected + 1, false);
        }
        UUID promotedItemRef = UUID.randomUUID();
        lockCatalogAssetRefs(json(row.sectionsJson()), promotedSections);
        removeRelationalSectionFacts(promotedSections);
        try {
            jdbc.update(
                    "INSERT INTO catalog.catalog_item "
                            + "(item_ref,data_node_ref,brand_ref,code,name,short_name,shape_key,status,sections,"
                            + "source_item_code,source_scope_ref,version,created_at_epoch_millis,updated_at_epoch_milli"
                            + "s) "
                            + "VALUES (?,?,?,?,?,?,?, 'DRAFT',CAST(? AS JSONB),?,?,1,?,?)",
                    promotedItemRef,
                    dataNodeRef,
                    brandRef,
                    formalCode,
                    name,
                    promotedShortName,
                    shapeKey,
                    canonicalJson(promotedSections),
                    code,
                    null,
                    now(),
                    now());
        } catch (DuplicateKeyException ex) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("DUPLICATE_CODE"),
                        (409),
                        ("正式商品编码已存在或已被历史记录占用"),
                        /* format-wrap */
                        (ex));
            }
        }
        skuFacts.replace(promotedItemRef, promotedSkus, Set.of());
        writeCopiedEffectiveUnitFacts(dataNodeRef, brandRef, promotedItemRef, promotedSections, promotedSkus);
        skuMediaFacts.replace(promotedSkus);
        categoryFacts.replace(promotedItemRef, promotedCategoryRefs);
        compositeFacts.replace(promotedItemRef, promotedCompositeGroups);
        itemDefinitionFacts.copyCurrentFactsWithinScope(dataNodeRef, brandRef, row.ref(), promotedItemRef);
        skuVariantAxisFacts.replace(promotedItemRef, promotedSkuVariantDimensions);
        itemMediaFacts.replace(promotedItemRef, promotedImages);
        itemReferenceFacts.replace(promotedItemRef, promotedProductionTagRefs, promotedTagRefs);
        if (jdbc.update(
                        "UPDATE catalog.catalog_item SET status='VOIDED',version=version+1,updated_at_epoch_millis=? "
                                + "WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?",
                        now(),
                        dataNodeRef,
                        brandRef,
                        code,
                        expected)
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "临时商品版本已变化");
        return itemCommand(requestId, promotedItemRef, "DRAFT", 1L, false);
    }

    private CatalogCopyPlan catalogCopyPlan(
            String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        List<String> selected = selectedCodes(request);
        if (selected.size() > copyLimits.selectedItemCount())
            throw tooLarge("COPY_SELECTED_ITEMS_TOO_LARGE", selected.size(), copyLimits.selectedItemCount());
        CatalogClosure graph = closureGraph(sourceDataNodeRef, brandRef, selected);
        if (!graph.items().stream()
                .map(ItemRow::code)
                .collect(java.util.stream.Collectors.toSet())
                .containsAll(selected)) {
            throw new CatalogOwnerApi.Problem(
                    "NOT_FOUND", 404, "copy source item is not available in the approved scope");
        }
        if (graph.size() > copyLimits.closureItemCount())
            throw tooLarge("COPY_CLOSURE_TOO_LARGE", graph.size(), copyLimits.closureItemCount());
        long sourceVersion = scopeVersion(graph);
        long targetVersion = targetScopeVersion(targetDataNodeRef, brandRef, request, graph);
        return new CatalogCopyPlan(
                selected,
                graph,
                sourceVersion,
                targetVersion,
                copyDigest(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, selected, graph, sourceVersion, targetVersion));
    }

    private ObjectNode copyPreflight(String source, String target, String brandRef, CatalogCopyPlan plan) {
        List<String> selected = plan.selected();
        CatalogClosure graph = plan.graph();
        long sourceVersion = plan.sourceVersion();
        long targetVersion = plan.targetVersion();
        String preflightDigest = plan.digest();
        List<ItemRow> rows = graph.items();
        ObjectNode data = mapper.createObjectNode();
        ObjectNode sourceScope = data.putObject("sourceScope")
                .put("ownerType", "HEAD_COMPANY")
                .put("ownerRef", source)
                .put("brandRef", brandRef);
        ObjectNode targetScope = data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", target)
                .put("brandRef", brandRef);
        data.put("selectedCount", selected.size())
                .put("selectedLimit", copyLimits.selectedItemCount())
                .put("closureCount", graph.size())
                .put("closureLimit", copyLimits.closureItemCount())
                .put("sourceVersion", sourceVersion)
                .put("targetVersion", targetVersion)
                .put("preflightDigest", preflightDigest);
        ArrayNode selectedItems = data.putArray("selectedItems");
        rows.stream().filter(row -> selected.contains(row.code())).forEach(row -> selectedItems
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", row.code())
                .put("name", row.name()));
        ArrayNode closureItems = data.putArray("closureItems");
        rows.forEach(row -> closureItems
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.categories().forEach(row -> closureItems
                .addObject()
                .put("objectType", "CATALOG_CATEGORY")
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.dictionaries().forEach(row -> closureItems
                .addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.units().forEach(row -> closureItems
                .addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.orderOptionDefinitions().forEach(row -> closureItems
                .addObject()
                .put("objectType", "CATALOG_ORDER_OPTION_DEFINITION")
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        ArrayNode closureEdges = data.putArray("closureEdges");
        graph.edges().forEach(edge -> closureEdges
                .addObject()
                .put("fromRef", edge.fromRef())
                .put("toRef", edge.toRef())
                .put("referenceKind", edge.referenceKind()));
        ArrayNode versions = data.putArray("objectVersions");
        rows.forEach(row -> versions.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", targetVersion));
        Map<String, Long> preflightCategoryVersions = targetCategoryVersions(target, brandRef, graph.categories());
        Map<DictionaryKey, Long> preflightDictionaryVersions =
                targetDictionaryVersions(target, brandRef, graph.dictionaries());
        graph.categories().forEach(row -> versions.addObject()
                .put("objectType", "CATALOG_CATEGORY")
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", preflightCategoryVersions.getOrDefault(row.code(), 0L)));
        graph.dictionaries().forEach(row -> versions.addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put(
                        "targetVersion",
                        preflightDictionaryVersions.getOrDefault(
                                new DictionaryKey(row.dictionaryKind(), row.code()), 0L)));
        Map<String, Long> preflightUnitVersions = targetUnitVersions(target, brandRef, graph.units());
        graph.units().forEach(row -> versions.addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", preflightUnitVersions.getOrDefault(row.code(), 0L)));
        ArrayNode mappings = data.putArray("mappingPreview");
        ArrayNode compatibility = data.putArray("compatibilityResults");
        ArrayNode rewrites = data.putArray("referenceRewritePreview");
        ArrayNode referenceMappings = data.putArray("referenceMappings");
        Map<String, ItemRow> targetRows = new LinkedHashMap<>();
        if (!rows.isEmpty())
            loadItems(target, brandRef, rows.stream().map(ItemRow::code).toList())
                    .forEach(row -> targetRows.put(row.code(), row));
        CopyCompatibility plannedCompatibility =
                validateCopyCompatibility(source, target, brandRef, graph, null, false);
        Map<ReferenceKey, String> mapping = plannedCompatibility.mapping();
        Map<String, ItemRow> targetItemsByRef =
                itemsByRef(target, brandRef, rows.stream().map(ItemRow::code).toList());
        mapping.forEach((from, to) -> referenceMappings.add(referenceMappingRow(from, to, graph, targetItemsByRef)));
        int blockingCount = 0;
        for (ItemRow row : rows) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            mappings.addObject()
                    .put("fromCode", row.code())
                    .put("toCode", row.code())
                    .put("referenceKind", "CATALOG_ITEM")
                    .put("status", check.result())
                    .set("canonicalTuple", canonicalTuple(target, brandRef, "CATALOG_ITEM", row.code()));
            compatibility
                    .addObject()
                    .put("objectType", "CATALOG_ITEM")
                    .put("compatibilityId", "CATALOG_ITEM:" + row.ref())
                    .put("result", check.result())
                    .put("reason", check.reason())
                    .put("reasonCode", check.reasonCode())
                    .set("canonicalTuple", canonicalTuple(target, brandRef, "CATALOG_ITEM", row.code()));
            if (check.blocking()) blockingCount++;
        }
        for (String code : itemDefinitionFacts.attributeCopyConflictCodes(
                source,
                brandRef,
                target,
                brandRef,
                rows.stream().map(ItemRow::ref).toList())) {
            compatibility
                    .addObject()
                    .put("objectType", "CATALOG_ATTRIBUTE_DEFINITION")
                    .put("compatibilityId", "CATALOG_ATTRIBUTE_DEFINITION:" + code)
                    .put("result", "BLOCKED")
                    .put("reason", "同编码商品属性定义的类型或选项不一致")
                    .put("reasonCode", "CATALOG_COPY_DEFINITION_CONFLICT")
                    .set("canonicalTuple", canonicalTuple(target, brandRef, "CATALOG_ATTRIBUTE_DEFINITION", code));
            blockingCount++;
        }
        CatalogItemDefinitionFacts.OrderOptionCopyPlan orderOptionPlan = itemDefinitionFacts.planOrderOptionCopy(
                source,
                brandRef,
                target,
                brandRef,
                graph.orderOptionDefinitions(),
                uuidMappings(mapping, "CATALOG_ITEM"),
                uuidMappings(mapping, "CATALOG_ORDER_OPTION_DEFINITION"),
                uuidMappings(mapping, "CATALOG_ORDER_OPTION_DEFINITION_VALUE"));
        for (String code : orderOptionPlan.conflictCodes()) {
            compatibility
                    .addObject()
                    .put("objectType", "CATALOG_ORDER_OPTION_DEFINITION")
                    .put("compatibilityId", "CATALOG_ORDER_OPTION_DEFINITION:" + code)
                    .put("result", "BLOCKED")
                    .put("reason", "同编码点单选项定义的选择方式、选项或扣料原料不一致")
                    .put("reasonCode", "CATALOG_COPY_DEFINITION_CONFLICT")
                    .set("canonicalTuple", canonicalTuple(target, brandRef, "CATALOG_ORDER_OPTION_DEFINITION", code));
            blockingCount++;
        }
        graph.categories().forEach(row -> mappings.addObject()
                .put("fromCode", row.code())
                .put("toCode", row.code())
                .put("referenceKind", row.objectType())
                .put("status", "REUSE_OR_CREATE")
                .set("canonicalTuple", canonicalTuple(target, brandRef, row.objectType(), row.code())));
        graph.dictionaries().forEach(row -> mappings.addObject()
                .put("fromCode", row.code())
                .put("toCode", row.code())
                .put("referenceKind", row.objectType())
                .put("status", "REUSE_OR_CREATE")
                .set("canonicalTuple", canonicalTuple(target, brandRef, row.objectType(), canonicalParts(row, graph))));
        graph.units().forEach(row -> {
            UnitRow targetUnit =
                    targetUnitsByCode(target, brandRef, List.of(row)).get(row.code());
            boolean compatible = targetUnit == null || sameUnitDefinition(row, targetUnit);
            mappings.addObject()
                    .put("fromCode", row.code())
                    .put("toCode", row.code())
                    .put("referenceKind", row.objectType())
                    .put("status", compatible ? "REUSE_OR_CREATE" : "BLOCKED")
                    .set(
                            "canonicalTuple",
                            canonicalTuple(
                                    target,
                                    brandRef,
                                    row.objectType(),
                                    row.code(),
                                    row.name(),
                                    row.unitDimension(),
                                    Integer.toString(row.precision())));
        });
        Map<String, UnitRow> targetUnits = targetUnitsByCode(target, brandRef, graph.units());
        for (UnitRow row : graph.units()) {
            UnitRow existing = targetUnits.get(row.code());
            boolean blocked = existing != null && !sameUnitDefinition(row, existing);
            String compatibilityReason;
            if (blocked) compatibilityReason = "同编码计量单位的名称、类别或精度不一致";
            else if (existing == null) compatibilityReason = "目标不存在，将创建";
            else compatibilityReason = "编码与语义兼容，可复用";
            compatibility
                    .addObject()
                    .put("objectType", row.objectType())
                    .put("compatibilityId", row.objectType() + ":" + row.ref())
                    .put("result", blocked ? "BLOCKED" : existing == null ? "CREATE" : "REUSE")
                    .put("reason", compatibilityReason)
                    .put(
                            "reasonCode",
                            blocked
                                    ? "CATALOG_COPY_UNIT_CONFLICT"
                                    : existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED")
                    .set(
                            "canonicalTuple",
                            canonicalTuple(
                                    target,
                                    brandRef,
                                    row.objectType(),
                                    row.code(),
                                    row.name(),
                                    row.unitDimension(),
                                    Integer.toString(row.precision())));
            if (blocked) blockingCount++;
        }
        graph.edges().forEach(edge -> {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET").contains(edge.referenceKind())) return;
            String objectType = copyReferenceObjectType(edge.referenceKind());
            String mappedTarget = mapping.get(new ReferenceKey(objectType, edge.toRef()));
            if (mappedTarget == null || mappedTarget.isBlank()) {
                throw new CatalogOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("复制引用未完成映射: " + edge.toRef()));
            }
            rewrites.addObject()
                    .put("sourceRef", edge.toRef())
                    .put("targetRef", mappedTarget)
                    .put("referenceKind", edge.referenceKind());
        });
        for (DictionaryRow row : graph.dictionaries()) {
            compatibility
                    .addObject()
                    .put("objectType", row.objectType())
                    .put("compatibilityId", row.objectType() + ":" + row.ref())
                    .put("result", "REUSE_OR_CREATE")
                    .put("reason", "按编码复用或创建")
                    .put("reasonCode", "REUSE_CONFIRMATION_REQUIRED")
                    .set(
                            "canonicalTuple",
                            canonicalTuple(target, brandRef, row.objectType(), canonicalParts(row, graph)));
        }
        // The edge copy read model always exposes an explicit skipped list,
        // even when this catalog-only preflight has no skipped sections.
        data.putArray("skipped");
        data.put("blockingCount", blockingCount)
                .put("confirmationRequiredCount", countRequiredCompatibilityRows(compatibility));
        return data;
    }

    private static int countRequiredCompatibilityRows(ArrayNode compatibility) {
        int count = 0;
        for (JsonNode row : compatibility) {
            if (!"BLOCKED".equals(row.path("result").asText())) count++;
        }
        return count;
    }

    private CategoryRow category(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND "
                        + "status <> "
                        + "'VOIDED'",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return new CategoryRow(
                            result.getObject(1, UUID.class),
                            result.getString(2),
                            result.getString(3),
                            result.getString(4),
                            result.getObject(5, UUID.class),
                            result.getString(6),
                            result.getLong(7),
                            result.getInt(8));
                });
    }

    private CategoryRow lockCategory(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND "
                        + "status <> "
                        + "'VOIDED' FOR UPDATE",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return new CategoryRow(
                            result.getObject(1, UUID.class),
                            result.getString(2),
                            result.getString(3),
                            result.getString(4),
                            result.getObject(5, UUID.class),
                            result.getString(6),
                            result.getLong(7),
                            result.getInt(8));
                });
    }

    /**
     * Delete replays retain the outer typed grant/context check and inspect the current owner fact before receipt
     * lookup. An absent category is the one post-delete state in which the receipt may decide the response.
     */
    private CategoryRow findLockedCategory(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND "
                        + "status <> "
                        + "'VOIDED' FOR UPDATE",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> result.next()
                        ? new CategoryRow(
                                result.getObject(1, UUID.class),
                                result.getString(2),
                                result.getString(3),
                                result.getString(4),
                                result.getObject(5, UUID.class),
                                result.getString(6),
                                result.getLong(7),
                                result.getInt(8))
                        : null);
    }

    private List<CategoryRow> lockCategories(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        List<UUID> stable = refs.stream().distinct().sorted().toList();
        String placeholders = String.join(",", Collections.nCopies(stable.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(stable);
        List<CategoryRow> rows = jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref IN ("
                        + placeholders + ") AND status <> 'VOIDED' ORDER BY category_ref FOR UPDATE",
                (result, row) -> new CategoryRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getObject(5, UUID.class),
                        result.getString(6),
                        result.getLong(7),
                        result.getInt(8)),
                args.toArray());
        if (rows.size() != stable.size()) {
            throw new CatalogOwnerApi.Problem(("NOT_FOUND"), (404), ("分类不存在或已删除"));
        }
        return rows;
    }

    private List<CategoryRow> lockCategorySiblings(String scope, String brand, UUID parentCategoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND parent_category_ref IS "
                        + "NOT "
                        + "DISTINCT FROM ? AND status <> 'VOIDED' ORDER BY category_ref FOR UPDATE",
                (result, row) -> new CategoryRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getObject(5, UUID.class),
                        result.getString(6),
                        result.getLong(7),
                        result.getInt(8)),
                scope,
                brand,
                parentCategoryRef);
    }

    private List<UUID> categorySubtreeRefs(String scope, String brand, UUID rootCategoryRef) {
        List<UUID> refs = jdbc.query(
                "WITH RECURSIVE subtree(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE "
                        + "data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL SELECT "
                        + "child.category_ref FROM catalog.catalog_category child JOIN subtree parent ON "
                        + "child.parent_category_ref=parent.category_ref WHERE child.data_node_ref=? AND "
                        + "child.brand_ref=? "
                        + "AND child.status <> 'VOIDED') SELECT category_ref FROM subtree ORDER BY category_ref",
                (result, row) -> result.getObject(1, UUID.class),
                scope,
                brand,
                rootCategoryRef,
                scope,
                brand);
        if (refs.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
        return refs;
    }

    private List<String> categoryReferencedItems(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        return jdbc.query(
                "SELECT DISTINCT item.code FROM catalog.catalog_item_category relation JOIN catalog.catalog_item item "
                        + "ON item.item_ref=relation.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status <> 'VOIDED' AND relation.category_ref IN ("
                        + placeholders + ") ORDER BY item.code",
                (rows, index) -> rows.getString(1),
                args.toArray());
    }

    private long nextCategoryDisplayOrder(String scope, String brand, UUID parentCategoryRef) {
        Long next = jdbc.queryForObject(
                "SELECT COALESCE(MAX(display_order), -1) + 1 FROM catalog.catalog_category WHERE data_node_ref=? AND "
                        + "brand_ref=? AND parent_category_ref IS NOT DISTINCT FROM ? AND status <> 'VOIDED'",
                Long.class,
                scope,
                brand,
                parentCategoryRef);
        return next == null ? 0L : next;
    }

    private void requireCategoryVersion(CategoryRow row, long expectedVersion) {
        if (expectedVersion < 1)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedVersion is required");
        if (row.version() != expectedVersion) {
            throw new CatalogOwnerApi.Problem(("VERSION_CONFLICT"), (409), ("分类版本已变化"));
        }
    }

    private ObjectNode categoryCommand(String requestId, CategoryRow category) {
        ObjectNode result = mapper.createObjectNode()
                .put("categoryRef", category.ref().toString())
                .put("code", category.code())
                .put("name", category.name())
                .put("status", category.status())
                .put("version", category.version())
                .put("displayOrder", category.displayOrder());
        if (category.parentCategoryRef() == null) result.putNull("parentCategoryRef");
        else result.put("parentCategoryRef", category.parentCategoryRef().toString());
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .put("version", category.version())
                .set("result", result);
    }

    private ObjectNode dictionaryCommand(
            String requestId,
            UUID entryRef,
            String kind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version) {
        ObjectNode node = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ObjectNode result = node.putObject("result")
                .put("entryRef", entryRef.toString())
                .put("dictionaryKind", kind)
                .put("code", code)
                .put("name", name)
                .put("status", status)
                .put("version", version);
        putNullableUuid(result, "parentEntryRef", parentEntryRef);
        node.put("version", version);
        return node;
    }

    static void validateCatalogCode(String code) {
        if (code == null || code.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "formalCode is required");
    }

    private boolean formalCodeAvailable(String dataNodeRef, String brandRef, String code, UUID currentRef) {
        Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND "
                        + "item_ref<>? AND status <> 'VOIDED'",
                Long.class,
                dataNodeRef,
                brandRef,
                code,
                currentRef);
        return count == null || count == 0;
    }

    private ArrayNode promotionChanges(
            ItemRow row, String formalCode, String shapeKey, String name, String materialRole) {
        ArrayNode changes = mapper.createArrayNode();
        changes.addObject().put("field", "code").put("before", row.code()).put("after", formalCode);
        changes.addObject().put("field", "name").put("before", row.name()).put("after", name);
        changes.addObject()
                .put("field", "shapeKey")
                .put("before", row.shapeKey())
                .put("after", shapeKey);
        String beforeRole = firstText(json(row.sectionsJson()), "materialRole");
        ObjectNode role = changes.addObject().put("field", "materialRole");
        if (beforeRole == null) role.putNull("before");
        else role.put("before", beforeRole);
        if (materialRole == null) role.putNull("after");
        else role.put("after", materialRole);
        return changes;
    }

    private String promotionDigest(ItemRow row, ObjectNode request, CatalogInventoryShapeManifest.ShapeRule rule) {
        ObjectNode snapshot = mapper.createObjectNode()
                .put("itemCode", row.code())
                .put("sourceVersion", row.version())
                .put("formalCode", required(request, "formalCode"))
                .put("shapeKey", rule.shapeKey().name())
                .put("name", required(request, "name"));
        String shortName = optional(request, "shortName");
        if (shortName == null) snapshot.putNull("shortName");
        else snapshot.put("shortName", shortName);
        String materialRole = optional(request, "materialRole");
        if (materialRole == null) snapshot.putNull("materialRole");
        else snapshot.put("materialRole", materialRole);
        return hash(snapshot);
    }

    private ObjectNode promotedSections(
            ItemRow row, CatalogInventoryShapeManifest.ShapeRule rule, String materialRole, String shortName) {
        ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
        applyDerivedShapeFields(sections, rule);
        sections.put("source", "SELF_MANAGED").put("promotedFromTemporaryCode", row.code());
        String nextShortName = shortName == null ? row.shortName() : shortName;
        if (nextShortName != null && !nextShortName.isBlank()) sections.put("shortName", nextShortName);
        if (materialRole == null) sections.remove("materialRole");
        else sections.put("materialRole", materialRole);
        return sections;
    }

    private ObjectNode itemCommand(String requestId, UUID itemRef, String status, long version, boolean canArchive) {
        ObjectNode node = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ObjectNode result = node.putObject("result")
                .put("operation", "CATALOG_ITEM")
                .put("resourceRef", itemRef.toString())
                .put("status", status)
                .put("version", version);
        result.putArray("ownerReadbacks")
                .addObject()
                .put("owner", "catalog")
                .put("status", "COMMITTED")
                .put("version", version);
        ObjectNode actions = result.putObject("actionAvailability");
        actions.put("canEdit", !Set.of("ARCHIVED", "VOIDED").contains(status));
        actions.put("canEnable", !Set.of("ENABLED", "ARCHIVED", "VOIDED").contains(status));
        actions.put("canDisable", "ENABLED".equals(status));
        actions.put("canArchive", canArchive && "DISABLED".equals(status));
        ObjectNode voidAvailability = actions.putObject("voidAvailability");
        voidAvailability.put("canVoid", !Set.of("ARCHIVED", "VOIDED").contains(status));
        voidAvailability.putArray("blockingReferences");
        voidAvailability.putArray("dependentFacts");
        node.put("version", version);
        return node;
    }

    private ObjectNode itemSaveReadback(
            String requestId, String dataNodeRef, String brandRef, String code, long version) {
        return itemSaveReadback(requestId, dataNodeRef, brandRef, code, version, mapper.createArrayNode());
    }

    private ObjectNode itemSaveReadback(
            String requestId,
            String dataNodeRef,
            String brandRef,
            String code,
            long version,
            ArrayNode skuTransitions) {
        ItemRow row = hydrateItemFacts(List.of(requireItem(dataNodeRef, brandRef, code)))
                .getFirst();
        JsonNode sections = json(row.sectionsJson());
        ObjectNode node = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ObjectNode result = node.putObject("result");
        ObjectNode item = result.putObject("item")
                .put("itemRef", row.ref().toString())
                .put("code", row.code())
                .put("version", version);
        UUID salesUnitRef = nullableUuid(sections, "salesUnitRef");
        UUID baseMeasureUnitRef = nullableUuid(sections, "baseMeasureUnitRef");
        putNullableUuid(item, "salesUnitRef", salesUnitRef);
        putNullableUuid(item, "baseMeasureUnitRef", baseMeasureUnitRef);
        setStoredUnitAssignment(
                item,
                "salesUnit",
                dataNodeRef,
                brandRef,
                salesUnitRef,
                sections.path("salesUnitSnapshot"),
                "ITEM_DEFAULT");
        setStoredUnitAssignment(
                item,
                "baseMeasureUnit",
                dataNodeRef,
                brandRef,
                baseMeasureUnitRef,
                sections.path("baseMeasureUnitSnapshot"),
                "ITEM_DEFAULT");
        JsonNode categoryRef = sections.path("categoryRef");
        if (categoryRef.isTextual() && !categoryRef.asText().isBlank()) item.put("categoryRef", categoryRef.asText());
        else item.putNull("categoryRef");
        item.set(
                "attributeAssignments",
                sections.path("attributeAssignments").isArray()
                        ? sections.path("attributeAssignments").deepCopy()
                        : mapper.createArrayNode());
        item.set(
                "orderOptionConfigs",
                sections.path("orderOptionConfigs").isArray()
                        ? sections.path("orderOptionConfigs").deepCopy()
                        : mapper.createArrayNode());
        result.putArray("inventoryBom");
        result.putArray("productionTags");
        result.set("skuTransitions", skuTransitions == null ? mapper.createArrayNode() : skuTransitions);
        result.put("version", version);
        node.put("version", version);
        return node;
    }

    private boolean hasItemDependencies(ItemRow row) {
        JsonNode sections = json(row.sectionsJson());
        return sections.path("skuCount").asInt(0) > 0
                || (sections.path("identifiers").isArray()
                        && sections.path("identifiers").size() > 0)
                || (sections.path("inventoryBom").isArray()
                        && sections.path("inventoryBom").size() > 0)
                || (sections.path("productionTagRefs").isArray()
                        && sections.path("productionTagRefs").size() > 0)
                || (sections.path("skus").isArray() && sections.path("skus").size() > 0);
    }

    private boolean itemReferencedByOtherItems(String scope, String brand, ItemRow current) {
        return itemReferencedByOtherItems(scope, brand, current.ref());
    }

    private boolean itemReferencedByOtherItems(String scope, String brand, UUID currentRef) {
        return !inboundItemReferences(scope, brand, currentRef).isEmpty();
    }

    private List<InboundItemReference> inboundItemReferences(String scope, String brand, UUID currentRef) {
        return jdbc.query(
                "SELECT owner_item.item_ref, owner_item.code FROM catalog.catalog_composite_component component JOIN "
                        + "catalog.catalog_composite_group group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item "
                        + "owner_item ON owner_item.item_ref=group_row.item_ref WHERE owner_item.data_node_ref=? AND "
                        + "owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND component.component_item_ref=? "
                        + "ORDER BY owner_item.code, owner_item.item_ref",
                (result, index) -> new InboundItemReference(result.getObject(1, UUID.class), result.getString(2)),
                scope,
                brand,
                currentRef);
    }

    private void lockAndValidateCategoryRefs(String scope, String brand, JsonNode sections) {
        JsonNode refs = sections.has("categoryRef")
                ? categoryRefArray(sections.path("categoryRef"))
                : sections.path("categoryRefs");
        if (refs.isMissingNode() || refs.isNull()) return;
        if (!refs.isArray())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs must be an array of UUID refs");
        List<UUID> categoryRefs = new ArrayList<>();
        for (JsonNode ref : refs) {
            if (!ref.isTextual())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs must contain UUID refs");
            try {
                categoryRefs.add(UUID.fromString(ref.asText()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs cannot contain a business code", failure);
            }
        }
        if (categoryRefs.size() > 1)
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "商品最多只能选择一个分类");
        lockCategories(scope, brand, categoryRefs);
    }

    private ArrayNode singleCategoryRef(UUID categoryRef) {
        return mapper.createArrayNode().add(categoryRef.toString());
    }

    private ArrayNode categoryRefArray(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) return mapper.createArrayNode();
        if (!value.isTextual())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRef must be an opaque UUID");
        try {
            return singleCategoryRef(UUID.fromString(value.asText()));
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRef must be an opaque UUID", failure);
        }
    }

    private ArrayNode requiredArray(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return mapper.createArrayNode();
        if (!value.isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an array");
        return (ArrayNode) value;
    }
    /** The reference matrix is deliberately path-based: do not infer a relationship from a field name. */
    private void validateDeclaredOpaqueReferences(String scope, String brand, JsonNode sections, UUID currentItemRef) {
        lockDictionaryRefs(scope, brand, "TAG", textRefs(sections.path("tagRefs"), "tagRefs"));
        List<String> attributeRefs = new ArrayList<>();
        JsonNode dimensions = sections.path("skuVariantDimensions");
        if (dimensions.isArray())
            for (JsonNode dimension : dimensions) {
                addRequiredUuid(attributeRefs, dimension.path("attributeRef"), "skuVariantDimensions[].attributeRef");
            }
        lockDictionaryRefs(scope, brand, "SKU_ATTRIBUTE", attributeRefs);
        List<String> valueRefs = new ArrayList<>();
        if (sections.path("skus").isArray())
            for (JsonNode sku : sections.path("skus")) {
                addRequiredUuid(new ArrayList<>(), sku.path("productSkuRef"), "skus[].productSkuRef");
                JsonNode values = sku.path("attributeValueRefs");
                if (values.isArray())
                    for (JsonNode value : values)
                        addRequiredUuid(
                                valueRefs,
                                value.path("attributeValueRef"),
                                "skus[].attributeValueRefs[].attributeValueRef");
            }
        if (dimensions.isArray())
            for (JsonNode dimension : dimensions)
                if (dimension.path("values").isArray())
                    for (JsonNode value : dimension.path("values"))
                        addRequiredUuid(valueRefs, value.path("valueRef"), "skuVariantDimensions[].values[].valueRef");
        lockDictionaryRefs(scope, brand, "SKU_ATTRIBUTE_VALUE", valueRefs);
        validateProductionTagRefs(scope, brand, sections);
        validateCatalogRelationRefs(scope, brand, sections, currentItemRef);
    }

    private List<String> textRefs(JsonNode values, String path) {
        if (values.isMissingNode() || values.isNull()) return List.of();
        if (!values.isArray())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, path + " must be an array of UUID refs");
        List<String> refs = new ArrayList<>();
        for (JsonNode value : values) addRequiredUuid(refs, value, path);
        return refs;
    }

    private void addRequiredUuid(List<String> refs, JsonNode value, String path) {
        if (value == null || value.isMissingNode() || value.isNull()) return;
        if (!value.isTextual())
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, path + " must contain UUID refs");
        try {
            refs.add(UUID.fromString(value.asText()).toString());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, path + " cannot contain a business code", failure);
        }
    }

    private void addRequiredUuidValue(List<UUID> refs, JsonNode value, String path) {
        UUID ref = requiredUuidValue(value, path);
        if (ref != null) refs.add(ref);
    }

    private UUID requiredUuidValue(JsonNode value, String path) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (!value.isTextual())
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, path + " must contain UUID refs");
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, path + " cannot contain a business code", failure);
        }
    }

    private void lockDictionaryRefs(String scope, String brand, String kind, List<String> refs) {
        if (refs.isEmpty()) return;
        List<UUID> ids = refs.stream().distinct().map(UUID::fromString).sorted().toList();
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.add(kind);
        args.addAll(ids);
        List<UUID> found = jdbc.query(
                "SELECT entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND status <> 'VOIDED' AND entry_ref IN ("
                        + placeholders + ") ORDER BY entry_ref FOR UPDATE",
                (result, index) -> result.getObject(1, UUID.class),
                args.toArray());
        if (found.size() != ids.size())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, kind + " reference is not available in this owner scope");
    }

    private void validateProductionTagRefs(String scope, String brand, JsonNode sections) {
        List<String> refs = new ArrayList<>(textRefs(sections.path("productionTagRefs"), "productionTagRefs"));
        if (refs.isEmpty()) return;
        if (productionTags == null)
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "production tag owner API is required");
        List<UUID> requested = refs.stream().map(UUID::fromString).toList();
        Map<UUID, com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi.ProductionTagReferenceReadback>
                found =
                        productionTags
                                .readTagReferencesByRefs(scope, brand, requested, "catalog-production-tag-validation")
                                .stream()
                                .collect(java.util.stream.Collectors.toMap(
                                        com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi
                                                        .ProductionTagReferenceReadback::tagRef,
                                        value -> value,
                                        (left, right) -> left));
        if (requested.stream()
                .anyMatch(ref -> !found.containsKey(ref)
                        || "VOIDED".equals(found.get(ref).status())))
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "production tag ref is not available in this owner scope");
    }

    private ArrayNode productionTagDetails(String scope, String brand, JsonNode refsNode, String requestId) {
        List<String> refs = textRefs(refsNode, "productionTagRefs");
        ArrayNode result = mapper.createArrayNode();
        if (refs.isEmpty()) return result;
        if (productionTags == null)
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "production tag owner API is required for detail projection");
        List<UUID> requested = refs.stream().map(UUID::fromString).toList();
        Map<String, com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi.ProductionTagReferenceReadback>
                tagsByRef = productionTags.readTagReferencesByRefs(scope, brand, requested, requestId).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                value -> value.tagRef().toString(),
                                value -> value,
                                (left, right) -> left,
                                LinkedHashMap::new));
        for (String ref : refs) {
            var tag = tagsByRef.get(ref);
            if (tag == null)
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "production tag readback is missing: " + ref);
            result.addObject()
                    .put("tagRef", ref)
                    .put("code", tag.code())
                    .put("name", tag.name())
                    .put("owner", "fulfillment-production");
        }
        return result;
    }

    private void validateCatalogRelationRefs(String scope, String brand, JsonNode sections, UUID currentItemRef) {
        List<UUID> itemRefs = new ArrayList<>();
        List<ProductSkuRelation> skuRelations = new ArrayList<>();
        collectCatalogRelationRefs(sections.path("compositeGroups"), itemRefs, skuRelations);
        collectCatalogRelationRefs(sections.path("inventoryBom"), itemRefs, skuRelations);
        List<UUID> ownSkuRefs = new ArrayList<>();
        if (sections.path("skus").isArray())
            for (JsonNode sku : sections.path("skus"))
                addRequiredUuidValue(ownSkuRefs, sku.path("productSkuRef"), "skus[].productSkuRef");
        if (!itemRefs.isEmpty()) {
            List<UUID> ids = itemRefs.stream().distinct().sorted().toList();
            String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
            List<Object> args = new ArrayList<>();
            args.add(scope);
            args.add(brand);
            args.addAll(ids);
            List<UUID> found = jdbc.query(
                    "SELECT item_ref FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> "
                            + "'VOIDED' AND item_ref IN ("
                            + placeholders + ") ORDER BY item_ref FOR KEY SHARE",
                    (result, index) -> result.getObject(1, UUID.class),
                    args.toArray());
            if (found.size() != ids.size())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef is not available in this owner scope");
        }
        List<UUID> validatedSkuRefs = new ArrayList<>(ownSkuRefs);
        skuRelations.forEach(relation -> validatedSkuRefs.add(relation.productSkuRef()));
        Map<UUID, UUID> skuOwnerByRef = skuOwnerByRef(scope, brand, validatedSkuRefs);
        for (UUID ownSkuRef : ownSkuRefs) {
            UUID owner = skuOwnerByRef.get(ownSkuRef);
            if (owner != null && !owner.equals(currentItemRef))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "productSkuRef belongs to another item in this owner scope");
        }
        for (ProductSkuRelation relation : skuRelations) {
            UUID owner = skuOwnerByRef.get(relation.productSkuRef());
            boolean freshCurrentSku =
                    relation.itemRef().equals(currentItemRef) && ownSkuRefs.contains(relation.productSkuRef());
            if (!relation.itemRef().equals(owner) && !freshCurrentSku)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "productSkuRef does not belong to declared itemRef in this owner scope");
        }
    }

    private void collectCatalogRelationRefs(
            JsonNode groups, List<UUID> itemRefs, List<ProductSkuRelation> skuRelations) {
        if (!groups.isArray()) return;
        for (JsonNode group : groups) {
            JsonNode entries = group.path("components").isArray() ? group.path("components") : groups;
            if (groups.path(0).isObject() && groups.path(0).has("itemRef")) entries = groups;
            for (JsonNode entry : entries) {
                UUID itemRef = requiredUuidValue(entry.path("itemRef"), "itemRef");
                if (itemRef != null) itemRefs.add(itemRef);
                UUID productSkuRef = requiredUuidValue(entry.path("productSkuRef"), "productSkuRef");
                if (productSkuRef != null) {
                    requireSkuCodeForSkuReference(entry);
                    if (itemRef == null)
                        throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, "productSkuRef requires declared itemRef");
                    skuRelations.add(new ProductSkuRelation(itemRef, productSkuRef));
                }
            }
        }
    }

    /**
     * A supplied opaque SKU ref must retain its code link; otherwise callers silently downgrade it to an item-level
     * relation.
     */
    private void requireSkuCodeForSkuReference(JsonNode entry) {
        if (!entry.hasNonNull("skuCode") || entry.path("skuCode").asText().isBlank()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "productSkuRef requires skuCode");
        }
    }

    private Map<UUID, UUID> skuOwnerByRef(String scope, String brand, List<UUID> requestedSkuRefs) {
        List<UUID> refs = requestedSkuRefs.stream().distinct().sorted().toList();
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, UUID> owners = new LinkedHashMap<>();
        jdbc.query(
                "SELECT sku.product_sku_ref,sku.item_ref FROM catalog.catalog_sku sku JOIN catalog.catalog_item item "
                        + "ON item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status "
                        + "<> 'VOIDED' AND sku.product_sku_ref IN ("
                        + placeholders + ") ORDER BY sku.product_sku_ref FOR KEY SHARE OF sku,item",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 3, refs.get(index));
                },
                result -> {
                    while (result.next()) {
                        UUID skuRef = result.getObject(1, UUID.class);
                        UUID itemRef = result.getObject(2, UUID.class);
                        if (skuRef != null
                                && owners.putIfAbsent(skuRef, itemRef) != null
                                && !owners.get(skuRef).equals(itemRef))
                            throw new CatalogOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED",
                                    422,
                                    "productSkuRef is duplicated across items in this owner scope");
                    }
                    return null;
                });
        return owners;
    }

    private boolean categoryReferenced(String scope, String brand, UUID categoryRef) {
        Boolean referenced = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_category relation JOIN catalog.catalog_item item ON "
                        + "item.item_ref=relation.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status "
                        + "<> 'VOIDED' AND relation.category_ref=?)",
                Boolean.class,
                scope,
                brand,
                categoryRef);
        return Boolean.TRUE.equals(referenced);
    }

    private boolean dictionaryReferenced(String scope, String brand, String kind, String entryCode) {
        UUID entryRef = jdbc.query(
                "SELECT entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, entryCode);
                },
                result -> result.next() ? result.getObject(1, UUID.class) : null);
        return entryRef != null
                && dictionaryReferenceSnapshot(scope, brand, kind, List.of(entryRef))
                        .isReferenced(entryRef);
    }

    /**
     * Resolves all entries plus the generation in one catalog.dictionary_entry statement. The synthetic empty row makes
     * an empty dictionary a single statement rather than a list query followed by a generation query.
     */
    private DictionaryListing loadDictionaryListing(
            String scope,
            String brand,
            String kind,
            UUID parentEntryRef,
            OpaqueCollectionCursor.Position cursor,
            int pageSize,
            String queryIdentity) {
        String cursorPredicate = cursor == null ? "" : " WHERE code > ? OR (code = ? AND entry_ref > ?)";
        String sql = "WITH matching AS (SELECT entry_ref,code,name,status,parent_entry_ref,version,"
                + "updated_at_epoch_millis FROM catalog.dictionary_entry WHERE data_node_ref=? "
                + "AND brand_ref=? AND dictionary_kind=? AND "
                + "(?::uuid IS NULL OR parent_entry_ref=?)), "
                + "aggregate AS (SELECT COUNT(*) AS total, COALESCE(MAX(version),0) AS "
                + "generation FROM matching), "
                + "paged AS (SELECT entry_ref,code,name,status,parent_entry_ref,version,"
                + "updated_at_epoch_millis FROM matching"
                + cursorPredicate
                + " ORDER BY code NULLS LAST, entry_ref LIMIT ?) "
                + "SELECT p.entry_ref,p.code,p.name,p.status,p.parent_entry_ref,p.version,"
                + "p.updated_at_epoch_millis,"
                + "a.total,a.generation FROM aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.code NULLS LAST,"
                + "p.entry_ref";
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.add(kind);
        arguments.add(parentEntryRef);
        arguments.add(parentEntryRef);
        if (cursor != null) {
            arguments.add(cursor.sortKey());
            arguments.add(cursor.sortKey());
            arguments.add(cursor.tieBreaker());
        }
        arguments.add(pageSize + 1);
        List<DictionaryListingRow> rows = jdbc.query(
                sql,
                (result, index) -> new DictionaryListingRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getObject(5, UUID.class),
                        result.getLong(6),
                        result.getLong(7),
                        result.getLong(8),
                        result.getLong(9)),
                arguments.toArray());
        long generation = rows.isEmpty() ? 0L : rows.get(0).generation();
        long total = rows.isEmpty() ? 0L : rows.get(0).total();
        List<DictionaryListingRow> presentRows =
                rows.stream().filter(row -> row.entryRef() != null).toList();
        boolean hasNext = presentRows.size() > pageSize;
        if (hasNext) presentRows = presentRows.subList(0, pageSize);
        List<DictionaryEntryRow> entries = presentRows.stream()
                .filter(row -> row.entryRef() != null)
                .map(row -> new DictionaryEntryRow(
                        row.entryRef(),
                        row.code(),
                        row.name(),
                        row.status(),
                        row.parentEntryRef(),
                        row.version(),
                        row.updatedAt()))
                .toList();
        String nextCursor = null;
        if (hasNext) {
            DictionaryListingRow last = presentRows.get(presentRows.size() - 1);
            nextCursor = OpaqueCollectionCursor.encode(queryIdentity, last.code(), last.entryRef());
        }
        return new DictionaryListing(entries, generation, total, nextCursor);
    }

    private List<DictionaryRow> lockDictionaryEntriesForReorder(String scope, String brand, String kind) {
        return jdbc.query(
                "SELECT entry_ref,dictionary_kind,code,name,status,parent_entry_ref,display_order,version FROM "
                        + "catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? ORDER "
                        + "BY "
                        + "entry_ref FOR UPDATE",
                (result, index) -> new DictionaryRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, UUID.class),
                        result.getInt(7),
                        result.getLong(8)),
                scope,
                brand,
                kind);
    }

    private int nextDictionaryDisplayOrder(String scope, String brand, String kind) {
        Integer value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(display_order), -1) + 1 FROM catalog.dictionary_entry WHERE data_node_ref=? AND "
                        + "brand_ref=? AND dictionary_kind=?",
                Integer.class,
                scope,
                brand,
                kind);
        return value == null ? 0 : value;
    }

    private static List<String> dictionaryOrderCodes(JsonNode codes) {
        List<String> orderedCodes = new ArrayList<>();
        for (JsonNode code : codes) {
            if (!code.isTextual() || code.asText().isBlank())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "orderedCodes 必须只包含非空编码");
            orderedCodes.add(code.asText());
        }
        return List.copyOf(orderedCodes);
    }

    private static void validateDictionaryOrder(List<DictionaryRow> current, List<String> orderedCodes) {
        if (orderedCodes.size() != current.size()) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("VALIDATION_ERROR"),
                        (422),
                        /* format-wrap */
                        ("orderedCodes 必须完整覆盖当前字典且不能重复"));
            }
        }
        Set<String> currentCodes =
                current.stream().map(DictionaryRow::code).collect(java.util.stream.Collectors.toSet());
        Set<String> submittedCodes = new java.util.HashSet<>(orderedCodes);
        if (submittedCodes.size() != orderedCodes.size() || !currentCodes.equals(submittedCodes)) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("VALIDATION_ERROR"),
                        (422),
                        /* format-wrap */
                        ("orderedCodes 必须完整覆盖当前字典且不能重复"));
            }
        }
    }

    /**
     * A command/request-local, immutable reference snapshot. It covers only the listed dictionary entries in this owner
     * scope; it is never cached or used across a mutation boundary.
     */
    private DictionaryReferenceSnapshot dictionaryReferenceSnapshot(
            String scope, String brand, String kind, List<UUID> entryRefs) {
        if (entryRefs.isEmpty()) return new DictionaryReferenceSnapshot(Set.of());
        Set<UUID> referenced = new LinkedHashSet<>();
        referenced.addAll(itemReferenceFacts.referencedRefs(scope, brand, dictionaryObjectType(kind), entryRefs));
        referenced.addAll(relationalSkuDictionaryReferences(scope, brand, kind, entryRefs));
        return new DictionaryReferenceSnapshot(referenced);
    }

    /** SKU facts have left JSON; dictionary lifecycle guards must query their relational owners too. */
    private Set<UUID> relationalSkuDictionaryReferences(String scope, String brand, String kind, List<UUID> entryRefs) {
        if (!Set.of("SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE").contains(kind) || entryRefs.isEmpty()) return Set.of();
        String placeholders = String.join(",", Collections.nCopies(entryRefs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(entryRefs);
        String column = "SKU_ATTRIBUTE".equals(kind) ? "relation.attribute_ref" : "relation.attribute_value_ref";
        return Set.copyOf(jdbc.query(
                "SELECT DISTINCT " + column
                        + " FROM catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON "
                        + "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status <> 'VOIDED' AND "
                        + column + " IN (" + placeholders + ")",
                (result, row) -> result.getObject(1, UUID.class),
                args.toArray()));
    }

    static Set<String> catalogAssetRefs(JsonNode sections) {
        Set<String> refs = new LinkedHashSet<>();
        refs.addAll(catalogAssetRefsWithoutSku(sections));
        JsonNode skus = sections.path("skus");
        if (skus.isArray()) skus.forEach(sku -> collectAssetRefs(refs, sku.path("mediaRefs")));
        return refs;
    }

    private static Set<String> catalogAssetRefsWithoutSku(JsonNode sections) {
        Set<String> refs = new LinkedHashSet<>();
        collectAssetRefs(refs, sections.path("images"));
        return refs;
    }

    private boolean skuAssetReferenced(String dataNodeRef, String brandRef, String assetRef) {
        try {
            return skuMediaFacts.referenced(dataNodeRef, brandRef, UUID.fromString(assetRef));
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static void collectAssetRefs(Set<String> refs, JsonNode values) {
        if (!values.isArray()) return;
        values.forEach(value -> {
            String ref =
                    value.isTextual() ? value.asText() : value.path("assetRef").asText("");
            if (!ref.isBlank()) refs.add(ref);
        });
    }

    private boolean categoryHasChildren(String scope, String brand, UUID categoryRef) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND "
                        + "parent_category_ref=? AND status <> 'VOIDED'",
                Integer.class,
                scope,
                brand,
                categoryRef);
        return count != null && count > 0;
    }

    private boolean categoryHasChildren(String scope, String brand, String code) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND parent_code=? "
                        + "AND status <> 'VOIDED'",
                Integer.class,
                scope,
                brand,
                code);
        return count != null && count > 0;
    }

    private LinkedHashSet<String> itemReferenceRefs(JsonNode node) {
        LinkedHashSet<String> refs = new LinkedHashSet<>();
        typedReferences(node).stream()
                .filter(ref -> Set.of("CATALOG_ITEM", "COMPOSITE_COMPONENT", "BOM_COMPONENT")
                        .contains(ref.referenceKind()))
                .forEach(ref -> refs.add(ref.ref()));
        return refs;
    }

    private boolean itemExistsByRef(String scope, String brand, String itemRef) {
        try {
            return jdbc.queryForObject(
                            "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND "
                                    + "item_ref=? AND status <> 'VOIDED'",
                            Integer.class,
                            scope,
                            brand,
                            UUID.fromString(itemRef))
                    > 0;
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef must be UUID", failure);
        }
    }

    private Map<String, String> itemCodesByRef(String scope, String brand, Collection<String> refs) {
        if (refs.isEmpty()) return Map.of();
        List<UUID> ids = new ArrayList<>();
        for (String ref : refs) ids.add(UUID.fromString(ref));
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(ids);
        Map<String, String> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT item_ref,code FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref IN ("
                        + placeholders + ")",
                args.toArray(),
                rows -> {
                    while (rows.next()) result.put(rows.getObject(1, UUID.class).toString(), rows.getString(2));
                });
        return result;
    }

    private boolean containsText(JsonNode values, String code) {
        if (!values.isArray()) return false;
        for (JsonNode value : values) if (value.isTextual() && code.equals(value.asText())) return true;
        return false;
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private ObjectNode itemSummary(ItemRow row) {
        JsonNode sections = json(row.sectionsJson());
        DerivedSkuFacts skuFacts = derivedSkuFacts(sections, shapeRule(row.shapeKey()));
        ObjectNode item = mapper.createObjectNode();
        String primaryImageAssetRef = primaryImageAssetRef(sections.path("images"));
        if (primaryImageAssetRef == null) item.putNull("primaryImageAssetRef");
        else item.put("primaryImageAssetRef", primaryImageAssetRef);
        String shortName = row.shortName();
        if (shortName == null || shortName.isBlank()) item.putNull("shortName");
        else item.put("shortName", shortName);
        item.put("itemRef", row.ref().toString()).put("code", row.code()).put("name", row.name());
        JsonNode categoryRefs = sections.path("categoryRefs");
        if (categoryRefs.isArray() && !categoryRefs.isEmpty())
            item.put("categoryRef", categoryRefs.get(0).asText());
        else item.putNull("categoryRef");
        ArrayNode productionTagRefs = item.putArray("productionTagRefs");
        if (sections.path("productionTagRefs").isArray())
            sections.path("productionTagRefs").forEach(value -> productionTagRefs.add(value.asText()));
        ArrayNode tagRefs = item.putArray("tagRefs");
        if (sections.path("tagRefs").isArray()) sections.path("tagRefs").forEach(value -> tagRefs.add(value.asText()));
        item.put("shapeKey", row.shapeKey()).put("status", row.status());
        if (sections.has("materialRole") && !sections.path("materialRole").isNull())
            item.put("materialRole", sections.path("materialRole").asText());
        else item.putNull("materialRole");
        item.put("source", sourceFact(row, sections));
        item.put("skuEnabledCount", skuFacts.enabledCount())
                .put("skuNonArchivedCount", skuFacts.nonArchivedCount())
                .put("skuTotalCount", skuFacts.totalCount());
        ArrayNode dimensions = item.putArray("skuDimensionSummary");
        skuFacts.dimensions().forEach(dimensions::add);
        putNullableLong(item, "standardSalePrice", sections.path("standardSalePrice"));
        putNullableLong(item, "standardSalePriceMin", skuFacts.standardSalePriceMin());
        putNullableLong(item, "standardSalePriceMax", skuFacts.standardSalePriceMax());
        putNullableLong(item, "standardPriceDelta", sections.path("standardPriceDelta"));
        putNullableLong(item, "standardExtraPrice", sections.path("standardExtraPrice"));
        item.put("priceGranularity", skuFacts.priceGranularity())
                .put("missingPriceCount", skuFacts.missingPriceCount());
        item.put("stockTargetCount", 0)
                .put(
                        "bomCount",
                        sections.path("inventoryBom").isArray()
                                ? sections.path("inventoryBom").size()
                                : 0);
        item.put("version", row.version()).put("updatedAt", row.updatedAt());
        return item;
    }

    /** Product rule: the first ordered item-image relation is the primary image. */
    private static String primaryImageAssetRef(JsonNode orderedImages) {
        if (orderedImages == null || !orderedImages.isArray() || orderedImages.isEmpty()) return null;
        JsonNode first = orderedImages.get(0);
        String assetRef =
                first.isTextual() ? first.asText() : first.path("assetRef").asText("");
        return assetRef.isBlank() ? null : assetRef;
    }

    private void putNullableLong(ObjectNode target, String key, JsonNode value) {
        if (value != null && value.isIntegralNumber()) target.put(key, value.asLong());
        else target.putNull(key);
    }

    private void putNullableLong(ObjectNode target, String key, Long value) {
        if (value == null) target.putNull(key);
        else target.put(key, value);
    }

    private String sourceFact(ItemRow row, JsonNode sections) {
        String source = firstText(sections, "source", "sourceType", "ownershipSource");
        if ("AUTO_SYNC".equals(source)) return "AUTO_SYNC";
        if ("TEMPORARY".equals(source) || "EXTERNAL_ORDER_TEMPORARY".equals(source)) return "TEMPORARY";
        return row.sourceScopeRef() == null ? "SELF_MANAGED" : "COPIED";
    }

    private boolean temporaryItem(ItemRow row, JsonNode sections) {
        return "TEMPORARY".equals(sourceFact(row, sections)) || "TEMPORARY".equals(row.status());
    }

    /** Source ownership is a server fact. The explicit section list wins; AUTO_SYNC has a safe minimum. */
    private List<String> sourceDeniedFields(ItemRow row, JsonNode sections) {
        LinkedHashSet<String> denied = new LinkedHashSet<>();
        JsonNode declared = sections.path("deniedFields");
        if (declared.isArray())
            declared.forEach(value -> {
                if (value.isTextual() && !value.asText().isBlank()) denied.add(value.asText());
            });
        if ("AUTO_SYNC".equals(sourceFact(row, sections)) && denied.isEmpty()) {
            denied.add("name");
            denied.add("code");
        }
        return List.copyOf(denied);
    }

    private void validateSourceOwnedFields(ItemRow row, JsonNode currentSections, ObjectNode draft) {
        for (String field : sourceDeniedFields(row, currentSections)) {
            JsonNode next = draft.get(field);
            if (next == null) continue;
            boolean changed;
            if ("name".equals(field)) changed = !row.name().equals(next.asText());
            else changed = !canonicalJson(currentSections.get(field)).equals(canonicalJson(next));
            if (changed) {
                throw new CatalogOwnerApi.Problem(
                        ("VALIDATION_ERROR"),
                        (422),
                        /* format-wrap */
                        ("字段由同步来源维护：" + field));
            }
        }
    }

    private static void removeRetiredGovernanceFacts(ObjectNode sections) {
        sections.remove("governanceStatus");
        sections.remove("governanceState");
    }

    /** Relationship rows are the only persisted source; hydrated read shapes must never leak back into sections. */
    private static void removeRelationalSectionFacts(ObjectNode sections) {
        for (String key : List.of(
                "skus",
                "categoryRefs",
                "categoryRef",
                "compositeGroups",
                "attributeAssignments",
                "orderOptionConfigs",
                "skuVariantDimensions",
                "images",
                "productionTagRefs",
                "tagRefs",
                "salesUnitSnapshot",
                "baseMeasureUnitSnapshot",
                "productionTags")) {
            sections.remove(key);
        }
        sections.remove("skuSummary");
        sections.remove("ordering");
        sections.remove("listedSalePrice");
        sections.remove("missingPriceCount");
    }

    /** `shortName` is a catalog_item column, never a second JSON source of truth. */
    private static String removeShortName(ObjectNode sections) {
        JsonNode shortName = sections.remove("shortName");
        if (shortName == null || shortName.isNull()) return null;
        if (!shortName.isTextual())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shortName must be text");
        String value = shortName.asText().trim();
        return value.isEmpty() ? null : value;
    }

    private ObjectNode itemDetail(ItemRow row, JsonNode sections, String dataNodeRef, String brandRef) {
        ObjectNode item = mapper.createObjectNode()
                .put("itemRef", row.ref().toString())
                .put("code", row.code())
                .put("name", row.name());
        if (row.shortName() == null || row.shortName().isBlank()) item.putNull("shortName");
        else item.put("shortName", row.shortName());
        item.put("shapeKey", row.shapeKey());
        if (sections.has("materialRole") && !sections.path("materialRole").isNull())
            item.put("materialRole", sections.path("materialRole").asText());
        else item.putNull("materialRole");
        JsonNode categoryRefs = sections.path("categoryRefs");
        if (categoryRefs.isArray() && !categoryRefs.isEmpty())
            item.put("categoryRef", categoryRefs.get(0).asText());
        else item.putNull("categoryRef");
        ArrayNode productionTagRefs = item.putArray("productionTagRefs");
        if (sections.path("productionTagRefs").isArray())
            sections.path("productionTagRefs").forEach(value -> productionTagRefs.add(value.asText()));
        ArrayNode tagRefs = item.putArray("tagRefs");
        if (sections.path("tagRefs").isArray()) sections.path("tagRefs").forEach(value -> tagRefs.add(value.asText()));
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(row.shapeKey());
        DerivedSkuFacts skuFacts = derivedSkuFacts(sections, rule);
        item.put("itemKind", rule.itemKind()).put("measureMode", rule.measureMode());
        putNullableUuid(item, "salesUnitRef", nullableUuid(sections, "salesUnitRef"));
        putNullableUuid(item, "baseMeasureUnitRef", nullableUuid(sections, "baseMeasureUnitRef"));
        setStoredUnitAssignment(
                item,
                "salesUnit",
                dataNodeRef,
                brandRef,
                nullableUuid(sections, "salesUnitRef"),
                sections.path("salesUnitSnapshot"),
                "ITEM_DEFAULT");
        setStoredUnitAssignment(
                item,
                "baseMeasureUnit",
                dataNodeRef,
                brandRef,
                nullableUuid(sections, "baseMeasureUnitRef"),
                sections.path("baseMeasureUnitSnapshot"),
                "ITEM_DEFAULT");
        ArrayNode capabilities = item.putArray("usageCapabilities");
        rule.usageCapabilities().forEach(capability -> capabilities.add(capability.name()));
        ArrayNode images = item.putArray("images");
        JsonNode imageValues = sections.path("images");
        if (imageValues.isArray())
            imageValues.forEach(v ->
                    images.add(v.isTextual() ? v.asText() : v.path("assetRef").asText()));
        String primaryImageAssetRef = primaryImageAssetRef(imageValues);
        if (primaryImageAssetRef == null) item.putNull("primaryImageAssetRef");
        else item.put("primaryImageAssetRef", primaryImageAssetRef);
        ArrayNode identifiers = item.putArray("identifiers");
        JsonNode idValues = sections.path("identifiers");
        if (idValues.isArray())
            idValues.forEach(v -> identifiers
                    .addObject()
                    .put("kind", v.path("kind").asText())
                    .put("code", v.path("code").asText())
                    .put("value", v.path("value").asText()));
        ObjectNode sku = item.putObject("skuSummary")
                .put("enabledCount", skuFacts.enabledCount())
                .put("nonArchivedCount", skuFacts.nonArchivedCount())
                .put("totalCount", skuFacts.totalCount());
        ArrayNode skuDimensions = sku.putArray("dimensions");
        skuFacts.dimensions().forEach(skuDimensions::add);
        item.set("skuVariantDimensions", skuVariantDimensions(sections.path("skuVariantDimensions")));
        item.set(
                "skus",
                skuRows(
                        sections.path("skus"),
                        dataNodeRef,
                        brandRef,
                        nullableUuid(sections, "salesUnitRef"),
                        nullableUuid(sections, "baseMeasureUnitRef")));
        putNullableLong(item, "standardSalePrice", sections.path("standardSalePrice"));
        item.put("priceGranularity", skuFacts.priceGranularity())
                .put("missingPriceCount", skuFacts.missingPriceCount());
        item.set(
                "attributeAssignments",
                sections.path("attributeAssignments").isArray()
                        ? sections.path("attributeAssignments")
                        : mapper.createArrayNode());
        item.set(
                "orderOptionConfigs",
                sections.path("orderOptionConfigs").isArray()
                        ? sections.path("orderOptionConfigs")
                        : mapper.createArrayNode());
        item.set("compositeGroups", compositeGroups(sections.path("compositeGroups")));
        ArrayNode itemBom = item.putArray("inventoryBom");
        if (sections.path("inventoryBom").isArray())
            sections.path("inventoryBom").forEach(entry -> itemBom.add(bomEntry(entry)));
        ObjectNode profiles = item.putObject("productionProfiles");
        profiles.set("item", objectOrEmpty(sections.path("productionProfiles").path("item")));
        profiles.set("sku", objectOrEmpty(sections.path("productionProfiles").path("sku")));
        profiles.set(
                "optionValue", objectOrEmpty(sections.path("productionProfiles").path("optionValue")));
        item.putObject("lifecycle")
                .put("status", row.status())
                .put("version", row.version())
                .put("source", sourceFact(row, sections));
        item.put("source", sourceFact(row, sections));
        JsonNode externalIdentity = externalIdentityFact(mapper, sections);
        if (externalIdentity == null) item.putNull("externalIdentity");
        else item.set("externalIdentity", externalIdentity);
        item.put("version", row.version()).put("updatedAt", row.updatedAt());
        return item;
    }

    /**
     * Effective unit labels come from the saved snapshot; only lifecycle status is read from the current definition.
     */
    private void setStoredUnitAssignment(
            ObjectNode target,
            String field,
            String dataNodeRef,
            String brandRef,
            UUID unitRef,
            JsonNode storedSnapshot,
            String inheritanceSource) {
        if (unitRef == null) {
            target.putNull(field);
            return;
        }
        if (storedSnapshot == null || !storedSnapshot.isObject())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位快照缺失");
        UUID snapshotRef;
        try {
            snapshotRef = UUID.fromString(storedSnapshot.path("unitRef").asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位快照引用无效", failure);
        }
        if (!unitRef.equals(snapshotRef))
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    /* format-wrap */
                    "商品单位快照与引用不一致");
        CatalogOwnerApi.UnitDefinitionReadback unit =
                unitDefinitionFacts.list(dataNodeRef, brandRef, true, null).stream()
                        .filter(candidate -> unitRef.equals(candidate.unitRef()))
                        .findFirst()
                        .orElseThrow(() -> new CatalogOwnerApi.Problem(
                                "RESULT_UNKNOWN",
                                500,
                                /* format-wrap */
                                "商品单位定义无法读取"));
        target.putObject(field)
                .put("unitRef", snapshotRef.toString())
                .put("code", storedSnapshot.path("code").asText())
                .put("name", storedSnapshot.path("name").asText())
                .put("unitDimension", storedSnapshot.path("unitDimension").asText())
                .put("precision", storedSnapshot.path("precision").asInt())
                .put("status", unit.status())
                .put("inheritanceSource", inheritanceSource);
    }

    private DerivedSkuFacts derivedSkuFacts(JsonNode sections, CatalogInventoryShapeManifest.ShapeRule rule) {
        JsonNode skus = sections.path("skus");
        int total = skus.isArray() ? skus.size() : 0;
        int enabled = skus.isArray()
                ? (int) java.util.stream.StreamSupport.stream(skus.spliterator(), false)
                        .filter(sku -> "ENABLED".equals(sku.path("status").asText("ENABLED")))
                        .count()
                : 0;
        int nonArchived = skus.isArray()
                ? (int) java.util.stream.StreamSupport.stream(skus.spliterator(), false)
                        .filter(sku -> !Set.of("ARCHIVED", "VOIDED")
                                .contains(sku.path("status").asText("ENABLED")))
                        .count()
                : 0;
        Long standardSalePriceMin = null;
        Long standardSalePriceMax = null;
        if (skus.isArray())
            for (JsonNode sku : skus) {
                if (Set.of("ARCHIVED", "VOIDED").contains(sku.path("status").asText("ENABLED"))
                        || !sku.path("standardSalePrice").isIntegralNumber()) continue;
                long price = sku.path("standardSalePrice").asLong();
                standardSalePriceMin = standardSalePriceMin == null ? price : Math.min(standardSalePriceMin, price);
                standardSalePriceMax = standardSalePriceMax == null ? price : Math.max(standardSalePriceMax, price);
            }
        List<String> dimensions = new ArrayList<>();
        JsonNode axes = sections.path("skuVariantDimensions");
        if (axes.isArray())
            for (JsonNode axis : axes) dimensions.add(axis.path("attributeName").asText(""));
        int missingPriceCount;
        if ("SKU".equals(rule.priceGranularity())) {
            missingPriceCount = skus.isArray()
                    ? (int) java.util.stream.StreamSupport.stream(skus.spliterator(), false)
                            .filter(sku -> !Set.of("ARCHIVED", "VOIDED")
                                    .contains(sku.path("status").asText("ENABLED")))
                            .filter(sku -> !sku.path("standardSalePrice").isIntegralNumber())
                            .count()
                    : 0;
        } else {
            missingPriceCount = sections.path("standardSalePrice").isIntegralNumber() ? 0 : 1;
        }
        return new DerivedSkuFacts(
                enabled,
                nonArchived,
                total,
                List.copyOf(dimensions),
                rule.priceGranularity(),
                missingPriceCount,
                standardSalePriceMin,
                standardSalePriceMax);
    }
    /**
     * The catalog owner exposes only the typed external-order identity facts needed by the governance surface. It
     * deliberately does not pass an arbitrary source payload through the edge read model; absent facts remain absent
     * instead of being guessed from the current catalog name or price.
     */
    static JsonNode externalIdentityFact(ObjectMapper mapper, JsonNode sections) {
        JsonNode declared = sections.path("externalIdentity");
        if (!declared.isObject()) return null;
        ObjectNode identity = mapper.createObjectNode();
        copyOptionalText(identity, declared, "sourceOrderRef");
        copyOptionalText(identity, declared, "sourceRecordRef");
        copyOptionalText(identity, declared, "sourceItemRef");
        JsonNode sourceSnapshot = declared.path("snapshot");
        if (sourceSnapshot.isObject()) {
            ObjectNode snapshot = identity.putObject("snapshot");
            copyOptionalText(snapshot, sourceSnapshot, "name");
            copyOptionalText(snapshot, sourceSnapshot, "specification");
            if (sourceSnapshot.path("price").isIntegralNumber())
                snapshot.put("price", sourceSnapshot.path("price").asLong());
            else if (sourceSnapshot.has("price")) snapshot.putNull("price");
        }
        return identity;
    }

    private static void copyOptionalText(ObjectNode target, JsonNode source, String field) {
        JsonNode value = source.get(field);
        if (value != null && value.isTextual() && !value.asText().isBlank()) target.put(field, value.asText());
    }

    private ObjectNode bomEntry(JsonNode entry) {
        ObjectNode result = mapper.createObjectNode()
                .put("nodeType", entry.path("nodeType").asText("STOCK_TARGET"))
                .put("mode", entry.path("mode").asText("CONFIGURED"))
                .put("targetRef", entry.path("targetRef").asText())
                .put("quantity", entry.path("quantity").asText("0"));
        if (entry.hasNonNull("consumptionUnitSnapshot"))
            result.set(
                    "consumptionUnitSnapshot",
                    entry.path("consumptionUnitSnapshot").deepCopy());
        else result.putNull("consumptionUnitSnapshot");
        copyNullableText(result, entry, "itemCode");
        copyNullableText(result, entry, "skuCode");
        copyNullableText(result, entry, "optionValueCode");
        if (entry.has("version")) result.put("version", entry.path("version").asLong());
        if (entry.has("lineSign")) result.put("lineSign", entry.path("lineSign").asText());
        return result;
    }

    private static void copyNullableText(ObjectNode target, JsonNode source, String field) {
        if (source.hasNonNull(field)) target.put(field, source.path(field).asText());
        else target.putNull(field);
    }

    private ObjectNode objectOrEmpty(JsonNode node) {
        return node != null && node.isObject() ? (ObjectNode) node.deepCopy() : mapper.createObjectNode();
    }

    /**
     * Write paths retain submitted/hydrated axes so the fact owner assigns omitted orders exactly once by encounter
     * order. skuVariantDimensions() is a read projection: feeding it back into a write turns two omitted axis orders
     * into two explicit zeroes.
     */
    private ArrayNode submittedSkuVariantDimensions(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return mapper.createArrayNode();
        if (!node.isArray())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skuVariantDimensions must be an array");
        return ((ArrayNode) node).deepCopy();
    }

    private ArrayNode skuVariantDimensions(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(dimension -> {
            ObjectNode target = result.addObject();
            target.put("attributeRef", dimension.path("attributeRef").asText(""));
            target.put("attributeCode", dimension.path("attributeCode").asText(""));
            target.put("attributeName", dimension.path("attributeName").asText(""));
            target.put("displayOrder", dimension.path("displayOrder").asInt(0));
            ArrayNode values = target.putArray("values");
            if (dimension.path("values").isArray())
                dimension.path("values").forEach(value -> {
                    ObjectNode entry = values.addObject();
                    entry.put("valueRef", value.path("valueRef").asText(""));
                    entry.put("valueCode", value.path("valueCode").asText(""));
                    entry.put("valueLabel", value.path("valueLabel").asText(""));
                    entry.put("displayOrder", value.path("displayOrder").asInt(0));
                    entry.put("status", value.path("status").asText("ENABLED"));
                });
        });
        return result;
    }

    private ArrayNode skuRows(
            JsonNode node, String dataNodeRef, String brandRef, UUID itemSalesUnitRef, UUID itemBaseMeasureUnitRef) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        List<JsonNode> skuNodes = new ArrayList<>();
        node.forEach(skuNodes::add);
        List<UUID> skuRefs = skuNodes.stream()
                .map(sku -> UUID.fromString(sku.path("productSkuRef").asText()))
                .toList();
        Map<UUID, List<SkuInboundReference>> inboundBySku = skuInboundReferencesByRefs(dataNodeRef, brandRef, skuRefs);
        for (int index = 0; index < skuNodes.size(); index++) {
            JsonNode sku = skuNodes.get(index);
            UUID skuRef = skuRefs.get(index);
            ObjectNode target = result.addObject();
            target.put("productSkuRef", sku.path("productSkuRef").asText(""));
            target.put("skuCode", firstText(sku, "skuCode", "code") == null ? "" : firstText(sku, "skuCode", "code"));
            target.put("skuName", sku.path("skuName").asText(""));
            target.put("displayOrder", sku.path("displayOrder").asInt(0));
            target.put(
                    "variantCombinationDigest",
                    sku.path("variantCombinationDigest").asText(""));
            ArrayNode refs = target.putArray("attributeValueRefs");
            if (sku.path("attributeValueRefs").isArray())
                sku.path("attributeValueRefs").forEach(value -> {
                    ObjectNode ref = refs.addObject();
                    ref.put("attributeRef", value.path("attributeRef").asText(""));
                    ref.put("attributeCode", value.path("attributeCode").asText(""));
                    ref.put("attributeName", value.path("attributeName").asText(""));
                    ref.put("attributeValueRef", value.path("attributeValueRef").asText(""));
                    ref.put("valueCode", value.path("valueCode").asText(""));
                    ref.put("valueLabel", value.path("valueLabel").asText(""));
                    ref.put("displayOrder", value.path("displayOrder").asInt(0));
                    ref.put("status", value.path("status").asText("ENABLED"));
                });
            target.put("skuBarcode", sku.path("skuBarcode").asText(""));
            putNullableLong(target, "standardSalePrice", sku.path("standardSalePrice"));
            target.put("isDefault", sku.path("isDefault").asBoolean(false));
            target.put("status", sku.path("status").asText("ENABLED"));
            target.put("version", sku.path("version").asLong(0));
            UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
            UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
            putNullableUuid(target, "salesUnitOverrideRef", salesOverride);
            putNullableUuid(target, "baseMeasureUnitOverrideRef", baseOverride);
            setStoredUnitAssignment(
                    target,
                    "salesUnit",
                    dataNodeRef,
                    brandRef,
                    salesOverride == null ? itemSalesUnitRef : salesOverride,
                    sku.path("salesUnitSnapshot"),
                    salesOverride == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE");
            setStoredUnitAssignment(
                    target,
                    "baseMeasureUnit",
                    dataNodeRef,
                    brandRef,
                    baseOverride == null ? itemBaseMeasureUnitRef : baseOverride,
                    sku.path("baseMeasureUnitSnapshot"),
                    baseOverride == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE");
            ArrayNode blockingReferences = target.putObject("voidAvailability").putArray("blockingReferences");
            ArrayNode dependentFacts = target.with("voidAvailability").putArray("dependentFacts");
            List<SkuInboundReference> inbound = inboundBySku.getOrDefault(skuRef, List.of());
            inbound.forEach(reference -> {
                blockingReferences
                        .addObject()
                        .put("referenceKind", "CATALOG_COMPOSITE_COMPONENT")
                        .put("referenceRef", reference.componentRef().toString());
                dependentFacts
                        .addObject()
                        .put("factKind", "CATALOG_COMPOSITE_ITEM")
                        .put("factRef", reference.ownerItemRef().toString());
            });
            target.with("voidAvailability")
                    .put(
                            "canVoid",
                            !Set.of("ARCHIVED", "VOIDED")
                                            .contains(sku.path("status").asText("ENABLED"))
                                    && inbound.isEmpty());
            ArrayNode mediaRefs = target.putArray("mediaRefs");
            if (sku.path("mediaRefs").isArray()) sku.path("mediaRefs").forEach(value -> mediaRefs.add(value.asText()));
        }
        return result;
    }

    private ArrayNode compositeGroups(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(group -> {
            ObjectNode target = result.addObject();
            String groupCode = firstText(group, "groupCode", "code");
            String groupName = firstText(group, "groupName", "name");
            String selectionRule = firstText(group, "selectionRule", "selectionMode");
            target.put("groupCode", groupCode == null ? "" : groupCode);
            target.put("groupName", groupName == null ? "" : groupName);
            target.put("selectionRule", selectionRule == null ? "REQUIRED" : selectionRule);
            target.put("minSelections", group.path("minSelections").asInt(0));
            target.put("maxSelections", group.path("maxSelections").asInt(0));
            target.put("displayOrder", group.path("displayOrder").asInt(0));
            ArrayNode components = target.putArray("components");
            JsonNode sourceComponents =
                    group.path("components").isArray() ? group.path("components") : group.path("items");
            if (sourceComponents.isArray())
                sourceComponents.forEach(value -> {
                    ObjectNode entry = components.addObject();
                    String itemCode = firstText(value, "itemCode", "componentItemCode", "code");
                    entry.put("itemCode", itemCode == null ? "" : itemCode);
                    copyNullableText(entry, value, "itemRef");
                    String skuCode = firstText(value, "skuCode", "sku");
                    if (skuCode == null) entry.putNull("skuCode");
                    else entry.put("skuCode", skuCode);
                    copyNullableText(entry, value, "productSkuRef");
                    entry.put("quantity", value.path("quantity").asText("1"));
                    entry.put("unit", value.path("unit").asText(""));
                    entry.put("default", value.path("default").asBoolean(false));
                    putNullableLong(entry, "extraPrice", value.path("extraPrice"));
                    entry.put("status", value.path("status").asText("ENABLED"));
                    entry.put("displayOrder", value.path("displayOrder").asInt(0));
                });
        });
        return result;
    }

    private String dictionaryName(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT name FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? "
                        + "AND code=?",
                s -> {
                    s.setString(1, scope);
                    s.setString(2, brand);
                    s.setString(3, kind);
                    s.setString(4, code);
                },
                r -> {
                    if (!r.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "字典条目不存在");
                    return r.getString(1);
                });
    }

    private String dictionaryStatus(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT status FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                s -> {
                    s.setString(1, scope);
                    s.setString(2, brand);
                    s.setString(3, kind);
                    s.setString(4, code);
                },
                r -> {
                    if (!r.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "字典条目不存在");
                    return r.getString(1);
                });
    }

    private boolean createsCategoryCycle(String scope, String brand, String code, String parent) {
        if (parent == null || parent.isBlank()) return false;
        String cursor = parent;
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        while (cursor != null && seen.add(cursor)) {
            if (code.equals(cursor)) return true;
            String lookup = cursor;
            String next = jdbc.query(
                    "SELECT parent_code FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=?",
                    s -> {
                        s.setString(1, scope);
                        s.setString(2, brand);
                        s.setString(3, lookup);
                    },
                    r -> {
                        if (!r.next()) return null;
                        return r.getString(1);
                    });
            cursor = next;
        }
        return cursor != null;
    }

    private ItemRow requireItem(String dataNodeRef, String brandRef, String code) {
        List<ItemRow> rows = loadItems(dataNodeRef, brandRef, List.of(code));
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        return rows.get(0);
    }

    private ItemRow requireItemByRef(String dataNodeRef, String brandRef, UUID itemRef) {
        ItemRow row = jdbc.query(
                "SELECT "
                        + "item_ref,code,name,short_name,shape_key,status,sections::text,version,updat"
                        + "ed_a"
                        + "t_epoch_millis,source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? "
                        + "AND item_ref=?",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, itemRef);
                },
                result -> result.next()
                        ? new ItemRow(
                                result.getObject(1, UUID.class),
                                result.getString(2),
                                result.getString(3),
                                result.getString(4),
                                result.getString(5),
                                result.getString(6),
                                result.getString(7),
                                result.getLong(8),
                                result.getLong(9),
                                result.getString(10))
                        : null);
        if (row != null) return hydrateItemFacts(List.of(row)).get(0);
        Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item WHERE item_ref=?)", Boolean.class, itemRef);
        if (Boolean.TRUE.equals(exists)) {
            throw new CatalogOwnerApi.Problem(("SCOPE_FORBIDDEN"), (403), ("商品不属于当前数据范围"));
        }
        throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
    }

    private List<ItemRow> loadItems(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(codes);
        return hydrateItemFacts(jdbc.query(
                "SELECT "
                        + "item_ref,code,name,short_name,shape_key,status,sections::text,version,updat"
                        + "ed_a"
                        + "t_epoch_millis,source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? "
                        + "AND code IN ("
                        + placeholders + ") AND status <> 'VOIDED' ORDER BY code",
                (r, n) -> new ItemRow(
                        r.getObject(1, UUID.class),
                        r.getString(2),
                        r.getString(3),
                        r.getString(4),
                        r.getString(5),
                        r.getString(6),
                        r.getString(7),
                        r.getLong(8),
                        r.getLong(9),
                        r.getString(10)),
                args.toArray()));
    }

    /** Rehydrates the established owner read shape from the SKU relation; catalog_item.sections never persists skus. */
    private List<ItemRow> hydrateItemFacts(List<ItemRow> rows) {
        if (rows.isEmpty()) return rows;
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        Map<UUID, ArrayNode> skusByItem = skuFacts.readByItemRefs(itemRefs);
        Map<UUID, ArrayNode> categoriesByItem = categoryFacts.readByItemRefs(itemRefs);
        Map<UUID, ArrayNode> compositesByItem = compositeFacts.readByItemRefs(itemRefs);
        Map<UUID, ArrayNode> attributeAssignmentsByItem = itemDefinitionFacts.readAttributeAssignments(itemRefs);
        Map<UUID, ArrayNode> orderOptionConfigsByItem = itemDefinitionFacts.readOrderOptionConfigs(itemRefs);
        Map<UUID, ArrayNode> axesByItem = skuVariantAxisFacts.readByItemRefs(itemRefs);
        Map<UUID, ArrayNode> imagesByItem = itemMediaFacts.readByItemRefs(itemRefs);
        Map<UUID, Map<String, ArrayNode>> referencesByItem = itemReferenceFacts.readByItemRefs(itemRefs);
        Map<UUID, ItemUnitRefs> unitRefsByItem = itemUnitRefsByItemRefs(itemRefs);
        skuMediaFacts.applyTo(skusByItem);
        List<ItemRow> hydrated = new ArrayList<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("categoryRefs", categoriesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            ArrayNode categoryRefs = categoriesByItem.getOrDefault(row.ref(), mapper.createArrayNode());
            if (categoryRefs.isEmpty()) sections.putNull("categoryRef");
            else sections.put("categoryRef", categoryRefs.get(0).asText());
            sections.set("compositeGroups", compositesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set(
                    "attributeAssignments",
                    attributeAssignmentsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set(
                    "orderOptionConfigs", orderOptionConfigsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("skuVariantDimensions", axesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("images", imagesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            ItemUnitRefs unitRefs = unitRefsByItem.get(row.ref());
            if (unitRefs == null || unitRefs.salesUnitRef() == null) sections.putNull("salesUnitRef");
            else sections.put("salesUnitRef", unitRefs.salesUnitRef().toString());
            if (unitRefs == null || unitRefs.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
            else
                sections.put("baseMeasureUnitRef", unitRefs.baseMeasureUnitRef().toString());
            putNullableUnitSnapshot(
                    sections, "salesUnitSnapshot", unitRefs == null ? null : unitRefs.salesUnitSnapshot());
            putNullableUnitSnapshot(
                    sections, "baseMeasureUnitSnapshot", unitRefs == null ? null : unitRefs.baseMeasureUnitSnapshot());
            Map<String, ArrayNode> references = referencesByItem.get(row.ref());
            sections.set(
                    "productionTagRefs",
                    references == null
                            ? mapper.createArrayNode()
                            : references.get(CatalogItemReferenceFacts.PRODUCTION_TAG));
            sections.set(
                    "tagRefs",
                    references == null
                            ? mapper.createArrayNode()
                            : references.get(CatalogItemReferenceFacts.CATALOG_TAG));
            hydrated.add(new ItemRow(
                    row.ref(),
                    row.code(),
                    row.name(),
                    row.shortName(),
                    row.shapeKey(),
                    row.status(),
                    canonicalJson(sections),
                    row.version(),
                    row.updatedAt(),
                    row.sourceScopeRef()));
        }
        return List.copyOf(hydrated);
    }

    private Map<UUID, ItemUnitRefs> itemUnitRefsByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, ItemUnitRefs> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT item_ref,sales_unit_ref,sales_unit_code,sales_unit_name,sales_unit_dimension,sales_unit_pre"
                        + "cision,"
                        + "base_measure_unit_ref,base_measure_unit_code,base_measure_unit_name,base_measure_unit_di"
                        + "mension,base_measure_unit_precision "
                        + "FROM catalog.catalog_item WHERE item_ref IN ("
                        + placeholders + ")",
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                rows -> {
                    while (rows.next())
                        result.put(
                                rows.getObject(1, UUID.class),
                                new ItemUnitRefs(
                                        rows.getObject(2, UUID.class),
                                        unitSnapshot(rows, 2, 3, 4, 5, 6),
                                        rows.getObject(7, UUID.class),
                                        unitSnapshot(rows, 7, 8, 9, 10, 11)));
                    return null;
                });
        return result;
    }

    /** Computes the catalog-owned portion of the approved typed closure in memory after set-based loads. */
    private CatalogClosure closureGraph(String dataNodeRef, String brandRef, List<String> selected) {
        List<ItemRow> all = hydrateItemFacts(jdbc.query(
                "SELECT "
                        + "item_ref,code,name,short_name,shape_key,status,sections::text,version,updat"
                        + "ed_a"
                        + "t_epoch_millis,source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? "
                        + "AND status <> 'VOIDED' ORDER BY code",
                (r, n) -> new ItemRow(
                        r.getObject(1, UUID.class),
                        r.getString(2),
                        r.getString(3),
                        r.getString(4),
                        r.getString(5),
                        r.getString(6),
                        r.getString(7),
                        r.getLong(8),
                        r.getLong(9),
                        r.getString(10)),
                dataNodeRef,
                brandRef));
        Map<String, ItemRow> byCode = new LinkedHashMap<>();
        all.forEach(row -> byCode.put(row.code(), row));
        Map<String, ItemRow> byRef = new LinkedHashMap<>();
        all.forEach(row -> byRef.put(row.ref().toString(), row));
        Map<String, ItemRow> skuOwnerByRef = new LinkedHashMap<>();
        all.forEach(row -> {
            JsonNode skus = json(row.sectionsJson()).path("skus");
            if (skus.isArray())
                for (JsonNode sku : skus) {
                    String ref = sku.path("productSkuRef").asText("");
                    if (!ref.isBlank()) skuOwnerByRef.put(ref, row);
                }
        });
        LinkedHashSet<String> visited = new LinkedHashSet<>();
        LinkedHashSet<TypedReference> references = new LinkedHashSet<>();
        LinkedHashSet<ClosureEdge> edges = new LinkedHashSet<>();
        LinkedHashSet<UUID> unitRefs = new LinkedHashSet<>();
        ArrayList<String> queue = new ArrayList<>(selected);
        for (int index = 0; index < queue.size(); index++) {
            String code = queue.get(index);
            if (!visited.add(code)) continue;
            ItemRow row = byCode.get(code);
            if (row == null) continue;
            Set<UUID> rowUnitRefs = unitReferences(json(row.sectionsJson()));
            unitRefs.addAll(rowUnitRefs);
            for (UUID unitRef : rowUnitRefs)
                edges.add(new ClosureEdge(row.ref().toString(), unitRef.toString(), "CATALOG_UNIT"));
            for (TypedReference reference : typedReferences(json(row.sectionsJson()))) {
                references.add(reference);
                edges.add(new ClosureEdge(row.ref().toString(), reference.ref(), reference.referenceKind()));
                if (expandsCatalogItemClosure(reference.referenceKind())) {
                    ItemRow target = byRef.get(reference.ref());
                    if (target != null && !visited.contains(target.code())) queue.add(target.code());
                }
                if ("PRODUCT_SKU".equals(reference.referenceKind())) {
                    ItemRow target = skuOwnerByRef.get(reference.ref());
                    if (target != null && !visited.contains(target.code())) queue.add(target.code());
                }
            }
            // Order-option definitions are relational catalog facts. Their compulsory material products must enter
            // the ordinary item closure so the target definition template and inventory BOM can both rewrite opaque
            // references; do not serialise this relation back into item JSON.
            for (UUID materialItemRef : itemDefinitionFacts.orderOptionMaterialItemRefs(List.of(row.ref()))) {
                edges.add(new ClosureEdge(row.ref().toString(), materialItemRef.toString(), "ORDER_OPTION_MATERIAL"));
                ItemRow material = byRef.get(materialItemRef.toString());
                if (material != null && !visited.contains(material.code())) queue.add(material.code());
            }
        }
        List<ItemRow> items = new ArrayList<>();
        visited.forEach(code -> {
            ItemRow row = byCode.get(code);
            if (row != null) items.add(row);
        });
        List<String> categoryRefs = references.stream()
                .filter(ref -> "CATEGORY".equals(ref.referenceKind()))
                .map(TypedReference::ref)
                .distinct()
                .toList();
        List<CategoryRow> categories = loadCategories(dataNodeRef, brandRef, categoryRefs);
        List<TypedReference> dictionaryRefs = references.stream()
                .filter(ref -> isDictionaryReference(ref.referenceKind()))
                .toList();
        List<DictionaryRow> dictionaries = loadDictionaries(dataNodeRef, brandRef, dictionaryRefs);
        List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions =
                itemDefinitionFacts.copyOrderOptionDefinitions(
                        dataNodeRef, brandRef, items.stream().map(ItemRow::ref).toList());
        for (CatalogItemDefinitionFacts.CopyOrderOptionDefinition definition : orderOptionDefinitions)
            for (CatalogItemDefinitionFacts.CopyOrderOptionValue value : definition.values())
                for (CatalogItemDefinitionFacts.CopyOrderOptionMaterial material : value.materials())
                    if (material.consumptionUnitSnapshot() != null)
                        unitRefs.add(material.consumptionUnitSnapshot().unitRef());
        for (CatalogItemDefinitionFacts.CopyOrderOptionDefinition definition : orderOptionDefinitions)
            for (CatalogItemDefinitionFacts.CopyOrderOptionValue value : definition.values())
                for (CatalogItemDefinitionFacts.CopyOrderOptionMaterial material : value.materials())
                    if (material.materialItemRef() != null && material.consumptionUnitSnapshot() != null)
                        edges.add(new ClosureEdge(
                                material.materialItemRef().toString(),
                                material.consumptionUnitSnapshot().unitRef().toString(),
                                "CATALOG_UNIT"));
        List<UnitRow> units = loadUnits(dataNodeRef, brandRef, unitRefs);
        return new CatalogClosure(items, categories, dictionaries, units, orderOptionDefinitions, List.copyOf(edges));
    }

    private List<ItemRow> closure(String dataNodeRef, String brandRef, List<String> selected) {
        return closureGraph(dataNodeRef, brandRef, selected).items();
    }

    private List<CategoryRow> loadCategories(String scope, String brand, List<String> categoryRefs) {
        if (categoryRefs.isEmpty()) return List.of();
        List<UUID> refs = new ArrayList<>();
        for (String categoryRef : categoryRefs) {
            try {
                refs.add(UUID.fromString(categoryRef));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs cannot contain a business code", failure);
            }
        }
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        args.add(scope);
        args.add(brand);
        return jdbc.query(
                "WITH RECURSIVE selected(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE "
                        + "data_node_ref=? AND brand_ref=? AND category_ref IN ("
                        + placeholders
                        + ") AND status <> 'VOIDED' UNION SELECT category.parent_category_ref FROM "
                        + "catalog.catalog_category category JOIN selected child ON "
                        + "category.category_ref=child.category_ref WHERE category.parent_category_ref IS NOT NULL "
                        + "AND category.data_node_ref=? AND category.brand_ref=? AND category.status <> 'VOIDED') "
                        + "SELECT "
                        + "category.category_ref,category.code,category.name,category.parent_code,category.parent_c"
                        + "ategory_ref,category.status,category.version,category.display_order FROM "
                        + "catalog.catalog_category category JOIN selected ON "
                        + "selected.category_ref=category.category_ref ORDER BY category.parent_category_ref NULLS "
                        + "FIRST,category.display_order,category.code",
                (r, n) -> new CategoryRow(
                        r.getObject(1, UUID.class),
                        r.getString(2),
                        r.getString(3),
                        r.getString(4),
                        r.getObject(5, UUID.class),
                        r.getString(6),
                        r.getLong(7),
                        r.getInt(8)),
                args.toArray());
    }

    private Set<UUID> unitReferences(JsonNode node) {
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        collectUnitReferences(node, null, result);
        return Set.copyOf(result);
    }

    private void collectUnitReferences(JsonNode node, String parentKey, Set<UUID> result) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                boolean declared = Set.of(
                                "salesUnitRef",
                                "baseMeasureUnitRef",
                                "salesUnitOverrideRef",
                                "baseMeasureUnitOverrideRef",
                                "countingUnitRef")
                        .contains(key);
                boolean snapshotRef = "unitRef".equals(key)
                        && Set.of(
                                        "salesUnitSnapshot",
                                        "baseMeasureUnitSnapshot",
                                        "consumptionUnitSnapshot",
                                        "countingUnitSnapshot")
                                .contains(parentKey);
                if ((declared || snapshotRef)
                        && value.isTextual()
                        && !value.asText().isBlank()) {
                    try {
                        result.add(UUID.fromString(value.asText()));
                    } catch (IllegalArgumentException failure) {
                        throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, "商品单位引用不是 opaque UUID", failure);
                    }
                }
                collectUnitReferences(value, key, result);
            });
        } else if (node.isArray()) node.forEach(value -> collectUnitReferences(value, parentKey, result));
    }

    private List<UnitRow> loadUnits(String scope, String brand, Collection<UUID> unitRefs) {
        if (unitRefs == null || unitRefs.isEmpty()) return List.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(unitRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        List<UnitRow> rows = jdbc.query(
                "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? AND unit_ref IN ("
                        + placeholders
                        + ") ORDER BY code,unit_ref",
                (result, row) -> new UnitRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getInt(5),
                        result.getString(6),
                        result.getLong(7)),
                args.toArray());
        if (rows.size() != refs.size())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "复制所需单位定义无法完整读取");
        return rows;
    }

    private List<DictionaryRow> loadDictionaries(String scope, String brand, List<TypedReference> references) {
        if (references.isEmpty()) return List.of();
        List<UUID> refs = references.stream()
                .filter(ref -> isDictionaryReference(ref.referenceKind()))
                .map(ref -> UUID.fromString(ref.ref()))
                .distinct()
                .toList();
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        List<DictionaryRow> candidates = jdbc.query(
                "WITH RECURSIVE selected AS (SELECT "
                        + "entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,status,parent_entry_ref,display_"
                        + "orde"
                        + "r,version FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND status <> "
                        + "'VOIDED' AND entry_ref IN ("
                        + placeholders
                        + ") UNION SELECT "
                        + "parent.entry_ref,parent.data_node_ref,parent.brand_ref,parent.dictionary_kind,parent.cod"
                        + "e,parent.name,parent.status,parent.parent_entry_ref,parent.display_order,parent.version "
                        + "FROM catalog.dictionary_entry parent JOIN selected child ON "
                        + "parent.entry_ref=child.parent_entry_ref AND parent.data_node_ref=child.data_node_ref "
                        + "AND parent.brand_ref=child.brand_ref WHERE parent.status <> 'VOIDED') SELECT "
                        + "entry_ref,dictionary_kind,code,name,status,parent_entry_ref,display_order,version FROM "
                        + "selected ORDER BY dictionary_kind,code",
                (r, n) -> new DictionaryRow(
                        r.getObject(1, UUID.class),
                        r.getString(2),
                        r.getString(3),
                        r.getString(4),
                        r.getString(5),
                        r.getObject(6, UUID.class),
                        r.getInt(7),
                        r.getLong(8)),
                args.toArray());
        Set<UUID> requestedRefs = Set.copyOf(refs);
        return candidates.stream()
                .filter(row -> requestedRefs.contains(row.ref())
                        ? references.stream()
                                .anyMatch(ref -> ref.ref().equals(row.ref().toString())
                                        && dictionaryKindMatches(ref.referenceKind(), row.dictionaryKind()))
                        : candidates.stream()
                                .anyMatch(child -> requestedRefs.contains(child.ref())
                                        && row.ref().equals(child.parentEntryRef())))
                .toList();
    }

    public static void validateItemPageQuery(ObjectNode request) {
        if (request == null) return;
        Set<String> allowed = Set.of(
                "dataNodeRef",
                "keyword",
                "smartViewKey",
                "shapeKey",
                "categoryRef",
                "tagRef",
                "uncategorized",
                "includeSubCategories",
                "status",
                "source",
                "cursor",
                "pageSize",
                "queryGeneration",
                "itemCodes",
                "itemRefs",
                "itemCodesOnly");
        request.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "unknown catalog page query field: " + field);
        });
        String status = optional(request, "status");
        if (status != null && !CatalogOwnerTypes.STATUSES.contains(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "status is not supported");
        String shapeKey = optional(request, "shapeKey");
        if (shapeKey != null && !CatalogOwnerTypes.SHAPES.contains(shapeKey))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shapeKey is not supported");
        optionalUuid(request, "tagRef");
        if (parseBoolean(request, "uncategorized", false) && optional(request, "categoryRef") != null)
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "uncategorized cannot be combined with categoryRef");
        String smartViewKey = optional(request, "smartViewKey");
        if (smartViewKey != null && !CatalogInventoryShapeManifest.accepts("smartViewKey", smartViewKey))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "smartViewKey is not supported");
        String source = optional(request, "source");
        if (source != null && !CatalogInventoryShapeManifest.accepts("catalogSource", source))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "source is not supported");
        parsePageSize(request, "pageSize", 20);
        parseCursor(request, "cursor");
        parseBoolean(request, "includeSubCategories", false);
        if (request.has("itemCodes") && !request.path("itemCodes").isArray())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCodes must be an array");
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
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be between 1 and 100", ex);
        }
    }

    private static OpaqueCollectionCursor.Position decodeCollectionCursor(ObjectNode request, String queryIdentity) {
        try {
            return OpaqueCollectionCursor.decode(optional(request, "cursor"), queryIdentity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
    }

    private static String cursorIdentity(String operationId, String... parts) {
        StringBuilder identity = new StringBuilder(operationId);
        for (String part : parts) {
            String value = part == null ? "" : part;
            identity.append('|').append(value.length()).append(':').append(value);
        }
        return identity.toString();
    }

    private static long parseCursor(ObjectNode request, String key) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return 0L;
        try {
            long parsed = Long.parseLong(value.asText());
            if (parsed < 0) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException ex) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, key + " must be a non-negative opaque cursor", ex);
        }
    }

    private static boolean parseBoolean(ObjectNode request, String key, boolean fallback) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return fallback;
        if (value.isBoolean()) return value.asBoolean();
        if ("true".equalsIgnoreCase(value.asText())) return true;
        if ("false".equalsIgnoreCase(value.asText())) return false;
        throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be boolean");
    }

    private static List<String> textArray(JsonNode value) {
        if (value == null || !value.isArray()) return List.of();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        value.forEach(entry -> {
            if (entry.isTextual() && !entry.asText().isBlank()) result.add(entry.asText());
        });
        return List.copyOf(result);
    }

    private static List<UUID> uuidArray(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return List.of();
        if (!value.isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an array");
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        for (JsonNode entry : value) {
            if (!entry.isTextual())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must contain UUID values");
            try {
                result.add(UUID.fromString(entry.asText()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, field + " must contain UUID values", failure);
            }
        }
        return List.copyOf(result);
    }

    private List<TypedReference> typedReferences(JsonNode node) {
        LinkedHashSet<TypedReference> result = new LinkedHashSet<>();
        addDeclaredArrayRefs(result, node.path("categoryRefs"), "CATEGORY");
        addDeclaredArrayRefs(result, node.path("tagRefs"), "TAG");
        addDeclaredArrayRefs(result, node.path("productionTagRefs"), "PRODUCTION_TAG");
        if (node.path("skuVariantDimensions").isArray())
            for (JsonNode dimension : node.path("skuVariantDimensions")) {
                addDeclaredRef(result, dimension.path("attributeRef"), "SKU_ATTRIBUTE");
                if (dimension.path("values").isArray())
                    for (JsonNode value : dimension.path("values"))
                        addDeclaredRef(result, value.path("valueRef"), "SKU_ATTRIBUTE_VALUE");
            }
        if (node.path("skus").isArray())
            for (JsonNode sku : node.path("skus")) {
                addDeclaredRef(result, sku.path("productSkuRef"), "PRODUCT_SKU");
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs"))
                        addDeclaredRef(result, value.path("attributeValueRef"), "SKU_ATTRIBUTE_VALUE");
            }
        if (node.path("compositeGroups").isArray())
            for (JsonNode group : node.path("compositeGroups"))
                if (group.path("components").isArray())
                    for (JsonNode component : group.path("components")) {
                        addDeclaredRef(result, component.path("itemRef"), "COMPOSITE_COMPONENT");
                        addDeclaredRef(result, component.path("productSkuRef"), "PRODUCT_SKU");
                    }
        if (node.path("inventoryBom").isArray())
            for (JsonNode component : node.path("inventoryBom")) {
                addDeclaredRef(result, component.path("itemRef"), "BOM_COMPONENT");
                addDeclaredRef(result, component.path("productSkuRef"), "PRODUCT_SKU");
            }
        return List.copyOf(result);
    }

    private void addDeclaredArrayRefs(LinkedHashSet<TypedReference> result, JsonNode values, String kind) {
        if (values.isArray()) values.forEach(value -> addDeclaredRef(result, value, kind));
    }

    private void addDeclaredRef(LinkedHashSet<TypedReference> result, JsonNode value, String kind) {
        if (value != null && value.isTextual() && !value.asText().isBlank())
            result.add(new TypedReference(kind, value.asText()));
    }

    private boolean isItemReference(String kind) {
        return "CATALOG_ITEM".equals(kind) || "PRODUCT_SKU".equals(kind);
    }

    private boolean isDictionaryReference(String kind) {
        return Set.of("TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE")
                .contains(kind);
    }

    private boolean dictionaryKindMatches(String referenceKind, String dictionaryKind) {
        return switch (referenceKind) {
            case "TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE" -> referenceKind.equals(
                    dictionaryKind);
            default -> false;
        };
    }

    private ObjectNode receiptRequest(ObjectNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String dataNodeRef, String key, String operationId, ObjectNode request) {
        AdvisoryLock.acquire(jdbc, "catalog-receipt", dataNodeRef, key);
        List<Receipt> rows = jdbc.query(
                "SELECT operation_id,request_hash,response::text FROM catalog.command_receipt WHERE data_node_ref=? "
                        + "AND idempotency_key=?",
                (r, n) -> new Receipt(r.getString(1), r.getString(2), json(r.getString(3))),
                dataNodeRef,
                key);
        if (rows.isEmpty()) return null;
        Receipt receipt = rows.get(0);
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request)))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return receipt.response();
    }

    private void saveReceipt(String scope, String key, String op, ObjectNode request, JsonNode response) {
        jdbc.update(
                "INSERT INTO "
                        + "catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,"
                        + "resp"
                        + "onse,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                scope,
                key,
                op,
                hash(request),
                canonicalJson(response),
                now());
    }

    private long count(String table, String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                dataNodeRef,
                brandRef);
        return value == null ? 0 : value;
    }

    private long countShape(String dataNodeRef, String brandRef, String shape) {
        Long value = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND shape_key=?",
                Long.class,
                dataNodeRef,
                brandRef,
                shape);
        return value == null ? 0 : value;
    }

    private long generation(String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                dataNodeRef,
                brandRef);
        return value == null ? 0 : value;
    }

    private long dictionaryGeneration(String dataNodeRef, String brandRef, String kind) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? "
                        + "AND dictionary_kind=?",
                Long.class,
                dataNodeRef,
                brandRef,
                kind);
        return value == null ? 0 : value;
    }

    private static void requireScope(String dataNodeRef, String brandRef) {
        if (dataNodeRef == null || dataNodeRef.isBlank() || brandRef == null || brandRef.isBlank())
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    private static void requireOwnerScopeGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            String dataNodeRef,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        String expectedCapability = CatalogTargetCapability.forDataNodeType(dataNodeType);
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || expectedCapability == null)
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog owner scope grant is required");
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null
                    && ownerScopeGrant.matchesCapability(
                            workspaceUuid, groupWorkspaceKey, dataNodeType, targetId, expectedCapability)) return;
        } catch (RuntimeException ignored) {
        }
        throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog owner scope grant is required");
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

    private static String copySourceDataNodeRef(CatalogAuthorizationScope scope) {
        return switch (scope.copySourcePolicy()) {
            case TARGET_SCOPE -> scope.dataNodeId().toString();
            case ORGANIZATION_JUDGMENT -> {
                if (scope.copySourceDataNodeId() == null)
                    throw new CatalogOwnerApi.Problem(
                            "SCOPE_FORBIDDEN", 403, "catalog copy source judgment is required");
                yield scope.copySourceDataNodeId().toString();
            }
            default -> throw new CatalogOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "catalog copy source policy is not authorized");
        };
    }

    private String requiredDictionaryKind(ObjectNode request) {
        return canonicalDictionaryKind(required(request, "dictionaryKind"));
    }

    private String canonicalDictionaryKind(String kind) {
        if (!copyLimits.allowsDictionaryKind(kind))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dictionaryKind is not supported");
        return kind;
    }

    private void validateDictionaryParent(String scope, String brand, String kind, UUID parentEntryRef) {
        boolean requiresParent = "SKU_ATTRIBUTE_VALUE".equals(kind);
        if (requiresParent != (parentEntryRef != null)) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    /* format-wrap */
                    "SKU_ATTRIBUTE_VALUE 必须带 parentEntryRef，其他字典类型不得带父属性");
        }
        if (parentEntryRef == null) return;
        Boolean valid = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.dictionary_entry WHERE entry_ref=? AND data_node_ref=? AND "
                        + "brand_ref=? AND dictionary_kind='SKU_ATTRIBUTE')",
                Boolean.class,
                parentEntryRef,
                scope,
                brand);
        if (!Boolean.TRUE.equals(valid))
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "parentEntryRef 必须是当前 scope 的 SKU_ATTRIBUTE");
    }

    private UUID dictionaryParentRef(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT parent_entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    private UUID dictionaryEntryRef(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "字典条目不存在");
                    return result.getObject(1, UUID.class);
                });
    }

    private static String required(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

    private static String required(JsonNode request, String key) {
        String value = request == null ? "" : request.path(key).asText("");
        if (value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

    private static UUID requiredUuid(ObjectNode request, String key) {
        String value = required(request, key);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be an opaque UUID ref", failure);
        }
    }

    private static UUID requiredUuid(JsonNode request, String key) {
        String value = required(request, key);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be an opaque UUID ref", failure);
        }
    }

    private static UUID optionalUuid(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be an opaque UUID ref", failure);
        }
    }

    private static String optional(ObjectNode request, String key) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static long requiredCatalogExpectedVersion(ObjectNode request) {
        JsonNode sections = request == null ? null : request.get("sections");
        if (!(sections instanceof ObjectNode sectionObject)) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedCatalogVersion is required");
        }
        long expected = requiredLong(sectionObject, "expectedCatalogVersion", -1);
        if (expected < 0)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedCatalogVersion is required");
        return expected;
    }

    private static long requiredLong(ObjectNode request, String key, long fallback) {
        JsonNode value = request.get(key);
        if (value == null || !value.isIntegralNumber()) return fallback;
        return value.asLong();
    }

    private static long requiredLong(JsonNode request, String key, long fallback) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || !value.isIntegralNumber() ? fallback : value.asLong();
    }

    private String canonicalJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value == null ? mapper.createObjectNode() : value);
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", ex);
        }
    }

    private JsonNode json(String value) {
        if (value == null || value.isBlank()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is missing");
        }
        try {
            JsonNode parsed = mapper.readTree(value);
            if (parsed == null || parsed.isNull()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is missing");
            }
            return parsed;
        } catch (CatalogOwnerApi.Problem problem) {
            throw problem;
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is invalid", ex);
        }
    }

    private String hash(JsonNode value) {
        return digest(canonicalJson(value));
    }

    private static String digest(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private long now() {
        return time.currentEpochMillis();
    }

    private CatalogOwnerApi.Problem tooLarge(String code, int actual, int limit) {
        return new CatalogOwnerApi.Problem(code, 422, code + " actual=" + actual + " limit=" + limit);
    }

    private List<String> selectedCodes(ObjectNode request) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        JsonNode values = request.get("selectedItemCodes");
        if (values != null && values.isArray())
            values.forEach(v -> {
                if (v.isTextual()) result.add(v.asText());
            });
        String single = optional(request, "sourceItemCode");
        if (single != null) result.add(single);
        if (result.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "copy selection is required");
        return List.copyOf(result);
    }

    private Set<String> selectedSectionsElements(ArrayNode values) {
        Set<String> result = new java.util.HashSet<>();
        values.forEach(value -> {
            if (value.isTextual()) result.add(value.asText());
        });
        return result;
    }

    private List<String> stringValues(JsonNode values) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        values.forEach(value -> {
            if (value.isTextual() && !value.asText().isBlank()) result.add(value.asText());
        });
        if (result.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "copy closure is required");
        return List.copyOf(result);
    }

    private long scopeVersion(List<ItemRow> rows) {
        return rows.stream().mapToLong(ItemRow::version).max().orElse(0L);
    }

    private long scopeVersion(CatalogClosure graph) {
        return graph.objects().stream().mapToLong(CatalogObject::version).max().orElse(0L);
    }

    private long targetScopeVersion(String target, String brand, ObjectNode request, List<ItemRow> source) {
        String targetCode = optional(request, "targetItemCode");
        if (targetCode != null) {
            Long value = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? "
                            + "AND code=? AND status <> 'VOIDED'",
                    Long.class,
                    target,
                    brand,
                    targetCode);
            return value == null ? 0L : value;
        }
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND "
                        + "code IN ("
                        + String.join(",", Collections.nCopies(source.size(), "?")) + ") AND status <> 'VOIDED'",
                concatArgs(Long.class, target, brand, source),
                Long.class);
        return value == null ? 0L : value;
    }

    private long targetScopeVersion(String target, String brand, ObjectNode request, CatalogClosure graph) {
        long max = targetScopeVersion(target, brand, request, graph.items());
        Map<String, Long> categoryVersions = targetCategoryVersions(target, brand, graph.categories());
        for (CategoryRow row : graph.categories()) max = Math.max(max, categoryVersions.getOrDefault(row.code(), 0L));
        Map<DictionaryKey, Long> dictionaryVersions = targetDictionaryVersions(target, brand, graph.dictionaries());
        for (DictionaryRow row : graph.dictionaries()) {
            DictionaryKey key = new DictionaryKey(row.dictionaryKind(), row.code());
            max = Math.max(max, dictionaryVersions.getOrDefault(key, 0L));
        }
        Map<String, Long> unitVersions = targetUnitVersions(target, brand, graph.units());
        for (UnitRow row : graph.units()) max = Math.max(max, unitVersions.getOrDefault(row.code(), 0L));
        return max;
    }

    private Map<String, Long> targetCategoryVersions(String target, String brand, List<CategoryRow> rows) {
        List<String> codes = rows.stream().map(CategoryRow::code).distinct().toList();
        if (codes.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                "SELECT code,MAX(version) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? "
                        + "AND code IN ("
                        + placeholders + ") GROUP BY code",
                result -> {
                    Map<String, Long> versions = new LinkedHashMap<>();
                    while (result.next()) versions.put(result.getString(1), result.getLong(2));
                    return versions;
                },
                args.toArray());
    }

    private Map<DictionaryKey, Long> targetDictionaryVersions(String target, String brand, List<DictionaryRow> rows) {
        List<DictionaryKey> keys = rows.stream()
                .map(row -> new DictionaryKey(row.dictionaryKind(), row.code()))
                .distinct()
                .toList();
        if (keys.isEmpty()) return Map.of();
        String predicates = String.join(" OR ", Collections.nCopies(keys.size(), "(dictionary_kind=? AND code=?)"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        for (DictionaryKey key : keys) {
            args.add(key.kind());
            args.add(key.code());
        }
        return jdbc.query(
                "SELECT dictionary_kind,code,MAX(version) FROM catalog.dictionary_entry WHERE data_node_ref=? AND "
                        + "brand_ref=? AND (" + predicates + ") GROUP BY dictionary_kind,code",
                result -> {
                    Map<DictionaryKey, Long> versions = new LinkedHashMap<>();
                    while (result.next())
                        versions.put(new DictionaryKey(result.getString(1), result.getString(2)), result.getLong(3));
                    return versions;
                },
                args.toArray());
    }

    private Map<String, Long> targetUnitVersions(String target, String brand, List<UnitRow> rows) {
        if (rows == null || rows.isEmpty()) return Map.of();
        List<String> codes = rows.stream().map(UnitRow::code).distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                "SELECT code,MAX(version) FROM catalog.unit_definition WHERE data_node_ref=? AND brand_ref=? "
                        + "AND code IN ("
                        + placeholders
                        + ") GROUP BY code",
                result -> {
                    Map<String, Long> versions = new LinkedHashMap<>();
                    while (result.next()) versions.put(result.getString(1), result.getLong(2));
                    return versions;
                },
                args.toArray());
    }

    private Map<String, UUID> activeCategoryRefsByCode(String target, String brand, List<CategoryRow> rows) {
        List<String> codes = rows.stream().map(CategoryRow::code).distinct().toList();
        if (codes.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                "SELECT code,category_ref FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? "
                        + "AND code IN ("
                        + placeholders + ") AND status <> 'VOIDED' ORDER BY code,category_ref",
                result -> {
                    Map<String, UUID> refs = new LinkedHashMap<>();
                    while (result.next()) {
                        String code = result.getString(1);
                        UUID ref = result.getObject(2, UUID.class);
                        if (refs.putIfAbsent(code, ref) != null)
                            throw new CatalogOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, "目标分类编码引用不唯一: " + code);
                    }
                    return refs;
                },
                args.toArray());
    }

    private Map<DictionaryKey, UUID> activeDictionaryRefsByKey(String target, String brand, List<DictionaryRow> rows) {
        List<DictionaryKey> keys = rows.stream()
                .map(row -> new DictionaryKey(row.dictionaryKind(), row.code()))
                .distinct()
                .toList();
        if (keys.isEmpty()) return Map.of();
        String predicates = String.join(" OR ", Collections.nCopies(keys.size(), "(dictionary_kind=? AND code=?)"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        for (DictionaryKey key : keys) {
            args.add(key.kind());
            args.add(key.code());
        }
        return jdbc.query(
                "SELECT dictionary_kind,code,entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND "
                        + "brand_ref=? AND (" + predicates + ") AND status <> 'VOIDED' "
                        + "ORDER BY dictionary_kind,code,entry_ref",
                result -> {
                    Map<DictionaryKey, UUID> refs = new LinkedHashMap<>();
                    while (result.next()) {
                        DictionaryKey key = new DictionaryKey(result.getString(1), result.getString(2));
                        UUID ref = result.getObject(3, UUID.class);
                        if (refs.putIfAbsent(key, ref) != null) {
                            String failureMessage = "目标字典编码引用不唯一: " + key.code();
                            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage);
                        }
                    }
                    return refs;
                },
                args.toArray());
    }

    private Object[] concatArgs(Class<?> ignored, String target, String brand, List<ItemRow> source) {
        ArrayList<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        source.forEach(row -> args.add(row.code()));
        return args.toArray();
    }

    private String copyDigest(
            String source,
            String target,
            String brandRef,
            List<String> selected,
            CatalogClosure graph,
            long sourceVersion,
            long targetVersion) {
        ArrayList<String> identities = new ArrayList<>();
        graph.objects()
                .forEach(row -> identities.add(row.objectType() + ":" + row.code() + ":" + row.version()
                        + (row instanceof ItemRow item
                                ? ":" + skuStructureFingerprint(json(item.sectionsJson()))
                                : "")));
        Collections.sort(identities);
        ArrayList<String> codes = new ArrayList<>(selected);
        Collections.sort(codes);
        String attributeDefinitions = itemDefinitionFacts.attributeCopyFingerprint(
                source, brandRef, graph.items().stream().map(ItemRow::ref).toList());
        String orderOptionDefinitions = itemDefinitionFacts.orderOptionCopyFingerprint(
                source, brandRef, graph.items().stream().map(ItemRow::ref).toList());
        return digest(source + "|" + target + "|" + String.join(",", codes) + "|" + String.join(",", identities) + "|"
                + attributeDefinitions + "|" + orderOptionDefinitions + "|" + sourceVersion + "|" + targetVersion);
    }
    /**
     * The copy plan is keyed only by source opaque refs. A code may locate an equivalent target fact, but it never
     * becomes the relation identity or a rewrite key. On execute, the preflight plan is supplied back by the
     * coordinator and must agree with any target fact that already exists.
     */
    private CopyCompatibility validateCopyCompatibility(
            String source,
            String target,
            String brand,
            CatalogClosure graph,
            ObjectNode request,
            boolean rejectBlocking) {
        Map<ReferenceKey, String> supplied = suppliedReferenceMappings(request);
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>();
        Map<String, ItemRow> targetRows = new LinkedHashMap<>();
        if (!graph.items().isEmpty())
            loadItems(target, brand, graph.items().stream().map(ItemRow::code).toList())
                    .forEach(row -> targetRows.put(row.code(), row));
        for (ItemRow row : graph.items()) {
            ItemRow existing = targetRows.get(row.code());
            mapping.put(
                    new ReferenceKey("CATALOG_ITEM", row.ref().toString()),
                    targetRefFor(
                            new ReferenceKey("CATALOG_ITEM", row.ref().toString()),
                            existing == null ? null : existing.ref(),
                            supplied));
        }
        Map<String, UUID> targetCategoryRefs = activeCategoryRefsByCode(target, brand, graph.categories());
        for (CategoryRow row : graph.categories()) {
            UUID existing = targetCategoryRefs.get(row.code());
            mapping.put(
                    new ReferenceKey("CATALOG_CATEGORY", row.ref().toString()),
                    targetRefFor(new ReferenceKey("CATALOG_CATEGORY", row.ref().toString()), existing, supplied));
        }
        Map<DictionaryKey, UUID> targetDictionaryRefs = activeDictionaryRefsByKey(target, brand, graph.dictionaries());
        for (DictionaryRow row : graph.dictionaries()) {
            UUID existing = targetDictionaryRefs.get(new DictionaryKey(row.dictionaryKind(), row.code()));
            mapping.put(
                    new ReferenceKey(row.objectType(), row.ref().toString()),
                    targetRefFor(new ReferenceKey(row.objectType(), row.ref().toString()), existing, supplied));
        }
        Map<String, UnitRow> targetUnits = targetUnitsByCode(target, brand, graph.units());
        for (UnitRow row : graph.units()) {
            UnitRow existing = targetUnits.get(row.code());
            ReferenceKey key = new ReferenceKey("CATALOG_UNIT", row.ref().toString());
            mapping.put(key, targetRefFor(key, existing == null ? null : existing.ref(), supplied));
            if (existing != null && !sameUnitDefinition(row, existing) && rejectBlocking)
                throw new CatalogOwnerApi.Problem(
                        "CATALOG_COPY_UNIT_CONFLICT",
                        422,
                        /* format-wrap */
                        "同编码计量单位的名称、类别或精度不一致: " + row.code());
        }
        for (ItemRow row : graph.items()) {
            ItemRow existing = targetRows.get(row.code());
            Map<String, UUID> existingSkuRefs =
                    existing == null ? Map.of() : skuRefsByCode(json(existing.sectionsJson()));
            for (JsonNode sourceSku : rawSkuRows(json(row.sectionsJson()))) {
                String sourceSkuRef = sourceSku.path("productSkuRef").asText("");
                String skuCode = firstText(sourceSku, "skuCode", "code");
                if (sourceSkuRef.isBlank() || skuCode == null || skuCode.isBlank()) continue;
                mapping.put(
                        new ReferenceKey("PRODUCT_SKU", sourceSkuRef),
                        targetRefFor(
                                new ReferenceKey("PRODUCT_SKU", sourceSkuRef), existingSkuRefs.get(skuCode), supplied));
            }
        }
        CatalogItemDefinitionFacts.OrderOptionCopyPlan orderOptionPlan = itemDefinitionFacts.planOrderOptionCopy(
                source,
                brand,
                target,
                brand,
                graph.orderOptionDefinitions(),
                uuidMappings(mapping, "CATALOG_ITEM"),
                uuidMappings(supplied, "CATALOG_ORDER_OPTION_DEFINITION"),
                uuidMappings(supplied, "CATALOG_ORDER_OPTION_DEFINITION_VALUE"));
        orderOptionPlan
                .definitionMappings()
                .forEach((from, to) -> mapping.put(
                        new ReferenceKey("CATALOG_ORDER_OPTION_DEFINITION", from.toString()), to.toString()));
        orderOptionPlan
                .valueMappings()
                .forEach((from, to) -> mapping.put(
                        new ReferenceKey("CATALOG_ORDER_OPTION_DEFINITION_VALUE", from.toString()), to.toString()));
        // Production owns the target tag fact.  Catalog only accepts the public
        // owner-produced mapping carried by the coordinator; it never probes the
        // production schema nor invents a target tag UUID.
        supplied.forEach((key, value) -> {
            if ("PRODUCTION_TAG".equals(key.objectType())) mapping.put(key, value);
        });
        for (ItemRow row : graph.items()) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            if (rejectBlocking && check.blocking())
                throw new CatalogOwnerApi.Problem(check.problemCode(), 422, check.reason() + ": " + row.code());
        }
        List<String> attributeConflicts = itemDefinitionFacts.attributeCopyConflictCodes(
                source,
                brand,
                target,
                brand,
                graph.items().stream().map(ItemRow::ref).toList());
        if (rejectBlocking && !attributeConflicts.isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    422,
                    "同编码商品属性定义的类型或选项不一致: " + String.join(",", attributeConflicts));
        if (rejectBlocking && !orderOptionPlan.conflictCodes().isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    422,
                    "同编码点单选项定义的选择方式、选项或扣料原料不一致:" + " " +
                            /* format-wrap */
                            String.join(",", orderOptionPlan.conflictCodes()));
        return new CopyCompatibility(Map.copyOf(mapping));
    }

    private Map<String, UnitRow> targetUnitsByCode(String target, String brand, List<UnitRow> sourceUnits) {
        if (sourceUnits == null || sourceUnits.isEmpty()) return Map.of();
        List<String> codes = sourceUnits.stream().map(UnitRow::code).distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                "SELECT unit_ref,code,name,dimension,precision,status,version FROM catalog.unit_definition "
                        + "WHERE data_node_ref=? AND brand_ref=? AND code IN ("
                        + placeholders
                        + ") ORDER BY code,unit_ref",
                result -> {
                    Map<String, UnitRow> rows = new LinkedHashMap<>();
                    while (result.next()) {
                        UnitRow row = new UnitRow(
                                result.getObject(1, UUID.class),
                                result.getString(2),
                                result.getString(3),
                                result.getString(4),
                                result.getInt(5),
                                result.getString(6),
                                result.getLong(7));
                        if (rows.putIfAbsent(row.code(), row) != null)
                            throw new CatalogOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED",
                                    422,
                                    /* format-wrap */
                                    "目标单位编码引用不唯一: " + row.code());
                    }
                    return rows;
                },
                args.toArray());
    }

    private boolean sameUnitDefinition(UnitRow source, UnitRow target) {
        return source.code().equals(target.code())
                && source.name().equals(target.name())
                && source.unitDimension().equals(target.unitDimension())
                && source.precision() == target.precision();
    }

    private static Map<UUID, UUID> uuidMappings(Map<ReferenceKey, String> mappings, String objectType) {
        Map<UUID, UUID> result = new LinkedHashMap<>();
        for (Map.Entry<ReferenceKey, String> entry : mappings.entrySet()) {
            if (!objectType.equals(entry.getKey().objectType())) continue;
            try {
                result.put(UUID.fromString(entry.getKey().ref()), UUID.fromString(entry.getValue()));
            } catch (IllegalArgumentException invalid) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "复制引用不是有效的 opaque UUID", invalid);
            }
        }
        return Map.copyOf(result);
    }

    private Map<ReferenceKey, String> suppliedReferenceMappings(ObjectNode request) {
        if (request == null || !request.path("referenceMappings").isArray()) return Map.of();
        Map<ReferenceKey, String> result = new LinkedHashMap<>();
        for (JsonNode value : request.path("referenceMappings")) {
            if (!value.isObject())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings must contain objects");
            String objectType = value.path("objectType").asText("");
            String sourceRef = opaqueCopyRef(value, "sourceRef");
            String targetRef = opaqueCopyRef(value, "targetRef");
            ReferenceKey key = new ReferenceKey(objectType, sourceRef);
            if (result.putIfAbsent(key, targetRef) != null)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "referenceMappings contains duplicate source object reference");
        }
        return Map.copyOf(result);
    }

    private String targetRefFor(ReferenceKey source, UUID existing, Map<ReferenceKey, String> supplied) {
        String planned = supplied.get(source);
        if (existing != null) {
            if (planned != null && !existing.toString().equals(planned)) {
                throw new CatalogOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("预检 targetRef 与已存在目标事实不一致"));
            }
            return existing.toString();
        }
        return planned == null ? UUID.randomUUID().toString() : planned;
    }

    private String opaqueCopyRef(JsonNode value, String key) {
        try {
            return UUID.fromString(value.path(key).asText("")).toString();
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", failure);
        }
    }

    private List<JsonNode> rawSkuRows(JsonNode sections) {
        if (sections == null || !sections.path("skus").isArray()) return List.of();
        List<JsonNode> rows = new ArrayList<>();
        sections.path("skus").forEach(rows::add);
        return rows;
    }

    private Map<String, UUID> skuRefsByCode(JsonNode sections) {
        Map<String, UUID> result = new LinkedHashMap<>();
        for (JsonNode sku : rawSkuRows(sections)) {
            String code = firstText(sku, "skuCode", "code");
            String ref = sku.path("productSkuRef").asText("");
            if (code == null || code.isBlank() || ref.isBlank()) continue;
            try {
                result.put(code, UUID.fromString(ref));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "target productSkuRef must be UUID", failure);
            }
        }
        return result;
    }

    private CompatibilityCheck compatibilityCheck(
            ItemRow source, ItemRow existing, CatalogClosure graph, Map<ReferenceKey, String> mapping) {
        if (existing != null && !existing.shapeKey().equals(source.shapeKey()))
            return new CompatibilityCheck(
                    "BLOCKED", "商品形态结构不兼容", "STRUCTURE_INCOMPATIBLE", "STRUCTURE_INCOMPATIBLE", true);
        String sourceSkuStructure = skuStructureFingerprint(json(source.sectionsJson()));
        String targetSkuStructure = existing == null ? null : skuStructureFingerprint(json(existing.sectionsJson()));
        if (existing != null && !sourceSkuStructure.equals(targetSkuStructure))
            return new CompatibilityCheck(
                    "BLOCKED",
                    "SKU 结构指纹不一致",
                    "STRUCTURE_INCOMPATIBLE",
                    "SKU_STRUCTURE_INCOMPATIBLE",
                    /* format-wrap */
                    true);
        for (TypedReference ref : typedReferences(json(source.sectionsJson()))) {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET", "SKU").contains(ref.referenceKind())) continue;
            ReferenceKey key = new ReferenceKey(copyReferenceObjectType(ref.referenceKind()), ref.ref());
            if (!mapping.containsKey(key))
                return new CompatibilityCheck(
                        "BLOCKED",
                        "商品引用无法重写",
                        "REFERENCE_MAPPING_UNRESOLVED",
                        /* format-wrap */
                        "REFERENCE_MAPPING_UNRESOLVED",
                        true);
        }
        return new CompatibilityCheck(
                existing == null ? "CREATE" : "REUSE",
                existing == null ? "目标不存在，将创建" : "编码与结构兼容，可复用",
                null,
                existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED",
                false);
    }

    static boolean expandsCatalogItemClosure(String referenceKind) {
        return Set.of("CATALOG_ITEM", "COMPOSITE_COMPONENT", "BOM_COMPONENT").contains(referenceKind);
    }

    static String copyReferenceObjectType(String referenceKind) {
        return switch (referenceKind) {
            case "CATALOG_ITEM",
                    "COMPOSITE_COMPONENT",
                    "BOM_COMPONENT",
                    "ORDER_OPTION_MATERIAL",
                    "SKU" -> "CATALOG_ITEM";
            case "CATEGORY" -> "CATALOG_CATEGORY";
            case "TAG" -> "CATALOG_TAG";
            case "SKU_ATTRIBUTE" -> "SKU_ATTRIBUTE";
            case "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            case "PRODUCTION_TAG" -> "PRODUCTION_TAG";
            default -> referenceKind;
        };
    }

    private ObjectNode canonicalTuple(String ownerRef, String brandRef, String objectType, String... parts) {
        ObjectNode tuple = mapper.createObjectNode()
                .put("ownerRef", ownerRef)
                .put("brandRef", brandRef)
                .put("objectType", objectType);
        ArrayNode values = tuple.putArray("parts");
        for (String part : parts) values.add(part == null ? "" : part);
        return tuple;
    }

    private ObjectNode canonicalTuple(String ownerRef, String brandRef, String objectType, List<String> parts) {
        ObjectNode tuple = mapper.createObjectNode()
                .put("ownerRef", ownerRef)
                .put("brandRef", brandRef)
                .put("objectType", objectType);
        ArrayNode values = tuple.putArray("parts");
        parts.forEach(part -> values.add(part == null ? "" : part));
        return tuple;
    }

    private List<String> canonicalParts(DictionaryRow row, CatalogClosure graph) {
        if ("SKU_ATTRIBUTE_VALUE".equals(row.dictionaryKind()) && row.parentEntryRef() != null) {
            DictionaryRow parent = graph.dictionaries().stream()
                    .filter(candidate -> row.parentEntryRef().equals(candidate.ref()))
                    .findFirst()
                    .orElse(null);
            if (parent == null)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "SKU 属性值的父属性未进入复制闭包: " + row.code());
            return List.of(parent.code(), row.code());
        }
        return List.of(row.code());
    }
    /**
     * Builds read labels from the scoped target fact where it exists; for a planned CREATE the copied source's
     * immutable code is the planned target label.
     */
    private ObjectNode referenceMappingRow(
            ReferenceKey source, String targetRef, CatalogClosure graph, Map<String, ItemRow> targetItemsByRef) {
        ObjectNode row = mapper.createObjectNode()
                .put("objectType", source.objectType())
                .put("sourceRef", source.ref())
                .put("targetRef", targetRef);
        String targetCode = null;
        String targetSkuCode = null;
        String targetOptionValueCode = null;
        UnitRow sourceUnit = null;
        if ("CATALOG_ITEM".equals(source.objectType())) {
            ItemRow target = targetItemsByRef.get(targetRef);
            ItemRow sourceItem = graph.items().stream()
                    .filter(item -> item.ref().toString().equals(source.ref()))
                    .findFirst()
                    .orElse(null);
            targetCode = target == null ? sourceItem == null ? null : sourceItem.code() : target.code();
        } else if ("PRODUCT_SKU".equals(source.objectType())) {
            for (ItemRow item : graph.items())
                for (JsonNode sku : rawSkuRows(json(item.sectionsJson()))) {
                    if (source.ref().equals(sku.path("productSkuRef").asText())) {
                        targetSkuCode = firstText(sku, "skuCode", "code");
                        break;
                    }
                    if (targetSkuCode != null) break;
                }
        } else if ("SKU_ATTRIBUTE_VALUE".equals(source.objectType())) {
            targetOptionValueCode = optionValueCodeForRef(graph, source.ref());
            if (targetOptionValueCode == null)
                targetOptionValueCode = graph.dictionaries().stream()
                        .filter(value -> value.ref().toString().equals(source.ref()))
                        .map(DictionaryRow::code)
                        .findFirst()
                        .orElse(null);
        } else if ("CATALOG_ORDER_OPTION_DEFINITION".equals(source.objectType())) {
            targetCode = graph.orderOptionDefinitions().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .map(CatalogItemDefinitionFacts.CopyOrderOptionDefinition::code)
                    .findFirst()
                    .orElse(null);
        } else if ("CATALOG_ORDER_OPTION_DEFINITION_VALUE".equals(source.objectType())) {
            for (CatalogItemDefinitionFacts.CopyOrderOptionDefinition definition : graph.orderOptionDefinitions()) {
                for (CatalogItemDefinitionFacts.CopyOrderOptionValue value : definition.values()) {
                    if (!value.ref().toString().equals(source.ref())) continue;
                    targetCode = definition.code();
                    targetOptionValueCode = value.code();
                    break;
                }
                if (targetOptionValueCode != null) break;
            }
        } else if ("CATALOG_CATEGORY".equals(source.objectType())) {
            targetCode = graph.categories().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .map(CategoryRow::code)
                    .findFirst()
                    .orElse(null);
        } else if ("CATALOG_UNIT".equals(source.objectType())) {
            sourceUnit = graph.units().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .findFirst()
                    .orElse(null);
            targetCode = sourceUnit == null ? null : sourceUnit.code();
        } else {
            targetCode = graph.dictionaries().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .map(DictionaryRow::code)
                    .findFirst()
                    .orElse(null);
        }
        if (targetCode == null) row.putNull("targetCode");
        else row.put("targetCode", targetCode);
        if (targetSkuCode == null) row.putNull("targetSkuCode");
        else row.put("targetSkuCode", targetSkuCode);
        if (targetOptionValueCode == null) row.putNull("targetOptionValueCode");
        else row.put("targetOptionValueCode", targetOptionValueCode);
        if (sourceUnit == null) {
            row.putNull("targetUnitName");
            row.putNull("targetUnitDimension");
            row.putNull("targetUnitPrecision");
        } else {
            row.put("targetUnitName", sourceUnit.name());
            row.put("targetUnitDimension", sourceUnit.unitDimension());
            row.put("targetUnitPrecision", sourceUnit.precision());
        }
        return row;
    }

    private ObjectNode unitReferenceMappingRow(UnitRow source, UUID targetRef) {
        return mapper.createObjectNode()
                .put("objectType", "CATALOG_UNIT")
                .put("sourceRef", source.ref().toString())
                .put("targetRef", targetRef.toString())
                .put("targetCode", source.code())
                .put("targetUnitName", source.name())
                .put("targetUnitDimension", source.unitDimension())
                .put("targetUnitPrecision", source.precision());
    }

    /**
     * The production owner supplies this row during its scoped preflight. Catalog only carries it through after
     * validating the opaque pair.
     */
    private ObjectNode productionReferenceMappingRow(ObjectNode request, ReferenceKey source, String targetRef) {
        JsonNode mappings = request.path("referenceMappings");
        if (mappings.isArray())
            for (JsonNode candidate : mappings) {
                if ("PRODUCTION_TAG".equals(candidate.path("objectType").asText())
                        && source.ref().equals(candidate.path("sourceRef").asText())
                        && targetRef.equals(candidate.path("targetRef").asText())) {
                    ObjectNode row = mapper.createObjectNode()
                            .put("objectType", "PRODUCTION_TAG")
                            .put("sourceRef", source.ref())
                            .put("targetRef", targetRef);
                    copyNullableText(row, candidate, "targetCode");
                    copyNullableText(row, candidate, "targetSkuCode");
                    copyNullableText(row, candidate, "targetOptionValueCode");
                    if (!row.has("targetCode")) row.putNull("targetCode");
                    if (!row.has("targetSkuCode")) row.putNull("targetSkuCode");
                    if (!row.has("targetOptionValueCode")) row.putNull("targetOptionValueCode");
                    return row;
                }
            }
        throw new CatalogOwnerApi.Problem(
                "REFERENCE_MAPPING_UNRESOLVED",
                422,
                "production tag mapping must come from the production owner preflight");
    }

    private String optionValueCodeForRef(CatalogClosure graph, String ref) {
        for (ItemRow item : graph.items()) {
            for (JsonNode sku : rawSkuRows(json(item.sectionsJson())))
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs")) {
                        if (ref.equals(value.path("attributeValueRef").asText()))
                            return firstText(value, "valueCode", "attributeValueCode", "code", "name");
                    }
        }
        return null;
    }

    private Map<String, ItemRow> itemsByRef(String scope, String brand, List<String> codes) {
        Map<String, ItemRow> result = new LinkedHashMap<>();
        loadItems(scope, brand, codes).forEach(item -> result.put(item.ref().toString(), item));
        return result;
    }
    /** Stable product compatibility bit: skuCode -> sorted(attributeCode,valueCode) pairs. */
    static String skuStructureFingerprint(JsonNode sections) {
        JsonNode skus = sections == null ? null : sections.path("skus");
        if (skus == null || !skus.isArray())
            skus = sections == null ? null : sections.path("skuStructure").path("skus");
        List<String> fingerprints = new ArrayList<>();
        if (skus != null && skus.isArray()) {
            skus.forEach(sku -> {
                String skuCode = firstText(sku, "skuCode", "code");
                if (skuCode == null || skuCode.isBlank()) return;
                List<String> values = new ArrayList<>();
                JsonNode attributeValues = sku.path("attributeValues");
                if (attributeValues.isObject())
                    attributeValues
                            .fields()
                            .forEachRemaining(entry -> appendAttributePair(values, entry.getKey(), entry.getValue()));
                else if (attributeValues.isArray())
                    attributeValues.forEach(value -> appendAttributeObject(values, value));
                JsonNode attributes = sku.path("attributes");
                if (attributes.isObject())
                    attributes
                            .fields()
                            .forEachRemaining(entry -> appendAttributePair(values, entry.getKey(), entry.getValue()));
                JsonNode attributeValueRefs = sku.path("attributeValueRefs");
                if (attributeValueRefs.isArray())
                    attributeValueRefs.forEach(value -> appendAttributeObject(values, value));
                Collections.sort(values);
                fingerprints.add(skuCode + "->" + String.join(",", values));
            });
        }
        Collections.sort(fingerprints);
        return String.join(";", fingerprints);
    }

    private static void appendAttributePair(List<String> values, String attributeCode, JsonNode value) {
        if (value == null || value.isNull()) return;
        if (value.isArray()) {
            value.forEach(entry -> appendAttributePair(values, attributeCode, entry));
            return;
        }
        if (value.isObject()) {
            appendAttributeObject(values, value);
            return;
        }
        values.add(attributeCode + "=" + value.asText());
    }

    private static void appendAttributeObject(List<String> values, JsonNode value) {
        String attributeCode = firstText(value, "attributeCode", "dimensionCode", "attribute", "code");
        String valueCode = firstText(value, "valueCode", "attributeValueCode", "value");
        if (attributeCode != null && valueCode != null) values.add(attributeCode + "=" + valueCode);
    }

    private static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys)
            if (node.path(key).isValueNode() && !node.path(key).asText().isBlank())
                return node.path(key).asText();
        return null;
    }

    private JsonNode rewriteReferences(JsonNode node, Map<ReferenceKey, String> mapping) {
        return rewriteReferences(node, mapping, null);
    }

    private JsonNode rewriteReferences(JsonNode node, Map<ReferenceKey, String> mapping, String parentKey) {
        if (node == null || node.isNull()) return mapper.nullNode();
        if (node.isObject()) {
            ObjectNode copy = mapper.createObjectNode();
            node.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                String kind = referenceKindForDeclaredCopyPath(entry.getKey(), parentKey);
                if (kind != null) copy.set(entry.getKey(), rewriteReferenceValue(value, kind, mapping));
                else copy.set(entry.getKey(), rewriteReferences(value, mapping, entry.getKey()));
            });
            return copy;
        }
        if (node.isArray()) {
            ArrayNode copy = mapper.createArrayNode();
            node.forEach(value -> copy.add(rewriteReferences(value, mapping, parentKey)));
            return copy;
        }
        return node.deepCopy();
    }

    private JsonNode rewriteReferenceValue(JsonNode value, String kind, Map<ReferenceKey, String> mapping) {
        if (value == null || value.isNull()) return mapper.nullNode();
        ReferenceKey key = value.isTextual() ? new ReferenceKey(copyReferenceObjectType(kind), value.asText()) : null;
        if (key != null && mapping.containsKey(key))
            return mapper.getNodeFactory().textNode(mapping.get(key));
        if (value.isArray()) {
            ArrayNode copy = mapper.createArrayNode();
            value.forEach(entry -> copy.add(rewriteReferenceValue(entry, kind, mapping)));
            return copy;
        }
        if (value.isObject()) return value.deepCopy();
        return value.deepCopy();
    }
    /**
     * Copy rewriting shares only the persisted matrix paths; labels and arbitrary `code` fields never rewrite a
     * relation.
     */
    private String referenceKindForDeclaredCopyPath(String key, String parentKey) {
        return switch (key) {
            case "categoryRefs" -> "CATEGORY";
            case "tagRefs" -> "TAG";
            case "productionTagRefs" -> "PRODUCTION_TAG";
            case "attributeRef" -> "skuVariantDimensions".equals(parentKey) ? "SKU_ATTRIBUTE" : null;
            case "valueRef" -> "SKU_ATTRIBUTE_VALUE";
            case "attributeValueRef" -> "values".equals(parentKey) ? "ORDER_OPTION_VALUE" : "SKU_ATTRIBUTE_VALUE";
            case "optionValueRef" -> "ORDER_OPTION_VALUE";
            case "productSkuRef" -> "PRODUCT_SKU";
            case "itemRef" -> "CATALOG_ITEM";
            case "tagRef" -> "PRODUCTION_TAG";
            case "salesUnitRef",
                    "baseMeasureUnitRef",
                    "salesUnitOverrideRef",
                    "baseMeasureUnitOverrideRef",
                    "countingUnitRef" -> "CATALOG_UNIT";
            case "unitRef" -> Set.of(
                                    "salesUnitSnapshot",
                                    "baseMeasureUnitSnapshot",
                                    "consumptionUnitSnapshot",
                                    "countingUnitSnapshot")
                            .contains(parentKey)
                    ? "CATALOG_UNIT"
                    : null;
            default -> null;
        };
    }

    private void assertNoOwnerReferenceLeak(
            CatalogClosure graph, Map<ReferenceKey, String> mapping, String sourceScope) {
        for (ClosureEdge edge : graph.edges()) {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET").contains(edge.referenceKind())) continue;
            ReferenceKey key = new ReferenceKey(copyReferenceObjectType(edge.referenceKind()), edge.toRef());
            if (!mapping.containsKey(key)) {
                throw new CatalogOwnerApi.Problem(
                        ("OWNER_REFERENCE_LEAK"),
                        (422),
                        /* format-wrap */
                        ("复制引用未完成映射: " + edge.toRef()));
            }
        }
        for (ItemRow row : graph.items())
            if (containsForbiddenOwnerReference(json(row.sectionsJson()), sourceScope))
                throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "源 owner 引用不能进入目标图");
    }

    private void verifyTargetNoOwnerReferenceLeak(
            String targetScope, String brand, CatalogClosure graph, String sourceScope) {
        List<String> codes = graph.items().stream().map(ItemRow::code).toList();
        for (ItemRow row : loadItems(targetScope, brand, codes))
            if (containsForbiddenOwnerReference(json(row.sectionsJson()), sourceScope))
                throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "目标图仍含源 owner 引用");
    }

    private boolean containsForbiddenOwnerReference(JsonNode node, String sourceScope) {
        if (node == null || node.isNull()) return false;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                if (Set.of("headCompanyRef", "ownerRef", "dataNodeRef", "scopeRef", "originScopeRef")
                                .contains(key)
                        && value.isTextual()
                        && sourceScope.equals(value.asText())) return true;
                if (containsForbiddenOwnerReference(value, sourceScope)) return true;
            }
        } else if (node.isArray())
            for (JsonNode value : node) if (containsForbiddenOwnerReference(value, sourceScope)) return true;
        return false;
    }

    private record DerivedSkuFacts(
            int enabledCount,
            int nonArchivedCount,
            int totalCount,
            List<String> dimensions,
            String priceGranularity,
            int missingPriceCount,
            Long standardSalePriceMin,
            Long standardSalePriceMax) {}

    private record ItemRow(
            UUID ref,
            String code,
            String name,
            String shortName,
            String shapeKey,
            String status,
            String sectionsJson,
            long version,
            long updatedAt,
            String sourceScopeRef)
            implements CatalogObject {
        public String objectType() {
            return "CATALOG_ITEM";
        }
    }

    private record ItemUnitRefs(
            UUID salesUnitRef,
            InventoryOwnerApi.UnitSnapshot salesUnitSnapshot,
            UUID baseMeasureUnitRef,
            InventoryOwnerApi.UnitSnapshot baseMeasureUnitSnapshot) {}
    /** Immutable pre-write fact valid only between receipt recheck and this command's first mutation. */
    private record CatalogCoordinationSnapshot(ItemRow current) {}

    private record PageItemRow(ItemRow item, long total) {}

    private record CopyPageRow(ItemRow item, long total) {}

    private record CategoryRow(
            UUID ref,
            String code,
            String name,
            String parentCode,
            UUID parentCategoryRef,
            String status,
            long version,
            int displayOrder)
            implements CatalogObject {
        public String objectType() {
            return "CATALOG_CATEGORY";
        }
    }

    private record CopyCategory(
            UUID targetRef, String dataNodeRef, String brandRef, CategoryRow source, UUID targetParentRef) {}

    private String requiredMappedReference(Map<ReferenceKey, String> mapping, ReferenceKey key) {
        String target = mapping.get(key);
        if (target == null || target.isBlank()) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("复制引用未完成映射: " + key.ref()));
        }
        return target;
    }

    private record DictionaryRow(
            UUID ref,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            int displayOrder,
            long version)
            implements CatalogObject {
        public String objectType() {
            return dictionaryObjectType(dictionaryKind);
        }
    }

    private record UnitRow(
            UUID ref, String code, String name, String unitDimension, int precision, String status, long version)
            implements CatalogObject {
        public String objectType() {
            return "CATALOG_UNIT";
        }
    }

    private record CopyDictionary(
            UUID targetRef, String dataNodeRef, String brandRef, DictionaryRow source, UUID targetParentRef) {}

    private record UnitCopy(UUID targetRef, String dataNodeRef, String brandRef, UnitRow source) {}

    private record DictionaryEntryRow(
            UUID entryRef,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version,
            long updatedAt) {}

    private record DictionaryListingRow(
            UUID entryRef,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version,
            long updatedAt,
            long total,
            long generation) {}

    private record DictionaryListing(List<DictionaryEntryRow> entries, long generation, long total, String cursor) {
        List<UUID> entryRefs() {
            return entries.stream().map(DictionaryEntryRow::entryRef).toList();
        }
    }

    private record DictionaryReferenceSnapshot(Set<UUID> referencedEntryRefs) {
        boolean isReferenced(UUID entryRef) {
            return referencedEntryRefs.contains(entryRef);
        }
    }

    static String dictionaryObjectType(String dictionaryKind) {
        return switch (dictionaryKind) {
            case "TAG" -> "CATALOG_TAG";
            case "SKU_ATTRIBUTE" -> "SKU_ATTRIBUTE";
            case "SKU_ATTRIBUTE_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            case "ORDER_OPTION_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dictionaryKind is not supported");
        };
    }

    private record TypedReference(String referenceKind, String ref) {}

    private record InboundItemReference(UUID itemRef, String code) {}

    private record SkuTransitionRequest(UUID skuRef, String targetStatus, long expectedVersion) {}

    private record SkuInboundReference(UUID componentRef, UUID ownerItemRef, String ownerCode) {}

    private record ProductSkuRelation(UUID itemRef, UUID productSkuRef) {}

    private record ClosureEdge(String fromRef, String toRef, String referenceKind) {}

    private record ReferenceKey(String objectType, String ref) {}

    private record DictionaryKey(String kind, String code) {}

    private interface CatalogObject {
        String objectType();

        String code();

        String name();

        long version();
    }

    private record CatalogClosure(
            List<ItemRow> items,
            List<CategoryRow> categories,
            List<DictionaryRow> dictionaries,
            List<UnitRow> units,
            List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions,
            List<ClosureEdge> edges) {
        List<CatalogObject> objects() {
            List<CatalogObject> all = new ArrayList<>();
            all.addAll(items);
            all.addAll(categories);
            all.addAll(dictionaries);
            all.addAll(units);
            return all;
        }

        int size() {
            return objects().size() + orderOptionDefinitions.size();
        }
    }

    private record CatalogCopyPlan(
            List<String> selected, CatalogClosure graph, long sourceVersion, long targetVersion, String digest) {}

    private record PreparedCopyItem(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            String sourceScopeRef,
            ItemRow source,
            ObjectNode sections,
            ArrayNode skus,
            ArrayNode categoryRefs,
            ArrayNode compositeGroups,
            ArrayNode skuVariantDimensions,
            JsonNode images,
            CatalogItemReferenceFacts.CopyValues references) {}

    private record LocalCopyPlan(
            ItemRow source,
            ItemRow target,
            ArrayNode selectedSections,
            String digest,
            CompatibilityCheck compatibility,
            List<UnitRow> units) {}

    private record CopyCompatibility(Map<ReferenceKey, String> mapping) {}

    private record CompatibilityCheck(
            String result, String reason, String problemCode, String reasonCode, boolean blocking) {}

    private record Receipt(String operationId, String requestHash, JsonNode response) {}
}
