package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Catalog item category membership is relational; JSON is only reconstructed for the owner read shape. */
final class CatalogItemCategoryFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogItemCategoryFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, mapper.createArrayNode()));
        jdbc.query(
                "SELECT item_ref,category_ref FROM catalog.catalog_item_category WHERE item_ref IN (" + placeholders
                        + ") ORDER BY item_ref,category_ref",
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                rows -> {
                    while (rows.next())
                        result.get(rows.getObject(1, UUID.class))
                                .add(rows.getObject(2, UUID.class).toString());
                    return null;
                });
        return Map.copyOf(result);
    }

    /** Reads the candidate-facing category refs and labels in one scoped set-read. */
    Map<UUID, SalesMenuCategoryFacts> readSalesMenuByItemRefs(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, List<UUID>> categoryRefsByItem = new LinkedHashMap<>();
        Map<UUID, List<String>> categoryNamesByItem = new LinkedHashMap<>();
        refs.forEach(ref -> {
            categoryRefsByItem.put(ref, new ArrayList<>());
            categoryNamesByItem.put(ref, new ArrayList<>());
        });
        jdbc.query(
                "SELECT relation.item_ref,relation.category_ref,category.name "
                        + "FROM catalog.catalog_item_category relation "
                        + "JOIN catalog.catalog_category category ON category.category_ref=relation.category_ref "
                        + "AND category.data_node_ref=? AND category.brand_ref=? "
                        + "AND category.status <> 'VOIDED' WHERE relation.item_ref IN ("
                        + placeholders + ") ORDER BY relation.item_ref,relation.category_ref",
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 3, refs.get(index));
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        if (!categoryRefsByItem.containsKey(itemRef)) continue;
                        categoryRefsByItem.get(itemRef).add(rows.getObject(2, UUID.class));
                        String name = rows.getString(3);
                        if (name != null && !name.isBlank())
                            categoryNamesByItem.get(itemRef).add(name);
                    }
                    return null;
                });
        Map<UUID, SalesMenuCategoryFacts> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(
                ref,
                new SalesMenuCategoryFacts(
                        List.copyOf(categoryRefsByItem.get(ref)), List.copyOf(categoryNamesByItem.get(ref)))));
        return Map.copyOf(result);
    }

    void replace(UUID itemRef, ArrayNode categoryRefs) {
        List<UUID> normalized = normalize(categoryRefs);
        jdbc.update("DELETE FROM catalog.catalog_item_category WHERE item_ref=?", itemRef);
        if (!normalized.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES(?,?)",
                    normalized.stream()
                            .map(categoryRef -> new Object[] {itemRef, categoryRef})
                            .toList());
    }

    /** Inserts facts for freshly-created copy targets in one owner-local JDBC batch. */
    void insertForCopy(Map<UUID, ArrayNode> categoryRefsByItem) {
        List<Object[]> rows = new ArrayList<>();
        if (categoryRefsByItem != null)
            for (Map.Entry<UUID, ArrayNode> entry : categoryRefsByItem.entrySet()) {
                for (UUID categoryRef : normalize(entry.getValue()))
                    rows.add(new Object[] {entry.getKey(), categoryRef});
            }
        if (!rows.isEmpty())
            jdbc.batchUpdate("INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES(?,?)", rows);
    }

    private static List<UUID> normalize(ArrayNode categoryRefs) {
        if (categoryRefs == null) return List.of();
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (var value : categoryRefs) {
            if (!value.isTextual())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs must contain UUID refs");
            try {
                if (!refs.add(UUID.fromString(value.asText()))) {
                    throw new CatalogOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs cannot contain duplicates");
                }
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs cannot contain a business code", failure);
            }
        }
        if (refs.size() > 1)
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "商品最多只能选择一个分类");
        return List.copyOf(refs);
    }

    record SalesMenuCategoryFacts(List<UUID> categoryRefs, List<String> categoryNames) {
        SalesMenuCategoryFacts {
            categoryRefs = List.copyOf(categoryRefs);
            categoryNames = List.copyOf(categoryNames);
        }
    }
}
