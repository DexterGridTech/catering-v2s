package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of Catalog attribute-definition facts and their status transitions. */
@Service
public class CatalogAttributeDefinitionService {
    private final CatalogDefinitionFacts definitionFacts;
    private final TimeProvider time;

    @Autowired
    public CatalogAttributeDefinitionService(JdbcTemplate jdbc, TimeProvider time) {
        this(new CatalogDefinitionFacts(jdbc), time);
    }

    CatalogAttributeDefinitionService(CatalogDefinitionFacts definitionFacts, TimeProvider time) {
        this.definitionFacts = definitionFacts;
        this.time = time;
    }

    public CatalogOwnerApi.AttributeDefinitionListReadback listAttributeDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        return new CatalogOwnerApi.AttributeDefinitionListReadback(
                definitionFacts.listAttributes(dataNodeRef, brandRef, candidateUsage));
    }

    @Transactional
    public CatalogOwnerApi.AttributeDefinitionReadback createAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "createOperationsCatalogAttributeDefinition");
        return definitionFacts.createAttribute(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Transactional
    public CatalogOwnerApi.AttributeDefinitionReadback updateAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope =
                CatalogOwnerScopeSupport.typedCommandScope(context, "updateOperationsCatalogAttributeDefinition");
        return definitionFacts.updateAttribute(scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    @Transactional
    public CatalogOwnerApi.AttributeDefinitionReadback transitionAttributeDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.AttributeDefinitionStatusTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "transitionOperationsCatalogAttributeDefinitionStatus");
        return definitionFacts.transitionAttributeStatus(
                scope.dataNodeId().toString(), scope.brandRef(), command, now());
    }

    private long now() {
        return time.currentEpochMillis();
    }
}
