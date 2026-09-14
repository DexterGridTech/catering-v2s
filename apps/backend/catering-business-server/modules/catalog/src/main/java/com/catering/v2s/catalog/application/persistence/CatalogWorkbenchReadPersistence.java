package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC boundary for Catalog workbench task-read projections. */
@Repository
public class CatalogWorkbenchReadPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public CatalogWorkbenchReadPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record InventoryDisplayFactRow(
            UUID itemRef, String inventoryStatus, String inventoryMode, String consumptionUnitJson, String bomLineCount) {}

    public record InventoryTargetDisplayFactRow(
            UUID itemRef, String inventoryStatus, String inventoryMode, String consumptionUnitJson) {}

    public record SalesMenuItemRow(
            UUID itemRef,
            String itemCode,
            String itemName,
            String shapeKey,
            String status,
            Long defaultPriceCents,
            long version) {}

    public record NavigationCategoryRow(
            UUID categoryRef,
            String code,
            String name,
            UUID parentCategoryRef,
            long version,
            int displayOrder,
            long directCount,
            long count,
            long subtreeSize,
            long blockingReferenceCount,
            String blockingReferenceFactsJson) {}

    public record NavigationTagRow(UUID tagRef, String code, String name, long count) {}

    public record NavigationShapeRow(
            String shapeKey,
            long count,
            long generation,
            long externalOrderTemporaryCount,
            long inactiveCount,
            long recentlyUpdatedCount,
            long autoSyncCount,
            long uncategorizedCount) {}

    public record ProductionTagReferenceCountRow(UUID tagRef, long count) {}

    public record CategoryCandidateRow(
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

    public record CategoryCandidateQuery(
            String dataNodeRef,
            String brandRef,
            String usage,
            UUID currentCategoryRef,
            UUID parentCategoryRef,
            String keyword,
            int pageSize,
            int cursorDisplayOrder,
            String cursorName,
            String cursorCode,
            UUID cursorRef) {}

    public record ItemRow(
            UUID ref,
            String code,
            String name,
            String shortName,
            String shapeKey,
            String status,
            String sectionsJson,
            long version,
            long updatedAt,
            String sourceScopeRef) {}

    public record PageItemRow(ItemRow item, long total) {}

    public record ItemPageQuery(
            String dataNodeRef,
            String brandRef,
            String keyword,
            String smartViewKey,
            String shapeKey,
            String categoryRef,
            UUID tagRef,
            UUID productionTagRef,
            boolean uncategorized,
            boolean includeSubCategories,
            String status,
            String source,
            String candidateUsage,
            String excludeItemCode,
            long offset,
            int pageSize,
            List<String> itemCodes,
            List<UUID> itemRefs,
            long recentlyUpdatedSince) {}

    public record CategorySummaryRow(UUID itemRef, UUID categoryRef, String pathJson) {}

    public record CatalogTagFactRow(UUID itemRef, UUID tagRef, String code, String name) {}

    public record ItemUnitRefsRow(
            UUID itemRef,
            UUID salesUnitRef,
            String salesUnitCode,
            String salesUnitName,
            String salesUnitDimension,
            Integer salesUnitPrecision,
            UUID baseMeasureUnitRef,
            String baseMeasureUnitCode,
            String baseMeasureUnitName,
            String baseMeasureUnitDimension,
            Integer baseMeasureUnitPrecision) {}

    public List<InventoryDisplayFactRow> readInventoryDisplayFacts(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        List<UUID> distinctItemRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (distinctItemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(distinctItemRefs.size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef));
        args.addAll(distinctItemRefs);
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_ITEM_REF_NAME_SKU
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_LATERAL_CATALOG_SKU_SKU_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_SKU_FROM_CATALOG_CATALOG_SKU
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_CATALOG_SKU_ITEM_REF_ITEM_STATUS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_CATALOG_SKU_IS_DEFAULT_DISPLAY_ORDER_SKU_CODE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_LIMIT_SKU
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_LATERAL_CATALOG_CATEGORY_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_CATEGORY_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_CATEGORY_JOIN_CATALOG_CATALOG_CATEGOR
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATALOG_CATEGORY_CATEGORY_REF_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_CATEGORY_DATA_NODE_REF_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_CATEGORY_BRAND_REF_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_CATEGORY_STATUS_VOIDED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_RELATION_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_LIMIT_CATEGORY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_ITEM_REF
                        + placeholders
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED,
                (result, row) -> new InventoryDisplayFactRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5)),
                args.toArray());
    }

    public List<InventoryTargetDisplayFactRow> readInventoryTargetDisplayFact(
            String dataNodeRef, String brandRef, UUID itemRef, UUID productSkuRef) {
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATALOG_ITEM_ITEM_ITEM_REF_NAME_SHAPE_KEY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_SKU_SKU_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_SKU_ITEM_REF_ITEM_STATUS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_PARAMETER_PLACEHOLDER_CATALOG_SKU_PRODUCT_SKU_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_LIMIT_SKU_ITEM_DATA_NODE_REF_BRAND_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED,
                statement -> {
                    statement.setObject(1, productSkuRef);
                    statement.setObject(2, productSkuRef);
                    statement.setString(3, dataNodeRef);
                    statement.setString(4, brandRef);
                    statement.setObject(5, itemRef);
                },
                (result, row) -> new InventoryTargetDisplayFactRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4)));
    }

    public List<SalesMenuItemRow> readSalesMenuCandidateRows(
            CatalogOwnerApi.SalesMenuCandidatePageQuery query, String cursorSortKey, UUID cursorTieBreaker, int pageSize) {
        StringBuilder sql = new StringBuilder(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHAPE_KEY
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_NULLIF_SECTIONS_STANDARD_SALE_PRICE_BIGINT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_VOIDED);
        List<Object> arguments = new ArrayList<>(List.of(query.dataNodeRef(), query.brandRef()));
        if (!query.filter().isBlank()) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CODE_ILIKE_NAME);
            String filter = "%" + query.filter() + "%";
            arguments.add(filter);
            arguments.add(filter);
        }
        if (query.categoryRef() != null) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_CATEGORY_RELATION
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_CATEGORY_CATEGORY_CATEGORY_REF_RELATION
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_CATEGORY_REF
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_DATA_NODE_REF_BRAND_REF
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_STATUS_VOIDED);
            arguments.add(query.categoryRef());
        }
        if (cursorSortKey != null) {
            arguments.add(cursorSortKey);
            arguments.add(cursorSortKey);
            arguments.add(cursorTieBreaker);
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CODE_ITEM_REF);
        }
        sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_CODE_ITEM_REF);
        arguments.add(pageSize + 1);
        return jdbc.query(
                sql.toString(),
                (result, row) -> new SalesMenuItemRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, Long.class),
                        result.getLong(7)),
                arguments.toArray());
    }

    public List<SalesMenuItemRow> readSalesMenuItemRows(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        List<UUID> requestedRefs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (requestedRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(requestedRefs.size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(dataNodeRef, brandRef));
        arguments.addAll(requestedRefs);
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHAPE_KEY_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_NULLIF_SECTIONS_STANDARD_SALE_PRICE_BIGINT_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_REF
                        + placeholders
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_STATUS_VOIDED_ITEM_REF,
                (result, row) -> new SalesMenuItemRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, Long.class),
                        result.getLong(7)),
                arguments.toArray());
    }

    public List<NavigationCategoryRow> readNavigationCategories(String dataNodeRef, String brandRef) {
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CTE_VISIBLE_CATEGORIES_CATEGORY_REF_CODE_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_CATEGORY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_DATA_NODE_REF_BRAND_REF_STATUS_VOIDED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_ORDER_PATH_CATEGORY_CATEGORY_REF_LPAD
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_VISIBLE_CATEGORIES_CATEGORY_CODE_TEXT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_VISIBLE_CATEGORIES_CATEGORY_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_PARENT_CATEGORY_REF_CATEGORY_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CHILD_CATEGORY_REF_ARRAY_APPEND_PARENT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_VISIBLE_CATEGORIES_CHILD_CODE_PARENT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_VISIBLE_CATEGORIES_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_SUBTREE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_VISIBLE_CATEGORIES_CHILD_PARENT_CATEGORY_REF_SUBTREE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_RELATION_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_ITEM_ITEM_REF_DIRECT_COUNT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_RELATION_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_ITEM_ITEM_REF_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF_STATUS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_RELATION_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_ITEMS_SUBTREE_ROOT_CATEGORY_REF_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_ITEM_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_CATEGORY_SUBTREE_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATALOG_ITEM_RELATION_CATEGORY_REF_SUBTREE_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_ITEM_ITEM_REF_RELATION_DATA_NODE_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED_SUBTREE_SIZES
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_SUBTREE_CATEGORY_REF_SUBTREE_SIZE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_ROOT_CATEGORY_REF_SUBTREE_COUNTS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_ITEMS_ITEM_REF_SUBTREE_COUNT_ROOT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_STATS_ROOT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_ITEM_REF_BLOCKING_REFERENCE_COUNT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_JSONB_AGG_JSONB_BUILD_OBJECT_REFERENCE_KIND_CATALOG_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_ITEM_REF_CODE_NAME_DIRECTION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_ITEMS_BLOCKING_REFERENCE_FACTS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_ROOT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_DIRECT_COUNTS_DIRECT_COUNT_SUBTREE_COUNTS_SUBTREE_COUNT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SUBTREE_SIZES_SUBTREE_SIZE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_STATS_BLOCKING_REFERENCE_COUNT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_STATS_BLOCKING_REFERENCE_FACTS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_ORDER_ORDERED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_DIRECT_COUNTS_ORDERED_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_DIRECT_COUNTS_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SUBTREE_COUNTS_ROOT_CATEGORY_REF_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SUBTREE_SIZES_ROOT_CATEGORY_REF_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BLOCKING_STATS_ROOT_CATEGORY_REF_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_ORDERED_ORDER_PATH_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_DISPLAY_ORDER_CODE,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setString(3, dataNodeRef);
                    statement.setString(4, brandRef);
                    statement.setString(5, dataNodeRef);
                    statement.setString(6, brandRef);
                },
                (result, row) -> new NavigationCategoryRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getObject(4, UUID.class),
                        result.getLong(5),
                        result.getInt(6),
                        result.getLong(7),
                        result.getLong(8),
                        result.getLong(9),
                        result.getLong(10),
                        result.getString(11)));
    }

    public List<NavigationTagRow> readNavigationTags(String dataNodeRef, String brandRef) {
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_ENTRY_ENTRY_REF_CODE_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_DICTIONARY_ENTRY_ENTRY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_ITEM_REFERENCE_RELATION_REF_ENTRY_ENTRY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_RELATION_KIND
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_ITEM_ITEM_ITEM_REF_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_DATA_NODE_REF_ENTRY_BRAND_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_ENTRY_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ENTRY_STATUS_ENABLED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_ENTRY_ENTRY_REF_CODE_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_ENTRY_DISPLAY_ORDER_CODE_NAME,
                statement -> {
                    statement.setString(1, CatalogItemReferenceFacts.CATALOG_TAG);
                    statement.setString(2, dataNodeRef);
                    statement.setString(3, brandRef);
                },
                (result, row) -> new NavigationTagRow(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getLong(4)));
    }

    public List<NavigationShapeRow> readNavigationShapes(
            long recentlyUpdatedSince, String dataNodeRef, String brandRef) {
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_SHAPE_KEY_VERSION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_FILTER
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SECTIONS_SOURCE_SOURCE_TYPE_OWNERSHIP_SOURCE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_RNAL_ORDER_TEMPORARY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_FILTER_STATUS_DISABLED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_FILTER_UPDATED_AT_EPOCH_MILLIS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_FILTER_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SECTIONS_SOURCE_SOURCE_TYPE_OWNERSHIP_SOURCE_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SYNC_FILTER
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_ITEM_CATEGORY_RELATION_ITEM_REF_CATALOG_ITEM
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_STATUS_VOIDED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_SHAPE_KEY,
                new Object[] {recentlyUpdatedSince, dataNodeRef, brandRef},
                (result, row) -> new NavigationShapeRow(
                        result.getString(1),
                        result.getLong(2),
                        result.getLong(3),
                        result.getLong(4),
                        result.getLong(5),
                        result.getLong(6),
                        result.getLong(7),
                        result.getLong(8)));
    }

    public List<ProductionTagReferenceCountRow> readProductionTagReferenceCounts(
            String dataNodeRef, String brandRef, Collection<UUID> productionTagRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(productionTagRefs));
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(
                CatalogItemReferenceFacts.PRODUCTION_TAG, dataNodeRef, brandRef));
        arguments.addAll(refs);
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_RELATION_REF_ITEM_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_REFERENCE_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_KIND_ITEM_DATA_NODE_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_STATUS_VOIDED_RELATION
                        + placeholders
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_GROUP_BY_RELATION_REF,
                (result, row) -> new ProductionTagReferenceCountRow(
                        result.getObject(1, UUID.class), result.getLong(2)),
                arguments.toArray());
    }

    public List<CategoryCandidateRow> readCategoryCandidates(CategoryCandidateQuery query) {
        String cte = CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CTE_CATEGORY_TREE
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CATEGORY_REF_ALTERNATE_A
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_REF_PATH_REFS
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_TEXT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_NAME_PATH_JSON
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_PARENT_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_UNION_UNION_ALL
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CHILD_CATEGORY_REF_CODE_NAME
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_PARENT_PATH_REFS_CHILD_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_PARENT_PATH_JSON_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CHILD_CATEGORY_REF_TEXT_CODE
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_TREE_CHILD_PARENT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_PARENT_CATEGORY_REF_CHILD_PARENT_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_STATUS
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_ALTERNATE_A;
        StringBuilder matchingVisibility = new StringBuilder();
        List<Object> matchingVisibilityArgs = new ArrayList<>();
        if (query.keyword() == null) {
            if (query.parentCategoryRef() == null)
                matchingVisibility.append(CatalogWorkbenchReadServiceSql.CATEGORY_ROOT_PARENT_FILTER);
            else {
                matchingVisibility.append(CatalogWorkbenchReadServiceSql.CATEGORY_PARENT_FILTER);
                matchingVisibilityArgs.add(query.parentCategoryRef());
            }
        } else {
            matchingVisibility.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_TREE_MATCHED_CATEGORY_REF
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_MATCHED_PATH_REFS
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_LOWER_MATCHED_CODE_LIKE);
            String pattern = "%" + query.keyword().toLowerCase(java.util.Locale.ROOT) + "%";
            matchingVisibilityArgs.add(pattern);
            matchingVisibilityArgs.add(pattern);
        }
        StringBuilder cursorPredicate = new StringBuilder();
        List<Object> cursorArgs = new ArrayList<>();
        if (query.cursorRef() != null) {
            cursorPredicate.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_DISPLAY_ORDER_NAME
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_DISPLAY_ORDER_NAME_CODE
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ALTERNATIVE_DISPLAY_ORDER_NAME_CODE_CATEGORY_REF);
            cursorArgs.add(query.cursorDisplayOrder());
            cursorArgs.add(query.cursorDisplayOrder());
            cursorArgs.add(query.cursorName());
            cursorArgs.add(query.cursorDisplayOrder());
            cursorArgs.add(query.cursorName());
            cursorArgs.add(query.cursorCode());
            cursorArgs.add(query.cursorDisplayOrder());
            cursorArgs.add(query.cursorName());
            cursorArgs.add(query.cursorCode());
            cursorArgs.add(query.cursorRef());
        }
        String cycleBlocked = query.currentCategoryRef() == null
                ? CatalogWorkbenchReadServiceSql.CYCLE_BLOCKED_NONE
                : CatalogWorkbenchReadServiceSql.CYCLE_BLOCKED_CURRENT;
        String categoryDepthLimit = "3";
        String createDepthBlocked = CatalogWorkbenchReadServiceSql.CATEGORY_DEPTH_BLOCKED_PREFIX
                + categoryDepthLimit + CatalogWorkbenchReadServiceSql.SQL_LIST_CLOSE;
        String relativeDescendantDepth = CatalogWorkbenchReadServiceSql.DESCENDANT_DEPTH_EXPRESSION_PREFIX
                + CatalogWorkbenchReadServiceSql.CATEGORY_DESCENDANT_POSITION_SQL;
        String depthBlocked = switch (query.usage()) {
            case "CATEGORY_CREATE" -> createDepthBlocked;
            case "CATEGORY_REPARENT" -> CatalogWorkbenchReadServiceSql.CATEGORY_REPARENT_DEPTH_BLOCKED_PREFIX
                    + relativeDescendantDepth
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_1
                    + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_TREE_DESCENDANT_PATH_REFS
                    + 3 + CatalogWorkbenchReadServiceSql.SQL_LIST_CLOSE;
            default -> CatalogWorkbenchReadServiceSql.CYCLE_BLOCKED_NONE;
        };
        String sql = cte + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_VALUE_SEPARATOR_MATCHING_CATEGORY_TREE_CATEGORY_REF_CODE
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_TREE_PARENT_CATEGORY_REF_DISPLAY_ORDER
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATALOG_CATEGORY_CHILD_DATA_NODE_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CHILD_BRAND_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CHILD_PARENT_CATEGORY_REF_CATEGORY_TREE_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_TREE_PATH_JSON
                + cycleBlocked
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CYCLE_BLOCKED
                + depthBlocked
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_TREE_DEPTH_BLOCKED
                + matchingVisibility
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_MATCHING_AGGREGATE_TOTAL_PAGED
                + cursorPredicate
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_DISPLAY_ORDER_NAME_CODE_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_PAGED_TOTAL
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_PAGED_DISPLAY_ORDER_NAME_CODE;
        List<Object> args = new ArrayList<>(List.of(
                query.dataNodeRef(), query.brandRef(), query.dataNodeRef(), query.brandRef()));
        args.add(query.dataNodeRef());
        args.add(query.brandRef());
        if (query.currentCategoryRef() != null) args.add(query.currentCategoryRef());
        if ("CATEGORY_REPARENT".equals(query.usage())) {
            args.add(query.currentCategoryRef());
            args.add(query.currentCategoryRef());
        }
        args.addAll(matchingVisibilityArgs);
        args.addAll(cursorArgs);
        args.add(query.pageSize() + 1);
        return jdbc.query(
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
    }

    public List<PageItemRow> readItemPage(ItemPageQuery query) {
        StringBuilder sql = new StringBuilder(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CTE_CATEGORY_SCOPE_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_DATA_NODE_REF_BRAND_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_REF_TEXT_STATUS_VOIDED
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_UNION_CATEGORY_SCOPE_CHILD_CATEGORY_REF_PARENT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_STATUS_ALTERNATE_A
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_VALUE_SEPARATOR_FILTERED_ITEM_REF_CODE_NAME
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SECTIONS_TEXT_PREPARATION_PROFILE_VERSION
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SALES_UNIT_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SALES_UNIT_PRECISION
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BASE_MEASURE_UNIT_NAME
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_ALTERNATE_B);
        List<Object> args = new ArrayList<>();
        args.add(query.dataNodeRef());
        args.add(query.brandRef());
        args.add(query.categoryRef());
        args.add(query.dataNodeRef());
        args.add(query.brandRef());
        args.add(query.includeSubCategories());
        args.add(query.dataNodeRef());
        args.add(query.brandRef());
        if (!query.itemCodes().isEmpty()) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CODE)
                    .append(String.join(
                            CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                            Collections.nCopies(query.itemCodes().size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER)))
                    .append(CatalogWorkbenchReadServiceSql.SQL_LIST_CLOSE);
            args.addAll(query.itemCodes());
        }
        if (!query.itemRefs().isEmpty()) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ITEM_REF_ALTERNATE_A)
                    .append(String.join(
                            CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                            Collections.nCopies(query.itemRefs().size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER)))
                    .append(CatalogWorkbenchReadServiceSql.SQL_LIST_CLOSE);
            args.addAll(query.itemRefs());
        }
        if (query.keyword() == null || query.keyword().isBlank()) sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_TEXT);
        else sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_NAME_CHR_SHORT_NAME_CODE);
        args.add(query.keyword() == null || query.keyword().isBlank() ? null : query.keyword());
        sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_VOIDED_ALTERNATE_A);
        if (query.status() != null && !query.status().isBlank()) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS);
            args.add(query.status());
        }
        if (query.shapeKey() != null && !query.shapeKey().isBlank()) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SHAPE_KEY);
            args.add(query.shapeKey());
        }
        if (query.categoryRef() == null || query.categoryRef().isBlank()) sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_TEXT_ALTERNATE_A);
        else sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_SCOPE_RELATION + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_REF_RELATION_ITEM_REF);
        if (query.categoryRef() == null || query.categoryRef().isBlank()) args.add(null);
        if (query.tagRef() != null) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_REFERENCE_RELATION + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_KIND_REF);
            args.add(CatalogItemReferenceFacts.CATALOG_TAG);
            args.add(query.tagRef());
        }
        if (query.productionTagRef() != null) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_REFERENCE_RELATION_ALTERNATE_A + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_ITEM_REF_KIND_REF_ALTERNATE_A);
            args.add(CatalogItemReferenceFacts.PRODUCTION_TAG);
            args.add(query.productionTagRef());
        }
        if (query.uncategorized())
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATALOG_ITEM_CATEGORY_RELATION_ALTERNATE_A + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_RELATION_ITEM_REF);
        if (query.smartViewKey() != null && !query.smartViewKey().isBlank()) {
            switch (query.smartViewKey()) {
                case "ALL" -> {}
                case "EXTERNAL_ORDER_TEMP" -> sql.append(CatalogWorkbenchReadServiceSql.SMART_VIEW_EXTERNAL_ORDER_TEMP);
                case "INACTIVE" -> sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_DISABLED);
                case "RECENTLY_UPDATED" -> sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_UPDATED_AT_EPOCH_MILLIS)
                        .append(CatalogWorkbenchReadServiceSql.SQL_SPACE);
                case "AUTO_SYNC" -> sql.append(CatalogWorkbenchReadServiceSql.SMART_VIEW_AUTO_SYNC);
                default -> throw new IllegalArgumentException("smartViewKey is not supported");
            }
            if ("RECENTLY_UPDATED".equals(query.smartViewKey())) args.add(query.recentlyUpdatedSince());
        }
        if (query.source() != null && !query.source().isBlank()) {
            switch (query.source()) {
                case "SELF_MANAGED" -> sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SOURCE_SCOPE_REF);
                case "COPIED" -> sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SOURCE_SCOPE_REF_ALTERNATE_A);
                case "AUTO_SYNC" -> sql.append(CatalogWorkbenchReadServiceSql.SMART_VIEW_AUTO_SYNC);
                case "TEMPORARY" -> sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_SECTIONS_SOURCE_SOURCE_TYPE_OWNERSHIP_SOURCE
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_TEMPORARY_EXTERNAL_ORDER_TEMPORARY);
                default -> throw new IllegalArgumentException("source is not supported");
            }
        }
        if ("COMPOSITE_COMPONENT".equals(query.candidateUsage())) {
            sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_CODE);
            args.add(query.excludeItemCode());
        }
        sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_FILTERED_AGGREGATE_TOTAL_PAGED_ITEM_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SHORT_NAME_SHAPE_KEY_STATUS_SECTIONS
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SOURCE_SCOPE_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SALES_UNIT_PRECISION_ALTERNATE_A
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_FILTERED
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ORDER_BY_CODE_ITEM_REF_ALTERNATE_A
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_NAME_SHORT_NAME_SHAPE_KEY_STATUS
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_OPEN_PAREN_SECTIONS_JSONB_BUILD_OBJECT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_PREPARATION_PROFILE
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SALES_UNIT_REF_ALTERNATE_A
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_SALES_UNIT_SNAPSHOT_SALES_UNIT_REF_JSONB_BUILD_OBJECT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_UNIT_REF_SALES_UNIT_REF_CODE_SALES_UNIT_CODE
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_UNIT_DIMENSION
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BASE_MEASURE_UNIT_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BASE_MEASURE_UNIT_SNAPSHOT_BASE_MEASURE_UNIT_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_ELSE_JSONB_BUILD_OBJECT
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_UNIT_REF
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_UNIT_DIMENSION_ALTERNATE_A
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_TEXT_VERSION
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_PAGED_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF_TOTAL
                + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CODE);
        args.add(query.offset());
        args.add(query.pageSize() + 1);
        return jdbc.query(
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
    }

    public List<CategorySummaryRow> readCategorySummary(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(refs);
        args.add(dataNodeRef);
        args.add(brandRef);
        args.add(dataNodeRef);
        args.add(brandRef);
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CTE_SELECTED_ITEM_REF_CATEGORY_REF_RELATION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_RELATION_CATEGORY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_RELATION_ITEM_REF
                        + placeholders + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_CATEGORY_DATA_NODE_REF_BRAND_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_CATEGORY_STATUS_VOIDED_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_PATHS_LEAF_REF_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_JSONB_BUILD_ARRAY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CODE_CATEGORY_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_CATEGORY
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_SELECTED
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_UNION_PATHS_LEAF_REF_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_PARENT
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CODE_PARENT_NAME_PATHS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATEGORY_PATHS_PATHS
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_JOIN_CATALOG_CATEGORY_PARENT_DATA_NODE_REF_BRAND_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_PARENT_CATEGORY_REF_PATHS_PARENT_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_SELECTED_ITEM_REF_CATEGORY_REF_PATHS_PATH_NODES
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CATEGORY_PATHS_PATHS_LEAF_REF_SELECTED_CATEGORY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_PATHS_PARENT_CATEGORY_REF,
                (result, row) -> new CategorySummaryRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getString(3)),
                args.toArray());
    }

    public List<CatalogTagFactRow> readCatalogTagFacts(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef, CatalogItemReferenceFacts.CATALOG_TAG));
        args.addAll(refs);
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_RELATION_ITEM_REF_ENTRY_ENTRY_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_REFERENCE_RELATION_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_DICTIONARY_ENTRY_ENTRY_ENTRY_REF_RELATION_REF
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONDITION_ENTRY_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_WHERE_RELATION_KIND_ITEM_REF
                        + placeholders
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_RELATION_ITEM_REF_ENTRY_DISPLAY_ORDER
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_RELATION_REF,
                (result, row) -> new CatalogTagFactRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getString(3),
                        result.getString(4)),
                args.toArray());
    }

    public Map<UUID, ItemUnitRefsRow> readItemUnitRefs(Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogWorkbenchReadServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogWorkbenchReadServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_ITEM_REF_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_CISION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_BASE_MEASURE_UNIT_REF_ALTERNATE_A
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CONTINUATION_MENSION_BASE_MEASURE_UNIT_PRECISION
                        + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF
                        + placeholders + CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_ALTERNATE_B,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                result -> {
                    Map<UUID, ItemUnitRefsRow> resultRows = new java.util.LinkedHashMap<>();
                    while (result.next())
                        resultRows.put(result.getObject(1, UUID.class), new ItemUnitRefsRow(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getString(4),
                                result.getString(5),
                                result.getObject(6, Integer.class),
                                result.getObject(7, UUID.class),
                                result.getString(8),
                                result.getString(9),
                                result.getString(10),
                                result.getObject(11, Integer.class)));
                    return resultRows;
                });
    }

    public long generation(String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(
                CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF, Long.class, dataNodeRef, brandRef);
        return value == null ? 0L : value;
    }
}
