package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.HexFormat;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Light inventory owner. It never writes catalog or organization schemas. */
@Service
public class InventoryOwnerService implements InventoryOwnerApi {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    public InventoryOwnerService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) { this.jdbc = jdbc; this.mapper = mapper; this.time = time; }

    @Override
    @Transactional(readOnly = true)
    public JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        return switch (operationId) {
            case "getOperationsInventoryTargets" -> targets(dataNodeRef, brandRef, requestId, request);
            case "getOperationsInventoryTarget" -> current(dataNodeRef, brandRef, requestId, required(request, "targetRef"));
            case "getOperationsInventoryTargetChangeSummary" -> changeSummaryData(required(request, "targetRef"), optional(request, "period"));
            case "getOperationsInventoryTargetBusinessHistory" -> history(requestId, required(request, "targetRef"), request);
            case "getOperationsInventoryTargetConsumptionReferences" -> references(dataNodeRef, brandRef, requestId, required(request, "targetRef"), request);
            case "getOperationsInventoryTargetLedger" -> ledger(requestId, required(request, "targetRef"), request);
            case "getOperationsInventoryTargetDiagnostics" -> diagnostics(requestId, required(request, "targetRef"));
            default -> throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory read operation is not registered");
        };
    }

    @Override
    @Transactional
    public JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, String dataNodeType) {
        requireStoreDataNodeType(dataNodeType);
        requireScope(dataNodeRef, brandRef);
        String key = requireIdempotencyKey(idempotencyKey);
        JsonNode replay = replay(dataNodeRef, key, operationId, request);
        if (replay != null) return replay;
        JsonNode result = switch (operationId) {
            case "countOperationsInventoryTarget" -> adjust(dataNodeRef, brandRef, requestId, request, "COUNT");
            case "increaseOperationsInventoryTarget" -> adjust(dataNodeRef, brandRef, requestId, request, "INCREASE");
            case "adjustOperationsInventoryTarget" -> adjust(dataNodeRef, brandRef, requestId, request, "ADJUST");
            case "updateOperationsInventoryTargetConfiguration" -> updateConfiguration(dataNodeRef, brandRef, requestId, request);
            default -> throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory write operation is not registered");
        };
        saveReceipt(dataNodeRef, key, operationId, request, result);
        return result;
    }

    @Override
    @Transactional
    public JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return copy(sourceDataNodeRef, targetDataNodeRef, brandRef, request, requestId, null);
    }

    @Override
    @Transactional
    public JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(sourceDataNodeRef, brandRef); requireScope(targetDataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isBlank()) {
            JsonNode replay = replay(targetDataNodeRef, receiptKey, "coordinatedCopy", request);
            if (replay != null) return replay;
        }
        if (request.hasNonNull("inventoryPreflightDigest")) {
            JsonNode judgement = preflightCopy(sourceDataNodeRef, targetDataNodeRef, brandRef, request);
            String expected = request.path("inventoryPreflightDigest").asText();
            String actual = judgement.path("digest").asText();
            if (!expected.equals(actual)) throw new InventoryOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "库存复制预检已失效，请重新预检");
            String blocker = judgement.path("firstBlockingProblem").asText("");
            if (!blocker.isBlank()) throw new InventoryOwnerApi.Problem(blocker, 422, "库存复制存在不兼容事实");
        }
        String localSource = optional(request, "sourceItemCode");
        String localTarget = optional(request, "targetItemCode");
        if (localSource != null && localTarget != null) {
            JsonNode result = copyLocalConfiguration(sourceDataNodeRef, targetDataNodeRef, brandRef, localSource, localTarget);
            if (!receiptKey.isBlank()) saveReceipt(targetDataNodeRef, receiptKey, "coordinatedCopy", request, result);
            return result;
        }
        JsonNode codes = request.path("closureItemCodes"); if (!codes.isArray()) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "库存复制闭包缺少商品编码");
        int copied = 0;
        List<String> copiedCodes = new ArrayList<>();
        Map<UUID, TargetRow> sourceByRef = new java.util.LinkedHashMap<>();
        for (JsonNode code : codes) {
            copiedCodes.add(code.asText());
            List<TargetRow> rows = loadTargets(sourceDataNodeRef, brandRef, code.asText());
            rows.forEach(row -> { assertSourceNoOwnerReference(row, sourceDataNodeRef); sourceByRef.putIfAbsent(row.ref(), row); });
        }
        List<TargetRow> sourceRows = new ArrayList<>(sourceByRef.values());
        List<BomOwnerRow> sourceBomOwners = new ArrayList<>();
        Set<String> copiedBomOwnerKeys = new LinkedHashSet<>();
        for (String itemCode : copiedCodes) {
            for (BomOwnerRow owner : loadBomOwners(sourceDataNodeRef, brandRef, itemCode)) {
                if (copiedBomOwnerKeys.add(bomOwnerIdentity(owner))) sourceBomOwners.add(owner);
            }
        }
        // First materialize every target in the closure.  Only after the complete
        // identity map exists may BOM references be rewritten; this prevents an
        // order-dependent source UUID from leaking into a target BOM.
        for (TargetRow row : sourceRows) {
            copied += jdbc.update("INSERT INTO inventory.stock_target(target_ref,data_node_ref,brand_ref,item_code,sku_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,CAST(? AS JSONB),0,1,?,?) ON CONFLICT DO NOTHING", UUID.randomUUID(), targetDataNodeRef, brandRef, row.itemCode(), row.skuCode(), row.measureMode(), row.configuration(), time.currentEpochMillis(), time.currentEpochMillis());
        }
        Map<UUID, UUID> targetRefs = new java.util.LinkedHashMap<>();
        for (TargetRow row : sourceRows) {
            TargetRow target = loadTargets(targetDataNodeRef, brandRef, row.itemCode()).stream().filter(candidate -> java.util.Objects.equals(candidate.skuCode(), row.skuCode())).findFirst().orElseThrow(() -> new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "目标库存对象不存在"));
            targetRefs.put(row.ref(), target.ref());
        }
        for (BomOwnerRow bomOwner : sourceBomOwners) copyRewrittenBom(sourceDataNodeRef, targetDataNodeRef, brandRef, bomOwner, targetRefs);
        if (!sourceDataNodeRef.equals(targetDataNodeRef)) verifyTargetNoOwnerReference(targetDataNodeRef, brandRef, copiedCodes, sourceDataNodeRef);
        JsonNode result = mapper.createObjectNode().put("owner", "inventory").put("status", "COMMITTED").put("version", copied);
        if (!receiptKey.isBlank()) saveReceipt(targetDataNodeRef, receiptKey, "coordinatedCopy", request, result);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request) {
        requireScope(sourceDataNodeRef, brandRef); requireScope(targetDataNodeRef, brandRef);
        JsonNode codes = request.path("closureItemCodes");
        if (!codes.isArray()) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "库存复制闭包缺少商品编码");
        ObjectNode snapshot = mapper.createObjectNode();
        ArrayNode versions = snapshot.putArray("versions");
        ArrayNode closureItems = snapshot.putArray("closureItems");
        ArrayNode mappings = snapshot.putArray("mappingPreview");
        ArrayNode compatibility = snapshot.putArray("compatibilityResults");
        ArrayNode rewrites = snapshot.putArray("referenceRewritePreview");
        ArrayNode bomOwners = snapshot.putArray("bomOwners");
        String firstBlocking = "";
        LinkedHashSet<String> closureCodes = new LinkedHashSet<>();
        ArrayDeque<String> pendingCodes = new ArrayDeque<>();
        for (JsonNode codeNode : codes) {
            String code = codeNode.asText();
            if (closureCodes.add(code)) pendingCodes.add(code);
        }
        Map<UUID, TargetRow> sourceByRef = new LinkedHashMap<>();
        Set<String> processedBomOwners = new LinkedHashSet<>();
        while (!pendingCodes.isEmpty()) {
            String code = pendingCodes.removeFirst();
            List<TargetRow> sourceRows = loadTargets(sourceDataNodeRef, brandRef, code);
            for (TargetRow source : sourceRows) {
                sourceByRef.putIfAbsent(source.ref(), source);
            }
            for (BomOwnerRow owner : loadBomOwners(sourceDataNodeRef, brandRef, code)) {
                if (!processedBomOwners.add(bomOwnerIdentity(owner))) continue;
                bomOwners.addObject().put("code", bomOwnerIdentity(owner)).put("itemCode", owner.itemCode()).put("version", owner.version());
                JsonNode rows = json(owner.rows());
                if (!rows.isArray()) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "库存 BOM 行不是有效数组");
                for (JsonNode row : rows) {
                    String sourceRef = row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
                    TargetRow component = sourceRef.isBlank() ? null : findTargetByRef(sourceDataNodeRef, brandRef, sourceRef);
                    String status = component == null ? "BLOCKED" : "REWRITE";
                    if (component == null && firstBlocking.isBlank()) firstBlocking = "REFERENCE_MAPPING_UNRESOLVED";
                    if (component != null && closureCodes.add(component.itemCode())) pendingCodes.add(component.itemCode());
                    rewrites.addObject().put("fromCode", sourceRef).put("toCode", component == null ? "" : targetIdentityCode(component.itemCode(), component.skuCode())).put("referenceKind", "STOCK_BOM").put("status", status);
                }
            }
        }
        List<TargetRow> allSourceRows = new ArrayList<>(sourceByRef.values());
        // The closure is recursive over inventory-owned BOM target references,
        // not merely over catalog item codes. Every component item must be
        // materialized before a BOM targetRef can be rewritten.
        for (TargetRow source : allSourceRows) {
            String code = source.itemCode();
            String targetCode = optional(request, "targetItemCode");
            List<TargetRow> targets = loadTargets(targetDataNodeRef, brandRef, targetCode == null ? code : targetCode);
            TargetRow existing = targets.stream().filter(target -> java.util.Objects.equals(target.skuCode(), source.skuCode())).findFirst().orElse(null);
            String result = existing == null ? "CREATE" : "REUSE";
            String reason = existing == null ? "目标库存对象不存在，将创建且余额从零开始" : "库存对象身份一致，可复用";
            String problem = "";
            if (existing != null && !java.util.Objects.equals(existing.measureMode(), source.measureMode())) { result = "BLOCKED"; reason = "消耗单位不一致"; problem = "CONSUMPTION_UNIT_INCOMPATIBLE"; if (firstBlocking.isBlank()) firstBlocking = problem; }
            String identityCode = targetIdentityCode(code, source.skuCode());
            closureItems.addObject().put("objectType", "STOCK_TARGET").put("code", identityCode).put("itemCode", code).put("name", code).put("action", result);
            compatibility.addObject().put("objectType", "STOCK_TARGET").put("code", identityCode).put("itemCode", code).put("result", result).put("reason", reason).put("problemCode", problem);
            versions.addObject().put("objectType", "STOCK_TARGET").put("code", identityCode).put("itemCode", code).put("sourceVersion", source.version()).put("targetVersion", existing == null ? 0 : existing.version());
            mappings.addObject().put("fromCode", source.ref().toString()).put("toCode", identityCode).put("itemCode", code).put("referenceKind", "STOCK_TARGET").put("status", existing == null ? "CREATE" : "REUSE");
        }
        snapshot.put("firstBlockingProblem", firstBlocking);
        ObjectNode result = mapper.createObjectNode().put("owner", "inventory").put("firstBlockingProblem", firstBlocking).put("digest", hash(snapshot));
        result.set("closureItems", closureItems); result.set("mappingPreview", mappings); result.set("versions", versions); result.set("compatibilityResults", compatibility); result.set("referenceRewritePreview", rewrites);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode readCatalogInventoryDefinition(String scope, String brand, String itemCode, String requestId) {
        requireScope(scope, brand);
        if (itemCode == null || itemCode.isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCode is required");
        ObjectNode data = mapper.createObjectNode().put("itemCode", itemCode);
        ArrayNode nodes = data.putArray("nodes");
        List<TargetRow> targets = loadTargets(scope, brand, itemCode);
        for (TargetRow row : targets) {
            JsonNode config = json(row.configuration());
            ObjectNode node = nodes.addObject()
                .put("nodeType", row.skuCode() == null ? "ITEM" : "SKU")
                .put("mode", config.path("mode").asText("INDEPENDENT_STOCK"))
                .put("targetRef", row.ref().toString())
                .put("version", row.version())
                .put("itemCode", row.itemCode());
            if (row.skuCode() == null) node.putNull("skuCode"); else node.put("skuCode", row.skuCode());
            node.put("quantity", "0").put("unit", row.measureMode());
            node.set("configuration", config);
        }
        jdbc.query("SELECT sku_code,option_value_code,version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=? ORDER BY sku_code NULLS FIRST,option_value_code NULLS FIRST", statement -> {
            statement.setString(1, scope); statement.setString(2, brand); statement.setString(3, itemCode);
        }, result -> {
            while (result.next()) {
                String skuCode = result.getString(1);
                String optionValueCode = result.getString(2);
                long version = result.getLong(3);
                JsonNode rows = json(result.getString(4));
                if (!rows.isArray()) continue;
                for (JsonNode row : rows) {
                    ObjectNode node = nodes.addObject().put("nodeType", optionValueCode != null ? "OPTION_VALUE_BOM" : (skuCode == null ? "ITEM_BOM" : "SKU_BOM"))
                        .put("mode", "BOM").put("targetRef", row.path("targetRef").asText(row.path("componentTargetRef").asText("")))
                        .put("quantity", row.path("quantity").asText(row.path("quantityPerUnit").asText("0")))
                        .put("unit", row.path("unit").asText(""))
                        .put("version", version).put("itemCode", itemCode);
                    if (skuCode == null) node.putNull("skuCode"); else node.put("skuCode", skuCode);
                    if (optionValueCode == null) node.putNull("optionValueCode"); else node.put("optionValueCode", optionValueCode);
                    if (row.hasNonNull("lineSign")) node.put("lineSign", row.path("lineSign").asText());
                }
            }
            return null;
        });
        return envelope(requestId, data);
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode catalogItemVoidDependencies(String scope, String brand, String itemCode, String requestId) {
        requireScope(scope, brand);
        if (itemCode == null || itemCode.isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCode is required");
        long targetCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND item_code=?",
            Long.class, scope, brand, itemCode);
        long bomCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=?",
            Long.class, scope, brand, itemCode);
        ObjectNode result = mapper.createObjectNode().put("itemCode", itemCode)
            .put("hasDependentFacts", targetCount > 0 || bomCount > 0)
            .put("stockTargetCount", targetCount).put("productBomCount", bomCount);
        ArrayNode facts = result.putArray("dependentFacts");
        if (targetCount > 0) facts.addObject().put("factKind", "StockTarget").put("count", targetCount);
        if (bomCount > 0) facts.addObject().put("factKind", "ProductBom").put("count", bomCount);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode readCatalogInventorySummary(String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        requireCatalogDefinitionDataNodeType(dataNodeType);
        requireScope(scope, brand);
        return targetCounts(scope, brand, requestId, textArray(request == null ? null : request.path("itemCodes")));
    }

    @Override
    @Transactional
    public JsonNode ensureCatalogInventoryTarget(String scope, String brand, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(scope, brand);
        String itemCode = required(request, "itemCode");
        String skuCode = optional(request, "skuCode");
        String mode = required(request, "mode");
        if (!Set.of("INDEPENDENT_STOCK", "BOM").contains(mode)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "库存对象只能由独立库存控制或 BOM 规则创建");
        String targetRef = optional(request, "targetRef");
        if (targetRef != null && !targetRef.isBlank()) {
            TargetRow existing = target(scope, brand, targetRef);
            if (!itemCode.equals(existing.itemCode()) || !java.util.Objects.equals(skuCode, existing.skuCode())) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "库存对象身份与商品/SKU 不一致");
            if (request.path("configuration").isObject() && request.path("configuration").size() > 0) {
                if (!request.has("expectedVersion")) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "inventory target version is required");
                long expected = requiredLong(request, "expectedVersion");
                ObjectNode configuration = json(existing.configuration()).isObject()
                    ? (ObjectNode) json(existing.configuration()).deepCopy()
                    : mapper.createObjectNode();
                configuration.setAll((ObjectNode) request.path("configuration"));
                configuration.put("mode", mode);
                configuration.put("countingUnit", configuration.path("countingUnit").asText(existing.measureMode()));
                configuration.put("conversionFactor", configuration.path("conversionFactor").asText("1"));
                if (!configuration.has("allowNegative")) configuration.put("allowNegative", false);
                normalizeConfiguration(configuration);
                if (jdbc.update("UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND target_ref=? AND version=?", canonical(configuration), time.currentEpochMillis(), scope, brand, existing.ref(), expected) != 1) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
                return mapper.createObjectNode().put("targetRef", targetRef).put("version", expected + 1).put("created", false);
            }
            return mapper.createObjectNode().put("targetRef", targetRef).put("version", existing.version()).put("created", false);
        }
        String consumptionUnit = optional(request, "consumptionUnit");
        if (consumptionUnit == null || consumptionUnit.isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "consumptionUnit is required when creating an inventory object");
        ObjectNode configuration = request.path("configuration").isObject() ? (ObjectNode) request.path("configuration").deepCopy() : mapper.createObjectNode();
        configuration.put("mode", mode);
        String configuredCountingUnit = configuration.path("countingUnit").asText("");
        configuration.put("countingUnit", configuredCountingUnit.isBlank() ? consumptionUnit : configuredCountingUnit);
        String configuredFactor = configuration.path("conversionFactor").asText("");
        configuration.put("conversionFactor", configuredFactor.isBlank() ? "1" : configuredFactor);
        if (!configuration.has("allowNegative")) configuration.put("allowNegative", false);
        normalizeConfiguration(configuration);
        jdbc.update("INSERT INTO inventory.stock_target(target_ref,data_node_ref,brand_ref,item_code,sku_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,CAST(? AS JSONB),0,1,?,?) ON CONFLICT (data_node_ref,brand_ref,item_code,(COALESCE(sku_code, ''))) DO NOTHING", UUID.randomUUID(), scope, brand, itemCode, skuCode, consumptionUnit, canonical(configuration), time.currentEpochMillis(), time.currentEpochMillis());
        TargetRow created = loadTargets(scope, brand, itemCode).stream().filter(row -> java.util.Objects.equals(row.skuCode(), skuCode)).findFirst().orElseThrow(() -> new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存对象创建后无法读取"));
        return mapper.createObjectNode().put("targetRef", created.ref().toString()).put("version", created.version()).put("created", true);
    }

    @Override
    @Transactional
    public JsonNode saveCatalogProductBom(String scope, String brand, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(scope, brand);
        String itemCode = required(request, "itemCode");
        String skuCode = optional(request, "skuCode");
        String optionValueCode = optional(request, "optionValueCode");
        if (skuCode != null && optionValueCode != null) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM owner 不能同时指定 SKU 与选项值");
        JsonNode rows = request.path("rows");
        if (!rows.isArray()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM rows must be an array");
        long expected = request.has("expectedVersion") ? requiredLong(request, "expectedVersion") : 0L;
        List<String> targets = new ArrayList<>();
        rows.forEach(row -> {
            String component = row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
            if (component.isBlank()) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "BOM 组件必须选择已有库存对象");
            targets.add(component);
            try { target(scope, brand, component); } catch (InventoryOwnerApi.Problem failure) { throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "BOM 组件库存对象不存在"); }
            BigDecimal quantity = decimalValue((ObjectNode) row, "quantity");
            String lineSign = normalizeLineSign(row.path("lineSign").asText("POSITIVE"));
            if (!Set.of("POSITIVE", "NEGATIVE").contains(lineSign) || quantity.signum() == 0 || row.path("unit").asText("").isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 组件数量、单位与行方向必须有效");
            if (("POSITIVE".equals(lineSign) && quantity.signum() < 0) || ("NEGATIVE".equals(lineSign) && quantity.signum() > 0)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "BOM 行方向与数量符号不一致");
        });
        String currentSql = optionValueCode != null
            ? "SELECT version FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=? AND sku_code IS NULL AND option_value_code=?"
            : (skuCode == null
                ? "SELECT version FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=? AND sku_code IS NULL AND option_value_code IS NULL"
                : "SELECT version FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=? AND sku_code=? AND option_value_code IS NULL");
        List<Long> current = jdbc.query(currentSql,
            statement -> { statement.setString(1, scope); statement.setString(2, brand); statement.setString(3, itemCode); if (optionValueCode != null) statement.setString(4, optionValueCode); else if (skuCode != null) statement.setString(4, skuCode); },
            result -> { List<Long> values = new ArrayList<>(); while (result.next()) values.add(result.getLong(1)); return values; });
        if ((current.isEmpty() ? 0L : current.get(0)) != expected) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "商品 BOM 版本已变化");
        ArrayNode normalized = mapper.createArrayNode();
        rows.forEach(row -> normalized.addObject().put("lineSign", normalizeLineSign(row.path("lineSign").asText("POSITIVE"))).put("targetRef", row.path("targetRef").asText(row.path("componentTargetRef").asText())).put("quantity", row.path("quantity").asText(row.path("quantityPerUnit").asText("0"))).put("unit", row.path("unit").asText("")));
        long next = expected + 1;
        jdbc.update("INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT (data_node_ref,brand_ref,item_code,(COALESCE(sku_code, '')),(COALESCE(option_value_code, ''))) DO UPDATE SET version=EXCLUDED.version,rows=EXCLUDED.rows,updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis", UUID.randomUUID(), scope, brand, itemCode, skuCode, optionValueCode, next, canonical(normalized), time.currentEpochMillis());
        return mapper.createObjectNode().put("itemCode", itemCode).put("version", next).put("saved", true);
    }

    private List<TargetRow> loadTargets(String scope, String brand, String itemCode) {
        return jdbc.query("SELECT target_ref,item_code,sku_code,measure_mode,balance,configuration::text,version,updated_at_epoch_millis FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND item_code=? ORDER BY sku_code NULLS FIRST", (r, n) -> new TargetRow(r.getObject(1, UUID.class), r.getString(2), r.getString(3), r.getString(4), r.getBigDecimal(5), r.getString(6), r.getLong(7), r.getLong(8)), scope, brand, itemCode);
    }

    private void assertSourceNoOwnerReference(TargetRow row, String sourceScope) {
        assertJsonNoOwnerReference(json(row.configuration()), sourceScope);
    }

    private void verifyTargetNoOwnerReference(String targetScope, String brand, List<String> itemCodes, String sourceScope) {
        for (String itemCode : itemCodes) {
            for (TargetRow row : loadTargets(targetScope, brand, itemCode)) assertJsonNoOwnerReference(json(row.configuration()), sourceScope);
            jdbc.query("SELECT rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=?", result -> { while (result.next()) { assertJsonNoOwnerReference(json(result.getString(1)), sourceScope); } return null; }, targetScope, brand, itemCode);
        }
    }

    private void assertJsonNoOwnerReference(JsonNode node, String sourceScope) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                JsonNode value = entry.getValue();
                if (Set.of("headCompanyRef", "ownerRef", "dataNodeRef", "scopeRef", "originScopeRef").contains(entry.getKey()) && value.isTextual() && sourceScope.equals(value.asText())) {
                    throw new InventoryOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "库存目标仍含来源 owner 引用");
                }
                assertJsonNoOwnerReference(value, sourceScope);
            }
        } else if (node.isArray()) node.forEach(value -> assertJsonNoOwnerReference(value, sourceScope));
    }

    private JsonNode copyLocalConfiguration(String scope, String targetScope, String brand, String sourceItemCode, String targetItemCode) {
        int changed = jdbc.update("INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) SELECT ?,?,?,?,sku_code,option_value_code,version,rows,? FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=? ON CONFLICT (data_node_ref,brand_ref,item_code,(COALESCE(sku_code, '')),(COALESCE(option_value_code, ''))) DO UPDATE SET rows=EXCLUDED.rows,version=inventory.stock_bom.version+1,updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis", UUID.randomUUID(), targetScope, brand, targetItemCode, time.currentEpochMillis(), scope, brand, sourceItemCode);
        return mapper.createObjectNode().put("owner", "inventory").put("status", "COMMITTED").put("version", changed);
    }

    private void copyRewrittenBom(String sourceScope, String targetScope, String brand, BomOwnerRow source, Map<UUID, UUID> targetRefs) {
        JsonNode parsed = json(source.rows());
        if (!parsed.isArray()) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "库存 BOM 行不是有效数组");
        ArrayNode rewritten = mapper.createArrayNode();
        for (JsonNode line : parsed) {
            if (!line.isObject()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "库存 BOM 行不是对象");
            ObjectNode row = (ObjectNode) line.deepCopy();
            String sourceRef = row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
            TargetRow component = findTargetByRef(sourceScope, brand, sourceRef);
            UUID mapped = component == null ? null : targetRefs.get(component.ref());
            if (mapped == null) throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "库存 BOM 组件不在复制闭包中");
            row.put("targetRef", mapped.toString());
            row.remove("componentTargetRef");
            rewritten.add(row);
        }
        assertJsonNoOwnerReference(rewritten, sourceScope);
        jdbc.update("INSERT INTO inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,CAST(? AS JSONB),?) ON CONFLICT (data_node_ref,brand_ref,item_code,(COALESCE(sku_code, '')),(COALESCE(option_value_code, ''))) DO UPDATE SET version=EXCLUDED.version,rows=EXCLUDED.rows,updated_at_epoch_millis=EXCLUDED.updated_at_epoch_millis", UUID.randomUUID(), targetScope, brand, source.itemCode(), source.skuCode(), source.optionValueCode(), source.version(), canonical(rewritten), time.currentEpochMillis());
    }

    private TargetRow findTargetByRef(String scope, String brand, String targetRef) {
        if (targetRef == null || targetRef.isBlank()) return null;
        try { UUID ref = UUID.fromString(targetRef); return jdbc.query("SELECT target_ref,item_code,sku_code,measure_mode,balance,configuration::text,version,updated_at_epoch_millis FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref=?", r -> { if (!r.next()) return null; return new TargetRow(r.getObject(1, UUID.class), r.getString(2), r.getString(3), r.getString(4), r.getBigDecimal(5), r.getString(6), r.getLong(7), r.getLong(8)); }, scope, brand, ref); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    private String targetIdentityCode(String itemCode, String skuCode) { return itemCode + (skuCode == null || skuCode.isBlank() ? "" : "::" + skuCode); }

    private ObjectNode targets(String scope, String brand, String requestId, ObjectNode request) {
        validateTargetPageQuery(request);
        if (request.path("countOnly").asBoolean(false)) return targetCounts(scope, brand, requestId, textArray(request.path("itemCodes")));
        String keyword = optional(request, "keyword");
        String stockView = optional(request, "stockView");
        long offset = parseCursor(request, "cursor"); int pageSize = parsePageSize(request, "pageSize", 20);
        List<String> catalogItemCodes = textArray(request.path("catalogItemCodes"));
        if (request.has("catalogItemCodes") && catalogItemCodes.isEmpty()) return emptyTargetPage(requestId, scope, brand);
        String viewPredicate = stockView == null || stockView.isBlank() || "ALL".equals(stockView) ? "TRUE" : "NEEDS_ATTENTION".equals(stockView) ? "stock_state <> 'OK'" : "stock_state='" + stockView + "'";
        StringBuilder sql = new StringBuilder("WITH base AS (SELECT st.target_ref, st.item_code, st.sku_code, st.measure_mode, st.balance, st.configuration::text AS configuration, st.version, st.updated_at_epoch_millis, COALESCE(NULLIF(st.configuration->>'lowStockThreshold','')::numeric,0) AS threshold, st.configuration->>'unknown'='true' AS unknown_flag FROM inventory.stock_target st WHERE st.data_node_ref=? AND st.brand_ref=?");
        List<Object> args = new ArrayList<>(); args.add(scope); args.add(brand);
        if (keyword == null || keyword.isBlank()) sql.append(" AND (?::text IS NULL)"); else sql.append(" AND st.item_code ILIKE '%'||?||'%'"); args.add(keyword);
        if (!catalogItemCodes.isEmpty()) { sql.append(" AND st.item_code IN (").append(String.join(",", java.util.Collections.nCopies(catalogItemCodes.size(), "?"))).append(")"); args.addAll(catalogItemCodes); }
        sql.append("), classified AS (SELECT target_ref, item_code, sku_code, measure_mode, balance, configuration, version, updated_at_epoch_millis, threshold, unknown_flag, CASE WHEN unknown_flag THEN 'UNKNOWN' WHEN balance < 0 THEN 'NEGATIVE' WHEN balance = 0 THEN 'OUT' WHEN threshold > 0 AND balance < threshold THEN 'LOW' ELSE 'OK' END AS stock_state FROM base), aggregate AS (SELECT COUNT(*) AS all_count, COUNT(*) FILTER (WHERE stock_state <> 'OK') AS attention_count, COUNT(*) FILTER (WHERE stock_state='LOW') AS low_count, COUNT(*) FILTER (WHERE stock_state='OUT') AS out_count, COUNT(*) FILTER (WHERE stock_state='NEGATIVE') AS negative_count, COUNT(*) FILTER (WHERE stock_state='UNKNOWN') AS unknown_count, COUNT(*) FILTER (WHERE ").append(viewPredicate).append(") AS view_count FROM classified), paged AS (SELECT target_ref, item_code, sku_code, measure_mode, balance, configuration, version, updated_at_epoch_millis, stock_state FROM classified WHERE ").append(viewPredicate).append(" ORDER BY item_code, sku_code NULLS FIRST, target_ref OFFSET ? LIMIT ?) SELECT p.target_ref,p.item_code,p.sku_code,p.measure_mode,p.balance,p.configuration,p.version,p.updated_at_epoch_millis,p.stock_state,a.all_count,a.attention_count,a.low_count,a.out_count,a.negative_count,a.unknown_count,a.view_count FROM aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.item_code,p.sku_code NULLS FIRST,p.target_ref");
        args.add(offset); args.add(pageSize + 1);
        List<TargetPageRow> rows = jdbc.query(sql.toString(), (r, n) -> {
            UUID ref = r.getObject(1, UUID.class); TargetRow target = ref == null ? null : new TargetRow(ref, r.getString(2), r.getString(3), r.getString(4), r.getBigDecimal(5), r.getString(6), r.getLong(7), r.getLong(8));
            return new TargetPageRow(target, r.getString(9), r.getLong(10), r.getLong(11), r.getLong(12), r.getLong(13), r.getLong(14), r.getLong(15), r.getLong(16));
        }, args.toArray());
        long total = rows.isEmpty() ? 0 : rows.get(0).allCount(); long viewTotal = rows.isEmpty() ? 0 : rows.get(0).viewCount();
        boolean hasNext = rows.stream().filter(row -> row.target() != null).count() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, Math.min(pageSize, rows.size())));
        java.util.Map<UUID, ChangeSnapshot> snapshots = loadChangeSnapshots(rows.stream().map(TargetPageRow::target).filter(java.util.Objects::nonNull).toList());
        ObjectNode data = mapper.createObjectNode(); ArrayNode items = data.putArray("items");
        for (TargetPageRow row : rows) if (row.target() != null) items.add(targetListRow(row.target(), row.stockState(), "UNKNOWN".equals(row.stockState()), snapshots.get(row.target().ref())));
        ObjectNode counts = data.putObject("counts").put("ALL", total).put("NEEDS_ATTENTION", rows.isEmpty() ? 0 : rows.get(0).attentionCount()).put("LOW", rows.isEmpty() ? 0 : rows.get(0).lowCount()).put("OUT", rows.isEmpty() ? 0 : rows.get(0).outCount()).put("NEGATIVE", rows.isEmpty() ? 0 : rows.get(0).negativeCount()).put("UNKNOWN", rows.isEmpty() ? 0 : rows.get(0).unknownCount());
        data.put("total", viewTotal).put("generation", generation(scope, brand)); if (hasNext) data.put("cursor", Long.toString(offset + pageSize)); else data.putNull("cursor");
        return envelope(requestId, data);
    }

    private ObjectNode targetCounts(String scope, String brand, String requestId, List<String> itemCodes) {
        ObjectNode data = mapper.createObjectNode(); ArrayNode items = data.putArray("items"); if (itemCodes.isEmpty()) { data.put("total", 0).put("generation", generation(scope, brand)); return envelope(requestId, data); }
        String requestedValues = String.join(",", java.util.Collections.nCopies(itemCodes.size(), "(?::text)"));
        String sql = "WITH requested(item_code) AS (VALUES " + requestedValues + "), target_counts AS ("
            + "SELECT st.item_code,COUNT(*) AS target_count FROM inventory.stock_target st JOIN requested r ON r.item_code=st.item_code "
            + "WHERE st.data_node_ref=? AND st.brand_ref=? GROUP BY st.item_code), bom_counts AS ("
            + "SELECT sb.item_code,COUNT(*) AS bom_count FROM inventory.stock_bom sb JOIN requested r ON r.item_code=sb.item_code "
            + "WHERE sb.data_node_ref=? AND sb.brand_ref=? GROUP BY sb.item_code) "
            + "SELECT r.item_code,COALESCE(t.target_count,0),COALESCE(b.bom_count,0) FROM requested r "
            + "LEFT JOIN target_counts t ON t.item_code=r.item_code LEFT JOIN bom_counts b ON b.item_code=r.item_code ORDER BY r.item_code";
        List<Object> args = new ArrayList<>(itemCodes); args.add(scope); args.add(brand); args.add(scope); args.add(brand);
        jdbc.query(sql, args.toArray(), r -> { while (r.next()) items.addObject().put("productCode", r.getString(1)).put("targetCount", r.getLong(2)).put("bomCount", r.getLong(3)); return null; });
        data.put("total", items.size()).put("generation", generation(scope, brand)); return envelope(requestId, data);
    }
    private ObjectNode emptyTargetPage(String requestId, String scope, String brand) { ObjectNode data = mapper.createObjectNode(); data.putArray("items"); data.putObject("counts").put("ALL", 0).put("NEEDS_ATTENTION", 0).put("LOW", 0).put("OUT", 0).put("NEGATIVE", 0).put("UNKNOWN", 0); data.put("total", 0).put("generation", generation(scope, brand)).putNull("cursor"); return envelope(requestId, data); }
    public static void validateTargetPageQuery(ObjectNode request) {
        if (request == null) return; Set<String> allowed = Set.of("dataNodeRef", "keyword", "categoryRef", "stockView", "cursor", "pageSize", "catalogItemCodes", "countOnly", "itemCodes"); request.fieldNames().forEachRemaining(field -> { if (!allowed.contains(field)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "unknown inventory page query field: " + field); });
        String stockView = optional(request, "stockView"); if (stockView != null && !Set.of("ALL", "NEEDS_ATTENTION", "LOW", "OUT", "NEGATIVE", "UNKNOWN").contains(stockView)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "stockView is not supported");
        parsePageSize(request, "pageSize", 20); parseCursor(request, "cursor"); if (request.has("catalogItemCodes") && !request.path("catalogItemCodes").isArray()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "catalogItemCodes must be an array"); if (request.has("itemCodes") && !request.path("itemCodes").isArray()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCodes must be an array");
        if (optional(request, "categoryRef") != null && !request.has("catalogItemCodes")) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "categoryRef must be resolved by catalog owner");
    }
    private static int parsePageSize(ObjectNode request, String key, int fallback) { JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) return fallback; try { int parsed = Integer.parseInt(value.asText()); if (parsed < 1 || parsed > 100) throw new NumberFormatException(); return parsed; } catch (NumberFormatException ex) { throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be between 1 and 100"); } }
    private static long parseCursor(ObjectNode request, String key) { JsonNode value = request == null ? null : request.get(key); if (value == null || value.isNull() || value.asText().isBlank()) return 0L; try { long parsed = Long.parseLong(value.asText()); if (parsed < 0) throw new NumberFormatException(); return parsed; } catch (NumberFormatException ex) { throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be a non-negative opaque cursor"); } }
    private static List<String> textArray(JsonNode value) { if (value == null || !value.isArray()) return List.of(); java.util.LinkedHashSet<String> result = new java.util.LinkedHashSet<>(); value.forEach(entry -> { if (entry.isTextual() && !entry.asText().isBlank()) result.add(entry.asText()); }); return List.copyOf(result); }

    private ObjectNode current(String scope, String brand, String requestId, String targetRef) {
        TargetRow row = target(scope, brand, targetRef); JsonNode configuration = json(row.configuration());
        ObjectNode data = mapper.createObjectNode(); data.set("target", targetDetail(row));
        ObjectNode config = data.putObject("configuration").put("allowNegative", configuration.path("allowNegative").asBoolean(false));
        if (configuration.hasNonNull("lowStockThreshold")) config.put("lowStockThreshold", decimal(configuration.path("lowStockThreshold").decimalValue())); else config.putNull("lowStockThreshold");
        config.put("countingUnit", configuration.path("countingUnit").asText(row.measureMode())).put("conversionFactor", decimal(decimalNode(configuration, "conversionFactor").signum() <= 0 ? BigDecimal.ONE : decimalNode(configuration, "conversionFactor")));
        data.put("balance", decimal(row.balance())).put("version", row.version());
        String stockState = state(row.balance(), configuration);
        data.put("stockState", stockState).put("stale", false).put("unknown", "UNKNOWN".equals(stockState));
        BigDecimal threshold = decimalNode(configuration, "lowStockThreshold"); data.put("threshold", decimal(threshold)); data.put("gap", decimal(threshold.subtract(row.balance())));
        ObjectNode changes = data.putObject("changeSummary"); changes.set("today", changeSummaryData(targetRef, "TODAY").without("period")); changes.set("sevenDays", changeSummaryData(targetRef, "7D").without("period")); changes.set("thirtyDays", changeSummaryData(targetRef, "30D").without("period"));
        data.set("recentChanges", recentChanges(targetRef));
        data.set("references", referencesData(scope, brand, targetRef)); data.set("ledger", ledgerEntries(targetRef, 100));
        data.putObject("diagnosticsAvailability").put("canRead", false).put("reason", "permission_required");
        return data;
    }

    private ObjectNode changeSummaryData(String targetRef, String period) {
        long since = periodStart(period); ObjectNode data = mapper.createObjectNode().put("period", period == null ? "TODAY" : period).put("increase", "0").put("decrease", "0").put("netChange", "0").put("entryCount", 0);
        jdbc.query("SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0), COALESCE(SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END),0), COUNT(*) FROM inventory.stock_ledger WHERE target_ref=? AND occurred_at_epoch_millis>=?", s -> { s.setObject(1, UUID.fromString(targetRef)); s.setLong(2, since); }, r -> { if (r.next()) { BigDecimal increase = r.getBigDecimal(1); BigDecimal decrease = r.getBigDecimal(2); data.put("increase", decimal(increase)).put("decrease", decimal(decrease)).put("netChange", decimal(increase.subtract(decrease))).put("entryCount", r.getLong(3)); } return null; });
        return data;
    }

    private ObjectNode history(String requestId, String targetRef, ObjectNode request) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        final long[] total = {0L};
        jdbc.query(
            "SELECT entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_millis,COUNT(*) OVER() "
                + "FROM inventory.stock_ledger WHERE target_ref=? AND operation_id IN ('COUNT','INCREASE') "
                + "ORDER BY occurred_at_epoch_millis DESC,entry_ref DESC LIMIT ? OFFSET ?",
            statement -> { statement.setObject(1, UUID.fromString(targetRef)); statement.setInt(2, pageSize + 1); statement.setLong(3, offset); },
            result -> {
                while (result.next()) {
                    if (entries.size() <= pageSize) {
                        entries.addObject()
                            .put("entryRef", result.getObject(1, UUID.class).toString())
                            .put("action", result.getString(2))
                            .put("quantity", decimal(result.getBigDecimal(3)))
                            .put("beforeQuantity", decimal(result.getBigDecimal(4)))
                            .put("afterQuantity", decimal(result.getBigDecimal(5)))
                            .put("occurredAt", result.getLong(7))
                            .put("source", result.getString(2))
                            .put("reasonCode", result.getString(6) == null ? "" : result.getString(6));
                    }
                    total[0] = result.getLong(8);
                }
                return null;
            });
        boolean hasNext = entries.size() > pageSize;
        if (hasNext) entries.remove(entries.size() - 1);
        data.put("total", total[0]);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize)); else data.putNull("cursor");
        return data;
    }
    private ObjectNode references(String scope, String brand, String requestId, String targetRef, ObjectNode request) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        final long[] total = {0L};
        // The reference zone is independently pageable; do not materialize the
        // whole BOM graph just to slice one target's page in Java.
        jdbc.query(
            "WITH expanded AS ("
                + "SELECT sb.item_code,sb.sku_code,sb.option_value_code,entry->>'nodeType' AS source_kind,"
                + "COALESCE(entry->>'quantity',entry->>'quantityPerUnit','0') AS quantity,"
                + "COALESCE(entry->>'unit','') AS unit,entry->>'timing' AS timing,"
                + "COALESCE(entry->>'status','ACTIVE') AS status,ord,COUNT(*) OVER() AS total "
                + "FROM inventory.stock_bom sb "
                + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(sb.rows)='array' THEN sb.rows ELSE '[]'::jsonb END) WITH ORDINALITY AS e(entry,ord) "
                + "WHERE sb.data_node_ref=? AND sb.brand_ref=? "
                + "AND COALESCE(entry->>'targetRef',entry->>'componentTargetRef')=?"
                + ") SELECT item_code,sku_code,option_value_code,source_kind,quantity,unit,timing,status,total "
                + "FROM expanded ORDER BY item_code,sku_code NULLS FIRST,ord LIMIT ? OFFSET ?",
            statement -> {
                statement.setString(1, scope);
                statement.setString(2, brand);
                statement.setString(3, targetRef);
                statement.setInt(4, pageSize + 1);
                statement.setLong(5, offset);
            },
            result -> {
                while (result.next()) {
                    if (entries.size() <= pageSize) {
                        ObjectNode entry = entries.addObject()
                            .put("sourceCode", result.getString(1))
                            .put("sourceKind", result.getString(4) == null ? "ITEM" : result.getString(4))
                            .put("quantity", result.getString(5) == null ? "0" : result.getString(5))
                            .put("unit", result.getString(6) == null ? "" : result.getString(6))
                            .put("timing", result.getString(7) == null ? "BOM" : result.getString(7))
                            .put("status", result.getString(8) == null ? "ACTIVE" : result.getString(8));
                        if (result.getString(3) == null) entry.putNull("sourceOptionValueCode"); else entry.put("sourceOptionValueCode", result.getString(3));
                        if (result.getString(2) == null) entry.putNull("sourceSkuCode"); else entry.put("sourceSkuCode", result.getString(2));
                    }
                    total[0] = result.getLong(9);
                }
                return null;
            }
        );
        boolean hasNext = entries.size() > pageSize;
        if (hasNext) entries.remove(entries.size() - 1);
        data.put("total", total[0]);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize)); else data.putNull("cursor");
        return data;
    }
    private ObjectNode ledger(String requestId, String targetRef, ObjectNode request) {
        int pageSize = parsePageSize(request, "pageSize", 20);
        long offset = parseCursor(request, "cursor");
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        final long[] total = {0L};
        jdbc.query(
            "SELECT entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_millis,COUNT(*) OVER() "
                + "FROM inventory.stock_ledger WHERE target_ref=? "
                + "ORDER BY occurred_at_epoch_millis DESC,entry_ref DESC LIMIT ? OFFSET ?",
            statement -> {
                statement.setObject(1, UUID.fromString(targetRef));
                statement.setInt(2, pageSize + 1);
                statement.setLong(3, offset);
            },
            result -> {
                while (result.next()) {
                    if (entries.size() <= pageSize) {
                        entries.addObject()
                            .put("entryRef", result.getObject(1, UUID.class).toString())
                            .put("source", result.getString(2))
                            .put("reasonCode", result.getString(6) == null ? "" : result.getString(6))
                            .put("beforeQuantity", decimal(result.getBigDecimal(4)))
                            .put("changeQuantity", decimal(result.getBigDecimal(3)))
                            .put("afterQuantity", decimal(result.getBigDecimal(5)))
                            .put("occurredAt", result.getLong(7));
                    }
                    total[0] = result.getLong(8);
                }
                return null;
            }
        );
        boolean hasNext = entries.size() > pageSize;
        if (hasNext) entries.remove(entries.size() - 1);
        data.put("total", total[0]);
        if (hasNext) data.put("cursor", Long.toString(offset + pageSize)); else data.putNull("cursor");
        return data;
    }
    private ObjectNode pageEntries(ArrayNode all, ObjectNode request) {
        long offset = parseCursor(request, "cursor");
        int pageSize = parsePageSize(request, "pageSize", 20);
        int from = (int) Math.min(offset, all.size());
        int to = Math.min(all.size(), from + pageSize);
        ArrayNode page = mapper.createArrayNode();
        for (int index = from; index < to; index++) page.add(all.get(index));
        ObjectNode data = mapper.createObjectNode().set("entries", page);
        data.put("total", all.size());
        if (to < all.size()) data.put("cursor", Integer.toString(to)); else data.putNull("cursor");
        return data;
    }
    private ObjectNode diagnostics(String requestId, String targetRef) { ObjectNode data = mapper.createObjectNode(); ObjectNode permission = data.putObject("permission"); permission.put("granted", true).putNull("reason"); data.putArray("queries"); data.putArray("timings"); data.putArray("warnings"); return data; }

    private ObjectNode adjust(String scope, String brand, String requestId, ObjectNode request, String operation) {
        String targetRef = required(request, "targetRef"); long expected = requiredLong(request, "expectedVersion"); TargetRow row = target(scope, brand, targetRef);
        if (row.version() != expected) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        rejectUnsupportedActionFields(request, operation);
        BigDecimal input = "COUNT".equals(operation) ? decimalValue(request, "countedQuantity") : decimalValue(request, "quantity");
        if (input.signum() < 0 || (!"COUNT".equals(operation) && input.signum() <= 0)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "quantity must be positive");
        if ("COUNT".equals(operation) && input.signum() == 0 && !request.path("zeroConfirmation").asBoolean(false)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "zeroConfirmation is required for a zero count");
        BigDecimal normalized = normalizeQuantity(request, row, input);
        BigDecimal delta = "COUNT".equals(operation) ? normalized.subtract(row.balance()) : normalized;
        if ("ADJUST".equals(operation) && "DECREASE".equals(optional(request, "direction"))) delta = delta.negate();
        BigDecimal after = row.balance().add(delta); JsonNode config = json(row.configuration());
        if (after.signum() < 0 && !config.path("allowNegative").asBoolean(false)) throw new InventoryOwnerApi.Problem("NEGATIVE_STOCK_NOT_ALLOWED", 422, "库存不能为负");
        UUID entryRef = UUID.randomUUID(); long now = time.currentEpochMillis();
        jdbc.update("INSERT INTO inventory.stock_ledger(entry_ref,target_ref,operation_id,delta,balance_before,balance_after,reason_code,note,occurred_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?)", entryRef, row.ref(), operation, delta, row.balance(), after, optional(request, "reasonCode"), optional(request, "note"), now);
        if (jdbc.update("UPDATE inventory.stock_target SET balance=?,version=version+1,updated_at_epoch_millis=? WHERE target_ref=? AND version=?", after, now, row.ref(), expected) != 1) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        ObjectNode result = mapper.createObjectNode().put("targetRef", row.ref().toString()).put("before", decimal(row.balance())).put("change", decimal(delta)).put("after", decimal(after)).put("ledgerEntryRef", entryRef.toString()).put("stockState", state(after, config)).put("version", expected + 1);
        return command(requestId, result, expected + 1);
    }

    private ObjectNode updateConfiguration(String scope, String brand, String requestId, ObjectNode request) {
        String targetRef = required(request, "targetRef"); long expected = requiredLong(request, "expectedVersion"); JsonNode config = request.get("configuration");
        if (config == null || !config.isObject()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration 必须为对象");
        ObjectNode normalized = normalizeConfiguration((ObjectNode) config);
        if (jdbc.update("UPDATE inventory.stock_target SET configuration=CAST(? AS JSONB),version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND target_ref=? AND version=?", canonical(normalized), time.currentEpochMillis(), scope, brand, UUID.fromString(targetRef), expected) != 1) throw new InventoryOwnerApi.Problem("VERSION_CONFLICT", 409, "库存对象版本已变化");
        return current(scope, brand, requestId, targetRef);
    }

    private void rejectUnsupportedActionFields(ObjectNode request, String operation) {
        Set<String> allowed = switch (operation) {
            case "COUNT" -> Set.of("targetRef", "expectedVersion", "countedQuantity", "unit", "note", "zeroConfirmation");
            case "INCREASE" -> Set.of("targetRef", "expectedVersion", "quantity", "unit", "note");
            case "ADJUST" -> Set.of("targetRef", "expectedVersion", "direction", "quantity", "unit", "reasonCode", "note");
            default -> Set.of();
        };
        request.fieldNames().forEachRemaining(field -> { if (!allowed.contains(field)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "unknown inventory action field: " + field); });
        String note = optional(request, "note"); if (note != null && note.length() > 200) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "note must be at most 200 characters");
        if (request.has("remark")) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "remark is not supported; use note");
        if ("ADJUST".equals(operation)) { String direction = required(request, "direction"); if (!Set.of("INCREASE", "DECREASE").contains(direction)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "direction is not supported"); String reason = required(request, "reasonCode"); if (!Set.of("RECOUNT", "RECEIPT", "WASTE", "TRANSFER", "CORRECTION", "OTHER").contains(reason)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "reasonCode is not supported"); }
    }
    private BigDecimal normalizeQuantity(ObjectNode request, TargetRow row, BigDecimal input) {
        String unit = optional(request, "unit"); if (unit == null || unit.isBlank()) return input;
        JsonNode config = json(row.configuration()); String consumptionUnit = row.measureMode(); String countingUnit = config.path("countingUnit").asText(consumptionUnit); if (!unit.equals(consumptionUnit) && !unit.equals(countingUnit)) throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_INCOMPATIBLE", 422, "输入单位不属于库存对象单位集合");
        if (unit.equals(consumptionUnit) || unit.equals(countingUnit) && unit.equals(consumptionUnit)) return input;
        BigDecimal factor = decimalNode(config, "conversionFactor"); if (factor.signum() <= 0) throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_INCOMPATIBLE", 422, "库存换算因子必须为正数"); return input.multiply(factor);
    }
    private ObjectNode normalizeConfiguration(ObjectNode config) {
        Set<String> allowed = Set.of("mode", "allowNegative", "lowStockThreshold", "countingUnit", "conversionFactor"); config.fieldNames().forEachRemaining(field -> { if (!allowed.contains(field)) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "unknown inventory configuration field: " + field); });
        if (!config.has("allowNegative") || !config.path("allowNegative").isBoolean()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration.allowNegative must be boolean");
        if (!config.hasNonNull("countingUnit") || config.path("countingUnit").asText().isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration.countingUnit is required");
        BigDecimal factor = decimalValue(config, "conversionFactor"); if (factor.signum() <= 0) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration.conversionFactor must be positive");
        if (config.hasNonNull("lowStockThreshold")) { BigDecimal threshold = decimalValue(config, "lowStockThreshold"); if (threshold.signum() < 0) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "configuration.lowStockThreshold cannot be negative"); }
        return (ObjectNode) config.deepCopy();
    }
    private TargetRow target(String scope, String brand, String ref) {
        try { UUID id = UUID.fromString(ref); return jdbc.queryForObject("SELECT target_ref,item_code,sku_code,measure_mode,balance,configuration::text,version,updated_at_epoch_millis FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND target_ref=?", (r, n) -> new TargetRow(r.getObject(1, UUID.class), r.getString(2), r.getString(3), r.getString(4), r.getBigDecimal(5), r.getString(6), r.getLong(7), r.getLong(8)), scope, brand, id); }
        catch (EmptyResultDataAccessException | IllegalArgumentException ex) { throw new InventoryOwnerApi.Problem("NOT_FOUND", 404, "库存对象不存在"); }
    }

    private java.util.Map<UUID, ChangeSnapshot> loadChangeSnapshots(List<TargetRow> targets) {
        if (targets == null || targets.isEmpty()) return java.util.Map.of();
        String values = String.join(",", java.util.Collections.nCopies(targets.size(), "(?::uuid)"));
        String sql = "WITH selected(target_ref) AS (VALUES " + values + "), bounds AS (SELECT ?::bigint AS now_epoch), "
            + "aggregate AS (SELECT l.target_ref, "
            + "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 86400000),0) AS today_change, "
            + "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 604800000),0) AS seven_day_change, "
            + "COALESCE(SUM(l.delta) FILTER (WHERE l.occurred_at_epoch_millis >= b.now_epoch - 2592000000),0) AS thirty_day_change "
            + "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref CROSS JOIN bounds b GROUP BY l.target_ref), "
            + "latest AS (SELECT l.target_ref,l.operation_id,l.occurred_at_epoch_millis,ROW_NUMBER() OVER (PARTITION BY l.target_ref ORDER BY l.occurred_at_epoch_millis DESC,l.entry_ref DESC) AS row_number "
            + "FROM inventory.stock_ledger l JOIN selected s ON s.target_ref=l.target_ref) "
            + "SELECT s.target_ref,a.today_change,a.seven_day_change,a.thirty_day_change,latest.operation_id,latest.occurred_at_epoch_millis "
            + "FROM selected s LEFT JOIN aggregate a ON a.target_ref=s.target_ref LEFT JOIN latest ON latest.target_ref=s.target_ref AND latest.row_number=1";
        List<Object> args = new ArrayList<>();
        for (TargetRow target : targets) args.add(target.ref());
        args.add(time.currentEpochMillis());
        java.util.Map<UUID, ChangeSnapshot> snapshots = new java.util.HashMap<>();
        jdbc.query(sql, args.toArray(), result -> {
            while (result.next()) {
                UUID ref = result.getObject(1, UUID.class);
                Long lastAt = result.getObject(6) == null ? null : result.getLong(6);
                snapshots.put(ref, new ChangeSnapshot(
                    result.getBigDecimal(2) == null ? BigDecimal.ZERO : result.getBigDecimal(2),
                    result.getBigDecimal(3) == null ? BigDecimal.ZERO : result.getBigDecimal(3),
                    result.getBigDecimal(4) == null ? BigDecimal.ZERO : result.getBigDecimal(4),
                    result.getString(5), lastAt));
            }
            return null;
        });
        return snapshots;
    }

    private ObjectNode targetListRow(TargetRow row) { return targetListRow(row, null, false, null); }

    private List<BomOwnerRow> loadBomOwners(String scope, String brand, String itemCode) {
        return jdbc.query("SELECT item_code,sku_code,option_value_code,version,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND item_code=? ORDER BY sku_code NULLS FIRST,option_value_code NULLS FIRST", (r, n) -> new BomOwnerRow(r.getString(1), r.getString(2), r.getString(3), r.getLong(4), r.getString(5)), scope, brand, itemCode);
    }

    private String bomOwnerIdentity(BomOwnerRow owner) {
        return owner.itemCode() + "::" + (owner.optionValueCode() == null ? (owner.skuCode() == null ? "ITEM" : "SKU:" + owner.skuCode()) : "OPTION_VALUE:" + owner.optionValueCode());
    }

    private ObjectNode targetListRow(TargetRow row, String queriedState, boolean queriedUnknown) { return targetListRow(row, queriedState, queriedUnknown, null); }
    private ObjectNode targetListRow(TargetRow row, String queriedState, boolean queriedUnknown, ChangeSnapshot snapshot) {
        JsonNode config = json(row.configuration()); BigDecimal threshold = decimalNode(config, "lowStockThreshold"); String stockState = queriedState == null ? state(row.balance(), config) : queriedState; String countingUnit = config.path("countingUnit").asText(row.measureMode()); BigDecimal factor = decimalNode(config, "conversionFactor"); if (factor.signum() <= 0) factor = BigDecimal.ONE;
        BigDecimal today = snapshot == null ? BigDecimal.ZERO : snapshot.today(); BigDecimal seven = snapshot == null ? BigDecimal.ZERO : snapshot.sevenDays(); BigDecimal thirty = snapshot == null ? BigDecimal.ZERO : snapshot.thirtyDays();
        ObjectNode result = mapper.createObjectNode().put("targetRef", row.ref().toString()).put("targetType", "PRODUCT").put("productCode", row.itemCode()).putNull("productName").putNull("skuCode").putNull("skuName").putNull("categoryName").putNull("materialRole").put("consumptionUnit", row.measureMode()).put("countingUnit", countingUnit).put("conversionSummary", countingUnit + " -> " + row.measureMode() + " × " + decimal(factor)).put("balance", decimal(row.balance())).put("stockState", stockState).put("stale", false).put("unknown", queriedUnknown || "UNKNOWN".equals(stockState)).put("threshold", decimal(threshold)).put("gap", decimal(threshold.subtract(row.balance()))).put("changeToday", decimal(today)).put("change7d", decimal(seven)).put("change30d", decimal(thirty)).put("authorityType", "INTERNAL");
        if (snapshot == null || snapshot.lastSource() == null) result.putNull("lastChangeSource"); else result.put("lastChangeSource", snapshot.lastSource());
        if (snapshot == null || snapshot.lastAt() == null) result.putNull("lastChangeAt"); else result.put("lastChangeAt", snapshot.lastAt());
        if (row.skuCode() != null) result.put("skuCode", row.skuCode()); return result;
    }

    private ObjectNode targetDetail(TargetRow row) { JsonNode config = json(row.configuration()); String countingUnit = config.path("countingUnit").asText(row.measureMode()); BigDecimal factor = decimalNode(config, "conversionFactor"); if (factor.signum() <= 0) factor = BigDecimal.ONE; ObjectNode result = mapper.createObjectNode().put("targetRef", row.ref().toString()).put("targetType", "PRODUCT").put("productCode", row.itemCode()).putNull("productName").put("productShape", row.measureMode()); if (row.skuCode() == null) result.putNull("skuCode").putNull("skuName"); else result.put("skuCode", row.skuCode()).putNull("skuName"); return result.put("consumptionUnit", row.measureMode()).put("countingUnit", countingUnit).put("conversionSummary", countingUnit + " -> " + row.measureMode() + " × " + decimal(factor)).put("authorityType", "INTERNAL"); }
    private ArrayNode ledgerEntries(String targetRef, int limit) { ArrayNode entries = mapper.createArrayNode(); jdbc.query("SELECT entry_ref,operation_id,delta,balance_before,balance_after,reason_code,occurred_at_epoch_millis FROM inventory.stock_ledger WHERE target_ref=? ORDER BY occurred_at_epoch_millis DESC LIMIT " + limit, s -> s.setObject(1, UUID.fromString(targetRef)), r -> { while (r.next()) entries.addObject().put("entryRef", r.getObject(1, UUID.class).toString()).put("source", r.getString(2)).put("reasonCode", r.getString(6) == null ? "" : r.getString(6)).put("beforeQuantity", decimal(r.getBigDecimal(4))).put("changeQuantity", decimal(r.getBigDecimal(3))).put("afterQuantity", decimal(r.getBigDecimal(5))).put("occurredAt", r.getLong(7)); return null; }); return entries; }
    private ArrayNode recentChanges(String targetRef) { ArrayNode entries = mapper.createArrayNode(); jdbc.query("SELECT operation_id,delta,occurred_at_epoch_millis FROM inventory.stock_ledger WHERE target_ref=? ORDER BY occurred_at_epoch_millis DESC LIMIT 20", s -> s.setObject(1, UUID.fromString(targetRef)), r -> { while (r.next()) entries.addObject().put("occurredAt", r.getLong(3)).put("changeType", r.getString(1)).put("quantity", decimal(r.getBigDecimal(2))).put("source", r.getString(1)); return null; }); return entries; }
    private ArrayNode referencesData(String scope, String brand, String targetRef) {
        ArrayNode entries = mapper.createArrayNode();
        jdbc.query("SELECT item_code,sku_code,option_value_code,rows::text FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? ORDER BY item_code,sku_code NULLS FIRST,option_value_code NULLS FIRST", statement -> {
            statement.setString(1, scope); statement.setString(2, brand);
        }, result -> {
            while (result.next()) {
                String sourceCode = result.getString(1);
                String skuCode = result.getString(2);
                String optionValueCode = result.getString(3);
                JsonNode rows = json(result.getString(4));
                if (!rows.isArray()) continue;
                rows.forEach(row -> {
                    String component = row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
                    if (!targetRef.equals(component)) return;
                    ObjectNode entry = entries.addObject()
                        .put("sourceCode", sourceCode)
                        .put("sourceKind", optionValueCode != null ? "OPTION_VALUE" : (skuCode == null ? "ITEM" : "SKU"))
                        .put("quantity", row.path("quantity").asText(row.path("quantityPerUnit").asText("0")))
                        .put("unit", row.path("unit").asText(""))
                        .put("timing", "BOM")
                        .put("status", "ACTIVE");
                    if (skuCode == null) entry.putNull("sourceSkuCode"); else entry.put("sourceSkuCode", skuCode);
                    if (optionValueCode == null) entry.putNull("sourceOptionValueCode"); else entry.put("sourceOptionValueCode", optionValueCode);
                });
            }
            return null;
        });
        return entries;
    }
    private long generation(String scope, String brand) { Long value = jdbc.queryForObject("SELECT COALESCE(MAX(version),0) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=?", Long.class, scope, brand); return value == null ? 0 : value; }
    private JsonNode replay(String scope, String key, String operation, ObjectNode request) { List<Receipt> rows = jdbc.query("SELECT operation_id,request_hash,response::text FROM inventory.command_receipt WHERE data_node_ref=? AND idempotency_key=? FOR UPDATE", (r, n) -> new Receipt(r.getString(1), r.getString(2), json(r.getString(3))), scope, key); if (rows.isEmpty()) return null; Receipt row = rows.get(0); if (!row.operation().equals(operation) || !row.requestHash().equals(hash(request))) throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求"); return row.response(); }
    private void saveReceipt(String scope, String key, String operation, ObjectNode request, JsonNode response) { jdbc.update("INSERT INTO inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)", UUID.randomUUID(), scope, key, operation, hash(request), canonical(response), time.currentEpochMillis()); }
    private ObjectNode envelope(String requestId, JsonNode data) { return mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId).set("data", data); }
    private ObjectNode command(String requestId, JsonNode result, long version) { ObjectNode node = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId); node.set("result", result); node.put("version", version); return node; }
    private JsonNode json(String text) { try { return mapper.readTree(text == null ? "{}" : text); } catch (Exception ex) { return mapper.createObjectNode(); } }
    private String canonical(JsonNode value) { try { return mapper.writeValueAsString(value); } catch (Exception ex) { throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid"); } }
    private String hash(JsonNode value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical(value).getBytes(StandardCharsets.UTF_8))); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private static String decimal(BigDecimal value) { return value == null ? "0" : value.stripTrailingZeros().toPlainString(); }
    private BigDecimal decimalNode(JsonNode node, String key) { JsonNode value = node.path(key); return value.isNumber() ? value.decimalValue() : value.isTextual() ? new BigDecimal(value.asText()) : BigDecimal.ZERO; }
    private static BigDecimal decimalValue(ObjectNode req, String key) { JsonNode v = req.get(key); if (v == null || (!v.isNumber() && !v.isTextual())) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal"); try { return new BigDecimal(v.asText()); } catch (NumberFormatException ex) { throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal"); } }
    private static String required(ObjectNode req, String key) { String value = optional(req, key); if (value == null || value.isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required"); return value; }
    private static String optional(ObjectNode req, String key) { JsonNode v = req == null ? null : req.get(key); return v == null || v.isNull() ? null : v.asText(); }
    static String normalizeLineSign(String value) { return switch (value) { case "COMPONENT", "ADD", "POSITIVE" -> "POSITIVE"; case "REMOVE", "SUBTRACT", "NEGATIVE" -> "NEGATIVE"; default -> value; }; }
    private static long requiredLong(ObjectNode req, String key) { JsonNode v = req == null ? null : req.get(key); if (v == null || !v.isIntegralNumber()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required"); return v.asLong(); }
    static String requireIdempotencyKey(String key) { if (key == null || key.isBlank()) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required"); return key.trim(); }
    static long periodDurationMillis(String period) {
        return switch (period == null ? "TODAY" : period) {
            case "TODAY" -> 86400000L;
            case "7D" -> 7 * 86400000L;
            case "30D" -> 30 * 86400000L;
            default -> throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "period is not supported");
        };
    }
    static boolean isBusinessHistoryOperation(String operation) { return "COUNT".equals(operation) || "INCREASE".equals(operation); }
    static void requireStoreDataNodeType(String dataNodeType) {
        if (!"STORE".equals(dataNodeType)) throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "库存余额、流水与库存动作仅支持门店数据节点");
    }
    static void requireCatalogDefinitionDataNodeType(String dataNodeType) {
        if (!Set.of("STORE", "HEAD_COMPANY").contains(dataNodeType)) throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "商品库存定义只支持门店或总公司数据节点");
    }
    private static void requireScope(String scope, String brand) { if (scope == null || scope.isBlank() || brand == null || brand.isBlank()) throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required"); }
    private long periodStart(String period) { return time.currentEpochMillis() - periodDurationMillis(period); }
    static String state(BigDecimal balance, JsonNode config) {
        if (config.path("unknown").asBoolean(false)) return "UNKNOWN";
        if (balance.signum() < 0) return "NEGATIVE";
        if (balance.signum() == 0) return "OUT";
        JsonNode thresholdNode = config.has("lowStockThreshold") ? config.path("lowStockThreshold") : config.path("threshold");
        BigDecimal threshold;
        try { threshold = thresholdNode.isNumber() ? thresholdNode.decimalValue() : thresholdNode.isTextual() ? new BigDecimal(thresholdNode.asText()) : BigDecimal.ZERO; }
        catch (NumberFormatException ignored) { threshold = BigDecimal.ZERO; }
        return threshold.signum() > 0 && balance.compareTo(threshold) < 0 ? "LOW" : "OK";
    }
    private record TargetRow(UUID ref, String itemCode, String skuCode, String measureMode, BigDecimal balance, String configuration, long version, long updatedAt) { }
    private record BomOwnerRow(String itemCode, String skuCode, String optionValueCode, long version, String rows) { }
    private record TargetPageRow(TargetRow target, String stockState, long allCount, long attentionCount, long lowCount, long outCount, long negativeCount, long unknownCount, long viewCount) { }
    private record ChangeSnapshot(BigDecimal today, BigDecimal sevenDays, BigDecimal thirtyDays, String lastSource, Long lastAt) { }
    private record Receipt(String operation, String requestHash, JsonNode response) { }
}
