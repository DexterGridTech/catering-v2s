package com.catering.v2s.generated.operationbindings.salesmenu;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for sales-menu. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class SalesMenuOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.SalesMenuCommandReadback addOperationsSalesMenuItems(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuItemsAddRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback archiveOperationsSalesMenu(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuArchiveRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback copyOperationsSalesMenu(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuCopyRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback createOperationsSalesMenu(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuCreateRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback createOperationsSalesMenuSection(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuSectionCreateRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback deleteOperationsSalesMenuItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuDeleteRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback deleteOperationsSalesMenuSection(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuDeleteRequest request);
    OperationBindingTypes.Wire.SalesMenuDetail getOperationsSalesMenu(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuDraftItemView getOperationsSalesMenuDraftItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuItemPage getOperationsSalesMenuDraftItems(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuSectionList getOperationsSalesMenuDraftSections(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuCandidatePage getOperationsSalesMenuItemCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuOperationRecordPage getOperationsSalesMenuOperationRecords(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuPublicationPreview getOperationsSalesMenuPublicationPreview(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuPublishedItemView getOperationsSalesMenuPublishedItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuPublishedItemPage getOperationsSalesMenuPublishedItems(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuPublishedSectionList getOperationsSalesMenuPublishedSections(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuPage getOperationsSalesMenus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback moveOperationsSalesMenuItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuItemMoveRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback moveOperationsSalesMenuSection(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuSectionMoveRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback publishOperationsSalesMenu(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuPublishRequest request);
    OperationBindingTypes.Wire.SalesMenuAssetReleaseReadback releaseOperationsSalesMenuStagedAsset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuAssetReleaseRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback renameOperationsSalesMenu(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuRenameRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback renameOperationsSalesMenuSection(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuSectionRenameRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback restoreOperationsSalesMenuItemSale(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuManualRestoreRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback setOperationsSalesMenuActivation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuActivationRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback setOperationsSalesMenuItemSoldOut(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuManualSoldOutRequest request);
    OperationBindingTypes.Wire.SalesMenuAssetStageReadback stageOperationsSalesMenuAsset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuAssetStageRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback updateOperationsSalesMenuItem(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuItemUpdateRequest request);
    OperationBindingTypes.Wire.SalesMenuCommandReadback updateOperationsSalesMenuSchedule(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuScheduleUpdateRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public SalesMenuOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor ADD_OPERATIONS_SALES_MENU_ITEMS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("addOperationsSalesMenuItems", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor ARCHIVE_OPERATIONS_SALES_MENU_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("archiveOperationsSalesMenu", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor COPY_OPERATIONS_SALES_MENU_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("copyOperationsSalesMenu", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_SALES_MENU_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsSalesMenu", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsSalesMenuSection", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor DELETE_OPERATIONS_SALES_MENU_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("deleteOperationsSalesMenuItem", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor DELETE_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("deleteOperationsSalesMenuSection", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenu", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_DRAFT_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuDraftItem", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_DRAFT_ITEMS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuDraftItems", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_DRAFT_SECTIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuDraftSections", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_ITEM_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuItemCandidates", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_OPERATION_RECORDS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuOperationRecords", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_PUBLICATION_PREVIEW_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuPublicationPreview", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_PUBLISHED_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuPublishedItem", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_PUBLISHED_ITEMS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuPublishedItems", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenuPublishedSections", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_SALES_MENUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsSalesMenus", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor MOVE_OPERATIONS_SALES_MENU_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("moveOperationsSalesMenuItem", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor MOVE_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("moveOperationsSalesMenuSection", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor PUBLISH_OPERATIONS_SALES_MENU_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("publishOperationsSalesMenu", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RELEASE_OPERATIONS_SALES_MENU_STAGED_ASSET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("releaseOperationsSalesMenuStagedAsset", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RENAME_OPERATIONS_SALES_MENU_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("renameOperationsSalesMenu", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RENAME_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("renameOperationsSalesMenuSection", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RESTORE_OPERATIONS_SALES_MENU_ITEM_SALE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("restoreOperationsSalesMenuItemSale", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SET_OPERATIONS_SALES_MENU_ACTIVATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("setOperationsSalesMenuActivation", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SET_OPERATIONS_SALES_MENU_ITEM_SOLD_OUT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("setOperationsSalesMenuItemSoldOut", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor STAGE_OPERATIONS_SALES_MENU_ASSET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("stageOperationsSalesMenuAsset", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_SALES_MENU_ITEM_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsSalesMenuItem", "sales-menu", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_SALES_MENU_SCHEDULE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsSalesMenuSchedule", "sales-menu", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsSalesMenu" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuDraftItem" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_DRAFT_ITEM_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuDraftItems" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_DRAFT_ITEMS_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuDraftSections" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_DRAFT_SECTIONS_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuItemCandidates" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_ITEM_CANDIDATES_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuOperationRecords" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_OPERATION_RECORDS_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuPublicationPreview" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_PUBLICATION_PREVIEW_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuPublishedItem" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_PUBLISHED_ITEM_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuPublishedItems" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_PUBLISHED_ITEMS_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenuPublishedSections" -> { if (descriptor != GET_OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsSalesMenus" -> { if (descriptor != GET_OPERATIONS_SALES_MENUS_DESCRIPTOR || !"sales-menu".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsSalesMenu" -> adapters.getOperationsSalesMenu(GET_OPERATIONS_SALES_MENU_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuDraftItem" -> adapters.getOperationsSalesMenuDraftItem(GET_OPERATIONS_SALES_MENU_DRAFT_ITEM_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuDraftItems" -> adapters.getOperationsSalesMenuDraftItems(GET_OPERATIONS_SALES_MENU_DRAFT_ITEMS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuDraftSections" -> adapters.getOperationsSalesMenuDraftSections(GET_OPERATIONS_SALES_MENU_DRAFT_SECTIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuItemCandidates" -> adapters.getOperationsSalesMenuItemCandidates(GET_OPERATIONS_SALES_MENU_ITEM_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuOperationRecords" -> adapters.getOperationsSalesMenuOperationRecords(GET_OPERATIONS_SALES_MENU_OPERATION_RECORDS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuPublicationPreview" -> adapters.getOperationsSalesMenuPublicationPreview(GET_OPERATIONS_SALES_MENU_PUBLICATION_PREVIEW_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuPublishedItem" -> adapters.getOperationsSalesMenuPublishedItem(GET_OPERATIONS_SALES_MENU_PUBLISHED_ITEM_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuPublishedItems" -> adapters.getOperationsSalesMenuPublishedItems(GET_OPERATIONS_SALES_MENU_PUBLISHED_ITEMS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenuPublishedSections" -> adapters.getOperationsSalesMenuPublishedSections(GET_OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsSalesMenus" -> adapters.getOperationsSalesMenus(GET_OPERATIONS_SALES_MENUS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.SalesMenuCommandReadback addOperationsSalesMenuItems(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuItemsAddRequest request) {
    return adapters.addOperationsSalesMenuItems(ADD_OPERATIONS_SALES_MENU_ITEMS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback archiveOperationsSalesMenu(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuArchiveRequest request) {
    return adapters.archiveOperationsSalesMenu(ARCHIVE_OPERATIONS_SALES_MENU_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback copyOperationsSalesMenu(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuCopyRequest request) {
    return adapters.copyOperationsSalesMenu(COPY_OPERATIONS_SALES_MENU_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback createOperationsSalesMenu(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuCreateRequest request) {
    return adapters.createOperationsSalesMenu(CREATE_OPERATIONS_SALES_MENU_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback createOperationsSalesMenuSection(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuSectionCreateRequest request) {
    return adapters.createOperationsSalesMenuSection(CREATE_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback deleteOperationsSalesMenuItem(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuDeleteRequest request) {
    return adapters.deleteOperationsSalesMenuItem(DELETE_OPERATIONS_SALES_MENU_ITEM_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback deleteOperationsSalesMenuSection(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuDeleteRequest request) {
    return adapters.deleteOperationsSalesMenuSection(DELETE_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback moveOperationsSalesMenuItem(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuItemMoveRequest request) {
    return adapters.moveOperationsSalesMenuItem(MOVE_OPERATIONS_SALES_MENU_ITEM_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback moveOperationsSalesMenuSection(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuSectionMoveRequest request) {
    return adapters.moveOperationsSalesMenuSection(MOVE_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback publishOperationsSalesMenu(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuPublishRequest request) {
    return adapters.publishOperationsSalesMenu(PUBLISH_OPERATIONS_SALES_MENU_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuAssetReleaseReadback releaseOperationsSalesMenuStagedAsset(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuAssetReleaseRequest request) {
    return adapters.releaseOperationsSalesMenuStagedAsset(RELEASE_OPERATIONS_SALES_MENU_STAGED_ASSET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback renameOperationsSalesMenu(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuRenameRequest request) {
    return adapters.renameOperationsSalesMenu(RENAME_OPERATIONS_SALES_MENU_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback renameOperationsSalesMenuSection(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuSectionRenameRequest request) {
    return adapters.renameOperationsSalesMenuSection(RENAME_OPERATIONS_SALES_MENU_SECTION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback restoreOperationsSalesMenuItemSale(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuManualRestoreRequest request) {
    return adapters.restoreOperationsSalesMenuItemSale(RESTORE_OPERATIONS_SALES_MENU_ITEM_SALE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback setOperationsSalesMenuActivation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuActivationRequest request) {
    return adapters.setOperationsSalesMenuActivation(SET_OPERATIONS_SALES_MENU_ACTIVATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback setOperationsSalesMenuItemSoldOut(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuManualSoldOutRequest request) {
    return adapters.setOperationsSalesMenuItemSoldOut(SET_OPERATIONS_SALES_MENU_ITEM_SOLD_OUT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuAssetStageReadback stageOperationsSalesMenuAsset(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuAssetStageRequest request) {
    return adapters.stageOperationsSalesMenuAsset(STAGE_OPERATIONS_SALES_MENU_ASSET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback updateOperationsSalesMenuItem(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuItemUpdateRequest request) {
    return adapters.updateOperationsSalesMenuItem(UPDATE_OPERATIONS_SALES_MENU_ITEM_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.SalesMenuCommandReadback updateOperationsSalesMenuSchedule(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.SalesMenuScheduleUpdateRequest request) {
    return adapters.updateOperationsSalesMenuSchedule(UPDATE_OPERATIONS_SALES_MENU_SCHEDULE_DESCRIPTOR, context, request);
  }
}
