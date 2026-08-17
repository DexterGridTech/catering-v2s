package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.application.OrganizationHierarchyCommandReceiptService;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CommandReceiptNamespaceIsolationIntegrationTest {
    private static final long NOW = 1_785_000_000_000L;
    private static final UUID WORKSPACE = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;
    private static JdbcTemplate monitor;

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
        monitor = new JdbcTemplate(dataSource("receipt-namespace-monitor"));
        assertEquals("read committed", monitor.queryForObject("SHOW transaction_isolation", String.class));
    }

    @Test
    void sameWorkspaceAndKeyAcrossReceiptOwnersDoNotShareAdvisoryLock() throws Exception {
        String key = "receipt-namespace-isolation-001";
        CountDownLatch commandsEntered = new CountDownLatch(2);
        CountDownLatch releaseCommands = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        Future<OrganizationNodeReadback> organization =
                executor.submit(() -> executeOrganization(key, commandsEntered, releaseCommands));
        Future<String> workspaceIam = executor.submit(() -> executeWorkspaceIam(key, commandsEntered, releaseCommands));
        try {
            assertTrue(
                    commandsEntered.await(10, TimeUnit.SECONDS),
                    "different receipt owners should reach their command bodies without blocking each other");
            releaseCommands.countDown();
            assertEquals(
                    "ORGANIZATION-CP07", organization.get(10, TimeUnit.SECONDS).code());
            assertEquals("WORKSPACE-IAM-CP07", workspaceIam.get(10, TimeUnit.SECONDS));
            assertEquals(1L, receiptCount("organization.organization_command_receipt", key));
            assertEquals(1L, receiptCount("workspace_iam.workspace_command_receipt", key));
        } finally {
            releaseCommands.countDown();
            executor.shutdownNow();
        }
    }

    private static OrganizationNodeReadback executeOrganization(
            String key, CountDownLatch commandsEntered, CountDownLatch releaseCommands) {
        DataSource dataSource = dataSource("receipt-namespace-organization");
        OrganizationHierarchyCommandReceiptService receipts =
                new OrganizationHierarchyCommandReceiptService(new JdbcTemplate(dataSource), time());
        TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        return transaction.execute(status -> receipts.execute(WORKSPACE, key, "organization-request", () -> {
            commandsEntered.countDown();
            awaitCommandRelease(releaseCommands);
            return new OrganizationNodeReadback(
                    UUID.randomUUID(),
                    WORKSPACE,
                    "receipt-namespace",
                    null,
                    "REGION",
                    "ORGANIZATION-CP07",
                    "Organization CP07",
                    null,
                    "ENABLED",
                    1L,
                    NOW,
                    NOW,
                    List.of(),
                    Map.of(),
                    0L);
        }));
    }

    private static String executeWorkspaceIam(
            String key, CountDownLatch commandsEntered, CountDownLatch releaseCommands) {
        DataSource dataSource = dataSource("receipt-namespace-workspace-iam");
        WorkspaceIamCommandReceiptService receipts =
                new WorkspaceIamCommandReceiptService(new JdbcTemplate(dataSource), time());
        TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        return transaction.execute(
                status -> receipts.execute(WORKSPACE, key, "workspace-iam-request", String.class, () -> {
                    commandsEntered.countDown();
                    awaitCommandRelease(releaseCommands);
                    return "WORKSPACE-IAM-CP07";
                }));
    }

    private static void awaitCommandRelease(CountDownLatch releaseCommands) {
        try {
            if (!releaseCommands.await(10, TimeUnit.SECONDS)) throw new AssertionError("command release timed out");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError(interrupted);
        }
    }

    private static long receiptCount(String table, String key) {
        Long count =
                monitor.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE idempotency_key=?", Long.class, key);
        return count == null ? 0L : count;
    }

    private static TimeProvider time() {
        return () -> NOW;
    }

    private static DataSource dataSource(String applicationName) {
        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Properties properties = new Properties();
        properties.setProperty("ApplicationName", applicationName);
        dataSource.setConnectionProperties(properties);
        return dataSource;
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
