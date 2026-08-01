// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceCreateRequest(
    String groupWorkspaceKey,
    String name,
    String operationsTitle,
    String logoAssetRef,
    String logoBindGrant,
    String notes,
    String idempotencyKey
) {}
