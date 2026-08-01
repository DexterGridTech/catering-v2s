// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspacePage(
    java.util.List<GroupWorkspacePageItemsItem> items,
    Long page,
    Long pageSize,
    Long total,
    GroupWorkspaceSortKey sortKey,
    SortDirection sortDirection
) {}
