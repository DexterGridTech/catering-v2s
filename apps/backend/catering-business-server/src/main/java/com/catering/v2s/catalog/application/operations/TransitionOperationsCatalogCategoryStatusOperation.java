package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogCategoryReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryStatusTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a catalog-category lifecycle transition. */
@Component
public class TransitionOperationsCatalogCategoryStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsCatalogCategoryStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsCatalogCategoryStatusOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogCategoryReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.categoryRef() == null || !request.categoryRef().toString().equals(invocation.categoryRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "categoryRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_CATEGORY_STATUS,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return CreateOperationsCatalogCategoryOperation.response(
                context.requestId(),
                catalog.transitionCategoryStatus(
                        context,
                        new CatalogOwnerApi.CategoryStatusTransitionCommand(
                                request.categoryRef(),
                                CreateOperationsCatalogCategoryOperation.requiredLong(
                                        request.expectedVersion(), "expectedVersion"),
                                request.targetStatus()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogCategoryStatusTransitionRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String categoryRef,
            String idempotencyKey) {}
}
