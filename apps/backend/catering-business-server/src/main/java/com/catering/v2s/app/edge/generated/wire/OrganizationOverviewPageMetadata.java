// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationOverviewPageMetadata(
    String groupWorkspaceKey,
    OrganizationOverviewCategory category,
    Long page,
    Long pageSize,
    Long total,
    OrganizationOverviewSortKey sort,
    OrganizationOverviewSortDirection direction,
    Long definitionRevision
) {}
