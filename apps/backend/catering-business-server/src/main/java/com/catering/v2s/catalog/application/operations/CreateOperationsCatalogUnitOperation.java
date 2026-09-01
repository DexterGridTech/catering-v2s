package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogInventoryWireEnums;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogUnitReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog's bounded unit-definition library create. */
@Component
public class CreateOperationsCatalogUnitOperation {
    public static final String OPERATION_ID = "createOperationsCatalogUnit";
    static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public CreateOperationsCatalogUnitOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogUnitReadback execute(Invocation invocation) {
        var request = invocation.request();
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_UNIT,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        return response(
                context.requestId(),
                catalog.createUnitDefinition(
                        context,
                        new CatalogOwnerApi.UnitDefinitionCreateCommand(
                                request.code(),
                                request.name(),
                                unitDimension(request.unitDimension()),
                                precision(request.precision())),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogUnitCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}

    static CatalogOwnerApi.UnitDimension unitDimension(String value) {
        try {
            return CatalogOwnerApi.UnitDimension.valueOf(value == null ? "" : value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "unitDimension is not supported", failure);
        }
    }

    static int precision(Long value) {
        if (value == null || value < 0 || value > Integer.MAX_VALUE)
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "precision must be a non-negative integer");
        return value.intValue();
    }

    static CatalogUnitReadback response(String requestId, CatalogOwnerApi.UnitDefinitionReadback value) {
        return new CatalogUnitReadback(
                REVISION,
                requestId,
                new CatalogUnitReadback.Result(new CatalogUnitReadback.Result.Unit(
                        value.unitRef(),
                        value.code(),
                        value.name(),
                        value.unitDimension().name(),
                        (long) value.precision(),
                        CatalogInventoryWireEnums.DictionaryEntryStatus.valueOf(value.status()),
                        value.version())),
                value.version());
    }
}
