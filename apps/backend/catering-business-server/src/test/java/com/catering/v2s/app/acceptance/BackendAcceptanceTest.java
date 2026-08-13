package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** One real HTTP acceptance probe; future operations copy this fixture/request/assertion shape. */
@Testcontainers
@SpringBootTest(classes = CateringV2sApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(BackendAcceptanceMetricsConfiguration.class)
class BackendAcceptanceTest {
    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2024-05-10T01-41-38Z";
    private static final String OBJECT_STORAGE_ACCESS_KEY = "baacceptanceaccess";
    private static final String OBJECT_STORAGE_SECRET_KEY = "ba-acceptance-secret-key";
    private static final String OBJECT_STORAGE_BUCKET = "backend-acceptance";
    private static final String PLATFORM_RATE_LIMIT_HMAC = "backend-acceptance-platform-rate-limit-hmac";
    private static final String WORKSPACE_RATE_LIMIT_HMAC = "backend-acceptance-workspace-rate-limit-hmac";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final GenericContainer<?> MINIO = new GenericContainer<>(MINIO_IMAGE)
            .withEnv("MINIO_ROOT_USER", OBJECT_STORAGE_ACCESS_KEY)
            .withEnv("MINIO_ROOT_PASSWORD", OBJECT_STORAGE_SECRET_KEY)
            .withExposedPorts(9000)
            .withCommand("server", "/data", "--console-address", ":9001")
            .waitingFor(Wait.forHttp("/minio/health/ready").forPort(9000).forStatusCode(200));

    @Autowired private JdbcTemplate jdbc;
    @Autowired private InitializeCommercialGroupCommand commercialGroups;
    @Autowired private OrganizationHierarchyService hierarchy;
    @Autowired private WorkspaceRoleService roles;
    @Autowired private WorkspaceInvitationService invitations;
    @Autowired private BackendAcceptanceDatabaseMetricsSink metricsSink;
    @Autowired private ObjectMapper mapper;
    @LocalServerPort private int port;

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("platform.iam.rate-limit-hmac-secret", () -> PLATFORM_RATE_LIMIT_HMAC);
        registry.add("workspace-iam.rate-limit-hmac-secret", () -> WORKSPACE_RATE_LIMIT_HMAC);
        registry.add("catering.asset.object-storage.endpoint", BackendAcceptanceTest::objectStorageEndpoint);
        registry.add("catering.asset.object-storage.access-key", () -> OBJECT_STORAGE_ACCESS_KEY);
        registry.add("catering.asset.object-storage.secret-key", () -> OBJECT_STORAGE_SECRET_KEY);
        registry.add("catering.asset.object-storage.bucket", () -> OBJECT_STORAGE_BUCKET);
        registry.add("catering.asset.object-storage.object-prefix", () -> "acceptance/");
        registry.add("catering.asset.public-base-url", BackendAcceptanceTest::objectStorageEndpoint);
    }

    @Test
    void getsThePublicInvitationViewOverHttpWithItsBusinessMeaning() throws Exception {
        requireRemoteExecution();
        Fixture fixture = fixture();
        String correlationId = "acceptance-" + UUID.randomUUID();
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                + "/api/public/invitations/" + fixture.groupWorkspaceKey() + "/" + fixture.invitationToken()))
                .header("Accept", "application/json")
                .header("X-Correlation-Id", correlationId)
                .header("X-Backend-Acceptance-Run-Id", requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID"))
                .header("X-Backend-Acceptance-Secret", requiredEnvironment("V2S_BACKEND_ACCEPTANCE_SECRET"))
                .header("X-Backend-Acceptance-Operation-Id", "getPublicInvitationView")
                .header("X-Backend-Acceptance-Route-Template", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}")
                .GET()
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode(), "CONTRACT: documented success response");
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("application/json"),
                "CONTRACT: response is JSON");
        JsonNode body = mapper.readTree(response.body());
        assertEquals(fixture.invitationId().toString(), body.path("invitationId").asText(), "BUSINESS: readback is this invitation");
        assertEquals(fixture.groupWorkspaceKey(), body.path("groupWorkspaceKey").asText(), "BUSINESS: invitation never crosses workspace");
        assertEquals("Acceptance Operations", body.path("operationsTitle").asText(), "BUSINESS: workspace-owned title is exposed");
        assertEquals("REGION", body.path("targetOrganizationType").asText(), "BUSINESS: assigned scope type is preserved");
        assertEquals("acceptance-region Acceptance Region", body.path("targetOrganizationPath").asText(), "BUSINESS: assigned scope path is preserved");
        assertEquals(List.of("Acceptance Region Operator"), mapper.convertValue(body.path("roleNames"), mapper.getTypeFactory().constructCollectionType(List.class, String.class)), "BUSINESS: assigned role is preserved");
        assertEquals("138****0012", body.path("maskedMobile").asText(), "BUSINESS: public response masks the invitee mobile");
        assertEquals("ACTIVE", body.path("status").asText(), "BUSINESS: a pending invitation is publicly active");
        assertEquals("ACCEPT", body.path("nextStep").asText(), "BUSINESS: an untouched invitation begins at consent");

        var snapshot = metricsSink.snapshotFor(correlationId);
        assertNotNull(snapshot, "DB operation observation is available for the completed HTTP request");
        System.out.printf("BACKEND_ACCEPTANCE_RESULT OPERATION=getPublicInvitationView CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=%d%n", snapshot.count());
    }

    private Fixture fixture() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String groupWorkspaceKey = "acceptance-" + suffix;
        UUID workspaceUuid = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, 'Acceptance workspace', 'acceptance workspace', 'Acceptance Operations', 'ENABLED', 1, 1, ?, ?, ?)", workspaceUuid, groupWorkspaceKey, now, now, now);
        long workspaceId = jdbc.queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, groupWorkspaceKey);
        commercialGroups.execute(
                new PlatformExecutionContext("backend-acceptance", "platform-admin", Instant.now().plusSeconds(60), "backend-acceptance-" + suffix),
                workspaceUuid,
                groupWorkspaceKey,
                workspaceId,
                "backend-acceptance-commercial-group-" + UUID.randomUUID(),
                "ACCEPTANCE-ROOT",
                "Acceptance root",
                AuditActor.system());
        UUID regionId = hierarchy.create(workspaceUuid, groupWorkspaceKey, "REGION", null, "acceptance-region", "Acceptance Region").id();
        UUID roleId = roles.create(workspaceUuid, groupWorkspaceKey, "Acceptance Region Operator", "REGION", null, Set.of(), Set.of()).id();
        var invitation = invitations.create(workspaceUuid, groupWorkspaceKey, "13800000012",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)), now + 3_600_000L);
        return new Fixture(groupWorkspaceKey, invitation.id(), invitation.rawInvitationToken());
    }

    private static void requireRemoteExecution() {
        assertEquals("remote", System.getenv("V2S_TESTCONTAINERS_EXECUTION_PLANE"),
                "Testcontainers must run through the managed remote runner");
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        assertTrue(value != null && !value.isBlank(), name + " must be provided by the managed runner");
        return value;
    }

    private static String objectStorageEndpoint() {
        return "http://127.0.0.1:" + MINIO.getMappedPort(9000);
    }

    private record Fixture(String groupWorkspaceKey, UUID invitationId, String invitationToken) { }
}
