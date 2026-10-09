package com.catering.v2s.generated.operationbindings.terminalupdaterule;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for TERMINAL_UPDATE_RULE. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class TERMINALUPDATERULEOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.TerminalUpdateRuleDetail changeOperationsProjectTerminalUpdateRuleStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TerminalUpdateRuleStatusRequest request);
    OperationBindingTypes.Wire.TerminalUpdateRuleDetail createOperationsProjectTerminalUpdateRule(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TerminalUpdateRuleCreateRequest request);
    OperationBindingTypes.Wire.TerminalUpdateReportHistoryPage getOperationsProjectTerminalUpdateReportHistoryPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.TerminalUpdateReportHistoryQuery request);
    OperationBindingTypes.Wire.TerminalUpdateRuleDetail getOperationsProjectTerminalUpdateRuleDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateRulePage getOperationsProjectTerminalUpdateRulePage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.TerminalUpdateRulePageQuery request);
    OperationBindingTypes.Wire.TerminalUpdateRuleStorePage getOperationsProjectTerminalUpdateRuleStorePage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateVersionDetail getOperationsProjectTerminalVersionDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateVersionPage getOperationsProjectTerminalVersionPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.TerminalUpdateVersionPageQuery request);
    OperationBindingTypes.Wire.TerminalUpdateDownloadGrantResult issueTerminalUpdateArtifactDownloadGrant(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialCommandContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TerminalUpdateRuleSnapshotPage terminalReadProjectUpdateRuleSnapshotPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialReadContext context, OperationBindingTypes.Wire.TerminalUpdateRuleSnapshotQuery request);
  }

  private final OwnerLocalAdapters adapters;

  public TERMINALUPDATERULEOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CHANGE_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("changeOperationsProjectTerminalUpdateRuleStatus", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsProjectTerminalUpdateRule", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_REPORT_HISTORY_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectTerminalUpdateReportHistoryPage", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectTerminalUpdateRuleDetail", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectTerminalUpdateRulePage", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_STORE_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectTerminalUpdateRuleStorePage", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_TERMINAL_VERSION_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectTerminalVersionDetail", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_PROJECT_TERMINAL_VERSION_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsProjectTerminalVersionPage", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor ISSUE_TERMINAL_UPDATE_ARTIFACT_DOWNLOAD_GRANT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("issueTerminalUpdateArtifactDownloadGrant", "TERMINAL_UPDATE_RULE", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TERMINAL_READ_PROJECT_UPDATE_RULE_SNAPSHOT_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("terminalReadProjectUpdateRuleSnapshotPage", "TERMINAL_UPDATE_RULE", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsProjectTerminalUpdateReportHistoryPage" -> { if (descriptor != GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_REPORT_HISTORY_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsProjectTerminalUpdateRuleDetail" -> { if (descriptor != GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_DETAIL_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsProjectTerminalUpdateRulePage" -> { if (descriptor != GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsProjectTerminalUpdateRuleStorePage" -> { if (descriptor != GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_STORE_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsProjectTerminalVersionDetail" -> { if (descriptor != GET_OPERATIONS_PROJECT_TERMINAL_VERSION_DETAIL_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsProjectTerminalVersionPage" -> { if (descriptor != GET_OPERATIONS_PROJECT_TERMINAL_VERSION_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  private static void requireTerminalCredentialReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "terminalReadProjectUpdateRuleSnapshotPage" -> { if (descriptor != TERMINAL_READ_PROJECT_UPDATE_RULE_SNAPSHOT_PAGE_DESCRIPTOR || !"TERMINAL_UPDATE_RULE".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsProjectTerminalUpdateReportHistoryPage" -> adapters.getOperationsProjectTerminalUpdateReportHistoryPage(GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_REPORT_HISTORY_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalUpdateReportHistoryQuery) request);
      case "getOperationsProjectTerminalUpdateRuleDetail" -> adapters.getOperationsProjectTerminalUpdateRuleDetail(GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsProjectTerminalUpdateRulePage" -> adapters.getOperationsProjectTerminalUpdateRulePage(GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalUpdateRulePageQuery) request);
      case "getOperationsProjectTerminalUpdateRuleStorePage" -> adapters.getOperationsProjectTerminalUpdateRuleStorePage(GET_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_STORE_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsProjectTerminalVersionDetail" -> adapters.getOperationsProjectTerminalVersionDetail(GET_OPERATIONS_PROJECT_TERMINAL_VERSION_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsProjectTerminalVersionPage" -> adapters.getOperationsProjectTerminalVersionPage(GET_OPERATIONS_PROJECT_TERMINAL_VERSION_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalUpdateVersionPageQuery) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }

  /** Edge-authenticated terminal reads receive verified, secret-free binding facts. */
  public Object invokeTerminalCredentialRead(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialReadContext context, Object request) {
    requireTerminalCredentialReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "terminalReadProjectUpdateRuleSnapshotPage" -> adapters.terminalReadProjectUpdateRuleSnapshotPage(TERMINAL_READ_PROJECT_UPDATE_RULE_SNAPSHOT_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.TerminalUpdateRuleSnapshotQuery) request);
      default -> throw new IllegalArgumentException("Unsupported terminal credential read: " + descriptor.operationId());
    };
  }

  public OperationBindingTypes.Wire.TerminalUpdateRuleDetail changeOperationsProjectTerminalUpdateRuleStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TerminalUpdateRuleStatusRequest request) {
    return adapters.changeOperationsProjectTerminalUpdateRuleStatus(CHANGE_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.TerminalUpdateRuleDetail createOperationsProjectTerminalUpdateRule(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TerminalUpdateRuleCreateRequest request) {
    return adapters.createOperationsProjectTerminalUpdateRule(CREATE_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.TerminalUpdateDownloadGrantResult issueTerminalUpdateArtifactDownloadGrant(OperationBindingTypes.TerminalCredentialCommandContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.issueTerminalUpdateArtifactDownloadGrant(ISSUE_TERMINAL_UPDATE_ARTIFACT_DOWNLOAD_GRANT_DESCRIPTOR, context, request);
  }
}
