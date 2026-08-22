package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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

/** Ordered item images are an item-owned fact. The first persisted row is the primary image. */
final class CatalogItemMediaFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogItemMediaFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
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
                "SELECT item_ref,asset_ref FROM catalog.catalog_item_image WHERE item_ref IN (" + placeholders
                        + ") ORDER BY item_ref,display_order,asset_ref",
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

    void replace(UUID itemRef, JsonNode submitted) {
        List<UUID> assets = normalize(submitted, "images");
        validateCount(assets.size(), "images");
        jdbc.update("DELETE FROM catalog.catalog_item_image WHERE item_ref=?", itemRef);
        if (!assets.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO catalog.catalog_item_image(item_ref,asset_ref,display_order) VALUES(?,?,?)",
                    assets.stream()
                            .map(assetRef -> new Object[] {itemRef, assetRef, assets.indexOf(assetRef)})
                            .toList());
    }

    /** Inserts facts for freshly-created copy targets in one owner-local JDBC batch. */
    void insertForCopy(Map<UUID, JsonNode> imagesByItem) {
        List<Object[]> rows = new ArrayList<>();
        if (imagesByItem != null)
            for (Map.Entry<UUID, JsonNode> entry : imagesByItem.entrySet()) {
                List<UUID> assets = normalize(entry.getValue(), "images");
                validateCount(assets.size(), "images");
                for (int order = 0; order < assets.size(); order++)
                    rows.add(new Object[] {entry.getKey(), assets.get(order), order});
            }
        if (!rows.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO catalog.catalog_item_image(item_ref,asset_ref,display_order) VALUES(?,?,?)", rows);
    }

    boolean referenced(String dataNodeRef, String brandRef, UUID assetRef) {
        String scope = dataNodeRef == null ? "" : " AND item.data_node_ref=? AND item.brand_ref=?";
        List<Object> arguments = new ArrayList<>();
        arguments.add(assetRef);
        if (dataNodeRef != null) {
            arguments.add(dataNodeRef);
            arguments.add(brandRef);
        }
        Boolean found = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.catalog_item_image image JOIN catalog.catalog_item item ON "
                        + "item.item_ref=image.item_ref WHERE image.asset_ref=? AND item.status <> 'VOIDED'"
                        + scope + ")",
                Boolean.class,
                arguments.toArray());
        return Boolean.TRUE.equals(found);
    }

    Set<UUID> referencedRefs(String dataNodeRef, String brandRef, Collection<UUID> assetRefs) {
        if (assetRefs == null || assetRefs.isEmpty()) return Set.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(assetRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        String scope = dataNodeRef == null ? "" : " AND item.data_node_ref=? AND item.brand_ref=?";
        List<Object> arguments = new ArrayList<>(refs);
        if (dataNodeRef != null) {
            arguments.add(dataNodeRef);
            arguments.add(brandRef);
        }
        return Set.copyOf(jdbc.query(
                "SELECT DISTINCT image.asset_ref FROM catalog.catalog_item_image image JOIN catalog.catalog_item item "
                        + "ON item.item_ref=image.item_ref WHERE image.asset_ref IN ("
                        + placeholders + ") AND item.status <> 'VOIDED'" + scope,
                (rows, row) -> rows.getObject(1, UUID.class),
                arguments.toArray()));
    }

    private static List<UUID> normalize(JsonNode submitted, String field) {
        if (submitted == null || submitted.isMissingNode() || submitted.isNull()) return List.of();
        if (!submitted.isArray()) throw problem(field + " must be an array of UUID refs");
        List<UUID> assets = new ArrayList<>();
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>();
        for (JsonNode value : submitted) {
            String text =
                    value.isTextual() ? value.asText() : value.path("assetRef").asText("");
            UUID assetRef;
            try {
                assetRef = UUID.fromString(text);
            } catch (IllegalArgumentException failure) {
                throw problem(field + " must contain UUID asset refs", failure);
            }
            if (!distinct.add(assetRef)) throw problem(field + " cannot contain the same asset more than once");
            assets.add(assetRef);
        }
        return List.copyOf(assets);
    }

    private static CatalogOwnerApi.Problem problem(String message) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
    }

    private static CatalogOwnerApi.Problem problem(String message, Throwable cause) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message, cause);
    }

    private static void validateCount(int count, String field) {
        if (count > CatalogInventoryShapeManifest.CATALOG_ITEM_IMAGE_MAX_COUNT) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    field + " cannot contain more than " + CatalogInventoryShapeManifest.CATALOG_ITEM_IMAGE_MAX_COUNT
                            + " images");
        }
    }
}
