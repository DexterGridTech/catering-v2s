package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of Catalog unit-definition facts and their status transitions. */
@Service
public class CatalogUnitDefinitionService {
    private final CatalogUnitDefinitionFacts unitDefinitionFacts;
    private final InventoryOwnerApi inventory;
    private final TimeProvider time;

    @Autowired
    public CatalogUnitDefinitionService(JdbcTemplate jdbc, TimeProvider time, InventoryOwnerApi inventory) {
        this(new CatalogUnitDefinitionFacts(jdbc), inventory, time);
    }

    CatalogUnitDefinitionService(
            CatalogUnitDefinitionFacts unitDefinitionFacts, InventoryOwnerApi inventory, TimeProvider time) {
        this.unitDefinitionFacts = unitDefinitionFacts;
        this.inventory = inventory;
        this.time = time;
    }

    public CatalogOwnerApi.UnitDefinitionListReadback listUnitDefinitions(
            String dataNodeRef,
            String brandRef,
            boolean includeInactive,
            CatalogOwnerApi.UnitDimension dimension,
            String query,
            String status) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        List<CatalogOwnerApi.UnitDefinitionReadback> units =
                unitDefinitionFacts.list(dataNodeRef, brandRef, includeInactive, dimension, query, status);
        Set<UUID> referencedUnitRefs = unitDefinitionFacts.referencedRefs(units.stream()
                .map(CatalogOwnerApi.UnitDefinitionReadback::unitRef)
                .toList());
        return new CatalogOwnerApi.UnitDefinitionListReadback(units, referencedUnitRefs);
    }

    @Transactional
    public CatalogOwnerApi.UnitDefinitionReadback createUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "createOperationsCatalogUnit");
        return unitDefinitionFacts.create(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Transactional
    public CatalogOwnerApi.UnitDefinitionReadback updateUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "updateOperationsCatalogUnit");
        inventory.validateCatalogUnitLifecycle(
                context,
                command.unitRef(),
                unitDefinitionFacts.definitionShapeChanges(command)
                        ? InventoryOwnerApi.CatalogUnitLifecycleChange.UPDATE_DEFINITION
                        : InventoryOwnerApi.CatalogUnitLifecycleChange.RENAME);
        return unitDefinitionFacts.update(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Transactional
    public CatalogOwnerApi.UnitDefinitionReadback transitionUnitStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.UnitDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "transitionOperationsCatalogUnitStatus");
        inventory.validateCatalogUnitLifecycle(
                context,
                command.unitRef(),
                "VOIDED".equals(command.targetStatus())
                        ? InventoryOwnerApi.CatalogUnitLifecycleChange.DELETE
                        : InventoryOwnerApi.CatalogUnitLifecycleChange.DISABLE);
        return unitDefinitionFacts.transition(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    private long now() {
        return time.currentEpochMillis();
    }
}
