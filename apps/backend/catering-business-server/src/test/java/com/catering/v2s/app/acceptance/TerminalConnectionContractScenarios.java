package com.catering.v2s.app.acceptance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DynamicTest;

/** TDS transport CONTRACT producers. Results are kept outside the business scenario catalog. */
final class TerminalConnectionContractScenarios {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Duration CLIENT_DEADLINE = Duration.ofSeconds(15);
    private static final Pattern SAFE_WIRE_SIGNAL_DIAGNOSTIC =
            Pattern.compile("TERMINAL_WIRE_STAGE=PROCESS_SIGNAL signal=(SIGTERM) timestampUtc=([0-9TZ:.-]+) "
                    + "runId=(NONE|[A-Za-z0-9._-]{1,128}) scenario=(UNPARSED|terminal\\.[a-z0-9.-]{1,128}) "
                    + "markerId=(UNPARSED|NONE|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) "
                    + "stage=(PROCESS_STARTING|REQUEST_ACCEPTED|RESULT_READY|CLIENT_FAILED|WEBSOCKET_CONNECTING|"
                    + "WEBSOCKET_OPEN|AUTHENTICATE_SENT|WAITING_FOR_SERVER_CLOSE|SERVER_CLOSE_RECEIVED|"
                    + "SESSION_PROBE_READY|SESSION_PROBE_WAITING_FOR_COMMAND|SESSION_PROBE_COMMAND_RECEIVED|"
                    + "SESSION_PROBE_WAITING_FOR_PONG|SESSION_PROBE_WAITING_FOR_CLOSE) "
                    + "lastCommand=(NONE|PING|CLOSE|AWAIT_CLOSE|INVALID) "
                    + "lastPingSequence=(NONE|[1-9][0-9]{0,8}) pid=[1-9][0-9]{0,19} "
                    + "ppid=[1-9][0-9]{0,19} senderPid=UNAVAILABLE_BY_NODE_SIGNAL_API exitCode=143");
    private static final Pattern SAFE_WIRE_LOG_MARKER_FILE =
            Pattern.compile("terminal-wire-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.log");
    private static final Pattern SAFE_FAILURE_TYPE = Pattern.compile("[A-Za-z_$][A-Za-z0-9_$]{0,63}");
    private static final Pattern TDS_AUTH_CONNECTION_ID =
            Pattern.compile("event=tds_ws_(?:accepted|first_frame_received) connectionId="
                    + "([0-9a-f]{8,32}(?:-[0-9a-f]{4,32}){1,4})");
    private static final Pattern TDS_EVENT = Pattern.compile("event=(tds_ws_[a-z0-9_]+)");
    private static final Pattern TDS_DIAGNOSTIC_FIELD = Pattern.compile(
            "(?:^|\\s)(stage|failureType|rootFailureType|sqlState|outcome|elapsedMillis|frameType|frameBytes|"
                    + "begun|recorded|registered|closeCode|closeReason|reason)=([A-Za-z0-9_.-]{1,64})(?:\\s|$)");
    private static final Pattern WIRE_STAGE = Pattern.compile("^TERMINAL_WIRE_STAGE=([A-Z_]+)(?:\\s.*)?$");
    private static final Set<String> SAFE_WIRE_CLIENT_STAGES = Set.of(
            "PROCESS_STARTING",
            "REQUEST_ACCEPTED",
            "CLIENT_READY",
            "WEBSOCKET_CONNECTING",
            "WEBSOCKET_OPEN",
            "AUTHENTICATE_SENT",
            "WAITING_FOR_SERVER_CLOSE",
            "SERVER_CLOSE",
            "CONTROL_RECEIVED",
            "PING_SENT",
            "CLIENT_FAILED",
            "RESULT_READY");
    private static final Set<String> SAFE_TDS_AUTH_EVENTS = Set.of(
            "tds_ws_accepted",
            "tds_ws_first_frame_received",
            "tds_ws_authentication_frame_decoded",
            "tds_ws_session_attempt_begin_started",
            "tds_ws_session_attempt_begun",
            "tds_ws_credential_verification_started",
            "tds_ws_credential_verification_completed",
            "tds_ws_authentication_failed",
            "tds_ws_authentication_rejected",
            "tds_ws_verification_recorded",
            "tds_ws_pre_registration_gate_entered",
            "tds_ws_pre_registration_gate_released",
            "tds_ws_session_registration_completed",
            "tds_ws_credential_verified",
            "tds_ws_receive_failed",
            "tds_ws_close_started",
            "tds_ws_close_failed",
            "tds_ws_handler_finished");
    private static final Set<String> SAFE_TDS_CLOSE_REASONS = Set.of(
            "ACTIVATION_CANCELLED",
            "CREDENTIAL_INVALID",
            "GROUP_WORKSPACE_DISABLED",
            "TERMINAL_DISABLED",
            "SESSION_REPLACED",
            "REDIRECT_TO_NEXT_NODE",
            "NODE_BUSY",
            "AUTHENTICATION_TIMEOUT",
            "HEARTBEAT_TIMEOUT",
            "SERVER_ERROR",
            "NETWORK_ERROR",
            "UNKNOWN",
            "PROTOCOL_ERROR",
            "MESSAGE_TOO_BIG");

    private TerminalConnectionContractScenarios() {}

    private static Path terminalWireClientScript() throws IOException {
        return AcceptanceRepositoryPaths.resolveRegularFile(
                "scripts/test/terminal-ws-wire-client.mjs",
                "TERMINAL_WIRE_CLIENT_SCRIPT_MISSING",
                "TERMINAL_WIRE_CLIENT_SCRIPT_REPOSITORY_ESCAPE");
    }

    static void topologyProbe(TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        Path script = terminalWireClientScript();
        Path stderr = tds.directory().resolve("terminal-wire-client.log");

        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        String encodedSecret = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        java.util.Arrays.fill(secret, (byte) 0);
        Map<String, Object> authenticate = Map.of(
                "type",
                "AUTHENTICATE",
                "terminalRef",
                UUID.randomUUID().toString(),
                "terminalCredential",
                "1." + encodedSecret,
                "deviceId",
                "acceptance-probe-" + UUID.randomUUID(),
                "appVersion",
                "backend-acceptance");
        Map<String, Object> request = Map.of(
                "scenario",
                "terminal.connection.topology-probe",
                "url",
                tds.websocketBaseUrl() + "/tdp/acceptance-probe/ws",
                "authenticate",
                authenticate,
                "expectedClose",
                Map.of("code", 4000, "reason", "CREDENTIAL_INVALID"));

        ProcessBuilder builder =
                new ProcessBuilder(requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY"), script.toString());
        builder.directory(Path.of(System.getProperty("user.dir")).toFile());
        builder.redirectError(ProcessBuilder.Redirect.appendTo(stderr.toFile()));
        Process node = builder.start();
        try {
            node.getOutputStream().write((JSON.writeValueAsString(request) + "\n").getBytes(StandardCharsets.UTF_8));
            node.getOutputStream().close();
            boolean exited = node.waitFor(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS);
            if (!exited) {
                node.destroy();
                if (!node.waitFor(2, TimeUnit.SECONDS)) node.destroyForcibly();
                throw new IllegalStateException("TERMINAL_WIRE_CLIENT_DEADLINE_EXCEEDED");
            }
            String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO");
            Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
            JsonNode result = JSON.readTree(output);
            Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
            Assertions.assertEquals(
                    "terminal.connection.topology-probe",
                    result.path("scenario").asText());
            Assertions.assertEquals("OPEN", result.path("handshake").asText());
            Assertions.assertEquals(4000, result.path("closeCode").asInt());
            Assertions.assertEquals(
                    "CREDENTIAL_INVALID", result.path("closeReason").asText());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", "terminal.connection.topology-probe"),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("handshake", "OPEN"),
                    Map.entry("closeCode", 4000),
                    Map.entry("closeReason", "CREDENTIAL_INVALID"),
                    Map.entry("clientPid", node.pid()),
                    Map.entry("clientCommand", node.info().command().orElse("node"))));
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_CONTRACT operation=terminal.connection.topology-p"
                            + "robe CONTRACT=PASS runId=%s clientPid=%d%n"),
                    runId,
                    node.pid());
        } catch (Exception failure) {
            writeContractResult(Map.of(
                    "type", "transport-contract",
                    "operation", "terminal.connection.topology-probe",
                    "module", "TERMINAL_DATA_SERVER",
                    "contract", "FAIL",
                    "status", "FAIL",
                    "runId", runId,
                    "failureCategory", classify(failure)));
            throw failure;
        }
    }

    static Stream<DynamicTest> v10RevocationScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        Stream<DynamicTest> verifierRaces = Stream.of(
                        Map.entry(
                                "terminal.connection.vs10.device-cancel",
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL),
                        Map.entry(
                                "terminal.connection.vs10.operations-cancel",
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.OPERATIONS_CANCEL),
                        Map.entry(
                                "terminal.connection.vs10.terminal-void",
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.TERMINAL_VOID),
                        Map.entry(
                                "terminal.connection.vs10.same-device-reactivation",
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.SAME_DEVICE_REACTIVATION))
                .map(entry -> DynamicTest.dynamicTest(
                        entry.getKey(),
                        () -> v10RevocationScenario(host, tds, entry.getKey(), entry.getValue(), false)));
        Stream<DynamicTest> establishedSessions = Stream.of(
                DynamicTest.dynamicTest(
                        "terminal.connection.vs10.ready-then-cancel", () -> v10ReadyThenCancel(host, tds)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs10.listener-recovery", () -> v10ListenerRecovery(host, tds)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs10.stale-revocation-old-session",
                        () -> v10StaleRevocationAfterReactivation(host, tds)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs10.status-only.terminal-disabled",
                        () -> v10StatusOnly(
                                host,
                                tds,
                                StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.TERMINAL_DISABLED)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs10.status-only.group-disabled",
                        () -> v10StatusOnly(
                                host,
                                tds,
                                StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.GROUP_WORKSPACE_DISABLED)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs10.status-only.store-voided",
                        () -> v10StatusOnly(
                                host, tds, StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.STORE_VOIDED)));
        return Stream.concat(verifierRaces, establishedSessions);
    }

    private static boolean v10RevocationScenario(
            BackendAcceptanceTest host,
            TdsAcceptanceProcess tds,
            String scenarioId,
            StoreTerminalAcceptanceScenarios.ConnectionRevocationAction action,
            boolean expectPendingGenerationRedControl)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        TdsRegistrationGateBroker.ArmedAttempt gate =
                tds.registrationGateBroker().armNextAttempt();
        Map<String, Object> authenticate = Map.of(
                "type",
                "AUTHENTICATE",
                "terminalRef",
                fixture.terminalRef().toString(),
                "terminalCredential",
                fixture.generation() + "." + fixture.credentialSecret(),
                "deviceId",
                fixture.deviceId(),
                "appVersion",
                "backend-acceptance");
        String markerId = UUID.randomUUID().toString();
        Map<String, Object> request = Map.of(
                "scenario",
                scenarioId,
                "markerId",
                markerId,
                "url",
                tds.websocketBaseUrl() + "/tdp/" + fixture.fixture().groupWorkspaceKey() + "/ws",
                "authenticate",
                authenticate,
                "expectedClose",
                Map.of("code", 4000, "reason", "ACTIVATION_CANCELLED"));
        Path script = terminalWireClientScript();
        Path stderr = tds.directory().resolve("terminal-wire-client.log");
        Process node = null;
        boolean resultWritten = false;
        Throwable scenarioFailure = null;
        try {
            node = new ProcessBuilder(requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY"), script.toString())
                    .directory(Path.of(System.getProperty("user.dir")).toFile())
                    .redirectError(ProcessBuilder.Redirect.appendTo(stderr.toFile()))
                    .start();
            node.getOutputStream().write((JSON.writeValueAsString(request) + "\n").getBytes(StandardCharsets.UTF_8));
            node.getOutputStream().close();
            String attemptId = awaitRegistrationGateObservation(gate, Duration.ofSeconds(8), node, stderr, tds);
            Assertions.assertTrue(
                    attemptId.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"),
                    "TDS_REGISTRATION_GATE_ATTEMPT_ID_INVALID");

            business.performConnectionRevocation(context, fixture, action);
            tds.awaitBindingRevocation(fixture.terminalRef(), fixture.generation(), Duration.ofSeconds(5));
            gate.release(attemptId);

            if (expectPendingGenerationRedControl
                    && awaitWireMarkerOrClientExit(
                            node,
                            stderr,
                            "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " ",
                            Duration.ofSeconds(5))) {
                writeContractResult(Map.ofEntries(
                        Map.entry("type", "transport-contract"),
                        Map.entry("operation", scenarioId),
                        Map.entry("module", "TERMINAL_DATA_SERVER"),
                        Map.entry("contract", "FAIL"),
                        Map.entry("status", "FAIL"),
                        Map.entry("runId", runId),
                        Map.entry("revocationAction", action.name()),
                        Map.entry("attemptId", attemptId),
                        Map.entry("sessionReadyObserved", true),
                        Map.entry("clientFailureCategory", "SESSION_READY_AFTER_REVOCATION"),
                        Map.entry("failureCategory", "TDS_VS10_REGISTRATION_RACE_RED_CONTROL")));
                resultWritten = true;
                System.out.printf(
                        ("BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=FAIL runId=%s "
                                + "clientPid=%d failureCategory=TDS_VS10_REGISTRATION_RACE_RED_CONTROL "
                                + "clientFailureCategory=SESSION_READY_AFTER_REVOCATION%n"),
                        scenarioId,
                        runId,
                        node.pid());
                return true;
            }

            Assertions.assertTrue(
                    node.waitFor(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS),
                    "TERMINAL_WIRE_CLIENT_DEADLINE_EXCEEDED");
            String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            JsonNode result = JSON.readTree(output);
            if (expectPendingGenerationRedControl
                    && node.exitValue() != 0
                    && "FAIL".equals(result.path("status").asText())
                    && scenarioId.equals(result.path("scenario").asText())
                    && "TERMINAL_WIRE_SOCKET_READ_TIMEOUT"
                            .equals(result.path("failureCategory").asText())
                    && Files.readString(stderr).contains("TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " ")) {
                writeContractResult(Map.ofEntries(
                        Map.entry("type", "transport-contract"),
                        Map.entry("operation", scenarioId),
                        Map.entry("module", "TERMINAL_DATA_SERVER"),
                        Map.entry("contract", "FAIL"),
                        Map.entry("status", "FAIL"),
                        Map.entry("runId", runId),
                        Map.entry("revocationAction", action.name()),
                        Map.entry("attemptId", attemptId),
                        Map.entry("sessionReadyObserved", true),
                        Map.entry(
                                "clientFailureCategory",
                                result.path("failureCategory").asText()),
                        Map.entry("failureCategory", "TDS_VS10_REGISTRATION_RACE_RED_CONTROL")));
                resultWritten = true;
                System.out.printf(
                        ("BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=FAIL runId=%s clie"
                                + "ntPid=%d failureCategory=TDS_VS10_REGISTRATION_RACE_RED_CONTROL%n"),
                        scenarioId,
                        runId,
                        node.pid());
                return true;
            }
            Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO");
            Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
            Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
            Assertions.assertEquals(scenarioId, result.path("scenario").asText());
            Assertions.assertEquals(4000, result.path("closeCode").asInt());
            Assertions.assertEquals(
                    "ACTIVATION_CANCELLED", result.path("closeReason").asText());
            JsonNode eventTypes = result.path("eventTypes");
            Assertions.assertTrue(eventTypes.isArray(), "TERMINAL_WIRE_CLIENT_EVENT_TYPES_MISSING");
            Assertions.assertTrue(
                    eventTypes.isEmpty()
                            || (eventTypes.size() == 1
                                    && "SESSION_READY".equals(eventTypes.get(0).asText())),
                    "TERMINAL_WIRE_CLIENT_SESSION_READY_ORDER_INVALID");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenarioId),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("revocationAction", action.name()),
                    Map.entry("attemptId", attemptId),
                    Map.entry("eventTypes", JSON.convertValue(eventTypes, java.util.List.class)),
                    Map.entry("closeCode", 4000),
                    Map.entry("closeReason", "ACTIVATION_CANCELLED"),
                    Map.entry("clientPid", node.pid())));
            resultWritten = true;
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS runId=%s clie"
                            + "ntPid=%d revocationAction=%s%n"),
                    scenarioId,
                    runId,
                    node.pid(),
                    action.name());
            return false;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            String clientState = node == null ? "NOT_STARTED" : node.isAlive() ? "ALIVE" : "EXITED_" + node.exitValue();
            String clientStage = safeLatestWireClientStage(stderr);
            String failureCode = safeFailureCode(failure);
            if (!resultWritten) {
                try {
                    writeContractResult(Map.of(
                            "type",
                            "transport-contract",
                            "operation",
                            scenarioId,
                            "module",
                            "TERMINAL_DATA_SERVER",
                            "contract",
                            "FAIL",
                            "status",
                            "FAIL",
                            "runId",
                            runId,
                            "failureCode",
                            failureCode,
                            "clientState",
                            clientState,
                            "clientStage",
                            clientStage,
                            "failureCategory",
                            "TDS_VS10_REVOCATION_RACE_FAILED"));
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
            }
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_RACE stage=FAIL runId=%s scenario=%s failureCode=%s "
                            + "clientState=%s clientStage=%s%n",
                    runId, safeWireScenario(scenarioId), failureCode, clientState, clientStage);
            throw failure;
        } finally {
            Throwable cleanupFailure =
                    attemptCleanup(null, () -> tds.registrationGateBroker().cancel(gate));
            Process clientToStop = node;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(clientToStop, stderr));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v10ReadyThenCancel(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String scenarioId = "terminal.connection.vs10.ready-then-cancel";
        String markerId = UUID.randomUUID().toString();
        Path clientLog = wireClientLog(tds, markerId);
        Process node = null;
        Throwable scenarioFailure = null;
        try {
            node = startWireClient(closeExpectedRequest(tds, fixture, scenarioId, markerId), clientLog, false);
            awaitWireMarker(clientLog, "TERMINAL_WIRE_SESSION_READY markerId=" + markerId, Duration.ofSeconds(10));
            business.performConnectionRevocation(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            JsonNode result = awaitWireResult(node, clientLog, Duration.ofSeconds(20), scenarioId);
            assertCancelledSession(result, scenarioId);
            Assertions.assertEquals(List.of("SESSION_READY"), strings(result.path("eventTypes")));
            awaitSessionDisconnectRecord(
                    host, fixture.terminalRef(), result.path("sessionId").asText(), Duration.ofSeconds(20));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenarioId),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("sessionId", result.path("sessionId").asText()),
                    Map.entry("eventTypes", strings(result.path("eventTypes"))),
                    Map.entry("closeCode", result.path("closeCode").asInt()),
                    Map.entry("closeReason", result.path("closeReason").asText())));
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Process clientToStop = node;
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop, clientLog));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v10ListenerRecovery(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture revoked = business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture control = business.createConnectionContractFixture(context);
        String targetScenario = "terminal.connection.vs10.listener-revocation";
        String targetMarker = UUID.randomUUID().toString();
        String controlMarker = UUID.randomUUID().toString();
        Path targetLog = wireClientLog(tds, targetMarker);
        Process target = null;
        SessionProbe controlProbe = null;
        TdsRegistrationGateBroker.ArmedAttempt recoveryGate = null;
        String attemptId = null;
        Throwable scenarioFailure = null;
        try {
            target =
                    startWireClient(closeExpectedRequest(tds, revoked, targetScenario, targetMarker), targetLog, false);
            controlProbe = startSessionProbe(
                    tds,
                    control,
                    "terminal.connection.vs10.status-only-probe",
                    controlMarker,
                    wireClientLog(tds, controlMarker));
            awaitWireMarker(targetLog, "TERMINAL_WIRE_SESSION_READY markerId=" + targetMarker, Duration.ofSeconds(10));
            controlProbe.awaitReady(Duration.ofSeconds(10));
            controlProbe.ping(1);

            int oldBackendPid = tds.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = tds.registrationGateBroker().armNextListenerRecovery();
            Assertions.assertTrue(
                    host.terminatePostgresBackend(oldBackendPid), "V-S10_EXACT_LISTENER_TERMINATION_FAILED");
            attemptId = awaitRegistrationGateObservation(
                    recoveryGate, Duration.ofSeconds(8), controlProbe.node, wireClientLog(tds, controlMarker), tds);
            tds.awaitListenerDisconnected(oldBackendPid, Duration.ofSeconds(3));
            business.performConnectionRevocation(
                    context, revoked, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND disconnected_at_epoch_millis IS NULL",
                            revoked.terminalRef()),
                    "V-S10_SESSION_MUST_REMAIN_OPEN_WHILE_LISTENER_IS_HELD_DISCONNECTED");

            recoveryGate.release(attemptId);
            recoveryGate = null;
            int newBackendPid = tds.awaitListenerReadyAfter(oldBackendPid, Duration.ofSeconds(30));
            JsonNode closed = awaitWireResult(target, targetLog, Duration.ofSeconds(20), targetScenario);
            assertCancelledSession(closed, targetScenario);
            Assertions.assertEquals(List.of("SESSION_READY"), strings(closed.path("eventTypes")));
            awaitSessionDisconnectRecord(
                    host, revoked.terminalRef(), closed.path("sessionId").asText(), Duration.ofSeconds(20));

            controlProbe.ping(2);
            JsonNode controlResult = controlProbe.finish(Duration.ofSeconds(10));
            Assertions.assertEquals("PASS", controlResult.path("status").asText());
            Assertions.assertEquals(2, controlResult.path("pongCount").asInt());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", "terminal.connection.vs10.listener-recovery"),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("disconnectedBackendPid", oldBackendPid),
                    Map.entry("reconnectedBackendPid", newBackendPid),
                    Map.entry("attemptId", attemptId),
                    Map.entry("revokedSessionId", closed.path("sessionId").asText()),
                    Map.entry(
                            "controlSessionId", controlResult.path("sessionId").asText()),
                    Map.entry("controlPongs", controlResult.path("pongCount").asInt()),
                    Map.entry("closeReason", closed.path("closeReason").asText())));
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            TdsRegistrationGateBroker.ArmedAttempt gateToRelease = recoveryGate;
            String attemptToRelease = attemptId;
            if (gateToRelease != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, () -> {
                    if (attemptToRelease == null) tds.registrationGateBroker().cancel(gateToRelease);
                    else gateToRelease.release(attemptToRelease);
                });
            }
            Process targetToStop = target;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(targetToStop, targetLog));
            SessionProbe probeToStop = controlProbe;
            if (probeToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, probeToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v10StatusOnly(
            BackendAcceptanceTest host,
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange change)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String scenarioId = "terminal.connection.vs10.status-only."
                + change.name().toLowerCase().replace('_', '-');
        String markerId = UUID.randomUUID().toString();
        SessionProbe probe = null;
        TdsRegistrationGateBroker.ArmedAttempt recoveryGate = null;
        String attemptId = null;
        Throwable scenarioFailure = null;
        try {
            probe = startSessionProbe(
                    tds, fixture, "terminal.connection.vs10.status-only-probe", markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(10));
            probe.ping(1);
            int oldBackendPid = tds.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = tds.registrationGateBroker().armNextListenerRecovery();
            Assertions.assertTrue(
                    host.terminatePostgresBackend(oldBackendPid), "V-S10_EXACT_LISTENER_TERMINATION_FAILED");
            attemptId = awaitRegistrationGateObservation(
                    recoveryGate, Duration.ofSeconds(8), probe.node, wireClientLog(tds, markerId), tds);
            tds.awaitListenerDisconnected(oldBackendPid, Duration.ofSeconds(3));
            business.performConnectionStatusOnlyChange(context, fixture, change);
            Assertions.assertFalse(
                    tds.logContents()
                            .contains("event=tds_binding_revocation_applied terminalRef=" + fixture.terminalRef()),
                    "V-S10_STATUS_ONLY_MUST_NOT_EMIT_BINDING_REVOCATION");
            recoveryGate.release(attemptId);
            recoveryGate = null;
            int newBackendPid = tds.awaitListenerReadyAfter(oldBackendPid, Duration.ofSeconds(30));
            probe.ping(2);
            JsonNode result = probe.finish(Duration.ofSeconds(10));
            Assertions.assertEquals("PASS", result.path("status").asText());
            Assertions.assertEquals(2, result.path("pongCount").asInt());
            Assertions.assertEquals(probe.sessionId(), result.path("sessionId").asText());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenarioId),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("statusChange", change.name()),
                    Map.entry("disconnectedBackendPid", oldBackendPid),
                    Map.entry("reconnectedBackendPid", newBackendPid),
                    Map.entry("sessionId", result.path("sessionId").asText()),
                    Map.entry("pongCount", result.path("pongCount").asInt())));
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            TdsRegistrationGateBroker.ArmedAttempt gateToRelease = recoveryGate;
            String attemptToRelease = attemptId;
            if (gateToRelease != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, () -> {
                    if (attemptToRelease == null) tds.registrationGateBroker().cancel(gateToRelease);
                    else gateToRelease.release(attemptToRelease);
                });
            }
            SessionProbe probeToStop = probe;
            if (probeToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, probeToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v10StaleRevocationAfterReactivation(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture oldBinding =
                business.createConnectionContractFixture(context);
        String oldSessionScenario = "terminal.connection.vs10.stale-revocation-old-session";
        String oldMarker = UUID.randomUUID().toString();
        Process oldClient = null;
        SessionProbe newSession = null;
        TdsRegistrationGateBroker.ArmedAttempt revocationGate = null;
        String attemptId = null;
        Throwable scenarioFailure = null;
        try {
            oldClient = startWireClient(
                    closeExpectedRequest(tds, oldBinding, oldSessionScenario, oldMarker, 4000, "SESSION_REPLACED"),
                    wireClientLog(tds, oldMarker),
                    false);
            awaitWireMarker(
                    wireClientLog(tds, oldMarker),
                    "TERMINAL_WIRE_SESSION_READY markerId=" + oldMarker,
                    Duration.ofSeconds(10));
            revocationGate = tds.registrationGateBroker()
                    .armNextListenerRevocation(oldBinding.terminalRef(), oldBinding.generation());
            StoreTerminalAcceptanceScenarios.ConnectionFixture newBinding =
                    business.reactivateConnectionContractFixture(context, oldBinding);
            attemptId = awaitRegistrationGateObservation(
                    revocationGate, Duration.ofSeconds(8), oldClient, wireClientLog(tds, oldMarker), tds);

            String newMarker = UUID.randomUUID().toString();
            newSession = startSessionProbe(
                    tds,
                    newBinding,
                    "terminal.connection.vs10.status-only-probe",
                    newMarker,
                    wireClientLog(tds, newMarker));
            newSession.awaitReady(Duration.ofSeconds(10));
            JsonNode replaced = awaitWireResult(
                    oldClient, wireClientLog(tds, oldMarker), Duration.ofSeconds(10), oldSessionScenario);
            Assertions.assertEquals("PASS", replaced.path("status").asText());
            Assertions.assertEquals(
                    oldSessionScenario, replaced.path("scenario").asText());
            Assertions.assertEquals(4000, replaced.path("closeCode").asInt());
            Assertions.assertEquals(
                    "SESSION_REPLACED", replaced.path("closeReason").asText());
            Assertions.assertEquals(List.of("SESSION_READY"), strings(replaced.path("eventTypes")));

            revocationGate.release(attemptId);
            revocationGate = null;
            tds.awaitBindingRevocation(oldBinding.terminalRef(), oldBinding.generation(), Duration.ofSeconds(10));
            newSession.ping(1);
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NULL",
                            newBinding.terminalRef(),
                            newSession.sessionId()),
                    "V-S10_STALE_REVOCATION_CLOSED_NEW_GENERATION_SESSION");
            JsonNode current = newSession.finish(Duration.ofSeconds(10));
            Assertions.assertEquals("PASS", current.path("status").asText());
            Assertions.assertEquals(1, current.path("pongCount").asInt());
            Assertions.assertEquals(
                    newSession.sessionId(), current.path("sessionId").asText());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", oldSessionScenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("revokedGeneration", oldBinding.generation()),
                    Map.entry("currentGeneration", newBinding.generation()),
                    Map.entry("displacedSessionId", replaced.path("sessionId").asText()),
                    Map.entry("currentSessionId", current.path("sessionId").asText()),
                    Map.entry("closeReason", replaced.path("closeReason").asText()),
                    Map.entry("currentSessionPongs", current.path("pongCount").asInt())));
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            TdsRegistrationGateBroker.ArmedAttempt gateToRelease = revocationGate;
            String attemptToRelease = attemptId;
            if (gateToRelease != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, () -> {
                    if (attemptToRelease == null) tds.registrationGateBroker().cancel(gateToRelease);
                    else gateToRelease.release(attemptToRelease);
                });
            }
            SessionProbe sessionToStop = newSession;
            if (sessionToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, sessionToStop::stop);
            Process oldClientToStop = oldClient;
            cleanupFailure = attemptCleanup(
                    cleanupFailure, () -> stopOwnedClient(oldClientToStop, wireClientLog(tds, oldMarker)));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    static Stream<DynamicTest> v12DatabaseOutageScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(10, 30).map(seconds -> v12DatabaseOutageTest(host, tds, seconds));
    }

    static Stream<DynamicTest> v12DatabaseOutage30SecondDiagnostic(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(v12DatabaseOutageTest(host, tds, 30));
    }

    private static DynamicTest v12DatabaseOutageTest(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, int outageSeconds) {
        return DynamicTest.dynamicTest(
                "terminal.connection.vs12.database-outage-" + outageSeconds + "s",
                () -> v12DatabaseOutageScenario(host, tds, outageSeconds));
    }

    static boolean topologyPreflightWithTenSecondOutage(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, boolean expectPendingGenerationRedControl)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String registrationRace = "terminal.connection.vs10.device-cancel";
        boolean registrationRaceCaught = v10RevocationScenario(
                host,
                tds,
                registrationRace,
                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL,
                expectPendingGenerationRedControl);
        if (!expectPendingGenerationRedControl) v12DatabaseOutageScenario(host, tds, 10);
        System.out.printf(
                ("BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT stage=PASS runId=%s registrationRa"
                        + "ce=%s outageSeconds=%s contractCount=%d%n"),
                runId,
                registrationRaceCaught ? "RED_CONTROL_CAUGHT" : "PASS",
                expectPendingGenerationRedControl ? "NOT_RUN_MUTATION_MODE" : "10",
                expectPendingGenerationRedControl ? 1 : 2);
        return registrationRaceCaught;
    }

    private static void v12DatabaseOutageScenario(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, int outageSeconds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture existing = business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture newAuthentication =
                business.createConnectionContractFixture(context);
        String markerId = UUID.randomUUID().toString();
        SessionProbe probe = null;
        TdsRegistrationGateBroker.ArmedAttempt recoveryGate = null;
        String attemptId = null;
        boolean postgresPaused = false;
        boolean listenerTerminationAttempted = false;
        boolean listenerTerminationSignalAccepted = false;
        boolean listenerDisconnectObserved = false;
        boolean listenerRecoveryGateObserved = false;
        Process authNode = null;
        Path authLog = null;
        String authMarker = null;
        int oldBackendPid = -1;
        long pauseStartedNanos = 0;
        long scenarioStartedNanos = System.nanoTime();
        long authenticationStartedNanos = 0;
        long authenticationElapsedMillis = 0;
        int tdsLogOffset = 0;
        String scenarioPhase = "STARTING_SESSION_PROBE";
        Throwable scenarioFailure = null;
        try {
            probe = startSessionProbe(
                    tds,
                    existing,
                    "terminal.connection.vs12.database-outage-probe",
                    markerId,
                    wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(10));
            scenarioPhase = "SESSION_PROBE_READY";
            oldBackendPid = tds.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = tds.registrationGateBroker().armNextListenerRecovery();
            String containerId = host.postgresContainerId();
            tdsLogOffset = tds.logContents().length();
            host.pausePostgresContainer();
            postgresPaused = true;
            pauseStartedNanos = System.nanoTime();
            scenarioPhase = "POSTGRES_PAUSED";
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_OUTAGE stage=PAUSED runId=%s containerId=%s durat"
                            + "ionSeconds=%d listenerBackendPid=%d%n"),
                    runId,
                    containerId,
                    outageSeconds,
                    oldBackendPid);

            probe.ping(1);
            scenarioPhase = "INITIAL_PING_CONFIRMED";
            authMarker = UUID.randomUUID().toString();
            authLog = wireClientLog(tds, authMarker);
            Map<String, Object> authRequest = closeExpectedRequest(
                    tds,
                    newAuthentication,
                    "terminal.connection.vs12.auth-during-outage",
                    authMarker,
                    4000,
                    "SERVER_ERROR");
            scenarioPhase = "AUTH_CLIENT_STARTING";
            authenticationStartedNanos = System.nanoTime();
            authNode = startWireClient(authRequest, authLog, false);
            scenarioPhase = "AUTH_CLIENT_STARTED";
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_OUTAGE stage=AUTH_CLIENT_STARTED runId=%s markerId=%s clientPid=%d%n",
                    runId, authMarker, authNode.pid());
            scenarioPhase = "WAITING_FOR_AUTH_SERVER_CLOSE";
            JsonNode authResult = awaitWireResult(
                    authNode, authLog, Duration.ofSeconds(15), "terminal.connection.vs12.auth-during-outage");
            authenticationElapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - authenticationStartedNanos);
            Assertions.assertEquals(
                    "SERVER_ERROR", authResult.path("closeReason").asText());
            Assertions.assertTrue(
                    authenticationElapsedMillis <= Duration.ofSeconds(10).toMillis(),
                    "V-S12_NEW_AUTH_SERVER_ERROR_EXCEEDED_FIRST_FRAME_DEADLINE");
            scenarioPhase = "AUTH_SERVER_ERROR_CONFIRMED";

            int sequence = 2;
            long outageDeadline = pauseStartedNanos + TimeUnit.SECONDS.toNanos(outageSeconds);
            while (System.nanoTime() < outageDeadline) {
                int currentSequence = sequence++;
                scenarioPhase = "PROBE_PING_" + currentSequence;
                probe.ping(currentSequence);
                scenarioPhase = "PROBE_PONG_" + currentSequence;
                long remaining = outageDeadline - System.nanoTime();
                if (remaining > 0) TimeUnit.NANOSECONDS.sleep(Math.min(remaining, TimeUnit.SECONDS.toNanos(1)));
            }
            scenarioPhase = "OUTAGE_WINDOW_COMPLETED";
            long pausedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - pauseStartedNanos);
            Assertions.assertTrue(pausedMillis >= outageSeconds * 1000L, "V-S12_POSTGRES_PAUSE_TOO_SHORT");
            String tdsLog = tds.logContents();
            Assertions.assertTrue(tdsLog.length() >= tdsLogOffset, "V-S12_TDS_LOG_OFFSET_INVALID");
            assertPendingWriterQueueBounds(tdsLog.substring(tdsLogOffset), 1);

            host.unpausePostgresContainer();
            postgresPaused = false;
            scenarioPhase = "TERMINATING_RESTORED_LISTENER";
            listenerTerminationAttempted = true;
            listenerTerminationSignalAccepted = host.terminatePostgresBackend(oldBackendPid);
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_OUTAGE stage=LISTENER_TERMINATION_SIGNAL runId=%s "
                            + "listenerBackendPid=%d signalAccepted=%s%n",
                    runId, oldBackendPid, listenerTerminationSignalAccepted);
            scenarioPhase = "WAITING_FOR_LISTENER_DISCONNECT";
            tds.awaitListenerDisconnectedAfter(oldBackendPid, tdsLogOffset, Duration.ofSeconds(3));
            listenerDisconnectObserved = true;
            scenarioPhase = "LISTENER_DISCONNECT_OBSERVED";
            scenarioPhase = "WAITING_FOR_LISTENER_RECOVERY_GATE";
            attemptId = awaitRegistrationGateObservation(
                    recoveryGate, Duration.ofSeconds(15), probe.node, wireClientLog(tds, markerId), tds);
            listenerRecoveryGateObserved = true;
            scenarioPhase = "LISTENER_RECOVERY_GATE_OBSERVED";
            business.performConnectionRevocation(
                    context, existing, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            scenarioPhase = "HTTP_REVOCATION_COMMITTED";
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND disconnected_at_epoch_millis IS NULL",
                            existing.terminalRef()),
                    "V-S12_SESSION_MUST_REMAIN_OPEN_WHILE_LISTENER_RECOVERY_IS_HELD");
            recoveryGate.release(attemptId);
            recoveryGate = null;
            scenarioPhase = "LISTENER_RECOVERY_RELEASED";
            int newBackendPid = tds.awaitListenerReadyAfter(oldBackendPid, Duration.ofSeconds(30));
            scenarioPhase = "LISTENER_READY";
            JsonNode revoked = probe.awaitClose(4000, "ACTIVATION_CANCELLED", Duration.ofSeconds(10));
            scenarioPhase = "SESSION_REVOKED";
            awaitSessionDisconnectRecord(
                    host, existing.terminalRef(), revoked.path("sessionId").asText(), Duration.ofSeconds(20));
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            newAuthentication.terminalRef()),
                    "V-S12_FAILED_AUTHENTICATION_MUST_NOT_REGISTER_SESSION");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", "terminal.connection.vs12.database-outage-" + outageSeconds + "s"),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("containerId", containerId),
                    Map.entry("pausedMillis", pausedMillis),
                    Map.entry("disconnectedBackendPid", oldBackendPid),
                    Map.entry("listenerTerminationAttempted", listenerTerminationAttempted),
                    Map.entry("listenerTerminationSignalAccepted", listenerTerminationSignalAccepted),
                    Map.entry("listenerDisconnectObserved", listenerDisconnectObserved),
                    Map.entry("listenerRecoveryGateObserved", listenerRecoveryGateObserved),
                    Map.entry("reconnectedBackendPid", newBackendPid),
                    Map.entry("sessionId", revoked.path("sessionId").asText()),
                    Map.entry("pongsDuringOutage", probe.pongCount()),
                    Map.entry(
                            "newAuthenticationCloseReason",
                            authResult.path("closeReason").asText()),
                    Map.entry("newAuthenticationElapsedMillis", authenticationElapsedMillis)));
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_OUTAGE stage=PASS runId=%s durationSeconds=%d pau"
                            + "sedMillis=%d listenerPid=%d signalAccepted=%s disconnectObserved=%s "
                            + "gateObserved=%s reconnectedPid=%d "
                            + "pongs=%d newAuth=SERVER_ERROR authElapse"
                            + "dMillis=%d%n"),
                    runId,
                    outageSeconds,
                    pausedMillis,
                    oldBackendPid,
                    listenerTerminationSignalAccepted,
                    listenerDisconnectObserved,
                    listenerRecoveryGateObserved,
                    newBackendPid,
                    probe.pongCount(),
                    authenticationElapsedMillis);
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            String probeState = probe == null ? "NOT_STARTED" : probe.node.isAlive() ? "ALIVE" : "EXITED";
            String probeExitCode = probe == null
                    ? "NOT_STARTED"
                    : probe.node.isAlive() ? "RUNNING" : Integer.toString(probe.node.exitValue());
            String probeSignal = safeWireSignalDiagnostic(probe == null ? null : probe.log);
            int probePongCount = probe == null ? 0 : probe.pongCount();
            String authenticationClientExitCode = authNode == null
                    ? "NOT_STARTED"
                    : authNode.isAlive() ? "RUNNING" : Integer.toString(authNode.exitValue());
            long authenticationAttemptElapsedMillis = authenticationStartedNanos == 0
                    ? 0
                    : TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - authenticationStartedNanos);
            long scenarioElapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - scenarioStartedNanos);
            long pausedMillis =
                    pauseStartedNanos == 0 ? 0 : TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - pauseStartedNanos);
            String authenticationClientStage = safeLatestWireClientStage(authLog);
            String tdsAuthenticationTrace = safeTdsAuthenticationTrace(tds, tdsLogOffset);
            try {
                writeContractResult(Map.ofEntries(
                        Map.entry("type", "transport-contract"),
                        Map.entry("operation", "terminal.connection.vs12.database-outage-" + outageSeconds + "s"),
                        Map.entry("module", "TERMINAL_DATA_SERVER"),
                        Map.entry("contract", "FAIL"),
                        Map.entry("status", "FAIL"),
                        Map.entry("runId", runId),
                        Map.entry("failureCategory", "TDS_VS12_DATABASE_OUTAGE_SCENARIO_FAILED"),
                        Map.entry("failureType", safeFailureType(failure)),
                        Map.entry("rootFailureType", safeRootFailureType(failure)),
                        Map.entry("failureCode", safeFailureCode(failure)),
                        Map.entry("postgresPausedAtFailure", postgresPaused),
                        Map.entry("listenerBackendPid", oldBackendPid),
                        Map.entry("listenerTerminationAttempted", listenerTerminationAttempted),
                        Map.entry("listenerTerminationSignalAccepted", listenerTerminationSignalAccepted),
                        Map.entry("listenerDisconnectObserved", listenerDisconnectObserved),
                        Map.entry("listenerRecoveryGateObserved", listenerRecoveryGateObserved),
                        Map.entry("pauseElapsedMillis", pausedMillis),
                        Map.entry("scenarioElapsedMillis", scenarioElapsedMillis),
                        Map.entry("authenticationElapsedMillis", authenticationElapsedMillis),
                        Map.entry("authenticationAttemptElapsedMillis", authenticationAttemptElapsedMillis),
                        Map.entry("authenticationClientMarkerId", authMarker == null ? "NONE" : authMarker),
                        Map.entry("authenticationClientExitCode", authenticationClientExitCode),
                        Map.entry("authenticationClientStage", authenticationClientStage),
                        Map.entry("scenarioPhase", scenarioPhase),
                        Map.entry("probeMarkerId", probe == null ? "NONE" : probe.markerId),
                        Map.entry("probeState", probeState),
                        Map.entry("probeExitCode", probeExitCode),
                        Map.entry("probePid", probe == null ? -1 : probe.node.pid()),
                        Map.entry("probeCommandStage", probe == null ? "NOT_STARTED" : probe.commandStage),
                        Map.entry("probePendingPingSequence", probe == null ? -1 : probe.pendingPingSequence),
                        Map.entry("probePongCount", probePongCount),
                        Map.entry("probeSignal", probeSignal),
                        Map.entry("probeStage", safeWireClientLastKnownStage(probe == null ? null : probe.log)),
                        Map.entry("tdsAuthenticationTrace", tdsAuthenticationTrace)));
            } catch (Exception | Error reportFailure) {
                failure.addSuppressed(reportFailure);
            }
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_OUTAGE stage=FAIL runId=%s durationSeconds=%d postgresPaused=%s "
                            + "listenerBackendPid=%d listenerTerminationAttempted=%s "
                            + "listenerTerminationSignalAccepted=%s listenerDisconnectObserved=%s "
                            + "listenerRecoveryGateObserved=%s "
                            + "scenarioPhase=%s pauseElapsedMillis=%d scenarioElapsedMillis=%d "
                            + "authenticationElapsedMillis=%d authenticationAttemptElapsedMillis=%d "
                            + "authenticationClientMarkerId=%s authenticationClientExitCode=%s "
                            + "authenticationClientStage=%s probeMarkerId=%s probeState=%s probeExitCode=%s "
                            + "probePid=%d "
                            + "probeCommandStage=%s probePendingPingSequence=%d probePongCount=%d "
                            + "probeSignal=%s probeStage=%s failureCode=%s "
                            + "failureType=%s rootFailureType=%s "
                            + "tdsAuthenticationTrace=%s%n",
                    runId,
                    outageSeconds,
                    postgresPaused,
                    oldBackendPid,
                    listenerTerminationAttempted,
                    listenerTerminationSignalAccepted,
                    listenerDisconnectObserved,
                    listenerRecoveryGateObserved,
                    scenarioPhase,
                    pausedMillis,
                    scenarioElapsedMillis,
                    authenticationElapsedMillis,
                    authenticationAttemptElapsedMillis,
                    authMarker == null ? "NONE" : authMarker,
                    authenticationClientExitCode,
                    authenticationClientStage,
                    probe == null ? "NONE" : probe.markerId,
                    probeState,
                    probeExitCode,
                    probe == null ? -1 : probe.node.pid(),
                    probe == null ? "NOT_STARTED" : probe.commandStage,
                    probe == null ? -1 : probe.pendingPingSequence,
                    probePongCount,
                    probeSignal,
                    safeWireClientLastKnownStage(probe == null ? null : probe.log),
                    safeFailureCode(failure),
                    safeFailureType(failure),
                    safeRootFailureType(failure),
                    tdsAuthenticationTrace);
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            if (postgresPaused) cleanupFailure = attemptCleanup(cleanupFailure, host::unpausePostgresContainer);
            TdsRegistrationGateBroker.ArmedAttempt gateToRelease = recoveryGate;
            String attemptToRelease = attemptId;
            if (gateToRelease != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, () -> {
                    if (attemptToRelease == null) tds.registrationGateBroker().cancel(gateToRelease);
                    else gateToRelease.release(attemptToRelease);
                });
            }
            SessionProbe probeToStop = probe;
            if (probeToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, probeToStop::stop);
            Process authClientToStop = authNode;
            Path authLogToRead = authLog;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(authClientToStop, authLogToRead));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void assertPendingWriterQueueBounds(String log, int admittedActiveSessions) {
        java.util.regex.Pattern bounds = java.util.regex.Pattern.compile(
                "event=tds_heartbeat_write_failed count=\\d+ pendingHeartbeats=(\\d+) pendingDisconnects=(\\d+)");
        int observations = 0;
        java.util.regex.Matcher matcher = bounds.matcher(log);
        while (matcher.find()) {
            observations++;
            Assertions.assertTrue(
                    Integer.parseInt(matcher.group(1)) <= admittedActiveSessions,
                    "V-S12_PENDING_HEARTBEATS_EXCEED_ACTIVE_SESSIONS");
            Assertions.assertTrue(
                    Integer.parseInt(matcher.group(2)) <= admittedActiveSessions,
                    "V-S12_PENDING_DISCONNECTS_EXCEED_ADMITTED_SESSIONS");
        }
        Assertions.assertTrue(observations > 0, "V-S12_HEARTBEAT_WRITE_FAILURE_NOT_OBSERVED_DURING_DATABASE_PAUSE");
    }

    static Stream<DynamicTest> v14Scenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(
                        new WireCase("terminal.connection.compression.offer-none", null, true, false, null),
                        new WireCase(
                                "terminal.connection.compression.offer-bare", "permessage-deflate", true, false, null),
                        new WireCase(
                                "terminal.connection.compression.offer-client-max-window-bits",
                                "permessage-deflate; client_max_window_bits",
                                true,
                                false,
                                null),
                        new WireCase(
                                "terminal.connection.compression.session-negotiated",
                                "permessage-deflate",
                                true,
                                true,
                                null),
                        new WireCase("terminal.connection.compression.session-fallback", null, false, true, null),
                        new WireCase("terminal.connection.frame.exact-boundary", null, false, true, null),
                        new WireCase("terminal.connection.frame.raw-overflow", null, false, true, Map.of("code", 1009)),
                        new WireCase(
                                "terminal.connection.frame.compressed-single-overflow",
                                "permessage-deflate",
                                true,
                                true,
                                Map.of("code", 1009)),
                        new WireCase(
                                "terminal.connection.frame.compressed-fragmented-overflow",
                                "permessage-deflate",
                                true,
                                true,
                                Map.of("code", 1009)))
                .map(testCase -> DynamicTest.dynamicTest(testCase.scenario(), () -> v14Scenario(host, tds, testCase)));
    }

    static Stream<DynamicTest> forwardCompatibleMessageFieldScenarios(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of("terminal.connection.vs1.unknown-auth-field", "terminal.connection.vs3.unknown-ping-field")
                .map(scenario -> DynamicTest.dynamicTest(
                        scenario, () -> forwardCompatibleMessageFieldScenario(host, tds, scenario)));
    }

    private static void forwardCompatibleMessageFieldScenario(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, String scenario) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String markerId = UUID.randomUUID().toString();
        boolean sendsUnknownPingField = "terminal.connection.vs3.unknown-ping-field".equals(scenario);
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture =
                new StoreTerminalAcceptanceScenarios(host).createConnectionContractFixture(context);
        SessionProbe probe = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            probe = startSessionProbe(tds, fixture, scenario, markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(15));
            if (sendsUnknownPingField) probe.ping(7);
            JsonNode result = probe.finish(Duration.ofSeconds(10));
            List<String> expectedEvents =
                    sendsUnknownPingField ? List.of("SESSION_READY", "PONG") : List.of("SESSION_READY");
            Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
            Assertions.assertEquals(scenario, result.path("scenario").asText());
            Assertions.assertEquals("OPEN", result.path("handshake").asText());
            Assertions.assertEquals(expectedEvents, strings(result.path("eventTypes")));
            Assertions.assertEquals(
                    sendsUnknownPingField ? 1 : 0, result.path("pongCount").asInt());
            String sessionId = result.path("sessionId").asText();
            awaitAnySessionDisconnectRecord(host, fixture.terminalRef(), sessionId, Duration.ofSeconds(20));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "node-core-net-crypto-zlib-raw-frames"),
                    Map.entry("handshake", "OPEN"),
                    Map.entry("eventTypes", expectedEvents),
                    Map.entry("pongCount", sendsUnknownPingField ? 1 : 0),
                    Map.entry("sessionId", sessionId)));
            resultWritten = true;
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS "
                            + "runId=%s producer=node-core-net-crypto-zlib-raw-frames%n",
                    scenario, runId);
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) {
                try {
                    writeContractResult(Map.of(
                            "type",
                            "transport-contract",
                            "operation",
                            scenario,
                            "module",
                            "TERMINAL_DATA_SERVER",
                            "contract",
                            "FAIL",
                            "status",
                            "FAIL",
                            "runId",
                            runId,
                            "failureCategory",
                            "TDS_D43_UNKNOWN_FIELD_ACCEPTANCE_FAILED",
                            "failureType",
                            safeFailureType(failure),
                            "rootFailureType",
                            safeRootFailureType(failure),
                            "failureCode",
                            safeFailureCode(failure)));
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
            }
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            SessionProbe probeToStop = probe;
            if (probeToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, probeToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v14Scenario(BackendAcceptanceTest host, TdsAcceptanceProcess tds, WireCase testCase)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = testCase.requiresAuthentication()
                ? new StoreTerminalAcceptanceScenarios(host).createConnectionContractFixture(context)
                : null;
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("scenario", testCase.scenario());
        request.put("url", tds.websocketBaseUrl() + "/tdp/acceptance-probe/ws");
        if (testCase.includeExtensionOffer()) request.put("extensionOffer", testCase.extensionOffer());
        if (fixture != null) {
            request.put(
                    "url", tds.websocketBaseUrl() + "/tdp/" + fixture.fixture().groupWorkspaceKey() + "/ws");
            request.put(
                    "authenticate",
                    Map.of(
                            "type",
                            "AUTHENTICATE",
                            "terminalRef",
                            fixture.terminalRef().toString(),
                            "terminalCredential",
                            fixture.generation() + "." + fixture.credentialSecret(),
                            "deviceId",
                            fixture.deviceId(),
                            "appVersion",
                            "backend-acceptance"));
        }
        if (testCase.expectedClose() != null) request.put("expectedClose", testCase.expectedClose());

        int tdsLogOffset = tds.logContents().length();
        JsonNode result = runWireClient(tds, request);
        boolean resultWritten = false;
        try {
            Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
            Assertions.assertEquals(testCase.scenario(), result.path("scenario").asText());
            Assertions.assertEquals("OPEN", result.path("handshake").asText());
            if (testCase.scenario().contains("compression.offer-")) {
                assertNegotiatedExtension(
                        testCase.scenario(), result.path("extensionResponse").asText(null));
            } else if (testCase.scenario().contains("compression.session-")) {
                Assertions.assertEquals(List.of("SESSION_READY", "PONG"), strings(result.path("eventTypes")));
                boolean negotiated = testCase.scenario().endsWith("session-negotiated");
                Assertions.assertEquals(
                        negotiated ? List.of("AUTHENTICATE", "PING") : List.of(),
                        strings(result.path("clientCompressedTypes")),
                        "TERMINAL_WIRE_CLIENT_COMPRESSION_DIRECTION_INVALID");
                Assertions.assertEquals(
                        negotiated ? List.of("SESSION_READY") : List.of(),
                        strings(result.path("serverCompressedTypes")),
                        "TERMINAL_WIRE_SERVER_COMPRESSION_DIRECTION_INVALID");
            } else if (isExactBoundaryMessage(testCase.scenario())) {
                Assertions.assertEquals(List.of("SESSION_READY"), strings(result.path("eventTypes")));
            } else if (testCase.expectedClose() != null) {
                Assertions.assertEquals(
                        testCase.expectedClose().get("code"),
                        result.path("closeCode").asInt());
                if (testCase.expectedClose().containsKey("reason")) {
                    Assertions.assertEquals(
                            testCase.expectedClose().get("reason"),
                            result.path("closeReason").asText());
                }
                Assertions.assertEquals(List.of(), strings(result.path("eventTypes")));
            }

            if (fixture != null && isOversizedMessageRejection(testCase.scenario())) {
                String scenarioTdsLog = awaitTdsScenarioLogAfterOffset(
                        tds, tdsLogOffset, "event=tds_ws_handler_finished", Duration.ofSeconds(3));
                for (String forbiddenEvent : List.of(
                        "event=tds_ws_authentication_frame_decoded",
                        "event=tds_ws_session_attempt_begin_started",
                        "event=tds_ws_session_attempt_begun",
                        "event=tds_ws_credential_verification_started",
                        "event=tds_ws_credential_verification_completed",
                        "event=tds_ws_verification_recorded",
                        "event=tds_ws_pre_registration_gate_entered",
                        "event=tds_ws_pre_registration_gate_released",
                        "event=tds_ws_session_registration_completed",
                        "event=tds_ws_credential_verified")) {
                    Assertions.assertFalse(
                            scenarioTdsLog.contains(forbiddenEvent),
                            "V-S14 rejected frame reached a forbidden TDS stage: " + forbiddenEvent);
                }
                Assertions.assertFalse(
                        scenarioTdsLog.contains("event=tds_ws_first_frame_received"),
                        "V-S14 oversized message must be rejected before application frame delivery");
                Assertions.assertEquals(
                        0L,
                        host.count(
                                "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref = ?",
                                fixture.terminalRef()),
                        "V-S14 rejected frame must not open a TDS session row");
            }

            if (fixture != null && isExactBoundaryMessage(testCase.scenario())) {
                String scenarioTdsLog = awaitTdsScenarioLogAfterOffset(
                        tds, tdsLogOffset, "event=tds_ws_handler_finished", Duration.ofSeconds(3));
                Assertions.assertTrue(
                        scenarioTdsLog.contains("frameType=TEXT frameBytes=65536"),
                        "V-S14 exact boundary must reach the application at exactly 65,536 bytes");
                Assertions.assertTrue(
                        scenarioTdsLog.contains("event=tds_ws_session_registration_completed")
                                && scenarioTdsLog.contains("registered=true"),
                        "V-S14 exact boundary must register its session");
                String sessionId = result.path("sessionId").asText();
                awaitAnySessionDisconnectRecord(host, fixture.terminalRef(), sessionId, Duration.ofSeconds(20));
                Assertions.assertEquals(
                        1L,
                        host.count(
                                "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref = ?",
                                fixture.terminalRef()),
                        "V-S14 exact boundary must authenticate and persist its session");
            }

            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", testCase.scenario()),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "node-core-net-crypto-zlib-raw-frames"),
                    Map.entry("handshake", "OPEN"),
                    Map.entry(
                            "extensionResponse",
                            result.path("extensionResponse").asText("")),
                    Map.entry("eventTypes", strings(result.path("eventTypes"))),
                    Map.entry(
                            "closeCode",
                            result.path("closeCode").isNumber()
                                    ? result.path("closeCode").asInt()
                                    : -1),
                    Map.entry("closeReason", result.path("closeReason").asText(""))));
            resultWritten = true;
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS runId=%s prod"
                            + "ucer=node-core-net-crypto-zlib-raw-frames%n"),
                    testCase.scenario(),
                    runId);
        } catch (Exception failure) {
            if (!resultWritten) {
                writeContractResult(Map.of(
                        "type",
                        "transport-contract",
                        "operation",
                        testCase.scenario(),
                        "module",
                        "TERMINAL_DATA_SERVER",
                        "contract",
                        "FAIL",
                        "status",
                        "FAIL",
                        "runId",
                        runId,
                        "failureCategory",
                        "TDS_VS14_WIRE_CONTRACT_FAILED"));
            }
            throw failure;
        }
    }

    private static String awaitTdsScenarioLogAfterOffset(
            TdsAcceptanceProcess tds, int offset, String marker, Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            String contents = tds.logContents();
            Assertions.assertTrue(offset >= 0 && offset <= contents.length(), "V-S14_TDS_LOG_OFFSET_INVALID");
            String scenarioLog = contents.substring(offset);
            if (scenarioLog.contains(marker)) return scenarioLog;
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException("V-S14_TDS_SCENARIO_LOG_MARKER_MISSING:" + marker);
    }

    private static Map<String, Object> closeExpectedRequest(
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            String scenario,
            String markerId) {
        return closeExpectedRequest(tds, fixture, scenario, markerId, 4000, "ACTIVATION_CANCELLED");
    }

    private static Map<String, Object> closeExpectedRequest(
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            String scenario,
            String markerId,
            int closeCode,
            String closeReason) {
        return Map.of(
                "scenario",
                scenario,
                "markerId",
                markerId,
                "url",
                tds.websocketBaseUrl() + "/tdp/" + fixture.fixture().groupWorkspaceKey() + "/ws",
                "authenticate",
                Map.of(
                        "type",
                        "AUTHENTICATE",
                        "terminalRef",
                        fixture.terminalRef().toString(),
                        "terminalCredential",
                        fixture.generation() + "." + fixture.credentialSecret(),
                        "deviceId",
                        fixture.deviceId(),
                        "appVersion",
                        "backend-acceptance"),
                "expectedClose",
                Map.of("code", closeCode, "reason", closeReason));
    }

    private static Path wireClientLog(TdsAcceptanceProcess tds, String markerId) {
        return tds.directory().resolve("terminal-wire-" + markerId + ".log");
    }

    private static String awaitRegistrationGateObservation(
            TdsRegistrationGateBroker.ArmedAttempt gate,
            Duration timeout,
            Process wireClient,
            Path wireClientLog,
            TdsAcceptanceProcess tds)
            throws Exception {
        try {
            return gate.awaitObserved(timeout, wireClient.onExit());
        } catch (IllegalStateException failure) {
            String clientState = wireClient.isAlive() ? "alive" : wireClientExitSummary(wireClient);
            String wireStages = relevantLogLines(
                    Files.isRegularFile(wireClientLog) ? Files.readString(wireClientLog, StandardCharsets.UTF_8) : "",
                    "TERMINAL_WIRE_STAGE=",
                    "TERMINAL_WIRE_STAGE=PROCESS_SIGNAL ",
                    "TERMINAL_WIRE_SESSION_READY markerId=");
            String tdsStages = relevantLogLines(
                    tds.logContents(),
                    "event=tds_ws_accepted",
                    "event=tds_ws_first_frame_received",
                    "event=tds_ws_authentication_failed",
                    "event=tds_ws_session_attempt_begun",
                    "event=tds_ws_credential_verification_started",
                    "event=tds_ws_credential_verification_completed",
                    "event=tds_ws_pre_registration_gate_entered",
                    "event=tds_ws_pre_registration_gate_released",
                    "event=tds_ws_session_registration_completed");
            System.out.printf(
                    "BACKEND_ACCEPTANCE_GATE_OBSERVATION status=FAIL reason=%s client=%s wireStages=%s tdsStages=%s%n",
                    failure.getMessage(), clientState, wireStages, tdsStages);
            throw new IllegalStateException(
                    failure.getMessage()
                            + " client=" + clientState
                            + " wireStages=" + wireStages
                            + " tdsStages=" + tdsStages,
                    failure);
        }
    }

    private static String wireClientExitSummary(Process wireClient) {
        String output;
        try {
            output = new String(wireClient.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException ignored) {
            return "exitCode=" + wireClient.exitValue() + ",result=unavailable";
        }
        try {
            JsonNode result = JSON.readTree(output);
            return "exitCode=" + wireClient.exitValue()
                    + ",scenario=" + safeWireScenario(result.path("scenario").asText())
                    + ",status=" + safeWireStatus(result)
                    + ",failureCategory=" + safeWireFailureCategory(result)
                    + ",closeCode=" + safeWireCloseCode(result)
                    + ",closeReason=" + safeWireCloseReason(result)
                    + ",sessionIdPresent=" + safeWireSessionIdPresent(result);
        } catch (Exception ignored) {
            return "exitCode=" + wireClient.exitValue() + ",result=invalid-json";
        }
    }

    private static String safeWireScenario(String scenario) {
        return scenario != null && scenario.matches("terminal\\.[a-z0-9.-]{1,128}") ? scenario : "UNRECOGNIZED";
    }

    private static String safeFailureType(Throwable failure) {
        String type = failure == null ? null : failure.getClass().getSimpleName();
        return type != null && SAFE_FAILURE_TYPE.matcher(type).matches() ? type : "UNKNOWN";
    }

    private static String safeFailureCode(Throwable failure) {
        for (Throwable current = failure; current != null; current = current.getCause()) {
            String message = current.getMessage();
            if (message != null) {
                Matcher failureCode = Pattern.compile(
                                "(?<![A-Za-z0-9])((?:TDS|TERMINAL)_[A-Z0-9_]+|V-S[0-9]+_[A-Z0-9_]+)(?![A-Za-z0-9])")
                        .matcher(message);
                if (failureCode.find()) return failureCode.group(1);
            }
        }
        return "UNKNOWN";
    }

    private static String safeRootFailureType(Throwable failure) {
        Throwable root = failure;
        for (int depth = 0; root != null && depth < 16; depth++) {
            Throwable cause = root.getCause();
            if (cause == null || cause == root) break;
            root = cause;
        }
        return safeFailureType(root);
    }

    private static String safeLatestWireClientStage(Path stderrLog) {
        if (stderrLog == null || !Files.isRegularFile(stderrLog)) return "UNAVAILABLE";
        try (Stream<String> lines = Files.lines(stderrLog, StandardCharsets.UTF_8)) {
            return lines.map(line -> {
                        Matcher matcher = WIRE_STAGE.matcher(line);
                        if (!matcher.matches() || !SAFE_WIRE_CLIENT_STAGES.contains(matcher.group(1))) return null;
                        return matcher.group(1);
                    })
                    .filter(java.util.Objects::nonNull)
                    .reduce((first, latest) -> latest)
                    .orElse("NONE");
        } catch (IOException unreadableLog) {
            return "UNAVAILABLE";
        }
    }

    private static String safeWireClientLastKnownStage(Path stderrLog) {
        if (stderrLog == null || !Files.isRegularFile(stderrLog)) return "UNAVAILABLE";
        Pattern signalStage = Pattern.compile("(?:^| )stage=([A-Z_]{1,64})(?: |$)");
        try (Stream<String> lines = Files.lines(stderrLog, StandardCharsets.UTF_8)) {
            return lines.map(line -> {
                        if (line.contains("TERMINAL_WIRE_STAGE=PROCESS_SIGNAL")) {
                            Matcher matcher = signalStage.matcher(line);
                            return matcher.find() ? matcher.group(1) : "PROCESS_SIGNAL";
                        }
                        Matcher matcher = WIRE_STAGE.matcher(line);
                        return matcher.matches() && SAFE_WIRE_CLIENT_STAGES.contains(matcher.group(1))
                                ? matcher.group(1)
                                : null;
                    })
                    .filter(java.util.Objects::nonNull)
                    .reduce((first, latest) -> latest)
                    .orElse("NONE");
        } catch (IOException unreadableLog) {
            return "UNAVAILABLE";
        }
    }

    private static String safeTdsAuthenticationTrace(TdsAcceptanceProcess tds, int offset) {
        try {
            String contents = tds.logContents();
            if (offset < 0 || offset > contents.length()) return "INVALID_OFFSET";
            List<String> lines = contents.substring(offset).lines().toList();
            String connectionId = lines.stream()
                    .map(TDS_AUTH_CONNECTION_ID::matcher)
                    .filter(Matcher::find)
                    .map(matcher -> matcher.group(1))
                    .reduce((first, latest) -> latest)
                    .orElse(null);
            if (connectionId == null) return "AUTHENTICATION_CONNECTION_NOT_OBSERVED";
            List<String> events = lines.stream()
                    .filter(line -> line.contains("connectionId=" + connectionId))
                    .map(TerminalConnectionContractScenarios::safeTdsAuthenticationEvent)
                    .filter(java.util.Objects::nonNull)
                    .toList();
            int start = Math.max(0, events.size() - 12);
            return events.isEmpty()
                    ? "NO_AUTHENTICATION_EVENTS"
                    : String.join(",", events.subList(start, events.size()));
        } catch (IOException unreadableLog) {
            return "UNAVAILABLE";
        }
    }

    private static String safeTdsAuthenticationEvent(String line) {
        Matcher eventMatcher = TDS_EVENT.matcher(line);
        if (!eventMatcher.find()) return null;
        String event = eventMatcher.group(1);
        if (!SAFE_TDS_AUTH_EVENTS.contains(event)) return null;
        List<String> safeFields = new ArrayList<>();
        Matcher fieldMatcher = TDS_DIAGNOSTIC_FIELD.matcher(line);
        while (fieldMatcher.find()) {
            String value = safeTdsDiagnosticField(fieldMatcher.group(1), fieldMatcher.group(2));
            if (value != null) safeFields.add(fieldMatcher.group(1) + "=" + value);
        }
        return safeFields.isEmpty() ? event : event + "(" + String.join(";", safeFields) + ")";
    }

    private static String safeTdsDiagnosticField(String key, String value) {
        return switch (key) {
            case "stage" -> value.matches("[A-Z_]{1,64}") ? value : null;
            case "failureType", "rootFailureType" -> SAFE_FAILURE_TYPE
                            .matcher(value)
                            .matches()
                    ? value
                    : null;
            case "sqlState" -> value.equals("NONE") || value.matches("[A-Z0-9]{5}") ? value : null;
            case "outcome" -> value.matches("[A-Z_]{1,64}") ? value : null;
            case "elapsedMillis", "frameBytes" -> value.matches("[0-9]{1,12}") ? value : null;
            case "frameType" -> value.equals("TEXT") || value.equals("BINARY") ? value : null;
            case "begun", "recorded", "registered" -> value.equals("true") || value.equals("false") ? value : null;
            case "closeCode" -> value.matches("[0-9]{4}") ? value : null;
            case "closeReason", "reason" -> SAFE_TDS_CLOSE_REASONS.contains(value) ? value : null;
            default -> null;
        };
    }

    private static String safeWireStatus(JsonNode result) {
        String status = result == null ? "" : result.path("status").asText();
        return status.equals("PASS") || status.equals("FAIL") ? status : "UNKNOWN";
    }

    private static String safeRunId() {
        String value = System.getenv("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        return value != null && value.matches("[A-Za-z0-9._-]{1,128}") ? value : "NONE";
    }

    private static void writeWireLifecycleLog(Path stderrLog, String fields) throws IOException {
        String entry = "BACKEND_ACCEPTANCE_WIRE_CLIENT " + fields + System.lineSeparator();
        if (stderrLog == null) {
            System.out.print(entry);
            return;
        }
        Files.writeString(
                stderrLog, entry, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    private static String probeCommandKind(String command) {
        if (command.matches("PING\\t[1-9][0-9]{0,8}")) return "PING";
        if (command.equals("CLOSE")) return "CLOSE";
        if (command.matches("AWAIT_CLOSE\\t[1-9][0-9]{2,3}\\t[A-Z_]{1,48}")) return "AWAIT_CLOSE";
        return "INVALID";
    }

    private static String probeCommandSequence(String command) {
        Matcher matcher = Pattern.compile("PING\\t([1-9][0-9]{0,8})").matcher(command);
        return matcher.matches() ? matcher.group(1) : "NONE";
    }

    private static String safeWireFailureCategory(JsonNode result) {
        String category = result == null ? "" : result.path("failureCategory").asText();
        return category.matches("TERMINAL_WIRE_[A-Z0-9_]+") ? category : "NONE";
    }

    private static String safeWireCloseCode(JsonNode result) {
        int code = result == null ? -1 : result.path("closeCode").asInt(-1);
        return code >= 1000 && code <= 4999 ? Integer.toString(code) : "UNAVAILABLE";
    }

    private static String safeWireCloseReason(JsonNode result) {
        String reason = result == null ? "" : result.path("closeReason").asText();
        if (reason.isEmpty()) return "NONE";
        return SAFE_TDS_CLOSE_REASONS.contains(reason) ? reason : "UNRECOGNIZED";
    }

    private static boolean safeWireSessionIdPresent(JsonNode result) {
        return result != null
                && result.path("sessionId").isTextual()
                && !result.path("sessionId").asText().isBlank();
    }

    private static void logWireClientResult(
            Process node,
            Path stderrLog,
            String expectedScenario,
            String exitCode,
            long elapsedMillis,
            String stdoutShape,
            JsonNode result) {
        String actualScenario = result == null
                ? "UNAVAILABLE"
                : safeWireScenario(result.path("scenario").asText());
        System.out.printf(
                ("BACKEND_ACCEPTANCE_WIRE_CLIENT stage=RESULT expectedScenario=%s actualScenario=%s markerId=%s "
                        + "clientPid=%d parentPid=%d exitCode=%s elapsedMillis=%d stdoutShape=%s "
                        + "resultStatus=%s closeCode=%s closeReason=%s failureCategory=%s sessionIdPresent=%s "
                        + "signalDiagnostic=%s%n"),
                safeWireScenario(expectedScenario),
                actualScenario,
                safeWireLogMarker(stderrLog),
                node.pid(),
                ProcessHandle.current().pid(),
                exitCode,
                elapsedMillis,
                stdoutShape,
                safeWireStatus(result),
                safeWireCloseCode(result),
                safeWireCloseReason(result),
                safeWireFailureCategory(result),
                safeWireSessionIdPresent(result),
                safeWireSignalDiagnostic(stderrLog));
    }

    private static String safeWireLogMarker(Path stderrLog) {
        if (stderrLog == null) return "NONE";
        String fileName = stderrLog.getFileName().toString();
        Matcher matcher = SAFE_WIRE_LOG_MARKER_FILE.matcher(fileName);
        return matcher.matches() ? matcher.group(1) : "NONE";
    }

    private static String safeWireSignalDiagnostic(Path stderrLog) {
        if (stderrLog == null || !Files.isRegularFile(stderrLog)) return "UNAVAILABLE";
        try (Stream<String> lines = Files.lines(stderrLog, StandardCharsets.UTF_8)) {
            return lines.filter(line -> line.startsWith("TERMINAL_WIRE_STAGE=PROCESS_SIGNAL "))
                    .map(line -> {
                        Matcher matcher = SAFE_WIRE_SIGNAL_DIAGNOSTIC.matcher(line);
                        if (!matcher.matches()) return "TERMINAL_WIRE_PROCESS_SIGNAL_LINE_INVALID";
                        return matcher.group(1) + ":" + matcher.group(4) + ":" + matcher.group(5) + ":"
                                + matcher.group(8) + ":" + matcher.group(2);
                    })
                    .reduce((first, latest) -> latest)
                    .orElse("NONE");
        } catch (IOException unreadableLog) {
            return "UNAVAILABLE";
        }
    }

    private static String relevantLogLines(String contents, String... markers) {
        List<String> matching = contents.lines()
                .filter(line -> java.util.Arrays.stream(markers).anyMatch(line::contains))
                .toList();
        int start = Math.max(0, matching.size() - 6);
        return String.join(" | ", matching.subList(start, matching.size()));
    }

    private static Process startWireClient(Map<String, Object> request, Path stderr, boolean keepInputOpen)
            throws Exception {
        Path script = terminalWireClientScript();
        Process node = new ProcessBuilder(requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY"), script.toString())
                .directory(Path.of(System.getProperty("user.dir")).toFile())
                .redirectError(ProcessBuilder.Redirect.appendTo(stderr.toFile()))
                .start();
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = safeWireScenario(String.valueOf(request.getOrDefault("scenario", "UNRECOGNIZED")));
        String markerId = safeWireLogMarker(stderr);
        writeWireLifecycleLog(
                stderr,
                String.format(
                        ("stage=SPAWNED timestampUtc=%s runId=%s scenario=%s markerId=%s clientPid=%d "
                                + "parentPid=%d keepInputOpen=%s"),
                        Instant.now(),
                        runId,
                        scenario,
                        markerId,
                        node.pid(),
                        ProcessHandle.current().pid(),
                        keepInputOpen));
        OutputStream input = node.getOutputStream();
        input.write((JSON.writeValueAsString(request) + "\n").getBytes(StandardCharsets.UTF_8));
        input.flush();
        if (!keepInputOpen) input.close();
        return node;
    }

    private static void awaitWireMarker(Path log, String marker, Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (Files.isRegularFile(log)
                    && Files.readString(log, StandardCharsets.UTF_8).contains(marker)) return;
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException("TERMINAL_WIRE_CLIENT_MARKER_DEADLINE_EXCEEDED");
    }

    private static boolean awaitWireMarkerOrClientExit(Process wireClient, Path log, String marker, Duration timeout)
            throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (Files.isRegularFile(log)
                    && Files.readString(log, StandardCharsets.UTF_8).contains(marker)) return true;
            if (!wireClient.isAlive()) return false;
            TimeUnit.MILLISECONDS.sleep(25);
        }
        return Files.isRegularFile(log)
                && Files.readString(log, StandardCharsets.UTF_8).contains(marker);
    }

    private static JsonNode awaitWireResult(Process node, Path stderrLog, Duration timeout, String expectedScenario)
            throws Exception {
        long startedNanos = System.nanoTime();
        boolean exited = node.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
        if (!exited) logWireClientResult(node, stderrLog, expectedScenario, "RUNNING", elapsedMillis, "NOT_READ", null);
        Assertions.assertTrue(exited, "TERMINAL_WIRE_CLIENT_DEADLINE_EXCEEDED");
        String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        JsonNode result = null;
        String stdoutShape;
        if (output.isEmpty()) {
            stdoutShape = "EMPTY";
        } else if (output.contains("\n")) {
            stdoutShape = "MULTILINE";
        } else {
            try {
                result = JSON.readTree(output);
                stdoutShape = result != null && result.isObject() ? "SINGLE_LINE_JSON_OBJECT" : "NON_OBJECT_JSON";
            } catch (IOException invalidJson) {
                stdoutShape = "INVALID_JSON";
            }
        }
        logWireClientResult(
                node,
                stderrLog,
                expectedScenario,
                Integer.toString(node.exitValue()),
                elapsedMillis,
                stdoutShape,
                result);
        Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO");
        Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
        Assertions.assertNotNull(result, "TERMINAL_WIRE_CLIENT_OUTPUT_JSON_INVALID");
        Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
        return result;
    }

    @FunctionalInterface
    private interface CleanupStep {
        void run() throws Exception;
    }

    private static Throwable attemptCleanup(Throwable firstFailure, CleanupStep cleanupStep) {
        try {
            cleanupStep.run();
            return firstFailure;
        } catch (Exception | Error cleanupFailure) {
            if (firstFailure == null) return cleanupFailure;
            firstFailure.addSuppressed(cleanupFailure);
            return firstFailure;
        }
    }

    private static void finishCleanup(Throwable scenarioFailure, Throwable cleanupFailure) throws Exception {
        if (cleanupFailure == null) return;
        if (scenarioFailure != null) {
            if (scenarioFailure != cleanupFailure) scenarioFailure.addSuppressed(cleanupFailure);
            return;
        }
        if (cleanupFailure instanceof Exception exception) throw exception;
        if (cleanupFailure instanceof Error error) throw error;
        throw new IllegalStateException("BACKEND_ACCEPTANCE_CLEANUP_FAILED", cleanupFailure);
    }

    private static void stopOwnedClient(Process node) throws Exception {
        stopOwnedClient(node, null);
    }

    private static void stopOwnedClient(Process node, Path stderrLog) throws Exception {
        if (node == null) return;
        long startedNanos = System.nanoTime();
        boolean stopRequested = node.isAlive();
        boolean forced = false;
        writeWireLifecycleLog(
                stderrLog,
                String.format(
                        ("stage=STOP_DECISION timestampUtc=%s runId=%s markerId=%s clientPid=%d parentPid=%d "
                                + "aliveBeforeStop=%s actor=TerminalConnectionContractScenarios.stopOwnedClient"),
                        Instant.now(),
                        safeRunId(),
                        stderrLog == null ? "NONE" : safeWireLogMarker(stderrLog),
                        node.pid(),
                        ProcessHandle.current().pid(),
                        stopRequested));
        if (stopRequested) {
            try {
                node.getOutputStream().close();
            } catch (IOException ignored) {
                // The process may already have closed its control input.
            }
            node.destroy();
        }
        boolean stopped = !node.isAlive() || node.waitFor(2, TimeUnit.SECONDS);
        if (!stopped) {
            forced = true;
            node.destroyForcibly();
            stopped = node.waitFor(2, TimeUnit.SECONDS);
        }
        writeWireLifecycleLog(
                stderrLog,
                String.format(
                        ("stage=CLEANUP timestampUtc=%s runId=%s markerId=%s clientPid=%d parentPid=%d "
                                + "exitCode=%s stopRequested=%s forced=%s elapsedMillis=%d signalDiagnostic=%s"),
                        Instant.now(),
                        safeRunId(),
                        stderrLog == null ? "NONE" : safeWireLogMarker(stderrLog),
                        node.pid(),
                        ProcessHandle.current().pid(),
                        stopped ? Integer.toString(node.exitValue()) : "RUNNING",
                        stopRequested,
                        forced,
                        TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos),
                        stderrLog == null ? "UNAVAILABLE" : safeWireSignalDiagnostic(stderrLog)));
        Assertions.assertTrue(stopped, "TERMINAL_WIRE_CLIENT_CLEANUP_FAILED");
    }

    private static void assertCancelledSession(JsonNode result, String scenario) {
        Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
        Assertions.assertEquals(scenario, result.path("scenario").asText());
        Assertions.assertEquals(4000, result.path("closeCode").asInt());
        Assertions.assertEquals(
                "ACTIVATION_CANCELLED", result.path("closeReason").asText());
        Assertions.assertTrue(result.path("sessionId").isTextual(), "V-S10_SESSION_ID_MISSING");
    }

    private static void awaitSessionDisconnectRecord(
            BackendAcceptanceTest host, UUID terminalRef, String sessionId, Duration timeout) throws Exception {
        Assertions.assertFalse(sessionId == null || sessionId.isBlank(), "V-S10_SESSION_ID_MISSING");
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            long matches = host.count(
                    "SELECT count(*) FROM terminal_connection.latest_state "
                            + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NOT NULL "
                            + "AND close_reason='ACTIVATION_CANCELLED'",
                    terminalRef,
                    sessionId);
            if (matches == 1) return;
            TimeUnit.MILLISECONDS.sleep(100);
        }
        throw new IllegalStateException("V-S10_EXPECTED_SESSION_DISCONNECT_RECORD_MISSING");
    }

    private static void awaitAnySessionDisconnectRecord(
            BackendAcceptanceTest host, UUID terminalRef, String sessionId, Duration timeout) throws Exception {
        Assertions.assertFalse(sessionId == null || sessionId.isBlank(), "V-S14_SESSION_ID_MISSING");
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            long matches = host.count(
                    "SELECT count(*) FROM terminal_connection.latest_state "
                            + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NOT NULL",
                    terminalRef,
                    sessionId);
            if (matches == 1) return;
            TimeUnit.MILLISECONDS.sleep(100);
        }
        throw new IllegalStateException("V-S14_EXPECTED_SESSION_DISCONNECT_RECORD_MISSING");
    }

    private static SessionProbe startSessionProbe(
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            String scenario,
            String markerId,
            Path log)
            throws Exception {
        Map<String, Object> request = Map.of(
                "scenario",
                scenario,
                "markerId",
                markerId,
                "url",
                tds.websocketBaseUrl() + "/tdp/" + fixture.fixture().groupWorkspaceKey() + "/ws",
                "authenticate",
                Map.of(
                        "type",
                        "AUTHENTICATE",
                        "terminalRef",
                        fixture.terminalRef().toString(),
                        "terminalCredential",
                        fixture.generation() + "." + fixture.credentialSecret(),
                        "deviceId",
                        fixture.deviceId(),
                        "appVersion",
                        "backend-acceptance"));
        Process node = startWireClient(request, log, true);
        return new SessionProbe(node, log, markerId);
    }

    private static final class SessionProbe {
        private final Process node;
        private final Path log;
        private final String markerId;
        private final OutputStream input;
        private int pongCount;
        private int pendingPingSequence = -1;
        private String commandStage = "STARTING";

        private SessionProbe(Process node, Path log, String markerId) {
            this.node = node;
            this.log = log;
            this.markerId = markerId;
            this.input = node.getOutputStream();
        }

        void awaitReady(Duration timeout) throws Exception {
            awaitWireMarker(log, "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " sessionId=", timeout);
            commandStage = "READY";
        }

        void ping(int sequence) throws Exception {
            pendingPingSequence = sequence;
            commandStage = "PING_COMMAND_WRITE";
            JsonNode exited = sendControlCommand("PING", "PING\t" + sequence, false);
            Assertions.assertNull(exited, "TERMINAL_WIRE_SESSION_PROBE_EXITED_BEFORE_PONG");
            commandStage = "WAITING_FOR_PONG";
            awaitPong(sequence, Duration.ofSeconds(15));
            pongCount++;
            pendingPingSequence = -1;
            commandStage = "PONG_CONFIRMED";
        }

        JsonNode finish(Duration timeout) throws Exception {
            commandStage = "CLOSE_COMMAND_WRITE";
            JsonNode result = sendControlCommand("CLOSE", "CLOSE", true);
            JsonNode completed = result == null ? awaitProbeResult(timeout, "CLOSE_RESULT") : result;
            commandStage = "CLOSE_CONFIRMED";
            return completed;
        }

        JsonNode awaitClose(int code, String reason, Duration timeout) throws Exception {
            commandStage = "AWAIT_CLOSE_COMMAND_WRITE";
            JsonNode result = sendControlCommand("AWAIT_CLOSE", "AWAIT_CLOSE\t" + code + "\t" + reason, true);
            if (result == null) result = awaitProbeResult(timeout, "AWAIT_CLOSE_RESULT");
            Assertions.assertEquals(code, result.path("closeCode").asInt());
            Assertions.assertEquals(reason, result.path("closeReason").asText());
            Assertions.assertEquals(sessionId(), result.path("sessionId").asText(), "V-S12_SESSION_ID_CHANGED");
            commandStage = "EXPECTED_CLOSE_CONFIRMED";
            return result;
        }

        private void awaitPong(int sequence, Duration timeout) throws Exception {
            String marker = "TERMINAL_WIRE_SESSION_PONG markerId=" + markerId + " seq=" + sequence;
            long deadline = System.nanoTime() + timeout.toNanos();
            while (System.nanoTime() < deadline) {
                if (Files.isRegularFile(log)
                        && Files.readString(log, StandardCharsets.UTF_8).contains(marker)) return;
                if (!node.isAlive()) {
                    awaitProbeResult(Duration.ofSeconds(2), "PING_CHILD_EXITED_BEFORE_PONG");
                    throw new IllegalStateException("TERMINAL_WIRE_SESSION_PROBE_EXITED_BEFORE_PONG");
                }
                TimeUnit.MILLISECONDS.sleep(50);
            }
            throw new IllegalStateException("TERMINAL_WIRE_SESSION_PROBE_PONG_DEADLINE_EXCEEDED");
        }

        private JsonNode sendControlCommand(String stage, String command, boolean closeInput) throws Exception {
            String commandKind = probeCommandKind(command);
            String sequence = probeCommandSequence(command);
            if (!node.isAlive()) {
                writeWireLifecycleLog(
                        log,
                        String.format(
                                ("stage=COMMAND_WRITE_SKIPPED timestampUtc=%s runId=%s markerId=%s commandStage=%s "
                                        + "command=%s sequence=%s clientPid=%d exitCode=%d"),
                                Instant.now(),
                                safeRunId(),
                                markerId,
                                stage,
                                commandKind,
                                sequence,
                                node.pid(),
                                node.exitValue()));
                return awaitProbeResult(Duration.ofSeconds(2), stage + "_CHILD_EXITED_BEFORE_WRITE");
            }
            try {
                writeWireLifecycleLog(
                        log,
                        String.format(
                                ("stage=COMMAND_WRITE_STARTED timestampUtc=%s runId=%s markerId=%s commandStage=%s "
                                        + "command=%s sequence=%s clientPid=%d"),
                                Instant.now(),
                                safeRunId(),
                                markerId,
                                stage,
                                commandKind,
                                sequence,
                                node.pid()));
                input.write((command + "\n").getBytes(StandardCharsets.US_ASCII));
                input.flush();
                writeWireLifecycleLog(
                        log,
                        String.format(
                                ("stage=COMMAND_WRITE_COMPLETED timestampUtc=%s runId=%s markerId=%s commandStage=%s "
                                        + "command=%s sequence=%s clientPid=%d aliveAfterWrite=%s"),
                                Instant.now(),
                                safeRunId(),
                                markerId,
                                stage,
                                commandKind,
                                sequence,
                                node.pid(),
                                node.isAlive()));
                if (!closeInput) return null;
                try {
                    input.close();
                    return null;
                } catch (IOException closeFailure) {
                    if (node.isAlive()) {
                        throw new IllegalStateException(
                                "TERMINAL_WIRE_SESSION_PROBE_CONTROL_CLOSE_FAILED", closeFailure);
                    }
                    return awaitProbeResult(Duration.ofSeconds(2), stage + "_CHILD_EXITED_DURING_CLOSE");
                }
            } catch (IOException writeFailure) {
                if (node.isAlive()) {
                    throw new IllegalStateException("TERMINAL_WIRE_SESSION_PROBE_CONTROL_WRITE_FAILED", writeFailure);
                }
                return awaitProbeResult(Duration.ofSeconds(2), stage + "_CHILD_EXITED_DURING_WRITE");
            }
        }

        private JsonNode awaitProbeResult(Duration timeout, String stage) throws Exception {
            long startedNanos = System.nanoTime();
            boolean exited = node.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            writeWireLifecycleLog(
                    log,
                    String.format(
                            ("stage=EXIT_OBSERVED timestampUtc=%s runId=%s markerId=%s resultStage=%s "
                                    + "clientPid=%d exitCode=%s elapsedMillis=%d"),
                            Instant.now(),
                            safeRunId(),
                            markerId,
                            stage,
                            node.pid(),
                            exited ? Integer.toString(node.exitValue()) : "RUNNING",
                            TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos)));
            Assertions.assertTrue(exited, "TERMINAL_WIRE_SESSION_PROBE_RESULT_DEADLINE_EXCEEDED");
            String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            String stdoutShape = output.isEmpty() ? "EMPTY" : output.contains("\n") ? "MULTILINE" : "SINGLE_LINE";
            String firstAssertion = node.exitValue() != 0
                    ? "TERMINAL_WIRE_SESSION_PROBE_EXIT_NONZERO"
                    : output.contains("\n") ? "TERMINAL_WIRE_SESSION_PROBE_OUTPUT_CARDINALITY_INVALID" : "NONE";
            writeWireLifecycleLog(
                    log,
                    String.format(
                            ("stage=RESULT_BEFORE_ASSERT timestampUtc=%s runId=%s markerId=%s resultStage=%s "
                                    + "clientPid=%d exitCode=%d stdoutShape=%s firstAssertion=%s signalDiagnostic=%s"),
                            Instant.now(),
                            safeRunId(),
                            markerId,
                            stage,
                            node.pid(),
                            node.exitValue(),
                            stdoutShape,
                            firstAssertion,
                            safeWireSignalDiagnostic(log)));
            Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_SESSION_PROBE_EXIT_NONZERO");
            Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_SESSION_PROBE_OUTPUT_CARDINALITY_INVALID");
            JsonNode result;
            try {
                result = JSON.readTree(output);
            } catch (Exception invalidResult) {
                writeWireLifecycleLog(
                        log,
                        String.format(
                                ("stage=RESULT_SHAPE_INVALID timestampUtc=%s runId=%s markerId=%s "
                                        + "resultStage=%s clientPid=%d exitCode=%d stdoutShape=%s failureCategory=%s"),
                                Instant.now(),
                                safeRunId(),
                                markerId,
                                stage,
                                node.pid(),
                                node.exitValue(),
                                stdoutShape,
                                "TERMINAL_WIRE_SESSION_PROBE_RESULT_INVALID"));
                throw new IllegalStateException("TERMINAL_WIRE_SESSION_PROBE_RESULT_INVALID", invalidResult);
            }
            String resultStatus = result.path("status").asText("UNKNOWN");
            String closeReason = result.path("closeReason").asText();
            String safeCloseReason = SAFE_TDS_CLOSE_REASONS.contains(closeReason) ? closeReason : "UNRECOGNIZED";
            String failureCategory = result.path("failureCategory").asText();
            if (!failureCategory.matches("TERMINAL_WIRE_[A-Z0-9_]+")) failureCategory = "UNCLASSIFIED";
            writeWireLifecycleLog(
                    log,
                    String.format(
                            ("stage=RESULT_PARSED timestampUtc=%s runId=%s markerId=%s resultStage=%s "
                                    + "clientPid=%d exitCode=%d resultStatus=%s closeCode=%d closeReason=%s "
                                    + "failureCategory=%s sessionIdPresent=%s"),
                            Instant.now(),
                            safeRunId(),
                            markerId,
                            stage,
                            node.pid(),
                            node.exitValue(),
                            resultStatus,
                            result.path("closeCode").asInt(-1),
                            safeCloseReason,
                            failureCategory,
                            result.path("sessionId").isTextual()));
            Assertions.assertEquals("PASS", resultStatus, "TERMINAL_WIRE_SESSION_PROBE_CONTRACT_FAILED");
            return result;
        }

        int pongCount() {
            return pongCount;
        }

        String sessionId() throws Exception {
            String prefix = "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " sessionId=";
            for (String line : Files.readAllLines(log, StandardCharsets.UTF_8)) {
                int start = line.indexOf(prefix);
                if (start < 0) continue;
                String value = line.substring(start + prefix.length()).trim();
                int end = value.indexOf(' ');
                return end < 0 ? value : value.substring(0, end);
            }
            throw new IllegalStateException("TERMINAL_WIRE_SESSION_ID_MARKER_MISSING");
        }

        void stop() throws Exception {
            stopOwnedClient(node, log);
        }
    }

    private static JsonNode runWireClient(TdsAcceptanceProcess tds, Map<String, Object> request) throws Exception {
        Path script = terminalWireClientScript();
        Path stderr = tds.directory().resolve("terminal-wire-client.log");
        Process node = new ProcessBuilder(requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY"), script.toString())
                .directory(Path.of(System.getProperty("user.dir")).toFile())
                .redirectError(ProcessBuilder.Redirect.appendTo(stderr.toFile()))
                .start();
        Throwable scenarioFailure = null;
        try {
            node.getOutputStream().write((JSON.writeValueAsString(request) + "\n").getBytes(StandardCharsets.UTF_8));
            node.getOutputStream().close();
            return awaitWireResult(
                    node, stderr, CLIENT_DEADLINE, String.valueOf(request.getOrDefault("scenario", "UNRECOGNIZED")));
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Process clientToStop = node;
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop, stderr));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void assertNegotiatedExtension(String scenario, String response) {
        Set<String> requiresCompression = Set.of(
                "terminal.connection.compression.offer-bare",
                "terminal.connection.compression.offer-client-max-window-bits");
        if (!requiresCompression.contains(scenario)) {
            Assertions.assertTrue(
                    response == null || response.isBlank() || !hasPmdExtension(response),
                    "TERMINAL_WIRE_UNEXPECTED_EXTENSION_RESPONSE");
            return;
        }
        Assertions.assertTrue(hasPmdExtension(response), "TERMINAL_WIRE_REQUIRED_EXTENSION_RESPONSE_MISSING");
    }

    private static boolean hasPmdExtension(String response) {
        if (response == null || response.isBlank()) return false;
        return java.util.Arrays.stream(response.split(","))
                .map(extension -> extension.split(";", 2)[0].trim())
                .anyMatch("permessage-deflate"::equalsIgnoreCase);
    }

    private static List<String> strings(JsonNode node) {
        Assertions.assertTrue(node.isArray(), "TERMINAL_WIRE_CLIENT_ARRAY_FIELD_MISSING");
        List<String> result = new ArrayList<>();
        node.forEach(value -> {
            Assertions.assertTrue(value.isTextual(), "TERMINAL_WIRE_CLIENT_ARRAY_VALUE_INVALID");
            result.add(value.asText());
        });
        return List.copyOf(result);
    }

    private static boolean isOversizedMessageRejection(String scenario) {
        return Set.of(
                        "terminal.connection.frame.raw-overflow",
                        "terminal.connection.frame.compressed-single-overflow",
                        "terminal.connection.frame.compressed-fragmented-overflow")
                .contains(scenario);
    }

    private static boolean isExactBoundaryMessage(String scenario) {
        return "terminal.connection.frame.exact-boundary".equals(scenario);
    }

    private record WireCase(
            String scenario,
            String extensionOffer,
            boolean includeExtensionOffer,
            boolean requiresAuthentication,
            Map<String, Object> expectedClose) {}

    private static String classify(Exception ignored) {
        return "TERMINAL_WIRE_CLIENT_FAILED";
    }

    private static void writeContractResult(Map<String, Object> value) throws Exception {
        Path resultPath = Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_RESULT"))
                .toAbsolutePath()
                .normalize();
        Files.createDirectories(resultPath.getParent());
        Files.writeString(
                resultPath,
                JSON.writeValueAsString(value) + "\n",
                StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND);
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        Assertions.assertTrue(value != null && !value.isBlank(), name + " must be supplied by backend-acceptance");
        return value;
    }
}
