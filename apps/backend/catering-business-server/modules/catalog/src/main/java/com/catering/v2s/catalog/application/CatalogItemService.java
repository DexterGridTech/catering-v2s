package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.catalog.application.persistence.CatalogItemPersistence;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.CanonicalCursorIdentity;
import com.catering.v2s.platform.foundation.collection.CollectionRequestSupport;
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
import java.util.Locale;
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

/** Concrete Catalog item, SKU, reference, status, and temporary-promotion owner. */
@Service
public class CatalogItemService {
    private static final String TEMPORARY_PROMOTION_PROJECTION_FIELD = "_temporaryPromotionProjection";
    private static final String BATCH_STATUS_OPERATION_ID = "batchTransitionOperationsCatalogItemStatus";
    /** Must stay equal to CatalogItemPageQuery.pageSize.maximum and the batch request maxItems. */
    private static final int CATALOG_ITEM_BATCH_LIMIT = 100;
    /** A catalog tree is intentionally shallow so operators can scan and choose it as a hierarchy. */
    private static final int CATALOG_CATEGORY_MAX_DEPTH = 3;

    private static final String SALES_MENU_CANDIDATE_OPERATION = "getOperationsSalesMenuItemCandidates";
    private static final int SALES_MENU_CANDIDATE_PAGE_SIZE = 20;

    private static final String CATEGORY_MOVE_SELF_MESSAGE = "分类不能以自身作为父分类";
    private static final String CATEGORY_MOVE_CYCLE_MESSAGE = "分类不能移动到自身或下级分类下";
    private static final String CATEGORY_DEPTH_ERROR_CODE = "CATEGORY_DEPTH_EXCEEDED";
    private static final String CATEGORY_DEPTH_EXCEEDED_MESSAGE = "商品分类最多只能建立三级";
    private static final String CATEGORY_MOVE_BOUNDARY_MESSAGE = "分类已位于当前层级边界";
    private static final String CATEGORY_MOVE_ACTION_MESSAGE = "分类移动方式不支持";
    /**
     * Only these owner problems describe an individual item's authoritative business outcome. A RESULT_UNKNOWN (or any
     * other internal/unknown problem) must escape the item transaction and fail the request; it is not a legitimate
     * batch receipt row.
     */
    private static final Set<String> BATCH_ITEM_PROBLEM_CODES = Set.of(
            "DEPENDENT_FACTS_BLOCK_VOID",
            "NOT_FOUND",
            "REFERENCE_BLOCKS_VOID",
            "REFERENCE_MAPPING_UNRESOLVED",
            "SCOPE_FORBIDDEN",
            "VALIDATION_ERROR",
            "VERSION_CONFLICT",
            "VOIDED_RECORD_IMMUTABLE");

    private final JdbcTemplate jdbc;
    private final CatalogItemPersistence persistence;
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;
    private final CatalogAssetReferenceLock assetReferenceLocks;
    private final CatalogProductionTagOwnerApi productionTags;
    private final InventoryOwnerApi inventory;
    private final CatalogSkuFacts skuFacts;
    private final CatalogIdentifierFacts identifierFacts;
    private final CatalogPreparationFacts preparationFacts;
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

    @Autowired
    public CatalogItemService(
            CatalogItemPersistence persistence,
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.persistence = persistence;
        this.mapper = mapper;
        this.copyLimits = CopyLimitPolicy.load(mapper);
        this.time = time;
        this.assetReferenceLocks = assetReferenceLocks;
        this.productionTags = productionTags;
        this.inventory = inventory;
        this.transactions = transactions;
        this.skuFacts = new CatalogSkuFacts(jdbc, mapper, time);
        this.identifierFacts = new CatalogIdentifierFacts(jdbc, mapper);
        this.preparationFacts = new CatalogPreparationFacts(jdbc, mapper);
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

    public CatalogItemService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            CatalogProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions) {
        this(
                new CatalogItemPersistence(jdbc, mapper),
                jdbc,
                mapper,
                time,
                assetReferenceLocks,
                productionTags,
                inventory,
                transactions);
    }

    JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        String operationId = context.operationToken().operationId();
        CatalogAuthorizationScope scope = typedCommandScope(context, operationId);
        return executeWrite(
                context,
                operationId,
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
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
        CatalogCoordinationSnapshot coordinationSnapshot =
                recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);
        ObjectNode receiptRequest = receiptRequest(request, brandRef);
        if (!receiptKey.isEmpty()) {
            JsonNode replay = replay(dataNodeRef, receiptKey, operationId, receiptRequest);
            if (replay != null) return replay;
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result =
                    switch (operationId) {
                        case "createOperationsCatalogItem" -> createItem(dataNodeRef, brandRef, requestId, request);
                        case "saveOperationsCatalogItem" -> saveItem(
                                        commandContext, dataNodeRef, brandRef, requestId, request, coordinationSnapshot)
                                .response();
                        case "transitionOperationsCatalogItemStatus" -> transitionItem(
                                commandContext,
                                dataNodeRef,
                                brandRef,
                                requestId,
                                request,
                                coordinationSnapshot == null
                                        ? null
                                        : new TransitionItemPrecheck(coordinationSnapshot.current(), null),
                                receiptKey);
                        case "preflightOperationsTemporaryCatalogItemPromotion" -> promotionPreflight(
                                dataNodeRef, brandRef, requestId, request);
                        case "executeOperationsTemporaryCatalogItemPromotion" -> promotionExecute(
                                        dataNodeRef,
                                        brandRef,
                                        requestId,
                                        request,
                                        coordinationSnapshot == null ? null : coordinationSnapshot.current())
                                .response();
                        default -> throw new CatalogOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "catalog write operation is not registered");
                    };
            if (!receiptKey.isEmpty()) saveReceipt(dataNodeRef, receiptKey, operationId, receiptRequest, result);
            return result;
        }
    }

    static CatalogOwnerApi.CatalogItemBatchStatusTransitionResult batchItemFailureOrThrow(
            UUID itemRef, String itemCode, RuntimeException failure) {
        CatalogOwnerApi.Problem problem = findCatalogProblem(failure);
        if (problem == null
                || !BATCH_ITEM_PROBLEM_CODES.contains(problem.code())
                || problem.status() < 400
                || problem.status() >= 500) {
            throw failure;
        }
        String message = problem.getMessage();
        if (message == null || message.isBlank()) message = "批量状态项执行失败";
        return new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(
                itemRef,
                itemCode,
                CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.FAILED,
                problem.code(),
                message,
                null);
    }

    static void validateCatalogCode(String code) {
        CatalogOwnerValueSupport.validateCatalogCode(code);
    }

    static Set<String> catalogAssetRefs(JsonNode sections) {
        return CatalogOwnerValueSupport.catalogAssetRefs(sections);
    }

    static JsonNode externalIdentityFact(ObjectMapper mapper, JsonNode sections) {
        return CatalogOwnerValueSupport.externalIdentityFact(mapper, sections);
    }

    public JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return detail(dataNodeRef, brandRef, requestId, itemCode);
    }

    public JsonNode readItemSkus(
            String dataNodeRef, String brandRef, String itemCode, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return itemSkus(dataNodeRef, brandRef, itemCode, requestId, request);
    }

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

        generation(scope.dataNodeId().toString(), scope.brandRef());

        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "createOperationsCatalogItem",
                request);
        if (replay != null) return catalogItemCommandReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
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

        TransitionItemPrecheck prechecked = recheckTransitionItemReceipt(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                command.itemCode(),
                command.expectedVersion(),
                command.targetStatus());

        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "transitionOperationsCatalogItemStatus",
                request);
        if (replay != null) return catalogItemCommandReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            ObjectNode result = transitionItem(
                    context,
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    context.requestId(),
                    request,
                    prechecked,
                    idempotencyKey);
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
        ObjectNode scopedRequest = receiptRequest(canonicalRequest, brandRef);
        JsonNode replay = replay(dataNodeRef, receiptKey, BATCH_STATUS_OPERATION_ID, scopedRequest);
        if (replay != null) return batchStatusReadback(replay, command.items());

        BatchStatusPreloadedFacts preloaded =
                loadBatchStatusFacts(context, dataNodeRef, brandRef, command.targetStatus(), command.items());
        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionResult> results = command.items().stream()
                .map(item -> executeBatchStatusItem(
                        context, dataNodeRef, brandRef, command.targetStatus(), item, preloaded, receiptKey))
                .toList();
        ObjectNode response = batchStatusResponse(context.requestId(), results);
        saveReceipt(dataNodeRef, receiptKey, BATCH_STATUS_OPERATION_ID, scopedRequest, response);
        return batchStatusReadback(response, command.items());
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionResult executeBatchStatusItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item,
            BatchStatusPreloadedFacts preloaded,
            String receiptKey) {
        String itemCode = preloaded.itemCodes().get(item.itemRef());
        try {
            if (transactions == null) {
                return executeBatchStatusItemInTransaction(
                        context, dataNodeRef, brandRef, targetStatus, item, preloaded, itemCode, receiptKey);
            }
            TransactionTemplate itemTransaction = new TransactionTemplate(transactions);
            itemTransaction.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);
            return itemTransaction.execute(status -> executeBatchStatusItemInTransaction(
                    context, dataNodeRef, brandRef, targetStatus, item, preloaded, itemCode, receiptKey));
        } catch (RuntimeException failure) {
            return batchItemFailureOrThrow(item.itemRef(), itemCode, failure);
        }
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionResult executeBatchStatusItemInTransaction(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item,
            BatchStatusPreloadedFacts preloaded,
            String itemCode,
            String receiptKey) {
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            if ("VOIDED".equals(targetStatus) && preloaded.voidedFactsPreloaded()) {
                long nextVersion = transitionBatchVoidedItemState(
                        context, dataNodeRef, brandRef, item, preloaded, receiptKey + "|item|" + item.itemRef());
                return new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(
                        item.itemRef(),
                        itemCode,
                        CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.SUCCEEDED,
                        null,
                        null,
                        nextVersion);
            }
            ItemRow current = lockBatchStatusItem(dataNodeRef, brandRef, targetStatus, item.itemRef(), preloaded);
            long nextVersion = transitionItemState(
                    context,
                    dataNodeRef,
                    brandRef,
                    context.requestId(),
                    current,
                    item.expectedVersion(),
                    targetStatus,
                    true,
                    null,
                    preloaded,
                    receiptKey + "|item|" + item.itemRef());
            return new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(
                    item.itemRef(),
                    itemCode,
                    CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.SUCCEEDED,
                    null,
                    null,
                    nextVersion);
        }
    }

    private long transitionBatchVoidedItemState(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String dataNodeRef,
            String brandRef,
            CatalogOwnerApi.CatalogItemBatchStatusTransitionItem item,
            BatchStatusPreloadedFacts preloaded,
            String inventoryIdempotencyKey) {
        ItemRow current = preloaded.scopedItems().get(item.itemRef());
        if (current == null) {
            if (preloaded.itemCodes().containsKey(item.itemRef())) {
                throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "商品不属于当前数据范围");
            }
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        }
        if ("VOIDED".equals(current.status())) return current.version();
        if (item.expectedVersion() != current.version()) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        if (itemReferencedByOtherItems(dataNodeRef, brandRef, current, preloaded)) {
            String reason = "商品仍被其他商品引用，不能作废";
            throw new CatalogOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, reason);
        }
        if (hasItemDependencies(current, null, preloaded)) {
            String reason = "商品仍有依赖事实，不能作废";
            throw new CatalogOwnerApi.Problem("DEPENDENT_FACTS_BLOCK_VOID", 422, reason);
        }
        requireItemRetirementUnreferenced(context, current, preloaded, inventoryIdempotencyKey);
        lockCatalogAssetRefs(json(current.sectionsJson()));
        List<Long> versions = persistence.transitionBatchItem(
                "VOIDED", now(), current.ref(), dataNodeRef, brandRef, item.expectedVersion());
        if (versions.size() != 1) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        return versions.get(0);
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

    private BatchStatusPreloadedFacts loadBatchStatusFacts(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> items) {
        List<UUID> itemRefs = items.stream()
                .map(CatalogOwnerApi.CatalogItemBatchStatusTransitionItem::itemRef)
                .toList();
        List<BatchStatusCandidate> candidates = readBatchStatusCandidates(null, null, itemRefs, false);
        Map<UUID, BatchStatusCandidate> byRef = new LinkedHashMap<>();
        for (BatchStatusCandidate candidate : candidates)
            byRef.put(candidate.item().ref(), candidate);
        for (UUID itemRef : itemRefs) {
            if (!byRef.containsKey(itemRef)) {
                throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
            }
        }
        Map<UUID, String> itemCodes = new LinkedHashMap<>();
        Map<UUID, ItemRow> scopedRows = new LinkedHashMap<>();
        for (BatchStatusCandidate candidate : candidates) {
            itemCodes.put(candidate.item().ref(), candidate.item().code());
            if (dataNodeRef.equals(candidate.dataNodeRef()) && brandRef.equals(candidate.brandRef())) {
                scopedRows.put(candidate.item().ref(), candidate.item());
            }
        }

        boolean voidedFactsPreloaded = "VOIDED".equals(targetStatus) && inventory != null && !scopedRows.isEmpty();
        Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> inventoryDependencies = Map.of();
        Map<UUID, List<InboundItemReference>> inboundReferences = Map.of();
        Map<UUID, Boolean> identifierPresence = Map.of();
        if (voidedFactsPreloaded) {
            List<UUID> scopedRefs = new ArrayList<>(scopedRows.keySet());
            // The receipt transaction owns these locks while each item runs in REQUIRES_NEW transactions. This
            // protects the read -> judge -> write preparation facts without making the inner transactions wait on
            // locks already held by their suspended parent.
            lockCatalogItemRefs(scopedRefs);

            List<BatchStatusCandidate> lockedCandidates =
                    readBatchStatusCandidates(dataNodeRef, brandRef, scopedRefs, true);
            scopedRows.clear();
            for (BatchStatusCandidate candidate : lockedCandidates) {
                scopedRows.put(candidate.item().ref(), candidate.item());
                itemCodes.put(candidate.item().ref(), candidate.item().code());
            }
            scopedRefs = new ArrayList<>(scopedRows.keySet());
            if (!scopedRefs.isEmpty()) {
                inventoryDependencies = inventory
                        .catalogVoidDependenciesByRefs(
                                context, InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM, scopedRefs)
                        .stream()
                        .filter(java.util.Objects::nonNull)
                        .collect(java.util.stream.Collectors.toMap(
                                value -> value.subject().ref(),
                                value -> value,
                                (left, right) -> left,
                                LinkedHashMap::new));
                inboundReferences = inboundItemReferencesByRefs(dataNodeRef, brandRef, scopedRefs);
                identifierPresence = itemIdentifierPresenceByRefs(scopedRefs);
            }
        }
        return new BatchStatusPreloadedFacts(
                Map.copyOf(scopedRows),
                Map.copyOf(itemCodes),
                Map.copyOf(inventoryDependencies),
                Map.copyOf(inboundReferences),
                Map.copyOf(identifierPresence),
                voidedFactsPreloaded);
    }

    private List<BatchStatusCandidate> readBatchStatusCandidates(
            String dataNodeRef, String brandRef, List<UUID> itemRefs, boolean scopedOnly) {
        return persistence.readBatchStatusCandidates(dataNodeRef, brandRef, itemRefs, scopedOnly).stream()
                .map(row -> new BatchStatusCandidate(itemRow(row.item()), row.dataNodeRef(), row.brandRef()))
                .toList();
    }

    private ItemRow lockBatchStatusItem(
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            UUID itemRef,
            BatchStatusPreloadedFacts preloaded) {
        List<ItemRow> rows;
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.CAS)) {
            rows = persistence.lockBatchStatusItem(itemRef, dataNodeRef, brandRef).stream()
                    .map(CatalogItemService::itemRow)
                    .toList();
        }
        if (rows.isEmpty()) {
            if (preloaded.itemCodes().containsKey(itemRef)) {
                throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "商品不属于当前数据范围");
            }
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        }
        ItemRow locked = rows.get(0);
        ItemRow preloadedRow = preloaded.scopedItems().get(itemRef);
        if (preloadedRow == null) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "商品不属于当前数据范围");
        }
        if (!targetStatus.equals(locked.status()) && locked.version() != preloadedRow.version()) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        if (targetStatus.equals(locked.status())) return locked;
        return locked;
    }

    private ObjectNode batchStatusRequest(CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetStatus", command.targetStatus());
        ArrayNode items = request.putArray("items");
        command.items().forEach(item -> items.addObject()
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
                    .put("itemCode", result.itemCode())
                    .put("outcome", result.outcome().name());
            if (result.problemCode() == null) item.putNull("problemCode");
            else item.put("problemCode", result.problemCode());
            if (result.reason() == null) item.putNull("reason");
            else item.put("reason", result.reason());
            if (result.version() == null) item.putNull("version");
            else item.put("version", result.version());
        });
        return response;
    }

    private CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback batchStatusReadback(
            JsonNode response, List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> expectedItems) {
        if (response == null
                || !response.isObject()
                || !response.has("revision")
                || !response.has("requestId")
                || !response.has("results")
                || !response.path("revision").isTextual()
                || response.path("revision").asText().isBlank()
                || !response.path("requestId").isTextual()
                || response.path("requestId").asText().isBlank()
                || !response.path("results").isArray()
                || response.path("results").size() != expectedItems.size()) {
            throw invalidBatchStatusReadback();
        }
        Set<String> rootFields = Set.of("revision", "requestId", "results");
        response.fieldNames().forEachRemaining(field -> {
            if (!rootFields.contains(field)) throw invalidBatchStatusReadback();
        });
        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionResult> results = new ArrayList<>();
        Set<UUID> seen = new LinkedHashSet<>();
        Set<String> itemFields = Set.of("itemRef", "itemCode", "outcome", "problemCode", "reason", "version");
        for (int index = 0; index < response.path("results").size(); index++) {
            JsonNode item = response.path("results").get(index);
            if (item == null || !item.isObject()) throw invalidBatchStatusReadback();
            item.fieldNames().forEachRemaining(field -> {
                if (!itemFields.contains(field)) throw invalidBatchStatusReadback();
            });
            for (String field : itemFields) {
                if (!item.has(field)) throw invalidBatchStatusReadback();
            }
            UUID itemRef;
            try {
                if (!item.path("itemRef").isTextual()
                        || item.path("itemRef").asText().isBlank()) {
                    throw new IllegalArgumentException("itemRef");
                }
                itemRef = UUID.fromString(item.path("itemRef").asText());
            } catch (IllegalArgumentException invalid) {
                throw invalidBatchStatusReadback(invalid);
            }
            if (!seen.add(itemRef) || !expectedItems.get(index).itemRef().equals(itemRef)) {
                throw invalidBatchStatusReadback();
            }
            if (!item.path("itemCode").isTextual()
                    || item.path("itemCode").asText().isBlank()) {
                throw invalidBatchStatusReadback();
            }
            String outcome =
                    item.path("outcome").isTextual() ? item.path("outcome").asText() : "";
            CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome parsedOutcome;
            try {
                parsedOutcome = CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.valueOf(outcome);
            } catch (IllegalArgumentException invalid) {
                throw invalidBatchStatusReadback(invalid);
            }
            String problemCode = item.path("problemCode").isNull()
                    ? null
                    : item.path("problemCode").isTextual()
                                    && !item.path("problemCode").asText().isBlank()
                            ? item.path("problemCode").asText()
                            : invalidBatchStatusReadbackValue();
            String reason = item.path("reason").isNull()
                    ? null
                    : item.path("reason").isTextual()
                                    && !item.path("reason").asText().isBlank()
                            ? item.path("reason").asText()
                            : invalidBatchStatusReadbackValue();
            Long version = item.path("version").isNull()
                    ? null
                    : item.path("version").isIntegralNumber()
                                    && item.path("version").asLong() > 0
                            ? item.path("version").asLong()
                            : invalidBatchStatusReadbackValue();
            if (parsedOutcome == CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.SUCCEEDED
                    && (problemCode != null || reason != null || version == null)) {
                throw invalidBatchStatusReadback();
            }
            if (parsedOutcome == CatalogOwnerApi.CatalogItemBatchStatusTransitionOutcome.FAILED
                    && (problemCode == null || reason == null || version != null)) {
                throw invalidBatchStatusReadback();
            }
            results.add(new CatalogOwnerApi.CatalogItemBatchStatusTransitionResult(
                    itemRef, item.path("itemCode").asText(), parsedOutcome, problemCode, reason, version));
        }
        return new CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback(
                response.path("revision").asText(), response.path("requestId").asText(), List.copyOf(results));
    }

    private CatalogOwnerApi.Problem invalidBatchStatusReadback() {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "批量状态回执结构无效");
    }

    private CatalogOwnerApi.Problem invalidBatchStatusReadback(Throwable cause) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "批量状态回执结构无效", cause);
    }

    private <T> T invalidBatchStatusReadbackValue() {
        throw invalidBatchStatusReadback();
    }

    private static CatalogOwnerApi.Problem findCatalogProblem(Throwable failure) {
        Throwable cursor = failure;
        while (cursor != null) {
            if (cursor instanceof CatalogOwnerApi.Problem problem) return problem;
            cursor = cursor.getCause();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public UUID resolveCatalogItemRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemCode) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogItemStatus");
        return requireItem(scope.dataNodeId().toString(), scope.brandRef(), itemCode)
                .ref();
    }

    @Transactional(readOnly = true)
    public boolean catalogItemReferencedByOtherItems(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID itemRef) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogItemStatus");
        if (itemRef == null)
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef is required");
        return itemReferencedByOtherItems(scope.dataNodeId().toString(), scope.brandRef(), itemRef);
    }

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
        SaveItemResult result = executeSaveWrite(
                context, scope.dataNodeId().toString(), scope.brandRef(), request, context.requestId(), idempotencyKey);
        return new CatalogOwnerApi.CatalogItemSaveReadback(canonicalJson(result.response()), result.projection());
    }

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

        recheckTypedItemReceipt(scope.dataNodeId().toString(), scope.brandRef(), command.itemCode(), null, null);

        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "preflightOperationsTemporaryCatalogItemPromotion",
                request);
        if (replay != null) return temporaryPromotionPreflightReadback(replay);
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
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

    @Transactional
    public CatalogOwnerApi.CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionExecuteCommand command,
            String idempotencyKey) {
        return executeTemporaryCatalogItemPromotionWithProjection(context, command, idempotencyKey)
                .readback();
    }

    @Transactional
    public CatalogTemporaryPromotionExecution executeTemporaryCatalogItemPromotionWithProjection(
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

        ItemRow current = recheckTypedItemReceipt(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                command.itemCode(),
                command.expectedVersion(),
                null,
                true);

        JsonNode replay = replayTyped(
                scope.dataNodeId().toString(),
                scope.brandRef(),
                idempotencyKey,
                "executeOperationsTemporaryCatalogItemPromotion",
                request);
        if (replay != null) return temporaryPromotionExecutionFromReceipt(replay);
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 422, "已作废商品不可修改");
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            PromotionExecution execution = promotionExecute(
                    scope.dataNodeId().toString(), scope.brandRef(), context.requestId(), request, current);
            saveTypedReceipt(
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    idempotencyKey,
                    "executeOperationsTemporaryCatalogItemPromotion",
                    request,
                    temporaryPromotionReceipt(execution.response(), execution.projection()));
            return new CatalogTemporaryPromotionExecution(
                    catalogItemCommandReadback(execution.response()), execution.projection());
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

    private ItemRow recheckTypedItemReceipt(
            String scope, String brand, String itemCode, Long expectedVersion, String targetStatus) {
        return recheckTypedItemReceipt(scope, brand, itemCode, expectedVersion, targetStatus, false);
    }

    private ItemRow recheckTypedItemReceipt(
            String scope,
            String brand,
            String itemCode,
            Long expectedVersion,
            String targetStatus,
            boolean allowVoidedReplay) {
        ItemRow current = requireItemIdentity(scope, brand, itemCode);
        if (expectedVersion != null
                && current.version() != expectedVersion
                && current.version() != expectedVersion + 1L) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        if ("VOIDED".equals(current.status()) && !"VOIDED".equals(targetStatus) && !allowVoidedReplay) {
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 422, "已作废商品不可修改");
        }
        return current;
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

    private ObjectNode temporaryPromotionReceipt(ObjectNode response, CatalogTemporaryPromotionProjection projection) {
        ObjectNode stored = response.deepCopy();
        ObjectNode marker = stored.putObject(TEMPORARY_PROMOTION_PROJECTION_FIELD)
                .put("sourceItemRef", projection.sourceItemRef().toString())
                .put("sourceMeasureMode", projection.sourceMeasureMode())
                .put("targetItemRef", projection.targetItemRef().toString())
                .put("targetItemCode", projection.targetItemCode());
        if (projection.targetBaseMeasureUnit() == null) marker.putNull("targetBaseMeasureUnit");
        else marker.set("targetBaseMeasureUnit", mapper.valueToTree(projection.targetBaseMeasureUnit()));
        ArrayNode skus = marker.putArray("targetSkus");
        projection.targetSkus().entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    CatalogTemporaryPromotionSkuFact fact = entry.getValue();
                    ObjectNode sku = skus.addObject().put("skuCode", entry.getKey());
                    sku.put("productSkuRef", fact.productSkuRef().toString());
                    if (fact.baseMeasureUnit() == null) sku.putNull("baseMeasureUnit");
                    else sku.set("baseMeasureUnit", mapper.valueToTree(fact.baseMeasureUnit()));
                });
        ArrayNode optionValueRefs = marker.putArray("optionValueRefs");
        projection.optionValueRefs().forEach(ref -> optionValueRefs.add(ref.toString()));
        return stored;
    }

    private CatalogTemporaryPromotionExecution temporaryPromotionExecutionFromReceipt(JsonNode response) {
        return new CatalogTemporaryPromotionExecution(
                catalogItemCommandReadback(response), temporaryPromotionProjectionFromReceipt(response));
    }

    private CatalogTemporaryPromotionProjection temporaryPromotionProjectionFromReceipt(JsonNode response) {
        JsonNode marker = response.get(TEMPORARY_PROMOTION_PROJECTION_FIELD);
        if (marker == null || !marker.isObject())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "临时转正回执缺少事实投影");
        UUID sourceItemRef = requiredTemporaryPromotionReceiptUuid(marker, "sourceItemRef");
        String sourceMeasureMode = requiredTemporaryPromotionReceiptText(marker, "sourceMeasureMode");
        UUID targetItemRef = requiredTemporaryPromotionReceiptUuid(marker, "targetItemRef");
        String targetItemCode = requiredTemporaryPromotionReceiptText(marker, "targetItemCode");
        InventoryOwnerApi.UnitSnapshot targetBaseMeasureUnit =
                temporaryPromotionUnitSnapshot(marker.get("targetBaseMeasureUnit"), "targetBaseMeasureUnit");
        JsonNode skuNodes = marker.get("targetSkus");
        if (skuNodes == null || !skuNodes.isArray())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "临时转正回执缺少 SKU 事实投影");
        Map<String, CatalogTemporaryPromotionSkuFact> targetSkus = new LinkedHashMap<>();
        for (JsonNode skuNode : skuNodes) {
            String skuCode = requiredTemporaryPromotionReceiptText(skuNode, "skuCode");
            if (targetSkus.containsKey(skuCode))
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "临时转正回执包含重复 SKU 事实");
            targetSkus.put(
                    skuCode,
                    new CatalogTemporaryPromotionSkuFact(
                            requiredTemporaryPromotionReceiptUuid(skuNode, "productSkuRef"),
                            temporaryPromotionUnitSnapshot(
                                    skuNode.get("baseMeasureUnit"), "targetSkus[].baseMeasureUnit")));
        }
        // spotless:off
        JsonNode optionNodes = marker.get("optionValueRefs");
        if (optionNodes == null || !optionNodes.isArray())
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "临时转正回执缺少点单选项事实投影");
        LinkedHashSet<UUID> optionValueRefs = new LinkedHashSet<>();
        for (JsonNode optionNode : optionNodes) {
            if (optionNode == null || !optionNode.isTextual() || optionNode.asText().isBlank())
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN", 500, "临时转正回执包含无效点单选项事实");
            try {
                optionValueRefs.add(UUID.fromString(optionNode.asText()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN", 500, "临时转正回执包含无效点单选项事实", failure);
            }
        }
        return new CatalogTemporaryPromotionProjection(
                sourceItemRef,
                sourceMeasureMode,
                targetItemRef,
                targetItemCode,
                targetBaseMeasureUnit,
                targetSkus,
                List.copyOf(optionValueRefs));
    }

private UUID requiredTemporaryPromotionReceiptUuid(JsonNode node, String field) {
        String value = requiredTemporaryPromotionReceiptText(node, field);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "临时转正回执包含无效事实引用：" + field, failure);
        }
        // spotless:on
    }

    private String requiredTemporaryPromotionReceiptText(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "临时转正回执缺少事实：" + field);
        return value.asText();
    }

    private InventoryOwnerApi.UnitSnapshot temporaryPromotionUnitSnapshot(JsonNode node, String field) {
        if (node == null || node.isNull()) return null;
        if (!node.isObject()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "临时转正回执单位事实无效：" + field);
        }
        UUID ref = requiredTemporaryPromotionReceiptUuid(node, "unitRef");
        String code = requiredTemporaryPromotionReceiptText(node, "code");
        String name = requiredTemporaryPromotionReceiptText(node, "name");
        String dimension = requiredTemporaryPromotionReceiptText(node, "unitDimension");
        JsonNode precision = node.get("precision");
        if (precision == null || !precision.canConvertToInt() || precision.asInt() < 0)
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "临时转正回执单位精度无效：" + field);
        return new InventoryOwnerApi.UnitSnapshot(ref, code, name, dimension, precision.asInt());
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
                temporaryPromotionBlockingReasonCodes(data.path("blockedReasons")),
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

    private static List<String> textValues(JsonNode values) {
        List<String> result = new ArrayList<>();
        if (values.isArray()) values.forEach(value -> result.add(value.asText()));
        return List.copyOf(result);
    }

    private static List<CatalogOwnerApi.TemporaryPromotionBlockingReasonCode> temporaryPromotionBlockingReasonCodes(
            JsonNode values) {
        List<CatalogOwnerApi.TemporaryPromotionBlockingReasonCode> result = new ArrayList<>();
        if (!values.isArray()) return List.of();
        for (JsonNode value : values) {

            try {
                result.add(CatalogOwnerApi.TemporaryPromotionBlockingReasonCode.valueOf(value.asText()));
            } catch (IllegalArgumentException failure) {

                String message = "临时转正阻断原因代码无效";
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, message, failure);
            }
        }
        return List.copyOf(result);
    }

    private SaveItemResult executeSaveWrite(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        requireScope(dataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        CatalogCoordinationSnapshot coordinationSnapshot =
                recheckWriteFactsBeforeReceipt("saveOperationsCatalogItem", dataNodeRef, brandRef, request);
        ObjectNode receiptRequest = receiptRequest(request, brandRef);
        if (!receiptKey.isEmpty()) {
            JsonNode replay = replay(dataNodeRef, receiptKey, "saveOperationsCatalogItem", receiptRequest);
            if (replay != null) return new SaveItemResult(replay, null);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            SaveItemResult result =
                    saveItem(commandContext, dataNodeRef, brandRef, requestId, request, coordinationSnapshot);
            if (!receiptKey.isEmpty())
                saveReceipt(dataNodeRef, receiptKey, "saveOperationsCatalogItem", receiptRequest, result.response());
            return result;
        }
    }

    private CatalogCoordinationSnapshot recheckWriteFactsBeforeReceipt(
            String operationId, String scope, String brand, ObjectNode request) {
        if (Set.of(
                        "saveOperationsCatalogItem",
                        "transitionOperationsCatalogItemStatus",
                        "preflightOperationsTemporaryCatalogItemPromotion",
                        "executeOperationsTemporaryCatalogItemPromotion")
                .contains(operationId)) {
            ItemRow current = "saveOperationsCatalogItem".equals(operationId)
                    ? requireSaveCurrent(scope, brand, request)
                    : requireItemIdentity(scope, brand, required(request, "itemCode"));
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
            return new CatalogCoordinationSnapshot(current, null);
        }
        switch (operationId) {
            case "createOperationsCatalogItem" -> generation(scope, brand);
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "catalog write operation is not registered");
        }
        return null;
    }

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

    @Transactional(readOnly = true)
    public boolean itemExists(String dataNodeRef, String brandRef, String itemCode) {
        if (dataNodeRef == null || brandRef == null || itemCode == null) return false;
        return persistence.itemExists(dataNodeRef, brandRef, itemCode);
    }

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

    @Transactional(readOnly = true)
    public boolean assetReferencedAnywhere(String assetRef) {
        return assetRefsStillReferenced(java.util.Set.of(assetRef)).contains(assetRef);
    }

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
        if (refs.isEmpty()) return Set.of();
        // Asset references are intentionally shared across catalog scopes.  Keep
        // that global lifecycle judgment, but evaluate the whole candidate set
        // across catalog media and published sales-menu snapshot references in
        // one set query.  The previous two-table implementation had already
        // removed the 2N EXISTS pattern; these owner unions preserve the
        // candidate-set semantics while protecting immutable published images.
        java.util.Set<UUID> referencedRefs = persistence.referencedAssetRefs(refs);
        java.util.Set<String> referenced = new java.util.LinkedHashSet<>();
        for (String candidate : candidates)
            try {
                if (referencedRefs.contains(UUID.fromString(candidate))) referenced.add(candidate);
            } catch (IllegalArgumentException ignored) {
            }
        return java.util.Set.copyOf(referenced);
    }

    @Transactional(readOnly = true)
    public CatalogOwnerApi.CatalogAssetReferenceReadback readAssetReferences(
            String dataNodeRef, String brandRef, String itemCode) {
        requireScope(dataNodeRef, brandRef);
        if (itemCode == null || itemCode.isBlank()) return new CatalogOwnerApi.CatalogAssetReferenceReadback(List.of());
        List<UUID> refs = persistence.readAssetReferences(dataNodeRef, brandRef, itemCode);
        return new CatalogOwnerApi.CatalogAssetReferenceReadback(List.copyOf(refs));
    }

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

    @Transactional(readOnly = true)
    public JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef) {
        requireScope(dataNodeRef, brandRef);
        if (targetRef == null || targetRef.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "targetRef is required");
        // Inventory owns BOM rows and their consumption references. Catalog has no persisted BOM payload to scan;
        // the catalog/inventory coordinator exposes the task read from the inventory owner instead.
        return mapper.createArrayNode();
    }

    public JsonNode skuNamesByItemCodes(String dataNodeRef, String brandRef, JsonNode itemCodes) {
        requireScope(dataNodeRef, brandRef);
        if (itemCodes == null || !itemCodes.isArray() || itemCodes.isEmpty()) return mapper.createObjectNode();
        List<String> codes = stringValues(itemCodes);
        if (codes.isEmpty()) return mapper.createObjectNode();
        ObjectNode result = mapper.createObjectNode();
        persistence
                .readSkuNamesByItemCodes(dataNodeRef, brandRef, codes)
                .forEach((itemCode, names) -> result.set(itemCode, mapper.valueToTree(names)));
        return result;
    }

    private ObjectNode itemSkus(
            String dataNodeRef, String brandRef, String itemCode, String requestId, ObjectNode request) {
        if (itemCode == null || itemCode.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCode不能为空");
        String candidateUsage = optional(request, "candidateUsage");
        if (candidateUsage != null && !"COMPOSITE_COMPONENT".equals(candidateUsage))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "candidateUsage is not supported");
        int pageSize = parsePageSize(request, "pageSize", 20);

        String identity = cursorIdentity(
                "item-skus", dataNodeRef, brandRef, itemCode, candidateUsage, Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, identity);
        int cursorDisplayOrder = -1;

        String cursorCode = null;
        UUID cursorRef = null;
        if (cursor != null) {
            String[] parts = cursor.sortKey().split("\\|", 2);
            try {
                if (parts.length != 2) throw new IllegalArgumentException();
                cursorDisplayOrder = Integer.parseInt(parts[0]);
                cursorCode = parts[1];
                cursorRef = cursor.tieBreaker();
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
            }
        }
        List<SkuCandidateRow> rows = persistence
                .readSkuCandidates(
                        dataNodeRef,
                        brandRef,
                        itemCode,
                        candidateUsage,
                        pageSize,
                        cursor == null ? null : cursorDisplayOrder,
                        cursorCode,
                        cursorRef)
                .stream()
                .map(row -> new SkuCandidateRow(
                        row.value(),
                        row.displayOrder(),
                        row.skuCode(),
                        row.productSkuRef(),
                        row.total(),
                        row.itemPreparationProfile(),
                        row.skuPreparationOverride(),
                        row.productionTagRef(),
                        row.itemExists()))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if (!rows.isEmpty() && !rows.getFirst().itemExists())
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        rows.removeIf(row -> row.productSkuRef() == null);
        boolean hasNext = rows.size() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        decorateSkuListFacts(dataNodeRef, brandRef, requestId, rows);
        ObjectNode data = mapper.createObjectNode();
        ArrayNode items = data.putArray("items");
        rows.forEach(row -> items.add(row.value()));
        data.put("total", total);
        String echoed = optional(request, "cursor");
        if (echoed == null) data.putNull("cursor");
        else data.put("cursor", echoed);
        if (hasNext) {
            SkuCandidateRow last = rows.getLast();
            data.put(
                    "nextCursor",
                    OpaqueCollectionCursor.encode(
                            identity,
                            String.format(Locale.ROOT, "%010d|%s", last.displayOrder(), last.skuCode()),
                            last.productSkuRef()));
        } else data.putNull("nextCursor");
        return envelope(requestId, data);
    }

    private SkuCandidateRow skuCandidateRow(java.sql.ResultSet result) throws java.sql.SQLException {
        UUID productSkuRef = result.getObject(1, UUID.class);
        if (productSkuRef == null) {
            return new SkuCandidateRow(
                    null, 0, null, null, result.getLong(28), null, null, null, result.getBoolean(29));
        }
        String skuCode = result.getString(2);
        ObjectNode value = mapper.createObjectNode()
                .put("productSkuRef", productSkuRef.toString())
                .put("skuCode", skuCode)
                .put("skuName", result.getString(3));
        putNullableLong(value, "standardSalePrice", result.getObject(4, Long.class));
        putSkuUnit(
                value,
                "salesUnit",
                result,
                6,
                result.getObject(5, UUID.class) == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE");
        putSkuUnit(
                value,
                "baseMeasureUnit",
                result,
                13,
                result.getObject(12, UUID.class) == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE");
        value.put("isDefault", result.getBoolean(19)).put("status", result.getString(20));
        putNullableUuid(value, "primaryImageAssetRef", result.getObject(22, UUID.class));
        try {
            JsonNode attributes = mapper.readTree(result.getString(23));
            value.set("attributeValueRefs", attributes.isArray() ? attributes : mapper.createArrayNode());
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "规格摘要读取失败", failure);
        }
        value.putObject("inventoryDeductionSummary")
                .put("grain", "SKU")
                .putNull("mode")
                .putNull("consumptionUnitSnapshot")
                .putNull("bomLineCount");
        value.put("updatedAt", result.getLong(21));
        return new SkuCandidateRow(
                value,
                result.getInt(24),
                skuCode,
                productSkuRef,
                result.getLong(28),
                nullableJson(result.getString(25), "商品制作信息摘要读取失败"),
                nullableJson(result.getString(26), "规格制作信息摘要读取失败"),
                result.getObject(27, UUID.class),
                result.getBoolean(29));
    }

    private void decorateSkuListFacts(
            String dataNodeRef, String brandRef, String requestId, List<SkuCandidateRow> rows) {
        if (rows.isEmpty()) return;
        JsonNode itemProfile = rows.getFirst().itemPreparationProfile();
        JsonNode productionTagRef = rows.getFirst().productionTagRef() == null
                ? mapper.nullNode()
                : mapper.getNodeFactory()
                        .textNode(rows.getFirst().productionTagRef().toString());
        ArrayNode productionTagFacts = productionTagDetails(dataNodeRef, brandRef, productionTagRef, requestId);
        CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback = null;
        if (!productionTagFacts.isEmpty()) {
            JsonNode tag = productionTagFacts.get(0);
            UUID tagRef = nullableUuid(tag, "tagRef");
            if (tagRef != null)
                productionTagReadback = new CatalogProductionTagOwnerApi.ProductionTagReferenceReadback(
                        tagRef,
                        tag.path("code").asText(""),
                        tag.path("name").asText(""),
                        tag.path("status").asText(""),
                        tag.path("version").asLong(0));
        }
        for (SkuCandidateRow row : rows) {
            JsonNode storedOverride = row.skuPreparationOverride();
            String mode = storedOverride != null && storedOverride.isObject()
                    ? storedOverride.path("mode").asText("INHERIT_ITEM")
                    : "INHERIT_ITEM";
            JsonNode effective = "OVERRIDE".equals(mode)
                            && storedOverride != null
                            && storedOverride.path("profile").isObject()
                    ? storedOverride.path("profile")
                    : itemProfile;
            row.value().set("attributeFacts", arrayCopy(row.value().path("attributeValueRefs")));
            row.value().set("preparationFacts", skuPreparationFacts(productionTagReadback, itemProfile, effective));
        }
    }

    private JsonNode nullableJson(String raw, String failureMessage) {
        if (raw == null) return mapper.nullNode();
        try {
            return mapper.readTree(raw);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, failureMessage, failure);
        }
    }

    private void putSkuUnit(
            ObjectNode target, String field, java.sql.ResultSet result, int refColumn, String inheritanceSource)
            throws java.sql.SQLException {
        UUID ref = result.getObject(refColumn, UUID.class);
        if (ref == null) {
            target.putNull(field);
            return;
        }
        ObjectNode unit = target.putObject(field)
                .put("unitRef", ref.toString())
                .put("code", result.getString(refColumn + 1))
                .put("name", result.getString(refColumn + 2))
                .put("unitDimension", result.getString(refColumn + 3))
                .put("precision", result.getInt(refColumn + 4))
                .put("inheritanceSource", inheritanceSource);
        String status = result.getString(refColumn + 5);
        if (status == null) unit.put("status", "ENABLED");
        else unit.put("status", status);
    }

    private ObjectNode detail(String dataNodeRef, String brandRef, String requestId, String code) {
        ItemRow row = requireDetailItem(dataNodeRef, brandRef, code);
        // Category membership is an owner fact, not a stale copy carried by sections_json.
        // requireDetailItem already hydrates the canonical category projection; reuse that
        // invocation-local snapshot instead of issuing a second owner read merely to rebuild
        // categoryRef/categoryPath for the response.
        ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
        ArrayNode detailProductionTags =
                productionTagDetails(dataNodeRef, brandRef, sections.path("productionTagRef"), requestId);
        if (detailProductionTags.isEmpty()) sections.putNull("productionTagFact");
        else sections.set("productionTagFact", detailProductionTags.get(0).deepCopy());
        List<UUID> skuRefs = new ArrayList<>();
        if (sections.path("skus").isArray())
            for (JsonNode sku : sections.path("skus")) {
                UUID skuRef = nullableUuid(sku, "productSkuRef");
                if (skuRef != null) skuRefs.add(skuRef);
            }
        DetailInboundFacts inboundFacts = detailInboundFacts(dataNodeRef, brandRef, row.ref(), skuRefs);
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions =
                unitDefinitionsForDetail(dataNodeRef, brandRef, sections);
        // Composite groups are a relational fact. hydrateDetailItemFacts already loaded the
        // shape-appropriate projection into this invocation-local snapshot; do not re-read the
        // same relation solely because the root response exposes it in two locations.
        ArrayNode resolvedCompositeGroups = arrayCopy(sections.path("compositeGroups"));
        ObjectNode item = itemDetail(
                row, sections, dataNodeRef, brandRef, unitDefinitions, inboundFacts.bySku(), resolvedCompositeGroups);
        ObjectNode data = mapper.createObjectNode().set("item", item);
        ArrayNode tabs = data.putArray("tabs");
        detailTabs(row.shapeKey()).forEach(tab -> tabs.addObject()
                .put("tabKey", tab.asText())
                .put("visible", true)
                .put("disabled", false)
                .putNull("reason"));
        ArrayNode references = data.putArray("references");
        appendOutboundCompositeReferences(references, resolvedCompositeGroups);
        List<InboundItemReference> inboundReferences = inboundFacts.byItem();
        inboundReferences.forEach(reference -> {
            if (reference.name() == null
                    || reference.name().isBlank()
                    || reference.name().trim().equals(reference.code().trim()))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN", 503, "商品关联信息暂时无法确认，请稍后重试");
                // spotless:on
            references
                    .addObject()
                    .put("referenceKind", "COMPOSITE_COMPONENT")
                    .put("referenceRef", reference.itemRef().toString())
                    .put("code", reference.code())
                    .put("name", reference.name())
                    .put("direction", "INBOUND");
        });
        data.putObject("inventoryRules").putArray("nodes");
        ArrayNode productionTags = data.putArray("productionTags");
        productionTags.addAll(detailProductionTags);
        data.set("compositeGroups", resolvedCompositeGroups.deepCopy());
        List<String> deniedFields = sourceDeniedFields(row, sections);
        ObjectNode governance = data.putObject("governance");
        ArrayNode governanceDenied = governance.putArray("deniedFields");
        deniedFields.forEach(governanceDenied::add);
        JsonNode externalIdentity = externalIdentityFact(mapper, sections);
        if (externalIdentity == null) governance.putNull("externalIdentity");
        else governance.set("externalIdentity", externalIdentity.deepCopy());
        ObjectNode action = data.putObject("actionAvailability")
                .put("canEdit", !"VOIDED".equals(row.status()))
                .put("canEnable", "DISABLED".equals(row.status()))
                .put("canDisable", "ENABLED".equals(row.status()));
        JsonNode inventoryVoidDependencies =
                requireInventoryVoidDependencies(dataNodeRef, brandRef, row.ref(), requestId);
        List<InventoryInboundVoidReference> inventoryInboundReferences =
                inventoryInboundVoidReferences(inventoryVoidDependencies);
        ItemVoidCatalogFacts catalogFacts = itemVoidCatalogFacts(sections);
        ObjectNode voidAvailability = action.putObject("voidAvailability");
        ArrayNode blockingReferences = voidAvailability.putArray("blockingReferences");
        inboundReferences.forEach(reference -> blockingReferences
                .addObject()
                .put("referenceKind", "ITEM")
                .put("referenceRef", reference.itemRef().toString()));
        ArrayNode dependentFacts = voidAvailability.putArray("dependentFacts");

        if (catalogFacts.hasDependentFacts())
            dependentFacts
                    .addObject()
                    .put("factKind", "CATALOG_ITEM_DEPENDENCY")
                    .put("factRef", row.ref().toString());

        inboundReferences.forEach(reference -> dependentFacts
                .addObject()
                .put("factKind", "CATALOG_ITEM_INBOUND_REFERENCE")
                .put("factRef", reference.itemRef().toString()));
        inventoryInboundReferences.forEach(reference -> {
            blockingReferences
                    .addObject()
                    .put("referenceKind", "INVENTORY_BOM")
                    .put("referenceRef", reference.sourceRef().toString());
            dependentFacts
                    .addObject()
                    .put("factKind", "INVENTORY_BOM_INBOUND_REFERENCE")
                    .put("factRef", reference.sourceRef().toString());
        });
        ArrayNode blockingReasons = appendItemVoidBlockingReasons(
                voidAvailability, row, catalogFacts, inboundReferences, inventoryInboundReferences);
        // The user-visible blocking reasons are the sole truth for an item void decision.  Do not derive a
        // second boolean from partial detail facts: that previously allowed canVoid=false with no explanation.
        voidAvailability.put("canVoid", blockingReasons.isEmpty());
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
                .put("generation", inboundFacts.generation());
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
            persistence.insertItem(
                    itemRef, dataNodeRef, brandRef, code, name, shortName, shape, canonicalJson(sections), now, now);
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
        return itemCommand(requestId, itemRef, "DISABLED", 1L);
    }

    private SaveItemResult saveItem(
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
            return new SaveItemResult(
                    voidSkuTransitions(commandContext, dataNodeRef, brandRef, requestId, current, expected, (ArrayNode)
                            skuTransitions),
                    null);
        }
        ObjectNode currentSections = (ObjectNode) json(current.sectionsJson()).deepCopy();
        ObjectNode sections = currentSections.deepCopy();
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
            if (!Set.of("inventoryBom", "inventoryRules").contains(entry.getKey()))
                sections.set(entry.getKey(), entry.getValue().deepCopy());
        });
        sectionsRequest.fields().forEachRemaining(entry -> {
            if (!Set.of(
                            "catalogDraft",
                            "expectedCatalogVersion",
                            "expectedInventoryVersions",
                            "inventoryRules",
                            "inventoryConfiguration")
                    .contains(entry.getKey()))
                sections.set(entry.getKey(), entry.getValue().deepCopy());
        });
        removeRetiredGovernanceFacts(sections);
        ArrayNode nextSkus = normalizeSkuFacts(sections);
        ArrayNode nextCategoryRefs =
                sections.has("categoryRef") ? categoryRefArray(sections.path("categoryRef")) : categoryRefs(sections);
        boolean compositeGroupsSubmitted = saveContainsField(request, "compositeGroups");
        boolean attributeAssignmentsSubmitted = saveContainsField(request, "attributeAssignments");
        boolean orderOptionConfigsSubmitted = saveContainsField(request, "orderOptionConfigs");
        boolean skuVariantDimensionsSubmitted = saveContainsField(request, "skuVariantDimensions");
        boolean skusSubmitted = saveContainsField(request, "skus");
        ArrayNode nextCompositeGroups = compositeGroups(sections);
        ArrayNode nextAttributeAssignments =
                requiredArray(sections.path("attributeAssignments"), "attributeAssignments");
        ArrayNode nextOrderOptionConfigs = requiredArray(sections.path("orderOptionConfigs"), "orderOptionConfigs");
        ArrayNode nextSkuVariantDimensions = submittedSkuVariantDimensions(sections.path("skuVariantDimensions"));
        ArrayNode nextIdentifiers = identifierArray(sections.path("identifiers"), "identifiers");
        Map<UUID, ArrayNode> nextSkuIdentifiers = skuIdentifierFacts(nextSkus);
        JsonNode nextPreparationProfile = nullableTypedFact(sections, "preparationProfile");
        Map<UUID, JsonNode> nextSkuPreparationOverrides = skuPreparationOverrides(nextSkus);
        Map<UUID, JsonNode> nextOptionPreparationEffects = optionPreparationEffects(nextOrderOptionConfigs);
        validateIdentificationAndPreparation(
                rule,
                nextIdentifiers,
                nextSkuIdentifiers,
                nextPreparationProfile,
                nextSkuPreparationOverrides,
                nextOptionPreparationEffects);
        JsonNode nextProductionTagRef = nullableTypedFact(sections, "productionTagRef");
        sections.set("productionTagRef", nextProductionTagRef == null ? mapper.nullNode() : nextProductionTagRef);
        JsonNode nextImages = sections.path("images");
        JsonNode nextTagRefs = sections.path("tagRefs");
        Set<UUID> existingProductionTagRefs = existingProductionTagRef(current, request);
        // inventoryBom is coordinated by the inventory owner and intentionally
        // not persisted in catalog JSON.  It is still a declared catalog
        // reference path, so validate the submitted canonical draft before the
        // coordinator can hand it across the owner boundary.
        if (draft.has("inventoryBom")
                || sectionsRequest.has("inventoryBom")
                || sectionsRequest.has("inventoryConfiguration")
                || sectionsRequest.has("expectedInventoryVersions")) {
            String detail = "旧库存 BOM/多次写入字段已退役，请使用 inventoryRules";
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, detail);
        }
        ObjectNode referencePayload = sections.deepCopy();
        SaveFactPresence saveFactPresence = saveFactPresence(current.ref());
        Map<UUID, CatalogSkuVariantAxisFacts.ExistingAxis> existingSkuVariantAxes =
                skuVariantDimensionsSubmitted && (!nextSkuVariantDimensions.isEmpty() || saveFactPresence.axes())
                        ? skuVariantAxisFacts.validateRetirements(current.ref(), nextSkuVariantDimensions, nextSkus)
                        : Map.of();
        validateSkuCombinations(nextSkus, nextSkuVariantDimensions, rule);
        validateDeclaredOpaqueReferences(
                dataNodeRef, brandRef, referencePayload, currentSections, current.ref(), existingProductionTagRefs);
        Set<UUID> existingUnitRefs = unitReferences(currentSections);
        Set<UUID> submittedUnitRefs = unitReferences(sections);
        if (!submittedUnitRefs.isEmpty())
            existingUnitRefs =
                    mergeRefs(existingUnitRefs, unitReferencesFromOwner(dataNodeRef, brandRef, current.ref()));
        UnitAssignmentFacts unitAssignments = validateUnitAssignments(
                commandContext, current.ref(), dataNodeRef, brandRef, sections, existingUnitRefs, nextSkus, rule);
        CatalogSkuFacts.ExistingSaveFacts existingSaveFacts =
                skusSubmitted ? skuFacts.existingSaveFacts(current.ref()) : CatalogSkuFacts.ExistingSaveFacts.empty();
        Set<UUID> existingSkuRefs = existingSaveFacts.skuRefs();
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
        lockAndValidateCategoryRefs(dataNodeRef, brandRef, sections, currentSections, current.ref());
        lockCatalogAssetRefs(json(current.sectionsJson()), sections);
        CatalogItemPersistence.UnitFactValues unitValues = new CatalogItemPersistence.UnitFactValues(
                unitAssignments.itemSales() == null
                        ? null
                        : unitAssignments.itemSales().unitRef(),
                unitAssignments.itemSales() == null
                        ? null
                        : unitAssignments.itemSales().code(),
                unitAssignments.itemSales() == null
                        ? null
                        : unitAssignments.itemSales().name(),
                unitAssignments.itemSales() == null
                        ? null
                        : unitAssignments.itemSales().unitDimension().name(),
                unitAssignments.itemSales() == null
                        ? null
                        : unitAssignments.itemSales().precision(),
                unitAssignments.itemBase() == null
                        ? null
                        : unitAssignments.itemBase().unitRef(),
                unitAssignments.itemBase() == null
                        ? null
                        : unitAssignments.itemBase().code(),
                unitAssignments.itemBase() == null
                        ? null
                        : unitAssignments.itemBase().name(),
                unitAssignments.itemBase() == null
                        ? null
                        : unitAssignments.itemBase().unitDimension().name(),
                unitAssignments.itemBase() == null
                        ? null
                        : unitAssignments.itemBase().precision());
        int changed = persistence.updateItem(
                nextName, nextShortName, sectionJson, unitValues, now(), dataNodeRef, brandRef, code, expected);
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        skuFacts.replace(current.ref(), nextSkus, archivedSkuRefs);
        CatalogIdentifierFacts.ItemReadback identifierReadback =
                new CatalogIdentifierFacts.ItemReadback(mapper.createArrayNode(), Map.of());
        if (!nextIdentifiers.isEmpty()
                || nextSkuIdentifiers.values().stream().anyMatch(values -> values != null && !values.isEmpty())
                || saveFactPresence.identifiers()) {
            identifierReadback =
                    identifierFacts.replace(dataNodeRef, brandRef, current.ref(), nextIdentifiers, nextSkuIdentifiers);
        }
        if (nextPreparationProfile != null || saveFactPresence.itemProfile())
            preparationFacts.replaceItemProfile(current.ref(), nextPreparationProfile);
        if (!nextSkuPreparationOverrides.isEmpty() || saveFactPresence.skuOverrides())
            preparationFacts.replaceSkuOverrides(current.ref(), nextSkuPreparationOverrides);
        replaceEffectiveUnitFacts(current.ref(), sections, nextSkus, unitAssignments);
        if (hasSkuMedia(nextSkus) || saveFactPresence.skuMedia()) skuMediaFacts.replace(nextSkus);
        if (!nextCategoryRefs.isEmpty() || saveFactPresence.categories())
            categoryFacts.replace(current.ref(), nextCategoryRefs);
        // A PATCH that omitted a relation is already hydrated from the owner.  If that hydrated fact is empty,

        // there is no relation row to delete or rewrite; avoid paying a second identity read for an unchanged empty
        // relation.  Explicit empty arrays still execute the replace path because they mean "clear existing facts".
        if (!nextCompositeGroups.isEmpty() || saveFactPresence.composites())
            compositeFacts.replace(current.ref(), nextCompositeGroups);
        if (!nextAttributeAssignments.isEmpty() || saveFactPresence.attributes())
            itemDefinitionFacts.replaceAttributeAssignments(
                    dataNodeRef, brandRef, current.ref(), nextAttributeAssignments);
        if (!nextOrderOptionConfigs.isEmpty() || saveFactPresence.orderOptions())
            itemDefinitionFacts.replaceOrderOptionConfigs(dataNodeRef, brandRef, current.ref(), nextOrderOptionConfigs);
        if (!nextOptionPreparationEffects.isEmpty() || saveFactPresence.optionEffects())
            preparationFacts.replaceOptionEffects(current.ref(), nextOptionPreparationEffects);
        if (!nextSkuVariantDimensions.isEmpty() || saveFactPresence.axes())
            skuVariantAxisFacts.replace(current.ref(), nextSkuVariantDimensions, existingSkuVariantAxes);
        if (hasArrayEntries(nextImages) || saveFactPresence.images()) itemMediaFacts.replace(current.ref(), nextImages);
        if (saveContainsField(request, "productionTagRef")
                || hasArrayEntries(nextTagRefs)
                || saveFactPresence.references())
            itemReferenceFacts.replace(current.ref(), nextProductionTagRef, nextTagRefs);
        // An explicit empty configuration has no relational rows after the replace path.  Re-reading that known
        // zero-row fact only adds a round trip; non-empty submissions still use the post-write owner readback.
        ArrayNode readbackOrderOptions = orderOptionConfigsSubmitted && !nextOrderOptionConfigs.isEmpty()
                ? itemDefinitionFacts
                        .readOrderOptionConfigs(List.of(current.ref()))
                        .getOrDefault(current.ref(), mapper.createArrayNode())
                : nextOrderOptionConfigs.deepCopy();
        ObjectNode response = itemSaveReadback(
                requestId,
                current,
                sections,
                expected + 1,
                unitAssignments,
                readbackOrderOptions,
                identifierReadback,
                nextPreparationProfile,
                nextOptionPreparationEffects);
        return new SaveItemResult(
                response,
                saveProjection(
                        current,
                        code,
                        rule,
                        nextSkus,
                        nextSkuVariantDimensions,
                        unitAssignments,
                        readbackOrderOptions,
                        previousAssetRefs(current, existingSaveFacts)));
    }

    private ArrayNode identifierArray(JsonNode value, String path) {
        if (value == null || value.isMissingNode() || value.isNull()) return mapper.createArrayNode();
        if (!value.isArray())
            throw new CatalogOwnerApi.Problem("CATALOG_IDENTIFIER_VALUE_INVALID", 422, path + " 必须是数组");
        return ((ArrayNode) value).deepCopy();
    }

    private Map<UUID, ArrayNode> skuIdentifierFacts(ArrayNode skus) {
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        if (skus == null) return result;
        for (JsonNode skuNode : skus) {
            UUID skuRef = requiredUuidValue(skuNode.path("productSkuRef"), "skus[].productSkuRef");
            result.put(skuRef, identifierArray(skuNode.path("identifiers"), "skus[].identifiers"));
        }
        return result;
    }

    private JsonNode nullableTypedFact(ObjectNode sections, String field) {
        JsonNode value = sections.get(field);
        return value == null || value.isNull() ? null : value.deepCopy();
    }

    private Map<UUID, JsonNode> skuPreparationOverrides(ArrayNode skus) {
        Map<UUID, JsonNode> result = new LinkedHashMap<>();
        if (skus == null) return result;
        for (JsonNode skuNode : skus) {
            UUID skuRef = requiredUuidValue(skuNode.path("productSkuRef"), "skus[].productSkuRef");
            JsonNode override = skuNode.get("preparationOverride");
            preparationFacts.validateOverride(override);
            if (override != null
                    && override.isObject()
                    && "OVERRIDE".equals(override.path("mode").asText())) result.put(skuRef, override.deepCopy());
        }
        return result;
    }

    private Map<UUID, JsonNode> optionPreparationEffects(ArrayNode configs) {
        Map<UUID, JsonNode> result = new LinkedHashMap<>();
        if (configs == null) return result;
        for (JsonNode config : configs) {
            JsonNode values = config.path("values");
            if (!values.isArray()) continue;
            for (JsonNode value : values) {
                UUID valueRef = requiredUuidValue(
                        value.path("definitionValueRef"), "orderOptionConfigs[].values[].definitionValueRef");
                JsonNode effect = value.get("preparationEffect");
                preparationFacts.validateEffect(effect);
                if (effect != null && effect.isObject()) result.put(valueRef, effect.deepCopy());
            }
        }
        return result;
    }

    private void validateIdentificationAndPreparation(
            CatalogInventoryShapeManifest.ShapeRule rule,
            ArrayNode itemIdentifiers,
            Map<UUID, ArrayNode> skuIdentifiers,
            JsonNode itemProfile,
            Map<UUID, JsonNode> skuOverrides,
            Map<UUID, JsonNode> optionEffects) {
        identifierFacts.validatePayload(itemIdentifiers, skuIdentifiers);
        String shape = rule.shapeKey().name();
        for (JsonNode identifier : itemIdentifiers) {
            String type = identifier.path("identifierType").asText("");
            if (!identifierAllowed(shape, "CATALOG_ITEM", type))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                    "CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED",
                    422,
                    "当前商品形态不支持此识别方式"
                );
                // spotless:on
        }
        for (ArrayNode identifiers : skuIdentifiers.values())
            for (JsonNode identifier : identifiers) {
                String type = identifier.path("identifierType").asText("");
                if (!identifierAllowed(shape, "SKU", type))
                    // spotless:off
                    throw new CatalogOwnerApi.Problem(
                        "CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED",
                        422,
                        "当前商品形态不支持规格识别方式"
                    );
                    // spotless:on
            }
        boolean itemPreparationAllowed = preparationAllowed(shape, "ITEM");
        boolean skuPreparationAllowed = preparationAllowed(shape, "SKU");
        boolean optionPreparationAllowed = preparationAllowed(shape, "OPTION_VALUE");
        preparationFacts.validateProfile(itemProfile);
        if (itemProfile != null && !itemProfile.isNull() && !itemPreparationAllowed)
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                "CATALOG_PREPARATION_NOT_ALLOWED",
                422,
                "当前商品形态不能填写制作信息"
            );
            // spotless:on
        if (!skuOverrides.isEmpty() && !skuPreparationAllowed)
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                "CATALOG_PREPARATION_NOT_ALLOWED",
                422,
                "当前商品形态不能填写规格制作信息"
            );
            // spotless:on
        for (JsonNode effect : optionEffects.values()) preparationFacts.validateEffect(effect);
        if (!optionEffects.isEmpty() && !optionPreparationAllowed)
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                "CATALOG_PREPARATION_NOT_ALLOWED",
                422,
                "当前商品形态不能填写选项制作变化"
            );
            // spotless:on
    }

    private boolean identifierAllowed(String shape, String ownerType, String type) {
        return switch (shape) {
            case "STANDARD_SALE_COUNTED", "MATERIAL", "COMPOSITE" -> "CATALOG_ITEM".equals(ownerType)
                    && Set.of("BARCODE", "MNEMONIC").contains(type);
            case "SKU_VARIANT_SALE_COUNTED" -> "SKU".equals(ownerType)
                    && Set.of("BARCODE", "MNEMONIC").contains(type);
            case "STANDARD_SALE_WEIGHED" -> "CATALOG_ITEM".equals(ownerType)
                    && Set.of("BARCODE", "PLU", "MNEMONIC").contains(type);
            case "SERVICE" -> "CATALOG_ITEM".equals(ownerType) && "MNEMONIC".equals(type);
            case "BENEFIT_SHELL" -> false;
            default -> false;
        };
    }

    private boolean preparationAllowed(String shape, String targetKind) {
        return switch (shape) {
            case "STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED" -> Set.of("ITEM", "OPTION_VALUE")
                    .contains(targetKind);
            case "SKU_VARIANT_SALE_COUNTED" -> "ITEM".equals(targetKind) || "SKU".equals(targetKind);
            default -> false;
        };
    }

    private UnitAssignmentFacts validateUnitAssignments(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            UUID itemRef,
            String scope,
            String brand,
            ObjectNode sections,
            Set<UUID> existingUnitRefs,
            ArrayNode skus,
            CatalogInventoryShapeManifest.ShapeRule rule) {
        UUID itemBaseRef = optionalUuid(sections, "baseMeasureUnitRef");
        UUID itemSalesRef = optionalUuid(sections, "salesUnitRef");
        Set<UUID> refs = new LinkedHashSet<>();
        if (itemBaseRef != null) refs.add(itemBaseRef);
        if (itemSalesRef != null) refs.add(itemSalesRef);
        List<UUID> skuRefs = new ArrayList<>();
        Map<UUID, UUID> salesOverrides = new LinkedHashMap<>();
        Map<UUID, UUID> baseOverrides = new LinkedHashMap<>();
        for (JsonNode sku : skus) {
            UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
            skuRefs.add(skuRef);
            UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
            UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
            salesOverrides.put(skuRef, salesOverride);
            baseOverrides.put(skuRef, baseOverride);
            if (salesOverride != null) refs.add(salesOverride);
            if (baseOverride != null) refs.add(baseOverride);
        }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> units =
                unitDefinitionFacts.requireInScopeAll(scope, brand, refs);
        for (UUID ref : refs) {
            CatalogOwnerApi.UnitDefinitionReadback unit = units.get(ref);
            if (!existingUnitRefs.contains(ref) && !"ENABLED".equals(unit.status()))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                        "UNIT_NOT_ACTIVE", 422, "新绑定的计量单位必须处于启用状态");
                // spotless:on
        }
        CatalogOwnerApi.UnitDefinitionReadback itemBase = itemBaseRef == null ? null : units.get(itemBaseRef);
        CatalogOwnerApi.UnitDefinitionReadback itemSales = itemSalesRef == null ? null : units.get(itemSalesRef);
        boolean hasEffectiveSalesUnit = itemSalesRef != null;
        List<InventoryOwnerApi.CatalogSkuBaseMeasureUnit> skuBaseMeasureUnits = new ArrayList<>();
        Map<UUID, SkuUnitAssignment> skuAssignments = new LinkedHashMap<>();
        for (UUID skuRef : skuRefs) {
            CatalogOwnerApi.UnitDefinitionReadback salesOverride =
                    salesOverrides.get(skuRef) == null ? null : units.get(salesOverrides.get(skuRef));
            CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                    baseOverrides.get(skuRef) == null ? null : units.get(baseOverrides.get(skuRef));
            if (salesOverride != null) hasEffectiveSalesUnit = true;
            CatalogOwnerApi.UnitDefinitionReadback effectiveBase = baseOverride == null ? itemBase : baseOverride;
            CatalogOwnerApi.UnitDefinitionReadback effectiveSales = salesOverride == null ? itemSales : salesOverride;
            skuAssignments.put(
                    skuRef, new SkuUnitAssignment(salesOverride, baseOverride, effectiveSales, effectiveBase));
            skuBaseMeasureUnits.add(
                    new InventoryOwnerApi.CatalogSkuBaseMeasureUnit(skuRef, unitSnapshot(effectiveBase)));
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
        return new UnitAssignmentFacts(itemSales, itemBase, Map.copyOf(skuAssignments));
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

    private void replaceEffectiveUnitFacts(
            UUID itemRef, ObjectNode sections, ArrayNode skus, UnitAssignmentFacts unitAssignments) {
        List<CatalogItemPersistence.SkuUnitFactRow> skuRows = new ArrayList<>();
        for (JsonNode sku : skus) {
            UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
            SkuUnitAssignment assignment = unitAssignments.skus().get(skuRef);
            if (assignment == null) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "SKU 单位事实缺失");
            skuRows.add(skuUnitFactRow(
                    skuRef,
                    assignment.salesOverride(),
                    assignment.baseOverride(),
                    assignment.effectiveSales(),
                    assignment.effectiveBase()));
        }
        writeSkuUnitFactsBatch(skuRows);
    }

    private void writeItemUnitSnapshots(
            UUID itemRef, CatalogOwnerApi.UnitDefinitionReadback sales, CatalogOwnerApi.UnitDefinitionReadback base) {
        writeItemUnitSnapshotsBatch(Collections.singletonList(itemUnitFactRow(itemRef, sales, base)));
    }

    private void writeItemUnitSnapshotsBatch(List<CatalogItemPersistence.ItemUnitSnapshotRow> rows) {
        if (rows.isEmpty()) return;
        persistence.writeItemUnitSnapshots(rows);
    }

    private CatalogItemPersistence.ItemUnitSnapshotRow itemUnitFactRow(
            UUID itemRef, CatalogOwnerApi.UnitDefinitionReadback sales, CatalogOwnerApi.UnitDefinitionReadback base) {
        return new CatalogItemPersistence.ItemUnitSnapshotRow(
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
        List<CatalogItemPersistence.SkuUnitFactRow> rows = new ArrayList<>();
        rows.add(skuUnitFactRow(skuRef, salesOverride, baseOverride, sales, base));
        writeSkuUnitFactsBatch(rows);
    }

    private void writeSkuUnitFactsBatch(List<CatalogItemPersistence.SkuUnitFactRow> rows) {
        if (rows.isEmpty()) return;
        persistence.writeSkuUnitFacts(rows);
    }

    private CatalogItemPersistence.SkuUnitFactRow skuUnitFactRow(
            UUID skuRef,
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,
            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback sales,
            CatalogOwnerApi.UnitDefinitionReadback base) {
        return new CatalogItemPersistence.SkuUnitFactRow(
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
                now(),
                skuRef);
    }

    private void writeCopiedEffectiveUnitFacts(
            String scope, String brand, UUID itemRef, ObjectNode sections, ArrayNode skus) {
        UUID itemSalesRef = nullableUuid(sections, "salesUnitRef");
        UUID itemBaseRef = nullableUuid(sections, "baseMeasureUnitRef");
        Set<UUID> refs = new LinkedHashSet<>();
        if (itemSalesRef != null) refs.add(itemSalesRef);
        if (itemBaseRef != null) refs.add(itemBaseRef);
        Map<UUID, UUID> salesOverrideRefs = new LinkedHashMap<>();
        Map<UUID, UUID> baseOverrideRefs = new LinkedHashMap<>();
        if (skus != null && skus.isArray())
            for (JsonNode sku : skus) {
                UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
                UUID salesOverrideRef = nullableUuid(sku, "salesUnitOverrideRef");
                UUID baseOverrideRef = nullableUuid(sku, "baseMeasureUnitOverrideRef");
                salesOverrideRefs.put(skuRef, salesOverrideRef);
                baseOverrideRefs.put(skuRef, baseOverrideRef);
                if (salesOverrideRef != null) refs.add(salesOverrideRef);
                if (baseOverrideRef != null) refs.add(baseOverrideRef);
            }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> definitions =
                unitDefinitionFacts.requireInScopeAll(scope, brand, refs);
        CatalogOwnerApi.UnitDefinitionReadback itemSales = itemSalesRef == null ? null : definitions.get(itemSalesRef);
        CatalogOwnerApi.UnitDefinitionReadback itemBase = itemBaseRef == null ? null : definitions.get(itemBaseRef);
        writeItemUnitSnapshots(itemRef, itemSales, itemBase);
        if (skus == null || !skus.isArray()) return;
        for (JsonNode sku : skus) {
            UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
            UUID salesOverrideRef = salesOverrideRefs.get(skuRef);
            UUID baseOverrideRef = baseOverrideRefs.get(skuRef);
            CatalogOwnerApi.UnitDefinitionReadback salesOverride =
                    salesOverrideRef == null ? null : definitions.get(salesOverrideRef);
            CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                    baseOverrideRef == null ? null : definitions.get(baseOverrideRef);
            writeSkuUnitFacts(
                    skuRef,
                    salesOverride,
                    baseOverride,
                    salesOverride == null ? itemSales : salesOverride,
                    baseOverride == null ? itemBase : baseOverride);
        }
    }

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
        for (UUID skuRef : orderedSkuRefs) {
            List<SkuInboundReference> catalogReferences = catalogReferencesBySku.getOrDefault(skuRef, List.of());
            if (!catalogReferences.isEmpty()) {
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID", 422, "该规格已被套餐内容使用，暂不能作废");
                // spotless:on
            }
            inventory.retireCatalogVoidInventoryDefinitions(
                    commandContext,
                    new InventoryOwnerApi.CatalogVoidSubject(
                            InventoryOwnerApi.CatalogVoidSubjectKind.PRODUCT_SKU, skuRef),
                    commandContext.requestId() + "|sku-inventory|" + skuRef);
        }
    }

    private void validateSkuTransitionSave(ItemRow current, ObjectNode sections) {
        if (sections == null || !sections.path("catalogDraft").isObject()) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "skuTransitions requires the catalog save envelope");
        }
        java.util.Iterator<String> fields = sections.path("catalogDraft").fieldNames();
        Set<String> allowed = Set.of("name", "shapeKey", "images", "categoryRef");
        while (fields.hasNext()) {
            String field = fields.next();
            if (!allowed.contains(field))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with catalog section changes");
        }
        if (sections.path("inventoryRules").path("nodes").isArray()
                && !sections.path("inventoryRules").path("nodes").isEmpty()) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "skuTransitions cannot be combined with inventory changes");
        }
        if (sections.path("inventoryRules").path("nodes").isArray()
                && !sections.path("inventoryRules").path("nodes").isEmpty()) {
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
        for (String field : List.of("images", "productionTagRef", "categoryRef")) {
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
        });
        Set<UUID> refs = requested.stream()
                .map(SkuTransitionRequest::skuRef)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        requireSkuRetirementUnreferenced(commandContext, refs);
        lockCatalogItemForUpdate(dataNodeRef, brandRef, current.ref(), expectedCatalogVersion);
        if (persistence.bumpItemVersion(current.ref(), dataNodeRef, brandRef, expectedCatalogVersion, now()) != 1) {
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
            appendVoidBlockingReason(result.putArray("blockingReasons"), "ALREADY_VOIDED", 1, List.of());
        });
        return itemSaveReadback(requestId, dataNodeRef, brandRef, current.code(), expectedCatalogVersion + 1, readback);
    }

    private UUID findSkuItemRef(String dataNodeRef, String brandRef, UUID skuRef) {
        List<UUID> refs = persistence.findSkuItemRefs(dataNodeRef, brandRef, skuRef);
        if (refs.isEmpty()) {
            if (persistence.skuExists(skuRef))
                throw new CatalogOwnerApi.Problem(
                        "SCOPE_FORBIDDEN", 403, "SKU does not belong to the current data scope");
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "SKU 不存在");
        }
        return refs.get(0);
    }

    private void lockCatalogItemForUpdate(String dataNodeRef, String brandRef, UUID itemRef, long expectedVersion) {
        List<Long> versions = persistence.lockCatalogItemVersions(dataNodeRef, brandRef, itemRef);
        if (versions.isEmpty() || versions.get(0) != expectedVersion)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
    }

    private DetailInboundFacts detailInboundFacts(
            String dataNodeRef, String brandRef, UUID itemRef, Collection<UUID> skuRefs) {
        CatalogItemPersistence.DetailInboundFactsRow row =
                persistence.readDetailInboundFacts(dataNodeRef, brandRef, itemRef, skuRefs);
        Map<UUID, List<SkuInboundReference>> bySku = new LinkedHashMap<>();
        row.bySku()
                .forEach((skuRef, references) -> bySku.put(
                        skuRef,
                        references.stream()
                                .map(value -> new SkuInboundReference(
                                        value.componentRef(),
                                        value.ownerItemRef(),
                                        value.ownerCode(),
                                        value.ownerName()))
                                .toList()));
        List<InboundItemReference> byItem = row.byItem().stream()
                .map(value -> new InboundItemReference(value.itemRef(), value.code(), value.name()))
                .toList();
        return new DetailInboundFacts(Map.copyOf(bySku), byItem, row.generation());
    }

    private Map<UUID, List<SkuInboundReference>> skuInboundReferencesByRefs(
            String dataNodeRef, String brandRef, Collection<UUID> skuRefs) {
        Map<UUID, List<SkuInboundReference>> result = new LinkedHashMap<>();
        persistence
                .readSkuInboundReferences(dataNodeRef, brandRef, skuRefs)
                .forEach((skuRef, references) -> result.put(
                        skuRef,
                        references.stream()
                                .map(value -> new SkuInboundReference(
                                        value.componentRef(),
                                        value.ownerItemRef(),
                                        value.ownerCode(),
                                        value.ownerName()))
                                .toList()));
        return Map.copyOf(result);
    }

    private void lockProductSkuRefs(Collection<UUID> refs) {
        persistence.lockProductSkuRefs(refs);
    }

    private void lockCatalogItemRefs(Collection<UUID> refs) {
        persistence.lockCatalogItemRefs(refs);
    }

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
            if (sku.has("skuBarcode") || sku.has("barcode"))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    "规格识别信息已改为在识别信息中维护"
                );
                // spotless:on
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
            if ("VOIDED".equals(sku.path("status").asText("ENABLED"))) continue;
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

    private static void rejectRetiredItemOwnedCatalogFields(ObjectNode payload) {
        for (String field :
                List.of("attributes", "orderOptions", "productionProfiles", "productionTagRefs", "skuBarcode")) {
            if (payload.has(field))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR",
                        422,
                        /* format-wrap */
                        "请求包含已退役的商品字段");
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
            ObjectNode request,
            TransitionItemPrecheck prechecked,
            String idempotencyKey) {
        String code = required(request, "itemCode");
        long expected = requiredLong(request, "expectedVersion", 1);
        String target = required(request, "targetStatus");
        if (!CatalogOwnerTypes.STATUSES.contains(target))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "状态不在闭集");
        ItemRow current = prechecked == null ? requireItem(dataNodeRef, brandRef, code) : prechecked.item();
        long nextVersion = transitionItemState(
                commandContext,
                dataNodeRef,
                brandRef,
                requestId,
                current,
                expected,
                target,
                false,
                prechecked == null ? null : prechecked.hasIdentifiers(),
                null,
                (idempotencyKey == null || idempotencyKey.isBlank() ? requestId : idempotencyKey) + "|inventory|"
                        + current.ref());
        return itemCommand(requestId, current.ref(), target, nextVersion);
    }

    private long transitionItemState(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ItemRow current,
            long expected,
            String target,
            boolean sameStateIsNoOp) {
        return transitionItemState(
                commandContext,
                dataNodeRef,
                brandRef,
                requestId,
                current,
                expected,
                target,
                sameStateIsNoOp,
                null,
                null,
                null);
    }

    private long transitionItemState(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ItemRow current,
            long expected,
            String target,
            boolean sameStateIsNoOp,
            Boolean knownHasIdentifiers) {
        return transitionItemState(
                commandContext,
                dataNodeRef,
                brandRef,
                requestId,
                current,
                expected,
                target,
                sameStateIsNoOp,
                knownHasIdentifiers,
                null,
                null);
    }

    private long transitionItemState(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ItemRow current,
            long expected,
            String target,
            boolean sameStateIsNoOp,
            Boolean knownHasIdentifiers,
            BatchStatusPreloadedFacts batchFacts,
            String inventoryIdempotencyKey) {
        if (sameStateIsNoOp && target.equals(current.status())) return current.version();
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废记录不可修改");
        if (expected != current.version()) {
            throw new CatalogOwnerApi.Problem(("VERSION_CONFLICT"), (409), ("商品版本已变化"));
        }
        if ("ENABLED".equals(target) && !"ENABLED".equals(current.status())) validateItemActivation(current);
        if ("VOIDED".equals(target) && itemReferencedByOtherItems(dataNodeRef, brandRef, current, batchFacts)) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_BLOCKS_VOID"),
                    (422),
                    /* format-wrap */
                    ("商品仍被其他商品引用，不能作废"));
        }
        if ("VOIDED".equals(target) && hasItemDependencies(current, knownHasIdentifiers, batchFacts)) {
            throw new CatalogOwnerApi.Problem(
                    ("DEPENDENT_FACTS_BLOCK_VOID"),
                    (422),
                    /* format-wrap */
                    ("商品仍有依赖事实，不能作废"));
        }
        if ("VOIDED".equals(target))
            requireItemRetirementUnreferenced(commandContext, current, batchFacts, inventoryIdempotencyKey);
        if ("VOIDED".equals(target)) lockCatalogAssetRefs(json(current.sectionsJson()));
        if (persistence.transitionItem(target, now(), current.ref(), dataNodeRef, brandRef, expected) != 1) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }
        return expected + 1;
    }

    private void requireItemRetirementUnreferenced(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            ItemRow current,
            BatchStatusPreloadedFacts batchFacts,
            String inventoryIdempotencyKey) {
        if (commandContext == null || inventory == null) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    "item void requires the catalog execution context and inventory owner API");
        }
        if (batchFacts != null && batchFacts.voidedFactsPreloaded()) {
            InventoryOwnerApi.CatalogVoidDependencyReadback dependencies =
                    batchFacts.inventoryDependencies().get(current.ref());
            if (dependencies == null) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "item inventory dependency readback is missing");
            }
            if (dependencies.hasInboundBomReferences()) {
                String dependencySources = inventoryVoidDependencySources(dependencies);
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID",
                        422,
                        /* format-wrap */
                        "商品仍被库存 BOM 引用，不能作废：" + dependencySources);
            }
            InventoryOwnerApi.CatalogVoidSubject subject = new InventoryOwnerApi.CatalogVoidSubject(
                    InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM, current.ref());
            inventory.retireCatalogVoidInventoryDefinitionsForBatch(commandContext, subject, inventoryIdempotencyKey);
            return;
        }
        // Use the same set-based owner command for a single item and a batch item. It preserves the owner transaction,
        // idempotency receipt, admission checks, and final readback without reintroducing per-row round trips.
        inventory.retireCatalogVoidInventoryDefinitionsForBatch(
                commandContext,
                new InventoryOwnerApi.CatalogVoidSubject(
                        InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM, current.ref()),
                inventoryIdempotencyKey);
    }

    private void validateItemActivation(ItemRow row) {
        // The shape manifest owns derived price granularity.  SKU rows are relational owner facts and are not
        // persisted inside catalog_item.sections, so lifecycle validation must not inspect the hydrated read shape.
        String priceGranularity = shapeRule(row.shapeKey()).priceGranularity();
        if ("SKU".equals(priceGranularity)) {
            CatalogSkuFacts.ActivationFacts skuFacts = this.skuFacts.activationFacts(row.ref());
            if (skuFacts.enabledCount() == 0) {
                throw new CatalogOwnerApi.Problem(
                        ("VALIDATION_ERROR"),
                        (422),
                        /* format-wrap */
                        ("启用前请至少维护一个启用 SKU"));
            }
            return;
        }
    }

    private boolean formalCodeAvailable(String dataNodeRef, String brandRef, String code, UUID currentRef) {
        return persistence.formalCodeAvailable(dataNodeRef, brandRef, code, currentRef);
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

    private static String inventoryVoidDependencySources(InventoryOwnerApi.CatalogVoidDependencyReadback dependencies) {
        return dependencies.inboundBomReferences().stream()
                .map(reference -> reference.sourceName() + " x" + reference.count())
                .collect(java.util.stream.Collectors.joining(", "));
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
        if (!temporary) blockedReasons.add("NOT_TEMPORARY_ITEM");
        if (expectedSourceVersion != row.version()) blockedReasons.add("VERSION_CONFLICT");
        if (rule.visibleButDisabled()) blockedReasons.add("SHAPE_DISABLED");
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

    private TemporaryPromotionSourceFacts temporaryPromotionSourceFacts(
            String dataNodeRef, String brandRef, ItemRow row) {
        List<UUID> itemRefs = List.of(row.ref());
        CopyFactPresence presence = copyFactPresence(itemRefs);
        Map<UUID, ArrayNode> skusByItem = presence.skus() ? skuFacts.readByItemRefs(itemRefs) : Map.of();
        // spotless:off
        Map<UUID, ArrayNode> categoriesByItem =
                presence.categories() ? categoryFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> compositesByItem =
                presence.composites() ? compositeFacts.readByItemRefs(itemRefs) : Map.of();
        // spotless:on
        CatalogItemDefinitionFacts.TemporaryPromotionFacts definitionFacts =
                itemDefinitionFacts.readTemporaryPromotionFacts(
                        dataNodeRef, brandRef, row.ref(), presence.attributes(), presence.orderOptions());
        Map<UUID, ArrayNode> axesByItem = presence.axes() ? skuVariantAxisFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> imagesByItem = presence.images() ? itemMediaFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, Map<String, JsonNode>> referencesByItem =
                presence.references() ? itemReferenceFacts.readByItemRefs(itemRefs) : Map.of();
        ItemUnitRefs unitRefs = itemUnitRefsByItemRefs(itemRefs).get(row.ref());

        ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
        // Imported temporary items may persist only the source-owned catalog row and omit derived fields.  Rehydrate
        // every shape-derived fact from the manifest before this projection is consumed by promotion or persisted on
        // the formal item; the old hydrated read path exposed the same canonical values.
        applyDerivedShapeFields(sections, shapeRule(row.shapeKey()));
        sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        ArrayNode categoryRefs = categoriesByItem.getOrDefault(row.ref(), mapper.createArrayNode());
        sections.set("categoryRefs", categoryRefs);
        if (categoryRefs.isEmpty()) sections.putNull("categoryRef");
        else sections.put("categoryRef", categoryRefs.get(0).asText());
        sections.set("compositeGroups", compositesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        sections.set("attributeAssignments", definitionFacts.attributeAssignments());
        sections.set("orderOptionConfigs", definitionFacts.orderOptionConfigs());
        sections.set("skuVariantDimensions", axesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        sections.set("images", imagesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        if (unitRefs == null || unitRefs.salesUnitRef() == null) sections.putNull("salesUnitRef");
        else sections.put("salesUnitRef", unitRefs.salesUnitRef().toString());
        if (unitRefs == null || unitRefs.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
        else sections.put("baseMeasureUnitRef", unitRefs.baseMeasureUnitRef().toString());
        putNullableUnitSnapshot(sections, "salesUnitSnapshot", unitRefs == null ? null : unitRefs.salesUnitSnapshot());
        putNullableUnitSnapshot(
                sections, "baseMeasureUnitSnapshot", unitRefs == null ? null : unitRefs.baseMeasureUnitSnapshot());
        Map<String, JsonNode> references = referencesByItem.get(row.ref());
        sections.set(
                "productionTagRef",
                references == null
                        ? mapper.nullNode()
                        : references.getOrDefault(CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
        sections.set(
                "tagRefs",
                references == null
                        ? mapper.createArrayNode()
                        : references.getOrDefault(CatalogItemReferenceFacts.CATALOG_TAG, mapper.createArrayNode()));
        return new TemporaryPromotionSourceFacts(sections, definitionFacts);
    }

    private CatalogTemporaryPromotionProjection temporaryPromotionProjection(
            UUID sourceItemRef,
            UUID targetItemRef,
            String targetItemCode,
            String sourceMeasureMode,
            ObjectNode targetSections,
            ArrayNode targetSkus,
            List<UUID> optionValueRefs) {
        Map<String, CatalogTemporaryPromotionSkuFact> targetSkuFacts = new LinkedHashMap<>();
        if (targetSkus != null)
            for (JsonNode sku : targetSkus) {
                String skuCode = sku.path("skuCode").asText("");
                if (skuCode.isBlank()) continue;
                UUID productSkuRef = nullableUuid(sku, "productSkuRef");
                if (productSkuRef == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "转正商品 SKU 引用缺失");
                }
                if (targetSkuFacts.put(
                                skuCode,
                                new CatalogTemporaryPromotionSkuFact(
                                        productSkuRef,
                                        temporaryPromotionUnitSnapshot(
                                                sku.get("baseMeasureUnitSnapshot"),
                                                "targetSkus[].baseMeasureUnitSnapshot")))
                        != null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "转正商品包含重复 SKU 编码");
                }
            }
        return new CatalogTemporaryPromotionProjection(
                sourceItemRef,
                sourceMeasureMode,
                targetItemRef,
                targetItemCode,
                temporaryPromotionUnitSnapshot(targetSections.get("baseMeasureUnitSnapshot"), "targetBaseMeasureUnit"),
                targetSkuFacts,
                optionValueRefs);
    }

    private ObjectNode promotionExecute(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        return promotionExecuteWithProjection(dataNodeRef, brandRef, requestId, request, null)
                .response();
    }

    private PromotionExecution promotionExecute(
            String dataNodeRef, String brandRef, String requestId, ObjectNode request, ItemRow prechecked) {
        return promotionExecuteWithProjection(dataNodeRef, brandRef, requestId, request, prechecked);
    }

    private PromotionExecution promotionExecuteWithProjection(
            String dataNodeRef, String brandRef, String requestId, ObjectNode request, ItemRow prechecked) {
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
        ItemRow row = prechecked == null ? requireItemIdentity(dataNodeRef, brandRef, code) : prechecked;
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
        TemporaryPromotionSourceFacts sourceFacts = temporaryPromotionSourceFacts(dataNodeRef, brandRef, row);
        ObjectNode promotedSections =
                promotedSections(row, sourceFacts.sections(), rule, materialRole, optional(request, "shortName"));
        ArrayNode promotedCategoryRefs = categoryRefs(promotedSections);
        ArrayNode promotedCompositeGroups = compositeGroups(promotedSections);
        ArrayNode promotedSkuVariantDimensions =
                submittedSkuVariantDimensions(promotedSections.path("skuVariantDimensions"));
        JsonNode promotedImages = promotedSections.path("images");
        JsonNode promotedProductionTagRef = promotedSections.path("productionTagRef");
        JsonNode promotedTagRefs = promotedSections.path("tagRefs");
        String promotedShortName = removeShortName(promotedSections);
        ArrayNode promotedSkus = clonedSkuFacts((ArrayNode) promotedSections.path("skus"));
        if (formalCode.equals(code)) {
            removeRelationalSectionFacts(promotedSections);
            if (persistence.updateTemporaryPromotionItem(
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
            return new PromotionExecution(
                    itemCommand(requestId, row.ref(), "DISABLED", expected + 1),
                    temporaryPromotionProjection(
                            row.ref(),
                            row.ref(),
                            formalCode,
                            sourceFacts.sections().path("measureMode").asText(""),
                            promotedSections,
                            promotedSkus,
                            sourceFacts.definitionFacts().optionValueRefs()));
        }
        UUID promotedItemRef = UUID.randomUUID();
        lockCatalogAssetRefs(sourceFacts.sections(), promotedSections);
        removeRelationalSectionFacts(promotedSections);
        try {
            persistence.insertTemporaryPromotionItem(
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
        if (!promotedSkus.isEmpty()) skuFacts.replace(promotedItemRef, promotedSkus, Set.of());
        writeCopiedEffectiveUnitFacts(dataNodeRef, brandRef, promotedItemRef, promotedSections, promotedSkus);
        if (hasSkuMedia(promotedSkus)) skuMediaFacts.replace(promotedSkus);
        if (!promotedCategoryRefs.isEmpty()) categoryFacts.replace(promotedItemRef, promotedCategoryRefs);
        if (!promotedCompositeGroups.isEmpty()) compositeFacts.replace(promotedItemRef, promotedCompositeGroups);
        itemDefinitionFacts.copyTemporaryPromotionFactsWithinScope(
                dataNodeRef, brandRef, promotedItemRef, sourceFacts.definitionFacts());
        if (!promotedSkuVariantDimensions.isEmpty())
            skuVariantAxisFacts.replace(promotedItemRef, promotedSkuVariantDimensions);
        if (hasArrayEntries(promotedImages)) itemMediaFacts.replace(promotedItemRef, promotedImages);
        if ((promotedProductionTagRef != null && !promotedProductionTagRef.isNull())
                || hasArrayEntries(promotedTagRefs))
            itemReferenceFacts.replace(promotedItemRef, promotedProductionTagRef, promotedTagRefs);
        if (persistence.voidTemporaryPromotionItem(now(), dataNodeRef, brandRef, code, expected) != 1)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "临时商品版本已变化");
        return new PromotionExecution(
                itemCommand(requestId, promotedItemRef, "DISABLED", 1L),
                temporaryPromotionProjection(
                        row.ref(),
                        promotedItemRef,
                        formalCode,
                        sourceFacts.sections().path("measureMode").asText(""),
                        promotedSections,
                        promotedSkus,
                        sourceFacts.definitionFacts().optionValueRefs()));
    }

    private List<CategoryRow> lockCategories(String scope, String brand, List<UUID> refs) {
        List<UUID> stable = refs.stream().distinct().sorted().toList();
        List<CategoryRow> rows = persistence.lockCategories(scope, brand, refs).stream()
                .map(CatalogItemService::categoryRow)
                .toList();
        if (rows.size() != stable.size()) {
            throw new CatalogOwnerApi.Problem(("NOT_FOUND"), (404), ("分类不存在或已删除"));
        }
        return rows;
    }

    private ObjectNode promotedSections(
            ItemRow row,
            ObjectNode sourceSections,
            CatalogInventoryShapeManifest.ShapeRule rule,
            String materialRole,
            String shortName) {
        ObjectNode sections = sourceSections.deepCopy();
        applyDerivedShapeFields(sections, rule);
        sections.put("source", "SELF_MANAGED").put("promotedFromTemporaryCode", row.code());
        String nextShortName = shortName == null ? row.shortName() : shortName;
        if (nextShortName != null && !nextShortName.isBlank()) sections.put("shortName", nextShortName);
        if (materialRole == null) sections.remove("materialRole");
        else sections.put("materialRole", materialRole);
        return sections;
    }

    private ObjectNode itemCommand(String requestId, UUID itemRef, String status, long version) {
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
        actions.put("canEdit", !"VOIDED".equals(status));
        actions.put("canEnable", "DISABLED".equals(status));
        actions.put("canDisable", "ENABLED".equals(status));
        ObjectNode voidAvailability = actions.putObject("voidAvailability");
        voidAvailability.put("canVoid", !"VOIDED".equals(status));
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
            ItemRow current,
            ObjectNode sections,
            long version,
            UnitAssignmentFacts units,
            ArrayNode orderOptionConfigs,
            CatalogIdentifierFacts.ItemReadback identifierReadback,
            JsonNode storedItemProfile,
            Map<UUID, JsonNode> optionEffects) {
        ObjectNode node = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ObjectNode result = node.putObject("result");
        ObjectNode item = result.putObject("item")
                .put("itemRef", current.ref().toString())
                .put("code", current.code())
                .put("version", version);
        UUID salesUnitRef = units.itemSales() == null ? null : units.itemSales().unitRef();
        UUID baseMeasureUnitRef =
                units.itemBase() == null ? null : units.itemBase().unitRef();
        putNullableUuid(item, "salesUnitRef", salesUnitRef);
        putNullableUuid(item, "baseMeasureUnitRef", baseMeasureUnitRef);
        setStoredUnitAssignment(
                item, "salesUnit", salesUnitRef, unitSnapshot(units.itemSales()), "ITEM_DEFAULT", units.itemSales());
        setStoredUnitAssignment(
                item,
                "baseMeasureUnit",
                baseMeasureUnitRef,
                unitSnapshot(units.itemBase()),
                "ITEM_DEFAULT",
                units.itemBase());
        JsonNode categoryRef = sections.path("categoryRef");
        if (categoryRef.isTextual() && !categoryRef.asText().isBlank()) item.put("categoryRef", categoryRef.asText());
        else item.putNull("categoryRef");
        item.set("attributeAssignments", saveAttributeAssignments(sections.path("attributeAssignments")));
        item.set(
                "orderOptionConfigs",
                orderOptionConfigs == null ? mapper.createArrayNode() : orderOptionConfigs.deepCopy());
        item.set(
                "identifiers",
                identifierReadback == null
                        ? mapper.createArrayNode()
                        : identifierReadback.itemIdentifiers().deepCopy());
        setNullableJson(item, "preparationProfile", storedItemProfile);
        ObjectNode optionProjection = mapper.createObjectNode();
        optionProjection.set(
                "orderOptionConfigs",
                orderOptionConfigs == null ? mapper.createArrayNode() : orderOptionConfigs.deepCopy());
        decoratePreparationFacts(
                current.ref(),
                optionProjection,
                identifierReadback,
                storedItemProfile,
                Map.of(),
                Map.of(),
                optionEffects == null ? Map.of() : optionEffects);
        item.set(
                "orderOptionConfigs",
                optionProjection.path("orderOptionConfigs").deepCopy());
        result.putObject("inventoryRules").putArray("nodes");
        result.putArray("productionTags");
        result.putArray("skuTransitions");
        result.put("version", version);
        node.put("version", version);
        return node;
    }

    private CatalogOwnerApi.CatalogItemSaveProjection saveProjection(
            ItemRow current,
            String code,
            CatalogInventoryShapeManifest.ShapeRule rule,
            ArrayNode skus,
            ArrayNode skuVariantDimensions,
            UnitAssignmentFacts units,
            ArrayNode orderOptionConfigs,
            Set<String> previousAssetRefs) {
        Map<String, String> productSkuRefs = new LinkedHashMap<>();
        Map<String, InventoryOwnerApi.UnitSnapshot> skuBaseMeasureUnits = new LinkedHashMap<>();
        if (skus != null)
            for (JsonNode sku : skus) {
                String skuCode = sku.path("skuCode").asText("");
                String skuRef = sku.path("productSkuRef").asText("");
                if (skuCode.isBlank() || skuRef.isBlank()) continue;
                productSkuRefs.put(skuCode, skuRef);
                try {
                    SkuUnitAssignment assignment = units.skus().get(UUID.fromString(skuRef));
                    if (assignment != null && assignment.effectiveBase() != null)
                        skuBaseMeasureUnits.put(skuCode, unitSnapshot(assignment.effectiveBase()));
                } catch (IllegalArgumentException failure) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "SKU 引用无效", failure);
                }
            }
        Map<String, String> optionValueRefs = new LinkedHashMap<>();
        if (skuVariantDimensions != null)
            for (JsonNode dimension : skuVariantDimensions)
                if (dimension.path("values").isArray())
                    for (JsonNode value : dimension.path("values")) {
                        String valueCode = value.path("valueCode").asText("");
                        String valueRef = value.path("valueRef").asText("");
                        if (!valueCode.isBlank() && !valueRef.isBlank()) optionValueRefs.put(valueCode, valueRef);
                    }
        if (orderOptionConfigs != null)
            for (JsonNode config : orderOptionConfigs)
                if (config.path("values").isArray())
                    for (JsonNode value : config.path("values")) {
                        String valueRef = value.path("definitionValueRef").asText("");
                        String valueCode = value.path("valueCode")
                                .asText(value.path("name").asText(""));
                        if (!valueRef.isBlank() && !valueCode.isBlank()) optionValueRefs.put(valueCode, valueRef);
                    }
        return new CatalogOwnerApi.CatalogItemSaveProjection(
                current.ref(),
                code,
                rule.shapeKey().name(),
                rule.measureMode(),
                productSkuRefs,
                optionValueRefs,
                unitSnapshot(units.itemBase()),
                skuBaseMeasureUnits,
                previousAssetRefs);
    }

    private Set<String> previousAssetRefs(ItemRow current, CatalogSkuFacts.ExistingSaveFacts existingSaveFacts) {
        Set<String> refs = new LinkedHashSet<>(catalogAssetRefs(json(current.sectionsJson())));
        existingSaveFacts.assetRefs().forEach(ref -> refs.add(ref.toString()));
        return Set.copyOf(refs);
    }

    private ObjectNode itemSaveReadback(
            String requestId,
            String dataNodeRef,
            String brandRef,
            String code,
            long version,
            ArrayNode skuTransitions) {
        ItemRow row = requireItemIdentity(dataNodeRef, brandRef, code);
        JsonNode sections = json(row.sectionsJson());
        ObjectNode node = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ObjectNode result = node.putObject("result");
        ObjectNode item = result.putObject("item")
                .put("itemRef", row.ref().toString())
                .put("code", row.code())
                .put("version", version);
        ItemUnitRefs storedUnitRefs = itemUnitRefsByItemRefs(List.of(row.ref())).get(row.ref());
        UUID salesUnitRef =
                storedUnitRefs == null ? nullableUuid(sections, "salesUnitRef") : storedUnitRefs.salesUnitRef();
        UUID baseMeasureUnitRef = storedUnitRefs == null
                ? nullableUuid(sections, "baseMeasureUnitRef")
                : storedUnitRefs.baseMeasureUnitRef();
        Set<UUID> unitRefs = new LinkedHashSet<>();
        if (salesUnitRef != null) unitRefs.add(salesUnitRef);
        if (baseMeasureUnitRef != null) unitRefs.add(baseMeasureUnitRef);
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions =
                unitDefinitionsForRefs(dataNodeRef, brandRef, unitRefs);
        putNullableUuid(item, "salesUnitRef", salesUnitRef);
        putNullableUuid(item, "baseMeasureUnitRef", baseMeasureUnitRef);
        setStoredUnitAssignment(
                item,
                "salesUnit",
                salesUnitRef,
                storedUnitRefs == null
                        ? sections.path("salesUnitSnapshot")
                        : mapper.valueToTree(storedUnitRefs.salesUnitSnapshot()),
                "ITEM_DEFAULT",
                unitDefinitions);
        setStoredUnitAssignment(
                item,
                "baseMeasureUnit",
                baseMeasureUnitRef,
                storedUnitRefs == null
                        ? sections.path("baseMeasureUnitSnapshot")
                        : mapper.valueToTree(storedUnitRefs.baseMeasureUnitSnapshot()),
                "ITEM_DEFAULT",
                unitDefinitions);
        JsonNode categoryRef = sections.path("categoryRef");
        if (categoryRef.isTextual() && !categoryRef.asText().isBlank()) item.put("categoryRef", categoryRef.asText());
        else item.putNull("categoryRef");
        item.set("attributeAssignments", saveAttributeAssignments(sections.path("attributeAssignments")));
        item.set(
                "orderOptionConfigs",
                sections.path("orderOptionConfigs").isArray()
                        ? sections.path("orderOptionConfigs").deepCopy()
                        : mapper.createArrayNode());
        result.putObject("inventoryRules").putArray("nodes");
        result.putArray("productionTags");
        result.set("skuTransitions", skuTransitions == null ? mapper.createArrayNode() : skuTransitions);
        result.put("version", version);
        node.put("version", version);
        return node;
    }

    private boolean hasItemDependencies(
            ItemRow row, Boolean knownHasIdentifiers, BatchStatusPreloadedFacts batchFacts) {
        JsonNode sections = json(row.sectionsJson());
        Boolean hasIdentifiers = knownHasIdentifiers;
        if (batchFacts != null && batchFacts.voidedFactsPreloaded()) {
            if (!batchFacts.identifierPresence().containsKey(row.ref())) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "item identifier readback is missing");
            }
            hasIdentifiers = batchFacts.identifierPresence().get(row.ref());
        }
        if (hasIdentifiers == null) hasIdentifiers = persistence.hasIdentifiers(row.ref());
        return sections.path("skuCount").asInt(0) > 0
                || Boolean.TRUE.equals(hasIdentifiers)
                || sections.path("productionTagRef").isTextual()
                || (sections.path("skus").isArray() && sections.path("skus").size() > 0);
    }

    private TransitionItemPrecheck recheckTransitionItemReceipt(
            String scope, String brand, String itemCode, Long expectedVersion, String targetStatus) {
        CatalogItemPersistence.TransitionItemPrecheckRow stored =
                persistence.readTransitionPrecheck(scope, brand, itemCode);
        TransitionItemPrecheck precheck =
                stored == null ? null : new TransitionItemPrecheck(itemRow(stored.item()), stored.hasIdentifiers());
        if (precheck == null) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        ItemRow current = precheck.item();
        if (expectedVersion != null
                && current.version() != expectedVersion
                && current.version() != expectedVersion + 1L) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        }

        if ("VOIDED".equals(current.status()) && !"VOIDED".equals(targetStatus)) {
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 422, "已作废商品不可修改");
        }
        return precheck;
    }

    private JsonNode requireInventoryVoidDependencies(
            String dataNodeRef, String brandRef, UUID itemRef, String requestId) {
        // spotless:off
        if (inventory == null)
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "商品库存关联暂时无法确认");

        // spotless:on
        return inventory.catalogItemVoidDependencies(dataNodeRef, brandRef, itemRef.toString(), requestId);
    }

    private ItemVoidCatalogFacts itemVoidCatalogFacts(JsonNode sections) {
        int skuCount = sections.path("skus").isArray()
                ? sections.path("skus").size()
                : sections.path("skuCount").asInt(0);
        int identifierCount = sections.path("identifiers").isArray()
                ? sections.path("identifiers").size()
                : 0;
        return new ItemVoidCatalogFacts(
                skuCount, identifierCount, sections.path("productionTagRef").isTextual());
    }

    private ArrayNode appendItemVoidBlockingReasons(
            ObjectNode voidAvailability,
            ItemRow row,
            ItemVoidCatalogFacts catalogFacts,
            List<InboundItemReference> inboundReferences,
            List<InventoryInboundVoidReference> inventoryInboundReferences) {
        ArrayNode reasons = voidAvailability.putArray("blockingReasons");
        // spotless:off
        if (catalogFacts.skuCount() > 0)
            appendVoidBlockingReason(reasons, "HAS_SKUS", catalogFacts.skuCount(), List.of());
        // spotless:on
        if (catalogFacts.identifierCount() > 0)
            appendVoidBlockingReason(reasons, "HAS_IDENTIFIERS", catalogFacts.identifierCount(), List.of());
        if (catalogFacts.hasProductionTag()) appendVoidBlockingReason(reasons, "HAS_PRODUCTION_TAG", 1, List.of());
        if (!inboundReferences.isEmpty())
            appendVoidBlockingReason(
                    reasons,
                    "USED_BY_OTHER_ITEM",
                    inboundReferences.size(),
                    inboundReferences.stream().map(InboundItemReference::name).toList());
        long inventoryBomReferenceCount = inventoryInboundReferences.stream()
                .mapToLong(InventoryInboundVoidReference::count)
                .sum();
        if (inventoryBomReferenceCount > 0)
            appendVoidBlockingReason(
                    reasons,
                    "USED_BY_INVENTORY_BOM",
                    inventoryBomReferenceCount,
                    inventoryInboundReferences.stream()
                            .map(InventoryInboundVoidReference::sourceName)
                            .toList());
        if ("VOIDED".equals(row.status())) appendVoidBlockingReason(reasons, "ALREADY_VOIDED", 1, List.of());
        return reasons;
    }

    private List<InventoryInboundVoidReference> inventoryInboundVoidReferences(JsonNode dependencies) {
        JsonNode rows = dependencies == null ? null : dependencies.path("inboundBomReferences");
        if (!rows.isArray()) {
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    503,
                    /* format-wrap */
                    "商品库存关联暂时无法确认");
        }
        List<InventoryInboundVoidReference> references = new ArrayList<>();
        for (JsonNode row : rows) {
            if (!row.isObject()
                    || !row.path("sourceName").isTextual()
                    || row.path("sourceName").asText().isBlank()
                    || !row.path("count").canConvertToLong()
                    || row.path("count").asLong() < 1) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 503, "商品库存关联暂时无法确认");
            }
            String sourceRef = row.path("sourceItemRef").asText("");
            if (sourceRef.isBlank()) sourceRef = row.path("sourceSkuRef").asText("");
            if (sourceRef.isBlank())
                sourceRef = row.path("sourceOptionValueRef").asText("");
            try {
                references.add(new InventoryInboundVoidReference(
                        UUID.fromString(sourceRef),
                        row.path("sourceName").asText(),
                        row.path("count").asLong()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        503,
                        /* format-wrap */
                        "商品库存关联暂时无法确认",
                        failure);
            }
        }
        return List.copyOf(references);
    }

    private static void appendVoidBlockingReason(
            ArrayNode reasons, String reasonCode, long count, List<String> relatedItemNames) {
        ObjectNode reason = reasons.addObject().put("reasonCode", reasonCode).put("count", count);
        ArrayNode names = reason.putArray("relatedItemNames");
        relatedItemNames.stream()
                .filter(name -> name != null && !name.isBlank())
                .forEach(names::add);
    }

    private boolean itemReferencedByOtherItems(String scope, String brand, ItemRow current) {
        return itemReferencedByOtherItems(scope, brand, current.ref());
    }

    private boolean itemReferencedByOtherItems(
            String scope, String brand, ItemRow current, BatchStatusPreloadedFacts batchFacts) {
        if (batchFacts != null && batchFacts.voidedFactsPreloaded())
            return !batchFacts
                    .inboundReferences()
                    .getOrDefault(current.ref(), List.of())
                    .isEmpty();
        return itemReferencedByOtherItems(scope, brand, current);
    }

    private boolean itemReferencedByOtherItems(String scope, String brand, UUID currentRef) {
        return !inboundItemReferences(scope, brand, currentRef).isEmpty();
    }

    private Map<UUID, List<InboundItemReference>> inboundItemReferencesByRefs(
            String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (orderedRefs.isEmpty()) return Map.of();
        Map<UUID, List<InboundItemReference>> referencesByItem = new LinkedHashMap<>();
        persistence
                .readInboundItemReferencesByRefs(scope, brand, orderedRefs)
                .forEach((itemRef, references) -> referencesByItem.put(
                        itemRef,
                        references.stream()
                                .map(value -> new InboundItemReference(value.itemRef(), value.code(), value.name()))
                                .toList()));
        return Map.copyOf(referencesByItem);
    }

    private Map<UUID, Boolean> itemIdentifierPresenceByRefs(Collection<UUID> itemRefs) {
        Map<UUID, CatalogIdentifierFacts.ItemReadback> readbacks = identifierFacts.readByItemRefs(itemRefs);
        Map<UUID, Boolean> presenceByItem = new LinkedHashMap<>();
        for (UUID itemRef : itemRefs) {
            CatalogIdentifierFacts.ItemReadback readback = readbacks.get(itemRef);
            if (readback == null) continue;
            boolean hasIdentifiers = !readback.itemIdentifiers().isEmpty()
                    || readback.skuIdentifiers().values().stream()
                            .anyMatch(values -> values != null && !values.isEmpty());
            presenceByItem.put(itemRef, hasIdentifiers);
        }
        return Map.copyOf(presenceByItem);
    }

    private List<InboundItemReference> inboundItemReferences(String scope, String brand, UUID currentRef) {
        return persistence.readInboundItemReferences(scope, brand, currentRef).stream()
                .map(value -> new InboundItemReference(value.itemRef(), value.code(), value.name()))
                .toList();
    }

    private void lockAndValidateCategoryRefs(
            String scope, String brand, JsonNode sections, JsonNode currentSections, UUID currentItemRef) {
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
        List<CategoryRow> rows = lockCategoriesForReferenceValidation(scope, brand, categoryRefs);
        Set<UUID> existingRefs = categoryRefsFromSections(currentSections);
        if (existingRefs.isEmpty()) existingRefs = categoryReferencesFromOwner(currentItemRef);
        for (CategoryRow row : rows) {
            // spotless:off
            if (!existingRefs.contains(row.ref()) && !"ENABLED".equals(row.status()))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "新绑定的分类必须处于启用状态");
            // spotless:on
        }
    }

    private Set<UUID> categoryRefsFromSections(JsonNode sections) {
        if (sections == null || sections.isNull() || sections.isMissingNode()) return Set.of();
        JsonNode refs = sections.has("categoryRef")
                ? categoryRefArray(sections.path("categoryRef"))
                : sections.path("categoryRefs");
        if (!refs.isArray()) return Set.of();
        Set<UUID> result = new LinkedHashSet<>();
        for (JsonNode ref : refs) {
            UUID value = requiredUuidValue(ref, "categoryRefs[]");
            if (value != null) result.add(value);
        }
        return Set.copyOf(result);
    }

    private Set<UUID> categoryReferencesFromOwner(UUID itemRef) {
        if (itemRef == null) return Set.of();
        ArrayNode refs = categoryFacts.readByItemRefs(List.of(itemRef)).getOrDefault(itemRef, mapper.createArrayNode());
        Set<UUID> result = new LinkedHashSet<>();
        for (JsonNode ref : refs) {
            UUID value = requiredUuidValue(ref, "categoryRefs[]");
            if (value != null) result.add(value);
        }
        return Set.copyOf(result);
    }

    private List<CategoryRow> lockCategoriesForReferenceValidation(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        List<UUID> stable = refs.stream().distinct().sorted().toList();
        List<CategoryRow> rows = persistence.lockCategoriesForReferenceValidation(scope, brand, stable).stream()
                .map(CatalogItemService::categoryRow)
                .toList();
        // spotless:off
        if (rows.size() != stable.size())
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在或已删除");
        // spotless:on
        return rows;
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

    private void validateDeclaredOpaqueReferences(
            String scope,
            String brand,
            JsonNode sections,
            JsonNode currentSections,
            UUID currentItemRef,
            Set<UUID> existingProductionTagRefs) {

        Map<String, List<String>> dictionaryRefsByKind = new LinkedHashMap<>();
        dictionaryRefsByKind.put("TAG", textRefs(sections.path("tagRefs"), "tagRefs"));
        List<String> attributeRefs = new ArrayList<>();
        JsonNode dimensions = sections.path("skuVariantDimensions");
        if (dimensions.isArray())
            for (JsonNode dimension : dimensions) {
                addRequiredUuid(attributeRefs, dimension.path("attributeRef"), "skuVariantDimensions[].attributeRef");
            }
        dictionaryRefsByKind.put("SKU_ATTRIBUTE", attributeRefs);
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
        dictionaryRefsByKind.put("SKU_ATTRIBUTE_VALUE", valueRefs);
        lockDictionaryRefsByKind(
                scope,
                brand,
                dictionaryRefsByKind,
                dictionaryReferencesFromOwner(scope, brand, currentItemRef, currentSections, dictionaryRefsByKind));
        validateProductionTagRef(scope, brand, sections, existingProductionTagRefs);
        validateCatalogRelationRefs(scope, brand, sections, currentSections, currentItemRef);
    }

    private Map<String, Set<UUID>> dictionaryRefsFromSections(JsonNode sections) {
        Map<String, Set<UUID>> result = new LinkedHashMap<>();
        result.put("TAG", parseDictionaryRefs(textRefs(sections.path("tagRefs"), "tagRefs"), "TAG"));
        List<String> attributeRefs = new ArrayList<>();
        JsonNode dimensions = sections.path("skuVariantDimensions");
        if (dimensions.isArray())
            for (JsonNode dimension : dimensions)
                addRequiredUuid(attributeRefs, dimension.path("attributeRef"), "skuVariantDimensions[].attributeRef");
        result.put("SKU_ATTRIBUTE", parseDictionaryRefs(attributeRefs, "SKU_ATTRIBUTE"));
        List<String> valueRefs = new ArrayList<>();
        if (sections.path("skus").isArray())
            for (JsonNode sku : sections.path("skus"))
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs"))
                        addRequiredUuid(
                                valueRefs,
                                value.path("attributeValueRef"),
                                "skus[].attributeValueRefs[].attributeValueRef");
        if (dimensions.isArray())
            for (JsonNode dimension : dimensions)
                if (dimension.path("values").isArray())
                    for (JsonNode value : dimension.path("values"))
                        addRequiredUuid(valueRefs, value.path("valueRef"), "skuVariantDimensions[].values[].valueRef");
        result.put("SKU_ATTRIBUTE_VALUE", parseDictionaryRefs(valueRefs, "SKU_ATTRIBUTE_VALUE"));
        return result;
    }

    private Map<String, Set<UUID>> dictionaryReferencesFromOwner(
            String scope,
            String brand,
            UUID itemRef,
            JsonNode currentSections,
            Map<String, List<String>> requestedRefsByKind) {
        Map<String, Set<UUID>> result = new LinkedHashMap<>(dictionaryRefsFromSections(currentSections));
        boolean anyRequested = requestedRefsByKind.values().stream().anyMatch(refs -> refs != null && !refs.isEmpty());
        if (!anyRequested || itemRef == null) return result;
        // requireSaveCurrent provides the immutable current relation snapshot, including an explicit empty tag array.
        // Only fall back to the owner read for legacy rows that do not carry that snapshot; never reread a relation
        // that this same save request has already hydrated.
        if (!currentSections.has("tagRefs")) {
            Map<String, JsonNode> itemReferences =
                    itemReferenceFacts.readByItemRefs(List.of(itemRef)).getOrDefault(itemRef, Map.of());
            Set<UUID> tagRefs = new LinkedHashSet<>(result.getOrDefault("TAG", Set.of()));
            JsonNode catalogTags = itemReferences.get(CatalogItemReferenceFacts.CATALOG_TAG);
            if (catalogTags != null && catalogTags.isArray())
                for (JsonNode ref : catalogTags) {
                    UUID value = requiredUuidValue(ref, "tagRefs[]");
                    if (value != null) tagRefs.add(value);
                }
            result.put("TAG", Set.copyOf(tagRefs));
        }
        Map<String, Set<UUID>> skuRefs = relationalSkuDictionaryReferencesForItem(scope, brand, itemRef);
        result.put("SKU_ATTRIBUTE", mergeRefs(result.get("SKU_ATTRIBUTE"), skuRefs.get("SKU_ATTRIBUTE")));
        result.put(
                "SKU_ATTRIBUTE_VALUE",
                mergeRefs(result.get("SKU_ATTRIBUTE_VALUE"), skuRefs.get("SKU_ATTRIBUTE_VALUE")));
        return result;
    }

    private Map<String, Set<UUID>> relationalSkuDictionaryReferencesForItem(String scope, String brand, UUID itemRef) {
        return persistence.readSkuDictionaryRefs(scope, brand, itemRef);
    }

    private Set<UUID> parseDictionaryRefs(List<String> refs, String kind) {
        Set<UUID> result = new LinkedHashSet<>();
        for (String ref : refs) {
            try {
                result.add(UUID.fromString(ref));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, kind + " reference is not a UUID", failure);
            }
        }
        return Set.copyOf(result);
    }

    private Set<UUID> existingProductionTagRef(UUID itemRef) {
        JsonNode ref = itemReferenceFacts
                .readByItemRefs(List.of(itemRef))
                .getOrDefault(itemRef, Map.of())
                .getOrDefault(CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode());
        if (ref == null || ref.isNull()) return Set.of();
        return Set.of(parseReferenceUuid(ref.asText()));
    }

    private Set<UUID> existingProductionTagRef(ItemRow current, ObjectNode request) {
        JsonNode currentSections = json(current.sectionsJson());
        if (currentSections.has("productionTagRef")) {
            JsonNode ref = currentSections.path("productionTagRef");
            // requireSaveCurrent may already have read the owner relation while hydrating an omitted tagRefs
            // member.  A canonical JSON null is an authoritative empty relation; do not issue the same read again
            // merely to rediscover that no production tag exists.
            if (ref.isNull()) return Set.of();
            if (ref.isTextual() && !ref.asText().isBlank()) return Set.of(parseReferenceUuid(ref.asText()));
        }
        return existingProductionTagRef(current.ref());
    }

    private UUID parseReferenceUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                "RESULT_UNKNOWN",
                500,
                "商品已有制作标签引用无法读取",
                failure
            );
            // spotless:on
        }
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

    private String textRef(JsonNode value, String path) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (!value.isTextual())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, path + " must be a UUID ref or null");
        try {
            return UUID.fromString(value.asText()).toString();
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, path + " cannot contain a business code", failure);
        }
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

    private void lockDictionaryRefsByKind(
            String scope,
            String brand,
            Map<String, List<String>> refsByKind,
            Map<String, Set<UUID>> existingRefsByKind) {
        List<CatalogItemPersistence.DictionaryReference> requestedReferences = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : refsByKind.entrySet()) {
            entry.getValue().stream().distinct().map(UUID::fromString).sorted().forEach(ref -> {
                requestedReferences.add(new CatalogItemPersistence.DictionaryReference(entry.getKey(), ref));
            });
        }
        if (requestedReferences.isEmpty()) return;
        Map<CatalogItemPersistence.DictionaryReference, String> statuses =
                persistence.lockDictionaryRefs(scope, brand, requestedReferences);
        for (CatalogItemPersistence.DictionaryReference requested : requestedReferences) {
            if (!statuses.containsKey(requested)) {
                String kind = requested.kind();
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, kind + " reference is not available in this owner scope");
            }
            String kind = requested.kind();
            UUID ref = requested.ref();
            boolean alreadyAttached =
                    existingRefsByKind.getOrDefault(kind, Set.of()).contains(ref);
            // spotless:off
            if (!alreadyAttached && !"ENABLED".equals(statuses.get(requested)))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "新绑定的字典项必须处于启用状态");
            // spotless:on
        }
    }

    private void validateProductionTagRef(
            String scope, String brand, JsonNode sections, Set<UUID> existingProductionTagRefs) {
        String refText = textRef(sections.path("productionTagRef"), "productionTagRef");
        if (refText == null) return;
        if (productionTags == null)
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "production tag owner API is required");
        List<UUID> requested = List.of(UUID.fromString(refText));

        Map<UUID, com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi.ProductionTagReferenceReadback> found =
                productionTags
                        .readTagReferencesByRefs(scope, brand, requested, "catalog-production-tag-validation")
                        .stream()
                        .collect(java.util.stream.Collectors.toMap(
                                com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi.ProductionTagReferenceReadback
                                        ::tagRef,
                                value -> value,
                                (left, right) -> left));
        for (UUID ref : requested) {
            var tag = found.get(ref);
            if (tag == null || "VOIDED".equals(tag.status()))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "production tag ref is not available in this owner scope");
            if ("DISABLED".equals(tag.status())
                    && (existingProductionTagRefs == null || !existingProductionTagRefs.contains(ref)))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                    "PRODUCTION_TAG_NOT_BINDABLE",
                    422,
                    "新绑定的制作标签必须处于启用状态"
                );
                // spotless:on
        }
    }

    private ArrayNode productionTagDetails(String scope, String brand, JsonNode refNode, String requestId) {
        String refText = textRef(refNode, "productionTagRef");
        ArrayNode result = mapper.createArrayNode();
        if (refText == null) return result;
        if (productionTags == null)
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "production tag owner API is required for detail projection");
        List<String> refs = List.of(refText);
        List<UUID> requested = List.of(UUID.fromString(refText));
        Map<String, com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi.ProductionTagReferenceReadback>
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
                    .put("status", tag.status())
                    .put("owner", "catalog");
        }
        return result;
    }

    private void validateCatalogRelationRefs(
            String scope, String brand, JsonNode sections, JsonNode currentSections, UUID currentItemRef) {
        List<UUID> itemRefs = new ArrayList<>();
        List<ProductSkuRelation> skuRelations = new ArrayList<>();
        collectCatalogRelationRefs(sections.path("compositeGroups"), itemRefs, skuRelations);
        List<UUID> currentItemRefs = new ArrayList<>();
        List<ProductSkuRelation> currentSkuRelations = new ArrayList<>();
        JsonNode currentCompositeGroups = currentSections.path("compositeGroups");
        if ((!currentCompositeGroups.isArray() || currentCompositeGroups.isEmpty())
                && (!itemRefs.isEmpty() || !skuRelations.isEmpty()))
            currentCompositeGroups = compositeFacts
                    .readByItemRefs(List.of(currentItemRef))
                    .getOrDefault(currentItemRef, mapper.createArrayNode());
        collectCatalogRelationRefs(currentCompositeGroups, currentItemRefs, currentSkuRelations);
        Set<UUID> existingItemRefs = Set.copyOf(currentItemRefs);
        Set<String> existingSkuRelationKeys = currentSkuRelations.stream()
                .map(this::skuRelationKey)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        List<UUID> ownSkuRefs = new ArrayList<>();
        if (sections.path("skus").isArray())
            for (JsonNode sku : sections.path("skus"))
                addRequiredUuidValue(ownSkuRefs, sku.path("productSkuRef"), "skus[].productSkuRef");
        if (itemRefs.contains(currentItemRef))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "套餐内容不能选择当前商品");
        if (!itemRefs.isEmpty()) {
            List<UUID> ids = itemRefs.stream().distinct().sorted().toList();
            Map<UUID, String> itemStatuses = persistence.readItemStatuses(scope, brand, ids);
            if (itemStatuses.size() != ids.size())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef is not available in this owner scope");
            for (UUID itemRef : ids) {
                // spotless:off
                if (!existingItemRefs.contains(itemRef) && !"ENABLED".equals(itemStatuses.get(itemRef)))
                    throw new CatalogOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED", 422, "新绑定的商品必须处于启用状态");
                // spotless:on
            }
        }
        List<UUID> validatedSkuRefs = new ArrayList<>(ownSkuRefs);
        skuRelations.forEach(relation -> validatedSkuRefs.add(relation.productSkuRef()));
        Map<UUID, SkuReferenceOwner> skuOwnerByRef = skuOwnerByRef(scope, brand, validatedSkuRefs);
        for (UUID ownSkuRef : ownSkuRefs) {
            SkuReferenceOwner owner = skuOwnerByRef.get(ownSkuRef);
            if (owner != null && !owner.itemRef().equals(currentItemRef))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "productSkuRef belongs to another item in this owner scope");
        }
        for (ProductSkuRelation relation : skuRelations) {
            SkuReferenceOwner owner = skuOwnerByRef.get(relation.productSkuRef());
            String relationKey = skuRelationKey(relation);
            boolean freshCurrentSku =
                    relation.itemRef().equals(currentItemRef) && ownSkuRefs.contains(relation.productSkuRef());
            if (owner == null && !freshCurrentSku)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "productSkuRef is not available in this owner scope");
            if (owner != null && !relation.itemRef().equals(owner.itemRef()) && !freshCurrentSku)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "productSkuRef does not belong to declared itemRef in this owner scope");
            if (!existingSkuRelationKeys.contains(relationKey)
                    && (owner == null || !"ENABLED".equals(owner.itemStatus()) || !"ENABLED".equals(owner.skuStatus())))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "新绑定的规格必须处于启用状态");
                // spotless:on
        }
    }

    private String skuRelationKey(ProductSkuRelation relation) {
        return relation.itemRef() + "\u0000" + relation.productSkuRef();
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

    private void requireSkuCodeForSkuReference(JsonNode entry) {
        if (!entry.hasNonNull("skuCode") || entry.path("skuCode").asText().isBlank()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "productSkuRef requires skuCode");
        }
    }

    private Map<UUID, SkuReferenceOwner> skuOwnerByRef(String scope, String brand, List<UUID> requestedSkuRefs) {
        List<UUID> refs = requestedSkuRefs.stream().distinct().sorted().toList();
        if (refs.isEmpty()) return Map.of();
        Map<UUID, SkuReferenceOwner> owners = new LinkedHashMap<>();
        persistence.readSkuOwners(refs, scope, brand).forEach((skuRef, value) -> {
            SkuReferenceOwner owner = new SkuReferenceOwner(value.itemRef(), value.itemStatus(), value.skuStatus());
            SkuReferenceOwner previous = owners.putIfAbsent(skuRef, owner);
            if (previous != null && !previous.itemRef().equals(owner.itemRef()))
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "productSkuRef is duplicated across items in this owner scope");
        });
        return owners;
    }

    private void appendOutboundCompositeReferences(ArrayNode references, ArrayNode compositeGroups) {
        LinkedHashSet<String> seenItemRefs = new LinkedHashSet<>();
        for (JsonNode group : compositeGroups) {
            for (JsonNode component : group.path("components")) {
                String itemRef = component.path("itemRef").asText("");
                String itemName = component.path("itemName").asText("").trim();
                String itemCode = component.path("itemCode").asText("").trim();
                if (itemRef.isBlank() || itemName.isBlank() || itemCode.isBlank())
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "套餐内容的商品关联读取失败");
                if (!seenItemRefs.add(itemRef)) continue;
                references
                        .addObject()
                        .put("referenceKind", "COMPOSITE_COMPONENT")
                        .put("referenceRef", itemRef)
                        .put("code", itemCode)
                        .put("name", itemName)
                        .put("direction", "OUTBOUND");
            }
        }
    }

    private CategorySummaryFacts categorySummaryFactsForItems(String dataNodeRef, String brandRef, List<ItemRow> rows) {
        if (rows.isEmpty()) return CategorySummaryFacts.empty();
        Map<UUID, UUID> categoryRefByItem = new LinkedHashMap<>();
        Map<UUID, List<CategoryPathNode>> pathNodesByItem = new LinkedHashMap<>();
        persistence
                .readCategorySummary(
                        dataNodeRef, brandRef, rows.stream().map(ItemRow::ref).toList())
                .forEach(value -> {
                    UUID itemRef = value.itemRef();
                    UUID categoryRef = value.categoryRef();
                    if (itemRef == null || categoryRef == null) return;
                    categoryRefByItem.putIfAbsent(itemRef, categoryRef);
                    String rawPath = value.pathJson();
                    if (rawPath == null || rawPath.isBlank()) return;
                    JsonNode path = nullableJson(rawPath, "商品分类路径读取失败");
                    // spotless:off
                    if (!path.isArray())
                        throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品分类路径读取失败");
                    // spotless:on
                    List<CategoryPathNode> nodes = new ArrayList<>();
                    for (JsonNode node : path) {
                        UUID nodeRef = nullableUuid(node, "categoryRef");
                        String code = node.path("code").asText("");
                        String name = node.path("name").asText("");
                        // spotless:off
                        if (nodeRef == null || code.isBlank() || name.isBlank())
                            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品分类路径读取失败");
                        // spotless:on
                        nodes.add(new CategoryPathNode(nodeRef, code, name));
                    }
                    if (!nodes.isEmpty()) pathNodesByItem.put(itemRef, List.copyOf(nodes));
                });
        return new CategorySummaryFacts(Map.copyOf(categoryRefByItem), Map.copyOf(pathNodesByItem));
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private ArrayNode categoryPathArray(CategorySummaryFacts facts, UUID itemRef) {
        ArrayNode result = mapper.createArrayNode();
        facts.pathNodesByItem().getOrDefault(itemRef, List.of()).forEach(node -> result.addObject()
                .put("categoryRef", node.categoryRef().toString())
                .put("code", node.code())
                .put("name", node.name()));
        return result;
    }

    private ArrayNode arrayCopy(JsonNode value) {
        if (value != null && value.isArray()) return (ArrayNode) value.deepCopy();
        return mapper.createArrayNode();
    }

    private ArrayNode saveAttributeAssignments(JsonNode value) {
        ArrayNode result = mapper.createArrayNode();
        if (value == null || !value.isArray()) return result;
        String invalidEntryMessage = "商品属性读回格式无效";
        for (JsonNode entry : value) {
            if (!entry.isObject()) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, invalidEntryMessage);
            ObjectNode copy = (ObjectNode) entry.deepCopy();
            copy.remove("selectedOptionNames");
            result.add(copy);
        }
        return result;
    }

    private ArrayNode specificationFacts(JsonNode sections) {
        JsonNode axes = sections.path("skuVariantDimensions");
        if (axes.isArray() && !axes.isEmpty()) return specificationFactsFromAxes(axes);
        Map<String, ObjectNode> byAttribute = new LinkedHashMap<>();
        JsonNode skus = sections.path("skus");
        if (skus.isArray())
            for (JsonNode sku : skus) {
                if (!sku.path("attributeValueRefs").isArray()) continue;
                for (JsonNode value : sku.path("attributeValueRefs")) {
                    String attributeRef = value.path("attributeRef").asText("");
                    String attributeCode = value.path("attributeCode").asText("");
                    String attributeName = value.path("attributeName").asText("");
                    if (attributeRef.isBlank() || attributeCode.isBlank() || attributeName.isBlank())
                        throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品规格事实读取失败");
                    ObjectNode fact = byAttribute.computeIfAbsent(attributeRef, ignored -> {
                        ObjectNode created = mapper.createObjectNode()
                                .put("attributeRef", attributeRef)
                                .put("attributeCode", attributeCode)
                                .put("attributeName", attributeName);
                        created.putArray("values");
                        return created;
                    });
                    ArrayNode values = fact.withArray("values");
                    String valueRef = value.path("attributeValueRef").asText("");
                    boolean duplicate = false;
                    for (JsonNode existing : values)
                        if (valueRef.equals(existing.path("valueRef").asText(""))) {
                            duplicate = true;
                            break;
                        }
                    if (!duplicate)
                        values.addObject()
                                .put("valueRef", valueRef)
                                .put("valueCode", value.path("valueCode").asText(""))
                                .put("valueLabel", value.path("valueLabel").asText(""))
                                .put("displayOrder", value.path("displayOrder").asInt(0))
                                .put("status", value.path("status").asText(""));
                }
            }
        ArrayNode result = mapper.createArrayNode();
        byAttribute.values().forEach(result::add);
        return result;
    }

    private ArrayNode specificationFactsFromAxes(JsonNode axes) {
        ArrayNode result = mapper.createArrayNode();
        axes.forEach(axis -> {
            ObjectNode fact = result.addObject()
                    .put("attributeRef", axis.path("attributeRef").asText(""))
                    .put("attributeCode", axis.path("attributeCode").asText(""))
                    .put("attributeName", axis.path("attributeName").asText(""));
            ArrayNode values = fact.putArray("values");
            if (axis.path("values").isArray())
                axis.path("values").forEach(value -> values.addObject()
                        .put("valueRef", value.path("valueRef").asText(""))
                        .put("valueCode", value.path("valueCode").asText(""))
                        .put("valueLabel", value.path("valueLabel").asText(""))
                        .put("displayOrder", value.path("displayOrder").asInt(0))
                        .put("status", value.path("status").asText("")));
        });
        return result;
    }

    private ObjectNode preparationFacts(
            CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTag,
            JsonNode preparationProfile,
            DerivedSkuFacts skuFacts,
            JsonNode sections) {
        ObjectNode result = mapper.createObjectNode();
        if (productionTag == null) result.putNull("productionTag");
        else
            result.putObject("productionTag")
                    .put("tagRef", productionTag.tagRef().toString())
                    .put("code", productionTag.code())
                    .put("name", productionTag.name())
                    .put("status", productionTag.status())
                    .put("owner", "catalog");
        setNullableJson(result, "profile", preparationProfile);
        result.putObject("skuVariation")
                .put("varies", skuFacts.totalCount() > 0 && skuPreparationDiffers(sections, preparationProfile));
        return result;
    }

    private ObjectNode skuPreparationFacts(
            CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTag,
            JsonNode itemProfile,
            JsonNode effectivePreparation) {
        ObjectNode result = preparationFacts(
                productionTag,
                effectivePreparation,
                new DerivedSkuFacts(0, 0, 0, List.of(), "SKU", null, null),
                mapper.createObjectNode());
        result.with("skuVariation").put("varies", !java.util.Objects.equals(itemProfile, effectivePreparation));
        return result;
    }

    private boolean skuPreparationDiffers(JsonNode sections, JsonNode itemProfile) {
        JsonNode normalizedItem = itemProfile == null || itemProfile.isNull() ? null : itemProfile;
        JsonNode skus = sections.path("skus");
        if (!skus.isArray()) return false;
        for (JsonNode sku : skus) {
            JsonNode effective = sku.path("effectivePreparation");
            JsonNode normalizedSku = effective.isMissingNode() || effective.isNull() ? null : effective;
            if (!java.util.Objects.equals(normalizedItem, normalizedSku)) return true;
        }
        return false;
    }

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
                "identifiers",
                "preparationProfile",
                "productionProfiles",
                "productionTagRef",
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

    private static String removeShortName(ObjectNode sections) {
        JsonNode shortName = sections.remove("shortName");
        if (shortName == null || shortName.isNull()) return null;
        if (!shortName.isTextual())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shortName must be text");
        String value = shortName.asText().trim();
        return value.isEmpty() ? null : value;
    }

    private Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitionsForDetail(
            String dataNodeRef, String brandRef, JsonNode sections) {
        Set<UUID> refs = new LinkedHashSet<>();
        UUID itemSalesUnitRef = nullableUuid(sections, "salesUnitRef");
        UUID itemBaseMeasureUnitRef = nullableUuid(sections, "baseMeasureUnitRef");
        if (itemSalesUnitRef != null) refs.add(itemSalesUnitRef);
        if (itemBaseMeasureUnitRef != null) refs.add(itemBaseMeasureUnitRef);
        JsonNode skus = sections.path("skus");
        if (skus.isArray())
            for (JsonNode sku : skus) {
                UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
                UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
                UUID effectiveSales = salesOverride == null ? itemSalesUnitRef : salesOverride;
                UUID effectiveBase = baseOverride == null ? itemBaseMeasureUnitRef : baseOverride;
                if (effectiveSales != null) refs.add(effectiveSales);
                if (effectiveBase != null) refs.add(effectiveBase);
            }
        return unitDefinitionsForRefs(dataNodeRef, brandRef, refs);
    }

    private Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitionsForRefs(
            String dataNodeRef, String brandRef, Collection<UUID> refs) {
        Set<UUID> requested = new LinkedHashSet<>();
        if (refs != null) refs.stream().filter(java.util.Objects::nonNull).forEach(requested::add);
        if (requested.isEmpty()) return Map.of();
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> result = new LinkedHashMap<>();
        unitDefinitionFacts.list(dataNodeRef, brandRef, true, null, null, null).forEach(unit -> {
            if (requested.contains(unit.unitRef())) result.put(unit.unitRef(), unit);
        });
        return Map.copyOf(result);
    }

    private ObjectNode itemDetail(
            ItemRow row,
            JsonNode sections,
            String dataNodeRef,
            String brandRef,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions,
            Map<UUID, List<SkuInboundReference>> inboundBySku,
            ArrayNode resolvedCompositeGroups) {
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
        item.set("categoryPath", arrayCopy(sections.path("categoryPath")));
        JsonNode productionTagRef = sections.path("productionTagRef");
        if (productionTagRef.isTextual() && !productionTagRef.asText().isBlank())
            item.put("productionTagRef", productionTagRef.asText());
        else item.putNull("productionTagRef");
        ArrayNode tagRefs = item.putArray("tagRefs");
        if (sections.path("tagRefs").isArray()) sections.path("tagRefs").forEach(value -> tagRefs.add(value.asText()));

        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(row.shapeKey());
        DerivedSkuFacts skuFacts = derivedSkuFacts(sections, rule);
        item.put("itemKind", rule.itemKind()).put("measureMode", rule.measureMode());
        UUID itemSalesUnitRef = nullableUuid(sections, "salesUnitRef");
        UUID itemBaseMeasureUnitRef = nullableUuid(sections, "baseMeasureUnitRef");
        putNullableUuid(item, "salesUnitRef", itemSalesUnitRef);
        putNullableUuid(item, "baseMeasureUnitRef", itemBaseMeasureUnitRef);
        setStoredUnitAssignment(
                item,
                "salesUnit",
                itemSalesUnitRef,
                sections.path("salesUnitSnapshot"),
                "ITEM_DEFAULT",
                unitDefinitions);
        setStoredUnitAssignment(
                item,
                "baseMeasureUnit",
                itemBaseMeasureUnitRef,
                sections.path("baseMeasureUnitSnapshot"),
                "ITEM_DEFAULT",
                unitDefinitions);
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
        if (idValues.isArray()) idValues.forEach(v -> identifiers.add(v.deepCopy()));
        ObjectNode sku = item.putObject("skuSummary")
                .put("enabledCount", skuFacts.enabledCount())
                .put("nonArchivedCount", skuFacts.nonArchivedCount())
                .put("totalCount", skuFacts.totalCount());
        ArrayNode skuDimensions = sku.putArray("dimensions");
        skuFacts.dimensions().forEach(skuDimensions::add);
        item.set("skuVariantDimensions", skuVariantDimensions(sections.path("skuVariantDimensions")));
        JsonNode productionTagFact = sections.path("productionTagFact");
        CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback = null;
        if (productionTagFact.isObject()) {
            UUID tagRef = nullableUuid(productionTagFact, "tagRef");
            if (tagRef != null)
                productionTagReadback = new CatalogProductionTagOwnerApi.ProductionTagReferenceReadback(
                        tagRef,
                        productionTagFact.path("code").asText(""),
                        productionTagFact.path("name").asText(""),
                        productionTagFact.path("status").asText(""),
                        productionTagFact.path("version").asLong(0));
        }
        item.set(
                "skus",
                skuRows(
                        sections.path("skus"),
                        dataNodeRef,
                        brandRef,
                        itemSalesUnitRef,
                        itemBaseMeasureUnitRef,
                        sections.get("preparationProfile"),
                        productionTagReadback,
                        unitDefinitions,
                        inboundBySku));
        putNullableLong(item, "standardSalePrice", sections.path("standardSalePrice"));
        item.put("priceGranularity", skuFacts.priceGranularity());
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
        item.set("specificationFacts", specificationFacts(sections));
        item.set("orderOptionFacts", arrayCopy(sections.path("orderOptionConfigs")));
        item.set("attributeFacts", arrayCopy(sections.path("attributeAssignments")));
        // The relational projection is resolved once by CatalogCompositeFacts and is shared with the root
        // read-model location.  Never reconstruct a code-only JSON copy from persisted sections here.
        item.set("compositeGroups", resolvedCompositeGroups.deepCopy());
        item.putObject("inventoryRules").putArray("nodes");
        setNullableJson(item, "preparationProfile", sections.get("preparationProfile"));
        item.set(
                "preparationFacts",
                preparationFacts(productionTagReadback, sections.get("preparationProfile"), skuFacts, sections));
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

    private void setStoredUnitAssignment(
            ObjectNode target,
            String field,
            UUID unitRef,
            JsonNode storedSnapshot,
            String inheritanceSource,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions) {
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
        CatalogOwnerApi.UnitDefinitionReadback unit = unitDefinitions.get(unitRef);
        if (unit == null) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位定义无法读取");
        }
        target.putObject(field)
                .put("unitRef", snapshotRef.toString())
                .put("code", storedSnapshot.path("code").asText())
                .put("name", storedSnapshot.path("name").asText())
                .put("unitDimension", storedSnapshot.path("unitDimension").asText())
                .put("precision", storedSnapshot.path("precision").asInt())
                .put("status", unit.status())
                .put("inheritanceSource", inheritanceSource);
    }

    private void setStoredUnitAssignment(
            ObjectNode target,
            String field,
            UUID unitRef,
            InventoryOwnerApi.UnitSnapshot snapshot,
            String inheritanceSource,
            CatalogOwnerApi.UnitDefinitionReadback unit) {
        if (unitRef == null) {
            target.putNull(field);
            return;
        }
        if (snapshot == null || unit == null || !unitRef.equals(snapshot.unitRef()))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位快照与引用不一致");
        target.putObject(field)
                .put("unitRef", snapshot.unitRef().toString())
                .put("code", snapshot.code())
                .put("name", snapshot.name())
                .put("unitDimension", snapshot.unitDimension())
                .put("precision", snapshot.precision())
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
                        .filter(sku ->
                                !Set.of("VOIDED").contains(sku.path("status").asText("ENABLED")))
                        .count()
                : 0;
        Long standardSalePriceMin = null;
        Long standardSalePriceMax = null;
        if (skus.isArray())
            for (JsonNode sku : skus) {
                if ("VOIDED".equals(sku.path("status").asText("ENABLED"))
                        || !sku.path("standardSalePrice").isIntegralNumber()) continue;
                long price = sku.path("standardSalePrice").asLong();
                standardSalePriceMin = standardSalePriceMin == null ? price : Math.min(standardSalePriceMin, price);
                standardSalePriceMax = standardSalePriceMax == null ? price : Math.max(standardSalePriceMax, price);
            }
        List<String> dimensions = new ArrayList<>();
        JsonNode axes = sections.path("skuVariantDimensions");
        if (axes.isArray())
            for (JsonNode axis : axes) dimensions.add(axis.path("attributeName").asText(""));
        // Axis names come from the owner relation when available. The SKU-derived fallback is retained only for
        // malformed/legacy rows that have SKU attributes but no axis relation.
        if (dimensions.isEmpty() && skus.isArray()) {
            LinkedHashSet<String> labels = new LinkedHashSet<>();
            for (JsonNode sku : skus)
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs")) {
                        String label = value.path("attributeName").asText("");
                        if (!label.isBlank()) labels.add(label);
                    }
            dimensions.addAll(labels);
        }
        return new DerivedSkuFacts(
                enabled,
                nonArchived,
                total,
                List.copyOf(dimensions),
                rule.priceGranularity(),
                standardSalePriceMin,
                standardSalePriceMax);
    }

    private static void copyNullableText(ObjectNode target, JsonNode source, String field) {
        if (source.hasNonNull(field)) target.put(field, source.path(field).asText());
        else target.putNull(field);
    }

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
            JsonNode node,
            String dataNodeRef,
            String brandRef,
            UUID itemSalesUnitRef,
            UUID itemBaseMeasureUnitRef,
            JsonNode itemPreparationProfile,
            CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions,
            Map<UUID, List<SkuInboundReference>> inboundBySku) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        List<JsonNode> skuNodes = new ArrayList<>();
        node.forEach(skuNodes::add);
        List<UUID> skuRefs = skuNodes.stream()
                .map(sku -> UUID.fromString(sku.path("productSkuRef").asText()))
                .toList();
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
            JsonNode identifiers = sku.path("identifiers");
            target.set("identifiers", identifiers.isArray() ? identifiers.deepCopy() : mapper.createArrayNode());
            putNullableLong(target, "standardSalePrice", sku.path("standardSalePrice"));
            target.put("isDefault", sku.path("isDefault").asBoolean(false));
            target.put("status", sku.path("status").asText("ENABLED"));
            target.put("version", sku.path("version").asLong(0));
            if (!sku.hasNonNull("updatedAt")) {

                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品规格更新时间读取失败");
            }
            target.put("updatedAt", sku.path("updatedAt").asLong());
            setNullableJson(target, "preparationOverride", sku.get("preparationOverride"));
            setNullableJson(target, "effectivePreparation", sku.get("effectivePreparation"));
            target.put("preparationSource", sku.path("preparationSource").asText("ITEM_DEFAULT"));
            JsonNode effectivePreparation =
                    sku.has("effectivePreparation") ? sku.get("effectivePreparation") : itemPreparationProfile;
            target.set(
                    "preparationFacts",
                    skuPreparationFacts(productionTagReadback, itemPreparationProfile, effectivePreparation));
            UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
            UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
            putNullableUuid(target, "salesUnitOverrideRef", salesOverride);
            putNullableUuid(target, "baseMeasureUnitOverrideRef", baseOverride);
            setStoredUnitAssignment(
                    target,
                    "salesUnit",
                    salesOverride == null ? itemSalesUnitRef : salesOverride,
                    sku.path("salesUnitSnapshot"),
                    salesOverride == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE",
                    unitDefinitions);
            setStoredUnitAssignment(
                    target,
                    "baseMeasureUnit",
                    baseOverride == null ? itemBaseMeasureUnitRef : baseOverride,
                    sku.path("baseMeasureUnitSnapshot"),
                    baseOverride == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE",
                    unitDefinitions);
            ObjectNode voidAvailability = target.putObject("voidAvailability");
            ArrayNode blockingReferences = voidAvailability.putArray("blockingReferences");
            ArrayNode dependentFacts = voidAvailability.putArray("dependentFacts");
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
            ArrayNode blockingReasons = voidAvailability.putArray("blockingReasons");
            if (!inbound.isEmpty())
                appendVoidBlockingReason(
                        blockingReasons,
                        "USED_BY_PACKAGE",
                        inbound.size(),
                        inbound.stream().map(SkuInboundReference::ownerName).toList());
            if ("VOIDED".equals(sku.path("status").asText("ENABLED")))
                appendVoidBlockingReason(blockingReasons, "ALREADY_VOIDED", 1, List.of());
            // canVoid and its business explanation are one owner judgement. Do not emit a disabled SKU action
            // without the fact that explains it to an operator.
            voidAvailability.put("canVoid", blockingReasons.isEmpty());
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

    private ItemRow requireItem(String dataNodeRef, String brandRef, String code) {
        List<ItemRow> rows = loadItems(dataNodeRef, brandRef, List.of(code));
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        return rows.get(0);
    }

    private ItemRow requireDetailItem(String dataNodeRef, String brandRef, String code) {
        // Management detail is a governance read, so a VOIDED row remains readable even though
        // ordinary candidate/list queries intentionally exclude terminal records.
        List<ItemRow> rows = loadItemIdentityRowsIncludingVoided(dataNodeRef, brandRef, List.of(code));
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        return hydrateDetailItemFacts(dataNodeRef, brandRef, rows).getFirst();
    }

    private ItemRow requireItemIdentity(String dataNodeRef, String brandRef, String code) {
        // Lifecycle/write prechecks must see the terminal state in order to return the typed
        // immutable-record problem instead of misclassifying an existing VOIDED row as absent.
        List<ItemRow> rows = loadItemIdentityRowsIncludingVoided(dataNodeRef, brandRef, List.of(code));
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        return rows.get(0);
    }

    private List<ItemRow> loadItems(String dataNodeRef, String brandRef, List<String> codes) {
        return hydrateItemFacts(persistence.loadItemsByCodes(dataNodeRef, brandRef, codes).stream()
                .map(CatalogItemService::itemRow)
                .toList());
    }

    private List<ItemRow> loadItemIdentityRowsIncludingVoided(String dataNodeRef, String brandRef, List<String> codes) {
        return persistence.loadItemIdentityRows(dataNodeRef, brandRef, codes).stream()
                .map(CatalogItemService::itemRow)
                .toList();
    }

    private CopyFactPresence copyFactPresence(Collection<UUID> itemRefs) {
        CatalogItemPersistence.CopyFactPresenceRow value = persistence.readCopyFactPresence(itemRefs);
        return new CopyFactPresence(
                value.skus(),
                value.categories(),
                value.composites(),
                value.attributes(),
                value.orderOptions(),
                value.axes(),
                value.images(),
                value.references());
    }

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
        Map<UUID, Map<String, JsonNode>> referencesByItem = itemReferenceFacts.readByItemRefs(itemRefs);
        Map<UUID, ItemUnitRefs> unitRefsByItem = itemUnitRefsByItemRefs(itemRefs);
        Map<UUID, CatalogIdentifierFacts.ItemReadback> identifiersByItem = identifierFacts.readByItemRefs(itemRefs);
        Map<UUID, JsonNode> itemProfilesByItem = preparationFacts.readItemProfiles(itemRefs);
        List<UUID> skuRefs = skusByItem.values().stream()
                .filter(java.util.Objects::nonNull)
                .flatMap(array -> java.util.stream.StreamSupport.stream(array.spliterator(), false))
                .map(sku -> nullableUuid(sku, "productSkuRef"))
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<UUID, JsonNode> skuOverridesByRef = preparationFacts.readSkuOverrides(skuRefs);
        Map<UUID, Map<UUID, JsonNode>> optionEffectsByItem = preparationFacts.readOptionEffects(itemRefs);
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
            Map<String, JsonNode> references = referencesByItem.get(row.ref());
            sections.set(
                    "productionTagRef",
                    references == null
                            ? mapper.nullNode()
                            : references.getOrDefault(CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
            sections.set(
                    "tagRefs",
                    references == null
                            ? mapper.createArrayNode()
                            : references.get(CatalogItemReferenceFacts.CATALOG_TAG));
            CatalogIdentifierFacts.ItemReadback identifierFactsForItem = identifiersByItem.get(row.ref());
            Map<UUID, ArrayNode> skuIdentifiers =
                    identifierFactsForItem == null ? Map.of() : identifierFactsForItem.skuIdentifiers();
            decoratePreparationFacts(
                    row.ref(),
                    sections,
                    identifierFactsForItem,
                    itemProfilesByItem.get(row.ref()),
                    skuIdentifiers,
                    skuOverridesByRef,
                    optionEffectsByItem.getOrDefault(row.ref(), Map.of()));
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

    private List<ItemRow> hydrateDetailItemFacts(String dataNodeRef, String brandRef, List<ItemRow> rows) {

        if (rows.isEmpty()) return rows;
        if (rows.size() != 1) {
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                "RESULT_UNKNOWN",
                500,
                "商品详情读取一次只能投影一个商品"
            );
            // spotless:on
        }

        ItemRow row = rows.getFirst();
        String shape = row.shapeKey();
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shape);
        boolean loadSkus = !"NONE".equals(rule.skuMode());
        boolean loadComposites = "COMPOSITE".equals(shape);
        boolean loadOrderOptions =
                Set.of("STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED").contains(shape);
        boolean loadAxesByShape = "REQUIRED_MATRIX".equals(rule.skuMode());
        boolean loadIdentifiers = !"BENEFIT_SHELL".equals(shape);
        boolean loadItemPreparation = preparationAllowed(shape, "ITEM");
        boolean loadSkuPreparation = preparationAllowed(shape, "SKU");
        boolean loadOptionPreparation = preparationAllowed(shape, "OPTION_VALUE");
        List<UUID> itemRefs = List.of(row.ref());

        Map<UUID, ArrayNode> skusByItem = loadSkus ? skuFacts.readByItemRefs(itemRefs) : Map.of();
        CategorySummaryFacts categoryFacts = categorySummaryFactsForItems(dataNodeRef, brandRef, rows);
        Map<UUID, ArrayNode> compositesByItem = loadComposites ? compositeFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> attributeAssignmentsByItem = itemDefinitionFacts.readAttributeAssignments(itemRefs);
        Map<UUID, ArrayNode> orderOptionConfigsByItem =
                loadOrderOptions ? itemDefinitionFacts.readOrderOptionConfigs(itemRefs) : Map.of();
        boolean loadAxes = loadAxesByShape
                || !skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()).isEmpty();
        Map<UUID, ArrayNode> axesByItem = loadAxes ? skuVariantAxisFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> imagesByItem = itemMediaFacts.readByItemRefs(itemRefs);
        Map<UUID, Map<String, JsonNode>> referencesByItem = itemReferenceFacts.readByItemRefs(itemRefs);
        Map<UUID, ItemUnitRefs> unitRefsByItem = itemUnitRefsByItemRefs(itemRefs);
        Map<UUID, CatalogIdentifierFacts.ItemReadback> identifiersByItem =
                loadIdentifiers ? identifierFacts.readByItemRefs(itemRefs) : Map.of();
        List<UUID> skuRefs = skusByItem.values().stream()
                .filter(java.util.Objects::nonNull)
                .flatMap(array -> java.util.stream.StreamSupport.stream(array.spliterator(), false))
                .map(sku -> nullableUuid(sku, "productSkuRef"))
                .filter(java.util.Objects::nonNull)
                .toList();
        boolean hasOptionValues = false;
        if (loadOptionPreparation) {
            for (JsonNode config : orderOptionConfigsByItem.getOrDefault(row.ref(), mapper.createArrayNode())) {
                if (config.path("values").isArray() && !config.path("values").isEmpty()) {
                    hasOptionValues = true;
                    break;
                }
            }
        }
        CatalogPreparationFacts.DetailReadback preparationReadback =
                (loadItemPreparation || loadSkuPreparation || hasOptionValues)
                        ? preparationFacts.readDetailFacts(itemRefs, skuRefs)
                        : CatalogPreparationFacts.DetailReadback.empty();

        ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
        sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        ArrayNode categoryRefs = mapper.createArrayNode();
        UUID categoryRef = categoryFacts.categoryRefByItem().get(row.ref());
        if (categoryRef != null) categoryRefs.add(categoryRef.toString());
        sections.set("categoryRefs", categoryRefs);
        if (categoryRefs.isEmpty()) sections.putNull("categoryRef");
        else sections.put("categoryRef", categoryRefs.get(0).asText());
        sections.set("categoryPath", categoryPathArray(categoryFacts, row.ref()));
        sections.set("compositeGroups", compositesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        sections.set(
                "attributeAssignments", attributeAssignmentsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        sections.set("orderOptionConfigs", orderOptionConfigsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        sections.set("skuVariantDimensions", axesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        sections.set("images", imagesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
        ItemUnitRefs unitRefs = unitRefsByItem.get(row.ref());
        if (unitRefs == null || unitRefs.salesUnitRef() == null) sections.putNull("salesUnitRef");
        else sections.put("salesUnitRef", unitRefs.salesUnitRef().toString());
        if (unitRefs == null || unitRefs.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
        else sections.put("baseMeasureUnitRef", unitRefs.baseMeasureUnitRef().toString());
        putNullableUnitSnapshot(sections, "salesUnitSnapshot", unitRefs == null ? null : unitRefs.salesUnitSnapshot());
        putNullableUnitSnapshot(
                sections, "baseMeasureUnitSnapshot", unitRefs == null ? null : unitRefs.baseMeasureUnitSnapshot());
        Map<String, JsonNode> references = referencesByItem.get(row.ref());
        sections.set(
                "productionTagRef",
                references == null
                        ? mapper.nullNode()
                        : references.getOrDefault(CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
        sections.set(
                "tagRefs",
                references == null
                        ? mapper.createArrayNode()
                        : references.getOrDefault(CatalogItemReferenceFacts.CATALOG_TAG, mapper.createArrayNode()));
        CatalogIdentifierFacts.ItemReadback identifierReadback = identifiersByItem.get(row.ref());
        decoratePreparationFacts(
                row.ref(),
                sections,
                identifierReadback,
                preparationReadback.itemProfiles().get(row.ref()),
                identifierReadback == null ? Map.of() : identifierReadback.skuIdentifiers(),
                preparationReadback.skuOverrides(),
                preparationReadback.optionEffects().getOrDefault(row.ref(), Map.of()));
        return List.of(new ItemRow(
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

    private void decoratePreparationFacts(
            UUID itemRef,
            ObjectNode sections,
            CatalogIdentifierFacts.ItemReadback identifierReadback,
            JsonNode itemProfile,
            Map<UUID, ArrayNode> skuIdentifiers,
            Map<UUID, JsonNode> skuOverrides,
            Map<UUID, JsonNode> optionEffects) {
        sections.set(
                "identifiers",
                identifierReadback == null
                        ? mapper.createArrayNode()
                        : identifierReadback.itemIdentifiers().deepCopy());
        setNullableJson(sections, "preparationProfile", itemProfile);
        JsonNode skusNode = sections.path("skus");
        if (skusNode.isArray()) {
            for (JsonNode node : skusNode) {
                if (!(node instanceof ObjectNode sku)) continue;
                UUID skuRef = nullableUuid(sku, "productSkuRef");
                ArrayNode identifiers = skuIdentifiers.get(skuRef);
                sku.set("identifiers", identifiers == null ? mapper.createArrayNode() : identifiers.deepCopy());
                JsonNode storedOverride = skuRef == null ? null : skuOverrides.get(skuRef);
                if (storedOverride == null) storedOverride = sku.remove("_storedPreparationOverride");
                ObjectNode override = mapper.createObjectNode();
                String mode = storedOverride != null && storedOverride.isObject()
                        ? storedOverride.path("mode").asText("INHERIT_ITEM")
                        : "INHERIT_ITEM";
                override.put("mode", mode);
                if (storedOverride != null && storedOverride.isObject() && storedOverride.has("profile"))
                    setNullableJson(override, "profile", storedOverride.get("profile"));
                else override.putNull("profile");
                sku.set("preparationOverride", override);
                JsonNode effective =
                        "OVERRIDE".equals(mode) && override.path("profile").isObject()
                                ? override.path("profile")
                                : itemProfile;
                setNullableJson(sku, "effectivePreparation", effective);
                sku.put("preparationSource", "OVERRIDE".equals(mode) ? "SKU_OVERRIDE" : "ITEM_DEFAULT");
            }
        }
        JsonNode configsNode = sections.path("orderOptionConfigs");
        if (configsNode.isArray()) {
            for (JsonNode configNode : configsNode) {
                if (!(configNode instanceof ObjectNode config)
                        || !config.path("values").isArray()) continue;
                int groupOrder = config.path("displayOrder").asInt(0);
                for (JsonNode valueNode : config.path("values")) {
                    if (!(valueNode instanceof ObjectNode value)) continue;
                    UUID valueRef = nullableUuid(value, "definitionValueRef");
                    JsonNode storedEffect = valueRef == null ? null : optionEffects.get(valueRef);
                    // The list projection already receives the normalized effect from the same relation query as the
                    // option config.  Preserve that value when this hydrator intentionally has no separate effect
                    // map; detail hydration still replaces it with the combined preparation readback.
                    if (storedEffect == null && value.has("preparationEffect")) continue;
                    if (storedEffect == null || !storedEffect.isObject()) {
                        value.putNull("preparationEffect");
                        continue;
                    }
                    value.set(
                            "preparationEffect",
                            itemDefinitionFacts.normalizedPreparationEffect(
                                    valueRef,
                                    groupOrder,
                                    value.path("displayOrder").asInt(0),
                                    storedEffect));
                }
            }
        }
    }

    private void setNullableJson(ObjectNode target, String field, JsonNode value) {
        if (value == null || value.isNull()) target.putNull(field);
        else target.set(field, value.deepCopy());
    }

    private ItemRow requireSaveCurrent(String dataNodeRef, String brandRef, ObjectNode request) {
        List<ItemRow> rows =
                loadItemIdentityRowsIncludingVoided(dataNodeRef, brandRef, List.of(required(request, "itemCode")));
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        ItemRow row = rows.getFirst();
        ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
        UUID itemRef = row.ref();
        boolean hasSkus = saveContainsField(request, "skus");
        if (!hasSkus) {
            Map<UUID, ArrayNode> values = skuFacts.readByItemRefs(List.of(itemRef));
            sections.set("skus", values.getOrDefault(itemRef, mapper.createArrayNode()));
        }
        if (!saveContainsAnyField(request, "categoryRef", "categoryRefs")) {
            ArrayNode values =
                    categoryFacts.readByItemRefs(List.of(itemRef)).getOrDefault(itemRef, mapper.createArrayNode());
            sections.set("categoryRefs", values);
            if (values.isEmpty()) sections.putNull("categoryRef");
            else sections.put("categoryRef", values.get(0).asText());
        }
        if (!saveContainsField(request, "compositeGroups"))
            sections.set(
                    "compositeGroups",
                    compositeFacts.readByItemRefs(List.of(itemRef)).getOrDefault(itemRef, mapper.createArrayNode()));
        if (!saveContainsField(request, "attributeAssignments"))
            sections.set(
                    "attributeAssignments",
                    itemDefinitionFacts
                            .readAttributeAssignments(List.of(itemRef))
                            .getOrDefault(itemRef, mapper.createArrayNode()));
        if (!saveContainsField(request, "orderOptionConfigs"))
            sections.set(
                    "orderOptionConfigs",
                    itemDefinitionFacts
                            .readOrderOptionConfigs(List.of(itemRef))
                            .getOrDefault(itemRef, mapper.createArrayNode()));
        if (!saveContainsField(request, "skuVariantDimensions"))
            sections.set(
                    "skuVariantDimensions",
                    skuVariantAxisFacts
                            .readByItemRefs(List.of(itemRef))
                            .getOrDefault(itemRef, mapper.createArrayNode()));
        if (!saveContainsField(request, "images") || !saveContainsField(request, "skus"))
            sections.set(
                    "images",
                    itemMediaFacts.readByItemRefs(List.of(itemRef)).getOrDefault(itemRef, mapper.createArrayNode()));
        // The current relation projection is needed for disabled-reference exemption and is shared by all later
        // validation helpers.  Hydrate it from the owner only when the persisted row does not already carry it; the
        // submitted PATCH fields are merged later in saveItem and therefore do not justify a second read here.
        if (!sections.has("productionTagRef") || !sections.has("tagRefs")) {
            Map<String, JsonNode> values =
                    itemReferenceFacts.readByItemRefs(List.of(itemRef)).getOrDefault(itemRef, Map.of());
            // This is a snapshot of the current aggregate, not the submitted draft.  Keep both canonical relation
            // members on the snapshot so production-tag and dictionary validation reuse the same owner read.
            sections.set(
                    "productionTagRef",
                    values.getOrDefault(CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
            sections.set(
                    "tagRefs", values.getOrDefault(CatalogItemReferenceFacts.CATALOG_TAG, mapper.createArrayNode()));
        }
        if (!saveContainsField(request, "salesUnitRef") || !saveContainsField(request, "baseMeasureUnitRef")) {
            ItemUnitRefs units = itemUnitRefsByItemRefs(List.of(itemRef)).get(itemRef);
            if (!saveContainsField(request, "salesUnitRef")) {
                if (units == null || units.salesUnitRef() == null) sections.putNull("salesUnitRef");
                else sections.put("salesUnitRef", units.salesUnitRef().toString());
                putNullableUnitSnapshot(
                        sections, "salesUnitSnapshot", units == null ? null : units.salesUnitSnapshot());
            }
            if (!saveContainsField(request, "baseMeasureUnitRef")) {
                if (units == null || units.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
                else
                    sections.put(
                            "baseMeasureUnitRef", units.baseMeasureUnitRef().toString());
                putNullableUnitSnapshot(
                        sections, "baseMeasureUnitSnapshot", units == null ? null : units.baseMeasureUnitSnapshot());
            }
        }
        boolean identifiersSubmitted = saveContainsField(request, "identifiers");
        boolean preparationProfileSubmitted = saveContainsField(request, "preparationProfile");
        boolean orderOptionConfigsSubmitted = saveContainsField(request, "orderOptionConfigs");
        boolean preservePreparationFacts =
                !identifiersSubmitted || !preparationProfileSubmitted || !hasSkus || !orderOptionConfigsSubmitted;
        if (preservePreparationFacts) {
            CatalogIdentifierFacts.ItemReadback currentIdentifiers =
                    identifierFacts.readByItemRefs(List.of(itemRef)).get(itemRef);
            List<UUID> currentSkuRefs = new ArrayList<>();
            if (!hasSkus) {
                sections.path("skus").forEach(sku -> {
                    UUID skuRef = nullableUuid(sku, "productSkuRef");
                    if (skuRef != null) currentSkuRefs.add(skuRef);
                });
            }

            decoratePreparationFacts(
                    itemRef,
                    sections,
                    currentIdentifiers,
                    preparationFacts.readItemProfiles(List.of(itemRef)).get(itemRef),
                    currentIdentifiers == null ? Map.of() : currentIdentifiers.skuIdentifiers(),
                    preparationFacts.readSkuOverrides(currentSkuRefs),
                    orderOptionConfigsSubmitted
                            ? Map.of()
                            : preparationFacts
                                    .readOptionEffects(List.of(itemRef))
                                    .getOrDefault(itemRef, Map.of()));
        }
        return new ItemRow(
                row.ref(),
                row.code(),
                row.name(),
                row.shortName(),
                row.shapeKey(),
                row.status(),
                canonicalJson(sections),
                row.version(),
                row.updatedAt(),
                row.sourceScopeRef());
    }

    private boolean saveContainsAnyField(ObjectNode request, String... fields) {
        for (String field : fields) if (saveContainsField(request, field)) return true;
        return false;
    }

    private boolean saveContainsField(ObjectNode request, String field) {
        JsonNode sections = request.path("sections");
        if (!sections.isObject()) return false;
        if (sections.has(field)) return true;
        JsonNode draft = sections.path("catalogDraft");
        return draft.isObject() && draft.has(field);
    }

    private boolean hasArrayEntries(JsonNode value) {
        return value != null && value.isArray() && value.size() > 0;
    }

    private boolean hasSkuMedia(ArrayNode skus) {
        if (skus == null) return false;
        for (JsonNode sku : skus) if (hasArrayEntries(sku.path("mediaRefs"))) return true;
        return false;
    }

    private SaveFactPresence saveFactPresence(UUID itemRef) {
        CatalogItemPersistence.SaveFactPresenceRow value = persistence.readSaveFactPresence(itemRef);
        return new SaveFactPresence(
                value.identifiers(),
                value.itemProfile(),
                value.skuOverrides(),
                value.skuMedia(),
                value.categories(),
                value.composites(),
                value.attributes(),
                value.orderOptions(),
                value.optionEffects(),
                value.axes(),
                value.images(),
                value.references());
    }

    private Map<UUID, ItemUnitRefs> itemUnitRefsByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        Map<UUID, ItemUnitRefs> result = new LinkedHashMap<>();
        persistence
                .readItemUnitRefs(itemRefs)
                .forEach((itemRef, value) -> result.put(
                        itemRef,
                        new ItemUnitRefs(
                                value.salesUnitRef(),
                                unitSnapshot(
                                        value.salesUnitRef(),
                                        value.salesUnitCode(),
                                        value.salesUnitName(),
                                        value.salesUnitDimension(),
                                        value.salesUnitPrecision()),
                                value.baseMeasureUnitRef(),
                                unitSnapshot(
                                        value.baseMeasureUnitRef(),
                                        value.baseMeasureUnitCode(),
                                        value.baseMeasureUnitName(),
                                        value.baseMeasureUnitDimension(),
                                        value.baseMeasureUnitPrecision()))));
        return result;
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(
            UUID ref, String code, String name, String dimension, Integer precision) {
        return ref == null
                ? null
                : new InventoryOwnerApi.UnitSnapshot(ref, code, name, dimension, precision == null ? 0 : precision);
    }

    private Set<UUID> unitReferences(JsonNode node) {
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        collectUnitReferences(node, null, result);
        return Set.copyOf(result);
    }

    private Set<UUID> unitReferencesFromOwner(String scope, String brand, UUID itemRef) {
        if (itemRef == null) return Set.of();
        return Set.copyOf(persistence.unitReferences(scope, brand, itemRef));
    }

    private Set<UUID> mergeRefs(Set<UUID> first, Set<UUID> second) {
        LinkedHashSet<UUID> merged = new LinkedHashSet<>();
        if (first != null) merged.addAll(first);
        if (second != null) merged.addAll(second);
        return Set.copyOf(merged);
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

    private static int parsePageSize(ObjectNode request, String key, int fallback) {
        try {
            return CollectionRequestSupport.pageSize(request, key, fallback);
        } catch (CollectionRequestSupport.InvalidRequestValue failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, failure.getMessage(), failure);
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
        String[] components = new String[parts.length + 1];
        components[0] = operationId;
        System.arraycopy(parts, 0, components, 1, parts.length);
        return CanonicalCursorIdentity.encode(components);
    }

    private ObjectNode receiptRequest(ObjectNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String dataNodeRef, String key, String operationId, ObjectNode request) {
        AdvisoryLock.acquire(jdbc, "catalog-receipt", dataNodeRef, key);
        List<Receipt> rows = persistence.readReceipt(dataNodeRef, key).stream()
                .map(value -> new Receipt(value.operationId(), value.requestHash(), json(value.responseJson())))
                .toList();
        if (rows.isEmpty()) return null;
        Receipt receipt = rows.get(0);
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request)))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return receipt.response();
    }

    private void saveReceipt(String scope, String key, String op, ObjectNode request, JsonNode response) {
        persistence.writeReceipt(scope, key, op, hash(request), canonicalJson(response), now());
    }

    private long generation(String dataNodeRef, String brandRef) {
        return persistence.generation(dataNodeRef, brandRef);
    }

    private static void requireScope(String dataNodeRef, String brandRef) {
        if (dataNodeRef == null || dataNodeRef.isBlank() || brandRef == null || brandRef.isBlank())
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
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
        return CollectionRequestSupport.optional(request, key);
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

    private List<String> stringValues(JsonNode values) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        values.forEach(value -> {
            if (value.isTextual() && !value.asText().isBlank()) result.add(value.asText());
        });
        if (result.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "copy closure is required");
        return List.copyOf(result);
    }

    private static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys)
            if (node.path(key).isValueNode() && !node.path(key).asText().isBlank())
                return node.path(key).asText();
        return null;
    }

    private record InventoryInboundVoidReference(UUID sourceRef, String sourceName, long count) {}

    private record ItemVoidCatalogFacts(int skuCount, int identifierCount, boolean hasProductionTag) {
        private boolean hasDependentFacts() {
            return skuCount > 0 || identifierCount > 0 || hasProductionTag;
        }
    }

    private record CategoryPathNode(UUID categoryRef, String code, String name) {}

    private record CategorySummaryFacts(
            Map<UUID, UUID> categoryRefByItem, Map<UUID, List<CategoryPathNode>> pathNodesByItem) {
        static CategorySummaryFacts empty() {
            return new CategorySummaryFacts(Map.of(), Map.of());
        }
    }

    private record SkuCandidateRow(
            ObjectNode value,
            int displayOrder,
            String skuCode,
            UUID productSkuRef,
            long total,
            JsonNode itemPreparationProfile,
            JsonNode skuPreparationOverride,
            UUID productionTagRef,
            boolean itemExists) {}

    private record DerivedSkuFacts(
            int enabledCount,
            int nonArchivedCount,
            int totalCount,
            List<String> dimensions,
            String priceGranularity,
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

    private static ItemRow itemRow(CatalogItemPersistence.ItemRow row) {
        return new ItemRow(
                row.ref(),
                row.code(),
                row.name(),
                row.shortName(),
                row.shapeKey(),
                row.status(),
                row.sectionsJson(),
                row.version(),
                row.updatedAt(),
                row.sourceScopeRef());
    }

    private static CategoryRow categoryRow(CatalogItemPersistence.CategoryRow row) {
        return new CategoryRow(
                row.ref(),
                row.code(),
                row.name(),
                row.parentCode(),
                row.parentCategoryRef(),
                row.status(),
                row.version(),
                row.displayOrder());
    }

    private record TransitionItemPrecheck(ItemRow item, Boolean hasIdentifiers) {}

    private record CopyFactPresence(
            boolean skus,
            boolean categories,
            boolean composites,
            boolean attributes,
            boolean orderOptions,
            boolean axes,
            boolean images,
            boolean references) {}

    private record SaveFactPresence(
            boolean identifiers,
            boolean itemProfile,
            boolean skuOverrides,
            boolean skuMedia,
            boolean categories,
            boolean composites,
            boolean attributes,
            boolean orderOptions,
            boolean optionEffects,
            boolean axes,
            boolean images,
            boolean references) {}

    private record BatchStatusCandidate(ItemRow item, String dataNodeRef, String brandRef) {}

    private record BatchStatusPreloadedFacts(
            Map<UUID, ItemRow> scopedItems,
            Map<UUID, String> itemCodes,
            Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> inventoryDependencies,
            Map<UUID, List<InboundItemReference>> inboundReferences,
            Map<UUID, Boolean> identifierPresence,
            boolean voidedFactsPreloaded) {}

    private record ItemUnitRefs(
            UUID salesUnitRef,
            InventoryOwnerApi.UnitSnapshot salesUnitSnapshot,
            UUID baseMeasureUnitRef,
            InventoryOwnerApi.UnitSnapshot baseMeasureUnitSnapshot) {}

    private record DetailInboundFacts(
            Map<UUID, List<SkuInboundReference>> bySku, List<InboundItemReference> byItem, long generation) {}

    private record CatalogCoordinationSnapshot(ItemRow current, CategoryRow category) {}

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

    private record InboundItemReference(UUID itemRef, String code, String name) {}

    private record SkuTransitionRequest(UUID skuRef, String targetStatus, long expectedVersion) {}

    private record SkuInboundReference(UUID componentRef, UUID ownerItemRef, String ownerCode, String ownerName) {}

    private record SkuReferenceOwner(UUID itemRef, String itemStatus, String skuStatus) {}

    private record ProductSkuRelation(UUID itemRef, UUID productSkuRef) {}

    private interface CatalogObject {
        String objectType();

        String code();

        String name();

        long version();
    }

    private record SaveItemResult(JsonNode response, CatalogOwnerApi.CatalogItemSaveProjection projection) {}

    private record UnitAssignmentFacts(
            CatalogOwnerApi.UnitDefinitionReadback itemSales,
            CatalogOwnerApi.UnitDefinitionReadback itemBase,
            Map<UUID, SkuUnitAssignment> skus) {}

    private record SkuUnitAssignment(
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,
            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback effectiveSales,
            CatalogOwnerApi.UnitDefinitionReadback effectiveBase) {}

    private record TemporaryPromotionSourceFacts(
            ObjectNode sections, CatalogItemDefinitionFacts.TemporaryPromotionFacts definitionFacts) {}

    private record PromotionExecution(ObjectNode response, CatalogTemporaryPromotionProjection projection) {}

    private record Receipt(String operationId, String requestHash, JsonNode response) {}
}
