// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuDraftItemView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesItemRef", required = true) java.util.UUID salesItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogItemRef", required = true) java.util.UUID catalogItemRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "itemCode", required = true) String itemCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "productShape", required = true) String productShape,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogOrderOptions", required = true) java.util.List<SalesMenuDraftItemViewCatalogOrderOptionsItem> catalogOrderOptions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "skuCandidates", required = true) java.util.List<SalesMenuDraftItemViewSkuCandidatesItem> skuCandidates,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "staleSelectedSkuRefs", required = true) java.util.List<java.util.UUID> staleSelectedSkuRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "defaultPriceCents", required = true) Long defaultPriceCents,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogPrimaryImageAssetRef", required = true) java.util.UUID catalogPrimaryImageAssetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "catalogImageAssetRefs", required = true) java.util.List<java.util.UUID> catalogImageAssetRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "saleContent", required = true) SalesMenuSaleContent saleContent,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "orderingConstraints", required = true) SalesMenuOrderingConstraints orderingConstraints,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayMedia", required = true) SalesMenuDisplayMedia displayMedia,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayOrder", required = true) Long displayOrder,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "canMoveUp", required = true) Boolean canMoveUp,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "canMoveDown", required = true) Boolean canMoveDown,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
