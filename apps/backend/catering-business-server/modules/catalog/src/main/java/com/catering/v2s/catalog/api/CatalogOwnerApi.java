package com.catering.v2s.catalog.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;

/** Public owner boundary for catalog facts and commands. Coordinators may not issue catalog SQL. */
public interface CatalogOwnerApi {
    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    /** Typed task-read boundaries.  The legacy operation-id entrypoint remains deferred to BP-U06. */
    JsonNode readWorkbenchContext(String dataNodeRef, String brandRef, String requestId);
    JsonNode readNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId);
    JsonNode readDictionary(String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId);
    JsonNode readLocalCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readBrandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readShapeManifest(String requestId);

    /**
     * Mutating owner boundary. The coordinator must carry the live server-minted grant;
     * the catalog owner rechecks it before command receipt replay or mutation.
     */
    JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                   UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    /** Typed command boundary; derives operation, target and grant requirement from the resolver-owned context. */
    JsonNode write(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** The copy grant always binds the target scope, never the brand-copy source. */
    JsonNode copy(String operationId, String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                  UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    /** Typed copy boundary; the source is resolved only from the context's static copy policy. */
    JsonNode copy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Owner judgment used by inventory and production coordinations; it does not write. */
    boolean itemExists(String dataNodeRef, String brandRef, String itemCode);

    /** Owner judgment used before a production-tag terminal transition. */
    boolean productionTagReferenced(String dataNodeRef, String brandRef, String tagRef);

    /** Owner judgment used before an asset lifecycle release; URL/storage ownership stays with asset owner. */
    boolean assetReferenced(String dataNodeRef, String brandRef, String assetRef);

    /** Global catalog reference judgment for a shared immutable assetRef before lifecycle release. */
    boolean assetReferencedAnywhere(String assetRef);

    /**
     * Task-specific read used by the inventory detail surface to reverse-lookup
     * catalog BOM facts that consume one inventory target.  The catalog owner
     * keeps the reference semantics; the coordinator only joins the read.
     */
    JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef);

    /**
     * Set-based task read for the inventory list.  SKU display names remain
     * catalog-owned; the application coordinator may join this projection to
     * inventory rows without issuing one detail query per target.
     */
    JsonNode skuNamesByItemCodes(String dataNodeRef, String brandRef, JsonNode itemCodes);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;

        public Problem(String code, int status, String message) {
            super(message);
            this.code = code;
            this.status = status;
        }

        public String code() { return code; }
        public int status() { return status; }
    }
}
