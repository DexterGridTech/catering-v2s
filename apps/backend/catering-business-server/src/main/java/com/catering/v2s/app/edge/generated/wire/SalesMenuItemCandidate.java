// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemCandidate(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "candidateRef", required = true) java.util.UUID candidateRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogItemRef", required = true) java.util.UUID catalogItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemCode", required = true) String itemCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "productShape", required = true) String productShape,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "categoryRefs", required = true) java.util.List<java.util.UUID> categoryRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "categoryNames", required = true) java.util.List<String> categoryNames,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "defaultPriceCents", required = true) Long defaultPriceCents,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "alreadyAddedCount", required = true) Long alreadyAddedCount
) {}
