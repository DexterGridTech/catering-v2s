package com.catering.v2s.inventory.application;

import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.inventory.application.persistence.InventoryCopyPersistence;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.CollectionRequestSupport;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Light inventory owner. It never writes catalog or organization schemas. */

/** Concrete Inventory copy owner. */
@Service
public class InventoryCopyService {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final String CATALOG_ITEM_SAVE_REQUIREMENT =
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM";
    private static final String ITEM_BASE_UNIT_ARGS = "商品基础计量单位判断参数不完整";
    private static final String SKU_BASE_UNIT_ARGS = "SKU 基础计量单位判断参数不完整";
    private static final String INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT = "单位快照不完整";
    private static final String SALES_MENU_STATE_UNKNOWN = "库存状态无法转换为销售菜单可用事实";
    /** Mapping types consumed by inventory copy; catalog may carry other owner mappings in the same plan. */
    private static final Set<String> INVENTORY_COPY_MAPPING_TYPES = Set.of(
            "CATALOG_ITEM",
            "PRODUCT_SKU",
            "CATALOG_UNIT",
            "CATALOG_ORDER_OPTION_DEFINITION",
            "CATALOG_ORDER_OPTION_DEFINITION_VALUE",
            "STOCK_TARGET");

    private final JdbcTemplate jdbc;
    private final InventoryCopyPersistence persistence;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    @Autowired
    public InventoryCopyService(
            InventoryCopyPersistence persistence, JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.persistence = persistence;
        this.mapper = mapper;
        this.time = time;
    }

    public InventoryCopyService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this(new InventoryCopyPersistence(jdbc), jdbc, mapper, time);
    }

    private InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot(UUID targetRef) {
        return persistence.readConsumptionUnitSnapshot(targetRef);
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(java.sql.ResultSet result) throws java.sql.SQLException {
        UUID ref = result.getObject(1, UUID.class);
        if (ref == null || result.getString(2) == null || result.getString(3) == null || result.getString(4) == null)
            throw new InventoryOwnerApi.Problem("CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, "单位快照不完整");
        return new InventoryOwnerApi.UnitSnapshot(
                ref, result.getString(2), result.getString(3), result.getString(4), result.getInt(5));
    }

    private static InventoryOwnerApi.UnitSnapshot unitSnapshot(java.sql.ResultSet result, int firstColumn)
            throws java.sql.SQLException {
        String refValue = result.getString(firstColumn);
        UUID ref;
        try {
            ref = refValue == null ? null : UUID.fromString(refValue);
        } catch (IllegalArgumentException failure) {
            return null;
        }
        String code = result.getString(firstColumn + 1);
        String name = result.getString(firstColumn + 2);
        String dimension = result.getString(firstColumn + 3);
        if (ref == null || code == null || name == null || dimension == null) return null;
        return new InventoryOwnerApi.UnitSnapshot(ref, code, name, dimension, result.getInt(firstColumn + 4));
    }

    private InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(JsonNode node, String field) {
        if (node == null || !node.isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an object");
        UUID ref;
        try {
            ref = UUID.fromString(node.path("unitRef").asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + ".unitRef is required", failure);
        }
        String code = node.path("code").asText();
        String name = node.path("name").asText();
        String dimension = node.path("unitDimension").asText();
        if (code.isBlank()
                || name.isBlank()
                || !Set.of("COUNT", "WEIGHT", "VOLUME", "SERVICE_DURATION", "PACKAGE")
                        .contains(dimension)
                || !node.has("precision")
                || !node.path("precision").canConvertToInt()
                || node.path("precision").asInt() < 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is incomplete");
        return new InventoryOwnerApi.UnitSnapshot(
                ref, code, name, dimension, node.path("precision").asInt());
    }

    private void writeCountingConfiguration(
            ObjectNode configuration, InventoryOwnerApi.CountingUnitConfiguration counting) {
        if (counting.countingUnitSnapshot() == null) {
            configuration.putNull("countingUnitRef");
            configuration.putNull("countingUnitSnapshot");
            configuration.put("conversionFactor", BigDecimal.ONE);
            return;
        }
        configuration.put(
                "countingUnitRef", counting.countingUnitSnapshot().unitRef().toString());
        configuration.set("countingUnitSnapshot", mapper.valueToTree(counting.countingUnitSnapshot()));
        configuration.put("conversionFactor", counting.conversionFactor());
    }

    private InventoryConfiguration configurationReadback(JsonNode configuration) {
        BigDecimal factor = decimalNode(configuration, "conversionFactor");
        InventoryOwnerApi.UnitSnapshot counting = configuration.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(configuration.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        UUID countingRef = configuration.hasNonNull("countingUnitRef")
                ? requiredUuid(configuration, "countingUnitRef")
                : counting == null ? null : counting.unitRef();
        if (countingRef != null && counting == null)
            throw new InventoryOwnerApi.Problem("UNIT_SNAPSHOT_REQUIRED", 422, "盘点单位快照缺失");
        return new InventoryConfiguration(
                configuration.path("allowNegative").asBoolean(false),
                configuration.hasNonNull("lowStockThreshold") ? decimalNode(configuration, "lowStockThreshold") : null,
                countingRef,
                factor.signum() <= 0 ? BigDecimal.ONE : factor,
                counting);
    }

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
        return copyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, requestId, idempotencyKey, () -> {
            requireCatalogDefinitionDataNodeType(targetDataNodeType);
            requireOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    targetDataNodeType,
                    targetDataNodeRef,
                    CatalogTargetCapability.forDataNodeType(targetDataNodeType),
                    ownerScopeGrant);
        });
    }

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
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    private JsonNode copyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        return copyCore(
                sourceDataNodeRef,
                targetDataNodeRef,
                brandRef,
                request,
                requestId,
                idempotencyKey,
                authorization,
                null);
    }

    private JsonNode copyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization,
            PreparedCopy prepared) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        JsonNode judgement;
        if (prepared == null) {
            recheckCopySourceFactsBeforeReceipt(sourceDataNodeRef, brandRef, request);
            judgement = preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization);
        } else {
            ensurePreparedSourceClosure(prepared.sourceClosure(), request);
            judgement = prepared.judgement();
        }

        String currentFingerprint = judgement.path("digest").asText();
        String blocker = judgement.path("firstBlockingProblem").asText("");
        if (!blocker.isBlank()) throw new InventoryOwnerApi.Problem(blocker, 422, "库存复制存在不兼容事实");
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!receiptKey.isBlank()) {
            JsonNode replay =
                    replay(targetDataNodeRef, receiptKey, "coordinatedCopy", receiptRequest(request, brandRef));
            if (replay != null) {
                if (prepared != null) recheckCopySourceFactsBeforeReceipt(sourceDataNodeRef, brandRef, request);
                return replayCopyIfCurrent(replay, currentFingerprint);
            }
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            if (request.hasNonNull("inventoryPreflightDigest")) {
                String expected = request.path("inventoryPreflightDigest").asText();
                if (!expected.equals(currentFingerprint)) {
                    throw new InventoryOwnerApi.Problem(
                            ("STALE_COPY_PREFLIGHT"),
                            (409),
                            /* format-wrap */
                            ("库存复制预检已失效，请重新预检"));
                }
            }
            Map<UUID, ReferenceMapping> mappings = referenceMappings(request);
            List<UUID> closureItemRefs = requiredOpaqueRefArray(request, "closureItemRefs");
            LocalCopySectionPlan localSections = localCopySectionPlan(request);
            SourceCopyClosure sourceClosure = prepared == null
                    ? sourceCopyClosure(sourceDataNodeRef, brandRef, closureItemRefs, localSections)
                    : prepared.sourceClosure();
            int copied = 0;
            List<TargetRow> sourceRows = sourceClosure.targets();
            List<BomOwnerRow> sourceBomOwners = sourceClosure.bomOwners();
            // First materialize every target in the closure.  Only after the complete
            // identity map exists may BOM references be rewritten; this prevents an
            // order-dependent source UUID from leaking into a target BOM.
            List<PlannedTarget> plannedTargets = sourceRows.stream()
                    .map(row -> {
                        ReferenceMapping item = mappingFor(mappings, row.itemRef(), "CATALOG_ITEM");
                        ReferenceMapping sku = row.productSkuRef() == null
                                ? null
                                : mappingFor(mappings, row.productSkuRef(), "PRODUCT_SKU");
                        ReferenceMapping target = mappingFor(mappings, row.ref(), "STOCK_TARGET");
                        return new PlannedTarget(row, item, sku, target);
                    })
                    .toList();
            lockCatalogItemRefs(plannedTargets.stream()
                    .map(target -> target.itemMapping().targetRef())
                    .toList());
            lockProductSkuRefs(plannedTargets.stream()
                    .map(PlannedTarget::skuMapping)
                    .filter(java.util.Objects::nonNull)
                    .map(ReferenceMapping::targetRef)
                    .toList());
            int[] insertedTargets = persistence.copyCatalogItems(plannedTargets.stream()
                    .map(target -> targetWrite(target, targetDataNodeRef, brandRef, mappings))
                    .toList());
            copied += java.util.Arrays.stream(insertedTargets)
                    .map(value -> value > 0 ? value : 0)
                    .sum();
            Map<UUID, UUID> targetRefs = new java.util.LinkedHashMap<>();
            Map<TargetIdentity, TargetRow> targetsByIdentity = prepared == null
                    ? targetRowsByIdentities(
                            targetDataNodeRef,
                            brandRef,
                            plannedTargets.stream()
                                    .map(target -> new TargetIdentity(
                                            target.itemMapping().targetRef(),
                                            target.skuMapping() == null
                                                    ? null
                                                    : target.skuMapping().targetRef()))
                                    .toList())
                    : postInsertTargetRows(plannedTargets, prepared.preflightTargetRows(), mappings);
            for (PlannedTarget planned : plannedTargets) {
                TargetRow target = targetsByIdentity.get(new TargetIdentity(
                        planned.itemMapping().targetRef(),
                        planned.skuMapping() == null
                                ? null
                                : planned.skuMapping().targetRef()));
                if (target == null) {
                    throw new InventoryOwnerApi.Problem(
                            ("RESULT_UNKNOWN"),
                            (500),
                            /* format-wrap */
                            ("库存对象创建后无法读取"));
                }
                targetRefs.put(planned.source().ref(), target.ref());
            }
            List<PreparedBom> rewrittenBoms = sourceBomOwners.stream()
                    .map(owner ->
                            rewrittenBom(sourceDataNodeRef, targetDataNodeRef, brandRef, owner, targetRefs, mappings))
                    .toList();
            // An option-value BOM belongs only to a catalog order-option definition value.  It must
            // serialize with that definition-value lifecycle exactly like the direct BOM save path;
            // SKU dictionary values are not an alias for this reference.
            lockCatalogOptionValueRefs(rewrittenBoms.stream()
                    .map(PreparedBom::option)
                    .filter(java.util.Objects::nonNull)
                    .map(ReferenceMapping::targetRef)
                    .toList());
            int[] upsertedBoms = persistence.copyCatalogSkus(rewrittenBoms.stream()
                    .map(bom -> bomWrite(bom, targetDataNodeRef, brandRef))
                    .toList());
            copied += java.util.Arrays.stream(upsertedBoms)
                    .map(value -> value > 0 ? value : 0)
                    .sum();
            if (!sourceDataNodeRef.equals(targetDataNodeRef)) {
                List<UUID> targetItemRefs = sourceClosure.itemRefs().stream()
                        .map(sourceItemRef -> mappingFor(mappings, sourceItemRef, "CATALOG_ITEM")
                                .targetRef())
                        .toList();
                verifyTargetNoOwnerReference(targetDataNodeRef, brandRef, targetItemRefs, sourceDataNodeRef);
            }
            ObjectNode result = mapper.createObjectNode()
                    .put("owner", "inventory")
                    .put(
                            "status",
                            copied == 0 && !sourceClosure.skipped().isEmpty()
                                    ? "SKIPPED"
                                    : (copied == 0 ? "CONFLICT" : "COMMITTED"))
                    .put("version", copied);
            ArrayNode skipped = result.putArray("skipped");
            sourceClosure.skipped().forEach(entry -> skipped.addObject()
                    .put("section", entry.section())
                    .put("reasonCode", entry.reasonCode()));
            result.put(
                    "receiptObjectFingerprint",
                    preflightCopyCoreWithState(
                                    sourceDataNodeRef,
                                    targetDataNodeRef,
                                    brandRef,
                                    request,
                                    authorization,
                                    sourceClosure,
                                    targetsByIdentity)
                            .judgement()
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
                throw new InventoryOwnerApi.Problem(
                        ("STALE_COPY_PREFLIGHT"),
                        (409),
                        /* format-wrap */
                        ("库存复制对象事实已变化，请重新预检"));
            }
        }
        return replay;
    }

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
        return preflightCopyCore(sourceDataNodeRef, targetDataNodeRef, brandRef, request, () -> {
            requireCatalogDefinitionDataNodeType(targetDataNodeType);
            requireOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    targetDataNodeType,
                    targetDataNodeRef,
                    CatalogTargetCapability.forDataNodeType(targetDataNodeType),
                    ownerScopeGrant);
        });
    }

    @Transactional(readOnly = true)
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        return preflightCopyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Transactional(readOnly = true)
    public InventoryOwnerApi.LocalCopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyPreflightCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
        JsonNode result = preflightCopy(context, request);
        // CanonicalJsonDocument crosses the owner boundary as an envelope.  The
        // coordinator validates envelope.data before it composes any owner fact.
        ObjectNode envelope = envelope(context.requestId(), result);
        try {
            return new InventoryOwnerApi.LocalCopyPreflightReadback(
                    envelope.path("data").path("digest").asText(), mapper.writeValueAsString(envelope));
        } catch (Exception failure) {
            throw new IllegalStateException("inventory owner could not encode copy readback", failure);
        }
    }

    @Transactional(readOnly = true)
    public InventoryOwnerApi.CopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode().put("targetItemCode", command.targetItemCode());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return prepareCopyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey) {
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            if (!plan.isObject()) throw new IllegalArgumentException();
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
        try {
            return copyExecutionReadback(copy(context, request, idempotencyKey));
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalStateException("inventory owner could not encode copy readback", failure);
        }
    }

    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey,
            InventoryOwnerApi.CopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedCopy prepared))
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory local copy preparation is invalid");
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode()
                .put("sourceItemCode", command.sourceItemCode())
                .put("targetItemCode", command.targetItemCode())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set(
                "selectedSections",
                mapper.valueToTree(
                        command.selectedSections() == null ? java.util.List.of() : command.selectedSections()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return copyExecutionReadback(copyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()),
                prepared));
    }

    @Transactional(readOnly = true)
    public InventoryOwnerApi.LocalCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyPreflightCommand command) {
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", command.targetDataNodeRef());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
        JsonNode result = preflightCopy(context, request);
        // Keep the brand-copy path identical to local-copy: consumers never
        // infer whether this owner happened to return a bare or wrapped JSON object.
        ObjectNode envelope = envelope(context.requestId(), result);
        try {
            return new InventoryOwnerApi.LocalCopyPreflightReadback(
                    envelope.path("data").path("digest").asText(), mapper.writeValueAsString(envelope));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    @Transactional(readOnly = true)
    public InventoryOwnerApi.CopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyPreflightCommand command) {
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode().put("targetDataNodeRef", command.targetDataNodeRef());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return prepareCopyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()));
    }

    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        ObjectNode request = mapper.createObjectNode()
                .put("targetDataNodeRef", command.targetDataNodeRef())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        try {
            JsonNode plan = mapper.readTree(command.catalogReferencePlanJson());
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
            return copyExecutionReadback(copy(context, request, idempotencyKey));
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    @Transactional
    public InventoryOwnerApi.LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey,
            InventoryOwnerApi.CopyExecutionPreparation preparation) {
        if (!(preparation instanceof PreparedCopy prepared))
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "inventory brand copy preparation is invalid");
        CatalogAuthorizationScope scope = requireCopyContext(context);
        ObjectNode request = mapper.createObjectNode()
                .put("targetDataNodeRef", command.targetDataNodeRef())
                .put("inventoryPreflightDigest", command.inventoryPreflightDigest());
        request.set("selectedItemCodes", mapper.valueToTree(command.selectedItemCodes()));
        applyCatalogReferencePlan(request, command.catalogReferencePlanJson());
        return copyExecutionReadback(copyCore(
                copySourceDataNodeRef(scope),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> requireCatalogDefinitionDataNodeType(scope.dataNodeType()),
                prepared));
    }

    private void applyCatalogReferencePlan(ObjectNode request, String canonicalPlan) {
        try {
            JsonNode plan = mapper.readTree(canonicalPlan);
            if (plan == null || !plan.isObject()) throw new IllegalArgumentException();
            for (String field :
                    java.util.List.of("closureItemRefs", "productionTagDefinitionRefs", "referenceMappings"))
                if (plan.has(field)) request.set(field, plan.path(field).deepCopy());
        } catch (Exception failure) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog copy reference plan is invalid", failure);
        }
    }

    private PreparedCopy prepareCopyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            Runnable authorization) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        List<UUID> closureItemRefs = requiredOpaqueRefArray(request, "closureItemRefs");
        LocalCopySectionPlan localSections = localCopySectionPlan(request);
        SourceCopyClosure sourceClosure =
                sourceCopyClosure(sourceDataNodeRef, brandRef, closureItemRefs, localSections);
        PreflightCopyResult computed = preflightCopyCoreWithState(
                sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization, sourceClosure, null);
        JsonNode judgement = computed.judgement();
        ObjectNode envelope = envelope(requestId, judgement);
        try {
            return new PreparedCopy(
                    sourceClosure,
                    judgement,
                    computed.targetRows(),
                    new InventoryOwnerApi.LocalCopyPreflightReadback(
                            envelope.path("data").path("digest").asText(), mapper.writeValueAsString(envelope)));
        } catch (Exception failure) {
            throw new IllegalStateException("inventory owner could not encode copy preparation", failure);
        }
    }

    private void ensurePreparedSourceClosure(SourceCopyClosure sourceClosure, ObjectNode request) {
        List<UUID> requested = requiredOpaqueRefArray(request, "closureItemRefs");
        if (!new LinkedHashSet<>(sourceClosure.itemRefs()).containsAll(requested)) {
            String problemMessage = "库存复制准备的来源闭包与执行请求不一致";
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, problemMessage);
        }
    }

    private InventoryOwnerApi.LocalCopyExecutionReadback copyExecutionReadback(JsonNode result) {
        if (result == null
                || !result.isObject()
                || result.path("owner").asText().isBlank()
                || result.path("status").asText().isBlank()
                || !result.path("version").canConvertToLong()) {
            throw new InventoryOwnerApi.Problem(
                    "RESULT_UNKNOWN", 500, "inventory copy readback is missing a required field");
        }
        List<InventoryOwnerApi.LocalCopySkippedReadback> skipped = new ArrayList<>();
        if (result.path("skipped").isArray())
            for (JsonNode entry : result.path("skipped")) {
                String section = entry.path("section").asText();
                String reasonCode = entry.path("reasonCode").asText();
                if (section.isBlank() || reasonCode.isBlank())
                    throw new InventoryOwnerApi.Problem(
                            "RESULT_UNKNOWN", 500, "inventory copy skipped result is invalid");
                skipped.add(new InventoryOwnerApi.LocalCopySkippedReadback(section, reasonCode));
            }
        return new InventoryOwnerApi.LocalCopyExecutionReadback(
                result.path("owner").asText(),
                result.path("status").asText(),
                result.path("version").asLong(),
                List.copyOf(skipped));
    }

    private JsonNode preflightCopyCore(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            Runnable authorization) {
        return preflightCopyCoreWithState(
                        sourceDataNodeRef, targetDataNodeRef, brandRef, request, authorization, null, null)
                .judgement();
    }

    private PreflightCopyResult preflightCopyCoreWithState(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            Runnable authorization,
            SourceCopyClosure preparedSourceClosure,
            Map<TargetIdentity, TargetRow> preparedTargetRows) {
        requireScope(sourceDataNodeRef, brandRef);
        requireScope(targetDataNodeRef, brandRef);
        authorization.run();
        Map<UUID, ReferenceMapping> mappingsBySource = new LinkedHashMap<>(referenceMappings(request));
        List<UUID> closureItemRefs = requiredOpaqueRefArray(request, "closureItemRefs");
        LocalCopySectionPlan localSections = localCopySectionPlan(request);
        ObjectNode snapshot = mapper.createObjectNode();
        ArrayNode versions = snapshot.putArray("versions");
        ArrayNode closureItems = snapshot.putArray("closureItems");
        ArrayNode referenceMappings = snapshot.putArray("referenceMappings");
        ArrayNode mappings = snapshot.putArray("mappingPreview");
        ArrayNode compatibility = snapshot.putArray("compatibilityResults");
        ArrayNode rewrites = snapshot.putArray("referenceRewritePreview");
        ArrayNode bomOwners = snapshot.putArray("bomOwners");
        String firstBlocking = "";
        SourceCopyClosure sourceClosure = preparedSourceClosure == null
                ? sourceCopyClosure(sourceDataNodeRef, brandRef, closureItemRefs, localSections)
                : preparedSourceClosure;
        if (sourceDataNodeRef.equals(targetDataNodeRef)) {
            addLocalCatalogUnitIdentityMappings(mappingsBySource, sourceClosure);
        }
        for (Map.Entry<UUID, ReferenceMapping> entry : mappingsBySource.entrySet()) {
            ReferenceMapping mapping = entry.getValue();
            if (!"CATALOG_UNIT".equals(mapping.objectType())) continue;
            referenceMappings
                    .addObject()
                    .put("objectType", mapping.objectType())
                    .put("sourceRef", entry.getKey().toString())
                    .put("targetRef", mapping.targetRef().toString())
                    .put("targetCode", mapping.targetCode())
                    .put("targetUnitName", mapping.targetUnitName())
                    .put("targetUnitDimension", mapping.targetUnitDimension())
                    .put("targetUnitPrecision", mapping.targetUnitPrecision());
        }
        for (BomOwnerRow owner : sourceClosure.bomOwners()) {
            bomOwners
                    .addObject()
                    .put("code", bomOwnerIdentity(owner))
                    .put("itemCode", owner.itemCode())
                    .put("version", owner.version());
            JsonNode rows = json(owner.rows());
            if (!rows.isArray()) {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存 BOM 行不是有效数组"));
            }
            if (owner.optionValueRef() != null) {
                ReferenceMapping optionValue =
                        mappingFor(mappingsBySource, owner.optionValueRef(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
                rewrites.addObject()
                        .put("sourceRef", owner.optionValueRef().toString())
                        .put("targetRef", optionValue.targetRef().toString())
                        .put("referenceKind", "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
            }
        }
        List<TargetRow> allSourceRows = sourceClosure.targets();
        Map<UUID, UUID> plannedTargetRefs = new LinkedHashMap<>();
        List<TargetIdentity> targetIdentities = allSourceRows.stream()
                .map(source -> new TargetIdentity(
                        mappingFor(mappingsBySource, source.itemRef(), "CATALOG_ITEM")
                                .targetRef(),
                        source.productSkuRef() == null
                                ? null
                                : mappingFor(mappingsBySource, source.productSkuRef(), "PRODUCT_SKU")
                                        .targetRef()))
                .toList();
        Map<TargetIdentity, TargetRow> existingTargetsByIdentity = preparedTargetRows == null
                ? targetRowsByIdentities(targetDataNodeRef, brandRef, targetIdentities)
                : preparedTargetRows;
        // The closure is recursive over inventory-owned BOM target references,
        // not merely over catalog item codes. Every component item must be
        // materialized before a BOM targetRef can be rewritten.
        for (TargetRow source : allSourceRows) {
            mappedUnitSnapshot(source.consumptionUnitSnapshot(), mappingsBySource);
            InventoryConfiguration sourceConfiguration = configurationReadback(json(source.configuration()));
            mappedUnitSnapshot(sourceConfiguration.countingUnitSnapshot(), mappingsBySource);
            ReferenceMapping itemMapping = mappingFor(mappingsBySource, source.itemRef(), "CATALOG_ITEM");
            ReferenceMapping skuMapping = source.productSkuRef() == null
                    ? null
                    : mappingFor(mappingsBySource, source.productSkuRef(), "PRODUCT_SKU");
            TargetRow existing = existingTargetsByIdentity.get(
                    new TargetIdentity(itemMapping.targetRef(), skuMapping == null ? null : skuMapping.targetRef()));
            ReferenceMapping suppliedTarget = mappingsBySource.get(source.ref());
            if (suppliedTarget != null && !"STOCK_TARGET".equals(suppliedTarget.objectType())) {
                {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存对象 sourceRef 的映射类型不正确"));
                }
            }
            UUID targetRef = suppliedTarget == null
                    ? (existing == null ? UUID.randomUUID() : existing.ref())
                    : suppliedTarget.targetRef();
            if (existing != null && !existing.ref().equals(targetRef)) {
                {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存对象预检 targetRef 与目标事实不一致"));
                }
            }
            plannedTargetRefs.put(source.ref(), targetRef);
            String result = existing == null ? "CREATE" : "REUSE";
            String reason = existing == null
                    ? "目标库存对象不存在"
                            /* format-wrap */
                            + "，将创建且余额从零开始"
                    : "库存对象身份一致，可复用";
            String problem = "";
            String reasonCode = existing == null ? "TARGET_ABSENT" : "REUSE_CONFIRMATION_REQUIRED";
            if (existing != null && !java.util.Objects.equals(existing.measureMode(), source.measureMode())) {
                result = "BLOCKED";
                reason = "消耗单位不一致";
                problem = "CONSUMPTION_UNIT_INCOMPATIBLE";
                reasonCode = "CONSUMPTION_UNIT_INCOMPATIBLE";
                if (firstBlocking.isBlank()) firstBlocking = problem;
            }
            String identityCode = targetIdentityCode(
                    requiredLabel(itemMapping.targetCode(), "CATALOG_ITEM targetCode"),
                    skuMapping == null ? null : requiredLabel(skuMapping.targetSkuCode(), "PRODUCT_SKU targetSkuCode"));
            List<String> tupleParts = skuMapping == null
                    ? List.of("ITEM", requiredLabel(itemMapping.targetCode(), "CATALOG_ITEM targetCode"))
                    : List.of(
                            "SKU",
                            requiredLabel(itemMapping.targetCode(), "CATALOG_ITEM targetCode"),
                            requiredLabel(skuMapping.targetSkuCode(), "PRODUCT_SKU targetSkuCode"));
            ObjectNode canonicalTuple = canonicalTuple(targetDataNodeRef, brandRef, "STOCK_TARGET", tupleParts);
            closureItems
                    .addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("code", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("name", source.itemCode())
                    .put("action", result);
            compatibility
                    .addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("compatibilityId", stockTargetCompatibilityId(source))
                    .put("code", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("result", result)
                    .put("reason", reason)
                    .put("reasonCode", reasonCode)
                    .put("problemCode", problem)
                    .set("canonicalTuple", canonicalTuple.deepCopy());
            versions.addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("code", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("sourceVersion", source.version())
                    .put("targetVersion", existing == null ? 0 : existing.version());
            mappings.addObject()
                    .put("fromCode", source.ref().toString())
                    .put("toCode", identityCode)
                    .put("itemCode", source.itemCode())
                    .put("referenceKind", "STOCK_TARGET")
                    .put("status", existing == null ? "CREATE" : "REUSE")
                    .set("canonicalTuple", canonicalTuple.deepCopy());
            referenceMappings
                    .addObject()
                    .put("objectType", "STOCK_TARGET")
                    .put("sourceRef", source.ref().toString())
                    .put("targetRef", targetRef.toString())
                    .put("targetCode", identityCode)
                    .put("targetSkuCode", skuMapping == null ? null : skuMapping.targetSkuCode());
        }
        for (BomOwnerRow owner : sourceClosure.bomOwners()) {
            JsonNode rows = json(owner.rows());
            for (JsonNode row : rows) {
                String sourceRef = row.path("targetRef")
                        .asText(row.path("componentTargetRef").asText(""));
                UUID sourceTargetRef;
                try {
                    sourceTargetRef = UUID.fromString(sourceRef);
                } catch (IllegalArgumentException failure) {
                    throw new InventoryOwnerApi.Problem(
                            "REFERENCE_MAPPING_UNRESOLVED",
                            422,
                            "库存 BOM 组件必须为 opaque targetRef",
                            /* format-wrap */
                            failure);
                }
                UUID targetRef = plannedTargetRefs.get(sourceTargetRef);
                if (targetRef == null) {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存 BOM 组件不在复制闭包中"));
                }
                mappedUnitSnapshot(
                        requiredUnitSnapshot(row.path("consumptionUnitSnapshot"), "BOM consumptionUnitSnapshot"),
                        mappingsBySource);
                rewrites.addObject()
                        .put("sourceRef", sourceRef)
                        .put("targetRef", targetRef.toString())
                        .put("referenceKind", "STOCK_BOM");
            }
        }
        ArrayNode skipped = snapshot.putArray("skipped");
        sourceClosure.skipped().forEach(entry -> skipped.addObject()
                .put("section", entry.section())
                .put("reasonCode", entry.reasonCode()));
        snapshot.put("firstBlockingProblem", firstBlocking);
        ObjectNode result = mapper.createObjectNode()
                .put("owner", "inventory")
                .put("firstBlockingProblem", firstBlocking)
                .put("digest", hash(copyDigestSnapshot(snapshot)));
        result.set("closureItems", closureItems);
        result.set("referenceMappings", referenceMappings);
        result.set("mappingPreview", mappings);
        result.set("versions", versions);
        result.set("compatibilityResults", compatibility);
        result.set("referenceRewritePreview", rewrites);
        result.set("skipped", skipped.deepCopy());
        return new PreflightCopyResult(result, existingTargetsByIdentity);
    }

    private Map<TargetIdentity, CatalogTargetDisplay> catalogTargetDisplays(
            String scope, String brand, Collection<TargetIdentity> identities) {
        Set<UUID> itemRefs = identities.stream()
                .map(TargetIdentity::itemRef)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (itemRefs.isEmpty()) return Map.of();
        Map<TargetIdentity, CatalogTargetDisplay> result = new LinkedHashMap<>();
        for (InventoryCopyPersistence.CatalogTargetDisplay row :
                persistence.readCatalogTargetDisplays(scope, brand, itemRefs)) {
            requireCatalogBusinessName(row.itemName(), "耗用对象缺少商品名称");
            // The item display is valid whether or not it has SKU rows. A LEFT JOIN with
            // existing SKUs has no null-SKU row, so add the item identity independently.
            result.putIfAbsent(
                    new TargetIdentity(row.itemRef(), null),
                    new CatalogTargetDisplay(row.itemCode(), row.itemName(), null, null));
            if (row.productSkuRef() != null)
                result.put(
                        new TargetIdentity(row.itemRef(), row.productSkuRef()),
                        new CatalogTargetDisplay(row.itemCode(), row.itemName(), row.skuCode(), row.skuName()));
        }
        return Map.copyOf(result);
    }

    private CatalogTargetDisplay requiredCatalogTargetDisplay(
            Map<TargetIdentity, CatalogTargetDisplay> displays, TargetRow target) {
        return requiredCatalogTargetDisplay(displays, new TargetIdentity(target.itemRef(), target.productSkuRef()));
    }

    private CatalogTargetDisplay requiredCatalogTargetDisplay(
            Map<TargetIdentity, CatalogTargetDisplay> displays, TargetIdentity target) {
        CatalogTargetDisplay display = displays.get(target);
        // spotless:off
        if (display == null)
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "耗用对象缺少商品名称");
        // spotless:on
        requireCatalogBusinessName(display.itemName(), "耗用对象缺少商品名称");
        if (target.productSkuRef() != null) {
            requireCatalogBusinessName(display.skuName(), "耗用对象缺少规格名称");
        }
        return display;
    }

    /**
     * Task reads consume the catalog name field, never substitute the identity code as a display name. A business may
     * legitimately give a SKU a name with the same characters as its code, so equality is not corrupt data.
     */
    private void requireCatalogBusinessName(String name, String missingMessage) {
        if (name == null || name.isBlank()) throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, missingMessage);
    }

    private Map<TargetIdentity, TargetRow> targetRowsByIdentities(
            String scope, String brand, List<TargetIdentity> identities) {
        return targetRowsByIdentities(scope, brand, identities, true);
    }

    private Map<TargetIdentity, TargetRow> targetRowsByIdentities(
            String scope, String brand, List<TargetIdentity> identities, boolean requireCompleteConsumptionUnit) {
        if (identities.isEmpty()) return Map.of();
        List<InventoryCopyPersistence.TargetIdentity> persistenceIdentities = identities.stream()
                .map(identity ->
                        new InventoryCopyPersistence.TargetIdentity(identity.itemRef(), identity.productSkuRef()))
                .toList();
        Map<TargetIdentity, TargetRow> result = new LinkedHashMap<>();
        for (InventoryCopyPersistence.TargetRecord record : persistence
                .readTargetRowsByIdentities(scope, brand, persistenceIdentities, requireCompleteConsumptionUnit)
                .values()) {
            TargetRow row = targetRow(record);
            TargetIdentity identity = new TargetIdentity(row.itemRef(), row.productSkuRef());
            if (result.putIfAbsent(identity, row) != null)
                // spotless:off
                throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422,
                    "目标库存对象引用不唯一");
                // spotless:on
        }
        return result;
    }

    private Map<TargetIdentity, TargetRow> postInsertTargetRows(
            List<PlannedTarget> plannedTargets,
            Map<TargetIdentity, TargetRow> preflightTargetRows,
            Map<UUID, ReferenceMapping> mappings) {
        Map<TargetIdentity, TargetRow> result = new LinkedHashMap<>();
        for (PlannedTarget planned : plannedTargets) {
            TargetIdentity identity = new TargetIdentity(
                    planned.itemMapping().targetRef(),
                    planned.skuMapping() == null ? null : planned.skuMapping().targetRef());
            TargetRow existing = preflightTargetRows.get(identity);
            result.put(identity, existing == null ? insertedTargetRow(planned, mappings) : existing);
        }
        return result;
    }

    private TargetRow insertedTargetRow(PlannedTarget planned, Map<UUID, ReferenceMapping> mappings) {
        TargetRow source = planned.source();
        ReferenceMapping sku = planned.skuMapping();
        InventoryOwnerApi.UnitSnapshot consumption = mappedUnitSnapshot(source.consumptionUnitSnapshot(), mappings);
        InventoryConfiguration sourceConfiguration = configurationReadback(json(source.configuration()));
        InventoryOwnerApi.UnitSnapshot counting =
                mappedUnitSnapshot(sourceConfiguration.countingUnitSnapshot(), mappings);
        String inventoryMode = json(source.configuration()).path("mode").asText("");
        if (inventoryMode.isBlank())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存对象缺少 inventory mode");
        return new TargetRow(
                planned.targetMapping().targetRef(),
                planned.itemMapping().targetRef(),
                sku == null ? null : sku.targetRef(),
                requiredLabel(planned.itemMapping().targetCode(), "CATALOG_ITEM targetCode"),
                sku == null ? null : requiredLabel(sku.targetSkuCode(), "PRODUCT_SKU targetSkuCode"),
                source.measureMode(),
                BigDecimal.ZERO,
                mappedConfiguration(
                        source.configuration(), inventoryMode, counting, sourceConfiguration.conversionFactor()),
                1L,
                time.currentEpochMillis(),
                consumption,
                counting,
                sourceConfiguration.conversionFactor(),
                "ENABLED",
                inventoryMode,
                source.componentEligible());
    }

    private InventoryCopyPersistence.TargetWrite targetWrite(
            PlannedTarget target, String targetDataNodeRef, String brandRef, Map<UUID, ReferenceMapping> mappings) {
        ReferenceMapping sku = target.skuMapping();
        InventoryOwnerApi.UnitSnapshot consumption =
                mappedUnitSnapshot(target.source().consumptionUnitSnapshot(), mappings);
        InventoryConfiguration sourceConfiguration =
                configurationReadback(json(target.source().configuration()));
        InventoryOwnerApi.UnitSnapshot counting =
                mappedUnitSnapshot(sourceConfiguration.countingUnitSnapshot(), mappings);
        String inventoryMode =
                json(target.source().configuration()).path("mode").asText("");
        if (inventoryMode.isBlank())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存对象缺少 inventory mode");
        return new InventoryCopyPersistence.TargetWrite(
                target.targetMapping().targetRef(),
                targetDataNodeRef,
                brandRef,
                target.itemMapping().targetRef(),
                sku == null ? null : sku.targetRef(),
                requiredLabel(target.itemMapping().targetCode(), "CATALOG_ITEM targetCode"),
                sku == null ? null : requiredLabel(sku.targetSkuCode(), "PRODUCT_SKU targetSkuCode"),
                target.source().measureMode(),
                inventoryMode,
                consumption,
                counting,
                sourceConfiguration.conversionFactor(),
                mappedConfiguration(
                        target.source().configuration(),
                        inventoryMode,
                        counting,
                        sourceConfiguration.conversionFactor()),
                time.currentEpochMillis(),
                time.currentEpochMillis());
    }

    private InventoryCopyPersistence.BomWrite bomWrite(PreparedBom bom, String targetDataNodeRef, String brandRef) {
        return new InventoryCopyPersistence.BomWrite(
                targetDataNodeRef,
                brandRef,
                bom.item().targetRef(),
                bom.sku() == null ? null : bom.sku().targetRef(),
                bom.option() == null ? null : bom.option().targetRef(),
                requiredLabel(bom.item().targetCode(), "CATALOG_ITEM targetCode"),
                bom.sku() == null ? null : requiredLabel(bom.sku().targetSkuCode(), "PRODUCT_SKU targetSkuCode"),
                bom.option() == null
                        ? null
                        : requiredLabel(
                                bom.option().targetOptionValueCode(),
                                "CATALOG_ORDER_OPTION_DEFINITION_VALUE targetOptionValueCode"),
                bom.version(),
                bom.rows(),
                time.currentEpochMillis());
    }

    private List<TargetRow> loadTargetsByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        return persistence.readTargetsByItemRefs(scope, brand, itemRefs).stream()
                .map(record -> targetRow(record))
                .toList();
    }

    private Map<UUID, TargetRow> loadTargetsByRefs(String scope, String brand, Set<UUID> targetRefs) {
        return loadTargetsByRefs(scope, brand, targetRefs, true, true);
    }

    private Map<UUID, TargetRow> loadTargetsByRefs(
            String scope, String brand, Set<UUID> targetRefs, boolean requireCompleteConsumptionUnit) {
        return loadTargetsByRefs(scope, brand, targetRefs, true, requireCompleteConsumptionUnit);
    }

    private Map<UUID, TargetRow> loadTargetsByRefs(
            String scope,
            String brand,
            Set<UUID> targetRefs,
            boolean enabledOnly,
            boolean requireCompleteConsumptionUnit) {
        Map<UUID, TargetRow> resolved = new LinkedHashMap<>();
        for (InventoryCopyPersistence.TargetRecord record : persistence
                .readTargetsByRefs(scope, brand, targetRefs, enabledOnly, requireCompleteConsumptionUnit)
                .values()) {
            TargetRow row = targetRow(record);
            if (resolved.putIfAbsent(row.ref(), row) != null)
                // spotless:off
                throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422,
                    "目标库存对象引用不唯一");
                // spotless:on
        }
        return resolved;
    }

    private List<BomOwnerRow> loadBomOwnersByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        return persistence.readBomOwnersByItemRefs(scope, brand, itemRefs).stream()
                .map(row -> new BomOwnerRow(
                        row.itemRef(),
                        row.productSkuRef(),
                        row.optionValueRef(),
                        row.itemCode(),
                        row.skuCode(),
                        row.optionValueCode(),
                        row.version(),
                        row.rows()))
                .toList();
    }

    private List<TargetConfigurationRow> loadTargetConfigurationsByItemRefs(
            String scope, String brand, Collection<UUID> itemRefs) {
        return persistence.readTargetConfigurationsByItemRefs(scope, brand, itemRefs).stream()
                .map(row -> new TargetConfigurationRow(row.itemRef(), row.targetRef(), row.configuration()))
                .toList();
    }

    private List<String> loadBomRowsByItemRefs(String scope, String brand, Collection<UUID> itemRefs) {
        return persistence.readBomRowsByItemRefs(scope, brand, itemRefs);
    }

    private SourceCopyClosure sourceCopyClosure(
            String scope, String brand, List<UUID> initialItemRefs, LocalCopySectionPlan localSections) {
        if (localSections != null) return localSourceCopyClosure(scope, brand, initialItemRefs, localSections);
        LinkedHashSet<UUID> itemRefs = new LinkedHashSet<>();
        ArrayDeque<UUID> pendingItemRefs = new ArrayDeque<>();
        for (UUID itemRef : initialItemRefs) if (itemRefs.add(itemRef)) pendingItemRefs.add(itemRef);
        Map<UUID, TargetRow> targetsByRef = new LinkedHashMap<>();
        Map<String, BomOwnerRow> bomOwnersByIdentity = new LinkedHashMap<>();
        while (!pendingItemRefs.isEmpty()) {
            List<UUID> frontier = new ArrayList<>();
            while (!pendingItemRefs.isEmpty()) frontier.add(pendingItemRefs.removeFirst());
            Map<UUID, List<TargetRow>> targetsByItem = new LinkedHashMap<>();
            for (TargetRow target : loadTargetsByItemRefs(scope, brand, frontier))
                targetsByItem
                        .computeIfAbsent(target.itemRef(), ignored -> new ArrayList<>())
                        .add(target);
            Map<UUID, List<BomOwnerRow>> ownersByItem = new LinkedHashMap<>();
            for (BomOwnerRow owner : loadBomOwnersByItemRefs(scope, brand, frontier))
                ownersByItem
                        .computeIfAbsent(owner.itemRef(), ignored -> new ArrayList<>())
                        .add(owner);
            for (UUID itemRef : frontier) {
                for (TargetRow target : targetsByItem.getOrDefault(itemRef, List.of())) {
                    assertSourceNoOwnerReference(target, scope);
                    targetsByRef.putIfAbsent(target.ref(), target);
                }
                for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of())) {
                    if (bomOwnersByIdentity.putIfAbsent(bomOwnerIdentity(owner), owner) != null) continue;
                    JsonNode rows = json(owner.rows());
                    if (!rows.isArray()) {
                        throw new InventoryOwnerApi.Problem(
                                ("REFERENCE_MAPPING_UNRESOLVED"),
                                (422),
                                /* format-wrap */
                                ("库存 BOM 行不是有效数组"));
                    }
                }
            }
            LinkedHashSet<UUID> componentRefs = new LinkedHashSet<>();
            for (UUID itemRef : frontier)
                for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of()))
                    for (JsonNode row : json(owner.rows())) {
                        try {
                            componentRefs.add(UUID.fromString(row.path("targetRef")
                                    .asText(row.path("componentTargetRef").asText(""))));
                        } catch (IllegalArgumentException failure) {
                            String failureMessage = "库存 BOM 组件不在复制闭包中";
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                        }
                    }
            Map<UUID, TargetRow> componentsByRef = loadTargetsByRefs(scope, brand, componentRefs);
            for (UUID itemRef : frontier)
                for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of()))
                    for (JsonNode row : json(owner.rows())) {
                        UUID componentRef;
                        try {
                            componentRef = UUID.fromString(row.path("targetRef")
                                    .asText(row.path("componentTargetRef").asText("")));
                        } catch (IllegalArgumentException failure) {
                            String failureMessage = "库存 BOM 组件不在复制闭包中";
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                        }
                        TargetRow component = componentsByRef.get(componentRef);
                        if (component == null)
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED", 422, "库存 BOM 组件不在复制闭包中");
                        if (itemRefs.add(component.itemRef())) pendingItemRefs.add(component.itemRef());
                    }
        }
        return new SourceCopyClosure(
                List.copyOf(itemRefs),
                List.copyOf(targetsByRef.values()),
                List.copyOf(bomOwnersByIdentity.values()),
                List.of());
    }

    private SourceCopyClosure localSourceCopyClosure(
            String scope, String brand, List<UUID> initialItemRefs, LocalCopySectionPlan sections) {
        LinkedHashSet<UUID> itemRefs = new LinkedHashSet<>(initialItemRefs);
        Map<UUID, TargetRow> targetsByRef = new LinkedHashMap<>();
        List<BomOwnerRow> selectedOwners = new ArrayList<>();
        Set<String> presentSections = new LinkedHashSet<>();
        List<BomOwnerRow> sourceOwners = loadBomOwnersByItemRefs(scope, brand, initialItemRefs);
        Map<UUID, List<BomOwnerRow>> ownersByItem = new LinkedHashMap<>();
        for (BomOwnerRow owner : sourceOwners)
            ownersByItem
                    .computeIfAbsent(owner.itemRef(), ignored -> new ArrayList<>())
                    .add(owner);
        LinkedHashSet<UUID> componentRefs = new LinkedHashSet<>();
        for (UUID itemRef : initialItemRefs)
            for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of())) {
                String section = sectionForBomOwner(owner);
                if (!sections.selected().contains(section)) continue;
                presentSections.add(section);
                selectedOwners.add(owner);
                JsonNode rows = json(owner.rows());
                if (!rows.isArray()) {
                    throw new InventoryOwnerApi.Problem(
                            ("REFERENCE_MAPPING_UNRESOLVED"),
                            (422),
                            /* format-wrap */
                            ("库存 BOM 行不是有效数组"));
                }
                for (JsonNode row : rows)
                    try {
                        componentRefs.add(UUID.fromString(row.path("targetRef")
                                .asText(row.path("componentTargetRef").asText(""))));
                    } catch (IllegalArgumentException failure) {
                        String failureMessage = "库存 BOM 组件不在复制闭包中";
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                    }
            }
        Map<UUID, TargetRow> componentsByRef = loadTargetsByRefs(scope, brand, componentRefs);
        for (UUID itemRef : initialItemRefs)
            for (BomOwnerRow owner : ownersByItem.getOrDefault(itemRef, List.of())) {
                if (!sections.selected().contains(sectionForBomOwner(owner))) continue;
                for (JsonNode row : json(owner.rows())) {
                    UUID componentRef;
                    try {
                        componentRef = UUID.fromString(row.path("targetRef")
                                .asText(row.path("componentTargetRef").asText("")));
                    } catch (IllegalArgumentException failure) {
                        String failureMessage = "库存 BOM 组件不在复制闭包中";
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, failureMessage, failure);
                    }
                    TargetRow component = componentsByRef.get(componentRef);
                    if (component == null)
                        throw new InventoryOwnerApi.Problem(
                                ("REFERENCE_MAPPING_UNRESOLVED"), (422), ("库存 BOM 组件不在复制闭包中"));
                    assertSourceNoOwnerReference(component, scope);
                    itemRefs.add(component.itemRef());
                    targetsByRef.putIfAbsent(component.ref(), component);
                }
            }
        List<InventoryOwnerApi.LocalCopySkippedReadback> skipped = sections.selected().stream()
                .filter(section -> !presentSections.contains(section))
                .map(section -> new InventoryOwnerApi.LocalCopySkippedReadback(section, "SKIPPED_SOURCE_ABSENT"))
                .toList();
        return new SourceCopyClosure(
                List.copyOf(itemRefs), List.copyOf(targetsByRef.values()), List.copyOf(selectedOwners), skipped);
    }

    private void addLocalCatalogUnitIdentityMappings(
            Map<UUID, ReferenceMapping> mappings, SourceCopyClosure sourceClosure) {
        for (TargetRow target : sourceClosure.targets()) {
            addLocalCatalogUnitIdentityMapping(mappings, target.consumptionUnitSnapshot());
            addLocalCatalogUnitIdentityMapping(mappings, target.countingUnitSnapshot());
        }
        for (BomOwnerRow owner : sourceClosure.bomOwners()) {
            for (JsonNode row : json(owner.rows())) {
                addLocalCatalogUnitIdentityMapping(
                        mappings,
                        requiredUnitSnapshot(row.path("consumptionUnitSnapshot"), "BOM consumptionUnitSnapshot"));
            }
        }
    }

    private static void addLocalCatalogUnitIdentityMapping(
            Map<UUID, ReferenceMapping> mappings, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) return;
        mappings.putIfAbsent(
                snapshot.unitRef(),
                new ReferenceMapping(
                        "CATALOG_UNIT",
                        snapshot.unitRef(),
                        snapshot.code(),
                        null,
                        null,
                        snapshot.name(),
                        snapshot.unitDimension(),
                        snapshot.precision()));
    }

    private LocalCopySectionPlan localCopySectionPlan(ObjectNode request) {
        if (!request.has("selectedSections")) return null;
        LinkedHashSet<String> selected = new LinkedHashSet<>();
        JsonNode values = request.path("selectedSections");
        if (values.isArray())
            for (JsonNode value : values)
                if (Set.of("SKU_BOM", "OPTION_VALUE_BOM", "ITEM_BOM").contains(value.asText()))
                    selected.add(value.asText());
        return new LocalCopySectionPlan(Set.copyOf(selected));
    }

    private static String sectionForBomOwner(BomOwnerRow owner) {
        if (owner.productSkuRef() != null) return "SKU_BOM";
        if (owner.optionValueRef() != null) return "OPTION_VALUE_BOM";
        return "ITEM_BOM";
    }

    private static TargetRow targetRow(InventoryCopyPersistence.TargetRecord row) {
        return new TargetRow(
                row.ref(),
                row.itemRef(),
                row.productSkuRef(),
                row.itemCode(),
                row.skuCode(),
                row.measureMode(),
                row.balance(),
                row.configuration(),
                row.version(),
                row.updatedAt(),
                row.consumptionUnitSnapshot(),
                row.countingUnitSnapshot(),
                row.countingUnitConversionFactor(),
                row.definitionStatus(),
                row.inventoryMode(),
                row.componentEligible());
    }

    private static TargetRow targetRow(java.sql.ResultSet row) throws java.sql.SQLException {
        return targetRow(row, 1, null);
    }

    private static TargetRow targetRowWithConsumptionUnitSnapshot(java.sql.ResultSet row) throws java.sql.SQLException {
        return targetRowWithConsumptionUnitSnapshot(row, 1);
    }

    private static TargetRow targetRowWithConsumptionUnitSnapshot(java.sql.ResultSet row, int firstColumn)
            throws java.sql.SQLException {
        return targetRow(row, firstColumn, requiredUnitSnapshot(row, firstColumn + 10));
    }

    private static TargetRow targetRow(java.sql.ResultSet row, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot)
            throws java.sql.SQLException {
        return targetRow(row, 1, consumptionUnitSnapshot);
    }

    private static TargetRow targetRow(
            java.sql.ResultSet row, int firstColumn, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot)
            throws java.sql.SQLException {
        boolean hasUnitConfigurationColumns = row.getMetaData().getColumnCount() >= firstColumn + 22;
        return new TargetRow(
                row.getObject(firstColumn, UUID.class),
                row.getObject(firstColumn + 1, UUID.class),
                row.getObject(firstColumn + 2, UUID.class),
                row.getString(firstColumn + 3),
                row.getString(firstColumn + 4),
                row.getString(firstColumn + 5),
                row.getBigDecimal(firstColumn + 6),
                row.getString(firstColumn + 7),
                row.getLong(firstColumn + 8),
                row.getLong(firstColumn + 9),
                consumptionUnitSnapshot,
                hasUnitConfigurationColumns ? unitSnapshot(row, firstColumn + 15) : null,
                hasUnitConfigurationColumns ? row.getBigDecimal(firstColumn + 20) : null,
                hasUnitConfigurationColumns ? row.getString(firstColumn + 21) : "ENABLED",
                hasUnitConfigurationColumns ? row.getString(firstColumn + 22) : null,
                row.getMetaData().getColumnCount() >= firstColumn + 23 && row.getBoolean(firstColumn + 23));
    }

    private static InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(java.sql.ResultSet result, int firstColumn)
            throws java.sql.SQLException {
        InventoryOwnerApi.UnitSnapshot snapshot = unitSnapshot(result, firstColumn);
        if (snapshot == null)
            throw new InventoryOwnerApi.Problem(
                    "CONSUMPTION_UNIT_SNAPSHOT_REQUIRED", 422, INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT);
        return snapshot;
    }

    private void assertSourceNoOwnerReference(TargetRow row, String sourceScope) {
        assertJsonNoOwnerReference(json(row.configuration()), sourceScope);
    }

    private void verifyTargetNoOwnerReference(
            String targetScope, String brand, List<UUID> itemRefs, String sourceScope) {
        for (TargetConfigurationRow row : loadTargetConfigurationsByItemRefs(targetScope, brand, itemRefs))
            assertJsonNoOwnerReference(json(row.configuration()), sourceScope);
        for (String rows : loadBomRowsByItemRefs(targetScope, brand, itemRefs))
            assertJsonNoOwnerReference(json(rows), sourceScope);
    }

    private void assertJsonNoOwnerReference(JsonNode node, String sourceScope) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                JsonNode value = entry.getValue();
                if (Set.of("headCompanyRef", "ownerRef", "dataNodeRef", "scopeRef", "originScopeRef")
                                .contains(entry.getKey())
                        && value.isTextual()
                        && sourceScope.equals(value.asText())) {
                    {
                        throw new InventoryOwnerApi.Problem(
                                ("OWNER_REFERENCE_LEAK"),
                                (422),
                                /* format-wrap */
                                ("库存目标仍含来源 owner 引用"));
                    }
                }
                assertJsonNoOwnerReference(value, sourceScope);
            }
        } else if (node.isArray()) node.forEach(value -> assertJsonNoOwnerReference(value, sourceScope));
    }

    private PreparedBom rewrittenBom(
            String sourceScope,
            String targetScope,
            String brand,
            BomOwnerRow source,
            Map<UUID, UUID> targetRefs,
            Map<UUID, ReferenceMapping> mappings) {
        JsonNode parsed = json(source.rows());
        if (!parsed.isArray()) {
            throw new InventoryOwnerApi.Problem(
                    ("REFERENCE_MAPPING_UNRESOLVED"),
                    (422),
                    /* format-wrap */
                    ("库存 BOM 行不是有效数组"));
        }
        ArrayNode rewritten = mapper.createArrayNode();
        for (JsonNode line : parsed) {
            if (!line.isObject()) {
                throw new InventoryOwnerApi.Problem(("VALIDATION_ERROR"), (422), ("库存 BOM 行不是对象"));
            }
            ObjectNode row = (ObjectNode) line.deepCopy();
            String sourceRef =
                    row.path("targetRef").asText(row.path("componentTargetRef").asText(""));
            UUID mapped;
            try {
                mapped = targetRefs.get(UUID.fromString(sourceRef));
            } catch (IllegalArgumentException failure) {
                mapped = null;
            }
            if (mapped == null) {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存 BOM 组件不在复制闭包中"));
            }
            InventoryOwnerApi.UnitSnapshot consumption = mappedUnitSnapshot(
                    requiredUnitSnapshot(row.path("consumptionUnitSnapshot"), "BOM consumptionUnitSnapshot"), mappings);
            row.put("targetRef", mapped.toString());
            row.remove("componentTargetRef");
            row.remove("unit");
            row.remove("consumptionUnit");
            row.remove("countingUnit");
            row.set("consumptionUnitSnapshot", mapper.valueToTree(consumption));
            ReferenceMapping itemMapping = mappingFor(mappings, source.itemRef(), "CATALOG_ITEM");
            ReferenceMapping skuMapping =
                    source.productSkuRef() == null ? null : mappingFor(mappings, source.productSkuRef(), "PRODUCT_SKU");
            ReferenceMapping optionMapping = source.optionValueRef() == null
                    ? null
                    : mappingFor(mappings, source.optionValueRef(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
            row.put("ownerRef", itemMapping.targetRef().toString());
            if (skuMapping == null) row.putNull("productSkuRef");
            else row.put("productSkuRef", skuMapping.targetRef().toString());
            if (optionMapping == null) row.putNull("optionValueRef");
            else row.put("optionValueRef", optionMapping.targetRef().toString());
            rewritten.add(row);
        }
        assertJsonNoOwnerReference(rewritten, sourceScope);
        ReferenceMapping itemMapping = mappingFor(mappings, source.itemRef(), "CATALOG_ITEM");
        ReferenceMapping skuMapping =
                source.productSkuRef() == null ? null : mappingFor(mappings, source.productSkuRef(), "PRODUCT_SKU");
        ReferenceMapping optionMapping = source.optionValueRef() == null
                ? null
                : mappingFor(mappings, source.optionValueRef(), "CATALOG_ORDER_OPTION_DEFINITION_VALUE");
        return new PreparedBom(itemMapping, skuMapping, optionMapping, source.version(), canonical(rewritten));
    }

    private String targetIdentityCode(String itemCode, String skuCode) {
        return itemCode + (skuCode == null || skuCode.isBlank() ? "" : "::" + skuCode);
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

    private void recheckCopySourceFactsBeforeReceipt(String sourceScope, String brand, ObjectNode request) {
        List<UUID> refs = requiredOpaqueRefArray(request, "closureItemRefs");
        LocalCopySectionPlan localSections = localCopySectionPlan(request);
        SourceCopyClosure closure = sourceCopyClosure(sourceScope, brand, refs, localSections);
        if (localSections != null) return;
        if (closure.itemRefs().size() != refs.size()) {
            {
                throw new InventoryOwnerApi.Problem(
                        ("REFERENCE_MAPPING_UNRESOLVED"),
                        (422),
                        /* format-wrap */
                        ("库存复制来源事实已变化"));
            }
        }
    }

    private TargetRow target(String scope, String brand, String ref) {
        try {
            UUID id = UUID.fromString(ref);
            return targetRow(persistence.readTarget(scope, brand, id));
        } catch (EmptyResultDataAccessException | IllegalArgumentException ex) {
            throw new InventoryOwnerApi.Problem("NOT_FOUND", 404, "库存对象不存在", ex);
        }
    }

    private java.util.Map<UUID, ChangeSnapshot> loadChangeSnapshots(List<TargetRow> targets) {
        if (targets == null || targets.isEmpty()) return java.util.Map.of();
        List<UUID> targetRefs = targets.stream().map(TargetRow::ref).toList();
        java.util.Map<UUID, ChangeSnapshot> snapshots = new java.util.HashMap<>();
        for (Map.Entry<UUID, InventoryCopyPersistence.ChangeSnapshotRecord> entry : persistence
                .readChangeSnapshots(targetRefs, time.currentEpochMillis())
                .entrySet()) {
            InventoryCopyPersistence.ChangeSnapshotRecord snapshot = entry.getValue();
            snapshots.put(
                    entry.getKey(),
                    new ChangeSnapshot(
                            snapshot.today(),
                            snapshot.sevenDays(),
                            snapshot.thirtyDays(),
                            snapshot.lastSource(),
                            snapshot.lastAt()));
        }
        return snapshots;
    }

    private String bomOwnerIdentity(BomOwnerRow owner) {
        return owner.itemRef() + "::"
                + (owner.optionValueRef() == null
                        ? (owner.productSkuRef() == null ? "ITEM" : "SKU:" + owner.productSkuRef())
                        : "OPTION_VALUE:" + owner.optionValueRef());
    }

    private ObjectNode targetListRow(
            TargetRow row,
            CatalogTargetDisplay display,
            String queriedState,
            boolean queriedUnknown,
            ChangeSnapshot snapshot) {
        JsonNode config = json(row.configuration());
        BigDecimal threshold = decimalNode(config, "lowStockThreshold");
        String stockState = queriedState == null ? state(row.balance(), config) : queriedState;
        BigDecimal factor = decimalNode(config, "conversionFactor");
        if (factor.signum() <= 0) factor = BigDecimal.ONE;
        InventoryOwnerApi.UnitSnapshot consumption = consumptionUnitSnapshot(row.ref());
        InventoryOwnerApi.UnitSnapshot counting = config.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(config.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        BigDecimal today = snapshot == null ? BigDecimal.ZERO : snapshot.today();
        BigDecimal seven = snapshot == null ? BigDecimal.ZERO : snapshot.sevenDays();
        BigDecimal thirty = snapshot == null ? BigDecimal.ZERO : snapshot.thirtyDays();
        ObjectNode result = mapper.createObjectNode()
                .put("targetRef", row.ref().toString())
                .put("itemRef", row.itemRef().toString())
                .put("targetType", inventoryTargetType(row.productSkuRef()))
                .put("productCode", display.itemCode())
                .put("productName", display.itemName())
                .putNull("productSkuRef")
                .putNull("skuCode")
                .putNull("skuName")
                .putNull("categoryName")
                .putNull("materialRole")
                .put(
                        "conversionSummary",
                        unitLabel(counting) + " -> " + unitLabel(consumption) + " × " + decimal(factor))
                .put("balance", decimal(row.balance()))
                .put("stockState", stockState)
                .put("stale", false)
                .put("unknown", queriedUnknown || "UNKNOWN".equals(stockState))
                .put("threshold", decimal(threshold))
                .put("gap", decimal(threshold.subtract(row.balance())))
                .put("changeToday", decimal(today))
                .put("change7d", decimal(seven))
                .put("change30d", decimal(thirty))
                .put("authorityType", "INTERNAL");
        setNullableSnapshot(result, "consumptionUnitSnapshot", consumption);
        setNullableSnapshot(result, "countingUnitSnapshot", counting);
        setConversionFacts(result, counting, consumption, factor);
        if (snapshot == null || snapshot.lastSource() == null) result.putNull("lastChangeSource");
        else result.put("lastChangeSource", snapshot.lastSource());
        if (snapshot == null || snapshot.lastAt() == null) result.putNull("lastChangeAt");
        else result.put("lastChangeAt", snapshot.lastAt());
        if (row.productSkuRef() != null)
            result.put("productSkuRef", row.productSkuRef().toString());
        if (row.productSkuRef() != null)
            result.put("skuCode", display.skuCode()).put("skuName", display.skuName());
        return result;
    }

    private void setConversionFacts(
            ObjectNode target,
            InventoryOwnerApi.UnitSnapshot counting,
            InventoryOwnerApi.UnitSnapshot consumption,
            BigDecimal factor) {
        ObjectNode facts = target.putObject("conversionFacts");
        if (counting == null) facts.putNull("countingUnitSnapshot");
        else facts.set("countingUnitSnapshot", mapper.valueToTree(counting));
        facts.set("consumptionUnitSnapshot", mapper.valueToTree(consumption));
        facts.put("conversionFactor", decimal(factor));
    }

    private long generation(String scope, String brand) {
        return persistence.readGeneration(scope, brand);
    }

    private JsonNode receiptRequest(JsonNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String scope, String key, String operation, JsonNode request) {
        AdvisoryLock.acquire(jdbc, "inventory-receipt", scope, key);
        InventoryCopyPersistence.ReceiptRecord receipt = persistence.readReceipt(scope, key);
        if (receipt == null) return null;
        if (!receipt.operation().equals(operation) || !receipt.requestHash().equals(hash(request)))
            throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return json(receipt.response());
    }

    private void saveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        persistence.saveReceipt(
                UUID.randomUUID(),
                scope,
                key,
                operation,
                hash(request),
                canonical(response),
                time.currentEpochMillis());
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private JsonNode json(String text) {
        if (text == null || text.isBlank())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is missing");
        try {
            JsonNode parsed = mapper.readTree(text);
            if (parsed == null || parsed.isNull())
                throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is null");
            return parsed;
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception ex) {
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is invalid", ex);
        }
    }

    private String canonical(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", ex);
        }
    }

    private String hash(JsonNode value) {
        try {
            return Sha256Hex.digest(canonical(value));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private ObjectNode copyDigestSnapshot(ObjectNode snapshot) {
        ObjectNode stable = snapshot.deepCopy();
        for (String field : List.of("referenceMappings", "referenceRewritePreview")) {
            JsonNode rows = stable.path(field);
            if (!rows.isArray()) continue;
            for (JsonNode row : rows) if (row instanceof ObjectNode object) object.putNull("targetRef");
        }
        return stable;
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }

    private BigDecimal decimalNode(JsonNode node, String key) {
        JsonNode value = node.path(key);
        return value.isNumber()
                ? value.decimalValue()
                : value.isTextual() ? new BigDecimal(value.asText()) : BigDecimal.ZERO;
    }

    private static BigDecimal decimalValue(ObjectNode req, String key) {
        JsonNode v = req.get(key);
        if (v == null || (!v.isNumber() && !v.isTextual()))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal");
        try {
            return new BigDecimal(v.asText());
        } catch (NumberFormatException ex) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal", ex);
        }
    }

    private static UUID requiredUuid(JsonNode node, String key) {
        if (node == null || !node.hasNonNull(key) || !node.path(key).isTextual())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        try {
            return UUID.fromString(node.path(key).asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be a UUID", failure);
        }
    }

    private static String unitLabel(InventoryOwnerApi.UnitSnapshot unit) {
        return unit == null ? "库存消耗单位" : unit.name();
    }

    private InventoryOwnerApi.UnitSnapshot mappedUnitSnapshot(
            InventoryOwnerApi.UnitSnapshot source, Map<UUID, ReferenceMapping> mappings) {
        if (source == null) return null;
        ReferenceMapping mapping = mappings.get(source.unitRef());
        if (mapping == null || !"CATALOG_UNIT".equals(mapping.objectType()))
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "库存复制所需单位引用未完成映射");
        if (mapping.targetUnitName() == null
                || mapping.targetUnitDimension() == null
                || mapping.targetUnitPrecision() == null)
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "库存复制所需单位快照不完整");
        return new InventoryOwnerApi.UnitSnapshot(
                mapping.targetRef(),
                requiredLabel(mapping.targetCode(), "CATALOG_UNIT targetCode"),
                mapping.targetUnitName(),
                mapping.targetUnitDimension(),
                mapping.targetUnitPrecision());
    }

    private String mappedConfiguration(
            String sourceJson,
            String inventoryMode,
            InventoryOwnerApi.UnitSnapshot counting,
            BigDecimal conversionFactor) {
        JsonNode parsed = json(sourceJson);
        if (!parsed.isObject())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存配置 JSON fact is not an object");
        ObjectNode configuration = (ObjectNode) parsed.deepCopy();
        configuration.put("mode", inventoryMode);
        writeCountingConfiguration(
                configuration,
                new InventoryOwnerApi.CountingUnitConfiguration(
                        counting, conversionFactor == null ? BigDecimal.ONE : conversionFactor));
        return canonical(configuration);
    }

    private void setNullableSnapshot(ObjectNode target, String field, InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) target.putNull(field);
        else target.set(field, mapper.valueToTree(snapshot));
    }

    private static List<UUID> requiredOpaqueRefArray(ObjectNode request, String key) {
        JsonNode values = request == null ? null : request.get(key);
        if (values == null || !values.isArray() || values.isEmpty())
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must contain opaque UUID refs");
        List<UUID> refs = new ArrayList<>();
        for (JsonNode value : values) {
            if (!value.isTextual())
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must contain opaque UUID refs");
            try {
                refs.add(UUID.fromString(value.asText()));
            } catch (IllegalArgumentException exception) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, key + " cannot contain a business code", exception);
            }
        }
        return refs.stream().distinct().toList();
    }

    private static Map<UUID, ReferenceMapping> referenceMappings(ObjectNode request) {
        JsonNode values = request == null ? null : request.get("referenceMappings");
        if (values == null || !values.isArray())
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings is required for inventory copy");
        Map<UUID, ReferenceMapping> result = new LinkedHashMap<>();
        for (JsonNode value : values) {
            if (!value.isObject())
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED", 422, "referenceMappings must contain objects");
            UUID sourceRef = opaqueRefValue(value, "sourceRef");
            UUID targetRef = opaqueRefValue(value, "targetRef");
            String objectType = value.path("objectType").asText("");
            if (!INVENTORY_COPY_MAPPING_TYPES.contains(objectType)) continue;
            if (result.putIfAbsent(
                            sourceRef,
                            new ReferenceMapping(
                                    objectType,
                                    targetRef,
                                    value.path("targetCode").asText(null),
                                    value.path("targetSkuCode").asText(null),
                                    value.path("targetOptionValueCode").asText(null),
                                    value.path("targetUnitName").asText(null),
                                    value.path("targetUnitDimension").asText(null),
                                    value.hasNonNull("targetUnitPrecision")
                                            ? value.path("targetUnitPrecision").asInt()
                                            : null))
                    != null) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        "referenceMappings contains duplicate inventory sourceRef");
            }
        }
        // Digest-producing copy preflight must preserve the request order. A hash-table copy can reorder mappings
        // between the preflight and execute requests even when the underlying facts are unchanged.
        return result;
    }

    private static UUID opaqueRefValue(JsonNode node, String key) {
        String value = node.path(key).asText("");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", exception);
        }
    }

    private static ReferenceMapping mappingFor(
            Map<UUID, ReferenceMapping> mappings, UUID sourceRef, String objectType) {
        ReferenceMapping mapping = mappings.get(sourceRef);
        if (mapping == null || !objectType.equals(mapping.objectType()))
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED",
                    422,
                    /* format-wrap */
                    "库存复制所需的引用关系无法确定");
        return mapping;
    }

    private static String requiredLabel(String value, String field) {
        if (value == null || value.isBlank())
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, field + " is required as a read label");
        return value;
    }

    private static String optional(ObjectNode req, String key) {
        return CollectionRequestSupport.optional(req, key);
    }

    static void requireCatalogDefinitionDataNodeType(String dataNodeType) {
        if (!Set.of("STORE", "HEAD_COMPANY").contains(dataNodeType)) {
            throw new InventoryOwnerApi.Problem(
                    ("SCOPE_FORBIDDEN"),
                    (403),
                    /* format-wrap */
                    ("商品库存定义只支持门店或总公司数据节点"));
        }
    }

    private static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    private static void requireOwnerScopeGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            String dataNodeRef,
            String expectedCapability,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || expectedCapability == null)
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory owner scope grant is required");
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null
                    && ownerScopeGrant.matchesCapability(
                            workspaceUuid, groupWorkspaceKey, dataNodeType, targetId, expectedCapability)) return;
        } catch (RuntimeException ignored) {
        }
        throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory owner scope grant is required");
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
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory execution context is required");
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
            throw new InventoryOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "inventory execution context is not authorized");
        }
        return scope;
    }

    private static CatalogAuthorizationScope requireCopyContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String operationId = context.operationToken().operationId();
        if (!Set.of(
                        "preflightOperationsBrandCatalogCopy",
                        "executeOperationsBrandCatalogCopy",
                        "preflightOperationsLocalCatalogCopy",
                        "executeOperationsLocalCatalogCopy")
                .contains(operationId)) {
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "inventory copy context is not authorized");
        }
        return scope;
    }

    private static String copySourceDataNodeRef(CatalogAuthorizationScope scope) {
        return switch (scope.copySourcePolicy()) {
            case TARGET_SCOPE -> scope.dataNodeId().toString();
            case ORGANIZATION_JUDGMENT -> {
                if (scope.copySourceDataNodeId() == null)
                    throw new InventoryOwnerApi.Problem(
                            "SCOPE_FORBIDDEN", 403, "inventory copy source judgment is required");
                yield scope.copySourceDataNodeId().toString();
            }
            default -> throw new InventoryOwnerApi.Problem(
                    "SCOPE_FORBIDDEN", 403, "inventory copy source policy is not authorized");
        };
    }

    private void lockProductSkuRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x43534B55, refs);
    }

    private void lockCatalogItemRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
    }

    private void lockCatalogOptionValueRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x434F5056, refs);
    }

    static String state(BigDecimal balance, JsonNode config) {
        if (config.path("unknown").asBoolean(false)) return "UNKNOWN";
        if (balance.signum() < 0) return "NEGATIVE";
        if (balance.signum() == 0) return "OUT";
        JsonNode thresholdNode =
                config.has("lowStockThreshold") ? config.path("lowStockThreshold") : config.path("threshold");
        BigDecimal threshold;
        try {
            threshold = thresholdNode.isNumber()
                    ? thresholdNode.decimalValue()
                    : thresholdNode.isTextual() ? new BigDecimal(thresholdNode.asText()) : BigDecimal.ZERO;
        } catch (NumberFormatException ignored) {
            threshold = BigDecimal.ZERO;
        }
        return threshold.signum() > 0 && balance.compareTo(threshold) < 0 ? "LOW" : "OK";
    }

    static String inventoryTargetType(UUID productSkuRef) {
        return productSkuRef == null ? "CATALOG_ITEM" : "SKU";
    }

    private String stockTargetCompatibilityId(TargetRow source) {
        return "STOCK_TARGET:" + source.itemRef() + ":"
                + (source.productSkuRef() == null ? "-" : source.productSkuRef());
    }

    private record OwnerIdentity(
            String ownerType,
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode) {
        String key() {
            return ownerType + ":" + itemRef + ":" + (productSkuRef == null ? "-" : productSkuRef) + ":"
                    + (optionValueRef == null ? "-" : optionValueRef);
        }
    }

    private record TargetRow(
            UUID ref,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            String measureMode,
            BigDecimal balance,
            String configuration,
            long version,
            long updatedAt,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot,
            InventoryOwnerApi.UnitSnapshot countingUnitSnapshot,
            BigDecimal countingUnitConversionFactor,
            String definitionStatus,
            String inventoryMode,
            boolean componentEligible) {}

    private record TargetIdentity(UUID itemRef, UUID productSkuRef) {}

    private record CatalogTargetDisplay(String itemCode, String itemName, String skuCode, String skuName) {}

    private record TargetConfigurationRow(UUID itemRef, UUID targetRef, String configuration) {}

    private record PlannedTarget(
            TargetRow source,
            ReferenceMapping itemMapping,
            ReferenceMapping skuMapping,
            ReferenceMapping targetMapping) {}

    private record BomOwnerRow(
            UUID itemRef,
            UUID productSkuRef,
            UUID optionValueRef,
            String itemCode,
            String skuCode,
            String optionValueCode,
            long version,
            String rows) {}

    private record PreparedBom(
            ReferenceMapping item, ReferenceMapping sku, ReferenceMapping option, long version, String rows) {}

    private record LocalCopySectionPlan(Set<String> selected) {}

    private record SourceCopyClosure(
            List<UUID> itemRefs,
            List<TargetRow> targets,
            List<BomOwnerRow> bomOwners,
            List<InventoryOwnerApi.LocalCopySkippedReadback> skipped) {}

    private record PreflightCopyResult(JsonNode judgement, Map<TargetIdentity, TargetRow> targetRows) {}

    private record PreparedCopy(
            SourceCopyClosure sourceClosure,
            JsonNode judgement,
            Map<TargetIdentity, TargetRow> preflightTargetRows,
            InventoryOwnerApi.LocalCopyPreflightReadback readback)
            implements InventoryOwnerApi.CopyExecutionPreparation {
        @Override
        public InventoryOwnerApi.LocalCopyPreflightReadback preflight() {
            return readback;
        }
    }

    private record ReferenceMapping(
            String objectType,
            UUID targetRef,
            String targetCode,
            String targetSkuCode,
            String targetOptionValueCode,
            String targetUnitName,
            String targetUnitDimension,
            Integer targetUnitPrecision) {}

    private record ChangeSnapshot(
            BigDecimal today, BigDecimal sevenDays, BigDecimal thirtyDays, String lastSource, Long lastAt) {}

    private record Receipt(String operation, String requestHash, JsonNode response) {}
}
