// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TenantPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "metadata", required = true) TenantPageMetadata metadata,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<Tenant> items
) {}
