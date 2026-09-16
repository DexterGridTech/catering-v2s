// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRole(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    String description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "serviceNodeType", required = true) String serviceNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "capabilityKeys", required = true) java.util.List<String> capabilityKeys,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageAccessKeys", required = true) java.util.List<String> pageAccessKeys,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceRoleStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
