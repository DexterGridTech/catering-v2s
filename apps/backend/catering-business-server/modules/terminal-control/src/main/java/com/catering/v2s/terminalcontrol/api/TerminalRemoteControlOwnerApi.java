package com.catering.v2s.terminalcontrol.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Owner boundary for a remote-control session, its online command and finite audit facts. */
public interface TerminalRemoteControlOwnerApi {
    StartReadback start(StartCommand command);

    SessionReadback read(SessionQuery query);

    ControllerGrant controllerGrant(ControllerGrantQuery query);

    RegistrationReadback register(RegistrationCommand command);

    StatusReceipt report(StatusReportCommand command);

    EndReadback end(EndCommand command);

    enum State { STARTING, ACTIVE, ENDED }

    enum Failure { AUTHORIZATION_DENIED, NOT_FOUND, BINDING_INVALID, NOT_READY, OCCUPIED,
        IDENTITY_CONFLICT, SESSION_ENDED, INVALID_STATE, DEPENDENCY_UNAVAILABLE }

    final class RemoteControlException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final Failure failure;

        public RemoteControlException(Failure failure) {
            super(Objects.requireNonNull(failure, "failure").name());
            this.failure = failure;
        }

        public RemoteControlException(Failure failure, Throwable cause) {
            super(Objects.requireNonNull(failure, "failure").name(), cause);
            this.failure = failure;
        }

        public Failure failure() { return failure; }
    }

    record StartCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef,
            UUID requestId, long contextVersion, UUID actorAccountRef, UUID actorSessionRef,
            AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) {
        public StartCommand {
            Objects.requireNonNull(workspaceUuid); Objects.requireNonNull(projectRef); Objects.requireNonNull(terminalRef);
            Objects.requireNonNull(requestId); Objects.requireNonNull(actorAccountRef); Objects.requireNonNull(actorSessionRef);
            Objects.requireNonNull(actor); Objects.requireNonNull(ownerScopeGrant);
        }
    }

    record StartReadback(UUID sessionId, State state, String roomName, String controllerIdentity,
            JsonNode description, UUID startOperationId, Instant deadlineAt) {}

    record SessionQuery(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef,
            UUID sessionId, long contextVersion, UUID actorAccountRef, UUID actorSessionRef) {}

    record SessionReadback(UUID sessionId, State state, String reason, JsonNode description,
            Instant startedAt, Instant endedAt) {}

    record ControllerGrantQuery(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            UUID terminalRef, UUID sessionId, long contextVersion, UUID actorAccountRef, UUID actorSessionRef,
            OperationsOwnerScopeGrant ownerScopeGrant) {}

    record ControllerGrant(String url, String roomName, String participantIdentity, String token,
            Instant expiresAt, JsonNode description) {
        @Override public String toString() {
            return "ControllerGrant[url=" + url + ", roomName=" + roomName + ", participantIdentity="
                    + participantIdentity + ", token=redacted, expiresAt=" + expiresAt + "]";
        }
    }

    record PeerIdentity(String moduleName, String nodeId) {}

    record RegistrationCommand(Verification credential, UUID sessionId, String topologyKind,
            PeerIdentity peerIdentity) {}

    record EndpointGrant(UUID endpointId, String roomName, String participantIdentity,
            String token, Instant expiresAt) {
        @Override public String toString() {
            return "EndpointGrant[endpointId=" + endpointId + ", roomName=" + roomName
                    + ", participantIdentity=" + participantIdentity + ", token=redacted, expiresAt=" + expiresAt + "]";
        }
    }

    record RegistrationReadback(JsonNode description, long remainingLeaseMs, List<EndpointGrant> grants) {
        public RegistrationReadback { grants = List.copyOf(grants); }
    }

    record ReadyScreen(UUID endpointId, String screen, UUID streamId, String trackSid) {}

    record StatusReportCommand(Verification credential, UUID sessionId, State state, String reason,
            List<ReadyScreen> readyScreens) {
        public StatusReportCommand { readyScreens = List.copyOf(readyScreens == null ? List.of() : readyScreens); }
    }

    record StatusReceipt(UUID sessionId, State state, String reason, long remainingLeaseMs) {}

    record EndCommand(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef,
            UUID sessionId, long contextVersion, UUID actorAccountRef, UUID actorSessionRef,
            String reason, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) {}

    record EndReadback(UUID sessionId, State state, String reason, Instant endedAt,
            String roomName, List<String> participantIdentities, String groupWorkspaceKey,
            UUID terminalRef, long bindingGeneration) {
        public EndReadback { participantIdentities = List.copyOf(participantIdentities); }
    }
}
