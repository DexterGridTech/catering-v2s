package com.catering.v2s.platform.foundation.json;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Set;
import org.junit.jupiter.api.Test;

class LegacyReceiptJsonTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void legacyMapWithColonIsRecognizedBeforeOneShotConversion() {
        ObjectNode legacy = JSON.createObjectNode();
        legacy.put("extensionValues", encode(encode("floorArea") + ":" + encode("120:5")));

        assertTrue(LegacyReceiptJson.looksLikeLegacy(JSON, legacy.toString()));
        ObjectNode decoded = LegacyReceiptJson.decode(JSON, legacy.toString(), Set.of(), Set.of("extensionValues"));

        assertEquals("120:5", decoded.path("extensionValues").path("floorArea").asText());
    }

    @Test
    void oneShotConversionPreservesListsNullsAndEscapedText() {
        String escaped = "Ops" + '"' + '\\';
        ObjectNode legacy = JSON.createObjectNode();
        legacy.put("phaseNames", encode(encode("Prep") + "," + encode(escaped)));
        legacy.put("notes", "-");
        legacy.put("extensionValues", encode(encode("label") + ":" + encode(escaped)));

        ObjectNode decoded =
                LegacyReceiptJson.decode(JSON, legacy.toString(), Set.of("phaseNames"), Set.of("extensionValues"));

        assertEquals("Prep", decoded.path("phaseNames").get(0).asText());
        assertEquals(escaped, decoded.path("phaseNames").get(1).asText());
        assertTrue(decoded.path("notes").isNull());
        assertEquals(escaped, decoded.path("extensionValues").path("label").asText());
    }

    private static String encode(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
