package com.catering.v2s.app.edge.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class EdgeSessionCookieWriterTest {
    private final EdgeSessionCookieWriter cookies = new EdgeSessionCookieWriter();

    @Test
    void secureFlowCookiesAreBoundedAndClearedWithTheSameSecurityAttributes() {
        assertEquals(
                "V2S_OPERATIONS_RECOVERY_FLOW=opaque; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800",
                cookies.issueSecureFlow("V2S_OPERATIONS_RECOVERY_FLOW", "opaque", 1800));
        assertEquals(
                "V2S_OPERATIONS_RECOVERY_GRANT=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
                cookies.clearSecureFlow("V2S_OPERATIONS_RECOVERY_GRANT"));
    }

    @Test
    void secureFlowCookiesCannotOutliveTheirOwnerFlow() {
        assertThrows(
                IllegalArgumentException.class,
                () -> cookies.issueSecureFlow("V2S_OPERATIONS_RECOVERY_FLOW", "opaque", 30 * 60 + 1));
    }
}
