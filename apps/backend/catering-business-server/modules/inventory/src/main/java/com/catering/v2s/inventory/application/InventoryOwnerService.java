package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Stable Inventory owner facade; implementation is divided by owner capability. */
@Service
public class InventoryOwnerService implements InventoryOwnerApi {
    private final InventoryAvailabilityService availabilityService;
    private final InventoryTargetService targetService;
    private final InventoryCatalogLifecycleService lifecycleService;
    private final InventoryBomService bomService;
    private final InventoryCopyService copyService;
    private final InventoryReadRouter readRouter;
    private final InventoryCommandRouter commandRouter;

    @Autowired
    public InventoryOwnerService(
            InventoryAvailabilityService availabilityService,
            InventoryTargetService targetService,
            InventoryCatalogLifecycleService lifecycleService,
            InventoryBomService bomService,
            InventoryCopyService copyService,
            InventoryReadRouter readRouter,
            InventoryCommandRouter commandRouter) {
        this.availabilityService = availabilityService;
        this.targetService = targetService;
        this.lifecycleService = lifecycleService;
        this.bomService = bomService;
        this.copyService = copyService;
        this.readRouter = readRouter;
        this.commandRouter = commandRouter;
    }

    public InventoryOwnerService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.availabilityService = new InventoryAvailabilityService(jdbc, mapper, time);
        this.targetService = new InventoryTargetService(jdbc, mapper, time);
        this.lifecycleService = new InventoryCatalogLifecycleService(jdbc, mapper, time);
        this.bomService = new InventoryBomService(jdbc, mapper, time);
        this.copyService = new InventoryCopyService(jdbc, mapper, time);
        this.readRouter = new InventoryReadRouter(this.targetService);
        this.commandRouter = new InventoryCommandRouter(this.targetService);
    }

    @Override
    public List<InventoryOwnerApi.InventoryAvailabilityFact> readSalesMenuAvailability(
            String dataNodeRef, String brandRef, Set<InventoryOwnerApi.InventoryTargetRef> targetRefs) {
        return availabilityService.readSalesMenuAvailability(dataNodeRef, brandRef, targetRefs);
    }

    @Override
    public JsonNode readTargets(
            String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        return targetService.readTargets(dataNodeRef, brandRef, request, requestId, dataNodeType);
    }

    @Override
    public JsonNode readTarget(
            String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType) {
        return targetService.readTarget(dataNodeRef, brandRef, targetRef, requestId, dataNodeType);
    }

    @Override
    public JsonNode readTargetChangeSummary(
            String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType) {
        return targetService.readTargetChangeSummary(dataNodeRef, brandRef, targetRef, period, dataNodeType);
    }

    @Override
    public JsonNode readTargetBusinessHistory(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        return targetService.readTargetBusinessHistory(
                dataNodeRef, brandRef, targetRef, request, requestId, dataNodeType);
    }

    @Override
    public JsonNode readTargetConsumptionReferences(
            String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId) {
        return targetService.readTargetConsumptionReferences(dataNodeRef, brandRef, targetRef, request, requestId);
    }

    @Override
    public JsonNode readTargetLedger(
            String dataNodeRef,
            String brandRef,
            String targetRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        return targetService.readTargetLedger(dataNodeRef, brandRef, targetRef, request, requestId, dataNodeType);
    }

    @Override
    public JsonNode readTargetDiagnostics(String targetRef, String requestId) {
        return targetService.readTargetDiagnostics(targetRef, requestId);
    }

    @Override
    public JsonNode read(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        return readRouter.read(operationId, dataNodeRef, brandRef, request, requestId, dataNodeType);
    }

    @Override
    public JsonNode write(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            String dataNodeType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return commandRouter.write(
                operationId,
                dataNodeRef,
                brandRef,
                request,
                requestId,
                idempotencyKey,
                dataNodeType,
                workspaceUuid,
                groupWorkspaceKey,
                ownerScopeGrant);
    }

    @Override
    public JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        return commandRouter.write(context, request, idempotencyKey);
    }

    @Override
    public InventoryMutationReadback countTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CountTargetCommand command,
            String idempotencyKey) {
        return targetService.countTarget(context, command, idempotencyKey);
    }

    @Override
    public InventoryMutationReadback increaseTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            IncreaseTargetCommand command,
            String idempotencyKey) {
        return targetService.increaseTarget(context, command, idempotencyKey);
    }

    @Override
    public InventoryMutationReadback adjustTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            AdjustTargetCommand command,
            String idempotencyKey) {
        return targetService.adjustTarget(context, command, idempotencyKey);
    }

    @Override
    public InventoryTargetCurrentReadback updateTargetConfiguration(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UpdateTargetConfigurationCommand command,
            String idempotencyKey) {
        return targetService.updateTargetConfiguration(context, command, idempotencyKey);
    }

    @Override
    public void validateCatalogUnitLifecycle(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID unitRef,
            CatalogUnitLifecycleChange intendedChange) {
        lifecycleService.validateCatalogUnitLifecycle(context, unitRef, intendedChange);
    }

    @Override
    public void validateCatalogItemBaseMeasureUnitTransition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID itemRef,
            UnitSnapshot itemBaseMeasureUnit,
            List<CatalogSkuBaseMeasureUnit> skuBaseMeasureUnits) {
        lifecycleService.validateCatalogItemBaseMeasureUnitTransition(
                context, itemRef, itemBaseMeasureUnit, skuBaseMeasureUnits);
    }

    @Override
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
        return copyService.copy(
                sourceDataNodeRef,
                targetDataNodeRef,
                brandRef,
                request,
                requestId,
                idempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                targetDataNodeType,
                ownerScopeGrant);
    }

    @Override
    public JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        return copyService.copy(context, request, idempotencyKey);
    }

    @Override
    public JsonNode preflightCopy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return copyService.preflightCopy(
                sourceDataNodeRef,
                targetDataNodeRef,
                brandRef,
                request,
                workspaceUuid,
                groupWorkspaceKey,
                targetDataNodeType,
                ownerScopeGrant);
    }

    @Override
    public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request) {
        return copyService.preflightCopy(context, request);
    }

    @Override
    public InventoryOwnerApi.LocalCopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyPreflightCommand command) {
        return copyService.preflightLocalCopy(context, command);
    }

    @Override
    public InventoryOwnerApi.CopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyPreflightCommand command) {
        return copyService.prepareLocalCopy(context, command);
    }

    @Override
    public InventoryOwnerApi.LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey) {
        return copyService.executeLocalCopy(context, command, idempotencyKey);
    }

    @Override
    public InventoryOwnerApi.LocalCopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.LocalCopyExecuteCommand command,
            String idempotencyKey,
            InventoryOwnerApi.CopyExecutionPreparation preparation) {
        return copyService.executeLocalCopy(context, command, idempotencyKey, preparation);
    }

    @Override
    public InventoryOwnerApi.LocalCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyPreflightCommand command) {
        return copyService.preflightBrandCopy(context, command);
    }

    @Override
    public InventoryOwnerApi.CopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyPreflightCommand command) {
        return copyService.prepareBrandCopy(context, command);
    }

    @Override
    public InventoryOwnerApi.LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey) {
        return copyService.executeBrandCopy(context, command, idempotencyKey);
    }

    @Override
    public InventoryOwnerApi.LocalCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            InventoryOwnerApi.BrandCopyExecuteCommand command,
            String idempotencyKey,
            InventoryOwnerApi.CopyExecutionPreparation preparation) {
        return copyService.executeBrandCopy(context, command, idempotencyKey, preparation);
    }

    @Override
    public JsonNode readCatalogInventoryDefinition(String scope, String brand, String itemRef, String requestId) {
        return bomService.readCatalogInventoryDefinition(scope, brand, itemRef, requestId);
    }

    @Override
    public JsonNode catalogItemVoidDependencies(String scope, String brand, String itemRef, String requestId) {
        return lifecycleService.catalogItemVoidDependencies(scope, brand, itemRef, requestId);
    }

    @Override
    public JsonNode catalogSkuVoidDependencies(String scope, String brand, String skuRef, String requestId) {
        return lifecycleService.catalogSkuVoidDependencies(scope, brand, skuRef, requestId);
    }

    @Override
    public List<JsonNode> catalogSkuVoidDependenciesByRefs(
            String scope, String brand, List<UUID> skuRefs, String requestId) {
        return lifecycleService.catalogSkuVoidDependenciesByRefs(scope, brand, skuRefs, requestId);
    }

    @Override
    public CatalogItemVoidDependencyReadback catalogItemVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemRef) {
        return lifecycleService.catalogItemVoidDependencies(context, itemRef);
    }

    @Override
    public CatalogVoidDependencyReadback catalogVoidDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, CatalogVoidSubject subject) {
        return lifecycleService.catalogVoidDependencies(context, subject);
    }

    @Override
    public List<CatalogVoidDependencyReadback> catalogVoidDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubjectKind kind,
            List<UUID> references) {
        return lifecycleService.catalogVoidDependenciesByRefs(context, kind, references);
    }

    @Override
    public CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitions(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        return lifecycleService.retireCatalogVoidInventoryDefinitions(context, subject, idempotencyKey);
    }

    @Override
    public CatalogVoidInventoryRetirementReadback retireCatalogVoidInventoryDefinitionsForBatch(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogVoidSubject subject,
            String idempotencyKey) {
        return lifecycleService.retireCatalogVoidInventoryDefinitionsForBatch(context, subject, idempotencyKey);
    }

    @Override
    public CatalogReferenceDependenciesReadback catalogReferenceDependencies(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, String reference) {
        return lifecycleService.catalogReferenceDependencies(context, objectType, reference);
    }

    @Override
    public List<CatalogReferenceDependenciesReadback> catalogReferenceDependenciesByRefs(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String objectType, List<UUID> references) {
        return lifecycleService.catalogReferenceDependenciesByRefs(context, objectType, references);
    }

    @Override
    public JsonNode readCatalogInventorySummary(
            String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        return bomService.readCatalogInventorySummary(scope, brand, request, requestId, dataNodeType);
    }

    @Override
    public JsonNode readCatalogInventoryConsumptionTargetCandidates(
            String scope, String brand, ObjectNode request, String requestId, String dataNodeType) {
        return bomService.readCatalogInventoryConsumptionTargetCandidates(
                scope, brand, request, requestId, dataNodeType);
    }

    @Override
    public JsonNode ensureCatalogInventoryTarget(
            String scope,
            String brand,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return bomService.ensureCatalogInventoryTarget(
                scope,
                brand,
                request,
                requestId,
                idempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                dataNodeType,
                ownerScopeGrant);
    }

    @Override
    public JsonNode ensureCatalogInventoryTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        return bomService.ensureCatalogInventoryTarget(context, request, idempotencyKey);
    }

    @Override
    public JsonNode saveCatalogProductBom(
            String scope,
            String brand,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return bomService.saveCatalogProductBom(
                scope,
                brand,
                request,
                requestId,
                idempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                dataNodeType,
                ownerScopeGrant);
    }

    @Override
    public JsonNode saveCatalogProductBom(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        return bomService.saveCatalogProductBom(context, request, idempotencyKey);
    }

    @Override
    public CatalogItemSaveReadback ensureCatalogItemSaveTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveEnsureTargetCommand command,
            String idempotencyKey) {
        return bomService.ensureCatalogItemSaveTarget(context, command, idempotencyKey);
    }

    @Override
    public CatalogItemSaveReadback saveCatalogItemProductBom(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveBomCommand command,
            String idempotencyKey) {
        return bomService.saveCatalogItemProductBom(context, command, idempotencyKey);
    }

    @Override
    public CatalogItemSaveReadback replaceCatalogInventoryRules(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogInventoryRulesReplaceCommand command,
            String idempotencyKey) {
        return bomService.replaceCatalogInventoryRules(context, command, idempotencyKey);
    }

    @Override
    public CatalogMaterialStockTargetReadback resolveCatalogMaterialStockTarget(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID materialItemRef) {
        return bomService.resolveCatalogMaterialStockTarget(context, materialItemRef);
    }

    @Override
    public List<CatalogMaterialStockTargetReadback> resolveCatalogMaterialStockTargets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, Collection<UUID> materialItemRefs) {
        return bomService.resolveCatalogMaterialStockTargets(context, materialItemRefs);
    }

    @Override
    public OptionValueBomDeleteReadback deleteCatalogOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOptionValueBomDeleteCommand command,
            String idempotencyKey) {
        return bomService.deleteCatalogOptionValueBoms(context, command, idempotencyKey);
    }

    @Override
    public OptionValueBomCopyReadback copyCatalogOptionValueBoms(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOptionValueBomCopyCommand command,
            String idempotencyKey) {
        return bomService.copyCatalogOptionValueBoms(context, command, idempotencyKey);
    }

    public static void validateTargetPageQuery(ObjectNode request) {
        InventoryTargetService.validateTargetPageQuery(request);
    }

    static String state(BigDecimal balance, JsonNode config) {
        return InventoryTargetService.state(balance, config);
    }

    static String inventoryTargetType(UUID productSkuRef) {
        return InventoryTargetService.inventoryTargetType(productSkuRef);
    }

    static String requireIdempotencyKey(String key) {
        return InventoryTargetService.requireIdempotencyKey(key);
    }

    static UUID requiredOpaqueRef(ObjectNode request, String key) {
        return InventoryTargetService.requiredOpaqueRef(request, key);
    }

    static String normalizeLineSign(String value) {
        return InventoryTargetService.normalizeLineSign(value);
    }

    private static long periodDurationMillis(String period) {
        return InventoryTargetService.periodDurationMillis(period);
    }

    private static boolean isBusinessHistoryOperation(String operation) {
        return InventoryTargetService.isBusinessHistoryOperation(operation);
    }

    private static void requireStoreDataNodeType(String dataNodeType) {
        InventoryTargetService.requireStoreDataNodeType(dataNodeType);
    }
}
