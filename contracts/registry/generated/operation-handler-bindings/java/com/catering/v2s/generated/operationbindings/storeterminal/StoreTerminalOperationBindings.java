package com.catering.v2s.generated.operationbindings.storeterminal;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for store-terminal. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class StoreTerminalOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.StoreTerminalDetail getOperationsStoreTerminal(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreTerminalAreaCandidatePage getOperationsStoreTerminalAreaCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreTerminalPage getOperationsStoreTerminals(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreTerminalTagCandidatePage getOperationsStoreTerminalTagCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreTerminalMutation postOperationsStoreTerminal(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreTerminalCreateRequest request);
    OperationBindingTypes.Wire.StoreTerminalMutation postOperationsStoreTerminalStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreTerminalStatusRequest request);
    OperationBindingTypes.Wire.StoreTerminalMutation putOperationsStoreTerminal(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreTerminalReplaceRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public StoreTerminalOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_TERMINAL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreTerminal", "store-terminal", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreTerminalAreaCandidates", "store-terminal", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_TERMINALS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreTerminals", "store-terminal", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreTerminalTagCandidates", "store-terminal", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor POST_OPERATIONS_STORE_TERMINAL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("postOperationsStoreTerminal", "store-terminal", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor POST_OPERATIONS_STORE_TERMINAL_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("postOperationsStoreTerminalStatus", "store-terminal", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor PUT_OPERATIONS_STORE_TERMINAL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("putOperationsStoreTerminal", "store-terminal", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsStoreTerminal" -> { if (descriptor != GET_OPERATIONS_STORE_TERMINAL_DESCRIPTOR || !"store-terminal".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreTerminalAreaCandidates" -> { if (descriptor != GET_OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES_DESCRIPTOR || !"store-terminal".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreTerminals" -> { if (descriptor != GET_OPERATIONS_STORE_TERMINALS_DESCRIPTOR || !"store-terminal".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreTerminalTagCandidates" -> { if (descriptor != GET_OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES_DESCRIPTOR || !"store-terminal".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsStoreTerminal" -> adapters.getOperationsStoreTerminal(GET_OPERATIONS_STORE_TERMINAL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreTerminalAreaCandidates" -> adapters.getOperationsStoreTerminalAreaCandidates(GET_OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreTerminals" -> adapters.getOperationsStoreTerminals(GET_OPERATIONS_STORE_TERMINALS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreTerminalTagCandidates" -> adapters.getOperationsStoreTerminalTagCandidates(GET_OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.StoreTerminalMutation postOperationsStoreTerminal(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreTerminalCreateRequest request) {
    return adapters.postOperationsStoreTerminal(POST_OPERATIONS_STORE_TERMINAL_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.StoreTerminalMutation postOperationsStoreTerminalStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreTerminalStatusRequest request) {
    return adapters.postOperationsStoreTerminalStatus(POST_OPERATIONS_STORE_TERMINAL_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.StoreTerminalMutation putOperationsStoreTerminal(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreTerminalReplaceRequest request) {
    return adapters.putOperationsStoreTerminal(PUT_OPERATIONS_STORE_TERMINAL_DESCRIPTOR, context, request);
  }
}
