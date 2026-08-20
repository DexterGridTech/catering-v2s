// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingCreateRequest(
    String providerCode,
    tools.jackson.databind.JsonNode capabilityClass,
    String nodeType,
    java.util.UUID nodeRef,
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId
) {}
