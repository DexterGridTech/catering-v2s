// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayNameOverride", required = true) String displayNameOverride,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "saleContent", required = true) SalesMenuItemUpdateRequestSaleContent saleContent,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderingConstraints", required = true) SalesMenuOrderingConstraints orderingConstraints,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayMedia", required = true) SalesMenuDisplayMedia displayMedia,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
