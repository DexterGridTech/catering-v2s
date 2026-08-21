package com.catering.v2s.inventory.application.operations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.app.edge.generated.wire.InventoryAdjustmentRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryCountRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryIncreaseRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryTargetConfigurationRequest;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InventoryTargetReferenceConsistencyOperationTest {
    private static final UUID PATH_TARGET = UUID.randomUUID();
    private static final UUID BODY_TARGET = UUID.randomUUID();

    @Test
    void countRejectsMismatchedPathAndBodyTargetRef() {
        InventoryOwnerApi.Problem problem = assertThrows(
                InventoryOwnerApi.Problem.class, () -> new CountOperationsInventoryTargetOperation(null, null)
                        .execute(new CountOperationsInventoryTargetOperation.Invocation(
                                new InventoryCountRequest(UUID.randomUUID(), BODY_TARGET, 1L, "1", null, null, false),
                                null,
                                null,
                                null,
                                null,
                                PATH_TARGET.toString(),
                                null)));
        assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void increaseRejectsMismatchedPathAndBodyTargetRef() {
        InventoryOwnerApi.Problem problem = assertThrows(
                InventoryOwnerApi.Problem.class, () -> new IncreaseOperationsInventoryTargetOperation(null, null)
                        .execute(new IncreaseOperationsInventoryTargetOperation.Invocation(
                                new InventoryIncreaseRequest(UUID.randomUUID(), BODY_TARGET, 1L, "1", null, null),
                                null,
                                null,
                                null,
                                null,
                                PATH_TARGET.toString(),
                                null)));
        assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void adjustRejectsMismatchedPathAndBodyTargetRef() {
        InventoryOwnerApi.Problem problem = assertThrows(
                InventoryOwnerApi.Problem.class, () -> new AdjustOperationsInventoryTargetOperation(null, null)
                        .execute(new AdjustOperationsInventoryTargetOperation.Invocation(
                                new InventoryAdjustmentRequest(
                                        UUID.randomUUID(), BODY_TARGET, 1L, "INCREASE", "1", null, "CORRECTION", null),
                                null,
                                null,
                                null,
                                null,
                                PATH_TARGET.toString(),
                                null)));
        assertEquals("VALIDATION_ERROR", problem.code());
    }

    @Test
    void configurationRejectsMismatchedPathAndBodyTargetRef() {
        InventoryOwnerApi.Problem problem = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> new UpdateOperationsInventoryTargetConfigurationOperation(null, null)
                        .execute(new UpdateOperationsInventoryTargetConfigurationOperation.Invocation(
                                new InventoryTargetConfigurationRequest(
                                        UUID.randomUUID(),
                                        BODY_TARGET,
                                        1L,
                                        new InventoryTargetConfigurationRequest.Configuration(
                                                false, new BigDecimal("1"), null, new BigDecimal("1"))),
                                null,
                                null,
                                null,
                                null,
                                PATH_TARGET.toString(),
                                null)));
        assertEquals("VALIDATION_ERROR", problem.code());
    }
}
