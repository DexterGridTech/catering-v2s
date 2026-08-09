package com.catering.v2s.generated.operationbindings.platformasset;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for platform-asset. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class PlatformAssetOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.PublicAssetReference getPublicAssetContent(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.NoContent releasePlatformStagedAsset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PlatformAssetStagingResult stagePlatformAsset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAssetStageMultipart request);
  }

  private final OwnerLocalAdapters adapters;

  public PlatformAssetOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor GET_PUBLIC_ASSET_CONTENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPublicAssetContent", "platform-asset", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RELEASE_PLATFORM_STAGED_ASSET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("releasePlatformStagedAsset", "platform-asset", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor STAGE_PLATFORM_ASSET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("stagePlatformAsset", "platform-asset", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getPublicAssetContent" -> { if (descriptor != GET_PUBLIC_ASSET_CONTENT_DESCRIPTOR || !"platform-asset".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getPublicAssetContent" -> adapters.getPublicAssetContent(GET_PUBLIC_ASSET_CONTENT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.NoContent releasePlatformStagedAsset(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.releasePlatformStagedAsset(RELEASE_PLATFORM_STAGED_ASSET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformAssetStagingResult stagePlatformAsset(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAssetStageMultipart request) {
    return adapters.stagePlatformAsset(STAGE_PLATFORM_ASSET_DESCRIPTOR, context, request);
  }
}
