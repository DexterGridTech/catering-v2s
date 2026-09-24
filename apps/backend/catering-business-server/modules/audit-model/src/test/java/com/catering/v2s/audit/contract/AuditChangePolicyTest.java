package com.catering.v2s.audit.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AuditChangePolicyTest {
    @Test
    void rejectsChangesOutsideTheDeclaredFieldAllowlist() {
        var policy = new AuditChangePolicy("STORE_TERMINAL", "TERMINAL_CREATED", Set.of("name"));
        var allowed = AuditChange.forNullableScalar("name", null, "收银台");
        var forbidden = AuditChange.forNullableScalar("unexpectedField", null, "value");

        assertEquals(List.of(allowed), policy.allow(List.of(allowed)));
        assertThrows(IllegalArgumentException.class, () -> policy.allow(List.of(forbidden)));
    }
}
