package database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real PostgreSQL proof for the sales-menu owner migration and immutable facts. */
@Testcontainers
class SalesMenuMigrationIntegrationTest {
    private static final long NOW = 1_785_000_000_000L;

    private static final List<String> SALES_MENU_TABLES = List.of(
            "sales_collection",
            "sales_collection_activation",
            "sales_collection_version",
            "sales_section",
            "sales_version_section",
            "sales_item",
            "sales_version_item",
            "sales_version_item_sku",
            "sales_version_item_order_option",
            "sales_version_item_order_option_value",
            "sales_version_item_media",
            "sales_publication",
            "sales_manual_status_current",
            "sales_manual_status_event",
            "sales_operation_record",
            "sales_command_receipt");

    private static final List<TriggerFact> PUBLISHED_CHILD_TRIGGERS = List.of(
            new TriggerFact("sales_version_section", "tr_sales_version_section_published_immutable"),
            new TriggerFact("sales_version_item", "tr_sales_version_item_published_immutable"),
            new TriggerFact("sales_version_item_sku", "tr_sales_version_item_sku_published_immutable"),
            new TriggerFact(
                    "sales_version_item_order_option",
                    "tr_sales_version_item_order_option_published_immutable"),
            new TriggerFact(
                    "sales_version_item_order_option_value",
                    "tr_sales_version_item_order_option_value_published_immutable"),
            new TriggerFact("sales_version_item_media", "tr_sales_version_item_media_published_immutable"));

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;

    @BeforeAll
    static void migrateFromZero() {
        flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .schemas("public")
                .defaultSchema("public")
                .locations("classpath:db/migration")
                .cleanDisabled(false)
                .load();
        var result = flyway.migrate();
        assertEquals(
                flyway.info().all().length,
                result.migrationsExecuted,
                "every migration available to the app test classpath must execute from an empty database");
    }

    @Test
    void migratesOwnerTablesIndexesForeignKeysAndTriggers() throws SQLException {
        assertEquals(
                1,
                scalarInt("SELECT count(*) FROM information_schema.schemata WHERE schema_name = ?", "sales_menu"),
                "sales_menu schema must exist after a from-zero migration");
        assertEquals(
                SALES_MENU_TABLES.size(),
                scalarInt(
                        "SELECT count(*) FROM information_schema.tables "
                                + "WHERE table_schema = ? AND table_type = 'BASE TABLE'",
                        "sales_menu"),
                "sales_menu must contain exactly the owner table set");
        for (String table : SALES_MENU_TABLES) {
            assertEquals(
                    1,
                    scalarInt(
                            "SELECT count(*) FROM information_schema.tables "
                                    + "WHERE table_schema = ? AND table_name = ? AND table_type = 'BASE TABLE'",
                            "sales_menu",
                            table),
                    "missing sales_menu owner table: " + table);
        }
        assertEquals(
                1,
                scalarInt(
                        "SELECT count(*) FROM information_schema.tables "
                                + "WHERE table_schema = ? AND table_name = ? AND table_type = 'BASE TABLE'",
                        "platform_asset",
                        "sales_menu_asset_target"),
                "platform_asset.sales_menu_asset_target must be created by the migration");

        assertConstraint(
                "sales_menu",
                "sales_collection_activation",
                "sales_collection_activation_pkey",
                "PRIMARY KEY (collection_ref, channel_ref)");
        assertConstraint(
                "sales_menu",
                "sales_collection_version",
                "fk_sales_collection_version_source_draft",
                "FOREIGN KEY (source_draft_version_ref, collection_ref)",
                "REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_section",
                "fk_sales_version_section_version",
                "FOREIGN KEY (version_ref, collection_ref)",
                "REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_section",
                "fk_sales_version_section_section",
                "FOREIGN KEY (section_ref, collection_ref)",
                "REFERENCES sales_menu.sales_section(section_ref, collection_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item",
                "fk_sales_version_item_version",
                "FOREIGN KEY (version_ref, collection_ref)",
                "REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item",
                "fk_sales_version_item_item",
                "FOREIGN KEY (sales_item_ref, collection_ref)",
                "REFERENCES sales_menu.sales_item(sales_item_ref, collection_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item",
                "fk_sales_version_item_section",
                "FOREIGN KEY (section_ref, collection_ref)",
                "REFERENCES sales_menu.sales_section(section_ref, collection_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item",
                "fk_sales_version_item_section_membership",
                "FOREIGN KEY (version_ref, section_ref)",
                "REFERENCES sales_menu.sales_version_section(version_ref, section_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item_sku",
                "fk_sales_version_item_sku_version_item",
                "FOREIGN KEY (version_ref, sales_item_ref)",
                "REFERENCES sales_menu.sales_version_item(version_ref, sales_item_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item_order_option",
                "fk_sales_version_item_order_option_version_item",
                "FOREIGN KEY (version_ref, sales_item_ref)",
                "REFERENCES sales_menu.sales_version_item(version_ref, sales_item_ref)");
        assertConstraint(
                "sales_menu",
                "sales_version_item_order_option_value",
                "fk_sales_version_item_order_option_value_group",
                "FOREIGN KEY (version_ref, sales_item_ref, definition_ref)",
                "REFERENCES sales_menu.sales_version_item_order_option(version_ref, sales_item_ref, definition_ref)");
        assertConstraint(
                "sales_menu",
                "sales_manual_status_current",
                "pk_sales_manual_status_current_target",
                "PRIMARY KEY (sales_item_ref, channel_ref, target_kind, target_ref)");
        assertConstraint(
                "sales_menu",
                "sales_manual_status_current",
                "ck_sales_manual_status_current_target_kind",
                "CHECK (",
                "TARGET_KIND",
                "'ITEM'",
                "'SKU'",
                "'ORDER_OPTION_VALUE'");
        assertConstraint(
                "sales_menu",
                "sales_manual_status_event",
                "ck_sales_manual_status_event_target_kind",
                "CHECK (",
                "TARGET_KIND",
                "'ITEM'",
                "'SKU'",
                "'ORDER_OPTION_VALUE'");
        assertConstraint(
                "sales_menu",
                "sales_version_item_media",
                "fk_sales_version_item_media_version_item",
                "FOREIGN KEY (version_ref, sales_item_ref)",
                "REFERENCES sales_menu.sales_version_item(version_ref, sales_item_ref)");
        assertConstraint(
                "sales_menu",
                "sales_publication",
                "fk_sales_publication_version",
                "FOREIGN KEY (published_version_ref, collection_ref)",
                "REFERENCES sales_menu.sales_collection_version(version_ref, collection_ref)");
        assertConstraint(
                "platform_asset",
                "sales_menu_asset_target",
                "fk_sales_menu_asset_target_asset",
                "FOREIGN KEY (asset_ref)",
                "REFERENCES platform_asset.staged_asset(asset_ref)");
        assertEquals(
                0,
                scalarInt(
                        """
                        SELECT count(*)
                          FROM pg_constraint constraint_row
                          JOIN pg_class child_table ON child_table.oid = constraint_row.conrelid
                          JOIN pg_namespace child_schema ON child_schema.oid = child_table.relnamespace
                          JOIN pg_class parent_table ON parent_table.oid = constraint_row.confrelid
                          JOIN pg_namespace parent_schema ON parent_schema.oid = parent_table.relnamespace
                         WHERE constraint_row.contype = 'f'
                           AND child_schema.nspname = 'sales_menu'
                           AND parent_schema.nspname <> 'sales_menu'
                        """),
                "sales_menu owner tables must not introduce cross-schema foreign keys");

        assertIndex(
                "sales_menu",
                "uq_sales_collection_active_name",
                true,
                "workspace_uuid, group_workspace_key, store_ref, name",
                "archived_at_epoch_millis IS NULL");
        assertIndex("sales_menu", "uq_sales_collection_current_draft", true, "collection_ref", "DRAFT");
        assertIndex("sales_menu", "uq_sales_section_ref_collection", true, "section_ref, collection_ref");
        assertIndex("sales_menu", "uq_sales_item_ref_collection", true, "sales_item_ref, collection_ref");
        assertIndex(
                "sales_menu",
                "uq_sales_version_item_order_option_order",
                true,
                "version_ref, sales_item_ref, display_order");
        assertIndex(
                "sales_menu",
                "uq_sales_version_item_order_option_value_order",
                true,
                "version_ref, sales_item_ref, definition_ref, display_order");
        assertIndex(
                "sales_menu",
                "idx_sales_manual_status_channel_target",
                false,
                "channel_ref, sales_item_ref, target_kind, target_ref");
        assertIndex(
                "sales_menu",
                "idx_sales_manual_status_event_item_target",
                false,
                "sales_item_ref, channel_ref, target_kind, target_ref");
        assertIndex(
                "sales_menu", "idx_sales_collection_activation_channel", false, "channel_ref, status, collection_ref");
        assertIndex(
                "sales_menu",
                "idx_sales_item_collection_catalog_item",
                false,
                "collection_ref, catalog_item_ref, sales_item_ref");
        assertIndex(
                "sales_menu",
                "idx_sales_operation_record_scope_time",
                false,
                "workspace_uuid, group_workspace_key, store_ref, collection_ref, channel_ref, "
                        + "occurred_at_epoch_millis DESC, record_ref DESC");
        assertIndex(
                "platform_asset",
                "idx_sales_menu_asset_target_lookup",
                false,
                "workspace_uuid, store_ref, sales_menu_ref, sales_item_ref, asset_ref");

        assertTrigger(
                "sales_menu",
                "sales_collection_version",
                "tr_sales_collection_version_published_immutable",
                "reject_published_version_mutation",
                "BEFORE DELETE OR UPDATE");
        for (TriggerFact trigger : PUBLISHED_CHILD_TRIGGERS) {
            assertTrigger(
                    "sales_menu",
                    trigger.table(),
                    trigger.name(),
                    "reject_published_version_child_mutation",
                    "BEFORE DELETE OR UPDATE");
        }
        assertTrigger(
                "sales_menu",
                "sales_publication",
                "tr_sales_publication_append_only",
                "reject_publication_mutation",
                "BEFORE DELETE OR UPDATE");
        assertTrigger(
                "sales_menu",
                "sales_item",
                "tr_sales_item_binding_immutable",
                "reject_sales_item_rebind",
                "BEFORE UPDATE OF collection_ref, catalog_item_ref");
        assertTrigger(
                "sales_menu",
                "sales_version_section",
                "tr_sales_version_section_collection_ref",
                "populate_version_child_collection_ref",
                "BEFORE INSERT OR UPDATE OF version_ref, collection_ref");
        assertTrigger(
                "sales_menu",
                "sales_version_item",
                "tr_sales_version_item_collection_ref",
                "populate_version_child_collection_ref",
                "BEFORE INSERT OR UPDATE OF version_ref, collection_ref");
    }

    @Test
    void allowsMultipleMenusOnOneChannelButRejectsDuplicateCollectionChannelPair() throws SQLException {
        UUID workspace = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID channel = UUID.randomUUID();
        UUID firstCollection = UUID.randomUUID();
        UUID secondCollection = UUID.randomUUID();
        insertCollection(firstCollection, workspace, store, "First menu");
        insertCollection(secondCollection, workspace, store, "Second menu");

        insertActivation(firstCollection, channel, "ENABLED");
        insertActivation(secondCollection, channel, "ENABLED");
        assertEquals(
                2,
                scalarInt("SELECT count(*) FROM sales_menu.sales_collection_activation WHERE channel_ref = ?", channel),
                "the same channel must be usable by two different menus");

        assertSqlFailure(
                "duplicate collection/channel activation must be rejected",
                "INSERT INTO sales_menu.sales_collection_activation "
                        + "(collection_ref, channel_ref, status, version) VALUES (?, ?, ?, ?)",
                "23505",
                "sales_collection_activation_pkey",
                firstCollection,
                channel,
                "ENABLED",
                1L);
    }

    @Test
    void rejectsCrossCollectionSourceDraftAndPublicationVersionReferences() throws SQLException {
        UUID workspace = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID firstCollection = UUID.randomUUID();
        UUID secondCollection = UUID.randomUUID();
        UUID firstDraft = UUID.randomUUID();
        UUID secondDraft = UUID.randomUUID();
        UUID secondPublishedVersion = UUID.randomUUID();
        UUID publishedVersion = UUID.randomUUID();
        insertCollection(firstCollection, workspace, store, "First collection");
        insertCollection(secondCollection, workspace, store, "Second collection");
        insertVersion(firstDraft, firstCollection, "DRAFT", 1, null, null);
        insertVersion(secondDraft, secondCollection, "DRAFT", 1, null, null);
        insertVersion(secondPublishedVersion, secondCollection, "PUBLISHED", 1, secondDraft, 1L);

        assertSqlFailure(
                "a collection must not point at another collection's current draft",
                "UPDATE sales_menu.sales_collection SET current_draft_version_ref=? WHERE collection_ref=?",
                "23503",
                "fk_sales_collection_current_draft",
                secondDraft,
                firstCollection);
        assertSqlFailure(
                "a collection must not point at another collection's latest publication",
                "UPDATE sales_menu.sales_collection SET latest_published_version_ref=? WHERE collection_ref=?",
                "23503",
                "fk_sales_collection_latest_publication",
                secondPublishedVersion,
                firstCollection);

        assertSqlFailure(
                "a published version must not use a source draft from another collection",
                "INSERT INTO sales_menu.sales_collection_version "
                        + "(version_ref, collection_ref, kind, revision, schedule_kind, "
                        + "schedule_start_local_time, schedule_end_local_time, source_draft_version_ref, "
                        + "source_draft_revision, version) VALUES (?, ?, 'PUBLISHED', ?, 'ALL_DAY', "
                        + "NULL, NULL, ?, ?, ?)",
                "23503",
                "fk_sales_collection_version_source_draft",
                publishedVersion,
                firstCollection,
                2L,
                secondDraft,
                1L,
                1L);

        insertVersion(publishedVersion, firstCollection, "PUBLISHED", 1, firstDraft, 1L);
        assertSqlFailure(
                "a publication must not pair a version with another collection",
                "INSERT INTO sales_menu.sales_publication "
                        + "(publication_ref, collection_ref, published_version_ref, source_draft_revision, "
                        + "actor_type, actor_id, actor_display_snapshot, occurred_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, 'SYSTEM', NULL, 'system', ?)",
                "23503",
                "fk_sales_publication_version",
                UUID.randomUUID(),
                secondCollection,
                publishedVersion,
                1L,
                NOW);
    }

    @Test
    void rejectsCrossCollectionVersionSectionAndItemMemberships() throws SQLException {
        UUID workspace = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID firstCollection = UUID.randomUUID();
        UUID secondCollection = UUID.randomUUID();
        UUID firstDraft = UUID.randomUUID();
        UUID secondDraft = UUID.randomUUID();
        UUID firstSection = UUID.randomUUID();
        UUID unlistedFirstCollectionSection = UUID.randomUUID();
        UUID secondSection = UUID.randomUUID();
        UUID firstSalesItem = UUID.randomUUID();
        UUID secondSalesItem = UUID.randomUUID();

        insertCollection(firstCollection, workspace, store, "First relationship collection");
        insertCollection(secondCollection, workspace, store, "Second relationship collection");
        insertVersion(firstDraft, firstCollection, "DRAFT", 1, null, null);
        insertVersion(secondDraft, secondCollection, "DRAFT", 1, null, null);
        insertSection(firstSection, firstCollection);
        insertSection(unlistedFirstCollectionSection, firstCollection);
        insertSection(secondSection, secondCollection);
        insertSalesItem(firstSalesItem, firstCollection, UUID.randomUUID());
        insertSalesItem(secondSalesItem, secondCollection, UUID.randomUUID());
        insertVersionSection(firstDraft, firstSection, "First section", 0);

        assertEquals(
                firstCollection,
                scalarUuid(
                        "SELECT collection_ref FROM sales_menu.sales_version_section "
                                + "WHERE version_ref=? AND section_ref=?",
                        firstDraft,
                        firstSection),
                "the compatibility trigger must derive the version child collection from its version");
        assertSqlFailure(
                "a version-section row must not pair a version with another collection's section",
                "INSERT INTO sales_menu.sales_version_section "
                        + "(version_ref, section_ref, name, display_order) VALUES (?, ?, ?, ?)",
                "23503",
                "fk_sales_version_section_section",
                firstDraft,
                secondSection,
                "Wrong collection section",
                1L);
        assertSqlFailure(
                "a caller must not override the version child collection",
                "INSERT INTO sales_menu.sales_version_section "
                        + "(version_ref, section_ref, collection_ref, name, display_order) "
                        + "VALUES (?, ?, ?, ?, ?)",
                "23514",
                "SALES_MENU_VERSION_COLLECTION_MISMATCH",
                firstDraft,
                firstSection,
                secondCollection,
                "Contradictory collection",
                1L);

        assertSqlFailure(
                "a version-item row must not pair a version with another collection's sales item",
                "INSERT INTO sales_menu.sales_version_item "
                        + "(version_ref, sales_item_ref, section_ref, display_order, "
                        + "ordering_constraints_json, display_media_mode, version) "
                        + "VALUES (?, ?, ?, ?, '{}'::jsonb, 'INHERIT_CATALOG', ?)",
                "23503",
                "fk_sales_version_item_item",
                firstDraft,
                secondSalesItem,
                firstSection,
                0L,
                1L);
        assertSqlFailure(
                "a version-item row must not pair a version with another collection's section",
                "INSERT INTO sales_menu.sales_version_item "
                        + "(version_ref, sales_item_ref, section_ref, display_order, "
                        + "ordering_constraints_json, display_media_mode, version) "
                        + "VALUES (?, ?, ?, ?, '{}'::jsonb, 'INHERIT_CATALOG', ?)",
                "23503",
                "fk_sales_version_item_section",
                firstDraft,
                firstSalesItem,
                secondSection,
                0L,
                1L);
        assertSqlFailure(
                "a version-item row must reference a section included in the same version",
                "INSERT INTO sales_menu.sales_version_item "
                        + "(version_ref, sales_item_ref, section_ref, display_order, "
                        + "ordering_constraints_json, display_media_mode, version) "
                        + "VALUES (?, ?, ?, ?, '{}'::jsonb, 'INHERIT_CATALOG', ?)",
                "23503",
                "fk_sales_version_item_section_membership",
                firstDraft,
                firstSalesItem,
                unlistedFirstCollectionSection,
                0L,
                1L);

        insertVersionItem(firstDraft, firstSalesItem, firstSection);
        assertEquals(
                firstCollection,
                scalarUuid(
                        "SELECT collection_ref FROM sales_menu.sales_version_item "
                                + "WHERE version_ref=? AND sales_item_ref=?",
                        firstDraft,
                        firstSalesItem),
                "the version-item compatibility trigger must derive the version child collection from its version");
        assertSqlFailure(
                "a SKU row must belong to the same version-item membership",
                "INSERT INTO sales_menu.sales_version_item_sku "
                        + "(version_ref, sales_item_ref, sku_ref, listed_price_cents, "
                        + "resolved_sku_code, resolved_sku_name, default_price_cents, display_order) "
                        + "VALUES (?, ?, ?, 100, 'WRONG', 'Wrong item', 100, 0)",
                "23503",
                "fk_sales_version_item_sku_version_item",
                firstDraft,
                secondSalesItem,
                UUID.randomUUID());
        assertSqlFailure(
                "a media row must belong to the same version-item membership",
                "INSERT INTO sales_menu.sales_version_item_media "
                        + "(version_ref, sales_item_ref, asset_ref, display_order) VALUES (?, ?, ?, 0)",
                "23503",
                "fk_sales_version_item_media_version_item",
                firstDraft,
                secondSalesItem,
                UUID.randomUUID());
    }

    @Test
    void allowsTwoStableSalesItemsForOneCatalogItemInOneCollection() throws SQLException {
        UUID workspace = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID collection = UUID.randomUUID();
        UUID catalogItem = UUID.randomUUID();
        UUID firstSalesItem = UUID.randomUUID();
        UUID secondSalesItem = UUID.randomUUID();
        insertCollection(collection, workspace, store, "Duplicate catalog item menu");

        insertSalesItem(firstSalesItem, collection, catalogItem);
        insertSalesItem(secondSalesItem, collection, catalogItem);

        assertEquals(
                2,
                scalarInt(
                        "SELECT count(*) FROM sales_menu.sales_item "
                                + "WHERE collection_ref = ? AND catalog_item_ref = ?",
                        collection,
                        catalogItem),
                "one collection may contain two independently identified sales items for one catalog item");
        assertFalse(
                hasUniqueIndexOnCollectionAndCatalogItem(),
                "sales_item must not retain a unique collection_ref/catalog_item_ref index");
    }

    @Test
    void keepsManualStatusFactsIndependentByTargetAndRejectsInvalidTargetIdentity() throws SQLException {
        UUID collection = UUID.randomUUID();
        UUID salesItem = UUID.randomUUID();
        UUID channel = UUID.randomUUID();
        UUID sku = UUID.randomUUID();
        UUID optionValue = UUID.randomUUID();
        insertCollection(collection, UUID.randomUUID(), UUID.randomUUID(), "Target identity menu");
        insertSalesItem(salesItem, collection, UUID.randomUUID());

        String insertCurrent =
                "INSERT INTO sales_menu.sales_manual_status_current "
                        + "(sales_item_ref, channel_ref, target_kind, target_ref, state, reason, "
                        + "changed_at_epoch_millis, actor_type, actor_id, actor_display_snapshot, version) "
                        + "VALUES (?, ?, ?, ?, 'MANUAL_SOLD_OUT', 'temporary', ?, 'SYSTEM', NULL, 'system', 1)";
        execute(insertCurrent, salesItem, channel, "ITEM", salesItem, NOW);
        execute(insertCurrent, salesItem, channel, "SKU", sku, NOW);
        execute(insertCurrent, salesItem, channel, "ORDER_OPTION_VALUE", optionValue, NOW);
        assertEquals(
                3,
                scalarInt(
                        "SELECT count(*) FROM sales_menu.sales_manual_status_current "
                                + "WHERE sales_item_ref = ? AND channel_ref = ?",
                        salesItem,
                        channel),
                "ITEM, SKU and ORDER_OPTION_VALUE status facts must have independent current identities");

        assertSqlFailure(
                "a duplicate manual target must be rejected by the target primary key",
                insertCurrent,
                "23505",
                "pk_sales_manual_status_current_target",
                salesItem,
                channel,
                "SKU",
                sku,
                NOW);
        assertSqlFailure(
                "an unknown manual target kind must be rejected",
                insertCurrent,
                "23514",
                "ck_sales_manual_status_current_target_kind",
                salesItem,
                channel,
                "UNKNOWN",
                UUID.randomUUID(),
                NOW);
        assertSqlFailure(
                "an ITEM target must use its sales item reference",
                insertCurrent,
                "23514",
                "ck_sales_manual_status_current_item_target",
                salesItem,
                channel,
                "ITEM",
                UUID.randomUUID(),
                NOW);

        String insertEvent =
                "INSERT INTO sales_menu.sales_manual_status_event "
                        + "(event_ref, sales_item_ref, channel_ref, target_kind, target_ref, event_kind, reason, "
                        + "actor_type, actor_id, actor_display_snapshot, occurred_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, 'SOLD_OUT', 'temporary', 'SYSTEM', NULL, 'system', ?)";
        execute(insertEvent, UUID.randomUUID(), salesItem, channel, "SKU", sku, NOW);
        assertSqlFailure(
                "an unknown event target kind must be rejected",
                insertEvent,
                "23514",
                "ck_sales_manual_status_event_target_kind",
                UUID.randomUUID(),
                salesItem,
                channel,
                "UNKNOWN",
                UUID.randomUUID(),
                NOW);
    }

    @Test
    void rejectsPublishedMutationsAndStableSalesItemRebinding() throws SQLException {
        PublishedFixture fixture = insertPublishedFixture();
        UUID otherCollection = UUID.randomUUID();
        insertCollection(otherCollection, UUID.randomUUID(), UUID.randomUUID(), "Rebind target");

        assertSqlFailure(
                "published version update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_collection_version SET revision = revision + 1 WHERE version_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_IMMUTABLE",
                fixture.publishedVersion());
        assertSqlFailure(
                "published version delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_collection_version WHERE version_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_IMMUTABLE",
                fixture.publishedVersion());

        assertSqlFailure(
                "published section update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_version_section SET name = 'Changed' "
                        + "WHERE version_ref = ? AND section_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.section());
        assertSqlFailure(
                "published section delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_version_section WHERE version_ref = ? AND section_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.section());
        assertSqlFailure(
                "published item update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_version_item SET display_name_override = 'Changed' "
                        + "WHERE version_ref = ? AND sales_item_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem());
        assertSqlFailure(
                "published item delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_version_item WHERE version_ref = ? AND sales_item_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem());
        assertSqlFailure(
                "published SKU update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_version_item_sku SET listed_price_cents = listed_price_cents + 1 "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND sku_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.sku());
        assertSqlFailure(
                "published SKU delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_version_item_sku "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND sku_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.sku());
        assertSqlFailure(
                "published option group update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_version_item_order_option SET resolved_definition_name = 'Changed' "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND definition_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.definition());
        assertSqlFailure(
                "published option group delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_version_item_order_option "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND definition_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.definition());
        assertSqlFailure(
                "published option value update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_version_item_order_option_value SET resolved_value_name = 'Changed' "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND definition_ref = ? "
                        + "AND definition_value_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.definition(),
                fixture.definitionValue());
        assertSqlFailure(
                "published option value delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_version_item_order_option_value "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND definition_ref = ? "
                        + "AND definition_value_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.definition(),
                fixture.definitionValue());
        assertSqlFailure(
                "published media update must be rejected by its database trigger",
                "UPDATE sales_menu.sales_version_item_media SET display_order = display_order + 1 "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND asset_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.asset());
        assertSqlFailure(
                "published media delete must be rejected by its database trigger",
                "DELETE FROM sales_menu.sales_version_item_media "
                        + "WHERE version_ref = ? AND sales_item_ref = ? AND asset_ref = ?",
                "55000",
                "SALES_MENU_PUBLISHED_VERSION_CHILD_IMMUTABLE",
                fixture.publishedVersion(),
                fixture.salesItem(),
                fixture.asset());

        assertSqlFailure(
                "publication update must be rejected by its append-only trigger",
                "UPDATE sales_menu.sales_publication "
                        + "SET source_draft_revision = source_draft_revision + 1 WHERE publication_ref = ?",
                "55000",
                "SALES_MENU_PUBLICATION_APPEND_ONLY",
                fixture.publication());
        assertSqlFailure(
                "publication delete must be rejected by its append-only trigger",
                "DELETE FROM sales_menu.sales_publication WHERE publication_ref = ?",
                "55000",
                "SALES_MENU_PUBLICATION_APPEND_ONLY",
                fixture.publication());

        UUID replacementCatalogItem = UUID.randomUUID();
        assertSqlFailure(
                "stable sales item catalog binding must not be changed",
                "UPDATE sales_menu.sales_item SET catalog_item_ref = ? WHERE sales_item_ref = ?",
                "55000",
                "SALES_MENU_ITEM_BINDING_IMMUTABLE",
                replacementCatalogItem,
                fixture.salesItem());
        assertSqlFailure(
                "stable sales item collection binding must not be changed",
                "UPDATE sales_menu.sales_item SET collection_ref = ? WHERE sales_item_ref = ?",
                "55000",
                "SALES_MENU_ITEM_BINDING_IMMUTABLE",
                otherCollection,
                fixture.salesItem());
        assertEquals(
                fixture.catalogItem(),
                scalarUuid(
                        "SELECT catalog_item_ref FROM sales_menu.sales_item WHERE sales_item_ref = ?",
                        fixture.salesItem()),
                "failed rebinding attempts must leave the stable catalog binding unchanged");
    }

    @AfterAll
    static void cleanTemporaryDatabase() {
        if (flyway != null) {
            flyway.clean();
        }
    }

    private static void insertCollection(UUID collection, UUID workspace, UUID store, String name) throws SQLException {
        execute(
                "INSERT INTO sales_menu.sales_collection "
                        + "(collection_ref, workspace_uuid, group_workspace_key, store_ref, name, "
                        + "archived_at_epoch_millis, current_draft_version_ref, latest_published_version_ref, version) "
                        + "VALUES (?, ?, 'sales-menu-test', ?, ?, NULL, NULL, NULL, 1)",
                collection,
                workspace,
                store,
                name);
    }

    private static void insertActivation(UUID collection, UUID channel, String status) throws SQLException {
        execute(
                "INSERT INTO sales_menu.sales_collection_activation "
                        + "(collection_ref, channel_ref, status, version) VALUES (?, ?, ?, ?)",
                collection,
                channel,
                status,
                1L);
    }

    private static void insertVersion(
            UUID version,
            UUID collection,
            String kind,
            long revision,
            UUID sourceDraftVersion,
            Long sourceDraftRevision)
            throws SQLException {
        if (sourceDraftVersion == null) {
            execute(
                    "INSERT INTO sales_menu.sales_collection_version "
                            + "(version_ref, collection_ref, kind, revision, schedule_kind, "
                            + "schedule_start_local_time, schedule_end_local_time, source_draft_version_ref, "
                            + "source_draft_revision, version) VALUES (?, ?, ?, ?, 'ALL_DAY', NULL, NULL, "
                            + "NULL, NULL, ?)",
                    version,
                    collection,
                    kind,
                    revision,
                    1L);
            return;
        }
        execute(
                "INSERT INTO sales_menu.sales_collection_version "
                        + "(version_ref, collection_ref, kind, revision, schedule_kind, "
                        + "schedule_start_local_time, schedule_end_local_time, source_draft_version_ref, "
                        + "source_draft_revision, version) VALUES (?, ?, ?, ?, 'ALL_DAY', NULL, NULL, ?, ?, ?)",
                version,
                collection,
                kind,
                revision,
                sourceDraftVersion,
                sourceDraftRevision,
                1L);
    }

    private static void insertSalesItem(UUID salesItem, UUID collection, UUID catalogItem) throws SQLException {
        execute(
                "INSERT INTO sales_menu.sales_item (sales_item_ref, collection_ref, catalog_item_ref) "
                        + "VALUES (?, ?, ?)",
                salesItem,
                collection,
                catalogItem);
    }

    private static void insertSection(UUID section, UUID collection) throws SQLException {
        execute(
                "INSERT INTO sales_menu.sales_section (section_ref, collection_ref) VALUES (?, ?)",
                section,
                collection);
    }

    private static void insertVersionSection(UUID version, UUID section, String name, long displayOrder)
            throws SQLException {
        execute(
                "INSERT INTO sales_menu.sales_version_section "
                        + "(version_ref, section_ref, name, display_order) VALUES (?, ?, ?, ?)",
                version,
                section,
                name,
                displayOrder);
    }

    private static void insertVersionItem(UUID version, UUID salesItem, UUID section) throws SQLException {
        execute(
                "INSERT INTO sales_menu.sales_version_item "
                        + "(version_ref, sales_item_ref, section_ref, display_order, "
                        + "ordering_constraints_json, display_media_mode, version) "
                        + "VALUES (?, ?, ?, 0, '{}'::jsonb, 'INHERIT_CATALOG', 1)",
                version,
                salesItem,
                section);
    }

    private static PublishedFixture insertPublishedFixture() throws SQLException {
        UUID workspace = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        UUID collection = UUID.randomUUID();
        UUID draftVersion = UUID.randomUUID();
        UUID publishedVersion = UUID.randomUUID();
        UUID section = UUID.randomUUID();
        UUID salesItem = UUID.randomUUID();
        UUID catalogItem = UUID.randomUUID();
        UUID sku = UUID.randomUUID();
        UUID asset = UUID.randomUUID();
        UUID publication = UUID.randomUUID();
        insertCollection(collection, workspace, store, "Immutable facts menu");
        insertVersion(draftVersion, collection, "DRAFT", 1, null, null);
        insertVersion(publishedVersion, collection, "PUBLISHED", 1, draftVersion, 1L);
        insertSection(section, collection);
        insertVersionSection(publishedVersion, section, "Coffee", 0);
        insertSalesItem(salesItem, collection, catalogItem);
        execute(
                "INSERT INTO sales_menu.sales_version_item "
                        + "(version_ref, sales_item_ref, section_ref, display_order, display_name_override, "
                        + "resolved_item_name, resolved_item_code, resolved_product_shape, listed_price_cents, "
                        + "ordering_constraints_json, display_media_mode, version) "
                        + "VALUES (?, ?, ?, 0, NULL, 'Americano', 'AMERICANO', 'DIRECT', 300, "
                        + "'{}'::jsonb, 'INHERIT_CATALOG', 1)",
                publishedVersion,
                salesItem,
                section);
        execute(
                "INSERT INTO sales_menu.sales_version_item_sku "
                        + "(version_ref, sales_item_ref, sku_ref, listed_price_cents, resolved_sku_code, "
                        + "resolved_sku_name, default_price_cents, display_order) "
                        + "VALUES (?, ?, ?, 300, 'AMERICANO-REGULAR', 'Regular', 300, 0)",
                publishedVersion,
                salesItem,
                sku);
        UUID definition = UUID.randomUUID();
        UUID definitionValue = UUID.randomUUID();
        execute(
                "INSERT INTO sales_menu.sales_version_item_order_option "
                        + "(version_ref, sales_item_ref, definition_ref, resolved_definition_name, selection_mode, "
                        + "required, min_selection_count, max_selection_count, display_order) "
                        + "VALUES (?, ?, ?, 'Milk', 'SINGLE', false, 0, 1, 0)",
                publishedVersion,
                salesItem,
                definition);
        execute(
                "INSERT INTO sales_menu.sales_version_item_order_option_value "
                        + "(version_ref, sales_item_ref, definition_ref, definition_value_ref, resolved_value_name, "
                        + "display_order, default_value, extra_price) VALUES (?, ?, ?, ?, 'Oat', 0, false, 50)",
                publishedVersion,
                salesItem,
                definition,
                definitionValue);
        execute(
                "INSERT INTO sales_menu.sales_version_item_media "
                        + "(version_ref, sales_item_ref, asset_ref, display_order) VALUES (?, ?, ?, 0)",
                publishedVersion,
                salesItem,
                asset);
        execute(
                "INSERT INTO sales_menu.sales_publication "
                        + "(publication_ref, collection_ref, published_version_ref, source_draft_revision, "
                        + "actor_type, actor_id, actor_display_snapshot, occurred_at_epoch_millis) "
                        + "VALUES (?, ?, ?, 1, 'SYSTEM', NULL, 'system', ?)",
                publication,
                collection,
                publishedVersion,
                NOW);
        return new PublishedFixture(
                publishedVersion,
                section,
                salesItem,
                catalogItem,
                sku,
                definition,
                definitionValue,
                asset,
                publication);
    }

    private static void assertConstraint(String schema, String table, String name, String... fragments)
            throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement =
                        connection.prepareStatement("SELECT pg_get_constraintdef(constraint_row.oid) "
                                + "FROM pg_constraint constraint_row "
                                + "JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid "
                                + "JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace "
                                + "WHERE schema_row.nspname = ? AND table_row.relname = ? "
                                + "AND constraint_row.conname = ?")) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, name);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "missing constraint " + schema + "." + table + "." + name);
                String definition = result.getString(1);
                assertContainsAll(
                        definition,
                        fragments,
                        "constraint definition mismatch for " + schema + "." + table + "." + name);
            }
        }
    }

    private static void assertIndex(String schema, String name, boolean unique, String... fragments)
            throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement =
                        connection.prepareStatement("SELECT pg_get_indexdef(index_row.oid), index_meta.indisunique "
                                + "FROM pg_class index_row "
                                + "JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace "
                                + "JOIN pg_index index_meta ON index_meta.indexrelid = index_row.oid "
                                + "WHERE schema_row.nspname = ? AND index_row.relname = ?")) {
            statement.setString(1, schema);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "missing index " + schema + "." + name);
                String definition = result.getString(1);
                assertEquals(unique, result.getBoolean(2), "unique flag mismatch for " + schema + "." + name);
                assertContainsAll(definition, fragments, "index definition mismatch for " + schema + "." + name);
            }
        }
    }

    private static void assertTrigger(
            String schema, String table, String name, String function, String... definitionFragments)
            throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement =
                        connection.prepareStatement("SELECT pg_get_triggerdef(trigger_row.oid), function_row.proname "
                                + "FROM pg_trigger trigger_row "
                                + "JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid "
                                + "JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace "
                                + "JOIN pg_proc function_row ON function_row.oid = trigger_row.tgfoid "
                                + "WHERE schema_row.nspname = ? AND table_row.relname = ? "
                                + "AND trigger_row.tgname = ? AND NOT trigger_row.tgisinternal")) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, name);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "missing trigger " + schema + "." + table + "." + name);
                assertEquals(function, result.getString(2), "trigger function mismatch for " + name);
                assertContainsAll(
                        result.getString(1),
                        definitionFragments,
                        "trigger definition mismatch for " + schema + "." + table + "." + name);
            }
        }
    }

    private static void assertContainsAll(String actual, String[] fragments, String message) {
        String normalized = actual.toUpperCase(Locale.ROOT);
        for (String fragment : fragments) {
            assertTrue(
                    normalized.contains(fragment.toUpperCase(Locale.ROOT)),
                    message + "; missing fragment=" + fragment + "; actual=" + actual);
        }
    }

    private static SQLException assertSqlFailure(
            String description, String sql, String expectedSqlState, String expectedMessage, Object... parameters) {
        SQLException failure = assertThrows(SQLException.class, () -> execute(sql, parameters), description);
        String actualMessage = exceptionText(failure);
        assertEquals(
                expectedSqlState,
                failure.getSQLState(),
                description + "; expected SQLSTATE " + expectedSqlState + " but got " + actualMessage);
        assertTrue(
                actualMessage.contains(expectedMessage),
                description + "; expected database fact " + expectedMessage + " but got " + actualMessage);
        return failure;
    }

    private static boolean hasUniqueIndexOnCollectionAndCatalogItem() throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement("SELECT count(*) FROM pg_index index_meta "
                        + "JOIN pg_class index_row ON index_row.oid = index_meta.indexrelid "
                        + "WHERE index_meta.indrelid = 'sales_menu.sales_item'::regclass "
                        + "AND index_meta.indisunique "
                        + "AND pg_get_indexdef(index_row.oid) LIKE '%(collection_ref, catalog_item_ref)%'")) {
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "sales_item unique-index probe must return a count");
                return result.getInt(1) > 0;
            }
        }
    }

    private static int scalarInt(String sql, Object... parameters) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "scalar query returned no row: " + sql);
                return result.getInt(1);
            }
        }
    }

    private static UUID scalarUuid(String sql, Object... parameters) throws SQLException {
        try (Connection connection = adminConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, parameters);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), "UUID query returned no row: " + sql);
                return (UUID) result.getObject(1);
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

    private static String exceptionText(Throwable failure) {
        StringBuilder text = new StringBuilder();
        for (Throwable current = failure; current != null; current = current.getCause()) {
            if (current.getMessage() != null) {
                if (text.length() > 0) {
                    text.append(" | ");
                }
                text.append(current.getMessage());
            }
        }
        return text.toString();
    }

    private static Connection adminConnection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private record TriggerFact(String table, String name) {}

    private record PublishedFixture(
            UUID publishedVersion,
            UUID section,
            UUID salesItem,
            UUID catalogItem,
            UUID sku,
            UUID definition,
            UUID definitionValue,
            UUID asset,
            UUID publication) {}
}
