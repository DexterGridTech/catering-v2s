// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ManualSaleStatusFact(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "state", required = true) String state,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reason", required = true) String reason,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "changedAt", required = true) Long changedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "changedByDisplayName", required = true) String changedByDisplayName
) {}
