package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence.CopyTagRow;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence.PageRow;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence.ReceiptRow;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence.TagRow;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence.TypedMutationRow;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner implementation for the production-tag subset delivered in this phase. */
@Service
public class ProductionTagOwnerService implements ProductionTagOwnerApi {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final ProductionTagOwnerPersistence persistence;
    private final ObjectMapper mapper;

    public ProductionTagOwnerService(ProductionTagOwnerPersistence persistence, ObjectMapper mapper) {
        this.persistence = persistence;
        this.mapper = mapper;
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
        String status = optional(request, "status");
        if (status != null && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "production tag status is invalid");
        final String selectedUsage = usage;
        final String selectedQuery = normalizedQuery;
        final String selectedStatus = status;
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity = cursorIdentity(
                "production-tags",
                dataNodeRef,
                brandRef,
                selectedUsage,
                selectedQuery,
                selectedStatus,
                Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor;
        try {
            cursor = OpaqueCollectionCursor.decode(optional(request, "cursor"), queryIdentity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
        ObjectNode data = mapper.createObjectNode();
        ArrayNode entries = data.putArray("entries");
        List<PageRow> pageRows = persistence.readTagsPage(
                dataNodeRef, brandRef, selectedUsage, selectedQuery, selectedStatus, cursor, pageSize);
        List<PageRow> presentRows =
                pageRows.stream().filter(row -> row.tagRef() != null).toList();
        boolean hasNext = presentRows.size() > pageSize;
        if (hasNext) presentRows = presentRows.subList(0, pageSize);
        for (PageRow pageRow : presentRows) {
            ObjectNode row = entries.addObject()
                    .put("tagRef", pageRow.tagRef().toString())
                    .put("code", pageRow.code())
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
            PageRow last = presentRows.get(presentRows.size() - 1);
            data.put("cursor", OpaqueCollectionCursor.encode(queryIdentity, last.code(), last.tagRef()));
        } else data.putNull("cursor");
        return envelope(requestId, data);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductionTagOwnerApi.ProductionTagNavigationReadback> readNavigationTags(
            String dataNodeRef, String brandRef, String requestId) {
        requireScope(dataNodeRef, brandRef);
        return persistence.readNavigationTags(dataNodeRef, brandRef);
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
        Map<UUID, ProductionTagOwnerApi.ProductionTagReferenceReadback> found = new HashMap<>();
        persistence.readTagReferencesByRefs(dataNodeRef, brandRef, requested)
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
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            return createTypedTag(dataNodeRef, scope.brandRef(), command, key, receiptRequest);
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
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            return updateTypedTag(dataNodeRef, scope.brandRef(), command, key, receiptRequest);
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
        try (var ownerCommand = OwnerOperationDiagnostics.beginCommand()) {
            return transitionTypedTag(dataNodeRef, scope.brandRef(), command, key, receiptRequest);
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

    private void validateUpdateTagBeforeReceipt(UpdateTagCommand command) {
        requiredText(command.tagCode(), "tagCode");
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

    /**
     * Direct named domain path for the M1 typed API. A receipt claim, its matching response, and the newly-created tag
     * are one SQL statement so the command transaction projects its own readback without a replay/read/write round-trip
     * chain. The legacy JSON writeCore deliberately remains isolated below.
     */
    private ProductionTagCommandReadback createTypedTag(
            String scope, String brand, CreateTagCommand command, String key, JsonNode request) {
        String code = requiredText(command.code(), "code");
        String name = requiredText(command.name(), "name");
        UUID tagRef = UUID.randomUUID();
        String operation = "createOperationsProductionTag";
        String requestHash = hash(request);
        try {
            TypedMutationRow row = persistence.createTypedTag(
                    scope, brand, tagRef, code, name, key, operation, requestHash);
            return typedReceiptReadback(row, operation, requestHash);
        } catch (DuplicateKeyException failure) {
            throw new ProductionTagOwnerApi.Problem("DUPLICATE_CODE", 409, "生产标签编码已存在", failure);
        }
    }

    private ProductionTagCommandReadback updateTypedTag(
            String scope, String brand, UpdateTagCommand command, String key, JsonNode request) {
        String code = requiredText(command.tagCode(), "tagCode");
        String name = requiredText(command.name(), "name");
        return mutateTypedExistingTag(
                scope,
                brand,
                code,
                command.expectedVersion(),
                key,
                "updateOperationsProductionTag",
                request,
                "name",
                name);
    }

    private ProductionTagCommandReadback transitionTypedTag(
            String scope, String brand, TransitionTagStatusCommand command, String key, JsonNode request) {
        String code = requiredText(command.tagCode(), "tagCode");
        String targetStatus = requiredText(command.targetStatus(), "targetStatus");
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(targetStatus))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法");
        return mutateTypedExistingTag(
                scope,
                brand,
                code,
                command.expectedVersion(),
                key,
                "transitionOperationsProductionTagStatus",
                request,
                "status",
                targetStatus);
    }

    /** Locks the existing fact and idempotency key before deciding replay, CAS, and persisted readback. */
    private ProductionTagCommandReadback mutateTypedExistingTag(
            String scope,
            String brand,
            String code,
            long expectedVersion,
            String key,
        String operation,
        JsonNode request,
        String changedColumn,
        String changedValue) {
        String requestHash = hash(request);
        TypedMutationRow row = switch (changedColumn) {
            case "name" -> persistence.updateTypedTagName(
                    scope, brand, code, expectedVersion, key, operation, requestHash, changedValue);
            case "status" -> persistence.updateTypedTagStatus(
                    scope, brand, code, expectedVersion, key, operation, requestHash, changedValue);
            default -> throw new IllegalArgumentException("unsupported production tag mutation");
        };
        if (row.currentTagRef() == null || "VOIDED".equals(row.currentStatus()))
            throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在或已作废");
        if (row.currentVersion() != expectedVersion && row.currentVersion() != expectedVersion + 1L)
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        if (row.writtenResponse() == null && row.replayResponse() == null)
            throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        return typedReceiptReadback(row, operation, requestHash);
    }

    private ProductionTagCommandReadback typedReceiptReadback(
            TypedMutationRow row, String operation, String requestHash) {
        if (row.replayResponse() != null
                && (!operation.equals(row.receiptOperation()) || !requestHash.equals(row.receiptHash()))) {
            throw new ProductionTagOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        }
        String response = row.replayResponse() == null ? row.writtenResponse() : row.replayResponse();
        if (response == null) throw new IllegalStateException("production tag receipt response is missing");
        try {
            return mapper.readValue(response, ProductionTagCommandReadback.class);
        } catch (Exception failure) {
            String message = "幂等回执与当前 owner readback 不兼容";
            throw new ProductionTagOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, message, failure);
        }
    }

    private static String requiredText(String value, String field) {
        if (value == null || value.isBlank())
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
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
            JsonNode codes = request.path("productionTagDefinitionRefs");
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
            List<TagRow> sources = tagsByRefs(sourceDataNodeRef, brandRef, sourceRefs);
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
            List<CopyTagRow> copyRows = planned.stream()
                    .map(row -> new CopyTagRow(
                            row.targetRef(), row.source().code(), row.source().name(), row.source().status()))
                    .toList();
            int[] inserted = persistence.copyTags(targetDataNodeRef, brandRef, copyRows);
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
        JsonNode codes = request.path("productionTagDefinitionRefs");
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
            if (target != null && !source.name().equals(target.name())) {
                result = "BLOCKED";
                reason = "同编码标签名称不一致";
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
                    .put("sourceVersion", source.version())
                    .put("targetVersion", target == null ? 0 : target.version());
            referenceMappings.add(referenceMapping(
                    source,
                    new TagRow(
                            targetRef,
                            source.code(),
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
        String code = required(req, "code"), name = required(req, "name");
        try {
            persistence.createTag(scope, brand, UUID.randomUUID(), code, name);
        } catch (DuplicateKeyException ex) {
            throw new ProductionTagOwnerApi.Problem("DUPLICATE_CODE", 409, "生产标签编码已存在", ex);
        }
        return command(requestId, tagResult(code, name, "ENABLED", 1), 1);
    }

    /** Revalidates the live owner fact before a receipt can be returned. */
    private void recheckWriteFactsBeforeReceipt(String operationId, String scope, String brand, ObjectNode request) {
        if ("createOperationsProductionTag".equals(operationId)) {
            required(request, "code");
            required(request, "name");
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
        JsonNode refs = request.path("productionTagDefinitionRefs");
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
        String code = required(req, "tagCode"), name = required(req, "name");
        long expected = requiredLong(req, "expectedVersion");
        TagRow current = find(scope, brand, code);
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        if (persistence.updateTagName(scope, brand, code, name, expected)
                != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        return command(requestId, tagResult(code, name, status(scope, brand, code), expected + 1), expected + 1);
    }

    private ObjectNode transition(String scope, String brand, String requestId, ObjectNode req) {
        String code = required(req, "tagCode"), target = required(req, "targetStatus");
        long expected = requiredLong(req, "expectedVersion");
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(target))
            throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, "生产标签状态不合法");
        TagRow current = find(scope, brand, code);
        if (current == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        if (persistence.updateTagStatus(scope, brand, code, target, expected)
                != 1) throw new ProductionTagOwnerApi.Problem("VERSION_CONFLICT", 409, "生产标签版本已变化");
        return command(requestId, tagResult(code, name(scope, brand, code), target, expected + 1), expected + 1);
    }

    private TagRow find(String scope, String brand, String code) {
        return persistence.findByCode(scope, brand, code);
    }

    private TagRow findByRef(String scope, String brand, String ref) {
        try {
            return persistence.findByRef(scope, brand, UUID.fromString(ref));
        } catch (IllegalArgumentException failure) {
            {
                throw new ProductionTagOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("生产标签引用必须为UUID"), (failure));
            }
        }
    }

    private List<TagRow> tagsByRefs(String scope, String brand, List<UUID> values) {
        if (values.isEmpty()) return List.of();
        return persistence.findByRefs(scope, brand, values);
    }

    private List<TagRow> tagsByStrings(String scope, String brand, List<String> values) {
        if (values.isEmpty()) return List.of();
        return persistence.findByCodes(scope, brand, values);
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
        for (TagRow row : tagsByRefs(scope, brand, refs)) {
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

    private ObjectNode tagResult(String code, String name, String status, long version) {
        ObjectNode result = mapper.createObjectNode().put("code", code).put("name", name);
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
        String name = persistence.readName(scope, brand, code);
        if (name == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        return name;
    }

    private String status(String scope, String brand, String code) {
        String status = persistence.readStatus(scope, brand, code);
        if (status == null) throw new ProductionTagOwnerApi.Problem("NOT_FOUND", 404, "生产标签不存在");
        return status;
    }

    private JsonNode receiptRequest(JsonNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String scope, String key, String operation, JsonNode request) {
        ReceiptRow row = persistence.findReceiptReplay(scope, key);
        if (row == null) return null;
        if (!row.operation().equals(operation) || !row.hash().equals(hash(request)))
            throw new ProductionTagOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return json(row.response());
    }

    private void saveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        persistence.saveReceipt(scope, key, operation, hash(request), canonical(response));
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

    private record PlannedTag(TagRow source, UUID targetRef) {}
}
