package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WorkspaceAccountPlatformReceiptTest {
    private static final long NOW = 1_785_000_000_000L;
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static WorkspaceAccountService accounts;
    private static UUID workspaceId;
    private static UUID accountId;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load();
        flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        workspaceId = UUID.randomUUID(); accountId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'receipt-test', 'Receipt test', 'receipt test', 'Receipt test', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, NOW, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, 'receipt-test', '13800000071', 'receipt-user', 'Receipt user', 'ENABLED', 1, ?, ?)", accountId, workspaceId, NOW, NOW);
        TimeProvider time = () -> NOW;
        WorkspaceStatusLookup workspaces = (id, key) -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT status='ENABLED' FROM platform_workspace.group_workspace WHERE workspace_uuid=? AND group_workspace_key=?", Boolean.class, id, key));
        PlatformGovernanceAuthorization authorization = actor -> { };
        accounts = new WorkspaceAccountService(jdbc, time, new WorkspaceCommandAuthorizationService(jdbc), new WorkspaceIamCommandReceiptService(jdbc, time), workspaces, authorization);
    }

    @Test void replaysTheOwnerReadbackAndRejectsAChangedPlatformAccountCommand() {
        AuditActor actor = new AuditActor("PLATFORM_ADMIN", UUID.randomUUID(), "Platform admin");
        var first = accounts.transitionStatusForPlatform(workspaceId, "receipt-test", accountId, "DISABLED", 1L, "platform-account-status-001", actor);
        var replay = accounts.transitionStatusForPlatform(workspaceId, "receipt-test", accountId, "DISABLED", 1L, "platform-account-status-001", actor);
        assertEquals(first, replay);
        assertEquals(2L, replay.version());
        assertThrows(WorkspaceIamCommandReceiptService.WorkspaceIamIdempotencyConflictException.class, () -> accounts.transitionStatusForPlatform(workspaceId, "receipt-test", accountId, "ENABLED", 2L, "platform-account-status-001", actor));
    }

    @Test void ownerCommandDoesNotDuplicateThePlatformSelectedWorkspaceGate() {
        jdbc.update("UPDATE platform_workspace.group_workspace SET status='DISABLED' WHERE workspace_uuid=?", workspaceId);
        AuditActor actor = new AuditActor("PLATFORM_ADMIN", UUID.randomUUID(), "Platform admin");
        var result = accounts.transitionStatusForPlatform(workspaceId, "receipt-test", accountId, "ENABLED", 2L, "platform-account-status-disabled", actor);
        assertEquals("ENABLED", result.status());
        assertEquals(3L, result.version());
        jdbc.update("UPDATE platform_workspace.group_workspace SET status='ENABLED' WHERE workspace_uuid=?", workspaceId);
    }

    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
