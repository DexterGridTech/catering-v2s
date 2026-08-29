package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionStatusTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an attribute-definition lifecycle transition. */
@Component
public class TransitionOperationsCatalogAttributeDefinitionStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsCatalogAttributeDefinitionStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsCatalogAttributeDefinitionStatusOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogAttributeDefinitionReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.definitionRef() == null
                || !request.definitionRef().toString().equals(invocation.definitionRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION_STATUS,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return CreateOperationsCatalogAttributeDefinitionOperation.response(
                context.requestId(),
                catalog.transitionAttributeDefinitionStatus(
                        context,
                        new CatalogOwnerApi.AttributeDefinitionStatusTransitionCommand(
                                request.definitionRef(),
                                CreateOperationsCatalogCategoryOperation.requiredLong(
                                        request.expectedVersion(), "expectedVersion"),
                                request.targetStatus()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogAttributeDefinitionStatusTransitionRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String definitionRef,
            String idempotencyKey) {}
}
