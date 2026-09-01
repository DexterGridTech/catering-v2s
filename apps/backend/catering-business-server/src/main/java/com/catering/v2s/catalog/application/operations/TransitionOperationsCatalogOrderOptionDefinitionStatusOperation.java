package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionStatusTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an order-option-definition lifecycle transition. */
@Component
public class TransitionOperationsCatalogOrderOptionDefinitionStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsCatalogOrderOptionDefinitionStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsCatalogOrderOptionDefinitionStatusOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogOrderOptionDefinitionReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.definitionRef() == null
                || !request.definitionRef().toString().equals(invocation.definitionRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION_STATUS,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return CreateOperationsCatalogOrderOptionDefinitionOperation.response(
                context.requestId(),
                catalog.transitionOrderOptionDefinitionStatus(
                        context,
                        new CatalogOwnerApi.OrderOptionDefinitionStatusTransitionCommand(
                                request.definitionRef(),
                                CreateOperationsCatalogCategoryOperation.requiredLong(
                                        request.expectedVersion(), "expectedVersion"),
                                request.targetStatus().name()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogOrderOptionDefinitionStatusTransitionRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String definitionRef,
            String idempotencyKey) {}
}
