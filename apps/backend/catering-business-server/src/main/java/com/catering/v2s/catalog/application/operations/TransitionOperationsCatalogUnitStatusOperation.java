package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitStatusTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a unit-definition lifecycle transition. */
@Component
public class TransitionOperationsCatalogUnitStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsCatalogUnitStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsCatalogUnitStatusOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogUnitReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.unitRef() == null || !request.unitRef().toString().equals(invocation.unitRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "unitRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_UNIT_STATUS,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return CreateOperationsCatalogUnitOperation.response(
                context.requestId(),
                catalog.transitionUnitStatus(
                        context,
                        new CatalogOwnerApi.UnitDefinitionStatusTransitionCommand(
                                request.unitRef(),
                                CreateOperationsCatalogCategoryOperation.requiredLong(
                                        request.expectedVersion(), "expectedVersion"),
                                request.targetStatus().name()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogUnitStatusTransitionRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String unitRef,
            String idempotencyKey) {}
}
