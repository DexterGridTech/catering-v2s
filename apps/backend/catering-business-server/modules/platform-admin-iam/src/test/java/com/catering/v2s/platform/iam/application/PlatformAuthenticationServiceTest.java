package com.catering.v2s.platform.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.audit.contract.AuditActor;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
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
class PlatformAuthenticationServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static PlatformAuthenticationService service;
    private static PlatformAuthenticationService debugService;
    private static JdbcTemplate jdbc;
    private static final long NOW = 1_785_000_000_000L;
    private static final AtomicLong CLOCK = new AtomicLong(NOW);

    @BeforeAll static void setup() throws Exception {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_iam.platform_admin (id, login_name, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, 'ENABLED', 1, ?, ?)", id, "dexter", "dexter", "Dexter", NOW, NOW);
        jdbc.update("INSERT INTO platform_iam.platform_credential (platform_admin_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", id, new BCryptPasswordEncoder().encode("valid-password"), NOW);
        TimeProvider time = CLOCK::get;
        service = new PlatformAuthenticationService(jdbc, time);
        debugService = new PlatformAuthenticationService(jdbc, time, new PlatformCommandReceiptService(jdbc, time), "platform-auth-test-hmac", true);
    }

    @Test void loginSessionAndLogoutUseOnlyHashedToken() {
        PlatformAuthenticationService.LoginResult login = service.login("Dexter", "valid-password".toCharArray());
        assertEquals("Dexter", service.requireActiveSession(login.rawSessionToken()).displayName());
        service.logout(login.rawSessionToken());
        assertThrows(PlatformAuthenticationService.SessionExpiredException.class, () -> service.requireActiveSession(login.rawSessionToken()));
    }

    @Test void wrongCredentialHasTypedFailure() {
        assertThrows(PlatformAuthenticationService.InvalidCredentialsException.class, () -> service.login("dexter", "wrong".toCharArray()));
    }

    @Test void passwordRotationUsesSessionCasAndRevokesEverySession() {
        service.createAdministrator("rotation-admin", "Rotation Admin", "valid-password".toCharArray());
        PlatformAuthenticationService.LoginResult first = service.login("rotation-admin", "valid-password".toCharArray());
        PlatformAuthenticationService.LoginResult second = service.login("rotation-admin", "valid-password".toCharArray());
        assertEquals("COMPLETED", service.changeCurrentPassword(first.rawSessionToken(), "valid-password".toCharArray(), "rotated-password".toCharArray(), 1).status());
        assertThrows(PlatformAuthenticationService.SessionExpiredException.class, () -> service.requireActiveSession(first.rawSessionToken()));
        assertThrows(PlatformAuthenticationService.SessionExpiredException.class, () -> service.requireActiveSession(second.rawSessionToken()));
        assertEquals("Rotation Admin", service.login("rotation-admin", "rotated-password".toCharArray()).session().displayName());
    }

    @Test void administratorCredentialResetUsesAdminCasAndDoesNotKeepOldSessions() {
        PlatformAuthenticationService.PlatformAdminReadback created = service.createAdministrator("reset-admin", "Reset Admin", "initial-password".toCharArray());
        PlatformAuthenticationService.LoginResult old = service.login("reset-admin", "initial-password".toCharArray());
        PlatformAuthenticationService.PlatformAdminReadback reset = service.resetAdministratorCredential(created.id(), "replaced-password".toCharArray(), created.version());
        assertEquals(created.version() + 1, reset.version());
        assertThrows(PlatformAuthenticationService.SessionExpiredException.class, () -> service.requireActiveSession(old.rawSessionToken()));
        assertEquals("Reset Admin", service.login("reset-admin", "replaced-password".toCharArray()).session().displayName());
    }

    @Test void administratorCreateAndCasProfileUpdateHaveOwnerReadback() {
        PlatformAuthenticationService.PlatformAdminReadback created = service.createAdministrator("second-admin", "Second Admin", "another-valid-password".toCharArray());
        assertEquals("Second Admin", created.displayName());
        PlatformAuthenticationService.PlatformAdminReadback updated = service.updateAdministratorProfile(created.id(), "Updated Admin", created.version());
        assertEquals("Updated Admin", updated.displayName());
        assertThrows(PlatformAuthenticationService.PlatformAdminVersionConflictException.class, () -> service.updateAdministratorProfile(created.id(), "Stale", created.version()));
    }

    @Test void administratorPageAcceptsOmittedOptionalFilters() {
        PlatformAuthenticationService.PlatformAdminPage page = service.pageAdministrators(null, null, null, 1, 50, "USER_NAME", "ASC");
        assertEquals(1, page.total());
        assertEquals("Dexter", page.items().getFirst().displayName());
    }

    @Test void disabledPlatformAdministratorCannotExecuteAnyAdministratorGovernanceCommand() {
        PlatformAuthenticationService.PlatformAdminReadback disabled = service.createAdministrator("disabled-command-actor", "Disabled command actor", "initial-password".toCharArray());
        jdbc.update("UPDATE platform_iam.platform_admin SET status='DISABLED' WHERE id=?", disabled.id());
        AuditActor actor = new AuditActor("PLATFORM_ADMIN", disabled.id(), disabled.displayName());

        assertThrows(PlatformAuthenticationService.AccountDisabledException.class, () -> service.createAdministrator("denied-command-create", "Denied create", null, "initial-password".toCharArray(), actor));
        assertThrows(PlatformAuthenticationService.AccountDisabledException.class, () -> service.updateAdministratorProfile(disabled.id(), "Denied update", null, disabled.version(), actor));
        assertThrows(PlatformAuthenticationService.AccountDisabledException.class, () -> service.transitionAdministratorStatus(disabled.id(), "DISABLED", disabled.version(), actor));
        assertThrows(PlatformAuthenticationService.AccountDisabledException.class, () -> service.resetAdministratorCredential(disabled.id(), "replacement-password".toCharArray(), disabled.version(), actor));
        assertThrows(PlatformAuthenticationService.AccountDisabledException.class, () -> service.createAdministrator("denied-command-replay", "Denied replay", null, "initial-password".toCharArray(), "1234567890abcdef", actor));
    }

    @Test void otpLoginUsesCanonicalMobileRatherThanDisplayMobile() {
        PlatformAuthenticationService.PlatformAdminReadback created = debugService.createAdministrator("otp-admin", "OTP Admin", "+86 138 1234 5678", "initial-password".toCharArray());
        jdbc.update("UPDATE platform_iam.platform_admin SET mobile_mask_source=? WHERE id=?", "139****0000", created.id());

        PlatformAuthenticationService.OtpDispatch delivery = debugService.sendLoginOtp("+8613812345678", "203.0.113.10");
        assertEquals(6, delivery.debugVerificationCode().length());
        assertEquals("OTP Admin", debugService.verifyLoginOtp("8613812345678", delivery.debugVerificationCode(), "203.0.113.10").session().displayName());
        assertThrows(PlatformAuthenticationService.OtpInvalidException.class, () -> debugService.verifyLoginOtp("8613812345678", delivery.debugVerificationCode(), "203.0.113.10"));
    }

    @Test void expiredOtpAndRateLimitHaveTypedOwnerFailures() {
        debugService.createAdministrator("expiry-admin", "Expiry Admin", "13812345679", "initial-password".toCharArray());
        PlatformAuthenticationService.OtpDispatch delivery = debugService.sendLoginOtp("13812345679", "203.0.113.11");
        CLOCK.addAndGet(5 * 60 * 1000L + 1);
        assertThrows(PlatformAuthenticationService.OtpInvalidException.class, () -> debugService.verifyLoginOtp("13812345679", delivery.debugVerificationCode(), "203.0.113.11"));
        CLOCK.set(NOW);
        debugService.createAdministrator("limit-admin", "Limit Admin", "13812345678", "initial-password".toCharArray());
        for (int index = 0; index < 5; index++) debugService.sendLoginOtp("13812345678", "203.0.113.12");
        assertThrows(PlatformAuthenticationService.OtpRateLimitedException.class, () -> debugService.sendLoginOtp("13812345678", "203.0.113.12"));
    }

    @Test void fixedClockRateCountersAccumulateInsteadOfResettingAtTheSameMillisecond() {
        service.createAdministrator("fixed-clock-rate", "Fixed Clock Rate", "initial-password".toCharArray());
        assertThrows(PlatformAuthenticationService.InvalidCredentialsException.class, () -> service.login("fixed-clock-rate", "wrong-password".toCharArray(), "203.0.113.15"));
        assertThrows(PlatformAuthenticationService.InvalidCredentialsException.class, () -> service.login("fixed-clock-rate", "wrong-password".toCharArray(), "203.0.113.15"));
        assertEquals(2, jdbc.queryForObject("SELECT max(failed_attempts) FROM platform_iam.platform_login_rate_limit_bucket WHERE dimension='ACCOUNT'", Integer.class));
    }

    @Test void selfServiceRecoveryDoesNotUseAdministrativeResetAndRevokesSessions() {
        PlatformAuthenticationService.PlatformAdminReadback created = debugService.createAdministrator("recovery-admin", "Recovery Admin", "13812345677", "initial-password".toCharArray());
        PlatformAuthenticationService.LoginResult existing = debugService.login("recovery-admin", "initial-password".toCharArray(), "203.0.113.13");
        PlatformAuthenticationService.RecoveryStart unknown = debugService.startPasswordRecovery("unknown-admin", "13812345676", "203.0.113.14");
        PlatformAuthenticationService.RecoveryStart known = debugService.startPasswordRecovery("recovery-admin", "13812345677", "203.0.113.14");
        assertEquals(known.rawFlowToken().length(), unknown.rawFlowToken().length());
        PlatformAuthenticationService.PasswordRecoveryFlowCredential flow = PlatformAuthenticationService.PasswordRecoveryFlowCredential.fromEdgeCookie(known.rawFlowToken());
        PlatformAuthenticationService.OtpDispatch delivery = debugService.sendPasswordRecoveryOtp(flow, "203.0.113.14");
        assertEquals("PASSWORD_REQUIRED", debugService.verifyPasswordRecoveryOtp(flow, delivery.debugVerificationCode(), "203.0.113.14").status());
        assertEquals("COMPLETED", debugService.completePasswordRecovery(flow, "recovered-password".toCharArray()).status());
        assertThrows(PlatformAuthenticationService.SessionExpiredException.class, () -> debugService.requireActiveSession(existing.rawSessionToken()));
        assertThrows(PlatformAuthenticationService.RecoveryFlowInvalidException.class, () -> debugService.completePasswordRecovery(flow, "second-password".toCharArray()));
        assertEquals(created.displayName(), debugService.login("recovery-admin", "recovered-password".toCharArray(), "203.0.113.13").session().displayName());
    }

    @AfterAll static void cleanup() throws Exception {
        if (flyway != null) flyway.clean();
        try (Connection connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()); Statement statement = connection.createStatement()) {
            for (String schema : new String[]{"contract", "workspace_iam", "extension", "platform_asset", "platform_iam", "organization", "platform_workspace"}) statement.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }
}
