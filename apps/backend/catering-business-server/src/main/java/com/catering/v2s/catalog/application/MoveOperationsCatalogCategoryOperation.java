package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.CatalogCategoryMoveRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog category move. */
@Component
public class MoveOperationsCatalogCategoryOperation {
    public static final String OPERATION_ID = "moveOperationsCatalogCategory";
    private final CommandExecutionContextResolver contexts; private final CatalogOwnerApi catalog;
    public MoveOperationsCatalogCategoryOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) { this.contexts = contexts; this.catalog = catalog; }
    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogCategoryReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(invocation.sessionCredential(), CatalogInventoryWorkspaceCommandTokens.MOVE_OPERATIONS_CATALOG_CATEGORY, invocation.request().dataNodeRef().toString(), CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()), invocation.correlationId(), invocation.requestId());
        var request = invocation.request();
        return CreateOperationsCatalogCategoryOperation.response(context.requestId(), catalog.moveCategory(context, new CatalogOwnerApi.CategoryMoveCommand(CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.categoryRef(), "categoryRef"), CreateOperationsCatalogCategoryOperation.requiredLong(request.expectedVersion(), "expectedVersion"), action(request.action()), request.parentCategoryRef()), invocation.idempotencyKey()));
    }
    public record Invocation(CatalogCategoryMoveRequest request, String sessionCredential, String requestedBrandRef, String correlationId, String requestId, String categoryRef, String idempotencyKey) { }
    private static CatalogOwnerApi.CategoryMoveAction action(String value) { try { return CatalogOwnerApi.CategoryMoveAction.valueOf(value); } catch (RuntimeException invalid) { throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "action is not supported"); } }
}
