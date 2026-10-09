package com.catering.v2s.app.acceptance;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DynamicTest;

/** TDS transport CONTRACT producers. Results are kept outside the business scenario catalog. */
final class TerminalConnectionContractScenarios {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Duration CLIENT_DEADLINE = Duration.ofSeconds(15);
    private static final String V_S11_SEARCHED_OUTPUTS =
            "acceptance-run-directory-recursive:*.log,*.txt,*.json,*.jsonl,*.out;doris-history-row-columns";
    private static final ThreadLocal<Map<String, Object>> V8_SCAN_FAILURE_EVIDENCE = new ThreadLocal<>();
    private static final Pattern SAFE_WIRE_SIGNAL_DIAGNOSTIC =
            Pattern.compile("TERMINAL_WIRE_STAGE=PROCESS_SIGNAL signal=(SIGTERM) timestampUtc=([0-9TZ:.-]+) "
                    + "runId=(NONE|[A-Za-z0-9._-]{1,128}) scenario=(UNPARSED|terminal\\.[a-z0-9.-]{1,128}) "
                    + "markerId=(UNPARSED|NONE|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) "
                    + "stage=(PROCESS_STARTING|REQUEST_ACCEPTED|RESULT_READY|CLIENT_FAILED|WEBSOCKET_CONNECTING|"
                    + "WEBSOCKET_OPEN|AUTHENTICATE_SENT|WAITING_FOR_SERVER_CLOSE|SERVER_CLOSE_RECEIVED|"
                    + "SESSION_PROBE_READY|SESSION_PROBE_WAITING_FOR_COMMAND|SESSION_PROBE_COMMAND_RECEIVED|"
                    + "SESSION_PROBE_WAITING_FOR_PONG|SESSION_PROBE_WAITING_FOR_CLOSE|"
                    + "WAITING_FOR_EXACT_BOUNDARY_SESSION_READY|SESSION_READY_UNEXPECTED_FRAME) "
                    + "lastCommand=(NONE|PING|PING_BURST|CLOSE|AWAIT_CLOSE|INVALID) "
                    + "lastPingSequence=(NONE|[1-9][0-9]{0,8}) pid=[1-9][0-9]{0,19} "
                    + "ppid=[1-9][0-9]{0,19} senderPid=UNAVAILABLE_BY_NODE_SIGNAL_API exitCode=143");
    private static final Pattern SAFE_WIRE_LOG_MARKER_FILE =
            Pattern.compile("terminal-wire-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.log");
    private static final Pattern SAFE_FAILURE_TYPE = Pattern.compile("[A-Za-z_$][A-Za-z0-9_$]{0,63}");
    private static final Pattern SESSION_PROBE_PING_COMMAND =
            Pattern.compile("PING\\t([1-9][0-9]{0,8})(?:\\t(?:0|[1-9][0-9]{0,5})(?:\\.[0-9]{1,6})?)?");
    private static final Pattern SESSION_PROBE_PING_BURST_COMMAND = Pattern.compile("PING_BURST\\t([1-9][0-9]{0,3})");
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
            "SESSION_PROBE_SERVER_CLOSE",
            "SERVER_DECOMPRESSION_FAILED",
            "SESSION_READY_UNEXPECTED_FRAME",
            "REMOTE_COMMAND_WAITING",
            "REMOTE_COMMAND_RECEIVED",
            "REMOTE_REPORT_SENT",
            "REMOTE_REPORT_ACKNOWLEDGED",
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

    static Stream<DynamicTest> topicSubscriptionScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.topic.active-store-subscription", () -> activeStoreTopicSubscription(host, tds)));
    }

    static Stream<DynamicTest> terminalUpdateTopicScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.topic.terminal-update-rules", () -> terminalUpdateRuleTopicSubscription(host, tds)));
    }

    private static void terminalUpdateRuleTopicSubscription(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = TdsAcceptanceProcess.TdsStartConfiguration.TERMINAL_UPDATE_TOPIC_SCENARIO_ID;
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = null;
        TopicWireClient client = null;
        boolean fixtureCancelled = false;
        Throwable scenarioFailure = null;
        try {
            fixture = business.createConnectionContractFixture(context);
            UUID ruleRef = TerminalUpdateAcceptanceScenarios.createEnabledRuleForTopic(host, context, fixture.fixture());
            Map<String, Object> ownerTopicReadback = host.queryForMap(
                    "SELECT store.status AS store_status, project.status AS project_status, "
                            + "(SELECT topic_time_epoch_millis FROM terminal_update.read_rule_topic_time(?,?,?,?)) "
                            + "AS topic_time_epoch_millis FROM organization.store store "
                            + "JOIN organization.organization_node project ON project.id=store.project_id "
                            + "WHERE store.id=?",
                    fixture.fixture().workspaceUuid(), fixture.fixture().groupWorkspaceKey(),
                    fixture.fixture().storeId(), fixture.fixture().projectId(), fixture.fixture().storeId());
            Assertions.assertEquals("ENABLED", ownerTopicReadback.get("store_status"),
                    "CONTRACT SETUP: terminal topic store fixture is enabled");
            Assertions.assertEquals("ENABLED", ownerTopicReadback.get("project_status"),
                    "CONTRACT SETUP: terminal topic project fixture is enabled");
            Assertions.assertNotNull(ownerTopicReadback.get("topic_time_epoch_millis"),
                    "CONTRACT SETUP: TDS owner query resolves the exact enabled store/project pair");
            long expectedTopicTime = ((Number) ownerTopicReadback.get("topic_time_epoch_millis")).longValue();
            Assertions.assertTrue(expectedTopicTime > 0,
                    "CONTRACT SETUP: enabled rule creation advances the owner topic time");
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_TOPIC_OWNER_ORACLE workspaceUuid=%s groupWorkspaceKey=%s "
                            + "storeRef=%s projectRef=%s storeStatus=%s projectStatus=%s topicTime=%d ruleRef=%s%n",
                    fixture.fixture().workspaceUuid(), fixture.fixture().groupWorkspaceKey(),
                    fixture.fixture().storeId(), fixture.fixture().projectId(),
                    ownerTopicReadback.get("store_status"), ownerTopicReadback.get("project_status"),
                    expectedTopicTime, ruleRef);
            client = startTopicWireClient(tds, terminalWireClientScript(), scenario, fixture,
                    "TERMINAL_UPDATE_RULES", fixture.fixture().projectId().toString());
            Assertions.assertTrue(client.process().waitFor(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS),
                    "TDS_TERMINAL_UPDATE_TOPIC_DEADLINE_EXCEEDED");
            String outputLine = client.output().readLine();
            Assertions.assertEquals(0, client.process().exitValue(), "TDS_TERMINAL_UPDATE_TOPIC_CLIENT_EXIT_NONZERO");
            Assertions.assertNotNull(outputLine, "TDS_TERMINAL_UPDATE_TOPIC_RESULT_MISSING");
            Assertions.assertNull(client.output().readLine(), "TDS_TERMINAL_UPDATE_TOPIC_OUTPUT_CARDINALITY_INVALID");
            JsonNode result = JSON.readTree(outputLine);
            Assertions.assertEquals("PASS", result.path("status").asText());
            Assertions.assertEquals(scenario, result.path("scenario").asText());
            Assertions.assertEquals("TERMINAL_UPDATE_RULES", result.path("topicKey").asText());
            Assertions.assertEquals(List.of("SESSION_READY", "TOPIC_CHANGED"), JSON.convertValue(
                    result.path("eventTypes"), JSON.getTypeFactory().constructCollectionType(List.class, String.class)));
            Assertions.assertTrue(result.path("topicTimeEpochMillis").asLong() > 0,
                    "TDS_TERMINAL_UPDATE_TOPIC_OWNER_TIME_NOT_READ");
            Assertions.assertEquals(1000, result.path("clientCloseSent").asInt());
            Assertions.assertTrue(result.path("serverCloseReceived").asBoolean());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("topicKey", "TERMINAL_UPDATE_RULES"),
                    Map.entry("ownerRef", fixture.fixture().projectId().toString()),
                    Map.entry("ruleRef", ruleRef.toString()),
                    Map.entry("ownerRawTimeRead", result.path("topicTimeEpochMillis").asLong()),
                    Map.entry("eventTypes", List.of("SESSION_READY", "TOPIC_CHANGED")),
                    Map.entry("acceptedNotification", true)));
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            TopicWireClient ownedClient = client;
            Throwable cleanupFailure = ownedClient == null ? null
                    : attemptCleanup(null, () -> stopOwnedClient(ownedClient.process(), ownedClient.log()));
            if (fixture != null && !fixtureCancelled) {
                try {
                    business.performConnectionRevocation(context, fixture,
                            StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                    business.assertConnectionFixtureInactive(context, fixture);
                    fixtureCancelled = true;
                } catch (Exception | Error failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
            if (cleanupFailure != null) {
                if (scenarioFailure != null) scenarioFailure.addSuppressed(cleanupFailure);
                else if (cleanupFailure instanceof Exception exception) throw exception;
                else throw (Error) cleanupFailure;
            }
        }
    }

    static Stream<DynamicTest> remoteCommandScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest("terminal.connection.remote-command", () -> remoteCommand(host, tds)));
    }

    private static void remoteCommand(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = TdsAcceptanceProcess.TdsStartConfiguration.REMOTE_COMMAND_SCENARIO_ID;
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = null;
        Process wire = null;
        Path log = null;
        boolean fixtureCancelled = false;
        Throwable scenarioFailure = null;
        try {
            fixture = business.createConnectionContractFixture(context);
            String markerId = UUID.randomUUID().toString();
            log = wireClientLog(tds, markerId);
            UUID operationId = UUID.randomUUID();
            UUID requestId = UUID.randomUUID();
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("scenario", scenario);
            request.put("markerId", markerId);
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
            request.put(
                    "remoteOperation",
                    Map.of(
                            "operationId", operationId.toString(),
                            "requestId", requestId.toString(),
                            "commandName", "kernel.base.runtime.hello-world"));
            wire = startWireClient(request, log, true);
            requireWireMarker(
                    wire,
                    log,
                    "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " sessionId=",
                    Duration.ofSeconds(10),
                    "REMOTE_COMMAND_SESSION_READY",
                    tds,
                    0);

            TerminalControlOwnerApi owner = host.acceptanceBean(TerminalControlOwnerApi.class);
            ObjectNode parameters = host.mapper.createObjectNode();
            TerminalControlOwnerApi.InvocationResult invocation =
                    owner.invokeOnline(new TerminalControlOwnerApi.InvokeOnlineCommand(
                            operationId,
                            requestId,
                            fixture.fixture().groupWorkspaceKey(),
                            fixture.terminalRef(),
                            fixture.generation(),
                            "kernel.base.runtime.hello-world",
                            parameters));
            Assertions.assertEquals(TerminalControlOwnerApi.InvocationOutcome.QUEUED, invocation.outcome());
            Assertions.assertEquals(
                    TerminalControlOwnerApi.OperationStatus.QUEUED,
                    invocation.operation().status());
            JsonNode wireResult = awaitWireResult(wire, log, CLIENT_DEADLINE, scenario);
            Assertions.assertEquals("PASS", wireResult.path("status").asText());
            Assertions.assertEquals(
                    operationId.toString(), wireResult.path("remoteOperationId").asText());
            Assertions.assertEquals(
                    List.of(
                            "SESSION_READY",
                            "REMOTE_REPORT_ACK",
                            "REMOTE_REPORT_ACK",
                            "REMOTE_REPORT_ACK",
                            "REMOTE_REPORT_ACK"),
                    JSON.convertValue(
                            wireResult.path("eventTypes"),
                            JSON.getTypeFactory().constructCollectionType(List.class, String.class)));
            Assertions.assertEquals(1000, wireResult.path("clientCloseSent").asInt());

            TerminalControlOwnerApi.OperationView completed = owner.readOperation(operationId);
            Assertions.assertNotNull(completed, "TERMINAL_CONTROL_OPERATION_READBACK_MISSING");
            Assertions.assertEquals(requestId, completed.requestId());
            Assertions.assertEquals("terminal-data-server", completed.targetNodeId());
            Assertions.assertEquals(TerminalControlOwnerApi.OperationStatus.COMPLETED, completed.status());
            Assertions.assertEquals(
                    "helloWorld",
                    completed
                            .result()
                            .path("actorResults")
                            .get(0)
                            .path("result")
                            .path("message")
                            .asText());
            Assertions.assertNull(completed.errorCode());
            TerminalControlOwnerApi.OperationView afterStaleStarted = owner.readOperation(operationId);
            Assertions.assertNotNull(afterStaleStarted, "TERMINAL_CONTROL_LATE_REPORT_READBACK_MISSING");
            Assertions.assertEquals(
                    TerminalControlOwnerApi.OperationStatus.COMPLETED,
                    afterStaleStarted.status(),
                    "TERMINAL_CONTROL_LATE_STARTED_REGRESSED_TERMINAL_STATE");
            Assertions.assertEquals(
                    "helloWorld",
                    afterStaleStarted
                            .result()
                            .path("actorResults")
                            .get(0)
                            .path("result")
                            .path("message")
                            .asText(),
                    "TERMINAL_CONTROL_LATE_STARTED_REPLACED_COMPLETED_RESULT");
            business.performConnectionRevocation(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            business.assertConnectionFixtureInactive(context, fixture);
            fixtureCancelled = true;
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("operationId", operationId),
                    Map.entry("requestId", requestId),
                    Map.entry("targetNodeId", completed.targetNodeId()),
                    Map.entry("terminalStatus", completed.status().name()),
                    Map.entry(
                            "actorResult",
                            completed.result().path("actorResults").get(0).path("result")),
                    Map.entry("fixtureCancelled", fixtureCancelled)));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS runId=%s status=COMPLETED%n",
                    scenario, runId);
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            writeScenarioFailure(runId, scenario, "TDS_REMOTE_COMMAND_FAILED", failure);
            throw failure;
        } finally {
            Process wireToStop = wire;
            Path wireLog = log;
            Throwable cleanupFailure =
                    wireToStop == null ? null : attemptCleanup(null, () -> stopOwnedClient(wireToStop, wireLog));
            if (fixture != null && !fixtureCancelled) {
                try {
                    business.performConnectionRevocation(
                            context,
                            fixture,
                            StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                    business.assertConnectionFixtureInactive(context, fixture);
                    fixtureCancelled = true;
                } catch (Exception | Error failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void activeStoreTopicSubscription(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.topic.active-store-subscription";
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        List<StoreTerminalAcceptanceScenarios.ConnectionFixture> fixtures = new ArrayList<>();
        List<TopicWireClient> clients = new ArrayList<>();
        Set<UUID> cancelledFixtures = new HashSet<>();
        TdsRegistrationGateBroker.ArmedAttempt recoveryGate = null;
        String recoveryAttemptId = null;
        int previousListenerBackendPid = -1;
        boolean listenerRecoveryRequired = false;
        Throwable scenarioFailure = null;
        try {
            StoreTerminalAcceptanceScenarios.ConnectionFixture first =
                    business.createConnectionContractFixture(context);
            fixtures.add(first);
            StoreTerminalAcceptanceScenarios.ConnectionFixture second =
                    business.createConnectionContractFixture(context, first);
            fixtures.add(second);
            Path script = terminalWireClientScript();
            clients.add(startTopicWireClient(tds, script, scenario, first));
            clients.add(startTopicWireClient(tds, script, scenario, second));
            long baselineOwnerTime =
                    clients.getFirst().baseline().path("topicTimeEpochMillis").asLong();
            Assertions.assertTrue(baselineOwnerTime > 0, "TDS_TOPIC_OWNER_TIME_NOT_READ");
            Assertions.assertEquals(
                    baselineOwnerTime,
                    clients.getLast().baseline().path("topicTimeEpochMillis").asLong(),
                    "TDS_TOPIC_SESSIONS_DID_NOT_READ_SAME_OWNER_BASELINE");

            previousListenerBackendPid = tds.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = tds.registrationGateBroker().armNextListenerRecovery();
            Assertions.assertTrue(
                    host.terminatePostgresBackend(previousListenerBackendPid),
                    "TDS_TOPIC_EXACT_LISTENER_TERMINATION_FAILED");
            recoveryAttemptId = awaitRegistrationGateObservation(
                    recoveryGate,
                    Duration.ofSeconds(8),
                    clients.getFirst().process(),
                    clients.getFirst().log(),
                    tds);
            tds.awaitListenerDisconnected(previousListenerBackendPid, Duration.ofSeconds(3));
            listenerRecoveryRequired = true;

            String updatedName = "TDS topic update " + UUID.randomUUID();
            business.updateConnectionContractStoreName(context, first, updatedName);
            for (TopicWireClient client : clients) {
                client.process().getOutputStream().write("UPDATE_COMMITTED\n".getBytes(StandardCharsets.UTF_8));
                client.process().getOutputStream().flush();
            }
            recoveryGate.release(recoveryAttemptId);
            recoveryGate = null;
            int reconnectedListenerBackendPid =
                    tds.awaitListenerReadyAfter(previousListenerBackendPid, Duration.ofSeconds(30));
            listenerRecoveryRequired = false;

            List<JsonNode> results = new ArrayList<>();
            for (TopicWireClient client : clients) {
                Assertions.assertTrue(
                        client.process().waitFor(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS),
                        "TERMINAL_WIRE_TOPIC_SUBSCRIPTION_DEADLINE_EXCEEDED");
                String outputLine = client.output().readLine();
                Assertions.assertEquals(0, client.process().exitValue(), "TERMINAL_WIRE_CLIENT_EXIT_NONZERO");
                Assertions.assertNotNull(outputLine, "TERMINAL_WIRE_CLIENT_RESULT_MISSING");
                Assertions.assertNull(client.output().readLine(), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
                JsonNode result = JSON.readTree(outputLine);
                Assertions.assertEquals("PASS", result.path("status").asText());
                Assertions.assertEquals(scenario, result.path("scenario").asText());
                Assertions.assertEquals("STORE", result.path("topicKey").asText());
                Assertions.assertEquals(
                        List.of("SESSION_READY", "TOPIC_CHANGED", "TOPIC_CHANGED"),
                        JSON.convertValue(
                                result.path("eventTypes"),
                                JSON.getTypeFactory().constructCollectionType(List.class, String.class)));
                Assertions.assertEquals(
                        baselineOwnerTime,
                        result.path("baselineTopicTimeEpochMillis").asLong());
                Assertions.assertTrue(
                        result.path("topicTimeEpochMillis").asLong() > baselineOwnerTime,
                        "TDS_TOPIC_OWNER_TIME_DID_NOT_ADVANCE_AFTER_HTTP_UPDATE");
                if (!results.isEmpty()) {
                    Assertions.assertEquals(
                            results.getFirst().path("topicTimeEpochMillis").asLong(),
                            result.path("topicTimeEpochMillis").asLong(),
                            "TDS_TOPIC_SESSIONS_DID_NOT_READ_SAME_UPDATED_OWNER_TIME");
                }
                Assertions.assertEquals(1000, result.path("clientCloseSent").asInt());
                Assertions.assertTrue(result.path("serverCloseReceived").asBoolean());
                results.add(result);
            }
            for (StoreTerminalAcceptanceScenarios.ConnectionFixture fixture : fixtures) {
                business.performConnectionRevocation(
                        context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                business.assertConnectionFixtureInactive(context, fixture);
                cancelledFixtures.add(fixture.terminalRef());
            }
            JsonNode result = results.getFirst();
            String storeRef = fixtures.getFirst().fixture().storeId().toString();
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("topicKey", "STORE"),
                    Map.entry("ownerRef", storeRef),
                    Map.entry("baselineOwnerRawTimeRead", baselineOwnerTime),
                    Map.entry(
                            "updatedOwnerRawTimeRead",
                            result.path("topicTimeEpochMillis").asLong()),
                    Map.entry("eventTypes", List.of("SESSION_READY", "TOPIC_CHANGED", "TOPIC_CHANGED")),
                    Map.entry("acceptedNotification", true),
                    Map.entry("listenerBackendPidBeforeRestart", previousListenerBackendPid),
                    Map.entry("listenerBackendPidAfterRestart", reconnectedListenerBackendPid),
                    Map.entry("fixtureCancelled", cancelledFixtures.size() == fixtures.size()),
                    Map.entry("liveSessionsReceivingUpdate", results.size()),
                    Map.entry(
                            "sessionOwnerTimes",
                            results.stream()
                                    .map(resultValue -> resultValue
                                            .path("topicTimeEpochMillis")
                                            .asLong())
                                    .toList()),
                    Map.entry(
                            "clientPids",
                            clients.stream()
                                    .map(client -> client.process().pid())
                                    .toList())));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS runId=%s liveSessions=%d%n",
                    scenario, runId, results.size());
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            try {
                writeScenarioFailure(runId, scenario, "TDS_TOPIC_SUBSCRIPTION_FAILED", failure);
            } catch (Exception | Error reportFailure) {
                failure.addSuppressed(reportFailure);
            }
            throw failure;
        } finally {
            TdsRegistrationGateBroker.ArmedAttempt gateToRelease = recoveryGate;
            String attemptToRelease = recoveryAttemptId;
            if (gateToRelease != null) {
                try {
                    if (attemptToRelease == null) tds.registrationGateBroker().cancel(gateToRelease);
                    else gateToRelease.release(attemptToRelease);
                } catch (Exception | Error failure) {
                    if (scenarioFailure != null) scenarioFailure.addSuppressed(failure);
                    else throw failure;
                }
            }
            if (listenerRecoveryRequired && previousListenerBackendPid > 0) {
                try {
                    tds.awaitListenerReadyAfter(previousListenerBackendPid, Duration.ofSeconds(30));
                } catch (Exception | Error failure) {
                    if (scenarioFailure != null) scenarioFailure.addSuppressed(failure);
                    else throw failure;
                }
            }
            for (TopicWireClient client : clients) {
                Process node = client.process();
                if (node.isAlive()) {
                    node.destroy();
                    if (!node.waitFor(2, TimeUnit.SECONDS)) node.destroyForcibly();
                }
            }
            Throwable cleanupFailure = null;
            for (StoreTerminalAcceptanceScenarios.ConnectionFixture fixture : fixtures) {
                if (cancelledFixtures.contains(fixture.terminalRef())) continue;
                try {
                    business.performConnectionRevocation(
                            context,
                            fixture,
                            StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                    business.assertConnectionFixtureInactive(context, fixture);
                    cancelledFixtures.add(fixture.terminalRef());
                } catch (Exception | Error failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
            if (cleanupFailure != null) {
                if (scenarioFailure != null) scenarioFailure.addSuppressed(cleanupFailure);
                else if (cleanupFailure instanceof Exception exception) throw exception;
                else throw (Error) cleanupFailure;
            }
        }
    }

    private static TopicWireClient startTopicWireClient(
            TdsAcceptanceProcess tds,
            Path script,
            String scenario,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture)
            throws Exception {
        return startTopicWireClient(tds, script, scenario, fixture, "STORE", fixture.fixture().storeId().toString());
    }

    private static TopicWireClient startTopicWireClient(
            TdsAcceptanceProcess tds,
            Path script,
            String scenario,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            String topicKey,
            String ownerRef)
            throws Exception {
        String markerId = UUID.randomUUID().toString();
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
                        "backend-acceptance"),
                "topicSubscription",
                Map.of(
                        "subscriptionId",
                        UUID.randomUUID().toString(),
                        "topicKey",
                        topicKey,
                        "ownerRef",
                        ownerRef,
                        "lastAcceptedTimeEpochMillis",
                        0));
        ProcessBuilder builder =
                new ProcessBuilder(requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY"), script.toString());
        builder.directory(Path.of(System.getProperty("user.dir")).toFile());
        Path wireLog = wireClientLog(tds, markerId);
        builder.redirectError(ProcessBuilder.Redirect.appendTo(wireLog.toFile()));
        Process node = builder.start();
        try {
            BufferedReader output =
                    new BufferedReader(new InputStreamReader(node.getInputStream(), StandardCharsets.UTF_8));
            node.getOutputStream().write((JSON.writeValueAsString(request) + "\n").getBytes(StandardCharsets.UTF_8));
            node.getOutputStream().flush();
            JsonNode baseline =
                    JSON.readTree(readWireClientLine(output, "TERMINAL_WIRE_TOPIC_BASELINE_DEADLINE_EXCEEDED"));
            Assertions.assertEquals("BASELINE_ACCEPTED", baseline.path("stage").asText());
            Assertions.assertEquals(scenario, baseline.path("scenario").asText());
            return new TopicWireClient(node, output, baseline, wireLog);
        } catch (Exception | Error failure) {
            if (node.isAlive()) {
                node.destroy();
                if (!node.waitFor(2, TimeUnit.SECONDS)) node.destroyForcibly();
            }
            throw failure;
        }
    }

    private static String readWireClientLine(BufferedReader output, String timeoutMarker) throws Exception {
        CompletableFuture<String> line = CompletableFuture.supplyAsync(() -> {
            try {
                return output.readLine();
            } catch (IOException failure) {
                throw new CompletionException(failure);
            }
        });
        try {
            String value = line.get(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS);
            Assertions.assertNotNull(value, "TERMINAL_WIRE_CLIENT_EARLY_EOF");
            return value;
        } catch (TimeoutException timeout) {
            throw new AssertionError(timeoutMarker, timeout);
        }
    }

    static void topologyProbe(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        Path script = terminalWireClientScript();
        String markerId = UUID.randomUUID().toString();
        Path stderr = wireClientLog(tds, markerId);

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
                "markerId",
                markerId,
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
        Throwable scenarioFailure = null;
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        BackendAcceptanceTest.ScenarioContext fixtureContext =
                host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = null;
        SessionProbe authenticatedProbe = null;
        boolean[] fixtureCancelled = {false};
        try {
            node.getOutputStream().write((JSON.writeValueAsString(request) + "\n").getBytes(StandardCharsets.UTF_8));
            node.getOutputStream().close();
            boolean exited = node.waitFor(CLIENT_DEADLINE.toMillis(), TimeUnit.MILLISECONDS);
            if (!exited) throw new IllegalStateException("TERMINAL_WIRE_CLIENT_DEADLINE_EXCEEDED");
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
            fixture = business.createConnectionContractFixture(fixtureContext);
            String authenticatedMarker = UUID.randomUUID().toString();
            authenticatedProbe = startSessionProbe(
                    tds,
                    fixture,
                    "terminal.connection.vs1.default-node-id",
                    authenticatedMarker,
                    wireClientLog(tds, authenticatedMarker));
            authenticatedProbe.awaitReady(Duration.ofSeconds(15));
            Assertions.assertEquals(
                    TdsAcceptanceProcess.TdsStartConfiguration.DEFAULT_NODE_ID,
                    authenticatedProbe.nodeId(),
                    "V-S1_DEFAULT_NODE_ID_SESSION_READY_MISMATCH");
            Assertions.assertEquals(
                    TdsAcceptanceProcess.TdsStartConfiguration.DEFAULT_NODE_ID,
                    host.text(
                            "SELECT node_id FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NULL",
                            fixture.terminalRef(),
                            authenticatedProbe.sessionId()),
                    "V-S1_DEFAULT_NODE_ID_LATEST_STATE_MISMATCH");
            authenticatedProbe.ping(1);
            business.performConnectionRevocation(
                    fixtureContext, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            fixtureCancelled[0] = true;
            authenticatedProbe.awaitClose(4000, "ACTIVATION_CANCELLED", Duration.ofSeconds(15));
            business.assertConnectionFixtureInactive(fixtureContext, fixture);
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", "terminal.connection.vs1.database-only-configuration-startup"),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("externalServiceConfiguration", "DATABASE_ONLY"),
                    Map.entry("processEnvironment", "EXPLICIT_ALLOWLIST_WITHOUT_OBJECT_STORAGE"),
                    Map.entry("handshake", "OPEN"),
                    Map.entry("closeCode", 4000),
                    Map.entry("closeReason", "CREDENTIAL_INVALID"),
                    Map.entry("defaultNodeId", authenticatedProbe.nodeId()),
                    Map.entry(
                            "authenticatedLatestStateNodeId",
                            TdsAcceptanceProcess.TdsStartConfiguration.DEFAULT_NODE_ID),
                    Map.entry("fixtureRestored", fixtureCancelled[0]),
                    Map.entry("clientPid", node.pid()),
                    Map.entry("clientCommand", node.info().command().orElse("node"))));
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_CONTRACT operation=terminal.connection.vs1.database-only-"
                            + "configuration-startup CONTRACT=PASS runId=%s clientPid=%d%n"),
                    runId,
                    node.pid());
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            try {
                writeScenarioFailure(
                        runId,
                        "terminal.connection.vs1.database-only-configuration-startup",
                        "TDS_VS1_DATABASE_ONLY_CONFIGURATION_STARTUP_FAILED",
                        failure);
            } catch (Exception | Error reportFailure) {
                failure.addSuppressed(reportFailure);
            }
            throw failure;
        } finally {
            if (authenticatedProbe != null) {
                Throwable authenticatedCleanupFailure = attemptCleanup(null, authenticatedProbe::stop);
                finishCleanup(scenarioFailure, authenticatedCleanupFailure);
            }
            if (fixture != null) {
                StoreTerminalAcceptanceScenarios.ConnectionFixture cleanupFixture = fixture;
                Throwable fixtureCleanupFailure = attemptCleanup(null, () -> {
                    if (!fixtureCancelled[0]) {
                        business.performConnectionRevocation(
                                fixtureContext,
                                cleanupFixture,
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                    }
                    business.assertConnectionFixtureInactive(fixtureContext, cleanupFixture);
                });
                finishCleanup(scenarioFailure, fixtureCleanupFailure);
            }
            Process clientToStop = node;
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop, stderr));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    static Stream<DynamicTest> v2AuthenticationScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        List<Map.Entry<String, String>> rejected = List.of(
                Map.entry("terminal.connection.auth.never-registered", "CREDENTIAL_INVALID"),
                Map.entry("terminal.connection.auth.wrong-secret", "CREDENTIAL_INVALID"),
                Map.entry("terminal.connection.auth.active-device-mismatch", "CREDENTIAL_INVALID"),
                Map.entry("terminal.connection.auth.ended-different-device", "ACTIVATION_CANCELLED"),
                Map.entry("terminal.connection.auth.group-path-mismatch", "CREDENTIAL_INVALID"),
                Map.entry("terminal.connection.auth.cancelled", "ACTIVATION_CANCELLED"),
                Map.entry("terminal.connection.auth.terminal-voided", "ACTIVATION_CANCELLED"),
                Map.entry("terminal.connection.auth.store-voided", "ACTIVATION_CANCELLED"),
                Map.entry("terminal.connection.auth.group-disabled", "GROUP_WORKSPACE_DISABLED"),
                Map.entry("terminal.connection.auth.terminal-disabled", "TERMINAL_DISABLED"),
                Map.entry("terminal.connection.auth.revoked-group-disabled", "ACTIVATION_CANCELLED"),
                Map.entry("terminal.connection.auth.unknown-store-voided", "CREDENTIAL_INVALID"),
                Map.entry("terminal.connection.auth.revoked-terminal-disabled", "ACTIVATION_CANCELLED"));
        Stream<DynamicTest> rejectedCases = rejected.stream()
                .map(entry -> DynamicTest.dynamicTest(
                        entry.getKey(), () -> v2AuthenticationRejection(host, tds, entry.getKey(), entry.getValue())));
        return Stream.concat(
                rejectedCases,
                Stream.of(
                        DynamicTest.dynamicTest(
                                "terminal.connection.auth.store-disabled-active",
                                () -> v2StoreDisabledActiveSession(host, tds)),
                        DynamicTest.dynamicTest(
                                "terminal.connection.auth.no-first-frame-timeout",
                                () -> v2AuthenticationRejection(
                                        host,
                                        tds,
                                        "terminal.connection.auth.no-first-frame-timeout",
                                        "AUTHENTICATION_TIMEOUT"))));
    }

    static Stream<DynamicTest> v1AdmissionScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(
                DynamicTest.dynamicTest(
                        "terminal.connection.vs1.admission-capacity-lifecycle",
                        () -> v1AdmissionCapacityLifecycle(host, tds)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs1.overall-authentication-deadline",
                        () -> v1OverallAuthenticationDeadline(host, tds)));
    }

    private static void v1OverallAuthenticationDeadline(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs1.overall-authentication-deadline";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String markerId = UUID.randomUUID().toString();
        TdsRegistrationGateBroker.ArmedAttempt gate =
                tds.registrationGateBroker().armNextAttempt(Duration.ofSeconds(25));
        Map<String, Object> request = new LinkedHashMap<>(closeExpectedRequest(
                tds,
                fixture.fixture().groupWorkspaceKey(),
                fixture.terminalRef(),
                fixture.generation() + "." + fixture.credentialSecret(),
                fixture.deviceId(),
                scenario,
                markerId,
                4000,
                "AUTHENTICATION_TIMEOUT"));
        request.put("serverCloseTimeoutMs", 20_000);
        Path clientLog = wireClientLog(tds, markerId);
        String tdsLogBefore = tds.logContents();
        Process node = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        long startedNanos = System.nanoTime();
        try {
            node = startWireClient(request, clientLog, false);
            String attemptId = awaitRegistrationGateObservation(gate, Duration.ofSeconds(10), node, clientLog, tds);
            JsonNode rejected = awaitWireResult(node, clientLog, Duration.ofSeconds(23), scenario);
            long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
            Assertions.assertEquals(
                    4000, rejected.path("closeCode").asInt(), "V-S1_OVERALL_TIMEOUT_CLOSE_CODE_INVALID");
            Assertions.assertEquals(
                    "AUTHENTICATION_TIMEOUT",
                    rejected.path("closeReason").asText(),
                    "V-S1_OVERALL_TIMEOUT_REASON_INVALID");
            Assertions.assertEquals(
                    List.of(), strings(rejected.path("eventTypes")), "V-S1_OVERALL_TIMEOUT_SENT_APP_MESSAGE");
            Assertions.assertTrue(rejected.path("sessionId").isNull(), "V-S1_OVERALL_TIMEOUT_RETURNED_SESSION");
            Assertions.assertTrue(elapsedMillis >= 13_000, "V-S1_OVERALL_TIMEOUT_CLOSED_EARLY");
            Assertions.assertTrue(elapsedMillis <= 22_000, "V-S1_OVERALL_TIMEOUT_CLOSED_LATE");
            Assertions.assertTrue(
                    gate.awaitClientDisconnectedBeforeRelease(Duration.ofSeconds(5)),
                    "V-S1_OVERALL_TIMEOUT_DID_NOT_CANCEL_PRE_REGISTRATION_GATE");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            fixture.terminalRef()),
                    "V-S1_OVERALL_TIMEOUT_REGISTERED_SESSION");
            String tdsLog = tds.logContents()
                    .substring(Math.min(tdsLogBefore.length(), tds.logContents().length()));
            Assertions.assertTrue(
                    tdsLog.contains("event=tds_ws_authentication_rejected")
                            && tdsLog.contains("closeReason=AUTHENTICATION_TIMEOUT"),
                    "V-S1_OVERALL_TIMEOUT_REJECTION_DIAGNOSTIC_MISSING");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("registrationGateAttemptId", attemptId),
                    Map.entry("producer", "real-tds-real-postgresql-real-websocket"),
                    Map.entry("elapsedMillis", elapsedMillis),
                    Map.entry("sessionRows", 0)));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) {
                writeScenarioFailure(runId, scenario, "TDS_VS1_OVERALL_AUTHENTICATION_DEADLINE_FAILED", failure);
            }
            throw failure;
        } finally {
            Process nodeToStop = node;
            Throwable cleanupFailure =
                    nodeToStop == null ? null : attemptCleanup(null, () -> stopOwnedClient(nodeToStop, clientLog));
            if (scenarioFailure != null) tds.registrationGateBroker().cancel(gate);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v1AdmissionCapacityLifecycle(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs1.admission-capacity-lifecycle";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        int capacity = tds.maxUnauthenticatedConnections();
        Assertions.assertTrue(capacity > 0, "V-S1_UNAUTHENTICATED_CAPACITY_INVALID");
        List<SessionProbe> allProbes = new ArrayList<>();
        List<SessionProbe> unauthenticated = new ArrayList<>();
        String rejectedMarker = UUID.randomUUID().toString();
        Path rejectedLog = wireClientLog(tds, rejectedMarker);
        Process rejectedClient = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            for (int index = 0; index < capacity; index++) {
                SessionProbe probe =
                        startAdmissionProbe(tds, fixture, UUID.randomUUID().toString(), null);
                allProbes.add(probe);
                probe.awaitOpen(Duration.ofSeconds(10));
                unauthenticated.add(probe);
            }

            long verificationCountBeforeRejected =
                    countLogOccurrences(tds.logContents(), "event=tds_ws_credential_verification_started");
            Map<String, Object> rejectedRequest = Map.of(
                    "scenario",
                    "terminal.connection.vs1.admission-rejected",
                    "markerId",
                    rejectedMarker,
                    "url",
                    tds.websocketBaseUrl() + "/tdp/" + fixture.fixture().groupWorkspaceKey() + "/ws",
                    "expectedClose",
                    Map.of("code", 4000, "reason", "NODE_BUSY"));
            rejectedClient = startWireClient(rejectedRequest, rejectedLog, false);
            JsonNode rejected = awaitWireResult(
                    rejectedClient, rejectedLog, Duration.ofSeconds(15), "terminal.connection.vs1.admission-rejected");
            Assertions.assertEquals(4000, rejected.path("closeCode").asInt(), "V-S1_N_PLUS_ONE_CLOSE_CODE_INVALID");
            Assertions.assertEquals("NODE_BUSY", rejected.path("closeReason").asText(), "V-S1_N_PLUS_ONE_NOT_BUSY");
            Assertions.assertEquals(List.of(), strings(rejected.path("eventTypes")), "V-S1_BUSY_SENT_APP_MESSAGE");
            Assertions.assertTrue(rejected.path("sessionId").isNull(), "V-S1_BUSY_REGISTERED_SESSION");
            Assertions.assertEquals(
                    verificationCountBeforeRejected,
                    countLogOccurrences(tds.logContents(), "event=tds_ws_credential_verification_started"),
                    "V-S1_BUSY_REACHED_CREDENTIAL_VERIFIER");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            fixture.terminalRef()),
                    "V-S1_BUSY_REGISTERED_DATABASE_STATE");

            SessionProbe clientDisconnect = unauthenticated.removeFirst();
            JsonNode disconnect = clientDisconnect.finish(Duration.ofSeconds(10));
            Assertions.assertEquals(
                    1000, disconnect.path("clientCloseSent").asInt(), "V-S1_CLIENT_DISCONNECT_NOT_SENT");
            Assertions.assertTrue(
                    disconnect.path("serverCloseReceived").asBoolean(), "V-S1_CLIENT_DISCONNECT_UNCONFIRMED");
            unauthenticated.add(addAdmissionProbe(tds, fixture, allProbes));

            SessionProbe replacedProbe = unauthenticated.removeFirst();
            JsonNode replacedProbeDisconnect = replacedProbe.finish(Duration.ofSeconds(10));
            Assertions.assertEquals(
                    1000, replacedProbeDisconnect.path("clientCloseSent").asInt());
            SessionProbe rejectedAuthentication =
                    startAdmissionProbe(tds, fixture, UUID.randomUUID().toString(), "CREDENTIAL_INVALID");
            allProbes.add(rejectedAuthentication);
            rejectedAuthentication.awaitOpen(Duration.ofSeconds(10));
            JsonNode badCredential =
                    rejectedAuthentication.authenticateExpectingClose("CREDENTIAL_INVALID", Duration.ofSeconds(15));
            Assertions.assertEquals(List.of(), strings(badCredential.path("eventTypes")));
            Assertions.assertEquals(4000, badCredential.path("closeCode").asInt());
            Assertions.assertEquals(
                    "CREDENTIAL_INVALID", badCredential.path("closeReason").asText());
            unauthenticated.add(addAdmissionProbe(tds, fixture, allProbes));

            SessionProbe firstFrameTimeout = unauthenticated.removeFirst();
            JsonNode timeout =
                    firstFrameTimeout.awaitUnauthenticatedClose(4000, "AUTHENTICATION_TIMEOUT", Duration.ofSeconds(15));
            Assertions.assertEquals(List.of(), strings(timeout.path("eventTypes")));

            // All unauthenticated probes share the first-frame deadline. Observe each timeout before
            // reusing the permit set; keeping their old SessionProbe references would later select
            // an already-closed socket as the successful authentication candidate.
            for (SessionProbe expired : unauthenticated) {
                JsonNode expiredClose =
                        expired.awaitUnauthenticatedClose(4000, "AUTHENTICATION_TIMEOUT", Duration.ofSeconds(15));
                Assertions.assertEquals(List.of(), strings(expiredClose.path("eventTypes")));
            }
            unauthenticated.clear();
            for (int index = 0; index < capacity; index++) {
                unauthenticated.add(addAdmissionProbe(tds, fixture, allProbes));
            }

            SessionProbe authenticated = unauthenticated.removeFirst();
            authenticated.authenticate(Duration.ofSeconds(15));
            unauthenticated.add(addAdmissionProbe(tds, fixture, allProbes));
            JsonNode completed = authenticated.finish(Duration.ofSeconds(10));
            Assertions.assertEquals(
                    TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_INTERVAL_MILLIS,
                    completed.path("heartbeatIntervalMs").asLong(),
                    "V-S1_NON_DEFAULT_HEARTBEAT_INTERVAL_NOT_DOWNLOADED");
            Assertions.assertEquals(
                    TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS,
                    completed.path("heartbeatTimeoutMs").asLong(),
                    "V-S1_NON_DEFAULT_HEARTBEAT_TIMEOUT_NOT_DOWNLOADED");
            for (SessionProbe probe : unauthenticated) probe.finish(Duration.ofSeconds(10));
            unauthenticated.clear();
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-postgresql-and-pinned-node-websocket"),
                    Map.entry("unauthenticatedLimit", capacity),
                    Map.entry("nPlusOne", "NODE_BUSY_BEFORE_CREDENTIAL_VERIFICATION"),
                    Map.entry(
                            "permitReusedAfter",
                            List.of("client-disconnect", "credential-rejection", "timeout", "session-ready")),
                    Map.entry(
                            "heartbeatIntervalMs",
                            completed.path("heartbeatIntervalMs").asLong()),
                    Map.entry(
                            "heartbeatTimeoutMs",
                            completed.path("heartbeatTimeoutMs").asLong())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) {
                try {
                    writeContractResult(Map.ofEntries(
                            Map.entry("type", "transport-contract"),
                            Map.entry("operation", scenario),
                            Map.entry("module", "TERMINAL_DATA_SERVER"),
                            Map.entry("contract", "FAIL"),
                            Map.entry("status", "FAIL"),
                            Map.entry("runId", runId),
                            Map.entry("failureCategory", "TDS_VS1_ADMISSION_CAPACITY_LIFECYCLE_FAILED"),
                            Map.entry("failureCode", safeFailureCode(failure))));
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
            }
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            Process rejectedClientToStop = rejectedClient;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(rejectedClientToStop, rejectedLog));
            for (SessionProbe probe : allProbes) {
                cleanupFailure = attemptCleanup(cleanupFailure, probe::stop);
            }
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static SessionProbe addAdmissionProbe(
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            List<SessionProbe> allProbes)
            throws Exception {
        SessionProbe probe = startAdmissionProbe(tds, fixture, UUID.randomUUID().toString(), null);
        allProbes.add(probe);
        probe.awaitOpen(Duration.ofSeconds(10));
        return probe;
    }

    private static long countLogOccurrences(String text, String marker) {
        long count = 0;
        int offset = 0;
        while ((offset = text.indexOf(marker, offset)) >= 0) {
            count++;
            offset += marker.length();
        }
        return count;
    }

    static Stream<DynamicTest> v3HeartbeatScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(
                DynamicTest.dynamicTest(
                        "terminal.connection.vs3.heartbeat-timeout", () -> v3HeartbeatTimeout(host, tds)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs3.heartbeat-persistent", () -> v3HeartbeatPersistent(host, tds)));
    }

    private static void v3HeartbeatTimeout(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs3.heartbeat-timeout";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String markerId = UUID.randomUUID().toString();
        SessionProbe probe = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            probe = startSessionProbe(tds, fixture, scenario, markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(15));
            long startedNanos = System.nanoTime();
            JsonNode closed = probe.awaitClose(
                    4000,
                    "HEARTBEAT_TIMEOUT",
                    Duration.ofMillis(TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS
                            + TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_INTERVAL_MILLIS
                            + 2_000));
            long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
            Assertions.assertTrue(
                    elapsedMillis >= TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS - 2_000,
                    "V-S3_HEARTBEAT_TIMEOUT_CLOSED_EARLY");
            Assertions.assertTrue(
                    elapsedMillis
                            <= TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS
                                    + TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_INTERVAL_MILLIS
                                    + 2_000,
                    "V-S3_HEARTBEAT_TIMEOUT_CLOSED_LATE");
            awaitSessionDisconnectRecord(
                    host,
                    fixture.terminalRef(),
                    closed.path("sessionId").asText(),
                    "HEARTBEAT_TIMEOUT",
                    Duration.ofSeconds(10));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("closeReason", "HEARTBEAT_TIMEOUT"),
                    Map.entry("elapsedMillis", elapsedMillis),
                    Map.entry("timeoutMillis", TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS),
                    Map.entry("intervalMillis", TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_INTERVAL_MILLIS)));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS3_HEARTBEAT_TIMEOUT_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe probeToStop = probe;
            Throwable cleanupFailure = probeToStop == null ? null : attemptCleanup(null, probeToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v3HeartbeatPersistent(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs3.heartbeat-persistent";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String markerId = UUID.randomUUID().toString();
        SessionProbe probe = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            probe = startSessionProbe(tds, fixture, scenario, markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(15));
            long startedNanos = System.nanoTime();
            for (int sequence = 1; sequence <= 6; sequence++) {
                if (sequence > 1) TimeUnit.SECONDS.sleep(11);
                probe.ping(sequence);
            }
            TimeUnit.SECONDS.sleep(6);
            long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
            Assertions.assertTrue(
                    elapsedMillis > TdsAcceptanceProcess.ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS,
                    "V-S3_HEALTHY_SESSION_DID_NOT_SPAN_HEARTBEAT_TIMEOUT");
            Assertions.assertEquals(6, probe.pongCount(), "V-S3_HEALTHY_SESSION_PONG_COUNT_INVALID");
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NULL",
                            fixture.terminalRef(),
                            probe.sessionId()),
                    "V-S3_HEALTHY_SESSION_NOT_ACTIVE_AFTER_TIMEOUT_WINDOW");
            JsonNode closed = probe.finish(Duration.ofSeconds(10));
            Assertions.assertEquals(6, closed.path("pongCount").asInt());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("pongs", closed.path("pongCount").asInt()),
                    Map.entry("elapsedMillis", elapsedMillis),
                    Map.entry("sessionId", probe.sessionId())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS3_HEARTBEAT_PERSISTENCE_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe probeToStop = probe;
            Throwable cleanupFailure = probeToStop == null ? null : attemptCleanup(null, probeToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    static Stream<DynamicTest> v4SessionOwnershipScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(
                DynamicTest.dynamicTest(
                        "terminal.connection.vs4.failed-second-auth", () -> v4FailedSecondAuthentication(host, tds)),
                DynamicTest.dynamicTest("terminal.connection.vs4.session-takeover", () -> v4SessionTakeover(host, tds)),
                DynamicTest.dynamicTest(
                        "terminal.connection.vs4.disconnected-before-register",
                        () -> v4ClientDisconnectBeforeRegistration(host, tds)));
    }

    private static void v4FailedSecondAuthentication(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs4.failed-second-auth";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String oldMarker = UUID.randomUUID().toString();
        String failedMarker = UUID.randomUUID().toString();
        SessionProbe established = null;
        SessionProbe failed = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            established = startSessionProbe(tds, fixture, scenario, oldMarker, wireClientLog(tds, oldMarker));
            established.awaitReady(Duration.ofSeconds(15));
            failed = startDeferredAuthenticationProbe(tds, fixture, scenario, failedMarker, true, "CREDENTIAL_INVALID");
            failed.awaitOpen(Duration.ofSeconds(10));
            JsonNode rejected = failed.authenticateExpectingClose("CREDENTIAL_INVALID", Duration.ofSeconds(15));
            Assertions.assertEquals(List.of(), strings(rejected.path("eventTypes")));
            established.ping(1);
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NULL",
                            fixture.terminalRef(),
                            established.sessionId()),
                    "V-S4_FAILED_AUTH_REPLACED_ESTABLISHED_SESSION");
            JsonNode completed = established.finish(Duration.ofSeconds(10));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("failedAuthentication", "CREDENTIAL_INVALID"),
                    Map.entry(
                            "establishedSessionPongs",
                            completed.path("pongCount").asInt()),
                    Map.entry("sessionId", established.sessionId())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS4_FAILED_AUTH_AFFECTED_SESSION", failure);
            throw failure;
        } finally {
            SessionProbe failedToStop = failed;
            SessionProbe establishedToStop = established;
            Throwable cleanupFailure = failedToStop == null ? null : attemptCleanup(null, failedToStop::stop);
            if (establishedToStop != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, establishedToStop::stop);
            }
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v4SessionTakeover(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs4.session-takeover";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String oldMarker = UUID.randomUUID().toString();
        String newMarker = UUID.randomUUID().toString();
        SessionProbe previous = null;
        SessionProbe current = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            previous = startSessionProbe(tds, fixture, scenario, oldMarker, wireClientLog(tds, oldMarker));
            previous.awaitReady(Duration.ofSeconds(15));
            previous.ping(1);
            String previousSessionId = previous.sessionId();
            current = startSessionProbe(tds, fixture, scenario, newMarker, wireClientLog(tds, newMarker));
            current.awaitReady(Duration.ofSeconds(15));
            String currentSessionId = current.sessionId();
            Assertions.assertNotEquals(previousSessionId, currentSessionId, "V-S4_TAKEOVER_REUSED_SESSION_ID");
            JsonNode replaced = previous.awaitClose(4000, "SESSION_REPLACED", Duration.ofSeconds(15));
            current.ping(2);
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NULL",
                            fixture.terminalRef(),
                            currentSessionId),
                    "V-S4_TAKEOVER_DID_NOT_PERSIST_NEW_SESSION");
            JsonNode completed = current.finish(Duration.ofSeconds(10));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("oldCloseReason", replaced.path("closeReason").asText()),
                    Map.entry("oldSessionId", previousSessionId),
                    Map.entry("currentSessionId", currentSessionId),
                    Map.entry("currentSessionPongs", completed.path("pongCount").asInt())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS4_SESSION_TAKEOVER_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe currentToStop = current;
            SessionProbe previousToStop = previous;
            Throwable cleanupFailure = currentToStop == null ? null : attemptCleanup(null, currentToStop::stop);
            if (previousToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, previousToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v4ClientDisconnectBeforeRegistration(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs4.disconnected-before-register";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String markerId = UUID.randomUUID().toString();
        TdsRegistrationGateBroker.ArmedAttempt gate =
                tds.registrationGateBroker().armNextAttempt();
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
        Path clientLog = wireClientLog(tds, markerId);
        Process node = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            node = startWireClient(request, clientLog, false);
            String attemptId = awaitRegistrationGateObservation(gate, Duration.ofSeconds(8), node, clientLog, tds);
            stopOwnedClient(node, clientLog);
            Assertions.assertTrue(
                    gate.awaitClientDisconnectedBeforeRelease(Duration.ofSeconds(10)),
                    "V-S4_TDS_DID_NOT_CANCEL_PRE_REGISTRATION_GATE_AFTER_CLIENT_DISCONNECT");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            fixture.terminalRef()),
                    "V-S4_CLIENT_DISCONNECT_REGISTERED_SESSION");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("registrationGateAttemptId", attemptId),
                    Map.entry("producer", "real-postgresql-and-client-side-websocket-disconnect"),
                    Map.entry("sessionRows", 0)));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) {
                writeScenarioFailure(runId, scenario, "TDS_VS4_DISCONNECT_BEFORE_REGISTER_FAILED", failure);
            }
            throw failure;
        } finally {
            Throwable cleanupFailure =
                    attemptCleanup(null, () -> tds.registrationGateBroker().cancel(gate));
            Process nodeToStop = node;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(nodeToStop, clientLog));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    static Stream<DynamicTest> v11SecretSearchScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(
                DynamicTest.dynamicTest("terminal.connection.vs11.secret-search", () -> v11SecretSearch(host, tds)));
    }

    static Stream<DynamicTest> v6LatestStateScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.vs6.latest-state-identity", () -> v6LatestState(host, tds)));
    }

    static Stream<DynamicTest> v9GracefulShutdownScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.vs9.graceful-shutdown-order", () -> v9GracefulShutdown(host, tds)));
    }

    static Stream<DynamicTest> v15ReadinessWithdrawalScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.vs15.readiness-withdrawal-and-drain",
                () -> v15ReadinessWithdrawalAndDrain(host, tds)));
    }

    static Stream<DynamicTest> connectionHistoryScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.history-records", () -> connectionHistoryRecords(host, tds)));
    }

    static Stream<DynamicTest> connectionHistoryOutageScenarios(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, DorisStalledEndpoint endpoint) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.history-outage-bounded",
                () -> connectionHistoryOutageBounded(host, tds, endpoint)));
    }

    private static void connectionHistoryOutageBounded(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, DorisStalledEndpoint endpoint) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = TdsAcceptanceProcess.TdsStartConfiguration.HISTORY_OUTAGE_BOUNDED_SCENARIO_ID;
        Assertions.assertEquals(scenario, tdsContractScenario(), "TDS_HISTORY_OUTAGE_SCENARIO_SELECTION_MISMATCH");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture targetFixture = null;
        StoreTerminalAcceptanceScenarios.ConnectionFixture controlFixture = null;
        SessionProbe targetProbe = null;
        SessionProbe controlProbe = null;
        boolean targetCancelled = false;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            targetFixture = business.createConnectionContractFixture(context);
            controlFixture = business.createConnectionContractFixture(context);
            String targetMarker = UUID.randomUUID().toString();
            targetProbe =
                    startSessionProbe(tds, targetFixture, scenario, targetMarker, wireClientLog(tds, targetMarker));
            targetProbe.awaitReady(Duration.ofSeconds(15));
            String targetSessionId = targetProbe.sessionId();
            int firstRequest = endpoint.awaitFirstRequest();
            Assertions.assertEquals(1, firstRequest, "TDS_HISTORY_OUTAGE_FIRST_LOAD_REQUEST_INVALID");

            double totalPingMillis = targetProbe.pingBurst(4_100);
            double maxPingMillis = targetProbe.lastPingBurstMaximumMillis();
            awaitTdsLogContains(
                    tds,
                    "event=tds_doris_history_event_dropped reason=QUEUE_FULL "
                            + "eventType=HEARTBEAT_RTT queueDepth=4096",
                    Duration.ofSeconds(10),
                    "TDS_HISTORY_OUTAGE_QUEUE_LIMIT_NOT_OBSERVED");

            StoreTerminalAcceptanceScenarios.DorisOutageBusinessTimings businessTimings =
                    business.performBusinessActionsDuringDorisOutage(context, 20);
            long cancelStarted = System.nanoTime();
            business.performConnectionRevocation(
                    context, targetFixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            long targetCancelMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - cancelStarted);
            Assertions.assertTrue(
                    targetCancelMillis < 1_000, "TDS_HISTORY_OUTAGE_SESSION_CANCEL_SLOWER_THAN_ONE_SECOND");
            targetCancelled = true;
            JsonNode targetClose = targetProbe.awaitClose(4000, "ACTIVATION_CANCELLED", Duration.ofSeconds(20));
            Assertions.assertEquals(
                    targetSessionId, targetClose.path("sessionId").asText());
            targetProbe = null;

            String controlMarker = UUID.randomUUID().toString();
            controlProbe =
                    startSessionProbe(tds, controlFixture, scenario, controlMarker, wireClientLog(tds, controlMarker));
            controlProbe.awaitReady(Duration.ofSeconds(15));
            double controlPingMillis = controlProbe.ping(1, 0d);
            Assertions.assertTrue(controlPingMillis < 1_000, "TDS_HISTORY_OUTAGE_PONG_SLOWER_THAN_ONE_SECOND");
            Map<String, Object> controlState = latestState(host, controlFixture.terminalRef());
            Assertions.assertEquals(controlProbe.sessionId(), controlState.get("session_id"));
            Assertions.assertTrue(
                    ((Number) controlState.get("session_sequence")).longValue() > 0,
                    "TDS_HISTORY_OUTAGE_CONTROL_SESSION_SEQUENCE_MISSING");
            Assertions.assertNotNull(controlState.get("connected_at_epoch_millis"));
            Assertions.assertNull(controlState.get("disconnected_at_epoch_millis"));

            while (endpoint.elapsedMillisSinceFirstRequest() < 10_500) {
                TimeUnit.MILLISECONDS.sleep(100);
            }
            endpoint.releaseResponse();
            awaitTdsLogContains(
                    tds,
                    "event=tds_doris_history_batch_dropped_after_retry",
                    Duration.ofSeconds(15),
                    "TDS_HISTORY_OUTAGE_RETRY_DROP_NOT_OBSERVED");
            endpoint.assertOnlyConnectionHistoryEvents();
            Assertions.assertNull(endpoint.failure(), "TDS_HISTORY_OUTAGE_ENDPOINT_FAILED");

            JsonNode controlResult = controlProbe.finish(Duration.ofSeconds(10));
            controlProbe = null;
            Assertions.assertEquals(1, controlResult.path("pongCount").asInt());
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("historyEndpoint", "run-scoped-loopback-stall"),
                    Map.entry("historyRequestTimeoutMillis", 10_000),
                    Map.entry("historyQueueCapacityEvents", 4_096),
                    Map.entry("queueFullDropObserved", true),
                    Map.entry("historyBatchDroppedAfterRetry", true),
                    Map.entry("pingCount", 4_100),
                    Map.entry("pingBurstElapsedMillis", totalPingMillis),
                    Map.entry("pingBurstMaxIndividualMillis", maxPingMillis),
                    Map.entry("businessActivationCount", 20),
                    Map.entry("businessCancellationCount", 20),
                    Map.entry("maximumActivationMillis", businessTimings.maximumActivationMillis()),
                    Map.entry("maximumBusinessCancellationMillis", businessTimings.maximumCancellationMillis()),
                    Map.entry("targetCancellationMillis", targetCancelMillis),
                    Map.entry("postgresAuditRows", businessTimings.postgresAuditRows()),
                    Map.entry("controlPongMillis", controlPingMillis),
                    Map.entry(
                            "controlSessionPongs",
                            controlResult.path("pongCount").asInt())));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS runId=%s "
                            + "queueCapacity=4096 queueDrop=PASS retriesDropped=PASS pingCount=4100 "
                            + "maxActivationMillis=%d maxCancelMillis=%d%n",
                    scenario,
                    runId,
                    businessTimings.maximumActivationMillis(),
                    businessTimings.maximumCancellationMillis());
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_HISTORY_OUTAGE_BOUNDED_FAILED", failure);
            throw failure;
        } finally {
            endpoint.releaseResponse();
            SessionProbe targetToStop = targetProbe;
            Throwable cleanupFailure = targetToStop == null ? null : attemptCleanup(null, targetToStop::stop);
            SessionProbe controlToStop = controlProbe;
            cleanupFailure =
                    controlToStop == null ? cleanupFailure : attemptCleanup(cleanupFailure, controlToStop::stop);
            if (targetFixture != null && !targetCancelled) {
                StoreTerminalAcceptanceScenarios.ConnectionFixture fixtureToCancel = targetFixture;
                cleanupFailure = attemptCleanup(
                        cleanupFailure,
                        () -> business.performConnectionRevocation(
                                context,
                                fixtureToCancel,
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL));
            }
            if (controlFixture != null) {
                StoreTerminalAcceptanceScenarios.ConnectionFixture fixtureToCancel = controlFixture;
                cleanupFailure = attemptCleanup(
                        cleanupFailure,
                        () -> business.performConnectionRevocation(
                                context,
                                fixtureToCancel,
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL));
            }
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void connectionHistoryRecords(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.history-records";
        Assertions.assertEquals(scenario, tdsContractScenario(), "TDS_HISTORY_SCENARIO_SELECTION_MISMATCH");
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = null;
        SessionProbe probe = null;
        boolean fixtureCancelled = false;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            fixture = business.createConnectionContractFixture(context);
            String markerId = UUID.randomUUID().toString();
            probe = startSessionProbe(tds, fixture, scenario, markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(15));
            String sessionId = probe.sessionId();
            Assertions.assertTrue(sessionId.matches("[A-Za-z0-9._-]{1,128}"), "TDS_HISTORY_SESSION_ID_SHAPE_INVALID");
            double measuredRttMs = probe.ping(1, 0d);
            Assertions.assertTrue(measuredRttMs > 0, "TDS_HISTORY_CLIENT_RTT_MEASUREMENT_INVALID");
            probe.ping(2, measuredRttMs);
            business.performConnectionRevocation(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            fixtureCancelled = true;
            probe.awaitClose(4000, "ACTIVATION_CANCELLED", Duration.ofSeconds(15));

            DorisHistoryCounts counts =
                    awaitDorisHistoryRecords(host, tds, fixture.terminalRef(), sessionId, measuredRttMs);
            Assertions.assertEquals(1, counts.connected(), "TDS_HISTORY_CONNECTED_COUNT_INVALID");
            Assertions.assertEquals(2, counts.heartbeatRtt(), "TDS_HISTORY_HEARTBEAT_RTT_COUNT_INVALID");
            Assertions.assertEquals(1, counts.measuredRtt(), "TDS_HISTORY_MEASURED_RTT_VALUE_INVALID");
            Assertions.assertEquals(1, counts.cancelled(), "TDS_HISTORY_DISCONNECTED_REASON_INVALID");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("connectedRows", counts.connected()),
                    Map.entry("heartbeatRttRows", counts.heartbeatRtt()),
                    Map.entry("disconnectedCancelledRows", counts.cancelled()),
                    Map.entry("measuredRttMs", measuredRttMs),
                    Map.entry("tdsNodeId", tds.nodeId())));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT operation=%s CONTRACT=PASS "
                            + "runId=%s connected=%d heartbeats=%d disconnected=%d%n",
                    scenario, runId, counts.connected(), counts.heartbeatRtt(), counts.cancelled());
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_HISTORY_RECORDS_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe probeToStop = probe;
            Throwable cleanupFailure = probeToStop == null ? null : attemptCleanup(null, probeToStop::stop);
            if (fixture != null && !fixtureCancelled) {
                StoreTerminalAcceptanceScenarios.ConnectionFixture fixtureToCancel = fixture;
                cleanupFailure = attemptCleanup(
                        cleanupFailure,
                        () -> business.performConnectionRevocation(
                                context,
                                fixtureToCancel,
                                StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL));
            }
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static DorisHistoryCounts awaitDorisHistoryRecords(
            BackendAcceptanceTest host,
            TdsAcceptanceProcess tds,
            UUID terminalRef,
            String sessionId,
            double measuredRttMs)
            throws Exception {
        String sql = "SELECT "
                + "COALESCE(SUM(CASE WHEN event_type='CONNECTED' THEN 1 ELSE 0 END),0), "
                + "COALESCE(SUM(CASE WHEN event_type='HEARTBEAT_RTT' THEN 1 ELSE 0 END),0), "
                + "COALESCE(SUM(CASE WHEN event_type='HEARTBEAT_RTT' AND rtt_ms>0 AND ABS(rtt_ms-"
                + Double.toString(measuredRttMs)
                + ")<0.000001 THEN 1 ELSE 0 END),0), "
                + "COALESCE(SUM(CASE WHEN event_type='DISCONNECTED' "
                + "AND close_reason='ACTIVATION_CANCELLED' THEN 1 ELSE 0 END),0) "
                + "FROM terminal_connection_history.connection_history WHERE terminal_ref='"
                + terminalRef
                + "' AND session_id='"
                + sessionId
                + "';\n";
        long deadline = System.nanoTime() + Duration.ofSeconds(35).toNanos();
        while (System.nanoTime() < deadline) {
            String result = BackendAcceptanceTest.runDorisSql(sql).strip();
            String[] values = result.split("\\t");
            Assertions.assertEquals(4, values.length, "TDS_HISTORY_DORIS_READBACK_SHAPE_INVALID");
            DorisHistoryCounts counts = new DorisHistoryCounts(
                    Integer.parseInt(values[0]),
                    Integer.parseInt(values[1]),
                    Integer.parseInt(values[2]),
                    Integer.parseInt(values[3]));
            if (counts.equals(new DorisHistoryCounts(1, 2, 1, 1))) return counts;
            if (tds.logContents().contains("event=tds_doris_history_batch_dropped_after_retry")) {
                throw new IllegalStateException("TDS_HISTORY_DORIS_BATCH_DROPPED");
            }
            TimeUnit.MILLISECONDS.sleep(250);
        }
        throw new IllegalStateException("TDS_HISTORY_DORIS_READBACK_DEADLINE_EXCEEDED");
    }

    private record DorisHistoryCounts(int connected, int heartbeatRtt, int measuredRtt, int cancelled) {}

    private record TopicWireClient(Process process, BufferedReader output, JsonNode baseline, Path log) {}

    private static DorisSessionHistory awaitDorisSessionHistory(
            BackendAcceptanceTest host, UUID terminalRef, String sessionId, String closeReason, int minimumHeartbeats)
            throws Exception {
        Assertions.assertTrue(
                sessionId != null && sessionId.matches("[A-Za-z0-9._-]{1,128}"),
                "TDS_HISTORY_SESSION_ID_SHAPE_INVALID");
        Assertions.assertTrue(
                closeReason.matches("SESSION_REPLACED|ACTIVATION_CANCELLED"), "TDS_HISTORY_CLOSE_REASON_INVALID");
        String sql = "SELECT "
                + "COALESCE(SUM(CASE WHEN event_type='CONNECTED' THEN 1 ELSE 0 END),0), "
                + "COALESCE(SUM(CASE WHEN event_type='HEARTBEAT_RTT' THEN 1 ELSE 0 END),0), "
                + "COALESCE(SUM(CASE WHEN event_type='DISCONNECTED' AND close_reason='"
                + closeReason + "' THEN 1 ELSE 0 END),0) "
                + "FROM terminal_connection_history.connection_history WHERE terminal_ref='"
                + terminalRef + "' AND session_id='" + sessionId + "';\n";
        long deadline = System.nanoTime() + Duration.ofSeconds(35).toNanos();
        while (System.nanoTime() < deadline) {
            String[] values = BackendAcceptanceTest.runDorisSql(sql).strip().split("\\t");
            Assertions.assertEquals(3, values.length, "TDS_CROSS_NODE_HISTORY_READBACK_SHAPE_INVALID");
            DorisSessionHistory history = new DorisSessionHistory(
                    Integer.parseInt(values[0]), Integer.parseInt(values[1]), Integer.parseInt(values[2]));
            if (history.connected() == 1 && history.heartbeats() >= minimumHeartbeats && history.disconnected() == 1)
                return history;
            TimeUnit.MILLISECONDS.sleep(250);
        }
        throw new IllegalStateException("TDS_CROSS_NODE_HISTORY_READBACK_DEADLINE_EXCEEDED");
    }

    private record DorisSessionHistory(int connected, int heartbeats, int disconnected) {}

    private static void v15ReadinessWithdrawalAndDrain(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs15.readiness-withdrawal-and-drain";
        Assertions.assertEquals(scenario, tdsContractScenario(), "V-S15_TDS_SCENARIO_SELECTION_MISMATCH");
        Assertions.assertEquals(
                TdsAcceptanceProcess.TdsStartConfiguration.VS15_NODE_ID,
                tds.nodeId(),
                "V-S15_TDS_NODE_ID_CONFIGURATION_INVALID");
        Assertions.assertEquals(
                TdsAcceptanceProcess.TdsStartConfiguration.VS15_READINESS_WITHDRAWAL_WAIT_MS,
                tds.readinessWithdrawalWaitMillis(),
                "V-S15_READINESS_WITHDRAWAL_WAIT_CONFIGURATION_INVALID");

        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture activeFixture =
                business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture waitingFixture =
                business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture rejectFixture =
                business.createConnectionContractFixture(context);
        String activeMarker = UUID.randomUUID().toString();
        String waitingMarker = UUID.randomUUID().toString();
        SessionProbe active = null;
        SessionProbe waiting = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            active = startSessionProbe(tds, activeFixture, scenario, activeMarker, wireClientLog(tds, activeMarker));
            active.awaitReady(Duration.ofSeconds(15));
            Assertions.assertEquals(tds.nodeId(), active.nodeId(), "V-S15_ACTIVE_SESSION_READY_NODE_ID_MISMATCH");

            tds.requestGracefulStop();
            ReadinessSnapshot readiness = awaitReadinessWithdrawal(tds, Duration.ofSeconds(10));
            long readinessObservedNanos = System.nanoTime();
            Assertions.assertNotEquals(200, readiness.httpStatus(), "V-S15_READINESS_STILL_HTTP_OK");
            Assertions.assertNotEquals("UP", readiness.status(), "V-S15_READINESS_STILL_UP");

            active.ping(1);
            waiting =
                    startSessionProbe(tds, waitingFixture, scenario, waitingMarker, wireClientLog(tds, waitingMarker));
            waiting.awaitReady(Duration.ofSeconds(15));
            Assertions.assertEquals(tds.nodeId(), waiting.nodeId(), "V-S15_WAITING_SESSION_READY_NODE_ID_MISMATCH");
            waiting.ping(1);
            Assertions.assertEquals(
                    tds.nodeId(),
                    host.text(
                            "SELECT node_id FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND disconnected_at_epoch_millis IS NULL",
                            activeFixture.terminalRef()),
                    "V-S15_ACTIVE_LATEST_STATE_NODE_ID_MISMATCH");
            Assertions.assertEquals(
                    tds.nodeId(),
                    host.text(
                            "SELECT node_id FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref=? AND disconnected_at_epoch_millis IS NULL",
                            waitingFixture.terminalRef()),
                    "V-S15_WAITING_LATEST_STATE_NODE_ID_MISMATCH");

            tds.awaitLogMarker(
                    "event=tds_drain_started",
                    "event=tds_admission_refused readiness=REFUSING_TRAFFIC",
                    Duration.ofSeconds(10),
                    "V-S15_ADMISSION_REFUSAL_AFTER_WITHDRAWAL_WAIT_MISSING");
            long drainStartedNanos = System.nanoTime();
            long withdrawalElapsedMillis = TimeUnit.NANOSECONDS.toMillis(drainStartedNanos - readinessObservedNanos);
            Assertions.assertTrue(
                    withdrawalElapsedMillis
                            >= TdsAcceptanceProcess.TdsStartConfiguration.VS15_READINESS_WITHDRAWAL_WAIT_MS - 500,
                    "V-S15_ADMISSION_REFUSED_BEFORE_CONFIGURED_WITHDRAWAL_WAIT");
            Assertions.assertTrue(withdrawalElapsedMillis <= 10_000, "V-S15_WITHDRAWAL_WAIT_UPPER_BOUND_EXCEEDED");

            String rejectMarker = UUID.randomUUID().toString();
            Map<String, Object> rejectRequest = Map.of(
                    "scenario",
                    "terminal.connection.vs9.drain-reject",
                    "markerId",
                    rejectMarker,
                    "url",
                    tds.websocketBaseUrl() + "/tdp/" + rejectFixture.fixture().groupWorkspaceKey() + "/ws",
                    "authenticate",
                    Map.of(
                            "type",
                            "AUTHENTICATE",
                            "terminalRef",
                            rejectFixture.terminalRef().toString(),
                            "terminalCredential",
                            rejectFixture.generation() + "." + rejectFixture.credentialSecret(),
                            "deviceId",
                            rejectFixture.deviceId(),
                            "appVersion",
                            "backend-acceptance"),
                    "expectedClose",
                    Map.of("code", 4000, "reason", "REDIRECT_TO_NEXT_NODE"));
            JsonNode rejected = runWireClient(tds, rejectRequest);
            Assertions.assertEquals(4000, rejected.path("closeCode").asInt(), "V-S15_REDIRECT_CLOSE_CODE_INVALID");
            Assertions.assertEquals(
                    "REDIRECT_TO_NEXT_NODE", rejected.path("closeReason").asText(), "V-S15_NEW_SESSION_NOT_REDIRECTED");
            Assertions.assertEquals(
                    List.of(), strings(rejected.path("eventTypes")), "V-S15_REJECTED_SESSION_REACHED_AUTH");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            rejectFixture.terminalRef()),
                    "V-S15_REJECTED_SESSION_WAS_REGISTERED");

            active.awaitClose(4000, "REDIRECT_TO_NEXT_NODE", Duration.ofMillis(8_000));
            waiting.awaitClose(4000, "REDIRECT_TO_NEXT_NODE", Duration.ofMillis(8_000));
            int exitCode = tds.awaitProcessExit(Duration.ofSeconds(5));
            Assertions.assertTrue(exitCode == 0 || exitCode == 143, "V-S15_TDS_EXIT_STATUS_INVALID");

            String log = tds.logContents();
            Instant readinessWithdrawnAt = tdsEventTimestamp(log, "event=tds_readiness_withdrawn");
            Instant drainStartedAt = tdsEventTimestamp(log, "event=tds_drain_started");
            Instant activeClosedAt = tdsEventTimestamp(
                    log,
                    "event=tds_ws_close_started",
                    "sessionId=" + active.sessionId(),
                    "closeReason=REDIRECT_TO_NEXT_NODE");
            Instant waitingClosedAt = tdsEventTimestamp(
                    log,
                    "event=tds_ws_close_started",
                    "sessionId=" + waiting.sessionId(),
                    "closeReason=REDIRECT_TO_NEXT_NODE");
            long activeCloseElapsedMillis =
                    Duration.between(drainStartedAt, activeClosedAt).toMillis();
            long waitingCloseElapsedMillis =
                    Duration.between(drainStartedAt, waitingClosedAt).toMillis();
            Instant lastSessionClosedAt = activeClosedAt.isAfter(waitingClosedAt) ? activeClosedAt : waitingClosedAt;
            long withdrawalAndDrainElapsedMillis =
                    Duration.between(readinessWithdrawnAt, lastSessionClosedAt).toMillis();
            long maximumWithdrawalAndDrainMillis =
                    tds.readinessWithdrawalWaitMillis() + TdsAcceptanceProcess.ACCEPTANCE_DRAIN_WINDOW_MILLIS + 2_000;
            Assertions.assertTrue(
                    activeCloseElapsedMillis >= 0
                            && activeCloseElapsedMillis <= TdsAcceptanceProcess.ACCEPTANCE_DRAIN_WINDOW_MILLIS,
                    "V-S15_ACTIVE_SESSIONS_EXCEEDED_DRAIN_WINDOW");
            Assertions.assertTrue(
                    waitingCloseElapsedMillis >= 0
                            && waitingCloseElapsedMillis <= TdsAcceptanceProcess.ACCEPTANCE_DRAIN_WINDOW_MILLIS,
                    "V-S15_ACTIVE_SESSIONS_EXCEEDED_DRAIN_WINDOW");
            int admissionRefused = log.indexOf("event=tds_admission_refused");
            int drainStarted = log.indexOf("event=tds_drain_started");
            Assertions.assertTrue(
                    admissionRefused >= 0 && drainStarted > admissionRefused,
                    "V-S15_ADMISSION_DRAIN_LOG_ORDER_INVALID");
            Assertions.assertTrue(
                    log.contains("event=tds_drain_completed") && log.contains("Graceful shutdown complete"),
                    "V-S15_GRACEFUL_SHUTDOWN_DID_NOT_COMPLETE");
            Assertions.assertTrue(
                    withdrawalAndDrainElapsedMillis >= 0
                            && withdrawalAndDrainElapsedMillis <= maximumWithdrawalAndDrainMillis,
                    "V-S15_TOTAL_WITHDRAWAL_AND_DRAIN_BOUND_EXCEEDED");
            Assertions.assertEquals(
                    2L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref IN (?, ?) AND disconnected_at_epoch_millis IS NOT NULL "
                                    + "AND close_reason='REDIRECT_TO_NEXT_NODE'",
                            activeFixture.terminalRef(),
                            waitingFixture.terminalRef()),
                    "V-S15_SESSION_REDIRECT_READBACK_INVALID");

            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-tds-process-http-health-and-raw-node-websocket"),
                    Map.entry("readinessHttpStatus", readiness.httpStatus()),
                    Map.entry("readinessStatus", readiness.status()),
                    Map.entry("nodeId", tds.nodeId()),
                    Map.entry("activeSessionReadyNodeId", active.nodeId()),
                    Map.entry("waitingSessionReadyNodeId", waiting.nodeId()),
                    Map.entry("activeLatestStateNodeId", tds.nodeId()),
                    Map.entry("waitingLatestStateNodeId", tds.nodeId()),
                    Map.entry("pongsDuringWithdrawal", active.pongCount() + waiting.pongCount()),
                    Map.entry("newSessionAfterWithdrawal", "REDIRECTED_WITHOUT_SESSION_READY"),
                    Map.entry("withdrawalElapsedMillis", withdrawalElapsedMillis),
                    Map.entry("readinessToLastCloseElapsedMillis", withdrawalAndDrainElapsedMillis),
                    Map.entry("activeSessionCloseElapsedMillis", activeCloseElapsedMillis),
                    Map.entry("waitingSessionCloseElapsedMillis", waitingCloseElapsedMillis)));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS15_READINESS_WITHDRAWAL_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe activeToStop = active;
            SessionProbe waitingToStop = waiting;
            Throwable cleanupFailure = activeToStop == null ? null : attemptCleanup(null, activeToStop::stop);
            cleanupFailure =
                    waitingToStop == null ? cleanupFailure : attemptCleanup(cleanupFailure, waitingToStop::stop);
            cleanupFailure = attemptCleanup(cleanupFailure, tds::close);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static ReadinessSnapshot awaitReadinessWithdrawal(TdsAcceptanceProcess tds, Duration timeout)
            throws Exception {
        HttpClient client =
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        URI endpoint = URI.create(tds.httpBaseUrl() + "/actuator/health/readiness");
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode body = JSON.readTree(response.body());
            String status = body.path("status").asText("UNKNOWN");
            if (response.statusCode() != 200 && !"UP".equals(status)) {
                return new ReadinessSnapshot(response.statusCode(), status);
            }
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException("V-S15_READINESS_WITHDRAWAL_DEADLINE_EXCEEDED");
    }

    private static String tdsContractScenario() {
        String selected = System.getenv("V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO");
        return selected == null || selected.isBlank() ? null : selected;
    }

    private record ReadinessSnapshot(int httpStatus, String status) {}

    private static void v9GracefulShutdown(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs9.graceful-shutdown-order";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture activeFixture =
                business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture controlFixture =
                business.createConnectionContractFixture(context);
        String activeMarker = UUID.randomUUID().toString();
        String controlMarker = UUID.randomUUID().toString();
        SessionProbe active = null;
        SessionProbe control = null;
        String rejectMarker = UUID.randomUUID().toString();
        Path rejectedLog = wireClientLog(tds, rejectMarker);
        Process rejectedClient = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            active = startSessionProbe(
                    tds,
                    activeFixture,
                    "terminal.connection.vs9.draining-session",
                    activeMarker,
                    wireClientLog(tds, activeMarker));
            control = startSessionProbe(
                    tds,
                    controlFixture,
                    "terminal.connection.vs9.draining-session",
                    controlMarker,
                    wireClientLog(tds, controlMarker));
            active.awaitReady(Duration.ofSeconds(15));
            control.awaitReady(Duration.ofSeconds(15));
            long drainStartedNanos = System.nanoTime();
            tds.requestGracefulStop();
            tds.awaitLogMarker(
                    "event=tds_drain_started",
                    "event=tds_admission_refused readiness=REFUSING_TRAFFIC",
                    Duration.ofSeconds(10),
                    "V-S9_DRAIN_READINESS_MARKER_MISSING");
            control.ping(1);

            Map<String, Object> rejectRequest = Map.of(
                    "scenario",
                    "terminal.connection.vs9.drain-reject",
                    "markerId",
                    rejectMarker,
                    "url",
                    tds.websocketBaseUrl() + "/tdp/" + activeFixture.fixture().groupWorkspaceKey() + "/ws",
                    "expectedClose",
                    Map.of("code", 4000, "reason", "REDIRECT_TO_NEXT_NODE"));
            rejectedClient = startWireClient(rejectRequest, rejectedLog, false);
            JsonNode rejected = awaitWireResult(
                    rejectedClient, rejectedLog, Duration.ofSeconds(10), "terminal.connection.vs9.drain-reject");
            Assertions.assertEquals(4000, rejected.path("closeCode").asInt(), "V-S9_NEW_SESSION_CLOSE_CODE_INVALID");
            Assertions.assertEquals(
                    "REDIRECT_TO_NEXT_NODE", rejected.path("closeReason").asText(), "V-S9_NEW_SESSION_NOT_REDIRECTED");
            Assertions.assertEquals(
                    List.of(), strings(rejected.path("eventTypes")), "V-S9_NEW_SESSION_REACHED_AUTH_OR_REGISTRATION");

            active.awaitClose(4000, "REDIRECT_TO_NEXT_NODE", Duration.ofSeconds(15));
            control.awaitClose(4000, "REDIRECT_TO_NEXT_NODE", Duration.ofSeconds(15));
            long drainElapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - drainStartedNanos);
            long maximumShutdownMillis = TdsAcceptanceProcess.TdsStartConfiguration.DEFAULT_READINESS_WITHDRAWAL_WAIT_MS
                    + TdsAcceptanceProcess.ACCEPTANCE_DRAIN_WINDOW_MILLIS
                    + 2_000;
            Assertions.assertTrue(
                    drainElapsedMillis <= maximumShutdownMillis, "V-S9_WITHDRAWAL_AND_DRAIN_BOUND_EXCEEDED");
            tds.awaitLogMarker(
                    "event=tds_drain_started",
                    "event=tds_drain_completed",
                    Duration.ofSeconds(15),
                    "V-S9_DRAIN_COMPLETION_MARKER_MISSING");
            int exitCode = tds.awaitProcessExit(Duration.ofSeconds(5));
            Assertions.assertTrue(exitCode == 0 || exitCode == 143, "V-S9_TDS_EXIT_STATUS_INVALID");
            String log = tds.logContents();
            int drainStart = log.indexOf("event=tds_drain_started");
            int admissionRefused = log.indexOf("event=tds_admission_refused readiness=REFUSING_TRAFFIC");
            int drainComplete = log.indexOf("event=tds_drain_completed");
            Assertions.assertTrue(
                    admissionRefused >= 0 && drainStart > admissionRefused, "V-S9_ADMISSION_DRAIN_LOG_ORDER_INVALID");
            Assertions.assertTrue(drainComplete >= 0, "V-S9_DRAIN_COMPLETION_MARKER_MISSING");
            Assertions.assertEquals(
                    2L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state "
                                    + "WHERE terminal_ref IN (?, ?) AND disconnected_at_epoch_millis IS NOT NULL "
                                    + "AND close_reason='REDIRECT_TO_NEXT_NODE'",
                            activeFixture.terminalRef(),
                            controlFixture.terminalRef()),
                    "V-S9_ACTIVE_SESSION_REDIRECT_ROWS_INVALID");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-tds-process-and-pinned-node-websocket"),
                    Map.entry("readinessBeforeDrainComplete", "REFUSING_TRAFFIC"),
                    Map.entry("newUpgrade", "REDIRECTED_WITHOUT_SESSION_READY"),
                    Map.entry("controlSessionPongBeforeClose", true),
                    Map.entry("activeSessions", "REDIRECTED_WITHIN_DRAIN_WINDOW"),
                    Map.entry("drainElapsedMillis", drainElapsedMillis),
                    Map.entry("tdsExitCode", exitCode)));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS9_GRACEFUL_SHUTDOWN_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe activeToStop = active;
            SessionProbe controlToStop = control;
            Throwable cleanupFailure = activeToStop == null ? null : attemptCleanup(null, activeToStop::stop);
            cleanupFailure =
                    controlToStop == null ? cleanupFailure : attemptCleanup(cleanupFailure, controlToStop::stop);
            Process rejectedClientToStop = rejectedClient;
            cleanupFailure = attemptCleanup(cleanupFailure, () -> stopOwnedClient(rejectedClientToStop, rejectedLog));
            cleanupFailure = attemptCleanup(cleanupFailure, tds::close);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v6LatestState(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs6.latest-state-identity";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String oldMarker = UUID.randomUUID().toString();
        String currentMarker = UUID.randomUUID().toString();
        SessionProbe oldSession = null;
        SessionProbe currentSession = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            oldSession = startSessionProbe(
                    tds, fixture, "terminal.connection.vs4.session-takeover", oldMarker, wireClientLog(tds, oldMarker));
            oldSession.awaitReady(Duration.ofSeconds(15));
            oldSession.ping(1, 777.25);
            String oldSessionId = oldSession.sessionId();
            awaitLatestState(
                    host,
                    fixture.terminalRef(),
                    row -> oldSessionId.equals(row.get("session_id"))
                            && Math.abs(((Number) row.get("last_rtt_ms")).doubleValue() - 777.25d) < 0.001d,
                    Duration.ofSeconds(5),
                    "V-S6_OLD_SESSION_RTT_NOT_READ_BACK");
            Map<String, Object> beforeTakeover = latestState(host, fixture.terminalRef());
            Assertions.assertEquals(oldSession.sessionId(), beforeTakeover.get("session_id"));
            Assertions.assertEquals(
                    777.25d,
                    ((Number) beforeTakeover.get("last_rtt_ms")).doubleValue(),
                    0.001d,
                    "V-S6_OLD_SESSION_RTT_NOT_READ_BACK");

            currentSession =
                    startSessionProbe(tds, fixture, scenario, currentMarker, wireClientLog(tds, currentMarker));
            currentSession.awaitReady(Duration.ofSeconds(15));
            Map<String, Object> currentBeforePing = latestState(host, fixture.terminalRef());
            Assertions.assertEquals(
                    currentSession.sessionId(), currentBeforePing.get("session_id"), "V-S6_NEW_SESSION_NOT_LATEST");
            Assertions.assertNull(
                    currentBeforePing.get("disconnected_at_epoch_millis"),
                    "V-S6_CURRENT_SESSION_PREMATURELY_DISCONNECTED");
            Assertions.assertEquals(
                    0d,
                    ((Number) currentBeforePing.get("last_rtt_ms")).doubleValue(),
                    0.001d,
                    "V-S6_NEW_SESSION_RTT_NOT_RESET");
            Assertions.assertEquals(
                    currentBeforePing.get("connected_at_epoch_millis"),
                    currentBeforePing.get("last_activity_at_epoch_millis"),
                    "V-S6_NEW_SESSION_INITIAL_ACTIVITY_MISMATCH");

            oldSession.awaitClose(4000, "SESSION_REPLACED", Duration.ofSeconds(15));
            oldSession = null;
            currentSession.ping(2, 42.5);
            String currentSessionId = currentSession.sessionId();
            awaitLatestState(
                    host,
                    fixture.terminalRef(),
                    row -> currentSessionId.equals(row.get("session_id"))
                            && ((Number) row.get("last_rtt_ms")).doubleValue() == 42.5d
                            && ((Number) row.get("last_activity_at_epoch_millis")).longValue()
                                    > ((Number) row.get("connected_at_epoch_millis")).longValue(),
                    Duration.ofSeconds(5),
                    "V-S6_CURRENT_HEARTBEAT_NOT_PERSISTED");
            Map<String, Object> afterOldDisconnect = latestState(host, fixture.terminalRef());
            Assertions.assertEquals(
                    currentSession.sessionId(),
                    afterOldDisconnect.get("session_id"),
                    "V-S6_OLD_DISCONNECT_REPLACED_LATEST_SESSION");
            Assertions.assertNull(
                    afterOldDisconnect.get("disconnected_at_epoch_millis"),
                    "V-S6_OLD_DISCONNECT_CLOSED_CURRENT_SESSION");

            currentSession.finish(Duration.ofSeconds(10));
            awaitAnySessionDisconnectRecord(
                    host, fixture.terminalRef(), currentSession.sessionId(), Duration.ofSeconds(10));
            Map<String, Object> disconnected = latestState(host, fixture.terminalRef());
            Assertions.assertEquals(currentSession.sessionId(), disconnected.get("session_id"));
            Assertions.assertNotNull(
                    disconnected.get("disconnected_at_epoch_millis"), "V-S6_CURRENT_DISCONNECT_TIMESTAMP_MISSING");
            Assertions.assertTrue(
                    ((Number) disconnected.get("last_activity_at_epoch_millis")).longValue()
                            <= ((Number) disconnected.get("disconnected_at_epoch_millis")).longValue(),
                    "V-S6_FINAL_ACTIVITY_AFTER_DISCONNECT");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-postgresql-and-pinned-node-websocket"),
                    Map.entry("latestState", "CONNECTED_ACTIVITY_RTT_DISCONNECT_VERIFIED"),
                    Map.entry("staleSession", "REPLACED_DISCONNECT_DID_NOT_MUTATE_LATEST")));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS6_LATEST_STATE_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe oldToStop = oldSession;
            SessionProbe currentToStop = currentSession;
            Throwable cleanupFailure = oldToStop == null ? null : attemptCleanup(null, oldToStop::stop);
            cleanupFailure =
                    currentToStop == null ? cleanupFailure : attemptCleanup(cleanupFailure, currentToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    static Stream<DynamicTest> v8HeartbeatBoundsScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess tds) {
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.vs8.write-bounds-runtime-blocking-and-capacity",
                () -> v8HeartbeatBoundsScenario(host, tds)));
    }

    private static void v8HeartbeatBoundsScenario(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        V8_SCAN_FAILURE_EVIDENCE.remove();
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs8.write-bounds-runtime-blocking-and-capacity";
        int cohort = tds.maxTrackedSessions();
        Assertions.assertTrue(cohort > 0, "V-S8_TRACKED_CAPACITY_INVALID");
        Assertions.assertEquals(15_000L, tds.stateWriteIntervalMillis(), "V-S8_STATE_WRITE_INTERVAL_INVALID");
        Assertions.assertTrue(
                tds.logContents().contains("event=tds_acceptance_blockhound_installed version=1.0.17.RELEASE"),
                "V-S8_BLOCKHOUND_RUNTIME_NOT_INSTALLED");

        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        List<V8Session> sessions = new ArrayList<>();
        java.sql.Connection disconnectRowLock = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            assertRuntimeBlockHoundDetectsEventLoopBlocking(tds);
            for (int index = 0; index < cohort; index++) {
                StoreTerminalAcceptanceScenarios.ConnectionFixture fixture =
                        business.createConnectionContractFixture(context);
                String markerId = UUID.randomUUID().toString();
                SessionProbe probe = startSessionProbe(
                        tds, fixture, "terminal.connection.vs8.load-probe", markerId, wireClientLog(tds, markerId));
                probe.awaitReady(Duration.ofSeconds(15));
                sessions.add(new V8Session(fixture, probe));
            }
            awaitAllV8SessionsConnected(host, sessions, Duration.ofSeconds(10));
            AtomicInteger nextPingSequence = new AtomicInteger(1);
            V8Window twoSecondWindow = runV8HeartbeatWindow(host, tds, sessions, 2_000, 32_000, nextPingSequence);
            V8Window oneSecondWindow = runV8HeartbeatWindow(host, tds, sessions, 1_000, 32_000, nextPingSequence);
            for (V8Session session : sessions) {
                Map<String, Object> row = latestState(host, session.fixture().terminalRef());
                Assertions.assertEquals(
                        session.probe().sessionId(), row.get("session_id"), "V-S8_LATEST_SESSION_ID_CHANGED");
                Assertions.assertNull(row.get("disconnected_at_epoch_millis"), "V-S8_SESSION_DISCONNECTED_DURING_LOAD");
                Assertions.assertTrue(
                        ((Number) row.get("last_activity_at_epoch_millis")).longValue()
                                > ((Number) row.get("connected_at_epoch_millis")).longValue(),
                        "V-S8_ACTIVITY_DID_NOT_ADVANCE");
                double persistedRtt = ((Number) row.get("last_rtt_ms")).doubleValue();
                Assertions.assertTrue(
                        session.probe().sentRtts().contains(persistedRtt),
                        "V-S8_PERSISTED_RTT_WAS_NOT_SENT_BY_SESSION");
            }

            StoreTerminalAcceptanceScenarios.ConnectionFixture candidate =
                    business.createConnectionContractFixture(context);
            assertTrackedCapacityRejection(tds, candidate, "V-S8_CANDIDATE_NOT_REJECTED_AT_CAPACITY");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            candidate.terminalRef()),
                    "V-S8_REJECTED_CANDIDATE_WROTE_STATE");

            V8Session disconnecting = sessions.getFirst();
            String disconnectedSessionId = disconnecting.probe().sessionId();
            disconnectRowLock = host.holdLatestConnectionStateRowLockForAcceptance(
                    disconnecting.fixture().fixture(), disconnecting.fixture().terminalRef());
            disconnecting.probe().finish(Duration.ofSeconds(10));
            sessions.removeFirst();
            host.awaitLatestConnectionStateLockWaiters(1, Duration.ofMillis(tds.stateWriteIntervalMillis() + 5_000));
            awaitTdsLogContains(
                    tds,
                    "event=tds_disconnect_write_failed sessionId=" + disconnectedSessionId,
                    Duration.ofSeconds(10),
                    "V-S8_DISCONNECT_FAILURE_NOT_OBSERVED");

            assertTrackedCapacityRejection(tds, candidate, "V-S8_PENDING_DISCONNECT_RELEASED_PERMIT_EARLY");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            candidate.terminalRef()),
                    "V-S8_PENDING_DISCONNECT_REJECTION_WROTE_STATE");
            for (V8Session session : sessions) {
                session.probe().ping(nextPingSequence.getAndIncrement(), 91.5);
                Map<String, Object> row = latestState(host, session.fixture().terminalRef());
                Assertions.assertEquals(
                        session.probe().sessionId(),
                        row.get("session_id"),
                        "V-S8_CAP_REJECTION_DISTURBED_ACTIVE_SESSION");
                Assertions.assertNull(
                        row.get("disconnected_at_epoch_millis"), "V-S8_CAP_REJECTION_CLOSED_ACTIVE_SESSION");
            }

            disconnectRowLock.rollback();
            disconnectRowLock.close();
            disconnectRowLock = null;
            awaitTdsLogContains(
                    tds,
                    "event=tds_tracked_session_permit_released sessionId=" + disconnectedSessionId,
                    Duration.ofSeconds(25),
                    "V-S8_TRACKED_PERMIT_NOT_RELEASED_AFTER_RETRY");
            awaitAnySessionDisconnectRecord(
                    host, disconnecting.fixture().terminalRef(), disconnectedSessionId, Duration.ofSeconds(5));

            // Capacity recovery can take most of the configured heartbeat timeout. Keep the
            // remaining real sessions alive before starting the retry and closing the cohort.
            for (V8Session session : sessions) {
                session.probe().ping(nextPingSequence.getAndIncrement(), 92.5);
            }

            String retryMarker = UUID.randomUUID().toString();
            SessionProbe retry = startSessionProbe(
                    tds, candidate, "terminal.connection.vs8.load-probe", retryMarker, wireClientLog(tds, retryMarker));
            retry.awaitReady(Duration.ofSeconds(15));
            sessions.add(new V8Session(candidate, retry));

            List<String> sessionsToVerifyDisconnected = new ArrayList<>();
            for (V8Session session : sessions) {
                String sessionId = session.probe().sessionId();
                session.probe().finish(Duration.ofSeconds(10));
                sessionsToVerifyDisconnected.add(sessionId);
            }
            for (int index = 0; index < sessions.size(); index++) {
                V8Session session = sessions.get(index);
                awaitAnySessionDisconnectRecord(
                        host,
                        session.fixture().terminalRef(),
                        sessionsToVerifyDisconnected.get(index),
                        Duration.ofSeconds(20));
            }
            sessions.clear();

            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-tds-test-runtime-with-pinned-blockhound-and-postgresql"),
                    Map.entry("cohort", cohort),
                    Map.entry("stateWriteIntervalMillis", tds.stateWriteIntervalMillis()),
                    Map.entry("twoSecondWindow", twoSecondWindow.asMap()),
                    Map.entry("oneSecondWindow", oneSecondWindow.asMap()),
                    Map.entry("steadyHeartbeatBusinessTableScans", 0),
                    Map.entry("blockHound", "EVENT_LOOP_BLOCKING_DETECTED"),
                    Map.entry("trackedCapacity", "REJECTED_WHILE_FULL_AND_REUSED_AFTER_DISCONNECT_PERSISTED"),
                    Map.entry("disconnectWriteFailure", "PERMIT_RETAINED_UNTIL_SUCCESSFUL_RETRY")));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeV8ScenarioFailure(runId, scenario, failure);
            throw failure;
        } finally {
            java.sql.Connection rowLock = disconnectRowLock;
            Throwable cleanupFailure = rowLock == null
                    ? null
                    : attemptCleanup(null, () -> {
                        rowLock.rollback();
                        rowLock.close();
                    });
            for (V8Session session : List.copyOf(sessions)) {
                cleanupFailure = attemptCleanup(cleanupFailure, session.probe()::stop);
            }
            try {
                finishCleanup(scenarioFailure, cleanupFailure);
            } finally {
                V8_SCAN_FAILURE_EVIDENCE.remove();
            }
        }
    }

    private static void assertRuntimeBlockHoundDetectsEventLoopBlocking(TdsAcceptanceProcess tds) throws Exception {
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(tds.httpBaseUrl() + "/__acceptance/blockhound-probe"))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        java.net.http.HttpResponse<Void> response = java.net.http.HttpClient.newHttpClient()
                .send(request, java.net.http.HttpResponse.BodyHandlers.discarding());
        Assertions.assertEquals(204, response.statusCode(), "V-S8_BLOCKHOUND_PROBE_STATUS_INVALID");
        Assertions.assertEquals(
                "DETECTED",
                response.headers().firstValue("X-TDS-BlockHound-Probe").orElse("MISSING"),
                "V-S8_EVENT_LOOP_BLOCKING_NOT_DETECTED");
        awaitTdsLogContains(
                tds,
                "event=tds_acceptance_blockhound_probe result=DETECTED",
                Duration.ofSeconds(2),
                "V-S8_BLOCKHOUND_PROBE_LOG_MISSING");
    }

    private static void awaitAllV8SessionsConnected(
            BackendAcceptanceTest host, List<V8Session> sessions, Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            boolean connected = true;
            for (V8Session session : sessions) {
                Map<String, Object> row = latestState(host, session.fixture().terminalRef());
                connected &= session.probe().sessionId().equals(row.get("session_id"))
                        && row.get("disconnected_at_epoch_millis") == null;
            }
            if (connected) return;
            TimeUnit.MILLISECONDS.sleep(100);
        }
        throw new IllegalStateException("V-S8_SESSION_COHORT_NOT_CONNECTED");
    }

    private static V8Window runV8HeartbeatWindow(
            BackendAcceptanceTest host,
            TdsAcceptanceProcess tds,
            List<V8Session> sessions,
            int cadenceMillis,
            int requestedWindowMillis,
            AtomicInteger nextPingSequence)
            throws Exception {
        TimeUnit.MILLISECONDS.sleep(1_200);
        Map<String, Object> before = host.tdsHeartbeatStatisticsSnapshot();
        String logBefore = tds.logContents();
        long snapshotBeforeNanos = System.nanoTime();
        sessions.forEach(session -> session.probe().beginPingCadenceMeasurement());
        int cycles = driveV8Heartbeats(sessions, cadenceMillis, requestedWindowMillis, nextPingSequence);
        TimeUnit.MILLISECONDS.sleep(1_200);
        Map<String, Object> after = host.tdsHeartbeatStatisticsSnapshot();
        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - snapshotBeforeNanos);
        Assertions.assertTrue(elapsedMillis >= 30_000, "V-S8_WINDOW_SHORTER_THAN_TWO_WRITE_INTERVALS");

        long beforeWrites = ((Number) before.get("latestStateUpdates")).longValue();
        long afterWrites = ((Number) after.get("latestStateUpdates")).longValue();
        long updateDelta = afterWrites - beforeWrites;
        long upperBound = (long) sessions.size() * ((elapsedMillis + 14_999) / 15_000 + 2);
        Assertions.assertTrue(
                updateDelta >= 0 && updateDelta <= upperBound, "V-S8_LATEST_STATE_WRITE_UPPER_BOUND_EXCEEDED");
        long tableScanDelta = ((Number) after.get("businessTableScans")).longValue()
                - ((Number) before.get("businessTableScans")).longValue();
        if (tableScanDelta != 0) {
            V8_SCAN_FAILURE_EVIDENCE.set(Map.of(
                    "delta", tableScanDelta,
                    "before", businessTableScanCounts(before),
                    "after", businessTableScanCounts(after)));
        }
        Assertions.assertEquals(0, tableScanDelta, "V-S8_STEADY_HEARTBEAT_READ_BUSINESS_TABLE");

        String logAfter = tds.logContents();
        Assertions.assertTrue(logAfter.startsWith(logBefore), "V-S8_TDS_LOG_PREFIX_CHANGED_DURING_WINDOW");
        String windowLog = logAfter.substring(logBefore.length());
        Matcher heartbeatWrites = Pattern.compile("event=tds_heartbeat_write_completed requested=(\\d+) updated=(\\d+) "
                        + "pendingHeartbeats=(\\d+) pendingDisconnects=(\\d+)")
                .matcher(windowLog);
        int flushCount = 0;
        while (heartbeatWrites.find()) {
            flushCount++;
            Assertions.assertTrue(
                    Integer.parseInt(heartbeatWrites.group(1)) <= sessions.size(),
                    "V-S8_HEARTBEAT_BATCH_EXCEEDED_COHORT");
            Assertions.assertTrue(
                    Integer.parseInt(heartbeatWrites.group(3)) <= sessions.size(),
                    "V-S8_PENDING_HEARTBEAT_LIMIT_EXCEEDED");
            Assertions.assertTrue(
                    Integer.parseInt(heartbeatWrites.group(4)) <= tds.maxTrackedSessions(),
                    "V-S8_PENDING_DISCONNECT_LIMIT_EXCEEDED");
        }
        Assertions.assertTrue(flushCount >= 2, "V-S8_HEARTBEAT_FLUSH_LOGS_MISSING");

        Matcher healthProbes = Pattern.compile(
                        "event=tds_listener_health_probe_completed backendPid=\\d+ intervalMillis=(\\d+)")
                .matcher(windowLog);
        int healthProbeCount = 0;
        while (healthProbes.find()) {
            healthProbeCount++;
            Assertions.assertTrue(
                    Long.parseLong(healthProbes.group(1)) >= 10_000, "V-S8_LISTENER_HEALTH_PROBE_INTERVAL_TOO_SHORT");
        }
        Assertions.assertTrue(
                healthProbeCount <= (elapsedMillis + 9_999) / 10_000 + 1, "V-S8_LISTENER_HEALTH_PROBE_RATE_EXCEEDED");

        long maximumPingGapMillis = sessions.stream()
                .mapToLong(session -> session.probe().maximumPingGapMillis())
                .max()
                .orElseThrow();
        System.out.printf(
                "BACKEND_ACCEPTANCE_VS8_PING_CADENCE cadenceMillis=%d cohort=%d maximumPingGapMillis=%d "
                        + "maximumAllowedMillis=%d%n",
                cadenceMillis, sessions.size(), maximumPingGapMillis, cadenceMillis + 350);
        Assertions.assertTrue(maximumPingGapMillis <= cadenceMillis + 350, "V-S8_HEARTBEAT_CADENCE_GAP_EXCEEDED");
        V8Window window = new V8Window(
                elapsedMillis,
                cadenceMillis,
                cycles,
                beforeWrites,
                afterWrites,
                updateDelta,
                upperBound,
                ((Number) before.get("businessTableScans")).longValue(),
                ((Number) after.get("businessTableScans")).longValue(),
                flushCount,
                healthProbeCount,
                maximumPingGapMillis);
        System.out.printf(
                "BACKEND_ACCEPTANCE_VS8_WINDOW cadenceMillis=%d cohort=%d elapsedMillis=%d cycles=%d "
                        + "updatesBefore=%d updatesAfter=%d updateDelta=%d upperBound=%d businessScansBefore=%d "
                        + "businessScansAfter=%d flushes=%d listenerHealthProbes=%d maximumPingGapMillis=%d%n",
                cadenceMillis,
                sessions.size(),
                elapsedMillis,
                cycles,
                beforeWrites,
                afterWrites,
                updateDelta,
                upperBound,
                window.businessScansBefore(),
                window.businessScansAfter(),
                flushCount,
                healthProbeCount,
                maximumPingGapMillis);
        return window;
    }

    private static int driveV8Heartbeats(
            List<V8Session> sessions, int cadenceMillis, int requestedWindowMillis, AtomicInteger nextPingSequence)
            throws Exception {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(requestedWindowMillis);
        long cadenceNanos = TimeUnit.MILLISECONDS.toNanos(cadenceMillis);
        long nextCycle = System.nanoTime();
        int cycles = 0;
        while (System.nanoTime() < deadline) {
            for (V8Session session : sessions) {
                int sequence = nextPingSequence.getAndIncrement();
                double rtt = (sequence % 1_000) + 1;
                session.probe().ping(sequence, rtt);
            }
            cycles++;
            nextCycle += cadenceNanos;
            long remaining = nextCycle - System.nanoTime();
            if (remaining > 0) TimeUnit.NANOSECONDS.sleep(remaining);
            else nextCycle = System.nanoTime();
        }
        int minimumCycles = requestedWindowMillis / cadenceMillis - 1;
        Assertions.assertTrue(cycles >= minimumCycles, "V-S8_HEARTBEAT_CYCLE_COUNT_TOO_LOW");
        return cycles;
    }

    private static void assertTrackedCapacityRejection(
            TdsAcceptanceProcess tds, StoreTerminalAcceptanceScenarios.ConnectionFixture candidate, String failureCode)
            throws Exception {
        String scenario = "terminal.connection.vs8.tracked-capacity";
        String markerId = UUID.randomUUID().toString();
        Path log = wireClientLog(tds, markerId);
        Process client = null;
        Throwable scenarioFailure = null;
        try {
            client = startWireClient(
                    closeExpectedRequest(tds, candidate, scenario, markerId, 4000, "NODE_BUSY"), log, false);
            JsonNode rejected = awaitWireResult(client, log, Duration.ofSeconds(15), scenario);
            Assertions.assertEquals(4000, rejected.path("closeCode").asInt(), failureCode + "_CLOSE_CODE");
            Assertions.assertEquals("NODE_BUSY", rejected.path("closeReason").asText(), failureCode + "_REASON");
            Assertions.assertTrue(rejected.path("sessionId").isNull(), failureCode + "_SESSION_REGISTERED");
            Assertions.assertEquals(List.of(), strings(rejected.path("eventTypes")), failureCode + "_APP_MESSAGE_SENT");
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            throw failure;
        } finally {
            Process clientToStop = client;
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop, log));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void awaitTdsLogContains(
            TdsAcceptanceProcess tds, String marker, Duration timeout, String failureCode) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        do {
            if (!tds.processAlive()) throw new IllegalStateException(failureCode + "_TDS_PROCESS_EXITED");
            if (tds.logContents().contains(marker)) return;
            TimeUnit.MILLISECONDS.sleep(50);
        } while (System.nanoTime() < deadline);
        throw new IllegalStateException(failureCode);
    }

    private record V8Session(StoreTerminalAcceptanceScenarios.ConnectionFixture fixture, SessionProbe probe) {}

    private record V8Window(
            long elapsedMillis,
            int cadenceMillis,
            int cycles,
            long updatesBefore,
            long updatesAfter,
            long updateDelta,
            long updateUpperBound,
            long businessScansBefore,
            long businessScansAfter,
            int heartbeatFlushes,
            int listenerHealthProbes,
            long maximumPingGapMillis) {
        Map<String, Object> asMap() {
            return Map.ofEntries(
                    Map.entry("elapsedMillis", elapsedMillis),
                    Map.entry("cadenceMillis", cadenceMillis),
                    Map.entry("cycles", cycles),
                    Map.entry("updatesBefore", updatesBefore),
                    Map.entry("updatesAfter", updatesAfter),
                    Map.entry("updateDelta", updateDelta),
                    Map.entry("updateUpperBound", updateUpperBound),
                    Map.entry("businessScansBefore", businessScansBefore),
                    Map.entry("businessScansAfter", businessScansAfter),
                    Map.entry("heartbeatFlushes", heartbeatFlushes),
                    Map.entry("listenerHealthProbes", listenerHealthProbes),
                    Map.entry("maximumPingGapMillis", maximumPingGapMillis));
        }
    }

    private static Map<String, Object> latestState(BackendAcceptanceTest host, UUID terminalRef) {
        return host.queryForMap(
                "SELECT node_id, session_id, session_sequence, connected_at_epoch_millis, "
                        + "disconnected_at_epoch_millis, "
                        + "last_activity_at_epoch_millis, last_rtt_ms, close_reason "
                        + "FROM terminal_connection.latest_state WHERE terminal_ref=?",
                terminalRef);
    }

    private static void awaitLatestState(
            BackendAcceptanceTest host,
            UUID terminalRef,
            java.util.function.Predicate<Map<String, Object>> condition,
            Duration timeout,
            String failureCode)
            throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            Map<String, Object> row = latestState(host, terminalRef);
            if (condition.test(row)) return;
            TimeUnit.MILLISECONDS.sleep(100);
        }
        throw new IllegalStateException(failureCode);
    }

    private static void v11SecretSearch(BackendAcceptanceTest host, TdsAcceptanceProcess tds) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.vs11.secret-search";
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        String markerId = UUID.randomUUID().toString();
        Path markerFile = tds.directory().resolve("secret-search-marker-" + markerId + ".txt");
        Files.writeString(markerFile, "SEARCHABLE_SAFE_MARKER " + markerId + "\n", StandardCharsets.UTF_8);
        SessionProbe probe = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            probe = startSessionProbe(tds, fixture, scenario, markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(15));
            probe.ping(1);
            String sessionId = probe.sessionId();
            probe.finish(Duration.ofSeconds(10));
            awaitAnySessionDisconnectRecord(host, fixture.terminalRef(), sessionId, Duration.ofSeconds(10));

            List<String> protectedValues = secretSearchValues(fixture.generation(), fixture.credentialSecret());
            protectedValues = new ArrayList<>(protectedValues);
            protectedValues.add(fixture.activationCode());
            protectedValues.add(fixture.deviceId());
            protectedValues.add(credentialSecretDigestHex(fixture.credentialSecret()));
            boolean markerFound = false;
            Path runDirectory = Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_DIRECTORY"))
                    .toAbsolutePath()
                    .normalize();
            Assertions.assertTrue(Files.isDirectory(runDirectory), "V-S11_ACCEPTANCE_RUN_DIRECTORY_INVALID");
            Assertions.assertTrue(
                    tds.directory().toAbsolutePath().normalize().startsWith(runDirectory),
                    "V-S11_TDS_DIRECTORY_OUTSIDE_RUN_DIRECTORY");
            try (var paths = Files.walk(runDirectory)) {
                for (Path path : paths.filter(
                                candidate -> Files.isRegularFile(candidate, java.nio.file.LinkOption.NOFOLLOW_LINKS))
                        .toList()) {
                    String name = path.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
                    if (!(name.endsWith(".log")
                            || name.endsWith(".txt")
                            || name.endsWith(".json")
                            || name.endsWith(".jsonl")
                            || name.endsWith(".out"))) continue;
                    String contents = Files.readString(path, StandardCharsets.UTF_8);
                    markerFound |= contents.contains(markerId);
                    assertNoProtectedValues(contents, protectedValues, "V-S11_SECRET_IN_TDS_DIAGNOSTICS");
                }
            }
            Assertions.assertTrue(markerFound, "V-S11_MARKER_SEARCH_DID_NOT_FIND_SENTINEL");
            String dorisSql = "SELECT event_id,event_time_epoch_millis,event_type,workspace_uuid,terminal_ref,node_id,"
                    + "session_id,session_sequence,rtt_ms,close_reason "
                    + "FROM terminal_connection_history.connection_history WHERE terminal_ref='"
                    + fixture.terminalRef() + "';\n";
            long dorisDeadline = System.nanoTime() + Duration.ofSeconds(35).toNanos();
            String dorisRows;
            do {
                dorisRows = BackendAcceptanceTest.runDorisSql(dorisSql, false).strip();
                if (dorisRows.lines().filter(line -> !line.isBlank()).count() >= 3) break;
                TimeUnit.MILLISECONDS.sleep(250);
            } while (System.nanoTime() < dorisDeadline);
            Assertions.assertTrue(
                    dorisRows.lines().filter(line -> !line.isBlank()).count() >= 3, "V-S11_DORIS_HISTORY_ROWS_MISSING");
            assertNoProtectedValues(dorisRows, protectedValues, "V-S11_SECRET_IN_DORIS_HISTORY");
            Assertions.assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM terminal_binding.latest_binding "
                                    + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? "
                                    + "AND credential_digest=decode(?, 'hex')",
                            fixture.fixture().workspaceUuid(),
                            fixture.fixture().groupWorkspaceKey(),
                            fixture.terminalRef(),
                            credentialSecretDigestHex(fixture.credentialSecret())),
                    "V-S11_CREDENTIAL_DIGEST_OWNER_ROW_MISSING");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-http-activation-and-tds-websocket"),
                    Map.entry("searchedOutputs", List.of(V_S11_SEARCHED_OUTPUTS)),
                    Map.entry("markerSearch", "FOUND"),
                    Map.entry(
                            "dorisHistoryRows",
                            dorisRows.lines().filter(line -> !line.isBlank()).count()),
                    Map.entry(
                            "protectedValues",
                            List.of("credential", "credentialDigest", "secret", "activationCode", "deviceId"))));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS11_SECRET_SEARCH_FAILED", failure);
            throw failure;
        } finally {
            SessionProbe probeToStop = probe;
            Throwable cleanupFailure = probeToStop == null ? null : attemptCleanup(null, probeToStop::stop);
            cleanupFailure = attemptCleanup(cleanupFailure, () -> Files.deleteIfExists(markerFile));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static List<String> secretSearchValues(long generation, String secret) {
        String credential = generation + "." + secret;
        return List.of(
                secret,
                credential,
                Base64.getEncoder().encodeToString(secret.getBytes(StandardCharsets.UTF_8)),
                Base64.getEncoder().encodeToString(credential.getBytes(StandardCharsets.UTF_8)),
                HexFormat.of().formatHex(secret.getBytes(StandardCharsets.UTF_8)));
    }

    private static String credentialSecretDigestHex(String encodedSecret) throws Exception {
        byte[] secretBytes = Base64.getUrlDecoder().decode(encodedSecret);
        try {
            return HexFormat.of()
                    .formatHex(
                            java.security.MessageDigest.getInstance("SHA-256").digest(secretBytes));
        } finally {
            java.util.Arrays.fill(secretBytes, (byte) 0);
        }
    }

    private static void assertNoProtectedValues(String contents, List<String> protectedValues, String assertion) {
        for (String protectedValue : protectedValues) {
            Assertions.assertFalse(contents.contains(protectedValue), assertion);
        }
    }

    private static void writeScenarioFailure(String runId, String scenario, String category, Throwable failure)
            throws Exception {
        writeContractResult(Map.ofEntries(
                Map.entry("type", "transport-contract"),
                Map.entry("operation", scenario),
                Map.entry("module", "TERMINAL_DATA_SERVER"),
                Map.entry("contract", "FAIL"),
                Map.entry("status", "FAIL"),
                Map.entry("runId", runId),
                Map.entry("failureCategory", category),
                Map.entry("failureCode", safeFailureCode(failure))));
    }

    private static void writeV8ScenarioFailure(String runId, String scenario, Throwable failure) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", "transport-contract");
        result.put("operation", scenario);
        result.put("module", "TERMINAL_DATA_SERVER");
        result.put("contract", "FAIL");
        result.put("status", "FAIL");
        result.put("runId", runId);
        result.put("failureCategory", "TDS_VS8_HEARTBEAT_BOUNDS_FAILED");
        result.put("failureCode", safeFailureCode(failure));
        Map<String, Object> scanEvidence = V8_SCAN_FAILURE_EVIDENCE.get();
        if (scanEvidence != null) result.put("businessTableScanEvidence", scanEvidence);
        writeContractResult(result);
    }

    private static Map<String, Long> businessTableScanCounts(Map<String, Object> snapshot) {
        return Map.of(
                "platform_workspace.workspace", ((Number) snapshot.get("workspaceScans")).longValue(),
                "organization.store", ((Number) snapshot.get("storeScans")).longValue(),
                "store_terminal.terminal", ((Number) snapshot.get("terminalScans")).longValue(),
                "terminal_binding.latest_binding", ((Number) snapshot.get("bindingScans")).longValue());
    }

    private static void v2AuthenticationRejection(
            BackendAcceptanceTest host, TdsAcceptanceProcess tds, String scenario, String expectedReason)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String markerId = UUID.randomUUID().toString();
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        UUID targetTerminalRef = fixture.terminalRef();
        String groupWorkspaceKey = fixture.fixture().groupWorkspaceKey();
        String deviceId = fixture.deviceId();
        String secret = fixture.credentialSecret();
        boolean firstFrameExpected = !"terminal.connection.auth.no-first-frame-timeout".equals(scenario);

        switch (scenario) {
            case "terminal.connection.auth.never-registered" -> targetTerminalRef = UUID.randomUUID();
            case "terminal.connection.auth.wrong-secret" -> secret = newCredentialSecret();
            case "terminal.connection.auth.active-device-mismatch" -> deviceId =
                    "different-device-" + UUID.randomUUID();
            case "terminal.connection.auth.ended-different-device" -> {
                business.performConnectionRevocation(
                        context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                deviceId = "different-device-" + UUID.randomUUID();
            }
            case "terminal.connection.auth.group-path-mismatch" -> {
                StoreTerminalAcceptanceScenarios.ConnectionFixture otherWorkspace =
                        business.createConnectionContractFixture(context);
                groupWorkspaceKey = otherWorkspace.fixture().groupWorkspaceKey();
                Assertions.assertNotEquals(fixture.fixture().groupWorkspaceKey(), groupWorkspaceKey);
            }
            case "terminal.connection.auth.cancelled" -> business.performConnectionRevocation(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            case "terminal.connection.auth.terminal-voided" -> business.performConnectionRevocation(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.TERMINAL_VOID);
            case "terminal.connection.auth.store-voided" -> business.performConnectionStatusOnlyChange(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.STORE_VOIDED);
            case "terminal.connection.auth.group-disabled" -> business.performConnectionStatusOnlyChange(
                    context,
                    fixture,
                    StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.GROUP_WORKSPACE_DISABLED);
            case "terminal.connection.auth.terminal-disabled" -> business.performConnectionStatusOnlyChange(
                    context, fixture, StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.TERMINAL_DISABLED);
            case "terminal.connection.auth.revoked-group-disabled" -> {
                business.performConnectionRevocation(
                        context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                business.performConnectionStatusOnlyChange(
                        context,
                        fixture,
                        StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.GROUP_WORKSPACE_DISABLED);
            }
            case "terminal.connection.auth.unknown-store-voided" -> {
                business.performConnectionStatusOnlyChange(
                        context, fixture, StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.STORE_VOIDED);
                targetTerminalRef = UUID.randomUUID();
            }
            case "terminal.connection.auth.revoked-terminal-disabled" -> {
                business.performConnectionRevocation(
                        context, fixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
                business.performConnectionStatusOnlyChange(
                        context,
                        fixture,
                        StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.TERMINAL_DISABLED);
            }
            case "terminal.connection.auth.no-first-frame-timeout" -> {}
            default -> throw new IllegalArgumentException("V2_AUTH_SCENARIO_UNRECOGNIZED");
        }

        Map<String, Object> request;
        if (firstFrameExpected) {
            request = closeExpectedRequest(
                    tds,
                    groupWorkspaceKey,
                    targetTerminalRef,
                    fixture.generation() + "." + secret,
                    deviceId,
                    scenario,
                    markerId,
                    4000,
                    expectedReason);
        } else {
            request = Map.of(
                    "scenario",
                    scenario,
                    "markerId",
                    markerId,
                    "url",
                    tds.websocketBaseUrl() + "/tdp/" + groupWorkspaceKey + "/ws",
                    "expectedClose",
                    Map.of("code", 4000, "reason", expectedReason));
        }

        Path clientLog = wireClientLog(tds, markerId);
        Process node = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            node = startWireClient(request, clientLog, false);
            JsonNode result = awaitWireResult(node, clientLog, Duration.ofSeconds(20), scenario);
            Assertions.assertEquals(scenario, result.path("scenario").asText());
            Assertions.assertEquals("OPEN", result.path("handshake").asText());
            Assertions.assertEquals(4000, result.path("closeCode").asInt());
            Assertions.assertEquals(expectedReason, result.path("closeReason").asText());
            Assertions.assertEquals(List.of(), strings(result.path("eventTypes")));
            Assertions.assertTrue(result.path("sessionId").isNull(), "V-S2_REJECTED_CONNECTION_SESSION_ID_PRESENT");
            Assertions.assertEquals(
                    0L,
                    host.count(
                            "SELECT count(*) FROM terminal_connection.latest_state WHERE terminal_ref=?",
                            targetTerminalRef),
                    "V-S2_REJECTED_CONNECTION_REGISTERED_SESSION");
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-http-fixture-and-raw-node-websocket"),
                    Map.entry("closeCode", 4000),
                    Map.entry("closeReason", expectedReason),
                    Map.entry("eventTypes", strings(result.path("eventTypes"))),
                    Map.entry("sessionRowCount", 0),
                    Map.entry("clientPid", node.pid())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) {
                try {
                    writeContractResult(Map.ofEntries(
                            Map.entry("type", "transport-contract"),
                            Map.entry("operation", scenario),
                            Map.entry("module", "TERMINAL_DATA_SERVER"),
                            Map.entry("contract", "FAIL"),
                            Map.entry("status", "FAIL"),
                            Map.entry("runId", runId),
                            Map.entry("failureCategory", "TDS_VS2_AUTHENTICATION_MATRIX_FAILED"),
                            Map.entry("failureCode", safeFailureCode(failure)),
                            Map.entry("clientStage", safeLatestWireClientStage(clientLog))));
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
            }
            throw failure;
        } finally {
            Process clientToStop = node;
            Throwable cleanupFailure = attemptCleanup(null, () -> stopOwnedClient(clientToStop, clientLog));
            finishCleanup(scenarioFailure, cleanupFailure);
        }
    }

    private static void v2StoreDisabledActiveSession(BackendAcceptanceTest host, TdsAcceptanceProcess tds)
            throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = "terminal.connection.auth.store-disabled-active";
        String markerId = UUID.randomUUID().toString();
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture fixture = business.createConnectionContractFixture(context);
        business.performConnectionStatusOnlyChange(
                context, fixture, StoreTerminalAcceptanceScenarios.ConnectionStatusOnlyChange.STORE_DISABLED);
        SessionProbe probe = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            probe = startSessionProbe(tds, fixture, scenario, markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(15));
            probe.ping(1);
            JsonNode result = probe.finish(Duration.ofSeconds(10));
            Assertions.assertEquals("PASS", result.path("status").asText());
            Assertions.assertEquals(List.of("SESSION_READY", "PONG"), strings(result.path("eventTypes")));
            Assertions.assertEquals(1, result.path("pongCount").asInt());
            awaitAnySessionDisconnectRecord(
                    host, fixture.terminalRef(), result.path("sessionId").asText(), Duration.ofSeconds(20));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("producer", "real-http-store-disable-and-raw-node-websocket"),
                    Map.entry("eventTypes", strings(result.path("eventTypes"))),
                    Map.entry("pongCount", result.path("pongCount").asInt()),
                    Map.entry("sessionId", result.path("sessionId").asText())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) {
                try {
                    writeContractResult(Map.ofEntries(
                            Map.entry("type", "transport-contract"),
                            Map.entry("operation", scenario),
                            Map.entry("module", "TERMINAL_DATA_SERVER"),
                            Map.entry("contract", "FAIL"),
                            Map.entry("status", "FAIL"),
                            Map.entry("runId", runId),
                            Map.entry("failureCategory", "TDS_VS2_STORE_DISABLED_ACTIVE_SESSION_FAILED"),
                            Map.entry("failureCode", safeFailureCode(failure)),
                            Map.entry("clientStage", safeLatestWireClientStage(wireClientLog(tds, markerId)))));
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
            }
            throw failure;
        } finally {
            SessionProbe probeToStop = probe;
            Throwable cleanupFailure = probeToStop == null ? null : attemptCleanup(null, probeToStop::stop);
            finishCleanup(scenarioFailure, cleanupFailure);
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
        Path stderr = wireClientLog(tds, markerId);
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
        int tdsLogOffset = tds.logContents().length();
        Process node = null;
        Throwable scenarioFailure = null;
        try {
            node = startWireClient(closeExpectedRequest(tds, fixture, scenarioId, markerId), clientLog, false);
            requireWireMarker(
                    node,
                    clientLog,
                    "TERMINAL_WIRE_SESSION_READY markerId=" + markerId,
                    Duration.ofSeconds(10),
                    "SESSION_READY",
                    tds,
                    tdsLogOffset);
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
        int targetTdsLogOffset = tds.logContents().length();
        Process target = null;
        SessionProbe controlProbe = null;
        TdsRegistrationGateBroker.ArmedAttempt recoveryGate = null;
        String attemptId = null;
        Throwable scenarioFailure = null;
        try {
            target =
                    startWireClient(closeExpectedRequest(tds, revoked, targetScenario, targetMarker), targetLog, false);
            requireWireMarker(
                    target,
                    targetLog,
                    "TERMINAL_WIRE_SESSION_READY markerId=" + targetMarker,
                    Duration.ofSeconds(10),
                    "SESSION_READY",
                    tds,
                    targetTdsLogOffset);
            controlProbe = startSessionProbe(
                    tds,
                    control,
                    "terminal.connection.vs10.status-only-probe",
                    controlMarker,
                    wireClientLog(tds, controlMarker));
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

    static Stream<DynamicTest> crossNodeRecoveryScenarios(BackendAcceptanceTest host, TdsAcceptanceProcess nodeA) {
        String scenario = TdsAcceptanceProcess.TdsStartConfiguration.VS13_CROSS_NODE_RECOVERY_SCENARIO_ID;
        return Stream.of(DynamicTest.dynamicTest(scenario, () -> crossNodeRecovery(host, nodeA)));
    }

    private static void crossNodeRecovery(BackendAcceptanceTest host, TdsAcceptanceProcess nodeA) throws Exception {
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String scenario = TdsAcceptanceProcess.TdsStartConfiguration.VS13_CROSS_NODE_RECOVERY_SCENARIO_ID;
        Assertions.assertEquals(TdsAcceptanceProcess.TdsStartConfiguration.VS13_NODE_A_ID, nodeA.nodeId());
        BackendAcceptanceTest.ScenarioContext context = host.new ScenarioContext(null, "performance.normal-path");
        StoreTerminalAcceptanceScenarios business = new StoreTerminalAcceptanceScenarios(host);
        StoreTerminalAcceptanceScenarios.ConnectionFixture targetFixture =
                business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture controlFixture =
                business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture registrationRaceFixture =
                business.createConnectionContractFixture(context);
        StoreTerminalAcceptanceScenarios.ConnectionFixture onlineTakeoverFixture =
                business.createConnectionContractFixture(context);
        TdsAcceptanceProcess nodeB = null;
        SessionProbe registrationCandidateA = null;
        SessionProbe registrationCurrentB = null;
        SessionProbe onlineOldA = null;
        SessionProbe onlineCurrentB = null;
        SessionProbe oldOnA = null;
        SessionProbe currentOnB = null;
        SessionProbe controlOnB = null;
        SessionProbe forcedNodeSessionOnA = null;
        SessionProbe reconnectedSessionOnB = null;
        SessionProbe failedAuthentication = null;
        TdsRegistrationGateBroker.ArmedAttempt postgresOpenGate = null;
        String postgresOpenAttemptId = null;
        TdsRegistrationGateBroker.ArmedAttempt recoveryGate = null;
        String attemptId = null;
        int oldListenerBackendPid = -1;
        String registrationCandidateSessionId = null;
        String registrationWinningSessionId = null;
        long registrationCandidateSequence = -1;
        long registrationWinningSequence = -1;
        String onlineTakeoverOldSessionId = null;
        String onlineTakeoverCurrentSessionId = null;
        Throwable scenarioFailure = null;
        boolean resultWritten = false;
        try {
            nodeB = host.startAdditionalTds("node-b", TdsAcceptanceProcess.TdsStartConfiguration.VS13_NODE_B_ID);
            Assertions.assertNotEquals(
                    nodeA.websocketBaseUrl(), nodeB.websocketBaseUrl(), "V-S13_TDS_NODE_PORTS_NOT_DISTINCT");
            Assertions.assertNotEquals(nodeA.nodeId(), nodeB.nodeId(), "V-S13_TDS_NODE_IDS_NOT_DISTINCT");

            String registrationCandidateMarker = UUID.randomUUID().toString();
            postgresOpenGate = nodeA.registrationGateBroker().armNextPostgresOpen(Duration.ofSeconds(25));
            registrationCandidateA = startDeferredAuthenticationProbe(
                    nodeA, registrationRaceFixture, scenario, registrationCandidateMarker, false, "SESSION_REPLACED");
            registrationCandidateA.awaitOpen(Duration.ofSeconds(10));
            registrationCandidateA.sendAuthentication();
            postgresOpenAttemptId = awaitRegistrationGateObservation(
                    postgresOpenGate,
                    Duration.ofSeconds(15),
                    registrationCandidateA.node,
                    registrationCandidateA.log,
                    nodeA);
            Map<String, Object> candidateOpenState = latestState(host, registrationRaceFixture.terminalRef());
            Assertions.assertEquals(nodeA.nodeId(), candidateOpenState.get("node_id"));
            registrationCandidateSessionId = (String) candidateOpenState.get("session_id");
            registrationCandidateSequence = ((Number) candidateOpenState.get("session_sequence")).longValue();
            Assertions.assertNotNull(registrationCandidateSessionId, "V-S13_PG_OPEN_CANDIDATE_MISSING");

            String registrationWinnerMarker = UUID.randomUUID().toString();
            registrationCurrentB = startSessionProbe(
                    nodeB,
                    registrationRaceFixture,
                    scenario,
                    registrationWinnerMarker,
                    wireClientLog(nodeA, registrationWinnerMarker));
            registrationCurrentB.awaitReady(Duration.ofSeconds(15));
            Map<String, Object> registrationWinnerState = latestState(host, registrationRaceFixture.terminalRef());
            Assertions.assertEquals(nodeB.nodeId(), registrationWinnerState.get("node_id"));
            registrationWinningSessionId = registrationCurrentB.sessionId();
            registrationWinningSequence = ((Number) registrationWinnerState.get("session_sequence")).longValue();
            Assertions.assertEquals(registrationWinningSessionId, registrationWinnerState.get("session_id"));
            Assertions.assertTrue(
                    registrationWinningSequence > registrationCandidateSequence,
                    "V-S13_PG_OPEN_WINNER_SEQUENCE_NOT_NEWER");
            awaitTdsLogContains(
                    nodeA,
                    "event=tds_session_open_notification_reconciled terminalRef="
                            + registrationRaceFixture.terminalRef()
                            + " trackedBindings=1 latestSequence=" + registrationWinningSequence,
                    Duration.ofSeconds(20),
                    "V-S13_A_DID_NOT_APPLY_B_SEQUENCE_BEFORE_CANDIDATE_RELEASE");

            postgresOpenGate.release(postgresOpenAttemptId);
            postgresOpenGate = null;
            JsonNode rejectedCandidate =
                    registrationCandidateA.awaitAuthenticationClose("SESSION_REPLACED", Duration.ofSeconds(20));
            Assertions.assertTrue(rejectedCandidate.path("sessionId").isNull());
            Assertions.assertEquals(List.of(), strings(rejectedCandidate.path("eventTypes")));
            registrationCandidateA = null;
            registrationCurrentB.ping(1);
            Assertions.assertEquals(
                    registrationWinningSessionId,
                    latestState(host, registrationRaceFixture.terminalRef()).get("session_id"));
            registrationCurrentB.finish(Duration.ofSeconds(10));
            registrationCurrentB = null;

            String onlineOldMarker = UUID.randomUUID().toString();
            onlineOldA = startSessionProbe(
                    nodeA, onlineTakeoverFixture, scenario, onlineOldMarker, wireClientLog(nodeA, onlineOldMarker));
            onlineOldA.awaitReady(Duration.ofSeconds(15));
            onlineOldA.ping(1);
            onlineTakeoverOldSessionId = onlineOldA.sessionId();
            String onlineCurrentMarker = UUID.randomUUID().toString();
            onlineCurrentB = startSessionProbe(
                    nodeB,
                    onlineTakeoverFixture,
                    scenario,
                    onlineCurrentMarker,
                    wireClientLog(nodeA, onlineCurrentMarker));
            onlineCurrentB.awaitReady(Duration.ofSeconds(15));
            onlineTakeoverCurrentSessionId = onlineCurrentB.sessionId();
            JsonNode onlineReplaced = onlineOldA.awaitClose(4000, "SESSION_REPLACED", Duration.ofSeconds(20));
            Assertions.assertEquals(
                    onlineTakeoverOldSessionId, onlineReplaced.path("sessionId").asText());
            onlineOldA = null;
            Map<String, Object> onlineLatest = latestState(host, onlineTakeoverFixture.terminalRef());
            Assertions.assertEquals(nodeB.nodeId(), onlineLatest.get("node_id"));
            Assertions.assertEquals(onlineTakeoverCurrentSessionId, onlineLatest.get("session_id"));
            onlineCurrentB.ping(1);
            onlineCurrentB.finish(Duration.ofSeconds(10));
            onlineCurrentB = null;

            String oldMarker = UUID.randomUUID().toString();
            oldOnA = startSessionProbe(nodeA, targetFixture, scenario, oldMarker, wireClientLog(nodeA, oldMarker));
            oldOnA.awaitReady(Duration.ofSeconds(15));
            oldOnA.ping(1);
            String oldSessionId = oldOnA.sessionId();
            long oldSequence =
                    ((Number) latestState(host, targetFixture.terminalRef()).get("session_sequence")).longValue();

            String controlMarker = UUID.randomUUID().toString();
            controlOnB = startSessionProbe(
                    nodeB, controlFixture, scenario, controlMarker, wireClientLog(nodeA, controlMarker));
            controlOnB.awaitReady(Duration.ofSeconds(15));
            controlOnB.ping(1);

            oldListenerBackendPid = nodeA.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = nodeA.registrationGateBroker().armNextListenerRecovery();
            Assertions.assertTrue(
                    host.terminatePostgresBackend(oldListenerBackendPid),
                    "V-S13_EXACT_NODE_A_LISTENER_TERMINATION_FAILED");
            attemptId = awaitRegistrationGateObservation(
                    recoveryGate, Duration.ofSeconds(8), oldOnA.node, wireClientLog(nodeA, oldMarker), nodeA);
            nodeA.awaitListenerDisconnected(oldListenerBackendPid, Duration.ofSeconds(3));

            String newMarker = UUID.randomUUID().toString();
            currentOnB = startSessionProbe(nodeB, targetFixture, scenario, newMarker, wireClientLog(nodeA, newMarker));
            currentOnB.awaitReady(Duration.ofSeconds(15));
            String newSessionId = currentOnB.sessionId();
            Map<String, Object> afterNodeBOpen = latestState(host, targetFixture.terminalRef());
            Assertions.assertEquals(nodeB.nodeId(), afterNodeBOpen.get("node_id"), "V-S13_NODE_B_NOT_LATEST");
            Assertions.assertEquals(newSessionId, afterNodeBOpen.get("session_id"), "V-S13_NODE_B_SESSION_NOT_LATEST");
            Assertions.assertTrue(
                    ((Number) afterNodeBOpen.get("session_sequence")).longValue() > oldSequence,
                    "V-S13_NODE_B_SEQUENCE_NOT_NEWER");
            Assertions.assertNull(afterNodeBOpen.get("disconnected_at_epoch_millis"));

            recoveryGate.release(attemptId);
            recoveryGate = null;
            int recoveredListenerBackendPid =
                    nodeA.awaitListenerReadyAfter(oldListenerBackendPid, Duration.ofSeconds(30));
            JsonNode replaced = oldOnA.awaitClose(4000, "SESSION_REPLACED", Duration.ofSeconds(20));
            Assertions.assertEquals(oldSessionId, replaced.path("sessionId").asText());
            oldOnA = null;
            Map<String, Object> afterOldClose = latestState(host, targetFixture.terminalRef());
            Assertions.assertEquals(newSessionId, afterOldClose.get("session_id"));
            Assertions.assertEquals(nodeB.nodeId(), afterOldClose.get("node_id"));
            Assertions.assertNull(
                    afterOldClose.get("disconnected_at_epoch_millis"),
                    "V-S6_STALE_NODE_A_DISCONNECT_OVERWROTE_NODE_B_SESSION");

            String failedMarker = UUID.randomUUID().toString();
            failedAuthentication = startDeferredAuthenticationProbe(
                    nodeB, targetFixture, scenario, failedMarker, true, "CREDENTIAL_INVALID");
            failedAuthentication.awaitOpen(Duration.ofSeconds(10));
            JsonNode failed =
                    failedAuthentication.authenticateExpectingClose("CREDENTIAL_INVALID", Duration.ofSeconds(15));
            failedAuthentication = null;
            currentOnB.ping(2);
            Assertions.assertEquals(
                    newSessionId, latestState(host, targetFixture.terminalRef()).get("session_id"));

            business.performConnectionRevocation(
                    context, targetFixture, StoreTerminalAcceptanceScenarios.ConnectionRevocationAction.DEVICE_CANCEL);
            JsonNode cancelled = currentOnB.awaitClose(4000, "ACTIVATION_CANCELLED", Duration.ofSeconds(20));
            Assertions.assertEquals(newSessionId, cancelled.path("sessionId").asText());
            currentOnB = null;
            awaitSessionDisconnectRecord(
                    host, targetFixture.terminalRef(), newSessionId, "ACTIVATION_CANCELLED", Duration.ofSeconds(15));
            Map<String, Object> afterCancellation = latestState(host, targetFixture.terminalRef());
            Assertions.assertEquals(newSessionId, afterCancellation.get("session_id"));
            Assertions.assertEquals("ACTIVATION_CANCELLED", afterCancellation.get("close_reason"));
            Assertions.assertNotNull(afterCancellation.get("disconnected_at_epoch_millis"));

            DorisSessionHistory oldHistory =
                    awaitDorisSessionHistory(host, targetFixture.terminalRef(), oldSessionId, "SESSION_REPLACED", 1);
            DorisSessionHistory currentHistory = awaitDorisSessionHistory(
                    host, targetFixture.terminalRef(), newSessionId, "ACTIVATION_CANCELLED", 1);

            controlOnB.ping(2);
            JsonNode controlResult = controlOnB.finish(Duration.ofSeconds(10));
            controlOnB = null;
            Assertions.assertEquals(2, controlResult.path("pongCount").asInt());

            StoreTerminalAcceptanceScenarios.ConnectionFixture forcedNodeFixture =
                    business.createConnectionContractFixture(context);
            String forcedNodeMarker = UUID.randomUUID().toString();
            forcedNodeSessionOnA = startSessionProbe(
                    nodeA, forcedNodeFixture, scenario, forcedNodeMarker, wireClientLog(nodeA, forcedNodeMarker));
            forcedNodeSessionOnA.awaitReady(Duration.ofSeconds(15));
            forcedNodeSessionOnA.ping(1);
            String forcedOldSessionId = forcedNodeSessionOnA.sessionId();
            Map<String, Object> beforeForcedTermination = latestState(host, forcedNodeFixture.terminalRef());
            long forcedOldSequence = ((Number) beforeForcedTermination.get("session_sequence")).longValue();
            Assertions.assertEquals(nodeA.nodeId(), beforeForcedTermination.get("node_id"));
            Assertions.assertEquals(forcedOldSessionId, beforeForcedTermination.get("session_id"));

            nodeA.forceTerminateForAcceptanceScenario();
            Assertions.assertFalse(nodeA.processAlive(), "V-S6_NODE_A_STILL_RUNNING_AFTER_FORCED_TERMINATION");
            Map<String, Object> afterForcedTermination = latestState(host, forcedNodeFixture.terminalRef());
            Assertions.assertEquals(forcedOldSessionId, afterForcedTermination.get("session_id"));
            Assertions.assertNull(
                    afterForcedTermination.get("disconnected_at_epoch_millis"),
                    "V-S6_FORCED_NODE_TERMINATION_UNEXPECTEDLY_WROTE_DISCONNECT");
            forcedNodeSessionOnA.stop();
            forcedNodeSessionOnA = null;

            String reconnectedMarker = UUID.randomUUID().toString();
            reconnectedSessionOnB = startSessionProbe(
                    nodeB, forcedNodeFixture, scenario, reconnectedMarker, wireClientLog(nodeB, reconnectedMarker));
            reconnectedSessionOnB.awaitReady(Duration.ofSeconds(15));
            String reconnectedSessionId = reconnectedSessionOnB.sessionId();
            Map<String, Object> afterReconnect = latestState(host, forcedNodeFixture.terminalRef());
            Assertions.assertEquals(nodeB.nodeId(), afterReconnect.get("node_id"), "V-S6_RECONNECT_NODE_NOT_LATEST");
            Assertions.assertEquals(
                    reconnectedSessionId, afterReconnect.get("session_id"), "V-S6_RECONNECT_SESSION_NOT_LATEST");
            Assertions.assertTrue(
                    ((Number) afterReconnect.get("session_sequence")).longValue() > forcedOldSequence,
                    "V-S6_RECONNECT_SEQUENCE_NOT_NEWER");
            Assertions.assertNull(
                    afterReconnect.get("disconnected_at_epoch_millis"),
                    "V-S6_RECONNECTED_SESSION_PREMATURELY_DISCONNECTED");
            reconnectedSessionOnB.ping(1);
            Map<String, Object> afterReconnectPong = latestState(host, forcedNodeFixture.terminalRef());
            Assertions.assertEquals(reconnectedSessionId, afterReconnectPong.get("session_id"));
            Assertions.assertEquals(nodeB.nodeId(), afterReconnectPong.get("node_id"));
            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", "terminal.connection.latest-state-stale-write"),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("forcedNodePid", nodeA.pid()),
                    Map.entry("forcedNodeStartTicks", nodeA.startTicks()),
                    Map.entry("oldNodeId", nodeA.nodeId()),
                    Map.entry("oldSessionId", forcedOldSessionId),
                    Map.entry("oldSequence", forcedOldSequence),
                    Map.entry("disconnectWrittenBeforeReconnect", false),
                    Map.entry("reconnectedNodeId", nodeB.nodeId()),
                    Map.entry("reconnectedSessionId", reconnectedSessionId),
                    Map.entry("reconnectedSequence", afterReconnect.get("session_sequence")),
                    Map.entry("latestStateAfterReconnectPong", "NEW_NODE_B_SESSION")));
            JsonNode reconnectedClose = reconnectedSessionOnB.finish(Duration.ofSeconds(10));
            Assertions.assertEquals(
                    reconnectedSessionId, reconnectedClose.path("sessionId").asText());
            reconnectedSessionOnB = null;

            writeContractResult(Map.ofEntries(
                    Map.entry("type", "transport-contract"),
                    Map.entry("operation", scenario),
                    Map.entry("module", "TERMINAL_DATA_SERVER"),
                    Map.entry("contract", "PASS"),
                    Map.entry("status", "PASS"),
                    Map.entry("runId", runId),
                    Map.entry("nodeA", nodeA.nodeId()),
                    Map.entry("nodeB", nodeB.nodeId()),
                    Map.entry(
                            "nodeAProcessEvidence",
                            nodeA.directory().resolve("process-evidence.json").toString()),
                    Map.entry(
                            "nodeBProcessEvidence",
                            nodeB.directory().resolve("process-evidence.json").toString()),
                    Map.entry("listenerDisconnectedBackendPid", oldListenerBackendPid),
                    Map.entry("listenerRecoveredBackendPid", recoveredListenerBackendPid),
                    Map.entry("listenerRecoveryGateAttemptId", attemptId),
                    Map.entry("registrationRaceGateAttemptId", postgresOpenAttemptId),
                    Map.entry("registrationRaceCandidateSessionId", registrationCandidateSessionId),
                    Map.entry("registrationRaceCandidateSequence", registrationCandidateSequence),
                    Map.entry("registrationRaceWinnerSessionId", registrationWinningSessionId),
                    Map.entry("registrationRaceWinnerSequence", registrationWinningSequence),
                    Map.entry(
                            "registrationRaceCandidateCloseReason",
                            rejectedCandidate.path("closeReason").asText()),
                    Map.entry("onlineTakeoverOldSessionId", onlineTakeoverOldSessionId),
                    Map.entry("onlineTakeoverCurrentSessionId", onlineTakeoverCurrentSessionId),
                    Map.entry("nodeAReplacedSessionId", oldSessionId),
                    Map.entry("nodeBCurrentSessionId", newSessionId),
                    Map.entry("nodeBSequence", afterNodeBOpen.get("session_sequence")),
                    Map.entry("nodeACloseReason", replaced.path("closeReason").asText()),
                    Map.entry(
                            "failedAuthenticationReason",
                            failed.path("closeReason").asText()),
                    Map.entry("realHttpAction", "DEVICE_CANCEL"),
                    Map.entry("nodeBCloseReason", cancelled.path("closeReason").asText()),
                    Map.entry(
                            "controlSessionPongs",
                            controlResult.path("pongCount").asInt()),
                    Map.entry("nodeAHistoryConnectedRows", oldHistory.connected()),
                    Map.entry("nodeAHistoryHeartbeatRows", oldHistory.heartbeats()),
                    Map.entry("nodeAHistorySessionReplacedRows", oldHistory.disconnected()),
                    Map.entry("nodeBHistoryConnectedRows", currentHistory.connected()),
                    Map.entry("nodeBHistoryHeartbeatRows", currentHistory.heartbeats()),
                    Map.entry("nodeBHistoryActivationCancelledRows", currentHistory.disconnected())));
            resultWritten = true;
        } catch (Exception | Error failure) {
            scenarioFailure = failure;
            if (!resultWritten) writeScenarioFailure(runId, scenario, "TDS_VS13_CROSS_NODE_RECOVERY_FAILED", failure);
            throw failure;
        } finally {
            Throwable cleanupFailure = null;
            TdsRegistrationGateBroker.ArmedAttempt postgresOpenGateToRelease = postgresOpenGate;
            String postgresOpenAttemptToRelease = postgresOpenAttemptId;
            if (postgresOpenGateToRelease != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, () -> {
                    if (postgresOpenAttemptToRelease == null) {
                        nodeA.registrationGateBroker().cancel(postgresOpenGateToRelease);
                    } else {
                        postgresOpenGateToRelease.release(postgresOpenAttemptToRelease);
                    }
                });
            }
            TdsRegistrationGateBroker.ArmedAttempt gateToRelease = recoveryGate;
            String attemptToRelease = attemptId;
            if (gateToRelease != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, () -> {
                    if (attemptToRelease == null) nodeA.registrationGateBroker().cancel(gateToRelease);
                    else gateToRelease.release(attemptToRelease);
                });
            }
            SessionProbe failedToStop = failedAuthentication;
            if (failedToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, failedToStop::stop);
            SessionProbe registrationCandidateToStop = registrationCandidateA;
            if (registrationCandidateToStop != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, registrationCandidateToStop::stop);
            }
            SessionProbe registrationCurrentToStop = registrationCurrentB;
            if (registrationCurrentToStop != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, registrationCurrentToStop::stop);
            }
            SessionProbe onlineOldToStop = onlineOldA;
            if (onlineOldToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, onlineOldToStop::stop);
            SessionProbe onlineCurrentToStop = onlineCurrentB;
            if (onlineCurrentToStop != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, onlineCurrentToStop::stop);
            }
            SessionProbe currentToStop = currentOnB;
            if (currentToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, currentToStop::stop);
            SessionProbe controlToStop = controlOnB;
            if (controlToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, controlToStop::stop);
            SessionProbe forcedNodeToStop = forcedNodeSessionOnA;
            if (forcedNodeToStop != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, forcedNodeToStop::stop);
            }
            SessionProbe reconnectedToStop = reconnectedSessionOnB;
            if (reconnectedToStop != null) {
                cleanupFailure = attemptCleanup(cleanupFailure, reconnectedToStop::stop);
            }
            SessionProbe oldToStop = oldOnA;
            if (oldToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, oldToStop::stop);
            TdsAcceptanceProcess nodeBToStop = nodeB;
            if (nodeBToStop != null) cleanupFailure = attemptCleanup(cleanupFailure, nodeBToStop::close);
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
        int oldBackendPid = -1;
        boolean listenerRecoveryRequired = false;
        Throwable scenarioFailure = null;
        try {
            probe = startSessionProbe(
                    tds, fixture, "terminal.connection.vs10.status-only-probe", markerId, wireClientLog(tds, markerId));
            probe.awaitReady(Duration.ofSeconds(10));
            probe.ping(1);
            oldBackendPid = tds.awaitListenerBackendPid(Duration.ofSeconds(5));
            recoveryGate = tds.registrationGateBroker().armNextListenerRecovery();
            Assertions.assertTrue(
                    host.terminatePostgresBackend(oldBackendPid), "V-S10_EXACT_LISTENER_TERMINATION_FAILED");
            attemptId = awaitRegistrationGateObservation(
                    recoveryGate, Duration.ofSeconds(8), probe.node, wireClientLog(tds, markerId), tds);
            tds.awaitListenerDisconnected(oldBackendPid, Duration.ofSeconds(3));
            listenerRecoveryRequired = true;
            business.performConnectionStatusOnlyChange(context, fixture, change);
            Assertions.assertFalse(
                    tds.logContents()
                            .contains("event=tds_binding_revocation_applied terminalRef=" + fixture.terminalRef()),
                    "V-S10_STATUS_ONLY_MUST_NOT_EMIT_BINDING_REVOCATION");
            recoveryGate.release(attemptId);
            recoveryGate = null;
            int newBackendPid = tds.awaitListenerReadyAfter(oldBackendPid, Duration.ofSeconds(30));
            listenerRecoveryRequired = false;
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
            int previousListenerPid = oldBackendPid;
            if (listenerRecoveryRequired && previousListenerPid > 0) {
                cleanupFailure = attemptCleanup(
                        cleanupFailure, () -> tds.awaitListenerReadyAfter(previousListenerPid, Duration.ofSeconds(30)));
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
        int oldTdsLogOffset = tds.logContents().length();
        Process oldClient = null;
        SessionProbe newSession = null;
        TdsRegistrationGateBroker.ArmedAttempt revocationGate = null;
        String attemptId = null;
        Throwable scenarioFailure = null;
        try {
            oldClient = startWireClient(
                    closeExpectedRequest(tds, oldBinding, oldSessionScenario, oldMarker, 4000, "ACTIVATION_CANCELLED"),
                    wireClientLog(tds, oldMarker),
                    false);
            requireWireMarker(
                    oldClient,
                    wireClientLog(tds, oldMarker),
                    "TERMINAL_WIRE_SESSION_READY markerId=" + oldMarker,
                    Duration.ofSeconds(10),
                    "SESSION_READY",
                    tds,
                    oldTdsLogOffset);
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
                    "ACTIVATION_CANCELLED", replaced.path("closeReason").asText());
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
        String markerId = UUID.randomUUID().toString();
        request.put("markerId", markerId);
        if (testCase.expectedClose() != null) request.put("expectedClose", testCase.expectedClose());

        int tdsLogOffset = tds.logContents().length();
        JsonNode result;
        boolean resultWritten = false;
        try {
            result = runWireClient(tds, request);
            Assertions.assertEquals("PASS", result.path("status").asText(), "TERMINAL_WIRE_CLIENT_CONTRACT_FAILED");
            Assertions.assertEquals(testCase.scenario(), result.path("scenario").asText());
            Assertions.assertEquals("OPEN", result.path("handshake").asText());
            if (testCase.scenario().contains("compression.offer-")) {
                assertNegotiatedExtension(
                        testCase.scenario(), result.path("extensionResponse").asText(null));
            } else if (testCase.scenario().contains("compression.session-")) {
                Assertions.assertEquals(List.of("SESSION_READY", "PONG"), strings(result.path("eventTypes")));
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
        } catch (Exception | Error failure) {
            if (!resultWritten) {
                try {
                    writeScenarioFailure(runId, testCase.scenario(), "TDS_VS14_WIRE_CONTRACT_FAILED", failure);
                } catch (Exception | Error reportFailure) {
                    failure.addSuppressed(reportFailure);
                }
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
        return closeExpectedRequest(
                tds,
                fixture.fixture().groupWorkspaceKey(),
                fixture.terminalRef(),
                fixture.generation() + "." + fixture.credentialSecret(),
                fixture.deviceId(),
                scenario,
                markerId,
                closeCode,
                closeReason);
    }

    private static Map<String, Object> closeExpectedRequest(
            TdsAcceptanceProcess tds,
            String groupWorkspaceKey,
            UUID terminalRef,
            String terminalCredential,
            String deviceId,
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
                tds.websocketBaseUrl() + "/tdp/" + groupWorkspaceKey + "/ws",
                "authenticate",
                Map.of(
                        "type",
                        "AUTHENTICATE",
                        "terminalRef",
                        terminalRef.toString(),
                        "terminalCredential",
                        terminalCredential,
                        "deviceId",
                        deviceId,
                        "appVersion",
                        "backend-acceptance"),
                "expectedClose",
                Map.of("code", closeCode, "reason", closeReason));
    }

    private static String newCredentialSecret() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        java.util.Arrays.fill(bytes, (byte) 0);
        return secret;
    }

    private static Path wireClientLog(TdsAcceptanceProcess tds, String markerId) {
        return tds.directory().resolve("terminal-wire-" + markerId + ".log");
    }

    private static String requiredWireClientMarkerId(Map<String, Object> request) {
        Object marker = request.get("markerId");
        if (!(marker instanceof String markerId) || !isCanonicalWireMarker(markerId)) {
            throw new IllegalArgumentException("TERMINAL_WIRE_CLIENT_MARKER_ID_REQUIRED");
        }
        return markerId;
    }

    private static boolean isCanonicalWireMarker(String markerId) {
        try {
            return UUID.fromString(markerId).toString().equals(markerId);
        } catch (IllegalArgumentException invalidMarker) {
            return false;
        }
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
                    "event=tds_session_postgres_open_committed_before_local_register",
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
        if (SESSION_PROBE_PING_COMMAND.matcher(command).matches()) return "PING";
        if (SESSION_PROBE_PING_BURST_COMMAND.matcher(command).matches()) return "PING_BURST";
        if (command.equals("CLOSE")) return "CLOSE";
        if (command.matches("AWAIT_CLOSE\\t[1-9][0-9]{2,3}\\t[A-Z_]{1,48}")) return "AWAIT_CLOSE";
        return "INVALID";
    }

    private static String probeCommandSequence(String command) {
        Matcher matcher = SESSION_PROBE_PING_COMMAND.matcher(command);
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
        String requestMarkerId = requiredWireClientMarkerId(request);
        if (!stderr.getFileName().toString().equals("terminal-wire-" + requestMarkerId + ".log")) {
            throw new IllegalArgumentException("TERMINAL_WIRE_CLIENT_LOG_MARKER_MISMATCH");
        }
        Path script = terminalWireClientScript();
        Process node = new ProcessBuilder(requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY"), script.toString())
                .directory(Path.of(System.getProperty("user.dir")).toFile())
                .redirectError(ProcessBuilder.Redirect.appendTo(stderr.toFile()))
                .start();
        try {
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
        } catch (Exception | Error setupFailure) {
            try {
                stopOwnedClient(node, stderr);
            } catch (Exception | Error cleanupFailure) {
                setupFailure.addSuppressed(cleanupFailure);
            }
            throw setupFailure;
        }
    }

    private static void requireWireMarker(
            Process wireClient,
            Path log,
            String marker,
            Duration timeout,
            String stage,
            TdsAcceptanceProcess tds,
            int tdsLogOffset)
            throws Exception {
        if (awaitWireMarkerOrClientExit(wireClient, log, marker, timeout)) return;
        String clientState = wireClient.isAlive() ? "alive" : wireClientExitSummary(wireClient);
        throw new IllegalStateException("TERMINAL_WIRE_CLIENT_MARKER_UNAVAILABLE stage=" + stage
                + " client=" + clientState
                + " lastStage=" + safeWireClientLastKnownStage(log)
                + " signalDiagnostic=" + safeWireSignalDiagnostic(log)
                + " tdsAuthenticationTrace=" + safeTdsAuthenticationTrace(tds, tdsLogOffset));
    }

    private static boolean awaitWireMarkerOrClientExit(Process wireClient, Path log, String marker, Duration timeout)
            throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            boolean markerFound = Files.isRegularFile(log)
                    && Files.readString(log, StandardCharsets.UTF_8).contains(marker);
            if (markerFound) return wireClient.isAlive();
            if (!wireClient.isAlive()) return false;
            TimeUnit.MILLISECONDS.sleep(25);
        }
        return wireClient.isAlive()
                && Files.isRegularFile(log)
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
        Assertions.assertFalse(output.contains("\n"), "TERMINAL_WIRE_CLIENT_OUTPUT_CARDINALITY_INVALID");
        Assertions.assertNotNull(result, "TERMINAL_WIRE_CLIENT_OUTPUT_JSON_INVALID");
        Assertions.assertEquals(
                0,
                node.exitValue(),
                "TERMINAL_WIRE_CLIENT_EXIT_NONZERO failureCategory="
                        + result.path("failureCategory").asText("NONE"));
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
        awaitSessionDisconnectRecord(host, terminalRef, sessionId, "ACTIVATION_CANCELLED", timeout);
    }

    private static void awaitSessionDisconnectRecord(
            BackendAcceptanceTest host, UUID terminalRef, String sessionId, String closeReason, Duration timeout)
            throws Exception {
        Assertions.assertFalse(sessionId == null || sessionId.isBlank(), "V-S10_SESSION_ID_MISSING");
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            long matches = host.count(
                    "SELECT count(*) FROM terminal_connection.latest_state "
                            + "WHERE terminal_ref=? AND session_id=? AND disconnected_at_epoch_millis IS NOT NULL "
                            + "AND close_reason=?",
                    terminalRef,
                    sessionId,
                    closeReason);
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

    private static SessionProbe startAdmissionProbe(
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            String markerId,
            String expectedCredentialFailure)
            throws Exception {
        return startDeferredAuthenticationProbe(
                tds,
                fixture,
                "terminal.connection.vs1.admission-hold",
                markerId,
                expectedCredentialFailure != null,
                expectedCredentialFailure);
    }

    private static SessionProbe startDeferredAuthenticationProbe(
            TdsAcceptanceProcess tds,
            StoreTerminalAcceptanceScenarios.ConnectionFixture fixture,
            String scenario,
            String markerId,
            boolean invalidCredential,
            String expectedCloseReason)
            throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("scenario", scenario);
        request.put("markerId", markerId);
        request.put("url", tds.websocketBaseUrl() + "/tdp/" + fixture.fixture().groupWorkspaceKey() + "/ws");
        request.put("deferAuthentication", true);
        request.put(
                "authenticate",
                Map.of(
                        "type",
                        "AUTHENTICATE",
                        "terminalRef",
                        fixture.terminalRef().toString(),
                        "terminalCredential",
                        fixture.generation() + "."
                                + (invalidCredential ? newCredentialSecret() : fixture.credentialSecret()),
                        "deviceId",
                        fixture.deviceId(),
                        "appVersion",
                        "backend-acceptance"));
        if (expectedCloseReason != null) {
            request.put("expectedClose", Map.of("code", 4000, "reason", expectedCloseReason));
        }
        Path log = wireClientLog(tds, markerId);
        Process node = startWireClient(request, log, true);
        return new SessionProbe(node, log, markerId);
    }

    private static final class SessionProbe {
        private final Process node;
        private final Path log;
        private final String markerId;
        private final OutputStream input;
        private final Set<Double> sentRtts = new HashSet<>();
        private int pongCount;
        private int pendingPingSequence = -1;
        private String commandStage = "STARTING";
        private long previousPingStartedNanos;
        private long maximumPingGapMillis;

        private SessionProbe(Process node, Path log, String markerId) {
            this.node = node;
            this.log = log;
            this.markerId = markerId;
            this.input = node.getOutputStream();
        }

        void awaitReady(Duration timeout) throws Exception {
            awaitMarkerOrClientExit(
                    "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " sessionId=",
                    timeout,
                    "SESSION_READY_MARKER");
            commandStage = "READY";
        }

        void awaitOpen(Duration timeout) throws Exception {
            awaitMarkerOrClientExit("TERMINAL_WIRE_OPEN markerId=" + markerId, timeout, "OPEN_MARKER");
            Assertions.assertTrue(node.isAlive(), "TERMINAL_WIRE_ADMISSION_CLIENT_EXITED_WHILE_HELD");
            commandStage = "WEBSOCKET_OPEN_UNAUTHENTICATED";
        }

        private void awaitMarkerOrClientExit(String marker, Duration timeout, String stage) throws Exception {
            if (awaitWireMarkerOrClientExit(node, log, marker, timeout)) return;
            if (!node.isAlive()) {
                JsonNode result = awaitProbeResult(Duration.ofSeconds(2), stage + "_CLIENT_EXITED");
                throw new IllegalStateException("TERMINAL_WIRE_CLIENT_EXITED_BEFORE_MARKER status="
                        + result.path("status").asText("UNKNOWN"));
            }
            throw new IllegalStateException("TERMINAL_WIRE_CLIENT_MARKER_DEADLINE_EXCEEDED stage=" + stage);
        }

        void authenticate(Duration timeout) throws Exception {
            JsonNode exited = sendControlCommand("AUTHENTICATE", "AUTHENTICATE", false);
            Assertions.assertNull(exited, "TERMINAL_WIRE_ADMISSION_CLIENT_EXITED_BEFORE_AUTHENTICATE");
            awaitReady(timeout);
        }

        JsonNode authenticateExpectingClose(String reason, Duration timeout) throws Exception {
            JsonNode result = sendControlCommand("AUTHENTICATE_EXPECTED_CLOSE", "AUTHENTICATE", true);
            if (result == null) result = awaitProbeResult(timeout, "AUTHENTICATE_EXPECTED_CLOSE_RESULT");
            Assertions.assertEquals(4000, result.path("closeCode").asInt());
            Assertions.assertEquals(reason, result.path("closeReason").asText());
            Assertions.assertTrue(result.path("sessionId").isNull());
            return result;
        }

        void sendAuthentication() throws Exception {
            JsonNode exited = sendControlCommand("AUTHENTICATE", "AUTHENTICATE", true);
            Assertions.assertNull(exited, "V-S13_CANDIDATE_CLIENT_EXITED_BEFORE_AUTHENTICATION");
        }

        JsonNode awaitAuthenticationClose(String reason, Duration timeout) throws Exception {
            JsonNode result = awaitProbeResult(timeout, "AUTHENTICATION_CLOSE_RESULT");
            Assertions.assertEquals(4000, result.path("closeCode").asInt());
            Assertions.assertEquals(reason, result.path("closeReason").asText());
            Assertions.assertTrue(result.path("sessionId").isNull());
            Assertions.assertEquals(List.of(), strings(result.path("eventTypes")));
            return result;
        }

        JsonNode awaitUnauthenticatedClose(int code, String reason, Duration timeout) throws Exception {
            JsonNode result =
                    sendControlCommand("AWAIT_UNAUTHENTICATED_CLOSE", "AWAIT_CLOSE\t" + code + "\t" + reason, true);
            if (result == null) result = awaitProbeResult(timeout, "AWAIT_UNAUTHENTICATED_CLOSE_RESULT");
            Assertions.assertEquals(code, result.path("closeCode").asInt());
            Assertions.assertEquals(reason, result.path("closeReason").asText());
            Assertions.assertTrue(result.path("sessionId").isNull());
            commandStage = "EXPECTED_UNAUTHENTICATED_CLOSE_CONFIRMED";
            return result;
        }

        void ping(int sequence) throws Exception {
            ping(sequence, 0d);
        }

        double ping(int sequence, double lastRttMs) throws Exception {
            long pingStartedNanos = System.nanoTime();
            if (previousPingStartedNanos > 0) {
                maximumPingGapMillis = Math.max(
                        maximumPingGapMillis,
                        TimeUnit.NANOSECONDS.toMillis(pingStartedNanos - previousPingStartedNanos));
            }
            previousPingStartedNanos = pingStartedNanos;
            sentRtts.add(lastRttMs);
            pendingPingSequence = sequence;
            commandStage = "PING_COMMAND_WRITE";
            JsonNode exited = sendControlCommand("PING", "PING\t" + sequence + "\t" + lastRttMs, false);
            Assertions.assertNull(exited, "TERMINAL_WIRE_SESSION_PROBE_EXITED_BEFORE_PONG");
            commandStage = "WAITING_FOR_PONG";
            awaitPong(sequence, Duration.ofSeconds(15));
            pongCount++;
            pendingPingSequence = -1;
            commandStage = "PONG_CONFIRMED";
            long elapsedNanos = System.nanoTime() - pingStartedNanos;
            return elapsedNanos / 1_000_000d;
        }

        double pingBurst(int count) throws Exception {
            Assertions.assertTrue(count > 0 && count <= 8_192, "TERMINAL_WIRE_PING_BURST_COUNT_INVALID");
            long startedNanos = System.nanoTime();
            JsonNode exited = sendControlCommand("PING_BURST", "PING_BURST\t" + count, false);
            Assertions.assertNull(exited, "TERMINAL_WIRE_SESSION_PROBE_EXITED_BEFORE_PONG_BURST");
            String prefix =
                    "TERMINAL_WIRE_SESSION_PONG_BURST markerId=" + markerId + " count=" + count + " elapsedMillis=";
            Pattern resultPattern =
                    Pattern.compile(Pattern.quote(prefix) + "([0-9]+\\.[0-9]{3}) maxPingMillis=([0-9]+\\.[0-9]{3})");
            long deadline = startedNanos + Duration.ofSeconds(20).toNanos();
            while (System.nanoTime() < deadline) {
                if (Files.isRegularFile(log)) {
                    for (String line : Files.readAllLines(log, StandardCharsets.UTF_8)) {
                        Matcher result = resultPattern.matcher(line);
                        if (!result.find()) continue;
                        double elapsedMillis = Double.parseDouble(result.group(1));
                        lastPingBurstMaximumMillis = Double.parseDouble(result.group(2));
                        Assertions.assertTrue(
                                lastPingBurstMaximumMillis < 1_000, "TERMINAL_WIRE_PING_BURST_PONG_OVER_ONE_SECOND");
                        pongCount += count;
                        return elapsedMillis;
                    }
                }
                TimeUnit.MILLISECONDS.sleep(10);
            }
            throw new IllegalStateException("TERMINAL_WIRE_PING_BURST_DEADLINE_EXCEEDED");
        }

        private double lastPingBurstMaximumMillis;

        double lastPingBurstMaximumMillis() {
            return lastPingBurstMaximumMillis;
        }

        Set<Double> sentRtts() {
            return Set.copyOf(sentRtts);
        }

        long maximumPingGapMillis() {
            return maximumPingGapMillis;
        }

        void beginPingCadenceMeasurement() {
            previousPingStartedNanos = 0;
            maximumPingGapMillis = 0;
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

        String nodeId() throws Exception {
            String prefix = "TERMINAL_WIRE_SESSION_READY markerId=" + markerId + " sessionId=";
            for (String line : Files.readAllLines(log, StandardCharsets.UTF_8)) {
                int start = line.indexOf(prefix);
                if (start < 0) continue;
                String encodedPrefix = " nodeIdBase64=";
                int encodedStart = line.indexOf(encodedPrefix, start + prefix.length());
                if (encodedStart < 0) throw new IllegalStateException("TERMINAL_WIRE_SESSION_NODE_ID_MARKER_MISSING");
                String encoded =
                        line.substring(encodedStart + encodedPrefix.length()).trim();
                try {
                    return new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
                } catch (IllegalArgumentException invalid) {
                    throw new IllegalStateException("TERMINAL_WIRE_SESSION_NODE_ID_MARKER_INVALID", invalid);
                }
            }
            throw new IllegalStateException("TERMINAL_WIRE_SESSION_NODE_ID_MARKER_MISSING");
        }

        void stop() throws Exception {
            stopOwnedClient(node, log);
        }
    }

    private static JsonNode runWireClient(TdsAcceptanceProcess tds, Map<String, Object> request) throws Exception {
        Path script = terminalWireClientScript();
        Path stderr = wireClientLog(tds, requiredWireClientMarkerId(request));
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

    private static Instant tdsEventTimestamp(String log, String... markers) {
        for (String line : log.lines().toList()) {
            if (!java.util.Arrays.stream(markers).allMatch(line::contains)) continue;
            int firstSpace = line.indexOf(' ');
            if (firstSpace < 1) continue;
            try {
                return OffsetDateTime.parse(line.substring(0, firstSpace)).toInstant();
            } catch (java.time.format.DateTimeParseException ignored) {
                // Non-application log lines do not carry the TDS event timestamp format.
            }
        }
        throw new IllegalStateException("V-S15_TDS_EVENT_TIMESTAMP_MISSING");
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
