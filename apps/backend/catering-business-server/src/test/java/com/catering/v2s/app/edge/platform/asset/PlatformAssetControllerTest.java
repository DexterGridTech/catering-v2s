package com.catering.v2s.app.edge.platform.asset;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MultipartFile;

class PlatformAssetControllerTest {
    @Test
    void platformStagingRejectsCatalogImagesBeforeTheyCanCreateAnUnscopedAsset() {
        PlatformAssetService assets = mock(PlatformAssetService.class);
        PlatformAssetController controller = new PlatformAssetController(mock(PlatformSessionResolver.class), assets);
        MultipartFile catalogImage = mock(MultipartFile.class);
        when(catalogImage.getContentType()).thenReturn("image/png");

        assertThrows(
                PlatformAssetService.AssetInputInvalidException.class,
                () -> controller.stage(
                        mock(EdgeRequestContext.class),
                        "platform-stage-catalog-image",
                        "CATALOG_ITEM_IMAGE",
                        catalogImage));

        verifyNoInteractions(assets);
    }
}
