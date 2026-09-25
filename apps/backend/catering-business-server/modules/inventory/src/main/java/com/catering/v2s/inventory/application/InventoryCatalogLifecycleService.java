package com.catering.v2s.inventory.application;

import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.inventory.application.persistence.InventoryCatalogLifecyclePersistence;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Light inventory owner. It never writes catalog or organization schemas. */

/** Concrete Inventory lifecycle owner. */
@Service
public class InventoryCatalogLifecycleService {
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

    private final InventoryCatalogLifecyclePersistence persistence;
    private final ObjectMapper mapper;

    @Autowired
    public InventoryCatalogLifecycleService(InventoryCatalogLifecyclePersistence persistence, ObjectMapper mapper) {
        this.persistence = persistence;
        this.mapper = mapper;
    }

    public InventoryCatalogLifecycleService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this(new InventoryCatalogLifecyclePersistence(jdbc, time), mapper);
    }

    @Transactional
    public void validateCatalogUnitLifecycle(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID unitRef,
            CatalogUnitLifecycleChange intendedChange) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (unitRef == null || intendedChange == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "单位生命周期判断参数不完整");
        InventoryCatalogLifecyclePersistence.UnitLifecycleUsage usage =
                persistence.readUnitLifecycleUsage(scope.dataNodeId().toString(), scope.brandRef(), unitRef);
        List<UUID> targetRefs = usage.targetRefs();
        long ledgerCount = usage.ledgerCount();
        long bomCount = usage.bomCount();
        if ((intendedChange == CatalogUnitLifecycleChange.UPDATE_DEFINITION
                        || intendedChange == CatalogUnitLifecycleChange.DELETE)
                && (!targetRefs.isEmpty() || ledgerCount > 0 || bomCount > 0)) {
            String message = intendedChange == CatalogUnitLifecycleChange.DELETE
                    ? "该计量单位正在使用，不能删除。"
                    : "该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择";
            throw new InventoryOwnerApi.Problem(
                    "CATALOG_UNIT_IN_USE",
                    409,
                    /* format-wrap */
                    message);
        }
    }

    @Transactional
    public void validateCatalogItemBaseMeasureUnitTransition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID itemRef,
            UnitSnapshot itemBaseMeasureUnit,
            List<CatalogSkuBaseMeasureUnit> skuBaseMeasureUnits) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (itemRef == null || skuBaseMeasureUnits == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, ITEM_BASE_UNIT_ARGS);
        persistence.lockCatalogItemRefs(List.of(itemRef));
        persistence.lockProductSkuRefs(skuBaseMeasureUnits.stream()
                .map(CatalogSkuBaseMeasureUnit::productSkuRef)
                .toList());
        Map<UUID, UnitSnapshot> skuUnits = new LinkedHashMap<>();
        for (CatalogSkuBaseMeasureUnit entry : skuBaseMeasureUnits) {
            if (entry.productSkuRef() == null)
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, SKU_BASE_UNIT_ARGS);
            skuUnits.put(entry.productSkuRef(), entry.unitSnapshot());
        }
        List<InventoryCatalogLifecyclePersistence.TargetConsumptionUnitRow> targets =
                persistence.readTargetConsumptionUnitRows(scope.dataNodeId().toString(), scope.brandRef(), itemRef);
        for (InventoryCatalogLifecyclePersistence.TargetConsumptionUnitRow target : targets) {
            UnitSnapshot candidate =
                    target.productSkuRef() == null ? itemBaseMeasureUnit : skuUnits.get(target.productSkuRef());
            if (candidate == null || !java.util.Objects.equals(candidate.unitRef(), target.consumptionUnitRef()))
                throw new InventoryOwnerApi.Problem(
                        "CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED",
                        409,
                        /* format-wrap */
                        "基础计量单位变更会改变既有库存对象的消费单位");
        }
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

    private JsonNode typedReceiptRequest(Object command, String dataNodeRef, String brandRef) {
        ObjectNode request = mapper.valueToTree(command);
        request.put("dataNodeRef", dataNodeRef);
        request.put("receiptBrandRef", brandRef);
        return request;
    }

    private <T> T replayTyped(String scope, String key, String operation, JsonNode request, Class<T> readbackType) {
        JsonNode replay = replay(scope, key, operation, request);
        if (replay == null) return null;
        try {
            return mapper.treeToValue(replay, readbackType);
        } catch (Exception failure) {
            {
                throw new InventoryOwnerApi.Problem(
                        ("IDEMPOTENCY_MISMATCH"), (409), ("幂等回执与当前 owner readback 不兼容"), (failure));
            }
        }
    }

    private void saveTypedReceipt(String scope, String key, String operation, JsonNode request, Object readback) {
        saveReceipt(scope, key, operation, request, mapper.valueToTree(readback));
    }

    @Transactional(readOnly = true)
    public JsonNode catalogItemVoidDependencies(String scope, String brand, String itemRef, String requestId) {
        requireScope(scope, brand);
        UUID catalogItemRef = opaqueRef(itemRef, "itemRef");
        return catalogVoidDependencyJson(catalogVoidDependenciesReadback(
                scope, brand, new CatalogVoidSubject(CatalogVoidSubjectKind.CATALOG_ITEM, catalogItemRef)));
    }

    @Transactional(readOnly = true)
    public JsonNode catalogSkuVoidDependencies(String scope, String brand, String skuRef, String requestId) {
        requireScope(scope, brand);
        UUID productSkuRef = opaqueRef(skuRef, "productSkuRef");
        return catalogVoidDependencyJson(catalogVoidDependenciesReadback(
                scope, brand, new CatalogVoidSubject(CatalogVoidSubjectKind.PRODUCT_SKU, productSkuRef)));
    }

    @Transactional(readOnly = true)
    public List<JsonNode> catalogSkuVoidDependenciesByRefs(
            String scope, String brand, List<UUID> skuRefs, String requestId) {
        requireScope(scope, brand);
        List<UUID> ordered = skuRefs == null
                ? List.of()
                : skuRefs.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ordered.isEmpty()) return List.of();
        Map<UUID, CatalogVoidDependencyReadback> readbacks =
                catalogVoidDependenciesReadbacks(scope, brand, CatalogVoidSubjectKind.PRODUCT_SKU, ordered);
        return ordered.stream()
                .map(ref -> {
                    CatalogVoidDependencyReadback readback = readbacks.get(ref);
                    if (readback == null) {
                        String reason = "inventory SKU void dependency readback is missing";
                        throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, reason);
                    }
                    return (JsonNode) catalogVoidDependencyJson(readback);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public CatalogItemVoidDependencyReadback catalogItemVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemRef) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        UUID catalogItemRef = opaqueRef(itemRef, "itemRef");
        CatalogVoidDependencyReadback judgement = catalogVoidDependenciesReadback(
                dataNodeRef,
                scope.brandRef(),
                new CatalogVoidSubject(CatalogVoidSubjectKind.CATALOG_ITEM, catalogItemRef));
        return new CatalogItemVoidDependencyReadback(
                judgement.hasInboundBomReferences(),
                judgement.ownedActiveStockTargetCount(),
                judgement.ownedActiveProductBomCount());
    }

    @Transactional(readOnly = true)
    public CatalogVoidDependencyReadback catalogVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, CatalogVoidSubject subject) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        requireCatalogVoidSubject(subject);
        return catalogVoidDependenciesReadback(scope.dataNodeId().toString(), scope.brandRef(), subject);
    }

    @Transactional(readOnly = true)
    public List<CatalogVoidDependencyReadback> catalogVoidDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubjectKind kind,
            List<UUID> references) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        if (kind == null) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "catalog void subject kind is required");
        }
        List<UUID> ordered = references == null
                ? List.of()
                : references.stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        if (ordered.isEmpty()) return List.of();
        Map<UUID, CatalogVoidDependencyReadback> readbacks =
                catalogVoidDependenciesReadbacks(scope.dataNodeId().toString(), scope.brandRef(), kind, ordered);
        return ordered.stream()
                .map(ref -> {
                    CatalogVoidDependencyReadback readback = readbacks.get(ref);
                    if (readback == null)
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED", 422, "inventory void dependency readback is missing");
                    return readback;
                })
                .toList();
    }

    @Transactional
    public CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitions(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        requireCatalogVoidSubject(subject);
        String key = requireIdempotencyKey(idempotencyKey);
        String dataNodeRef = scope.dataNodeId().toString();
        ObjectNode request = mapper.createObjectNode()
                .put("subjectKind", subject.kind().name())
                .put("subjectRef", subject.ref().toString());
        JsonNode receiptRequest = typedReceiptRequest(request, dataNodeRef, scope.brandRef());
        CatalogVoidInventoryRetirementReadback replay = replayTyped(
                dataNodeRef,
                key,
                "retireCatalogVoidInventoryDefinitions",
                receiptRequest,
                CatalogVoidInventoryRetirementReadback.class);
        if (replay != null) return replay;

        persistence.lockCatalogVoidSubjectRows(dataNodeRef, scope.brandRef(), subject);
        CatalogVoidDependencyReadback judgement =
                catalogVoidDependenciesReadback(dataNodeRef, scope.brandRef(), subject);
        if (judgement.hasInboundBomReferences()) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID",
                    422,
                    /* format-wrap */
                    "库存 BOM 仍引用该对象：" + inboundReferenceSummary(judgement));
        }

        int retiredTargets = persistence.retireTargets(dataNodeRef, scope.brandRef(), subject);
        int retiredBoms = persistence.retireBoms(dataNodeRef, scope.brandRef(), subject);
        long remaining = persistence.countActiveOwnedDefinitions(dataNodeRef, scope.brandRef(), subject);
        if (remaining != 0L) {
            throw new InventoryOwnerApi.Problem(
                    "RESULT_UNKNOWN",
                    500,
                    /* format-wrap */
                    "库存 owner 退休后仍存在启用定义");
        }
        CatalogVoidInventoryRetirementReadback result =
                new CatalogVoidInventoryRetirementReadback(subject, retiredTargets, retiredBoms, remaining);
        saveTypedReceipt(dataNodeRef, key, "retireCatalogVoidInventoryDefinitions", receiptRequest, result);
        return result;
    }

    @Transactional
    public CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitionsForBatch(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        requireScope(scope.dataNodeId().toString(), scope.brandRef());
        requireCatalogVoidSubject(subject);
        String key = requireIdempotencyKey(idempotencyKey);
        if (subject.kind() != CatalogVoidSubjectKind.CATALOG_ITEM) {
            return retireCatalogVoidInventoryDefinitions(context, subject, key);
        }

        String dataNodeRef = scope.dataNodeId().toString();
        String operation = "retireCatalogVoidInventoryDefinitions";
        ObjectNode request = mapper.createObjectNode()
                .put("subjectKind", subject.kind().name())
                .put("subjectRef", subject.ref().toString());
        JsonNode receiptRequest = typedReceiptRequest(request, dataNodeRef, scope.brandRef());
        String requestHash = hash(receiptRequest);
        InventoryCatalogLifecyclePersistence.BatchRetirementFacts outcome = persistence.readBatchRetirementFacts(
                dataNodeRef, scope.brandRef(), subject, key, operation, requestHash);

        if (outcome.priorOperation() != null) {
            if (!operation.equals(outcome.priorOperation()) || !requestHash.equals(outcome.priorRequestHash())) {
                throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
            }
            if (outcome.priorResponse() == null) {
                throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存作废回执缺少响应");
            }
            try {
                return mapper.treeToValue(json(outcome.priorResponse()), CatalogVoidInventoryRetirementReadback.class);
            } catch (Exception failure) {
                String reason = "幂等回执与当前 owner readback 不兼容";
                throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, reason, failure);
            }
        }
        if (outcome.inboundCount() > 0L) {
            if (!outcome.inboundResolvable()) {
                String reason = "库存 BOM 引用了无法唯一解析的库存对象";
                throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, reason);
            }
            String summary =
                    outcome.inboundSummary() == null || outcome.inboundSummary().isBlank()
                            ? "库存 BOM"
                            : outcome.inboundSummary();
            String reason = "库存 BOM 仍引用该对象：" + summary;
            throw new InventoryOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, reason);
        }
        if (outcome.remainingCount() != 0L || outcome.writtenResponse() == null) {
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 owner 退休后仍存在启用定义");
        }
        return new CatalogVoidInventoryRetirementReadback(
                subject, outcome.retiredTargetCount(), outcome.retiredBomCount(), outcome.remainingCount());
    }

    @Transactional(readOnly = true)
    public CatalogReferenceDependenciesReadback catalogReferenceDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, String reference) {
        UUID catalogReference = opaqueRef(reference, "reference");
        return catalogReferenceDependenciesByRefs(context, objectType, List.of(catalogReference))
                .get(0);
    }

    @Transactional(readOnly = true)
    public List<CatalogReferenceDependenciesReadback> catalogReferenceDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, List<UUID> references) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        String dataNodeRef = scope.dataNodeId().toString();
        requireScope(dataNodeRef, scope.brandRef());
        List<InventoryCatalogReferenceDeclarations.Source> declarations =
                InventoryCatalogReferenceDeclarations.sourcesFor(objectType);
        if (declarations.isEmpty())
            throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "catalog dependency objectType is not supported");

        List<UUID> orderedReferences =
                references == null ? List.of() : new ArrayList<>(new LinkedHashSet<>(references));
        if (orderedReferences.isEmpty()) return List.of();
        Map<UUID, List<CatalogReferenceDependencySource>> sourcesByReference = new LinkedHashMap<>();
        orderedReferences.forEach(reference -> sourcesByReference.put(reference, new ArrayList<>()));
        for (InventoryCatalogReferenceDeclarations.Source declaration : declarations) {
            Map<UUID, Long> counts = persistence.dependencyCounts(
                    dataNodeRef,
                    scope.brandRef(),
                    InventoryCatalogLifecyclePersistence.DependencySource.from(
                            declaration.tableName(), declaration.columnName()),
                    orderedReferences);
            orderedReferences.forEach(reference -> sourcesByReference
                    .get(reference)
                    .add(new CatalogReferenceDependencySource(
                            declaration.tableName(), declaration.columnName(), counts.getOrDefault(reference, 0L))));
        }
        return orderedReferences.stream()
                .map(reference -> {
                    List<CatalogReferenceDependencySource> sources = sourcesByReference.get(reference);
                    long total = sources.stream()
                            .mapToLong(CatalogReferenceDependencySource::count)
                            .sum();
                    return new CatalogReferenceDependenciesReadback(objectType, reference, total, List.copyOf(sources));
                })
                .toList();
    }

    private void requireCatalogVoidSubject(InventoryOwnerApi.CatalogVoidSubject subject) {
        if (subject == null || subject.kind() == null || subject.ref() == null) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog void subject is required");
        }
    }

    private InventoryOwnerApi.CatalogVoidDependencyReadback catalogVoidDependenciesReadback(
            String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> readbacks =
                catalogVoidDependenciesReadbacks(scope, brand, subject.kind(), List.of(subject.ref()));
        InventoryOwnerApi.CatalogVoidDependencyReadback result = readbacks.get(subject.ref());
        if (result == null)
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "inventory void dependency readback is missing");
        return result;
    }

    private Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> catalogVoidDependenciesReadbacks(
            String scope, String brand, InventoryOwnerApi.CatalogVoidSubjectKind kind, Collection<UUID> subjects) {
        List<UUID> orderedSubjects = subjects == null
                ? List.of()
                : subjects.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (orderedSubjects.isEmpty()) return Map.of();
        Map<UUID, VoidDependencyAccumulator> accumulators = new LinkedHashMap<>();
        orderedSubjects.forEach(ref -> accumulators.put(
                ref, new VoidDependencyAccumulator(new InventoryOwnerApi.CatalogVoidSubject(kind, ref))));
        for (InventoryCatalogLifecyclePersistence.VoidDependencyFact fact :
                persistence.readVoidDependencyFacts(scope, brand, kind, orderedSubjects)) {
            VoidDependencyAccumulator accumulator = accumulators.get(fact.subjectRef());
            if (accumulator == null) {
                throw new InventoryOwnerApi.Problem(
                        "REFERENCE_MAPPING_UNRESOLVED",
                        422,
                        /* format-wrap */
                        "库存作废判断返回了未知 subject");
            }
            switch (fact.factKind()) {
                case "TARGET" -> {
                    accumulator.ownedTargetRefsAllStatus.add(fact.factRef());
                    if ("ENABLED".equals(fact.definitionStatus())) {
                        accumulator.ownedActiveTargetRefs.add(fact.factRef());
                    } else {
                        accumulator.ownedDisabledTargetRefs.add(fact.factRef());
                    }
                }
                case "BOM" -> {
                    if ("ENABLED".equals(fact.definitionStatus())) accumulator.ownedActiveProductBomCount++;
                }
                case "INBOUND" -> {
                    if (!"ENABLED".equals(fact.matchedTargetStatus())) {
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                /* format-wrap */
                                "库存 BOM 引用了非当前启用库存对象");
                    }
                    if (fact.sourceCode() == null
                            || fact.sourceCode().isBlank()
                            || fact.sourceName() == null
                            || fact.sourceName().isBlank())
                        throw new InventoryOwnerApi.Problem(
                                "REFERENCE_MAPPING_UNRESOLVED",
                                422,
                                /* format-wrap */
                                "库存 BOM 引用的来源商品无法唯一解析");
                    CatalogVoidInboundKey key = new CatalogVoidInboundKey(
                            fact.sourceItemRef(),
                            fact.sourceSkuRef(),
                            fact.sourceOptionValueRef(),
                            fact.targetRef(),
                            fact.sourceCode(),
                            fact.sourceName());
                    accumulator.inboundCounts.merge(key, 1L, Long::sum);
                }
                default -> throw new InventoryOwnerApi.Problem(
                        "RESULT_UNKNOWN",
                        500,
                        /* format-wrap */
                        "库存作废判断返回了未知 fact 类型");
            }
        }
        Map<UUID, InventoryOwnerApi.CatalogVoidDependencyReadback> result = new LinkedHashMap<>();
        accumulators.forEach((ref, accumulator) -> result.put(ref, accumulator.readback()));
        return Map.copyOf(result);
    }

    private ObjectNode catalogVoidDependencyJson(InventoryOwnerApi.CatalogVoidDependencyReadback readback) {
        ObjectNode result = mapper.createObjectNode()
                .put("subjectKind", readback.subject().kind().name())
                .put("subjectRef", readback.subject().ref().toString())
                .put(
                        "itemRef",
                        readback.subject().kind() == InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM
                                ? readback.subject().ref().toString()
                                : "")
                .put("hasDependentFacts", readback.hasInboundBomReferences())
                .put("stockTargetCount", readback.ownedActiveStockTargetCount())
                .put("productBomCount", readback.ownedActiveProductBomCount());
        ArrayNode targetRefs = result.putArray("ownedTargetRefsAllStatus");
        readback.ownedTargetRefsAllStatus().stream().sorted().forEach(ref -> targetRefs.add(ref.toString()));
        ArrayNode activeTargetRefs = result.putArray("ownedActiveTargetRefs");
        readback.ownedActiveTargetRefs().stream().sorted().forEach(ref -> activeTargetRefs.add(ref.toString()));
        ArrayNode disabledTargetRefs = result.putArray("ownedDisabledTargetRefs");
        readback.ownedDisabledTargetRefs().stream().sorted().forEach(ref -> disabledTargetRefs.add(ref.toString()));
        ArrayNode references = result.putArray("inboundBomReferences");
        readback.inboundBomReferences().forEach(reference -> references
                .addObject()
                .put("sourceKind", reference.sourceKind().name())
                .put(
                        "sourceItemRef",
                        reference.sourceItemRef() == null
                                ? null
                                : reference.sourceItemRef().toString())
                .put(
                        "sourceSkuRef",
                        reference.sourceSkuRef() == null
                                ? null
                                : reference.sourceSkuRef().toString())
                .put(
                        "sourceOptionValueRef",
                        reference.sourceOptionValueRef() == null
                                ? null
                                : reference.sourceOptionValueRef().toString())
                .put("targetRef", reference.targetRef().toString())
                .put("sourceCode", reference.sourceCode())
                .put("sourceName", reference.sourceName())
                .put("count", reference.count()));
        ArrayNode facts = result.putArray("dependentFacts");
        readback.inboundBomReferences().forEach(reference -> facts.addObject()
                .put("factKind", "INVENTORY_BOM")
                .put("factRef", reference.targetRef().toString())
                .put("count", reference.count()));
        return result;
    }

    private String inboundReferenceSummary(InventoryOwnerApi.CatalogVoidDependencyReadback readback) {
        return readback.inboundBomReferences().stream()
                .map(reference -> reference.sourceName() + " x" + reference.count())
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private long countActiveOwnedDefinitions(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        return persistence.countActiveOwnedDefinitions(scope, brand, subject);
    }

    private JsonNode replay(String scope, String key, String operation, JsonNode request) {
        InventoryCatalogLifecyclePersistence.ReceiptRow row = persistence.readReceipt(scope, key);
        if (row == null) return null;
        if (!row.operation().equals(operation) || !row.requestHash().equals(hash(request)))
            throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return json(row.responseJson());
    }

    private void saveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        persistence.saveReceipt(scope, key, operation, hash(request), canonical(response));
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

    private static UUID opaqueRef(String value, String key) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be an opaque UUID reference", exception);
        }
    }

    static String requireIdempotencyKey(String key) {
        if (key == null || key.isBlank())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "Idempotency-Key is required");
        return key.trim();
    }

    private static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
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

    private record CatalogVoidInboundKey(
            UUID sourceItemRef,
            UUID sourceSkuRef,
            UUID sourceOptionValueRef,
            UUID targetRef,
            String sourceCode,
            String sourceName) {}

    private static final class VoidDependencyAccumulator {
        private final InventoryOwnerApi.CatalogVoidSubject subject;
        private final Set<UUID> ownedTargetRefsAllStatus = new LinkedHashSet<>();
        private final Set<UUID> ownedActiveTargetRefs = new LinkedHashSet<>();
        private final Set<UUID> ownedDisabledTargetRefs = new LinkedHashSet<>();
        private final Map<CatalogVoidInboundKey, Long> inboundCounts = new LinkedHashMap<>();
        private long ownedActiveProductBomCount;

        private VoidDependencyAccumulator(InventoryOwnerApi.CatalogVoidSubject subject) {
            this.subject = subject;
        }

        private InventoryOwnerApi.CatalogVoidDependencyReadback readback() {
            List<InventoryOwnerApi.CatalogVoidInboundBomReference> inbound = inboundCounts.entrySet().stream()
                    .map(entry -> {
                        CatalogVoidInboundKey key = entry.getKey();
                        InventoryOwnerApi.CatalogVoidSubjectKind sourceKind = key.sourceOptionValueRef() != null
                                ? InventoryOwnerApi.CatalogVoidSubjectKind.OPTION_VALUE
                                : key.sourceSkuRef() != null
                                        ? InventoryOwnerApi.CatalogVoidSubjectKind.PRODUCT_SKU
                                        : InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM;
                        return new InventoryOwnerApi.CatalogVoidInboundBomReference(
                                sourceKind,
                                key.sourceItemRef(),
                                key.sourceSkuRef(),
                                key.sourceOptionValueRef(),
                                key.targetRef(),
                                key.sourceCode(),
                                key.sourceName(),
                                entry.getValue());
                    })
                    .toList();
            return new InventoryOwnerApi.CatalogVoidDependencyReadback(
                    subject,
                    ownedTargetRefsAllStatus,
                    ownedActiveTargetRefs,
                    ownedDisabledTargetRefs,
                    ownedActiveTargetRefs.size(),
                    ownedActiveProductBomCount,
                    inbound);
        }
    }
}
