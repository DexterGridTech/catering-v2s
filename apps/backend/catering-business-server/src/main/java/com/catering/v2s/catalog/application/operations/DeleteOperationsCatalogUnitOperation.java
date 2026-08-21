package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogUnitDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitDeleteRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Delete is available only after both catalog and inventory lifecycle judgements find no references. */
@Component
public class DeleteOperationsCatalogUnitOperation {
    public static final String OPERATION_ID = "deleteOperationsCatalogUnit";
    private static final String REVISION = CreateOperationsCatalogUnitOperation.REVISION;
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public DeleteOperationsCatalogUnitOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogUnitDeleteReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.unitRef() == null || !request.unitRef().toString().equals(invocation.unitRef()))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "unitRef must match the request path");
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.DELETE_OPERATIONS_CATALOG_UNIT,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        catalog.deleteUnitDefinition(
                context,
                new CatalogOwnerApi.UnitDefinitionDeleteCommand(
                        request.unitRef(),
                        UpdateOperationsCatalogUnitOperation.requiredVersion(request.expectedVersion())),
                invocation.idempotencyKey());
        return new CatalogUnitDeleteReadback(
                REVISION, context.requestId(), new CatalogUnitDeleteReadback.Result(request.unitRef()), null);
    }

    public record Invocation(
            CatalogUnitDeleteRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String unitRef,
            String idempotencyKey) {}
}
