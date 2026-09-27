package com.catering.v2s.terminalbinding.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OwnerInvariantViolationException;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.AuthenticationFacts;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TerminalCredentialDecisionTest {
    private static final byte[] CURRENT_DIGEST = new byte[32];
    private static final String DEVICE_ID = "device-1";

    @Test
    void currentEndedCredentialChecksSecretButNotDeviceId() {
        AuthenticationFacts ended = facts(7, CURRENT_DIGEST, "ENDED", "VOIDED", "VOIDED", null);

        assertEquals(
                TerminalCredentialDecision.Disposition.INVALID,
                TerminalCredentialDecision.classify(7, differentDigest(), DEVICE_ID, ended));
        assertEquals(
                TerminalCredentialDecision.Disposition.CANCELLED,
                TerminalCredentialDecision.classify(7, CURRENT_DIGEST, "different-device", ended));
    }

    @Test
    void activeCurrentCredentialStillRejectsDeviceMismatch() {
        assertEquals(
                TerminalCredentialDecision.Disposition.INVALID,
                TerminalCredentialDecision.classify(
                        7,
                        CURRENT_DIGEST,
                        "different-device",
                        facts(7, CURRENT_DIGEST, "ACTIVE", "ENABLED", "ENABLED", DEVICE_ID)));
    }

    @Test
    void lowerGenerationIsCancelledAndDoesNotAuthenticateFromTheRecentDigest() {
        AuthenticationFacts active = facts(8, differentDigest(), "ACTIVE", "ENABLED", "ENABLED", "device-2");

        assertEquals(
                TerminalCredentialDecision.Disposition.CANCELLED,
                TerminalCredentialDecision.classify(7, CURRENT_DIGEST, DEVICE_ID, active));
    }

    @Test
    void futureGenerationAndMissingBindingAreInvalid() {
        AuthenticationFacts active = facts(7, CURRENT_DIGEST, "ACTIVE", "ENABLED", "ENABLED", DEVICE_ID);

        assertEquals(
                TerminalCredentialDecision.Disposition.INVALID,
                TerminalCredentialDecision.classify(8, CURRENT_DIGEST, DEVICE_ID, active));
        assertEquals(
                TerminalCredentialDecision.Disposition.INVALID,
                TerminalCredentialDecision.classify(7, CURRENT_DIGEST, DEVICE_ID, null));
    }

    @Test
    void currentGenerationRequiresDigestAndDeviceAndThenAppliesStatusPrecedence() {
        assertEquals(
                TerminalCredentialDecision.Disposition.VALID,
                TerminalCredentialDecision.classify(
                        7,
                        CURRENT_DIGEST,
                        DEVICE_ID,
                        facts(7, CURRENT_DIGEST, "ACTIVE", "DISABLED", "ENABLED", DEVICE_ID)));
        assertEquals(
                TerminalCredentialDecision.Disposition.CANCELLED,
                TerminalCredentialDecision.classify(
                        7, CURRENT_DIGEST, DEVICE_ID, facts(7, CURRENT_DIGEST, "ENDED", "ENABLED", "ENABLED", null)));
    }

    @Test
    void unexpectedCurrentBindingStatusIsAClosedOwnerInvariantFailure() {
        assertThrows(
                OwnerInvariantViolationException.class,
                () -> TerminalCredentialDecision.classify(
                        7,
                        CURRENT_DIGEST,
                        DEVICE_ID,
                        facts(7, CURRENT_DIGEST, "UNKNOWN", "ENABLED", "ENABLED", DEVICE_ID)));
    }

    private static AuthenticationFacts facts(
            long generation,
            byte[] digest,
            String bindingStatus,
            String storeStatus,
            String terminalStatus,
            String deviceId) {
        return new AuthenticationFacts(
                UUID.randomUUID(),
                "ENABLED",
                UUID.randomUUID(),
                storeStatus,
                terminalStatus,
                generation,
                digest,
                bindingStatus,
                deviceId,
                1L);
    }

    private static byte[] differentDigest() {
        byte[] digest = new byte[32];
        digest[0] = 1;
        return digest;
    }
}
