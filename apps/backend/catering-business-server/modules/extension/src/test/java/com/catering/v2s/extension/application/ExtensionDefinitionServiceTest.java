package com.catering.v2s.extension.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.UUID;
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
        service = new ExtensionDefinitionService(
                jdbc, (TimeProvider) () -> now, new ExtensionCommandReceiptService(jdbc, () -> now), actor -> {});
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
    void sequentialReplayInIndependentTransactionsReturnsCommittedReceipt() {
        String key = "extension-transaction-replay-0001";
        List<ExtensionDefinitionService.DraftField> draft = List.of(new ExtensionDefinitionService.DraftField(
                null, "Transaction field", "TEXT", true, List.of(), "ENABLED", 0, null));

        var first = transactions.execute(status ->
                service.replaceDraft(workspaceId, "extension-test", "PROJECT", 0, draft, AuditActor.system(), key));
        var replay = transactions.execute(status ->
                service.replaceDraft(workspaceId, "extension-test", "PROJECT", 0, draft, AuditActor.system(), key));

        assertEquals(first, replay);
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
                        ExtensionHostTypes.PROJECT),
                catalog.stream().map(value -> value.hostType()).toList());
        var brand = service.managementDefinition(workspaceId, "extension-test", "BRAND");
        assertEquals(0, brand.version());
        assertTrue(brand.fields().isEmpty());
        assertThrows(
                ExtensionDefinitionService.DefinitionNotFoundException.class,
                () -> service.requireDefinition(workspaceId, "extension-test", "BRAND"));
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
                                "area", "Area", "NUMBER", true, List.of(), "ENABLED", 0, null),
                        new ExtensionDefinitionService.Field(
                                "hidden", "Hidden", "TEXT", false, List.of(), "DISABLED", 1, null)));
        String merged = ExtensionDefinitionService.mergeValues(
                definition, "{}", java.util.Map.of("area", "120", "hidden", "\"ignored\""));
        assertEquals(java.util.Map.of("area", "120"), ExtensionDefinitionService.readValues(merged));
        assertThrows(
                ExtensionDefinitionService.DefinitionInvalidException.class,
                () -> ExtensionDefinitionService.mergeValues(
                        definition, merged, java.util.Map.of("area", "\"wrong type\"")));
    }

    @Test
    void disabledPlatformActorIsRejectedBeforeReceiptDefinitionOrAuditMutation() {
        ExtensionDefinitionService denied = new ExtensionDefinitionService(
                jdbc,
                () -> 1_785_000_000_000L,
                new ExtensionCommandReceiptService(jdbc, () -> 1_785_000_000_000L),
                actor -> {
                    throw new IllegalStateException("platform administrator disabled");
                });

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
