package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
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
class WorkspacePasswordRecoveryServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static final long NOW = 1_785_000_000_000L;
    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static WorkspacePasswordRecoveryService recovery;
    private static UUID workspaceId;
    private static UUID otherWorkspaceId;
    private static UUID accountId;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        TimeProvider time = () -> NOW;
        workspaceId = workspace("recovery-flow");
        otherWorkspaceId = workspace("other-workspace");
        accountId = account(workspaceId, "recovery-flow", "recovery-user", "13800000001", "ENABLED");
        recovery = new WorkspacePasswordRecoveryService(jdbc, time);
    }

    @Test void verifiedOwnerBoundFlowRevokesSessionsAndCannotBeReused() {
        jdbc.update("INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, token_hash, context_version, authorization_revision, status, expires_at_epoch_millis) VALUES (?, ?, 'recovery-flow', ?, ?, 1, 1, 'ACTIVE', ?)", UUID.randomUUID(), workspaceId, accountId, sha256("active-session"), NOW + 60_000L);
        var started = recovery.start(workspaceId, "recovery-flow", "recovery-user", "138 0000 0001", "127.0.0.1");
        assertEquals(NOW + 30 * 60 * 1000L, started.expiresAt());
        assertNull(recovery.sendOtp(workspaceId, "recovery-flow", started.rawFlow(), "127.0.0.1").debugVerificationCode());
        UUID recoveryId = jdbc.queryForObject("SELECT id FROM workspace_iam.operations_password_recovery WHERE flow_token_hash=?", UUID.class, sha256(started.rawFlow()));
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=?", recoveryId);
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, 'recovery-flow', 'OPERATIONS_PASSWORD_RECOVERY', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), workspaceId, sha256("123456"), recoveryId, NOW + 60_000L);
        var verified = recovery.verifyOtp(workspaceId, "recovery-flow", started.rawFlow(), "123456", "127.0.0.1");
        assertNotEquals(started.rawFlow(), verified.rawCompletionGrant());
        var completion = recovery.complete(workspaceId, "recovery-flow", started.rawFlow(), verified.rawCompletionGrant(), "a-new-password".toCharArray());
        assertEquals("COMPLETED", completion.status());
        assertFalse(jdbc.queryForObject("SELECT COUNT(*) > 0 FROM workspace_iam.workspace_session WHERE account_id=? AND status='ACTIVE'", Boolean.class, accountId));
        assertThrows(WorkspacePasswordRecoveryService.RecoveryStateException.class, () -> recovery.complete(workspaceId, "recovery-flow", started.rawFlow(), verified.rawCompletionGrant(), "another-password".toCharArray()));
    }

    @Test void unknownDisabledMismatchAndCrossWorkspaceNeverReleaseAnAccountOutcome() {
        UUID disabled = account(workspaceId, "recovery-flow", "disabled-user", "13800000002", "DISABLED");
        var unknown = recovery.start(workspaceId, "recovery-flow", "unknown-user", "13800000003", "127.0.0.2");
        var disabledFlow = recovery.start(workspaceId, "recovery-flow", "disabled-user", "13800000002", "127.0.0.3");
        var mismatch = recovery.start(workspaceId, "recovery-flow", "recovery-user", "13800000002", "127.0.0.4");
        var crossWorkspace = recovery.start(otherWorkspaceId, "other-workspace", "recovery-user", "13800000001", "127.0.0.5");
        assertEquals(NOW + 30 * 60 * 1000L, unknown.expiresAt());
        assertEquals(unknown.expiresAt(), disabledFlow.expiresAt());
        assertEquals(unknown.expiresAt(), mismatch.expiresAt());
        assertEquals(unknown.expiresAt(), crossWorkspace.expiresAt());
        assertNull(recovery.sendOtp(workspaceId, "recovery-flow", unknown.rawFlow(), "127.0.0.2").debugVerificationCode());
        assertNull(recovery.sendOtp(workspaceId, "recovery-flow", disabledFlow.rawFlow(), "127.0.0.3").debugVerificationCode());
        assertThrows(WorkspacePasswordRecoveryService.OtpInvalidException.class, () -> recovery.verifyOtp(workspaceId, "recovery-flow", unknown.rawFlow(), "000000", "127.0.0.2"));
        assertThrows(WorkspacePasswordRecoveryService.OtpInvalidException.class, () -> recovery.verifyOtp(workspaceId, "recovery-flow", disabledFlow.rawFlow(), "000000", "127.0.0.3"));
        assertThrows(WorkspacePasswordRecoveryService.RecoveryStateException.class, () -> recovery.sendOtp(otherWorkspaceId, "other-workspace", unknown.rawFlow(), "127.0.0.2"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.operations_password_recovery WHERE account_id=? AND status='OTP_VERIFIED'", Integer.class, disabled));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.operations_password_recovery WHERE account_id=? AND status='OTP_VERIFIED'", Integer.class, accountId));
    }

    @Test void debugPolicyReturnsOnlyTheCurrentRandomOtpWhenExplicitlyEnabled() {
        TimeProvider time = () -> NOW;
        var debugRecovery = new WorkspacePasswordRecoveryService(
            jdbc,
            time,
            new WorkspaceOtpRateLimitService(jdbc, time),
            new WorkspaceLoginRateLimitService(jdbc, time),
            (workspaceUuid, groupWorkspaceKey) -> true,
            true
        );
        var started = debugRecovery.start(workspaceId, "recovery-flow", "recovery-user", "13800000001", "127.0.0.6");
        var delivered = debugRecovery.sendOtp(workspaceId, "recovery-flow", started.rawFlow(), "127.0.0.6");
        assertNotNull(delivered.debugVerificationCode());
        assertEquals(6, delivered.debugVerificationCode().length());
        assertNotNull(debugRecovery.verifyOtp(workspaceId, "recovery-flow", started.rawFlow(), delivered.debugVerificationCode(), "127.0.0.6").rawCompletionGrant());
    }

    @Test void fixedClockLimitsOtpAndRecoveryStartPairEvenWhenSourcesRotate() {
        account(workspaceId, "recovery-flow", "pair-known", "13800000021", "ENABLED");
        for (int attempt = 0; attempt < 10; attempt++) {
            recovery.start(workspaceId, "recovery-flow", "pair-known", "13800000021", "198.51.100." + attempt);
            recovery.start(workspaceId, "recovery-flow", "pair-unknown", "13800000022", "203.0.113." + attempt);
        }
        assertThrows(WorkspaceAuthenticationService.LoginRateLimitedException.class, () -> recovery.start(workspaceId, "recovery-flow", "pair-known", "13800000021", "192.0.2.1"));
        assertThrows(WorkspaceAuthenticationService.LoginRateLimitedException.class, () -> recovery.start(workspaceId, "recovery-flow", "pair-unknown", "13800000022", "192.0.2.2"));

        var flow = recovery.start(workspaceId, "recovery-flow", "otp-window", "13800000023", "192.0.2.3");
        for (int attempt = 0; attempt < 3; attempt++) {
            recovery.sendOtp(workspaceId, "recovery-flow", flow.rawFlow(), "192.0.2.3");
        }
        assertThrows(WorkspaceAuthenticationService.OtpRateLimitedException.class, () -> recovery.sendOtp(workspaceId, "recovery-flow", flow.rawFlow(), "192.0.2.3"));
    }

    private static UUID workspace(String key) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, ?, ?, ?, 'ENABLED', 1, 1, ?, ?, ?)", id, key, key, key, key, NOW, NOW, NOW);
        return id;
    }

    private static UUID account(UUID workspace, String key, String loginName, String mobile, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)", id, workspace, key, mobile, loginName, loginName, status, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", id, new BCryptPasswordEncoder().encode("old-password"), NOW);
        return id;
    }

    private static String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }
    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
