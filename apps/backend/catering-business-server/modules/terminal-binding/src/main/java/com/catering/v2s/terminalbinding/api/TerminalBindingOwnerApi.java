package com.catering.v2s.terminalbinding.api;

import com.catering.v2s.audit.contract.AuditActor;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

/** Public command boundary for terminal-binding-owned state transitions. */
public interface TerminalBindingOwnerApi {
    ActivationResult activateOrReplay(ActivationCommand command);

    DeviceCancelOutcome cancelByDevice(DeviceCancelCommand command);

    OperationsCancelOutcome cancelByOperations(OperationsCancelCommand command);

    void endForTerminalVoid(TerminalVoidCommand command);

    enum ActivationOutcome {
        ACTIVATED,
        GROUP_WORKSPACE_DISABLED,
        RESOURCE_NOT_FOUND,
        STORE_VOIDED,
        STORE_DISABLED,
        TERMINAL_VOIDED,
        TERMINAL_DISABLED,
        DEVICE_TYPE_MISMATCH,
        ALREADY_BOUND,
        ACTIVATION_EXPIRED
    }

    record ActivationResult(
            ActivationOutcome outcome,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            long bindingGeneration,
            long activatedAtEpochMillis) {
        public ActivationResult {
            outcome = Objects.requireNonNull(outcome, "outcome");
            if (outcome == ActivationOutcome.ACTIVATED) {
                workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
                groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
                storeRef = Objects.requireNonNull(storeRef, "storeRef");
                terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
                if (bindingGeneration < 1 || activatedAtEpochMillis < 0) {
                    throw new IllegalArgumentException("successful activation result is invalid");
                }
            } else if (workspaceUuid != null || groupWorkspaceKey != null || storeRef != null || terminalRef != null) {
                throw new IllegalArgumentException("rejected activation must not carry terminal identity");
            }
        }

        public static ActivationResult rejected(ActivationOutcome outcome) {
            if (outcome == ActivationOutcome.ACTIVATED) {
                throw new IllegalArgumentException("success is not a rejection");
            }
            return new ActivationResult(outcome, null, null, null, null, 0, 0);
        }
    }

    /** Terminal-binding-owned copy of the locked candidate facts; it contains no activation code or binding secret. */
    record ActivationCandidate(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            boolean activationCodeFound,
            UUID storeRef,
            UUID terminalRef,
            String terminalStatus,
            String deviceType,
            String surfaceForm) {
        public ActivationCandidate {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            if (!"laptop".equals(surfaceForm) && !"mobile".equals(surfaceForm)) {
                throw new IllegalArgumentException("surfaceForm is invalid");
            }
            if (activationCodeFound
                    && (storeRef == null || terminalRef == null || terminalStatus == null || deviceType == null)) {
                throw new IllegalArgumentException("found activation candidate requires terminal facts");
            }
            if (!activationCodeFound
                    && (storeRef != null || terminalRef != null || terminalStatus != null || deviceType != null)) {
                throw new IllegalArgumentException("missing activation candidate must not carry terminal facts");
            }
        }
    }

    record ActivationCommand(ActivationCandidate candidate, String deviceId, byte[] secretDigest, AuditActor actor) {
        public ActivationCommand {
            candidate = Objects.requireNonNull(candidate, "candidate");
            deviceId = required(deviceId, "deviceId", 128);
            secretDigest = digest(secretDigest);
            actor = Objects.requireNonNull(actor, "actor");
        }

        @Override
        public byte[] secretDigest() {
            return secretDigest.clone();
        }

        @Override
        public String toString() {
            return "ActivationCommand[groupWorkspaceKey=" + candidate.groupWorkspaceKey() + ", terminalRef="
                    + candidate.terminalRef() + ", secretDigest=redacted]";
        }
    }

    record DeviceCancelCommand(
            String groupWorkspaceKey,
            UUID terminalRef,
            long credentialGeneration,
            byte[] secretDigest,
            String deviceId) {
        public DeviceCancelCommand {
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            if (credentialGeneration < 1) throw new IllegalArgumentException("credentialGeneration is invalid");
            secretDigest = digest(secretDigest);
            deviceId = required(deviceId, "deviceId", 128);
        }

        @Override
        public byte[] secretDigest() {
            return secretDigest.clone();
        }

        @Override
        public String toString() {
            return "DeviceCancelCommand[groupWorkspaceKey=" + groupWorkspaceKey + ", terminalRef=" + terminalRef
                    + ", credentialGeneration=" + credentialGeneration + ", secretDigest=redacted, deviceId=redacted]";
        }
    }

    enum DeviceCancelOutcome {
        CANCELLED,
        ALREADY_CANCELLED,
        CREDENTIAL_INVALID
    }

    /** Identity-only target facts returned by store-terminal and copied into this owner's dependency-free API. */
    record OperationsCancelTarget(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID terminalRef) {
        public OperationsCancelTarget {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            storeRef = Objects.requireNonNull(storeRef, "storeRef");
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
        }
    }

    record OperationsCancelGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String requirementId,
            String capabilityKey,
            String targetType,
            UUID targetId,
            long expectedContextVersion) {
        public OperationsCancelGrant {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            requirementId = required(requirementId, "requirementId", 128);
            capabilityKey = required(capabilityKey, "capabilityKey", 128);
            targetType = required(targetType, "targetType", 64);
            targetId = Objects.requireNonNull(targetId, "targetId");
        }

        public boolean matches(OperationsCancelTarget target) {
            return target != null
                    && workspaceUuid.equals(target.workspaceUuid())
                    && groupWorkspaceKey.equals(target.groupWorkspaceKey())
                    && "REQ_CANCEL_OPERATIONS_STORE_TERMINAL_ACTIVATION".equals(requirementId)
                    && "EDIT_STORE_TERMINAL".equals(capabilityKey)
                    && "STORE".equals(targetType)
                    && targetId.equals(target.storeRef());
        }

        public boolean matchesContextVersion(long contextVersion) {
            return expectedContextVersion >= 0 && expectedContextVersion == contextVersion;
        }
    }

    record OperationsCancelCommand(
            OperationsCancelTarget target,
            OperationsCancelGrant grant,
            long contextVersion,
            long expectedGeneration,
            String idempotencyKey,
            AuditActor actor) {
        public OperationsCancelCommand {
            target = Objects.requireNonNull(target, "target");
            grant = Objects.requireNonNull(grant, "grant");
            if (expectedGeneration < 1) throw new IllegalArgumentException("expectedGeneration is invalid");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
            actor = Objects.requireNonNull(actor, "actor");
        }

        @Override
        public String toString() {
            return "OperationsCancelCommand[groupWorkspaceKey=" + target.groupWorkspaceKey() + ", storeRef="
                    + target.storeRef() + ", terminalRef=" + target.terminalRef() + ", expectedGeneration="
                    + expectedGeneration
                    + ", idempotencyKey=redacted, actor=redacted]";
        }
    }

    enum OperationsCancelOutcome {
        CANCELLED,
        NOT_ACTIVE,
        BINDING_CHANGED
    }

    record TerminalVoidCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef, AuditActor actor) {
        public TerminalVoidCommand {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = requiredGroupWorkspaceKey(groupWorkspaceKey);
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            actor = Objects.requireNonNull(actor, "actor");
        }

        @Override
        public String toString() {
            return "TerminalVoidCommand[groupWorkspaceKey=" + groupWorkspaceKey + ", terminalRef=" + terminalRef
                    + ", actor=redacted]";
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
        if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,63}")) {
            throw new IllegalArgumentException("groupWorkspaceKey is invalid");
        }
        return value;
    }

    final class IdempotencyConflictException extends RuntimeException {}

    final class OwnerInvariantViolationException extends RuntimeException {
        public OwnerInvariantViolationException() {}

        public OwnerInvariantViolationException(Throwable cause) {
            super("terminal binding owner invariant was violated", cause);
        }
    }
}
