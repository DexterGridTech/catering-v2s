package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
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
import org.postgresql.util.PSQLException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Catalog-owned SKU facts. The relational tables are the only persisted source; JSON is reconstructed only for the
 * existing owner read contract.
 */
public class CatalogSkuFacts {
    private static final String VARIANT_COMBINATION_CONSTRAINT = "ux_catalog_sku_variant_digest_per_item";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    public CatalogSkuFacts(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    public Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        return readByItemRefs(itemRefs, false);
    }

    /**
     * Reads the authoritative SKU facts needed by the item lifecycle guard. SKU rows are relational owner facts; the
     * catalog item JSON deliberately does not persist the hydrated {@code skus} projection.
     */
    public ActivationFacts activationFacts(UUID itemRef) {
        return jdbc.queryForObject(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_FILTER_STATUS_ENABLED
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_SKU_ITEM_REF_STATUS_VOIDED,
                (result, rowNumber) -> new ActivationFacts(result.getInt(1)),
                itemRef);
    }

    /**
     * The list projection is the only reader that must combine an SKU's stored preparation override with the parent
     * preparation profile. Carry that owner-local column in the existing SKU set read rather than opening a second
     * page-wide lookup for the same SKU rows.
     */
    public ListReadback readByItemRefsForList(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return ListReadback.empty();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String requestedValues = refs.stream()
                .map(ignored -> CatalogSkuFactsSql.REQUESTED_ITEM_REF_VALUE)
                .collect(java.util.stream.Collectors.joining(CatalogSkuFactsSql.VALUE_SEPARATOR));
        Map<UUID, LinkedHashMap<UUID, ObjectNode>> rows = new LinkedHashMap<>();
        Map<UUID, ArrayNode> axes = new LinkedHashMap<>();
        Set<UUID> loadedAxes = new LinkedHashSet<>();
        refs.forEach(ref -> axes.put(ref, mapper.createArrayNode()));
        jdbc.query(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_CTE_REQUESTED_ITEM_REF
                        + requestedValues
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CLOSE_PAREN_REQUESTED_ITEM_REF_SKU_PRODUCT_SKU_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_STANDARD_SALE_PRICE_IS_DEFAULT_STATUS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_VARIANT_COMBINATION_DIGEST_SALES_UNIT_OVERRIDE_REF
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_SKU_BASE_MEASURE_UNIT_OVERRIDE_REF_SALES_UNIT_REF_SALES_UNIT_CODE
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_SKU_SALES_UNIT_NAME_SALES_UNIT_DIMENSION_SALES_UNIT_PRECISION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_SKU_BASE_MEASURE_UNIT_DIMENSION_BASE_MEASURE_UNIT_PRECISION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_VALUE_ATTRIBUTE_REF_ATTRIBUTE_CODE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUE_NAME_STATUS_AXIS_VALUE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_PREPARATION_OVERRIDE_TEXT_UPDATED_AT_EPOCH_MILLIS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_AXIS_FACTS_SKU
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_ITEM_REF_REQUESTED_STATUS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE_ATTRIBUTE_VALUE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_DICTIONARY_ENTRY_ATTRIBUTE_VALUE_PRODUCT_SKU_REF_SKU
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_ENTRY_REF_ATTRIBUTE_VALUE_ATTRIBUTE_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_DICTIONARY_ENTRY_VALUE_ENTRY_REF_ATTRIBUTE_VALUE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_JOIN
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_AXIS_ITEM_REF_SKU
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_ATTRIBUTE_REF_ATTRIBUTE_VALUE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_VALUE_SKU_VARIANT_AXIS_REF_AXIS
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_LATERAL_AXIS_VALUE_VALUE_REF_ATTRIBUTE_VALUE_ATTRIBUTE_VALUE_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_OPEN_PAREN_STRING_AGG_MEDIA_ASSET_REF_TEXT
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF_MEDIA_REFS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_LATERAL_MEDIA_PRODUCT_SKU_REF_SKU_MEDIA_REFS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_OPEN_PAREN_JSONB_AGG_JSONB_BUILD_OBJECT
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_REF_AXIS_PROJECTION_TEXT
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_CODE_AXIS_PROJECTION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_NAME_AXIS_PROJECTION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_DISPLAY_ORDER_AXIS_PROJECTION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_PROJECTION_VALUES_JSON_DISPLAY_ORDER
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_PROJECTION_ATTRIBUTE_REF_TEXT_AXIS_FACTS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_PROJECTION_ATTRIBUTE_REF_ATTRIBUTE_PROJECTION_CODE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_PROJECTION_NAME_ATTRIBUTE_NAME_AXIS_PROJECTION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_JSONB_AGG_JSONB_BUILD_OBJECT
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUE_REF_AXIS_VALUE_PROJECTION_TEXT
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUE_CODE_VALUE_PROJECTION_CODE_VALUE_LABEL
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_STATUS_VALUE_PROJECTION_DISPLAY_ORDER_AXIS_VALUE_PROJECTION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ORDER_BY_AXIS_VALUE_PROJECTION_DISPLAY_ORDER_VALUE_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE_PROJECTION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_DICTIONARY_ENTRY_VALUE_PROJECTION_ENTRY_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_VALUE_PROJECTION_VALUE_REF_SKU_VARIANT_AXIS_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_PROJECTION_SKU_VARIANT_AXIS_REF_VALUES_JSON
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_DICTIONARY_ENTRY_CATALOG_SKU_VARIANT_AXIS_AXIS_PROJECTION
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_ATTRIBUTE_PROJECTION_ENTRY_REF_AXIS_PROJECTION_ATTRIBUTE_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_PROJECTION_ITEM_REF_REQUESTED_AXIS_FACTS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_REQUESTED_ITEM_REF_SKU_DISPLAY_ORDER
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_VALUE_DISPLAY_ORDER_ATTRIBUTE_CODE,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                result -> {
                    while (result.next()) {
                        UUID itemRef = result.getObject(1, UUID.class);
                        if (loadedAxes.add(itemRef)) setAxisFacts(axes.get(itemRef), result.getString(34));
                        UUID skuRef = result.getObject(2, UUID.class);
                        if (skuRef == null) continue;
                        LinkedHashMap<UUID, ObjectNode> itemSkus =
                                rows.computeIfAbsent(itemRef, ignored -> new LinkedHashMap<>());
                        ObjectNode sku = itemSkus.get(skuRef);
                        if (sku == null) {
                            sku = skuNode(result);
                            itemSkus.put(skuRef, sku);
                        }
                        UUID attributeRef = result.getObject(23, UUID.class);
                        if (attributeRef == null) continue;
                        ObjectNode value = sku.withArray("attributeValueRefs").addObject();
                        value.put("attributeRef", attributeRef.toString());
                        value.put("attributeCode", result.getString(24));
                        value.put("attributeName", result.getString(25));
                        value.put(
                                "attributeValueRef",
                                result.getObject(26, UUID.class).toString());
                        value.put("valueCode", result.getString(27));
                        value.put("valueLabel", result.getString(28));
                        value.put("displayOrder", result.getInt(30));
                        value.put("status", result.getString(29));
                    }
                    return null;
                });
        Map<UUID, ArrayNode> skusByItem = new LinkedHashMap<>();
        refs.forEach(itemRef -> {
            ArrayNode values = mapper.createArrayNode();
            rows.getOrDefault(itemRef, new LinkedHashMap<>()).values().forEach(values::add);
            skusByItem.put(itemRef, values);
        });
        return new ListReadback(Map.copyOf(skusByItem), Map.copyOf(axes));
    }

    private void setAxisFacts(ArrayNode target, String axisFacts) {
        if (target == null || axisFacts == null || axisFacts.isBlank()) return;
        try {
            JsonNode parsed = mapper.readTree(axisFacts);
            if (!parsed.isArray()) throw new IllegalStateException("axis facts are not an array");
            parsed.forEach(target::add);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "规格轴读取失败", failure);
        }
    }

    public record ListReadback(Map<UUID, ArrayNode> skusByItem, Map<UUID, ArrayNode> axesByItem) {
        public static ListReadback empty() {
            return new ListReadback(Map.of(), Map.of());
        }
    }

    private Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs, boolean includePreparationOverride) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogSkuFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogSkuFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, LinkedHashMap<UUID, ObjectNode>> rows = new LinkedHashMap<>();
        jdbc.query(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_SKU_ITEM_REF_PRODUCT_SKU_REF_SKU_CODE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_STANDARD_SALE_PRICE_IS_DEFAULT_STATUS_ALTERNATE_A
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_SKU_VARIANT_COMBINATION_DIGEST_SALES_UNIT_OVERRIDE_REF_ALTERNATE_A
                        + CatalogSkuFactsSql.SKU_BASE_MEAS_UNIT_OVERRIDE_ALT_A_001
                        + CatalogSkuFactsSql.SKU_SALES_UNIT_NAME_SALES_ALT_A_002
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_ALTERNATE_A
                        + CatalogSkuFactsSql.SKU_BASE_MEAS_UNIT_DIM_ALT_A_003
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_ATTRIBUTE_VALUE_ATTRIBUTE_REF_ATTRIBUTE_CODE_ALTERNATE_A
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUE_NAME_STATUS_AXIS_VALUE_ALTERNATE_A
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_EMPTY_LITERAL
                        + (includePreparationOverride
                                ? CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_PREPARATION_OVERRIDE_TEXT
                                : CatalogSkuFactsSql.CATALOG_SKU_FACTS_TEXT)
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_PREPARATION_OVERRIDE_SKU_UPDATED_AT_EPOCH_MILLIS
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE_CATALOG_SKU_SKU_ATTRIBUTE_VALUE
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_DICTIONARY_ENTRY_ATTRIBUTE_VALUE_PRODUCT_SKU_REF_SKU_ALTERNATE_A
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_ATTRIBUTE_ENTRY_REF_ATTRIBUTE_VALUE_ATTRIBUTE_REF_ALTERNATE_A
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_DICTIONARY_ENTRY_VALUE_ENTRY_REF_ATTRIBUTE_VALUE_ALTERNATE_A
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SERVICE_LEFT_JOIN_PREFIX
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_JOIN_CATALOG_SKU_VARIANT_AXIS_AXIS_ITEM_REF_SKU
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_ATTRIBUTE_REF_ATTRIBUTE_VALUE_ALTERNATE_A
                        + CatalogSkuFactsSql
                                .CATALOG_SKU_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_AXIS_VALUE_SKU_VARIANT_AXIS_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_SKU_VARIANT_AXIS_REF_AXIS_VALUE_VALUE_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_LATERAL_STRING_AGG_MEDIA_ASSET_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_MEDIA_DISPLAY_ORDER
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_MEDIA_MEDIA_ASSET_REF_MEDIA_REFS_ALTERNATE_A
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_MEDIA_PRODUCT_SKU_REF_SKU_MEDIA_REFS
                        + placeholders
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CLOSE_PAREN_SKU_STATUS_VOIDED
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_ITEM_REF_DISPLAY_ORDER_SKU_CODE
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_AXIS_VALUE_DISPLAY_ORDER_ATTRIBUTE_CODE_ALTERNATE_A,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                result -> {
                    while (result.next()) {
                        UUID itemRef = result.getObject(1, UUID.class);
                        UUID skuRef = result.getObject(2, UUID.class);
                        LinkedHashMap<UUID, ObjectNode> itemSkus =
                                rows.computeIfAbsent(itemRef, ignored -> new LinkedHashMap<>());
                        ObjectNode sku = itemSkus.get(skuRef);
                        if (sku == null) {
                            sku = skuNode(result);
                            itemSkus.put(skuRef, sku);
                        }
                        UUID attributeRef = result.getObject(23, UUID.class);
                        if (attributeRef == null) continue;
                        ObjectNode value = sku.withArray("attributeValueRefs").addObject();
                        value.put("attributeRef", attributeRef.toString());
                        value.put("attributeCode", result.getString(24));
                        value.put("attributeName", result.getString(25));
                        value.put(
                                "attributeValueRef",
                                result.getObject(26, UUID.class).toString());
                        value.put("valueCode", result.getString(27));
                        value.put("valueLabel", result.getString(28));
                        value.put("displayOrder", result.getInt(30));
                        value.put("status", result.getString(29));
                    }
                    return null;
                });
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        refs.forEach(itemRef -> {
            ArrayNode values = mapper.createArrayNode();
            rows.getOrDefault(itemRef, new LinkedHashMap<>()).values().forEach(values::add);
            result.put(itemRef, values);
        });
        return Map.copyOf(result);
    }

    public Set<UUID> existingRefs(UUID itemRef) {
        return Set.copyOf(jdbc.query(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_ITEM_REF_STATUS_VOIDED,
                (result, row) -> result.getObject(1, UUID.class),
                itemRef));
    }

    /**
     * Locks the current SKU lifecycle rows while carrying the asset facts that the save coordinator must settle. The
     * save command already needs this lifecycle read; returning the related item/SKU asset refs here prevents a second
     * catalog-wide asset query without weakening the owner lock or changing which owner judges references.
     */
    public ExistingSaveFacts existingSaveFacts(UUID itemRef) {
        Set<UUID> skuRefs = new LinkedHashSet<>();
        Set<UUID> assetRefs = new LinkedHashSet<>();
        jdbc.query(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_CTE_LOCKED_SKUS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_SKU_PRODUCT_SKU_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_SKU_SKU
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_WHERE_SKU_ITEM_REF_STATUS_VOIDED
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CLOSE_PAREN
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_LOCKED_SKUS_PRODUCT_SKU_REF_MEDIA_ASSET_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_SKU_MEDIA_MEDIA
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_JOIN_CONDITION_MEDIA_PRODUCT_SKU_REF_LOCKED_SKUS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_UNION_UNION_ALL
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_IMAGE_ASSET_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_FROM_CLAUSE_CATALOG_ITEM_IMAGE_IMAGE_ITEM_REF,
                statement -> {
                    statement.setObject(1, itemRef);
                    statement.setObject(2, itemRef);
                },
                result -> {
                    while (result.next()) {
                        UUID skuRef = result.getObject(1, UUID.class);
                        UUID assetRef = result.getObject(2, UUID.class);
                        if (skuRef != null) skuRefs.add(skuRef);
                        if (assetRef != null) assetRefs.add(assetRef);
                    }
                    return null;
                });
        return new ExistingSaveFacts(Set.copyOf(skuRefs), Set.copyOf(assetRefs));
    }

    public record ExistingSaveFacts(Set<UUID> skuRefs, Set<UUID> assetRefs) {
        public ExistingSaveFacts {
            skuRefs = skuRefs == null ? Set.of() : Set.copyOf(skuRefs);
            assetRefs = assetRefs == null ? Set.of() : Set.copyOf(assetRefs);
        }

        public static ExistingSaveFacts empty() {
            return new ExistingSaveFacts(Set.of(), Set.of());
        }
    }

    public record ActivationFacts(int enabledCount) {}

    public LifecycleRow lockLifecycle(UUID itemRef, UUID skuRef) {
        List<LifecycleRow> rows = jdbc.query(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_SELECT_CATALOG_SKU_PRODUCT_SKU_REF_SKU_CODE_STATUS_VERSION
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_PRODUCT_SKU_REF,
                (result, row) -> new LifecycleRow(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getLong(4)),
                itemRef,
                skuRef);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "SKU 不存在");
        return rows.get(0);
    }

    public void markVoided(UUID itemRef, UUID skuRef, long expectedVersion) {
        int changed = jdbc.update(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_UPDATE_CATALOG_SKU_STATUS_VOIDED_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_WHERE_ITEM_REF
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_PRODUCT_SKU_REF_VERSION_STATUS_VOIDED,
                time.currentEpochMillis(),
                itemRef,
                skuRef,
                expectedVersion);
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "SKU 版本已变化");
    }

    public void replace(UUID itemRef, ArrayNode skus, Set<UUID> archivedRefs) {
        List<CopySku> parsed = new ArrayList<>();
        if (skus != null) for (JsonNode node : skus) parsed.add(parseCopySku(itemRef, node));

        if (archivedRefs != null && !archivedRefs.isEmpty()) {
            List<Object[]> archivedRows = archivedRefs.stream()
                    .map(skuRef -> new Object[] {time.currentEpochMillis(), itemRef, skuRef})
                    .toList();
            jdbc.batchUpdate(
                    CatalogSkuFactsSql.CATALOG_SKU_FACTS_UPDATE_CATALOG_SKU_STATUS_VOIDED_VERSION
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS_ITEM_REF
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_PRODUCT_SKU_REF_STATUS_VOIDED,
                    archivedRows);
        }
        if (parsed.isEmpty()) return;

        List<Object[]> skuRows = new ArrayList<>();
        List<Object[]> attributeRows = new ArrayList<>();
        for (CopySku sku : parsed) {
            skuRows.add(new Object[] {
                sku.skuRef(),
                sku.itemRef(),
                sku.skuCode(),
                sku.skuName(),
                sku.price(),
                sku.defaultSku(),
                sku.status(),
                sku.displayOrder(),
                sku.digest(),
                sku.salesUnitOverrideRef(),
                sku.baseMeasureUnitOverrideRef(),
                time.currentEpochMillis()
            });
            for (AttributeValue value : sku.attributes())
                attributeRows.add(new Object[] {sku.skuRef(), value.attributeRef(), value.valueRef()});
        }
        try {
            int[] changed = jdbc.batchUpdate(
                    CatalogSkuFactsSql.CATALOG_SKU_FACTS_INSERT_INTO
                            + CatalogSkuFactsSql.CAT_SKU_PRODUCT_SKU_REF_005
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SALES_UNIT_OVERRIDE_REF
                            + CatalogSkuFactsSql
                                    .CATALOG_SKU_FACTS_BASE_MEASURE_UNIT_OVERRIDE_REF_UPDATED_AT_EPOCH_MILLIS
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUES_SET_PRODUCT_SKU_REF
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SKU_CODE_SKU_NAME
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_STANDARD_SALE_PRICE_IS_DEFAULT_STATUS
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_STATUS_DISPLAY_ORDER_VARIANT_COMBINATION_DIGEST
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VARIANT_COMBINATION_DIGEST
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_SALES_UNIT_OVERRIDE_REF_ALTERNATE_A
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_BASE_MEASURE_UNIT_OVERRIDE_REF
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_UPDATE_UPDATED_AT_EPOCH_MILLIS
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VERSION_CATALOG_SKU
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_WHERE_CATALOG_SKU_ITEM_REF_STATUS
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VOIDED,
                    skuRows);
            for (int value : changed)
                if (value != 1 && value != java.sql.Statement.SUCCESS_NO_INFO)
                    throw new CatalogOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            422,
                            "productSkuRef belongs to another item in this owner scope");
        } catch (DuplicateKeyException failure) {
            if (isVariantCombinationConflict(failure))
                throw new CatalogOwnerApi.Problem(
                        "DUPLICATE_VARIANT_COMBINATION",
                        409,
                        "active SKU variant combinations must be unique within an item",
                        failure);
            throw failure;
        }
        String placeholders = String.join(
                CatalogSkuFactsSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(parsed.size(), CatalogSkuFactsSql.PARAMETER_PLACEHOLDER));
        List<Object> skuRefs = parsed.stream()
                .map(CopySku::skuRef)
                .map(value -> (Object) value)
                .toList();
        jdbc.update(
                CatalogSkuFactsSql.CATALOG_SKU_FACTS_DELETE_CATALOG_SKU_ATTRIBUTE_VALUE_PRODUCT_SKU_REF
                        + placeholders
                        + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CLOSE_PAREN_ALTERNATE_A,
                skuRefs.toArray());
        if (!attributeRows.isEmpty())
            jdbc.batchUpdate(
                    CatalogSkuFactsSql.CATALOG_SKU_FACTS_INSERT_INTO_ALTERNATE_A
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUES,
                    attributeRows);
    }

    /**
     * Inserts SKU facts for freshly-created copy targets. Copy targets have no existing child rows, so the
     * update-oriented replace path is deliberately not reused here; both tables are written with one owner-local batch.
     */
    public void insertForCopy(Map<UUID, ArrayNode> skusByItem) {
        List<CopySku> parsed = new ArrayList<>();
        if (skusByItem != null)
            for (Map.Entry<UUID, ArrayNode> entry : skusByItem.entrySet()) {
                if (entry.getValue() == null) continue;
                for (JsonNode node : entry.getValue()) parsed.add(parseCopySku(entry.getKey(), node));
            }
        if (parsed.isEmpty()) return;
        List<Object[]> skuRows = new ArrayList<>();
        List<Object[]> attributeRows = new ArrayList<>();
        for (CopySku sku : parsed) {
            skuRows.add(new Object[] {
                sku.skuRef(),
                sku.itemRef(),
                sku.skuCode(),
                sku.skuName(),
                sku.price(),
                sku.defaultSku(),
                sku.status(),
                sku.displayOrder(),
                sku.digest(),
                time.currentEpochMillis()
            });
            for (AttributeValue value : sku.attributes())
                attributeRows.add(new Object[] {sku.skuRef(), value.attributeRef(), value.valueRef()});
        }
        try {
            jdbc.batchUpdate(
                    CatalogSkuFactsSql.CATALOG_SKU_FACTS_INSERT_INTO_ALTERNATE_B
                            + CatalogSkuFactsSql.CAT_SKU_PRODUCT_SKU_REF_006
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUES_ALTERNATE_A
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_JOIN_CONDITION_PRODUCT_SKU_REF,
                    skuRows);
        } catch (DuplicateKeyException failure) {
            if (isVariantCombinationConflict(failure))
                throw new CatalogOwnerApi.Problem(
                        "DUPLICATE_VARIANT_COMBINATION",
                        409,
                        "active SKU variant combinations must be unique within an item",
                        failure);
            throw failure;
        }
        if (!attributeRows.isEmpty())
            jdbc.batchUpdate(
                    CatalogSkuFactsSql.CATALOG_SKU_FACTS_INSERT_INTO_ALTERNATE_C
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_CATALOG_SKU_ATTRIBUTE_VALUE_ALTERNATE_A
                            + CatalogSkuFactsSql.CATALOG_SKU_FACTS_VALUES_ALTERNATE_B,
                    attributeRows);
        for (CopySku sku : parsed)
            jdbc.update(
                    CatalogSkuFactsSql.UPDATE_CAT_SKU_SALES_UNIT_004 + CatalogSkuFactsSql.UPDATED_AT_EPOCH_MS_WHERE_007,
                    sku.salesUnitOverrideRef(),
                    sku.baseMeasureUnitOverrideRef(),
                    time.currentEpochMillis(),
                    sku.skuRef());
    }

    private static CopySku parseCopySku(UUID itemRef, JsonNode node) {
        if (!node.isObject()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skus must contain objects");
        UUID skuRef = uuid(node, "productSkuRef");
        String skuCode = required(node, "skuCode");
        String skuName = required(node, "skuName");
        String status = node.path("status").asText("ENABLED");
        if ("VOIDED".equals(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "VOIDED SKU must use skuTransitions");
        if (!CatalogInventoryShapeManifest.accepts("skuStatus", status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "SKU status is not supported");
        int displayOrder = node.path("displayOrder").asInt(0);
        if (displayOrder < 0)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "SKU displayOrder must not be negative");
        String digest = required(node, "variantCombinationDigest");
        Long price = node.path("standardSalePrice").isIntegralNumber()
                ? node.path("standardSalePrice").asLong()
                : null;
        if (node.has("skuBarcode"))
            // spotless:off
            throw new CatalogOwnerApi.Problem(
                "VALIDATION_ERROR",
                422,
                "skuBarcode " + "已退役，请使用规格识别信息"
            );
            // spotless:on
        UUID salesUnitOverrideRef = optionalUuid(node, "salesUnitOverrideRef");
        UUID baseMeasureUnitOverrideRef = optionalUuid(node, "baseMeasureUnitOverrideRef");
        List<AttributeValue> attributes = new ArrayList<>();
        Set<UUID> attributeRefs = new LinkedHashSet<>();
        if (node.path("attributeValueRefs").isArray())
            for (JsonNode value : node.path("attributeValueRefs")) {
                UUID attributeRef = uuid(value, "attributeRef");
                if (!attributeRefs.add(attributeRef))
                    throw new CatalogOwnerApi.Problem(
                            "VALIDATION_ERROR", 422, "a SKU can contain only one value for each attribute");
                attributes.add(new AttributeValue(attributeRef, uuid(value, "attributeValueRef")));
            }
        return new CopySku(
                itemRef,
                skuRef,
                skuCode,
                skuName,
                price,
                node.path("isDefault").asBoolean(false),
                status,
                displayOrder,
                digest,
                salesUnitOverrideRef,
                baseMeasureUnitOverrideRef,
                List.copyOf(attributes));
    }

    private ObjectNode skuNode(java.sql.ResultSet result) throws java.sql.SQLException {
        ObjectNode sku = mapper.createObjectNode();
        sku.put("productSkuRef", result.getObject(2, UUID.class).toString());
        sku.put("skuCode", result.getString(3));
        sku.put("skuName", result.getString(4));
        if (result.getObject(5) == null) sku.putNull("standardSalePrice");
        else sku.put("standardSalePrice", result.getLong(5));
        sku.put("isDefault", result.getBoolean(6));
        sku.put("status", result.getString(7));
        sku.put("version", result.getLong(8));
        sku.put("updatedAt", result.getLong(33));
        sku.put("displayOrder", result.getInt(9));
        sku.put("variantCombinationDigest", result.getString(10));
        if (result.getObject(11, UUID.class) == null) sku.putNull("salesUnitOverrideRef");
        else sku.put("salesUnitOverrideRef", result.getObject(11, UUID.class).toString());
        if (result.getObject(12, UUID.class) == null) sku.putNull("baseMeasureUnitOverrideRef");
        else
            sku.put(
                    "baseMeasureUnitOverrideRef",
                    result.getObject(12, UUID.class).toString());
        putUnitSnapshot(sku, "salesUnitSnapshot", result, 13, 14, 15, 16, 17);
        putUnitSnapshot(sku, "baseMeasureUnitSnapshot", result, 18, 19, 20, 21, 22);
        ArrayNode mediaRefs = sku.putArray("mediaRefs");
        String media = result.getString(31);
        if (media != null && !media.isBlank()) for (String assetRef : media.split(",")) mediaRefs.add(assetRef);
        String storedPreparationOverride = result.getString(32);
        if (storedPreparationOverride != null && !storedPreparationOverride.isBlank()) {
            try {
                sku.set("_storedPreparationOverride", mapper.readTree(storedPreparationOverride));
            } catch (com.fasterxml.jackson.core.JsonProcessingException failure) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "规格制作设置读取失败", failure);
            }
        }
        sku.putArray("attributeValueRefs");
        return sku;
    }

    private void putUnitSnapshot(
            ObjectNode target,
            String field,
            java.sql.ResultSet result,
            int refIndex,
            int codeIndex,
            int nameIndex,
            int dimensionIndex,
            int precisionIndex)
            throws java.sql.SQLException {
        UUID ref = result.getObject(refIndex, UUID.class);
        if (ref == null) {
            target.putNull(field);
            return;
        }
        target.putObject(field)
                .put("unitRef", ref.toString())
                .put("code", result.getString(codeIndex))
                .put("name", result.getString(nameIndex))
                .put("unitDimension", result.getString(dimensionIndex))
                .put("precision", result.getInt(precisionIndex));
    }

    private static boolean isVariantCombinationConflict(DuplicateKeyException failure) {
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current instanceof PSQLException postgres
                    && postgres.getServerErrorMessage() != null
                    && VARIANT_COMBINATION_CONSTRAINT.equals(
                            postgres.getServerErrorMessage().getConstraint())) return true;
        }
        return false;
    }

    private static UUID uuid(JsonNode node, String field) {
        try {
            return UUID.fromString(required(node, field));
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be UUID", failure);
        }
    }

    private static String required(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    public record LifecycleRow(UUID skuRef, String skuCode, String status, long version) {}

    private record CopySku(
            UUID itemRef,
            UUID skuRef,
            String skuCode,
            String skuName,
            Long price,
            boolean defaultSku,
            String status,
            int displayOrder,
            String digest,
            UUID salesUnitOverrideRef,
            UUID baseMeasureUnitOverrideRef,
            List<AttributeValue> attributes) {}

    private static UUID optionalUuid(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || value.asText().isBlank()) return null;
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, field + " must be an opaque UUID ref", failure);
        }
    }

    private record AttributeValue(UUID attributeRef, UUID valueRef) {}
}
