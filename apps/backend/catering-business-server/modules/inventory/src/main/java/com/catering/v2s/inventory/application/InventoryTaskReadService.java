package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Closed inventory task-read boundary; read paths never select an operation id. */
public final class InventoryTaskReadService {
    private final InventoryOwnerApi owner;

    public InventoryTaskReadService(InventoryOwnerApi owner) { this.owner = owner; }

    public JsonNode targets(String dataNodeRef, String brandRef, ObjectNode request, String requestId, String dataNodeType) {
        return primary(() -> owner.readTargets(dataNodeRef, brandRef, request, requestId, dataNodeType));
    }

    public JsonNode target(String dataNodeRef, String brandRef, String targetRef, String requestId, String dataNodeType) {
        return primary(() -> owner.readTarget(dataNodeRef, brandRef, targetRef, requestId, dataNodeType));
    }

    public JsonNode changeSummary(String dataNodeRef, String brandRef, String targetRef, String period, String dataNodeType) {
        return primary(() -> owner.readTargetChangeSummary(dataNodeRef, brandRef, targetRef, period, dataNodeType));
    }

    public JsonNode businessHistory(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId, String dataNodeType) {
        return primary(() -> owner.readTargetBusinessHistory(dataNodeRef, brandRef, targetRef, request, requestId, dataNodeType));
    }

    public JsonNode consumptionReferences(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId) {
        return primary(() -> owner.readTargetConsumptionReferences(dataNodeRef, brandRef, targetRef, request, requestId));
    }

    public JsonNode ledger(String dataNodeRef, String brandRef, String targetRef, ObjectNode request, String requestId, String dataNodeType) {
        return primary(() -> owner.readTargetLedger(dataNodeRef, brandRef, targetRef, request, requestId, dataNodeType));
    }

    public JsonNode diagnostics(String targetRef, String requestId) {
        return primary(() -> owner.readTargetDiagnostics(targetRef, requestId));
    }

    private static JsonNode primary(java.util.function.Supplier<JsonNode> read) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, read);
    }
}
