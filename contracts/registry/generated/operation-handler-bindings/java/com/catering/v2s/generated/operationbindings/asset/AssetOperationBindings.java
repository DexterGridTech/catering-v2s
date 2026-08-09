package com.catering.v2s.generated.operationbindings.asset;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for asset. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class AssetOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.StagedCatalogAsset stageOperationsCatalogAsset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogAssetStageRequest request);
    OperationBindingTypes.Wire.CatalogAssetReleaseReadback releaseOperationsCatalogStagedAsset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogAssetReleaseRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public AssetOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor STAGE_OPERATIONS_CATALOG_ASSET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("stageOperationsCatalogAsset", "asset", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor RELEASE_OPERATIONS_CATALOG_STAGED_ASSET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("releaseOperationsCatalogStagedAsset", "asset", "catalog-inventory");



  public OperationBindingTypes.Wire.StagedCatalogAsset stageOperationsCatalogAsset(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogAssetStageRequest request) {
    return adapters.stageOperationsCatalogAsset(STAGE_OPERATIONS_CATALOG_ASSET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogAssetReleaseReadback releaseOperationsCatalogStagedAsset(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogAssetReleaseRequest request) {
    return adapters.releaseOperationsCatalogStagedAsset(RELEASE_OPERATIONS_CATALOG_STAGED_ASSET_DESCRIPTOR, context, request);
  }
}
