package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.Locale;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner implementation for the production-tag subset delivered in this phase. */
@Service
public class ProductionTagOwnerService implements ProductionTagOwnerApi {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final List<String> TAG_KINDS =
            List.of("PRODUCTION", "PACKAGE", "LABEL", "HANDOFF", "REVIEW", "OTHER");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    public ProductionTagOwnerService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode read(
            String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        if (!"getOperationsProductionTags".equals(operationId))
            throw new ProductionTagOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "production tag read operation is not registered");
        return readTags(dataNodeRef, brandRef, request, requestId);
    }

    @Override
    public JsonNode readTags(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        requireScope(dataNodeRef, brandRef);
        String usage = optional(request, "usage");
        usage = usage == null || usage.isBlank() ? "MANAGEMENT" : usage;
        if (!Set.of("MANAGEMENT", "BINDABLE_CANDIDATE").contains(usage))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "usage is invalid");
        String normalizedQuery = optional(request, "query");
        normalizedQuery = normalizedQuery == null ? "" : normalizedQuery.trim().toLowerCase(Locale.ROOT);
        final String selectedUsage = usage;
        final String selectedQuery = normalizedQuery;
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity = cursorIdentity(
                "production-tags", dataNodeRef, brandRef, selectedUsage, selectedQuery, Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor;
        try {
            cursor = OpaqueCollectionCursor.decode(optional(request, "cursor"), queryIdentity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        String cursorPredicate = cursor == null ? "" : " WHERE code > ? OR (code = ? AND tag_ref > ?)";
        String sql = "WITH matching AS (SELECT tag_ref,code,tag_kind,name,status,version,updated_at_epoch_millis FROM "
                + "fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? "
                + "AND (? = 'MANAGEMENT' OR status='ENABLED') "
                + "AND (? = '' OR (code || chr(1) || name) ILIKE '%' || ? || '%')), "
                + "aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS "
                + "(SELECT tag_ref,code,tag_kind,name,status,version,updated_at_epoch_millis "
                + "FROM matching"
                + cursorPredicate
                + " ORDER BY code NULLS LAST, tag_ref LIMIT ?) SELECT p.tag_ref,p.code,p.tag_kind,p.name,"
                + "p.status,p.version,p.updated_at_epoch_millis,a.total FROM aggregate a LEFT JOIN paged p ON "
                + "TRUE ORDER BY p.code NULLS LAST,p.tag_ref";
        List<ProductionTagPageRow> pageRows = jdbc.query(
                sql,
                s -> {
                    s.setString(1, dataNodeRef);
                    s.setString(2, brandRef);
                    s.setString(3, selectedUsage);
                    s.setString(4, selectedQuery);
                    s.setString(5, selectedQuery);
                    int index = 6;
                    if (cursor != null) {
                        s.setString(index++, cursor.sortKey());
                        s.setString(index++, cursor.sortKey());
                        s.setObject(index++, cursor.tieBreaker());
                    }
                    s.setInt(index, pageSize + 1);
                },
                (result, row) -> new ProductionTagPageRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getLong(6),
                        result.getLong(7),
                        result.getLong(8)));
        List<ProductionTagPageRow> presentRows =
                pageRows.stream().filter(row -> row.tagRef() != null).toList();
        boolean hasNext = presentRows.size() > pageSize;
        if (hasNext) presentRows = presentRows.subList(0, pageSize);
        for (ProductionTagPageRow pageRow : presentRows) {
            ObjectNode row = entries.addObject()
                    .put("tagRef", pageRow.tagRef().toString())
                    .put("code", pageRow.code())
                    .put("tagKind", pageRow.tagKind())
                    .put("name", pageRow.name())
                    .put("status", pageRow.status())
                    .put("ownerType", "DATA_NODE")
                    .put("ownerRef", dataNodeRef)
                    .put("brandRef", brandRef)
                    .put("linkedProductCount", 0)
                    .put("version", pageRow.version())
                    .put("updatedAt", pageRow.updatedAt());
            voidAvailability(row);
        }
        long total = pageRows.isEmpty() ? 0 : pageRows.get(0).total();
        data.put("total", total).put("generation", dataNodeRef + ":" + brandRef);
        if (hasNext) {
            ProductionTagPageRow last = presentRows.get(presentRows.size() - 1);
            data.put("cursor", OpaqueCollectionCursor.encode(queryIdentity, last.code(), last.tagRef()));
        } else data.putNull("cursor");
        return envelope(requestId, data);
    }

    private static int parsePageSize(ObjectNode request, String key, int fallback) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(value.asText());
            if (parsed < 1 || parsed > 100) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException failure) {
            throw new ProductionTagOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, key + " must be between 1 and 100", failure);
        }
    }

    private static String optional(ObjectNode request, String key) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return null;
        return value.asText();
    }

    private static String cursorIdentity(String operationId, String... parts) {
        StringBuilder identity = new StringBuilder(operationId);
        for (String part : parts) {
            String value = part == null ? "" : part;
            identity.append('|').append(value.length()).append(':').append(value);
        }
        return identity.toString();
    }

    @Override
    public List<ProductionTagOwnerApi.ProductionTagReferenceReadback> readTagReferencesByRefs(
            String dataNodeRef, String brandRef, List<UUID> tagRefs, String requestId) {
        requireScope(dataNodeRef, brandRef);
        List<UUID> requested = tagRefs == null
                ? List.of()
                : tagRefs.stream().filter(Objects::nonNull).distinct().toList();
        if (requested.isEmpty()) return List.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(requested.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(dataNodeRef);
        arguments.add(brandRef);
        arguments.addAll(requested);
        Map<UUID, ProductionTagOwnerApi.ProductionTagReferenceReadback> found = new HashMap<>();
        jdbc.query(
                        "SELECT tag_ref,code,name,status,version FROM fulfillment_production.production_tag_definition "
                                + "WHERE data_node_ref=? AND brand_ref=? AND tag_ref IN ("
                                + placeholders
                                + ") ORDER BY tag_ref",
                        (result, index) -> new ProductionTagOwnerApi.ProductionTagReferenceReadback(
                                result.getObject("tag_ref", UUID.class),
                                result.getString("code"),
                                result.getString("name"),
                                result.getString("status"),
                                result.getLong("version")),
                        arguments.toArray())
                .forEach(value -> found.put(value.tagRef(), value));
        return requested.stream().map(found::get).filter(Objects::nonNull).toList();
    }

    @Override
    @Transactional
    public JsonNode write(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return writeCore(
                operationId,
                dataNodeRef,
                brandRef,
                request,
                requestId,
                idempotencyKey,
                () -> requireOwnerScopeGrant(
                        workspaceUuid, groupWorkspaceKey, dataNodeType, dataNodeRef, ownerScopeGrant));
    }

    @Override
    @Transactional
    public JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "fulfillment-production", null);
        return writeCore(
                context.operationToken().operationId(),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> {});
    }

    @Override
    @Transactional
    public ProductionTagCommandReadback createTag(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CreateTagCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "fulfillment-production", null);
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());

        recheckCreateTagBeforeReceipt(dataNodeRef, scope.brandRef(), command);

        ProductionTagCommandReadback replay =
                replayTyped(dataNodeRef, key, "createOperationsProductionTag", receiptRequest);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            ProductionTagCommandReadback result = createTypedTag(dataNodeRef, scope.brandRef(), command);
            saveTypedReceipt(dataNodeRef, key, "createOperationsProductionTag", receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional
    public ProductionTagCommandReadback updateTag(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UpdateTagCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "fulfillment-production", null);
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        validateUpdateTagBeforeReceipt(command);

        recheckExistingTagBeforeReceipt(dataNodeRef, scope.brandRef(), command.tagCode(), command.expectedVersion());

        ProductionTagCommandReadback replay =
                replayTyped(dataNodeRef, key, "updateOperationsProductionTag", receiptRequest);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            ProductionTagCommandReadback result = updateTypedTag(dataNodeRef, scope.brandRef(), command);
            saveTypedReceipt(dataNodeRef, key, "updateOperationsProductionTag", receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional
    public ProductionTagCommandReadback transitionTagStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            TransitionTagStatusCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "fulfillment-production", null);
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        JsonNode receiptRequest = typedReceiptRequest(command, dataNodeRef, scope.brandRef());
        validateTransitionTagBeforeReceipt(command);

        recheckExistingTagBeforeReceipt(dataNodeRef, scope.brandRef(), command.tagCode(), command.expectedVersion());

        ProductionTagCommandReadback replay =
                replayTyped(dataNodeRef, key, "transitionOperationsProductionTagStatus", receiptRequest);
        if (replay != null) return replay;
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            ProductionTagCommandReadback result = transitionTypedTag(dataNodeRef, scope.brandRef(), command);
            saveTypedReceipt(dataNodeRef, key, "transitionOperationsProductionTagStatus", receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public UUID resolveProductionTagRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String tagCode) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "fulfillment-production", null);
        TagRow current = find(scope.dataNodeId().toString(), scope.brandRef(), requiredText(tagCode, "tagCode"));
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        return current.ref();
    }

    private void recheckCreateTagBeforeReceipt(String scope, String brand, CreateTagCommand command) {
        requiredText(command.code(), "code");
        requireTagKind(command.tagKind());
        requiredText(command.name(), "name");
        TagRow existing = find(scope, brand, command.code());
        if (existing != null
                && (existing.version() != 1L
                        || !"ENABLED".equals(existing.status())
                        || !existing.tagKind().equals(command.tagKind())
                        || !existing.name().equals(command.name()))) {
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签事实已变化");
        }
    }

    private void recheckExistingTagBeforeReceipt(String scope, String brand, String tagCode, long expectedVersion) {
        if (tagCode == null || tagCode.isBlank())
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "tagCode is required");
        TagRow current = find(scope, brand, tagCode);
        if (current == null || "VOIDED".equals(current.status()))
            throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在或已作废");
        if (current.version() != expectedVersion && current.version() != expectedVersion + 1L)
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
    }

    private void validateUpdateTagBeforeReceipt(UpdateTagCommand command) {
        requiredText(command.tagCode(), "tagCode");
        requireTagKind(command.tagKind());
        requiredText(command.name(), "name");
    }

    private void validateTransitionTagBeforeReceipt(TransitionTagStatusCommand command) {
        requiredText(command.tagCode(), "tagCode");
        String targetStatus = requiredText(command.targetStatus(), "targetStatus");
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(targetStatus))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法");
    }

    /** JSON is used only for canonical receipt persistence, not as the typed owner boundary. */
    private JsonNode typedReceiptRequest(Object command, String dataNodeRef, String brandRef) {
        ObjectNode request = mapper.valueToTree(command);
        request.put("dataNodeRef", dataNodeRef);
        request.put("receiptBrandRef", brandRef);
        return request;
    }

    private ProductionTagCommandReadback replayTyped(String scope, String key, String operation, JsonNode request) {
        JsonNode replay = replay(scope, key, operation, request);
        if (replay == null) return null;
        try {
            return mapper.treeToValue(replay, ProductionTagCommandReadback.class);
        } catch (Exception failure) {
            {
                throw new ProductionTagOwnerApi.Problem(
                        ("IDEMPOTENCY_MISMATCH"), (409), ("幂等回执与当前 owner readback 不兼容"), (failure));
            }
        }
    }

    private void saveTypedReceipt(
            String scope, String key, String operation, JsonNode request, ProductionTagCommandReadback readback) {
        saveReceipt(scope, key, operation, request, mapper.valueToTree(readback));
    }

    /** Direct named domain path for the M1 typed API; legacy writeCore remains isolated below. */
    private ProductionTagCommandReadback createTypedTag(String scope, String brand, CreateTagCommand command) {
        String code = requiredText(command.code(), "code");
        String tagKind = requireTagKind(command.tagKind());
        String name = requiredText(command.name(), "name");
        UUID tagRef = UUID.randomUUID();
        try {
            jdbc.update(
                    "INSERT INTO "
                            + "fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,ta"
                            + "g_ki"
                            + "nd,name,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?)",
                    tagRef,
                    scope,
                    brand,
                    code,
                    tagKind,
                    name,
                    time.currentEpochMillis(),
                    time.currentEpochMillis());
        } catch (DuplicateKeyException failure) {
            throw new ProductionTagOwnerApi.Problem("DUPLICATE_CODE", 409, "生产标签编码已存在", failure);
        }
        return new ProductionTagCommandReadback(tagRef, code, tagKind, name, "ENABLED", 1L);
    }

    private ProductionTagCommandReadback updateTypedTag(String scope, String brand, UpdateTagCommand command) {
        String code = requiredText(command.tagCode(), "tagCode");
        String tagKind = requireTagKind(command.tagKind());
        String name = requiredText(command.name(), "name");
        TagRow current = find(scope, brand, code);
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        if (!current.tagKind().equals(tagKind))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签类型创建后不可修改");
        if (jdbc.update(
                        "UPDATE fulfillment_production.production_tag_definition SET "
                                + "name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
                                + "brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",
                        name,
                        time.currentEpochMillis(),
                        scope,
                        brand,
                        code,
                        command.expectedVersion())
                != 1) {
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        }
        return new ProductionTagCommandReadback(
                current.ref(), code, tagKind, name, current.status(), command.expectedVersion() + 1);
    }

    private ProductionTagCommandReadback transitionTypedTag(
            String scope, String brand, TransitionTagStatusCommand command) {
        String code = requiredText(command.tagCode(), "tagCode");
        String targetStatus = requiredText(command.targetStatus(), "targetStatus");
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(targetStatus))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法");
        TagRow current = find(scope, brand, code);
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        if (jdbc.update(
                        "UPDATE fulfillment_production.production_tag_definition SET "
                                + "status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
                                + "brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",
                        targetStatus,
                        time.currentEpochMillis(),
                        scope,
                        brand,
                        code,
                        command.expectedVersion())
                != 1) {
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        }
        return new ProductionTagCommandReadback(
                current.ref(), code, current.tagKind(), current.name(), targetStatus, command.expectedVersion() + 1);
    }

    private static String requiredText(String value, String field) {
        if (value == null || value.isBlank())
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static String requireTagKind(String value) {
        String tagKind = requiredText(value, "tagKind");
        if (!TAG_KINDS.contains(tagKind))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "tagKind is not supported");
        return tagKind;
    }

    private JsonNode writeCore(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        requireScope(dataNodeRef, brandRef);
        authorization.run();
        String key = requireIdempotencyKey(idempotencyKey);

        recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);

        JsonNode receiptRequest = receiptRequest(request, brandRef);
        JsonNode replay = replay(dataNodeRef, key, operationId, receiptRequest);
        if (replay != null) return replay;
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result =
                    switch (operationId) {
                        case "createOperationsProductionTag" -> create(dataNodeRef, brandRef, requestId, request);
                        case "updateOperationsProductionTag" -> update(dataNodeRef, brandRef, requestId, request);
                        case "transitionOperationsProductionTagStatus" -> transition(
                                dataNodeRef, brandRef, requestId, request);
                        default -> throw new ProductionTagOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "production tag write operation is not registered");
                    };
            saveReceipt(dataNodeRef, key, operationId, receiptRequest, result);
            return result;
        }
    }

    @Override
    @Transactional
    public JsonNode copy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return copyCore(
                sourceDataNodeRef,
                targetDataNodeRef,
                brandRef,
                request,
                requestId,
                idempotencyKey,
                () -> requireOwnerScopeGrant(
                        workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeRef, ownerScopeGrant));
    }

    @Override
    @Transactional
    public JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return copyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> {});
    }

    /**
     * Typed composition boundary for brand-copy. Catalog supplies an opaque reference plan; this owner reconstructs
     * only its private request shape and keeps source/target authorization derived from the live context.
     */
    @Override
    @Transactional(readOnly = true)
    public ProductionTagOwnerApi.BrandCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ProductionTagOwnerApi.BrandCopyPreflightCommand command) {
        ObjectNode request = brandCopyRequest(
                context, command.selectedItemCodes(), command.targetDataNodeRef(), command.catalogReferencePlanJson());
        JsonNode result = preflightCopy(context, request);
        // Catalog consumes the opaque JSON via the same envelope-only contract
        // used for inventory and catalog owner preflight readbacks.
        ObjectNode envelope = envelope(context.requestId(), result);
        return new ProductionTagOwnerApi.BrandCopyPreflightReadback(
                envelope.path("data").path("digest").asText(), canonical(envelope));
    }

    @Override
    @Transactional
    public ProductionTagOwnerApi.BrandCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ProductionTagOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        ObjectNode request = brandCopyRequest(
                context, command.selectedItemCodes(), command.targetDataNodeRef(), command.catalogReferencePlanJson());
        request.put(
                "productionPreflightDigest",
                requiredText(command.productionPreflightDigest(), "productionPreflightDigest"));
        return copyExecutionReadback(copy(context, request, idempotencyKey));
    }

    private ProductionTagOwnerApi.BrandCopyExecutionReadback copyExecutionReadback(JsonNode result) {
        if (result == null
                || !result.isObject()
                || result.path("owner").asText().isBlank()
                || result.path("status").asText().isBlank()
                || !result.path("version").canConvertToLong()
                || !result.path("referenceMap").isArray()) {
            throw new ProductionTagOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "production copy readback is missing a required field");
        }
        java.util.ArrayList<ProductionTagOwnerApi.BrandCopyReferenceMapping> mappings = new java.util.ArrayList<>();
        for (JsonNode value : result.path("referenceMap")) {
            if (!value.isObject()
                    || value.path("objectType").asText().isBlank()
                    || value.path("sourceRef").asText().isBlank()
                    || value.path("targetRef").asText().isBlank()) {
                throw new ProductionTagOwnerApi.Problem(
                        "RESULT_UNKNOWN", 500, "production copy readback is missing: referenceMappings");
            }
            mappings.add(new ProductionTagOwnerApi.BrandCopyReferenceMapping(
                    value.path("objectType").asText(),
                    value.path("sourceRef").asText(),
                    value.path("targetRef").asText(),
                    nullableCopyText(value, "targetCode"),
                    nullableCopyText(value, "targetSkuCode"),
                    nullableCopyText(value, "targetOptionValueCode")));
        }
        return new ProductionTagOwnerApi.BrandCopyExecutionReadback(
                result.path("owner").asText(),
                result.path("status").asText(),
                result.path("version").asLong(),
                List.copyOf(mappings));
    }

    private String nullableCopyText(JsonNode value, String field) {
        return value.hasNonNull(field) ? value.path(field).asText() : null;
    }

    private ObjectNode brandCopyRequest(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            List<String> selectedItemCodes,
            String targetDataNodeRef,
            String catalogReferencePlanJson) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        String target = requiredText(targetDataNodeRef, "targetDataNodeRef");
        if (!target.equals(scope.dataNodeId().toString())) {
            throw new ProductionTagOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "brand copy target must match the authorized scope");
        }
        if (selectedItemCodes == null || selectedItemCodes.isEmpty()) {
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "selectedItemCodes is required");
        }
        ObjectNode request;
        try {
            JsonNode plan = mapper.readTree(requiredText(catalogReferencePlanJson, "catalogReferencePlanJson"));
            if (!plan.isObject()) throw new IllegalArgumentException("not an object");
            request = (ObjectNode) plan.deepCopy();
        } catch (Exception failure) {
            throw new ProductionTagOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog reference plan is invalid", failure);
        }
        request.put("targetDataNodeRef", target);
        request.set("selectedItemCodes", mapper.valueToTree(List.copyOf(selectedItemCodes)));
        return request;
    }

    private JsonNode copyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        JsonNode judgement;

        recheckCopySourceFactsBeforeReceipt(sourceDataNodeRef, brandRef, request);
        judgement = preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization);

        String currentFingerprint = judgement.path("digest").asText();
        String blocker = judgement.path("firstBlockingProblem").asText("");
        if (!blocker.isBlank()) {
            throw new ProductionTagOwnerApi.Problem((blocker), (422), ("生产标签复制存在不兼容事实"));
        }
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isBlank()) {
            JsonNode replay =
                    replay(targetDataNodeRef, receiptKey, "coordinatedCopy", receiptRequest(request, brandRef));
            if (replay != null) return replayCopyIfCurrent(replay, currentFingerprint);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            if (request.hasNonNull("productionPreflightDigest")) {
                if (!request.path("productionPreflightDigest").asText().equals(currentFingerprint)) {
                    throw new ProductionTagOwnerApi.Problem(
                            ("STALE_COPY_PREFLIGHT"),
                            (409),
                            /* format-wrap */
                            ("生产标签复制预检已失效，请重新预检"));
                }
            }
            JsonNode codes = request.path("productionTagRefs");
            if (!codes.isArray()) {
                ObjectNode result = mapper.createObjectNode()
                        .put("owner", "fulfillment-production")
                        .put("status", "COMMITTED")
                        .put("version", 0);
                result.put("receiptObjectFingerprint", currentFingerprint);
                if (!receiptKey.isBlank())
                    saveReceipt(
                            targetDataNodeRef,
                            receiptKey,
                            "coordinatedCopy",
                            receiptRequest(request, brandRef),
                            result);
                return result;
            }
            List<UUID> sourceRefs = new ArrayList<>();
            for (JsonNode refNode : codes)
                try {
                    sourceRefs.add(UUID.fromString(refNode.asText()));
                } catch (IllegalArgumentException failure) {
                    throw new ProductionTagOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签引用必须为UUID", failure);
                }
            List<TagRow> sources = tagsByRefs(sourceDataNodeRef, brandRef, sourceRefs, "tag_ref");
            if (sources.size() != sourceRefs.stream().distinct().count()) {
                throw new ProductionTagOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("生产标签引用不存在"));
            }
            List<String> sourceCodes = sources.stream().map(TagRow::code).toList();
            Map<String, TagRow> existingByCode = new LinkedHashMap<>();
            for (TagRow row : tagsByStrings(targetDataNodeRef, brandRef, sourceCodes))
                existingByCode.put(row.code(), row);
            List<PlannedTag> planned = new ArrayList<>();
            for (TagRow source : sources)
                planned.add(new PlannedTag(
                        source,
                        plannedTargetRef(
                                request,
                                source.ref(),
                                existingByCode.containsKey(source.code())
                                        ? existingByCode.get(source.code()).ref()
                                        : null)));
            int[] inserted = jdbc.batchUpdate(
                    "INSERT INTO "
                            + "fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,ta"
                            + "g_ki"
                            + "nd,name,status,version,created_at_epoch_millis,updated_at_epoch_millis) "
                            + "VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
                    new BatchPreparedStatementSetter() {
                        @Override
                        public void setValues(java.sql.PreparedStatement statement, int index)
                                throws java.sql.SQLException {
                            PlannedTag row = planned.get(index);
                            TagRow source = row.source();
                            statement.setObject(1, row.targetRef());
                            statement.setString(2, targetDataNodeRef);
                            statement.setString(3, brandRef);
                            statement.setString(4, source.code());
                            statement.setString(5, source.tagKind());
                            statement.setString(6, source.name());
                            statement.setString(7, source.status());
                            statement.setLong(8, 1L);
                            statement.setLong(9, time.currentEpochMillis());
                            statement.setLong(10, time.currentEpochMillis());
                        }

                        @Override
                        public int getBatchSize() {
                            return planned.size();
                        }
                    });
            int copied = java.util.Arrays.stream(inserted)
                    .map(value -> value > 0 ? value : 0)
                    .sum();
            Map<String, TagRow> targetByCode = new LinkedHashMap<>();
            for (TagRow row : tagsByStrings(targetDataNodeRef, brandRef, sourceCodes))
                targetByCode.put(row.code(), row);
            ArrayNode referenceMap = mapper.createArrayNode();
            for (PlannedTag row : planned) {
                TagRow target = targetByCode.get(row.source().code());
                if (target == null || !target.ref().equals(row.targetRef()))
                    throw new ProductionTagOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED", 422, "生产标签 targetRef 与目标事实不一致");
                referenceMap.add(referenceMapping(row.source(), target));
            }
            verifyTargetNoOwnerReference(sourceDataNodeRef, targetDataNodeRef, brandRef, sources, targetByCode);
            ObjectNode result = mapper.createObjectNode()
                    .put("owner", "fulfillment-production")
                    .put("status", copied == 0 ? "CONFLICT" : "COMMITTED")
                    .put("version", copied);
            result.set("referenceMap", referenceMap);
            result.put(
                    "receiptObjectFingerprint",
                    preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization)
                            .path("digest")
                            .asText());
            if (!receiptKey.isBlank())
                saveReceipt(
                        targetDataNodeRef, receiptKey, "coordinatedCopy", receiptRequest(request, brandRef), result);
            return result;
        }
    }

    private JsonNode replayCopyIfCurrent(JsonNode replay, String currentFingerprint) {
        if (!currentFingerprint.equals(replay.path("receiptObjectFingerprint").asText())) {
            {
                throw new ProductionTagOwnerApi.Problem(
                        ("STALE_COPY_PREFLIGHT"),
                        (409),
                        /* format-wrap */
                        ("生产标签复制对象事实已变化，请重新预检"));
            }
        }
        return replay;
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode preflightCopy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return preflightCopyCore(
                sourceDataNodeRef,
                targetDataNodeRef,
                brandRef,
                request,
                () -> requireOwnerScopeGrant(
                        workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeRef, ownerScopeGrant));
    }

    @Override
    @Transactional(readOnly = true)
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return preflightCopyCore(
                copySourceDataNodeRef(scope), scope.dataNodeId().toString(), scope.brandRef(), request, () -> {});
    }

    private JsonNode preflightCopyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            Runnable authorization) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        JsonNode codes = request.path("productionTagRefs");
        if (!codes.isArray()) {
            throw new ProductionTagOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("生产标签复制闭包缺少标签引用"));
        }
        List<UUID> requestedRefs = requestedProductionTagRefs(codes);
        Map<UUID, TagRow> sourceRowsByRef = tagsByRef(sourceDataNodeRef, brandRef, requestedRefs);
        List<String> sourceCodes = requestedRefs.stream()
                .map(sourceRowsByRef::get)
                .filter(source -> source != null && !"VOIDED".equals(source.status()))
                .map(TagRow::code)
                .distinct()
                .toList();
        Map<String, TagRow> targetRowsByCode = tagsByCode(targetDataNodeRef, brandRef, sourceCodes);
        ObjectNode snapshot = mapper.createObjectNode();
        ArrayNode versions = snapshot.putArray("versions");
        ArrayNode closureItems = snapshot.putArray("closureItems");
        ArrayNode mappings = snapshot.putArray("mappingPreview");
        ArrayNode referenceMappings = snapshot.putArray("referenceMappings");
        ArrayNode rewrites = snapshot.putArray("referenceRewritePreview");
        ArrayNode results = snapshot.putArray("compatibilityResults");
        String firstBlocking = "";
        for (JsonNode refNode : codes) {
            String sourceRef = refNode.asText();
            UUID sourceUuid = parseProductionTagRef(sourceRef);
            TagRow source = sourceRowsByRef.get(sourceUuid);
            if (source == null) {
                firstBlocking = firstBlocking.isBlank() ? "REFERENCE_MAPPING_UNRESOLVED" : firstBlocking;
                results.addObject()
                        .put("objectType", "PRODUCTION_TAG")
                        .put("compatibilityId", "PRODUCTION_TAG:" + sourceRef)
                        .put("sourceRef", sourceRef)
                        .put("result", "BLOCKED")
                        .put("reason", "来源标签不存在")
                        .put("reasonCode", "REFERENCE_MAPPING_UNRESOLVED")
                        .put("problemCode", "REFERENCE_MAPPING_UNRESOLVED")
                        .set(
                                "canonicalTuple",
                                canonicalTuple(targetDataNodeRef, brandRef, "PRODUCTION_TAG", List.of(sourceRef)));
                continue;
            }
            if ("VOIDED".equals(source.status())) {
                firstBlocking = firstBlocking.isBlank() ? "REFERENCE_MAPPING_UNRESOLVED" : firstBlocking;
                results.addObject()
                        .put("objectType", "PRODUCTION_TAG")
                        .put("compatibilityId", "PRODUCTION_TAG:" + sourceRef)
                        .put("sourceRef", sourceRef)
                        .put("code", source.code())
                        .put("tagKind", source.tagKind())
                        .put("result", "BLOCKED")
                        .put("reason", "来源标签已作废")
                        .put("reasonCode", "REFERENCE_MAPPING_UNRESOLVED")
                        .put("problemCode", "REFERENCE_MAPPING_UNRESOLVED")
                        .set(
                                "canonicalTuple",
                                canonicalTuple(targetDataNodeRef, brandRef, "PRODUCTION_TAG", List.of(sourceRef)));
                continue;
            }
            TagRow target = targetRowsByCode.get(source.code());
            UUID targetRef = plannedTargetRef(request, source.ref(), target == null ? null : target.ref());
            String problem = "";
            String result = target == null ? "CREATE" : "REUSE";
            String reason = target == null ? "目标标签不存在，将创建" : "编码与名称一致，可复用";
            String reasonCode = target == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED";
            if (target != null
                    && (!source.tagKind().equals(target.tagKind())
                            || !source.name().equals(target.name()))) {
                result = "BLOCKED";
                reason = "同编码标签类型或语义不一致";
                problem = "STRUCTURE_INCOMPATIBLE";
                reasonCode = "STRUCTURE_INCOMPATIBLE";
                if (firstBlocking.isBlank()) firstBlocking = problem;
            }
            closureItems
                    .addObject()
                    .put("objectType", "PRODUCTION_TAG")
                    .put("code", source.code())
                    .put("name", source.name())
                    .put("action", result);
            mappings.addObject()
                    .put("fromCode", source.code())
                    .put("toCode", source.code())
                    .put("referenceKind", "PRODUCTION_TAG")
                    .put("status", result)
                    .set(
                            "canonicalTuple",
                            canonicalTuple(targetDataNodeRef, brandRef, "PRODUCTION_TAG", List.of(source.code())));
            results.addObject()
                    .put("objectType", "PRODUCTION_TAG")
                    .put("compatibilityId", "PRODUCTION_TAG:" + sourceRef)
                    .put("sourceRef", sourceRef)
                    .put("code", source.code())
                    .put("tagKind", source.tagKind())
                    .put("result", result)
                    .put("reason", reason)
                    .put("reasonCode", reasonCode)
                    .put("problemCode", problem)
                    .set(
                            "canonicalTuple",
                            canonicalTuple(targetDataNodeRef, brandRef, "PRODUCTION_TAG", List.of(source.code())));
            versions.addObject()
                    .put("objectType", "PRODUCTION_TAG")
                    .put("sourceRef", sourceRef)
                    .put("code", source.code())
                    .put("tagKind", source.tagKind())
                    .put("sourceVersion", source.version())
                    .put("targetVersion", target == null ? 0 : target.version());
            referenceMappings.add(referenceMapping(
                    source,
                    new TagRow(
                            targetRef,
                            source.code(),
                            source.tagKind(),
                            source.name(),
                            source.status(),
                            target == null ? 0 : target.version())));
            rewrites.addObject()
                    .put("sourceRef", sourceRef)
                    .put("targetRef", targetRef.toString())
                    .put("referenceKind", "PRODUCTION_TAG");
        }
        snapshot.put("firstBlockingProblem", firstBlocking);
        ObjectNode result = mapper.createObjectNode()
                .put("owner", "fulfillment-production")
                .put("firstBlockingProblem", firstBlocking)
                .put("digest", hash(copyDigestSnapshot(snapshot)));
        result.set("closureItems", closureItems);
        result.set("mappingPreview", mappings);
        result.set("referenceMappings", referenceMappings);
        result.set("versions", versions);
        result.set("referenceRewritePreview", rewrites);
        result.set("compatibilityResults", results);
        return result;
    }

    private ObjectNode create(String scope, String brand, String requestId, ObjectNode req) {
        String code = required(req, "code"), tagKind = requiredTagKind(req, "tagKind"), name = required(req, "name");
        try {
            jdbc.update(
                    "INSERT INTO "
                            + "fulfillment_production.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,ta"
                            + "g_ki"
                            + "nd,name,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?)",
                    UUID.randomUUID(),
                    scope,
                    brand,
                    code,
                    tagKind,
                    name,
                    time.currentEpochMillis(),
                    time.currentEpochMillis());
        } catch (DuplicateKeyException ex) {
            throw new ProductionTagOwnerApi.Problem("DUPLICATE_CODE", 409, "生产标签编码已存在", ex);
        }
        return command(requestId, tagResult(code, tagKind, name, "ENABLED", 1), 1);
    }

    /** Revalidates the live owner fact before a receipt can be returned. */
    private void recheckWriteFactsBeforeReceipt(String operationId, String scope, String brand, ObjectNode request) {
        if ("createOperationsProductionTag".equals(operationId)) {
            TagRow existing = find(scope, brand, required(request, "code"));
            if (existing != null
                    && (existing.version() != 1L
                            || !"ENABLED".equals(existing.status())
                            || !existing.tagKind().equals(requiredTagKind(request, "tagKind"))
                            || !existing.name().equals(required(request, "name")))) {
                throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签事实已变化");
            }
            return;
        }
        TagRow current = find(scope, brand, required(request, "tagCode"));
        if (current == null || "VOIDED".equals(current.status()))
            throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在或已作废");
        long expected = requiredLong(request, "expectedVersion");
        if (current.version() != expected && current.version() != expected + 1L)
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
    }

    private void recheckCopySourceFactsBeforeReceipt(String sourceScope, String brand, ObjectNode request) {
        JsonNode refs = request.path("productionTagRefs");
        if (!refs.isArray()) {
            throw new ProductionTagOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("生产标签复制闭包缺少标签引用"));
        }
        List<UUID> requestedRefs = requestedProductionTagRefs(refs);
        Map<UUID, TagRow> sourceRowsByRef = tagsByRef(sourceScope, brand, requestedRefs);
        for (UUID ref : requestedRefs) {
            TagRow source = sourceRowsByRef.get(ref);
            if (source == null || "VOIDED".equals(source.status())) {
                throw new ProductionTagOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("生产标签来源事实已变化"));
            }
        }
    }

    private ObjectNode update(String scope, String brand, String requestId, ObjectNode req) {
        String code = required(req, "tagCode"), tagKind = requiredTagKind(req, "tagKind"), name = required(req, "name");
        long expected = requiredLong(req, "expectedVersion");
        TagRow current = find(scope, brand, code);
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        if (!current.tagKind().equals(tagKind))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签类型创建后不可修改");
        if (jdbc.update(
                        "UPDATE fulfillment_production.production_tag_definition SET "
                                + "name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
                                + "brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",
                        name,
                        time.currentEpochMillis(),
                        scope,
                        brand,
                        code,
                        expected)
                != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        return command(
                requestId, tagResult(code, tagKind, name, status(scope, brand, code), expected + 1), expected + 1);
    }

    private ObjectNode transition(String scope, String brand, String requestId, ObjectNode req) {
        String code = required(req, "tagCode"), target = required(req, "targetStatus");
        long expected = requiredLong(req, "expectedVersion");
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(target))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法");
        TagRow current = find(scope, brand, code);
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        if (jdbc.update(
                        "UPDATE fulfillment_production.production_tag_definition SET "
                                + "status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
                                + "brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'",
                        target,
                        time.currentEpochMillis(),
                        scope,
                        brand,
                        code,
                        expected)
                != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        return command(
                requestId,
                tagResult(code, current.tagKind(), name(scope, brand, code), target, expected + 1),
                expected + 1);
    }

    private TagRow find(String scope, String brand, String code) {
        return jdbc.query(
                "SELECT tag_ref,code,tag_kind,name,status,version FROM "
                        + "fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND "
                        + "code=?",
                r -> {
                    if (!r.next()) return null;
                    return new TagRow(
                            r.getObject(1, UUID.class),
                            r.getString(2),
                            r.getString(3),
                            r.getString(4),
                            r.getString(5),
                            r.getLong(6));
                },
                scope,
                brand,
                code);
    }

    private TagRow findByRef(String scope, String brand, String ref) {
        try {
            return jdbc.query(
                    "SELECT tag_ref,code,tag_kind,name,status,version FROM "
                            + "fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? "
                            + "AND "
                            + "tag_ref=?",
                    r -> {
                        if (!r.next()) return null;
                        return new TagRow(
                                r.getObject(1, UUID.class),
                                r.getString(2),
                                r.getString(3),
                                r.getString(4),
                                r.getString(5),
                                r.getLong(6));
                    },
                    scope,
                    brand,
                    UUID.fromString(ref));
        } catch (IllegalArgumentException failure) {
            {
                throw new ProductionTagOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("生产标签引用必须为UUID"), (failure));
            }
        }
    }

    private List<TagRow> tagsByRefs(String scope, String brand, List<UUID> values, String column) {
        if (values.isEmpty()) return List.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(values.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(values);
        return jdbc.query(
                "SELECT tag_ref,code,tag_kind,name,status,version FROM "
                        + "fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND "
                        + column + " IN (" + placeholders + ")",
                (row, number) -> new TagRow(
                        row.getObject(1, UUID.class),
                        row.getString(2),
                        row.getString(3),
                        row.getString(4),
                        row.getString(5),
                        row.getLong(6)),
                args.toArray());
    }

    private List<TagRow> tagsByStrings(String scope, String brand, List<String> values) {
        if (values.isEmpty()) return List.of();
        String placeholders = String.join(",", java.util.Collections.nCopies(values.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(values);
        return jdbc.query(
                "SELECT tag_ref,code,tag_kind,name,status,version FROM "
                        + "fulfillment_production.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND "
                        + "code "
                        + "IN ("
                        + placeholders + ")",
                (row, number) -> new TagRow(
                        row.getObject(1, UUID.class),
                        row.getString(2),
                        row.getString(3),
                        row.getString(4),
                        row.getString(5),
                        row.getLong(6)),
                args.toArray());
    }

    private List<UUID> requestedProductionTagRefs(JsonNode values) {
        List<UUID> refs = new ArrayList<>();
        for (JsonNode value : values) refs.add(parseProductionTagRef(value.asText()));
        if (new java.util.LinkedHashSet<>(refs).size() != refs.size()) {
            String failureMessage = "生产标签引用不唯一";
            throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage);
        }
        return refs;
    }

    private UUID parseProductionTagRef(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new ProductionTagOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("生产标签引用必须为UUID"), (failure));
        }
    }

    private Map<UUID, TagRow> tagsByRef(String scope, String brand, List<UUID> refs) {
        Map<UUID, TagRow> result = new LinkedHashMap<>();
        for (TagRow row : tagsByRefs(scope, brand, refs, "tag_ref")) {
            if (result.putIfAbsent(row.ref(), row) != null) {
                String failureMessage = "生产标签引用不唯一";
                throw new ProductionTagOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage);
            }
        }
        return result;
    }

    private Map<String, TagRow> tagsByCode(String scope, String brand, List<String> codes) {
        Map<String, TagRow> result = new LinkedHashMap<>();
        for (TagRow row : tagsByStrings(scope, brand, codes))
            if (result.putIfAbsent(row.code(), row) != null)
                throw new ProductionTagOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "目标生产标签编码引用不唯一: " + row.code());
        return result;
    }

    private UUID plannedTargetRef(ObjectNode request, UUID sourceRef, UUID existingTargetRef) {
        JsonNode mappings = request.path("referenceMappings");
        UUID planned = null;
        if (mappings.isArray())
            for (JsonNode mapping : mappings) {
                if ("PRODUCTION_TAG".equals(mapping.path("objectType").asText())
                        && sourceRef.toString().equals(mapping.path("sourceRef").asText())) {
                    try {
                        planned = UUID.fromString(mapping.path("targetRef").asText());
                    } catch (IllegalArgumentException failure) {
                        throw new ProductionTagOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                "production tag mapping targetRef 必须为UUID",
                                failure);
                    }
                    break;
                }
            }
        if (existingTargetRef != null) {
            if (planned != null && !existingTargetRef.equals(planned))
                throw new ProductionTagOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "production tag mapping 与已存在目标不一致");
            return existingTargetRef;
        }
        return planned == null ? UUID.randomUUID() : planned;
    }

    private ObjectNode referenceMapping(TagRow source, TagRow target) {
        return mapper.createObjectNode()
                .put("objectType", "PRODUCTION_TAG")
                .put("sourceRef", source.ref().toString())
                .put("targetRef", target.ref().toString())
                .put("targetCode", target.code())
                .putNull("targetSkuCode")
                .putNull("targetOptionValueCode");
    }

    private ObjectNode canonicalTuple(String ownerRef, String brandRef, String objectType, List<String> parts) {
        ObjectNode tuple = mapper.createObjectNode()
                .put("ownerRef", ownerRef)
                .put("brandRef", brandRef)
                .put("objectType", objectType);
        ArrayNode values = tuple.putArray("parts");
        parts.forEach(values::add);
        return tuple;
    }
    /** ProductionTagDefinition has no JSON/outbound owner refs; verify every copied row is target-scoped. */
    private void verifyTargetNoOwnerReference(
            String sourceScope, String targetScope, String brand, List<TagRow> sources, Map<String, TagRow> targets) {
        if (sourceScope.equals(targetScope)) return;
        for (TagRow source : sources)
            if (!targets.containsKey(source.code())) {
                throw new ProductionTagOwnerApi.Problem(
                        ("OWNER_REFERENCE_LEAK"),
                        (422),
                        /* format-wrap */
                        ("生产标签复制结果未保持目标 owner scope"));
            }
    }

    private ObjectNode tagResult(String code, String tagKind, String name, String status, long version) {
        ObjectNode result = mapper.createObjectNode()
                .put("code", code)
                .put("tagKind", tagKind)
                .put("name", name);
        result.putObject("ownerScope").put("factType", "PRODUCTION_TAG").put("revision", REVISION);
        result.put("status", status).put("version", version);
        return result;
    }

    private void voidAvailability(ObjectNode row) {
        ObjectNode value = row.putObject("voidAvailability");
        value.put("canVoid", !"VOIDED".equals(row.path("status").asText()));
        value.putArray("blockingReferences");
        value.putArray("dependentFacts");
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private ObjectNode command(String requestId, JsonNode result, long version) {
        ObjectNode node = mapper.createObjectNode().put("revision", REVISION).put("requestId", requestId);
        node.set("result", result);
        node.put("version", version);
        return node;
    }

    private String name(String scope, String brand, String code) {
        return jdbc.query(
                "SELECT name FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                s -> {
                    s.setString(1, scope);
                    s.setString(2, brand);
                    s.setString(3, code);
                },
                r -> {
                    if (!r.next()) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
                    return r.getString(1);
                });
    }

    private String status(String scope, String brand, String code) {
        return jdbc.query(
                "SELECT status FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                s -> {
                    s.setString(1, scope);
                    s.setString(2, brand);
                    s.setString(3, code);
                },
                r -> {
                    if (!r.next()) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
                    return r.getString(1);
                });
    }

    private JsonNode receiptRequest(JsonNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String scope, String key, String operation, JsonNode request) {
        AdvisoryLock.acquire(jdbc, "production-receipt", scope, key);
        var rows = jdbc.query(
                "SELECT operation_id,request_hash,response::text FROM fulfillment_production.command_receipt WHERE "
                        + "data_node_ref=? AND idempotency_key=?",
                (r, n) -> new Receipt(r.getString(1), r.getString(2), json(r.getString(3))),
                scope,
                key);
        if (rows.isEmpty()) return null;
        Receipt row = rows.get(0);
        if (!row.operation().equals(operation) || !row.hash().equals(hash(request)))
            throw new ProductionTagOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return row.response();
    }

    private void saveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        jdbc.update(
                "INSERT INTO "
                        + "fulfillment_production.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_i"
                        + "d,re"
                        + "quest_hash,response,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                scope,
                key,
                operation,
                hash(request),
                canonical(response),
                time.currentEpochMillis());
    }

    private String hash(JsonNode value) {
        try {
            return Sha256Hex.digest(canonical(value));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Planned opaque target refs are execution artifacts; semantic copy facts remain in the digest. */
    private ObjectNode copyDigestSnapshot(ObjectNode snapshot) {
        ObjectNode stable = snapshot.deepCopy();
        for (String field : List.of("referenceMappings", "referenceRewritePreview")) {
            JsonNode rows = stable.path(field);
            if (!rows.isArray()) continue;
            for (JsonNode row : rows) if (row instanceof ObjectNode object) object.putNull("targetRef");
        }
        return stable;
    }

    private String canonical(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", ex);
        }
    }

    private JsonNode json(String value) {
        try {
            return mapper.readTree(value);
        } catch (Exception ex) {
            return mapper.createObjectNode();
        }
    }

    private static String required(ObjectNode req, String key) {
        String value = req == null || req.get(key) == null ? null : req.get(key).asText();
        if (value == null || value.isBlank())
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

    static String requiredTagKind(ObjectNode req, String key) {
        String value = required(req, key);
        if (!TAG_KINDS.contains(value))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "tagKind is not supported");
        return value;
    }

    private static long requiredLong(ObjectNode req, String key) {
        JsonNode value = req == null ? null : req.get(key);
        if (value == null || !value.isIntegralNumber())
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value.asLong();
    }

    static String requireIdempotencyKey(String value) {
        if (value == null || value.isBlank())
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        return value.trim();
    }

    private static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    private static void requireOwnerScopeGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            String dataNodeRef,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        String expectedCapability = CatalogTargetCapability.forDataNodeType(dataNodeType);
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || expectedCapability == null)
            throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production owner scope grant is required");
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null
                    && ownerScopeGrant.matchesCapability(
                            workspaceUuid, groupWorkspaceKey, dataNodeType, targetId, expectedCapability)) return;
        } catch (RuntimeException ignored) {
        }
        throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production owner scope grant is required");
    }

    private static CatalogAuthorizationScope requireTypedContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String expectedOwner,
            String requiredRequirement) {
        if (context == null
                || context.operationToken() == null
                || context.ownerScope() == null
                || context.ownerGrant() == null
                || context.workspaceUuid() == null
                || context.groupWorkspaceKey() == null
                || context.groupWorkspaceKey().isBlank()
                || !"operations-admin".equals(context.consumerFace())) {
            throw new ProductionTagOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "production execution context is required");
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner())
                || (requiredRequirement != null && !requiredRequirement.equals(token.requirementId()))
                || scope.dataNodeId() == null
                || scope.brandRef() == null
                || scope.brandRef().isBlank()
                || !token.allowedDataNodeTypes().contains(scope.dataNodeType())
                || capability == null
                || !context.ownerGrant()
                        .verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new ProductionTagOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "production execution context is not authorized");
        }
        return scope;
    }

    private static CatalogAuthorizationScope requireCopyContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (!Set.of(
                        "preflightOperationsBrandCatalogCopy",
                        "executeOperationsBrandCatalogCopy",
                        "preflightOperationsLocalCatalogCopy",
                        "executeOperationsLocalCatalogCopy")
                .contains(context.operationToken().operationId())) {
            throw new ProductionTagOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "production copy context is not authorized");
        }
        return scope;
    }

    private static String copySourceDataNodeRef(CatalogAuthorizationScope scope) {
        return switch (scope.copySourcePolicy()) {
            case TARGET_SCOPE -> scope.dataNodeId().toString();
            case ORGANIZATION_JUDGMENT -> {
                if (scope.copySourceDataNodeId() == null)
                    throw new ProductionTagOwnerApi.Problem(
                            "SCOPE_FORBIDDEN", 403, "production copy source judgment is required");
                yield scope.copySourceDataNodeId().toString();
            }
            default -> throw new ProductionTagOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "production copy source policy is not authorized");
        };
    }

    private record Receipt(String operation, String hash, JsonNode response) {}

    private record PlannedTag(TagRow source, UUID targetRef) {}

    private record TagRow(UUID ref, String code, String tagKind, String name, String status, long version) {}

    private record ProductionTagPageRow(
            UUID tagRef,
            String code,
            String tagKind,
            String name,
            String status,
            long version,
            long updatedAt,
            long total) {}
}
