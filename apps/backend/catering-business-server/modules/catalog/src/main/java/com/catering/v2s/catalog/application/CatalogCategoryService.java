package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.Set;
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

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    @Autowired
    public CatalogCategoryService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    @Transactional
    public CatalogOwnerApi.CategoryReadback createCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "createOperationsCatalogCategory");
        ObjectNode request = mapper.createObjectNode().put("code", command.code()).put("name", command.name());
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
                    dataNodeRef,
                    scope.brandRef(),
                    command,
                    idempotencyKey,
                    receiptRequest(request, scope.brandRef()));
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
                    dataNodeRef,
                    scope.brandRef(),
                    command,
                    idempotencyKey,
                    receiptRequest(request, scope.brandRef()));
        }
    }

    @Transactional
    public CatalogOwnerApi.CategoryReadback transitionCategoryStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "transitionOperationsCatalogCategoryStatus");
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
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ObjectNode request,
            String idempotencyKey) {
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
        jdbc.update(
                "UPDATE catalog.catalog_category SET name=?,version=version+1,updated_at_epoch_millis=? WHERE "
                        + "category_ref=?",
                required(request, "name"),
                now(),
                categoryRef);
        return categoryCommand(requestId, category(dataNodeRef, brandRef, categoryRef));
    }

    private ObjectNode moveCategory(
            String dataNodeRef,
            String brandRef,
            String requestId,
            ObjectNode request) {
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
                jdbc.update(
                        "UPDATE catalog.catalog_category SET "
                                + "parent_category_ref=?,display_order=?,version=version+1,updated_at_epoch_millis=? "
                                + "WHERE "
                                + "category_ref=?",
                        parentCategoryRef,
                        nextDisplayOrder,
                        now(),
                        categoryRef);
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
        return jdbc.query(
                "WITH RECURSIVE ancestors(category_ref,parent_category_ref,depth) AS ("
                        + "SELECT category_ref,parent_category_ref,1 FROM catalog.catalog_category "
                        + "WHERE data_node_ref=? "
                        + "AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL "
                        + "SELECT parent.category_ref,parent.parent_category_ref,ancestors.depth+1 "
                        + "FROM catalog.catalog_category parent JOIN ancestors ON "
                        + "parent.category_ref=ancestors.parent_category_ref WHERE parent.data_node_ref=? AND "
                        + "parent.brand_ref=? AND parent.status <> 'VOIDED'), "
                        + "subtree(category_ref,depth) AS (SELECT category_ref,1 FROM catalog.catalog_category WHERE "
                        + "data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL "
                        + "SELECT child.category_ref,subtree.depth+1 FROM catalog.catalog_category child "
                        + "JOIN subtree ON child.parent_category_ref=subtree.category_ref "
                        + "WHERE child.data_node_ref=? AND child.brand_ref=? "
                        + "AND child.status <> 'VOIDED') SELECT COALESCE((SELECT MAX(depth) FROM ancestors),0), "
                        + "COALESCE((SELECT MAX(depth) FROM subtree),0)",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, parentCategoryRef);
                    statement.setString(4, scope);
                    statement.setString(5, brand);
                    statement.setString(6, scope);
                    statement.setString(7, brand);
                    statement.setObject(8, movingCategoryRef);
                    statement.setString(9, scope);
                    statement.setString(10, brand);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("category move depth query returned no row");
                    return new CategoryMoveDepths(result.getInt(1), result.getInt(2));
                });
    }

    private int categorySubtreeDepth(String scope, String brand, UUID rootCategoryRef) {
        Integer depth = jdbc.queryForObject(
                "WITH RECURSIVE subtree(category_ref,depth) AS (SELECT category_ref,1 FROM catalog.catalog_category "
                        + "WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL "
                        + "SELECT child.category_ref,subtree.depth+1 FROM catalog.catalog_category child JOIN subtree "
                        + "ON child.parent_category_ref=subtree.category_ref "
                        + "WHERE child.data_node_ref=? AND child.brand_ref=? "
                        + "AND child.status <> 'VOIDED') SELECT COALESCE(MAX(depth),0) FROM subtree",
                Integer.class,
                scope,
                brand,
                rootCategoryRef,
                scope,
                brand);
        return depth == null ? 0 : depth;
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
            CategoryRow current = lockCategoryIncludingVoided(
                    dataNodeRef, brandRef, requiredUuid(request, "categoryRef"));
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
        try (var ownerCommand = com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result = switch (operationId) {
                case "createOperationsCatalogCategory" -> createCategory(dataNodeRef, brandRef, requestId, request);
                case "updateOperationsCatalogCategory" ->
                        updateCategory(dataNodeRef, brandRef, requestId, request);
                case "moveOperationsCatalogCategory" -> moveCategory(dataNodeRef, brandRef, requestId, request);
                case "transitionOperationsCatalogCategoryStatus" ->
                        transitionCategoryStatus(dataNodeRef, brandRef, requestId, request);
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
        String sql = "WITH RECURSIVE receipt_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(CAST(? AS "
                + "text)),hashtext(CAST(? AS text)))), current_category AS MATERIALIZED (SELECT category_ref,"
                + "status,version FROM catalog.catalog_category CROSS JOIN receipt_lock WHERE data_node_ref=? AND "
                + "brand_ref=? AND category_ref=? AND status <> 'VOIDED' FOR UPDATE), prior_receipt AS MATERIALIZED "
                + "(SELECT operation_id,request_hash,response::text AS response FROM catalog.command_receipt CROSS "
                + "JOIN receipt_lock WHERE data_node_ref=? AND idempotency_key=?), updated_category AS (UPDATE "
                + "catalog.catalog_category category SET name=?,version=category.version+1,updated_at_epoch_millis=? "
                + "FROM current_category current WHERE category.category_ref=current.category_ref AND "
                + "current.version=? AND NOT EXISTS (SELECT 1 FROM prior_receipt) RETURNING category.category_ref,"
                + "category.code,category.name,category.status,category.parent_category_ref,category.version,"
                + "category.display_order), "
                + "category_subtree(category_ref) AS (SELECT category_ref FROM updated_category UNION ALL SELECT "
                + "child.category_ref FROM catalog.catalog_category child JOIN category_subtree parent ON "
                + "child.parent_category_ref=parent.category_ref WHERE child.data_node_ref=? AND child.brand_ref=? "
                + "AND child.status <> 'VOIDED'), deletion_availability AS (SELECT "
                + "COUNT(DISTINCT subtree.category_ref) AS subtree_size,"
                + "COUNT(DISTINCT item.item_ref) AS blocking_reference_count,"
                + "COALESCE((SELECT jsonb_agg(jsonb_build_object('referenceKind',"
                + "'CATALOG_ITEM','referenceRef',refs.item_ref,'code',refs.code,'name',refs.name,'direction',"
                + "'INBOUND') ORDER BY refs.code) FROM (SELECT DISTINCT item.item_ref,item.code,item.name FROM "
                + "category_subtree subtree_refs JOIN catalog.catalog_item_category relation_refs ON "
                + "relation_refs.category_ref=subtree_refs.category_ref JOIN catalog.catalog_item item ON "
                + "item.item_ref=relation_refs.item_ref AND item.data_node_ref=? AND item.brand_ref=? AND "
                + "item.status <> 'VOIDED') refs),'[]'::jsonb) AS blocking_reference_facts FROM category_subtree "
                + "subtree LEFT JOIN catalog.catalog_item_category "
                + "relation ON relation.category_ref=subtree.category_ref LEFT JOIN catalog.catalog_item item ON "
                + "item.item_ref=relation.item_ref AND item.data_node_ref=? AND item.brand_ref=? AND item.status <> "
                + "'VOIDED'), response AS (SELECT jsonb_build_object('categoryRef',category.category_ref,'code',"
                + "category.code,'name',category.name,'status',category.status,'parentCategoryRef',"
                + "category.parent_category_ref,'version',"
                + "category.version,'displayOrder',category.display_order,'deletionAvailability',jsonb_build_object("
                + "'canDelete',availability.blocking_reference_count=0,'subtreeSize',availability.subtree_size,"
                + "'blockingReferenceCount',availability.blocking_reference_count,'blockingReferences',"
                + "availability.blocking_reference_facts)) AS body "
                + "FROM updated_category category CROSS JOIN "
                + "deletion_availability availability), written_receipt AS (INSERT INTO catalog.command_receipt("
                + "receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response,"
                + "created_at_epoch_millis) "
                + "SELECT ?,?,?,?,?,body,? FROM response RETURNING response::text AS response) SELECT "
                + "current_category.category_ref,current_category.version,prior_receipt.operation_id,"
                + "prior_receipt.request_hash,prior_receipt.response AS replay_response,written_receipt.response AS "
                + "written_response FROM receipt_lock LEFT JOIN current_category ON TRUE "
                + "LEFT JOIN prior_receipt ON TRUE "
                + "LEFT JOIN written_receipt ON TRUE";
        TypedCategoryUpdateRow row = jdbc.queryForObject(
                sql,
                (result, ignored) -> new TypedCategoryUpdateRow(
                        result.getObject("category_ref", UUID.class),
                        result.getLong("version"),
                        result.getString("operation_id"),
                        result.getString("request_hash"),
                        result.getString("replay_response"),
                        result.getString("written_response")),
                "catalog-category-receipt:" + scope,
                key,
                scope,
                brand,
                command.categoryRef(),
                scope,
                key,
                name,
                now(),
                command.expectedVersion(),
                scope,
                brand,
                scope,
                brand,
                scope,
                brand,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                now());
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
        long timestamp = now();
        String sql = "WITH RECURSIVE receipt_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(CAST(? AS "
                + "text)),hashtext(CAST(? AS text)))), hierarchy_lock AS MATERIALIZED (SELECT "
                + "pg_advisory_xact_lock(hashtext(CAST(? AS text)),hashtext(CAST(? AS text)))), "
                + "locked_categories AS MATERIALIZED (SELECT category.category_ref,category.code,category.name,"
                + "category.parent_category_ref,category.version,category.display_order FROM "
                + "catalog.catalog_category category CROSS JOIN receipt_lock CROSS JOIN hierarchy_lock WHERE "
                + "category.data_node_ref=? AND category.brand_ref=? AND category.status <> 'VOIDED' FOR UPDATE), "
                + "move_input AS MATERIALIZED (SELECT ?::uuid AS category_ref,?::text AS action,"
                + "?::uuid AS requested_parent_ref,?::bigint AS expected_version,?::bigint AS updated_at), "
                + "current_category AS MATERIALIZED (SELECT category.* FROM locked_categories category "
                + "JOIN move_input input ON input.category_ref=category.category_ref), prior_receipt AS MATERIALIZED "
                + "(SELECT operation_id,request_hash,response::text AS response FROM catalog.command_receipt "
                + "CROSS JOIN receipt_lock WHERE data_node_ref=? AND idempotency_key=?), requested_parent AS "
                + "MATERIALIZED (SELECT category.* FROM locked_categories category JOIN move_input input ON "
                + "input.requested_parent_ref=category.category_ref), subtree(category_ref,depth) AS "
                + "(SELECT category_ref,1 FROM current_category UNION ALL SELECT child.category_ref,"
                + "subtree.depth+1 FROM locked_categories child JOIN subtree ON "
                + "child.parent_category_ref=subtree.category_ref), parent_ancestors(category_ref,parent_category_ref,"
                + "depth) AS (SELECT category_ref,parent_category_ref,1 FROM requested_parent UNION ALL SELECT "
                + "parent.category_ref,parent.parent_category_ref,parent_ancestors.depth+1 FROM "
                + "locked_categories parent JOIN parent_ancestors ON "
                + "parent.category_ref=parent_ancestors.parent_category_ref), siblings AS (SELECT "
                + "sibling.category_ref,sibling.display_order,LAG(sibling.category_ref) OVER (ORDER BY "
                + "sibling.display_order,sibling.code) AS previous_ref,LAG(sibling.display_order) OVER (ORDER BY "
                + "sibling.display_order,sibling.code) AS previous_display_order,LEAD(sibling.category_ref) OVER "
                + "(ORDER BY sibling.display_order,sibling.code) AS next_ref,LEAD(sibling.display_order) OVER "
                + "(ORDER BY sibling.display_order,sibling.code) AS next_display_order FROM locked_categories sibling "
                + "CROSS JOIN current_category current WHERE sibling.parent_category_ref IS NOT DISTINCT FROM "
                + "current.parent_category_ref), current_sibling AS MATERIALIZED (SELECT sibling.* FROM siblings "
                + "sibling JOIN current_category current ON sibling.category_ref=current.category_ref), move_plan AS "
                + "MATERIALIZED (SELECT input.action,input.requested_parent_ref,input.expected_version,"
                + "input.updated_at,"
                + "current.category_ref AS current_category_ref,current.version AS current_version,"
                + "current.display_order AS current_display_order,current_sibling.previous_ref,"
                + "current_sibling.previous_display_order,current_sibling.next_ref,"
                + "current_sibling.next_display_order,COALESCE((SELECT MAX(depth) FROM parent_ancestors),0) "
                + "AS target_depth,COALESCE((SELECT MAX(depth) FROM subtree),0) AS subtree_depth,"
                + "COALESCE((SELECT MAX(category.display_order) FROM locked_categories category WHERE "
                + "category.parent_category_ref IS NOT DISTINCT FROM input.requested_parent_ref),-1)+1 "
                + "AS reparent_display_order,CASE WHEN current.category_ref IS NULL THEN 'NOT_FOUND' WHEN "
                + "current.version <> input.expected_version AND current.version <> input.expected_version+1 THEN "
                + "'VERSION_CONFLICT' WHEN input.action NOT IN ('REPARENT','UP','DOWN') THEN 'VALIDATION_ERROR' "
                + "WHEN input.action='REPARENT' AND input.requested_parent_ref IS NOT NULL AND "
                + "requested_parent.category_ref IS NULL THEN 'NOT_FOUND' WHEN input.action='REPARENT' AND "
                + "input.requested_parent_ref=current.category_ref THEN 'HIERARCHY_SELF' WHEN input.action='REPARENT' "
                + "AND EXISTS (SELECT 1 FROM subtree WHERE category_ref=input.requested_parent_ref) THEN "
                + "'HIERARCHY_CYCLE' WHEN input.action='REPARENT' AND "
                + "COALESCE((SELECT MAX(depth) FROM parent_ancestors),0)+COALESCE((SELECT MAX(depth) FROM subtree),0)>"
                + CATALOG_CATEGORY_MAX_DEPTH
                + " THEN 'CATEGORY_DEPTH_EXCEEDED' WHEN input.action='UP' AND current_sibling.previous_ref IS NULL "
                + "THEN 'MOVE_BOUNDARY' WHEN input.action='DOWN' AND current_sibling.next_ref IS NULL THEN "
                + "'MOVE_BOUNDARY' END AS validation_code FROM move_input input LEFT JOIN current_category current ON "
                + "TRUE LEFT JOIN requested_parent ON TRUE LEFT JOIN current_sibling ON TRUE), updated_categories AS "
                + "(UPDATE catalog.catalog_category category SET parent_category_ref=CASE WHEN plan.action='REPARENT' "
                + "AND category.category_ref=plan.current_category_ref THEN plan.requested_parent_ref ELSE "
                + "category.parent_category_ref END,display_order=CASE WHEN plan.action='REPARENT' AND "
                + "category.category_ref=plan.current_category_ref THEN plan.reparent_display_order WHEN "
                + "plan.action='UP' AND category.category_ref=plan.current_category_ref THEN "
                + "plan.previous_display_order WHEN plan.action='UP' AND category.category_ref=plan.previous_ref THEN "
                + "plan.current_display_order WHEN plan.action='DOWN' AND "
                + "category.category_ref=plan.current_category_ref "
                + "THEN plan.next_display_order WHEN plan.action='DOWN' AND category.category_ref=plan.next_ref THEN "
                + "plan.current_display_order ELSE category.display_order END,version=category.version+1,"
                + "updated_at_epoch_millis=plan.updated_at FROM move_plan plan WHERE plan.validation_code IS NULL "
                + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) AND (category.category_ref=plan.current_category_ref "
                + "OR category.category_ref=plan.previous_ref OR category.category_ref=plan.next_ref) RETURNING "
                + "category.category_ref,category.code,category.name,category.status,category.parent_category_ref,"
                + "category.version,category.display_order), updated_current AS MATERIALIZED (SELECT category.* FROM "
                + "updated_categories "
                + "category JOIN move_plan plan ON category.category_ref=plan.current_category_ref), "
                + "readback_subtree(category_ref) AS (SELECT category_ref FROM updated_current UNION ALL SELECT "
                + "child.category_ref FROM locked_categories child JOIN readback_subtree parent ON "
                + "child.parent_category_ref=parent.category_ref), deletion_availability AS (SELECT "
                + "COUNT(DISTINCT subtree.category_ref) AS subtree_size,COUNT(DISTINCT item.item_ref) AS "
                + "blocking_reference_count,COALESCE((SELECT "
                + "jsonb_agg(jsonb_build_object('referenceKind','CATALOG_ITEM','referenceRef',refs.item_ref,"
                + "'code',refs.code,'name',refs.name,'direction','INBOUND') ORDER BY refs.code) FROM (SELECT DISTINCT "
                + "item.item_ref,item.code,item.name FROM readback_subtree subtree_refs JOIN "
                + "catalog.catalog_item_category relation_refs ON relation_refs.category_ref=subtree_refs.category_ref "
                + "JOIN catalog.catalog_item item ON item.item_ref=relation_refs.item_ref AND item.data_node_ref=? "
                + "AND item.brand_ref=? AND item.status <> 'VOIDED') refs),'[]'::jsonb) AS blocking_reference_facts "
                + "FROM readback_subtree subtree "
                + "LEFT JOIN catalog.catalog_item_category relation ON relation.category_ref=subtree.category_ref "
                + "LEFT JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref AND item.data_node_ref=? "
                + "AND item.brand_ref=? AND item.status <> 'VOIDED'), response AS (SELECT jsonb_build_object("
                + "'categoryRef',category.category_ref,'code',category.code,'name',category.name,'status',"
                + "category.status,'parentCategoryRef',category.parent_category_ref,'version',category.version,"
                + "'displayOrder',"
                + "category.display_order,"
                + "'deletionAvailability',jsonb_build_object('canDelete',availability.blocking_reference_count=0,"
                + "'subtreeSize',availability.subtree_size,'blockingReferenceCount',"
                + "availability.blocking_reference_count,'blockingReferences',"
                + "availability.blocking_reference_facts)) AS body FROM updated_current "
                + "category CROSS JOIN deletion_availability availability), written_receipt AS (INSERT INTO "
                + "catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,"
                + "request_hash,response,created_at_epoch_millis) SELECT ?,?,?,?,?,body,? FROM response "
                + "RETURNING response::text AS response) "
                + "SELECT plan.validation_code,current_category.category_ref,current_category.version,"
                + "prior_receipt.operation_id,prior_receipt.request_hash,prior_receipt.response AS replay_response,"
                + "written_receipt.response AS written_response FROM receipt_lock LEFT JOIN move_plan plan ON TRUE "
                + "LEFT JOIN current_category ON TRUE LEFT JOIN prior_receipt ON TRUE "
                + "LEFT JOIN written_receipt ON TRUE";
        TypedCategoryMoveRow row = jdbc.queryForObject(
                sql,
                (result, ignored) -> new TypedCategoryMoveRow(
                        result.getString("validation_code"),
                        result.getObject("category_ref", UUID.class),
                        result.getLong("version"),
                        result.getString("operation_id"),
                        result.getString("request_hash"),
                        result.getString("replay_response"),
                        result.getString("written_response")),
                "catalog-category-receipt:" + scope,
                key,
                "catalog-category-hierarchy:" + scope,
                brand,
                scope,
                brand,
                command.categoryRef(),
                command.action().name(),
                command.parentCategoryRef(),
                command.expectedVersion(),
                timestamp,
                scope,
                key,
                scope,
                brand,
                scope,
                brand,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                timestamp);
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
        if (jdbc.update(
                        "UPDATE catalog.catalog_category SET status=?,version=version+1,updated_at_epoch_millis=? "
                                + "WHERE data_node_ref=? AND brand_ref=? AND category_ref=? "
                                + "AND version=? AND status <> 'VOIDED'",
                        target,
                        now(),
                        dataNodeRef,
                        brandRef,
                        categoryRef,
                        expected)
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
        return categoryCommand(requestId, categoryIncludingVoided(dataNodeRef, brandRef, categoryRef));
    }

    private CatalogOwnerApi.CategoryReadback categoryReadback(String scope, String brand, UUID categoryRef) {
        return categoryReadback(scope, brand, category(scope, brand, categoryRef));
    }

    private CatalogOwnerApi.CategoryReadback categoryReadback(String scope, String brand, CategoryRow category) {
        CatalogOwnerApi.CategoryDeletionAvailability deletionAvailability =
                "VOIDED".equals(category.status())
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
        AdvisoryLock.acquire(jdbc, "catalog-category-hierarchy", scope, brand);
    }

    private void assertCategoryChildDepth(String scope, String brand, CategoryRow parent) {
        if (categoryDepth(scope, brand, parent.ref()) >= CATALOG_CATEGORY_MAX_DEPTH) {
            throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "商品分类最多只能建立三级");
        }
    }

    private int categoryDepth(String scope, String brand, UUID categoryRef) {
        Integer depth = jdbc.queryForObject(
                "WITH RECURSIVE ancestors(category_ref,parent_category_ref,depth) AS ("
                        + "SELECT category_ref,parent_category_ref,1 FROM catalog.catalog_category "
                        + "WHERE data_node_ref=? "
                        + "AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL "
                        + "SELECT parent.category_ref,parent.parent_category_ref,ancestors.depth+1 "
                        + "FROM catalog.catalog_category parent "
                        + "JOIN ancestors ON parent.category_ref=ancestors.parent_category_ref "
                        + "WHERE parent.data_node_ref=? AND parent.brand_ref=? AND parent.status <> 'VOIDED') "
                        + "SELECT COALESCE(MAX(depth),0) FROM ancestors",
                Integer.class,
                scope,
                brand,
                categoryRef,
                scope,
                brand);
        return depth == null ? 0 : depth;
    }

    private CategoryRow category(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND "
                        + "status <> 'VOIDED'",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return categoryRow(result);
                });
    }

    private CategoryRow lockCategory(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=? AND "
                        + "status <> 'VOIDED' FOR UPDATE",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return categoryRow(result);
                });
    }

    private CategoryRow categoryIncludingVoided(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND category_ref=?",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return categoryRow(result);
                });
    }

    private CategoryRow lockCategoryIncludingVoided(String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                "SELECT category_ref,code,name,parent_code,parent_category_ref,status,version,display_order FROM "
                        + "catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? "
                        + "AND category_ref=? FOR UPDATE",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return categoryRow(result);
                });
    }

    private List<UUID> categorySubtreeRefsIncludingVoided(String scope, String brand, UUID rootCategoryRef) {
        List<UUID> refs = jdbc.query(
                "WITH RECURSIVE subtree(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE "
                        + "data_node_ref=? AND brand_ref=? AND category_ref=? UNION ALL SELECT child.category_ref "
                        + "FROM catalog.catalog_category child JOIN subtree parent "
                        + "ON child.parent_category_ref=parent.category_ref "
                        + "WHERE child.data_node_ref=? AND child.brand_ref=?) "
                        + "SELECT category_ref FROM subtree ORDER BY category_ref",
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
                "SELECT DISTINCT item.code FROM catalog.catalog_item_category relation "
                        + "JOIN catalog.catalog_item item "
                        + "ON item.item_ref=relation.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status <> 'VOIDED' AND relation.category_ref IN ("
                        + placeholders + ") ORDER BY item.code",
                (rows, index) -> rows.getString(1),
                args.toArray());
    }

    private CatalogOwnerApi.CategoryDeletionAvailability categoryDeletionAvailability(
            String scope, String brand, UUID categoryRef) {
        return jdbc.query(
                "WITH RECURSIVE subtree(category_ref) AS (SELECT category_ref FROM catalog.catalog_category WHERE "
                        + "data_node_ref=? AND brand_ref=? AND category_ref=? AND status <> 'VOIDED' UNION ALL SELECT "
                        + "child.category_ref FROM catalog.catalog_category child JOIN subtree parent ON "
                        + "child.parent_category_ref=parent.category_ref WHERE child.data_node_ref=? AND "
                        + "child.brand_ref=? AND child.status <> 'VOIDED') "
                        + "SELECT (SELECT COUNT(*) FROM subtree), item.item_ref, item.code, item.name "
                        + "FROM (SELECT 1) anchor LEFT JOIN "
                        + "catalog.catalog_item_category relation ON relation.category_ref IN "
                        + "(SELECT category_ref FROM "
                        + "subtree) LEFT JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref AND "
                        + "item.data_node_ref=? AND item.brand_ref=? AND item.status <> 'VOIDED' ORDER BY item.code",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, categoryRef);
                    statement.setString(4, scope);
                    statement.setString(5, brand);
                    statement.setString(6, scope);
                    statement.setString(7, brand);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    long subtreeSize = result.getLong(1);
                    if (subtreeSize == 0) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    LinkedHashSet<String> blocking = new LinkedHashSet<>();
                    List<CatalogOwnerApi.CategoryBlockingReference> references = new ArrayList<>();
                    UUID firstRef = result.getObject(2, UUID.class);
                    String first = result.getString(3);
                    String firstName = result.getString(4);
                    if (first != null) {
                        blocking.add(first);
                        references.add(new CatalogOwnerApi.CategoryBlockingReference(
                                "CATALOG_ITEM", firstRef, first, firstName, "INBOUND"));
                    }
                    while (result.next()) {
                        UUID itemRef = result.getObject(2, UUID.class);
                        String itemCode = result.getString(3);
                        String itemName = result.getString(4);
                        if (itemCode != null && blocking.add(itemCode)) {
                            references.add(new CatalogOwnerApi.CategoryBlockingReference(
                                    "CATALOG_ITEM", itemRef, itemCode, itemName, "INBOUND"));
                        }
                    }
                    return new CatalogOwnerApi.CategoryDeletionAvailability(
                            blocking.isEmpty(), subtreeSize, references.size(), List.copyOf(references));
                });
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

    private CategoryRow categoryRow(java.sql.ResultSet result) throws java.sql.SQLException {
        return new CategoryRow(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getString(4),
                result.getObject(5, UUID.class),
                result.getString(6),
                result.getLong(7),
                result.getInt(8));
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
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request))) {
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        }
        return receipt.response();
    }

    private void saveReceipt(String scope, String key, String operationId, ObjectNode request, JsonNode response) {
        jdbc.update(
                "INSERT INTO catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,"
                        + "response,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                scope,
                key,
                operationId,
                hash(request),
                canonicalJson(response),
                now());
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
        JsonNode value = request == null ? null : request.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static long requiredLong(ObjectNode request, String key, long fallback) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || !value.isIntegralNumber() ? fallback : value.asLong();
    }

    private static UUID nullableUuid(JsonNode object, String field) {
        JsonNode value = object == null ? null : object.get(field);
        if (value == null || value.isNull() || value.isMissingNode() || value.asText().isBlank()) return null;
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

    private record Receipt(String operationId, String requestHash, JsonNode response) {}

    private record TypedCategoryUpdateRow(
            UUID currentCategoryRef,
            long currentVersion,
            String receiptOperation,
            String receiptHash,
            String replayResponse,
            String writtenResponse) {}

    private record TypedCategoryMoveRow(
            String validationCode,
            UUID currentCategoryRef,
            long currentVersion,
            String receiptOperation,
            String receiptHash,
            String replayResponse,
            String writtenResponse) {}

    private record CategoryMoveDepths(int targetDepth, int movingSubtreeDepth) {}

    private record CategoryRow(
            UUID ref,
            String code,
            String name,
            String parentCode,
            UUID parentCategoryRef,
            String status,
            long version,
            int displayOrder) {}
}
