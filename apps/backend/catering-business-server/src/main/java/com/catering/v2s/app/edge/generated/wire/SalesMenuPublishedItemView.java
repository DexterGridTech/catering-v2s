// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublishedItemView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesItemRef", required = true) java.util.UUID salesItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogItemRef", required = true) java.util.UUID catalogItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemCode", required = true) String itemCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "productShape", required = true) String productShape,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "saleContent", required = true) SalesMenuSaleContent saleContent,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderingConstraints", required = true) SalesMenuOrderingConstraints orderingConstraints,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayMedia", required = true) SalesMenuDisplayMedia displayMedia,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "publishedPrimaryImageAssetRef", required = true) java.util.UUID publishedPrimaryImageAssetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "publishedCatalogImageAssetRefs", required = true) java.util.List<java.util.UUID> publishedCatalogImageAssetRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "inventoryAvailability", required = true) InventoryAvailabilityFact inventoryAvailability,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "manualSaleStatus", required = true) ManualSaleStatusFact manualSaleStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "manualSaleTargetStatuses", required = true) java.util.List<SalesMenuPublishedItemViewManualSaleTargetStatusesItem> manualSaleTargetStatuses,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
