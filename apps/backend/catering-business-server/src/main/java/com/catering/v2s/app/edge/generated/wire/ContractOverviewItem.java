// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ContractOverviewItem(
    ContractOverviewItemContractRef contractRef,
    ContractOverviewItemStoreRef storeRef,
    String phaseName,
    ContractOverviewItemTenantRef tenantRef,
    String effectiveFrom,
    String effectiveTo,
    String note,
    StoreContractStatus status,
    String source,
    Long revision,
    Long createdAt,
    Long updatedAt,
    String storeResolutionStatus,
    String tenantResolutionStatus,
    ContractOverviewItemProjectRef projectRef,
    java.util.List<StoreContractItem> items,
    java.util.List<ContractOverviewItemExtensionFieldsItem> extensionFields
) {}
