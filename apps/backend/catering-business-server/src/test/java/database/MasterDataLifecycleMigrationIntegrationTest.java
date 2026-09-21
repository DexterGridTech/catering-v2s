package database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real PostgreSQL proof for BASE1 CP-B1 lifecycle migration DDL, backfill, and fail-closed preconditions. */
@Testcontainers
class MasterDataLifecycleMigrationIntegrationTest {
    private static final String PRE_BASE1_VERSION = "20260825.010000.000";

    private record StatusCheck(String schema, String table, String constraint) {}

    private record StatusColumn(String schema, String table, String column) {}

    private record IndexPredicate(String schema, String index, String... fragments) {}

    private record StatusDefault(String schema, String table, String column) {}

    private static final StatusCheck[] FINAL_STATUS_CHECKS = {
        new StatusCheck("organization", "organization_node", "ck_organization_node_status"),
        new StatusCheck("organization", "brand", "ck_brand_status"),
        new StatusCheck("organization", "tenant", "ck_tenant_status"),
        new StatusCheck("organization", "head_company", "ck_head_company_status"),
        new StatusCheck("organization", "store", "ck_store_status"),
        new StatusCheck("workspace_iam", "workspace_account", "ck_workspace_account_status"),
        new StatusCheck("workspace_iam", "workspace_role", "ck_workspace_role_status"),
        new StatusCheck("business_channel", "business_channel_template", "business_channel_template_status_check"),
        new StatusCheck("business_channel", "business_channel", "business_channel_status_check"),
        new StatusCheck("catalog", "unit_definition", "unit_definition_status_check"),
        new StatusCheck("catalog", "catalog_category", "catalog_category_status_check"),
        new StatusCheck("catalog", "catalog_item", "catalog_item_status_check"),
        new StatusCheck("catalog", "catalog_sku", "catalog_sku_status_check"),
        new StatusCheck("catalog", "catalog_attribute_definition", "ck_catalog_attribute_definition_status"),
        new StatusCheck("catalog", "catalog_order_option_definition", "ck_catalog_order_option_definition_status")
    };

    private static final StatusColumn[] NEW_STATUS_COLUMNS = {
        new StatusColumn("catalog", "catalog_attribute_definition", "status"),
        new StatusColumn("catalog", "catalog_order_option_definition", "status")
    };

    private static final StatusDefault[] STATUS_DEFAULTS = {
        new StatusDefault("organization", "organization_node", "status"),
        new StatusDefault("organization", "brand", "status"),
        new StatusDefault("organization", "tenant", "status"),
        new StatusDefault("organization", "head_company", "status"),
        new StatusDefault("organization", "store", "status"),
        new StatusDefault("workspace_iam", "workspace_account", "status"),
        new StatusDefault("workspace_iam", "workspace_role", "status"),
        new StatusDefault("business_channel", "business_channel_template", "status"),
        new StatusDefault("business_channel", "business_channel", "status"),
        new StatusDefault("catalog", "unit_definition", "status"),
        new StatusDefault("catalog", "catalog_category", "status"),
        new StatusDefault("catalog", "catalog_item", "status"),
        new StatusDefault("catalog", "catalog_sku", "status"),
        new StatusDefault("catalog", "catalog_attribute_definition", "status"),
        new StatusDefault("catalog", "catalog_order_option_definition", "status"),
        new StatusDefault("catalog", "catalog_composite_component", "status")
    };

    private static final IndexPredicate[] FINAL_ACTIVE_INDEXES = {
        new IndexPredicate("organization", "ux_organization_node_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_brand_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_brand_active_name", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_tenant_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_tenant_active_credit_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_tenant_active_name", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_head_company_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_head_company_active_credit_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_head_company_active_name", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_store_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("organization", "ux_store_active_name", "status <> 'VOIDED'"),
        new IndexPredicate("workspace_iam", "ux_workspace_role_active_name", "status <> 'VOIDED'"),
        new IndexPredicate(
                "business_channel",
                "ux_business_channel_template_active_project_code",
                "template_code IS NOT NULL",
                "status <> 'VOIDED'"),
        new IndexPredicate(
                "business_channel",
                "ux_business_channel_active_group_code",
                "channel_code IS NOT NULL",
                "status <> 'VOIDED'"),
        new IndexPredicate("catalog", "ux_catalog_category_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("catalog", "ux_catalog_attribute_definition_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("catalog", "ux_catalog_order_option_definition_active_code", "status <> 'VOIDED'"),
        new IndexPredicate("catalog", "ux_catalog_unit_definition_active_code", "status <> 'VOIDED'")
    };

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeAll
    static void startContainer() {
        assertTrue(POSTGRES.isRunning());
    }

    @AfterAll
    static void cleanTemporaryDatabase() throws SQLException {
        resetDatabase();
    }

    @Test
    void migrationBackfillsLifecycleValuesAndInstallsFinalChecks() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);

        UUID workspace = insertWorkspace("base1-lifecycle");
        UUID project = UUID.randomUUID();
        UUID draftChannel = insertChannel("base1-lifecycle", workspace, project, "DRAFT", "CH-DRAFT");
        UUID effectiveChannel = insertChannel("base1-lifecycle", workspace, project, "EFFECTIVE", "CH-EFFECTIVE");
        UUID disabledChannel = insertChannel("base1-lifecycle", workspace, project, "DISABLED", "CH-DISABLED");
        UUID draftItem = insertCatalogItem("ITEM-DRAFT", "DRAFT");
        UUID archivedItem = insertCatalogItem("ITEM-ARCHIVED", "ARCHIVED");
        UUID archivedSku = insertCatalogSku(archivedItem, "SKU-ARCHIVED", "ARCHIVED", false, "digest-archived");
        insertExtensionDefinitionWithoutFieldStatus(workspace);

        migrateLatest();

        assertEquals(
                "DISABLED",
                scalarString(
                        "SELECT status FROM business_channel.business_channel WHERE channel_ref = ?", draftChannel));
        assertEquals(
                "ENABLED",
                scalarString(
                        "SELECT status FROM business_channel.business_channel WHERE channel_ref = ?",
                        effectiveChannel));
        assertEquals(
                "DISABLED",
                scalarString(
                        "SELECT status FROM business_channel.business_channel WHERE channel_ref = ?", disabledChannel));
        assertEquals("DISABLED", scalarString("SELECT status FROM catalog.catalog_item WHERE item_ref = ?", draftItem));
        assertEquals(
                "VOIDED", scalarString("SELECT status FROM catalog.catalog_item WHERE item_ref = ?", archivedItem));
        assertEquals(
                "VOIDED",
                scalarString("SELECT status FROM catalog.catalog_sku WHERE product_sku_ref = ?", archivedSku));
        assertEquals(
                "ENABLED",
                scalarString("SELECT definitions->0->>'status' FROM extension.extension_definition "
                        + "WHERE group_workspace_key = 'base1-lifecycle' AND entity_type = 'STORE'"));

        assertConstraintContains("business_channel", "business_channel", "business_channel_status_check", "VOIDED");
        assertConstraintContains("catalog", "catalog_item", "catalog_item_status_check", "VOIDED");
        assertConstraintContains("catalog", "catalog_sku", "catalog_sku_status_check", "VOIDED");
        assertTwoStateStatusCheck("catalog", "catalog_composite_component", "catalog_composite_component_status_check");
        assertNullDefault("catalog", "catalog_item", "status");
        assertIndexPredicateContains(
                "catalog", "ux_catalog_sku_default_per_item", "is_default", "status <> 'VOIDED'::text");
        assertIndexPredicateContains("catalog", "ux_catalog_sku_variant_digest_per_item", "status <> 'VOIDED'::text");
        assertIndexPredicateContains("catalog", "ux_catalog_item_active_code", "status <> 'VOIDED'::text");
        assertIndexPredicateContains("catalog", "ux_catalog_sku_active_code", "status <> 'VOIDED'::text");
        assertSkuVoidedRowsDoNotOccupyActiveDefaultOrVariantDigest(draftItem);

        for (StatusCheck statusCheck : FINAL_STATUS_CHECKS) {
            assertThreeStateStatusCheck(statusCheck.schema(), statusCheck.table(), statusCheck.constraint());
        }
        for (StatusColumn statusColumn : NEW_STATUS_COLUMNS) {
            assertStatusColumnIsVarchar16AndNotNull(statusColumn.schema(), statusColumn.table(), statusColumn.column());
        }
        for (StatusDefault statusDefault : STATUS_DEFAULTS) {
            assertStatusDefaultIsFinalOrAbsent(statusDefault.schema(), statusDefault.table(), statusDefault.column());
        }
        for (IndexPredicate indexPredicate : FINAL_ACTIVE_INDEXES) {
            assertIndexPredicateContains(indexPredicate.schema(), indexPredicate.index(), indexPredicate.fragments());
        }
    }

    @Test
    void additiveDineInExternalMigrationPreservesExistingRowsAndEnforcesThreeWayCheck() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);

        UUID workspace = insertWorkspace("dine-in-external-migration");
        UUID project = UUID.randomUUID();
        insertChannel("dine-in-external-migration", workspace, project, "DRAFT", "LEGACY-DINE-IN");

        migrateLatest();

        assertEquals(
                "POS",
                scalarString(
                        "SELECT dine_in_form FROM business_channel.business_channel_template "
                                + "WHERE workspace_uuid = ? AND project_ref = ? AND template_code = ?",
                        workspace,
                        project,
                        "TPL-LEGACY-DINE-IN"),
                "an existing internal DINE_IN template must remain valid after the additive migration");

        UUID validExternal = UUID.randomUUID();
        insertTemplate(
                validExternal,
                workspace,
                project,
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                null,
                "STORE_OWNED_MINI_PROGRAM_DINE_IN",
                "ALL_PROJECT_STORES",
                "EXTERNAL-DINE-IN-VALID");
        assertNull(
                scalarString(
                        "SELECT dine_in_form FROM business_channel.business_channel_template WHERE template_ref = ?",
                        validExternal),
                "STORE external DINE_IN must persist a null platform terminal form");

        assertRejectedTemplate(
                UUID.randomUUID(),
                workspace,
                project,
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                "POS",
                "STORE_OWNED_MINI_PROGRAM_DINE_IN",
                "ALL_PROJECT_STORES",
                "EXTERNAL-DINE-IN-FORM");
        assertRejectedTemplate(
                UUID.randomUUID(),
                workspace,
                project,
                "EXTERNAL",
                "PROJECT",
                "DINE_IN",
                null,
                "STORE_OWNED_MINI_PROGRAM_DINE_IN",
                null,
                "PROJECT-EXTERNAL-DINE-IN");
        assertRejectedTemplate(
                UUID.randomUUID(),
                workspace,
                project,
                "EXTERNAL",
                "STORE",
                "TAKEAWAY",
                "POS",
                "STORE_OWNED_MINI_PROGRAM_DINE_IN",
                "ALL_PROJECT_STORES",
                "TAKEAWAY-FORM");
        assertRejectedTemplate(
                UUID.randomUUID(),
                workspace,
                project,
                "INTERNAL",
                "PROJECT",
                "DINE_IN",
                null,
                null,
                null,
                "INTERNAL-DINE-IN-FORM");
    }

    @Test
    void componentArchivedFailsClosedInsteadOfBeingMapped() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);

        UUID item = insertCatalogItem("ITEM-COMP", "ENABLED");
        UUID sku = insertCatalogSku(item, "SKU-COMP", "ENABLED", true, "digest-comp");
        UUID group = UUID.randomUUID();
        execute(
                """
                INSERT INTO catalog.catalog_composite_group (
                    composite_group_ref, item_ref, group_code, group_name, selection_rule,
                    min_selections, max_selections, display_order
                ) VALUES (?, ?, 'G1', 'Group 1', 'OPTIONAL', 0, 1, 1)
                """,
                group,
                item);
        execute(
                """
                INSERT INTO catalog.catalog_composite_component (
                    composite_component_ref, composite_group_ref, component_item_ref, product_sku_ref,
                    quantity, unit, status, display_order
                ) VALUES (?, ?, ?, ?, 1, '份', 'ARCHIVED', 1)
                """,
                UUID.randomUUID(),
                group,
                item,
                sku);

        FlywayException failure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "BASE1_COMPONENT_ARCHIVED_PRECONDITION_FAILED");
    }

    @Test
    void extensionFieldShapeAndStatusPreconditionsFailClosed() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        UUID workspace = insertWorkspace("base1-extension-shape");
        insertExtensionDefinition(workspace, "base1-extension-shape", "[1]");
        FlywayException shapeFailure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(shapeFailure, "BASE1_EXTENSION_FIELD_SHAPE_PRECONDITION_FAILED");

        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        workspace = insertWorkspace("base1-extension-status");
        insertExtensionDefinition(
                workspace, "base1-extension-status", "[{\"fieldKey\":\"floor\",\"status\":\"UNKNOWN\"}]");
        FlywayException statusFailure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(statusFailure, "BASE1_EXTENSION_FIELD_STATUS_PRECONDITION_FAILED");
    }

    @Test
    void extensionFieldStatusBackfillPreservesArrayOrderAndNullSemantics() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        UUID workspace = insertWorkspace("base1-extension-order");
        insertExtensionDefinition(
                workspace,
                "base1-extension-order",
                "[{\"fieldKey\":\"first\",\"status\":null},{\"fieldKey\":\"second\",\"status\":\"DISABLED\"}]");

        migrateLatest();

        assertEquals(
                "first",
                scalarString("SELECT definitions->0->>'fieldKey' FROM extension.extension_definition "
                        + "WHERE group_workspace_key = 'base1-extension-order'"));
        assertEquals(
                "ENABLED",
                scalarString("SELECT definitions->0->>'status' FROM extension.extension_definition "
                        + "WHERE group_workspace_key = 'base1-extension-order'"));
        assertEquals(
                "second",
                scalarString("SELECT definitions->1->>'fieldKey' FROM extension.extension_definition "
                        + "WHERE group_workspace_key = 'base1-extension-order'"));
        assertEquals(
                "DISABLED",
                scalarString("SELECT definitions->1->>'status' FROM extension.extension_definition "
                        + "WHERE group_workspace_key = 'base1-extension-order'"));
    }

    @Test
    void nonVoidedBusinessKeyDuplicatesFailBeforeReplacingConstraints() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);

        UUID workspace = insertWorkspace("base1-duplicate");
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        execute("ALTER TABLE workspace_iam.workspace_role DROP CONSTRAINT uq_workspace_role_name");
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO workspace_iam.workspace_role (
                    id, workspace_uuid, group_workspace_key, name, service_node_type, description,
                    status, version, created_at_epoch_millis, updated_at_epoch_millis
                ) VALUES (?, ?, 'base1-duplicate', 'Duplicate role', 'STORE', NULL, 'ENABLED', 1, ?, ?)
                """,
                first,
                workspace,
                now,
                now);
        execute(
                """
                INSERT INTO workspace_iam.workspace_role (
                    id, workspace_uuid, group_workspace_key, name, service_node_type, description,
                    status, version, created_at_epoch_millis, updated_at_epoch_millis
                ) VALUES (?, ?, 'base1-duplicate', 'Duplicate role', 'STORE', NULL, 'DISABLED', 1, ?, ?)
                """,
                second,
                workspace,
                now,
                now);

        FlywayException failure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "BASE1_BUSINESS_KEY_DUPLICATE_PRECONDITION_FAILED");
        assertFlywayFailureContains(failure, "workspace_iam.workspace_role.name");
    }

    @Test
    void normalizedNameDuplicateFailsBeforeReplacingBusinessIndex() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        UUID workspace = insertWorkspace("base1-brand-name");
        execute("ALTER TABLE organization.brand DROP CONSTRAINT uq_brand_code");
        execute("DROP INDEX organization.uq_brand_normalized_name");
        insertBrand(workspace, "BRAND-1", "Same Brand");
        insertBrand(workspace, "BRAND-2", " same brand ");

        FlywayException failure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "organization.brand.name");
    }

    @Test
    void channelAndTemplateCodeDuplicatesFailBeforeReplacingNullableCodeIndexes() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        UUID workspace = insertWorkspace("base1-template-code");
        execute("DROP INDEX business_channel.uq_business_channel_template_project_code");
        execute("DROP INDEX business_channel.uq_business_channel_group_channel_code");
        UUID project = UUID.randomUUID();
        insertChannel("base1-template-code", workspace, project, "DRAFT", "DUPLICATE", "CHANNEL-1");
        insertChannel("base1-template-code", workspace, project, "DRAFT", "DUPLICATE", "CHANNEL-2");

        FlywayException failure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "business_channel.business_channel_template.template_code");

        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        workspace = insertWorkspace("base1-channel-code");
        execute("DROP INDEX business_channel.uq_business_channel_template_project_code");
        execute("DROP INDEX business_channel.uq_business_channel_group_channel_code");
        project = UUID.randomUUID();
        insertChannel("base1-channel-code", workspace, project, "DRAFT", "TEMPLATE-1", "DUPLICATE");
        insertChannel("base1-channel-code", workspace, project, "DRAFT", "TEMPLATE-2", "DUPLICATE");

        failure = assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "business_channel.business_channel.channel_code");
    }

    @Test
    void catalogActiveCodeDuplicateFailsBeforeReplacingOrdinaryUnique() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        execute("ALTER TABLE catalog.catalog_category "
                + "DROP CONSTRAINT catalog_category_data_node_ref_brand_ref_code_key");
        insertCategory("base1-node", "base1-brand", "CATEGORY-DUP", "First", "ENABLED");
        insertCategory("base1-node", "base1-brand", "CATEGORY-DUP", "Second", "DISABLED");

        FlywayException failure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "catalog.catalog_category.code");
    }

    @Test
    void d03ParentScopedOptionValueDuplicateFailsBeforeReplacingScopeUnique() throws Exception {
        resetDatabase();
        migrateTo(PRE_BASE1_VERSION);
        UUID definition = insertOrderOptionDefinitionPreBase1("base1-node", "base1-brand", "OPTION-DUP", "Option");
        execute("ALTER TABLE catalog.catalog_order_option_definition_value "
                + "DROP CONSTRAINT uq_catalog_order_option_definition_value_scope_code");
        insertOrderOptionValue(definition, "base1-node", "base1-brand", "VALUE-DUP", 1);
        insertOrderOptionValue(definition, "base1-node", "base1-brand", "VALUE-DUP", 2);

        FlywayException failure =
                assertThrows(FlywayException.class, MasterDataLifecycleMigrationIntegrationTest::migrateLatest);
        assertFlywayFailureContains(failure, "catalog.catalog_order_option_definition_value.parent_code");
    }

    @Test
    void accountIdentityUniquesRemainOrdinaryAndOptionValueCodeBecomesParentScoped() throws Exception {
        resetDatabase();
        migrateLatest();

        assertConstraintEquals(
                "workspace_iam",
                "workspace_account",
                "uq_workspace_mobile",
                "UNIQUE (workspace_uuid, group_workspace_key, mobile_normalized)");
        assertConstraintEquals(
                "workspace_iam",
                "workspace_account",
                "uq_workspace_login",
                "UNIQUE (workspace_uuid, group_workspace_key, login_name_normalized)");
        assertConstraintEquals(
                "catalog",
                "catalog_order_option_definition_value",
                "uq_catalog_order_option_definition_value_parent_code",
                "UNIQUE (order_option_definition_ref, code)");
        assertFalse(indexExists("catalog", "uq_catalog_order_option_definition_value_scope_code"));

        UUID firstDefinition = insertOrderOptionDefinition("base1-scope", "BRAND", "OPT-A", "Option A");
        UUID secondDefinition = insertOrderOptionDefinition("base1-scope", "BRAND", "OPT-B", "Option B");
        insertOrderOptionValue(firstDefinition, "base1-scope", "BRAND", "VALUE-1", 1);
        insertOrderOptionValue(secondDefinition, "base1-scope", "BRAND", "VALUE-1", 1);

        SQLException duplicate = assertThrows(
                SQLException.class,
                () -> insertOrderOptionValue(firstDefinition, "base1-scope", "BRAND", "VALUE-1", 2));
        assertEquals("23505", duplicate.getSQLState());
    }

    @Test
    void inventoryDefinitionStatusDdlRemainsByteEquivalent() throws Exception {
        resetDatabase();
        migrateLatest();

        assertConstraintEquals(
                "inventory",
                "stock_target",
                "stock_target_definition_status_check",
                "CHECK ((definition_status = ANY (ARRAY['ENABLED'::text, 'DISABLED'::text])))");
        assertConstraintEquals(
                "inventory",
                "stock_bom",
                "stock_bom_definition_status_check",
                "CHECK ((definition_status = ANY (ARRAY['ENABLED'::text, 'DISABLED'::text])))");
        assertIndexPredicate(
                "inventory", "ux_inventory_stock_target_active_identity", "(definition_status = 'ENABLED'::text)");
        assertIndexPredicate(
                "inventory", "ux_inventory_stock_bom_active_identity", "(definition_status = 'ENABLED'::text)");
    }

    @Test
    void productionTagCutoverCreatesCatalogOwnerAndRemovesLegacySchema() throws Exception {
        resetDatabase();
        migrateLatest();

        assertEquals(
                "catalog.production_tag_definition",
                scalarString("SELECT to_regclass(?)", "catalog.production_tag_definition"));
        assertEquals(
                "catalog.production_tag_command_receipt",
                scalarString("SELECT to_regclass(?)", "catalog.production_tag_command_receipt"));
        assertNull(scalarString("SELECT to_regclass(?)", "fulfillment_production.production_tag_definition"));
        assertNull(scalarString("SELECT to_regclass(?)", "fulfillment_production.command_receipt"));
        assertTrue(indexExists("catalog", "ux_catalog_production_tag_active_code"));
        assertFalse(indexExists("fulfillment_production", "ux_production_tag_active_code"));
        assertConstraintEquals(
                "catalog",
                "production_tag_definition",
                "production_tag_definition_status_check",
                "CHECK ((status = ANY (ARRAY['ENABLED'::text, 'DISABLED'::text, 'VOIDED'::text])))");
        assertConstraintEquals(
                "catalog",
                "production_tag_command_receipt",
                "production_tag_command_receipt_scope_key",
                "UNIQUE (data_node_ref, idempotency_key)");
        assertEquals(
                0,
                scalarInt(
                        """
                        SELECT count(*)
                          FROM pg_class c
                          JOIN pg_namespace n ON n.oid = c.relnamespace
                         WHERE n.nspname = 'catalog'
                           AND c.relname LIKE 'production_tag%'
                           AND c.relkind IN ('r', 'i', 'p')
                           AND c.relname NOT IN (
                               'production_tag_command_receipt',
                               'production_tag_command_receipt_pkey',
                               'production_tag_command_receipt_scope_key',
                               'production_tag_definition',
                               'production_tag_definition_pkey')
                        """));
    }

    private static void migrateTo(String targetVersion) {
        flyway(targetVersion).migrate();
    }

    private static void migrateLatest() {
        flyway(null).migrate();
    }

    private static Flyway flyway(String targetVersion) {
        var configuration = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false);
        if (targetVersion != null) {
            configuration.target(targetVersion);
        }
        return configuration.load();
    }

    private static void resetDatabase() throws SQLException {
        try (Connection connection = adminConnection();
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS business_channel CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS catalog CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS collaboration CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS contract CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS extension CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS fulfillment_production CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS inventory CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS organization CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS platform_asset CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS sales_menu CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS platform_iam CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS platform_workspace CASCADE");
            statement.execute("DROP SCHEMA IF EXISTS workspace_iam CASCADE");
            statement.execute("DROP TABLE IF EXISTS public.flyway_schema_history");
        }
    }

    private static UUID insertWorkspace(String key) throws SQLException {
        UUID workspace = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO platform_workspace.group_workspace (
                    group_workspace_key, name, status, workspace_uuid, name_normalized,
                    operations_title, created_at_epoch_millis, updated_at_epoch_millis,
                    status_changed_at_epoch_millis
                ) VALUES (?, ?, 'ENABLED', ?, ?, ?, ?, ?, ?)
                """,
                key,
                "Workspace " + key,
                workspace,
                key,
                "Workspace " + key,
                now,
                now,
                now);
        return workspace;
    }

    private static void insertBrand(UUID workspace, String code, String name) throws SQLException {
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO organization.brand (
                    id, workspace_uuid, group_workspace_key, code, name, status, version,
                    created_at_epoch_millis, updated_at_epoch_millis
                ) VALUES (?, ?, 'base1-brand-name', ?, ?, 'ENABLED', 1, ?, ?)
                """,
                UUID.randomUUID(),
                workspace,
                code,
                name,
                now,
                now);
    }

    private static void insertCategory(String dataNode, String brand, String code, String name, String status)
            throws SQLException {
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO catalog.catalog_category (
                    category_ref, data_node_ref, brand_ref, code, name, parent_code, status, version,
                    created_at_epoch_millis, updated_at_epoch_millis
                ) VALUES (?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)
                """,
                UUID.randomUUID(),
                dataNode,
                brand,
                code,
                name,
                status,
                now,
                now);
    }

    private static UUID insertChannel(String groupKey, UUID workspace, UUID project, String status, String code)
            throws SQLException {
        return insertChannel(groupKey, workspace, project, status, "TPL-" + code, code);
    }

    private static UUID insertChannel(
            String groupKey, UUID workspace, UUID project, String status, String templateCode, String channelCode)
            throws SQLException {
        UUID template = UUID.randomUUID();
        UUID channel = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO business_channel.business_channel_template (
                    template_ref, workspace_uuid, group_workspace_key, project_ref, template_name,
                    access_kind, operator_kind, order_kind, dine_in_form, provider_code,
                    status, version, created_at_epoch_millis, updated_at_epoch_millis, template_code
                ) VALUES (?, ?, ?, ?, ?, 'INTERNAL', 'PROJECT', 'DINE_IN', 'POS', NULL,
                          'ENABLED', 1, ?, ?, ?)
                """,
                template,
                workspace,
                groupKey,
                project,
                "Template " + templateCode,
                now,
                now,
                templateCode);
        execute(
                """
                INSERT INTO business_channel.business_channel (
                    channel_ref, workspace_uuid, group_workspace_key, target_node_type, target_node_ref,
                    template_ref, channel_code, channel_name, binding_ref, status,
                    version, created_at_epoch_millis, updated_at_epoch_millis
                ) VALUES (?, ?, ?, 'PROJECT', ?, ?, ?, ?, NULL, ?, 1, ?, ?)
                """,
                channel,
                workspace,
                groupKey,
                project.toString(),
                template,
                channelCode,
                "Channel " + channelCode,
                status,
                now,
                now);
        return channel;
    }

    private static void insertTemplate(
            UUID template,
            UUID workspace,
            UUID project,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String storeVisibilityScope,
            String templateCode)
            throws SQLException {
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO business_channel.business_channel_template (
                    template_ref, workspace_uuid, group_workspace_key, project_ref, template_name,
                    access_kind, operator_kind, order_kind, dine_in_form, provider_code,
                    status, version, created_at_epoch_millis, updated_at_epoch_millis, template_code,
                    store_visibility_scope
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?, ?, ?)
                """,
                template,
                workspace,
                "dine-in-external-migration",
                project,
                "Template " + templateCode,
                accessKind,
                operatorKind,
                orderKind,
                dineInForm,
                providerCode,
                now,
                now,
                templateCode,
                storeVisibilityScope);
    }

    private static void assertRejectedTemplate(
            UUID template,
            UUID workspace,
            UUID project,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String storeVisibilityScope,
            String templateCode)
            throws SQLException {
        SQLException failure = assertThrows(
                SQLException.class,
                () -> insertTemplate(
                        template,
                        workspace,
                        project,
                        accessKind,
                        operatorKind,
                        orderKind,
                        dineInForm,
                        providerCode,
                        storeVisibilityScope,
                        templateCode));
        assertEquals("23514", failure.getSQLState(), "the DINE_IN form matrix must fail at the database boundary");
        assertTrue(
                throwableText(failure).contains("ck_business_channel_template_dine_in_form"),
                "the DINE_IN form check must be the rejecting database fact: " + throwableText(failure));
        assertEquals(
                0,
                scalarInt(
                        "SELECT count(*) FROM business_channel.business_channel_template " + "WHERE template_ref = ?",
                        template),
                "a rejected template insert must leave no template row behind");
    }

    private static UUID insertCatalogItem(String code, String status) throws SQLException {
        UUID item = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO catalog.catalog_item (
                    item_ref, data_node_ref, brand_ref, code, name, shape_key, status,
                    created_at_epoch_millis, updated_at_epoch_millis
                ) VALUES (?, 'base1-node', 'base1-brand', ?, ?, 'COMPOSITE', ?, ?, ?)
                """,
                item,
                code,
                "Item " + code,
                status,
                now,
                now);
        return item;
    }

    private static UUID insertCatalogSku(UUID item, String code, String status, boolean isDefault, String digest)
            throws SQLException {
        UUID sku = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO catalog.catalog_sku (
                    product_sku_ref, item_ref, sku_code, sku_name, is_default,
                    status, display_order, variant_combination_digest, updated_at_epoch_millis
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                sku,
                item,
                code,
                "Sku " + code,
                isDefault,
                status,
                digest,
                now);
        return sku;
    }

    private static void insertExtensionDefinitionWithoutFieldStatus(UUID workspace) throws SQLException {
        insertExtensionDefinition(
                workspace,
                "base1-lifecycle",
                "[{\"fieldKey\":\"floor\",\"label\":\"Floor\",\"fieldType\":\"TEXT\","
                        + "\"required\":false,\"displayOrder\":1}]");
    }

    private static void insertExtensionDefinition(UUID workspace, String groupKey, String definitions)
            throws SQLException {
        execute(
                """
                INSERT INTO extension.extension_definition (
                    workspace_uuid, group_workspace_key, entity_type, revision, updated_at_epoch_millis, definitions
                ) VALUES (
                    ?,
                    ?,
                    'STORE',
                    1,
                    ?,
                    ?::jsonb
                )
                """,
                workspace,
                groupKey,
                Instant.now().toEpochMilli(),
                definitions);
    }

    private static UUID insertOrderOptionDefinition(String dataNode, String brand, String code, String name)
            throws SQLException {
        UUID definition = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO catalog.catalog_order_option_definition (
                    order_option_definition_ref, data_node_ref, brand_ref, name, selection_mode,
                    version, created_at_epoch_millis, updated_at_epoch_millis, code, status
                ) VALUES (?, ?, ?, ?, 'SINGLE', 1, ?, ?, ?, 'ENABLED')
                """,
                definition,
                dataNode,
                brand,
                name,
                now,
                now,
                code);
        return definition;
    }

    private static UUID insertOrderOptionDefinitionPreBase1(String dataNode, String brand, String code, String name)
            throws SQLException {
        UUID definition = UUID.randomUUID();
        long now = Instant.now().toEpochMilli();
        execute(
                """
                INSERT INTO catalog.catalog_order_option_definition (
                    order_option_definition_ref, data_node_ref, brand_ref, name, selection_mode,
                    version, created_at_epoch_millis, updated_at_epoch_millis, code
                ) VALUES (?, ?, ?, ?, 'SINGLE', 1, ?, ?, ?)
                """,
                definition,
                dataNode,
                brand,
                name,
                now,
                now,
                code);
        return definition;
    }

    private static void insertOrderOptionValue(
            UUID definition, String dataNode, String brand, String code, int displayOrder) throws SQLException {
        execute(
                """
                INSERT INTO catalog.catalog_order_option_definition_value (
                    order_option_definition_value_ref, order_option_definition_ref, data_node_ref, brand_ref,
                    code, name, display_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                definition,
                dataNode,
                brand,
                code,
                "Value " + code + "-" + displayOrder,
                displayOrder);
    }

    private static void assertNullDefault(String schema, String table, String column) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(
                        """
                        SELECT column_default
                          FROM information_schema.columns
                         WHERE table_schema = ? AND table_name = ? AND column_name = ?
                        """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                assertEquals(null, result.getString(1));
            }
        }
    }

    private static void assertStatusDefaultIsFinalOrAbsent(String schema, String table, String column)
            throws SQLException {
        String defaultValue = columnDefault(schema, table, column);
        if (defaultValue == null) return;
        String normalized = normalizeSqlExpression(defaultValue).toUpperCase(java.util.Locale.ROOT);
        assertTrue(
                normalized.contains("ENABLED") || normalized.contains("DISABLED") || normalized.contains("VOIDED"),
                schema + "." + table + "." + column + " has non-lifecycle default: " + defaultValue);
        assertFalse(normalized.contains("DRAFT"), schema + "." + table + "." + column + " retains DRAFT default");
        assertFalse(normalized.contains("ARCHIVED"), schema + "." + table + "." + column + " retains ARCHIVED default");
        assertFalse(
                normalized.contains("EFFECTIVE"), schema + "." + table + "." + column + " retains EFFECTIVE default");
    }

    private static String columnDefault(String schema, String table, String column) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(
                        """
                        SELECT column_default
                          FROM information_schema.columns
                         WHERE table_schema = ? AND table_name = ? AND column_name = ?
                        """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), schema + "." + table + "." + column + " must exist");
                return result.getString(1);
            }
        }
    }

    private static void assertConstraintContains(String schema, String table, String constraint, String fragment)
            throws SQLException {
        String definition = constraintDefinition(schema, table, constraint);
        assertTrue(definition.contains(fragment), constraint + " should contain " + fragment + ": " + definition);
    }

    private static void assertThreeStateStatusCheck(String schema, String table, String constraint)
            throws SQLException {
        String definition = constraintDefinition(schema, table, constraint);
        assertTrue(definition.contains("'ENABLED'"), constraint + " must allow ENABLED: " + definition);
        assertTrue(definition.contains("'DISABLED'"), constraint + " must allow DISABLED: " + definition);
        assertTrue(definition.contains("'VOIDED'"), constraint + " must allow VOIDED: " + definition);
        assertFalse(definition.contains("'DRAFT'"), constraint + " must not allow DRAFT: " + definition);
        assertFalse(definition.contains("'ARCHIVED'"), constraint + " must not allow ARCHIVED: " + definition);
        assertFalse(definition.contains("'EFFECTIVE'"), constraint + " must not allow EFFECTIVE: " + definition);
    }

    private static void assertTwoStateStatusCheck(String schema, String table, String constraint) throws SQLException {
        String definition = constraintDefinition(schema, table, constraint);
        assertTrue(definition.contains("'ENABLED'"), constraint + " must allow ENABLED: " + definition);
        assertTrue(definition.contains("'DISABLED'"), constraint + " must allow DISABLED: " + definition);
        assertFalse(definition.contains("'VOIDED'"), constraint + " must not allow VOIDED: " + definition);
        assertFalse(definition.contains("'DRAFT'"), constraint + " must not allow DRAFT: " + definition);
        assertFalse(definition.contains("'ARCHIVED'"), constraint + " must not allow ARCHIVED: " + definition);
        assertFalse(definition.contains("'EFFECTIVE'"), constraint + " must not allow EFFECTIVE: " + definition);
    }

    private static void assertStatusColumnIsVarchar16AndNotNull(String schema, String table, String column)
            throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(
                        """
                        SELECT data_type, character_maximum_length, is_nullable
                          FROM information_schema.columns
                         WHERE table_schema = ? AND table_name = ? AND column_name = ?
                        """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), schema + "." + table + "." + column + " must exist");
                assertEquals("character varying", result.getString(1));
                assertEquals(16, result.getInt(2));
                assertEquals("NO", result.getString(3));
            }
        }
    }

    private static void assertConstraintEquals(String schema, String table, String constraint, String expected)
            throws SQLException {
        assertEquals(expected, constraintDefinition(schema, table, constraint));
    }

    private static String constraintDefinition(String schema, String table, String constraint) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(
                        """
                        SELECT pg_get_constraintdef(c.oid)
                          FROM pg_constraint c
                          JOIN pg_class t ON t.oid = c.conrelid
                          JOIN pg_namespace n ON n.oid = t.relnamespace
                         WHERE n.nspname = ? AND t.relname = ? AND c.conname = ?
                        """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, constraint);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), schema + "." + table + "." + constraint + " must exist");
                return result.getString(1);
            }
        }
    }

    private static void assertIndexPredicate(String schema, String index, String expectedPredicate)
            throws SQLException {
        assertEquals(expectedPredicate, indexPredicate(schema, index));
    }

    private static void assertIndexPredicateContains(String schema, String index, String... expectedFragments)
            throws SQLException {
        String predicate = normalizeSqlExpression(indexPredicate(schema, index));
        for (String fragment : expectedFragments) {
            String normalizedFragment = normalizeSqlExpression(fragment);
            assertTrue(predicate.contains(normalizedFragment), schema + "." + index + " predicate was " + predicate);
        }
    }

    private static String normalizeSqlExpression(String expression) {
        return expression
                .replaceAll("::[A-Za-z0-9_]+", "")
                .replace("\"", "")
                .replace("(", "")
                .replace(")", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static void assertFlywayFailureContains(Throwable failure, String expectedFragment) {
        String text = throwableText(failure);
        assertTrue(
                text.contains(expectedFragment),
                "expected Flyway failure to contain " + expectedFragment + ": " + text);
    }

    private static String throwableText(Throwable failure) {
        StringBuilder text = new StringBuilder();
        for (Throwable cursor = failure; cursor != null; cursor = cursor.getCause()) {
            if (cursor.getMessage() != null) {
                if (!text.isEmpty()) text.append('\n');
                text.append(cursor.getClass().getName()).append(": ").append(cursor.getMessage());
            }
        }
        return text.toString();
    }

    private static String indexPredicate(String schema, String index) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(
                        """
                        SELECT pg_get_expr(i.indpred, i.indrelid)
                          FROM pg_index i
                          JOIN pg_class c ON c.oid = i.indexrelid
                          JOIN pg_namespace n ON n.oid = c.relnamespace
                         WHERE n.nspname = ? AND c.relname = ?
                        """)) {
            statement.setString(1, schema);
            statement.setString(2, index);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), schema + "." + index + " must exist");
                return result.getString(1);
            }
        }
    }

    private static void assertSkuVoidedRowsDoNotOccupyActiveDefaultOrVariantDigest(UUID item) throws SQLException {
        insertCatalogSku(item, "SKU-ACTIVE-DEFAULT", "ENABLED", true, "digest-active");
        insertCatalogSku(item, "SKU-VOIDED-DEFAULT", "VOIDED", true, "digest-voided-default");
        SQLException duplicateDefault = assertThrows(
                SQLException.class,
                () -> insertCatalogSku(item, "SKU-DISABLED-DEFAULT", "DISABLED", true, "digest-disabled-default"));
        assertEquals("23505", duplicateDefault.getSQLState());

        insertCatalogSku(item, "SKU-VOIDED-DIGEST", "VOIDED", false, "digest-active");
        SQLException duplicateDigest = assertThrows(
                SQLException.class,
                () -> insertCatalogSku(item, "SKU-DISABLED-DIGEST", "DISABLED", false, "digest-active"));
        assertEquals("23505", duplicateDigest.getSQLState());
    }

    private static boolean indexExists(String schema, String index) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(
                        "SELECT 1 FROM pg_indexes WHERE schemaname = ? AND indexname = ?")) {
            statement.setString(1, schema);
            statement.setString(2, index);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static String scalarString(String sql, Object... parameters) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getString(1);
            }
        }
    }

    private static int scalarInt(String sql, Object... parameters) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getInt(1);
            }
        }
    }

    private static void execute(String sql, Object... parameters) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            statement.executeUpdate();
        }
    }

    private static void bind(PreparedStatement statement, Object... parameters) throws SQLException {
        for (int index = 0; index < parameters.length; index++) {
            statement.setObject(index + 1, parameters[index]);
        }
    }

    private static Connection adminConnection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }
}
