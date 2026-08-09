package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Set;
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
        if (!"getOperationsProductionTags".equals(operationId)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "production tag read operation is not registered");
        return readTags(dataNodeRef, brandRef, requestId);
    }

    @Override @Transactional(readOnly = true)
    public JsonNode readTags(String dataNodeRef, String brandRef, String requestId) {
        requireScope(dataNodeRef, brandRef);
        ObjectNode data = mapper.createObjectNode(); ArrayNode entries = data.putArray("entries");
        jdbc.query("SELECT tag_ref,code,tag_kind,name,status,version,updated_at_epoch_millis FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? ORDER BY code LIMIT 100", s -> { s.setString(1, dataNodeRef); s.setString(2, brandRef); }, r -> { while (r.next()) { ObjectNode row = entries.addObject().put("tagRef", r.getObject(1, UUID.class).toString()).put("code", r.getString(2)).put("tagKind", r.getString(3)).put("name", r.getString(4)).put("status", r.getString(5)).put("ownerType", "DATA_NODE").put("ownerRef", dataNodeRef).put("brandRef", brandRef).put("linkedProductCount", 0).put("version", r.getLong(6)).put("updatedAt", r.getLong(7)); voidAvailability(row); } return null; });
        data.putNull("cursor").put("total", entries.size()).put("generation", dataNodeRef + ":" + brandRef);
        return envelope(requestId, data);
    }

    @Override @Transactional
    public JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                          UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant) {
        return writeCore(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey,
            () -> requireOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, dataNodeType, dataNodeRef, ownerScopeGrant));
    }

    @Override @Transactional
    public JsonNode write(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "fulfillment-production", null);
        return writeCore(context.operationToken().operationId(), scope.dataNodeId().toString(), scope.brandRef(), request, context.requestId(), idempotencyKey, () -> { });
    }

    private JsonNode writeCore(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, Runnable authorization) {
        requireScope(dataNodeRef, brandRef); authorization.run(); String key = requireIdempotencyKey(idempotencyKey);
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);
        }
        JsonNode replay = replay(dataNodeRef, key, operationId, request); if (replay != null) return replay;
        try (var command = OwnerOperationDiagnostics.beginCommand();
             var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
            JsonNode result = switch (operationId) { case "createOperationsProductionTag" -> create(dataNodeRef, brandRef, requestId, request); case "updateOperationsProductionTag" -> update(dataNodeRef, brandRef, requestId, request); case "transitionOperationsProductionTagStatus" -> transition(dataNodeRef, brandRef, requestId, request); default -> throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "production tag write operation is not registered"); };
            saveReceipt(dataNodeRef, key, operationId, request, result); return result;
        }
    }

    @Override @Transactional
    public JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                         UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant) {
        return copyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, requestId, idempotencyKey,
            () -> requireOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeRef, ownerScopeGrant));
    }

    @Override @Transactional
    public JsonNode copy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return copyCore(copySourceDataNodeRef(scope), scope.dataNodeId().toString(), scope.brandRef(), request, context.requestId(), idempotencyKey, () -> { });
    }

    private JsonNode copyCore(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, Runnable authorization) {
        requireScope(sourceDataNodeRef, brandRef); requireScope(targetDataNodeRef, brandRef); authorization.run();
        JsonNode judgement;
        try (var read = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_READ)) {
            recheckCopySourceFactsBeforeReceipt(sourceDataNodeRef, brandRef, request);
            judgement = preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization);
        }
        String currentFingerprint = judgement.path("digest").asText();
        String blocker = judgement.path("firstBlockingProblem").asText("");
        if (!blocker.isBlank()) throw new ProductionTagOwnerApi.Problem(blocker, 422, "生产标签复制存在不兼容事实");
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isBlank()) {
            JsonNode replay = replay(targetDataNodeRef, receiptKey, "coordinatedCopy", request);
            if (replay != null) return replayCopyIfCurrent(replay, currentFingerprint);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand();
             var write = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.OWNER_WRITE)) {
        if (request.hasNonNull("productionPreflightDigest")) {
            if (!request.path("productionPreflightDigest").asText().equals(currentFingerprint)) throw new ProductionTagOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "生产标签复制预检已失效，请重新预检");
        }
        JsonNode codes = request.path("productionTagRefs"); if (!codes.isArray()) { ObjectNode result = mapper.createObjectNode().put("owner", "fulfillment-production").put("status", "COMMITTED").put("version", 0); result.put("receiptObjectFingerprint", currentFingerprint); if (!receiptKey.isBlank()) saveReceipt(targetDataNodeRef, receiptKey, "coordinatedCopy", request, result); return result; }
        int copied = 0; ArrayNode referenceMap = mapper.createArrayNode();
        for (JsonNode refNode : codes) {
            TagRow source = findByRef(sourceDataNodeRef, brandRef, refNode.asText()); if (source == null) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED",422,"生产标签引用不存在");
            TagRow existing = find(targetDataNodeRef, brandRef, source.code());
            UUID targetRef = plannedTargetRef(request, source.ref(), existing == null ? null : existing.ref());
            copied += jdbc.update("INSERT INTO fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,tag_kind,name,status,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING", targetRef, targetDataNodeRef, brandRef, source.code(), source.tagKind(), source.name(), source.status(), 1L, time.currentEpochMillis(), time.currentEpochMillis());
            TagRow target = find(targetDataNodeRef, brandRef, source.code());
            if (target == null || !target.ref().equals(targetRef)) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED",422,"生产标签 targetRef 与目标事实不一致");
            referenceMap.add(referenceMapping(source, target));
        }
        verifyTargetNoOwnerReference(sourceDataNodeRef, targetDataNodeRef, brandRef, codes);
        ObjectNode result = mapper.createObjectNode().put("owner", "fulfillment-production").put("status", "COMMITTED").put("version", copied); result.set("referenceMap", referenceMap);
        result.put("receiptObjectFingerprint", preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization).path("digest").asText());
        if (!receiptKey.isBlank()) saveReceipt(targetDataNodeRef, receiptKey, "coordinatedCopy", request, result);
        return result;
        }
    }

    private JsonNode replayCopyIfCurrent(JsonNode replay, String currentFingerprint) {
        if (!currentFingerprint.equals(replay.path("receiptObjectFingerprint").asText())) {
            throw new ProductionTagOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, "生产标签复制对象事实已变化，请重新预检");
        }
        return replay;
    }

    @Override @Transactional(readOnly = true)
    public JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request,
                                  UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant) {
        return preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request,
            () -> requireOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeRef, ownerScopeGrant));
    }

    @Override @Transactional(readOnly = true)
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return preflightCopyCore(copySourceDataNodeRef(scope), scope.dataNodeId().toString(), scope.brandRef(), request, () -> { });
    }

    private JsonNode preflightCopyCore(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, Runnable authorization) {
        requireScope(sourceDataNodeRef, brandRef); requireScope(targetDataNodeRef, brandRef); authorization.run();
        JsonNode codes = request.path("productionTagRefs");
        if (!codes.isArray()) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签复制闭包缺少标签引用");
        ObjectNode snapshot = mapper.createObjectNode(); ArrayNode versions = snapshot.putArray("versions"); ArrayNode closureItems = snapshot.putArray("closureItems"); ArrayNode mappings = snapshot.putArray("mappingPreview"); ArrayNode referenceMappings = snapshot.putArray("referenceMappings"); ArrayNode results = snapshot.putArray("compatibilityResults");
        String firstBlocking = "";
        for (JsonNode refNode : codes) {
            String sourceRef = refNode.asText();
            TagRow source = findByRef(sourceDataNodeRef, brandRef, sourceRef);
            if (source == null) { firstBlocking = firstBlocking.isBlank() ? "REFERENCE_MAPPING_UNRESOLVED" : firstBlocking; results.addObject().put("objectType", "PRODUCTION_TAG").put("sourceRef", sourceRef).put("result", "BLOCKED").put("reason", "来源标签不存在").put("problemCode", "REFERENCE_MAPPING_UNRESOLVED"); continue; }
            TagRow target = find(targetDataNodeRef, brandRef, source.code());
            UUID targetRef = plannedTargetRef(request, source.ref(), target == null ? null : target.ref());
            String problem = ""; String result = target == null ? "CREATE" : "REUSE"; String reason = target == null ? "目标标签不存在，将创建" : "编码与名称一致，可复用";
            if (target != null && (!source.tagKind().equals(target.tagKind()) || !source.name().equals(target.name()))) { result = "BLOCKED"; reason = "同编码标签类型或语义不一致"; problem = "STRUCTURE_INCOMPATIBLE"; if (firstBlocking.isBlank()) firstBlocking = problem; }
            closureItems.addObject().put("objectType", "PRODUCTION_TAG").put("code", source.code()).put("name", source.name()).put("action", result);
            mappings.addObject().put("fromCode", source.code()).put("toCode", source.code()).put("referenceKind", "PRODUCTION_TAG").put("status", result);
            results.addObject().put("objectType", "PRODUCTION_TAG").put("sourceRef", sourceRef).put("code", source.code()).put("tagKind", source.tagKind()).put("result", result).put("reason", reason).put("problemCode", problem);
            versions.addObject().put("objectType", "PRODUCTION_TAG").put("sourceRef", sourceRef).put("code", source.code()).put("tagKind", source.tagKind()).put("sourceVersion", source.version()).put("targetVersion", target == null ? 0 : target.version());
            referenceMappings.add(referenceMapping(source, new TagRow(targetRef, source.code(), source.tagKind(), source.name(), source.status(), target == null ? 0 : target.version())));
        }
        snapshot.put("firstBlockingProblem", firstBlocking);
        ObjectNode result = mapper.createObjectNode().put("owner", "fulfillment-production").put("firstBlockingProblem", firstBlocking).put("digest", hash(snapshot)); result.set("closureItems", closureItems); result.set("mappingPreview", mappings); result.set("referenceMappings", referenceMappings); result.set("versions", versions); result.set("compatibilityResults", results); return result;
    }

    private ObjectNode create(String scope, String brand, String requestId, ObjectNode req) { String code = required(req, "code"), tagKind = requiredTagKind(req, "tagKind"), name = required(req, "name"); try { jdbc.update("INSERT INTO fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,tag_kind,name,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?)", UUID.randomUUID(), scope, brand, code, tagKind, name, time.currentEpochMillis(), time.currentEpochMillis()); } catch (DuplicateKeyException ex) { throw new ProductionTagOwnerApi.Problem("DUPLICATE_CODE", 409, "生产标签编码已存在"); } return command(requestId, tagResult(code, tagKind, name, "ENABLED", 1), 1); }

    /** Revalidates the live owner fact before a receipt can be returned. */
    private void recheckWriteFactsBeforeReceipt(String operationId, String scope, String brand, ObjectNode request) {
        if ("createOperationsProductionTag".equals(operationId)) {
            TagRow existing = find(scope, brand, required(request, "code"));
            if (existing != null && (existing.version() != 1L || !"ENABLED".equals(existing.status())
                || !existing.tagKind().equals(requiredTagKind(request, "tagKind")) || !existing.name().equals(required(request, "name")))) {
                throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签事实已变化");
            }
            return;
        }
        TagRow current = find(scope, brand, required(request, "tagCode"));
        if (current == null || "VOIDED".equals(current.status())) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在或已作废");
        long expected = requiredLong(request, "expectedVersion");
        if (current.version() != expected && current.version() != expected + 1L) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
    }

    private void recheckCopySourceFactsBeforeReceipt(String sourceScope, String brand, ObjectNode request) {
        JsonNode refs = request.path("productionTagRefs");
        if (!refs.isArray()) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签复制闭包缺少标签引用");
        for (JsonNode ref : refs) {
            TagRow source = findByRef(sourceScope, brand, ref.asText());
            if (source == null || "VOIDED".equals(source.status())) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签来源事实已变化");
        }
    }
    private ObjectNode update(String scope, String brand, String requestId, ObjectNode req) { String code = required(req, "tagCode"), tagKind = requiredTagKind(req, "tagKind"), name = required(req, "name"); long expected = requiredLong(req, "expectedVersion"); TagRow current = find(scope, brand, code); if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在"); if (!current.tagKind().equals(tagKind)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签类型创建后不可修改"); if (jdbc.update("UPDATE fulfillment_production.production_tag_definition SET name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'", name, time.currentEpochMillis(), scope, brand, code, expected) != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化"); return command(requestId, tagResult(code, tagKind, name, status(scope, brand, code), expected + 1), expected + 1); }
    private ObjectNode transition(String scope, String brand, String requestId, ObjectNode req) { String code = required(req, "tagCode"), target = required(req, "targetStatus"); long expected = requiredLong(req, "expectedVersion"); if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(target)) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法"); TagRow current = find(scope, brand, code); if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在"); if (jdbc.update("UPDATE fulfillment_production.production_tag_definition SET status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'", target, time.currentEpochMillis(), scope, brand, code, expected) != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化"); return command(requestId, tagResult(code, current.tagKind(), name(scope, brand, code), target, expected + 1), expected + 1); }

    private TagRow find(String scope, String brand, String code) { return jdbc.query("SELECT tag_ref,code,tag_kind,name,status,version FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=?", r -> { if (!r.next()) return null; return new TagRow(r.getObject(1, UUID.class), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getLong(6)); }, scope, brand, code); }
    private TagRow findByRef(String scope, String brand, String ref) { try { return jdbc.query("SELECT tag_ref,code,tag_kind,name,status,version FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND tag_ref=?", r -> { if (!r.next()) return null; return new TagRow(r.getObject(1, UUID.class), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getLong(6)); }, scope, brand, UUID.fromString(ref)); } catch (IllegalArgumentException failure) { throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED",422,"生产标签引用必须为UUID"); } }
    private UUID plannedTargetRef(ObjectNode request, UUID sourceRef, UUID existingTargetRef) {
        JsonNode mappings = request.path("referenceMappings");
        UUID planned = null;
        if (mappings.isArray()) for (JsonNode mapping : mappings) {
            if ("PRODUCTION_TAG".equals(mapping.path("objectType").asText()) && sourceRef.toString().equals(mapping.path("sourceRef").asText())) {
                try { planned = UUID.fromString(mapping.path("targetRef").asText()); }
                catch (IllegalArgumentException failure) { throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "production tag mapping targetRef 必须为UUID"); }
                break;
            }
        }
        if (existingTargetRef != null) {
            if (planned != null && !existingTargetRef.equals(planned)) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "production tag mapping 与已存在目标不一致");
            return existingTargetRef;
        }
        return planned == null ? UUID.randomUUID() : planned;
    }
    private ObjectNode referenceMapping(TagRow source, TagRow target) {
        return mapper.createObjectNode().put("objectType", "PRODUCTION_TAG").put("sourceRef", source.ref().toString()).put("targetRef", target.ref().toString()).put("targetCode", target.code()).putNull("targetSkuCode").putNull("targetOptionValueCode");
    }
    /** ProductionTagDefinition has no JSON/outbound owner refs; verify every copied row is target-scoped. */
    private void verifyTargetNoOwnerReference(String sourceScope, String targetScope, String brand, JsonNode refs) {
        if (sourceScope.equals(targetScope)) return;
        for (JsonNode ref : refs) {
            TagRow source = findByRef(sourceScope, brand, ref.asText());
            if (source == null) throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签引用不存在");
            jdbc.query("SELECT data_node_ref,brand_ref FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND code=?", result -> {
            if (result.next() && (!targetScope.equals(result.getString(1)) || !brand.equals(result.getString(2)))) throw new ProductionTagOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "生产标签复制结果未保持目标 owner scope");
            return null;
            }, targetScope, brand, source.code());
        }
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
    private static void requireOwnerScopeGrant(UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, String dataNodeRef, OperationsOwnerScopeGrant ownerScopeGrant) {
        String expectedCapability = catalogCapabilityForTarget(dataNodeType);
        if (workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank() || expectedCapability == null) throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production owner scope grant is required");
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null && ownerScopeGrant.matchesCapability(workspaceUuid, groupWorkspaceKey, dataNodeType, targetId, expectedCapability)) return;
        } catch (RuntimeException ignored) { }
        throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production owner scope grant is required");
    }
    private static CatalogAuthorizationScope requireTypedContext(
        WorkspaceExecutionContext<CatalogAuthorizationScope> context, String expectedOwner, String requiredRequirement
    ) {
        if (context == null || context.operationToken() == null || context.ownerScope() == null || context.ownerGrant() == null
            || context.workspaceUuid() == null || context.groupWorkspaceKey() == null || context.groupWorkspaceKey().isBlank()
            || !"operations-admin".equals(context.consumerFace())) {
            throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production execution context is required");
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner()) || (requiredRequirement != null && !requiredRequirement.equals(token.requirementId()))
            || scope.dataNodeId() == null || scope.brandRef() == null || scope.brandRef().isBlank()
            || !token.allowedDataNodeTypes().contains(scope.dataNodeType()) || capability == null
            || !context.ownerGrant().verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production execution context is not authorized");
        }
        return scope;
    }
    private static CatalogAuthorizationScope requireCopyContext(WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (!Set.of("preflightOperationsBrandCatalogCopy", "executeOperationsBrandCatalogCopy", "preflightOperationsLocalCatalogCopy", "executeOperationsLocalCatalogCopy").contains(context.operationToken().operationId())) {
            throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production copy context is not authorized");
        }
        return scope;
    }
    private static String copySourceDataNodeRef(CatalogAuthorizationScope scope) {
        return switch (scope.copySourcePolicy()) {
            case TARGET_SCOPE -> scope.dataNodeId().toString();
            case ORGANIZATION_JUDGMENT -> {
                if (scope.copySourceDataNodeId() == null) throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production copy source judgment is required");
                yield scope.copySourceDataNodeId().toString();
            }
            default -> throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production copy source policy is not authorized");
        };
    }
    private static String catalogCapabilityForTarget(String dataNodeType) {
        return switch (dataNodeType) {
            case "HEAD_COMPANY" -> "EDIT_HEAD_COMPANY_CATALOG";
            case "STORE" -> "EDIT_STORE_CATALOG";
            default -> null;
        };
    }
    private record Receipt(String operation, String hash, JsonNode response) { }
    private record TagRow(UUID ref, String code, String tagKind, String name, String status, long version) { }
}
