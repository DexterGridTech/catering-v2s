package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
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

/** Ordered SKU media is owned by the SKU, never by an item-level polymorphic relation. */
final class CatalogSkuMediaFacts {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogSkuMediaFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    void replace(ArrayNode skus) {
        if (skus == null) return;
        List<Object[]> rows = new ArrayList<>();
        List<UUID> skuRefs = new ArrayList<>();
        for (JsonNode node : skus) {
            if (!node.isObject()) throw problem("skus must contain objects");
            UUID skuRef = uuid(node.path("productSkuRef"), "productSkuRef");
            skuRefs.add(skuRef);
            List<UUID> assets = normalize(node.path("mediaRefs"));
            validateCount(assets.size());
            for (int order = 0; order < assets.size(); order++) {
                rows.add(new Object[] {skuRef, assets.get(order), order});
            }
        }
        if (skuRefs.isEmpty()) return;
        String placeholders = String.join(",", Collections.nCopies(skuRefs.size(), "?"));
        jdbc.update(
                "DELETE FROM catalog.catalog_sku_media WHERE product_sku_ref IN (" + placeholders + ")",
                skuRefs.toArray());
        if (!rows.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO catalog.catalog_sku_media(product_sku_ref,asset_ref,display_order) VALUES(?,?,?)",
                    rows);
    }

    /** Inserts facts for freshly-created copy targets in one owner-local JDBC batch. */
    void insertForCopy(Map<UUID, ArrayNode> skusByItem) {
        List<Object[]> rows = new ArrayList<>();
        if (skusByItem != null)
            for (ArrayNode skus : skusByItem.values())
                for (JsonNode node : skus) {
                    if (!node.isObject()) throw problem("skus must contain objects");
                    UUID skuRef = uuid(node.path("productSkuRef"), "productSkuRef");
                    List<UUID> assets = normalize(node.path("mediaRefs"));
                    validateCount(assets.size());
                    for (int order = 0; order < assets.size(); order++)
                        rows.add(new Object[] {skuRef, assets.get(order), order});
                }
        if (!rows.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO catalog.catalog_sku_media(product_sku_ref,asset_ref,display_order) VALUES(?,?,?)",
                    rows);
    }

    void applyTo(Map<UUID, ArrayNode> skusByItem) {
        List<UUID> skuRefs = new ArrayList<>();
        for (ArrayNode skus : skusByItem.values())
            for (JsonNode sku : skus) skuRefs.add(uuid(sku.path("productSkuRef"), "productSkuRef"));
        if (skuRefs.isEmpty()) return;
        String placeholders = String.join(",", Collections.nCopies(skuRefs.size(), "?"));
        Map<UUID, ArrayNode> media = new LinkedHashMap<>();
        skuRefs.forEach(ref -> media.put(ref, mapper.createArrayNode()));
        jdbc.query(
                "SELECT product_sku_ref,asset_ref FROM catalog.catalog_sku_media WHERE product_sku_ref IN ("
                        + placeholders + ") ORDER BY product_sku_ref,display_order,asset_ref",
                statement -> {
                    for (int index = 0; index < skuRefs.size(); index++)
                        statement.setObject(index + 1, skuRefs.get(index));
                },
                rows -> {
                    while (rows.next())
                        media.get(rows.getObject(1, UUID.class))
                                .add(rows.getObject(2, UUID.class).toString());
                    return null;
                });
        for (ArrayNode skus : skusByItem.values())
            for (JsonNode sku : skus) {
                ObjectNode mutable = (ObjectNode) sku;
                UUID skuRef = uuid(sku.path("productSkuRef"), "productSkuRef");
                mutable.set("mediaRefs", media.getOrDefault(skuRef, mapper.createArrayNode()));
            }
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
                "SELECT EXISTS (SELECT 1 FROM catalog.catalog_sku_media media JOIN catalog.catalog_sku sku ON "
                        + "sku.product_sku_ref=media.product_sku_ref JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE media.asset_ref=? AND item.status <> 'VOIDED'"
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
                "SELECT DISTINCT media.asset_ref FROM catalog.catalog_sku_media media JOIN catalog.catalog_sku sku ON "
                        + "sku.product_sku_ref=media.product_sku_ref JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE media.asset_ref IN ("
                        + placeholders + ") AND item.status <> 'VOIDED'" + scope,
                (rows, row) -> rows.getObject(1, UUID.class),
                arguments.toArray()));
    }

    private static List<UUID> normalize(JsonNode submitted) {
        if (submitted == null || submitted.isMissingNode() || submitted.isNull()) return List.of();
        if (!submitted.isArray()) throw problem("mediaRefs must be an array of UUID refs");
        List<UUID> assets = new ArrayList<>();
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>();
        for (JsonNode value : submitted) {
            UUID ref = uuid(value.isTextual() ? value : value.path("assetRef"), "mediaRefs");
            if (!distinct.add(ref)) throw problem("mediaRefs cannot contain the same asset more than once for one SKU");
            assets.add(ref);
        }
        return List.copyOf(assets);
    }

    private static UUID uuid(JsonNode value, String field) {
        try {
            return UUID.fromString(value.asText(""));
        } catch (IllegalArgumentException failure) {
            throw problem(field + " must contain UUID refs", failure);
        }
    }

    private static CatalogOwnerApi.Problem problem(String message) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
    }

    private static CatalogOwnerApi.Problem problem(String message, Throwable cause) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message, cause);
    }

    private static void validateCount(int count) {
        if (count > CatalogInventoryShapeManifest.CATALOG_ITEM_IMAGE_MAX_COUNT) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    "sku mediaRefs cannot contain more than "
                            + CatalogInventoryShapeManifest.CATALOG_ITEM_IMAGE_MAX_COUNT + " images");
        }
    }
}
