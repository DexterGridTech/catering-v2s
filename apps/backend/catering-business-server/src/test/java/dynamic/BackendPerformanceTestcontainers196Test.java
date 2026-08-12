package dynamic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.catering.v2s.catalog.application.CatalogOwnerService;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.application.AssetObjectStorage;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Executes the package-owned 196-operation HTTP lane against a fresh PostgreSQL and MinIO pair.
 *
 * The only non-HTTP preparation is the explicitly bounded owner-fixture bridge below.  The
 * external-order temporary-item ingress is not public in this phase, so the bridge invokes the
 * catalog owner's public Java boundary with a server-shaped scope grant and never writes SQL.
 */
@Testcontainers
@SpringBootTest(classes = CateringV2sApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BackendPerformanceTestcontainers196Test {
    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2024-05-10T01-41-38Z";
    private static final String OBJECT_STORAGE_ACCESS_KEY = "bpf196access";
    private static final String OBJECT_STORAGE_SECRET_KEY = "bpf196-secret-key";
    private static final String OBJECT_STORAGE_BUCKET = "bpf-backend-performance";
    private static final String OBJECT_STORAGE_PREFIX = "bpf196/";
    private static final String PLATFORM_RATE_LIMIT_HMAC = "bpf-platform-rate-limit-hmac-20260811";
    private static final String WORKSPACE_RATE_LIMIT_HMAC = "bpf-workspace-rate-limit-hmac-20260811";
    private static final Duration WORKLOAD_TIMEOUT = Duration.ofMinutes(15);
    private static final Set<PosixFilePermission> PRIVATE_FILE_PERMISSIONS =
        Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
    private static final Set<PosixFilePermission> PRIVATE_DIRECTORY_PERMISSIONS =
        Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE);

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final GenericContainer<?> MINIO = new GenericContainer<>(MINIO_IMAGE)
        .withEnv("MINIO_ROOT_USER", OBJECT_STORAGE_ACCESS_KEY)
        .withEnv("MINIO_ROOT_PASSWORD", OBJECT_STORAGE_SECRET_KEY)
        .withExposedPorts(9000)
        .withCommand("server", "/data", "--console-address", ":9001")
        .waitingFor(Wait.forHttp("/minio/health/ready").forPort(9000).forStatusCode(200));

    @Autowired
    private CatalogOwnerService catalogOwnerService;

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private AssetObjectStorage assetObjects;

    @Autowired
    private WorkspaceAdministrationService workspaces;

    @LocalServerPort
    private int port;

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("platform.iam.rate-limit-hmac-secret", () -> PLATFORM_RATE_LIMIT_HMAC);
        registry.add("workspace-iam.rate-limit-hmac-secret", () -> WORKSPACE_RATE_LIMIT_HMAC);
        registry.add("catering.asset.object-storage.endpoint", BackendPerformanceTestcontainers196Test::objectStorageEndpoint);
        registry.add("catering.asset.object-storage.access-key", () -> OBJECT_STORAGE_ACCESS_KEY);
        registry.add("catering.asset.object-storage.secret-key", () -> OBJECT_STORAGE_SECRET_KEY);
        registry.add("catering.asset.object-storage.bucket", () -> OBJECT_STORAGE_BUCKET);
        registry.add("catering.asset.object-storage.object-prefix", () -> OBJECT_STORAGE_PREFIX);
        registry.add("catering.asset.public-base-url", BackendPerformanceTestcontainers196Test::objectStorageEndpoint);
    }

    @Test
    void executesTheAuthoritative196OperationSet() throws Exception {
        Path root = requiredPath("V2S_REMOTE_WORKSPACE");
        assertTrue(Files.isDirectory(root), "managed remote workspace is missing");
        Path runtime = requiredPath("V2S_RUNTIME_DIR");
        Files.createDirectories(runtime);
        secure(runtime);

        Path requestPath = requiredPath("V2S_BPF_OWNER_FIXTURE_REQUEST");
        Path responsePath = requiredPath("V2S_BPF_OWNER_FIXTURE_RESPONSE");
        Path resultPath = requiredPath("V2S_BPF_WORKLOAD_RESULT");
        Path bridgeLogPath = runtime.resolve("owner-fixture-bridge.jsonl");
        Path workloadLogPath = runtime.resolve("backend-performance-196-workload.log");
        Path workloadScript = root.resolve("scripts/test/backend-performance-testcontainers-196-remote-workload.mjs");
        assertTrue(Files.isRegularFile(workloadScript), "package-owned workload script is missing");

        Files.createDirectories(workloadLogPath.getParent());
        Files.writeString(workloadLogPath, "", StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        secure(workloadLogPath);
        prepareObjectStorage(bridgeLogPath);

        ProcessBuilder builder = new ProcessBuilder(
            System.getenv().getOrDefault("V2S_NODE_BINARY", "node"),
            workloadScript.toString()
        );
        builder.directory(root.toFile());
        Map<String, String> environment = builder.environment();
        environment.put("V2S_BPF_WORKLOAD_PORT", Integer.toString(port));
        environment.put("V2S_BPF_DB_PORT", Integer.toString(POSTGRES.getMappedPort(5432)));
        environment.put("V2S_BPF_DB_NAME", POSTGRES.getDatabaseName());
        environment.put("V2S_BPF_DB_USERNAME", POSTGRES.getUsername());
        environment.put("V2S_BPF_DB_PASSWORD", POSTGRES.getPassword());
        environment.put("CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET", PLATFORM_RATE_LIMIT_HMAC);
        environment.put("CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET", WORKSPACE_RATE_LIMIT_HMAC);
        environment.put("CATERING_ASSET_OBJECT_STORAGE_ENDPOINT", objectStorageEndpoint());
        environment.put("CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY", OBJECT_STORAGE_ACCESS_KEY);
        environment.put("CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY", OBJECT_STORAGE_SECRET_KEY);
        environment.put("CATERING_ASSET_OBJECT_STORAGE_BUCKET", OBJECT_STORAGE_BUCKET);
        environment.put("CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX", OBJECT_STORAGE_PREFIX);
        environment.put("CATERING_ASSET_PUBLIC_BASE_URL", objectStorageEndpoint());
        builder.redirectErrorStream(true);
        builder.redirectOutput(workloadLogPath.toFile());

        Process workload = builder.start();
        boolean fixtureHandled = false;
        try {
            Instant deadline = Instant.now().plus(WORKLOAD_TIMEOUT);
            appendPhase(bridgeLogPath, "WORKLOAD_STARTED", "PASS");
            while (workload.isAlive()) {
                if (!fixtureHandled && Files.isRegularFile(requestPath) && !Files.exists(responsePath)) {
                    materializeOwnerFixture(requestPath, responsePath, bridgeLogPath);
                    fixtureHandled = true;
                }
                if (Instant.now().isAfter(deadline)) {
                    appendPhase(bridgeLogPath, "WORKLOAD_TIMEOUT", "FAIL");
                    workload.destroyForcibly();
                    break;
                }
                Thread.sleep(250L);
            }
            if (!fixtureHandled && Files.isRegularFile(requestPath) && !Files.exists(responsePath)) {
                materializeOwnerFixture(requestPath, responsePath, bridgeLogPath);
                fixtureHandled = true;
            }
            int exitCode = workload.waitFor();
            assertEquals(0, exitCode, "196 workload failed; inspect the redacted workload log at " + workloadLogPath);
        } finally {
            if (workload.isAlive()) workload.destroyForcibly();
        }

        assertTrue(Files.isRegularFile(resultPath), "196 workload result is missing");
        JsonNode result = mapper.readTree(Files.readString(resultPath));
        assertEquals("backend-performance-testcontainers-196-workload-result", result.path("kind").asText());
        assertEquals("PASS", result.path("status").asText());
        assertEquals("PASS", result.path("businessStatus").asText());
        assertEquals("NOT_OWNED_BY_WORKLOAD", result.path("cleanupStatus").asText());
        assertEquals("TESTCONTAINERS_AND_MANAGED_RUNNER", result.path("cleanupOwner").asText());
        assertEquals(196, result.path("completedOperations").asInt());
        assertEquals(requiredEnv("V2S_BACKEND_PERFORMANCE_FINAL_RUN_ID"), result.path("runId").asText());
        appendPhase(bridgeLogPath, "WORKLOAD_COMPLETED", "PASS");
    }

    private void materializeOwnerFixture(Path requestPath, Path responsePath, Path bridgeLogPath) {
        try {
            JsonNode request = mapper.readTree(Files.readString(requestPath));
            if (request == null || !request.isObject()) throw new IllegalStateException("BP_U06_OWNER_FIXTURE_REQUEST_INVALID");
            if (request.path("schemaVersion").asInt(-1) != 1 || !"PENDING".equals(request.path("status").asText())) {
                throw new IllegalStateException("BP_U06_OWNER_FIXTURE_REQUEST_STATUS_INVALID");
            }
            UUID dataNodeRef = uuid(request, "dataNodeRef", "BP_U06_OWNER_FIXTURE_DATA_NODE_INVALID");
            String groupWorkspaceKey = text(request, "groupWorkspaceKey", "BP_U06_OWNER_FIXTURE_GROUP_KEY_MISSING");
            if (!groupWorkspaceKey.matches("[a-z0-9][a-z0-9-]{2,63}")) {
                throw new IllegalStateException("BP_U06_OWNER_FIXTURE_GROUP_KEY_INVALID");
            }
            // The HTTP WorkspaceSessionEntry contract intentionally exposes the key, not the
            // internal workspace UUID. Resolve that identity from the owning workspace service.
            UUID workspaceUuid = workspaces.requireEnabled(groupWorkspaceKey).workspaceUuid();
            String brandRef = text(request, "brandRef", "BP_U06_OWNER_FIXTURE_BRAND_MISSING");
            String temporaryCode = text(request, "temporaryCode", "BP_U06_OWNER_FIXTURE_TEMPORARY_CODE_MISSING");
            String formalCode = text(request, "formalCode", "BP_U06_OWNER_FIXTURE_FORMAL_CODE_MISSING");
            if (!temporaryCode.matches("BPF-TEMP-[0-9]{10,20}") || !formalCode.matches("BPF-FORMAL-[0-9]{10,20}")) {
                throw new IllegalStateException("BP_U06_OWNER_FIXTURE_CODE_INVALID");
            }

            OperationsOwnerScopeGrant grant = new OperationsOwnerScopeGrant(
                workspaceUuid,
                groupWorkspaceKey,
                "BP_U06_OWNER_FIXTURE",
                "EDIT_STORE_CATALOG",
                "STORE",
                dataNodeRef,
                "STORE",
                dataNodeRef,
                List.of(dataNodeRef)
            );
            String requestId = "bpf-u06-owner-fixture-" + UUID.randomUUID();
            String createIdempotencyKey = "bpf-u06-owner-fixture-create-" + UUID.randomUUID();
            ObjectNode create = mapper.createObjectNode()
                .put("code", temporaryCode)
                .put("name", "Backend performance temporary owner fixture")
                .put("shapeKey", "STANDARD_SALE_COUNTED");
            create.putObject("attributes").put("fixtureRef", "BPF_U06_OWNER_FIXTURE");
            JsonNode created = catalogOwnerService.write(
                "createOperationsCatalogItem",
                dataNodeRef.toString(),
                brandRef,
                create,
                requestId,
                createIdempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                "STORE",
                grant
            ).path("result");
            long createdVersion = created.path("version").asLong(-1);
            if (createdVersion < 1) throw new IllegalStateException("BP_U06_OWNER_FIXTURE_CREATE_READBACK_INVALID");

            ObjectNode save = mapper.createObjectNode().put("itemCode", temporaryCode);
            ObjectNode draft = save.putObject("sections")
                .put("expectedCatalogVersion", createdVersion)
                .putObject("catalogDraft");
            draft.put("source", "EXTERNAL_ORDER_TEMPORARY")
                .put("governanceStatus", "GOVERNANCE_TODO");
            draft.putObject("externalIdentity")
                .put("sourceOrderRef", "ORDER-" + temporaryCode)
                .put("sourceRecordRef", "RECORD-" + temporaryCode)
                .put("sourceItemRef", "ITEM-" + temporaryCode);
            JsonNode saved = catalogOwnerService.write(
                "saveOperationsCatalogItem",
                dataNodeRef.toString(),
                brandRef,
                save,
                requestId + "-save",
                "bpf-u06-owner-fixture-save-" + UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                "STORE",
                grant
            ).path("result");
            long savedVersion = saved.path("version").asLong(-1);
            if (savedVersion != createdVersion + 1) throw new IllegalStateException("BP_U06_OWNER_FIXTURE_SAVE_READBACK_INVALID");

            ObjectNode response = mapper.createObjectNode()
                .put("schemaVersion", 1)
                .put("status", "PASS")
                .put("temporaryCode", temporaryCode)
                .put("formalCode", formalCode)
                .put("sourceFact", "OWNER_SERVICE_EXTERNAL_ORDER_TEMPORARY")
                .put("createdVersion", createdVersion)
                .put("savedVersion", savedVersion);
            writeAtomically(responsePath, response);
            appendPhase(bridgeLogPath, "OWNER_FIXTURE_MATERIALIZED", "PASS");
        } catch (Exception failure) {
            ObjectNode response = mapper.createObjectNode()
                .put("schemaVersion", 1)
                .put("status", "FAIL")
                .put("reason", safeFailure(failure));
            try {
                writeAtomically(responsePath, response);
                appendPhase(bridgeLogPath, "OWNER_FIXTURE_MATERIALIZED", "FAIL");
            } catch (IOException ignored) {
                appendPhase(bridgeLogPath, "OWNER_FIXTURE_RESPONSE_WRITE", "FAIL");
            }
        }
    }

    private static String safeFailure(Exception failure) {
        String message = failure.getMessage();
        return message != null && message.matches("[A-Z0-9_:-]{3,160}")
            ? message
            : "BP_U06_OWNER_FIXTURE_OWNER_API_FAILED";
    }

    private static UUID uuid(JsonNode node, String field, String code) {
        try {
            return UUID.fromString(text(node, field, code));
        } catch (RuntimeException failure) {
            throw new IllegalStateException(code);
        }
    }

    private static String text(JsonNode node, String field, String code) {
        String value = node.path(field).asText(null);
        if (value == null || value.isBlank()) throw new IllegalStateException(code);
        return value;
    }

    private static Path requiredPath(String name) {
        String value = requiredEnv(name);
        Path path = Path.of(value).toAbsolutePath().normalize();
        if (path.toString().isBlank()) throw new IllegalStateException("BP_U06_REQUIRED_PATH_INVALID");
        return path;
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException("BP_U06_ENV_MISSING_" + name);
        return value;
    }

    private static String objectStorageEndpoint() {
        return "http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000);
    }

    private void prepareObjectStorage(Path bridgeLogPath) {
        try {
            byte[] sentinel = new byte[] {0x42};
            String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sentinel));
            String objectKey = assetObjects.objectKey("static/" + digest);
            try (ByteArrayInputStream content = new ByteArrayInputStream(sentinel)) {
                assetObjects.put(objectKey, "application/octet-stream", sentinel.length, content);
            }
            assetObjects.delete(objectKey);
            appendPhase(bridgeLogPath, "OBJECT_STORAGE_PREPARED", "PASS");
        } catch (Exception ignored) {
            appendPhase(bridgeLogPath, "OBJECT_STORAGE_PREPARED", "FAIL");
            throw new IllegalStateException("BP_U06_OBJECT_STORAGE_BUCKET_PREPARATION_FAILED");
        }
    }

    private static void writeAtomically(Path target, ObjectNode value) throws IOException {
        Files.createDirectories(target.getParent());
        Path temporary = Files.createTempFile(target.getParent(), target.getFileName().toString(), ".tmp");
        try {
            Files.writeString(temporary, value.toString() + System.lineSeparator(), StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING);
            secure(temporary);
            try {
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException unsupported) {
                throw new IOException("BP_U06_OWNER_FIXTURE_ATOMIC_WRITE_UNSUPPORTED", unsupported);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private static void appendPhase(Path logPath, String phase, String status) {
        try {
            Files.createDirectories(logPath.getParent());
            Files.writeString(
                logPath,
                "{\"at\":\"" + Instant.now() + "\",\"phase\":\"" + phase + "\",\"status\":\"" + status + "\"}" + System.lineSeparator(),
                StandardOpenOption.CREATE,
                StandardOpenOption.WRITE,
                StandardOpenOption.APPEND
            );
            secure(logPath);
        } catch (IOException ignored) {
            // The managed runner still owns the authoritative process and workload logs.
        }
    }

    private static void secure(Path path) {
        try {
            Files.setPosixFilePermissions(path, Files.isDirectory(path) ? PRIVATE_DIRECTORY_PERMISSIONS : PRIVATE_FILE_PERMISSIONS);
        } catch (UnsupportedOperationException | IOException ignored) {
            // The remote Testcontainers host is POSIX; this keeps static compilation portable.
        }
    }
}
