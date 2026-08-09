package com.catering.v2s.generated.operationbindings.extension;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for extension. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class ExtensionOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.ExtensionDefinition getExtensionDefinition(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExtensionEntityCatalogPage getExtensionEntityCatalog(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExtensionDefinition replaceExtensionDefinition(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.ExtensionDefinitionUpdateRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public ExtensionOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor GET_EXTENSION_DEFINITION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getExtensionDefinition", "extension", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_EXTENSION_ENTITY_CATALOG_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getExtensionEntityCatalog", "extension", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REPLACE_EXTENSION_DEFINITION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("replaceExtensionDefinition", "extension", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getExtensionDefinition" -> { if (descriptor != GET_EXTENSION_DEFINITION_DESCRIPTOR || !"extension".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getExtensionEntityCatalog" -> { if (descriptor != GET_EXTENSION_ENTITY_CATALOG_DESCRIPTOR || !"extension".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getExtensionDefinition" -> adapters.getExtensionDefinition(GET_EXTENSION_DEFINITION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getExtensionEntityCatalog" -> adapters.getExtensionEntityCatalog(GET_EXTENSION_ENTITY_CATALOG_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.ExtensionDefinition replaceExtensionDefinition(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.ExtensionDefinitionUpdateRequest request) {
    return adapters.replaceExtensionDefinition(REPLACE_EXTENSION_DEFINITION_DESCRIPTOR, context, request);
  }
}
