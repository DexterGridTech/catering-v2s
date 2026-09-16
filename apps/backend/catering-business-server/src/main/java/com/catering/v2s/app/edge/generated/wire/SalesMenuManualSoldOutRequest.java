// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuManualSoldOutRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "target", required = true) SalesMenuManualSoldOutRequestTarget target,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reason", required = true) String reason,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
