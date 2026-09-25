package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogInventoryWireEnums;
import com.catering.v2s.app.edge.generated.wire.ProductionTagCreateRequest;
import com.catering.v2s.app.edge.generated.wire.ProductionTagReadback;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
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
    private final CatalogProductionTagOwnerApi productionTags;

    public CreateOperationsProductionTagOperation(
            CommandExecutionContextResolver contexts, CatalogProductionTagOwnerApi productionTags) {
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
                invocation.requestId());
        ProductionTagCreateRequest request = invocation.request();
        CatalogProductionTagOwnerApi.ProductionTagCommandReadback readback = productionTags.createTag(
                context,
                new CatalogProductionTagOwnerApi.CreateTagCommand(request.code(), request.name()),
                invocation.idempotencyKey());
        return response(context.requestId(), readback);
    }

    public record Invocation(
            ProductionTagCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}

    private static ProductionTagReadback response(
            String requestId, CatalogProductionTagOwnerApi.ProductionTagCommandReadback value) {
        return new ProductionTagReadback(
                REVISION,
                requestId,
                new ProductionTagReadback.Result(
                        value.tagRef(),
                        value.code(),
                        value.name(),
                        new ProductionTagReadback.Result.OwnerScope("PRODUCTION_TAG", REVISION),
                        CatalogInventoryWireEnums.DictionaryEntryStatus.valueOf(value.status()),
                        value.version()),
                value.version());
    }
}
