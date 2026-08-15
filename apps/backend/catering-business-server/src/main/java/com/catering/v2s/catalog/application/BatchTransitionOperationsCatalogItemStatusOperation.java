package com.catering.v2s.catalog.application;

import com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Collection-level catalog lifecycle command; each item is committed independently by the owner. */
@Component
public final class BatchTransitionOperationsCatalogItemStatusOperation {
    public static final String OPERATION_ID = "batchTransitionOperationsCatalogItemStatus";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public BatchTransitionOperationsCatalogItemStatusOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    public CatalogItemBatchStatusTransitionReadback execute(Invocation invocation) {
        CatalogItemBatchStatusTransitionRequest request = invocation.request();
        if (request == null || request.dataNodeRef() == null) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 400, "dataNodeRef is required");
        }
        var context = contexts.resolveCatalog(
            invocation.sessionCredential(),
            CatalogInventoryWorkspaceCommandTokens.BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS,
            request.dataNodeRef().toString(),
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
            invocation.correlationId(),
            invocation.requestId());

        List<CatalogOwnerApi.CatalogItemBatchStatusTransitionItem> items = null;
        if (request.items() != null) {
            items = new ArrayList<>();
            for (CatalogItemBatchStatusTransitionRequest.ItemsItem item : request.items()) {
                if (item == null) {
                    items.add(null);
                } else {
                    items.add(new CatalogOwnerApi.CatalogItemBatchStatusTransitionItem(
                        item.itemRef(), requiredLong(item.expectedVersion(), "expectedVersion")));
                }
            }
        }
        CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback readback = catalog.transitionCatalogItemStatuses(
            context,
            new CatalogOwnerApi.CatalogItemBatchStatusTransitionCommand(request.targetStatus(), items),
            invocation.idempotencyKey());
        List<CatalogItemBatchStatusTransitionReadback.ResultsItem> results = readback.results().stream()
            .map(item -> new CatalogItemBatchStatusTransitionReadback.ResultsItem(
                item.itemRef(), item.ok(), item.failureCode(), item.version()))
            .toList();
        return new CatalogItemBatchStatusTransitionReadback(readback.revision(), readback.requestId(), results);
    }

    public record Invocation(CatalogItemBatchStatusTransitionRequest request,
                              String sessionCredential,
                              String requestedBrandRef,
                              String correlationId,
                              String requestId,
                              String idempotencyKey) { }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 400, field + " is required");
        return value;
    }
}
