package com.catering.v2s.app.configuration;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.iam.api.PlatformDiagnosticBootstrap;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HttpDiagnosticBootstrapConfigurationTest {
    @Test
    void delegatesOnlyTheOneTimeOwnerBootstrapAndClearsTheCredentialArray() throws Exception {
        CapturingBootstrap bootstrap = new CapturingBootstrap();
        HttpDiagnosticBootstrapConfiguration.ownerBootstrap(bootstrap, "non-production", "rm1-http-diagnostic", "rm1-http-diagnostic-12345678", "diagnostic-admin", "long-private-value").run(null);
        assertEquals("diagnostic-admin", bootstrap.loginName);
        assertEquals("HTTP Diagnostic Administrator", bootstrap.displayName);
        assertArrayEquals(new char[bootstrap.password.length], bootstrap.password);
    }

    @Test
    void refusesAnyNonDiagnosticProfileBeforeCallingTheOwner() {
        CapturingBootstrap bootstrap = new CapturingBootstrap();
        assertThrows(IllegalStateException.class, () -> HttpDiagnosticBootstrapConfiguration.ownerBootstrap(bootstrap, "non-production", "r5-full", "rm1-http-diagnostic-12345678", "diagnostic-admin", "long-private-value"));
        assertEquals(0, bootstrap.calls);
    }

    private static final class CapturingBootstrap implements PlatformDiagnosticBootstrap {
        int calls;
        String loginName;
        String displayName;
        char[] password;
        @Override public DiagnosticAdministrator bootstrapFirstAdministrator(String loginName, String displayName, char[] initialPassword) {
            calls++;
            this.loginName = loginName;
            this.displayName = displayName;
            this.password = initialPassword;
            return new DiagnosticAdministrator(UUID.randomUUID(), loginName);
        }
    }
}
