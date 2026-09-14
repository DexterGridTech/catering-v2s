package com.catering.v2s.inventory.application.persistence;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for inventory catalog lifecycle facts. */
@Repository
public class InventoryCatalogLifecyclePersistence {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    @Autowired
    public InventoryCatalogLifecyclePersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public UnitLifecycleUsage readUnitLifecycleUsage(String dataNodeRef, String brandRef, UUID unitRef) {
        AdvisoryLock.acquire(jdbc, 0x554E4954, unitRef);
        List<UUID> targetRefs = jdbc.query(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_CONSUMPTION_UNIT_REF_COUNTING_UNIT_REF,
                (result, row) -> result.getObject(1, UUID.class),
                dataNodeRef,
                brandRef,
                unitRef,
                unitRef);
        long ledgerCount = jdbc.queryForObject(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_LEDGER_LEDGER_CONSUMPTION_UNIT_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_STOCK_TARGET_TARGET
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_TARGET_TARGET_REF_LEDGER
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_TARGET_DATA_NODE_REF_BRAND_REF,
                Long.class,
                unitRef,
                dataNodeRef,
                brandRef);
        long bomCount = jdbc.queryForObject(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_BOM_BOM
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_JSONB_ARRAY_ELEMENTS_BOM_ROWS_LINE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_LINE_CONSUMPTION_UNIT_SNAPSHOT_UNIT_REF,
                Long.class,
                unitRef.toString());
        return new UnitLifecycleUsage(targetRefs, ledgerCount, bomCount);
    }

    public void lockCatalogItemRefs(Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x4349544D, refs);
    }

    public void lockProductSkuRefs(Collection<UUID> refs) {
        AdvisoryLock.acquireAll(jdbc, 0x43534B55, refs);
    }

    public List<TargetConsumptionUnitRow> readTargetConsumptionUnitRows(
            String dataNodeRef, String brandRef, UUID itemRef) {
        return jdbc.query(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_ITEM_REF,
                (result, row) -> new TargetConsumptionUnitRow(
                        result.getObject(1, UUID.class),
                        result.getObject(2, UUID.class),
                        result.getObject(3, UUID.class)),
                dataNodeRef,
                brandRef,
                itemRef);
    }

    public int retireTargets(
            String dataNodeRef, String brandRef, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        return jdbc.update(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_TARGET_DEFINITION_STATUS_DISABLED_VERSION
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF_BRAND_REF
                        + ownerColumn + InventoryCatalogLifecycleServiceSql.OWNER_ENABLED_PREDICATE_SUFFIX,
                time.currentEpochMillis(),
                dataNodeRef,
                brandRef,
                subject.ref());
    }

    public int retireBoms(
            String dataNodeRef, String brandRef, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        return jdbc.update(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_BOM_DEFINITION_STATUS_DISABLED_VERSION
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + ownerColumn + InventoryCatalogLifecycleServiceSql.OWNER_ENABLED_PREDICATE_SUFFIX,
                time.currentEpochMillis(),
                dataNodeRef,
                brandRef,
                subject.ref());
    }

    public BatchRetirementFacts readBatchRetirementFacts(
            String dataNodeRef,
            String brandRef,
            InventoryOwnerApi.CatalogVoidSubject subject,
            String key,
            String operation,
            String requestHash) {
        String inboundSql = "inbound_rows";
        return jdbc.queryForObject(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CTE_RECEIPT_LOCK
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_PRIOR_RECEIPT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_FROM_INVENTORY_COMMAND_RECEI
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_DATA_NODE_REF_IDEMPOTENCY_KEY
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OWNED_TARGETS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_TARGET_TARGET_REF_ITEM_REF_DEFINITION_STATUS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_TARGET
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_TARGET_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_LOCK_FOR_UPDATE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OWNED_BOMS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_BOM_BOM_REF_DEFINITION_STATUS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_BOM
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_ITEM_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_LOCK_FOR_UPDATE_ALTERNATE_A
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN
                        + inboundSql + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_AS_MATERIALIZED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_BOM_BOM_REF_TARGET_REF_DEFINITION_STATUS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_BOM_ITEM_CODE_SOURCE_CODE_SOURCE_ITEM
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_RECEIPT_LOCK_BOM_ALTERNATE_A
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_LATERAL_JSONB_ARRAY_ELEMENTS_JSONB_TYPEOF_BOM_ROWS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_THEN_BOM_ROWS_ENTRY
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_JOIN_OWNED_TARGETS_TARGET_REF_TEXT_ENTRY
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_ENTRY_COMPONENT_TARGET_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_CATALOG_ITEM_SOURCE_ITEM_ITEM_REF_BOM
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_SOURCE_ITEM_DATA_NODE_REF_BRAND_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM_ITEM_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_LOCK_OF_BOM
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_RETIRED_TARGETS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_TARGET_TARGET_DEFINITION_STATUS_DISABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_VERSION_TARGET_UPDATED_AT_EPOCH_MILLIS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_OWNED_TARGETS_TARGET_TARGET_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_TARGET_DEFINITION_STATUS_ENABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_AND_NOT_EXISTS_SELECT_1_FROM + inboundSql + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_A
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_A
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETURNING_TARGET_TARGET_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_RETIRED_BOMS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UPDATE_STOCK_BOM_BOM_DEFINITION_STATUS_DISABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_VERSION_BOM_UPDATED_AT_EPOCH_MILLIS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_OWNED_BOMS_BOM_BOM_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM_DEFINITION_STATUS_ENABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_A + inboundSql + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_B
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_B
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETURNING_BOM_BOM_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OUTCOME
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_SELECT_COUNT_FROM + inboundSql + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_INBOUND_COUNT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_BOOL_AND_TARGET_STATUS_ENABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_NULLIF_BTRIM_SOURCE_CODE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_NULLIF_BTRIM_SOURCE_NAME + inboundSql
                        + InventoryCatalogLifecycleServiceSql.INBOUND_RESOLVABLE_SUFFIX
                        + InventoryCatalogLifecycleServiceSql.INBOUND_SUMMARY_PREFIX + inboundSql
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_C
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_INBOUND_SUMMARY
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_RETIRED_TARGETS_RETIRED_TARGET_COUNT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_RETIRED_BOMS_RETIRED_BOM_COUNT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_OWNED_TARGETS_DEFINITION_STATUS_ENABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_RETIRED_TARGETS_SELECT_COUNT_FROM_RETIRED_TA
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_OPEN_PAREN_OWNED_BOMS_DEFINITION_STATUS_ENABLED
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_RETIRED_BOMS_REMAINING_COUNT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_RESPONSE_PAYLOAD
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_JSONB_BUILD_OBJECT_SUBJECT_KIND_TEXT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_RETIRED_PRODUCT_BOM_COUNT_RETIRED_BOM_COUNT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_REMAINING_ACTIVE_OWNED_DEFINITION_
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_OUTCOME
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_PRIOR_RECEIPT_AND_NOT_EXISTS_SELECT_1_FROM_ALTERNATE_C
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_WRITTEN_RECEIPT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_INSERT_INTO_COMMAND_RECEIPT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_OPERATION_ID
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_RESPONSE_PAYLOAD_RESPONSE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_RETURNING_RESPONSE_TEXT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_OUTCOME_ALTERNATE_A
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_OUTCOME
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_PRIOR_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_PRIOR_RECEIPT_WRITTEN_RECEIPT_RESPONSE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_WRITTEN_RECEIPT_LEFT_JOIN_WRITTEN_RECEIPT_ON,
                (result, rowNumber) -> new BatchRetirementFacts(
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
                brandRef,
                subject.ref(),
                dataNodeRef,
                brandRef,
                subject.ref(),
                dataNodeRef,
                brandRef,
                dataNodeRef,
                brandRef,
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
    }

    public Map<UUID, Long> dependencyCounts(
            String dataNodeRef, String brandRef, DependencySource source, List<UUID> references) {
        UUID[] values = references.toArray(UUID[]::new);
        return jdbc.query(
                InventoryCatalogLifecycleServiceSql.DEPENDENCY_COUNT_PREFIX + source.columnName()
                        + InventoryCatalogLifecycleServiceSql.DEPENDENCY_COUNT_TABLE_PREFIX + source.tableName()
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_DATA_NODE_REF
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BRAND_REF
                        + source.columnName() + InventoryCatalogLifecycleServiceSql.DEPENDENCY_COUNT_GROUP_SUFFIX
                        + source.columnName(),
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

    public List<VoidDependencyFact> readVoidDependencyFacts(
            String scope, String brand, InventoryOwnerApi.CatalogVoidSubjectKind kind, Collection<UUID> subjects) {
        List<UUID> orderedSubjects = subjects == null
                ? List.of()
                : subjects.stream().filter(java.util.Objects::nonNull).distinct().sorted().toList();
        if (orderedSubjects.isEmpty()) return List.of();
        String ownerColumn = catalogVoidOwnerColumn(kind);
        UUID[] subjectRefs = orderedSubjects.toArray(UUID[]::new);
        String sql = InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CTE_INPUT_TEXT_SCOPE_BRAND
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_OWNED_TARGETS
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_TARGET_TARGET_REF_DEFINITION_STATUS_ITEM_REF
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_INPUT_TARGET
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_TARGET_DATA_NODE_REF_INPUT_SCOPE
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_TARGET + ownerColumn + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_INPUT_SUBJECT_REFS
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_OWNED_BOMS
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_BOM_BOM_REF_DEFINITION_STATUS_ITEM_REF
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_INPUT_BOM
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_INPUT_SCOPE
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM + ownerColumn + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_INPUT_SUBJECT_REFS_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_INBOUND
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_SELECT_OT + ownerColumn + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_SUBJECT_REF_BOM_BOM_REF_ITEM_REF
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_BOM_OPTION_VALUE_REF_TARGET_REF_ITEM_CODE
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_INPUT_BOM_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_LATERAL_JSONB_ARRAY_ELEMENTS_JSONB_TYPEOF_BOM_ROWS_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_THEN_BOM_ROWS_ENTRY_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_JOIN_OWNED_TARGETS_TARGET_REF_TEXT_ENTRY_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_ENTRY_COMPONENT_TARGET_REF_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_CATALOG_ITEM_SOURCE_ITEM_ITEM_REF_BOM_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_SOURCE_ITEM_DATA_NODE_REF_INPUT_SCOPE
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_INPUT_SCOPE_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_BOM_DEFINITION_STATUS_ENABLED_ALTERNATE_A
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION
                + (kind == InventoryOwnerApi.CatalogVoidSubjectKind.CATALOG_ITEM
                        ? InventoryCatalogLifecycleServiceSql.ITEM_PARENT_DIFF_PREDICATE
                        : InventoryCatalogLifecycleServiceSql.SKU_PARENT_DIFF_PREDICATE)
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_D
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_TARGET_FACT_KIND_TARGET_REF_FACT_REF + ownerColumn
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_SUBJECT_REF
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_SOURCE_OPTION_VALUE_REF_TARGET_TARGET_REF_TEXT
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_TEXT_SOURCE_NAME_TARGET_DEFINITION_STATUS
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_OWNED_TARGETS_TARGET
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UNION_BOM_BOM_REF + ownerColumn
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_VALUE_SEPARATOR_BOM_DEFINITION_STATUS_TEXT
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_FROM_CLAUSE_OWNED_BOMS_BOM
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_UNION_INBOUND_BOM_REF_SUBJECT_REF_ENABLED
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_INBOUND_ITEM_REF_PRODUCT_SKU_REF_OPTION_VALUE_REF
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_INBOUND_ITEM_CODE_NAME_DEFINITION_STATUS
                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_ORDER_BY_SUBJECT_REF_FACT_KIND_FACT_REF;
        return jdbc.query(
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
    }

    public void lockCatalogVoidSubjectRows(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        jdbc.query(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ALTERNATE_A + ownerColumn
                        + InventoryCatalogLifecycleServiceSql.OWNER_TARGET_LOCK_SUFFIX,
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        jdbc.query(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_BOM_BOM_REF_DATA_NODE_REF_BRAND_REF + ownerColumn
                        + InventoryCatalogLifecycleServiceSql.OWNER_BOM_LOCK_SUFFIX,
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        List<UUID> ownedTargetRefs = jdbc.query(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_TARGET_REF_DATA_NODE_REF_BRAND_REF_ALTERNATE_B + ownerColumn
                        + InventoryCatalogLifecycleServiceSql.OWNER_TARGET_ORDER_SUFFIX,
                (result, rowNumber) -> result.getObject(1, UUID.class),
                scope,
                brand,
                subject.ref());
        if (ownedTargetRefs.isEmpty()) return;
        String placeholders = String.join(
                InventoryCatalogLifecycleServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(ownedTargetRefs.size(), InventoryCatalogLifecycleServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.addAll(ownedTargetRefs.stream().map(UUID::toString).toList());
        jdbc.query(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_LATERAL_BOM_BOM_REF_JSONB_ARRAY_ELEMENTS
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CASE_JSONB_TYPEOF_BOM_ROWS_ENTRY
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_WHERE_BOM_DATA_NODE_REF_BRAND_REF_DEFINITION_STATUS_ALTERNATE_A
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_ENTRY_TARGET_REF_COMPONENT_TARGET_REF + placeholders
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CLOSE_PAREN_ALTERNATE_E
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_ORDER_BY_BOM_BOM_REF,
                (result, rowNumber) -> result.getObject(1, UUID.class),
                arguments.toArray());
    }

    public long countActiveOwnedDefinitions(String scope, String brand, InventoryOwnerApi.CatalogVoidSubject subject) {
        String ownerColumn = catalogVoidOwnerColumn(subject.kind());
        Long count = jdbc.queryForObject(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_STOCK_TARGET_DATA_NODE_REF_BRAND_REF
                        + ownerColumn + InventoryCatalogLifecycleServiceSql.ACTIVE_TARGET_COUNT_SUFFIX
                        + InventoryCatalogLifecycleServiceSql.ACTIVE_BOM_COUNT_PREFIX
                        + ownerColumn + InventoryCatalogLifecycleServiceSql.ACTIVE_BOM_COUNT_SUFFIX,
                Long.class,
                scope,
                brand,
                subject.ref(),
                scope,
                brand,
                subject.ref());
        return count == null ? 0L : count;
    }

    public ReceiptRow readReceipt(String scope, String key) {
        AdvisoryLock.acquire(jdbc, "inventory-receipt", scope, key);
        return jdbc.query(
                        InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                                + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONDITION_IDEMPOTENCY_KEY,
                        (r, n) -> new ReceiptRow(r.getString(1), r.getString(2), r.getString(3)),
                        scope,
                        key)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void saveReceipt(
            String scope, String key, String operation, String requestHash, String responseJson) {
        jdbc.update(
                InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_INSERT_INTO
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_COMMAND_RECEIPT
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_H_RE
                        + InventoryCatalogLifecycleServiceSql.INVENTORY_CATALOG_LIFECYCLE_SERVICE_CONTINUATION_SPONSE_CREATED_AT_EPOCH_MILLIS,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                responseJson,
                time.currentEpochMillis());
    }

    private static String catalogVoidOwnerColumn(InventoryOwnerApi.CatalogVoidSubjectKind kind) {
        return switch (kind) {
            case CATALOG_ITEM -> "item_ref";
            case PRODUCT_SKU -> "product_sku_ref";
            case OPTION_VALUE -> throw new InventoryOwnerApi.Problem(
                    "REFERENCE_MAPPING_UNRESOLVED", 422, "option value is not a catalog void subject");
        };
    }

    public enum DependencySource {
        STOCK_TARGET_ITEM("stock_target", "item_ref"),
        STOCK_TARGET_SKU("stock_target", "product_sku_ref"),
        STOCK_BOM_ITEM("stock_bom", "item_ref"),
        STOCK_BOM_SKU("stock_bom", "product_sku_ref"),
        STOCK_BOM_OPTION_VALUE("stock_bom", "option_value_ref");

        private final String tableName;
        private final String columnName;

        DependencySource(String tableName, String columnName) {
            this.tableName = tableName;
            this.columnName = columnName;
        }

        public static DependencySource from(String tableName, String columnName) {
            for (DependencySource source : values()) {
                if (source.tableName.equals(tableName) && source.columnName.equals(columnName)) return source;
            }
            throw new IllegalArgumentException("Unsupported inventory dependency source");
        }

        private String tableName() {
            return tableName;
        }

        private String columnName() {
            return columnName;
        }
    }

    public record UnitLifecycleUsage(List<UUID> targetRefs, long ledgerCount, long bomCount) {}

    public record TargetConsumptionUnitRow(UUID targetRef, UUID productSkuRef, UUID consumptionUnitRef) {}

    public record VoidDependencyFact(
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

    public record BatchRetirementFacts(
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

    public record ReceiptRow(String operation, String requestHash, String responseJson) {}
}
