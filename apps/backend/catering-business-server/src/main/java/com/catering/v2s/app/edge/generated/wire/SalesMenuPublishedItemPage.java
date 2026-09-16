// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublishedItemPage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<SalesMenuPublishedItemView> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "cursor", required = true) String cursor,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nextCursor", required = true) String nextCursor
) {}
