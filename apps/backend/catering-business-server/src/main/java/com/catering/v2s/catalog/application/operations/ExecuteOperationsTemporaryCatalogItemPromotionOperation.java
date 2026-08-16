package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback;
import com.catering.v2s.app.edge.generated.wire.TemporaryPromotionExecuteRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for temporary catalog item promotion execution. */
@Component
public class ExecuteOperationsTemporaryCatalogItemPromotionOperation {
    public static final String OPERATION_ID = "executeOperationsTemporaryCatalogItemPromotion";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public ExecuteOperationsTemporaryCatalogItemPromotionOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogItemCommandReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return CreateOperationsCatalogItemOperation.response(
                context.requestId(),
                catalog.executeTemporaryCatalogItemPromotion(
                        context,
                        new CatalogOwnerApi.TemporaryPromotionExecuteCommand(
                                invocation.itemCode(),
                                request.formalCode(),
                                request.shapeKey(),
                                request.name(),
                                request.shortName(),
                                request.materialRole(),
                                canonicalJson(request.attributes()),
                                requiredLong(request.expectedSourceVersion(), "expectedSourceVersion"),
                                requiredLong(request.expectedVersion(), "expectedVersion"),
                                request.preflightDigest()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            TemporaryPromotionExecuteRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String itemCode,
            String idempotencyKey) {}

    private static String canonicalJson(com.catering.v2s.app.edge.generated.wire.CanonicalJsonDocument value) {
        return value == null ? null : value.canonicalJson();
    }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }
}
