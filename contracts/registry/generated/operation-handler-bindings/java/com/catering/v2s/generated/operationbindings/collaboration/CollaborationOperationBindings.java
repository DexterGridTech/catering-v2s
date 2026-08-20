package com.catering.v2s.generated.operationbindings.collaboration;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for collaboration. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class CollaborationOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.OwnerBindingView createOperationsOwnerBinding(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OwnerBindingCreateRequest request);
    OperationBindingTypes.Wire.OwnerBindingView createPlatformOwnerBinding(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.OwnerBindingCreateRequest request);
    OperationBindingTypes.Wire.OwnerBindingView deleteOperationsOwnerBinding(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request);
    OperationBindingTypes.Wire.OwnerBindingView deletePlatformOwnerBinding(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request);
    OperationBindingTypes.Wire.CapabilityDictionary getOperationsExternalCapabilityDictionary(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExternalProviderCandidatePage getOperationsExternalProviderCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OwnerBindingView getOperationsOwnerBindingDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.CapabilityDictionary getPlatformExternalCapabilityDictionary(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExternalCollaborationTree getPlatformExternalCollaborationTree(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExternalSystemView getPlatformExternalSystemDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OwnerBindingView getPlatformOwnerBindingDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OwnerBindingPage getPlatformProviderProfileBindings(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ProviderProfileView getPlatformProviderProfileDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExternalSystemView transitionPlatformExternalSystemStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.ExternalSystemStatusRequest request);
    OperationBindingTypes.Wire.ProviderProfileView transitionPlatformProviderProfileStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.ExternalSystemStatusRequest request);
    OperationBindingTypes.Wire.OwnerBindingView updateOperationsOwnerBinding(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request);
    OperationBindingTypes.Wire.OwnerBindingView updatePlatformOwnerBinding(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public CollaborationOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_OWNER_BINDING_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOwnerBinding", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_PLATFORM_OWNER_BINDING_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createPlatformOwnerBinding", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor DELETE_OPERATIONS_OWNER_BINDING_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("deleteOperationsOwnerBinding", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor DELETE_PLATFORM_OWNER_BINDING_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("deletePlatformOwnerBinding", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_EXTERNAL_CAPABILITY_DICTIONARY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsExternalCapabilityDictionary", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_EXTERNAL_PROVIDER_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsExternalProviderCandidates", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_OWNER_BINDING_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOwnerBindingDetail", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_EXTERNAL_CAPABILITY_DICTIONARY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformExternalCapabilityDictionary", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_EXTERNAL_COLLABORATION_TREE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformExternalCollaborationTree", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_EXTERNAL_SYSTEM_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformExternalSystemDetail", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_OWNER_BINDING_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformOwnerBindingDetail", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_PROVIDER_PROFILE_BINDINGS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformProviderProfileBindings", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_PROVIDER_PROFILE_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformProviderProfileDetail", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_PLATFORM_EXTERNAL_SYSTEM_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionPlatformExternalSystemStatus", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_PLATFORM_PROVIDER_PROFILE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionPlatformProviderProfileStatus", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_OWNER_BINDING_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsOwnerBinding", "collaboration", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_PLATFORM_OWNER_BINDING_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updatePlatformOwnerBinding", "collaboration", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsExternalCapabilityDictionary" -> { if (descriptor != GET_OPERATIONS_EXTERNAL_CAPABILITY_DICTIONARY_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsExternalProviderCandidates" -> { if (descriptor != GET_OPERATIONS_EXTERNAL_PROVIDER_CANDIDATES_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOwnerBindingDetail" -> { if (descriptor != GET_OPERATIONS_OWNER_BINDING_DETAIL_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformExternalCapabilityDictionary" -> { if (descriptor != GET_PLATFORM_EXTERNAL_CAPABILITY_DICTIONARY_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformExternalCollaborationTree" -> { if (descriptor != GET_PLATFORM_EXTERNAL_COLLABORATION_TREE_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformExternalSystemDetail" -> { if (descriptor != GET_PLATFORM_EXTERNAL_SYSTEM_DETAIL_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformOwnerBindingDetail" -> { if (descriptor != GET_PLATFORM_OWNER_BINDING_DETAIL_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformProviderProfileBindings" -> { if (descriptor != GET_PLATFORM_PROVIDER_PROFILE_BINDINGS_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformProviderProfileDetail" -> { if (descriptor != GET_PLATFORM_PROVIDER_PROFILE_DETAIL_DESCRIPTOR || !"collaboration".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsExternalCapabilityDictionary" -> adapters.getOperationsExternalCapabilityDictionary(GET_OPERATIONS_EXTERNAL_CAPABILITY_DICTIONARY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsExternalProviderCandidates" -> adapters.getOperationsExternalProviderCandidates(GET_OPERATIONS_EXTERNAL_PROVIDER_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOwnerBindingDetail" -> adapters.getOperationsOwnerBindingDetail(GET_OPERATIONS_OWNER_BINDING_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformExternalCapabilityDictionary" -> adapters.getPlatformExternalCapabilityDictionary(GET_PLATFORM_EXTERNAL_CAPABILITY_DICTIONARY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformExternalCollaborationTree" -> adapters.getPlatformExternalCollaborationTree(GET_PLATFORM_EXTERNAL_COLLABORATION_TREE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformExternalSystemDetail" -> adapters.getPlatformExternalSystemDetail(GET_PLATFORM_EXTERNAL_SYSTEM_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformOwnerBindingDetail" -> adapters.getPlatformOwnerBindingDetail(GET_PLATFORM_OWNER_BINDING_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformProviderProfileBindings" -> adapters.getPlatformProviderProfileBindings(GET_PLATFORM_PROVIDER_PROFILE_BINDINGS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformProviderProfileDetail" -> adapters.getPlatformProviderProfileDetail(GET_PLATFORM_PROVIDER_PROFILE_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.OwnerBindingView createOperationsOwnerBinding(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OwnerBindingCreateRequest request) {
    return adapters.createOperationsOwnerBinding(CREATE_OPERATIONS_OWNER_BINDING_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OwnerBindingView createPlatformOwnerBinding(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.OwnerBindingCreateRequest request) {
    return adapters.createPlatformOwnerBinding(CREATE_PLATFORM_OWNER_BINDING_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OwnerBindingView deleteOperationsOwnerBinding(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request) {
    return adapters.deleteOperationsOwnerBinding(DELETE_OPERATIONS_OWNER_BINDING_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OwnerBindingView deletePlatformOwnerBinding(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request) {
    return adapters.deletePlatformOwnerBinding(DELETE_PLATFORM_OWNER_BINDING_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.ExternalSystemView transitionPlatformExternalSystemStatus(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.ExternalSystemStatusRequest request) {
    return adapters.transitionPlatformExternalSystemStatus(TRANSITION_PLATFORM_EXTERNAL_SYSTEM_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.ProviderProfileView transitionPlatformProviderProfileStatus(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.ExternalSystemStatusRequest request) {
    return adapters.transitionPlatformProviderProfileStatus(TRANSITION_PLATFORM_PROVIDER_PROFILE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OwnerBindingView updateOperationsOwnerBinding(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request) {
    return adapters.updateOperationsOwnerBinding(UPDATE_OPERATIONS_OWNER_BINDING_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OwnerBindingView updatePlatformOwnerBinding(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.OwnerBindingUpdateRequest request) {
    return adapters.updatePlatformOwnerBinding(UPDATE_PLATFORM_OWNER_BINDING_DESCRIPTOR, context, request);
  }
}
