// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExtensionFilter(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "fieldKey", required = true) String fieldKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) ExtensionFieldType type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "value", required = true) String value
) {}
