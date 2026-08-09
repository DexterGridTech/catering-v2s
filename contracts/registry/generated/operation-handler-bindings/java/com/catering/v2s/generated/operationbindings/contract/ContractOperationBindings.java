package com.catering.v2s.generated.operationbindings.contract;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for contract. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class ContractOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.StoreContract createOperationsContract(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreContractCreateRequest request);
    OperationBindingTypes.Wire.StoreContract getOperationsContract(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreContractCandidatePage getOperationsContractCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExtensionDefinition getOperationsContractExtensionDefinition(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreContractPage getOperationsContracts(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreContractPage getOperationsFixedStoreContracts(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ContractOverviewItem getPlatformContractOverviewDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ContractOverviewPage getPlatformContractOverviewPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreContract invalidateOperationsContract(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreContractInvalidateRequest request);
    OperationBindingTypes.Wire.StoreContract updateOperationsContract(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreContractUpdateRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public ContractOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_CONTRACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsContract", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CONTRACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsContract", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CONTRACT_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsContractCandidates", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CONTRACT_EXTENSION_DEFINITION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsContractExtensionDefinition", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CONTRACTS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsContracts", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_FIXED_STORE_CONTRACTS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsFixedStoreContracts", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_CONTRACT_OVERVIEW_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformContractOverviewDetail", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_CONTRACT_OVERVIEW_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformContractOverviewPage", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor INVALIDATE_OPERATIONS_CONTRACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("invalidateOperationsContract", "contract", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_CONTRACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsContract", "contract", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsContract" -> { if (descriptor != GET_OPERATIONS_CONTRACT_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsContractCandidates" -> { if (descriptor != GET_OPERATIONS_CONTRACT_CANDIDATES_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsContractExtensionDefinition" -> { if (descriptor != GET_OPERATIONS_CONTRACT_EXTENSION_DEFINITION_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsContracts" -> { if (descriptor != GET_OPERATIONS_CONTRACTS_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsFixedStoreContracts" -> { if (descriptor != GET_OPERATIONS_FIXED_STORE_CONTRACTS_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformContractOverviewDetail" -> { if (descriptor != GET_PLATFORM_CONTRACT_OVERVIEW_DETAIL_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformContractOverviewPage" -> { if (descriptor != GET_PLATFORM_CONTRACT_OVERVIEW_PAGE_DESCRIPTOR || !"contract".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsContract" -> adapters.getOperationsContract(GET_OPERATIONS_CONTRACT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsContractCandidates" -> adapters.getOperationsContractCandidates(GET_OPERATIONS_CONTRACT_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsContractExtensionDefinition" -> adapters.getOperationsContractExtensionDefinition(GET_OPERATIONS_CONTRACT_EXTENSION_DEFINITION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsContracts" -> adapters.getOperationsContracts(GET_OPERATIONS_CONTRACTS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsFixedStoreContracts" -> adapters.getOperationsFixedStoreContracts(GET_OPERATIONS_FIXED_STORE_CONTRACTS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformContractOverviewDetail" -> adapters.getPlatformContractOverviewDetail(GET_PLATFORM_CONTRACT_OVERVIEW_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformContractOverviewPage" -> adapters.getPlatformContractOverviewPage(GET_PLATFORM_CONTRACT_OVERVIEW_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.StoreContract createOperationsContract(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreContractCreateRequest request) {
    return adapters.createOperationsContract(CREATE_OPERATIONS_CONTRACT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.StoreContract invalidateOperationsContract(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreContractInvalidateRequest request) {
    return adapters.invalidateOperationsContract(INVALIDATE_OPERATIONS_CONTRACT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.StoreContract updateOperationsContract(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.StoreContractUpdateRequest request) {
    return adapters.updateOperationsContract(UPDATE_OPERATIONS_CONTRACT_DESCRIPTOR, context, request);
  }
}
