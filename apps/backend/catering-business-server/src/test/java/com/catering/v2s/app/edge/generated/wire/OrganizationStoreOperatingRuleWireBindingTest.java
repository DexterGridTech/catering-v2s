package com.catering.v2s.app.edge.generated.wire;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class OrganizationStoreOperatingRuleWireBindingTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void validCompleteObjectRetainsParentFalseChildTrue() throws Exception {
        OrganizationStoreOperatingRuleValues values = JSON.readValue(validJson(false, true), OrganizationStoreOperatingRuleValues.class);

        assertEquals(false, values.tableManagementEnabled());
        assertEquals(true, values.tableWaitCallEnabled());
    }

    @Test
    void closedObjectRejectsUnknownMissingAndCoercedValues() {
        assertThrows(Exception.class, () -> JSON.readValue(validJson(false, true).replace(
                "\"receivableEnabled\": false", "\"unknownRule\": false,\"receivableEnabled\": false"),
                OrganizationStoreOperatingRuleValues.class));
        assertThrows(Exception.class, () -> JSON.readValue(validJson(false, true).replace(
                "\"pickupCallEnabled\": false,\n  \"receivableEnabled\": false",
                "\"pickupCallEnabled\": false"), OrganizationStoreOperatingRuleValues.class));
        assertThrows(Exception.class, () -> JSON.readValue(validJson(false, true).replace(
                "\"catalogManagementEnabled\": false", "\"catalogManagementEnabled\":\"false\""),
                OrganizationStoreOperatingRuleValues.class));
    }

    @Test
    void completeUpdateRequestRequiresRuleObject() throws Exception {
        String withoutRules = """
                {
                  "name": "门店",
                  "extensionValues": {},
                  "extensionRuleRevision": 0,
                  "expectedVersion": 0
                }
                """;

        assertThrows(Exception.class, () -> JSON.readValue(withoutRules, OrganizationStoreUpdateRequest.class));
        assertDoesNotThrow(() -> JSON.readValue(updateJson(), OrganizationStoreUpdateRequest.class));
    }

    private static String updateJson() {
        return """
                {
                  "name": "门店",
                  "extensionValues": {},
                  "extensionRuleRevision": 0,
                  "expectedVersion": 0,
                  "operatingRuleSwitches": %s
                }
                """.formatted(validJson(false, true));
    }

    private static String validJson(boolean catalogEnabled, boolean waitCallEnabled) {
        return """
                {
                  "catalogManagementEnabled": %s,
                  "externalCatalogSyncEnabled": false,
                  "openPlatformDeveloperCode": "",
                  "reservationEnabled": false,
                  "reservationDepositEnabled": false,
                  "queueCallEnabled": false,
                  "tableManagementEnabled": false,
                  "tableStatusEnabled": false,
                  "tableWaitCallEnabled": %s,
                  "banquetOrderEnabled": false,
                  "pickupCallEnabled": false,
                  "receivableEnabled": false
                }
                """.formatted(catalogEnabled, waitCallEnabled);
    }
}
