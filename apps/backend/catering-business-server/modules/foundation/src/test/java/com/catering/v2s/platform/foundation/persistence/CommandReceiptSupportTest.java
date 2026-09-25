package com.catering.v2s.platform.foundation.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CommandReceiptSupportTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void hashesAndSerializesAtTheSharedBoundary() {
        String hash = CommandReceiptSupport.requestHash("{\"a\":1}");
        assertEquals("015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862", hash);
        assertEquals(
                "{\"value\":\"ok\"}", CommandReceiptSupport.serialize(mapper, new Value("ok"), "serialize failed"));
        assertEquals(
                "ok",
                CommandReceiptSupport.deserialize(mapper, "{\"value\":\"ok\"}", Value.class, "deserialize failed")
                        .value());
    }

    @Test
    void rejectsMissingCanonicalRequestAndReportsMalformedJson() {
        assertThrows(NullPointerException.class, () -> CommandReceiptSupport.requestHash(null));
        assertThrows(
                IllegalStateException.class,
                () -> CommandReceiptSupport.deserialize(mapper, "not-json", Value.class, "receipt unreadable"));
    }

    @Test
    void distinguishesClaimFromExistingAndPreservesNullReplayAsClaimOnly() {
        assertEquals(CommandReceiptSupport.ClaimOutcome.CLAIMED, CommandReceiptSupport.claimOutcome(1));
        assertEquals(CommandReceiptSupport.ClaimOutcome.EXISTING, CommandReceiptSupport.claimOutcome(0));
        assertThrows(IllegalStateException.class, () -> CommandReceiptSupport.claimOutcome(2));
        assertNull(CommandReceiptSupport.deserializeNullable(mapper, null, Value.class, "receipt unreadable"));
        assertNull(CommandReceiptSupport.serializeNullable(mapper, null, "receipt unwritable"));
    }

    private record Value(String value) {}
}
