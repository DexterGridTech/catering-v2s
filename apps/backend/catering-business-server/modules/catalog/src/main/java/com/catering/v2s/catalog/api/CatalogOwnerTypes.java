package com.catering.v2s.catalog.api;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import java.util.List;

public final class CatalogOwnerTypes {
    private CatalogOwnerTypes() { }

    public static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    public static final List<String> SHAPES = List.of(CatalogInventoryShapeManifest.SHAPE_KEYS);
    public static final List<String> STATUSES = List.of("DRAFT", "ENABLED", "DISABLED", "ARCHIVED", "VOIDED");
    public static final List<String> CAPABILITIES = List.of(CatalogInventoryShapeManifest.CAPABILITY_VALUES);
}
