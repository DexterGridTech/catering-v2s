package com.catering.v2s.catalog.application.persistence;

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
public class CatalogItemCategoryFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogItemCategoryFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogItemCategoryFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemCategoryFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, ArrayNode> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, mapper.createArrayNode()));
        jdbc.query(
                CatalogItemCategoryFactsSql
                                .CATALOG_ITEM_CATEGORY_FACTS_SELECT_CATALOG_ITEM_CATEGORY_ITEM_REF_CATEGORY_REF
                        + placeholders
                        + CatalogItemCategoryFactsSql.CATALOG_ITEM_CATEGORY_FACTS_CLOSE_PAREN_ITEM_REF_CATEGORY_REF,
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
    public Map<UUID, SalesMenuCategoryFacts> readSalesMenuByItemRefs(
            String dataNodeRef, String brandRef, Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogItemCategoryFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemCategoryFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, List<UUID>> categoryRefsByItem = new LinkedHashMap<>();
        Map<UUID, List<String>> categoryNamesByItem = new LinkedHashMap<>();
        refs.forEach(ref -> {
            categoryRefsByItem.put(ref, new ArrayList<>());
            categoryNamesByItem.put(ref, new ArrayList<>());
        });
        jdbc.query(
                CatalogItemCategoryFactsSql.CATALOG_ITEM_CATEGORY_FACTS_SELECT_RELATION_ITEM_REF_CATEGORY_REF_CATEGORY
                        + CatalogItemCategoryFactsSql
                                .CATALOG_ITEM_CATEGORY_FACTS_FROM_CLAUSE_CATALOG_ITEM_CATEGORY_RELATION
                        + CatalogItemCategoryFactsSql
                                .CATALOG_ITEM_CATEGORY_FACTS_JOIN_CATALOG_CATEGORY_CATEGORY_CATEGORY_REF_RELATION
                        + CatalogItemCategoryFactsSql
                                .CATALOG_ITEM_CATEGORY_FACTS_CONDITION_CATEGORY_DATA_NODE_REF_BRAND_REF
                        + CatalogItemCategoryFactsSql
                                .CATALOG_ITEM_CATEGORY_FACTS_CONDITION_CATEGORY_STATUS_VOIDED_RELATION
                        + placeholders
                        + CatalogItemCategoryFactsSql
                                .CATALOG_ITEM_CATEGORY_FACTS_CLOSE_PAREN_RELATION_ITEM_REF_CATEGORY_REF,
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

    public void replace(UUID itemRef, ArrayNode categoryRefs) {
        List<UUID> normalized = normalize(categoryRefs);
        jdbc.update(
                CatalogItemCategoryFactsSql.CATALOG_ITEM_CATEGORY_FACTS_DELETE_CATALOG_ITEM_CATEGORY_ITEM_REF, itemRef);
        if (!normalized.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemCategoryFactsSql
                            .CATALOG_ITEM_CATEGORY_FACTS_INSERT_INTO_CATALOG_ITEM_CATEGORY_ITEM_REF_CATEGORY_REF,
                    normalized.stream()
                            .map(categoryRef -> new Object[] {itemRef, categoryRef})
                            .toList());
    }

    /** Inserts facts for freshly-created copy targets in one owner-local JDBC batch. */
    public void insertForCopy(Map<UUID, ArrayNode> categoryRefsByItem) {
        List<Object[]> rows = new ArrayList<>();
        if (categoryRefsByItem != null)
            for (Map.Entry<UUID, ArrayNode> entry : categoryRefsByItem.entrySet()) {
                for (UUID categoryRef : normalize(entry.getValue()))
                    rows.add(new Object[] {entry.getKey(), categoryRef});
            }
        if (!rows.isEmpty())
            jdbc.batchUpdate(
                    CatalogItemCategoryFactsSql
                            .CATALOG_ITEM_CATEGORY_FACTS_INSERT_INTO_CATALOG_ITEM_CATEGORY_ITEM_REF_CATEGORY_REF_ALTERNATE_A,
                    rows);
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

    public record SalesMenuCategoryFacts(List<UUID> categoryRefs, List<String> categoryNames) {
        public SalesMenuCategoryFacts {
            categoryRefs = List.copyOf(categoryRefs);
            categoryNames = List.copyOf(categoryNames);
        }
    }
}
