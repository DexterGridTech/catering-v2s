package com.catering.v2s.inventory.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Public inventory owner boundary. Inventory facts are stored and changed only in inventory schema. */
public interface InventoryOwnerApi {
    /**
     * Legacy owner boundary retained for source compatibility.  Callers that
     * can reach a runtime edge must use the scope-typed overload below so the
     * inventory owner can reject head-company balance reads.
     */
    default JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return read(operationId, dataNodeRef, brandRef, request, requestId, null);
    }

    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType);

    /** Typed task-read boundaries.  The legacy operation-id entrypoint remains deferred to BP-U06. */
    JsonNode readTargets(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType);
    JsonNode readTarget(String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType);
    JsonNode readTargetChangeSummary(String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType);
    JsonNode readTargetBusinessHistory(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId, String dataNodeType);
    JsonNode readTargetConsumptionReferences(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId);
    JsonNode readTargetLedger(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId, String dataNodeType);
    JsonNode readTargetDiagnostics(String targetRef, String requestId);

    /** Mutating owner boundary; the server-minted grant is rechecked before receipt replay. */
    JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, String dataNodeType,
                   UUID workspaceUuid, String groupWorkspaceKey, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode write(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * M1 command boundary for an operations inventory count.  Scope/grant facts
     * come only from the resolved context; the request cannot select them.
     */
    InventoryMutationReadback countTarget(WorkspaceExecutionContext<CatalogAuthorizationScope> context, CountTargetCommand command, String idempotencyKey);

    /** M1 command boundary for a positive inventory increase. */
    InventoryMutationReadback increaseTarget(WorkspaceExecutionContext<CatalogAuthorizationScope> context, IncreaseTargetCommand command, String idempotencyKey);

    /** M1 command boundary for an explicitly directed inventory adjustment. */
    InventoryMutationReadback adjustTarget(WorkspaceExecutionContext<CatalogAuthorizationScope> context, AdjustTargetCommand command, String idempotencyKey);

    /** M1 command boundary for the owner-held inventory configuration. */
    InventoryTargetCurrentReadback updateTargetConfiguration(WorkspaceExecutionContext<CatalogAuthorizationScope> context, UpdateTargetConfigurationCommand command, String idempotencyKey);

    record CountTargetCommand(UUID targetRef, long expectedVersion, BigDecimal countedQuantity, String unit,
                              boolean zeroConfirmation, String note) { }
    record IncreaseTargetCommand(UUID targetRef, long expectedVersion, BigDecimal quantity, String unit, String note) { }
    record AdjustTargetCommand(UUID targetRef, long expectedVersion, String direction, BigDecimal quantity,
                               String unit, String reasonCode, String note) { }
    record InventoryConfiguration(boolean allowNegative, BigDecimal lowStockThreshold, String countingUnit,
                                  BigDecimal conversionFactor) { }
    record UpdateTargetConfigurationCommand(UUID targetRef, long expectedVersion, InventoryConfiguration configuration) { }

    /** Owner-native mutation result; HTTP serialization remains at the edge. */
    record InventoryMutationReadback(UUID targetRef, BigDecimal before, BigDecimal change, BigDecimal after,
                                    UUID ledgerEntryRef, String stockState, long version) { }

    /** Owner-native current-target readback used by the configuration command. */
    record InventoryTargetCurrentReadback(InventoryTargetReadback target, BigDecimal balance,
                                         InventoryConfiguration configuration, long version, String stockState,
                                         boolean stale, boolean unknown, BigDecimal threshold, BigDecimal gap,
                                         InventoryChangeSummaryReadback changeSummary,
                                         java.util.List<InventoryRecentChangeReadback> recentChanges,
                                         java.util.List<InventoryReferenceReadback> references,
                                         java.util.List<InventoryLedgerEntryReadback> ledger,
                                         InventoryDiagnosticsAvailabilityReadback diagnosticsAvailability) { }
    record InventoryTargetReadback(UUID targetRef, UUID itemRef, UUID productSkuRef, String targetType,
                                  String productCode, String productName, String productShape, String skuCode,
                                  String skuName, String consumptionUnit, String countingUnit,
                                  String conversionSummary, String authorityType) { }
    record InventoryChangeSummaryReadback(InventoryChangePeriodReadback today,
                                          InventoryChangePeriodReadback sevenDays,
                                          InventoryChangePeriodReadback thirtyDays) { }
    record InventoryChangePeriodReadback(BigDecimal increase, BigDecimal decrease, BigDecimal netChange,
                                         long entryCount) { }
    record InventoryRecentChangeReadback(long occurredAt, String changeType, BigDecimal quantity, String source) { }
    record InventoryReferenceReadback(String sourceCode, String sourceSkuCode, String sourceOptionValueCode,
                                     String sourceKind, BigDecimal quantity, String unit, String timing,
                                     String status) { }
    record InventoryLedgerEntryReadback(UUID entryRef, String source, String reasonCode, BigDecimal beforeQuantity,
                                        BigDecimal changeQuantity, BigDecimal afterQuantity, long occurredAt) { }
    record InventoryDiagnosticsAvailabilityReadback(boolean canRead, String reason) { }

    /** Coordinated copy command; inventory owns balance/ledger reset and BOM facts. */
    JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                  UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode copy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Read-only owner judgement used by catalog copy preflight and the execute
     * recheck.  It must include every inventory object/version that can be
     * changed by the approved item closure; it does not write balance or
     * ledger facts.
     */
    JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request,
                           UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request);

    record LocalCopyPreflightCommand(String targetItemCode, java.util.List<String> selectedSections, String catalogReferencePlanJson) { }
    record LocalCopyPreflightReadback(String preflightDigest, String canonicalJson) { }
    LocalCopyPreflightReadback preflightLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyPreflightCommand command);
    record LocalCopyExecuteCommand(String sourceItemCode, String targetItemCode, java.util.List<String> selectedSections,
                                   String inventoryPreflightDigest, String catalogReferencePlanJson) { }
    /** Named execution contribution; receipt JSON remains private to inventory. */
    record LocalCopySkippedReadback(String section, String reasonCode) { }
    record LocalCopyExecutionReadback(String owner, String status, long version,
                                      java.util.List<LocalCopySkippedReadback> skipped) { }
    LocalCopyExecutionReadback executeLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyExecuteCommand command, String idempotencyKey);
    record BrandCopyPreflightCommand(java.util.List<String> selectedItemCodes, String targetDataNodeRef, String catalogReferencePlanJson) { }
    record BrandCopyExecuteCommand(java.util.List<String> selectedItemCodes, String targetDataNodeRef, String inventoryPreflightDigest, String catalogReferencePlanJson) { }
    LocalCopyPreflightReadback preflightBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);
    LocalCopyExecutionReadback executeBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyExecuteCommand command, String idempotencyKey);

    /**
     * Task-read used by the catalog detail surface.  It returns only the
     * definition graph (StockTarget configuration and ProductBom rows); it
     * never exposes balance or ledger facts and therefore is valid for a
     * head-company catalog read as well as a store read.
     */
    default JsonNode readCatalogInventoryDefinition(String dataNodeRef, String brandRef, String itemRef, String requestId) {
        throw new UnsupportedOperationException("inventory definition read is not implemented");
    }

    /**
     * Owner judgement used by catalog lifecycle commands.  The inventory owner
     * decides whether an item still has inventory-owned facts; the catalog
     * coordinator must not infer this from a task-read payload.
     */
    default JsonNode catalogItemVoidDependencies(String dataNodeRef, String brandRef, String itemRef, String requestId) {
        throw new UnsupportedOperationException("inventory void-dependency judgement is not implemented");
    }

    /** M1 typed owner judgement used before a catalog item can transition to VOIDED. */
    CatalogItemVoidDependencyReadback catalogItemVoidDependencies(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemRef);

    record CatalogItemVoidDependencyReadback(boolean hasDependentFacts, long stockTargetCount, long productBomCount) { }

    /**
     * Typed catalog-owner judgement for lifecycle guards on concrete catalog references.
     * This is an owner-to-owner read boundary, not an HTTP operation.
     */
    CatalogReferenceDependenciesReadback catalogReferenceDependencies(
        WorkspaceExecutionContext<CatalogAuthorizationScope> context,
        String objectType,
        String reference
    );

    record CatalogReferenceDependenciesReadback(
        String objectType,
        UUID reference,
        long totalCount,
        List<CatalogReferenceDependencySource> sources
    ) {
        public boolean hasDependentFacts() { return totalCount > 0; }
    }

    record CatalogReferenceDependencySource(String tableName, String columnName, long count) { }

    /**
     * Bounded task-read for the catalog workbench.  It returns definition
     * counts for the supplied product codes in one owner query; it never
     * exposes balances or ledgers, so the same read is valid for a store or
     * a head-company catalog.
     */
    default JsonNode readCatalogInventorySummary(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        throw new UnsupportedOperationException("inventory summary read is not implemented");
    }

    /** Controlled creation path from a catalog item's inventory/BOM tab. */
    JsonNode ensureCatalogInventoryTarget(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                                          UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode ensureCatalogInventoryTarget(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Owner command for ProductBom rows; component targets must already exist. */
    JsonNode saveCatalogProductBom(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                                   UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode saveCatalogProductBom(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Typed catalog-save boundary. The canonical request text remains opaque outside the
     * inventory owner; parsing, target recheck, receipt replay and final result stay here.
     */
    record CatalogItemSaveEnsureTargetCommand(String canonicalRequestJson) { }
    record CatalogItemSaveBomCommand(String canonicalRequestJson) { }
    record CatalogItemSaveReadback(String canonicalJson) { }

    CatalogItemSaveReadback ensureCatalogItemSaveTarget(
        WorkspaceExecutionContext<CatalogAuthorizationScope> context,
        CatalogItemSaveEnsureTargetCommand command,
        String idempotencyKey
    );

    CatalogItemSaveReadback saveCatalogItemProductBom(
        WorkspaceExecutionContext<CatalogAuthorizationScope> context,
        CatalogItemSaveBomCommand command,
        String idempotencyKey
    );

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;
        public Problem(String code, int status, String message) { super(message); this.code = code; this.status = status; }
        public String code() { return code; }
        public int status() { return status; }
    }
}
