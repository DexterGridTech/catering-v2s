// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceAccountPage(
    java.util.List<WorkspaceAccount> items,
    Long page,
    Long pageSize,
    Long total,
    WorkspacePlatformAccountSortKey sort,
    SortDirection direction
) {}
