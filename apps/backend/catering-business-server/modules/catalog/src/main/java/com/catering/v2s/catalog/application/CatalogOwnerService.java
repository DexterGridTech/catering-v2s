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
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
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

/** Catalog owner. All catalog facts and command receipts stay inside catalog schema. */
@Service
public class CatalogOwnerService implements CatalogOwnerApi, CatalogTemporaryPromotionOwner {
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
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;
    private final CatalogAssetReferenceLock assetReferenceLocks;
    private final ProductionTagOwnerApi productionTags;
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
    public JsonNode readCategoryCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return categoryCandidates(dataNodeRef, brandRef, requestId, request);
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
    public CatalogOwnerApi.InventoryTargetDisplayFact readInventoryTargetDisplayFact(
            String dataNodeRef, String brandRef, UUID itemRef, UUID productSkuRef) {
        requireScope(dataNodeRef, brandRef);
        if (itemRef == null) return CatalogOwnerApi.InventoryTargetDisplayFact.absent(null);
        List<CatalogOwnerApi.InventoryTargetDisplayFact> rows = jdbc.query(
                "SELECT item.item_ref,item.name,item.shape_key,sku.sku_name FROM catalog.catalog_item item "
                        + "LEFT JOIN LATERAL (SELECT catalog_sku.sku_name FROM catalog.catalog_sku WHERE "
                        + "catalog_sku.item_ref=item.item_ref AND catalog_sku.status <> 'VOIDED' AND "
                        + "?::uuid IS NOT NULL AND catalog_sku.product_sku_ref=? ORDER BY catalog_sku.product_sku_ref "
                        + "LIMIT 1) sku ON TRUE WHERE item.data_node_ref=? AND item.brand_ref=? AND item.item_ref=? "
                        + "AND item.status <> 'VOIDED'",
                statement -> {
                    statement.setObject(1, productSkuRef);
                    statement.setObject(2, productSkuRef);
                    statement.setString(3, dataNodeRef);
                    statement.setString(4, brandRef);
                    statement.setObject(5, itemRef);
                },
                (result, row) -> new CatalogOwnerApi.InventoryTargetDisplayFact(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4)));
        return rows.isEmpty() ? CatalogOwnerApi.InventoryTargetDisplayFact.absent(itemRef) : rows.getFirst();
    }

    @Override
    public CatalogOwnerApi.SalesMenuCandidatePage readSalesMenuCandidatePage(
            CatalogOwnerApi.SalesMenuCandidatePageQuery query) {
        java.util.Objects.requireNonNull(query, "query");
        requireScope(query.dataNodeRef(), query.brandRef());
        String queryIdentity = cursorIdentity(
                SALES_MENU_CANDIDATE_OPERATION,
                query.dataNodeRef(),
                query.brandRef(),
                String.valueOf(query.categoryRef()),
                query.filter(),
                Integer.toString(query.pageSize()));
        OpaqueCollectionCursor.Position cursor = decodeSalesMenuCursor(query.cursor(), queryIdentity);

        StringBuilder sql = new StringBuilder("SELECT i.item_ref,i.code,i.name,i.shape_key,i.status,"
                + "NULLIF(i.sections->>'standardSalePrice','')::bigint AS default_price,i.version "
                + "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=? "
                + "AND i.status <> 'VOIDED'");
        List<Object> arguments = new ArrayList<>(List.of(query.dataNodeRef(), query.brandRef()));
        if (!query.filter().isBlank()) {
            sql.append(" AND (i.code ILIKE ? OR i.name ILIKE ?)");
            String filter = "%" + query.filter() + "%";
            arguments.add(filter);
            arguments.add(filter);
        }
        if (query.categoryRef() != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM catalog.catalog_item_category relation "
                    + "JOIN catalog.catalog_category category ON category.category_ref=relation.category_ref "
                    + "WHERE relation.item_ref=i.item_ref AND relation.category_ref=? "
                    + "AND category.data_node_ref=i.data_node_ref AND category.brand_ref=i.brand_ref "
                    + "AND category.status <> 'VOIDED')");
            arguments.add(query.categoryRef());
        }
        if (cursor != null) {
            sql.append(" AND (i.code > ? OR (i.code = ? AND i.item_ref > ?))");
            arguments.add(cursor.sortKey());
            arguments.add(cursor.sortKey());
            arguments.add(cursor.tieBreaker());
        }
        sql.append(" ORDER BY i.code,i.item_ref LIMIT ?");
        arguments.add(SALES_MENU_CANDIDATE_PAGE_SIZE + 1);
        List<SalesMenuItemRow> rows = jdbc.query(
                sql.toString(),
                (result, ignored) -> new SalesMenuItemRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, Long.class),
                        result.getLong(7)),
                arguments.toArray());
        boolean hasNext = rows.size() > SALES_MENU_CANDIDATE_PAGE_SIZE;
        List<SalesMenuItemRow> pageRows =
                hasNext ? new ArrayList<>(rows.subList(0, SALES_MENU_CANDIDATE_PAGE_SIZE)) : rows;
        SalesMenuFactSnapshot facts = readSalesMenuFactSnapshot(
                query.dataNodeRef(),
                query.brandRef(),
                pageRows.stream().map(SalesMenuItemRow::itemRef).toList(),
                false,
                true);
        List<CatalogOwnerApi.SalesMenuCandidate> candidates =
                pageRows.stream().map(row -> salesMenuCandidate(row, facts)).toList();
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        queryIdentity,
                        pageRows.getLast().itemCode(),
                        pageRows.getLast().itemRef())
                : null;
        return new CatalogOwnerApi.SalesMenuCandidatePage(candidates, query.cursor(), nextCursor);
    }

    @Override
    public Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> readSalesMenuItemFacts(
            String dataNodeRef, String brandRef, Set<UUID> itemRefs) {
        requireScope(dataNodeRef, brandRef);
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        for (UUID itemRef : itemRefs)
            if (itemRef == null)
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemRefs must contain UUID values");

        List<UUID> requestedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(requestedRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>(List.of(dataNodeRef, brandRef));
        arguments.addAll(requestedRefs);
        List<SalesMenuItemRow> rows = jdbc.query(
                "SELECT i.item_ref,i.code,i.name,i.shape_key,i.status,"
                        + "NULLIF(i.sections->>'standardSalePrice','')::bigint AS default_price,i.version "
                        + "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=? "
                        + "AND i.item_ref IN ("
                        + placeholders
                        + ") AND i.status <> 'VOIDED' ORDER BY i.item_ref",
                (result, ignored) -> new SalesMenuItemRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, Long.class),
                        result.getLong(7)),
                arguments.toArray());
        if (rows.isEmpty()) return Map.of();

        SalesMenuFactSnapshot facts = readSalesMenuFactSnapshot(
                dataNodeRef,
                brandRef,
                rows.stream().map(SalesMenuItemRow::itemRef).toList(),
                true,
                false);
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> result = new LinkedHashMap<>();
        rows.forEach(row -> result.put(row.itemRef(), salesMenuItemFacts(row, facts)));
        return Map.copyOf(result);
    }

    private CatalogOwnerApi.SalesMenuCandidate salesMenuCandidate(SalesMenuItemRow row, SalesMenuFactSnapshot facts) {
        List<CatalogOwnerApi.SalesMenuSkuFact> skus =
                salesMenuSkuFacts(facts.skusByItem().get(row.itemRef()));
        List<CatalogOwnerApi.SalesMenuSkuVariantAxisFact> axes =
                salesMenuVariantAxes(facts.axesByItem().get(row.itemRef()));
        return new CatalogOwnerApi.SalesMenuCandidate(
                row.itemRef(),
                row.itemCode(),
                row.itemName(),
                row.shapeKey(),
                salesMenuUuidFacts(facts.categoryRefsByItem().get(row.itemRef()), "categoryRefs"),
                facts.categoryNamesByItem().getOrDefault(row.itemRef(), List.of()),
                row.defaultPriceCents(),
                salesMenuPrimaryImage(facts.imagesByItem().get(row.itemRef())),
                salesMenuSkuSummary(row.shapeKey(), skus, axes));
    }

    private CatalogOwnerApi.SalesMenuItemFacts salesMenuItemFacts(SalesMenuItemRow row, SalesMenuFactSnapshot facts) {
        List<CatalogOwnerApi.SalesMenuSkuFact> skus =
                salesMenuSkuFacts(facts.skusByItem().get(row.itemRef()));
        List<CatalogOwnerApi.SalesMenuSkuVariantAxisFact> axes =
                salesMenuVariantAxes(facts.axesByItem().get(row.itemRef()));
        return new CatalogOwnerApi.SalesMenuItemFacts(
                row.itemRef(),
                row.itemCode(),
                row.itemName(),
                row.shapeKey(),
                row.status(),
                row.version(),
                salesMenuUuidFacts(facts.categoryRefsByItem().get(row.itemRef()), "categoryRefs"),
                row.defaultPriceCents(),
                facts.salesUnitsByItem().get(row.itemRef()),
                salesMenuPrimaryImage(facts.imagesByItem().get(row.itemRef())),
                salesMenuSkuSummary(row.shapeKey(), skus, axes),
                skus,
                axes);
    }

    private SalesMenuFactSnapshot readSalesMenuFactSnapshot(
            String dataNodeRef,
            String brandRef,
            Collection<UUID> itemRefs,
            boolean includeSalesUnits,
            boolean includeCategoryNames) {
        if (itemRefs == null || itemRefs.isEmpty()) return SalesMenuFactSnapshot.empty();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        CatalogSkuFacts.ListReadback skuReadback = skuFacts.readByItemRefsForList(refs);
        Map<UUID, InventoryOwnerApi.UnitSnapshot> salesUnitsByItem = new LinkedHashMap<>();
        if (includeSalesUnits) {
            itemUnitRefsByItemRefs(refs).forEach((itemRef, units) -> {
                if (units.salesUnitSnapshot() != null) salesUnitsByItem.put(itemRef, units.salesUnitSnapshot());
            });
        }
        Map<UUID, ArrayNode> categoryRefsByItem;
        Map<UUID, List<String>> categoryNamesByItem;
        if (includeCategoryNames) {
            Map<UUID, CatalogItemCategoryFacts.SalesMenuCategoryFacts> categoryFactsByItem =
                    categoryFacts.readSalesMenuByItemRefs(dataNodeRef, brandRef, refs);
            categoryRefsByItem = new LinkedHashMap<>();
            categoryNamesByItem = new LinkedHashMap<>();
            for (Map.Entry<UUID, CatalogItemCategoryFacts.SalesMenuCategoryFacts> entry :
                    categoryFactsByItem.entrySet()) {
                UUID itemRef = entry.getKey();
                CatalogItemCategoryFacts.SalesMenuCategoryFacts facts = entry.getValue();
                ArrayNode categoryRefs = mapper.createArrayNode();
                facts.categoryRefs().forEach(categoryRef -> categoryRefs.add(categoryRef.toString()));
                categoryRefsByItem.put(itemRef, categoryRefs);
                categoryNamesByItem.put(itemRef, facts.categoryNames());
            }
        } else {
            categoryRefsByItem = categoryFacts.readByItemRefs(refs);
            categoryNamesByItem = Map.of();
        }
        return new SalesMenuFactSnapshot(
                skuReadback.skusByItem(),
                skuReadback.axesByItem(),
                itemMediaFacts.readByItemRefs(refs),
                Map.copyOf(categoryRefsByItem),
                Map.copyOf(categoryNamesByItem),
                Map.copyOf(salesUnitsByItem));
    }

    private List<CatalogOwnerApi.SalesMenuSkuFact> salesMenuSkuFacts(ArrayNode values) {
        if (values == null || !values.isArray()) return List.of();
        List<CatalogOwnerApi.SalesMenuSkuFact> result = new ArrayList<>();
        for (JsonNode value : values) {
            String status = requiredSalesMenuText(value, "sku.status");
            if ("VOIDED".equals(status)) continue;
            result.add(new CatalogOwnerApi.SalesMenuSkuFact(
                    requiredSalesMenuUuid(value, "productSkuRef"),
                    requiredSalesMenuText(value, "skuCode"),
                    requiredSalesMenuText(value, "skuName"),
                    optionalSalesMenuLong(value.get("standardSalePrice"), "standardSalePrice"),
                    value.path("isDefault").asBoolean(false),
                    status,
                    value.path("version").asLong(0),
                    value.path("displayOrder").asInt(0),
                    requiredSalesMenuText(value, "variantCombinationDigest"),
                    salesMenuUuidFacts(value.get("mediaRefs"), "sku.mediaRefs"),
                    salesMenuSkuAttributeFacts(value.get("attributeValueRefs"))));
        }
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.SalesMenuSkuAttributeValueFact> salesMenuSkuAttributeFacts(JsonNode values) {
        if (values == null || values.isMissingNode() || values.isNull()) return List.of();
        if (!values.isArray()) throw salesMenuResultProblem("sku.attributeValueRefs");
        List<CatalogOwnerApi.SalesMenuSkuAttributeValueFact> result = new ArrayList<>();
        for (JsonNode value : values)
            result.add(new CatalogOwnerApi.SalesMenuSkuAttributeValueFact(
                    requiredSalesMenuUuid(value, "attributeRef"),
                    optionalSalesMenuText(value, "attributeCode"),
                    optionalSalesMenuText(value, "attributeName"),
                    requiredSalesMenuUuid(value, "attributeValueRef"),
                    optionalSalesMenuText(value, "valueCode"),
                    optionalSalesMenuText(value, "valueLabel"),
                    optionalSalesMenuText(value, "status"),
                    value.path("displayOrder").asInt(0)));
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.SalesMenuSkuVariantAxisFact> salesMenuVariantAxes(ArrayNode values) {
        if (values == null || !values.isArray()) return List.of();
        List<CatalogOwnerApi.SalesMenuSkuVariantAxisFact> result = new ArrayList<>();
        for (JsonNode value : values)
            result.add(new CatalogOwnerApi.SalesMenuSkuVariantAxisFact(
                    requiredSalesMenuUuid(value, "axis.attributeRef"),
                    optionalSalesMenuText(value, "attributeCode"),
                    optionalSalesMenuText(value, "attributeName"),
                    value.path("displayOrder").asInt(0),
                    salesMenuVariantValues(value.get("values"))));
        return List.copyOf(result);
    }

    private List<CatalogOwnerApi.SalesMenuSkuVariantValueFact> salesMenuVariantValues(JsonNode values) {
        if (values == null || values.isMissingNode() || values.isNull()) return List.of();
        if (!values.isArray()) throw salesMenuResultProblem("sku.variantAxes.values");
        List<CatalogOwnerApi.SalesMenuSkuVariantValueFact> result = new ArrayList<>();
        for (JsonNode value : values)
            result.add(new CatalogOwnerApi.SalesMenuSkuVariantValueFact(
                    requiredSalesMenuUuid(value, "valueRef"),
                    optionalSalesMenuText(value, "valueCode"),
                    optionalSalesMenuText(value, "valueLabel"),
                    optionalSalesMenuText(value, "status"),
                    value.path("displayOrder").asInt(0)));
        return List.copyOf(result);
    }

    private CatalogOwnerApi.SalesMenuSkuSummary salesMenuSkuSummary(
            String shapeKey,
            List<CatalogOwnerApi.SalesMenuSkuFact> skus,
            List<CatalogOwnerApi.SalesMenuSkuVariantAxisFact> axes) {
        int enabled = 0;
        int nonArchived = 0;
        Long minimum = null;
        Long maximum = null;
        for (CatalogOwnerApi.SalesMenuSkuFact sku : skus) {
            if ("ENABLED".equals(sku.status())) enabled++;
            if (!"ARCHIVED".equals(sku.status())) nonArchived++;
            if (sku.standardSalePrice() != null) {
                minimum = minimum == null ? sku.standardSalePrice() : Math.min(minimum, sku.standardSalePrice());
                maximum = maximum == null ? sku.standardSalePrice() : Math.max(maximum, sku.standardSalePrice());
            }
        }
        LinkedHashSet<String> dimensions = new LinkedHashSet<>();
        axes.forEach(axis -> {
            if (axis.attributeName() != null && !axis.attributeName().isBlank()) dimensions.add(axis.attributeName());
        });
        if (dimensions.isEmpty())
            skus.forEach(sku -> sku.attributeValueRefs().forEach(value -> {
                if (value.attributeName() != null && !value.attributeName().isBlank())
                    dimensions.add(value.attributeName());
            }));
        return new CatalogOwnerApi.SalesMenuSkuSummary(
                shapeRule(shapeKey).priceGranularity(),
                enabled,
                nonArchived,
                skus.size(),
                List.copyOf(dimensions),
                minimum,
                maximum);
    }

    private static UUID salesMenuPrimaryImage(ArrayNode values) {
        if (values == null || values.isEmpty()) return null;
        return requiredSalesMenuUuid(values.get(0), "defaultImageAssetRef");
    }

    private static List<UUID> salesMenuUuidFacts(JsonNode values, String field) {
        if (values == null || values.isMissingNode() || values.isNull()) return List.of();
        if (!values.isArray()) throw salesMenuResultProblem(field);
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        for (JsonNode value : values) result.add(requiredSalesMenuUuid(value, field));
        return List.copyOf(result);
    }

    private static UUID requiredSalesMenuUuid(JsonNode value, String field) {
        JsonNode fieldValue = salesMenuFieldValue(value, field);
        if (fieldValue == null || !fieldValue.isTextual() || fieldValue.asText().isBlank())
            throw salesMenuResultProblem(field);
        try {
            return UUID.fromString(fieldValue.asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, field + " is not a valid UUID", failure);
        }
    }

    private static String requiredSalesMenuText(JsonNode value, String field) {
        String result = optionalSalesMenuText(value, field);
        if (result == null) throw salesMenuResultProblem(field);
        return result;
    }

    private static JsonNode salesMenuFieldValue(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull() || !value.isObject()) return value;
        return value.get(field.substring(field.lastIndexOf('.') + 1));
    }

    private static String optionalSalesMenuText(JsonNode value, String field) {
        JsonNode fieldValue = salesMenuFieldValue(value, field);
        if (fieldValue == null || fieldValue.isMissingNode() || fieldValue.isNull()) return null;
        String result = fieldValue.asText(null);
        return result == null || result.isBlank() ? null : result;
    }

    private static Long optionalSalesMenuLong(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (!value.isIntegralNumber()) throw salesMenuResultProblem(field);
        return value.longValue();
    }

    private static CatalogOwnerApi.Problem salesMenuResultProblem(String field) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, field + " catalog fact is invalid");
    }

    @Override
    public JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return detail(dataNodeRef, brandRef, requestId, itemCode);
    }

    @Override
    public JsonNode readItemSkus(
            String dataNodeRef, String brandRef, String itemCode, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return itemSkus(dataNodeRef, brandRef, itemCode, requestId, request);
    }

    @Override
    public CatalogOwnerApi.AttributeDefinitionListReadback listAttributeDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage) {
        requireScope(dataNodeRef, brandRef);
        return new CatalogOwnerApi.AttributeDefinitionListReadback(
                definitionFacts.listAttributes(dataNodeRef, brandRef, candidateUsage));
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
    public CatalogOwnerApi.AttributeDefinitionReadback transitionAttributeDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                typedCommandScope(context, "transitionOperationsCatalogAttributeDefinitionStatus");
        return definitionFacts.transitionAttributeStatus(
                scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    public CatalogOwnerApi.UnitDefinitionListReadback listUnitDefinitions(
            String dataNodeRef,
            String brandRef,
            boolean includeInactive,
            CatalogOwnerApi.UnitDimension dimension,
            String query,
            String status) {
        requireScope(dataNodeRef, brandRef);
        List<CatalogOwnerApi.UnitDefinitionReadback> units =
                unitDefinitionFacts.list(dataNodeRef, brandRef, includeInactive, dimension, query, status);
        Set<UUID> referencedUnitRefs = unitDefinitionFacts.referencedRefs(units.stream()
                .map(CatalogOwnerApi.UnitDefinitionReadback::unitRef)
                .toList());
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
    public CatalogOwnerApi.UnitDefinitionReadback transitionUnitStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogUnitStatus");
        inventory.validateCatalogUnitLifecycle(
                context,
                command.unitRef(),
                "VOIDED".equals(command.targetStatus())
                        ? InventoryOwnerApi.CatalogUnitLifecycleChange.DELETE
                        : InventoryOwnerApi.CatalogUnitLifecycleChange.DISABLE);
        return unitDefinitionFacts.transition(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Override
    public CatalogOwnerApi.OrderOptionDefinitionListReadback listOrderOptionDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage) {
        requireScope(dataNodeRef, brandRef);
        return new CatalogOwnerApi.OrderOptionDefinitionListReadback(
                definitionFacts.listOrderOptions(dataNodeRef, brandRef, candidateUsage));
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
    public CatalogOwnerApi.OrderOptionDefinitionReadback transitionOrderOptionDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                typedCommandScope(context, "transitionOperationsCatalogOrderOptionDefinitionStatus");
        return definitionFacts.transitionOrderOptionStatus(
                scope.dataNodeId().toString(), scope.brandRef(), command, now());
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
        // A just-created category is isolated inside this transaction: no concurrent command can attach a child or
        // an item relation before this commit. Re-querying the category, its subtree and references only to rediscover
        // those three facts creates avoidable owner round trips.
        return createdCategoryReadback(categoryCommandRow(result));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryReadback updateCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "updateOperationsCatalogCategory");
        String dataNodeRef = scope.dataNodeId().toString();
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("name", command.name());
        requireScope(dataNodeRef, scope.brandRef());
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            return updateTypedCategory(
                    dataNodeRef, scope.brandRef(), command, idempotencyKey, receiptRequest(request, scope.brandRef()));
        }
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryReadback moveCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryMoveCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "moveOperationsCatalogCategory");
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

    @Override
    @Transactional
    public CatalogOwnerApi.CategoryReadback transitionCategoryStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.CategoryStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = typedCommandScope(context, "transitionOperationsCatalogCategoryStatus");
        ObjectNode request = mapper.createObjectNode()
                .put("categoryRef", command.categoryRef().toString())
                .put("expectedVersion", command.expectedVersion())
                .put("targetStatus", command.targetStatus());
        JsonNode result = executeWrite(
                context,
                "transitionOperationsCatalogCategoryStatus",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
        return categoryReadback(scope.dataNodeId().toString(), scope.brandRef(), categoryCommandRow(result));
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

    /**
     * Converts only a closed set of owner business problems into item results. Unknown failures must remain
     * request-level failures so the receipt cannot hide a broken transaction boundary.
     */
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

    /**
     * Compact VOID item path. The receipt transaction already owns the batch-start catalog-item advisory locks and
     * re-read the scoped rows after that linearization point. The inventory owner performs its own current-row
     * validation and retirement in one statement; the final catalog CAS remains the per-item authoritative recheck.
     */
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
        List<Long> versions = jdbc.query(
                "UPDATE catalog.catalog_item SET status=?,version=version+1,updated_at_epoch_millis=? "
                        + "WHERE item_ref=? AND data_node_ref=? AND brand_ref=? AND version=? AND status <> 'VOIDED' "
                        + "RETURNING version",
                (result, rowNumber) -> result.getLong(1),
                "VOIDED",
                now(),
                current.ref(),
                dataNodeRef,
                brandRef,
                item.expectedVersion());
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

    /**
     * Loads the batch's identity set once, then hydrates only the rows in the caller's scope. A VOIDED batch first
     * acquires the shared catalog-item locks, re-reads the scoped rows after that linearization point, and set-loads
     * every blocker fact. Each item transaction still locks and re-reads its scalar row before mutation; the preloaded
     * blocker facts are used only while those shared locks remain held by the receipt transaction.
     */
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
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        String scopePredicate = scopedOnly ? "data_node_ref=? AND brand_ref=? AND " : "";
        List<Object> arguments = new ArrayList<>();
        if (scopedOnly) {
            arguments.add(dataNodeRef);
            arguments.add(brandRef);
        }
        arguments.addAll(itemRefs);
        return jdbc.query(
                "SELECT item_ref,code,name,short_name,shape_key,status,sections::text,version,updated_at_epoch_millis,"
                        + "source_scope_ref,data_node_ref,brand_ref FROM catalog.catalog_item WHERE "
                        + scopePredicate
                        + "item_ref IN ("
                        + placeholders
                        + ")",
                (result, rowNumber) -> new BatchStatusCandidate(
                        new ItemRow(
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
                        result.getString(11),
                        result.getString(12)),
                arguments.toArray());
    }

    /** The authoritative per-item lock/recheck boundary. Preloaded relation facts never replace this lock. */
    private ItemRow lockBatchStatusItem(
            String dataNodeRef,
            String brandRef,
            String targetStatus,
            UUID itemRef,
            BatchStatusPreloadedFacts preloaded) {
        List<ItemRow> rows;
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.CAS)) {
            rows = jdbc.query(
                    "SELECT"
                            + " item_ref,code,name,short_name,shape_key,status,sections::text,version,"
                            + "updated_at_epoch_millis,source_scope_ref"
                            + " FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref=?"
                            + " FOR UPDATE",
                    (result, rowNumber) -> new ItemRow(
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
                    dataNodeRef,
                    brandRef,
                    itemRef);
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
        SaveItemResult result = executeSaveWrite(
                context, scope.dataNodeId().toString(), scope.brandRef(), request, context.requestId(), idempotencyKey);
        return new CatalogOwnerApi.CatalogItemSaveReadback(canonicalJson(result.response()), result.projection());
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

    @Override
    @Transactional
    public CatalogOwnerApi.CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.TemporaryPromotionExecuteCommand command,
            String idempotencyKey) {
        return executeTemporaryCatalogItemPromotionWithProjection(context, command, idempotencyKey)
                .readback();
    }

    @Override
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

    /** The coordinator's replay input is the same typed catalog projection that the first execution produced. */
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
        return categoryReadback(scope, brand, category(scope, brand, categoryRef));
    }

    private CatalogOwnerApi.CategoryReadback categoryReadback(String scope, String brand, CategoryRow category) {
        CatalogOwnerApi.CategoryDeletionAvailability deletionAvailability =
                // A VOIDED category is still a governance/readback fact, but it is no longer a
                // candidate for physical deletion.  The ordinary availability query deliberately
                // hides VOIDED roots, so running it after the transition would turn the
                // authoritative terminal readback into a misleading NOT_FOUND error.
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

        coordinationSnapshot = recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);

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
                        case "createOperationsCatalogCategory" -> createCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "updateOperationsCatalogCategory" -> updateCategory(
                                dataNodeRef, brandRef, requestId, request);
                        case "moveOperationsCatalogCategory" -> moveCategory(
                                dataNodeRef, brandRef, requestId, request, coordinationSnapshot);
                        case "transitionOperationsCatalogCategoryStatus" -> transitionCategoryStatus(
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

    /** Save has one additional in-memory projection for the coordinator; the HTTP response remains canonical JSON. */
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
            case "updateOperationsCatalogCategory" -> {
                CategoryRow current = lockCategory(scope, brand, UUID.fromString(required(request, "categoryRef")));
                long expected = requiredLong(request, "expectedVersion", -1);
                if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
                }
            }
            case "transitionOperationsCatalogCategoryStatus" -> {
                CategoryRow current =
                        lockCategoryIncludingVoided(scope, brand, UUID.fromString(required(request, "categoryRef")));
                long expected = requiredLong(request, "expectedVersion", -1);
                if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
                }
            }
            case "moveOperationsCatalogCategory" -> {
                // The move body takes the same hierarchy guard before it relies on this locked row. Keeping the
                // order here prevents the receipt precheck from inverting the concurrent reparent lock order.
                lockCategoryHierarchy(scope, brand);
                CategoryRow current = lockCategory(scope, brand, UUID.fromString(required(request, "categoryRef")));
                long expected = requiredLong(request, "expectedVersion", -1);
                if (expected >= 0 && current.version() != expected && current.version() != expected + 1L) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "分类版本已变化");
                }
                return new CatalogCoordinationSnapshot(null, current);
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
                idempotencyKey,
                null,
                null);
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
    @Transactional(readOnly = true)
    public CatalogOwnerApi.LocalCopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        LocalCopyPlan plan = localCopyPlan(scope.dataNodeId().toString(), scope.brandRef(), request);
        ObjectNode envelope = envelope(
                context.requestId(),
                localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request, plan));
        return new PreparedLocalCopy(
                plan,
                new CatalogOwnerApi.CopyPreflightReadback(
                        envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope)));
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
        return copyExecutionReadback(copyLocal(
                context,
                "executeOperationsLocalCatalogCopy",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                null));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey,
            CatalogOwnerApi.LocalCopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedLocalCopy prepared))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog local copy preparation is invalid");
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = localCopyRequest(command);
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        return copyExecutionReadback(copyLocal(
                null,
                "executeOperationsLocalCatalogCopy",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                prepared.plan()));
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
    @Transactional(readOnly = true)
    public CatalogOwnerApi.BrandCopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = brandCopyRequest(command.selectedItemCodes(), command.targetDataNodeRef());
        String sourceDataNodeRef = copySourceDataNodeRef(scope);
        String targetDataNodeRef = scope.dataNodeId().toString();
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), request);
        CopyCompatibility compatibility = validateCopyCompatibility(
                sourceDataNodeRef,
                targetDataNodeRef,
                scope.brandRef(),
                plan.graph(),
                plan.targetCopyFacts(),
                request,
                false);
        ObjectNode envelope = envelope(
                context.requestId(),
                copyPreflight(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), plan, compatibility));
        return new PreparedBrandCopy(
                plan,
                compatibility,
                new CatalogOwnerApi.CopyPreflightReadback(
                        envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope)));
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
        String sourceDataNodeRef = copySourceDataNodeRef(scope);
        String targetDataNodeRef = scope.dataNodeId().toString();
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), request);
        CopyCompatibility compatibility = validateCopyCompatibility(
                sourceDataNodeRef,
                targetDataNodeRef,
                scope.brandRef(),
                plan.graph(),
                plan.targetCopyFacts(),
                request,
                true);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                compatibility.compatibilityResults(), command.compatibilityDispositions());
        return copyExecutionReadback(executeCopy(
                "executeOperationsBrandCatalogCopy",
                sourceDataNodeRef,
                targetDataNodeRef,
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                plan,
                compatibility));
    }

    @Override
    @Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey,
            CatalogOwnerApi.BrandCopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedBrandCopy prepared))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog brand copy preparation is invalid");
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = brandCopyRequest(command.selectedItemCodes(), command.targetDataNodeRef());
        request.put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        CopyCompatibility compatibility = mergePreparedReferenceMappings(prepared.compatibility(), request);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                compatibility.compatibilityResults(), command.compatibilityDispositions());
        return copyExecutionReadback(executeCopy(
                "executeOperationsBrandCatalogCopy",
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                prepared.plan(),
                compatibility));
    }

    private void applyLocalCopyReferencePlan(ObjectNode request, String canonicalPlan) {
        if (canonicalPlan == null || canonicalPlan.isBlank()) return;
        try {
            JsonNode plan = mapper.readTree(canonicalPlan);
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field : List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "copy reference plan is invalid", failure);
        }
    }

    private ObjectNode localCopyRequest(CatalogOwnerApi.LocalCopyExecuteCommand command) {
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
        return request;
    }

    private ObjectNode brandCopyRequest(List<String> selectedItemCodes, String targetDataNodeRef) {
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", targetDataNodeRef);
        request.set("selectedItemCodes", mapper.valueToTree(selectedItemCodes));
        return request;
    }

    private CopyCompatibility mergePreparedReferenceMappings(CopyCompatibility prepared, ObjectNode request) {
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>(prepared.mapping());
        suppliedReferenceMappings(request).forEach((key, target) -> {
            String previous = mapping.putIfAbsent(key, target);
            if (previous != null && !previous.equals(target)) {
                String problemMessage = "多个 owner 对同一 sourceRef 给出了冲突 targetRef";
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, problemMessage);
            }
        });
        return new CopyCompatibility(
                Map.copyOf(mapping),
                prepared.compatibilityResults().deepCopy(),
                prepared.targetRows(),
                prepared.targetUnits());
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
            String idempotencyKey,
            CatalogCopyPlan preparedPlan,
            CopyCompatibility preparedCompatibility) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        if (operationId.contains("Local"))
            return copyLocal(null, operationId, sourceDataNodeRef, brandRef, request, requestId, idempotencyKey);
        CatalogCopyPlan plan = preparedPlan == null
                ? catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, brandRef, request)
                : preparedPlan;
        List<String> selected = plan.selected();
        CatalogClosure graph = plan.graph();
        List<ItemRow> source = graph.items();
        long sourceVersion = plan.sourceVersion();
        long targetVersion = plan.targetVersion();
        String currentDigest = plan.digest();
        CopyCompatibility compatibility = preparedCompatibility == null
                ? validateCopyCompatibility(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, graph, plan.targetCopyFacts(), request, true)
                : preparedCompatibility;
        rejectPreparedBlockingCompatibility(compatibility.compatibilityResults());
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                compatibility.compatibilityResults(), request.path("compatibilityDispositions"));
        assertNoOwnerReferenceLeak(graph, compatibility.mapping(), sourceDataNodeRef);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay =
                    replay(targetDataNodeRef, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef));
            if (replay != null) return replayCopyIfCurrent(replay, currentDigest);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
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
            // Copy may reuse a target category by code.  That target can sit at
            // a different depth than the source category, so the ordinary
            // create/move guards are not reached by INSERT ... ON CONFLICT.
            // Lock and validate the effective target tree before any category
            // write; a copy never silently flattens or reparents a hierarchy.
            lockCategoryHierarchy(targetDataNodeRef, brandRef);
            assertCopiedCategoryDepth(targetDataNodeRef, brandRef, categories);
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
                                    + "(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (data_node_ref,brand_ref,code) "
                                    + "WHERE status <> 'VOIDED' DO NOTHING",
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
                JsonNode copiedImages = rewrittenSections.path("images");
                JsonNode copiedProductionTagRef = rewrittenSections.path("productionTagRef");
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
                        new CatalogItemReferenceFacts.CopyValues(copiedProductionTagRef, copiedTagRefs)));
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
            List<CopiedUnitInput> copiedUnitInputs = new ArrayList<>();
            for (int index = 0; index < items.size(); index++)
                if (itemChanges[index] == 1) {
                    PreparedCopyItem item = items.get(index);
                    copiedUnitInputs.add(new CopiedUnitInput(item.targetRef(), item.sections(), item.skus()));
                }
            writeCopiedEffectiveUnitFactsBatch(targetDataNodeRef, brandRef, copiedUnitInputs);
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
            Map<UUID, UUID> optionValueMappings =
                    uuidMappings(compatibility.mapping(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
            for (PreparedCopyItem item : items) {
                if (!copiedDefinitionItemsBySource.containsKey(item.source().ref())) continue;
                Map<UUID, UUID> skuMapping = sourceToTargetSkuRefs(item.source(), item.skus());
                identifierFacts.copyWithinScope(
                        targetDataNodeRef, brandRef, item.source().ref(), item.targetRef(), skuMapping);
                preparationFacts.copyWithinScope(
                        item.source().ref(), item.targetRef(), skuMapping, optionValueMappings);
            }
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
            Map<String, ItemRow> targetItemsByRef = new LinkedHashMap<>();
            compatibility
                    .targetRows()
                    .values()
                    .forEach(row -> targetItemsByRef.put(row.ref().toString(), row));
            compatibility
                    .mapping()
                    .forEach((from, to) -> referenceMappings.add(
                            "PRODUCTION_TAG".equals(from.objectType())
                                    ? productionReferenceMappingRow(request, from, to)
                                    : referenceMappingRow(from, to, graph, targetItemsByRef)));
            ArrayNode targetVersions = data.putArray("targetVersions");
            loadItemIdentityRows(
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
        return copyLocal(commandContext, operationId, scope, brandRef, request, requestId, idempotencyKey, null);
    }

    private JsonNode copyLocal(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String operationId,
            String scope,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            LocalCopyPlan preparedPlan) {
        LocalCopyPlan plan = preparedPlan == null ? localCopyPlan(scope, brandRef, request) : preparedPlan;
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
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
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
                    ArrayNode sourceAssignments =
                            sourceSections.path("attributeAssignments").isArray()
                                    ? (ArrayNode) sourceSections.path("attributeAssignments")
                                    : mapper.createArrayNode();
                    ArrayNode sourceConfigs =
                            sourceSections.path("orderOptionConfigs").isArray()
                                    ? (ArrayNode) sourceSections.path("orderOptionConfigs")
                                    : mapper.createArrayNode();
                    itemDefinitionFacts.copyCurrentFactsWithinScope(
                            scope, brandRef, target.ref(), sourceAssignments, sourceConfigs);
                } else if (sourceSections.has(key))
                    merged.set(key, sourceSections.path(key).deepCopy());
            }
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
            ArrayNode effectiveSkus = copiedSkus == null
                    ? skuFacts.readByItemRefs(List.of(target.ref()))
                            .getOrDefault(target.ref(), mapper.createArrayNode())
                    : copiedSkus;
            if (copyBasicInfo
                    || copiedSkus != null
                    || selectedSectionsElements(selectedSections).contains("PRODUCTION_PROMPTS")) {
                Map<UUID, UUID> skuMapping = sourceToTargetSkuRefs(source, effectiveSkus);
                if (copyBasicInfo) {
                    identifierFacts.copyWithinScope(scope, brandRef, source.ref(), target.ref(), skuMapping);
                }
                if (selectedSectionsElements(selectedSections).contains("PRODUCTION_PROMPTS")) {
                    preparationFacts.copyWithinScope(source.ref(), target.ref(), skuMapping, Map.of());
                    itemReferenceFacts.replace(target.ref(), merged.path("productionTagRef"), merged.path("tagRefs"));
                }
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
            result.put(
                    "receiptObjectFingerprint",
                    localCopyDigest(source, target, selectedSections, localUnits, target.version() + 1));
            if (idempotencyKey != null && !idempotencyKey.isBlank())
                saveReceipt(scope, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef), result);
            return result;
        }
    }

    private ObjectNode localCopyPreflight(String scope, String brandRef, ObjectNode request) {
        return localCopyPreflight(scope, brandRef, request, localCopyPlan(scope, brandRef, request));
    }

    private ObjectNode localCopyPreflight(String scope, String brandRef, ObjectNode request, LocalCopyPlan plan) {
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
        ArrayNode selectedSections =
                request.path("selectedSections").isArray() ? (ArrayNode) request.path("selectedSections") : null;
        validatedLocalCopySections(selectedSections);
        Map<String, ItemRow> itemsByCode = new LinkedHashMap<>();
        loadLocalCopyItems(scope, brandRef, List.of(sourceCode, targetCode), selectedSections)
                .forEach(row -> itemsByCode.put(row.code(), row));
        ItemRow source = itemsByCode.get(sourceCode);
        ItemRow target = itemsByCode.get(targetCode);
        if (source == null || target == null) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        List<UnitRow> units = loadUnits(scope, brandRef, unitReferences(json(source.sectionsJson())));
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
            Set<String> itemRefs = itemReferenceRefs(json(source.sectionsJson()));
            Map<String, String> resolvedItemRefs = activeItemCodesByRef(scope, brandRef, itemRefs);
            if (resolvedItemRefs.size() != itemRefs.size())
                compatibility = new CompatibilityCheck(
                        "BLOCKED",
                        "BOM 引用无法在当前商品库解析",
                        "REFERENCE_MAPPING_UNRESOLVED",
                        "REFERENCE_MAPPING_UNRESOLVED",
                        true);
        }
        return new LocalCopyPlan(
                source,
                target,
                selectedSections,
                localCopyDigest(source, target, selectedSections, units),
                compatibility,
                units);
    }

    /**
     * Local copy is section-scoped. The old generic detail hydration loaded every relational family even when the
     * selected section could not consume it; that turned one copy closure into a fixed fan-out of owner reads. This
     * projection keeps the same ItemRow read shape for the selected facts while loading only the families required by
     * the requested section and the unit snapshot needed by the copy digest.
     */
    private List<ItemRow> loadLocalCopyItems(
            String dataNodeRef, String brandRef, List<String> codes, ArrayNode selectedSections) {
        List<ItemRow> rows = loadItemIdentityRows(dataNodeRef, brandRef, codes);
        if (rows.isEmpty()) return rows;
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        Set<String> selected = selectedSectionsElements(selectedSections);
        boolean loadSkus = selected.contains("SKU_STRUCTURE")
                || selected.contains("BASIC_INFO")
                || selected.contains("PRODUCTION_PROMPTS");
        boolean loadOrderOptions = selected.contains("ORDER_OPTIONS");
        boolean loadComposites = selected.contains("PACKAGE_STRUCTURE");
        boolean loadAxes = selected.contains("SKU_STRUCTURE");
        boolean loadReferences = selected.contains("PRODUCTION_PROMPTS");
        Map<UUID, ArrayNode> skus = loadSkus ? skuFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> attributes =
                loadOrderOptions ? itemDefinitionFacts.readAttributeAssignments(itemRefs) : Map.of();
        Map<UUID, ArrayNode> orderOptions =
                loadOrderOptions ? itemDefinitionFacts.readOrderOptionConfigs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> composites = loadComposites ? compositeFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> axes = loadAxes ? skuVariantAxisFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> images = Map.of();
        Map<UUID, Map<String, JsonNode>> references =
                loadReferences ? itemReferenceFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, CatalogIdentifierFacts.ItemReadback> identifiers =
                loadReferences || loadSkus ? identifierFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, JsonNode> itemProfiles = loadReferences ? preparationFacts.readItemProfiles(itemRefs) : Map.of();
        List<UUID> skuRefs = skus.values().stream()
                .filter(java.util.Objects::nonNull)
                .flatMap(array -> java.util.stream.StreamSupport.stream(array.spliterator(), false))
                .map(sku -> nullableUuid(sku, "productSkuRef"))
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<UUID, JsonNode> skuOverrides = loadReferences ? preparationFacts.readSkuOverrides(skuRefs) : Map.of();
        Map<UUID, Map<UUID, JsonNode>> optionEffects =
                loadReferences ? preparationFacts.readOptionEffects(itemRefs) : Map.of();
        Map<UUID, ItemUnitRefs> units = itemUnitRefsByItemRefs(itemRefs);
        List<ItemRow> projected = new ArrayList<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            if (loadSkus) sections.set("skus", skus.getOrDefault(row.ref(), mapper.createArrayNode()));
            if (loadOrderOptions) {
                sections.set("attributeAssignments", attributes.getOrDefault(row.ref(), mapper.createArrayNode()));
                sections.set("orderOptionConfigs", orderOptions.getOrDefault(row.ref(), mapper.createArrayNode()));
            }
            if (loadComposites)
                sections.set("compositeGroups", composites.getOrDefault(row.ref(), mapper.createArrayNode()));
            if (loadAxes) sections.set("skuVariantDimensions", axes.getOrDefault(row.ref(), mapper.createArrayNode()));
            if (loadReferences) {
                Map<String, JsonNode> itemReferences = references.get(row.ref());
                sections.set(
                        "productionTagRef",
                        itemReferences == null
                                ? mapper.nullNode()
                                : itemReferences.getOrDefault(
                                        CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
                sections.set(
                        "tagRefs",
                        itemReferences == null
                                ? mapper.createArrayNode()
                                : itemReferences.getOrDefault(
                                        CatalogItemReferenceFacts.CATALOG_TAG, mapper.createArrayNode()));
            }
            if (loadReferences || loadSkus) {
                CatalogIdentifierFacts.ItemReadback identifierReadback = identifiers.get(row.ref());
                decoratePreparationFacts(
                        row.ref(),
                        sections,
                        identifierReadback,
                        itemProfiles.get(row.ref()),
                        identifierReadback == null ? Map.of() : identifierReadback.skuIdentifiers(),
                        skuOverrides,
                        optionEffects.getOrDefault(row.ref(), Map.of()));
            }
            ItemUnitRefs unitRefs = units.get(row.ref());
            if (unitRefs == null || unitRefs.salesUnitRef() == null) sections.putNull("salesUnitRef");
            else sections.put("salesUnitRef", unitRefs.salesUnitRef().toString());
            if (unitRefs == null || unitRefs.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
            else
                sections.put("baseMeasureUnitRef", unitRefs.baseMeasureUnitRef().toString());
            putNullableUnitSnapshot(
                    sections, "salesUnitSnapshot", unitRefs == null ? null : unitRefs.salesUnitSnapshot());
            putNullableUnitSnapshot(
                    sections, "baseMeasureUnitSnapshot", unitRefs == null ? null : unitRefs.baseMeasureUnitSnapshot());
            projected.add(new ItemRow(
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
        return List.copyOf(projected);
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
                JsonNode configs = sourceSections.path("orderOptionConfigs");
                if (!configs.isEmpty()) continue;
            }
            if (!hasLocalCopySourceFacts(sourceSections, sectionKey(section))) {
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
            case "ITEM_BOM" -> "inventoryRules";
            case "ORDER_OPTIONS" -> "orderOptionConfigs";
            case "PACKAGE_STRUCTURE" -> "compositeGroups";
            case "PRODUCTION_PROMPTS" -> "preparationProfile";
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "selectedSections contains an unknown section");
        };
    }

    private String localCopyDigest(ItemRow source, ItemRow target, ArrayNode sections, List<UnitRow> units) {
        return localCopyDigest(source, target, sections, units, target.version());
    }

    private String localCopyDigest(
            ItemRow source, ItemRow target, ArrayNode sections, List<UnitRow> units, long targetVersion) {
        ArrayList<String> values = new ArrayList<>();
        sections.forEach(section -> values.add(section.asText()));
        Collections.sort(values);
        if (units != null)
            units.stream()
                    .sorted(java.util.Comparator.comparing(UnitRow::code).thenComparing(UnitRow::ref))
                    .forEach(unit -> values.add(
                            "UNIT:" + unit.ref() + ":" + unit.code() + ":" + unit.name() + ":" + unit.unitDimension()
                                    + ":" + unit.precision() + ":" + unit.status() + ":" + unit.version()));
        return digest(source.code() + "|" + target.code() + "|" + source.version() + "|" + targetVersion + "|"
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

    private Map<UUID, UUID> sourceToTargetSkuRefs(ItemRow source, ArrayNode targetSkus) {
        Map<String, UUID> targetByCode = new LinkedHashMap<>();
        if (targetSkus != null)
            for (JsonNode sku : targetSkus) {
                UUID targetRef = nullableUuid(sku, "productSkuRef");
                if (targetRef != null) targetByCode.put(sku.path("skuCode").asText(), targetRef);
            }
        Map<UUID, UUID> result = new LinkedHashMap<>();
        JsonNode sourceSkus = json(source.sectionsJson()).path("skus");
        if (sourceSkus.isArray())
            for (JsonNode sku : sourceSkus) {
                UUID sourceRef = nullableUuid(sku, "productSkuRef");
                UUID targetRef = targetByCode.get(sku.path("skuCode").asText());
                if (sourceRef != null && targetRef != null) result.put(sourceRef, targetRef);
            }
        return result;
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
        if (refs.isEmpty()) return Set.of();
        // Asset references are intentionally shared across catalog scopes.  Keep
        // that global lifecycle judgment, but evaluate the whole candidate set
        // across both owner-local media tables in one set query.  The previous
        // two-table implementation had already removed the 2N EXISTS pattern;
        // this UNION removes the remaining fixed two-round-trip tax without
        // changing the owner, status filter, or candidate-set semantics.
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.addAll(refs);
        java.util.Set<UUID> referencedRefs = new java.util.LinkedHashSet<>(jdbc.query(
                "SELECT DISTINCT asset_ref FROM ("
                        + "SELECT image.asset_ref FROM catalog.catalog_item_image image "
                        + "JOIN catalog.catalog_item item ON item.item_ref=image.item_ref "
                        + "WHERE image.asset_ref IN (" + placeholders + ") AND item.status <> 'VOIDED' "
                        + "UNION "
                        + "SELECT media.asset_ref FROM catalog.catalog_sku_media media "
                        + "JOIN catalog.catalog_sku sku ON sku.product_sku_ref=media.product_sku_ref "
                        + "JOIN catalog.catalog_item item ON item.item_ref=sku.item_ref "
                        + "WHERE media.asset_ref IN (" + placeholders + ") AND item.status <> 'VOIDED'"
                        + ") referenced_assets",
                (result, row) -> result.getObject(1, UUID.class),
                arguments.toArray()));
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
        // Inventory owns BOM rows and their consumption references. Catalog has no persisted BOM payload to scan;
        // the catalog/inventory coordinator exposes the task read from the inventory owner instead.
        return mapper.createArrayNode();
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
                        + ") AND item.status <> 'VOIDED' AND sku.status <> 'VOIDED' ORDER BY "
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
        ArrayNode tree = data.putArray("tree");
        jdbc.query(
                "WITH RECURSIVE visible_categories AS MATERIALIZED (SELECT category_ref,code,name,"
                        + "parent_category_ref,version,display_order FROM catalog.catalog_category WHERE "
                        + "data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'), category_order(category_ref,"
                        + "order_path) AS (SELECT category.category_ref,ARRAY[LPAD(category.display_order::text,"
                        + "10,'0') || ':' || category.code]::text[] FROM visible_categories category WHERE "
                        + "category.parent_category_ref IS NULL OR NOT EXISTS (SELECT 1 FROM visible_categories "
                        + "parent WHERE parent.category_ref=category.parent_category_ref) UNION ALL SELECT "
                        + "child.category_ref,array_append(parent.order_path,LPAD(child.display_order::text,10,'0') "
                        + "|| ':' || child.code) FROM category_order parent JOIN visible_categories child ON "
                        + "child.parent_category_ref=parent.category_ref), category_subtree(root_category_ref,"
                        + "category_ref) AS (SELECT category_ref,category_ref FROM visible_categories UNION SELECT "
                        + "subtree.root_category_ref,child.category_ref FROM category_subtree subtree JOIN "
                        + "visible_categories child ON child.parent_category_ref=subtree.category_ref), direct_counts "
                        + "AS (SELECT relation.category_ref,"
                        + "COUNT(DISTINCT item.item_ref) AS direct_count "
                        + "FROM catalog.catalog_item_category relation JOIN catalog.catalog_item item ON "
                        + "item.item_ref=relation.item_ref "
                        + "WHERE item.data_node_ref=? AND item.brand_ref=? AND item.status <> 'VOIDED' "
                        + "GROUP BY relation.category_ref), "
                        + "blocking_items AS (SELECT DISTINCT subtree.root_category_ref,item.item_ref,item.code,"
                        + "item.name "
                        + "FROM category_subtree subtree JOIN catalog.catalog_item_category relation "
                        + "ON relation.category_ref=subtree.category_ref JOIN catalog.catalog_item item "
                        + "ON item.item_ref=relation.item_ref AND item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.status <> 'VOIDED'), subtree_sizes AS (SELECT root_category_ref,"
                        + "COUNT(DISTINCT category_ref) AS subtree_size FROM category_subtree "
                        + "GROUP BY root_category_ref), subtree_counts AS (SELECT root_category_ref,"
                        + "COUNT(DISTINCT item_ref) AS subtree_count FROM blocking_items GROUP BY root_category_ref), "
                        + "blocking_stats AS (SELECT root_category_ref,"
                        + "COUNT(DISTINCT item_ref) AS blocking_reference_count,"
                        + "COALESCE(jsonb_agg(jsonb_build_object('referenceKind','CATALOG_ITEM','referenceRef',"
                        + "item_ref,'code',code,'name',name,'direction','INBOUND') ORDER BY code),"
                        + "'[]'::jsonb) AS blocking_reference_facts FROM blocking_items "
                        + "GROUP BY root_category_ref) "
                        + "SELECT c.category_ref,c.code,c.name,c.parent_category_ref,c.version,c.display_order,"
                        + "COALESCE(direct_counts.direct_count,0),COALESCE(subtree_counts.subtree_count,0),"
                        + "COALESCE(subtree_sizes.subtree_size,1),"
                        + "COALESCE(blocking_stats.blocking_reference_count,0),"
                        + "COALESCE(blocking_stats.blocking_reference_facts,'[]'::jsonb) "
                        + "FROM visible_categories c LEFT JOIN category_order ordered ON "
                        + "ordered.category_ref=c.category_ref LEFT JOIN direct_counts ON "
                        + "direct_counts.category_ref=c.category_ref "
                        + "LEFT JOIN subtree_counts ON subtree_counts.root_category_ref=c.category_ref "
                        + "LEFT JOIN subtree_sizes ON subtree_sizes.root_category_ref=c.category_ref "
                        + "LEFT JOIN blocking_stats ON blocking_stats.root_category_ref=c.category_ref "
                        + "ORDER BY ordered.order_path NULLS LAST,c.parent_category_ref NULLS FIRST,"
                        + "c.display_order,c.code",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setString(3, dataNodeRef);
                    statement.setString(4, brandRef);
                    statement.setString(5, dataNodeRef);
                    statement.setString(6, brandRef);
                },
                result -> {
                    while (result.next()) {
                        String categoryRef = result.getObject(1, UUID.class).toString();
                        long directCount = result.getLong(7);
                        long count = result.getLong(8);
                        long subtreeSize = result.getLong(9);
                        long blockingCount = result.getLong(10);
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
                        node.put("count", count)
                                .put("directCount", directCount)
                                .put("countSemantics", "SELF_AND_DESCENDANTS");
                        ObjectNode deletion = node.putObject("deletionAvailability");
                        deletion.put("canDelete", blockingCount == 0)
                                .put("subtreeSize", subtreeSize)
                                .put("blockingReferenceCount", blockingCount);
                        try {
                            JsonNode blockingReferenceFacts = mapper.readTree(result.getString(11));
                            deletion.putObject("blockingReferences")
                                    .put("count", blockingCount)
                                    .set(
                                            "references",
                                            blockingReferenceFacts == null || !blockingReferenceFacts.isArray()
                                                    ? mapper.createArrayNode()
                                                    : blockingReferenceFacts);
                        } catch (Exception failure) {
                            // spotless:off
                            throw new CatalogOwnerApi.Problem(
                                    "RESULT_UNKNOWN", 500, "分类阻断引用读取失败", failure);
                            // spotless:on
                        }
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
        ArrayNode productionTagNodes = data.putArray("productionTags");
        List<ProductionTagOwnerApi.ProductionTagNavigationReadback> productionTagDefinitions = productionTags == null
                ? List.of()
                : productionTags.readNavigationTags(dataNodeRef, brandRef, requestId);
        Map<UUID, Long> productionTagCounts = productionTagReferenceCounts(
                dataNodeRef,
                brandRef,
                productionTagDefinitions.stream()
                        .map(ProductionTagOwnerApi.ProductionTagNavigationReadback::tagRef)
                        .toList());
        for (ProductionTagOwnerApi.ProductionTagNavigationReadback tag : productionTagDefinitions) {
            productionTagNodes
                    .addObject()
                    .put("tagRef", tag.tagRef().toString())
                    .put("code", tag.code())
                    .put("name", tag.name())
                    .put("status", tag.status())
                    .put("owner", "fulfillment-production")
                    .put("count", productionTagCounts.getOrDefault(tag.tagRef(), 0L));
        }
        ArrayNode views = data.putArray("smartViews");
        Map<String, Long> smartCounts = new LinkedHashMap<>();
        ArrayNode counts = data.putArray("shapeCounts");
        Map<String, Long> shapeCounts = new LinkedHashMap<>();
        long[] generation = {0L};
        long[] allCount = {0L};
        long[] uncategorizedCount = {0L};
        jdbc.query(
                "SELECT shape_key, COUNT(*), COALESCE(MAX(version),0), "
                        + "COUNT(*) FILTER (WHERE "
                        + "COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='EXTE"
                        + "RNAL_ORDER_TEMPORARY'), "
                        + "COUNT(*) FILTER (WHERE status='DISABLED'), "
                        + "COUNT(*) FILTER (WHERE updated_at_epoch_millis >= ?), "
                        + "COUNT(*) FILTER (WHERE "
                        + "COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='AUTO"
                        + "_SYNC'), COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "
                        + "catalog.catalog_item_category relation WHERE relation.item_ref=catalog_item.item_ref)) "
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
                        allCount[0] += result.getLong(2);
                        smartCounts.merge("EXTERNAL_ORDER_TEMP", result.getLong(4), Long::sum);
                        smartCounts.merge("INACTIVE", result.getLong(5), Long::sum);
                        smartCounts.merge("RECENTLY_UPDATED", result.getLong(6), Long::sum);
                        smartCounts.merge("AUTO_SYNC", result.getLong(7), Long::sum);
                        uncategorizedCount[0] += result.getLong(8);
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
        data.put("allCount", allCount[0]);
        data.put("uncategorizedCount", uncategorizedCount[0]);
        data.put("generation", generation[0]);
        return envelope(requestId, data);
    }

    private Map<UUID, Long> productionTagReferenceCounts(
            String dataNodeRef, String brandRef, List<UUID> productionTagDefinitionRefs) {
        if (productionTagDefinitionRefs == null || productionTagDefinitionRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(productionTagDefinitionRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(CatalogItemReferenceFacts.PRODUCTION_TAG);
        arguments.add(dataNodeRef);
        arguments.add(brandRef);
        arguments.addAll(refs);
        Map<UUID, Long> counts = new LinkedHashMap<>();
        jdbc.query(
                "SELECT relation.ref, COUNT(DISTINCT relation.item_ref) "
                        + "FROM catalog.catalog_item_reference relation "
                        + "JOIN catalog.catalog_item item ON item.item_ref=relation.item_ref "
                        + "WHERE relation.kind=? AND item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.status <> 'VOIDED' AND relation.ref IN (" + placeholders + ") "
                        + "GROUP BY relation.ref",
                (result, row) -> {
                    counts.put(result.getObject(1, UUID.class), result.getLong(2));
                    return null;
                },
                arguments.toArray());
        return Map.copyOf(counts);
    }

    private ObjectNode categoryCandidates(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String usage = required(request, "usage");
        if (!Set.of("ITEM_ASSIGNMENT", "CATEGORY_CREATE", "CATEGORY_REPARENT").contains(usage))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "分类选择用途无效");
        UUID currentCategoryRef = optionalUuid(request, "currentCategoryRef");
        UUID parentCategoryRef = optionalUuid(request, "parentCategoryRef");
        if ("CATEGORY_REPARENT".equals(usage) && currentCategoryRef == null)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "分类调整必须提供当前分类");
        if (("ITEM_ASSIGNMENT".equals(usage) || "CATEGORY_CREATE".equals(usage)) && currentCategoryRef != null)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "当前分类只用于调整分类层级");
        String keyword = optional(request, "keyword");
        if (keyword != null && keyword.isBlank()) keyword = null;
        int pageSize = parsePageSize(request, "pageSize", 20);
        String identity = cursorIdentity(
                "category-candidates",
                dataNodeRef,
                brandRef,
                usage,
                currentCategoryRef == null ? null : currentCategoryRef.toString(),
                parentCategoryRef == null ? null : parentCategoryRef.toString(),
                keyword,
                Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, identity);
        int cursorDisplayOrder = -1;
        String cursorName = null;
        String cursorCode = null;
        UUID cursorRef = null;
        if (cursor != null) {
            String[] parts = cursor.sortKey().split("\\|", 3);
            try {
                if (parts.length != 3) throw new IllegalArgumentException();
                cursorDisplayOrder = Integer.parseInt(parts[0]);
                cursorName = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                cursorCode = parts[2];
                cursorRef = cursor.tieBreaker();
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
            }
        }
        String cte = "WITH RECURSIVE category_tree AS ("
                + "SELECT c.category_ref,c.code,c.name,c.parent_category_ref,c.display_order,"
                + "ARRAY[c.category_ref]::uuid[] AS path_refs,"
                + "jsonb_build_array(jsonb_build_object('categoryRef',c.category_ref::text,'code',c.code,"
                + "'name',c.name)) AS path_json "
                + "FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? "
                + "AND c.status = 'ENABLED' AND c.parent_category_ref IS NULL "
                + "UNION ALL "
                + "SELECT child.category_ref,child.code,child.name,child.parent_category_ref,child.display_order,"
                + "parent.path_refs || child.category_ref,"
                + "parent.path_json || jsonb_build_array(jsonb_build_object('categoryRef',"
                + "child.category_ref::text,'code',child.code,'name',child.name)) "
                + "FROM catalog.catalog_category child JOIN category_tree parent ON "
                + "parent.category_ref=child.parent_category_ref "
                + "WHERE child.data_node_ref=? AND child.brand_ref=? AND child.status = 'ENABLED'"
                + ") ";
        StringBuilder matchingVisibility = new StringBuilder();
        List<Object> matchingVisibilityArgs = new ArrayList<>();
        if (keyword == null) {
            if (parentCategoryRef == null) matchingVisibility.append("category_tree.parent_category_ref IS NULL");
            else {
                matchingVisibility.append("category_tree.parent_category_ref=?");
                matchingVisibilityArgs.add(parentCategoryRef);
            }
        } else {
            matchingVisibility.append("EXISTS (SELECT 1 FROM category_tree matched WHERE category_tree.category_ref = "
                    + "ANY(matched.path_refs) "
                    + "AND (LOWER(matched.code) LIKE ? OR LOWER(matched.name) LIKE ?))");
            String pattern = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
            matchingVisibilityArgs.add(pattern);
            matchingVisibilityArgs.add(pattern);
        }
        StringBuilder cursorPredicate = new StringBuilder();
        List<Object> cursorArgs = new ArrayList<>();
        if (cursor != null) {
            cursorPredicate.append(" WHERE (display_order>? OR (display_order=? AND name>?) "
                    + "OR (display_order=? AND name=? AND code>?) "
                    + "OR (display_order=? AND name=? AND code=? AND category_ref>?))");
            cursorArgs.add(cursorDisplayOrder);
            cursorArgs.add(cursorDisplayOrder);
            cursorArgs.add(cursorName);
            cursorArgs.add(cursorDisplayOrder);
            cursorArgs.add(cursorName);
            cursorArgs.add(cursorCode);
            cursorArgs.add(cursorDisplayOrder);
            cursorArgs.add(cursorName);
            cursorArgs.add(cursorCode);
            cursorArgs.add(cursorRef);
        }
        String cycleBlocked = currentCategoryRef == null ? "false" : "(?::uuid = ANY(category_tree.path_refs))";
        String categoryDepthLimit = Integer.toString(CATALOG_CATEGORY_MAX_DEPTH);
        String createDepthBlocked = "(array_length(category_tree.path_refs, 1) >= " + categoryDepthLimit + ")";
        String relativeDescendantDepth = "array_length(descendant.path_refs, 1) - " + categoryDescendantPositionSql();
        String depthBlocked =
                switch (usage) {
                    case "CATEGORY_CREATE" -> createDepthBlocked;
                    case "CATEGORY_REPARENT" -> "(array_length(category_tree.path_refs, 1) + (SELECT COALESCE(MAX("
                            + relativeDescendantDepth
                            + "), 1) "
                            + "FROM category_tree descendant WHERE ?::uuid = ANY(descendant.path_refs)) > "
                            + CATALOG_CATEGORY_MAX_DEPTH + ")";
                    default -> "false";
                };
        String sql = cte + ", matching AS (SELECT category_tree.category_ref,category_tree.code,category_tree.name,"
                + "category_tree.parent_category_ref,category_tree.display_order,"
                + "EXISTS (SELECT 1 FROM catalog.catalog_category child WHERE child.data_node_ref=? AND "
                + "child.brand_ref=? "
                + "AND child.parent_category_ref=category_tree.category_ref AND child.status = 'ENABLED'),"
                + "category_tree.path_json," + cycleBlocked + " AS cycle_blocked," + depthBlocked
                + " AS depth_blocked FROM category_tree WHERE " + matchingVisibility
                + "), aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS (SELECT * FROM matching"
                + cursorPredicate + " ORDER BY display_order,name,code,category_ref LIMIT ?) "
                + "SELECT paged.*,aggregate.total FROM aggregate LEFT JOIN paged ON TRUE "
                + "ORDER BY paged.display_order,paged.name,paged.code,paged.category_ref";
        // The child-existence projection and optional reparent guard bind before
        // matching and cursor predicates.
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef, dataNodeRef, brandRef));
        args.add(dataNodeRef);
        args.add(brandRef);
        if (currentCategoryRef != null) args.add(currentCategoryRef);
        if ("CATEGORY_REPARENT".equals(usage)) {
            args.add(currentCategoryRef);
            args.add(currentCategoryRef);
        }
        args.addAll(matchingVisibilityArgs);
        args.addAll(cursorArgs);
        args.add(pageSize + 1);
        List<CategoryCandidateRow> rows = jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.size(); index++) statement.setObject(index + 1, args.get(index));
                },
                (result, row) -> new CategoryCandidateRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getObject(4, UUID.class),
                        result.getInt(5),
                        result.getBoolean(6),
                        result.getString(7),
                        result.getBoolean(8),
                        result.getBoolean(9),
                        result.getLong(10)));
        long total = rows.isEmpty() ? 0L : rows.getFirst().total();
        rows.removeIf(row -> row.categoryRef() == null);
        boolean hasNext = rows.size() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        ObjectNode data = mapper.createObjectNode();
        ArrayNode items = data.putArray("items");
        for (CategoryCandidateRow row : rows) {
            ObjectNode item = items.addObject()
                    .put("categoryRef", row.categoryRef().toString())
                    .put("code", row.code())
                    .put("name", row.name())
                    .put("displayOrder", row.displayOrder())
                    .put("hasChildren", row.hasChildren())
                    .put("selectable", !row.cycleBlocked() && !row.depthBlocked());
            putNullableUuid(item, "parentCategoryRef", row.parentCategoryRef());
            try {
                JsonNode path = mapper.readTree(row.pathJson());
                item.set("path", path.isArray() ? path : mapper.createArrayNode());
            } catch (Exception failure) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "分类路径读取失败", failure);
            }
            if (row.cycleBlocked()) item.put("disabledReason", "不能选择当前分类或其下级分类");
            else if (row.depthBlocked()) {
                item.put("disabledReason", categoryDepthDisabledReason(usage));
            } else item.putNull("disabledReason");
        }
        data.put("total", total);
        String echoed = optional(request, "cursor");
        if (echoed == null) data.putNull("cursor");
        else data.put("cursor", echoed);
        if (hasNext) {
            CategoryCandidateRow last = rows.getLast();
            data.put(
                    "nextCursor",
                    OpaqueCollectionCursor.encode(
                            identity,
                            categoryCandidateSortKey(last.displayOrder(), last.name(), last.code()),
                            last.categoryRef()));
        } else data.putNull("nextCursor");
        return envelope(requestId, data);
    }

    private static String categoryCandidateSortKey(int displayOrder, String name, String code) {
        return String.format(
                Locale.ROOT,
                "%010d|%s|%s",
                displayOrder,
                Base64.getUrlEncoder().withoutPadding().encodeToString(name.getBytes(StandardCharsets.UTF_8)),
                code);
    }

    private ObjectNode itemSkus(
            String dataNodeRef, String brandRef, String itemCode, String requestId, ObjectNode request) {
        if (itemCode == null || itemCode.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCode不能为空");
        String candidateUsage = optional(request, "candidateUsage");
        if (candidateUsage != null && !"COMPOSITE_COMPONENT".equals(candidateUsage))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "candidateUsage is not supported");
        String skuStatusPredicate =
                "COMPOSITE_COMPONENT".equals(candidateUsage) ? "sku.status = 'ENABLED'" : "sku.status <> 'VOIDED'";
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
        StringBuilder sql = new StringBuilder("WITH item_scope AS (SELECT item_ref,preparation_profile FROM "
                + "catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND status <> 'VOIDED'), "
                + "matching AS (SELECT sku.product_sku_ref,sku.sku_code,sku.sku_name,"
                + "sku.standard_sale_price,"
                + "sku.sales_unit_override_ref,sku.sales_unit_ref,sku.sales_unit_code,sku.sales_unit_name,"
                + "sku.sales_unit_dimension,sku.sales_unit_precision,COALESCE(sales_unit.status,'ENABLED'),"
                + "sku.base_measure_unit_override_ref,sku.base_measure_unit_ref,sku.base_measure_unit_code,"
                + "sku.base_measure_unit_name,sku.base_measure_unit_dimension,sku.base_measure_unit_precision,"
                + "COALESCE(base_unit.status,'ENABLED'),sku.is_default,sku.status,sku.updated_at_epoch_millis,"
                + "primary_media.asset_ref,attributes.attribute_values,sku.display_order,"
                + "item.preparation_profile::text,sku.preparation_override::text,production_tag.ref "
                + "FROM catalog.catalog_sku sku JOIN item_scope item ON "
                + "item.item_ref=sku.item_ref "
                + "LEFT JOIN catalog.unit_definition sales_unit ON sales_unit.unit_ref=sku.sales_unit_ref "
                + "LEFT JOIN catalog.unit_definition base_unit ON base_unit.unit_ref=sku.base_measure_unit_ref "
                + "LEFT JOIN LATERAL (SELECT media.asset_ref FROM catalog.catalog_sku_media media "
                + "WHERE media.product_sku_ref=sku.product_sku_ref ORDER BY media.display_order,"
                + "media.asset_ref LIMIT 1) primary_media ON TRUE "
                + "LEFT JOIN LATERAL (SELECT relation.ref FROM catalog.catalog_item_reference relation "
                + "WHERE relation.item_ref=item.item_ref AND relation.kind='PRODUCTION_TAG') production_tag ON TRUE "
                + "LEFT JOIN LATERAL (SELECT COALESCE(jsonb_agg(jsonb_build_object('attributeRef',"
                + "attribute.entry_ref::text,"
                + "'attributeCode',attribute.code,'attributeName',attribute.name,"
                + "'attributeValueRef',value.entry_ref::text,"
                + "'valueCode',value.code,'valueLabel',value.name,'displayOrder',"
                + "COALESCE(axis_value.display_order,0),'status',value.status) "
                + "ORDER BY COALESCE(axis_value.display_order,0),attribute.code,value.code), '[]':"
                + ":jsonb) attribute_values "
                + "FROM catalog.catalog_sku_attribute_value assignment JOIN "
                + "catalog.dictionary_entry attribute ON attribute.entry_ref=assignment.attribute_ref "
                + "JOIN catalog.dictionary_entry value ON "
                + "value.entry_ref=assignment.attribute_value_ref LEFT JOIN "
                + "catalog.catalog_sku_variant_axis axis "
                + "ON axis.item_ref=sku.item_ref AND axis.attribute_ref=assignment.attribute_ref "
                + "LEFT JOIN catalog.catalog_sku_variant_axis_value axis_value "
                + "ON axis_value.sku_variant_axis_ref=axis.sku_variant_axis_ref AND "
                + "axis_value.value_ref=assignment.attribute_value_ref "
                + "WHERE assignment.product_sku_ref=sku.product_sku_ref) attributes ON TRUE WHERE "
                + skuStatusPredicate + "), "
                + "aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS (SELECT * FROM matching");
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef, itemCode));
        if (cursor != null) {
            sql.append(" WHERE (display_order>? OR (display_order=? AND sku_code>?) OR "
                    + "(display_order=? AND sku_code=? AND product_sku_ref>?))");
            args.add(cursorDisplayOrder);
            args.add(cursorDisplayOrder);
            args.add(cursorCode);
            args.add(cursorDisplayOrder);
            args.add(cursorCode);
            args.add(cursorRef);
        }
        sql.append(" ORDER BY display_order,sku_code,product_sku_ref LIMIT ?) "
                + "SELECT paged.*,aggregate.total,EXISTS(SELECT 1 FROM item_scope) AS item_exists "
                + "FROM aggregate LEFT JOIN paged ON TRUE "
                + "ORDER BY paged.display_order,paged.sku_code,paged.product_sku_ref");
        args.add(pageSize + 1);
        List<SkuCandidateRow> rows = jdbc.query(
                sql.toString(),
                statement -> {
                    for (int index = 0; index < args.size(); index++) statement.setObject(index + 1, args.get(index));
                },
                (result, row) -> skuCandidateRow(result));
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

    private static String categoryDescendantPositionSql() {
        return "array_position(descendant.path_refs, ?::uuid) + 1";
    }

    private static String categoryDepthDisabledReason(String usage) {
        if ("CATEGORY_CREATE".equals(usage)) return "商品分类最多只能建立三级";
        return "移动后分类不能超过三级";
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

    /**
     * Adds effective business facts already selected with the SKU page. The lazy read must remain a bounded list
     * projection: it does not re-query catalog preparation or reference tables per page. Production-tag naming stays
     * behind its owner API, once for the shared parent fact.
     */
    private void decorateSkuListFacts(
            String dataNodeRef, String brandRef, String requestId, List<SkuCandidateRow> rows) {
        if (rows.isEmpty()) return;
        JsonNode itemProfile = rows.getFirst().itemPreparationProfile();
        JsonNode productionTagRef = rows.getFirst().productionTagRef() == null
                ? mapper.nullNode()
                : mapper.getNodeFactory()
                        .textNode(rows.getFirst().productionTagRef().toString());
        ArrayNode productionTagFacts = productionTagDetails(dataNodeRef, brandRef, productionTagRef, requestId);
        ProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback = null;
        if (!productionTagFacts.isEmpty()) {
            JsonNode tag = productionTagFacts.get(0);
            UUID tagRef = nullableUuid(tag, "tagRef");
            if (tagRef != null)
                productionTagReadback = new ProductionTagOwnerApi.ProductionTagReferenceReadback(
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

    private ObjectNode items(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        validateItemPageQuery(request);
        String keyword = optional(request, "keyword");
        String smartViewKey = optional(request, "smartViewKey");
        String shapeKey = optional(request, "shapeKey");
        String categoryRef = optional(request, "categoryRef");
        UUID tagRef = optionalUuid(request, "tagRef");
        UUID productionTagRef = optionalUuid(request, "productionTagRef");
        boolean uncategorized = parseBoolean(request, "uncategorized", false);
        boolean includeSubCategories = parseBoolean(request, "includeSubCategories", false);
        String status = optional(request, "status");
        String source = optional(request, "source");
        String candidateUsage = optional(request, "candidateUsage");
        String excludeItemCode = optional(request, "excludeItemCode");
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
                + "i.sections::text AS sections, i.preparation_profile, i.version, "
                + "i.updated_at_epoch_millis, i.source_scope_ref, "
                + "i.sales_unit_ref, i.sales_unit_code, i.sales_unit_name, i.sales_unit_dimension, "
                + "i.sales_unit_precision, i.base_measure_unit_ref, i.base_measure_unit_code, "
                + "i.base_measure_unit_name, i.base_measure_unit_dimension, i.base_measure_unit_precision "
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
        if (productionTagRef != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM catalog.catalog_item_reference relation "
                    + "WHERE relation.item_ref=i.item_ref AND relation.kind=? AND relation.ref=?)");
            args.add(CatalogItemReferenceFacts.PRODUCTION_TAG);
            args.add(productionTagRef);
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
        if ("COMPOSITE_COMPONENT".equals(candidateUsage)) {
            // The owner, not the editor, defines this candidate boundary. A new
            // package relation may target only an enabled item; a disabled item
            // that is already attached remains visible through the detail readback.
            sql.append(" AND i.status='ENABLED' AND i.code <> ?");
            args.add(excludeItemCode);
        }
        sql.append("), aggregate AS (SELECT COUNT(*) AS total FROM filtered), paged AS (SELECT item_ref, code, name, "
                + "short_name, shape_key, status, sections, preparation_profile, version, updated_at_epoch_millis, "
                + "source_scope_ref, sales_unit_ref, sales_unit_code, sales_unit_name, sales_unit_dimension, "
                + "sales_unit_precision, base_measure_unit_ref, base_measure_unit_code, base_measure_unit_name, "
                + "base_measure_unit_dimension, base_measure_unit_precision FROM filtered "
                + "ORDER BY code OFFSET ? LIMIT ?) SELECT p.item_ref, p.code, "
                + "p.name, p.short_name, p.shape_key, p.status, "
                + "(COALESCE(p.sections::jsonb,'{}'::jsonb) || jsonb_build_object("
                + "'preparationProfile',p.preparation_profile,"
                + "'salesUnitRef',p.sales_unit_ref,"
                + "'salesUnitSnapshot',CASE WHEN p.sales_unit_ref IS NULL THEN NULL ELSE jsonb_build_object("
                + "'unitRef',p.sales_unit_ref,'code',p.sales_unit_code,'name',p.sales_unit_name,"
                + "'unitDimension',p.sales_unit_dimension,'precision',p.sales_unit_precision) END,"
                + "'baseMeasureUnitRef',p.base_measure_unit_ref,"
                + "'baseMeasureUnitSnapshot',CASE WHEN p.base_measure_unit_ref IS NULL THEN NULL "
                + "ELSE jsonb_build_object("
                + "'unitRef',p.base_measure_unit_ref,'code',p.base_measure_unit_code,'name',p.base_measure_unit_name,"
                + "'unitDimension',p.base_measure_unit_dimension,'precision',p.base_measure_unit_precision) "
                + "END))::text, p.version, "
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
        hydrateItemSummaryFacts(rows.stream()
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
        Set<UUID> summaryUnitRefs = new LinkedHashSet<>();
        rows.stream().map(PageItemRow::item).filter(java.util.Objects::nonNull).forEach(item -> {
            JsonNode sections = json(item.sectionsJson());
            UUID salesUnitRef = nullableUuid(sections, "salesUnitRef");
            UUID baseMeasureUnitRef = nullableUuid(sections, "baseMeasureUnitRef");
            if (salesUnitRef != null) summaryUnitRefs.add(salesUnitRef);
            if (baseMeasureUnitRef != null) summaryUnitRefs.add(baseMeasureUnitRef);
        });
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> summaryUnitDefinitions =
                unitDefinitionsForRefs(dataNodeRef, brandRef, summaryUnitRefs);
        CategorySummaryFacts categorySummaryFacts = categorySummaryFactsForItems(
                dataNodeRef,
                brandRef,
                rows.stream()
                        .map(PageItemRow::item)
                        .filter(java.util.Objects::nonNull)
                        .toList());
        Map<UUID, List<CatalogTagFact>> catalogTagFactsByItem = catalogTagFactsForItems(
                dataNodeRef,
                brandRef,
                rows.stream()
                        .map(PageItemRow::item)
                        .filter(java.util.Objects::nonNull)
                        .toList());
        Map<UUID, ProductionTagOwnerApi.ProductionTagReferenceReadback> productionTagFactsByItem =
                productionTagFactsForItems(
                        dataNodeRef,
                        brandRef,
                        rows.stream()
                                .map(PageItemRow::item)
                                .filter(java.util.Objects::nonNull)
                                .toList(),
                        requestId);
        rows.stream()
                .filter(row -> row.item() != null)
                .forEach(row -> array.add(itemSummary(
                        row.item(),
                        summaryUnitDefinitions,
                        categorySummaryFacts,
                        catalogTagFactsByItem,
                        productionTagFactsByItem)));
        long total = rows.isEmpty() ? 0 : rows.get(0).total();
        data.put("total", total)
                .put("generation", generation(dataNodeRef, brandRef))
                .put("queryGeneration", queryGeneration == null ? "" : queryGeneration);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize));
        else data.putNull("cursor");
        return envelope(requestId, data);
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
        String query = optional(request, "query");
        query = query == null ? "" : query.trim();
        String status = optional(request, "status");
        if (status != null && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典状态筛选不合法");
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity = cursorIdentity(
                "dictionary",
                dataNodeRef,
                brandRef,
                kind,
                parentEntryRef == null ? null : parentEntryRef.toString(),
                query,
                status,
                Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, queryIdentity);
        DictionaryListing listing = loadDictionaryListing(
                dataNodeRef, brandRef, kind, parentEntryRef, query, status, cursor, pageSize, queryIdentity);
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
                    "detailSections",
                    "identifierRules",
                    "preparationRules")) data.set(key, manifest.path(key));
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
                            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 'DISABLED', CAST(? AS JSONB), 1, "
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
        int changed = jdbc.update(
                "UPDATE catalog.catalog_item SET name=?, short_name=?, sections=CAST(? AS JSONB), "
                        + "sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_dimension=?,"
                        + "sales_unit_precision=?,base_measure_unit_ref=?,base_measure_unit_code=?,"
                        + "base_measure_unit_name=?,base_measure_unit_dimension=?,base_measure_unit_precision=?,"
                        + "version=version+1, updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? "
                        + "AND code=? AND version=? AND status <> 'VOIDED'",
                nextName,
                nextShortName,
                sectionJson,
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
                        : unitAssignments.itemBase().precision(),
                now(),
                dataNodeRef,
                brandRef,
                code,
                expected);
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

    /** Persist catalog refs and effective base snapshots; inventory receives the snapshot, never a lookup key. */
    private void replaceEffectiveUnitFacts(
            UUID itemRef, ObjectNode sections, ArrayNode skus, UnitAssignmentFacts unitAssignments) {
        List<Object[]> skuRows = new ArrayList<>();
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

    private void writeItemUnitSnapshotsBatch(List<Object[]> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate(
                "UPDATE catalog.catalog_item SET sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_di"
                        + "mension=?,sales_unit_precision=?,"
                        + "base_measure_unit_ref=?,base_measure_unit_code=?,base_measure_unit_name=?,base_measure_u"
                        + "nit_dimension=?,base_measure_unit_precision=? WHERE item_ref=?",
                rows);
    }

    private Object[] itemUnitFactRow(
            UUID itemRef, CatalogOwnerApi.UnitDefinitionReadback sales, CatalogOwnerApi.UnitDefinitionReadback base) {
        return new Object[] {
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
            itemRef
        };
    }

    private void writeSkuUnitFacts(
            UUID skuRef,
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,
            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback sales,
            CatalogOwnerApi.UnitDefinitionReadback base) {
        List<Object[]> rows = new ArrayList<>();
        rows.add(skuUnitFactRow(skuRef, salesOverride, baseOverride, sales, base));
        writeSkuUnitFactsBatch(rows);
    }

    private void writeSkuUnitFactsBatch(List<Object[]> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate(
                "UPDATE catalog.catalog_sku SET"
                        + " sales_unit_ref=?,sales_unit_code=?,sales_unit_name=?,sales_unit_dimension=?,sales_unit_p"
                        + "recision=?,"
                        + "base_measure_unit_ref=?,base_measure_unit_code=?,base_measure_unit_name=?,"
                        + "base_measure_unit_dimension=?,base_measure_unit_precision=?"
                        + ",updated_at_epoch_millis=?"
                        + " WHERE product_sku_ref=?",
                rows);
    }

    private Object[] skuUnitFactRow(
            UUID skuRef,
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,
            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback sales,
            CatalogOwnerApi.UnitDefinitionReadback base) {
        return new Object[] {
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
            skuRef
        };
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

    private void writeCopiedEffectiveUnitFactsBatch(String scope, String brand, List<CopiedUnitInput> inputs) {
        if (inputs == null || inputs.isEmpty()) return;
        Set<UUID> refs = new LinkedHashSet<>();
        Map<UUID, CopiedUnitRefs> factsByItem = new LinkedHashMap<>();
        for (CopiedUnitInput input : inputs) {
            UUID itemSalesRef = nullableUuid(input.sections(), "salesUnitRef");
            UUID itemBaseRef = nullableUuid(input.sections(), "baseMeasureUnitRef");
            if (itemSalesRef != null) refs.add(itemSalesRef);
            if (itemBaseRef != null) refs.add(itemBaseRef);
            Map<UUID, UUID> salesOverrides = new LinkedHashMap<>();
            Map<UUID, UUID> baseOverrides = new LinkedHashMap<>();
            if (input.skus() != null && input.skus().isArray())
                for (JsonNode sku : input.skus()) {
                    UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
                    UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
                    UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
                    salesOverrides.put(skuRef, salesOverride);
                    baseOverrides.put(skuRef, baseOverride);
                    if (salesOverride != null) refs.add(salesOverride);
                    if (baseOverride != null) refs.add(baseOverride);
                }
            factsByItem.put(
                    input.itemRef(),
                    new CopiedUnitRefs(itemSalesRef, itemBaseRef, salesOverrides, baseOverrides, input.skus()));
        }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> definitions =
                unitDefinitionFacts.requireInScopeAll(scope, brand, refs);
        List<Object[]> itemRows = new ArrayList<>();
        List<Object[]> skuRows = new ArrayList<>();
        factsByItem.forEach((itemRef, facts) -> {
            CatalogOwnerApi.UnitDefinitionReadback itemSales =
                    facts.salesUnitRef() == null ? null : definitions.get(facts.salesUnitRef());
            CatalogOwnerApi.UnitDefinitionReadback itemBase =
                    facts.baseMeasureUnitRef() == null ? null : definitions.get(facts.baseMeasureUnitRef());
            itemRows.add(itemUnitFactRow(itemRef, itemSales, itemBase));
            if (facts.skus() == null || !facts.skus().isArray()) return;
            for (JsonNode sku : facts.skus()) {
                UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
                UUID salesOverrideRef = facts.salesOverrides().get(skuRef);
                UUID baseOverrideRef = facts.baseOverrides().get(skuRef);
                CatalogOwnerApi.UnitDefinitionReadback salesOverride =
                        salesOverrideRef == null ? null : definitions.get(salesOverrideRef);
                CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                        baseOverrideRef == null ? null : definitions.get(baseOverrideRef);
                skuRows.add(skuUnitFactRow(
                        skuRef,
                        salesOverride,
                        baseOverride,
                        salesOverride == null ? itemSales : salesOverride,
                        baseOverride == null ? itemBase : baseOverride));
            }
        });
        writeItemUnitSnapshotsBatch(itemRows);
        writeSkuUnitFactsBatch(skuRows);
    }

    private int[] copyUnitDefinitions(List<UnitCopy> units) {
        if (units == null || units.isEmpty()) return new int[0];
        int[] changes = jdbc.batchUpdate(
                "INSERT INTO catalog.unit_definition(unit_ref,data_node_ref,brand_ref,code,name,dimension,precision"
                        + ",status,version,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?, ?,1,?,?) ON CONFLICT(data_node_ref,brand_ref,code) "
                        + "WHERE status <> 'VOIDED' DO NOTHING",
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
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> definitions = unitDefinitionFacts.requireInScopeAll(
                units.getFirst().dataNodeRef(),
                units.getFirst().brandRef(),
                units.stream().map(UnitCopy::targetRef).toList());
        for (UnitCopy unit : units) {
            CatalogOwnerApi.UnitDefinitionReadback target = definitions.get(unit.targetRef());
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
            appendVoidBlockingReason(result.putArray("blockingReasons"), "ALREADY_VOIDED", 1, List.of());
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

    /** Detail read projection shares one read for inbound references and catalog generation. */
    private DetailInboundFacts detailInboundFacts(
            String dataNodeRef, String brandRef, UUID itemRef, Collection<UUID> skuRefs) {
        UUID[] orderedSkuRefs = new LinkedHashSet<>(skuRefs == null ? List.of() : skuRefs).toArray(UUID[]::new);
        return jdbc.query(
                "SELECT 'SKU' AS"
                        + " kind,component.product_sku_ref,component.composite_component_ref,owner_item.item_ref,"
                        + "owner_item.code,owner_item.name,NULL::bigint"
                        + " FROM catalog.catalog_composite_component component JOIN catalog.catalog_composite_group"
                        + " group_row ON group_row.composite_group_ref=component.composite_group_ref JOIN"
                        + " catalog.catalog_item owner_item ON owner_item.item_ref=group_row.item_ref JOIN"
                        + " catalog.catalog_sku target_sku ON target_sku.product_sku_ref=component.product_sku_ref"
                        + " WHERE"
                        + " owner_item.data_node_ref=? AND owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND"
                        + " component.product_sku_ref=ANY(?::uuid[]) AND"
                        + " owner_item.item_ref <> target_sku.item_ref UNION ALL SELECT"
                        + " 'ITEM',NULL::uuid,component.composite_component_ref,owner_item.item_ref,"
                        + "owner_item.code,owner_item.name,NULL::bigint"
                        + " FROM catalog.catalog_composite_component component JOIN catalog.catalog_composite_group"
                        + " group_row ON group_row.composite_group_ref=component.composite_group_ref JOIN"
                        + " catalog.catalog_item owner_item ON owner_item.item_ref=group_row.item_ref WHERE"
                        + " owner_item.data_node_ref=? AND owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND"
                        + " component.component_item_ref=? UNION ALL SELECT"
                        + " 'GENERATION',NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,"
                        + "COALESCE(MAX(version),0) FROM"
                        + " catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", orderedSkuRefs));
                    statement.setString(4, dataNodeRef);
                    statement.setString(5, brandRef);
                    statement.setObject(6, itemRef);
                    statement.setString(7, dataNodeRef);
                    statement.setString(8, brandRef);
                },
                result -> {
                    Map<UUID, List<SkuInboundReference>> bySku = new LinkedHashMap<>();
                    List<InboundItemReference> byItem = new ArrayList<>();
                    long generation = 0;
                    while (result.next()) {
                        switch (result.getString(1)) {
                            case "SKU" -> bySku.computeIfAbsent(
                                            result.getObject(2, UUID.class), ignored -> new ArrayList<>())
                                    .add(new SkuInboundReference(
                                            result.getObject(3, UUID.class),
                                            result.getObject(4, UUID.class),
                                            result.getString(5),
                                            result.getString(6)));
                            case "ITEM" -> byItem.add(new InboundItemReference(
                                    result.getObject(4, UUID.class), result.getString(5), result.getString(6)));
                            case "GENERATION" -> generation = result.getLong(7);
                            default -> {
                                String problemMessage = "商品入向事实类型无法读取";
                                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, problemMessage);
                            }
                        }
                    }
                    return new DetailInboundFacts(
                            bySku.entrySet().stream()
                                    .collect(java.util.stream.Collectors.toUnmodifiableMap(
                                            Map.Entry::getKey, entry -> List.copyOf(entry.getValue()))),
                            List.copyOf(byItem),
                            generation);
                });
    }

    private Map<UUID, List<SkuInboundReference>> skuInboundReferencesByRefs(
            String dataNodeRef, String brandRef, Collection<UUID> skuRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(skuRefs));
        if (orderedRefs.isEmpty()) return Map.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT component.product_sku_ref,component.composite_component_ref,"
                        + "owner_item.item_ref,owner_item.code,owner_item.name FROM "
                        + "catalog.catalog_composite_component component JOIN catalog.catalog_composite_group "
                        + "group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item "
                        + "owner_item ON owner_item.item_ref=group_row.item_ref JOIN catalog.catalog_sku target_sku ON "
                        + "target_sku.product_sku_ref=component.product_sku_ref WHERE owner_item.data_node_ref=? AND "
                        + "owner_item.brand_ref=? "
                        + "AND "
                        + "owner_item.status <> 'VOIDED' AND component.product_sku_ref = ANY(?::uuid[]) "
                        + "AND owner_item.item_ref <> target_sku.item_ref ORDER BY "
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
                                        result.getString(4),
                                        result.getString(5)));
                    }
                    return referencesBySku;
                });
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
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
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
            ObjectNode request,
            CatalogCoordinationSnapshot coordinationSnapshot) {
        UUID categoryRef = requiredUuid(request, "categoryRef");
        long expected = requiredLong(request, "expectedVersion", -1);
        String action = required(request, "action");
        // Acquire the scope-wide hierarchy guard before any row lock. Reparent may subsequently lock a target
        // subtree, so reversing this order would make two concurrent reparent commands deadlock.
        CategoryRow current = coordinationSnapshot == null ? null : coordinationSnapshot.category();
        if (current == null) {
            lockCategoryHierarchy(dataNodeRef, brandRef);
            current = lockCategory(dataNodeRef, brandRef, categoryRef);
        }
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

    /** The parent and moving subtree depths are one current hierarchy fact for a reparent command. */
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

    /**
     * A brand-copy category may reuse a target row with the same code. Build the exact post-copy parent map under the
     * category hierarchy lock: reused rows keep their persisted parent and only absent rows take the mapped source
     * parent. Reject instead of inventing a flattening rule.
     */
    private void assertCopiedCategoryDepth(String scope, String brand, List<CopyCategory> copiedCategories) {
        if (copiedCategories.isEmpty()) return;
        Map<UUID, UUID> effectiveParents = jdbc.query(
                "SELECT category_ref,parent_category_ref FROM catalog.catalog_category WHERE data_node_ref=? "
                        + "AND brand_ref=? AND status <> 'VOIDED' FOR UPDATE",
                result -> {
                    Map<UUID, UUID> parents = new LinkedHashMap<>();
                    while (result.next()) parents.put(result.getObject(1, UUID.class), result.getObject(2, UUID.class));
                    return parents;
                },
                scope,
                brand);
        for (CopyCategory copied : copiedCategories)
            effectiveParents.putIfAbsent(copied.targetRef(), copied.targetParentRef());
        for (CopyCategory copied : copiedCategories) {
            int depth = 0;
            UUID current = copied.targetRef();
            Set<UUID> visited = new LinkedHashSet<>();
            while (current != null) {
                if (!visited.add(current))
                    throw new CatalogOwnerApi.Problem("HIERARCHY_CYCLE", 422, CATEGORY_MOVE_CYCLE_MESSAGE);
                depth += 1;
                if (depth > CATALOG_CATEGORY_MAX_DEPTH) throw categoryDepthExceededProblem();
                current = effectiveParents.get(current);
            }
        }
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

    private static String inventoryVoidDependencySources(InventoryOwnerApi.CatalogVoidDependencyReadback dependencies) {
        return dependencies.inboundBomReferences().stream()
                .map(reference -> reference.sourceName() + " x" + reference.count())
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

    /**
     * Promotion copies the same owner facts as the old hydrated item, but only after one shared presence probe selects
     * the relation set reads that can contribute to the target. The source projection is also the asset-lock input.
     */
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
            if (jdbc.update(
                            "UPDATE catalog.catalog_item SET "
                                    + "name=?,short_name=?,shape_key=?,status='DISABLED',sections=CAST(? AS JSONB),"
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
            jdbc.update(
                    "INSERT INTO catalog.catalog_item "
                            + "(item_ref,data_node_ref,brand_ref,code,name,short_name,shape_key,status,sections,"
                            + "source_item_code,source_scope_ref,version,created_at_epoch_millis,updated_at_epoch_milli"
                            + "s) "
                            + "VALUES (?,?,?,?,?,?,?, 'DISABLED',CAST(? AS JSONB),?,?,1,?,?)",
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
        if (jdbc.update(
                        "UPDATE catalog.catalog_item SET status='VOIDED',version=version+1,updated_at_epoch_millis=? "
                                + "WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?",
                        now(),
                        dataNodeRef,
                        brandRef,
                        code,
                        expected)
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "临时商品版本已变化");
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
        TargetCopyFacts targetCopyFacts = loadTargetCopyFacts(targetDataNodeRef, brandRef, request, graph);
        TargetScopeVersions targetVersions = targetCopyFacts.versions();
        long targetVersion = targetVersions.maxVersion();
        return new CatalogCopyPlan(
                selected,
                graph,
                sourceVersion,
                targetVersion,
                targetCopyFacts,
                copyDigest(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, selected, graph, sourceVersion, targetVersion));
    }

    /** Prepared execute must reject hard blocks before any target-side copy mutation begins. */
    private void rejectPreparedBlockingCompatibility(ArrayNode compatibilityResults) {
        for (JsonNode row : compatibilityResults) {
            if (!"BLOCKED".equals(row.path("result").asText())) continue;
            String problemCode = row.path("reasonCode").asText("");
            String reason = row.path("reason").asText("复制兼容性事实被阻断");
            if (problemCode.isBlank()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制预检缺少阻断原因编码");
            }
            throw new CatalogOwnerApi.Problem(problemCode, 422, reason);
        }
    }

    private ObjectNode copyPreflight(String source, String target, String brandRef, CatalogCopyPlan plan) {
        return copyPreflight(source, target, brandRef, plan, null);
    }

    private ObjectNode copyPreflight(
            String source,
            String target,
            String brandRef,
            CatalogCopyPlan plan,
            CopyCompatibility preparedCompatibility) {
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
        TargetScopeVersions targetVersions = plan.targetCopyFacts().versions();
        Map<String, Long> preflightCategoryVersions = targetVersions.categoryVersions();
        Map<DictionaryKey, Long> preflightDictionaryVersions = targetVersions.dictionaryVersions();
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
        Map<String, Long> preflightUnitVersions = targetVersions.unitVersions();
        graph.units().forEach(row -> versions.addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", preflightUnitVersions.getOrDefault(row.code(), 0L)));
        ArrayNode mappings = data.putArray("mappingPreview");
        ArrayNode compatibility = data.putArray("compatibilityResults");
        ArrayNode rewrites = data.putArray("referenceRewritePreview");
        ArrayNode referenceMappings = data.putArray("referenceMappings");
        CopyCompatibility plannedCompatibility = preparedCompatibility == null
                ? validateCopyCompatibility(source, target, brandRef, graph, plan.targetCopyFacts(), null, false)
                : preparedCompatibility;
        Map<ReferenceKey, String> mapping = plannedCompatibility.mapping();
        Map<String, ItemRow> targetRows = plannedCompatibility.targetRows();
        Map<String, JsonNode> plannedCompatibilityById = new LinkedHashMap<>();
        plannedCompatibility.compatibilityResults().forEach(row -> {
            String id = row.path("compatibilityId").asText("");
            if (!id.isBlank()) plannedCompatibilityById.put(id, row);
        });
        if (preparedCompatibility != null)
            plannedCompatibility.compatibilityResults().forEach(row -> compatibility.add(row.deepCopy()));
        Map<String, ItemRow> targetItemsByRef = new LinkedHashMap<>();
        targetRows.values().forEach(row -> targetItemsByRef.put(row.ref().toString(), row));
        mapping.forEach((from, to) -> referenceMappings.add(referenceMappingRow(from, to, graph, targetItemsByRef)));
        int blockingCount = countBlockedCompatibilityRows(plannedCompatibility.compatibilityResults());
        for (ItemRow row : rows) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            mappings.addObject()
                    .put("fromCode", row.code())
                    .put("toCode", row.code())
                    .put("referenceKind", "CATALOG_ITEM")
                    .put("status", check.result())
                    .set("canonicalTuple", canonicalTuple(target, brandRef, "CATALOG_ITEM", row.code()));
            if (preparedCompatibility == null) {
                JsonNode plannedItem = plannedCompatibilityById.get("CATALOG_ITEM:" + row.ref());
                if (plannedItem == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制兼容性缺少商品结果");
                }
                compatibility.add(plannedItem.deepCopy());
            }
        }
        if (preparedCompatibility == null) {
            plannedCompatibility.compatibilityResults().forEach(row -> {
                String objectType = row.path("objectType").asText("");
                if ("CATALOG_ATTRIBUTE_DEFINITION".equals(objectType)
                        || "CATALOG_ORDER_OPTION_DEFINITION".equals(objectType)) compatibility.add(row.deepCopy());
            });
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
        Map<String, UnitRow> preflightTargetUnits = plannedCompatibility.targetUnits();
        graph.units().forEach(row -> {
            JsonNode plannedUnit = plannedCompatibilityById.get("CATALOG_UNIT:" + row.ref());
            UnitRow targetUnit = preparedCompatibility == null ? preflightTargetUnits.get(row.code()) : null;
            boolean compatible = plannedUnit == null
                    ? targetUnit == null || sameUnitDefinition(row, targetUnit)
                    : !"BLOCKED".equals(plannedUnit.path("result").asText());
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
        if (preparedCompatibility == null) {
            for (UnitRow row : graph.units()) {
                JsonNode plannedUnit = plannedCompatibilityById.get(row.objectType() + ":" + row.ref());
                if (plannedUnit == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制兼容性缺少单位结果");
                }
                compatibility.add(plannedUnit.deepCopy());
            }
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
        if (preparedCompatibility == null) {
            for (DictionaryRow row : graph.dictionaries()) {
                JsonNode plannedDictionary = plannedCompatibilityById.get(row.objectType() + ":" + row.ref());
                if (plannedDictionary == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制兼容性缺少字典结果");
                }
                compatibility.add(plannedDictionary.deepCopy());
            }
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

    private static int countBlockedCompatibilityRows(ArrayNode compatibility) {
        int count = 0;
        for (JsonNode row : compatibility) {
            if ("BLOCKED".equals(row.path("result").asText())) count++;
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

    /**
     * Category detail needs the whole subtree and its blocking item labels. Keep these two values in one task-scoped
     * read instead of first materializing references and then issuing a second relation query.
     */
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
                        if (itemCode != null) {
                            if (blocking.add(itemCode)) {
                                references.add(new CatalogOwnerApi.CategoryBlockingReference(
                                        "CATALOG_ITEM", itemRef, itemCode, itemName, "INBOUND"));
                            }
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
        if (hasIdentifiers == null)
            hasIdentifiers = jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM catalog.product_identifier WHERE item_ref=?)",
                    Boolean.class,
                    row.ref());
        return sections.path("skuCount").asInt(0) > 0
                || Boolean.TRUE.equals(hasIdentifiers)
                || sections.path("productionTagRef").isTextual()
                || (sections.path("skus").isArray() && sections.path("skus").size() > 0);
    }

    private TransitionItemPrecheck recheckTransitionItemReceipt(
            String scope, String brand, String itemCode, Long expectedVersion, String targetStatus) {
        TransitionItemPrecheck precheck = jdbc.query(
                "SELECT item.item_ref,item.code,item.name,item.short_name,item.shape_key,item.status,"
                        + "item.sections::text,"
                        + "item.version,item.updated_at_epoch_millis,item.source_scope_ref,"
                        + "EXISTS (SELECT 1 FROM catalog.product_identifier identifier WHERE "
                        + "identifier.item_ref=item.item_ref) "
                        + "FROM catalog.catalog_item item WHERE item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, itemCode);
                },
                result -> result.next()
                        ? new TransitionItemPrecheck(
                                new ItemRow(
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
                                result.getBoolean(11))
                        : null);
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

    /**
     * Detail and lifecycle command must describe the same inventory-owned facts. The catalog owner only consumes the
     * inventory owner's judgement; it never infers a void block from inventory definition JSON.
     */
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

    private record InventoryInboundVoidReference(UUID sourceRef, String sourceName, long count) {}

    private record ItemVoidCatalogFacts(int skuCount, int identifierCount, boolean hasProductionTag) {
        private boolean hasDependentFacts() {
            return skuCount > 0 || identifierCount > 0 || hasProductionTag;
        }
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
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT component.component_item_ref,owner_item.item_ref,owner_item.code,owner_item.name "
                        + "FROM catalog.catalog_composite_component component JOIN "
                        + "catalog.catalog_composite_group group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item "
                        + "owner_item ON owner_item.item_ref=group_row.item_ref WHERE owner_item.data_node_ref=? AND "
                        + "owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' "
                        + "AND component.component_item_ref=ANY(?::uuid[]) ORDER BY component.component_item_ref, "
                        + "owner_item.code, owner_item.item_ref",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, List<InboundItemReference>> referencesByItem = new LinkedHashMap<>();
                    while (result.next())
                        referencesByItem
                                .computeIfAbsent(result.getObject(1, UUID.class), ignored -> new ArrayList<>())
                                .add(new InboundItemReference(
                                        result.getObject(2, UUID.class), result.getString(3), result.getString(4)));
                    referencesByItem.replaceAll((ref, references) -> List.copyOf(references));
                    return Map.copyOf(referencesByItem);
                });
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
        return jdbc.query(
                "SELECT owner_item.item_ref, owner_item.code, owner_item.name "
                        + "FROM catalog.catalog_composite_component component JOIN "
                        + "catalog.catalog_composite_group group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item "
                        + "owner_item ON owner_item.item_ref=group_row.item_ref WHERE owner_item.data_node_ref=? AND "
                        + "owner_item.brand_ref=? AND owner_item.status <> 'VOIDED' AND component.component_item_ref=? "
                        + "ORDER BY owner_item.code, owner_item.item_ref",
                (result, index) -> new InboundItemReference(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3)),
                scope,
                brand,
                currentRef);
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

    /** Category membership is relational and is removed from the persisted JSON before every save. */
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

    /** Save validation must inspect an unchanged VOIDED reference instead of treating it as missing. */
    private List<CategoryRow> lockCategoriesForReferenceValidation(String scope, String brand, List<UUID> refs) {
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
                        + placeholders + ") ORDER BY category_ref FOR UPDATE",
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
    /** The reference matrix is deliberately path-based: do not infer a relationship from a field name. */
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

    /**
     * Dictionary references are relational facts: catalog_item_reference and SKU relation rows are removed from the
     * persisted item JSON. When a PATCH supplies those arrays, load the current owner facts so an unchanged DISABLED
     * reference remains editable under the approved exemption.
     */
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
        Map<String, Set<UUID>> result = new LinkedHashMap<>();
        result.put("SKU_ATTRIBUTE", new LinkedHashSet<>());
        result.put("SKU_ATTRIBUTE_VALUE", new LinkedHashSet<>());
        jdbc.query(
                "SELECT 'SKU_ATTRIBUTE' AS dictionary_kind,relation.attribute_ref AS entry_ref FROM "
                        + "catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON "
                        + "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.item_ref=? "
                        + "UNION SELECT 'SKU_ATTRIBUTE_VALUE',relation.attribute_value_ref FROM "
                        + "catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON "
                        + "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? "
                        + "AND item.item_ref=?",
                (rows, row) -> {
                    String kind = rows.getString(1);
                    UUID ref = rows.getObject(2, UUID.class);
                    if (ref != null) result.get(kind).add(ref);
                    return null;
                },
                scope,
                brand,
                itemRef,
                scope,
                brand,
                itemRef);
        result.replaceAll((kind, refs) -> Set.copyOf(refs));
        return Map.copyOf(result);
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

    /**
     * The save preflight may already have loaded the direct production-tag relation. Reuse that immutable projection
     * whenever it is present, including when the command submits a replacement value. Coordination snapshots that carry
     * only identity facts deliberately omit this relational field and retain the owner-local fallback query.
     */
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

    /** Lock all dictionary kinds in one owner read; the kind remains part of the key and error contract. */
    private void lockDictionaryRefsByKind(
            String scope,
            String brand,
            Map<String, List<String>> refsByKind,
            Map<String, Set<UUID>> existingRefsByKind) {
        List<String> requestedKeys = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        for (Map.Entry<String, List<String>> entry : refsByKind.entrySet()) {
            entry.getValue().stream().distinct().map(UUID::fromString).sorted().forEach(ref -> {
                requestedKeys.add(entry.getKey() + "\u0000" + ref);
                args.add(entry.getKey());
                args.add(ref);
            });
        }
        if (requestedKeys.isEmpty()) return;
        String tuples = String.join(",", Collections.nCopies(requestedKeys.size(), "(?,?)"));
        Map<String, String> statuses = new LinkedHashMap<>();
        Set<String> foundKeys = new LinkedHashSet<>(jdbc.query(
                "SELECT dictionary_kind,entry_ref,status FROM catalog.dictionary_entry "
                        + "WHERE data_node_ref=? AND brand_ref=? "
                        + "AND (dictionary_kind,entry_ref) IN ("
                        + tuples
                        + ") ORDER BY dictionary_kind,entry_ref FOR UPDATE",
                (result, index) -> {
                    String key = result.getString(1) + "\u0000" + result.getObject(2, UUID.class);
                    statuses.put(key, result.getString(3));
                    return key;
                },
                args.toArray()));
        for (String requestedKey : requestedKeys) {
            if (!foundKeys.contains(requestedKey)) {
                String kind = requestedKey.substring(0, requestedKey.indexOf('\u0000'));
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, kind + " reference is not available in this owner scope");
            }
            int separator = requestedKey.indexOf('\u0000');
            String kind = requestedKey.substring(0, separator);
            UUID ref = UUID.fromString(requestedKey.substring(separator + 1));
            boolean alreadyAttached =
                    existingRefsByKind.getOrDefault(kind, Set.of()).contains(ref);
            // spotless:off
            if (!alreadyAttached && !"ENABLED".equals(statuses.get(requestedKey)))
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
                    .put("status", tag.status())
                    .put("owner", "fulfillment-production");
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
            String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
            List<Object> args = new ArrayList<>();
            args.add(scope);
            args.add(brand);
            args.addAll(ids);
            Map<UUID, String> itemStatuses = new LinkedHashMap<>();
            jdbc.query(
                    "SELECT item_ref,status FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? "
                            + "AND item_ref IN ("
                            + placeholders + ") ORDER BY item_ref FOR KEY SHARE",
                    (result, index) -> {
                        itemStatuses.put(result.getObject(1, UUID.class), result.getString(2));
                        return null;
                    },
                    args.toArray());
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

    /**
     * A supplied opaque SKU ref must retain its code link; otherwise callers silently downgrade it to an item-level
     * relation.
     */
    private void requireSkuCodeForSkuReference(JsonNode entry) {
        if (!entry.hasNonNull("skuCode") || entry.path("skuCode").asText().isBlank()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "productSkuRef requires skuCode");
        }
    }

    private Map<UUID, SkuReferenceOwner> skuOwnerByRef(String scope, String brand, List<UUID> requestedSkuRefs) {
        List<UUID> refs = requestedSkuRefs.stream().distinct().sorted().toList();
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, SkuReferenceOwner> owners = new LinkedHashMap<>();
        jdbc.query(
                "SELECT sku.product_sku_ref,sku.item_ref,item.status,sku.status "
                        + "FROM catalog.catalog_sku sku JOIN catalog.catalog_item item "
                        + "ON item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "sku.product_sku_ref IN ("
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
                        SkuReferenceOwner owner =
                                new SkuReferenceOwner(itemRef, result.getString(3), result.getString(4));
                        SkuReferenceOwner previous = skuRef == null ? null : owners.putIfAbsent(skuRef, owner);
                        if (previous != null && !previous.itemRef().equals(itemRef))
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
            String query,
            String status,
            OpaqueCollectionCursor.Position cursor,
            int pageSize,
            String queryIdentity) {
        String cursorPredicate =
                cursor == null ? "" : " WHERE display_order > ? OR (display_order = ? AND entry_ref > ?)";
        String sql = "WITH matching AS (SELECT entry_ref,code,name,status,parent_entry_ref,display_order,version,"
                + "updated_at_epoch_millis FROM catalog.dictionary_entry WHERE data_node_ref=? "
                + "AND brand_ref=? AND dictionary_kind=? AND "
                + "(?::uuid IS NULL OR parent_entry_ref=?) "
                + "AND (? = '' OR (code || chr(1) || name) ILIKE '%' || ? || '%') "
                + "AND (?::text IS NULL OR status=?)), "
                + "aggregate AS (SELECT COUNT(*) AS total, COALESCE(MAX(version),0) AS "
                + "generation FROM matching), "
                + "paged AS (SELECT entry_ref,code,name,status,parent_entry_ref,display_order,version,"
                + "updated_at_epoch_millis FROM matching"
                + cursorPredicate
                + " ORDER BY display_order, entry_ref LIMIT ?) "
                + "SELECT p.entry_ref,p.code,p.name,p.status,p.parent_entry_ref,p.display_order,p.version,"
                + "p.updated_at_epoch_millis,"
                + "a.total,a.generation FROM aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.display_order NULLS LAST,"
                + "p.entry_ref";
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.add(kind);
        arguments.add(parentEntryRef);
        arguments.add(parentEntryRef);
        arguments.add(query);
        arguments.add(query);
        arguments.add(status);
        arguments.add(status);
        if (cursor != null) {
            int displayOrder;
            try {
                displayOrder = Integer.parseInt(cursor.sortKey());
            } catch (NumberFormatException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典游标无效", failure);
            }
            arguments.add(displayOrder);
            arguments.add(displayOrder);
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
                        result.getInt(6),
                        result.getLong(7),
                        result.getLong(8),
                        result.getLong(9),
                        result.getLong(10)),
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
            nextCursor = OpaqueCollectionCursor.encode(
                    queryIdentity, Integer.toString(last.displayOrder()), last.entryRef());
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

    private LinkedHashSet<String> itemReferenceRefs(JsonNode node) {
        LinkedHashSet<String> refs = new LinkedHashSet<>();
        typedReferences(node).stream()
                .filter(ref -> Set.of("CATALOG_ITEM", "COMPOSITE_COMPONENT", "BOM_COMPONENT")
                        .contains(ref.referenceKind()))
                .forEach(ref -> refs.add(ref.ref()));
        return refs;
    }

    /**
     * Package-component identities are already resolved by their relationship owner. Re-parsing hydrated JSON and
     * querying catalog_item again creates a second projection and can make a valid package detail unreadable.
     */
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

    private Map<String, String> activeItemCodesByRef(String scope, String brand, Collection<String> refs) {
        if (refs == null || refs.isEmpty()) return Map.of();
        List<UUID> ids = new ArrayList<>();
        for (String ref : refs)
            try {
                ids.add(UUID.fromString(ref));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef must be UUID", failure);
            }
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(ids);
        Map<String, String> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT item_ref,code FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref IN ("
                        + placeholders
                        + ") AND status <> 'VOIDED'",
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

    /**
     * List rows need exactly one category relation and its complete business path. Keep both projections in this
     * set-read: loading the relation first and then recursively loading its labels was a fixed two-query fan-out for
     * every page, while consumers still need the ref as well as the path for smart-view rows.
     */
    private CategorySummaryFacts categorySummaryFactsForItems(String dataNodeRef, String brandRef, List<ItemRow> rows) {
        if (rows.isEmpty()) return CategorySummaryFacts.empty();
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        Map<UUID, UUID> categoryRefByItem = new LinkedHashMap<>();
        Map<UUID, List<CategoryPathNode>> pathNodesByItem = new LinkedHashMap<>();
        jdbc.query(
                "WITH RECURSIVE selected(item_ref,category_ref) AS (SELECT relation.item_ref,relation.category_ref "
                        + "FROM catalog.catalog_item_category relation JOIN catalog.catalog_category category "
                        + "ON category.category_ref=relation.category_ref WHERE relation.item_ref IN ("
                        + placeholders + ") AND category.data_node_ref=? AND category.brand_ref=? "
                        + "AND category.status <> 'VOIDED'), "
                        + "category_paths(leaf_ref,category_ref,parent_category_ref,path_nodes) AS ("
                        + "SELECT category.category_ref,category.category_ref,category.parent_category_ref,"
                        + "jsonb_build_array(jsonb_build_object('categoryRef',category.category_ref::text,"
                        + "'code',category.code,'name',category.name)) "
                        + "FROM selected JOIN catalog.catalog_category category "
                        + "ON category.category_ref=selected.category_ref "
                        + "UNION ALL SELECT paths.leaf_ref,parent.category_ref,parent.parent_category_ref,"
                        + "jsonb_build_array(jsonb_build_object('categoryRef',parent.category_ref::text,"
                        + "'code',parent.code,'name',parent.name)) || paths.path_nodes "
                        + "FROM category_paths paths "
                        + "JOIN catalog.catalog_category parent ON parent.data_node_ref=? AND parent.brand_ref=? "
                        + "AND parent.category_ref=paths.parent_category_ref AND parent.status <> 'VOIDED') "
                        + "SELECT selected.item_ref,selected.category_ref,paths.path_nodes FROM selected "
                        + "LEFT JOIN category_paths paths ON paths.leaf_ref=selected.category_ref "
                        + "AND paths.parent_category_ref IS NULL",
                statement -> {
                    for (int index = 0; index < itemRefs.size(); index++) {
                        statement.setObject(index + 1, itemRefs.get(index));
                    }
                    statement.setString(itemRefs.size() + 1, dataNodeRef);
                    statement.setString(itemRefs.size() + 2, brandRef);
                    statement.setString(itemRefs.size() + 3, dataNodeRef);
                    statement.setString(itemRefs.size() + 4, brandRef);
                },
                result -> {
                    while (result.next()) {
                        UUID itemRef = result.getObject(1, UUID.class);
                        UUID categoryRef = result.getObject(2, UUID.class);
                        if (itemRef == null || categoryRef == null) continue;
                        categoryRefByItem.putIfAbsent(itemRef, categoryRef);
                        String rawPath = result.getString(3);
                        if (rawPath == null || rawPath.isBlank()) continue;
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
                                throw new CatalogOwnerApi.Problem(
                                        "RESULT_UNKNOWN", 500, "商品分类路径读取失败");
                            // spotless:on
                            nodes.add(new CategoryPathNode(nodeRef, code, name));
                        }
                        if (!nodes.isEmpty()) pathNodesByItem.put(itemRef, List.copyOf(nodes));
                    }
                    return null;
                });
        return new CategorySummaryFacts(Map.copyOf(categoryRefByItem), Map.copyOf(pathNodesByItem));
    }

    /**
     * Resolves catalog-tag business labels for the current parent-item page in one owner-local query. The list
     * projection deliberately retains the persisted refs for command compatibility, but consumers must render this
     * owner-sorted label list rather than joining navigation state or guessing from an opaque ref.
     */
    private Map<UUID, List<CatalogTagFact>> catalogTagFactsForItems(
            String dataNodeRef, String brandRef, List<ItemRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        Map<UUID, List<CatalogTagFact>> factsByItem = new LinkedHashMap<>();
        jdbc.query(
                "SELECT relation.item_ref,entry.entry_ref,entry.code,entry.name "
                        + "FROM catalog.catalog_item_reference relation "
                        + "LEFT JOIN catalog.dictionary_entry entry ON entry.entry_ref=relation.ref "
                        + "AND entry.data_node_ref=? AND entry.brand_ref=? AND entry.dictionary_kind='TAG' "
                        + "WHERE relation.kind=? AND relation.item_ref IN ("
                        + placeholders
                        + ") ORDER BY relation.item_ref,entry.display_order NULLS LAST,entry.code NULLS "
                        + "LAST,relation.ref",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setString(3, CatalogItemReferenceFacts.CATALOG_TAG);
                    for (int index = 0; index < itemRefs.size(); index++)
                        statement.setObject(index + 4, itemRefs.get(index));
                },
                result -> {
                    while (result.next()) {
                        UUID itemRef = result.getObject(1, UUID.class);
                        UUID tagRef = result.getObject(2, UUID.class);
                        String tagCode = result.getString(3);
                        String tagName = result.getString(4);
                        if (itemRef == null
                                || tagRef == null
                                || tagCode == null
                                || tagCode.isBlank()
                                || tagName == null
                                || tagName.isBlank())
                            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品标签摘要读取失败");
                        factsByItem
                                .computeIfAbsent(itemRef, ignored -> new ArrayList<>())
                                .add(new CatalogTagFact(tagRef, tagCode, tagName));
                    }
                    return null;
                });
        Map<UUID, List<CatalogTagFact>> result = new LinkedHashMap<>();
        factsByItem.forEach((itemRef, facts) -> result.put(itemRef, List.copyOf(facts)));
        return Map.copyOf(result);
    }

    /**
     * Resolves the one production-tag business name for each row in the current parent-item page. This is deliberately
     * a single production-owner task read for the page: consumers receive a display-ready summary and never infer a tag
     * name from an opaque reference or from navigation state.
     */
    private Map<UUID, ProductionTagOwnerApi.ProductionTagReferenceReadback> productionTagFactsForItems(
            String dataNodeRef, String brandRef, List<ItemRow> rows, String requestId) {
        if (rows.isEmpty()) return Map.of();
        Map<UUID, UUID> productionTagRefByItem = new LinkedHashMap<>();
        for (ItemRow row : rows) {
            UUID productionTagRef = nullableUuid(json(row.sectionsJson()), "productionTagRef");
            if (productionTagRef != null) productionTagRefByItem.put(row.ref(), productionTagRef);
        }
        if (productionTagRefByItem.isEmpty()) return Map.of();
        if (productionTags == null) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "生产标签摘要读取失败");
        }
        List<UUID> requestedRefs = new ArrayList<>(new LinkedHashSet<>(productionTagRefByItem.values()));
        Map<UUID, com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi.ProductionTagReferenceReadback>
                tagsByRef =
                        productionTags.readTagReferencesByRefs(dataNodeRef, brandRef, requestedRefs, requestId).stream()
                                .collect(java.util.stream.Collectors.toMap(
                                        value -> value.tagRef(),
                                        value -> value,
                                        (left, right) -> left,
                                        LinkedHashMap::new));
        Map<UUID, ProductionTagOwnerApi.ProductionTagReferenceReadback> result = new LinkedHashMap<>();
        productionTagRefByItem.forEach((itemRef, tagRef) -> {
            var tag = tagsByRef.get(tagRef);
            if (tag == null || tag.name() == null || tag.name().isBlank())
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "生产标签摘要读取失败");
            result.put(itemRef, tag);
        });
        return Map.copyOf(result);
    }

    private String productionTagName(String dataNodeRef, String brandRef, JsonNode refNode, String requestId) {
        ArrayNode details = productionTagDetails(dataNodeRef, brandRef, refNode, requestId);
        if (details.isEmpty()) return null;
        String name = details.get(0).path("name").asText("");
        if (name.isBlank()) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "生产标签摘要读取失败");
        return name;
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private ObjectNode itemSummary(
            ItemRow row,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions,
            CategorySummaryFacts categorySummaryFacts,
            Map<UUID, List<CatalogTagFact>> catalogTagFactsByItem,
            Map<UUID, ProductionTagOwnerApi.ProductionTagReferenceReadback> productionTagFactsByItem) {
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
        UUID categoryRef = categorySummaryFacts.categoryRefByItem().get(row.ref());
        if (categoryRef == null) item.putNull("categoryRef");
        else item.put("categoryRef", categoryRef.toString());
        JsonNode productionTagRef = sections.path("productionTagRef");
        if (productionTagRef.isTextual() && !productionTagRef.asText().isBlank())
            item.put("productionTagRef", productionTagRef.asText());
        else item.putNull("productionTagRef");
        ProductionTagOwnerApi.ProductionTagReferenceReadback productionTagFact =
                productionTagFactsByItem.get(row.ref());
        if (productionTagRef.isTextual()
                && !productionTagRef.asText().isBlank()
                && (productionTagFact == null
                        || productionTagFact.name() == null
                        || productionTagFact.name().isBlank()))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "生产标签摘要读取失败");
        ArrayNode tagRefs = item.putArray("tagRefs");
        if (sections.path("tagRefs").isArray()) sections.path("tagRefs").forEach(value -> tagRefs.add(value.asText()));
        List<CatalogTagFact> catalogTagFacts = catalogTagFactsByItem.getOrDefault(row.ref(), List.of());
        ArrayNode tags = item.putArray("tags");
        catalogTagFacts.forEach(fact -> tags.addObject()
                .put("tagRef", fact.tagRef().toString())
                .put("code", fact.code())
                .put("name", fact.name()));
        item.put("shapeKey", row.shapeKey()).put("status", row.status());
        if (sections.has("materialRole") && !sections.path("materialRole").isNull())
            item.put("materialRole", sections.path("materialRole").asText());
        else item.putNull("materialRole");
        item.put("source", sourceFact(row, sections));
        item.put("skuEnabledCount", skuFacts.enabledCount())
                .put("skuNonArchivedCount", skuFacts.nonArchivedCount())
                .put("skuTotalCount", skuFacts.totalCount());
        putNullableLong(item, "standardSalePrice", sections.path("standardSalePrice"));
        putNullableLong(item, "standardSalePriceMin", skuFacts.standardSalePriceMin());
        putNullableLong(item, "standardSalePriceMax", skuFacts.standardSalePriceMax());
        putNullableLong(item, "standardPriceDelta", sections.path("standardPriceDelta"));
        putNullableLong(item, "standardExtraPrice", sections.path("standardExtraPrice"));
        item.put("priceGranularity", skuFacts.priceGranularity());
        item.set("categoryPath", categoryPathArray(categorySummaryFacts, row.ref()));
        item.put("hasSkuChildren", skuFacts.totalCount() > 0);
        JsonNode preparationProfile = sections.path("preparationProfile");
        item.set("specificationFacts", specificationFacts(sections));
        item.set("orderOptionFacts", arrayCopy(sections.path("orderOptionConfigs")));
        item.set("attributeFacts", arrayCopy(sections.path("attributeAssignments")));
        item.set("preparationFacts", preparationFacts(productionTagFact, preparationProfile, skuFacts, sections));
        UUID salesUnitRef = nullableUuid(sections, "salesUnitRef");
        UUID baseMeasureUnitRef = nullableUuid(sections, "baseMeasureUnitRef");
        if (salesUnitRef == null) item.putNull("salesUnit");
        else
            setStoredUnitAssignment(
                    item,
                    "salesUnit",
                    salesUnitRef,
                    sections.path("salesUnitSnapshot"),
                    "ITEM_DEFAULT",
                    unitDefinitions);
        if (baseMeasureUnitRef == null) item.putNull("baseMeasureUnit");
        else
            setStoredUnitAssignment(
                    item,
                    "baseMeasureUnit",
                    baseMeasureUnitRef,
                    sections.path("baseMeasureUnitSnapshot"),
                    "ITEM_DEFAULT",
                    unitDefinitions);
        item.putObject("inventoryDeductionSummary")
                .put("grain", skuFacts.totalCount() > 0 ? "SKU" : "ITEM")
                .putNull("mode")
                .putNull("consumptionUnitSnapshot")
                .putNull("bomLineCount");
        item.put("version", row.version()).put("updatedAt", row.updatedAt());
        return item;
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

    /**
     * Save readback intentionally keeps the write contract's identity/value fields only. The detail/list read model
     * adds owner-resolved option labels for display, but those labels are not part of the persisted draft or save wire.
     */
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

    /** The summary contract deliberately omits the axis-level order; axis order remains in skuVariantDimensions. */
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
            ProductionTagOwnerApi.ProductionTagReferenceReadback productionTag,
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
                    .put("owner", "fulfillment-production");
        setNullableJson(result, "profile", preparationProfile);
        result.putObject("skuVariation")
                .put("varies", skuFacts.totalCount() > 0 && skuPreparationDiffers(sections, preparationProfile));
        return result;
    }

    /** The detail and lazy SKU-page projections must expose the same owner-resolved SKU preparation fact. */
    private ObjectNode skuPreparationFacts(
            ProductionTagOwnerApi.ProductionTagReferenceReadback productionTag,
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

    /** `shortName` is a catalog_item column, never a second JSON source of truth. */
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
        ProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback = null;
        if (productionTagFact.isObject()) {
            UUID tagRef = nullableUuid(productionTagFact, "tagRef");
            if (tagRef != null)
                productionTagReadback = new ProductionTagOwnerApi.ProductionTagReferenceReadback(
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

    /**
     * Effective unit labels come from the saved snapshot; only lifecycle status is read from the current definition.
     */
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
            JsonNode node,
            String dataNodeRef,
            String brandRef,
            UUID itemSalesUnitRef,
            UUID itemBaseMeasureUnitRef,
            JsonNode itemPreparationProfile,
            ProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback,
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

    /** Post-write copy readback needs identity/version only; full hydration would recreate fan-out. */
    private List<ItemRow> loadItemIdentityRows(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(codes);
        return jdbc.query(
                "SELECT"
                        + " item_ref,code,name,short_name,shape_key,status,sections::text,version,"
                        + "updated_at_epoch_millis,source_scope_ref"
                        + " FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code IN ("
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
                args.toArray());
    }

    /**
     * Identity lookup for governance/detail and lifecycle prechecks. Terminal rows stay in the owner read so callers
     * can distinguish an existing VOIDED fact from an absent code; ordinary list/candidate/copy scans keep using
     * {@link #loadItemIdentityRows(String, String, List)} and therefore continue to hide terminal rows.
     */
    private List<ItemRow> loadItemIdentityRowsIncludingVoided(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(codes);
        return jdbc.query(
                "SELECT"
                        + " item_ref,code,name,short_name,shape_key,status,sections::text,version,"
                        + "updated_at_epoch_millis,source_scope_ref"
                        + " FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code IN ("
                        + placeholders + ") ORDER BY code",
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
                args.toArray());
    }

    /**
     * The brand-copy closure starts from every source item identity, but it does not need every relation family for
     * every item. Keep the identity scan separate so the closure can decide which set reads are actually needed.
     */
    private List<ItemRow> loadAllItemIdentityRows(String dataNodeRef, String brandRef) {
        return jdbc.query(
                "SELECT item_ref,code,name,short_name,shape_key,status,sections::text,version,updated_at_epoch_millis,"
                        + "source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND "
                        + "status <> 'VOIDED' ORDER BY code",
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
                brandRef);
    }

    /**
     * Brand copy needs the same owner facts as the old full hydrate, but probing eight empty relation families is pure
     * latency for ordinary items. One presence query chooses the set reads; it does not replace any fact read when a
     * family is present, and the resulting projection remains the established copy source of truth.
     */
    private CopyClosureFacts hydrateCopyClosureFacts(String dataNodeRef, String brandRef, List<ItemRow> rows) {
        if (rows.isEmpty()) return CopyClosureFacts.empty();
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        CopyFactPresence presence = copyFactPresence(itemRefs);
        Map<UUID, ArrayNode> skusByItem = presence.skus() ? skuFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> categoriesByItem =
                presence.categories() ? categoryFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> compositesByItem =
                presence.composites() ? compositeFacts.readByItemRefs(itemRefs) : Map.of();
        CatalogItemDefinitionFacts.CopyAttributeFacts attributeFacts = presence.attributes()
                ? itemDefinitionFacts.readCopyAttributeFacts(dataNodeRef, brandRef, itemRefs)
                : CatalogItemDefinitionFacts.CopyAttributeFacts.empty();
        Map<UUID, ArrayNode> attributeAssignmentsByItem = attributeFacts.assignmentsByItem();
        CatalogItemDefinitionFacts.CopyOrderOptionFacts orderOptionFacts = presence.orderOptions()
                ? itemDefinitionFacts.copyOrderOptionFacts(dataNodeRef, brandRef, itemRefs)
                : CatalogItemDefinitionFacts.CopyOrderOptionFacts.empty();
        Map<UUID, ArrayNode> orderOptionConfigsByItem = orderOptionFacts.configsByItem();
        Map<UUID, ArrayNode> axesByItem = presence.axes() ? skuVariantAxisFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> imagesByItem = presence.images() ? itemMediaFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, Map<String, JsonNode>> referencesByItem =
                presence.references() ? itemReferenceFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ItemUnitRefs> unitRefsByItem = itemUnitRefsByItemRefs(itemRefs);
        Map<UUID, CatalogIdentifierFacts.ItemReadback> identifiersByItem = identifierFacts.readByItemRefs(itemRefs);
        List<UUID> skuRefs = skusByItem.values().stream()
                .filter(java.util.Objects::nonNull)
                .flatMap(array -> java.util.stream.StreamSupport.stream(array.spliterator(), false))
                .map(sku -> nullableUuid(sku, "productSkuRef"))
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<UUID, JsonNode> itemProfilesByItem = preparationFacts.readItemProfiles(itemRefs);
        Map<UUID, JsonNode> skuOverridesByRef = preparationFacts.readSkuOverrides(skuRefs);
        Map<UUID, Map<UUID, JsonNode>> optionEffectsByItem = preparationFacts.readOptionEffects(itemRefs);
        List<ItemRow> hydrated = new ArrayList<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            ArrayNode categoryRefs = categoriesByItem.getOrDefault(row.ref(), mapper.createArrayNode());
            sections.set("categoryRefs", categoryRefs);
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
            CatalogIdentifierFacts.ItemReadback identifierReadback = identifiersByItem.get(row.ref());
            decoratePreparationFacts(
                    row.ref(),
                    sections,
                    identifierReadback,
                    itemProfilesByItem.get(row.ref()),
                    identifierReadback == null ? Map.of() : identifierReadback.skuIdentifiers(),
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
        return new CopyClosureFacts(
                List.copyOf(hydrated),
                orderOptionFacts.definitionRefsByItem(),
                attributeFacts.definitions(),
                orderOptionFacts.definitions());
    }

    private CopyFactPresence copyFactPresence(Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        String sql = "SELECT "
                + "EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE item_ref IN (" + placeholders
                + ") AND status <> 'VOIDED'),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_category WHERE item_ref IN (" + placeholders + ")),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_composite_group WHERE item_ref IN (" + placeholders + ")),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE item_ref IN (" + placeholders
                + ")),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_config WHERE item_ref IN (" + placeholders
                + ")),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_sku_variant_axis WHERE item_ref IN (" + placeholders + ")),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_image WHERE item_ref IN (" + placeholders + ")),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_reference WHERE item_ref IN (" + placeholders + "))";
        List<Object> args = new ArrayList<>();
        for (int index = 0; index < 8; index++) args.addAll(refs);
        return jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.size(); index++) statement.setObject(index + 1, args.get(index));
                },
                result -> {
                    if (!result.next())
                        return new CopyFactPresence(false, false, false, false, false, false, false, false);
                    return new CopyFactPresence(
                            result.getBoolean(1),
                            result.getBoolean(2),
                            result.getBoolean(3),
                            result.getBoolean(4),
                            result.getBoolean(5),
                            result.getBoolean(6),
                            result.getBoolean(7),
                            result.getBoolean(8));
                });
    }

    /**
     * Copy compatibility only needs the catalog item identity/shape and SKU structure. Loading the full detail
     * projection here re-reads categories, BOMs, option configs, media, references and unit snapshots that the copy
     * closure already owns. Keep the SKU relation as the one additional set-read because catalog_item.sections does not
     * persist SKU rows.
     */
    private TargetItemFacts loadCopyTargetFacts(String dataNodeRef, String brandRef, List<String> codes) {
        List<ItemRow> rows = loadItemIdentityRows(dataNodeRef, brandRef, codes);
        if (rows.isEmpty()) return new TargetItemFacts(Map.of(), 0L);
        Map<UUID, ArrayNode> skusByItem =
                skuFacts.readByItemRefs(rows.stream().map(ItemRow::ref).toList());
        Map<String, ItemRow> result = new LinkedHashMap<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            result.put(
                    row.code(),
                    new ItemRow(
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
        return new TargetItemFacts(
                Map.copyOf(result),
                rows.stream().mapToLong(ItemRow::version).max().orElse(0L));
    }

    /**
     * Rehydrates the established owner read shape from owner relations; catalog_item.sections never persists these
     * relational facts. The list projection reads the SKU-axis relation in one set-based batch so its
     * specificationFacts projection preserves the authoritative axis membership, order and dictionary status used by
     * the detail projection. Reconstructing axes from SKU assignments would omit configured-but-unused values and lose
     * the axis-level display order.
     */
    private List<ItemRow> hydrateItemSummaryFacts(List<ItemRow> rows) {
        if (rows.isEmpty()) return rows;
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        CatalogSkuFacts.ListReadback listReadback = skuFacts.readByItemRefsForList(itemRefs);
        Map<UUID, ArrayNode> skusByItem = listReadback.skusByItem();
        Map<UUID, ArrayNode> axesByItem = listReadback.axesByItem();
        Map<UUID, ArrayNode> imagesByItem = itemMediaFacts.readByItemRefs(itemRefs);
        Map<UUID, ArrayNode> attributeAssignmentsByItem = itemDefinitionFacts.readAttributeAssignments(itemRefs);
        List<UUID> nonSkuItemRefs = itemRefs.stream()
                .filter(itemRef -> skusByItem
                        .getOrDefault(itemRef, mapper.createArrayNode())
                        .isEmpty())
                .toList();
        Map<UUID, ArrayNode> orderOptionConfigsByItem = itemDefinitionFacts.readOrderOptionConfigs(nonSkuItemRefs);
        Map<UUID, Map<String, JsonNode>> referencesByItem = itemReferenceFacts.readByItemRefs(itemRefs);
        List<ItemRow> hydrated = new ArrayList<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("skuVariantDimensions", axesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set(
                    "attributeAssignments",
                    attributeAssignmentsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set(
                    "orderOptionConfigs", orderOptionConfigsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("images", imagesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
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
            decoratePreparationFacts(
                    row.ref(), sections, null, sections.path("preparationProfile"), Map.of(), Map.of(), Map.of());
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

    /**
     * Detail reads must return the complete contract projection, but they do not need to probe relation families that
     * the selected shape cannot expose. The generic list/save hydrator intentionally remains unchanged because those
     * paths preserve partial-write facts and list projections for a mixed-shape collection. Keeping this selector at
     * the detail boundary removes the fixed fan-out caused by reading every relation for every shape.
     */
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

    /** Adds the typed identification/preparation projection without making it another persisted JSON authority. */
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

    /**
     * Save is a PATCH-shaped aggregate command. Preserve omitted relational facts, while hydrating the current
     * production-tag/tag relation snapshot once so disabled-reference validation can reuse it even when the request
     * supplies replacement fields; the old unconditional hydrate made every save pay for every relation family twice.
     */
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

    /**
     * Save is a whole-aggregate command, but each relational fact family is owned by its own facts component. A single
     * owner-local presence query lets the command distinguish an explicit empty clear from an unchanged empty family,
     * so it can avoid issuing DELETE/UPDATE work that cannot change state. This is deliberately a presence probe rather
     * than a second projection: non-empty families still use their existing owner implementation.
     */
    private SaveFactPresence saveFactPresence(UUID itemRef) {
        String sql = "SELECT "
                + "EXISTS (SELECT 1 FROM catalog.product_identifier WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item WHERE item_ref=? AND preparation_profile IS NOT NULL),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_sku WHERE item_ref=? AND preparation_override IS NOT NULL),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_sku_media media JOIN catalog.catalog_sku sku ON "
                + "sku.product_sku_ref=media.product_sku_ref WHERE sku.item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_category WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_composite_group WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_attribute_assignment WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_config WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_order_option_value_override override JOIN "
                + "catalog.catalog_item_order_option_config config ON "
                + "config.item_order_option_config_ref=override.item_order_option_config_ref "
                + "WHERE config.item_ref=? AND override.preparation_effect IS NOT NULL),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_sku_variant_axis WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_image WHERE item_ref=?),"
                + "EXISTS (SELECT 1 FROM catalog.catalog_item_reference WHERE item_ref=?)";
        return jdbc.query(
                sql,
                statement -> {
                    for (int index = 1; index <= 12; index++) statement.setObject(index, itemRef);
                },
                result -> {
                    if (!result.next())
                        return new SaveFactPresence(
                                false, false, false, false, false, false, false, false, false, false, false, false);
                    return new SaveFactPresence(
                            result.getBoolean(1),
                            result.getBoolean(2),
                            result.getBoolean(3),
                            result.getBoolean(4),
                            result.getBoolean(5),
                            result.getBoolean(6),
                            result.getBoolean(7),
                            result.getBoolean(8),
                            result.getBoolean(9),
                            result.getBoolean(10),
                            result.getBoolean(11),
                            result.getBoolean(12));
                });
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
        CopyClosureFacts hydrated =
                hydrateCopyClosureFacts(dataNodeRef, brandRef, loadAllItemIdentityRows(dataNodeRef, brandRef));
        List<ItemRow> all = hydrated.items();
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
        Map<UUID, List<UUID>> orderOptionMaterialsByItem = itemDefinitionFacts.orderOptionMaterialItemRefsByTypedFacts(
                hydrated.orderOptionDefinitionRefsByItem(), hydrated.orderOptionDefinitions());
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
            for (UUID materialItemRef : orderOptionMaterialsByItem.getOrDefault(row.ref(), List.of())) {
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
        Set<UUID> selectedAttributeDefinitionRefs = definitionRefs(items, "attributeAssignments");
        Map<UUID, CatalogItemDefinitionFacts.CopyAttributeDefinition> attributeDefinitions = new LinkedHashMap<>();
        selectedAttributeDefinitionRefs.forEach(ref -> {
            CatalogItemDefinitionFacts.CopyAttributeDefinition definition =
                    hydrated.attributeDefinitions().get(ref);
            if (definition != null) attributeDefinitions.put(ref, definition);
        });
        Set<UUID> selectedOrderOptionDefinitionRefs = new LinkedHashSet<>();
        items.forEach(row -> selectedOrderOptionDefinitionRefs.addAll(
                hydrated.orderOptionDefinitionRefsByItem().getOrDefault(row.ref(), List.of())));
        List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions =
                hydrated.orderOptionDefinitions().stream()
                        .filter(definition -> selectedOrderOptionDefinitionRefs.contains(definition.ref()))
                        .toList();
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
        return new CatalogClosure(
                items,
                categories,
                dictionaries,
                units,
                orderOptionDefinitions,
                attributeDefinitions,
                List.copyOf(edges));
    }

    private Set<UUID> definitionRefs(List<ItemRow> rows, String sectionName) {
        Set<UUID> refs = new LinkedHashSet<>();
        for (ItemRow row : rows) {
            JsonNode section = json(row.sectionsJson()).path(sectionName);
            if (!section.isArray()) continue;
            for (JsonNode value : section) {
                String refText = value.path("definitionRef").asText("");
                if (refText.isBlank()) continue;
                try {
                    refs.add(UUID.fromString(refText));
                } catch (IllegalArgumentException failure) {
                    throw new CatalogOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            422,
                            sectionName + " definitionRef 不是有效的 opaque UUID",
                            failure);
                }
            }
        }
        return Set.copyOf(refs);
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

    /** Unit assignments live in catalog columns and SKU rows; persisted item JSON deliberately omits them. */
    private Set<UUID> unitReferencesFromOwner(String scope, String brand, UUID itemRef) {
        if (itemRef == null) return Set.of();
        return Set.copyOf(jdbc.query(
                "SELECT sales_unit_ref FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref=? "
                        + "AND sales_unit_ref IS NOT NULL UNION SELECT base_measure_unit_ref FROM catalog.catalog_item "
                        + "WHERE data_node_ref=? AND brand_ref=? AND item_ref=? AND base_measure_unit_ref IS NOT NULL "
                        + "UNION SELECT sku.sales_unit_override_ref FROM catalog.catalog_sku sku WHERE sku.item_ref=? "
                        + "AND sku.sales_unit_override_ref IS NOT NULL UNION SELECT sku.base_measure_unit_override_ref "
                        + "FROM catalog.catalog_sku sku WHERE sku.item_ref=? "
                        + "AND sku.base_measure_unit_override_ref IS NOT NULL",
                (result, row) -> result.getObject(1, UUID.class),
                scope,
                brand,
                itemRef,
                scope,
                brand,
                itemRef,
                itemRef,
                itemRef));
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
                "productionTagRef",
                "uncategorized",
                "includeSubCategories",
                "status",
                "source",
                "candidateUsage",
                "excludeItemCode",
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
        optionalUuid(request, "productionTagRef");
        if (parseBoolean(request, "uncategorized", false) && optional(request, "categoryRef") != null)
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "uncategorized cannot be combined with categoryRef");
        String smartViewKey = optional(request, "smartViewKey");
        if (smartViewKey != null && !CatalogInventoryShapeManifest.accepts("smartViewKey", smartViewKey))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "smartViewKey is not supported");
        String source = optional(request, "source");
        if (source != null && !CatalogInventoryShapeManifest.accepts("catalogSource", source))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "source is not supported");
        String candidateUsage = optional(request, "candidateUsage");
        if (candidateUsage != null && !"COMPOSITE_COMPONENT".equals(candidateUsage))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "candidateUsage is not supported");
        if ("COMPOSITE_COMPONENT".equals(candidateUsage)
                && (optional(request, "excludeItemCode") == null
                        || optional(request, "excludeItemCode").isBlank()))
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "COMPOSITE_COMPONENT candidate usage requires excludeItemCode");
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

    private static OpaqueCollectionCursor.Position decodeSalesMenuCursor(String cursor, String queryIdentity) {
        try {
            return OpaqueCollectionCursor.decode(cursor, queryIdentity);
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
        addDeclaredRef(result, node.path("productionTagRef"), "PRODUCTION_TAG");
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
        return targetScopeVersions(target, brand, request, graph).maxVersion();
    }

    /**
     * Loads the target facts used by one copy request. Item/SKU identity, active reference mappings and the version
     * projections are kept together so compatibility and the preflight payload consume the same read. The post-write
     * targetScopeVersion path remains a fresh readback and is intentionally not routed here.
     */
    private TargetCopyFacts loadTargetCopyFacts(String target, String brand, ObjectNode request, CatalogClosure graph) {
        TargetItemFacts targetItems = loadCopyTargetFacts(
                target, brand, graph.items().stream().map(ItemRow::code).toList());
        TargetCategoryFacts targetCategories = targetCategoryFacts(target, brand, graph.categories());
        TargetDictionaryFacts targetDictionaries = targetDictionaryFacts(target, brand, graph.dictionaries());
        Map<String, UnitRow> targetUnits = targetUnitsByCode(target, brand, graph.units());
        Map<String, Long> unitVersions = new LinkedHashMap<>();
        targetUnits.forEach((code, row) -> unitVersions.put(code, row.version()));

        long maxVersion = optional(request, "targetItemCode") == null
                ? targetItems.maxVersion()
                : targetScopeVersion(target, brand, request, graph.items());
        for (long version : targetCategories.versions().values()) maxVersion = Math.max(maxVersion, version);
        for (long version : targetDictionaries.versions().values()) maxVersion = Math.max(maxVersion, version);
        for (long version : unitVersions.values()) maxVersion = Math.max(maxVersion, version);
        return new TargetCopyFacts(
                targetItems.rows(),
                targetCategories.refs(),
                targetDictionaries.refs(),
                targetUnits,
                new TargetScopeVersions(
                        maxVersion, targetCategories.versions(), targetDictionaries.versions(), unitVersions));
    }

    /**
     * Loads target versions afresh for the post-write readback. The copy-plan path uses TargetCopyFacts so these reads
     * remain outside the request-local preflight snapshot and cannot hide a target-side change after writes.
     */
    private TargetScopeVersions targetScopeVersions(
            String target, String brand, ObjectNode request, CatalogClosure graph) {
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
        return new TargetScopeVersions(max, categoryVersions, dictionaryVersions, unitVersions);
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

    private TargetCategoryFacts targetCategoryFacts(String target, String brand, List<CategoryRow> rows) {
        List<String> codes = rows.stream().map(CategoryRow::code).distinct().toList();
        if (codes.isEmpty()) return new TargetCategoryFacts(Map.of(), Map.of());
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                "SELECT code,category_ref,status,version FROM catalog.catalog_category WHERE data_node_ref=? "
                        + "AND brand_ref=? AND code IN ("
                        + placeholders
                        + ") ORDER BY code,category_ref",
                result -> {
                    Map<String, UUID> refs = new LinkedHashMap<>();
                    Map<String, Long> versions = new LinkedHashMap<>();
                    while (result.next()) {
                        String code = result.getString(1);
                        UUID ref = result.getObject(2, UUID.class);
                        String status = result.getString(3);
                        versions.merge(code, result.getLong(4), Math::max);
                        if (status != null && !"VOIDED".equals(status) && refs.putIfAbsent(code, ref) != null)
                            throw new CatalogOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, "目标分类编码引用不唯一: " + code);
                    }
                    return new TargetCategoryFacts(Map.copyOf(refs), Map.copyOf(versions));
                },
                args.toArray());
    }

    private TargetDictionaryFacts targetDictionaryFacts(String target, String brand, List<DictionaryRow> rows) {
        List<DictionaryKey> keys = rows.stream()
                .map(row -> new DictionaryKey(row.dictionaryKind(), row.code()))
                .distinct()
                .toList();
        if (keys.isEmpty()) return new TargetDictionaryFacts(Map.of(), Map.of());
        String predicates = String.join(" OR ", Collections.nCopies(keys.size(), "(dictionary_kind=? AND code=?)"));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        for (DictionaryKey key : keys) {
            args.add(key.kind());
            args.add(key.code());
        }
        return jdbc.query(
                "SELECT dictionary_kind,code,entry_ref,status,version FROM catalog.dictionary_entry WHERE "
                        + "data_node_ref=? AND brand_ref=? AND ("
                        + predicates
                        + ") ORDER BY dictionary_kind,code,entry_ref",
                result -> {
                    Map<DictionaryKey, UUID> refs = new LinkedHashMap<>();
                    Map<DictionaryKey, Long> versions = new LinkedHashMap<>();
                    while (result.next()) {
                        DictionaryKey key = new DictionaryKey(result.getString(1), result.getString(2));
                        UUID ref = result.getObject(3, UUID.class);
                        String status = result.getString(4);
                        versions.merge(key, result.getLong(5), Math::max);
                        if (status != null && !"VOIDED".equals(status) && refs.putIfAbsent(key, ref) != null) {
                            String failureMessage = "目标字典编码引用不唯一: " + key.code();
                            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage);
                        }
                    }
                    return new TargetDictionaryFacts(Map.copyOf(refs), Map.copyOf(versions));
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
                graph.attributeDefinitions().values());
        String orderOptionDefinitions = itemDefinitionFacts.orderOptionCopyFingerprint(graph.orderOptionDefinitions());
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
            TargetCopyFacts targetCopyFacts,
            ObjectNode request,
            boolean rejectBlocking) {
        Map<ReferenceKey, String> supplied = suppliedReferenceMappings(request);
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>();
        ArrayNode compatibilityResults = mapper.createArrayNode();
        Map<String, ItemRow> targetRows = targetCopyFacts.targetRows();
        for (ItemRow row : graph.items()) {
            ItemRow existing = targetRows.get(row.code());
            mapping.put(
                    new ReferenceKey("CATALOG_ITEM", row.ref().toString()),
                    targetRefFor(
                            new ReferenceKey("CATALOG_ITEM", row.ref().toString()),
                            existing == null ? null : existing.ref(),
                            supplied));
        }
        Map<String, UUID> targetCategoryRefs = targetCopyFacts.categoryRefs();
        for (CategoryRow row : graph.categories()) {
            UUID existing = targetCategoryRefs.get(row.code());
            mapping.put(
                    new ReferenceKey("CATALOG_CATEGORY", row.ref().toString()),
                    targetRefFor(new ReferenceKey("CATALOG_CATEGORY", row.ref().toString()), existing, supplied));
        }
        Map<DictionaryKey, UUID> targetDictionaryRefs = targetCopyFacts.dictionaryRefs();
        for (DictionaryRow row : graph.dictionaries()) {
            UUID existing = targetDictionaryRefs.get(new DictionaryKey(row.dictionaryKind(), row.code()));
            mapping.put(
                    new ReferenceKey(row.objectType(), row.ref().toString()),
                    targetRefFor(new ReferenceKey(row.objectType(), row.ref().toString()), existing, supplied));
        }
        Map<String, UnitRow> targetUnits = targetCopyFacts.targetUnits();
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
            boolean blocked = existing != null && !sameUnitDefinition(row, existing);
            String compatibilityReason;
            if (blocked) compatibilityReason = "同编码计量单位的名称、类别或精度不一致";
            else if (existing == null) compatibilityReason = "目标不存在，将创建";
            else compatibilityReason = "编码与语义兼容，可复用";
            compatibilityResults.add(compatibilityResult(
                    row.objectType(),
                    row.objectType() + ":" + row.ref(),
                    blocked ? "BLOCKED" : existing == null ? "CREATE" : "REUSE",
                    compatibilityReason,
                    blocked
                            ? "CATALOG_COPY_UNIT_CONFLICT"
                            : existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED",
                    canonicalTuple(
                            target,
                            brand,
                            row.objectType(),
                            row.code(),
                            row.name(),
                            row.unitDimension(),
                            Integer.toString(row.precision()))));
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
        for (String code : orderOptionPlan.conflictCodes())
            compatibilityResults.add(compatibilityResult(
                    "CATALOG_ORDER_OPTION_DEFINITION",
                    "CATALOG_ORDER_OPTION_DEFINITION:" + code,
                    "BLOCKED",
                    "同编码点单选项定义的选择方式、选项或扣料原料不一致",
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    canonicalTuple(target, brand, "CATALOG_ORDER_OPTION_DEFINITION", code)));
        for (DictionaryRow row : graph.dictionaries())
            compatibilityResults.add(compatibilityResult(
                    row.objectType(),
                    row.objectType() + ":" + row.ref(),
                    "REUSE_OR_CREATE",
                    "按编码复用或创建",
                    "REUSE_CONFIRMATION_REQUIRED",
                    canonicalTuple(target, brand, row.objectType(), canonicalParts(row, graph))));
        // Production owns the target tag fact.  Catalog only accepts the public
        // owner-produced mapping carried by the coordinator; it never probes the
        // production schema nor invents a target tag UUID.
        supplied.forEach((key, value) -> {
            if ("PRODUCTION_TAG".equals(key.objectType())) mapping.put(key, value);
        });
        for (ItemRow row : graph.items()) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            compatibilityResults.add(compatibilityResult(
                    "CATALOG_ITEM",
                    "CATALOG_ITEM:" + row.ref(),
                    check.result(),
                    check.reason(),
                    check.reasonCode(),
                    canonicalTuple(target, brand, "CATALOG_ITEM", row.code())));
            if (rejectBlocking && check.blocking())
                throw new CatalogOwnerApi.Problem(check.problemCode(), 422, check.reason() + ": " + row.code());
        }
        List<String> attributeConflicts = itemDefinitionFacts.attributeCopyConflictCodes(
                target, brand, graph.attributeDefinitions().values());
        for (String code : attributeConflicts)
            compatibilityResults.add(compatibilityResult(
                    "CATALOG_ATTRIBUTE_DEFINITION",
                    "CATALOG_ATTRIBUTE_DEFINITION:" + code,
                    "BLOCKED",
                    "同编码商品属性定义的类型或选项不一致",
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    canonicalTuple(target, brand, "CATALOG_ATTRIBUTE_DEFINITION", code)));
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
        return new CopyCompatibility(
                Map.copyOf(mapping), compatibilityResults, Map.copyOf(targetRows), Map.copyOf(targetUnits));
    }

    private ObjectNode compatibilityResult(
            String objectType,
            String compatibilityId,
            String result,
            String reason,
            String reasonCode,
            ObjectNode canonicalTuple) {
        return mapper.createObjectNode()
                .put("objectType", objectType)
                .put("compatibilityId", compatibilityId)
                .put("result", result)
                .put("reason", reason)
                .put("reasonCode", reasonCode)
                .set("canonicalTuple", canonicalTuple);
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
                    "规格结构不一致",
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
            case "productionTagRef" -> "PRODUCTION_TAG";
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
        for (ItemRow row : loadItemIdentityRows(targetScope, brand, codes))
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

    private record CategoryCandidateRow(
            UUID categoryRef,
            String code,
            String name,
            UUID parentCategoryRef,
            int displayOrder,
            boolean hasChildren,
            String pathJson,
            boolean cycleBlocked,
            boolean depthBlocked,
            long total) {}

    private record CategoryPathNode(UUID categoryRef, String code, String name) {}

    private record CatalogTagFact(UUID tagRef, String code, String name) {}

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

    private record SalesMenuItemRow(
            UUID itemRef,
            String itemCode,
            String itemName,
            String shapeKey,
            String status,
            Long defaultPriceCents,
            long version) {}

    private record SalesMenuFactSnapshot(
            Map<UUID, ArrayNode> skusByItem,
            Map<UUID, ArrayNode> axesByItem,
            Map<UUID, ArrayNode> imagesByItem,
            Map<UUID, ArrayNode> categoryRefsByItem,
            Map<UUID, List<String>> categoryNamesByItem,
            Map<UUID, InventoryOwnerApi.UnitSnapshot> salesUnitsByItem) {
        static SalesMenuFactSnapshot empty() {
            return new SalesMenuFactSnapshot(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
        }
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

    private record CopiedUnitInput(UUID itemRef, ObjectNode sections, ArrayNode skus) {}

    private record CopiedUnitRefs(
            UUID salesUnitRef,
            UUID baseMeasureUnitRef,
            Map<UUID, UUID> salesOverrides,
            Map<UUID, UUID> baseOverrides,
            ArrayNode skus) {}

    /** Immutable pre-write fact valid only between receipt recheck and this command's first mutation. */
    private record CatalogCoordinationSnapshot(ItemRow current, CategoryRow category) {}

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
            int displayOrder,
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

    private record InboundItemReference(UUID itemRef, String code, String name) {}

    private record SkuTransitionRequest(UUID skuRef, String targetStatus, long expectedVersion) {}

    private record SkuInboundReference(UUID componentRef, UUID ownerItemRef, String ownerCode, String ownerName) {}

    private record SkuReferenceOwner(UUID itemRef, String itemStatus, String skuStatus) {}

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
            Map<UUID, CatalogItemDefinitionFacts.CopyAttributeDefinition> attributeDefinitions,
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

    private record CopyClosureFacts(
            List<ItemRow> items,
            Map<UUID, List<UUID>> orderOptionDefinitionRefsByItem,
            Map<UUID, CatalogItemDefinitionFacts.CopyAttributeDefinition> attributeDefinitions,
            List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions) {
        private static CopyClosureFacts empty() {
            return new CopyClosureFacts(List.of(), Map.of(), Map.of(), List.of());
        }
    }

    private record CatalogCopyPlan(
            List<String> selected,
            CatalogClosure graph,
            long sourceVersion,
            long targetVersion,
            TargetCopyFacts targetCopyFacts,
            String digest) {}

    private record TargetItemFacts(Map<String, ItemRow> rows, long maxVersion) {
        private TargetItemFacts {
            rows = Map.copyOf(rows);
        }
    }

    private record TargetCategoryFacts(Map<String, UUID> refs, Map<String, Long> versions) {
        private TargetCategoryFacts {
            refs = Map.copyOf(refs);
            versions = Map.copyOf(versions);
        }
    }

    private record TargetDictionaryFacts(Map<DictionaryKey, UUID> refs, Map<DictionaryKey, Long> versions) {
        private TargetDictionaryFacts {
            refs = Map.copyOf(refs);
            versions = Map.copyOf(versions);
        }
    }

    private record TargetCopyFacts(
            Map<String, ItemRow> targetRows,
            Map<String, UUID> categoryRefs,
            Map<DictionaryKey, UUID> dictionaryRefs,
            Map<String, UnitRow> targetUnits,
            TargetScopeVersions versions) {
        private TargetCopyFacts {
            targetRows = Map.copyOf(targetRows);
            categoryRefs = Map.copyOf(categoryRefs);
            dictionaryRefs = Map.copyOf(dictionaryRefs);
            targetUnits = Map.copyOf(targetUnits);
        }
    }

    private record TargetScopeVersions(
            long maxVersion,
            Map<String, Long> categoryVersions,
            Map<DictionaryKey, Long> dictionaryVersions,
            Map<String, Long> unitVersions) {
        private TargetScopeVersions {
            categoryVersions = Map.copyOf(categoryVersions);
            dictionaryVersions = Map.copyOf(dictionaryVersions);
            unitVersions = Map.copyOf(unitVersions);
        }
    }

    private record PreparedLocalCopy(LocalCopyPlan plan, CatalogOwnerApi.CopyPreflightReadback readback)
            implements CatalogOwnerApi.LocalCopyExecutionPreparation {
        @Override
        public CatalogOwnerApi.CopyPreflightReadback preflight() {
            return readback;
        }
    }

    private record PreparedBrandCopy(
            CatalogCopyPlan plan, CopyCompatibility compatibility, CatalogOwnerApi.CopyPreflightReadback readback)
            implements CatalogOwnerApi.BrandCopyExecutionPreparation {
        @Override
        public CatalogOwnerApi.CopyPreflightReadback preflight() {
            return readback;
        }
    }

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

    private record CopyCompatibility(
            Map<ReferenceKey, String> mapping,
            ArrayNode compatibilityResults,
            Map<String, ItemRow> targetRows,
            Map<String, UnitRow> targetUnits) {}

    private record CompatibilityCheck(
            String result, String reason, String problemCode, String reasonCode, boolean blocking) {}

    private record TemporaryPromotionSourceFacts(
            ObjectNode sections, CatalogItemDefinitionFacts.TemporaryPromotionFacts definitionFacts) {}

    private record PromotionExecution(ObjectNode response, CatalogTemporaryPromotionProjection projection) {}

    private record Receipt(String operationId, String requestHash, JsonNode response) {}
}
