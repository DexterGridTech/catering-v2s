package com.catering.v2s.app.edge.operations.cataloginventory;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;

class OperationsCatalogInventoryControllerRouteTest {
    @Test
    void categoryRoutesUseOpaqueRefsAndExposeOnlyTheRegisteredDeleteCommand() throws Exception {
        Method post = OperationsCatalogInventoryController.class.getMethod("moveCatalogCategory", com.catering.v2s.app.edge.session.EdgeRequestContext.class,
            jakarta.servlet.http.HttpServletRequest.class, com.catering.v2s.app.edge.generated.wire.CatalogCategoryMoveRequest.class, String.class, String.class);
        String[] postPaths = post.getAnnotation(PostMapping.class).value();
        assertTrue(Arrays.asList(postPaths).contains("/categories/{categoryRef}/move"));
        assertFalse(Arrays.asList(postPaths).contains("/categories/{categoryCode}/move"));

        Method patch = OperationsCatalogInventoryController.class.getMethod("updateCatalogCategory", com.catering.v2s.app.edge.session.EdgeRequestContext.class,
            jakarta.servlet.http.HttpServletRequest.class, com.catering.v2s.app.edge.generated.wire.CatalogCategoryUpdateRequest.class, String.class, String.class);
        String[] patchPaths = patch.getAnnotation(PatchMapping.class).value();
        assertTrue(Arrays.asList(patchPaths).contains("/categories/{categoryRef}"));
        assertFalse(Arrays.asList(patchPaths).contains("/categories/{categoryCode}"));

        Method delete = OperationsCatalogInventoryController.class.getMethod("deleteCatalogCategory", com.catering.v2s.app.edge.session.EdgeRequestContext.class,
            jakarta.servlet.http.HttpServletRequest.class, com.catering.v2s.app.edge.generated.wire.CatalogCategoryDeleteRequest.class, String.class, String.class);
        assertTrue(Arrays.asList(delete.getAnnotation(DeleteMapping.class).value()).contains("/categories/{categoryRef}"));
    }

    @Test
    void catalogAssetRoutesKeepMultipartStageAndTypedPathRelease() throws Exception {
        Method stage = OperationsCatalogInventoryController.class.getMethod("stageAsset",
            com.catering.v2s.app.edge.session.EdgeRequestContext.class, jakarta.servlet.http.HttpServletRequest.class,
            org.springframework.web.multipart.MultipartFile.class, String.class, String.class, String.class, String.class, String.class);
        PostMapping stageMapping = stage.getAnnotation(PostMapping.class);
        assertTrue(Arrays.asList(stageMapping.value()).contains("/assets/stage"));
        assertTrue(Arrays.asList(stageMapping.consumes()).contains("multipart/form-data"));

        Method release = OperationsCatalogInventoryController.class.getMethod("releaseCatalogAsset",
            com.catering.v2s.app.edge.session.EdgeRequestContext.class, jakarta.servlet.http.HttpServletRequest.class,
            com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseRequest.class, String.class, String.class);
        assertTrue(Arrays.asList(release.getAnnotation(PostMapping.class).value()).contains("/assets/{assetRef}/release"));
    }

    @Test
    void catalogItemAndTemporaryPromotionCommandsUseTypedP1Transport() throws Exception {
        Method create = OperationsCatalogInventoryController.class.getMethod("createCatalogItem",
            com.catering.v2s.app.edge.session.EdgeRequestContext.class, jakarta.servlet.http.HttpServletRequest.class,
            com.catering.v2s.app.edge.generated.wire.CatalogItemCreateRequest.class, String.class);
        Method transition = OperationsCatalogInventoryController.class.getMethod("transitionCatalogItemStatus",
            com.catering.v2s.app.edge.session.EdgeRequestContext.class, jakarta.servlet.http.HttpServletRequest.class,
            com.catering.v2s.app.edge.generated.wire.CatalogItemTransitionRequest.class, String.class, String.class);
        Method preflight = OperationsCatalogInventoryController.class.getMethod("preflightTemporaryCatalogPromotion",
            com.catering.v2s.app.edge.session.EdgeRequestContext.class, jakarta.servlet.http.HttpServletRequest.class,
            com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflightRequest.class, String.class, String.class);
        Method execute = OperationsCatalogInventoryController.class.getMethod("executeTemporaryCatalogPromotion",
            com.catering.v2s.app.edge.session.EdgeRequestContext.class, jakarta.servlet.http.HttpServletRequest.class,
            com.catering.v2s.app.edge.generated.wire.TemporaryPromotionExecuteRequest.class, String.class, String.class);

        assertTrue(Arrays.asList(create.getAnnotation(PostMapping.class).value()).contains("/items"));
        assertTrue(Arrays.asList(transition.getAnnotation(PostMapping.class).value()).contains("/items/{itemCode}/status"));
        assertTrue(Arrays.asList(preflight.getAnnotation(PostMapping.class).value()).contains("/items/{itemCode}/temporary-promotion/preflight"));
        assertTrue(Arrays.asList(execute.getAnnotation(PostMapping.class).value()).contains("/items/{itemCode}/temporary-promotion/execute"));
    }
}
