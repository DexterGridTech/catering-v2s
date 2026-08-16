package com.catering.v2s.platform.access;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class EdgeContextVerifierTest {
    private static final String SECRET = "test-edge-secret";

    @Test
    void verifiesControlledPlatformAdminContext() {
        String token = EdgeContextVerifier.encodeForControlledProvider(
                "external-subject", Instant.now().plusSeconds(60), "correlation-001", SECRET);

        PlatformExecutionContext context = new EdgeContextVerifier().verify(token, "platform-admin", SECRET);

        assertEquals("external-subject", context.externalSubject());
        assertEquals("platform-admin", context.consumerFace());
        assertEquals("correlation-001", context.correlationId());
    }

    @Test
    void rejectsMissingOrExpiredOrTamperedContext() {
        EdgeContextVerifier verifier = new EdgeContextVerifier();

        assertThrows(
                EdgeContextVerifier.InvalidEdgeContextException.class,
                () -> verifier.verify(null, "platform-admin", SECRET));
        assertThrows(
                EdgeContextVerifier.InvalidEdgeContextException.class,
                () -> verifier.verify(
                        EdgeContextVerifier.encodeForControlledProvider(
                                "external-subject", Instant.now().minusSeconds(1), "correlation-002", SECRET),
                        "platform-admin",
                        SECRET));
        assertThrows(
                EdgeContextVerifier.InvalidEdgeContextException.class,
                () -> verifier.verify(
                        EdgeContextVerifier.encodeForControlledProvider(
                                "external-subject", Instant.now().plusSeconds(60), "correlation-003", SECRET),
                        "platform-admin",
                        "wrong-secret"));
    }
}
