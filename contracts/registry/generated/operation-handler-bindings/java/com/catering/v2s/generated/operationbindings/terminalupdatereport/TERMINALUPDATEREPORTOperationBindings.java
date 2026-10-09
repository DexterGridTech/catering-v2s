package com.catering.v2s.generated.operationbindings.terminalupdatereport;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for TERMINAL_UPDATE_REPORT. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class TERMINALUPDATEREPORTOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.TerminalUpdateReportReceipt submitTerminalUpdateReport(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.TerminalCredentialCommandContext context, OperationBindingTypes.Wire.TerminalUpdateReportRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public TERMINALUPDATEREPORTOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor SUBMIT_TERMINAL_UPDATE_REPORT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("submitTerminalUpdateReport", "TERMINAL_UPDATE_REPORT", "edge-face");



  public OperationBindingTypes.Wire.TerminalUpdateReportReceipt submitTerminalUpdateReport(OperationBindingTypes.TerminalCredentialCommandContext context, OperationBindingTypes.Wire.TerminalUpdateReportRequest request) {
    return adapters.submitTerminalUpdateReport(SUBMIT_TERMINAL_UPDATE_REPORT_DESCRIPTOR, context, request);
  }
}
