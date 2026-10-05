package com.catering.v2s.terminalcontrol.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Terminal-control owner boundary for online command requests and durable execution facts. */
public interface TerminalControlOwnerApi {
    InvocationResult invokeOnline(InvokeOnlineCommand command);

    OperationView readOperation(UUID operationId);

    ClaimedOperation claimOnlineOperation(UUID operationId, String nodeId);

    ReportAcceptance acceptTerminalReport(TerminalReport report);

    final class PersistenceUnavailableException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public static final String CODE = "TERMINAL_CONTROL_STORAGE_UNAVAILABLE";

        public PersistenceUnavailableException(RuntimeException cause) {
            super(CODE, cause);
        }
    }

    enum OperationStatus {
        NOT_SENT,
        QUEUED,
        CLAIMED,
        RECEIVED,
        STARTED,
        UNKNOWN,
        COMPLETED,
        FAILED
    }

    enum InvocationOutcome {
        QUEUED,
        OFFLINE,
        ALREADY_EXISTS,
        IDENTITY_CONFLICT,
        BINDING_INVALID,
        COMMAND_TOO_LARGE
    }

    record InvokeOnlineCommand(
            UUID operationId,
            UUID requestId,
            String groupWorkspaceKey,
            UUID terminalRef,
            long bindingGeneration,
            String commandName,
            JsonNode parameters) {
        public InvokeOnlineCommand {
            operationId = Objects.requireNonNull(operationId, "operationId");
            requestId = Objects.requireNonNull(requestId, "requestId");
            groupWorkspaceKey = text(groupWorkspaceKey, 64, "groupWorkspaceKey");
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            if (bindingGeneration < 1) throw new IllegalArgumentException("bindingGeneration is invalid");
            commandName = text(commandName, 128, "commandName");
            parameters = Objects.requireNonNull(parameters, "parameters");
            if (!parameters.isObject()) throw new IllegalArgumentException("parameters must be an object");
            parameters = parameters.deepCopy();
        }
    }

    record InvocationResult(InvocationOutcome outcome, OperationView operation) {
        public InvocationResult {
            outcome = Objects.requireNonNull(outcome, "outcome");
        }
    }

    record OperationView(
            UUID operationId,
            UUID requestId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            long bindingGeneration,
            String targetNodeId,
            String targetSessionId,
            OperationStatus status,
            String commandName,
            JsonNode parameters,
            JsonNode result,
            String errorCode,
            Instant createdAt,
            Instant updatedAt) {
        /** An acknowledged claim without a terminal report has no known execution outcome yet. */
        @JsonProperty("outcome")
        public OperationStatus outcome() {
            return status == OperationStatus.CLAIMED && result == null && errorCode == null
                    ? OperationStatus.UNKNOWN
                    : status;
        }
    }

    record ClaimedOperation(
            UUID operationId,
            UUID requestId,
            UUID terminalRef,
            long bindingGeneration,
            String targetSessionId,
            String commandName,
            JsonNode parameters) {}

    record TerminalReport(
            UUID reportId,
            UUID operationId,
            UUID requestId,
            long bindingGeneration,
            String nodeId,
            String sessionId,
            OperationStatus phase,
            Instant occurredAt,
            JsonNode result,
            String errorCode) {
        public TerminalReport {
            reportId = Objects.requireNonNull(reportId, "reportId");
            operationId = Objects.requireNonNull(operationId, "operationId");
            requestId = Objects.requireNonNull(requestId, "requestId");
            if (bindingGeneration < 1) throw new IllegalArgumentException("bindingGeneration is invalid");
            nodeId = text(nodeId, 128, "nodeId");
            sessionId = text(sessionId, 128, "sessionId");
            if (phase != OperationStatus.RECEIVED
                    && phase != OperationStatus.STARTED
                    && phase != OperationStatus.UNKNOWN
                    && phase != OperationStatus.COMPLETED
                    && phase != OperationStatus.FAILED) {
                throw new IllegalArgumentException("phase is not a terminal report phase");
            }
            occurredAt = Objects.requireNonNull(occurredAt, "occurredAt");
            if (result != null && !result.isObject()) throw new IllegalArgumentException("result must be an object");
            if (errorCode != null) errorCode = text(errorCode, 128, "errorCode");
        }
    }

    record ReportAcceptance(boolean accepted, Instant acceptedAt) {}

    private static String text(String value, int max, String name) {
        if (value == null || value.isBlank() || value.length() > max)
            throw new IllegalArgumentException(name + " is invalid");
        return value;
    }
}
