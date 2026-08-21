package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitUpdateRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** A unit update exposes the full shape only for zero-reference units; the owner remains the final guard. */
@Component
public class UpdateOperationsCatalogUnitOperation {
    public static final String OPERATION_ID = "updateOperationsCatalogUnit";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public UpdateOperationsCatalogUnitOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
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
                CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_CATALOG_UNIT,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return CreateOperationsCatalogUnitOperation.response(
                context.requestId(),
                catalog.updateUnitDefinition(
                        context,
                        new CatalogOwnerApi.UnitDefinitionUpdateCommand(
                                request.unitRef(),
                                requiredVersion(request.expectedVersion()),
                                request.code(),
                                request.name(),
                                request.unitDimension() == null
                                        ? null
                                        : CreateOperationsCatalogUnitOperation.unitDimension(request.unitDimension()),
                                request.precision() == null
                                        ? null
                                        : CreateOperationsCatalogUnitOperation.precision(request.precision())),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogUnitUpdateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String unitRef,
            String idempotencyKey) {}

    static long requiredVersion(Long value) {
        return CreateOperationsCatalogCategoryOperation.requiredLong(value, "expectedVersion");
    }
}
