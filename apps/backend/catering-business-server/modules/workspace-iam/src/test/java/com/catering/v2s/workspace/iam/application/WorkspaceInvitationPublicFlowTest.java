package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationAssignmentCandidateService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy;
import com.catering.v2s.platform.foundation.seed.DevFixedOtpIssuer;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WorkspaceInvitationPublicFlowTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static WorkspaceInvitationService invitations;
    private static WorkspaceAuthenticationService authentication;
    private static WorkspaceUserService user;
    private static UUID workspaceId;
    private static UUID groupId;
    private static UUID regionId;
    private static UUID roleId;
    private static final long NOW = 1_785_000_000_000L;

    @BeforeAll
    static void setup() {
        flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .load();
        flyway.migrate();
        jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        TimeProvider time = () -> NOW;
        workspaceId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'public-flow', 'Public "
                        + "flow', 'public flow', 'Public flow', 'ENABLED', 1, 1, ?, ?, ?)",
                workspaceId,
                NOW,
                NOW,
                NOW);
        WorkspaceStatusLookup workspaceStatuses = (id, key) -> jdbc.queryForObject(
                "SELECT status FROM platform_workspace.group_workspace "
                        + "WHERE workspace_uuid=? AND group_workspace_key=?",
                String.class,
                id,
                key);
        ExtensionDefinitionService definitions = new ExtensionDefinitionService(
                new ExtensionDefinitionPersistence(jdbc, time),
                new ExtensionCommandReceiptService(jdbc, time),
                workspaceStatuses);
        OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, time);
        BusinessEntityService entities = new BusinessEntityService(jdbc, time, definitions, hierarchy);
        WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, time);
        OrganizationCommandService groups = new OrganizationCommandService(jdbc, null, time);
        long groupWorkspaceId = jdbc.queryForObject(
                "SELECT id FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND group_workspace_key=?",
                Long.class,
                workspaceId,
                "public-flow");
        groups.execute(
                new com.catering.v2s.platform.access.PlatformExecutionContext(
                        "public-flow", "platform-admin", Instant.ofEpochMilli(NOW + 60_000L), "public-flow"),
                workspaceId,
                "public-flow",
                groupWorkspaceId,
                "public-flow-commercial-group-0001",
                "PUBLIC-FLOW-GROUP",
                "Public Flow Group",
                AuditActor.system());
        groupId = jdbc.queryForObject(
                "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?",
                UUID.class,
                "public-flow");
        regionId = hierarchy
                .create(workspaceId, "public-flow", "REGION", null, "region", "Region")
                .id();
        roleId = roles.create(workspaceId, "public-flow", "Region user", "REGION", null, Set.of(), Set.of())
                .id();
        OrganizationTaskPathService taskPaths = new OrganizationTaskPathService(jdbc, groups);
        OrganizationAssignmentCandidateService candidates =
                new OrganizationAssignmentCandidateService(jdbc, groups, taskPaths);
        WorkspaceAssignmentScopeService assignments = new WorkspaceAssignmentScopeService(jdbc);
        WorkspaceUserService user = new WorkspaceUserService(
                jdbc, hierarchy, entities, roles, groups, candidates, assignments, taskPaths);
        ObjectProvider<DevFixedOtpIssuer> fixedOtpIssuer = Mockito.mock(ObjectProvider.class);
        invitations = new WorkspaceInvitationService(
                jdbc,
                time,
                roles,
                hierarchy,
                entities,
                entities,
                groups,
                new WorkspaceOtpRateLimitService(jdbc, time),
                new WorkspaceIamCommandReceiptService(jdbc, time),
                new WorkspaceCommandAuthorizationService(jdbc),
                user,
                taskPaths,
                candidates,
                new OtpDebugExposurePolicy("", false),
                fixedOtpIssuer);
        authentication = new WorkspaceAuthenticationService(jdbc, time, roles, hierarchy, entities, entities);
        WorkspaceInvitationPublicFlowTest.user = user;
    }

    @Test
    void createRejectsDisabledAccountOrRoleBeforeInvitationWrites() {
        for (String status : List.of("DISABLED", "VOIDED")) {
            String mobile = "DISABLED".equals(status) ? "13800000018" : "13800000021";
            UUID accountId = UUID.randomUUID();
            jdbc.update(
                    "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                            + "mobile_normalized, login_name_normalized, display_name, status, version, "
                            + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', "
                            + "?, ?, ?, ?, 1, ?, ?)",
                    accountId,
                    workspaceId,
                    mobile,
                    status.toLowerCase(java.util.Locale.ROOT) + "-invite-user",
                    status + " Invite User",
                    status,
                    NOW,
                    NOW);
            assertThrows(
                    WorkspaceInvitationService.AccountNotBindableException.class,
                    () -> invitations.create(
                            workspaceId,
                            "public-flow",
                            mobile,
                            List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                            NOW + 60 * 60 * 1000L));
            assertEquals(
                    0,
                    jdbc.queryForObject(
                            "SELECT COUNT(*) FROM workspace_iam.invitation WHERE mobile_normalized=?",
                            Integer.class,
                            mobile));
            assertEquals(
                    0,
                    jdbc.queryForObject(
                            "SELECT COUNT(*) FROM workspace_iam.invitation_assignment_intent i JOIN "
                                    + "workspace_iam.invitation v ON v.id=i.invitation_id WHERE "
                                    + "v.mobile_normalized=?",
                            Integer.class,
                            mobile));
        }

        for (String status : List.of("DISABLED", "VOIDED")) {
            String mobile = "DISABLED".equals(status) ? "13800000019" : "13800000023";
            jdbc.update("UPDATE workspace_iam.workspace_role SET status=? WHERE id=?", status, roleId);
            try {
                assertThrows(
                        WorkspaceInvitationService.InvitationValidationException.class,
                        () -> invitations.create(
                                workspaceId,
                                "public-flow",
                                mobile,
                                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                                NOW + 60 * 60 * 1000L));
            } finally {
                jdbc.update("UPDATE workspace_iam.workspace_role SET status='ENABLED' WHERE id=?", roleId);
            }
            assertEquals(
                    0,
                    jdbc.queryForObject(
                            "SELECT COUNT(*) FROM workspace_iam.invitation WHERE mobile_normalized=?",
                            Integer.class,
                            mobile));
        }
    }

    @Test
    void publicReadinessReportsAccountFourStateAndCompleteRejectsUnbindableAccount() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000020",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        String otp = invitations.issueMobileVerificationOtp(
                "public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        UUID accountId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', "
                        + "'13800000020', 'disabled-during-invite', 'Disabled During Invite', 'DISABLED', 1, ?, ?)",
                accountId,
                workspaceId,
                NOW,
                NOW);

        var verified = invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000020", otp);
        assertEquals("DISABLED", verified.accountExists());
        invitations.savePublicCredentials(
                "public-flow",
                created.rawInvitationToken(),
                verified.verificationGrant(),
                "Blocked User",
                "blocked-user",
                "a-secure-password".toCharArray());
        assertThrows(
                WorkspaceInvitationService.AccountNotBindableException.class,
                () -> invitations.completePublic("public-flow", created.rawInvitationToken()));
        assertEquals(0, assignments(created.id()));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM workspace_iam.workspace_credential WHERE account_id=?",
                        Integer.class,
                        accountId));

        var voided = invitations.create(
                workspaceId,
                "public-flow",
                "13800000022",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        invitations.acceptPublic("public-flow", voided.rawInvitationToken());
        String voidedOtp = invitations.issueMobileVerificationOtp(
                "public-flow", voided.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        UUID voidedAccountId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', "
                        + "'13800000022', 'voided-during-invite', 'Voided During Invite', 'VOIDED', 1, ?, ?)",
                voidedAccountId,
                workspaceId,
                NOW,
                NOW);
        var voidedVerified =
                invitations.verifyPublicOtp("public-flow", voided.rawInvitationToken(), "13800000022", voidedOtp);
        assertEquals("VOIDED", voidedVerified.accountExists());
        invitations.savePublicCredentials(
                "public-flow",
                voided.rawInvitationToken(),
                voidedVerified.verificationGrant(),
                "Voided User",
                "voided-user",
                "a-secure-password".toCharArray());
        assertThrows(
                WorkspaceInvitationService.AccountNotBindableException.class,
                () -> invitations.completePublic("public-flow", voided.rawInvitationToken()));
        assertEquals(0, assignments(voided.id()));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM workspace_iam.workspace_credential WHERE account_id=?",
                        Integer.class,
                        voidedAccountId));
    }

    @Test
    void onlyFinalizeCreatesAssignmentsAfterAcceptOtpAndCredentialDraft() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000001",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        String otp = invitations.issueMobileVerificationOtp(
                "public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        var verified = invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000001", otp);
        assertEquals(0, assignments(created.id()));
        invitations.savePublicCredentials(
                "public-flow",
                created.rawInvitationToken(),
                verified.verificationGrant(),
                "Public User",
                "public-user",
                "a-secure-password".toCharArray());
        assertEquals(0, assignments(created.id()));
        var completion = invitations.completePublic("public-flow", created.rawInvitationToken());
        assertEquals("COMPLETED", completion.status());
        assertEquals(1, assignments(created.id()));
        assertEquals(
                completion.invitationId(),
                invitations
                        .publicCompletion("public-flow", created.rawInvitationToken())
                        .invitationId());
    }

    @Test
    void publicOtpCannotBeSentOrVerifiedForAnotherMobile() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000002",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        assertThrows(
                WorkspaceInvitationService.InvitationValidationException.class,
                () -> invitations.sendPublicOtp("public-flow", created.rawInvitationToken(), "13800000003"));
        String otp = invitations.issueMobileVerificationOtp(
                "public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        assertThrows(
                WorkspaceInvitationService.InvitationValidationException.class,
                () -> invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000003", otp));
        assertEquals(0, assignments(created.id()));
    }

    @Test
    void publicInvitationResumesAfterBackOrRefreshWithoutASecondAcceptTransition() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000017",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        assertEquals(
                "ACCEPT",
                invitations
                        .publicView("public-flow", created.rawInvitationToken())
                        .nextStep());
        assertEquals(
                "VERIFY_MOBILE",
                invitations
                        .acceptPublic("public-flow", created.rawInvitationToken())
                        .nextStep());
        assertEquals(
                "VERIFY_MOBILE",
                invitations
                        .acceptPublic("public-flow", created.rawInvitationToken())
                        .nextStep());
        assertEquals(
                "VERIFY_MOBILE",
                invitations
                        .publicView("public-flow", created.rawInvitationToken())
                        .nextStep());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM workspace_iam.audit_event WHERE entity_ref_text=? AND "
                                + "action='WORKSPACE_INVITATION_ACCEPT_INTENT_RECORDED'",
                        Integer.class,
                        created.id().toString()));

        String firstOtp = invitations.issueMobileVerificationOtp(
                "public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        var firstVerification =
                invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000017", firstOtp);
        assertEquals(
                "VERIFY_MOBILE",
                invitations
                        .publicView("public-flow", created.rawInvitationToken())
                        .nextStep());
        String resumedOtp = invitations.issueMobileVerificationOtp(
                "public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        var resumedVerification =
                invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000017", resumedOtp);
        assertThrows(
                WorkspaceInvitationService.InvitationStateException.class,
                () -> invitations.savePublicCredentials(
                        "public-flow",
                        created.rawInvitationToken(),
                        firstVerification.verificationGrant(),
                        "Resumed User",
                        "resumed-user",
                        "a-secure-password".toCharArray()));
        invitations.savePublicCredentials(
                "public-flow",
                created.rawInvitationToken(),
                resumedVerification.verificationGrant(),
                "Resumed User",
                "resumed-user",
                "a-secure-password".toCharArray());
        assertEquals(
                "FINALIZE",
                invitations
                        .publicView("public-flow", created.rawInvitationToken())
                        .nextStep());
        assertEquals(
                "FINALIZE",
                invitations
                        .acceptPublic("public-flow", created.rawInvitationToken())
                        .nextStep());
        invitations.completePublic("public-flow", created.rawInvitationToken());
        assertEquals(
                "TERMINAL",
                invitations
                        .publicView("public-flow", created.rawInvitationToken())
                        .nextStep());
        assertEquals(1, assignments(created.id()));
    }

    @Test
    void publicInvitationRejectsExpiredAndInvalidOtpStatesAndCompletionReplayPreservesOneAssignment() {
        var expired = invitations.create(
                workspaceId,
                "public-flow",
                "13800000004",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        jdbc.update("UPDATE workspace_iam.invitation SET expires_at_epoch_millis=? WHERE id=?", NOW - 1, expired.id());
        assertThrows(
                WorkspaceInvitationService.InvitationStateException.class,
                () -> invitations.acceptPublic("public-flow", expired.rawInvitationToken()));

        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000005",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        assertThrows(
                WorkspaceInvitationService.InvitationStateException.class,
                () -> invitations.sendPublicOtp("public-flow", created.rawInvitationToken(), "13800000005"));
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        String otp = invitations.issueMobileVerificationOtp(
                "public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        assertThrows(
                WorkspaceInvitationService.InvitationStateException.class,
                () -> invitations.verifyPublicOtp(
                        "public-flow", created.rawInvitationToken(), "13800000005", "000000"));
        var verified = invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000005", otp);
        assertThrows(
                WorkspaceInvitationService.InvitationStateException.class,
                () -> invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000005", otp));
        invitations.savePublicCredentials(
                "public-flow",
                created.rawInvitationToken(),
                verified.verificationGrant(),
                "Replay User",
                "replay-user",
                "a-secure-password".toCharArray());
        var completed = invitations.completePublic("public-flow", created.rawInvitationToken());
        var replay = invitations.completePublic("public-flow", created.rawInvitationToken());
        assertEquals(completed.invitationId(), replay.invitationId());
        assertEquals(1, assignments(created.id()));
    }

    @Test
    void operationsOtpCreatesSessionOnlyAfterOneTimeMobileBoundProof() {
        UUID accountId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', "
                        + "'13800000009', "
                        + "'otp-user', 'OTP User', 'ENABLED', 1, ?, ?)",
                accountId,
                workspaceId,
                NOW,
                NOW);
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, "
                        + "changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)",
                accountId,
                new BCryptPasswordEncoder().encode("unused-password"),
                NOW);
        authentication.sendLoginOtp("public-flow", "13800000009");
        jdbc.update(
                "UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND "
                        + "purpose='WORKSPACE_LOGIN'",
                accountId);
        jdbc.update(
                "INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, "
                        + "subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, 'public-flow', "
                        + "'WORKSPACE_LOGIN', "
                        + "?, ?, 'ACTIVE', ?)",
                UUID.randomUUID(),
                workspaceId,
                sha256("654321"),
                accountId,
                NOW + 60_000L);
        assertThrows(
                WorkspaceAuthenticationService.OtpInvalidException.class,
                () -> authentication.verifyLoginOtp("public-flow", "13800000009", "000000"));
        var session = authentication.verifyLoginOtpWithSessionEntry("public-flow", "+138 0000 0009", "654321");
        assertEquals(accountId, session.sessionEntry().accountId());
        assertEquals("public-flow", session.sessionEntry().groupWorkspaceKey());
        assertEquals(session.sessionEntry(), authentication.sessionEntry(session.rawSessionToken(), "public-flow"));
        assertThrows(
                WorkspaceAuthenticationService.SessionInvalidException.class,
                () -> authentication.sessionEntry(session.rawSessionToken(), "another-workspace"));
        assertThrows(
                WorkspaceAuthenticationService.OtpInvalidException.class,
                () -> authentication.verifyLoginOtpWithSessionEntry("public-flow", "13800000009", "654321"));
    }

    @Test
    void userUsesOwnerPathAndScopeInsteadOfAnUnboundedAccountList() {
        UUID accountId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID scopeId = new OrganizationHierarchyService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "REGION", null, "user-scope", "User scope")
                .id();
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, "
                        + "mobile_normalized, login_name_normalized, display_name, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', "
                        + "'13800000010', "
                        + "'user-user', 'User User', 'ENABLED', 1, ?, ?)",
                accountId,
                workspaceId,
                NOW,
                NOW);
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, "
                        + "changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)",
                accountId,
                new BCryptPasswordEncoder().encode("user-password"),
                NOW);
        UUID invitationId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, "
                        + "mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'public-flow', 'user-token-hash', '13800000010', 'COMPLETED', ?, 1, ?)",
                invitationId,
                workspaceId,
                NOW + 60_000L,
                NOW);
        jdbc.update(
                "INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, "
                        + "role_id, source_invitation_id, service_node_type, service_node_id, status, version, "
                        + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', ?, ?, ?, "
                        + "'REGION', ?, 'ACTIVE', 1, ?, ?)",
                assignmentId,
                workspaceId,
                accountId,
                roleId,
                invitationId,
                scopeId,
                NOW,
                NOW);
        var page = user.page(WorkspaceUserService.AccountPageQuery.forPlatform(
                workspaceId, "public-flow", null, null, null, null, null, "REGION", scopeId, null, null, 1, 20));
        assertEquals(1, page.total());
        assertEquals(1, page.items().size());
        var pathNodes = page.items().getFirst().assignments().getFirst().organizationPathNodes();
        assertEquals(1, pathNodes.size());
        assertEquals("user-scope", pathNodes.getFirst().code());
        assertEquals("User scope", pathNodes.getFirst().name());
        UUID emptyScopeId = new OrganizationHierarchyService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "REGION", null, "empty-scope", "Empty scope")
                .id();
        assertEquals(
                0,
                user.page(WorkspaceUserService.AccountPageQuery.forPlatform(
                                workspaceId,
                                "public-flow",
                                null,
                                null,
                                null,
                                null,
                                null,
                                "REGION",
                                emptyScopeId,
                                null,
                                null,
                                1,
                                20))
                        .total());
        new WorkspaceAccountService(jdbc, () -> NOW)
                .revokeAssignment(workspaceId, "public-flow", accountId, assignmentId, 1);
        assertEquals(
                "REVOKED",
                user.detail(WorkspaceUserService.AccountDetailQuery.forPlatform(workspaceId, "public-flow", accountId))
                        .assignments()
                        .getFirst()
                        .status());
    }

    @Test
    void platformInvitationPageAllowsEachOptionalAssignmentFilterIndependently() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000011",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        UUID groupRoleId = new WorkspaceRoleService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "Group user", "GROUP", null, Set.of(), Set.of())
                .id();
        var differentType = invitations.create(
                workspaceId,
                "public-flow",
                "13800000014",
                List.of(new WorkspaceInvitationService.AssignmentIntent(groupRoleId, "GROUP", groupId)),
                NOW + 60 * 60 * 1000L);
        var byType = invitations.managementPage(workspaceId, "public-flow", pageRequest("REGION", null, null));
        var byOrganization = invitations.managementPage(workspaceId, "public-flow", pageRequest(null, regionId, null));
        var byRole = invitations.managementPage(workspaceId, "public-flow", pageRequest(null, null, roleId));
        assertEquals(true, byType.items().stream().anyMatch(item -> item.id().equals(created.id())));
        assertEquals(false, byType.items().stream().anyMatch(item -> item.id().equals(differentType.id())));
        assertEquals(
                true, byOrganization.items().stream().anyMatch(item -> item.id().equals(created.id())));
        assertEquals(true, byRole.items().stream().anyMatch(item -> item.id().equals(created.id())));
    }

    @Test
    void invitationMobileFilterMatchesNormalizedOwnerFactRatherThanMaskedDisplayText() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000012",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        var page = invitations.managementPage(
                workspaceId,
                "public-flow",
                new WorkspaceInvitationService.ManagementInvitationPageRequest(
                        "138 0000-0012", null, null, null, null, null, null, "CREATED_AT", "DESC", 1, 20));
        assertEquals(
                List.of(created.id()),
                page.items().stream()
                        .filter(item -> item.id().equals(created.id()))
                        .map(WorkspaceInvitationService.ManagementInvitationView::id)
                        .toList());
    }

    @Test
    void platformInvitationPageDoesNotComposeTypeOrganizationAndRoleAcrossDifferentIntents() {
        UUID otherRegionId = new OrganizationHierarchyService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "REGION", null, "other-region", "Other region")
                .id();
        UUID otherRoleId = new WorkspaceRoleService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "Other region user", "REGION", null, Set.of(), Set.of())
                .id();
        UUID groupRoleId = new WorkspaceRoleService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "Group reviewer", "GROUP", null, Set.of(), Set.of())
                .id();
        UUID malformedInvitationId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, "
                        + "mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) "
                        + "VALUES "
                        + "(?, ?, 'public-flow', ?, '13800000013', 'PENDING', ?, 1, ?)",
                malformedInvitationId,
                workspaceId,
                sha256("malformed-cross-intent"),
                NOW + 60 * 60 * 1000L,
                NOW);
        jdbc.update(
                "INSERT INTO workspace_iam.invitation_assignment_intent (invitation_id, role_id, service_node_type, "
                        + "service_node_id) VALUES (?, ?, 'GROUP', ?), (?, ?, 'REGION', ?)",
                malformedInvitationId,
                groupRoleId,
                groupId,
                malformedInvitationId,
                otherRoleId,
                otherRegionId);

        try {
            var crossIntentRequest = pageRequest("GROUP", otherRegionId, otherRoleId);
            assertEquals(
                    false,
                    invitations.managementPage(workspaceId, "public-flow", crossIntentRequest).items().stream()
                            .anyMatch(item -> item.id().equals(malformedInvitationId)));
        } finally {
            jdbc.update(
                    "DELETE FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=?",
                    malformedInvitationId);
            jdbc.update("DELETE FROM workspace_iam.invitation WHERE id=?", malformedInvitationId);
        }
    }

    @Test
    void platformInvitationCreationRejectsMixedTargetsBeforePersistence() {
        UUID otherRegionId = new OrganizationHierarchyService(jdbc, () -> NOW)
                .create(workspaceId, "public-flow", "REGION", null, "mixed-region", "Mixed region")
                .id();
        assertThrows(
                WorkspaceInvitationService.InvitationValidationException.class,
                () -> invitations.create(
                        workspaceId,
                        "public-flow",
                        "13800000015",
                        List.of(
                                new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId),
                                new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", otherRegionId)),
                        NOW + 60 * 60 * 1000L));
    }

    @Test
    void managementPageRetainsCreatedInvitationTokenForTheExistingPublicLink() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000012",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L);
        var item =
                invitations
                        .managementPage(workspaceId, "public-flow", pageRequest("REGION", null, null))
                        .items()
                        .stream()
                        .filter(value -> value.id().equals(created.id()))
                        .findFirst()
                        .orElseThrow();
        assertEquals(
                created.rawInvitationToken(),
                jdbc.queryForObject(
                        "SELECT invitation_token FROM workspace_iam.invitation WHERE id=?",
                        String.class,
                        created.id()));
        assertEquals("public-flow", item.invitationRouteFacts().groupWorkspaceKey());
        assertEquals(created.rawInvitationToken(), item.invitationRouteFacts().invitationToken());
    }

    @Test
    void managementDetailPersistsIssuerSnapshotInsteadOfDerivingItFromAuditHistory() {
        var created = invitations.create(
                workspaceId,
                "public-flow",
                "13800000016",
                List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", regionId)),
                NOW + 60 * 60 * 1000L,
                new AuditActor("PLATFORM_ADMIN", UUID.randomUUID(), "值班管理员"));
        var detail = invitations.managementInvitation(workspaceId, "public-flow", created.id());
        assertEquals("13800000016", detail.mobile());
        assertEquals("值班管理员", detail.issuerDisplayName());
        jdbc.update(
                "UPDATE workspace_iam.audit_event SET actor_display_snapshot='已变更审计显示' WHERE "
                        /* format-wrap */
                        + "entity_ref_text=?",
                created.id().toString());
        assertEquals(
                "值班管理员",
                invitations
                        .managementInvitation(workspaceId, "public-flow", created.id())
                        .issuerDisplayName());
    }

    private static WorkspaceInvitationService.ManagementInvitationPageRequest pageRequest(
            String targetOrganizationType, UUID targetOrganizationRef, UUID roleId) {
        return new WorkspaceInvitationService.ManagementInvitationPageRequest(
                null,
                targetOrganizationType,
                targetOrganizationRef,
                roleId,
                null,
                null,
                null,
                "CREATED_AT",
                "DESC",
                1,
                20);
    }

    private static int assignments(UUID invitationId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?",
                Integer.class,
                invitationId);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
