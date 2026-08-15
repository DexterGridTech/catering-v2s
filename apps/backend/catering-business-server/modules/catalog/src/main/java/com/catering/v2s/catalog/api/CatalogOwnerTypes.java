package com.catering.v2s.catalog.api;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import java.util.List;

public final class CatalogOwnerTypes {
    private CatalogOwnerTypes() { }

    public static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    public static final List<String> SHAPES = CatalogInventoryShapeManifest.enumValues("shapeKey");
    public static final List<String> STATUSES = CatalogInventoryShapeManifest.enumValues("catalogItemStatus");
    public static final List<String> CAPABILITIES = CatalogInventoryShapeManifest.enumValues("usageCapability");
}
