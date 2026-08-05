package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WorkspaceInvitationPublicFlowTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway; private static JdbcTemplate jdbc; private static WorkspaceInvitationService invitations; private static WorkspaceAuthenticationService authentication; private static WorkspaceUserService user; private static UUID workspaceId; private static UUID groupId; private static UUID roleId;
    private static final long NOW = 1_785_000_000_000L;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load(); flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())); TimeProvider time = () -> NOW; workspaceId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'public-flow', 'Public flow', 'public flow', 'Public flow', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, NOW, NOW, NOW);
        ExtensionDefinitionService definitions = new ExtensionDefinitionService(jdbc, time); OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, time); BusinessEntityService entities = new BusinessEntityService(jdbc, time, definitions, hierarchy); WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, time);
        groupId = hierarchy.create(workspaceId, "public-flow", "REGION", null, "region", "Region").id(); roleId = roles.create(workspaceId, "public-flow", "Region user", "REGION", null, Set.of(), Set.of()).id(); invitations = new WorkspaceInvitationService(jdbc, time, roles, hierarchy, entities, entities); authentication = new WorkspaceAuthenticationService(jdbc, time, roles, hierarchy, entities, entities); user = new WorkspaceUserService(jdbc, hierarchy, entities, roles);
    }

    @Test void onlyFinalizeCreatesAssignmentsAfterAcceptOtpAndCredentialDraft() {
        var created = invitations.create(workspaceId, "public-flow", "13800000001", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        String otp = invitations.issueMobileVerificationOtp("public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        var verified = invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000001", otp);
        assertEquals(0, assignments(created.id()));
        invitations.savePublicCredentials("public-flow", created.rawInvitationToken(), verified.verificationGrant(), "Public User", "public-user", "a-secure-password".toCharArray());
        assertEquals(0, assignments(created.id()));
        var completion = invitations.completePublic("public-flow", created.rawInvitationToken());
        assertEquals("COMPLETED", completion.status()); assertEquals(1, assignments(created.id())); assertEquals(completion.invitationId(), invitations.publicCompletion("public-flow", created.rawInvitationToken()).invitationId());
    }

    @Test void publicOtpCannotBeSentOrVerifiedForAnotherMobile() {
        var created = invitations.create(workspaceId, "public-flow", "13800000002", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        assertThrows(WorkspaceInvitationService.InvitationValidationException.class, () -> invitations.sendPublicOtp("public-flow", created.rawInvitationToken(), "13800000003"));
        String otp = invitations.issueMobileVerificationOtp("public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        assertThrows(WorkspaceInvitationService.InvitationValidationException.class, () -> invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000003", otp));
        assertEquals(0, assignments(created.id()));
    }

    @Test void publicInvitationRejectsExpiredAndInvalidOtpStatesAndCompletionReplayPreservesOneAssignment() {
        var expired = invitations.create(workspaceId, "public-flow", "13800000004", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        jdbc.update("UPDATE workspace_iam.invitation SET expires_at_epoch_millis=? WHERE id=?", NOW - 1, expired.id());
        assertThrows(WorkspaceInvitationService.InvitationStateException.class, () -> invitations.acceptPublic("public-flow", expired.rawInvitationToken()));

        var created = invitations.create(workspaceId, "public-flow", "13800000005", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        assertThrows(WorkspaceInvitationService.InvitationStateException.class, () -> invitations.sendPublicOtp("public-flow", created.rawInvitationToken(), "13800000005"));
        invitations.acceptPublic("public-flow", created.rawInvitationToken());
        String otp = invitations.issueMobileVerificationOtp("public-flow", created.rawInvitationToken(), NOW + 5 * 60 * 1000L);
        assertThrows(WorkspaceInvitationService.InvitationStateException.class, () -> invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000005", "000000"));
        var verified = invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000005", otp);
        assertThrows(WorkspaceInvitationService.InvitationStateException.class, () -> invitations.verifyPublicOtp("public-flow", created.rawInvitationToken(), "13800000005", otp));
        invitations.savePublicCredentials("public-flow", created.rawInvitationToken(), verified.verificationGrant(), "Replay User", "replay-user", "a-secure-password".toCharArray());
        var completed = invitations.completePublic("public-flow", created.rawInvitationToken());
        var replay = invitations.completePublic("public-flow", created.rawInvitationToken());
        assertEquals(completed.invitationId(), replay.invitationId());
        assertEquals(1, assignments(created.id()));
    }

    @Test void operationsOtpCreatesSessionOnlyAfterOneTimeMobileBoundProof() {
        UUID accountId = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', '13800000009', 'otp-user', 'OTP User', 'ENABLED', 1, ?, ?)", accountId, workspaceId, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", accountId, new BCryptPasswordEncoder().encode("unused-password"), NOW);
        authentication.sendLoginOtp("public-flow", "13800000009");
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND purpose='WORKSPACE_LOGIN'", accountId);
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, 'public-flow', 'WORKSPACE_LOGIN', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), workspaceId, sha256("654321"), accountId, NOW + 60_000L);
        assertThrows(WorkspaceAuthenticationService.OtpInvalidException.class, () -> authentication.verifyLoginOtp("public-flow", "13800000009", "000000"));
        var session = authentication.verifyLoginOtpWithSessionEntry("public-flow", "+138 0000 0009", "654321");
        assertEquals(accountId, session.sessionEntry().accountId());
        assertEquals("public-flow", session.sessionEntry().groupWorkspaceKey());
        assertEquals(session.sessionEntry(), authentication.sessionEntry(session.rawSessionToken(), "public-flow"));
        assertThrows(WorkspaceAuthenticationService.SessionInvalidException.class, () -> authentication.sessionEntry(session.rawSessionToken(), "another-workspace"));
        assertThrows(WorkspaceAuthenticationService.OtpInvalidException.class, () -> authentication.verifyLoginOtpWithSessionEntry("public-flow", "13800000009", "654321"));
    }

    @Test void userUsesOwnerPathAndScopeInsteadOfAnUnboundedAccountList() {
        UUID accountId = UUID.randomUUID(); UUID assignmentId = UUID.randomUUID();
        UUID scopeId = new OrganizationHierarchyService(jdbc, () -> NOW).create(workspaceId, "public-flow", "REGION", null, "user-scope", "User scope").id();
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', '13800000010', 'user-user', 'User User', 'ENABLED', 1, ?, ?)", accountId, workspaceId, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", accountId, new BCryptPasswordEncoder().encode("user-password"), NOW);
        UUID invitationId = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, 'public-flow', 'user-token-hash', '13800000010', 'COMPLETED', ?, 1, ?)", invitationId, workspaceId, NOW + 60_000L, NOW);
        jdbc.update("INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, role_id, source_invitation_id, service_node_type, service_node_id, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', ?, ?, ?, 'REGION', ?, 'ACTIVE', 1, ?, ?)", assignmentId, workspaceId, accountId, roleId, invitationId, scopeId, NOW, NOW);
        var page = user.page(WorkspaceUserService.AccountPageQuery.forPlatform(workspaceId, "public-flow", null, null, null, null, null, "REGION", scopeId, null, null, 1, 20));
        assertEquals(1, page.total()); assertEquals(1, page.items().size()); assertEquals("user-scope User scope", page.items().getFirst().assignments().getFirst().organizationPath());
        UUID emptyScopeId = new OrganizationHierarchyService(jdbc, () -> NOW).create(workspaceId, "public-flow", "REGION", null, "empty-scope", "Empty scope").id();
        assertEquals(0, user.page(WorkspaceUserService.AccountPageQuery.forPlatform(workspaceId, "public-flow", null, null, null, null, null, "REGION", emptyScopeId, null, null, 1, 20)).total());
        new WorkspaceAccountService(jdbc, () -> NOW).revokeAssignment(workspaceId, "public-flow", accountId, assignmentId, 1);
        assertEquals("REVOKED", user.detail(WorkspaceUserService.AccountDetailQuery.forPlatform(workspaceId, "public-flow", accountId)).assignments().getFirst().status());
    }

    @Test void platformInvitationPageAllowsEachOptionalAssignmentFilterIndependently() {
        var created = invitations.create(workspaceId, "public-flow", "13800000011", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        UUID groupRoleId = new WorkspaceRoleService(jdbc, () -> NOW).create(workspaceId, "public-flow", "Group user", "GROUP", null, Set.of(), Set.of()).id();
        var differentType = invitations.create(workspaceId, "public-flow", "13800000014", List.of(new WorkspaceInvitationService.AssignmentIntent(groupRoleId, "GROUP", groupId)), NOW + 60 * 60 * 1000L);
        var byType = invitations.managementPage(workspaceId, "public-flow", pageRequest("REGION", null, null));
        var byOrganization = invitations.managementPage(workspaceId, "public-flow", pageRequest(null, groupId, null));
        var byRole = invitations.managementPage(workspaceId, "public-flow", pageRequest(null, null, roleId));
        assertEquals(true, byType.items().stream().anyMatch(item -> item.id().equals(created.id())));
        assertEquals(false, byType.items().stream().anyMatch(item -> item.id().equals(differentType.id())));
        assertEquals(true, byOrganization.items().stream().anyMatch(item -> item.id().equals(created.id())));
        assertEquals(true, byRole.items().stream().anyMatch(item -> item.id().equals(created.id())));
    }

    @Test void invitationMobileFilterMatchesNormalizedOwnerFactRatherThanMaskedDisplayText() {
        var created = invitations.create(workspaceId, "public-flow", "13800000012", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        var page = invitations.managementPage(workspaceId, "public-flow", new WorkspaceInvitationService.ManagementInvitationPageRequest("138 0000-0012", null, null, null, null, null, null, "CREATED_AT", "DESC", 1, 20));
        assertEquals(List.of(created.id()), page.items().stream().filter(item -> item.id().equals(created.id())).map(WorkspaceInvitationService.ManagementInvitationView::id).toList());
    }

    @Test void platformInvitationPageDoesNotComposeTypeOrganizationAndRoleAcrossDifferentIntents() {
        UUID otherRegionId = new OrganizationHierarchyService(jdbc, () -> NOW).create(workspaceId, "public-flow", "REGION", null, "other-region", "Other region").id();
        UUID otherRoleId = new WorkspaceRoleService(jdbc, () -> NOW).create(workspaceId, "public-flow", "Other region user", "REGION", null, Set.of(), Set.of()).id();
        UUID groupRoleId = new WorkspaceRoleService(jdbc, () -> NOW).create(workspaceId, "public-flow", "Group reviewer", "GROUP", null, Set.of(), Set.of()).id();
        UUID malformedInvitationId = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, 'public-flow', ?, '13800000013', 'PENDING', ?, 1, ?)", malformedInvitationId, workspaceId, sha256("malformed-cross-intent"), NOW + 60 * 60 * 1000L, NOW);
        jdbc.update("INSERT INTO workspace_iam.invitation_assignment_intent (invitation_id, role_id, service_node_type, service_node_id) VALUES (?, ?, 'GROUP', ?), (?, ?, 'REGION', ?)", malformedInvitationId, groupRoleId, groupId, malformedInvitationId, otherRoleId, otherRegionId);

        try {
            var crossIntentRequest = pageRequest("GROUP", otherRegionId, otherRoleId);
            assertEquals(false, invitations.managementPage(workspaceId, "public-flow", crossIntentRequest).items().stream().anyMatch(item -> item.id().equals(malformedInvitationId)));
        } finally {
            jdbc.update("DELETE FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=?", malformedInvitationId);
            jdbc.update("DELETE FROM workspace_iam.invitation WHERE id=?", malformedInvitationId);
        }
    }

    @Test void platformInvitationCreationRejectsMixedTargetsBeforePersistence() {
        UUID otherRegionId = new OrganizationHierarchyService(jdbc, () -> NOW).create(workspaceId, "public-flow", "REGION", null, "mixed-region", "Mixed region").id();
        assertThrows(WorkspaceInvitationService.InvitationValidationException.class, () -> invitations.create(workspaceId, "public-flow", "13800000015", List.of(
            new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId),
            new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", otherRegionId)
        ), NOW + 60 * 60 * 1000L));
    }

    @Test void managementPageRetainsCreatedInvitationTokenForTheExistingPublicLink() {
        var created = invitations.create(workspaceId, "public-flow", "13800000012", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L);
        var item = invitations.managementPage(workspaceId, "public-flow", pageRequest("REGION", null, null)).items().stream().filter(value -> value.id().equals(created.id())).findFirst().orElseThrow();
        assertEquals(created.rawInvitationToken(), jdbc.queryForObject("SELECT invitation_token FROM workspace_iam.invitation WHERE id=?", String.class, created.id()));
        assertEquals("/operations/invitations/public-flow/" + created.rawInvitationToken(), item.invitationPageUrl());
    }

    @Test void managementDetailPersistsIssuerSnapshotInsteadOfDerivingItFromAuditHistory() {
        var created = invitations.create(workspaceId, "public-flow", "13800000016", List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "REGION", groupId)), NOW + 60 * 60 * 1000L, new AuditActor("PLATFORM_ADMIN", UUID.randomUUID(), "值班管理员"));
        var detail = invitations.managementInvitation(workspaceId, "public-flow", created.id());
        assertEquals("13800000016", detail.mobile());
        assertEquals("值班管理员", detail.issuerDisplayName());
        jdbc.update("UPDATE workspace_iam.audit_event SET actor_display_snapshot='已变更审计显示' WHERE entity_ref_text=?", created.id().toString());
        assertEquals("值班管理员", invitations.managementInvitation(workspaceId, "public-flow", created.id()).issuerDisplayName());
    }


    private static WorkspaceInvitationService.ManagementInvitationPageRequest pageRequest(String targetOrganizationType, UUID targetOrganizationRef, UUID roleId) {
        return new WorkspaceInvitationService.ManagementInvitationPageRequest(null, targetOrganizationType, targetOrganizationRef, roleId, null, null, null, "CREATED_AT", "DESC", 1, 20);
    }
    private static int assignments(UUID invitationId) { return jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?", Integer.class, invitationId); }
    private static String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }
    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
