// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspaceCreateResult(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "logoAssetRef", required = true) java.util.UUID logoAssetRef,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) GroupWorkspaceStatus status,
    Long statusChangedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
