package com.catering.v2s.generated.operationbindings.platformworkspace;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for platform-workspace. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class PlatformWorkspaceOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.GroupWorkspaceCreateResult createPlatformGroupWorkspace(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.GroupWorkspaceCreateRequest request);
    OperationBindingTypes.Wire.AuditHistoryPage getOperationsEntityAuditHistory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.AuditHistoryPage getPlatformEntityAuditHistory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.GroupWorkspaceDetail getPlatformGroupWorkspaceDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.GroupWorkspacePage listPlatformGroupWorkspaces(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.GroupWorkspaceDetail transitionPlatformGroupWorkspaceStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.GroupWorkspaceStatusTransitionRequest request);
    OperationBindingTypes.Wire.GroupWorkspaceDetail updatePlatformGroupWorkspaceDisplay(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.GroupWorkspaceDisplayUpdateRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public PlatformWorkspaceOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CREATE_PLATFORM_GROUP_WORKSPACE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createPlatformGroupWorkspace", "platform-workspace", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ENTITY_AUDIT_HISTORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsEntityAuditHistory", "platform-workspace", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ENTITY_AUDIT_HISTORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformEntityAuditHistory", "platform-workspace", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_GROUP_WORKSPACE_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformGroupWorkspaceDetail", "platform-workspace", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor LIST_PLATFORM_GROUP_WORKSPACES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("listPlatformGroupWorkspaces", "platform-workspace", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_PLATFORM_GROUP_WORKSPACE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionPlatformGroupWorkspaceStatus", "platform-workspace", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_PLATFORM_GROUP_WORKSPACE_DISPLAY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updatePlatformGroupWorkspaceDisplay", "platform-workspace", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsEntityAuditHistory" -> { if (descriptor != GET_OPERATIONS_ENTITY_AUDIT_HISTORY_DESCRIPTOR || !"platform-workspace".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformEntityAuditHistory" -> { if (descriptor != GET_PLATFORM_ENTITY_AUDIT_HISTORY_DESCRIPTOR || !"platform-workspace".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformGroupWorkspaceDetail" -> { if (descriptor != GET_PLATFORM_GROUP_WORKSPACE_DETAIL_DESCRIPTOR || !"platform-workspace".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "listPlatformGroupWorkspaces" -> { if (descriptor != LIST_PLATFORM_GROUP_WORKSPACES_DESCRIPTOR || !"platform-workspace".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsEntityAuditHistory" -> adapters.getOperationsEntityAuditHistory(GET_OPERATIONS_ENTITY_AUDIT_HISTORY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformEntityAuditHistory" -> adapters.getPlatformEntityAuditHistory(GET_PLATFORM_ENTITY_AUDIT_HISTORY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformGroupWorkspaceDetail" -> adapters.getPlatformGroupWorkspaceDetail(GET_PLATFORM_GROUP_WORKSPACE_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "listPlatformGroupWorkspaces" -> adapters.listPlatformGroupWorkspaces(LIST_PLATFORM_GROUP_WORKSPACES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }

  public OperationBindingTypes.Wire.GroupWorkspaceCreateResult createPlatformGroupWorkspace(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.GroupWorkspaceCreateRequest request) {
    return adapters.createPlatformGroupWorkspace(CREATE_PLATFORM_GROUP_WORKSPACE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.GroupWorkspaceDetail transitionPlatformGroupWorkspaceStatus(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.GroupWorkspaceStatusTransitionRequest request) {
    return adapters.transitionPlatformGroupWorkspaceStatus(TRANSITION_PLATFORM_GROUP_WORKSPACE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.GroupWorkspaceDetail updatePlatformGroupWorkspaceDisplay(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.GroupWorkspaceDisplayUpdateRequest request) {
    return adapters.updatePlatformGroupWorkspaceDisplay(UPDATE_PLATFORM_GROUP_WORKSPACE_DISPLAY_DESCRIPTOR, context, request);
  }
}
