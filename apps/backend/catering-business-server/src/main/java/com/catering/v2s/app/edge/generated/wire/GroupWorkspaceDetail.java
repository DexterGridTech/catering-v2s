// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceDetail(
    String groupWorkspaceKey,
    String name,
    String operationsTitle,
    String logoAssetRef,
    String logoUrl,
    String notes,
    GroupWorkspaceStatus status,
    Long statusChangedAt,
    Long version,
    Long createdAt,
    Long updatedAt,
    GroupWorkspaceDetailCommercialGroup commercialGroup,
    String workspaceSourceStatus,
    Long workspaceAsOf,
    String workspaceUnresolved,
    String initializationSourceStatus,
    Long initializationAsOf,
    String initializationUnresolved,
    String accountAccessSourceStatus,
    Long accountAccessAsOf,
    String accountAccessUnresolved,
    Long accountCount,
    Long roleCount
) {}
