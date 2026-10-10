package com.catering.v2s.terminalbinding.api;

import com.catering.v2s.platform.identity.GroupWorkspaceKey;
import com.catering.v2s.terminalbinding.domain.TerminalCredentialDigest;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

/** Narrow current-state credential verification contract consumed by terminal-data-server. */
public interface TerminalCredentialVerificationApi {
    /** TDS authentication, which additionally matches the active binding to the authenticating device. */
    Verification verify(Credential credential);

    /** CBS business authentication, which validates credential and binding state without a physical device id. */
    Verification verifyBusinessCredential(BusinessCredential credential);

    /** Current non-secret binding check for short-lived capability authorization after initial credential verification. */
    boolean isCurrentActiveBinding(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef, long generation);

    /**
     * Rechecks and row-locks the verified active binding in the caller's transaction. The lock remains held until the
     * caller commits its owner write, closing the verification-to-write race for report owners.
     */
    boolean lockCurrentActiveBinding(Verification verification);

    enum Outcome {
        VERIFIED,
        CREDENTIAL_INVALID,
        ACTIVATION_CANCELLED,
        GROUP_WORKSPACE_DISABLED,
        TERMINAL_DISABLED
    }

    record Credential(
            String groupWorkspaceKey, UUID terminalRef, long generation, byte[] secretDigest, String deviceId) {
        public Credential {
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            if (generation < 1) throw new IllegalArgumentException("generation is invalid");
            secretDigest = digest(secretDigest);
            deviceId = required(deviceId, "deviceId", 128);
        }

        @Override
        public byte[] secretDigest() {
            return secretDigest.clone();
        }

        @Override
        public String toString() {
            return "Credential[groupWorkspaceKey=" + groupWorkspaceKey + ", terminalRef=" + terminalRef
                    + ", generation=" + generation + ", secretDigest=redacted, deviceId=redacted]";
        }

        public static Credential fromSecret(
                String groupWorkspaceKey, UUID terminalRef, long generation, byte[] secret, String deviceId) {
            byte[] digest = TerminalCredentialDigest.sha256(secret);
            try {
                return new Credential(groupWorkspaceKey, terminalRef, generation, digest, deviceId);
            } finally {
                Arrays.fill(digest, (byte) 0);
            }
        }
    }

    record BusinessCredential(String groupWorkspaceKey, UUID terminalRef, long generation, byte[] secretDigest) {
        public BusinessCredential {
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            if (generation < 1) throw new IllegalArgumentException("generation is invalid");
            secretDigest = digest(secretDigest);
        }

        @Override
        public byte[] secretDigest() {
            return secretDigest.clone();
        }

        @Override
        public String toString() {
            return "BusinessCredential[groupWorkspaceKey=" + groupWorkspaceKey + ", terminalRef=" + terminalRef
                    + ", generation=" + generation + ", secretDigest=redacted]";
        }
    }

    record Verification(
            Outcome outcome,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            long generation,
            long activatedAtEpochMillis,
            String bindingDeviceId) {
        public Verification {
            outcome = Objects.requireNonNull(outcome, "outcome");
            if (outcome == Outcome.VERIFIED) {
                workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
                groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
                storeRef = Objects.requireNonNull(storeRef, "storeRef");
                terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
                bindingDeviceId = required(bindingDeviceId, "bindingDeviceId", 128);
                if (generation < 1 || activatedAtEpochMillis < 0) {
                    throw new IllegalArgumentException("verified binding is invalid");
                }
            } else if (workspaceUuid != null || groupWorkspaceKey != null || storeRef != null || terminalRef != null
                    || bindingDeviceId != null) {
                throw new IllegalArgumentException("rejected verification must not disclose terminal facts");
            }
        }

        @Override
        public String toString() {
            return "Verification[outcome=" + outcome + ", workspaceUuid=" + workspaceUuid
                    + ", groupWorkspaceKey=" + groupWorkspaceKey + ", storeRef=" + storeRef + ", terminalRef="
                    + terminalRef + ", generation=" + generation + ", activatedAtEpochMillis="
                    + activatedAtEpochMillis + ", bindingDeviceId=redacted]";
        }

        public static Verification rejected(Outcome outcome) {
            if (outcome == Outcome.VERIFIED) throw new IllegalArgumentException("verified is not a rejection");
            return new Verification(outcome, null, null, null, null, 0, 0, null);
        }
    }

    private static byte[] digest(byte[] value) {
        Objects.requireNonNull(value, "secretDigest");
        if (value.length != 32) throw new IllegalArgumentException("secretDigest is invalid");
        return Arrays.copyOf(value, value.length);
    }

    private static String required(String value, String name, int maxLength) {
        if (value == null || value.isEmpty() || value.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
        return value;
    }

    private static String requiredGroupWorkspaceKey(String value) {
        if (!GroupWorkspaceKey.isValid(value)) {
            throw new IllegalArgumentException("groupWorkspaceKey is invalid");
        }
        return value;
    }
}
