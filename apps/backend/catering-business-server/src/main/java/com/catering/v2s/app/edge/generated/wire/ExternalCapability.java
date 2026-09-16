// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExternalCapability(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "capabilityClass", required = true) ExternalCapabilityCapabilityClass capabilityClass,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "attributeValues", required = true) ExternalCapabilityAttributeValues attributeValues
) {}
