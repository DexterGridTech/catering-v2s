package com.catering.v2s.app.edge.generated.wire;

import static org.assertj.core.api.Assertions.assertThat;

import com.catering.v2s.terminalbinding.api.TerminalCredentialContext;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.junit.jupiter.api.Test;

class TerminalActivationSecretToStringTest {
    @Test
    void activationWireAndDeviceCancellationContextDoNotPrintCredentialSecret() throws Exception {
        String secret = "terminal-credential-secret-marker";
        String activationCode = "12345678";
        TerminalActivationRequest activation =
                new TerminalActivationRequest(activationCode, "device-1", "mobile", "1.0", secret);
        String renderedActivation = activation.toString();
        assertThat(renderedActivation)
                .doesNotContain(secret)
                .doesNotContain(activationCode)
                .doesNotContain("credentialSecret")
                .doesNotContain("activationCode");
        assertThat(renderedActivation.split("redacted=\\[REDACTED]", -1)).hasSize(3);

        byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.US_ASCII));
        try (TerminalCredentialContext cancellationCredential = new TerminalCredentialContext(1, digest)) {
            assertThat(cancellationCredential.toString()).doesNotContain(secret).contains("secretDigest=redacted");
        }
    }
}
