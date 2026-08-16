package com.catering.v2s.audit.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
