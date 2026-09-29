package com.catering.v2s.terminalbinding.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationCandidate;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationResult;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OperationsCancelCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OperationsCancelOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.TerminalVoidCommand;
import com.catering.v2s.terminalbinding.domain.TerminalBindingAuditReason;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.ActivationFacts;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.ActivationWrite;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.LockedBinding;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns binding state transitions and their transaction-bound audit, receipt and revocation notification. */
@Service
public class TerminalBindingOwnerService implements TerminalBindingOwnerApi {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final TerminalBindingOwnerPersistence persistence;
    private final AuditEventWriter auditEvents;

    public TerminalBindingOwnerService(
            TerminalBindingOwnerPersistence persistence,
            @Qualifier("terminalBindingAuditEventWriter") AuditEventWriter auditEvents) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.auditEvents = Objects.requireNonNull(auditEvents, "auditEvents");
    }

    @Override
    @Transactional
    public ActivationResult activateOrReplay(ActivationCommand command) {
        Objects.requireNonNull(command, "command");
        ActivationCandidate candidate = command.candidate();
        LockedBinding current = candidate.activationCodeFound()
                ? persistence.lockLatest(
                        candidate.workspaceUuid(), candidate.groupWorkspaceKey(), candidate.terminalRef())
                : null;

        if (isCurrentRetry(current, command)) return activated(candidate, current);

        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            ActivationFacts facts = persistence.readActivationFacts(candidate);
            if (facts == null) return ActivationResult.rejected(ActivationOutcome.RESOURCE_NOT_FOUND);
            if (!"ENABLED".equals(facts.groupStatus())) {
                return ActivationResult.rejected(ActivationOutcome.GROUP_WORKSPACE_DISABLED);
            }
            if (!candidate.activationCodeFound()) {
                return ActivationResult.rejected(ActivationOutcome.RESOURCE_NOT_FOUND);
            }
            requireCandidateFacts(candidate, facts);

            ActivationOutcome rejection =
                    activationRejection(candidate, command.deviceId(), facts, current, command.secretDigest());
            if (rejection != null) return ActivationResult.rejected(rejection);

            TerminalBindingAuditReason reason = current != null && "ACTIVE".equals(current.status())
                    ? TerminalBindingAuditReason.REACTIVATED
                    : TerminalBindingAuditReason.ACTIVATED;
            ActivationWrite write;
            try {
                write = current == null
                        ? persistence.insertFirstActive(
                                candidate.workspaceUuid(),
                                candidate.groupWorkspaceKey(),
                                candidate.storeRef(),
                                candidate.terminalRef(),
                                command.secretDigest(),
                                command.deviceId())
                        : persistence.reactivate(
                                candidate.workspaceUuid(),
                                candidate.groupWorkspaceKey(),
                                candidate.terminalRef(),
                                command.secretDigest(),
                                command.deviceId());
            } catch (DuplicateKeyException digestCollision) {
                throw new OwnerInvariantViolationException(digestCollision);
            }

            writeAudit(
                    candidate.workspaceUuid(),
                    candidate.groupWorkspaceKey(),
                    candidate.terminalRef(),
                    command.actor(),
                    write.activatedAtEpochMillis(),
                    current == null ? null : current.status(),
                    "ACTIVE",
                    current == null ? null : Long.toString(current.generation()),
                    write.generation(),
                    reason);
            if (current != null && "ACTIVE".equals(current.status())) {
                persistence.notifyRevoked(candidate.terminalRef(), current.generation());
            }
            return activated(candidate, write);
        }
    }

    @Override
    @Transactional
    public DeviceCancelOutcome cancelByDevice(DeviceCancelCommand command) {
        Objects.requireNonNull(command, "command");
        var initial = persistence.readAuthenticationFacts(command.groupWorkspaceKey(), command.terminalRef());
        if (initial == null || initial.workspaceUuid() == null) return DeviceCancelOutcome.CREDENTIAL_INVALID;

        LockedBinding locked =
                persistence.lockLatest(initial.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef());
        var facts = persistence.readAuthenticationFacts(command.groupWorkspaceKey(), command.terminalRef());
        if (facts == null || facts.generation() == null || locked == null) {
            return DeviceCancelOutcome.CREDENTIAL_INVALID;
        }
        requireLockedAuthenticationFacts(locked, facts);

        TerminalCredentialDecision.Disposition disposition = TerminalCredentialDecision.classify(
                command.credentialGeneration(), command.secretDigest(), command.deviceId(), facts);
        if (disposition == TerminalCredentialDecision.Disposition.INVALID) {
            return DeviceCancelOutcome.CREDENTIAL_INVALID;
        }
        if (disposition == TerminalCredentialDecision.Disposition.CANCELLED) {
            return DeviceCancelOutcome.ALREADY_CANCELLED;
        }

        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            long endedAt = endBinding(
                    facts.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.terminalRef(),
                    TerminalBindingAuditReason.DEVICE_CANCELLED);
            writeAudit(
                    facts.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.terminalRef(),
                    AuditActor.terminalDevice(),
                    endedAt,
                    "ACTIVE",
                    "INACTIVE",
                    Long.toString(locked.generation()),
                    locked.generation(),
                    TerminalBindingAuditReason.DEVICE_CANCELLED);
            persistence.notifyRevoked(command.terminalRef(), locked.generation());
            return DeviceCancelOutcome.CANCELLED;
        }
    }

    @Override
    @Transactional
    public OperationsCancelOutcome cancelByOperations(OperationsCancelCommand command) {
        Objects.requireNonNull(command, "command");
        requireOperationsCancelAuthorization(command);
        UUID workspaceUuid = command.target().workspaceUuid();
        String groupWorkspaceKey = command.target().groupWorkspaceKey();
        UUID terminalRef = command.target().terminalRef();
        persistence.lockOperationsReceipt(workspaceUuid, groupWorkspaceKey, command.idempotencyKey());
        String requestHash = operationsCancelRequestHash(command);
        var prior = persistence.findReceipt(workspaceUuid, groupWorkspaceKey, command.idempotencyKey());
        if (prior != null) {
            if (!prior.requestHash().equals(requestHash)) throw new IdempotencyConflictException();
            try {
                OperationsCancelOutcome replay = CommandReceiptSupport.deserialize(
                        JSON,
                        prior.responseJson(),
                        OperationsCancelOutcome.class,
                        "terminal binding receipt is unreadable");
                if (replay != OperationsCancelOutcome.CANCELLED) throw new OwnerInvariantViolationException();
                return replay;
            } catch (RuntimeException corruptReceipt) {
                throw new OwnerInvariantViolationException(corruptReceipt);
            }
        }

        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            LockedBinding current = persistence.lockLatest(workspaceUuid, groupWorkspaceKey, terminalRef);
            OperationsCancelOutcome rejection = operationsCancelRejection(current, command.expectedGeneration());
            if (rejection != null) return rejection;

            long endedAt = endBinding(
                    workspaceUuid, groupWorkspaceKey, terminalRef, TerminalBindingAuditReason.OPERATIONS_CANCELLED);
            writeAudit(
                    workspaceUuid,
                    groupWorkspaceKey,
                    terminalRef,
                    command.actor(),
                    endedAt,
                    "ACTIVE",
                    "INACTIVE",
                    Long.toString(current.generation()),
                    current.generation(),
                    TerminalBindingAuditReason.OPERATIONS_CANCELLED);
            persistence.notifyRevoked(terminalRef, current.generation());
            persistence.saveReceipt(
                    workspaceUuid,
                    groupWorkspaceKey,
                    command.idempotencyKey(),
                    requestHash,
                    CommandReceiptSupport.serialize(
                            JSON, OperationsCancelOutcome.CANCELLED, "terminal binding receipt is not writable"));
            return OperationsCancelOutcome.CANCELLED;
        }
    }

    @Override
    @Transactional
    public void endForTerminalVoid(TerminalVoidCommand command) {
        Objects.requireNonNull(command, "command");
        String terminalStatus = persistence.readTerminalStatus(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef());
        if (!"VOIDED".equals(terminalStatus)) {
            throw new OwnerInvariantViolationException();
        }

        LockedBinding binding =
                persistence.lockLatest(command.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef());
        if (binding == null || !"ACTIVE".equals(binding.status())) return;

        long endedAt = endBinding(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.terminalRef(),
                TerminalBindingAuditReason.TERMINAL_VOIDED);
        writeAudit(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.terminalRef(),
                command.actor(),
                endedAt,
                "ACTIVE",
                "INACTIVE",
                Long.toString(binding.generation()),
                binding.generation(),
                TerminalBindingAuditReason.TERMINAL_VOIDED);
        persistence.notifyRevoked(command.terminalRef(), binding.generation());
    }

    private long endBinding(UUID workspaceUuid, String groupKey, UUID terminalRef, TerminalBindingAuditReason reason) {
        Long endedAt = persistence.endActive(workspaceUuid, groupKey, terminalRef, reason.name());
        if (endedAt == null) throw new OwnerInvariantViolationException();
        return endedAt;
    }

    private void writeAudit(
            UUID workspaceUuid,
            String groupKey,
            UUID terminalRef,
            AuditActor actor,
            long occurredAt,
            String beforeStatus,
            String afterStatus,
            String beforeGeneration,
            Long afterGeneration,
            TerminalBindingAuditReason reason) {
        auditEvents.write(new AuditEvent(
                UUID.randomUUID(),
                workspaceUuid,
                groupKey,
                new AuditTarget(AuditEntityTypes.TERMINAL_BINDING, terminalRef.toString()),
                actor,
                "TERMINAL_BINDING_CHANGED",
                occurredAt,
                List.of(
                        AuditChange.forNullableScalar("bindingStatus", beforeStatus, afterStatus),
                        AuditChange.forNullableScalar(
                                "generation",
                                beforeGeneration,
                                afterGeneration == null ? null : Long.toString(afterGeneration)),
                        AuditChange.forNullableScalar("reason", null, reason.name()))));
    }

    private static ActivationOutcome activationRejection(
            ActivationCandidate candidate,
            String deviceId,
            ActivationFacts facts,
            LockedBinding binding,
            byte[] secretDigest) {
        if ("VOIDED".equals(facts.storeStatus())) return ActivationOutcome.STORE_VOIDED;
        boolean sameActiveDevice =
                binding != null && "ACTIVE".equals(binding.status()) && deviceId.equals(binding.boundDeviceId());
        if (!"ENABLED".equals(facts.storeStatus()) && !sameActiveDevice) {
            return ActivationOutcome.STORE_DISABLED;
        }
        if ("VOIDED".equals(facts.terminalStatus())) return ActivationOutcome.TERMINAL_VOIDED;
        if (!"ENABLED".equals(facts.terminalStatus())) return ActivationOutcome.TERMINAL_DISABLED;
        if (!candidate.surfaceForm().equals(facts.deviceType())) return ActivationOutcome.DEVICE_TYPE_MISMATCH;
        if (binding != null && "ACTIVE".equals(binding.status()) && !sameActiveDevice) {
            return ActivationOutcome.ALREADY_BOUND;
        }
        if (binding != null && sameDigest(binding.mostRecentEndedCredentialDigest(), secretDigest)) {
            return ActivationOutcome.ACTIVATION_EXPIRED;
        }
        return null;
    }

    private static OperationsCancelOutcome operationsCancelRejection(LockedBinding binding, long expectedGeneration) {
        if (binding == null || !"ACTIVE".equals(binding.status())) return OperationsCancelOutcome.NOT_ACTIVE;
        if (binding.generation() != expectedGeneration) return OperationsCancelOutcome.BINDING_CHANGED;
        return null;
    }

    private static boolean isCurrentRetry(LockedBinding binding, ActivationCommand command) {
        return binding != null
                && "ACTIVE".equals(binding.status())
                && command.deviceId().equals(binding.boundDeviceId())
                && sameDigest(binding.credentialDigest(), command.secretDigest());
    }

    private static boolean sameDigest(byte[] left, byte[] right) {
        return TerminalCredentialDecision.sameDigest(left, right);
    }

    private static void requireCandidateFacts(ActivationCandidate candidate, ActivationFacts facts) {
        if (!Objects.equals(candidate.storeRef(), facts.storeRef())
                || !Objects.equals(candidate.terminalStatus(), facts.terminalStatus())
                || !Objects.equals(candidate.deviceType(), facts.deviceType())) {
            throw new OwnerInvariantViolationException();
        }
    }

    private static void requireLockedAuthenticationFacts(
            LockedBinding binding, TerminalBindingOwnerPersistence.AuthenticationFacts facts) {
        if (binding.generation() != facts.generation()
                || !Objects.equals(binding.status(), facts.bindingStatus())
                || !sameDigest(binding.credentialDigest(), facts.credentialDigest())
                || !Objects.equals(binding.boundDeviceId(), facts.boundDeviceId())) {
            throw new OwnerInvariantViolationException();
        }
    }

    private static ActivationResult activated(ActivationCandidate candidate, LockedBinding binding) {
        return activated(candidate, new ActivationWrite(binding.generation(), binding.activatedAtEpochMillis()));
    }

    private static ActivationResult activated(ActivationCandidate candidate, ActivationWrite write) {
        return new ActivationResult(
                ActivationOutcome.ACTIVATED,
                candidate.workspaceUuid(),
                candidate.groupWorkspaceKey(),
                candidate.storeRef(),
                candidate.terminalRef(),
                write.generation(),
                write.activatedAtEpochMillis());
    }

    private static String operationsCancelRequestHash(OperationsCancelCommand command) {
        var target = command.target();
        String canonicalRequest = CommandReceiptSupport.serialize(
                JSON,
                new OperationsCancelRequest(
                        "cancelOperationsStoreTerminalActivation",
                        target.workspaceUuid(),
                        target.groupWorkspaceKey(),
                        target.storeRef(),
                        target.terminalRef(),
                        command.expectedGeneration()),
                "terminal binding request is not hashable");
        return CommandReceiptSupport.requestHash(canonicalRequest);
    }

    private static void requireOperationsCancelAuthorization(OperationsCancelCommand command) {
        if (!command.grant().matches(command.target())
                || !command.grant().matchesContextVersion(command.contextVersion())) {
            throw new TerminalOperationsAuthorizationException();
        }
    }

    private record OperationsCancelRequest(
            String operation,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            long expectedGeneration) {}

    public static final class TerminalOperationsAuthorizationException extends RuntimeException {}
}
