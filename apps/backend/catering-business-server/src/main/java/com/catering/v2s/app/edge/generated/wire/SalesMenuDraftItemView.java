// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuDraftItemView(
    java.util.UUID salesItemRef,
    java.util.UUID catalogItemRef,
    String itemCode,
    String displayName,
    String productShape,
    java.util.List<SalesMenuDraftItemViewCatalogOrderOptionsItem> catalogOrderOptions,
    java.util.List<SalesMenuDraftItemViewSkuCandidatesItem> skuCandidates,
    java.util.List<java.util.UUID> staleSelectedSkuRefs,
    Long defaultPriceCents,
    java.util.UUID catalogPrimaryImageAssetRef,
    java.util.List<java.util.UUID> catalogImageAssetRefs,
    SalesMenuSaleContent saleContent,
    SalesMenuOrderingConstraints orderingConstraints,
    SalesMenuDisplayMedia displayMedia,
    Long displayOrder,
    Boolean canMoveUp,
    Boolean canMoveDown,
    Long version
) {}
