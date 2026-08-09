package com.catering.v2s.inventory.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;

/** Public inventory owner boundary. Inventory facts are stored and changed only in inventory schema. */
public interface InventoryOwnerApi {
    /**
     * Legacy owner boundary retained for source compatibility.  Callers that
     * can reach a runtime edge must use the scope-typed overload below so the
     * inventory owner can reject head-company balance reads.
     */
    default JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return read(operationId, dataNodeRef, brandRef, request, requestId, null);
    }

    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType);

    /** Typed task-read boundaries.  The legacy operation-id entrypoint remains deferred to BP-U06. */
    JsonNode readTargets(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType);
    JsonNode readTarget(String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType);
    JsonNode readTargetChangeSummary(String targetRef, String period);
    JsonNode readTargetBusinessHistory(String targetRef, ObjectNode request, String requestId);
    JsonNode readTargetConsumptionReferences(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId);
    JsonNode readTargetLedger(String targetRef, ObjectNode request, String requestId);
    JsonNode readTargetDiagnostics(String targetRef, String requestId);

    /** Mutating owner boundary; the server-minted grant is rechecked before receipt replay. */
    JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey, String dataNodeType,
                   UUID workspaceUuid, String groupWorkspaceKey, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode write(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Coordinated copy command; inventory owns balance/ledger reset and BOM facts. */
    JsonNode copy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                  UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode copy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Read-only owner judgement used by catalog copy preflight and the execute
     * recheck.  It must include every inventory object/version that can be
     * changed by the approved item closure; it does not write balance or
     * ledger facts.
     */
    JsonNode preflightCopy(String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request,
                           UUID workspaceUuid, String groupWorkspaceKey, String targetDataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request);

    /**
     * Task-read used by the catalog detail surface.  It returns only the
     * definition graph (StockTarget configuration and ProductBom rows); it
     * never exposes balance or ledger facts and therefore is valid for a
     * head-company catalog read as well as a store read.
     */
    default JsonNode readCatalogInventoryDefinition(String dataNodeRef, String brandRef, String itemRef, String requestId) {
        throw new UnsupportedOperationException("inventory definition read is not implemented");
    }

    /**
     * Owner judgement used by catalog lifecycle commands.  The inventory owner
     * decides whether an item still has inventory-owned facts; the catalog
     * coordinator must not infer this from a task-read payload.
     */
    default JsonNode catalogItemVoidDependencies(String dataNodeRef, String brandRef, String itemRef, String requestId) {
        throw new UnsupportedOperationException("inventory void-dependency judgement is not implemented");
    }

    /**
     * Bounded task-read for the catalog workbench.  It returns definition
     * counts for the supplied product codes in one owner query; it never
     * exposes balances or ledgers, so the same read is valid for a store or
     * a head-company catalog.
     */
    default JsonNode readCatalogInventorySummary(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        throw new UnsupportedOperationException("inventory summary read is not implemented");
    }

    /** Controlled creation path from a catalog item's inventory/BOM tab. */
    JsonNode ensureCatalogInventoryTarget(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                                          UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode ensureCatalogInventoryTarget(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Owner command for ProductBom rows; component targets must already exist. */
    JsonNode saveCatalogProductBom(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey,
                                   UUID workspaceUuid, String groupWorkspaceKey, String dataNodeType, OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode saveCatalogProductBom(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;
        public Problem(String code, int status, String message) { super(message); this.code = code; this.status = status; }
        public String code() { return code; }
        public int status() { return status; }
    }
}
