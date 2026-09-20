package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.platform.foundation.collection.CollectionRequestSupport;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Pure value transformations shared by Catalog targets and the legacy owner facade compatibility surface. */
final class CatalogOwnerValueSupport {
    private CatalogOwnerValueSupport() {}

    static void validateItemPageQuery(ObjectNode request) {
        if (request == null) return;
        Set<String> allowed = Set.of(
                "dataNodeRef",
                "keyword",
                "smartViewKey",
                "shapeKey",
                "categoryRef",
                "tagRef",
                "productionTagRef",
                "uncategorized",
                "includeSubCategories",
                "status",
                "source",
                "candidateUsage",
                "excludeItemCode",
                "cursor",
                "pageSize",
                "queryGeneration",
                "itemCodes",
                "itemRefs",
                "itemCodesOnly");
        request.fieldNames().forEachRemaining(field -> {
            if (!allowed.contains(field))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "unknown catalog page query field: " + field);
        });
        String status = optional(request, "status");
        if (status != null && !CatalogOwnerTypes.STATUSES.contains(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "status is not supported");
        String shapeKey = optional(request, "shapeKey");
        if (shapeKey != null && !CatalogOwnerTypes.SHAPES.contains(shapeKey))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shapeKey is not supported");
        optionalUuid(request, "tagRef");
        optionalUuid(request, "productionTagRef");
        if (parseBoolean(request, "uncategorized", false) && optional(request, "categoryRef") != null)
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "uncategorized cannot be combined with categoryRef");
        String smartViewKey = optional(request, "smartViewKey");
        if (smartViewKey != null && !CatalogInventoryShapeManifest.accepts("smartViewKey", smartViewKey))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "smartViewKey is not supported");
        String source = optional(request, "source");
        if (source != null && !CatalogInventoryShapeManifest.accepts("catalogSource", source))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "source is not supported");
        String candidateUsage = optional(request, "candidateUsage");
        if (candidateUsage != null && !"COMPOSITE_COMPONENT".equals(candidateUsage))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "candidateUsage is not supported");
        if ("COMPOSITE_COMPONENT".equals(candidateUsage)
                && (optional(request, "excludeItemCode") == null
                        || optional(request, "excludeItemCode").isBlank()))
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "COMPOSITE_COMPONENT candidate usage requires excludeItemCode");
        parsePageSize(request, "pageSize", 20);
        parseCursor(request, "cursor");
        parseBoolean(request, "includeSubCategories", false);
        if (request.has("itemCodes") && !request.path("itemCodes").isArray())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCodes must be an array");
        uuidArray(request.path("itemRefs"), "itemRefs");
    }

    private static int parsePageSize(ObjectNode request, String key, int fallback) {
        try {
            return CollectionRequestSupport.pageSize(request, key, fallback);
        } catch (CollectionRequestSupport.InvalidRequestValue failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, failure.getMessage(), failure);
        }
    }

    private static long parseCursor(ObjectNode request, String key) {
        try {
            return CollectionRequestSupport.cursor(request, key);
        } catch (CollectionRequestSupport.InvalidRequestValue failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, failure.getMessage(), failure);
        }
    }

    private static boolean parseBoolean(ObjectNode request, String key, boolean fallback) {
        try {
            return CollectionRequestSupport.booleanValue(request, key, fallback);
        } catch (CollectionRequestSupport.InvalidRequestValue failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, failure.getMessage(), failure);
        }
    }

    private static List<UUID> uuidArray(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return List.of();
        if (!value.isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an array");
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        for (JsonNode entry : value) {
            if (!entry.isTextual())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must contain UUID values");
            try {
                result.add(UUID.fromString(entry.asText()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, field + " must contain UUID values", failure);
            }
        }
        return List.copyOf(result);
    }

    private static UUID optionalUuid(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be an opaque UUID ref", failure);
        }
    }

    private static String optional(ObjectNode request, String key) {
        return CollectionRequestSupport.optional(request, key);
    }

    static List<String> validatedLocalCopySections(ArrayNode selectedSections) {
        if (selectedSections == null || selectedSections.isEmpty()) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "selectedSections is required");
        }
        List<String> validated = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode section : selectedSections) {
            if (!section.isTextual() || section.asText().isBlank()) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "selectedSections contains an unknown section");
            }
            String value = section.asText();
            copySectionKey(value);
            if (!seen.add(value)) {
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "selectedSections contains duplicate section");
            }
            validated.add(value);
        }
        return List.copyOf(validated);
    }

    private static String copySectionKey(String section) {
        return switch (section) {
            case "BASIC_INFO" -> "basicInfo";
            case "SKU_STRUCTURE" -> "skus";
            case "SKU_BOM" -> "skuBom";
            case "OPTION_VALUE_BOM" -> "optionValueBom";
            case "ITEM_BOM" -> "inventoryRules";
            case "ORDER_OPTIONS" -> "orderOptionConfigs";
            case "PACKAGE_STRUCTURE" -> "compositeGroups";
            case "PRODUCTION_PROMPTS" -> "preparationProfile";
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "selectedSections contains an unknown section");
        };
    }

    static void validateCatalogCode(String code) {
        if (code == null || code.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "formalCode is required");
    }

    static Set<String> catalogAssetRefs(JsonNode sections) {
        Set<String> refs = new LinkedHashSet<>();
        collectAssetRefs(refs, sections.path("images"));
        JsonNode skus = sections.path("skus");
        if (skus.isArray()) skus.forEach(sku -> collectAssetRefs(refs, sku.path("mediaRefs")));
        return refs;
    }

    private static void collectAssetRefs(Set<String> refs, JsonNode values) {
        if (!values.isArray()) return;
        values.forEach(value -> {
            String ref = value.isTextual() ? value.asText() : value.path("assetRef").asText("");
            if (!ref.isBlank()) refs.add(ref);
        });
    }

    static JsonNode externalIdentityFact(ObjectMapper mapper, JsonNode sections) {
        JsonNode declared = sections.path("externalIdentity");
        if (!declared.isObject()) return null;
        ObjectNode identity = mapper.createObjectNode();
        copyOptionalText(identity, declared, "sourceOrderRef");
        copyOptionalText(identity, declared, "sourceRecordRef");
        copyOptionalText(identity, declared, "sourceItemRef");
        JsonNode sourceSnapshot = declared.path("snapshot");
        if (sourceSnapshot.isObject()) {
            ObjectNode snapshot = identity.putObject("snapshot");
            copyOptionalText(snapshot, sourceSnapshot, "name");
            copyOptionalText(snapshot, sourceSnapshot, "specification");
            if (sourceSnapshot.path("price").isIntegralNumber()) snapshot.put("price", sourceSnapshot.path("price").asLong());
            else if (sourceSnapshot.has("price")) snapshot.putNull("price");
        }
        return identity;
    }

    private static void copyOptionalText(ObjectNode target, JsonNode source, String field) {
        JsonNode value = source.get(field);
        if (value != null && value.isTextual() && !value.asText().isBlank()) target.put(field, value.asText());
    }

    static String copyReferenceObjectType(String referenceKind) {
        return switch (referenceKind) {
            case "CATALOG_ITEM",
                    "COMPOSITE_COMPONENT",
                    "BOM_COMPONENT",
                    "ORDER_OPTION_MATERIAL",
                    "SKU" -> "CATALOG_ITEM";
            case "CATEGORY" -> "CATALOG_CATEGORY";
            case "TAG" -> "CATALOG_TAG";
            case "SKU_ATTRIBUTE" -> "SKU_ATTRIBUTE";
            case "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            case "PRODUCTION_TAG" -> "PRODUCTION_TAG";
            default -> referenceKind;
        };
    }

    /** Stable product compatibility bit: skuCode -> sorted(attributeCode,valueCode) pairs. */
    static String skuStructureFingerprint(JsonNode sections) {
        JsonNode skus = sections == null ? null : sections.path("skus");
        if (skus == null || !skus.isArray())
            skus = sections == null ? null : sections.path("skuStructure").path("skus");
        List<String> fingerprints = new ArrayList<>();
        if (skus != null && skus.isArray()) {
            skus.forEach(sku -> {
                String skuCode = firstText(sku, "skuCode", "code");
                if (skuCode == null || skuCode.isBlank()) return;
                List<String> values = new ArrayList<>();
                JsonNode attributeValues = sku.path("attributeValues");
                if (attributeValues.isObject())
                    attributeValues
                            .fields()
                            .forEachRemaining(entry -> appendAttributePair(values, entry.getKey(), entry.getValue()));
                else if (attributeValues.isArray())
                    attributeValues.forEach(value -> appendAttributeObject(values, value));
                JsonNode attributes = sku.path("attributes");
                if (attributes.isObject())
                    attributes
                            .fields()
                            .forEachRemaining(entry -> appendAttributePair(values, entry.getKey(), entry.getValue()));
                JsonNode attributeValueRefs = sku.path("attributeValueRefs");
                if (attributeValueRefs.isArray())
                    attributeValueRefs.forEach(value -> appendAttributeObject(values, value));
                Collections.sort(values);
                fingerprints.add(skuCode + "->" + String.join(",", values));
            });
        }
        Collections.sort(fingerprints);
        return String.join(";", fingerprints);
    }

    private static void appendAttributePair(List<String> values, String attributeCode, JsonNode value) {
        if (value == null || value.isNull()) return;
        if (value.isArray()) {
            value.forEach(entry -> appendAttributePair(values, attributeCode, entry));
            return;
        }
        if (value.isObject()) {
            appendAttributeObject(values, value);
            return;
        }
        values.add(attributeCode + "=" + value.asText());
    }

    private static void appendAttributeObject(List<String> values, JsonNode value) {
        String attributeCode = firstText(value, "attributeCode", "dimensionCode", "attribute", "code");
        String valueCode = firstText(value, "valueCode", "attributeValueCode", "value");
        if (attributeCode != null && valueCode != null) values.add(attributeCode + "=" + valueCode);
    }

    private static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys)
            if (node.path(key).isValueNode() && !node.path(key).asText().isBlank())
                return node.path(key).asText();
        return null;
    }

    static String dictionaryObjectType(String dictionaryKind) {
        return switch (dictionaryKind) {
            case "TAG" -> "CATALOG_TAG";
            case "SKU_ATTRIBUTE" -> "SKU_ATTRIBUTE";
            case "SKU_ATTRIBUTE_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            case "ORDER_OPTION_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dictionaryKind is not supported");
        };
    }
}
