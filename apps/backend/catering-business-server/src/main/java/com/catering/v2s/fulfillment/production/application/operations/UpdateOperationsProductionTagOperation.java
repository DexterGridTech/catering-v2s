package com.catering.v2s.fulfillment.production.application.operations;

import com.catering.v2s.app.edge.generated.wire.ProductionTagReadback;
import com.catering.v2s.app.edge.generated.wire.ProductionTagUpdateRequest;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a production tag update. */
@Component
public class UpdateOperationsProductionTagOperation {
    public static final String OPERATION_ID = "updateOperationsProductionTag";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";

    private final CommandExecutionContextResolver contexts;
    private final ProductionTagOwnerApi productionTags;

    public UpdateOperationsProductionTagOperation(
            CommandExecutionContextResolver contexts, ProductionTagOwnerApi productionTags) {
        this.contexts = contexts;
        this.productionTags = productionTags;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public ProductionTagReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_PRODUCTION_TAG,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        ProductionTagUpdateRequest request = invocation.request();
        ProductionTagOwnerApi.ProductionTagCommandReadback readback = productionTags.updateTag(
                context,
                new ProductionTagOwnerApi.UpdateTagCommand(
                        invocation.tagCode(),
                        requiredLong(request.expectedVersion(), "expectedVersion"),
                        request.name()),
                invocation.idempotencyKey());
        return new ProductionTagReadback(
                REVISION,
                context.requestId(),
                new ProductionTagReadback.Result(
                        readback.tagRef(),
                        readback.code(),
                        readback.name(),
                        new ProductionTagReadback.Result.OwnerScope("PRODUCTION_TAG", REVISION),
                        readback.status(),
                        readback.version()),
                readback.version());
    }

    public record Invocation(
            ProductionTagUpdateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String tagCode,
            String idempotencyKey) {}

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }
}
