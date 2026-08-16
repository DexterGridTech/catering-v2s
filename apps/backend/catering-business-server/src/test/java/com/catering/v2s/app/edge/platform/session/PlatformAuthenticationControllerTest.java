package com.catering.v2s.app.edge.platform.session;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.session.EdgeSessionCookieWriter;
import org.junit.jupiter.api.Test;

class PlatformAuthenticationControllerTest {
    @Test
    void recoveryFlowCookieIsShortHttpOnlySecure() {
        String issued =
                new EdgeSessionCookieWriter().issueSecureFlow("V2S_PLATFORM_PASSWORD_RECOVERY", "opaque", 30 * 60);
        assertTrue(issued.contains("HttpOnly"));
        assertTrue(issued.contains("Secure"));
        assertTrue(issued.contains("SameSite=Strict"));
        assertTrue(issued.contains("Max-Age=1800"));
    }
}
