package com.catering.v2s.audit.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class AuditChangeJsonTest {
    @Test
    void writesEscapedScalarChangesAndRoundTrips() {
        String encoded = AuditChangeJson.write(java.util.List.of(
                new AuditChange("name", "before\\\"\n", "after"), new AuditChange("removed", "old", null)));
        assertEquals(
                java.util.List.of(
                        new AuditChange("name", "before\\\"\n", "after"), new AuditChange("removed", "old", null)),
                AuditChangeJson.read(encoded));
    }

    @Test
    void rejectsNullCollectionOrElement() {
        assertThrows(IllegalArgumentException.class, () -> AuditChangeJson.write(null));
        assertThrows(
                IllegalArgumentException.class,
                () -> AuditChangeJson.write(java.util.Arrays.asList((AuditChange) null)));
    }

    @Test
    void preservesFourStatesLabelAndEmptyValue() {
        var changes = java.util.List.of(
                new AuditChange("missing", "缺失", AuditValueState.MISSING, null, AuditValueState.VALUE, "new"),
                new AuditChange("nullValue", "空值", AuditValueState.NULL, null, AuditValueState.CLEARED, null),
                new AuditChange("empty", "空字符串", AuditValueState.VALUE, "before", AuditValueState.VALUE, ""));

        assertEquals(changes, AuditChangeJson.read(AuditChangeJson.write(changes)));
    }

    @Test
    void readsLegacyPayloadWithoutGuessingItsEmptyState() {
        var changes = AuditChangeJson.read("[{\"fieldKey\":\"legacy\",\"before\":null,\"after\":\"value\"}]");

        assertEquals(1, changes.size());
        assertEquals(null, changes.get(0).beforeState());
        assertEquals("value", changes.get(0).afterValue());
    }

    @Test
    void truncatesDisplayValueWithoutThrowingAndMarksIt() {
        String source = "x".repeat(2001);
        AuditChange change = new AuditChange("long", null, source);

        assertEquals(2000, change.afterValue().codePointCount(0, change.afterValue().length()));
        assertTrue(change.afterValue().endsWith("…（已截断）"));
    }

    @Test
    void rejectsValueOnNonValueState() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new AuditChange("invalid", null, AuditValueState.MISSING, "value", AuditValueState.VALUE, "after"));
    }
}
