package com.catering.v2s.platform.foundation.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class RequestCompletionEventTest {
    @Test
    void keepsCompletionEnvelopeTypedAndPayloadFree() {
        RequestCompletionEvent event = new RequestCompletionEvent(
                new RequestDiagnosticContext("corr-1", "req-1", "getPlatformAdminPage", "/api/platform/admin-users", "platform-iam"),
                "platform-admin", "FAILED", 21, 409, "PLATFORM_COMMON_VERSION_CONFLICT", 3, 7);

        assertEquals("platform-admin", event.fields().consumerFace());
        assertEquals("PLATFORM_COMMON_VERSION_CONFLICT", event.fields().errorCode());
        assertEquals(3, event.fields().databaseOperationCount());
        assertEquals(7, event.fields().databaseDurationMillis());
    }

    @Test
    void rejectsUnsafeCompletionValues() {
        RequestDiagnosticContext context = new RequestDiagnosticContext(
                "corr-1", "req-1", "getPlatformAdminPage", "/api/platform/admin-users", "platform-iam");

        assertThrows(IllegalArgumentException.class, () -> new RequestCompletionEvent(
                context, "platform admin", "FAILED", 1, 409, "PLATFORM_COMMON_VERSION_CONFLICT", 0, 0));
        assertThrows(IllegalArgumentException.class, () -> new RequestCompletionEvent(
                context, "platform-admin", "FAILED!", 1, 409, "PLATFORM_COMMON_VERSION_CONFLICT", 0, 0));
        assertThrows(IllegalArgumentException.class, () -> new RequestCompletionEvent(
                context, "platform-admin", "FAILED", 1, 99, "PLATFORM_COMMON_VERSION_CONFLICT", 0, 0));
        assertThrows(IllegalArgumentException.class, () -> new RequestCompletionEvent(
                context, "platform-admin", "FAILED", -1, 409, "PLATFORM_COMMON_VERSION_CONFLICT", 0, 0));
    }
}
