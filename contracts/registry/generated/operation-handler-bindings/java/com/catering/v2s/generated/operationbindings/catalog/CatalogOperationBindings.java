package com.catering.v2s.generated.operationbindings.catalog;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for catalog. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class CatalogOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.CatalogWorkbenchContext getOperationsCatalogWorkbenchContext(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.CatalogContextQuery request);
    OperationBindingTypes.Wire.CatalogNavigationView getOperationsCatalogNavigation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.CatalogNavigationQuery request);
    OperationBindingTypes.Wire.CatalogItemPage getOperationsCatalogItems(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.CatalogItemPageQuery request);
    OperationBindingTypes.Wire.CatalogItemDetail getOperationsCatalogItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.CatalogItemDetailQuery request);
    OperationBindingTypes.Wire.CatalogItemCommandReadback createOperationsCatalogItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemCreateRequest request);
    OperationBindingTypes.Wire.CatalogItemSaveReadback saveOperationsCatalogItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemSaveRequest request);
    OperationBindingTypes.Wire.CatalogItemCommandReadback transitionOperationsCatalogItemStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemTransitionRequest request);
    OperationBindingTypes.Wire.CatalogItemBatchStatusTransitionReadback batchTransitionOperationsCatalogItemStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemBatchStatusTransitionRequest request);
    OperationBindingTypes.Wire.CatalogCategoryReadback createOperationsCatalogCategory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryCreateRequest request);
    OperationBindingTypes.Wire.CatalogCategoryReadback updateOperationsCatalogCategory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryUpdateRequest request);
    OperationBindingTypes.Wire.CatalogCategoryReadback moveOperationsCatalogCategory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryMoveRequest request);
    OperationBindingTypes.Wire.CatalogCategoryDeleteReadback deleteOperationsCatalogCategory(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryDeleteRequest request);
    OperationBindingTypes.Wire.CatalogDictionaryView getOperationsCatalogDictionary(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.CatalogDictionaryQuery request);
    OperationBindingTypes.Wire.CatalogDictionaryEntryReadback createOperationsCatalogDictionaryEntry(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryCreateRequest request);
    OperationBindingTypes.Wire.CatalogDictionaryEntryReadback updateOperationsCatalogDictionaryEntry(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryUpdateRequest request);
    OperationBindingTypes.Wire.CatalogDictionaryView reorderOperationsCatalogDictionaryEntry(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryReorderRequest request);
    OperationBindingTypes.Wire.CatalogDictionaryEntryReadback transitionOperationsCatalogDictionaryEntryStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryTransitionRequest request);
    OperationBindingTypes.Wire.LocalCopyCandidatePage getOperationsLocalCatalogCopyCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.LocalCopyCandidateQuery request);
    OperationBindingTypes.Wire.LocalCopyPreflight preflightOperationsLocalCatalogCopy(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.LocalCopyPreflightRequest request);
    OperationBindingTypes.Wire.LocalCopyReadback executeOperationsLocalCatalogCopy(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.LocalCopyExecuteRequest request);
    OperationBindingTypes.Wire.TemporaryPromotionPreflight preflightOperationsTemporaryCatalogItemPromotion(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TemporaryPromotionPreflightRequest request);
    OperationBindingTypes.Wire.CatalogItemCommandReadback executeOperationsTemporaryCatalogItemPromotion(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TemporaryPromotionExecuteRequest request);
    OperationBindingTypes.Wire.BrandCopyCandidatePage getOperationsBrandCatalogCopyCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.BrandCopyCandidateQuery request);
    OperationBindingTypes.Wire.BrandCatalogCopyPreflight preflightOperationsBrandCatalogCopy(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandCopyPreflightRequest request);
    OperationBindingTypes.Wire.BrandCatalogCopyReadback executeOperationsBrandCatalogCopy(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandCopyExecuteRequest request);
    OperationBindingTypes.Wire.CatalogShapeManifestView getOperationsCatalogShapeManifest(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.CatalogShapeManifestQuery request);
  }

  private final OwnerLocalAdapters adapters;

  public CatalogOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CATALOG_WORKBENCH_CONTEXT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsCatalogWorkbenchContext", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CATALOG_NAVIGATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsCatalogNavigation", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CATALOG_ITEMS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsCatalogItems", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CATALOG_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsCatalogItem", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_CATALOG_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsCatalogItem", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor SAVE_OPERATIONS_CATALOG_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("saveOperationsCatalogItem", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsCatalogItemStatus", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("batchTransitionOperationsCatalogItemStatus", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsCatalogCategory", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsCatalogCategory", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor MOVE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("moveOperationsCatalogCategory", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor DELETE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("deleteOperationsCatalogCategory", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CATALOG_DICTIONARY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsCatalogDictionary", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsCatalogDictionaryEntry", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsCatalogDictionaryEntry", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reorderOperationsCatalogDictionaryEntry", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsCatalogDictionaryEntryStatus", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_LOCAL_CATALOG_COPY_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsLocalCatalogCopyCandidates", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("preflightOperationsLocalCatalogCopy", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("executeOperationsLocalCatalogCopy", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("preflightOperationsTemporaryCatalogItemPromotion", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("executeOperationsTemporaryCatalogItemPromotion", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_BRAND_CATALOG_COPY_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsBrandCatalogCopyCandidates", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("preflightOperationsBrandCatalogCopy", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor EXECUTE_OPERATIONS_BRAND_CATALOG_COPY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("executeOperationsBrandCatalogCopy", "catalog", "catalog-inventory");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_CATALOG_SHAPE_MANIFEST_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsCatalogShapeManifest", "catalog", "catalog-inventory");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsCatalogWorkbenchContext" -> { if (descriptor != GET_OPERATIONS_CATALOG_WORKBENCH_CONTEXT_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsCatalogNavigation" -> { if (descriptor != GET_OPERATIONS_CATALOG_NAVIGATION_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsCatalogItems" -> { if (descriptor != GET_OPERATIONS_CATALOG_ITEMS_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsCatalogItem" -> { if (descriptor != GET_OPERATIONS_CATALOG_ITEM_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsCatalogDictionary" -> { if (descriptor != GET_OPERATIONS_CATALOG_DICTIONARY_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsLocalCatalogCopyCandidates" -> { if (descriptor != GET_OPERATIONS_LOCAL_CATALOG_COPY_CANDIDATES_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsBrandCatalogCopyCandidates" -> { if (descriptor != GET_OPERATIONS_BRAND_CATALOG_COPY_CANDIDATES_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsCatalogShapeManifest" -> { if (descriptor != GET_OPERATIONS_CATALOG_SHAPE_MANIFEST_DESCRIPTOR || !"catalog".equals(descriptor.owner()) || !"catalog-inventory".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsCatalogWorkbenchContext" -> adapters.getOperationsCatalogWorkbenchContext(GET_OPERATIONS_CATALOG_WORKBENCH_CONTEXT_DESCRIPTOR, context, (OperationBindingTypes.Wire.CatalogContextQuery) request);
      case "getOperationsCatalogNavigation" -> adapters.getOperationsCatalogNavigation(GET_OPERATIONS_CATALOG_NAVIGATION_DESCRIPTOR, context, (OperationBindingTypes.Wire.CatalogNavigationQuery) request);
      case "getOperationsCatalogItems" -> adapters.getOperationsCatalogItems(GET_OPERATIONS_CATALOG_ITEMS_DESCRIPTOR, context, (OperationBindingTypes.Wire.CatalogItemPageQuery) request);
      case "getOperationsCatalogItem" -> adapters.getOperationsCatalogItem(GET_OPERATIONS_CATALOG_ITEM_DESCRIPTOR, context, (OperationBindingTypes.Wire.CatalogItemDetailQuery) request);
      case "getOperationsCatalogDictionary" -> adapters.getOperationsCatalogDictionary(GET_OPERATIONS_CATALOG_DICTIONARY_DESCRIPTOR, context, (OperationBindingTypes.Wire.CatalogDictionaryQuery) request);
      case "getOperationsLocalCatalogCopyCandidates" -> adapters.getOperationsLocalCatalogCopyCandidates(GET_OPERATIONS_LOCAL_CATALOG_COPY_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.LocalCopyCandidateQuery) request);
      case "getOperationsBrandCatalogCopyCandidates" -> adapters.getOperationsBrandCatalogCopyCandidates(GET_OPERATIONS_BRAND_CATALOG_COPY_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.BrandCopyCandidateQuery) request);
      case "getOperationsCatalogShapeManifest" -> adapters.getOperationsCatalogShapeManifest(GET_OPERATIONS_CATALOG_SHAPE_MANIFEST_DESCRIPTOR, context, (OperationBindingTypes.Wire.CatalogShapeManifestQuery) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.CatalogItemCommandReadback createOperationsCatalogItem(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemCreateRequest request) {
    return adapters.createOperationsCatalogItem(CREATE_OPERATIONS_CATALOG_ITEM_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogItemSaveReadback saveOperationsCatalogItem(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemSaveRequest request) {
    return adapters.saveOperationsCatalogItem(SAVE_OPERATIONS_CATALOG_ITEM_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogItemCommandReadback transitionOperationsCatalogItemStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemTransitionRequest request) {
    return adapters.transitionOperationsCatalogItemStatus(TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogItemBatchStatusTransitionReadback batchTransitionOperationsCatalogItemStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogItemBatchStatusTransitionRequest request) {
    return adapters.batchTransitionOperationsCatalogItemStatus(BATCH_TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogCategoryReadback createOperationsCatalogCategory(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryCreateRequest request) {
    return adapters.createOperationsCatalogCategory(CREATE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogCategoryReadback updateOperationsCatalogCategory(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryUpdateRequest request) {
    return adapters.updateOperationsCatalogCategory(UPDATE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogCategoryReadback moveOperationsCatalogCategory(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryMoveRequest request) {
    return adapters.moveOperationsCatalogCategory(MOVE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogCategoryDeleteReadback deleteOperationsCatalogCategory(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogCategoryDeleteRequest request) {
    return adapters.deleteOperationsCatalogCategory(DELETE_OPERATIONS_CATALOG_CATEGORY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogDictionaryEntryReadback createOperationsCatalogDictionaryEntry(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryCreateRequest request) {
    return adapters.createOperationsCatalogDictionaryEntry(CREATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogDictionaryEntryReadback updateOperationsCatalogDictionaryEntry(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryUpdateRequest request) {
    return adapters.updateOperationsCatalogDictionaryEntry(UPDATE_OPERATIONS_CATALOG_DICTIONARY_ENTRY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogDictionaryView reorderOperationsCatalogDictionaryEntry(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryReorderRequest request) {
    return adapters.reorderOperationsCatalogDictionaryEntry(REORDER_OPERATIONS_CATALOG_DICTIONARY_ENTRY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogDictionaryEntryReadback transitionOperationsCatalogDictionaryEntryStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CatalogDictionaryEntryTransitionRequest request) {
    return adapters.transitionOperationsCatalogDictionaryEntryStatus(TRANSITION_OPERATIONS_CATALOG_DICTIONARY_ENTRY_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.LocalCopyPreflight preflightOperationsLocalCatalogCopy(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.LocalCopyPreflightRequest request) {
    return adapters.preflightOperationsLocalCatalogCopy(PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.LocalCopyReadback executeOperationsLocalCatalogCopy(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.LocalCopyExecuteRequest request) {
    return adapters.executeOperationsLocalCatalogCopy(EXECUTE_OPERATIONS_LOCAL_CATALOG_COPY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.TemporaryPromotionPreflight preflightOperationsTemporaryCatalogItemPromotion(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TemporaryPromotionPreflightRequest request) {
    return adapters.preflightOperationsTemporaryCatalogItemPromotion(PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CatalogItemCommandReadback executeOperationsTemporaryCatalogItemPromotion(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TemporaryPromotionExecuteRequest request) {
    return adapters.executeOperationsTemporaryCatalogItemPromotion(EXECUTE_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BrandCatalogCopyPreflight preflightOperationsBrandCatalogCopy(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandCopyPreflightRequest request) {
    return adapters.preflightOperationsBrandCatalogCopy(PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.BrandCatalogCopyReadback executeOperationsBrandCatalogCopy(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandCopyExecuteRequest request) {
    return adapters.executeOperationsBrandCatalogCopy(EXECUTE_OPERATIONS_BRAND_CATALOG_COPY_DESCRIPTOR, context, request);
  }
}
