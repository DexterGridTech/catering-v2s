package com.catering.v2s.generated.operationbindings.terminalbinding;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for terminal-binding. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class TerminalBindingOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.OperationsTerminalActivationCancellationResult cancelOperationsStoreTerminalActivation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OperationsTerminalActivationCancellationRequest request);
    OperationBindingTypes.Wire.TerminalActivationResult activateTerminal(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.TerminalActivationRequest request);
    OperationBindingTypes.Wire.TerminalActivationCancellationResult cancelTerminalActivation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialCommandContext context, OperationBindingTypes.Wire.TerminalActivationCancellationRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public TerminalBindingOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CANCEL_OPERATIONS_STORE_TERMINAL_ACTIVATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelOperationsStoreTerminalActivation", "terminal-binding", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor ACTIVATE_TERMINAL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("activateTerminal", "terminal-binding", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_TERMINAL_ACTIVATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelTerminalActivation", "terminal-binding", "edge-face");



  public OperationBindingTypes.Wire.OperationsTerminalActivationCancellationResult cancelOperationsStoreTerminalActivation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OperationsTerminalActivationCancellationRequest request) {
    return adapters.cancelOperationsStoreTerminalActivation(CANCEL_OPERATIONS_STORE_TERMINAL_ACTIVATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.TerminalActivationResult activateTerminal(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.TerminalActivationRequest request) {
    return adapters.activateTerminal(ACTIVATE_TERMINAL_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.TerminalActivationCancellationResult cancelTerminalActivation(OperationBindingTypes.TerminalCredentialCommandContext context, OperationBindingTypes.Wire.TerminalActivationCancellationRequest request) {
    return adapters.cancelTerminalActivation(CANCEL_TERMINAL_ACTIVATION_DESCRIPTOR, context, request);
  }
}
