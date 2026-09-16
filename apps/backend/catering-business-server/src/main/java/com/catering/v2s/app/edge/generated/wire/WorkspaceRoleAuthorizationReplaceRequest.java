// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRoleAuthorizationReplaceRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "pageAccessKeys", required = true) java.util.List<String> pageAccessKeys,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actionCapabilityKeys", required = true) java.util.List<String> actionCapabilityKeys,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
