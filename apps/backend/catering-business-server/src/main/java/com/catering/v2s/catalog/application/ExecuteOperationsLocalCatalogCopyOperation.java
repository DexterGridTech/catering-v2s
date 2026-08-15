package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.LocalCopyExecuteRequest;
import com.catering.v2s.app.edge.generated.wire.LocalCopyReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ExecuteOperationsLocalCatalogCopyOperation {
    public static final String OPERATION_ID = "executeOperationsLocalCatalogCopy";
    private final CommandExecutionContextResolver contexts; private final CatalogInventoryCoordinator composition;
    public ExecuteOperationsLocalCatalogCopyOperation(CommandExecutionContextResolver contexts, CatalogInventoryCoordinator composition) { this.contexts = contexts; this.composition = composition; }
    @Transactional(propagation = Propagation.REQUIRED)
    public LocalCopyReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(invocation.sessionCredential(), CatalogInventoryWorkspaceCommandTokens.EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY, invocation.request().dataNodeRef().toString(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()), invocation.correlationId(), invocation.requestId());
        var request = invocation.request();
        if (request.expectedSourceVersion() == null || request.expectedTargetVersion() == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expected copy versions are required");
        if (request.selectedSections() == null || request.selectedSections().isEmpty()) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "selected copy sections are required");
        var readback = composition.executeLocalCopy(context, new CatalogOwnerApi.LocalCopyExecuteCommand(request.sourceItemCode(), request.targetItemCode(), request.selectedSections(), "", request.expectedSourceVersion(), request.expectedTargetVersion(), ""), request.preflightDigest(), invocation.idempotencyKey());
        return CopyPreflightWireShape.localReadback(context.requestId(), readback.catalog(), readback.ownerReadbacks());
    }
    public record Invocation(LocalCopyExecuteRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) { }
}
