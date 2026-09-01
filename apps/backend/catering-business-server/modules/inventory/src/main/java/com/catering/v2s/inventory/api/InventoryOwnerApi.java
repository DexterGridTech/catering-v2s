package com.catering.v2s.inventory.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Public inventory owner boundary. Inventory facts are stored and changed only in inventory schema. */
public interface InventoryOwnerApi {
    /** Immutable copied catalog unit fact. Inventory never resolves it from catalog during a stock mutation/read. */
    record UnitSnapshot(UUID unitRef, String code, String name, String unitDimension, int precision) {}

    /** Counting is an input conversion only; it never replaces the target's consumption unit snapshot. */
    record CountingUnitConfiguration(UnitSnapshot countingUnitSnapshot, BigDecimal conversionFactor) {}

    /** Effective catalog/SKU base-unit facts supplied by catalog before its own save write. */
    record CatalogSkuBaseMeasureUnit(UUID productSkuRef, UnitSnapshot unitSnapshot) {}

    enum CatalogUnitLifecycleChange {
        RENAME,
        UPDATE_DEFINITION,
        DISABLE,
        DELETE
    }

    /**
     * Legacy owner boundary retained for source compatibility. Callers that can reach a runtime edge must use the
     * scope-typed overload below so the inventory owner can reject head-company balance reads.
     */
    default JsonNode read(
            String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return read(operationId, dataNodeRef, brandRef, request, requestId, null);
    }

    JsonNode read(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String dataNodeType);

    /** Typed task-read boundaries. The legacy operation-id entrypoint remains deferred to BP-U06. */
    JsonNode readTargets(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType);

    JsonNode readTarget(String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType);

    JsonNode readTargetChangeSummary(
            String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType);

    JsonNode readTargetBusinessHistory(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType);

    JsonNode readTargetConsumptionReferences(
            String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId);

    JsonNode readTargetLedger(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType);

    JsonNode readTargetDiagnostics(String targetRef, String requestId);

    /** Mutating owner boundary; the server-minted grant is rechecked before receipt replay. */
    JsonNode write(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            String dataNodeType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * M1 command boundary for an operations inventory count. Scope/grant facts come only from the resolved context; the
     * request cannot select them.
     */
    InventoryMutationReadback countTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CountTargetCommand command,
            String idempotencyKey);

    /** M1 command boundary for a positive inventory increase. */
    InventoryMutationReadback increaseTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            IncreaseTargetCommand command,
            String idempotencyKey);

    /** M1 command boundary for an explicitly directed inventory adjustment. */
    InventoryMutationReadback adjustTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            AdjustTargetCommand command,
            String idempotencyKey);

    /** M1 command boundary for the owner-held inventory configuration. */
    InventoryTargetCurrentReadback updateTargetConfiguration(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UpdateTargetConfigurationCommand command,
            String idempotencyKey);

    record CountTargetCommand(
            UUID targetRef,
            long expectedVersion,
            BigDecimal countedQuantity,
            UUID countingUnitRef,
            boolean zeroConfirmation,
            String note) {}

    record IncreaseTargetCommand(
            UUID targetRef, long expectedVersion, BigDecimal quantity, UUID countingUnitRef, String note) {}

    record AdjustTargetCommand(
            UUID targetRef,
            long expectedVersion,
            String direction,
            BigDecimal quantity,
            UUID countingUnitRef,
            String reasonCode,
            String note) {}

    record InventoryConfiguration(
            boolean allowNegative,
            BigDecimal lowStockThreshold,
            UUID countingUnitRef,
            BigDecimal conversionFactor,
            UnitSnapshot countingUnitSnapshot) {}

    record UpdateTargetConfigurationCommand(
            UUID targetRef, long expectedVersion, InventoryConfiguration configuration) {}

    /** Owner-native mutation result; HTTP serialization remains at the edge. */
    record InventoryMutationReadback(
            UUID targetRef,
            BigDecimal before,
            BigDecimal change,
            BigDecimal after,
            UUID ledgerEntryRef,
            String stockState,
            long version) {}

    /** Owner-native current-target readback used by the configuration command. */
    record InventoryTargetCurrentReadback(
            InventoryTargetReadback target,
            BigDecimal balance,
            InventoryConfiguration configuration,
            long version,
            String stockState,
            boolean stale,
            boolean unknown,
            BigDecimal threshold,
            BigDecimal gap,
            InventoryChangeSummaryReadback changeSummary,
            java.util.List<InventoryRecentChangeReadback> recentChanges,
            InventoryDiagnosticsAvailabilityReadback diagnosticsAvailability) {}

    record InventoryTargetReadback(
            UUID targetRef,
            UUID itemRef,
            UUID productSkuRef,
            String targetType,
            String productCode,
            String productName,
            String productShape,
            String skuCode,
            String skuName,
            UnitSnapshot consumptionUnitSnapshot,
            UnitSnapshot countingUnitSnapshot,
            String conversionSummary,
            String authorityType,
            InventoryConversionFacts conversionFacts) {}

    /** Typed conversion facts; presentation strings remain only during the approved dual projection window. */
    record InventoryConversionFacts(
            UnitSnapshot countingUnitSnapshot, UnitSnapshot consumptionUnitSnapshot, BigDecimal conversionFactor) {}

    record InventoryChangeSummaryReadback(
            InventoryChangePeriodReadback today,
            InventoryChangePeriodReadback sevenDays,
            InventoryChangePeriodReadback thirtyDays) {}

    record InventoryChangePeriodReadback(
            BigDecimal increase, BigDecimal decrease, BigDecimal netChange, long entryCount) {}

    record InventoryRecentChangeReadback(long occurredAt, String changeType, BigDecimal quantity, String source) {}

    record InventoryDiagnosticsAvailabilityReadback(boolean canRead, String reason) {}

    /** Coordinated copy command; inventory owns balance/ledger reset and BOM facts. */
    JsonNode copy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Read-only owner judgement used by catalog copy preflight and the execute recheck. It must include every inventory
     * object/version that can be changed by the approved item closure; it does not write balance or ledger facts.
     */
    JsonNode preflightCopy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request);

    record LocalCopyPreflightCommand(
            String targetItemCode, java.util.List<String> selectedSections, String catalogReferencePlanJson) {}

    record LocalCopyPreflightReadback(String preflightDigest, String canonicalJson) {}

    /**
     * Request-local, owner-created immutable preparation. Only the canonical readback crosses the boundary; the
     * hydrated inventory closure remains private to the inventory owner and is consumed by the matching execute call.
     */
    interface CopyExecutionPreparation {
        LocalCopyPreflightReadback preflight();
    }

    LocalCopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyPreflightCommand command);

    CopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyPreflightCommand command);

    record LocalCopyExecuteCommand(
            String sourceItemCode,
            String targetItemCode,
            java.util.List<String> selectedSections,
            String inventoryPreflightDigest,
            String catalogReferencePlanJson) {}
    /** Named execution contribution; receipt JSON remains private to inventory. */
    record LocalCopySkippedReadback(String section, String reasonCode) {}

    record LocalCopyExecutionReadback(
            String owner, String status, long version, java.util.List<LocalCopySkippedReadback> skipped) {}

    LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            LocalCopyExecuteCommand command,
            String idempotencyKey);

    LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            LocalCopyExecuteCommand command,
            String idempotencyKey,
            CopyExecutionPreparation preparation);

    record BrandCopyPreflightCommand(
            java.util.List<String> selectedItemCodes, String targetDataNodeRef, String catalogReferencePlanJson) {}

    record BrandCopyExecuteCommand(
            java.util.List<String> selectedItemCodes,
            String targetDataNodeRef,
            String inventoryPreflightDigest,
            String catalogReferencePlanJson) {}

    LocalCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);

    CopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);

    LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            BrandCopyExecuteCommand command,
            String idempotencyKey);

    LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            BrandCopyExecuteCommand command,
            String idempotencyKey,
            CopyExecutionPreparation preparation);

    /**
     * Task-read used by the catalog detail surface. It returns only the definition graph (StockTarget configuration and
     * ProductBom rows); it never exposes balance or ledger facts and therefore is valid for a head-company catalog read
     * as well as a store read.
     */
    default JsonNode readCatalogInventoryDefinition(
            String dataNodeRef, String brandRef, String itemRef, String requestId) {
        throw new UnsupportedOperationException("inventory definition read is not implemented");
    }

    /**
     * Owner judgement used by catalog lifecycle commands. The inventory owner decides whether an item still has
     * inventory-owned facts; the catalog coordinator must not infer this from a task-read payload.
     */
    default JsonNode catalogItemVoidDependencies(
            String dataNodeRef, String brandRef, String itemRef, String requestId) {
        throw new UnsupportedOperationException("inventory void-dependency judgement is not implemented");
    }

    /** M1 typed owner judgement used before a catalog item can transition to VOIDED. */
    CatalogItemVoidDependencyReadback catalogItemVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemRef);

    record CatalogItemVoidDependencyReadback(boolean hasDependentFacts, long stockTargetCount, long productBomCount) {}

    /**
     * Explicit lifecycle subject used by catalog when it asks inventory to judge or retire owned definitions. The
     * subject kind is part of the value so an item and one of its SKUs cannot accidentally share a column-only query.
     */
    enum CatalogVoidSubjectKind {
        CATALOG_ITEM,
        PRODUCT_SKU,
        OPTION_VALUE
    }

    record CatalogVoidSubject(CatalogVoidSubjectKind kind, UUID ref) {}

    /** One active BOM component row that points at a catalog lifecycle subject. */
    record CatalogVoidInboundBomReference(
            CatalogVoidSubjectKind sourceKind,
            UUID sourceItemRef,
            UUID sourceSkuRef,
            UUID sourceOptionValueRef,
            UUID targetRef,
            String sourceCode,
            String sourceName,
            long count) {}

    /**
     * Inventory's lifecycle judgement. Owned definitions are facts to retire, not blockers; only inbound active BOM
     * rows block the catalog subject. The all/active/disabled sets make the status boundary explicit for callers.
     */
    record CatalogVoidDependencyReadback(
            CatalogVoidSubject subject,
            Set<UUID> ownedTargetRefsAllStatus,
            Set<UUID> ownedActiveTargetRefs,
            Set<UUID> ownedDisabledTargetRefs,
            long ownedActiveStockTargetCount,
            long ownedActiveProductBomCount,
            List<CatalogVoidInboundBomReference> inboundBomReferences) {
        public boolean hasInboundBomReferences() {
            return inboundBomReferences != null && !inboundBomReferences.isEmpty();
        }

        public CatalogVoidDependencyReadback {
            ownedTargetRefsAllStatus =
                    ownedTargetRefsAllStatus == null ? Set.of() : Set.copyOf(ownedTargetRefsAllStatus);
            ownedActiveTargetRefs = ownedActiveTargetRefs == null ? Set.of() : Set.copyOf(ownedActiveTargetRefs);
            ownedDisabledTargetRefs = ownedDisabledTargetRefs == null ? Set.of() : Set.copyOf(ownedDisabledTargetRefs);
            inboundBomReferences = inboundBomReferences == null ? List.of() : List.copyOf(inboundBomReferences);
        }
    }

    /** Readback proving the inventory-owned half of a catalog VOID transition completed. */
    record CatalogVoidInventoryRetirementReadback(
            CatalogVoidSubject subject,
            long retiredStockTargetCount,
            long retiredProductBomCount,
            long remainingActiveOwnedDefinitionCount) {}

    /**
     * Explicit item/SKU lifecycle judgement. The default is a source-compatible bridge for narrow test doubles; the
     * concrete inventory owner overrides it with one scoped set-based read.
     */
    default CatalogVoidDependencyReadback catalogVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, CatalogVoidSubject subject) {
        if (subject == null || subject.kind() == null || subject.ref() == null)
            throw new Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "catalog void subject is required");
        if (subject.kind() != CatalogVoidSubjectKind.CATALOG_ITEM)
            throw new Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "SKU inventory void judgement is not implemented");
        CatalogItemVoidDependencyReadback legacy =
                catalogItemVoidDependencies(context, subject.ref().toString());
        if (legacy == null) throw new Problem("RESULT_UNKNOWN", 500, "inventory void dependency readback is missing");
        return new CatalogVoidDependencyReadback(
                subject, Set.of(), Set.of(), Set.of(), legacy.stockTargetCount(), legacy.productBomCount(), List.of());
    }

    /** Collection boundary used by batch VOID preflight; the concrete owner must keep this set-based. */
    default List<CatalogVoidDependencyReadback> catalogVoidDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubjectKind kind,
            List<UUID> references) {
        if (references == null || references.isEmpty()) return List.of();
        return references.stream()
                .distinct()
                .map(ref -> catalogVoidDependencies(context, new CatalogVoidSubject(kind, ref)))
                .toList();
    }

    /**
     * Retires only the subject's own ENABLED inventory definitions after an owner recheck. This is an internal command
     * boundary, not a new HTTP operation. The default keeps old unit-test doubles source-compatible.
     */
    default CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitions(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        CatalogVoidDependencyReadback judgement = catalogVoidDependencies(context, subject);
        if (judgement.hasInboundBomReferences()) {
            throw new Problem("REFERENCE_BLOCKS_VOID", 422, /* format-wrap */ "库存 BOM 仍引用该对象");
        }
        long own = judgement.ownedActiveStockTargetCount() + judgement.ownedActiveProductBomCount();
        return new CatalogVoidInventoryRetirementReadback(subject, 0L, 0L, own);
    }

    /**
     * Batch-item variant used by the catalog owner while its batch-start locks are held. The enclosing catalog batch
     * receipt still owns replay of the item result; the concrete inventory owner must retain its own scoped validation,
     * retirement, and owner readback in the item's REQUIRED transaction. The default keeps narrow test doubles
     * source-compatible and deliberately falls back to the full command path.
     */
    default CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitionsForBatch(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        return retireCatalogVoidInventoryDefinitions(context, subject, idempotencyKey);
    }

    /** Untyped detail projection for SKU lifecycle facts; it remains an owner read, not an HTTP operation. */
    default JsonNode catalogSkuVoidDependencies(String dataNodeRef, String brandRef, String skuRef, String requestId) {
        throw new UnsupportedOperationException("inventory SKU void-dependency judgement is not implemented");
    }

    /** Batched untyped detail projection; the concrete owner must keep the SKU judgement set-based. */
    default List<JsonNode> catalogSkuVoidDependenciesByRefs(
            String dataNodeRef, String brandRef, List<UUID> skuRefs, String requestId) {
        if (skuRefs == null || skuRefs.isEmpty()) return List.of();
        return skuRefs.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .map(ref -> catalogSkuVoidDependencies(dataNodeRef, brandRef, ref.toString(), requestId))
                .toList();
    }

    /**
     * Typed catalog-owner judgement for lifecycle guards on concrete catalog references. This is an owner-to-owner read
     * boundary, not an HTTP operation.
     */
    CatalogReferenceDependenciesReadback catalogReferenceDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, String reference);

    /**
     * Typed collection judgement for lifecycle guards. The inventory owner keeps the table declarations and returns one
     * independently attributable readback per requested reference.
     */
    List<CatalogReferenceDependenciesReadback> catalogReferenceDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, List<UUID> references);

    record CatalogReferenceDependenciesReadback(
            String objectType, UUID reference, long totalCount, List<CatalogReferenceDependencySource> sources) {
        public boolean hasDependentFacts() {
            return totalCount > 0;
        }
    }

    record CatalogReferenceDependencySource(String tableName, String columnName, long count) {}

    /**
     * Same-transaction owner judgement used by catalog unit lifecycle. This locks only inventory-owned unit references
     * and never lets catalog inspect inventory tables directly.
     */
    void validateCatalogUnitLifecycle(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID unitRef,
            CatalogUnitLifecycleChange intendedChange);

    /**
     * Rejects a catalog base-unit change that would leave an existing stock target with a different consumption
     * snapshot. Inventory locks its own targets; catalog must not inspect inventory tables directly.
     */
    void validateCatalogItemBaseMeasureUnitTransition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID itemRef,
            UnitSnapshot itemBaseMeasureUnit,
            List<CatalogSkuBaseMeasureUnit> skuBaseMeasureUnits);

    /**
     * Bounded task-read for the catalog workbench. It returns definition counts for the supplied product codes in one
     * owner query; it never exposes balances or ledgers, so the same read is valid for a store or a head-company
     * catalog.
     */
    default JsonNode readCatalogInventorySummary(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        throw new UnsupportedOperationException("inventory summary read is not implemented");
    }

    /** Cursor task-read used by the catalog inventory workbench for BOM component selection. */
    default JsonNode readCatalogInventoryConsumptionTargetCandidates(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        throw new UnsupportedOperationException("inventory consumption target candidate read is not implemented");
    }

    /** Controlled creation path from a catalog item's inventory/BOM tab. */
    JsonNode ensureCatalogInventoryTarget(
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode ensureCatalogInventoryTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Owner command for ProductBom rows; component targets must already exist. */
    JsonNode saveCatalogProductBom(
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode saveCatalogProductBom(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Typed catalog-save boundary. The canonical request text remains opaque outside the inventory owner; parsing,
     * target recheck, receipt replay and final result stay here.
     */
    record CatalogItemSaveEnsureTargetCommand(String canonicalRequestJson) {}

    record CatalogItemSaveBomCommand(String canonicalRequestJson) {}

    /** One immutable whole-save command for every inventory owner definition derived by catalog. */
    record CatalogInventoryRulesReplaceCommand(String canonicalRequestJson) {}

    record InventoryConsumptionTargetCandidateQuery(String keyword, long cursor, int pageSize) {}

    record CatalogItemSaveReadback(String canonicalJson) {}

    CatalogItemSaveReadback ensureCatalogItemSaveTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveEnsureTargetCommand command,
            String idempotencyKey);

    CatalogItemSaveReadback saveCatalogItemProductBom(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveBomCommand command,
            String idempotencyKey);

    CatalogItemSaveReadback replaceCatalogInventoryRules(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogInventoryRulesReplaceCommand command,
            String idempotencyKey);

    /**
     * Catalog asks this owner to resolve the inventory fact required by a point-of-sale option's material rule. The
     * returned target is an inventory fact; catalog never infers it from an item read model.
     */
    /**
     * Catalog stores the resolved stock target and its owner-declared consumption unit with the option definition. The
     * unit is an inventory fact: catalog must not infer it from a material item label when composing an actual
     * per-option consumption row later.
     */
    record CatalogMaterialStockTargetReadback(
            UUID materialItemRef, UUID stockTargetRef, UnitSnapshot consumptionUnitSnapshot) {}

    CatalogMaterialStockTargetReadback resolveCatalogMaterialStockTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID materialItemRef);

    /** Resolves a material set under one inventory-owner read boundary; order follows the supplied refs. */
    default List<CatalogMaterialStockTargetReadback> resolveCatalogMaterialStockTargets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, Collection<UUID> materialItemRefs) {
        if (materialItemRefs == null || materialItemRefs.isEmpty()) return List.of();
        return materialItemRefs.stream()
                .distinct()
                .map(ref -> resolveCatalogMaterialStockTarget(context, ref))
                .toList();
    }

    /**
     * Catalog owns definition/value lifecycle. This command removes only inventory-owned BOM rows whose option-value
     * owner is in the explicitly deleted catalog value set; it never removes a stock target or material item.
     */
    record CatalogOptionValueBomDeleteCommand(List<UUID> optionValueRefs) {}

    record OptionValueBomDeleteReadback(List<UUID> optionValueRefs, long deletedCount) {}

    OptionValueBomDeleteReadback deleteCatalogOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOptionValueBomDeleteCommand command,
            String idempotencyKey);

    /**
     * A same-scope temporary-item promotion receives new catalog item identity while retaining the already configured
     * option-value consumption facts. Catalog owns the decision to promote; inventory alone copies the BOM owners.
     */
    record CatalogOptionValueBomCopyCommand(
            UUID sourceItemRef, UUID targetItemRef, String targetItemCode, List<UUID> optionValueRefs) {}

    record OptionValueBomCopyReadback(List<UUID> optionValueRefs, long copiedCount) {}

    OptionValueBomCopyReadback copyCatalogOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOptionValueBomCopyCommand command,
            String idempotencyKey);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;
        private final JsonNode details;

        public Problem(String code, int status, String message) {
            super(message);
            this.code = code;
            this.status = status;
            this.details = null;
        }

        public Problem(String code, int status, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
            this.status = status;
            this.details = null;
        }

        public Problem(String code, int status, String message, JsonNode details) {
            super(message);
            this.code = code;
            this.status = status;
            this.details = details;
        }

        public String code() {
            return code;
        }

        public int status() {
            return status;
        }

        public JsonNode details() {
            return details;
        }
    }
}
