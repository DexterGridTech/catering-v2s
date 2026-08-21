package com.catering.v2s.inventory.application.operations;

import com.catering.v2s.app.edge.generated.wire.InventoryCountRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryWriteReadback;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an operations inventory count. */
@Component
public class CountOperationsInventoryTargetOperation {
    public static final String OPERATION_ID = "countOperationsInventoryTarget";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";

    private final CommandExecutionContextResolver contexts;
    private final InventoryOwnerApi inventory;

    public CountOperationsInventoryTargetOperation(
            CommandExecutionContextResolver contexts, InventoryOwnerApi inventory) {
        this.contexts = contexts;
        this.inventory = inventory;
    }

    /**
     * The context resolution is deliberately first: it reads fresh workspace facts inside this command transaction
     * before the inventory owner rechecks its target and receipt.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public InventoryWriteReadback execute(Invocation invocation) {
        InventoryCountRequest request = invocation.request();
        UUID targetRef = InventoryTargetRefConsistency.requireSame(invocation.targetRef(), request.targetRef());
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.COUNT_OPERATIONS_INVENTORY_TARGET,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        InventoryOwnerApi.InventoryMutationReadback readback = inventory.countTarget(
                context,
                new InventoryOwnerApi.CountTargetCommand(
                        targetRef,
                        requiredLong(request.expectedVersion(), "expectedVersion"),
                        requiredDecimal(request.countedQuantity(), "countedQuantity"),
                        request.countingUnitRef(),
                        Boolean.TRUE.equals(request.zeroConfirmation()),
                        request.note()),
                invocation.idempotencyKey());
        return new InventoryWriteReadback(
                REVISION,
                context.requestId(),
                new InventoryWriteReadback.Result(
                        readback.targetRef(),
                        decimal(readback.before()),
                        decimal(readback.change()),
                        decimal(readback.after()),
                        readback.ledgerEntryRef(),
                        readback.stockState(),
                        readback.version()),
                readback.version());
    }

    public record Invocation(
            InventoryCountRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String targetRef,
            String idempotencyKey) {}

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static BigDecimal requiredDecimal(String value, String field) {
        try {
            if (value == null || value.isBlank()) throw new NumberFormatException();
            return new BigDecimal(value);
        } catch (NumberFormatException invalid) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be decimal", invalid);
        }
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }
}
