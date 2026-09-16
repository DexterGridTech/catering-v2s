// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuAssetReleaseReadback(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assetRef", required = true) java.util.UUID assetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "target", required = true) SalesMenuAssetTargetReadback target
) {}
