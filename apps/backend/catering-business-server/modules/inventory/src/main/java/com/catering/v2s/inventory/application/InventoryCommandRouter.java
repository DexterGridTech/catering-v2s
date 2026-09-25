package com.catering.v2s.inventory.application;

import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Generic inventory write protocol adapter; target mutation and receipt facts remain in InventoryTargetService. */
@Service
public class InventoryCommandRouter {
    private final InventoryTargetService target;

    public InventoryCommandRouter(InventoryTargetService target) {
        this.target = target;
    }

    @Transactional
    public JsonNode write(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            String dataNodeType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        return writeCore(operationId, dataNodeRef, brandRef, request, requestId, idempotencyKey, () -> {
            InventoryTargetService.requireStoreDataNodeType(dataNodeType);
            InventoryTargetService.requireOwnerScopeGrant(
                    workspaceUuid,
                    groupWorkspaceKey,
                    dataNodeType,
                    dataNodeRef,
                    InventoryTargetService.inventoryWriteCapabilityForTarget(dataNodeType),
                    ownerScopeGrant);
        });
    }

    @Transactional
    public JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey) {
        CatalogAuthorizationScope scope = InventoryTargetService.requireTypedContext(context, "inventory", null);
        return writeCore(
                context.operationToken().operationId(),
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey,
                () -> InventoryTargetService.requireStoreDataNodeType(scope.dataNodeType()));
    }

    private JsonNode writeCore(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            Runnable authorization) {
        InventoryTargetService.requireScope(dataNodeRef, brandRef);
        authorization.run();
        String key = InventoryTargetService.requireIdempotencyKey(idempotencyKey);
        target.legacyRecheckWriteFacts(operationId, dataNodeRef, brandRef, request);
        JsonNode receiptRequest = target.legacyReceiptRequest(request, brandRef);
        JsonNode replay = target.legacyReplay(dataNodeRef, key, operationId, receiptRequest);
        if (replay != null) return replay;
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result =
                    switch (operationId) {
                        case "countOperationsInventoryTarget" -> target.legacyAdjust(
                                dataNodeRef, brandRef, requestId, request, "COUNT");
                        case "increaseOperationsInventoryTarget" -> target.legacyAdjust(
                                dataNodeRef, brandRef, requestId, request, "INCREASE");
                        case "adjustOperationsInventoryTarget" -> target.legacyAdjust(
                                dataNodeRef, brandRef, requestId, request, "ADJUST");
                        case "updateOperationsInventoryTargetConfiguration" -> target.legacyUpdateConfiguration(
                                dataNodeRef, brandRef, requestId, request);
                        default -> throw new InventoryOwnerApi.Problem(
                                "VALIDATION_ERROR", 422, "inventory write operation is not registered");
                    };
            target.legacySaveReceipt(dataNodeRef, key, operationId, receiptRequest, result);
            return result;
        }
    }
}
