// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingView(
    java.util.UUID bindingRef,
    String providerCode,
    String providerDisplayName,
    tools.jackson.databind.JsonNode capabilityClass,
    tools.jackson.databind.JsonNode capabilityClassDisplayName,
    java.util.List<String> businessScopeDisplayNames,
    String nodeType,
    String nodeTypeDisplayName,
    java.util.UUID nodeRef,
    tools.jackson.databind.JsonNode nodeDisplayPath,
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId,
    Long boundAt,
    Long statusChangedAt,
    String status,
    String statusDisplayName,
    Long version
) {}
