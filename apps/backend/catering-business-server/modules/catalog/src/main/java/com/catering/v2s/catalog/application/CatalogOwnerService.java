package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Catalog owner. All catalog facts and command receipts stay inside catalog schema. */
@Service
public class CatalogOwnerService implements CatalogOwnerApi {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;

    public CatalogOwnerService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.copyLimits = CopyLimitPolicy.load(mapper);
        this.time = time;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return switch (operationId) {
            case "getOperationsCatalogWorkbenchContext" -> workbenchContext(dataNodeRef, brandRef, requestId);
            case "getOperationsCatalogNavigation" -> navigation(dataNodeRef, brandRef, requestId, request);
            case "getOperationsCatalogItems" -> items(dataNodeRef, brandRef, requestId, request);
            case "getOperationsCatalogItem" -> detail(dataNodeRef, brandRef, requestId, required(request, "itemCode"));
            case "getOperationsCatalogDictionary" -> dictionary(dataNodeRef, brandRef, requestId, requiredDictionaryKind(request), request);
            case "getOperationsLocalCatalogCopyCandidates", "getOperationsBrandCatalogCopyCandidates" -> copyCandidates(operationId, dataNodeRef, brandRef, requestId, request);
            case "getOperationsCatalogShapeManifest" -> shapeManifest(requestId);
            default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog read operation is not registered");
        };
    }

    @Override
    @Transactional
    public JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(dataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isEmpty()) {
            JsonNode replay = replay(dataNodeRef, receiptKey, operationId, request);
            if (replay != null) return replay;
        }
        JsonNode result = switch (operationId) {
            case "createOperationsCatalogItem" -> createItem(dataNodeRef, brandRef, requestId, request);
            case "saveOperationsCatalogItem" -> saveItem(dataNodeRef, brandRef, requestId, request);
            case "transitionOperationsCatalogItemStatus" -> transitionItem(dataNodeRef, brandRef, requestId, request);
            case "createOperationsCatalogCategory" -> createCategory(dataNodeRef, brandRef, requestId, request);
            case "updateOperationsCatalogCategory" -> updateCategory(dataNodeRef, brandRef, requestId, request);
            case "moveOperationsCatalogCategory" -> moveCategory(dataNodeRef, brandRef, requestId, request);
            case "transitionOperationsCatalogCategoryStatus" -> transitionCategory(dataNodeRef, brandRef, requestId, request);
            case "createOperationsCatalogDictionaryEntry" -> createDictionary(dataNodeRef, brandRef, requestId, request);
            case "updateOperationsCatalogDictionaryEntry" -> updateDictionary(dataNodeRef, brandRef, requestId, request);
            case "reorderOperationsCatalogDictionaryEntry" -> reorderDictionary(dataNodeRef, brandRef, requestId, request);
            case "transitionOperationsCatalogDictionaryEntryStatus" -> transitionDictionary(dataNodeRef, brandRef, requestId, request);
            case "preflightOperationsTemporaryCatalogItemPromotion" -> promotionPreflight(dataNodeRef, brandRef, requestId, request);
            case "executeOperationsTemporaryCatalogItemPromotion" -> promotionExecute(dataNodeRef, brandRef, requestId, request);
            default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog write operation is not registered");
        };
        if (!receiptKey.isEmpty()) saveReceipt(dataNodeRef, receiptKey, operationId, request, result);
        return result;
    }

    @Override
    @Transactional
    public JsonNode copy(String operationId, String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        if (operationId.contains("Local")) return copyLocal(operationId, sourceDataNodeRef, brandRef, request, requestId, idempotencyKey);
        List<String> selected = selectedCodes(request);
        if (selected.size() > copyLimits.selectedItemCount()) throw tooLarge("COPY_SELECTED_ITEMS_TOO_LARGE", selected.size(), copyLimits.selectedItemCount());
        CatalogClosure graph = closureGraph(sourceDataNodeRef, brandRef, selected);
        List<ItemRow> source = graph.items();
        if (!source.stream().map(ItemRow::code).collect(java.util.stream.Collectors.toSet()).containsAll(selected)) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "copy source item is not available in the approved scope");
        int closure = graph.size();
        if (closure > copyLimits.closureItemCount()) throw tooLarge("COPY_CLOSURE_TOO_LARGE", closure, copyLimits.closureItemCount());
        long sourceVersion = scopeVersion(graph);
        long targetVersion = targetScopeVersion(targetDataNodeRef, brandRef, request, graph);
        String currentDigest = copyDigest(sourceDataNodeRef, targetDataNodeRef, selected, graph, sourceVersion, targetVersion);
        if (operationId.contains("preflight")) return copyPreflight(operationId, sourceDataNodeRef, targetDataNodeRef, brandRef, requestId, selected, graph, sourceVersion, targetVersion, currentDigest);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay = replay(targetDataNodeRef, idempotencyKey.trim(), operationId, request);
            if (replay != null) return replay;
        }
        long expectedSource = requiredLong(request, "expectedSourceVersion", -1);
        long expectedTarget = requiredLong(request, "expectedTargetVersion", -1);
        String submittedDigest = required(request, "preflightDigest");
        if (expectedSource != sourceVersion || expectedTarget != targetVersion || !submittedDigest.equals(currentDigest)) {
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        }
        CopyCompatibility compatibility = validateCopyCompatibility(sourceDataNodeRef, targetDataNodeRef, brandRef, graph);
        assertNoOwnerReferenceLeak(graph, compatibility.mapping(), sourceDataNodeRef);
        ArrayNode created = mapper.createArrayNode();
        ArrayNode reused = mapper.createArrayNode();
        for (CategoryRow row : graph.categories()) {
            int changed = jdbc.update("INSERT INTO catalog.catalog_category (category_ref,data_node_ref,brand_ref,code,name,parent_code,status,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (data_node_ref,brand_ref,code) DO NOTHING", UUID.randomUUID(), targetDataNodeRef, brandRef, row.code(), row.name(), row.parentCode(), row.status(), 1L, now(), now());
            (changed == 1 ? created : reused).addObject().put("objectType", "CATALOG_CATEGORY").put("code", row.code());
        }
        for (DictionaryRow row : graph.dictionaries()) {
            int changed = jdbc.update("INSERT INTO catalog.dictionary_entry (entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,status,display_order,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (data_node_ref,brand_ref,dictionary_kind,code) DO NOTHING", UUID.randomUUID(), targetDataNodeRef, brandRef, row.dictionaryKind(), row.code(), row.name(), row.status(), row.displayOrder(), 1L, now(), now());
            (changed == 1 ? created : reused).addObject().put("objectType", row.objectType()).put("code", row.code());
        }
        for (ItemRow row : source) {
            String rewrittenSections = canonicalJson(rewriteReferences(json(row.sectionsJson()), compatibility.mapping()));
            int changed = jdbc.update("INSERT INTO catalog.catalog_item (item_ref, data_node_ref, brand_ref, code, name, shape_key, status, attributes, sections, source_item_code, source_scope_ref, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB), ?, ?, 1, ?, ?) ON CONFLICT (data_node_ref, brand_ref, code) DO NOTHING", UUID.randomUUID(), targetDataNodeRef, brandRef, row.code(), row.name(), row.shapeKey(), row.status(), row.attributesJson(), rewrittenSections, row.code(), sourceDataNodeRef, now(), now());
            (changed == 1 ? created : reused).addObject().put("objectType", "CATALOG_ITEM").put("code", row.code());
        }
        verifyTargetNoOwnerReferenceLeak(targetDataNodeRef, brandRef, graph, sourceDataNodeRef);
        ObjectNode data = mapper.createObjectNode().put("preflightDigest", submittedDigest);
        data.set("created", created); data.set("reused", reused); data.putArray("skipped");
        ArrayNode mappings = data.putArray("mappings");
        compatibility.mapping().forEach((from, to) -> mappings.addObject().put("fromCode", from.code()).put("toCode", to).put("referenceKind", from.objectType()));
        ArrayNode targetVersions = data.putArray("targetVersions");
        loadItems(targetDataNodeRef, brandRef, source.stream().map(ItemRow::code).toList()).forEach(row -> targetVersions.addObject().put("targetRef", row.ref().toString()).put("version", row.version()));
        ArrayNode ownerReadbacks = data.putArray("ownerReadbacks"); ownerReadbacks.addObject().put("owner", "catalog").put("status", "COMMITTED").put("version", 1);
        ObjectNode result = envelope(requestId, data);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) saveReceipt(targetDataNodeRef, idempotencyKey.trim(), operationId, request, result);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode referencedProductionTagCodes(String sourceDataNodeRef, String brandRef, ObjectNode request) {
        List<String> selected = request.path("closureItemCodes").isArray() ? stringValues(request.path("closureItemCodes")) : selectedCodes(request);
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        closure(sourceDataNodeRef, brandRef, selected).forEach(row -> {
            JsonNode values = json(row.sectionsJson()).path("productionTags");
            if (values.isArray()) values.forEach(value -> { String code = value.path("code").asText(); if (!code.isBlank()) tags.add(code); });
        });
        ArrayNode result = mapper.createArrayNode(); tags.forEach(result::add);
        return result;
    }

    private JsonNode copyLocal(String operationId, String scope, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        String sourceCode = required(request, "sourceItemCode");
        String targetCode = required(request, "targetItemCode");
        if (sourceCode.equals(targetCode)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "复制来源与目标不能相同");
        ItemRow source = requireItem(scope, brandRef, sourceCode);
        ItemRow target = requireItem(scope, brandRef, targetCode);
        ArrayNode selectedSections = request.path("selectedSections").isArray() ? (ArrayNode) request.path("selectedSections") : null;
        if (selectedSections == null || selectedSections.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "selectedSections is required");
        String digest = localCopyDigest(source, target, selectedSections);
        CompatibilityCheck compatibility = source.shapeKey().equals(target.shapeKey())
            ? new CompatibilityCheck("CONFIRMABLE_REUSE", "同形态商品可复制", null, false)
            : new CompatibilityCheck("BLOCKED", "商品形态结构不兼容", "STRUCTURE_INCOMPATIBLE", true);
        if (!compatibility.blocking()) {
            LinkedHashSet<String> refs = itemReferenceCodes(json(source.sectionsJson()));
            for (String ref : refs) if (!itemExists(scope, brandRef, ref)) { compatibility = new CompatibilityCheck("BLOCKED", "BOM 引用无法在当前商品库解析", "REFERENCE_MAPPING_UNRESOLVED", true); break; }
        }
        if (operationId.contains("preflight")) {
            ObjectNode data = mapper.createObjectNode();
            data.putObject("sourceScope").put("ownerType", "DATA_NODE").put("ownerRef", scope).put("brandRef", brandRef);
            data.putObject("targetScope").put("ownerType", "DATA_NODE").put("ownerRef", scope).put("brandRef", brandRef);
            data.putArray("selectedItems").addObject().put("objectType", "CATALOG_ITEM").put("code", source.code()).put("name", source.name());
            data.putArray("closureItems").addObject().put("objectType", "CATALOG_ITEM").put("code", source.code()).put("name", source.name()).put("action", "REPLACE");
            data.putArray("closureEdges");
            data.putArray("objectVersions").addObject().put("objectType", "CATALOG_ITEM").put("code", source.code()).put("sourceVersion", source.version()).put("targetVersion", target.version());
            data.putArray("mappingPreview").addObject().put("fromCode", source.code()).put("toCode", target.code()).put("referenceKind", "CATALOG_ITEM").put("status", compatibility.result());
            data.putArray("compatibilityResults").addObject().put("objectType", "CATALOG_ITEM").put("result", compatibility.result()).put("reason", compatibility.reason());
            data.putArray("referenceRewritePreview");
            data.put("preflightDigest", digest).put("selectedCount", 1).put("selectedLimit", 1).put("closureCount", 1).put("closureLimit", copyLimits.closureItemCount()).put("blockingCount", compatibility.blocking() ? 1 : 0).put("confirmationRequiredCount", compatibility.blocking() ? 0 : 1);
            return envelope(requestId, data);
        }
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay = replay(scope, idempotencyKey.trim(), operationId, request);
            if (replay != null) return replay;
        }
        long expectedSource = requiredLong(request, "expectedSourceVersion", -1);
        long expectedTarget = requiredLong(request, "expectedTargetVersion", -1);
        if (expectedSource != source.version() || expectedTarget != target.version() || !required(request, "preflightDigest").equals(digest)) throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "复制预检已失效，请重新预检");
        if (compatibility.blocking()) throw new CatalogOwnerApi.Problem(compatibility.problemCode(), 422, compatibility.reason());
        ObjectNode merged = (ObjectNode) json(target.sectionsJson()).deepCopy();
        for (JsonNode section : selectedSections) {
            String key = sectionKey(section.asText());
            if (json(source.sectionsJson()).has(key)) merged.set(key, json(source.sectionsJson()).path(key).deepCopy());
        }
            String attributes = selectedSectionsElements(selectedSections).contains("BASIC_INFO") ? source.attributesJson() : target.attributesJson();
        int changed = jdbc.update("UPDATE catalog.catalog_item SET attributes=CAST(? AS JSONB),sections=CAST(? AS JSONB),version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?", attributes, canonicalJson(merged), now(), scope, brandRef, target.code(), target.version());
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "目标商品版本已变化");
        ObjectNode data = mapper.createObjectNode().put("preflightDigest", digest);
        data.putArray("created"); data.putArray("reused").addObject().put("objectType", "CATALOG_ITEM").put("code", target.code()); data.putArray("skipped");
        data.putArray("mappings").addObject().put("fromCode", source.code()).put("toCode", target.code()).put("referenceKind", "CATALOG_ITEM");
        data.putArray("targetVersions").addObject().put("targetRef", target.ref().toString()).put("version", target.version() + 1);
        data.putArray("ownerReadbacks").addObject().put("owner", "catalog").put("status", "COMMITTED").put("version", target.version() + 1);
        ObjectNode result = envelope(requestId, data);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) saveReceipt(scope, idempotencyKey.trim(), operationId, request, result);
        return result;
    }

    private String sectionKey(String section) {
        return switch (section) {
            case "BASIC_INFO" -> "basicInfo";
            case "SKU_STRUCTURE" -> "skuStructure";
            case "SKU_BOM" -> "skuBom";
            case "ORDER_OPTIONS" -> "orderOptions";
            case "OPTION_VALUE_BOM" -> "optionValueBom";
            case "ITEM_BOM" -> "inventoryBom";
            case "PACKAGE_STRUCTURE" -> "packageStructure";
            case "PRODUCTION_PROMPTS" -> "productionProfiles";
            case "PRINT_NAME" -> "printName";
            default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "selectedSections contains an unknown section");
        };
    }

    private String localCopyDigest(ItemRow source, ItemRow target, ArrayNode sections) {
        ArrayList<String> values = new ArrayList<>(); sections.forEach(section -> values.add(section.asText())); Collections.sort(values);
        return digest(source.code() + "|" + target.code() + "|" + source.version() + "|" + target.version() + "|" + String.join(",", values));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean itemExists(String dataNodeRef, String brandRef, String itemCode) {
        if (dataNodeRef == null || brandRef == null || itemCode == null) return false;
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?", Integer.class, dataNodeRef, brandRef, itemCode);
        return count != null && count > 0;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean productionTagReferenced(String dataNodeRef, String brandRef, String tagCode) {
        if (dataNodeRef == null || brandRef == null || tagCode == null || tagCode.isBlank()) return false;
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND sections->'productionTags' @> CAST(? AS JSONB)", Integer.class, dataNodeRef, brandRef, mapper.createArrayNode().addObject().put("code", tagCode).toString());
        return count != null && count > 0;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean assetReferenced(String dataNodeRef, String brandRef, String assetRef) {
        requireScope(dataNodeRef, brandRef);
        if (assetRef == null || assetRef.isBlank()) return false;
        return jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'", statement -> {
            statement.setString(1, dataNodeRef);
            statement.setString(2, brandRef);
        }, result -> {
            while (result.next()) {
                if (imageAssetRefs(json(result.getString(1))).contains(assetRef)) return true;
            }
            return false;
        });
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef) {
        requireScope(dataNodeRef, brandRef);
        if (targetRef == null || targetRef.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "targetRef is required");
        ArrayNode entries = mapper.createArrayNode();
        jdbc.query("SELECT code,name,status,sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' ORDER BY code", statement -> { statement.setString(1, dataNodeRef); statement.setString(2, brandRef); }, result -> {
            while (result.next()) {
                String sourceCode = result.getString(1);
                String sourceName = result.getString(2);
                String sourceStatus = result.getString(3);
                JsonNode sections = json(result.getString(4));
                JsonNode bom = sections.path("inventoryBom");
                if (!bom.isArray()) continue;
                bom.forEach(node -> {
                    if (!targetRef.equals(node.path("targetRef").asText())) return;
                    ObjectNode entry = entries.addObject()
                        .put("sourceCode", sourceCode)
                        .put("sourceKind", node.path("nodeType").asText("ITEM"))
                        .put("sourceName", sourceName)
                        .put("quantity", node.path("quantity").asText("0"))
                        .put("unit", node.path("unit").asText(""))
                        .put("timing", "BOM")
                        .put("status", sourceStatus);
                    entry.putObject("ownerScope").put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef);
                });
            }
            return null;
        });
        return entries;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode skuNamesByItemCodes(String dataNodeRef, String brandRef, JsonNode itemCodes) {
        requireScope(dataNodeRef, brandRef);
        if (itemCodes == null || !itemCodes.isArray() || itemCodes.isEmpty()) return mapper.createObjectNode();
        List<String> codes = stringValues(itemCodes);
        if (codes.isEmpty()) return mapper.createObjectNode();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>(); args.add(dataNodeRef); args.add(brandRef); args.addAll(codes);
        ObjectNode result = mapper.createObjectNode();
        jdbc.query("SELECT code,sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code IN (" + placeholders + ")", args.toArray(), rows -> {
            while (rows.next()) {
                String itemCode = rows.getString(1);
                JsonNode skus = json(rows.getString(2)).path("skus");
                if (!skus.isArray()) continue;
                ObjectNode names = result.putObject(itemCode);
                skus.forEach(sku -> {
                    String skuCode = firstText(sku, "skuCode", "code");
                    String skuName = firstText(sku, "skuName", "name");
                    if (skuCode != null && skuName != null && !skuName.isBlank()) names.put(skuCode, skuName);
                });
            }
            return null;
        });
        return result;
    }

    private ObjectNode workbenchContext(String dataNodeRef, String brandRef, String requestId) {
        ObjectNode data = mapper.createObjectNode();
        data.put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef);
        data.put("scopeName", dataNodeRef).put("scopeCode", dataNodeRef).putNull("headCompanyRef");
        data.put("copySourceAvailable", true);
        data.putObject("actionAvailability").put("canCreate", true).put("canEdit", true).put("canCopy", true).putArray("reasons");
        data.put("contextVersion", generation(dataNodeRef, brandRef)).put("authorizationRevision", CatalogOwnerTypes.REVISION);
        return envelope(requestId, data);
    }

    private ObjectNode navigation(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode();
        ArrayNode tree = data.putArray("tree");
        jdbc.query("SELECT c.code, c.name, c.parent_code, c.status, (SELECT COUNT(*) FROM catalog.catalog_item i WHERE i.data_node_ref=c.data_node_ref AND i.brand_ref=c.brand_ref AND i.status <> 'VOIDED' AND jsonb_exists(i.sections->'categoryRefs', c.code)), (SELECT COUNT(*) FROM catalog.catalog_category child WHERE child.data_node_ref=c.data_node_ref AND child.brand_ref=c.brand_ref AND child.parent_code=c.code AND child.status <> 'VOIDED') FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? ORDER BY c.code", statement -> { statement.setString(1, dataNodeRef); statement.setString(2, brandRef); }, result -> { while (result.next()) { String code = result.getString(1); boolean referenced = result.getLong(5) > 0; boolean hasChildren = result.getLong(6) > 0; ObjectNode node = tree.addObject().put("nodeRef", code).put("label", result.getString(2)).put("code", code); if (result.getString(3) == null) node.putNull("parentCode"); else node.put("parentCode", result.getString(3)); node.put("count", result.getLong(5)).put("countSemantics", "SELF_ONLY"); ObjectNode voidAvailability = node.putObject("voidAvailability"); voidAvailability.put("canVoid", !"VOIDED".equals(result.getString(4)) && !referenced && !hasChildren); ArrayNode blocking = voidAvailability.putArray("blockingReferences"); if (referenced) blocking.addObject().put("referenceKind", "CATALOG_ITEM").put("referenceRef", code); ArrayNode dependent = voidAvailability.putArray("dependentFacts"); if (hasChildren) dependent.addObject().put("factKind", "CHILD_CATEGORY").put("factRef", code); } return null; });
        ArrayNode views = data.putArray("smartViews");
        Map<String, Long> smartCounts = new LinkedHashMap<>();
        ArrayNode counts = data.putArray("shapeCounts"); Map<String, Long> shapeCounts = new LinkedHashMap<>(); long[] generation = {0L};
        jdbc.query("SELECT shape_key, COUNT(*), COALESCE(MAX(version),0), "
            + "COUNT(*) FILTER (WHERE status='DRAFT' OR sections->>'needsAttention'='true'), "
            + "COUNT(*) FILTER (WHERE COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='EXTERNAL_ORDER_TEMPORARY'), "
            + "COUNT(*) FILTER (WHERE status='DISABLED'), "
            + "COUNT(*) FILTER (WHERE status='ARCHIVED'), "
            + "COUNT(*) FILTER (WHERE updated_at_epoch_millis >= ?), "
            + "COUNT(*) FILTER (WHERE COALESCE(sections->>'source',sections->>'sourceType',sections->>'ownershipSource')='AUTO_SYNC') "
            + "FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' GROUP BY shape_key", statement -> { statement.setLong(1, now() - 7L * 24L * 60L * 60L * 1000L); statement.setString(2, dataNodeRef); statement.setString(3, brandRef); }, result -> { while (result.next()) { shapeCounts.put(result.getString(1), result.getLong(2)); generation[0] = Math.max(generation[0], result.getLong(3)); smartCounts.merge("GOVERNANCE_PENDING", result.getLong(4), Long::sum); smartCounts.merge("EXTERNAL_ORDER_TEMP", result.getLong(5), Long::sum); smartCounts.merge("INACTIVE", result.getLong(6), Long::sum); smartCounts.merge("ARCHIVED", result.getLong(7), Long::sum); smartCounts.merge("RECENTLY_UPDATED", result.getLong(8), Long::sum); smartCounts.merge("AUTO_SYNC", result.getLong(9), Long::sum); } return null; });
        for (String key : List.of("GOVERNANCE_PENDING", "EXTERNAL_ORDER_TEMP", "INACTIVE", "ARCHIVED", "RECENTLY_UPDATED", "AUTO_SYNC")) views.addObject().put("viewKey", key).put("count", smartCounts.getOrDefault(key, 0L));
        for (String shape : CatalogOwnerTypes.SHAPES) counts.addObject().put("shapeKey", shape).put("count", shapeCounts.getOrDefault(shape, 0L));
        Long uncategorizedCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' "
                + "AND (sections->'categoryRefs' IS NULL OR jsonb_typeof(sections->'categoryRefs') <> 'array' OR jsonb_array_length(sections->'categoryRefs')=0)",
            Long.class, dataNodeRef, brandRef);
        data.put("uncategorizedCount", uncategorizedCount == null ? 0L : uncategorizedCount);
        data.put("generation", generation[0]);
        return envelope(requestId, data);
    }

    private ObjectNode items(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        validateItemPageQuery(request);
        String keyword = optional(request, "keyword");
        String smartViewKey = optional(request, "smartViewKey");
        String shapeKey = optional(request, "shapeKey");
        String categoryRef = optional(request, "categoryRef");
        boolean uncategorized = parseBoolean(request, "uncategorized", false);
        boolean includeSubCategories = parseBoolean(request, "includeSubCategories", false);
        String status = optional(request, "status");
        String governanceStatus = optional(request, "governanceStatus");
        String source = optional(request, "source");
        String queryGeneration = optional(request, "queryGeneration");
        boolean itemCodesOnly = request.path("itemCodesOnly").asBoolean(false);
        long offset = itemCodesOnly ? 0 : parseCursor(request, "cursor");
        int pageSize = itemCodesOnly ? 5000 : parsePageSize(request, "pageSize", 20);
        List<String> itemCodes = textArray(request.path("itemCodes"));
        if (request.has("itemCodes") && itemCodes.isEmpty()) { ObjectNode empty = mapper.createObjectNode(); empty.putArray("items"); empty.put("total", 0).putNull("cursor").put("generation", generation(dataNodeRef, brandRef)).put("queryGeneration", queryGeneration == null ? "" : queryGeneration); return envelope(requestId, empty); }

        StringBuilder sql = new StringBuilder("WITH RECURSIVE category_scope(code) AS ("
            + "SELECT c.code FROM catalog.catalog_category c WHERE c.data_node_ref=? AND c.brand_ref=? AND c.code=? AND c.status <> 'VOIDED' "
            + "UNION ALL SELECT child.code FROM catalog.catalog_category child JOIN category_scope parent ON child.parent_code=parent.code "
            + "WHERE child.data_node_ref=? AND child.brand_ref=? AND ? = TRUE AND child.status <> 'VOIDED') "
            + ", filtered AS (SELECT i.item_ref, i.code, i.name, i.shape_key, i.status, i.attributes::text, i.sections::text, i.version, i.updated_at_epoch_millis, i.source_scope_ref "
            + "FROM catalog.catalog_item i WHERE i.data_node_ref=? AND i.brand_ref=?");
        List<Object> args = new ArrayList<>();
        args.add(dataNodeRef); args.add(brandRef); args.add(categoryRef); args.add(dataNodeRef); args.add(brandRef); args.add(includeSubCategories);
        args.add(dataNodeRef); args.add(brandRef);
        if (!itemCodes.isEmpty()) {
            sql.append(" AND i.code IN (").append(String.join(",", Collections.nCopies(itemCodes.size(), "?"))).append(")");
            args.addAll(itemCodes);
        }
        if (keyword == null || keyword.isBlank()) sql.append(" AND (?::text IS NULL)");
        else sql.append(" AND (i.name ILIKE '%' || ? || '%' OR COALESCE(i.sections->>'shortName','') ILIKE '%' || ? || '%' OR i.code ILIKE '%' || ? || '%')");
        if (keyword == null || keyword.isBlank()) args.add(null); else { args.add(keyword); args.add(keyword); args.add(keyword); }
        if (status == null || status.isBlank()) sql.append(" AND i.status <> 'VOIDED'"); else { sql.append(" AND i.status=?"); args.add(status); }
        if (governanceStatus != null && !governanceStatus.isBlank()) { sql.append(" AND COALESCE(i.sections->>'governanceStatus', i.sections->>'governanceState', CASE WHEN COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource') IN ('TEMPORARY','EXTERNAL_ORDER_TEMPORARY') THEN 'GOVERNANCE_TODO' ELSE i.status END)=?"); args.add(governanceStatus); }
        if (shapeKey != null && !shapeKey.isBlank()) { sql.append(" AND i.shape_key=?"); args.add(shapeKey); }
        if (categoryRef == null || categoryRef.isBlank()) sql.append(" AND (?::text IS NULL)");
        else sql.append(" AND EXISTS (SELECT 1 FROM category_scope c WHERE jsonb_exists(i.sections->'categoryRefs', c.code))");
        if (categoryRef == null || categoryRef.isBlank()) args.add(null);
        if (uncategorized) sql.append(" AND (i.sections->'categoryRefs' IS NULL OR jsonb_typeof(i.sections->'categoryRefs') <> 'array' OR jsonb_array_length(i.sections->'categoryRefs')=0)");
        if (smartViewKey != null && !smartViewKey.isBlank()) {
            switch (smartViewKey) {
                case "ALL" -> { }
                case "GOVERNANCE_PENDING" -> sql.append(" AND (i.status='DRAFT' OR i.sections->>'needsAttention'='true')");
                case "EXTERNAL_ORDER_TEMP" -> sql.append(" AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')='EXTERNAL_ORDER_TEMPORARY'");
                case "INACTIVE" -> sql.append(" AND i.status='DISABLED'");
                case "ARCHIVED" -> sql.append(" AND i.status='ARCHIVED'");
                case "RECENTLY_UPDATED" -> sql.append(" AND i.updated_at_epoch_millis >= ?").append(" ");
                case "AUTO_SYNC" -> sql.append(" AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')='AUTO_SYNC'");
                default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "smartViewKey is not supported");
            }
            if ("RECENTLY_UPDATED".equals(smartViewKey)) args.add(now() - 7L * 24L * 60L * 60L * 1000L);
        }
        if (source != null && !source.isBlank()) {
            switch (source) {
                case "SELF_MANAGED" -> sql.append(" AND i.source_scope_ref IS NULL");
                case "COPIED" -> sql.append(" AND i.source_scope_ref IS NOT NULL");
                case "AUTO_SYNC" -> sql.append(" AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource')='AUTO_SYNC'");
                case "TEMPORARY" -> sql.append(" AND COALESCE(i.sections->>'source',i.sections->>'sourceType',i.sections->>'ownershipSource') IN ('TEMPORARY','EXTERNAL_ORDER_TEMPORARY')");
                default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "source is not supported");
            }
        }
        sql.append("), aggregate AS (SELECT COUNT(*) AS total FROM filtered), paged AS (SELECT item_ref, code, name, shape_key, status, attributes, sections, version, updated_at_epoch_millis, source_scope_ref FROM filtered ORDER BY code OFFSET ? LIMIT ?) SELECT p.item_ref, p.code, p.name, p.shape_key, p.status, p.attributes, p.sections, p.version, p.updated_at_epoch_millis, p.source_scope_ref, a.total FROM aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.code"); args.add(offset); args.add(pageSize + 1);
        List<PageItemRow> rows = jdbc.query(sql.toString(), (result, row) -> new PageItemRow(
            result.getObject(1, UUID.class) == null ? null : new ItemRow(result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getString(4), result.getString(5), result.getString(6), result.getString(7), result.getLong(8), result.getLong(9), result.getString(10)), result.getLong(11)), args.toArray());
        boolean hasNext = rows.stream().filter(row -> row.item() != null).count() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        ObjectNode data = mapper.createObjectNode(); ArrayNode array = data.putArray("items"); rows.stream().filter(row -> row.item() != null).forEach(row -> array.add(itemSummary(row.item())));
        long total = rows.isEmpty() ? 0 : rows.get(0).total();
        data.put("total", total).put("generation", generation(dataNodeRef, brandRef)).put("queryGeneration", queryGeneration == null ? "" : queryGeneration);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize)); else data.putNull("cursor");
        return envelope(requestId, data);
    }

    private ObjectNode detail(String dataNodeRef, String brandRef, String requestId, String code) {
        ItemRow row = requireItem(dataNodeRef, brandRef, code);
        JsonNode sections = json(row.sectionsJson());
        ObjectNode data = mapper.createObjectNode().set("item", itemDetail(row, sections));
        ArrayNode tabs = data.putArray("tabs");
        detailTabs(row.shapeKey()).forEach(tab -> tabs.addObject().put("tabKey", tab.asText()).put("visible", true).put("disabled", false).putNull("reason"));
        ArrayNode references = data.putArray("references");
        LinkedHashSet<String> refs = itemReferenceCodes(sections);
        refs.forEach(ref -> references.addObject().put("referenceKind", "ITEM").put("code", ref).put("direction", "OUTBOUND"));
        ArrayNode inventoryBom = data.putArray("inventoryBom");
        JsonNode bom = sections.path("inventoryBom");
        if (bom.isArray()) bom.forEach(entry -> inventoryBom.add(bomEntry(entry)));
        ArrayNode productionTags = data.putArray("productionTags");
        JsonNode tags = sections.path("productionTags");
        if (tags.isArray()) tags.forEach(entry -> productionTags.addObject().put("code", entry.path("code").asText()).put("name", entry.path("name").asText()).put("owner", "fulfillment-production"));
        data.set("orderOptions", orderOptions(sections.path("orderOptions")));
        data.set("compositeGroups", compositeGroups(sections.path("compositeGroups")));
        List<String> deniedFields = sourceDeniedFields(row, sections);
        ObjectNode governance = data.putObject("governance").put("status", governanceStatus(row, sections));
        ArrayNode governanceDenied = governance.putArray("deniedFields"); deniedFields.forEach(governanceDenied::add);
        JsonNode externalIdentity = externalIdentityFact(mapper, sections);
        if (externalIdentity == null) governance.putNull("externalIdentity"); else governance.set("externalIdentity", externalIdentity.deepCopy());
        ObjectNode action = data.putObject("actionAvailability")
            .put("canEdit", !Set.of("ARCHIVED", "VOIDED").contains(row.status()))
            .put("canEnable", !Set.of("ENABLED", "ARCHIVED", "VOIDED").contains(row.status()))
            .put("canDisable", "ENABLED".equals(row.status()))
            .put("canArchive", "DISABLED".equals(row.status()));
        ObjectNode voidAvailability = action.putObject("voidAvailability");
        voidAvailability.put("canVoid", !Set.of("ARCHIVED", "VOIDED").contains(row.status()) && !hasItemDependencies(row));
        voidAvailability.putArray("blockingReferences");
        ArrayNode dependentFacts = voidAvailability.putArray("dependentFacts");
        if (hasItemDependencies(row)) dependentFacts.addObject().put("factKind", "CATALOG_ITEM_DEPENDENCY").put("factRef", row.code());
        ArrayNode denied = data.putArray("deniedFields"); deniedFields.forEach(denied::add);
        boolean sourceOwnedCatalog = "AUTO_SYNC".equals(sourceFact(row, sections));
        data.putObject("fieldOwnership").put("catalog", sourceOwnedCatalog ? "SOURCE" : "CATALOG").put("inventory", "INVENTORY").put("asset", "ASSET");
        data.putObject("queryIdentity").put("dataNodeRef", dataNodeRef).put("generation", generation(dataNodeRef, brandRef));
        return data;
    }

    private ArrayNode detailTabs(String shapeKey) {
        try {
            JsonNode tabs = mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON).path("tabRules").path(shapeKey).path("visible");
            return tabs.isArray() ? (ArrayNode) tabs : mapper.createArrayNode();
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态页签契约不可用");
        }
    }

    private ObjectNode dictionary(String dataNodeRef, String brandRef, String requestId, String kind, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode().put("dictionaryKind", kind);
        ArrayNode entries = data.putArray("entries");
        jdbc.query("SELECT code, name, status, version, updated_at_epoch_millis FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? ORDER BY display_order, code", statement -> { statement.setString(1, dataNodeRef); statement.setString(2, brandRef); statement.setString(3, kind); }, result -> { while (result.next()) { String code = result.getString(1); boolean referenced = dictionaryReferenced(dataNodeRef, brandRef, kind, code); ObjectNode entry = entries.addObject().put("code", code).put("name", result.getString(2)).put("status", result.getString(3)).put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef).put("version", result.getLong(4)).put("updatedAt", result.getLong(5)); ObjectNode voidAvailability = entry.putObject("voidAvailability"); voidAvailability.put("canVoid", !"VOIDED".equals(result.getString(3)) && !referenced); ArrayNode blocking = voidAvailability.putArray("blockingReferences"); if (referenced) blocking.addObject().put("referenceKind", "CATALOG_ITEM").put("referenceRef", code); voidAvailability.putArray("dependentFacts"); } return null; });
        data.putNull("cursor").put("total", entries.size()).put("generation", dictionaryGeneration(dataNodeRef, brandRef, kind));
        return envelope(requestId, data);
    }

    private ObjectNode copyCandidates(String operationId, String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode();
        boolean brandCopy = "getOperationsBrandCatalogCopyCandidates".equals(operationId);
        String sourceDataNodeRef = brandCopy ? required(request, "sourceDataNodeRef") : dataNodeRef;
        data.putObject("sourceScope").put("ownerType", brandCopy ? "HEAD_COMPANY" : "DATA_NODE").put("ownerRef", sourceDataNodeRef).put("brandRef", brandRef);
        data.putObject("targetScope").put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef);
        if (brandCopy) data.put("copySourceAvailable", true);
        ArrayNode entries = data.putArray("items");
        String keyword = optional(request, "keyword");
        List<ItemRow> rows = jdbc.query("SELECT item_ref, code, name, shape_key, status, attributes::text, sections::text, version, updated_at_epoch_millis, source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' AND (?::text IS NULL OR (name ILIKE '%' || ? || '%' OR code ILIKE '%' || ? || '%')) ORDER BY code LIMIT 100", (result, row) -> new ItemRow(result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getString(4), result.getString(5), result.getString(6), result.getString(7), result.getLong(8), result.getLong(9), result.getString(10)), sourceDataNodeRef, brandRef, keyword, keyword, keyword);
        rows.forEach(row -> entries.addObject().put("code", row.code()).put("name", row.name()).put("shapeKey", row.shapeKey()).put("status", row.status()).put("compatibilityHint", "REVIEW_REQUIRED").put("version", row.version()));
        data.putNull("cursor").put("total", entries.size()).put("generation", generation(dataNodeRef, brandRef));
        return envelope(requestId, data);
    }

    private ObjectNode shapeManifest(String requestId) {
        try {
            JsonNode manifest = mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON);
            ObjectNode data = mapper.createObjectNode();
            data.put("revision", CatalogInventoryShapeManifest.REVISION);
            data.put("manifestDigest", CatalogInventoryShapeManifest.MANIFEST_DIGEST);
            data.set("shapeKeys", manifest.path("shapeKeys"));
            data.set("capabilityValues", manifest.path("capabilityValues"));
            for (String key : List.of("modeRules", "shapeRules", "fieldRules", "tabRules", "linkageRules", "typeEffects", "saveSections", "detailSections")) data.set(key, manifest.path(key));
            return envelope(requestId, data);
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态契约不可用");
        }
    }

    private ObjectNode createItem(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "code"); String name = required(request, "name"); String shape = required(request, "shapeKey");
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shape);
        if (!rule.createAllowed() || rule.visibleButDisabled()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shapeKey is not creatable in the current manifest");
        ObjectNode sections = mapper.createObjectNode();
        applyDerivedShapeFields(sections, rule);
        if (request.has("attributes")) sections.set("attributes", request.path("attributes").deepCopy());
        String attributes = canonicalJson(request.get("attributes"));
        long now = now();
        try { jdbc.update("INSERT INTO catalog.catalog_item (item_ref, data_node_ref, brand_ref, code, name, shape_key, status, attributes, sections, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', CAST(? AS JSONB), CAST(? AS JSONB), 1, ?, ?)", UUID.randomUUID(), dataNodeRef, brandRef, code, name, shape, attributes, canonicalJson(sections), now, now); }
        catch (DuplicateKeyException ex) { throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "编码已存在"); }
        return itemCommand(requestId, code, "DRAFT", 1L, false);
    }

    private ObjectNode saveItem(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "itemCode");
        ObjectNode sectionsRequest = request.has("sections") && request.get("sections").isObject() ? (ObjectNode) request.get("sections") : mapper.createObjectNode();
        ObjectNode draft = sectionsRequest.has("catalogDraft") && sectionsRequest.get("catalogDraft").isObject()
            ? (ObjectNode) sectionsRequest.get("catalogDraft") : sectionsRequest;
        long expected = sectionsRequest.has("expectedCatalogVersion")
            ? requiredLong(sectionsRequest, "expectedCatalogVersion", -1)
            : requiredLong(request, "expectedVersion", -1);
        if (expected < 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedCatalogVersion is required");
        ItemRow current = requireItem(dataNodeRef, brandRef, code);
        if ("VOIDED".equals(current.status())) throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废商品不可修改");
        ObjectNode sections = (ObjectNode) json(current.sectionsJson()).deepCopy();
        validateSourceOwnedFields(current, sections, draft);
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(current.shapeKey());
        validateClientDerivedFields(draft, rule);
        applyDerivedShapeFields(sections, rule);
        draft.fields().forEachRemaining(entry -> {
            // Inventory definitions are owned by inventory.stock_target/stock_bom and
            // are coordinated separately in the same REQUIRED transaction.  Keeping a
            // second catalog JSON copy would make the detail surface drift from the
            // owner fact, so the catalog owner deliberately ignores this section.
            if (!"inventoryBom".equals(entry.getKey())) sections.set(entry.getKey(), entry.getValue().deepCopy());
        });
        sectionsRequest.fields().forEachRemaining(entry -> {
            if (!Set.of("catalogDraft", "expectedCatalogVersion", "expectedInventoryVersions").contains(entry.getKey())) sections.set(entry.getKey(), entry.getValue().deepCopy());
        });
        String attributes = sections.has("attributes") ? canonicalJson(sections.get("attributes")) : current.attributesJson();
        String sectionJson = canonicalJson(sections);
        String nextName = draft.has("name") ? required(draft, "name") : current.name();
        int changed = jdbc.update("UPDATE catalog.catalog_item SET name=?, sections=CAST(? AS JSONB), attributes=CAST(? AS JSONB), version=version+1, updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status NOT IN ('ARCHIVED','VOIDED')", nextName, sectionJson, attributes, now(), dataNodeRef, brandRef, code, expected);
        if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        return itemSaveReadback(requestId, code, expected + 1);
    }

    /** The shape manifest is the only authority for fields derived from shapeKey. */
    private CatalogInventoryShapeManifest.ShapeRule shapeRule(String shapeKey) {
        try {
            return CatalogInventoryShapeManifest.SHAPE_RULES.stream().filter(rule -> rule.shapeKey().name().equals(shapeKey)).findFirst()
                .orElseThrow(() -> new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shapeKey is not supported"));
        } catch (CatalogOwnerApi.Problem problem) {
            throw problem;
        }
    }

    private void applyDerivedShapeFields(ObjectNode sections, CatalogInventoryShapeManifest.ShapeRule rule) {
        sections.put("shapeKey", rule.shapeKey().name());
        sections.put("itemKind", rule.itemKind());
        sections.put("measureMode", rule.measureMode());
        sections.put("skuMode", rule.skuMode());
        sections.put("priceGranularity", rule.priceGranularity());
        ArrayNode capabilities = sections.putArray("usageCapabilities");
        rule.usageCapabilities().forEach(capability -> capabilities.add(capability.name()));
    }

    private void validateClientDerivedFields(ObjectNode draft, CatalogInventoryShapeManifest.ShapeRule rule) {
        validateDerivedText(draft, "itemKind", rule.itemKind());
        validateDerivedText(draft, "measureMode", rule.measureMode());
        validateDerivedText(draft, "skuMode", rule.skuMode());
        validateDerivedText(draft, "priceGranularity", rule.priceGranularity());
        JsonNode capabilities = draft.get("usageCapabilities");
        if (capabilities != null && !capabilities.isNull()) {
            if (!capabilities.isArray() || !capabilities.toString().equals(capabilityJson(rule))) {
                throw new CatalogOwnerApi.Problem("SHAPE_DERIVATION_CONFLICT", 422, "usageCapabilities must be derived from shapeKey");
            }
        }
        JsonNode shape = draft.get("shapeKey");
        if (shape != null && !shape.isNull() && !rule.shapeKey().name().equals(shape.asText())) {
            throw new CatalogOwnerApi.Problem("SHAPE_DERIVATION_CONFLICT", 422, "shapeKey cannot change after creation");
        }
    }

    private String capabilityJson(CatalogInventoryShapeManifest.ShapeRule rule) {
        ArrayNode expected = mapper.createArrayNode();
        rule.usageCapabilities().forEach(capability -> expected.add(capability.name()));
        return expected.toString();
    }

    private void validateDerivedText(ObjectNode draft, String field, String expected) {
        JsonNode value = draft.get(field);
        if (value != null && !value.isNull() && !expected.equals(value.asText())) {
            throw new CatalogOwnerApi.Problem("SHAPE_DERIVATION_CONFLICT", 422, field + " must be derived from shapeKey");
        }
    }

    private ObjectNode transitionItem(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "itemCode"); long expected = requiredLong(request, "expectedVersion", 1); String target = required(request, "targetStatus");
        if (!CatalogOwnerTypes.STATUSES.contains(target)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "状态不在闭集");
        ItemRow current = requireItem(dataNodeRef, brandRef, code);
        if ("VOIDED".equals(current.status())) throw new CatalogOwnerApi.Problem("VOIDED_RECORD_IMMUTABLE", 409, "已作废记录不可修改");
        if (expected != current.version()) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        if ("ENABLED".equals(target) && !"ENABLED".equals(current.status())) validateItemActivation(current);
        if ("VOIDED".equals(target) && itemReferencedByOtherItems(dataNodeRef, brandRef, code)) throw new CatalogOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, "商品仍被其他商品引用，不能作废");
        if ("VOIDED".equals(target) && hasItemDependencies(current)) throw new CatalogOwnerApi.Problem("DEPENDENT_FACTS_BLOCK_VOID", 422, "商品仍有依赖事实，不能作废");
        if (jdbc.update("UPDATE catalog.catalog_item SET status=?, version=version+1, updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?", target, now(), dataNodeRef, brandRef, code, expected) != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "商品版本已变化");
        return itemCommand(requestId, code, target, expected + 1, false);
    }

    private void validateItemActivation(ItemRow row) {
        JsonNode sections = json(row.sectionsJson());
        JsonNode ordering = sections.path("ordering").isObject() ? sections.path("ordering") : sections;
        String priceGranularity = ordering.path("priceGranularity").asText("ITEM");
        if ("SKU".equals(priceGranularity)) {
            JsonNode skus = sections.path("skus");
            boolean hasEnabled = false;
            if (skus.isArray()) for (JsonNode sku : skus) {
                if (!"ENABLED".equals(sku.path("status").asText("ENABLED"))) continue;
                hasEnabled = true;
                if (!sku.path("standardSalePrice").isIntegralNumber()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "启用前请为每个启用 SKU 补齐标准价");
            }
            if (!hasEnabled) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "启用前请至少维护一个启用 SKU");
            return;
        }
        if (!ordering.path("standardSalePrice").isIntegralNumber()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "启用前请补齐商品标准价");
    }

    private ObjectNode createCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String code=required(request,"code"), name=required(request,"name"), parent=optional(request,"parentCode"); validateCategoryDepth(dataNodeRef, brandRef, code, parent); try { jdbc.update("INSERT INTO catalog.catalog_category (category_ref,data_node_ref,brand_ref,code,name,parent_code,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),dataNodeRef,brandRef,code,name,parent,now(),now()); } catch(DuplicateKeyException ex){throw new CatalogOwnerApi.Problem("DUPLICATE_CODE",409,"分类编码已存在");} return categoryCommand(requestId, code, 1L); }
    private ObjectNode updateCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String code=required(request,"categoryCode"),name=required(request,"name"); long expected=requiredLong(request,"expectedVersion",1); if(jdbc.update("UPDATE catalog.catalog_category SET name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",name,now(),dataNodeRef,brandRef,code,expected)!=1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT",409,"分类版本已变化"); return categoryCommand(requestId, code, expected+1); }
    private ObjectNode moveCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String code=required(request,"categoryCode"),parent=optional(request,"parentCode"); long expected=requiredLong(request,"expectedVersion",1); if(code.equals(parent) || createsCategoryCycle(dataNodeRef, brandRef, code, parent)) throw new CatalogOwnerApi.Problem("HIERARCHY_CYCLE",422,"分类移动会形成循环"); validateCategoryDepth(dataNodeRef, brandRef, code, parent); if(jdbc.update("UPDATE catalog.catalog_category SET parent_code=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",parent,now(),dataNodeRef,brandRef,code,expected)!=1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT",409,"分类版本已变化"); return categoryCommand(requestId, code, expected+1); }

    /** Two levels is an owner invariant, not merely a disabled UI affordance. */
    private void validateCategoryDepth(String scope, String brand, String code, String proposedParent) {
        if (proposedParent == null || proposedParent.isBlank()) {
            // A moved/created root may still have descendants only if the subtree itself is at most two levels.
            if (codeExists(scope, brand, code) && subtreeDepth(scope, brand, code, null) > 2) throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "分类层级最多支持两级");
            return;
        }
        String parentParent = jdbc.query("SELECT parent_code FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=? AND status <> 'VOIDED'", s -> { s.setString(1, scope); s.setString(2, brand); s.setString(3, proposedParent); }, r -> { if (!r.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "目标父分类不存在"); return r.getString(1); });
        if (parentParent != null && !parentParent.isBlank()) throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "分类层级最多支持两级");
        if (codeExists(scope, brand, code) && subtreeDepth(scope, brand, code, proposedParent) > 2) throw new CatalogOwnerApi.Problem("CATEGORY_DEPTH_EXCEEDED", 422, "移动后分类后代超过两级");
    }

    private boolean codeExists(String scope, String brand, String code) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=?", Integer.class, scope, brand, code);
        return count != null && count > 0;
    }

    private int subtreeDepth(String scope, String brand, String code, String proposedParent) {
        Map<String, List<String>> children = new LinkedHashMap<>();
        jdbc.query("SELECT code,parent_code FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'", s -> { s.setString(1, scope); s.setString(2, brand); }, r -> { while (r.next()) children.computeIfAbsent(r.getString(2) == null ? "" : r.getString(2), ignored -> new ArrayList<>()).add(r.getString(1)); return null; });
        if (proposedParent != null) {
            String oldParent = jdbc.query("SELECT parent_code FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=?", s -> { s.setString(1, scope); s.setString(2, brand); s.setString(3, code); }, r -> { if (!r.next()) return null; return r.getString(1); });
            children.getOrDefault(oldParent == null ? "" : oldParent, List.of()).remove(code);
            children.computeIfAbsent(proposedParent, ignored -> new ArrayList<>()).add(code);
        }
        return subtreeDepth(code, children, new LinkedHashSet<>());
    }

    private int subtreeDepth(String code, Map<String, List<String>> children, Set<String> path) {
        if (!path.add(code)) throw new CatalogOwnerApi.Problem("HIERARCHY_CYCLE", 422, "分类移动会形成循环");
        int max = 1;
        for (String child : children.getOrDefault(code, List.of())) max = Math.max(max, 1 + subtreeDepth(child, children, path));
        path.remove(code);
        return max;
    }
    private ObjectNode transitionCategory(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String code=required(request,"categoryCode"),status=required(request,"targetStatus"); long expected=requiredLong(request,"expectedVersion",1); if(!List.of("ENABLED","DISABLED","VOIDED").contains(status)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,"分类状态不合法"); if("VOIDED".equals(status) && categoryReferenced(dataNodeRef, brandRef, code)) throw new CatalogOwnerApi.Problem("REFERENCE_BLOCKS_VOID",422,"分类仍被商品引用，不能作废"); if("VOIDED".equals(status) && categoryHasChildren(dataNodeRef, brandRef, code)) throw new CatalogOwnerApi.Problem("DEPENDENT_FACTS_BLOCK_VOID",422,"分类仍有子分类，不能作废"); if(jdbc.update("UPDATE catalog.catalog_category SET status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",status,now(),dataNodeRef,brandRef,code,expected)!=1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT",409,"分类版本已变化"); return categoryCommand(requestId, code, expected+1); }
    private ObjectNode createDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String kind=requiredDictionaryKind(request),code=required(request,"code"),name=required(request,"name"); try{jdbc.update("INSERT INTO catalog.dictionary_entry (entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),dataNodeRef,brandRef,kind,code,name,now(),now());}catch(DuplicateKeyException ex){throw new CatalogOwnerApi.Problem("DUPLICATE_CODE",409,"字典编码已存在");} return dictionaryCommand(requestId, kind, code, name, "ENABLED", 1L); }
    private ObjectNode updateDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String kind=requiredDictionaryKind(request),code=required(request,"entryCode"),name=required(request,"name"); long expected=requiredLong(request,"expectedVersion",1); if(jdbc.update("UPDATE catalog.dictionary_entry SET name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND version=? AND status <> 'VOIDED'",name,now(),dataNodeRef,brandRef,kind,code,expected)!=1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT",409,"字典版本已变化"); return dictionaryCommand(requestId, kind, code, name, dictionaryStatus(dataNodeRef,brandRef,kind,code), expected+1); }
    private ObjectNode reorderDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String kind=requiredDictionaryKind(request); JsonNode codes=request.get("orderedCodes"); if(codes==null||!codes.isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,"orderedCodes 必须为数组"); for(int i=0;i<codes.size();i++) jdbc.update("UPDATE catalog.dictionary_entry SET display_order=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND status <> 'VOIDED'",i,now(),dataNodeRef,brandRef,kind,codes.get(i).asText()); return dictionary(dataNodeRef,brandRef,requestId,kind,request); }
    private ObjectNode transitionDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) { String kind=requiredDictionaryKind(request),code=required(request,"entryCode"),status=required(request,"targetStatus"); long expected=requiredLong(request,"expectedVersion",1); if(!List.of("ENABLED","DISABLED","VOIDED").contains(status)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,"字典状态不合法"); if("VOIDED".equals(status) && dictionaryReferenced(dataNodeRef, brandRef, kind, code)) throw new CatalogOwnerApi.Problem("REFERENCE_BLOCKS_VOID",422,"字典条目仍被商品引用，不能作废"); if(jdbc.update("UPDATE catalog.dictionary_entry SET status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND version=? AND status <> 'VOIDED'",status,now(),dataNodeRef,brandRef,kind,code,expected)!=1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT",409,"字典版本已变化"); return dictionaryCommand(requestId, kind, code, dictionaryName(dataNodeRef,brandRef,kind,code), status, expected+1); }
    private ObjectNode promotionPreflight(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ItemRow row = requireItem(dataNodeRef, brandRef, required(request, "itemCode"));
        JsonNode sections = json(row.sectionsJson());
        boolean temporary = "TEMPORARY".equalsIgnoreCase(firstText(sections, "source", "sourceType", "ownershipSource"))
            || "TEMPORARY".equals(row.status());
        String formalCode = required(request, "formalCode");
        validateCatalogCode(formalCode);
        String shapeKey = required(request, "shapeKey");
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shapeKey);
        String name = required(request, "name");
        long expectedSourceVersion = requiredLong(request, "expectedSourceVersion", -1);
        if (expectedSourceVersion < 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedSourceVersion is required");
        ArrayNode blockedReasons = mapper.createArrayNode();
        if (!temporary) blockedReasons.add("当前商品不是外部订单临时商品");
        if (expectedSourceVersion != row.version()) blockedReasons.add("VERSION_CONFLICT");
        if (rule.visibleButDisabled()) blockedReasons.add(rule.disabledReason());
        String materialRole = optional(request, "materialRole");
        if ("MATERIAL".equals(shapeKey) && (materialRole == null || materialRole.isBlank())) blockedReasons.add("MATERIAL_ROLE_REQUIRED");
        boolean formalCodeAvailable = formalCodeAvailable(dataNodeRef, brandRef, formalCode, row.ref());
        if (!formalCodeAvailable) blockedReasons.add("DUPLICATE_CODE");
        JsonNode attributes = request.has("attributes") ? request.path("attributes") : json(row.attributesJson());
        if (!attributes.isObject()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "attributes must be an object");
        ObjectNode item = mapper.createObjectNode().put("code", row.code()).put("name", row.name()).put("shapeKey", row.shapeKey());
        ObjectNode proposed = mapper.createObjectNode().put("code", formalCode).put("name", name).put("shapeKey", shapeKey);
        if (materialRole == null) proposed.putNull("materialRole"); else proposed.put("materialRole", materialRole);
        ObjectNode detail = mapper.createObjectNode().set("item", item);
        detail.put("source", firstText(sections, "source", "sourceType", "ownershipSource") == null ? "TEMPORARY" : firstText(sections, "source", "sourceType", "ownershipSource"));
        detail.set("proposed", proposed);
        detail.put("sourceVersion", row.version()).put("formalCodeAvailable", formalCodeAvailable);
        ArrayNode requiredFields = detail.putArray("requiredFields");
        requiredFields.add("formalCode").add("shapeKey").add("name");
        if ("MATERIAL".equals(shapeKey)) requiredFields.add("materialRole");
        detail.putArray("blockedReasons").addAll(blockedReasons);
        detail.set("changes", promotionChanges(row, formalCode, shapeKey, name, materialRole));
        detail.put("preflightDigest", promotionDigest(row, request, rule));
        detail.put("canPromote", temporary && blockedReasons.isEmpty());
        ObjectNode model = mapper.createObjectNode().put("revision", CatalogOwnerTypes.REVISION).put("requestId", requestId).set("data", detail);
        return envelope(requestId, model);
    }
    private ObjectNode promotionExecute(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String code = required(request, "itemCode");
        long expected = requiredLong(request, "expectedVersion", -1);
        long expectedSourceVersion = requiredLong(request, "expectedSourceVersion", -1);
        if (expected < 0 || expectedSourceVersion < 0) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedVersion and expectedSourceVersion are required");
        String formalCode = required(request, "formalCode");
        validateCatalogCode(formalCode);
        String shapeKey = required(request, "shapeKey");
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(shapeKey);
        String name = required(request, "name");
        String submittedDigest = required(request, "preflightDigest");
        ItemRow row = requireItem(dataNodeRef, brandRef, code);
        JsonNode sections = json(row.sectionsJson());
        String source = firstText(sections, "source", "sourceType", "ownershipSource");
        if (!("TEMPORARY".equalsIgnoreCase(source) || "TEMPORARY".equals(row.status()))) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "只有外部订单临时商品可以转正");
        }
        if (expected != row.version() || expectedSourceVersion != row.version() || !submittedDigest.equals(promotionDigest(row, request, rule))) {
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "临时商品来源或转正资料已变化，请重新预检");
        }
        String materialRole = optional(request, "materialRole");
        if ("MATERIAL".equals(shapeKey) && (materialRole == null || materialRole.isBlank())) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "MATERIAL_ROLE_REQUIRED");
        if (!formalCodeAvailable(dataNodeRef, brandRef, formalCode, row.ref())) throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "正式商品编码已存在或已被历史记录占用");
        JsonNode attributes = request.has("attributes") ? request.path("attributes") : json(row.attributesJson());
        if (!attributes.isObject()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "attributes must be an object");
        ObjectNode promotedSections = promotedSections(row, rule, materialRole, optional(request, "shortName"));
        String attributesJson = canonicalJson(attributes);
        if (formalCode.equals(code)) {
            if (jdbc.update("UPDATE catalog.catalog_item SET name=?,shape_key=?,status='DRAFT',attributes=CAST(? AS JSONB),sections=CAST(? AS JSONB),version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?", name, shapeKey, attributesJson, canonicalJson(promotedSections), now(), dataNodeRef, brandRef, code, expected) != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "临时商品版本已变化");
            return itemCommand(requestId, formalCode, "DRAFT", expected + 1, false);
        }
        try {
            jdbc.update("INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,source_item_code,source_scope_ref,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?, 'DRAFT',CAST(? AS JSONB),CAST(? AS JSONB),?,?,1,?,?)", UUID.randomUUID(), dataNodeRef, brandRef, formalCode, name, shapeKey, attributesJson, canonicalJson(promotedSections), code, dataNodeRef, now(), now());
        } catch (DuplicateKeyException ex) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "正式商品编码已存在或已被历史记录占用");
        }
        if (jdbc.update("UPDATE catalog.catalog_item SET status='ARCHIVED',version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=?", now(), dataNodeRef, brandRef, code, expected) != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "临时商品版本已变化");
        return itemCommand(requestId, formalCode, "DRAFT", 1L, false);
    }

    private ObjectNode copyPreflight(String operationId, String source, String target, String brandRef, String requestId, List<String> selected, CatalogClosure graph, long sourceVersion, long targetVersion, String preflightDigest) {
        List<ItemRow> rows = graph.items();
        ObjectNode data=mapper.createObjectNode();
        ObjectNode sourceScope=data.putObject("sourceScope").put("ownerType", operationId.contains("Brand") ? "HEAD_COMPANY" : "DATA_NODE").put("ownerRef",source).put("brandRef",brandRef);
        ObjectNode targetScope=data.putObject("targetScope").put("ownerType","DATA_NODE").put("ownerRef",target).put("brandRef",brandRef);
        data.put("selectedCount",selected.size()).put("selectedLimit",copyLimits.selectedItemCount()).put("closureCount",graph.size()).put("closureLimit",copyLimits.closureItemCount()).put("preflightDigest",preflightDigest);
        ArrayNode selectedItems=data.putArray("selectedItems"); rows.stream().filter(row->selected.contains(row.code())).forEach(row -> selectedItems.addObject().put("objectType","CATALOG_ITEM").put("code",row.code()).put("name",row.name()));
        ArrayNode closureItems=data.putArray("closureItems");
        rows.forEach(row -> closureItems.addObject().put("objectType","CATALOG_ITEM").put("code",row.code()).put("name",row.name()).put("action", "REUSE_OR_CREATE"));
        graph.categories().forEach(row -> closureItems.addObject().put("objectType","CATALOG_CATEGORY").put("code",row.code()).put("name",row.name()).put("action", "REUSE_OR_CREATE"));
        graph.dictionaries().forEach(row -> closureItems.addObject().put("objectType",row.objectType()).put("code",row.code()).put("name",row.name()).put("action", "REUSE_OR_CREATE"));
        ArrayNode closureEdges=data.putArray("closureEdges"); graph.edges().forEach(edge -> closureEdges.addObject().put("fromCode",edge.fromCode()).put("toCode",edge.toCode()).put("referenceKind",edge.referenceKind()));
        ArrayNode versions=data.putArray("objectVersions");
        rows.forEach(row -> versions.addObject().put("objectType","CATALOG_ITEM").put("code",row.code()).put("sourceVersion",row.version()).put("targetVersion",targetVersion));
        graph.categories().forEach(row -> versions.addObject().put("objectType","CATALOG_CATEGORY").put("code",row.code()).put("sourceVersion",row.version()).put("targetVersion",targetObjectVersion(target, brandRef, row)));
        graph.dictionaries().forEach(row -> versions.addObject().put("objectType",row.objectType()).put("code",row.code()).put("sourceVersion",row.version()).put("targetVersion",targetObjectVersion(target, brandRef, row)));
        ArrayNode mappings=data.putArray("mappingPreview"); ArrayNode compatibility=data.putArray("compatibilityResults"); ArrayNode rewrites=data.putArray("referenceRewritePreview");
        Map<String, ItemRow> targetRows = new LinkedHashMap<>();
        if (!rows.isEmpty()) loadItems(target, brandRef, rows.stream().map(ItemRow::code).toList()).forEach(row -> targetRows.put(row.code(), row));
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>(); graph.objects().forEach(row -> mapping.put(new ReferenceKey(row.objectType(), row.code()), row.code()));
        int blockingCount = 0;
        for (ItemRow row : rows) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            mappings.addObject().put("fromCode",row.code()).put("toCode",row.code()).put("referenceKind","CATALOG_ITEM").put("status",check.result());
            compatibility.addObject().put("objectType","CATALOG_ITEM").put("result",check.result()).put("reason",check.reason());
            if (check.blocking()) blockingCount++;
        }
        graph.categories().forEach(row -> mappings.addObject().put("fromCode",row.code()).put("toCode",row.code()).put("referenceKind",row.objectType()).put("status","REUSE_OR_CREATE"));
        graph.dictionaries().forEach(row -> mappings.addObject().put("fromCode",row.code()).put("toCode",row.code()).put("referenceKind",row.objectType()).put("status","REUSE_OR_CREATE"));
        graph.edges().forEach(edge -> rewrites.addObject().put("fromCode",edge.toCode()).put("toCode",edge.toCode()).put("referenceKind",edge.referenceKind()));
        graph.dictionaries().forEach(row -> compatibility.addObject().put("objectType",row.objectType()).put("result","REUSE_OR_CREATE").put("reason","按编码复用或创建"));
        data.put("blockingCount", blockingCount).put("confirmationRequiredCount", Math.max(0, graph.size() - blockingCount));
        if (operationId.contains("Brand")) return data;
        return envelope(requestId,data);
    }

    private ObjectNode category(String dataNodeRef,String brandRef,String code){ return jdbc.query("SELECT code,name,parent_code,status,version FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=?",s->{s.setString(1,dataNodeRef);s.setString(2,brandRef);s.setString(3,code);},r->{if(!r.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND",404,"分类不存在"); return mapper.createObjectNode().put("code",r.getString(1)).put("name",r.getString(2)).put("parentCode",r.getString(3)).put("status",r.getString(4)).put("version",r.getLong(5));}); }
    private ObjectNode categoryCommand(String requestId, String code, long version) {
        ObjectNode node = mapper.createObjectNode().put("revision", CatalogOwnerTypes.REVISION).put("requestId", requestId);
        ObjectNode result = node.putObject("result").put("code", code).put("name", "").put("status", "ENABLED").put("version", version);
        node.put("version", version);
        return node;
    }
    private ObjectNode dictionaryCommand(String requestId, String kind, String code, String name, String status, long version) {
        ObjectNode node = mapper.createObjectNode().put("revision", CatalogOwnerTypes.REVISION).put("requestId", requestId);
        node.putObject("result").put("dictionaryKind", kind).put("code", code).put("name", name).put("status", status).put("version", version);
        node.put("version", version);
        return node;
    }
    static void validateCatalogCode(String code) {
        if (code == null || !code.matches("[A-Z0-9][A-Z0-9_-]{1,63}")) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "formalCode must be 2-64 uppercase letters, digits, underscore or hyphen");
    }
    private boolean formalCodeAvailable(String dataNodeRef, String brandRef, String code, UUID currentRef) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? AND item_ref<>?", Long.class, dataNodeRef, brandRef, code, currentRef);
        return count == null || count == 0;
    }
    private ArrayNode promotionChanges(ItemRow row, String formalCode, String shapeKey, String name, String materialRole) {
        ArrayNode changes = mapper.createArrayNode();
        changes.addObject().put("field", "code").put("before", row.code()).put("after", formalCode);
        changes.addObject().put("field", "name").put("before", row.name()).put("after", name);
        changes.addObject().put("field", "shapeKey").put("before", row.shapeKey()).put("after", shapeKey);
        String beforeRole = firstText(json(row.sectionsJson()), "materialRole");
        ObjectNode role = changes.addObject().put("field", "materialRole");
        if (beforeRole == null) role.putNull("before"); else role.put("before", beforeRole);
        if (materialRole == null) role.putNull("after"); else role.put("after", materialRole);
        return changes;
    }
    private String promotionDigest(ItemRow row, ObjectNode request, CatalogInventoryShapeManifest.ShapeRule rule) {
        ObjectNode snapshot = mapper.createObjectNode().put("itemCode", row.code()).put("sourceVersion", row.version())
            .put("formalCode", required(request, "formalCode")).put("shapeKey", rule.shapeKey().name()).put("name", required(request, "name"));
        String shortName = optional(request, "shortName");
        if (shortName == null) snapshot.putNull("shortName"); else snapshot.put("shortName", shortName);
        String materialRole = optional(request, "materialRole");
        if (materialRole == null) snapshot.putNull("materialRole"); else snapshot.put("materialRole", materialRole);
        JsonNode attributes = request.has("attributes") ? request.path("attributes") : json(row.attributesJson());
        snapshot.set("attributes", attributes.deepCopy());
        return hash(snapshot);
    }
    private ObjectNode promotedSections(ItemRow row, CatalogInventoryShapeManifest.ShapeRule rule, String materialRole, String shortName) {
        ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
        applyDerivedShapeFields(sections, rule);
        sections.put("source", "SELF_MANAGED").put("promotedFromTemporaryCode", row.code());
        if (shortName == null) {
            String previousShortName = firstText(sections, "shortName");
            if (previousShortName != null) sections.put("shortName", previousShortName);
        } else sections.put("shortName", shortName);
        if (materialRole == null) sections.remove("materialRole"); else sections.put("materialRole", materialRole);
        return sections;
    }
    private ObjectNode itemCommand(String requestId, String code, String status, long version, boolean canArchive) {
        ObjectNode node = mapper.createObjectNode().put("revision", CatalogOwnerTypes.REVISION).put("requestId", requestId);
        ObjectNode result = node.putObject("result").put("operation", "CATALOG_ITEM").put("resourceRef", code).put("status", status).put("version", version);
        result.putArray("ownerReadbacks").addObject().put("owner", "catalog").put("status", "COMMITTED").put("version", version);
        ObjectNode actions = result.putObject("actionAvailability");
        actions.put("canEdit", !Set.of("ARCHIVED", "VOIDED").contains(status));
        actions.put("canEnable", !Set.of("ENABLED", "ARCHIVED", "VOIDED").contains(status));
        actions.put("canDisable", "ENABLED".equals(status));
        actions.put("canArchive", canArchive && "DISABLED".equals(status));
        ObjectNode voidAvailability = actions.putObject("voidAvailability");
        voidAvailability.put("canVoid", !Set.of("ARCHIVED", "VOIDED").contains(status));
        voidAvailability.putArray("blockingReferences");
        voidAvailability.putArray("dependentFacts");
        node.put("version", version);
        return node;
    }
    private ObjectNode itemSaveReadback(String requestId, String code, long version) {
        ObjectNode node = mapper.createObjectNode().put("revision", CatalogOwnerTypes.REVISION).put("requestId", requestId);
        node.putObject("result").putObject("item").put("factType", "CATALOG_ITEM").put("revision", CatalogOwnerTypes.REVISION);
        node.with("result").putArray("inventoryBom");
        node.with("result").putArray("productionTags");
        node.with("result").put("version", version);
        node.put("version", version);
        return node;
    }
    private boolean hasItemDependencies(ItemRow row) {
        JsonNode sections = json(row.sectionsJson());
        return sections.path("skuCount").asInt(0) > 0
            || (sections.path("identifiers").isArray() && sections.path("identifiers").size() > 0)
            || (sections.path("inventoryBom").isArray() && sections.path("inventoryBom").size() > 0)
            || (sections.path("productionTags").isArray() && sections.path("productionTags").size() > 0)
            || (sections.path("skus").isArray() && sections.path("skus").size() > 0);
    }
    private boolean itemReferencedByOtherItems(String scope, String brand, String code) {
        return jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' AND code <> ?", s -> { s.setString(1, scope); s.setString(2, brand); s.setString(3, code); }, r -> { while (r.next()) { if (itemReferenceCodes(json(r.getString(1))).contains(code)) return true; } return false; });
    }
    private boolean categoryReferenced(String scope, String brand, String code) {
        return jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'", s -> { s.setString(1, scope); s.setString(2, brand); }, r -> { while (r.next()) { JsonNode sections = json(r.getString(1)); if (sections.path("categoryRefs").isArray() && containsText(sections.path("categoryRefs"), code)) return true; } return false; });
    }
    private boolean dictionaryReferenced(String scope, String brand, String kind, String code) {
        String referenceKind = canonicalDictionaryKind(kind);
        return jdbc.query("SELECT sections::text FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED'", s -> { s.setString(1, scope); s.setString(2, brand); }, r -> { while (r.next()) { if (typedReferences(json(r.getString(1))).stream().anyMatch(ref -> referenceKind.equals(ref.referenceKind()) && code.equals(ref.code()))) return true; } return false; });
    }

    private Set<String> imageAssetRefs(JsonNode sections) {
        Set<String> refs = new LinkedHashSet<>();
        JsonNode images = sections.path("images");
        if (!images.isArray()) return refs;
        images.forEach(image -> {
            if (image.isTextual() && !image.asText().isBlank()) refs.add(image.asText());
            else if (image.isObject() && image.hasNonNull("assetRef") && !image.path("assetRef").asText().isBlank()) refs.add(image.path("assetRef").asText());
        });
        return refs;
    }
    private boolean categoryHasChildren(String scope, String brand, String code) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND parent_code=? AND status <> 'VOIDED'", Integer.class, scope, brand, code); return count != null && count > 0;
    }
    private LinkedHashSet<String> itemReferenceCodes(JsonNode node) {
        LinkedHashSet<String> refs = new LinkedHashSet<>();
        typedReferences(node).stream().filter(ref -> isItemReference(ref.referenceKind())).forEach(ref -> refs.add(ref.code()));
        return refs;
    }
    private boolean containsText(JsonNode values, String code) { if (!values.isArray()) return false; for (JsonNode value : values) if (value.isTextual() && code.equals(value.asText())) return true; return false; }
    private ObjectNode envelope(String requestId, JsonNode data){ return mapper.createObjectNode().put("revision",CatalogOwnerTypes.REVISION).put("requestId",requestId).set("data",data); }
    private ObjectNode itemSummary(ItemRow row){
        JsonNode sections = json(row.sectionsJson());
        ObjectNode item = mapper.createObjectNode();
        JsonNode images = sections.path("images");
        if (images.isArray() && !images.isEmpty()) item.put("primaryImageAssetRef", images.get(0).isTextual() ? images.get(0).asText() : images.get(0).path("assetRef").asText()); else item.putNull("primaryImageAssetRef");
        String shortName = sections.path("shortName").isTextual() ? sections.path("shortName").asText() : null;
        if (shortName == null || shortName.isBlank()) item.putNull("shortName"); else item.put("shortName", shortName);
        item.put("code",row.code()).put("name",row.name());
        ArrayNode categoryRefs = item.putArray("categoryRefs"); if (sections.path("categoryRefs").isArray()) sections.path("categoryRefs").forEach(value -> categoryRefs.add(value.asText()));
        ArrayNode productionTagRefs = item.putArray("productionTagRefs"); if (sections.path("productionTagRefs").isArray()) sections.path("productionTagRefs").forEach(value -> productionTagRefs.add(value.asText()));
        item.put("shapeKey",row.shapeKey()).put("status",row.status()).put("governanceStatus",governanceStatus(row, sections));
        if (sections.has("materialRole") && !sections.path("materialRole").isNull()) item.put("materialRole", sections.path("materialRole").asText()); else item.putNull("materialRole");
        item.put("source", sourceFact(row, sections));
        JsonNode skuValues = sections.path("skus");
        int skuTotal = skuValues.isArray() ? skuValues.size() : sections.path("skuSummary").path("totalCount").asInt(0);
        int skuEnabled = sections.path("skuSummary").path("enabledCount").asInt(0);
        int skuNonArchived = sections.path("skuSummary").path("nonArchivedCount").asInt(skuTotal);
        item.put("skuEnabledCount", skuEnabled).put("skuNonArchivedCount", skuNonArchived).put("skuTotalCount", skuTotal);
        ArrayNode dimensions = item.putArray("skuDimensionSummary"); if (sections.path("skuSummary").path("dimensions").isArray()) sections.path("skuSummary").path("dimensions").forEach(value -> dimensions.add(value.asText()));
        JsonNode ordering = sections.path("ordering").isObject() ? sections.path("ordering") : sections;
        putNullableLong(item, "standardSalePrice", ordering.path("standardSalePrice"));
        putNullableLong(item, "listedSalePrice", ordering.path("listedSalePrice"));
        putNullableLong(item, "standardPriceDelta", ordering.path("standardPriceDelta"));
        putNullableLong(item, "standardExtraPrice", ordering.path("standardExtraPrice"));
        item.put("priceGranularity", ordering.path("priceGranularity").asText("ITEM")).put("missingPriceCount", ordering.path("missingPriceCount").asInt(0));
        item.put("stockTargetCount",0).put("bomCount", sections.path("inventoryBom").isArray() ? sections.path("inventoryBom").size() : 0); item.putArray("riskFlags"); item.put("version",row.version()).put("updatedAt",row.updatedAt());
        return item;
    }

    private void putNullableLong(ObjectNode target, String key, JsonNode value) {
        if (value != null && value.isIntegralNumber()) target.put(key, value.asLong()); else target.putNull(key);
    }
    private String sourceFact(ItemRow row, JsonNode sections) {
        String source = firstText(sections, "source", "sourceType", "ownershipSource");
        if ("AUTO_SYNC".equals(source)) return "AUTO_SYNC";
        if ("TEMPORARY".equals(source) || "EXTERNAL_ORDER_TEMPORARY".equals(source)) return "TEMPORARY";
        return row.sourceScopeRef() == null ? "SELF_MANAGED" : "COPIED";
    }

    /** Source ownership is a server fact. The explicit section list wins; AUTO_SYNC has a safe minimum. */
    private List<String> sourceDeniedFields(ItemRow row, JsonNode sections) {
        LinkedHashSet<String> denied = new LinkedHashSet<>();
        JsonNode declared = sections.path("deniedFields");
        if (declared.isArray()) declared.forEach(value -> { if (value.isTextual() && !value.asText().isBlank()) denied.add(value.asText()); });
        if ("AUTO_SYNC".equals(sourceFact(row, sections)) && denied.isEmpty()) { denied.add("name"); denied.add("code"); }
        return List.copyOf(denied);
    }

    private void validateSourceOwnedFields(ItemRow row, JsonNode currentSections, ObjectNode draft) {
        for (String field : sourceDeniedFields(row, currentSections)) {
            JsonNode next = draft.get(field);
            if (next == null) continue;
            boolean changed;
            if ("name".equals(field)) changed = !row.name().equals(next.asText());
            else changed = !canonicalJson(currentSections.get(field)).equals(canonicalJson(next));
            if (changed) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字段由同步来源维护：" + field);
        }
    }

    private String governanceStatus(ItemRow row, JsonNode sections) {
        String governance = firstText(sections, "governanceStatus", "governanceState");
        if (governance != null) return governance;
        return "TEMPORARY".equals(sourceFact(row, sections)) ? "GOVERNANCE_TODO" : row.status();
    }
    private ObjectNode itemDetail(ItemRow row, JsonNode sections) {
        ObjectNode item = mapper.createObjectNode().put("code", row.code()).put("name", row.name());
        if (sections.has("shortName") && !sections.path("shortName").isNull()) item.put("shortName", sections.path("shortName").asText()); else item.putNull("shortName");
        item.put("shapeKey", row.shapeKey());
        if (sections.has("materialRole") && !sections.path("materialRole").isNull()) item.put("materialRole", sections.path("materialRole").asText()); else item.putNull("materialRole");
        ArrayNode categoryRefs = item.putArray("categoryRefs"); if (sections.path("categoryRefs").isArray()) sections.path("categoryRefs").forEach(value -> categoryRefs.add(value.asText()));
        ArrayNode productionTagRefs = item.putArray("productionTagRefs"); if (sections.path("productionTagRefs").isArray()) sections.path("productionTagRefs").forEach(value -> productionTagRefs.add(value.asText()));
        CatalogInventoryShapeManifest.ShapeRule rule = shapeRule(row.shapeKey());
        item.put("itemKind", rule.itemKind()).put("measureMode", rule.measureMode());
        ArrayNode capabilities = item.putArray("usageCapabilities"); rule.usageCapabilities().forEach(capability -> capabilities.add(capability.name()));
        ArrayNode images = item.putArray("images"); JsonNode imageValues = sections.path("images"); if (imageValues.isArray()) imageValues.forEach(v -> images.add(v.isTextual() ? v.asText() : v.path("assetRef").asText()));
        ArrayNode identifiers = item.putArray("identifiers"); JsonNode idValues = sections.path("identifiers"); if (idValues.isArray()) idValues.forEach(v -> identifiers.addObject().put("kind",v.path("kind").asText()).put("code",v.path("code").asText()).put("value",v.path("value").asText()));
        JsonNode skuSummary = sections.path("skuSummary");
        ObjectNode sku = item.putObject("skuSummary").put("enabledCount", skuSummary.path("enabledCount").asInt(0)).put("nonArchivedCount", skuSummary.path("nonArchivedCount").asInt(0)).put("totalCount", skuSummary.path("totalCount").asInt(0));
        ArrayNode skuDimensions = sku.putArray("dimensions"); if (skuSummary.path("dimensions").isArray()) skuSummary.path("dimensions").forEach(value -> skuDimensions.add(value.asText()));
        item.set("skuVariantDimensions", skuVariantDimensions(sections.path("skuVariantDimensions")));
        item.set("skus", skuRows(sections.path("skus")));
        JsonNode orderingSource = sections.path("ordering").isObject() ? sections.path("ordering") : sections;
        ObjectNode ordering = item.putObject("ordering").put("priceGranularity", orderingSource.path("priceGranularity").asText("ITEM")).putNull("standardSalePrice").putNull("listedSalePrice").put("missingPriceCount", orderingSource.path("missingPriceCount").asInt(0));
        if (orderingSource.path("standardSalePrice").isIntegralNumber()) ordering.put("standardSalePrice", orderingSource.path("standardSalePrice").asLong());
        if (orderingSource.path("listedSalePrice").isIntegralNumber()) ordering.put("listedSalePrice", orderingSource.path("listedSalePrice").asLong());
        item.set("attributes", sections.path("attributes").isObject() ? sections.path("attributes") : mapper.createObjectNode());
        item.set("orderOptions", orderOptions(sections.path("orderOptions")));
        item.set("compositeGroups", compositeGroups(sections.path("compositeGroups")));
        ArrayNode itemBom = item.putArray("inventoryBom"); if (sections.path("inventoryBom").isArray()) sections.path("inventoryBom").forEach(entry -> itemBom.add(bomEntry(entry)));
        ObjectNode profiles = item.putObject("productionProfiles"); profiles.set("item", objectOrEmpty(sections.path("productionProfiles").path("item"))); profiles.set("sku", objectOrEmpty(sections.path("productionProfiles").path("sku"))); profiles.set("optionValue", objectOrEmpty(sections.path("productionProfiles").path("optionValue")));
        item.putObject("lifecycle").put("status", row.status()).put("version", row.version()).put("source", sourceFact(row, sections));
        item.put("source", sourceFact(row, sections));
        JsonNode externalIdentity = externalIdentityFact(mapper, sections);
        if (externalIdentity == null) item.putNull("externalIdentity"); else item.set("externalIdentity", externalIdentity);
        item.put("version", row.version()).put("updatedAt", row.updatedAt());
        return item;
    }
    /**
     * The catalog owner exposes only the typed external-order identity facts needed by
     * the governance surface.  It deliberately does not pass an arbitrary source
     * payload through the edge read model; absent facts remain absent instead of being
     * guessed from the current catalog name or price.
     */
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
    private ObjectNode bomEntry(JsonNode entry) {
        ObjectNode result = mapper.createObjectNode()
            .put("nodeType", entry.path("nodeType").asText("STOCK_TARGET"))
            .put("mode", entry.path("mode").asText("CONFIGURED"))
            .put("targetRef", entry.path("targetRef").asText())
            .put("quantity", entry.path("quantity").asText("0"))
            .put("unit", entry.path("unit").asText(""));
        copyNullableText(result, entry, "itemCode");
        copyNullableText(result, entry, "skuCode");
        copyNullableText(result, entry, "optionValueCode");
        if (entry.has("version")) result.put("version", entry.path("version").asLong());
        if (entry.has("lineSign")) result.put("lineSign", entry.path("lineSign").asText());
        return result;
    }
    private static void copyNullableText(ObjectNode target, JsonNode source, String field) {
        if (source.hasNonNull(field)) target.put(field, source.path(field).asText()); else target.putNull(field);
    }
    private ObjectNode objectOrEmpty(JsonNode node) { return node != null && node.isObject() ? (ObjectNode) node.deepCopy() : mapper.createObjectNode(); }
    private ArrayNode skuVariantDimensions(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(dimension -> {
            ObjectNode target = result.addObject();
            target.put("attributeRef", dimension.path("attributeRef").asText(""));
            target.put("attributeCode", dimension.path("attributeCode").asText(""));
            target.put("attributeName", dimension.path("attributeName").asText(""));
            ArrayNode values = target.putArray("values");
            if (dimension.path("values").isArray()) dimension.path("values").forEach(value -> {
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
    private ArrayNode skuRows(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(sku -> {
            ObjectNode target = result.addObject();
            target.put("productSkuRef", sku.path("productSkuRef").asText(""));
            target.put("skuCode", firstText(sku, "skuCode", "code") == null ? "" : firstText(sku, "skuCode", "code"));
            target.put("skuName", sku.path("skuName").asText(""));
            ArrayNode refs = target.putArray("attributeValueRefs");
            if (sku.path("attributeValueRefs").isArray()) sku.path("attributeValueRefs").forEach(value -> {
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
            target.put("skuBarcode", sku.path("skuBarcode").asText(""));
            putNullableLong(target, "standardSalePrice", sku.path("standardSalePrice"));
            target.put("isDefault", sku.path("isDefault").asBoolean(false));
            target.put("status", sku.path("status").asText("ENABLED"));
            target.put("version", sku.path("version").asLong(0));
            ArrayNode mediaRefs = target.putArray("mediaRefs");
            if (sku.path("mediaRefs").isArray()) sku.path("mediaRefs").forEach(value -> mediaRefs.add(value.asText()));
        });
        return result;
    }
    private ArrayNode orderOptions(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(group -> {
            ObjectNode target = result.addObject();
            String groupCode = firstText(group, "groupCode", "code");
            String groupName = firstText(group, "groupName", "name");
            String selectionMode = firstText(group, "selectionMode", "selectionRule");
            target.put("groupCode", groupCode == null ? "" : groupCode);
            target.put("groupName", groupName == null ? "" : groupName);
            target.put("selectionMode", selectionMode == null ? "SINGLE" : selectionMode);
            target.put("required", group.path("required").asBoolean(false));
            ArrayNode values = target.putArray("values");
            JsonNode sourceValues = group.path("values").isArray() ? group.path("values") : group.path("options");
            if (sourceValues.isArray()) sourceValues.forEach(value -> {
                ObjectNode entry = values.addObject();
                String code = firstText(value, "code", "valueCode");
                String name = firstText(value, "name", "valueName");
                entry.put("code", code == null ? "" : code);
                entry.put("name", name == null ? "" : name);
                entry.put("default", value.path("default").asBoolean(false));
                putNullableLong(entry, "extraPrice", value.path("extraPrice"));
                ArrayNode effects = entry.putArray("productionEffects");
                JsonNode effectValues = value.path("productionEffects");
                if (effectValues.isArray()) effectValues.forEach(effect -> effects.add(effect.asText()));
            });
        });
        return result;
    }
    private ArrayNode compositeGroups(JsonNode node) {
        ArrayNode result = mapper.createArrayNode();
        if (node == null || !node.isArray()) return result;
        node.forEach(group -> {
            ObjectNode target = result.addObject();
            String groupCode = firstText(group, "groupCode", "code");
            String groupName = firstText(group, "groupName", "name");
            String selectionRule = firstText(group, "selectionRule", "selectionMode");
            target.put("groupCode", groupCode == null ? "" : groupCode);
            target.put("groupName", groupName == null ? "" : groupName);
            target.put("selectionRule", selectionRule == null ? "REQUIRED" : selectionRule);
            ArrayNode components = target.putArray("components");
            JsonNode sourceComponents = group.path("components").isArray() ? group.path("components") : group.path("items");
            if (sourceComponents.isArray()) sourceComponents.forEach(value -> {
                ObjectNode entry = components.addObject();
                String itemCode = firstText(value, "itemCode", "componentItemCode", "code");
                entry.put("itemCode", itemCode == null ? "" : itemCode);
                String skuCode = firstText(value, "skuCode", "sku"); if (skuCode == null) entry.putNull("skuCode"); else entry.put("skuCode", skuCode);
                entry.put("quantity", value.path("quantity").asText("1"));
                entry.put("unit", value.path("unit").asText(""));
                entry.put("default", value.path("default").asBoolean(false));
                putNullableLong(entry, "extraPrice", value.path("extraPrice"));
                entry.put("status", value.path("status").asText("ENABLED"));
            });
        });
        return result;
    }
    private String dictionaryName(String scope,String brand,String kind,String code){return jdbc.query("SELECT name FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?",s->{s.setString(1,scope);s.setString(2,brand);s.setString(3,kind);s.setString(4,code);},r->{if(!r.next())throw new CatalogOwnerApi.Problem("NOT_FOUND",404,"字典条目不存在");return r.getString(1);});}
    private String dictionaryStatus(String scope,String brand,String kind,String code){return jdbc.query("SELECT status FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?",s->{s.setString(1,scope);s.setString(2,brand);s.setString(3,kind);s.setString(4,code);},r->{if(!r.next())throw new CatalogOwnerApi.Problem("NOT_FOUND",404,"字典条目不存在");return r.getString(1);});}
    private boolean createsCategoryCycle(String scope,String brand,String code,String parent){
        if (parent == null || parent.isBlank()) return false;
        String cursor = parent;
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        while (cursor != null && seen.add(cursor)) {
            if (code.equals(cursor)) return true;
            String lookup = cursor;
            String next = jdbc.query("SELECT parent_code FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=?", s->{s.setString(1,scope);s.setString(2,brand);s.setString(3,lookup);}, r->{if(!r.next()) return null; return r.getString(1);});
            cursor = next;
        }
        return cursor != null;
    }
    private ItemRow requireItem(String dataNodeRef,String brandRef,String code){ List<ItemRow> rows=loadItems(dataNodeRef,brandRef,List.of(code)); if(rows.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND",404,"商品不存在"); return rows.get(0); }
    private List<ItemRow> loadItems(String dataNodeRef,String brandRef,List<String> codes){ if(codes.isEmpty()) return List.of(); String placeholders=String.join(",",Collections.nCopies(codes.size(),"?")); List<Object> args=new ArrayList<>(); args.add(dataNodeRef);args.add(brandRef);args.addAll(codes); return jdbc.query("SELECT item_ref,code,name,shape_key,status,attributes::text,sections::text,version,updated_at_epoch_millis,source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code IN ("+placeholders+") ORDER BY code",(r,n)->new ItemRow(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getLong(8),r.getLong(9),r.getString(10)),args.toArray()); }

    /** Computes the catalog-owned portion of the approved typed closure in memory after set-based loads. */
    private CatalogClosure closureGraph(String dataNodeRef, String brandRef, List<String> selected) {
        List<ItemRow> all = jdbc.query("SELECT item_ref,code,name,shape_key,status,attributes::text,sections::text,version,updated_at_epoch_millis,source_scope_ref FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' ORDER BY code", (r,n)->new ItemRow(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getLong(8),r.getLong(9),r.getString(10)), dataNodeRef, brandRef);
        Map<String, ItemRow> byCode = new LinkedHashMap<>(); all.forEach(row -> byCode.put(row.code(), row));
        LinkedHashSet<String> visited = new LinkedHashSet<>();
        LinkedHashSet<TypedReference> references = new LinkedHashSet<>();
        LinkedHashSet<ClosureEdge> edges = new LinkedHashSet<>();
        ArrayList<String> queue = new ArrayList<>(selected);
        for (int index = 0; index < queue.size(); index++) {
            String code = queue.get(index); if (!visited.add(code)) continue;
            ItemRow row = byCode.get(code); if (row == null) continue;
            for (TypedReference reference : typedReferences(json(row.sectionsJson()))) {
                references.add(reference); edges.add(new ClosureEdge(row.code(), reference.code(), reference.referenceKind()));
                if (isItemReference(reference.referenceKind()) && byCode.containsKey(reference.code()) && !visited.contains(reference.code())) queue.add(reference.code());
            }
            // Inventory BOM rows point to StockTarget refs at runtime, but the
            // catalog contract also carries the component product identity for
            // closure planning. Expand that explicit product edge here so the
            // inventory owner receives every component item before it rewrites
            // StockTarget UUIDs.
            JsonNode bom = json(row.sectionsJson()).path("inventoryBom");
            if (bom.isArray()) bom.forEach(entry -> {
                String componentCode = entry.path("itemCode").asText("");
                if (!componentCode.isBlank()) {
                    TypedReference reference = new TypedReference("BOM_COMPONENT", componentCode);
                    references.add(reference); edges.add(new ClosureEdge(row.code(), componentCode, "BOM_COMPONENT"));
                    if (byCode.containsKey(componentCode) && !visited.contains(componentCode)) queue.add(componentCode);
                }
            });
        }
        List<ItemRow> items = new ArrayList<>(); visited.forEach(code -> { ItemRow row = byCode.get(code); if (row != null) items.add(row); });
        List<String> categoryCodes = references.stream().filter(ref -> "CATEGORY".equals(ref.referenceKind())).map(TypedReference::code).distinct().toList();
        List<CategoryRow> categories = loadCategories(dataNodeRef, brandRef, categoryCodes);
        List<TypedReference> dictionaryRefs = references.stream().filter(ref -> isDictionaryReference(ref.referenceKind())).toList();
        List<DictionaryRow> dictionaries = loadDictionaries(dataNodeRef, brandRef, dictionaryRefs);
        return new CatalogClosure(items, categories, dictionaries, List.copyOf(edges));
    }

    private List<ItemRow> closure(String dataNodeRef, String brandRef, List<String> selected) { return closureGraph(dataNodeRef, brandRef, selected).items(); }

    private List<CategoryRow> loadCategories(String scope, String brand, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>(); args.add(scope); args.add(brand); args.addAll(codes);
        return jdbc.query("SELECT code,name,parent_code,status,version FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' AND code IN (" + placeholders + ") ORDER BY code", (r,n) -> new CategoryRow(r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getLong(5)), args.toArray());
    }

    private List<DictionaryRow> loadDictionaries(String scope, String brand, List<TypedReference> references) {
        if (references.isEmpty()) return List.of();
        List<String> codes = references.stream().map(TypedReference::code).distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        List<Object> args = new ArrayList<>(); args.add(scope); args.add(brand); args.addAll(codes);
        List<DictionaryRow> candidates = jdbc.query("SELECT dictionary_kind,code,name,status,display_order,version FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' AND code IN (" + placeholders + ") ORDER BY dictionary_kind,code", (r,n) -> new DictionaryRow(r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getInt(5), r.getLong(6)), args.toArray());
        return candidates.stream().filter(row -> references.stream().anyMatch(ref -> ref.code().equals(row.code()) && dictionaryKindMatches(ref.referenceKind(), row.dictionaryKind()))).toList();
    }

    public static void validateItemPageQuery(ObjectNode request) {
        if (request == null) return;
        Set<String> allowed = Set.of("dataNodeRef", "keyword", "smartViewKey", "shapeKey", "categoryRef", "uncategorized", "includeSubCategories", "status", "governanceStatus", "source", "cursor", "pageSize", "queryGeneration", "itemCodes", "itemCodesOnly");
        request.fieldNames().forEachRemaining(field -> { if (!allowed.contains(field)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "unknown catalog page query field: " + field); });
        String status = optional(request, "status"); if (status != null && !CatalogOwnerTypes.STATUSES.contains(status)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "status is not supported");
        String governanceStatus = optional(request, "governanceStatus"); if (governanceStatus != null && !CatalogOwnerTypes.STATUSES.contains(governanceStatus) && !Set.of("GOVERNANCE_TODO").contains(governanceStatus)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "governanceStatus is not supported");
        String shapeKey = optional(request, "shapeKey"); if (shapeKey != null && !CatalogOwnerTypes.SHAPES.contains(shapeKey)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shapeKey is not supported");
        if (parseBoolean(request, "uncategorized", false) && optional(request, "categoryRef") != null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "uncategorized cannot be combined with categoryRef");
        String smartViewKey = optional(request, "smartViewKey"); if (smartViewKey != null && !Set.of("ALL", "GOVERNANCE_PENDING", "EXTERNAL_ORDER_TEMP", "INACTIVE", "ARCHIVED", "RECENTLY_UPDATED", "AUTO_SYNC").contains(smartViewKey)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "smartViewKey is not supported");
        String source = optional(request, "source"); if (source != null && !Set.of("SELF_MANAGED", "COPIED", "AUTO_SYNC", "TEMPORARY").contains(source)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "source is not supported");
        parsePageSize(request, "pageSize", 20); parseCursor(request, "cursor"); parseBoolean(request, "includeSubCategories", false);
        if (request.has("itemCodes") && !request.path("itemCodes").isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCodes must be an array");
    }

    private static int parsePageSize(ObjectNode request, String key, int fallback) {
        JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) return fallback;
        try { int parsed = Integer.parseInt(value.asText()); if (parsed < 1 || parsed > 100) throw new NumberFormatException(); return parsed; }
        catch (NumberFormatException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be between 1 and 100"); }
    }
    private static long parseCursor(ObjectNode request, String key) {
        JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) return 0L;
        try { long parsed = Long.parseLong(value.asText()); if (parsed < 0) throw new NumberFormatException(); return parsed; }
        catch (NumberFormatException ex) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be a non-negative opaque cursor"); }
    }
    private static boolean parseBoolean(ObjectNode request, String key, boolean fallback) {
        JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) return fallback;
        if (value.isBoolean()) return value.asBoolean(); if ("true".equalsIgnoreCase(value.asText())) return true; if ("false".equalsIgnoreCase(value.asText())) return false;
        throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be boolean");
    }
    private static List<String> textArray(JsonNode value) { if (value == null || !value.isArray()) return List.of(); LinkedHashSet<String> result = new LinkedHashSet<>(); value.forEach(entry -> { if (entry.isTextual() && !entry.asText().isBlank()) result.add(entry.asText()); }); return List.copyOf(result); }

    private List<TypedReference> typedReferences(JsonNode node) {
        LinkedHashSet<TypedReference> result = new LinkedHashSet<>(); collectTypedReferences(node, null, result); return List.copyOf(result);
    }
    private void collectTypedReferences(JsonNode node, String parentKey, LinkedHashSet<TypedReference> result) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey(); JsonNode value = entry.getValue(); String kind = referenceKindForKey(key, parentKey);
                if (kind != null) addReferenceValues(value, kind, result);
                collectTypedReferences(value, key, result);
            });
        } else if (node.isArray()) node.forEach(value -> collectTypedReferences(value, parentKey, result));
    }
    private void addReferenceValues(JsonNode value, String kind, LinkedHashSet<TypedReference> result) {
        if (value == null || value.isNull()) return;
        if (value.isTextual() && !value.asText().isBlank()) { result.add(new TypedReference(kind, value.asText())); return; }
        if (value.isArray()) { value.forEach(entry -> addReferenceValues(entry, kind, result)); return; }
        if (value.isObject() && value.path("code").isTextual() && !value.path("code").asText().isBlank()) result.add(new TypedReference(kind, value.path("code").asText()));
    }
    private String referenceKindForKey(String key, String parentKey) {
        return switch (key) {
            case "categoryCode", "categoryRefs", "categories" -> "CATEGORY";
            case "tagCode", "tagRefs", "tags" -> "TAG";
            case "salesUnitCode", "salesUnitRefs", "salesUnitCodes", "unitCode" -> "SALES_UNIT";
            case "attributeCode", "attributeRefs", "attributeCodes", "dimensionCode", "dimensionRefs" -> "SKU_ATTRIBUTE";
            case "attributeValueCode", "attributeValueRefs", "optionValueCode", "optionValueRefs", "optionValues" -> "SKU_ATTRIBUTE_VALUE";
            case "productionTagCode", "productionTagRefs", "productionTags" -> "PRODUCTION_TAG";
            case "componentCode", "componentItemCode", "componentRefs", "componentItemRefs" -> "BOM_COMPONENT";
            case "compositeComponentCode", "compositeComponentRefs", "compositeComponents", "relatedItemRefs", "relatedItemCodes", "itemRefs" -> "COMPOSITE_COMPONENT";
            case "itemCode" -> isItemReferenceParent(parentKey) ? "COMPOSITE_COMPONENT" : null;
            default -> null;
        };
    }
    private boolean isItemReferenceParent(String parentKey) { return Set.of("components", "component", "compositeComponents", "relatedItems", "itemRelations").contains(parentKey); }
    private boolean isItemReference(String kind) { return "COMPOSITE_COMPONENT".equals(kind) || "BOM_COMPONENT".equals(kind); }
    private boolean isDictionaryReference(String kind) { return Set.of("TAG", "SALES_UNIT", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE").contains(kind); }
    private boolean dictionaryKindMatches(String referenceKind, String dictionaryKind) {
        return switch (referenceKind) {
            case "TAG", "SALES_UNIT", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE" -> referenceKind.equals(dictionaryKind);
            default -> false;
        };
    }
    private JsonNode replay(String dataNodeRef,String key,String operationId,ObjectNode request){ List<Receipt> rows=jdbc.query("SELECT operation_id,request_hash,response::text FROM catalog.command_receipt WHERE data_node_ref=? AND idempotency_key=? FOR UPDATE",(r,n)->new Receipt(r.getString(1),r.getString(2),json(r.getString(3))),dataNodeRef,key); if(rows.isEmpty()) return null; Receipt receipt=rows.get(0); if(!receipt.operationId().equals(operationId)||!receipt.requestHash().equals(hash(request))) throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH",409,"幂等键已绑定其他请求"); return receipt.response(); }
    private void saveReceipt(String scope,String key,String op,ObjectNode request,JsonNode response){ jdbc.update("INSERT INTO catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT (data_node_ref,idempotency_key) DO NOTHING",UUID.randomUUID(),scope,key,op,hash(request),canonicalJson(response),now()); }
    private long count(String table,String dataNodeRef,String brandRef){ Long value=jdbc.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE data_node_ref=? AND brand_ref=?",Long.class,dataNodeRef,brandRef); return value==null?0:value; }
    private long countShape(String dataNodeRef,String brandRef,String shape){ Long value=jdbc.queryForObject("SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND shape_key=?",Long.class,dataNodeRef,brandRef,shape); return value==null?0:value; }
    private long generation(String dataNodeRef,String brandRef){ Long value=jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?",Long.class,dataNodeRef,brandRef); return value==null?0:value; }
    private long dictionaryGeneration(String dataNodeRef, String brandRef, String kind){ Long value=jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=?",Long.class,dataNodeRef,brandRef,kind); return value==null?0:value; }
    private static void requireScope(String dataNodeRef,String brandRef){ if(dataNodeRef==null||dataNodeRef.isBlank()||brandRef==null||brandRef.isBlank()) throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN",403,"owner scope is required"); }
    private String requiredDictionaryKind(ObjectNode request) {
        return canonicalDictionaryKind(required(request, "dictionaryKind"));
    }
    private String canonicalDictionaryKind(String kind) {
        if (!copyLimits.allowsDictionaryKind(kind)) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dictionaryKind is not supported");
        return kind;
    }
    private static String required(ObjectNode request,String key){ String value=optional(request,key); if(value==null||value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,key+" is required"); return value; }
    private static String optional(ObjectNode request,String key){ JsonNode value=request==null?null:request.get(key); return value==null||value.isNull()?null:value.asText(); }
    private static long requiredLong(ObjectNode request,String key,long fallback){ JsonNode value=request.get(key); if(value==null||!value.isIntegralNumber()) return fallback; return value.asLong(); }
    private String canonicalJson(JsonNode value){ try{return mapper.writeValueAsString(value==null?mapper.createObjectNode():value);}catch(Exception ex){throw new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,"JSON payload is invalid");} }
    private JsonNode json(String value){ try{return mapper.readTree(value);}catch(Exception ex){return mapper.createObjectNode();} }
    private String hash(JsonNode value){ return digest(canonicalJson(value)); }
    private static String digest(String value){ try{return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception ex){throw new IllegalStateException(ex);} }
    private long now(){ return time.currentEpochMillis(); }
    private CatalogOwnerApi.Problem tooLarge(String code,int actual,int limit){ return new CatalogOwnerApi.Problem(code,422,code+" actual="+actual+" limit="+limit); }
    private List<String> selectedCodes(ObjectNode request){ LinkedHashSet<String> result=new LinkedHashSet<>(); JsonNode values=request.get("selectedItemCodes"); if(values!=null&&values.isArray()) values.forEach(v->{if(v.isTextual()) result.add(v.asText());}); String single=optional(request,"sourceItemCode"); if(single!=null) result.add(single); if(result.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR",422,"copy selection is required"); return List.copyOf(result); }
    private Set<String> selectedSectionsElements(ArrayNode values) { Set<String> result = new java.util.HashSet<>(); values.forEach(value -> { if (value.isTextual()) result.add(value.asText()); }); return result; }
    private List<String> stringValues(JsonNode values) { LinkedHashSet<String> result = new LinkedHashSet<>(); values.forEach(value -> { if (value.isTextual() && !value.asText().isBlank()) result.add(value.asText()); }); if (result.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "copy closure is required"); return List.copyOf(result); }
    private long scopeVersion(List<ItemRow> rows) { return rows.stream().mapToLong(ItemRow::version).max().orElse(0L); }
    private long scopeVersion(CatalogClosure graph) { return graph.objects().stream().mapToLong(CatalogObject::version).max().orElse(0L); }
    private long targetScopeVersion(String target, String brand, ObjectNode request, List<ItemRow> source) {
        String targetCode = optional(request, "targetItemCode");
        if (targetCode != null) {
            Long value = jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?", Long.class, target, brand, targetCode);
            return value == null ? 0L : value;
        }
        Long value = jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code IN (" + String.join(",", Collections.nCopies(source.size(), "?")) + ")", concatArgs(Long.class, target, brand, source), Long.class);
        return value == null ? 0L : value;
    }
    private long targetScopeVersion(String target, String brand, ObjectNode request, CatalogClosure graph) {
        long max = targetScopeVersion(target, brand, request, graph.items());
        for (CategoryRow row : graph.categories()) max = Math.max(max, targetObjectVersion(target, brand, row));
        for (DictionaryRow row : graph.dictionaries()) max = Math.max(max, targetObjectVersion(target, brand, row));
        return max;
    }
    private long targetObjectVersion(String target, String brand, CategoryRow row) {
        Long value = jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND code=?", Long.class, target, brand, row.code());
        return value == null ? 0L : value;
    }
    private long targetObjectVersion(String target, String brand, DictionaryRow row) {
        Long value = jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?", Long.class, target, brand, row.dictionaryKind(), row.code());
        return value == null ? 0L : value;
    }
    private Object[] concatArgs(Class<?> ignored, String target, String brand, List<ItemRow> source) { ArrayList<Object> args = new ArrayList<>(); args.add(target); args.add(brand); source.forEach(row -> args.add(row.code())); return args.toArray(); }
    private String copyDigest(String source, String target, List<String> selected, CatalogClosure graph, long sourceVersion, long targetVersion) {
        ArrayList<String> identities = new ArrayList<>(); graph.objects().forEach(row -> identities.add(row.objectType() + ":" + row.code() + ":" + row.version() + (row instanceof ItemRow item ? ":" + skuStructureFingerprint(json(item.sectionsJson())) : ""))); Collections.sort(identities);
        ArrayList<String> codes = new ArrayList<>(selected); Collections.sort(codes); return digest(source + "|" + target + "|" + String.join(",", codes) + "|" + String.join(",", identities) + "|" + sourceVersion + "|" + targetVersion);
    }
    private CopyCompatibility validateCopyCompatibility(String source, String target, String brand, CatalogClosure graph) {
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>();
        graph.objects().forEach(row -> mapping.put(new ReferenceKey(row.objectType(), row.code()), row.code()));
        Map<String, ItemRow> targetRows = new LinkedHashMap<>();
        if (!graph.items().isEmpty()) loadItems(target, brand, graph.items().stream().map(ItemRow::code).toList()).forEach(row -> targetRows.put(row.code(), row));
        for (ItemRow row : graph.items()) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            if (check.blocking()) throw new CatalogOwnerApi.Problem(check.problemCode(), 422, check.reason() + ": " + row.code());
        }
        return new CopyCompatibility(mapping);
    }

    private CompatibilityCheck compatibilityCheck(ItemRow source, ItemRow existing, CatalogClosure graph, Map<ReferenceKey, String> mapping) {
        if (existing != null && !existing.shapeKey().equals(source.shapeKey())) return new CompatibilityCheck("BLOCKED", "商品形态结构不兼容", "STRUCTURE_INCOMPATIBLE", true);
        String sourceSkuStructure = skuStructureFingerprint(json(source.sectionsJson()));
        String targetSkuStructure = existing == null ? null : skuStructureFingerprint(json(existing.sectionsJson()));
        if (existing != null && !sourceSkuStructure.equals(targetSkuStructure)) return new CompatibilityCheck("BLOCKED", "SKU 结构指纹不一致", "STRUCTURE_INCOMPATIBLE", true);
        String sourceUnit = json(source.sectionsJson()).path("consumptionUnit").asText(null);
        String targetUnit = existing == null ? null : json(existing.sectionsJson()).path("consumptionUnit").asText(null);
        if (sourceUnit != null && targetUnit != null && !sourceUnit.equals(targetUnit)) return new CompatibilityCheck("BLOCKED", "消耗单位不一致", "CONSUMPTION_UNIT_INCOMPATIBLE", true);
        for (TypedReference ref : typedReferences(json(source.sectionsJson()))) {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET", "SKU").contains(ref.referenceKind())) continue;
            ReferenceKey key = new ReferenceKey(objectTypeForReference(ref.referenceKind()), ref.code());
            if (!mapping.containsKey(key)) return new CompatibilityCheck("BLOCKED", "商品引用无法重写", "REFERENCE_MAPPING_UNRESOLVED", true);
        }
        return new CompatibilityCheck(existing == null ? "CREATE" : "REUSE", existing == null ? "目标不存在，将创建" : "编码与结构兼容，可复用", null, false);
    }
    private String objectTypeForReference(String referenceKind) {
        return switch (referenceKind) {
            case "COMPOSITE_COMPONENT", "BOM_COMPONENT", "SKU" -> "CATALOG_ITEM";
            case "CATEGORY" -> "CATALOG_CATEGORY";
            case "TAG" -> "CATALOG_TAG";
            case "SALES_UNIT" -> "SALES_UNIT";
            case "SKU_ATTRIBUTE" -> "SKU_ATTRIBUTE";
            case "SKU_ATTRIBUTE_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            case "PRODUCTION_TAG" -> "PRODUCTION_TAG";
            default -> referenceKind;
        };
    }
    /** Stable product compatibility bit: skuCode -> sorted(attributeCode,valueCode) pairs. */
    static String skuStructureFingerprint(JsonNode sections) {
        JsonNode skus = sections == null ? null : sections.path("skus");
        if (skus == null || !skus.isArray()) skus = sections == null ? null : sections.path("skuStructure").path("skus");
        List<String> fingerprints = new ArrayList<>();
        if (skus != null && skus.isArray()) {
            skus.forEach(sku -> {
                String skuCode = firstText(sku, "code", "skuCode");
                if (skuCode == null || skuCode.isBlank()) return;
                List<String> values = new ArrayList<>();
                JsonNode attributeValues = sku.path("attributeValues");
                if (attributeValues.isObject()) attributeValues.fields().forEachRemaining(entry -> appendAttributePair(values, entry.getKey(), entry.getValue()));
                else if (attributeValues.isArray()) attributeValues.forEach(value -> appendAttributeObject(values, value));
            JsonNode attributes = sku.path("attributes");
            if (attributes.isObject()) attributes.fields().forEachRemaining(entry -> appendAttributePair(values, entry.getKey(), entry.getValue()));
            JsonNode attributeValueRefs = sku.path("attributeValueRefs");
            if (attributeValueRefs.isArray()) attributeValueRefs.forEach(value -> appendAttributeObject(values, value));
            Collections.sort(values);
                fingerprints.add(skuCode + "->" + String.join(",", values));
            });
        }
        Collections.sort(fingerprints);
        return String.join(";", fingerprints);
    }
    private static void appendAttributePair(List<String> values, String attributeCode, JsonNode value) {
        if (value == null || value.isNull()) return;
        if (value.isArray()) { value.forEach(entry -> appendAttributePair(values, attributeCode, entry)); return; }
        if (value.isObject()) { appendAttributeObject(values, value); return; }
        values.add(attributeCode + "=" + value.asText());
    }
    private static void appendAttributeObject(List<String> values, JsonNode value) {
        String attributeCode = firstText(value, "attributeCode", "dimensionCode", "attribute", "code");
        String valueCode = firstText(value, "valueCode", "attributeValueCode", "value");
        if (attributeCode != null && valueCode != null) values.add(attributeCode + "=" + valueCode);
    }
    private static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys) if (node.path(key).isValueNode() && !node.path(key).asText().isBlank()) return node.path(key).asText();
        return null;
    }
    private JsonNode rewriteReferences(JsonNode node, Map<ReferenceKey, String> mapping) { return rewriteReferences(node, mapping, null); }
    private JsonNode rewriteReferences(JsonNode node, Map<ReferenceKey, String> mapping, String parentKey) {
        if (node == null || node.isNull()) return mapper.nullNode();
        if (node.isObject()) {
            ObjectNode copy = mapper.createObjectNode(); node.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                String kind = referenceKindForKey(entry.getKey(), parentKey);
                if (kind != null) copy.set(entry.getKey(), rewriteReferenceValue(value, kind, mapping));
                else copy.set(entry.getKey(), rewriteReferences(value, mapping, entry.getKey()));
            }); return copy;
        }
        if (node.isArray()) { ArrayNode copy = mapper.createArrayNode(); node.forEach(value -> copy.add(rewriteReferences(value, mapping, parentKey))); return copy; }
        return node.deepCopy();
    }
    private JsonNode rewriteReferenceValue(JsonNode value, String kind, Map<ReferenceKey, String> mapping) {
        if (value == null || value.isNull()) return mapper.nullNode();
        ReferenceKey key = value.isTextual() ? new ReferenceKey(objectTypeForReference(kind), value.asText()) : null;
        if (key != null && mapping.containsKey(key)) return mapper.getNodeFactory().textNode(mapping.get(key));
        if (value.isArray()) { ArrayNode copy = mapper.createArrayNode(); value.forEach(entry -> copy.add(rewriteReferenceValue(entry, kind, mapping))); return copy; }
        if (value.isObject()) {
            ObjectNode copy = (ObjectNode) value.deepCopy();
            if (copy.path("code").isTextual()) {
                ReferenceKey codeKey = new ReferenceKey(objectTypeForReference(kind), copy.path("code").asText());
                if (mapping.containsKey(codeKey)) copy.put("code", mapping.get(codeKey));
            }
            return copy;
        }
        return value.deepCopy();
    }
    private void assertNoOwnerReferenceLeak(CatalogClosure graph, Map<ReferenceKey, String> mapping, String sourceScope) {
        for (ClosureEdge edge : graph.edges()) {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET").contains(edge.referenceKind())) continue;
            ReferenceKey key = new ReferenceKey(objectTypeForReference(edge.referenceKind()), edge.toCode());
            if (!mapping.containsKey(key)) throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "复制引用未完成映射: " + edge.toCode());
        }
        for (ItemRow row : graph.items()) if (containsForbiddenOwnerReference(json(row.sectionsJson()), sourceScope)) throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "源 owner 引用不能进入目标图");
    }
    private void verifyTargetNoOwnerReferenceLeak(String targetScope, String brand, CatalogClosure graph, String sourceScope) {
        List<String> codes = graph.items().stream().map(ItemRow::code).toList();
        for (ItemRow row : loadItems(targetScope, brand, codes)) if (containsForbiddenOwnerReference(json(row.sectionsJson()), sourceScope)) throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "目标图仍含源 owner 引用");
    }
    private boolean containsForbiddenOwnerReference(JsonNode node, String sourceScope) {
        if (node == null || node.isNull()) return false;
        if (node.isObject()) { var fields = node.fields(); while (fields.hasNext()) { var entry = fields.next(); String key = entry.getKey(); JsonNode value = entry.getValue(); if (Set.of("headCompanyRef", "ownerRef", "dataNodeRef", "scopeRef", "originScopeRef").contains(key) && value.isTextual() && sourceScope.equals(value.asText())) return true; if (containsForbiddenOwnerReference(value, sourceScope)) return true; } }
        else if (node.isArray()) for (JsonNode value : node) if (containsForbiddenOwnerReference(value, sourceScope)) return true;
        return false;
    }
    private record ItemRow(UUID ref,String code,String name,String shapeKey,String status,String attributesJson,String sectionsJson,long version,long updatedAt,String sourceScopeRef) implements CatalogObject { public String objectType(){return "CATALOG_ITEM";} }
    private record PageItemRow(ItemRow item, long total) { }
    private record CategoryRow(String code,String name,String parentCode,String status,long version) implements CatalogObject { public String objectType(){return "CATALOG_CATEGORY";} }
    private record DictionaryRow(String dictionaryKind,String code,String name,String status,int displayOrder,long version) implements CatalogObject {
        public String objectType(){
            return dictionaryObjectType(dictionaryKind);
        }
    }
    static String dictionaryObjectType(String dictionaryKind) {
        return switch (dictionaryKind) {
            case "TAG" -> "CATALOG_TAG";
            case "SALES_UNIT" -> "SALES_UNIT";
            case "SKU_ATTRIBUTE" -> "SKU_ATTRIBUTE";
            case "SKU_ATTRIBUTE_VALUE" -> "SKU_ATTRIBUTE_VALUE";
            default -> throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dictionaryKind is not supported");
        };
    }
    private record TypedReference(String referenceKind,String code) { }
    private record ClosureEdge(String fromCode,String toCode,String referenceKind) { }
    private record ReferenceKey(String objectType,String code) { }
    private interface CatalogObject { String objectType(); String code(); String name(); long version(); }
    private record CatalogClosure(List<ItemRow> items,List<CategoryRow> categories,List<DictionaryRow> dictionaries,List<ClosureEdge> edges) { List<CatalogObject> objects(){ List<CatalogObject> all=new ArrayList<>(); all.addAll(items); all.addAll(categories); all.addAll(dictionaries); return all; } int size(){ return objects().size(); } }
    private record CopyCompatibility(Map<ReferenceKey, String> mapping) { }
    private record CompatibilityCheck(String result, String reason, String problemCode, boolean blocking) { }
    private record Receipt(String operationId,String requestHash,JsonNode response) { }
}
