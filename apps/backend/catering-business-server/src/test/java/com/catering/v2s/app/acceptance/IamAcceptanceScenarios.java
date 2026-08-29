package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

final class IamAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    IamAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(id = "iam.public-invitation-view", module = "IAM", operation = "getPublicInvitationView")
    void publicInvitationView(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("REGION", Set.of());
        BackendAcceptanceTest.Response response = context.get(
                PUBLIC_INVITATION_VIEW, BackendAcceptanceTest.publicInvitationPath(fixture), null, Set.of(200));
        JsonNode body = response.json();
        assertEquals(
                fixture.invitationId().toString(),
                body.path("invitationId").asText(),
                "BUSINESS: invitation identity is read back");
        assertEquals(
                fixture.groupWorkspaceKey(),
                body.path("groupWorkspaceKey").asText(),
                "BUSINESS: invitation remains in its workspace");
        assertEquals(
                "Acceptance Operations", body.path("operationsTitle").asText(), "BUSINESS: workspace title is exposed");
        assertEquals("REGION", body.path("targetOrganizationType").asText(), "BUSINESS: target type is preserved");
        assertPublicInvitationViewOracle(
                body,
                "getPublicInvitationView",
                host.mapper.valueToTree(List.of(Map.of(
                        "ref",
                        fixture.regionId().toString(),
                        "code",
                        "acceptance-region",
                        "name",
                        "Acceptance Region",
                        "nodeType",
                        "REGION"))));
        assertEquals(
                List.of("Acceptance Region Operator"),
                host.mapper.convertValue(
                        body.path("roleNames"),
                        host.mapper.getTypeFactory().constructCollectionType(List.class, String.class)),
                "BUSINESS: role is preserved");
        assertEquals("138****0012", body.path("maskedMobile").asText(), "BUSINESS: public mobile is masked");
        assertEquals("ACTIVE", body.path("status").asText(), "BUSINESS: pending invitation is publicly active");
        assertEquals("ACCEPT", body.path("nextStep").asText(), "BUSINESS: pending invitation starts at acceptance");
    }

    private static void assertPublicInvitationViewOracle(JsonNode json, String operationId, JsonNode expectedPath) {
        JsonNode actualPath = json.at("/targetOrganizationPathNodes");
        assertEquals(JsonNodeType.ARRAY, actualPath.getNodeType(), operationId + ": target path type");
        assertEquals(expectedPath, actualPath, operationId + ": exact target path");
    }

    @AcceptanceScenario(id = "iam.public-invitation-lifecycle", module = "IAM", operation = "publicInvitationLifecycle")
    void publicInvitationLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        long accountsBefore = host.count(
                "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND "
                        + "login_name_normalized=?",
                fixture.workspaceUuid(),
                fixture.loginName());
        long assignmentsBefore = host.count(
                "SELECT count(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?",
                fixture.invitationId());
        assertEquals(0, accountsBefore, "BUSINESS: account is not created before invitation completion");
        assertEquals(0, assignmentsBefore, "BUSINESS: assignment is not created before invitation completion");

        BackendAcceptanceTest.Response accepted = context.post(
                ACCEPT_PUBLIC_INVITATION,
                BackendAcceptanceTest.publicInvitationPath(fixture),
                null,
                Map.of(),
                Set.of(200));
        assertEquals(
                "VERIFY_MOBILE",
                accepted.json().path("nextStep").asText(),
                "BUSINESS: accept advances to mobile verification");
        BackendAcceptanceTest.Response viewAfterAccept = context.get(
                PUBLIC_INVITATION_VIEW, BackendAcceptanceTest.publicInvitationPath(fixture), null, Set.of(200));
        assertEquals(
                "VERIFY_MOBILE",
                viewAfterAccept.json().path("nextStep").asText(),
                "BUSINESS: resume state is persisted");

        BackendAcceptanceTest.Response sent = context.post(
                SEND_PUBLIC_INVITATION_OTP,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/send",
                null,
                Map.of("mobile", fixture.mobile()),
                Set.of(200));
        String debugCode = sent.json().path("debugVerificationCode").asText();
        assertTrue(
                debugCode.matches("[0-9]{6}"),
                "BUSINESS: test transport returns a transient OTP only in managed non-production");
        BackendAcceptanceTest.Response verified = context.post(
                VERIFY_PUBLIC_INVITATION_OTP,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/verify",
                null,
                Map.of("mobile", fixture.mobile(), "code", debugCode),
                Set.of(200));
        String verificationGrant = verified.json().path("verificationGrant").asText();
        assertTrue(!verificationGrant.isBlank(), "BUSINESS: OTP verification returns an opaque one-time grant");
        assertEquals(
                "COMPLETE_CREDENTIALS",
                verified.json().path("nextStep").asText(),
                "BUSINESS: verified invitation requires credentials");
        assertEquals(
                0,
                host.count(
                        "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND "
                                + "login_name_normalized=?",
                        fixture.workspaceUuid(),
                        fixture.loginName()),
                "BUSINESS: OTP verification does not create an account");

        BackendAcceptanceTest.Response credentials = context.post(
                SAVE_PUBLIC_INVITATION_CREDENTIALS,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/credentials",
                null,
                Map.of(
                        "verificationGrant",
                        verificationGrant,
                        "userName",
                        "Acceptance Operator",
                        "loginName",
                        fixture.loginName(),
                        "password",
                        OPERATIONS_PASSWORD),
                Set.of(200));
        assertEquals(
                "FINALIZE",
                credentials.json().path("nextStep").asText(),
                "BUSINESS: credentials move the invitation to finalize");
        assertEquals(
                "FINALIZE",
                context.get(
                                PUBLIC_INVITATION_VIEW,
                                BackendAcceptanceTest.publicInvitationPath(fixture),
                                null,
                                Set.of(200))
                        .json()
                        .path("nextStep")
                        .asText(),
                "BUSINESS: finalize state survives a fresh read");

        BackendAcceptanceTest.Response completed = context.post(
                COMPLETE_PUBLIC_INVITATION,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/complete",
                null,
                Map.of(),
                Set.of(200));
        assertEquals(
                "COMPLETED",
                completed.json().path("status").asText(),
                "BUSINESS: completion creates the terminal invitation state");
        BackendAcceptanceTest.Response duplicate = context.post(
                COMPLETE_PUBLIC_INVITATION,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/complete",
                null,
                Map.of(),
                Set.of(200));
        assertEquals("COMPLETED", duplicate.json().path("status").asText(), "BUSINESS: duplicate completion converges");
        assertEquals(
                1,
                host.count(
                        "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND "
                                + "login_name_normalized=?",
                        fixture.workspaceUuid(),
                        fixture.loginName()),
                "BUSINESS: exactly one account is written");
        assertEquals(
                1,
                host.count(
                        "SELECT count(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?",
                        fixture.invitationId()),
                "BUSINESS: exactly one assignment is written");
        assertEquals(
                "COMPLETED",
                context.get(
                                PUBLIC_INVITATION_COMPLETION,
                                BackendAcceptanceTest.publicInvitationPath(fixture) + "/completion",
                                null,
                                Set.of(200))
                        .json()
                        .path("status")
                        .asText(),
                "BUSINESS: completion readback is terminal");
    }

    @AcceptanceScenario(
            id = "iam.invitation-create-rejects-unbindable-account-or-role",
            module = "IAM",
            operation = "createWorkspaceInvitation")
    void invitationCreateRejectsUnbindableAccountOrRole(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("GROUP", Set.of(), Set.of());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        BackendAcceptanceTest.RouteIdentity createInvitation = new BackendAcceptanceTest.RouteIdentity(
                "createWorkspaceInvitation", "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations");
        String workspaceRoot = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey();
        for (String status : List.of("DISABLED", "VOIDED")) {
            String blockedMobile = uniqueMobile();
            insertAccount(
                    fixture,
                    blockedMobile,
                    "acceptance-" + status.toLowerCase(java.util.Locale.ROOT) + "-create-" + UUID.randomUUID(),
                    "Blocked Invite Account " + status,
                    status);
            UUID enabledRoleId = host.createEnabledRoles(fixture, "GROUP", 1).getFirst();
            BackendAcceptanceTest.Response blockedAccount = context.post(
                    createInvitation,
                    workspaceRoot + "/invitations",
                    platform.cookie(),
                    Map.of(
                            "mobile",
                            blockedMobile,
                            "targetOrganizationType",
                            "GROUP",
                            "targetOrganizationRef",
                            fixture.groupId().toString(),
                            "roleIds",
                            List.of(enabledRoleId.toString())),
                    Map.of(
                            "Idempotency-Key",
                            "acceptance-" + status.toLowerCase(java.util.Locale.ROOT) + "-account-invite-"
                                    + UUID.randomUUID()),
                    Set.of(422));
            assertEquals(
                    "ACCOUNT_NOT_BINDABLE",
                    blockedAccount.problemCode(),
                    "BUSINESS: " + status + " account is rejected with the approved typed problem");
            assertFalse(
                    blockedAccount.raw().contains(status),
                    "BUSINESS: public problem does not disclose the " + status + " account governance state");
            assertEquals(
                    0,
                    host.count(
                            "SELECT count(*) FROM workspace_iam.invitation WHERE workspace_uuid=? AND "
                                    + "group_workspace_key=? AND mobile_normalized=?",
                            fixture.workspaceUuid(),
                            fixture.groupWorkspaceKey(),
                            blockedMobile),
                    "BUSINESS: rejected " + status + " account create writes no invitation");
            assertEquals(
                    0,
                    host.count(
                            "SELECT count(*) FROM workspace_iam.invitation_assignment_intent i JOIN "
                                    + "workspace_iam.invitation v ON v.id=i.invitation_id WHERE v.workspace_uuid=? "
                                    + "AND v.group_workspace_key=? AND v.mobile_normalized=?",
                            fixture.workspaceUuid(),
                            fixture.groupWorkspaceKey(),
                            blockedMobile),
                    "BUSINESS: rejected " + status + " account create writes no assignment intent");
        }

        for (String status : List.of("DISABLED", "VOIDED")) {
            UUID blockedRoleId = host.createEnabledRoles(fixture, "GROUP", 1).getFirst();
            host.update("UPDATE workspace_iam.workspace_role SET status=? WHERE id=?", status, blockedRoleId);
            String roleBlockedMobile = uniqueMobile();
            BackendAcceptanceTest.Response blockedRole = context.post(
                    createInvitation,
                    workspaceRoot + "/invitations",
                    platform.cookie(),
                    Map.of(
                            "mobile",
                            roleBlockedMobile,
                            "targetOrganizationType",
                            "GROUP",
                            "targetOrganizationRef",
                            fixture.groupId().toString(),
                            "roleIds",
                            List.of(blockedRoleId.toString())),
                    Map.of(
                            "Idempotency-Key",
                            "acceptance-" + status.toLowerCase(java.util.Locale.ROOT) + "-role-invite-"
                                    + UUID.randomUUID()),
                    Set.of(422));
            assertEquals(
                    "PLATFORM_COMMON_VALIDATION_FAILED",
                    blockedRole.problemCode(),
                    "BUSINESS: " + status + " role is rejected before invitation creation");
            assertEquals(
                    0,
                    host.count(
                            "SELECT count(*) FROM workspace_iam.invitation WHERE workspace_uuid=? AND "
                                    + "group_workspace_key=? AND mobile_normalized=?",
                            fixture.workspaceUuid(),
                            fixture.groupWorkspaceKey(),
                            roleBlockedMobile),
                    "BUSINESS: " + status + " role create writes no invitation");
        }
    }

    @AcceptanceScenario(id = "iam.voided-account-management-read", module = "IAM", operation = "getWorkspaceAccounts")
    void voidedAccountManagementRead(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture platformFixture = host.fixture("GROUP", Set.of());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String platformRoot = "/api/platform/group-workspaces/" + platformFixture.groupWorkspaceKey();
        String platformMobile = uniqueMobile();
        UUID platformAccountId = insertAccount(
                platformFixture,
                platformMobile,
                "acceptance-voided-platform-" + UUID.randomUUID(),
                "Voided Platform Account",
                "VOIDED");
        BackendAcceptanceTest.Response platformPage = context.get(
                PLATFORM_WORKSPACE_ACCOUNTS,
                platformRoot + "/accounts?status=VOIDED&page=1&pageSize=50&sort=LOGIN_NAME&direction=ASC",
                platform.cookie(),
                Set.of(200));
        JsonNode platformAccount = null;
        for (JsonNode candidate : platformPage.json().path("items")) {
            if (platformAccountId.toString().equals(candidate.path("id").asText())) {
                platformAccount = candidate;
                break;
            }
        }
        assertNotNull(platformAccount, "BUSINESS: platform account list retains VOIDED governance history");
        assertEquals("VOIDED", platformAccount.path("status").asText(), "BUSINESS: platform list returns VOIDED");
        BackendAcceptanceTest.Response platformDetail = context.get(
                new BackendAcceptanceTest.RouteIdentity(
                        "getWorkspaceAccount",
                        "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}"),
                platformRoot + "/accounts/" + platformAccountId,
                platform.cookie(),
                Set.of(200));
        assertEquals(
                "VOIDED", platformDetail.json().path("status").asText(), "BUSINESS: platform detail returns VOIDED");

        BackendAcceptanceTest.Fixture operationsFixture = host.fixture("GROUP", Set.of());
        host.completeInvitation(context, operationsFixture);
        BackendAcceptanceTest.Session operations = host.login(context, operationsFixture);
        host.update(
                "UPDATE workspace_iam.workspace_account SET status='VOIDED' WHERE workspace_uuid=? AND "
                        + "group_workspace_key=? AND login_name_normalized=?",
                operationsFixture.workspaceUuid(),
                operationsFixture.groupWorkspaceKey(),
                operationsFixture.loginName());
        BackendAcceptanceTest.Response operationsPage = context.get(
                OPERATIONS_WORKSPACE_GROUP_USER,
                "/api/operations/group-workspaces/" + operationsFixture.groupWorkspaceKey()
                        + "/user-management/group/user?status=VOIDED&page=1&pageSize=20&expectedContextVersion="
                        + operations.contextVersion() + "&sort=LOGIN_NAME&direction=ASC",
                operations.cookie(),
                Set.of(200));
        assertEquals(
                1, operationsPage.json().path("items").size(), "BUSINESS: operations user list retains VOIDED account");
        assertEquals(
                "VOIDED",
                operationsPage.json().path("items").get(0).path("status").asText(),
                "BUSINESS: operations user list returns VOIDED");
    }

    @AcceptanceScenario(
            id = "iam.invitation-readiness-account-presence-status",
            module = "IAM",
            operation = "completePublicInvitation")
    void publicInvitationAccountFourStateAndCompleteRejection(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        for (String expectedStatus : List.of("ABSENT", "ENABLED", "DISABLED", "VOIDED")) {
            BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
            context.post(
                    ACCEPT_PUBLIC_INVITATION,
                    BackendAcceptanceTest.publicInvitationPath(fixture),
                    null,
                    Map.of(),
                    Set.of(200));
            BackendAcceptanceTest.Response sent = context.post(
                    SEND_PUBLIC_INVITATION_OTP,
                    BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/send",
                    null,
                    Map.of("mobile", fixture.mobile()),
                    Set.of(200));
            String code = sent.json().path("debugVerificationCode").asText();
            UUID accountId = null;
            if (!"ABSENT".equals(expectedStatus)) {
                accountId = insertAccount(
                        fixture,
                        fixture.mobile(),
                        "acceptance-readiness-" + expectedStatus.toLowerCase(java.util.Locale.ROOT) + "-"
                                + UUID.randomUUID(),
                        "Readiness Account " + expectedStatus,
                        expectedStatus);
            }
            BackendAcceptanceTest.Response verified = context.post(
                    VERIFY_PUBLIC_INVITATION_OTP,
                    BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/verify",
                    null,
                    Map.of("mobile", fixture.mobile(), "code", code),
                    Set.of(200));
            assertAccountPresenceOracle(
                    verified.json(), "verifyPublicInvitationOtp", expectedStatus, "COMPLETE_CREDENTIALS");
            assertEquals(
                    expectedStatus,
                    requiredJsonNode(
                                    verified.json(),
                                    "/accountExists",
                                    JsonNodeType.STRING,
                                    "BUSINESS: readiness account presence is a required string")
                            .asText(),
                    "BUSINESS: readiness reports " + expectedStatus + " without collapsing account presence");

            if (Set.of("DISABLED", "VOIDED").contains(expectedStatus)) {
                BackendAcceptanceTest.Response credentials = context.post(
                        SAVE_PUBLIC_INVITATION_CREDENTIALS,
                        BackendAcceptanceTest.publicInvitationPath(fixture) + "/credentials",
                        null,
                        Map.of(
                                "verificationGrant",
                                verified.json().path("verificationGrant").asText(),
                                "userName",
                                "Blocked Acceptance User " + expectedStatus,
                                "loginName",
                                fixture.loginName(),
                                "password",
                                OPERATIONS_PASSWORD),
                        Set.of(200));
                assertAccountPresenceOracle(
                        credentials.json(), "savePublicInvitationCredentials", expectedStatus, "FINALIZE");
                assertEquals(
                        expectedStatus,
                        requiredJsonNode(
                                        credentials.json(),
                                        "/accountExists",
                                        JsonNodeType.STRING,
                                        "BUSINESS: credential readiness account presence is a required string")
                                .asText(),
                        "BUSINESS: credential readiness preserves the " + expectedStatus + " account state");
                BackendAcceptanceTest.Response completed = context.post(
                        COMPLETE_PUBLIC_INVITATION,
                        BackendAcceptanceTest.publicInvitationPath(fixture) + "/complete",
                        null,
                        Map.of(),
                        Set.of(422));
                assertEquals(
                        "ACCOUNT_NOT_BINDABLE",
                        completed.problemCode(),
                        "BUSINESS: completion rejects the " + expectedStatus + " account");
                assertEquals(
                        0,
                        host.count(
                                "SELECT count(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?",
                                fixture.invitationId()),
                        "BUSINESS: rejected " + expectedStatus + " completion writes no assignment");
                assertEquals(
                        0,
                        host.count(
                                "SELECT count(*) FROM workspace_iam.workspace_credential WHERE account_id=?",
                                accountId),
                        "BUSINESS: rejected " + expectedStatus + " completion writes no credential");
                assertEquals(
                        "CREDENTIAL_READY",
                        host.text("SELECT status FROM workspace_iam.invitation WHERE id=?", fixture.invitationId()),
                        "BUSINESS: rejected " + expectedStatus + " completion rolls back the transient state");
            }
        }
    }

    private static void assertAccountPresenceOracle(
            JsonNode json, String operationId, String expectedAccountStatus, String expectedNextStep) {
        JsonNode accountExists = json.at("/accountExists");
        JsonNode nextStep = json.at("/nextStep");
        assertEquals(JsonNodeType.STRING, accountExists.getNodeType(), operationId + ": account presence type");
        assertEquals(JsonNodeType.STRING, nextStep.getNodeType(), operationId + ": next step type");
        assertEquals(expectedAccountStatus, accountExists.asText(), operationId + ": account presence");
        assertEquals(expectedNextStep, nextStep.asText(), operationId + ": next step");
    }

    @AcceptanceScenario(
            id = "iam.operations-session-workspace-isolation",
            module = "IAM",
            operation = "operationsSessionIsolation")
    void operationsSessionWorkspaceIsolation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-ORG-PROJECT-EDIT"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        assertEquals(
                fixture.groupWorkspaceKey(),
                session.entry().path("groupWorkspaceKey").asText(),
                "BUSINESS: session is bound to the invited workspace");
        assertEquals(
                "PROJECT",
                session.entry().path("selected").path("roleNodeType").asText(),
                "BUSINESS: selected identity is the invited project role");
        assertEquals(
                fixture.projectId().toString(),
                session.entry()
                        .path("scopeContext")
                        .path("project")
                        .path("dataNodeRef")
                        .asText(),
                "BUSINESS: data scope is owner-selected");
        assertTrue(
                session.entry().path("actionGrants").toString().contains("BC-ORG-PROJECT-EDIT"),
                "BUSINESS: action capability is explicit in session readback");
        BackendAcceptanceTest.Response fresh = context.get(
                OPERATIONS_WORKSPACE_SESSION_ENTRY,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/session/entry",
                session.cookie(),
                Set.of(200));
        assertEquals(
                session.contextVersion(),
                fresh.json().path("contextVersion").asLong(),
                "BUSINESS: session context version is stable across readback");
        String foreignWorkspaceKey = "foreign-" + UUID.randomUUID().toString().substring(0, 12);
        BackendAcceptanceTest.Response wrongWorkspace = context.get(
                OPERATIONS_WORKSPACE_SESSION_ENTRY,
                "/api/operations/group-workspaces/" + foreignWorkspaceKey + "/session/entry",
                session.cookie(),
                Set.of(401));
        assertFalse(
                wrongWorkspace.raw().contains(fixture.groupWorkspaceKey()),
                "BUSINESS: a workspace key cannot authorize or disclose another workspace session");
        assertFalse(
                wrongWorkspace.json().has("scopeContext"), "BUSINESS: foreign workspace response has no session scope");
        assertFalse(
                wrongWorkspace.json().has("actionGrants"),
                "BUSINESS: foreign workspace response has no session grants");
    }

    @AcceptanceScenario(
            id = "pagination.workspace-user-candidates-db-page",
            module = "IAM",
            operation = "getWorkspaceInvitationCandidates")
    void operationsInvitationCandidatesPage(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("GROUP", Set.of("PG-IAM-HEAD-COMPANY-USERS"), Set.of());
        List<UUID> expectedIds = host.createHeadCompanyCandidates(fixture, 23);
        List<UUID> expectedRoleIds = host.createEnabledRoles(fixture, "HEAD_COMPANY", 23);
        BackendAcceptanceTest.Fixture foreign = host.fixture("GROUP", Set.of("PG-IAM-HEAD-COMPANY-USERS"), Set.of());
        List<UUID> foreignCandidateIds = host.createHeadCompanyCandidates(foreign, 3);
        List<UUID> foreignRoleIds = host.createEnabledRoles(foreign, "HEAD_COMPANY", 3);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platformSession = host.platformLogin(context);
        String prefix = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                + "/invitation-candidates"
                + "?targetOrganizationType=HEAD_COMPANY&subjectType=ORGANIZATION&candidateUsage=LIST_FILTER"
                + "&pageSize=10&page=";

        List<UUID> actualIds = new java.util.ArrayList<>();
        for (int page = 1; page <= 3; page++) {
            BackendAcceptanceTest.Response response = context.get(
                    BackendAcceptanceTest.PLATFORM_WORKSPACE_INVITATION_CANDIDATES,
                    prefix + page,
                    platformSession.cookie(),
                    Set.of(200));
            JsonNode body = response.json();
            JsonNode metadata = body.path("metadata");
            assertEquals("ORGANIZATION", metadata.path("subjectType").asText(), "BUSINESS: subject is preserved");
            assertEquals(page, metadata.path("page").asInt(), "BUSINESS: page identity is preserved");
            assertEquals(10, metadata.path("pageSize").asInt(), "BUSINESS: page size is preserved");
            assertEquals(23, metadata.path("total").asInt(), "BUSINESS: total is the complete filtered count");
            JsonNode organizations = body.path("organizations");
            assertEquals(page < 3 ? 10 : 3, organizations.size(), "BUSINESS: page boundary is owner-enforced");
            for (JsonNode organization : organizations) {
                UUID id = UUID.fromString(organization.path("organizationRef").asText());
                assertTrue(expectedIds.contains(id), "BUSINESS: current workspace candidate is returned");
                assertFalse(foreignCandidateIds.contains(id), "BUSINESS: foreign workspace candidate is hidden");
                assertTrue(actualIds.add(id), "BUSINESS: pages do not repeat a candidate");
            }
        }
        assertEquals(expectedIds.size(), actualIds.size(), "BUSINESS: pages cover the complete candidate set");
        assertEquals(
                Set.copyOf(expectedIds),
                Set.copyOf(actualIds),
                "BUSINESS: page traversal neither omits nor adds a candidate");

        List<UUID> actualRoleIds = new java.util.ArrayList<>();
        String rolePrefix = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                + "/invitation-candidates"
                + "?targetOrganizationType=HEAD_COMPANY&subjectType=ROLE&candidateUsage=LIST_FILTER&pageSize=10&page=";
        for (int page = 1; page <= 3; page++) {
            BackendAcceptanceTest.Response response = context.get(
                    BackendAcceptanceTest.PLATFORM_WORKSPACE_INVITATION_CANDIDATES,
                    rolePrefix + page,
                    platformSession.cookie(),
                    Set.of(200));
            JsonNode body = response.json();
            assertEquals("ROLE", body.path("metadata").path("subjectType").asText());
            assertEquals(23, body.path("metadata").path("total").asInt());
            JsonNode roles = body.path("roles");
            assertEquals(page < 3 ? 10 : 3, roles.size(), "BUSINESS: role page boundary is owner-enforced");
            for (JsonNode role : roles) {
                UUID id = UUID.fromString(role.path("id").asText());
                assertTrue(expectedRoleIds.contains(id), "BUSINESS: enabled role belongs to requested workspace");
                assertFalse(foreignRoleIds.contains(id), "BUSINESS: foreign workspace role is hidden");
                assertTrue(actualRoleIds.add(id), "BUSINESS: role pages do not repeat an item");
            }
        }
        assertEquals(
                Set.copyOf(expectedRoleIds),
                Set.copyOf(actualRoleIds),
                "BUSINESS: role pages cover the complete database-filtered set");
        assertCandidateOperationSet(context);
    }

    @AcceptanceScenario(
            id = "pagination.workspace-iam-page-owner-boundary",
            module = "IAM",
            operation = "workspaceIamPageOwnerBoundary")
    void workspaceIamPageOwnerBoundary(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("GROUP", Set.of("PG-IAM-STORE-USERS"), Set.of());
        List<BackendAcceptanceTest.Fixture> groupMembers = new java.util.ArrayList<>();
        for (int index = 0; index < 11; index++) {
            BackendAcceptanceTest.Fixture groupMember = host.groupUserFixture(fixture, Set.of());
            host.completeInvitation(context, groupMember);
            groupMembers.add(groupMember);
        }
        BackendAcceptanceTest.Fixture scoped = host.siblingStoreFixture(fixture, Set.of());
        host.completeInvitation(context, scoped);
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operationsSession = host.login(context, fixture);
        String operationsRoot = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
        int expectedGroupTotal = groupMembers.size() + 1;
        int expectedWorkspaceTotal = groupMembers.size() + 2;

        collectTwoPages(
                context,
                OPERATIONS_WORKSPACE_GROUP_USER,
                operationsRoot + "/user-management/group/user?pageSize=10&expectedContextVersion="
                        + operationsSession.contextVersion() + "&sort=LOGIN_NAME&direction=ASC&page=",
                operationsSession.cookie(),
                "accountId",
                expectedGroupTotal,
                "BUSINESS: group user pages are filtered and counted by workspace-iam");
        collectTwoPages(
                context,
                OPERATIONS_WORKSPACE_GROUP_INVITATIONS,
                operationsRoot + "/user-management/group/invitations?pageSize=10&expectedContextVersion="
                        + operationsSession.contextVersion() + "&sort=CREATED_AT&direction=ASC&page=",
                operationsSession.cookie(),
                "id",
                expectedGroupTotal,
                "BUSINESS: group invitation pages are filtered and counted by workspace-iam");

        BackendAcceptanceTest.Response selectedStore = context.post(
                OPERATIONS_WORKSPACE_SESSION_DATA_NODE,
                operationsRoot + "/session/data-node",
                operationsSession.cookie(),
                Map.of(
                        "dataNodeRef", scoped.storeId(),
                        "dataNodeType", "STORE",
                        "requiredContextVersion", operationsSession.contextVersion()),
                Map.of("Idempotency-Key", "acceptance-iam-store-scope-selection"),
                Set.of(200));
        BackendAcceptanceTest.Session storeSession = new BackendAcceptanceTest.Session(
                operationsSession.cookie(),
                selectedStore.json(),
                selectedStore.json().path("contextVersion").asLong());
        assertEquals(
                scoped.storeId().toString(),
                storeSession
                        .entry()
                        .path("scopeContext")
                        .path("store")
                        .path("dataNodeRef")
                        .asText(),
                "BUSINESS: session data-node selection establishes the requested store scope");

        BackendAcceptanceTest.Response scopedUsers = context.get(
                OPERATIONS_WORKSPACE_STORE_USER,
                operationsRoot + "/user-management/store/user?scopeRef=" + scoped.storeId()
                        + "&page=1&pageSize=10&expectedContextVersion=" + storeSession.contextVersion()
                        + "&sort=LOGIN_NAME&direction=ASC",
                storeSession.cookie(),
                Set.of(200));
        assertEquals(1, scopedUsers.json().path("total").asInt(), "BUSINESS: exact store scope has one account");
        assertEquals(
                1,
                scopedUsers.json().path("items").size(),
                "BUSINESS: exact store scope does not inherit the group page");
        assertEquals(
                scoped.loginName(),
                scopedUsers.json().path("items").get(0).path("loginName").asText(),
                "BUSINESS: exact store scope identifies its own account");

        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platformSession = host.platformLogin(context);
        String platformRoot = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey();
        collectTwoPages(
                context,
                PLATFORM_WORKSPACE_ACCOUNTS,
                platformRoot + "/accounts?pageSize=10&sort=LOGIN_NAME&direction=ASC&page=",
                platformSession.cookie(),
                "id",
                expectedWorkspaceTotal,
                "BUSINESS: platform account pages expose the complete workspace set");
        collectTwoPages(
                context,
                PLATFORM_WORKSPACE_INVITATIONS,
                platformRoot + "/invitations?pageSize=10&sort=CREATED_AT&direction=ASC&page=",
                platformSession.cookie(),
                "id",
                expectedWorkspaceTotal,
                "BUSINESS: platform invitation pages expose the complete workspace set");
        collectTwoPages(
                context,
                PLATFORM_WORKSPACE_ROLES,
                platformRoot + "/roles?pageSize=10&sort=NAME&direction=ASC&page=",
                platformSession.cookie(),
                "id",
                expectedWorkspaceTotal,
                "BUSINESS: platform role pages expose the complete workspace set");

        BackendAcceptanceTest.Fixture foreign = host.fixture("GROUP", Set.of());
        BackendAcceptanceTest.Response foreignAccounts = context.get(
                PLATFORM_WORKSPACE_ACCOUNTS,
                "/api/platform/group-workspaces/" + foreign.groupWorkspaceKey()
                        + "/accounts?page=1&pageSize=10&sort=LOGIN_NAME&direction=ASC",
                platformSession.cookie(),
                Set.of(200));
        assertEquals(
                0,
                foreignAccounts.json().path("total").asInt(),
                "BUSINESS: a different workspace has no visible accounts in the current fixture");
        assertInvitationRouteOperationSet(context);
        assertAccountOrganizationOperationSet(context);
    }

    private static List<String> collectTwoPages(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.RouteIdentity route,
            String urlPrefix,
            String cookie,
            String itemIdField,
            int expectedTotal,
            String message)
            throws Exception {
        List<String> ids = new java.util.ArrayList<>();
        for (int page = 1; page <= 2; page++) {
            BackendAcceptanceTest.Response response = context.get(route, urlPrefix + page, cookie, Set.of(200));
            JsonNode body = response.json();
            assertEquals(page, body.path("page").asInt(), message + ": page identity");
            assertEquals(10, body.path("pageSize").asInt(), message + ": page size");
            assertEquals(expectedTotal, body.path("total").asInt(), message + ": total is not current page length");
            JsonNode items = body.path("items");
            assertEquals(page == 1 ? 10 : expectedTotal - 10, items.size(), message + ": page boundary");
            for (JsonNode item : items) {
                assertTrue(ids.add(item.path(itemIdField).asText()), message + ": pages do not repeat items");
            }
        }
        assertEquals(expectedTotal, ids.size(), message + ": pages cover the complete filtered set");
        return List.copyOf(ids);
    }

    /**
     * A-2 candidate coverage deliberately uses the two response variants exposed by the same HTTP operation: an
     * ORGANIZATION response owns path/pathNodes, while a ROLE response owns role status. Keeping those cases separate
     * prevents Jackson path coercion from making a missing branch look valid.
     */
    private void assertCandidateOperationSet(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Fixture platformFixture = host.fixture("HEAD_COMPANY", Set.of());
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        JsonNode expectedPlatformPath = expectedPath(platformFixture, "HEAD_COMPANY");
        String platformRoot = "/api/platform/group-workspaces/" + platformFixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response platformOrganizations = context.get(
                PLATFORM_WORKSPACE_INVITATION_CANDIDATES,
                platformRoot
                        + "/invitation-candidates?targetOrganizationType=HEAD_COMPANY&subjectType=ORGANIZATION"
                        + "&candidateUsage=LIST_FILTER&page=1&pageSize=20",
                platform.cookie(),
                Set.of(200));
        assertCandidateOracle(
                platformOrganizations.json(),
                "getWorkspaceInvitationCandidates",
                expectedPlatformPath,
                candidateDisplayPath("HEAD_COMPANY"),
                true);
        BackendAcceptanceTest.Response platformRoles = context.get(
                PLATFORM_WORKSPACE_INVITATION_CANDIDATES,
                platformRoot
                        + "/invitation-candidates?targetOrganizationType=HEAD_COMPANY&subjectType=ROLE"
                        + "&candidateUsage=LIST_FILTER&page=1&pageSize=20",
                platform.cookie(),
                Set.of(200));
        assertCandidateOracle(
                platformRoles.json(),
                "getWorkspaceInvitationCandidates",
                expectedPlatformPath,
                candidateDisplayPath("HEAD_COMPANY"),
                false);

        for (String targetType : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            String pageKey = "PG-IAM-" + targetType.replace('_', '-') + "-USERS";
            BackendAcceptanceTest.Fixture fixture = host.fixture(targetType, Set.of(pageKey), Set.of());
            host.completeInvitation(context, fixture);
            BackendAcceptanceTest.Session operations = host.login(context, fixture);
            UUID targetRef = targetRef(fixture, targetType);
            String scope = "&scopeRef=" + targetRef;
            String root = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
            BackendAcceptanceTest.Response response = context.get(
                    operationsCandidateRoute(targetType),
                    root + "/user-management/" + targetSlug(targetType) + "/invitations/candidates"
                            + "?subjectType=ORGANIZATION&candidateUsage=INVITATION_TARGET&page=1&pageSize=20"
                            + scope + "&expectedContextVersion=" + operations.contextVersion(),
                    operations.cookie(),
                    Set.of(200));
            assertOperationsCandidateOracle(
                    response.json(), targetType, expectedPath(fixture, targetType), candidateDisplayPath(targetType));
            BackendAcceptanceTest.Response roles = context.get(
                    operationsCandidateRoute(targetType),
                    root + "/user-management/" + targetSlug(targetType) + "/invitations/candidates"
                            + "?subjectType=ROLE&candidateUsage=LIST_FILTER&page=1&pageSize=20"
                            + scope + "&expectedContextVersion=" + operations.contextVersion(),
                    operations.cookie(),
                    Set.of(200));
            assertOperationsCandidateRoleOracle(roles.json(), targetType);
        }
    }

    private void assertInvitationRouteOperationSet(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Fixture platformFixture = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        JsonNode platformPath = expectedPath(platformFixture, "PROJECT");
        String platformRoot = "/api/platform/group-workspaces/" + platformFixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response platformList = context.get(
                PLATFORM_WORKSPACE_INVITATIONS,
                platformRoot + "/invitations?mobile=" + platformFixture.mobile()
                        + "&targetOrganizationType=PROJECT&page=1&pageSize=50&sort=CREATED_AT&direction=ASC",
                platform.cookie(),
                Set.of(200));
        assertInvitationOracle(
                platformList.json(),
                "getWorkspaceInvitations",
                platformPath,
                platformFixture.groupWorkspaceKey(),
                platformFixture.invitationToken(),
                true);
        BackendAcceptanceTest.Response platformDetail = context.get(
                PLATFORM_WORKSPACE_INVITATION,
                platformRoot + "/invitations/" + platformFixture.invitationId(),
                platform.cookie(),
                Set.of(200));
        assertInvitationOracle(
                platformDetail.json(),
                "getWorkspaceInvitation",
                platformPath,
                platformFixture.groupWorkspaceKey(),
                platformFixture.invitationToken(),
                false);

        UUID platformRoleId = invitationRoleId(platformFixture);
        BackendAcceptanceTest.Response platformCreated = context.post(
                PLATFORM_WORKSPACE_INVITATION_CREATE,
                platformRoot + "/invitations",
                platform.cookie(),
                Map.of(
                        "mobile", uniqueMobile(),
                        "targetOrganizationType", "PROJECT",
                        "targetOrganizationRef", platformFixture.projectId().toString(),
                        "roleIds", List.of(platformRoleId.toString())),
                Map.of("Idempotency-Key", "acceptance-base1-platform-create-" + UUID.randomUUID()),
                Set.of(201));
        UUID platformCreatedId =
                UUID.fromString(platformCreated.json().at("/id").asText());
        assertInvitationOracle(
                platformCreated.json(),
                "createWorkspaceInvitation",
                platformPath,
                platformFixture.groupWorkspaceKey(),
                invitationToken(platformCreatedId),
                false);
        long platformCreatedVersion = invitationVersion(platformCreatedId);
        BackendAcceptanceTest.Response platformReissued = context.post(
                PLATFORM_WORKSPACE_INVITATION_REISSUE,
                platformRoot + "/invitations/" + platformCreatedId + "/reissue",
                platform.cookie(),
                Map.of("expectedVersion", platformCreatedVersion),
                Map.of("Idempotency-Key", "acceptance-base1-platform-reissue-" + UUID.randomUUID()),
                Set.of(200));
        UUID platformReissuedId =
                UUID.fromString(platformReissued.json().at("/id").asText());
        assertInvitationOracle(
                platformReissued.json(),
                "reissueWorkspaceInvitation",
                platformPath,
                platformFixture.groupWorkspaceKey(),
                invitationToken(platformReissuedId),
                false);
        long platformReissuedVersion = invitationVersion(platformReissuedId);
        BackendAcceptanceTest.Response platformCancelled = context.post(
                PLATFORM_WORKSPACE_INVITATION_CANCEL,
                platformRoot + "/invitations/" + platformReissuedId + "/cancel",
                platform.cookie(),
                Map.of("expectedVersion", platformReissuedVersion),
                Map.of("Idempotency-Key", "acceptance-base1-platform-cancel-" + UUID.randomUUID()),
                Set.of(200));
        assertInvitationOracle(
                platformCancelled.json(),
                "cancelWorkspaceInvitation",
                platformPath,
                platformFixture.groupWorkspaceKey(),
                invitationToken(platformReissuedId),
                false);

        for (String targetType : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            String pageKey = "PG-IAM-" + targetType.replace('_', '-') + "-USERS";
            String capabilityPrefix = "BC-IAM-" + targetType.replace('_', '-') + "-";
            BackendAcceptanceTest.Fixture fixture = host.fixture(
                    targetType, Set.of(pageKey), Set.of(capabilityPrefix + "INVITE", capabilityPrefix + "ROLE-REVOKE"));
            host.completeInvitation(context, fixture);
            BackendAcceptanceTest.Session operations = host.login(context, fixture);
            UUID targetRef = targetRef(fixture, targetType);
            String root = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
            String slug = targetSlug(targetType);
            String scope = "scopeRef=" + targetRef;
            String expectedContext = "expectedContextVersion=" + operations.contextVersion();

            BackendAcceptanceTest.Response list = context.get(
                    operationsInvitationListRoute(targetType),
                    root + "/user-management/" + slug + "/invitations?" + scope + "&mobile="
                            + fixture.mobile() + "&page=1&pageSize=20&sort=CREATED_AT&direction=ASC&"
                            + expectedContext,
                    operations.cookie(),
                    Set.of(200));
            assertOperationsInvitationListOracle(
                    list.json(), targetType, expectedPath(fixture, targetType), fixture, true);

            UUID roleId = invitationRoleId(fixture);
            String createKey = "acceptance-base1-operations-create-" + targetType + "-" + UUID.randomUUID();
            Map<String, Object> createBody = new java.util.LinkedHashMap<>();
            createBody.put("scopeRef", targetRef.toString());
            createBody.put("mobile", uniqueMobile());
            createBody.put("roleIds", List.of(roleId.toString()));
            createBody.put("idempotencyKey", createKey);
            BackendAcceptanceTest.Response created = context.post(
                    operationsInvitationCreateRoute(targetType),
                    root + "/user-management/" + slug + "/invitations",
                    operations.cookie(),
                    createBody,
                    Map.of("Idempotency-Key", createKey),
                    Set.of(201));
            UUID createdId = UUID.fromString(created.json().at("/id").asText());
            assertOperationsInvitationCreateOracle(
                    created.json(), targetType, expectedPath(fixture, targetType), fixture, createdId);

            long createdVersion = invitationVersion(createdId);
            String reissueKey = "acceptance-base1-operations-reissue-" + targetType + "-" + UUID.randomUUID();
            BackendAcceptanceTest.Response reissued = context.post(
                    operationsInvitationReissueRoute(targetType),
                    root + "/user-management/" + slug + "/invitations/" + createdId + "/reissue",
                    operations.cookie(),
                    invitationAction(targetRef, operations.contextVersion(), createdVersion, reissueKey),
                    Map.of("Idempotency-Key", reissueKey),
                    Set.of(200));
            UUID reissuedId = UUID.fromString(reissued.json().at("/id").asText());
            assertOperationsInvitationReissueOracle(
                    reissued.json(), targetType, expectedPath(fixture, targetType), fixture, reissuedId);

            long reissuedVersion = invitationVersion(reissuedId);
            String cancelKey = "acceptance-base1-operations-cancel-" + targetType + "-" + UUID.randomUUID();
            BackendAcceptanceTest.Response cancelled = context.post(
                    operationsInvitationCancelRoute(targetType),
                    root + "/user-management/" + slug + "/invitations/" + reissuedId + "/cancel",
                    operations.cookie(),
                    invitationAction(targetRef, operations.contextVersion(), reissuedVersion, cancelKey),
                    Map.of("Idempotency-Key", cancelKey),
                    Set.of(200));
            assertOperationsInvitationCancelOracle(
                    cancelled.json(), targetType, expectedPath(fixture, targetType), fixture, reissuedId);
        }
    }

    private void assertAccountOrganizationOperationSet(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture platformFixture = host.fixture("STORE", Set.of());
        host.completeInvitation(context, platformFixture);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        JsonNode platformPath = expectedPath(platformFixture, "STORE");
        UUID platformAccountId = accountId(platformFixture);
        String platformRoot = "/api/platform/group-workspaces/" + platformFixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response platformPage = context.get(
                PLATFORM_WORKSPACE_ACCOUNTS,
                platformRoot + "/accounts?loginName=" + platformFixture.loginName()
                        + "&page=1&pageSize=50&sort=LOGIN_NAME&direction=ASC",
                platform.cookie(),
                Set.of(200));
        assertAccountOracle(
                platformPage.json(),
                "getWorkspaceAccounts",
                "/items/0/status",
                "/items/0/assignments/0/organizationPathNodes",
                "ENABLED",
                platformPath);
        BackendAcceptanceTest.Response platformDetail = context.get(
                PLATFORM_WORKSPACE_ACCOUNT,
                platformRoot + "/accounts/" + platformAccountId,
                platform.cookie(),
                Set.of(200));
        assertAccountOracle(
                platformDetail.json(),
                "getWorkspaceAccount",
                "/status",
                "/assignments/0/organizationPathNodes",
                "ENABLED",
                platformPath);
        long accountVersion = accountVersion(platformAccountId);
        BackendAcceptanceTest.Response platformStatus = context.post(
                PLATFORM_WORKSPACE_ACCOUNT_STATUS,
                platformRoot + "/accounts/" + platformAccountId + "/status",
                platform.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", accountVersion),
                Map.of("Idempotency-Key", "acceptance-base1-platform-account-status-" + UUID.randomUUID()),
                Set.of(200));
        assertAccountOracle(
                platformStatus.json(),
                "transitionWorkspaceAccountStatus",
                "/status",
                "/assignments/0/organizationPathNodes",
                "DISABLED",
                platformPath);

        for (String targetType : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            String pageKey = "PG-IAM-" + targetType.replace('_', '-') + "-USERS";
            String capabilityPrefix = "BC-IAM-" + targetType.replace('_', '-') + "-";
            BackendAcceptanceTest.Fixture fixture =
                    host.fixture(targetType, Set.of(pageKey), Set.of(capabilityPrefix + "ROLE-REVOKE"));
            host.completeInvitation(context, fixture);
            BackendAcceptanceTest.Session operations = host.login(context, fixture);
            UUID targetRef = targetRef(fixture, targetType);
            String root = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
            String slug = targetSlug(targetType);
            String common = "scopeRef=" + targetRef + "&page=1&pageSize=20&expectedContextVersion="
                    + operations.contextVersion() + "&sort=LOGIN_NAME&direction=ASC";
            BackendAcceptanceTest.Response page = context.get(
                    operationsUserPageRoute(targetType),
                    root + "/user-management/" + slug + "/user?" + common,
                    operations.cookie(),
                    Set.of(200));
            assertOperationsUserPageOracle(page.json(), targetType, expectedPath(fixture, targetType));

            UUID accountId = accountId(fixture);
            BackendAcceptanceTest.Response detail = context.get(
                    operationsUserDetailRoute(targetType),
                    root + "/user-management/" + slug + "/user/accounts/" + accountId + "?expectedContextVersion="
                            + operations.contextVersion(),
                    operations.cookie(),
                    Set.of(200));
            assertOperationsUserDetailOracle(detail.json(), targetType, expectedPath(fixture, targetType));

            UUID assignmentId = assignmentId(accountId, targetType, targetRef);
            long assignmentVersion = assignmentVersion(assignmentId);
            BackendAcceptanceTest.Response revoked = context.post(
                    operationsUserRevokeRoute(targetType),
                    root + "/user-management/" + slug + "/user/assignments/" + assignmentId + "/revoke",
                    operations.cookie(),
                    Map.of("expectedVersion", assignmentVersion),
                    Map.of(
                            "Idempotency-Key",
                            "acceptance-base1-operations-revoke-" + targetType + "-" + UUID.randomUUID()),
                    Set.of(200));
            assertOperationsUserRevokeOracle(revoked.json(), targetType, expectedPath(fixture, targetType));
        }
    }

    private void assertCandidateOracle(
            JsonNode json,
            String operationId,
            JsonNode expectedPath,
            String expectedDisplayPath,
            boolean organizationCase) {
        JsonNode organizationPath = json.at("/organizations/0/path");
        JsonNode organizationPathNodes = json.at("/organizations/0/pathNodes");
        JsonNode roleStatus = json.at("/roles/0/status");
        if (organizationCase) {
            assertEquals(JsonNodeType.STRING, organizationPath.getNodeType(), operationId + ": candidate path type");
            assertEquals(JsonNodeType.ARRAY, organizationPathNodes.getNodeType(), operationId + ": path nodes type");
            assertEquals(expectedDisplayPath, organizationPath.asText(), operationId + ": candidate display path");
            assertEquals(expectedPath, organizationPathNodes, operationId + ": ordered candidate path nodes");
        } else {
            assertEquals(JsonNodeType.STRING, roleStatus.getNodeType(), operationId + ": role status type");
            assertEquals("ENABLED", roleStatus.asText(), operationId + ": enabled role candidate");
        }
    }

    private void assertOperationsCandidateOracle(
            JsonNode json, String targetType, JsonNode expectedPath, String expectedDisplayPath) {
        switch (targetType) {
            case "GROUP" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceGroupInvitationCandidates", expectedPath, expectedDisplayPath, true);
            case "REGION" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceRegionInvitationCandidates", expectedPath, expectedDisplayPath, true);
            case "PROJECT" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceProjectInvitationCandidates", expectedPath, expectedDisplayPath, true);
            case "HEAD_COMPANY" -> assertCandidateOracle(
                    json,
                    "getOperationsWorkspaceHeadCompanyInvitationCandidates",
                    expectedPath,
                    expectedDisplayPath,
                    true);
            case "STORE" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceStoreInvitationCandidates", expectedPath, expectedDisplayPath, true);
            default -> throw new IllegalArgumentException("unsupported candidate target " + targetType);
        }
    }

    private void assertOperationsCandidateRoleOracle(JsonNode json, String targetType) {
        switch (targetType) {
            case "GROUP" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceGroupInvitationCandidates", null, null, false);
            case "REGION" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceRegionInvitationCandidates", null, null, false);
            case "PROJECT" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceProjectInvitationCandidates", null, null, false);
            case "HEAD_COMPANY" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceHeadCompanyInvitationCandidates", null, null, false);
            case "STORE" -> assertCandidateOracle(
                    json, "getOperationsWorkspaceStoreInvitationCandidates", null, null, false);
            default -> throw new IllegalArgumentException("unsupported candidate role target " + targetType);
        }
    }

    private void assertInvitationOracle(
            JsonNode json,
            String operationId,
            JsonNode expectedPath,
            String expectedWorkspaceKey,
            String expectedToken,
            boolean page) {
        String pathPointer = page ? "/items/0/targetOrganizationPathNodes" : "/targetOrganizationPathNodes";
        String factsPointer = page ? "/items/0/invitationRouteFacts" : "/invitationRouteFacts";
        JsonNode path = json.at(pathPointer);
        JsonNode facts = json.at(factsPointer);
        assertEquals(JsonNodeType.ARRAY, path.getNodeType(), operationId + ": invitation path type");
        assertEquals(JsonNodeType.OBJECT, facts.getNodeType(), operationId + ": route facts type");
        assertEquals(expectedPath, path, operationId + ": ordered invitation path nodes");
        assertEquals(
                host.mapper.valueToTree(Map.of(
                        "groupWorkspaceKey", expectedWorkspaceKey,
                        "invitationToken", expectedToken)),
                facts,
                operationId + ": route facts are exact");
    }

    private void assertOperationsInvitationListOracle(
            JsonNode json,
            String targetType,
            JsonNode expectedPath,
            BackendAcceptanceTest.Fixture fixture,
            boolean page) {
        switch (targetType) {
            case "GROUP" -> assertInvitationOracle(
                    json,
                    "getOperationsWorkspaceGroupInvitations",
                    expectedPath,
                    fixture.groupWorkspaceKey(),
                    fixture.invitationToken(),
                    page);
            case "REGION" -> assertInvitationOracle(
                    json,
                    "getOperationsWorkspaceRegionInvitations",
                    expectedPath,
                    fixture.groupWorkspaceKey(),
                    fixture.invitationToken(),
                    page);
            case "PROJECT" -> assertInvitationOracle(
                    json,
                    "getOperationsWorkspaceProjectInvitations",
                    expectedPath,
                    fixture.groupWorkspaceKey(),
                    fixture.invitationToken(),
                    page);
            case "HEAD_COMPANY" -> assertInvitationOracle(
                    json,
                    "getOperationsWorkspaceHeadCompanyInvitations",
                    expectedPath,
                    fixture.groupWorkspaceKey(),
                    fixture.invitationToken(),
                    page);
            case "STORE" -> assertInvitationOracle(
                    json,
                    "getOperationsWorkspaceStoreInvitations",
                    expectedPath,
                    fixture.groupWorkspaceKey(),
                    fixture.invitationToken(),
                    page);
            default -> throw new IllegalArgumentException("unsupported invitation target " + targetType);
        }
    }

    private void assertOperationsInvitationCreateOracle(
            JsonNode json,
            String targetType,
            JsonNode expectedPath,
            BackendAcceptanceTest.Fixture fixture,
            UUID invitationId) {
        assertOperationsInvitationMutationOracle(
                json, targetType, expectedPath, fixture.groupWorkspaceKey(), invitationToken(invitationId), "create");
    }

    private void assertOperationsInvitationReissueOracle(
            JsonNode json,
            String targetType,
            JsonNode expectedPath,
            BackendAcceptanceTest.Fixture fixture,
            UUID invitationId) {
        assertOperationsInvitationMutationOracle(
                json, targetType, expectedPath, fixture.groupWorkspaceKey(), invitationToken(invitationId), "reissue");
    }

    private void assertOperationsInvitationCancelOracle(
            JsonNode json,
            String targetType,
            JsonNode expectedPath,
            BackendAcceptanceTest.Fixture fixture,
            UUID invitationId) {
        assertOperationsInvitationMutationOracle(
                json, targetType, expectedPath, fixture.groupWorkspaceKey(), invitationToken(invitationId), "cancel");
    }

    private void assertOperationsInvitationMutationOracle(
            JsonNode json,
            String targetType,
            JsonNode expectedPath,
            String workspaceKey,
            String token,
            String mutation) {
        switch (targetType) {
            case "GROUP" -> assertInvitationOracle(
                    json,
                    ("create".equals(mutation)
                            ? "createOperationsWorkspaceGroupInvitation"
                            : "reissue".equals(mutation)
                                    ? "reissueOperationsWorkspaceGroupInvitation"
                                    : "cancelOperationsWorkspaceGroupInvitation"),
                    expectedPath,
                    workspaceKey,
                    token,
                    false);
            case "REGION" -> assertInvitationOracle(
                    json,
                    ("create".equals(mutation)
                            ? "createOperationsWorkspaceRegionInvitation"
                            : "reissue".equals(mutation)
                                    ? "reissueOperationsWorkspaceRegionInvitation"
                                    : "cancelOperationsWorkspaceRegionInvitation"),
                    expectedPath,
                    workspaceKey,
                    token,
                    false);
            case "PROJECT" -> assertInvitationOracle(
                    json,
                    ("create".equals(mutation)
                            ? "createOperationsWorkspaceProjectInvitation"
                            : "reissue".equals(mutation)
                                    ? "reissueOperationsWorkspaceProjectInvitation"
                                    : "cancelOperationsWorkspaceProjectInvitation"),
                    expectedPath,
                    workspaceKey,
                    token,
                    false);
            case "HEAD_COMPANY" -> assertInvitationOracle(
                    json,
                    ("create".equals(mutation)
                            ? "createOperationsWorkspaceHeadCompanyInvitation"
                            : "reissue".equals(mutation)
                                    ? "reissueOperationsWorkspaceHeadCompanyInvitation"
                                    : "cancelOperationsWorkspaceHeadCompanyInvitation"),
                    expectedPath,
                    workspaceKey,
                    token,
                    false);
            case "STORE" -> assertInvitationOracle(
                    json,
                    ("create".equals(mutation)
                            ? "createOperationsWorkspaceStoreInvitation"
                            : "reissue".equals(mutation)
                                    ? "reissueOperationsWorkspaceStoreInvitation"
                                    : "cancelOperationsWorkspaceStoreInvitation"),
                    expectedPath,
                    workspaceKey,
                    token,
                    false);
            default -> throw new IllegalArgumentException("unsupported invitation mutation target " + targetType);
        }
    }

    private void assertAccountOracle(
            JsonNode json,
            String operationId,
            String statusPointer,
            String pathPointer,
            String expectedStatus,
            JsonNode expectedPath) {
        JsonNode status = json.at(statusPointer);
        JsonNode path = json.at(pathPointer);
        assertEquals(JsonNodeType.STRING, status.getNodeType(), operationId + ": account status type");
        assertEquals(JsonNodeType.ARRAY, path.getNodeType(), operationId + ": assignment path type");
        assertEquals(expectedStatus, status.asText(), operationId + ": account status");
        assertEquals(expectedPath, path, operationId + ": assignment path");
    }

    private void assertOperationsUserPageOracle(JsonNode json, String targetType, JsonNode expectedPath) {
        switch (targetType) {
            case "GROUP" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceGroupUser",
                    "/items/0/status",
                    "/items/0/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "REGION" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceRegionUser",
                    "/items/0/status",
                    "/items/0/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "PROJECT" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceProjectUser",
                    "/items/0/status",
                    "/items/0/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "HEAD_COMPANY" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceHeadCompanyUser",
                    "/items/0/status",
                    "/items/0/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "STORE" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceStoreUser",
                    "/items/0/status",
                    "/items/0/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            default -> throw new IllegalArgumentException("unsupported user page target " + targetType);
        }
    }

    private void assertOperationsUserDetailOracle(JsonNode json, String targetType, JsonNode expectedPath) {
        switch (targetType) {
            case "GROUP" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceGroupUserAccount",
                    "/status",
                    "/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "REGION" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceRegionUserAccount",
                    "/status",
                    "/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "PROJECT" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceProjectUserAccount",
                    "/status",
                    "/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "HEAD_COMPANY" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceHeadCompanyUserAccount",
                    "/status",
                    "/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "STORE" -> assertAccountOracle(
                    json,
                    "getOperationsWorkspaceStoreUserAccount",
                    "/status",
                    "/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            default -> throw new IllegalArgumentException("unsupported user detail target " + targetType);
        }
    }

    private void assertOperationsUserRevokeOracle(JsonNode json, String targetType, JsonNode expectedPath) {
        switch (targetType) {
            case "GROUP" -> assertAccountOracle(
                    json,
                    "revokeOperationsWorkspaceGroupUserAssignment",
                    "/user/status",
                    "/user/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "REGION" -> assertAccountOracle(
                    json,
                    "revokeOperationsWorkspaceRegionUserAssignment",
                    "/user/status",
                    "/user/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "PROJECT" -> assertAccountOracle(
                    json,
                    "revokeOperationsWorkspaceProjectUserAssignment",
                    "/user/status",
                    "/user/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "HEAD_COMPANY" -> assertAccountOracle(
                    json,
                    "revokeOperationsWorkspaceHeadCompanyUserAssignment",
                    "/user/status",
                    "/user/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            case "STORE" -> assertAccountOracle(
                    json,
                    "revokeOperationsWorkspaceStoreUserAssignment",
                    "/user/status",
                    "/user/assignments/0/organizationPathNodes",
                    "ENABLED",
                    expectedPath);
            default -> throw new IllegalArgumentException("unsupported user revoke target " + targetType);
        }
    }

    private BackendAcceptanceTest.RouteIdentity operationsCandidateRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_INVITATION_CANDIDATES;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_INVITATION_CANDIDATES;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANDIDATES;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANDIDATES;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_INVITATION_CANDIDATES;
            default -> throw new IllegalArgumentException("unsupported candidate route target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsInvitationListRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_INVITATIONS;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_INVITATIONS;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_INVITATIONS;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATIONS;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_INVITATIONS;
            default -> throw new IllegalArgumentException("unsupported invitation list target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsInvitationCreateRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_INVITATION_CREATE;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_INVITATION_CREATE;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_INVITATION_CREATE;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CREATE;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_INVITATION_CREATE;
            default -> throw new IllegalArgumentException("unsupported invitation create target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsInvitationReissueRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_INVITATION_REISSUE;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_INVITATION_REISSUE;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_INVITATION_REISSUE;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_REISSUE;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_INVITATION_REISSUE;
            default -> throw new IllegalArgumentException("unsupported invitation reissue target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsInvitationCancelRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_INVITATION_CANCEL;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_INVITATION_CANCEL;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANCEL;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANCEL;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_INVITATION_CANCEL;
            default -> throw new IllegalArgumentException("unsupported invitation cancel target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsUserPageRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_USER;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_USER;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_USER;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_USER;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_USER;
            default -> throw new IllegalArgumentException("unsupported user page target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsUserDetailRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_USER_ACCOUNT;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_USER_ACCOUNT;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_USER_ACCOUNT;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ACCOUNT;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_USER_ACCOUNT;
            default -> throw new IllegalArgumentException("unsupported user detail target " + targetType);
        };
    }

    private BackendAcceptanceTest.RouteIdentity operationsUserRevokeRoute(String targetType) {
        return switch (targetType) {
            case "GROUP" -> OPERATIONS_WORKSPACE_GROUP_USER_REVOKE;
            case "REGION" -> OPERATIONS_WORKSPACE_REGION_USER_REVOKE;
            case "PROJECT" -> OPERATIONS_WORKSPACE_PROJECT_USER_REVOKE;
            case "HEAD_COMPANY" -> OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_REVOKE;
            case "STORE" -> OPERATIONS_WORKSPACE_STORE_USER_REVOKE;
            default -> throw new IllegalArgumentException("unsupported user revoke target " + targetType);
        };
    }

    private JsonNode expectedPath(BackendAcceptanceTest.Fixture fixture, String targetType) {
        java.util.List<Map<String, Object>> nodes = new java.util.ArrayList<>();
        switch (targetType) {
            case "GROUP" -> nodes.add(pathNode(fixture.groupId(), "ACCEPTANCE-ROOT", "Acceptance root", "GROUP"));
            case "REGION" -> nodes.add(
                    pathNode(fixture.regionId(), "acceptance-region", "Acceptance Region", "REGION"));
            case "PROJECT" -> {
                nodes.add(pathNode(fixture.regionId(), "acceptance-region", "Acceptance Region", "REGION"));
                nodes.add(pathNode(fixture.projectId(), "acceptance-project", "Acceptance Project", "PROJECT"));
            }
            case "HEAD_COMPANY" -> nodes.add(pathNode(
                    fixture.headCompanyId(), "acceptance-head-company", "Acceptance Head Company", "HEAD_COMPANY"));
            case "STORE" -> {
                nodes.add(pathNode(fixture.regionId(), "acceptance-region", "Acceptance Region", "REGION"));
                nodes.add(pathNode(fixture.projectId(), "acceptance-project", "Acceptance Project", "PROJECT"));
                nodes.add(pathNode(fixture.storeId(), "acceptance-store", "Acceptance Store", "STORE"));
            }
            default -> throw new IllegalArgumentException("unsupported path target " + targetType);
        }
        return host.mapper.valueToTree(nodes);
    }

    private static Map<String, Object> pathNode(UUID ref, String code, String name, String nodeType) {
        return Map.of("ref", ref, "code", code, "name", name, "nodeType", nodeType);
    }

    private static String candidateDisplayPath(String targetType) {
        return switch (targetType) {
            case "GROUP" -> "ACCEPTANCE-ROOT Acceptance root";
            case "REGION" -> "Acceptance Region acceptance-region";
            case "PROJECT" -> "Acceptance Region acceptance-region / Acceptance Project acceptance-project";
            case "HEAD_COMPANY" -> "acceptance-head-company Acceptance Head Company";
            case "STORE" -> "Acceptance Region acceptance-region / Acceptance Project acceptance-project"
                    + " / Acceptance Store acceptance-store";
            default -> throw new IllegalArgumentException("unsupported candidate display target " + targetType);
        };
    }

    private static String targetSlug(String targetType) {
        return targetType.toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }

    private static UUID targetRef(BackendAcceptanceTest.Fixture fixture, String targetType) {
        return switch (targetType) {
            case "GROUP" -> fixture.groupId();
            case "REGION" -> fixture.regionId();
            case "PROJECT" -> fixture.projectId();
            case "HEAD_COMPANY" -> fixture.headCompanyId();
            case "STORE" -> fixture.storeId();
            default -> throw new IllegalArgumentException("unsupported target ref " + targetType);
        };
    }

    private UUID invitationRoleId(BackendAcceptanceTest.Fixture fixture) {
        return UUID.fromString(host.text(
                "SELECT role_id::text FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=?",
                fixture.invitationId()));
    }

    private String invitationToken(UUID invitationId) {
        return host.text("SELECT invitation_token FROM workspace_iam.invitation WHERE id=?", invitationId);
    }

    private long invitationVersion(UUID invitationId) {
        return Long.parseLong(host.text("SELECT version::text FROM workspace_iam.invitation WHERE id=?", invitationId));
    }

    private static Map<String, Object> invitationAction(
            UUID scopeRef, long expectedContextVersion, long expectedVersion, String idempotencyKey) {
        return Map.of(
                "scopeRef", scopeRef.toString(),
                "expectedContextVersion", expectedContextVersion,
                "expectedVersion", expectedVersion,
                "idempotencyKey", idempotencyKey);
    }

    private UUID accountId(BackendAcceptanceTest.Fixture fixture) {
        return UUID.fromString(host.text(
                "SELECT id::text FROM workspace_iam.workspace_account WHERE workspace_uuid=? "
                        + "AND group_workspace_key=? AND login_name_normalized=?",
                fixture.workspaceUuid(),
                fixture.groupWorkspaceKey(),
                fixture.loginName()));
    }

    private long accountVersion(UUID accountId) {
        return Long.parseLong(
                host.text("SELECT version::text FROM workspace_iam.workspace_account WHERE id=?", accountId));
    }

    private UUID assignmentId(UUID accountId, String targetType, UUID targetRef) {
        return UUID.fromString(host.text(
                "SELECT id::text FROM workspace_iam.role_assignment WHERE account_id=? AND service_node_type=? "
                        + "AND service_node_id=? AND status='ACTIVE'",
                accountId,
                targetType,
                targetRef));
    }

    private long assignmentVersion(UUID assignmentId) {
        return Long.parseLong(
                host.text("SELECT version::text FROM workspace_iam.role_assignment WHERE id=?", assignmentId));
    }

    @AcceptanceScenario(id = "iam.capability-denial-is-no-write", module = "IAM", operation = "capabilityDenial")
    void capabilityDenialIsNoWrite(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response denied = context.patch(
                OPERATIONS_ORGANIZATION_NODE_UPDATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/hierarchy/" + fixture.projectId(),
                session.cookie(),
                Map.of(
                        "code",
                        "acceptance-project",
                        "name",
                        "Must Not Change",
                        "parentId",
                        fixture.regionId().toString(),
                        "phases",
                        List.of(Map.of("name", "Opening")),
                        "notes",
                        "denied",
                        "expectedVersion",
                        1,
                        "extensionValues",
                        List.of()),
                Set.of(403));
        assertTrue(
                denied.problemCode().contains("ACCESS") || denied.problemCode().contains("AUTH"),
                "CONTRACT: denied mutation is typed");
        Map<String, Object> row = host.queryForMap(
                "SELECT name, version FROM organization.organization_node WHERE id=?", fixture.projectId());
        assertEquals(
                "Acceptance Project", row.get("name"), "BUSINESS: denied capability does not change the project name");
        assertEquals(
                1L,
                ((Number) row.get("version")).longValue(),
                "BUSINESS: denied capability does not advance the version");
    }

    @AcceptanceScenario(
            id = "iam.public-invitation-otp-rotation",
            module = "IAM",
            operation = "publicInvitationOtpRotation")
    void publicInvitationOtpRotation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        assertEquals(
                "VERIFY_MOBILE",
                context.post(
                                ACCEPT_PUBLIC_INVITATION,
                                BackendAcceptanceTest.publicInvitationPath(fixture),
                                null,
                                Map.of(),
                                Set.of(200))
                        .json()
                        .path("nextStep")
                        .asText(),
                "BUSINESS: first acceptance opens mobile verification");
        assertEquals(
                "VERIFY_MOBILE",
                context.post(
                                ACCEPT_PUBLIC_INVITATION,
                                BackendAcceptanceTest.publicInvitationPath(fixture),
                                null,
                                Map.of(),
                                Set.of(200))
                        .json()
                        .path("nextStep")
                        .asText(),
                "BUSINESS: repeated acceptance resumes instead of duplicating consent");

        String firstCode = context.post(
                        SEND_PUBLIC_INVITATION_OTP,
                        BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/send",
                        null,
                        Map.of("mobile", fixture.mobile()),
                        Set.of(200))
                .json()
                .path("debugVerificationCode")
                .asText();
        String secondCode = context.post(
                        SEND_PUBLIC_INVITATION_OTP,
                        BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/send",
                        null,
                        Map.of("mobile", fixture.mobile()),
                        Set.of(200))
                .json()
                .path("debugVerificationCode")
                .asText();
        assertTrue(
                firstCode.matches("[0-9]{6}") && secondCode.matches("[0-9]{6}"),
                "BUSINESS: both managed OTP deliveries expose a six-digit test code");
        assertNotEquals(firstCode, secondCode, "BUSINESS: a renewed OTP is a new one-time secret");
        BackendAcceptanceTest.Response superseded = context.post(
                VERIFY_PUBLIC_INVITATION_OTP,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/verify",
                null,
                Map.of("mobile", fixture.mobile(), "code", firstCode),
                Set.of(409));
        assertEquals(
                "WORKSPACE_IAM_INVITATION_TERMINAL",
                superseded.problemCode(),
                "BUSINESS: superseded OTP is rejected as a typed invitation-state failure");
        BackendAcceptanceTest.Response verified = context.post(
                VERIFY_PUBLIC_INVITATION_OTP,
                BackendAcceptanceTest.publicInvitationPath(fixture) + "/otp/verify",
                null,
                Map.of("mobile", fixture.mobile(), "code", secondCode),
                Set.of(200));
        assertEquals(
                "COMPLETE_CREDENTIALS",
                verified.json().path("nextStep").asText(),
                "BUSINESS: only the current OTP advances the invitation");
        assertEquals(
                0,
                host.count(
                        "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND "
                                + "login_name_normalized=?",
                        fixture.workspaceUuid(),
                        fixture.loginName()),
                "BUSINESS: OTP renewal still does not create an account");
    }

    @AcceptanceScenario(
            id = "iam.cancelled-invitation-is-terminal",
            module = "IAM",
            operation = "cancelledInvitationTerminal")
    void cancelledInvitationIsTerminal(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("REGION", Set.of());
        host.cancelInvitation(fixture);
        BackendAcceptanceTest.Response view = context.get(
                PUBLIC_INVITATION_VIEW, BackendAcceptanceTest.publicInvitationPath(fixture), null, Set.of(200));
        assertEquals(
                "CANCELLED",
                view.json().path("status").asText(),
                "BUSINESS: owner cancellation is visible in the public readback");
        assertEquals(
                "TERMINAL",
                view.json().path("nextStep").asText(),
                "BUSINESS: cancelled invitation cannot resume the onboarding flow");
        BackendAcceptanceTest.Response accept = context.post(
                ACCEPT_PUBLIC_INVITATION,
                BackendAcceptanceTest.publicInvitationPath(fixture),
                null,
                Map.of(),
                Set.of(409));
        assertEquals(
                "WORKSPACE_IAM_INVITATION_TERMINAL",
                accept.problemCode(),
                "BUSINESS: cancelled invitation rejects acceptance with a typed terminal problem");
        assertEquals(
                0,
                host.count(
                        "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND "
                                + "login_name_normalized=?",
                        fixture.workspaceUuid(),
                        fixture.loginName()),
                "BUSINESS: cancelled invitation creates no account");
        assertEquals(
                0,
                host.count(
                        "SELECT count(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?",
                        fixture.invitationId()),
                "BUSINESS: cancelled invitation creates no assignment");
    }

    @AcceptanceScenario(
            id = "iam.operations-login-entry-is-locator-only",
            module = "IAM",
            operation = "operationsLoginEntryLocator")
    void operationsLoginEntryIsLocatorOnly(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Response entry = context.get(
                OPERATIONS_WORKSPACE_LOGIN_ENTRY,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/login-entry",
                null,
                Set.of(200));
        assertEquals(
                fixture.groupWorkspaceKey(),
                entry.json().path("groupWorkspaceKey").asText(),
                "BUSINESS: login entry returns the requested workspace locator");
        assertTrue(
                entry.json().path("workspaceName").asText().startsWith("Acceptance workspace "),
                "BUSINESS: login entry returns the owner workspace display name");
        assertEquals(
                "Acceptance Operations",
                entry.json().path("operationsTitle").asText(),
                "BUSINESS: login entry returns the operations brand");
        assertEquals(
                "ENABLED",
                entry.json().path("status").asText(),
                "BUSINESS: login entry exposes the current workspace status");
        assertEquals(
                "NONE",
                entry.json().path("sessionState").asText(),
                "BUSINESS: pre-login lookup does not create an authenticated session");
        assertFalse(
                entry.raw().contains(fixture.invitationToken()),
                "BUSINESS: login entry does not expose an invitation token");
    }

    @AcceptanceScenario(
            id = "iam.cross-workspace-store-isolation",
            module = "IAM",
            operation = "crossWorkspaceStoreIsolation")
    void crossWorkspaceStoreIsolation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Fixture foreign = host.fixture("PROJECT", Set.of());
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response hidden = context.get(
                OPERATIONS_ORGANIZATION_STORE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/"
                        + foreign.storeId() + "?expectedContextVersion=" + session.contextVersion(),
                session.cookie(),
                Set.of(404));
        assertEquals(
                "PLATFORM_COMMON_RESOURCE_NOT_FOUND",
                hidden.problemCode(),
                "BUSINESS: a foreign workspace store is not addressable through the current workspace");
        assertFalse(hidden.json().has("id"), "BUSINESS: foreign store readback contains no resource payload");
        assertFalse(hidden.json().has("name"), "BUSINESS: foreign store name is not disclosed");
        assertFalse(hidden.json().has("code"), "BUSINESS: foreign store code is not disclosed");
        assertFalse(hidden.json().has("brand"), "BUSINESS: foreign store owner payload is not disclosed");
    }

    private UUID insertAccount(
            BackendAcceptanceTest.Fixture fixture, String mobile, String loginName, String displayName, String status) {
        UUID accountId = UUID.randomUUID();
        long now = System.currentTimeMillis();
        host.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
                accountId,
                fixture.workspaceUuid(),
                fixture.groupWorkspaceKey(),
                mobile,
                loginName,
                displayName,
                status,
                now,
                now);
        return accountId;
    }

    private static String uniqueMobile() {
        return "139" + String.format("%08d", Math.floorMod(UUID.randomUUID().hashCode(), 100_000_000));
    }
}
