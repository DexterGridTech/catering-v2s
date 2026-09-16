// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuDisplayMedia(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mode", required = true) String mode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assetRefs", required = true) java.util.List<java.util.UUID> assetRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "primaryAssetRef", required = true) java.util.UUID primaryAssetRef
) {}
