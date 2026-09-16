// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuDraftItemViewSkuCandidatesItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "skuRef", required = true) java.util.UUID skuRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "skuName", required = true) String skuName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "skuCode", required = true) String skuCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "standardPriceCents", required = true) Long standardPriceCents
) {}
