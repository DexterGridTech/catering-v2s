package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyReadback;
import com.catering.v2s.app.edge.generated.wire.BrandCopyExecuteRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Named REQUIRED command entry for the three-owner brand-copy execution. */
@Component
public class ExecuteOperationsBrandCatalogCopyOperation {
    public static final String OPERATION_ID = "executeOperationsBrandCatalogCopy";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator composition;

    public ExecuteOperationsBrandCatalogCopyOperation(CommandExecutionContextResolver contexts,
                                                       CatalogInventoryCoordinator composition) {
        this.contexts = contexts;
        this.composition = composition;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BrandCatalogCopyReadback execute(Invocation invocation) {
        var request = invocation.request();
        if (request.expectedSourceVersion() == null || request.expectedTargetVersion() == null) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expected copy versions are required");
        }
        var context = contexts.resolveCatalog(invocation.sessionCredential(),
            CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_BRAND_CATALOG_COPY,
            request.dataNodeRef(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
            invocation.correlationId(), invocation.requestId());
        var readback = composition.executeBrandCopy(context, new CatalogOwnerApi.BrandCopyExecuteCommand(
            request.selectedItemCodes(), request.targetDataNodeRef(), "", request.expectedSourceVersion(), request.expectedTargetVersion(), ""),
            request.preflightDigest(), invocation.idempotencyKey());
        return CopyPreflightWireShape.brandReadback(context.requestId(), readback.catalog(), readback.ownerReadbacks());
    }

    public record Invocation(BrandCopyExecuteRequest request, String sessionCredential, String requestedBrandRef,
                             String correlationId, String requestId, String idempotencyKey) { }
}
