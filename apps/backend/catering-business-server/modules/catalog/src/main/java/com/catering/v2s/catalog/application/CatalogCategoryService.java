package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.catalog.application.persistence.CatalogCategoryPersistence;
import com.catering.v2s.catalog.application.persistence.CatalogCategoryPersistence.CategoryMoveDepths;
import com.catering.v2s.catalog.application.persistence.CatalogCategoryPersistence.CategoryRow;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.CollectionRequestSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of Catalog category hierarchy facts, commands, locks, receipts, and authoritative readback. */
@Service
public class CatalogCategoryService {
    private static final int CATALOG_CATEGORY_MAX_DEPTH = 3;
    private static final String CATEGORY_MOVE_SELF_MESSAGE = "分类不能以自身作为父分类";
    private static final String CATEGORY_MOVE_CYCLE_MESSAGE = "分类不能移动到自身或下级分类下";
    private static final String CATEGORY_DEPTH_ERROR_CODE = "CATEGORY_DEPTH_EXCEEDED";
    private static final String CATEGORY_DEPTH_EXCEEDED_MESSAGE = "商品分类最多只能建立三级";
    private static final String CATEGORY_MOVE_BOUNDARY_MESSAGE = "分类已位于当前层级边界";
    private static final String CATEGORY_MOVE_ACTION_MESSAGE = "分类移动方式不支持";

    private final CatalogCategoryPersistence persistence;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    @Autowired
    public CatalogCategoryService(CatalogCategoryPersistence persistence, ObjectMapper mapper, TimeProvider time) {
        this.persistence = persistence;
        this.mapper = mapper;
        this.time = time;
    }

    CatalogCategoryService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this(new CatalogCategoryPersistence(jdbc, mapper, time), mapper, time);
    }

    @Transactional
    public CatalogOwnerApi.CategoryReadback createCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "createOperationsCatalogCategory");
        ObjectNode request =
                mapper.createObjectNode().put("code", command.code()).put("name", command.name());
        putNullableUuid(request, "parentCategoryRef", command.parentCategoryRef());
        JsonNode result = executeCategoryWrite(
                "createOperationsCatalogCategory",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        return createdCategoryReadback(categoryCommandRow(result));
    }

    @Transactional
    public CatalogOwnerApi.CategoryReadback updateCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "updateOperationsCatalogCategory");
        String dataNodeRef = scope.dataNodeId().toString();
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("name", command.name());
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            return updateTypedCategory(
                    dataNodeRef, scope.brandRef(), command, idempotencyKey, receiptRequest(request, scope.brandRef()));
        }
    }

    @Transactional
    public CatalogOwnerApi.CategoryReadback moveCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryMoveCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "moveOperationsCatalogCategory");
        String dataNodeRef = scope.dataNodeId().toString();
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("action", command.action().name());
        putNullableUuid(request, "parentCategoryRef", command.parentCategoryRef());
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            return moveTypedCategory(
                    dataNodeRef, scope.brandRef(), command, idempotencyKey, receiptRequest(request, scope.brandRef()));
        }
    }

    @Transactional
    public CatalogOwnerApi.CategoryReadback transitionCategoryStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "transitionOperationsCatalogCategoryStatus");
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("targetStatus", command.targetStatus());
        JsonNode result = executeCategoryWrite(
                "transitionOperationsCatalogCategoryStatus",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        return categoryReadback(scope.dataNodeId().toString(), scope.brandRef(), categoryCommandRow(result));
    }

    JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        String operationId = context.operationToken().operationId();
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(context, operationId);
        return executeCategoryWrite(
                operationId,
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
    }

    private ObjectNode updateCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        CategoryRow current = lockCategory(dataNodeRef, brandRef, categoryRef);
        requireCategoryVersion(current, expected);
        persistence.updateName(categoryRef, required(request, "name"), now());
        return categoryCommand(requestId, category(dataNodeRef, brandRef, categoryRef));
    }

    private ObjectNode moveCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        String action = required(request, "action");
        // Acquire the scope-wide hierarchy guard before any row lock. Reparent may subsequently lock a target
        // subtree, so reversing this order would make two concurrent reparent commands deadlock.
        lockCategoryHierarchy(dataNodeRef, brandRef);
        CategoryRow current = lockCategory(dataNodeRef, brandRef, categoryRef);
        if (!categoryRef.equals(current.ref())) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
        requireCategoryVersion(current, expected);
        CategoryRow updated;
        switch (action) {
            case "REPARENT" -> {
                UUID parentCategoryRef = optionalUuid(request, "parentCategoryRef");
                if (categoryRef.equals(parentCategoryRef))
                    throw new CatalogOwnerApi.Problem("HIERARCHY_CYCLE", 422, "分类不能以自身作为父分类");
                if (parentCategoryRef != null) {
                    // The scope hierarchy lock and complete subtree lock make the cycle and three-level
                    // checks one current fact; neither UI candidates nor a prior read authorizes the write.
                    List<UUID> subtree = categorySubtreeRefs(dataNodeRef, brandRef, categoryRef);
                    lockCategories(dataNodeRef, brandRef, subtree);
                    if (subtree.contains(parentCategoryRef))
                        // spotless:off
                        throw new CatalogOwnerApi.Problem(
                            "HIERARCHY_CYCLE",
                            422,
                            "分类不能移动到自身或下级分类下"
                        );
                        // spotless:on
                    assertCategoryMoveDepth(
                            dataNodeRef,
                            brandRef,
                            requireCategoryParent(dataNodeRef, brandRef, parentCategoryRef),
                            categoryRef);
                } else {
                    assertCategoryMoveDepth(dataNodeRef, brandRef, null, categoryRef);
                }
                List<CategoryRow> currentSiblings =
                        lockCategorySiblings(dataNodeRef, brandRef, current.parentCategoryRef());
                List<CategoryRow> targetSiblings =
                        java.util.Objects.equals(current.parentCategoryRef(), parentCategoryRef)
                                ? currentSiblings
                                : lockCategorySiblings(dataNodeRef, brandRef, parentCategoryRef);
                int nextDisplayOrder = targetSiblings.stream()
                                .mapToInt(CategoryRow::displayOrder)
                                .max()
                                .orElse(-1)
                        + 1;
                persistence.reparent(categoryRef, parentCategoryRef, nextDisplayOrder, now());
                updated = new CategoryRow(
                        current.ref(),
                        current.code(),
                        current.name(),
                        null,
                        parentCategoryRef,
                        current.status(),
                        current.version() + 1L,
                        nextDisplayOrder);
            }
            case "UP", "DOWN" -> updated = moveCategoryAmongSiblings(dataNodeRef, brandRef, current, action);
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "category move action is not supported");
        }
        return categoryCommand(requestId, updated);
    }

    private void assertCategoryMoveDepth(String scope, String brand, CategoryRow parent, UUID movingCategoryRef) {
        int targetDepth;
        int movingSubtreeDepth;
        if (parent == null) {
            targetDepth = 0;
            movingSubtreeDepth = categorySubtreeDepth(scope, brand, movingCategoryRef);
        } else {
            CategoryMoveDepths depths = categoryMoveDepths(scope, brand, parent.ref(), movingCategoryRef);
            targetDepth = depths.targetDepth();
            movingSubtreeDepth = depths.movingSubtreeDepth();
        }
        if (targetDepth + movingSubtreeDepth > CATALOG_CATEGORY_MAX_DEPTH) {
            throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "商品分类最多只能建立三级");
        }
    }

    private CategoryMoveDepths categoryMoveDepths(
            String scope, String brand, UUID parentCategoryRef, UUID movingCategoryRef) {
        return persistence.readMoveDepths(scope, brand, parentCategoryRef, movingCategoryRef);
    }

    private int categorySubtreeDepth(String scope, String brand, UUID rootCategoryRef) {
        return persistence.readSubtreeDepth(scope, brand, rootCategoryRef);
    }

    private CategoryRow moveCategoryAmongSiblings(String scope, String brand, CategoryRow current, String action) {
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
        persistence.updateSiblingOrder(current.ref(), neighbor.displayOrder(), now);
        persistence.updateSiblingOrder(neighbor.ref(), current.displayOrder(), now);
        return new CategoryRow(
                current.ref(),
                current.code(),
                current.name(),
                current.parentCode(),
                current.parentCategoryRef(),
                current.status(),
                current.version() + 1L,
                neighbor.displayOrder());
    }

    private List<CategoryRow> lockCategories(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        return persistence.lockCategories(scope, brand, refs);
    }

    private List<CategoryRow> lockCategorySiblings(String scope, String brand, UUID parentCategoryRef) {
        return persistence.lockSiblings(scope, brand, parentCategoryRef);
    }

    private List<UUID> categorySubtreeRefs(String scope, String brand, UUID rootCategoryRef) {
        return persistence.subtreeRefs(scope, brand, rootCategoryRef);
    }

    private JsonNode executeCategoryWrite(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if ("updateOperationsCatalogCategory".equals(operationId)) {
            CategoryRow current = lockCategory(dataNodeRef, brandRef, requiredUuid(request, "categoryRef"));
            long expected = requiredLong(request, "expectedVersion", -1);
            if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
            }
        }
        if ("moveOperationsCatalogCategory".equals(operationId)) {
            lockCategoryHierarchy(dataNodeRef, brandRef);
            CategoryRow current = lockCategory(dataNodeRef, brandRef, requiredUuid(request, "categoryRef"));
            long expected = requiredLong(request, "expectedVersion", -1);
            if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
            }
        }
        if ("transitionOperationsCatalogCategoryStatus".equals(operationId)) {
            CategoryRow current =
                    lockCategoryIncludingVoided(dataNodeRef, brandRef, requiredUuid(request, "categoryRef"));
            long expected = requiredLong(request, "expectedVersion", -1);
            if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
            }
        }
        ObjectNode receiptRequest = receiptRequest(request, brandRef);
        if (!receiptKey.isEmpty()) {
            JsonNode replay = replay(dataNodeRef, receiptKey, operationId, receiptRequest);
            if (replay != null) return replay;
        }
        try (var ownerCommand =
                com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result =
                    switch (operationId) {
                        case "createOperationsCatalogCategory" -> createCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "updateOperationsCatalogCategory" -> updateCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "moveOperationsCatalogCategory" -> moveCategory(dataNodeRef, brandRef, requestId, request);
                        case "transitionOperationsCatalogCategoryStatus" -> transitionCategoryStatus(
                                dataNodeRef, brandRef, requestId, request);
                        default -> throw new CatalogOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "catalog category write operation is not registered");
                    };
            if (!receiptKey.isEmpty()) saveReceipt(dataNodeRef, receiptKey, operationId, receiptRequest, result);
            return result;
        }
    }

    private ObjectNode createCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "code");
        String name = required(request, "name");
        UUID parentCategoryRef = optionalUuid(request, "parentCategoryRef");
        lockCategoryHierarchy(dataNodeRef, brandRef);
        if (parentCategoryRef != null) {
            assertCategoryChildDepth(
                    dataNodeRef, brandRef, requireCategoryParent(dataNodeRef, brandRef, parentCategoryRef));
        }
        UUID categoryRef = UUID.randomUUID();
        try {
            persistence.insertCategory(
                    categoryRef,
                    dataNodeRef,
                    brandRef,
                    code,
                    name,
                    parentCategoryRef,
                    nextCategoryDisplayOrder(dataNodeRef, brandRef, parentCategoryRef),
                    now());
        } catch (DuplicateKeyException ex) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "分类编码已存在", ex);
        }
        return categoryCommand(requestId, category(dataNodeRef, brandRef, categoryRef));
    }
    /**
     * The typed category-update command owns one atomic fact: the locked category, its receipt decision, the CAS write,
     * and the persisted readback. The legacy JSON command path remains below for the generic owner dispatcher; public
     * M1 traffic must not pay for that path's precheck/replay/readback round trips.
     */
    private CatalogOwnerApi.CategoryReadback updateTypedCategory(
            String scope,
            String brand,
            CatalogOwnerApi.CategoryUpdateCommand command,
            String idempotencyKey,
            ObjectNode receiptRequest) {
        String key = idempotencyKey == null ? "" : idempotencyKey.trim();
        String name = required(receiptRequest, "name");
        String operation = "updateOperationsCatalogCategory";
        String requestHash = hash(receiptRequest);
        CatalogCategoryPersistence.TypedCategoryUpdateRow row =
                persistence.executeTypedUpdate(scope, brand, command, key, name, operation, requestHash);
        if (row.currentCategoryRef() == null) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
        if (row.currentVersion() != command.expectedVersion() && row.currentVersion() != command.expectedVersion() + 1L)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
        if (row.replayResponse() != null
                && (!operation.equals(row.receiptOperation()) || !requestHash.equals(row.receiptHash())))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        String response = row.replayResponse() == null ? row.writtenResponse() : row.replayResponse();
        if (response == null) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
        try {
            return mapper.readValue(response, CatalogOwnerApi.CategoryReadback.class);
        } catch (Exception failure) {
            String reason = "分类幂等回执与当前结果不兼容";
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, reason, failure);
        }
    }

    /**
     * A category move has one current hierarchy fact: receipt ownership, the hierarchy guard, every candidate row, the
     * move validation, the write and its readback must be decided together. The public typed command therefore cannot
     * reuse the generic JSON dispatcher, whose precheck/replay/body/readback sequence is multiple SQL trips.
     */
    private CatalogOwnerApi.CategoryReadback moveTypedCategory(
            String scope,
            String brand,
            CatalogOwnerApi.CategoryMoveCommand command,
            String idempotencyKey,
            ObjectNode receiptRequest) {
        String key = idempotencyKey == null ? "" : idempotencyKey.trim();
        String operation = "moveOperationsCatalogCategory";
        String requestHash = hash(receiptRequest);
        CatalogCategoryPersistence.TypedCategoryMoveRow row =
                persistence.executeTypedMove(scope, brand, command, key, operation, requestHash);
        if (row.validationCode() != null) throw typedCategoryMoveProblem(row.validationCode());
        if (row.currentCategoryRef() == null) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
        if (row.currentVersion() != command.expectedVersion() && row.currentVersion() != command.expectedVersion() + 1L)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
        if (row.replayResponse() != null
                && (!operation.equals(row.receiptOperation()) || !requestHash.equals(row.receiptHash())))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        String response = row.replayResponse() == null ? row.writtenResponse() : row.replayResponse();
        if (response == null) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
        try {
            return mapper.readValue(response, CatalogOwnerApi.CategoryReadback.class);
        } catch (Exception failure) {
            String reason = "分类幂等回执与当前结果不兼容";
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, reason, failure);
        }
    }

    private CatalogOwnerApi.Problem typedCategoryMoveProblem(String code) {
        return switch (code) {
            case "NOT_FOUND" -> new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
            case "VERSION_CONFLICT" -> new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
            case "HIERARCHY_SELF" -> categoryMoveProblem("HIERARCHY_CYCLE", CATEGORY_MOVE_SELF_MESSAGE);
            case "HIERARCHY_CYCLE" -> categoryMoveProblem("HIERARCHY_CYCLE", CATEGORY_MOVE_CYCLE_MESSAGE);
            case CATEGORY_DEPTH_ERROR_CODE -> categoryDepthExceededProblem();
            case "MOVE_BOUNDARY" -> moveBoundaryProblem();
            default -> categoryMoveProblem("VALIDATION_ERROR", CATEGORY_MOVE_ACTION_MESSAGE);
        };
    }

    private CatalogOwnerApi.Problem categoryMoveProblem(String code, String message) {
        return new CatalogOwnerApi.Problem(code, 422, message);
    }

    private CatalogOwnerApi.Problem categoryDepthExceededProblem() {
        return categoryMoveProblem(CATEGORY_DEPTH_ERROR_CODE, CATEGORY_DEPTH_EXCEEDED_MESSAGE);
    }

    private CatalogOwnerApi.Problem moveBoundaryProblem() {
        return categoryMoveProblem("MOVE_BOUNDARY", CATEGORY_MOVE_BOUNDARY_MESSAGE);
    }

    private ObjectNode transitionCategoryStatus(
            String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        String target = required(request, "targetStatus");
        if (!Set.of("ENABLED", "DISABLED", "VOIDED").contains(target))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "分类状态不合法");
        CategoryRow current = lockCategoryIncludingVoided(dataNodeRef, brandRef, categoryRef);
        if ("VOIDED".equals(current.status()))
            throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废的分类不可修改");
        requireCategoryVersion(current, expected);
        if ("VOIDED".equals(target)) {
            List<String> blockingItems = categoryReferencedItems(
                    dataNodeRef, brandRef, categorySubtreeRefsIncludingVoided(dataNodeRef, brandRef, categoryRef));
            if (!blockingItems.isEmpty())
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID", 422, "分类或其子分类仍被商品引用，不能作废");
                // spotless:on
        }
        if (persistence.transitionStatus(dataNodeRef, brandRef, categoryRef, target, now(), expected) != 1)
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
        return categoryCommand(requestId, categoryIncludingVoided(dataNodeRef, brandRef, categoryRef));
    }

    private CatalogOwnerApi.CategoryReadback categoryReadback(String scope, String brand, UUID categoryRef) {
        return categoryReadback(scope, brand, category(scope, brand, categoryRef));
    }

    private CatalogOwnerApi.CategoryReadback categoryReadback(String scope, String brand, CategoryRow category) {
        CatalogOwnerApi.CategoryDeletionAvailability deletionAvailability = "VOIDED".equals(category.status())
                ? new CatalogOwnerApi.CategoryDeletionAvailability(false, 0, 0, List.of())
                : categoryDeletionAvailability(scope, brand, category.ref());
        return new CatalogOwnerApi.CategoryReadback(
                category.ref(),
                category.code(),
                category.name(),
                category.status(),
                category.parentCategoryRef(),
                category.version(),
                category.displayOrder(),
                deletionAvailability);
    }

    private CatalogOwnerApi.CategoryReadback createdCategoryReadback(CategoryRow category) {
        return new CatalogOwnerApi.CategoryReadback(
                category.ref(),
                category.code(),
                category.name(),
                category.status(),
                category.parentCategoryRef(),
                category.version(),
                category.displayOrder(),
                new CatalogOwnerApi.CategoryDeletionAvailability(true, 1, 0, List.of()));
    }

    private CategoryRow requireCategoryParent(String scope, String brand, UUID parentCategoryRef) {
        return lockCategory(scope, brand, parentCategoryRef);
    }

    private void lockCategoryHierarchy(String scope, String brand) {
        persistence.lockHierarchy(scope, brand);
    }

    private void assertCategoryChildDepth(String scope, String brand, CategoryRow parent) {
        if (categoryDepth(scope, brand, parent.ref()) >= CATALOG_CATEGORY_MAX_DEPTH) {
            throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "商品分类最多只能建立三级");
        }
    }

    private int categoryDepth(String scope, String brand, UUID categoryRef) {
        return persistence.readDepth(scope, brand, categoryRef);
    }

    private CategoryRow category(String dataNodeRef, String brandRef, UUID categoryRef) {
        return persistence.read(dataNodeRef, brandRef, categoryRef);
    }

    private CategoryRow lockCategory(String dataNodeRef, String brandRef, UUID categoryRef) {
        return persistence.lock(dataNodeRef, brandRef, categoryRef);
    }

    private CategoryRow categoryIncludingVoided(String dataNodeRef, String brandRef, UUID categoryRef) {
        return persistence.readIncludingVoided(dataNodeRef, brandRef, categoryRef);
    }

    private CategoryRow lockCategoryIncludingVoided(String dataNodeRef, String brandRef, UUID categoryRef) {
        return persistence.lockIncludingVoided(dataNodeRef, brandRef, categoryRef);
    }

    private List<UUID> categorySubtreeRefsIncludingVoided(String scope, String brand, UUID rootCategoryRef) {
        return persistence.subtreeRefsIncludingVoided(scope, brand, rootCategoryRef);
    }

    private List<String> categoryReferencedItems(String scope, String brand, List<UUID> refs) {
        return persistence.referencedItems(scope, brand, refs);
    }

    private CatalogOwnerApi.CategoryDeletionAvailability categoryDeletionAvailability(
            String scope, String brand, UUID categoryRef) {
        return persistence.deletionAvailability(scope, brand, categoryRef);
    }

    private long nextCategoryDisplayOrder(String scope, String brand, UUID parentCategoryRef) {
        return persistence.nextDisplayOrder(scope, brand, parentCategoryRef);
    }

    private void requireCategoryVersion(CategoryRow row, long expectedVersion) {
        if (expectedVersion < 1)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedVersion is required");
        if (row.version() != expectedVersion) {
            throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
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

    private CategoryRow categoryCommandRow(JsonNode response) {
        JsonNode result = response.path("result");
        if (!result.isObject()) throw new IllegalStateException("category command result is absent");
        try {
            return new CategoryRow(
                    UUID.fromString(result.path("categoryRef").asText()),
                    result.path("code").asText(),
                    result.path("name").asText(),
                    null,
                    nullableUuid(result, "parentCategoryRef"),
                    result.path("status").asText(),
                    result.path("version").asLong(),
                    result.path("displayOrder").asInt());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("category command result is malformed", ex);
        }
    }

    private ObjectNode receiptRequest(ObjectNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String dataNodeRef, String key, String operationId, ObjectNode request) {
        persistence.lockReceipt(dataNodeRef, key);
        List<CatalogCategoryPersistence.ReceiptRow> rows = persistence.readReceipt(dataNodeRef, key);
        if (rows.isEmpty()) return null;
        CatalogCategoryPersistence.ReceiptRow receipt = rows.get(0);
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request))) {
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        }
        return json(receipt.responseJson());
    }

    private void saveReceipt(String scope, String key, String operationId, ObjectNode request, JsonNode response) {
        persistence.saveReceipt(scope, key, operationId, hash(request), canonicalJson(response), now());
    }

    private String canonicalJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value == null ? mapper.createObjectNode() : value);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", failure);
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
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is invalid", failure);
        }
    }

    private String hash(JsonNode value) {
        try {
            return Sha256Hex.digest(canonicalJson(value));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    private static String required(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        }
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

    private static long requiredLong(ObjectNode request, String key, long fallback) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || !value.isIntegralNumber() ? fallback : value.asLong();
    }

    private static UUID nullableUuid(JsonNode object, String field) {
        JsonNode value = object == null ? null : object.get(field);
        if (value == null
                || value.isNull()
                || value.isMissingNode()
                || value.asText().isBlank()) return null;
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, field + " is not a UUID", failure);
        }
    }

    private static void putNullableUuid(ObjectNode target, String field, UUID value) {
        if (value == null) target.putNull(field);
        else target.put(field, value.toString());
    }

    private long now() {
        return time.currentEpochMillis();
    }
}
