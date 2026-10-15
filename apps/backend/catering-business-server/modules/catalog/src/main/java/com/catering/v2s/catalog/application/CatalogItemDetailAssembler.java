package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Builds catalog item detail from facts already read by the catalog owner. */
final class CatalogItemDetailAssembler {
    private final ObjectMapper mapper;

    CatalogItemDetailAssembler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    record ItemFacts(
            UUID ref,
            String code,
            String name,
            String shortName,
            String shapeKey,
            String status,
            long version,
            long updatedAt,
            String sourceScopeRef) {}

    record InboundReference(UUID componentRef, UUID ownerItemRef, String ownerCode, String ownerName) {}

    private record DerivedSkuFacts(
            int enabledCount,
            int nonArchivedCount,
            int totalCount,
            List<String> dimensions,
            String priceGranularity,
            Long standardSalePriceMin,
            Long standardSalePriceMax) {}

    ArrayNode arrayCopy(JsonNode value) {
        if (value != null && value.isArray()) return (ArrayNode) value.deepCopy();
        return mapper.createArrayNode();
    }

    private static String primaryImageAssetRef(JsonNode orderedImages) {
        if (orderedImages == null || !orderedImages.isArray() || orderedImages.isEmpty()) return null;
        JsonNode first = orderedImages.get(0);
        String assetRef =
                first.isTextual() ? first.asText() : first.path("assetRef").asText("");
        return assetRef.isBlank() ? null : assetRef;
    }

    ArrayNode specificationFacts(JsonNode sections) {
        JsonNode axes = sections.path("skuVariantDimensions");
        if (axes.isArray() && !axes.isEmpty()) return specificationFactsFromAxes(axes);
        Map<String, ObjectNode> byAttribute = new LinkedHashMap<>();
        JsonNode skus = sections.path("skus");
        if (skus.isArray())
            for (JsonNode sku : skus) {
                if (!sku.path("attributeValueRefs").isArray()) continue;
                for (JsonNode value : sku.path("attributeValueRefs")) {
                    String attributeRef = value.path("attributeRef").asText("");
                    String attributeCode = value.path("attributeCode").asText("");
                    String attributeName = value.path("attributeName").asText("");
                    if (attributeRef.isBlank() || attributeCode.isBlank() || attributeName.isBlank())
                        throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品规格事实读取失败");
                    ObjectNode fact = byAttribute.computeIfAbsent(attributeRef, ignored -> {
                        ObjectNode created = mapper.createObjectNode()
                                .put("attributeRef", attributeRef)
                                .put("attributeCode", attributeCode)
                                .put("attributeName", attributeName);
                        created.putArray("values");
                        return created;
                    });
                    ArrayNode values = fact.withArray("values");
                    String valueRef = value.path("attributeValueRef").asText("");
                    boolean duplicate = false;
                    for (JsonNode existing : values)
                        if (valueRef.equals(existing.path("valueRef").asText(""))) {
                            duplicate = true;
                            break;
                        }
                    if (!duplicate)
                        values.addObject()
                                .put("valueRef", valueRef)
                                .put("valueCode", value.path("valueCode").asText(""))
                                .put("valueLabel", value.path("valueLabel").asText(""))
                                .put("displayOrder", value.path("displayOrder").asInt(0))
                                .put("status", value.path("status").asText(""));
                }
            }
        ArrayNode result = mapper.createArrayNode();
        byAttribute.values().forEach(result::add);
        return result;
    }

    ArrayNode specificationFactsFromAxes(JsonNode axes) {
        ArrayNode result = mapper.createArrayNode();
        axes.forEach(axis -> {
            ObjectNode fact = result.addObject()
                    .put("attributeRef", axis.path("attributeRef").asText(""))
                    .put("attributeCode", axis.path("attributeCode").asText(""))
                    .put("attributeName", axis.path("attributeName").asText(""));
            ArrayNode values = fact.putArray("values");
            if (axis.path("values").isArray())
                axis.path("values").forEach(value -> values.addObject()
                        .put("valueRef", value.path("valueRef").asText(""))
                        .put("valueCode", value.path("valueCode").asText(""))
                        .put("valueLabel", value.path("valueLabel").asText(""))
                        .put("displayOrder", value.path("displayOrder").asInt(0))
                        .put("status", value.path("status").asText("")));
        });
        return result;
    }

    ObjectNode preparationFacts(
            CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTag,
            JsonNode preparationProfile,
            DerivedSkuFacts skuFacts,
            JsonNode sections) {
        ObjectNode result = mapper.createObjectNode();
        if (productionTag == null) result.putNull("productionTag");
        else
            result.putObject("productionTag")
                    .put("tagRef", productionTag.tagRef().toString())
                    .put("code", productionTag.code())
                    .put("name", productionTag.name())
                    .put("status", productionTag.status())
                    .put("owner", "catalog");
        setNullableJson(result, "profile", preparationProfile);
        result.putObject("skuVariation")
                .put(
                        "varies",
                        skuFacts.totalCount() > 0
                                && CatalogOwnerValueSupport.skuPreparationDiffers(sections, preparationProfile));
        return result;
    }

    ObjectNode skuPreparationFacts(
            CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTag,
            JsonNode itemProfile,
            JsonNode effectivePreparation) {
        ObjectNode result = preparationFacts(
                productionTag,
                effectivePreparation,
                new DerivedSkuFacts(0, 0, 0, List.of(), "SKU", null, null),
                mapper.createObjectNode());
        result.with("skuVariation").put("varies", !java.util.Objects.equals(itemProfile, effectivePreparation));
        return result;
    }

    String sourceFact(ItemFacts row, JsonNode sections) {
        String source = firstText(sections, "source", "sourceType", "ownershipSource");
        if ("AUTO_SYNC".equals(source)) return "AUTO_SYNC";
        if ("TEMPORARY".equals(source) || "EXTERNAL_ORDER_TEMPORARY".equals(source)) return "TEMPORARY";
        return row.sourceScopeRef() == null ? "SELF_MANAGED" : "COPIED";
    }

    ObjectNode itemDetail(
            ItemFacts row,
            CatalogInventoryShapeManifest.ShapeRule rule,
            JsonNode sections,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions,
            Map<UUID, List<InboundReference>> inboundBySku,
            ArrayNode resolvedCompositeGroups) {
        ObjectNode item = mapper.createObjectNode()
                .put("itemRef", row.ref().toString())
                .put("code", row.code())
                .put("name", row.name());
        if (row.shortName() == null || row.shortName().isBlank()) item.putNull("shortName");
        else item.put("shortName", row.shortName());
        item.put("shapeKey", row.shapeKey());
        if (sections.has("materialRole") && !sections.path("materialRole").isNull())
            item.put("materialRole", sections.path("materialRole").asText());
        else item.putNull("materialRole");
        JsonNode categoryRefs = sections.path("categoryRefs");
        if (categoryRefs.isArray() && !categoryRefs.isEmpty())
            item.put("categoryRef", categoryRefs.get(0).asText());
        else item.putNull("categoryRef");
        item.set("categoryPath", arrayCopy(sections.path("categoryPath")));
        JsonNode productionTagRef = sections.path("productionTagRef");
        if (productionTagRef.isTextual() && !productionTagRef.asText().isBlank())
            item.put("productionTagRef", productionTagRef.asText());
        else item.putNull("productionTagRef");
        ArrayNode tagRefs = item.putArray("tagRefs");
        if (sections.path("tagRefs").isArray()) sections.path("tagRefs").forEach(value -> tagRefs.add(value.asText()));

        DerivedSkuFacts skuFacts = derivedSkuFacts(sections, rule);
        item.put("itemKind", rule.itemKind()).put("measureMode", rule.measureMode());
        UUID itemSalesUnitRef = nullableUuid(sections, "salesUnitRef");
        UUID itemBaseMeasureUnitRef = nullableUuid(sections, "baseMeasureUnitRef");
        putNullableUuid(item, "salesUnitRef", itemSalesUnitRef);
        putNullableUuid(item, "baseMeasureUnitRef", itemBaseMeasureUnitRef);
        setStoredUnitAssignment(
                item,
                "salesUnit",
                itemSalesUnitRef,
                sections.path("salesUnitSnapshot"),
                "ITEM_DEFAULT",
                unitDefinitions);
        setStoredUnitAssignment(
                item,
                "baseMeasureUnit",
                itemBaseMeasureUnitRef,
                sections.path("baseMeasureUnitSnapshot"),
                "ITEM_DEFAULT",
                unitDefinitions);
        ArrayNode capabilities = item.putArray("usageCapabilities");
        rule.usageCapabilities().forEach(capability -> capabilities.add(capability.name()));
        ArrayNode images = item.putArray("images");
        JsonNode imageValues = sections.path("images");
        if (imageValues.isArray())
            imageValues.forEach(v ->
                    images.add(v.isTextual() ? v.asText() : v.path("assetRef").asText()));
        String primaryImageAssetRef = primaryImageAssetRef(imageValues);
        if (primaryImageAssetRef == null) item.putNull("primaryImageAssetRef");
        else item.put("primaryImageAssetRef", primaryImageAssetRef);
        ArrayNode identifiers = item.putArray("identifiers");
        JsonNode idValues = sections.path("identifiers");
        if (idValues.isArray()) idValues.forEach(v -> identifiers.add(v.deepCopy()));
        ObjectNode sku = item.putObject("skuSummary")
                .put("enabledCount", skuFacts.enabledCount())
                .put("nonArchivedCount", skuFacts.nonArchivedCount())
                .put("totalCount", skuFacts.totalCount());
        ArrayNode skuDimensions = sku.putArray("dimensions");
        skuFacts.dimensions().forEach(skuDimensions::add);
        item.set("skuVariantDimensions", skuVariantDimensions(sections.path("skuVariantDimensions")));
        JsonNode productionTagFact = sections.path("productionTagFact");
        CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback = null;
        if (productionTagFact.isObject()) {
            UUID tagRef = nullableUuid(productionTagFact, "tagRef");
            if (tagRef != null)
                productionTagReadback = new CatalogProductionTagOwnerApi.ProductionTagReferenceReadback(
                        tagRef,
                        productionTagFact.path("code").asText(""),
                        productionTagFact.path("name").asText(""),
                        productionTagFact.path("status").asText(""),
                        productionTagFact.path("version").asLong(0));
        }
        item.set(
                "skus",
                skuRows(
                        sections.path("skus"),
                        itemSalesUnitRef,
                        itemBaseMeasureUnitRef,
                        sections.get("preparationProfile"),
                        productionTagReadback,
                        unitDefinitions,
                        inboundBySku));
        putNullableLong(item, "standardSalePrice", sections.path("standardSalePrice"));
        item.put("priceGranularity", skuFacts.priceGranularity());
        item.set(
                "attributeAssignments",
                sections.path("attributeAssignments").isArray()
                        ? sections.path("attributeAssignments")
                        : mapper.createArrayNode());
        item.set(
                "orderOptionConfigs",
                sections.path("orderOptionConfigs").isArray()
                        ? sections.path("orderOptionConfigs")
                        : mapper.createArrayNode());
        item.set("specificationFacts", specificationFacts(sections));
        item.set("orderOptionFacts", arrayCopy(sections.path("orderOptionConfigs")));
        item.set("attributeFacts", arrayCopy(sections.path("attributeAssignments")));
        // The relational projection is resolved once by CatalogCompositeFacts and is shared with the root
        // read-model location.  Never reconstruct a code-only JSON copy from persisted sections here.
        item.set("compositeGroups", resolvedCompositeGroups.deepCopy());
        item.putObject("inventoryRules").putArray("nodes");
        setNullableJson(item, "preparationProfile", sections.get("preparationProfile"));
        item.set(
                "preparationFacts",
                preparationFacts(productionTagReadback, sections.get("preparationProfile"), skuFacts, sections));
        item.putObject("lifecycle")
                .put("status", row.status())
                .put("version", row.version())
                .put("source", sourceFact(row, sections));
        item.put("source", sourceFact(row, sections));
        JsonNode externalIdentity = CatalogOwnerValueSupport.externalIdentityFact(mapper, sections);
        if (externalIdentity == null) item.putNull("externalIdentity");
        else item.set("externalIdentity", externalIdentity);
        item.put("version", row.version()).put("updatedAt", row.updatedAt());
        return item;
    }

    void setStoredUnitAssignment(
            ObjectNode target,
            String field,
            UUID unitRef,
            JsonNode storedSnapshot,
            String inheritanceSource,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions) {
        if (unitRef == null) {
            target.putNull(field);
            return;
        }
        if (storedSnapshot == null || !storedSnapshot.isObject())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位快照缺失");
        UUID snapshotRef;
        try {
            snapshotRef = UUID.fromString(storedSnapshot.path("unitRef").asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位快照引用无效", failure);
        }
        if (!unitRef.equals(snapshotRef))
            throw new CatalogOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    /* format-wrap */
                    "商品单位快照与引用不一致");
        CatalogOwnerApi.UnitDefinitionReadback unit = unitDefinitions.get(unitRef);
        if (unit == null) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品单位定义无法读取");
        }
        target.putObject(field)
                .put("unitRef", snapshotRef.toString())
                .put("code", storedSnapshot.path("code").asText())
                .put("name", storedSnapshot.path("name").asText())
                .put("unitDimension", storedSnapshot.path("unitDimension").asText())
                .put("precision", storedSnapshot.path("precision").asInt())
                .put("status", unit.status())
                .put("inheritanceSource", inheritanceSource);
    }

    DerivedSkuFacts derivedSkuFacts(JsonNode sections, CatalogInventoryShapeManifest.ShapeRule rule) {
        JsonNode skus = sections.path("skus");
        int total = skus.isArray() ? skus.size() : 0;
        int enabled = skus.isArray()
                ? (int) java.util.stream.StreamSupport.stream(skus.spliterator(), false)
                        .filter(sku -> "ENABLED".equals(sku.path("status").asText("ENABLED")))
                        .count()
                : 0;
        int nonArchived = skus.isArray()
                ? (int) java.util.stream.StreamSupport.stream(skus.spliterator(), false)
                        .filter(sku ->
                                !Set.of("VOIDED").contains(sku.path("status").asText("ENABLED")))
                        .count()
                : 0;
        Long standardSalePriceMin = null;
        Long standardSalePriceMax = null;
        if (skus.isArray())
            for (JsonNode sku : skus) {
                if ("VOIDED".equals(sku.path("status").asText("ENABLED"))
                        || !sku.path("standardSalePrice").isIntegralNumber()) continue;
                long price = sku.path("standardSalePrice").asLong();
                standardSalePriceMin = standardSalePriceMin == null ? price : Math.min(standardSalePriceMin, price);
                standardSalePriceMax = standardSalePriceMax == null ? price : Math.max(standardSalePriceMax, price);
            }
        List<String> dimensions = new ArrayList<>();
        JsonNode axes = sections.path("skuVariantDimensions");
        if (axes.isArray())
            for (JsonNode axis : axes) dimensions.add(axis.path("attributeName").asText(""));
        // Axis names come from the owner relation when available. The SKU-derived fallback is retained only for
        // malformed/legacy rows that have SKU attributes but no axis relation.
        if (dimensions.isEmpty() && skus.isArray()) {
            LinkedHashSet<String> labels = new LinkedHashSet<>();
            for (JsonNode sku : skus)
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs")) {
                        String label = value.path("attributeName").asText("");
                        if (!label.isBlank()) labels.add(label);
                    }
            dimensions.addAll(labels);
        }
        return new DerivedSkuFacts(
                enabled,
                nonArchived,
                total,
                List.copyOf(dimensions),
                rule.priceGranularity(),
                standardSalePriceMin,
                standardSalePriceMax);
    }

    ArrayNode skuVariantDimensions(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(dimension -> {
            ObjectNode target = result.addObject();
            target.put("attributeRef", dimension.path("attributeRef").asText(""));
            target.put("attributeCode", dimension.path("attributeCode").asText(""));
            target.put("attributeName", dimension.path("attributeName").asText(""));
            target.put("displayOrder", dimension.path("displayOrder").asInt(0));
            ArrayNode values = target.putArray("values");
            if (dimension.path("values").isArray())
                dimension.path("values").forEach(value -> {
                    ObjectNode entry = values.addObject();
                    entry.put("valueRef", value.path("valueRef").asText(""));
                    entry.put("valueCode", value.path("valueCode").asText(""));
                    entry.put("valueLabel", value.path("valueLabel").asText(""));
                    entry.put("displayOrder", value.path("displayOrder").asInt(0));
                    entry.put("status", value.path("status").asText("ENABLED"));
                });
        });
        return result;
    }

    ArrayNode skuRows(
            JsonNode node,
            UUID itemSalesUnitRef,
            UUID itemBaseMeasureUnitRef,
            JsonNode itemPreparationProfile,
            CatalogProductionTagOwnerApi.ProductionTagReferenceReadback productionTagReadback,
            Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> unitDefinitions,
            Map<UUID, List<InboundReference>> inboundBySku) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        List<JsonNode> skuNodes = new ArrayList<>();
        node.forEach(skuNodes::add);
        List<UUID> skuRefs = skuNodes.stream()
                .map(sku -> UUID.fromString(sku.path("productSkuRef").asText()))
                .toList();
        for (int index = 0; index < skuNodes.size(); index++) {
            JsonNode sku = skuNodes.get(index);
            UUID skuRef = skuRefs.get(index);
            ObjectNode target = result.addObject();
            target.put("productSkuRef", sku.path("productSkuRef").asText(""));
            target.put("skuCode", firstText(sku, "skuCode", "code") == null ? "" : firstText(sku, "skuCode", "code"));
            target.put("skuName", sku.path("skuName").asText(""));
            target.put("displayOrder", sku.path("displayOrder").asInt(0));
            target.put(
                    "variantCombinationDigest",
                    sku.path("variantCombinationDigest").asText(""));
            ArrayNode refs = target.putArray("attributeValueRefs");
            if (sku.path("attributeValueRefs").isArray())
                sku.path("attributeValueRefs").forEach(value -> {
                    ObjectNode ref = refs.addObject();
                    ref.put("attributeRef", value.path("attributeRef").asText(""));
                    ref.put("attributeCode", value.path("attributeCode").asText(""));
                    ref.put("attributeName", value.path("attributeName").asText(""));
                    ref.put("attributeValueRef", value.path("attributeValueRef").asText(""));
                    ref.put("valueCode", value.path("valueCode").asText(""));
                    ref.put("valueLabel", value.path("valueLabel").asText(""));
                    ref.put("displayOrder", value.path("displayOrder").asInt(0));
                    ref.put("status", value.path("status").asText("ENABLED"));
                });
            JsonNode identifiers = sku.path("identifiers");
            target.set("identifiers", identifiers.isArray() ? identifiers.deepCopy() : mapper.createArrayNode());
            putNullableLong(target, "standardSalePrice", sku.path("standardSalePrice"));
            target.put("isDefault", sku.path("isDefault").asBoolean(false));
            target.put("status", sku.path("status").asText("ENABLED"));
            target.put("version", sku.path("version").asLong(0));
            if (!sku.hasNonNull("updatedAt")) {

                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品规格更新时间读取失败");
            }
            target.put("updatedAt", sku.path("updatedAt").asLong());
            setNullableJson(target, "preparationOverride", sku.get("preparationOverride"));
            setNullableJson(target, "effectivePreparation", sku.get("effectivePreparation"));
            target.put("preparationSource", sku.path("preparationSource").asText("ITEM_DEFAULT"));
            JsonNode effectivePreparation =
                    sku.has("effectivePreparation") ? sku.get("effectivePreparation") : itemPreparationProfile;
            target.set(
                    "preparationFacts",
                    skuPreparationFacts(productionTagReadback, itemPreparationProfile, effectivePreparation));
            UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
            UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
            putNullableUuid(target, "salesUnitOverrideRef", salesOverride);
            putNullableUuid(target, "baseMeasureUnitOverrideRef", baseOverride);
            setStoredUnitAssignment(
                    target,
                    "salesUnit",
                    salesOverride == null ? itemSalesUnitRef : salesOverride,
                    sku.path("salesUnitSnapshot"),
                    salesOverride == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE",
                    unitDefinitions);
            setStoredUnitAssignment(
                    target,
                    "baseMeasureUnit",
                    baseOverride == null ? itemBaseMeasureUnitRef : baseOverride,
                    sku.path("baseMeasureUnitSnapshot"),
                    baseOverride == null ? "ITEM_DEFAULT" : "SKU_OVERRIDE",
                    unitDefinitions);
            ObjectNode voidAvailability = target.putObject("voidAvailability");
            ArrayNode blockingReferences = voidAvailability.putArray("blockingReferences");
            ArrayNode dependentFacts = voidAvailability.putArray("dependentFacts");
            List<InboundReference> inbound = inboundBySku.getOrDefault(skuRef, List.of());
            inbound.forEach(reference -> {
                blockingReferences
                        .addObject()
                        .put("referenceKind", "CATALOG_COMPOSITE_COMPONENT")
                        .put("referenceRef", reference.componentRef().toString());
                dependentFacts
                        .addObject()
                        .put("factKind", "CATALOG_COMPOSITE_ITEM")
                        .put("factRef", reference.ownerItemRef().toString());
            });
            ArrayNode blockingReasons = voidAvailability.putArray("blockingReasons");
            if (!inbound.isEmpty())
                appendVoidBlockingReason(
                        blockingReasons,
                        "USED_BY_PACKAGE",
                        inbound.size(),
                        inbound.stream().map(InboundReference::ownerName).toList());
            if ("VOIDED".equals(sku.path("status").asText("ENABLED")))
                appendVoidBlockingReason(blockingReasons, "ALREADY_VOIDED", 1, List.of());
            // canVoid and its business explanation are one owner judgement. Do not emit a disabled SKU action
            // without the fact that explains it to an operator.
            voidAvailability.put("canVoid", blockingReasons.isEmpty());
            ArrayNode mediaRefs = target.putArray("mediaRefs");
            if (sku.path("mediaRefs").isArray()) sku.path("mediaRefs").forEach(value -> mediaRefs.add(value.asText()));
        }
        return result;
    }

    void putNullableLong(ObjectNode target, String key, JsonNode value) {
        if (value != null && value.isIntegralNumber()) target.put(key, value.asLong());
        else target.putNull(key);
    }

    void setNullableJson(ObjectNode target, String field, JsonNode value) {
        if (value == null || value.isNull()) target.putNull(field);
        else target.set(field, value.deepCopy());
    }

    static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys)
            if (node.path(key).isValueNode() && !node.path(key).asText().isBlank())
                return node.path(key).asText();
        return null;
    }

    static void appendVoidBlockingReason(
            ArrayNode reasons, String reasonCode, long count, List<String> relatedItemNames) {
        ObjectNode reason = reasons.addObject().put("reasonCode", reasonCode).put("count", count);
        ArrayNode names = reason.putArray("relatedItemNames");
        relatedItemNames.stream()
                .filter(name -> name != null && !name.isBlank())
                .forEach(names::add);
    }

    static UUID nullableUuid(JsonNode object, String field) {
        String value = nullableText(object, field);
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

    private static String nullableText(JsonNode object, String field) {
        return object.path(field).isNull() || object.path(field).isMissingNode()
                ? null
                : object.path(field).asText();
    }

    static void putNullableUuid(ObjectNode target, String field, UUID value) {
        if (value == null) target.putNull(field);
        else target.put(field, value.toString());
    }

}
