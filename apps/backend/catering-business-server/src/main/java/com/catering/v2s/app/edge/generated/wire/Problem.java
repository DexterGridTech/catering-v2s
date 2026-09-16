// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record Problem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) String type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "title", required = true) String title,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) Long status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "detail", required = true) String detail,
    String instance,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "errorCode", required = true) String errorCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "correlationId", required = true) String correlationId
) {}
