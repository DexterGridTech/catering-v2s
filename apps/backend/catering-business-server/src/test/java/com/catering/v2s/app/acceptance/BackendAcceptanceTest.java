package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.InvocationTargetException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
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

/** Real HTTP/Testcontainers business oracles; scenarios are discovered by the explicit Java domain catalog. */
@Testcontainers
@EnabledIfEnvironmentVariable(named = "V2S_BACKEND_ACCEPTANCE_OPERATION", matches = "\\S+")
@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest(classes = CateringV2sApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(BackendAcceptanceMetricsConfiguration.class)
class BackendAcceptanceTest {
    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2024-05-10T01-41-38Z";
    private static final String OBJECT_STORAGE_ACCESS_KEY = "baacceptanceaccess";
    private static final String OBJECT_STORAGE_SECRET_KEY = "ba-acceptance-secret-key";
    private static final String OBJECT_STORAGE_BUCKET = "backend-acceptance";
    private static final String PLATFORM_RATE_LIMIT_HMAC = "backend-acceptance-platform-rate-limit-hmac";
    private static final String WORKSPACE_RATE_LIMIT_HMAC = "backend-acceptance-workspace-rate-limit-hmac";
    static final String OPERATIONS_PASSWORD = "Acceptance-Pass-123!";
    static final byte[] PNG = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==");
    static final RouteIdentity PUBLIC_INVITATION_VIEW = new RouteIdentity("getPublicInvitationView", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}");
    static final RouteIdentity ACCEPT_PUBLIC_INVITATION = new RouteIdentity("acceptPublicInvitation", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}");
    static final RouteIdentity SEND_PUBLIC_INVITATION_OTP = new RouteIdentity("sendPublicInvitationOtp", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send");
    static final RouteIdentity VERIFY_PUBLIC_INVITATION_OTP = new RouteIdentity("verifyPublicInvitationOtp", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify");
    static final RouteIdentity SAVE_PUBLIC_INVITATION_CREDENTIALS = new RouteIdentity("savePublicInvitationCredentials", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials");
    static final RouteIdentity COMPLETE_PUBLIC_INVITATION = new RouteIdentity("completePublicInvitation", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete");
    static final RouteIdentity PUBLIC_INVITATION_COMPLETION = new RouteIdentity("getPublicInvitationCompletion", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion");
    static final RouteIdentity OPERATIONS_WORKSPACE_LOGIN_ENTRY = new RouteIdentity("getOperationsWorkspaceLoginEntry", "/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry");
    static final RouteIdentity OPERATIONS_WORKSPACE_PASSWORD_LOGIN = new RouteIdentity("operationsWorkspacePasswordLogin", "/api/operations/group-workspaces/{groupWorkspaceKey}/password-login");
    static final RouteIdentity OPERATIONS_WORKSPACE_SESSION_ENTRY = new RouteIdentity("getOperationsWorkspaceSessionEntry", "/api/operations/group-workspaces/{groupWorkspaceKey}/session/entry");
    static final RouteIdentity OPERATIONS_ORGANIZATION_REGION_CREATE = new RouteIdentity("createOperationsOrganizationRegion", "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions");
    static final RouteIdentity OPERATIONS_ORGANIZATION_PROJECT_CREATE = new RouteIdentity("createOperationsOrganizationProject", "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects");
    static final RouteIdentity OPERATIONS_ORGANIZATION_NODE_UPDATE = new RouteIdentity("updateOperationsOrganizationNode", "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_NODE_STATUS = new RouteIdentity("transitionOperationsOrganizationNodeStatus", "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HIERARCHY = new RouteIdentity("getOperationsOrganizationHierarchy", "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRAND_CREATE = new RouteIdentity("createOperationsOrganizationBrand", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRAND_UPDATE = new RouteIdentity("updateOperationsOrganizationBrand", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRAND_STATUS = new RouteIdentity("transitionOperationsOrganizationBrandStatus", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_TENANT_CREATE = new RouteIdentity("createOperationsOrganizationTenant", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants");
    static final RouteIdentity OPERATIONS_ORGANIZATION_TENANT_STATUS = new RouteIdentity("transitionOperationsOrganizationTenantStatus", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANY_CREATE = new RouteIdentity("createOperationsOrganizationHeadCompany", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANY = new RouteIdentity("getOperationsOrganizationHeadCompany", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS = new RouteIdentity("transitionOperationsOrganizationHeadCompanyStatus", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status");
    static final RouteIdentity OPERATIONS_HEAD_COMPANY_BRAND_ADD = new RouteIdentity("addOperationsOrganizationHeadCompanyBrandAuthorization", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations");
    static final RouteIdentity OPERATIONS_HEAD_COMPANY_BRAND_REMOVE = new RouteIdentity("removeOperationsOrganizationHeadCompanyBrandAuthorization", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_CREATE = new RouteIdentity("createOperationsOrganizationStore", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_UPDATE = new RouteIdentity("updateOperationsOrganizationStore", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_STATUS = new RouteIdentity("transitionOperationsOrganizationStoreStatus", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE = new RouteIdentity("getOperationsOrganizationStore", "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}");
    static final RouteIdentity OPERATIONS_CONTRACT_CREATE = new RouteIdentity("createOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts");
    static final RouteIdentity OPERATIONS_CONTRACT_UPDATE = new RouteIdentity("updateOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}");
    static final RouteIdentity OPERATIONS_CONTRACT_INVALIDATE = new RouteIdentity("invalidateOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate");
    static final RouteIdentity OPERATIONS_CONTRACT = new RouteIdentity("getOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}");
    static final RouteIdentity OPERATIONS_ASSET_STAGE = new RouteIdentity("stageOperationsCatalogAsset", "/api/operations/catalog-inventory/assets/stage");
    static final RouteIdentity OPERATIONS_ASSET_RELEASE = new RouteIdentity("releaseOperationsCatalogStagedAsset", "/api/operations/catalog-inventory/assets/{assetRef}/release");

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
    @Autowired private BusinessEntityService entities;
    @Autowired private WorkspaceRoleService roles;
    @Autowired private WorkspaceInvitationService invitations;
    @Autowired private BackendAcceptanceDatabaseMetricsSink metricsSink;
    @Autowired ObjectMapper mapper;
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

    @TestFactory
    Stream<DynamicTest> backendAcceptanceScenarios() {
        requireRemoteExecution();
        String selectedOperation = System.getenv().getOrDefault("V2S_BACKEND_ACCEPTANCE_OPERATION", "all");
        List<ScenarioDefinition> discovered = BackendAcceptanceScenarioCatalog.discover(this);
        List<ScenarioDefinition> selected = "all".equals(selectedOperation)
                ? discovered
                : discovered.stream().filter(value -> value.annotation().id().equals(selectedOperation) || value.annotation().operation().equals(selectedOperation)).toList();
        assertFalse(selected.isEmpty(), "BACKEND_ACCEPTANCE_OPERATION_NOT_DISCOVERED:" + selectedOperation);
        assertTrue(discovered.size() <= 80, "backend acceptance scenario count must stay within 80");
        writeDiscovery(discovered.size(), selected.size(), selectedOperation);
        System.out.printf("BACKEND_ACCEPTANCE_DISCOVERY DISCOVERED=%d SELECTED=%d OPERATION=%s%n", discovered.size(), selected.size(), selectedOperation);
        return selected.stream().map(definition -> DynamicTest.dynamicTest(
                definition.annotation().id() + " [" + definition.annotation().module() + "]",
                () -> executeScenario(definition)));
    }

    private void executeScenario(ScenarioDefinition definition) throws Throwable {
        ScenarioContext context = new ScenarioContext(definition.annotation());
        try {
            definition.method().setAccessible(true);
            definition.method().invoke(definition.target(), context);
            context.pass();
        } catch (InvocationTargetException failure) {
            context.fail(failure.getCause() == null ? failure : failure.getCause());
            throw failure.getCause() == null ? failure : failure.getCause();
        } catch (Throwable failure) {
            context.fail(failure);
            throw failure;
        }
    }

    Fixture fixture(String targetType, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String key = "acceptance-" + suffix;
        String workspaceName = "Acceptance workspace " + suffix;
        UUID workspaceUuid = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, ?, ?, 'Acceptance Operations', 'ENABLED', 1, 1, ?, ?, ?)", workspaceUuid, key, workspaceName, workspaceName.toLowerCase(java.util.Locale.ROOT), now, now, now);
        long workspaceId = jdbc.queryForObject("SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, key);
        var commercialGroup = commercialGroups.execute(new PlatformExecutionContext("backend-acceptance", "platform-admin", Instant.now().plusSeconds(60), "backend-acceptance-" + suffix), workspaceUuid, key, workspaceId, "backend-acceptance-commercial-group-" + suffix, "ACCEPTANCE-ROOT", "Acceptance root", AuditActor.system());
        OrganizationNodeReadback region = hierarchy.create(workspaceUuid, key, "REGION", null, "acceptance-region", "Acceptance Region");
        OrganizationNodeReadback project = hierarchy.create(workspaceUuid, key, "PROJECT", region.id(), "acceptance-project", "Acceptance Project", null, List.of("Opening"));
        OrganizationEntityReadback brand = entities.createEntity("BRAND", workspaceUuid, key, "acceptance-brand", "Acceptance Brand", null, null, Map.of());
        OrganizationEntityReadback tenant = entities.createEntity("TENANT", workspaceUuid, key, "acceptance-tenant", "Acceptance Tenant", "Acceptance Tenant Ltd", "91310000ACCEPTANCE", Map.of());
        OrganizationEntityReadback store = entities.createStore(workspaceUuid, key, project.id(), tenant.id(), brand.id(), null, "acceptance-store", "Acceptance Store", "Acceptance Store Notes", Map.of());
        OrganizationEntityReadback headCompany = "HEAD_COMPANY".equals(targetType)
                ? entities.createEntity("HEAD_COMPANY", workspaceUuid, key, "acceptance-head-company", "Acceptance Head Company", "Acceptance Head Company Ltd", "91310000HEADACCEPT", Map.of())
                : null;
        String roleNodeType = targetType;
        UUID roleNodeId = switch (targetType) {
            case "GROUP" -> commercialGroup.id();
            case "REGION" -> region.id();
            case "PROJECT" -> project.id();
            case "STORE" -> store.id();
            case "HEAD_COMPANY" -> headCompany.id();
            default -> throw new IllegalArgumentException("unsupported acceptance target " + targetType);
        };
        String roleName = "REGION".equals(targetType) ? "Acceptance Region Operator" : targetType + " Operator";
        UUID roleId = roles.create(workspaceUuid, key, roleName, roleNodeType, null, Set.of(), capabilities).id();
        String mobile = "13800000012";
        String loginName = "operator-" + suffix;
        var invitation = invitations.create(workspaceUuid, key, mobile, List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, roleNodeType, roleNodeId)), now + 3_600_000L);
        return new Fixture(workspaceUuid, key, commercialGroup.id(), region.id(), project.id(), brand.id(), tenant.id(), store.id(), headCompany == null ? null : headCompany.id(), invitation.id(), invitation.rawInvitationToken(), mobile, loginName);
    }

    void completeInvitation(ScenarioContext context, Fixture fixture) throws Exception {
        context.post(ACCEPT_PUBLIC_INVITATION, publicInvitationPath(fixture), null, Map.of(), Set.of(200));
        Response sent = context.post(SEND_PUBLIC_INVITATION_OTP, publicInvitationPath(fixture) + "/otp/send", null, Map.of("mobile", fixture.mobile()), Set.of(200));
        String code = sent.json().path("debugVerificationCode").asText();
        assertTrue(code.matches("[0-9]{6}"), "BUSINESS: managed OTP delivery exposes only the test code");
        Response verified = context.post(VERIFY_PUBLIC_INVITATION_OTP, publicInvitationPath(fixture) + "/otp/verify", null, Map.of("mobile", fixture.mobile(), "code", code), Set.of(200));
        context.post(SAVE_PUBLIC_INVITATION_CREDENTIALS, publicInvitationPath(fixture) + "/credentials", null, Map.of("verificationGrant", verified.json().path("verificationGrant").asText(), "userName", "Acceptance Operator", "loginName", fixture.loginName(), "password", OPERATIONS_PASSWORD), Set.of(200));
        assertEquals("COMPLETED", context.post(COMPLETE_PUBLIC_INVITATION, publicInvitationPath(fixture) + "/complete", null, Map.of(), Set.of(200)).json().path("status").asText(), "BUSINESS: fixture invitation is completed through HTTP");
    }

    Session login(ScenarioContext context, Fixture fixture) throws Exception {
        Response response = context.post(OPERATIONS_WORKSPACE_PASSWORD_LOGIN, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/password-login", null, Map.of("loginName", fixture.loginName(), "password", OPERATIONS_PASSWORD), Set.of(200));
        String cookie = response.http().headers().allValues("set-cookie").stream().findFirst().map(value -> value.substring(0, value.indexOf(';'))).orElseThrow();
        assertEquals(fixture.groupWorkspaceKey(), response.json().path("groupWorkspaceKey").asText(), "BUSINESS: login returns the requested workspace");
        return new Session(cookie, response.json(), response.json().path("contextVersion").asLong());
    }

    static String publicInvitationPath(Fixture fixture) {
        return "/api/public/invitations/" + fixture.groupWorkspaceKey() + "/" + fixture.invitationToken();
    }

    long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    void cancelInvitation(Fixture fixture) {
        invitations.cancel(fixture.workspaceUuid(), fixture.groupWorkspaceKey(), fixture.invitationId(), 1);
    }

    Map<String, Object> queryForMap(String sql, Object... args) {
        return jdbc.queryForMap(sql, args);
    }

    private void writeDiscovery(int discovered, int selected, String operation) {
        try {
            Files.writeString(Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RESULT")), mapper.writeValueAsString(Map.of("type", "discovery", "discovered", discovered, "selected", selected, "operation", operation)) + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception failure) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_DISCOVERY_RESULT_WRITE_FAILED", failure);
        }
    }

    static String sha256(byte[] value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
        StringBuilder result = new StringBuilder();
        for (byte item : digest) result.append(String.format("%02x", item));
        return result.toString();
    }

    private static void requireRemoteExecution() {
        assertEquals("remote", System.getenv("V2S_TESTCONTAINERS_EXECUTION_PLANE"), "Testcontainers must run through the managed remote runner");
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        assertTrue(value != null && !value.isBlank(), name + " must be provided by the managed runner");
        return value;
    }

    private static String objectStorageEndpoint() {
        return "http://127.0.0.1:" + MINIO.getMappedPort(9000);
    }

    record RouteIdentity(String operationId, String routeTemplate) { }
    record Fixture(UUID workspaceUuid, String groupWorkspaceKey, UUID groupId, UUID regionId, UUID projectId, UUID brandId, UUID tenantId, UUID storeId, UUID headCompanyId, UUID invitationId, String invitationToken, String mobile, String loginName) { }
    record Session(String cookie, JsonNode entry, long contextVersion) { }

    final class ScenarioContext {
        private final AcceptanceScenario scenario;
        private final String correlationId = "acceptance-" + UUID.randomUUID();
        private final HttpClient client = HttpClient.newBuilder().build();
        private boolean contractPass = true;

        ScenarioContext(AcceptanceScenario scenario) {
            this.scenario = scenario;
        }

        Response get(RouteIdentity route, String path, String cookie, Set<Integer> expected) throws Exception {
            return send(route, "GET", path, cookie, (String) null, null, expected);
        }

        Response post(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected) throws Exception {
            return send(route, "POST", path, cookie, mapper.writeValueAsString(body), null, expected);
        }

        Response patch(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected) throws Exception {
            return send(route, "PATCH", path, cookie, mapper.writeValueAsString(body), null, expected);
        }

        Response delete(RouteIdentity route, String path, String cookie, Set<Integer> expected) throws Exception {
            return send(route, "DELETE", path, cookie, (String) null, null, expected);
        }

        Response multipartAsset(RouteIdentity route, Fixture fixture, String cookie, String dataNodeRef, String digest, Set<Integer> expected) throws Exception {
            String boundary = "----backend-acceptance-" + UUID.randomUUID();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            writePart(content, boundary, "content", "acceptance.png", "image/png", PNG);
            content.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            String query = "?fileName=acceptance.png&mediaType=" + encode("image/png") + "&contentDigest=" + encode(digest) + "&dataNodeRef=" + encode(dataNodeRef);
            return send(route, "POST", "/api/operations/catalog-inventory/assets/stage" + query, cookie, content.toByteArray(), boundary, expected);
        }

        private Response send(RouteIdentity route, String method, String path, String cookie, String json, String boundary, Set<Integer> expected) throws Exception {
            byte[] body = json == null ? new byte[0] : json.getBytes(StandardCharsets.UTF_8);
            return send(route, method, path, cookie, body, boundary, expected);
        }

        private Response send(RouteIdentity route, String method, String path, String cookie, byte[] body, String boundary, Set<Integer> expected) throws Exception {
            HttpRequest.BodyPublisher publisher = body.length == 0 ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(body);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Accept", "application/json")
                    .header("X-Correlation-Id", correlationId)
                    .header("X-Backend-Acceptance-Run-Id", requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RUN_ID"))
                    .header("X-Backend-Acceptance-Secret", requiredEnvironment("V2S_BACKEND_ACCEPTANCE_SECRET"))
                    .header("X-Backend-Acceptance-Operation-Id", route.operationId())
                    .header("X-Backend-Acceptance-Route-Template", route.routeTemplate())
                    .header("X-Request-Id", UUID.randomUUID().toString())
                    .method(method, publisher);
            if (cookie != null) builder.header("Cookie", cookie);
            if (boundary != null) builder.header("Content-Type", "multipart/form-data; boundary=" + boundary);
            else if (body.length > 0) builder.header("Content-Type", "application/json");
            if (!"GET".equals(method)) builder.header("Idempotency-Key", "ba-" + UUID.randomUUID());
            HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode bodyJson;
            try {
                bodyJson = response.body() == null || response.body().isBlank() ? mapper.createObjectNode() : mapper.readTree(response.body());
            } catch (Exception invalidJson) {
                bodyJson = mapper.createObjectNode();
            }
            Response result = new Response(response.statusCode(), response.body() == null ? "" : response.body(), bodyJson, response);
            if (!expected.contains(result.status())) {
                contractPass = false;
                throw new AssertionError("CONTRACT: unexpected HTTP status=" + result.status() + " problem=" + result.problemCode());
            }
            return result;
        }

        private void pass() throws Exception {
            DatabaseOperationTracker.Snapshot snapshot = metricsSink.snapshotFor(correlationId);
            assertNotNull(snapshot, "DB operation observation is available for the completed HTTP scenario");
            writeResult(Map.of("operation", scenario.id(), "module", scenario.module(), "contract", "PASS", "business", "PASS", "businessMode", "REAL", "businessAssertion", "HAND_WRITTEN_BUSINESS_ORACLE", "dbOperations", snapshot.count(), "status", "PASS"));
            System.out.printf("BACKEND_ACCEPTANCE_RESULT SCENARIO=%s MODULE=%s CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=%d%n", scenario.id(), scenario.module(), snapshot.count());
        }

        private void fail(Throwable failure) throws Exception {
            DatabaseOperationTracker.Snapshot snapshot = metricsSink.snapshotFor(correlationId);
            String category = failure instanceof AssertionError && failure.getMessage() != null && failure.getMessage().startsWith("CONTRACT") ? "HTTP_CONTRACT" : "BUSINESS_ORACLE";
            writeResult(Map.of("operation", scenario.id(), "module", scenario.module(), "contract", contractPass ? "PASS" : "FAIL", "business", "FAIL", "businessMode", "REAL", "businessAssertion", "HAND_WRITTEN_BUSINESS_ORACLE", "dbOperations", snapshot == null ? 0 : snapshot.count(), "status", "FAIL", "failureCategory", category, "failure", compact(failure.getMessage())));
            System.out.printf("BACKEND_ACCEPTANCE_RESULT SCENARIO=%s MODULE=%s CONTRACT=%s BUSINESS=FAIL DB_OPERATIONS=%d FAILURE_CATEGORY=%s%n", scenario.id(), scenario.module(), contractPass ? "PASS" : "FAIL", snapshot == null ? 0 : snapshot.count(), category);
        }

        private void writeResult(Map<String, Object> result) throws Exception {
            Files.writeString(Path.of(requiredEnvironment("V2S_BACKEND_ACCEPTANCE_RESULT")), mapper.writeValueAsString(result) + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        }
    }

    record Response(int status, String raw, JsonNode json, HttpResponse<String> http) {
        String problemCode() {
            String code = json.path("code").asText("");
            if (code.isBlank()) code = json.path("problemCode").asText("");
            if (code.isBlank()) code = json.path("errorCode").asText("");
            return code;
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void writePart(ByteArrayOutputStream output, String boundary, String name, String fileName, String contentType, byte[] value) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + fileName + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(value);
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private static String compact(String value) {
        if (value == null || value.isBlank()) return "UNKNOWN";
        String normalized = value.replaceAll("\\s+", "_").replaceAll("[\\r\\n]", "");
        return normalized.substring(0, Math.min(240, normalized.length()));
    }
}
