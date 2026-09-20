package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.fulfillment.production.application.ProductionTagOwnerService;
import com.catering.v2s.fulfillment.production.application.persistence.ProductionTagOwnerPersistence;
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
import java.math.BigDecimal;
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
    private static CatalogOwnerApi.UnitDefinitionReadback defaultTestUnit;

    @BeforeAll
    static void setup() {
        flyway = flyway(POSTGRES, null);
        flyway.migrate();
        jdbc = jdbc(POSTGRES);
        inventory = new InventoryOwnerService(jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        production = new ProductionTagOwnerService(
                new ProductionTagOwnerPersistence(jdbc, (TimeProvider) () -> 1_785_000_000_000L), MAPPER);
        service = new CatalogOwnerService(
                jdbc,
                MAPPER,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                production,
                inventory);
        defaultTestUnit = createUnit("TEST-DEFAULT-UNIT", "测试默认单位", CatalogOwnerApi.UnitDimension.COUNT, 0);
    }

    @Test
    void categoryOperationsUseOpaqueRefsAndAllowVoidThenCodeReuse() {
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

        JsonNode voided = write(
                "transitionOperationsCatalogCategoryStatus",
                MAPPER.createObjectNode()
                        .put("categoryRef", rootA.path("categoryRef").asText())
                        .put("expectedVersion", rootA.path("version").asLong())
                        .put("targetStatus", "VOIDED"));
        assertEquals(
                rootA.path("categoryRef").asText(), voided.path("categoryRef").asText());
        assertEquals("VOIDED", voided.path("status").asText());
        assertEquals(rootA.path("version").asLong() + 1L, voided.path("version").asLong());
        JsonNode recreated = create("CAT-A", "A-recreated", null);
        assertEquals("CAT-A", recreated.path("code").asText());
    }

    @Test
    void typedCategoryCommandRejectsAContextTokenForAnotherOperationBeforeWriting() {
        String code = "SCOPE-MISMATCH-" + UUID.randomUUID();

        CatalogOwnerApi.Problem problem = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> service.createCategory(
                        context("updateOperationsCatalogCategory", SCOPE, "scope-mismatch"),
                        new CatalogOwnerApi.CategoryCreateCommand(code, "scope mismatch", null),
                        "scope-mismatch-key"));

        assertEquals("SCOPE_FORBIDDEN", problem.code());
        assertEquals(403, problem.status());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_category "
                                + "WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Integer.class,
                        SCOPE.toString(),
                        BRAND,
                        code));
    }

    @Test
    void categoryHierarchyAllowsExactlyThreeLevelsAndRejectsADeeperCreateOrMove() {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
        JsonNode root = create("DEPTH-ROOT-" + suffix, "三级根", null);
        JsonNode second = create(
                "DEPTH-SECOND-" + suffix, "三级中间", root.path("categoryRef").asText());
        JsonNode third = create(
                "DEPTH-THIRD-" + suffix, "三级叶", second.path("categoryRef").asText());

        CatalogOwnerApi.Problem createBlocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> create(
                        "DEPTH-FOURTH-" + suffix,
                        "第四级",
                        third.path("categoryRef").asText()));
        assertEquals("CATEGORY_DEPTH_EXCEEDED", createBlocked.code());
        assertEquals("商品分类最多只能建立三级", createBlocked.getMessage());

        JsonNode movableRoot = create("DEPTH-MOVE-ROOT-" + suffix, "待移动根", null);
        JsonNode movableChild = create(
                "DEPTH-MOVE-CHILD-" + suffix,
                "待移动子",
                movableRoot.path("categoryRef").asText());
        CatalogOwnerApi.Problem moveBlocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "moveOperationsCatalogCategory",
                        MAPPER.createObjectNode()
                                .put(
                                        "categoryRef",
                                        movableRoot.path("categoryRef").asText())
                                .put(
                                        "expectedVersion",
                                        movableRoot.path("version").asLong())
                                .put("action", "REPARENT")
                                .put(
                                        "parentCategoryRef",
                                        third.path("categoryRef").asText())));
        assertEquals("CATEGORY_DEPTH_EXCEEDED", moveBlocked.code());
        assertEquals("商品分类最多只能建立三级", moveBlocked.getMessage());
        assertEquals(
                second.path("categoryRef").asText(),
                jdbc.queryForObject(
                        "SELECT parent_category_ref::text FROM catalog.catalog_category WHERE category_ref=?",
                        String.class,
                        UUID.fromString(third.path("categoryRef").asText())),
                "the rejected move does not mutate the existing three-level branch");
        assertNull(
                jdbc.queryForObject(
                        "SELECT parent_category_ref::text FROM catalog.catalog_category WHERE category_ref=?",
                        String.class,
                        UUID.fromString(movableRoot.path("categoryRef").asText())),
                "the rejected move does not mutate the moving root");
        assertFalse(movableChild.path("categoryRef").asText().isBlank(), "the move guard uses a real subtree");
    }

    @Test
    void brandCopyRejectsTheWholeCopyWhenAReusedCategoryWouldMakeItsCopiedSubtreeFourLevelsDeep() {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
        String sourceRootCode = "COPY-DEPTH-ROOT-" + suffix;
        String sourceChildCode = "COPY-DEPTH-CHILD-" + suffix;
        String sourceLeafCode = "COPY-DEPTH-LEAF-" + suffix;
        JsonNode sourceRoot = create(sourceRootCode, "来源一级", null);
        JsonNode sourceChild =
                create(sourceChildCode, "来源二级", sourceRoot.path("categoryRef").asText());
        JsonNode sourceLeaf =
                create(sourceLeafCode, "来源三级", sourceChild.path("categoryRef").asText());
        String sourceItemCode = generatedCatalogCode("COPY-DEPTH-ITEM");
        JsonNode sourceItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", sourceItemCode)
                        .put("name", "分类复制深度来源")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode sourceSave = MAPPER.createObjectNode().put("itemCode", sourceItemCode);
        sourceSave
                .putObject("sections")
                .put("expectedCatalogVersion", sourceItem.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("categoryRefs")
                .add(sourceLeaf.path("categoryRef").asText());
        write("saveOperationsCatalogItem", sourceSave);

        UUID targetRootRef = UUID.randomUUID();
        UUID reusedSourceRootRef = UUID.randomUUID();
        insertCategory(COPY_TARGET_SCOPE, targetRootRef, "COPY-DEPTH-TARGET-" + suffix);
        insertCategory(COPY_TARGET_SCOPE, reusedSourceRootRef, sourceRootCode, targetRootRef);

        ObjectNode selection = MAPPER.createObjectNode();
        selection.putArray("selectedItemCodes").add(sourceItemCode);
        JsonNode preflight = service.preflightCopy(
                copyContext("preflightOperationsBrandCatalogCopy", "copy-depth-preflight"), selection);
        ObjectNode execute = selection
                .deepCopy()
                .put("expectedSourceVersion", preflight.path("sourceVersion").asLong())
                .put("expectedTargetVersion", preflight.path("targetVersion").asLong())
                .put("preflightDigest", preflight.path("preflightDigest").asText());
        execute.set("referenceMappings", preflight.path("referenceMappings").deepCopy());
        execute.set("compatibilityDispositions", confirmedCompatibilityDispositions(preflight));

        CatalogOwnerApi.Problem rejected = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> service.copy(
                        copyContext("executeOperationsBrandCatalogCopy", "copy-depth-execute"),
                        execute,
                        "copy-depth-key"));
        assertEquals("CATEGORY_DEPTH_EXCEEDED", rejected.code());
        assertEquals("商品分类最多只能建立三级", rejected.getMessage());
        assertEquals(
                targetRootRef,
                jdbc.queryForObject(
                        "SELECT parent_category_ref FROM catalog.catalog_category WHERE category_ref=?",
                        UUID.class,
                        reusedSourceRootRef),
                "the reused target category remains where it was before the rejected copy");
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_category WHERE data_node_ref=? AND brand_ref=? "
                                + "AND code IN (?,?)",
                        Integer.class,
                        COPY_TARGET_SCOPE.toString(),
                        BRAND,
                        sourceChildCode,
                        sourceLeafCode),
                "the rejected copy writes neither child of the copied subtree");
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        Integer.class,
                        COPY_TARGET_SCOPE.toString(),
                        BRAND,
                        sourceItemCode),
                "the rejected copy does not create a partial target item");
    }

    @Test
    void categoryCandidateCursorUsesDisplayOrderThenNameThenCodeAndKeepsFullPaths() {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
        JsonNode alpha = create("Z-CANDIDATE-" + suffix, "Alpha candidate " + suffix, null);
        JsonNode beta = create("A-CANDIDATE-" + suffix, "Beta candidate " + suffix, null);
        JsonNode gamma = create("M-CANDIDATE-" + suffix, "Gamma candidate " + suffix, null);
        List<String> refs = List.of(
                alpha.path("categoryRef").asText(),
                beta.path("categoryRef").asText(),
                gamma.path("categoryRef").asText());
        jdbc.update(
                "UPDATE catalog.catalog_category SET display_order=-99999 WHERE category_ref::text IN (?,?,?)",
                refs.toArray());

        ObjectNode firstRequest =
                MAPPER.createObjectNode().put("usage", "ITEM_ASSIGNMENT").put("pageSize", 1);
        JsonNode first = service.readCategoryCandidates(SCOPE.toString(), BRAND, firstRequest, "candidate-first")
                .path("data");
        assertEquals(
                "Alpha candidate " + suffix,
                first.path("items").get(0).path("name").asText());
        assertEquals(1, first.path("items").get(0).path("path").size());

        ObjectNode secondRequest =
                firstRequest.deepCopy().put("cursor", first.path("nextCursor").asText());
        JsonNode second = service.readCategoryCandidates(SCOPE.toString(), BRAND, secondRequest, "candidate-second")
                .path("data");
        assertEquals(
                "Beta candidate " + suffix,
                second.path("items").get(0).path("name").asText());

        ObjectNode thirdRequest =
                firstRequest.deepCopy().put("cursor", second.path("nextCursor").asText());
        JsonNode third = service.readCategoryCandidates(SCOPE.toString(), BRAND, thirdRequest, "candidate-third")
                .path("data");
        assertEquals(
                "Gamma candidate " + suffix,
                third.path("items").get(0).path("name").asText());
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
    void navigationCategoryCountUsesTheRelationalCategoryAssignmentWrittenAtCreate() {
        JsonNode category = create("NAV-COUNT-CATEGORY", "navigation count category", null);
        String categoryRef = category.path("categoryRef").asText();
        JsonNode before = category(navigation(), categoryRef);
        long inactiveBefore =
                smartView(navigationData(), "INACTIVE").path("count").asLong();
        String itemCode = generatedCatalogCode("NAV-CATEGORY-ITEM");

        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "navigation category item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED")
                        .put("categoryRef", categoryRef));

        assertEquals("DISABLED", created.path("status").asText());
        JsonNode after = category(navigation(), categoryRef);
        assertEquals(before.path("count").asLong() + 1, after.path("count").asLong());
        assertEquals(
                before.path("directCount").asLong() + 1,
                after.path("directCount").asLong());
        assertEquals("SELF_AND_DESCENDANTS", after.path("countSemantics").asText());
        assertEquals(
                inactiveBefore + 1,
                smartView(navigationData(), "INACTIVE").path("count").asLong(),
                "停用商品必须进入未启用商品集合");
        assertEquals(
                categoryRef,
                service.readItem(SCOPE.toString(), BRAND, itemCode, "navigation-category-detail")
                        .path("data")
                        .path("item")
                        .path("categoryRef")
                        .asText());
    }

    @Test
    void navigationCategoryCountMatchesTheDescendantCategorySelectionScope() {
        JsonNode root = create("NAV-AGGREGATE-ROOT", "navigation aggregate root", null);
        JsonNode child = create(
                "NAV-AGGREGATE-CHILD",
                "navigation aggregate child",
                root.path("categoryRef").asText());
        String itemCode = generatedCatalogCode("NAV-AGGREGATE-ITEM");
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "navigation aggregate item")
                        .put("shapeKey", "STANDARD_SALE_COUNTED")
                        .put("categoryRef", child.path("categoryRef").asText()));

        JsonNode rootNode = category(navigation(), root.path("categoryRef").asText());
        JsonNode childNode = category(navigation(), child.path("categoryRef").asText());
        assertEquals(1, rootNode.path("count").asLong());
        assertEquals(0, rootNode.path("directCount").asLong());
        assertEquals(1, childNode.path("count").asLong());
        assertEquals(1, childNode.path("directCount").asLong());
        assertEquals("SELF_AND_DESCENDANTS", rootNode.path("countSemantics").asText());

        ObjectNode query = MAPPER.createObjectNode()
                .put("categoryRef", root.path("categoryRef").asText())
                .put("includeSubCategories", true)
                .put("pageSize", 20);
        JsonNode page = service.readItems(SCOPE.toString(), BRAND, query, "navigation-descendant-scope")
                .path("data");
        assertEquals(1, page.path("total").asLong());
        assertEquals(itemCode, page.path("items").path(0).path("code").asText());
    }

    @Test
    void voidedItemReleasesItsCodeWhileDisabledItemStillReservesItsCode() {
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
        assertEquals("DISABLED", replacement.path("status").asText());
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

        String disabledCode = generatedCatalogCode("DISABLED-CODE");
        write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", disabledCode)
                        .put("name", "disabled source")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        CatalogOwnerApi.Problem reserved = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> write(
                        "createOperationsCatalogItem",
                        MAPPER.createObjectNode()
                                .put("code", disabledCode)
                                .put("name", "must be rejected")
                                .put("shapeKey", "STANDARD_SALE_COUNTED")));
        assertEquals("DUPLICATE_CODE", reserved.code());
    }

    @Test
    void itemVoidRetiresItsOwnInventoryDefinitionsInsteadOfBlockingTheItem() {
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
                        + "_code,measure_mode,inventory_mode,configuration,balance,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis"
                        + ") VALUES(?,?,?,?,?,?,?,'COUNTED','DIRECT','{}'::jsonb,0,1,1,1)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                itemRef,
                null,
                itemCode,
                null);

        JsonNode voidAvailability = service.readItem(SCOPE.toString(), BRAND, itemCode, "inventory-guard-detail")
                .path("data")
                .path("actionAvailability")
                .path("voidAvailability");
        assertTrue(voidAvailability.path("canVoid").asBoolean());
        write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", itemCode)
                        .put("expectedVersion", created.path("version").asLong())
                        .put("targetStatus", "VOIDED"));
        assertEquals(
                "VOIDED",
                jdbc.queryForObject("SELECT status FROM catalog.catalog_item WHERE item_ref=?", String.class, itemRef));
        assertEquals(
                "DISABLED",
                jdbc.queryForObject(
                        "SELECT definition_status FROM inventory.stock_target WHERE item_ref=?",
                        String.class,
                        itemRef));
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
    void skuVoidRetiresItsOwnInventoryDefinitionInsteadOfBlockingTheSku() {
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
                        + "_code,measure_mode,inventory_mode,configuration,balance,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis"
                        + ") VALUES(?,?,?,?,?,?,?,'COUNTED','DIRECT','{}'::jsonb,0,1,1,1)",
                UUID.randomUUID(),
                SCOPE.toString(),
                BRAND,
                itemRef,
                skuRef,
                itemCode,
                "GUARDED-SKU");

        JsonNode voided = write(
                "saveOperationsCatalogItem",
                skuVoidSave(itemCode, saved.path("version").asLong(), before, skuRef, skuVersion));
        assertEquals(
                "VOIDED",
                voided.path("skuTransitions").path(0).path("targetStatus").asText());
        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?", String.class, skuRef));
        assertEquals(
                saved.path("version").asLong() + 1,
                jdbc.queryForObject("SELECT version FROM catalog.catalog_item WHERE item_ref=?", Long.class, itemRef));
        assertEquals(
                "DISABLED",
                jdbc.queryForObject(
                        "SELECT definition_status FROM inventory.stock_target WHERE product_sku_ref=?",
                        String.class,
                        skuRef));
    }

    @Test
    void skuRetirementBatchRetiresOwnInventoryDefinitionsAndKeepsCatalogBlockerAttribution() {
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
                        + "item_code,sku_code,measure_mode,inventory_mode,configuration,balance,version,created_at_"
                        + "epoch_millis,"
                        + "updated_at_epoch_millis) VALUES(?,?,?,?,?,?,?,'COUNTED','DIRECT','{"
                        + "}'::jsonb,0,1,1,1)",
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
        ObjectNode catalogBlockedVoid =
                skuVoidSaveMany(itemCode, before.path("version").asLong(), before, List.of(catalogBlockedSkuRef), 1L);
        CatalogOwnerApi.Problem catalogBlocked = assertThrows(
                CatalogOwnerApi.Problem.class, () -> write("saveOperationsCatalogItem", catalogBlockedVoid));
        assertEquals("REFERENCE_BLOCKS_VOID", catalogBlocked.code());
        assertEquals("该规格已被套餐内容使用，暂不能作废", catalogBlocked.getMessage());
        assertFalse(catalogBlocked.getMessage().contains(catalogBlockedSkuRef.toString()));
        assertFalse(catalogBlocked.getMessage().contains(ownerItemRef.toString()));
        ObjectNode batchVoid = skuVoidSaveMany(
                itemCode, before.path("version").asLong(), before, List.of(inventoryBlockedSkuRef, freeSkuRef), 1L);
        JsonNode succeeded = write("saveOperationsCatalogItem", batchVoid);
        assertEquals(2, succeeded.path("skuTransitions").size());
        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?", String.class, freeSkuRef));
        assertEquals(
                "VOIDED",
                jdbc.queryForObject(
                        "SELECT status FROM catalog.catalog_sku WHERE product_sku_ref=?",
                        String.class,
                        inventoryBlockedSkuRef));
        assertEquals(
                "DISABLED",
                jdbc.queryForObject(
                        "SELECT definition_status FROM inventory.stock_target WHERE product_sku_ref=?",
                        String.class,
                        inventoryBlockedSkuRef));
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
        ObjectNode draft = save.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft");
        draft.put("productionTagRef", tagRef.toString());
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
                new ProductionTagOwnerApi.CreateTagCommand(code, "typed tag"),
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
    void typedProductionTagUpdateAndTransitionLockTheCurrentFactAndReturnTheirPersistedReadback() {
        String code = generatedCatalogCode("TYPED-TAG-MUTATION");
        ProductionTagOwnerApi.ProductionTagCommandReadback created = production.createTag(
                context("createOperationsProductionTag", SCOPE, "typed-tag-mutation-create"),
                new ProductionTagOwnerApi.CreateTagCommand(code, "initial production tag"),
                "typed-tag-mutation-create-key");

        ProductionTagOwnerApi.ProductionTagCommandReadback renamed = production.updateTag(
                context("updateOperationsProductionTag", SCOPE, "typed-tag-mutation-update"),
                new ProductionTagOwnerApi.UpdateTagCommand(code, created.version(), "renamed production tag"),
                "typed-tag-mutation-update-key");
        assertEquals("renamed production tag", renamed.name());
        assertEquals(created.version() + 1L, renamed.version());

        ProductionTagOwnerApi.ProductionTagCommandReadback disabled = production.transitionTagStatus(
                context("transitionOperationsProductionTagStatus", SCOPE, "typed-tag-mutation-transition"),
                new ProductionTagOwnerApi.TransitionTagStatusCommand(code, renamed.version(), "DISABLED"),
                "typed-tag-mutation-transition-key");
        assertEquals("DISABLED", disabled.status());
        assertEquals(renamed.version() + 1L, disabled.version());
        assertEquals(
                List.of("renamed production tag", "DISABLED", String.valueOf(disabled.version())),
                jdbc.queryForObject(
                        "SELECT name,status,version FROM fulfillment_production.production_tag_definition "
                                + "WHERE data_node_ref=? AND brand_ref=? AND code=?",
                        (result, row) ->
                                List.of(result.getString(1), result.getString(2), String.valueOf(result.getLong(3))),
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
        insertDictionary(SCOPE, attributeRef, "SKU_ATTRIBUTE", "RANGE-ATTRIBUTE");
        insertDictionary(SCOPE, firstValueRef, "SKU_ATTRIBUTE_VALUE", "RANGE-VALUE-A", attributeRef);
        insertDictionary(SCOPE, secondValueRef, "SKU_ATTRIBUTE_VALUE", "RANGE-VALUE-B", attributeRef);
        insertDictionary(SCOPE, tagRef, "TAG", "CATALOG-TAG-RANGE");
        CatalogOwnerApi.UnitDefinitionReadback salesUnit =
                createUnit("UNIT-RANGE", "Unit range", CatalogOwnerApi.UnitDimension.COUNT, 0);
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
        draft.put("salesUnitRef", salesUnit.unitRef().toString());
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
        assertEquals(salesUnit.unitRef().toString(), detail.path("salesUnitRef").asText());
        assertEquals(
                salesUnit.unitRef().toString(),
                detail.path("salesUnit").path("unitRef").asText());
        assertEquals(salesUnit.code(), detail.path("salesUnit").path("code").asText());
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
    void itemReadbacksProjectSelectedAttributeNamesWithoutWideningTheSaveReadback() {
        UUID firstOptionRef = UUID.randomUUID();
        UUID secondOptionRef = UUID.randomUUID();
        String definitionCode = generatedCatalogCode("READBACK-ATTRIBUTE");
        CatalogOwnerApi.AttributeDefinitionReadback definition = service.createAttributeDefinition(
                context("createOperationsCatalogAttributeDefinition", SCOPE, "attribute-readback-definition"),
                new CatalogOwnerApi.AttributeDefinitionCreateCommand(
                        definitionCode,
                        "展示属性",
                        "MULTI_SELECT",
                        List.of(
                                new CatalogOwnerApi.AttributeDefinitionOption(firstOptionRef, "第一项", 0),
                                new CatalogOwnerApi.AttributeDefinitionOption(secondOptionRef, "第二项", 1))),
                "attribute-readback-definition-key");
        String itemCode = generatedCatalogCode("ATTRIBUTE-READBACK");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "attribute readback")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = request.putObject("sections")
                .put("expectedCatalogVersion", created.path("version").asLong())
                .putObject("catalogDraft");
        draft.putArray("attributeAssignments")
                .addObject()
                .put("definitionRef", definition.definitionRef().toString())
                .putArray("optionRefs")
                .add(firstOptionRef.toString())
                .add(secondOptionRef.toString());

        JsonNode saved = write("saveOperationsCatalogItem", request);
        JsonNode savedAssignment =
                saved.path("item").path("attributeAssignments").get(0);
        assertFalse(savedAssignment.has("selectedOptionNames"));

        JsonNode detail = service.readItem(SCOPE.toString(), BRAND, itemCode, "attribute-readback-detail")
                .path("data")
                .path("item");
        JsonNode detailAssignment = detail.path("attributeAssignments").get(0);
        assertEquals(
                List.of("第一项", "第二项"),
                MAPPER.convertValue(
                        detailAssignment.path("selectedOptionNames"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        assertEquals(
                List.of("第一项", "第二项"),
                MAPPER.convertValue(
                        detail.path("attributeFacts").get(0).path("selectedOptionNames"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));

        ObjectNode listRequest = MAPPER.createObjectNode();
        listRequest.putArray("itemCodes").add(itemCode);
        JsonNode listItem = service.readItems(SCOPE.toString(), BRAND, listRequest, "attribute-readback-list")
                .path("data")
                .path("items")
                .get(0);
        assertEquals(
                List.of("第一项", "第二项"),
                MAPPER.convertValue(
                        listItem.path("attributeFacts").get(0).path("selectedOptionNames"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
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
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DISABLED','{}'::jsonb,1,1,1)",
                probeItemRef,
                SCOPE.toString(),
                BRAND,
                generatedCatalogCode("SKU-CODE-PROBE"),
                "sku code probe");
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest,updated_at_epoch_millis) VALUES(?,?, 'DUPLICATE-CODE', 'first', "
                        + "true, 'ENABLED', 0, 'digest-first', 1)",
                UUID.randomUUID(),
                probeItemRef);
        assertThrows(
                DataIntegrityViolationException.class,
                () -> jdbc.update(
                        "INSERT INTO "
                                + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,dis"
                                + "play"
                                + "_order,variant_combination_digest,updated_at_epoch_millis) VALUES(?,?, "
                                + "'DUPLICATE-CODE', "
                                + "'second', false, 'ENABLED', 1, 'digest-second', 1)",
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
    void skuItemActivationUsesRelationalSkuFactsWhenTheReadProjectionIsNotPersisted() {
        String itemCode = generatedCatalogCode("SKU-ACTIVATION-RELATIONAL");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "relational SKU activation")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID skuRef = UUID.randomUUID();
        ObjectNode save = skuSave(itemCode, created.path("version").asLong(), skuRef, "RELATIONAL-SKU");
        ((ObjectNode) save.path("sections").path("catalogDraft").path("skus").get(0)).put("standardSalePrice", 12800);
        JsonNode saved = write("saveOperationsCatalogItem", save);

        assertFalse(
                jdbc.queryForObject(
                        "SELECT jsonb_exists(sections, 'skus') FROM catalog.catalog_item WHERE item_ref=?",
                        Boolean.class,
                        UUID.fromString(created.path("resourceRef").asText())),
                "the stored item JSON must not be mistaken for the hydrated SKU read projection");
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku WHERE item_ref=? AND status='ENABLED' "
                                + "AND standard_sale_price=12800",
                        Integer.class,
                        UUID.fromString(created.path("resourceRef").asText())));

        JsonNode enabled = write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", itemCode)
                        .put("expectedVersion", saved.path("version").asLong())
                        .put("targetStatus", "ENABLED"));
        assertEquals("ENABLED", enabled.path("status").asText());
        assertEquals(
                "ENABLED",
                service.readItem(SCOPE.toString(), BRAND, itemCode, "sku-activation-relational-readback")
                        .path("data")
                        .path("item")
                        .path("lifecycle")
                        .path("status")
                        .asText());
    }

    @Test
    void skuItemActivationAllowsRelationalSkuWithoutPriceWhenTheReadProjectionIsNotPersisted() {
        String itemCode = generatedCatalogCode("SKU-ACTIVATION-MISSING-PRICE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "relational SKU missing price")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID itemRef = UUID.fromString(created.path("resourceRef").asText());
        UUID skuRef = UUID.randomUUID();
        JsonNode saved = write(
                "saveOperationsCatalogItem",
                skuSave(itemCode, created.path("version").asLong(), skuRef, "MISSING-PRICE-SKU"));

        assertFalse(
                jdbc.queryForObject(
                        "SELECT jsonb_exists(sections, 'skus') FROM catalog.catalog_item WHERE item_ref=?",
                        Boolean.class,
                        itemRef),
                "the stored item JSON must not be mistaken for the hydrated SKU read projection");
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku WHERE item_ref=? AND status='ENABLED' "
                                + "AND standard_sale_price IS NULL",
                        Integer.class,
                        itemRef));

        JsonNode enabled = write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", itemCode)
                        .put("expectedVersion", saved.path("version").asLong())
                        .put("targetStatus", "ENABLED"));
        assertEquals("ENABLED", enabled.path("status").asText());
        assertEquals(saved.path("version").asLong() + 1, enabled.path("version").asLong());
        assertEquals(
                "ENABLED",
                jdbc.queryForObject("SELECT status FROM catalog.catalog_item WHERE item_ref=?", String.class, itemRef));
    }

    @Test
    void itemActivationAllowsMissingPriceBecauseMenuOwnsPriceRequirement() {
        String itemCode = generatedCatalogCode("ITEM-ACTIVATION-MISSING-PRICE");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "item without price")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID itemRef = UUID.fromString(created.path("resourceRef").asText());

        JsonNode enabled = write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", itemCode)
                        .put("expectedVersion", created.path("version").asLong())
                        .put("targetStatus", "ENABLED"));
        assertEquals("ENABLED", enabled.path("status").asText());
        assertEquals(
                created.path("version").asLong() + 1, enabled.path("version").asLong());
        assertEquals(
                "ENABLED",
                jdbc.queryForObject("SELECT status FROM catalog.catalog_item WHERE item_ref=?", String.class, itemRef));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_item "
                                + "WHERE item_ref=? AND jsonb_exists(sections, 'standardSalePrice')",
                        Integer.class,
                        itemRef));
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
                        MAPPER.createObjectNode()
                                .put("itemCode", skuItemCode)
                                .putObject("sections")
                                .put(
                                        "expectedCatalogVersion",
                                        skuItem.path("version").asLong())
                                .putObject("catalogDraft")
                                .putArray("orderOptionConfigs")
                                .addObject()
                                .put("definitionRef", UUID.randomUUID().toString())
                                .put("required", false)
                                .set("values", MAPPER.createArrayNode())));
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
                .putObject("inventoryRules");
        ObjectNode bomNode = bomDraft.putArray("nodes").addObject();
        bomNode.putObject("owner")
                .put("ownerType", "ITEM")
                .put("itemRef", skuItem.path("resourceRef").asText())
                .putNull("productSkuRef")
                .putNull("optionValueRef");
        bomNode.put("mode", "BOM")
                .putNull("consumptionUnitSnapshot")
                .putNull("expectedTargetVersion")
                .putNull("expectedBomVersion")
                .putNull("directConfiguration");
        bomNode.putObject("bom").putArray("lines");
        CatalogOwnerApi.Problem optionValueRejected = assertThrows(
                CatalogOwnerApi.Problem.class, () -> coordinatorSave(optionValueBom, "shape-admission-sku-item"));
        assertEquals("INVENTORY_DEDUCTION_MODE_NOT_ALLOWED", optionValueRejected.code());
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
        ObjectNode serviceSections = serviceBom
                .putObject("sections")
                .put("expectedCatalogVersion", serviceItem.path("version").asLong())
                .putObject("inventoryRules");
        ObjectNode serviceNode = serviceSections.putArray("nodes").addObject();
        serviceNode
                .putObject("owner")
                .put("ownerType", "ITEM")
                .put("itemRef", serviceItem.path("resourceRef").asText())
                .putNull("productSkuRef")
                .putNull("optionValueRef");
        serviceNode
                .put("mode", "BOM")
                .putNull("consumptionUnitSnapshot")
                .putNull("expectedTargetVersion")
                .putNull("expectedBomVersion")
                .putNull("directConfiguration");
        serviceNode.putObject("bom").putArray("lines");
        CatalogOwnerApi.Problem serviceBomRejected = assertThrows(
                CatalogOwnerApi.Problem.class, () -> coordinatorSave(serviceBom, "shape-admission-service"));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", serviceBomRejected.code());

        String standardItemCode = generatedCatalogCode("OPTION-VALUE-MODE");
        JsonNode standardItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", standardItemCode)
                        .put("name", "option value mode")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        ObjectNode invalidOptionMode = MAPPER.createObjectNode().put("itemCode", standardItemCode);
        ObjectNode invalidOptionSections = invalidOptionMode
                .putObject("sections")
                .put("expectedCatalogVersion", standardItem.path("version").asLong())
                .putObject("inventoryRules");
        ObjectNode invalidOptionNode = invalidOptionSections.putArray("nodes").addObject();
        invalidOptionNode
                .putObject("owner")
                .put("ownerType", "OPTION_VALUE")
                .put("itemRef", standardItem.path("resourceRef").asText())
                .putNull("productSkuRef")
                .put("optionValueRef", UUID.randomUUID().toString());
        invalidOptionNode
                .put("mode", "DIRECT")
                .putNull("consumptionUnitSnapshot")
                .putNull("expectedTargetVersion")
                .putNull("expectedBomVersion");
        invalidOptionNode
                .putObject("directConfiguration")
                .put("allowNegative", false)
                .putNull("lowStockThreshold")
                .putNull("countingUnitRef")
                .put("conversionFactor", "1");
        invalidOptionNode.putNull("bom");
        CatalogOwnerApi.Problem invalidOptionModeRejected = assertThrows(
                CatalogOwnerApi.Problem.class, () -> coordinatorSave(invalidOptionMode, "shape-admission-option"));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", invalidOptionModeRejected.code());
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
        assertTrue(
                listItem.path("hasSkuChildren").asBoolean(),
                "SKU-managed parent list rows declare their expandable child relation from the owner SKU facts");

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
        assertTrue(
                archivedListItem.path("hasSkuChildren").asBoolean(),
                "archiving one of several SKU rows does not remove the parent row's expandable child relation");
    }

    @Test
    void categoryStatusTransitionReturnsCanonicalReadbackAndReplaysOnlyAfterOwnerFactRecheck() throws Exception {
        JsonNode root = create("VOID-ROOT", "void root", null);
        ObjectNode request = MAPPER.createObjectNode()
                .put("categoryRef", root.path("categoryRef").asText())
                .put("expectedVersion", root.path("version").asLong())
                .put("targetStatus", "VOIDED");

        JsonNode first =
                writeFull("transitionOperationsCatalogCategoryStatus", request, "void-first", "void-replay-key");
        JsonNode result = first.path("result");
        assertEquals(
                root.path("categoryRef").asText(), result.path("categoryRef").asText());
        assertEquals("VOIDED", result.path("status").asText());
        assertEquals(root.path("version").asLong() + 1L, result.path("version").asLong());

        JsonNode replay =
                writeFull("transitionOperationsCatalogCategoryStatus", request, "void-replay", "void-replay-key");
        JsonNode replayResult = replay.path("result");
        // command_receipt.response is JSONB: PostgreSQL may reorder object fields, and Jackson may choose a
        // different integral node type after the persisted response is parsed. Compare the JSON value, not those
        // transport representations, while retaining an exact deep comparison of every field and nested value.
        assertEquals(MAPPER.readTree(result.toString()), MAPPER.readTree(replayResult.toString()));

        CatalogOwnerApi.Problem mismatchedReplay = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull(
                        "transitionOperationsCatalogCategoryStatus",
                        request.deepCopy()
                                .put("expectedVersion", root.path("version").asLong() + 1),
                        "void-mismatch",
                        "void-replay-key"));
        assertEquals("IDEMPOTENCY_MISMATCH", mismatchedReplay.code());

        CatalogOwnerApi.Problem newKeyAfterVoid = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull("transitionOperationsCatalogCategoryStatus", request, "void-new-key", "void-new-key"));
        assertEquals("VOIDED_RECORD_IMMUTABLE", newKeyAfterVoid.code());

        JsonNode stale = create("VOID-STALE", "void stale", null);
        JsonNode updated = write(
                "updateOperationsCatalogCategory",
                MAPPER.createObjectNode()
                        .put("categoryRef", stale.path("categoryRef").asText())
                        .put("expectedVersion", stale.path("version").asLong())
                        .put("name", "void stale updated"));
        assertEquals(
                stale.path("version").asLong() + 1L, updated.path("version").asLong());
        CatalogOwnerApi.Problem staleTransition = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> writeFull(
                        "transitionOperationsCatalogCategoryStatus",
                        MAPPER.createObjectNode()
                                .put("categoryRef", stale.path("categoryRef").asText())
                                .put("expectedVersion", stale.path("version").asLong())
                                .put("targetStatus", "VOIDED"),
                        "void-stale",
                        "void-stale-key"));
        assertEquals("VERSION_CONFLICT", staleTransition.code());
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
        CatalogOwnerApi.UnitDefinitionReadback each =
                createUnit("INVENTORY-EACH", "Each", CatalogOwnerApi.UnitDimension.COUNT, 0);
        CatalogOwnerApi.UnitDefinitionReadback kilogram =
                createUnit("INVENTORY-KILOGRAM", "Kilogram", CatalogOwnerApi.UnitDimension.WEIGHT, 3);
        CatalogOwnerApi.UnitDefinitionReadback gram =
                createUnit("INVENTORY-GRAM", "Gram", CatalogOwnerApi.UnitDimension.WEIGHT, 3);
        write(
                "saveOperationsCatalogItem",
                itemUnitSave(itemCode, created.path("version").asLong(), each, each));
        JsonNode componentItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", "COMPONENT-01")
                        .put("name", "inventory component")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID componentItemRef =
                UUID.fromString(componentItem.path("resourceRef").asText());
        UUID componentTargetRef = UUID.randomUUID();
        insertStockTargetWithUnits(
                componentTargetRef,
                componentItemRef,
                null,
                "COMPONENT-01",
                null,
                kilogram,
                gram,
                true,
                true,
                "3.5",
                "2");
        String bomRows =
                "[{\"targetRef\":\"" + componentTargetRef + "\",\"quantity\":\"2\",\"lineSign\":\"POSITIVE\"}]";
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
                .path("inventoryRules")
                .path("nodes");

        assertEquals(1, nodes.size());
        JsonNode target = nodes.get(0);
        assertEquals("BOM", target.path("mode").asText());
        JsonNode component = target.path("bom").path("lines").get(0);
        assertEquals(componentTargetRef.toString(), component.path("targetRef").asText());
        assertEquals(
                kilogram.unitRef().toString(),
                component.path("consumptionUnitSnapshot").path("unitRef").asText());
        assertEquals(
                "WEIGHT",
                component.path("consumptionUnitSnapshot").path("unitDimension").asText());
        assertFalse(component.has("unit"));
        assertEquals("2", component.path("quantity").asText());
        assertEquals("POSITIVE", component.path("lineSign").asText());
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
        CatalogOwnerApi.UnitDefinitionReadback each =
                createUnit("BATCH-INVENTORY-EACH", "Each", CatalogOwnerApi.UnitDimension.COUNT, 0);
        CatalogOwnerApi.UnitDefinitionReadback box =
                createUnit("BATCH-INVENTORY-BOX", "Box", CatalogOwnerApi.UnitDimension.COUNT, 0);
        JsonNode withUnits = write(
                "saveOperationsCatalogItem",
                itemUnitSave(itemCode, created.path("version").asLong(), each, each));
        UUID targetRef = UUID.randomUUID();
        insertStockTargetWithUnits(targetRef, itemRef, null, itemCode, null, each, box, false, false, "2", "1.5");
        CatalogInventoryCoordinator coordinator = coordinatorForSave();
        JsonNode before = coordinator
                .readCatalogItem(SCOPE.toString(), BRAND, itemCode, MAPPER.createObjectNode(), "batch-category-before")
                .path("data")
                .path("item")
                .path("inventoryRules")
                .path("nodes")
                .deepCopy();
        JsonNode category = create(generatedCatalogCode("BATCH-CATEGORY"), "批量分类", null);

        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode sections = request.putObject("sections")
                .put("expectedCatalogVersion", withUnits.path("version").asLong());
        ObjectNode draft = sections.putObject("catalogDraft");
        draft.put("name", "batch category inventory").put("shapeKey", "STANDARD_SALE_COUNTED");
        putItemUnitRefs(draft, each, each);
        draft.putArray("images");
        draft.putArray("categoryRefs").add(category.path("categoryRef").asText());
        ArrayNode submittedInventoryNodes = MAPPER.createArrayNode();
        ObjectNode submittedInventoryNode = submittedInventoryNodes.addObject();
        submittedInventoryNode.set("owner", before.get(0).path("owner").deepCopy());
        submittedInventoryNode.put("mode", "DIRECT");
        submittedInventoryNode.set("consumptionUnitSnapshot", unitSnapshot(each));
        submittedInventoryNode.put("expectedTargetVersion", 1L);
        submittedInventoryNode.putNull("expectedBomVersion");
        ObjectNode submittedDirect = submittedInventoryNode.putObject("directConfiguration");
        submittedDirect
                .put("targetRef", targetRef.toString())
                .put("allowNegative", false)
                .put("lowStockThreshold", "2")
                .put("countingUnitRef", box.unitRef().toString())
                .set("countingUnitSnapshot", unitSnapshot(box));
        submittedDirect.put("conversionFactor", "1.5");
        submittedInventoryNode.putNull("bom");
        sections.putObject("inventoryRules").set("nodes", submittedInventoryNodes);

        new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource()))
                .executeWithoutResult(status -> coordinator.saveCatalogItem(
                        context("saveOperationsCatalogItem", SCOPE, "batch-category-save"),
                        new CatalogOwnerApi.CatalogItemSaveCommand(itemCode, canonical(request)),
                        List.of(),
                        "batch-category-save-key"));

        JsonNode after = coordinator
                .readCatalogItem(SCOPE.toString(), BRAND, itemCode, MAPPER.createObjectNode(), "batch-category-after")
                .path("data")
                .path("item")
                .path("inventoryRules")
                .path("nodes");
        assertEquals(
                before,
                after,
                () -> "a category-only batch save must not retire or rewrite inventory facts; before="
                        + before
                        + "; after="
                        + after);
        assertEquals(
                targetRef.toString(),
                after.get(0).path("directConfiguration").path("targetRef").asText());
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

    private static CatalogOwnerApi.CatalogItemSaveReadback coordinatorSave(ObjectNode request, String requestId) {
        ObjectNode effectiveRequest = withDefaultUnitFacts(request);
        CatalogInventoryCoordinator coordinator = coordinatorForSave();
        return new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource()))
                .execute(status -> coordinator.saveCatalogItem(
                        context("saveOperationsCatalogItem", SCOPE, requestId),
                        new CatalogOwnerApi.CatalogItemSaveCommand(
                                effectiveRequest.path("itemCode").asText(), canonical(effectiveRequest)),
                        List.of(),
                        requestId + "-key"));
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
        assertEquals(
                created.path("resourceRef").asText(),
                replayResult.path("item").path("itemRef").asText());
        assertTrue(replayResult.path("inventoryRules").path("nodes").isArray());
        assertEquals(0, replayResult.path("inventoryRules").path("nodes").size());
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
                        + "(item_ref,data_node_ref,brand_ref,code,name,short_name,shape_key,status,sections,"
                        + "vers"
                        + "ion,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "SELECT md5('short-name-index-noise-' || value)::uuid, ?, ?, 'SHORT-NAME-NOISE-' || value, "
                        + "'noise name', 'noise short name', 'STANDARD_SALE_COUNTED', 'DISABLED', "
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
    void voidIsBlockedByAnyReferencedDescendantAndSaveRejectsBusinessCodes() {
        JsonNode root = create("BLOCK-ROOT", "root", null);
        JsonNode child = create("BLOCK-CHILD", "child", root.path("categoryRef").asText());
        UUID blockingItemRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_item "
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'STANDARD_SALE_COUNTED','DISABLED','{}'::jsonb,1,1,1)",
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
                        "transitionOperationsCatalogCategoryStatus",
                        MAPPER.createObjectNode()
                                .put("categoryRef", root.path("categoryRef").asText())
                                .put("expectedVersion", root.path("version").asLong())
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
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
                        .path("blockingReferences")
                        .path("references")
                        .get(0)
                        .path("name")
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
    void categoryVoidObservesACompletedSaveAsItsLinearizedReferenceState() {
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
                        "transitionOperationsCatalogCategoryStatus",
                        MAPPER.createObjectNode()
                                .put("categoryRef", category.path("categoryRef").asText())
                                .put("expectedVersion", category.path("version").asLong())
                                .put("targetStatus", "VOIDED")));
        assertEquals("REFERENCE_BLOCKS_VOID", blocked.code());
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
        JsonNode componentEnabled = write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", componentCode)
                        .put("expectedVersion", component.path("version").asLong())
                        .put("targetStatus", "ENABLED"));
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
                                        componentEnabled.path("version").asLong())
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
    void unitDefinitionSnapshotsAndDictionaryReferencesHaveIndependentLifecycleRules() {
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
        CatalogOwnerApi.UnitDefinitionReadback usedUnit =
                createUnit("SNAPSHOT-UNIT-USED", "Snapshot unit used", CatalogOwnerApi.UnitDimension.COUNT, 0);
        CatalogOwnerApi.UnitDefinitionReadback freeUnit =
                createUnit("SNAPSHOT-UNIT-FREE", "Snapshot unit free", CatalogOwnerApi.UnitDimension.COUNT, 0);
        JsonNode before = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "TAG",
                        MAPPER.createObjectNode().put("dictionaryKind", "TAG"),
                        "dictionary-snapshot-before")
                .path("data")
                .path("entries");
        String usedRef =
                dictionaryEntry(before, "SNAPSHOT-USED").path("entryRef").asText();
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
        draft.put("salesUnitRef", usedUnit.unitRef().toString());
        write("saveOperationsCatalogItem", save);

        JsonNode detail = service.readItem(SCOPE.toString(), BRAND, "SNAPSHOT-ITEM", "unit-snapshot-detail")
                .path("data")
                .path("item");
        assertEquals(usedUnit.unitRef().toString(), detail.path("salesUnitRef").asText());
        assertEquals(
                usedUnit.unitRef().toString(),
                detail.path("salesUnit").path("unitRef").asText());
        assertEquals(usedUnit.code(), detail.path("salesUnit").path("code").asText());
        assertEquals("ENABLED", detail.path("salesUnit").path("status").asText());

        JsonNode entries = service.readDictionary(
                        SCOPE.toString(),
                        BRAND,
                        "TAG",
                        MAPPER.createObjectNode().put("dictionaryKind", "TAG"),
                        "dictionary-snapshot-after")
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
        CatalogOwnerApi.UnitDefinitionReadback disabledUnit = service.transitionUnitStatus(
                context("transitionOperationsCatalogUnitStatus", SCOPE, "disable-snapshot-unit"),
                new CatalogOwnerApi.UnitDefinitionStatusTransitionCommand(
                        usedUnit.unitRef(), usedUnit.version(), "DISABLED"),
                "disable-snapshot-unit-key");
        assertEquals("DISABLED", disabledUnit.status());
        JsonNode disabledDetail = service.readItem(SCOPE.toString(), BRAND, "SNAPSHOT-ITEM", "unit-snapshot-disabled")
                .path("data")
                .path("item");
        assertEquals(
                usedUnit.unitRef().toString(),
                disabledDetail.path("salesUnitRef").asText());
        assertEquals(
                usedUnit.code(), disabledDetail.path("salesUnit").path("code").asText());
        assertEquals("DISABLED", disabledDetail.path("salesUnit").path("status").asText());

        CatalogOwnerApi.UnitDefinitionListReadback activeUnits =
                service.listUnitDefinitions(SCOPE.toString(), BRAND, false, null, null, null);
        assertTrue(activeUnits.units().stream()
                .noneMatch(unit -> usedUnit.unitRef().equals(unit.unitRef())));
        CatalogOwnerApi.UnitDefinitionListReadback allUnits =
                service.listUnitDefinitions(SCOPE.toString(), BRAND, true, null, null, null);
        assertEquals(
                "DISABLED",
                allUnits.units().stream()
                        .filter(unit -> usedUnit.unitRef().equals(unit.unitRef()))
                        .findFirst()
                        .orElseThrow()
                        .status());

        CatalogOwnerApi.Problem unitBlocked = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> service.transitionUnitStatus(
                        context("transitionOperationsCatalogUnitStatus", SCOPE, "void-snapshot-unit"),
                        new CatalogOwnerApi.UnitDefinitionStatusTransitionCommand(
                                usedUnit.unitRef(), disabledUnit.version(), "VOIDED"),
                        "void-snapshot-unit-key"));
        assertEquals("REFERENCE_BLOCKS_VOID", unitBlocked.code(), unitBlocked.getMessage());

        CatalogOwnerApi.UnitDefinitionReadback voidedUnit = service.transitionUnitStatus(
                context("transitionOperationsCatalogUnitStatus", SCOPE, "void-free-snapshot-unit"),
                new CatalogOwnerApi.UnitDefinitionStatusTransitionCommand(
                        freeUnit.unitRef(), freeUnit.version(), "VOIDED"),
                "void-free-snapshot-unit-key");
        assertEquals("VOIDED", voidedUnit.status());
        assertTrue(service.listUnitDefinitions(SCOPE.toString(), BRAND, false, null, null, null).units().stream()
                .noneMatch(unit -> freeUnit.unitRef().equals(unit.unitRef())));
    }

    @Test
    void productSkuRefCannotCrossTheDeclaredItemRelation() {
        String ownerItemCode = "SKU-OWNER-" + UUID.randomUUID();
        JsonNode ownerItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", ownerItemCode)
                        .put("name", "SKU owner")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID ownerItemRef = UUID.fromString(ownerItem.path("resourceRef").asText());
        UUID ownerSkuRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,"
                        + "display_order,variant_combination_digest,updated_at_epoch_millis) "
                        + "VALUES(?,?,?, ?,true,'ENABLED',0,?,1)",
                ownerSkuRef,
                ownerItemRef,
                "OWNER-SKU",
                "Owner SKU",
                "owner-sku-" + ownerSkuRef);
        String currentItemCode = "SKU-CROSS-" + UUID.randomUUID();
        JsonNode currentItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", currentItemCode)
                        .put("name", "SKU cross")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID currentItemRef = UUID.fromString(currentItem.path("resourceRef").asText());
        UUID currentSkuRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,"
                        + "display_order,variant_combination_digest,updated_at_epoch_millis) "
                        + "VALUES(?,?,?, ?,true,'ENABLED',0,?,1)",
                currentSkuRef,
                currentItemRef,
                "CURRENT-SKU",
                "Current SKU",
                "current-sku-" + currentSkuRef);
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", currentItemCode);
        ObjectNode sections = save.putObject("sections")
                .put("expectedCatalogVersion", currentItem.path("version").asLong());
        sections.putObject("catalogDraft");
        ObjectNode rules = sections.putObject("inventoryRules");
        ObjectNode node = rules.putArray("nodes").addObject();
        node.putObject("owner")
                .put("ownerType", "SKU")
                .put("itemRef", currentItemRef.toString())
                .put("productSkuRef", ownerSkuRef.toString())
                .put("skuCode", "OWNER-SKU")
                .putNull("optionValueRef");
        node.put("mode", "NONE")
                .putNull("consumptionUnitSnapshot")
                .putNull("expectedTargetVersion")
                .putNull("expectedBomVersion")
                .putNull("directConfiguration")
                .putNull("bom");
        CatalogOwnerApi.Problem rejected =
                assertThrows(CatalogOwnerApi.Problem.class, () -> coordinatorSave(save, "shape-admission-cross-sku"));
        assertEquals(
                "REFERENCE_MAPPING_UNRESOLVED",
                rejected.code(),
                () -> "unexpected cross-SKU rejection: " + rejected.code() + ": " + rejected.getMessage());
    }

    @Test
    void skuOwnerCannotBeSubmittedForAnOrdinaryItemWithoutASkuOwnerShape() {
        String currentItemCode = "SKU-LINK-CURRENT-" + UUID.randomUUID();
        JsonNode currentItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", currentItemCode)
                        .put("name", "current")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID currentItemRef = UUID.fromString(currentItem.path("resourceRef").asText());
        JsonNode referencedItem = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", "SKU-LINK-REF-" + UUID.randomUUID())
                        .put("name", "referenced")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        UUID referencedItemRef =
                UUID.fromString(referencedItem.path("resourceRef").asText());
        UUID referencedSkuRef = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest,updated_at_epoch_millis) VALUES(?,?, 'LINK-SKU', 'linked SKU', "
                        + "true, 'ENABLED', 0, 'link-sku', 1)",
                referencedSkuRef,
                referencedItemRef);
        ObjectNode save = MAPPER.createObjectNode().put("itemCode", currentItemCode);
        ObjectNode sections = save.putObject("sections")
                .put("expectedCatalogVersion", currentItem.path("version").asLong());
        sections.putObject("catalogDraft");
        ObjectNode rules = sections.putObject("inventoryRules");
        ObjectNode node = rules.putArray("nodes").addObject();
        node.putObject("owner")
                .put("ownerType", "SKU")
                .put("itemRef", currentItemRef.toString())
                .put("productSkuRef", referencedSkuRef.toString())
                .putNull("skuCode")
                .putNull("optionValueRef");
        node.put("mode", "NONE")
                .putNull("consumptionUnitSnapshot")
                .putNull("expectedTargetVersion")
                .putNull("expectedBomVersion")
                .putNull("directConfiguration")
                .putNull("bom");

        CatalogOwnerApi.Problem rejected = assertThrows(
                CatalogOwnerApi.Problem.class, () -> coordinatorSave(save, "shape-admission-ordinary-item"));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", rejected.code());
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
                .put("displayOrder", 0)
                .put("isDefault", true)
                .put("status", "ENABLED")
                .put("version", 0);
        sourceSku
                .putNull("standardSalePrice")
                .putNull("salesUnitOverrideRef")
                .putNull("baseMeasureUnitOverrideRef")
                .putArray("identifiers");
        sourceSku.putObject("preparationOverride").put("mode", "INHERIT_ITEM").putNull("profile");
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
                "tagRefs")) {
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
    void itemVoidAvailabilityUsesTheSameBusinessReasonsThatItShowsForSkuBlockers() {
        String itemCode = generatedCatalogCode("VOID-SKU-REASONS");
        JsonNode created = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", itemCode)
                        .put("name", "sku void blocker")
                        .put("shapeKey", "STANDARD_SALE_COUNTED"));
        write(
                "saveOperationsCatalogItem",
                skuSave(itemCode, created.path("version").asLong(), UUID.randomUUID(), "VOID-SKU"));

        JsonNode availability = service.readItem(SCOPE.toString(), BRAND, itemCode, "void-sku-reasons")
                .path("data")
                .path("actionAvailability")
                .path("voidAvailability");

        assertFalse(availability.path("canVoid").asBoolean());
        assertTrue(
                java.util.stream.StreamSupport.stream(
                                availability.path("blockingReasons").spliterator(), false)
                        .anyMatch(reason ->
                                "HAS_SKUS".equals(reason.path("reasonCode").asText())
                                        && reason.path("count").asLong() == 1L),
                "不可作废的 SKU 父商品必须返回同一条可见阻断原因");
    }

    @Test
    void skuOwnershipValidationExecutesARefBoundLockQuery() {
        RecordingJdbcTemplate recordingJdbc = new RecordingJdbcTemplate(dataSource());
        InventoryOwnerService recordingInventory =
                new InventoryOwnerService(recordingJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L);
        ProductionTagOwnerService recordingProduction =
                new ProductionTagOwnerService(
                        new ProductionTagOwnerPersistence(
                                recordingJdbc, (TimeProvider) () -> 1_785_000_000_000L),
                        MAPPER);
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
                recordingJdbc,
                MAPPER,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                null,
                new InventoryOwnerService(recordingJdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L));
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
        assertTrue(
                java.util.stream.StreamSupport.stream(
                                skuDetail(detail, firstSkuRef)
                                        .path("voidAvailability")
                                        .path("blockingReasons")
                                        .spliterator(),
                                false)
                        .anyMatch(reason -> "USED_BY_PACKAGE"
                                        .equals(reason.path("reasonCode").asText())
                                && reason.path("count").asLong() == 1L
                                && "SKU inbound owner"
                                        .equals(reason.path("relatedItemNames")
                                                .path(0)
                                                .asText())),
                "不可作废的规格必须返回同一条可见阻断原因");
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
                        .filter(sql -> sql.contains("product_sku_ref=ANY(?::uuid[])")
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
    void dictionaryCommandsReturnThePersistedOpaqueEntryRefWithoutASecondRead() {
        String code = generatedCatalogCode("DICT-READBACK");
        JsonNode created = write(
                "createOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "TAG")
                        .put("code", code)
                        .put("name", "回读标签"));

        UUID entryRef = UUID.fromString(created.path("entryRef").asText());
        assertEquals(
                entryRef,
                jdbc.queryForObject(
                        "SELECT entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? "
                                + "AND dictionary_kind=? AND code=?",
                        UUID.class,
                        SCOPE.toString(),
                        BRAND,
                        "TAG",
                        code));

        JsonNode updated = write(
                "updateOperationsCatalogDictionaryEntry",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "TAG")
                        .put("entryCode", code)
                        .put("expectedVersion", created.path("version").asLong())
                        .put("name", "回读标签已更新"));
        assertEquals(entryRef.toString(), updated.path("entryRef").asText());

        JsonNode transitioned = write(
                "transitionOperationsCatalogDictionaryEntryStatus",
                MAPPER.createObjectNode()
                        .put("dictionaryKind", "TAG")
                        .put("entryCode", code)
                        .put("expectedVersion", updated.path("version").asLong())
                        .put("targetStatus", "DISABLED"));
        assertEquals(entryRef.toString(), transitioned.path("entryRef").asText());
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
        assertEquals(itemFirst.toString(), detail.path("primaryImageAssetRef").asText());
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
                        .put("shapeKey", "COMPOSITE"));
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
    void compositeGroupReferencingASpecificSkuReturnsTheComponentAndSkuBusinessNames() {
        String componentCode = generatedCatalogCode("COMPOSITE-SKU-COMPONENT");
        JsonNode component = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", componentCode)
                        .put("name", "拿铁咖啡")
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        UUID componentSkuRef = UUID.randomUUID();
        ObjectNode componentSkuSave =
                skuSave(componentCode, component.path("version").asLong(), componentSkuRef, "LATTE-MEDIUM");
        ((ObjectNode) componentSkuSave
                        .path("sections")
                        .path("catalogDraft")
                        .path("skus")
                        .get(0))
                .put("skuName", "中杯拿铁");
        JsonNode componentSaved = write("saveOperationsCatalogItem", componentSkuSave);
        write(
                "transitionOperationsCatalogItemStatus",
                MAPPER.createObjectNode()
                        .put("itemCode", componentCode)
                        .put("expectedVersion", componentSaved.path("version").asLong())
                        .put("targetStatus", "ENABLED"));

        String parentCode = generatedCatalogCode("COMPOSITE-SKU-PARENT");
        JsonNode parent = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", parentCode)
                        .put("name", "双人晚餐套餐")
                        .put("shapeKey", "COMPOSITE"));
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", parentCode);
        ObjectNode group = request.putObject("sections")
                .put("expectedCatalogVersion", parent.path("version").asLong())
                .putObject("catalogDraft")
                .putArray("compositeGroups")
                .addObject();
        group.put("groupCode", "DRINK")
                .put("groupName", "饮品")
                .put("selectionRule", "REQUIRED")
                .put("minSelections", 1)
                .put("maxSelections", 1);
        group.putArray("components")
                .addObject()
                .put("itemRef", component.path("resourceRef").asText())
                .put("productSkuRef", componentSkuRef.toString())
                .put("skuCode", "LATTE-MEDIUM")
                .put("quantity", "1")
                .put("unit", "份")
                .put("default", true)
                .put("status", "ENABLED");
        write("saveOperationsCatalogItem", request);

        UUID componentItemRef = UUID.fromString(component.path("resourceRef").asText());
        assertEquals(
                "拿铁咖啡",
                jdbc.queryForObject(
                        "SELECT name FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=? AND item_ref=?",
                        String.class,
                        SCOPE.toString(),
                        BRAND,
                        componentItemRef));
        assertEquals(
                componentItemRef,
                jdbc.queryForObject(
                        "SELECT component.component_item_ref "
                                + "FROM catalog.catalog_composite_component component JOIN "
                                + "catalog.catalog_composite_group group_row ON "
                                + "group_row.composite_group_ref=component.composite_group_ref "
                                + "WHERE group_row.item_ref=?",
                        UUID.class,
                        UUID.fromString(parent.path("resourceRef").asText())));

        JsonNode detail;
        try {
            detail = service.readItem(SCOPE.toString(), BRAND, parentCode, "composite-sku-readback");
        } catch (CatalogOwnerApi.Problem failure) {
            throw new AssertionError(
                    "composite detail must resolve its outgoing business reference: "
                            + failure.code()
                            + ":"
                            + failure.getMessage(),
                    failure);
        }
        JsonNode componentReadback = detail.path("data")
                .path("item")
                .path("compositeGroups")
                .get(0)
                .path("components")
                .get(0);
        assertEquals("拿铁咖啡", componentReadback.path("itemName").asText());
        assertEquals("中杯拿铁", componentReadback.path("skuName").asText());
        JsonNode outwardReference = detail.path("data").path("references").findValue("referenceRef");
        assertTrue(outwardReference != null, "outbound package component reference must be present");
        assertEquals(componentItemRef.toString(), outwardReference.asText());
        JsonNode references = detail.path("data").path("references");
        assertEquals(1, references.size());
        assertEquals(
                "COMPOSITE_COMPONENT", references.get(0).path("referenceKind").asText());
        assertEquals("拿铁咖啡", references.get(0).path("name").asText());
        assertEquals(componentCode, references.get(0).path("code").asText());
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
            write(
                    "transitionOperationsCatalogItemStatus",
                    MAPPER.createObjectNode()
                            .put("itemCode", componentCode)
                            .put("expectedVersion", component.path("version").asLong())
                            .put("targetStatus", "ENABLED"));
        }
        String parentCode = generatedCatalogCode("COMPOSITE-PARENT");
        JsonNode parent = write(
                "createOperationsCatalogItem",
                MAPPER.createObjectNode()
                        .put("code", parentCode)
                        .put("name", "composite parent")
                        .put("shapeKey", "COMPOSITE"));
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
        JsonNode renamedAttributeSummary = service.readItems(
                        SCOPE.toString(), BRAND, dimensionListRequest, "sku-attribute-name-summary")
                .path("data")
                .path("items")
                .get(0);
        assertEquals(
                "口感",
                renamedAttributeSummary
                        .path("specificationFacts")
                        .get(0)
                        .path("attributeName")
                        .asText());
        assertEquals(
                renamedAttributeDetail.path("specificationFacts"), renamedAttributeSummary.path("specificationFacts"));
        JsonNode skuPage = service.readItemSkus(
                        SCOPE.toString(),
                        BRAND,
                        itemCode,
                        MAPPER.createObjectNode().put("pageSize", 20),
                        "sku-preparation-parity")
                .path("data")
                .path("items");
        assertEquals(
                renamedAttributeDetail.path("skus").get(0).path("preparationFacts"),
                skuPage.get(0).path("preparationFacts"));

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
                "VOIDED",
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
                "VOIDED",
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
                        + "(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,sections,version,cre"
                        + "ated"
                        + "_at_epoch_millis,updated_at_epoch_millis) VALUES "
                        + "(?,?,?,?,?,'SKU_VARIANT_SALE_COUNTED','DISABLED','{}'::jsonb,1,1,1)",
                itemRef,
                SCOPE.toString(),
                BRAND,
                generatedCatalogCode("DIGEST-UNIQUE"),
                "digest unique");
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,display_ord"
                        + "er,v"
                        + "ariant_combination_digest,updated_at_epoch_millis) VALUES(?,?, 'DIGEST-EXISTING', "
                        + "'digest existing', true, 'ENABLED', 0, 'same-combination', 1)",
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

        CatalogOwnerApi.Problem rejected = assertThrows(CatalogOwnerApi.Problem.class, () -> new CatalogSkuFacts(
                        jdbc, MAPPER, (TimeProvider) () -> 1_785_000_000_000L)
                .replace(itemRef, competing, java.util.Set.of()));
        assertEquals("DUPLICATE_VARIANT_COMBINATION", rejected.code());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM catalog.catalog_sku WHERE item_ref=? AND status <> 'VOIDED'",
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
        for (String field : List.of("images")) {
            JsonNode value = currentItem.path(field);
            draft.set(field, value.isMissingNode() ? MAPPER.createArrayNode() : value.deepCopy());
        }
        if (currentItem.has("categoryRef"))
            draft.set("categoryRef", currentItem.path("categoryRef").deepCopy());
        else draft.putNull("categoryRef");
        sections.putObject("inventoryRules").putArray("nodes");
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
                        + "item','STANDARD_SALE_COUNTED','DISABLED','{}'::jsonb,CAST(? AS JSONB),1,1,1)",
                item,
                "legacy-scope",
                BRAND,
                "{\"categoryRefs\":[\"LEGACY-VOID\"]}");
        assertThrows(RuntimeException.class, () -> flyway(LEGACY_POSTGRES, null).migrate());
    }

    private static void insertCategory(UUID scope, UUID ref, String code) {
        insertCategory(scope, ref, code, null);
    }

    private static void insertCategory(UUID scope, UUID ref, String code, UUID parentCategoryRef) {
        jdbc.update(
                "INSERT INTO catalog.catalog_category "
                        + "(category_ref,data_node_ref,brand_ref,code,name,parent_category_ref,status,display_order,"
                        + "version,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES (?,?,?,?,?,?,'ENABLED',0,1,1,1)",
                ref,
                scope.toString(),
                BRAND,
                code,
                code,
                parentCategoryRef);
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

    private static CatalogOwnerApi.UnitDefinitionReadback createUnit(
            String code, String name, CatalogOwnerApi.UnitDimension dimension, int precision) {
        String key = "create-unit-" + code + "-" + UUID.randomUUID();
        return service.createUnitDefinition(
                context("createOperationsCatalogUnit", SCOPE, key),
                new CatalogOwnerApi.UnitDefinitionCreateCommand(code, name, dimension, precision),
                key);
    }

    private static ObjectNode itemUnitSave(
            String itemCode,
            long expectedVersion,
            CatalogOwnerApi.UnitDefinitionReadback salesUnit,
            CatalogOwnerApi.UnitDefinitionReadback baseMeasureUnit) {
        ObjectNode request = MAPPER.createObjectNode().put("itemCode", itemCode);
        ObjectNode draft = request.putObject("sections")
                .put("expectedCatalogVersion", expectedVersion)
                .putObject("catalogDraft");
        putItemUnitRefs(draft, salesUnit, baseMeasureUnit);
        return request;
    }

    private static void putItemUnitRefs(
            ObjectNode draft,
            CatalogOwnerApi.UnitDefinitionReadback salesUnit,
            CatalogOwnerApi.UnitDefinitionReadback baseMeasureUnit) {
        if (salesUnit == null) draft.putNull("salesUnitRef");
        else draft.put("salesUnitRef", salesUnit.unitRef().toString());
        if (baseMeasureUnit == null) draft.putNull("baseMeasureUnitRef");
        else draft.put("baseMeasureUnitRef", baseMeasureUnit.unitRef().toString());
    }

    private static ObjectNode unitSnapshot(CatalogOwnerApi.UnitDefinitionReadback unit) {
        return MAPPER.createObjectNode()
                .put("unitRef", unit.unitRef().toString())
                .put("code", unit.code())
                .put("name", unit.name())
                .put("unitDimension", unit.unitDimension().name())
                .put("precision", unit.precision());
    }

    private static void insertStockTargetWithUnits(
            UUID targetRef,
            UUID itemRef,
            UUID productSkuRef,
            String itemCode,
            String skuCode,
            CatalogOwnerApi.UnitDefinitionReadback consumptionUnit,
            CatalogOwnerApi.UnitDefinitionReadback countingUnit,
            boolean allowNegative,
            boolean componentEligible,
            String lowStockThreshold,
            String conversionFactor) {
        String measureMode = "COUNTED";
        String inventoryMode = "DIRECT";
        ObjectNode configuration = MAPPER.createObjectNode()
                .put("mode", inventoryMode)
                .put("allowNegative", allowNegative)
                .put("lowStockThreshold", lowStockThreshold)
                .put("conversionFactor", conversionFactor);
        if (countingUnit == null) {
            configuration.putNull("countingUnitRef");
            configuration.putNull("countingUnitSnapshot");
        } else {
            configuration.put("countingUnitRef", countingUnit.unitRef().toString());
            configuration.set("countingUnitSnapshot", unitSnapshot(countingUnit));
        }
        jdbc.update(
                "INSERT INTO inventory.stock_target("
                        + "target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code,sku_code,"
                        + "measure_mode,inventory_mode,consumption_unit_ref,consumption_unit_code,consumption_unit_"
                        + "name,"
                        + "consumption_unit_dimension,consumption_unit_precision,counting_unit_ref,counting_unit_code,"
                        + "counting_unit_name,counting_unit_dimension,counting_unit_precision,counting_unit_convers"
                        + "ion_factor,component_eligible,"
                        + "configuration,balance,version,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSONB),0,1,?,?)",
                targetRef,
                SCOPE.toString(),
                BRAND,
                itemRef,
                productSkuRef,
                itemCode,
                skuCode,
                measureMode,
                inventoryMode,
                consumptionUnit.unitRef(),
                consumptionUnit.code(),
                consumptionUnit.name(),
                consumptionUnit.unitDimension().name(),
                consumptionUnit.precision(),
                countingUnit == null ? null : countingUnit.unitRef(),
                countingUnit == null ? null : countingUnit.code(),
                countingUnit == null ? null : countingUnit.name(),
                countingUnit == null ? null : countingUnit.unitDimension().name(),
                countingUnit == null ? null : countingUnit.precision(),
                new BigDecimal(conversionFactor),
                componentEligible,
                canonical(configuration),
                1L,
                1L);
    }

    private static void insertProductionTag(UUID scope, UUID ref, String code) {
        jdbc.update(
                "INSERT INTO fulfillment_production.production_tag_definition "
                        + "(tag_ref,data_node_ref,brand_ref,code,name,status,version,"
                        + "created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES (?,?,?,?,?,'ENABLED',1,1,1)",
                ref,
                scope.toString(),
                BRAND,
                code,
                code);
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
                        + "sections,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis) VALUES(?,?,?,?,?,"
                        + "'SKU_VARIANT_SALE_COUNTED','DISABLED','{}'::jsonb,1,1,1)",
                itemRef,
                SCOPE.toString(),
                BRAND,
                code,
                name);
    }

    private static void insertQG10Sku(UUID itemRef, UUID skuRef, String skuCode, boolean isDefault, String digest) {
        jdbc.update(
                "INSERT INTO catalog.catalog_sku(product_sku_ref,item_ref,sku_code,sku_name,is_default,status,"
                        + "display_order,variant_combination_digest,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,? ,?,'ENABLED',0,?,1)",
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
                        + "VALUES(?,?,?,?,1,'份',false,?)",
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
                        .put("shapeKey", "SKU_VARIANT_SALE_COUNTED"));
        CatalogOwnerApi.UnitDefinitionReadback raceUnit =
                createUnit("RACE-UNIT", "Race unit", CatalogOwnerApi.UnitDimension.COUNT, 0);
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
        putItemUnitRefs((ObjectNode) baseline.path("sections").path("catalogDraft"), raceUnit, raceUnit);
        long version =
                write("saveOperationsCatalogItem", baseline).path("version").asLong();

        ObjectNode removeSecondSku = skuSave(
                itemCode, version, firstSkuRef, secondSkuRef, false, attributeRef, firstValueRef, secondValueRef);
        ObjectNode retainSecondSkuAndCreateTarget = skuSave(
                itemCode, version, firstSkuRef, secondSkuRef, true, attributeRef, firstValueRef, secondValueRef);
        putItemUnitRefs((ObjectNode) removeSecondSku.path("sections").path("catalogDraft"), raceUnit, raceUnit);
        putItemUnitRefs(
                (ObjectNode) retainSecondSkuAndCreateTarget.path("sections").path("catalogDraft"), raceUnit, raceUnit);
        ObjectNode raceSections = (ObjectNode) retainSecondSkuAndCreateTarget.path("sections");
        ObjectNode raceRules = raceSections.putObject("inventoryRules");
        ObjectNode raceNode = raceRules.putArray("nodes").addObject();
        raceNode.putObject("owner")
                .put("ownerType", "SKU")
                .put("itemRef", created.path("resourceRef").asText())
                .put("productSkuRef", secondSkuRef.toString())
                .put("skuCode", "SKU-2")
                .putNull("optionValueRef");
        raceNode.put("mode", "DIRECT")
                .putNull("consumptionUnitSnapshot")
                .putNull("expectedTargetVersion")
                .putNull("expectedBomVersion")
                .putNull("bom");
        raceNode.putObject("directConfiguration")
                .put("allowNegative", false)
                .putNull("lowStockThreshold")
                .putNull("countingUnitRef")
                .put("conversionFactor", "1");

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
                    "SELECT COUNT(*) FROM catalog.catalog_sku WHERE product_sku_ref=? AND status <> 'VOIDED'",
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
                new ProductionTagOwnerService(
                        new ProductionTagOwnerPersistence(taskJdbc, (TimeProvider) () -> 1_785_000_000_000L), MAPPER);
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
                .put("displayOrder", 0)
                .put("isDefault", isDefault)
                .put("status", "ENABLED")
                .put("version", 0);
        sku.putNull("standardSalePrice")
                .putNull("salesUnitOverrideRef")
                .putNull("baseMeasureUnitOverrideRef")
                .putArray("identifiers");
        sku.putObject("preparationOverride").put("mode", "INHERIT_ITEM").putNull("profile");
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
        ObjectNode effectiveRequest = request;
        if ("saveOperationsCatalogItem".equals(operation)) effectiveRequest = withDefaultUnitFacts(request);
        JsonNode response = target.write(
                context(operation, SCOPE, requestId),
                effectiveRequest,
                UUID.randomUUID().toString());
        return response.path("result");
    }

    private static JsonNode writeFull(String operation, ObjectNode request, String requestId, String idempotencyKey) {
        ObjectNode effectiveRequest =
                "saveOperationsCatalogItem".equals(operation) ? withDefaultUnitFacts(request) : request;
        return service.write(context(operation, SCOPE, requestId), effectiveRequest, idempotencyKey);
    }

    private static ObjectNode withDefaultUnitFacts(ObjectNode request) {
        if (request.has("skuTransitions")) return request.deepCopy();
        ObjectNode copy = request.deepCopy();
        ObjectNode sections =
                copy.path("sections").isObject() ? (ObjectNode) copy.path("sections") : copy.putObject("sections");
        ObjectNode draft = sections.path("catalogDraft").isObject()
                ? (ObjectNode) sections.path("catalogDraft")
                : sections.putObject("catalogDraft");
        if (!draft.has("salesUnitRef"))
            draft.put("salesUnitRef", defaultTestUnit.unitRef().toString());
        if (!draft.has("baseMeasureUnitRef"))
            draft.put("baseMeasureUnitRef", defaultTestUnit.unitRef().toString());
        return copy;
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

    private static JsonNode smartView(JsonNode navigation, String key) {
        for (JsonNode view : navigation.path("smartViews"))
            if (key.equals(view.path("viewKey").asText())) return view;
        throw new AssertionError("smart view not found: " + key);
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
