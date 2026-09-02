// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemCandidate(
    java.util.UUID candidateRef,
    java.util.UUID catalogItemRef,
    String itemCode,
    String displayName,
    String productShape,
    java.util.List<java.util.UUID> categoryRefs,
    java.util.List<String> categoryNames,
    Long defaultPriceCents,
    Long alreadyAddedCount
) {}
