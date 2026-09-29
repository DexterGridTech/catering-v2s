package com.catering.v2s.terminalbinding.api;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class TerminalCredentialParserTest {
    @Test
    void parsesActivationSecretAndSerializedDeviceCredentialThroughTheSameCanonicalRule() throws Exception {
        byte[] secret = new byte[32];
        Arrays.fill(secret, (byte) 7);
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        byte[] expectedDigest = MessageDigest.getInstance("SHA-256").digest(secret);

        byte[] activationDigest = TerminalCredentialParser.parseSecretDigest(encoded);
        try (TerminalCredentialContext context = TerminalCredentialParser.parseCredential("12." + encoded)) {
            assertEquals(12, context.generation());
            assertArrayEquals(expectedDigest, activationDigest);
            assertArrayEquals(expectedDigest, context.secretDigest());
            assertTrue(context.toString().contains("secretDigest=redacted"));
        } finally {
            Arrays.fill(secret, (byte) 0);
            Arrays.fill(expectedDigest, (byte) 0);
            Arrays.fill(activationDigest, (byte) 0);
        }
    }

    @Test
    void rejectsNonCanonicalOrMalformedGenerationAndSecret() {
        String validSecret = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);

        assertInvalidCredential("=", () -> TerminalCredentialParser.parseSecretDigest("="));
        assertInvalidCredential(
                "01." + validSecret, () -> TerminalCredentialParser.parseCredential("01." + validSecret));
        assertInvalidCredential(
                "9223372036854775808." + validSecret,
                () -> TerminalCredentialParser.parseCredential("9223372036854775808." + validSecret));
        assertInvalidCredential(
                "1." + validSecret + "=", () -> TerminalCredentialParser.parseCredential("1." + validSecret + "="));
        String nonCanonicalSecret = validSecret.substring(0, validSecret.length() - 1) + "B";
        assertInvalidCredential(
                nonCanonicalSecret, () -> TerminalCredentialParser.parseSecretDigest(nonCanonicalSecret));
    }

    private static void assertInvalidCredential(
            String suppliedValue, org.junit.jupiter.api.function.Executable operation) {
        IllegalArgumentException failure = assertThrows(IllegalArgumentException.class, operation);
        assertEquals("terminal credential is invalid", failure.getMessage());
        assertFalse(failure.getMessage().contains(suppliedValue));
        assertNull(failure.getCause());
    }
}
