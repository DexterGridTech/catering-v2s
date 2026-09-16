// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceDetail(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    java.util.UUID logoAssetRef,
    String logoUrl,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) GroupWorkspaceStatus status,
    Long statusChangedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
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
