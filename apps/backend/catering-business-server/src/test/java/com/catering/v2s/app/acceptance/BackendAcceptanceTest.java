package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.runtime.RuntimeEnvironmentKeys;
import com.catering.v2s.platform.iam.api.PlatformDiagnosticBootstrap;
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
import org.junit.jupiter.api.Test;
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
@EnabledIfEnvironmentVariable(named = RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, matches = "\\S+")
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
    static final String PLATFORM_ADMIN_LOGIN = "acceptance-platform-admin";
    static final String PLATFORM_ADMIN_PASSWORD = "Acceptance-Platform-123!";
    static final byte[] PNG = Base64.getDecoder()
            .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==");
    static final byte[] OTHER_PNG = Base64.getDecoder()
            .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    static final RouteIdentity PUBLIC_INVITATION_VIEW = new RouteIdentity(
            "getPublicInvitationView", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}");
    static final RouteIdentity ACCEPT_PUBLIC_INVITATION = new RouteIdentity(
            "acceptPublicInvitation", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}");
    static final RouteIdentity SEND_PUBLIC_INVITATION_OTP = new RouteIdentity(
            "sendPublicInvitationOtp", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send");
    static final RouteIdentity VERIFY_PUBLIC_INVITATION_OTP = new RouteIdentity(
            "verifyPublicInvitationOtp", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify");
    static final RouteIdentity SAVE_PUBLIC_INVITATION_CREDENTIALS = new RouteIdentity(
            "savePublicInvitationCredentials",
            "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials");
    static final RouteIdentity COMPLETE_PUBLIC_INVITATION = new RouteIdentity(
            "completePublicInvitation", "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete");
    static final RouteIdentity PUBLIC_INVITATION_COMPLETION = new RouteIdentity(
            "getPublicInvitationCompletion",
            "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion");
    static final RouteIdentity OPERATIONS_WORKSPACE_LOGIN_ENTRY = new RouteIdentity(
            "getOperationsWorkspaceLoginEntry", "/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry");
    static final RouteIdentity OPERATIONS_WORKSPACE_PASSWORD_LOGIN = new RouteIdentity(
            "operationsWorkspacePasswordLogin", "/api/operations/group-workspaces/{groupWorkspaceKey}/password-login");
    static final RouteIdentity OPERATIONS_WORKSPACE_SESSION_ENTRY = new RouteIdentity(
            "getOperationsWorkspaceSessionEntry", "/api/operations/group-workspaces/{groupWorkspaceKey}/session/entry");
    static final RouteIdentity OPERATIONS_WORKSPACE_SESSION_DATA_NODE = new RouteIdentity(
            "selectOperationsWorkspaceSessionDataNode",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/session/data-node");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANDIDATES = new RouteIdentity(
            "getOperationsWorkspaceHeadCompanyInvitationCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/candidates");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_INVITATIONS = new RouteIdentity(
            "getOperationsWorkspaceGroupInvitations",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_USER = new RouteIdentity(
            "getOperationsWorkspaceGroupUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_USER = new RouteIdentity(
            "getOperationsWorkspaceStoreUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user");
    static final RouteIdentity OPERATIONS_ORGANIZATION_REGION_CREATE = new RouteIdentity(
            "createOperationsOrganizationRegion",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions");
    static final RouteIdentity OPERATIONS_ORGANIZATION_PROJECT_CREATE = new RouteIdentity(
            "createOperationsOrganizationProject",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/regions/{regionId}/projects");
    static final RouteIdentity OPERATIONS_ORGANIZATION_NODE_UPDATE = new RouteIdentity(
            "updateOperationsOrganizationNode",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_NODE_STATUS = new RouteIdentity(
            "transitionOperationsOrganizationNodeStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/{nodeId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HIERARCHY = new RouteIdentity(
            "getOperationsOrganizationHierarchy", "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRAND_CREATE = new RouteIdentity(
            "createOperationsOrganizationBrand",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRANDS = new RouteIdentity(
            "getOperationsOrganizationBrands",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRAND_UPDATE = new RouteIdentity(
            "updateOperationsOrganizationBrand",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BRAND_STATUS = new RouteIdentity(
            "transitionOperationsOrganizationBrandStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_TENANT_CREATE = new RouteIdentity(
            "createOperationsOrganizationTenant",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants");
    static final RouteIdentity OPERATIONS_ORGANIZATION_TENANTS = new RouteIdentity(
            "getOperationsOrganizationTenants",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants");
    static final RouteIdentity OPERATIONS_ORGANIZATION_TENANT_STATUS = new RouteIdentity(
            "transitionOperationsOrganizationTenantStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANY_CREATE = new RouteIdentity(
            "createOperationsOrganizationHeadCompany",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANIES = new RouteIdentity(
            "getOperationsOrganizationHeadCompanies",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANY = new RouteIdentity(
            "getOperationsOrganizationHeadCompany",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS = new RouteIdentity(
            "transitionOperationsOrganizationHeadCompanyStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/status");
    static final RouteIdentity OPERATIONS_HEAD_COMPANY_BRAND_ADD = new RouteIdentity(
            "addOperationsOrganizationHeadCompanyBrandAuthorization",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-aut"
                    + "horizations");
    static final RouteIdentity OPERATIONS_HEAD_COMPANY_BRAND_REMOVE = new RouteIdentity(
            "removeOperationsOrganizationHeadCompanyBrandAuthorization",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-aut"
                    + "horizations/{brandId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_CREATE = new RouteIdentity(
            "createOperationsOrganizationStore",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORES = new RouteIdentity(
            "getOperationsOrganizationStores",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_UPDATE = new RouteIdentity(
            "updateOperationsOrganizationStore",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_STATUS = new RouteIdentity(
            "transitionOperationsOrganizationStoreStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/status");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE = new RouteIdentity(
            "getOperationsOrganizationStore",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_CANDIDATES = new RouteIdentity(
            "getOperationsOrganizationCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/candidates");
    static final RouteIdentity OPERATIONS_CONTRACT_CREATE = new RouteIdentity(
            "createOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts");
    static final RouteIdentity OPERATIONS_CONTRACT_LIST = new RouteIdentity(
            "getOperationsContracts", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts");
    static final RouteIdentity OPERATIONS_CONTRACT_UPDATE = new RouteIdentity(
            "updateOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}");
    static final RouteIdentity OPERATIONS_CONTRACT_INVALIDATE = new RouteIdentity(
            "invalidateOperationsContract",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}/invalidate");
    static final RouteIdentity OPERATIONS_CONTRACT = new RouteIdentity(
            "getOperationsContract", "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/{contractId}");
    static final RouteIdentity OPERATIONS_ASSET_STAGE =
            new RouteIdentity("stageOperationsCatalogAsset", "/api/operations/catalog-inventory/assets/stage");
    static final RouteIdentity OPERATIONS_ASSET_RELEASE = new RouteIdentity(
            "releaseOperationsCatalogStagedAsset", "/api/operations/catalog-inventory/assets/{assetRef}/release");
    static final RouteIdentity OPERATIONS_CATALOG_ITEM_CREATE =
            new RouteIdentity("createOperationsCatalogItem", "/api/operations/catalog-inventory/items");
    static final RouteIdentity OPERATIONS_CATALOG_ITEM_SAVE =
            new RouteIdentity("saveOperationsCatalogItem", "/api/operations/catalog-inventory/items/{itemCode}");
    static final RouteIdentity OPERATIONS_CATALOG_ITEM_STATUS = new RouteIdentity(
            "transitionOperationsCatalogItemStatus", "/api/operations/catalog-inventory/items/{itemCode}/status");
    static final RouteIdentity OPERATIONS_CATALOG_ITEM_READ =
            new RouteIdentity("getOperationsCatalogItem", "/api/operations/catalog-inventory/items/{itemCode}");
    static final RouteIdentity OPERATIONS_CATALOG_SHAPE_MANIFEST =
            new RouteIdentity("getOperationsCatalogShapeManifest", "/api/operations/catalog-inventory/shape-manifest");
    static final RouteIdentity OPERATIONS_CATALOG_BATCH_STATUS = new RouteIdentity(
            "batchTransitionOperationsCatalogItemStatus", "/api/operations/catalog-inventory/items/status");
    static final RouteIdentity OPERATIONS_CATALOG_DICTIONARY_READ = new RouteIdentity(
            "getOperationsCatalogDictionary", "/api/operations/catalog-inventory/dictionaries/{dictionaryKind}");
    static final RouteIdentity OPERATIONS_CATALOG_LOCAL_COPY_CANDIDATES = new RouteIdentity(
            "getOperationsLocalCatalogCopyCandidates", "/api/operations/catalog-inventory/copy/local/candidates");
    static final RouteIdentity OPERATIONS_CATALOG_BRAND_COPY_CANDIDATES = new RouteIdentity(
            "getOperationsBrandCatalogCopyCandidates", "/api/operations/catalog-inventory/copy/brand/candidates");
    static final RouteIdentity OPERATIONS_PRODUCTION_TAGS =
            new RouteIdentity("getOperationsProductionTags", "/api/operations/catalog-inventory/production-tags");
    static final RouteIdentity OPERATIONS_PRODUCTION_TAG_CREATE =
            new RouteIdentity("createOperationsProductionTag", "/api/operations/catalog-inventory/production-tags");
    static final RouteIdentity OPERATIONS_CATALOG_DICTIONARY_CREATE = new RouteIdentity(
            "createOperationsCatalogDictionaryEntry",
            "/api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries");
    static final RouteIdentity OPERATIONS_CATALOG_DICTIONARY_UPDATE = new RouteIdentity(
            "updateOperationsCatalogDictionaryEntry",
            "/api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}");
    static final RouteIdentity OPERATIONS_CATALOG_DICTIONARY_STATUS = new RouteIdentity(
            "transitionOperationsCatalogDictionaryEntryStatus",
            "/api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}/status");
    static final RouteIdentity OPERATIONS_CATALOG_CATEGORY_CREATE =
            new RouteIdentity("createOperationsCatalogCategory", "/api/operations/catalog-inventory/categories");
    static final RouteIdentity OPERATIONS_CATALOG_CATEGORY_DELETE = new RouteIdentity(
            "deleteOperationsCatalogCategory", "/api/operations/catalog-inventory/categories/{categoryRef}");
    static final RouteIdentity OPERATIONS_CATALOG_LOCAL_COPY_PREFLIGHT = new RouteIdentity(
            "preflightOperationsLocalCatalogCopy", "/api/operations/catalog-inventory/copy/local/preflight");
    static final RouteIdentity OPERATIONS_CATALOG_LOCAL_COPY_EXECUTE = new RouteIdentity(
            "executeOperationsLocalCatalogCopy", "/api/operations/catalog-inventory/copy/local/execute");
    static final RouteIdentity OPERATIONS_INVENTORY_TARGET_READ = new RouteIdentity(
            "getOperationsInventoryTarget", "/api/operations/catalog-inventory/inventory-targets/{targetRef}");
    static final RouteIdentity OPERATIONS_INVENTORY_TARGETS =
            new RouteIdentity("getOperationsInventoryTargets", "/api/operations/catalog-inventory/inventory-targets");
    static final RouteIdentity OPERATIONS_INVENTORY_CONSUMPTION_REFERENCES = new RouteIdentity(
            "getOperationsInventoryTargetConsumptionReferences",
            "/api/operations/catalog-inventory/inventory-targets/{targetRef}/consumption-references");
    static final RouteIdentity OPERATIONS_INVENTORY_TARGET_LEDGER = new RouteIdentity(
            "getOperationsInventoryTargetLedger",
            "/api/operations/catalog-inventory/inventory-targets/{targetRef}/ledger");
    static final RouteIdentity OPERATIONS_INVENTORY_TARGET_COUNT = new RouteIdentity(
            "countOperationsInventoryTarget", "/api/operations/catalog-inventory/inventory-targets/{targetRef}/count");
    static final RouteIdentity OPERATIONS_INVENTORY_CONSUMPTION_TARGET_CANDIDATES = new RouteIdentity(
            "getOperationsInventoryConsumptionTargetCandidates",
            "/api/operations/catalog-inventory/inventory-consumption-target-candidates");
    static final RouteIdentity OPERATIONS_CATALOG_UNIT_UPDATE =
            new RouteIdentity("updateOperationsCatalogUnit", "/api/operations/catalog-inventory/units/{unitRef}");
    static final RouteIdentity PLATFORM_PASSWORD_LOGIN =
            new RouteIdentity("platformPasswordLogin", "/api/platform/auth/password-login");
    static final RouteIdentity PLATFORM_ADMIN_PAGE =
            new RouteIdentity("getPlatformAdminPage", "/api/platform/admin-users");
    static final RouteIdentity PLATFORM_GROUP_WORKSPACES =
            new RouteIdentity("listPlatformGroupWorkspaces", "/api/platform/group-workspaces");
    static final RouteIdentity PLATFORM_GROUP_WORKSPACE_DETAIL =
            new RouteIdentity("getPlatformGroupWorkspaceDetail", "/api/platform/group-workspaces/{groupWorkspaceKey}");
    static final RouteIdentity PLATFORM_GROUP_WORKSPACE_UPDATE = new RouteIdentity(
            "updatePlatformGroupWorkspaceDisplay", "/api/platform/group-workspaces/{groupWorkspaceKey}");
    static final RouteIdentity PLATFORM_AUDIT_HISTORY =
            new RouteIdentity("getPlatformEntityAuditHistory", "/api/platform/audit-history");
    static final RouteIdentity OPERATIONS_AUDIT_HISTORY =
            new RouteIdentity("getOperationsEntityAuditHistory", "/api/operations/audit-history");
    static final RouteIdentity PLATFORM_ORGANIZATION_OVERVIEW = new RouteIdentity(
            "getPlatformOrganizationOverviewPage",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview");
    static final RouteIdentity PLATFORM_ORGANIZATION_CANDIDATES = new RouteIdentity(
            "getPlatformOrganizationCandidates",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/candidates");
    static final RouteIdentity PLATFORM_WORKSPACE_INVITATIONS = new RouteIdentity(
            "getWorkspaceInvitations", "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations");
    static final RouteIdentity PLATFORM_WORKSPACE_INVITATION_CANDIDATES = new RouteIdentity(
            "getWorkspaceInvitationCandidates",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/invitation-candidates");
    static final RouteIdentity PLATFORM_WORKSPACE_ACCOUNTS =
            new RouteIdentity("getWorkspaceAccounts", "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts");
    static final RouteIdentity PLATFORM_WORKSPACE_ROLES =
            new RouteIdentity("getWorkspaceRoles", "/api/platform/group-workspaces/{groupWorkspaceKey}/roles");
    static final RouteIdentity PLATFORM_COMMERCIAL_GROUP_INITIALIZE = new RouteIdentity(
            "initializeCommercialGroup", "/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group");
    static final RouteIdentity PLATFORM_EXTENSION_ENTITY_CATALOG = new RouteIdentity(
            "getExtensionEntityCatalog", "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions");
    static final RouteIdentity PLATFORM_EXTENSION_DEFINITION = new RouteIdentity(
            "getExtensionDefinition",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}");
    static final RouteIdentity PLATFORM_REPLACE_EXTENSION_DEFINITION = new RouteIdentity(
            "replaceExtensionDefinition",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}");
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_EXTENSION_DEFINITION = new RouteIdentity(
            "getOperationsOrganizationStoreExtensionDefinition",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/extension-definition");
    static final RouteIdentity OPERATIONS_ORGANIZATION_BUSINESS_ENTITY_EXTENSION_DEFINITION = new RouteIdentity(
            "getOperationsOrganizationBusinessEntityExtensionDefinition",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/business-entities/extension-definition");
    static final RouteIdentity OPERATIONS_ORGANIZATION_HIERARCHY_EXTENSION_DEFINITION = new RouteIdentity(
            "getOperationsOrganizationHierarchyExtensionDefinition",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/hierarchy/extension-definition");
    static final RouteIdentity OPERATIONS_CONTRACT_EXTENSION_DEFINITION = new RouteIdentity(
            "getOperationsContractExtensionDefinition",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/extension-definition");

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
    private JdbcTemplate jdbc;

    @Autowired
    private InitializeCommercialGroupCommand commercialGroups;

    @Autowired
    private OrganizationHierarchyService hierarchy;

    @Autowired
    private BusinessEntityService entities;

    @Autowired
    private WorkspaceRoleService roles;

    @Autowired
    private WorkspaceInvitationService invitations;

    @Autowired
    private PlatformDiagnosticBootstrap platformBootstrap;

    @Autowired
    private BackendAcceptanceDatabaseMetricsSink metricsSink;

    @Autowired
    ObjectMapper mapper;

    @LocalServerPort
    private int port;

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
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        List<ScenarioDefinition> discovered = BackendAcceptanceScenarioCatalog.discover(this);
        List<ScenarioDefinition> selected = "all".equals(selectedOperation)
                ? discovered
                : discovered.stream()
                        .filter(value -> value.annotation().id().equals(selectedOperation)
                                || value.annotation().operation().equals(selectedOperation))
                        .toList();
        assertFalse(selected.isEmpty(), "BACKEND_ACCEPTANCE_OPERATION_NOT_DISCOVERED:" + selectedOperation);
        assertTrue(discovered.size() <= 80, "backend acceptance scenario count must stay within 80");
        writeDiscovery(discovered.size(), selected.size(), selectedOperation);
        System.out.printf(
                "BACKEND_ACCEPTANCE_DISCOVERY DISCOVERED=%d SELECTED=%d OPERATION=%s%n",
                discovered.size(), selected.size(), selectedOperation);
        return selected.stream()
                .map(definition -> DynamicTest.dynamicTest(
                        definition.annotation().id() + " ["
                                + definition.annotation().module() + "]",
                        () -> executeScenario(definition)));
    }

    /**
     * Runs only when the managed CP-09 proof is explicitly requested. It is deliberately not an
     * {@link AcceptanceScenario}: connection-scope probes must not change the product-business scenario denominator or
     * be reported as a substitute for those scenarios.
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF", matches = "true")
    void p2ReadConnectionScopeProof() throws Exception {
        requireRemoteExecution();
        P2ReadConnectionScopeScenarios.run(this, new ScenarioContext(null));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE", matches = "true")
    void backendPerformanceOperationCoverage() throws Exception {
        requireRemoteExecution();
        BackendPerformanceOperationCoverage.run(this, new ScenarioContext(null));
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
        return fixture(targetType, Set.of(), capabilities);
    }

    Fixture fixture(String targetType, Set<String> pageAccessKeys, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String key = "acceptance-" + suffix;
        String workspaceName = "Acceptance workspace " + suffix;
        UUID workspaceUuid = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, ?, ?, 'Acceptance "
                        + "Operations', "
                        + "'ENABLED', 1, 1, ?, ?, ?)",
                workspaceUuid,
                key,
                workspaceName,
                workspaceName.toLowerCase(java.util.Locale.ROOT),
                now,
                now,
                now);
        long workspaceId = jdbc.queryForObject(
                "SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, key);
        var commercialGroup = commercialGroups.execute(
                new PlatformExecutionContext(
                        "backend-acceptance",
                        "platform-admin",
                        Instant.now().plusSeconds(60),
                        "backend-acceptance-" + suffix),
                workspaceUuid,
                key,
                workspaceId,
                "backend-acceptance-commercial-group-" + suffix,
                "ACCEPTANCE-ROOT",
                "Acceptance root",
                AuditActor.system());
        OrganizationNodeReadback region =
                hierarchy.create(workspaceUuid, key, "REGION", null, "acceptance-region", "Acceptance Region");
        OrganizationNodeReadback project = hierarchy.create(
                workspaceUuid,
                key,
                "PROJECT",
                region.id(),
                "acceptance-project",
                "Acceptance Project",
                null,
                List.of("Opening"));
        OrganizationEntityReadback brand = entities.createEntity(
                "BRAND", workspaceUuid, key, "acceptance-brand", "Acceptance Brand", null, null, Map.of());
        OrganizationEntityReadback tenant = entities.createEntity(
                "TENANT",
                workspaceUuid,
                key,
                "acceptance-tenant",
                "Acceptance Tenant",
                "Acceptance Tenant Ltd",
                "91310000ACCEPTANCE",
                Map.of());
        OrganizationEntityReadback store = entities.createStore(
                workspaceUuid,
                key,
                project.id(),
                tenant.id(),
                brand.id(),
                null,
                "acceptance-store",
                "Acceptance Store",
                "Acceptance Store Notes",
                Map.of());
        OrganizationEntityReadback headCompany = "HEAD_COMPANY".equals(targetType)
                ? entities.createEntity(
                        "HEAD_COMPANY",
                        workspaceUuid,
                        key,
                        "acceptance-head-company",
                        "Acceptance Head Company",
                        "Acceptance Head Company Ltd",
                        "91310000HEADACCEPT",
                        Map.of())
                : null;
        String roleNodeType = targetType;
        UUID roleNodeId =
                switch (targetType) {
                    case "GROUP" -> commercialGroup.id();
                    case "REGION" -> region.id();
                    case "PROJECT" -> project.id();
                    case "STORE" -> store.id();
                    case "HEAD_COMPANY" -> headCompany.id();
                    default -> throw new IllegalArgumentException("unsupported acceptance target " + targetType);
                };
        String roleName = "REGION".equals(targetType) ? "Acceptance Region Operator" : targetType + " Operator";
        UUID roleId = roles.create(workspaceUuid, key, roleName, roleNodeType, null, pageAccessKeys, capabilities)
                .id();
        String mobile = "13800000012";
        String loginName = "operator-" + suffix;
        var invitation = invitations.create(
                workspaceUuid,
                key,
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, roleNodeType, roleNodeId)),
                now + 3_600_000L);
        return new Fixture(
                workspaceUuid,
                key,
                commercialGroup.id(),
                region.id(),
                project.id(),
                brand.id(),
                tenant.id(),
                store.id(),
                headCompany == null ? null : headCompany.id(),
                invitation.id(),
                invitation.rawInvitationToken(),
                mobile,
                loginName);
    }

    /** Creates a second user assigned to the existing group so group paging is exercised at the owner boundary. */
    Fixture groupUserFixture(Fixture existing, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
        UUID roleId = roles.create(
                        existing.workspaceUuid(),
                        existing.groupWorkspaceKey(),
                        "Acceptance Group Operator " + suffix,
                        "GROUP",
                        null,
                        Set.of(),
                        capabilities)
                .id();
        String mobile =
                "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
        String loginName = "operator-group-" + suffix;
        var invitation = invitations.create(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "GROUP", existing.groupId())),
                now + 3_600_000L);
        return new Fixture(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.groupId(),
                existing.regionId(),
                existing.projectId(),
                existing.brandId(),
                existing.tenantId(),
                existing.storeId(),
                existing.headCompanyId(),
                invitation.id(),
                invitation.rawInvitationToken(),
                mobile,
                loginName);
    }

    /** Creates an independently authorized store/brand context in an existing isolated workspace. */
    Fixture siblingStoreFixture(Fixture existing, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
        OrganizationEntityReadback brand = entities.createEntity(
                "BRAND",
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                "acceptance-brand-" + suffix,
                "Acceptance Brand " + suffix,
                null,
                null,
                Map.of());
        OrganizationEntityReadback tenant = entities.createEntity(
                "TENANT",
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                "acceptance-tenant-" + suffix,
                "Acceptance Tenant " + suffix,
                "Acceptance Tenant " + suffix + " Ltd",
                "91310000" + suffix,
                Map.of());
        OrganizationEntityReadback store = entities.createStore(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.projectId(),
                tenant.id(),
                brand.id(),
                null,
                "acceptance-store-" + suffix,
                "Acceptance Store " + suffix,
                "Acceptance Store Notes",
                Map.of());
        UUID roleId = roles.create(
                        existing.workspaceUuid(),
                        existing.groupWorkspaceKey(),
                        "Acceptance Store Operator " + suffix,
                        "STORE",
                        null,
                        Set.of(),
                        capabilities)
                .id();
        String mobile =
                "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
        String loginName = "operator-" + suffix;
        var invitation = invitations.create(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "STORE", store.id())),
                now + 3_600_000L);
        return new Fixture(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.groupId(),
                existing.regionId(),
                existing.projectId(),
                brand.id(),
                tenant.id(),
                store.id(),
                null,
                invitation.id(),
                invitation.rawInvitationToken(),
                mobile,
                loginName);
    }

    /** Creates a second store under the same brand so owner queries must enforce the data-node boundary. */
    Fixture siblingStoreFixtureSameBrand(Fixture existing, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
        OrganizationEntityReadback store = entities.createStore(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.projectId(),
                existing.tenantId(),
                existing.brandId(),
                null,
                "acceptance-store-same-brand-" + suffix,
                "Acceptance Same Brand Store " + suffix,
                "Acceptance Store Notes",
                Map.of());
        UUID roleId = roles.create(
                        existing.workspaceUuid(),
                        existing.groupWorkspaceKey(),
                        "Acceptance Same Brand Store Operator " + suffix,
                        "STORE",
                        null,
                        Set.of(),
                        capabilities)
                .id();
        String mobile =
                "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
        String loginName = "operator-same-brand-" + suffix;
        var invitation = invitations.create(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "STORE", store.id())),
                now + 3_600_000L);
        return new Fixture(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.groupId(),
                existing.regionId(),
                existing.projectId(),
                existing.brandId(),
                existing.tenantId(),
                store.id(),
                null,
                invitation.id(),
                invitation.rawInvitationToken(),
                mobile,
                loginName);
    }

    /**
     * Creates a second user on the existing project so project-owned templates and store-owned channels stay distinct.
     */
    Fixture projectUserFixture(Fixture existing, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
        UUID roleId = roles.create(
                        existing.workspaceUuid(),
                        existing.groupWorkspaceKey(),
                        "Acceptance Project Operator " + suffix,
                        "PROJECT",
                        null,
                        Set.of(),
                        capabilities)
                .id();
        String mobile =
                "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
        String loginName = "operator-project-" + suffix;
        var invitation = invitations.create(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "PROJECT", existing.projectId())),
                now + 3_600_000L);
        return new Fixture(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.groupId(),
                existing.regionId(),
                existing.projectId(),
                existing.brandId(),
                existing.tenantId(),
                existing.storeId(),
                existing.headCompanyId(),
                invitation.id(),
                invitation.rawInvitationToken(),
                mobile,
                loginName);
    }

    /** Creates a HEAD_COMPANY source and a linked STORE target for the brand-copy read surface. */
    BrandCopyFixtures brandCopyFixtures(Set<String> targetCapabilities) {
        Fixture source = fixture("HEAD_COMPANY", Set.of("EDIT_HEAD_COMPANY_CATALOG"));
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        entities.addHeadCompanyBrandAuthorization(
                source.workspaceUuid(),
                source.groupWorkspaceKey(),
                source.headCompanyId(),
                source.brandId(),
                "acceptance-brand-copy-authorization-" + suffix,
                AuditActor.system());
        OrganizationEntityReadback store = entities.createStore(
                source.workspaceUuid(),
                source.groupWorkspaceKey(),
                source.projectId(),
                source.tenantId(),
                source.brandId(),
                source.headCompanyId(),
                "acceptance-brand-copy-store-" + suffix,
                "Acceptance Brand Copy Store " + suffix,
                "Acceptance Store Notes",
                Map.of());
        UUID roleId = roles.create(
                        source.workspaceUuid(),
                        source.groupWorkspaceKey(),
                        "Acceptance Brand Copy Store Operator " + suffix,
                        "STORE",
                        null,
                        Set.of(),
                        targetCapabilities)
                .id();
        String mobile =
                "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
        String loginName = "operator-brand-copy-" + suffix;
        var invitation = invitations.create(
                source.workspaceUuid(),
                source.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "STORE", store.id())),
                Instant.now().toEpochMilli() + 3_600_000L);
        Fixture target = new Fixture(
                source.workspaceUuid(),
                source.groupWorkspaceKey(),
                source.groupId(),
                source.regionId(),
                source.projectId(),
                source.brandId(),
                source.tenantId(),
                store.id(),
                source.headCompanyId(),
                invitation.id(),
                invitation.rawInvitationToken(),
                mobile,
                loginName);
        return new BrandCopyFixtures(source, target);
    }

    List<UUID> createHeadCompanyCandidates(Fixture existing, int count) {
        if (count < 1) throw new IllegalArgumentException("head company candidate count must be positive");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        List<UUID> result = new java.util.ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            OrganizationEntityReadback headCompany = entities.createEntity(
                    "HEAD_COMPANY",
                    existing.workspaceUuid(),
                    existing.groupWorkspaceKey(),
                    "acceptance-head-company-" + suffix + "-" + String.format("%02d", index),
                    "Acceptance Head Company " + suffix + " " + index,
                    "Acceptance Head Company " + suffix + " " + index + " Ltd",
                    "91310000" + suffix + String.format("%02d", index),
                    Map.of());
            result.add(headCompany.id());
        }
        return List.copyOf(result);
    }

    List<UUID> createEnabledRoles(Fixture existing, String serviceNodeType, int count) {
        if (count < 1) throw new IllegalArgumentException("enabled role count must be positive");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        List<UUID> result = new java.util.ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            result.add(roles.create(
                            existing.workspaceUuid(),
                            existing.groupWorkspaceKey(),
                            "Acceptance candidate role " + suffix + " " + index,
                            serviceNodeType,
                            null,
                            Set.of(),
                            Set.of())
                    .id());
        }
        return List.copyOf(result);
    }

    List<UUID> createBrandCandidates(Fixture existing, int count) {
        if (count < 1) throw new IllegalArgumentException("brand candidate count must be positive");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        List<UUID> result = new java.util.ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            OrganizationEntityReadback brand = entities.createEntity(
                    "BRAND",
                    existing.workspaceUuid(),
                    existing.groupWorkspaceKey(),
                    "acceptance-brand-" + suffix + "-" + String.format("%02d", index),
                    "Acceptance Brand " + suffix + " " + index,
                    null,
                    null,
                    Map.of());
            result.add(brand.id());
        }
        return List.copyOf(result);
    }

    List<UUID> createTenantCandidates(Fixture existing, int count) {
        if (count < 1) throw new IllegalArgumentException("tenant candidate count must be positive");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        List<UUID> result = new java.util.ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            OrganizationEntityReadback tenant = entities.createEntity(
                    "TENANT",
                    existing.workspaceUuid(),
                    existing.groupWorkspaceKey(),
                    "acceptance-tenant-" + suffix + "-" + String.format("%02d", index),
                    "Acceptance Tenant " + suffix + " " + index,
                    "Acceptance Tenant " + suffix + " " + index + " Ltd",
                    "91310000" + suffix + String.format("%02d", index),
                    Map.of());
            result.add(tenant.id());
        }
        return List.copyOf(result);
    }

    List<UUID> createStoreCandidates(Fixture existing, int count) {
        if (count < 1) throw new IllegalArgumentException("store candidate count must be positive");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        List<UUID> result = new java.util.ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            OrganizationEntityReadback store = entities.createStore(
                    existing.workspaceUuid(),
                    existing.groupWorkspaceKey(),
                    existing.projectId(),
                    existing.tenantId(),
                    existing.brandId(),
                    null,
                    "acceptance-store-" + suffix + "-" + String.format("%02d", index),
                    "Acceptance Store " + suffix + " " + index,
                    "Acceptance Store Notes",
                    Map.of());
            result.add(store.id());
        }
        return List.copyOf(result);
    }

    WorkspaceFixture workspaceOnly() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String key = "acceptance-platform-" + suffix;
        String name = "Acceptance platform workspace " + suffix;
        UUID workspaceUuid = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, ?, ?, 'Acceptance "
                        + "Operations', 'ENABLED', 1, 1, ?, ?, ?)",
                workspaceUuid,
                key,
                name,
                name.toLowerCase(java.util.Locale.ROOT),
                now,
                now,
                now);
        long workspaceId = jdbc.queryForObject(
                "SELECT id FROM platform_workspace.group_workspace WHERE group_workspace_key=?", Long.class, key);
        return new WorkspaceFixture(workspaceUuid, key, workspaceId);
    }

    void ensurePlatformAdministrator() {
        long named = count(
                "SELECT COUNT(*) FROM platform_iam.platform_admin WHERE login_name_normalized=?",
                PLATFORM_ADMIN_LOGIN.toLowerCase(java.util.Locale.ROOT));
        if (named == 1L) return;
        long existing = count("SELECT COUNT(*) FROM platform_iam.platform_admin");
        if (existing != 0L)
            throw new AssertionError(
                    "BUSINESS FIXTURE: isolated platform acceptance database already has an unknown administrator");
        platformBootstrap.bootstrapFirstAdministrator(
                PLATFORM_ADMIN_LOGIN, "Acceptance Platform Administrator", PLATFORM_ADMIN_PASSWORD.toCharArray());
    }

    Session platformLogin(ScenarioContext context) throws Exception {
        Response response = context.post(
                PLATFORM_PASSWORD_LOGIN,
                "/api/platform/auth/password-login",
                null,
                Map.of("accountName", PLATFORM_ADMIN_LOGIN, "password", PLATFORM_ADMIN_PASSWORD),
                Set.of(200));
        String cookie = response.http().headers().allValues("set-cookie").stream()
                .findFirst()
                .map(value -> value.substring(0, value.indexOf(';')))
                .orElseThrow();
        assertTrue(
                response.json().path("sessionId").isTextual(),
                "BUSINESS: platform password login returns a real platform session");
        return new Session(
                cookie, response.json(), response.json().path("sessionVersion").asLong());
    }

    void completeInvitation(ScenarioContext context, Fixture fixture) throws Exception {
        context.post(ACCEPT_PUBLIC_INVITATION, publicInvitationPath(fixture), null, Map.of(), Set.of(200));
        Response sent = context.post(
                SEND_PUBLIC_INVITATION_OTP,
                publicInvitationPath(fixture) + "/otp/send",
                null,
                Map.of("mobile", fixture.mobile()),
                Set.of(200));
        String code = sent.json().path("debugVerificationCode").asText();
        assertTrue(code.matches("[0-9]{6}"), "BUSINESS: managed OTP delivery exposes only the test code");
        Response verified = context.post(
                VERIFY_PUBLIC_INVITATION_OTP,
                publicInvitationPath(fixture) + "/otp/verify",
                null,
                Map.of("mobile", fixture.mobile(), "code", code),
                Set.of(200));
        context.post(
                SAVE_PUBLIC_INVITATION_CREDENTIALS,
                publicInvitationPath(fixture) + "/credentials",
                null,
                Map.of(
                        "verificationGrant",
                        verified.json().path("verificationGrant").asText(),
                        "userName",
                        "Acceptance Operator",
                        "loginName",
                        fixture.loginName(),
                        "password",
                        OPERATIONS_PASSWORD),
                Set.of(200));
        assertEquals(
                "COMPLETED",
                context.post(
                                COMPLETE_PUBLIC_INVITATION,
                                publicInvitationPath(fixture) + "/complete",
                                null,
                                Map.of(),
                                Set.of(200))
                        .json()
                        .path("status")
                        .asText(),
                "BUSINESS: fixture invitation is completed through HTTP");
    }

    Session login(ScenarioContext context, Fixture fixture) throws Exception {
        Response response = context.post(
                OPERATIONS_WORKSPACE_PASSWORD_LOGIN,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/password-login",
                null,
                Map.of("loginName", fixture.loginName(), "password", OPERATIONS_PASSWORD),
                Set.of(200));
        String cookie = response.http().headers().allValues("set-cookie").stream()
                .findFirst()
                .map(value -> value.substring(0, value.indexOf(';')))
                .orElseThrow();
        assertEquals(
                fixture.groupWorkspaceKey(),
                response.json().path("groupWorkspaceKey").asText(),
                "BUSINESS: login returns the requested workspace");
        return new Session(
                cookie, response.json(), response.json().path("contextVersion").asLong());
    }

    static String publicInvitationPath(Fixture fixture) {
        return "/api/public/invitations/" + fixture.groupWorkspaceKey() + "/" + fixture.invitationToken();
    }

    long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    void insertInventoryBomFixture(
            UUID dataNodeRef,
            UUID brandRef,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            List<Map<String, Object>> rows)
            throws Exception {
        long now = Instant.now().toEpochMilli();
        jdbc.update(
                "INSERT INTO inventory.stock_bom (bom_ref, data_node_ref, brand_ref, item_ref, product_sku_ref, "
                        + "option_value_ref, item_code, sku_code, option_value_code, version, rows, "
                        + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, 1, CAST(? AS JSONB), ?)",
                UUID.randomUUID(),
                dataNodeRef.toString(),
                brandRef.toString(),
                itemRef,
                productSkuRef,
                itemCode,
                skuCode,
                mapper.writeValueAsString(rows),
                now);
    }

    /** Raw blocker fixture for candidate revalidation cases; it deliberately bypasses catalog and owner commands. */
    void insertInventoryTargetFixture(
            UUID dataNodeRef,
            UUID brandRef,
            UUID targetRef,
            UUID itemRef,
            String itemCode,
            String consumptionUnitRef,
            String consumptionUnitCode,
            String consumptionUnitName,
            String consumptionUnitDimension,
            boolean componentEligible)
            throws Exception {
        long now = Instant.now().toEpochMilli();
        jdbc.update(
                "INSERT INTO inventory.stock_target ("
                        + "target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code,sku_code,"
                        + "measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,"
                        + "consumption_unit_name,consumption_unit_dimension,consumption_unit_precision,"
                        + "counting_unit_ref,counting_unit_code,counting_unit_name,counting_unit_dimension,"
                        + "counting_unit_precision,counting_unit_conversion_factor,component_eligible,"
                        + "configuration,balance,version,definition_status,created_at_epoch_millis,"
                        + "updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,NULL,?,NULL,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,?,?,'{}'::jsonb,"
                        + "0,1,'ENABLED',?,?)",
                targetRef,
                dataNodeRef.toString(),
                brandRef.toString(),
                itemRef,
                itemCode,
                "COUNTED",
                "DIRECT",
                consumptionUnitRef == null ? null : UUID.fromString(consumptionUnitRef),
                consumptionUnitCode,
                consumptionUnitName,
                consumptionUnitDimension,
                consumptionUnitRef == null ? null : 0,
                null,
                componentEligible,
                now,
                now);
    }

    void cancelInvitation(Fixture fixture) {
        invitations.cancel(fixture.workspaceUuid(), fixture.groupWorkspaceKey(), fixture.invitationId(), 1);
    }

    Map<String, Object> queryForMap(String sql, Object... args) {
        return jdbc.queryForMap(sql, args);
    }

    private void writeDiscovery(int discovered, int selected, String operation) {
        try {
            Files.writeString(
                    Path.of(requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RESULT)),
                    mapper.writeValueAsString(Map.of(
                                    "type",
                                    "discovery",
                                    "discovered",
                                    discovered,
                                    "selected",
                                    selected,
                                    "operation",
                                    operation))
                            + "\n",
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
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
        assertEquals(
                "remote",
                System.getenv(RuntimeEnvironmentKeys.V2S_TESTCONTAINERS_EXECUTION_PLANE),
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

    record RouteIdentity(String operationId, String routeTemplate) {}

    record Fixture(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID groupId,
            UUID regionId,
            UUID projectId,
            UUID brandId,
            UUID tenantId,
            UUID storeId,
            UUID headCompanyId,
            UUID invitationId,
            String invitationToken,
            String mobile,
            String loginName) {}

    record BrandCopyFixtures(Fixture source, Fixture target) {}

    record WorkspaceFixture(UUID workspaceUuid, String groupWorkspaceKey, long workspaceId) {}

    record Session(String cookie, JsonNode entry, long contextVersion) {}

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

        Response get(
                RouteIdentity route, String path, String cookie, Map<String, String> headers, Set<Integer> expected)
                throws Exception {
            return send(route, "GET", path, cookie, (String) null, null, headers, expected);
        }

        Response post(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "POST", path, cookie, mapper.writeValueAsString(body), null, expected);
        }

        Response post(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(route, "POST", path, cookie, mapper.writeValueAsString(body), null, headers, expected);
        }

        Response patch(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "PATCH", path, cookie, mapper.writeValueAsString(body), null, expected);
        }

        Response patch(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(route, "PATCH", path, cookie, mapper.writeValueAsString(body), null, headers, expected);
        }

        Response put(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "PUT", path, cookie, mapper.writeValueAsString(body), null, expected);
        }

        Response put(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(route, "PUT", path, cookie, mapper.writeValueAsString(body), null, headers, expected);
        }

        Response delete(RouteIdentity route, String path, String cookie, Set<Integer> expected) throws Exception {
            return send(route, "DELETE", path, cookie, (String) null, null, expected);
        }

        Response delete(
                RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "DELETE", path, cookie, mapper.writeValueAsString(body), null, expected);
        }

        Response multipartAsset(
                RouteIdentity route,
                Fixture fixture,
                String cookie,
                String dataNodeRef,
                String digest,
                Set<Integer> expected)
                throws Exception {
            return multipartAsset(route, fixture, cookie, dataNodeRef, digest, PNG, expected);
        }

        Response multipartAsset(
                RouteIdentity route,
                Fixture fixture,
                String cookie,
                String dataNodeRef,
                String digest,
                byte[] bytes,
                Set<Integer> expected)
                throws Exception {
            String boundary = "----backend-acceptance-" + UUID.randomUUID();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            writePart(content, boundary, "content", "acceptance.png", "image/png", bytes);
            content.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            String query = "?fileName=acceptance.png&mediaType=" + encode("image/png") + "&contentDigest="
                    + encode(digest) + "&dataNodeRef=" + encode(dataNodeRef);
            return send(
                    route,
                    "POST",
                    "/api/operations/catalog-inventory/assets/stage" + query,
                    cookie,
                    content.toByteArray(),
                    boundary,
                    expected);
        }

        Response multipartPlatformAsset(
                RouteIdentity route,
                String path,
                String cookie,
                String usage,
                String fileName,
                String mediaType,
                byte[] bytes,
                Set<Integer> expected)
                throws Exception {
            String boundary = "----backend-acceptance-" + UUID.randomUUID();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            writeTextPart(content, boundary, "usage", usage);
            writePart(content, boundary, "file", fileName, mediaType, bytes);
            content.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return send(route, "POST", path, cookie, content.toByteArray(), boundary, expected);
        }

        private Response send(
                RouteIdentity route,
                String method,
                String path,
                String cookie,
                String json,
                String boundary,
                Set<Integer> expected)
                throws Exception {
            byte[] body = json == null ? new byte[0] : json.getBytes(StandardCharsets.UTF_8);
            return send(route, method, path, cookie, body, boundary, Map.of(), expected);
        }

        private Response send(
                RouteIdentity route,
                String method,
                String path,
                String cookie,
                byte[] body,
                String boundary,
                Set<Integer> expected)
                throws Exception {
            return send(route, method, path, cookie, body, boundary, Map.of(), expected);
        }

        private Response send(
                RouteIdentity route,
                String method,
                String path,
                String cookie,
                String json,
                String boundary,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            byte[] body = json == null ? new byte[0] : json.getBytes(StandardCharsets.UTF_8);
            return send(route, method, path, cookie, body, boundary, headers, expected);
        }

        private Response send(
                RouteIdentity route,
                String method,
                String path,
                String cookie,
                byte[] body,
                String boundary,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            HttpRequest.BodyPublisher publisher = body.length == 0
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofByteArray(body);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                    .header("Accept", "application/json")
                    .header("X-Correlation-Id", correlationId)
                    .header(
                            "X-Backend-Acceptance-Run-Id",
                            requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID))
                    .header(
                            "X-Backend-Acceptance-Secret",
                            requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_SECRET))
                    .header("X-Backend-Acceptance-Operation-Id", route.operationId())
                    .header("X-Backend-Acceptance-Route-Template", route.routeTemplate())
                    .header("X-Request-Id", UUID.randomUUID().toString())
                    .method(method, publisher);
            if (cookie != null) builder.header("Cookie", cookie);
            if (boundary != null) builder.header("Content-Type", "multipart/form-data; boundary=" + boundary);
            else if (body.length > 0) builder.header("Content-Type", "application/json");
            if (!"GET".equals(method) && (headers == null || !headers.containsKey("Idempotency-Key")))
                builder.header("Idempotency-Key", "ba-" + UUID.randomUUID());
            if (headers != null) headers.forEach(builder::header);
            HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode bodyJson;
            try {
                bodyJson = response.body() == null || response.body().isBlank()
                        ? mapper.createObjectNode()
                        : mapper.readTree(response.body());
            } catch (Exception invalidJson) {
                bodyJson = mapper.createObjectNode();
            }
            Response result = new Response(
                    response.statusCode(), response.body() == null ? "" : response.body(), bodyJson, response);
            if (!expected.contains(result.status())) {
                contractPass = false;
                throw new AssertionError("CONTRACT: expected="
                        + expected
                        + " unexpected HTTP status="
                        + result.status()
                        + " problem="
                        + result.problemCode()
                        + " detail="
                        + result.json()
                                .path("detail")
                                .asText(result.json().path("message").asText("")));
            }
            return result;
        }

        private void pass() throws Exception {
            DatabaseOperationTracker.Snapshot snapshot = metricsSink.snapshotFor(correlationId);
            assertNotNull(snapshot, "DB operation observation is available for the completed HTTP scenario");
            writeResult(Map.of(
                    "operation",
                    scenario.id(),
                    "module",
                    scenario.module(),
                    "contract",
                    "PASS",
                    "business",
                    "PASS",
                    "businessMode",
                    "REAL",
                    "businessAssertion",
                    "HAND_WRITTEN_BUSINESS_ORACLE",
                    "dbOperations",
                    snapshot.count(),
                    "status",
                    "PASS"));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_RESULT SCENARIO=%s MODULE=%s CONTRACT=PASS BUSINESS=PASS DB_OPERATIONS=%d%n",
                    scenario.id(), scenario.module(), snapshot.count());
        }

        private void fail(Throwable failure) throws Exception {
            DatabaseOperationTracker.Snapshot snapshot = metricsSink.snapshotFor(correlationId);
            String category = failure instanceof AssertionError
                            && failure.getMessage() != null
                            && failure.getMessage().startsWith("CONTRACT")
                    ? "HTTP_CONTRACT"
                    : "BUSINESS_ORACLE";
            writeResult(Map.of(
                    "operation",
                    scenario.id(),
                    "module",
                    scenario.module(),
                    "contract",
                    contractPass ? "PASS" : "FAIL",
                    "business",
                    "FAIL",
                    "businessMode",
                    "REAL",
                    "businessAssertion",
                    "HAND_WRITTEN_BUSINESS_ORACLE",
                    "dbOperations",
                    snapshot == null ? 0 : snapshot.count(),
                    "status",
                    "FAIL",
                    "failureCategory",
                    category,
                    "failure",
                    compact(failure.getMessage())));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_RESULT SCENARIO=%s MODULE=%s CONTRACT=%s BUSINESS=FAIL DB_OPERATIONS=%d "
                            + "FAILURE_CATEGORY=%s%n",
                    scenario.id(),
                    scenario.module(),
                    contractPass ? "PASS" : "FAIL",
                    snapshot == null ? 0 : snapshot.count(),
                    category);
        }

        private void writeResult(Map<String, Object> result) throws Exception {
            Files.writeString(
                    Path.of(requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RESULT)),
                    mapper.writeValueAsString(result) + "\n",
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
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

    private static void writePart(
            ByteArrayOutputStream output,
            String boundary,
            String name,
            String fileName,
            String contentType,
            byte[] value)
            throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + fileName + "\"\r\n")
                .getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(value);
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private static void writeTextPart(ByteArrayOutputStream output, String boundary, String name, String value)
            throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        output.write("Content-Type: text/plain; charset=UTF-8\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        output.write(value.getBytes(StandardCharsets.UTF_8));
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private static String compact(String value) {
        if (value == null || value.isBlank()) return "UNKNOWN";
        String normalized = value.replaceAll("\\s+", "_").replaceAll("[\\r\\n]", "");
        return normalized.substring(0, Math.min(240, normalized.length()));
    }
}
