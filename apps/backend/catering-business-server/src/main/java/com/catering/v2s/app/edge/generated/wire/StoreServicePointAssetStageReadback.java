// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreServicePointAssetStageReadback(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assetRef", required = true) java.util.UUID assetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindGrant", required = true) String bindGrant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {
  @Override
  public String toString() {
    return "StoreServicePointAssetStageReadback["
        + "assetRef=" + assetRef
        + ", redacted=" + "[REDACTED]"
        + ", status=" + status
        + ", version=" + version
        + "]";
  }
}
