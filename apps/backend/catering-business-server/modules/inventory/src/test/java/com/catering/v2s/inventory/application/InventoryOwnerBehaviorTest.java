package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

/** Focused business behavior checks for the inventory read model owner. */
class InventoryOwnerBehaviorTest {
    @Test
    void todayAndRollingPeriodDurationsAreExplicit() throws Exception {
        assertEquals(86_400_000L, invokeDuration("TODAY"));
        assertEquals(7 * 86_400_000L, invokeDuration("7D"));
        assertEquals(30 * 86_400_000L, invokeDuration("30D"));
    }

    @Test
    void businessHistoryContainsOnlyCountAndIncreaseOperations() throws Exception {
        assertTrue(invokeBusinessOperation("COUNT"));
        assertTrue(invokeBusinessOperation("INCREASE"));
        assertFalse(invokeBusinessOperation("ADJUST"));
    }

    @Test
    void inventoryBalanceAndActionsRequireStoreScope() throws Exception {
        Method require = InventoryOwnerService.class.getDeclaredMethod("requireStoreDataNodeType", String.class);
        require.setAccessible(true);
        require.invoke(null, "STORE");
        InvocationTargetException failure = assertThrows(InvocationTargetException.class, () -> require.invoke(null, "HEAD_COMPANY"));
        assertTrue(failure.getCause() instanceof InventoryOwnerApi.Problem);
        assertEquals("SCOPE_FORBIDDEN", ((InventoryOwnerApi.Problem) failure.getCause()).code());
    }

    @Test
    void bomLineDirectionNormalizesLegacyAliasesWithoutErasingNegativeSemantics() {
        assertEquals("POSITIVE", InventoryOwnerService.normalizeLineSign("POSITIVE"));
        assertEquals("POSITIVE", InventoryOwnerService.normalizeLineSign("COMPONENT"));
        assertEquals("NEGATIVE", InventoryOwnerService.normalizeLineSign("NEGATIVE"));
        assertEquals("NEGATIVE", InventoryOwnerService.normalizeLineSign("REMOVE"));
    }

    private long invokeDuration(String period) throws Exception {
        Method method = InventoryOwnerService.class.getDeclaredMethod("periodDurationMillis", String.class);
        method.setAccessible(true);
        return (long) method.invoke(null, period);
    }

    private boolean invokeBusinessOperation(String operation) throws Exception {
        Method method = InventoryOwnerService.class.getDeclaredMethod("isBusinessHistoryOperation", String.class);
        method.setAccessible(true);
        return (boolean) method.invoke(null, operation);
    }
}
