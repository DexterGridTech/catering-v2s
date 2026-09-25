package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of Catalog order-option definition facts and their status transitions. */
@Service
public class CatalogOrderOptionDefinitionService {
    private final CatalogDefinitionFacts definitionFacts;
    private final TimeProvider time;

    @Autowired
    public CatalogOrderOptionDefinitionService(JdbcTemplate jdbc, TimeProvider time) {
        this(new CatalogDefinitionFacts(jdbc), time);
    }

    CatalogOrderOptionDefinitionService(CatalogDefinitionFacts definitionFacts, TimeProvider time) {
        this.definitionFacts = definitionFacts;
        this.time = time;
    }

    public CatalogOwnerApi.OrderOptionDefinitionListReadback listOrderOptionDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        return new CatalogOwnerApi.OrderOptionDefinitionListReadback(
                definitionFacts.listOrderOptions(dataNodeRef, brandRef, candidateUsage));
    }

    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionReadback createOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "createOperationsCatalogOrderOptionDefinition");
        return definitionFacts.createOrderOption(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionMutationReadback updateOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "updateOperationsCatalogOrderOptionDefinition");
        return definitionFacts.updateOrderOption(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Transactional
    public CatalogOwnerApi.OrderOptionDefinitionReadback transitionOrderOptionDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.OrderOptionDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "transitionOperationsCatalogOrderOptionDefinitionStatus");
        return definitionFacts.transitionOrderOptionStatus(
                scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    private long now() {
        return time.currentEpochMillis();
    }
}
