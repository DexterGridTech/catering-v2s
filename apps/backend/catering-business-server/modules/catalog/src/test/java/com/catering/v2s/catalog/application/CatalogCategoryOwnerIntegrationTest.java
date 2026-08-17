package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.fulfillment.production.application.ProductionTagOwnerService;
import com.catering.v2s.inventory.application.InventoryOwnerService;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CatalogCategoryOwnerIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String BRAND = "BRAND";
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID SCOPE = UUID.randomUUID();
    private static final UUID COPY_TARGET_SCOPE = UUID.randomUUID();

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final PostgreSQLContainer<?> LEGACY_POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static Flyway flyway;
    private static JdbcTemplate jdbc;
    private static CatalogOwnerService service;
    private static InventoryOwnerService inventory;
    private static ProductionTagOwnerService production;

    @BeforeAll
    static void setup() {
        flyway = flyway(POSTGRES, null);
        flyway.migrate();
        jdbc = jdbc(POSTGRES);
        inventory = new InventoryOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        production = new ProductionTagOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        service = new CatalogOwnerService(
                jdbc,
                MAPPER,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                production,
                inventory);
    }

    @Test
    void categoryOperationsUseOpaqueRefsAndAllowDeleteThenCodeReuse() {
        JsonNode rootA = create("CAT-A", "A", null);
        JsonNode rootB = create("CAT-B", "B", null);
        JsonNode childC = create("CAT-C", "C", rootA.path("categoryRef").asText());
        JsonNode childD = create("CAT-D", "D", rootB.path("categoryRef").asText());

        JsonNode tree = navigation();
        JsonNode treeC = category(tree, childC.path("categoryRef").asText());
        assertEquals(
                childC.path("categoryRef").asText(), treeC.path("categoryRef").asText());
        assertTrue(treeC.path("version").asLong() > 0);
        assertEquals(
                rootA.path("categoryRef").asText(),
                treeC.path("parentCategoryRef").asText());

        JsonNode moved = write(
                "moveOperationsCatalogCategory",
                MAPPER.createObjectNode()
                        .put("categoryRef", childC.path("categoryRef").asText())
                        .put("expectedVersion", childC.path("version").asLong())
                        .put("action", "REPARENT")
                        .put("parentCategoryRef", rootB.path("categoryRef").asText()));
        assertEquals(
                rootB.path("categoryRef").asText(),
                moved.path("parentCategoryRef").asText());
        CatalogOwnerApi.Problem staleMove = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "moveOperationsCatalogCategory",
                        MAPPER.createObjectNode()
                                .put("categoryRef", childC.path("categoryRef").asText())
                                .put("expectedVersion", childC.path("version").asLong())
                                .put("action", "UP")));
        assertEquals("VERSION_CONFLICT", staleMove.code());

        JsonNode movedUp = write(
                "moveOperationsCatalogCategory",
                MAPPER.createObjectNode()
                        .put("categoryRef", childC.path("categoryRef").asText())
                        .put("expectedVersion", moved.path("version").asLong())
                        .put("action", "UP"));
        assertEquals(0, movedUp.path("displayOrder").asInt());
        JsonNode movedDown = write(
                "moveOperationsCatalogCategory",
                MAPPER.createObjectNode()
                        .put("categoryRef", childC.path("categoryRef").asText())
                        .put("expectedVersion", movedUp.path("version").asLong())
                        .put("action", "DOWN"));
        assertTrue(movedDown.path("displayOrder").asInt()
                > movedUp.path("displayOrder").asInt());
        CatalogOwnerApi.Problem boundary = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "moveOperationsCatalogCategory",
                        MAPPER.createObjectNode()
                                .put("categoryRef", childC.path("categoryRef").asText())
                                .put(
                                        "expectedVersion",
                                        movedDown.path("version").asLong())
                                .put("action", "DOWN")));
        assertEquals("MOVE_BOUNDARY", boundary.code());

        JsonNode deletion = write(
                "deleteOperationsCatalogCategory",
                MAPPER.createObjectNode()
                        .put("categoryRef", rootA.path("categoryRef").asText())
                        .put("expectedVersion", rootA.path("version").asLong()));
        assertEquals(
                rootA.path("categoryRef").asText(), deletion.path("categoryRef").asText());
        assertEquals(1, deletion.path("deletedSubtreeSize").asInt());
        assertEquals(
                List.of("CAT-A"),
                MAPPER.convertValue(
                        deletion.path("deletedCategoryCodes"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertTrue(!deletion.has("deletedCount"));
        JsonNode recreated = create("CAT-A", "A-recreated", null);
        assertEquals("CAT-A", recreated.path("code").asText());
    }

    @Test
    void navigationAllCountMatchesTheSmartAllScopeAndExcludesVoidedItems() {
        long before = navigationData().path("allCount").asLong();
        String visibleCode = generatedCatalogCode("NAV-ALL-VISIBLE");
        String voidedCode = generatedCatalogCode("NAV-ALL-VOIDED");
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", visibleCode)
                        .put("name", "visible navigation item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", voidedCode)
                        .put("name", "voided navigation item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        jdbc.update(
                "UPDATE catalog.catalog_item SET status='VOIDED' WHERE data_node_ref=? AND brand_ref=? AND code=?",
                SCOPE.toString(),
                BRAND,
                voidedCode);

        JsonNode navigation = navigationData();
        long expected = jdbc.queryForObject(
                "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND status <> "
                        + "'VOIDED'",
                Long.class,
                SCOPE.toString(),
                BRAND);
        JsonNode smartAll = service.readItems(
                        SCOPE.toString(),
                        BRAND,
                        MAPPER.createObjectNode().put("smartViewKey", "ALL").put("pageSize", 1),
                        "navigation-smart-all")
                .path("data");

        assertEquals(before + 1, navigation.path("allCount").asLong());
        assertEquals(expected, navigation.path("allCount").asLong());
        assertEquals(
                navigation.path("allCount").asLong(), smartAll.path("total").asLong());
    }

    @Test
    void voidedItemReleasesItsCodeWhileArchivedItemStillReservesItsCode() {
        String voidedCode = generatedCatalogCode("RELEASED-CODE");
        JsonNode voided = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", voidedCode)
                        .put("name", "voided source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", voidedCode)
                        .put("expectedVersion", voided.path("version").asLong())
                        .put("targetStatus", "VOIDED"));

        JsonNode replacement = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", voidedCode)
                        .put("name", "replacement")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        assertEquals("DRAFT", replacement.path("status").asText());
        ObjectNode query = MAPPER.createObjectNode();
        query.putArray("itemCodes").add(voidedCode);
        JsonNode page = service.readItems(SCOPE.toString(), BRAND, query, "released-code-readback")
                .path("data");
        assertEquals(1, page.path("items").size());
        assertEquals("replacement", page.path("items").path(0).path("name").asText());
        JsonNode voidedPage = service.readItems(
                        SCOPE.toString(),
                        BRAND,
                        MAPPER.createObjectNode().put("status", "VOIDED"),
                        "voided-item-must-not-be-public")
                .path("data");
        assertEquals(0, voidedPage.path("items").size());

        String archivedCode = generatedCatalogCode("ARCHIVED-CODE");
        JsonNode archived = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", archivedCode)
                        .put("name", "archived source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", archivedCode)
                        .put("expectedVersion", archived.path("version").asLong())
                        .put("targetStatus", "ARCHIVED"));
        CatalogOwnerApi.Problem reserved = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "createOperationsCatalogItem",
                        MAPPER.createObjectNode()
                                .put("code", archivedCode)
                                .put("name", "must be rejected")
                                .put("shapeKey", "STANDARD_SALE_COUNTED")));
        assertEquals("DUPLICATE_CODE", reserved.code());
    }

    @Test
    void itemVoidRejectsAnItemStillReferencedOnlyByInventory() {
        String itemCode = generatedCatalogCode("INVENTORY-ITEM-GUARD");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "inventory-guarded item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID itemRef = UUID.fromString(created.path("resourceRef").asText());
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                itemRef,
                null,
                itemCode,
                null);

        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "transitionOperationsCatalogItemStatus",
                        MAPPER.createObjectNode()
                                .put("itemCode", itemCode)
                                .put("expectedVersion", created.path("version").asLong())
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
        assertEquals(
                "DRAFT",
                jdbc.queryForObject("SELECT status FROM catalog.catalog_item WHERE item_ref=?", String.class, itemRef));
    }

    @Test
    void voidedSkuReleasesItsCodeAndDisappearsFromThePublicSkuSet() {
        String itemCode = generatedCatalogCode("SKU-RELEASED-CODE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "SKU release source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID skuRef = UUID.randomUUID();
        JsonNode saved = write(
                "saveOperationsCatalogItem",
                skuSave(itemCode, created.path("version").asLong(), skuRef, "RELEASED-SKU"));
        JsonNode before = service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-release-before")
                .path("data")
                .path("item");
        JsonNode skuBefore = before.path("skus").get(0);

        JsonNode voided = write(
                "saveOperationsCatalogItem",
                skuVoidSave(
                        itemCode,
                        saved.path("version").asLong(),
                        before,
                        skuRef,
                        skuBefore.path("version").asLong()));
        assertEquals(1, voided.path("skuTransitions").size());
        assertEquals(
                "VOIDED",
                voided.path("skuTransitions").get(0).path("targetStatus").asText());
        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?", String.class, skuRef));
        assertEquals(
                0,
                service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-release-hidden")
                        .path("data")
                        .path("item")
                        .path("skus")
                        .size());

        UUID replacementRef = UUID.randomUUID();
        JsonNode replacement = write(
                "saveOperationsCatalogItem",
                skuSave(itemCode, voided.path("version").asLong(), replacementRef, "RELEASED-SKU"));
        assertEquals(
                voided.path("version").asLong() + 1, replacement.path("version").asLong());
        assertEquals(
                "RELEASED-SKU",
                service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-release-replacement")
                        .path("data")
                        .path("item")
                        .path("skus")
                        .get(0)
                        .path("skuCode")
                        .asText());
    }

    @Test
    void skuVoidIsBlockedByAnInventoryReferenceWithoutChangingTheSku() {
        String itemCode = generatedCatalogCode("SKU-INVENTORY-GUARD");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "SKU inventory guard")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID skuRef = UUID.randomUUID();
        JsonNode saved = write(
                "saveOperationsCatalogItem",
                skuSave(itemCode, created.path("version").asLong(), skuRef, "GUARDED-SKU"));
        JsonNode before = service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-inventory-guard-before")
                .path("data")
                .path("item");
        long skuVersion = before.path("skus").get(0).path("version").asLong();
        UUID itemRef = UUID.fromString(before.path("itemRef").asText());
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                itemRef,
                skuRef,
                itemCode,
                "GUARDED-SKU");

        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "saveOperationsCatalogItem",
                        skuVoidSave(itemCode, saved.path("version").asLong(), before, skuRef, skuVersion)));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
        assertEquals(
                "ENABLED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?", String.class, skuRef));
        assertEquals(
                saved.path("version").asLong(),
                jdbc.queryForObject("SELECT version FROM catalog.catalog_item WHERE item_ref=?", Long.class, itemRef));
    }

    @Test
    void skuRetirementBatchKeepsEachInventoryBlockerAttributedToItsSku() {
        String itemCode = generatedCatalogCode("SKU-BATCH-GUARD");
        UUID itemRef = UUID.randomUUID();
        UUID ownerItemRef = UUID.randomUUID();
        UUID catalogBlockedSkuRef = UUID.randomUUID();
        UUID inventoryBlockedSkuRef = UUID.randomUUID();
        UUID freeSkuRef = UUID.randomUUID();
        insertQG10Item(itemRef, itemCode, "SKU batch guard");
        insertQG10Item(ownerItemRef, generatedCatalogCode("SKU-BATCH-OWNER"), "SKU batch owner");
        insertQG10Sku(itemRef, catalogBlockedSkuRef, "QG10-CATALOG-BLOCK", true, "qg10-retire-1");
        insertQG10Sku(itemRef, inventoryBlockedSkuRef, "QG10-INVENTORY-BLOCK", false, "qg10-retire-2");
        insertQG10Sku(itemRef, freeSkuRef, "QG10-FREE", false, "qg10-retire-3");
        UUID groupRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_composite_group(composite_group_ref,item_ref,group_code,group_name,"
                        + "selection_rule,min_selections,max_selections,display_order) "
                        + "VALUES(?,?,?,'配菜','OPTIONAL',0,3,0)",
                groupRef,
                ownerItemRef,
                "QG10-RETIRE-GROUP");
        insertQG10CompositeComponent(groupRef, itemRef, catalogBlockedSkuRef, 0);
        jdbc.update(
                "INSERT INTO inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,"
                        + "item_code,sku_code,measure_mode,configuration,balance,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                itemRef,
                inventoryBlockedSkuRef,
                itemCode,
                "QG10-INVENTORY-BLOCK");

        JsonNode before = service.readItem(SCOPE.toString(), BRAND, itemCode, "qg10-retire-before")
                .path("data")
                .path("item");
        ObjectNode batchVoid = skuVoidSaveMany(
                itemCode, before.path("version").asLong(), before, List.of(inventoryBlockedSkuRef, freeSkuRef), 1L);
        CatalogOwnerApi.Problem blocked =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", batchVoid));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
        assertTrue(blocked.getMessage().contains(inventoryBlockedSkuRef.toString()));
        assertEquals(
                "ENABLED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?", String.class, freeSkuRef));
        jdbc.update("DELETE FROM inventory.stock_target WHERE product_sku_ref=?", inventoryBlockedSkuRef);

        JsonNode succeeded = write("saveOperationsCatalogItem", batchVoid);
        assertEquals(2, succeeded.path("skuTransitions").size());
        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?",
                        String.class,
                        inventoryBlockedSkuRef));
        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?", String.class, freeSkuRef));
    }

    @Test
    void productionTagDetailIsProjectedFromTheRelationInsteadOfPersistedJson() {
        UUID tagRef = UUID.randomUUID();
        insertProductionTag(SCOPE, tagRef, "RELATION-PRODUCTION-TAG");
        String itemCode = generatedCatalogCode("RELATION-PRODUCTION-TAG");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "relation-backed production tag")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", itemCode);
        save.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("productionTagRefs")
                .add(tagRef.toString());
        write("saveOperationsCatalogItem", save);

        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'productionTagRefs') OR jsonb_exists(sections, 'productionTags') FROM "
                        + "catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                itemCode));
        JsonNode tag = service.readItem(SCOPE.toString(), BRAND, itemCode, "relation-production-tag-readback")
                .path("data")
                .path("productionTags")
                .get(0);
        assertEquals(tagRef.toString(), tag.path("tagRef").asText());
        assertEquals("RELATION-PRODUCTION-TAG", tag.path("code").asText());
        assertEquals("fulfillment-production", tag.path("owner").asText());
    }

    @Test
    void productionTagCommandReadbackCarriesTheCreatedOpaqueReference() {
        String code = generatedCatalogCode("TYPED-TAG-REF");
        ProductionTagOwnerApi.ProductionTagCommandReadback readback = production.createTag(
                context("createOperationsProductionTag", SCOPE, "typed-tag-ref"),
                new ProductionTagOwnerApi.CreateTagCommand(code, "PRODUCTION", "typed tag"),
                "typed-tag-ref-key");
        assertTrue(readback.tagRef() != null);
        assertEquals(
                readback.tagRef(),
                jdbc.queryForObject(
                        "SELECT tag_ref FROM fulfillment_production.production_tag_definition WHERE data_node_ref=? "
                                + "AND brand_ref=? AND code=?",
                        UUID.class,
                        SCOPE.toString(),
                        BRAND,
                        code));
    }

    @Test
    void itemListAndDetailProjectCatalogReferencesAndNonArchivedSkuPriceRange() {
        UUID attributeRef = UUID.randomUUID();
        UUID firstValueRef = UUID.randomUUID();
        UUID secondValueRef = UUID.randomUUID();
        UUID tagRef = UUID.randomUUID();
        UUID salesUnitRef = UUID.randomUUID();
        insertDictionary(SCOPE, attributeRef, "SKU_ATTRIBUTE", "RANGE-ATTRIBUTE");
        insertDictionary(SCOPE, firstValueRef, "SKU_ATTRIBUTE_VALUE", "RANGE-VALUE-A", attributeRef);
        insertDictionary(SCOPE, secondValueRef, "SKU_ATTRIBUTE_VALUE", "RANGE-VALUE-B", attributeRef);
        insertDictionary(SCOPE, tagRef, "TAG", "CATALOG-TAG-RANGE");
        insertDictionary(SCOPE, salesUnitRef, "SALES_UNIT", "UNIT-RANGE");
        String itemCode = generatedCatalogCode("REFERENCE-RANGE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "reference and range")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = save.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft");
        draft.putArray("tagRefs").add(tagRef.toString());
        draft.putArray("salesUnitRefs").add(salesUnitRef.toString());
        ArrayNode dimensions = draft.putArray("skuVariantDimensions");
        ObjectNode dimension = dimensions.addObject().put("attributeRef", attributeRef.toString());
        dimension
                .putArray("values")
                .addObject()
                .put("valueRef", firstValueRef.toString())
                .put("displayOrder", 0);
        dimension
                .withArray("values")
                .addObject()
                .put("valueRef", secondValueRef.toString())
                .put("displayOrder", 1);
        ArrayNode skus = draft.putArray("skus");
        ObjectNode firstSku = skus.addObject()
                .put("skuCode", "RANGE-A")
                .put("skuName", "Range A")
                .put("standardSalePrice", 100)
                .put("isDefault", true)
                .put("status", "ENABLED");
        firstSku.putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attributeRef.toString())
                .put("attributeValueRef", firstValueRef.toString());
        ObjectNode secondSku = skus.addObject()
                .put("skuCode", "RANGE-B")
                .put("skuName", "Range B")
                .put("standardSalePrice", 300)
                .put("isDefault", false)
                .put("status", "ENABLED");
        secondSku
                .putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attributeRef.toString())
                .put("attributeValueRef", secondValueRef.toString());
        write("saveOperationsCatalogItem", save);

        JsonNode detail = service.readItem(SCOPE.toString(), BRAND, itemCode, "reference-range-detail")
                .path("data")
                .path("item");
        assertEquals(
                List.of(tagRef.toString()),
                MAPPER.convertValue(
                        detail.path("tagRefs"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertEquals(
                List.of(salesUnitRef.toString()),
                MAPPER.convertValue(
                        detail.path("salesUnitRefs"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertEquals(tagRef.toString(), detail.path("tagRefs").get(0).asText());

        ObjectNode listRequest = MAPPER.createObjectNode();
        listRequest.putArray("itemCodes").add(itemCode);
        JsonNode listItem = service.readItems(SCOPE.toString(), BRAND, listRequest, "reference-range-list")
                .path("data")
                .path("items")
                .get(0);
        assertEquals(detail.path("itemRef").asText(), listItem.path("itemRef").asText());
        assertEquals(
                List.of(tagRef.toString()),
                MAPPER.convertValue(
                        listItem.path("tagRefs"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertEquals(100, listItem.path("standardSalePriceMin").asInt());
        assertEquals(300, listItem.path("standardSalePriceMax").asInt());
    }

    @Test
    void itemDetailCarriesBothDataNodeAndBrandScopeForSkuPickers() {
        String itemCode = generatedCatalogCode("PICKER-SCOPE");
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "picker scope")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));

        JsonNode identity = service.readItem(SCOPE.toString(), BRAND, itemCode, "picker-scope-readback")
                .path("data")
                .path("queryIdentity");
        assertEquals(SCOPE.toString(), identity.path("dataNodeRef").asText());
        assertEquals(BRAND, identity.path("brandRef").asText());
    }

    @Test
    void saveMintsDistinctSkuRefsWhenNewSkusOmitThemFromTheRequest() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "MINT-ATTRIBUTE")
                        .put("name", "铸造属性"));
        JsonNode attributes = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "SKU_ATTRIBUTE",
                        MAPPER.createObjectNode(),
                        "server-minted-sku-attribute")
                .path("data")
                .path("entries");
        String attributeRef =
                dictionaryEntry(attributes, "MINT-ATTRIBUTE").path("entryRef").asText();
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "MINT-A")
                        .put("name", "铸造值 A")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "MINT-B")
                        .put("name", "铸造值 B")
                        .put("parentEntryRef", attributeRef));
        JsonNode values = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "SKU_ATTRIBUTE_VALUE",
                        MAPPER.createObjectNode(),
                        "server-minted-sku-values")
                .path("data")
                .path("entries");
        String firstValueRef =
                dictionaryEntry(values, "MINT-A").path("entryRef").asText();
        String secondValueRef =
                dictionaryEntry(values, "MINT-B").path("entryRef").asText();
        String itemCode = generatedCatalogCode("SERVER-MINTED-SKU");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "server minted SKU item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = request.putObject("sections")
                .put("expectedCatalogVersion", item.path("version").asLong())
                .putObject("catalogDraft");
        ArrayNode axisValues = draft.putArray("skuVariantDimensions")
                .addObject()
                .put("attributeRef", attributeRef)
                .putArray("values");
        axisValues.addObject().put("valueRef", firstValueRef).put("displayOrder", 0);
        axisValues.addObject().put("valueRef", secondValueRef).put("displayOrder", 1);
        ArrayNode skus = draft.putArray("skus");
        ObjectNode firstSku = skus.addObject()
                .put("skuCode", "MINTED-A")
                .put("skuName", "Minted A")
                .put("isDefault", true)
                .put("status", "ENABLED");
        firstSku.putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attributeRef)
                .put("attributeValueRef", firstValueRef);
        ObjectNode secondSku = skus.addObject()
                .put("skuCode", "MINTED-B")
                .put("skuName", "Minted B")
                .put("isDefault", false)
                .put("status", "ENABLED");
        secondSku
                .putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attributeRef)
                .put("attributeValueRef", secondValueRef);

        try {
            write("saveOperationsCatalogItem", request);
        } catch (CatalogOwnerApi.Problem rejected) {
            throw new AssertionError(
                    "new SKU request without productSkuRef must be accepted: " + rejected.code() + " / "
                            + rejected.getMessage(),
                    rejected);
        }
        JsonNode saved = service.readItem(SCOPE.toString(), BRAND, itemCode, "server-minted-sku-readback")
                .path("data")
                .path("item")
                .path("skus");
        assertEquals(2, saved.size());
        assertNotEquals(
                saved.get(0).path("productSkuRef").asText(),
                saved.get(1).path("productSkuRef").asText());
        assertTrue(saved.get(0).path("productSkuRef").asText().matches("[0-9a-f-]{36}"));
        assertTrue(saved.get(1).path("productSkuRef").asText().matches("[0-9a-f-]{36}"));
    }

    /**
     * Keeps the three independently important SKU invariants on the real owner path: a code cannot silently create a
     * second SKU, a full-array save cannot create two defaults, and an explicit order stays stable when the array
     * grows.
     */
    @Test
    void skuCodeDefaultAndDisplayOrderInvariantsRejectBeforeChangingPersistedFacts() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "ORDER-ATTRIBUTE")
                        .put("name", "排序属性"));
        JsonNode attributes = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE", MAPPER.createObjectNode(), "sku-order-attribute")
                .path("data")
                .path("entries");
        String attributeRef =
                dictionaryEntry(attributes, "ORDER-ATTRIBUTE").path("entryRef").asText();
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "ORDER-A")
                        .put("name", "排序值 A")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "ORDER-B")
                        .put("name", "排序值 B")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "ORDER-C")
                        .put("name", "排序值 C")
                        .put("parentEntryRef", attributeRef));
        JsonNode values = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE_VALUE", MAPPER.createObjectNode(), "sku-order-values")
                .path("data")
                .path("entries");
        String firstValueRef =
                dictionaryEntry(values, "ORDER-A").path("entryRef").asText();
        String secondValueRef =
                dictionaryEntry(values, "ORDER-B").path("entryRef").asText();
        String thirdValueRef =
                dictionaryEntry(values, "ORDER-C").path("entryRef").asText();
        String itemCode = generatedCatalogCode("SKU-INVARIANTS");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "sku invariants")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID firstSkuRef = UUID.randomUUID(), secondSkuRef = UUID.randomUUID(), thirdSkuRef = UUID.randomUUID();

        ObjectNode initial = skuSave(
                itemCode,
                created.path("version").asLong(),
                firstSkuRef,
                secondSkuRef,
                true,
                attributeRef,
                firstValueRef,
                secondValueRef);
        ArrayNode initialSkus =
                (ArrayNode) initial.path("sections").path("catalogDraft").path("skus");
        ((ObjectNode) initialSkus.get(0)).put("displayOrder", 20);
        ((ObjectNode) initialSkus.get(1)).put("displayOrder", 10);
        JsonNode saved = write("saveOperationsCatalogItem", initial);
        JsonNode ordered = service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-order-first-readback")
                .path("data")
                .path("item")
                .path("skus");
        assertEquals(
                List.of("SKU-2", "SKU-1"),
                MAPPER
                        .convertValue(ordered, new com.fasterxml.jackson.core.type.TypeReference<List<JsonNode>>() {})
                        .stream()
                        .map(sku -> sku.path("skuCode").asText())
                        .toList());

        ObjectNode expanded = skuSave(
                itemCode,
                saved.path("version").asLong(),
                firstSkuRef,
                secondSkuRef,
                true,
                attributeRef,
                firstValueRef,
                secondValueRef);
        ArrayNode expandedAxes = (ArrayNode) expanded.path("sections")
                .path("catalogDraft")
                .path("skuVariantDimensions")
                .get(0)
                .path("values");
        expandedAxes.addObject().put("valueRef", thirdValueRef).put("displayOrder", 2);
        ArrayNode expandedSkus =
                (ArrayNode) expanded.path("sections").path("catalogDraft").path("skus");
        ((ObjectNode) expandedSkus.get(0)).put("displayOrder", 20);
        ((ObjectNode) expandedSkus.get(1)).put("displayOrder", 10);
        addSku(expandedSkus, thirdSkuRef, "SKU-3", false, attributeRef, thirdValueRef);
        ((ObjectNode) expandedSkus.get(2)).put("displayOrder", 30);
        JsonNode expandedSaved = write("saveOperationsCatalogItem", expanded);
        JsonNode afterExpansion = service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-order-expanded-readback")
                .path("data")
                .path("item")
                .path("skus");
        assertEquals(
                List.of("SKU-2", "SKU-1", "SKU-3"),
                MAPPER
                        .convertValue(
                                afterExpansion, new com.fasterxml.jackson.core.type.TypeReference<List<JsonNode>>() {})
                        .stream()
                        .map(sku -> sku.path("skuCode").asText())
                        .toList());

        ObjectNode duplicateCode = expanded.deepCopy();
        ((ObjectNode) duplicateCode.path("sections"))
                .put("expectedCatalogVersion", expandedSaved.path("version").asLong());
        ((ObjectNode) duplicateCode
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(2))
                .put("skuCode", "SKU-1");
        CatalogOwnerApi.Problem codeRejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", duplicateCode));
        assertEquals("DUPLICATE_CODE", codeRejected.code());

        ObjectNode duplicateDefault = expanded.deepCopy();
        ((ObjectNode) duplicateDefault.path("sections"))
                .put("expectedCatalogVersion", expandedSaved.path("version").asLong());
        ((ObjectNode) duplicateDefault
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(1))
                .put("isDefault", true);
        CatalogOwnerApi.Problem defaultRejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", duplicateDefault));
        assertEquals("VALIDATION_ERROR", defaultRejected.code());
        JsonNode afterRejections = service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-invariants-after-rejection")
                .path("data")
                .path("item")
                .path("skus");
        assertEquals(
                List.of("SKU-2", "SKU-1", "SKU-3"),
                MAPPER
                        .convertValue(
                                afterRejections, new com.fasterxml.jackson.core.type.TypeReference<List<JsonNode>>() {})
                        .stream()
                        .map(sku -> sku.path("skuCode").asText())
                        .toList());
        assertEquals(
                1,
                MAPPER
                        .convertValue(
                                afterRejections, new com.fasterxml.jackson.core.type.TypeReference<List<JsonNode>>() {})
                        .stream()
                        .filter(sku -> sku.path("isDefault").asBoolean())
                        .count());

        UUID probeItemRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                probeItemRef,
                SCOPE.toString(),
                BRAND,
                generatedCatalogCode("SKU-CODE-PROBE"),
                "sku code probe");
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest) VALUES(?,?, 'DUPLICATE-CODE', 'first', true, 'ENABLED', 0, "
                        + "'digest-first')",
                UUID.randomUUID(),
                probeItemRef);
        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update(
                        "INSERT INTO "
                                + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,dis"
                                + "play"
                                + "_order,variant_combination_digest) VALUES(?,?, 'DUPLICATE-CODE', 'second', false, "
                                + "'ENABLED', 1, 'digest-second')",
                        UUID.randomUUID(),
                        probeItemRef));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku WHERE item_ref=? AND sku_code='DUPLICATE-CODE'",
                        Integer.class,
                        probeItemRef));
    }

    @Test
    void standardSalePriceIsSavedInTheBasicCatalogFactsAndReadBackAtItemRoot() {
        String itemCode = generatedCatalogCode("BASIC-PRICE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "basic price")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        request.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft")
                .put("standardSalePrice", 1250);

        write("saveOperationsCatalogItem", request);

        JsonNode detail = service.readItem(SCOPE.toString(), BRAND, itemCode, "basic-price-readback")
                .path("data")
                .path("item");
        assertEquals(1250, detail.path("standardSalePrice").asInt());
        assertEquals("ITEM", detail.path("priceGranularity").asText());
        assertFalse(detail.has("ordering"));
        assertFalse(detail.has("listedSalePrice"));
    }

    @Test
    void shapeOwnedInventoryRulesRejectUnsupportedNodesAndModesEvenWhenNodeTypeLooksLikeItemBom() {
        String skuItemCode = generatedCatalogCode("SKU-NO-OPTIONS");
        JsonNode skuItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", skuItemCode)
                        .put("name", "sku without options")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));

        CatalogOwnerApi.Problem orderOptionsRejected = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "saveOperationsCatalogItem",
                        orderOptionSave(
                                skuItemCode,
                                skuItem.path("version").asLong(),
                                MAPPER.createArrayNode()
                                        .add(orderOptionGroup(
                                                "SIZE",
                                                "尺寸",
                                                "SMALL",
                                                UUID.randomUUID().toString(),
                                                null,
                                                null)))));
        assertEquals("VALIDATION_ERROR", orderOptionsRejected.code());
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        skuItemCode));

        ObjectNode optionValueBom = MAPPER.createObjectNode().put("itemCode", skuItemCode);
        ObjectNode bomDraft = optionValueBom
                .putObject("sections")
                .put("expectedCatalogVersion", 1L)
                .putObject("catalogDraft");
        bomDraft.putArray("inventoryBom")
                .addObject()
                .put("nodeType", "ITEM_BOM")
                .put("optionValueCode", "SWEETENER");
        CatalogOwnerApi.Problem optionValueRejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", optionValueBom));
        assertEquals("VALIDATION_ERROR", optionValueRejected.code());
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        skuItemCode));

        String serviceItemCode = generatedCatalogCode("SERVICE-NO-BOM");
        JsonNode serviceItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", serviceItemCode)
                        .put("name", "service without inventory BOM")
                        .put("shapeKey", "SERVICE"));
        ObjectNode serviceBom = MAPPER.createObjectNode().put("itemCode", serviceItemCode);
        serviceBom
                .putObject("sections")
                .put("expectedCatalogVersion", serviceItem.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("inventoryBom")
                .addObject()
                .put("nodeType", "ITEM_BOM");
        CatalogOwnerApi.Problem serviceBomRejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", serviceBom));
        assertEquals("VALIDATION_ERROR", serviceBomRejected.code());

        String standardItemCode = generatedCatalogCode("OPTION-VALUE-MODE");
        JsonNode standardItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", standardItemCode)
                        .put("name", "option value mode")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode invalidOptionMode = MAPPER.createObjectNode().put("itemCode", standardItemCode);
        invalidOptionMode
                .putObject("sections")
                .put("expectedCatalogVersion", standardItem.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("inventoryBom")
                .addObject()
                .put("nodeType", "ITEM_BOM")
                .put("mode", "INDEPENDENT_STOCK")
                .put("optionValueCode", "SWEETENER");
        CatalogOwnerApi.Problem invalidOptionModeRejected = assertThrows(
                CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", invalidOptionMode));
        assertEquals("VALIDATION_ERROR", invalidOptionModeRejected.code());
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        standardItemCode));
    }

    @Test
    void skuVariantAxisAndValueRetirementIsBlockedOnlyWhileAnActiveSkuStillReferencesIt() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "RETIRE-ATTRIBUTE")
                        .put("name", "退役属性"));
        JsonNode attributes = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE", MAPPER.createObjectNode(), "retire-attribute")
                .path("data")
                .path("entries");
        String attributeRef =
                dictionaryEntry(attributes, "RETIRE-ATTRIBUTE").path("entryRef").asText();
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "RETIRE-A")
                        .put("name", "退役值 A")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "RETIRE-B")
                        .put("name", "退役值 B")
                        .put("parentEntryRef", attributeRef));
        JsonNode values = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE_VALUE", MAPPER.createObjectNode(), "retire-values")
                .path("data")
                .path("entries");
        String firstValueRef =
                dictionaryEntry(values, "RETIRE-A").path("entryRef").asText();
        String secondValueRef =
                dictionaryEntry(values, "RETIRE-B").path("entryRef").asText();
        String itemCode = generatedCatalogCode("RETIRE-GUARD");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "retirement guard")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID skuRef = UUID.randomUUID();
        ObjectNode initial = skuSave(
                itemCode,
                created.path("version").asLong(),
                skuRef,
                null,
                false,
                attributeRef,
                firstValueRef,
                secondValueRef);
        JsonNode saved = write("saveOperationsCatalogItem", initial);

        ObjectNode removeReferencedValue = skuSave(
                itemCode,
                saved.path("version").asLong(),
                skuRef,
                null,
                false,
                attributeRef,
                firstValueRef,
                secondValueRef);
        ((ArrayNode) removeReferencedValue
                        .path("sections")
                        .path("catalogDraft")
                        .path("skuVariantDimensions")
                        .get(0)
                        .path("values"))
                .remove(0);
        CatalogOwnerApi.Problem valueBlocked = assertThrows(
                CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", removeReferencedValue));
        assertEquals("REFERENCE_BLOCKS_VOID", valueBlocked.code());
        assertTrue(valueBlocked.getMessage().contains("SKU-1"));
        assertEquals(
                saved.path("version").asLong(),
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                2,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_variant_axis_value value JOIN "
                                + "catalog.catalog_sku_variant_axis axis ON "
                                + "axis.sku_variant_axis_ref=value.sku_variant_axis_ref JOIN catalog.catalog_item item "
                                + "ON "
                                + "item.item_ref=axis.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                UUID.fromString(firstValueRef),
                jdbc.queryForObject(
                        "SELECT attribute_value_ref FROM catalog.catalog_sku_attribute_value WHERE product_sku_ref=? "
                                + "AND attribute_ref=?",
                        UUID.class,
                        skuRef,
                        UUID.fromString(attributeRef)));

        ObjectNode removeAxis = skuSave(
                itemCode,
                saved.path("version").asLong(),
                skuRef,
                null,
                false,
                attributeRef,
                firstValueRef,
                secondValueRef);
        ((ArrayNode) removeAxis.path("sections").path("catalogDraft").path("skuVariantDimensions")).removeAll();
        CatalogOwnerApi.Problem axisBlocked =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", removeAxis));
        assertEquals("REFERENCE_BLOCKS_VOID", axisBlocked.code());
        assertTrue(axisBlocked.getMessage().contains("SKU-1"));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_variant_axis axis JOIN catalog.catalog_item item ON "
                                + "item.item_ref=axis.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                2,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_variant_axis_value value JOIN "
                                + "catalog.catalog_sku_variant_axis axis ON "
                                + "axis.sku_variant_axis_ref=value.sku_variant_axis_ref JOIN catalog.catalog_item item "
                                + "ON "
                                + "item.item_ref=axis.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                UUID.fromString(firstValueRef),
                jdbc.queryForObject(
                        "SELECT attribute_value_ref FROM catalog.catalog_sku_attribute_value WHERE product_sku_ref=? "
                                + "AND attribute_ref=?",
                        UUID.class,
                        skuRef,
                        UUID.fromString(attributeRef)));

        ObjectNode adjustSkuThenRemoveAxis = skuSave(
                itemCode,
                saved.path("version").asLong(),
                skuRef,
                null,
                false,
                attributeRef,
                firstValueRef,
                secondValueRef);
        ((ArrayNode) adjustSkuThenRemoveAxis
                        .path("sections")
                        .path("catalogDraft")
                        .path("skuVariantDimensions"))
                .removeAll();
        ((ObjectNode) adjustSkuThenRemoveAxis
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(0))
                .putArray("attributeValueRefs");
        JsonNode adjusted = write("saveOperationsCatalogItem", adjustSkuThenRemoveAxis);
        assertEquals(
                saved.path("version").asLong() + 1, adjusted.path("version").asLong());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_variant_axis axis JOIN catalog.catalog_item item ON "
                                + "item.item_ref=axis.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
    }

    @Test
    void saveDerivesSkuAndPriceSummariesFromRelationalFactsInsteadOfClientSuppliedTotals() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "SUMMARY-ATTRIBUTE")
                        .put("name", "汇总属性"));
        JsonNode attributes = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE", MAPPER.createObjectNode(), "summary-attribute")
                .path("data")
                .path("entries");
        String attributeRef = dictionaryEntry(attributes, "SUMMARY-ATTRIBUTE")
                .path("entryRef")
                .asText();
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "SUMMARY-A")
                        .put("name", "汇总值 A")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "SUMMARY-B")
                        .put("name", "汇总值 B")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "SUMMARY-C")
                        .put("name", "汇总值 C")
                        .put("parentEntryRef", attributeRef));
        JsonNode values = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE_VALUE", MAPPER.createObjectNode(), "summary-values")
                .path("data")
                .path("entries");
        String firstValueRef =
                dictionaryEntry(values, "SUMMARY-A").path("entryRef").asText();
        String secondValueRef =
                dictionaryEntry(values, "SUMMARY-B").path("entryRef").asText();
        String thirdValueRef =
                dictionaryEntry(values, "SUMMARY-C").path("entryRef").asText();
        String itemCode = generatedCatalogCode("DERIVED-SUMMARY");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "derived summaries")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));

        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = request.putObject("sections")
                .put("expectedCatalogVersion", item.path("version").asLong())
                .putObject("catalogDraft");
        ArrayNode axisValues = draft.putArray("skuVariantDimensions")
                .addObject()
                .put("attributeRef", attributeRef)
                .putArray("values");
        axisValues.addObject().put("valueRef", firstValueRef).put("displayOrder", 0);
        axisValues.addObject().put("valueRef", secondValueRef).put("displayOrder", 1);
        axisValues.addObject().put("valueRef", thirdValueRef).put("displayOrder", 2);
        draft.put("missingPriceCount", 999).put("listedSalePrice", 1000);
        ArrayNode skus = draft.putArray("skus");
        derivedSummarySku(skus, "SUMMARY-A", attributeRef, firstValueRef, 1000, true);
        derivedSummarySku(skus, "SUMMARY-B", attributeRef, secondValueRef, null, false);
        derivedSummarySku(skus, "SUMMARY-C", attributeRef, thirdValueRef, null, false);

        write("saveOperationsCatalogItem", request);

        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'skuSummary') OR jsonb_exists(sections, 'ordering') OR "
                        + "jsonb_exists(sections, 'listedSalePrice') OR jsonb_exists(sections, 'missingPriceCount') "
                        + "FROM "
                        + "catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                itemCode));
        JsonNode detail = service.readItem(SCOPE.toString(), BRAND, itemCode, "derived-summary-readback")
                .path("data")
                .path("item");
        assertEquals("SKU", detail.path("priceGranularity").asText());
        assertEquals(2, detail.path("missingPriceCount").asInt());
        assertEquals(3, detail.path("skuSummary").path("totalCount").asInt());
        assertEquals(3, detail.path("skuSummary").path("nonArchivedCount").asInt());
        assertEquals(3, detail.path("skuSummary").path("enabledCount").asInt());

        ((ObjectNode) request.path("sections"))
                .put("expectedCatalogVersion", detail.path("version").asLong());
        for (int index = 0; index < skus.size(); index++)
            ((ObjectNode) skus.get(index))
                    .put(
                            "productSkuRef",
                            detail.path("skus").get(index).path("productSkuRef").asText());
        ((ObjectNode) skus.get(1)).put("standardSalePrice", 1000);
        write("saveOperationsCatalogItem", request);

        JsonNode afterPriceFix = service.readItem(SCOPE.toString(), BRAND, itemCode, "derived-summary-price-fixed")
                .path("data")
                .path("item");
        assertEquals(1, afterPriceFix.path("missingPriceCount").asInt());
        ObjectNode listRequest = MAPPER.createObjectNode();
        listRequest.putArray("itemCodes").add(itemCode);
        JsonNode listItem = service.readItems(SCOPE.toString(), BRAND, listRequest, "derived-summary-list-readback")
                .path("data")
                .path("items")
                .get(0);
        assertEquals(
                afterPriceFix.path("skuSummary").path("enabledCount").asInt(),
                listItem.path("skuEnabledCount").asInt());
        assertEquals(
                afterPriceFix.path("skuSummary").path("nonArchivedCount").asInt(),
                listItem.path("skuNonArchivedCount").asInt());
        assertEquals(
                afterPriceFix.path("skuSummary").path("totalCount").asInt(),
                listItem.path("skuTotalCount").asInt());
        assertEquals(
                afterPriceFix.path("missingPriceCount").asInt(),
                listItem.path("missingPriceCount").asInt());

        ObjectNode archiveThirdSku = request.deepCopy();
        ((ArrayNode) archiveThirdSku.path("sections").path("catalogDraft").path("skus")).remove(2);
        ((ObjectNode) archiveThirdSku.path("sections"))
                .put("expectedCatalogVersion", afterPriceFix.path("version").asLong());
        write("saveOperationsCatalogItem", archiveThirdSku);
        JsonNode afterArchive = service.readItem(SCOPE.toString(), BRAND, itemCode, "derived-summary-archive-readback")
                .path("data")
                .path("item");
        JsonNode archivedListItem = service.readItems(
                        SCOPE.toString(), BRAND, listRequest, "derived-summary-archive-list")
                .path("data")
                .path("items")
                .get(0);
        assertEquals(
                afterArchive.path("skus").size(),
                afterArchive.path("skuSummary").path("totalCount").asInt());
        assertEquals(
                afterArchive.path("skuSummary").path("enabledCount").asInt(),
                archivedListItem.path("skuEnabledCount").asInt());
        assertEquals(
                afterArchive.path("skuSummary").path("nonArchivedCount").asInt(),
                archivedListItem.path("skuNonArchivedCount").asInt());
        assertEquals(
                afterArchive.path("skuSummary").path("totalCount").asInt(),
                archivedListItem.path("skuTotalCount").asInt());
    }

    @Test
    void categoryDeleteReturnsTheCanonicalSubtreeReadbackAndReplaysOnlyAfterOwnerFactRecheck() {
        JsonNode root = create("DELETE-ROOT", "delete root", null);
        create("DELETE-CHILD", "delete child", root.path("categoryRef").asText());
        ObjectNode request = MAPPER.createObjectNode()
                .put("categoryRef", root.path("categoryRef").asText())
                .put("expectedVersion", root.path("version").asLong());

        JsonNode first = writeFull("deleteOperationsCatalogCategory", request, "delete-first", "delete-replay-key");
        JsonNode result = first.path("result");
        assertEquals(
                root.path("categoryRef").asText(), result.path("categoryRef").asText());
        assertEquals(2, result.path("deletedSubtreeSize").asInt());
        assertEquals(
                List.of("DELETE-CHILD", "DELETE-ROOT"),
                MAPPER.convertValue(
                        result.path("deletedCategoryCodes"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertTrue(!result.has("deletedCount"));

        JsonNode replay = writeFull("deleteOperationsCatalogCategory", request, "delete-replay", "delete-replay-key");
        JsonNode replayResult = replay.path("result");
        assertEquals(3, replayResult.size());
        assertEquals(
                root.path("categoryRef").asText(),
                replayResult.path("categoryRef").asText());
        assertEquals(2, replayResult.path("deletedSubtreeSize").asInt());
        assertEquals(
                List.of("DELETE-CHILD", "DELETE-ROOT"),
                MAPPER.convertValue(
                        replayResult.path("deletedCategoryCodes"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertTrue(!replayResult.has("deletedCount"));

        CatalogOwnerApi.Problem mismatchedReplay = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull(
                        "deleteOperationsCatalogCategory",
                        request.deepCopy()
                                .put("expectedVersion", root.path("version").asLong() + 1),
                        "delete-mismatch",
                        "delete-replay-key"));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatchedReplay.code());

        CatalogOwnerApi.Problem newKeyAfterDelete = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull("deleteOperationsCatalogCategory", request, "delete-new-key", "delete-new-key"));
        assertEquals("NOT_FOUND", newKeyAfterDelete.code());

        JsonNode stale = create("DELETE-STALE", "delete stale", null);
        JsonNode updated = write(
                "updateOperationsCatalogCategory",
                MAPPER.createObjectNode()
                        .put("categoryRef", stale.path("categoryRef").asText())
                        .put("expectedVersion", stale.path("version").asLong())
                        .put("name", "delete stale updated"));
        assertEquals(stale.path("version").asLong() + 1, updated.path("version").asLong());
        CatalogOwnerApi.Problem staleDelete = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull(
                        "deleteOperationsCatalogCategory",
                        MAPPER.createObjectNode()
                                .put("categoryRef", stale.path("categoryRef").asText())
                                .put("expectedVersion", stale.path("version").asLong()),
                        "delete-stale",
                        "delete-stale-key"));
        assertEquals("VERSION_CONFLICT", staleDelete.code());
    }

    @Test
    void catalogDetailReturnsInventoryOwnerConfigurationForTargetsAndBomComponents() {
        String itemCode = generatedCatalogCode("INVENTORY-CONFIG-DETAIL");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "inventory config detail")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID itemRef = UUID.fromString(created.path("resourceRef").asText());
        UUID componentItemRef = UUID.randomUUID();
        UUID itemTargetRef = UUID.randomUUID();
        UUID componentTargetRef = UUID.randomUUID();
        String itemConfiguration =
                "{\"mode\":\"INDEPENDENT_STOCK\",\"allowNegative\":false,\"lowStockThreshold\":\"1.5\",\"countingUnit\""
                        + ":\"BOX\",\"conversionFactor\":\"2\"}";
        String componentConfiguration =
                "{\"mode\":\"INDEPENDENT_STOCK\",\"allowNegative\":true,\"lowStockThreshold\":\"3.5\",\"countingUnit\":"
                        + "\"BOX\",\"conversionFactor\":\"2\"}";
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?, ?,CAST(? AS JSONB),0,1,1,1)",
                itemTargetRef,
                SCOPE.toString(),
                BRAND,
                itemRef,
                null,
                itemCode,
                null,
                "EA",
                itemConfiguration);
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?, ?,CAST(? AS JSONB),0,1,1,1)",
                componentTargetRef,
                SCOPE.toString(),
                BRAND,
                componentItemRef,
                null,
                "COMPONENT-01",
                null,
                "KG",
                componentConfiguration);
        String bomRows = "[{\"targetRef\":\"" + componentTargetRef
                + "\",\"quantity\":\"2\",\"unit\":\"KG\",\"lineSign\":\"POSITIVE\"}]";
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                itemRef,
                null,
                null,
                itemCode,
                null,
                null,
                1,
                bomRows,
                1);

        CatalogInventoryCoordinator coordinator = new CatalogInventoryCoordinator(
                service,
                inventory,
                production,
                mock(PlatformAssetService.class),
                MAPPER,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogScopeLookup.class));
        JsonNode nodes = coordinator
                .readCatalogItem(
                        SCOPE.toString(), BRAND, itemCode, MAPPER.createObjectNode(), "inventory-config-detail")
                .path("data")
                .path("item")
                .path("inventoryBom");

        assertEquals(2, nodes.size());
        JsonNode target = nodes.get(0);
        assertEquals(itemTargetRef.toString(), target.path("targetRef").asText());
        assertEquals("EA", target.path("consumptionUnit").asText());
        assertEquals(4, target.path("configuration").size());
        assertFalse(target.path("configuration").has("mode"));
        assertEquals(
                "1.5", target.path("configuration").path("lowStockThreshold").asText());
        assertEquals("BOX", target.path("configuration").path("countingUnit").asText());
        assertEquals("2", target.path("configuration").path("conversionFactor").asText());

        JsonNode component = nodes.get(1);
        assertEquals(componentTargetRef.toString(), component.path("targetRef").asText());
        assertEquals("KG", component.path("consumptionUnit").asText());
        assertEquals("2", component.path("quantity").asText());
        assertTrue(component.path("configuration").path("allowNegative").asBoolean());
        assertEquals(
                "3.5", component.path("configuration").path("lowStockThreshold").asText());
        assertEquals("BOX", component.path("configuration").path("countingUnit").asText());
        assertEquals(
                "2", component.path("configuration").path("conversionFactor").asText());
    }

    @Test
    void categoryOnlyCoordinatorSavePreservesExistingInventoryConfiguration() {
        String itemCode = generatedCatalogCode("BATCH-CATEGORY-INVENTORY");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "batch category inventory")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID itemRef = UUID.fromString(created.path("resourceRef").asText());
        UUID targetRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?, ?,CAST(? AS JSONB),0,1,1,1)",
                targetRef,
                SCOPE.toString(),
                BRAND,
                itemRef,
                null,
                itemCode,
                null,
                "EA",
                "{\"mode\":\"INDEPENDENT_STOCK\",\"allowNegative\":false,\"lowStockThreshold\":\"2\",\"countingUnit\":"
                        + "\"BOX\",\"conversionFactor\":\"1.5\"}");
        CatalogInventoryCoordinator coordinator = coordinatorForSave();
        JsonNode before = coordinator
                .readCatalogItem(SCOPE.toString(), BRAND, itemCode, MAPPER.createObjectNode(), "batch-category-before")
                .path("data")
                .path("item")
                .path("inventoryBom")
                .deepCopy();
        JsonNode category = create(generatedCatalogCode("BATCH-CATEGORY"), "批量分类", null);

        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode sections = request.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong());
        sections.putArray("expectedInventoryVersions");
        ObjectNode draft = sections.putObject("catalogDraft");
        draft.put("name", "batch category inventory").put("shapeKey", "STANDARD_SALE_COUNTED");
        draft.putObject("attributes");
        draft.putArray("images");
        draft.putArray("productionTagRefs");
        draft.putArray("categoryRefs").add(category.path("categoryRef").asText());
        sections.putObject("inventoryConfiguration").putArray("nodes");

        new TransactionTemplate(new DataSourceTransactionManager(dataSource()))
                .executeWithoutResult(status -> coordinator.saveCatalogItem(
                        context("saveOperationsCatalogItem", SCOPE, "batch-category-save"),
                        new CatalogOwnerApi.CatalogItemSaveCommand(itemCode, canonical(request)),
                        List.of(),
                        "batch-category-save-key"));

        JsonNode after = coordinator
                .readCatalogItem(SCOPE.toString(), BRAND, itemCode, MAPPER.createObjectNode(), "batch-category-after")
                .path("data")
                .path("item")
                .path("inventoryBom");
        assertEquals(before, after, "a category-only batch save must not retire or rewrite inventory facts");
        assertEquals(targetRef.toString(), after.get(0).path("targetRef").asText());
    }

    private static CatalogInventoryCoordinator coordinatorForSave() {
        PlatformAssetService assets = mock(PlatformAssetService.class);
        when(assets.settleCatalogSaveAssets(any(), any()))
                .thenReturn(new CatalogAssetCommandApi.SaveSettlementReadback(List.of(), List.of()));
        return new CatalogInventoryCoordinator(
                service,
                inventory,
                production,
                assets,
                MAPPER,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogScopeLookup.class));
    }

    @Test
    void catalogSaveReceiptRejectsAStaleReadbackAfterAnotherSaveButKeepsImmediateReplayAndMismatchRules() {
        String code = generatedCatalogCode("SAVE-RECEIPT");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", code)
                        .put("name", "receipt item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode original = MAPPER.createObjectNode().put("itemCode", code);
        original.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft")
                .put("shortName", "first");

        JsonNode first = writeFull("saveOperationsCatalogItem", original, "save-first", "save-replay-key");
        assertEquals(2L, first.path("result").path("version").asLong());
        JsonNode replay = writeFull("saveOperationsCatalogItem", original, "save-immediate-replay", "save-replay-key");
        assertEquals(4, replay.size());
        assertEquals(CatalogOwnerTypes.REVISION, replay.path("revision").asText());
        assertEquals("save-first", replay.path("requestId").asText());
        assertEquals(2L, replay.path("version").asLong());
        JsonNode replayResult = replay.path("result");
        assertEquals(5, replayResult.size());
        assertEquals("CATALOG_ITEM", replayResult.path("item").path("factType").asText());
        assertEquals(
                CatalogOwnerTypes.REVISION,
                replayResult.path("item").path("revision").asText());
        assertTrue(replayResult.path("inventoryBom").isArray());
        assertEquals(0, replayResult.path("inventoryBom").size());
        assertTrue(replayResult.path("productionTags").isArray());
        assertEquals(0, replayResult.path("productionTags").size());
        assertEquals(2L, replayResult.path("version").asLong());

        ObjectNode mismatched = original.deepCopy();
        ((ObjectNode) mismatched.path("sections").path("catalogDraft")).put("shortName", "different");
        CatalogOwnerApi.Problem mismatch = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull("saveOperationsCatalogItem", mismatched, "save-mismatch", "save-replay-key"));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatch.code());

        ObjectNode later = MAPPER.createObjectNode().put("itemCode", code);
        later.putObject("sections")
                .put("expectedCatalogVersion", 2L)
                .putObject("catalogDraft")
                .put("shortName", "later");
        JsonNode second = writeFull("saveOperationsCatalogItem", later, "save-later", "save-later-key");
        assertEquals(3L, second.path("result").path("version").asLong());

        CatalogOwnerApi.Problem staleReplay = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull("saveOperationsCatalogItem", original, "save-stale-replay", "save-replay-key"));
        assertEquals("VERSION_CONFLICT", staleReplay.code());
        assertEquals(
                3L,
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        code));
    }

    @Test
    void shortNameHasOneRelationalSourceOfTruthAndItsDeclaredIndexCanServeTheFilter() {
        String code = generatedCatalogCode("SHORT-NAME-INDEX");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", code)
                        .put("name", "short-name index item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", code);
        save.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft")
                .put("shortName", "short-name-index-needle");
        assertEquals(
                2L, write("saveOperationsCatalogItem", save).path("version").asLong());

        assertEquals(
                "short-name-index-needle",
                jdbc.queryForObject(
                        "SELECT short_name FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        String.class,
                        SCOPE.toString(),
                        BRAND,
                        code));
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'shortName') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                code));
        assertEquals(
                "short-name-index-needle",
                service.readItem(SCOPE.toString(), BRAND, code, "short-name-readback")
                        .path("data")
                        .path("item")
                        .path("shortName")
                        .asText());

        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,short_name,shape_key,status,attributes,sections,"
                        + "vers"
                        + "ion,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "SELECT md5('short-name-index-noise-' || value)::uuid, ?, ?, 'SHORT-NAME-NOISE-' || value, "
                        + "'noise name', 'noise short name', 'STANDARD_SALE_COUNTED', 'DRAFT', '{}'::jsonb, "
                        + "'{}'::jsonb, 1, 1, 1 FROM generate_series(1, 2000) AS value",
                SCOPE.toString(),
                BRAND);
        jdbc.execute("ANALYZE catalog.catalog_item");
        JsonNode page = service.readItems(
                        SCOPE.toString(),
                        BRAND,
                        MAPPER.createObjectNode().put("keyword", "short-name-index-needle"),
                        "short-name-page")
                .path("data");
        assertEquals(1L, page.path("total").asLong());
        assertEquals(code, page.path("items").get(0).path("code").asText());

        List<String> plan = jdbc.execute((ConnectionCallback<List<String>>) connection -> {
            try (var statement = connection.createStatement()) {
                // This is the same expression as the owner list query.  The structural
                // fixture distinguishes the indexed short-name branch without asserting
                // a timing budget.
                statement.execute("SET enable_seqscan = off");
                try (var result = statement.executeQuery(
                        "EXPLAIN (COSTS OFF) SELECT item_ref FROM catalog.catalog_item WHERE (name || chr(1) || "
                                + "COALESCE(short_name, '') || chr(1) || code) ILIKE '%short-name-index-needle%'")) {
                    List<String> lines = new java.util.ArrayList<>();
                    while (result.next()) lines.add(result.getString(1));
                    return lines;
                } finally {
                    statement.execute("RESET enable_seqscan");
                }
            }
        });
        assertTrue(
                String.join("\\n", plan).contains("ix_catalog_item_scope_short_name_trgm"), String.join("\\n", plan));
    }

    @Test
    void sameIdempotencyKeyOnOneDataNodeRejectsAnotherBrandsCatalogCommand() {
        String code = generatedCatalogCode("BRAND-RECEIPT");
        ObjectNode request = MAPPER.createObjectNode().put("code", code).put("name", "brand receipt category");
        String receiptKey = "catalog-brand-receipt-key-0001";

        JsonNode brandA = service.write(
                        context("createOperationsCatalogCategory", SCOPE, "BRAND-RECEIPT-A", "catalog-brand-a"),
                        request,
                        receiptKey)
                .path("result");
        CatalogOwnerApi.Problem brandB = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> service.write(
                        context("createOperationsCatalogCategory", SCOPE, "BRAND-RECEIPT-B", "catalog-brand-b"),
                        request.deepCopy(),
                        receiptKey));

        assertEquals(code, brandA.path("code").asText());
        assertEquals("IDEMPOTENCY_MISMATCH", brandB.code());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT count(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND "
                                + "code=?",
                        Integer.class,
                        SCOPE.toString(),
                        "BRAND-RECEIPT-A",
                        code));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? AND "
                                + "code=?",
                        Integer.class,
                        SCOPE.toString(),
                        "BRAND-RECEIPT-B",
                        code));
    }

    @Test
    void temporaryPromotionUsesTheCanonicalEnvelopeAndRejectsStaleOrNonTemporaryItems() {
        String temporaryCode = generatedCatalogCode("TEMP-PROMOTION");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", temporaryCode)
                        .put("name", "temporary item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        long createdVersion = created.path("version").asLong();
        ObjectNode temporarySave = MAPPER.createObjectNode().put("itemCode", temporaryCode);
        ObjectNode temporaryDraft = temporarySave
                .putObject("sections")
                .put("expectedCatalogVersion", createdVersion)
                .putObject("catalogDraft");
        temporaryDraft.put("source", "EXTERNAL_ORDER_TEMPORARY");
        temporaryDraft
                .putObject("externalIdentity")
                .put("sourceOrderRef", "ORDER-" + temporaryCode)
                .put("sourceRecordRef", "RECORD-" + temporaryCode)
                .put("sourceItemRef", "ITEM-" + temporaryCode);
        long sourceVersion = write("saveOperationsCatalogItem", temporarySave)
                .path("version")
                .asLong();

        ObjectNode preflightRequest = promotionRequest(temporaryCode, sourceVersion, generatedCatalogCode("FORMAL"));
        JsonNode preflight = writeFull(
                "preflightOperationsTemporaryCatalogItemPromotion",
                preflightRequest,
                "temporary-preflight",
                "temporary-preflight-key");
        assertEquals(
                temporaryCode, preflight.path("data").path("item").path("code").asText());
        assertEquals(sourceVersion, preflight.path("data").path("sourceVersion").asLong());
        assertTrue(preflight.path("data").path("canPromote").asBoolean());
        assertTrue(!preflight.path("data").has("data"));

        ObjectNode mutation = MAPPER.createObjectNode().put("itemCode", temporaryCode);
        mutation.putObject("sections")
                .put("expectedCatalogVersion", sourceVersion)
                .putObject("catalogDraft")
                .put("shortName", "changed after preflight");
        assertEquals(
                sourceVersion + 1,
                write("saveOperationsCatalogItem", mutation).path("version").asLong());
        ObjectNode staleExecute = preflightRequest
                .deepCopy()
                .put("expectedVersion", sourceVersion)
                .put(
                        "preflightDigest",
                        preflight.path("data").path("preflightDigest").asText());
        CatalogOwnerApi.Problem stale = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull(
                        "executeOperationsTemporaryCatalogItemPromotion",
                        staleExecute,
                        "temporary-stale-execute",
                        "temporary-stale-execute-key"));
        assertEquals("STALE_COPY_PREFLIGHT", stale.code());

        String normalCode = generatedCatalogCode("NORMAL-PROMOTION");
        JsonNode normal = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", normalCode)
                        .put("name", "normal item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        long normalVersion = normal.path("version").asLong();
        ObjectNode normalRequest = promotionRequest(normalCode, normalVersion, generatedCatalogCode("FORMAL"));
        JsonNode normalPreflight = writeFull(
                "preflightOperationsTemporaryCatalogItemPromotion",
                normalRequest,
                "normal-preflight",
                "normal-preflight-key");
        assertTrue(!normalPreflight.path("data").path("canPromote").asBoolean());
        CatalogOwnerApi.Problem nonTemporary = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull(
                        "executeOperationsTemporaryCatalogItemPromotion",
                        normalRequest
                                .deepCopy()
                                .put("expectedVersion", normalVersion)
                                .put(
                                        "preflightDigest",
                                        normalPreflight
                                                .path("data")
                                                .path("preflightDigest")
                                                .asText()),
                        "normal-execute",
                        "normal-execute-key"));
        assertEquals("VALIDATION_ERROR", nonTemporary.code());
    }

    @Test
    void successfulTemporaryPromotionVoidsTheSourceAndCreatesASelfManagedItemWithTraceableOrigin() {
        String temporaryCode = generatedCatalogCode("TEMP-PROMOTE-SOURCE");
        long createdVersion = write(
                        "createOperationsCatalogItem",
                        MAPPER.createObjectNode()
                                .put("code", temporaryCode)
                                .put("name", "temporary item")
                                .put("shapeKey", "STANDARD_SALE_COUNTED"))
                .path("version")
                .asLong();
        ObjectNode temporarySave = MAPPER.createObjectNode().put("itemCode", temporaryCode);
        temporarySave
                .putObject("sections")
                .put("expectedCatalogVersion", createdVersion)
                .putObject("catalogDraft")
                .put("source", "EXTERNAL_ORDER_TEMPORARY");
        long temporaryVersion = write("saveOperationsCatalogItem", temporarySave)
                .path("version")
                .asLong();
        UUID sourceSkuRef = UUID.randomUUID();
        UUID sourceSkuMediaRef = UUID.randomUUID();
        ObjectNode addSku = skuSave(temporaryCode, temporaryVersion, sourceSkuRef, "TEMP-PROMOTED-SKU");
        ((ObjectNode) addSku.path("sections").path("catalogDraft").path("skus").get(0))
                .putArray("mediaRefs")
                .add(sourceSkuMediaRef.toString());
        temporaryVersion =
                write("saveOperationsCatalogItem", addSku).path("version").asLong();

        // A formal code is business-owned text, not an uppercase technical identifier.
        // Exercise the whole preflight/execute/readback lifecycle with a value that the
        // former owner regex would have rejected.
        String formalCode = "promoted-" + UUID.randomUUID().toString().substring(0, 8);
        ObjectNode preflightRequest = promotionRequest(temporaryCode, temporaryVersion, formalCode);
        JsonNode preflight = writeFull(
                "preflightOperationsTemporaryCatalogItemPromotion",
                preflightRequest,
                "temporary-success-preflight",
                "temporary-success-preflight-key");
        ObjectNode execute = preflightRequest
                .deepCopy()
                .put("expectedVersion", temporaryVersion)
                .put(
                        "preflightDigest",
                        preflight.path("data").path("preflightDigest").asText());
        writeFull(
                "executeOperationsTemporaryCatalogItemPromotion",
                execute,
                "temporary-success-execute",
                "temporary-success-execute-key");

        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        String.class,
                        SCOPE.toString(),
                        BRAND,
                        temporaryCode));
        assertEquals(
                temporaryCode,
                jdbc.queryForObject(
                        "SELECT source_item_code FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND "
                                + "code=?",
                        String.class,
                        SCOPE.toString(),
                        BRAND,
                        formalCode));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=? "
                                + "AND source_scope_ref IS NOT NULL",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        formalCode));
        JsonNode promotedSku = service.readItem(SCOPE.toString(), BRAND, formalCode, "temporary-success-media-readback")
                .path("data")
                .path("item")
                .path("skus")
                .get(0);
        assertEquals("TEMP-PROMOTED-SKU", promotedSku.path("skuCode").asText());
        assertEquals(
                List.of(sourceSkuMediaRef.toString()),
                MAPPER.convertValue(
                        promotedSku.path("mediaRefs"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_media WHERE product_sku_ref=?",
                        Integer.class,
                        UUID.fromString(promotedSku.path("productSkuRef").asText())));
    }

    @Test
    void deleteIsBlockedByAnyReferencedDescendantAndSaveRejectsBusinessCodes() {
        JsonNode root = create("BLOCK-ROOT", "root", null);
        JsonNode child = create("BLOCK-CHILD", "child", root.path("categoryRef").asText());
        UUID blockingItemRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                blockingItemRef,
                SCOPE.toString(),
                BRAND,
                "BLOCKING-ITEM",
                "Blocking item");
        jdbc.update(
                "INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES (?,?)",
                blockingItemRef,
                UUID.fromString(child.path("categoryRef").asText()));

        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "deleteOperationsCatalogCategory",
                        MAPPER.createObjectNode()
                                .put("categoryRef", root.path("categoryRef").asText())
                                .put("expectedVersion", root.path("version").asLong())));
        assertEquals("REFERENCE_BLOCKS_DELETE", blocked.code());
        JsonNode rootNavigation =
                category(navigation(), root.path("categoryRef").asText());
        assertTrue(
                !rootNavigation.path("deletionAvailability").path("canDelete").asBoolean());
        assertEquals(
                1,
                rootNavigation
                        .path("deletionAvailability")
                        .path("blockingReferenceCount")
                        .asInt());
        assertEquals(
                "Blocking item",
                rootNavigation
                        .path("deletionAvailability")
                        .path("blockingReferenceLabels")
                        .get(0)
                        .asText());

        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", "REF-VALIDATION")
                        .put("name", "Ref validation")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "REF-VALIDATION");
        ObjectNode sections = save.putObject("sections")
                .put("expectedCatalogVersion", item.path("version").asLong());
        sections.putObject("catalogDraft").putArray("categoryRefs").add("BLOCK-CHILD");
        CatalogOwnerApi.Problem codeRejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", save));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", codeRejected.code());
    }

    @Test
    void categoryDeleteObservesACompletedSaveAsItsLinearizedReferenceState() {
        JsonNode category = create("SAVE-DELETE", "save-delete", null);
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", "SAVE-DELETE-ITEM")
                        .put("name", "save-delete item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SAVE-DELETE-ITEM");
        save.putObject("sections")
                .put("expectedCatalogVersion", item.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("categoryRefs")
                .add(category.path("categoryRef").asText());
        assertEquals(
                2L, write("saveOperationsCatalogItem", save).path("version").asLong());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'categoryRefs') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                "SAVE-DELETE-ITEM"));
        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "deleteOperationsCatalogCategory",
                        MAPPER.createObjectNode()
                                .put("categoryRef", category.path("categoryRef").asText())
                                .put("expectedVersion", category.path("version").asLong())));
        assertEquals("REFERENCE_BLOCKS_DELETE", blocked.code());
    }

    @Test
    void itemVoidObservesCompositeReferencesWrittenThroughTheOwner() {
        String componentCode = generatedCatalogCode("COMPOSITE-COMPONENT");
        JsonNode component = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", componentCode)
                        .put("name", "composite component")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        String ownerCode = generatedCatalogCode("COMPOSITE-OWNER");
        JsonNode owner = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", ownerCode)
                        .put("name", "composite owner")
                        .put("shapeKey", "COMPOSITE"));
        ArrayNode componentRefs =
                MAPPER.createArrayNode().add(component.path("resourceRef").asText());
        assertEquals(
                2L,
                write(
                                "saveOperationsCatalogItem",
                                compositeSave(ownerCode, owner.path("version").asLong(), "owner group", componentRefs))
                        .path("version")
                        .asLong());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'compositeGroups') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                ownerCode));

        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "transitionOperationsCatalogItemStatus",
                        MAPPER.createObjectNode()
                                .put("itemCode", componentCode)
                                .put(
                                        "expectedVersion",
                                        component.path("version").asLong())
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
    }

    @Test
    void declaredDictionaryPathsPersistOnlyScopedOpaqueRefs() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "TAG")
                        .put("code", "TAG-RED")
                        .put("name", "Red"));
        JsonNode entries = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "TAG",
                        MAPPER.createObjectNode().put("dictionaryKind", "TAG"),
                        "dictionary")
                .path("data")
                .path("entries");
        String tagRef = entries.get(0).path("entryRef").asText();
        assertTrue(UUID.fromString(tagRef).version() >= 0);
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", "TAGGED-ITEM")
                        .put("name", "Tagged item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "TAGGED-ITEM");
        ObjectNode sections = save.putObject("sections")
                .put("expectedCatalogVersion", item.path("version").asLong());
        sections.putObject("catalogDraft").putArray("tagRefs").add(tagRef);
        assertEquals(
                2L, write("saveOperationsCatalogItem", save).path("version").asLong());
    }

    @Test
    void dictionaryReferenceSnapshotKeepsPerEntryVoidAvailability() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "TAG")
                        .put("code", "SNAPSHOT-USED")
                        .put("name", "Snapshot used"));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "TAG")
                        .put("code", "SNAPSHOT-FREE")
                        .put("name", "Snapshot free"));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SALES_UNIT")
                        .put("code", "SNAPSHOT-UNIT-USED")
                        .put("name", "Snapshot unit used"));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SALES_UNIT")
                        .put("code", "SNAPSHOT-UNIT-FREE")
                        .put("name", "Snapshot unit free"));
        JsonNode before = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "TAG",
                        MAPPER.createObjectNode().put("dictionaryKind", "TAG"),
                        "dictionary-snapshot-before")
                .path("data")
                .path("entries");
        JsonNode unitsBefore = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "SALES_UNIT",
                        MAPPER.createObjectNode().put("dictionaryKind", "SALES_UNIT"),
                        "dictionary-unit-snapshot-before")
                .path("data")
                .path("entries");
        String usedRef =
                dictionaryEntry(before, "SNAPSHOT-USED").path("entryRef").asText();
        String usedUnitRef = dictionaryEntry(unitsBefore, "SNAPSHOT-UNIT-USED")
                .path("entryRef")
                .asText();
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", "SNAPSHOT-ITEM")
                        .put("name", "Snapshot item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SNAPSHOT-ITEM");
        ObjectNode draft = save.putObject("sections")
                .put("expectedCatalogVersion", item.path("version").asLong())
                .putObject("catalogDraft");
        draft.putArray("tagRefs").add(usedRef);
        draft.putArray("salesUnitRefs").add(usedUnitRef);
        write("saveOperationsCatalogItem", save);

        JsonNode entries = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "TAG",
                        MAPPER.createObjectNode().put("dictionaryKind", "TAG"),
                        "dictionary-snapshot-after")
                .path("data")
                .path("entries");
        JsonNode units = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "SALES_UNIT",
                        MAPPER.createObjectNode().put("dictionaryKind", "SALES_UNIT"),
                        "dictionary-unit-snapshot-after")
                .path("data")
                .path("entries");
        assertTrue(!dictionaryEntry(entries, "SNAPSHOT-USED")
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        assertTrue(dictionaryEntry(entries, "SNAPSHOT-FREE")
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        assertTrue(!dictionaryEntry(units, "SNAPSHOT-UNIT-USED")
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        assertTrue(dictionaryEntry(units, "SNAPSHOT-UNIT-FREE")
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "transitionOperationsCatalogDictionaryEntryStatus",
                        MAPPER.createObjectNode()
                                .put("dictionaryKind", "TAG")
                                .put("entryCode", "SNAPSHOT-USED")
                                .put("expectedVersion", 1)
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code(), blocked.getMessage());
        CatalogOwnerApi.Problem unitBlocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "transitionOperationsCatalogDictionaryEntryStatus",
                        MAPPER.createObjectNode()
                                .put("dictionaryKind", "SALES_UNIT")
                                .put("entryCode", "SNAPSHOT-UNIT-USED")
                                .put("expectedVersion", 1)
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", unitBlocked.code(), unitBlocked.getMessage());
    }

    @Test
    void productSkuRefCannotCrossTheDeclaredItemRelation() {
        UUID ownerItemRef = UUID.randomUUID(),
                currentItemRef = UUID.randomUUID(),
                ownerSkuRef = UUID.randomUUID(),
                mismatchedSkuRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)",
                ownerItemRef,
                SCOPE.toString(),
                BRAND,
                "SKU-OWNER",
                "SKU owner",
                "{\"skus\":[{\"productSkuRef\":\"" + ownerSkuRef + "\"}]}");
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                currentItemRef,
                SCOPE.toString(),
                BRAND,
                "SKU-CROSS",
                "SKU cross");
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SKU-CROSS");
        ObjectNode draft =
                save.putObject("sections").put("expectedCatalogVersion", 1).putObject("catalogDraft");
        draft.putArray("inventoryBom")
                .addObject()
                .put("itemRef", ownerItemRef.toString())
                .put("productSkuRef", mismatchedSkuRef.toString())
                .put("skuCode", "MISMATCHED");
        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", save));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", rejected.code());
    }

    @Test
    void suppliedProductSkuRefRequiresItsSkuCodeInsteadOfSilentlyBecomingAnItemRelation() {
        UUID currentItemRef = UUID.randomUUID(),
                referencedItemRef = UUID.randomUUID(),
                referencedSkuRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                currentItemRef,
                SCOPE.toString(),
                BRAND,
                "SKU-LINK-CURRENT",
                "current");
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                referencedItemRef,
                SCOPE.toString(),
                BRAND,
                "SKU-LINK-REF",
                "referenced");
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest) VALUES(?,?, 'LINK-SKU', 'linked SKU', true, 'ENABLED', 0, "
                        + "'link-sku')",
                referencedSkuRef,
                referencedItemRef);
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", "SKU-LINK-CURRENT");
        save.putObject("sections")
                .put("expectedCatalogVersion", 1)
                .putObject("catalogDraft")
                .putArray("inventoryBom")
                .addObject()
                .put("itemRef", referencedItemRef.toString())
                .put("productSkuRef", referencedSkuRef.toString());

        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", save));
        assertEquals("VALIDATION_ERROR", rejected.code());
        assertEquals("productSkuRef requires skuCode", rejected.getMessage());
    }

    @Test
    void localSkuStructureCopyMovesTheActualSkuFactInsteadOfSkippingIt() {
        String sourceCode = generatedCatalogCode("LOCAL-SKU-SOURCE");
        String targetCode = generatedCatalogCode("LOCAL-SKU-TARGET");
        JsonNode source = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", sourceCode)
                        .put("name", "local sku source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        JsonNode target = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", targetCode)
                        .put("name", "local sku target")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));

        ObjectNode sourceSave = MAPPER.createObjectNode().put("itemCode", sourceCode);
        ObjectNode sourceSku = sourceSave
                .putObject("sections")
                .put("expectedCatalogVersion", source.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("skus")
                .addObject();
        sourceSku
                .put("productSkuRef", UUID.randomUUID().toString())
                .put("skuCode", "LOCAL-SKU")
                .put("skuName", "Local SKU")
                .put("skuBarcode", "")
                .put("isDefault", true)
                .put("status", "ENABLED")
                .put("version", 0);
        sourceSku.putArray("attributeValueRefs");
        UUID sourceMedia = UUID.randomUUID();
        sourceSku.putArray("mediaRefs").add(sourceMedia.toString());
        JsonNode savedSource = write("saveOperationsCatalogItem", sourceSave);

        ObjectNode preflightRequest =
                MAPPER.createObjectNode().put("sourceItemCode", sourceCode).put("targetItemCode", targetCode);
        preflightRequest.putArray("selectedSections").add("SKU_STRUCTURE");
        JsonNode preflight = service.preflightCopy(
                context("preflightOperationsLocalCatalogCopy", SCOPE, "local-sku-preflight"), preflightRequest);
        ObjectNode executeRequest = preflightRequest
                .deepCopy()
                .put("preflightDigest", preflight.path("preflightDigest").asText())
                .put("expectedSourceVersion", savedSource.path("version").asLong())
                .put("expectedTargetVersion", target.path("version").asLong());
        executeRequest.set("compatibilityDispositions", confirmedCompatibilityDispositions(preflight));
        JsonNode executed = service.copy(
                        context("executeOperationsLocalCatalogCopy", SCOPE, "local-sku-execute"),
                        executeRequest,
                        "local-sku-copy-key")
                .path("data");

        JsonNode copied = service.readItem(SCOPE.toString(), BRAND, targetCode, "local-sku-readback")
                .path("data")
                .path("item")
                .path("skus");
        assertEquals(1, copied.size());
        assertEquals("LOCAL-SKU", copied.get(0).path("skuCode").asText());
        assertNotEquals(
                sourceSku.path("productSkuRef").asText(),
                copied.get(0).path("productSkuRef").asText());
        assertEquals(
                List.of(sourceMedia.toString()),
                MAPPER.convertValue(
                        copied.get(0).path("mediaRefs"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'skus') FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? "
                        + "AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                targetCode));
        for (String relationKey : List.of(
                "categoryRefs",
                "compositeGroups",
                "orderOptions",
                "skuVariantDimensions",
                "images",
                "productionTagRefs",
                "tagRefs",
                "salesUnitRefs")) {
            assertFalse(
                    jdbc.queryForObject(
                            "SELECT jsonb_exists(sections, ?) FROM catalog.catalog_item WHERE data_node_ref=? AND "
                                    + "brand_ref=? AND code=?",
                            Boolean.class,
                            relationKey,
                            SCOPE.toString(),
                            BRAND,
                            targetCode),
                    relationKey + " must remain relation-owned after local copy");
        }
        assertTrue(executed.path("skipped").isEmpty());
    }

    @Test
    void localPackageStructureCopyMovesCompositeGroupsFromTheirRelationRows() {
        String sourceCode = generatedCatalogCode("LOCAL-PACKAGE-SOURCE");
        String targetCode = generatedCatalogCode("LOCAL-PACKAGE-TARGET");
        JsonNode source = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", sourceCode)
                        .put("name", "local package source")
                        .put("shapeKey", "COMPOSITE"));
        JsonNode target = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", targetCode)
                        .put("name", "local package target")
                        .put("shapeKey", "COMPOSITE"));
        JsonNode savedSource = write(
                "saveOperationsCatalogItem",
                compositeSave(sourceCode, source.path("version").asLong(), "本地配菜", MAPPER.createArrayNode()));

        ObjectNode preflightRequest =
                MAPPER.createObjectNode().put("sourceItemCode", sourceCode).put("targetItemCode", targetCode);
        preflightRequest.putArray("selectedSections").add("PACKAGE_STRUCTURE");
        JsonNode preflight = service.preflightCopy(
                context("preflightOperationsLocalCatalogCopy", SCOPE, "local-package-preflight"), preflightRequest);
        ObjectNode executeRequest = preflightRequest
                .deepCopy()
                .put("preflightDigest", preflight.path("preflightDigest").asText())
                .put("expectedSourceVersion", savedSource.path("version").asLong())
                .put("expectedTargetVersion", target.path("version").asLong());
        executeRequest.set("compatibilityDispositions", confirmedCompatibilityDispositions(preflight));
        JsonNode executed = service.copy(
                        context("executeOperationsLocalCatalogCopy", SCOPE, "local-package-execute"),
                        executeRequest,
                        "local-package-copy-key")
                .path("data");

        JsonNode copied = service.readItem(SCOPE.toString(), BRAND, targetCode, "local-package-readback")
                .path("data")
                .path("item")
                .path("compositeGroups");
        assertEquals(1, copied.size());
        assertEquals("SIDE", copied.get(0).path("groupCode").asText());
        assertEquals("本地配菜", copied.get(0).path("groupName").asText());
        assertTrue(copied.get(0).path("components").isEmpty());
        assertTrue(executed.path("skipped").isEmpty());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'compositeGroups') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                targetCode));
    }

    @Test
    void emptySourceSkuStructureDoesNotArchiveTheTargetSkuFacts() {
        String sourceCode = generatedCatalogCode("LOCAL-EMPTY-SOURCE");
        String targetCode = generatedCatalogCode("LOCAL-EMPTY-TARGET");
        JsonNode source = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", sourceCode)
                        .put("name", "empty local source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        JsonNode target = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", targetCode)
                        .put("name", "populated local target")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID targetSkuRef = UUID.randomUUID();
        JsonNode savedTarget = write(
                "saveOperationsCatalogItem",
                skuSave(targetCode, target.path("version").asLong(), targetSkuRef, "TARGET-SKU"));

        ObjectNode request =
                MAPPER.createObjectNode().put("sourceItemCode", sourceCode).put("targetItemCode", targetCode);
        request.putArray("selectedSections").add("SKU_STRUCTURE");
        JsonNode preflight = service.preflightCopy(
                context("preflightOperationsLocalCatalogCopy", SCOPE, "local-empty-preflight"), request);
        ObjectNode executeRequest = request.deepCopy()
                .put("preflightDigest", preflight.path("preflightDigest").asText())
                .put("expectedSourceVersion", source.path("version").asLong())
                .put("expectedTargetVersion", savedTarget.path("version").asLong());
        executeRequest.set("compatibilityDispositions", confirmedCompatibilityDispositions(preflight));
        service.copy(
                context("executeOperationsLocalCatalogCopy", SCOPE, "local-empty-execute"),
                executeRequest,
                "local-empty-copy-key");

        JsonNode retained = service.readItem(SCOPE.toString(), BRAND, targetCode, "local-empty-target-readback")
                .path("data")
                .path("item")
                .path("skus");
        assertEquals(1, retained.size());
        assertEquals(
                targetSkuRef.toString(), retained.get(0).path("productSkuRef").asText());
        assertEquals("ENABLED", retained.get(0).path("status").asText());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku WHERE product_sku_ref=? AND status='ENABLED'",
                        Integer.class,
                        targetSkuRef));
    }

    @Test
    void anExistingSkuRefCannotBeReassignedToAnotherItem() {
        String sourceCode = generatedCatalogCode("SKU-REF-SOURCE");
        String targetCode = generatedCatalogCode("SKU-REF-TARGET");
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", sourceCode)
                        .put("name", "source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", targetCode)
                        .put("name", "target")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID sharedRef = UUID.randomUUID();
        write("saveOperationsCatalogItem", skuSave(sourceCode, 1, sharedRef, "SOURCE-SKU"));
        CatalogOwnerApi.Problem rejected = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write("saveOperationsCatalogItem", skuSave(targetCode, 1, sharedRef, "TARGET-SKU")));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", rejected.code());
        assertEquals(
                sourceCode,
                jdbc.queryForObject(
                        "SELECT item.code FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ON "
                                + "item.item_ref=sku.item_ref WHERE sku.product_sku_ref=?",
                        String.class,
                        sharedRef));
    }

    @Test
    void skuOwnershipValidationExecutesARefBoundLockQuery() {
        RecordingJdbcTemplate recordingJdbc = new RecordingJdbcTemplate(dataSource());
        InventoryOwnerService recordingInventory =
                new InventoryOwnerService(recordingJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        ProductionTagOwnerService recordingProduction =
                new ProductionTagOwnerService(recordingJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        CatalogOwnerService recordingService = new CatalogOwnerService(
                recordingJdbc,
                MAPPER,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                recordingProduction,
                recordingInventory);
        String itemCode = generatedCatalogCode("SKU-LOCK-SCOPE");
        JsonNode created = write(
                recordingService,
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "sku lock scope")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        recordingJdbc.clearRecordedSql();

        write(
                recordingService,
                "saveOperationsCatalogItem",
                skuSave(itemCode, created.path("version").asLong(), UUID.randomUUID(), "LOCKED-SKU"));

        String ownershipSql = recordingJdbc.recordedSql().stream()
                .filter(sql -> sql.contains("FROM catalog.catalog_sku sku JOIN catalog.catalog_item item"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing SKU ownership validation query"));
        assertTrue(ownershipSql.contains("sku.product_sku_ref IN (?)"), ownershipSql);
        assertTrue(ownershipSql.contains("FOR KEY SHARE OF sku,item"), ownershipSql);
        assertFalse(
                ownershipSql.matches("(?s).*brand_ref=\\? AND item.status <> 'VOIDED' FOR KEY SHARE.*"), ownershipSql);
    }

    @Test
    void skuDetailReadsAllInboundCompositeBlockersWithOneCollectionQuery() {
        String itemCode = generatedCatalogCode("SKU-INBOUND-BATCH");
        UUID itemRef = UUID.randomUUID();
        UUID ownerItemRef = UUID.randomUUID();
        UUID firstSkuRef = UUID.randomUUID();
        UUID secondSkuRef = UUID.randomUUID();
        UUID thirdSkuRef = UUID.randomUUID();
        insertQG10Item(itemRef, itemCode, "SKU inbound batch");
        insertQG10Item(ownerItemRef, generatedCatalogCode("SKU-INBOUND-OWNER"), "SKU inbound owner");
        insertQG10Sku(itemRef, firstSkuRef, "QG10-SKU-1", true, "qg10-digest-1");
        insertQG10Sku(itemRef, secondSkuRef, "QG10-SKU-2", false, "qg10-digest-2");
        insertQG10Sku(itemRef, thirdSkuRef, "QG10-SKU-3", false, "qg10-digest-3");
        UUID groupRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_composite_group(composite_group_ref,item_ref,group_code,group_name,"
                        + "selection_rule,min_selections,max_selections,display_order) "
                        + "VALUES(?,?,?,'配菜','OPTIONAL',0,3,0)",
                groupRef,
                ownerItemRef,
                "QG10-GROUP");
        insertQG10CompositeComponent(groupRef, itemRef, firstSkuRef, 0);
        insertQG10CompositeComponent(groupRef, itemRef, secondSkuRef, 1);

        RecordingJdbcTemplate recordingJdbc = new RecordingJdbcTemplate(dataSource());
        CatalogOwnerService recordingService = new CatalogOwnerService(
                recordingJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L, mock(CatalogAssetReferenceLock.class));
        JsonNode detail = recordingService
                .readItem(SCOPE.toString(), BRAND, itemCode, "qg10-sku-detail")
                .path("data")
                .path("item")
                .path("skus");

        assertEquals(3, detail.size());
        assertFalse(skuDetail(detail, firstSkuRef)
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        assertFalse(skuDetail(detail, secondSkuRef)
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        assertTrue(skuDetail(detail, thirdSkuRef)
                .path("voidAvailability")
                .path("canVoid")
                .asBoolean());
        assertEquals(
                1,
                recordingJdbc.recordedSql().stream()
                        .filter(sql -> sql.contains("product_sku_ref = ANY(?::uuid[])")
                                && sql.contains("catalog.catalog_composite_component"))
                        .count());
    }

    @Test
    void brandCopyWritesMappedSkuFactsWithoutRestoringTheJsonSourceOfTruth() {
        String sourceCode = generatedCatalogCode("BRAND-SKU-SOURCE");
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", sourceCode)
                        .put("name", "brand source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write("saveOperationsCatalogItem", skuSave(sourceCode, 1, UUID.randomUUID(), "BRAND-SKU"));
        ObjectNode selection = MAPPER.createObjectNode();
        selection.putArray("selectedItemCodes").add(sourceCode);
        JsonNode preflight = service.preflightCopy(
                copyContext("preflightOperationsBrandCatalogCopy", "brand-sku-preflight"), selection);
        ObjectNode execute = selection
                .deepCopy()
                .put("expectedSourceVersion", preflight.path("sourceVersion").asLong())
                .put("expectedTargetVersion", preflight.path("targetVersion").asLong())
                .put("preflightDigest", preflight.path("preflightDigest").asText());
        execute.set("referenceMappings", preflight.path("referenceMappings").deepCopy());
        execute.set("compatibilityDispositions", confirmedCompatibilityDispositions(preflight));
        service.copy(
                copyContext("executeOperationsBrandCatalogCopy", "brand-sku-execute"), execute, "brand-sku-copy-key");
        JsonNode target = service.readItem(COPY_TARGET_SCOPE.toString(), BRAND, sourceCode, "brand-sku-read")
                .path("data")
                .path("item");
        assertEquals("BRAND-SKU", target.path("skus").get(0).path("skuCode").asText());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'skus') FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? "
                        + "AND code=?",
                Boolean.class,
                COPY_TARGET_SCOPE.toString(),
                BRAND,
                sourceCode));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ON "
                                + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        COPY_TARGET_SCOPE.toString(),
                        BRAND,
                        sourceCode));
    }

    @Test
    void orderedMediaRelationsOwnImageAndSkuMediaFactsWithoutJsonDuplicates() {
        String itemCode = generatedCatalogCode("ORDERED-MEDIA");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "ordered media")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID itemFirst = UUID.randomUUID(),
                itemSecond = UUID.randomUUID(),
                skuFirst = UUID.randomUUID(),
                skuSecond = UUID.randomUUID(),
                skuRef = UUID.randomUUID();
        ObjectNode request = skuSave(itemCode, created.path("version").asLong(), skuRef, "MEDIA-SKU");
        ObjectNode draft = (ObjectNode) request.path("sections").path("catalogDraft");
        draft.putArray("images").add(itemFirst.toString()).add(itemSecond.toString());
        ((ObjectNode) draft.path("skus").get(0))
                .putArray("mediaRefs")
                .add(skuFirst.toString())
                .add(skuSecond.toString());

        assertEquals(
                2L, write("saveOperationsCatalogItem", request).path("version").asLong());
        JsonNode detail = service.readItem(SCOPE.toString(), BRAND, itemCode, "ordered-media-detail")
                .path("data")
                .path("item");
        assertEquals(
                List.of(itemFirst.toString(), itemSecond.toString()),
                MAPPER.convertValue(
                        detail.path("images"), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertEquals(
                List.of(skuFirst.toString(), skuSecond.toString()),
                MAPPER.convertValue(
                        detail.path("skus").get(0).path("mediaRefs"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        ObjectNode summaryRequest = MAPPER.createObjectNode();
        summaryRequest.putArray("itemCodes").add(itemCode);
        assertEquals(
                itemFirst.toString(),
                service.readItems(SCOPE.toString(), BRAND, summaryRequest, "ordered-media-summary")
                        .path("data")
                        .path("items")
                        .get(0)
                        .path("primaryImageAssetRef")
                        .asText());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'images') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                itemCode));
        assertEquals(
                2,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_item_image image JOIN catalog.catalog_item item ON "
                                + "item.item_ref=image.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                2,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_media WHERE product_sku_ref=?",
                        Integer.class,
                        skuRef));

        ObjectNode duplicate = skuSave(itemCode, 2L, skuRef, "MEDIA-SKU");
        ((ObjectNode) duplicate
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(0))
                .putArray("mediaRefs")
                .add(skuFirst.toString())
                .add(skuFirst.toString());
        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", duplicate));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", rejected.code());
        assertEquals(
                2,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_media WHERE product_sku_ref=?",
                        Integer.class,
                        skuRef));
    }

    @Test
    void compositeGroupWithNoComponentsSurvivesTheRelationalWriteAndRead() {
        String itemCode = generatedCatalogCode("EMPTY-COMPOSITE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "empty composite")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode group = request.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("compositeGroups")
                .addObject();
        group.put("groupCode", "SIDE")
                .put("groupName", "配菜")
                .put("selectionRule", "OPTIONAL")
                .put("minSelections", 0)
                .put("maxSelections", 2);
        group.putArray("components");

        assertEquals(
                2L, write("saveOperationsCatalogItem", request).path("version").asLong());
        JsonNode groups = service.readItem(SCOPE.toString(), BRAND, itemCode, "empty-composite-read")
                .path("data")
                .path("item")
                .path("compositeGroups");
        assertEquals(1, groups.size());
        assertEquals("SIDE", groups.get(0).path("groupCode").asText());
        assertEquals("配菜", groups.get(0).path("groupName").asText());
        assertTrue(groups.get(0).path("components").isEmpty());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_composite_group group_row JOIN catalog.catalog_item item "
                                + "ON item.item_ref=group_row.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? "
                                + "AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_composite_component component JOIN "
                                + "catalog.catalog_composite_group group_row ON "
                                + "group_row.composite_group_ref=component.composite_group_ref JOIN "
                                + "catalog.catalog_item "
                                + "item ON item.item_ref=group_row.item_ref WHERE item.data_node_ref=? AND "
                                + "item.brand_ref=? AND item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'compositeGroups') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                itemCode));
    }

    @Test
    void renamingACompositeGroupPreservesItsFiveComponentRows() {
        ArrayNode componentRefs = MAPPER.createArrayNode();
        for (int index = 0; index < 5; index++) {
            String componentCode = generatedCatalogCode("COMPONENT-" + index);
            JsonNode component = write(
                    "createOperationsCatalogItem",
                    MAPPER.createObjectNode()
                            .put("code", componentCode)
                            .put("name", componentCode)
                            .put("shapeKey", "STANDARD_SALE_COUNTED"));
            componentRefs.add(component.path("resourceRef").asText());
        }
        String parentCode = generatedCatalogCode("COMPOSITE-PARENT");
        JsonNode parent = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", parentCode)
                        .put("name", "composite parent")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode first = compositeSave(parentCode, parent.path("version").asLong(), "配菜", componentRefs);
        assertEquals(
                2L, write("saveOperationsCatalogItem", first).path("version").asLong());
        List<UUID> before = jdbc.query(
                "SELECT component.composite_component_ref FROM catalog.catalog_composite_component component JOIN "
                        + "catalog.catalog_composite_group group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item item "
                        + "ON "
                        + "item.item_ref=group_row.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.code=? ORDER BY component.display_order",
                (rows, index) -> rows.getObject(1, UUID.class),
                SCOPE.toString(),
                BRAND,
                parentCode);
        assertEquals(5, before.size());

        ObjectNode renamed = compositeSave(parentCode, 2L, "新配菜", componentRefs);
        assertEquals(
                3L, write("saveOperationsCatalogItem", renamed).path("version").asLong());
        List<UUID> after = jdbc.query(
                "SELECT component.composite_component_ref FROM catalog.catalog_composite_component component JOIN "
                        + "catalog.catalog_composite_group group_row ON "
                        + "group_row.composite_group_ref=component.composite_group_ref JOIN catalog.catalog_item item "
                        + "ON "
                        + "item.item_ref=group_row.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.code=? ORDER BY component.display_order",
                (rows, index) -> rows.getObject(1, UUID.class),
                SCOPE.toString(),
                BRAND,
                parentCode);
        assertEquals(before, after);
        JsonNode group = service.readItem(SCOPE.toString(), BRAND, parentCode, "composite-renamed")
                .path("data")
                .path("item")
                .path("compositeGroups")
                .get(0);
        assertEquals("新配菜", group.path("groupName").asText());
        assertEquals(5, group.path("components").size());
    }

    @Test
    void skuAttributeValuesReadTheirCurrentDictionaryLabelAndRejectDuplicateAttributes() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "TASTE")
                        .put("name", "口味"));
        JsonNode attribute = dictionaryEntry(
                service.readDictionary(
                                SCOPE.toString(), BRAND, "SKU_ATTRIBUTE", MAPPER.createObjectNode(), "sku-attribute")
                        .path("data")
                        .path("entries"),
                "TASTE");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "SWEET")
                        .put("name", "甜")
                        .put("parentEntryRef", attribute.path("entryRef").asText()));
        JsonNode value = dictionaryEntry(
                service.readDictionary(
                                SCOPE.toString(),
                                BRAND,
                                "SKU_ATTRIBUTE_VALUE",
                                MAPPER.createObjectNode(),
                                "sku-attribute-value")
                        .path("data")
                        .path("entries"),
                "SWEET");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "SOUR")
                        .put("name", "酸")
                        .put("parentEntryRef", attribute.path("entryRef").asText()));
        JsonNode outsideValue = dictionaryEntry(
                service.readDictionary(
                                SCOPE.toString(),
                                BRAND,
                                "SKU_ATTRIBUTE_VALUE",
                                MAPPER.createObjectNode(),
                                "sku-attribute-value-outside")
                        .path("data")
                        .path("entries"),
                "SOUR");
        String itemCode = generatedCatalogCode("SKU-LABEL");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "sku label")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID skuRef = UUID.randomUUID();
        ObjectNode save = skuSave(itemCode, item.path("version").asLong(), skuRef, "SWEET-SKU");
        ((ObjectNode) save.path("sections").path("catalogDraft"))
                .set(
                        "skuVariantDimensions",
                        variantAxis(
                                attribute.path("entryRef").asText(),
                                value.path("entryRef").asText()));
        ObjectNode savedSku = (ObjectNode)
                save.path("sections").path("catalogDraft").path("skus").get(0);
        ObjectNode relation = savedSku.putArray("attributeValueRefs").addObject();
        relation.put("attributeRef", attribute.path("entryRef").asText())
                .put("attributeValueRef", value.path("entryRef").asText());
        assertEquals(
                2L, write("saveOperationsCatalogItem", save).path("version").asLong());
        assertEquals(
                "甜",
                service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-label-before")
                        .path("data")
                        .path("item")
                        .path("skus")
                        .get(0)
                        .path("attributeValueRefs")
                        .get(0)
                        .path("valueLabel")
                        .asText());
        JsonNode persistedAxes = service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-axis-before")
                .path("data")
                .path("item")
                .path("skuVariantDimensions");
        assertEquals(
                attribute.path("entryRef").asText(),
                persistedAxes.get(0).path("attributeRef").asText());
        assertEquals(
                value.path("entryRef").asText(),
                persistedAxes.get(0).path("values").get(0).path("valueRef").asText());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'skuVariantDimensions') FROM catalog.catalog_item WHERE data_node_ref=? "
                        + "AND brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                itemCode));

        assertEquals(
                2L,
                write(
                                "updateOperationsCatalogDictionaryEntry",
                                MAPPER.createObjectNode()
                                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                                        .put("entryCode", "SWEET")
                                        .put("expectedVersion", 1)
                                        .put("name", "微甜"))
                        .path("version")
                        .asLong());
        assertEquals(
                "微甜",
                service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-label-after")
                        .path("data")
                        .path("item")
                        .path("skus")
                        .get(0)
                        .path("attributeValueRefs")
                        .get(0)
                        .path("valueLabel")
                        .asText());
        assertEquals(
                2L,
                write(
                                "updateOperationsCatalogDictionaryEntry",
                                MAPPER.createObjectNode()
                                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                                        .put("entryCode", "TASTE")
                                        .put("expectedVersion", 1)
                                        .put("name", "口感"))
                        .path("version")
                        .asLong());
        JsonNode renamedAttributeDetail = service.readItem(
                        SCOPE.toString(), BRAND, itemCode, "sku-attribute-name-after")
                .path("data")
                .path("item");
        assertEquals(
                "口感",
                renamedAttributeDetail
                        .path("skuSummary")
                        .path("dimensions")
                        .get(0)
                        .asText());
        ObjectNode dimensionListRequest = MAPPER.createObjectNode();
        dimensionListRequest.putArray("itemCodes").add(itemCode);
        assertEquals(
                "口感",
                service.readItems(SCOPE.toString(), BRAND, dimensionListRequest, "sku-attribute-name-summary")
                        .path("data")
                        .path("items")
                        .get(0)
                        .path("skuDimensionSummary")
                        .get(0)
                        .asText());

        ObjectNode outsideAxis = skuSave(itemCode, 2L, skuRef, "SWEET-SKU");
        ((ObjectNode) outsideAxis.path("sections").path("catalogDraft"))
                .set(
                        "skuVariantDimensions",
                        variantAxis(
                                attribute.path("entryRef").asText(),
                                value.path("entryRef").asText()));
        ((ObjectNode) outsideAxis
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(0))
                .putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attribute.path("entryRef").asText())
                .put("attributeValueRef", outsideValue.path("entryRef").asText());
        CatalogOwnerApi.Problem outsideRejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", outsideAxis));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", outsideRejected.code());
        assertEquals(
                value.path("entryRef").asText(),
                jdbc.queryForObject(
                                "SELECT attribute_value_ref FROM catalog.catalog_sku_attribute_value WHERE "
                                        + "product_sku_ref=? AND attribute_ref=?",
                                UUID.class,
                                skuRef,
                                UUID.fromString(attribute.path("entryRef").asText()))
                        .toString());

        ObjectNode duplicate = skuSave(itemCode, 2L, skuRef, "SWEET-SKU");
        ((ObjectNode) duplicate.path("sections").path("catalogDraft"))
                .set(
                        "skuVariantDimensions",
                        variantAxis(
                                attribute.path("entryRef").asText(),
                                value.path("entryRef").asText()));
        ObjectNode duplicateSku = (ObjectNode)
                duplicate.path("sections").path("catalogDraft").path("skus").get(0);
        ArrayNode duplicateValues = duplicateSku.putArray("attributeValueRefs");
        duplicateValues
                .addObject()
                .put("attributeRef", attribute.path("entryRef").asText())
                .put("attributeValueRef", value.path("entryRef").asText());
        duplicateValues
                .addObject()
                .put("attributeRef", attribute.path("entryRef").asText())
                .put("attributeValueRef", value.path("entryRef").asText());
        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", duplicate));
        assertEquals("VALIDATION_ERROR", rejected.code());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku_attribute_value WHERE product_sku_ref=? AND "
                                + "attribute_ref=?",
                        Integer.class,
                        skuRef,
                        UUID.fromString(attribute.path("entryRef").asText())));
    }

    @Test
    void requiredMatrixRejectsDuplicateOrPartialActiveSkuCombinationsBeforeAnyWrite() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "MATRIX-TASTE")
                        .put("name", "口味"));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "MATRIX-SIZE")
                        .put("name", "规格"));
        JsonNode attributes = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE", MAPPER.createObjectNode(), "matrix-attributes")
                .path("data")
                .path("entries");
        String tasteRef =
                dictionaryEntry(attributes, "MATRIX-TASTE").path("entryRef").asText();
        String sizeRef =
                dictionaryEntry(attributes, "MATRIX-SIZE").path("entryRef").asText();
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "MATRIX-SWEET")
                        .put("name", "甜")
                        .put("parentEntryRef", tasteRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "MATRIX-LARGE")
                        .put("name", "大杯")
                        .put("parentEntryRef", sizeRef));
        JsonNode values = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE_VALUE", MAPPER.createObjectNode(), "matrix-values")
                .path("data")
                .path("entries");
        String sweetRef =
                dictionaryEntry(values, "MATRIX-SWEET").path("entryRef").asText();
        String largeRef =
                dictionaryEntry(values, "MATRIX-LARGE").path("entryRef").asText();
        String itemCode = generatedCatalogCode("REQUIRED-MATRIX");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "required matrix")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));

        ObjectNode duplicateRequest =
                matrixSave(itemCode, item.path("version").asLong(), tasteRef, sweetRef, sizeRef, largeRef);
        ArrayNode duplicateSkus = (ArrayNode)
                duplicateRequest.path("sections").path("catalogDraft").path("skus");
        duplicateSkus.add(duplicateSkus.get(0).deepCopy());
        ((ObjectNode) duplicateSkus.get(1))
                .put("productSkuRef", UUID.randomUUID().toString())
                .put("skuCode", "MATRIX-DUPLICATE")
                .put("isDefault", false)
                .put("displayOrder", 1);
        CatalogOwnerApi.Problem duplicate =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", duplicateRequest));
        assertEquals("DUPLICATE_VARIANT_COMBINATION", duplicate.code());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ON "
                                + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));

        ObjectNode partialRequest = matrixSave(itemCode, 1L, tasteRef, sweetRef, sizeRef, largeRef);
        ((ObjectNode) partialRequest
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(0))
                .set(
                        "attributeValueRefs",
                        MAPPER.createArrayNode()
                                .addObject()
                                .put("attributeRef", tasteRef)
                                .put("attributeValueRef", sweetRef));
        CatalogOwnerApi.Problem partial =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", partialRequest));
        assertEquals("VALIDATION_ERROR", partial.code());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku sku JOIN catalog.catalog_item item ON "
                                + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                                + "item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                1L,
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
    }

    @Test
    void reEnablingAnArchivedSkuThatCollidesWithItsReplacementIsTypedAndLeavesBothRowsUntouched() {
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "REENABLE-ATTRIBUTE")
                        .put("name", "温度"));
        JsonNode attribute = dictionaryEntry(
                service.readDictionary(
                                SCOPE.toString(),
                                BRAND,
                                "SKU_ATTRIBUTE",
                                MAPPER.createObjectNode(),
                                "reenable-attribute")
                        .path("data")
                        .path("entries"),
                "REENABLE-ATTRIBUTE");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "REENABLE-VALUE")
                        .put("name", "热")
                        .put("parentEntryRef", attribute.path("entryRef").asText()));
        JsonNode value = dictionaryEntry(
                service.readDictionary(
                                SCOPE.toString(),
                                BRAND,
                                "SKU_ATTRIBUTE_VALUE",
                                MAPPER.createObjectNode(),
                                "reenable-value")
                        .path("data")
                        .path("entries"),
                "REENABLE-VALUE");
        String itemCode = generatedCatalogCode("REENABLE-MATRIX");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "reenable matrix")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID archivedSkuRef = UUID.randomUUID();
        UUID replacementSkuRef = UUID.randomUUID();

        ObjectNode first = matrixSave(
                itemCode,
                item.path("version").asLong(),
                attribute.path("entryRef").asText(),
                value.path("entryRef").asText(),
                null,
                null);
        ((ObjectNode) first.path("sections").path("catalogDraft").path("skus").get(0))
                .put("productSkuRef", archivedSkuRef.toString())
                .put("skuCode", "REENABLE-A");
        JsonNode archivedSource = write("saveOperationsCatalogItem", first);

        ObjectNode replacement = matrixSave(
                itemCode,
                archivedSource.path("version").asLong(),
                attribute.path("entryRef").asText(),
                value.path("entryRef").asText(),
                null,
                null);
        ((ObjectNode) replacement
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(0))
                .put("productSkuRef", replacementSkuRef.toString())
                .put("skuCode", "REENABLE-B");
        JsonNode replacementSaved = write("saveOperationsCatalogItem", replacement);
        assertEquals(
                "ARCHIVED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?",
                        String.class,
                        archivedSkuRef));
        assertEquals(
                "ENABLED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?",
                        String.class,
                        replacementSkuRef));

        ObjectNode reenable = matrixSave(
                itemCode,
                replacementSaved.path("version").asLong(),
                attribute.path("entryRef").asText(),
                value.path("entryRef").asText(),
                null,
                null);
        ArrayNode reenableSkus =
                (ArrayNode) reenable.path("sections").path("catalogDraft").path("skus");
        ((ObjectNode) reenableSkus.get(0))
                .put("productSkuRef", archivedSkuRef.toString())
                .put("skuCode", "REENABLE-A")
                .put("isDefault", true)
                .put("displayOrder", 0);
        ObjectNode activeReplacement = reenableSkus.addObject();
        activeReplacement
                .put("productSkuRef", replacementSkuRef.toString())
                .put("skuCode", "REENABLE-B")
                .put("skuName", "REENABLE-B")
                .put("isDefault", false)
                .put("status", "ENABLED")
                .put("displayOrder", 1);
        activeReplacement
                .putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attribute.path("entryRef").asText())
                .put("attributeValueRef", value.path("entryRef").asText());
        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", reenable));
        assertEquals("DUPLICATE_VARIANT_COMBINATION", rejected.code());
        assertEquals(
                "ARCHIVED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?",
                        String.class,
                        archivedSkuRef));
        assertEquals(
                "ENABLED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?",
                        String.class,
                        replacementSkuRef));
        assertEquals(
                replacementSaved.path("version").asLong(),
                jdbc.queryForObject(
                        "SELECT version FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Long.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
    }

    @Test
    void databaseVariantDigestConflictIsTranslatedToTheTypedCombinationProblem() {
        UUID itemRef = UUID.randomUUID();
        UUID existingSkuRef = UUID.randomUUID();
        UUID competingSkuRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'SKU_VARIANT_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                itemRef,
                SCOPE.toString(),
                BRAND,
                generatedCatalogCode("DIGEST-UNIQUE"),
                "digest unique");
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest) VALUES(?,?, 'DIGEST-EXISTING', 'digest existing', true, "
                        + "'ENABLED', "
                        + "0, 'same-combination')",
                existingSkuRef,
                itemRef);

        ArrayNode competing = MAPPER.createArrayNode();
        competing
                .addObject()
                .put("productSkuRef", competingSkuRef.toString())
                .put("skuCode", "DIGEST-COMPETING")
                .put("skuName", "digest competing")
                .put("isDefault", false)
                .put("status", "ENABLED")
                .put("displayOrder", 1)
                .put("variantCombinationDigest", "same-combination");

        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> new CatalogSkuFacts(jdbc, MAPPER)
                        .replace(itemRef, competing, java.util.Set.of()));
        assertEquals("DUPLICATE_VARIANT_COMBINATION", rejected.code());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku WHERE item_ref=? AND status <> 'ARCHIVED'",
                        Integer.class,
                        itemRef));
        assertEquals(
                existingSkuRef,
                jdbc.queryForObject(
                        "SELECT product_sku_ref FROM catalog.catalog_sku WHERE item_ref=?", UUID.class, itemRef));
    }

    private static ArrayNode variantAxis(String attributeRef, String valueRef) {
        ArrayNode axes = MAPPER.createArrayNode();
        axes.addObject()
                .put("attributeRef", attributeRef)
                .putArray("values")
                .addObject()
                .put("valueRef", valueRef);
        return axes;
    }

    private static ObjectNode matrixSave(
            String itemCode,
            long expectedVersion,
            String firstAttributeRef,
            String firstValueRef,
            String secondAttributeRef,
            String secondValueRef) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = request.putObject("sections")
                .put("expectedCatalogVersion", expectedVersion)
                .putObject("catalogDraft");
        ArrayNode axes = draft.putArray("skuVariantDimensions");
        axes.addObject()
                .put("attributeRef", firstAttributeRef)
                .putArray("values")
                .addObject()
                .put("valueRef", firstValueRef)
                .put("displayOrder", 0);
        if (secondAttributeRef != null)
            axes.addObject()
                    .put("attributeRef", secondAttributeRef)
                    .putArray("values")
                    .addObject()
                    .put("valueRef", secondValueRef)
                    .put("displayOrder", 0);
        ObjectNode sku = draft.putArray("skus").addObject();
        sku.put("productSkuRef", UUID.randomUUID().toString())
                .put("skuCode", "MATRIX-ONE")
                .put("skuName", "矩阵一")
                .put("isDefault", true)
                .put("status", "ENABLED")
                .put("displayOrder", 0);
        ArrayNode values = sku.putArray("attributeValueRefs");
        values.addObject().put("attributeRef", firstAttributeRef).put("attributeValueRef", firstValueRef);
        if (secondAttributeRef != null)
            values.addObject().put("attributeRef", secondAttributeRef).put("attributeValueRef", secondValueRef);
        return request;
    }

    @Test
    void orderOptionGroupsKeepNestedDictionaryOwnershipAcrossReorderAndDeletion() {
        List<String> codes = List.of("OPT-SPICY", "OPT-MILD", "OPT-COLD", "OPT-HOT");
        for (String code : codes)
            write(
                    "createOperationsCatalogDictionaryEntry",
                    MAPPER.createObjectNode()
                            .put("dictionaryKind", "ORDER_OPTION_VALUE")
                            .put("code", code)
                            .put("name", code));
        JsonNode entries = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "ORDER_OPTION_VALUE",
                        MAPPER.createObjectNode(),
                        "order-option-dictionaries")
                .path("data")
                .path("entries");
        String spicy = dictionaryEntry(entries, "OPT-SPICY").path("entryRef").asText();
        String mild = dictionaryEntry(entries, "OPT-MILD").path("entryRef").asText();
        String cold = dictionaryEntry(entries, "OPT-COLD").path("entryRef").asText();
        String hot = dictionaryEntry(entries, "OPT-HOT").path("entryRef").asText();
        String itemCode = generatedCatalogCode("ORDER-OPTION");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "nested options")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ArrayNode groups = MAPPER.createArrayNode();
        groups.add(orderOptionGroup("TASTE", "口味", "SPICY", spicy, "MILD", mild));
        groups.add(orderOptionGroup("TEMPERATURE", "温度", "COLD", cold, "HOT", hot));
        assertEquals(
                2L,
                write(
                                "saveOperationsCatalogItem",
                                orderOptionSave(itemCode, item.path("version").asLong(), groups))
                        .path("version")
                        .asLong());
        List<UUID> groupsBefore = jdbc.query(
                "SELECT order_option_group_ref FROM catalog.catalog_order_option_group group_row JOIN "
                        + "catalog.catalog_item item ON item.item_ref=group_row.item_ref WHERE item.data_node_ref=? "
                        + "AND "
                        + "item.brand_ref=? AND item.code=? ORDER BY group_row.group_code",
                (rows, index) -> rows.getObject(1, UUID.class),
                SCOPE.toString(),
                BRAND,
                itemCode);
        List<UUID> valuesBefore = jdbc.query(
                "SELECT value_row.order_option_value_ref FROM catalog.catalog_order_option_value value_row JOIN "
                        + "catalog.catalog_order_option_group group_row ON "
                        + "group_row.order_option_group_ref=value_row.order_option_group_ref JOIN catalog.catalog_item "
                        + "item ON item.item_ref=group_row.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? "
                        + "AND "
                        + "item.code=? ORDER BY group_row.group_code,value_row.value_code",
                (rows, index) -> rows.getObject(1, UUID.class),
                SCOPE.toString(),
                BRAND,
                itemCode);

        ArrayNode reordered = MAPPER.createArrayNode();
        reordered.add(groups.get(1).deepCopy());
        reordered.add(groups.get(0).deepCopy());
        assertEquals(
                3L,
                write("saveOperationsCatalogItem", orderOptionSave(itemCode, 2L, reordered))
                        .path("version")
                        .asLong());
        JsonNode afterReorder = service.readItem(SCOPE.toString(), BRAND, itemCode, "order-option-reordered")
                .path("data")
                .path("item")
                .path("orderOptions");
        assertEquals("TEMPERATURE", afterReorder.get(0).path("groupCode").asText());
        assertEquals(
                cold,
                afterReorder
                        .get(0)
                        .path("values")
                        .get(0)
                        .path("attributeValueRef")
                        .asText());
        assertEquals(
                spicy,
                afterReorder
                        .get(1)
                        .path("values")
                        .get(0)
                        .path("attributeValueRef")
                        .asText());
        assertEquals(
                groupsBefore,
                jdbc.query(
                        "SELECT order_option_group_ref FROM catalog.catalog_order_option_group group_row JOIN "
                                + "catalog.catalog_item item ON item.item_ref=group_row.item_ref WHERE "
                                + "item.data_node_ref=? AND item.brand_ref=? AND item.code=? ORDER BY "
                                + "group_row.group_code",
                        (rows, index) -> rows.getObject(1, UUID.class),
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertEquals(
                valuesBefore,
                jdbc.query(
                        "SELECT value_row.order_option_value_ref FROM catalog.catalog_order_option_value value_row "
                                + "JOIN catalog.catalog_order_option_group group_row ON "
                                + "group_row.order_option_group_ref=value_row.order_option_group_ref JOIN "
                                + "catalog.catalog_item item ON item.item_ref=group_row.item_ref WHERE "
                                + "item.data_node_ref=? AND item.brand_ref=? AND item.code=? ORDER BY "
                                + "group_row.group_code,value_row.value_code",
                        (rows, index) -> rows.getObject(1, UUID.class),
                        SCOPE.toString(),
                        BRAND,
                        itemCode));

        ArrayNode retained = MAPPER.createArrayNode().add(reordered.get(0).deepCopy());
        assertEquals(
                4L,
                write("saveOperationsCatalogItem", orderOptionSave(itemCode, 3L, retained))
                        .path("version")
                        .asLong());
        JsonNode afterDeletion = service.readItem(SCOPE.toString(), BRAND, itemCode, "order-option-deleted")
                .path("data")
                .path("item")
                .path("orderOptions");
        assertEquals(1, afterDeletion.size());
        assertEquals("TEMPERATURE", afterDeletion.get(0).path("groupCode").asText());
        assertEquals(2, afterDeletion.get(0).path("values").size());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_order_option_group group_row JOIN catalog.catalog_item "
                                + "item ON item.item_ref=group_row.item_ref WHERE item.data_node_ref=? AND "
                                + "item.brand_ref=? AND item.code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        itemCode));
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'orderOptions') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                itemCode));
    }

    @Test
    void dictionaryVoidNamesTheOrderOptionGroupAndValueThatStillReferenceIt() {
        String dictionaryCode = generatedCatalogCode("OPTION-GUARD");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "ORDER_OPTION_VALUE")
                        .put("code", dictionaryCode)
                        .put("name", "守卫值"));
        String valueRef = dictionaryEntry(
                        service.readDictionary(
                                        SCOPE.toString(),
                                        BRAND,
                                        "ORDER_OPTION_VALUE",
                                        MAPPER.createObjectNode(),
                                        "order-option-guard-dictionary")
                                .path("data")
                                .path("entries"),
                        dictionaryCode)
                .path("entryRef")
                .asText();
        String itemCode = generatedCatalogCode("OPTION-GUARD-ITEM");
        JsonNode item = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "guard item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ArrayNode groups =
                MAPPER.createArrayNode().add(orderOptionGroup("SAUCE", "酱料", "GUARD-VALUE", valueRef, null, null));
        write(
                "saveOperationsCatalogItem",
                orderOptionSave(itemCode, item.path("version").asLong(), groups));

        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "transitionOperationsCatalogDictionaryEntryStatus",
                        MAPPER.createObjectNode()
                                .put("dictionaryKind", "ORDER_OPTION_VALUE")
                                .put("entryCode", dictionaryCode)
                                .put("expectedVersion", 1)
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
        assertTrue(blocked.getMessage().contains(itemCode));
        assertTrue(blocked.getMessage().contains("SAUCE"));
        assertTrue(blocked.getMessage().contains("GUARD-VALUE"));
    }

    /**
     * An option value can be referenced solely by Inventory's BOM owner. Catalog must ask that owner before voiding it;
     * catalog-local JSON/relations deliberately contain no such row.
     */
    @Test
    void dictionaryVoidRejectsAnOptionValueStillReferencedOnlyByInventoryBom() {
        String dictionaryCode = generatedCatalogCode("BOM-OPTION-GUARD");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "ORDER_OPTION_VALUE")
                        .put("code", dictionaryCode)
                        .put("name", "BOM 守卫值"));
        UUID optionValueRef = UUID.fromString(dictionaryEntry(
                        service.readDictionary(
                                        SCOPE.toString(),
                                        BRAND,
                                        "ORDER_OPTION_VALUE",
                                        MAPPER.createObjectNode(),
                                        "bom-option-guard-dictionary")
                                .path("data")
                                .path("entries"),
                        dictionaryCode)
                .path("entryRef")
                .asText());

        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,1,'[]'::jsonb,1)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                UUID.randomUUID(),
                null,
                optionValueRef,
                "BOM-OWNER",
                null,
                dictionaryCode);

        CatalogOwnerApi.Problem blocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "transitionOperationsCatalogDictionaryEntryStatus",
                        MAPPER.createObjectNode()
                                .put("dictionaryKind", "ORDER_OPTION_VALUE")
                                .put("entryCode", dictionaryCode)
                                .put("expectedVersion", 1)
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
        assertTrue(blocked.getMessage().contains("BOM"));
        assertFalse(blocked.getMessage().contains("stock_bom"));
        assertFalse(blocked.getMessage().contains("option_value_ref"));
        assertEquals(
                "ENABLED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                                + "dictionary_kind=? AND code=?",
                        String.class,
                        SCOPE.toString(),
                        BRAND,
                        "ORDER_OPTION_VALUE",
                        dictionaryCode));
    }

    @Test
    void localAndBrandCopyCarryOrderOptionRelationsWithoutRestoringJson() {
        String localDictionaryCode = generatedCatalogCode("LOCAL-OPTION-DICTIONARY");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "ORDER_OPTION_VALUE")
                        .put("code", localDictionaryCode)
                        .put("name", "本地选项"));
        String localValueRef = dictionaryEntry(
                        service.readDictionary(
                                        SCOPE.toString(),
                                        BRAND,
                                        "ORDER_OPTION_VALUE",
                                        MAPPER.createObjectNode(),
                                        "local-option-dictionary")
                                .path("data")
                                .path("entries"),
                        localDictionaryCode)
                .path("entryRef")
                .asText();
        String localSourceCode = generatedCatalogCode("LOCAL-OPTION-SOURCE");
        String localTargetCode = generatedCatalogCode("LOCAL-OPTION-TARGET");
        JsonNode localSource = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", localSourceCode)
                        .put("name", "local source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        JsonNode localTarget = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", localTargetCode)
                        .put("name", "local target")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "saveOperationsCatalogItem",
                orderOptionSave(
                        localSourceCode,
                        localSource.path("version").asLong(),
                        MAPPER.createArrayNode()
                                .add(orderOptionGroup("LOCAL", "本地", "LOCAL-VALUE", localValueRef, null, null))));
        ObjectNode localPreflightRequest =
                MAPPER.createObjectNode().put("sourceItemCode", localSourceCode).put("targetItemCode", localTargetCode);
        localPreflightRequest.putArray("selectedSections").add("ORDER_OPTIONS");
        JsonNode localPreflight = service.preflightCopy(
                context("preflightOperationsLocalCatalogCopy", SCOPE, "local-option-preflight"), localPreflightRequest);
        ObjectNode localExecute = localPreflightRequest
                .deepCopy()
                .put("preflightDigest", localPreflight.path("preflightDigest").asText())
                .put("expectedSourceVersion", 2L)
                .put("expectedTargetVersion", localTarget.path("version").asLong());
        localExecute.set("compatibilityDispositions", confirmedCompatibilityDispositions(localPreflight));
        service.copy(
                context("executeOperationsLocalCatalogCopy", SCOPE, "local-option-execute"),
                localExecute,
                "local-option-copy-key");
        assertEquals(
                localValueRef,
                service.readItem(SCOPE.toString(), BRAND, localTargetCode, "local-option-readback")
                        .path("data")
                        .path("item")
                        .path("orderOptions")
                        .get(0)
                        .path("values")
                        .get(0)
                        .path("attributeValueRef")
                        .asText());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'orderOptions') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                SCOPE.toString(),
                BRAND,
                localTargetCode));

        String brandDictionaryCode = generatedCatalogCode("BRAND-OPTION-DICTIONARY");
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "ORDER_OPTION_VALUE")
                        .put("code", brandDictionaryCode)
                        .put("name", "跨品牌选项"));
        String brandValueRef = dictionaryEntry(
                        service.readDictionary(
                                        SCOPE.toString(),
                                        BRAND,
                                        "ORDER_OPTION_VALUE",
                                        MAPPER.createObjectNode(),
                                        "brand-option-dictionary")
                                .path("data")
                                .path("entries"),
                        brandDictionaryCode)
                .path("entryRef")
                .asText();
        String brandSourceCode = generatedCatalogCode("BRAND-OPTION-SOURCE");
        JsonNode brandSource = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", brandSourceCode)
                        .put("name", "brand source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "saveOperationsCatalogItem",
                orderOptionSave(
                        brandSourceCode,
                        brandSource.path("version").asLong(),
                        MAPPER.createArrayNode()
                                .add(orderOptionGroup(
                                        "BRAND",
                                        "跨品牌",
                                        "BRAND-VALUE",
                                        brandValueRef,
                                        null,
                                        /* format-wrap */
                                        null))));
        ObjectNode brandRequest = MAPPER.createObjectNode();
        brandRequest.putArray("selectedItemCodes").add(brandSourceCode);
        JsonNode brandPreflight = service.preflightCopy(
                copyContext("preflightOperationsBrandCatalogCopy", "brand-option-preflight"), brandRequest);
        ObjectNode brandExecute = brandRequest
                .deepCopy()
                .put(
                        "expectedSourceVersion",
                        brandPreflight.path("sourceVersion").asLong())
                .put(
                        "expectedTargetVersion",
                        brandPreflight.path("targetVersion").asLong())
                .put("preflightDigest", brandPreflight.path("preflightDigest").asText());
        brandExecute.set(
                "referenceMappings", brandPreflight.path("referenceMappings").deepCopy());
        brandExecute.set("compatibilityDispositions", confirmedCompatibilityDispositions(brandPreflight));
        service.copy(
                copyContext("executeOperationsBrandCatalogCopy", "brand-option-execute"),
                brandExecute,
                "brand-option-copy-key");
        JsonNode copiedOption = service.readItem(
                        COPY_TARGET_SCOPE.toString(), BRAND, brandSourceCode, "brand-option-readback")
                .path("data")
                .path("item")
                .path("orderOptions")
                .get(0)
                .path("values")
                .get(0);
        assertEquals("BRAND-VALUE", copiedOption.path("code").asText());
        assertNotEquals(brandValueRef, copiedOption.path("attributeValueRef").asText());
        assertFalse(jdbc.queryForObject(
                "SELECT jsonb_exists(sections, 'orderOptions') FROM catalog.catalog_item WHERE data_node_ref=? AND "
                        + "brand_ref=? AND code=?",
                Boolean.class,
                COPY_TARGET_SCOPE.toString(),
                BRAND,
                brandSourceCode));
    }

    private static ObjectNode orderOptionSave(String itemCode, long expectedVersion, ArrayNode groups) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        request.putObject("sections")
                .put("expectedCatalogVersion", expectedVersion)
                .putObject("catalogDraft")
                .set("orderOptions", groups.deepCopy());
        return request;
    }

    private static ArrayNode confirmedCompatibilityDispositions(JsonNode preflight) {
        ArrayNode result = MAPPER.createArrayNode();
        preflight.path("compatibilityResults").forEach(row -> {
            if (!"BLOCKED".equals(row.path("result").asText())) {
                result.addObject()
                        .put("compatibilityId", row.path("compatibilityId").asText())
                        .put("disposition", "CONFIRM");
            }
        });
        return result;
    }

    private static ObjectNode orderOptionGroup(
            String groupCode,
            String groupName,
            String firstCode,
            String firstValueRef,
            String secondCode,
            String secondValueRef) {
        ObjectNode group = MAPPER.createObjectNode()
                .put("groupCode", groupCode)
                .put("groupName", groupName)
                .put("selectionMode", "SINGLE")
                .put("required", false);
        ArrayNode values = group.putArray("values");
        values.addObject()
                .put("code", firstCode)
                .put("name", firstCode)
                .put("attributeValueRef", firstValueRef)
                .put("default", false)
                .putArray("productionEffects");
        if (secondCode != null)
            values.addObject()
                    .put("code", secondCode)
                    .put("name", secondCode)
                    .put("attributeValueRef", secondValueRef)
                    .put("default", false)
                    .putArray("productionEffects");
        return group;
    }

    private static ObjectNode compositeSave(
            String itemCode, long expectedVersion, String groupName, ArrayNode componentRefs) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode group = request.putObject("sections")
                .put("expectedCatalogVersion", expectedVersion)
                .putObject("catalogDraft")
                .putArray("compositeGroups")
                .addObject();
        group.put("groupCode", "SIDE")
                .put("groupName", groupName)
                .put("selectionRule", "OPTIONAL")
                .put("minSelections", 0)
                .put("maxSelections", 5);
        ArrayNode components = group.putArray("components");
        for (int index = 0; index < componentRefs.size(); index++) {
            components
                    .addObject()
                    .put("itemRef", componentRefs.get(index).asText())
                    .put("quantity", "1")
                    .put("unit", "份")
                    .put("displayOrder", index);
        }
        return request;
    }

    private static ObjectNode skuSave(String itemCode, long expectedVersion, UUID skuRef, String skuCode) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode sku = request.putObject("sections")
                .put("expectedCatalogVersion", expectedVersion)
                .putObject("catalogDraft")
                .putArray("skus")
                .addObject();
        sku.put("productSkuRef", skuRef.toString())
                .put("skuCode", skuCode)
                .put("skuName", skuCode)
                .put("isDefault", true)
                .put("status", "ENABLED");
        sku.putArray("attributeValueRefs");
        return request;
    }

    private static ObjectNode skuVoidSave(
            String itemCode, long expectedVersion, JsonNode currentItem, UUID skuRef, long skuVersion) {
        return skuVoidSaveMany(itemCode, expectedVersion, currentItem, List.of(skuRef), skuVersion);
    }

    private static ObjectNode skuVoidSaveMany(
            String itemCode, long expectedVersion, JsonNode currentItem, List<UUID> skuRefs, long skuVersion) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ArrayNode transitions = request.putArray("skuTransitions");
        skuRefs.forEach(skuRef -> transitions
                .addObject()
                .put("skuRef", skuRef.toString())
                .put("targetStatus", "VOIDED")
                .put("expectedVersion", skuVersion));
        ObjectNode sections = request.putObject("sections").put("expectedCatalogVersion", expectedVersion);
        ObjectNode draft = sections.putObject("catalogDraft")
                .put("name", currentItem.path("name").asText())
                .put("shapeKey", currentItem.path("shapeKey").asText());
        for (String field : List.of("attributes", "images", "productionTagRefs", "categoryRefs")) {
            JsonNode value = currentItem.path(field);
            draft.set(field, value.isMissingNode() ? MAPPER.createArrayNode() : value.deepCopy());
        }
        sections.putObject("inventoryConfiguration").putArray("nodes");
        sections.putArray("expectedInventoryVersions");
        return request;
    }

    private static void derivedSummarySku(
            ArrayNode skus,
            String skuCode,
            String attributeRef,
            String valueRef,
            Integer standardSalePrice,
            boolean isDefault) {
        ObjectNode sku = skus.addObject()
                .put("skuCode", skuCode)
                .put("skuName", skuCode)
                .put("isDefault", isDefault)
                .put("status", "ENABLED");
        if (standardSalePrice == null) sku.putNull("standardSalePrice");
        else sku.put("standardSalePrice", standardSalePrice);
        sku.putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attributeRef)
                .put("attributeValueRef", valueRef);
    }

    /* Legacy operation-id copy bridge coverage retired with the bridge itself. */
    /* @Test void copyPreflightAndExecuteUseOpaqueReferenceMappingsAndTargetReadLabels() {
        UUID sourceCategory = UUID.randomUUID(), targetCategory = UUID.randomUUID();
        UUID sourceValue = UUID.randomUUID(), targetValue = UUID.randomUUID();
        UUID sourceItem = UUID.randomUUID(), targetItem = UUID.randomUUID();
        UUID sourceBomComponent = UUID.randomUUID(), targetBomComponent = UUID.randomUUID();
        UUID sourceSku = UUID.randomUUID(), targetSku = UUID.randomUUID();
        UUID sourceTag = UUID.randomUUID(), targetTag = UUID.randomUUID();
        insertCategory(SCOPE, sourceCategory, "COPY-CATEGORY");
        insertCategory(COPY_TARGET_SCOPE, targetCategory, "COPY-CATEGORY");
        insertDictionary(SCOPE, sourceValue, "ORDER_OPTION_VALUE", "COPY-OPTION");
        insertDictionary(COPY_TARGET_SCOPE, targetValue, "ORDER_OPTION_VALUE", "COPY-OPTION");
        insertProductionTag(SCOPE, sourceTag, "COPY-TAG");
        insertProductionTag(COPY_TARGET_SCOPE, targetTag, "COPY-TAG");
        insertItem(
            SCOPE,
            sourceBomComponent,
            UUID.randomUUID(),
            sourceCategory,
            sourceValue,
            sourceTag,
            "COPY-BOM-COMPONENT");
        insertItem(
            COPY_TARGET_SCOPE,
            targetBomComponent,
            UUID.randomUUID(),
            targetCategory,
            targetValue,
            targetTag,
            "COPY-BOM-COMPONENT");
        // itemCode is an operator-facing label only.  Its deliberately stale
        // value proves closure follows inventoryBom.itemRef, not its code.
        insertItem(
            SCOPE,
            sourceItem,
            sourceSku,
            sourceCategory,
            sourceValue,
            sourceTag,
            "COPY-ITEM",
            sourceBomComponent);
        insertItem(
            COPY_TARGET_SCOPE,
            targetItem,
            targetSku,
            targetCategory,
            targetValue,
            targetTag,
            "COPY-ITEM",
            targetBomComponent);

        ObjectNode selection = MAPPER.createObjectNode(); selection.putArray("selectedItemCodes").add("COPY-ITEM");
        JsonNode preflight = service.copy(
            "preflightOperationsBrandCatalogCopy",
            SCOPE.toString(),
            COPY_TARGET_SCOPE.toString(),
            BRAND,
            selection,
            "catalog-copy-preflight",
            null,
            WORKSPACE,
            "catalog-copy-test",
            "STORE",
            copyGrant());
        // Brand copy is an owner-to-coordinator preflight and deliberately
        // returns the bare data object; the edge later wraps the merged result.
        JsonNode data = preflight;
        JsonNode mappings = data.path("referenceMappings");
        assertMapping(mappings, "CATALOG_ITEM", sourceItem, targetItem, "COPY-ITEM", null, null);
        assertMapping(
            mappings,
            "CATALOG_ITEM",
            sourceBomComponent,
            targetBomComponent,
            "COPY-BOM-COMPONENT",
            null,
            null);
        assertMapping(mappings, "PRODUCT_SKU", sourceSku, targetSku, null, "COPY-SKU", null);
        assertMapping(mappings, "SKU_ATTRIBUTE_VALUE", sourceValue, targetValue, null, null, "COPY-OPTION");

        ObjectNode productionRequest = MAPPER.createObjectNode();
        productionRequest.putArray("productionTagRefs").add(sourceTag.toString());
        JsonNode productionPreflight = production.preflightCopy(
                SCOPE.toString(),
                COPY_TARGET_SCOPE.toString(),
                BRAND,
                productionRequest,
                WORKSPACE,
                "catalog-copy-test",
                "STORE",
                copyGrant());
        assertMapping(
            productionPreflight.path("referenceMappings"),
            "PRODUCTION_TAG",
            sourceTag,
            targetTag,
            "COPY-TAG",
            null,
            null);

        ObjectNode execute = selection.deepCopy();
        execute.put("expectedSourceVersion", data.path("sourceVersion").asLong());
        execute.put("expectedTargetVersion", data.path("targetVersion").asLong());
        execute.put("preflightDigest", data.path("preflightDigest").asText());
        ArrayNode allMappings = execute.putArray("referenceMappings");
        mappings.forEach(value -> allMappings.add(value.deepCopy()));
        productionPreflight.path("referenceMappings").forEach(value -> allMappings.add(value.deepCopy()));
        JsonNode executed = service.copy(
            "executeOperationsBrandCatalogCopy",
            SCOPE.toString(),
            COPY_TARGET_SCOPE.toString(),
            BRAND,
            execute,
            "catalog-copy-execute",
            "catalog-copy-receipt",
            WORKSPACE,
            "catalog-copy-test",
            "STORE",
            copyGrant());
        JsonNode executionMappings = executed.path("data").path("referenceMappings");
        assertMapping(executionMappings, "CATALOG_ITEM", sourceItem, targetItem, "COPY-ITEM", null, null);
        assertMapping(
            executionMappings,
            "CATALOG_ITEM",
            sourceBomComponent,
            targetBomComponent,
            "COPY-BOM-COMPONENT",
            null,
            null);
        assertMapping(executionMappings, "PRODUCT_SKU", sourceSku, targetSku, null, "COPY-SKU", null);
        assertMapping(executionMappings, "SKU_ATTRIBUTE_VALUE", sourceValue, targetValue, null, null, "COPY-OPTION");
        assertMapping(executionMappings, "PRODUCTION_TAG", sourceTag, targetTag, "COPY-TAG", null, null);

        // A receipt is not a historic authorization to return stale copy data:
        // changing target facts after the first success rejects the same key.
        jdbc.update("UPDATE catalog.catalog_item SET version=version+1 WHERE item_ref=?", targetItem);
        CatalogOwnerApi.Problem catalogReplay = assertThrows(CatalogOwnerApi.Problem.class, () -> service.copy(
            "executeOperationsBrandCatalogCopy", SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, execute,
            "catalog-copy-replay", "catalog-copy-receipt", WORKSPACE, "catalog-copy-test", "STORE", copyGrant()));
        assertEquals("STALE_COPY_PREFLIGHT", catalogReplay.code());

        productionRequest.put("productionPreflightDigest", productionPreflight.path("digest").asText());
        production.copy(SCOPE.toString(), COPY_TARGET_SCOPE.toString(), BRAND, productionRequest,
            "production-copy-execute", "production-copy-receipt", WORKSPACE, "catalog-copy-test", "STORE", copyGrant());
        jdbc.update(
            "UPDATE fulfillment_production.production_tag_definition SET version=version+1 WHERE tag_ref=?",
            targetTag);
        ProductionTagOwnerApi.Problem productionReplay =
                assertThrows(
                        ProductionTagOwnerApi.Problem.class,
                        () ->
                                production.copy(
                                        SCOPE.toString(),
                                        COPY_TARGET_SCOPE.toString(),
                                        BRAND,
                                        productionRequest,
                                        "production-copy-replay",
                                        "production-copy-receipt",
                                        WORKSPACE,
                                        "catalog-copy-test",
                                        "STORE",
                                        copyGrant()));
        assertEquals("STALE_COPY_PREFLIGHT", productionReplay.code());

    } */

    @Test
    void legacyVoidedCategoryReferenceFailsFlywayBeforeDeletion() {
        Flyway legacy = flyway(LEGACY_POSTGRES, "20260808.130000.000");
        legacy.migrate();
        JdbcTemplate legacyJdbc = jdbc(LEGACY_POSTGRES);
        UUID category = UUID.randomUUID();
        UUID item = UUID.randomUUID();
        legacyJdbc.update(
                "INSERT INTO catalog.catalog_category "
                        + "(category_ref,data_node_ref,brand_ref,code,name,status,version,created_at_epoch_millis,updat"
                        + "ed_a"
                        + "t_epoch_millis) VALUES (?,?,?,'LEGACY-VOID','legacy','VOIDED',1,1,1)",
                category,
                "legacy-scope",
                BRAND);
        legacyJdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,'LEGACY-ITEM','legacy "
                        + "item','STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)",
                item,
                "legacy-scope",
                BRAND,
                "{\"categoryRefs\":[\"LEGACY-VOID\"]}");
        assertThrows(RuntimeException.class, () -> flyway(LEGACY_POSTGRES, null).migrate());
    }

    private static void insertCategory(UUID scope, UUID ref, String code) {
        jdbc.update(
                "INSERT INTO catalog.catalog_category "
                        + "(category_ref,data_node_ref,brand_ref,code,name,status,display_order,version,created_at_epoc"
                        + "h_mi"
                        + "llis,updated_at_epoch_millis) VALUES (?,?,?,?,?,'ENABLED',0,1,1,1)",
                ref,
                scope.toString(),
                BRAND,
                code,
                code);
    }

    private static void insertDictionary(UUID scope, UUID ref, String kind, String code) {
        jdbc.update(
                "INSERT INTO catalog.dictionary_entry "
                        + "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,status,display_order,version,cr"
                        + "eate"
                        + "d_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,'ENABLED',0,1,1,1)",
                ref,
                scope.toString(),
                BRAND,
                kind,
                code,
                code);
    }

    private static void insertDictionary(UUID scope, UUID ref, String kind, String code, UUID parentEntryRef) {
        jdbc.update(
                "INSERT INTO catalog.dictionary_entry "
                        + "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,parent_entry_ref,status,display"
                        + "_ord"
                        + "er,version,created_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,?,?,'ENABLED',0,1,1,1)",
                ref,
                scope.toString(),
                BRAND,
                kind,
                code,
                code,
                parentEntryRef);
    }

    private static void insertProductionTag(UUID scope, UUID ref, String code) {
        jdbc.update(
                "INSERT INTO fulfillment_production.production_tag_definition "
                        + "(tag_ref,data_node_ref,brand_ref,code,tag_kind,name,status,version,created_at_epoch_millis,u"
                        + "pdat"
                        + "ed_at_epoch_millis) VALUES (?,?,?,?,? ,?,'ENABLED',1,1,1)",
                ref,
                scope.toString(),
                BRAND,
                code,
                "PRODUCTION",
                code);
    }

    private static void insertItem(
            UUID scope, UUID itemRef, UUID skuRef, UUID categoryRef, UUID optionRef, UUID tagRef, String code) {
        insertItem(scope, itemRef, skuRef, categoryRef, optionRef, tagRef, code, null);
    }

    private static void insertItem(
            UUID scope,
            UUID itemRef,
            UUID skuRef,
            UUID categoryRef,
            UUID optionRef,
            UUID tagRef,
            String code,
            UUID inventoryBomItemRef) {
        ObjectNode sections = MAPPER.createObjectNode();
        sections.putArray("orderOptions")
                .addObject()
                .putArray("values")
                .addObject()
                .put("attributeValueRef", optionRef.toString())
                .put("code", "COPY-OPTION");
        if (inventoryBomItemRef != null)
            sections.putArray("inventoryBom")
                    .addObject()
                    .put("itemRef", inventoryBomItemRef.toString())
                    .put("itemCode", "STALE-BOM-DISPLAY-LABEL");
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DRAFT','{}'::jsonb,CAST(? AS JSONB),1,1,1)",
                itemRef,
                scope.toString(),
                BRAND,
                code,
                code,
                sections.toString());
        jdbc.update(
                "INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES(?,?)", itemRef, categoryRef);
        jdbc.update(
                "INSERT INTO catalog.catalog_item_reference(item_ref,kind,ref) VALUES(?,'PRODUCTION_TAG',?)",
                itemRef,
                tagRef);
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest) VALUES(?,?, 'COPY-SKU', 'COPY-SKU', true, 'ENABLED', 0, "
                        + "'copy-sku')",
                skuRef,
                itemRef);
    }

    private static void assertMapping(
            JsonNode mappings,
            String objectType,
            UUID sourceRef,
            UUID targetRef,
            String targetCode,
            String targetSkuCode,
            String targetOptionValueCode) {
        JsonNode found = null;
        for (JsonNode mapping : mappings)
            if (objectType.equals(mapping.path("objectType").asText())
                    && sourceRef.toString().equals(mapping.path("sourceRef").asText())) {
                found = mapping;
                break;
            }
        assertTrue(found != null, "missing " + objectType + " mapping");
        assertEquals(targetRef.toString(), found.path("targetRef").asText());
        if (targetCode == null) assertTrue(found.path("targetCode").isNull());
        else assertEquals(targetCode, found.path("targetCode").asText());
        if (targetSkuCode == null) assertTrue(found.path("targetSkuCode").isNull());
        else assertEquals(targetSkuCode, found.path("targetSkuCode").asText());
        if (targetOptionValueCode == null)
            assertTrue(found.path("targetOptionValueCode").isNull());
        else
            assertEquals(
                    targetOptionValueCode, found.path("targetOptionValueCode").asText());
    }

    @AfterAll
    static void cleanup() {
        if (flyway != null) flyway.clean();
        Flyway.configure()
                .dataSource(LEGACY_POSTGRES.getJdbcUrl(), LEGACY_POSTGRES.getUsername(), LEGACY_POSTGRES.getPassword())
                .cleanDisabled(false)
                .load()
                .clean();
    }

    private static JsonNode create(String code, String name, String parentCategoryRef) {
        ObjectNode request = MAPPER.createObjectNode().put("code", code).put("name", name);
        if (parentCategoryRef == null) request.putNull("parentCategoryRef");
        else request.put("parentCategoryRef", parentCategoryRef);
        return write("createOperationsCatalogCategory", request);
    }

    private static ObjectNode promotionRequest(String itemCode, long expectedSourceVersion, String formalCode) {
        return MAPPER.createObjectNode()
                .put("itemCode", itemCode)
                .put("formalCode", formalCode)
                .put("shapeKey", "STANDARD_SALE_COUNTED")
                .put("name", "formal item")
                .put("expectedSourceVersion", expectedSourceVersion)
                .set("attributes", MAPPER.createObjectNode());
    }

    private static String generatedCatalogCode(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
    }

    private static void insertQG10Item(UUID itemRef, String code, String name) {
        jdbc.update(
                "INSERT INTO catalog.catalog_item(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,"
                        + "attributes,sections,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis) VALUES(?,?,?,?,?,"
                        + "'SKU_VARIANT_SALE_COUNTED','DRAFT','{}'::jsonb,'{}'::jsonb,1,1,1)",
                itemRef,
                SCOPE.toString(),
                BRAND,
                code,
                name);
    }

    private static void insertQG10Sku(UUID itemRef, UUID skuRef, String skuCode, boolean isDefault, String digest) {
        jdbc.update(
                "INSERT INTO catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,"
                        + "display_order,variant_combination_digest) VALUES(?,?,?,? ,?,'ENABLED',0,?)",
                skuRef,
                itemRef,
                skuCode,
                skuCode,
                isDefault,
                digest);
    }

    private static void insertQG10CompositeComponent(UUID groupRef, UUID itemRef, UUID skuRef, int displayOrder) {
        jdbc.update(
                "INSERT INTO catalog.catalog_composite_component(composite_component_ref,composite_group_ref,"
                        + "component_item_ref,product_sku_ref,quantity,unit,is_default,display_order) "
                        + "VALUES(?,?,?,?,1,'份',"
                        + "false,?)",
                UUID.randomUUID(),
                groupRef,
                itemRef,
                skuRef,
                displayOrder);
    }

    private static JsonNode skuDetail(JsonNode skus, UUID skuRef) {
        for (JsonNode sku : skus)
            if (skuRef.toString().equals(sku.path("productSkuRef").asText())) return sku;
        throw new AssertionError("missing sku detail " + skuRef);
    }

    @Test
    void skuRemovalAndInventoryTargetCreationCannotBothCommit() throws Exception {
        String itemCode = generatedCatalogCode("SKU-INVENTORY-RACE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "sku inventory race")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE")
                        .put("code", "RACE-ATTRIBUTE")
                        .put("name", "Race attribute"));
        JsonNode attributes = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE", MAPPER.createObjectNode(), "sku-race-attributes")
                .path("data")
                .path("entries");
        String attributeRef =
                dictionaryEntry(attributes, "RACE-ATTRIBUTE").path("entryRef").asText();
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "RACE-A")
                        .put("name", "Race A")
                        .put("parentEntryRef", attributeRef));
        write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "SKU_ATTRIBUTE_VALUE")
                        .put("code", "RACE-B")
                        .put("name", "Race B")
                        .put("parentEntryRef", attributeRef));
        JsonNode values = service.readDictionary(
                        SCOPE.toString(), BRAND, "SKU_ATTRIBUTE_VALUE", MAPPER.createObjectNode(), "sku-race-values")
                .path("data")
                .path("entries");
        String firstValueRef =
                dictionaryEntry(values, "RACE-A").path("entryRef").asText();
        String secondValueRef =
                dictionaryEntry(values, "RACE-B").path("entryRef").asText();
        UUID firstSkuRef = UUID.randomUUID();
        UUID secondSkuRef = UUID.randomUUID();
        ObjectNode baseline = skuSave(
                itemCode,
                created.path("version").asLong(),
                firstSkuRef,
                secondSkuRef,
                true,
                attributeRef,
                firstValueRef,
                secondValueRef);
        long version =
                write("saveOperationsCatalogItem", baseline).path("version").asLong();

        ObjectNode removeSecondSku = skuSave(
                itemCode, version, firstSkuRef, secondSkuRef, false, attributeRef, firstValueRef, secondValueRef);
        ObjectNode retainSecondSkuAndCreateTarget = skuSave(
                itemCode, version, firstSkuRef, secondSkuRef, true, attributeRef, firstValueRef, secondValueRef);
        ((ObjectNode) retainSecondSkuAndCreateTarget.path("sections"))
                .putObject("inventoryConfiguration")
                .putArray("nodes")
                .addObject()
                .put("skuCode", "SKU-2")
                .put("productSkuRef", secondSkuRef.toString())
                .put("mode", "INDEPENDENT_STOCK")
                .put("consumptionUnit", "EA");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier start = new CyclicBarrier(3);
        Future<Throwable> remove = submitCoordinatedSave(executor, start, itemCode, removeSecondSku, "remove-sku");
        Future<Throwable> createTarget =
                submitCoordinatedSave(executor, start, itemCode, retainSecondSkuAndCreateTarget, "create-target");
        try {
            start.await(5, TimeUnit.SECONDS);
            Throwable removeFailure = remove.get(15, TimeUnit.SECONDS);
            Throwable createFailure = createTarget.get(15, TimeUnit.SECONDS);
            assertEquals(
                    1,
                    (removeFailure == null ? 1 : 0) + (createFailure == null ? 1 : 0),
                    "one command must commit and the competing command must be rejected");

            int activeSku = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM catalog.catalog_sku WHERE product_sku_ref=? AND status <> 'ARCHIVED'",
                    Integer.class,
                    secondSkuRef);
            int inventoryReferences = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM inventory.stock_target WHERE product_sku_ref=?", Integer.class, secondSkuRef);
            if (removeFailure == null) {
                assertEquals(0, activeSku);
                assertEquals(0, inventoryReferences);
            } else {
                assertEquals(1, activeSku);
                assertEquals(1, inventoryReferences);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private static Future<Throwable> submitCoordinatedSave(
            ExecutorService executor, CyclicBarrier start, String itemCode, ObjectNode request, String suffix) {
        return executor.submit(() -> {
            start.await(5, TimeUnit.SECONDS);
            DataSource dataSource = dataSource();
            JdbcTemplate taskJdbc = new JdbcTemplate(dataSource);
            InventoryOwnerService taskInventory =
                    new InventoryOwnerService(taskJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
            ProductionTagOwnerService taskProduction =
                    new ProductionTagOwnerService(taskJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
            CatalogOwnerService taskCatalog = new CatalogOwnerService(
                    taskJdbc,
                    MAPPER,
                    (TimeProvider) () -> 1_785_000_000_000L,
                    mock(CatalogAssetReferenceLock.class),
                    taskProduction,
                    taskInventory);
            PlatformAssetService assets = mock(PlatformAssetService.class);
            when(assets.settleCatalogSaveAssets(any(), any()))
                    .thenReturn(new CatalogAssetCommandApi.SaveSettlementReadback(List.of(), List.of()));
            CatalogInventoryCoordinator coordinator = new CatalogInventoryCoordinator(
                    taskCatalog,
                    taskInventory,
                    taskProduction,
                    assets,
                    MAPPER,
                    (TimeProvider) () -> 1_785_000_000_000L,
                    mock(CatalogScopeLookup.class));
            try {
                new TransactionTemplate(new DataSourceTransactionManager(dataSource))
                        .executeWithoutResult(status -> coordinator.saveCatalogItem(
                                context(
                                        "saveOperationsCatalogItem",
                                        SCOPE,
                                        "sku-inventory-race-" + suffix + UUID.randomUUID()),
                                new CatalogOwnerApi.CatalogItemSaveCommand(itemCode, canonical(request)),
                                List.of(),
                                "sku-inventory-race-" + suffix + UUID.randomUUID()));
                return null;
            } catch (Throwable failure) {
                return failure;
            }
        });
    }

    private static ObjectNode skuSave(
            String itemCode,
            long expectedVersion,
            UUID firstSkuRef,
            UUID secondSkuRef,
            boolean includeSecond,
            String attributeRef,
            String firstValueRef,
            String secondValueRef) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = request.putObject("sections")
                .put("expectedCatalogVersion", expectedVersion)
                .putObject("catalogDraft");
        ArrayNode dimensions = draft.putArray("skuVariantDimensions")
                .addObject()
                .put("attributeRef", attributeRef)
                .putArray("values");
        dimensions.addObject().put("valueRef", firstValueRef).put("displayOrder", 0);
        dimensions.addObject().put("valueRef", secondValueRef).put("displayOrder", 1);
        ArrayNode skus = draft.putArray("skus");
        addSku(skus, firstSkuRef, "SKU-1", true, attributeRef, firstValueRef);
        if (includeSecond) addSku(skus, secondSkuRef, "SKU-2", false, attributeRef, secondValueRef);
        return request;
    }

    private static void addSku(
            ArrayNode skus, UUID ref, String code, boolean isDefault, String attributeRef, String valueRef) {
        ObjectNode sku = skus.addObject()
                .put("productSkuRef", ref.toString())
                .put("skuCode", code)
                .put("skuName", code)
                .put("skuBarcode", "")
                .put("isDefault", isDefault)
                .put("status", "ENABLED")
                .put("version", 0);
        sku.putArray("attributeValueRefs")
                .addObject()
                .put("attributeRef", attributeRef)
                .put("attributeValueRef", valueRef);
        sku.putArray("mediaRefs");
    }

    private static String canonical(ObjectNode value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception failure) {
            throw new AssertionError(failure);
        }
    }

    private static DataSource dataSource() {
        return new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static JsonNode write(String operation, ObjectNode request) {
        return write(service, operation, request);
    }

    private static JsonNode write(CatalogOwnerService target, String operation, ObjectNode request) {
        String requestId = operation + UUID.randomUUID();
        JsonNode response = target.write(
                context(operation, SCOPE, requestId), request, UUID.randomUUID().toString());
        return response.path("result");
    }

    private static JsonNode writeFull(String operation, ObjectNode request, String requestId, String idempotencyKey) {
        return service.write(context(operation, SCOPE, requestId), request, idempotencyKey);
    }

    private static com.catering.v2s.platform.command.WorkspaceExecutionContext<
                    com.catering.v2s.platform.command.CatalogAuthorizationScope>
            context(String operation, UUID scope, String requestId) {
        return context(operation, scope, BRAND, requestId);
    }

    private static com.catering.v2s.platform.command.WorkspaceExecutionContext<
                    com.catering.v2s.platform.command.CatalogAuthorizationScope>
            context(String operation, UUID scope, String brand, String requestId) {
        var token = CatalogInventoryWorkspaceCommandTokens.all().stream()
                .filter(candidate -> candidate.operationId().equals(operation))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing token: " + operation));
        return CatalogCommandContextFixture.context(
                WORKSPACE, "catalog-category-test", scope, brand, token, null, requestId);
    }

    private static com.catering.v2s.platform.command.WorkspaceExecutionContext<
                    com.catering.v2s.platform.command.CatalogAuthorizationScope>
            copyContext(String operation, String requestId) {
        var token = CatalogInventoryWorkspaceCommandTokens.all().stream()
                .filter(candidate -> candidate.operationId().equals(operation))
                .findFirst()
                .orElseThrow(() -> new AssertionError("missing token: " + operation));
        return CatalogCommandContextFixture.context(
                WORKSPACE, "catalog-category-test", COPY_TARGET_SCOPE, BRAND, token, SCOPE, requestId);
    }

    private static JsonNode navigation() {
        return navigationData().path("tree");
    }

    private static JsonNode navigationData() {
        return service.readNavigation(SCOPE.toString(), BRAND, MAPPER.createObjectNode(), "navigation")
                .path("data");
    }

    private static JsonNode category(JsonNode tree, String categoryRef) {
        for (JsonNode node : tree)
            if (categoryRef.equals(node.path("categoryRef").asText())) return node;
        throw new AssertionError("category not found: " + categoryRef);
    }

    private static JsonNode dictionaryEntry(JsonNode entries, String code) {
        for (JsonNode entry : entries) if (code.equals(entry.path("code").asText())) return entry;
        throw new AssertionError("missing dictionary entry " + code);
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "catalog-category-test",
                "CATALOG_CATEGORY_TEST",
                "EDIT_STORE_CATALOG",
                "STORE",
                SCOPE,
                "STORE",
                SCOPE,
                List.of(SCOPE));
    }

    private static OperationsOwnerScopeGrant copyGrant() {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "catalog-copy-test",
                "CATALOG_COPY_TEST",
                "EDIT_STORE_CATALOG",
                "STORE",
                COPY_TARGET_SCOPE,
                "STORE",
                COPY_TARGET_SCOPE,
                List.of(COPY_TARGET_SCOPE));
    }

    private static JdbcTemplate jdbc(PostgreSQLContainer<?> postgres) {
        return new JdbcTemplate(
                new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private final List<String> recordedSql = new java.util.ArrayList<>();

        private RecordingJdbcTemplate(DataSource dataSource) {
            super(dataSource);
        }

        @Override
        public <T> T query(
                String sql, PreparedStatementSetter preparedStatementSetter, ResultSetExtractor<T> resultSetExtractor) {
            recordedSql.add(sql);
            return super.query(sql, preparedStatementSetter, resultSetExtractor);
        }

        private List<String> recordedSql() {
            return List.copyOf(recordedSql);
        }

        private void clearRecordedSql() {
            recordedSql.clear();
        }
    }

    private static Flyway flyway(PostgreSQLContainer<?> postgres, String target) {
        var configuration = Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false);
        if (target != null) configuration.target(target);
        return configuration.load();
    }
}
