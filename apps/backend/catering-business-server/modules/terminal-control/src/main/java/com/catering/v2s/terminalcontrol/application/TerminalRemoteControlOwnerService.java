package com.catering.v2s.terminalcontrol.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationOutcome;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.*;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence.OnlineSession;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.BindingIdentity;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.OnlineTarget;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.RemoteSession;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.StartRecord;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns remote-control admission, registration, lease facts and standard audit in terminal-control. */
@Service
public class TerminalRemoteControlOwnerService implements TerminalRemoteControlOwnerApi {
    private static final long SESSION_TTL_MILLIS = 30_000;
    private static final Set<String> TOPOLOGIES = Set.of("MOBILE_SINGLE", "LAPTOP_SINGLE", "LAPTOP_DUAL", "LAPTOP_PAIRED");
    private static final Set<String> END_REASONS = Set.of("ADMIN_ENDED", "WORKSPACE_CLOSED", "START_TIMEOUT",
            "START_FAILED", "CONTROLLER_DISCONNECTED", "SCREEN_DISCONNECTED", "PAIR_DISCONNECTED",
            "TDP_DISCONNECTED", "ACTIVATION_INVALID", "AUTHORIZATION_INVALID", "CONFIG_CHANGED", "APP_RESTARTED",
            "LEASE_EXPIRED", "CAPTURE_FAILED", "INPUT_RESULT_UNKNOWN", "INPUT_UNAVAILABLE", "UNSUPPORTED_PROTOCOL");

    private final TerminalRemoteControlPersistence persistence;
    private final TerminalControlOwnerApi operations;
    private final OrganizationTaskPathLookup organization;
    private final AuditEventWriter audit;
    private final TimeProvider time;
    private final ObjectMapper json;
    private final LiveKitRemoteControlGrantSigner grants;

    public TerminalRemoteControlOwnerService(TerminalRemoteControlPersistence persistence,
            TerminalControlOwnerApi operations, OrganizationTaskPathLookup organization,
            @Qualifier("terminalRemoteControlAuditEventWriter") AuditEventWriter audit,
            TimeProvider time, ObjectMapper json, LiveKitRemoteControlGrantSigner grants) {
        this.persistence = Objects.requireNonNull(persistence);
        this.operations = Objects.requireNonNull(operations);
        this.organization = Objects.requireNonNull(organization);
        this.audit = Objects.requireNonNull(audit);
        this.time = Objects.requireNonNull(time);
        this.json = Objects.requireNonNull(json);
        this.grants = Objects.requireNonNull(grants);
    }

    @Override
    @Transactional
    public StartReadback start(StartCommand command) {
        Objects.requireNonNull(command, "command");
        try {
            requireGrant(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(),
                    command.projectRef(), "REQ_START_OPERATIONS_TERMINAL_REMOTE_CONTROL", command.contextVersion());
            organization.requireTaskPath(command.workspaceUuid(), command.groupWorkspaceKey(), "PROJECT", command.projectRef());
            persistence.lockTerminal(command.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef());
            BindingIdentity binding = persistence.readCurrentActiveBinding(command.workspaceUuid(),
                    command.groupWorkspaceKey(), command.terminalRef());
            if (binding == null) throw failure(Failure.BINDING_INVALID);
            requireProjectMembership(command, binding.storeRef());
            OnlineTarget target = persistence.readOnlineTarget(command.workspaceUuid(), command.groupWorkspaceKey(),
                    command.terminalRef());
            if (target == null) throw failure(Failure.NOT_READY);

            RemoteSession active = persistence.findActiveForTerminal(command.workspaceUuid(),
                    command.groupWorkspaceKey(), command.terminalRef(), true);
            if (active != null) expireIfNeeded(active);

            RemoteSession previous = persistence.findByRequest(command.workspaceUuid(), command.actorAccountRef(),
                    command.requestId(), true);
            if (previous != null) {
                if (!sameTarget(previous, command.projectRef(), binding, command.terminalRef(), target))
                    throw failure(Failure.IDENTITY_CONFLICT);
                return startReadback(previous);
            }
            active = persistence.findActiveForTerminal(command.workspaceUuid(), command.groupWorkspaceKey(),
                    command.terminalRef(), true);
            if (active != null) throw failure(Failure.OCCUPIED);

            UUID sessionId = UUID.randomUUID();
            UUID operationId = UUID.randomUUID();
            ObjectNode parameters = json.createObjectNode();
            parameters.put("sessionId", sessionId.toString());
            parameters.put("bindingGeneration", binding.generation());
            parameters.put("targetSessionId", target.sessionId());
            persistence.insertStart(new StartRecord(sessionId, command.workspaceUuid(), command.groupWorkspaceKey(),
                    command.projectRef(), binding.storeRef(), command.terminalRef(), binding.generation(),
                    binding.deviceIdentity(), target.nodeId(), target.sessionId(), target.sequence(),
                    command.actorAccountRef(), command.actorSessionRef(), command.requestId(), operationId));
            var operation = operations.invokeOnline(new InvokeOnlineCommand(operationId, command.requestId(),
                    command.groupWorkspaceKey(), command.terminalRef(), binding.generation(),
                    "kernel.base.remote-control.start-remote-control", parameters));
            if (operation.outcome() != InvocationOutcome.QUEUED) {
                throw failure(switch (operation.outcome()) {
                    case OFFLINE -> Failure.NOT_READY;
                    case BINDING_INVALID -> Failure.BINDING_INVALID;
                    case IDENTITY_CONFLICT, ALREADY_EXISTS, COMMAND_TOO_LARGE -> Failure.IDENTITY_CONFLICT;
                    case QUEUED -> throw new IllegalStateException("queued operation was rejected");
                });
            }
            writeAudit(command.actor(), command.workspaceUuid(), command.groupWorkspaceKey(), sessionId, "START",
                    List.of(AuditChange.forNullableScalar("state", null, "STARTING")));
            RemoteSession stored = persistence.findById(sessionId, false);
            if (stored == null) throw new IllegalStateException("REMOTE_CONTROL_SESSION_READBACK_MISSING");
            return startReadback(stored);
        } catch (RemoteControlException failure) {
            throw failure;
        } catch (DataAccessException | TerminalControlOwnerApi.PersistenceUnavailableException unavailable) {
            throw new RemoteControlException(Failure.DEPENDENCY_UNAVAILABLE, unavailable);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public SessionReadback read(SessionQuery query) {
        RemoteSession session = persistence.findForScope(query.workspaceUuid(), query.groupWorkspaceKey(),
                query.projectRef(), query.terminalRef(), query.sessionId(), query.actorAccountRef(), false);
        if (session == null || !session.actorSessionRef().equals(query.actorSessionRef())) throw failure(Failure.NOT_FOUND);
        Instant now = persistence.databaseNow();
        if (expired(session, now)) return new SessionReadback(session.sessionId(), State.ENDED,
                session.state().equals("STARTING") ? "START_TIMEOUT" : "LEASE_EXPIRED", session.description(),
                session.startedAt(), session.state().equals("STARTING") ? session.deadlineAt() : session.leaseExpiresAt());
        return new SessionReadback(session.sessionId(), State.valueOf(session.state()), session.reason(),
                session.description(), session.startedAt(), session.endedAt());
    }

    @Override
    @Transactional(readOnly = true)
    public ControllerGrant controllerGrant(ControllerGrantQuery query) {
        requireGrant(query.ownerScopeGrant(), query.workspaceUuid(), query.groupWorkspaceKey(), query.projectRef(),
                "REQ_ISSUE_OPERATIONS_REMOTE_CONTROL_GRANT", query.contextVersion());
        RemoteSession session = persistence.findForScope(query.workspaceUuid(), query.groupWorkspaceKey(),
                query.projectRef(), query.terminalRef(), query.sessionId(), query.actorAccountRef(), false);
        if (session == null || !session.actorSessionRef().equals(query.actorSessionRef())) throw failure(Failure.NOT_FOUND);
        Instant now = persistence.databaseNow();
        if (expired(session, now) || "ENDED".equals(session.state())) throw failure(Failure.SESSION_ENDED);
        if (session.description() == null) throw failure(Failure.NOT_READY);
        String identity = session.description().path("controllerIdentity").asText();
        String room = session.description().path("roomName").asText();
        String token = grants.sign(room, identity, true);
        return new ControllerGrant(grants.signalUrl(), room, identity, token,
                now.plusMillis(SESSION_TTL_MILLIS), session.description());
    }

    @Override
    @Transactional
    public RegistrationReadback register(RegistrationCommand command) {
        Verification credential = command.credential();
        requireVerified(credential);
        if (!TOPOLOGIES.contains(command.topologyKind())
                || ("LAPTOP_PAIRED".equals(command.topologyKind())) != (command.peerIdentity() != null))
            throw failure(Failure.IDENTITY_CONFLICT);
        try {
            persistence.lockTerminal(credential.workspaceUuid(), credential.groupWorkspaceKey(), credential.terminalRef());
            RemoteSession session = persistence.findById(command.sessionId(), true);
            if (session == null || !sameCredential(session, credential)) throw failure(Failure.IDENTITY_CONFLICT);
            validateCurrentTarget(session, credential);
            Instant now = persistence.databaseNow();
            if (expired(session, now)) {
                if (persistence.endExpired(session.sessionId(), session.state().equals("STARTING") ? "START_TIMEOUT" : "LEASE_EXPIRED"))
                    writeAudit(AuditActor.system(), session.workspaceUuid(), session.groupWorkspaceKey(), session.sessionId(),
                            "END", List.of(AuditChange.forNullableScalar("reason", null,
                                    session.state().equals("STARTING") ? "START_TIMEOUT" : "LEASE_EXPIRED")));
                throw failure(Failure.SESSION_ENDED);
            }
            if (!"STARTING".equals(session.state())) throw failure(Failure.SESSION_ENDED);

            if (session.description() == null) {
                JsonNode description = description(session.sessionId(), command.topologyKind(), command.peerIdentity());
                boolean saved = persistence.setDescription(session.sessionId(), command.topologyKind(),
                        command.peerIdentity() == null ? null : command.peerIdentity().moduleName(),
                        command.peerIdentity() == null ? null : command.peerIdentity().nodeId(), description);
                session = persistence.findById(command.sessionId(), true);
                if (!saved && session == null) throw new IllegalStateException("REMOTE_CONTROL_SESSION_READBACK_MISSING");
            } else if (!Objects.equals(session.topologyKind(), command.topologyKind())
                    || !Objects.equals(session.peerModule(), command.peerIdentity() == null ? null : command.peerIdentity().moduleName())
                    || !Objects.equals(session.peerNode(), command.peerIdentity() == null ? null : command.peerIdentity().nodeId())) {
                throw failure(Failure.IDENTITY_CONFLICT);
            }
            List<EndpointGrant> tokens = new ArrayList<>();
            for (JsonNode endpoint : session.description().path("endpoints")) {
                String identity = endpoint.path("participantIdentity").asText();
                tokens.add(new EndpointGrant(UUID.fromString(endpoint.path("endpointId").asText()),
                        session.description().path("roomName").asText(), identity,
                        grants.sign(session.description().path("roomName").asText(), identity, false),
                        now.plusMillis(SESSION_TTL_MILLIS)));
            }
            return new RegistrationReadback(session.description(), Math.max(0, session.deadlineAt().toEpochMilli() - now.toEpochMilli()), tokens);
        } catch (RemoteControlException failure) {
            throw failure;
        } catch (DataAccessException unavailable) {
            throw new RemoteControlException(Failure.DEPENDENCY_UNAVAILABLE, unavailable);
        }
    }

    @Override
    @Transactional
    public StatusReceipt report(StatusReportCommand command) {
        Verification credential = command.credential();
        requireVerified(credential);
        try {
            persistence.lockTerminal(credential.workspaceUuid(), credential.groupWorkspaceKey(), credential.terminalRef());
            RemoteSession session = persistence.findById(command.sessionId(), true);
            if (session == null || !sameCredential(session, credential)) throw failure(Failure.IDENTITY_CONFLICT);
            validateCurrentTarget(session, credential);
            Instant now = persistence.databaseNow();
            if (expired(session, now) || "ENDED".equals(session.state())) {
                endExpired(session, "ENDED".equals(session.state()) ? session.reason()
                        : session.state().equals("STARTING") ? "START_TIMEOUT" : "LEASE_EXPIRED");
                throw failure(Failure.SESSION_ENDED);
            }
            String next = command.state().name();
            if ("STARTING".equals(session.state()) && !Set.of("STARTING", "ACTIVE", "ENDED").contains(next)
                    || "ACTIVE".equals(session.state()) && !Set.of("ACTIVE", "ENDED").contains(next))
                throw failure(Failure.INVALID_STATE);
            if (session.description() == null) throw failure(Failure.NOT_READY);
            validateReadyScreens(session.description(), command.readyScreens(), "ACTIVE".equals(next));
            if ("ENDED".equals(next) && !END_REASONS.contains(command.reason())) throw failure(Failure.INVALID_STATE);
            ArrayNode ready = json.createArrayNode();
            for (ReadyScreen screen : command.readyScreens()) {
                ObjectNode item = ready.addObject();
                item.put("endpointId", screen.endpointId().toString()); item.put("screen", screen.screen());
                item.put("streamId", screen.streamId().toString()); item.put("trackSid", screen.trackSid());
            }
            boolean ending = "ENDED".equals(next);
            if (!persistence.updateStatus(session.sessionId(), next, command.reason(), ready,
                    "ACTIVE".equals(next), ending)) throw failure(Failure.SESSION_ENDED);
            if (ending) writeAudit(AuditActor.terminalDevice(), session.workspaceUuid(), session.groupWorkspaceKey(),
                    session.sessionId(), "END", List.of(AuditChange.forNullableScalar("reason", null, command.reason())));
            RemoteSession updated = persistence.findById(session.sessionId(), false);
            return new StatusReceipt(updated.sessionId(), State.valueOf(updated.state()), updated.reason(),
                    Math.max(0, updated.leaseExpiresAt().toEpochMilli() - now.toEpochMilli()));
        } catch (RemoteControlException failure) {
            throw failure;
        } catch (DataAccessException unavailable) {
            throw new RemoteControlException(Failure.DEPENDENCY_UNAVAILABLE, unavailable);
        }
    }

    @Override
    @Transactional
    public EndReadback end(EndCommand command) {
        requireGrant(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(),
                command.projectRef(), "REQ_END_OPERATIONS_TERMINAL_REMOTE_CONTROL", command.contextVersion());
        if (!Set.of("ADMIN_ENDED", "WORKSPACE_CLOSED").contains(command.reason())) throw failure(Failure.INVALID_STATE);
        persistence.lockTerminal(command.workspaceUuid(), command.groupWorkspaceKey(), command.terminalRef());
        RemoteSession session = persistence.findForScope(command.workspaceUuid(), command.groupWorkspaceKey(),
                command.projectRef(), command.terminalRef(), command.sessionId(), command.actorAccountRef(), true);
        if (session == null || !session.actorSessionRef().equals(command.actorSessionRef())) throw failure(Failure.NOT_FOUND);
        if (!"ENDED".equals(session.state())) {
            persistence.updateStatus(session.sessionId(), "ENDED", command.reason(), session.readyScreens(), false, true);
            writeAudit(command.actor(), session.workspaceUuid(), session.groupWorkspaceKey(), session.sessionId(), "END",
                    List.of(AuditChange.forNullableScalar("reason", null, command.reason())));
            session = persistence.findById(session.sessionId(), false);
        } else if (!Objects.equals(session.reason(), command.reason())) {
            throw failure(Failure.IDENTITY_CONFLICT);
        }
        return endReadback(session);
    }

    private void requireProjectMembership(StartCommand command, UUID storeRef) {
        var memberships = organization.requireStoreProjectMemberships(command.workspaceUuid(), command.groupWorkspaceKey(),
                List.of(storeRef));
        if (!command.projectRef().equals(memberships.get(storeRef))) throw failure(Failure.AUTHORIZATION_DENIED);
    }

    private void validateCurrentTarget(RemoteSession session, Verification credential) {
        BindingIdentity binding = persistence.readActiveBinding(credential.workspaceUuid(),
                credential.groupWorkspaceKey(), credential.terminalRef(), credential.generation());
        if (binding == null || !binding.workspaceUuid().equals(session.workspaceUuid())
                || !binding.storeRef().equals(session.storeRef())
                || !Objects.equals(binding.deviceIdentity(), session.deviceIdentity())) throw failure(Failure.BINDING_INVALID);
        OnlineTarget target = persistence.readOnlineTarget(session.workspaceUuid(), session.groupWorkspaceKey(), session.terminalRef());
        if (target == null || !target.nodeId().equals(session.targetNodeId())
                || !target.sessionId().equals(session.targetSessionId()) || target.sequence() != session.targetSessionSequence())
            throw failure(Failure.IDENTITY_CONFLICT);
    }

    private boolean sameCredential(RemoteSession session, Verification credential) {
        return session.workspaceUuid().equals(credential.workspaceUuid())
                && session.groupWorkspaceKey().equals(credential.groupWorkspaceKey())
                && session.terminalRef().equals(credential.terminalRef())
                && session.bindingGeneration() == credential.generation()
                && Objects.equals(session.deviceIdentity(), credential.bindingDeviceId());
    }

    private static void requireVerified(Verification credential) {
        if (credential == null || credential.outcome() != Outcome.VERIFIED) throw failure(Failure.BINDING_INVALID);
    }

    private void requireGrant(OperationsOwnerScopeGrant grant, UUID workspace, String group, UUID project,
            String requirement, long contextVersion) {
        if (grant == null || !grant.matchesRequirementAndCapability(workspace, group, "PROJECT", project,
                requirement, "CONTROL_PROJECT_TERMINAL") || !grant.matchesExpectedContextVersion(contextVersion))
            throw failure(Failure.AUTHORIZATION_DENIED);
    }

    private static void validateReadyScreens(JsonNode description, List<ReadyScreen> readyScreens, boolean requireAll) {
        Set<String> expected = new HashSet<>();
        for (JsonNode screen : description.path("screens"))
            expected.add(screen.path("endpointId").asText() + ":" + screen.path("screen").asText());
        Set<String> actual = new HashSet<>();
        for (ReadyScreen screen : readyScreens) {
            if (screen.endpointId() == null || screen.streamId() == null || screen.trackSid() == null
                    || screen.trackSid().isBlank() || screen.trackSid().length() > 128
                    || !actual.add(screen.endpointId() + ":" + screen.screen())) throw failure(Failure.IDENTITY_CONFLICT);
        }
        if (!expected.containsAll(actual) || (requireAll && !actual.equals(expected))) throw failure(Failure.IDENTITY_CONFLICT);
    }

    private JsonNode description(UUID sessionId, String topology, PeerIdentity peer) {
        UUID master = UUID.randomUUID();
        UUID slave = "LAPTOP_PAIRED".equals(topology) ? UUID.randomUUID() : null;
        String room = "rc_" + sessionId;
        ObjectNode root = json.createObjectNode();
        root.put("sessionId", sessionId.toString()); root.put("roomName", room);
        root.put("controllerIdentity", "controller_" + sessionId); root.put("topologyKind", topology);
        root.put("masterEndpointId", master.toString());
        ArrayNode endpoints = root.putArray("endpoints");
        endpoint(endpoints, master);
        if (slave != null) endpoint(endpoints, slave);
        ArrayNode screens = root.putArray("screens");
        screen(screens, "main", master);
        if ("LAPTOP_DUAL".equals(topology)) screen(screens, "secondary", master);
        if (slave != null) screen(screens, "secondary", slave);
        return root;
    }

    private static void endpoint(ArrayNode endpoints, UUID endpoint) {
        ObjectNode value = endpoints.addObject(); value.put("endpointId", endpoint.toString());
        value.put("participantIdentity", "endpoint_" + endpoint);
    }

    private static void screen(ArrayNode screens, String name, UUID endpoint) {
        ObjectNode value = screens.addObject(); value.put("screen", name); value.put("endpointId", endpoint.toString());
    }

    private StartReadback startReadback(RemoteSession session) {
        return new StartReadback(session.sessionId(), State.valueOf(session.state()),
                session.description() == null ? "rc_" + session.sessionId() : session.description().path("roomName").asText(),
                session.description() == null ? "controller_" + session.sessionId()
                        : session.description().path("controllerIdentity").asText(),
                session.description(), session.startOperationId(), session.deadlineAt());
    }

    private EndReadback endReadback(RemoteSession session) {
        List<String> participants = new ArrayList<>();
        if (session.description() != null) {
            String controllerIdentity = session.description().path("controllerIdentity").asText();
            if (!controllerIdentity.isBlank()) participants.add(controllerIdentity);
            session.description().path("endpoints").forEach(endpoint -> participants.add(endpoint.path("participantIdentity").asText()));
        }
        return new EndReadback(session.sessionId(), State.ENDED, session.reason(), session.endedAt(),
                session.description() == null ? "rc_" + session.sessionId() : session.description().path("roomName").asText(),
                participants, session.groupWorkspaceKey(), session.terminalRef(), session.bindingGeneration());
    }

    private boolean sameTarget(RemoteSession existing, UUID projectRef, BindingIdentity binding,
            UUID terminalRef, OnlineTarget target) {
        return existing.projectRef().equals(projectRef) && existing.storeRef().equals(binding.storeRef())
                && existing.terminalRef().equals(terminalRef) && existing.bindingGeneration() == binding.generation()
                && existing.targetNodeId().equals(target.nodeId()) && existing.targetSessionId().equals(target.sessionId())
                && existing.targetSessionSequence() == target.sequence();
    }

    private static boolean expired(RemoteSession session, Instant now) {
        return "STARTING".equals(session.state()) ? !now.isBefore(session.deadlineAt())
                : "ACTIVE".equals(session.state()) && !now.isBefore(session.leaseExpiresAt());
    }

    private void expireIfNeeded(RemoteSession session) {
        Instant now = persistence.databaseNow();
        if (expired(session, now)) endExpired(session, "STARTING".equals(session.state()) ? "START_TIMEOUT" : "LEASE_EXPIRED");
    }

    private void endExpired(RemoteSession session, String reason) {
        if (persistence.endExpired(session.sessionId(), reason))
            writeAudit(AuditActor.system(), session.workspaceUuid(), session.groupWorkspaceKey(), session.sessionId(), "END",
                    List.of(AuditChange.forNullableScalar("reason", null, reason)));
    }

    private void writeAudit(AuditActor actor, UUID workspace, String group, UUID sessionId,
            String action, List<AuditChange> changes) {
        if (audit.write(new AuditEvent(UUID.randomUUID(), workspace, group,
                new AuditTarget(AuditEntityTypes.TERMINAL_REMOTE_CONTROL_SESSION, sessionId.toString()),
                actor, action, time.currentEpochMillis(), changes)) != 1)
            throw new IllegalStateException("TERMINAL_REMOTE_CONTROL_AUDIT_WRITE_FAILED");
    }

    private static RemoteControlException failure(Failure failure) { return new RemoteControlException(failure); }
}
