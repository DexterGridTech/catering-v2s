package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The single managed HTTP acceptance suite. The remote runner supplies the lane-scoped
 * namespace and runtime; this class owns only the disposable application/container context.
 */
@Testcontainers
@SpringBootTest(classes = CateringV2sApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({BackendAcceptanceMeasurementCalibrationConfiguration.class, BackendAcceptanceOwnerBootstrapConfiguration.class})
class BackendAcceptanceTest {
    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2024-05-10T01-41-38Z";
    private static final String OBJECT_STORAGE_ACCESS_KEY = "baacceptanceaccess";
    private static final String OBJECT_STORAGE_SECRET_KEY = "ba-acceptance-secret-key";
    private static final String PLATFORM_RATE_LIMIT_HMAC = "backend-acceptance-platform-rate-limit-hmac";
    private static final String WORKSPACE_RATE_LIMIT_HMAC = "backend-acceptance-workspace-rate-limit-hmac";
    private static final Duration WORKLOAD_TIMEOUT = Duration.ofMinutes(20);
    private static final Set<PosixFilePermission> PRIVATE_FILE_PERMISSIONS = Set.of(
            PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
    private static final Set<PosixFilePermission> PRIVATE_DIRECTORY_PERMISSIONS = Set.of(
            PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE);

    private static final String NAMESPACE = namespace();
    private static final String DATABASE_NAME = databaseName();
    private static final String OBJECT_STORAGE_BUCKET = "ba-" + NAMESPACE.replaceAll("[^a-z0-9-]", "-");

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName(DATABASE_NAME);

    @Container
    static final GenericContainer<?> MINIO = new GenericContainer<>(MINIO_IMAGE)
            .withEnv("MINIO_ROOT_USER", OBJECT_STORAGE_ACCESS_KEY)
            .withEnv("MINIO_ROOT_PASSWORD", OBJECT_STORAGE_SECRET_KEY)
            .withExposedPorts(9000)
            .withCommand("server", "/data", "--console-address", ":9001")
            .waitingFor(Wait.forHttp("/minio/health/ready").forPort(9000).forStatusCode(200));

    @Autowired
    private BackendAcceptanceDatabaseMetricsSink metricsSink;

    @Autowired
    private ObjectMapper mapper;

    @LocalServerPort
    private int port;

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("v2s.backend-acceptance.bootstrap-enabled", () -> "true");
        registry.add("platform.iam.rate-limit-hmac-secret", () -> PLATFORM_RATE_LIMIT_HMAC);
        registry.add("workspace-iam.rate-limit-hmac-secret", () -> WORKSPACE_RATE_LIMIT_HMAC);
        registry.add("catering.asset.object-storage.endpoint", BackendAcceptanceTest::objectStorageEndpoint);
        registry.add("catering.asset.object-storage.access-key", () -> OBJECT_STORAGE_ACCESS_KEY);
        registry.add("catering.asset.object-storage.secret-key", () -> OBJECT_STORAGE_SECRET_KEY);
        registry.add("catering.asset.object-storage.bucket", () -> OBJECT_STORAGE_BUCKET);
        registry.add("catering.asset.object-storage.object-prefix", () -> NAMESPACE + "/");
        registry.add("catering.asset.public-base-url", BackendAcceptanceTest::objectStorageEndpoint);
    }

    @Test
    void executesTheManagedBackendAcceptanceWorkload() throws Exception {
        requireRemoteExecution();
        String runId = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID");
        String secret = requiredEnvironment("V2S_BACKEND_ACCEPTANCE_SECRET");
        Path runtime = Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUNTIME_DIR")).toAbsolutePath().normalize();
        Files.createDirectories(runtime);
        secure(runtime);

        BackendAcceptanceHttpHarness harness = new BackendAcceptanceHttpHarness(
                URI.create("http://127.0.0.1:" + port), runId, secret, metricsSink);
        BackendAcceptanceMeasurementCalibrationScenario.Receipt calibration = harness.runMeasurementCalibration();
        writeCalibrationReceipt(runtime.resolve("calibration-receipt.json"), calibration);

        Path workloadResult = Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_WORKLOAD_RESULT")).toAbsolutePath().normalize();
        Files.createDirectories(workloadResult.getParent());
        Path workloadLog = runtime.resolve("workload.log");
        Files.deleteIfExists(workloadResult);
        Files.writeString(workloadLog, "");
        secure(workloadLog);
        Path root = Path.of(requiredEnvironment("V2S_REMOTE_WORKSPACE")).toAbsolutePath().normalize();
        Path workload = root.resolve("tools/backend-acceptance/workload.mjs");
        assertTrue(Files.isRegularFile(workload), "managed backend-acceptance workload is missing");

        ProcessBuilder processBuilder = new ProcessBuilder(
                System.getenv().getOrDefault("V2S_NODE_BINARY", "node"), workload.toString());
        processBuilder.directory(root.toFile());
        processBuilder.redirectErrorStream(true);
        processBuilder.redirectOutput(workloadLog.toFile());
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_WORKLOAD_PORT", Integer.toString(port));
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_WORKLOAD_RESULT", workloadResult.toString());
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_DATABASE_NAMESPACE", NAMESPACE);
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_OBJECT_STORAGE_NAMESPACE", NAMESPACE);
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_DB_URL", POSTGRES.getJdbcUrl());
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_DB_USERNAME", POSTGRES.getUsername());
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_DB_PASSWORD", POSTGRES.getPassword());
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_MINIO_ENDPOINT", objectStorageEndpoint());
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_MINIO_ACCESS_KEY", OBJECT_STORAGE_ACCESS_KEY);
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_MINIO_SECRET_KEY", OBJECT_STORAGE_SECRET_KEY);
        processBuilder.environment().put("V2S_BACKEND_ACCEPTANCE_MINIO_BUCKET", OBJECT_STORAGE_BUCKET);

        Process workloadProcess = processBuilder.start();
        Instant deadline = Instant.now().plus(WORKLOAD_TIMEOUT);
        while (workloadProcess.isAlive()) {
            if (Instant.now().isAfter(deadline)) {
                workloadProcess.destroyForcibly();
                throw new IllegalStateException("BACKEND_ACCEPTANCE_WORKLOAD_TIMEOUT");
            }
            Thread.sleep(250L);
        }
        int exitCode = workloadProcess.waitFor();
        assertEquals(0, exitCode, "backend-acceptance workload failed; inspect the managed workload log");
        assertTrue(Files.isRegularFile(workloadResult), "backend-acceptance workload result is missing");
        JsonNode result = mapper.readTree(Files.readString(workloadResult));
        assertEquals("backend-acceptance-workload-result", result.path("kind").asText());
        assertEquals("PASS", result.path("status").asText());
        assertEquals("PASS", result.path("contractStatus").asText());
        assertEquals("PASS", result.path("businessStatus").asText());
        assertEquals("PASS", result.path("performanceStatus").asText());
        assertEquals("PASS", result.path("cleanupStatus").asText());
    }

    private static void writeCalibrationReceipt(Path target,
                                                BackendAcceptanceMeasurementCalibrationScenario.Receipt receipt)
            throws IOException {
        Files.writeString(target, new ObjectMapper().writeValueAsString(receipt) + "\n");
        secure(target);
    }

    private static String namespace() {
        String value = System.getenv().getOrDefault("V2S_BACKEND_ACCEPTANCE_DATABASE_NAMESPACE", "backend-acceptance-test");
        String normalized = value.toLowerCase().replaceAll("[^a-z0-9-]", "-");
        String bounded = normalized.substring(0, Math.min(40, normalized.length())).replaceAll("-+$", "");
        return bounded.isBlank() ? "backend-acceptance-test" : bounded;
    }

    private static String databaseName() {
        String value = "ba_" + NAMESPACE.replace('-', '_');
        return value.substring(0, Math.min(63, value.length()));
    }

    private static String objectStorageEndpoint() {
        return "http://127.0.0.1:" + MINIO.getMappedPort(9000);
    }

    private static void requireRemoteExecution() {
        if (!"remote".equals(System.getenv("V2S_TESTCONTAINERS_EXECUTION_PLANE"))) {
            throw new IllegalStateException("V2S_TESTCONTAINERS_REMOTE_REQUIRED");
        }
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException(name + "_REQUIRED");
        return value;
    }

    private static void secure(Path path) {
        try {
            Files.setPosixFilePermissions(path, Files.isDirectory(path) ? PRIVATE_DIRECTORY_PERMISSIONS : PRIVATE_FILE_PERMISSIONS);
        } catch (UnsupportedOperationException | IOException ignored) {
            // The managed runner still records the path; POSIX mode is best-effort on non-POSIX hosts.
        }
    }
}
