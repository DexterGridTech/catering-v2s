// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuAssetStageReadback(
    java.util.UUID assetRef,
    String bindGrant,
    String status,
    Long version,
    SalesMenuAssetTargetReadback target
) {}
