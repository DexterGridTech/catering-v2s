package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.catalog.application.persistence.CatalogWorkbenchReadPersistence;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

class CatalogWorkbenchProductionTagOwnerFailureTest {
    @Test
    void missingProductionTagOwnerFailsConstructionInsteadOfBecomingAnEmptyNavigationBranch() {
        NullPointerException failure = assertThrows(
                NullPointerException.class,
                () -> new CatalogWorkbenchReadService(
                        mock(JdbcTemplate.class),
                        new ObjectMapper(),
                        (TimeProvider) () -> 1_785_000_000_000L,
                        mock(CatalogAssetReferenceLock.class),
                        null,
                        mock(InventoryOwnerApi.class),
                        mock(PlatformTransactionManager.class)));

        assertEquals("productionTags", failure.getMessage());
    }

    @Test
    void failingProductionTagOwnerFailsNavigationInsteadOfReturningAnEmptyBranch() {
        CatalogWorkbenchReadPersistence persistence = mock(CatalogWorkbenchReadPersistence.class);
        when(persistence.readNavigationCategories("scope", "brand")).thenReturn(java.util.List.of());
        when(persistence.readNavigationTags("scope", "brand")).thenReturn(java.util.List.of());

        CatalogProductionTagOwnerApi productionTags = mock(CatalogProductionTagOwnerApi.class);
        when(productionTags.readNavigationTags("scope", "brand", "request"))
                .thenThrow(new IllegalStateException("catalog production tag owner unavailable"));

        CatalogWorkbenchReadService service = new CatalogWorkbenchReadService(
                persistence,
                mock(JdbcTemplate.class),
                new ObjectMapper(),
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CatalogAssetReferenceLock.class),
                productionTags,
                mock(InventoryOwnerApi.class),
                mock(PlatformTransactionManager.class));

        assertThrows(
                IllegalStateException.class,
                () -> service.readNavigation("scope", "brand", new ObjectMapper().createObjectNode(), "request"));
    }
}
