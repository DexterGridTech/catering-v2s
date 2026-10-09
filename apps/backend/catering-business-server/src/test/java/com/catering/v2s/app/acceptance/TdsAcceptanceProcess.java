package com.catering.v2s.app.acceptance;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Assertions;
import org.testcontainers.containers.PostgreSQLContainer;

/** Owns the separate TDS JVM used by the managed backend-acceptance process. */
final class TdsAcceptanceProcess implements AutoCloseable {
    private static final String REGISTRATION_GATE_PROPERTY = "v2s.tds.acceptance.registration-gate-socket";
    private static final String LISTENER_GATE_PROPERTY = "v2s.tds.acceptance.listener-gate-socket";
    private static final Pattern NETTY_PORT = Pattern.compile("Netty started on port (\\d+)");
    private static final Pattern LISTENER_READY =
            Pattern.compile("event=tds_listener_ready targetCount=\\d+ backendPid=(\\d+)");
    private static final Duration STARTUP_DEADLINE = Duration.ofSeconds(60);
    private static final Duration SHUTDOWN_DEADLINE = Duration.ofSeconds(15);
    static final long ACCEPTANCE_HEARTBEAT_INTERVAL_MILLIS = 10_000;
    static final long ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS = 60_000;
    static final long ACCEPTANCE_DRAIN_WINDOW_MILLIS = 8_000;
    static final long VS8_STATE_WRITE_INTERVAL_MILLIS = 15_000;
    private static final long DEFAULT_ACCEPTANCE_STATE_WRITE_INTERVAL_MILLIS = 1_000;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String runId;
    private final String instanceName;
    private final Path directory;
    private final Path logPath;
    private final Path evidencePath;
    private final Process process;
    private final TdsRegistrationGateBroker registrationGateBroker;
    private final TdsDatabasePrincipal databasePrincipal;
    private final long pid;
    private final String startTicks;
    private final Instant startedAt;
    private final String runtimeClasspathSha256;
    private final String bootJarSha256;
    private final int port;
    private final TdsCapacity tdsCapacity;
    private final long stateWriteIntervalMillis;
    private final TdsStartConfiguration startConfiguration;
    private final long rssAtReadyKiB;
    private boolean gracefulStopRequested;
    private boolean forceTerminatedForAcceptanceScenario;
    private long rssBeforeStopKiB;
    private boolean closed;

    private TdsAcceptanceProcess(
            String runId,
            String instanceName,
            Path directory,
            Path logPath,
            Path evidencePath,
            Process process,
            TdsRegistrationGateBroker registrationGateBroker,
            TdsDatabasePrincipal databasePrincipal,
            long pid,
            String startTicks,
            Instant startedAt,
            String runtimeClasspathSha256,
            String bootJarSha256,
            int port,
            TdsCapacity tdsCapacity,
            long stateWriteIntervalMillis,
            TdsStartConfiguration startConfiguration,
            long rssAtReadyKiB) {
        this.runId = runId;
        this.instanceName = instanceName;
        this.directory = directory;
        this.logPath = logPath;
        this.evidencePath = evidencePath;
        this.process = process;
        this.registrationGateBroker = registrationGateBroker;
        this.databasePrincipal = databasePrincipal;
        this.pid = pid;
        this.startTicks = startTicks;
        this.startedAt = startedAt;
        this.runtimeClasspathSha256 = runtimeClasspathSha256;
        this.bootJarSha256 = bootJarSha256;
        this.port = port;
        this.tdsCapacity = tdsCapacity;
        this.stateWriteIntervalMillis = stateWriteIntervalMillis;
        this.startConfiguration = startConfiguration;
        this.rssAtReadyKiB = rssAtReadyKiB;
    }

    static TdsAcceptanceProcess start(
            PostgreSQLContainer<?> postgres,
            DorisConfiguration dorisConfiguration,
            TdsStartConfiguration startConfiguration)
            throws Exception {
        return start(postgres, dorisConfiguration, "primary", startConfiguration);
    }

    static TdsAcceptanceProcess start(
            PostgreSQLContainer<?> postgres,
            DorisConfiguration dorisConfiguration,
            String instanceName,
            TdsStartConfiguration startConfiguration)
            throws Exception {
        Assertions.assertNotNull(startConfiguration, "TDS_START_CONFIGURATION_REQUIRED");
        Assertions.assertNotNull(dorisConfiguration, "TDS_DORIS_CONFIGURATION_REQUIRED");
        Assertions.assertTrue(
                instanceName != null && instanceName.matches("[a-z][a-z0-9-]{0,31}"), "TDS_INSTANCE_NAME_INVALID");
        requireRemoteAcceptance();
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        Path acceptanceDirectory = Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_DIRECTORY"))
                .toAbsolutePath()
                .normalize();
        Path tdsDirectory = acceptanceDirectory.resolve("tds").normalize();
        Path directory =
                ("primary".equals(instanceName) ? tdsDirectory : tdsDirectory.resolve(instanceName)).normalize();
        Assertions.assertTrue(directory.startsWith(acceptanceDirectory), "TDS_RUN_DIRECTORY_ESCAPE");
        Files.createDirectories(directory);
        setOwnerOnly(directory);

        Path bootJar = Path.of(requiredSystemProperty("v2s.acceptance.tds-boot-jar"))
                .toAbsolutePath()
                .normalize();
        Path classpathReport = Path.of(requiredSystemProperty("v2s.acceptance.runtime-classpath-report"))
                .toAbsolutePath()
                .normalize();
        validateRuntimeClasspathReport(classpathReport);
        Assertions.assertTrue(Files.isRegularFile(bootJar), "TDS_BOOT_JAR_MISSING");

        String maxUnauthenticated = requiredEnvironment("V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS");
        String maxTracked = requiredEnvironment("V2S_TDS_MAX_TRACKED_SESSIONS");
        String vs8DiagnosticValue = System.getenv().getOrDefault("V2S_BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC", "false");
        Assertions.assertTrue(
                "true".equals(vs8DiagnosticValue) || "false".equals(vs8DiagnosticValue),
                "BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_VALUE_INVALID");
        boolean vs8Diagnostic = "true".equals(vs8DiagnosticValue);
        String tdsTestRuntimeClasspath = vs8Diagnostic ? readTdsTestRuntimeClasspath(classpathReport) : null;
        Assertions.assertFalse(
                vs8Diagnostic
                        && !"storeTerminalActivationBusinessPrecedence"
                                .equals(System.getenv("V2S_BACKEND_ACCEPTANCE_OPERATION")),
                "BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_OPERATION_MISMATCH");
        long stateWriteIntervalMillis =
                vs8Diagnostic ? VS8_STATE_WRITE_INTERVAL_MILLIS : DEFAULT_ACCEPTANCE_STATE_WRITE_INTERVAL_MILLIS;
        Path capacityConfiguration = AcceptanceRepositoryPaths.resolveRegularFile(
                "scripts/env/tds-dev-capacity.json",
                "TDS_CAPACITY_CONFIG_MISSING",
                "TDS_CAPACITY_CONFIG_REPOSITORY_ESCAPE");
        TdsCapacity tdsCapacity = readTdsCapacityConfiguration(capacityConfiguration);
        String nodeBinary = requiredEnvironment("V2S_TERMINAL_WIRE_NODE_BINARY");
        Assertions.assertTrue(Files.isExecutable(Path.of(nodeBinary)), "TERMINAL_WIRE_NODE_EXECUTABLE_MISSING");
        requirePositiveInteger(maxUnauthenticated, "V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS");
        requirePositiveInteger(maxTracked, "V2S_TDS_MAX_TRACKED_SESSIONS");
        Assertions.assertEquals(
                Integer.toString(tdsCapacity.maxUnauthenticatedConnections()),
                maxUnauthenticated,
                "TDS_CAPACITY_CONFIG_ENV_MISMATCH");
        Assertions.assertEquals(
                Integer.toString(tdsCapacity.maxTrackedSessions()), maxTracked, "TDS_CAPACITY_CONFIG_ENV_MISMATCH");

        Path logPath = directory.resolve("tds.log");
        Path evidencePath = directory.resolve("process-evidence.json");
        Files.createFile(logPath);
        TdsDatabasePrincipal databasePrincipal = TdsDatabasePrincipal.provision(postgres, instanceName);
        TdsRegistrationGateBroker registrationGateBroker;
        try {
            registrationGateBroker = TdsRegistrationGateBroker.start(directory);
        } catch (Exception startupFailure) {
            try {
                databasePrincipal.close();
            } catch (Exception cleanupFailure) {
                startupFailure.addSuppressed(cleanupFailure);
            }
            throw startupFailure;
        }
        int requestedPort = 0;
        String javaExecutable = Path.of(System.getProperty("java.home"), "bin", "java")
                .toAbsolutePath()
                .toString();
        List<String> command = new ArrayList<>();
        command.add(javaExecutable);
        if (vs8Diagnostic) {
            command.add("-XX:+AllowRedefinitionToAddDeleteMethods");
            command.add("-cp");
            command.add(tdsTestRuntimeClasspath);
            command.add("com.catering.v2s.terminaldataserver.config.TdsAcceptanceBlockHoundLauncher");
        } else {
            command.add("-jar");
            command.add(bootJar.toString());
        }
        command.add("--server.port=" + requestedPort);
        command.add("--spring.main.web-application-type=reactive");
        command.add("--v2s.tds.state-write-interval-ms=" + stateWriteIntervalMillis);
        if (startConfiguration.nodeIdOverride() != null) {
            command.add("--v2s.tds.node-id=" + startConfiguration.nodeIdOverride());
        }
        if (startConfiguration.readinessWithdrawalWaitMsOverride() != null) {
            command.add(
                    "--v2s.tds.readiness-withdrawal-wait-ms=" + startConfiguration.readinessWithdrawalWaitMsOverride());
        }
        command.add("--v2s.tds.heartbeat-interval-ms=" + ACCEPTANCE_HEARTBEAT_INTERVAL_MILLIS);
        command.add("--v2s.tds.heartbeat-timeout-ms=" + ACCEPTANCE_HEARTBEAT_TIMEOUT_MILLIS);
        command.add("--v2s.tds.drain-window-ms=" + ACCEPTANCE_DRAIN_WINDOW_MILLIS);
        command.add("--v2s.tds.acceptance.blockhound-probe-enabled=" + vs8Diagnostic);
        command.add("--" + REGISTRATION_GATE_PROPERTY + "=" + registrationGateBroker.socketPath());
        command.add("--" + LISTENER_GATE_PROPERTY + "=" + registrationGateBroker.socketPath());
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(Path.of(System.getProperty("user.dir")).toFile());
        builder.redirectErrorStream(true);
        builder.redirectOutput(logPath.toFile());
        Map<String, String> environment = builder.environment();
        environment.clear();
        environment.put("SPRING_DATASOURCE_URL", postgres.getJdbcUrl());
        environment.put("SPRING_DATASOURCE_USERNAME", databasePrincipal.username());
        environment.put("SPRING_DATASOURCE_PASSWORD", databasePrincipal.password());
        environment.put("V2S_RUNTIME_ENVIRONMENT", "non-production");
        environment.put("V2S_DEV_PROFILE", "backend-acceptance");
        environment.put("V2S_BACKEND_ACCEPTANCE_RUN_ID", runId);
        environment.put("V2S_TESTCONTAINERS_EXECUTION_PLANE", "remote");
        environment.put("V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS", maxUnauthenticated);
        environment.put("V2S_TDS_MAX_TRACKED_SESSIONS", maxTracked);
        environment.put("V2S_TDS_DORIS_ENDPOINT", dorisConfiguration.endpoint());
        environment.put("V2S_TDS_DORIS_DATABASE", "terminal_connection_history");
        environment.put("V2S_TDS_DORIS_TABLE", "connection_history");
        environment.put("V2S_TDS_DORIS_USERNAME", dorisConfiguration.username());
        environment.put("V2S_TDS_DORIS_PASSWORD", dorisConfiguration.password());

        Instant startedAt = Instant.now();
        Process process = null;
        long pid = -1;
        String startTicks = null;
        try {
            process = builder.start();
            pid = process.pid();
            startTicks = processStartTicks(pid);
            String runtimeClasspathSha256 = sha256(Files.readAllBytes(classpathReport));
            String bootJarSha256 = sha256(Files.readAllBytes(bootJar));
            int port = awaitReady(process, logPath);
            long rssAtReadyKiB = readRssKiB(pid);
            Assertions.assertTrue(
                    rssAtReadyKiB <= tdsCapacity.rssBudgetMiB() * 1024L, "TDS_RSS_BUDGET_EXCEEDED_AT_READINESS");
            TdsAcceptanceProcess owned = new TdsAcceptanceProcess(
                    runId,
                    instanceName,
                    directory,
                    logPath,
                    evidencePath,
                    process,
                    registrationGateBroker,
                    databasePrincipal,
                    pid,
                    startTicks,
                    startedAt,
                    runtimeClasspathSha256,
                    bootJarSha256,
                    port,
                    tdsCapacity,
                    stateWriteIntervalMillis,
                    startConfiguration,
                    rssAtReadyKiB);
            owned.writeEvidence("READY", "NOT_RUN", null);
            System.out.printf(
                    ("BACKEND_ACCEPTANCE_TDS_PROCESS stage=READY instance=%s pid=%d startTicks=%s port=%d "
                            + "stateWriteIntervalMillis=%d nodeId=%s readinessWithdrawalWaitMillis=%d "
                            + "appType=REACTIVE runId=%s "
                            + "logPath=%s registrationGateSocket=%s%n"),
                    instanceName,
                    pid,
                    startTicks,
                    owned.port,
                    stateWriteIntervalMillis,
                    startConfiguration.effectiveNodeId(),
                    startConfiguration.effectiveReadinessWithdrawalWaitMs(),
                    runId,
                    logPath,
                    registrationGateBroker.socketPath());
            return owned;
        } catch (Exception startupFailure) {
            if (process != null && process.isAlive()) {
                boolean identityMatches =
                        startTicks == null || processStartTicks(pid).equals(startTicks);
                if (!identityMatches) {
                    startupFailure.addSuppressed(
                            new IllegalStateException("TDS_PROCESS_IDENTITY_CHANGED_DURING_STARTUP"));
                } else {
                    process.destroy();
                    if (!process.waitFor(5, TimeUnit.SECONDS)) {
                        process.destroyForcibly();
                        process.waitFor(5, TimeUnit.SECONDS);
                    }
                }
            }
            try {
                registrationGateBroker.close();
            } catch (Exception cleanupFailure) {
                startupFailure.addSuppressed(cleanupFailure);
            }
            try {
                databasePrincipal.close();
            } catch (Exception cleanupFailure) {
                startupFailure.addSuppressed(cleanupFailure);
            }
            throw startupFailure;
        }
    }

    String websocketBaseUrl() {
        return "ws://127.0.0.1:" + port;
    }

    String httpBaseUrl() {
        return "http://127.0.0.1:" + port;
    }

    int maxUnauthenticatedConnections() {
        return tdsCapacity.maxUnauthenticatedConnections();
    }

    int maxTrackedSessions() {
        return tdsCapacity.maxTrackedSessions();
    }

    long stateWriteIntervalMillis() {
        return stateWriteIntervalMillis;
    }

    String nodeId() {
        return startConfiguration.effectiveNodeId();
    }

    long pid() {
        return pid;
    }

    String startTicks() {
        return startTicks;
    }

    long readinessWithdrawalWaitMillis() {
        return startConfiguration.effectiveReadinessWithdrawalWaitMs();
    }

    boolean processAlive() {
        return process.isAlive();
    }

    Path directory() {
        return directory;
    }

    void awaitBindingRevocation(java.util.UUID terminalRef, long generation, Duration timeout) throws Exception {
        String marker =
                "event=tds_binding_revocation_applied terminalRef=" + terminalRef + " revokedGeneration=" + generation;
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) throw new IllegalStateException("TDS_PROCESS_EXITED_BEFORE_REVOCATION_OBSERVED");
            if (Files.readString(logPath, StandardCharsets.UTF_8).contains(marker)) return;
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException("TDS_BINDING_REVOCATION_OBSERVATION_DEADLINE_EXCEEDED");
    }

    int awaitListenerBackendPid(Duration timeout) throws Exception {
        return awaitListenerReadyAfter(-1, timeout);
    }

    int awaitListenerReadyAfter(int previousPid, Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) throw new IllegalStateException("TDS_PROCESS_EXITED_BEFORE_LISTENER_READY");
            Matcher matcher = LISTENER_READY.matcher(Files.readString(logPath, StandardCharsets.UTF_8));
            int latestPid = -1;
            while (matcher.find()) latestPid = Integer.parseInt(matcher.group(1));
            if (latestPid > 0 && latestPid != previousPid) return latestPid;
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException("TDS_LISTENER_READY_DEADLINE_EXCEEDED");
    }

    void awaitListenerDisconnected(int backendPid, Duration timeout) throws Exception {
        awaitListenerDisconnectedAfter(backendPid, 0, timeout);
    }

    void awaitListenerDisconnectedAfter(int backendPid, int logOffset, Duration timeout) throws Exception {
        if (logOffset < 0) throw new IllegalArgumentException("TDS_LISTENER_LOG_OFFSET_INVALID");
        String marker = "event=tds_listener_disconnected";
        String pidMarker = "backendPid=" + backendPid;
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) throw new IllegalStateException("TDS_PROCESS_EXITED_BEFORE_LISTENER_DISCONNECT");
            String log = Files.readString(logPath, StandardCharsets.UTF_8);
            if (log.length() < logOffset) throw new IllegalStateException("TDS_LISTENER_LOG_OFFSET_INVALID");
            boolean found = log.substring(logOffset)
                    .lines()
                    .anyMatch(line -> line.contains(marker) && line.contains(pidMarker));
            if (found) return;
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException("TDS_LISTENER_DISCONNECT_DEADLINE_EXCEEDED");
    }

    void awaitLogMarker(String first, String second, Duration timeout, String failureCode) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            String log = Files.readString(logPath, StandardCharsets.UTF_8);
            if (log.contains(first) && log.contains(second)) return;
            if (!process.isAlive()) throw new IllegalStateException("TDS_PROCESS_EXITED_BEFORE_LOG_MARKER");
            TimeUnit.MILLISECONDS.sleep(50);
        }
        throw new IllegalStateException(failureCode);
    }

    TdsRegistrationGateBroker registrationGateBroker() {
        return registrationGateBroker;
    }

    String logContents() throws IOException {
        return Files.readString(logPath, StandardCharsets.UTF_8);
    }

    void requestGracefulStop() throws IOException {
        Assertions.assertFalse(closed, "TDS_PROCESS_ALREADY_CLOSED");
        Assertions.assertTrue(process.isAlive(), "TDS_PROCESS_NOT_ALIVE_BEFORE_GRACEFUL_STOP");
        Assertions.assertEquals(startTicks, processStartTicks(pid), "TDS_PROCESS_IDENTITY_CHANGED_BEFORE_STOP");
        rssBeforeStopKiB = readRssKiB(pid);
        Assertions.assertTrue(rssBeforeStopKiB > 0, "TDS_RSS_UNAVAILABLE_BEFORE_GRACEFUL_STOP");
        Assertions.assertTrue(
                rssBeforeStopKiB <= tdsCapacity.rssBudgetMiB() * 1024L, "TDS_RSS_BUDGET_EXCEEDED_BEFORE_GRACEFUL_STOP");
        System.out.printf(
                "BACKEND_ACCEPTANCE_TDS_PROCESS stage=PRE_STOP_RESOURCE pid=%d startTicks=%s "
                        + "rssKiB=%d rssBudgetMiB=%d runId=%s%n",
                pid, startTicks, rssBeforeStopKiB, tdsCapacity.rssBudgetMiB(), runId);
        process.destroy();
        gracefulStopRequested = true;
        System.out.printf(
                "BACKEND_ACCEPTANCE_TDS_PROCESS stage=GRACEFUL_STOP_REQUESTED pid=%d startTicks=%s runId=%s%n",
                pid, startTicks, runId);
    }

    int awaitProcessExit(Duration timeout) throws Exception {
        Assertions.assertTrue(
                timeout != null && !timeout.isNegative() && !timeout.isZero(), "TDS_PROCESS_EXIT_TIMEOUT_INVALID");
        if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
            throw new IllegalStateException("TDS_PROCESS_GRACEFUL_EXIT_DEADLINE_EXCEEDED");
        }
        return process.exitValue();
    }

    void forceTerminateForAcceptanceScenario() throws Exception {
        Assertions.assertFalse(closed, "TDS_PROCESS_ALREADY_CLOSED");
        Assertions.assertTrue(process.isAlive(), "TDS_PROCESS_NOT_ALIVE_BEFORE_FORCED_TERMINATION");
        Assertions.assertEquals(startTicks, processStartTicks(pid), "TDS_PROCESS_IDENTITY_CHANGED_BEFORE_FORCED_STOP");
        rssBeforeStopKiB = readRssKiB(pid);
        Assertions.assertTrue(rssBeforeStopKiB > 0, "TDS_RSS_UNAVAILABLE_BEFORE_FORCED_STOP");
        Assertions.assertTrue(
                rssBeforeStopKiB <= tdsCapacity.rssBudgetMiB() * 1024L, "TDS_RSS_BUDGET_EXCEEDED_BEFORE_FORCED_STOP");
        System.out.printf(
                "BACKEND_ACCEPTANCE_TDS_PROCESS stage=FORCED_TERMINATION_REQUESTED instance=%s pid=%d "
                        + "startTicks=%s rssKiB=%d runId=%s%n",
                instanceName, pid, startTicks, rssBeforeStopKiB, runId);
        process.destroyForcibly();
        Assertions.assertTrue(
                process.waitFor(5, TimeUnit.SECONDS), "TDS_ACCEPTANCE_FORCED_TERMINATION_DEADLINE_EXCEEDED");
        Assertions.assertFalse(process.isAlive(), "TDS_PROCESS_ALIVE_AFTER_FORCED_TERMINATION");
        forceTerminatedForAcceptanceScenario = true;
        System.out.printf(
                "BACKEND_ACCEPTANCE_TDS_PROCESS stage=FORCED_TERMINATION_COMPLETE instance=%s pid=%d "
                        + "startTicks=%s exitCode=%d runId=%s%n",
                instanceName, pid, startTicks, process.exitValue(), runId);
    }

    private static int awaitReady(Process process, Path logPath) throws Exception {
        long deadline = System.nanoTime() + STARTUP_DEADLINE.toNanos();
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) throw new IllegalStateException("TDS_PROCESS_EXITED_BEFORE_READINESS");
            String log = Files.readString(logPath, StandardCharsets.UTF_8);
            Matcher port = NETTY_PORT.matcher(log);
            if (port.find() && log.contains("event=tds_listener_ready")) {
                return Integer.parseInt(port.group(1));
            }
            TimeUnit.MILLISECONDS.sleep(100);
        }
        throw new IllegalStateException("TDS_PROCESS_READINESS_DEADLINE_EXCEEDED");
    }

    private void writeEvidence(String phase, String cleanupStatus, Integer exitCode) throws IOException {
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("schemaVersion", 1);
        evidence.put("kind", "backend-acceptance-tds-process");
        evidence.put("instanceName", instanceName);
        evidence.put("runId", runId);
        evidence.put("phase", phase);
        evidence.put("processId", pid);
        evidence.put("processStartTicks", startTicks);
        evidence.put("processStartedAt", startedAt.toString());
        evidence.put("exitCode", exitCode);
        evidence.put("applicationType", "REACTIVE");
        evidence.put("port", port);
        evidence.put("stateWriteIntervalMillis", stateWriteIntervalMillis);
        evidence.put("nodeId", startConfiguration.effectiveNodeId());
        evidence.put("readinessWithdrawalWaitMillis", startConfiguration.effectiveReadinessWithdrawalWaitMs());
        evidence.put(
                "launchMode",
                "true".equals(System.getenv("V2S_BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC"))
                        ? "TDS_TEST_RUNTIME_CLASSPATH_WITH_BLOCKHOUND"
                        : "TDS_BOOT_JAR");
        evidence.put("runtimeClasspathReportSha256", runtimeClasspathSha256);
        evidence.put("bootJarSha256", bootJarSha256);
        evidence.put("rssBudgetMiB", tdsCapacity.rssBudgetMiB());
        evidence.put("rssAtReadyKiB", rssAtReadyKiB);
        evidence.put("rssBeforeStopKiB", rssBeforeStopKiB);
        evidence.put(
                "registrationGateSocket", registrationGateBroker.socketPath().toString());
        evidence.put("logPath", logPath.toString());
        evidence.put("cleanupStatus", cleanupStatus);
        evidence.put(
                "terminationMode",
                forceTerminatedForAcceptanceScenario
                        ? "EXPECTED_FORCED_ACCEPTANCE_SCENARIO"
                        : gracefulStopRequested ? "GRACEFUL" : "UNEXPECTED");
        Path temporary = evidencePath.resolveSibling("process-evidence.json.tmp");
        Files.writeString(temporary, JSON.writeValueAsString(evidence) + "\n", StandardCharsets.UTF_8);
        Files.move(temporary, evidencePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public void close() throws Exception {
        if (closed) return;
        closed = true;
        if (process.isAlive() && processStartTicks(pid).equals(startTicks)) rssBeforeStopKiB = readRssKiB(pid);
        boolean gracefullyRequested = gracefulStopRequested;
        boolean terminated = !process.isAlive();
        Exception cleanupFailure = null;
        if (!terminated && processStartTicks(pid).equals(startTicks)) {
            process.destroy();
            gracefullyRequested = true;
            gracefulStopRequested = true;
            terminated = process.waitFor(SHUTDOWN_DEADLINE.toMillis(), TimeUnit.MILLISECONDS);
        }
        if (!terminated && process.isAlive() && processStartTicks(pid).equals(startTicks)) {
            process.destroyForcibly();
            terminated = process.waitFor(5, TimeUnit.SECONDS);
        }
        try {
            registrationGateBroker.close();
        } catch (Exception failure) {
            cleanupFailure = failure;
        }
        try {
            databasePrincipal.close();
        } catch (Exception failure) {
            if (cleanupFailure == null) cleanupFailure = failure;
            else cleanupFailure.addSuppressed(failure);
        }
        Integer exitCode = terminated ? process.exitValue() : null;
        boolean expectedStop = gracefullyRequested || forceTerminatedForAcceptanceScenario;
        String cleanup = terminated && expectedStop && cleanupFailure == null ? "PASS" : "FAIL";
        String terminationMode = forceTerminatedForAcceptanceScenario
                ? "EXPECTED_FORCED_ACCEPTANCE_SCENARIO"
                : gracefullyRequested ? "GRACEFUL" : "UNEXPECTED";
        writeEvidence("STOPPED", cleanup, exitCode);
        System.out.printf(
                ("BACKEND_ACCEPTANCE_TDS_PROCESS stage=STOPPED instance=%s pid=%d startTicks=%s exitCo"
                        + "de=%s graceful=%s terminationMode=%s cleanup=%s runId=%s%n"),
                instanceName,
                pid,
                startTicks,
                exitCode == null ? "UNAVAILABLE" : exitCode,
                gracefullyRequested,
                terminationMode,
                cleanup,
                runId);
        if (!"PASS".equals(cleanup)) throw new IllegalStateException("TDS_PROCESS_CLEANUP_FAILED");
    }

    private static TdsCapacity readTdsCapacityConfiguration(Path path) throws IOException {
        Assertions.assertTrue(Files.isRegularFile(path), "TDS_CAPACITY_CONFIG_MISSING");
        var root = JSON.readTree(Files.readString(path, StandardCharsets.UTF_8));
        Assertions.assertNotNull(root, "TDS_CAPACITY_CONFIG_INVALID");
        Assertions.assertEquals(1, root.path("schemaVersion").asInt(-1), "TDS_CAPACITY_CONFIG_INVALID");
        var rssNode = root.path("rssBudgetMiB");
        var unauthenticatedNode = root.path("maxUnauthenticatedConnections");
        var trackedNode = root.path("maxTrackedSessions");
        Assertions.assertTrue(rssNode.isIntegralNumber() && rssNode.canConvertToInt(), "TDS_CAPACITY_CONFIG_INVALID");
        Assertions.assertTrue(
                unauthenticatedNode.isIntegralNumber() && unauthenticatedNode.canConvertToInt(),
                "TDS_CAPACITY_CONFIG_INVALID");
        Assertions.assertTrue(
                trackedNode.isIntegralNumber() && trackedNode.canConvertToInt(), "TDS_CAPACITY_CONFIG_INVALID");
        int rssBudgetMiB = rssNode.asInt();
        int maxUnauthenticated = unauthenticatedNode.asInt();
        int maxTracked = trackedNode.asInt();
        Assertions.assertTrue(rssBudgetMiB > 0, "TDS_CAPACITY_CONFIG_INVALID");
        Assertions.assertTrue(maxUnauthenticated > 0 && maxTracked > 0, "TDS_CAPACITY_CONFIG_INVALID");
        return new TdsCapacity(rssBudgetMiB, maxUnauthenticated, maxTracked);
    }

    private static long readRssKiB(long processId) throws IOException {
        Path status = Path.of("/proc", Long.toString(processId), "status");
        for (String line : Files.readAllLines(status, StandardCharsets.UTF_8)) {
            if (line.startsWith("VmRSS:")) {
                String value = line.substring("VmRSS:".length()).trim().split("\\s+")[0];
                return Long.parseLong(value);
            }
        }
        throw new IllegalStateException("TDS_PROCESS_RSS_NOT_AVAILABLE");
    }

    private record TdsCapacity(int rssBudgetMiB, int maxUnauthenticatedConnections, int maxTrackedSessions) {}

    record TdsStartConfiguration(String nodeIdOverride, Long readinessWithdrawalWaitMsOverride) {
        static final String DEFAULT_NODE_ID = "terminal-data-server";
        static final long DEFAULT_READINESS_WITHDRAWAL_WAIT_MS = 3_000;
        static final String VS15_CONTRACT_SCENARIO_ID = "terminal.connection.vs15.readiness-withdrawal-and-drain";
        static final String HISTORY_SECRET_SEARCH_SCENARIO_ID = "terminal.connection.vs11.secret-search";
        static final String HISTORY_RECORDS_SCENARIO_ID = "terminal.connection.history-records";
        static final String HISTORY_OUTAGE_BOUNDED_SCENARIO_ID = "terminal.connection.history-outage-bounded";
        static final String VS13_CROSS_NODE_RECOVERY_SCENARIO_ID = "terminal.connection.vs13.cross-node-recovery";
        static final String TOPIC_SUBSCRIPTION_SCENARIO_ID = "terminal.connection.topic.active-store-subscription";
        static final String TERMINAL_UPDATE_TOPIC_SCENARIO_ID = "terminal.connection.topic.terminal-update-rules";
        static final String REMOTE_COMMAND_SCENARIO_ID = "terminal.connection.remote-command";
        static final String VS15_NODE_ID = "vs15-acceptance-node";
        static final String VS13_NODE_A_ID = "vs13-acceptance-node-a";
        static final String VS13_NODE_B_ID = "vs13-acceptance-node-b";
        static final long VS15_READINESS_WITHDRAWAL_WAIT_MS = 4_000;

        static TdsStartConfiguration forContractScenario(String scenario) {
            if (scenario == null || scenario.isBlank()) return new TdsStartConfiguration(null, null);
            if (VS15_CONTRACT_SCENARIO_ID.equals(scenario)) {
                return new TdsStartConfiguration(VS15_NODE_ID, VS15_READINESS_WITHDRAWAL_WAIT_MS);
            }
            if (HISTORY_SECRET_SEARCH_SCENARIO_ID.equals(scenario)) return new TdsStartConfiguration(null, null);
            if (HISTORY_RECORDS_SCENARIO_ID.equals(scenario)) return new TdsStartConfiguration(null, null);
            if (HISTORY_OUTAGE_BOUNDED_SCENARIO_ID.equals(scenario)) return new TdsStartConfiguration(null, null);
            if (VS13_CROSS_NODE_RECOVERY_SCENARIO_ID.equals(scenario)) {
                return new TdsStartConfiguration(VS13_NODE_A_ID, null);
            }
            if (TOPIC_SUBSCRIPTION_SCENARIO_ID.equals(scenario)) return new TdsStartConfiguration(null, null);
            if (TERMINAL_UPDATE_TOPIC_SCENARIO_ID.equals(scenario)) return new TdsStartConfiguration(null, null);
            if (REMOTE_COMMAND_SCENARIO_ID.equals(scenario)) return new TdsStartConfiguration(null, null);
            throw new IllegalArgumentException("BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_UNKNOWN");
        }

        String effectiveNodeId() {
            return nodeIdOverride == null ? DEFAULT_NODE_ID : nodeIdOverride;
        }

        long effectiveReadinessWithdrawalWaitMs() {
            return readinessWithdrawalWaitMsOverride == null
                    ? DEFAULT_READINESS_WITHDRAWAL_WAIT_MS
                    : readinessWithdrawalWaitMsOverride;
        }
    }

    record DorisConfiguration(String endpoint, String username, String password) {
        DorisConfiguration {
            Assertions.assertTrue(endpoint != null && endpoint.startsWith("http://"), "TDS_DORIS_ENDPOINT_REQUIRED");
            Assertions.assertTrue(username != null && !username.isBlank(), "TDS_DORIS_USERNAME_REQUIRED");
            Assertions.assertTrue(password != null && !password.isEmpty(), "TDS_DORIS_PASSWORD_REQUIRED");
        }

        @Override
        public String toString() {
            return "DorisConfiguration[endpoint=" + endpoint + ", username=REDACTED, password=REDACTED]";
        }
    }

    private static void validateRuntimeClasspathReport(Path report) throws Exception {
        Assertions.assertTrue(Files.isRegularFile(report), "BACKEND_ACCEPTANCE_CLASSPATH_REPORT_MISSING");
        String value = Files.readString(report, StandardCharsets.UTF_8);
        String tdsLine = value.lines()
                .filter(line -> line.startsWith("tdsRuntimeClasspath="))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TDS_RUNTIME_CLASSPATH_REPORT_MISSING"));
        for (String required : new String[] {
            "org.springframework.boot:spring-boot:4.1.0",
            "io.projectreactor.netty:reactor-netty-http:1.3.7",
            "io.projectreactor:reactor-core:3.8.7",
            "io.netty:netty-codec-http:4.2.18.Final"
        }) {
            Assertions.assertTrue(tdsLine.contains(required), "TDS_RUNTIME_CLASSPATH_REPORT_MISSING:" + required);
        }
        String businessLine = value.lines()
                .filter(line -> line.startsWith("businessTestRuntimeClasspath="))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("BUSINESS_TEST_RUNTIME_CLASSPATH_REPORT_MISSING"));
        Assertions.assertFalse(
                businessLine.contains("apps:backend:terminal-data-server"),
                "BACKEND_ACCEPTANCE_TDS_ON_BUSINESS_TEST_RUNTIME_CLASSPATH");
        String tdsTestLine = value.lines()
                .filter(line -> line.startsWith("tdsTestRuntimeClasspath="))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TDS_TEST_RUNTIME_CLASSPATH_REPORT_MISSING"));
        Assertions.assertTrue(
                tdsTestLine.contains("blockhound-1.0.17.RELEASE.jar"),
                "TDS_TEST_BLOCKHOUND_RUNTIME_CLASSPATH_MISSING:1.0.17.RELEASE");
    }

    private static String readTdsTestRuntimeClasspath(Path report) throws IOException {
        String prefix = "tdsTestRuntimeClasspath=";
        String line = Files.readString(report, StandardCharsets.UTF_8)
                .lines()
                .filter(value -> value.startsWith(prefix))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TDS_TEST_RUNTIME_CLASSPATH_REPORT_MISSING"));
        String classpath = line.substring(prefix.length());
        Assertions.assertFalse(classpath.isBlank(), "TDS_TEST_RUNTIME_CLASSPATH_EMPTY");
        Assertions.assertTrue(
                classpath.contains("blockhound-1.0.17.RELEASE.jar"),
                "TDS_TEST_BLOCKHOUND_RUNTIME_CLASSPATH_MISSING:1.0.17.RELEASE");
        return classpath;
    }

    private static void requireRemoteAcceptance() {
        Assertions.assertEquals(
                "remote",
                System.getenv("V2S_TESTCONTAINERS_EXECUTION_PLANE"),
                "TDS acceptance process requires managed remote Testcontainers");
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        Assertions.assertTrue(value != null && !value.isBlank(), name + " is required by the managed TDS process");
        return value;
    }

    private static String requiredSystemProperty(String name) {
        String value = System.getProperty(name);
        Assertions.assertTrue(value != null && !value.isBlank(), name + " is required by the managed TDS process");
        return value;
    }

    private static void requirePositiveInteger(String value, String key) {
        Assertions.assertTrue(value.matches("[1-9][0-9]*"), key + " must be a positive decimal integer");
        try {
            Assertions.assertTrue(Long.parseLong(value) <= Integer.MAX_VALUE, key + " exceeds the supported range");
        } catch (NumberFormatException invalid) {
            throw new IllegalArgumentException(key + " exceeds the supported range", invalid);
        }
    }

    private static String processStartTicks(long pid) throws IOException {
        String stat = Files.readString(Path.of("/proc", Long.toString(pid), "stat"), StandardCharsets.UTF_8);
        int closeParen = stat.lastIndexOf(')');
        if (closeParen < 0) throw new IllegalStateException("TDS_PROCESS_IDENTITY_UNAVAILABLE");
        String[] remainingFields = stat.substring(closeParen + 1).trim().split("\\s+");
        if (remainingFields.length <= 19) throw new IllegalStateException("TDS_PROCESS_IDENTITY_INVALID");
        return remainingFields[19];
    }

    private static String sha256(byte[] bytes) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder value = new StringBuilder(digest.length * 2);
        for (byte item : digest) value.append(String.format("%02x", item));
        return value.toString();
    }

    private static void setOwnerOnly(Path directory) throws IOException {
        try {
            Files.setPosixFilePermissions(
                    directory,
                    EnumSet.of(
                            PosixFilePermission.OWNER_READ,
                            PosixFilePermission.OWNER_WRITE,
                            PosixFilePermission.OWNER_EXECUTE));
        } catch (UnsupportedOperationException unsupported) {
            throw new IllegalStateException("TDS_RUN_DIRECTORY_POSIX_PERMISSIONS_REQUIRED", unsupported);
        }
    }
}
