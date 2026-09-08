package com.catering.v2s.app.edge.operations.salesmenu;

import com.catering.v2s.app.edge.generated.wire.InventoryAvailabilityFact;
import com.catering.v2s.app.edge.generated.wire.ManualSaleStatusFact;
import com.catering.v2s.app.edge.generated.wire.SalesMenuActivation;
import com.catering.v2s.app.edge.generated.wire.SalesMenuAssetReleaseReadback;
import com.catering.v2s.app.edge.generated.wire.SalesMenuAssetStageReadback;
import com.catering.v2s.app.edge.generated.wire.SalesMenuAssetTargetReadback;
import com.catering.v2s.app.edge.generated.wire.SalesMenuCandidatePage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuCommandReadback;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDetail;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDisplayMedia;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDraftItemView;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDraftItemViewCatalogOrderOptionsItem;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDraftItemViewCatalogOrderOptionsItemValuesItem;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDraftItemViewSkuCandidatesItem;
import com.catering.v2s.app.edge.generated.wire.SalesMenuItemCandidate;
import com.catering.v2s.app.edge.generated.wire.SalesMenuItemPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuOperationRecord;
import com.catering.v2s.app.edge.generated.wire.SalesMenuOperationRecordPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuOrderingConstraints;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublicationBlocker;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublicationPreview;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedItemPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedItemView;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedItemViewManualSaleTargetStatusesItem;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedSectionList;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSaleContent;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSaleContentSalesUnit;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSaleContentSelectedOrderOptionsItem;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSaleContentSelectedOrderOptionsItemValuesItem;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSchedule;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSectionList;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSectionView;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSkuPrice;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSummary;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuSelectedOrderOption;
import com.catering.v2s.salesmenu.domain.SalesMenuSelectedOrderOptionValue;
import java.util.List;

/** Maps owner-native sales-menu facts to the generated operations wire types. */
final class SalesMenuWireMapper {
    private SalesMenuWireMapper() {}

    static SalesMenuPage menuPage(SalesMenuReadback.MenuPage value) {
        return new SalesMenuPage(
                value.items().stream().map(SalesMenuWireMapper::menuSummary).toList(),
                value.cursor(),
                value.nextCursor());
    }

    static SalesMenuDetail menuDetail(SalesMenuReadback.MenuDetail value) {
        return new SalesMenuDetail(
                value.salesMenuRef(),
                value.groupWorkspaceKey(),
                value.storeRef(),
                value.name(),
                value.archived(),
                value.version(),
                value.draftRevision(),
                value.latestPublishedRevision(),
                value.draftDirty(),
                activation(value.activation()),
                schedule(value.draftSchedule()),
                schedule(value.latestPublishedSchedule()));
    }

    static SalesMenuSectionList draftSections(SalesMenuReadback.SectionList value) {
        return new SalesMenuSectionList(
                value.items().stream().map(SalesMenuWireMapper::section).toList());
    }

    static SalesMenuPublishedSectionList publishedSections(SalesMenuReadback.SectionList value) {
        return new SalesMenuPublishedSectionList(
                value.items().stream().map(SalesMenuWireMapper::section).toList());
    }

    static SalesMenuItemPage draftItemPage(SalesMenuReadback.DraftItemPage value) {
        return new SalesMenuItemPage(
                value.items().stream().map(SalesMenuWireMapper::draftItem).toList(),
                value.cursor(),
                value.nextCursor());
    }

    static SalesMenuDraftItemView draftItem(SalesMenuReadback.DraftItemView value) {
        return new SalesMenuDraftItemView(
                value.salesItemRef(),
                value.catalogItemRef(),
                value.itemCode(),
                value.displayName(),
                value.productShape(),
                value.catalogOrderOptions().stream().map(SalesMenuWireMapper::catalogOrderOption).toList(),
                value.skuCandidates().stream().map(SalesMenuWireMapper::skuCandidate).toList(),
                value.staleSelectedSkuRefs(),
                value.defaultPriceCents(),
                value.catalogPrimaryImageAssetRef(),
                value.catalogImageAssetRefs(),
                saleContent(value.saleContent()),
                ordering(value.orderingConstraints()),
                displayMedia(value.displayMedia()),
                value.displayOrder(),
                value.canMoveUp(),
                value.canMoveDown(),
                value.version());
    }

    static SalesMenuPublishedItemPage publishedItemPage(SalesMenuReadback.PublishedItemPage value) {
        return new SalesMenuPublishedItemPage(
                value.items().stream().map(SalesMenuWireMapper::publishedItem).toList(),
                value.cursor(),
                value.nextCursor());
    }

    static SalesMenuPublishedItemView publishedItem(SalesMenuReadback.PublishedItemView value) {
        return new SalesMenuPublishedItemView(
                value.salesItemRef(),
                value.catalogItemRef(),
                value.itemCode(),
                value.displayName(),
                value.productShape(),
                saleContent(value.saleContent()),
                ordering(value.orderingConstraints()),
                displayMedia(value.displayMedia()),
                value.publishedPrimaryImageAssetRef(),
                value.publishedCatalogImageAssetRefs(),
                value.displayOrder(),
                inventory(value.inventoryAvailability()),
                manual(value.manualSaleStatus()),
                value.manualSaleTargetStatuses().stream()
                        .map(SalesMenuWireMapper::manualSaleTargetStatus)
                        .toList(),
                value.version());
    }

    static SalesMenuCandidatePage candidatePage(SalesMenuReadback.CandidatePage value) {
        return new SalesMenuCandidatePage(
                value.items().stream().map(SalesMenuWireMapper::candidate).toList(),
                value.cursor(),
                value.nextCursor());
    }

    static SalesMenuPublicationPreview publicationPreview(SalesMenuReadback.PublicationPreview value) {
        return new SalesMenuPublicationPreview(
                value.salesMenuRef(),
                value.draftRevision(),
                value.hasChanges(),
                value.violations().stream().map(SalesMenuWireMapper::blocker).toList());
    }

    static SalesMenuOperationRecordPage operationRecordPage(SalesMenuReadback.OperationRecordPage value) {
        return new SalesMenuOperationRecordPage(
                value.items().stream().map(SalesMenuWireMapper::operationRecord).toList(),
                value.cursor(),
                value.nextCursor());
    }

    static SalesMenuCommandReadback command(SalesMenuReadback.Command value) {
        return new SalesMenuCommandReadback(
                value.operationKind(),
                value.salesMenuRef(),
                value.targetRef(),
                value.version(),
                value.readbackStatus().name());
    }

    static SalesMenuAssetStageReadback assetStage(SalesMenuReadback.AssetStage value) {
        return new SalesMenuAssetStageReadback(
                value.assetRef(), value.bindGrant(), value.status(), value.version(), assetTarget(value.target()));
    }

    static SalesMenuAssetReleaseReadback assetRelease(SalesMenuReadback.AssetRelease value) {
        return new SalesMenuAssetReleaseReadback(
                value.assetRef(), "RELEASED", value.version(), assetTarget(value.target()));
    }

    private static SalesMenuSummary menuSummary(SalesMenuReadback.MenuSummary value) {
        return new SalesMenuSummary(
                value.salesMenuRef(),
                value.storeRef(),
                value.name(),
                value.archived(),
                value.version(),
                value.draftRevision(),
                value.latestPublishedRevision(),
                value.draftDirty(),
                activation(value.activation()),
                schedule(value.draftSchedule()));
    }

    private static SalesMenuActivation activation(SalesMenuReadback.Activation value) {
        return value == null ? null : new SalesMenuActivation(value.channelRef(), value.status(), value.version());
    }

    private static SalesMenuSchedule schedule(com.catering.v2s.salesmenu.domain.SalesMenuSchedule value) {
        return value == null
                ? null
                : new SalesMenuSchedule(
                        value.kind().name(),
                        value.startLocalTime() == null
                                ? null
                                : value.startLocalTime().toString(),
                        value.endLocalTime() == null
                                ? null
                                : value.endLocalTime().toString());
    }

    private static SalesMenuSectionView section(SalesMenuReadback.SectionView value) {
        return new SalesMenuSectionView(
                value.salesSectionRef(),
                value.name(),
                value.displayOrder(),
                value.itemCount(),
                value.canMoveUp(),
                value.canMoveDown());
    }

    private static SalesMenuSaleContent saleContent(com.catering.v2s.salesmenu.domain.SalesMenuSaleContent value) {
        return new SalesMenuSaleContent(
                value.kind().name(),
                value.listedPriceCents(),
                value.skuPrices().stream().map(SalesMenuWireMapper::skuPrice).toList(),
                value.selectedOrderOptions().stream()
                        .map(SalesMenuWireMapper::selectedOrderOption)
                        .toList(),
                value.salesUnit() == null
                        ? null
                        : new SalesMenuSaleContentSalesUnit(
                                value.salesUnit().unitRef(),
                                value.salesUnit().code(),
                                value.salesUnit().name(),
                                value.salesUnit().unitDimension(),
                                (long) value.salesUnit().precision()));
    }

    private static SalesMenuSkuPrice skuPrice(com.catering.v2s.salesmenu.domain.SalesMenuSkuPrice value) {
        return new SalesMenuSkuPrice(
                value.skuRef(), value.skuName(), value.skuCode(), value.standardPriceCents(), value.listedPriceCents());
    }

    private static SalesMenuDraftItemViewCatalogOrderOptionsItem catalogOrderOption(
            SalesMenuReadback.SalesMenuOrderOption value) {
        return new SalesMenuDraftItemViewCatalogOrderOptionsItem(
                value.definitionRef(),
                value.name(),
                value.selectionMode(),
                (long) value.displayOrder(),
                value.required(),
                value.minSelectionCount() == null ? null : value.minSelectionCount().longValue(),
                value.maxSelectionCount() == null ? null : value.maxSelectionCount().longValue(),
                value.values().stream().map(SalesMenuWireMapper::catalogOrderOptionValue).toList());
    }

    private static SalesMenuDraftItemViewCatalogOrderOptionsItemValuesItem catalogOrderOptionValue(
            SalesMenuReadback.SalesMenuOrderOptionValue value) {
        return new SalesMenuDraftItemViewCatalogOrderOptionsItemValuesItem(
                value.definitionValueRef(),
                value.name(),
                (long) value.displayOrder(),
                value.defaultValue(),
                value.extraPrice());
    }

    private static SalesMenuSaleContentSelectedOrderOptionsItem selectedOrderOption(
            SalesMenuReadback.SalesMenuOrderOption value) {
        return new SalesMenuSaleContentSelectedOrderOptionsItem(
                value.definitionRef(),
                value.name(),
                value.selectionMode(),
                (long) value.displayOrder(),
                value.required(),
                value.minSelectionCount() == null ? null : value.minSelectionCount().longValue(),
                value.maxSelectionCount() == null ? null : value.maxSelectionCount().longValue(),
                value.values().stream().map(SalesMenuWireMapper::selectedOrderOptionValue).toList());
    }

    private static SalesMenuSaleContentSelectedOrderOptionsItem selectedOrderOption(
            SalesMenuSelectedOrderOption value) {
        return new SalesMenuSaleContentSelectedOrderOptionsItem(
                value.definitionRef(),
                value.name(),
                value.selectionMode(),
                (long) value.displayOrder(),
                value.required(),
                value.minSelectionCount() == null ? null : value.minSelectionCount().longValue(),
                value.maxSelectionCount() == null ? null : value.maxSelectionCount().longValue(),
                value.values().stream().map(SalesMenuWireMapper::selectedOrderOptionValue).toList());
    }

    private static SalesMenuSaleContentSelectedOrderOptionsItemValuesItem selectedOrderOptionValue(
            SalesMenuReadback.SalesMenuOrderOptionValue value) {
        return new SalesMenuSaleContentSelectedOrderOptionsItemValuesItem(
                value.definitionValueRef(),
                value.name(),
                (long) value.displayOrder(),
                value.defaultValue(),
                value.extraPrice());
    }

    private static SalesMenuSaleContentSelectedOrderOptionsItemValuesItem selectedOrderOptionValue(
            SalesMenuSelectedOrderOptionValue value) {
        return new SalesMenuSaleContentSelectedOrderOptionsItemValuesItem(
                value.definitionValueRef(),
                value.name(),
                (long) value.displayOrder(),
                value.defaultValue(),
                value.extraPrice());
    }

    private static SalesMenuDraftItemViewSkuCandidatesItem skuCandidate(
            SalesMenuReadback.SalesMenuSkuCandidate value) {
        return new SalesMenuDraftItemViewSkuCandidatesItem(
                value.skuRef(), value.skuName(), value.skuCode(), value.standardPriceCents());
    }

    private static SalesMenuOrderingConstraints ordering(
            com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints value) {
        return new SalesMenuOrderingConstraints(
                value.minItemQuantity() == null ? null : value.minItemQuantity().longValue(),
                value.quantityStep() == null ? null : value.quantityStep().longValue());
    }

    private static SalesMenuDisplayMedia displayMedia(com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia value) {
        return new SalesMenuDisplayMedia(value.mode().name(), value.assetRefs(), value.primaryAssetRef());
    }

    private static InventoryAvailabilityFact inventory(SalesMenuReadback.InventoryAvailabilityFact value) {
        return new InventoryAvailabilityFact(value.applicability(), value.state(), value.reason());
    }

    private static ManualSaleStatusFact manual(SalesMenuReadback.ManualSaleStatusFact value) {
        return new ManualSaleStatusFact(
                value.state().name(), value.reason(), value.changedAt(), value.changedByDisplayName());
    }

    private static SalesMenuPublishedItemViewManualSaleTargetStatusesItem manualSaleTargetStatus(
            SalesMenuReadback.ManualSaleTargetStatus value) {
        return new SalesMenuPublishedItemViewManualSaleTargetStatusesItem(
                value.targetKind().name(),
                value.targetRef(),
                value.resolvedTargetDisplayName(),
                value.state().name(),
                value.reason(),
                value.changedAt(),
                value.changedByDisplayName());
    }

    private static SalesMenuItemCandidate candidate(SalesMenuReadback.ItemCandidate value) {
        return new SalesMenuItemCandidate(
                value.candidateRef(),
                value.catalogItemRef(),
                value.itemCode(),
                value.displayName(),
                value.productShape(),
                List.copyOf(value.categoryRefs()),
                List.copyOf(value.categoryNames()),
                value.defaultPriceCents(),
                value.alreadyAddedCount());
    }

    private static SalesMenuPublicationBlocker blocker(SalesMenuReadback.PublicationBlocker value) {
        return new SalesMenuPublicationBlocker(value.kind().name(), value.salesItemRef(), value.messageKey());
    }

    private static SalesMenuOperationRecord operationRecord(SalesMenuReadback.OperationRecord value) {
        return new SalesMenuOperationRecord(
                value.operationRecordRef(),
                value.occurredAt(),
                value.operationKind(),
                value.salesMenuRef(),
                value.targetRef(),
                value.targetKind(),
                value.targetDisplaySnapshot(),
                value.result().name(),
                value.failureCode(),
                value.actorDisplayName());
    }

    private static SalesMenuAssetTargetReadback assetTarget(
            com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget value) {
        return new SalesMenuAssetTargetReadback(
                value.groupWorkspaceKey(),
                value.storeRef(),
                value.salesMenuRef(),
                value.salesItemRef(),
                value.usage().name(),
                value.expectedDraftVersion());
    }
}
