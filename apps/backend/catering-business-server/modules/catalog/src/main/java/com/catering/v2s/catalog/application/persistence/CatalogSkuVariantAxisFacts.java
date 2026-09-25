package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
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
import org.springframework.jdbc.core.JdbcTemplate;

/** Per-item variant axes own both the selected dictionary values and their stable order. */
public class CatalogSkuVariantAxisFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogSkuVariantAxisFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogSkuVariantAxisFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogSkuVariantAxisFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        Map<UUID, ObjectNode> axes = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, mapper.createArrayNode()));
        jdbc.query(
                CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_SELECT
                        + CatalogSkuVariantAxisFactsSql
                                .CATALOG_SKU_VARIANT_AXIS_FACTS_AXIS_ITEM_REF_AXIS_SKU_VARIANT_AXIS_REF_AXIS_ATTRIBUTE_REF_ATTRIBUTE_CODE_ATTRIBUTE_NAME_CATALOG_DICTIONARY_ENTRY_ATTRIBUTE_ON
                        + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE
                        + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_VALUE
                        + CatalogSkuVariantAxisFactsSql
                                .CATALOG_SKU_VARIANT_AXIS_FACTS_JOIN_CONDITION_DICTIONARY_ENTRY_VALUE_SKU_VARIANT_AXIS_REF_AXIS
                        + CatalogSkuVariantAxisFactsSql
                                .CATALOG_SKU_VARIANT_AXIS_FACTS_VALUE_ENTRY_ENTRY_REF_VALUE_VALUE_REF
                        + placeholders
                        + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_CLOSE_PAREN_ORDER_BY
                        + CatalogSkuVariantAxisFactsSql
                                .CATALOG_SKU_VARIANT_AXIS_FACTS_AXIS_ITEM_REF_DISPLAY_ORDER_ATTRIBUTE_REF,
                statement -> {
                    for (int i = 0; i < refs.size(); i++) statement.setObject(i + 1, refs.get(i));
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class), axisRef = rows.getObject(2, UUID.class);
                        ObjectNode axis = axes.get(axisRef);
                        if (axis == null) {
                            axis = result.get(itemRef).addObject();
                            axis.put(
                                    "attributeRef",
                                    rows.getObject(3, UUID.class).toString());
                            axis.put("attributeCode", rows.getString(4));
                            axis.put("attributeName", rows.getString(5));
                            axis.put("displayOrder", rows.getInt(6));
                            axis.putArray("values");
                            axes.put(axisRef, axis);
                        }
                        UUID valueRef = rows.getObject(7, UUID.class);
                        if (valueRef != null) {
                            ObjectNode value = axis.withArray("values").addObject();
                            value.put("valueRef", valueRef.toString());
                            value.put("valueCode", rows.getString(8));
                            value.put("valueLabel", rows.getString(9));
                            value.put("status", rows.getString(10));
                            value.put("displayOrder", rows.getInt(11));
                        }
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    public void replace(UUID itemRef, ArrayNode submitted) {
        replace(itemRef, submitted, null);
    }

    public void replace(UUID itemRef, ArrayNode submitted, Map<UUID, ExistingAxis> preloadedExisting) {
        List<Axis> axes = normalize(submitted);
        Map<UUID, ExistingAxis> existing = preloadedExisting == null
                ? jdbc.query(
                        CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_SELECT_CATALOG_SKU_VARIANT_AXIS
                                + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_WHERE_ITEM_REF,
                        rows -> {
                            Map<UUID, ExistingAxis> result = new LinkedHashMap<>();
                            while (rows.next())
                                result.put(
                                        rows.getObject(1, UUID.class),
                                        new ExistingAxis(rows.getObject(2, UUID.class), rows.getInt(3), Set.of()));
                            return result;
                        },
                        itemRef)
                : preloadedExisting;
        boolean shift = axes.stream()
                .anyMatch(axis -> existing.entrySet().stream()
                                .anyMatch(entry -> entry.getValue().displayOrder() == axis.displayOrder()
                                        && !entry.getKey().equals(axis.attributeRef()))
                        || (existing.containsKey(axis.attributeRef())
                                && existing.get(axis.attributeRef()).displayOrder() != axis.displayOrder()));
        if (shift)
            jdbc.update(
                    CatalogSkuVariantAxisFactsSql
                            .CATALOG_SKU_VARIANT_AXIS_FACTS_UPDATE_CATALOG_SKU_VARIANT_AXIS_DISPLAY_ORDER_ITEM_REF,
                    itemRef);
        LinkedHashSet<UUID> retained = new LinkedHashSet<>();
        List<Object[]> axisInserts = new ArrayList<>();
        List<Object[]> axisUpdates = new ArrayList<>();
        List<Object[]> valueInserts = new ArrayList<>();
        for (Axis axis : axes) {
            retained.add(axis.attributeRef());
            boolean isNew = !existing.containsKey(axis.attributeRef());
            UUID axisRef = isNew
                    ? UUID.randomUUID()
                    : existing.get(axis.attributeRef()).ref();
            if (isNew) axisInserts.add(new Object[] {axisRef, itemRef, axis.attributeRef(), axis.displayOrder()});
            else axisUpdates.add(new Object[] {axis.displayOrder(), axisRef});
            for (Value value : axis.values())
                valueInserts.add(new Object[] {axisRef, value.ref(), value.displayOrder()});
        }
        List<UUID> retainedAxisRefs = axes.stream()
                .map(axis -> existing.get(axis.attributeRef()))
                .filter(java.util.Objects::nonNull)
                .map(ExistingAxis::ref)
                .toList();
        List<UUID> removedAxisRefs = existing.entrySet().stream()
                .filter(entry -> !retained.contains(entry.getKey()))
                .map(entry -> entry.getValue().ref())
                .toList();
        List<UUID> axisRefsRequiringValueDelete = new ArrayList<>(retainedAxisRefs);
        axisRefsRequiringValueDelete.addAll(removedAxisRefs);
        if (!axisRefsRequiringValueDelete.isEmpty())
            jdbc.update(
                    CatalogSkuVariantAxisFactsSql
                                    .CATALOG_SKU_VARIANT_AXIS_FACTS_DELETE_CATALOG_SKU_VARIANT_AXIS_VALUE_SKU_VARIANT_AXIS_REF
                            + placeholders(axisRefsRequiringValueDelete)
                            + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_CLOSE_PAREN,
                    axisRefsRequiringValueDelete.toArray());
        if (!removedAxisRefs.isEmpty())
            jdbc.update(
                    CatalogSkuVariantAxisFactsSql
                                    .CATALOG_SKU_VARIANT_AXIS_FACTS_DELETE_CATALOG_SKU_VARIANT_AXIS_SKU_VARIANT_AXIS_REF
                            + placeholders(removedAxisRefs)
                            + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_CLOSE_PAREN_ALTERNATE_A,
                    removedAxisRefs.toArray());
        if (!axisInserts.isEmpty())
            jdbc.batchUpdate(
                    CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO_CATALOG_SKU_VARIANT_AXIS
                            + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_DISPLAY_ORDER,
                    axisInserts);
        if (!axisUpdates.isEmpty())
            jdbc.batchUpdate(
                    CatalogSkuVariantAxisFactsSql
                            .CATALOG_SKU_VARIANT_AXIS_FACTS_UPDATE_CATALOG_SKU_VARIANT_AXIS_DISPLAY_ORDER_SKU_VARIANT_AXIS_REF,
                    axisUpdates);
        if (!valueInserts.isEmpty())
            jdbc.batchUpdate(
                    CatalogSkuVariantAxisFactsSql
                                    .CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO_CATALOG_SKU_VARIANT_AXIS_VALUE
                            + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_DISPLAY_ORDER_ALTERNATE_A,
                    valueInserts);
    }

    /** Inserts variant-axis facts for freshly-created copy targets in two owner-local batches. */
    public void insertForCopy(Map<UUID, ArrayNode> axesByItem) {
        List<CopyAxis> axes = new ArrayList<>();
        if (axesByItem != null)
            for (Map.Entry<UUID, ArrayNode> entry : axesByItem.entrySet()) {
                for (Axis axis : normalize(entry.getValue()))
                    axes.add(new CopyAxis(UUID.randomUUID(), entry.getKey(), axis));
            }
        if (axes.isEmpty()) return;
        List<Object[]> axisRows = new ArrayList<>();
        List<Object[]> valueRows = new ArrayList<>();
        for (CopyAxis copyAxis : axes) {
            Axis axis = copyAxis.axis();
            axisRows.add(new Object[] {copyAxis.ref(), copyAxis.itemRef(), axis.attributeRef(), axis.displayOrder()});
            for (Value value : axis.values())
                valueRows.add(new Object[] {copyAxis.ref(), value.ref(), value.displayOrder()});
        }
        jdbc.batchUpdate(
                CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO
                        + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS
                        + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_VALUES,
                axisRows);
        if (!valueRows.isEmpty())
            jdbc.batchUpdate(
                    CatalogSkuVariantAxisFactsSql
                                    .CATALOG_SKU_VARIANT_AXIS_FACTS_INSERT_INTO_CATALOG_SKU_VARIANT_AXIS_VALUE_ALTERNATE_A
                            + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_VALUES_ALTERNATE_A,
                    valueRows);
    }

    public Map<UUID, ExistingAxis> validateRetirements(UUID itemRef, ArrayNode submitted, ArrayNode candidateSkus) {
        List<Axis> next = normalize(submitted);
        Map<UUID, ExistingAxis> existing = jdbc.query(
                CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_SELECT_AXIS_ATTRIBUTE_REF_VALUE_VALUE_REF
                        + CatalogSkuVariantAxisFactsSql.CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS_AXIS
                        + CatalogSkuVariantAxisFactsSql
                                .CATALOG_SKU_VARIANT_AXIS_FACTS_CATALOG_SKU_VARIANT_AXIS_VALUE_VALUE
                        + CatalogSkuVariantAxisFactsSql
                                .CATALOG_SKU_VARIANT_AXIS_FACTS_VALUE_SKU_VARIANT_AXIS_REF_AXIS_ITEM_REF,
                rows -> {
                    Map<UUID, ExistingAxisBuilder> builders = new LinkedHashMap<>();
                    while (rows.next()) {
                        UUID attributeRef = rows.getObject(1, UUID.class);
                        UUID valueRef = rows.getObject(2, UUID.class);
                        UUID axisRef = rows.getObject(3, UUID.class);
                        int displayOrder = rows.getInt(4);
                        ExistingAxisBuilder builder = builders.computeIfAbsent(
                                attributeRef, ignored -> new ExistingAxisBuilder(axisRef, displayOrder));
                        if (valueRef != null) builder.values.add(valueRef);
                    }
                    Map<UUID, ExistingAxis> result = new LinkedHashMap<>();
                    builders.forEach((attributeRef, builder) -> result.put(
                            attributeRef,
                            new ExistingAxis(builder.ref, builder.displayOrder, Set.copyOf(builder.values))));
                    return result;
                },
                itemRef);
        Map<UUID, Set<UUID>> retainedValues = new LinkedHashMap<>();
        Set<UUID> retainedAttributes = new LinkedHashSet<>();
        for (Axis axis : next) {
            retainedAttributes.add(axis.attributeRef());
            retainedValues.put(
                    axis.attributeRef(),
                    axis.values().stream()
                            .map(Value::ref)
                            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        }
        Set<String> blocked = new LinkedHashSet<>();
        for (Map.Entry<UUID, ExistingAxis> existingAxis : existing.entrySet()) {
            boolean axisRemoved = !retainedAttributes.contains(existingAxis.getKey());
            Set<UUID> removedValues =
                    new LinkedHashSet<>(existingAxis.getValue().values());
            if (!axisRemoved) removedValues.removeAll(retainedValues.getOrDefault(existingAxis.getKey(), Set.of()));
            if (!axisRemoved && removedValues.isEmpty()) continue;
            if (candidateSkus == null) continue;
            for (JsonNode sku : candidateSkus) {
                if ("VOIDED".equals(sku.path("status").asText("ENABLED"))) continue;
                JsonNode refs = sku.path("attributeValueRefs");
                if (!refs.isArray()) continue;
                for (JsonNode ref : refs) {
                    UUID skuAttribute = parseUuid(ref.path("attributeRef").asText());
                    UUID skuValue = parseUuid(ref.path("attributeValueRef").asText());
                    if (existingAxis.getKey().equals(skuAttribute)
                            && (axisRemoved || removedValues.contains(skuValue))) {
                        blocked.add(sku.path("skuCode").asText("<unknown>") + "(" + existingAxis.getKey()
                                + (axisRemoved ? ":axis" : ":value") + ")");
                    }
                }
            }
        }
        if (!blocked.isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID", 422, "规格轴或值仍被 SKU 引用: " + String.join(", ", blocked));
        return existing;
    }

    private static List<Axis> normalize(ArrayNode submitted) {
        if (submitted == null) return List.of();
        List<Axis> result = new ArrayList<>();
        LinkedHashSet<UUID> attributes = new LinkedHashSet<>();
        LinkedHashSet<Integer> orders = new LinkedHashSet<>();
        int axisOrder = 0;
        for (JsonNode node : submitted) {
            UUID attribute = uuid(node, "attributeRef");
            if (!attributes.add(attribute)) throw problem("skuVariantDimensions cannot contain duplicate attributeRef");
            int order = node.has("displayOrder") ? node.path("displayOrder").asInt() : axisOrder;
            if (order < 0 || !orders.add(order))
                throw problem("skuVariantDimensions displayOrder must be unique and non-negative");
            List<Value> values = new ArrayList<>();
            LinkedHashSet<UUID> valueRefs = new LinkedHashSet<>();
            LinkedHashSet<Integer> valueOrders = new LinkedHashSet<>();
            int valueOrder = 0;
            JsonNode raw = node.path("values");
            if (raw.isArray())
                for (JsonNode value : raw) {
                    UUID ref = uuid(value, "valueRef");
                    int nestedOrder = value.has("displayOrder")
                            ? value.path("displayOrder").asInt()
                            : valueOrder;
                    if (nestedOrder < 0 || !valueRefs.add(ref) || !valueOrders.add(nestedOrder))
                        throw problem("axis values must have unique refs and displayOrder");
                    values.add(new Value(ref, nestedOrder));
                    valueOrder++;
                }
            result.add(new Axis(attribute, order, List.copyOf(values)));
            axisOrder++;
        }
        return List.copyOf(result);
    }

    private static UUID uuid(JsonNode node, String field) {
        try {
            return UUID.fromString(node.path(field).asText());
        } catch (Exception failure) {
            throw problem(field + " must be UUID", failure);
        }
    }

    private static UUID parseUuid(String value) {
        try {
            return value == null || value.isBlank() ? null : UUID.fromString(value);
        } catch (Exception failure) {
            return null;
        }
    }

    private static CatalogOwnerApi.Problem problem(String detail) {
        return new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, detail);
    }

    private static CatalogOwnerApi.Problem problem(String detail, Throwable cause) {
        return new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, detail, cause);
    }

    private static String placeholders(Collection<?> values) {
        return String.join(
                CatalogSkuVariantAxisFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(values.size(), CatalogSkuVariantAxisFactsSql.PARAMETER_PLACEHOLDER));
    }

    private static final class ExistingAxisBuilder {
        private final UUID ref;
        private final int displayOrder;
        private final Set<UUID> values = new LinkedHashSet<>();

        private ExistingAxisBuilder(UUID ref, int displayOrder) {
            this.ref = ref;
            this.displayOrder = displayOrder;
        }
    }

    public record ExistingAxis(UUID ref, int displayOrder, Set<UUID> values) {}

    private record Axis(UUID attributeRef, int displayOrder, List<Value> values) {}

    private record Value(UUID ref, int displayOrder) {}

    private record CopyAxis(UUID ref, UUID itemRef, Axis axis) {}
}
