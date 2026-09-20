package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.sql.ResultSet;
import java.sql.SQLException;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for catalog copy facts. */
@Repository
public class CatalogCopyPersistence {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    @Autowired
    public CatalogCopyPersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public record CategoryCopyRow(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            String code,
            String name,
            String parentCode,
            UUID targetParentRef,
            String status,
            int displayOrder,
            long version) {}

    public record DictionaryCopyRow(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID targetParentRef,
            int displayOrder,
            long version) {}

    public record ItemCopyRow(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            String code,
            String name,
            String shortName,
            String shapeKey,
            String status,
            String sectionsJson,
            String sourceCode,
            String sourceScopeRef) {}

    public record UnitCopyRow(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            String code,
            String name,
            String unitDimension,
            int precision,
            String status) {}

    public record ItemUnitSnapshotRow(
            UUID salesUnitRef,
            String salesUnitCode,
            String salesUnitName,
            String salesUnitDimension,
            Integer salesUnitPrecision,
            UUID baseMeasureUnitRef,
            String baseMeasureUnitCode,
            String baseMeasureUnitName,
            String baseMeasureUnitDimension,
            Integer baseMeasureUnitPrecision,
            UUID itemRef) {}

    public record SkuUnitFactRow(
            UUID salesUnitRef,
            String salesUnitCode,
            String salesUnitName,
            String salesUnitDimension,
            Integer salesUnitPrecision,
            UUID baseMeasureUnitRef,
            String baseMeasureUnitCode,
            String baseMeasureUnitName,
            String baseMeasureUnitDimension,
            Integer baseMeasureUnitPrecision,
            long updatedAt,
            UUID skuRef) {}

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

    public record CopyPageRow(ItemRow item, long total) {}

    public record CategoryRow(
            UUID ref,
            String code,
            String name,
            String parentCode,
            UUID parentCategoryRef,
            String status,
            long version,
            int displayOrder) {}

    public record DictionaryRow(
            UUID ref,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            int displayOrder,
            long version) {}

    public record UnitRow(
            UUID ref,
            String code,
            String name,
            String unitDimension,
            int precision,
            String status,
            long version) {}

    public record SkuInboundReferenceRow(
            UUID componentRef, UUID ownerItemRef, String ownerCode, String ownerName) {}

    public record ReceiptRow(String operationId, String requestHash, String responseJson) {}

    public record CopyFactPresenceRow(
            boolean skus,
            boolean categories,
            boolean composites,
            boolean attributes,
            boolean orderOptions,
            boolean axes,
            boolean images,
            boolean references) {}

    public record UnitSnapshotRow(
            UUID ref, String code, String name, String unitDimension, int precision) {}

    public record ItemUnitRefsRow(
            UUID itemRef, UnitSnapshotRow salesUnit, UnitSnapshotRow baseMeasureUnit) {}

    public record DictionaryVersionRow(String dictionaryKind, String code, long version) {}

    public record TargetCategoryRow(String code, UUID categoryRef, String status, long version) {}

    public record TargetDictionaryRow(
            String dictionaryKind, String code, UUID entryRef, String status, long version) {}

    public int[] insertCategories(List<CategoryCopyRow> rows) {
        if (rows.isEmpty()) return new int[0];
        return jdbc.batchUpdate(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_INSERT_INTO_CATALOG_CATEGORY_INSERT_INTO_CATALOG_CATALOG_
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_CATEGORY_REF_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_STATUS_DISPLAY_ORDER_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_DISPLAY_ORDER_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VALUES
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_WHERE_STATUS_VOIDED,
                rows.stream()
                        .map(row -> new Object[] {
                            row.targetRef(),
                            row.dataNodeRef(),
                            row.brandRef(),
                            row.code(),
                            row.name(),
                            row.parentCode(),
                            row.targetParentRef(),
                            row.status(),
                            row.displayOrder(),
                            row.version(),
                            time.currentEpochMillis(),
                            time.currentEpochMillis()
                        })
                        .toList());
    }

    public int[] insertDictionaries(List<DictionaryCopyRow> rows) {
        if (rows.isEmpty()) return new int[0];
        return jdbc.batchUpdate(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_INSERT_INTO_DICTIONARY_ENTRY_INSERT_INTO_CATALOG_DICTIONA
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ENTRY_REF_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE_NAME_STATUS_PARENT_ENTRY_REF_CODE_NAME_STATUS_PARENT_ENTRY_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VALUE_SEPARATOR_DISPLAY_ORDER
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_ON_CONFLICT
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ON_CONFLICT_NOTHING,
                rows.stream()
                        .map(row -> new Object[] {
                            row.targetRef(),
                            row.dataNodeRef(),
                            row.brandRef(),
                            row.dictionaryKind(),
                            row.code(),
                            row.name(),
                            row.status(),
                            row.targetParentRef(),
                            row.displayOrder(),
                            row.version(),
                            time.currentEpochMillis(),
                            time.currentEpochMillis()
                        })
                        .toList());
    }

    public int[] insertItems(List<ItemCopyRow> rows) {
        if (rows.isEmpty()) return new int[0];
        return jdbc.batchUpdate(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_INSERT_INTO_CATALOG_ITEM_ITEM_REF_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SHORT_NAME_SHAPE_KEY_STATUS_SECTIONS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SOURCE_SCOPE_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VALUES_ALTERNATE_A
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_CAST_AS_JSONB_1_ON
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONFLICT_DO_NOTHING,
                rows.stream()
                        .map(row -> new Object[] {
                            row.targetRef(),
                            row.dataNodeRef(),
                            row.brandRef(),
                            row.code(),
                            row.name(),
                            row.shortName(),
                            row.shapeKey(),
                            row.status(),
                            row.sectionsJson(),
                            row.sourceCode(),
                            row.sourceScopeRef(),
                            time.currentEpochMillis(),
                            time.currentEpochMillis()
                        })
                        .toList());
    }

    public int updateCopiedItem(
            String name,
            String shortName,
            String sectionsJson,
            String scope,
            String brand,
            String code,
            long expectedVersion,
            long updatedAt) {
        return jdbc.update(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_UPDATE_CATALOG_ITEM_NAME_SHORT_NAME_SECTIONS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_BRAND_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_CODE_VERSION,
                name,
                shortName,
                sectionsJson,
                updatedAt,
                scope,
                brand,
                code,
                expectedVersion);
    }

    public List<CopyPageRow> loadCopyCandidates(
            String sourceDataNodeRef,
            String brandRef,
            String keyword,
            String cursorSortKey,
            UUID cursorTieBreaker,
            int pageSize) {
        String cursorPredicate = cursorSortKey == null ? "" : CatalogCopyServiceSql.CATALOG_COPY_SERVICE_WHERE_CODE_ITEM_REF;
        String sql = CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CTE_MATCHING_ITEM_REF_CODE_NAME
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_STATUS
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_TEXT_NAME_CHR_SHORT_NAME
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_MATCHING_ILIKE_AGGREGATE_TOTAL_PAGED
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OPEN_PAREN_ITEM_REF_CODE_NAME_SHORT_NAME
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_UPDATE_MATCHING_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF
                + cursorPredicate
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ORDER_BY_CODE_ITEM_REF
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_AGGREGATE_VERSION_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF_TOTAL
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_PAGED
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CODE_ITEM_REF;
        List<Object> arguments = new ArrayList<>();
        arguments.add(sourceDataNodeRef);
        arguments.add(brandRef);
        arguments.add(keyword);
        arguments.add(keyword);
        if (cursorSortKey != null) {
            arguments.add(cursorSortKey);
            arguments.add(cursorSortKey);
            arguments.add(cursorTieBreaker);
        }
        arguments.add(pageSize + 1);
        return jdbc.query(
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
    }

    public void insertItemUnitSnapshots(List<ItemUnitSnapshotRow> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_UPDATE_CATALOG_CATALOG_ITEM_SET_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION_WHERE_BASE_MEASURE_UNIT_PRECISION_WHERE_ITEM_REF,
                rows.stream()
                        .map(row -> new Object[] {
                            row.salesUnitRef(),
                            row.salesUnitCode(),
                            row.salesUnitName(),
                            row.salesUnitDimension(),
                            row.salesUnitPrecision(),
                            row.baseMeasureUnitRef(),
                            row.baseMeasureUnitCode(),
                            row.baseMeasureUnitName(),
                            row.baseMeasureUnitDimension(),
                            row.baseMeasureUnitPrecision(),
                            row.itemRef()
                        })
                        .toList());
    }

    public void insertSkuUnitFacts(List<SkuUnitFactRow> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_UPDATE_CATALOG_SKU_UPDATE_CATALOG_CATALOG_SKU_S
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_BASE_MEASURE_UNIT_REF_ALTERNATE_A
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VALUE_SEPARATOR_UPDATED_AT_EPOCH_MILLIS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_WHERE_PRODUCT_SKU_REF,
                rows.stream()
                        .map(row -> new Object[] {
                            row.salesUnitRef(),
                            row.salesUnitCode(),
                            row.salesUnitName(),
                            row.salesUnitDimension(),
                            row.salesUnitPrecision(),
                            row.baseMeasureUnitRef(),
                            row.baseMeasureUnitCode(),
                            row.baseMeasureUnitName(),
                            row.baseMeasureUnitDimension(),
                            row.baseMeasureUnitPrecision(),
                            row.updatedAt(),
                            row.skuRef()
                        })
                        .toList());
    }

    public int[] insertUnitDefinitions(List<UnitCopyRow> rows) {
        if (rows.isEmpty()) return new int[0];
        return jdbc.batchUpdate(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_INSERT_INTO_UNIT_DEFINITION_UNIT_REF_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VALUE_SEPARATOR_STATUS_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VALUES_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_WHERE_STATUS_VOIDED_ALTERNATE_A,
                rows.stream()
                        .map(row -> new Object[] {
                            row.targetRef(),
                            row.dataNodeRef(),
                            row.brandRef(),
                            row.code(),
                            row.name(),
                            row.unitDimension(),
                            row.precision(),
                            row.status(),
                            time.currentEpochMillis(),
                            time.currentEpochMillis()
                        })
                        .toList());
    }

    public Map<UUID, List<SkuInboundReferenceRow>> readSkuInboundReferences(
            String dataNodeRef, String brandRef, Set<UUID> skuRefs) {
        List<UUID> orderedRefs = new ArrayList<>(skuRefs);
        if (orderedRefs.isEmpty()) return Map.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_COMPONENT_PRODUCT_SKU_REF_COMPOSITE_COMPONENT_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OWNER_ITEM_ITEM_REF_CODE_NAME
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_COMPOSITE_GROUP_CATALOG_COMPOSITE_COMPONENT_COMPONENT
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_GROUP_ROW
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_SKU_OWNER_ITEM_ITEM_REF_GROUP_ROW_TARGET_SKU
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_TARGET_SKU_PRODUCT_SKU_REF_COMPONENT_OWNER_ITEM
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OWNER_ITEM_BRAND_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_OWNER_ITEM_STATUS_VOIDED_COMPONENT
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_OWNER_ITEM_ITEM_REF_TARGET_SKU
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_COMPONENT_PRODUCT_SKU_REF_OWNER_ITEM_CODE,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, List<SkuInboundReferenceRow>> referencesBySku = new LinkedHashMap<>();
                    while (result.next()) {
                        UUID skuRef = result.getObject(1, UUID.class);
                        referencesBySku
                                .computeIfAbsent(skuRef, ignored -> new ArrayList<>())
                                .add(new SkuInboundReferenceRow(
                                        result.getObject(2, UUID.class),
                                        result.getObject(3, UUID.class),
                                        result.getString(4),
                                        result.getString(5)));
                    }
                    return referencesBySku;
                });
    }

    public Map<UUID, UUID> readEffectiveCategoryParents(String scope, String brand) {
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF_DATA_NODE_REF + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_BRAND_REF_STATUS_VOIDED,
                result -> {
                    Map<UUID, UUID> parents = new LinkedHashMap<>();
                    while (result.next()) parents.put(result.getObject(1, UUID.class), result.getObject(2, UUID.class));
                    return parents;
                },
                scope,
                brand);
    }

    public Map<String, String> readProductionReferences(String scope, String brand, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(itemRefs.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(itemRefs);
        Map<String, String> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_ITEM_ITEM_REF_CODE_DATA_NODE_REF_BRAND_REF
                        + placeholders
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_STATUS_VOIDED,
                args.toArray(),
                rows -> {
                    while (rows.next()) result.put(rows.getObject(1, UUID.class).toString(), rows.getString(2));
                });
        return result;
    }

    public List<ItemRow> readItemIdentityRows(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(codes);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME_ALTERNATE_A
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE
                        + placeholders
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CODE,
                (result, row) -> itemRow(result),
                args.toArray());
    }

    public List<ItemRow> readAllItemIdentityRows(String dataNodeRef, String brandRef) {
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHORT_NAME
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_SOURCE_SCOPE_REF_DATA_NODE_REF_BRAND_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_STATUS_VOIDED_CODE,
                (result, row) -> itemRow(result),
                dataNodeRef,
                brandRef);
    }

    public CopyFactPresenceRow readCopyFactPresence(Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return new CopyFactPresenceRow(false, false, false, false, false, false, false, false);
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        String sql = CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_ALTERNATE_A
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_SKU_ITEM_REF + placeholders
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_STATUS_VOIDED_ALTERNATE_A
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_CATEGORY_ITEM_REF + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_COMPOSITE_GROUP_ITEM_REF + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_A
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_REF + placeholders
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_B
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_ITEM_REF + placeholders
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_C
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_SKU_VARIANT_AXIS_ITEM_REF + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_D
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_IMAGE_ITEM_REF + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_E
                + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATALOG_ITEM_REFERENCE_ITEM_REF + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_F;
        List<Object> args = new ArrayList<>();
        for (int index = 0; index < 8; index++) args.addAll(refs);
        return jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.size(); index++) statement.setObject(index + 1, args.get(index));
                },
                result -> {
                    if (!result.next())
                        return new CopyFactPresenceRow(false, false, false, false, false, false, false, false);
                    return new CopyFactPresenceRow(
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

    public Map<UUID, ItemUnitRefsRow> readItemUnitRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_ITEM_REF_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF
                        + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_ALTERNATE_G,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                result -> {
                    Map<UUID, ItemUnitRefsRow> rows = new LinkedHashMap<>();
                    while (result.next())
                        rows.put(
                                result.getObject(1, UUID.class),
                                new ItemUnitRefsRow(
                                        result.getObject(1, UUID.class),
                                        unitSnapshot(result, 2, 3, 4, 5, 6),
                                        unitSnapshot(result, 7, 8, 9, 10, 11)));
                    return rows;
                });
    }

    public List<DictionaryRow> readDictionaries(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CTE_SELECTED
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ENTRY_REF_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE_NAME_STATUS_PARENT_ENTRY_REF_DISPLAY_ORDER_VERSION_AND_BRAND_REF_AND_STATUS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_VOIDED_ENTRY_REF
                        + placeholders
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_UNION_SELECT
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_PARENT_ENTRY_REF_PARENT_DATA_NODE_REF_PARENT_BRAND_REF_PARENT_DICTIONARY_KIND_PARENT_CODE_PARENT_DISPLAY_ORDER_PARENT_VERSION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_FROM_CLAUSE_SELECTED_PARENT_CHILD
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_PARENT_ENTRY_REF_CHILD_PARENT_ENTRY_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_PARENT_BRAND_REF_CHILD_STATUS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_ENTRY_REF_DICTIONARY_KIND_CODE_NAME
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_SELECTED_DICTIONARY_KIND_CODE,
                (result, row) -> new DictionaryRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, UUID.class),
                        result.getInt(7),
                        result.getLong(8)),
                args.toArray());
    }

    public long maxTargetItemVersion(String target, String brand, List<String> codes) {
        if (codes.isEmpty()) return 0L;
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        Long value = jdbc.queryForObject(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF_ALTERNATE_B
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CODE
                        + placeholders
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_STATUS_VOIDED_ALTERNATE_B,
                Long.class,
                args.toArray());
        return value == null ? 0L : value;
    }

    public Map<String, Long> targetCategoryVersions(String target, String brand, List<String> codes) {
        if (codes.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_CATEGORY_CODE_VERSION_DATA_NODE_REF_BRAND_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_CODE
                        + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_CODE,
                result -> {
                    Map<String, Long> versions = new LinkedHashMap<>();
                    while (result.next()) versions.put(result.getString(1), result.getLong(2));
                    return versions;
                },
                args.toArray());
    }

    public Map<String, Long> targetUnitVersions(String target, String brand, List<String> codes) {
        if (codes.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_UNIT_DEFINITION_CODE_VERSION_DATA_NODE_REF_BRAND_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_CODE_ALTERNATE_A
                        + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_CODE_ALTERNATE_A,
                result -> {
                    Map<String, Long> versions = new LinkedHashMap<>();
                    while (result.next()) versions.put(result.getString(1), result.getLong(2));
                    return versions;
                },
                args.toArray());
    }

    public Map<DictionaryVersionKey, Long> targetDictionaryVersions(
            String target, String brand, List<DictionaryVersionKey> keys) {
        if (keys.isEmpty()) return Map.of();
        String predicates = String.join(
                CatalogCopyServiceSql.SQL_OR_JOINER,
                Collections.nCopies(keys.size(), CatalogCopyServiceSql.DICTIONARY_KEY_PREDICATE));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        for (DictionaryVersionKey key : keys) {
            args.add(key.dictionaryKind());
            args.add(key.code());
        }
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_DICTIONARY_ENTRY_DICTIONARY_KIND_CODE_VERSION_DATA_NODE_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_BRAND_REF_ALTERNATE_A + predicates + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_DICTIONARY_KIND_CODE,
                result -> {
                    Map<DictionaryVersionKey, Long> versions = new LinkedHashMap<>();
                    while (result.next())
                        versions.put(
                                new DictionaryVersionKey(result.getString(1), result.getString(2)),
                                result.getLong(3));
                    return versions;
                },
                args.toArray());
    }

    public List<TargetCategoryRow> targetCategoryFacts(String target, String brand, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_CATEGORY_CODE_CATEGORY_REF_STATUS_VERSION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_BRAND_REF_CODE
                        + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_CODE_CATEGORY_REF,
                (result, row) -> new TargetCategoryRow(
                        result.getString(1),
                        result.getObject(2, UUID.class),
                        result.getString(3),
                        result.getLong(4)),
                args.toArray());
    }

    public List<TargetDictionaryRow> targetDictionaryFacts(
            String target, String brand, List<DictionaryVersionKey> keys) {
        if (keys.isEmpty()) return List.of();
        String predicates = String.join(
                CatalogCopyServiceSql.SQL_OR_JOINER,
                Collections.nCopies(keys.size(), CatalogCopyServiceSql.DICTIONARY_KEY_PREDICATE));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        for (DictionaryVersionKey key : keys) {
            args.add(key.dictionaryKind());
            args.add(key.code());
        }
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_DICTIONARY_ENTRY_DICTIONARY_KIND_CODE_ENTRY_REF_STATUS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_DATA_NODE_REF_BRAND_REF + predicates + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_DICTIONARY_KIND_CODE_ENTRY_REF,
                (result, row) -> new TargetDictionaryRow(
                        result.getString(1),
                        result.getString(2),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        result.getLong(5)),
                args.toArray());
    }

    public List<UnitRow> targetUnitsByCode(String target, String brand, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        args.addAll(codes);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION_ALTERNATE_A
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CODE
                        + placeholders + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_CODE_UNIT_REF_ALTERNATE_A,
                (result, row) -> new UnitRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getInt(5),
                        result.getString(6),
                        result.getLong(7)),
                args.toArray());
    }

    public void lockProductSkuRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .forEach(ref -> AdvisoryLock.acquire(jdbc, 0x43534B55, ref));
    }

    public void lockCategoryHierarchy(String scope, String brand) {
        AdvisoryLock.acquire(jdbc, "catalog-category-hierarchy", scope, brand);
    }

    public record DictionaryVersionKey(String dictionaryKind, String code) {}

    public List<CategoryRow> readCategories(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        args.add(scope);
        args.add(brand);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CTE_CATALOG_CATEGORY_SELECTED_CATEGORY_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF
                        + placeholders
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CATEGORY_PARENT_CATEGORY_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECTED_CATALOG_CATEGORY_CATEGORY_CHILD
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATEGORY_CATEGORY_REF_CHILD_PARENT_CATEGORY_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_CATEGORY_DATA_NODE_REF_BRAND_REF_STATUS
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_ALTERNATE_B
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATEGORY_CATEGORY_REF_CATEGORY_CODE_CATEGORY_NAME_CATEGORY_PARENT_CODE_CATEGORY_PARENT_CATEGORY_REF_VERSION_CATEGORY_DISPLAY_ORDER_FROM
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECTED_CATALOG_CATEGORY_CATEGORY
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_SELECTED_CATEGORY_REF_CATEGORY_PARENT_CATEGORY_REF
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CATEGORY_DISPLAY_ORDER_CODE,
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
    }

    public List<UnitRow> readUnits(String scope, String brand, Set<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCopyServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCopyServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_UNIT_DEFINITION_UNIT_REF_CODE_NAME_DIMENSION
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_UNIT_REF
                        + placeholders
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CLOSE_PAREN_CODE_UNIT_REF,
                (result, row) -> new UnitRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getInt(5),
                        result.getString(6),
                        result.getLong(7)),
                args.toArray());
    }

    public void lockReceipt(String scope, String key) {
        AdvisoryLock.acquire(jdbc, "catalog-receipt", scope, key);
    }

    public List<ReceiptRow> readReceipt(String scope, String key) {
        return jdbc.query(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_IDEMPOTENCY_KEY,
                (result, row) -> new ReceiptRow(result.getString(1), result.getString(2), result.getString(3)),
                scope,
                key);
    }

    public int saveReceipt(
            String scope, String key, String operationId, String requestHash, String responseJson, long createdAt) {
        return jdbc.update(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_INSERT_INTO
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY
                        + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB_VALUES_CAST_AS_JSONB,
                UUID.randomUUID(),
                scope,
                key,
                operationId,
                requestHash,
                responseJson,
                createdAt);
    }

    public long generation(String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF, Long.class, dataNodeRef, brandRef);
        return value == null ? 0 : value;
    }

    public long targetItemVersion(String target, String brand, String targetCode) {
        Long value = jdbc.queryForObject(
                CatalogCopyServiceSql.CATALOG_COPY_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF_ALTERNATE_A + CatalogCopyServiceSql.CATALOG_COPY_SERVICE_CONDITION_CODE_STATUS_VOIDED,
                Long.class,
                target,
                brand,
                targetCode);
        return value == null ? 0L : value;
    }

    private static UnitSnapshotRow unitSnapshot(
            ResultSet result, int refIndex, int codeIndex, int nameIndex, int dimensionIndex, int precisionIndex)
            throws SQLException {
        UUID ref = result.getObject(refIndex, UUID.class);
        return ref == null
                ? null
                : new UnitSnapshotRow(
                        ref,
                        result.getString(codeIndex),
                        result.getString(nameIndex),
                        result.getString(dimensionIndex),
                        result.getInt(precisionIndex));
    }

    private static ItemRow itemRow(ResultSet result) throws SQLException {
        return new ItemRow(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getLong(8),
                result.getLong(9),
                result.getString(10));
    }
}
