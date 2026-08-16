package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
                "SKU_ATTRIBUTE_VALUE",
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
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
                UUID.randomUUID(),
                scope.toString(),
                brand,
                itemRef,
                skuRef,
                "ITEM",
                "SKU");
    }

    private static void insertTarget(
            UUID targetRef, UUID scope, String brand, UUID itemRef, UUID skuRef, String itemCode, String skuCode) {
        jdbc.update(
                "INSERT INTO "
                        + "inventory.stock_target(target_ref,data_node_ref,brand_ref,item_ref,product_sku_ref,item_code"
                        + ",sku"
                        + "_code,measure_mode,configuration,balance,version,created_at_epoch_millis,updated_at_epoch_mi"
                        + "llis"
                        + ") VALUES(?,?,?,?,?,?,?,'UNIT','{}'::jsonb,0,1,1,1)",
                targetRef,
                scope.toString(),
                brand,
                itemRef,
                skuRef,
                itemCode,
                skuCode);
    }

    private static void insertCatalogItem(UUID itemRef, String code, String name) {
        jdbc.update(
                "INSERT INTO "
                        + "catalog.catalog_item(item_ref,data_node_ref,brand_ref,code,name,shape_key,status,attributes,"
                        + "sect"
                        + "ions,version,created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,'MATERIAL','ENABLED','{}'::jsonb,'{}'::jsonb,1,1,1)",
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
        org.mockito.Mockito.when(capabilities.resolveGeneratedOperation(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.ScopeResolution(
                        WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                        token.capabilityFor("STORE"),
                        new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                workspaceId,
                                "inventory-dependency-test",
                                "STORE",
                                SCOPE,
                                "STORE",
                                SCOPE,
                                List.of(SCOPE))));
        CatalogScopeLookup catalogScopes = org.mockito.Mockito.mock(CatalogScopeLookup.class);
        org.mockito.Mockito.when(catalogScopes.resolveCatalogBrand(
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(new CatalogScopeLookup.CatalogBrandJudgment(
                        BRAND, "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION"));
        return new CommandExecutionContextResolver(capabilities, catalogScopes, sessions)
                .resolveCatalog(
                        "dependency-test-session",
                        token,
                        SCOPE.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(BRAND),
                        "dependency-correlation",
                        "dependency-request");
    }
}
