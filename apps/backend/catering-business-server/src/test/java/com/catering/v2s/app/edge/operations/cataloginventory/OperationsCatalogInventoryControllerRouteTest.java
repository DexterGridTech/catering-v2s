package com.catering.v2s.app.edge.operations.cataloginventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;

class OperationsCatalogInventoryControllerRouteTest {
    private static final List<ReadRoute> READ_ROUTES = List.of(
            new ReadRoute(
                    "getOperationsCatalogWorkbenchContext",
                    "workbenchContext",
                    "/workbench/context",
                    "readCatalogWorkbenchContext"),
            new ReadRoute("getOperationsCatalogNavigation", "navigation", "/navigation", "readCatalogNavigation"),
            new ReadRoute("getOperationsCatalogItems", "items", "/items", "readCatalogItems"),
            new ReadRoute("getOperationsCatalogItem", "item", "/items/{itemCode}", "readCatalogItem"),
            new ReadRoute(
                    "getOperationsCatalogDictionary",
                    "dictionary",
                    "/dictionaries/{dictionaryKind}",
                    "readCatalogDictionary"),
            new ReadRoute("getOperationsProductionTags", "productionTags", "/production-tags", "readProductionTags"),
            new ReadRoute(
                    "getOperationsLocalCatalogCopyCandidates",
                    "localCopyCandidates",
                    "/copy/local/candidates",
                    "readLocalCatalogCopyCandidates"),
            new ReadRoute(
                    "getOperationsBrandCatalogCopyCandidates",
                    "brandCopyCandidates",
                    "/copy/brand/candidates",
                    "readBrandCatalogCopyCandidates"),
            new ReadRoute(
                    "getOperationsInventoryTargets", "inventoryTargets", "/inventory-targets", "readInventoryTargets"),
            new ReadRoute(
                    "getOperationsInventoryConsumptionTargetCandidates",
                    "inventoryConsumptionTargetCandidates",
                    "/inventory-consumption-target-candidates",
                    "readInventoryConsumptionTargetCandidates"),
            new ReadRoute(
                    "getOperationsInventoryTarget",
                    "inventoryTarget",
                    "/inventory-targets/{targetRef}",
                    "readInventoryTarget"),
            new ReadRoute(
                    "getOperationsInventoryTargetChangeSummary",
                    "inventoryTargetChanges",
                    "/inventory-targets/{targetRef}/changes",
                    "readInventoryTargetChangeSummary"),
            new ReadRoute(
                    "getOperationsInventoryTargetBusinessHistory",
                    "inventoryTargetBusinessHistory",
                    "/inventory-targets/{targetRef}/business-history",
                    "readInventoryTargetBusinessHistory"),
            new ReadRoute(
                    "getOperationsInventoryTargetConsumptionReferences",
                    "inventoryTargetConsumptionReferences",
                    "/inventory-targets/{targetRef}/consumption-references",
                    "readInventoryTargetConsumptionReferences"),
            new ReadRoute(
                    "getOperationsInventoryTargetLedger",
                    "inventoryTargetLedger",
                    "/inventory-targets/{targetRef}/ledger",
                    "readInventoryTargetLedger"),
            new ReadRoute(
                    "getOperationsInventoryTargetDiagnostics",
                    "inventoryTargetDiagnostics",
                    "/inventory-targets/{targetRef}/diagnostics",
                    "readInventoryTargetDiagnostics"),
            new ReadRoute(
                    "getOperationsCatalogShapeManifest",
                    "shapeManifest",
                    "/shape-manifest",
                    "readCatalogShapeManifest"),
            new ReadRoute(
                    "listOperationsCatalogAttributeDefinitions",
                    "attributeDefinitions",
                    "/attribute-definitions",
                    "listAttributeDefinitions"),
            new ReadRoute(
                    "listOperationsCatalogOrderOptionDefinitions",
                    "orderOptionDefinitions",
                    "/order-option-definitions",
                    "listOrderOptionDefinitions"),
            new ReadRoute(
                    "listOperationsCatalogUnits", "catalogUnits", "/units", "listUnitDefinitions"));

    @Test
    void twentyReadRoutesHaveOneExplicitControllerAndCoordinatorBinding() throws Exception {
        Set<String> expectedControllerMethods =
                READ_ROUTES.stream().map(ReadRoute::controllerMethod).collect(java.util.stream.Collectors.toSet());
        Set<String> actualControllerMethods = Arrays.stream(
                        OperationsCatalogInventoryController.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(org.springframework.web.bind.annotation.GetMapping.class))
                .map(Method::getName)
                .collect(java.util.stream.Collectors.toSet());
        assertEquals(expectedControllerMethods, actualControllerMethods, "GET controller method set drifted");

        for (ReadRoute route : READ_ROUTES) {
            Method controller = OperationsCatalogInventoryController.class.getDeclaredMethod(
                    route.controllerMethod(),
                    com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                    java.util.Map.class,
                    java.util.Map.class);
            org.springframework.web.bind.annotation.GetMapping mapping =
                    controller.getAnnotation(org.springframework.web.bind.annotation.GetMapping.class);
            assertEquals(Set.of(route.path()), Set.of(mapping.value()), route.operationId() + " route path drifted");
            long coordinatorMethods = Arrays.stream(
                            com.catering.v2s.catalog.application.CatalogInventoryCoordinator.class.getDeclaredMethods())
                    .filter(method -> method.getName().equals(route.coordinatorMethod()))
                    .count();
            assertEquals(1, coordinatorMethods, route.operationId() + " coordinator symbol must resolve exactly once");
        }
    }

    @Test
    void categoryRoutesUseOpaqueRefsAndExposeOnlyTheRegisteredDeleteCommand() throws Exception {
        Method post = OperationsCatalogInventoryController.class.getMethod(
                "moveCatalogCategory",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogCategoryMoveRequest.class,
                String.class,
                String.class);
        String[] postPaths = post.getAnnotation(PostMapping.class).value();
        assertTrue(Arrays.asList(postPaths).contains("/categories/{categoryRef}/move"));
        assertFalse(Arrays.asList(postPaths).contains("/categories/{categoryCode}/move"));

        Method patch = OperationsCatalogInventoryController.class.getMethod(
                "updateCatalogCategory",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogCategoryUpdateRequest.class,
                String.class,
                String.class);
        String[] patchPaths = patch.getAnnotation(PatchMapping.class).value();
        assertTrue(Arrays.asList(patchPaths).contains("/categories/{categoryRef}"));
        assertFalse(Arrays.asList(patchPaths).contains("/categories/{categoryCode}"));

        Method delete = OperationsCatalogInventoryController.class.getMethod(
                "deleteCatalogCategory",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteRequest.class,
                String.class,
                String.class);
        assertTrue(
                Arrays.asList(delete.getAnnotation(DeleteMapping.class).value()).contains("/categories/{categoryRef}"));
    }

    @Test
    void catalogAssetRoutesKeepMultipartStageAndTypedPathRelease() throws Exception {
        Method stage = OperationsCatalogInventoryController.class.getMethod(
                "stageAsset",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                org.springframework.web.multipart.MultipartFile.class,
                String.class,
                String.class,
                String.class,
                String.class,
                String.class);
        PostMapping stageMapping = stage.getAnnotation(PostMapping.class);
        assertTrue(Arrays.asList(stageMapping.value()).contains("/assets/stage"));
        assertTrue(Arrays.asList(stageMapping.consumes()).contains("multipart/form-data"));

        Method release = OperationsCatalogInventoryController.class.getMethod(
                "releaseCatalogAsset",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseRequest.class,
                String.class,
                String.class);
        assertTrue(
                Arrays.asList(release.getAnnotation(PostMapping.class).value()).contains("/assets/{assetRef}/release"));
    }

    @Test
    void catalogItemAndTemporaryPromotionCommandsUseTypedP1Transport() throws Exception {
        Method create = OperationsCatalogInventoryController.class.getMethod(
                "createCatalogItem",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogItemCreateRequest.class,
                String.class);
        Method transition = OperationsCatalogInventoryController.class.getMethod(
                "transitionCatalogItemStatus",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogItemTransitionRequest.class,
                String.class,
                String.class);
        Method preflight = OperationsCatalogInventoryController.class.getMethod(
                "preflightTemporaryCatalogPromotion",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflightRequest.class,
                String.class,
                String.class);
        Method execute = OperationsCatalogInventoryController.class.getMethod(
                "executeTemporaryCatalogPromotion",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.TemporaryPromotionExecuteRequest.class,
                String.class,
                String.class);

        assertTrue(
                Arrays.asList(create.getAnnotation(PostMapping.class).value()).contains("/items"));
        assertTrue(Arrays.asList(transition.getAnnotation(PostMapping.class).value())
                .contains("/items/{itemCode}/status"));
        assertTrue(Arrays.asList(preflight.getAnnotation(PostMapping.class).value())
                .contains("/items/{itemCode}/temporary-promotion/preflight"));
        assertTrue(Arrays.asList(execute.getAnnotation(PostMapping.class).value())
                .contains("/items/{itemCode}/temporary-promotion/execute"));
    }

    @Test
    void batchCatalogItemStatusCommandUsesTheRegisteredCollectionRoute() throws Exception {
        Method batch = OperationsCatalogInventoryController.class.getMethod(
                "batchTransitionCatalogItemStatus",
                com.catering.v2s.app.edge.session.EdgeRequestContext.class,
                com.catering.v2s.app.edge.generated.wire.CatalogItemBatchStatusTransitionRequest.class,
                String.class);

        assertTrue(Arrays.asList(batch.getAnnotation(PostMapping.class).value()).contains("/items/status"));
    }

    private record ReadRoute(String operationId, String controllerMethod, String path, String coordinatorMethod) {}
}
