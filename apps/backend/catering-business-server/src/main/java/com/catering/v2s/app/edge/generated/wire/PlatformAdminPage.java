// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminPage(
    java.util.List<PlatformAdminPageItemsItem> items,
    Long page,
    Long pageSize,
    Long total,
    PlatformAdminSortKey sortKey,
    SortDirection sortDirection
) {}
