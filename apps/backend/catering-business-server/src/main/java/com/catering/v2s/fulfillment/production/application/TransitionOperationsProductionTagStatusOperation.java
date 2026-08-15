package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.app.edge.generated.wire.ProductionTagReadback;
import com.catering.v2s.app.edge.generated.wire.ProductionTagTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a production tag status transition. */
@Component
public class TransitionOperationsProductionTagStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsProductionTagStatus";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";

    private final CommandExecutionContextResolver contexts;
    private final ProductionTagOwnerApi productionTags;
    private final CatalogOwnerApi catalog;

    public TransitionOperationsProductionTagStatusOperation(CommandExecutionContextResolver contexts, ProductionTagOwnerApi productionTags, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.productionTags = productionTags;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public ProductionTagReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
            invocation.sessionCredential(),
            CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS,
            invocation.request().dataNodeRef().toString(),
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
            invocation.correlationId(),
            invocation.requestId()
        );
        ProductionTagTransitionRequest request = invocation.request();
        if ("VOIDED".equals(request.targetStatus())) {
            var tagRef = productionTags.resolveProductionTagRef(context, invocation.tagCode());
            if (catalog.productionTagReferenced(context.ownerScope().dataNodeId().toString(), context.ownerScope().brandRef(), tagRef.toString())) {
                throw new ProductionTagOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, "生产标签仍被商品引用，不能作废");
            }
        }
        ProductionTagOwnerApi.ProductionTagCommandReadback readback = productionTags.transitionTagStatus(
            context, new ProductionTagOwnerApi.TransitionTagStatusCommand(invocation.tagCode(), requiredLong(request.expectedVersion(), "expectedVersion"), request.targetStatus()), invocation.idempotencyKey());
        return new ProductionTagReadback(REVISION, context.requestId(), new ProductionTagReadback.Result(readback.tagRef(), readback.code(), readback.tagKind(), readback.name(),
            new ProductionTagReadback.Result.OwnerScope("PRODUCTION_TAG", REVISION), readback.status(), readback.version()), readback.version());
    }

    public record Invocation(ProductionTagTransitionRequest request, String sessionCredential, String requestedBrandRef,
                             String correlationId, String requestId, String tagCode, String idempotencyKey) { }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new ProductionTagOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }
}
