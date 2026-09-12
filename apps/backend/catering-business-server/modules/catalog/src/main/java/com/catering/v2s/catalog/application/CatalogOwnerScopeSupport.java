package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;

/**
 * Non-persistent execution-boundary checks shared by Catalog target services.
 *
 * <p>This class deliberately contains no JDBC, transaction, receipt, lock, or owner-fact behavior. It keeps the
 * typed execution-context guard in one place while each aggregate service retains its own business facts.
 */
final class CatalogOwnerScopeSupport {
    private CatalogOwnerScopeSupport() {}

    static void requireScope(String dataNodeRef, String brandRef) {
        if (dataNodeRef == null || dataNodeRef.isBlank() || brandRef == null || brandRef.isBlank())
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    static CatalogAuthorizationScope typedCommandScope(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String operationId) {
        if (context == null
                || context.operationToken() == null
                || operationId == null
                || !operationId.equals(context.operationToken().operationId())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog command token does not match owner command");
        }
        return requireTypedContext(context, "catalog");
    }

    static CatalogAuthorizationScope requireTypedContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, String expectedOwner) {
        if (context == null
                || context.operationToken() == null
                || context.ownerScope() == null
                || context.ownerGrant() == null
                || context.workspaceUuid() == null
                || context.groupWorkspaceKey() == null
                || context.groupWorkspaceKey().isBlank()
                || !"operations-admin".equals(context.consumerFace())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog execution context is required");
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner())
                || scope.dataNodeId() == null
                || scope.brandRef() == null
                || scope.brandRef().isBlank()
                || !token.allowedDataNodeTypes().contains(scope.dataNodeType())
                || capability == null
                || !context.ownerGrant()
                        .verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new CatalogOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "catalog execution context is not authorized");
        }
        return scope;
    }
}
