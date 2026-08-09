package com.catering.v2s.generated.operationbindings.fulfillmentproduction;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for fulfillment-production. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class FulfillmentProductionOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.ProductionTagPage getOperationsProductionTags(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.ProductionTagQuery request);
    OperationBindingTypes.Wire.ProductionTagReadback createOperationsProductionTag(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.ProductionTagCreateRequest request);
    OperationBindingTypes.Wire.ProductionTagReadback updateOperationsProductionTag(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.ProductionTagUpdateRequest request);
    OperationBindingTypes.Wire.ProductionTagReadback transitionOperationsProductionTagStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.ProductionTagTransitionRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public FulfillmentProductionOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PRODUCTION_TAGS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProductionTags", "fulfillment-production", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_PRODUCTION_TAG_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsProductionTag", "fulfillment-production", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_PRODUCTION_TAG_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsProductionTag", "fulfillment-production", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsProductionTagStatus", "fulfillment-production", "catalog-inventory");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsProductionTags" -> { if (descriptor != GET_OPERATIONS_PRODUCTION_TAGS_DESCRIPTOR || !"fulfillment-production".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsProductionTags" -> adapters.getOperationsProductionTags(GET_OPERATIONS_PRODUCTION_TAGS_DESCRIPTOR, context, (OperationBindingTypes.Wire.ProductionTagQuery) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.ProductionTagReadback createOperationsProductionTag(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.ProductionTagCreateRequest request) {
    return adapters.createOperationsProductionTag(CREATE_OPERATIONS_PRODUCTION_TAG_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.ProductionTagReadback updateOperationsProductionTag(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.ProductionTagUpdateRequest request) {
    return adapters.updateOperationsProductionTag(UPDATE_OPERATIONS_PRODUCTION_TAG_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.ProductionTagReadback transitionOperationsProductionTagStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.ProductionTagTransitionRequest request) {
    return adapters.transitionOperationsProductionTagStatus(TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS_DESCRIPTOR, context, request);
  }
}
