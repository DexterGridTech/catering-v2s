package com.catering.v2s.fulfillment.production.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;

/** Production tag definition owner. Catalog stores only typed references to these facts. */
public interface ProductionTagOwnerApi {
    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readTags(String dataNodeRef, String brandRef, String requestId);
    JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                   UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);
    JsonNode write(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Coordinated copy command; production owns tag definitions. */
    JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                  UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);
    JsonNode copy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Read-only owner judgement used by catalog copy preflight and execute recheck. */
    JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request,
                           UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);
    JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;
        public Problem(String code, int status, String message) { super(message); this.code=code; this.status=status; }
        public String code(){return code;}
        public int status(){return status;}
    }
}
