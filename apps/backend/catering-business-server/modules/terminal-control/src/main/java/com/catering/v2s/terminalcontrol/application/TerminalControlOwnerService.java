package com.catering.v2s.terminalcontrol.application;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.ClaimedOperation;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationOutcome;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationResult;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationView;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.ReportAcceptance;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.TerminalReport;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence.BindingTarget;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence.OnlineSession;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** CBS owner for online-only remote operations and their durable execution facts. */
@Service
public class TerminalControlOwnerService implements TerminalControlOwnerApi {
    private final TerminalControlPersistence persistence;
    private final ObjectMapper objectMapper;

    public TerminalControlOwnerService(TerminalControlPersistence persistence, ObjectMapper objectMapper) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Override
    @Transactional
    public InvocationResult invokeOnline(InvokeOnlineCommand command) {
        try {
            return invokeOnlineWithStore(command);
        } catch (DataAccessException unavailable) {
            throw new PersistenceUnavailableException(unavailable);
        }
    }

    private InvocationResult invokeOnlineWithStore(InvokeOnlineCommand command) {
        Objects.requireNonNull(command, "command");
        if (!fitsWireMessage(command)) return new InvocationResult(InvocationOutcome.COMMAND_TOO_LARGE, null);
        OperationView previous = persistence.readOperation(command.operationId());
        if (previous != null) {
            return new InvocationResult(
                    sameOperation(previous, command)
                            ? InvocationOutcome.ALREADY_EXISTS
                            : InvocationOutcome.IDENTITY_CONFLICT,
                    previous);
        }

        BindingTarget binding = persistence.readActiveBinding(
                command.groupWorkspaceKey(), command.terminalRef(), command.bindingGeneration());
        if (binding == null) return new InvocationResult(InvocationOutcome.BINDING_INVALID, null);

        OnlineSession session = persistence.readOnlineSession(
                binding.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef());
        if (session == null) {
            if (!persistence.insertOffline(command, binding)) {
                return duplicateAfterConcurrentInsert(command);
            }
            return new InvocationResult(InvocationOutcome.OFFLINE, persistence.readOperation(command.operationId()));
        }

        if (!persistence.insertQueued(command, binding, session)) {
            return duplicateAfterConcurrentInsert(command);
        }
        persistence.notifyTarget(command.operationId());
        return new InvocationResult(InvocationOutcome.QUEUED, persistence.readOperation(command.operationId()));
    }

    @Override
    @Transactional(readOnly = true)
    public OperationView readOperation(UUID operationId) {
        try {
            return persistence.readOperation(Objects.requireNonNull(operationId, "operationId"));
        } catch (DataAccessException unavailable) {
            throw new PersistenceUnavailableException(unavailable);
        }
    }

    @Override
    @Transactional
    public ClaimedOperation claimOnlineOperation(UUID operationId, String nodeId) {
        try {
            return persistence.claim(Objects.requireNonNull(operationId, "operationId"), nodeId);
        } catch (DataAccessException unavailable) {
            throw new PersistenceUnavailableException(unavailable);
        }
    }

    @Override
    @Transactional
    public ReportAcceptance acceptTerminalReport(TerminalReport report) {
        try {
            return persistence.accept(Objects.requireNonNull(report, "report"));
        } catch (DataAccessException unavailable) {
            throw new PersistenceUnavailableException(unavailable);
        }
    }

    private InvocationResult duplicateAfterConcurrentInsert(InvokeOnlineCommand command) {
        OperationView current = persistence.readOperation(command.operationId());
        if (current == null) throw new IllegalStateException("TERMINAL_OPERATION_INSERT_READBACK_MISSING");
        return new InvocationResult(
                sameOperation(current, command)
                        ? InvocationOutcome.ALREADY_EXISTS
                        : InvocationOutcome.IDENTITY_CONFLICT,
                current);
    }

    private static boolean sameOperation(OperationView existing, InvokeOnlineCommand command) {
        return existing.requestId().equals(command.requestId())
                && existing.groupWorkspaceKey().equals(command.groupWorkspaceKey())
                && existing.terminalRef().equals(command.terminalRef())
                && existing.bindingGeneration() == command.bindingGeneration()
                && existing.commandName().equals(command.commandName())
                && existing.parameters().equals(command.parameters());
    }

    private boolean fitsWireMessage(InvokeOnlineCommand command) {
        ObjectNode message = objectMapper.createObjectNode();
        message.put("type", "REMOTE_COMMAND");
        message.put("remoteOperationId", command.operationId().toString());
        message.put("requestId", command.requestId().toString());
        message.put("bindingGeneration", command.bindingGeneration());
        message.put("commandName", command.commandName());
        message.set("parameters", command.parameters());
        try {
            return objectMapper.writeValueAsString(message).getBytes(StandardCharsets.UTF_8).length <= 65_536;
        } catch (JsonProcessingException invalid) {
            throw new IllegalArgumentException("TERMINAL_CONTROL_COMMAND_JSON_INVALID", invalid);
        }
    }
}
