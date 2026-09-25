package com.catering.v2s.extension.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
class ExtensionDefinitionServiceTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;
    private static ExtensionDefinitionService service;
    private static UUID workspaceId;
    private static JdbcTemplate jdbc;
    private static TransactionTemplate transactions;
    private static ExtensionDefinitionPersistence persistence;
    private static WorkspaceStatusLookup workspaceStatuses;

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
        DriverManagerDataSource dataSource =
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = new JdbcTemplate(dataSource);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        workspaceId = UUID.randomUUID();
        long now = 1_785_000_000_000L;
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'extension-test', "
                        + "'Extension test', 'extension test', 'Extension test', 'ENABLED', 1, 1, ?, ?, ?)",
                workspaceId,
                now,
                now,
                now);
        workspaceStatuses = (id, key) -> jdbc.queryForObject(
                "SELECT status FROM platform_workspace.group_workspace "
                        + "WHERE workspace_uuid=? AND group_workspace_key=?",
                String.class,
                id,
                key);
        persistence = new ExtensionDefinitionPersistence(jdbc, (TimeProvider) () -> now);
        service = new ExtensionDefinitionService(
                persistence, new ExtensionCommandReceiptService(jdbc, () -> now), actor -> {}, workspaceStatuses);
    }

    @Test
    void replacesCompleteDefinitionWithCasAndPreventsFieldTypeMutation() {
        var first = service.replace(
                workspaceId,
                "extension-test",
                "STORE",
                0,
                List.of(new ExtensionDefinitionService.Field(
                        "floorArea", "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null)));
        assertEquals(1, first.version());
        assertEquals("ENABLED", first.workspaceStatus());
        assertTrue(first.blockers().isEmpty());
        assertThrows(
                ExtensionDefinitionService.DefinitionVersionConflictException.class,
                () -> service.replace(workspaceId, "extension-test", "STORE", 0, List.of()));
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replace(
                        workspaceId,
                        "extension-test",
                        "STORE",
                        1,
                        List.of(new ExtensionDefinitionService.Field(
                                "floorArea", "Floor area", "TEXT", true, List.of(), "ENABLED", 0, null))));
    }

    @Test
    void rejectsUnsupportedHostAndInvalidSelectConfiguration() {
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replace(workspaceId, "extension-test", "UNKNOWN_HOST", 0, List.of()));
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replace(
                        workspaceId,
                        "extension-test",
                        "BRAND",
                        0,
                        List.of(new ExtensionDefinitionService.Field(
                                "kind", "Kind", "SELECT", false, List.of(), "ENABLED", 0, null))));
    }

    @Test
    void ownerAssignsHiddenStableKeysForNewFieldsAndPreservesThemAcrossReplacement() {
        var first = service.replaceDraft(
                workspaceId,
                "extension-test",
                "CONTRACT",
                0,
                List.of(new ExtensionDefinitionService.DraftField(
                        null, "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null)),
                com.catering.v2s.audit.contract.AuditActor.system(),
                "extension-draft-key-0001");
        String ownerKey = first.fields().getFirst().fieldKey();
        assertEquals("field_1", ownerKey);
        var replay = service.replaceDraft(
                workspaceId,
                "extension-test",
                "CONTRACT",
                0,
                List.of(new ExtensionDefinitionService.DraftField(
                        null, "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null)),
                com.catering.v2s.audit.contract.AuditActor.system(),
                "extension-draft-key-0001");
        assertEquals(first, replay);
        assertThrows(
                ExtensionCommandReceiptService.ExtensionIdempotencyConflictException.class,
                () -> service.replaceDraft(
                        workspaceId,
                        "extension-test",
                        "CONTRACT",
                        0,
                        List.of(new ExtensionDefinitionService.DraftField(
                                "floorArea", "Different request", "NUMBER", true, List.of(), "ENABLED", 0, null)),
                        AuditActor.system(),
                        "extension-draft-key-0001"));
        var second = service.replaceDraft(
                workspaceId,
                "extension-test",
                "CONTRACT",
                first.version(),
                List.of(
                        new ExtensionDefinitionService.DraftField(
                                ownerKey, "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null),
                        new ExtensionDefinitionService.DraftField(
                                null, "Seat count", "NUMBER", false, List.of(), "ENABLED", 1, null)),
                com.catering.v2s.audit.contract.AuditActor.system(),
                "extension-draft-key-0002");
        assertEquals(ownerKey, second.fields().getFirst().fieldKey());
        assertEquals("field_2", second.fields().get(1).fieldKey());
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replaceDraft(
                        workspaceId,
                        "extension-test",
                        "CONTRACT",
                        second.version(),
                        List.of(
                                new ExtensionDefinitionService.DraftField(
                                        "duplicate", "Floor area", "NUMBER", true, List.of(), "ENABLED", 0, null),
                                new ExtensionDefinitionService.DraftField(
                                        "duplicate", "Seat count", "NUMBER", false, List.of(), "ENABLED", 1, null)),
                        com.catering.v2s.audit.contract.AuditActor.system(),
                        "extension-draft-key-0003"));
    }

    @Test
    void doesNotReuseGeneratedKeyAfterItsFieldIsDeleted() {
        String groupWorkspaceKey =
                "extension-history-" + UUID.randomUUID().toString().replace("-", "");
        UUID isolatedWorkspace = createWorkspace(groupWorkspaceKey);
        var first = service.replaceDraft(
                isolatedWorkspace,
                groupWorkspaceKey,
                ExtensionHostTypes.BRAND,
                0,
                List.of(new ExtensionDefinitionService.DraftField(
                        null, "Historical field", "TEXT", true, List.of(), "ENABLED", 0, null)),
                AuditActor.system(),
                "extension-history-key-0001");
        assertEquals("field_1", first.fields().getFirst().fieldKey());

        var removed = service.replaceDraft(
                isolatedWorkspace,
                groupWorkspaceKey,
                ExtensionHostTypes.BRAND,
                first.version(),
                List.of(),
                AuditActor.system(),
                "extension-history-key-0002");
        assertTrue(removed.fields().isEmpty());

        var replacement = service.replaceDraft(
                isolatedWorkspace,
                groupWorkspaceKey,
                ExtensionHostTypes.BRAND,
                removed.version(),
                List.of(new ExtensionDefinitionService.DraftField(
                        null, "Replacement field", "TEXT", true, List.of(), "ENABLED", 0, null)),
                AuditActor.system(),
                "extension-history-key-0003");
        assertEquals("field_2", replacement.fields().getFirst().fieldKey());
    }

    @Test
    void sequentialReplayInIndependentTransactionsReturnsCommittedReceipt() {
        String key = "extension-transaction-replay-0001";
        List<ExtensionDefinitionService.DraftField> draft = List.of(new ExtensionDefinitionService.DraftField(
                null, "Transaction field", "TEXT", null, null, true, List.of(), "ENABLED", 0, null));

        var first = transactions.execute(status ->
                service.replaceDraft(workspaceId, "extension-test", "PROJECT", 0, draft, AuditActor.system(), key));
        var replay = transactions.execute(status ->
                service.replaceDraft(workspaceId, "extension-test", "PROJECT", 0, draft, AuditActor.system(), key));

        assertEquals(first, replay);
    }

    @Test
    void concurrentInitialWritesHaveOneWinnerAndStaleUpdatesAffectNoRows() throws Exception {
        String groupWorkspaceKey =
                "extension-cas-" + UUID.randomUUID().toString().replace("-", "");
        UUID isolatedWorkspace = createWorkspace(groupWorkspaceKey);
        long now = 1_785_000_000_000L;
        CountDownLatch preStateReaders = new CountDownLatch(2);
        CountDownLatch releaseWriters = new CountDownLatch(1);
        ExtensionDefinitionPersistence racingPersistence = new ExtensionDefinitionPersistence(jdbc, () -> now) {
            @Override
            public ExtensionDefinitionPersistence.PreStateRow findPreState(
                    UUID workspaceUuid, String key, String hostType) {
                ExtensionDefinitionPersistence.PreStateRow row = super.findPreState(workspaceUuid, key, hostType);
                if (isolatedWorkspace.equals(workspaceUuid)
                        && groupWorkspaceKey.equals(key)
                        && ExtensionHostTypes.STORE.equals(hostType)) {
                    preStateReaders.countDown();
                    try {
                        if (!releaseWriters.await(10, TimeUnit.SECONDS))
                            throw new AssertionError("concurrent CAS writers were not released");
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new AssertionError(interrupted);
                    }
                }
                return row;
            }
        };
        ExtensionDefinitionService racingService = new ExtensionDefinitionService(
                racingPersistence, new ExtensionCommandReceiptService(jdbc, () -> now), actor -> {}, workspaceStatuses);
        List<ExtensionDefinitionService.Field> fields = List.of(new ExtensionDefinitionService.Field(
                "capacity", "Capacity", "NUMBER", false, List.of(), "ENABLED", 0, null));
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ExtensionDefinitionReadback> first = executor.submit(() ->
                    racingService.replace(isolatedWorkspace, groupWorkspaceKey, ExtensionHostTypes.STORE, 0, fields));
            Future<ExtensionDefinitionReadback> second = executor.submit(() ->
                    racingService.replace(isolatedWorkspace, groupWorkspaceKey, ExtensionHostTypes.STORE, 0, fields));
            assertTrue(preStateReaders.await(10, TimeUnit.SECONDS));
            releaseWriters.countDown();
            int winners = 0;
            int conflicts = 0;
            for (Future<ExtensionDefinitionReadback> attempt : List.of(first, second)) {
                try {
                    assertEquals(1, attempt.get(10, TimeUnit.SECONDS).version());
                    winners++;
                } catch (java.util.concurrent.ExecutionException failure) {
                    assertTrue(
                            failure.getCause()
                                    instanceof ExtensionDefinitionService.DefinitionVersionConflictException);
                    conflicts++;
                }
            }
            assertEquals(1, winners);
            assertEquals(1, conflicts);
        } finally {
            releaseWriters.countDown();
            executor.shutdownNow();
        }

        var committed = persistence.findDefinition(isolatedWorkspace, groupWorkspaceKey, ExtensionHostTypes.STORE);
        assertEquals(1, committed.revision());
        assertTrue(committed.definitionsJson().contains("capacity"));
        assertEquals(
                0,
                persistence.updateDefinition(
                        isolatedWorkspace, groupWorkspaceKey, ExtensionHostTypes.STORE, "[]", 2, 0));
        var afterStaleUpdate =
                persistence.findDefinition(isolatedWorkspace, groupWorkspaceKey, ExtensionHostTypes.STORE);
        assertEquals(1, afterStaleUpdate.revision());
        assertTrue(afterStaleUpdate.definitionsJson().contains("capacity"));
        assertThrows(
                ExtensionDefinitionService.DefinitionVersionConflictException.class,
                () -> service.replace(isolatedWorkspace, groupWorkspaceKey, ExtensionHostTypes.STORE, 0, List.of()));
    }

    private static UUID createWorkspace(String groupWorkspaceKey) {
        UUID id = UUID.randomUUID();
        long now = 1_785_000_000_000L;
        String name = "Extension " + groupWorkspaceKey;
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, ?, ?, ?, ?, 'ENABLED', "
                        + "1, 1, ?, ?, ?)",
                id,
                groupWorkspaceKey,
                name,
                name.toLowerCase(java.util.Locale.ROOT),
                name,
                now,
                now,
                now);
        return id;
    }

    @Test
    void managementReadExposesEveryBusinessObjectBeforeFirstConfigurationWithoutWeakeningOperationsLookup() {
        var catalog = service.listManagementDefinitions(workspaceId, "extension-test");
        assertEquals(
                List.of(
                        ExtensionHostTypes.BRAND,
                        ExtensionHostTypes.TENANT,
                        ExtensionHostTypes.HEAD_COMPANY,
                        ExtensionHostTypes.STORE,
                        ExtensionHostTypes.CONTRACT,
                        ExtensionHostTypes.COMMERCIAL_GROUP,
                        ExtensionHostTypes.REGION,
                        ExtensionHostTypes.PROJECT,
                        ExtensionHostTypes.SERVICE_POINT),
                catalog.stream().map(value -> value.hostType()).toList());
        var brand = service.managementDefinition(workspaceId, "extension-test", "BRAND");
        assertEquals(0, brand.version());
        assertTrue(brand.fields().isEmpty());
        assertThrows(
                ExtensionDefinitionService.DefinitionNotFoundException.class,
                () -> service.requireDefinition(workspaceId, "extension-test", "BRAND"));
    }

    @Test
    void readbackNormalizesMissingDisplayFlagsByHostApplicability() {
        String legacyDefinition = "[{\"key\":\"legacy\",\"label\":\"Legacy\",\"type\":\"TEXT\","
                + "\"required\":false,\"options\":[],\"status\":\"ENABLED\",\"displayOrder\":0}]";
        persistence.insertDefinition(workspaceId, "extension-test", ExtensionHostTypes.BRAND, legacyDefinition);
        persistence.insertDefinition(workspaceId, "extension-test", ExtensionHostTypes.REGION, legacyDefinition);

        var flat = service.managementDefinition(workspaceId, "extension-test", ExtensionHostTypes.BRAND);
        var tree = service.managementDefinition(workspaceId, "extension-test", ExtensionHostTypes.REGION);

        assertEquals(Boolean.FALSE, flat.fields().getFirst().listDisplay());
        assertEquals(Boolean.FALSE, flat.fields().getFirst().searchable());
        assertNull(tree.fields().getFirst().listDisplay());
        assertNull(tree.fields().getFirst().searchable());
    }

    @Test
    void rejectsDisplayFlagsForTreeHosts() {
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replace(
                        workspaceId,
                        "extension-test",
                        ExtensionHostTypes.REGION,
                        0,
                        List.of(new ExtensionDefinitionService.Field(
                                "regionLabel",
                                "Region label",
                                "TEXT",
                                Boolean.FALSE,
                                null,
                                false,
                                List.of(),
                                "ENABLED",
                                0,
                                null))));
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replace(
                        workspaceId,
                        "extension-test",
                        ExtensionHostTypes.REGION,
                        0,
                        List.of(new ExtensionDefinitionService.Field(
                                "regionLabel",
                                "Region label",
                                "TEXT",
                                null,
                                Boolean.FALSE,
                                false,
                                List.of(),
                                "ENABLED",
                                0,
                                null))));
    }

    @Test
    void workspaceStatusIsReturnedAsIndependentDimensionAndDoesNotBlockDefinitionGovernance() {
        UUID disabledWorkspace = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO platform_workspace.group_workspace (workspace_uuid, group_workspace_key, name, "
                        + "name_normalized, operations_title, status, revision, version, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, status_changed_at_epoch_millis) VALUES (?, 'extension-disabled', "
                        + "'Extension disabled', 'extension disabled', 'Extension disabled', 'ENABLED', 1, 1, ?, ?, ?)",
                disabledWorkspace,
                1_785_000_000_000L,
                1_785_000_000_000L,
                1_785_000_000_000L);
        var created = service.replace(
                disabledWorkspace,
                "extension-disabled",
                "STORE",
                0,
                List.of(new ExtensionDefinitionService.Field(
                        "capacity", "Capacity", "NUMBER", false, List.of(), "ENABLED", 0, null)));
        jdbc.update(
                "UPDATE platform_workspace.group_workspace SET status='DISABLED' WHERE workspace_uuid=?",
                disabledWorkspace);

        var disabled = service.managementDefinition(disabledWorkspace, "extension-disabled", "STORE");
        assertEquals("DISABLED", disabled.workspaceStatus());
        assertEquals(List.of(new ExtensionDefinitionReadback.Blocker("WORKSPACE", "DISABLED")), disabled.blockers());
        assertEquals(created.fields(), disabled.fields());

        var edited = service.replace(
                disabledWorkspace,
                "extension-disabled",
                "STORE",
                disabled.version(),
                List.of(new ExtensionDefinitionService.Field(
                        "capacity", "Capacity updated", "NUMBER", false, List.of(), "DISABLED", 0, null)));
        assertEquals("DISABLED", edited.workspaceStatus());
        assertEquals("DISABLED", edited.fields().getFirst().status());
    }

    @Test
    void missingOrNullFieldStatusIsRejectedInsteadOfDefaultingToEnabled() {
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> service.replace(
                        workspaceId,
                        "extension-test",
                        "REGION",
                        0,
                        List.of(new ExtensionDefinitionService.Field(
                                "missingStatus",
                                "Missing status",
                                "TEXT",
                                null,
                                null,
                                false,
                                List.of(),
                                null,
                                0,
                                null))));
    }

    @Test
    void platformTaskReadBoundariesPreserveManagementSemantics() {
        assertEquals(
                8,
                service.platformManagementDefinitions(workspaceId, "extension-test")
                        .size());
        assertEquals(
                "BRAND",
                service.platformManagementDefinition(workspaceId, "extension-test", "BRAND")
                        .hostType());
    }

    @Test
    void sharedOwnerValueMergeKeepsTypedRequiredAndDisabledSemantics() {
        var definition = service.replace(
                workspaceId,
                "extension-test",
                "REGION",
                0,
                List.of(
                        new ExtensionDefinitionService.Field(
                                "area", "Area", "NUMBER", null, null, true, List.of(), "ENABLED", 0, null),
                        new ExtensionDefinitionService.Field(
                                "hidden", "Hidden", "TEXT", null, null, false, List.of(), "DISABLED", 1, null)));
        String merged = ExtensionDefinitionService.mergeValues(
                definition, "{}", java.util.Map.of("area", "120", "hidden", "\"ignored\""));
        assertEquals(java.util.Map.of("area", "120"), ExtensionDefinitionService.readValues(merged));
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> ExtensionDefinitionService.mergeValues(
                        definition, merged, java.util.Map.of("area", "\"wrong type\"")));
    }

    @Test
    void downstreamValueMergeRejectsDisabledWorkspaceEvenWhenFieldIsEnabled() {
        ExtensionDefinitionReadback definition = new ExtensionDefinitionReadback(
                "extension-disabled-consumer",
                "STORE",
                1,
                1,
                List.of(new ExtensionDefinitionReadback.Field(
                        "capacity", "Capacity", "NUMBER", false, List.of(), "ENABLED", 0, null)),
                "DISABLED",
                List.of(new ExtensionDefinitionReadback.Blocker("WORKSPACE", "DISABLED")));

        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> ExtensionDefinitionService.mergeValues(definition, "{}", java.util.Map.of("capacity", "1")));
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> ExtensionDefinitionService.mergeValues(
                        definition,
                        "{}",
                        new ExtensionSubmission(List.of(new ExtensionSubmission.ExtensionFieldValue(
                                "capacity", "1", ExtensionSubmission.Mode.SET)))));
        assertEquals(
                java.util.Map.of("capacity", "2"),
                ExtensionDefinitionService.readValues(
                        ExtensionDefinitionService.mergeValues(definition, "{\"capacity\":2}", Map.of())));
    }

    @Test
    void disabledPlatformActorIsRejectedBeforeReceiptDefinitionOrAuditMutation() {
        ExtensionDefinitionService denied = new ExtensionDefinitionService(
                new ExtensionDefinitionPersistence(jdbc, () -> 1_785_000_000_000L),
                new ExtensionCommandReceiptService(jdbc, () -> 1_785_000_000_000L),
                actor -> {
                    throw new IllegalStateException("platform administrator disabled");
                },
                (WorkspaceStatusLookup) (id, key) -> jdbc.queryForObject(
                        "SELECT status FROM platform_workspace.group_workspace "
                                + "WHERE workspace_uuid=? AND group_workspace_key=?",
                        String.class,
                        id,
                        key));

        assertThrows(
                IllegalStateException.class,
                () -> denied.replaceDraft(
                        workspaceId,
                        "extension-test",
                        "TENANT",
                        0,
                        List.of(),
                        AuditActor.system(),
                        "extension-denied-key-0001"));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM extension.extension_command_receipt WHERE workspace_uuid=? AND "
                                + "entity_type='TENANT'",
                        Integer.class,
                        workspaceId));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM extension.extension_definition WHERE workspace_uuid=? AND "
                                + "entity_type='TENANT'",
                        Integer.class,
                        workspaceId));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM extension.audit_event WHERE workspace_uuid=? AND "
                                + "entity_ref_text='TENANT'",
                        Integer.class,
                        workspaceId));
    }

    @Test
    void unreadableReceiptIsTypedResultUnknownInsteadOfRawIllegalState() {
        String key = "extension-corrupt-key-0001";
        List<ExtensionDefinitionService.DraftField> draft = List.of(new ExtensionDefinitionService.DraftField(
                "receiptField", "Receipt field", "TEXT", true, List.of(), "ENABLED", 0, null));
        service.replaceDraft(workspaceId, "extension-test", "HEAD_COMPANY", 0, draft, AuditActor.system(), key);
        jdbc.update(
                "UPDATE extension.extension_command_receipt SET response_json=CAST(? AS JSONB) WHERE workspace_uuid=? "
                        + "AND idempotency_key=?",
                "{\"hostType\":[]}",
                workspaceId,
                key);

        assertThrows(
                ExtensionCommandReceiptService.ExtensionReceiptCorruptException.class,
                () -> service.replaceDraft(
                        workspaceId, "extension-test", "HEAD_COMPANY", 0, draft, AuditActor.system(), key));
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
    }
}
