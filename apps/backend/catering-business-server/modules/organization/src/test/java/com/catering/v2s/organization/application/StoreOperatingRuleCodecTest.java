package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.organization.domain.generated.StoreOperatingRuleCatalog;
import java.io.Serializable;
import java.util.Map;
import org.junit.jupiter.api.Test;

class StoreOperatingRuleCodecTest {
    @Test
    void readAddsDefaultsAndIgnoresUnknownPersistedKeys() {
        Map<String, Serializable> values = StoreOperatingRuleCodec.resolved(
                "{\"tableManagementEnabled\":true,\"unknownFutureRule\":true}");

        assertTrue((Boolean) values.get("tableManagementEnabled"));
        assertFalse(values.containsKey("unknownFutureRule"));
        assertFalse((Boolean) values.get("catalogManagementEnabled"));
        assertEquals(12, values.size());
    }

    @Test
    void readRejectsCorruptKnownValueInsteadOfMakingItEffective() {
        assertThrows(
                IllegalArgumentException.class,
                () -> StoreOperatingRuleCodec.resolved("{\"catalogManagementEnabled\":\"true\"}"));
    }

    @Test
    void commandAllowsRetainedChildValueAndMarksOwnerInvalidShape() {
        Map<String, Serializable> values = StoreOperatingRuleCatalog.defaults();
        values.put("tableManagementEnabled", false);
        values.put("tableWaitCallEnabled", true);
        assertDoesNotThrow(() -> StoreOperatingRuleCodec.commandValues(values, true));

        values.remove("receivableEnabled");
        assertThrows(
                StoreOperatingRuleCodec.InvalidValuesException.class,
                () -> StoreOperatingRuleCodec.commandValues(values, true));
    }
}
