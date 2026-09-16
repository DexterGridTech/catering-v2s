// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAssetStagingResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assetRef", required = true) java.util.UUID assetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindGrant", required = true) String bindGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAt", required = true) Long expiresAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contentType", required = true) String contentType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sizeBytes", required = true) Long sizeBytes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sha256", required = true) String sha256
) {}
