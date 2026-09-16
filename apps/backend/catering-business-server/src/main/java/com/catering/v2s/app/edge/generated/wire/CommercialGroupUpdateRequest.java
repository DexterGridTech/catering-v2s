// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record CommercialGroupUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupCode", required = true) String groupCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupName", required = true) String groupName,
    tools.jackson.databind.JsonNode extensionValues,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
