// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ContractOverviewPageMetadata(
    String groupWorkspaceKey,
    Long page,
    Long pageSize,
    Long total,
    StoreContractSortKey sort,
    StoreContractSortDirection direction,
    Long definitionRevision
) {}
