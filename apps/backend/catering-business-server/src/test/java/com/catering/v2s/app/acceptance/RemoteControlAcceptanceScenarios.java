package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/** Real HTTP and TDS-wire owner oracles for the remote-control session lifecycle. */
final class RemoteControlAcceptanceScenarios {
    private static final String PAGE = "PG-PROJECT-TERMINAL-VERSION-RULES";
    private static final String CAPABILITY = "CONTROL_PROJECT_TERMINAL";
    private static final ObjectMapper JSON = new ObjectMapper();
    private final BackendAcceptanceTest host;

    RemoteControlAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(
            id = "terminal.remote-control.session-http-lifecycle",
            module = "TERMINAL_REMOTE_CONTROL",
            operation = "terminalRemoteControlHttpLifecycle")
    void sessionLifecycleUsesLiveTdsAndRealHttpOwners(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreTerminalAcceptanceScenarios terminals = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture terminal =
                terminals.createConnectionContractFixture(context);
        TerminalConnectionContractScenarios.SessionProbe probe = null;
        StoreTerminalAcceptanceScenarios.ConnectionFixture otherOnlineTerminal = null;
        TerminalConnectionContractScenarios.SessionProbe otherProbe = null;
        TerminalConnectionContractScenarios.SessionProbe replacementProbe = null;
        StoreTerminalAcceptanceScenarios.ConnectionFixture offlineTerminal = null;
        List<UUID> pageFixtureTerminals = new ArrayList<>();
        UUID unboundTerminalRef = null;
        boolean fixtureCancelled = false;
        boolean otherFixtureCancelled = false;
        boolean offlineFixtureCancelled = false;
        boolean unboundFixtureDisabled = false;
        Throwable scenarioFailure = null;
        try {
            BackendAcceptanceTest.Fixture operatorFixture =
                    host.projectUserFixture(terminal.fixture(), Set.of(PAGE), Set.of(CAPABILITY));
            host.completeInvitation(context, operatorFixture);
            BackendAcceptanceTest.Session operator = host.login(context, operatorFixture);
            BackendAcceptanceTest.Fixture otherAccountFixture =
                    host.projectUserFixture(terminal.fixture(), Set.of(PAGE), Set.of(CAPABILITY));
            host.completeInvitation(context, otherAccountFixture);
            BackendAcceptanceTest.Session otherAccount = host.login(context, otherAccountFixture);
            UUID otherProjectRef = host.createSiblingProjectForAcceptance(terminal.fixture());
            BackendAcceptanceTest.Fixture otherProjectFixture = host.projectUserFixture(
                    terminal.fixture(), otherProjectRef, Set.of(PAGE), Set.of(CAPABILITY));
            host.completeInvitation(context, otherProjectFixture);
            BackendAcceptanceTest.Session otherProjectOperator = host.login(context, otherProjectFixture);

            TdsAcceptanceProcess tds = host.tdsAcceptanceProcess();
            assertNotNull(tds, "BUSINESS: managed TDS acceptance process is available");
            String markerId = UUID.randomUUID().toString();
            probe = TerminalConnectionContractScenarios.startRemoteControlAcceptanceSession(tds, terminal, markerId);
            otherOnlineTerminal = terminals.createConnectionContractFixture(context, terminal);
            otherProbe = TerminalConnectionContractScenarios.startRemoteControlAcceptanceSession(
                    tds, otherOnlineTerminal, UUID.randomUUID().toString());
            offlineTerminal = terminals.createConnectionContractFixture(
                    context, terminal, "TDS remote-control offline terminal");
            UUID offlineRequestId = UUID.randomUUID();
            String offlineStartPath = "/api/operations/group-workspaces/"
                    + offlineTerminal.fixture().groupWorkspaceKey() + "/projects/"
                    + offlineTerminal.fixture().projectId() + "/terminals/" + offlineTerminal.terminalRef()
                    + "/remote-control-sessions?expectedContextVersion=" + operator.contextVersion();
            BackendAcceptanceTest.Response offlineStart = context.postCoverageOnly(
                    OPERATIONS_REMOTE_CONTROL_START,
                    offlineStartPath,
                    operator.cookie(),
                    Map.of("requestId", offlineRequestId.toString()),
                    Set.of(409));
            assertEquals("TERMINAL_CONTROL_REMOTE_NOT_READY", offlineStart.problemCode(),
                    "BUSINESS: a disconnected binding is rejected before a remote session is committed");
            assertEquals(0, host.count("SELECT count(*) FROM terminal_control.remote_session WHERE request_id=?",
                    offlineRequestId), "BUSINESS: offline start leaves no half-created session");
            assertEquals(0, host.count("SELECT count(*) FROM terminal_control.online_operation WHERE request_id=?",
                    offlineRequestId), "BUSINESS: offline start creates no TDS operation");
            unboundTerminalRef = terminals.createUnboundEnabledTerminal(
                    context, terminal.fixture(), terminal.session(), "远程控制状态未激活终端");
            String versions = "/api/operations/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                    + "/projects/" + terminal.fixture().projectId() + "/terminal-versions";
            assertVersionProjection(context, operator, versions, terminal.terminalRef(), "ONLINE", true);
            assertVersionProjection(context, operator, versions, offlineTerminal.terminalRef(), "OFFLINE", false);
            assertVersionProjection(context, operator, versions, unboundTerminalRef, "NOT_ACTIVATED", false);
            verifyFiftyOneTerminalsAcrossRealHttpPages(
                    context, terminals, terminal, operator, versions, pageFixtureTerminals);
            String base = "/api/operations/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                    + "/projects/" + terminal.fixture().projectId()
                    + "/terminals/" + terminal.terminalRef() + "/remote-control-sessions";
            String startPath = base + "?expectedContextVersion=" + operator.contextVersion();
            UUID requestA = UUID.randomUUID();
            UUID requestB = UUID.randomUUID();
            List<BackendAcceptanceTest.Response> concurrentStarts = concurrently(
                    () -> context.postCoverageOnly(OPERATIONS_REMOTE_CONTROL_START, startPath, operator.cookie(),
                            Map.of("requestId", requestA.toString()), Set.of(201, 409)),
                    () -> context.postCoverageOnly(OPERATIONS_REMOTE_CONTROL_START, startPath, operator.cookie(),
                            Map.of("requestId", requestB.toString()), Set.of(201, 409)));
            assertEquals(1, concurrentStarts.stream().filter(response -> response.status() == 201).count(),
                    "BUSINESS: distinct concurrent starts on an unoccupied terminal have one winner");
            assertEquals(1, concurrentStarts.stream().filter(response -> response.status() == 409).count(),
                    "BUSINESS: distinct concurrent starts on an unoccupied terminal have one occupied loser");
            int winnerIndex = concurrentStarts.getFirst().status() == 201 ? 0 : 1;
            UUID requestId = winnerIndex == 0 ? requestA : requestB;
            UUID losingRequestId = winnerIndex == 0 ? requestB : requestA;
            BackendAcceptanceTest.Response started = concurrentStarts.get(winnerIndex);
            BackendAcceptanceTest.Response occupied = concurrentStarts.get(1 - winnerIndex);
            assertEquals("TERMINAL_CONTROL_REMOTE_OCCUPIED", occupied.problemCode(),
                    "BUSINESS: the losing distinct request is rejected as occupied");
            assertCredentialAbsent(started, terminal.credentialSecret(), "start");
            JsonNode start = started.json();
            UUID sessionId = UUID.fromString(start.path("sessionId").asText());
            UUID startOperationId = UUID.fromString(start.path("startOperationId").asText());
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE workspace_uuid=? AND request_id=?", terminal.fixture().workspaceUuid(), requestId),
                    "BUSINESS: winning request persists one session");
            assertEquals(0, host.count("SELECT count(*) FROM terminal_control.remote_session WHERE request_id=?",
                    losingRequestId), "BUSINESS: losing request leaves no half-created session");
            assertEquals("STARTING", start.path("state").asText(),
                    "BUSINESS: operations start persists a STARTING session before endpoint registration");
            assertEquals("rc_" + sessionId, start.path("roomName").asText());
            assertTrue(start.path("description").isNull(),
                    "BUSINESS: terminal topology is assigned by the authenticated terminal registration");
            assertEquals(1, host.count(
                    "SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE session_id=? AND request_id=? AND state='STARTING' "
                            + "AND target_session_id=? AND start_operation_id=?",
                    sessionId, requestId, probe.sessionId(), startOperationId));

            List<BackendAcceptanceTest.Response> concurrentReplays = concurrently(
                    () -> context.postCoverageOnly(OPERATIONS_REMOTE_CONTROL_START, startPath, operator.cookie(),
                            Map.of("requestId", requestId.toString()), Set.of(201)),
                    () -> context.postCoverageOnly(OPERATIONS_REMOTE_CONTROL_START, startPath, operator.cookie(),
                            Map.of("requestId", requestId.toString()), Set.of(201)));
            for (BackendAcceptanceTest.Response replayResponse : concurrentReplays) {
                assertEquals(sessionId, UUID.fromString(replayResponse.json().path("sessionId").asText()),
                        "BUSINESS: same-request replay returns the committed session");
                assertEquals(startOperationId,
                        UUID.fromString(replayResponse.json().path("startOperationId").asText()),
                        "BUSINESS: replay keeps the original online command");
            }
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.online_operation WHERE operation_id=?",
                    startOperationId), "BUSINESS: same-request replay creates one TDS operation");

            tds.awaitLogMarker(
                    "event=tds_remote_operation_claim_disposition operationId=" + startOperationId,
                    "disposition=DISPATCHED",
                    Duration.ofSeconds(8),
                    "REMOTE_CONTROL_START_COMMAND_NOT_DISPATCHED_TO_LIVE_TDS_SESSION");
            TerminalControlOwnerApi.OperationView startOperation = host
                    .acceptanceBean(TerminalControlOwnerApi.class)
                    .readOperation(startOperationId);
            assertNotNull(startOperation, "BUSINESS: online command owner can read back the queued start operation");
            assertEquals(requestId, startOperation.requestId());
            assertEquals("kernel.base.remote-control.start-remote-control", startOperation.commandName());
            assertEquals(probe.sessionId(), startOperation.targetSessionId());
            assertEquals("terminal-data-server", startOperation.targetNodeId());

            String otherTargetPath = "/api/operations/group-workspaces/"
                    + otherOnlineTerminal.fixture().groupWorkspaceKey() + "/projects/"
                    + otherOnlineTerminal.fixture().projectId() + "/terminals/"
                    + otherOnlineTerminal.terminalRef() + "/remote-control-sessions?expectedContextVersion="
                    + operator.contextVersion();
            BackendAcceptanceTest.Response differentTargetReplay = context.postCoverageOnly(
                    OPERATIONS_REMOTE_CONTROL_START,
                    otherTargetPath,
                    operator.cookie(),
                    Map.of("requestId", requestId.toString()),
                    Set.of(409));
            assertEquals("TERMINAL_CONTROL_REMOTE_IDENTITY_CONFLICT", differentTargetReplay.problemCode(),
                    "BUSINESS: a request replay cannot move to another online terminal");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session WHERE request_id=?",
                    requestId), "BUSINESS: conflicting target replay preserves only the original session");
            assertEquals(0, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE terminal_ref=? AND request_id=?",
                    otherOnlineTerminal.terminalRef(), requestId),
                    "BUSINESS: conflicting target replay creates no session for the second terminal");
            assertEquals(0, host.count("SELECT count(*) FROM terminal_control.online_operation "
                            + "WHERE terminal_ref=? AND request_id=?",
                    otherOnlineTerminal.terminalRef(), requestId),
                    "BUSINESS: conflicting target replay creates no second TDS operation");

            String terminalBase = "/api/terminal/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                    + "/remote-control-sessions/" + sessionId;
            Map<String, String> terminalHeaders = Map.of(
                    "Authorization", "Terminal " + terminal.generation() + "." + terminal.credentialSecret(),
                    "X-Terminal-Ref", terminal.terminalRef().toString());
            Map<String, Object> registerBody = new LinkedHashMap<>();
            registerBody.put("sessionId", sessionId.toString());
            registerBody.put("topologyKind", "MOBILE_SINGLE");
            registerBody.put("peerIdentity", null);
            Map<String, String> invalidTerminalHeaders = Map.of(
                    "Authorization", "Terminal " + terminal.generation() + "." + changedSecret(terminal.credentialSecret()),
                    "X-Terminal-Ref", terminal.terminalRef().toString());
            BackendAcceptanceTest.Response invalidRegistration = context.post(
                    TERMINAL_REMOTE_CONTROL_REGISTER,
                    terminalBase + "/registration",
                    null,
                    registerBody,
                    invalidTerminalHeaders,
                    Set.of(403));
            assertEquals("TERMINAL_BINDING_CREDENTIAL_INVALID", invalidRegistration.problemCode(),
                    "BUSINESS: invalid terminal credential is rejected before session registration");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE session_id=? AND description_json IS NULL",
                    sessionId), "BUSINESS: invalid registration does not write a session description");
            BackendAcceptanceTest.Response registered = context.post(
                    TERMINAL_REMOTE_CONTROL_REGISTER,
                    terminalBase + "/registration",
                    null,
                    registerBody,
                    terminalHeaders,
                    Set.of(200));
            assertCredentialAbsent(registered, terminal.credentialSecret(), "registration");
            JsonNode description = registered.json().path("description");
            assertEquals(sessionId.toString(), description.path("sessionId").asText());
            assertEquals("MOBILE_SINGLE", description.path("topologyKind").asText());
            assertEquals(1, description.path("endpoints").size());
            assertEquals(1, description.path("screens").size());
            assertEquals(1, registered.json().path("grants").size());
            BackendAcceptanceTest.Response registrationReplay = context.post(
                    TERMINAL_REMOTE_CONTROL_REGISTER,
                    terminalBase + "/registration",
                    null,
                    registerBody,
                    terminalHeaders,
                    Set.of(200));
            assertEquals(description, registrationReplay.json().path("description"),
                    "BUSINESS: replaying the same endpoint descriptor returns the frozen description");
            assertEquals(1, registrationReplay.json().path("grants").size(),
                    "BUSINESS: idempotent single-screen registration returns exactly one endpoint grant");
            Map<String, Object> conflictingRegisterBody = new LinkedHashMap<>(registerBody);
            conflictingRegisterBody.put("topologyKind", "LAPTOP_SINGLE");
            BackendAcceptanceTest.Response conflictingRegistration = context.post(
                    TERMINAL_REMOTE_CONTROL_REGISTER,
                    terminalBase + "/registration",
                    null,
                    conflictingRegisterBody,
                    terminalHeaders,
                    Set.of(409));
            assertEquals("TERMINAL_CONTROL_REMOTE_IDENTITY_CONFLICT", conflictingRegistration.problemCode(),
                    "BUSINESS: a changed topology cannot replace the registered endpoint descriptor");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE session_id=? AND topology_kind='MOBILE_SINGLE'",
                    sessionId), "BUSINESS: descriptor conflict preserves the original topology");

            List<Map<String, Object>> readyScreens = readyScreens(description);
            Map<String, Object> reportBody = new LinkedHashMap<>();
            reportBody.put("sessionId", sessionId.toString());
            reportBody.put("state", "ACTIVE");
            reportBody.put("reason", null);
            reportBody.put("readyScreens", readyScreens);
            BackendAcceptanceTest.Response active = context.post(
                    TERMINAL_REMOTE_CONTROL_REPORT,
                    terminalBase + "/status",
                    null,
                    reportBody,
                    terminalHeaders,
                    Set.of(200));
            assertCredentialAbsent(active, terminal.credentialSecret(), "status-report");
            assertEquals("ACTIVE", active.json().path("state").asText());
            assertEquals(sessionId.toString(), active.json().path("sessionId").asText());
            assertTrue(active.json().path("remainingLeaseMs").asLong() > 0);

            String sessionPath = base + "/" + sessionId;
            long grantRequestStartedAtMillis = System.currentTimeMillis();
            BackendAcceptanceTest.Response grant = context.postNoBody(
                    OPERATIONS_REMOTE_CONTROL_GRANT,
                    sessionPath + "/controller-grant?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Set.of(200));
            assertCredentialAbsent(grant, terminal.credentialSecret(), "controller-grant");
            assertEquals(start.path("roomName").asText(), grant.json().path("roomName").asText());
            assertEquals(start.path("controllerIdentity").asText(), grant.json().path("participantIdentity").asText());
            assertTrue(grant.json().path("token").isTextual() && !grant.json().path("token").asText().isBlank(),
                    "BUSINESS: controller receives a scoped short-lived grant");
            assertTrue(Set.of("ws", "wss").contains(URI.create(grant.json().path("url").asText()).getScheme()),
                    "BUSINESS: controller grant returns the configured WebSocket signal URL");
            assertControllerTokenScope(grant.json().path("token").asText(),
                    grant.json().path("participantIdentity").asText(), grant.json().path("roomName").asText(),
                    grantRequestStartedAtMillis);

            BackendAcceptanceTest.Response read = context.get(
                    OPERATIONS_REMOTE_CONTROL_READ,
                    sessionPath + "?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Set.of(200));
            assertCredentialAbsent(read, terminal.credentialSecret(), "read");
            assertEquals("ACTIVE", read.json().path("state").asText());
            assertEquals(description.path("roomName").asText(), read.json().path("description").path("roomName").asText());

            BackendAcceptanceTest.Response scopedRead = context.get(
                    OPERATIONS_REMOTE_CONTROL_READ,
                    sessionPath + "?expectedContextVersion=" + otherAccount.contextVersion(),
                    otherAccount.cookie(),
                    Set.of(404));
            assertEquals("PLATFORM_COMMON_RESOURCE_NOT_FOUND", scopedRead.problemCode(),
                    "BUSINESS: another project account cannot discover the session");
            BackendAcceptanceTest.Response scopedGrant = context.postNoBody(
                    OPERATIONS_REMOTE_CONTROL_GRANT,
                    sessionPath + "/controller-grant?expectedContextVersion=" + otherAccount.contextVersion(),
                    otherAccount.cookie(),
                    Set.of(404));
            assertEquals("PLATFORM_COMMON_RESOURCE_NOT_FOUND", scopedGrant.problemCode(),
                    "BUSINESS: another project account cannot receive a controller grant");
            assertFalse(scopedGrant.raw().contains("\"token\""),
                    "CONTRACT: out-of-scope grant response contains no token");

            String otherProjectPath = "/api/operations/group-workspaces/" + terminal.fixture().groupWorkspaceKey()
                    + "/projects/" + otherProjectRef + "/terminals/" + terminal.terminalRef()
                    + "/remote-control-sessions/" + sessionId;
            BackendAcceptanceTest.Response otherProjectRead = context.get(
                    OPERATIONS_REMOTE_CONTROL_READ,
                    otherProjectPath + "?expectedContextVersion=" + otherProjectOperator.contextVersion(),
                    otherProjectOperator.cookie(),
                    Set.of(404));
            assertEquals("PLATFORM_COMMON_RESOURCE_NOT_FOUND", otherProjectRead.problemCode(),
                    "BUSINESS: a separately authorized project cannot read another project's session");
            assertFalse(otherProjectRead.raw().contains(description.path("roomName").asText()),
                    "CONTRACT: cross-project read does not expose the remote room");
            BackendAcceptanceTest.Response otherProjectGrant = context.postNoBody(
                    OPERATIONS_REMOTE_CONTROL_GRANT,
                    otherProjectPath + "/controller-grant?expectedContextVersion="
                            + otherProjectOperator.contextVersion(),
                    otherProjectOperator.cookie(),
                    Set.of(404));
            assertEquals("PLATFORM_COMMON_RESOURCE_NOT_FOUND", otherProjectGrant.problemCode(),
                    "BUSINESS: a separately authorized project cannot obtain another project's grant");
            assertFalse(otherProjectGrant.raw().contains("\"token\""),
                    "CONTRACT: cross-project grant response contains no token");

            assertEquals(Set.of(), host.replaceProjectUserCapabilitiesForAcceptance(operatorFixture, Set.of())
                            .actionCapabilityKeys(),
                    "BUSINESS: acceptance removes only the controller's project write capability");
            BackendAcceptanceTest.Response revokedRead = context.get(
                    OPERATIONS_REMOTE_CONTROL_READ,
                    sessionPath + "?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Set.of(200));
            assertEquals("ACTIVE", revokedRead.json().path("state").asText(),
                    "BUSINESS: removing the write capability preserves read access to the caller's session");
            BackendAcceptanceTest.Response revokedReplay = context.postCoverageOnly(
                    OPERATIONS_REMOTE_CONTROL_START,
                    startPath,
                    operator.cookie(),
                    Map.of("requestId", requestId.toString()),
                    Set.of(403));
            assertEquals("PLATFORM_COMMON_ACCESS_DENIED", revokedReplay.problemCode(),
                    "BUSINESS: live authorization is checked before same-request replay");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session WHERE request_id=?",
                    requestId), "BUSINESS: revoked replay does not create or replace a session");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.online_operation WHERE operation_id=?",
                    startOperationId), "BUSINESS: revoked replay does not dispatch another TDS operation");
            BackendAcceptanceTest.Response revokedGrant = context.postNoBody(
                    OPERATIONS_REMOTE_CONTROL_GRANT,
                    sessionPath + "/controller-grant?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Set.of(403));
            assertEquals("PLATFORM_COMMON_ACCESS_DENIED", revokedGrant.problemCode(),
                    "BUSINESS: a revoked controller cannot obtain or renew a LiveKit grant");
            assertFalse(revokedGrant.raw().contains("\"token\""),
                    "CONTRACT: revoked grant response contains no token");
            assertTrue(host.replaceProjectUserCapabilitiesForAcceptance(operatorFixture, Set.of(CAPABILITY))
                            .actionCapabilityKeys().contains(CAPABILITY),
                    "BUSINESS: acceptance restores only its own fixture role for remaining lifecycle checks");

            replacementProbe = TerminalConnectionContractScenarios.startRemoteControlAcceptanceSession(
                    tds, terminal, UUID.randomUUID().toString());
            BackendAcceptanceTest.Response staleSequenceReport = context.post(
                    TERMINAL_REMOTE_CONTROL_REPORT,
                    terminalBase + "/status",
                    null,
                    reportBody,
                    terminalHeaders,
                    Set.of(409));
            assertEquals("TERMINAL_CONTROL_REMOTE_IDENTITY_CONFLICT", staleSequenceReport.problemCode(),
                    "BUSINESS: a status report from a replaced TDS sequence is rejected");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE session_id=? AND state='ACTIVE'",
                    sessionId), "BUSINESS: stale TDS report cannot change the current remote session state");
            replacementProbe.stop();
            replacementProbe = null;

            BackendAcceptanceTest.Response ended = context.post(
                    OPERATIONS_REMOTE_CONTROL_END,
                    sessionPath + "/end?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Map.of("reason", "ADMIN_ENDED"),
                    Set.of(200));
            assertCredentialAbsent(ended, terminal.credentialSecret(), "end");
            BackendAcceptanceTest.Response endReplay = context.post(
                    OPERATIONS_REMOTE_CONTROL_END,
                    sessionPath + "/end?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Map.of("reason", "ADMIN_ENDED"),
                    Set.of(200));
            assertCredentialAbsent(endReplay, terminal.credentialSecret(), "end-replay");
            assertEquals("ENDED", ended.json().path("state").asText());
            assertEquals("ADMIN_ENDED", ended.json().path("reason").asText());
            assertEquals(ended.json().path("endedAtEpochMillis").asLong(),
                    endReplay.json().path("endedAtEpochMillis").asLong(),
                    "BUSINESS: repeated end reads back the same committed terminal fact");
            BackendAcceptanceTest.Response afterEnd = context.get(
                    OPERATIONS_REMOTE_CONTROL_READ,
                    sessionPath + "?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Set.of(200));
            assertCredentialAbsent(afterEnd, terminal.credentialSecret(), "read-after-end");
            assertEquals("ENDED", afterEnd.json().path("state").asText());

            BackendAcceptanceTest.Response audit = context.get(
                    OPERATIONS_AUDIT_HISTORY,
                    "/api/operations/audit-history?groupWorkspaceKey=" + terminal.fixture().groupWorkspaceKey()
                            + "&entityType=TERMINAL_REMOTE_CONTROL_SESSION&entityId=" + sessionId
                            + "&projectRef=" + terminal.fixture().projectId() + "&page=1&pageSize=20",
                    operator.cookie(),
                    Set.of(200));
            assertCredentialAbsent(audit, terminal.credentialSecret(), "audit");
            assertEquals(2, audit.json().path("items").size(),
                    "BUSINESS: owner audit exposes one START and one END event");
            assertEquals(1, countAction(audit.json().path("items"), "START"));
            assertEquals(1, countAction(audit.json().path("items"), "END"));

            UUID dualRequestId = UUID.randomUUID();
            String dualStartPath = "/api/operations/group-workspaces/"
                    + otherOnlineTerminal.fixture().groupWorkspaceKey() + "/projects/"
                    + otherOnlineTerminal.fixture().projectId() + "/terminals/" + otherOnlineTerminal.terminalRef()
                    + "/remote-control-sessions?expectedContextVersion=" + operator.contextVersion();
            BackendAcceptanceTest.Response dualStarted = context.postCoverageOnly(
                    OPERATIONS_REMOTE_CONTROL_START,
                    dualStartPath,
                    operator.cookie(),
                    Map.of("requestId", dualRequestId.toString()),
                    Set.of(201));
            UUID dualSessionId = UUID.fromString(dualStarted.json().path("sessionId").asText());
            UUID dualStartOperationId = UUID.fromString(dualStarted.json().path("startOperationId").asText());
            String dualSessionPath = dualStartPath.substring(0, dualStartPath.indexOf('?')) + "/" + dualSessionId;
            String dualTerminalBase = "/api/terminal/group-workspaces/"
                    + otherOnlineTerminal.fixture().groupWorkspaceKey() + "/remote-control-sessions/" + dualSessionId;
            Map<String, String> dualTerminalHeaders = Map.of(
                    "Authorization", "Terminal " + otherOnlineTerminal.generation() + "."
                            + otherOnlineTerminal.credentialSecret(),
                    "X-Terminal-Ref", otherOnlineTerminal.terminalRef().toString());
            Map<String, Object> dualRegisterBody = new LinkedHashMap<>();
            dualRegisterBody.put("sessionId", dualSessionId.toString());
            dualRegisterBody.put("topologyKind", "LAPTOP_DUAL");
            dualRegisterBody.put("peerIdentity", null);
            BackendAcceptanceTest.Response dualRegistered = context.post(
                    TERMINAL_REMOTE_CONTROL_REGISTER,
                    dualTerminalBase + "/registration",
                    null,
                    dualRegisterBody,
                    dualTerminalHeaders,
                    Set.of(200));
            JsonNode dualDescription = dualRegistered.json().path("description");
            assertEquals(1, dualDescription.path("endpoints").size(),
                    "BUSINESS: same-device dual-screen registration creates one endpoint");
            assertEquals(2, dualDescription.path("screens").size(),
                    "BUSINESS: same-device dual-screen registration creates two screen slots");
            String dualMasterEndpointId = dualDescription.path("masterEndpointId").asText();
            assertEquals(dualMasterEndpointId, dualDescription.path("endpoints").get(0).path("endpointId").asText(),
                    "BUSINESS: the same-device endpoint is the master publisher");
            assertEquals(dualMasterEndpointId, dualDescription.path("screens").get(0).path("endpointId").asText(),
                    "BUSINESS: main screen maps to the master endpoint");
            assertEquals(dualMasterEndpointId, dualDescription.path("screens").get(1).path("endpointId").asText(),
                    "BUSINESS: secondary screen maps to the same master endpoint");
            assertEquals(1, dualRegistered.json().path("grants").size(),
                    "BUSINESS: dual-screen registration returns one grant for its one endpoint");
            BackendAcceptanceTest.Response dualReplay = context.post(
                    TERMINAL_REMOTE_CONTROL_REGISTER,
                    dualTerminalBase + "/registration",
                    null,
                    dualRegisterBody,
                    dualTerminalHeaders,
                    Set.of(200));
            assertEquals(dualDescription, dualReplay.json().path("description"),
                    "BUSINESS: replaying the dual-screen descriptor keeps the frozen endpoint mapping");
            assertEquals(1, dualReplay.json().path("grants").size(),
                    "BUSINESS: dual-screen replay returns one grant for its one endpoint");
            List<Map<String, Object>> dualReadyScreens = readyScreens(dualDescription);
            Map<String, Object> dualReportBody = new LinkedHashMap<>();
            dualReportBody.put("sessionId", dualSessionId.toString());
            dualReportBody.put("state", "ACTIVE");
            dualReportBody.put("reason", null);
            dualReportBody.put("readyScreens", dualReadyScreens);
            BackendAcceptanceTest.Response dualActive = context.post(
                    TERMINAL_REMOTE_CONTROL_REPORT,
                    dualTerminalBase + "/status",
                    null,
                    dualReportBody,
                    dualTerminalHeaders,
                    Set.of(200));
            assertEquals("ACTIVE", dualActive.json().path("state").asText(),
                    "BUSINESS: both declared screen slots allow the session to become active");
            JsonNode persistedDualReadyScreens = JSON.readTree(host.text(
                    "SELECT ready_screens_json::text FROM terminal_control.remote_session WHERE session_id=?",
                    dualSessionId));
            assertEquals(JSON.valueToTree(dualReadyScreens), persistedDualReadyScreens,
                    "BUSINESS: active report commits both screen slots and their stream identities");

            assertEquals(1, host.update("UPDATE terminal_control.remote_session "
                            + "SET lease_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE session_id=?",
                    dualSessionId), "BUSINESS: acceptance advances only its own session to an expired lease");
            BackendAcceptanceTest.Response expiredGrant = context.postNoBody(
                    OPERATIONS_REMOTE_CONTROL_GRANT,
                    dualSessionPath + "/controller-grant?expectedContextVersion=" + operator.contextVersion(),
                    operator.cookie(),
                    Set.of(410));
            assertEquals("TERMINAL_CONTROL_REMOTE_SESSION_ENDED", expiredGrant.problemCode(),
                    "BUSINESS: an expired session cannot mint a new controller grant");
            assertFalse(expiredGrant.raw().contains("\"token\""),
                    "CONTRACT: expired controller-grant response contains no token");
            BackendAcceptanceTest.Response expiredReport = context.post(
                    TERMINAL_REMOTE_CONTROL_REPORT,
                    dualTerminalBase + "/status",
                    null,
                    dualReportBody,
                    dualTerminalHeaders,
                    Set.of(410));
            assertEquals("TERMINAL_CONTROL_REMOTE_SESSION_ENDED", expiredReport.problemCode(),
                    "BUSINESS: an expired session cannot be revived by a terminal status report");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE session_id=? AND lease_expires_at<=clock_timestamp()",
                    dualSessionId), "BUSINESS: expired lease remains expired after rejected grant and report");
            BackendAcceptanceTest.Response expiredStartReplay = context.postCoverageOnly(
                    OPERATIONS_REMOTE_CONTROL_START,
                    dualStartPath,
                    operator.cookie(),
                    Map.of("requestId", dualRequestId.toString()),
                    Set.of(201));
            assertEquals(dualSessionId, UUID.fromString(expiredStartReplay.json().path("sessionId").asText()),
                    "BUSINESS: replay after expiry returns the original session");
            assertEquals("ENDED", expiredStartReplay.json().path("state").asText(),
                    "BUSINESS: replay after expiry does not revive the session");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.remote_session "
                            + "WHERE session_id=? AND state='ENDED' AND reason='LEASE_EXPIRED' "
                            + "AND ended_at=lease_expires_at",
                    dualSessionId), "BUSINESS: ACTIVE expiry persists endedAt from leaseExpiresAt");
            assertEquals(1, host.count("SELECT count(*) FROM terminal_control.online_operation WHERE operation_id=?",
                    dualStartOperationId), "BUSINESS: expired replay does not dispatch another TDS operation");
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            try {
                if (replacementProbe != null) replacementProbe.stop();
            } catch (Exception failure) {
                cleanupFailure = failure;
            }
            try {
                if (otherProbe != null) otherProbe.stop();
            } catch (Exception failure) {
                cleanupFailure = failure;
            }
            try {
                if (probe != null) probe.stop();
            } catch (Exception failure) {
                if (cleanupFailure == null) cleanupFailure = failure;
                else cleanupFailure.addSuppressed(failure);
            }
            try {
                terminals.performConnectionRevocation(
                        context, terminal, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                terminals.assertConnectionFixtureInactive(context, terminal);
                fixtureCancelled = true;
            } catch (Exception failure) {
                if (cleanupFailure == null) cleanupFailure = failure;
                else cleanupFailure.addSuppressed(failure);
            }
            if (offlineTerminal != null) {
                try {
                    terminals.performConnectionRevocation(context, offlineTerminal,
                            StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                    terminals.assertConnectionFixtureInactive(context, offlineTerminal);
                    offlineFixtureCancelled = true;
                } catch (Exception failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
            if (otherOnlineTerminal != null) {
                try {
                    terminals.performConnectionRevocation(context, otherOnlineTerminal,
                            StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                    terminals.assertConnectionFixtureInactive(context, otherOnlineTerminal);
                    otherFixtureCancelled = true;
                } catch (Exception failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
            if (unboundTerminalRef != null) {
                try {
                    terminals.disableTerminal(context, terminal.fixture(), terminal.session(), unboundTerminalRef);
                    unboundFixtureDisabled = true;
                } catch (Exception failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
            if (!fixtureCancelled && cleanupFailure == null)
                cleanupFailure = new IllegalStateException("REMOTE_CONTROL_TERMINAL_FIXTURE_NOT_CANCELLED");
            if (otherOnlineTerminal != null && !otherFixtureCancelled && cleanupFailure == null)
                cleanupFailure = new IllegalStateException("REMOTE_CONTROL_OTHER_TERMINAL_FIXTURE_NOT_CANCELLED");
            if (offlineTerminal != null && !offlineFixtureCancelled && cleanupFailure == null)
                cleanupFailure = new IllegalStateException("REMOTE_CONTROL_OFFLINE_FIXTURE_NOT_CANCELLED");
            if (unboundTerminalRef != null && !unboundFixtureDisabled && cleanupFailure == null)
                cleanupFailure = new IllegalStateException("REMOTE_CONTROL_UNBOUND_FIXTURE_NOT_DISABLED");
            if (cleanupFailure != null) {
                if (scenarioFailure != null) scenarioFailure.addSuppressed(cleanupFailure);
                else if (cleanupFailure instanceof Exception exception) throw exception;
                else throw (Error) cleanupFailure;
            }
        }
    }

    private static void assertVersionProjection(BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Session operator, String versionsPath, UUID terminalRef, String expectedStatus,
            boolean expectObservedAt) throws Exception {
        String query = "?expectedContextVersion=" + operator.contextVersion() + "&limit=100";
        JsonNode page = payload(context.get(OPERATIONS_TERMINAL_VERSION_PAGE, versionsPath + query,
                operator.cookie(), Set.of(200)).json());
        JsonNode row = null;
        for (JsonNode item : page.path("items")) {
            if (terminalRef.toString().equals(item.path("terminalRef").asText())) row = item;
        }
        assertNotNull(row, "BUSINESS: version page contains its eligible fixture terminal");
        assertConnectionProjection(row, expectedStatus, expectObservedAt, "page");

        JsonNode detail = payload(context.get(OPERATIONS_TERMINAL_VERSION_DETAIL,
                versionsPath + "/" + terminalRef + "?expectedContextVersion=" + operator.contextVersion(),
                operator.cookie(), Set.of(200)).json());
        assertConnectionProjection(detail, expectedStatus, expectObservedAt, "detail");
    }

    private static void verifyFiftyOneTerminalsAcrossRealHttpPages(
            BackendAcceptanceTest.ScenarioContext context,
            StoreTerminalAcceptanceScenarios terminals,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            BackendAcceptanceTest.Session operator,
            String versionsPath,
            List<UUID> pageFixtureTerminals) throws Exception {
        for (int index = 1; index <= 51; index++) {
            pageFixtureTerminals.add(terminals.createUnboundEnabledTerminalForCoverage(
                    context, fixture.fixture(), fixture.session(), "remote-control-page-%02d".formatted(index)));
        }

        String baseQuery = "?expectedContextVersion=" + operator.contextVersion()
                + "&queryText=" + URLEncoder.encode("remote-control-page-", StandardCharsets.UTF_8)
                + "&limit=50";
        JsonNode firstPage = payload(context.get(OPERATIONS_TERMINAL_VERSION_PAGE,
                versionsPath + baseQuery, operator.cookie(), Set.of(200)).json());
        assertEquals(50, firstPage.path("items").size(),
                "BUSINESS: real HTTP page returns the first fifty matching terminals");
        assertTrue(firstPage.path("nextCursor").isTextual() && !firstPage.path("nextCursor").asText().isBlank(),
                "BUSINESS: first real HTTP page exposes its continuation cursor");

        String cursor = URLEncoder.encode(firstPage.path("nextCursor").asText(), StandardCharsets.UTF_8);
        JsonNode secondPage = payload(context.get(OPERATIONS_TERMINAL_VERSION_PAGE,
                versionsPath + baseQuery + "&cursor=" + cursor, operator.cookie(), Set.of(200)).json());
        assertEquals(1, secondPage.path("items").size(),
                "BUSINESS: real HTTP cursor page returns the final matching terminal");
        assertTrue(secondPage.path("nextCursor").isNull(),
                "BUSINESS: final real HTTP page has no further cursor");

        Set<String> observed = new java.util.LinkedHashSet<>();
        for (JsonNode page : List.of(firstPage, secondPage)) {
            for (JsonNode item : page.path("items")) {
                assertEquals("NOT_ACTIVATED", item.path("connectionStatus").asText(),
                        "BUSINESS: unbound terminal page row keeps its owner-derived status");
                observed.add(item.path("terminalRef").asText());
            }
        }
        Set<String> expected = pageFixtureTerminals.stream().map(UUID::toString)
                .collect(java.util.stream.Collectors.toSet());
        assertEquals(51, observed.size(), "BUSINESS: HTTP cursor pages do not duplicate terminals");
        assertEquals(expected, observed, "BUSINESS: HTTP cursor pages return all and only the 51 fixtures");
    }

    private static void assertConnectionProjection(JsonNode value, String expectedStatus,
            boolean expectObservedAt, String surface) {
        assertEquals(expectedStatus, value.path("connectionStatus").asText(),
                "BUSINESS: " + surface + " exposes the owner-derived connection state");
        assertTrue(value.path("evaluatedAt").isTextual() && !value.path("evaluatedAt").asText().isBlank(),
                "BUSINESS: " + surface + " includes the evaluation timestamp");
        if (expectObservedAt) {
            assertTrue(value.path("observedAt").isTextual() && !value.path("observedAt").asText().isBlank(),
                    "BUSINESS: " + surface + " includes the latest connection observation");
        } else {
            assertTrue(value.path("observedAt").isNull(),
                    "BUSINESS: " + surface + " has no observedAt without a TDS session");
        }
    }

    private static JsonNode payload(JsonNode body) {
        return body.has("result") ? body.path("result") : body;
    }

    private static List<Map<String, Object>> readyScreens(JsonNode description) {
        List<Map<String, Object>> readyScreens = new ArrayList<>();
        for (JsonNode screen : description.path("screens")) {
            readyScreens.add(Map.of(
                    "endpointId", screen.path("endpointId").asText(),
                    "screen", screen.path("screen").asText(),
                    "streamId", UUID.randomUUID().toString(),
                    "trackSid", "TR_ACCEPTANCE_" + UUID.randomUUID().toString().replace("-", "")));
        }
        return readyScreens;
    }

    private static void assertControllerTokenScope(
            String token, String expectedIdentity, String expectedRoom, long grantRequestStartedAtMillis)
            throws Exception {
        String[] parts = token.split("\\.", -1);
        assertEquals(3, parts.length, "CONTRACT: controller token is a JWT with three encoded segments");
        JsonNode payload = JSON.readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertEquals(expectedIdentity, payload.path("sub").asText(),
                "BUSINESS: controller token subject matches the issued participant identity");
        JsonNode video = payload.path("video");
        assertTrue(video.path("roomJoin").asBoolean(), "BUSINESS: controller token may join its remote room");
        assertEquals(expectedRoom, video.path("room").asText(),
                "BUSINESS: controller token is scoped to the issued room");
        assertTrue(video.path("canSubscribe").asBoolean(), "BUSINESS: controller token can subscribe to screen video");
        assertTrue(video.path("canPublishData").asBoolean(), "BUSINESS: controller token can publish control data");
        assertTrue(video.has("canPublish") && !video.path("canPublish").asBoolean(),
                "BUSINESS: controller token explicitly denies media publishing");
        assertTrue(!video.path("canPublishSources").isArray() || video.path("canPublishSources").size() == 0,
                "BUSINESS: controller token grants no camera, microphone, or screen source");
        long expiresAt = payload.path("exp").asLong();
        long expiresAtMillis = expiresAt * 1_000L;
        long nowMillis = System.currentTimeMillis();
        long ttlFromRequestMillis = expiresAtMillis - grantRequestStartedAtMillis;
        assertTrue(ttlFromRequestMillis > 25_000 && ttlFromRequestMillis <= 30_000,
                "BUSINESS: controller token lifetime remains the configured short interval");
        assertTrue(expiresAtMillis > nowMillis,
                "BUSINESS: controller token has not expired at issuance");
    }

    private static String changedSecret(String secret) {
        assertTrue(secret != null && !secret.isBlank(), "CONTRACT: fixture credential secret is present");
        char first = secret.charAt(0);
        return (first == 'A' ? 'B' : 'A') + secret.substring(1);
    }

    private static void assertCredentialAbsent(
            BackendAcceptanceTest.Response response, String credentialSecret, String exchange) {
        assertFalse(response.raw().contains(credentialSecret),
                "CONTRACT: terminal credential secret is absent from " + exchange + " response");
    }

    private static List<BackendAcceptanceTest.Response> concurrently(Callable<BackendAcceptanceTest.Response> first,
            Callable<BackendAcceptanceTest.Response> second) throws Exception {
        ExecutorService workers = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        Future<BackendAcceptanceTest.Response> firstResult = workers.submit(() -> {
            ready.countDown();
            if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("REMOTE_CONTROL_START_GATE_TIMEOUT");
            return first.call();
        });
        Future<BackendAcceptanceTest.Response> secondResult = workers.submit(() -> {
            ready.countDown();
            if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("REMOTE_CONTROL_START_GATE_TIMEOUT");
            return second.call();
        });
        try {
            assertTrue(ready.await(5, TimeUnit.SECONDS), "CLEANUP: both acceptance workers reach the start gate");
            release.countDown();
            return List.of(firstResult.get(15, TimeUnit.SECONDS), secondResult.get(15, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            workers.shutdownNow();
            assertTrue(workers.awaitTermination(10, TimeUnit.SECONDS), "CLEANUP: concurrent acceptance workers stop");
        }
    }

    private static int countAction(JsonNode items, String action) {
        int count = 0;
        for (JsonNode item : items) {
            if (action.equals(item.path("action").asText())) count++;
        }
        return count;
    }
}
