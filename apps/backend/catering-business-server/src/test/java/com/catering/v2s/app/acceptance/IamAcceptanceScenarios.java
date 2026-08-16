package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
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
        assertEquals(
                "acceptance-region Acceptance Region",
                body.path("targetOrganizationPath").asText(),
                "BUSINESS: target path is owner-derived");
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
}
