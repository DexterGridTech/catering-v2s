package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog category deletion. */
@Component
public class DeleteOperationsCatalogCategoryOperation {
    public static final String OPERATION_ID = "deleteOperationsCatalogCategory";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts; private final CatalogOwnerApi catalog;
    public DeleteOperationsCatalogCategoryOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) { this.contexts = contexts; this.catalog = catalog; }
    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogCategoryDeleteReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(invocation.sessionCredential(), CatalogInventoryWorkspaceCommandTokens.DELETE_OPERATIONS_CATALOG_CATEGORY, invocation.request().dataNodeRef(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()), invocation.correlationId(), invocation.requestId());
        var request = invocation.request();
        var value = catalog.deleteCategory(context, new CatalogOwnerApi.CategoryDeleteCommand(CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.categoryRef(), "categoryRef"), CreateOperationsCatalogCategoryOperation.requiredLong(request.expectedVersion(), "expectedVersion")), invocation.idempotencyKey());
        return new CatalogCategoryDeleteReadback(REVISION, context.requestId(), new CatalogCategoryDeleteReadback.Result(value.categoryRef().toString(), value.deletedSubtreeSize(), value.deletedCategoryCodes()), null);
    }
    public record Invocation(CatalogCategoryDeleteRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String categoryRef, String idempotencyKey) { }
}
