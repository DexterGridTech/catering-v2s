// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSelectContextRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleAssignmentRef", required = true) java.util.UUID roleAssignmentRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "requiredContextVersion", required = true) Long requiredContextVersion
) {}
