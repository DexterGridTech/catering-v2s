package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.CatalogCategoryReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryUpdateRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog category update. */
@Component
public class UpdateOperationsCatalogCategoryOperation {
    public static final String OPERATION_ID = "updateOperationsCatalogCategory";
    private final CommandExecutionContextResolver contexts; private final CatalogOwnerApi catalog;
    public UpdateOperationsCatalogCategoryOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) { this.contexts = contexts; this.catalog = catalog; }
    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogCategoryReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(invocation.sessionCredential(), CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_CATALOG_CATEGORY, invocation.request().dataNodeRef().toString(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()), invocation.correlationId(), invocation.requestId());
        var request = invocation.request();
        return CreateOperationsCatalogCategoryOperation.response(context.requestId(), catalog.updateCategory(context, new CatalogOwnerApi.CategoryUpdateCommand(CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.categoryRef(), "categoryRef"), CreateOperationsCatalogCategoryOperation.requiredLong(request.expectedVersion(), "expectedVersion"), request.name()), invocation.idempotencyKey()));
    }
    public record Invocation(CatalogCategoryUpdateRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String categoryRef, String idempotencyKey) { }
}
