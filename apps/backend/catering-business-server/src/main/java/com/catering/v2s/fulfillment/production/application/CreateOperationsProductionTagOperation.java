package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.app.edge.generated.wire.ProductionTagCreateRequest;
import com.catering.v2s.app.edge.generated.wire.ProductionTagReadback;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a production tag creation. */
@Component
public class CreateOperationsProductionTagOperation {
    public static final String OPERATION_ID = "createOperationsProductionTag";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";

    private final CommandExecutionContextResolver contexts;
    private final ProductionTagOwnerApi productionTags;

    public CreateOperationsProductionTagOperation(CommandExecutionContextResolver contexts, ProductionTagOwnerApi productionTags) {
        this.contexts = contexts;
        this.productionTags = productionTags;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public ProductionTagReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
            invocation.sessionCredential(),
            CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_PRODUCTION_TAG,
            invocation.request().dataNodeRef().toString(),
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
            invocation.correlationId(),
            invocation.requestId()
        );
        ProductionTagCreateRequest request = invocation.request();
        ProductionTagOwnerApi.ProductionTagCommandReadback readback = productionTags.createTag(
            context, new ProductionTagOwnerApi.CreateTagCommand(request.code(), request.tagKind(), request.name()), invocation.idempotencyKey());
        return response(context.requestId(), readback);
    }

    public record Invocation(ProductionTagCreateRequest request, String sessionCredential, String requestedBrandRef,
                             String correlationId, String requestId, String idempotencyKey) { }

    private static ProductionTagReadback response(String requestId, ProductionTagOwnerApi.ProductionTagCommandReadback value) {
        return new ProductionTagReadback(REVISION, requestId, new ProductionTagReadback.Result(value.tagRef(), value.code(), value.tagKind(), value.name(),
            new ProductionTagReadback.Result.OwnerScope("PRODUCTION_TAG", REVISION), value.status(), value.version()), value.version());
    }
}
