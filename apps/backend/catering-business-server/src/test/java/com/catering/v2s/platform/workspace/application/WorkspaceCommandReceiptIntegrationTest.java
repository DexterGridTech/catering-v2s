package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** A global platform actor must not replay a receipt from another workspace key. */
@Testcontainers
class WorkspaceCommandReceiptIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static WorkspaceCommandReceiptService receipts;
    private static JdbcTemplate jdbc;

    @BeforeAll static void setup() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:src/main/resources/db/migration").schemas("public").defaultSchema("public").load().migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        receipts = new WorkspaceCommandReceiptService(
            jdbc,
            (TimeProvider) () -> 1_785_000_000_000L
        );
    }

    @AfterAll static void cleanup() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).cleanDisabled(false).load().clean();
    }

    @Test void identicalIdempotencyKeyDoesNotReplayAnotherWorkspaceReadback() {
        String key = "workspace-receipt-key-0001";
        AtomicInteger commands = new AtomicInteger();
        WorkspaceAdministrationReadback first = receipts.execute("workspace-a", key, "same-request", () -> readback("workspace-a", commands.incrementAndGet()));
        WorkspaceAdministrationReadback second = receipts.execute("workspace-b", key, "same-request", () -> readback("workspace-b", commands.incrementAndGet()));

        assertEquals("workspace-a", first.groupWorkspaceKey());
        assertEquals("workspace-b", second.groupWorkspaceKey());
        assertEquals(2, commands.get());
    }

    private static WorkspaceAdministrationReadback readback(String groupWorkspaceKey, int serial) {
        return new WorkspaceAdministrationReadback(UUID.nameUUIDFromBytes((groupWorkspaceKey + serial).getBytes()), groupWorkspaceKey,
            "Workspace " + groupWorkspaceKey, "Operations", null, null, "ENABLED", 1L, 1L, 1L, 1L, false);
    }
}
