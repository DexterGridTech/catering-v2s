package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

/** Typed JDBC execution boundary for catalog item facts and item-owned reads. */
@Repository
public class CatalogItemPersistence {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    @Autowired
    public CatalogItemPersistence(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public CatalogItemPersistence(JdbcTemplate jdbc) {
        this(jdbc, new ObjectMapper());
    }

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

    public record BatchStatusCandidateRow(ItemRow item, String dataNodeRef, String brandRef) {}

    public record SkuCandidateRow(
            ObjectNode value,
            int displayOrder,
            String skuCode,
            UUID productSkuRef,
            long total,
            JsonNode itemPreparationProfile,
            JsonNode skuPreparationOverride,
            UUID productionTagRef,
            boolean itemExists) {}

    public record SkuCandidatePage(List<SkuCandidateRow> rows, long total, boolean itemExists) {}

    public record InboundItemReferenceRow(UUID itemRef, String code, String name) {}

    public record SkuInboundReferenceRow(UUID componentRef, UUID ownerItemRef, String ownerCode, String ownerName) {}

    public record DetailInboundFactsRow(
            Map<UUID, List<SkuInboundReferenceRow>> bySku, List<InboundItemReferenceRow> byItem, long generation) {}

    public record CategoryRow(
            UUID ref,
            String code,
            String name,
            String parentCode,
            UUID parentCategoryRef,
            String status,
            long version,
            int displayOrder) {}

    public record TransitionItemPrecheckRow(ItemRow item, boolean hasIdentifiers) {}

    public record CopyFactPresenceRow(
            boolean skus,
            boolean categories,
            boolean composites,
            boolean attributes,
            boolean orderOptions,
            boolean axes,
            boolean images,
            boolean references) {}

    public record SaveFactPresenceRow(
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

    public record UnitFactValues(
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
            UUID productSkuRef) {}

    public record DictionaryReference(String kind, UUID ref) {}

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

    public record ReceiptRow(String operationId, String requestHash, String responseJson) {}

    public record SkuReferenceOwnerRow(UUID skuRef, UUID itemRef, String itemStatus, String skuStatus) {}

    public record CategorySummaryRow(UUID itemRef, UUID categoryRef, String pathJson) {}

    public boolean itemExists(String dataNodeRef, String brandRef, String itemCode) {
        Integer count = jdbc.queryForObject(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE_STATUS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VOIDED,
                Integer.class,
                dataNodeRef,
                brandRef,
                itemCode);
        return count != null && count > 0;
    }

    public boolean hasIdentifiers(UUID itemRef) {
        Boolean value = jdbc.queryForObject(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_PRODUCT_IDENTIFIER_ITEM_REF, Boolean.class, itemRef);
        return Boolean.TRUE.equals(value);
    }

    public List<Long> transitionBatchItem(
            String target, long updatedAt, UUID itemRef, String dataNodeRef, String brandRef, long expectedVersion) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_ITEM_REF_DATA_NODE_REF_BRAND_REF_VERSION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_RETURNING_VERSION,
                (result, row) -> result.getLong(1),
                target,
                updatedAt,
                itemRef,
                dataNodeRef,
                brandRef,
                expectedVersion);
    }

    public List<BatchStatusCandidateRow> readBatchStatusCandidates(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs, boolean scopedOnly) {
        List<UUID> refs = new ArrayList<>(itemRefs);
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        String scopePredicate = scopedOnly ? CatalogItemServiceSql.BATCH_STATUS_SCOPE_PREDICATE : "";
        List<Object> arguments = new ArrayList<>();
        if (scopedOnly) {
            arguments.add(dataNodeRef);
            arguments.add(brandRef);
        }
        arguments.addAll(refs);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ITEM_REF_CODE_NAME_SHORT_NAME
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_ITEM_SOURCE_SCOPE_REF_DATA_NODE_REF_BRAND_REF
                        + scopePredicate
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_B,
                (result, row) ->
                        new BatchStatusCandidateRow(itemRow(result, 1), result.getString(11), result.getString(12)),
                arguments.toArray());
    }

    public List<ItemRow> lockBatchStatusItem(UUID itemRef, String dataNodeRef, String brandRef) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_LOCK_FOR_UPDATE,
                (result, row) -> itemRow(result, 1),
                dataNodeRef,
                brandRef,
                itemRef);
    }

    public List<SkuCandidateRow> readSkuCandidates(
            String dataNodeRef,
            String brandRef,
            String itemCode,
            String candidateUsage,
            int pageSize,
            Integer cursorDisplayOrder,
            String cursorCode,
            UUID cursorRef) {
        String skuStatusPredicate = "COMPOSITE_COMPONENT".equals(candidateUsage)
                ? CatalogItemServiceSql.SKU_STATUS_ENABLED_PREDICATE
                : CatalogItemServiceSql.SKU_STATUS_NOT_VOIDED_PREDICATE;
        StringBuilder sql =
                new StringBuilder(CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CTE_ITEM_SCOPE_ITEM_REF_PREPARATION_PROFILE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_MATCHING_SKU_PRODUCT_SKU_REF_SKU_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU_STANDARD_SALE_PRICE
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SKU_SALES_UNIT_OVERRIDE_REF_SALES_UNIT_REF_SALES_UNIT_CODE
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SKU_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_BASE_UNIT_STATUS_ENABLED_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_PRIMARY_MEDIA_ASSET_REF_ATTRIBUTES_ATTRIBUTE_VALUES
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_PREPARATION_PROFILE_TEXT_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_ITEM_SCOPE_SKU_ITEM
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UNIT_DEFINITION_SALES_UNIT_UNIT_REF_SKU_SALES_UNIT_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UNIT_DEFINITION_BASE_UNIT_UNIT_REF_SKU_BASE_MEASURE_UNIT_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_MEDIA_PRODUCT_SKU_REF_SKU_DISPLAY_ORDER
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_MEDIA_ASSET_REF_PRIMARY_MEDIA
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_REFERENCE_RELATION_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_RELATION_ITEM_REF_ITEM_KIND
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_LATERAL_JSONB_AGG_JSONB_BUILD_OBJECT_ATTRIBUTE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ATTRIBUTE_ENTRY_REF_TEXT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ATTRIBUTE_CODE_ATTRIBUTE_CODE_ATTRIBUTE_NAME
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ATTRIBUTE_VALUE_REF_VALUE_ENTRY_REF_TEXT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VALUE_CODE_VALUE_CODE_VALUE_LABEL
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_AXIS_VALUE_DISPLAY_ORDER_STATUS_VALUE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ORDER_BY_AXIS_VALUE_DISPLAY_ORDER_ATTRIBUTE_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ATTRIBUTE_VALUES
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_SKU_ATTRIBUTE_VALUE_ASSIGNMENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_DICTIONARY_ENTRY_ATTRIBUTE_ENTRY_REF_ASSIGNMENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_DICTIONARY_ENTRY_VALUE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VALUE_ENTRY_REF_ASSIGNMENT_ATTRIBUTE_VALUE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_AXIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CONDITION_AXIS_ITEM_REF_SKU_ATTRIBUTE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CONDITION_AXIS_VALUE_SKU_VARIANT_AXIS_REF_AXIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_AXIS_VALUE_VALUE_REF_ASSIGNMENT_ATTRIBUTE_VALUE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_ASSIGNMENT_PRODUCT_SKU_REF_SKU_ATTRIBUTES
                        + skuStatusPredicate
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_C
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_MATCHING_AGGREGATE_TOTAL_PAGED);
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef, itemCode));
        if (cursorDisplayOrder != null) {
            sql.append(CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_DISPLAY_ORDER_SKU_CODE
                    + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OPEN_PAREN_DISPLAY_ORDER_SKU_CODE_PRODUCT_SKU_REF);
            args.add(cursorDisplayOrder);
            args.add(cursorDisplayOrder);
            args.add(cursorCode);
            args.add(cursorDisplayOrder);
            args.add(cursorCode);
            args.add(cursorRef);
        }
        sql.append(CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER_SKU_CODE_PRODUCT_SKU_REF
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ITEM_SCOPE_PAGED_AGGREGATE_TOTAL_ITEM_EXISTS
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_PAGED_FROM_AGGREGATE_LEFT_JOIN_PAG
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ORDER_BY_PAGED_DISPLAY_ORDER_SKU_CODE_PRODUCT_SKU_REF);
        args.add(pageSize + 1);
        return jdbc.query(
                sql.toString(),
                statement -> {
                    for (int index = 0; index < args.size(); index++) statement.setObject(index + 1, args.get(index));
                },
                (result, row) -> skuCandidateRow(result));
    }

    private SkuCandidateRow skuCandidateRow(ResultSet result) throws SQLException {
        UUID productSkuRef = result.getObject(1, UUID.class);
        if (productSkuRef == null)
            return new SkuCandidateRow(
                    null, 0, null, null, result.getLong(28), null, null, null, result.getBoolean(29));
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

    private void putSkuUnit(ObjectNode target, String field, ResultSet result, int refColumn, String inheritanceSource)
            throws SQLException {
        UUID ref = result.getObject(refColumn, UUID.class);
        if (ref == null) {
            target.putNull(field);
            return;
        }
        target.putObject(field)
                .put("unitRef", ref.toString())
                .put("code", result.getString(refColumn + 1))
                .put("name", result.getString(refColumn + 2))
                .put("unitDimension", result.getString(refColumn + 3))
                .put("precision", result.getInt(refColumn + 4))
                .put("inheritanceSource", inheritanceSource)
                .put("status", result.getString(refColumn + 5) == null ? "ENABLED" : result.getString(refColumn + 5));
    }

    private JsonNode nullableJson(String raw, String failureMessage) {
        if (raw == null) return mapper.nullNode();
        try {
            return mapper.readTree(raw);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, failureMessage, failure);
        }
    }

    private static void putNullableLong(ObjectNode target, String key, Long value) {
        if (value == null) target.putNull(key);
        else target.put(key, value);
    }

    private static void putNullableUuid(ObjectNode target, String field, UUID value) {
        if (value == null) target.putNull(field);
        else target.put(field, value.toString());
    }

    public Set<UUID> referencedAssetRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return Set.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.addAll(refs);
        arguments.addAll(refs);
        arguments.addAll(refs.stream().map(UUID::toString).toList());
        return new LinkedHashSet<>(jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_IMAGE_IMAGE_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_IMAGE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_IMAGE_ASSET_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UNION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CATALOG_SKU_SKU_PRODUCT_SKU_REF_MEDIA
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_MEDIA_ASSET_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UNION_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_PUBLISHED_PUBLISHED_PRIMARY_IMAGE_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_PUBLISHED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_SALES_COLLECTION_VERSION_PUBLISHED_VERSION
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JOIN_CONDITION_PUBLISHED_VERSION_VERSION_REF_PUBLISHED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_PUBLISHED_PUBLISHED_PRIMARY_IMAGE_ASSET_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_PUBLISHED_VERSION_KIND_PUBLISHED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UNION_ALTERNATE_B
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_SNAPSHOT_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_0_9A_F_8_0_9A_F_4_1_5_0_9A_F
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_THEN_SNAPSHOT_ASSET_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_PUBLISHED_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JOIN_SALES_COLLECTION_VERSION_PUBLISHED_VERSION_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JOIN_CONDITION_PUBLISHED_VERSION_VERSION_REF_PUBLISHED_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_LATERAL_JSONB_ARRAY_ELEMENTS_TEXT
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_PUBLISHED_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_SNAPSHOT_ASSET_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_SNAPSHOT_ASSET_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CONDITION_PUBLISHED_VERSION_KIND_PUBLISHED_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_REFERENCED_ASSETS,
                (result, row) -> UUID.fromString(result.getString(1)),
                arguments.toArray()));
    }

    public List<UUID> readAssetReferences(String dataNodeRef, String brandRef, String itemCode) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ASSET_REF_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_IMAGE_IMAGE_ASSET_REF_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_IMAGE_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_ITEM_STATUS_VOIDED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UNION_ALTERNATE_C
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JOIN_CATALOG_SKU_SKU_PRODUCT_SKU_REF_MEDIA_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_SKU_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_ITEM_DATA_NODE_REF_BRAND_REF_CODE_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_ITEM_STATUS_VOIDED_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ASSET_REFS_ASSET_REF,
                (rows, row) -> rows.getObject(1, UUID.class),
                dataNodeRef,
                brandRef,
                itemCode,
                dataNodeRef,
                brandRef,
                itemCode);
    }

    public Map<String, Map<String, String>> readSkuNamesByItemCodes(
            String dataNodeRef, String brandRef, List<String> itemCodes) {
        if (itemCodes == null || itemCodes.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemCodes.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef);
        args.add(brandRef);
        args.addAll(itemCodes);
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_ITEM_CODE_SKU_SKU_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU_ITEM_REF_ITEM_DATA_NODE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_IN_LIST_PREFIX
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_STATUS_VOIDED_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_CODE_SKU_DISPLAY_ORDER,
                args.toArray(),
                rows -> {
                    while (rows.next()) {
                        String itemCode = rows.getString(1);
                        String skuCode = rows.getString(2);
                        String skuName = rows.getString(3);
                        if (skuCode != null && skuName != null && !skuName.isBlank())
                            result.computeIfAbsent(itemCode, ignored -> new LinkedHashMap<>())
                                    .put(skuCode, skuName);
                    }
                    return null;
                });
        return result;
    }

    public int insertItem(
            UUID itemRef,
            String dataNodeRef,
            String brandRef,
            String code,
            String name,
            String shortName,
            String shape,
            String sectionsJson,
            long createdAt,
            long updatedAt) {
        return jdbc.update(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_INSERT_INTO_CATALOG_ITEM_ITEM_REF_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SHAPE_KEY_STATUS_SECTIONS_VERSION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_DISABLED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_PARAMETER_PLACEHOLDER,
                itemRef,
                dataNodeRef,
                brandRef,
                code,
                name,
                shortName,
                shape,
                sectionsJson,
                createdAt,
                updatedAt);
    }

    public int updateItem(
            String name,
            String shortName,
            String sectionsJson,
            UnitFactValues unitValues,
            long updatedAt,
            String dataNodeRef,
            String brandRef,
            String code,
            long expectedVersion) {
        List<Object> values = new ArrayList<>();
        values.add(name);
        values.add(shortName);
        values.add(sectionsJson);
        values.add(unitValues.salesUnitRef());
        values.add(unitValues.salesUnitCode());
        values.add(unitValues.salesUnitName());
        values.add(unitValues.salesUnitDimension());
        values.add(unitValues.salesUnitPrecision());
        values.add(unitValues.baseMeasureUnitRef());
        values.add(unitValues.baseMeasureUnitCode());
        values.add(unitValues.baseMeasureUnitName());
        values.add(unitValues.baseMeasureUnitDimension());
        values.add(unitValues.baseMeasureUnitPrecision());
        values.add(updatedAt);
        values.add(dataNodeRef);
        values.add(brandRef);
        values.add(code);
        values.add(expectedVersion);
        return jdbc.update(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_NAME_SHORT_NAME_SECTIONS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SALES_UNIT_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SALES_UNIT_PRECISION_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_NAME
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF_BRAND_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_CODE_VERSION_STATUS_VOIDED,
                values.toArray());
    }

    public void writeItemUnitSnapshots(List<ItemUnitSnapshotRow> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UPDATE_CATALOG_CATALOG_ITEM_SET_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION_WHERE_BASE_MEASURE_UNIT_PRECISION_WHERE_ITEM_REF,
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

    public void writeSkuUnitFacts(List<SkuUnitFactRow> rows) {
        if (rows.isEmpty()) return;
        jdbc.batchUpdate(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_CATALOG_SKU_UPDATE_CATALOG_CATALOG_SKU_S
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_REF_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VALUE_SEPARATOR_UPDATED_AT_EPOCH_MILLIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_PRODUCT_SKU_REF,
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
                            row.productSkuRef()
                        })
                        .toList());
    }

    public int bumpItemVersion(
            UUID itemRef, String dataNodeRef, String brandRef, long expectedVersion, long updatedAt) {
        return jdbc.update(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_VERSION_UPDATED_AT_EPOCH_MILLIS_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_DATA_NODE_REF_BRAND_REF_VERSION_STATUS,
                updatedAt,
                itemRef,
                dataNodeRef,
                brandRef,
                expectedVersion);
    }

    public List<UUID> findSkuItemRefs(String dataNodeRef, String brandRef, UUID skuRef) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_SKU_ITEM_REF_ITEM
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU_PRODUCT_SKU_REF,
                (result, row) -> result.getObject(1, UUID.class),
                dataNodeRef,
                brandRef,
                skuRef);
    }

    public boolean skuExists(UUID skuRef) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_SKU_PRODUCT_SKU_REF, Boolean.class, skuRef));
    }

    public List<Long> lockCatalogItemVersions(String dataNodeRef, String brandRef, UUID itemRef) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE,
                (result, row) -> result.getLong(1),
                dataNodeRef,
                brandRef,
                itemRef);
    }

    public DetailInboundFactsRow readDetailInboundFacts(
            String dataNodeRef, String brandRef, UUID itemRef, Collection<UUID> skuRefs) {
        UUID[] orderedSkuRefs = new LinkedHashSet<>(skuRefs == null ? List.of() : skuRefs).toArray(UUID[]::new);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_SKU
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_KIND_COMPONENT_PRODUCT_SKU_REF_COMPOSITE_COMPONENT_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_CODE_NAME_BIGINT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_GROUP_COMPONENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_OWNER_ITEM_ITEM_REF_GROUP_ROW
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_TARGET_SKU_PRODUCT_SKU_REF_COMPONENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_DATA_NODE_REF_BRAND_REF_STATUS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_COMPONENT_PRODUCT_SKU_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_TARGET_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_COMPONENT_COMPOSITE_COMPONENT_REF_OWNER_ITEM
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_CODE_NAME_BIGINT_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_GROUP_COMPONENT_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_ITEM_OWNER_ITEM_ITEM_REF_GROUP_ROW_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_OWNER_ITEM_DATA_NODE_REF_BRAND_REF_STATUS_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_COMPONENT_COMPONENT_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_GENERATION_TEXT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VERSION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF,
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
                    Map<UUID, List<SkuInboundReferenceRow>> bySku = new LinkedHashMap<>();
                    List<InboundItemReferenceRow> byItem = new ArrayList<>();
                    long generation = 0;
                    while (result.next()) {
                        switch (result.getString(1)) {
                            case "SKU" -> bySku.computeIfAbsent(
                                            result.getObject(2, UUID.class), ignored -> new ArrayList<>())
                                    .add(new SkuInboundReferenceRow(
                                            result.getObject(3, UUID.class),
                                            result.getObject(4, UUID.class),
                                            result.getString(5),
                                            result.getString(6)));
                            case "ITEM" -> byItem.add(new InboundItemReferenceRow(
                                    result.getObject(4, UUID.class), result.getString(5), result.getString(6)));
                            case "GENERATION" -> generation = result.getLong(7);
                            default -> throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品入向事实类型无法读取");
                        }
                    }
                    return new DetailInboundFactsRow(
                            bySku.entrySet().stream()
                                    .collect(java.util.stream.Collectors.toUnmodifiableMap(
                                            Map.Entry::getKey, entry -> List.copyOf(entry.getValue()))),
                            List.copyOf(byItem),
                            generation);
                });
    }

    public Map<UUID, List<SkuInboundReferenceRow>> readSkuInboundReferences(
            String dataNodeRef, String brandRef, Collection<UUID> skuRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(skuRefs));
        if (orderedRefs.isEmpty()) return Map.of();
        UUID[] values = orderedRefs.toArray(UUID[]::new);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_COMPONENT_PRODUCT_SKU_REF_COMPOSITE_COMPONENT_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_CODE_NAME
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_CATALOG_COMPOSITE_COMPONENT_COMPONENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_GROUP_ROW
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_SKU_OWNER_ITEM_ITEM_REF_GROUP_ROW_TARGET_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_TARGET_SKU_PRODUCT_SKU_REF_COMPONENT_OWNER_ITEM
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_BRAND_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_STATUS_VOIDED_COMPONENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_OWNER_ITEM_ITEM_REF_TARGET_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_COMPONENT_PRODUCT_SKU_REF_OWNER_ITEM_CODE,
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

    public void lockProductSkuRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        refs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .forEach(ref -> AdvisoryLock.acquire(jdbc, 0x43534B55, ref));
    }

    public void lockCatalogItemRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
    }

    public int transitionItem(
            String target, long updatedAt, UUID itemRef, String dataNodeRef, String brandRef, long expectedVersion) {
        return jdbc.update(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_REF_DATA_NODE_REF_BRAND_REF_VERSION,
                target,
                updatedAt,
                itemRef,
                dataNodeRef,
                brandRef,
                expectedVersion);
    }

    public boolean formalCodeAvailable(String dataNodeRef, String brandRef, String code, UUID currentRef) {
        Long count = jdbc.queryForObject(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_REF_STATUS_VOIDED,
                Long.class,
                dataNodeRef,
                brandRef,
                code,
                currentRef);
        return count == null || count == 0;
    }

    public int updateTemporaryPromotionItem(
            String name,
            String shortName,
            String shapeKey,
            String sectionsJson,
            long updatedAt,
            String dataNodeRef,
            String brandRef,
            String code,
            long expectedVersion) {
        return jdbc.update(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_UPDATE_CATALOG_CATALOG_ITEM_
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_NAME_SHORT_NAME_SHAPE_KEY_STATUS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_DATA_NODE_REF_BRAND_REF_CODE_VERSION,
                name,
                shortName,
                shapeKey,
                sectionsJson,
                updatedAt,
                dataNodeRef,
                brandRef,
                code,
                expectedVersion);
    }

    public int insertTemporaryPromotionItem(
            UUID itemRef,
            String dataNodeRef,
            String brandRef,
            String code,
            String name,
            String shortName,
            String shapeKey,
            String sectionsJson,
            String sourceItemCode,
            String sourceScopeRef,
            long createdAt,
            long updatedAt) {
        return jdbc.update(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_INSERT_INTO_CATALOG_ITEM_INSERT_INTO_CATALOG_CATALOG_
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OPEN_PAREN_ITEM_REF_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SOURCE_ITEM_CODE_SOURCE_SCOPE_REF_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF_VERSION_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_VALUES_DISABLED,
                itemRef,
                dataNodeRef,
                brandRef,
                code,
                name,
                shortName,
                shapeKey,
                sectionsJson,
                sourceItemCode,
                sourceScopeRef,
                createdAt,
                updatedAt);
    }

    public int voidTemporaryPromotionItem(
            long updatedAt, String dataNodeRef, String brandRef, String code, long expectedVersion) {
        return jdbc.update(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UPDATE_CATALOG_ITEM_STATUS_VOIDED_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CODE_VERSION,
                updatedAt,
                dataNodeRef,
                brandRef,
                code,
                expectedVersion);
    }

    public List<CategoryRow> lockCategories(String scope, String brand, Collection<UUID> refs) {
        List<UUID> stable = refs.stream().distinct().sorted().toList();
        if (stable.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(stable.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(stable);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CATEGORY_REF,
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

    public List<CategoryRow> lockCategoriesForReferenceValidation(String scope, String brand, Collection<UUID> refs) {
        List<UUID> stable = refs.stream().distinct().sorted().toList();
        if (stable.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(stable.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(stable);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_A
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_CATEGORY_REF,
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

    public TransitionItemPrecheckRow readTransitionPrecheck(String scope, String brand, String itemCode) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ITEM_ITEM_REF_CODE_NAME
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_SECTIONS_TEXT
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_ITEM_VERSION_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_PRODUCT_IDENTIFIER_IDENTIFIER
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_IDENTIFIER_ITEM_REF_ITEM
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_DATA_NODE_REF_BRAND_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_ITEM_CODE,
                result -> {
                    if (!result.next()) return null;
                    return new TransitionItemPrecheckRow(itemRow(result, 1), result.getBoolean(11));
                },
                scope,
                brand,
                itemCode);
    }

    public Map<UUID, List<InboundItemReferenceRow>> readInboundItemReferencesByRefs(
            String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> ordered = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (ordered.isEmpty()) return Map.of();
        UUID[] values = ordered.toArray(UUID[]::new);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_COMPONENT_COMPONENT_ITEM_REF_OWNER_ITEM_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_COMPONENT_COMPONENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_GROUP_ROW
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_GROUP_ROW_DATA_NODE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_BRAND_REF_STATUS_VOIDED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_COMPONENT_COMPONENT_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_CODE_ITEM_REF,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, List<InboundItemReferenceRow>> references = new LinkedHashMap<>();
                    while (result.next()) {
                        UUID itemRef = result.getObject(1, UUID.class);
                        references
                                .computeIfAbsent(itemRef, ignored -> new ArrayList<>())
                                .add(new InboundItemReferenceRow(
                                        result.getObject(2, UUID.class), result.getString(3), result.getString(4)));
                    }
                    return references;
                });
    }

    public List<InboundItemReferenceRow> readInboundItemReferences(String scope, String brand, UUID itemRef) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_OWNER_ITEM_ITEM_REF_CODE_NAME
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_COMPOSITE_COMPONENT_COMPONENT_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_GROUP_ROW_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_ITEM_GROUP_ROW_COMPOSITE_GROUP_REF_COMPONENT_ALTERNATE_B
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_OWNER_ITEM_ITEM_REF_GROUP_ROW_DATA_NODE_REF_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_OWNER_ITEM_BRAND_REF_STATUS_VOIDED_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ORDER_BY_OWNER_ITEM_CODE_ITEM_REF,
                (result, row) -> new InboundItemReferenceRow(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3)),
                scope,
                brand,
                itemRef);
    }

    public Map<String, Set<UUID>> readSkuDictionaryRefs(String scope, String brand, UUID itemRef) {
        Map<String, Set<UUID>> result = new LinkedHashMap<>();
        result.put("SKU_ATTRIBUTE", new LinkedHashSet<>());
        result.put("SKU_ATTRIBUTE_VALUE", new LinkedHashSet<>());
        jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_SKU_ATTRIBUTE_DICTIONARY_KIND_RELATION_ATTRIBUTE_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_SKU_CATALOG_SKU_ATTRIBUTE_VALUE_RELATION_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_RELATION_ITEM
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_ITEM_ITEM_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UNION_SKU_ATTRIBUTE_VALUE_RELATION_ATTRIBUTE_VALUE_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_SKU_CATALOG_SKU_ATTRIBUTE_VALUE_RELATION_SKU_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_RELATION_ITEM_ALTERNATE_A
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF_ALTERNATE_B
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_ITEM_ITEM_REF_ALTERNATE_A,
                (rows, row) -> {
                    String kind = rows.getString(1);
                    UUID ref = rows.getObject(2, UUID.class);
                    if (ref != null && result.containsKey(kind))
                        result.get(kind).add(ref);
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

    public Map<DictionaryReference, String> lockDictionaryRefs(
            String scope, String brand, Collection<DictionaryReference> references) {
        List<DictionaryReference> requestedReferences = new ArrayList<>(new LinkedHashSet<>(references));
        if (requestedReferences.isEmpty()) return Map.of();
        String tuples = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(requestedReferences.size(), CatalogItemServiceSql.REFERENCE_TUPLE));
        List<Object> args = new ArrayList<>(List.of(scope, brand));
        for (DictionaryReference reference : requestedReferences) {
            args.add(reference.kind());
            args.add(reference.ref());
        }
        return jdbc
                .query(
                        CatalogItemServiceSql
                                        .CATALOG_ITEM_SERVICE_SELECT_DICTIONARY_ENTRY_DICTIONARY_KIND_ENTRY_REF_STATUS
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_DICTIONARY_KIND_ENTRY_REF
                                + tuples
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_DICTIONARY_KIND_ENTRY_REF,
                        (result, index) -> Map.entry(
                                new DictionaryReference(result.getString(1), result.getObject(2, UUID.class)),
                                result.getString(3)),
                        args.toArray())
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, Map.Entry::getValue, (left, right) -> left, LinkedHashMap::new));
    }

    public Map<UUID, String> readItemStatuses(String scope, String brand, Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(List.of(scope, brand));
        args.addAll(refs);
        return jdbc
                .query(
                        CatalogItemServiceSql
                                        .CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_ITEM_REF_STATUS_DATA_NODE_REF_BRAND_REF
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_ITEM_REF
                                + placeholders
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ITEM_REF_KEY_SHARE,
                        (result, row) -> Map.entry(result.getObject(1, UUID.class), result.getString(2)),
                        args.toArray())
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, Map.Entry::getValue, (left, right) -> left, LinkedHashMap::new));
    }

    public Map<UUID, SkuReferenceOwnerRow> readSkuOwners(Collection<UUID> skuRefs, String scope, String brand) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(skuRefs));
        if (refs.isEmpty()) return Map.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(List.of(scope, brand));
        args.addAll(refs);
        return jdbc
                .query(
                        CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_SKU_PRODUCT_SKU_REF_ITEM_REF_ITEM
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_SKU_ITEM
                                + CatalogItemServiceSql
                                        .CATALOG_ITEM_SERVICE_JOIN_CONDITION_ITEM_ITEM_REF_SKU_DATA_NODE_REF
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU_PRODUCT_SKU_REF_ALTERNATE_A
                                + placeholders
                                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_SKU_PRODUCT_SKU_REF_KEY_SHARE,
                        (result, row) -> Map.entry(
                                result.getObject(1, UUID.class),
                                new SkuReferenceOwnerRow(
                                        result.getObject(1, UUID.class),
                                        result.getObject(2, UUID.class),
                                        result.getString(3),
                                        result.getString(4))),
                        args.toArray())
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, Map.Entry::getValue, (left, right) -> left, LinkedHashMap::new));
    }

    public List<CategorySummaryRow> readCategorySummary(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(refs);
        args.add(dataNodeRef);
        args.add(brandRef);
        args.add(dataNodeRef);
        args.add(brandRef);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CTE_SELECTED_ITEM_REF_CATEGORY_REF_RELATION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_RELATION_CATEGORY
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_RELATION_ITEM_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_CATEGORY_DATA_NODE_REF_BRAND_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_CATEGORY_STATUS_VOIDED
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CATEGORY_PATHS_LEAF_REF_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_CATEGORY
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CODE_CATEGORY_NAME
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_CATEGORY
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_JOIN_CONDITION_CATEGORY_CATEGORY_REF_SELECTED
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_UNION_PATHS_LEAF_REF_PARENT_CATEGORY_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JSONB_BUILD_ARRAY_JSONB_BUILD_OBJECT_CATEGORY_REF_PARENT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CODE_PARENT_NAME_PATHS
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATEGORY_PATHS_PATHS
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_JOIN_CATALOG_CATEGORY_PARENT_DATA_NODE_REF_BRAND_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CONDITION_PARENT_CATEGORY_REF_PATHS_PARENT_CATEGORY_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SELECT_SELECTED_ITEM_REF_CATEGORY_REF_PATHS_PATH_NODES
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATEGORY_PATHS_PATHS_LEAF_REF_SELECTED_CATEGORY_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_PATHS_PARENT_CATEGORY_REF,
                (result, row) -> new CategorySummaryRow(
                        result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3)),
                args.toArray());
    }

    public CopyFactPresenceRow readCopyFactPresence(Collection<UUID> itemRefs) {
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        if (refs.isEmpty()) return new CopyFactPresenceRow(false, false, false, false, false, false, false, false);
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        String sql = CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_D
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_ITEM_REF
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_STATUS_VOIDED
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_CATEGORY_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_D
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_E
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_F
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_G
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_H
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_IMAGE_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_I
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_REFERENCE_ITEM_REF_ALTERNATE_A
                + placeholders
                + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_J;
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

    public List<ItemRow> loadItemsByCodes(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef));
        args.addAll(codes);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME_SHAPE_KEY_STATUS_SECTIONS_TEXT_VERSION_UPDATED_AT_EPOCH_MILLIS_CATALOG_ITEM_WHERE_DATA_NODE_REF_AND
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_BRAND_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_CODE
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CODE,
                (result, row) -> itemRow(result, 1),
                args.toArray());
    }

    public List<ItemRow> loadItemIdentityRows(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(codes.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>(List.of(dataNodeRef, brandRef));
        args.addAll(codes);
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_B
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_ITEM_REF_CODE_NAME_SHORT_NAME_ALTERNATE_B
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_SOURCE_SCOPE_REF_ALTERNATE_A
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_DATA_NODE_REF_BRAND_REF_CODE
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_CODE,
                (result, row) -> itemRow(result, 1),
                args.toArray());
    }

    public SaveFactPresenceRow readSaveFactPresence(UUID itemRef) {
        return jdbc.query(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_ALTERNATE_C
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_PRODUCT_IDENTIFIER_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ITEM_REF_PREPARATION_PROFILE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_ITEM_REF_PREPARATION_OVERRIDE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_MEDIA_SKU
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SKU_PRODUCT_SKU_REF_MEDIA_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_CATEGORY_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_COMPOSITE_GROUP_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ATTRIBUTE_ASSIGNMENT_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_VALUE_OV_OVERRIDE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_ORDER_OPTION_CONFIG_CONFIG
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONFIG_ITEM_ORDER_OPTION_CONFIG_REF_OVERRIDE
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_WHERE_CONFIG_ITEM_REF_OVERRIDE_PREPARATION_EFFECT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_SKU_VARIANT_AXIS_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_IMAGE_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CATALOG_ITEM_REFERENCE_ITEM_REF,
                result -> {
                    if (!result.next())
                        return new SaveFactPresenceRow(
                                false, false, false, false, false, false, false, false, false, false, false, false);
                    return new SaveFactPresenceRow(
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
                },
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef,
                itemRef);
    }

    public Map<UUID, ItemUnitRefsRow> readItemUnitRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SELECT_ITEM_REF_SALES_UNIT_REF_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION_SALES_UNIT_CODE_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_BASE_MEASURE_UNIT_REF_BASE_MEASURE_UNIT_CODE_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION_BASE_MEASURE_UNIT_NAME_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_ITEM_ITEM_REF
                        + placeholders
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_B,
                result -> {
                    Map<UUID, ItemUnitRefsRow> rows = new LinkedHashMap<>();
                    while (result.next()) {
                        rows.put(
                                result.getObject(1, UUID.class),
                                new ItemUnitRefsRow(
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
                    }
                    return rows;
                },
                refs.toArray());
    }

    public Set<UUID> unitReferences(String dataNodeRef, String brandRef, UUID itemRef) {
        return new LinkedHashSet<>(jdbc.query(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_SALES_UNIT_REF_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CONDITION_CATALOG_ITEM_SALES_UNIT_REF_BASE_MEASURE_UNIT_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_ITEM_REF_BASE_MEASURE_UNIT_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_UNION_CATALOG_SKU_SKU_SALES_UNIT_OVERRIDE_REF_ITEM_REF
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_CONDITION_SKU_SALES_UNIT_OVERRIDE_REF_BASE_MEASURE_UNIT_OVERRIDE_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_FROM_CLAUSE_CATALOG_SKU_SKU_ITEM_REF
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_SKU_BASE_MEASURE_UNIT_OVERRIDE_REF,
                (result, row) -> result.getObject(1, UUID.class),
                dataNodeRef,
                brandRef,
                itemRef,
                dataNodeRef,
                brandRef,
                itemRef,
                itemRef,
                itemRef));
    }

    public List<ReceiptRow> readReceipt(String dataNodeRef, String key) {
        return jdbc.query(
                CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                        + CatalogItemServiceSql.CATALOG_ITEM_SERVICE_CONDITION_IDEMPOTENCY_KEY,
                (result, row) -> new ReceiptRow(result.getString(1), result.getString(2), result.getString(3)),
                dataNodeRef,
                key);
    }

    public void writeReceipt(
            String scope, String key, String operationId, String requestHash, String responseJson, long createdAt) {
        jdbc.update(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_INSERT_INTO
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY
                        + CatalogItemServiceSql
                                .CATALOG_ITEM_SERVICE_RESPONSE_CREATED_AT_EPOCH_MILLIS_VALUES_CAST_AS_JSONB_VALUES_CAST_AS_JSONB,
                UUID.randomUUID(),
                scope,
                key,
                operationId,
                requestHash,
                responseJson,
                createdAt);
    }

    public long generation(String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(
                CatalogItemServiceSql.CATALOG_ITEM_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF,
                Long.class,
                dataNodeRef,
                brandRef);
        return value == null ? 0L : value;
    }

    private static ItemRow itemRow(ResultSet result, int offset) throws SQLException {
        return new ItemRow(
                result.getObject(offset, UUID.class),
                result.getString(offset + 1),
                result.getString(offset + 2),
                result.getString(offset + 3),
                result.getString(offset + 4),
                result.getString(offset + 5),
                result.getString(offset + 6),
                result.getLong(offset + 7),
                result.getLong(offset + 8),
                result.getString(offset + 9));
    }
}
