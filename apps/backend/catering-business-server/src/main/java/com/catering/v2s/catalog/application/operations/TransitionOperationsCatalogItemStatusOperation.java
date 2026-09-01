package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog item lifecycle transition. */
@Component
public class TransitionOperationsCatalogItemStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsCatalogItemStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsCatalogItemStatusOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogItemCommandReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return CreateOperationsCatalogItemOperation.response(
                context.requestId(),
                catalog.transitionCatalogItemStatus(
                        context,
                        new CatalogOwnerApi.CatalogItemStatusTransitionCommand(
                                invocation.itemCode(),
                                requiredLong(request.expectedVersion(), "expectedVersion"),
                                request.targetStatus().name()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogItemTransitionRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String itemCode,
            String testFailurePoint,
            String idempotencyKey) {
        public Invocation(
                CatalogItemTransitionRequest request,
                String sessionCredential,
                String requestedBrandRef,
                String correlationId,
                String requestId,
                String itemCode,
                String idempotencyKey) {
            this(
                    request,
                    sessionCredential,
                    requestedBrandRef,
                    correlationId,
                    requestId,
                    itemCode,
                    null,
                    idempotencyKey);
        }
    }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }
}
