package com.catering.v2s.terminalcontrol.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationOutcome;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationResult;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.Failure;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.RemoteControlException;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.SessionQuery;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.StartCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.StatusReportCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.State;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.BindingIdentity;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.OnlineTarget;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.RemoteSession;
import com.catering.v2s.terminalcontrol.persistence.TerminalRemoteControlPersistence.StartRecord;
import com.catering.v2s.workspace.iam.api.WorkspaceCurrentAuthorizationLookup;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

final class TerminalRemoteControlOwnerServiceBoundaryTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID PROJECT = UUID.fromString("00000000-0000-0000-0000-000000000102");
    private static final UUID STORE = UUID.fromString("00000000-0000-0000-0000-000000000103");
    private static final UUID TERMINAL = UUID.fromString("00000000-0000-0000-0000-000000000104");
    private static final UUID SESSION = UUID.fromString("00000000-0000-0000-0000-000000000105");
    private static final UUID ACCOUNT = UUID.fromString("00000000-0000-0000-0000-000000000106");
    private static final UUID ACTOR_SESSION = UUID.fromString("00000000-0000-0000-0000-000000000107");
    private static final String GROUP = "remote-test";

    @Test
    void missingCurrentWriteCapabilityCannotReachRequestReplayLookup() {
        Fixture fixture = new Fixture();
        when(fixture.persistence.findByRequest(WORKSPACE, ACCOUNT, fixture.requestId, true))
                .thenReturn(fixture.session("STARTING", 11, Instant.parse("2026-10-11T01:00:00Z"),
                        Instant.parse("2026-10-11T01:00:00Z")));
        StartCommand command = fixture.startCommand(fixture.grant("READ_PROJECT_TERMINAL"));

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.start(command));

        assertEquals(Failure.AUTHORIZATION_DENIED, failure.failure());
        verify(fixture.persistence, never()).lockTerminal(any(), any(), any());
        verify(fixture.persistence, never()).findByRequest(any(), any(), any(), anyBoolean());
        verify(fixture.operations, never()).invokeOnline(any());
    }

    @Test
    void replayWithDifferentTerminalTargetIsAnIdentityConflictAndDoesNotDispatchAgain() {
        Fixture fixture = new Fixture();
        UUID otherTerminal = UUID.fromString("00000000-0000-0000-0000-000000000108");
        when(fixture.persistence.readCurrentActiveBinding(WORKSPACE, GROUP, otherTerminal))
                .thenReturn(new BindingIdentity(WORKSPACE, STORE, 1, "device-2"));
        when(fixture.persistence.readOnlineTarget(WORKSPACE, GROUP, otherTerminal))
                .thenReturn(new OnlineTarget("tds-node", "tds-session", 12));
        when(fixture.persistence.findActiveForTerminal(WORKSPACE, GROUP, otherTerminal, true)).thenReturn(null);
        when(fixture.persistence.findByRequest(WORKSPACE, ACCOUNT, fixture.requestId, true))
                .thenReturn(fixture.session("STARTING", 11, Instant.parse("2026-10-11T01:00:00Z"),
                        Instant.parse("2026-10-11T01:00:00Z")));

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.start(fixture.startCommand(
                        fixture.grant("CONTROL_PROJECT_TERMINAL"), otherTerminal)));

        assertEquals(Failure.IDENTITY_CONFLICT, failure.failure());
        verify(fixture.persistence, never()).insertStart(any(StartRecord.class));
        verify(fixture.operations, never()).invokeOnline(any());
    }

    @Test
    void registerRejectsAChangedTdsSequenceBeforeSavingDescription() {
        Fixture fixture = new Fixture();
        Verification credential = fixture.credential();
        when(fixture.persistence.findById(SESSION, true))
                .thenReturn(fixture.session("STARTING", 11, Instant.parse("2026-10-11T01:00:00Z"),
                        Instant.parse("2026-10-11T01:00:00Z")));
        when(fixture.persistence.readActiveBinding(WORKSPACE, GROUP, TERMINAL, 1))
                .thenReturn(new BindingIdentity(WORKSPACE, STORE, 1, "device-1"));
        when(fixture.persistence.readOnlineTarget(WORKSPACE, GROUP, TERMINAL))
                .thenReturn(new OnlineTarget("tds-node", "tds-session", 12));

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.register(new TerminalRemoteControlOwnerApi.RegistrationCommand(
                        credential, SESSION, "MOBILE_SINGLE", null)));

        assertEquals(Failure.IDENTITY_CONFLICT, failure.failure());
        verify(fixture.persistence, never()).setDescription(any(), any(), any(), any(), any());
    }

    @Test
    void reportRejectsAnInactiveBindingBeforeRenewingOrChangingStatus() {
        Fixture fixture = new Fixture();
        when(fixture.persistence.findById(SESSION, true))
                .thenReturn(fixture.session("ACTIVE", 11, Instant.parse("2026-10-11T01:00:00Z"),
                        Instant.parse("2026-10-11T01:00:00Z")));
        when(fixture.persistence.readActiveBinding(WORKSPACE, GROUP, TERMINAL, 1)).thenReturn(null);

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.report(new StatusReportCommand(fixture.credential(), SESSION, State.ACTIVE,
                        null, List.of())));

        assertEquals(Failure.BINDING_INVALID, failure.failure());
        verify(fixture.persistence, never()).updateStatus(any(), any(), any(), any(), anyBoolean(), anyBoolean());
    }

    @Test
    void reportRejectsAChangedTdsSequenceBeforeRenewal() {
        Fixture fixture = new Fixture();
        when(fixture.persistence.findById(SESSION, true))
                .thenReturn(fixture.session("ACTIVE", 11, Instant.parse("2026-10-11T01:00:00Z"),
                        Instant.parse("2026-10-11T01:00:00Z")));
        when(fixture.persistence.readActiveBinding(WORKSPACE, GROUP, TERMINAL, 1))
                .thenReturn(new BindingIdentity(WORKSPACE, STORE, 1, "device-1"));
        when(fixture.persistence.readOnlineTarget(WORKSPACE, GROUP, TERMINAL))
                .thenReturn(new OnlineTarget("tds-node", "new-tds-session", 12));

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.report(new StatusReportCommand(fixture.credential(), SESSION, State.ACTIVE,
                        null, List.of())));

        assertEquals(Failure.IDENTITY_CONFLICT, failure.failure());
        verify(fixture.persistence, never()).updateStatus(any(), any(), any(), any(), anyBoolean(), anyBoolean());
    }

    @Test
    void reportCannotReviveAnExpiredSession() {
        Fixture fixture = new Fixture();
        Instant expired = Instant.parse("2026-10-11T01:00:00Z");
        when(fixture.persistence.findById(SESSION, true))
                .thenReturn(fixture.session("ACTIVE", 11, expired.minusSeconds(60), expired));
        when(fixture.persistence.readActiveBinding(WORKSPACE, GROUP, TERMINAL, 1))
                .thenReturn(new BindingIdentity(WORKSPACE, STORE, 1, "device-1"));
        when(fixture.persistence.readOnlineTarget(WORKSPACE, GROUP, TERMINAL))
                .thenReturn(new OnlineTarget("tds-node", "tds-session", 11));
        when(fixture.persistence.databaseNow()).thenReturn(expired.plusMillis(1));
        when(fixture.persistence.endExpired(SESSION, "LEASE_EXPIRED")).thenReturn(true);
        when(fixture.audit.write(any())).thenReturn(1);

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.report(new StatusReportCommand(fixture.credential(), SESSION, State.ACTIVE,
                        null, List.of())));

        assertEquals(Failure.SESSION_ENDED, failure.failure());
        verify(fixture.persistence).endExpired(SESSION, "LEASE_EXPIRED");
        verify(fixture.persistence, never()).updateStatus(any(), any(), any(), any(), anyBoolean(), anyBoolean());
    }

    @Test
    void readUsesTheExactProjectTerminalAndActorScope() {
        Fixture fixture = new Fixture();
        SessionQuery query = new SessionQuery(WORKSPACE, GROUP, PROJECT, TERMINAL, SESSION, 7, ACCOUNT, ACTOR_SESSION);
        when(fixture.persistence.findForScope(WORKSPACE, GROUP, PROJECT, TERMINAL, SESSION, ACCOUNT, false))
                .thenReturn(null);

        RemoteControlException failure = assertThrows(RemoteControlException.class, () -> fixture.owner.read(query));

        assertEquals(Failure.NOT_FOUND, failure.failure());
        verify(fixture.persistence).findForScope(WORKSPACE, GROUP, PROJECT, TERMINAL, SESSION, ACCOUNT, false);
    }

    @Test
    void readCannotCrossProjectScope() {
        Fixture fixture = new Fixture();
        UUID otherProject = UUID.fromString("00000000-0000-0000-0000-000000000109");
        SessionQuery query = new SessionQuery(WORKSPACE, GROUP, otherProject, TERMINAL, SESSION, 7,
                ACCOUNT, ACTOR_SESSION);
        when(fixture.persistence.findForScope(WORKSPACE, GROUP, otherProject, TERMINAL, SESSION, ACCOUNT, false))
                .thenReturn(null);

        RemoteControlException failure = assertThrows(RemoteControlException.class, () -> fixture.owner.read(query));

        assertEquals(Failure.NOT_FOUND, failure.failure());
        verify(fixture.persistence).findForScope(WORKSPACE, GROUP, otherProject, TERMINAL, SESSION, ACCOUNT, false);
    }

    @Test
    void controllerGrantCannotCrossAccountScope() {
        Fixture fixture = new Fixture();
        UUID otherAccount = UUID.fromString("00000000-0000-0000-0000-000000000110");
        var query = new TerminalRemoteControlOwnerApi.ControllerGrantQuery(WORKSPACE, GROUP, PROJECT, TERMINAL,
                SESSION, 7, otherAccount, ACTOR_SESSION,
                fixture.grant("REQ_ISSUE_OPERATIONS_REMOTE_CONTROL_GRANT", "CONTROL_PROJECT_TERMINAL"));
        when(fixture.persistence.findForScope(WORKSPACE, GROUP, PROJECT, TERMINAL, SESSION, otherAccount, false))
                .thenReturn(null);

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.controllerGrant(query));

        assertEquals(Failure.NOT_FOUND, failure.failure());
        verify(fixture.persistence).findForScope(WORKSPACE, GROUP, PROJECT, TERMINAL, SESSION, otherAccount, false);
        verify(fixture.grants, never()).sign(any(), any(), anyBoolean());
    }

    @Test
    void rejectedOnlineDispatchThrowsAfterStagingAndBeforeAudit() throws NoSuchMethodException {
        Fixture fixture = new Fixture();
        fixture.prepareStartLookups(null, 11, 11);
        when(fixture.persistence.findByRequest(WORKSPACE, ACCOUNT, fixture.requestId, true)).thenReturn(null);
        when(fixture.persistence.findActiveForTerminal(WORKSPACE, GROUP, TERMINAL, true)).thenReturn(null);
        when(fixture.operations.invokeOnline(any()))
                .thenReturn(new InvocationResult(InvocationOutcome.OFFLINE, null));

        RemoteControlException failure = assertThrows(RemoteControlException.class,
                () -> fixture.owner.start(fixture.startCommand(fixture.grant("CONTROL_PROJECT_TERMINAL"))));

        assertEquals(Failure.NOT_READY, failure.failure());
        verify(fixture.persistence).insertStart(any(StartRecord.class));
        verify(fixture.audit, never()).write(any());
        ArgumentCaptor<InvokeOnlineCommand> onlineCommand = ArgumentCaptor.forClass(InvokeOnlineCommand.class);
        verify(fixture.operations).invokeOnline(onlineCommand.capture());
        assertEquals("kernel.base.remote-control.start-remote-control", onlineCommand.getValue().commandName());
        Transactional transaction = TerminalRemoteControlOwnerService.class.getMethod("start", StartCommand.class)
                .getAnnotation(Transactional.class);
        assertNotNull(transaction);
        assertEquals(Propagation.REQUIRED, transaction.propagation(),
                "CONTRACT: staged session, online command and audit share the owner REQUIRED transaction");
    }

    private static final class Fixture {
        final TerminalRemoteControlPersistence persistence = mock(TerminalRemoteControlPersistence.class);
        final TerminalControlOwnerApi operations = mock(TerminalControlOwnerApi.class);
        final OrganizationTaskPathLookup organization = mock(OrganizationTaskPathLookup.class);
        final AuditEventWriter audit = mock(AuditEventWriter.class);
        final TimeProvider time = mock(TimeProvider.class);
        final LiveKitRemoteControlGrantSigner grants = mock(LiveKitRemoteControlGrantSigner.class);
        final WorkspaceCurrentAuthorizationLookup currentAuthorization = mock(WorkspaceCurrentAuthorizationLookup.class);
        final UUID requestId = UUID.randomUUID();
        final TerminalRemoteControlOwnerService owner = new TerminalRemoteControlOwnerService(
                persistence, operations, organization, audit, time, new ObjectMapper(), grants, currentAuthorization);

        Fixture() {
            when(organization.requireStoreProjectMemberships(WORKSPACE, GROUP, List.of(STORE)))
                    .thenReturn(Map.of(STORE, PROJECT));
            when(persistence.readCurrentActiveBinding(WORKSPACE, GROUP, TERMINAL))
                    .thenReturn(new BindingIdentity(WORKSPACE, STORE, 1, "device-1"));
            when(persistence.readOnlineTarget(WORKSPACE, GROUP, TERMINAL))
                    .thenReturn(new OnlineTarget("tds-node", "tds-session", 11));
            when(time.currentEpochMillis()).thenReturn(1_000L);
        }

        OperationsOwnerScopeGrant grant(String capability) {
            return grant("REQ_START_OPERATIONS_TERMINAL_REMOTE_CONTROL", capability);
        }

        OperationsOwnerScopeGrant grant(String requirement, String capability) {
            return new OperationsOwnerScopeGrant(WORKSPACE, GROUP,
                    requirement, capability, "PROJECT", PROJECT,
                    "PROJECT", PROJECT, List.of(PROJECT), 7);
        }

        StartCommand startCommand(OperationsOwnerScopeGrant grant) {
            return startCommand(grant, TERMINAL);
        }

        StartCommand startCommand(OperationsOwnerScopeGrant grant, UUID terminalRef) {
            return new StartCommand(WORKSPACE, GROUP, PROJECT, terminalRef, requestId, 7, ACCOUNT, ACTOR_SESSION,
                    AuditActor.system(), grant);
        }

        Verification credential() {
            return new Verification(Outcome.VERIFIED, WORKSPACE, GROUP, STORE, TERMINAL, 1, 100L, "device-1");
        }

        void prepareStartLookups(UUID previousSessionId, long previousSequence, long currentSequence) {
            when(persistence.readOnlineTarget(WORKSPACE, GROUP, TERMINAL))
                    .thenReturn(new OnlineTarget("tds-node", "tds-session", currentSequence));
            when(persistence.findActiveForTerminal(WORKSPACE, GROUP, TERMINAL, true)).thenReturn(null);
            if (previousSessionId != null) {
                when(persistence.findByRequest(WORKSPACE, ACCOUNT, requestId, true))
                        .thenReturn(session("STARTING", previousSequence, Instant.parse("2026-10-11T01:00:00Z"),
                                Instant.parse("2026-10-11T01:00:00Z")));
            }
        }

        RemoteSession session(String state, long targetSequence, Instant deadline, Instant leaseExpires) {
            return new RemoteSession(SESSION, WORKSPACE, GROUP, PROJECT, STORE, TERMINAL, 1, "device-1",
                    "tds-node", "tds-session", targetSequence, ACCOUNT, ACTOR_SESSION, requestId, UUID.randomUUID(),
                    "MOBILE_SINGLE", null, null, state, null, new ObjectMapper().createObjectNode(),
                    new ObjectMapper().createArrayNode(), Instant.parse("2026-10-11T00:59:00Z"), deadline,
                    leaseExpires, null);
        }
    }
}
