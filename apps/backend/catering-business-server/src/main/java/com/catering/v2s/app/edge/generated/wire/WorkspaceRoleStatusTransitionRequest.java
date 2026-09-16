// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRoleStatusTransitionRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetStatus", required = true) WorkspaceRoleStatus targetStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
