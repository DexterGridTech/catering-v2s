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
 * Catalog-owned SKU facts. The relational tables are the only persisted source; JSON is reconstructed only for the
 * existing owner read contract.
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
        jdbc.query(
                "SELECT sku.item_ref, sku.product_sku_ref, sku.sku_code, sku.sku_name, sku.sku_barcode,"
                        + " sku.standard_sale_price, sku.is_default, sku.status, sku.version, sku.display_order,"
                        + " sku.variant_combination_digest, sku.sales_unit_override_ref,"
                        + " sku.base_measure_unit_override_ref, sku.sales_unit_ref, sku.sales_unit_code,"
                        + " sku.sales_unit_name, sku.sales_unit_dimension, sku.sales_unit_precision,"
                        + " sku.base_measure_unit_ref, sku.base_measure_unit_code, sku.base_measure_unit_name,"
                        + " sku.base_measure_unit_dimension, sku.base_measure_unit_precision,"
                        + " attribute_value.attribute_ref, attribute.code, attribute.name, value.entry_ref, value.code,"
                        + " value.name, value.status, COALESCE(axis_value.display_order,0), media_refs.media_refs FROM"
                        + " catalog.catalog_sku sku LEFT JOIN catalog.catalog_sku_attribute_value attribute_value ON"
                        + " attribute_value.product_sku_ref = sku.product_sku_ref LEFT JOIN catalog.dictionary_entry"
                        + " attribute ON attribute.entry_ref = attribute_value.attribute_ref LEFT JOIN"
                        + " catalog.dictionary_entry value ON value.entry_ref = attribute_value.attribute_value_ref"
                        + " LEFT"
                        + " JOIN catalog.catalog_sku_variant_axis axis ON axis.item_ref = sku.item_ref AND"
                        + " axis.attribute_ref = attribute_value.attribute_ref LEFT JOIN"
                        + " catalog.catalog_sku_variant_axis_value axis_value ON axis_value.sku_variant_axis_ref ="
                        + " axis.sku_variant_axis_ref AND axis_value.value_ref = attribute_value.attribute_value_ref,"
                        + " LATERAL (SELECT COALESCE(string_agg(media.asset_ref::text, ',' ORDER BY"
                        + " media.display_order,"
                        + " media.asset_ref), '') AS media_refs FROM catalog.catalog_sku_media media WHERE"
                        + " media.product_sku_ref = sku.product_sku_ref) AS media_refs WHERE sku.item_ref IN ("
                        + placeholders
                        + ") AND sku.status <> 'VOIDED' ORDER BY "
                        + "sku.item_ref, sku.display_order, sku.sku_code, attribute_value.attribute_ref",
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
                        UUID attributeRef = result.getObject(24, UUID.class);
                        if (attributeRef == null) continue;
                        ObjectNode value = sku.withArray("attributeValueRefs").addObject();
                        value.put("attributeRef", attributeRef.toString());
                        value.put("attributeCode", result.getString(25));
                        value.put("attributeName", result.getString(26));
                        value.put(
                                "attributeValueRef",
                                result.getObject(27, UUID.class).toString());
                        value.put("valueCode", result.getString(28));
                        value.put("valueLabel", result.getString(29));
                        value.put("displayOrder", result.getInt(31));
                        value.put("status", result.getString(30));
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
        return Set.copyOf(jdbc.query(
                "SELECT product_sku_ref FROM catalog.catalog_sku WHERE item_ref=? AND status <> 'VOIDED' FOR UPDATE",
                (result, row) -> result.getObject(1, UUID.class),
                itemRef));
    }

    /**
     * Locks the current SKU lifecycle rows while carrying the asset facts that the save coordinator must settle. The
     * save command already needs this lifecycle read; returning the related item/SKU asset refs here prevents a second
     * catalog-wide asset query without weakening the owner lock or changing which owner judges references.
     */
    ExistingSaveFacts existingSaveFacts(UUID itemRef) {
        Set<UUID> skuRefs = new LinkedHashSet<>();
        Set<UUID> assetRefs = new LinkedHashSet<>();
        jdbc.query(
                "WITH locked_skus AS MATERIALIZED ("
                        + "SELECT sku.product_sku_ref "
                        + "FROM catalog.catalog_sku sku "
                        + "WHERE sku.item_ref=? AND sku.status <> 'VOIDED' FOR UPDATE"
                        + ") "
                        + "SELECT locked_skus.product_sku_ref,media.asset_ref "
                        + "FROM locked_skus LEFT JOIN catalog.catalog_sku_media media "
                        + "ON media.product_sku_ref=locked_skus.product_sku_ref "
                        + "UNION ALL "
                        + "SELECT NULL::uuid,image.asset_ref "
                        + "FROM catalog.catalog_item_image image WHERE image.item_ref=?",
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

    record ExistingSaveFacts(Set<UUID> skuRefs, Set<UUID> assetRefs) {
        ExistingSaveFacts {
            skuRefs = skuRefs == null ? Set.of() : Set.copyOf(skuRefs);
            assetRefs = assetRefs == null ? Set.of() : Set.copyOf(assetRefs);
        }

        static ExistingSaveFacts empty() {
            return new ExistingSaveFacts(Set.of(), Set.of());
        }
    }

    LifecycleRow lockLifecycle(UUID itemRef, UUID skuRef) {
        List<LifecycleRow> rows = jdbc.query(
                "SELECT product_sku_ref,sku_code,status,version FROM catalog.catalog_sku WHERE item_ref=? AND "
                        + "product_sku_ref=? FOR UPDATE",
                (result, row) -> new LifecycleRow(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getLong(4)),
                itemRef,
                skuRef);
        if (rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "SKU 不存在");
        return rows.get(0);
    }

    void markVoided(UUID itemRef, UUID skuRef, long expectedVersion) {
        int changed = jdbc.update(
                "UPDATE catalog.catalog_sku SET status='VOIDED',version=version+1 WHERE item_ref=? AND "
                        + "product_sku_ref=? AND version=? AND status NOT IN ('ARCHIVED','VOIDED')",
                itemRef,
                skuRef,
                expectedVersion);
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "SKU 版本已变化");
    }

    void replace(UUID itemRef, ArrayNode skus, Set<UUID> archivedRefs) {
        List<CopySku> parsed = new ArrayList<>();
        if (skus != null) for (JsonNode node : skus) parsed.add(parseCopySku(itemRef, node));

        if (archivedRefs != null && !archivedRefs.isEmpty()) {
            List<Object[]> archivedRows = archivedRefs.stream()
                    .map(skuRef -> new Object[] {itemRef, skuRef})
                    .toList();
            jdbc.batchUpdate(
                    "UPDATE catalog.catalog_sku SET status='ARCHIVED',version=version+1 WHERE item_ref=? AND "
                            + "product_sku_ref=? AND status <> 'VOIDED'",
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
                sku.barcode(),
                sku.price(),
                sku.defaultSku(),
                sku.status(),
                sku.displayOrder(),
                sku.digest(),
                sku.salesUnitOverrideRef(),
                sku.baseMeasureUnitOverrideRef()
            });
            for (AttributeValue value : sku.attributes())
                attributeRows.add(new Object[] {sku.skuRef(), value.attributeRef(), value.valueRef()});
        }
        try {
            int[] changed = jdbc.batchUpdate(
                    "INSERT INTO "
                            + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,sku_barcode,standard_sale"
                            + "_price,is_default,status,display_order,variant_combination_digest,"
                            + "sales_unit_override_ref,"
                            + "base_measure_unit_override_ref)"
                            + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_sku_ref) DO UPDATE SET "
                            + "sku_code=EXCLUDED.sku_code,sku_name=EXCLUDED.sku_name,sku_barcode=EXCLUDED.sku_barcode,"
                            + "standard_sale_price=EXCLUDED.standard_sale_price,is_default=EXCLUDED.is_default,status="
                            + "EXCLUDED.status,display_order=EXCLUDED.display_order,variant_combination_digest="
                            + "EXCLUDED.variant_combination_digest,"
                            + "sales_unit_override_ref=EXCLUDED.sales_unit_override_ref,"
                            + "base_measure_unit_override_ref=EXCLUDED.base_measure_unit_override_ref,"
                            + "version=catalog.catalog_sku.version+1"
                            + " WHERE catalog.catalog_sku.item_ref=EXCLUDED.item_ref AND catalog.catalog_sku.status <>"
                            + " 'VOIDED'",
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
        String placeholders = String.join(",", java.util.Collections.nCopies(parsed.size(), "?"));
        List<Object> skuRefs = parsed.stream()
                .map(CopySku::skuRef)
                .map(value -> (Object) value)
                .toList();
        jdbc.update(
                "DELETE FROM catalog.catalog_sku_attribute_value WHERE product_sku_ref IN (" + placeholders + ")",
                skuRefs.toArray());
        if (!attributeRows.isEmpty())
            jdbc.batchUpdate(
                    "INSERT INTO"
                            + " catalog.catalog_sku_attribute_value(product_sku_ref,attribute_ref,attribute_value_ref) "
                            + "VALUES(?,?,?)",
                    attributeRows);
    }

    /**
     * Inserts SKU facts for freshly-created copy targets. Copy targets have no existing child rows, so the
     * update-oriented replace path is deliberately not reused here; both tables are written with one owner-local batch.
     */
    void insertForCopy(Map<UUID, ArrayNode> skusByItem) {
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
                sku.barcode(),
                sku.price(),
                sku.defaultSku(),
                sku.status(),
                sku.displayOrder(),
                sku.digest()
            });
            for (AttributeValue value : sku.attributes())
                attributeRows.add(new Object[] {sku.skuRef(), value.attributeRef(), value.valueRef()});
        }
        try {
            jdbc.batchUpdate(
                    "INSERT INTO "
                            + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,sku_barcode,standard_sale"
                            + "_pri"
                            + "ce,is_default,status,display_order,variant_combination_digest) "
                            + "VALUES(?,?,?,?,?,?,?,?,?,?) "
                            + "ON CONFLICT(product_sku_ref) DO NOTHING",
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
                    "INSERT INTO "
                            + "catalog.catalog_sku_attribute_value(product_sku_ref,attribute_ref,attribute_value_ref) "
                            + "VALUES(?,?,?)",
                    attributeRows);
        for (CopySku sku : parsed)
            jdbc.update(
                    "UPDATE catalog.catalog_sku SET sales_unit_override_ref=?,base_measure_unit_override_ref=? WHER"
                            + "E product_sku_ref=?",
                    sku.salesUnitOverrideRef(),
                    sku.baseMeasureUnitOverrideRef(),
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
        String barcode = node.hasNonNull("skuBarcode") ? node.path("skuBarcode").asText() : null;
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
                barcode,
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
        if (result.getString(5) == null) sku.put("skuBarcode", "");
        else sku.put("skuBarcode", result.getString(5));
        if (result.getObject(6) == null) sku.putNull("standardSalePrice");
        else sku.put("standardSalePrice", result.getLong(6));
        sku.put("isDefault", result.getBoolean(7));
        sku.put("status", result.getString(8));
        sku.put("version", result.getLong(9));
        sku.put("displayOrder", result.getInt(10));
        sku.put("variantCombinationDigest", result.getString(11));
        if (result.getObject(12, UUID.class) == null) sku.putNull("salesUnitOverrideRef");
        else sku.put("salesUnitOverrideRef", result.getObject(12, UUID.class).toString());
        if (result.getObject(13, UUID.class) == null) sku.putNull("baseMeasureUnitOverrideRef");
        else
            sku.put(
                    "baseMeasureUnitOverrideRef",
                    result.getObject(13, UUID.class).toString());
        putUnitSnapshot(sku, "salesUnitSnapshot", result, 14, 15, 16, 17, 18);
        putUnitSnapshot(sku, "baseMeasureUnitSnapshot", result, 19, 20, 21, 22, 23);
        ArrayNode mediaRefs = sku.putArray("mediaRefs");
        String media = result.getString(32);
        if (media != null && !media.isBlank()) for (String assetRef : media.split(",")) mediaRefs.add(assetRef);
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

    record LifecycleRow(UUID skuRef, String skuCode, String status, long version) {}

    private record CopySku(
            UUID itemRef,
            UUID skuRef,
            String skuCode,
            String skuName,
            String barcode,
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
