package com.catering.v2s.inventory.application;

import com.catering.v2s.app.edge.generated.wire.InventoryIncreaseRequest;
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

/** One-operation M1 composition entry for a positive inventory increase. */
@Component
public class IncreaseOperationsInventoryTargetOperation {
    public static final String OPERATION_ID = "increaseOperationsInventoryTarget";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";

    private final CommandExecutionContextResolver contexts;
    private final InventoryOwnerApi inventory;

    public IncreaseOperationsInventoryTargetOperation(CommandExecutionContextResolver contexts, InventoryOwnerApi inventory) {
        this.contexts = contexts;
        this.inventory = inventory;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public InventoryWriteReadback execute(Invocation invocation) {
        InventoryIncreaseRequest request = invocation.request();
        UUID targetRef = InventoryTargetRefConsistency.requireSame(invocation.targetRef(), request.targetRef());
        var context = contexts.resolveCatalog(
            invocation.sessionCredential(),
            CatalogInventoryWorkspaceCommandTokens.INCREASE_OPERATIONS_INVENTORY_TARGET,
            invocation.request().dataNodeRef().toString(),
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
            invocation.correlationId(),
            invocation.requestId()
        );
        InventoryOwnerApi.InventoryMutationReadback readback = inventory.increaseTarget(
            context,
            new InventoryOwnerApi.IncreaseTargetCommand(
                targetRef,
                requiredLong(request.expectedVersion(), "expectedVersion"),
                requiredDecimal(request.quantity(), "quantity"),
                request.unit(),
                request.note()
            ),
            invocation.idempotencyKey()
        );
        return response(context.requestId(), readback);
    }

    public record Invocation(InventoryIncreaseRequest request, String sessionCredential, String requestedBrandRef,
                             String correlationId, String requestId, String targetRef, String idempotencyKey) { }

    private static InventoryWriteReadback response(String requestId, InventoryOwnerApi.InventoryMutationReadback value) {
        return new InventoryWriteReadback(REVISION, requestId, new InventoryWriteReadback.Result(
            value.targetRef(), decimal(value.before()), decimal(value.change()), decimal(value.after()),
            value.ledgerEntryRef(), value.stockState(), value.version()), value.version());
    }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static BigDecimal requiredDecimal(String value, String field) {
        try {
            if (value == null || value.isBlank()) throw new NumberFormatException();
            return new BigDecimal(value);
        } catch (NumberFormatException invalid) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be decimal");
        }
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }
}
