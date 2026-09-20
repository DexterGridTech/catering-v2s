package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.application.persistence.CatalogCopyServiceSql;
import com.catering.v2s.catalog.application.persistence.CatalogCopyPersistence;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.collection.CanonicalCursorIdentity;
import com.catering.v2s.platform.foundation.collection.CollectionRequestSupport;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;


/** Concrete Catalog copy owner for candidates, preflight, preparation, execution, receipts, and readback. */
@Service
public class CatalogCopyService {
    private static final String TEMPORARY_PROMOTION_PROJECTION_FIELD = "_temporaryPromotionProjection";
    private static final String BATCH_STATUS_OPERATION_ID = "batchTransitionOperationsCatalogItemStatus";
    /** Must stay equal to CatalogItemPageQuery.pageSize.maximum and the batch request maxItems. */
    private static final int CATALOG_ITEM_BATCH_LIMIT = 100;
    /** A catalog tree is intentionally shallow so operators can scan and choose it as a hierarchy. */
    private static final int CATALOG_CATEGORY_MAX_DEPTH = 3;

    private static final String SALES_MENU_CANDIDATE_OPERATION = "getOperationsSalesMenuItemCandidates";
    private static final int SALES_MENU_CANDIDATE_PAGE_SIZE = 20;

    private static final String CATEGORY_MOVE_SELF_MESSAGE = "分类不能以自身作为父分类";
    private static final String CATEGORY_MOVE_CYCLE_MESSAGE = "分类不能移动到自身或下级分类下";
    private static final String CATEGORY_DEPTH_ERROR_CODE = "CATEGORY_DEPTH_EXCEEDED";
    private static final String CATEGORY_DEPTH_EXCEEDED_MESSAGE = "商品分类最多只能建立三级";
    private static final String CATEGORY_MOVE_BOUNDARY_MESSAGE = "分类已位于当前层级边界";
    private static final String CATEGORY_MOVE_ACTION_MESSAGE = "分类移动方式不支持";
    /**
     * Only these owner problems describe an individual item's authoritative business outcome. A RESULT_UNKNOWN (or any
     * other internal/unknown problem) must escape the item transaction and fail the request; it is not a legitimate
     * batch receipt row.
     */
    private static final Set<String> BATCH_ITEM_PROBLEM_CODES = Set.of(
            "DEPENDENT_FACTS_BLOCK_VOID",
            "NOT_FOUND",
            "REFERENCE_BLOCKS_VOID",
            "REFERENCE_MAPPING_UNRESOLVED",
            "SCOPE_FORBIDDEN",
            "VALIDATION_ERROR",
            "VERSION_CONFLICT",
            "VOIDED_RECORD_IMMUTABLE");

    private final JdbcTemplate jdbc;
    private final CatalogCopyPersistence persistence;
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;
    private final CatalogAssetReferenceLock assetReferenceLocks;
    private final ProductionTagOwnerApi productionTags;
    private final InventoryOwnerApi inventory;
    private final CatalogSkuFacts skuFacts;
    private final CatalogIdentifierFacts identifierFacts;
    private final CatalogPreparationFacts preparationFacts;
    private final CatalogItemCategoryFacts categoryFacts;
    private final CatalogCompositeFacts compositeFacts;
    /**
     * Isolated legacy relation owner retained only by temporary-promotion paths pending their separate contract
     * cutover.
     */
    private final CatalogItemDefinitionFacts itemDefinitionFacts;

    private final CatalogDefinitionFacts definitionFacts;
    private final CatalogUnitDefinitionFacts unitDefinitionFacts;
    private final CatalogSkuVariantAxisFacts skuVariantAxisFacts;
    private final CatalogItemMediaFacts itemMediaFacts;
    private final CatalogSkuMediaFacts skuMediaFacts;
    private final CatalogItemReferenceFacts itemReferenceFacts;
    private final PlatformTransactionManager transactions;
    @Autowired
    public CatalogCopyService(
            CatalogCopyPersistence persistence,
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            ProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.persistence = persistence;
        this.mapper = mapper;
        this.copyLimits = CopyLimitPolicy.load(mapper);
        this.time = time;
        this.assetReferenceLocks = assetReferenceLocks;
        this.productionTags = productionTags;
        this.inventory = inventory;
        this.transactions = transactions;
        this.skuFacts = new CatalogSkuFacts(jdbc, mapper, time);
        this.identifierFacts = new CatalogIdentifierFacts(jdbc, mapper);
        this.preparationFacts = new CatalogPreparationFacts(jdbc, mapper);
        this.categoryFacts = new CatalogItemCategoryFacts(jdbc, mapper);
        this.compositeFacts = new CatalogCompositeFacts(jdbc, mapper);
        this.itemDefinitionFacts = new CatalogItemDefinitionFacts(jdbc, mapper);
        this.definitionFacts = new CatalogDefinitionFacts(jdbc);
        this.unitDefinitionFacts = new CatalogUnitDefinitionFacts(jdbc);
        this.skuVariantAxisFacts = new CatalogSkuVariantAxisFacts(jdbc, mapper);
        this.itemMediaFacts = new CatalogItemMediaFacts(jdbc, mapper);
        this.skuMediaFacts = new CatalogSkuMediaFacts(jdbc, mapper);
        this.itemReferenceFacts = new CatalogItemReferenceFacts(jdbc, mapper);
    }

    public CatalogCopyService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogAssetReferenceLock assetReferenceLocks,
            ProductionTagOwnerApi productionTags,
            InventoryOwnerApi inventory,
            PlatformTransactionManager transactions) {
        this(
                new CatalogCopyPersistence(jdbc, time),
                jdbc,
                mapper,
                time,
                assetReferenceLocks,
                productionTags,
                inventory,
                transactions);
    }

static List<String> validatedLocalCopySections(ArrayNode selectedSections) {
        return CatalogOwnerValueSupport.validatedLocalCopySections(selectedSections);
    }

static Set<String> catalogAssetRefs(JsonNode sections) {
        return CatalogOwnerValueSupport.catalogAssetRefs(sections);
    }

public JsonNode readLocalCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        return copyCandidates("getOperationsLocalCatalogCopyCandidates", dataNodeRef, brandRef, requestId, request);
    }

public JsonNode readBrandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        return copyCandidates("getOperationsBrandCatalogCopyCandidates", dataNodeRef, brandRef, requestId, request);
    }

public JsonNode readShapeManifest(String requestId) {
        return shapeManifest(requestId);
    }

@Transactional
    public JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        if (scope.copySourcePolicy() == WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE) {
            return copyLocal(
                    context,
                    context.operationToken().operationId(),
                    scope.dataNodeId().toString(),
                    scope.brandRef(),
                    request,
                    context.requestId(),
                    idempotencyKey);
        }
        return executeCopy(
                context.operationToken().operationId(),
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                null,
                null);
    }

@Transactional(readOnly = true)
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        String sourceDataNodeRef = copySourceDataNodeRef(scope);
        String targetDataNodeRef = scope.dataNodeId().toString();
        if (scope.copySourcePolicy() == WorkspaceCommandOperationToken.CopySourcePolicy.TARGET_SCOPE) {
            return localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request);
        }
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), request);
        return copyPreflight(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), plan);
    }

@Transactional(readOnly = true)
    public CatalogOwnerApi.CopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        ObjectNode result = localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request);
        ObjectNode envelope = envelope(context.requestId(), result);
        return new CatalogOwnerApi.CopyPreflightReadback(
                envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope));
    }

@Transactional(readOnly = true)
    public CatalogOwnerApi.LocalCopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        LocalCopyPlan plan = localCopyPlan(scope.dataNodeId().toString(), scope.brandRef(), request);
        ObjectNode envelope = envelope(
                context.requestId(),
                localCopyPreflight(scope.dataNodeId().toString(), scope.brandRef(), request, plan));
        return new PreparedLocalCopy(
                plan,
                new CatalogOwnerApi.CopyPreflightReadback(
                        envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope)));
    }

@Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        return copyExecutionReadback(copyLocal(
                context,
                "executeOperationsLocalCatalogCopy",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                null));
    }

public CatalogOwnerApi.CopyExecutionReadback executeLocalCopy(

            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey,
            CatalogOwnerApi.LocalCopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedLocalCopy prepared))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog local copy preparation is invalid");
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = localCopyRequest(command);
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        return copyExecutionReadback(copyLocal(
                null,
                "executeOperationsLocalCatalogCopy",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                prepared.plan()));
    }

@Transactional(readOnly = true)
    public CatalogOwnerApi.CopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", command.targetDataNodeRef());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        JsonNode result = preflightCopy(context, request);
        ObjectNode envelope = envelope(context.requestId(), result);
        return new CatalogOwnerApi.CopyPreflightReadback(
                envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope));
    }

@Transactional(readOnly = true)
    public CatalogOwnerApi.BrandCopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = brandCopyRequest(command.selectedItemCodes(), command.targetDataNodeRef());
        String sourceDataNodeRef = copySourceDataNodeRef(scope);
        String targetDataNodeRef = scope.dataNodeId().toString();
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), request);
        CopyCompatibility compatibility = validateCopyCompatibility(
                sourceDataNodeRef,
                targetDataNodeRef,
                scope.brandRef(),
                plan.graph(),
                plan.targetCopyFacts(),
                request,
                false);
        ObjectNode envelope = envelope(
                context.requestId(),
                copyPreflight(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), plan, compatibility));
        return new PreparedBrandCopy(
                plan,
                compatibility,
                new CatalogOwnerApi.CopyPreflightReadback(
                        envelope.path("data").path("preflightDigest").asText(), canonicalLocalCopyJson(envelope)));
    }

@Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = mapper.createObjectNode()
                .put("targetDataNodeRef", command.targetDataNodeRef())
                .put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        String sourceDataNodeRef = copySourceDataNodeRef(scope);
        String targetDataNodeRef = scope.dataNodeId().toString();
        CatalogCopyPlan plan = catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, scope.brandRef(), request);
        CopyCompatibility compatibility = validateCopyCompatibility(
                sourceDataNodeRef,
                targetDataNodeRef,
                scope.brandRef(),
                plan.graph(),
                plan.targetCopyFacts(),
                request,
                true);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                compatibility.compatibilityResults(), command.compatibilityDispositions());
        return copyExecutionReadback(executeCopy(
                "executeOperationsBrandCatalogCopy",
                sourceDataNodeRef,
                targetDataNodeRef,
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                plan,
                compatibility));
    }

@Transactional
    public CatalogOwnerApi.CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey,
            CatalogOwnerApi.BrandCopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedBrandCopy prepared))
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog brand copy preparation is invalid");
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog");
        ObjectNode request = brandCopyRequest(command.selectedItemCodes(), command.targetDataNodeRef());
        request.put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        applyLocalCopyReferencePlan(request, command.referencePlanJson());
        CopyCompatibility compatibility = mergePreparedReferenceMappings(prepared.compatibility(), request);
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                compatibility.compatibilityResults(), command.compatibilityDispositions());
        return copyExecutionReadback(executeCopy(
                "executeOperationsBrandCatalogCopy",
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                prepared.plan(),
                compatibility));
    }

static boolean expandsCatalogItemClosure(String referenceKind) {
        return Set.of("CATALOG_ITEM", "COMPOSITE_COMPONENT", "BOM_COMPONENT").contains(referenceKind);
    }

static String copyReferenceObjectType(String referenceKind) {
        return CatalogOwnerValueSupport.copyReferenceObjectType(referenceKind);
    }

static String skuStructureFingerprint(JsonNode sections) {
        return CatalogOwnerValueSupport.skuStructureFingerprint(sections);
    }

private static String firstText(JsonNode node, String... keys) {
        if (node == null || node.isNull()) return null;
        for (String key : keys)
            if (node.path(key).isValueNode() && !node.path(key).asText().isBlank())
                return node.path(key).asText();
        return null;
    }

private static String nullableText(JsonNode object, String field) {
        return object.path(field).isNull() || object.path(field).isMissingNode()
                ? null
                : object.path(field).asText();
    }

private static UUID nullableUuid(JsonNode object, String field) {
        String value = nullableText(object, field);
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

private void putNullableUnitSnapshot(ObjectNode target, String field, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) target.putNull(field);
        else target.set(field, mapper.valueToTree(snapshot));
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(
            java.sql.ResultSet rows, int refIndex, int codeIndex, int nameIndex, int dimensionIndex, int precisionIndex)
            throws java.sql.SQLException {
        UUID ref = rows.getObject(refIndex, UUID.class);
        if (ref == null) return null;
        return new InventoryOwnerApi.UnitSnapshot(
                ref,
                rows.getString(codeIndex),
                rows.getString(nameIndex),
                rows.getString(dimensionIndex),
                rows.getInt(precisionIndex));
    }

private static InventoryOwnerApi.UnitSnapshot unitSnapshot(CatalogCopyPersistence.UnitSnapshotRow row) {
        return row == null
                ? null
                : new InventoryOwnerApi.UnitSnapshot(
                        row.ref(), row.code(), row.name(), row.unitDimension(), row.precision());
    }

private void applyLocalCopyReferencePlan(ObjectNode request, String canonicalPlan) {
        if (canonicalPlan == null || canonicalPlan.isBlank()) return;
        try {
            JsonNode plan = mapper.readTree(canonicalPlan);
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field : List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "copy reference plan is invalid", failure);
        }
    }

private ObjectNode localCopyRequest(CatalogOwnerApi.LocalCopyExecuteCommand command) {
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("preflightDigest", command.catalogPreflightDigest())
                .put("expectedSourceVersion", command.expectedSourceVersion())
                .put("expectedTargetVersion", command.expectedTargetVersion());
        request.set(
                "selectedSections",
                mapper.valueToTree(command.selectedSections() == null ? List.of() : command.selectedSections()));
        request.set(
                "compatibilityDispositions",
                mapper.valueToTree(
                        command.compatibilityDispositions() == null ? List.of() : command.compatibilityDispositions()));
        return request;
    }

private ObjectNode brandCopyRequest(List<String> selectedItemCodes, String targetDataNodeRef) {
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", targetDataNodeRef);
        request.set("selectedItemCodes", mapper.valueToTree(selectedItemCodes));
        return request;
    }

private CopyCompatibility mergePreparedReferenceMappings(CopyCompatibility prepared, ObjectNode request) {
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>(prepared.mapping());
        suppliedReferenceMappings(request).forEach((key, target) -> {
            String previous = mapping.putIfAbsent(key, target);
            if (previous != null && !previous.equals(target)) {
                String problemMessage = "多个 owner 对同一 sourceRef 给出了冲突 targetRef";
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, problemMessage);
            }
        });
        return new CopyCompatibility(
                Map.copyOf(mapping),
                prepared.compatibilityResults().deepCopy(),
                prepared.targetRows(),
                prepared.targetUnits());
    }

private String canonicalLocalCopyJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException("catalog owner could not encode copy readback", failure);
        }
    }

/** Converts the owner result before it leaves this owner boundary. */
    private CatalogOwnerApi.CopyExecutionReadback copyExecutionReadback(JsonNode result) {
        JsonNode data = requiredCopyData(result, "catalog");
        return new CatalogOwnerApi.CopyExecutionReadback(
                requiredCopyText(data, "preflightDigest", "catalog"),
                copyObjects(data, "created"),
                copyObjects(data, "reused"),
                copySkipped(data),
                copyReferenceMappings(data, "referenceMappings"),
                copyTargetVersions(data),
                copyOwnerReadbacks(data));
    }

private JsonNode requiredCopyData(JsonNode result, String owner) {
        JsonNode data = result == null ? null : result.path("data");
        if (data == null || !data.isObject()) throw copyReadbackProblem(owner, "data");
        return data;
    }

private String requiredCopyText(JsonNode data, String field, String owner) {
        JsonNode value = data.path(field);
        if (!value.isTextual() || value.asText().isBlank()) throw copyReadbackProblem(owner, field);
        return value.asText();


    }

private List<CatalogOwnerApi.CopyObjectReadback> copyObjects(JsonNode data, String field) {
        JsonNode values = data.path(field);
        if (!values.isArray()) throw copyReadbackProblem("catalog", field);
        List<CatalogOwnerApi.CopyObjectReadback> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("objectType").asText().isBlank()
                    || value.path("code").asText().isBlank()) throw copyReadbackProblem("catalog", field);
            result.add(new CatalogOwnerApi.CopyObjectReadback(
                    value.path("objectType").asText(), value.path("code").asText()));
        }
        return List.copyOf(result);
    }

private List<CatalogOwnerApi.CopySkippedReadback> copySkipped(JsonNode data) {
        JsonNode values = data.path("skipped");
        if (!values.isArray()) throw copyReadbackProblem("catalog", "skipped");
        List<CatalogOwnerApi.CopySkippedReadback> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("section").asText().isBlank()
                    || value.path("reasonCode").asText().isBlank()) {
                throw copyReadbackProblem("catalog", "skipped");
            }
            result.add(new CatalogOwnerApi.CopySkippedReadback(
                    value.path("section").asText(), value.path("reasonCode").asText()));
        }
        return List.copyOf(result);
    }

private List<CatalogOwnerApi.CopyReferenceMapping> copyReferenceMappings(JsonNode data, String field) {
        JsonNode values = data.path(field);
        if (!values.isArray()) throw copyReadbackProblem("catalog", field);
        List<CatalogOwnerApi.CopyReferenceMapping> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("objectType").asText().isBlank()
                    || value.path("sourceRef").asText().isBlank()
                    || value.path("targetRef").asText().isBlank()) throw copyReadbackProblem("catalog", field);
            result.add(new CatalogOwnerApi.CopyReferenceMapping(
                    value.path("objectType").asText(),
                    value.path("sourceRef").asText(),
                    value.path("targetRef").asText(),
                    nullableCopyText(value, "targetCode"),
                    nullableCopyText(value, "targetSkuCode"),
                    nullableCopyText(value, "targetOptionValueCode")));
        }
        return List.copyOf(result);
    }

private List<CatalogOwnerApi.CopyTargetVersion> copyTargetVersions(JsonNode data) {
        JsonNode values = data.path("targetVersions");
        if (!values.isArray()) throw copyReadbackProblem("catalog", "targetVersions");
        List<CatalogOwnerApi.CopyTargetVersion> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("targetRef").asText().isBlank()
                    || !value.path("version").canConvertToLong())
                throw copyReadbackProblem("catalog", "targetVersions");
            result.add(new CatalogOwnerApi.CopyTargetVersion(
                    value.path("targetRef").asText(), value.path("version").asLong()));
        }
        return List.copyOf(result);
    }

private List<CatalogOwnerApi.CopyOwnerReadback> copyOwnerReadbacks(JsonNode data) {
        JsonNode values = data.path("ownerReadbacks");
        if (!values.isArray()) throw copyReadbackProblem("catalog", "ownerReadbacks");
        List<CatalogOwnerApi.CopyOwnerReadback> result = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isObject()
                    || value.path("owner").asText().isBlank()
                    || value.path("status").asText().isBlank()
                    || !value.path("version").canConvertToLong())
                throw copyReadbackProblem("catalog", "ownerReadbacks");
            result.add(new CatalogOwnerApi.CopyOwnerReadback(
                    value.path("owner").asText(),
                    value.path("status").asText(),
                    value.path("version").asLong()));
        }
        return List.copyOf(result);
    }

private String nullableCopyText(JsonNode value, String field) {
        return value.hasNonNull(field) ? value.path(field).asText() : null;
    }

private CatalogOwnerApi.Problem copyReadbackProblem(String owner, String field) {
        return new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, owner + " copy readback is missing: " + field);
    }

private JsonNode executeCopy(
            String operationId,
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            CatalogCopyPlan preparedPlan,
            CopyCompatibility preparedCompatibility) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        if (operationId.contains("Local"))
            return copyLocal(null, operationId, sourceDataNodeRef, brandRef, request, requestId, idempotencyKey);
        CatalogCopyPlan plan = preparedPlan == null
                ? catalogCopyPlan(sourceDataNodeRef, targetDataNodeRef, brandRef, request)
                : preparedPlan;
        List<String> selected = plan.selected();
        CatalogClosure graph = plan.graph();
        List<ItemRow> source = graph.items();
        long sourceVersion = plan.sourceVersion();
        long targetVersion = plan.targetVersion();
        String currentDigest = plan.digest();
        CopyCompatibility compatibility = preparedCompatibility == null
                ? validateCopyCompatibility(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, graph, plan.targetCopyFacts(), request, true)
                : preparedCompatibility;
        rejectPreparedBlockingCompatibility(compatibility.compatibilityResults());
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                compatibility.compatibilityResults(), request.path("compatibilityDispositions"));
        assertNoOwnerReferenceLeak(graph, compatibility.mapping(), sourceDataNodeRef);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay =
                    replay(targetDataNodeRef, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef));
            if (replay != null) return replayCopyIfCurrent(replay, currentDigest);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            long expectedSource = requiredLong(request, "expectedSourceVersion", -1);
            long expectedTarget = requiredLong(request, "expectedTargetVersion", -1);
            String submittedDigest = required(request, "preflightDigest");
            if (expectedSource != sourceVersion
                    || expectedTarget != targetVersion
                    || !submittedDigest.equals(currentDigest)) {
                {
                    throw new CatalogOwnerApi.Problem(
                            ("STALE_COPY_PREFLIGHT"),
                            (409),
                            /* format-wrap */
                            ("复制预检已失效，请重新预检"));
                }
            }
            lockCatalogAssetRefs(
                    source.stream().map(row -> json(row.sectionsJson())).toArray(JsonNode[]::new));
            ArrayNode created = mapper.createArrayNode();
            ArrayNode reused = mapper.createArrayNode();
            List<CopyCategory> categories = new ArrayList<>();
            for (CategoryRow row : graph.categories()) {
                UUID targetRef = UUID.fromString(compatibility
                        .mapping()
                        .get(new ReferenceKey("CATALOG_CATEGORY", row.ref().toString())));
                UUID targetParentRef = row.parentCategoryRef() == null
                        ? null
                        : UUID.fromString(compatibility
                                .mapping()
                                .get(new ReferenceKey(
                                        "CATALOG_CATEGORY",
                                        row.parentCategoryRef().toString())));
                categories.add(new CopyCategory(targetRef, targetDataNodeRef, brandRef, row, targetParentRef));
            }
            // Copy may reuse a target category by code.  That target can sit at
            // a different depth than the source category, so the ordinary
            // create/move guards are not reached by INSERT ... ON CONFLICT.
            // Lock and validate the effective target tree before any category
            // write; a copy never silently flattens or reparents a hierarchy.
            lockCategoryHierarchy(targetDataNodeRef, brandRef);
            assertCopiedCategoryDepth(targetDataNodeRef, brandRef, categories);
            List<CatalogCopyPersistence.CategoryCopyRow> categoryRows = categories.stream()
                    .map(value -> new CatalogCopyPersistence.CategoryCopyRow(
                            value.targetRef(),
                            value.dataNodeRef(),
                            value.brandRef(),
                            value.source().code(),
                            value.source().name(),
                            value.source().parentCode(),
                            value.targetParentRef(),
                            value.source().status(),
                            value.source().displayOrder(),
                            1L))
                    .toList();
            int[] categoryChanges = persistence.insertCategories(categoryRows);
            for (int index = 0; index < categories.size(); index++)
                (categoryChanges[index] == 1 ? created : reused)
                        .addObject()
                        .put("objectType", "CATALOG_CATEGORY")
                        .put("code", categories.get(index).source().code());
            List<CopyDictionary> dictionaries = new ArrayList<>();
            for (DictionaryRow row : graph.dictionaries()) {
                UUID targetRef = UUID.fromString(compatibility
                        .mapping()
                        .get(new ReferenceKey(row.objectType(), row.ref().toString())));
                UUID targetParentRef = row.parentEntryRef() == null
                        ? null
                        : UUID.fromString(requiredMappedReference(
                                compatibility.mapping(),
                                new ReferenceKey(
                                        "SKU_ATTRIBUTE", row.parentEntryRef().toString())));
                dictionaries.add(new CopyDictionary(targetRef, targetDataNodeRef, brandRef, row, targetParentRef));
            }
            List<CatalogCopyPersistence.DictionaryCopyRow> dictionaryRows = dictionaries.stream()
                    .map(value -> new CatalogCopyPersistence.DictionaryCopyRow(
                            value.targetRef(),
                            value.dataNodeRef(),
                            value.brandRef(),
                            value.source().dictionaryKind(),
                            value.source().code(),
                            value.source().name(),
                            value.source().status(),
                            value.targetParentRef(),
                            value.source().displayOrder(),
                            1L))
                    .toList();
            int[] dictionaryChanges = persistence.insertDictionaries(dictionaryRows);
            for (int index = 0; index < dictionaries.size(); index++)
                (dictionaryChanges[index] == 1 ? created : reused)
                        .addObject()
                        .put("objectType", dictionaries.get(index).source().objectType())
                        .put("code", dictionaries.get(index).source().code());
            List<UnitCopy> units = graph.units().stream()
                    .map(row -> new UnitCopy(
                            UUID.fromString(requiredMappedReference(
                                    compatibility.mapping(),
                                    new ReferenceKey("CATALOG_UNIT", row.ref().toString()))),
                            targetDataNodeRef,
                            brandRef,
                            row))
                    .toList();
            int[] unitChanges = copyUnitDefinitions(units);
            for (int index = 0; index < units.size(); index++)
                (unitChanges[index] == 1 ? created : reused)
                        .addObject()
                        .put("objectType", "CATALOG_UNIT")
                        .put("code", units.get(index).source().code());
            List<PreparedCopyItem> items = new ArrayList<>();
            for (ItemRow row : source) {
                ObjectNode rewrittenSections =
                        (ObjectNode) rewriteReferences(json(row.sectionsJson()), compatibility.mapping());
                ArrayNode copiedSkus = normalizeSkuFacts(rewrittenSections);
                ArrayNode copiedCategoryRefs = categoryRefs(rewrittenSections);
                ArrayNode copiedCompositeGroups = compositeGroups(rewrittenSections);
                ArrayNode copiedSkuVariantDimensions =
                        submittedSkuVariantDimensions(rewrittenSections.path("skuVariantDimensions"));
                JsonNode copiedImages = rewrittenSections.path("images");
                JsonNode copiedProductionTagRef = rewrittenSections.path("productionTagRef");
                JsonNode copiedTagRefs = rewrittenSections.path("tagRefs");
                removeRelationalSectionFacts(rewrittenSections);
                UUID targetRef = UUID.fromString(compatibility
                        .mapping()
                        .get(new ReferenceKey("CATALOG_ITEM", row.ref().toString())));
                removeShortName(rewrittenSections);
                items.add(new PreparedCopyItem(
                        targetRef,
                        targetDataNodeRef,
                        brandRef,
                        sourceDataNodeRef,
                        row,
                        rewrittenSections,
                        copiedSkus,
                        copiedCategoryRefs,
                        copiedCompositeGroups,
                        copiedSkuVariantDimensions,
                        copiedImages,
                        new CatalogItemReferenceFacts.CopyValues(copiedProductionTagRef, copiedTagRefs)));
            }
            List<CatalogCopyPersistence.ItemCopyRow> itemRows = items.stream()
                    .map(value -> new CatalogCopyPersistence.ItemCopyRow(
                            value.targetRef(),
                            value.dataNodeRef(),
                            value.brandRef(),
                            value.source().code(),
                            value.source().name(),
                            value.source().shortName(),
                            value.source().shapeKey(),
                            value.source().status(),
                            canonicalJson(value.sections()),
                            value.source().code(),
                            value.sourceScopeRef()))
                    .toList();
            int[] itemChanges = persistence.insertItems(itemRows);
            Map<UUID, ArrayNode> copiedSkusByItem = new LinkedHashMap<>();
            Map<UUID, ArrayNode> copiedCategoriesByItem = new LinkedHashMap<>();
            Map<UUID, ArrayNode> copiedCompositeGroupsByItem = new LinkedHashMap<>();
            Map<UUID, ArrayNode> copiedSkuVariantDimensionsByItem = new LinkedHashMap<>();
            Map<UUID, JsonNode> copiedImagesByItem = new LinkedHashMap<>();
            Map<UUID, CatalogItemReferenceFacts.CopyValues> copiedReferencesByItem = new LinkedHashMap<>();
            Map<UUID, UUID> copiedDefinitionItemsBySource = new LinkedHashMap<>();
            for (int index = 0; index < items.size(); index++) {
                PreparedCopyItem item = items.get(index);
                boolean changed = itemChanges[index] == 1;
                (changed ? created : reused)
                        .addObject()
                        .put("objectType", "CATALOG_ITEM")
                        .put("code", item.source().code());
                if (!changed) continue;
                copiedDefinitionItemsBySource.put(item.source().ref(), item.targetRef());
                copiedSkusByItem.put(item.targetRef(), item.skus());
                copiedCategoriesByItem.put(item.targetRef(), item.categoryRefs());
                copiedCompositeGroupsByItem.put(item.targetRef(), item.compositeGroups());
                copiedSkuVariantDimensionsByItem.put(item.targetRef(), item.skuVariantDimensions());
                copiedImagesByItem.put(item.targetRef(), item.images());
                copiedReferencesByItem.put(item.targetRef(), item.references());
            }
            skuFacts.insertForCopy(copiedSkusByItem);
            List<CopiedUnitInput> copiedUnitInputs = new ArrayList<>();
            for (int index = 0; index < items.size(); index++)
                if (itemChanges[index] == 1) {
                    PreparedCopyItem item = items.get(index);
                    copiedUnitInputs.add(new CopiedUnitInput(item.targetRef(), item.sections(), item.skus()));
                }
            writeCopiedEffectiveUnitFactsBatch(targetDataNodeRef, brandRef, copiedUnitInputs);
            skuMediaFacts.insertForCopy(copiedSkusByItem);
            categoryFacts.insertForCopy(copiedCategoriesByItem);
            itemMediaFacts.insertForCopy(copiedImagesByItem);
            itemReferenceFacts.insertForCopy(copiedReferencesByItem);
            compositeFacts.insertForCopy(copiedCompositeGroupsByItem);
            skuVariantAxisFacts.insertForCopy(copiedSkuVariantDimensionsByItem);
            itemDefinitionFacts.copyAttributeAssignments(
                    sourceDataNodeRef, brandRef, targetDataNodeRef, brandRef, copiedDefinitionItemsBySource, now());
            CatalogItemDefinitionFacts.OrderOptionCopyPlan orderOptionPlan = itemDefinitionFacts.planOrderOptionCopy(
                    sourceDataNodeRef,
                    brandRef,
                    targetDataNodeRef,
                    brandRef,
                    graph.orderOptionDefinitions(),
                    uuidMappings(compatibility.mapping(), "CATALOG_ITEM"),
                    uuidMappings(compatibility.mapping(), "CATALOG_ORDER_OPTION_DEFINITION"),
                    uuidMappings(compatibility.mapping(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE"));
            itemDefinitionFacts.copyOrderOptionConfigs(
                    sourceDataNodeRef,
                    brandRef,
                    targetDataNodeRef,
                    brandRef,
                    graph.orderOptionDefinitions(),
                    copiedDefinitionItemsBySource,
                    uuidMappings(compatibility.mapping(), "CATALOG_ITEM"),
                    uuidMappings(suppliedReferenceMappings(request), "STOCK_TARGET"),
                    orderOptionPlan,
                    unitSnapshotMappings(compatibility.mapping(), graph.units()),
                    now());
            Map<UUID, UUID> optionValueMappings =
                    uuidMappings(compatibility.mapping(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
            for (PreparedCopyItem item : items) {
                if (!copiedDefinitionItemsBySource.containsKey(item.source().ref())) continue;
                Map<UUID, UUID> skuMapping = sourceToTargetSkuRefs(item.source(), item.skus());
                identifierFacts.copyWithinScope(
                        targetDataNodeRef, brandRef, item.source().ref(), item.targetRef(), skuMapping);
                preparationFacts.copyWithinScope(
                        item.source().ref(), item.targetRef(), skuMapping, optionValueMappings);
            }
            verifyTargetNoOwnerReferenceLeak(targetDataNodeRef, brandRef, graph, sourceDataNodeRef);
            ObjectNode data = mapper.createObjectNode().put("preflightDigest", submittedDigest);
            data.set("created", created);
            data.set("reused", reused);
            data.putArray("skipped");
            ArrayNode mappings = data.putArray("mappings");
            compatibility.mapping().forEach((from, to) -> mappings.addObject()
                    .put("sourceRef", from.ref())
                    .put("targetRef", to)
                    .put("referenceKind", from.objectType()));
            ArrayNode referenceMappings = data.putArray("referenceMappings");
            Map<String, ItemRow> targetItemsByRef = new LinkedHashMap<>();
            compatibility
                    .targetRows()
                    .values()
                    .forEach(row -> targetItemsByRef.put(row.ref().toString(), row));
            compatibility
                    .mapping()
                    .forEach((from, to) -> referenceMappings.add(
                            "PRODUCTION_TAG".equals(from.objectType())
                                    ? productionReferenceMappingRow(request, from, to)
                                    : referenceMappingRow(from, to, graph, targetItemsByRef)));
            ArrayNode targetVersions = data.putArray("targetVersions");
            loadItemIdentityRows(
                            targetDataNodeRef,
                            brandRef,
                            source.stream().map(ItemRow::code).toList())
                    .forEach(row -> targetVersions
                            .addObject()
                            .put("targetRef", row.ref().toString())
                            .put("version", row.version()));
            ArrayNode ownerReadbacks = data.putArray("ownerReadbacks");
            ownerReadbacks
                    .addObject()
                    .put("owner", "catalog")
                    .put("status", "COMMITTED")
                    .put("version", 1);
            ObjectNode result = envelope(requestId, data);
            long postTargetVersion = targetScopeVersion(targetDataNodeRef, brandRef, request, graph);
            result.put(
                    "receiptObjectFingerprint",
                    copyDigest(
                            sourceDataNodeRef,
                            targetDataNodeRef,
                            brandRef,
                            selected,
                            graph,
                            sourceVersion,
                            postTargetVersion));
            if (idempotencyKey != null && !idempotencyKey.isBlank())
                saveReceipt(
                        targetDataNodeRef,
                        idempotencyKey.trim(),
                        operationId,
                        receiptRequest(request, brandRef),
                        result);
            return result;
        }
    }

private JsonNode copyLocal(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String operationId,
            String scope,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        return copyLocal(commandContext, operationId, scope, brandRef, request, requestId, idempotencyKey, null);
    }

private JsonNode copyLocal(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String operationId,
            String scope,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            LocalCopyPlan preparedPlan) {
        LocalCopyPlan plan = preparedPlan == null ? localCopyPlan(scope, brandRef, request) : preparedPlan;
        ItemRow source = plan.source();
        ItemRow target = plan.target();
        ArrayNode selectedSections = plan.selectedSections();
        String digest = plan.digest();
        CompatibilityCheck compatibility = plan.compatibility();
        List<UnitRow> localUnits = plan.units();
        CatalogInventoryCoordinator.validateCompatibilityDispositions(
                localCompatibilityResults(scope, brandRef, plan), request.path("compatibilityDispositions"));
        if (requiredLong(request, "expectedSourceVersion", -1) != source.version()) {
            String staleReason = "复制来源事实已变化，请重新预检";
            throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, staleReason);
        }
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            JsonNode replay = replay(scope, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef));
            if (replay != null) return replayCopyIfCurrent(replay, digest);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            long expectedSource = requiredLong(request, "expectedSourceVersion", -1);
            long expectedTarget = requiredLong(request, "expectedTargetVersion", -1);
            boolean sourceVersionMatches = expectedSource == source.version();
            boolean targetVersionMatches = expectedTarget == target.version();
            String submittedDigest = required(request, "preflightDigest");
            boolean digestMatches = submittedDigest.equals(digest);
            if (!sourceVersionMatches || !targetVersionMatches || !digestMatches) {
                String staleReason = "复制预检已失效，请重新预检";
                throw new CatalogOwnerApi.Problem("STALE_COPY_PREFLIGHT", 409, staleReason);
            }
            if (compatibility.blocking())
                throw new CatalogOwnerApi.Problem(compatibility.problemCode(), 422, compatibility.reason());
            ObjectNode merged = (ObjectNode) json(target.sectionsJson()).deepCopy();
            JsonNode sourceSections = json(source.sectionsJson());
            ArrayNode copiedSkus = null;
            ArrayNode copiedCompositeGroups = null;
            ArrayNode copiedSkuVariantDimensions = null;
            boolean copyBasicInfo = selectedSectionsElements(selectedSections).contains("BASIC_INFO");
            for (JsonNode section : selectedSections) {
                String key = sectionKey(section.asText());
                if ("BASIC_INFO".equals(section.asText())) {
                    // The list-facing short name is a column fact.  The local-copy
                    // update below carries it beside the JSON section payload.
                } else if ("SKU_STRUCTURE".equals(section.asText())) {
                    if (hasLocalCopySourceFacts(sourceSections, "skus", "skuVariantDimensions")) {
                        copiedSkus = clonedSkuFacts((ArrayNode) sourceSections.path("skus"));
                        merged.set("skus", copiedSkus.deepCopy());
                        copiedSkuVariantDimensions =
                                submittedSkuVariantDimensions(sourceSections.path("skuVariantDimensions"));
                        merged.set("skuVariantDimensions", copiedSkuVariantDimensions.deepCopy());
                    }
                } else if ("PACKAGE_STRUCTURE".equals(section.asText())) {
                    if (hasLocalCopySourceFacts(sourceSections, "compositeGroups")) {
                        copiedCompositeGroups = compositeGroups(sourceSections.path("compositeGroups"));
                        merged.set("compositeGroups", copiedCompositeGroups.deepCopy());
                    }
                } else if ("ORDER_OPTIONS".equals(section.asText())) {
                    // Order-option assignments are relational catalog facts.  They are copied by the
                    // owner aggregate, never by reintroducing the retired item JSON section.
                    ArrayNode sourceAssignments =
                            sourceSections.path("attributeAssignments").isArray()
                                    ? (ArrayNode) sourceSections.path("attributeAssignments")
                                    : mapper.createArrayNode();
                    ArrayNode sourceConfigs =
                            sourceSections.path("orderOptionConfigs").isArray()
                                    ? (ArrayNode) sourceSections.path("orderOptionConfigs")
                                    : mapper.createArrayNode();
                    itemDefinitionFacts.copyCurrentFactsWithinScope(
                            scope, brandRef, target.ref(), sourceAssignments, sourceConfigs);
                } else if (sourceSections.has(key))
                    merged.set(key, sourceSections.path(key).deepCopy());
            }
            if (copiedSkuVariantDimensions != null && copiedSkus != null) {
                skuVariantAxisFacts.validateRetirements(target.ref(), copiedSkuVariantDimensions, copiedSkus);
            }
            lockCatalogAssetRefs(json(source.sectionsJson()), json(target.sectionsJson()), merged);
            Set<UUID> archivedSkuRefs = copiedSkus == null ? Set.of() : skuFacts.existingRefs(target.ref());
            requireSkuRetirementUnreferenced(commandContext, archivedSkuRefs);
            ObjectNode persistedSections = merged.deepCopy();
            String copiedShortName = copyBasicInfo ? source.shortName() : target.shortName();
            removeShortName(persistedSections);
            removeRelationalSectionFacts(persistedSections);
            int changed = persistence.updateCopiedItem(
                    copyBasicInfo ? source.name() : target.name(),
                    copiedShortName,
                    canonicalJson(persistedSections),
                    scope,
                    brandRef,
                    target.code(),
                    target.version(),
                    now());
            if (changed != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "目标商品版本已变化");
            if (copiedSkus != null) {
                skuFacts.replace(target.ref(), copiedSkus, archivedSkuRefs);
                skuMediaFacts.replace(copiedSkus);
            }
            if (copyBasicInfo || copiedSkus != null) {
                ArrayNode effectiveSkus = copiedSkus;
                if (effectiveSkus == null)
                    effectiveSkus = skuFacts.readByItemRefs(List.of(target.ref()))
                            .getOrDefault(target.ref(), mapper.createArrayNode());
                writeCopiedEffectiveUnitFacts(scope, brandRef, target.ref(), merged, effectiveSkus);
            }
            ArrayNode effectiveSkus = copiedSkus == null
                    ? skuFacts.readByItemRefs(List.of(target.ref()))
                            .getOrDefault(target.ref(), mapper.createArrayNode())
                    : copiedSkus;
            if (copyBasicInfo
                    || copiedSkus != null
                    || selectedSectionsElements(selectedSections).contains("PRODUCTION_PROMPTS")) {
                Map<UUID, UUID> skuMapping = sourceToTargetSkuRefs(source, effectiveSkus);
                if (copyBasicInfo) {
                    identifierFacts.copyWithinScope(scope, brandRef, source.ref(), target.ref(), skuMapping);
                }
                if (selectedSectionsElements(selectedSections).contains("PRODUCTION_PROMPTS")) {
                    preparationFacts.copyWithinScope(source.ref(), target.ref(), skuMapping, Map.of());
                    itemReferenceFacts.replace(target.ref(), merged.path("productionTagRef"), merged.path("tagRefs"));
                }
            }
            if (copiedCompositeGroups != null) compositeFacts.replace(target.ref(), copiedCompositeGroups);
            if (copiedSkuVariantDimensions != null)
                skuVariantAxisFacts.replace(target.ref(), copiedSkuVariantDimensions);
            ObjectNode data = mapper.createObjectNode().put("preflightDigest", digest);
            data.putArray("created");
            data.putArray("reused")
                    .addObject()
                    .put("objectType", "CATALOG_ITEM")
                    .put("code", target.code());

            data.set("skipped", localCopySkipped(source, selectedSections));

            data.putArray("referenceMappings")
                    .addObject()
                    .put("objectType", "CATALOG_ITEM")
                    .put("sourceRef", source.ref().toString())
                    .put("targetRef", target.ref().toString())
                    .put("targetCode", target.code());
            localUnits.forEach(
                    unit -> data.withArray("referenceMappings").add(unitReferenceMappingRow(unit, unit.ref())));
            data.putArray("targetVersions")
                    .addObject()
                    .put("targetRef", target.ref().toString())
                    .put("version", target.version() + 1);
            data.putArray("ownerReadbacks")
                    .addObject()
                    .put("owner", "catalog")
                    .put("status", "COMMITTED")
                    .put("version", target.version() + 1);
            ObjectNode result = envelope(requestId, data);
            result.put(
                    "receiptObjectFingerprint",
                    localCopyDigest(source, target, selectedSections, localUnits, target.version() + 1));
            if (idempotencyKey != null && !idempotencyKey.isBlank())
                saveReceipt(scope, idempotencyKey.trim(), operationId, receiptRequest(request, brandRef), result);
            return result;
        }
    }

private ObjectNode localCopyPreflight(String scope, String brandRef, ObjectNode request) {
        return localCopyPreflight(scope, brandRef, request, localCopyPlan(scope, brandRef, request));
    }

private ObjectNode localCopyPreflight(String scope, String brandRef, ObjectNode request, LocalCopyPlan plan) {
        ItemRow source = plan.source();
        ItemRow target = plan.target();
        CompatibilityCheck compatibility = plan.compatibility();
        List<UnitRow> localUnits = plan.units();
        ObjectNode data = mapper.createObjectNode();
        data.putObject("sourceScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", scope)
                .put("brandRef", brandRef);
        data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", scope)
                .put("brandRef", brandRef);
        data.putArray("selectedItems")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", source.code())
                .put("name", source.name());
        data.putArray("closureItems")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", source.code())
                .put("name", source.name())
                .put("action", "REPLACE");
        ArrayNode closureEdges = data.putArray("closureEdges");
        localUnits.forEach(unit -> closureEdges
                .addObject()
                .put("fromRef", source.ref().toString())
                .put("toRef", unit.ref().toString())
                .put("referenceKind", "CATALOG_UNIT"));
        data.putArray("objectVersions")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", source.code())
                .put("sourceVersion", source.version())
                .put("targetVersion", target.version());
        localUnits.forEach(unit -> data.withArray("objectVersions")
                .addObject()
                .put("objectType", "CATALOG_UNIT")
                .put("code", unit.code())
                .put("sourceVersion", unit.version())
                .put("targetVersion", unit.version()));
        ArrayNode localReferenceMappings = data.putArray("referenceMappings");
        localReferenceMappings
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("sourceRef", source.ref().toString())
                .put("targetRef", target.ref().toString())
                .put("targetCode", target.code());
        for (UnitRow unit : localUnits) {
            localReferenceMappings.add(unitReferenceMappingRow(unit, unit.ref()));
            data.withArray("closureItems")
                    .addObject()
                    .put("objectType", "CATALOG_UNIT")
                    .put("code", unit.code())
                    .put("name", unit.name())
                    .put("action", "REUSE");
        }
        if (selectedSectionsElements(plan.selectedSections()).contains("ORDER_OPTIONS")
                || selectedSectionsElements(plan.selectedSections()).contains("OPTION_VALUE_BOM")) {
            itemDefinitionFacts.localCopyOptionValueMappings(source.ref()).forEach(localReferenceMappings::add);
        }
        ArrayNode mappingPreview = data.putArray("mappingPreview");
        mappingPreview
                .addObject()
                .put("fromCode", source.code())
                .put("toCode", target.code())
                .put("referenceKind", "CATALOG_ITEM")
                .put("status", compatibility.result())
                .set("canonicalTuple", canonicalTuple(scope, brandRef, "CATALOG_ITEM", source.code()));
        localUnits.forEach(unit -> mappingPreview
                .addObject()
                .put("fromCode", unit.code())
                .put("toCode", unit.code())
                .put("referenceKind", "CATALOG_UNIT")
                .put("status", "REUSE")
                .set("canonicalTuple", canonicalTuple(scope, brandRef, "CATALOG_UNIT", unit.code())));
        data.putArray("compatibilityResults")
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("compatibilityId", "CATALOG_ITEM:" + source.ref())
                .put("result", compatibility.result())
                .put("reason", compatibility.reason())
                .put("reasonCode", compatibility.reasonCode())
                .set("canonicalTuple", canonicalTuple(scope, brandRef, "CATALOG_ITEM", source.code()));
        ArrayNode rewritePreview = data.putArray("referenceRewritePreview");
        localUnits.forEach(unit -> rewritePreview
                .addObject()
                .put("objectType", "CATALOG_UNIT")
                .put("sourceRef", unit.ref().toString())
                .put("targetRef", unit.ref().toString())
                .put("referenceKind", "CATALOG_UNIT")
                .put("status", "IDENTITY"));
        data.set("skipped", localCopySkipped(source, plan.selectedSections()));
        data.put("preflightDigest", plan.digest())
                .put("selectedCount", 1)
                .put("selectedLimit", 1)
                .put("closureCount", 1 + localUnits.size())
                .put("closureLimit", copyLimits.closureItemCount())
                .put("blockingCount", compatibility.blocking() ? 1 : 0)
                .put("confirmationRequiredCount", compatibility.blocking() ? 0 : 1);
        return data;
    }

private ArrayNode localCompatibilityResults(String scope, String brandRef, LocalCopyPlan plan) {
        ArrayNode results = mapper.createArrayNode();
        results.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("compatibilityId", "CATALOG_ITEM:" + plan.source().ref())
                .put("result", plan.compatibility().result())
                .put("reason", plan.compatibility().reason())
                .put("reasonCode", plan.compatibility().reasonCode())
                .set(
                        "canonicalTuple",
                        canonicalTuple(
                                scope, brandRef, "CATALOG_ITEM", plan.source().code()));
        return results;
    }

private LocalCopyPlan localCopyPlan(String scope, String brandRef, ObjectNode request) {
        String sourceCode = required(request, "sourceItemCode");
        String targetCode = required(request, "targetItemCode");
        if (sourceCode.equals(targetCode)) {
            throw new CatalogOwnerApi.Problem(("VALIDATION_ERROR"), (422), ("复制来源与目标不能相同"));
        }
        ArrayNode selectedSections =
                request.path("selectedSections").isArray() ? (ArrayNode) request.path("selectedSections") : null;
        validatedLocalCopySections(selectedSections);
        Map<String, ItemRow> itemsByCode = new LinkedHashMap<>();
        loadLocalCopyItems(scope, brandRef, List.of(sourceCode, targetCode), selectedSections)
                .forEach(row -> itemsByCode.put(row.code(), row));
        ItemRow source = itemsByCode.get(sourceCode);
        ItemRow target = itemsByCode.get(targetCode);
        if (source == null || target == null) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "商品不存在");
        List<UnitRow> units = loadUnits(scope, brandRef, unitReferences(json(source.sectionsJson())));
        CompatibilityCheck compatibility = source.shapeKey().equals(target.shapeKey())
                ? new CompatibilityCheck(
                        "CONFIRMABLE_REUSE",
                        "同形态商品可复制",
                        null,
                        "REUSE_CONFIRMATION_REQUIRED",
                        /* format-wrap */
                        false)
                : new CompatibilityCheck(
                        "BLO"
                                /* format-wrap */
                                + "CKED",
                        "商品形态结构不兼容",
                        "STRUCTURE_INCOMPATIBLE",
                        "STRUCTURE_INCOMPATIBLE",
                        /* format-wrap */
                        true);
        if (!compatibility.blocking()) {
            Set<String> itemRefs = itemReferenceRefs(json(source.sectionsJson()));
            Map<String, String> resolvedItemRefs = activeItemCodesByRef(scope, brandRef, itemRefs);
            if (resolvedItemRefs.size() != itemRefs.size())
                compatibility = new CompatibilityCheck(
                        "BLOCKED",
                        "BOM 引用无法在当前商品库解析",
                        "REFERENCE_MAPPING_UNRESOLVED",
                        "REFERENCE_MAPPING_UNRESOLVED",
                        true);
        }
        return new LocalCopyPlan(
                source,
                target,
                selectedSections,
                localCopyDigest(source, target, selectedSections, units),
                compatibility,
                units);
    }

/**
     * Local copy is section-scoped. The old generic detail hydration loaded every relational family even when the
     * selected section could not consume it; that turned one copy closure into a fixed fan-out of owner reads. This
     * projection keeps the same ItemRow read shape for the selected facts while loading only the families required by
     * the requested section and the unit snapshot needed by the copy digest.
     */
    private List<ItemRow> loadLocalCopyItems(
            String dataNodeRef, String brandRef, List<String> codes, ArrayNode selectedSections) {
        List<ItemRow> rows = loadItemIdentityRows(dataNodeRef, brandRef, codes);
        if (rows.isEmpty()) return rows;
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        Set<String> selected = selectedSectionsElements(selectedSections);
        boolean loadSkus = selected.contains("SKU_STRUCTURE")
                || selected.contains("BASIC_INFO")
                || selected.contains("PRODUCTION_PROMPTS");
        boolean loadOrderOptions = selected.contains("ORDER_OPTIONS");
        boolean loadComposites = selected.contains("PACKAGE_STRUCTURE");
        boolean loadAxes = selected.contains("SKU_STRUCTURE");
        boolean loadReferences = selected.contains("PRODUCTION_PROMPTS");
        Map<UUID, ArrayNode> skus = loadSkus ? skuFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> attributes =
                loadOrderOptions ? itemDefinitionFacts.readAttributeAssignments(itemRefs) : Map.of();
        Map<UUID, ArrayNode> orderOptions =
                loadOrderOptions ? itemDefinitionFacts.readOrderOptionConfigs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> composites = loadComposites ? compositeFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> axes = loadAxes ? skuVariantAxisFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> images = Map.of();
        Map<UUID, Map<String, JsonNode>> references =
                loadReferences ? itemReferenceFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, CatalogIdentifierFacts.ItemReadback> identifiers =
                loadReferences || loadSkus ? identifierFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, JsonNode> itemProfiles = loadReferences ? preparationFacts.readItemProfiles(itemRefs) : Map.of();
        List<UUID> skuRefs = skus.values().stream()
                .filter(java.util.Objects::nonNull)
                .flatMap(array -> java.util.stream.StreamSupport.stream(array.spliterator(), false))
                .map(sku -> nullableUuid(sku, "productSkuRef"))
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<UUID, JsonNode> skuOverrides = loadReferences ? preparationFacts.readSkuOverrides(skuRefs) : Map.of();
        Map<UUID, Map<UUID, JsonNode>> optionEffects =
                loadReferences ? preparationFacts.readOptionEffects(itemRefs) : Map.of();
        Map<UUID, ItemUnitRefs> units = itemUnitRefsByItemRefs(itemRefs);
        List<ItemRow> projected = new ArrayList<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            if (loadSkus) sections.set("skus", skus.getOrDefault(row.ref(), mapper.createArrayNode()));
            if (loadOrderOptions) {
                sections.set("attributeAssignments", attributes.getOrDefault(row.ref(), mapper.createArrayNode()));
                sections.set("orderOptionConfigs", orderOptions.getOrDefault(row.ref(), mapper.createArrayNode()));
            }
            if (loadComposites)
                sections.set("compositeGroups", composites.getOrDefault(row.ref(), mapper.createArrayNode()));
            if (loadAxes) sections.set("skuVariantDimensions", axes.getOrDefault(row.ref(), mapper.createArrayNode()));
            if (loadReferences) {
                Map<String, JsonNode> itemReferences = references.get(row.ref());
                sections.set(
                        "productionTagRef",
                        itemReferences == null
                                ? mapper.nullNode()
                                : itemReferences.getOrDefault(
                                        CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
                sections.set(
                        "tagRefs",
                        itemReferences == null
                                ? mapper.createArrayNode()
                                : itemReferences.getOrDefault(
                                        CatalogItemReferenceFacts.CATALOG_TAG, mapper.createArrayNode()));
            }
            if (loadReferences || loadSkus) {
                CatalogIdentifierFacts.ItemReadback identifierReadback = identifiers.get(row.ref());
                decoratePreparationFacts(
                        row.ref(),
                        sections,
                        identifierReadback,
                        itemProfiles.get(row.ref()),
                        identifierReadback == null ? Map.of() : identifierReadback.skuIdentifiers(),
                        skuOverrides,
                        optionEffects.getOrDefault(row.ref(), Map.of()));
            }
            ItemUnitRefs unitRefs = units.get(row.ref());
            if (unitRefs == null || unitRefs.salesUnitRef() == null) sections.putNull("salesUnitRef");
            else sections.put("salesUnitRef", unitRefs.salesUnitRef().toString());
            if (unitRefs == null || unitRefs.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
            else
                sections.put("baseMeasureUnitRef", unitRefs.baseMeasureUnitRef().toString());
            putNullableUnitSnapshot(
                    sections, "salesUnitSnapshot", unitRefs == null ? null : unitRefs.salesUnitSnapshot());
            putNullableUnitSnapshot(
                    sections, "baseMeasureUnitSnapshot", unitRefs == null ? null : unitRefs.baseMeasureUnitSnapshot());
            projected.add(new ItemRow(
                    row.ref(),
                    row.code(),
                    row.name(),
                    row.shortName(),

                    row.shapeKey(),
                    row.status(),

                    canonicalJson(sections),
                    row.version(),
                    row.updatedAt(),
                    row.sourceScopeRef()));
        }
        return List.copyOf(projected);
    }

private ArrayNode localCopySkipped(ItemRow source, ArrayNode selectedSections) {
        JsonNode sourceSections = json(source.sectionsJson());
        ArrayNode skipped = mapper.createArrayNode();
        for (JsonNode selected : selectedSections) {
            String section = selected.asText();
            if (Set.of("SKU_BOM", "OPTION_VALUE_BOM", "ITEM_BOM").contains(section) || "BASIC_INFO".equals(section))
                continue;
            if ("ORDER_OPTIONS".equals(section)) {
                JsonNode configs = sourceSections.path("orderOptionConfigs");
                if (!configs.isEmpty()) continue;
            }
            if (!hasLocalCopySourceFacts(sourceSections, sectionKey(section))) {
                skipped.addObject().put("section", section).put("reasonCode", "SKIPPED_SOURCE_ABSENT");
            }
        }
        return skipped;
    }

/**
     * A hydrated empty relationship is not source content and must never erase the target during a partial local copy.
     */
    private static boolean hasLocalCopySourceFacts(JsonNode sections, String... keys) {
        for (String key : keys) {
            JsonNode value = sections.path(key);
            if (value.isArray() && !value.isEmpty()) return true;
            if (value.isObject() && !value.isEmpty()) return true;
        }
        return false;
    }

private static String sectionKey(String section) {
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

private String localCopyDigest(ItemRow source, ItemRow target, ArrayNode sections, List<UnitRow> units) {
        return localCopyDigest(source, target, sections, units, target.version());
    }

private String localCopyDigest(
            ItemRow source, ItemRow target, ArrayNode sections, List<UnitRow> units, long targetVersion) {
        ArrayList<String> values = new ArrayList<>();
        sections.forEach(section -> values.add(section.asText()));
        Collections.sort(values);
        if (units != null)
            units.stream()
                    .sorted(java.util.Comparator.comparing(UnitRow::code).thenComparing(UnitRow::ref))
                    .forEach(unit -> values.add(
                            "UNIT:" + unit.ref() + ":" + unit.code() + ":" + unit.name() + ":" + unit.unitDimension()
                                    + ":" + unit.precision() + ":" + unit.status() + ":" + unit.version()));
        return digest(source.code() + "|" + target.code() + "|" + source.version() + "|" + targetVersion + "|"
                + String.join(",", values));
    }

/** A local copy owns new child identities; sharing a source SKU ref would make two items claim one fact. */
    private ArrayNode clonedSkuFacts(ArrayNode sourceSkus) {
        ArrayNode copied = mapper.createArrayNode();
        if (sourceSkus == null) return copied;
        for (JsonNode sourceSku : sourceSkus) {
            if (!sourceSku.isObject())
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "source SKU is invalid");
            ObjectNode clone = ((ObjectNode) sourceSku).deepCopy();
            clone.put("productSkuRef", UUID.randomUUID().toString());
            copied.add(clone);
        }
        return copied;
    }

private Map<UUID, UUID> sourceToTargetSkuRefs(ItemRow source, ArrayNode targetSkus) {
        Map<String, UUID> targetByCode = new LinkedHashMap<>();
        if (targetSkus != null)
            for (JsonNode sku : targetSkus) {
                UUID targetRef = nullableUuid(sku, "productSkuRef");
                if (targetRef != null) targetByCode.put(sku.path("skuCode").asText(), targetRef);
            }
        Map<UUID, UUID> result = new LinkedHashMap<>();
        JsonNode sourceSkus = json(source.sectionsJson()).path("skus");
        if (sourceSkus.isArray())
            for (JsonNode sku : sourceSkus) {
                UUID sourceRef = nullableUuid(sku, "productSkuRef");
                UUID targetRef = targetByCode.get(sku.path("skuCode").asText());
                if (sourceRef != null && targetRef != null) result.put(sourceRef, targetRef);
            }
        return result;
    }

/**
     * A receipt can be read only after current owner facts are loaded; it can leave this owner only when its stored
     * post-command fingerprint still equals those facts. Older receipts without the marker fail closed.
     */
    private JsonNode replayCopyIfCurrent(JsonNode replay, String currentFingerprint) {
        if (!currentFingerprint.equals(replay.path("receiptObjectFingerprint").asText())) {
            {
                throw new CatalogOwnerApi.Problem(
                        ("STALE_COPY_PREFLIGHT"),
                        (409),
                        /* format-wrap */
                        ("复制对象事实已变化，请重新预检"));
            }
        }
        return replay;
    }

private void lockCatalogAssetRefs(JsonNode... sections) {
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (JsonNode section : sections) {
            if (section == null) continue;
            for (String ref : catalogAssetRefs(section)) {
                try {
                    refs.add(UUID.fromString(ref));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }
        assetReferenceLocks.lockCatalogReferences(refs);
    }

private ObjectNode copyCandidates(
            String operationId, String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode();
        boolean brandCopy = "getOperationsBrandCatalogCopyCandidates".equals(operationId);
        String sourceDataNodeRef = brandCopy ? required(request, "sourceDataNodeRef") : dataNodeRef;
        data.putObject("sourceScope")
                .put("ownerType", brandCopy ? "HEAD_COMPANY" : "DATA_NODE")
                .put("ownerRef", sourceDataNodeRef)
                .put("brandRef", brandRef);
        data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", dataNodeRef)
                .put("brandRef", brandRef);
        if (brandCopy) data.put("copySourceAvailable", true);
        ArrayNode entries = data.putArray("items");
        String keyword = optional(request, "keyword");
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity =
                cursorIdentity(operationId, sourceDataNodeRef, brandRef, keyword, Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, queryIdentity);
        List<CatalogCopyPersistence.CopyPageRow> persistenceRows = persistence.loadCopyCandidates(
                sourceDataNodeRef,
                brandRef,
                keyword,
                cursor == null ? null : cursor.sortKey(),
                cursor == null ? null : cursor.tieBreaker(),
                pageSize);
        List<CopyPageRow> pageRows = persistenceRows.stream()
                .map(row -> new CopyPageRow(
                        row.item() == null ? null : itemRow(row.item()), row.total()))
                .toList();
        List<CopyPageRow> presentRows =
                pageRows.stream().filter(row -> row.item() != null).toList();
        boolean hasNext = presentRows.size() > pageSize;
        if (hasNext) presentRows = presentRows.subList(0, pageSize);
        presentRows.stream().map(CopyPageRow::item).forEach(row -> entries.addObject()
                .put("code", row.code())
                .put("name", row.name())
                .put("shapeKey", row.shapeKey())
                .put("status", row.status())
                .put("compatibilityHint", "REVIEW_REQUIRED")
                .put("version", row.version()));
        long total = pageRows.isEmpty() ? 0 : pageRows.get(0).total();
        data.put("total", total).put("generation", generation(dataNodeRef, brandRef));
        if (hasNext) {
            CopyPageRow last = presentRows.get(presentRows.size() - 1);
            data.put(
                    "cursor",
                    OpaqueCollectionCursor.encode(
                            queryIdentity, last.item().code(), last.item().ref()));
        } else data.putNull("cursor");
        return envelope(requestId, data);
    }

private ObjectNode shapeManifest(String requestId) {
        try {
            JsonNode manifest = mapper.readTree(CatalogInventoryShapeManifest.MANIFEST_JSON);
            ObjectNode data = mapper.createObjectNode();
            data.put("manifestRevision", CatalogInventoryShapeManifest.REVISION);
            data.put("manifestDigest", CatalogInventoryShapeManifest.MANIFEST_DIGEST);
            data.set("shapeKeys", manifest.path("shapeKeys"));
            data.set("capabilityValues", manifest.path("capabilityValues"));
            data.set("controlKinds", manifest.path("controlKinds"));
            data.set("fields", manifest.path("fields"));
            data.set("enumLabels", manifest.path("enumLabels"));
            for (String key : List.of(
                    "modeRules",
                    "shapeRules",
                    "fieldRules",
                    "tabRules",
                    "linkageRules",
                    "typeEffects",
                    "saveSections",
                    "detailSections",
                    "identifierRules",
                    "preparationRules")) data.set(key, manifest.path(key));
            return envelope(requestId, data);
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "形态契约不可用", ex);
        }
    }

private static InventoryOwnerApi.UnitSnapshot unitSnapshot(CatalogOwnerApi.UnitDefinitionReadback unit) {
        return unit == null
                ? null
                : new InventoryOwnerApi.UnitSnapshot(
                        unit.unitRef(),
                        unit.code(),
                        unit.name(),
                        unit.unitDimension().name(),
                        unit.precision());
    }

private void writeItemUnitSnapshots(
            UUID itemRef, CatalogOwnerApi.UnitDefinitionReadback sales, CatalogOwnerApi.UnitDefinitionReadback base) {
        writeItemUnitSnapshotsBatch(Collections.singletonList(itemUnitFactRow(itemRef, sales, base)));
    }

private void writeItemUnitSnapshotsBatch(List<CatalogCopyPersistence.ItemUnitSnapshotRow> rows) {
        if (rows.isEmpty()) return;
        persistence.insertItemUnitSnapshots(rows);
    }

private CatalogCopyPersistence.ItemUnitSnapshotRow itemUnitFactRow(
            UUID itemRef, CatalogOwnerApi.UnitDefinitionReadback sales, CatalogOwnerApi.UnitDefinitionReadback base) {
        return new CatalogCopyPersistence.ItemUnitSnapshotRow(
                sales == null ? null : sales.unitRef(),
                sales == null ? null : sales.code(),
                sales == null ? null : sales.name(),
                sales == null ? null : sales.unitDimension().name(),
                sales == null ? null : sales.precision(),
                base == null ? null : base.unitRef(),
                base == null ? null : base.code(),
                base == null ? null : base.name(),
                base == null ? null : base.unitDimension().name(),
                base == null ? null : base.precision(),
                itemRef);
    }

private void writeSkuUnitFacts(
            UUID skuRef,
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,

            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback sales,
            CatalogOwnerApi.UnitDefinitionReadback base) {

        List<CatalogCopyPersistence.SkuUnitFactRow> rows = new ArrayList<>();
        rows.add(skuUnitFactRow(skuRef, salesOverride, baseOverride, sales, base));
        writeSkuUnitFactsBatch(rows);
    }

private void writeSkuUnitFactsBatch(List<CatalogCopyPersistence.SkuUnitFactRow> rows) {
        if (rows.isEmpty()) return;
        persistence.insertSkuUnitFacts(rows);
    }

private CatalogCopyPersistence.SkuUnitFactRow skuUnitFactRow(
            UUID skuRef,
            CatalogOwnerApi.UnitDefinitionReadback salesOverride,
            CatalogOwnerApi.UnitDefinitionReadback baseOverride,
            CatalogOwnerApi.UnitDefinitionReadback sales,
            CatalogOwnerApi.UnitDefinitionReadback base) {
        return new CatalogCopyPersistence.SkuUnitFactRow(
                sales == null ? null : sales.unitRef(),
                sales == null ? null : sales.code(),
                sales == null ? null : sales.name(),
                sales == null ? null : sales.unitDimension().name(),
                sales == null ? null : sales.precision(),
                base == null ? null : base.unitRef(),
                base == null ? null : base.code(),
                base == null ? null : base.name(),
                base == null ? null : base.unitDimension().name(),
                base == null ? null : base.precision(),
                now(),
                skuRef);
    }

private void writeCopiedEffectiveUnitFacts(
            String scope, String brand, UUID itemRef, ObjectNode sections, ArrayNode skus) {
        UUID itemSalesRef = nullableUuid(sections, "salesUnitRef");
        UUID itemBaseRef = nullableUuid(sections, "baseMeasureUnitRef");
        Set<UUID> refs = new LinkedHashSet<>();
        if (itemSalesRef != null) refs.add(itemSalesRef);
        if (itemBaseRef != null) refs.add(itemBaseRef);
        Map<UUID, UUID> salesOverrideRefs = new LinkedHashMap<>();
        Map<UUID, UUID> baseOverrideRefs = new LinkedHashMap<>();
        if (skus != null && skus.isArray())
            for (JsonNode sku : skus) {
                UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
                UUID salesOverrideRef = nullableUuid(sku, "salesUnitOverrideRef");
                UUID baseOverrideRef = nullableUuid(sku, "baseMeasureUnitOverrideRef");
                salesOverrideRefs.put(skuRef, salesOverrideRef);
                baseOverrideRefs.put(skuRef, baseOverrideRef);
                if (salesOverrideRef != null) refs.add(salesOverrideRef);
                if (baseOverrideRef != null) refs.add(baseOverrideRef);
            }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> definitions =
                unitDefinitionFacts.requireInScopeAll(scope, brand, refs);
        CatalogOwnerApi.UnitDefinitionReadback itemSales = itemSalesRef == null ? null : definitions.get(itemSalesRef);
        CatalogOwnerApi.UnitDefinitionReadback itemBase = itemBaseRef == null ? null : definitions.get(itemBaseRef);
        writeItemUnitSnapshots(itemRef, itemSales, itemBase);
        if (skus == null || !skus.isArray()) return;
        for (JsonNode sku : skus) {
            UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
            UUID salesOverrideRef = salesOverrideRefs.get(skuRef);
            UUID baseOverrideRef = baseOverrideRefs.get(skuRef);
            CatalogOwnerApi.UnitDefinitionReadback salesOverride =
                    salesOverrideRef == null ? null : definitions.get(salesOverrideRef);
            CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                    baseOverrideRef == null ? null : definitions.get(baseOverrideRef);
            writeSkuUnitFacts(
                    skuRef,
                    salesOverride,
                    baseOverride,
                    salesOverride == null ? itemSales : salesOverride,
                    baseOverride == null ? itemBase : baseOverride);
        }
    }

private void writeCopiedEffectiveUnitFactsBatch(String scope, String brand, List<CopiedUnitInput> inputs) {
        if (inputs == null || inputs.isEmpty()) return;
        Set<UUID> refs = new LinkedHashSet<>();
        Map<UUID, CopiedUnitRefs> factsByItem = new LinkedHashMap<>();
        for (CopiedUnitInput input : inputs) {
            UUID itemSalesRef = nullableUuid(input.sections(), "salesUnitRef");
            UUID itemBaseRef = nullableUuid(input.sections(), "baseMeasureUnitRef");
            if (itemSalesRef != null) refs.add(itemSalesRef);
            if (itemBaseRef != null) refs.add(itemBaseRef);
            Map<UUID, UUID> salesOverrides = new LinkedHashMap<>();
            Map<UUID, UUID> baseOverrides = new LinkedHashMap<>();
            if (input.skus() != null && input.skus().isArray())
                for (JsonNode sku : input.skus()) {
                    UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
                    UUID salesOverride = nullableUuid(sku, "salesUnitOverrideRef");
                    UUID baseOverride = nullableUuid(sku, "baseMeasureUnitOverrideRef");
                    salesOverrides.put(skuRef, salesOverride);
                    baseOverrides.put(skuRef, baseOverride);
                    if (salesOverride != null) refs.add(salesOverride);
                    if (baseOverride != null) refs.add(baseOverride);
                }
            factsByItem.put(
                    input.itemRef(),
                    new CopiedUnitRefs(itemSalesRef, itemBaseRef, salesOverrides, baseOverrides, input.skus()));
        }
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> definitions =
                unitDefinitionFacts.requireInScopeAll(scope, brand, refs);
        List<CatalogCopyPersistence.ItemUnitSnapshotRow> itemRows = new ArrayList<>();
        List<CatalogCopyPersistence.SkuUnitFactRow> skuRows = new ArrayList<>();
        factsByItem.forEach((itemRef, facts) -> {
            CatalogOwnerApi.UnitDefinitionReadback itemSales =
                    facts.salesUnitRef() == null ? null : definitions.get(facts.salesUnitRef());
            CatalogOwnerApi.UnitDefinitionReadback itemBase =
                    facts.baseMeasureUnitRef() == null ? null : definitions.get(facts.baseMeasureUnitRef());
            itemRows.add(itemUnitFactRow(itemRef, itemSales, itemBase));
            if (facts.skus() == null || !facts.skus().isArray()) return;
            for (JsonNode sku : facts.skus()) {
                UUID skuRef = UUID.fromString(sku.path("productSkuRef").asText());
                UUID salesOverrideRef = facts.salesOverrides().get(skuRef);
                UUID baseOverrideRef = facts.baseOverrides().get(skuRef);
                CatalogOwnerApi.UnitDefinitionReadback salesOverride =
                        salesOverrideRef == null ? null : definitions.get(salesOverrideRef);
                CatalogOwnerApi.UnitDefinitionReadback baseOverride =
                        baseOverrideRef == null ? null : definitions.get(baseOverrideRef);
                skuRows.add(skuUnitFactRow(
                        skuRef,
                        salesOverride,
                        baseOverride,
                        salesOverride == null ? itemSales : salesOverride,
                        baseOverride == null ? itemBase : baseOverride));
            }
        });
        writeItemUnitSnapshotsBatch(itemRows);
        writeSkuUnitFactsBatch(skuRows);
    }

    private int[] copyUnitDefinitions(List<UnitCopy> units) {
        if (units == null || units.isEmpty()) return new int[0];
        int[] changes = persistence.insertUnitDefinitions(units.stream()
                .map(unit -> new CatalogCopyPersistence.UnitCopyRow(
                        unit.targetRef(),
                        unit.dataNodeRef(),
                        unit.brandRef(),
                        unit.source().code(),
                        unit.source().name(),
                        unit.source().unitDimension(),
                        unit.source().precision(),
                        unit.source().status()))
                .toList());
        Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> definitions = unitDefinitionFacts.requireInScopeAll(
                units.getFirst().dataNodeRef(),
                units.getFirst().brandRef(),
                units.stream().map(UnitCopy::targetRef).toList());
        for (UnitCopy unit : units) {
            CatalogOwnerApi.UnitDefinitionReadback target = definitions.get(unit.targetRef());
            if (!unit.source().code().equals(target.code())
                    || !unit.source().name().equals(target.name())
                    || !unit.source()
                            .unitDimension()
                            .equals(target.unitDimension().name())
                    || unit.source().precision() != target.precision())
                throw new CatalogOwnerApi.Problem(
                        "CATALOG_COPY_UNIT_CONFLICT",
                        422,
                        "目标计量单位与源定义不一致: " + unit.source().code());
        }
        return changes;
    }

private Map<UUID, InventoryOwnerApi.UnitSnapshot> unitSnapshotMappings(
            Map<ReferenceKey, String> mappings, List<UnitRow> units) {
        if (units == null || units.isEmpty()) return Map.of();
        Map<UUID, InventoryOwnerApi.UnitSnapshot> result = new LinkedHashMap<>();
        for (UnitRow unit : units) {
            String targetRef =
                    mappings.get(new ReferenceKey("CATALOG_UNIT", unit.ref().toString()));
            if (targetRef == null || targetRef.isBlank())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "单位复制引用未完成映射");
            try {
                result.put(
                        unit.ref(),
                        new InventoryOwnerApi.UnitSnapshot(
                                UUID.fromString(targetRef),
                                unit.code(),
                                unit.name(),
                                unit.unitDimension(),
                                unit.precision()));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "单位复制 targetRef 无效",
                        failure);
            }
        }
        return Map.copyOf(result);
    }

/**
     * Cross-owner lifecycle judgement stays at Inventory's public API; catalog never reads inventory tables directly.
     */
    private void requireSkuRetirementUnreferenced(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext, Set<UUID> archivedSkuRefs) {
        if (archivedSkuRefs.isEmpty()) return;
        if (commandContext == null || inventory == null) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    "SKU retirement requires the catalog execution context and inventory owner API");
        }
        CatalogAuthorizationScope scope = commandContext.ownerScope();
        String dataNodeRef = scope.dataNodeId().toString();
        String brandRef = scope.brandRef();
        lockProductSkuRefs(archivedSkuRefs);
        List<UUID> orderedSkuRefs = new ArrayList<>(archivedSkuRefs);
        Map<UUID, List<SkuInboundReference>> catalogReferencesBySku =
                skuInboundReferencesByRefs(dataNodeRef, brandRef, orderedSkuRefs);
        for (UUID skuRef : orderedSkuRefs) {
            List<SkuInboundReference> catalogReferences = catalogReferencesBySku.getOrDefault(skuRef, List.of());
            if (!catalogReferences.isEmpty()) {
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS_VOID", 422, "该规格已被套餐内容使用，暂不能作废");
                // spotless:on
            }
            inventory.retireCatalogVoidInventoryDefinitions(
                    commandContext,
                    new InventoryOwnerApi.CatalogVoidSubject(
                            InventoryOwnerApi.CatalogVoidSubjectKind.PRODUCT_SKU, skuRef),
                    commandContext.requestId() + "|sku-inventory|" + skuRef);
        }
    }

    private Map<UUID, List<SkuInboundReference>> skuInboundReferencesByRefs(
            String dataNodeRef, String brandRef, Collection<UUID> skuRefs) {
        List<UUID> orderedRefs = new ArrayList<>(new LinkedHashSet<>(skuRefs));
        if (orderedRefs.isEmpty()) return Map.of();
        Map<UUID, List<CatalogCopyPersistence.SkuInboundReferenceRow>> rows =
                persistence.readSkuInboundReferences(dataNodeRef, brandRef, new LinkedHashSet<>(orderedRefs));
        Map<UUID, List<SkuInboundReference>> result = new LinkedHashMap<>();
        rows.forEach((skuRef, values) -> result.put(
                skuRef,
                values.stream()
                        .map(value -> new SkuInboundReference(
                                value.componentRef(),
                                value.ownerItemRef(),
                                value.ownerCode(),
                                value.ownerName()))
                        .toList()));
        return result;
    }

/** The same transaction lock is intentionally duplicated in Inventory: foundation has no JDBC dependency. */
    private void lockProductSkuRefs(Collection<UUID> refs) {
        if (refs == null || refs.isEmpty()) return;
        persistence.lockProductSkuRefs(refs);
    }


/** Assigns server-owned SKU identities and normalizes the relation payload before the sole relational write. */
    private ArrayNode normalizeSkuFacts(ObjectNode sections) {
        JsonNode submitted = sections.path("skus");

        if (submitted.isMissingNode() || submitted.isNull()) {
            ArrayNode empty = mapper.createArrayNode();
            sections.set("skus", empty);
            return empty;
        }
        if (!submitted.isArray()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skus must be an array");
        ArrayNode skus = (ArrayNode) submitted;
        Set<UUID> refs = new LinkedHashSet<>();
        Set<String> codes = new LinkedHashSet<>();
        int defaults = 0;
        for (int index = 0; index < skus.size(); index++) {
            JsonNode value = skus.get(index);
            if (!value.isObject())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skus must contain objects");
            ObjectNode sku = (ObjectNode) value;
            if (sku.has("skuBarcode") || sku.has("barcode"))
                // spotless:off
                throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR",
                    422,
                    "规格识别信息已改为在识别信息中维护"
                );
                // spotless:on
            String rawRef = sku.path("productSkuRef").asText("").trim();
            UUID ref;
            try {
                ref = rawRef.isBlank() ? UUID.randomUUID() : UUID.fromString(rawRef);
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "productSkuRef must be UUID", failure);
            }
            if (!refs.add(ref))
                throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "productSkuRef must be unique within an item");
            sku.put("productSkuRef", ref.toString());
            String code = required(sku, "skuCode");
            if (!codes.add(code))
                throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "skuCode must be unique within an item");
            required(sku, "skuName");
            if (!sku.has("displayOrder")) sku.put("displayOrder", index);
            if (sku.path("displayOrder").asInt(-1) < 0)
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "sku displayOrder must not be negative");
            if (sku.path("isDefault").asBoolean(false)) defaults++;
            if (defaults > 1) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "only one SKU may be default");
            sku.put("variantCombinationDigest", skuVariantCombinationDigest(sku));
        }
        return skus;
    }

private ArrayNode categoryRefs(ObjectNode sections) {
        JsonNode submitted = sections.path("categoryRefs");
        if (submitted.isMissingNode() || submitted.isNull()) {
            ArrayNode empty = mapper.createArrayNode();
            sections.set("categoryRefs", empty);
            return empty;
        }
        if (!submitted.isArray())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs must be an array of UUID refs");
        return (ArrayNode) submitted;
    }

private ArrayNode compositeGroups(ObjectNode sections) {
        JsonNode submitted = sections.path("compositeGroups");
        if (submitted.isMissingNode() || submitted.isNull()) {
            ArrayNode empty = mapper.createArrayNode();
            sections.set("compositeGroups", empty);
            return empty;
        }
        if (!submitted.isArray())
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "compositeGroups must be an array");
        return (ArrayNode) submitted;
    }

private String skuVariantCombinationDigest(ObjectNode sku) {
        List<String> values = new ArrayList<>();
        JsonNode refs = sku.path("attributeValueRefs");
        if (refs.isArray())
            for (JsonNode value : refs) {
                UUID attribute = requiredUuidValue(value.path("attributeRef"), "attributeValueRefs[].attributeRef");
                UUID selected =
                        requiredUuidValue(value.path("attributeValueRef"), "attributeValueRefs[].attributeValueRef");
                values.add(attribute + ":" + selected);
            }
        Collections.sort(values);
        return digest(String.join("|", values));
    }

private CatalogOwnerApi.Problem categoryMoveProblem(String code, String message) {
        return new CatalogOwnerApi.Problem(code, 422, message);
    }

private CatalogOwnerApi.Problem categoryDepthExceededProblem() {
        return categoryMoveProblem(CATEGORY_DEPTH_ERROR_CODE, CATEGORY_DEPTH_EXCEEDED_MESSAGE);
    }

    private void lockCategoryHierarchy(String scope, String brand) {
        persistence.lockCategoryHierarchy(scope, brand);
    }

/**
     * A brand-copy category may reuse a target row with the same code. Build the exact post-copy parent map under the
     * category hierarchy lock: reused rows keep their persisted parent and only absent rows take the mapped source
     * parent. Reject instead of inventing a flattening rule.
     */
    private void assertCopiedCategoryDepth(String scope, String brand, List<CopyCategory> copiedCategories) {
        if (copiedCategories.isEmpty()) return;
        Map<UUID, UUID> effectiveParents = persistence.readEffectiveCategoryParents(scope, brand);
        for (CopyCategory copied : copiedCategories)
            effectiveParents.putIfAbsent(copied.targetRef(), copied.targetParentRef());
        for (CopyCategory copied : copiedCategories) {
            int depth = 0;
            UUID current = copied.targetRef();
            Set<UUID> visited = new LinkedHashSet<>();
            while (current != null) {
                if (!visited.add(current))
                    throw new CatalogOwnerApi.Problem("HIERARCHY_CYCLE", 422, CATEGORY_MOVE_CYCLE_MESSAGE);
                depth += 1;
                if (depth > CATALOG_CATEGORY_MAX_DEPTH) throw categoryDepthExceededProblem();
                current = effectiveParents.get(current);
            }
        }
    }

private CatalogCopyPlan catalogCopyPlan(
            String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        List<String> selected = selectedCodes(request);
        if (selected.size() > copyLimits.selectedItemCount())
            throw tooLarge("COPY_SELECTED_ITEMS_TOO_LARGE", selected.size(), copyLimits.selectedItemCount());
        CatalogClosure graph = closureGraph(sourceDataNodeRef, brandRef, selected);
        if (!graph.items().stream()
                .map(ItemRow::code)
                .collect(java.util.stream.Collectors.toSet())
                .containsAll(selected)) {
            throw new CatalogOwnerApi.Problem(
                    "NOT_FOUND", 404, "copy source item is not available in the approved scope");
        }
        if (graph.size() > copyLimits.closureItemCount())
            throw tooLarge("COPY_CLOSURE_TOO_LARGE", graph.size(), copyLimits.closureItemCount());
        long sourceVersion = scopeVersion(graph);
        TargetCopyFacts targetCopyFacts = loadTargetCopyFacts(targetDataNodeRef, brandRef, request, graph);
        TargetScopeVersions targetVersions = targetCopyFacts.versions();
        long targetVersion = targetVersions.maxVersion();
        return new CatalogCopyPlan(
                selected,
                graph,
                sourceVersion,
                targetVersion,
                targetCopyFacts,
                copyDigest(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, selected, graph, sourceVersion, targetVersion));
    }

/** Prepared execute must reject hard blocks before any target-side copy mutation begins. */
    private void rejectPreparedBlockingCompatibility(ArrayNode compatibilityResults) {
        for (JsonNode row : compatibilityResults) {
            if (!"BLOCKED".equals(row.path("result").asText())) continue;
            String problemCode = row.path("reasonCode").asText("");
            String reason = row.path("reason").asText("复制兼容性事实被阻断");
            if (problemCode.isBlank()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制预检缺少阻断原因编码");
            }
            throw new CatalogOwnerApi.Problem(problemCode, 422, reason);
        }
    }

private ObjectNode copyPreflight(String source, String target, String brandRef, CatalogCopyPlan plan) {
        return copyPreflight(source, target, brandRef, plan, null);
    }

private ObjectNode copyPreflight(
            String source,
            String target,
            String brandRef,
            CatalogCopyPlan plan,
            CopyCompatibility preparedCompatibility) {
        List<String> selected = plan.selected();
        CatalogClosure graph = plan.graph();
        long sourceVersion = plan.sourceVersion();
        long targetVersion = plan.targetVersion();
        String preflightDigest = plan.digest();
        List<ItemRow> rows = graph.items();
        ObjectNode data = mapper.createObjectNode();
        ObjectNode sourceScope = data.putObject("sourceScope")
                .put("ownerType", "HEAD_COMPANY")
                .put("ownerRef", source)
                .put("brandRef", brandRef);
        ObjectNode targetScope = data.putObject("targetScope")
                .put("ownerType", "DATA_NODE")
                .put("ownerRef", target)
                .put("brandRef", brandRef);
        data.put("selectedCount", selected.size())
                .put("selectedLimit", copyLimits.selectedItemCount())
                .put("closureCount", graph.size())
                .put("closureLimit", copyLimits.closureItemCount())
                .put("sourceVersion", sourceVersion)
                .put("targetVersion", targetVersion)
                .put("preflightDigest", preflightDigest);
        ArrayNode selectedItems = data.putArray("selectedItems");
        rows.stream().filter(row -> selected.contains(row.code())).forEach(row -> selectedItems
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", row.code())
                .put("name", row.name()));
        ArrayNode closureItems = data.putArray("closureItems");
        rows.forEach(row -> closureItems
                .addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.categories().forEach(row -> closureItems
                .addObject()
                .put("objectType", "CATALOG_CATEGORY")
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.dictionaries().forEach(row -> closureItems
                .addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.units().forEach(row -> closureItems
                .addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        graph.orderOptionDefinitions().forEach(row -> closureItems
                .addObject()
                .put("objectType", "CATALOG_ORDER_OPTION_DEFINITION")
                .put("code", row.code())
                .put("name", row.name())
                .put("action", "REUSE_OR_CREATE"));
        ArrayNode closureEdges = data.putArray("closureEdges");
        graph.edges().forEach(edge -> closureEdges
                .addObject()
                .put("fromRef", edge.fromRef())
                .put("toRef", edge.toRef())
                .put("referenceKind", edge.referenceKind()));
        ArrayNode versions = data.putArray("objectVersions");
        rows.forEach(row -> versions.addObject()
                .put("objectType", "CATALOG_ITEM")
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", targetVersion));
        TargetScopeVersions targetVersions = plan.targetCopyFacts().versions();
        Map<String, Long> preflightCategoryVersions = targetVersions.categoryVersions();
        Map<DictionaryKey, Long> preflightDictionaryVersions = targetVersions.dictionaryVersions();
        graph.categories().forEach(row -> versions.addObject()
                .put("objectType", "CATALOG_CATEGORY")
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", preflightCategoryVersions.getOrDefault(row.code(), 0L)));
        graph.dictionaries().forEach(row -> versions.addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put(
                        "targetVersion",
                        preflightDictionaryVersions.getOrDefault(
                                new DictionaryKey(row.dictionaryKind(), row.code()), 0L)));
        Map<String, Long> preflightUnitVersions = targetVersions.unitVersions();
        graph.units().forEach(row -> versions.addObject()
                .put("objectType", row.objectType())
                .put("code", row.code())
                .put("sourceVersion", row.version())
                .put("targetVersion", preflightUnitVersions.getOrDefault(row.code(), 0L)));
        ArrayNode mappings = data.putArray("mappingPreview");
        ArrayNode compatibility = data.putArray("compatibilityResults");
        ArrayNode rewrites = data.putArray("referenceRewritePreview");
        ArrayNode referenceMappings = data.putArray("referenceMappings");
        CopyCompatibility plannedCompatibility = preparedCompatibility == null
                ? validateCopyCompatibility(source, target, brandRef, graph, plan.targetCopyFacts(), null, false)
                : preparedCompatibility;
        Map<ReferenceKey, String> mapping = plannedCompatibility.mapping();
        Map<String, ItemRow> targetRows = plannedCompatibility.targetRows();
        Map<String, JsonNode> plannedCompatibilityById = new LinkedHashMap<>();
        plannedCompatibility.compatibilityResults().forEach(row -> {
            String id = row.path("compatibilityId").asText("");
            if (!id.isBlank()) plannedCompatibilityById.put(id, row);
        });
        if (preparedCompatibility != null)
            plannedCompatibility.compatibilityResults().forEach(row -> compatibility.add(row.deepCopy()));

        Map<String, ItemRow> targetItemsByRef = new LinkedHashMap<>();
        targetRows.values().forEach(row -> targetItemsByRef.put(row.ref().toString(), row));
        mapping.forEach((from, to) -> referenceMappings.add(referenceMappingRow(from, to, graph, targetItemsByRef)));
        int blockingCount = countBlockedCompatibilityRows(plannedCompatibility.compatibilityResults());
        for (ItemRow row : rows) {

            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            mappings.addObject()
                    .put("fromCode", row.code())
                    .put("toCode", row.code())
                    .put("referenceKind", "CATALOG_ITEM")
                    .put("status", check.result())
                    .set("canonicalTuple", canonicalTuple(target, brandRef, "CATALOG_ITEM", row.code()));
            if (preparedCompatibility == null) {
                JsonNode plannedItem = plannedCompatibilityById.get("CATALOG_ITEM:" + row.ref());
                if (plannedItem == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制兼容性缺少商品结果");
                }
                compatibility.add(plannedItem.deepCopy());
            }
        }
        if (preparedCompatibility == null) {
            plannedCompatibility.compatibilityResults().forEach(row -> {
                String objectType = row.path("objectType").asText("");
                if ("CATALOG_ATTRIBUTE_DEFINITION".equals(objectType)
                        || "CATALOG_ORDER_OPTION_DEFINITION".equals(objectType)) compatibility.add(row.deepCopy());
            });
        }
        graph.categories().forEach(row -> mappings.addObject()
                .put("fromCode", row.code())
                .put("toCode", row.code())
                .put("referenceKind", row.objectType())
                .put("status", "REUSE_OR_CREATE")
                .set("canonicalTuple", canonicalTuple(target, brandRef, row.objectType(), row.code())));
        graph.dictionaries().forEach(row -> mappings.addObject()
                .put("fromCode", row.code())
                .put("toCode", row.code())
                .put("referenceKind", row.objectType())
                .put("status", "REUSE_OR_CREATE")
                .set("canonicalTuple", canonicalTuple(target, brandRef, row.objectType(), canonicalParts(row, graph))));
        Map<String, UnitRow> preflightTargetUnits = plannedCompatibility.targetUnits();
        graph.units().forEach(row -> {
            JsonNode plannedUnit = plannedCompatibilityById.get("CATALOG_UNIT:" + row.ref());
            UnitRow targetUnit = preparedCompatibility == null ? preflightTargetUnits.get(row.code()) : null;
            boolean compatible = plannedUnit == null
                    ? targetUnit == null || sameUnitDefinition(row, targetUnit)
                    : !"BLOCKED".equals(plannedUnit.path("result").asText());
            mappings.addObject()
                    .put("fromCode", row.code())
                    .put("toCode", row.code())
                    .put("referenceKind", row.objectType())
                    .put("status", compatible ? "REUSE_OR_CREATE" : "BLOCKED")
                    .set(
                            "canonicalTuple",
                            canonicalTuple(
                                    target,
                                    brandRef,
                                    row.objectType(),
                                    row.code(),
                                    row.name(),
                                    row.unitDimension(),
                                    Integer.toString(row.precision())));
        });
        if (preparedCompatibility == null) {
            for (UnitRow row : graph.units()) {
                JsonNode plannedUnit = plannedCompatibilityById.get(row.objectType() + ":" + row.ref());
                if (plannedUnit == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制兼容性缺少单位结果");
                }
                compatibility.add(plannedUnit.deepCopy());
            }
        }
        graph.edges().forEach(edge -> {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET").contains(edge.referenceKind())) return;
            String objectType = copyReferenceObjectType(edge.referenceKind());
            String mappedTarget = mapping.get(new ReferenceKey(objectType, edge.toRef()));
            if (mappedTarget == null || mappedTarget.isBlank()) {
                throw new CatalogOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("复制引用未完成映射: " + edge.toRef()));
            }
            rewrites.addObject()
                    .put("sourceRef", edge.toRef())
                    .put("targetRef", mappedTarget)
                    .put("referenceKind", edge.referenceKind());
        });
        if (preparedCompatibility == null) {
            for (DictionaryRow row : graph.dictionaries()) {
                JsonNode plannedDictionary = plannedCompatibilityById.get(row.objectType() + ":" + row.ref());
                if (plannedDictionary == null) {
                    throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "复制兼容性缺少字典结果");
                }
                compatibility.add(plannedDictionary.deepCopy());
            }
        }
        // The edge copy read model always exposes an explicit skipped list,
        // even when this catalog-only preflight has no skipped sections.
        data.putArray("skipped");
        data.put("blockingCount", blockingCount)
                .put("confirmationRequiredCount", countRequiredCompatibilityRows(compatibility));
        return data;
    }

private static int countRequiredCompatibilityRows(ArrayNode compatibility) {
        int count = 0;
        for (JsonNode row : compatibility) {
            if (!"BLOCKED".equals(row.path("result").asText())) count++;
        }
        return count;
    }

private static int countBlockedCompatibilityRows(ArrayNode compatibility) {
        int count = 0;
        for (JsonNode row : compatibility) {
            if ("BLOCKED".equals(row.path("result").asText())) count++;
        }
        return count;
    }

private UUID requiredUuidValue(JsonNode value, String path) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (!value.isTextual())
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, path + " must contain UUID refs");
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, path + " cannot contain a business code", failure);
        }
    }

private LinkedHashSet<String> itemReferenceRefs(JsonNode node) {
        LinkedHashSet<String> refs = new LinkedHashSet<>();
        typedReferences(node).stream()
                .filter(ref -> Set.of("CATALOG_ITEM", "COMPOSITE_COMPONENT", "BOM_COMPONENT")
                        .contains(ref.referenceKind()))
                .forEach(ref -> refs.add(ref.ref()));
        return refs;
    }

    private Map<String, String> activeItemCodesByRef(String scope, String brand, Collection<String> refs) {
        if (refs == null || refs.isEmpty()) return Map.of();
        List<UUID> ids = new ArrayList<>();
        for (String ref : refs)
            try {
                ids.add(UUID.fromString(ref));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "itemRef must be UUID", failure);
            }
        return persistence.readProductionReferences(scope, brand, ids);
    }

private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

private void putNullableLong(ObjectNode target, String key, JsonNode value) {
        if (value != null && value.isIntegralNumber()) target.put(key, value.asLong());
        else target.putNull(key);
    }

private void putNullableLong(ObjectNode target, String key, Long value) {
        if (value == null) target.putNull(key);
        else target.put(key, value);
    }

/** Relationship rows are the only persisted source; hydrated read shapes must never leak back into sections. */
    private static void removeRelationalSectionFacts(ObjectNode sections) {
        for (String key : List.of(
                "skus",
                "categoryRefs",
                "categoryRef",
                "compositeGroups",
                "attributeAssignments",
                "orderOptionConfigs",
                "skuVariantDimensions",
                "images",
                "identifiers",
                "preparationProfile",
                "productionProfiles",
                "productionTagRef",
                "tagRefs",
                "salesUnitSnapshot",
                "baseMeasureUnitSnapshot",
                "productionTags")) {
            sections.remove(key);
        }
        sections.remove("skuSummary");
        sections.remove("ordering");
        sections.remove("listedSalePrice");
        sections.remove("missingPriceCount");
    }

/** `shortName` is a catalog_item column, never a second JSON source of truth. */
    private static String removeShortName(ObjectNode sections) {
        JsonNode shortName = sections.remove("shortName");
        if (shortName == null || shortName.isNull()) return null;
        if (!shortName.isTextual())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "shortName must be text");
        String value = shortName.asText().trim();
        return value.isEmpty() ? null : value;
    }

private static void copyNullableText(ObjectNode target, JsonNode source, String field) {
        if (source.hasNonNull(field)) target.put(field, source.path(field).asText());
        else target.putNull(field);
    }

/**
     * Write paths retain submitted/hydrated axes so the fact owner assigns omitted orders exactly once by encounter
     * order. skuVariantDimensions() is a read projection: feeding it back into a write turns two omitted axis orders
     * into two explicit zeroes.
     */
    private ArrayNode submittedSkuVariantDimensions(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return mapper.createArrayNode();
        if (!node.isArray())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "skuVariantDimensions must be an array");
        return ((ArrayNode) node).deepCopy();
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
            target.put("minSelections", group.path("minSelections").asInt(0));
            target.put("maxSelections", group.path("maxSelections").asInt(0));
            target.put("displayOrder", group.path("displayOrder").asInt(0));
            ArrayNode components = target.putArray("components");
            JsonNode sourceComponents =
                    group.path("components").isArray() ? group.path("components") : group.path("items");
            if (sourceComponents.isArray())
                sourceComponents.forEach(value -> {
                    ObjectNode entry = components.addObject();
                    String itemCode = firstText(value, "itemCode", "componentItemCode", "code");
                    entry.put("itemCode", itemCode == null ? "" : itemCode);
                    copyNullableText(entry, value, "itemRef");
                    String skuCode = firstText(value, "skuCode", "sku");
                    if (skuCode == null) entry.putNull("skuCode");
                    else entry.put("skuCode", skuCode);
                    copyNullableText(entry, value, "productSkuRef");
                    entry.put("quantity", value.path("quantity").asText("1"));
                    entry.put("unit", value.path("unit").asText(""));
                    entry.put("default", value.path("default").asBoolean(false));
                    putNullableLong(entry, "extraPrice", value.path("extraPrice"));
                    entry.put("status", value.path("status").asText("ENABLED"));
                    entry.put("displayOrder", value.path("displayOrder").asInt(0));
                });
        });
        return result;
    }

/** Post-write copy readback needs identity/version only; full hydration would recreate fan-out. */
    private List<ItemRow> loadItemIdentityRows(String dataNodeRef, String brandRef, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        return persistence.readItemIdentityRows(dataNodeRef, brandRef, codes).stream()
                .map(CatalogCopyService::itemRow)
                .toList();
    }

/**
     * The brand-copy closure starts from every source item identity, but it does not need every relation family for
     * every item. Keep the identity scan separate so the closure can decide which set reads are actually needed.
     */
    private List<ItemRow> loadAllItemIdentityRows(String dataNodeRef, String brandRef) {
        return persistence.readAllItemIdentityRows(dataNodeRef, brandRef).stream()
                .map(CatalogCopyService::itemRow)
                .toList();
    }

/**
     * Brand copy needs the same owner facts as the old full hydrate, but probing eight empty relation families is pure
     * latency for ordinary items. One presence query chooses the set reads; it does not replace any fact read when a
     * family is present, and the resulting projection remains the established copy source of truth.
     */
    private CopyClosureFacts hydrateCopyClosureFacts(String dataNodeRef, String brandRef, List<ItemRow> rows) {
        if (rows.isEmpty()) return CopyClosureFacts.empty();
        List<UUID> itemRefs = rows.stream().map(ItemRow::ref).toList();
        CopyFactPresence presence = copyFactPresence(itemRefs);
        Map<UUID, ArrayNode> skusByItem = presence.skus() ? skuFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> categoriesByItem =
                presence.categories() ? categoryFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> compositesByItem =
                presence.composites() ? compositeFacts.readByItemRefs(itemRefs) : Map.of();
        CatalogItemDefinitionFacts.CopyAttributeFacts attributeFacts = presence.attributes()
                ? itemDefinitionFacts.readCopyAttributeFacts(dataNodeRef, brandRef, itemRefs)
                : CatalogItemDefinitionFacts.CopyAttributeFacts.empty();
        Map<UUID, ArrayNode> attributeAssignmentsByItem = attributeFacts.assignmentsByItem();
        CatalogItemDefinitionFacts.CopyOrderOptionFacts orderOptionFacts = presence.orderOptions()
                ? itemDefinitionFacts.copyOrderOptionFacts(dataNodeRef, brandRef, itemRefs)
                : CatalogItemDefinitionFacts.CopyOrderOptionFacts.empty();
        Map<UUID, ArrayNode> orderOptionConfigsByItem = orderOptionFacts.configsByItem();
        Map<UUID, ArrayNode> axesByItem = presence.axes() ? skuVariantAxisFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ArrayNode> imagesByItem = presence.images() ? itemMediaFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, Map<String, JsonNode>> referencesByItem =
                presence.references() ? itemReferenceFacts.readByItemRefs(itemRefs) : Map.of();
        Map<UUID, ItemUnitRefs> unitRefsByItem = itemUnitRefsByItemRefs(itemRefs);
        Map<UUID, CatalogIdentifierFacts.ItemReadback> identifiersByItem = identifierFacts.readByItemRefs(itemRefs);
        List<UUID> skuRefs = skusByItem.values().stream()
                .filter(java.util.Objects::nonNull)
                .flatMap(array -> java.util.stream.StreamSupport.stream(array.spliterator(), false))
                .map(sku -> nullableUuid(sku, "productSkuRef"))
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<UUID, JsonNode> itemProfilesByItem = preparationFacts.readItemProfiles(itemRefs);
        Map<UUID, JsonNode> skuOverridesByRef = preparationFacts.readSkuOverrides(skuRefs);
        Map<UUID, Map<UUID, JsonNode>> optionEffectsByItem = preparationFacts.readOptionEffects(itemRefs);
        List<ItemRow> hydrated = new ArrayList<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            ArrayNode categoryRefs = categoriesByItem.getOrDefault(row.ref(), mapper.createArrayNode());
            sections.set("categoryRefs", categoryRefs);
            if (categoryRefs.isEmpty()) sections.putNull("categoryRef");
            else sections.put("categoryRef", categoryRefs.get(0).asText());
            sections.set("compositeGroups", compositesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set(
                    "attributeAssignments",
                    attributeAssignmentsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set(
                    "orderOptionConfigs", orderOptionConfigsByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("skuVariantDimensions", axesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            sections.set("images", imagesByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            ItemUnitRefs unitRefs = unitRefsByItem.get(row.ref());
            if (unitRefs == null || unitRefs.salesUnitRef() == null) sections.putNull("salesUnitRef");
            else sections.put("salesUnitRef", unitRefs.salesUnitRef().toString());
            if (unitRefs == null || unitRefs.baseMeasureUnitRef() == null) sections.putNull("baseMeasureUnitRef");
            else
                sections.put("baseMeasureUnitRef", unitRefs.baseMeasureUnitRef().toString());
            putNullableUnitSnapshot(
                    sections, "salesUnitSnapshot", unitRefs == null ? null : unitRefs.salesUnitSnapshot());
            putNullableUnitSnapshot(
                    sections, "baseMeasureUnitSnapshot", unitRefs == null ? null : unitRefs.baseMeasureUnitSnapshot());
            Map<String, JsonNode> references = referencesByItem.get(row.ref());
            sections.set(
                    "productionTagRef",
                    references == null
                            ? mapper.nullNode()
                            : references.getOrDefault(CatalogItemReferenceFacts.PRODUCTION_TAG, mapper.nullNode()));
            sections.set(
                    "tagRefs",
                    references == null
                            ? mapper.createArrayNode()
                            : references.get(CatalogItemReferenceFacts.CATALOG_TAG));
            CatalogIdentifierFacts.ItemReadback identifierReadback = identifiersByItem.get(row.ref());
            decoratePreparationFacts(
                    row.ref(),
                    sections,
                    identifierReadback,
                    itemProfilesByItem.get(row.ref()),
                    identifierReadback == null ? Map.of() : identifierReadback.skuIdentifiers(),
                    skuOverridesByRef,
                    optionEffectsByItem.getOrDefault(row.ref(), Map.of()));
            hydrated.add(new ItemRow(
                    row.ref(),
                    row.code(),
                    row.name(),
                    row.shortName(),
                    row.shapeKey(),
                    row.status(),
                    canonicalJson(sections),
                    row.version(),
                    row.updatedAt(),
                    row.sourceScopeRef()));
        }
        return new CopyClosureFacts(
                List.copyOf(hydrated),
                orderOptionFacts.definitionRefsByItem(),
                attributeFacts.definitions(),
                orderOptionFacts.definitions());
    }

private CopyFactPresence copyFactPresence(Collection<UUID> itemRefs) {
        CatalogCopyPersistence.CopyFactPresenceRow row = persistence.readCopyFactPresence(itemRefs);
        return new CopyFactPresence(
                row.skus(),
                row.categories(),
                row.composites(),
                row.attributes(),
                row.orderOptions(),
                row.axes(),
                row.images(),
                row.references());
    }

/**
     * Copy compatibility only needs the catalog item identity/shape and SKU structure. Loading the full detail
     * projection here re-reads categories, BOMs, option configs, media, references and unit snapshots that the copy
     * closure already owns. Keep the SKU relation as the one additional set-read because catalog_item.sections does not
     * persist SKU rows.
     */
    private TargetItemFacts loadCopyTargetFacts(String dataNodeRef, String brandRef, List<String> codes) {
        List<ItemRow> rows = loadItemIdentityRows(dataNodeRef, brandRef, codes);
        if (rows.isEmpty()) return new TargetItemFacts(Map.of(), 0L);
        Map<UUID, ArrayNode> skusByItem =
                skuFacts.readByItemRefs(rows.stream().map(ItemRow::ref).toList());
        Map<String, ItemRow> result = new LinkedHashMap<>();
        for (ItemRow row : rows) {
            ObjectNode sections = (ObjectNode) json(row.sectionsJson()).deepCopy();
            sections.set("skus", skusByItem.getOrDefault(row.ref(), mapper.createArrayNode()));
            result.put(
                    row.code(),
                    new ItemRow(
                            row.ref(),
                            row.code(),
                            row.name(),
                            row.shortName(),
                            row.shapeKey(),
                            row.status(),
                            canonicalJson(sections),
                            row.version(),
                            row.updatedAt(),
                            row.sourceScopeRef()));
        }
        return new TargetItemFacts(
                Map.copyOf(result),
                rows.stream().mapToLong(ItemRow::version).max().orElse(0L));
    }

/** Adds the typed identification/preparation projection without making it another persisted JSON authority. */
    private void decoratePreparationFacts(
            UUID itemRef,
            ObjectNode sections,
            CatalogIdentifierFacts.ItemReadback identifierReadback,
            JsonNode itemProfile,
            Map<UUID, ArrayNode> skuIdentifiers,
            Map<UUID, JsonNode> skuOverrides,
            Map<UUID, JsonNode> optionEffects) {
        sections.set(
                "identifiers",
                identifierReadback == null
                        ? mapper.createArrayNode()
                        : identifierReadback.itemIdentifiers().deepCopy());
        setNullableJson(sections, "preparationProfile", itemProfile);
        JsonNode skusNode = sections.path("skus");
        if (skusNode.isArray()) {
            for (JsonNode node : skusNode) {
                if (!(node instanceof ObjectNode sku)) continue;
                UUID skuRef = nullableUuid(sku, "productSkuRef");
                ArrayNode identifiers = skuIdentifiers.get(skuRef);
                sku.set("identifiers", identifiers == null ? mapper.createArrayNode() : identifiers.deepCopy());
                JsonNode storedOverride = skuRef == null ? null : skuOverrides.get(skuRef);
                if (storedOverride == null) storedOverride = sku.remove("_storedPreparationOverride");
                ObjectNode override = mapper.createObjectNode();
                String mode = storedOverride != null && storedOverride.isObject()
                        ? storedOverride.path("mode").asText("INHERIT_ITEM")
                        : "INHERIT_ITEM";
                override.put("mode", mode);
                if (storedOverride != null && storedOverride.isObject() && storedOverride.has("profile"))
                    setNullableJson(override, "profile", storedOverride.get("profile"));
                else override.putNull("profile");
                sku.set("preparationOverride", override);
                JsonNode effective =
                        "OVERRIDE".equals(mode) && override.path("profile").isObject()
                                ? override.path("profile")
                                : itemProfile;
                setNullableJson(sku, "effectivePreparation", effective);
                sku.put("preparationSource", "OVERRIDE".equals(mode) ? "SKU_OVERRIDE" : "ITEM_DEFAULT");
            }
        }
        JsonNode configsNode = sections.path("orderOptionConfigs");
        if (configsNode.isArray()) {
            for (JsonNode configNode : configsNode) {
                if (!(configNode instanceof ObjectNode config)
                        || !config.path("values").isArray()) continue;
                int groupOrder = config.path("displayOrder").asInt(0);
                for (JsonNode valueNode : config.path("values")) {
                    if (!(valueNode instanceof ObjectNode value)) continue;
                    UUID valueRef = nullableUuid(value, "definitionValueRef");
                    JsonNode storedEffect = valueRef == null ? null : optionEffects.get(valueRef);
                    // The list projection already receives the normalized effect from the same relation query as the
                    // option config.  Preserve that value when this hydrator intentionally has no separate effect
                    // map; detail hydration still replaces it with the combined preparation readback.
                    if (storedEffect == null && value.has("preparationEffect")) continue;
                    if (storedEffect == null || !storedEffect.isObject()) {
                        value.putNull("preparationEffect");
                        continue;
                    }
                    value.set(
                            "preparationEffect",
                            itemDefinitionFacts.normalizedPreparationEffect(
                                    valueRef,
                                    groupOrder,
                                    value.path("displayOrder").asInt(0),
                                    storedEffect));
                }
            }
        }
    }

private void setNullableJson(ObjectNode target, String field, JsonNode value) {
        if (value == null || value.isNull()) target.putNull(field);
        else target.set(field, value.deepCopy());
    }

private Map<UUID, ItemUnitRefs> itemUnitRefsByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        Map<UUID, CatalogCopyPersistence.ItemUnitRefsRow> rows = persistence.readItemUnitRefs(itemRefs);
        Map<UUID, ItemUnitRefs> result = new LinkedHashMap<>();
        rows.forEach((itemRef, row) -> result.put(
                itemRef,
                new ItemUnitRefs(
                        row.salesUnit() == null ? null : row.salesUnit().ref(),
                        unitSnapshot(row.salesUnit()),
                        row.baseMeasureUnit() == null ? null : row.baseMeasureUnit().ref(),
                        unitSnapshot(row.baseMeasureUnit()))));
        return result;
    }

/** Computes the catalog-owned portion of the approved typed closure in memory after set-based loads. */
    private CatalogClosure closureGraph(String dataNodeRef, String brandRef, List<String> selected) {
        CopyClosureFacts hydrated =
                hydrateCopyClosureFacts(dataNodeRef, brandRef, loadAllItemIdentityRows(dataNodeRef, brandRef));
        List<ItemRow> all = hydrated.items();
        Map<String, ItemRow> byCode = new LinkedHashMap<>();
        all.forEach(row -> byCode.put(row.code(), row));
        Map<String, ItemRow> byRef = new LinkedHashMap<>();
        all.forEach(row -> byRef.put(row.ref().toString(), row));
        Map<String, ItemRow> skuOwnerByRef = new LinkedHashMap<>();
        all.forEach(row -> {
            JsonNode skus = json(row.sectionsJson()).path("skus");
            if (skus.isArray())
                for (JsonNode sku : skus) {
                    String ref = sku.path("productSkuRef").asText("");
                    if (!ref.isBlank()) skuOwnerByRef.put(ref, row);
                }
        });
        LinkedHashSet<String> visited = new LinkedHashSet<>();
        LinkedHashSet<TypedReference> references = new LinkedHashSet<>();
        LinkedHashSet<ClosureEdge> edges = new LinkedHashSet<>();
        LinkedHashSet<UUID> unitRefs = new LinkedHashSet<>();
        Map<UUID, List<UUID>> orderOptionMaterialsByItem = itemDefinitionFacts.orderOptionMaterialItemRefsByTypedFacts(
                hydrated.orderOptionDefinitionRefsByItem(), hydrated.orderOptionDefinitions());
        ArrayList<String> queue = new ArrayList<>(selected);
        for (int index = 0; index < queue.size(); index++) {
            String code = queue.get(index);
            if (!visited.add(code)) continue;
            ItemRow row = byCode.get(code);
            if (row == null) continue;
            Set<UUID> rowUnitRefs = unitReferences(json(row.sectionsJson()));
            unitRefs.addAll(rowUnitRefs);
            for (UUID unitRef : rowUnitRefs)
                edges.add(new ClosureEdge(row.ref().toString(), unitRef.toString(), "CATALOG_UNIT"));
            for (TypedReference reference : typedReferences(json(row.sectionsJson()))) {
                references.add(reference);
                edges.add(new ClosureEdge(row.ref().toString(), reference.ref(), reference.referenceKind()));
                if (expandsCatalogItemClosure(reference.referenceKind())) {
                    ItemRow target = byRef.get(reference.ref());
                    if (target != null && !visited.contains(target.code())) queue.add(target.code());
                }
                if ("PRODUCT_SKU".equals(reference.referenceKind())) {
                    ItemRow target = skuOwnerByRef.get(reference.ref());
                    if (target != null && !visited.contains(target.code())) queue.add(target.code());
                }
            }
            // Order-option definitions are relational catalog facts. Their compulsory material products must enter
            // the ordinary item closure so the target definition template and inventory BOM can both rewrite opaque
            // references; do not serialise this relation back into item JSON.
            for (UUID materialItemRef : orderOptionMaterialsByItem.getOrDefault(row.ref(), List.of())) {
                edges.add(new ClosureEdge(row.ref().toString(), materialItemRef.toString(), "ORDER_OPTION_MATERIAL"));
                ItemRow material = byRef.get(materialItemRef.toString());
                if (material != null && !visited.contains(material.code())) queue.add(material.code());
            }
        }
        List<ItemRow> items = new ArrayList<>();
        visited.forEach(code -> {
            ItemRow row = byCode.get(code);
            if (row != null) items.add(row);
        });
        List<String> categoryRefs = references.stream()
                .filter(ref -> "CATEGORY".equals(ref.referenceKind()))
                .map(TypedReference::ref)
                .distinct()
                .toList();
        List<CategoryRow> categories = loadCategories(dataNodeRef, brandRef, categoryRefs);
        List<TypedReference> dictionaryRefs = references.stream()
                .filter(ref -> isDictionaryReference(ref.referenceKind()))
                .toList();
        List<DictionaryRow> dictionaries = loadDictionaries(dataNodeRef, brandRef, dictionaryRefs);
        Set<UUID> selectedAttributeDefinitionRefs = definitionRefs(items, "attributeAssignments");
        Map<UUID, CatalogItemDefinitionFacts.CopyAttributeDefinition> attributeDefinitions = new LinkedHashMap<>();
        selectedAttributeDefinitionRefs.forEach(ref -> {
            CatalogItemDefinitionFacts.CopyAttributeDefinition definition =
                    hydrated.attributeDefinitions().get(ref);
            if (definition != null) attributeDefinitions.put(ref, definition);
        });
        Set<UUID> selectedOrderOptionDefinitionRefs = new LinkedHashSet<>();
        items.forEach(row -> selectedOrderOptionDefinitionRefs.addAll(
                hydrated.orderOptionDefinitionRefsByItem().getOrDefault(row.ref(), List.of())));
        List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions =
                hydrated.orderOptionDefinitions().stream()
                        .filter(definition -> selectedOrderOptionDefinitionRefs.contains(definition.ref()))
                        .toList();
        for (CatalogItemDefinitionFacts.CopyOrderOptionDefinition definition : orderOptionDefinitions)
            for (CatalogItemDefinitionFacts.CopyOrderOptionValue value : definition.values())
                for (CatalogItemDefinitionFacts.CopyOrderOptionMaterial material : value.materials())
                    if (material.consumptionUnitSnapshot() != null)
                        unitRefs.add(material.consumptionUnitSnapshot().unitRef());
        for (CatalogItemDefinitionFacts.CopyOrderOptionDefinition definition : orderOptionDefinitions)
            for (CatalogItemDefinitionFacts.CopyOrderOptionValue value : definition.values())
                for (CatalogItemDefinitionFacts.CopyOrderOptionMaterial material : value.materials())
                    if (material.materialItemRef() != null && material.consumptionUnitSnapshot() != null)
                        edges.add(new ClosureEdge(
                                material.materialItemRef().toString(),
                                material.consumptionUnitSnapshot().unitRef().toString(),
                                "CATALOG_UNIT"));
        List<UnitRow> units = loadUnits(dataNodeRef, brandRef, unitRefs);
        return new CatalogClosure(
                items,
                categories,
                dictionaries,
                units,
                orderOptionDefinitions,
                attributeDefinitions,
                List.copyOf(edges));
    }

private Set<UUID> definitionRefs(List<ItemRow> rows, String sectionName) {
        Set<UUID> refs = new LinkedHashSet<>();
        for (ItemRow row : rows) {
            JsonNode section = json(row.sectionsJson()).path(sectionName);
            if (!section.isArray()) continue;
            for (JsonNode value : section) {
                String refText = value.path("definitionRef").asText("");
                if (refText.isBlank()) continue;
                try {
                    refs.add(UUID.fromString(refText));
                } catch (IllegalArgumentException failure) {
                    throw new CatalogOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            422,
                            sectionName + " definitionRef 不是有效的 opaque UUID",
                            failure);
                }
            }
        }
        return Set.copyOf(refs);
    }

private List<CategoryRow> loadCategories(String scope, String brand, List<String> categoryRefs) {
        if (categoryRefs.isEmpty()) return List.of();
        List<UUID> refs = new ArrayList<>();
        for (String categoryRef : categoryRefs) {
            try {
                refs.add(UUID.fromString(categoryRef));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "categoryRefs cannot contain a business code", failure);
            }
        }
        return persistence.readCategories(scope, brand, refs).stream()
                .map(CatalogCopyService::categoryRow)
                .toList();
    }

private Set<UUID> unitReferences(JsonNode node) {
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        collectUnitReferences(node, null, result);
        return Set.copyOf(result);
    }

private void collectUnitReferences(JsonNode node, String parentKey, Set<UUID> result) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                boolean declared = Set.of(
                                "salesUnitRef",
                                "baseMeasureUnitRef",
                                "salesUnitOverrideRef",
                                "baseMeasureUnitOverrideRef",
                                "countingUnitRef")
                        .contains(key);
                boolean snapshotRef = "unitRef".equals(key)
                        && Set.of(
                                        "salesUnitSnapshot",
                                        "baseMeasureUnitSnapshot",
                                        "consumptionUnitSnapshot",
                                        "countingUnitSnapshot")
                                .contains(parentKey);
                if ((declared || snapshotRef)
                        && value.isTextual()
                        && !value.asText().isBlank()) {
                    try {
                        result.add(UUID.fromString(value.asText()));
                    } catch (IllegalArgumentException failure) {
                        throw new CatalogOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, "商品单位引用不是 opaque UUID", failure);
                    }
                }
                collectUnitReferences(value, key, result);
            });
        } else if (node.isArray()) node.forEach(value -> collectUnitReferences(value, parentKey, result));
    }

private List<UnitRow> loadUnits(String scope, String brand, Collection<UUID> unitRefs) {
        if (unitRefs == null || unitRefs.isEmpty()) return List.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(unitRefs));
        List<UnitRow> rows = persistence.readUnits(scope, brand, new LinkedHashSet<>(refs)).stream()
                .map(CatalogCopyService::unitRow)
                .toList();
        if (rows.size() != refs.size())
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "复制所需单位定义无法完整读取");
        return rows;
    }

private List<DictionaryRow> loadDictionaries(String scope, String brand, List<TypedReference> references) {
        if (references.isEmpty()) return List.of();
        List<UUID> refs = references.stream()
                .filter(ref -> isDictionaryReference(ref.referenceKind()))
                .map(ref -> UUID.fromString(ref.ref()))
                .distinct()
                .toList();
        if (refs.isEmpty()) return List.of();
        List<DictionaryRow> candidates = persistence.readDictionaries(scope, brand, refs).stream()
                .map(CatalogCopyService::dictionaryRow)
                .toList();
        Set<UUID> requestedRefs = Set.copyOf(refs);
        return candidates.stream()
                .filter(row -> requestedRefs.contains(row.ref())

                        ? references.stream()
                                .anyMatch(ref -> ref.ref().equals(row.ref().toString())
                                        && dictionaryKindMatches(ref.referenceKind(), row.dictionaryKind()))
                        : candidates.stream()
                                .anyMatch(child -> requestedRefs.contains(child.ref())
                                        && row.ref().equals(child.parentEntryRef())))
                .toList();
    }

private static int parsePageSize(ObjectNode request, String key, int fallback) {
        try {
            return CollectionRequestSupport.pageSize(request, key, fallback);
        } catch (CollectionRequestSupport.InvalidRequestValue failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, failure.getMessage(), failure);
        }
    }

private static OpaqueCollectionCursor.Position decodeCollectionCursor(ObjectNode request, String queryIdentity) {
        try {
            return OpaqueCollectionCursor.decode(optional(request, "cursor"), queryIdentity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
    }

private static String cursorIdentity(String operationId, String... parts) {
        String[] components = new String[parts.length + 1];
        components[0] = operationId;
        System.arraycopy(parts, 0, components, 1, parts.length);
        return CanonicalCursorIdentity.encode(components);
    }

private List<TypedReference> typedReferences(JsonNode node) {
        LinkedHashSet<TypedReference> result = new LinkedHashSet<>();
        addDeclaredArrayRefs(result, node.path("categoryRefs"), "CATEGORY");
        addDeclaredArrayRefs(result, node.path("tagRefs"), "TAG");
        addDeclaredRef(result, node.path("productionTagRef"), "PRODUCTION_TAG");
        if (node.path("skuVariantDimensions").isArray())
            for (JsonNode dimension : node.path("skuVariantDimensions")) {
                addDeclaredRef(result, dimension.path("attributeRef"), "SKU_ATTRIBUTE");
                if (dimension.path("values").isArray())
                    for (JsonNode value : dimension.path("values"))
                        addDeclaredRef(result, value.path("valueRef"), "SKU_ATTRIBUTE_VALUE");
            }
        if (node.path("skus").isArray())
            for (JsonNode sku : node.path("skus")) {
                addDeclaredRef(result, sku.path("productSkuRef"), "PRODUCT_SKU");
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs"))
                        addDeclaredRef(result, value.path("attributeValueRef"), "SKU_ATTRIBUTE_VALUE");
            }
        if (node.path("compositeGroups").isArray())
            for (JsonNode group : node.path("compositeGroups"))
                if (group.path("components").isArray())
                    for (JsonNode component : group.path("components")) {
                        addDeclaredRef(result, component.path("itemRef"), "COMPOSITE_COMPONENT");
                        addDeclaredRef(result, component.path("productSkuRef"), "PRODUCT_SKU");
                    }
        return List.copyOf(result);
    }

private void addDeclaredArrayRefs(LinkedHashSet<TypedReference> result, JsonNode values, String kind) {
        if (values.isArray()) values.forEach(value -> addDeclaredRef(result, value, kind));
    }

private void addDeclaredRef(LinkedHashSet<TypedReference> result, JsonNode value, String kind) {
        if (value != null && value.isTextual() && !value.asText().isBlank())
            result.add(new TypedReference(kind, value.asText()));
    }

private boolean isDictionaryReference(String kind) {
        return Set.of("TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE")
                .contains(kind);
    }

private boolean dictionaryKindMatches(String referenceKind, String dictionaryKind) {
        return switch (referenceKind) {
            case "TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE" -> referenceKind.equals(
                    dictionaryKind);
            default -> false;
        };
    }

private ObjectNode receiptRequest(ObjectNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

private JsonNode replay(String dataNodeRef, String key, String operationId, ObjectNode request) {
        persistence.lockReceipt(dataNodeRef, key);
        List<CatalogCopyPersistence.ReceiptRow> rows = persistence.readReceipt(dataNodeRef, key);
        if (rows.isEmpty()) return null;
        CatalogCopyPersistence.ReceiptRow receipt = rows.get(0);
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request)))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return json(receipt.responseJson());
    }

private void saveReceipt(String scope, String key, String op, ObjectNode request, JsonNode response) {
        persistence.saveReceipt(
                scope,
                key,
                op,
                hash(request),
                canonicalJson(response),
                now());
    }

private long generation(String dataNodeRef, String brandRef) {
        return persistence.generation(dataNodeRef, brandRef);
    }

private static void requireScope(String dataNodeRef, String brandRef) {
        if (dataNodeRef == null || dataNodeRef.isBlank() || brandRef == null || brandRef.isBlank())
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

private static CatalogAuthorizationScope requireTypedContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String expectedOwner) {
        if (context == null
                || context.operationToken() == null
                || context.ownerScope() == null
                || context.ownerGrant() == null
                || context.workspaceUuid() == null
                || context.groupWorkspaceKey() == null
                || context.groupWorkspaceKey().isBlank()
                || !"operations-admin".equals(context.consumerFace())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog execution context is required");
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner())
                || scope.dataNodeId() == null
                || scope.brandRef() == null
                || scope.brandRef().isBlank()
                || !token.allowedDataNodeTypes().contains(scope.dataNodeType())
                || capability == null
                || !context.ownerGrant()
                        .verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog execution context is not authorized");
        }
        return scope;
    }

private static String copySourceDataNodeRef(CatalogAuthorizationScope scope) {
        return switch (scope.copySourcePolicy()) {
            case TARGET_SCOPE -> scope.dataNodeId().toString();
            case ORGANIZATION_JUDGMENT -> {
                if (scope.copySourceDataNodeId() == null)
                    throw new CatalogOwnerApi.Problem(
                            "SCOPE_FORBIDDEN", 403, "catalog copy source judgment is required");
                yield scope.copySourceDataNodeId().toString();
            }
            default -> throw new CatalogOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "catalog copy source policy is not authorized");
        };
    }

private static String required(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

private static String required(JsonNode request, String key) {
        String value = request == null ? "" : request.path(key).asText("");
        if (value.isBlank()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

private static String optional(ObjectNode request, String key) {
        return CollectionRequestSupport.optional(request, key);
}

private static long requiredLong(ObjectNode request, String key, long fallback) {
        JsonNode value = request.get(key);
        if (value == null || !value.isIntegralNumber()) return fallback;
        return value.asLong();
    }

private static long requiredLong(JsonNode request, String key, long fallback) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || !value.isIntegralNumber() ? fallback : value.asLong();
    }

private String canonicalJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value == null ? mapper.createObjectNode() : value);
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", ex);
        }
    }

private JsonNode json(String value) {
        if (value == null || value.isBlank()) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is missing");
        }
        try {
            JsonNode parsed = mapper.readTree(value);
            if (parsed == null || parsed.isNull()) {
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is missing");
            }
            return parsed;
        } catch (CatalogOwnerApi.Problem problem) {
            throw problem;
        } catch (Exception ex) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is invalid", ex);
        }
    }

private String hash(JsonNode value) {
        return digest(canonicalJson(value));
    }

private static String digest(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

private long now() {
        return time.currentEpochMillis();
    }

private CatalogOwnerApi.Problem tooLarge(String code, int actual, int limit) {
        return new CatalogOwnerApi.Problem(code, 422, code + " actual=" + actual + " limit=" + limit);
    }

private List<String> selectedCodes(ObjectNode request) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        JsonNode values = request.get("selectedItemCodes");
        if (values != null && values.isArray())
            values.forEach(v -> {
                if (v.isTextual()) result.add(v.asText());
            });
        String single = optional(request, "sourceItemCode");
        if (single != null) result.add(single);
        if (result.isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "copy selection is required");
        return List.copyOf(result);
    }

private Set<String> selectedSectionsElements(ArrayNode values) {
        Set<String> result = new java.util.HashSet<>();
        values.forEach(value -> {
            if (value.isTextual()) result.add(value.asText());
        });
        return result;
    }

private long scopeVersion(List<ItemRow> rows) {
        return rows.stream().mapToLong(ItemRow::version).max().orElse(0L);
    }

private long scopeVersion(CatalogClosure graph) {
        return graph.objects().stream().mapToLong(CatalogObject::version).max().orElse(0L);
    }

    private long targetScopeVersion(String target, String brand, ObjectNode request, List<ItemRow> source) {
        String targetCode = optional(request, "targetItemCode");
        if (targetCode != null) {
            return persistence.targetItemVersion(target, brand, targetCode);
        }
        return persistence.maxTargetItemVersion(target, brand, source.stream().map(ItemRow::code).toList());
    }

private long targetScopeVersion(String target, String brand, ObjectNode request, CatalogClosure graph) {
        return targetScopeVersions(target, brand, request, graph).maxVersion();
    }

/**
     * Loads the target facts used by one copy request. Item/SKU identity, active reference mappings and the version
     * projections are kept together so compatibility and the preflight payload consume the same read. The post-write
     * targetScopeVersion path remains a fresh readback and is intentionally not routed here.
     */
    private TargetCopyFacts loadTargetCopyFacts(String target, String brand, ObjectNode request, CatalogClosure graph) {
        TargetItemFacts targetItems = loadCopyTargetFacts(
                target, brand, graph.items().stream().map(ItemRow::code).toList());
        TargetCategoryFacts targetCategories = targetCategoryFacts(target, brand, graph.categories());
        TargetDictionaryFacts targetDictionaries = targetDictionaryFacts(target, brand, graph.dictionaries());
        Map<String, UnitRow> targetUnits = targetUnitsByCode(target, brand, graph.units());
        Map<String, Long> unitVersions = new LinkedHashMap<>();
        targetUnits.forEach((code, row) -> unitVersions.put(code, row.version()));

        long maxVersion = optional(request, "targetItemCode") == null
                ? targetItems.maxVersion()
                : targetScopeVersion(target, brand, request, graph.items());
        for (long version : targetCategories.versions().values()) maxVersion = Math.max(maxVersion, version);
        for (long version : targetDictionaries.versions().values()) maxVersion = Math.max(maxVersion, version);
        for (long version : unitVersions.values()) maxVersion = Math.max(maxVersion, version);
        return new TargetCopyFacts(
                targetItems.rows(),
                targetCategories.refs(),
                targetDictionaries.refs(),
                targetUnits,
                new TargetScopeVersions(
                        maxVersion, targetCategories.versions(), targetDictionaries.versions(), unitVersions));
    }

/**
     * Loads target versions afresh for the post-write readback. The copy-plan path uses TargetCopyFacts so these reads
     * remain outside the request-local preflight snapshot and cannot hide a target-side change after writes.
     */
    private TargetScopeVersions targetScopeVersions(
            String target, String brand, ObjectNode request, CatalogClosure graph) {
        long max = targetScopeVersion(target, brand, request, graph.items());
        Map<String, Long> categoryVersions = targetCategoryVersions(target, brand, graph.categories());
        for (CategoryRow row : graph.categories()) max = Math.max(max, categoryVersions.getOrDefault(row.code(), 0L));
        Map<DictionaryKey, Long> dictionaryVersions = targetDictionaryVersions(target, brand, graph.dictionaries());
        for (DictionaryRow row : graph.dictionaries()) {
            DictionaryKey key = new DictionaryKey(row.dictionaryKind(), row.code());
            max = Math.max(max, dictionaryVersions.getOrDefault(key, 0L));
        }
        Map<String, Long> unitVersions = targetUnitVersions(target, brand, graph.units());
        for (UnitRow row : graph.units()) max = Math.max(max, unitVersions.getOrDefault(row.code(), 0L));
        return new TargetScopeVersions(max, categoryVersions, dictionaryVersions, unitVersions);
    }

    private Map<String, Long> targetCategoryVersions(String target, String brand, List<CategoryRow> rows) {
        List<String> codes = rows.stream().map(CategoryRow::code).distinct().toList();
        return persistence.targetCategoryVersions(target, brand, codes);
    }

    private Map<DictionaryKey, Long> targetDictionaryVersions(String target, String brand, List<DictionaryRow> rows) {
        List<DictionaryKey> keys = rows.stream()
                .map(row -> new DictionaryKey(row.dictionaryKind(), row.code()))
                .distinct()
                .toList();
        Map<CatalogCopyPersistence.DictionaryVersionKey, Long> versions = persistence.targetDictionaryVersions(
                target,
                brand,
                keys.stream()
                        .map(key -> new CatalogCopyPersistence.DictionaryVersionKey(key.kind(), key.code()))
                        .toList());
        Map<DictionaryKey, Long> result = new LinkedHashMap<>();
        versions.forEach((key, version) -> result.put(new DictionaryKey(key.dictionaryKind(), key.code()), version));
        return result;
    }

    private Map<String, Long> targetUnitVersions(String target, String brand, List<UnitRow> rows) {
        if (rows == null || rows.isEmpty()) return Map.of();
        List<String> codes = rows.stream().map(UnitRow::code).distinct().toList();
        return persistence.targetUnitVersions(target, brand, codes);
    }

    private TargetCategoryFacts targetCategoryFacts(String target, String brand, List<CategoryRow> rows) {
        List<String> codes = rows.stream().map(CategoryRow::code).distinct().toList();
        List<CatalogCopyPersistence.TargetCategoryRow> candidates = persistence.targetCategoryFacts(target, brand, codes);
        Map<String, UUID> refs = new LinkedHashMap<>();
        Map<String, Long> versions = new LinkedHashMap<>();
        for (CatalogCopyPersistence.TargetCategoryRow row : candidates) {
            versions.merge(row.code(), row.version(), Math::max);
            if (row.status() != null && !"VOIDED".equals(row.status())
                    && refs.putIfAbsent(row.code(), row.categoryRef()) != null)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "目标分类编码引用不唯一: " + row.code());
        }
        return new TargetCategoryFacts(Map.copyOf(refs), Map.copyOf(versions));
    }

    private TargetDictionaryFacts targetDictionaryFacts(String target, String brand, List<DictionaryRow> rows) {
        List<DictionaryKey> keys = rows.stream()
                .map(row -> new DictionaryKey(row.dictionaryKind(), row.code()))
                .distinct()
                .toList();
        List<CatalogCopyPersistence.TargetDictionaryRow> candidates = persistence.targetDictionaryFacts(
                target,
                brand,
                keys.stream()
                        .map(key -> new CatalogCopyPersistence.DictionaryVersionKey(key.kind(), key.code()))
                        .toList());
        Map<DictionaryKey, UUID> refs = new LinkedHashMap<>();
        Map<DictionaryKey, Long> versions = new LinkedHashMap<>();
        for (CatalogCopyPersistence.TargetDictionaryRow row : candidates) {
            DictionaryKey key = new DictionaryKey(row.dictionaryKind(), row.code());
            versions.merge(key, row.version(), Math::max);
            if (row.status() != null && !"VOIDED".equals(row.status())
                    && refs.putIfAbsent(key, row.entryRef()) != null) {
                String failureMessage = "目标字典编码引用不唯一: " + key.code();
                throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage);
            }
        }
        return new TargetDictionaryFacts(Map.copyOf(refs), Map.copyOf(versions));
    }

private Object[] concatArgs(Class<?> ignored, String target, String brand, List<ItemRow> source) {
        ArrayList<Object> args = new ArrayList<>();
        args.add(target);
        args.add(brand);
        source.forEach(row -> args.add(row.code()));
        return args.toArray();
    }

private String copyDigest(
            String source,
            String target,
            String brandRef,
            List<String> selected,
            CatalogClosure graph,
            long sourceVersion,
            long targetVersion) {
        ArrayList<String> identities = new ArrayList<>();
        graph.objects()
                .forEach(row -> identities.add(row.objectType() + ":" + row.code() + ":" + row.version()
                        + (row instanceof ItemRow item
                                ? ":" + skuStructureFingerprint(json(item.sectionsJson()))
                                : "")));
        Collections.sort(identities);
        ArrayList<String> codes = new ArrayList<>(selected);
        Collections.sort(codes);
        String attributeDefinitions = itemDefinitionFacts.attributeCopyFingerprint(
                graph.attributeDefinitions().values());
        String orderOptionDefinitions = itemDefinitionFacts.orderOptionCopyFingerprint(graph.orderOptionDefinitions());
        return digest(source + "|" + target + "|" + String.join(",", codes) + "|" + String.join(",", identities) + "|"
                + attributeDefinitions + "|" + orderOptionDefinitions + "|" + sourceVersion + "|" + targetVersion);
    }

/**
     * The copy plan is keyed only by source opaque refs. A code may locate an equivalent target fact, but it never
     * becomes the relation identity or a rewrite key. On execute, the preflight plan is supplied back by the
     * coordinator and must agree with any target fact that already exists.
     */
    private CopyCompatibility validateCopyCompatibility(
            String source,
            String target,
            String brand,
            CatalogClosure graph,
            TargetCopyFacts targetCopyFacts,
            ObjectNode request,
            boolean rejectBlocking) {
        Map<ReferenceKey, String> supplied = suppliedReferenceMappings(request);
        Map<ReferenceKey, String> mapping = new LinkedHashMap<>();
        ArrayNode compatibilityResults = mapper.createArrayNode();
        Map<String, ItemRow> targetRows = targetCopyFacts.targetRows();
        for (ItemRow row : graph.items()) {
            ItemRow existing = targetRows.get(row.code());
            mapping.put(
                    new ReferenceKey("CATALOG_ITEM", row.ref().toString()),
                    targetRefFor(
                            new ReferenceKey("CATALOG_ITEM", row.ref().toString()),
                            existing == null ? null : existing.ref(),
                            supplied));
        }
        Map<String, UUID> targetCategoryRefs = targetCopyFacts.categoryRefs();
        for (CategoryRow row : graph.categories()) {
            UUID existing = targetCategoryRefs.get(row.code());
            mapping.put(
                    new ReferenceKey("CATALOG_CATEGORY", row.ref().toString()),
                    targetRefFor(new ReferenceKey("CATALOG_CATEGORY", row.ref().toString()), existing, supplied));
        }
        Map<DictionaryKey, UUID> targetDictionaryRefs = targetCopyFacts.dictionaryRefs();
        for (DictionaryRow row : graph.dictionaries()) {
            UUID existing = targetDictionaryRefs.get(new DictionaryKey(row.dictionaryKind(), row.code()));
            mapping.put(
                    new ReferenceKey(row.objectType(), row.ref().toString()),
                    targetRefFor(new ReferenceKey(row.objectType(), row.ref().toString()), existing, supplied));
        }
        Map<String, UnitRow> targetUnits = targetCopyFacts.targetUnits();
        for (UnitRow row : graph.units()) {
            UnitRow existing = targetUnits.get(row.code());
            ReferenceKey key = new ReferenceKey("CATALOG_UNIT", row.ref().toString());
            mapping.put(key, targetRefFor(key, existing == null ? null : existing.ref(), supplied));
            if (existing != null && !sameUnitDefinition(row, existing) && rejectBlocking)
                throw new CatalogOwnerApi.Problem(
                        "CATALOG_COPY_UNIT_CONFLICT",
                        422,
                        /* format-wrap */
                        "同编码计量单位的名称、类别或精度不一致: " + row.code());
            boolean blocked = existing != null && !sameUnitDefinition(row, existing);
            String compatibilityReason;
            if (blocked) compatibilityReason = "同编码计量单位的名称、类别或精度不一致";
            else if (existing == null) compatibilityReason = "目标不存在，将创建";
            else compatibilityReason = "编码与语义兼容，可复用";
            compatibilityResults.add(compatibilityResult(
                    row.objectType(),
                    row.objectType() + ":" + row.ref(),
                    blocked ? "BLOCKED" : existing == null ? "CREATE" : "REUSE",
                    compatibilityReason,
                    blocked
                            ? "CATALOG_COPY_UNIT_CONFLICT"
                            : existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED",
                    canonicalTuple(
                            target,
                            brand,

                            row.objectType(),
                            row.code(),
                            row.name(),
                            row.unitDimension(),
                            Integer.toString(row.precision()))));
        }
        for (ItemRow row : graph.items()) {
            ItemRow existing = targetRows.get(row.code());
            Map<String, UUID> existingSkuRefs =
                    existing == null ? Map.of() : skuRefsByCode(json(existing.sectionsJson()));

            for (JsonNode sourceSku : rawSkuRows(json(row.sectionsJson()))) {
                String sourceSkuRef = sourceSku.path("productSkuRef").asText("");
                String skuCode = firstText(sourceSku, "skuCode", "code");
                if (sourceSkuRef.isBlank() || skuCode == null || skuCode.isBlank()) continue;
                mapping.put(
                        new ReferenceKey("PRODUCT_SKU", sourceSkuRef),
                        targetRefFor(
                                new ReferenceKey("PRODUCT_SKU", sourceSkuRef), existingSkuRefs.get(skuCode), supplied));
            }
        }
        CatalogItemDefinitionFacts.OrderOptionCopyPlan orderOptionPlan = itemDefinitionFacts.planOrderOptionCopy(
                source,
                brand,
                target,
                brand,
                graph.orderOptionDefinitions(),
                uuidMappings(mapping, "CATALOG_ITEM"),
                uuidMappings(supplied, "CATALOG_ORDER_OPTION_DEFINITION"),
                uuidMappings(supplied, "CATALOG_ORDER_OPTION_DEFINITION_VALUE"));
        orderOptionPlan
                .definitionMappings()
                .forEach((from, to) -> mapping.put(
                        new ReferenceKey("CATALOG_ORDER_OPTION_DEFINITION", from.toString()), to.toString()));
        orderOptionPlan
                .valueMappings()
                .forEach((from, to) -> mapping.put(
                        new ReferenceKey("CATALOG_ORDER_OPTION_DEFINITION_VALUE", from.toString()), to.toString()));
        for (String code : orderOptionPlan.conflictCodes())
            compatibilityResults.add(compatibilityResult(
                    "CATALOG_ORDER_OPTION_DEFINITION",
                    "CATALOG_ORDER_OPTION_DEFINITION:" + code,
                    "BLOCKED",
                    "同编码点单选项定义的选择方式、选项或扣料原料不一致",
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    canonicalTuple(target, brand, "CATALOG_ORDER_OPTION_DEFINITION", code)));
        for (DictionaryRow row : graph.dictionaries())
            compatibilityResults.add(compatibilityResult(
                    row.objectType(),
                    row.objectType() + ":" + row.ref(),
                    "REUSE_OR_CREATE",
                    "按编码复用或创建",
                    "REUSE_CONFIRMATION_REQUIRED",
                    canonicalTuple(target, brand, row.objectType(), canonicalParts(row, graph))));
        // Production owns the target tag fact.  Catalog only accepts the public
        // owner-produced mapping carried by the coordinator; it never probes the
        // production schema nor invents a target tag UUID.
        supplied.forEach((key, value) -> {
            if ("PRODUCTION_TAG".equals(key.objectType())) mapping.put(key, value);
        });
        for (ItemRow row : graph.items()) {
            CompatibilityCheck check = compatibilityCheck(row, targetRows.get(row.code()), graph, mapping);
            compatibilityResults.add(compatibilityResult(
                    "CATALOG_ITEM",
                    "CATALOG_ITEM:" + row.ref(),
                    check.result(),
                    check.reason(),
                    check.reasonCode(),
                    canonicalTuple(target, brand, "CATALOG_ITEM", row.code())));
            if (rejectBlocking && check.blocking())
                throw new CatalogOwnerApi.Problem(check.problemCode(), 422, check.reason() + ": " + row.code());
        }
        List<String> attributeConflicts = itemDefinitionFacts.attributeCopyConflictCodes(
                target, brand, graph.attributeDefinitions().values());
        for (String code : attributeConflicts)
            compatibilityResults.add(compatibilityResult(
                    "CATALOG_ATTRIBUTE_DEFINITION",
                    "CATALOG_ATTRIBUTE_DEFINITION:" + code,
                    "BLOCKED",
                    "同编码商品属性定义的类型或选项不一致",
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    canonicalTuple(target, brand, "CATALOG_ATTRIBUTE_DEFINITION", code)));
        if (rejectBlocking && !attributeConflicts.isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    422,
                    "同编码商品属性定义的类型或选项不一致: " + String.join(",", attributeConflicts));
        if (rejectBlocking && !orderOptionPlan.conflictCodes().isEmpty())
            throw new CatalogOwnerApi.Problem(
                    "CATALOG_COPY_DEFINITION_CONFLICT",
                    422,
                    "同编码点单选项定义的选择方式、选项或扣料原料不一致:" + " " +
                            /* format-wrap */
                            String.join(",", orderOptionPlan.conflictCodes()));
        return new CopyCompatibility(
                Map.copyOf(mapping), compatibilityResults, Map.copyOf(targetRows), Map.copyOf(targetUnits));
    }

private ObjectNode compatibilityResult(
            String objectType,
            String compatibilityId,
            String result,
            String reason,
            String reasonCode,
            ObjectNode canonicalTuple) {
        return mapper.createObjectNode()
                .put("objectType", objectType)
                .put("compatibilityId", compatibilityId)
                .put("result", result)
                .put("reason", reason)
                .put("reasonCode", reasonCode)
                .set("canonicalTuple", canonicalTuple);
    }

    private Map<String, UnitRow> targetUnitsByCode(String target, String brand, List<UnitRow> sourceUnits) {
        if (sourceUnits == null || sourceUnits.isEmpty()) return Map.of();
        List<String> codes = sourceUnits.stream().map(UnitRow::code).distinct().toList();
        Map<String, UnitRow> result = new LinkedHashMap<>();
        for (CatalogCopyPersistence.UnitRow row : persistence.targetUnitsByCode(target, brand, codes)) {
            UnitRow mapped = unitRow(row);
            if (result.putIfAbsent(mapped.code(), mapped) != null)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "目标单位编码引用不唯一: " + mapped.code());
        }
        return result;
    }

private boolean sameUnitDefinition(UnitRow source, UnitRow target) {
        return source.code().equals(target.code())
                && source.name().equals(target.name())
                && source.unitDimension().equals(target.unitDimension())
                && source.precision() == target.precision();
    }

private static Map<UUID, UUID> uuidMappings(Map<ReferenceKey, String> mappings, String objectType) {
        Map<UUID, UUID> result = new LinkedHashMap<>();
        for (Map.Entry<ReferenceKey, String> entry : mappings.entrySet()) {
            if (!objectType.equals(entry.getKey().objectType())) continue;
            try {
                result.put(UUID.fromString(entry.getKey().ref()), UUID.fromString(entry.getValue()));
            } catch (IllegalArgumentException invalid) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "复制引用不是有效的 opaque UUID", invalid);
            }
        }
        return Map.copyOf(result);
    }

private Map<ReferenceKey, String> suppliedReferenceMappings(ObjectNode request) {
        if (request == null || !request.path("referenceMappings").isArray()) return Map.of();
        Map<ReferenceKey, String> result = new LinkedHashMap<>();
        for (JsonNode value : request.path("referenceMappings")) {
            if (!value.isObject())
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings must contain objects");
            String objectType = value.path("objectType").asText("");
            String sourceRef = opaqueCopyRef(value, "sourceRef");
            String targetRef = opaqueCopyRef(value, "targetRef");
            ReferenceKey key = new ReferenceKey(objectType, sourceRef);
            if (result.putIfAbsent(key, targetRef) != null)
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "referenceMappings contains duplicate source object reference");
        }
        return Map.copyOf(result);
    }

private String targetRefFor(ReferenceKey source, UUID existing, Map<ReferenceKey, String> supplied) {
        String planned = supplied.get(source);
        if (existing != null) {
            if (planned != null && !existing.toString().equals(planned)) {
                throw new CatalogOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("预检 targetRef 与已存在目标事实不一致"));
            }
            return existing.toString();
        }
        return planned == null ? UUID.randomUUID().toString() : planned;
    }

private String opaqueCopyRef(JsonNode value, String key) {
        try {
            return UUID.fromString(value.path(key).asText("")).toString();
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", failure);
        }
    }

private List<JsonNode> rawSkuRows(JsonNode sections) {
        if (sections == null || !sections.path("skus").isArray()) return List.of();
        List<JsonNode> rows = new ArrayList<>();
        sections.path("skus").forEach(rows::add);
        return rows;
    }

private Map<String, UUID> skuRefsByCode(JsonNode sections) {
        Map<String, UUID> result = new LinkedHashMap<>();
        for (JsonNode sku : rawSkuRows(sections)) {
            String code = firstText(sku, "skuCode", "code");
            String ref = sku.path("productSkuRef").asText("");
            if (code == null || code.isBlank() || ref.isBlank()) continue;
            try {
                result.put(code, UUID.fromString(ref));
            } catch (IllegalArgumentException failure) {
                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "target productSkuRef must be UUID", failure);
            }
        }
        return result;
    }

private CompatibilityCheck compatibilityCheck(
            ItemRow source, ItemRow existing, CatalogClosure graph, Map<ReferenceKey, String> mapping) {
        if (existing != null && !existing.shapeKey().equals(source.shapeKey()))
            return new CompatibilityCheck(
                    "BLOCKED", "商品形态结构不兼容", "STRUCTURE_INCOMPATIBLE", "STRUCTURE_INCOMPATIBLE", true);
        String sourceSkuStructure = skuStructureFingerprint(json(source.sectionsJson()));
        String targetSkuStructure = existing == null ? null : skuStructureFingerprint(json(existing.sectionsJson()));
        if (existing != null && !sourceSkuStructure.equals(targetSkuStructure))
            return new CompatibilityCheck(
                    "BLOCKED",
                    "规格结构不一致",
                    "STRUCTURE_INCOMPATIBLE",
                    "SKU_STRUCTURE_INCOMPATIBLE",
                    /* format-wrap */
                    true);
        for (TypedReference ref : typedReferences(json(source.sectionsJson()))) {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET", "SKU").contains(ref.referenceKind())) continue;
            ReferenceKey key = new ReferenceKey(copyReferenceObjectType(ref.referenceKind()), ref.ref());
            if (!mapping.containsKey(key))
                return new CompatibilityCheck(
                        "BLOCKED",
                        "商品引用无法重写",
                        "REFERENCE_MAPPING_UNRESOLVED",
                        /* format-wrap */
                        "REFERENCE_MAPPING_UNRESOLVED",
                        true);
        }
        return new CompatibilityCheck(
                existing == null ? "CREATE" : "REUSE",
                existing == null ? "目标不存在，将创建" : "编码与结构兼容，可复用",
                null,
                existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED",
                false);
    }

private ObjectNode canonicalTuple(String ownerRef, String brandRef, String objectType, String... parts) {
        ObjectNode tuple = mapper.createObjectNode()
                .put("ownerRef", ownerRef)
                .put("brandRef", brandRef)
                .put("objectType", objectType);
        ArrayNode values = tuple.putArray("parts");
        for (String part : parts) values.add(part == null ? "" : part);
        return tuple;
    }

private ObjectNode canonicalTuple(String ownerRef, String brandRef, String objectType, List<String> parts) {
        ObjectNode tuple = mapper.createObjectNode()
                .put("ownerRef", ownerRef)
                .put("brandRef", brandRef)
                .put("objectType", objectType);
        ArrayNode values = tuple.putArray("parts");
        parts.forEach(part -> values.add(part == null ? "" : part));
        return tuple;
    }

private List<String> canonicalParts(DictionaryRow row, CatalogClosure graph) {
        if ("SKU_ATTRIBUTE_VALUE".equals(row.dictionaryKind()) && row.parentEntryRef() != null) {
            DictionaryRow parent = graph.dictionaries().stream()
                    .filter(candidate -> row.parentEntryRef().equals(candidate.ref()))
                    .findFirst()
                    .orElse(null);
            if (parent == null)

                throw new CatalogOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "SKU 属性值的父属性未进入复制闭包: " + row.code());
            return List.of(parent.code(), row.code());
        }
        return List.of(row.code());
    }

/**
     * Builds read labels from the scoped target fact where it exists; for a planned CREATE the copied source's
     * immutable code is the planned target label.
     */
    private ObjectNode referenceMappingRow(
            ReferenceKey source, String targetRef, CatalogClosure graph, Map<String, ItemRow> targetItemsByRef) {
        ObjectNode row = mapper.createObjectNode()
                .put("objectType", source.objectType())
                .put("sourceRef", source.ref())
                .put("targetRef", targetRef);
        String targetCode = null;
        String targetSkuCode = null;
        String targetOptionValueCode = null;
        UnitRow sourceUnit = null;
        if ("CATALOG_ITEM".equals(source.objectType())) {
            ItemRow target = targetItemsByRef.get(targetRef);
            ItemRow sourceItem = graph.items().stream()
                    .filter(item -> item.ref().toString().equals(source.ref()))
                    .findFirst()
                    .orElse(null);
            targetCode = target == null ? sourceItem == null ? null : sourceItem.code() : target.code();
        } else if ("PRODUCT_SKU".equals(source.objectType())) {
            for (ItemRow item : graph.items())
                for (JsonNode sku : rawSkuRows(json(item.sectionsJson()))) {
                    if (source.ref().equals(sku.path("productSkuRef").asText())) {
                        targetSkuCode = firstText(sku, "skuCode", "code");
                        break;
                    }
                    if (targetSkuCode != null) break;
                }
        } else if ("SKU_ATTRIBUTE_VALUE".equals(source.objectType())) {
            targetOptionValueCode = optionValueCodeForRef(graph, source.ref());
            if (targetOptionValueCode == null)
                targetOptionValueCode = graph.dictionaries().stream()
                        .filter(value -> value.ref().toString().equals(source.ref()))
                        .map(DictionaryRow::code)
                        .findFirst()
                        .orElse(null);
        } else if ("CATALOG_ORDER_OPTION_DEFINITION".equals(source.objectType())) {
            targetCode = graph.orderOptionDefinitions().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .map(CatalogItemDefinitionFacts.CopyOrderOptionDefinition::code)
                    .findFirst()
                    .orElse(null);
        } else if ("CATALOG_ORDER_OPTION_DEFINITION_VALUE".equals(source.objectType())) {
            for (CatalogItemDefinitionFacts.CopyOrderOptionDefinition definition : graph.orderOptionDefinitions()) {
                for (CatalogItemDefinitionFacts.CopyOrderOptionValue value : definition.values()) {
                    if (!value.ref().toString().equals(source.ref())) continue;
                    targetCode = definition.code();
                    targetOptionValueCode = value.code();
                    break;
                }
                if (targetOptionValueCode != null) break;
            }
        } else if ("CATALOG_CATEGORY".equals(source.objectType())) {
            targetCode = graph.categories().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .map(CategoryRow::code)
                    .findFirst()
                    .orElse(null);
        } else if ("CATALOG_UNIT".equals(source.objectType())) {
            sourceUnit = graph.units().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .findFirst()
                    .orElse(null);
            targetCode = sourceUnit == null ? null : sourceUnit.code();
        } else {
            targetCode = graph.dictionaries().stream()
                    .filter(value -> value.ref().toString().equals(source.ref()))
                    .map(DictionaryRow::code)
                    .findFirst()
                    .orElse(null);
        }
        if (targetCode == null) row.putNull("targetCode");
        else row.put("targetCode", targetCode);
        if (targetSkuCode == null) row.putNull("targetSkuCode");
        else row.put("targetSkuCode", targetSkuCode);
        if (targetOptionValueCode == null) row.putNull("targetOptionValueCode");
        else row.put("targetOptionValueCode", targetOptionValueCode);
        if (sourceUnit == null) {
            row.putNull("targetUnitName");
            row.putNull("targetUnitDimension");
            row.putNull("targetUnitPrecision");
        } else {
            row.put("targetUnitName", sourceUnit.name());
            row.put("targetUnitDimension", sourceUnit.unitDimension());
            row.put("targetUnitPrecision", sourceUnit.precision());
        }
        return row;
    }

private ObjectNode unitReferenceMappingRow(UnitRow source, UUID targetRef) {
        return mapper.createObjectNode()
                .put("objectType", "CATALOG_UNIT")
                .put("sourceRef", source.ref().toString())
                .put("targetRef", targetRef.toString())
                .put("targetCode", source.code())
                .put("targetUnitName", source.name())
                .put("targetUnitDimension", source.unitDimension())
                .put("targetUnitPrecision", source.precision());
    }

/**
     * The production owner supplies this row during its scoped preflight. Catalog only carries it through after
     * validating the opaque pair.
     */
    private ObjectNode productionReferenceMappingRow(ObjectNode request, ReferenceKey source, String targetRef) {
        JsonNode mappings = request.path("referenceMappings");
        if (mappings.isArray())
            for (JsonNode candidate : mappings) {
                if ("PRODUCTION_TAG".equals(candidate.path("objectType").asText())
                        && source.ref().equals(candidate.path("sourceRef").asText())
                        && targetRef.equals(candidate.path("targetRef").asText())) {
                    ObjectNode row = mapper.createObjectNode()
                            .put("objectType", "PRODUCTION_TAG")
                            .put("sourceRef", source.ref())
                            .put("targetRef", targetRef);
                    copyNullableText(row, candidate, "targetCode");
                    copyNullableText(row, candidate, "targetSkuCode");
                    copyNullableText(row, candidate, "targetOptionValueCode");
                    if (!row.has("targetCode")) row.putNull("targetCode");
                    if (!row.has("targetSkuCode")) row.putNull("targetSkuCode");
                    if (!row.has("targetOptionValueCode")) row.putNull("targetOptionValueCode");
                    return row;
                }
            }
        throw new CatalogOwnerApi.Problem(
                "REFERENCE_MAPPING_UNRESOLVED",
                422,
                "production tag mapping must come from the production owner preflight");
    }

private JsonNode rewriteReferences(JsonNode node, Map<ReferenceKey, String> mapping) {
        return rewriteReferences(node, mapping, null);
    }

private JsonNode rewriteReferences(JsonNode node, Map<ReferenceKey, String> mapping, String parentKey) {
        if (node == null || node.isNull()) return mapper.nullNode();
        if (node.isObject()) {
            ObjectNode copy = mapper.createObjectNode();
            node.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                String kind = referenceKindForDeclaredCopyPath(entry.getKey(), parentKey);
                if (kind != null) copy.set(entry.getKey(), rewriteReferenceValue(value, kind, mapping));
                else copy.set(entry.getKey(), rewriteReferences(value, mapping, entry.getKey()));
            });
            return copy;
        }
        if (node.isArray()) {
            ArrayNode copy = mapper.createArrayNode();
            node.forEach(value -> copy.add(rewriteReferences(value, mapping, parentKey)));
            return copy;
        }
        return node.deepCopy();
    }

private JsonNode rewriteReferenceValue(JsonNode value, String kind, Map<ReferenceKey, String> mapping) {
        if (value == null || value.isNull()) return mapper.nullNode();
        ReferenceKey key = value.isTextual() ? new ReferenceKey(copyReferenceObjectType(kind), value.asText()) : null;
        if (key != null && mapping.containsKey(key))
            return mapper.getNodeFactory().textNode(mapping.get(key));
        if (value.isArray()) {
            ArrayNode copy = mapper.createArrayNode();
            value.forEach(entry -> copy.add(rewriteReferenceValue(entry, kind, mapping)));
            return copy;
        }
        if (value.isObject()) return value.deepCopy();
        return value.deepCopy();
    }

/**
     * Copy rewriting shares only the persisted matrix paths; labels and arbitrary `code` fields never rewrite a
     * relation.
     */
    private String referenceKindForDeclaredCopyPath(String key, String parentKey) {
        return switch (key) {
            case "categoryRefs" -> "CATEGORY";
            case "tagRefs" -> "TAG";
            case "productionTagRef" -> "PRODUCTION_TAG";
            case "attributeRef" -> "skuVariantDimensions".equals(parentKey) ? "SKU_ATTRIBUTE" : null;
            case "valueRef" -> "SKU_ATTRIBUTE_VALUE";
            case "attributeValueRef" -> "values".equals(parentKey) ? "ORDER_OPTION_VALUE" : "SKU_ATTRIBUTE_VALUE";
            case "optionValueRef" -> "ORDER_OPTION_VALUE";
            case "productSkuRef" -> "PRODUCT_SKU";
            case "itemRef" -> "CATALOG_ITEM";
            case "tagRef" -> "PRODUCTION_TAG";
            case "salesUnitRef",
                    "baseMeasureUnitRef",
                    "salesUnitOverrideRef",
                    "baseMeasureUnitOverrideRef",
                    "countingUnitRef" -> "CATALOG_UNIT";
            case "unitRef" -> Set.of(
                                    "salesUnitSnapshot",
                                    "baseMeasureUnitSnapshot",
                                    "consumptionUnitSnapshot",
                                    "countingUnitSnapshot")
                            .contains(parentKey)
                    ? "CATALOG_UNIT"
                    : null;
            default -> null;
        };
    }

private void assertNoOwnerReferenceLeak(
            CatalogClosure graph, Map<ReferenceKey, String> mapping, String sourceScope) {
        for (ClosureEdge edge : graph.edges()) {
            if (Set.of("PRODUCTION_TAG", "STOCK_TARGET").contains(edge.referenceKind())) continue;
            ReferenceKey key = new ReferenceKey(copyReferenceObjectType(edge.referenceKind()), edge.toRef());
            if (!mapping.containsKey(key)) {
                throw new CatalogOwnerApi.Problem(
                        ("OWNER_REFERENCE_LEAK"),
                        (422),
                        /* format-wrap */
                        ("复制引用未完成映射: " + edge.toRef()));
            }
        }
        for (ItemRow row : graph.items())
            if (containsForbiddenOwnerReference(json(row.sectionsJson()), sourceScope))
                throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "源 owner 引用不能进入目标图");
    }

private void verifyTargetNoOwnerReferenceLeak(
            String targetScope, String brand, CatalogClosure graph, String sourceScope) {
        List<String> codes = graph.items().stream().map(ItemRow::code).toList();
        for (ItemRow row : loadItemIdentityRows(targetScope, brand, codes))
            if (containsForbiddenOwnerReference(json(row.sectionsJson()), sourceScope))
                throw new CatalogOwnerApi.Problem("OWNER_REFERENCE_LEAK", 422, "目标图仍含源 owner 引用");
    }

private boolean containsForbiddenOwnerReference(JsonNode node, String sourceScope) {
        if (node == null || node.isNull()) return false;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                if (Set.of("headCompanyRef", "ownerRef", "dataNodeRef", "scopeRef", "originScopeRef")
                                .contains(key)
                        && value.isTextual()
                        && sourceScope.equals(value.asText())) return true;
                if (containsForbiddenOwnerReference(value, sourceScope)) return true;
            }
        } else if (node.isArray())
            for (JsonNode value : node) if (containsForbiddenOwnerReference(value, sourceScope)) return true;
        return false;
    }

private String requiredMappedReference(Map<ReferenceKey, String> mapping, ReferenceKey key) {
        String target = mapping.get(key);
        if (target == null || target.isBlank()) {
            throw new CatalogOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("复制引用未完成映射: " + key.ref()));
        }
        return target;
    }

private String optionValueCodeForRef(CatalogClosure graph, String ref) {
        for (ItemRow item : graph.items()) {
            for (JsonNode sku : rawSkuRows(json(item.sectionsJson())))
                if (sku.path("attributeValueRefs").isArray())
                    for (JsonNode value : sku.path("attributeValueRefs")) {
                        if (ref.equals(value.path("attributeValueRef").asText()))
                            return firstText(value, "valueCode", "attributeValueCode", "code", "name");
                    }
        }
        return null;
    }

static String dictionaryObjectType(String dictionaryKind) {
        return CatalogOwnerValueSupport.dictionaryObjectType(dictionaryKind);
}

private static ItemRow itemRow(CatalogCopyPersistence.ItemRow row) {
        return new ItemRow(
                row.ref(),
                row.code(),
                row.name(),
                row.shortName(),
                row.shapeKey(),
                row.status(),
                row.sectionsJson(),
                row.version(),
                row.updatedAt(),
                row.sourceScopeRef());
    }

private static CategoryRow categoryRow(CatalogCopyPersistence.CategoryRow row) {
        return new CategoryRow(
                row.ref(),
                row.code(),
                row.name(),
                row.parentCode(),
                row.parentCategoryRef(),
                row.status(),
                row.version(),
                row.displayOrder());
    }

private static DictionaryRow dictionaryRow(CatalogCopyPersistence.DictionaryRow row) {
        return new DictionaryRow(
                row.ref(),
                row.dictionaryKind(),
                row.code(),
                row.name(),
                row.status(),
                row.parentEntryRef(),
                row.displayOrder(),
                row.version());
    }

private static UnitRow unitRow(CatalogCopyPersistence.UnitRow row) {
        return new UnitRow(
                row.ref(), row.code(), row.name(), row.unitDimension(), row.precision(), row.status(), row.version());
    }

private record ItemRow(
            UUID ref,

            String code,

            String name,
            String shortName,
            String shapeKey,
            String status,
            String sectionsJson,
            long version,
            long updatedAt,
            String sourceScopeRef)
            implements CatalogObject {
        public String objectType() {
            return "CATALOG_ITEM";
        }
    }

private record CopyFactPresence(
            boolean skus,
            boolean categories,
            boolean composites,
            boolean attributes,
            boolean orderOptions,
            boolean axes,
            boolean images,
            boolean references) {}

private record ItemUnitRefs(
            UUID salesUnitRef,
            InventoryOwnerApi.UnitSnapshot salesUnitSnapshot,
            UUID baseMeasureUnitRef,
            InventoryOwnerApi.UnitSnapshot baseMeasureUnitSnapshot) {}

private record CopiedUnitInput(UUID itemRef, ObjectNode sections, ArrayNode skus) {}

private record CopiedUnitRefs(
            UUID salesUnitRef,
            UUID baseMeasureUnitRef,
            Map<UUID, UUID> salesOverrides,
            Map<UUID, UUID> baseOverrides,
            ArrayNode skus) {}

private record CopyPageRow(ItemRow item, long total) {}

private record CategoryRow(
            UUID ref,
            String code,
            String name,
            String parentCode,
            UUID parentCategoryRef,
            String status,
            long version,
            int displayOrder)
            implements CatalogObject {
        public String objectType() {
            return "CATALOG_CATEGORY";
        }
    }

private record CopyCategory(
            UUID targetRef, String dataNodeRef, String brandRef, CategoryRow source, UUID targetParentRef) {}

private record DictionaryRow(
            UUID ref,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            int displayOrder,
            long version)
            implements CatalogObject {
        public String objectType() {
            return dictionaryObjectType(dictionaryKind);
        }
    }

private record UnitRow(
            UUID ref, String code, String name, String unitDimension, int precision, String status, long version)
            implements CatalogObject {
        public String objectType() {
            return "CATALOG_UNIT";
        }
    }

private record CopyDictionary(
            UUID targetRef, String dataNodeRef, String brandRef, DictionaryRow source, UUID targetParentRef) {}

private record UnitCopy(UUID targetRef, String dataNodeRef, String brandRef, UnitRow source) {}

private record TypedReference(String referenceKind, String ref) {}

private record SkuInboundReference(UUID componentRef, UUID ownerItemRef, String ownerCode, String ownerName) {}

private record ClosureEdge(String fromRef, String toRef, String referenceKind) {}

private record ReferenceKey(String objectType, String ref) {}

private record DictionaryKey(String kind, String code) {}

private interface CatalogObject {
        String objectType();

        String code();

        String name();

        long version();
    }

private record CatalogClosure(
            List<ItemRow> items,
            List<CategoryRow> categories,
            List<DictionaryRow> dictionaries,
            List<UnitRow> units,
            List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions,
            Map<UUID, CatalogItemDefinitionFacts.CopyAttributeDefinition> attributeDefinitions,
            List<ClosureEdge> edges) {
        List<CatalogObject> objects() {
            List<CatalogObject> all = new ArrayList<>();
            all.addAll(items);
            all.addAll(categories);
            all.addAll(dictionaries);
            all.addAll(units);
            return all;
        }

        int size() {
            return objects().size() + orderOptionDefinitions.size();
        }
    }

private record CopyClosureFacts(
            List<ItemRow> items,
            Map<UUID, List<UUID>> orderOptionDefinitionRefsByItem,
            Map<UUID, CatalogItemDefinitionFacts.CopyAttributeDefinition> attributeDefinitions,
            List<CatalogItemDefinitionFacts.CopyOrderOptionDefinition> orderOptionDefinitions) {
        private static CopyClosureFacts empty() {
            return new CopyClosureFacts(List.of(), Map.of(), Map.of(), List.of());
        }
    }

private record CatalogCopyPlan(
            List<String> selected,
            CatalogClosure graph,
            long sourceVersion,
            long targetVersion,
            TargetCopyFacts targetCopyFacts,
            String digest) {}

private record TargetItemFacts(Map<String, ItemRow> rows, long maxVersion) {
        private TargetItemFacts {
            rows = Map.copyOf(rows);
        }
    }

private record TargetCategoryFacts(Map<String, UUID> refs, Map<String, Long> versions) {
        private TargetCategoryFacts {
            refs = Map.copyOf(refs);
            versions = Map.copyOf(versions);
        }
    }

private record TargetDictionaryFacts(Map<DictionaryKey, UUID> refs, Map<DictionaryKey, Long> versions) {
        private TargetDictionaryFacts {
            refs = Map.copyOf(refs);
            versions = Map.copyOf(versions);
        }
    }

private record TargetCopyFacts(
            Map<String, ItemRow> targetRows,
            Map<String, UUID> categoryRefs,
            Map<DictionaryKey, UUID> dictionaryRefs,
            Map<String, UnitRow> targetUnits,
            TargetScopeVersions versions) {
        private TargetCopyFacts {
            targetRows = Map.copyOf(targetRows);
            categoryRefs = Map.copyOf(categoryRefs);
            dictionaryRefs = Map.copyOf(dictionaryRefs);
            targetUnits = Map.copyOf(targetUnits);
        }
    }

private record TargetScopeVersions(
            long maxVersion,
            Map<String, Long> categoryVersions,
            Map<DictionaryKey, Long> dictionaryVersions,
            Map<String, Long> unitVersions) {
        private TargetScopeVersions {
            categoryVersions = Map.copyOf(categoryVersions);
            dictionaryVersions = Map.copyOf(dictionaryVersions);
            unitVersions = Map.copyOf(unitVersions);
        }
    }

private record PreparedLocalCopy(LocalCopyPlan plan, CatalogOwnerApi.CopyPreflightReadback readback)
            implements CatalogOwnerApi.LocalCopyExecutionPreparation {
        public CatalogOwnerApi.CopyPreflightReadback preflight() {
            return readback;
        }
    }

private record PreparedBrandCopy(
            CatalogCopyPlan plan, CopyCompatibility compatibility, CatalogOwnerApi.CopyPreflightReadback readback)
            implements CatalogOwnerApi.BrandCopyExecutionPreparation {
        public CatalogOwnerApi.CopyPreflightReadback preflight() {
            return readback;
        }
    }

private record PreparedCopyItem(
            UUID targetRef,
            String dataNodeRef,
            String brandRef,
            String sourceScopeRef,
            ItemRow source,
            ObjectNode sections,
            ArrayNode skus,
            ArrayNode categoryRefs,
            ArrayNode compositeGroups,
            ArrayNode skuVariantDimensions,
            JsonNode images,
            CatalogItemReferenceFacts.CopyValues references) {}

private record LocalCopyPlan(
            ItemRow source,
            ItemRow target,
            ArrayNode selectedSections,
            String digest,
            CompatibilityCheck compatibility,
            List<UnitRow> units) {}

private record CopyCompatibility(
            Map<ReferenceKey, String> mapping,
            ArrayNode compatibilityResults,
            Map<String, ItemRow> targetRows,
            Map<String, UnitRow> targetUnits) {}

private record CompatibilityCheck(
            String result, String reason, String problemCode, String reasonCode, boolean blocking) {}

private record Receipt(String operationId, String requestHash, JsonNode response) {}

}
