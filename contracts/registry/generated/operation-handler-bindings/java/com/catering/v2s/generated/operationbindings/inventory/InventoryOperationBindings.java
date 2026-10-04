package com.catering.v2s.generated.operationbindings.inventory;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for inventory. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class InventoryOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.InventoryTargetPage getOperationsInventoryTargets(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryTargetPageQuery request);
    OperationBindingTypes.Wire.InventoryTargetCurrentView getOperationsInventoryTarget(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryTargetQuery request);
    OperationBindingTypes.Wire.InventoryChangeSummaryView getOperationsInventoryTargetChangeSummary(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryTargetPeriodQuery request);
    OperationBindingTypes.Wire.InventoryBusinessHistoryPage getOperationsInventoryTargetBusinessHistory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryHistoryPageQuery request);
    OperationBindingTypes.Wire.InventoryConsumptionReferencePage getOperationsInventoryTargetConsumptionReferences(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryReferencePageQuery request);
    OperationBindingTypes.Wire.InventoryLedgerPage getOperationsInventoryTargetLedger(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryLedgerPageQuery request);
    OperationBindingTypes.Wire.InventoryDiagnosticsView getOperationsInventoryTargetDiagnostics(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryDiagnosticsQuery request);
    OperationBindingTypes.Wire.InventoryWriteReadback countOperationsInventoryTarget(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryCountRequest request);
    OperationBindingTypes.Wire.InventoryWriteReadback increaseOperationsInventoryTarget(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryIncreaseRequest request);
    OperationBindingTypes.Wire.InventoryWriteReadback adjustOperationsInventoryTarget(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryAdjustmentRequest request);
    OperationBindingTypes.Wire.InventoryTargetCurrentView updateOperationsInventoryTargetConfiguration(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryTargetConfigurationRequest request);
    OperationBindingTypes.Wire.InventoryConsumptionTargetCandidatePage getOperationsInventoryConsumptionTargetCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.InventoryConsumptionTargetCandidateQuery request);
  }

  private final OwnerLocalAdapters adapters;

  public InventoryOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGETS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTargets", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTarget", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGET_CHANGE_SUMMARY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTargetChangeSummary", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGET_BUSINESS_HISTORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTargetBusinessHistory", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGET_CONSUMPTION_REFERENCES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTargetConsumptionReferences", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGET_LEDGER_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTargetLedger", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_TARGET_DIAGNOSTICS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryTargetDiagnostics", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor COUNT_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("countOperationsInventoryTarget", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor INCREASE_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("increaseOperationsInventoryTarget", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor ADJUST_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("adjustOperationsInventoryTarget", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsInventoryTargetConfiguration", "inventory", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_INVENTORY_CONSUMPTION_TARGET_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsInventoryConsumptionTargetCandidates", "inventory", "catalog-inventory");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsInventoryTargets" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGETS_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryTarget" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryTargetChangeSummary" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGET_CHANGE_SUMMARY_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryTargetBusinessHistory" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGET_BUSINESS_HISTORY_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryTargetConsumptionReferences" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGET_CONSUMPTION_REFERENCES_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryTargetLedger" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGET_LEDGER_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryTargetDiagnostics" -> { if (descriptor != GET_OPERATIONS_INVENTORY_TARGET_DIAGNOSTICS_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsInventoryConsumptionTargetCandidates" -> { if (descriptor != GET_OPERATIONS_INVENTORY_CONSUMPTION_TARGET_CANDIDATES_DESCRIPTOR || !"inventory".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsInventoryTargets" -> adapters.getOperationsInventoryTargets(GET_OPERATIONS_INVENTORY_TARGETS_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryTargetPageQuery) request);
      case "getOperationsInventoryTarget" -> adapters.getOperationsInventoryTarget(GET_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryTargetQuery) request);
      case "getOperationsInventoryTargetChangeSummary" -> adapters.getOperationsInventoryTargetChangeSummary(GET_OPERATIONS_INVENTORY_TARGET_CHANGE_SUMMARY_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryTargetPeriodQuery) request);
      case "getOperationsInventoryTargetBusinessHistory" -> adapters.getOperationsInventoryTargetBusinessHistory(GET_OPERATIONS_INVENTORY_TARGET_BUSINESS_HISTORY_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryHistoryPageQuery) request);
      case "getOperationsInventoryTargetConsumptionReferences" -> adapters.getOperationsInventoryTargetConsumptionReferences(GET_OPERATIONS_INVENTORY_TARGET_CONSUMPTION_REFERENCES_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryReferencePageQuery) request);
      case "getOperationsInventoryTargetLedger" -> adapters.getOperationsInventoryTargetLedger(GET_OPERATIONS_INVENTORY_TARGET_LEDGER_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryLedgerPageQuery) request);
      case "getOperationsInventoryTargetDiagnostics" -> adapters.getOperationsInventoryTargetDiagnostics(GET_OPERATIONS_INVENTORY_TARGET_DIAGNOSTICS_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryDiagnosticsQuery) request);
      case "getOperationsInventoryConsumptionTargetCandidates" -> adapters.getOperationsInventoryConsumptionTargetCandidates(GET_OPERATIONS_INVENTORY_CONSUMPTION_TARGET_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.InventoryConsumptionTargetCandidateQuery) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }

  public OperationBindingTypes.Wire.InventoryWriteReadback countOperationsInventoryTarget(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryCountRequest request) {
    return adapters.countOperationsInventoryTarget(COUNT_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.InventoryWriteReadback increaseOperationsInventoryTarget(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryIncreaseRequest request) {
    return adapters.increaseOperationsInventoryTarget(INCREASE_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.InventoryWriteReadback adjustOperationsInventoryTarget(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryAdjustmentRequest request) {
    return adapters.adjustOperationsInventoryTarget(ADJUST_OPERATIONS_INVENTORY_TARGET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.InventoryTargetCurrentView updateOperationsInventoryTargetConfiguration(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.InventoryTargetConfigurationRequest request) {
    return adapters.updateOperationsInventoryTargetConfiguration(UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION_DESCRIPTOR, context, request);
  }
}
