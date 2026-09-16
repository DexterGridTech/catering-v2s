// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuScheduleUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "schedule", required = true) SalesMenuSchedule schedule,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
