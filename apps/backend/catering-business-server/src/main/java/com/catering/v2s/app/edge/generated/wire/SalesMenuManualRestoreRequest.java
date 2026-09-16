// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuManualRestoreRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "target", required = true) SalesMenuManualRestoreRequestTarget target,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "confirm", required = true) Boolean confirm,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
