package com.catering.v2s.catalog.application;

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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Catalog-owned identifier relation facts.  The relation is the only persisted identity source; the JSON
 * request/readback shapes are projections around this class and never become a second write authority.
 */
final class CatalogIdentifierFacts {
    private static final Set<String> TYPES = Set.of("BARCODE", "PLU", "MNEMONIC");
    private static final Set<String> SAVE_FIELDS = Set.of("identifierType", "identifierValue");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogIdentifierFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Validates the complete submitted payload before the caller's parent CAS write. */
    void validatePayload(ArrayNode itemIdentifiers, Map<UUID, ArrayNode> skuIdentifiers) {
        List<IdentifierRow> rows = new ArrayList<>();
        rows.addAll(parse(null, "CATALOG_ITEM", null, itemIdentifiers));
        if (skuIdentifiers != null)
            for (Map.Entry<UUID, ArrayNode> entry : skuIdentifiers.entrySet())
                rows.addAll(parse(null, "SKU", entry.getKey(), entry.getValue()));
        ensureRequestUnique(rows);
    }

    Map<UUID, ItemReadback> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = distinct(itemRefs);
        String placeholders = placeholders(refs.size());
        Map<UUID, ArrayNode> itemIdentifiers = new LinkedHashMap<>();
        Map<UUID, Map<UUID, ArrayNode>> skuIdentifiers = new LinkedHashMap<>();
        refs.forEach(ref -> {
            itemIdentifiers.put(ref, mapper.createArrayNode());
            skuIdentifiers.put(ref, new LinkedHashMap<>());
        });
        jdbc.query(
                "SELECT identifier_ref,item_ref,product_sku_ref,identifier_type,identifier_value,"
                        + "normalized_value,display_order FROM catalog.product_identifier WHERE item_ref IN ("
                        + placeholders
                        + ") ORDER BY item_ref,product_sku_ref NULLS FIRST,display_order,identifier_ref",
                statement -> bind(statement, refs),
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(2, UUID.class);
                        UUID skuRef = rows.getObject(3, UUID.class);
                        ObjectNode value = mapper.createObjectNode()
                                .put("identifierRef", rows.getObject(1, UUID.class).toString())
                                .put("ownerType", skuRef == null ? "CATALOG_ITEM" : "SKU")
                                .put("ownerRef", (skuRef == null ? itemRef : skuRef).toString())
                                .put("identifierType", rows.getString(4))
                                .put("identifierValue", rows.getString(5))
                                .put("normalizedValue", rows.getString(6))
                                .put("displayOrder", rows.getInt(7));
                        if (skuRef == null) itemIdentifiers.get(itemRef).add(value);
                        else
                            skuIdentifiers
                                    .get(itemRef)
                                    .computeIfAbsent(skuRef, ignored -> mapper.createArrayNode())
                                    .add(value);
                    }
                    return null;
                });
        Map<UUID, ItemReadback> result = new LinkedHashMap<>();
        refs.forEach(itemRef -> result.put(
                itemRef,
                new ItemReadback(itemIdentifiers.get(itemRef), skuIdentifiers.get(itemRef))));
        return Map.copyOf(result);
    }

    /** Replaces all item and SKU identifier rows in the caller's existing catalog transaction. */
    ItemReadback replace(
            String dataNodeRef,
            String brandRef,
            UUID itemRef,
            ArrayNode itemIdentifiers,
            Map<UUID, ArrayNode> skuIdentifiers) {
        List<IdentifierRow> rows = new ArrayList<>();
        rows.addAll(parse(itemRef, "CATALOG_ITEM", itemRef, itemIdentifiers));
        Map<UUID, ArrayNode> submittedSkuIdentifiers = skuIdentifiers == null ? Map.of() : skuIdentifiers;
        List<UUID> skuRefs = new ArrayList<>(submittedSkuIdentifiers.keySet());
        validateSkuOwnership(itemRef, skuRefs);
        for (Map.Entry<UUID, ArrayNode> entry : submittedSkuIdentifiers.entrySet())
            rows.addAll(parse(itemRef, "SKU", entry.getKey(), entry.getValue()));
        ensureRequestUnique(rows);

        jdbc.update("DELETE FROM catalog.product_identifier WHERE item_ref=?", itemRef);
        ItemReadback readback = readback(itemRef, rows);
        if (rows.isEmpty()) return readback;
        List<Object[]> values = new ArrayList<>();
        for (IdentifierRow row : rows)
            values.add(new Object[] {
                deterministicRef(itemRef, row.ownerType(), row.ownerRef(), row.displayOrder(), row.identifierType(), row.normalizedValue()),
                dataNodeRef,
                brandRef,
                itemRef,
                "SKU".equals(row.ownerType()) ? row.ownerRef() : null,
                row.identifierType(),
                row.identifierValue(),
                row.normalizedValue(),
                row.displayOrder()
            });
        try {
            jdbc.batchUpdate(
                    "INSERT INTO catalog.product_identifier(identifier_ref,data_node_ref,brand_ref,item_ref,"
                            + "product_sku_ref,identifier_type,identifier_value,normalized_value,display_order) "
                            + "VALUES(?,?,?,?,?,?,?,?,?)",
                    values);
        } catch (DuplicateKeyException failure) {
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_IDENTIFIER_DUPLICATE", 409, "商品编码或助记码已在当前经营范围内使用", failure);
        }
        return readback;
    }

    void copyWithinScope(
            String targetDataNodeRef,
            String targetBrandRef,
            UUID sourceItemRef,
            UUID targetItemRef,
            Map<UUID, UUID> skuRefMapping) {
        ItemReadback source = readByItemRefs(List.of(sourceItemRef)).get(sourceItemRef);
        if (source == null) return;
        ArrayNode itemValues = mapper.createArrayNode();
        source.itemIdentifiers().forEach(value -> itemValues.add(saveValue(value)));
        Map<UUID, ArrayNode> skuValues = new LinkedHashMap<>();
        source.skuIdentifiers().forEach((sourceSkuRef, values) -> {
            UUID targetSkuRef = skuRefMapping.get(sourceSkuRef);
            if (targetSkuRef == null)
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "复制规格识别信息未完成映射");
            ArrayNode copied = mapper.createArrayNode();
            values.forEach(value -> copied.add(saveValue(value)));
            skuValues.put(targetSkuRef, copied);
        });
        replace(targetDataNodeRef, targetBrandRef, targetItemRef, itemValues, skuValues);
    }

    private ObjectNode saveValue(JsonNode readback) {
        return mapper.createObjectNode()
                .put("identifierType", readback.path("identifierType").asText())
                .put("identifierValue", readback.path("identifierValue").asText());
    }

    private ItemReadback readback(UUID itemRef, Collection<IdentifierRow> rows) {
        ArrayNode itemValues = mapper.createArrayNode();
        Map<UUID, ArrayNode> skuValues = new LinkedHashMap<>();
        for (IdentifierRow row : rows) {
            UUID identifierRef = deterministicRef(
                    itemRef,
                    row.ownerType(),
                    row.ownerRef(),
                    row.displayOrder(),
                    row.identifierType(),
                    row.normalizedValue());
            ObjectNode value = mapper.createObjectNode()
                    .put("identifierRef", identifierRef.toString())
                    .put("ownerType", row.ownerType())
                    .put("ownerRef", row.ownerRef().toString())
                    .put("identifierType", row.identifierType())
                    .put("identifierValue", row.identifierValue())
                    .put("normalizedValue", row.normalizedValue())
                    .put("displayOrder", row.displayOrder());
            if ("CATALOG_ITEM".equals(row.ownerType())) itemValues.add(value);
            else skuValues.computeIfAbsent(row.ownerRef(), ignored -> mapper.createArrayNode()).add(value);
        }
        return new ItemReadback(itemValues, skuValues);
    }

    private List<IdentifierRow> parse(UUID itemRef, String ownerType, UUID ownerRef, ArrayNode values) {
        if (values == null) return List.of();
        List<IdentifierRow> result = new ArrayList<>();
        int displayOrder = 0;
        for (JsonNode value : values) {
            if (value == null || !value.isObject())
                throw problem("CATALOG_IDENTIFIER_VALUE_INVALID", "识别信息必须是对象");
            for (String field : iterable(value.fieldNames()))
                if (!SAVE_FIELDS.contains(field))
                    throw problem("CATALOG_IDENTIFIER_VALUE_INVALID", "识别信息包含不支持的字段");
            String type = value.path("identifierType").asText("");
            String raw = value.path("identifierValue").isTextual()
                    ? value.path("identifierValue").asText()
                    : "";
            if (!TYPES.contains(type))
                throw problem("CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED", "识别信息类型不支持");
            String identifierValue = raw.trim();
            if (identifierValue.isEmpty()
                    || identifierValue.length() > 160
                    || identifierValue.chars().anyMatch(Character::isISOControl))
                throw problem("CATALOG_IDENTIFIER_VALUE_INVALID", "识别信息不能为空，且长度不能超过160个字符");
            String normalized = "MNEMONIC".equals(type)
                    ? identifierValue.toLowerCase(Locale.ROOT)
                    : identifierValue;
            result.add(new IdentifierRow(ownerType, ownerRef, type, identifierValue, normalized, displayOrder++));
        }
        return List.copyOf(result);
    }

    private void validateSkuOwnership(UUID itemRef, Collection<UUID> skuRefs) {
        if (skuRefs.isEmpty()) return;
        List<UUID> refs = distinct(skuRefs);
        List<UUID> owned = jdbc.query(
                "SELECT product_sku_ref FROM catalog.catalog_sku WHERE item_ref=? AND product_sku_ref IN ("
                        + placeholders(refs.size())
                        + ")",
                (rows, row) -> rows.getObject(1, UUID.class),
                bindArgs(itemRef, refs));
        if (owned.size() != refs.size())
            throw problem("CATALOG_IDENTIFIER_OWNER_MISMATCH", "规格识别信息不属于当前商品");
    }

    private static void ensureRequestUnique(Collection<IdentifierRow> rows) {
        Set<String> keys = new LinkedHashSet<>();
        for (IdentifierRow row : rows) {
            String key = row.identifierType() + "\u0000" + row.normalizedValue();
            if (!keys.add(key)) throw problem("CATALOG_IDENTIFIER_DUPLICATE", "同一商品不能重复填写相同识别信息");
        }
    }

    static UUID deterministicRef(
            UUID itemRef, String ownerType, UUID ownerRef, int displayOrder, String type, String normalized) {
        return UUID.nameUUIDFromBytes(("CIPG:identifier:"
                        + itemRef
                        + ":"
                        + ownerType
                        + ":"
                        + ownerRef
                        + ":"
                        + displayOrder
                        + ":"
                        + type
                        + ":"
                        + normalized)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static CatalogOwnerApi.Problem problem(String code, String detail) {
        return new CatalogOwnerApi.Problem(code, 422, detail);
    }

    private static List<UUID> distinct(Collection<UUID> values) {
        return List.copyOf(new LinkedHashSet<>(values));
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static void bind(java.sql.PreparedStatement statement, List<UUID> refs) throws java.sql.SQLException {
        for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
    }

    private static Object[] bindArgs(UUID itemRef, List<UUID> refs) {
        List<Object> args = new ArrayList<>();
        args.add(itemRef);
        args.addAll(refs);
        return args.toArray();
    }

    private static Iterable<String> iterable(java.util.Iterator<String> iterator) {
        return () -> iterator;
    }

    record ItemReadback(ArrayNode itemIdentifiers, Map<UUID, ArrayNode> skuIdentifiers) {
        ItemReadback {
            skuIdentifiers = skuIdentifiers == null ? Map.of() : Map.copyOf(skuIdentifiers);
        }
    }

    private record IdentifierRow(
            String ownerType,
            UUID ownerRef,
            String identifierType,
            String identifierValue,
            String normalizedValue,
            int displayOrder) {}
}
