package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.extension.application.ExtensionDefinitionService;
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
    private static Flyway flyway; private static JdbcTemplate jdbc; private static WorkspaceInvitationService invitations; private static WorkspacePasswordResetService passwordResets; private static WorkspaceAuthenticationService authentication; private static WorkspaceUserService user; private static UUID workspaceId; private static UUID groupId; private static UUID roleId;
    private static final long NOW = 1_785_000_000_000L;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load(); flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())); TimeProvider time = () -> NOW; workspaceId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'public-flow', 'Public flow', 'public flow', 'Public flow', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, NOW, NOW, NOW);
        ExtensionDefinitionService definitions = new ExtensionDefinitionService(jdbc, time); OrganizationHierarchyService hierarchy = new OrganizationHierarchyService(jdbc, time); BusinessEntityService entities = new BusinessEntityService(jdbc, time, definitions, hierarchy); WorkspaceRoleService roles = new WorkspaceRoleService(jdbc, time);
        groupId = hierarchy.create(workspaceId, "public-flow", "REGION", null, "region", "Region").id(); roleId = roles.create(workspaceId, "public-flow", "Region user", "REGION", null, Set.of(), Set.of()).id(); invitations = new WorkspaceInvitationService(jdbc, time, roles, hierarchy, entities, entities); passwordResets = new WorkspacePasswordResetService(jdbc, time); authentication = new WorkspaceAuthenticationService(jdbc, time, roles, hierarchy, entities, entities); user = new WorkspaceUserService(jdbc, hierarchy, entities, roles);
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

    @Test void resetOnlyCompletesAfterMobileBoundOtpAndGrantAndRevokesSessions() {
        UUID accountId = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', '13800000008', 'reset-user', 'Reset User', 'ENABLED', 1, ?, ?)", accountId, workspaceId, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", accountId, new BCryptPasswordEncoder().encode("previous-password"), NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, token_hash, context_version, authorization_revision, status, expires_at_epoch_millis) VALUES (?, ?, 'public-flow', ?, ?, 1, 1, 'ACTIVE', ?)", UUID.randomUUID(), workspaceId, accountId, sha256("active-session"), NOW + 60_000L);
        var requested = passwordResets.request(workspaceId, "public-flow", accountId, 1);
        passwordResets.sendOtp(requested.rawGenerationKey(), "13800000008");
        UUID resetId = jdbc.queryForObject("SELECT id FROM workspace_iam.password_reset WHERE generation_key_hash=?", UUID.class, sha256(requested.rawGenerationKey()));
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=?", resetId);
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, 'public-flow', 'PASSWORD_RESET_VERIFY', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), workspaceId, sha256("123456"), resetId, NOW + 60_000L);
        var ready = passwordResets.verifyOtp(requested.rawGenerationKey(), "138 0000 0008", "123456");
        var completed = passwordResets.complete(requested.rawGenerationKey(), ready.passwordResetGrant(), "new-password".toCharArray());
        assertEquals("COMPLETED", completed.status());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.workspace_session WHERE account_id=? AND status='ACTIVE'", Integer.class, accountId));
        assertThrows(WorkspacePasswordResetService.ResetStateException.class, () -> passwordResets.complete(requested.rawGenerationKey(), ready.passwordResetGrant(), "other-password".toCharArray()));
    }

    @Test void operationsOtpCreatesSessionOnlyAfterOneTimeMobileBoundProof() {
        UUID accountId = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', '13800000009', 'otp-user', 'OTP User', 'ENABLED', 1, ?, ?)", accountId, workspaceId, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", accountId, new BCryptPasswordEncoder().encode("unused-password"), NOW);
        authentication.sendLoginOtp("public-flow", "13800000009");
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND purpose='WORKSPACE_LOGIN'", accountId);
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, 'public-flow', 'WORKSPACE_LOGIN', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), workspaceId, sha256("654321"), accountId, NOW + 60_000L);
        assertThrows(WorkspaceAuthenticationService.OtpInvalidException.class, () -> authentication.verifyLoginOtp("public-flow", "13800000009", "000000"));
        var session = authentication.verifyLoginOtp("public-flow", "+138 0000 0009", "654321");
        assertEquals(accountId, session.session().accountId());
        assertThrows(WorkspaceAuthenticationService.OtpInvalidException.class, () -> authentication.verifyLoginOtp("public-flow", "13800000009", "654321"));
    }

    @Test void userUsesOwnerPathAndScopeInsteadOfAnUnboundedAccountList() {
        UUID accountId = UUID.randomUUID(); UUID assignmentId = UUID.randomUUID();
        UUID scopeId = new OrganizationHierarchyService(jdbc, () -> NOW).create(workspaceId, "public-flow", "REGION", null, "user-scope", "User scope").id();
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', '13800000010', 'user-user', 'User User', 'ENABLED', 1, ?, ?)", accountId, workspaceId, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", accountId, new BCryptPasswordEncoder().encode("user-password"), NOW);
        UUID invitationId = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, mobile_normalized, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, 'public-flow', 'user-token-hash', '13800000010', 'COMPLETED', ?, 1, ?)", invitationId, workspaceId, NOW + 60_000L, NOW);
        jdbc.update("INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, role_id, source_invitation_id, service_node_type, service_node_id, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'public-flow', ?, ?, ?, 'REGION', ?, 'ACTIVE', 1, ?, ?)", assignmentId, workspaceId, accountId, roleId, invitationId, scopeId, NOW, NOW);
        var page = user.page(workspaceId, "public-flow", "REGION", scopeId, 1, 20, 7);
        assertEquals(1, page.total()); assertEquals(1, page.items().size()); assertEquals("user-scope User scope", page.items().getFirst().assignments().getFirst().organizationPath()); assertEquals(7, page.contextVersion());
        UUID emptyScopeId = new OrganizationHierarchyService(jdbc, () -> NOW).create(workspaceId, "public-flow", "REGION", null, "empty-scope", "Empty scope").id();
        assertEquals(0, user.page(workspaceId, "public-flow", "REGION", emptyScopeId, 1, 20, 7).total());
        new WorkspaceAccountService(jdbc, () -> NOW).revokeAssignment(workspaceId, "public-flow", accountId, assignmentId, 1);
        assertEquals("REVOKED", user.user(workspaceId, "public-flow", accountId).assignments().getFirst().status());
    }


    private static int assignments(UUID invitationId) { return jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?", Integer.class, invitationId); }
    private static String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }
    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
