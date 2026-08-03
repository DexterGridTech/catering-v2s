package com.catering.v2s.platform.foundation.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class SecurityDiagnosticEventTest {
    @Test
    void exposesTheClosedSecretSafeEventEnvelopeAsTypedFields() {
        SecurityDiagnosticEvent event = new SecurityDiagnosticEvent(
                new RequestDiagnosticContext("corr-1", "req-1", "PLATFORM_LOGIN", "/api/platform/auth/password-login", "platform-iam"),
                "REQUEST_COMPLETED", "EDGE", "SUCCEEDED", 14, 200, null);

        SecurityDiagnosticEvent.Fields fields = event.fields();

        assertEquals("corr-1", fields.correlationId());
        assertEquals("req-1", fields.requestId());
        assertEquals("PLATFORM_LOGIN", fields.operationId());
        assertEquals("/api/platform/auth/password-login", fields.routeTemplate());
        assertEquals("platform-iam", fields.owner());
        assertEquals("REQUEST_COMPLETED", fields.event());
        assertEquals("EDGE", fields.phase());
        assertEquals("SUCCEEDED", fields.outcome());
        assertEquals(14, fields.durationMillis());
        assertEquals(200, fields.status());
        assertNull(fields.errorCode());
    }
}
