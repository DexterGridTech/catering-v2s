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


/** Catalog workbench and cross-fact task-read owner; it owns no Catalog mutation. */
@Service
public class CatalogWorkbenchReadService {
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
    @Autowired
    public CatalogWorkbenchReadService(
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

public JsonNode readWorkbenchContext(String dataNodeRef, String brandRef, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return workbenchContext(dataNodeRef, brandRef, requestId);
    }

public JsonNode readNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return navigation(dataNodeRef, brandRef, requestId, request);
    }

public JsonNode readItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return items(dataNodeRef, brandRef, requestId, request);
    }

public JsonNode readCategoryCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return categoryCandidates(dataNodeRef, brandRef, requestId, request);
    }

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
                true,
                false);
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

public Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> readSalesMenuItemFacts(
            String dataNodeRef, String brandRef, Set<UUID> itemRefs) {
        List<SalesMenuItemRow> rows = readSalesMenuItemRows(dataNodeRef, brandRef, itemRefs);
        if (rows.isEmpty()) return Map.of();

        SalesMenuFactSnapshot facts = readSalesMenuFactSnapshot(
                dataNodeRef,
                brandRef,
                rows.stream().map(SalesMenuItemRow::itemRef).toList(),
                true,
                false,
                true);
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> result = new LinkedHashMap<>();
        rows.forEach(row -> result.put(row.itemRef(), salesMenuItemFacts(row, facts)));
        return Map.copyOf(result);
    }

public Map<UUID, CatalogOwnerApi.SalesMenuItemReferenceFact> readSalesMenuItemReferenceFacts(
            String dataNodeRef, String brandRef, Set<UUID> itemRefs) {
        List<SalesMenuItemRow> rows = readSalesMenuItemRows(dataNodeRef, brandRef, itemRefs);
        if (rows.isEmpty()) return Map.of();
        Map<UUID, CatalogOwnerApi.SalesMenuItemReferenceFact> result = new LinkedHashMap<>();
        rows.forEach(row -> result.put(
                row.itemRef(),
                new CatalogOwnerApi.SalesMenuItemReferenceFact(
                        row.itemRef(), row.itemCode(), row.itemName(), row.shapeKey())));
        return Map.copyOf(result);
    }

private List<SalesMenuItemRow> readSalesMenuItemRows(String dataNodeRef, String brandRef, Set<UUID> itemRefs) {
        requireScope(dataNodeRef, brandRef);
        if (itemRefs == null || itemRefs.isEmpty()) return List.of();
        for (UUID itemRef : itemRefs)
            if (itemRef == null)
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemRefs must contain UUID values");

        List<UUID> requestedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(requestedRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>(List.of(dataNodeRef, brandRef));
        arguments.addAll(requestedRefs);
        return jdbc.query(
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
                salesMenuUuidFacts(facts.imagesByItem().get(row.itemRef()), "imageAssetRefs"),
                salesMenuOrderOptionFacts(facts.orderOptionsByItem().get(row.itemRef())),
                salesMenuSkuSummary(row.shapeKey(), skus, axes),
                skus,
                axes);
    }

private SalesMenuFactSnapshot readSalesMenuFactSnapshot(
            String dataNodeRef,
            String brandRef,
            Collection<UUID> itemRefs,
            boolean includeSalesUnits,
            boolean includeCategoryNames,
            boolean includeOrderOptions) {
        if (itemRefs == null || itemRefs.isEmpty()) return SalesMenuFactSnapshot.empty();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        CatalogSkuFacts.ListReadback skuReadback = skuFacts.readByItemRefsForList(refs);
        Map<UUID, ArrayNode> orderOptionsByItem =
                includeOrderOptions ? itemDefinitionFacts.readOrderOptionConfigs(refs) : Map.of();
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
                Map.copyOf(salesUnitsByItem),
                Map.copyOf(orderOptionsByItem));
    }

private List<CatalogOwnerApi.SalesMenuSkuFact> salesMenuSkuFacts(ArrayNode values) {
        if (values == null || !values.isArray()) return List.of();
        List<CatalogOwnerApi.SalesMenuSkuFact> result = new ArrayList<>();
        for (JsonNode value : values) {
            String status = requiredSalesMenuText(value, "sku.status");
            // This is the task-shaped SalesMenu candidate projection. Only Catalog ENABLED
            // SKUs are selectable; DISABLED/VOIDED remain Catalog facts but are not candidates.
            if (!"ENABLED".equals(status)) continue;
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

private List<CatalogOwnerApi.SalesMenuOrderOptionFact> salesMenuOrderOptionFacts(ArrayNode values) {
        if (values == null || !values.isArray()) return List.of();
        List<CatalogOwnerApi.SalesMenuOrderOptionFact> result = new ArrayList<>();
        for (JsonNode value : values) {
            List<CatalogOwnerApi.SalesMenuOrderOptionValueFact> optionValues = new ArrayList<>();
            JsonNode valuesNode = value.get("values");
            if (valuesNode != null && !valuesNode.isNull()) {
                if (!valuesNode.isArray()) throw salesMenuResultProblem("orderOptions.values");
                for (JsonNode optionValue : valuesNode)
                    optionValues.add(new CatalogOwnerApi.SalesMenuOrderOptionValueFact(
                            requiredSalesMenuUuid(optionValue, "orderOption.definitionValueRef"),
                            requiredSalesMenuText(optionValue, "orderOption.name"),
                            optionValue.path("displayOrder").asInt(0),
                            optionValue.path("defaultValue").asBoolean(false),
                            optionalSalesMenuLong(optionValue.get("extraPrice"), "orderOption.extraPrice")));
            }
            result.add(new CatalogOwnerApi.SalesMenuOrderOptionFact(
                    requiredSalesMenuUuid(value, "orderOption.definitionRef"),
                    requiredSalesMenuText(value, "orderOption.name"),
                    requiredSalesMenuText(value, "orderOption.selectionMode"),
                    value.path("displayOrder").asInt(0),
                    value.path("required").asBoolean(false),
                    optionalSalesMenuInteger(value.get("minSelectionCount"), "orderOption.minSelectionCount"),
                    optionalSalesMenuInteger(value.get("maxSelectionCount"), "orderOption.maxSelectionCount"),
                    optionValues));
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

private static Integer optionalSalesMenuInteger(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (!value.isIntegralNumber()) throw salesMenuResultProblem(field);
        return value.intValue();
    }

private static CatalogOwnerApi.Problem salesMenuResultProblem(String field) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, field + " catalog fact is invalid");
    }

public static void validateItemPageQuery(ObjectNode request) {
        CatalogOwnerValueSupport.validateItemPageQuery(request);
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

private static void putNullableUuid(ObjectNode target, String field, UUID value) {
        if (value == null) target.putNull(field);
        else target.put(field, value.toString());
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

private static String categoryDescendantPositionSql() {
        return "array_position(descendant.path_refs, ?::uuid) + 1";
    }

private static String categoryDepthDisabledReason(String usage) {
        if ("CATEGORY_CREATE".equals(usage)) return "商品分类最多只能建立三级";
        return "移动后分类不能超过三级";
    }

private JsonNode nullableJson(String raw, String failureMessage) {
        if (raw == null) return mapper.nullNode();
        try {
            return mapper.readTree(raw);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, failureMessage, failure);
        }
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

private long generation(String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                dataNodeRef,
                brandRef);
        return value == null ? 0 : value;
    }

private static void requireScope(String dataNodeRef, String brandRef) {
        if (dataNodeRef == null || dataNodeRef.isBlank() || brandRef == null || brandRef.isBlank())
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
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

private long now() {
        return time.currentEpochMillis();
    }

private static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys)
            if (node.path(key).isValueNode() && !node.path(key).asText().isBlank())
                return node.path(key).asText();
        return null;
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
            Map<UUID, InventoryOwnerApi.UnitSnapshot> salesUnitsByItem,
            Map<UUID, ArrayNode> orderOptionsByItem) {
        static SalesMenuFactSnapshot empty() {
            return new SalesMenuFactSnapshot(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
        }
    }

private record ItemUnitRefs(
            UUID salesUnitRef,
            InventoryOwnerApi.UnitSnapshot salesUnitSnapshot,
            UUID baseMeasureUnitRef,


            InventoryOwnerApi.UnitSnapshot baseMeasureUnitSnapshot) {}

private record PageItemRow(ItemRow item, long total) {}

private interface CatalogObject {
        String objectType();

        String code();

        String name();

        long version();
    }

}
