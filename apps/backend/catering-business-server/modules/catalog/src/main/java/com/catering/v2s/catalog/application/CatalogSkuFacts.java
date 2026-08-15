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
import org.postgresql.util.PSQLException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Catalog-owned SKU facts.  The relational tables are the only persisted
 * source; JSON is reconstructed only for the existing owner read contract.
 */
final class CatalogSkuFacts {
    private static final String VARIANT_COMBINATION_CONSTRAINT = "ux_catalog_sku_variant_digest_per_item";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    CatalogSkuFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(",", Collections.nCopies(refs.size(), "?"));
        Map<UUID, LinkedHashMap<UUID, ObjectNode>> rows = new LinkedHashMap<>();
        jdbc.query("SELECT sku.item_ref,sku.product_sku_ref,sku.sku_code,sku.sku_name,sku.sku_barcode,sku.standard_sale_price,sku.is_default,sku.status,sku.display_order,sku.variant_combination_digest,attribute_value.attribute_ref,attribute.code,attribute.name,value.entry_ref,value.code,value.name,value.status,COALESCE(axis_value.display_order,0) FROM catalog.catalog_sku sku LEFT JOIN catalog.catalog_sku_attribute_value attribute_value ON attribute_value.product_sku_ref=sku.product_sku_ref LEFT JOIN catalog.dictionary_entry attribute ON attribute.entry_ref=attribute_value.attribute_ref LEFT JOIN catalog.dictionary_entry value ON value.entry_ref=attribute_value.attribute_value_ref LEFT JOIN catalog.catalog_sku_variant_axis axis ON axis.item_ref=sku.item_ref AND axis.attribute_ref=attribute_value.attribute_ref LEFT JOIN catalog.catalog_sku_variant_axis_value axis_value ON axis_value.sku_variant_axis_ref=axis.sku_variant_axis_ref AND axis_value.value_ref=attribute_value.attribute_value_ref WHERE sku.item_ref IN (" + placeholders + ") ORDER BY sku.item_ref,sku.display_order,sku.sku_code,attribute_value.attribute_ref", statement -> {
            for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
        }, result -> {
            while (result.next()) {
                UUID itemRef = result.getObject(1, UUID.class);
                UUID skuRef = result.getObject(2, UUID.class);
                LinkedHashMap<UUID, ObjectNode> itemSkus = rows.computeIfAbsent(itemRef, ignored -> new LinkedHashMap<>());
                ObjectNode sku = itemSkus.get(skuRef);
                if (sku == null) {
                    sku = skuNode(result);
                    itemSkus.put(skuRef, sku);
                }
                UUID attributeRef = result.getObject(11, UUID.class);
                if (attributeRef == null) continue;
                ObjectNode value = sku.withArray("attributeValueRefs").addObject();
                value.put("attributeRef", attributeRef.toString());
                value.put("attributeCode", result.getString(12));
                value.put("attributeName", result.getString(13));
                value.put("attributeValueRef", result.getObject(14, UUID.class).toString());
                value.put("valueCode", result.getString(15));
                value.put("valueLabel", result.getString(16));
                value.put("displayOrder", result.getInt(18));
                value.put("status", result.getString(17));
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

    Set<UUID> existingRefs(UUID itemRef) {
        return Set.copyOf(jdbc.query("SELECT product_sku_ref FROM catalog.catalog_sku WHERE item_ref=? FOR UPDATE", (result, row) -> result.getObject(1, UUID.class), itemRef));
    }

    void replace(UUID itemRef, ArrayNode skus, Set<UUID> archivedRefs) {
        if (archivedRefs != null) for (UUID skuRef : archivedRefs) {
            jdbc.update("UPDATE catalog.catalog_sku SET status='ARCHIVED' WHERE item_ref=? AND product_sku_ref=?", itemRef, skuRef);
        }
        if (skus == null) return;
        for (JsonNode node : skus) {
            if (!node.isObject()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skus must contain objects");
            UUID skuRef = uuid(node, "productSkuRef");
            String skuCode = required(node, "skuCode");
            String skuName = required(node, "skuName");
            String status = node.path("status").asText("ENABLED");
            if (!CatalogInventoryShapeManifest.accepts("skuStatus", status)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "SKU status is not supported");
            int displayOrder = node.path("displayOrder").asInt(0);
            if (displayOrder < 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "SKU displayOrder must not be negative");
            String digest = required(node, "variantCombinationDigest");
            Long price = node.path("standardSalePrice").isIntegralNumber() ? node.path("standardSalePrice").asLong() : null;
            String barcode = node.hasNonNull("skuBarcode") ? node.path("skuBarcode").asText() : null;
            int changed;
            try {
                changed = jdbc.update("INSERT INTO catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,sku_barcode,standard_sale_price,is_default,status,display_order,variant_combination_digest) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_sku_ref) DO UPDATE SET sku_code=EXCLUDED.sku_code,sku_name=EXCLUDED.sku_name,sku_barcode=EXCLUDED.sku_barcode,standard_sale_price=EXCLUDED.standard_sale_price,is_default=EXCLUDED.is_default,status=EXCLUDED.status,display_order=EXCLUDED.display_order,variant_combination_digest=EXCLUDED.variant_combination_digest WHERE catalog.catalog_sku.item_ref=EXCLUDED.item_ref", skuRef, itemRef, skuCode, skuName, barcode, price, node.path("isDefault").asBoolean(false), status, displayOrder, digest);
            } catch (DuplicateKeyException failure) {
                if (isVariantCombinationConflict(failure)) {
                    throw new CatalogOwnerApi.Problem("DUPLICATE_VARIANT_COMBINATION", 409, "active SKU variant combinations must be unique within an item", failure);
                }
                throw failure;
            }
            if (changed != 1) throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "productSkuRef belongs to another item in this owner scope");
            jdbc.update("DELETE FROM catalog.catalog_sku_attribute_value WHERE product_sku_ref=?", skuRef);
            Set<UUID> attributeRefs = new LinkedHashSet<>();
            if (node.path("attributeValueRefs").isArray()) for (JsonNode value : node.path("attributeValueRefs")) {
                UUID attributeRef = uuid(value, "attributeRef");
                if (!attributeRefs.add(attributeRef)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "a SKU can contain only one value for each attribute");
                jdbc.update("INSERT INTO catalog.catalog_sku_attribute_value(product_sku_ref,attribute_ref,attribute_value_ref) VALUES(?,?,?)", skuRef, attributeRef, uuid(value, "attributeValueRef"));
            }
        }
    }

    private ObjectNode skuNode(java.sql.ResultSet result) throws java.sql.SQLException {
        ObjectNode sku = mapper.createObjectNode();
        sku.put("productSkuRef", result.getObject(2, UUID.class).toString());
        sku.put("skuCode", result.getString(3));
        sku.put("skuName", result.getString(4));
        if (result.getString(5) == null) sku.put("skuBarcode", ""); else sku.put("skuBarcode", result.getString(5));
        if (result.getObject(6) == null) sku.putNull("standardSalePrice"); else sku.put("standardSalePrice", result.getLong(6));
        sku.put("isDefault", result.getBoolean(7));
        sku.put("status", result.getString(8));
        sku.put("displayOrder", result.getInt(9));
        sku.put("variantCombinationDigest", result.getString(10));
        sku.putArray("mediaRefs");
        sku.putArray("attributeValueRefs");
        return sku;
    }

    private static boolean isVariantCombinationConflict(DuplicateKeyException failure) {
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current instanceof PSQLException postgres
                && postgres.getServerErrorMessage() != null
                && VARIANT_COMBINATION_CONSTRAINT.equals(postgres.getServerErrorMessage().getConstraint())) return true;
        }
        return false;
    }

    private static UUID uuid(JsonNode node, String field) {
        try { return UUID.fromString(required(node, field)); }
        catch (IllegalArgumentException failure) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be UUID", failure); }
    }

    private static String required(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }
}
