// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "providerCode", required = true) String providerCode,
    String capabilityClass,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodeType", required = true) String nodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodeRef", required = true) java.util.UUID nodeRef,
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId
) {}
