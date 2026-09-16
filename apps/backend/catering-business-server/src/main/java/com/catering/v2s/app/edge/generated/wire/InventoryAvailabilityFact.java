// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record InventoryAvailabilityFact(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "applicability", required = true) String applicability,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "state", required = true) String state,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reason", required = true) String reason
) {}
