// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSchedule(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "kind", required = true) String kind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "startLocalTime", required = true) String startLocalTime,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "endLocalTime", required = true) String endLocalTime
) {}
