package com.catering.v2s.inventory.application;

import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Generic inventory read protocol adapter; inventory target facts remain in InventoryTargetService. */
@Service
public class InventoryReadRouter {
    private final InventoryTargetService target;

    public InventoryReadRouter(InventoryTargetService target) {
        this.target = target;
    }

    @Transactional
    public JsonNode read(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String dataNodeType) {
        InventoryTargetService.requireStoreDataNodeType(dataNodeType);
        InventoryTargetService.requireScope(dataNodeRef, brandRef);
        return switch (operationId) {
            case "getOperationsInventoryTargets" -> target.readTargets(dataNodeRef, brandRef, request, requestId, dataNodeType);
            case "getOperationsInventoryTarget" -> target.readTarget(
                    dataNodeRef, brandRef, InventoryTargetService.required(request, "targetRef"), requestId, dataNodeType);
            case "getOperationsInventoryTargetChangeSummary" -> target.readTargetChangeSummary(
                    dataNodeRef, brandRef, InventoryTargetService.required(request, "targetRef"),
                    InventoryTargetService.optional(request, "period"), dataNodeType);
            case "getOperationsInventoryTargetBusinessHistory" -> target.readTargetBusinessHistory(
                    dataNodeRef, brandRef, InventoryTargetService.required(request, "targetRef"), request, requestId, dataNodeType);
            case "getOperationsInventoryTargetConsumptionReferences" -> target.readTargetConsumptionReferences(
                    dataNodeRef, brandRef, InventoryTargetService.required(request, "targetRef"), request, requestId);
            case "getOperationsInventoryTargetLedger" -> target.readTargetLedger(
                    dataNodeRef, brandRef, InventoryTargetService.required(request, "targetRef"), request, requestId, dataNodeType);
            case "getOperationsInventoryTargetDiagnostics" -> target.readTargetDiagnostics(
                    InventoryTargetService.required(request, "targetRef"), requestId);
            default -> throw new InventoryOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "inventory read operation is not registered");
        };
    }
}
