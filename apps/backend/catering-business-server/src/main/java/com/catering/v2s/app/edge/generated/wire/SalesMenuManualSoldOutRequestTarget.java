// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuManualSoldOutRequestTarget(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetKind", required = true) String targetKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetRef", required = true) java.util.UUID targetRef
) {}
