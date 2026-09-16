// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindingDisplayName", required = true) tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
