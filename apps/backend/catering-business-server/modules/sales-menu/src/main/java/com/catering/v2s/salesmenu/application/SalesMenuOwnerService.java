package com.catering.v2s.salesmenu.application;

import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.asset.api.SalesMenuAssetReadApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTargetMode;
import com.catering.v2s.salesmenu.domain.SalesMenuCandidateQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemPageQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionQuery;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Stable owner API facade for the split SalesMenu aggregate services. */
@Service
public class SalesMenuOwnerService implements SalesMenuOwnerApi, SalesMenuCommandApi {
    private final SalesMenuDefinitionService definitionService;
    private final SalesMenuSectionService sectionService;
    private final SalesMenuItemService itemService;
    private final SalesMenuPublicationService publicationService;
    private final SalesMenuManualSaleService manualSaleService;
    private final SalesMenuOperationRecordService operationRecordService;

    public SalesMenuOwnerService(SalesMenuRepository repository, TimeProvider time, ObjectMapper json) {
        this(
                new SalesMenuDefinitionService(repository, time, json),
                new SalesMenuSectionService(repository, time, json),
                new SalesMenuItemService(repository, time, json),
                new SalesMenuPublicationService(repository, time, json),
                new SalesMenuManualSaleService(repository, time, json),
                new SalesMenuOperationRecordService(repository, time, json));
    }

    @Autowired
    public SalesMenuOwnerService(
            SalesMenuDefinitionService definitionService,
            SalesMenuSectionService sectionService,
            SalesMenuItemService itemService,
            SalesMenuPublicationService publicationService,
            SalesMenuManualSaleService manualSaleService,
            SalesMenuOperationRecordService operationRecordService) {
        this.definitionService = Objects.requireNonNull(definitionService, "definitionService");
        this.sectionService = Objects.requireNonNull(sectionService, "sectionService");
        this.itemService = Objects.requireNonNull(itemService, "itemService");
        this.publicationService = Objects.requireNonNull(publicationService, "publicationService");
        this.manualSaleService = Objects.requireNonNull(manualSaleService, "manualSaleService");
        this.operationRecordService = Objects.requireNonNull(operationRecordService, "operationRecordService");
    }

    /** Compatibility constructor retained for existing direct owner fixtures. */
    public SalesMenuOwnerService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets,
            SalesMenuAssetCommandApi assetCommands,
            CatalogAssetReferenceLock catalogAssetReferenceLock) {
        this(
                new SalesMenuDefinitionService(repository, time, json, organization, channels),
                new SalesMenuSectionService(repository, time, json, catalog, inventory, channels, organization),
                new SalesMenuItemService(
                        repository, time, json, catalog, inventory, channels, organization, assets, assetCommands),
                new SalesMenuPublicationService(
                        repository, time, json, catalog, inventory, channels, organization, assets,
                        catalogAssetReferenceLock),
                new SalesMenuManualSaleService(repository, time, json, catalog, inventory, channels, organization),
                new SalesMenuOperationRecordService(repository, time, json, channels, organization));
    }

    /** Compatibility constructor retained for existing direct owner fixtures. */
    public SalesMenuOwnerService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets) {
        this(repository, time, json, catalog, inventory, channels, organization, assets, null, null);
    }

    @Override
    public SalesMenuReadback.MenuPage listMenus(SalesMenuListQuery query) {
        return definitionService.listMenus(query);
    }

    @Override
    public SalesMenuReadback.MenuDetail readMenu(SalesMenuTarget target, UUID channelRef) {
        return definitionService.readMenu(target, channelRef);
    }

    @Override
    public SalesMenuReadback.SectionList listDraftSections(SalesMenuVersionQuery query) {
        return sectionService.listDraftSections(query);
    }

    @Override
    public SalesMenuReadback.DraftItemPage listDraftItems(SalesMenuItemPageQuery query) {
        return itemService.listDraftItems(query);
    }

    @Override
    public SalesMenuReadback.DraftItemView readDraftItem(SalesMenuItemQuery query) {
        return itemService.readDraftItem(query);
    }

    @Override
    public SalesMenuReadback.SectionList listPublishedSections(SalesMenuVersionQuery query) {
        return sectionService.listPublishedSections(query);
    }

    @Override
    public SalesMenuReadback.PublishedItemPage listPublishedItems(SalesMenuItemPageQuery query) {
        return itemService.listPublishedItems(query);
    }

    @Override
    public SalesMenuReadback.PublishedItemView readPublishedItem(SalesMenuItemQuery query) {
        return itemService.readPublishedItem(query);
    }

    @Override
    public SalesMenuReadback.CandidatePage listItemCandidates(SalesMenuCandidateQuery query) {
        return itemService.listItemCandidates(query);
    }

    @Override
    public SalesMenuReadback.PublicationPreview publicationPreview(SalesMenuTarget target, UUID channelRef) {
        return publicationService.publicationPreview(target, channelRef);
    }

    @Override
    public SalesMenuReadback.OperationRecordPage listOperationRecords(SalesMenuOperationQuery query) {
        return operationRecordService.listOperationRecords(query);
    }

    @Override
    public SalesMenuReadback.OperationRecord recordRejectedOperation(
            SalesMenuOwnerApi.RejectedOperationCommand command) {
        return operationRecordService.recordRejectedOperation(command);
    }

    @Override
    public SalesMenuReadback.Command create(SalesMenuOwnerApi.CreateCommand command) {
        return definitionService.create(command);
    }

    @Override
    public SalesMenuReadback.Command copy(SalesMenuOwnerApi.CopyCommand command) {
        return definitionService.copy(command);
    }

    @Override
    public SalesMenuReadback.Command rename(SalesMenuOwnerApi.RenameCommand command) {
        return definitionService.rename(command);
    }

    @Override
    public SalesMenuReadback.Command archive(SalesMenuOwnerApi.ArchiveCommand command) {
        return definitionService.archive(command);
    }

    @Override
    public SalesMenuReadback.Command setActivation(SalesMenuOwnerApi.ActivationCommand command) {
        return definitionService.setActivation(command);
    }

    @Override
    public SalesMenuReadback.Command updateSchedule(SalesMenuOwnerApi.ScheduleCommand command) {
        return definitionService.updateSchedule(command);
    }

    @Override
    public SalesMenuReadback.Command createSection(SalesMenuOwnerApi.SectionCreateCommand command) {
        return sectionService.createSection(command);
    }

    @Override
    public SalesMenuReadback.Command renameSection(SalesMenuOwnerApi.SectionRenameCommand command) {
        return sectionService.renameSection(command);
    }

    @Override
    public SalesMenuReadback.Command deleteSection(SalesMenuOwnerApi.SectionDeleteCommand command) {
        return sectionService.deleteSection(command);
    }

    @Override
    public SalesMenuReadback.Command moveSection(SalesMenuOwnerApi.SectionMoveCommand command) {
        return sectionService.moveSection(command);
    }

    @Override
    public SalesMenuReadback.Command addItems(SalesMenuOwnerApi.ItemsAddCommand command) {
        return itemService.addItems(command);
    }

    @Override
    public SalesMenuReadback.Command updateItem(SalesMenuOwnerApi.ItemUpdateCommand command) {
        return itemService.updateItem(command);
    }

    @Override
    public SalesMenuReadback.Command deleteItem(SalesMenuOwnerApi.ItemDeleteCommand command) {
        return itemService.deleteItem(command);
    }

    @Override
    public SalesMenuReadback.Command moveItem(SalesMenuOwnerApi.ItemMoveCommand command) {
        return itemService.moveItem(command);
    }

    @Override
    public SalesMenuReadback.AssetTargetReadback requireSalesMenuItemAssetTarget(
            SalesMenuAssetTargetMode mode,
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant grant,
            long contextVersion) {
        return itemService.requireSalesMenuItemAssetTarget(mode, target, grant, contextVersion);
    }

    @Override
    public SalesMenuReadback.Command publish(SalesMenuOwnerApi.PublishCommand command) {
        return publicationService.publish(command);
    }

    @Override
    public SalesMenuReadback.Command setManualSoldOut(SalesMenuOwnerApi.ManualSoldOutCommand command) {
        return manualSaleService.setManualSoldOut(command);
    }

    @Override
    public SalesMenuReadback.Command restoreManualSale(SalesMenuOwnerApi.ManualRestoreCommand command) {
        return manualSaleService.restoreManualSale(command);
    }

    @Override
    public SalesMenuReadback.Command create(SalesMenuCommandApi.CreateCommand command) {
        return definitionService.create(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command copy(SalesMenuCommandApi.CopyCommand command) {
        return definitionService.copy(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command rename(SalesMenuCommandApi.RenameCommand command) {
        return definitionService.rename(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command archive(SalesMenuCommandApi.ArchiveCommand command) {
        return definitionService.archive(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command setActivation(SalesMenuCommandApi.ActivationCommand command) {
        return definitionService.setActivation(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command updateSchedule(SalesMenuCommandApi.ScheduleCommand command) {
        return definitionService.updateSchedule(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command createSection(SalesMenuCommandApi.SectionCreateCommand command) {
        return sectionService.createSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command renameSection(SalesMenuCommandApi.SectionRenameCommand command) {
        return sectionService.renameSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command deleteSection(SalesMenuCommandApi.SectionDeleteCommand command) {
        return sectionService.deleteSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command moveSection(SalesMenuCommandApi.SectionMoveCommand command) {
        return sectionService.moveSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command addItems(SalesMenuCommandApi.ItemsAddCommand command) {
        return itemService.addItems(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command updateItem(SalesMenuCommandApi.ItemUpdateCommand command) {
        return itemService.updateItem(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command deleteItem(SalesMenuCommandApi.ItemDeleteCommand command) {
        return itemService.deleteItem(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command moveItem(SalesMenuCommandApi.ItemMoveCommand command) {
        return itemService.moveItem(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command publish(SalesMenuCommandApi.PublishCommand command) {
        return publicationService.publish(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command setManualSoldOut(SalesMenuCommandApi.ManualSoldOutCommand command) {
        return manualSaleService.setManualSoldOut(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command restoreManualSale(SalesMenuCommandApi.ManualRestoreCommand command) {
        return manualSaleService.restoreManualSale(command.ownerCommand());
    }
}
