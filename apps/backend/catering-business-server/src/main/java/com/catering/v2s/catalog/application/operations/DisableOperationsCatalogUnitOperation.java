package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogUnitDisableRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Disabling retains historic snapshots and only blocks future use. */
@Component
public class DisableOperationsCatalogUnitOperation {
    public static final String OPERATION_ID = "disableOperationsCatalogUnit";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public DisableOperationsCatalogUnitOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogUnitReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.unitRef() == null || !request.unitRef().toString().equals(invocation.unitRef()))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "unitRef must match the request path");
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.DISABLE_OPERATIONS_CATALOG_UNIT,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return CreateOperationsCatalogUnitOperation.response(
                context.requestId(),
                catalog.disableUnitDefinition(
                        context,
                        new CatalogOwnerApi.UnitDefinitionDisableCommand(
                                request.unitRef(),
                                UpdateOperationsCatalogUnitOperation.requiredVersion(request.expectedVersion())),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogUnitDisableRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String unitRef,
            String idempotencyKey) {}
}
