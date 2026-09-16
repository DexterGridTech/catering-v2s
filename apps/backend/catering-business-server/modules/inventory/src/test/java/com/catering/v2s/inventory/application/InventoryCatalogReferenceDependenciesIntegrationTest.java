package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the catalog-facing owner judgement covers every inventory-held catalog reference. */
@Testcontainers
class InventoryCatalogReferenceDependenciesIntegrationTest {
    private static final UUID SCOPE = UUID.randomUUID();
    private static final String BRAND = "DEPENDENCY-BRAND";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static InventoryOwnerService service;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .load()
                .migrate();
        jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        service = new InventoryOwnerService(jdbc, new ObjectMapper(), (TimeProvider) () -> 1_785_000_000_000L);
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
    void typedCatalogDependencyJudgementCoversEveryConcreteInventoryReferenceColumn() {
        UUID itemRef = UUID.randomUUID();
        UUID skuRef = UUID.randomUUID();
        UUID optionValueRef = UUID.randomUUID();
        insertTarget(SCOPE, BRAND, itemRef, skuRef);
        insertBom(SCOPE, BRAND, itemRef, skuRef, optionValueRef);
        insertTarget(UUID.randomUUID(), "OTHER-BRAND", itemRef, skuRef);
        insertBom(UUID.randomUUID(), "OTHER-BRAND", itemRef, skuRef, optionValueRef);

        assertSources(
                "CATALOG_ITEM",
                itemRef,
                2L,
                List.of(
                        new InventoryOwnerApi.CatalogReferenceDependencySource("stock_target", "item_ref", 1L),
                        new InventoryOwnerApi.CatalogReferenceDependencySource("stock_bom", "item_ref", 1L)));
        assertSources(
                "PRODUCT_SKU",
                skuRef,
                2L,
                List.of(
                        new InventoryOwnerApi.CatalogReferenceDependencySource("stock_target", "product_sku_ref", 1L),
                        new InventoryOwnerApi.CatalogReferenceDependencySource("stock_bom", "product_sku_ref", 1L)));
        assertSources(
                "CATALOG_ORDER_OPTION_DEFINITION_VALUE",
                optionValueRef,
                1L,
                List.of(new InventoryOwnerApi.CatalogReferenceDependencySource("stock_bom", "option_value_ref", 1L)));

        InventoryOwnerApi.CatalogItemVoidDependencyReadback itemCompatibility =
                service.catalogItemVoidDependencies(context(), itemRef.toString());
        assertEquals(1L, itemCompatibility.stockTargetCount());
        assertEquals(1L, itemCompatibility.productBomCount());
    }

    @Test
    void typedCatalogDependencyJudgementRejectsUnknownObjectTypes() {
        InventoryOwnerApi.Problem failure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.catalogReferenceDependencies(
                        context(), "CATALOG_CATEGORY", UUID.randomUUID().toString()));
        assertEquals("VALIDATION_ERROR", failure.code());
    }

    @Test
    void typedCatalogDependencyBatchKeepsInputAttributionAndScopeIsolation() {
        UUID firstSkuRef = UUID.randomUUID();
        UUID secondSkuRef = UUID.randomUUID();
        UUID absentSkuRef = UUID.randomUUID();
        insertTarget(SCOPE, BRAND, UUID.randomUUID(), firstSkuRef);
        insertBom(SCOPE, BRAND, UUID.randomUUID(), firstSkuRef, UUID.randomUUID());
        insertTarget(SCOPE, BRAND, UUID.randomUUID(), secondSkuRef);
        insertTarget(UUID.randomUUID(), "OTHER-BRAND", UUID.randomUUID(), secondSkuRef);

        List<InventoryOwnerApi.CatalogReferenceDependenciesReadback> actual =
                service.catalogReferenceDependenciesByRefs(
                        context(), "PRODUCT_SKU", List.of(firstSkuRef, secondSkuRef, absentSkuRef));

        assertEquals(
                List.of(firstSkuRef, secondSkuRef, absentSkuRef),
                actual.stream()
                        .map(InventoryOwnerApi.CatalogReferenceDependenciesReadback::reference)
                        .toList());
        assertEquals(2L, actual.get(0).totalCount());
        assertEquals(1L, actual.get(0).sources().get(0).count());
        assertEquals(1L, actual.get(0).sources().get(1).count());
        assertEquals(1L, actual.get(1).totalCount());
        assertEquals(0L, actual.get(1).sources().get(1).count());
        assertEquals(0L, actual.get(2).totalCount());
        assertTrue(actual.get(2).sources().stream().allMatch(source -> source.count() == 0L));
    }

    @Test
    void consumptionReferencesAreFilteredByPostgresAndExposeTheRepresentativePlan() {
        UUID targetRef = UUID.randomUUID();
        UUID sourceItemRef = UUID.randomUUID();
        UUID unitRef = UUID.randomUUID();
        insertTarget(targetRef, SCOPE, BRAND, UUID.randomUUID(), UUID.randomUUID(), "QG12-TARGET", "QG12-SKU");
        insertBomWithRows(
                SCOPE,
                BRAND,
                sourceItemRef,
                UUID.randomUUID(),
                "QG12-SOURCE",
                "QG12-SOURCE-SKU",
                "[{\"targetRef\":\""
                        + targetRef
                        + "\",\"quantity\":\"2\",\"unit\":\"KG\",\"consumptionUnitSnapshot\":{\"unitRef\":\""
                        + unitRef
                        + "\",\"code\":\"GRAM\",\"name\":\"克\",\"unitDimension\":\"WEIGHT\",\"precision\":0}}]");
        insertBomWithRows(
                SCOPE,
                BRAND,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "QG12-DISTRACTOR",
                "QG12-DISTRACTOR-SKU",
                "[{\"targetRef\":\"" + UUID.randomUUID() + "\",\"quantity\":\"9\",\"unit\":\"KG\"}]");
        insertBomWithRows(
                UUID.randomUUID(),
                BRAND,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "QG12-OTHER-SCOPE",
                "QG12-OTHER-SCOPE-SKU",
                "[{\"targetRef\":\"" + targetRef + "\",\"quantity\":\"7\",\"unit\":\"KG\"}]");

        var actual = service.readTargetConsumptionReferences(
                SCOPE.toString(),
                BRAND,
                targetRef.toString(),
                new ObjectMapper().createObjectNode().put("pageSize", 20),
                "qg12-reference-plan");
        assertEquals(1, actual.path("entries").size());
        assertEquals(
                "QG12-SOURCE", actual.path("entries").path(0).path("sourceCode").asText());
        assertEquals(
                unitRef.toString(),
                actual.path("entries")
                        .path(0)
                        .path("consumptionUnitSnapshot")
                        .path("unitRef")
                        .asText());
        assertEquals(
                "GRAM",
                actual.path("entries")
                        .path(0)
                        .path("consumptionUnitSnapshot")
                        .path("code")
                        .asText());
        assertEquals(1L, actual.path("total").asLong());

        List<String> plan = jdbc.query(
                "EXPLAIN (COSTS OFF) WITH expanded AS ("
                        + "SELECT sb.item_ref,sb.item_code,sb.sku_code,sb.option_value_code,"
                        + "entry->>'nodeType' AS source_kind,COALESCE(entry->>'quantity',"
                        + "entry->>'quantityPerUnit','0') AS quantity,COALESCE(entry->>'unit','') AS unit,"
                        + "entry->>'timing' AS timing,ord,"
                        + "COUNT(*) OVER() AS total FROM inventory.stock_bom sb "
                        + "CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(sb.rows)='array' "
                        + "THEN sb.rows ELSE '[]'::jsonb END) WITH ORDINALITY AS e(entry,ord) "
                        + "WHERE sb.data_node_ref=? AND sb.brand_ref=? "
                        + "AND jsonb_path_exists(CASE WHEN jsonb_typeof(sb.rows)='array' THEN sb.rows "
                        + "ELSE '[]'::jsonb END, "
                        + "'$[*] ? (@.targetRef == $targetRef || @.componentTargetRef == $targetRef)', "
                        + "jsonb_build_object('targetRef',to_jsonb(CAST(? AS text)))) "
                        + "AND COALESCE(entry->>'targetRef',entry->>'componentTargetRef')=?"
                        + ") SELECT item_ref,item_code,sku_code,option_value_code,source_kind,quantity,unit,"
                        + "timing,total FROM expanded ORDER BY item_code,sku_code NULLS FIRST,ord "
                        + "LIMIT ? OFFSET ?",
                (result, rowNumber) -> result.getString(1),
                SCOPE.toString(),
                BRAND,
                targetRef.toString(),
                targetRef.toString(),
                21,
                0);
        String renderedPlan = String.join(System.lineSeparator(), plan);
        System.out.println("QG12_EXPLAIN_BEGIN\n" + renderedPlan + "\nQG12_EXPLAIN_END");
        assertFalse(plan.isEmpty(), "the managed PostgreSQL EXPLAIN must return a plan");
        assertTrue(renderedPlan.contains("jsonb_path_exists"), renderedPlan);
        assertTrue(renderedPlan.contains("Filter"), renderedPlan);
    }

    @Test
    void targetReadAppliesCatalogNameAndCategoryFiltersWithoutMaterializingCatalogRows() {
        UUID itemRef = UUID.randomUUID();
        UUID categoryRef = UUID.randomUUID();
        insertCatalogItem(itemRef, "BEAN-CODE", "咖啡豆");
        insertCatalogCategory(categoryRef, "BEVERAGE", "饮品");
        jdbc.update(
                "INSERT INTO catalog.catalog_item_category(item_ref,category_ref) VALUES(?,?)", itemRef, categoryRef);
        insertTarget(UUID.randomUUID(), SCOPE, BRAND, itemRef, null, "BEAN-CODE", null);

        var byName = service.readTargets(
                SCOPE.toString(),
                BRAND,
                new ObjectMapper().createObjectNode().put("keyword", "咖啡"),
                "inventory-name",
                "STORE");
        assertEquals(1, byName.path("data").path("total").asInt());
        assertEquals(
                itemRef.toString(),
                byName.path("data").path("items").path(0).path("itemRef").asText());

        var byCategory = service.readTargets(
                SCOPE.toString(),
                BRAND,
                new ObjectMapper().createObjectNode().put("categoryRef", categoryRef.toString()),
                "inventory-category",
                "STORE");
        assertEquals(1, byCategory.path("data").path("total").asInt());
        assertEquals(
                itemRef.toString(),
                byCategory.path("data").path("items").path(0).path("itemRef").asText());
    }

    private static void assertSources(
            String objectType,
            UUID ref,
            long total,
            List<InventoryOwnerApi.CatalogReferenceDependencySource> expectedSources) {
        InventoryOwnerApi.CatalogReferenceDependenciesReadback actual =
                service.catalogReferenceDependencies(context(), objectType, ref.toString());
        assertEquals(objectType, actual.objectType());
        assertEquals(ref, actual.reference());
        assertEquals(total, actual.totalCount());
        assertEquals(expectedSources, actual.sources());
    }

    private static void insertTarget(UUID scope, String brand, UUID itemRef, UUID skuRef) {
        InventoryTestUnitFacts.insertDirectTarget(
                jdbc, UUID.randomUUID(), scope, brand, itemRef, skuRef, "ITEM", "SKU", java.math.BigDecimal.ZERO, 1L);
    }

    private static void insertTarget(
            UUID targetRef, UUID scope, String brand, UUID itemRef, UUID skuRef, String itemCode, String skuCode) {
        InventoryTestUnitFacts.insertDirectTarget(
                jdbc, targetRef, scope, brand, itemRef, skuRef, itemCode, skuCode, java.math.BigDecimal.ZERO, 1L);
    }

    private static void insertCatalogItem(UUID itemRef, String code, String name) {
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_item(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,"
                        + "sect"
                        + "ions,version,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,'MATERIAL','ENABLED','{}'::jsonb,1,1,1)",
                itemRef,
                SCOPE.toString(),
                BRAND,
                code,
                name);
    }

    private static void insertCatalogCategory(UUID categoryRef, String code, String name) {
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_category(category_ref,data_node_ref,brand_ref,code,name,status,version,creat"
                        + "ed_a"
                        + "t_epoch_millis,updated_at_epoch_millis) VALUES(?,?,?,?,?,'ENABLED',1,1,1)",
                categoryRef,
                SCOPE.toString(),
                BRAND,
                code,
                name);
    }

    private static void insertBom(UUID scope, String brand, UUID itemRef, UUID skuRef, UUID optionValueRef) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,1,'[]'::jsonb,1)",
                UUID.randomUUID(),
                scope.toString(),
                brand,
                itemRef,
                skuRef,
                optionValueRef,
                "ITEM",
                "SKU",
                "OPTION");
    }

    private static void insertBomWithRows(
            UUID scope, String brand, UUID itemRef, UUID skuRef, String itemCode, String skuCode, String rows) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_bom(bom_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,option_value_re"
                        + "f,it"
                        + "em_code,sku_code,option_value_code,version,rows,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,1,CAST(? AS JSONB),1)",
                UUID.randomUUID(),
                scope.toString(),
                brand,
                itemRef,
                skuRef,
                null,
                itemCode,
                skuCode,
                null,
                rows);
    }

    private static WorkspaceExecutionContext<CatalogAuthorizationScope> context() {
        UUID workspaceId = UUID.randomUUID();
        var token = CatalogInventoryWorkspaceCommandTokens.SAVE_OPERATIONS_CATALOG_ITEM;
        var selectedStore = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                "STORE",
                SCOPE,
                "Dependency test store",
                "DEPENDENCY-TEST-STORE",
                List.of("Dependency test store"),
                null,
                null,
                SCOPE,
                null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                "inventory-dependency-test",
                UUID.randomUUID(),
                UUID.randomUUID(),
                new WorkspaceSessionEntryReadback.ScopeContext(null, null, selectedStore, null),
                1L,
                1L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "dependency test",
                "STORE",
                SCOPE);
        WorkspaceAuthenticationService sessions = org.mockito.Mockito.mock(WorkspaceAuthenticationService.class);
        org.mockito.Mockito.when(sessions.commandAuthorizationFacts("dependency-test-session"))
                .thenReturn(new WorkspaceCommandAuthorizationFacts(session, UUID.randomUUID(), "STORE", SCOPE));
        WorkspaceCapabilityScopeResolver capabilities =
                org.mockito.Mockito.mock(WorkspaceCapabilityScopeResolver.class);
        org.mockito.Mockito.when(capabilities.resolveGeneratedCatalogOperation(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        new WorkspaceCapabilityScopeResolver.ScopeResolution(
                                WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                                token.capabilityFor("STORE"),
                                new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                        workspaceId,
                                        "inventory-dependency-test",
                                        "STORE",
                                        SCOPE,
                                        "STORE",
                                        SCOPE,
                                        List.of(SCOPE))),
                        new CatalogScopeLookup.CatalogBrandJudgment(
                                BRAND, "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION"),
                        null));
        CatalogScopeLookup catalogScopes = org.mockito.Mockito.mock(CatalogScopeLookup.class);
        return new CommandExecutionContextResolver(
                        capabilities, catalogScopes, sessions, (workspace, group, targetType, storeId) -> {})
                .resolveCatalog(
                        "dependency-test-session",
                        token,
                        SCOPE.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND),
                        "dependency-correlation",
                        "dependency-request");
    }
}
