// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuSaleContentSelectedOrderOptionsItem(
    java.util.UUID definitionRef,
    String name,
    String selectionMode,
    Long displayOrder,
    Boolean required,
    Long minSelectionCount,
    Long maxSelectionCount,
    java.util.List<SalesMenuSaleContentSelectedOrderOptionsItemValuesItem> values
) {}
