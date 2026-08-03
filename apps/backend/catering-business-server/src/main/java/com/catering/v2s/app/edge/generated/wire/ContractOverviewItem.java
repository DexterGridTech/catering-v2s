// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ContractOverviewItem(
    ContractOverviewItemContractRef contractRef,
    ContractOverviewItemStoreRef storeRef,
    ContractOverviewItemProjectRef projectRef,
    String phaseName,
    ContractOverviewItemTenantRef tenantRef,
    String effectiveFrom,
    String effectiveTo,
    String note,
    String itemSummary,
    java.util.List<StoreContractItem> items,
    StoreContractStatus status,
    String source,
    Long revision,
    Long createdAt,
    Long updatedAt,
    String storeResolutionStatus,
    String tenantResolutionStatus,
    java.util.List<ContractOverviewItemExtensionFieldsItem> extensionFields
) {}
