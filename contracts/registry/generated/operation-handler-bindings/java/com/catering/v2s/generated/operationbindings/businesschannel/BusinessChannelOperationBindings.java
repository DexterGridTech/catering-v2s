package com.catering.v2s.generated.operationbindings.businesschannel;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for business-channel. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class BusinessChannelOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.BusinessChannelView createOperationsBusinessChannel(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelCreateRequest request);
    OperationBindingTypes.Wire.BusinessChannelTemplateView createOperationsBusinessChannelTemplate(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelTemplateCreateRequest request);
    OperationBindingTypes.Wire.BusinessChannelView getOperationsBusinessChannelDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.BusinessChannelTemplatePage getOperationsBusinessChannelTemplates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.BusinessChannelPage getOperationsProjectBusinessChannels(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.BusinessChannelPage getOperationsStoreBusinessChannels(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.BusinessChannelTemplatePage getOperationsStoreBusinessChannelTemplateCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.BusinessChannelView transitionOperationsBusinessChannelStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelStatusRequest request);
    OperationBindingTypes.Wire.BusinessChannelTemplateView transitionOperationsBusinessChannelTemplateStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelTemplateStatusRequest request);
    OperationBindingTypes.Wire.BusinessChannelView updateOperationsBusinessChannel(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelUpdateRequest request);
    OperationBindingTypes.Wire.BusinessChannelTemplateView updateOperationsBusinessChannelTemplate(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelTemplateUpdateRequest request);
    OperationBindingTypes.Wire.BusinessChannelTemplateVisibleStorePage getOperationsBusinessChannelTemplateVisibleStores(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.StoreQrChannelCandidatePage getOperationsStoreQrChannelCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
  }

  private final OwnerLocalAdapters adapters;

  public BusinessChannelOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_BUSINESS_CHANNEL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsBusinessChannel", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsBusinessChannelTemplate", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_BUSINESS_CHANNEL_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsBusinessChannelDetail", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_BUSINESS_CHANNEL_TEMPLATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsBusinessChannelTemplates", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_BUSINESS_CHANNELS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectBusinessChannels", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_BUSINESS_CHANNELS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreBusinessChannels", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_BUSINESS_CHANNEL_TEMPLATE_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreBusinessChannelTemplateCandidates", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsBusinessChannelStatus", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsBusinessChannelTemplateStatus", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_BUSINESS_CHANNEL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsBusinessChannel", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsBusinessChannelTemplate", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_VISIBLE_STORES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsBusinessChannelTemplateVisibleStores", "business-channel", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_QR_CHANNEL_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreQrChannelCandidates", "business-channel", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsBusinessChannelDetail" -> { if (descriptor != GET_OPERATIONS_BUSINESS_CHANNEL_DETAIL_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsBusinessChannelTemplates" -> { if (descriptor != GET_OPERATIONS_BUSINESS_CHANNEL_TEMPLATES_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsProjectBusinessChannels" -> { if (descriptor != GET_OPERATIONS_PROJECT_BUSINESS_CHANNELS_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreBusinessChannels" -> { if (descriptor != GET_OPERATIONS_STORE_BUSINESS_CHANNELS_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreBusinessChannelTemplateCandidates" -> { if (descriptor != GET_OPERATIONS_STORE_BUSINESS_CHANNEL_TEMPLATE_CANDIDATES_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsBusinessChannelTemplateVisibleStores" -> { if (descriptor != GET_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_VISIBLE_STORES_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreQrChannelCandidates" -> { if (descriptor != GET_OPERATIONS_STORE_QR_CHANNEL_CANDIDATES_DESCRIPTOR || !"business-channel".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsBusinessChannelDetail" -> adapters.getOperationsBusinessChannelDetail(GET_OPERATIONS_BUSINESS_CHANNEL_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsBusinessChannelTemplates" -> adapters.getOperationsBusinessChannelTemplates(GET_OPERATIONS_BUSINESS_CHANNEL_TEMPLATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsProjectBusinessChannels" -> adapters.getOperationsProjectBusinessChannels(GET_OPERATIONS_PROJECT_BUSINESS_CHANNELS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreBusinessChannels" -> adapters.getOperationsStoreBusinessChannels(GET_OPERATIONS_STORE_BUSINESS_CHANNELS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreBusinessChannelTemplateCandidates" -> adapters.getOperationsStoreBusinessChannelTemplateCandidates(GET_OPERATIONS_STORE_BUSINESS_CHANNEL_TEMPLATE_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsBusinessChannelTemplateVisibleStores" -> adapters.getOperationsBusinessChannelTemplateVisibleStores(GET_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_VISIBLE_STORES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreQrChannelCandidates" -> adapters.getOperationsStoreQrChannelCandidates(GET_OPERATIONS_STORE_QR_CHANNEL_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.BusinessChannelView createOperationsBusinessChannel(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelCreateRequest request) {
    return adapters.createOperationsBusinessChannel(CREATE_OPERATIONS_BUSINESS_CHANNEL_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BusinessChannelTemplateView createOperationsBusinessChannelTemplate(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelTemplateCreateRequest request) {
    return adapters.createOperationsBusinessChannelTemplate(CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BusinessChannelView transitionOperationsBusinessChannelStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelStatusRequest request) {
    return adapters.transitionOperationsBusinessChannelStatus(TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BusinessChannelTemplateView transitionOperationsBusinessChannelTemplateStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelTemplateStatusRequest request) {
    return adapters.transitionOperationsBusinessChannelTemplateStatus(TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BusinessChannelView updateOperationsBusinessChannel(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelUpdateRequest request) {
    return adapters.updateOperationsBusinessChannel(UPDATE_OPERATIONS_BUSINESS_CHANNEL_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BusinessChannelTemplateView updateOperationsBusinessChannelTemplate(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessChannelTemplateUpdateRequest request) {
    return adapters.updateOperationsBusinessChannelTemplate(UPDATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_DESCRIPTOR, context, request);
  }
}
