// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceDisplayUpdateRequest(
    String name,
    String operationsTitle,
    String notes,
    String logoIntent,
    java.util.UUID logoAssetRef,
    String logoBindGrant,
    Long expectedVersion,
    String idempotencyKey
) {}
