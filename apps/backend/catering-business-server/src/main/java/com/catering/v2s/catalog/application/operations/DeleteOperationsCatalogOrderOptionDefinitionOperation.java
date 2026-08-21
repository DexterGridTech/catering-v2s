package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionDeleteRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a reusable ordering-option definition delete. */
@Component
public class DeleteOperationsCatalogOrderOptionDefinitionOperation {
    public static final String OPERATION_ID = "deleteOperationsCatalogOrderOptionDefinition";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator coordinator;

    public DeleteOperationsCatalogOrderOptionDefinitionOperation(
            CommandExecutionContextResolver contexts, CatalogInventoryCoordinator coordinator) {
        this.contexts = contexts;
        this.coordinator = coordinator;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogOrderOptionDefinitionDeleteReadback execute(Invocation invocation) {
        if (invocation.request().definitionRef() == null
                || !CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.definitionRef(), "definitionRef")
                        .equals(invocation.request().definitionRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.DELETE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var value = coordinator.deleteOrderOptionDefinition(
                context,
                new CatalogOwnerApi.OrderOptionDefinitionDeleteCommand(
                        CreateOperationsCatalogCategoryOperation.requiredUuid(
                                invocation.definitionRef(), "definitionRef"),
                        CreateOperationsCatalogCategoryOperation.requiredLong(
                                invocation.request().expectedVersion(), "expectedVersion")),
                invocation.idempotencyKey());
        return new CatalogOrderOptionDefinitionDeleteReadback(
                REVISION,
                context.requestId(),
                new CatalogOrderOptionDefinitionDeleteReadback.Result(
                        value.definitionRef(), value.deletedDefinitionValueRefs(), value.deletedItemConfigCount()),
                value.deletedItemConfigCount());
    }

    public record Invocation(
            CatalogOrderOptionDefinitionDeleteRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String definitionRef,
            String idempotencyKey) {}
}
