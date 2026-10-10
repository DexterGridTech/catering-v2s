package com.catering.v2s.terminalbinding.application;

import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OwnerInvariantViolationException;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.AuthenticationFacts;
import java.security.MessageDigest;
import java.util.Objects;

/** Implements the shared R-4.7 credential, ended-binding and revocation precedence. */
final class TerminalCredentialDecision {
    private TerminalCredentialDecision() {}

    static Disposition classify(long generation, byte[] digest, String deviceId, AuthenticationFacts facts) {
        return classify(generation, digest, deviceId, true, facts);
    }

    static Disposition classifyBusinessCredential(long generation, byte[] digest, AuthenticationFacts facts) {
        return classify(generation, digest, null, false, facts);
    }

    private static Disposition classify(
            long generation, byte[] digest, String deviceId, boolean compareDeviceId, AuthenticationFacts facts) {
        if (facts == null || facts.terminalStatus() == null || facts.generation() == null) {
            return Disposition.INVALID;
        }

        long currentGeneration = facts.generation();
        if (generation > currentGeneration) return Disposition.INVALID;
        if (generation == currentGeneration) {
            if (!sameDigest(facts.credentialDigest(), digest)) return Disposition.INVALID;
            if ("ENDED".equals(facts.bindingStatus())) return Disposition.CANCELLED;
            if (compareDeviceId && !Objects.equals(deviceId, facts.boundDeviceId())) return Disposition.INVALID;
        }
        if (generation < currentGeneration
                || "ENDED".equals(facts.bindingStatus())
                || "VOIDED".equals(facts.terminalStatus())
                || "VOIDED".equals(facts.storeStatus())) {
            return Disposition.CANCELLED;
        }
        if (!"ACTIVE".equals(facts.bindingStatus())) {
            throw new OwnerInvariantViolationException();
        }
        return Disposition.VALID;
    }

    static boolean sameDigest(byte[] left, byte[] right) {
        return left != null && right != null && MessageDigest.isEqual(left, right);
    }

    enum Disposition {
        VALID,
        CANCELLED,
        INVALID
    }
}
