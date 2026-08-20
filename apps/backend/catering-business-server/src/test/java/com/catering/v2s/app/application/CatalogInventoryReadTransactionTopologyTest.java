package com.catering.v2s.app.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.catalog.application.CatalogOwnerService;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.fulfillment.production.application.ProductionTagOwnerService;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.inventory.application.InventoryOwnerService;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.sql.Connection;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runtime proof for the DBCR-01 read topology.
 *
 * <p>The coordinator is invoked through the same annotation-driven transaction interceptor used by the application.
 * Each typed owner probe therefore sees the actual transaction state rather than a source-text approximation. The
 * legacy operation-id dispatchers are checked separately and remain outside this GET denominator by design.
 */
class CatalogInventoryReadTransactionTopologyTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String DATA_NODE = "data-node";
    private static final String BRAND = "brand";
    private static final String REQUEST_ID = "request";
    private static final String STORE = "STORE";

    @Test
    void allSixteenNamedGetsReachTypedOwnersWithoutAnActiveTransaction() throws Exception {
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        InventoryOwnerApi inventory = mock(InventoryOwnerApi.class);
        ProductionTagOwnerApi production = mock(ProductionTagOwnerApi.class);
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        ObjectNode request = MAPPER.createObjectNode();
        JsonNode emptyEnvelope = envelope(MAPPER.createObjectNode());
        JsonNode catalogItemEnvelope = catalogItemEnvelope();
        JsonNode inventoryTargetEnvelope = MAPPER.createObjectNode().putObject("target");

        when(catalog.readWorkbenchContext(anyString(), anyString(), anyString()))
                .thenAnswer(noTransaction("catalog.readWorkbenchContext", emptyEnvelope));
        when(catalog.readNavigation(anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(noTransaction("catalog.readNavigation", emptyEnvelope));
        when(catalog.readItems(anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(noTransaction("catalog.readItems", envelope(dataWithArray("items"))));
        when(catalog.readItem(anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(noTransaction("catalog.readItem", catalogItemEnvelope));
        when(catalog.readDictionary(anyString(), anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(noTransaction("catalog.readDictionary", emptyEnvelope));
        when(catalog.readLocalCopyCandidates(anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(noTransaction("catalog.readLocalCopyCandidates", emptyEnvelope));
        when(catalog.readBrandCopyCandidates(anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(noTransaction("catalog.readBrandCopyCandidates", emptyEnvelope));
        when(catalog.readShapeManifest(anyString()))
                .thenAnswer(noTransaction("catalog.readShapeManifest", emptyEnvelope));
        when(catalog.skuNamesByItemCodes(anyString(), anyString(), any(JsonNode.class)))
                .thenAnswer(noTransaction("catalog.skuNamesByItemCodes", MAPPER.createObjectNode()));

        when(inventory.readCatalogInventoryDefinition(anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(
                        noTransaction("inventory.readCatalogInventoryDefinition", envelope(dataWithArray("nodes"))));
        when(inventory.readCatalogInventorySummary(
                        anyString(), anyString(), any(ObjectNode.class), anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readCatalogInventorySummary", envelope(dataWithArray("items"))));
        when(inventory.readTargets(anyString(), anyString(), any(ObjectNode.class), anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readTargets", envelope(dataWithArray("items"))));
        when(inventory.readTarget(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readTarget", inventoryTargetEnvelope));
        when(inventory.readTargetChangeSummary(anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readTargetChangeSummary", emptyEnvelope));
        when(inventory.readTargetBusinessHistory(
                        anyString(), anyString(), anyString(), any(ObjectNode.class), anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readTargetBusinessHistory", emptyEnvelope));
        when(inventory.readTargetConsumptionReferences(
                        anyString(), anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(
                        noTransaction("inventory.readTargetConsumptionReferences", envelope(dataWithArray("entries"))));
        when(inventory.readTargetLedger(
                        anyString(), anyString(), anyString(), any(ObjectNode.class), anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readTargetLedger", emptyEnvelope));
        when(inventory.readTargetDiagnostics(anyString(), anyString()))
                .thenAnswer(noTransaction("inventory.readTargetDiagnostics", emptyEnvelope));
        when(production.readTags(anyString(), anyString(), any(ObjectNode.class), anyString()))
                .thenAnswer(noTransaction("production.readTags", envelope(dataWithArray("entries"))));

        CatalogInventoryCoordinator target = new CatalogInventoryCoordinator(
                catalog,
                inventory,
                production,
                mock(PlatformAssetService.class),
                MAPPER,
                mock(TimeProvider.class),
                catalogScopes,
                mock(CommandExecutionContextResolver.class));
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getAutoCommit()).thenReturn(true);
        DataSourceTransactionManager transactionManager = new DataSourceTransactionManager(dataSource);
        TransactionInterceptor transactions =
                new TransactionInterceptor(transactionManager, new AnnotationTransactionAttributeSource());
        ProxyFactory proxyFactory = new ProxyFactory(target);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvice(transactions);
        CatalogInventoryCoordinator coordinator = (CatalogInventoryCoordinator) proxyFactory.getProxy();

        coordinator.readCatalogWorkbenchContext(DATA_NODE, BRAND, REQUEST_ID, STORE, null, null, null);
        coordinator.readCatalogNavigation(DATA_NODE, BRAND, request, REQUEST_ID);
        coordinator.readCatalogItems(DATA_NODE, BRAND, request, REQUEST_ID, STORE);
        coordinator.readCatalogItem(DATA_NODE, BRAND, "ITEM-001", request, REQUEST_ID);
        coordinator.readCatalogDictionary(DATA_NODE, BRAND, "SHAPE", request, REQUEST_ID);
        coordinator.readProductionTags(DATA_NODE, BRAND, request, REQUEST_ID);
        coordinator.readLocalCatalogCopyCandidates(DATA_NODE, BRAND, request, REQUEST_ID);
        coordinator.readBrandCatalogCopyCandidates(DATA_NODE, BRAND, request, REQUEST_ID);
        coordinator.readInventoryTargets(DATA_NODE, BRAND, request, REQUEST_ID, STORE);
        coordinator.readInventoryTarget(DATA_NODE, BRAND, "TARGET-001", REQUEST_ID, STORE);
        coordinator.readInventoryTargetChangeSummary(DATA_NODE, BRAND, "TARGET-001", "TODAY", STORE);
        coordinator.readInventoryTargetBusinessHistory(DATA_NODE, BRAND, "TARGET-001", request, REQUEST_ID, STORE);
        coordinator.readInventoryTargetConsumptionReferences(DATA_NODE, BRAND, "TARGET-001", request, REQUEST_ID);
        coordinator.readInventoryTargetLedger(DATA_NODE, BRAND, "TARGET-001", request, REQUEST_ID, STORE);
        coordinator.readInventoryTargetDiagnostics("TARGET-001", REQUEST_ID);
        coordinator.readCatalogShapeManifest(REQUEST_ID);
    }

    @Test
    void typedOwnerAndCrossOwnerReadBoundariesAreOutsideTransactionWhileLegacyDispatchersRemainTransactional()
            throws Exception {
        assertNoTransaction(
                CatalogOwnerService.class, "readWorkbenchContext", String.class, String.class, String.class);
        assertNoTransaction(
                CatalogOwnerService.class,
                "readNavigation",
                String.class,
                String.class,
                ObjectNode.class,
                String.class);
        assertNoTransaction(
                CatalogOwnerService.class, "readItems", String.class, String.class, ObjectNode.class, String.class);
        assertNoTransaction(
                CatalogOwnerService.class, "readItem", String.class, String.class, String.class, String.class);
        assertNoTransaction(
                CatalogOwnerService.class,
                "readDictionary",
                String.class,
                String.class,
                String.class,
                ObjectNode.class,
                String.class);
        assertNoTransaction(
                CatalogOwnerService.class,
                "readLocalCopyCandidates",
                String.class,
                String.class,
                ObjectNode.class,
                String.class);
        assertNoTransaction(
                CatalogOwnerService.class,
                "readBrandCopyCandidates",
                String.class,
                String.class,
                ObjectNode.class,
                String.class);
        assertNoTransaction(CatalogOwnerService.class, "readShapeManifest", String.class);
        assertNoTransaction(
                CatalogOwnerService.class, "skuNamesByItemCodes", String.class, String.class, JsonNode.class);

        assertNoTransaction(
                InventoryOwnerService.class,
                "readTargets",
                String.class,
                String.class,
                ObjectNode.class,
                String.class,
                String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readTarget",
                String.class,
                String.class,
                String.class,
                String.class,
                String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readTargetChangeSummary",
                String.class,
                String.class,
                String.class,
                String.class,
                String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readTargetBusinessHistory",
                String.class,
                String.class,
                String.class,
                ObjectNode.class,
                String.class,
                String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readTargetConsumptionReferences",
                String.class,
                String.class,
                String.class,
                ObjectNode.class,
                String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readTargetLedger",
                String.class,
                String.class,
                String.class,
                ObjectNode.class,
                String.class,
                String.class);
        assertNoTransaction(InventoryOwnerService.class, "readTargetDiagnostics", String.class, String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readCatalogInventoryDefinition",
                String.class,
                String.class,
                String.class,
                String.class);
        assertNoTransaction(
                InventoryOwnerService.class,
                "readCatalogInventorySummary",
                String.class,
                String.class,
                ObjectNode.class,
                String.class,
                String.class);
        assertNoTransaction(
                ProductionTagOwnerService.class,
                "readTags",
                String.class,
                String.class,
                ObjectNode.class,
                String.class);
        assertNoTransaction(
                BusinessEntityService.class,
                "resolveCatalogCopySource",
                UUID.class,
                String.class,
                String.class,
                UUID.class,
                String.class);

        assertTrue(InventoryOwnerService.class
                .getMethod(
                        "read", String.class, String.class, String.class, ObjectNode.class, String.class, String.class)
                .isAnnotationPresent(Transactional.class));
        assertTrue(ProductionTagOwnerService.class
                .getMethod("read", String.class, String.class, String.class, ObjectNode.class, String.class)
                .isAnnotationPresent(Transactional.class));
    }

    @Test
    void everyCrossOwnerWriteCompositionStartsTheRequiredCoordinatorTransaction() throws Exception {
        assertTransaction(
                CatalogInventoryCoordinator.class,
                "saveCatalogItem",
                WorkspaceExecutionContext.class,
                CatalogOwnerApi.CatalogItemSaveCommand.class,
                List.class,
                String.class);
        assertTransaction(
                CatalogInventoryCoordinator.class,
                "executeLocalCopy",
                WorkspaceExecutionContext.class,
                CatalogOwnerApi.LocalCopyExecuteCommand.class,
                String.class,
                String.class);
        assertTransaction(
                CatalogInventoryCoordinator.class,
                "executeBrandCopy",
                WorkspaceExecutionContext.class,
                CatalogOwnerApi.BrandCopyExecuteCommand.class,
                String.class,
                String.class);
        assertTransaction(
                CatalogInventoryCoordinator.class,
                "executeBrandCopy",
                WorkspaceExecutionContext.class,
                CatalogOwnerApi.BrandCopyExecuteCommand.class,
                String.class,
                String.class,
                String.class);
    }

    private static org.mockito.stubbing.Answer<JsonNode> noTransaction(String probe, JsonNode response) {
        return invocation -> {
            assertFalse(
                    TransactionSynchronizationManager.isActualTransactionActive(),
                    probe + " entered an active transaction");
            return response.deepCopy();
        };
    }

    private static void assertNoTransaction(Class<?> type, String methodName, Class<?>... parameterTypes)
            throws Exception {
        Method method = type.getMethod(methodName, parameterTypes);
        assertFalse(
                method.isAnnotationPresent(Transactional.class),
                type.getSimpleName() + "#" + methodName + " must remain outside transaction");
    }

    private static void assertTransaction(Class<?> type, String methodName, Class<?>... parameterTypes)
            throws Exception {
        Method method = type.getMethod(methodName, parameterTypes);
        assertTrue(
                method.isAnnotationPresent(Transactional.class),
                type.getSimpleName() + "#" + methodName + " must start a REQUIRED transaction");
    }

    private static JsonNode envelope(ObjectNode data) {
        return MAPPER.createObjectNode().put("requestId", REQUEST_ID).set("data", data);
    }

    private static ObjectNode dataWithArray(String field) {
        ObjectNode data = MAPPER.createObjectNode();
        data.putArray(field);
        return data;
    }

    private static JsonNode catalogItemEnvelope() {
        ObjectNode item =
                MAPPER.createObjectNode().put("itemRef", UUID.randomUUID().toString());
        return envelope(MAPPER.createObjectNode().set("item", item));
    }
}
