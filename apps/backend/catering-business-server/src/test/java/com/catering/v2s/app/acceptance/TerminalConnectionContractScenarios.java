package com.catering.v2s.app.acceptance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DynamicTest;

/** TDS transport CONTRACT producers. Results are kept outside the business scenario catalog. */
final class TerminalConnectionContractScenarios {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Duration CLIENT_DEADLINE = Duration.ofSeconds(15);
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
                            "failureCategory",
                            "TDS_VS10_REVOCATION_RACE_FAILED"));
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
            }
            throw failure;
        } finally {
            Throwable cleanupFailure =
                    attemptCleanup(null, () -> tds.registrationGateBroker().cancel(gate));
            Process clientToStop = node;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(clientToStop));
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
            JsonNode result = awaitWireResult(node, Duration.ofSeconds(20));
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
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop));
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
            JsonNode closed = awaitWireResult(target, Duration.ofSeconds(20));
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
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(targetToStop));
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
            JsonNode replaced = awaitWireResult(oldClient, Duration.ofSeconds(10));
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
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(oldClientToStop));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    static Stream<DynamicTest> v12DatabaseOutageScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(10, 30)
                .map(seconds -> DynamicTest.dynamicTest(
                        "terminal.connection.vs12.database-outage-" + seconds + "s",
                        () -> v12DatabaseOutageScenario(host, tds, seconds)));
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
        Process authNode = null;
        int oldBackendPid = -1;
        long pauseStartedNanos = 0;
        int tdsLogOffset = 0;
        Throwable scenarioFailure = null;
        try {
            probe = startSessionProbe(
                    tds,
                    existing,
                    "terminal.connection.vs12.database-outage-probe",
                    markerId,
                    wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(10));
            oldBackendPid = tds.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = tds.registrationGateBroker().armNextListenerRecovery();
            String containerId = host.postgresContainerId();
            tdsLogOffset = tds.logContents().length();
            host.pausePostgresContainer();
            postgresPaused = true;
            pauseStartedNanos = System.nanoTime();
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_OUTAGE stage=PAUSED runId=%s containerId=%s durat"
                            + "ionSeconds=%d listenerBackendPid=%d%n"),
                    runId,
                    containerId,
                    outageSeconds,
                    oldBackendPid);

            probe.ping(1);
            Path authLog = wireClientLog(tds, UUID.randomUUID().toString());
            Map<String, Object> authRequest = closeExpectedRequest(
                    tds,
                    newAuthentication,
                    "terminal.connection.vs12.auth-during-outage",
                    UUID.randomUUID().toString(),
                    4000,
                    "SERVER_ERROR");
            long authenticationStarted = System.nanoTime();
            authNode = startWireClient(authRequest, authLog, false);
            JsonNode authResult = awaitWireResult(authNode, Duration.ofSeconds(15));
            long authenticationElapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - authenticationStarted);
            Assertions.assertEquals(
                    "SERVER_ERROR", authResult.path("closeReason").asText());
            Assertions.assertTrue(
                    authenticationElapsedMillis <= Duration.ofSeconds(10).toMillis(),
                    "V-S12_NEW_AUTH_SERVER_ERROR_EXCEEDED_FIRST_FRAME_DEADLINE");

            attemptId = awaitRegistrationGateObservation(
                    recoveryGate, Duration.ofSeconds(15), probe.node, wireClientLog(tds, markerId), tds);
            tds.awaitListenerDisconnected(oldBackendPid, Duration.ofSeconds(3));
            int sequence = 2;
            long outageDeadline = pauseStartedNanos + TimeUnit.SECONDS.toNanos(outageSeconds);
            while (System.nanoTime() < outageDeadline) {
                probe.ping(sequence++);
                long remaining = outageDeadline - System.nanoTime();
                if (remaining > 0) TimeUnit.NANOSECONDS.sleep(Math.min(remaining, TimeUnit.SECONDS.toNanos(1)));
            }
            long pausedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - pauseStartedNanos);
            Assertions.assertTrue(pausedMillis >= outageSeconds * 1000L, "V-S12_POSTGRES_PAUSE_TOO_SHORT");
            String tdsLog = tds.logContents();
            Assertions.assertTrue(tdsLog.length() >= tdsLogOffset, "V-S12_TDS_LOG_OFFSET_INVALID");
            assertPendingWriterQueueBounds(tdsLog.substring(tdsLogOffset), 1);

            host.unpausePostgresContainer();
            postgresPaused = false;
            business.performConnectionRevocation(
                    context, existing, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND disconnected_at_epoch_millis IS NULL",
                            existing.terminalRef()),
                    "V-S12_SESSION_MUST_REMAIN_OPEN_WHILE_LISTENER_RECOVERY_IS_HELD");
            recoveryGate.release(attemptId);
            recoveryGate = null;
            int newBackendPid = tds.awaitListenerReadyAfter(oldBackendPid, Duration.ofSeconds(30));
            JsonNode revoked = probe.awaitClose(4000, "ACTIVATION_CANCELLED", Duration.ofSeconds(10));
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
                    Map.entry("reconnectedBackendPid", newBackendPid),
                    Map.entry("sessionId", revoked.path("sessionId").asText()),
                    Map.entry("pongsDuringOutage", probe.pongCount()),
                    Map.entry(
                            "newAuthenticationCloseReason",
                            authResult.path("closeReason").asText()),
                    Map.entry("newAuthenticationElapsedMillis", authenticationElapsedMillis)));
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_OUTAGE stage=PASS runId=%s durationSeconds=%d pau"
                            + "sedMillis=%d listenerPid=%d->%d pongs=%d newAuth=SERVER_ERROR authElapse"
                            + "dMillis=%d%n"),
                    runId,
                    outageSeconds,
                    pausedMillis,
                    oldBackendPid,
                    newBackendPid,
                    probe.pongCount(),
                    authenticationElapsedMillis);
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
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
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(authClientToStop));
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
                                "terminal.connection.compression.offer-both-no-context",
                                "permessage-deflate; client_no_context_takeover; server_no_context_takeover",
                                true,
                                false,
                                null),
                        new WireCase(
                                "terminal.connection.compression.offer-deflate-frame",
                                "deflate-frame",
                                true,
                                false,
                                null),
                        new WireCase(
                                "terminal.connection.compression.offer-malformed-duplicate",
                                "permessage-deflate; client_no_context_takeover; client_no_context_takeover",
                                true,
                                false,
                                null),
                        new WireCase(
                                "terminal.connection.compression.offer-deflate-frame-and-pmd",
                                "deflate-frame, permessage-deflate",
                                true,
                                false,
                                null),
                        new WireCase(
                                "terminal.connection.compression.session-negotiated",
                                "permessage-deflate",
                                false,
                                true,
                                null),
                        new WireCase("terminal.connection.compression.session-fallback", null, false, true, null),
                        new WireCase(
                                "terminal.connection.frame.rsv1-first",
                                null,
                                false,
                                true,
                                Map.of("code", 1002, "reason", "PROTOCOL_ERROR")),
                        new WireCase(
                                "terminal.connection.frame.rsv1-later",
                                null,
                                false,
                                true,
                                Map.of("code", 1002, "reason", "PROTOCOL_ERROR")),
                        new WireCase(
                                "terminal.connection.frame.rsv1-control-before",
                                null,
                                false,
                                false,
                                Map.of("code", 1002, "reason", "PROTOCOL_ERROR")),
                        new WireCase(
                                "terminal.connection.frame.rsv1-control-after",
                                "permessage-deflate",
                                false,
                                true,
                                Map.of("code", 1002, "reason", "PROTOCOL_ERROR")),
                        new WireCase(
                                "terminal.connection.frame.rsv2",
                                null,
                                false,
                                true,
                                Map.of("code", 1002, "reason", "PROTOCOL_ERROR")),
                        new WireCase(
                                "terminal.connection.frame.rsv3",
                                null,
                                false,
                                true,
                                Map.of("code", 1002, "reason", "PROTOCOL_ERROR")),
                        new WireCase(
                                "terminal.connection.frame.raw-overflow",
                                null,
                                false,
                                true,
                                Map.of("code", 1009, "reason", "MESSAGE_TOO_BIG")),
                        new WireCase(
                                "terminal.connection.frame.compressed-single-overflow",
                                "permessage-deflate",
                                false,
                                true,
                                Map.of("code", 1009, "reason", "MESSAGE_TOO_BIG")),
                        new WireCase(
                                "terminal.connection.frame.compressed-fragmented-overflow",
                                "permessage-deflate",
                                false,
                                true,
                                Map.of("code", 1009, "reason", "MESSAGE_TOO_BIG")),
                        new WireCase(
                                "terminal.connection.frame.exact-boundary",
                                null,
                                false,
                                true,
                                Map.of("code", 4000, "reason", "UNKNOWN")))
                .map(testCase -> DynamicTest.dynamicTest(testCase.scenario(), () -> v14Scenario(host, tds, testCase)));
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
                        negotiated ? List.of("SESSION_READY", "PONG") : List.of(),
                        strings(result.path("serverCompressedTypes")),
                        "TERMINAL_WIRE_SERVER_COMPRESSION_DIRECTION_INVALID");
            } else if (testCase.expectedClose() != null) {
                Assertions.assertEquals(
                        testCase.expectedClose().get("code"),
                        result.path("closeCode").asInt());
                Assertions.assertEquals(
                        testCase.expectedClose().get("reason"),
                        result.path("closeReason").asText());
                List<String> expectedEvents = testCase.scenario().endsWith("rsv1-later")
                                || testCase.scenario().endsWith("rsv1-control-after")
                        ? List.of("SESSION_READY")
                        : List.of();
                Assertions.assertEquals(expectedEvents, strings(result.path("eventTypes")));
            }

            if (fixture != null && isPreAuthenticationProtocolRejection(testCase.scenario())) {
                Assertions.assertFalse(
                        tds.logContents()
                                .contains("event=tds_ws_credential_verified terminalRef=" + fixture.terminalRef()),
                        "V-S14 rejected frame must not reach credential verification");
                Assertions.assertEquals(
                        0L,
                        host.count(
                                "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref = ?",
                                fixture.terminalRef()),
                        "V-S14 rejected frame must not open a TDS session row");
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
                    "TERMINAL_WIRE_SESSION_READY markerId=");
            String tdsStages = relevantLogLines(
                    tds.logContents(),
                    "event=tds_ws_accepted",
                    "event=tds_ws_first_frame_received",
                    "event=tds_ws_authentication_failed",
                    "event=tds_ws_credential_verification_completed",
                    "event=tds_ws_pre_registration_gate_entered");
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
                    + ",scenario=" + result.path("scenario").asText("unknown")
                    + ",status=" + result.path("status").asText("unknown")
                    + ",failureCategory=" + result.path("failureCategory").asText("none")
                    + ",closeCode=" + result.path("closeCode").asText("none")
                    + ",closeReason=" + result.path("closeReason").asText("none");
        } catch (Exception ignored) {
            return "exitCode=" + wireClient.exitValue() + ",result=invalid-json";
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

    private static JsonNode awaitWireResult(Process node, Duration timeout) throws Exception {
        Assertions.assertTrue(
                node.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS), "TERMINAL_WIRE_CLIENT_DEADLINE_EXCEEDED");
        String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO");
        Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
        JsonNode result = JSON.readTree(output);
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
        if (node == null || !node.isAlive()) return;
        try {
            node.getOutputStream().close();
        } catch (IOException ignored) {
            // The process may already have closed its control input.
        }
        node.destroy();
        if (!node.waitFor(2, TimeUnit.SECONDS)) {
            node.destroyForcibly();
            Assertions.assertTrue(node.waitFor(2, TimeUnit.SECONDS), "TERMINAL_WIRE_CLIENT_CLEANUP_FAILED");
        }
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

        private SessionProbe(Process node, Path log, String markerId) {
            this.node = node;
            this.log = log;
            this.markerId = markerId;
            this.input = node.getOutputStream();
        }

        void awaitReady(Duration timeout) throws Exception {
            awaitWireMarker(log, "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " sessionId=", timeout);
        }

        void ping(int sequence) throws Exception {
            JsonNode exited = sendControlCommand("PING", "PING\t" + sequence, false);
            Assertions.assertNull(exited, "TERMINAL_WIRE_SESSION_PROBE_EXITED_BEFORE_PONG");
            awaitPong(sequence, Duration.ofSeconds(15));
            pongCount++;
        }

        JsonNode finish(Duration timeout) throws Exception {
            JsonNode result = sendControlCommand("CLOSE", "CLOSE", true);
            return result == null ? awaitProbeResult(timeout, "CLOSE_RESULT") : result;
        }

        JsonNode awaitClose(int code, String reason, Duration timeout) throws Exception {
            JsonNode result = sendControlCommand("AWAIT_CLOSE", "AWAIT_CLOSE\t" + code + "\t" + reason, true);
            if (result == null) result = awaitProbeResult(timeout, "AWAIT_CLOSE_RESULT");
            Assertions.assertEquals(code, result.path("closeCode").asInt());
            Assertions.assertEquals(reason, result.path("closeReason").asText());
            Assertions.assertEquals(sessionId(), result.path("sessionId").asText(), "V-S12_SESSION_ID_CHANGED");
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
            if (!node.isAlive()) return awaitProbeResult(Duration.ofSeconds(2), stage + "_CHILD_EXITED_BEFORE_WRITE");
            try {
                input.write((command + "\n").getBytes(StandardCharsets.US_ASCII));
                input.flush();
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
            Assertions.assertTrue(
                    node.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS),
                    "TERMINAL_WIRE_SESSION_PROBE_RESULT_DEADLINE_EXCEEDED");
            String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_SESSION_PROBE_OUTPUT_CARDINALITY_INVALID");
            JsonNode result;
            try {
                result = JSON.readTree(output);
            } catch (Exception invalidResult) {
                System.out.printf(
                        "BACKEND_ACCEPTANCE_SESSION_PROBE stage=%s markerId=%s exitCode=%d resultStatus=INVALID_JSON%n",
                        stage, markerId, node.exitValue());
                throw new IllegalStateException("TERMINAL_WIRE_SESSION_PROBE_RESULT_INVALID", invalidResult);
            }
            String resultStatus = result.path("status").asText("UNKNOWN");
            String closeReason = result.path("closeReason").asText();
            String safeCloseReason = SAFE_TDS_CLOSE_REASONS.contains(closeReason) ? closeReason : "UNRECOGNIZED";
            String failureCategory = result.path("failureCategory").asText();
            if (!failureCategory.matches("TERMINAL_WIRE_[A-Z0-9_]+")) failureCategory = "UNCLASSIFIED";
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_SESSION_PROBE stage=%s markerId=%s exitCode=%d resultStatus=%s "
                            + "closeCode=%d closeReason=%s failureCategory=%s sessionIdPresent=%s%n"),
                    stage,
                    markerId,
                    node.exitValue(),
                    resultStatus,
                    result.path("closeCode").asInt(-1),
                    safeCloseReason,
                    failureCategory,
                    result.path("sessionId").isTextual());
            Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_SESSION_PROBE_EXIT_NONZERO");
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
            stopOwnedClient(node);
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
            Assertions.assertTrue(
                    node.waitFor(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS),
                    "TERMINAL_WIRE_CLIENT_DEADLINE_EXCEEDED");
            String output = new String(node.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            Assertions.assertEquals(0, node.exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO");
            Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
            return JSON.readTree(output);
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Process clientToStop = node;
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void assertNegotiatedExtension(String scenario, String response) {
        Set<String> requiresCompression = Set.of(
                "terminal.connection.compression.offer-bare",
                "terminal.connection.compression.offer-client-max-window-bits",
                "terminal.connection.compression.offer-both-no-context",
                "terminal.connection.compression.offer-deflate-frame-and-pmd");
        if (!requiresCompression.contains(scenario)) {
            Assertions.assertTrue(
                    response == null || response.isBlank(), "TERMINAL_WIRE_UNEXPECTED_EXTENSION_RESPONSE");
            return;
        }
        Assertions.assertNotNull(response, "TERMINAL_WIRE_REQUIRED_EXTENSION_RESPONSE_MISSING");
        String[] parts = response.split(";");
        Assertions.assertEquals("permessage-deflate", parts[0].trim().toLowerCase());
        Set<String> parameters = new java.util.TreeSet<>();
        for (int index = 1; index < parts.length; index++) {
            Assertions.assertTrue(
                    parameters.add(parts[index].trim().toLowerCase()), "TERMINAL_WIRE_EXTENSION_PARAMETER_DUPLICATE");
        }
        Assertions.assertEquals(
                Set.of("client_no_context_takeover", "server_no_context_takeover"),
                parameters,
                "TERMINAL_WIRE_EXTENSION_PARAMETERS_INVALID");
    }

    private static List<String> strings(JsonNode node) {
        List<String> result = new ArrayList<>();
        if (node.isArray()) node.forEach(value -> result.add(value.asText()));
        return List.copyOf(result);
    }

    private static boolean isPreAuthenticationProtocolRejection(String scenario) {
        return Set.of(
                        "terminal.connection.frame.rsv1-first",
                        "terminal.connection.frame.rsv2",
                        "terminal.connection.frame.rsv3",
                        "terminal.connection.frame.raw-overflow",
                        "terminal.connection.frame.compressed-single-overflow",
                        "terminal.connection.frame.compressed-fragmented-overflow",
                        "terminal.connection.frame.exact-boundary")
                .contains(scenario);
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
