package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/** Pure validation for catalog draft fields derived from the selected inventory shape. */
final class CatalogItemDraftValidator {
    private final ObjectMapper mapper;

    CatalogItemDraftValidator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    static boolean identifierAllowed(String shape, String ownerType, String type) {
        return switch (shape) {
            case "STANDARD_SALE_COUNTED", "MATERIAL", "COMPOSITE" -> "CATALOG_ITEM".equals(ownerType)
                    && Set.of("BARCODE", "MNEMONIC").contains(type);
            case "SKU_VARIANT_SALE_COUNTED" -> "SKU".equals(ownerType)
                    && Set.of("BARCODE", "MNEMONIC").contains(type);
            case "STANDARD_SALE_WEIGHED" -> "CATALOG_ITEM".equals(ownerType)
                    && Set.of("BARCODE", "PLU", "MNEMONIC").contains(type);
            case "SERVICE" -> "CATALOG_ITEM".equals(ownerType) && "MNEMONIC".equals(type);
            case "BENEFIT_SHELL" -> false;
            default -> false;
        };
    }

    static boolean preparationAllowed(String shape, String targetKind) {
        return switch (shape) {
            case "STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED" -> Set.of("ITEM", "OPTION_VALUE")
                    .contains(targetKind);
            case "SKU_VARIANT_SALE_COUNTED" -> "ITEM".equals(targetKind) || "SKU".equals(targetKind);
            default -> false;
        };
    }

    void validateSkuCombinations(ArrayNode skus, ArrayNode axes, CatalogInventoryShapeManifest.ShapeRule rule) {
        Map<String, Set<String>> allowed = new LinkedHashMap<>();
        for (JsonNode axis : axes) {
            String attributeRef = axis.path("attributeRef").asText("");
            Set<String> values = new LinkedHashSet<>();
            if (axis.path("values").isArray())
                axis.path("values")
                        .forEach(value -> values.add(value.path("valueRef").asText("")));
            allowed.put(attributeRef, values);
        }
        Set<String> activeDigests = new LinkedHashSet<>();
        boolean requiredMatrix = "REQUIRED_MATRIX".equals(rule.skuMode()) && !allowed.isEmpty();
        for (JsonNode sku : skus) {
            Set<String> skuAttributes = new LinkedHashSet<>();
            if (sku.path("attributeValueRefs").isArray())
                for (JsonNode value : sku.path("attributeValueRefs")) {
                    String attributeRef = value.path("attributeRef").asText("");
                    String valueRef = value.path("attributeValueRef").asText("");
                    if (!skuAttributes.add(attributeRef)) {
                        throw new CatalogOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "a SKU can contain only one value for each attribute");
                    }
                    if (!allowed.containsKey(attributeRef)
                            || !allowed.get(attributeRef).contains(valueRef)) {
                        throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                "SKU attribute value must belong to this item's selected variant axis");
                    }
                }
            if ("VOIDED".equals(sku.path("status").asText("ENABLED"))) continue;
            if (requiredMatrix && !skuAttributes.equals(allowed.keySet())) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR",
                        422,
                        "required SKU matrix combinations must select exactly one value from every axis");
            }
            String digest = sku.path("variantCombinationDigest").asText("").trim();
            if (digest.isEmpty())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "variantCombinationDigest is required");
            if (!activeDigests.add(digest)) {
                throw new CatalogOwnerApi.Problem(
                        "DUPLICATE_VARIANT_COMBINATION",
                        409,
                        "active SKU variant combinations must be unique within an item");
            }
        }
    }

    void validateClientDerivedFields(ObjectNode draft, CatalogInventoryShapeManifest.ShapeRule rule) {
        validateDerivedText(draft, "itemKind", rule.itemKind());
        validateDerivedText(draft, "measureMode", rule.measureMode());
        validateDerivedText(draft, "skuMode", rule.skuMode());
        validateDerivedText(draft, "priceGranularity", rule.priceGranularity());
        JsonNode capabilities = draft.get("usageCapabilities");
        if (capabilities != null && !capabilities.isNull()) {
            if (!capabilities.isArray() || !capabilities.toString().equals(capabilityJson(rule))) {
                throw new CatalogOwnerApi.Problem(
                        "SHAPE_DERIVATION_CONFLICT", 422, "usageCapabilities must be derived from shapeKey");
            }
        }
        JsonNode shape = draft.get("shapeKey");
        if (shape != null && !shape.isNull() && !rule.shapeKey().name().equals(shape.asText())) {
            throw new CatalogOwnerApi.Problem(
                    "SHAPE_DERIVATION_CONFLICT", 422, "shapeKey cannot change after creation");
        }
    }

    private String capabilityJson(CatalogInventoryShapeManifest.ShapeRule rule) {
        ArrayNode expected = mapper.createArrayNode();
        rule.usageCapabilities().forEach(capability -> expected.add(capability.name()));
        return expected.toString();
    }

    private static void validateDerivedText(ObjectNode draft, String field, String expected) {
        JsonNode value = draft.get(field);
        if (value != null && !value.isNull() && !expected.equals(value.asText())) {
            throw new CatalogOwnerApi.Problem(
                    "SHAPE_DERIVATION_CONFLICT", 422, field + " must be derived from shapeKey");
        }
    }
}
