package com.catering.v2s.app.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationCommandApi.AuthorizationCallbackCommand;
import com.catering.v2s.collaboration.api.CollaborationCommandApi.RevocationCallbackCommand;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.collaboration.application.CheckedInCollaborationCatalogSource;
import com.catering.v2s.collaboration.application.CollaborationCommandReceiptService;
import com.catering.v2s.collaboration.application.CollaborationOwnerService;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
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

/** Real PostgreSQL proof for collaboration callback replay, conflict, CAS, audit and authoritative readback. */
@Testcontainers
class CollaborationOwnerCallbackIntegrationTest {
    private static final long NOW = 1_790_000_000_000L;
    private static final String EXTERNAL_SYSTEM = "MEITUAN";
    private static final String PROVIDER = "MEITUAN_ISV_A";
    private static final String STORE_OWNED_PROVIDER = "STORE_OWNED_MINI_PROGRAM_DINE_IN";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static TransactionTemplate transactions;
    private static CollaborationOwnerService service;
    private static String workspaceKey;
    private static UUID workspaceUuid;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas("public")
                .defaultSchema("public")
                .locations("classpath:db/migration")
                .cleanDisabled(false)
                .load()
                .migrate();

        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        TimeProvider time = () -> NOW;
        service = new CollaborationOwnerService(
                new CollaborationOwnerPersistence(jdbc, time),
                new CheckedInCollaborationCatalogSource(MAPPER),
                (PlatformGovernanceAuthorization) actor -> {},
                new CollaborationCommandReceiptService(jdbc, time));

        workspaceUuid = UUID.randomUUID();
        workspaceKey = "collaboration-callback-" + workspaceUuid.toString().substring(0, 8);
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace "
                        + "(group_workspace_key, name, status, revision, workspace_uuid, name_normalized, "
                        + "operations_title, created_at_epoch_millis, updated_at_epoch_millis, "
                        + "status_changed_at_epoch_millis) VALUES (?, ?, 'ENABLED', 1, ?, ?, ?, ?, ?, ?)",
                workspaceKey,
                "Collaboration callback test",
                workspaceUuid,
                "collaboration callback test",
                "Collaboration callback test",
                NOW,
                NOW,
                NOW);
    }

    @AfterAll
    static void cleanup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .cleanDisabled(false)
                .load()
                .clean();
    }

    @Test
    void authorizationCallbackCommitsReadbackOnceAndRejectsReplayConflictAndOwnerMismatch() {
        UUID bindingRef = insertBinding(
                PROVIDER,
                EXTERNAL_SYSTEM,
                "TAKEAWAY",
                "PROJECT",
                UUID.randomUUID(),
                "PENDING_AUTHORIZATION",
                null,
                null,
                null);
        AuthorizationCallbackCommand command = new AuthorizationCallbackCommand(
                bindingRef,
                "mall-owner-001",
                "authorization-ref-001",
                "adapter-meituan",
                "authorization-callback-key-0001");

        CollaborationReadback.OwnerBinding first = inTransaction(() -> service.applyAuthorizationCallback(command));
        Map<String, Object> committed = readBinding(bindingRef);
        assertEquals("EFFECTIVE", committed.get("status"));
        assertEquals("mall-owner-001", committed.get("external_owner_id"));
        assertEquals("authorization-ref-001", committed.get("authorization_ref"));
        assertEquals(2L, committed.get("version"));
        assertEquals(1L, countAudit(bindingRef, "AUTHORIZATION_APPLIED"));
        assertEquals(1L, countReceipt(command.idempotencyKey()));

        CollaborationReadback.OwnerBinding replay = inTransaction(() -> service.applyAuthorizationCallback(command));
        assertEquals(first, replay, "idempotent replay must return the stored authoritative response");
        assertEquals(committed, readBinding(bindingRef));
        assertEquals(1L, countAudit(bindingRef, "AUTHORIZATION_APPLIED"));
        assertEquals(1L, countReceipt(command.idempotencyKey()));

        AuthorizationCallbackCommand conflict = new AuthorizationCallbackCommand(
                bindingRef, "mall-owner-002", "authorization-ref-002", "adapter-meituan", command.idempotencyKey());
        CollaborationCommandApi.Problem conflictFailure = assertThrows(
                CollaborationCommandApi.Problem.class,
                () -> inTransaction(() -> service.applyAuthorizationCallback(conflict)));
        assertEquals("IDEMPOTENCY_CONFLICT", conflictFailure.code());
        assertEquals(committed, readBinding(bindingRef));
        assertEquals(1L, countAudit(bindingRef, "AUTHORIZATION_APPLIED"));
        assertEquals(1L, countReceipt(command.idempotencyKey()));

        AuthorizationCallbackCommand mismatch = new AuthorizationCallbackCommand(
                bindingRef,
                "mall-owner-002",
                "authorization-ref-003",
                "adapter-meituan",
                "authorization-mismatch-key-0001");
        CollaborationCommandApi.Problem mismatchFailure = assertThrows(
                CollaborationCommandApi.Problem.class,
                () -> inTransaction(() -> service.applyAuthorizationCallback(mismatch)));
        assertEquals("EXTERNAL_OWNER_ID_MISMATCH", mismatchFailure.code());
        assertEquals(committed, readBinding(bindingRef));
        assertEquals(0L, countReceipt(mismatch.idempotencyKey()), "owner mismatch is rejected before receipt commit");
        assertEquals(1L, countAudit(bindingRef, "AUTHORIZATION_APPLIED"));
    }

    @Test
    void revocationCallbackCommitsOnceAndRejectsInvalidProviderWithoutPartialWrite() {
        UUID bindingRef = insertBinding(
                PROVIDER,
                EXTERNAL_SYSTEM,
                "TAKEAWAY",
                "PROJECT",
                UUID.randomUUID(),
                "EFFECTIVE",
                "mall-owner-003",
                "authorization-ref-003",
                null);
        RevocationCallbackCommand command =
                new RevocationCallbackCommand(bindingRef, "adapter-meituan", "revocation-callback-key-0001");

        CollaborationReadback.OwnerBinding first = inTransaction(() -> service.applyRevocationCallback(command));
        Map<String, Object> committed = readBinding(bindingRef);
        assertEquals("INVALID", committed.get("status"));
        assertNotNull(committed.get("external_revoked_at_epoch_millis"));
        assertEquals(2L, committed.get("version"));
        assertEquals(1L, countAudit(bindingRef, "REVOCATION_APPLIED"));
        assertEquals(1L, countReceipt(command.idempotencyKey()));

        CollaborationReadback.OwnerBinding replay = inTransaction(() -> service.applyRevocationCallback(command));
        assertEquals(first, replay, "revocation replay must return the stored authoritative response");
        assertEquals(committed, readBinding(bindingRef));
        assertEquals(1L, countAudit(bindingRef, "REVOCATION_APPLIED"));
        assertEquals(1L, countReceipt(command.idempotencyKey()));

        UUID localOnlyBindingRef = insertBinding(
                STORE_OWNED_PROVIDER,
                "STORE_OWNED_MINI_PROGRAM",
                "DINE_IN",
                "STORE",
                UUID.randomUUID(),
                "EFFECTIVE",
                null,
                null,
                null);
        RevocationCallbackCommand invalidState = new RevocationCallbackCommand(
                localOnlyBindingRef, "adapter-store-owned", "revocation-invalid-key-0001");
        Map<String, Object> beforeInvalid = readBinding(localOnlyBindingRef);
        CollaborationCommandApi.Problem invalidStateFailure = assertThrows(
                CollaborationCommandApi.Problem.class,
                () -> inTransaction(() -> service.applyRevocationCallback(invalidState)));
        assertEquals("INVALID_CALLBACK_STATE", invalidStateFailure.code());
        assertEquals(beforeInvalid, readBinding(localOnlyBindingRef));
        assertEquals(0L, countReceipt(invalidState.idempotencyKey()));
        assertEquals(0L, countAudit(localOnlyBindingRef, "REVOCATION_APPLIED"));
    }

    @Test
    void mutationAndAuditTimestampsKeepTheirOriginalCallOrder() {
        UUID bindingRef = insertBinding(
                PROVIDER,
                EXTERNAL_SYSTEM,
                "TAKEAWAY",
                "PROJECT",
                UUID.randomUUID(),
                "EFFECTIVE",
                "mall-owner-004",
                "authorization-ref-004",
                null);
        AtomicLong clock = new AtomicLong(NOW + 1_000L);
        TimeProvider sequencedTime = clock::getAndIncrement;
        CollaborationOwnerService sequencedService = new CollaborationOwnerService(
                new CollaborationOwnerPersistence(jdbc, sequencedTime),
                new CheckedInCollaborationCatalogSource(MAPPER),
                (PlatformGovernanceAuthorization) actor -> {},
                new CollaborationCommandReceiptService(jdbc, sequencedTime));
        RevocationCallbackCommand command =
                new RevocationCallbackCommand(bindingRef, "adapter-meituan", "revocation-timestamp-key-0001");
        long mutationTimestamp = clock.get();

        inTransaction(() -> sequencedService.applyRevocationCallback(command));

        Map<String, Object> binding = readBinding(bindingRef);
        assertEquals(mutationTimestamp, ((Number) binding.get("external_revoked_at_epoch_millis")).longValue());
        Map<String, Object> audit = jdbc.queryForMap(
                "SELECT changes_json, occurred_at_epoch_millis FROM collaboration.audit_event "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND entity_ref=? "
                        + "AND action=?",
                workspaceUuid,
                workspaceKey,
                bindingRef.toString(),
                "REVOCATION_APPLIED");
        assertEquals(mutationTimestamp + 1L, ((Number) audit.get("occurred_at_epoch_millis")).longValue());
        assertEquals(
                mutationTimestamp + 3L,
                clock.get(),
                "revocation, audit and receipt must retain their original TimeProvider call order");
        assertEquals(
                true,
                String.valueOf(audit.get("changes_json")).contains(Long.toString(mutationTimestamp)),
                "audit change must describe the authoritative mutation timestamp");
    }

    private static UUID insertBinding(
            String providerCode,
            String externalSystemCode,
            String capabilityClass,
            String nodeType,
            UUID nodeRef,
            String status,
            String externalOwnerId,
            String authorizationRef,
            Long externalRevokedAt) {
        UUID bindingRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO collaboration.owner_binding "
                        + "(binding_ref, workspace_uuid, group_workspace_key, external_system_code, provider_code, "
                        + "capability_class, node_type, node_ref, binding_display_name, external_owner_id, "
                        + "authorization_ref, status, unbind_requested_at_epoch_millis, "
                        + "external_revoked_at_epoch_millis, deleted_at_epoch_millis, version, "
                        + "created_at_epoch_millis, status_changed_at_epoch_millis, updated_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 1, ?, ?, ?)",
                bindingRef,
                workspaceUuid,
                workspaceKey,
                externalSystemCode,
                providerCode,
                capabilityClass,
                nodeType,
                nodeRef.toString(),
                "callback binding",
                externalOwnerId,
                authorizationRef,
                status,
                externalRevokedAt,
                NOW,
                NOW,
                NOW);
        return bindingRef;
    }

    private static Map<String, Object> readBinding(UUID bindingRef) {
        return jdbc.queryForMap(
                "SELECT status, external_owner_id, authorization_ref, external_revoked_at_epoch_millis, version "
                        + "FROM collaboration.owner_binding WHERE binding_ref=?",
                bindingRef);
    }

    private static long countAudit(UUID bindingRef, String action) {
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM collaboration.audit_event "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND entity_ref=? AND action=?",
                Long.class,
                workspaceUuid,
                workspaceKey,
                bindingRef.toString(),
                action);
        return count == null ? 0L : count;
    }

    private static long countReceipt(String idempotencyKey) {
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM collaboration.command_receipt "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?",
                Long.class,
                workspaceUuid,
                workspaceKey,
                idempotencyKey);
        return count == null ? 0L : count;
    }

    private static <T> T inTransaction(Supplier<T> action) {
        T result = transactions.execute(status -> action.get());
        if (result == null) throw new IllegalStateException("transaction returned no result");
        return result;
    }
}
