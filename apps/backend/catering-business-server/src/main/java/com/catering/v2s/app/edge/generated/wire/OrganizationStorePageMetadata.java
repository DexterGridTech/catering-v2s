// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStorePageMetadata(
    String groupWorkspaceKey,
    OrganizationStorePageMetadataDataScope dataScope,
    Long page,
    Long pageSize,
    Long total,
    OrganizationStoreSortKey sort,
    OrganizationStoreSortDirection direction,
    Long definitionRevision
) {}
