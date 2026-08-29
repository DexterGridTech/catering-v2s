package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Real HTTP calibration for operation routes that are not naturally exercised by the bounded business scenario catalog.
 * This is a CP-05 calibration fixture, not a second scenario catalog and not a scenario-level performance oracle. Its
 * normal recipes prove a successful request for the finite missing subset; its coverage-only recipes only make a
 * deliberately non-normal boundary observable. Each request emits the same completion event consumed by the run-level
 * verifier.
 */
final class BackendPerformanceOperationCoverage {
    private static final Set<Integer> HTTP_RESPONSES =
            IntStream.rangeClosed(200, 499).boxed().collect(Collectors.toUnmodifiableSet());
    private static final Set<String> CONTEXT_VERSION_READS = Set.of(
            "getOperationsOrganizationBrand",
            "getOperationsContractCandidates",
            "getOperationsStoreProfile",
            "getOperationsFixedStoreContracts",
            "getOperationsOrganizationTenant",
            "getOperationsWorkspaceGroupInvitationCandidates",
            "getOperationsWorkspaceRegionInvitationCandidates",
            "getOperationsWorkspaceProjectInvitationCandidates",
            "getOperationsWorkspaceHeadCompanyInvitationCandidates",
            "getOperationsWorkspaceStoreInvitationCandidates",
            "getOperationsWorkspaceRegionInvitations",
            "getOperationsWorkspaceProjectInvitations",
            "getOperationsWorkspaceHeadCompanyInvitations",
            "getOperationsWorkspaceStoreInvitations",
            "getOperationsWorkspaceRegionUser",
            "getOperationsWorkspaceProjectUser",
            "getOperationsWorkspaceHeadCompanyUser",
            "getOperationsWorkspaceGroupUserAccount",
            "getOperationsWorkspaceRegionUserAccount",
            "getOperationsWorkspaceProjectUserAccount",
            "getOperationsWorkspaceHeadCompanyUserAccount",
            "getOperationsWorkspaceStoreUserAccount");
    private static final Set<String> CANDIDATE_READS = Set.of(
            "getOperationsWorkspaceGroupInvitationCandidates",
            "getOperationsWorkspaceRegionInvitationCandidates",
            "getOperationsWorkspaceProjectInvitationCandidates",
            "getOperationsWorkspaceHeadCompanyInvitationCandidates",
            "getOperationsWorkspaceStoreInvitationCandidates");
    private static final Set<String> STATUS_TRANSITIONS = Set.of(
            "transitionPlatformAdminStatus",
            "transitionPlatformExternalSystemStatus",
            "transitionPlatformGroupWorkspaceStatus",
            "transitionWorkspaceAccountStatus",
            "transitionWorkspaceRoleStatus");
    private static final Set<String> STRICT_DICTIONARY_REQUESTS = Set.of("reorderOperationsCatalogDictionaryEntry");
    private static final Set<String> NORMAL_RECIPE_OPERATIONS = Set.of(
            "selectOperationsWorkspaceSessionContext",
            "updateOperationsBusinessChannel",
            "updateOperationsBusinessChannelTemplate");
    private static final Route SESSION_CONTEXT = route(
            "selectOperationsWorkspaceSessionContext",
            "POST",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/session/context",
            "operations-admin");

    /*
     * Explicit coverage-only route recipes. This is not an operation denominator: the generated
     * registry plus successful normal-path completion events is the sole current completeness
     * proof. Keep these recipes only for routes that need a deliberately controlled non-normal
     * probe to make their HTTP boundary observable.
     */
    private static final List<Route> COVERAGE_ONLY_RECIPES = List.of(
            route(
                    "cancelOperationsWorkspaceGroupInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/"
                            + "invitations/{invitationId}/cancel",
                    "operations-admin"),
            route(
                    "cancelOperationsWorkspaceHeadCompanyInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/"
                            + "invitations/{invitationId}/cancel",
                    "operations-admin"),
            route(
                    "cancelOperationsWorkspaceProjectInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/"
                            + "invitations/{invitationId}/cancel",
                    "operations-admin"),
            route(
                    "cancelOperationsWorkspaceRegionInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region"
                            + "/invitations/{invitationId}/cancel",
                    "operations-admin"),
            route(
                    "cancelOperationsWorkspaceStoreInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store"
                            + "/invitations/{invitationId}/cancel",
                    "operations-admin"),
            route(
                    "cancelWorkspaceInvitation",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}" + "/cancel",
                    "platform-admin"),
            route("changeCurrentPlatformPassword", "POST", "/api/platform/auth/password", "platform-admin"),
            route(
                    "changeCurrentWorkspacePassword",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/session/password",
                    "operations-admin"),
            route(
                    "completeOperationsPasswordRecovery",
                    "POST",
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete",
                    "public"),
            route(
                    "completePlatformPasswordRecovery",
                    "POST",
                    "/api/platform/auth/password-recovery/complete",
                    "platform-admin"),
            route(
                    "createOperationsWorkspaceGroupInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group" + "/invitations",
                    "operations-admin"),
            route(
                    "createOperationsWorkspaceHeadCompanyInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company"
                            + "/invitations",
                    "operations-admin"),
            route(
                    "createOperationsWorkspaceProjectInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project" + "/invitations",
                    "operations-admin"),
            route(
                    "createOperationsWorkspaceRegionInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region" + "/invitations",
                    "operations-admin"),
            route(
                    "createOperationsWorkspaceStoreInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store" + "/invitations",
                    "operations-admin"),
            route("createPlatformAdmin", "POST", "/api/platform/admin-users", "platform-admin"),
            route("createPlatformGroupWorkspace", "POST", "/api/platform/group-workspaces", "platform-admin"),
            route(
                    "createWorkspaceInvitation",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations",
                    "platform-admin"),
            route(
                    "createWorkspaceRole",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
                    "platform-admin"),
            route(
                    "deleteOperationsOwnerBinding",
                    "DELETE",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels"
                            + "/{channelRef}/owner-binding",
                    "operations-admin"),
            route("getCurrentPlatformSession", "GET", "/api/platform/auth/session", "platform-admin"),
            route(
                    "getOperationsContractCandidates",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/candidates",
                    "operations-admin"),
            route(
                    "getOperationsExternalCapabilityDictionary",
                    "GET",
                    "/api/operations/external-capability-dictionary",
                    "operations-admin"),
            route(
                    "getOperationsFixedStoreContracts",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile/contracts",
                    "operations-admin"),
            route(
                    "getOperationsOrganizationBrand",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}",
                    "operations-admin"),
            route(
                    "getOperationsOrganizationTenant",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants" + "/{tenantId}",
                    "operations-admin"),
            route(
                    "getOperationsStoreProfile",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceGroupInvitationCandidates",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group"
                            + "/invitations/candidates",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceGroupUserAccount",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user"
                            + "/accounts/{accountId}",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceHeadCompanyInvitationCandidates",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company"
                            + "/invitations/candidates",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceHeadCompanyInvitations",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company"
                            + "/invitations",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceHeadCompanyUser",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company" + "/user",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceHeadCompanyUserAccount",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company"
                            + "/user/accounts/{accountId}",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceProjectInvitationCandidates",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project"
                            + "/invitations/candidates",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceProjectInvitations",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project" + "/invitations",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceProjectUser",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceProjectUserAccount",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user"
                            + "/accounts/{accountId}",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceRegionInvitationCandidates",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region"
                            + "/invitations/candidates",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceRegionInvitations",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region" + "/invitations",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceRegionUser",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceRegionUserAccount",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user"
                            + "/accounts/{accountId}",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceStoreInvitationCandidates",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store"
                            + "/invitations/candidates",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceStoreInvitations",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store" + "/invitations",
                    "operations-admin"),
            route(
                    "getOperationsWorkspaceStoreUserAccount",
                    "GET",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user"
                            + "/accounts/{accountId}",
                    "operations-admin"),
            route("getPlatformAdminDetail", "GET", "/api/platform/admin-users/{platformAdminId}", "platform-admin"),
            route(
                    "getPlatformContractOverviewDetail",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}",
                    "platform-admin"),
            route(
                    "getPlatformContractOverviewPage",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview",
                    "platform-admin"),
            route(
                    "getPlatformOrganizationHierarchyTree",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy",
                    "platform-admin"),
            route(
                    "getPlatformOrganizationOverviewDetail",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview" + "/{category}/{itemId}",
                    "platform-admin"),
            route("getPublicAssetContent", "GET", "/api/public/assets/{assetRef}/content", "public"),
            route(
                    "getWorkspaceAccount",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}",
                    "platform-admin"),
            route(
                    "getWorkspaceInvitation",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}",
                    "platform-admin"),
            route(
                    "getWorkspaceRole",
                    "GET",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
                    "platform-admin"),
            route(
                    "operationsWorkspaceLogout",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/logout",
                    "operations-admin"),
            route("platformLogout", "POST", "/api/platform/auth/logout", "platform-admin"),
            route(
                    "reissueOperationsWorkspaceGroupInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group"
                            + "/invitations/{invitationId}/reissue",
                    "operations-admin"),
            route(
                    "reissueOperationsWorkspaceHeadCompanyInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company"
                            + "/invitations/{invitationId}/reissue",
                    "operations-admin"),
            route(
                    "reissueOperationsWorkspaceProjectInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project"
                            + "/invitations/{invitationId}/reissue",
                    "operations-admin"),
            route(
                    "reissueOperationsWorkspaceRegionInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region"
                            + "/invitations/{invitationId}/reissue",
                    "operations-admin"),
            route(
                    "reissueOperationsWorkspaceStoreInvitation",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store"
                            + "/invitations/{invitationId}/reissue",
                    "operations-admin"),
            route(
                    "reissueWorkspaceInvitation",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}" + "/reissue",
                    "platform-admin"),
            route(
                    "releasePlatformStagedAsset",
                    "POST",
                    "/api/platform/assets/staging/{assetRef}/release",
                    "platform-admin"),
            route(
                    "requestWorkspaceCredentialReset",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}" + "/credential-reset",
                    "platform-admin"),
            route(
                    "resetPlatformAdminCredential",
                    "POST",
                    "/api/platform/admin-users/{platformAdminId}/credential-reset",
                    "platform-admin"),
            route(
                    "revokeOperationsWorkspaceGroupUserAssignment",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/group/user"
                            + "/assignments/{assignmentId}/revoke",
                    "operations-admin"),
            route(
                    "revokeOperationsWorkspaceHeadCompanyUserAssignment",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company"
                            + "/user/assignments/{assignmentId}/revoke",
                    "operations-admin"),
            route(
                    "revokeOperationsWorkspaceProjectUserAssignment",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/user"
                            + "/assignments/{assignmentId}/revoke",
                    "operations-admin"),
            route(
                    "revokeOperationsWorkspaceRegionUserAssignment",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/region/user"
                            + "/assignments/{assignmentId}/revoke",
                    "operations-admin"),
            route(
                    "revokeOperationsWorkspaceStoreUserAssignment",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/store/user"
                            + "/assignments/{assignmentId}/revoke",
                    "operations-admin"),
            route(
                    "revokePlatformWorkspaceAssignment",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}"
                            + "/assignments/{assignmentId}/revoke",
                    "platform-admin"),
            route(
                    "selectOperationsWorkspaceSessionContext",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/session/context",
                    "operations-admin"),
            route(
                    "sendOperationsPasswordRecoveryOtp",
                    "POST",
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send",
                    "public"),
            route(
                    "sendOperationsWorkspaceOtp",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send",
                    "operations-admin"),
            route("sendPlatformLoginOtp", "POST", "/api/platform/auth/login-otp/send", "platform-admin"),
            route(
                    "sendPlatformPasswordRecoveryOtp",
                    "POST",
                    "/api/platform/auth/password-recovery/otp/send",
                    "platform-admin"),
            route("stagePlatformAsset", "POST", "/api/platform/assets/staging", "platform-admin"),
            route(
                    "startOperationsPasswordRecovery",
                    "POST",
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start",
                    "public"),
            route(
                    "startPlatformPasswordRecovery",
                    "POST",
                    "/api/platform/auth/password-recovery/start",
                    "platform-admin"),
            route(
                    "transitionPlatformAdminStatus",
                    "POST",
                    "/api/platform/admin-users/{platformAdminId}/status",
                    "platform-admin"),
            route(
                    "transitionPlatformExternalSystemStatus",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems"
                            + "/{externalSystemCode}/status",
                    "platform-admin"),
            route(
                    "transitionPlatformGroupWorkspaceStatus",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/status",
                    "platform-admin"),
            route(
                    "transitionWorkspaceAccountStatus",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status",
                    "platform-admin"),
            route(
                    "transitionWorkspaceRoleStatus",
                    "POST",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status",
                    "platform-admin"),
            route(
                    "updateOperationsBusinessChannel",
                    "PATCH",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels" + "/{channelRef}",
                    "operations-admin"),
            route(
                    "updateOperationsCommercialGroup",
                    "PATCH",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/commercial-group",
                    "operations-admin"),
            route(
                    "updateOperationsOrganizationHeadCompany",
                    "PATCH",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies"
                            + "/{headCompanyId}",
                    "operations-admin"),
            route(
                    "updateOperationsOrganizationTenant",
                    "PATCH",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants" + "/{tenantId}",
                    "operations-admin"),
            route(
                    "updatePlatformAdminProfile",
                    "PATCH",
                    "/api/platform/admin-users/{platformAdminId}/profile",
                    "platform-admin"),
            route(
                    "updateWorkspaceRole",
                    "PATCH",
                    "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
                    "platform-admin"),
            route(
                    "verifyOperationsPasswordRecoveryOtp",
                    "POST",
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify",
                    "public"),
            route(
                    "verifyOperationsWorkspaceOtp",
                    "POST",
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/verify",
                    "operations-admin"),
            route("verifyPlatformLoginOtp", "POST", "/api/platform/auth/login-otp/verify", "platform-admin"),
            route(
                    "verifyPlatformPasswordRecoveryOtp",
                    "POST",
                    "/api/platform/auth/password-recovery/otp/verify",
                    "platform-admin"),
            route(
                    "getOperationsCatalogWorkbenchContext",
                    "GET",
                    "/api/operations/catalog-inventory/workbench/context",
                    "operations-admin"),
            route(
                    "updateOperationsCatalogCategory",
                    "PATCH",
                    "/api/operations/catalog-inventory/categories/{categoryRef}",
                    "operations-admin"),
            route(
                    "moveOperationsCatalogCategory",
                    "POST",
                    "/api/operations/catalog-inventory/categories/{categoryRef}/move",
                    "operations-admin"),
            route(
                    "reorderOperationsCatalogDictionaryEntry",
                    "POST",
                    "/api/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/reorder",
                    "operations-admin"),
            route(
                    "updateOperationsProductionTag",
                    "PATCH",
                    "/api/operations/catalog-inventory/production-tags/{tagCode}",
                    "operations-admin"),
            route(
                    "transitionOperationsProductionTagStatus",
                    "POST",
                    "/api/operations/catalog-inventory/production-tags/{tagCode}/status",
                    "operations-admin"),
            route(
                    "preflightOperationsTemporaryCatalogItemPromotion",
                    "POST",
                    "/api/operations/catalog-inventory/items/{itemCode}/temporary-promotion/preflight",
                    "operations-admin"),
            route(
                    "executeOperationsTemporaryCatalogItemPromotion",
                    "POST",
                    "/api/operations/catalog-inventory/items/{itemCode}/temporary-promotion/execute",
                    "operations-admin"),
            route(
                    "getOperationsInventoryTargetChangeSummary",
                    "GET",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/changes",
                    "operations-admin"),
            route(
                    "getOperationsInventoryTargetBusinessHistory",
                    "GET",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/business-history",
                    "operations-admin"),
            route(
                    "getOperationsInventoryTargetDiagnostics",
                    "GET",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/diagnostics",
                    "operations-admin"),
            route(
                    "increaseOperationsInventoryTarget",
                    "POST",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/increase",
                    "operations-admin"),
            route(
                    "adjustOperationsInventoryTarget",
                    "POST",
                    "/api/operations/catalog-inventory/inventory-targets/{targetRef}/adjust",
                    "operations-admin"));

    private BackendPerformanceOperationCoverage() {}

    static void run(
            BackendAcceptanceTest host,
            BackendAcceptanceTest.ScenarioContext normalContext,
            BackendAcceptanceTest.ScenarioContext coverageContext)
            throws Exception {
        runNormalRecipes(host, normalContext);

        BackendAcceptanceTest.Fixture fixture =
                host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(coverageContext, fixture);
        BackendAcceptanceTest.Session operationsSession = host.login(coverageContext, fixture);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platformSession = host.platformLogin(coverageContext);

        List<Route> ordered = new ArrayList<>(COVERAGE_ONLY_RECIPES);
        ordered.removeIf(route -> route.operationId().equals("operationsWorkspaceLogout")
                || route.operationId().equals("platformLogout"));
        for (Route route : ordered) {
            String cookie = cookieFor(route.face(), operationsSession, platformSession);
            String path = requestPath(
                    route, fixture, operationsSession, route.method().equals("GET"));
            BackendAcceptanceTest.Response response = send(coverageContext, route, path, cookie, fixture);
            assertBusinessBoundary(route, response);
        }

        for (String logout : List.of("operationsWorkspaceLogout", "platformLogout")) {
            Route route = COVERAGE_ONLY_RECIPES.stream()
                    .filter(candidate -> candidate.operationId().equals(logout))
                    .findFirst()
                    .orElseThrow();
            String cookie =
                    "operationsWorkspaceLogout".equals(logout) ? operationsSession.cookie() : platformSession.cookie();
            BackendAcceptanceTest.Response response = send(
                    coverageContext, route, requestPath(route, fixture, operationsSession, false), cookie, fixture);
            assertBusinessBoundary(route, response);
        }
        assertTrue(
                !COVERAGE_ONLY_RECIPES.isEmpty(),
                "BUSINESS: coverage-only fixture retains explicit controlled route recipes");
    }

    private static void runNormalRecipes(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        var candidates = session.entry().path("candidates");
        assertTrue(
                candidates.isArray() && !candidates.isEmpty(),
                "BUSINESS: normal context calibration has an owner-confirmed role candidate");
        String roleAssignmentRef = candidates.get(0).path("roleAssignmentRef").asText();
        assertFalse(
                roleAssignmentRef.isBlank(), "BUSINESS: normal context calibration has a role assignment reference");
        BackendAcceptanceTest.Response selected = context.post(
                SESSION_CONTEXT.identity(),
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/session/context",
                session.cookie(),
                Map.of("roleAssignmentRef", roleAssignmentRef, "requiredContextVersion", session.contextVersion()),
                Set.of(200));
        assertEquals(
                roleAssignmentRef,
                selected.json().path("selected").path("roleAssignmentRef").asText(),
                "BUSINESS: normal context calibration returns the selected role");

        new BusinessChannelAcceptanceScenarios(host).calibrationUpdateInternalTemplateAndChannel(context);
        runCatalogLifecycleNormalRecipes(context, fixture, session);
        assertTrue(
                NORMAL_RECIPE_OPERATIONS.contains(SESSION_CONTEXT.operationId()),
                "BUSINESS: normal recipe declaration retains session-context coverage");
    }

    private static void runCatalogLifecycleNormalRecipes(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session)
            throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String root = "/api/operations/catalog-inventory";
        String dataNodeRef = fixture.storeId().toString();

        Map<String, Object> categoryBody = new LinkedHashMap<>();
        categoryBody.put("dataNodeRef", dataNodeRef);
        categoryBody.put("code", "CP05-LEGACY-CATEGORY-" + suffix);
        categoryBody.put("name", "CP05 legacy category " + suffix);
        categoryBody.put("parentCategoryRef", null);
        BackendAcceptanceTest.Response category = context.post(
                new BackendAcceptanceTest.RouteIdentity("createOperationsCatalogCategory", root + "/categories"),
                root + "/categories",
                session.cookie(),
                categoryBody,
                Set.of(200));
        var categoryResult = category.json().path("result");
        String categoryRef = categoryResult.path("categoryRef").asText();
        long categoryVersion = categoryResult.path("version").asLong();
        assertTrue(
                !categoryRef.isBlank() && categoryVersion > 0,
                "BUSINESS: legacy category normal recipe creates a versioned owner fact");
        BackendAcceptanceTest.Response disabledCategory = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "transitionOperationsCatalogCategoryStatus", root + "/categories/{categoryRef}/status"),
                root + "/categories/" + categoryRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "categoryRef", categoryRef,
                        "expectedVersion", categoryVersion,
                        "targetStatus", "DISABLED"),
                Set.of(200));
        assertEquals(
                categoryRef,
                disabledCategory.json().path("result").path("categoryRef").asText(),
                "BUSINESS: category lifecycle transition returns its owner reference");

        String attributeCode = "CP05-LEGACY-ATTRIBUTE-" + suffix;
        BackendAcceptanceTest.Response attribute = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "createOperationsCatalogAttributeDefinition", root + "/attribute-definitions"),
                root + "/attribute-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        dataNodeRef,
                        "code",
                        attributeCode,
                        "name",
                        "CP05 legacy attribute " + suffix,
                        "valueType",
                        "TEXT",
                        "options",
                        List.of()),
                Set.of(200));
        var attributeDefinition = attribute.json().path("result").path("definition");
        String attributeRef = attributeDefinition.path("definitionRef").asText();
        long attributeVersion = attributeDefinition.path("version").asLong();
        assertTrue(
                !attributeRef.isBlank() && attributeVersion > 0,
                "BUSINESS: legacy attribute normal recipe creates a versioned owner fact");
        BackendAcceptanceTest.Response disabledAttribute = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "transitionOperationsCatalogAttributeDefinitionStatus",
                        root + "/attribute-definitions/{definitionRef}/status"),
                root + "/attribute-definitions/" + attributeRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "definitionRef", attributeRef,
                        "expectedVersion", attributeVersion,
                        "targetStatus", "DISABLED"),
                Set.of(200));
        assertEquals(
                attributeRef,
                disabledAttribute
                        .json()
                        .path("result")
                        .path("definition")
                        .path("definitionRef")
                        .asText(),
                "BUSINESS: attribute lifecycle transition returns its owner reference");

        String optionCode = "CP05-LEGACY-OPTION-" + suffix;
        String optionValueCode = "CP05-LEGACY-OPTION-VALUE-" + suffix;
        BackendAcceptanceTest.Response option = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "createOperationsCatalogOrderOptionDefinition", root + "/order-option-definitions"),
                root + "/order-option-definitions",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        dataNodeRef,
                        "code",
                        optionCode,
                        "name",
                        "CP05 legacy option " + suffix,
                        "selectionMode",
                        "SINGLE",
                        "values",
                        List.of(Map.of(
                                "code",
                                optionValueCode,
                                "name",
                                "CP05 legacy option value " + suffix,
                                "displayOrder",
                                0,
                                "materials",
                                List.of()))),
                Set.of(200));
        var optionDefinition = option.json().path("result").path("definition");
        String optionRef = optionDefinition.path("definitionRef").asText();
        long optionVersion = optionDefinition.path("version").asLong();
        assertTrue(
                !optionRef.isBlank() && optionVersion > 0,
                "BUSINESS: legacy option normal recipe creates a versioned owner fact");
        BackendAcceptanceTest.Response disabledOption = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "transitionOperationsCatalogOrderOptionDefinitionStatus",
                        root + "/order-option-definitions/{definitionRef}/status"),
                root + "/order-option-definitions/" + optionRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "definitionRef", optionRef,
                        "expectedVersion", optionVersion,
                        "targetStatus", "DISABLED"),
                Set.of(200));
        assertEquals(
                optionRef,
                disabledOption
                        .json()
                        .path("result")
                        .path("definition")
                        .path("definitionRef")
                        .asText(),
                "BUSINESS: option lifecycle transition returns its owner reference");

        String unitCode = "CP05-LEGACY-UNIT-" + suffix;
        BackendAcceptanceTest.Response unit = context.post(
                new BackendAcceptanceTest.RouteIdentity("createOperationsCatalogUnit", root + "/units"),
                root + "/units",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        dataNodeRef,
                        "code",
                        unitCode,
                        "name",
                        "CP05 legacy unit " + suffix,
                        "unitDimension",
                        "COUNT",
                        "precision",
                        0),
                Set.of(200));
        var unitReadback = unit.json().path("result").path("unit");
        String unitRef = unitReadback.path("unitRef").asText();
        long unitVersion = unitReadback.path("version").asLong();
        assertTrue(
                !unitRef.isBlank() && unitVersion > 0,
                "BUSINESS: legacy unit normal recipe creates a versioned owner fact");
        BackendAcceptanceTest.Response disabledUnit = context.post(
                new BackendAcceptanceTest.RouteIdentity(
                        "transitionOperationsCatalogUnitStatus", root + "/units/{unitRef}/status"),
                root + "/units/" + unitRef + "/status",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "unitRef", unitRef,
                        "expectedVersion", unitVersion,
                        "targetStatus", "DISABLED"),
                Set.of(200));
        assertEquals(
                unitRef,
                disabledUnit.json().path("result").path("unit").path("unitRef").asText(),
                "BUSINESS: unit lifecycle transition returns its owner reference");
    }

    private static BackendAcceptanceTest.Response send(
            BackendAcceptanceTest.ScenarioContext context,
            Route route,
            String path,
            String cookie,
            BackendAcceptanceTest.Fixture fixture)
            throws Exception {
        if (route.operationId().equals("stagePlatformAsset")) {
            return context.multipartPlatformAsset(
                    route.identity(),
                    path,
                    cookie,
                    "GROUP_WORKSPACE_LOGO",
                    "cp05-coverage.png",
                    "image/png",
                    BackendAcceptanceTest.PNG,
                    HTTP_RESPONSES);
        }
        Map<String, Object> body = requestBody(route, fixture);
        Map<String, String> headers = requestHeaders(route);
        return switch (route.method()) {
            case "GET" -> context.get(route.identity(), path, cookie, HTTP_RESPONSES);
            case "POST" -> context.post(route.identity(), path, cookie, body, headers, HTTP_RESPONSES);
            case "PATCH" -> context.patch(route.identity(), path, cookie, body, headers, HTTP_RESPONSES);
            case "PUT" -> context.put(route.identity(), path, cookie, body, headers, HTTP_RESPONSES);
            case "DELETE" -> context.delete(route.identity(), path, cookie, HTTP_RESPONSES);
            default -> throw new AssertionError("BUSINESS: unsupported CP-05 coverage method " + route.method());
        };
    }

    private static Map<String, String> requestHeaders(Route route) {
        if (route.operationId().equals("releasePlatformStagedAsset")) {
            return Map.of("X-Asset-Bind-Grant", "CP05-COVERAGE-INVALID-GRANT");
        }
        return Map.of();
    }

    private static Map<String, Object> requestBody(Route route, BackendAcceptanceTest.Fixture fixture) {
        if (STATUS_TRANSITIONS.contains(route.operationId())) {
            return Map.of("targetStatus", "DISABLED", "expectedVersion", 1);
        }
        if (STRICT_DICTIONARY_REQUESTS.contains(route.operationId())) {
            return Map.of(
                    "dictionaryKind", "ATTRIBUTE",
                    "orderedCodes", List.of("CP05-COVERAGE-MISSING-ENTRY"),
                    "dataNodeRef", fixture.storeId().toString());
        }
        return invalidBody(fixture);
    }

    private static void assertBusinessBoundary(Route route, BackendAcceptanceTest.Response response) {
        System.out.printf(
                "BACKEND_PERFORMANCE_COVERAGE OPERATION=%s METHOD=%s STATUS=%d PROBLEM=%s JSON_OBJECT=%s%n",
                route.operationId(),
                route.method(),
                response.status(),
                response.problemCode(),
                response.json().isObject());
        assertTrue(
                response.status() >= 200 && response.status() < 500,
                "BUSINESS: " + route.operationId() + " is not a server failure");
        if (response.status() >= 400) {
            assertFalse(
                    response.problemCode().isBlank(), "BUSINESS: " + route.operationId() + " returns a typed problem");
        } else if (response.status() != 204) {
            assertTrue(
                    response.json().isObject() && response.json().size() > 0,
                    "BUSINESS: " + route.operationId() + " returns a structured readback");
        }
    }

    private static String cookieFor(
            String face, BackendAcceptanceTest.Session operations, BackendAcceptanceTest.Session platform) {
        return switch (face) {
            case "operations-admin" -> operations.cookie();
            case "platform-admin" -> platform.cookie();
            case "public" -> null;
            default -> throw new AssertionError("BUSINESS: unknown consumer face " + face);
        };
    }

    private static Map<String, Object> invalidBody(BackendAcceptanceTest.Fixture fixture) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("dataNodeRef", fixture.storeId().toString());
        body.put("expectedVersion", 1);
        body.put("code", "CP05-COVERAGE-INVALID");
        body.put("name", "CP05 coverage validation request");
        body.put("mobile", "13900000000");
        body.put("loginName", "cp05-coverage-invalid");
        body.put("password", "not-the-current-password");
        body.put("currentPassword", "not-the-current-password");
        body.put("newPassword", "not-used");
        body.put("verificationCode", "000000");
        body.put("pageSize", 1);
        return body;
    }

    private static String requestPath(
            Route route,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session operationsSession,
            boolean query) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("groupWorkspaceKey", fixture.groupWorkspaceKey());
        values.put("regionId", fixture.regionId().toString());
        values.put("projectId", fixture.projectId().toString());
        values.put("brandId", fixture.brandId().toString());
        values.put("tenantId", fixture.tenantId().toString());
        values.put("storeId", fixture.storeId().toString());
        values.put(
                "headCompanyId",
                fixture.headCompanyId() == null
                        ? UUID.randomUUID().toString()
                        : fixture.headCompanyId().toString());
        values.put("nodeId", fixture.projectId().toString());
        values.put("categoryRef", UUID.randomUUID().toString());
        values.put("definitionRef", UUID.randomUUID().toString());
        values.put("category", "STORE");
        values.put("itemId", UUID.randomUUID().toString());
        values.put("contractId", UUID.randomUUID().toString());
        values.put("invitationId", UUID.randomUUID().toString());
        values.put("accountId", UUID.randomUUID().toString());
        values.put("roleId", UUID.randomUUID().toString());
        values.put("platformAdminId", UUID.randomUUID().toString());
        values.put("assignmentId", UUID.randomUUID().toString());
        values.put("channelRef", UUID.randomUUID().toString());
        values.put("externalSystemCode", "CP05-COVERAGE-EXTERNAL");
        values.put("assetRef", UUID.randomUUID().toString());
        values.put("itemCode", "CP05-COVERAGE-MISSING-ITEM");
        values.put("targetRef", UUID.randomUUID().toString());
        values.put("unitRef", UUID.randomUUID().toString());
        values.put("dictionaryKind", "ATTRIBUTE");
        values.put("entryCode", "CP05-COVERAGE-MISSING-ENTRY");
        values.put("tagCode", "CP05-COVERAGE-MISSING-TAG");
        String result = route.path().startsWith("/api") ? route.path() : "/api" + route.path();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            result = result.replace("{" + entry.getKey() + "}", encode(entry.getValue()));
        }
        if (result.contains("{")) throw new AssertionError("BUSINESS: unresolved CP-05 coverage path " + result);
        if (!query) return result;
        List<String> queryParameters = new ArrayList<>();
        queryParameters.add("dataNodeRef=" + encode(fixture.storeId().toString()));
        queryParameters.add("pageSize=1");
        if (CONTEXT_VERSION_READS.contains(route.operationId())) {
            queryParameters.add("expectedContextVersion=" + operationsSession.contextVersion());
        }
        if (CANDIDATE_READS.contains(route.operationId())) {
            queryParameters.add("subjectType=ORGANIZATION");
            queryParameters.add("candidateUsage=LIST_FILTER");
        }
        if (route.operationId().equals("getOperationsFixedStoreContracts")) {
            queryParameters.add("state=CURRENT");
        }
        if (route.operationId().equals("getOperationsInventoryTargetChangeSummary")) {
            queryParameters.add("period=30D");
        }
        return result + (result.contains("?") ? "&" : "?") + String.join("&", queryParameters);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static Route route(String operationId, String method, String path, String face) {
        return new Route(operationId, method, path, face, new BackendAcceptanceTest.RouteIdentity(operationId, path));
    }

    private record Route(
            String operationId,
            String method,
            String path,
            String face,
            BackendAcceptanceTest.RouteIdentity identity) {}
}
