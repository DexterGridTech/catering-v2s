// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRoleCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    String description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "serviceNodeType", required = true) String serviceNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "capabilityKeys", required = true) java.util.List<String> capabilityKeys,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageAccessKeys", required = true) java.util.List<String> pageAccessKeys
) {}
