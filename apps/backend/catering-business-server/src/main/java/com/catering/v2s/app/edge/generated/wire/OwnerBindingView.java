// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingView(
    java.util.UUID bindingRef,
    String providerCode,
    String providerDisplayName,
    OwnerBindingViewCapabilityClass capabilityClass,
    java.util.List<OwnerBindingViewBusinessScopeItem> businessScope,
    OwnerBindingViewNodeType nodeType,
    java.util.UUID nodeRef,
    java.util.List<OrganizationPathNode> nodePath,
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId,
    Long boundAt,
    Long statusChangedAt,
    OwnerBindingViewStatus status,
    Long version
) {}
