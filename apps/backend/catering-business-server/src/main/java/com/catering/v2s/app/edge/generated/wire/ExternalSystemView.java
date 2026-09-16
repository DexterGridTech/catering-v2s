// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ExternalSystemView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "externalSystemCode", required = true) String externalSystemCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogStatus", required = true) ExternalSystemViewCatalogStatus catalogStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "capabilities", required = true) java.util.List<ExternalCapability> capabilities,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "enablementStatus", required = true) ExternalSystemViewEnablementStatus enablementStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
