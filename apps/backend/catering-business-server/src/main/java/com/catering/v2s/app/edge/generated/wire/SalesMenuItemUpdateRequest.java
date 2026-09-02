// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuItemUpdateRequest(
    String displayNameOverride,
    SalesMenuItemUpdateRequestSaleContent saleContent,
    SalesMenuOrderingConstraints orderingConstraints,
    SalesMenuDisplayMedia displayMedia,
    Long expectedVersion
) {}
