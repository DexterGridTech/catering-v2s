package com.catering.v2s.app.edge.publicentry.asset;

import com.catering.v2s.app.edge.generated.wire.PublicAssetReference;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/assets/{assetRef}/content")
public final class PublicAssetController {
    private final PlatformAssetService assets;
    public PublicAssetController(PlatformAssetService assets) { this.assets = assets; }
    @GetMapping PublicAssetReference content(@PathVariable UUID assetRef) { var reference = assets.requireActivePublicReference(assetRef); return new PublicAssetReference(reference.publicUrl(), reference.contentType(), reference.sha256()); }
}
