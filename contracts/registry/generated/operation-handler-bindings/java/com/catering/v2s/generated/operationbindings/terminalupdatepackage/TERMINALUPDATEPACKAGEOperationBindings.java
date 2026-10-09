package com.catering.v2s.generated.operationbindings.terminalupdatepackage;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for TERMINAL_UPDATE_PACKAGE. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class TERMINALUPDATEPACKAGEOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.TerminalUpdateBinaryContent downloadTerminalUpdateArtifact(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateArtifactCandidatePage getOperationsTerminalUpdateArtifactCandidatePage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.TerminalUpdateArtifactCandidateQuery request);
    OperationBindingTypes.Wire.TerminalUpdateArtifactDetail getPlatformTerminalUpdateArtifactDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateArtifactPage getPlatformTerminalUpdateArtifactPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.TerminalUpdateArtifactPageQuery request);
    OperationBindingTypes.Wire.TerminalUpdateArtifactDetail registerPlatformTerminalUpdateArtifact(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.TerminalUpdateArtifactRegisterRequest request);
    OperationBindingTypes.Wire.NoContent releasePlatformTerminalUpdateArtifactStage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateStageResult stagePlatformTerminalUpdateArtifact(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.TerminalUpdateArtifactStageRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public TERMINALUPDATEPACKAGEOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor DOWNLOAD_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("downloadTerminalUpdateArtifact", "TERMINAL_UPDATE_PACKAGE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_TERMINAL_UPDATE_ARTIFACT_CANDIDATE_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsTerminalUpdateArtifactCandidatePage", "TERMINAL_UPDATE_PACKAGE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformTerminalUpdateArtifactDetail", "TERMINAL_UPDATE_PACKAGE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_TERMINAL_UPDATE_ARTIFACT_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformTerminalUpdateArtifactPage", "TERMINAL_UPDATE_PACKAGE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REGISTER_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("registerPlatformTerminalUpdateArtifact", "TERMINAL_UPDATE_PACKAGE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RELEASE_PLATFORM_TERMINAL_UPDATE_ARTIFACT_STAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("releasePlatformTerminalUpdateArtifactStage", "TERMINAL_UPDATE_PACKAGE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor STAGE_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("stagePlatformTerminalUpdateArtifact", "TERMINAL_UPDATE_PACKAGE", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "downloadTerminalUpdateArtifact" -> { if (descriptor != DOWNLOAD_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR || !"TERMINAL_UPDATE_PACKAGE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsTerminalUpdateArtifactCandidatePage" -> { if (descriptor != GET_OPERATIONS_TERMINAL_UPDATE_ARTIFACT_CANDIDATE_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_PACKAGE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformTerminalUpdateArtifactDetail" -> { if (descriptor != GET_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DETAIL_DESCRIPTOR || !"TERMINAL_UPDATE_PACKAGE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformTerminalUpdateArtifactPage" -> { if (descriptor != GET_PLATFORM_TERMINAL_UPDATE_ARTIFACT_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_PACKAGE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "downloadTerminalUpdateArtifact" -> adapters.downloadTerminalUpdateArtifact(DOWNLOAD_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsTerminalUpdateArtifactCandidatePage" -> adapters.getOperationsTerminalUpdateArtifactCandidatePage(GET_OPERATIONS_TERMINAL_UPDATE_ARTIFACT_CANDIDATE_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalUpdateArtifactCandidateQuery) request);
      case "getPlatformTerminalUpdateArtifactDetail" -> adapters.getPlatformTerminalUpdateArtifactDetail(GET_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformTerminalUpdateArtifactPage" -> adapters.getPlatformTerminalUpdateArtifactPage(GET_PLATFORM_TERMINAL_UPDATE_ARTIFACT_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalUpdateArtifactPageQuery) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }

  public OperationBindingTypes.Wire.TerminalUpdateArtifactDetail registerPlatformTerminalUpdateArtifact(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.TerminalUpdateArtifactRegisterRequest request) {
    return adapters.registerPlatformTerminalUpdateArtifact(REGISTER_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.NoContent releasePlatformTerminalUpdateArtifactStage(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.releasePlatformTerminalUpdateArtifactStage(RELEASE_PLATFORM_TERMINAL_UPDATE_ARTIFACT_STAGE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.TerminalUpdateStageResult stagePlatformTerminalUpdateArtifact(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.TerminalUpdateArtifactStageRequest request) {
    return adapters.stagePlatformTerminalUpdateArtifact(STAGE_PLATFORM_TERMINAL_UPDATE_ARTIFACT_DESCRIPTOR, context, request);
  }
}
