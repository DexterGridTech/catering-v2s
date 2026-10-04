package com.catering.v2s.generated.operationbindings.storecontract;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for store-contract. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class StoreContractOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.TerminalContractRead terminalReadContract(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialReadContext context, OperationBindingTypes.Wire.TerminalContractReadQuery request);
    OperationBindingTypes.Wire.TerminalStoreActiveContractsRead terminalReadStoreActiveContracts(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialReadContext context, OperationBindingTypes.Wire.NoBody request);
  }

  private final OwnerLocalAdapters adapters;

  public StoreContractOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor TERMINAL_READ_CONTRACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("terminalReadContract", "store-contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TERMINAL_READ_STORE_ACTIVE_CONTRACTS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("terminalReadStoreActiveContracts", "store-contract", "edge-face");

  private static void requireTerminalCredentialReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "terminalReadContract" -> { if (descriptor != TERMINAL_READ_CONTRACT_DESCRIPTOR || !"store-contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "terminalReadStoreActiveContracts" -> { if (descriptor != TERMINAL_READ_STORE_ACTIVE_CONTRACTS_DESCRIPTOR || !"store-contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Edge-authenticated terminal reads receive verified, secret-free binding facts. */
  public Object invokeTerminalCredentialRead(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialReadContext context, Object request) {
    requireTerminalCredentialReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "terminalReadContract" -> adapters.terminalReadContract(TERMINAL_READ_CONTRACT_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalContractReadQuery) request);
      case "terminalReadStoreActiveContracts" -> adapters.terminalReadStoreActiveContracts(TERMINAL_READ_STORE_ACTIVE_CONTRACTS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported terminal credential read: " + descriptor.operationId());
    };
  }


}
