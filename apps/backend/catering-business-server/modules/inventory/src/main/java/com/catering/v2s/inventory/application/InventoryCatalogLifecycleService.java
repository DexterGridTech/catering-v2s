package com.catering.v2s.inventory.application;

import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
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
    private static final String TARGET_SELECT_COLUMNS =
            "target_ref,item_ref,product_sku_ref,item_code,sku_code,measure_mode,balance,configuration::text,"
                    + "version,updated_at_epoch_millis,consumption_unit_ref,consumption_unit_code,"
                    + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                    + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                    + "counting_unit_precision,counting_unit_conversion_factor,definition_status,inventory_mode,"
                    + "component_eligible";
    /** Mapping types consumed by inventory copy; catalog may carry other owner mappings in the same plan. */
    private static final Set<String> INVENTORY_COPY_MAPPING_TYPES = Set.of(
            "CATALOG_ITEM",
            "PRODUCT_SKU",
            "CATALOG_UNIT",
            "CATALOG_ORDER_OPTION_DEFINITION",
            "CATALOG_ORDER_OPTION_DEFINITION_VALUE",
            "STOCK_TARGET");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    public InventoryCatalogLifecycleService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    @Transactional
    public void validateCatalogUnitLifecycle(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID unitRef,
            CatalogUnitLifecycleChange intendedChange) {
        CatalogAuthorizationScope scope = requireTypedContext(context, "catalog", null);
        if (unitRef == null || intendedChange == null)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "单位生命周期判断参数不完整");
        AdvisoryLock.acquire(jdbc, 0x554E4954, unitRef);
        List<UUID> targetRefs = jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? "
                        + "AND (consumption_unit_ref=? OR counting_unit_ref=?) FOR UPDATE",
                (result, row) -> result.getObject(1, UUID.class),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                unitRef,
                unitRef);
        long ledgerCount = jdbc.queryForObject(
                "SELECT count(*) FROM inventory.stock_ledger ledger WHERE ledger.consumption_unit_ref=? "
                        + "AND EXISTS (SELECT 1 FROM inventory.stock_target target "
                        + "WHERE target.target_ref=ledger.target_ref "
                        + "AND target.data_node_ref=? AND target.brand_ref=?)",
                Long.class,
                unitRef,
                scope.dataNodeId().toString(),
                scope.brandRef());
        long bomCount = jdbc.queryForObject(
                "SELECT count(*) FROM inventory.stock_bom bom WHERE EXISTS ("
                        + "SELECT 1 FROM jsonb_array_elements(bom.rows) line "
                        + "WHERE line->'consumptionUnitSnapshot'->>'unitRef'=? )",
                Long.class,
                unitRef.toString());
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
        lockCatalogItemRefs(List.of(itemRef));
        lockProductSkuRefs(skuBaseMeasureUnits.stream()
                .map(CatalogSkuBaseMeasureUnit::productSkuRef)
                .toList());
        Map<UUID, UnitSnapshot> skuUnits = new LinkedHashMap<>();
        for (CatalogSkuBaseMeasureUnit entry : skuBaseMeasureUnits) {
            if (entry.productSkuRef() == null)
                throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, SKU_BASE_UNIT_ARGS);
            skuUnits.put(entry.productSkuRef(), entry.unitSnapshot());
        }
        List<TargetConsumptionUnitRow> targets = jdbc.query(
                "SELECT target_ref,product_sku_ref,consumption_unit_ref FROM inventory.stock_target "
                        + "WHERE data_node_ref=? AND brand_ref=? AND item_ref=? FOR UPDATE",
                (result, row) -> new TargetConsumptionUnitRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class)),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                itemRef);
        for (TargetConsumptionUnitRow target : targets) {
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

        lockCatalogVoidSubjectRows(dataNodeRef, scope.brandRef(), subject);
        CatalogVoidDependencyReadback judgement =
                catalogVoidDependenciesReadback(dataNodeRef, scope.brandRef(), subject);
        if (judgement.hasInboundBomReferences()) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_BLOCKS_VOID",
                    422,
                    /* format-wrap */
                    "库存 BOM 仍引用该对象：" + inboundReferenceSummary(judgement));
        }

        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        int retiredTargets = jdbc.update(
                "UPDATE inventory.stock_target SET definition_status='DISABLED',version=version+1,"
                        + "updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED'",
                time.currentEpochMillis(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref());
        int retiredBoms = jdbc.update(
                "UPDATE inventory.stock_bom SET definition_status='DISABLED',version=version+1,"
                        + "updated_at_epoch_millis=? WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED'",
                time.currentEpochMillis(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref());
        long remaining = countActiveOwnedDefinitions(dataNodeRef, scope.brandRef(), subject);
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
        String inboundSql = "inbound_rows";
        CatalogVoidBatchSqlOutcome outcome = jdbc.queryForObject(
                "WITH receipt_lock AS MATERIALIZED ("
                        + "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)),hashtext(CAST(? AS text)))"
                        + "), prior_receipt AS MATERIALIZED ("
                        + "SELECT operation_id,request_hash,response::text AS response "
                        + "FROM inventory.command_receipt CROSS JOIN receipt_lock "
                        + "WHERE data_node_ref=? AND idempotency_key=?"
                        + "), owned_targets AS MATERIALIZED ("
                        + "SELECT target.target_ref,target.item_ref,target.definition_status "
                        + "FROM inventory.stock_target target CROSS JOIN receipt_lock "
                        + "WHERE target.data_node_ref=? AND target.brand_ref=? AND target.item_ref=? "
                        + "FOR UPDATE"
                        + "), owned_boms AS MATERIALIZED ("
                        + "SELECT bom.bom_ref,bom.definition_status "
                        + "FROM inventory.stock_bom bom CROSS JOIN receipt_lock "
                        + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.item_ref=? "
                        + "FOR UPDATE"
                        + "), "
                        + inboundSql + " AS MATERIALIZED ("
                        + "SELECT bom.bom_ref,ot.target_ref,ot.definition_status AS target_status,"
                        + "bom.item_code AS source_code,source_item.name AS source_name "
                        + "FROM inventory.stock_bom bom CROSS JOIN receipt_lock "
                        + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bom.rows)='array' "
                        + "THEN bom.rows ELSE '[]'::jsonb END) AS e(entry) "
                        + "JOIN owned_targets ot ON ot.target_ref::text=COALESCE(e.entry->>'targetRef',"
                        + "e.entry->>'componentTargetRef') "
                        + "LEFT JOIN catalog.catalog_item source_item ON source_item.item_ref=bom.item_ref "
                        + "AND source_item.data_node_ref=? AND source_item.brand_ref=? "
                        + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' "
                        + "AND bom.item_ref IS DISTINCT FROM ? "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) "
                        + "FOR UPDATE OF bom"
                        + "), retired_targets AS ("
                        + "UPDATE inventory.stock_target target SET definition_status='DISABLED',"
                        + "version=target.version+1,updated_at_epoch_millis=? "
                        + "WHERE target.target_ref IN (SELECT target_ref FROM owned_targets) "
                        + "AND target.definition_status='ENABLED' "
                        + "AND NOT EXISTS (SELECT 1 FROM " + inboundSql + ") "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) "
                        + "RETURNING target.target_ref"
                        + "), retired_boms AS ("
                        + "UPDATE inventory.stock_bom bom SET definition_status='DISABLED',"
                        + "version=bom.version+1,updated_at_epoch_millis=? "
                        + "WHERE bom.bom_ref IN (SELECT bom_ref FROM owned_boms) "
                        + "AND bom.definition_status='ENABLED' "
                        + "AND NOT EXISTS (SELECT 1 FROM " + inboundSql + ") "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt) "
                        + "RETURNING bom.bom_ref"
                        + "), outcome AS ("
                        + "SELECT "
                        + "(SELECT COUNT(*) FROM " + inboundSql + ") AS inbound_count,"
                        + "COALESCE((SELECT bool_and(target_status='ENABLED' "
                        + "AND NULLIF(BTRIM(source_code),'') IS NOT NULL "
                        + "AND NULLIF(BTRIM(source_name),'') IS NOT NULL) FROM " + inboundSql + "),TRUE) "
                        + "AS inbound_resolvable,"
                        + "COALESCE((SELECT string_agg(DISTINCT COALESCE(NULLIF(BTRIM(source_name),''),"
                        + "NULLIF(BTRIM(source_code),''),'未知商品'),', ') FROM " + inboundSql + "),'') "
                        + "AS inbound_summary,"
                        + "(SELECT COUNT(*) FROM retired_targets) AS retired_target_count,"
                        + "(SELECT COUNT(*) FROM retired_boms) AS retired_bom_count,"
                        + "((SELECT COUNT(*) FROM owned_targets WHERE definition_status='ENABLED') "
                        + "- (SELECT COUNT(*) FROM retired_targets) + "
                        + "(SELECT COUNT(*) FROM owned_boms WHERE definition_status='ENABLED') "
                        + "- (SELECT COUNT(*) FROM retired_boms)) AS remaining_count"
                        + "), response_payload AS ("
                        + "SELECT jsonb_build_object('subject',jsonb_build_object('kind',CAST(? AS text),"
                        + "'ref',CAST(? AS text)),'retiredStockTargetCount',retired_target_count,"
                        + "'retiredProductBomCount',retired_bom_count,"
                        + "'remainingActiveOwnedDefinitionCount',remaining_count) AS response "
                        + "FROM outcome WHERE inbound_count=0 AND inbound_resolvable AND remaining_count=0 "
                        + "AND NOT EXISTS (SELECT 1 FROM prior_receipt)"
                        + "), written_receipt AS ("
                        + "INSERT INTO inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,"
                        + "operation_id,request_hash,response,created_at_epoch_millis) "
                        + "SELECT ?,?,?,?,?,response,? FROM response_payload "
                        + "RETURNING response::text AS response"
                        + ") SELECT outcome.inbound_count,outcome.inbound_resolvable,outcome.inbound_summary,"
                        + "outcome.retired_target_count,outcome.retired_bom_count,outcome.remaining_count,"
                        + "prior_receipt.operation_id,prior_receipt.request_hash,prior_receipt.response,"
                        + "written_receipt.response FROM outcome LEFT JOIN prior_receipt ON TRUE "
                        + "LEFT JOIN written_receipt ON TRUE",
                (result, rowNumber) -> new CatalogVoidBatchSqlOutcome(
                        result.getLong(1),
                        result.getBoolean(2),
                        result.getString(3),
                        result.getLong(4),
                        result.getLong(5),
                        result.getLong(6),
                        result.getString(7),
                        result.getString(8),
                        result.getString(9),
                        result.getString(10)),
                "inventory-receipt",
                key,
                dataNodeRef,
                key,
                dataNodeRef,
                scope.brandRef(),
                subject.ref(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref(),
                dataNodeRef,
                scope.brandRef(),
                dataNodeRef,
                scope.brandRef(),
                subject.ref(),
                time.currentEpochMillis(),
                time.currentEpochMillis(),
                subject.kind().name(),
                subject.ref().toString(),
                UUID.randomUUID(),
                dataNodeRef,
                key,
                operation,
                requestHash,
                time.currentEpochMillis());

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
            Map<UUID, Long> counts = dependencyCounts(
                    dataNodeRef,
                    scope.brandRef(),
                    declaration.tableName(),
                    declaration.columnName(),
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

    private Map<UUID, Long> dependencyCounts(
            String dataNodeRef, String brandRef, String tableName, String columnName, List<UUID> references) {
        UUID[] values = references.toArray(UUID[]::new);
        return jdbc.query(
                "SELECT " + columnName + ",COUNT(*) FROM inventory." + tableName + " WHERE data_node_ref=? "
                        + "AND brand_ref=? AND " + columnName + " = ANY(?::uuid[]) GROUP BY " + columnName,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, Long> counts = new LinkedHashMap<>();
                    while (result.next()) counts.put(result.getObject(1, UUID.class), result.getLong(2));
                    return counts;
                });
    }

    private void requireCatalogVoidSubject(InventoryOwnerApi.CatalogVoidSubject subject) {
        if (subject == null || subject.kind() == null || subject.ref() == null) {
            throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "catalog void subject is required");
        }
    }

    private static String catalogVoidOwnerColumn(InventoryOwnerApi.CatalogVoidSubjectKind kind) {
        return switch (kind) {
            case CATALOG_ITEM -> "item_ref";
            case PRODUCT_SKU -> "product_sku_ref";
            case OPTION_VALUE -> throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "option value is not a catalog void subject");
        };
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
        String ownerColumn = catalogVoidOwnerColumn(kind);
        UUID[] subjectRefs = orderedSubjects.toArray(UUID[]::new);
        String sql = "WITH input AS (SELECT ?::text AS scope, ?::text AS brand, ?::uuid[] AS subject_refs), "
                + "owned_targets AS ("
                + "SELECT target.target_ref,target.definition_status,target.item_ref,target.product_sku_ref "
                + "FROM inventory.stock_target target CROSS JOIN input "
                + "WHERE target.data_node_ref=input.scope AND target.brand_ref=input.brand "
                + "AND target." + ownerColumn + "=ANY(input.subject_refs)), "
                + "owned_boms AS ("
                + "SELECT bom.bom_ref,bom.definition_status,bom.item_ref,bom.product_sku_ref,bom.option_value_ref "
                + "FROM inventory.stock_bom bom CROSS JOIN input "
                + "WHERE bom.data_node_ref=input.scope AND bom.brand_ref=input.brand "
                + "AND bom." + ownerColumn + "=ANY(input.subject_refs)), "
                + "inbound AS ("
                + "SELECT ot." + ownerColumn + " AS subject_ref,bom.bom_ref,bom.item_ref,bom.product_sku_ref,"
                + "bom.option_value_ref,ot.target_ref,bom.item_code,source_item.name,ot.definition_status "
                + "FROM inventory.stock_bom bom CROSS JOIN input "
                + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(bom.rows)='array' "
                + "THEN bom.rows ELSE '[]'::jsonb END) AS e(entry) "
                + "JOIN owned_targets ot ON ot.target_ref::text=COALESCE(e.entry->>'targetRef',"
                + "e.entry->>'componentTargetRef') "
                + "LEFT JOIN catalog.catalog_item source_item ON source_item.item_ref=bom.item_ref "
                + "AND source_item.data_node_ref=input.scope AND source_item.brand_ref=input.brand "
                + "WHERE bom.data_node_ref=input.scope AND bom.brand_ref=input.brand "
                + "AND bom.definition_status='ENABLED' "
                + "AND "
                + (kind == InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM
                        ? "bom.item_ref IS DISTINCT FROM ot.item_ref"
                        : "bom.product_sku_ref IS DISTINCT FROM ot.product_sku_ref")
                + ") "
                + "SELECT 'TARGET' AS fact_kind,target.target_ref AS fact_ref,target." + ownerColumn
                + " AS subject_ref,target.definition_status,NULL::uuid AS source_item_ref,NULL::uuid AS source_sku_ref,"
                + "NULL::uuid AS source_option_value_ref,target.target_ref AS target_ref,NULL::text AS source_code,"
                + "NULL::text AS source_name,target.definition_status AS matched_target_status "
                + "FROM owned_targets target "
                + "UNION ALL SELECT 'BOM',bom.bom_ref,bom." + ownerColumn
                + ",bom.definition_status,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::text,NULL::text "
                + "FROM owned_boms bom "
                + "UNION ALL SELECT 'INBOUND',inbound.bom_ref,inbound.subject_ref,'ENABLED',"
                + "inbound.item_ref,inbound.product_sku_ref,inbound.option_value_ref,inbound.target_ref,"
                + "inbound.item_code,inbound.name,inbound.definition_status FROM inbound "
                + "ORDER BY subject_ref,fact_kind,fact_ref";
        List<VoidDependencyFact> facts = jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", subjectRefs));
                },
                (result, rowNumber) -> new VoidDependencyFact(
                        result.getString(1),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class),
                        result.getString(4),
                        result.getObject(5, UUID.class),
                        result.getObject(6, UUID.class),
                        result.getObject(7, UUID.class),
                        result.getObject(8, UUID.class),
                        result.getString(9),
                        result.getString(10),
                        result.getString(11)));

        Map<UUID, VoidDependencyAccumulator> accumulators = new LinkedHashMap<>();
        orderedSubjects.forEach(ref -> accumulators.put(
                ref, new VoidDependencyAccumulator(new InventoryOwnerApi.CatalogVoidSubject(kind, ref))));
        for (VoidDependencyFact fact : facts) {
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

    private void lockCatalogVoidSubjectRows(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND " + ownerColumn
                        + "=? ORDER BY target_ref FOR UPDATE",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        jdbc.query(
                "SELECT bom_ref FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND " + ownerColumn
                        + "=? ORDER BY bom_ref FOR UPDATE",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        List<UUID> ownedTargetRefs = jdbc.query(
                "SELECT target_ref FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND " + ownerColumn
                        + "=? ORDER BY target_ref",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        if (ownedTargetRefs.isEmpty()) return;
        String placeholders = String.join(",", Collections.nCopies(ownedTargetRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.addAll(ownedTargetRefs.stream().map(UUID::toString).toList());
        jdbc.query(
                "SELECT bom.bom_ref FROM inventory.stock_bom bom CROSS JOIN LATERAL jsonb_array_elements("
                        + "CASE WHEN jsonb_typeof(bom.rows)='array' THEN bom.rows ELSE '[]'::jsonb END) e(entry) "
                        + "WHERE bom.data_node_ref=? AND bom.brand_ref=? AND bom.definition_status='ENABLED' AND "
                        + "COALESCE(e.entry->>'targetRef',e.entry->>'componentTargetRef') IN (" + placeholders + ") "
                        + "ORDER BY bom.bom_ref FOR UPDATE",
                (result, rowNumber) -> result.getObject(1, UUID.class),
                arguments.toArray());
    }

    private long countActiveOwnedDefinitions(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        Long count = jdbc.queryForObject(
                "SELECT (SELECT COUNT(*) FROM inventory.stock_target WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED') + "
                        + "(SELECT COUNT(*) FROM inventory.stock_bom WHERE data_node_ref=? AND brand_ref=? AND "
                        + ownerColumn + "=? AND definition_status='ENABLED')",
                Long.class,
                scope,
                brand,
                subject.ref(),
                scope,
                brand,
                subject.ref());
        return count == null ? 0L : count;
    }

    private JsonNode replay(String scope, String key, String operation, JsonNode request) {
        AdvisoryLock.acquire(jdbc, "inventory-receipt", scope, key);
        List<Receipt> rows = jdbc.query(
                "SELECT operation_id,request_hash,response::text FROM inventory.command_receipt WHERE data_node_ref=? "
                        + "AND idempotency_key=?",
                (r, n) -> new Receipt(r.getString(1), r.getString(2), json(r.getString(3))),
                scope,
                key);
        if (rows.isEmpty()) return null;
        Receipt row = rows.get(0);
        if (!row.operation().equals(operation) || !row.requestHash().equals(hash(request)))
            throw new InventoryOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return row.response();
    }

    private void saveReceipt(String scope, String key, String operation, JsonNode request, JsonNode response) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_has"
                        + "h,re"
                        + "sponse,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                scope,
                key,
                operation,
                hash(request),
                canonical(response),
                time.currentEpochMillis());
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

    private void lockProductSkuRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x43534B55, refs);
    }

    private void lockCatalogItemRefs(java.util.Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
    }




    private record VoidDependencyFact(
            String factKind,
            UUID factRef,
            UUID subjectRef,
            String definitionStatus,
            UUID sourceItemRef,
            UUID sourceSkuRef,
            UUID sourceOptionValueRef,
            UUID targetRef,
            String sourceCode,
            String sourceName,
            String matchedTargetStatus) {}

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



    private record TargetConsumptionUnitRow(UUID targetRef, UUID productSkuRef, UUID consumptionUnitRef) {}

















    private record CatalogVoidBatchSqlOutcome(
            long inboundCount,
            boolean inboundResolvable,
            String inboundSummary,
            long retiredTargetCount,
            long retiredBomCount,
            long remainingCount,
            String priorOperation,
            String priorRequestHash,
            String priorResponse,
            String writtenResponse) {}

    private record Receipt(String operation, String requestHash, JsonNode response) {}
}
