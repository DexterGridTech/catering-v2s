// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAssetStagingResult(
    java.util.UUID assetRef,
    String bindGrant,
    Long expiresAt,
    String contentType,
    Long sizeBytes,
    String sha256
) {}
