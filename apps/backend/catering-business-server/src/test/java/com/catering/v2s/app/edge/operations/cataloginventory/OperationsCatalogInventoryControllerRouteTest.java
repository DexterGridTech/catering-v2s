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
            jakarta.servlet.http.HttpServletRequest.class, java.util.Map.class, String.class, java.util.Map.class);
        String[] postPaths = post.getAnnotation(PostMapping.class).value();
        assertTrue(Arrays.asList(postPaths).contains("/categories/{categoryRef}/move"));
        assertFalse(Arrays.asList(postPaths).contains("/categories/{categoryCode}/move"));

        Method patch = OperationsCatalogInventoryController.class.getMethod("updateCatalogCategory", com.catering.v2s.app.edge.session.EdgeRequestContext.class,
            jakarta.servlet.http.HttpServletRequest.class, java.util.Map.class, String.class, java.util.Map.class);
        String[] patchPaths = patch.getAnnotation(PatchMapping.class).value();
        assertTrue(Arrays.asList(patchPaths).contains("/categories/{categoryRef}"));
        assertFalse(Arrays.asList(patchPaths).contains("/categories/{categoryCode}"));

        Method delete = OperationsCatalogInventoryController.class.getMethod("deleteCatalogCategory", com.catering.v2s.app.edge.session.EdgeRequestContext.class,
            jakarta.servlet.http.HttpServletRequest.class, java.util.Map.class, String.class, java.util.Map.class);
        assertTrue(Arrays.asList(delete.getAnnotation(DeleteMapping.class).value()).contains("/categories/{categoryRef}"));
    }
}
