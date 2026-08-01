// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceCreateResult(
    String groupWorkspaceKey,
    String name,
    String operationsTitle,
    String logoAssetRef,
    String notes,
    GroupWorkspaceStatus status,
    Long statusChangedAt,
    Long version,
    Long createdAt,
    Long updatedAt
) {}
