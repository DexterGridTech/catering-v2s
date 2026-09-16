// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSelectDataNodeRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataNodeRef", required = true) java.util.UUID dataNodeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "dataNodeType", required = true) String dataNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "requiredContextVersion", required = true) Long requiredContextVersion
) {}
