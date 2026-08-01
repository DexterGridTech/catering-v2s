package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.CapabilityKeys;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.PageDesignKeys;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.Set;
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
class WorkspaceRoleServiceTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway; private static WorkspaceRoleService service; private static UUID workspaceId;
    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public").cleanDisabled(false).load(); flyway.migrate();
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())); long now = 1_785_000_000_000L; workspaceId = UUID.randomUUID();
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, name_normalized, operations_title, status, revision, version, created_at_epoch_millis, updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'iam-test', 'IAM test', 'iam test', 'IAM test', 'ENABLED', 1, 1, ?, ?, ?)", workspaceId, now, now, now);
        service = new WorkspaceRoleService(jdbc, (TimeProvider) () -> now);
    }
    @Test void replacesPageAndActionSetsAtomicallyWithoutCrossInference() {
        var role = service.create(workspaceId, "iam-test", "Project operator", "PROJECT", null, Set.of(), Set.of());
        var updated = service.replacePermissions(workspaceId, "iam-test", role.id(), role.version(), Set.of(PageDesignKeys.PG_ORG_STORE_MANAGE), Set.of(CapabilityKeys.BC_ORG_STORE_EDIT));
        assertEquals(Set.of(PageDesignKeys.PG_ORG_STORE_MANAGE), updated.pageAccessKeys()); assertEquals(Set.of(CapabilityKeys.BC_ORG_STORE_EDIT), updated.actionCapabilityKeys());
        assertThrows(WorkspaceRoleService.RoleValidationException.class, () -> service.replacePermissions(workspaceId, "iam-test", updated.id(), updated.version(), Set.of("PG-NOT-APPROVED"), Set.of(CapabilityKeys.BC_ORG_STORE_EDIT)));
        var readback = service.require(workspaceId, "iam-test", updated.id()); assertEquals(updated.version(), readback.version());
    }
    @Test void rejectsHomeAndWrongNodeTypeInsteadOfPersistingCatalogDefinitions() {
        assertThrows(WorkspaceRoleService.PageAccessCatalogMismatchException.class, () -> service.create(workspaceId, "iam-test", "Invalid home", "GROUP", null, Set.of(PageDesignKeys.HOME_GROUP), Set.of()));
        assertThrows(WorkspaceRoleService.RoleCapabilityIncompatibleException.class, () -> service.create(workspaceId, "iam-test", "Invalid action", "STORE", null, Set.of(), Set.of(CapabilityKeys.BC_ORG_GROUP_EDIT)));
    }
    @Test void genericUpdateNeverTransitionsStatus() {
        var role = service.create(workspaceId, "iam-test", "Status boundary", "PROJECT", null, Set.of(), Set.of());
        var updated = service.update(workspaceId, "iam-test", role.id(), role.version(), "Renamed", null, Set.of(), Set.of());
        assertEquals("ENABLED", updated.status());
        assertEquals("DISABLED", service.transitionStatus(workspaceId, "iam-test", updated.id(), "DISABLED", updated.version()).status());
    }
    @Test void rejectsEveryRoleWriteWhenTheOwnerWorkspaceIsDisabled() {
        var role = service.create(workspaceId, "iam-test", "Disabled workspace boundary", "PROJECT", null, Set.of(), Set.of());
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        jdbc.update("UPDATE platform_workspace.group_workspace SET status='DISABLED' WHERE workspace_uuid=?", workspaceId);
        assertThrows(WorkspaceRoleService.WorkspaceDisabledException.class, () -> service.create(workspaceId, "iam-test", "Cannot create", "PROJECT", null, Set.of(), Set.of()));
        assertThrows(WorkspaceRoleService.WorkspaceDisabledException.class, () -> service.update(workspaceId, "iam-test", role.id(), role.version(), "Cannot update", null, Set.of(), Set.of()));
        assertThrows(WorkspaceRoleService.WorkspaceDisabledException.class, () -> service.transitionStatus(workspaceId, "iam-test", role.id(), "DISABLED", role.version()));
        jdbc.update("UPDATE platform_workspace.group_workspace SET status='ENABLED' WHERE workspace_uuid=?", workspaceId);
    }
    @AfterAll static void cleanup() { if (flyway != null) flyway.clean(); }
}
