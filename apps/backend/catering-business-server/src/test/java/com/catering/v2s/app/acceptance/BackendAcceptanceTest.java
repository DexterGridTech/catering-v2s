package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.domain.generated.StoreOperatingRuleCatalog;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.runtime.RuntimeEnvironmentKeys;
import com.catering.v2s.platform.iam.api.PlatformDiagnosticBootstrap;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.net.Socket;
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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.context.support.StandardServletEnvironment;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real HTTP/Testcontainers business oracles; scenarios are discovered by the explicit Java domain catalog. */
@Testcontainers
@EnabledIfEnvironmentVariable(named = RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, matches = "\\S+")
@Execution(ExecutionMode.SAME_THREAD)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
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
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_INVITATION_CREATE = new RouteIdentity(
            "createOperationsWorkspaceGroupInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_INVITATION_CANCEL = new RouteIdentity(
            "cancelOperationsWorkspaceGroupInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/"
                    + "{invitationId}/cancel");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_INVITATION_REISSUE = new RouteIdentity(
            "reissueOperationsWorkspaceGroupInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/"
                    + "{invitationId}/reissue");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_INVITATIONS = new RouteIdentity(
            "getOperationsWorkspaceRegionInvitations",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_INVITATION_CREATE = new RouteIdentity(
            "createOperationsWorkspaceRegionInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_INVITATION_CANCEL = new RouteIdentity(
            "cancelOperationsWorkspaceRegionInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/"
                    + "{invitationId}/cancel");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_INVITATION_REISSUE = new RouteIdentity(
            "reissueOperationsWorkspaceRegionInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/"
                    + "{invitationId}/reissue");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_INVITATIONS = new RouteIdentity(
            "getOperationsWorkspaceProjectInvitations",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_INVITATION_CREATE = new RouteIdentity(
            "createOperationsWorkspaceProjectInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANCEL = new RouteIdentity(
            "cancelOperationsWorkspaceProjectInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/"
                    + "{invitationId}/cancel");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_INVITATION_REISSUE = new RouteIdentity(
            "reissueOperationsWorkspaceProjectInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/"
                    + "{invitationId}/reissue");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATIONS = new RouteIdentity(
            "getOperationsWorkspaceHeadCompanyInvitations",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CREATE = new RouteIdentity(
            "createOperationsWorkspaceHeadCompanyInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANCEL = new RouteIdentity(
            "cancelOperationsWorkspaceHeadCompanyInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/"
                    + "{invitationId}/cancel");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_REISSUE = new RouteIdentity(
            "reissueOperationsWorkspaceHeadCompanyInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/"
                    + "{invitationId}/reissue");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_INVITATIONS = new RouteIdentity(
            "getOperationsWorkspaceStoreInvitations",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_INVITATION_CREATE = new RouteIdentity(
            "createOperationsWorkspaceStoreInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_INVITATION_CANCEL = new RouteIdentity(
            "cancelOperationsWorkspaceStoreInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/"
                    + "{invitationId}/cancel");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_INVITATION_REISSUE = new RouteIdentity(
            "reissueOperationsWorkspaceStoreInvitation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/"
                    + "{invitationId}/reissue");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_INVITATION_CANDIDATES = new RouteIdentity(
            "getOperationsWorkspaceGroupInvitationCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations/candidates");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_INVITATION_CANDIDATES = new RouteIdentity(
            "getOperationsWorkspaceRegionInvitationCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/invitations/candidates");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANDIDATES = new RouteIdentity(
            "getOperationsWorkspaceProjectInvitationCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/candidates");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_INVITATION_CANDIDATES = new RouteIdentity(
            "getOperationsWorkspaceStoreInvitationCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/invitations/candidates");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_INVITATIONS = new RouteIdentity(
            "getOperationsWorkspaceGroupInvitations",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/invitations");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_USER = new RouteIdentity(
            "getOperationsWorkspaceGroupUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_USER = new RouteIdentity(
            "getOperationsWorkspaceStoreUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_USER_ACCOUNT = new RouteIdentity(
            "getOperationsWorkspaceGroupUserAccount",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/accounts/{accountId}");
    static final RouteIdentity OPERATIONS_WORKSPACE_GROUP_USER_REVOKE = new RouteIdentity(
            "revokeOperationsWorkspaceGroupUserAssignment",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user/assignments/"
                    + "{assignmentId}/revoke");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_USER = new RouteIdentity(
            "getOperationsWorkspaceRegionUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_USER_ACCOUNT = new RouteIdentity(
            "getOperationsWorkspaceRegionUserAccount",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/accounts/{accountId}");
    static final RouteIdentity OPERATIONS_WORKSPACE_REGION_USER_REVOKE = new RouteIdentity(
            "revokeOperationsWorkspaceRegionUserAssignment",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user/assignments/"
                    + "{assignmentId}/revoke");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_USER = new RouteIdentity(
            "getOperationsWorkspaceProjectUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_USER_ACCOUNT = new RouteIdentity(
            "getOperationsWorkspaceProjectUserAccount",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/accounts/{accountId}");
    static final RouteIdentity OPERATIONS_WORKSPACE_PROJECT_USER_REVOKE = new RouteIdentity(
            "revokeOperationsWorkspaceProjectUserAssignment",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user/assignments/"
                    + "{assignmentId}/revoke");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_USER = new RouteIdentity(
            "getOperationsWorkspaceHeadCompanyUser",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ACCOUNT = new RouteIdentity(
            "getOperationsWorkspaceHeadCompanyUserAccount",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/accounts/"
                    + "{accountId}");
    static final RouteIdentity OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_REVOKE = new RouteIdentity(
            "revokeOperationsWorkspaceHeadCompanyUserAssignment",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/user/assignments/"
                    + "{assignmentId}/revoke");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_USER_ACCOUNT = new RouteIdentity(
            "getOperationsWorkspaceStoreUserAccount",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/accounts/{accountId}");
    static final RouteIdentity OPERATIONS_WORKSPACE_STORE_USER_REVOKE = new RouteIdentity(
            "revokeOperationsWorkspaceStoreUserAssignment",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user/assignments/"
                    + "{assignmentId}/revoke");
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
    static final RouteIdentity OPERATIONS_ORGANIZATION_STORE_OPERATING_RULE = new RouteIdentity(
            "getOperationsOrganizationStoreOperatingRule",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores"
                    + "/{storeId}/operating-rule-switches"));
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_AREAS = new RouteIdentity(
            "getOperationsStoreServicePointAreas",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINTS = new RouteIdentity(
            "getOperationsStoreServicePoints",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-point-areas/{areaRef}/service-points"));
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT = new RouteIdentity(
            "getOperationsStoreServicePoint",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_AREA_CREATE = new RouteIdentity(
            "postOperationsStoreServicePointArea",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_AREA_UPDATE = new RouteIdentity(
            "patchOperationsStoreServicePointArea",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas/{areaRef}");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_AREA_STATUS = new RouteIdentity(
            "postOperationsStoreServicePointAreaStatus",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-point-areas/{areaRef}/status"));
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_AREA_ORDER = new RouteIdentity(
            "postOperationsStoreServicePointAreaOrder",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-point-areas/{areaRef}/order"));
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_CREATE = new RouteIdentity(
            "postOperationsStoreServicePoint",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-point-areas/{areaRef}/service-points"));
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_UPDATE = new RouteIdentity(
            "patchOperationsStoreServicePoint",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points/{servicePointRef}");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_STATUS = new RouteIdentity(
            "postOperationsStoreServicePointStatus",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-points/{servicePointRef}/status"));
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_ORDER = new RouteIdentity(
            "postOperationsStoreServicePointOrder",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-points/{servicePointRef}/order"));
    static final RouteIdentity OPERATIONS_STORE_QR_CONFIGURATION = new RouteIdentity(
            "getOperationsStoreQrConfiguration",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration");
    static final RouteIdentity OPERATIONS_STORE_QR_CONFIGURATION_UPDATE = new RouteIdentity(
            "patchOperationsStoreQrConfiguration",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-configuration");
    static final RouteIdentity OPERATIONS_STORE_QR_CHANNEL_CANDIDATES = new RouteIdentity(
            "getOperationsStoreQrChannelCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/qr-channel-candidates");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_ASSET_STAGE = new RouteIdentity(
            "stageStoreServicePointImage",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-assets/stage");
    static final RouteIdentity OPERATIONS_STORE_SERVICE_POINT_ASSET_RELEASE = new RouteIdentity(
            "releaseStagedStoreServicePointImage",
            ("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/s"
                    + "ervice-point-assets/stage/{assetRef}/release"));
    static final RouteIdentity OPERATIONS_STORE_TERMINALS = new RouteIdentity(
            "getOperationsStoreTerminals",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals");
    static final RouteIdentity OPERATIONS_STORE_TERMINAL = new RouteIdentity(
            "getOperationsStoreTerminal",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}");
    static final RouteIdentity OPERATIONS_STORE_TERMINAL_CREATE = new RouteIdentity(
            "postOperationsStoreTerminal",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals");
    static final RouteIdentity OPERATIONS_STORE_TERMINAL_UPDATE = new RouteIdentity(
            "putOperationsStoreTerminal",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}");
    static final RouteIdentity OPERATIONS_STORE_TERMINAL_STATUS = new RouteIdentity(
            "postOperationsStoreTerminalStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}/status");
    static final RouteIdentity OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES = new RouteIdentity(
            "getOperationsStoreTerminalAreaCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/area-candidates");
    static final RouteIdentity OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES = new RouteIdentity(
            "getOperationsStoreTerminalTagCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/tag-candidates");
    static final RouteIdentity TERMINAL_ACTIVATION = new RouteIdentity(
            "activateTerminal", "/api/terminal/group-workspaces/{groupWorkspaceKey}/activation", true);
    static final RouteIdentity TERMINAL_DEVICE_ACTIVATION_CANCEL = new RouteIdentity(
            "cancelTerminalActivation",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/terminals/{terminalRef}/activation/cancel",
            true);
    static final RouteIdentity TERMINAL_READ_STORE_BASIC = new RouteIdentity(
            "terminalReadStoreBasic",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/basic",
            true);
    static final RouteIdentity TERMINAL_READ_STORE_ORGANIZATION_PATH = new RouteIdentity(
            "terminalReadStoreOrganizationPath",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/organization-path",
            true);
    static final RouteIdentity TERMINAL_READ_STORE_ACTIVE_CONTRACTS = new RouteIdentity(
            "terminalReadStoreActiveContracts",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/contracts",
            true);
    static final RouteIdentity TERMINAL_READ_CONTRACT = new RouteIdentity(
            "terminalReadContract", "/api/terminal/group-workspaces/{groupWorkspaceKey}/contracts/{contractRef}", true);
    static final RouteIdentity TERMINAL_READ_STORE_SERVICE_POINT_AREAS = new RouteIdentity(
            "terminalReadStoreServicePointAreas",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas",
            true);
    static final RouteIdentity TERMINAL_READ_SERVICE_POINT_AREA = new RouteIdentity(
            "terminalReadServicePointArea",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/service-point-areas/{areaRef}",
            true);
    static final RouteIdentity TERMINAL_READ_STORE_SERVICE_POINTS = new RouteIdentity(
            "terminalReadStoreServicePoints",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points",
            true);
    static final RouteIdentity TERMINAL_READ_SERVICE_POINT = new RouteIdentity(
            "terminalReadServicePoint",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/service-points/{pointRef}",
            true);
    static final RouteIdentity OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL = new RouteIdentity(
            "cancelOperationsStoreTerminalActivation",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/terminals/{terminalRef}"
                    + "/activation/cancel");
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
    static final RouteIdentity OPERATIONS_PRODUCTION_TAG_STATUS = new RouteIdentity(
            "transitionOperationsProductionTagStatus",
            "/api/operations/catalog-inventory/production-tags/{tagCode}/status");
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
    static final String OPERATIONS_SALES_MENU_BASE =
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus";
    static final RouteIdentity OPERATIONS_SALES_MENUS =
            new RouteIdentity("getOperationsSalesMenus", OPERATIONS_SALES_MENU_BASE);
    static final RouteIdentity OPERATIONS_SALES_MENU =
            new RouteIdentity("getOperationsSalesMenu", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}");
    static final RouteIdentity OPERATIONS_SALES_MENU_DRAFT_SECTIONS = new RouteIdentity(
            "getOperationsSalesMenuDraftSections", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections");
    static final RouteIdentity OPERATIONS_SALES_MENU_DRAFT_ITEMS = new RouteIdentity(
            "getOperationsSalesMenuDraftItems",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections/{salesSectionRef}/items");
    static final RouteIdentity OPERATIONS_SALES_MENU_DRAFT_ITEM = new RouteIdentity(
            "getOperationsSalesMenuDraftItem",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/items/{salesItemRef}");
    static final RouteIdentity OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS = new RouteIdentity(
            "getOperationsSalesMenuPublishedSections",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/published/sections");
    static final RouteIdentity OPERATIONS_SALES_MENU_PUBLISHED_ITEMS = new RouteIdentity(
            "getOperationsSalesMenuPublishedItems",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/published/sections/{salesSectionRef}/items");
    static final RouteIdentity OPERATIONS_SALES_MENU_PUBLISHED_ITEM = new RouteIdentity(
            "getOperationsSalesMenuPublishedItem",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/published/items/{salesItemRef}");
    static final RouteIdentity OPERATIONS_SALES_MENU_CANDIDATES = new RouteIdentity(
            "getOperationsSalesMenuItemCandidates",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/item-candidates");
    static final RouteIdentity OPERATIONS_SALES_MENU_PREVIEW = new RouteIdentity(
            "getOperationsSalesMenuPublicationPreview",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/publication-preview");
    static final RouteIdentity OPERATIONS_SALES_MENU_RECORDS = new RouteIdentity(
            "getOperationsSalesMenuOperationRecords",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/sales-menu-operation-records");
    static final RouteIdentity OPERATIONS_SALES_MENU_CREATE =
            new RouteIdentity("createOperationsSalesMenu", OPERATIONS_SALES_MENU_BASE);
    static final RouteIdentity OPERATIONS_SALES_MENU_COPY =
            new RouteIdentity("copyOperationsSalesMenu", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/copies");
    static final RouteIdentity OPERATIONS_SALES_MENU_RENAME =
            new RouteIdentity("renameOperationsSalesMenu", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/name");
    static final RouteIdentity OPERATIONS_SALES_MENU_ARCHIVE =
            new RouteIdentity("archiveOperationsSalesMenu", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/archive");
    static final RouteIdentity OPERATIONS_SALES_MENU_ACTIVATION = new RouteIdentity(
            "setOperationsSalesMenuActivation",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/channels/{channelRef}/activation");
    static final RouteIdentity OPERATIONS_SALES_MENU_SCHEDULE = new RouteIdentity(
            "updateOperationsSalesMenuSchedule", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/schedule");
    static final RouteIdentity OPERATIONS_SALES_MENU_SECTION_CREATE = new RouteIdentity(
            "createOperationsSalesMenuSection", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections");
    static final RouteIdentity OPERATIONS_SALES_MENU_SECTION_RENAME = new RouteIdentity(
            "renameOperationsSalesMenuSection",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections/{salesSectionRef}/name");
    static final RouteIdentity OPERATIONS_SALES_MENU_SECTION_DELETE = new RouteIdentity(
            "deleteOperationsSalesMenuSection",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections/{salesSectionRef}");
    static final RouteIdentity OPERATIONS_SALES_MENU_SECTION_MOVE = new RouteIdentity(
            "moveOperationsSalesMenuSection",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections/{salesSectionRef}/move");
    static final RouteIdentity OPERATIONS_SALES_MENU_ITEMS_ADD = new RouteIdentity(
            "addOperationsSalesMenuItems",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/sections/{salesSectionRef}/items");
    static final RouteIdentity OPERATIONS_SALES_MENU_ITEM_UPDATE = new RouteIdentity(
            "updateOperationsSalesMenuItem", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/items/{salesItemRef}");
    static final RouteIdentity OPERATIONS_SALES_MENU_ITEM_DELETE = new RouteIdentity(
            "deleteOperationsSalesMenuItem", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/items/{salesItemRef}");
    static final RouteIdentity OPERATIONS_SALES_MENU_ITEM_MOVE = new RouteIdentity(
            "moveOperationsSalesMenuItem",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/items/{salesItemRef}/move");
    static final RouteIdentity OPERATIONS_SALES_MENU_PUBLISH = new RouteIdentity(
            "publishOperationsSalesMenu", OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/publications");
    static final RouteIdentity OPERATIONS_SALES_MENU_SOLD_OUT = new RouteIdentity(
            "setOperationsSalesMenuItemSoldOut",
            OPERATIONS_SALES_MENU_BASE
                    + "/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out");
    static final RouteIdentity OPERATIONS_SALES_MENU_RESTORE = new RouteIdentity(
            "restoreOperationsSalesMenuItemSale",
            OPERATIONS_SALES_MENU_BASE
                    + "/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore");
    static final RouteIdentity OPERATIONS_SALES_MENU_ASSET_STAGE = new RouteIdentity(
            "stageOperationsSalesMenuAsset",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage");
    static final RouteIdentity OPERATIONS_SALES_MENU_ASSET_RELEASE = new RouteIdentity(
            "releaseOperationsSalesMenuStagedAsset",
            OPERATIONS_SALES_MENU_BASE + "/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release");
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
    static final RouteIdentity PLATFORM_GROUP_WORKSPACE_STATUS = new RouteIdentity(
            "transitionPlatformGroupWorkspaceStatus", "/api/platform/group-workspaces/{groupWorkspaceKey}/status");
    static final RouteIdentity PLATFORM_AUDIT_HISTORY =
            new RouteIdentity("getPlatformEntityAuditHistory", "/api/platform/audit-history");
    static final RouteIdentity PLATFORM_TERMINAL_UPDATE_ARTIFACT_STAGE = new RouteIdentity(
            "stagePlatformTerminalUpdateArtifact",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifact-stages");
    static final RouteIdentity PLATFORM_TERMINAL_UPDATE_ARTIFACT_REGISTER = new RouteIdentity(
            "registerPlatformTerminalUpdateArtifact",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifacts");
    static final RouteIdentity PLATFORM_TERMINAL_UPDATE_ARTIFACT_RELEASE_STAGE = new RouteIdentity(
            "releasePlatformTerminalUpdateArtifactStage",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifact-stages/{stageRef}/release");
    static final RouteIdentity PLATFORM_TERMINAL_UPDATE_ARTIFACT_PAGE = new RouteIdentity(
            "getPlatformTerminalUpdateArtifactPage",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifacts");
    static final RouteIdentity PLATFORM_TERMINAL_UPDATE_ARTIFACT_DETAIL = new RouteIdentity(
            "getPlatformTerminalUpdateArtifactDetail",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/terminal-update-artifacts/{artifactRef}");
    static final RouteIdentity OPERATIONS_TERMINAL_UPDATE_RULE_CREATE = new RouteIdentity(
            "createOperationsProjectTerminalUpdateRule",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules");
    static final RouteIdentity OPERATIONS_TERMINAL_UPDATE_RULE_STATUS = new RouteIdentity(
            "changeOperationsProjectTerminalUpdateRuleStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules/{ruleRef}/status");
    static final RouteIdentity OPERATIONS_TERMINAL_UPDATE_RULE_PAGE = new RouteIdentity(
            "getOperationsProjectTerminalUpdateRulePage",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules");
    static final RouteIdentity OPERATIONS_TERMINAL_UPDATE_RULE_STORES = new RouteIdentity(
            "getOperationsProjectTerminalUpdateRuleStorePage",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules/{ruleRef}/stores");
    static final RouteIdentity OPERATIONS_TERMINAL_UPDATE_CANDIDATES = new RouteIdentity(
            "getOperationsTerminalUpdateArtifactCandidatePage",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/terminal-update-artifact-candidates");
    static final RouteIdentity OPERATIONS_TERMINAL_VERSION_PAGE = new RouteIdentity(
            "getOperationsProjectTerminalVersionPage",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions");
    static final RouteIdentity OPERATIONS_TERMINAL_VERSION_DETAIL = new RouteIdentity(
            "getOperationsProjectTerminalVersionDetail",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions/{terminalRef}");
    static final RouteIdentity TERMINAL_UPDATE_REPORT_SUBMIT = new RouteIdentity(
            "submitTerminalUpdateReport",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/update-reports");
    static final RouteIdentity OPERATIONS_TERMINAL_UPDATE_REPORT_HISTORY = new RouteIdentity(
            "getOperationsProjectTerminalUpdateReportHistoryPage",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-versions/{terminalRef}/update-reports");
    static final RouteIdentity TERMINAL_UPDATE_RULE_SNAPSHOT = new RouteIdentity(
            "terminalReadProjectUpdateRuleSnapshotPage",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/update-rules/projects/{projectRef}", true);
    static final RouteIdentity TERMINAL_UPDATE_DOWNLOAD_GRANT = new RouteIdentity(
            "issueTerminalUpdateArtifactDownloadGrant",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/update-artifacts/{artifactRef}/download-grant", true);
    static final RouteIdentity TERMINAL_UPDATE_ARTIFACT_CONTENT = new RouteIdentity(
            "downloadTerminalUpdateArtifact",
            "/api/terminal/group-workspaces/{groupWorkspaceKey}/update-artifacts/{artifactRef}/content", true);
    static final RouteIdentity OPERATIONS_AUDIT_HISTORY =
            new RouteIdentity("getOperationsEntityAuditHistory", "/api/operations/audit-history");
    static final RouteIdentity PLATFORM_ORGANIZATION_OVERVIEW = new RouteIdentity(
            "getPlatformOrganizationOverviewPage",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview");
    static final RouteIdentity PLATFORM_ORGANIZATION_HIERARCHY = new RouteIdentity(
            "getPlatformOrganizationHierarchyTree",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy");
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
    static final RouteIdentity PLATFORM_WORKSPACE_ACCOUNT = new RouteIdentity(
            "getWorkspaceAccount", "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}");
    static final RouteIdentity PLATFORM_WORKSPACE_ACCOUNT_STATUS = new RouteIdentity(
            "transitionWorkspaceAccountStatus",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status");
    static final RouteIdentity PLATFORM_WORKSPACE_INVITATION = new RouteIdentity(
            "getWorkspaceInvitation", "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}");
    static final RouteIdentity PLATFORM_WORKSPACE_INVITATION_CREATE = new RouteIdentity(
            "createWorkspaceInvitation", "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations");
    static final RouteIdentity PLATFORM_WORKSPACE_INVITATION_CANCEL = new RouteIdentity(
            "cancelWorkspaceInvitation",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel");
    static final RouteIdentity PLATFORM_WORKSPACE_INVITATION_REISSUE = new RouteIdentity(
            "reissueWorkspaceInvitation",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue");
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
    static final GenericContainer<?> DORIS = new GenericContainer<>("apache/doris:all-in-one-4.1.3")
            .withExposedPorts(9030, 8040)
            .waitingFor(Wait.forHealthcheck())
            .withStartupTimeout(Duration.ofMinutes(2));

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
    private ConfigurableApplicationContext acceptanceApplicationContext;

    @Autowired
    ObjectMapper mapper;

    @LocalServerPort
    private int port;

    private ConfigurableApplicationContext secondBusinessContext;
    private int secondBusinessPort;
    private TdsAcceptanceProcess tdsAcceptanceProcess;
    private TdsAcceptanceProcess.DorisConfiguration tdsDorisConfiguration;
    private DorisStalledEndpoint dorisStalledEndpoint;
    private boolean registrationRaceRedControlCaught;

    int secondBusinessPort() {
        return secondBusinessPort;
    }

    int primaryBusinessPort() {
        return port;
    }

    private static TdsAcceptanceProcess.DorisConfiguration initializeDorisHistoryTable() throws Exception {
        awaitDorisBackendHddStorage(Duration.ofSeconds(45));
        Path ddlPath = AcceptanceRepositoryPaths.resolveRegularFile(
                "scripts/dev/doris/connection-history.sql",
                "BACKEND_ACCEPTANCE_DORIS_DDL_MISSING",
                "BACKEND_ACCEPTANCE_DORIS_DDL_REPOSITORY_ESCAPE");
        runDorisSql(Files.readString(ddlPath, StandardCharsets.UTF_8));

        String username = "tds_history_writer";
        String password = UUID.randomUUID().toString().replace("-", "");
        runDorisSql("CREATE USER IF NOT EXISTS '" + username + "' IDENTIFIED BY '" + password + "';\n"
                + "GRANT LOAD_PRIV ON terminal_connection_history.connection_history TO '" + username + "';\n");
        String grants = runDorisSql("SHOW GRANTS FOR '" + username + "';\n");
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS_GRANT_READBACK user=[REDACTED] result=%s%n",
                safeDorisSqlDiagnostic(grants.replace(username, "[USER]"), ""));
        String normalizedGrants = grants.toLowerCase(java.util.Locale.ROOT);
        String tableLoadGrant = "internal.terminal_connection_history.connection_history: load_priv";
        int loadGrantIndex = normalizedGrants.indexOf("load_priv");
        assertTrue(
                normalizedGrants.contains(tableLoadGrant)
                        && loadGrantIndex >= 0
                        && loadGrantIndex == normalizedGrants.lastIndexOf("load_priv"),
                "BACKEND_ACCEPTANCE_DORIS_TABLE_LOAD_GRANT_MISSING_OR_GLOBAL_LOAD_PRESENT");

        String endpoint = "http://" + DORIS.getHost() + ":" + DORIS.getMappedPort(8040);
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS stage=READY image=apache/doris:all-in-one-4.1.3 "
                        + "endpointHost=%s endpointPort=%d grant=TABLE_LOAD_ONLY password=REDACTED%n",
                DORIS.getHost(), DORIS.getMappedPort(8040));
        return new TdsAcceptanceProcess.DorisConfiguration(endpoint, username, password);
    }

    static String runDorisSql(String sql) throws Exception {
        return runDorisSql(sql, true);
    }

    static String runDorisSql(String sql, boolean logSuccess) throws Exception {
        String encoded = Base64.getEncoder().encodeToString(sql.getBytes(StandardCharsets.UTF_8));
        org.testcontainers.containers.Container.ExecResult result = DORIS.execInContainer(
                "bash",
                "-lc",
                "printf '%s' '" + encoded + "' | base64 -d | mysql --batch --skip-column-names "
                        + "-h127.0.0.1 -P9030 -uroot");
        String stage = dorisSqlStage(sql);
        if (result.getExitCode() != 0) {
            String stdout = safeDorisSqlDiagnostic(result.getStdout(), sql);
            String stderr = safeDorisSqlDiagnostic(result.getStderr(), sql);
            String diagnostics = stage.equals("OPERATIONAL_DDL") ? dorisOperationalDiagnostics() : "not-captured";
            System.out.printf(
                    "BACKEND_ACCEPTANCE_DORIS_SQL status=FAIL stage=%s exitCode=%d " + "stdout=%s stderr=%s%n",
                    stage, result.getExitCode(), stdout, stderr);
            System.out.printf("BACKEND_ACCEPTANCE_DORIS_DIAGNOSTICS stage=%s details=%s%n", stage, diagnostics);
            throw new IllegalStateException("BACKEND_ACCEPTANCE_DORIS_SQL_FAILED stage=" + stage
                    + " exitCode=" + result.getExitCode()
                    + " stdout=" + stdout
                    + " stderr=" + stderr
                    + " diagnostics=" + diagnostics);
        }
        if (logSuccess) {
            System.out.printf("BACKEND_ACCEPTANCE_DORIS_SQL stage=%s status=PASS exitCode=0%n", stage);
        }
        return result.getStdout();
    }

    private static void awaitDorisBackendHddStorage(Duration timeout) throws Exception {
        long startedAt = System.nanoTime();
        long deadline = startedAt + timeout.toNanos();
        String backendId = "";
        String disks = "";
        while (System.nanoTime() < deadline) {
            String backends = runDorisSql("SHOW BACKENDS;\n", false);
            backendId = backends.lines()
                    .map(String::strip)
                    .filter(line -> !line.isEmpty())
                    .map(line -> line.split("\\t", 2)[0])
                    .filter(value -> value.matches("[0-9]+"))
                    .findFirst()
                    .orElse("");
            if (!backendId.isEmpty()) {
                disks = runDorisSql("SHOW PROC '/backends/" + backendId + "';\n", false);
                if (disks.toUpperCase(java.util.Locale.ROOT).contains("HDD")) {
                    long elapsedMillis =
                            Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
                    System.out.printf(
                            "BACKEND_ACCEPTANCE_DORIS_BACKEND_STORAGE status=READY backendId=%s "
                                    + "medium=HDD elapsedMs=%d%n",
                            backendId, elapsedMillis);
                    return;
                }
            }
            Thread.sleep(500);
        }
        String backendOutput = safeDorisSqlDiagnostic(backendId, "");
        String diskOutput = safeDorisSqlDiagnostic(disks, "");
        System.out.printf(
                "BACKEND_ACCEPTANCE_DORIS_BACKEND_STORAGE status=TIMEOUT timeoutMs=%d "
                        + "backendId=%s diskReport=%s%n",
                timeout.toMillis(), backendOutput, diskOutput);
        throw new IllegalStateException("BACKEND_ACCEPTANCE_DORIS_BACKEND_HDD_STORAGE_TIMEOUT");
    }

    private static String dorisSqlStage(String sql) {
        String statement = sql.stripLeading().toUpperCase(java.util.Locale.ROOT);
        if (statement.startsWith("CREATE DATABASE") || statement.startsWith("CREATE TABLE")) return "OPERATIONAL_DDL";
        if (statement.startsWith("CREATE USER") || statement.startsWith("GRANT LOAD")) return "TABLE_WRITER_GRANT";
        if (statement.startsWith("SHOW GRANTS")) return "TABLE_WRITER_GRANT_READBACK";
        if (statement.startsWith("SELECT")) return "HISTORY_SQL_READBACK";
        return "OTHER_SQL";
    }

    private static String safeDorisSqlDiagnostic(String output, String sql) {
        String safe = output == null ? "" : output;
        if (sql != null && !sql.isEmpty()) safe = safe.replace(sql, "[SQL_REDACTED]");
        safe = safe.replaceAll("(?i)(IDENTIFIED\\s+BY\\s+)'[^']*'", "$1'REDACTED'");
        safe = safe.replaceAll("(?<!\\d)(?:\\d{1,3}\\.){3}\\d{1,3}(?!\\d)", "[IP]");
        safe = safe.replaceAll("[\\r\\n\\t]+", " ").replaceAll("\\s{2,}", " ").trim();
        return safe.length() <= 3500 ? safe : safe.substring(0, 3500);
    }

    private static String dorisOperationalDiagnostics() {
        String command = "printf 'BE_STORAGE_DIRECTORY '; "
                + "if test -d /opt/apache-doris/be/storage; then "
                + "printf 'exists=true writable='; "
                + "test -w /opt/apache-doris/be/storage && echo true || echo false; "
                + "stat -c 'mode=%a uid=%u gid=%g' /opt/apache-doris/be/storage; "
                + "df -Pk /opt/apache-doris/be/storage | "
                + "awk 'NR==2 {printf \"total_kib=%s available_kib=%s\\n\", $2, $4}'; "
                + "else echo exists=false; fi; "
                + "printf 'BE_PROCESS '; "
                + "ps -eo uid=,gid=,pid=,comm=,args= | grep -E '[d]oris_be' | head -n 3 || true; "
                + "printf 'BE_STORAGE_ENTRIES '; "
                + "find /opt/apache-doris/be/storage -maxdepth 1 -mindepth 1 "
                + "-printf '%m %u:%g %f ' 2>/dev/null | head -c 500; echo; "
                + "printf 'BE_STORAGE_CONFIG '; "
                + "grep -E '^storage_root_path=' /opt/apache-doris/be/conf/be.conf || echo default; "
                + "printf 'SHOW_BACKENDS_BEGIN\\n'; "
                + "mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot "
                + "-e 'SHOW BACKENDS' 2>&1; "
                + "printf 'SHOW_BACKENDS_END\\n'; "
                + "printf 'BE_STORAGE_LOG_BEGIN\\n'; "
                + "grep -Ei 'storage_root_path|data_dir|storage engine|path:|not exist|permission|failed|error|warn' "
                + "/opt/apache-doris/be/log/be.INFO 2>/dev/null | tail -n 8 || true; "
                + "printf 'BE_STORAGE_LOG_END\\n'";
        try {
            org.testcontainers.containers.Container.ExecResult diagnostic =
                    DORIS.execInContainer("bash", "-lc", command);
            String output = safeDorisSqlDiagnostic(diagnostic.getStdout() + " " + diagnostic.getStderr(), "");
            return "exitCode=" + diagnostic.getExitCode() + " output=" + output;
        } catch (Exception failure) {
            return "unavailable=" + failure.getClass().getSimpleName();
        }
    }

    @BeforeAll
    void startSecondBusinessContextAndProveSharedTopology() throws Exception {
        requireRemoteExecution();
        System.out.printf(
                "BACKEND_ACCEPTANCE_TOPOLOGY stage=SECOND_BUSINESS_CONTEXT_START runId=%s%n",
                requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID));

        StandardServletEnvironment environment = new StandardServletEnvironment();
        Map<String, Object> properties = new java.util.LinkedHashMap<>();
        acceptancePropertySuppliers().forEach((name, value) -> properties.put(name, value.get()));
        properties.put("spring.flyway.enabled", false);
        properties.put("server.port", 0);
        environment.getPropertySources().addFirst(new MapPropertySource("backendAcceptanceSecondContext", properties));
        secondBusinessContext = new SpringApplicationBuilder(CateringV2sApplication.class)
                .environment(environment)
                .profiles("backend-acceptance-secondary")
                .web(WebApplicationType.SERVLET)
                .run();

        assertTrue(
                secondBusinessContext instanceof WebServerApplicationContext,
                "BACKEND_ACCEPTANCE_SECOND_CONTEXT_NOT_WEB_SERVER");
        WebServerApplicationContext secondWebContext = (WebServerApplicationContext) secondBusinessContext;
        secondBusinessPort = secondWebContext.getWebServer().getPort();
        assertTrue(port > 0, "BACKEND_ACCEPTANCE_PRIMARY_BUSINESS_PORT_MISSING");
        assertTrue(secondBusinessPort > 0, "BACKEND_ACCEPTANCE_SECOND_BUSINESS_PORT_MISSING");
        assertNotEquals(port, secondBusinessPort, "BACKEND_ACCEPTANCE_BUSINESS_PORTS_NOT_DISTINCT");
        assertEquals(
                1,
                acceptanceApplicationContext
                        .getBeansOfType(BackendAcceptanceDatabaseMetricsSink.class)
                        .size(),
                "BACKEND_ACCEPTANCE_PRIMARY_METRICS_SINK_COUNT_INVALID");
        assertEquals(
                1,
                acceptanceApplicationContext
                        .getBeansOfType(DatabaseOperationTracker.MeasurementSinkRegistration.class)
                        .size(),
                "BACKEND_ACCEPTANCE_PRIMARY_METRICS_REGISTRATION_COUNT_INVALID");
        assertTrue(
                secondBusinessContext
                        .getBeansOfType(BackendAcceptanceDatabaseMetricsSink.class)
                        .isEmpty(),
                "BACKEND_ACCEPTANCE_SECOND_CONTEXT_INSTALLED_METRICS_SINK");
        assertTrue(
                secondBusinessContext
                        .getBeansOfType(DatabaseOperationTracker.MeasurementSinkRegistration.class)
                        .isEmpty(),
                "BACKEND_ACCEPTANCE_SECOND_CONTEXT_REPLACED_METRICS_SINK");
        assertTrue(
                secondBusinessContext
                        .getBeansOfType(org.flywaydb.core.Flyway.class)
                        .isEmpty(),
                "BACKEND_ACCEPTANCE_SECOND_CONTEXT_RAN_FLYWAY");

        String tdsContractScenario = System.getenv(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO);
        if (TdsAcceptanceProcess.TdsStartConfiguration.HISTORY_OUTAGE_BOUNDED_SCENARIO_ID.equals(tdsContractScenario)) {
            String runId = requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID);
            dorisStalledEndpoint = DorisStalledEndpoint.start(runId);
            tdsDorisConfiguration = new TdsAcceptanceProcess.DorisConfiguration(
                    dorisStalledEndpoint.endpoint(), "acceptance", "acceptance-stalled-load");
        } else {
            tdsDorisConfiguration = initializeDorisHistoryTable();
        }
        tdsAcceptanceProcess = TdsAcceptanceProcess.start(
                POSTGRES,
                tdsDorisConfiguration,
                TdsAcceptanceProcess.TdsStartConfiguration.forContractScenario(tdsContractScenario));
        if ("true".equals(System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"))) {
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT stage=START runId=%s operation=%s%n",
                    requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID),
                    System.getenv(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION));
            registrationRaceRedControlCaught = TerminalConnectionContractScenarios.topologyPreflightWithTenSecondOutage(
                    this, tdsAcceptanceProcess, Boolean.getBoolean("v2s.acceptance.registration-race-red-control"));
        }

        Fixture sharedFixture = fixture("REGION", Set.of());
        String path = publicInvitationPath(sharedFixture);
        ScenarioContext primaryProbe = new ScenarioContext(null, "performance.normal-path", port);
        ScenarioContext secondaryProbe = new ScenarioContext(null, "performance.normal-path", secondBusinessPort);
        Response primaryResponse = primaryProbe.get(PUBLIC_INVITATION_VIEW, path, null, Set.of(200));
        Response secondaryResponse = secondaryProbe.get(PUBLIC_INVITATION_VIEW, path, null, Set.of(200));
        assertEquals(
                "REGION", primaryResponse.json().path("targetOrganizationType").asText());
        assertEquals(
                "REGION",
                secondaryResponse.json().path("targetOrganizationType").asText());
        assertNotNull(metricsSink.snapshotFor(primaryProbe.correlationId));
        assertNotNull(metricsSink.snapshotFor(secondaryProbe.correlationId));
        assertEquals(1, metricsSink.observationCountFor(primaryProbe.correlationId));
        assertEquals(1, metricsSink.observationCountFor(secondaryProbe.correlationId));
        System.out.printf(
                ("BACKEND_ACCEPTANCE_TOPOLOGY stage=BUSINESS_CONTEXTS status=PASS primaryP"
                        + "ort=%d secondaryPort=%d sharedRead=PASS primarySinkObservations=1 second"
                        + "arySinkObservations=1 secondContextSinkRegistrations=0 runId=%s%n"),
                port,
                secondBusinessPort,
                requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID));
    }

    TdsAcceptanceProcess startAdditionalTds(String instanceName, String nodeId) throws Exception {
        assertNotNull(tdsDorisConfiguration, "BACKEND_ACCEPTANCE_DORIS_CONFIGURATION_NOT_INITIALIZED");
        assertNotNull(nodeId, "BACKEND_ACCEPTANCE_TDS_NODE_ID_REQUIRED");
        return TdsAcceptanceProcess.start(
                POSTGRES,
                tdsDorisConfiguration,
                instanceName,
                new TdsAcceptanceProcess.TdsStartConfiguration(nodeId, null));
    }

    @AfterAll
    void closeSecondBusinessContext() throws Exception {
        Exception cleanupFailure = null;
        try {
            if (dorisStalledEndpoint != null) dorisStalledEndpoint.close();
        } catch (Exception failure) {
            cleanupFailure = failure;
        } finally {
            try {
                if (tdsAcceptanceProcess != null) tdsAcceptanceProcess.close();
            } catch (Exception failure) {
                if (cleanupFailure == null) cleanupFailure = failure;
                else cleanupFailure.addSuppressed(failure);
            } finally {
                try {
                    if (secondBusinessContext != null) secondBusinessContext.close();
                } catch (Exception failure) {
                    if (cleanupFailure == null) cleanupFailure = failure;
                    else cleanupFailure.addSuppressed(failure);
                }
            }
        }
        try {
            TerminalUpdateAcceptanceFixtures.cleanup();
        } catch (Exception failure) {
            if (cleanupFailure == null) cleanupFailure = failure;
            else cleanupFailure.addSuppressed(failure);
        }
        if (cleanupFailure != null) throw cleanupFailure;
    }

    @TestFactory
    @Order(1)
    Stream<DynamicTest> terminalConnectionTopologyContractProbe() {
        if (selectedTdsContractScenario() != null) return Stream.empty();
        return Stream.of(DynamicTest.dynamicTest(
                "terminal.connection.vs1.database-only-configuration-startup",
                () -> TerminalConnectionContractScenarios.topologyProbe(this, tdsAcceptanceProcess)));
    }

    @TestFactory
    @Order(2)
    Stream<DynamicTest> terminalConnectionAdmissionContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v1AdmissionScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(3)
    Stream<DynamicTest> terminalConnectionHeartbeatContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v3HeartbeatScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(4)
    Stream<DynamicTest> terminalConnectionSessionOwnershipContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v4SessionOwnershipScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(5)
    Stream<DynamicTest> terminalConnectionLatestStateContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v6LatestStateScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(6)
    Stream<DynamicTest> terminalConnectionThroughputContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        boolean vs8Diagnostic = "true".equals(System.getenv("V2S_BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC"));
        if (vs8Diagnostic && !"storeTerminalActivationBusinessPrecedence".equals(selectedOperation)) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_VS8_DIAGNOSTIC_OPERATION_MISMATCH");
        }
        if (!vs8Diagnostic) return Stream.empty();
        return TerminalConnectionContractScenarios.v8HeartbeatBoundsScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(13)
    Stream<DynamicTest> selectedTerminalConnectionContracts() {
        String selectedScenario = selectedTdsContractScenario();
        if (selectedScenario == null) return Stream.empty();
        assertEquals(
                "storeTerminalActivationBusinessPrecedence",
                System.getenv(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION),
                "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_OPERATION_INVALID");
        if (TdsAcceptanceProcess.TdsStartConfiguration.VS15_CONTRACT_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "true",
                    System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_REQUIRED");
            return TerminalConnectionContractScenarios.v15ReadinessWithdrawalScenarios(this, tdsAcceptanceProcess);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.HISTORY_SECRET_SEARCH_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "false",
                    System.getenv().getOrDefault("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT", "false"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_FORBIDDEN");
            return TerminalConnectionContractScenarios.v11SecretSearchScenarios(this, tdsAcceptanceProcess);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.HISTORY_RECORDS_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "true",
                    System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_REQUIRED");
            return TerminalConnectionContractScenarios.connectionHistoryScenarios(this, tdsAcceptanceProcess);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.HISTORY_OUTAGE_BOUNDED_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "false",
                    System.getenv().getOrDefault("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT", "false"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_FORBIDDEN");
            assertNotNull(dorisStalledEndpoint, "BACKEND_ACCEPTANCE_DORIS_STALL_ENDPOINT_MISSING");
            return TerminalConnectionContractScenarios.connectionHistoryOutageScenarios(
                    this, tdsAcceptanceProcess, dorisStalledEndpoint);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.VS13_CROSS_NODE_RECOVERY_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "true",
                    System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_REQUIRED");
            return TerminalConnectionContractScenarios.crossNodeRecoveryScenarios(this, tdsAcceptanceProcess);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.TOPIC_SUBSCRIPTION_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "true",
                    System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_REQUIRED");
            return TerminalConnectionContractScenarios.topicSubscriptionScenarios(this, tdsAcceptanceProcess);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.TERMINAL_UPDATE_TOPIC_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "true",
                    System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_REQUIRED");
            return TerminalConnectionContractScenarios.terminalUpdateTopicScenarios(this, tdsAcceptanceProcess);
        }
        if (TdsAcceptanceProcess.TdsStartConfiguration.REMOTE_COMMAND_SCENARIO_ID.equals(selectedScenario)) {
            assertEquals(
                    "true",
                    System.getenv("V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT"),
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_TOPOLOGY_PREFLIGHT_REQUIRED");
            return TerminalConnectionContractScenarios.remoteCommandScenarios(this, tdsAcceptanceProcess);
        }
        throw new IllegalArgumentException("BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO_UNKNOWN");
    }

    <T> T acceptanceBean(Class<T> beanType) {
        return acceptanceApplicationContext.getBean(beanType);
    }

    @TestFactory
    @Order(14)
    Stream<DynamicTest> terminalConnectionGracefulShutdownContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v9GracefulShutdownScenarios(this, tdsAcceptanceProcess);
    }

    private static String selectedTdsContractScenario() {
        String selected = System.getenv(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_SCENARIO);
        return selected == null || selected.isBlank() ? null : selected;
    }

    @TestFactory
    @Order(7)
    Stream<DynamicTest> terminalConnectionSecretSearchContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v11SecretSearchScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(8)
    Stream<DynamicTest> terminalConnectionAuthenticationContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v2AuthenticationScenarios(this, tdsAcceptanceProcess);
    }

    @Test
    void registrationRaceRedControlMutationMustBeCaught() {
        if (!Boolean.getBoolean("v2s.acceptance.registration-race-red-control")) return;
        assertFalse(registrationRaceRedControlCaught, "TDS_REGISTRATION_RACE_PENDING_GENERATION_MUTATION_NOT_CAUGHT");
    }

    @Test
    void terminalConnectionGracefulShutdownRunsAfterEveryOtherTdsContractFactory() {
        List<java.lang.reflect.Method> contractFactories = Arrays.stream(
                        BackendAcceptanceTest.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(TestFactory.class))
                .filter(method -> method.getName().startsWith("terminalConnection"))
                .toList();
        java.lang.reflect.Method gracefulShutdown = contractFactories.stream()
                .filter(method -> method.getName().equals("terminalConnectionGracefulShutdownContracts"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TDS_GRACEFUL_SHUTDOWN_FACTORY_MISSING"));
        Order gracefulShutdownOrder = gracefulShutdown.getAnnotation(Order.class);
        assertNotNull(gracefulShutdownOrder, "TDS_GRACEFUL_SHUTDOWN_ORDER_MISSING");
        for (java.lang.reflect.Method contractFactory : contractFactories) {
            Order order = contractFactory.getAnnotation(Order.class);
            assertNotNull(order, "TDS_CONTRACT_FACTORY_ORDER_MISSING:" + contractFactory.getName());
            if (contractFactory != gracefulShutdown) {
                assertTrue(
                        order.value() < gracefulShutdownOrder.value(),
                        "TDS_GRACEFUL_SHUTDOWN_FACTORY_MUST_RUN_LAST:" + contractFactory.getName());
            }
        }
    }

    @TestFactory
    @Order(9)
    Stream<DynamicTest> terminalConnectionRevocationRaceContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.v10RevocationScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(10)
    Stream<DynamicTest> terminalConnectionCompressionContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        boolean d46Focused = "true".equals(System.getenv("V2S_BACKEND_ACCEPTANCE_D46_FOCUSED"));
        if (!"all".equals(selectedOperation) && !d46Focused) return Stream.empty();
        return TerminalConnectionContractScenarios.v14Scenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(11)
    Stream<DynamicTest> terminalConnectionForwardCompatibleMessageContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        if (!"all".equals(selectedOperation)) return Stream.empty();
        return TerminalConnectionContractScenarios.forwardCompatibleMessageFieldScenarios(this, tdsAcceptanceProcess);
    }

    @TestFactory
    @Order(12)
    Stream<DynamicTest> terminalConnectionDatabaseOutageContracts() {
        String selectedOperation =
                System.getenv().getOrDefault(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION, "all");
        boolean v12Diagnostic = "true".equals(System.getenv("V2S_BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC"));
        if (v12Diagnostic && !"storeTerminalActivationBusinessPrecedence".equals(selectedOperation)) {
            throw new IllegalStateException("BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC_OPERATION_MISMATCH");
        }
        if (!"all".equals(selectedOperation) && !v12Diagnostic) return Stream.empty();
        if (v12Diagnostic) {
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TDS_CONTRACT_SELECTION operation=%s diagnostic=V-S12-30s%n", selectedOperation);
            return TerminalConnectionContractScenarios.v12DatabaseOutage30SecondDiagnostic(this, tdsAcceptanceProcess);
        }
        return TerminalConnectionContractScenarios.v12DatabaseOutageScenarios(this, tdsAcceptanceProcess);
    }

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        // Spring may resolve the datasource and object-storage ports while it parses auto-configuration,
        // before the JUnit Testcontainers extension reaches its before-all callback.
        if (!POSTGRES.isRunning()) POSTGRES.start();
        if (!MINIO.isRunning()) MINIO.start();
        acceptancePropertySuppliers().forEach((name, value) -> registry.add(name, value::get));
    }

    private static Map<String, Supplier<?>> acceptancePropertySuppliers() {
        return Map.ofEntries(
                Map.entry("spring.datasource.url", POSTGRES::getJdbcUrl),
                Map.entry("spring.datasource.username", POSTGRES::getUsername),
                Map.entry("spring.datasource.password", POSTGRES::getPassword),
                Map.entry("platform.iam.rate-limit-hmac-secret", () -> PLATFORM_RATE_LIMIT_HMAC),
                Map.entry("workspace-iam.rate-limit-hmac-secret", () -> WORKSPACE_RATE_LIMIT_HMAC),
                Map.entry("catering.asset.object-storage.endpoint", BackendAcceptanceTest::objectStorageEndpoint),
                Map.entry("catering.asset.object-storage.access-key", () -> OBJECT_STORAGE_ACCESS_KEY),
                Map.entry("catering.asset.object-storage.secret-key", () -> OBJECT_STORAGE_SECRET_KEY),
                Map.entry("catering.asset.object-storage.bucket", () -> OBJECT_STORAGE_BUCKET),
                Map.entry("catering.asset.object-storage.object-prefix", () -> "acceptance/"),
                Map.entry("catering.asset.terminal-update.private-bucket", () -> "catering-v2s-terminal-update-private"),
                Map.entry("catering.asset.terminal-update.private-object-prefix", () -> "acceptance/"),
                Map.entry("catering.terminal-update.android-build-tools-directory",
                        () -> TerminalUpdateAcceptanceFixtures.androidBuildToolsDirectory().toString()),
                Map.entry("catering.asset.public-base-url", BackendAcceptanceTest::objectStorageEndpoint));
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
        assertTrue(discovered.size() > 0, "backend acceptance must discover at least one scenario");
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
     * Runs only when the managed CP-09 proof is explicitly requested. The proof is disabled by default because
     * V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF is absent or not true; explicit enablement requires setting that
     * environment variable to true in the managed proof command. It is deliberately not an {@link AcceptanceScenario}:
     * connection-scope probes must not change the product-business scenario denominator or be reported as a substitute
     * for those scenarios.
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF", matches = "true")
    void p2ReadConnectionScopeProof() throws Exception {
        requireRemoteExecution();
        P2ReadConnectionScopeScenarios.run(
                this,
                new ScenarioContext(null, "performance.normal-path"),
                new ScenarioContext(null, "performance.coverage-only"));
    }

    /**
     * The managed whole-suite runner enables this calibration fixture itself so the generated operation exact-set is
     * measured on every complete acceptance run. It remains outside {@link AcceptanceScenario}; the business
     * denominator stays the explicit catalog and this fixture is consumed only by the run-level verifier.
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE", matches = "true")
    void backendPerformanceOperationCoverage() throws Exception {
        requireRemoteExecution();
        BackendPerformanceOperationCoverage.run(
                this,
                new ScenarioContext(null, "performance.normal-path"),
                new ScenarioContext(null, "performance.coverage-only"));
    }

    /**
     * Disabled by default; explicit enablement is provided only by the managed scale-proof command. The proof is not an
     * AcceptanceScenario and must not change the business scenario denominator.
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "V2S_EXTENSION_SCALE_PROOF", matches = "true")
    void extensionScaleProof() throws Exception {
        requireRemoteExecution();
        ExtensionScaleProof.run(this, jdbc, mapper);
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

    static Map<String, Object> acceptanceStoreOperatingRuleSwitches() {
        Map<String, Object> values = new java.util.LinkedHashMap<>(StoreOperatingRuleCatalog.defaults());
        values.put(
                StoreOperatingRuleCatalog.definition("catalogManagementEnabled").key(), true);
        return Map.copyOf(values);
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
                hierarchy.createRegion(workspaceUuid, key, "acceptance-region", "Acceptance Region");
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
        OrganizationEntityReadback store = entities.createStoreWithOperatingRuleSwitches(
                workspaceUuid,
                key,
                project.id(),
                tenant.id(),
                brand.id(),
                null,
                "acceptance-store",
                "Acceptance Store",
                "Acceptance Store Notes",
                Map.of(),
                acceptanceStoreOperatingRuleSwitches());
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
        return siblingStoreFixture(existing, capabilities, acceptanceStoreOperatingRuleSwitches());
    }

    /** Creates an independently authorized Store with an explicitly closed operating-rule map for gate negatives. */
    Fixture closedStoreFixture(Fixture existing, Set<String> capabilities) {
        return siblingStoreFixture(
                existing, capabilities, new java.util.LinkedHashMap<>(StoreOperatingRuleCatalog.defaults()));
    }

    /** Creates a store fixture with the service-point/QR operating-rule gate explicitly enabled. */
    Fixture storeServicePointFixture(Fixture existing, Set<String> capabilities) {
        Map<String, Object> rules = new java.util.LinkedHashMap<>(acceptanceStoreOperatingRuleSwitches());
        rules.put(StoreOperatingRuleCatalog.definition("tableManagementEnabled").key(), true);
        return siblingStoreFixture(existing, capabilities, rules);
    }

    private Fixture siblingStoreFixture(
            Fixture existing, Set<String> capabilities, Map<String, Object> operatingRuleSwitches) {
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
        OrganizationEntityReadback store = entities.createStoreWithOperatingRuleSwitches(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.projectId(),
                tenant.id(),
                brand.id(),
                null,
                "acceptance-store-" + suffix,
                "Acceptance Store " + suffix,
                "Acceptance Store Notes",
                Map.of(),
                operatingRuleSwitches);
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
        OrganizationEntityReadback store = entities.createStoreWithOperatingRuleSwitches(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.projectId(),
                existing.tenantId(),
                existing.brandId(),
                null,
                "acceptance-store-same-brand-" + suffix,
                "Acceptance Same Brand Store " + suffix,
                "Acceptance Store Notes",
                Map.of(),
                acceptanceStoreOperatingRuleSwitches());
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
        return projectUserFixture(existing, Set.of(), capabilities);
    }

    Fixture projectUserFixture(Fixture existing, Set<String> pageAccessKeys, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
        UUID roleId = roles.create(
                        existing.workspaceUuid(),
                        existing.groupWorkspaceKey(),
                        "Acceptance Project Operator " + suffix,
                        "PROJECT",
                        null,
                        pageAccessKeys,
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

    /** Creates a second user assigned to the existing region for owner-scope acceptance. */
    Fixture regionUserFixture(Fixture existing, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
        UUID roleId = roles.create(
                        existing.workspaceUuid(),
                        existing.groupWorkspaceKey(),
                        "Acceptance Region Operator " + suffix,
                        "REGION",
                        null,
                        Set.of(),
                        capabilities)
                .id();
        String mobile =
                "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
        String loginName = "operator-region-" + suffix;
        var invitation = invitations.create(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", existing.regionId())),
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

    /** Creates a second user on the existing store so capability denial is separated from store-scope denial. */
    Fixture storeUserFixture(Fixture existing, Set<String> capabilities) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long now = Instant.now().toEpochMilli();
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
        String loginName = "operator-store-" + suffix;
        var invitation = invitations.create(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                mobile,
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "STORE", existing.storeId())),
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
        OrganizationEntityReadback store = entities.createStoreWithOperatingRuleSwitches(
                source.workspaceUuid(),
                source.groupWorkspaceKey(),
                source.projectId(),
                source.tenantId(),
                source.brandId(),
                source.headCompanyId(),
                "acceptance-brand-copy-store-" + suffix,
                "Acceptance Brand Copy Store " + suffix,
                "Acceptance Store Notes",
                Map.of(),
                acceptanceStoreOperatingRuleSwitches());
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
            OrganizationEntityReadback store = entities.createStoreWithOperatingRuleSwitches(
                    existing.workspaceUuid(),
                    existing.groupWorkspaceKey(),
                    existing.projectId(),
                    existing.tenantId(),
                    existing.brandId(),
                    null,
                    "acceptance-store-" + suffix + "-" + String.format("%02d", index),
                    "Acceptance Store " + suffix + " " + index,
                    "Acceptance Store Notes",
                    Map.of(),
                    acceptanceStoreOperatingRuleSwitches());
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

    Connection holdTerminalRowLockForAcceptance(Fixture fixture, UUID terminalRef) throws SQLException {
        if (jdbc.getDataSource() == null) throw new IllegalStateException("ACCEPTANCE_DATASOURCE_MISSING");
        Connection connection = jdbc.getDataSource().getConnection();
        connection.setAutoCommit(false);
        try (PreparedStatement statement =
                connection.prepareStatement("SELECT terminal_ref FROM store_terminal.terminal "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? FOR UPDATE")) {
            statement.setObject(1, fixture.workspaceUuid());
            statement.setString(2, fixture.groupWorkspaceKey());
            statement.setObject(3, terminalRef);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next() || !terminalRef.equals(rows.getObject(1, UUID.class))) {
                    throw new IllegalStateException("ACCEPTANCE_TERMINAL_ROW_LOCK_TARGET_MISSING");
                }
            }
            return connection;
        } catch (SQLException | RuntimeException failure) {
            try {
                connection.rollback();
            } finally {
                connection.close();
            }
            throw failure;
        }
    }

    Connection holdLatestConnectionStateRowLockForAcceptance(Fixture fixture, UUID terminalRef) throws SQLException {
        if (jdbc.getDataSource() == null) throw new IllegalStateException("ACCEPTANCE_DATASOURCE_MISSING");
        Connection connection = jdbc.getDataSource().getConnection();
        connection.setAutoCommit(false);
        try (PreparedStatement statement =
                connection.prepareStatement("SELECT terminal_ref FROM terminal_connection.latest_state "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? FOR UPDATE")) {
            statement.setObject(1, fixture.workspaceUuid());
            statement.setString(2, fixture.groupWorkspaceKey());
            statement.setObject(3, terminalRef);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next() || !terminalRef.equals(rows.getObject(1, UUID.class))) {
                    throw new IllegalStateException("ACCEPTANCE_LATEST_STATE_LOCK_TARGET_MISSING");
                }
            }
            return connection;
        } catch (SQLException | RuntimeException failure) {
            try {
                connection.rollback();
            } finally {
                connection.close();
            }
            throw failure;
        }
    }

    void awaitLatestConnectionStateLockWaiters(int expected, Duration timeout) throws InterruptedException {
        long startedNanos = System.nanoTime();
        long deadline = System.nanoTime() + timeout.toNanos();
        long observed = 0;
        do {
            observed = count("SELECT count(*) FROM pg_stat_activity "
                    + "WHERE datname=current_database() AND pid<>pg_backend_pid() "
                    + "AND wait_event_type='Lock' AND query ILIKE '%terminal_connection.latest_state%'");
            if (observed >= expected) {
                System.out.printf(
                        "BACKEND_ACCEPTANCE_LATEST_STATE_LOCK waitersReady expected=%d observed=%d elapsedMillis=%d%n",
                        expected, observed, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos));
                return;
            }
            Thread.sleep(50);
        } while (System.nanoTime() < deadline);
        throw new IllegalStateException(
                "ACCEPTANCE_LATEST_STATE_LOCK_WAITERS_NOT_READY expected=" + expected + " observed=" + observed
                        + " elapsedMillis=" + TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos));
    }

    void awaitTerminalRowLockWaiters(int expected, Duration timeout) throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        long observed = 0;
        do {
            observed = count("SELECT count(*) FROM pg_stat_activity "
                    + "WHERE datname=current_database() AND pid<>pg_backend_pid() "
                    + "AND wait_event_type='Lock' AND query ILIKE '%store_terminal.terminal%' ");
            if (observed >= expected) {
                System.out.printf(
                        "BACKEND_ACCEPTANCE_TERMINAL_LOCK waitersReady expected=%d observed=%d%n", expected, observed);
                return;
            }
            Thread.sleep(50);
        } while (System.nanoTime() < deadline);
        throw new IllegalStateException(
                "ACCEPTANCE_TERMINAL_LOCK_WAITERS_NOT_READY expected=" + expected + " observed=" + observed);
    }

    long organizationStoreVersion(UUID storeId) {
        return jdbc.queryForObject("SELECT version FROM organization.store WHERE id=?", Long.class, storeId);
    }

    String text(String sql, Object... args) {
        return jdbc.queryForObject(sql, String.class, args);
    }

    int update(String sql, Object... args) {
        return jdbc.update(sql, args);
    }

    boolean terminatePostgresBackend(int backendPid) {
        assertTrue(backendPid > 1, "BACKEND_ACCEPTANCE_POSTGRES_BACKEND_PID_INVALID");
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT pg_terminate_backend(?)", Boolean.class, backendPid));
    }

    String postgresContainerId() {
        String containerId = POSTGRES.getContainerId();
        assertTrue(containerId != null && !containerId.isBlank(), "BACKEND_ACCEPTANCE_POSTGRES_CONTAINER_ID_MISSING");
        return containerId;
    }

    void pausePostgresContainer() {
        DockerClientFactory.instance()
                .client()
                .pauseContainerCmd(postgresContainerId())
                .exec();
    }

    void unpausePostgresContainer() {
        DockerClientFactory.instance()
                .client()
                .unpauseContainerCmd(postgresContainerId())
                .exec();
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

    /**
     * External-order ingestion is intentionally outside this HTTP acceptance surface. This fixture creates only the
     * already-owned temporary source fact so promotion can be exercised through its real operations HTTP command.
     */
    TemporaryCatalogItemFixture temporaryCatalogItemFixture(Fixture fixture, String code, String name) {
        UUID itemRef = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        jdbc.update(
                "INSERT INTO catalog.catalog_item (item_ref,data_node_ref,brand_ref,code,name,shape_key,status,"
                        + "sections,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,"
                        + "'STANDARD_SALE_COUNTED','DISABLED','{\"source\":\"TEMPORARY\"}'::jsonb,1,?,?)",
                itemRef,
                fixture.storeId().toString(),
                fixture.brandId().toString(),
                code,
                name,
                now,
                now);
        return new TemporaryCatalogItemFixture(itemRef, code, 1);
    }

    Map<String, Object> queryForMap(String sql, Object... args) {
        return jdbc.queryForMap(sql, args);
    }

    Map<String, Object> tdsHeartbeatStatisticsSnapshot() {
        return jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Map<String, Object>>) connection -> {
            try (var refresh = connection.createStatement()) {
                refresh.execute("SELECT pg_stat_clear_snapshot()");
            }
            try (var statement = connection.prepareStatement(
                    """
                    SELECT
                        COALESCE((
                            SELECT n_tup_upd FROM pg_stat_user_tables
                            WHERE schemaname='terminal_connection' AND relname='latest_state'
                        ), 0) AS latest_state_updates,
                        COALESCE((
                            SELECT SUM(seq_scan + idx_scan) FROM pg_stat_user_tables
                            WHERE (schemaname='platform_workspace' AND relname='workspace')
                               OR (schemaname='organization' AND relname='store')
                               OR (schemaname='store_terminal' AND relname='terminal')
                               OR (schemaname='terminal_binding' AND relname='latest_binding')
                        ), 0) AS business_table_scans,
                        COALESCE((SELECT seq_scan + idx_scan FROM pg_stat_user_tables
                            WHERE schemaname='platform_workspace' AND relname='workspace'), 0) AS workspace_scans,
                        COALESCE((SELECT seq_scan + idx_scan FROM pg_stat_user_tables
                            WHERE schemaname='organization' AND relname='store'), 0) AS store_scans,
                        COALESCE((SELECT seq_scan + idx_scan FROM pg_stat_user_tables
                            WHERE schemaname='store_terminal' AND relname='terminal'), 0) AS terminal_scans,
                        COALESCE((SELECT seq_scan + idx_scan FROM pg_stat_user_tables
                            WHERE schemaname='terminal_binding' AND relname='latest_binding'), 0) AS binding_scans
                    """)) {
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) throw new IllegalStateException("TDS_HEARTBEAT_STATISTICS_SNAPSHOT_MISSING");
                    return Map.of(
                            "latestStateUpdates", rows.getLong("latest_state_updates"),
                            "businessTableScans", rows.getLong("business_table_scans"),
                            "workspaceScans", rows.getLong("workspace_scans"),
                            "storeScans", rows.getLong("store_scans"),
                            "terminalScans", rows.getLong("terminal_scans"),
                            "bindingScans", rows.getLong("binding_scans"));
                }
            }
        });
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

    record RouteIdentity(String operationId, String routeTemplate, boolean idempotencyKeyForbidden) {
        RouteIdentity(String operationId, String routeTemplate) {
            this(operationId, routeTemplate, false);
        }
    }

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

    record TemporaryCatalogItemFixture(UUID itemRef, String itemCode, long version) {}

    record Session(String cookie, JsonNode entry, long contextVersion) {}

    final class ScenarioContext {
        private final AcceptanceScenario scenario;
        private final String measurementScenarioId;
        private final int targetPort;
        private final String correlationId = "acceptance-" + UUID.randomUUID();
        private final HttpClient client = HttpClient.newBuilder().build();
        private boolean contractPass = true;

        ScenarioContext(AcceptanceScenario scenario) {
            // Business scenarios provide the normal-path samples that complete the generated operation
            // denominator. A deliberately high-cardinality business request must opt into coverage-only
            // at that one HTTP call and be paired with a bounded normal recipe.
            this(scenario, "performance.normal-path");
        }

        ScenarioContext(AcceptanceScenario scenario, String measurementScenarioId) {
            this(scenario, measurementScenarioId, port);
        }

        ScenarioContext(AcceptanceScenario scenario, String measurementScenarioId, int targetPort) {
            this.scenario = scenario;
            this.targetPort = targetPort;
            if (!Set.of("performance.normal-path", "performance.coverage-only").contains(measurementScenarioId)) {
                throw new IllegalArgumentException("BACKEND_ACCEPTANCE_MEASUREMENT_SCENARIO_INVALID");
            }
            this.measurementScenarioId = measurementScenarioId;
        }

        Response get(RouteIdentity route, String path, String cookie, Set<Integer> expected) throws Exception {
            return send(route, "GET", path, cookie, (String) null, null, expected);
        }

        Response get(
                RouteIdentity route, String path, String cookie, Map<String, String> headers, Set<Integer> expected)
                throws Exception {
            return send(route, "GET", path, cookie, (String) null, null, headers, expected);
        }

        HttpResponse<byte[]> getBinary(RouteIdentity route, String path, Map<String, String> headers,
                Set<Integer> expected) throws Exception {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + targetPort + path))
                    .header("Accept", "application/zip")
                    .header("X-Correlation-Id", correlationId)
                    .header("X-Backend-Acceptance-Run-Id",
                            requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID))
                    .header("X-Backend-Acceptance-Secret",
                            requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_SECRET))
                    .header("X-Backend-Acceptance-Operation-Id", route.operationId())
                    .header("X-Backend-Acceptance-Route-Template", route.routeTemplate())
                    .header("X-Backend-Acceptance-Measurement-Scenario-Id", measurementScenarioId)
                    .header("X-Request-Id", UUID.randomUUID().toString())
                    .GET();
            if (headers != null) headers.forEach(builder::header);
            HttpResponse<byte[]> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            if (!expected.contains(response.statusCode())) {
                contractPass = false;
                throw new AssertionError("CONTRACT: binary HTTP response expected=" + expected + " actual="
                        + response.statusCode() + " requestPath=" + path + " operationId=" + route.operationId());
            }
            return response;
        }

        Response post(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "POST", path, cookie, requestJson(body), null, expected);
        }

        Response postSerializedJson(RouteIdentity route, String path, byte[] body, Set<Integer> expected)
                throws Exception {
            return send(route, "POST", path, null, body, null, Map.of(), expected);
        }

        Socket postWithoutReadingResponse(RouteIdentity route, String path, byte[] body) throws Exception {
            Socket socket = new Socket();
            try {
                socket.connect(new java.net.InetSocketAddress("127.0.0.1", targetPort), 5_000);
                socket.setSoLinger(true, 0);
                String headers = "POST " + path + " HTTP/1.1\r\n"
                        + "Host: 127.0.0.1:" + targetPort + "\r\n"
                        + "Accept: application/json\r\n"
                        + "Content-Type: application/json\r\n"
                        + "Connection: keep-alive\r\n"
                        + "Content-Length: " + body.length + "\r\n"
                        + "X-Correlation-Id: " + correlationId + "\r\n"
                        + "X-Backend-Acceptance-Run-Id: "
                        + requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID) + "\r\n"
                        + "X-Backend-Acceptance-Secret: "
                        + requiredEnvironment(RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_SECRET) + "\r\n"
                        + "X-Backend-Acceptance-Operation-Id: " + route.operationId() + "\r\n"
                        + "X-Backend-Acceptance-Route-Template: " + route.routeTemplate() + "\r\n"
                        + "X-Backend-Acceptance-Measurement-Scenario-Id: " + measurementScenarioId + "\r\n"
                        + "X-Request-Id: " + UUID.randomUUID() + "\r\n\r\n";
                OutputStream output = socket.getOutputStream();
                output.write(headers.getBytes(StandardCharsets.UTF_8));
                output.write(body);
                output.flush();
                return socket;
            } catch (Exception failure) {
                socket.close();
                throw failure;
            }
        }

        Response postCoverageOnly(
                RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(
                    route,
                    "POST",
                    path,
                    cookie,
                    requestJson(body).getBytes(StandardCharsets.UTF_8),
                    null,
                    Map.of(),
                    expected,
                    "performance.coverage-only");
        }

        Response postCoverageOnly(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(
                    route,
                    "POST",
                    path,
                    cookie,
                    requestJson(body).getBytes(StandardCharsets.UTF_8),
                    null,
                    headers,
                    expected,
                    "performance.coverage-only");
        }

        Response postNoBodyCoverageOnly(RouteIdentity route, String path, String cookie,
                Map<String, String> headers, Set<Integer> expected) throws Exception {
            return send(route, "POST", path, cookie, new byte[0], null, headers, expected,
                    "performance.coverage-only");
        }

        Response post(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(route, "POST", path, cookie, requestJson(body), null, headers, expected);
        }

        Response patch(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "PATCH", path, cookie, requestJson(body), null, expected);
        }

        Response patch(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(route, "PATCH", path, cookie, requestJson(body), null, headers, expected);
        }

        Response put(RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "PUT", path, cookie, requestJson(body), null, expected);
        }

        Response put(
                RouteIdentity route,
                String path,
                String cookie,
                Map<String, Object> body,
                Map<String, String> headers,
                Set<Integer> expected)
                throws Exception {
            return send(route, "PUT", path, cookie, requestJson(body), null, headers, expected);
        }

        Response delete(RouteIdentity route, String path, String cookie, Set<Integer> expected) throws Exception {
            return send(route, "DELETE", path, cookie, (String) null, null, expected);
        }

        Response delete(
                RouteIdentity route, String path, String cookie, Map<String, Object> body, Set<Integer> expected)
                throws Exception {
            return send(route, "DELETE", path, cookie, requestJson(body), null, expected);
        }

        /**
         * Preserve nulls that a scenario explicitly puts in its request map. Some R5 contracts deliberately make a
         * property required-but-nullable; serializing the map through an application-configured mapper can omit that
         * key and turn a valid HTTP request into a transport-level 400 before the owner is reached.
         */
        private String requestJson(Map<String, Object> body) throws Exception {
            if (body == null) return null;
            return mapper.writeValueAsString(requestJsonValue(body));
        }

        private JsonNode requestJsonValue(Object value) {
            if (value == null) return NullNode.getInstance();
            if (value instanceof JsonNode node) return node;
            if (value instanceof Map<?, ?> map) {
                ObjectNode object = mapper.createObjectNode();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (!(entry.getKey() instanceof String key) || key.isBlank()) {
                        throw new IllegalArgumentException("request JSON object key must be a non-blank string");
                    }
                    object.set(key, requestJsonValue(entry.getValue()));
                }
                return object;
            }
            if (value instanceof Iterable<?> iterable) {
                ArrayNode array = mapper.createArrayNode();
                for (Object item : iterable) array.add(requestJsonValue(item));
                return array;
            }
            return mapper.valueToTree(value);
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

        Response multipartSalesMenuAsset(
                RouteIdentity route,
                String path,
                String cookie,
                long expectedDraftVersion,
                String fileName,
                String mediaType,
                String digest,
                byte[] bytes,
                Set<Integer> expected)
                throws Exception {
            String boundary = "----backend-acceptance-" + UUID.randomUUID();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            writePart(content, boundary, "content", fileName, mediaType, bytes);
            content.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            String query = "?expectedDraftVersion=" + expectedDraftVersion + "&fileName=" + encode(fileName)
                    + "&mediaType=" + encode(mediaType) + "&contentDigest=" + encode(digest);
            return send(route, "POST", path + query, cookie, content.toByteArray(), boundary, expected);
        }

        Response multipartStoreServicePointAsset(
                RouteIdentity route,
                String path,
                String cookie,
                String fileName,
                String mediaType,
                String digest,
                byte[] bytes,
                Set<Integer> expected)
                throws Exception {
            String boundary = "----backend-acceptance-" + UUID.randomUUID();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            writePart(content, boundary, "content", fileName, mediaType, bytes);
            content.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            String query = "?fileName=" + encode(fileName) + "&mediaType=" + encode(mediaType) + "&contentDigest="
                    + encode(digest);
            return send(route, "POST", path + query, cookie, content.toByteArray(), boundary, expected);
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

        Response multipartTerminalUpdatePackage(
                RouteIdentity route,
                String path,
                String cookie,
                String sha256,
                byte[] bytes,
                String idempotencyKey,
                Set<Integer> expected)
                throws Exception {
            String boundary = "----backend-acceptance-" + UUID.randomUUID();
            ByteArrayOutputStream content = new ByteArrayOutputStream();
            writeTextPart(content, boundary, "usage", "TERMINAL_UPDATE_ARTIFACT");
            writeTextPart(content, boundary, "sha256", sha256);
            writePart(content, boundary, "file", "terminal-update.zip", "application/zip", bytes);
            content.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return send(route, "POST", path, cookie, content.toByteArray(), boundary,
                    Map.of("Idempotency-Key", idempotencyKey), expected);
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
            return send(route, method, path, cookie, body, boundary, headers, expected, measurementScenarioId);
        }

        private Response send(
                RouteIdentity route,
                String method,
                String path,
                String cookie,
                byte[] body,
                String boundary,
                Map<String, String> headers,
                Set<Integer> expected,
                String requestMeasurementScenarioId)
                throws Exception {
            HttpRequest.BodyPublisher publisher = body.length == 0
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofByteArray(body);
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + targetPort + path))
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
                    .header("X-Backend-Acceptance-Measurement-Scenario-Id", requestMeasurementScenarioId)
                    .header("X-Request-Id", UUID.randomUUID().toString())
                    .method(method, publisher);
            if (cookie != null) builder.header("Cookie", cookie);
            if (boundary != null) builder.header("Content-Type", "multipart/form-data; boundary=" + boundary);
            else if (body.length > 0) builder.header("Content-Type", "application/json");
            if (!"GET".equals(method)
                    && !route.idempotencyKeyForbidden()
                    && (headers == null || !headers.containsKey("Idempotency-Key")))
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
                        + " requestMethod="
                        + method
                        + " requestPath="
                        + path
                        + " operationId="
                        + route.operationId()
                        + " responseUri="
                        + result.http().uri()
                        + " allow="
                        + result.http().headers().firstValue("Allow").orElse("")
                        + " responseContentType="
                        + result.http().headers().firstValue("Content-Type").orElse("")
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

    /**
     * Reads a required business-field pointer without Jackson's path() coercions. A missing node, null node, or wrong
     * JSON type must remain visible to the hand-written BUSINESS oracle instead of becoming a default value.
     */
    static JsonNode requiredJsonNode(JsonNode root, String pointer, JsonNodeType expectedType, String message) {
        assertNotNull(root, message + ": response JSON is present");
        JsonNode actual = root.at(pointer);
        assertFalse(actual.isMissingNode(), message + ": missing pointer " + pointer);
        assertEquals(expectedType, actual.getNodeType(), message + ": pointer " + pointer + " has wrong JSON type");
        return actual;
    }

    static void assertJsonNodeEquals(JsonNode root, String pointer, JsonNode expected, String message) {
        JsonNode actual = requiredJsonNode(root, pointer, expected.getNodeType(), message);
        assertEquals(expected, actual, message + ": pointer " + pointer + " differs");
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
        // Keep the bounded, non-payload diagnostic long enough to retain the typed problem and
        // detail after the opaque request path. The response body itself is never recorded here.
        return normalized.substring(0, Math.min(1024, normalized.length()));
    }
}
