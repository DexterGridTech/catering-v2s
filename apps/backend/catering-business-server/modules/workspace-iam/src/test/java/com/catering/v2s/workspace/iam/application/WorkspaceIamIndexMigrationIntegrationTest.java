package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the Part Two owner-table constraints and query-plan-backed indexes. */
@Testcontainers
class WorkspaceIamIndexMigrationIntegrationTest {
    private static final long NOW = 1_785_000_000_000L;
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID ACCOUNT = UUID.randomUUID();
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static Flyway flyway;
    private static JdbcTemplate jdbc;

    @BeforeAll static void setup() {
        flyway = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:../../src/main/resources/db/migration").schemas("public").defaultSchema("public")
            .cleanDisabled(false).load();
        flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        jdbc.update("INSERT INTO platform_workspace.group_workspace (workspace_uuid,group_workspace_key,name,name_normalized,operations_title,status,revision,version,created_at_epoch_millis,updated_at_epoch_millis,status_changed_at_epoch_millis) VALUES (?, 'index-test', 'Index test', 'index test', 'Index test', 'ENABLED', 1, 1, ?, ?, ?)", WORKSPACE, NOW, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_account (id,workspace_uuid,group_workspace_key,mobile_normalized,login_name_normalized,display_name,status,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?, ?, 'index-test', '13800000099', 'index-user', 'Index user', 'ENABLED', 1, ?, ?)", ACCOUNT, WORKSPACE, NOW, NOW);
        jdbc.update("INSERT INTO workspace_iam.invitation (id,workspace_uuid,group_workspace_key,token_hash,mobile_normalized,status,expires_at_epoch_millis,version,created_at_epoch_millis) VALUES (?, ?, 'index-test', repeat('a', 64), '13800000099', 'PENDING', ?, 1, ?)", UUID.randomUUID(), WORKSPACE, NOW + 86_400_000L, NOW);
        jdbc.update("INSERT INTO workspace_iam.workspace_session (id,workspace_uuid,group_workspace_key,account_id,token_hash,context_version,authorization_revision,status,expires_at_epoch_millis) VALUES (?, ?, 'index-test', ?, repeat('b', 64), 1, 1, 'ACTIVE', ?)", UUID.randomUUID(), WORKSPACE, ACCOUNT, NOW + 86_400_000L);
    }

    @Test void workspaceUuidCannotBackTwoLogicalWorkspaces() {
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
            "INSERT INTO platform_workspace.group_workspace (workspace_uuid,group_workspace_key,name,name_normalized,operations_title,status,revision,version,created_at_epoch_millis,updated_at_epoch_millis,status_changed_at_epoch_millis) VALUES (?, 'other-key', 'Other', 'other', 'Other', 'ENABLED', 1, 1, ?, ?, ?)",
            WORKSPACE, NOW, NOW, NOW));
    }

    @Test void invitationAndActiveSessionPredicatesUseTheirDedicatedIndexes() {
        jdbc.execute("SET enable_seqscan=off");
        assertPlanUses("SELECT id FROM workspace_iam.invitation WHERE workspace_uuid='" + WORKSPACE + "' AND group_workspace_key='index-test' AND mobile_normalized='13800000099'", "ix_workspace_iam_invitation_workspace_mobile");
        assertPlanUses("SELECT id FROM workspace_iam.workspace_session WHERE account_id='" + ACCOUNT + "' AND status='ACTIVE'", "ix_workspace_iam_session_account_status");
    }

    private static void assertPlanUses(String query, String expectedIndex) {
        List<String> plan = jdbc.query("EXPLAIN (COSTS OFF) " + query, (row, index) -> row.getString(1));
        assertTrue(plan.stream().anyMatch(line -> line.contains(expectedIndex)), () -> String.join("\n", plan));
    }

    @AfterAll static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
