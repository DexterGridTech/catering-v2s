package com.catering.v2s.salesmenu.application;

import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.asset.api.SalesMenuAssetReadApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.application.persistence.SalesMenuPersistence;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Stable owner API facade for the split SalesMenu aggregate services. */
@Service
public class SalesMenuOwnerService implements SalesMenuOwnerApi, SalesMenuCommandApi {
    private static final String STORE_SALES_MENU_CAPABILITY = "EDIT_STORE_SALES_MENU";
    private final SalesMenuDefinitionService definitionService;
    private final SalesMenuSectionService sectionService;
    private final SalesMenuItemService itemService;
    private final SalesMenuPublicationService publicationService;
    private final SalesMenuManualSaleService manualSaleService;
    private final SalesMenuOperationRecordService operationRecordService;
    private final StoreOperatingRuleGate storeOperatingRuleGate;

    public SalesMenuOwnerService(SalesMenuPersistence persistence, TimeProvider time, ObjectMapper json) {
        this(
                new SalesMenuDefinitionService(persistence, time, json),
                new SalesMenuSectionService(persistence, time, json),
                new SalesMenuItemService(persistence, time, json),
                new SalesMenuPublicationService(persistence, time, json),
                new SalesMenuManualSaleService(persistence, time, json),
                new SalesMenuOperationRecordService(persistence, time, json),
                null);
    }

    @Autowired
    public SalesMenuOwnerService(
            SalesMenuDefinitionService definitionService,
            SalesMenuSectionService sectionService,
            SalesMenuItemService itemService,
            SalesMenuPublicationService publicationService,
            SalesMenuManualSaleService manualSaleService,
            SalesMenuOperationRecordService operationRecordService,
            StoreOperatingRuleGate storeOperatingRuleGate) {
        this.definitionService = Objects.requireNonNull(definitionService, "definitionService");
        this.sectionService = Objects.requireNonNull(sectionService, "sectionService");
        this.itemService = Objects.requireNonNull(itemService, "itemService");
        this.publicationService = Objects.requireNonNull(publicationService, "publicationService");
        this.manualSaleService = Objects.requireNonNull(manualSaleService, "manualSaleService");
        this.operationRecordService = Objects.requireNonNull(operationRecordService, "operationRecordService");
        this.storeOperatingRuleGate = storeOperatingRuleGate;
    }

    /** Direct-owner fixture constructor using the same typed persistence boundary as Spring wiring. */
    public SalesMenuOwnerService(
            SalesMenuPersistence persistence,
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
                persistence,
                time,
                json,
                catalog,
                inventory,
                channels,
                organization,
                assets,
                assetCommands,
                catalogAssetReferenceLock,
                null);
    }

    /** Direct-owner fixture constructor with the store capability gate explicitly supplied. */
    public SalesMenuOwnerService(
            SalesMenuPersistence persistence,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets,
            SalesMenuAssetCommandApi assetCommands,
            CatalogAssetReferenceLock catalogAssetReferenceLock,
            StoreOperatingRuleGate storeOperatingRuleGate) {
        this(
                new SalesMenuDefinitionService(persistence, time, json, organization, channels),
                new SalesMenuSectionService(persistence, time, json, catalog, inventory, channels, organization),
                new SalesMenuItemService(
                        persistence, time, json, catalog, inventory, channels, organization, assets, assetCommands),
                new SalesMenuPublicationService(
                        persistence, time, json, catalog, inventory, channels, organization, assets,
                        catalogAssetReferenceLock),
                new SalesMenuManualSaleService(persistence, time, json, catalog, inventory, channels, organization),
                new SalesMenuOperationRecordService(persistence, time, json, channels, organization),
                storeOperatingRuleGate);
    }

    /** Direct-owner fixture constructor using the same typed persistence boundary as Spring wiring. */
    public SalesMenuOwnerService(
            SalesMenuPersistence persistence,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets) {
        this(persistence, time, json, catalog, inventory, channels, organization, assets, null, null);
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
        requireCatalogManagement(command.context());
        return definitionService.create(command);
    }

    @Override
    public SalesMenuReadback.Command copy(SalesMenuOwnerApi.CopyCommand command) {
        requireCatalogManagement(command.context());
        return definitionService.copy(command);
    }

    @Override
    public SalesMenuReadback.Command rename(SalesMenuOwnerApi.RenameCommand command) {
        requireCatalogManagement(command.context());
        return definitionService.rename(command);
    }

    @Override
    public SalesMenuReadback.Command archive(SalesMenuOwnerApi.ArchiveCommand command) {
        requireCatalogManagement(command.context());
        return definitionService.archive(command);
    }

    @Override
    public SalesMenuReadback.Command setActivation(SalesMenuOwnerApi.ActivationCommand command) {
        requireCatalogManagement(command.context());
        return definitionService.setActivation(command);
    }

    @Override
    public SalesMenuReadback.Command updateSchedule(SalesMenuOwnerApi.ScheduleCommand command) {
        requireCatalogManagement(command.context());
        return definitionService.updateSchedule(command);
    }

    @Override
    public SalesMenuReadback.Command createSection(SalesMenuOwnerApi.SectionCreateCommand command) {
        requireCatalogManagement(command.context());
        return sectionService.createSection(command);
    }

    @Override
    public SalesMenuReadback.Command renameSection(SalesMenuOwnerApi.SectionRenameCommand command) {
        requireCatalogManagement(command.context());
        return sectionService.renameSection(command);
    }

    @Override
    public SalesMenuReadback.Command deleteSection(SalesMenuOwnerApi.SectionDeleteCommand command) {
        requireCatalogManagement(command.context());
        return sectionService.deleteSection(command);
    }

    @Override
    public SalesMenuReadback.Command moveSection(SalesMenuOwnerApi.SectionMoveCommand command) {
        requireCatalogManagement(command.context());
        return sectionService.moveSection(command);
    }

    @Override
    public SalesMenuReadback.Command addItems(SalesMenuOwnerApi.ItemsAddCommand command) {
        requireCatalogManagement(command.context());
        return itemService.addItems(command);
    }

    @Override
    public SalesMenuReadback.Command updateItem(SalesMenuOwnerApi.ItemUpdateCommand command) {
        requireCatalogManagement(command.context());
        return itemService.updateItem(command);
    }

    @Override
    public SalesMenuReadback.Command deleteItem(SalesMenuOwnerApi.ItemDeleteCommand command) {
        requireCatalogManagement(command.context());
        return itemService.deleteItem(command);
    }

    @Override
    public SalesMenuReadback.Command moveItem(SalesMenuOwnerApi.ItemMoveCommand command) {
        requireCatalogManagement(command.context());
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
        requireCatalogManagement(command.context());
        return publicationService.publish(command);
    }

    @Override
    public SalesMenuReadback.Command setManualSoldOut(SalesMenuOwnerApi.ManualSoldOutCommand command) {
        requireCatalogManagement(command.context());
        return manualSaleService.setManualSoldOut(command);
    }

    @Override
    public SalesMenuReadback.Command restoreManualSale(SalesMenuOwnerApi.ManualRestoreCommand command) {
        requireCatalogManagement(command.context());
        return manualSaleService.restoreManualSale(command);
    }

    @Override
    public SalesMenuReadback.Command create(SalesMenuCommandApi.CreateCommand command) {
        return create(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command copy(SalesMenuCommandApi.CopyCommand command) {
        return copy(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command rename(SalesMenuCommandApi.RenameCommand command) {
        return rename(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command archive(SalesMenuCommandApi.ArchiveCommand command) {
        return archive(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command setActivation(SalesMenuCommandApi.ActivationCommand command) {
        return setActivation(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command updateSchedule(SalesMenuCommandApi.ScheduleCommand command) {
        return updateSchedule(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command createSection(SalesMenuCommandApi.SectionCreateCommand command) {
        return createSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command renameSection(SalesMenuCommandApi.SectionRenameCommand command) {
        return renameSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command deleteSection(SalesMenuCommandApi.SectionDeleteCommand command) {
        return deleteSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command moveSection(SalesMenuCommandApi.SectionMoveCommand command) {
        return moveSection(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command addItems(SalesMenuCommandApi.ItemsAddCommand command) {
        return addItems(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command updateItem(SalesMenuCommandApi.ItemUpdateCommand command) {
        return updateItem(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command deleteItem(SalesMenuCommandApi.ItemDeleteCommand command) {
        return deleteItem(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command moveItem(SalesMenuCommandApi.ItemMoveCommand command) {
        return moveItem(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command publish(SalesMenuCommandApi.PublishCommand command) {
        return publish(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command setManualSoldOut(SalesMenuCommandApi.ManualSoldOutCommand command) {
        return setManualSoldOut(command.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command restoreManualSale(SalesMenuCommandApi.ManualRestoreCommand command) {
        return restoreManualSale(command.ownerCommand());
    }

    private void requireCatalogManagement(SalesMenuOwnerApi.CommandContext context) {
        OperationsOwnerScopeGrant grant = context.ownerScopeGrant();
        SalesMenuScope scope = context.scope();
        if (!grant.matchesCapability(
                        scope.workspaceUuid(),
                        scope.groupWorkspaceKey(),
                        "STORE",
                        scope.storeRef(),
                        STORE_SALES_MENU_CAPABILITY)
                || (grant.expectedContextVersion() >= 0
                        && !grant.matchesExpectedContextVersion(context.contextVersion()))) {
            throw new SalesMenuOwnerApi.Problem("GRANT_INVALID", 403, "销售菜单授权无效");
        }
        if (storeOperatingRuleGate == null) {
            throw new IllegalStateException("store operating-rule gate is not wired");
        }
        storeOperatingRuleGate.requireCatalogManagementForStoreTarget(
                scope.workspaceUuid(), scope.groupWorkspaceKey(), "STORE", scope.storeRef());
    }
}
