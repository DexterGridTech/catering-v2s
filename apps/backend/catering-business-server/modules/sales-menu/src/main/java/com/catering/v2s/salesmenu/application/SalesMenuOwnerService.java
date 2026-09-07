package com.catering.v2s.salesmenu.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
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
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTargetKind;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleState;
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
import com.catering.v2s.salesmenu.domain.SalesMenuSelectedOrderOption;
import com.catering.v2s.salesmenu.domain.SalesMenuSelectedOrderOptionValue;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionQuery;
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
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

/** Transactional owner implementation for menu definitions, publications and manual sale facts. */
@Service
public class SalesMenuOwnerService implements SalesMenuOwnerApi, SalesMenuCommandApi {
    private static final String CAPABILITY = "EDIT_STORE_SALES_MENU";
    private static final String DEFAULT_SECTION = "未分组";
    private static final String MENU_LIST_OPERATION = "getOperationsSalesMenus";
    private static final String DRAFT_ITEM_LIST_OPERATION = "getOperationsSalesMenuDraftItems";
    private static final String PUBLISHED_ITEM_LIST_OPERATION = "getOperationsSalesMenuPublishedItems";
    private static final String OPERATION_RECORD_LIST_OPERATION = "getOperationsSalesMenuOperationRecords";
    private static final String CATALOG_CANDIDATE_CONTEXT_REQUIRED_PREFIX = "读取商品候选需要目录 ";
    private static final String CATALOG_CANDIDATE_CONTEXT_REQUIRED_SUFFIX = "owner 的任务上下文";
    private static final String CATALOG_CANDIDATE_CONTEXT_REQUIRED =
            CATALOG_CANDIDATE_CONTEXT_REQUIRED_PREFIX + CATALOG_CANDIDATE_CONTEXT_REQUIRED_SUFFIX;
    private static final String SKU_REFERENCE_INVALID_MESSAGE = "商品规格引用无效";
    private static final String INHERITED_IMAGE_BINDING_PREFIX = "沿用商品图片不可携带菜单";
    private static final String INHERITED_IMAGE_BINDING_SUFFIX = "图片绑定凭证";
    private static final String INHERITED_IMAGE_BINDING_MESSAGE =
            INHERITED_IMAGE_BINDING_PREFIX + INHERITED_IMAGE_BINDING_SUFFIX;
    private static final Set<String> REJECTED_OPERATION_TARGET_MAY_BE_MISSING =
            Set.of("SALES_MENU_NOT_FOUND", "SALES_MENU_SCOPE_MISMATCH");
    private final SalesMenuRepository repository;
    private final TimeProvider time;
    private final ObjectMapper json;
    private final CatalogOwnerApi catalog;
    private final InventoryOwnerApi inventory;
    private final BusinessChannelOwnerApi channels;
    private final OrganizationOwnerApi organization;
    private final SalesMenuAssetReadApi assets;
    private final SalesMenuAssetCommandApi assetCommands;

    public SalesMenuOwnerService(SalesMenuRepository repository, TimeProvider time, ObjectMapper json) {
        this(repository, time, json, null, null, null, null, null, null);
    }

    @Autowired
    public SalesMenuOwnerService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets,
            SalesMenuAssetCommandApi assetCommands) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.time = Objects.requireNonNull(time, "time");
        this.json = Objects.requireNonNull(json, "json");
        this.catalog = catalog;
        this.inventory = inventory;
        this.channels = channels;
        this.organization = organization;
        this.assets = assets;
        this.assetCommands = assetCommands;
    }

    public SalesMenuOwnerService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization,
            SalesMenuAssetReadApi assets) {
        this(repository, time, json, catalog, inventory, channels, organization, assets, null);
    }

    @Override
    public SalesMenuReadback.MenuPage listMenus(SalesMenuListQuery query) {
        requireOwnerRead(query.scope(), query.channelRef());
        String filter = query.filter() == null ? "" : query.filter().trim();
        SalesMenuCursorIdentity identity = new SalesMenuCursorIdentity(
                MENU_LIST_OPERATION,
                query.scope(),
                query.channelRef(),
                null,
                null,
                null,
                "MANAGEMENT",
                filter,
                query.page().pageSize());
        OpaqueCollectionCursor.Position position = decodeCursor(query.page().cursor(), identity);
        List<Object> arguments = new ArrayList<>(List.of(
                query.channelRef(),
                query.scope().workspaceUuid(),
                query.scope().groupWorkspaceKey(),
                query.scope().storeRef(),
                "%" + filter + "%"));
        StringBuilder frontier = new StringBuilder();
        if (position != null) {
            frontier.append(" AND (c.name > ? OR (c.name = ? AND c.collection_ref > ?))");
            arguments.add(position.sortKey());
            arguments.add(position.sortKey());
            arguments.add(position.tieBreaker());
        }
        arguments.add(query.page().pageSize() + 1);
        List<MenuListRow> rows = repository.query(
                "SELECT c.collection_ref,c.store_ref,c.name,c.archived_at_epoch_millis,c.version,"
                        + "d.revision draft_revision,"
                        + "p.revision published_revision,"
                        + "publication.source_draft_revision latest_published_source_draft_revision,"
                        + "d.schedule_kind,d.schedule_start_local_time,"
                        + "d.schedule_end_local_time,"
                        + "a.channel_ref,a.status,a.version activation_version FROM sales_menu.sales_collection c "
                        + "JOIN sales_menu.sales_collection_version d ON d.version_ref=c.current_draft_version_ref "
                        + "LEFT JOIN sales_menu.sales_collection_version p "
                        + "ON p.version_ref=c.latest_published_version_ref "
                        + "LEFT JOIN sales_menu.sales_publication publication "
                        + "ON publication.published_version_ref=p.version_ref "
                        + "AND publication.collection_ref=c.collection_ref "
                        + "LEFT JOIN sales_menu.sales_collection_activation a "
                        + "ON a.collection_ref=c.collection_ref AND a.channel_ref=? "
                        + "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_ref=? AND c.name ILIKE ? "
                        + frontier
                        + " ORDER BY c.name,c.collection_ref LIMIT ?",
                SalesMenuOwnerService::menuListRow,
                arguments.toArray());
        boolean hasNext = rows.size() > query.page().pageSize();
        List<MenuListRow> page = hasNext ? rows.subList(0, query.page().pageSize()) : rows;
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity.value(), page.getLast().name(), page.getLast().collectionRef())
                : null;
        return new SalesMenuReadback.MenuPage(
                page.stream()
                        .map(row -> new SalesMenuReadback.MenuSummary(
                                row.collectionRef(),
                                row.storeRef(),
                                row.name(),
                                row.archivedAtEpochMillis() != null,
                                row.version(),
                                row.draftRevision(),
                                row.publishedRevision(),
                                draftDirty(row.draftRevision(), row.latestPublishedSourceDraftRevision()),
                                activation(row),
                                schedule(row.scheduleKind(), row.scheduleStart(), row.scheduleEnd())))
                        .toList(),
                query.page().cursor(),
                nextCursor);
    }

    @Override
    public SalesMenuReadback.MenuDetail readMenu(SalesMenuTarget target, UUID channelRef) {
        requireOwnerRead(target.scope(), channelRef);
        var menu = requireMenu(target, false);
        var activation = repository
                .query(
                        "SELECT channel_ref,status,version "
                                + "FROM sales_menu.sales_collection_activation "
                                + "WHERE collection_ref=? AND channel_ref=?",
                        SalesMenuOwnerService::activationRow,
                        target.salesMenuRef(),
                        channelRef)
                .stream()
                .findFirst()
                .map(row -> new SalesMenuReadback.Activation(row.channelRef(), row.status(), row.version()))
                .orElse(null);
        return new SalesMenuReadback.MenuDetail(
                menu.salesMenuRef(),
                menu.scope().groupWorkspaceKey(),
                menu.scope().storeRef(),
                menu.name(),
                menu.archived(),
                menu.version(),
                menu.draftRevision(),
                menu.latestPublishedRevision(),
                menu.draftDirty(),
                activation,
                menu.draftSchedule(),
                menu.latestPublishedSchedule());
    }

    @Override
    public SalesMenuReadback.SectionList listDraftSections(SalesMenuVersionQuery query) {
        return sections(query.menu(), SalesMenuVersionKind.DRAFT);
    }

    @Override
    public SalesMenuReadback.DraftItemPage listDraftItems(SalesMenuItemPageQuery query) {
        ItemPage page = pagedItemRows(query, SalesMenuVersionKind.DRAFT);
        return new SalesMenuReadback.DraftItemPage(
                draftItems(query.menu().scope(), page.rows()), query.page().cursor(), itemNextCursor(page));
    }

    @Override
    public SalesMenuReadback.DraftItemView readDraftItem(SalesMenuItemQuery query) {
        requireOwnerRead(query.item().menu().scope(), null);
        ItemRow itemRow =
                itemRows(
                                query.item().menu(),
                                SalesMenuVersionKind.DRAFT,
                                null,
                                query.item().salesItemRef())
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> problem("SALES_ITEM_NOT_FOUND", 404, "销售菜单商品不存在"));
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts =
                readDraftCatalogFacts(query.item().menu().scope(), List.of(itemRow));
        CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(itemRow.catalogItemRef());
        Map<UUID, List<SkuRow>> selectedSkuRows = skuRowsByItem(List.of(itemRow));
        return draftItem(
                itemRow,
                mediaByItem(List.of(itemRow)),
                selectedSkuRows,
                selectedOrderOptionsByItem(List.of(itemRow)),
                catalogOrderOptions(fact),
                skuCandidates(fact),
                staleSelectedSkuRefs(fact, selectedSkuRows
                        .getOrDefault(itemRow.salesItemRef(), List.of())),
                catalogSalesUnit(fact),
                fact == null ? null : fact.defaultPriceCents(),
                fact == null ? null : fact.defaultImageAssetRef());
    }

    @Override
    public SalesMenuReadback.SectionList listPublishedSections(SalesMenuVersionQuery query) {
        return sections(query.menu(), SalesMenuVersionKind.PUBLISHED);
    }

    @Override
    public SalesMenuReadback.PublishedItemPage listPublishedItems(SalesMenuItemPageQuery query) {
        ItemPage page = pagedItemRows(query, SalesMenuVersionKind.PUBLISHED);
        Map<UUID, List<UUID>> mediaByItem = mediaByItem(page.rows());
        Map<UUID, List<SkuRow>> skuByItem = skuRowsByItem(page.rows());
        Map<ManualTargetKey, ManualSaleStatusRow> manualStatusByTarget =
                manualStatusByTarget(query.channelRef(), page.rows());
        Map<UUID, SalesMenuReadback.InventoryAvailabilityFact> inventoryByItem =
                inventoryAvailabilityByItem(query.menu().scope(), page.rows(), skuByItem);
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptions =
                selectedOrderOptionsByItem(page.rows());
        return new SalesMenuReadback.PublishedItemPage(
                page.rows().stream()
                        .map(row -> publishedItem(
                                row,
                                mediaByItem,
                                skuByItem,
                                manualStatusByTarget,
                                inventoryByItem,
                                selectedOrderOptions))
                        .toList(),
                query.page().cursor(),
                itemNextCursor(page));
    }

    @Override
    public SalesMenuReadback.PublishedItemView readPublishedItem(SalesMenuItemQuery query) {
        requireOwnerRead(query.item().menu().scope(), query.channelRef());
        ItemRow itemRow =
                itemRows(
                                query.item().menu(),
                                SalesMenuVersionKind.PUBLISHED,
                                null,
                                query.item().salesItemRef())
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> problem("SALES_ITEM_NOT_FOUND", 404, "销售菜单商品不存在"));
        Map<UUID, List<SkuRow>> skuByItem = skuRowsByItem(List.of(itemRow));
        return publishedItem(
                itemRow,
                mediaByItem(List.of(itemRow)),
                skuByItem,
                manualStatusByTarget(query.channelRef(), List.of(itemRow)),
                inventoryAvailabilityByItem(query.item().menu().scope(), List.of(itemRow), skuByItem),
                selectedOrderOptionsByItem(List.of(itemRow)));
    }

    @Override
    public SalesMenuReadback.CandidatePage listItemCandidates(SalesMenuCandidateQuery query) {
        var menu = requireMenu(query.menu(), false);
        OrganizationOwnerApi.SalesMenuStoreJudgment store =
                requireStore(query.menu().scope());
        if (catalog == null || store == null) {
            throw problem("CATALOG_CANDIDATE_CONTEXT_REQUIRED", 422, CATALOG_CANDIDATE_CONTEXT_REQUIRED);
        }
        CatalogOwnerApi.SalesMenuCandidatePage page =
                catalog.readSalesMenuCandidatePage(new CatalogOwnerApi.SalesMenuCandidatePageQuery(
                        store.dataNodeRef(),
                        store.brandRef(),
                        query.categoryRef(),
                        query.filter(),
                        query.page().cursor(),
                        20));
        Map<UUID, Long> counts = alreadyAddedCounts(
                menu.salesMenuRef(),
                draftVersion(menu.salesMenuRef()),
                page.items().stream()
                        .map(CatalogOwnerApi.SalesMenuCandidate::itemRef)
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        return new SalesMenuReadback.CandidatePage(
                page.items().stream()
                        .map(candidate -> new SalesMenuReadback.ItemCandidate(
                                candidate.itemRef(),
                                candidate.itemRef(),
                                candidate.itemCode(),
                                candidate.itemName(),
                                publicShape(candidate.shapeKey()),
                                candidate.categoryRefs(),
                                candidate.categoryNames(),
                                candidate.defaultPriceCents(),
                                counts.getOrDefault(candidate.itemRef(), 0L)))
                        .toList(),
                page.cursor(),
                page.nextCursor());
    }

    @Override
    public SalesMenuReadback.PublicationPreview publicationPreview(SalesMenuTarget target, UUID channelRef) {
        var menu = requireMenu(target, false);
        List<SalesMenuReadback.PublicationBlocker> blockers =
                publicationValidation(menu, channelRef).blockers();
        return new SalesMenuReadback.PublicationPreview(
                target.salesMenuRef(), menu.draftRevision(), menu.draftDirty(), blockers);
    }

    @Override
    public SalesMenuReadback.OperationRecordPage listOperationRecords(SalesMenuOperationQuery query) {
        requireOwnerRead(query.menu().scope(), query.channelRef());
        SalesMenuCursorIdentity identity = new SalesMenuCursorIdentity(
                OPERATION_RECORD_LIST_OPERATION,
                query.menu().scope(),
                query.channelRef(),
                query.menu().salesMenuRef(),
                null,
                null,
                "OPERATION_RECORDS",
                null,
                query.page().pageSize());
        OpaqueCollectionCursor.Position position = decodeCursor(query.page().cursor(), identity);
        List<Object> arguments = new ArrayList<>(List.of(
                query.menu().scope().workspaceUuid(),
                query.menu().scope().groupWorkspaceKey(),
                query.menu().scope().storeRef(),
                query.menu().salesMenuRef(),
                query.channelRef()));
        StringBuilder frontier = new StringBuilder();
        if (position != null) {
            long occurredAt = parseLongCursor(position, "occurredAt");
            frontier.append(
                    " AND (occurred_at_epoch_millis < ? OR " + "(occurred_at_epoch_millis = ? AND record_ref < ?))");
            arguments.add(occurredAt);
            arguments.add(occurredAt);
            arguments.add(position.tieBreaker());
        }
        arguments.add(query.page().pageSize() + 1);
        List<SalesMenuReadback.OperationRecord> records = repository
                .query(
                        "SELECT record_ref,occurred_at_epoch_millis,operation_kind,collection_ref,target_ref,target_kind,"
                                + "target_display_snapshot,result,failure_code,actor_display_snapshot "
                                + "FROM sales_menu.sales_operation_record "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? "
                                + "AND collection_ref=? AND (channel_ref IS NULL OR channel_ref=?)"
                                + frontier
                                + " ORDER BY occurred_at_epoch_millis DESC,record_ref DESC LIMIT ?",
                        SalesMenuOwnerService::operationRecordRow,
                        arguments.toArray())
                .stream()
                .map(row -> new SalesMenuReadback.OperationRecord(
                        row.recordRef(),
                        row.occurredAtEpochMillis(),
                        row.operationKind(),
                        row.collectionRef(),
                        row.targetRef(),
                        row.targetKind(),
                        row.targetDisplaySnapshot(),
                        SalesMenuOperationResult.valueOf(row.result()),
                        row.failureCode(),
                        row.actorDisplaySnapshot()))
                .toList();
        boolean hasNext = records.size() > query.page().pageSize();
        List<SalesMenuReadback.OperationRecord> page =
                hasNext ? records.subList(0, query.page().pageSize()) : records;
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity.value(),
                        Long.toString(page.getLast().occurredAt()),
                        page.getLast().operationRecordRef())
                : null;
        return new SalesMenuReadback.OperationRecordPage(page, query.page().cursor(), nextCursor);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command create(SalesMenuOwnerApi.CreateCommand command) {
        requireGrant(command.context(), false);
        return receipt(
                "createOperationsSalesMenu",
                command.context(),
                command,
                () -> {
                    preflightCreate(command.context(), command.channelRef());
                    return null;
                },
                ignored -> null,
                ignored -> {
                    UUID menu = UUID.randomUUID();
                    UUID draft = UUID.randomUUID();
                    repository.update(
                            "INSERT INTO sales_menu.sales_collection(collection_ref,workspace_uuid,group_workspace_key,"
                                    + "store_ref,name,version) VALUES(?,?,?,?,?,1)",
                            menu,
                            command.context().scope().workspaceUuid(),
                            command.context().scope().groupWorkspaceKey(),
                            command.context().scope().storeRef(),
                            command.name());
                    insertVersion(draft, menu, SalesMenuVersionKind.DRAFT, 0, SalesMenuSchedule.allDay(), null, null);
                    repository.update(
                            "UPDATE sales_menu.sales_collection SET current_draft_version_ref=? WHERE collection_ref=?",
                            draft,
                            menu);
                    repository.update(
                            "INSERT INTO sales_menu.sales_collection_activation(collection_ref,channel_ref,status,"
                                    + "version) VALUES(?,?,?,1)",
                            menu,
                            command.channelRef(),
                            SalesMenuActivationStatus.DISABLED.name());
                    SalesMenuReadback.Command readback = command(
                            "createOperationsSalesMenu",
                            command.context(),
                            menu,
                            menu,
                            SalesMenuCommandReadbackStatus.APPLIED);
                    recordSuccess("createOperationsSalesMenu", command.context(), command.channelRef(), menu, menu);
                    return readback;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command copy(SalesMenuOwnerApi.CopyCommand command) {
        requireGrant(command.context(), true);
        return receipt(
                "copyOperationsSalesMenu",
                command.context(),
                command,
                () -> lockMenuTarget(command.context(), null),
                source -> source,
                source -> {
                    requireCas(command.context().target(), command.expectedVersion());
                    UUID copy = UUID.randomUUID();
                    UUID draft = UUID.randomUUID();
                    String sourceName =
                            source.name().length() > 154 ? source.name().substring(0, 154) : source.name();
                    String name = sourceName + " 副本";
                    repository.update(
                            "INSERT INTO sales_menu.sales_collection(collection_ref,workspace_uuid,group_workspace_key,"
                                    + "store_ref,name,version) VALUES(?,?,?,?,?,1)",
                            copy,
                            source.scope().workspaceUuid(),
                            source.scope().groupWorkspaceKey(),
                            source.scope().storeRef(),
                            name);
                    insertVersion(draft, copy, SalesMenuVersionKind.DRAFT, 0, source.draftSchedule(), null, null);
                    repository.update(
                            "UPDATE sales_menu.sales_collection SET current_draft_version_ref=? WHERE collection_ref=?",
                            draft,
                            copy);
                    copyDraft(source.salesMenuRef(), copy, draft);
                    SalesMenuReadback.Command readback = command(
                            "copyOperationsSalesMenu",
                            command.context(),
                            copy,
                            copy,
                            SalesMenuCommandReadbackStatus.APPLIED);
                    recordSuccess("copyOperationsSalesMenu", command.context(), null, copy, copy);
                    return readback;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command rename(SalesMenuOwnerApi.RenameCommand command) {
        return mutate("renameOperationsSalesMenu", command.context(), command, command.expectedVersion(), () -> {
            repository.update(
                    "UPDATE sales_menu.sales_collection SET name=? WHERE collection_ref=?",
                    command.name(),
                    command.context().salesMenuRef());
            return SalesMenuCommandReadbackStatus.APPLIED;
        });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command archive(SalesMenuOwnerApi.ArchiveCommand command) {
        return mutate("archiveOperationsSalesMenu", command.context(), command, command.expectedVersion(), () -> {
            repository.update(
                    "UPDATE sales_menu.sales_collection SET archived_at_epoch_millis=? WHERE collection_ref=?",
                    time.currentEpochMillis(),
                    command.context().salesMenuRef());
            return SalesMenuCommandReadbackStatus.ARCHIVED;
        });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command setActivation(SalesMenuOwnerApi.ActivationCommand command) {
        return mutate(
                "setOperationsSalesMenuActivation",
                command.context(),
                command,
                command.expectedVersion(),
                command.channelRef(),
                () -> {
                    repository.update(
                            "INSERT INTO sales_menu.sales_collection_activation("
                                    + "collection_ref,channel_ref,status,version) "
                                    + "VALUES(?,?,?,1) ON CONFLICT (collection_ref,channel_ref) DO UPDATE SET "
                                    + "status=EXCLUDED.status,version=sales_menu.sales_collection_activation.version+1",
                            command.context().salesMenuRef(),
                            command.channelRef(),
                            command.status().name());
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command updateSchedule(SalesMenuOwnerApi.ScheduleCommand command) {
        return mutate(
                "updateOperationsSalesMenuSchedule", command.context(), command, command.expectedVersion(), () -> {
                    UUID version = draftVersion(command.context().salesMenuRef());
                    repository.update(
                            "UPDATE sales_menu.sales_collection_version SET schedule_kind=?,"
                                    + "schedule_start_local_time=?,"
                                    + "schedule_end_local_time=? WHERE version_ref=?",
                            command.schedule().kind().name(),
                            command.schedule().startLocalTime(),
                            command.schedule().endLocalTime(),
                            version);
                    advanceDraftRevision(version);
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command createSection(SalesMenuOwnerApi.SectionCreateCommand command) {
        UUID section = UUID.randomUUID();
        return mutate("createOperationsSalesMenuSection", command.context(), command, command.expectedVersion(), () -> {
            UUID version = draftVersion(command.context().salesMenuRef());
            repository.update(
                    "INSERT INTO sales_menu.sales_section(section_ref,collection_ref) VALUES(?,?)",
                    section,
                    command.context().salesMenuRef());
            repository.update(
                    "INSERT INTO sales_menu.sales_version_section(version_ref,section_ref,collection_ref,name,"
                            + "display_order) "
                            + "VALUES(?,?,?, ?,COALESCE((SELECT max(display_order)+1 "
                            + "FROM sales_menu.sales_version_section WHERE version_ref=?),0))",
                    version,
                    section,
                    command.context().salesMenuRef(),
                    command.name(),
                    version);
            advanceDraftRevision(version);
            return SalesMenuCommandReadbackStatus.APPLIED;
        });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command renameSection(SalesMenuOwnerApi.SectionRenameCommand command) {
        return mutate(
                "renameOperationsSalesMenuSection", command.context(), command, command.expectedVersion(), locked -> {
                    UUID version = locked.draftVersion();
                    repository.update(
                            "UPDATE sales_menu.sales_version_section SET name=? WHERE version_ref=? AND section_ref=?",
                            command.name(),
                            version,
                            command.salesSectionRef());
                    advanceDraftRevision(version);
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command deleteSection(SalesMenuOwnerApi.SectionDeleteCommand command) {
        return mutate(
                "deleteOperationsSalesMenuSection", command.context(), command, command.expectedVersion(), locked -> {
                    UUID version = locked.draftVersion();
                    if (!repository
                            .query(
                                    "SELECT 1 FROM sales_menu.sales_version_item "
                                            + "WHERE version_ref=? AND section_ref=? LIMIT 1",
                                    SalesMenuOwnerService::existsRow,
                                    version,
                                    command.salesSectionRef())
                            .isEmpty()) throw problem("SECTION_NOT_EMPTY", 409, "非空分组不可删除");
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_section WHERE version_ref=? AND section_ref=?",
                            version,
                            command.salesSectionRef());
                    advanceDraftRevision(version);
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command moveSection(SalesMenuOwnerApi.SectionMoveCommand command) {
        return mutate(
                "moveOperationsSalesMenuSection", command.context(), command, command.expectedVersion(), locked -> {
                    UUID version = locked.draftVersion();
                    move(
                            "sales_menu.sales_version_section",
                            "section_ref",
                            version,
                            command.salesSectionRef(),
                            command.direction(),
                            null,
                            locked.moveCurrent());
                    advanceDraftRevision(version);
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command addItems(SalesMenuOwnerApi.ItemsAddCommand command) {
        requireGrant(command.context(), true);
        return receipt(
                "addOperationsSalesMenuItems",
                command.context(),
                command,
                () -> {
                    MenuCommandLock menuLock = lockMenuTargetWithStore(command.context(), null);
                    UUID version = draftVersion(menuLock.menu().salesMenuRef());
                    requireSection(menuLock.menu().salesMenuRef(), version, command.salesSectionRef());
                    return new AddItemsLock(menuLock, version);
                },
                locked -> preflightAddItems(command, locked),
                preflight -> {
                    var menu = preflight.menu();
                    UUID version = preflight.draftVersion();
                    Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts = preflight.facts();
                    requireCas(command.context().target(), command.expectedVersion());
                    UUID section = command.salesSectionRef();
                    List<UUID> itemRefs = command.catalogItemRefs().stream()
                            .map(ignored -> UUID.randomUUID())
                            .toList();
                    insertDraftItems(command.context().salesMenuRef(), itemRefs, command.catalogItemRefs());
                    insertDraftVersionItems(
                            version,
                            section,
                            command.context().salesMenuRef(),
                            itemRefs,
                            command.catalogItemRefs(),
                            facts);
                    advanceDraftRevision(version);
                    SalesMenuReadback.Command readback = command(
                            "addOperationsSalesMenuItems",
                            command.context(),
                            menu.salesMenuRef(),
                            menu.salesMenuRef(),
                            SalesMenuCommandReadbackStatus.APPLIED);
                    recordSuccess(
                            "addOperationsSalesMenuItems",
                            command.context(),
                            null,
                            menu.salesMenuRef(),
                            menu.salesMenuRef());
                    return readback;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command updateItem(SalesMenuOwnerApi.ItemUpdateCommand command) {
        requireGrant(command.context(), true);
        return receipt(
                "updateOperationsSalesMenuItem",
                command.context(),
                command,
                () -> {
                    MenuCommandLock menuLock = lockMenuTargetWithStore(command.context(), null);
                    UUID version = draftVersion(menuLock.menu().salesMenuRef());
                    ItemRow current = requireDraftItem(menuLock.menu(), version, command.salesItemRef());
                    return new UpdateItemLock(menuLock, version, current);
                },
                locked -> preflightUpdateItem(command, locked),
                preflight -> {
                    var menu = preflight.menu();
                    UUID version = preflight.draftVersion();
                    ItemRow current = preflight.current();
                    Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts = preflight.facts();
                    CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(current.catalogItemRef());
                    List<SkuRow> authoritativeSkus = authoritativeSkuRows(fact, command.saleContent());
                    List<SalesMenuReadback.SalesMenuOrderOption> authoritativeOrderOptions =
                            preflight.orderOptions();
                    requireCas(command.context().target(), command.expectedVersion());
                    claimStagedAssets(command, current);
                    repository.update(
                            "UPDATE sales_menu.sales_version_item SET display_name_override=?,listed_price_cents=?,"
                                    + "resolved_item_name=?,resolved_item_code=?,resolved_product_shape=?,"
                                    + "resolved_sales_unit_ref=NULL,resolved_sales_unit_code=NULL,"
                                    + "resolved_sales_unit_name=NULL,resolved_sales_unit_dimension=NULL,"
                                    + "resolved_sales_unit_precision=NULL,"
                                    + "ordering_constraints_json=?::jsonb,display_media_mode=?,version=version+1 "
                                    + "WHERE version_ref=? AND sales_item_ref=?",
                            command.displayNameOverride(),
                            command.saleContent().listedPriceCents(),
                            fact.itemName(),
                            fact.itemCode(),
                            fact.shapeKey(),
                            writeJson(command.orderingConstraints()),
                            command.displayMedia().mode().name(),
                            version,
                            command.salesItemRef());
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_item_sku WHERE version_ref=? AND sales_item_ref=?",
                            version,
                            command.salesItemRef());
                    for (SkuRow sku : authoritativeSkus) {
                        repository.update(
                                "INSERT INTO sales_menu.sales_version_item_sku(version_ref,sales_item_ref,sku_ref,"
                                        + "listed_price_cents,resolved_sku_code,resolved_sku_name,default_price_cents,"
                                        + "display_order) VALUES(?,?,?,?,?,?,?,?)",
                                version,
                                command.salesItemRef(),
                                sku.skuRef(),
                                sku.listedPriceCents(),
                                sku.resolvedSkuCode(),
                                sku.resolvedSkuName(),
                                sku.defaultPriceCents(),
                                sku.displayOrder());
                    }
                    replaceOrderOptions(version, command.salesItemRef(), authoritativeOrderOptions);
                    replaceMedia(version, command.salesItemRef(), command.displayMedia());
                    advanceDraftRevision(version);
                    SalesMenuReadback.Command readback = command(
                            "updateOperationsSalesMenuItem",
                            command.context(),
                            menu.salesMenuRef(),
                            command.salesItemRef(),
                            SalesMenuCommandReadbackStatus.APPLIED);
                    recordSuccess(
                            "updateOperationsSalesMenuItem",
                            command.context(),
                            null,
                            menu.salesMenuRef(),
                            command.salesItemRef());
                    return readback;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command deleteItem(SalesMenuOwnerApi.ItemDeleteCommand command) {
        return mutate(
                "deleteOperationsSalesMenuItem",
                command.context(),
                command,
                command.expectedVersion(),
                null,
                command.salesItemRef(),
                locked -> {
                    UUID version = locked.draftVersion();
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_item_sku WHERE version_ref=? AND sales_item_ref=?",
                            version,
                            command.salesItemRef());
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_item_order_option_value "
                                    + "WHERE version_ref=? AND sales_item_ref=?",
                            version,
                            command.salesItemRef());
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_item_order_option WHERE version_ref=? "
                                    + "AND sales_item_ref=?",
                            version,
                            command.salesItemRef());
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_item_media WHERE version_ref=? AND sales_item_ref=?",
                            version,
                            command.salesItemRef());
                    repository.update(
                            "DELETE FROM sales_menu.sales_version_item WHERE version_ref=? AND sales_item_ref=?",
                            version,
                            command.salesItemRef());
                    advanceDraftRevision(version);
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command moveItem(SalesMenuOwnerApi.ItemMoveCommand command) {
        return mutate(
                "moveOperationsSalesMenuItem",
                command.context(),
                command,
                command.expectedVersion(),
                null,
                command.salesItemRef(),
                locked -> {
                    UUID version = locked.draftVersion();
                    move(
                            "sales_menu.sales_version_item",
                            "sales_item_ref",
                            version,
                            command.salesItemRef(),
                            command.direction(),
                            locked.moveCurrent().sectionRef(),
                            locked.moveCurrent());
                    advanceDraftRevision(version);
                    return SalesMenuCommandReadbackStatus.APPLIED;
                });
    }

    @Override
    public SalesMenuReadback.AssetTargetReadback requireSalesMenuItemAssetTarget(
            SalesMenuAssetTargetMode mode,
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant grant,
            long contextVersion) {
        Objects.requireNonNull(mode, "mode");
        Objects.requireNonNull(target, "target");
        requireGrant(target, grant, contextVersion);
        if (target.usage() != com.catering.v2s.salesmenu.domain.SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE) {
            throw problem("SALES_MENU_ASSET_TARGET_MISMATCH", 403, "图片资源目标不属于销售菜单商品");
        }
        SalesMenuScope scope = new SalesMenuScope(grant.workspaceUuid(), target.groupWorkspaceKey(), target.storeRef());
        requireStore(scope);
        var menu = requireMenu(
                new SalesMenuTarget(scope, target.salesMenuRef()), mode != SalesMenuAssetTargetMode.RELEASE_STAGED);
        if (mode != SalesMenuAssetTargetMode.RELEASE_STAGED) {
            if (menu.archived()) throw problem("SALES_MENU_ARCHIVED", 409, "已归档销售菜单不可修改");
            List<LongValueRow> currentDraftItems = repository.query(
                    "SELECT version FROM sales_menu.sales_version_item "
                            + "WHERE version_ref=(SELECT current_draft_version_ref "
                            + "FROM sales_menu.sales_collection WHERE collection_ref=?) "
                            + "AND sales_item_ref=?",
                    SalesMenuOwnerService::longValueRow,
                    target.salesMenuRef(),
                    target.salesItemRef());
            if (currentDraftItems.isEmpty()) {
                throw problem("SALES_MENU_ITEM_NOT_FOUND", 404, "销售菜单商品不存在");
            }
            if (target.expectedDraftVersion() != currentDraftItems.getFirst().value()) {
                throw problem("SALES_MENU_VERSION_CONFLICT", 409, "销售菜单商品草稿版本已变化");
            }
        } else if (repository
                .query(
                        "SELECT 1 FROM sales_menu.sales_item WHERE collection_ref=? AND sales_item_ref=?",
                        SalesMenuOwnerService::existsRow,
                        target.salesMenuRef(),
                        target.salesItemRef())
                .isEmpty()) throw problem("SALES_MENU_ITEM_NOT_FOUND", 404, "销售菜单商品不存在");
        return new SalesMenuReadback.AssetTargetReadback(target);
    }

    @Override
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
                    repository.update(
                            "INSERT INTO sales_menu.sales_publication(publication_ref,collection_ref,"
                                    + "published_version_ref,"
                                    + "source_draft_revision,actor_type,actor_id,actor_display_snapshot,"
                                    + "occurred_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?)",
                            UUID.randomUUID(),
                            menu.salesMenuRef(),
                            published,
                            menu.draftRevision(),
                            command.context().actor().actorType(),
                            command.context().actor().actorId(),
                            command.context().actor().displaySnapshot(),
                            time.currentEpochMillis());
                    repository.update(
                            "UPDATE sales_menu.sales_collection SET latest_published_version_ref=? "
                                    + "WHERE collection_ref=?",
                            published,
                            menu.salesMenuRef());
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
        repository.update(
                "DELETE FROM sales_menu.sales_manual_status_current current_status "
                        + "USING sales_menu.sales_item item "
                        + "WHERE current_status.sales_item_ref=item.sales_item_ref "
                        + "AND item.collection_ref=? "
                        + "AND current_status.target_kind <> 'ITEM' "
                        + "AND NOT EXISTS ("
                        + "SELECT 1 FROM sales_menu.sales_version_item_sku sku "
                        + "WHERE sku.version_ref=? AND sku.sales_item_ref=current_status.sales_item_ref "
                        + "AND current_status.target_kind='SKU' AND sku.sku_ref=current_status.target_ref) "
                        + "AND NOT EXISTS ("
                        + "SELECT 1 FROM sales_menu.sales_version_item_order_option_value option_value "
                        + "WHERE option_value.version_ref=? AND option_value.sales_item_ref=current_status.sales_item_ref "
                        + "AND current_status.target_kind='ORDER_OPTION_VALUE' "
                        + "AND option_value.definition_value_ref=current_status.target_ref)",
                collectionRef,
                publishedVersion,
                publishedVersion);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command setManualSoldOut(SalesMenuOwnerApi.ManualSoldOutCommand command) {
        return manual(
                "setOperationsSalesMenuItemSoldOut",
                command.context(),
                command.expectedVersion(),
                command.channelRef(),
                command.salesItemRef(),
                command.target(),
                SalesMenuManualSaleState.MANUAL_SOLD_OUT,
                command.reason(),
                false);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command restoreManualSale(SalesMenuOwnerApi.ManualRestoreCommand command) {
        if (!command.confirm()) throw problem("CONFIRMATION_REQUIRED", 422, "恢复售卖需要确认");
        return manual(
                "restoreOperationsSalesMenuItemSale",
                command.context(),
                command.expectedVersion(),
                command.channelRef(),
                command.salesItemRef(),
                command.target(),
                SalesMenuManualSaleState.NORMAL,
                null,
                true);
    }

    private void preflightCreate(SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        requireOwnerCommand(context, channelRef);
    }

    private SalesMenuAggregate lockMenuTarget(SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        return lockMenuTargetWithStore(context, channelRef).menu();
    }

    private MenuCommandLock lockMenuTargetWithStore(SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        SalesMenuAggregate menu = requireMenu(context.target(), true);
        OrganizationOwnerApi.SalesMenuStoreJudgment store = requireOwnerCommand(context, channelRef);
        requireNotArchived(menu);
        return new MenuCommandLock(menu, store);
    }

    private AddItemsPreflight preflightAddItems(SalesMenuOwnerApi.ItemsAddCommand command, AddItemsLock locked) {
        MenuCommandLock menuLock = locked.menuLock();
        SalesMenuAggregate menu = menuLock.menu();
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts = catalogFacts(
                command.context().scope(), new LinkedHashSet<>(command.catalogItemRefs()), menuLock.store());
        if (catalog != null && organization != null) {
            command.catalogItemRefs().forEach(itemRef -> requireDraftCatalogItem(facts.get(itemRef)));
        }
        return new AddItemsPreflight(menu, locked.draftVersion(), facts);
    }

    private UpdateItemPreflight preflightUpdateItem(
            SalesMenuOwnerApi.ItemUpdateCommand command, UpdateItemLock locked) {
        MenuCommandLock menuLock = locked.menuLock();
        SalesMenuAggregate menu = menuLock.menu();
        ItemRow current = locked.current();
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts =
                catalogFacts(command.context().scope(), Set.of(current.catalogItemRef()), menuLock.store());
        CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(current.catalogItemRef());
        List<SalesMenuReadback.SalesMenuOrderOption> orderOptions = requireDraftItemUpdate(fact, command);
        return new UpdateItemPreflight(menu, locked.draftVersion(), current, facts, orderOptions);
    }

    private PublishPreflight preflightPublish(
            SalesMenuOwnerApi.PublishCommand command,
            SalesMenuAggregate menu,
            OrganizationOwnerApi.SalesMenuStoreJudgment store) {
        PublicationValidation validation = publicationValidation(menu, null, store);
        if (!validation.blockers().isEmpty()) throw publicationInvalid(validation.blockers());
        return new PublishPreflight(menu, validation);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.OperationRecord recordRejectedOperation(
            SalesMenuOwnerApi.RejectedOperationCommand command) {
        requireGrant(command.context(), command.context().salesMenuRef() != null);
        requireStore(command.context().scope());
        if (command.channelRef() != null) {
            if ("SALES_MENU_CHANNEL_INELIGIBLE".equals(command.failureCode())) {
                if (channels != null
                        && !channels.salesMenuChannelBelongsToStore(
                                command.context().scope().workspaceUuid(),
                                command.context().scope().groupWorkspaceKey(),
                                command.context().scope().storeRef().toString(),
                                command.channelRef())) {
                    throw problem("SALES_MENU_CHANNEL_INELIGIBLE", 422, "业务渠道不属于当前门店");
                }
            } else {
                requireChannel(command.context().scope(), command.channelRef());
            }
        }
        if (command.context().salesMenuRef() != null
                && !REJECTED_OPERATION_TARGET_MAY_BE_MISSING.contains(command.failureCode())) {
            requireMenu(
                    new SalesMenuTarget(
                            command.context().scope(), command.context().salesMenuRef()),
                    false);
        }
        UUID record = UUID.randomUUID();
        long now = time.currentEpochMillis();
        repository.update(
                "INSERT INTO sales_menu.sales_operation_record(record_ref,workspace_uuid,group_workspace_key,"
                        + "store_ref,channel_ref,collection_ref,operation_kind,target_ref,target_kind,"
                        + "target_display_snapshot,result,failure_code,"
                        + "actor_type,"
                        + "actor_id,actor_display_snapshot,occurred_at_epoch_millis,idempotency_key) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                record,
                command.context().scope().workspaceUuid(),
                command.context().scope().groupWorkspaceKey(),
                command.context().scope().storeRef(),
                command.channelRef(),
                command.context().salesMenuRef(),
                command.operationKind(),
                command.targetRef(),
                command.targetKind(),
                command.targetDisplaySnapshot(),
                SalesMenuOperationResult.FAILED.name(),
                command.failureCode(),
                command.context().actor().actorType(),
                command.context().actor().actorId(),
                command.context().actor().displaySnapshot(),
                now,
                command.context().idempotencyKey());
        return new SalesMenuReadback.OperationRecord(
                record,
                now,
                command.operationKind(),
                command.context().salesMenuRef(),
                command.targetRef(),
                command.targetKind(),
                command.targetDisplaySnapshot(),
                SalesMenuOperationResult.FAILED,
                command.failureCode(),
                command.context().actor().displaySnapshot());
    }

    @Override
    public SalesMenuReadback.Command create(SalesMenuCommandApi.CreateCommand c) {
        return create(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command copy(SalesMenuCommandApi.CopyCommand c) {
        return copy(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command rename(SalesMenuCommandApi.RenameCommand c) {
        return rename(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command archive(SalesMenuCommandApi.ArchiveCommand c) {
        return archive(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command setActivation(SalesMenuCommandApi.ActivationCommand c) {
        return setActivation(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command updateSchedule(SalesMenuCommandApi.ScheduleCommand c) {
        return updateSchedule(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command createSection(SalesMenuCommandApi.SectionCreateCommand c) {
        return createSection(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command renameSection(SalesMenuCommandApi.SectionRenameCommand c) {
        return renameSection(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command deleteSection(SalesMenuCommandApi.SectionDeleteCommand c) {
        return deleteSection(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command moveSection(SalesMenuCommandApi.SectionMoveCommand c) {
        return moveSection(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command addItems(SalesMenuCommandApi.ItemsAddCommand c) {
        return addItems(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command updateItem(SalesMenuCommandApi.ItemUpdateCommand c) {
        return updateItem(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command deleteItem(SalesMenuCommandApi.ItemDeleteCommand c) {
        return deleteItem(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command moveItem(SalesMenuCommandApi.ItemMoveCommand c) {
        return moveItem(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command publish(SalesMenuCommandApi.PublishCommand c) {
        return publish(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command setManualSoldOut(SalesMenuCommandApi.ManualSoldOutCommand c) {
        return setManualSoldOut(c.ownerCommand());
    }

    @Override
    public SalesMenuReadback.Command restoreManualSale(SalesMenuCommandApi.ManualRestoreCommand c) {
        return restoreManualSale(c.ownerCommand());
    }

    private SalesMenuReadback.Command mutate(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            Object request,
            long expectedVersion,
            Supplier<SalesMenuCommandReadbackStatus> mutation) {
        return mutate(operation, context, request, expectedVersion, null, null, ignored -> mutation.get());
    }

    private SalesMenuReadback.Command mutate(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            Object request,
            long expectedVersion,
            Function<MutationLock, SalesMenuCommandReadbackStatus> mutation) {
        return mutate(operation, context, request, expectedVersion, null, null, mutation);
    }

    private SalesMenuReadback.Command mutate(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            Object request,
            long expectedVersion,
            UUID recordChannel,
            Supplier<SalesMenuCommandReadbackStatus> mutation) {
        return mutate(operation, context, request, expectedVersion, recordChannel, null, ignored -> mutation.get());
    }

    private SalesMenuReadback.Command mutate(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            Object request,
            long expectedVersion,
            UUID recordChannel,
            UUID explicitTarget,
            Function<MutationLock, SalesMenuCommandReadbackStatus> mutation) {
        requireGrant(context, true);
        return receipt(
                operation,
                context,
                request,
                () -> lockMutationTarget(context, recordChannel, request),
                locked -> locked,
                locked -> {
                    requireCas(context.target(), expectedVersion);
                    SalesMenuCommandReadbackStatus status = mutation.apply(locked);
                    UUID target = explicitTarget == null ? locked.menu().salesMenuRef() : explicitTarget;
                    SalesMenuReadback.Command readback =
                            command(operation, context, locked.menu().salesMenuRef(), target, status);
                    recordSuccess(
                            operation, context, recordChannel, locked.menu().salesMenuRef(), target);
                    return readback;
                });
    }

    private MutationLock lockMutationTarget(
            SalesMenuOwnerApi.CommandContext context, UUID recordChannel, Object request) {
        SalesMenuAggregate menu = lockMenuTarget(context, recordChannel);
        UUID draftVersion = null;
        MoveCurrentRow moveCurrent = null;
        if (request instanceof SalesMenuOwnerApi.SectionRenameCommand command) {
            draftVersion = draftVersion(menu.salesMenuRef());
            requireSection(menu.salesMenuRef(), draftVersion, command.salesSectionRef());
        } else if (request instanceof SalesMenuOwnerApi.SectionDeleteCommand command) {
            draftVersion = draftVersion(menu.salesMenuRef());
            requireSection(menu.salesMenuRef(), draftVersion, command.salesSectionRef());
        } else if (request instanceof SalesMenuOwnerApi.SectionMoveCommand command) {
            draftVersion = draftVersion(menu.salesMenuRef());
            moveCurrent = requireSectionMoveCurrent(menu.salesMenuRef(), draftVersion, command.salesSectionRef());
        } else if (request instanceof SalesMenuOwnerApi.ItemDeleteCommand command) {
            draftVersion = draftVersion(menu.salesMenuRef());
            requireItem(draftVersion, command.salesItemRef());
        } else if (request instanceof SalesMenuOwnerApi.ItemMoveCommand command) {
            draftVersion = draftVersion(menu.salesMenuRef());
            moveCurrent = requireItemMoveCurrent(draftVersion, command.salesItemRef());
        }
        return new MutationLock(menu, draftVersion, moveCurrent);
    }

    private SalesMenuReadback.Command manual(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            long expectedVersion,
            UUID channel,
            UUID item,
            SalesMenuManualSaleTarget target,
            SalesMenuManualSaleState state,
            String reason,
            boolean restore) {
        requireGrant(context, true);
        return receipt(
                operation,
                context,
                new ManualReceiptRequest(
                        context.scope().groupWorkspaceKey(),
                        context.scope().storeRef(),
                        context.salesMenuRef(),
                        channel,
                        item,
                        target,
                        state,
                        reason,
                        expectedVersion),
                () -> {
                    SalesMenuAggregate menu = lockMenuTarget(context, channel);
                    ItemRow publishedItem = itemRows(menu, SalesMenuVersionKind.PUBLISHED, null, item).stream()
                            .findFirst()
                            .orElseThrow(() -> problem("SALES_MENU_MANUAL_TARGET_INVALID", 422, "人工销售目标不属于当前发布版本"));
                    return new ManualLock(menu, publishedItem);
                },
                locked -> new ManualPreflight(
                        locked.menu(),
                        target,
                        requirePublishedManualTarget(locked.item(), target)),
                preflight -> {
                    var menu = preflight.menu();
                    requireCas(context.target(), expectedVersion);
                    long now = time.currentEpochMillis();
                    repository.update(
                            "INSERT INTO sales_menu.sales_manual_status_current(sales_item_ref,channel_ref,target_kind,"
                                    + "target_ref,state,reason,changed_at_epoch_millis,actor_type,actor_id,"
                                    + "actor_display_snapshot,version) VALUES(?,?,?,?,?,?,?,?,?,?,1) "
                                    + "ON CONFLICT (sales_item_ref,channel_ref,target_kind,target_ref) "
                                    + "DO UPDATE SET "
                                    + "state=EXCLUDED.state,reason=EXCLUDED.reason,"
                                    + "changed_at_epoch_millis=EXCLUDED.changed_at_epoch_millis,"
                                    + "actor_type=EXCLUDED.actor_type,actor_id=EXCLUDED.actor_id,"
                                    + "actor_display_snapshot=EXCLUDED.actor_display_snapshot,"
                                    + "version=sales_menu.sales_manual_status_current.version+1",
                            item,
                            channel,
                            target.targetKind().name(),
                            target.targetRef(),
                            state.name(),
                            reason,
                            now,
                            context.actor().actorType(),
                            context.actor().actorId(),
                            context.actor().displaySnapshot());
                    repository.update(
                            "INSERT INTO sales_menu.sales_manual_status_event(event_ref,sales_item_ref,channel_ref,"
                                    + "target_kind,target_ref,event_kind,reason,actor_type,actor_id,"
                                    + "actor_display_snapshot,occurred_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                            UUID.randomUUID(),
                            item,
                            channel,
                            target.targetKind().name(),
                            target.targetRef(),
                            restore ? "RESTORED" : "SOLD_OUT",
                            reason,
                            context.actor().actorType(),
                            context.actor().actorId(),
                            context.actor().displaySnapshot(),
                            now);
                    SalesMenuReadback.Command readback = command(
                            operation,
                            context,
                            menu.salesMenuRef(),
                            target.targetRef(),
                            SalesMenuCommandReadbackStatus.APPLIED);
                    recordSuccess(
                            operation,
                            context,
                            channel,
                            menu.salesMenuRef(),
                            target.targetRef(),
                            target.targetKind().name(),
                            preflight.targetDisplayName());
                    return readback;
                });
    }

    private String requirePublishedManualTarget(ItemRow item, SalesMenuManualSaleTarget target) {
        if (target == null) throw problem("SALES_MENU_MANUAL_TARGET_INVALID", 422, "人工销售目标不能为空");
        if (target.targetKind() == SalesMenuManualSaleTargetKind.ITEM) {
            if (!item.salesItemRef().equals(target.targetRef())) {
                throw problem("SALES_MENU_MANUAL_TARGET_INVALID", 422, "人工销售目标不属于当前销售项");
            }
            return displayName(item);
        }
        if (target.targetKind() == SalesMenuManualSaleTargetKind.SKU) {
            return repository
                    .query(
                            "SELECT resolved_sku_name FROM sales_menu.sales_version_item_sku "
                                    + "WHERE version_ref=? AND sales_item_ref=? AND sku_ref=?",
                            (result, ignored) -> result.getString("resolved_sku_name"),
                            item.versionRef(),
                            item.salesItemRef(),
                            target.targetRef())
                    .stream()
                    .findFirst()
                    .orElseThrow(() -> problem(
                            "SALES_MENU_MANUAL_TARGET_INVALID", 422, "人工规格目标不属于当前发布版本"));
        }
        return repository
                .query(
                        "SELECT resolved_value_name FROM sales_menu.sales_version_item_order_option_value "
                                + "WHERE version_ref=? AND sales_item_ref=? AND definition_value_ref=?",
                        (result, ignored) -> result.getString("resolved_value_name"),
                        item.versionRef(),
                        item.salesItemRef(),
                        target.targetRef())
                .stream()
                .findFirst()
                .orElseThrow(() -> problem(
                        "SALES_MENU_MANUAL_TARGET_INVALID", 422, "人工选项值目标不属于当前发布版本"));
    }

    private <L, P, T> T receipt(
            String operation,
            SalesMenuOwnerApi.CommandContext context,
            Object request,
            Supplier<L> lock,
            Function<L, P> preflight,
            Function<P, T> action) {
        String hash = hash(receiptRequest(request));
        repository.lockCommandReceipt(context.scope().workspaceUuid(), operation, context.idempotencyKey());
        L locked = lock.get();
        ReceiptRow existing = repository
                .query(
                        "SELECT request_hash,status,readback_json::text readback_json "
                                + "FROM sales_menu.sales_command_receipt "
                                + "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?",
                        SalesMenuOwnerService::receiptRow,
                        context.scope().workspaceUuid(),
                        operation,
                        context.idempotencyKey())
                .stream()
                .findFirst()
                .orElse(null);
        if (existing != null) return replay(operation, context, hash);
        P state = preflight.apply(locked);
        T result = action.apply(state);
        int inserted = repository.update(
                "INSERT INTO sales_menu.sales_command_receipt(receipt_ref,workspace_uuid,group_workspace_key,"
                        + "operation_id,idempotency_key,request_hash,status,readback_json,created_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,? ,?::jsonb,?) "
                        + "ON CONFLICT (workspace_uuid,operation_id,idempotency_key) DO NOTHING",
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
        if (request instanceof SalesMenuOwnerApi.ScheduleCommand command) {
            SalesMenuSchedule schedule = command.schedule();
            return new ScheduleReceiptRequest(
                    command.context().salesMenuRef(),
                    schedule.kind().name(),
                    schedule.startLocalTime() == null
                            ? null
                            : schedule.startLocalTime().toString(),
                    schedule.endLocalTime() == null
                            ? null
                            : schedule.endLocalTime().toString(),
                    command.expectedVersion());
        }
        if (request instanceof SalesMenuOwnerApi.ItemUpdateCommand command) {
            return new SalesMenuOwnerApi.ItemUpdateCommand(
                    command.context(),
                    command.salesItemRef(),
                    command.displayNameOverride(),
                    command.saleContent(),
                    command.orderingConstraints(),
                    command.displayMedia(),
                    List.of(),
                    command.expectedVersion());
        }
        return request;
    }

    private record ManualReceiptRequest(
            String groupWorkspaceKey,
            UUID storeRef,
            UUID salesMenuRef,
            UUID channelRef,
            UUID salesItemRef,
            SalesMenuManualSaleTarget target,
            SalesMenuManualSaleState state,
            String reason,
            long expectedVersion) {}

    private record ScheduleReceiptRequest(
            UUID salesMenuRef, String scheduleKind, String startLocalTime, String endLocalTime, long expectedVersion) {}

    private <T> T replay(String operation, SalesMenuOwnerApi.CommandContext context, String hash) {
        var row = repository
                .query(
                        "SELECT request_hash,status,readback_json::text readback_json "
                                + "FROM sales_menu.sales_command_receipt "
                                + "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?",
                        SalesMenuOwnerService::receiptRow,
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

    private void insertDraftItems(UUID collectionRef, List<UUID> itemRefs, List<UUID> catalogItemRefs) {
        if (itemRefs.isEmpty()) return;
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "(?,?,?)"));
        List<Object> arguments = new ArrayList<>(itemRefs.size() * 3);
        for (int index = 0; index < itemRefs.size(); index++) {
            arguments.add(itemRefs.get(index));
            arguments.add(collectionRef);
            arguments.add(catalogItemRefs.get(index));
        }
        repository.update(
                "INSERT INTO sales_menu.sales_item(sales_item_ref,collection_ref,catalog_item_ref) VALUES "
                        + placeholders,
                arguments.toArray());
    }

    private void insertDraftVersionItems(
            UUID version,
            UUID section,
            UUID collectionRef,
            List<UUID> itemRefs,
            List<UUID> catalogItemRefs,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts) {
        if (itemRefs.isEmpty()) return;
        StringBuilder values = new StringBuilder();
        List<Object> arguments = new ArrayList<>(itemRefs.size() * 5 + 6);
        for (int index = 0; index < itemRefs.size(); index++) {
            if (index > 0) values.append(',');
            values.append("(CAST(? AS uuid),CAST(? AS text),CAST(? AS text),CAST(? AS text),CAST(? AS bigint))");
            UUID catalogItemRef = catalogItemRefs.get(index);
            CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(catalogItemRef);
            arguments.add(itemRefs.get(index));
            arguments.add(fact == null ? null : fact.itemName());
            arguments.add(fact == null ? null : fact.itemCode());
            arguments.add(fact == null ? null : fact.shapeKey());
            arguments.add((long) index);
        }
        arguments.add(version);
        arguments.add(section);
        arguments.add(version);
        arguments.add(section);
        arguments.add(collectionRef);
        arguments.add(SalesMenuDisplayMediaMode.INHERIT_CATALOG.name());
        repository.update(
                "WITH input(sales_item_ref,resolved_item_name,resolved_item_code,resolved_product_shape,ordinal) AS "
                        + "(VALUES "
                        + values
                        + "), base AS (SELECT COALESCE(MAX(display_order)+1,0) AS start_order "
                        + "FROM sales_menu.sales_version_item WHERE version_ref=? AND section_ref=?) "
                        + "INSERT INTO sales_menu.sales_version_item(version_ref,sales_item_ref,section_ref,"
                        + "collection_ref,display_order,resolved_item_name,resolved_item_code,resolved_product_shape,"
                        + "ordering_constraints_json,display_media_mode,version) "
                        + "SELECT ?,input.sales_item_ref,?,?,base.start_order+input.ordinal,"
                        + "input.resolved_item_name,input.resolved_item_code,input.resolved_product_shape,"
                        + "'{}'::jsonb,?,1 FROM input CROSS JOIN base ORDER BY input.ordinal",
                arguments.toArray());
    }

    private void copyDraft(UUID source, UUID target, UUID targetVersion) {
        Map<UUID, UUID> sections = new HashMap<>();
        UUID sourceVersion = draftVersion(source);
        for (var row : repository.query(
                "SELECT section_ref,name,display_order FROM sales_menu.sales_version_section "
                        + "WHERE version_ref=? ORDER BY display_order",
                SalesMenuOwnerService::sectionOrderRow,
                sourceVersion)) {
            UUID section = UUID.randomUUID();
            sections.put(row.sectionRef(), section);
            repository.update(
                    "INSERT INTO sales_menu.sales_section(section_ref,collection_ref) VALUES(?,?)", section, target);
            repository.update(
                    "INSERT INTO sales_menu.sales_version_section(version_ref,section_ref,collection_ref,name,"
                            + "display_order) "
                            + "VALUES(?,?,?,?,?)",
                    targetVersion,
                    section,
                    target,
                    row.name(),
                    row.displayOrder());
        }
        List<ItemRow> sourceItems = repository.query(
                "SELECT v.version_ref,i.sales_item_ref,i.catalog_item_ref,v.section_ref,v.display_order,"
                        + "v.version,v.display_name_override,v.resolved_item_name,v.resolved_item_code,"
                        + "v.resolved_product_shape,v.resolved_sales_unit_ref,v.resolved_sales_unit_code,"
                        + "v.resolved_sales_unit_name,v.resolved_sales_unit_dimension,v.resolved_sales_unit_precision,"
                        + "v.listed_price_cents,v.ordering_constraints_json,"
                        + "v.display_media_mode,false AS can_move_up,false AS can_move_down "
                        + "FROM sales_menu.sales_version_item v "
                        + "JOIN sales_menu.sales_item i ON i.sales_item_ref=v.sales_item_ref "
                        + "WHERE v.version_ref=? ORDER BY v.display_order",
                SalesMenuOwnerService::itemRow,
                sourceVersion);
        Map<UUID, List<SkuRow>> sourceSkus = persistedSkuRowsByItem(sourceItems);
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> sourceOrderOptions =
                selectedOrderOptionsByItem(sourceItems);
        Map<UUID, List<UUID>> sourceMedia = mediaByItem(sourceItems, false);
        for (var row : sourceItems) {
            UUID item = UUID.randomUUID();
            repository.update(
                    "INSERT INTO sales_menu.sales_item(sales_item_ref,collection_ref,catalog_item_ref) VALUES(?,?,?)",
                    item,
                    target,
                    row.catalogItemRef());
            repository.update(
                    "INSERT INTO sales_menu.sales_version_item(version_ref,sales_item_ref,section_ref,collection_ref,"
                            + "display_order,display_name_override,resolved_item_name,resolved_item_code,"
                            + "resolved_product_shape,listed_price_cents,ordering_constraints_json,"
                            + "display_media_mode,version) VALUES(?,?,?,?,?,?,?,?,?,?,?::jsonb,?,1)",
                    targetVersion,
                    item,
                    sections.get(row.sectionRef()),
                    target,
                    row.displayOrder(),
                    row.displayNameOverride(),
                    row.resolvedItemName(),
                    row.resolvedItemCode(),
                    row.resolvedProductShape(),
                    row.listedPriceCents(),
                    row.orderingConstraintsJson(),
                    row.displayMediaMode());
            for (var sku : sourceSkus.getOrDefault(row.salesItemRef(), List.of()))
                repository.update(
                        "INSERT INTO sales_menu.sales_version_item_sku(version_ref,sales_item_ref,sku_ref,"
                                + "listed_price_cents,resolved_sku_code,resolved_sku_name,default_price_cents,"
                                + "display_order) VALUES(?,?,?,?,?,?,?,?)",
                        targetVersion,
                        item,
                        sku.skuRef(),
                        sku.listedPriceCents(),
                        sku.resolvedSkuCode(),
                        sku.resolvedSkuName(),
                        sku.defaultPriceCents(),
                        sku.displayOrder());
            for (var option : sourceOrderOptions.getOrDefault(row.salesItemRef(), List.of())) {
                repository.update(
                        "INSERT INTO sales_menu.sales_version_item_order_option(version_ref,sales_item_ref,"
                                + "definition_ref,resolved_definition_name,selection_mode,required,min_selection_count,"
                                + "max_selection_count,display_order) VALUES(?,?,?,?,?,?,?,?,?)",
                        targetVersion,
                        item,
                        option.definitionRef(),
                        option.name(),
                        option.selectionMode(),
                        option.required(),
                        option.minSelectionCount(),
                        option.maxSelectionCount(),
                        option.displayOrder());
                for (var value : option.values())
                    repository.update(
                            "INSERT INTO sales_menu.sales_version_item_order_option_value(version_ref,sales_item_ref,"
                                    + "definition_ref,definition_value_ref,resolved_value_name,display_order,"
                                    + "default_value,extra_price) VALUES(?,?,?,?,?,?,?,?)",
                            targetVersion,
                            item,
                            option.definitionRef(),
                            value.definitionValueRef(),
                            value.name(),
                            value.displayOrder(),
                            value.defaultValue(),
                            value.extraPrice());
            }
            List<UUID> mediaRefs = sourceMedia.getOrDefault(row.salesItemRef(), List.of());
            for (int index = 0; index < mediaRefs.size(); index++)
                repository.update(
                        "INSERT INTO sales_menu.sales_version_item_media(version_ref,sales_item_ref,"
                                + "asset_ref,display_order) VALUES(?,?,?,?)",
                        targetVersion,
                        item,
                        mediaRefs.get(index),
                        index);
        }
    }

    private void copyVersionRows(UUID from, UUID to) {
        repository.update(
                "INSERT INTO sales_menu.sales_version_section(version_ref,section_ref,collection_ref,name,"
                        + "display_order) "
                        + "SELECT ?,section_ref,collection_ref,name,display_order "
                        + "FROM sales_menu.sales_version_section "
                        + "WHERE version_ref=?",
                to,
                from);
        repository.update(
                "INSERT INTO sales_menu.sales_version_item(version_ref,sales_item_ref,section_ref,"
                        + "collection_ref,display_order,"
                        + "display_name_override,resolved_item_name,resolved_item_code,resolved_product_shape,"
                        + "resolved_sales_unit_ref,resolved_sales_unit_code,resolved_sales_unit_name,"
                        + "resolved_sales_unit_dimension,resolved_sales_unit_precision,listed_price_cents,"
                        + "ordering_constraints_json,display_media_mode,version) "
                        + "SELECT ?,sales_item_ref,section_ref,collection_ref,display_order,display_name_override,"
                        + "resolved_item_name,resolved_item_code,resolved_product_shape,resolved_sales_unit_ref,"
                        + "resolved_sales_unit_code,resolved_sales_unit_name,resolved_sales_unit_dimension,"
                        + "resolved_sales_unit_precision,listed_price_cents,"
                        + "ordering_constraints_json,display_media_mode,version "
                        + "FROM sales_menu.sales_version_item WHERE version_ref=?",
                to,
                from);
        repository.update(
                "INSERT INTO sales_menu.sales_version_item_sku(version_ref,sales_item_ref,sku_ref,"
                        + "listed_price_cents,resolved_sku_code,resolved_sku_name,default_price_cents,"
                        + "display_order) SELECT ?,sales_item_ref,sku_ref,listed_price_cents,"
                        + "resolved_sku_code,resolved_sku_name,default_price_cents,display_order "
                        + "FROM sales_menu.sales_version_item_sku WHERE version_ref=?",
                to,
                from);
        repository.update(
                "INSERT INTO sales_menu.sales_version_item_order_option(version_ref,sales_item_ref,definition_ref,"
                        + "resolved_definition_name,selection_mode,required,min_selection_count,max_selection_count,"
                        + "display_order) SELECT ?,sales_item_ref,definition_ref,resolved_definition_name,selection_mode,"
                        + "required,min_selection_count,max_selection_count,display_order "
                        + "FROM sales_menu.sales_version_item_order_option WHERE version_ref=?",
                to,
                from);
        repository.update(
                "INSERT INTO sales_menu.sales_version_item_order_option_value(version_ref,sales_item_ref,"
                        + "definition_ref,definition_value_ref,resolved_value_name,display_order,default_value,"
                        + "extra_price) SELECT ?,sales_item_ref,definition_ref,definition_value_ref,resolved_value_name,"
                        + "display_order,default_value,extra_price FROM sales_menu.sales_version_item_order_option_value "
                        + "WHERE version_ref=?",
                to,
                from);
        repository.update(
                "INSERT INTO sales_menu.sales_version_item_media(version_ref,sales_item_ref,asset_ref,"
                        + "display_order) SELECT ?,sales_item_ref,asset_ref,display_order "
                        + "FROM sales_menu.sales_version_item_media WHERE version_ref=?",
                to,
                from);
    }

    private PublicationValidation publicationValidation(
            com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu, UUID explicitChannelRef) {
        return publicationValidation(menu, explicitChannelRef, requireStore(menu.scope()));
    }

    private PublicationValidation publicationValidation(
            com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu,
            UUID explicitChannelRef,
            OrganizationOwnerApi.SalesMenuStoreJudgment store) {
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
        Map<UUID, List<SkuRow>> skuByItem = skuRowsByItem(rows);
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> orderOptionsByItem =
                selectedOrderOptionsByItem(rows);
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
                        row,
                        fact,
                        orderOptionsByItem.getOrDefault(row.salesItemRef(), List.of()),
                        blockers);
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
            if (!selected.isEmpty() || (fact.orderOptions() != null && !fact.orderOptions().isEmpty())) {
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
        repository.update(
                "INSERT INTO sales_menu.sales_version_section(version_ref,section_ref,collection_ref,name,"
                        + "display_order) "
                        + "SELECT ?,section_ref,collection_ref,name,display_order "
                        + "FROM sales_menu.sales_version_section "
                        + "WHERE version_ref=?",
                publishedVersion,
                validation.draftVersion());
        insertPublicationItems(publishedVersion, validation.rows(), validation.facts(), collectionRef);
        insertPublicationSkus(publishedVersion, validation.rows(), validation.facts(), validation.skuByItem());
        insertPublicationOrderOptions(publishedVersion, validation.orderOptionsByItem());
        insertPublicationMedia(publishedVersion, validation.rows(), validation.mediaByItem());
    }

    private void insertPublicationOrderOptions(
            UUID publishedVersion,
            Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> orderOptionsByItem) {
        for (var entry : orderOptionsByItem.entrySet()) {
            for (var option : entry.getValue()) {
                repository.update(
                        "INSERT INTO sales_menu.sales_version_item_order_option(version_ref,sales_item_ref,"
                                + "definition_ref,resolved_definition_name,selection_mode,required,min_selection_count,"
                                + "max_selection_count,display_order) VALUES(?,?,?,?,?,?,?,?,?)",
                        publishedVersion,
                        entry.getKey(),
                        option.definitionRef(),
                        option.name(),
                        option.selectionMode(),
                        option.required(),
                        option.minSelectionCount(),
                        option.maxSelectionCount(),
                        option.displayOrder());
                for (var value : option.values())
                    repository.update(
                            "INSERT INTO sales_menu.sales_version_item_order_option_value(version_ref,sales_item_ref,"
                                    + "definition_ref,definition_value_ref,resolved_value_name,display_order,"
                                    + "default_value,extra_price) VALUES(?,?,?,?,?,?,?,?)",
                            publishedVersion,
                            entry.getKey(),
                            option.definitionRef(),
                            value.definitionValueRef(),
                            value.name(),
                            value.displayOrder(),
                            value.defaultValue(),
                            value.extraPrice());
            }
        }
    }

    private void insertPublicationItems(
            UUID publishedVersion,
            List<ItemRow> rows,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            UUID collectionRef) {
        if (rows.isEmpty()) return;
        StringBuilder values = new StringBuilder();
        List<Object> arguments = new ArrayList<>(rows.size() * 17);
        for (int index = 0; index < rows.size(); index++) {
            if (index > 0) values.append(',');
            ItemRow row = rows.get(index);
            CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(row.catalogItemRef());
            values.append("(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,1)");
            arguments.add(publishedVersion);
            arguments.add(row.salesItemRef());
            arguments.add(row.sectionRef());
            arguments.add(collectionRef);
            arguments.add(row.displayOrder());
            arguments.add(row.displayNameOverride());
            arguments.add(fact == null ? row.resolvedItemName() : fact.itemName());
            arguments.add(fact == null ? row.resolvedItemCode() : fact.itemCode());
            arguments.add(fact == null ? row.resolvedProductShape() : fact.shapeKey());
            arguments.add(
                    fact == null || fact.salesUnitSnapshot() == null
                            ? null
                            : fact.salesUnitSnapshot().unitRef());
            arguments.add(
                    fact == null || fact.salesUnitSnapshot() == null
                            ? null
                            : fact.salesUnitSnapshot().code());
            arguments.add(
                    fact == null || fact.salesUnitSnapshot() == null
                            ? null
                            : fact.salesUnitSnapshot().name());
            arguments.add(
                    fact == null || fact.salesUnitSnapshot() == null
                            ? null
                            : fact.salesUnitSnapshot().unitDimension());
            arguments.add(
                    fact == null || fact.salesUnitSnapshot() == null
                            ? null
                            : fact.salesUnitSnapshot().precision());
            arguments.add(row.listedPriceCents());
            arguments.add(row.orderingConstraintsJson());
            arguments.add(row.displayMediaMode());
        }
        repository.update(
                "INSERT INTO sales_menu.sales_version_item(version_ref,sales_item_ref,section_ref,"
                        + "collection_ref,display_order,display_name_override,resolved_item_name,resolved_item_code,"
                        + "resolved_product_shape,resolved_sales_unit_ref,resolved_sales_unit_code,"
                        + "resolved_sales_unit_name,resolved_sales_unit_dimension,resolved_sales_unit_precision,"
                        + "listed_price_cents,ordering_constraints_json,display_media_mode,version) VALUES "
                        + values,
                arguments.toArray());
    }

    private void insertPublicationSkus(
            UUID publishedVersion,
            List<ItemRow> rows,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            Map<UUID, List<SkuRow>> skuByItem) {
        List<Object> arguments = new ArrayList<>();
        StringBuilder values = new StringBuilder();
        for (ItemRow row : rows) {
            CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(row.catalogItemRef());
            for (SkuRow selected : skuByItem.getOrDefault(row.salesItemRef(), List.of())) {
                if (!values.isEmpty()) values.append(',');
                CatalogOwnerApi.SalesMenuSkuFact factSku = fact == null
                        ? null
                        : fact.skus().stream()
                                .filter(candidate -> selected.skuRef().equals(candidate.productSkuRef()))
                                .findFirst()
                                .orElse(null);
                values.append("(?,?,?,?,?,?,?,?)");
                arguments.add(publishedVersion);
                arguments.add(row.salesItemRef());
                arguments.add(selected.skuRef());
                arguments.add(selected.listedPriceCents());
                arguments.add(factSku == null ? selected.resolvedSkuCode() : factSku.skuCode());
                arguments.add(factSku == null ? selected.resolvedSkuName() : factSku.skuName());
                arguments.add(factSku == null ? selected.defaultPriceCents() : factSku.standardSalePrice());
                arguments.add(selected.displayOrder());
            }
        }
        if (values.isEmpty()) return;
        repository.update(
                "INSERT INTO sales_menu.sales_version_item_sku(version_ref,sales_item_ref,sku_ref,"
                        + "listed_price_cents,resolved_sku_code,resolved_sku_name,default_price_cents,"
                        + "display_order) VALUES "
                        + values,
                arguments.toArray());
    }

    private void insertPublicationMedia(UUID publishedVersion, List<ItemRow> rows, Map<UUID, List<UUID>> mediaByItem) {
        List<Object> arguments = new ArrayList<>();
        StringBuilder values = new StringBuilder();
        for (ItemRow row : rows) {
            List<UUID> mediaRefs = mediaByItem.getOrDefault(row.salesItemRef(), List.of());
            for (int index = 0; index < mediaRefs.size(); index++) {
                if (!values.isEmpty()) values.append(',');
                values.append("(?,?,?,?)");
                arguments.add(publishedVersion);
                arguments.add(row.salesItemRef());
                arguments.add(mediaRefs.get(index));
                arguments.add(index);
            }
        }
        if (values.isEmpty()) return;
        repository.update(
                "INSERT INTO sales_menu.sales_version_item_media(version_ref,sales_item_ref,asset_ref,"
                        + "display_order) VALUES "
                        + values,
                arguments.toArray());
    }

    private void insertVersion(
            UUID version,
            UUID menu,
            SalesMenuVersionKind kind,
            long revision,
            SalesMenuSchedule schedule,
            UUID sourceDraft,
            Long sourceDraftRevision) {
        repository.update(
                "INSERT INTO sales_menu.sales_collection_version(version_ref,collection_ref,kind,revision,"
                        + "schedule_kind,schedule_start_local_time,schedule_end_local_time,"
                        + "source_draft_version_ref,source_draft_revision,version) VALUES(?,?,?,?,?,?,?,?,?,1)",
                version,
                menu,
                kind.name(),
                revision,
                schedule.kind().name(),
                schedule.startLocalTime(),
                schedule.endLocalTime(),
                sourceDraft,
                sourceDraft == null ? null : sourceDraftRevision);
    }

    private void move(
            String table,
            String refColumn,
            UUID version,
            UUID ref,
            SalesMenuMoveDirection direction,
            UUID section,
            MoveCurrentRow current) {
        long currentOrder = current.displayOrder();
        boolean movingUp = direction == SalesMenuMoveDirection.UP;
        String adjacencyPredicate = movingUp
                ? " AND (display_order < ? OR (display_order = ? AND " + refColumn + " < ?))"
                : " AND (display_order > ? OR (display_order = ? AND " + refColumn + " > ?))";
        String adjacencyOrder = movingUp
                ? " ORDER BY display_order DESC," + refColumn + " DESC LIMIT 1 FOR UPDATE"
                : " ORDER BY display_order ASC," + refColumn + " ASC LIMIT 1 FOR UPDATE";
        List<Object> adjacencyArguments = new ArrayList<>(List.of(version));
        String sectionPredicate = "";
        if (section != null) {
            sectionPredicate = " AND section_ref=?";
            adjacencyArguments.add(section);
        }
        adjacencyArguments.add(currentOrder);
        adjacencyArguments.add(currentOrder);
        adjacencyArguments.add(ref);
        var other = repository
                .query(
                        "SELECT " + refColumn + ",display_order FROM " + table
                                + " WHERE version_ref=?"
                                + sectionPredicate
                                + adjacencyPredicate
                                + adjacencyOrder,
                        SalesMenuOwnerService::moveTargetRow,
                        adjacencyArguments.toArray())
                .stream()
                .findFirst()
                .orElseThrow(() -> problem("MOVE_NOT_ALLOWED", 409, "已到排序边界"));
        List<Object> maxOrderArguments = new ArrayList<>(List.of(version));
        if (section != null) maxOrderArguments.add(section);
        long temp = repository
                .query(
                        "SELECT COALESCE(max(display_order),0)+1 AS value FROM " + table + " WHERE version_ref=?"
                                + sectionPredicate,
                        SalesMenuOwnerService::longValueRow,
                        maxOrderArguments.toArray())
                .getFirst()
                .value();
        if (repository.update(
                        "UPDATE " + table + " SET display_order=? WHERE version_ref=? AND " + refColumn + "=?",
                        temp,
                        version,
                        ref)
                != 1) throw problem("TARGET_NOT_FOUND", 404, "排序目标不存在");
        if (repository.update(
                        "UPDATE " + table + " SET display_order=? WHERE version_ref=? AND " + refColumn + "=?",
                        currentOrder,
                        version,
                        other.ref())
                != 1) throw problem("TARGET_NOT_FOUND", 404, "排序目标不存在");
        if (repository.update(
                        "UPDATE " + table + " SET display_order=? WHERE version_ref=? AND " + refColumn + "=?",
                        other.displayOrder(),
                        version,
                        ref)
                != 1) throw problem("TARGET_NOT_FOUND", 404, "排序目标不存在");
    }

    private SalesMenuReadback.SectionList sections(SalesMenuTarget target, SalesMenuVersionKind kind) {
        requireOwnerRead(target.scope(), null);
        requireMenu(target, false);
        UUID version = kind == SalesMenuVersionKind.DRAFT
                ? draftVersion(target.salesMenuRef())
                : publishedVersion(target.salesMenuRef());
        return new SalesMenuReadback.SectionList(repository
                .query(
                        "SELECT s.section_ref,s.name,s.display_order,(SELECT count(*) "
                                + "FROM sales_menu.sales_version_item i WHERE i.version_ref=? "
                                + "AND i.section_ref=s.section_ref) item_count,"
                                + "EXISTS (SELECT 1 FROM sales_menu.sales_version_section previous "
                                + "WHERE previous.version_ref=s.version_ref AND "
                                + "(previous.display_order < s.display_order OR "
                                + "(previous.display_order=s.display_order AND "
                                + "previous.section_ref < s.section_ref))) can_move_up,"
                                + "EXISTS (SELECT 1 FROM sales_menu.sales_version_section next_section "
                                + "WHERE next_section.version_ref=s.version_ref AND "
                                + "(next_section.display_order > s.display_order OR "
                                + "(next_section.display_order=s.display_order AND "
                                + "next_section.section_ref > s.section_ref))) can_move_down "
                                + "FROM sales_menu.sales_version_section s WHERE s.version_ref=? "
                                + "ORDER BY s.display_order,s.section_ref",
                        SalesMenuOwnerService::sectionRow,
                        version,
                        version)
                .stream()
                .map(row -> new SalesMenuReadback.SectionView(
                        row.sectionRef(),
                        row.name(),
                        row.displayOrder(),
                        row.itemCount(),
                        row.canMoveUp(),
                        row.canMoveDown()))
                .toList());
    }

    private ItemPage pagedItemRows(SalesMenuItemPageQuery query, SalesMenuVersionKind kind) {
        requireOwnerRead(query.menu().scope(), query.channelRef());
        var menu = requireMenu(query.menu(), false);
        UUID version = kind == SalesMenuVersionKind.DRAFT
                ? draftVersion(menu.salesMenuRef())
                : publishedVersion(menu.salesMenuRef());
        String operation =
                kind == SalesMenuVersionKind.DRAFT ? DRAFT_ITEM_LIST_OPERATION : PUBLISHED_ITEM_LIST_OPERATION;
        SalesMenuCursorIdentity identity = new SalesMenuCursorIdentity(
                operation,
                query.menu().scope(),
                query.channelRef(),
                query.menu().salesMenuRef(),
                version,
                query.sectionRef(),
                kind.name(),
                null,
                query.page().pageSize());
        OpaqueCollectionCursor.Position position = decodeCursor(query.page().cursor(), identity);
        List<Object> arguments = new ArrayList<>(List.of(version, query.sectionRef()));
        StringBuilder frontier = new StringBuilder();
        if (position != null) {
            long displayOrder = parseLongCursor(position, "displayOrder");
            frontier.append(" AND (v.display_order > ? OR " + "(v.display_order = ? AND v.sales_item_ref > ?))");
            arguments.add(displayOrder);
            arguments.add(displayOrder);
            arguments.add(position.tieBreaker());
        }
        arguments.add(query.page().pageSize() + 1);
        String sql = "SELECT v.version_ref,i.sales_item_ref,i.catalog_item_ref,v.section_ref,v.display_order,v.version,"
                + "v.display_name_override,v.resolved_item_name,v.resolved_item_code,"
                + "v.resolved_product_shape,v.resolved_sales_unit_ref,v.resolved_sales_unit_code,"
                + "v.resolved_sales_unit_name,v.resolved_sales_unit_dimension,v.resolved_sales_unit_precision,"
                + "v.listed_price_cents,"
                + "v.ordering_constraints_json::text ordering_constraints_json,v.display_media_mode,"
                + "EXISTS (SELECT 1 FROM sales_menu.sales_version_item previous "
                + "WHERE previous.version_ref=v.version_ref AND previous.section_ref=v.section_ref AND "
                + "(previous.display_order < v.display_order OR "
                + "(previous.display_order=v.display_order AND "
                + "previous.sales_item_ref < v.sales_item_ref))) can_move_up,"
                + "EXISTS (SELECT 1 FROM sales_menu.sales_version_item next_item "
                + "WHERE next_item.version_ref=v.version_ref AND next_item.section_ref=v.section_ref AND "
                + "(next_item.display_order > v.display_order OR "
                + "(next_item.display_order=v.display_order AND "
                + "next_item.sales_item_ref > v.sales_item_ref))) can_move_down "
                + "FROM sales_menu.sales_version_item v JOIN sales_menu.sales_item i "
                + "ON i.sales_item_ref=v.sales_item_ref WHERE v.version_ref=? AND v.section_ref=?"
                + frontier
                + " ORDER BY v.display_order,v.sales_item_ref LIMIT ?";
        List<ItemRow> rows = repository.query(sql, SalesMenuOwnerService::itemRow, arguments.toArray());
        boolean hasNext = rows.size() > query.page().pageSize();
        return new ItemPage(hasNext ? rows.subList(0, query.page().pageSize()) : rows, hasNext, identity);
    }

    private String itemNextCursor(ItemPage page) {
        if (!page.hasNext()) return null;
        ItemRow last = page.rows().getLast();
        return OpaqueCollectionCursor.encode(
                page.identity().value(), Long.toString(last.displayOrder()), last.salesItemRef());
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
        String sql = "SELECT v.version_ref,i.sales_item_ref,i.catalog_item_ref,v.section_ref,v.display_order,v.version,"
                + "v.display_name_override,v.resolved_item_name,v.resolved_item_code,"
                + "v.resolved_product_shape,v.resolved_sales_unit_ref,v.resolved_sales_unit_code,"
                + "v.resolved_sales_unit_name,v.resolved_sales_unit_dimension,v.resolved_sales_unit_precision,"
                + "v.listed_price_cents,"
                + "v.ordering_constraints_json::text ordering_constraints_json,v.display_media_mode,"
                + "EXISTS (SELECT 1 FROM sales_menu.sales_version_item previous "
                + "WHERE previous.version_ref=v.version_ref AND previous.section_ref=v.section_ref AND "
                + "(previous.display_order < v.display_order OR "
                + "(previous.display_order=v.display_order AND "
                + "previous.sales_item_ref < v.sales_item_ref))) can_move_up,"
                + "EXISTS (SELECT 1 FROM sales_menu.sales_version_item next_item "
                + "WHERE next_item.version_ref=v.version_ref AND next_item.section_ref=v.section_ref AND "
                + "(next_item.display_order > v.display_order OR "
                + "(next_item.display_order=v.display_order AND "
                + "next_item.sales_item_ref > v.sales_item_ref))) can_move_down "
                + "FROM sales_menu.sales_version_item v JOIN sales_menu.sales_item i "
                + "ON i.sales_item_ref=v.sales_item_ref WHERE v.version_ref=?"
                + (section == null ? "" : " AND v.section_ref=?")
                + (itemRef == null ? "" : " AND v.sales_item_ref=?")
                + " ORDER BY v.section_ref,v.display_order,v.sales_item_ref";
        List<Object> arguments = new ArrayList<>();
        arguments.add(version);
        if (section != null) arguments.add(section);
        if (itemRef != null) arguments.add(itemRef);
        return repository.query(sql, SalesMenuOwnerService::itemRow, arguments.toArray());
    }

    private List<SalesMenuReadback.DraftItemView> draftItems(SalesMenuScope scope, List<ItemRow> rows) {
        Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts = readDraftCatalogFacts(scope, rows);
        Map<UUID, List<UUID>> mediaByItem = mediaByItem(rows);
        Map<UUID, List<SkuRow>> skuByItem = skuRowsByItem(rows);
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptions =
                selectedOrderOptionsByItem(rows);
        return rows.stream()
                .map(row -> {
                    CatalogOwnerApi.SalesMenuItemFacts fact = facts.get(row.catalogItemRef());
                    List<SkuRow> selectedSkus = skuByItem.getOrDefault(row.salesItemRef(), List.of());
                    return draftItem(
                            row,
                            mediaByItem,
                            skuByItem,
                            selectedOrderOptions,
                            catalogOrderOptions(fact),
                            skuCandidates(fact),
                            staleSelectedSkuRefs(fact, selectedSkus),
                            catalogSalesUnit(fact),
                            fact == null ? null : fact.defaultPriceCents(),
                            fact == null ? null : fact.defaultImageAssetRef());
                })
                .toList();
    }

    private Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> readDraftCatalogFacts(
            SalesMenuScope scope, List<ItemRow> rows) {
        if (rows.isEmpty() || catalog == null || organization == null) return Map.of();
        Set<UUID> itemRefs = rows.stream()
                .map(ItemRow::catalogItemRef)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return catalogFacts(scope, itemRefs);
    }

    private SalesMenuReadback.DraftItemView draftItem(
            ItemRow row,
            Map<UUID, List<UUID>> mediaByItem,
            Map<UUID, List<SkuRow>> skuByItem,
            Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptionsByItem,
            List<SalesMenuReadback.SalesMenuOrderOption> catalogOrderOptions,
            List<SalesMenuReadback.SalesMenuSkuCandidate> skuCandidates,
            List<UUID> staleSelectedSkuRefs,
            SalesMenuSalesUnit salesUnit,
            Long defaultPriceCents,
            UUID catalogPrimaryImageAssetRef) {
        return new SalesMenuReadback.DraftItemView(
                row.salesItemRef(),
                row.catalogItemRef(),
                row.resolvedItemCode(),
                displayName(row),
                publicShape(row.resolvedProductShape()),
                catalogOrderOptions,
                skuCandidates,
                staleSelectedSkuRefs,
                defaultPriceCents,
                catalogPrimaryImageAssetRef,
                content(
                        row,
                        skuByItem.getOrDefault(row.salesItemRef(), List.of()),
                        selectedOrderOptionsByItem.getOrDefault(row.salesItemRef(), List.of()),
                        salesUnit),
                ordering(row),
                displayMedia(row, mediaByItem.getOrDefault(row.salesItemRef(), List.of())),
                row.displayOrder(),
                row.canMoveUp(),
                row.canMoveDown(),
                row.version());
    }

    private SalesMenuReadback.PublishedItemView publishedItem(
            ItemRow row,
            Map<UUID, List<UUID>> mediaByItem,
            Map<UUID, List<SkuRow>> skuByItem,
            Map<ManualTargetKey, ManualSaleStatusRow> manualStatusByTarget,
            Map<UUID, SalesMenuReadback.InventoryAvailabilityFact> inventoryByItem,
            Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptionsByItem) {
        var draft = draftItem(
                row,
                mediaByItem,
                skuByItem,
                selectedOrderOptionsByItem,
                List.of(),
                List.of(),
                List.of(),
                frozenSalesUnit(row),
                null,
                null);
        ManualSaleStatusRow status = manualStatusByTarget.get(
                new ManualTargetKey(row.salesItemRef(), SalesMenuManualSaleTargetKind.ITEM, row.salesItemRef()));
        var manual = status == null
                ? new SalesMenuReadback.ManualSaleStatusFact(SalesMenuManualSaleState.NORMAL, null, null, null)
                : new SalesMenuReadback.ManualSaleStatusFact(
                        SalesMenuManualSaleState.valueOf(status.state()),
                        status.reason(),
                        status.changedAtEpochMillis(),
                        status.actorDisplaySnapshot());
        return new SalesMenuReadback.PublishedItemView(
                draft.salesItemRef(),
                draft.catalogItemRef(),
                draft.itemCode(),
                draft.displayName(),
                draft.productShape(),
                draft.saleContent(),
                draft.orderingConstraints(),
                draft.displayMedia(),
                draft.displayOrder(),
                inventoryByItem.getOrDefault(
                        row.salesItemRef(),
                        new SalesMenuReadback.InventoryAvailabilityFact("APPLICABLE", "UNKNOWN", "READ_UNAVAILABLE")),
                manual,
                manualSaleTargetStatuses(
                        row,
                        skuByItem.getOrDefault(row.salesItemRef(), List.of()),
                        selectedOrderOptionsByItem.getOrDefault(row.salesItemRef(), List.of()),
                        manualStatusByTarget),
                draft.version());
    }

    private SalesMenuSaleContent content(
            ItemRow row,
            List<SkuRow> skus,
            List<SalesMenuReadback.SalesMenuOrderOption> selectedOrderOptions,
            SalesMenuSalesUnit salesUnit) {
        SalesMenuSaleContentKind kind = contentKind(row.resolvedProductShape());
        List<SalesMenuSelectedOrderOption> selected = selectedOrderOptions.stream()
                .map(this::selectedOrderOption)
                .toList();
        if (kind == SalesMenuSaleContentKind.SKU_SELECTION) {
            return new SalesMenuSaleContent(
                    kind,
                    null,
                    skus.stream()
                            .map(sku -> new com.catering.v2s.salesmenu.domain.SalesMenuSkuPrice(
                                    sku.skuRef(),
                                    sku.resolvedSkuName(),
                                    sku.resolvedSkuCode(),
                                    sku.defaultPriceCents(),
                                    sku.listedPriceCents()))
                            .toList(),
                    selected,
                    null);
        }
        return new SalesMenuSaleContent(
                kind,
                row.listedPriceCents(),
                List.of(),
                selected,
                kind == SalesMenuSaleContentKind.WEIGHTED ? salesUnit : null);
    }

    private List<SalesMenuReadback.SalesMenuOrderOption> catalogOrderOptions(
            CatalogOwnerApi.SalesMenuItemFacts fact) {
        if (fact == null || fact.orderOptions() == null) return List.of();
        if (contentKind(fact.shapeKey()) != SalesMenuSaleContentKind.DIRECT && !fact.orderOptions().isEmpty()) {
            throw problem("SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED", 422, "当前商品形态不支持销售选项选择");
        }
        return fact.orderOptions().stream()
                .map(option -> new SalesMenuReadback.SalesMenuOrderOption(
                        option.definitionRef(),
                        option.name(),
                        option.selectionMode(),
                        option.displayOrder(),
                        option.required(),
                        option.minSelectionCount(),
                        option.maxSelectionCount(),
                        option.values().stream()
                                .map(value -> new SalesMenuReadback.SalesMenuOrderOptionValue(
                                        value.definitionValueRef(),
                                        value.name(),
                                        value.displayOrder(),
                                        value.defaultValue(),
                                        value.extraPrice()))
                                .toList()))
                .toList();
    }

    private SalesMenuSelectedOrderOption selectedOrderOption(SalesMenuReadback.SalesMenuOrderOption option) {
        return new SalesMenuSelectedOrderOption(
                option.definitionRef(),
                option.name(),
                option.selectionMode(),
                option.displayOrder(),
                option.required(),
                option.minSelectionCount(),
                option.maxSelectionCount(),
                option.values().stream()
                        .map(value -> new SalesMenuSelectedOrderOptionValue(
                                value.definitionValueRef(),
                                value.name(),
                                value.displayOrder(),
                                value.defaultValue(),
                                value.extraPrice()))
                        .toList());
    }

    private List<SalesMenuReadback.SalesMenuSkuCandidate> skuCandidates(
            CatalogOwnerApi.SalesMenuItemFacts fact) {
        if (fact == null || fact.skus() == null) return List.of();
        return fact.skus().stream()
                .filter(sku -> "ENABLED".equals(sku.status()) && sku.standardSalePrice() != null)
                .map(sku -> new SalesMenuReadback.SalesMenuSkuCandidate(
                        sku.productSkuRef(), sku.skuName(), sku.skuCode(), sku.standardSalePrice()))
                .toList();
    }

    private List<UUID> staleSelectedSkuRefs(CatalogOwnerApi.SalesMenuItemFacts fact, List<SkuRow> selected) {
        if (fact == null || selected.isEmpty()) return List.of();
        Set<UUID> candidateRefs = fact.skus().stream()
                .filter(sku -> "ENABLED".equals(sku.status()) && sku.standardSalePrice() != null)
                .map(CatalogOwnerApi.SalesMenuSkuFact::productSkuRef)
                .collect(java.util.stream.Collectors.toSet());
        return selected.stream()
                .map(SkuRow::skuRef)
                .filter(ref -> !candidateRefs.contains(ref))
                .distinct()
                .toList();
    }

    private Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptionsByItem(
            List<ItemRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs = rows.stream().map(ItemRow::salesItemRef).distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(rows.getFirst().versionRef());
        arguments.addAll(itemRefs);
        List<OrderOptionGroupRow> groups = repository.query(
                "SELECT sales_item_ref,definition_ref,resolved_definition_name,selection_mode,required,"
                        + "min_selection_count,max_selection_count,display_order "
                        + "FROM sales_menu.sales_version_item_order_option WHERE version_ref=? "
                        + "AND sales_item_ref IN (" + placeholders + ") "
                        + "ORDER BY sales_item_ref,display_order,definition_ref",
                SalesMenuOwnerService::orderOptionGroupRow,
                arguments.toArray());
        if (groups.isEmpty()) return Map.of();
        List<Object> valueArguments = new ArrayList<>();
        valueArguments.add(rows.getFirst().versionRef());
        valueArguments.addAll(itemRefs);
        List<OrderOptionValueRow> values = repository.query(
                "SELECT sales_item_ref,definition_ref,definition_value_ref,resolved_value_name,display_order,"
                        + "default_value,extra_price "
                        + "FROM sales_menu.sales_version_item_order_option_value WHERE version_ref=? "
                        + "AND sales_item_ref IN (" + placeholders + ") "
                        + "ORDER BY sales_item_ref,definition_ref,display_order,definition_value_ref",
                SalesMenuOwnerService::orderOptionValueRow,
                valueArguments.toArray());
        Map<OptionKey, List<OrderOptionValueRow>> valuesByGroup = new LinkedHashMap<>();
        values.forEach(value -> valuesByGroup
                .computeIfAbsent(new OptionKey(value.salesItemRef(), value.definitionRef()), ignored -> new ArrayList<>())
                .add(value));
        Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> result = new LinkedHashMap<>();
        for (OrderOptionGroupRow group : groups) {
            List<SalesMenuReadback.SalesMenuOrderOptionValue> optionValues = valuesByGroup
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

    private List<SalesMenuReadback.ManualSaleTargetStatus> manualSaleTargetStatuses(
            ItemRow row,
            List<SkuRow> skus,
            List<SalesMenuReadback.SalesMenuOrderOption> options,
            Map<ManualTargetKey, ManualSaleStatusRow> statuses) {
        List<SalesMenuReadback.ManualSaleTargetStatus> result = new ArrayList<>();
        for (SkuRow sku : skus) {
            result.add(manualSaleTargetStatus(
                    new ManualTargetKey(row.salesItemRef(), SalesMenuManualSaleTargetKind.SKU, sku.skuRef()),
                    sku.resolvedSkuName(),
                    statuses));
        }
        for (SalesMenuReadback.SalesMenuOrderOption option : options) {
            for (SalesMenuReadback.SalesMenuOrderOptionValue value : option.values()) {
                result.add(manualSaleTargetStatus(
                        new ManualTargetKey(
                                row.salesItemRef(),
                                SalesMenuManualSaleTargetKind.ORDER_OPTION_VALUE,
                                value.definitionValueRef()),
                        value.name(),
                        statuses));
            }
        }
        return List.copyOf(result);
    }

    private SalesMenuReadback.ManualSaleTargetStatus manualSaleTargetStatus(
            ManualTargetKey key, String displayName, Map<ManualTargetKey, ManualSaleStatusRow> statuses) {
        ManualSaleStatusRow status = statuses.get(key);
        return new SalesMenuReadback.ManualSaleTargetStatus(
                key.targetKind(),
                key.targetRef(),
                displayName,
                status == null ? SalesMenuManualSaleState.NORMAL : SalesMenuManualSaleState.valueOf(status.state()),
                status == null ? null : status.reason(),
                status == null ? null : status.changedAtEpochMillis(),
                status == null ? null : status.actorDisplaySnapshot());
    }

    private SalesMenuSalesUnit catalogSalesUnit(CatalogOwnerApi.SalesMenuItemFacts fact) {
        return fact == null ? null : catalogSalesUnit(fact.salesUnitSnapshot());
    }

    private SalesMenuSalesUnit catalogSalesUnit(InventoryOwnerApi.UnitSnapshot snapshot) {
        if (snapshot == null) return null;
        return new SalesMenuSalesUnit(
                snapshot.unitRef(), snapshot.code(), snapshot.name(), snapshot.unitDimension(), snapshot.precision());
    }

    private SalesMenuSalesUnit frozenSalesUnit(ItemRow row) {
        if (row.resolvedSalesUnitRef() == null) return null;
        return new SalesMenuSalesUnit(
                row.resolvedSalesUnitRef(),
                row.resolvedSalesUnitCode(),
                row.resolvedSalesUnitName(),
                row.resolvedSalesUnitDimension(),
                row.resolvedSalesUnitPrecision());
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
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(rows.getFirst().versionRef());
        arguments.addAll(itemRefs);
        Map<UUID, List<SkuRow>> result = new LinkedHashMap<>();
        repository
                .query(
                        "SELECT sales_item_ref,sku_ref,listed_price_cents,resolved_sku_code,resolved_sku_name,"
                                + "default_price_cents,display_order FROM sales_menu.sales_version_item_sku "
                                + "WHERE version_ref=? AND sales_item_ref IN (" + placeholders + ") "
                                + "ORDER BY sales_item_ref,display_order,sku_ref",
                        SalesMenuOwnerService::skuRow,
                        arguments.toArray())
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
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(rows.getFirst().versionRef());
        arguments.addAll(itemRefs);
        Map<UUID, List<UUID>> result = new HashMap<>();
        repository
                .query(
                        "SELECT sales_item_ref,asset_ref,display_order "
                                + "FROM sales_menu.sales_version_item_media WHERE version_ref=? "
                                + "AND sales_item_ref IN (" + placeholders + ") "
                                + "ORDER BY sales_item_ref,display_order,asset_ref",
                        SalesMenuOwnerService::mediaItemRow,
                        arguments.toArray())
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

    private Map<UUID, SalesMenuReadback.InventoryAvailabilityFact> inventoryAvailabilityByItem(
            SalesMenuScope scope, List<ItemRow> rows, Map<UUID, List<SkuRow>> skuByItem) {
        if (rows.isEmpty()) return Map.of();
        if (inventory == null || organization == null) {
            Map<UUID, SalesMenuReadback.InventoryAvailabilityFact> fallback = new LinkedHashMap<>();
            rows.forEach(row -> fallback.put(
                    row.salesItemRef(),
                    new SalesMenuReadback.InventoryAvailabilityFact("APPLICABLE", "UNKNOWN", "READ_UNAVAILABLE")));
            return Map.copyOf(fallback);
        }
        OrganizationOwnerApi.SalesMenuStoreJudgment store = requireStore(scope);
        LinkedHashSet<InventoryOwnerApi.InventoryTargetRef> identities = new LinkedHashSet<>();
        rows.forEach(row -> {
            List<SkuRow> skus = skuByItem.getOrDefault(row.salesItemRef(), List.of());
            if (contentKind(row.resolvedProductShape()) == SalesMenuSaleContentKind.SKU_SELECTION && !skus.isEmpty()) {
                skus.forEach(sku ->
                        identities.add(new InventoryOwnerApi.InventoryTargetRef(row.catalogItemRef(), sku.skuRef())));
            } else if (contentKind(row.resolvedProductShape()) != SalesMenuSaleContentKind.SKU_SELECTION) {
                identities.add(new InventoryOwnerApi.InventoryTargetRef(row.catalogItemRef(), null));
            }
        });
        if (identities.isEmpty()) {
            Map<UUID, SalesMenuReadback.InventoryAvailabilityFact> notApplicable = new LinkedHashMap<>();
            rows.forEach(row -> notApplicable.put(
                    row.salesItemRef(), new SalesMenuReadback.InventoryAvailabilityFact("NOT_APPLICABLE", null, null)));
            return Map.copyOf(notApplicable);
        }
        List<InventoryOwnerApi.InventoryAvailabilityFact> facts;
        try {
            facts = inventory.readSalesMenuAvailability(store.dataNodeRef(), store.brandRef(), identities);
        } catch (RuntimeException unavailable) {
            facts = identities.stream()
                    .map(identity -> InventoryOwnerApi.InventoryAvailabilityFact.unknown(identity, null))
                    .toList();
        }
        Map<InventoryOwnerApi.InventoryTargetRef, InventoryOwnerApi.InventoryAvailabilityFact> byIdentity =
                new LinkedHashMap<>();
        facts.forEach(fact -> byIdentity.put(fact.identity(), fact));
        Map<UUID, SalesMenuReadback.InventoryAvailabilityFact> result = new LinkedHashMap<>();
        rows.forEach(row -> result.put(
                row.salesItemRef(),
                aggregateInventoryFacts(row, skuByItem.getOrDefault(row.salesItemRef(), List.of()), byIdentity)));
        return Map.copyOf(result);
    }

    private SalesMenuReadback.InventoryAvailabilityFact aggregateInventoryFacts(
            ItemRow row,
            List<SkuRow> skus,
            Map<InventoryOwnerApi.InventoryTargetRef, InventoryOwnerApi.InventoryAvailabilityFact> byIdentity) {
        List<InventoryOwnerApi.InventoryAvailabilityFact> facts = new ArrayList<>();
        if (contentKind(row.resolvedProductShape()) == SalesMenuSaleContentKind.SKU_SELECTION) {
            skus.forEach(sku -> facts.add(byIdentity.getOrDefault(
                    new InventoryOwnerApi.InventoryTargetRef(row.catalogItemRef(), sku.skuRef()),
                    InventoryOwnerApi.InventoryAvailabilityFact.unknown(
                            new InventoryOwnerApi.InventoryTargetRef(row.catalogItemRef(), sku.skuRef()), null))));
        } else {
            facts.add(byIdentity.getOrDefault(
                    new InventoryOwnerApi.InventoryTargetRef(row.catalogItemRef(), null),
                    InventoryOwnerApi.InventoryAvailabilityFact.unknown(
                            new InventoryOwnerApi.InventoryTargetRef(row.catalogItemRef(), null), null)));
        }
        if (facts.isEmpty()
                || facts.stream()
                        .allMatch(fact -> fact.applicability()
                                == InventoryOwnerApi.InventoryAvailabilityApplicability.NOT_APPLICABLE)) {
            return new SalesMenuReadback.InventoryAvailabilityFact("NOT_APPLICABLE", null, null);
        }
        if (facts.stream().anyMatch(fact -> fact.state() == InventoryOwnerApi.InventoryAvailabilityState.AVAILABLE)) {
            return new SalesMenuReadback.InventoryAvailabilityFact("APPLICABLE", "AVAILABLE", null);
        }
        if (facts.stream().anyMatch(fact -> fact.state() == InventoryOwnerApi.InventoryAvailabilityState.UNKNOWN)) {
            return new SalesMenuReadback.InventoryAvailabilityFact("APPLICABLE", "UNKNOWN", "READ_UNAVAILABLE");
        }
        InventoryOwnerApi.InventoryAvailabilityReason reason = facts.stream()
                .map(InventoryOwnerApi.InventoryAvailabilityFact::reason)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(InventoryOwnerApi.InventoryAvailabilityReason.OUT_OF_STOCK);
        return new SalesMenuReadback.InventoryAvailabilityFact("APPLICABLE", "AUTO_UNAVAILABLE", reason.name());
    }

    private Map<ManualTargetKey, ManualSaleStatusRow> manualStatusByTarget(UUID channel, List<ItemRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs =
                rows.stream().map(ItemRow::salesItemRef).distinct().toList();
        String placeholders = String.join(",", Collections.nCopies(itemRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>();
        arguments.add(channel);
        arguments.addAll(itemRefs);
        Map<ManualTargetKey, ManualSaleStatusRow> result = new HashMap<>();
        repository
                .query(
                        "SELECT sales_item_ref,target_kind,target_ref,state,reason,changed_at_epoch_millis,"
                                + "actor_display_snapshot "
                                + "FROM sales_menu.sales_manual_status_current WHERE channel_ref=? "
                                + "AND sales_item_ref IN (" + placeholders + ")",
                        SalesMenuOwnerService::manualSaleStatusRow,
                        arguments.toArray())
                .forEach(row -> result.put(
                        new ManualTargetKey(row.salesItemRef(), row.targetKind(), row.targetRef()), row));
        return Map.copyOf(result);
    }

    private SalesMenuDisplayMedia displayMedia(ItemRow row, List<UUID> refs) {
        return new SalesMenuDisplayMedia(
                "CUSTOM".equals(row.displayMediaMode())
                        ? SalesMenuDisplayMediaMode.CUSTOM
                        : SalesMenuDisplayMediaMode.INHERIT_CATALOG,
                refs,
                refs.isEmpty() ? null : refs.getFirst());
    }

    private String displayName(ItemRow row) {
        return row.displayNameOverride() != null ? row.displayNameOverride() : row.resolvedItemName();
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

    private String publicShape(String shape) {
        if (shape == null) return null;
        return switch (shape) {
            case "STANDARD_SALE_COUNTED" -> "ORDINARY";
            case "SKU_VARIANT_SALE_COUNTED" -> "SKU";
            case "STANDARD_SALE_WEIGHED" -> "WEIGHTED";
            default -> shape;
        };
    }

    private UUID draftVersion(UUID menu) {
        return repository
                .query(
                        "SELECT current_draft_version_ref FROM sales_menu.sales_collection " + "WHERE collection_ref=?",
                        SalesMenuOwnerService::uuidValueRow,
                        menu)
                .stream()
                .findFirst()
                .orElseThrow(() -> problem("SALES_MENU_NOT_FOUND", 404, "销售菜单不存在"))
                .value();
    }

    private void advanceDraftRevision(UUID version) {
        if (repository.update(
                        "UPDATE sales_menu.sales_collection_version SET revision=revision+1 "
                                + "WHERE version_ref=? AND kind='DRAFT'",
                        version)
                != 1) throw problem("SALES_MENU_DRAFT_NOT_FOUND", 404, "销售菜单草稿不存在");
    }

    private UUID publishedVersion(UUID menu) {
        return repository
                .query(
                        "SELECT latest_published_version_ref FROM sales_menu.sales_collection "
                                + "WHERE collection_ref=?",
                        SalesMenuOwnerService::uuidValueRow,
                        menu)
                .stream()
                .filter(row -> row.value() != null)
                .findFirst()
                .orElseThrow(() -> problem("PUBLICATION_NOT_FOUND", 404, "尚无发布版本"))
                .value();
    }

    private void replaceMedia(UUID version, UUID item, SalesMenuDisplayMedia media) {
        repository.update(
                "DELETE FROM sales_menu.sales_version_item_media WHERE version_ref=? AND sales_item_ref=?",
                version,
                item);
        if (media.mode() == SalesMenuDisplayMediaMode.CUSTOM)
            for (int i = 0; i < media.assetRefs().size(); i++)
                    repository.update(
                            "INSERT INTO sales_menu.sales_version_item_media(version_ref,sales_item_ref,"
                                + "asset_ref,display_order) VALUES(?,?,?,?)",
                        version,
                        item,
                        media.assetRefs().get(i),
                        i);
    }

    private void replaceOrderOptions(
            UUID version, UUID item, List<SalesMenuReadback.SalesMenuOrderOption> options) {
        repository.update(
                "DELETE FROM sales_menu.sales_version_item_order_option_value "
                        + "WHERE version_ref=? AND sales_item_ref=?",
                version,
                item);
        repository.update(
                "DELETE FROM sales_menu.sales_version_item_order_option WHERE version_ref=? AND sales_item_ref=?",
                version,
                item);
        for (SalesMenuReadback.SalesMenuOrderOption option : options) {
            repository.update(
                    "INSERT INTO sales_menu.sales_version_item_order_option(version_ref,sales_item_ref,"
                            + "definition_ref,resolved_definition_name,selection_mode,required,min_selection_count,"
                            + "max_selection_count,display_order) VALUES(?,?,?,?,?,?,?,?,?)",
                    version,
                    item,
                    option.definitionRef(),
                    option.name(),
                    option.selectionMode(),
                    option.required(),
                    option.minSelectionCount(),
                    option.maxSelectionCount(),
                    option.displayOrder());
            for (SalesMenuReadback.SalesMenuOrderOptionValue value : option.values()) {
                repository.update(
                        "INSERT INTO sales_menu.sales_version_item_order_option_value(version_ref,sales_item_ref,"
                                + "definition_ref,definition_value_ref,resolved_value_name,display_order,"
                                + "default_value,extra_price) VALUES(?,?,?,?,?,?,?,?)",
                        version,
                        item,
                        option.definitionRef(),
                        value.definitionValueRef(),
                        value.name(),
                        value.displayOrder(),
                        value.defaultValue(),
                        value.extraPrice());
            }
        }
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

    private void requireDraftCatalogItem(CatalogOwnerApi.SalesMenuItemFacts fact) {
        if (fact == null
                || fact.itemRef() == null
                || fact.itemCode() == null
                || fact.itemName() == null
                || fact.shapeKey() == null
                || !supportedCatalogShape(fact.shapeKey())) {
            throw problem("SALES_MENU_ITEM_REFERENCE_INVALID", 422, "商品目录引用无效");
        }
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

    private List<SalesMenuReadback.SalesMenuOrderOption> requireDraftItemUpdate(
            CatalogOwnerApi.SalesMenuItemFacts fact, SalesMenuOwnerApi.ItemUpdateCommand command) {
        requireDraftCatalogItem(fact);
        SalesMenuSaleContentInput content = command.saleContent();
        SalesMenuOrderingConstraints constraints = command.orderingConstraints();
        SalesMenuSaleContentKind expectedKind = contentKind(fact.shapeKey());
        if (content.kind() != expectedKind) {
            throw problem("SALES_MENU_DRAFT_INVALID", 422, "销售内容形态与商品目录不匹配");
        }
        List<SalesMenuReadback.SalesMenuOrderOption> authoritativeOptions =
                authoritativeOrderOptionRows(fact, content);
        switch (contentKind(fact.shapeKey())) {
            case SKU_SELECTION -> {
                if (content.listedPriceCents() != null || content.skuPrices().isEmpty()) {
                    if (content.skuPrices().isEmpty()) {
                        throw problem("SALES_MENU_SKU_SELECTION_EMPTY", 422, "按规格商品至少选择一个规格");
                    }
                    throw problem("SALES_MENU_DRAFT_INVALID", 422, "按规格商品必须逐规格维护挂牌价");
                }
                Set<UUID> selected = new LinkedHashSet<>();
                for (var requested : content.skuPrices()) {
                    if (!selected.add(requested.skuRef())) {
                        throw problem("SALES_MENU_SKU_REFERENCE_INVALID", 422, "商品规格引用重复");
                    }
                    CatalogOwnerApi.SalesMenuSkuFact sku = fact.skus().stream()
                            .filter(candidate -> requested.skuRef().equals(candidate.productSkuRef()))
                            .findFirst()
                            .orElseThrow(() ->
                                    problem("SALES_MENU_SKU_REFERENCE_INVALID", 422, SKU_REFERENCE_INVALID_MESSAGE));
                    if (sku.standardSalePrice() == null || !"ENABLED".equals(sku.status())) {
                        throw problem("SALES_MENU_SKU_REFERENCE_INVALID", 422, "商品规格不可销售");
                    }
                }
            }
            case WEIGHTED -> {
                requirePublicPrice(content);
                if (constraints.minItemQuantity() != null || constraints.quantityStep() != null) {
                    throw problem("SALES_MENU_CONSTRAINT_INVALID", 422, "称重商品不接受按份约束");
                }
                if (!content.skuPrices().isEmpty()) {
                    throw problem("SALES_MENU_DRAFT_INVALID", 422, "称重商品不可携带规格挂牌价");
                }
            }
            case DIRECT, COMPOSITE -> {
                requirePublicPrice(content);
                if (!content.skuPrices().isEmpty()) {
                    throw problem("SALES_MENU_DRAFT_INVALID", 422, "普通销售项不可携带规格挂牌价");
                }
            }
        }
        return authoritativeOptions;
    }

    private void requirePublicPrice(SalesMenuSaleContentInput content) {
        if (content.listedPriceCents() == null) {
            throw problem("SALES_MENU_PRICE_REQUIRED", 422, "销售项挂牌价不能为空");
        }
    }

    private List<SkuRow> authoritativeSkuRows(
            CatalogOwnerApi.SalesMenuItemFacts fact, SalesMenuSaleContentInput content) {
        Map<UUID, CatalogOwnerApi.SalesMenuSkuFact> byRef = new LinkedHashMap<>();
        fact.skus().forEach(sku -> byRef.put(sku.productSkuRef(), sku));
        List<SkuRow> result = new ArrayList<>();
        for (int index = 0; index < content.skuPrices().size(); index++) {
            var requested = content.skuPrices().get(index);
            var catalogSku = byRef.get(requested.skuRef());
            if (catalogSku == null
                    || catalogSku.standardSalePrice() == null
                    || !"ENABLED".equals(catalogSku.status())) {
                throw problem("SALES_MENU_SKU_REFERENCE_INVALID", 422, "商品规格引用无效");
            }
            result.add(new SkuRow(
                    null,
                    catalogSku.productSkuRef(),
                    requested.listedPriceCents(),
                    catalogSku.skuCode(),
                    catalogSku.skuName(),
                    catalogSku.standardSalePrice(),
                    index));
        }
        return List.copyOf(result);
    }

    private List<SalesMenuReadback.SalesMenuOrderOption> authoritativeOrderOptionRows(
            CatalogOwnerApi.SalesMenuItemFacts fact, SalesMenuSaleContentInput content) {
        List<com.catering.v2s.salesmenu.domain.SalesMenuOrderOptionSelectionInput> submitted =
                content.orderOptionSelections();
        SalesMenuSaleContentKind kind = contentKind(fact.shapeKey());
        if (kind != SalesMenuSaleContentKind.DIRECT) {
            if (!submitted.isEmpty() || (fact.orderOptions() != null && !fact.orderOptions().isEmpty())) {
                throw problem(
                        "SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED",
                        422,
                        "当前商品形态不支持销售选项选择");
            }
            return List.of();
        }
        List<CatalogOwnerApi.SalesMenuOrderOptionFact> catalogOptions =
                fact.orderOptions() == null ? List.of() : fact.orderOptions();
        Map<UUID, CatalogOwnerApi.SalesMenuOrderOptionFact> catalogByRef = new LinkedHashMap<>();
        for (var option : catalogOptions) {
            if (catalogByRef.put(option.definitionRef(), option) != null) {
                throw problem("SALES_MENU_ORDER_OPTION_REFERENCE_INVALID", 422, "商品选项定义重复");
            }
        }
        Map<UUID, com.catering.v2s.salesmenu.domain.SalesMenuOrderOptionSelectionInput> submittedByRef =
                new LinkedHashMap<>();
        for (var selection : submitted) {
            if (submittedByRef.put(selection.definitionRef(), selection) != null) {
                throw problem("SALES_MENU_ORDER_OPTION_SELECTION_INVALID", 422, "商品选项定义重复");
            }
        }
        if (!catalogByRef.keySet().equals(submittedByRef.keySet())) {
            throw problem("SALES_MENU_ORDER_OPTION_SELECTION_INVALID", 422, "商品选项定义集合已变化");
        }
        List<SalesMenuReadback.SalesMenuOrderOption> result = new ArrayList<>();
        for (var option : catalogOptions) {
            var selection = submittedByRef.get(option.definitionRef());
            Set<UUID> selectedValueRefs = new LinkedHashSet<>();
            for (UUID valueRef : selection.selectedValueRefs()) {
                if (!selectedValueRefs.add(valueRef)) {
                    throw problem("SALES_MENU_ORDER_OPTION_SELECTION_INVALID", 422, "商品选项值重复");
                }
            }
            Map<UUID, CatalogOwnerApi.SalesMenuOrderOptionValueFact> valuesByRef = new LinkedHashMap<>();
            for (var value : option.values()) valuesByRef.put(value.definitionValueRef(), value);
            if (!valuesByRef.keySet().containsAll(selectedValueRefs)) {
                throw problem("SALES_MENU_ORDER_OPTION_REFERENCE_INVALID", 422, "商品选项值引用无效");
            }
            int minimum = option.minSelectionCount() == null
                    ? (option.required() ? 1 : 0)
                    : option.minSelectionCount();
            if (selectedValueRefs.size() < minimum) {
                throw problem("SALES_MENU_ORDER_OPTION_SELECTION_INVALID", 422, "必选商品选项至少选择一个值");
            }
            List<SalesMenuReadback.SalesMenuOrderOptionValue> resolvedValues = option.values().stream()
                    .filter(value -> selectedValueRefs.contains(value.definitionValueRef()))
                    .map(value -> new SalesMenuReadback.SalesMenuOrderOptionValue(
                            value.definitionValueRef(),
                            value.name(),
                            value.displayOrder(),
                            value.defaultValue(),
                            value.extraPrice()))
                    .toList();
            result.add(new SalesMenuReadback.SalesMenuOrderOption(
                    option.definitionRef(),
                    option.name(),
                    option.selectionMode(),
                    option.displayOrder(),
                    option.required(),
                    option.minSelectionCount(),
                    option.maxSelectionCount(),
                    resolvedValues));
        }
        return List.copyOf(result);
    }

    private void validateAssetRefs(SalesMenuDisplayMedia media) {
        if (assets == null
                || media.mode() != SalesMenuDisplayMediaMode.CUSTOM
                || media.assetRefs().isEmpty()) return;
        Set<UUID> refs = new LinkedHashSet<>(media.assetRefs());
        Map<UUID, SalesMenuAssetReadApi.SalesMenuItemImage> facts = assets.readSalesMenuItemImages(refs);
        for (UUID ref : refs) {
            var fact = facts.get(ref);
            if (fact == null
                    || fact.usage() == null
                    || !"SALES_MENU_ITEM_IMAGE".equals(fact.usage().name())
                    || !"ACTIVE".equals(fact.status())) {
                throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片资源无效");
            }
        }
    }

    private void claimStagedAssets(SalesMenuOwnerApi.ItemUpdateCommand command, ItemRow current) {
        List<SalesMenuAssetCommandApi.AssetBinding> bindings = command.assetBindings();
        if (command.displayMedia().mode() != SalesMenuDisplayMediaMode.CUSTOM) {
            if (!bindings.isEmpty()) {
                throw problem("SALES_MENU_ASSET_INVALID", 422, INHERITED_IMAGE_BINDING_MESSAGE);
            }
            return;
        }
        Set<UUID> refs = new LinkedHashSet<>(command.displayMedia().assetRefs());
        Set<UUID> boundRefs = new LinkedHashSet<>();
        for (SalesMenuAssetCommandApi.AssetBinding binding : bindings) {
            if (binding == null || !refs.contains(binding.assetRef()) || !boundRefs.add(binding.assetRef())) {
                throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片绑定凭证无效");
            }
        }
        if (refs.isEmpty()) return;
        Set<UUID> stagedRefs = new LinkedHashSet<>(boundRefs);
        if (assets == null) {
            if (!boundRefs.equals(refs)) {
                throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片资源无法核验");
            }
        } else {
            Set<UUID> unboundRefs = new LinkedHashSet<>(refs);
            unboundRefs.removeAll(boundRefs);
            if (!unboundRefs.isEmpty()) {
                Map<UUID, SalesMenuAssetReadApi.SalesMenuItemImage> facts = assets.readSalesMenuItemImages(unboundRefs);
                for (UUID ref : unboundRefs) {
                    SalesMenuAssetReadApi.SalesMenuItemImage fact = facts.get(ref);
                    if (fact == null
                            || fact.usage()
                                    != com.catering.v2s.platform.asset.api.SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE
                            || !"ACTIVE".equals(fact.status())) {
                        throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片资源无效");
                    }
                }
            }
        }
        if (stagedRefs.isEmpty()) return;
        if (assetCommands == null) {
            throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片绑定能力未配置");
        }
        SalesMenuAssetTarget target = new SalesMenuAssetTarget(
                command.context().scope().groupWorkspaceKey(),
                command.context().scope().storeRef(),
                command.context().salesMenuRef(),
                command.salesItemRef(),
                com.catering.v2s.salesmenu.domain.SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE,
                current.version());
        SalesMenuReadback.AssetTargetReadback judged = requireSalesMenuItemAssetTarget(
                SalesMenuAssetTargetMode.CLAIM,
                target,
                command.context().ownerScopeGrant(),
                command.context().contextVersion());
        SalesMenuReadback.AssetClaim claim;
        try {
            claim = assetCommands.claimSalesMenuItemImages(
                    judged.target(),
                    command.context().ownerScopeGrant(),
                    command.context().contextVersion(),
                    bindings);
        } catch (SalesMenuAssetCommandApi.AssetTargetRejectedException failure) {
            String message = "图片资源目标不属于销售菜单商品";
            throw problem("SALES_MENU_ASSET_TARGET_MISMATCH", 403, message, failure);
        } catch (SalesMenuAssetCommandApi.AssetClaimRejectedException failure) {
            throw problem("SALES_MENU_ASSET_INVALID", 422, "销售菜单图片绑定凭证无效", failure);
        }
        Map<UUID, SalesMenuReadback.ClaimedAsset> claimed = claim.assets().stream()
                .collect(java.util.stream.Collectors.toMap(SalesMenuReadback.ClaimedAsset::assetRef, value -> value));
        for (UUID ref : stagedRefs) {
            SalesMenuReadback.ClaimedAsset result = claimed.get(ref);
            if (result == null || !"ACTIVE".equals(result.status())) {
                throw problem("SALES_MENU_ASSET_LIFECYCLE_CONFLICT", 409, "销售菜单图片绑定结果无效");
            }
        }
    }

    private List<UUID> activationChannels(UUID menu) {
        return repository
                .query(
                        "SELECT channel_ref FROM sales_menu.sales_collection_activation WHERE collection_ref=? "
                                + "AND status='ENABLED' ORDER BY channel_ref",
                        SalesMenuOwnerService::uuidValueRow,
                        menu)
                .stream()
                .map(UuidValueRow::value)
                .toList();
    }

    private OrganizationOwnerApi.SalesMenuStoreJudgment requireOwnerCommand(
            SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        OrganizationOwnerApi.SalesMenuStoreJudgment store = requireStore(context.scope());
        if (channelRef != null) requireChannel(context.scope(), channelRef);
        return store;
    }

    private void requireCas(SalesMenuTarget target, long expectedVersion) {
        if (ownerApisConfigured() && !repository.compareAndSetVersion(target, expectedVersion)) {
            throw problem("SALES_MENU_VERSION_CONFLICT", 409, "销售菜单版本已变化");
        }
    }

    private boolean ownerApisConfigured() {
        return catalog != null && inventory != null && channels != null && organization != null;
    }

    private void requireNotArchived(com.catering.v2s.salesmenu.domain.SalesMenuAggregate menu) {
        if (menu.archived()) throw problem("SALES_MENU_ARCHIVED", 409, "已归档销售菜单不可修改");
    }

    private void requireOwnerRead(SalesMenuScope scope, UUID channelRef) {
        requireStore(scope);
        if (channelRef != null) requireChannel(scope, channelRef);
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

    private Map<UUID, Long> alreadyAddedCounts(UUID menu, UUID version, Set<UUID> catalogItemRefs) {
        if (catalogItemRefs.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(catalogItemRefs.size(), "?"));
        List<Object> arguments = new ArrayList<>(List.of(menu, version));
        arguments.addAll(catalogItemRefs);
        Map<UUID, Long> result = new LinkedHashMap<>();
        repository
                .query(
                        "SELECT i.catalog_item_ref,COUNT(*) AS item_count FROM sales_menu.sales_version_item v "
                                + "JOIN sales_menu.sales_item i ON i.sales_item_ref=v.sales_item_ref "
                                + "WHERE i.collection_ref=? AND v.version_ref=? AND i.catalog_item_ref IN ("
                                + placeholders
                                + ") GROUP BY i.catalog_item_ref",
                        SalesMenuOwnerService::countByItemRow,
                        arguments.toArray())
                .forEach(row -> result.put(row.itemRef(), row.count()));
        return Map.copyOf(result);
    }

    private com.catering.v2s.salesmenu.domain.SalesMenuAggregate requireMenu(SalesMenuTarget target, boolean lock) {
        return (lock ? repository.findForUpdate(target) : repository.find(target))
                .orElseThrow(() -> problem("SALES_MENU_NOT_FOUND", 404, "销售菜单不存在"));
    }

    private void requireSection(UUID menu, UUID version, UUID section) {
        if (repository
                .query(
                        "SELECT 1 FROM sales_menu.sales_version_section "
                                + "WHERE collection_ref=? AND version_ref=? AND section_ref=?",
                        SalesMenuOwnerService::existsRow,
                        menu,
                        version,
                        section)
                .isEmpty()) throw problem("SECTION_NOT_FOUND", 404, "分组不存在");
    }

    private ItemRow requireDraftItem(SalesMenuAggregate menu, UUID version, UUID item) {
        return itemRows(menu, SalesMenuVersionKind.DRAFT, version, null, item).stream()
                .findFirst()
                .orElseThrow(() -> problem("SALES_ITEM_NOT_FOUND", 404, "销售菜单商品不存在"));
    }

    private void requireItem(UUID version, UUID item) {
        if (repository
                .query(
                        "SELECT 1 FROM sales_menu.sales_version_item WHERE version_ref=? AND sales_item_ref=?",
                        SalesMenuOwnerService::existsRow,
                        version,
                        item)
                .isEmpty()) throw problem("SALES_ITEM_NOT_FOUND", 404, "销售菜单商品不存在");
    }

    private MoveCurrentRow requireSectionMoveCurrent(UUID menu, UUID version, UUID section) {
        return repository
                .query(
                        "SELECT section_ref,display_order FROM sales_menu.sales_version_section "
                                + "WHERE collection_ref=? AND version_ref=? AND section_ref=? FOR UPDATE",
                        SalesMenuOwnerService::moveCurrentRow,
                        menu,
                        version,
                        section)
                .stream()
                .findFirst()
                .orElseThrow(() -> problem("SECTION_NOT_FOUND", 404, "分组不存在"));
    }

    private MoveCurrentRow requireItemMoveCurrent(UUID version, UUID item) {
        return repository
                .query(
                        "SELECT section_ref,display_order FROM sales_menu.sales_version_item "
                                + "WHERE version_ref=? AND sales_item_ref=? FOR UPDATE",
                        SalesMenuOwnerService::moveCurrentRow,
                        version,
                        item)
                .stream()
                .findFirst()
                .orElseThrow(() -> problem("SALES_ITEM_NOT_FOUND", 404, "销售菜单商品不存在"));
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
        repository.update(
                "INSERT INTO sales_menu.sales_operation_record(record_ref,workspace_uuid,group_workspace_key,"
                        + "store_ref,channel_ref,collection_ref,operation_kind,target_ref,target_kind,"
                        + "target_display_snapshot,result,actor_type,actor_id,actor_display_snapshot,"
                        + "occurred_at_epoch_millis,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
        SalesMenuAggregate persisted = repository
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

    private SalesMenuReadback.Activation activation(MenuListRow row) {
        return row.channelRef() == null
                ? null
                : new SalesMenuReadback.Activation(row.channelRef(), row.activationStatus(), row.activationVersion());
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

    private static OpaqueCollectionCursor.Position decodeCursor(String cursor, SalesMenuCursorIdentity identity) {
        try {
            return OpaqueCollectionCursor.decode(cursor, identity.value());
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
    }

    private static long parseLongCursor(OpaqueCollectionCursor.Position position, String field) {
        try {
            return Long.parseLong(position.sortKey());
        } catch (NumberFormatException failure) {
            throw problem("VALIDATION_ERROR", 422, field + " cursor is invalid", failure);
        }
    }

    private static MenuListRow menuListRow(ResultSet result, int ignored) throws SQLException {
        return new MenuListRow(
                result.getObject("collection_ref", UUID.class),
                result.getObject("store_ref", UUID.class),
                result.getString("name"),
                result.getObject("archived_at_epoch_millis", Long.class),
                result.getLong("version"),
                result.getLong("draft_revision"),
                result.getObject("published_revision", Long.class),
                result.getObject("latest_published_source_draft_revision", Long.class),
                result.getString("schedule_kind"),
                localTime(result.getTime("schedule_start_local_time")),
                localTime(result.getTime("schedule_end_local_time")),
                result.getObject("channel_ref", UUID.class),
                result.getString("status"),
                result.getObject("activation_version", Long.class));
    }

    private static boolean draftDirty(long draftRevision, Long latestPublishedSourceDraftRevision) {
        return latestPublishedSourceDraftRevision == null || draftRevision != latestPublishedSourceDraftRevision;
    }

    private static ActivationRow activationRow(ResultSet result, int ignored) throws SQLException {
        return new ActivationRow(
                result.getObject("channel_ref", UUID.class), result.getString("status"), result.getLong("version"));
    }

    private static PublicationItemRow publicationItemRow(ResultSet result, int ignored) throws SQLException {
        return new PublicationItemRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getString("resolved_item_name"),
                result.getString("resolved_item_code"));
    }

    private static Boolean existsRow(ResultSet result, int ignored) throws SQLException {
        return result.getBoolean(1);
    }

    private static OperationRecordRow operationRecordRow(ResultSet result, int ignored) throws SQLException {
        return new OperationRecordRow(
                result.getObject("record_ref", UUID.class),
                result.getLong("occurred_at_epoch_millis"),
                result.getString("operation_kind"),
                result.getObject("collection_ref", UUID.class),
                result.getObject("target_ref", UUID.class),
                result.getString("target_kind"),
                result.getString("target_display_snapshot"),
                result.getString("result"),
                result.getString("failure_code"),
                result.getString("actor_display_snapshot"));
    }

    private static ReceiptRow receiptRow(ResultSet result, int ignored) throws SQLException {
        return new ReceiptRow(
                result.getString("request_hash"), result.getString("status"), result.getString("readback_json"));
    }

    private static SectionOrderRow sectionOrderRow(ResultSet result, int ignored) throws SQLException {
        return new SectionOrderRow(
                result.getObject("section_ref", UUID.class), result.getString("name"), result.getLong("display_order"));
    }

    private static ItemRow itemRow(ResultSet result, int ignored) throws SQLException {
        return new ItemRow(
                result.getObject("version_ref", UUID.class),
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("catalog_item_ref", UUID.class),
                result.getObject("section_ref", UUID.class),
                result.getLong("display_order"),
                result.getLong("version"),
                result.getString("display_name_override"),
                result.getString("resolved_item_name"),
                result.getString("resolved_item_code"),
                result.getString("resolved_product_shape"),
                result.getObject("resolved_sales_unit_ref", UUID.class),
                result.getString("resolved_sales_unit_code"),
                result.getString("resolved_sales_unit_name"),
                result.getString("resolved_sales_unit_dimension"),
                result.getObject("resolved_sales_unit_precision", Integer.class),
                result.getObject("listed_price_cents", Long.class),
                result.getString("ordering_constraints_json"),
                result.getString("display_media_mode"),
                result.getBoolean("can_move_up"),
                result.getBoolean("can_move_down"));
    }

    private static SkuRow skuRow(ResultSet result, int ignored) throws SQLException {
        return new SkuRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("sku_ref", UUID.class),
                result.getLong("listed_price_cents"),
                result.getString("resolved_sku_code"),
                result.getString("resolved_sku_name"),
                result.getLong("default_price_cents"),
                result.getLong("display_order"));
    }

    private static MediaItemRow mediaItemRow(ResultSet result, int ignored) throws SQLException {
        return new MediaItemRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("asset_ref", UUID.class),
                result.getLong("display_order"));
    }

    private static MediaRow mediaRow(ResultSet result, int ignored) throws SQLException {
        return new MediaRow(result.getObject("asset_ref", UUID.class), result.getLong("display_order"));
    }

    private static MoveCurrentRow moveCurrentRow(ResultSet result, int ignored) throws SQLException {
        return new MoveCurrentRow(result.getObject("section_ref", UUID.class), result.getLong("display_order"));
    }

    private static MoveTargetRow moveTargetRow(ResultSet result, int ignored) throws SQLException {
        return new MoveTargetRow(result.getObject(1, UUID.class), result.getLong(2));
    }

    private static LongValueRow longValueRow(ResultSet result, int ignored) throws SQLException {
        return new LongValueRow(result.getLong(1));
    }

    private static CountByItemRow countByItemRow(ResultSet result, int ignored) throws SQLException {
        return new CountByItemRow(result.getObject("catalog_item_ref", UUID.class), result.getLong("item_count"));
    }

    private static SectionRow sectionRow(ResultSet result, int ignored) throws SQLException {
        return new SectionRow(
                result.getObject("section_ref", UUID.class),
                result.getString("name"),
                result.getLong("display_order"),
                result.getLong("item_count"),
                result.getBoolean("can_move_up"),
                result.getBoolean("can_move_down"));
    }

    private static ManualSaleStatusRow manualSaleStatusRow(ResultSet result, int ignored) throws SQLException {
        return new ManualSaleStatusRow(
                result.getObject("sales_item_ref", UUID.class),
                SalesMenuManualSaleTargetKind.valueOf(result.getString("target_kind")),
                result.getObject("target_ref", UUID.class),
                result.getString("state"),
                result.getString("reason"),
                result.getObject("changed_at_epoch_millis", Long.class),
                result.getString("actor_display_snapshot"));
    }

    private static OrderOptionGroupRow orderOptionGroupRow(ResultSet result, int ignored) throws SQLException {
        return new OrderOptionGroupRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("definition_ref", UUID.class),
                result.getString("resolved_definition_name"),
                result.getString("selection_mode"),
                result.getBoolean("required"),
                result.getObject("min_selection_count", Integer.class),
                result.getObject("max_selection_count", Integer.class),
                result.getLong("display_order"));
    }

    private static OrderOptionValueRow orderOptionValueRow(ResultSet result, int ignored) throws SQLException {
        return new OrderOptionValueRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("definition_ref", UUID.class),
                result.getObject("definition_value_ref", UUID.class),
                result.getString("resolved_value_name"),
                result.getLong("display_order"),
                result.getBoolean("default_value"),
                result.getObject("extra_price", Long.class));
    }

    private static UuidValueRow uuidValueRow(ResultSet result, int ignored) throws SQLException {
        return new UuidValueRow(result.getObject(1, UUID.class));
    }

    private static LocalTime localTime(Time value) {
        return value == null ? null : value.toLocalTime();
    }

    private record MenuListRow(
            UUID collectionRef,
            UUID storeRef,
            String name,
            Long archivedAtEpochMillis,
            long version,
            long draftRevision,
            Long publishedRevision,
            Long latestPublishedSourceDraftRevision,
            String scheduleKind,
            LocalTime scheduleStart,
            LocalTime scheduleEnd,
            UUID channelRef,
            String activationStatus,
            Long activationVersion) {}

    private record ItemPage(List<ItemRow> rows, boolean hasNext, SalesMenuCursorIdentity identity) {}

    private record PublicationValidation(
            UUID draftVersion,
            List<ItemRow> rows,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            Map<UUID, List<SkuRow>> skuByItem,
            Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> orderOptionsByItem,
            Map<UUID, List<UUID>> mediaByItem,
            List<SalesMenuReadback.PublicationBlocker> blockers) {}

    private record MenuCommandLock(SalesMenuAggregate menu, OrganizationOwnerApi.SalesMenuStoreJudgment store) {}

    private record MutationLock(SalesMenuAggregate menu, UUID draftVersion, MoveCurrentRow moveCurrent) {}

    private record AddItemsLock(MenuCommandLock menuLock, UUID draftVersion) {}

    private record UpdateItemLock(MenuCommandLock menuLock, UUID draftVersion, ItemRow current) {}

    private record AddItemsPreflight(
            SalesMenuAggregate menu, UUID draftVersion, Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts) {}

    private record UpdateItemPreflight(
            SalesMenuAggregate menu,
            UUID draftVersion,
            ItemRow current,
            Map<UUID, CatalogOwnerApi.SalesMenuItemFacts> facts,
            List<SalesMenuReadback.SalesMenuOrderOption> orderOptions) {}

    private record PublishPreflight(SalesMenuAggregate menu, PublicationValidation validation) {}

    private record ManualLock(SalesMenuAggregate menu, ItemRow item) {}

    private record ManualPreflight(
            SalesMenuAggregate menu, SalesMenuManualSaleTarget target, String targetDisplayName) {}

    private record ActivationRow(UUID channelRef, String status, long version) {}

    private record PublicationItemRow(UUID salesItemRef, String resolvedItemName, String resolvedItemCode) {}

    private record OperationRecordRow(
            UUID recordRef,
            long occurredAtEpochMillis,
            String operationKind,
            UUID collectionRef,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String failureCode,
            String actorDisplaySnapshot) {}

    private record ReceiptRow(String requestHash, String status, String readbackJson) {}

    private record SectionOrderRow(UUID sectionRef, String name, long displayOrder) {}

    private record ItemRow(
            UUID versionRef,
            UUID salesItemRef,
            UUID catalogItemRef,
            UUID sectionRef,
            long displayOrder,
            long version,
            String displayNameOverride,
            String resolvedItemName,
            String resolvedItemCode,
            String resolvedProductShape,
            UUID resolvedSalesUnitRef,
            String resolvedSalesUnitCode,
            String resolvedSalesUnitName,
            String resolvedSalesUnitDimension,
            Integer resolvedSalesUnitPrecision,
            Long listedPriceCents,
            String orderingConstraintsJson,
            String displayMediaMode,
            boolean canMoveUp,
            boolean canMoveDown) {}

    private record SkuRow(
            UUID salesItemRef,
            UUID skuRef,
            long listedPriceCents,
            String resolvedSkuCode,
            String resolvedSkuName,
            long defaultPriceCents,
            long displayOrder) {}

    private record MediaItemRow(UUID salesItemRef, UUID assetRef, long displayOrder) {}

    private record MediaRow(UUID assetRef, long displayOrder) {}

    private record MoveCurrentRow(UUID sectionRef, long displayOrder) {}

    private record MoveTargetRow(UUID ref, long displayOrder) {}

    private record LongValueRow(long value) {}

    private record CountByItemRow(UUID itemRef, long count) {}

    private record SectionRow(
            UUID sectionRef, String name, long displayOrder, long itemCount, boolean canMoveUp, boolean canMoveDown) {}

    private record ManualSaleStatusRow(
            UUID salesItemRef,
            SalesMenuManualSaleTargetKind targetKind,
            UUID targetRef,
            String state,
            String reason,
            Long changedAtEpochMillis,
            String actorDisplaySnapshot) {}

    private record ManualTargetKey(
            UUID salesItemRef, SalesMenuManualSaleTargetKind targetKind, UUID targetRef) {}

    private record OptionKey(UUID salesItemRef, UUID definitionRef) {}

    private record OrderOptionGroupRow(
            UUID salesItemRef,
            UUID definitionRef,
            String name,
            String selectionMode,
            boolean required,
            Integer minSelectionCount,
            Integer maxSelectionCount,
            long displayOrder) {}

    private record OrderOptionValueRow(
            UUID salesItemRef,
            UUID definitionRef,
            UUID definitionValueRef,
            String name,
            long displayOrder,
            boolean defaultValue,
            Long extraPrice) {}

    private record UuidValueRow(UUID value) {}
}
