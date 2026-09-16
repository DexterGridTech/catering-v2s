// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindingRef", required = true) java.util.UUID bindingRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "providerCode", required = true) String providerCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "providerDisplayName", required = true) String providerDisplayName,
    OwnerBindingViewCapabilityClass capabilityClass,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "businessScope", required = true) java.util.List<OwnerBindingViewBusinessScopeItem> businessScope,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodeType", required = true) OwnerBindingViewNodeType nodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodeRef", required = true) java.util.UUID nodeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nodePath", required = true) java.util.List<OrganizationPathNode> nodePath,
    tools.jackson.databind.JsonNode bindingDisplayName,
    tools.jackson.databind.JsonNode externalOwnerId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "boundAt", required = true) Long boundAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "statusChangedAt", required = true) Long statusChangedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) OwnerBindingViewStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
