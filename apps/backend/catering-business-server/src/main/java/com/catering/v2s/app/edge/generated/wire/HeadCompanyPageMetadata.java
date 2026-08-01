// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record HeadCompanyPageMetadata(
    String groupWorkspaceKey,
    Long page,
    Long pageSize,
    Long total,
    BusinessEntitySortKey sort,
    BusinessEntitySortDirection direction
) {}
