package com.catering.v2s.salesmenu.application;

import com.catering.v2s.salesmenu.application.persistence.SalesMenuPersistence;
import com.catering.v2s.salesmenu.application.persistence.SalesMenuPersistence.PublicationItemSeed;
import com.catering.v2s.salesmenu.application.persistence.SalesMenuPersistence.PublicationMediaSeed;
import com.catering.v2s.salesmenu.application.persistence.SalesMenuPersistence.PublicationSkuSeed;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.asset.api.SalesMenuAssetReadApi;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuActivationStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTargetMode;
import com.catering.v2s.salesmenu.domain.SalesMenuCandidateQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuCommandReadbackStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuCursorIdentity;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMediaMode;
import com.catering.v2s.salesmenu.domain.SalesMenuItemPageQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleState;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTargetKind;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationResult;
import com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints;
import com.catering.v2s.salesmenu.domain.SalesMenuPublicationBlockerKind;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContent;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentInput;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentKind;
import com.catering.v2s.salesmenu.domain.SalesMenuSalesUnit;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuSelectedOrderOption;
import com.catering.v2s.salesmenu.domain.SalesMenuSelectedOrderOptionValue;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionQuery;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Time;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static com.catering.v2s.salesmenu.application.SalesMenuReadModels.*;

/** Owns the salesmenupublication sales-menu facts. */

@Service

public class SalesMenuPublicationService {

    private static final String CAPABILITY = "EDIT_STORE_SALES_MENU";

    private final SalesMenuPersistence persistence;
    private final TimeProvider time;
    private final ObjectMapper json;
    private final CatalogOwnerApi catalog;
    private final InventoryOwnerApi inventory;
    private final BusinessChannelOwnerApi channels;
    private final OrganizationOwnerApi organization;
    private final SalesMenuAssetReadApi assets;
    private final CatalogAssetReferenceLock catalogAssetReferenceLock;

    public SalesMenuPublicationService(SalesMenuPersistence persistence, TimeProvider time, ObjectMapper json) {
        this(persistence, time, json, null, null, null, null, null, null);
    }

    @Autowired

    public SalesMenuPublicationService(
            SalesMenuPersistence persistence,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets,
            CatalogAssetReferenceLock catalogAssetReferenceLock) {

        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.time = Objects.requireNonNull(time, "time");
        this.json = Objects.requireNonNull(json, "json");
        this.catalog = catalog;
        this.inventory = inventory;
        this.channels = channels;
        this.organization = organization;
        this.assets = assets;
        this.catalogAssetReferenceLock = catalogAssetReferenceLock;

    }

    public SalesMenuReadback.PublicationPreview publicationPreview(SalesMenuTarget target, UUID channelRef) {
        var menu = requireMenu(target, false);
        List<SalesMenuReadback.PublicationBlocker> blockers =
                publicationValidation(menu, channelRef).blockers();
        return new SalesMenuReadback.PublicationPreview(
                target.salesMenuRef(), menu.draftRevision(), menu.draftDirty(), blockers);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command publish(SalesMenuOwnerApi.PublishCommand command) {
        requireGrant(command.context(), true);
        return receipt(
                "publishOperationsSalesMenu",
                command.context(),
                command,
                () -> lockMenuTargetWithStore(command.context(), null),
                locked -> preflightPublish(command, locked.menu(), locked.store()),
                preflight -> {
                    var menu = preflight.menu();
                    PublicationValidation validation = preflight.validation();
                    requireCas(command.context().target(), command.expectedVersion());
                    UUID draft = draftVersion(menu.salesMenuRef());
                    UUID published = UUID.randomUUID();
                    long revision = menu.latestPublishedRevision() == null ? 1 : menu.latestPublishedRevision() + 1;
                    insertVersion(
                            published,
                            menu.salesMenuRef(),
                            SalesMenuVersionKind.PUBLISHED,
                            revision,
                            menu.draftSchedule(),
                            draft,
                            menu.draftRevision());
                    copyPublicationRows(published, validation, menu.salesMenuRef());
                    persistence.insertPublicationRecord(
                            UUID.randomUUID(),
                            menu.salesMenuRef(),
                            published,
                            menu.draftRevision(),
                            command.context().actor().actorType(),
                            command.context().actor().actorId(),
                            command.context().actor().displaySnapshot(),
                            time.currentEpochMillis());
                    persistence.setLatestPublishedVersion(published, menu.salesMenuRef());
                    removeUnpublishedChildManualStatuses(menu.salesMenuRef(), published);
                    SalesMenuReadback.Command readback = command(
                            "publishOperationsSalesMenu",
                            command.context(),
                            menu.salesMenuRef(),
                            menu.salesMenuRef(),
                            SalesMenuCommandReadbackStatus.PUBLISHED);
                    recordSuccess(
                            "publishOperationsSalesMenu",
                            command.context(),
                            null,
                            menu.salesMenuRef(),
                            menu.salesMenuRef());
                    return readback;
                });
    }

    private void removeUnpublishedChildManualStatuses(UUID collectionRef, UUID publishedVersion) {
        persistence.removeUnpublishedChildManualStatuses(collectionRef, publishedVersion);
    }

    private MenuCommandLock lockMenuTargetWithStore(SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        SalesMenuAggregate menu = requireMenu(context.target(), true);
        OrganizationOwnerApi.SalesMenuStoreJudgment store = requireOwnerCommand(context, channelRef);
        requireNotArchived(menu);
        return new MenuCommandLock(menu, store);
    }

    private PublishPreflight preflightPublish(
            SalesMenuOwnerApi.PublishCommand command,
            SalesMenuAggregate menu,
            OrganizationOwnerApi.SalesMenuStoreJudgment store) {
        PublicationValidation validation = publicationValidation(menu, null, store, true);
        if (!validation.blockers().isEmpty()) throw publicationInvalid(validation.blockers());
        return new PublishPreflight(menu, validation);
    }

    private <L, P, T> T receipt(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            Object request,
            Supplier<L> lock,
            Function<L, P> preflight,
            Function<P, T> action) {
        String hash = hash(receiptRequest(request));
        persistence.lockCommandReceipt(context.scope().workspaceUuid(), operation, context.idempotencyKey());
        L locked = lock.get();
        ReceiptRow existing = persistence
                .readCommandReceipt(
                        context.scope().workspaceUuid(),
                        operation,
                        context.idempotencyKey())
                .stream()
                .findFirst()
                .orElse(null);
        if (existing != null) return replay(operation, context, hash);
        P state = preflight.apply(locked);
        T result = action.apply(state);
        int inserted = persistence.insertCommandReceipt(
                UUID.randomUUID(),
                context.scope().workspaceUuid(),
                context.scope().groupWorkspaceKey(),
                operation,
                context.idempotencyKey(),
                hash,
                "SUCCEEDED",
                writeJson(result),
                time.currentEpochMillis());
        if (inserted == 0) return replay(operation, context, hash);
        return result;
    }

    /** Asset bind grants are request-transient proof, not part of the business intent for replay. */
    private Object receiptRequest(Object request) {
        return request;
    }

    private <T> T replay(String operation, SalesMenuOwnerApi.CommandContext context, String hash) {
        var row = persistence
                .readCommandReceiptForReplay(
                        context.scope().workspaceUuid(),
                        operation,
                        context.idempotencyKey())
                .stream()
                .findFirst()
                .orElseThrow(() -> problem("RECEIPT_MISSING", 500, "命令回执缺失"));
        if (!hash.equals(row.requestHash())) {
            throw problem("IDEMPOTENCY_CONFLICT", 409, "幂等键已用于其他请求");
        }
        if (!"SUCCEEDED".equals(row.status())) {
            throw problem("COMMAND_IN_PROGRESS", 409, "命令仍在处理中");
        }
        try {
            @SuppressWarnings("unchecked")
            T result = (T) json.readValue(row.readbackJson(), SalesMenuReadback.Command.class);
            return result;
        } catch (Exception failure) {
            throw problem("RECEIPT_CORRUPT", 500, "命令回执无法读取", failure);
        }
    }

    private PublicationValidation publicationValidation(
            com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu, UUID explicitChannelRef) {
        return publicationValidation(menu, explicitChannelRef, requireStore(menu.scope()));
    }

    private PublicationValidation publicationValidation(
            com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu,
            UUID explicitChannelRef,
            OrganizationOwnerApi.SalesMenuStoreJudgment store) {
        return publicationValidation(menu, explicitChannelRef, store, false);
    }

    private PublicationValidation publicationValidation(
            com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu,
            UUID explicitChannelRef,
            OrganizationOwnerApi.SalesMenuStoreJudgment store,
            boolean lockCatalogImages) {
        List<SalesMenuReadback.PublicationBlocker> blockers = new ArrayList<>();
        if (store != null && !"ENABLED".equals(store.status())) {
            blockers.add(new SalesMenuReadback.PublicationBlocker(
                    SalesMenuPublicationBlockerKind.STORE_DISABLED, null, "salesMenu.store.disabled"));
        }
        List<UUID> channelRefs =
                explicitChannelRef == null ? activationChannels(menu.salesMenuRef()) : List.of(explicitChannelRef);
        if (channels != null) {
            for (UUID channelRef : channelRefs) {
                try {
                    BusinessChannelOwnerApi.SalesMenuChannelJudgment channel = requireChannel(menu.scope(), channelRef);
                    if ("DISABLED".equals(channel.status())) {
                        blockers.add(new SalesMenuReadback.PublicationBlocker(
                                SalesMenuPublicationBlockerKind.CHANNEL_DISABLED, null, "salesMenu.channel.disabled"));
                    }
                } catch (SalesMenuOwnerApi.Problem failure) {
                    if ("SALES_MENU_CHANNEL_INELIGIBLE".equals(failure.code())) {
                        blockers.add(new SalesMenuReadback.PublicationBlocker(
                                SalesMenuPublicationBlockerKind.CHANNEL_INELIGIBLE,
                                null,
                                "salesMenu.channel.ineligible"));
                    } else {
                        throw failure;
                    }
                }
            }
        }

        UUID currentDraftVersion = draftVersion(menu.salesMenuRef());
        List<ItemRow> rows = itemRows(menu, SalesMenuVersionKind.DRAFT, currentDraftVersion, null, null);
        Set<UUID> catalogRefs = rows.stream()
                .map(ItemRow::catalogItemRef)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts = catalogFacts(menu.scope(), catalogRefs, store);
        if (lockCatalogImages && catalogAssetReferenceLock != null && !facts.isEmpty()) {
            Set<UUID> imageRefs = facts.values().stream()
                    .flatMap(fact -> fact.imageAssetRefs().stream())
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            if (!imageRefs.isEmpty()) {
                catalogAssetReferenceLock.lockCatalogReferences(imageRefs);
                // Re-read after taking the same assetRef-level lock used by Catalog
                // mutations so the immutable published image snapshot cannot race
                // with removal of the current Catalog image.
                facts = catalogFacts(menu.scope(), catalogRefs, store);
            }
        }
        Map<UUID, List<SkuRow>> skuByItem = skuRowsByItem(rows);
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> orderOptionsByItem = selectedOrderOptionsByItem(rows);
        Map<UUID, List<UUID>> mediaByItem = mediaByItem(rows, false);
        Set<UUID> invalidAssetRefsFromOwner = new LinkedHashSet<>();
        if (assets != null) {
            try {
                invalidAssetRefsFromOwner.addAll(invalidAssetRefs(mediaByItem));
            } catch (RuntimeException failure) {
                invalidAssetRefsFromOwner.addAll(mediaByItem.values().stream()
                        .flatMap(List::stream)
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
            }
        }
        boolean catalogOwnerRead = catalog != null && organization != null;
        for (ItemRow row : rows) {
            CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(row.catalogItemRef());
            if (catalogOwnerRead) {
                if (fact == null
                        || !"ENABLED".equals(fact.status())
                        || !supportedCatalogShape(fact.shapeKey())
                        || fact.itemName() == null
                        || fact.itemCode() == null) {
                    blockers.add(new SalesMenuReadback.PublicationBlocker(
                            SalesMenuPublicationBlockerKind.CATALOG_ITEM_INVALID,
                            row.salesItemRef(),
                            "salesMenu.catalogItem.invalid"));
                    continue;
                }
                List<SkuRow> selectedSkus = skuByItem.getOrDefault(row.salesItemRef(), List.of());
                if (contentKind(row.resolvedProductShape()) != contentKind(fact.shapeKey())) {
                    blockers.add(new SalesMenuReadback.PublicationBlocker(
                            SalesMenuPublicationBlockerKind.CATALOG_ITEM_INVALID,
                            row.salesItemRef(),
                            "salesMenu.saleContent.invalid"));
                } else if (contentKind(fact.shapeKey()) == SalesMenuSaleContentKind.SKU_SELECTION) {
                    if (row.listedPriceCents() != null) {
                        blockers.add(new SalesMenuReadback.PublicationBlocker(
                                SalesMenuPublicationBlockerKind.CATALOG_ITEM_INVALID,
                                row.salesItemRef(),
                                "salesMenu.saleContent.invalid"));
                    }
                    validatePublishedSkuFacts(row, fact, selectedSkus, blockers);
                } else if (!selectedSkus.isEmpty()) {
                    blockers.add(new SalesMenuReadback.PublicationBlocker(
                            SalesMenuPublicationBlockerKind.CATALOG_ITEM_INVALID,
                            row.salesItemRef(),
                            "salesMenu.saleContent.invalid"));
                }
                validatePublishedOrderOptionFacts(
                        row, fact, orderOptionsByItem.getOrDefault(row.salesItemRef(), List.of()), blockers);
                if (contentKind(fact.shapeKey()) != SalesMenuSaleContentKind.SKU_SELECTION
                        && row.listedPriceCents() == null) {
                    blockers.add(new SalesMenuReadback.PublicationBlocker(
                            SalesMenuPublicationBlockerKind.LISTED_PRICE_MISSING,
                            row.salesItemRef(),
                            "salesMenu.listedPrice.required"));
                }
            } else if (row.resolvedItemName() == null || row.resolvedItemCode() == null) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.CATALOG_ITEM_INVALID,
                        row.salesItemRef(),
                        "salesMenu.catalogItem.invalid"));
            }
            try {
                SalesMenuSaleContentKind kind =
                        contentKind(fact == null ? row.resolvedProductShape() : fact.shapeKey());
                SalesMenuOrderingConstraints constraints = ordering(row);
                if (kind == SalesMenuSaleContentKind.WEIGHTED
                        && (constraints.minItemQuantity() != null || constraints.quantityStep() != null)) {
                    blockers.add(new SalesMenuReadback.PublicationBlocker(
                            SalesMenuPublicationBlockerKind.ORDERING_CONSTRAINT_INVALID,
                            row.salesItemRef(),
                            "salesMenu.orderingConstraints.invalid"));
                }
            } catch (RuntimeException invalidConstraints) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.ORDERING_CONSTRAINT_INVALID,
                        row.salesItemRef(),
                        "salesMenu.orderingConstraints.invalid"));
            }
            if (("CUSTOM".equals(row.displayMediaMode())
                            && mediaByItem.getOrDefault(row.salesItemRef(), List.of()).stream()
                                    .anyMatch(invalidAssetRefsFromOwner::contains))
                    || (!"CUSTOM".equals(row.displayMediaMode())
                            && !"INHERIT_CATALOG".equals(row.displayMediaMode()))) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.DISPLAY_ASSET_PENDING_OR_INVALID,
                        row.salesItemRef(),
                        "salesMenu.displayMedia.invalid"));
            }
        }
        if (menu.draftSchedule() == null) {
            blockers.add(new SalesMenuReadback.PublicationBlocker(
                    SalesMenuPublicationBlockerKind.SCHEDULE_INVALID, null, "salesMenu.schedule.invalid"));
        }
        return new PublicationValidation(
                currentDraftVersion, rows, facts, skuByItem, orderOptionsByItem, mediaByItem, List.copyOf(blockers));
    }

    private void validatePublishedSkuFacts(
            ItemRow row,
            CatalogOwnerApi.SalesMenuItemFacts fact,
            List<SkuRow> selected,
            List<SalesMenuReadback.PublicationBlocker> blockers) {
        if (contentKind(fact.shapeKey()) != SalesMenuSaleContentKind.SKU_SELECTION) return;
        if (selected.isEmpty()) {
            blockers.add(new SalesMenuReadback.PublicationBlocker(
                    SalesMenuPublicationBlockerKind.SKU_SELECTION_EMPTY,
                    row.salesItemRef(),
                    "salesMenu.skuSelection.empty"));
            return;
        }
        for (SkuRow selectedSku : selected) {
            CatalogOwnerApi.SalesMenuSkuFact catalogSku = fact.skus().stream()
                    .filter(candidate -> selectedSku.skuRef().equals(candidate.productSkuRef()))
                    .findFirst()
                    .orElse(null);
            if (catalogSku == null
                    || !"ENABLED".equals(catalogSku.status())
                    || catalogSku.standardSalePrice() == null) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.SKU_INVALID, row.salesItemRef(), "salesMenu.sku.invalid"));
            }
            if (selectedSku.listedPriceCents() < 0) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.LISTED_PRICE_MISSING,
                        row.salesItemRef(),
                        "salesMenu.listedPrice.required"));
            }
        }
    }

    private void validatePublishedOrderOptionFacts(
            ItemRow row,
            CatalogOwnerApi.SalesMenuItemFacts fact,
            List<SalesMenuReadback.SalesMenuOrderOption> selected,
            List<SalesMenuReadback.PublicationBlocker> blockers) {
        if (contentKind(fact.shapeKey()) != SalesMenuSaleContentKind.DIRECT) {
            if (!selected.isEmpty()
                    || (fact.orderOptions() != null && !fact.orderOptions().isEmpty())) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.ORDER_OPTION_SELECTION_INVALID,
                        row.salesItemRef(),
                        "salesMenu.orderOptionSelection.invalid"));
            }
            return;
        }
        List<CatalogOwnerApi.SalesMenuOrderOptionFact> catalogOptions =
                fact.orderOptions() == null ? List.of() : fact.orderOptions();
        Map<UUID, CatalogOwnerApi.SalesMenuOrderOptionFact> catalogByRef = new LinkedHashMap<>();
        catalogOptions.forEach(option -> catalogByRef.put(option.definitionRef(), option));
        Map<UUID, SalesMenuReadback.SalesMenuOrderOption> selectedByRef = new LinkedHashMap<>();
        boolean duplicate = false;
        for (var option : selected) duplicate |= selectedByRef.put(option.definitionRef(), option) != null;
        if (duplicate || !catalogByRef.keySet().equals(selectedByRef.keySet())) {
            blockers.add(new SalesMenuReadback.PublicationBlocker(
                    SalesMenuPublicationBlockerKind.ORDER_OPTION_SELECTION_INVALID,
                    row.salesItemRef(),
                    "salesMenu.orderOptionSelection.invalid"));
            return;
        }
        for (var catalogOption : catalogOptions) {
            var snapshot = selectedByRef.get(catalogOption.definitionRef());
            Set<UUID> selectedValueRefs = snapshot.values().stream()
                    .map(SalesMenuReadback.SalesMenuOrderOptionValue::definitionValueRef)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            if (selectedValueRefs.size() != snapshot.values().size()) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.ORDER_OPTION_SELECTION_INVALID,
                        row.salesItemRef(),
                        "salesMenu.orderOptionSelection.invalid"));
                continue;
            }
            Set<UUID> currentValueRefs = catalogOption.values().stream()
                    .map(CatalogOwnerApi.SalesMenuOrderOptionValueFact::definitionValueRef)
                    .collect(java.util.stream.Collectors.toSet());
            int minimum = catalogOption.minSelectionCount() == null
                    ? (catalogOption.required() ? 1 : 0)
                    : catalogOption.minSelectionCount();
            if (!currentValueRefs.containsAll(selectedValueRefs) || selectedValueRefs.size() < minimum) {
                blockers.add(new SalesMenuReadback.PublicationBlocker(
                        SalesMenuPublicationBlockerKind.ORDER_OPTION_SELECTION_INVALID,
                        row.salesItemRef(),
                        "salesMenu.orderOptionSelection.invalid"));
            }
        }
    }

    private SalesMenuOwnerApi.Problem publicationInvalid(List<SalesMenuReadback.PublicationBlocker> blockers) {
        SalesMenuPublicationBlockerKind kind = blockers.getFirst().kind();
        String code =
                switch (kind) {
                    case STORE_DISABLED -> "SALES_MENU_STORE_DISABLED";
                    case CHANNEL_DISABLED -> "SALES_MENU_CHANNEL_DISABLED";
                    case CHANNEL_INELIGIBLE -> "SALES_MENU_CHANNEL_INELIGIBLE";
                    case CATALOG_ITEM_INVALID -> "SALES_MENU_ITEM_REFERENCE_INVALID";
                    case SKU_SELECTION_EMPTY, SKU_INVALID -> "SALES_MENU_SKU_REFERENCE_INVALID";
                    case ORDER_OPTION_SELECTION_INVALID -> "SALES_MENU_ORDER_OPTION_SELECTION_INVALID";
                    case LISTED_PRICE_MISSING -> "SALES_MENU_PRICE_REQUIRED";
                    case ORDERING_CONSTRAINT_INVALID -> "SALES_MENU_CONSTRAINT_INVALID";
                    case DISPLAY_ASSET_PENDING_OR_INVALID -> "SALES_MENU_ASSET_INVALID";
                    case SCHEDULE_INVALID -> "SALES_MENU_SCHEDULE_INVALID";
                };
        return problem(code, 422, "销售菜单草稿未通过发布校验");
    }

    private void copyPublicationRows(UUID publishedVersion, PublicationValidation validation, UUID collectionRef) {
        persistence.copyPublishedSections(publishedVersion, validation.draftVersion());
        insertPublicationItems(publishedVersion, validation.rows(), validation.facts(), collectionRef);
        insertPublicationSkus(publishedVersion, validation.rows(), validation.facts(), validation.skuByItem());
        insertPublicationOrderOptions(publishedVersion, validation.orderOptionsByItem());
        insertPublicationMedia(publishedVersion, validation.rows(), validation.mediaByItem());
    }

    private void insertPublicationOrderOptions(
            UUID publishedVersion, Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> orderOptionsByItem) {
        for (var entry : orderOptionsByItem.entrySet()) {
            for (var option : entry.getValue()) {
                persistence.insertPublishedOrderOption(publishedVersion, entry.getKey(), option);
                for (var value : option.values())
                    persistence.insertPublishedOrderOptionValue(
                            publishedVersion, entry.getKey(), option.definitionRef(), value);
            }
        }
    }

    private void insertPublicationItems(
            UUID publishedVersion,
            List<ItemRow> rows,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            UUID collectionRef) {
        List<PublicationItemSeed> items = new ArrayList<>(rows.size());
        for (ItemRow row : rows) {
            CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(row.catalogItemRef());
            var salesUnit = fact == null ? null : fact.salesUnitSnapshot();
            items.add(new PublicationItemSeed(
                    publishedVersion,
                    row.salesItemRef(),
                    row.sectionRef(),
                    collectionRef,
                    row.displayOrder(),
                    row.displayNameOverride(),
                    fact == null ? row.resolvedItemName() : fact.itemName(),
                    fact == null ? row.resolvedItemCode() : fact.itemCode(),
                    fact == null ? row.resolvedProductShape() : fact.shapeKey(),
                    salesUnit == null ? null : salesUnit.unitRef(),
                    salesUnit == null ? null : salesUnit.code(),
                    salesUnit == null ? null : salesUnit.name(),
                    salesUnit == null ? null : salesUnit.unitDimension(),
                    salesUnit == null ? null : salesUnit.precision(),
                    row.listedPriceCents(),
                    row.orderingConstraintsJson(),
                    row.displayMediaMode(),
                    "INHERIT_CATALOG".equals(row.displayMediaMode()) && fact != null
                            ? fact.defaultImageAssetRef()
                            : null,
                    "INHERIT_CATALOG".equals(row.displayMediaMode()) && fact != null
                            ? writeJson(fact.imageAssetRefs())
                            : writeJson(List.of())));
        }
        persistence.insertPublishedItems(items);
    }

    private void insertPublicationSkus(
            UUID publishedVersion,
            List<ItemRow> rows,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            Map<UUID, List<SkuRow>> skuByItem) {
        List<PublicationSkuSeed> skus = new ArrayList<>();
        for (ItemRow row : rows) {
            CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(row.catalogItemRef());
            for (SkuRow selected : skuByItem.getOrDefault(row.salesItemRef(), List.of())) {
                CatalogOwnerApi.SalesMenuSkuFact factSku = fact == null
                        ? null
                        : fact.skus().stream()
                                .filter(candidate -> selected.skuRef().equals(candidate.productSkuRef()))
                                .findFirst()
                                .orElse(null);
                skus.add(new PublicationSkuSeed(
                        publishedVersion,
                        row.salesItemRef(),
                        selected.skuRef(),
                        selected.listedPriceCents(),
                        factSku == null ? selected.resolvedSkuCode() : factSku.skuCode(),
                        factSku == null ? selected.resolvedSkuName() : factSku.skuName(),
                        factSku == null ? selected.defaultPriceCents() : factSku.standardSalePrice(),
                        selected.displayOrder()));
            }
        }
        persistence.insertPublishedSkus(skus);
    }

    private void insertPublicationMedia(UUID publishedVersion, List<ItemRow> rows, Map<UUID, List<UUID>> mediaByItem) {
        List<PublicationMediaSeed> media = new ArrayList<>();
        for (ItemRow row : rows) {
            List<UUID> mediaRefs = mediaByItem.getOrDefault(row.salesItemRef(), List.of());
            for (int index = 0; index < mediaRefs.size(); index++) {
                media.add(new PublicationMediaSeed(publishedVersion, row.salesItemRef(), mediaRefs.get(index), index));
            }
        }
        persistence.insertPublishedMedia(media);
    }

    private void insertVersion(
            UUID version,
            UUID menu,
            SalesMenuVersionKind kind,
            long revision,
            SalesMenuSchedule schedule,
            UUID sourceDraft,
            Long sourceDraftRevision) {
        persistence.insertVersion(
                version,
                menu,
                kind,
                revision,
                schedule,
                sourceDraft,
                sourceDraftRevision);
    }

    private List<ItemRow> itemRows(SalesMenuTarget target, SalesMenuVersionKind kind, UUID section, UUID itemRef) {
        requireMenu(target, false);
        return itemRows(target.salesMenuRef(), kind, section, itemRef);
    }

    private List<ItemRow> itemRows(SalesMenuAggregate menu, SalesMenuVersionKind kind, UUID section, UUID itemRef) {
        return itemRows(menu.salesMenuRef(), kind, section, itemRef);
    }

    private List<ItemRow> itemRows(
            SalesMenuAggregate menu, SalesMenuVersionKind kind, UUID version, UUID section, UUID itemRef) {
        return itemRows(version, section, itemRef);
    }

    private List<ItemRow> itemRows(UUID menuRef, SalesMenuVersionKind kind, UUID section, UUID itemRef) {
        UUID version = kind == SalesMenuVersionKind.DRAFT ? draftVersion(menuRef) : publishedVersion(menuRef);
        return itemRows(version, section, itemRef);
    }

    private List<ItemRow> itemRows(UUID version, UUID section, UUID itemRef) {
        return persistence.readVersionItemRows(version, section, itemRef);
    }

    private Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptionsByItem(List<ItemRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs =
                rows.stream().map(ItemRow::salesItemRef).distinct().toList();
        List<OrderOptionGroupRow> groups = persistence.readItemOrderOptionGroups(rows.getFirst().versionRef(), itemRefs);
        if (groups.isEmpty()) return Map.of();
        List<OrderOptionValueRow> values = persistence.readItemOrderOptionValues(rows.getFirst().versionRef(), itemRefs);
        Map<OptionKey, List<OrderOptionValueRow>> valuesByGroup = new LinkedHashMap<>();
        values.forEach(value -> valuesByGroup
                .computeIfAbsent(
                        new OptionKey(value.salesItemRef(), value.definitionRef()), ignored -> new ArrayList<>())
                .add(value));
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> result = new LinkedHashMap<>();
        for (OrderOptionGroupRow group : groups) {
            List<SalesMenuReadback.SalesMenuOrderOptionValue> optionValues =
                    valuesByGroup
                            .getOrDefault(new OptionKey(group.salesItemRef(), group.definitionRef()), List.of())
                            .stream()
                            .map(value -> new SalesMenuReadback.SalesMenuOrderOptionValue(
                                    value.definitionValueRef(),
                                    value.name(),
                                    Math.toIntExact(value.displayOrder()),
                                    value.defaultValue(),
                                    value.extraPrice()))
                            .toList();
            result.computeIfAbsent(group.salesItemRef(), ignored -> new ArrayList<>())
                    .add(new SalesMenuReadback.SalesMenuOrderOption(
                            group.definitionRef(),
                            group.name(),
                            group.selectionMode(),
                            Math.toIntExact(group.displayOrder()),
                            group.required(),
                            group.minSelectionCount(),
                            group.maxSelectionCount(),
                            optionValues));
        }
        result.replaceAll((ignored, options) -> List.copyOf(options));
        return Map.copyOf(result);
    }

    private SalesMenuOrderingConstraints ordering(ItemRow row) {
        try {
            com.fasterxml.jackson.databind.JsonNode value = json.readTree(row.orderingConstraintsJson());
            if (value == null || !value.isObject()) {
                throw new IllegalArgumentException("ordering constraints must be an object");
            }
            Integer minimum = integerConstraint(value, "minItemQuantity");
            Integer step = integerConstraint(value, "quantityStep");
            return new SalesMenuOrderingConstraints(minimum, step);
        } catch (Exception failure) {
            throw problem("SALES_MENU_DATA_CORRUPT", 500, "排序约束数据损坏", failure);
        }
    }

    private Integer integerConstraint(com.fasterxml.jackson.databind.JsonNode value, String field) {
        com.fasterxml.jackson.databind.JsonNode node = value.get(field);
        if (node == null || node.isNull()) return null;
        if (!node.isIntegralNumber() || !node.canConvertToInt()) {
            throw new IllegalArgumentException(field + " must be an integer");
        }
        return node.intValue();
    }

    private Map<UUID, List<SkuRow>> skuRowsByItem(List<ItemRow> rows) {
        return persistedSkuRowsByItem(rows, false);
    }

    private Map<UUID, List<SkuRow>> persistedSkuRowsByItem(List<ItemRow> rows) {
        return persistedSkuRowsByItem(rows, true);
    }

    private Map<UUID, List<SkuRow>> persistedSkuRowsByItem(List<ItemRow> rows, boolean allowWithoutOwnerApis) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs =
                rows.stream().map(ItemRow::salesItemRef).distinct().toList();
        if (!allowWithoutOwnerApis && catalog == null && organization == null) return Map.of();
        Map<UUID, List<SkuRow>> result = new LinkedHashMap<>();
        persistence.readItemSkuRows(rows.getFirst().versionRef(), itemRefs)
                .forEach(row -> result.computeIfAbsent(row.salesItemRef(), ignored -> new ArrayList<>())
                        .add(row));
        result.replaceAll((ignored, values) -> List.copyOf(values));
        return Map.copyOf(result);
    }

    private Map<UUID, List<UUID>> mediaByItem(List<ItemRow> rows) {
        return mediaByItem(rows, true);
    }

    private Map<UUID, List<UUID>> mediaByItem(List<ItemRow> rows, boolean validateAssets) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs =
                rows.stream().map(ItemRow::salesItemRef).distinct().toList();
        Map<UUID, List<UUID>> result = new HashMap<>();
        persistence.readItemMediaRows(rows.getFirst().versionRef(), itemRefs)
                .forEach(row -> result.computeIfAbsent(row.salesItemRef(), ignored -> new ArrayList<>())
                        .add(row.assetRef()));
        result.replaceAll((ignored, refs) -> List.copyOf(refs));
        if (validateAssets) validateAssetFacts(result);
        return Map.copyOf(result);
    }

    private void validateAssetFacts(Map<UUID, List<UUID>> mediaByItem) {
        if (assets == null) return;
        if (!invalidAssetRefs(mediaByItem).isEmpty()) {
            throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片资源无效");
        }
    }

    private Set<UUID> invalidAssetRefs(Map<UUID, List<UUID>> mediaByItem) {
        Set<UUID> assetRefs = mediaByItem.values().stream()
                .flatMap(List::stream)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (assets == null || assetRefs.isEmpty()) return Set.of();
        Map<UUID, SalesMenuAssetReadApi.SalesMenuItemImage> facts = assets.readSalesMenuItemImages(assetRefs);
        return assetRefs.stream()
                .filter(assetRef -> {
                    SalesMenuAssetReadApi.SalesMenuItemImage fact = facts.get(assetRef);
                    return fact == null
                            || fact.usage() == null
                            || !"SALES_MENU_ITEM_IMAGE".equals(fact.usage().name())
                            || !"ACTIVE".equals(fact.status());
                })
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private SalesMenuDisplayMedia displayMedia(ItemRow row, List<UUID> refs) {
        return new SalesMenuDisplayMedia(
                "CUSTOM".equals(row.displayMediaMode())
                        ? SalesMenuDisplayMediaMode.CUSTOM
                        : SalesMenuDisplayMediaMode.INHERIT_CATALOG,
                refs,
                refs.isEmpty() ? null : refs.getFirst());
    }

    private SalesMenuSaleContentKind contentKind(String shape) {
        if ("SKU_VARIANT_SALE_COUNTED".equals(shape)
                || "SKU".equalsIgnoreCase(shape)
                || "SKU_SELECTION".equalsIgnoreCase(shape)) return SalesMenuSaleContentKind.SKU_SELECTION;
        if ("STANDARD_SALE_WEIGHED".equals(shape) || "WEIGHTED".equalsIgnoreCase(shape))
            return SalesMenuSaleContentKind.WEIGHTED;
        if ("COMPOSITE".equalsIgnoreCase(shape)) return SalesMenuSaleContentKind.COMPOSITE;
        return SalesMenuSaleContentKind.DIRECT;
    }

    private UUID draftVersion(UUID menu) {
        return persistence.readDraftVersion(menu)
                .orElseThrow(() -> problem("SALES_MENU_NOT_FOUND", 404, "销售菜单不存在"));
    }

    private UUID publishedVersion(UUID menu) {
        return persistence.readLatestPublishedVersion(menu)
                .orElseThrow(() -> problem("PUBLICATION_NOT_FOUND", 404, "尚无发布版本"));
    }

    private Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> catalogFacts(SalesMenuScope scope, Set<UUID> itemRefs) {
        if (catalog == null || organization == null || itemRefs.isEmpty()) return Map.of();
        return catalogFacts(scope, itemRefs, requireStore(scope));
    }

    private Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> catalogFacts(
            SalesMenuScope scope, Set<UUID> itemRefs, OrganizationOwnerApi.SalesMenuStoreJudgment store) {
        if (catalog == null || organization == null || itemRefs.isEmpty()) return Map.of();
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts =
                catalog.readSalesMenuItemFacts(store.dataNodeRef(), store.brandRef(), itemRefs);
        return facts == null ? Map.of() : facts;
    }

    private boolean supportedCatalogShape(String shape) {
        return "STANDARD_SALE_COUNTED".equals(shape)
                || "SKU_VARIANT_SALE_COUNTED".equals(shape)
                || "STANDARD_SALE_WEIGHED".equals(shape)
                || "COMPOSITE".equals(shape)
                || "SERVICE".equals(shape)
                || "DIRECT".equalsIgnoreCase(shape)
                || "SKU".equalsIgnoreCase(shape)
                || "WEIGHTED".equalsIgnoreCase(shape);
    }

    private List<UUID> activationChannels(UUID menu) {
        return persistence.readEnabledActivationChannels(menu);
    }

    private OrganizationOwnerApi.SalesMenuStoreJudgment requireOwnerCommand(
            SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        OrganizationOwnerApi.SalesMenuStoreJudgment store = requireStore(context.scope());
        if (channelRef != null) requireChannel(context.scope(), channelRef);
        return store;
    }

    private void requireCas(SalesMenuTarget target, long expectedVersion) {
        if (ownerApisConfigured() && !persistence.compareAndSetVersion(target, expectedVersion)) {
            throw problem("SALES_MENU_VERSION_CONFLICT", 409, "销售菜单版本已变化");
        }
    }

    private boolean ownerApisConfigured() {
        return catalog != null && inventory != null && channels != null && organization != null;
    }

    private void requireNotArchived(com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu) {
        if (menu.archived()) throw problem("SALES_MENU_ARCHIVED", 409, "已归档销售菜单不可修改");
    }

    private OrganizationOwnerApi.SalesMenuStoreJudgment requireStore(SalesMenuScope scope) {
        if (organization == null) return null;
        OrganizationOwnerApi.SalesMenuStoreJudgment judgment =
                organization.requireSalesMenuStore(scope.workspaceUuid(), scope.groupWorkspaceKey(), scope.storeRef());
        if (!scope.storeRef().equals(judgment.storeRef())) {
            throw problem("SALES_MENU_SCOPE_MISMATCH", 403, "门店不属于当前销售菜单范围");
        }
        return judgment;
    }

    private BusinessChannelOwnerApi.SalesMenuChannelJudgment requireChannel(SalesMenuScope scope, UUID channelRef) {
        if (channels == null) return null;
        BusinessChannelOwnerApi.SalesMenuChannelJudgment judgment;
        try {
            judgment = channels.requireSalesMenuChannel(
                    scope.workspaceUuid(),
                    scope.groupWorkspaceKey(),
                    scope.storeRef().toString(),
                    channelRef);
        } catch (BusinessChannelCommandApi.Problem failure) {
            if ("SALES_MENU_CHANNEL_INELIGIBLE".equals(failure.code())) {
                throw problem("SALES_MENU_CHANNEL_INELIGIBLE", 422, "业务渠道不符合销售菜单要求", failure);
            }
            throw failure;
        }
        if (!channelRef.equals(judgment.channelRef())
                || !scope.storeRef().toString().equals(judgment.storeRef())
                || !"INTERNAL".equals(judgment.accessKind())
                || !"STORE".equals(judgment.operatorKind())
                || !("DINE_IN".equals(judgment.orderKind()) || "TAKEAWAY".equals(judgment.orderKind()))) {
            throw problem("SALES_MENU_CHANNEL_INELIGIBLE", 422, "业务渠道不符合销售菜单要求");
        }
        return judgment;
    }

    private com.catering.v2s.salesmenu.domain.SalesMenuAggregate requireMenu(SalesMenuTarget target, boolean lock) {
        return (lock ? persistence.findForUpdate(target) : persistence.find(target))
                .orElseThrow(() -> problem("SALES_MENU_NOT_FOUND", 404, "销售菜单不存在"));
    }

    private void requireGrant(SalesMenuOwnerApi.CommandContext context, boolean menuTarget) {
        requireGrant(context.scope(), context.ownerScopeGrant(), context.contextVersion());
        if (menuTarget && context.salesMenuRef() == null) {
            throw problem("TARGET_REQUIRED", 422, "销售菜单目标缺失");
        }
    }

    private void requireGrant(SalesMenuScope scope, OperationsOwnerScopeGrant grant, long contextVersion) {
        if (!grant.matchesCapability(
                scope.workspaceUuid(), scope.groupWorkspaceKey(), "STORE", scope.storeRef(), CAPABILITY))
            throw problem("GRANT_INVALID", 403, "销售菜单授权无效");
        if (grant.expectedContextVersion() >= 0 && !grant.matchesExpectedContextVersion(contextVersion))
            throw problem("CONTEXT_STALE", 409, "授权上下文已变化");
    }

    private void requireGrant(SalesMenuAssetTarget target, OperationsOwnerScopeGrant grant, long contextVersion) {
        requireGrant(
                new SalesMenuScope(grant.workspaceUuid(), target.groupWorkspaceKey(), target.storeRef()),
                grant,
                contextVersion);
    }

    private void recordSuccess(
            String operation, SalesMenuOwnerApi.CommandContext context, UUID channel, UUID menu, UUID target) {
        recordSuccess(operation, context, channel, menu, target, null, null);
    }

    private void recordSuccess(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            UUID channel,
            UUID menu,
            UUID target,
            String targetKind,
            String targetDisplaySnapshot) {
        persistence.recordSuccess(
                UUID.randomUUID(),
                context.scope().workspaceUuid(),
                context.scope().groupWorkspaceKey(),
                context.scope().storeRef(),
                channel,
                menu,
                operation,
                target,
                targetKind,
                targetDisplaySnapshot,
                SalesMenuOperationResult.SUCCESS.name(),
                context.actor().actorType(),
                context.actor().actorId(),
                context.actor().displaySnapshot(),
                time.currentEpochMillis(),
                context.idempotencyKey());
    }

    private SalesMenuReadback.Command command(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            UUID menu,
            UUID target,
            SalesMenuCommandReadbackStatus status) {
        SalesMenuAggregate persisted = persistence
                .find(new SalesMenuTarget(context.scope(), menu))
                .orElseThrow(() -> problem("SALES_MENU_RESULT_UNKNOWN", 503, "销售菜单命令结果无法读取"));
        return new SalesMenuReadback.Command(operation, persisted.salesMenuRef(), target, persisted.version(), status);
    }

    private String writeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception failure) {
            throw problem("JSON_SERIALIZATION_FAILED", 500, "销售菜单数据序列化失败", failure);
        }
    }

    private String hash(Object value) {
        try {
            return Sha256Hex.digest(writeJson(value));
        } catch (Exception failure) {
            throw problem("HASH_FAILED", 500, "销售菜单命令摘要失败", failure);
        }
    }

    private SalesMenuSchedule schedule(String kind, LocalTime start, LocalTime end) {
        if (kind == null || "ALL_DAY".equals(kind)) return SalesMenuSchedule.allDay();
        return SalesMenuSchedule.daily(start, end);
    }

    private static SalesMenuOwnerApi.Problem problem(String code, int status, String message) {
        return new SalesMenuOwnerApi.Problem(code, status, message);
    }

    private static SalesMenuOwnerApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new SalesMenuOwnerApi.Problem(code, status, message, cause);
    }

    private static boolean draftDirty(long draftRevision, Long latestPublishedSourceDraftRevision) {
        return latestPublishedSourceDraftRevision == null || draftRevision != latestPublishedSourceDraftRevision;
    }

    private record MenuCommandLock(
            SalesMenuAggregate menu, OrganizationOwnerApi.SalesMenuStoreJudgment store) {}

    private record PublishPreflight(SalesMenuAggregate menu, PublicationValidation validation) {}

    private record PublicationValidation(
            UUID draftVersion,
            List<ItemRow> rows,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            Map<UUID, List<SkuRow>> skuByItem,
            Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> orderOptionsByItem,
            Map<UUID, List<UUID>> mediaByItem,
            List<SalesMenuReadback.PublicationBlocker> blockers) {}

    private record OptionKey(UUID salesItemRef, UUID definitionRef) {}

}
