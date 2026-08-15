package com.catering.v2s.app.edge.platform.asset;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.generated.wire.PlatformAssetStagingResult;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/platform/assets/staging")
public final class PlatformAssetController {
    private static final String GROUP_WORKSPACE_LOGO = "GROUP_WORKSPACE_LOGO";
    private final PlatformSessionResolver sessions; private final PlatformAssetService assets;
    public PlatformAssetController(PlatformSessionResolver sessions, PlatformAssetService assets) { this.sessions = sessions; this.assets = assets; }
    @PostMapping ResponseEntity<PlatformAssetStagingResult> stage(EdgeRequestContext request, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestPart String usage, @RequestPart MultipartFile file) throws IOException { sessions.require(request); key(idempotencyKey); if (!GROUP_WORKSPACE_LOGO.equals(usage) || file == null || file.getContentType() == null) throw new PlatformAssetService.AssetInputInvalidException(); try (var stream = file.getInputStream()) { var staged = assets.stageContent(usage, file.getContentType(), file.getSize(), stream, idempotencyKey); return ResponseEntity.status(HttpStatus.CREATED).body(new PlatformAssetStagingResult(staged.assetRef(), staged.bindGrant(), staged.expiresAt(), staged.contentType(), staged.sizeBytes(), staged.sha256())); } }
    /** Cancels an unclaimed staged upload using the owner-issued one-time proof. */
    @PostMapping("/{assetRef}/release") ResponseEntity<Void> releaseStaged(EdgeRequestContext request, @org.springframework.web.bind.annotation.PathVariable UUID assetRef, @RequestHeader("X-Asset-Bind-Grant") String bindGrant) { sessions.require(request); assets.releaseStaged(assetRef, bindGrant); return ResponseEntity.noContent().build(); }
    private static void key(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key"); }
}
