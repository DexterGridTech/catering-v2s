package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionDeleteRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an operations attribute-library definition delete. */
@Component
public class DeleteOperationsCatalogAttributeDefinitionOperation {
    public static final String OPERATION_ID = "deleteOperationsCatalogAttributeDefinition";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public DeleteOperationsCatalogAttributeDefinitionOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogAttributeDefinitionDeleteReadback execute(Invocation invocation) {
        if (invocation.request().definitionRef() == null
                || !CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.definitionRef(), "definitionRef")
                        .equals(invocation.request().definitionRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.DELETE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        var value = catalog.deleteAttributeDefinition(
                context,
                new CatalogOwnerApi.AttributeDefinitionDeleteCommand(
                        CreateOperationsCatalogCategoryOperation.requiredUuid(
                                invocation.definitionRef(), "definitionRef"),
                        CreateOperationsCatalogCategoryOperation.requiredLong(
                                request.expectedVersion(), "expectedVersion")),
                invocation.idempotencyKey());
        return new CatalogAttributeDefinitionDeleteReadback(
                REVISION,
                context.requestId(),
                new CatalogAttributeDefinitionDeleteReadback.Result(
                        value.definitionRef(), value.deletedAssignmentCount()),
                value.deletedAssignmentCount());
    }

    public record Invocation(
            CatalogAttributeDefinitionDeleteRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String definitionRef,
            String idempotencyKey) {}
}
