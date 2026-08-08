package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;
import java.util.HexFormat;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner implementation for the production-tag subset delivered in this phase. */
@Service
public class ProductionTagOwnerService implements ProductionTagOwnerApi {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final List<String> TAG_KINDS = List.of("PRODUCTION", "PACKAGE", "LABEL", "HANDOFF", "REVIEW", "OTHER");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;
    public ProductionTagOwnerService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) { this.jdbc = jdbc; this.mapper = mapper; this.time = time; }

    @Override @Transactional(readOnly = true)
    public JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef); if (!"getOperationsProductionTags".equals(operationId)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "production tag read operation is not registered");
        ObjectNode data = mapper.createObjectNode(); ArrayNode entries = data.putArray("entries");
        jdbc.query("SELECT tag_ref,code,tag_kind,name,status,version,updated_at_epoch_millis FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? ORDER BY code LIMIT 100", s -> { s.setString(1, dataNodeRef); s.setString(2, brandRef); }, r -> { while (r.next()) { ObjectNode row = entries.addObject().put("code", r.getString(2)).put("tagKind", r.getString(3)).put("name", r.getString(4)).put("status", r.getString(5)).put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef).put("linkedProductCount", 0).put("version", r.getLong(6)).put("updatedAt", r.getLong(7)); voidAvailability(row); } return null; });
        data.putNull("cursor").put("total", entries.size()).put("generation", dataNodeRef + ":" + brandRef);
        return envelope(requestId, data);
    }

    @Override @Transactional
    public JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(dataNodeRef, brandRef); String key = requireIdempotencyKey(idempotencyKey); JsonNode replay = replay(dataNodeRef, key, operationId, request); if (replay != null) return replay;
        JsonNode result = switch (operationId) { case "createOperationsProductionTag" -> create(dataNodeRef, brandRef, requestId, request); case "updateOperationsProductionTag" -> update(dataNodeRef, brandRef, requestId, request); case "transitionOperationsProductionTagStatus" -> transition(dataNodeRef, brandRef, requestId, request); default -> throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "production tag write operation is not registered"); };
        saveReceipt(dataNodeRef, key, operationId, request, result); return result;
    }

    @Override @Transactional
    public JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return copy(sourceDataNodeRef, targetDataNodeRef, brandRef, request, requestId, null);
    }

    @Override @Transactional
    public JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey) {
        requireScope(sourceDataNodeRef, brandRef); requireScope(targetDataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isBlank()) {
            JsonNode replay = replay(targetDataNodeRef, receiptKey, "coordinatedCopy", request);
            if (replay != null) return replay;
        }
        if (request.hasNonNull("productionPreflightDigest")) {
            JsonNode judgement = preflightCopy(sourceDataNodeRef, targetDataNodeRef, brandRef, request);
            if (!request.path("productionPreflightDigest").asText().equals(judgement.path("digest").asText())) throw new ProductionTagOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "生产标签复制预检已失效，请重新预检");
            String blocker = judgement.path("firstBlockingProblem").asText("");
            if (!blocker.isBlank()) throw new ProductionTagOwnerApi.Problem(blocker, 422, "生产标签复制存在不兼容事实");
        }
        JsonNode codes = request.path("productionTagCodes"); if (!codes.isArray()) { JsonNode result = mapper.createObjectNode().put("owner", "fulfillment-production").put("status", "COMMITTED").put("version", 0); if (!receiptKey.isBlank()) saveReceipt(targetDataNodeRef, receiptKey, "coordinatedCopy", request, result); return result; }
        int copied = 0;
        for (JsonNode code : codes) {
            copied += jdbc.update("INSERT INTO fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,tag_kind,name,status,version,created_at_epoch_millis,updated_at_epoch_millis) SELECT ?,?,?,code,tag_kind,name,status,1,?,? FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=? ON CONFLICT DO NOTHING", UUID.randomUUID(), targetDataNodeRef, brandRef, time.currentEpochMillis(), time.currentEpochMillis(), sourceDataNodeRef, brandRef, code.asText());
        }
        verifyTargetNoOwnerReference(sourceDataNodeRef, targetDataNodeRef, brandRef, codes);
        JsonNode result = mapper.createObjectNode().put("owner", "fulfillment-production").put("status", "COMMITTED").put("version", copied);
        if (!receiptKey.isBlank()) saveReceipt(targetDataNodeRef, receiptKey, "coordinatedCopy", request, result);
        return result;
    }

    @Override @Transactional(readOnly = true)
    public JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request) {
        requireScope(sourceDataNodeRef, brandRef); requireScope(targetDataNodeRef, brandRef);
        JsonNode codes = request.path("productionTagCodes");
        if (!codes.isArray()) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签复制闭包缺少标签编码");
        ObjectNode snapshot = mapper.createObjectNode(); ArrayNode versions = snapshot.putArray("versions"); ArrayNode closureItems = snapshot.putArray("closureItems"); ArrayNode mappings = snapshot.putArray("mappingPreview"); ArrayNode results = snapshot.putArray("compatibilityResults");
        String firstBlocking = "";
        for (JsonNode codeNode : codes) {
            String code = codeNode.asText();
            TagRow source = find(sourceDataNodeRef, brandRef, code);
            if (source == null) { firstBlocking = firstBlocking.isBlank() ? "REFERENCE_MAPPING_UNRESOLVED" : firstBlocking; results.addObject().put("objectType", "PRODUCTION_TAG").put("code", code).put("result", "BLOCKED").put("reason", "来源标签不存在").put("problemCode", "REFERENCE_MAPPING_UNRESOLVED"); continue; }
            TagRow target = find(targetDataNodeRef, brandRef, code);
            String problem = ""; String result = target == null ? "CREATE" : "REUSE"; String reason = target == null ? "目标标签不存在，将创建" : "编码与名称一致，可复用";
            if (target != null && (!source.tagKind().equals(target.tagKind()) || !source.name().equals(target.name()))) { result = "BLOCKED"; reason = "同编码标签类型或语义不一致"; problem = "STRUCTURE_INCOMPATIBLE"; if (firstBlocking.isBlank()) firstBlocking = problem; }
            closureItems.addObject().put("objectType", "PRODUCTION_TAG").put("code", source.code()).put("name", source.name()).put("action", result);
            mappings.addObject().put("fromCode", source.code()).put("toCode", source.code()).put("referenceKind", "PRODUCTION_TAG").put("status", result);
            results.addObject().put("objectType", "PRODUCTION_TAG").put("code", code).put("tagKind", source.tagKind()).put("result", result).put("reason", reason).put("problemCode", problem);
            versions.addObject().put("objectType", "PRODUCTION_TAG").put("code", code).put("tagKind", source.tagKind()).put("sourceVersion", source.version()).put("targetVersion", target == null ? 0 : target.version());
        }
        snapshot.put("firstBlockingProblem", firstBlocking);
        ObjectNode result = mapper.createObjectNode().put("owner", "fulfillment-production").put("firstBlockingProblem", firstBlocking).put("digest", hash(snapshot)); result.set("closureItems", closureItems); result.set("mappingPreview", mappings); result.set("versions", versions); result.set("compatibilityResults", results); return result;
    }

    private ObjectNode create(String scope, String brand, String requestId, ObjectNode req) { String code = required(req, "code"), tagKind = requiredTagKind(req, "tagKind"), name = required(req, "name"); try { jdbc.update("INSERT INTO fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,tag_kind,name,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?)", UUID.randomUUID(), scope, brand, code, tagKind, name, time.currentEpochMillis(), time.currentEpochMillis()); } catch (DuplicateKeyException ex) { throw new ProductionTagOwnerApi.Problem("DUPLICATE_CODE", 409, "生产标签编码已存在"); } return command(requestId, tagResult(code, tagKind, name, "ENABLED", 1), 1); }
    private ObjectNode update(String scope, String brand, String requestId, ObjectNode req) { String code = required(req, "tagCode"), tagKind = requiredTagKind(req, "tagKind"), name = required(req, "name"); long expected = requiredLong(req, "expectedVersion"); TagRow current = find(scope, brand, code); if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在"); if (!current.tagKind().equals(tagKind)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签类型创建后不可修改"); if (jdbc.update("UPDATE fulfillment_production.production_tag_definition SET name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'", name, time.currentEpochMillis(), scope, brand, code, expected) != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化"); return command(requestId, tagResult(code, tagKind, name, status(scope, brand, code), expected + 1), expected + 1); }
    private ObjectNode transition(String scope, String brand, String requestId, ObjectNode req) { String code = required(req, "tagCode"), target = required(req, "targetStatus"); long expected = requiredLong(req, "expectedVersion"); if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(target)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法"); TagRow current = find(scope, brand, code); if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在"); if (jdbc.update("UPDATE fulfillment_production.production_tag_definition SET status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'", target, time.currentEpochMillis(), scope, brand, code, expected) != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化"); return command(requestId, tagResult(code, current.tagKind(), name(scope, brand, code), target, expected + 1), expected + 1); }

    private TagRow find(String scope, String brand, String code) { return jdbc.query("SELECT code,tag_kind,name,status,version FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=?", r -> { if (!r.next()) return null; return new TagRow(r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getLong(5)); }, scope, brand, code); }
    /** ProductionTagDefinition has no JSON/outbound owner refs; verify every copied row is target-scoped. */
    private void verifyTargetNoOwnerReference(String sourceScope, String targetScope, String brand, JsonNode codes) {
        if (sourceScope.equals(targetScope)) return;
        for (JsonNode code : codes) jdbc.query("SELECT data_node_ref,brand_ref FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=?", result -> {
            if (result.next() && (!targetScope.equals(result.getString(1)) || !brand.equals(result.getString(2)))) throw new ProductionTagOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "生产标签复制结果未保持目标 owner scope");
            return null;
        }, targetScope, brand, code.asText());
    }
    private ObjectNode tagResult(String code, String tagKind, String name, String status, long version) { ObjectNode result = mapper.createObjectNode().put("code", code).put("tagKind", tagKind).put("name", name); result.putObject("ownerScope").put("factType", "PRODUCTION_TAG").put("revision", REVISION); result.put("status", status).put("version", version); return result; }
    private void voidAvailability(ObjectNode row) { ObjectNode value = row.putObject("voidAvailability"); value.put("canVoid", !"VOIDED".equals(row.path("status").asText())); value.putArray("blockingReferences"); value.putArray("dependentFacts"); }
    private ObjectNode envelope(String requestId, JsonNode data) { return mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId).set("data", data); }
    private ObjectNode command(String requestId, JsonNode result, long version) { ObjectNode node = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId); node.set("result", result); node.put("version", version); return node; }
    private String name(String scope, String brand, String code) { return jdbc.query("SELECT name FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=?", s -> { s.setString(1, scope); s.setString(2, brand); s.setString(3, code); }, r -> { if (!r.next()) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在"); return r.getString(1); }); }
    private String status(String scope, String brand, String code) { return jdbc.query("SELECT status FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=?", s -> { s.setString(1, scope); s.setString(2, brand); s.setString(3, code); }, r -> { if (!r.next()) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在"); return r.getString(1); }); }
    private JsonNode replay(String scope, String key, String operation, ObjectNode request) { var rows = jdbc.query("SELECT operation_id,request_hash,response::text FROM fulfillment_production.command_receipt WHERE data_node_ref=? AND idempotency_key=? FOR UPDATE", (r, n) -> new Receipt(r.getString(1), r.getString(2), json(r.getString(3))), scope, key); if (rows.isEmpty()) return null; Receipt row = rows.get(0); if (!row.operation().equals(operation) || !row.hash().equals(hash(request))) throw new ProductionTagOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求"); return row.response(); }
    private void saveReceipt(String scope, String key, String operation, ObjectNode request, JsonNode response) { jdbc.update("INSERT INTO fulfillment_production.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,response,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)", UUID.randomUUID(), scope, key, operation, hash(request), canonical(response), time.currentEpochMillis()); }
    private String hash(JsonNode value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical(value).getBytes(StandardCharsets.UTF_8))); } catch (Exception ex) { throw new IllegalStateException(ex); } }
    private String canonical(JsonNode value) { try { return mapper.writeValueAsString(value); } catch (Exception ex) { throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid"); } }
    private JsonNode json(String value) { try { return mapper.readTree(value); } catch (Exception ex) { return mapper.createObjectNode(); } }
    private static String required(ObjectNode req, String key) { String value = req == null || req.get(key) == null ? null : req.get(key).asText(); if (value == null || value.isBlank()) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required"); return value; }
    static String requiredTagKind(ObjectNode req, String key) { String value = required(req, key); if (!TAG_KINDS.contains(value)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "tagKind is not supported"); return value; }
    private static long requiredLong(ObjectNode req, String key) { JsonNode value = req == null ? null : req.get(key); if (value == null || !value.isIntegralNumber()) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required"); return value.asLong(); }
    static String requireIdempotencyKey(String value) { if (value == null || value.isBlank()) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required"); return value.trim(); }
    private static void requireScope(String scope, String brand) { if (scope == null || scope.isBlank() || brand == null || brand.isBlank()) throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required"); }
    private record Receipt(String operation, String hash, JsonNode response) { }
    private record TagRow(String code, String tagKind, String name, String status, long version) { }
}
