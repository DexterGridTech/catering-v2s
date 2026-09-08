// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublishedItemView(
    java.util.UUID salesItemRef,
    java.util.UUID catalogItemRef,
    String itemCode,
    String displayName,
    String productShape,
    SalesMenuSaleContent saleContent,
    SalesMenuOrderingConstraints orderingConstraints,
    SalesMenuDisplayMedia displayMedia,
    java.util.UUID publishedPrimaryImageAssetRef,
    java.util.List<java.util.UUID> publishedCatalogImageAssetRefs,
    Long displayOrder,
    InventoryAvailabilityFact inventoryAvailability,
    ManualSaleStatusFact manualSaleStatus,
    java.util.List<SalesMenuPublishedItemViewManualSaleTargetStatusesItem> manualSaleTargetStatuses,
    Long version
) {}
