package com.catering.v2s.app.application.terminalupdate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleReadback;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

final class TerminalUpdateRuleWireTest {
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();

    @Test
    void ruleDetailIncludesStoresAndKeepsOptionalHotArtifactAsJsonNull() throws Exception {
        var storeRef = UUID.randomUUID();
        var rule = new RuleReadback(UUID.randomUUID(), UUID.randomUUID(), "STORE_REFS", List.of(storeRef),
                UUID.randomUUID(), null, "ENABLED", 300, null, null, "full only", 1, 1, 1);

        var json = JSON.readTree(JSON.writeValueAsString(TerminalUpdateRuleWire.from(rule)));

        assertTrue(json.has("hotArtifactRef"));
        assertTrue(json.path("hotArtifactRef").isNull());
        assertEquals(1, json.path("storeRefs").size());
        assertEquals(storeRef.toString(), json.path("storeRefs").get(0).asText());
    }
}
