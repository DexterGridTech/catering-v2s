// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OwnerBindingPageMetadata(
    tools.jackson.databind.JsonNode bindingName,
    tools.jackson.databind.JsonNode nodeQueryText,
    String sortKey,
    String sortDirection,
    Long page,
    Long pageSize,
    Long total
) {}
