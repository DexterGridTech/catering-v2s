package com.catering.v2s.salesmenu.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
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
import static com.catering.v2s.salesmenu.application.SalesMenuReadModels.*;
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
import com.catering.v2s.salesmenu.infrastructure.SalesMenuRepository;
import com.fasterxml.jackson.databind.JsonNode;
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

/** Owns sales-menu collection lifecycle, activation and schedule facts. */
@Service
public class SalesMenuDefinitionService {
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
    private static final String ORDER_OPTION_SHAPE_CODE = "SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED";
    private static final String ORDER_OPTION_SHAPE_MESSAGE = "当前商品形态不支持销售选项选择";
    private static final String INHERITED_IMAGE_BINDING_PREFIX = "沿用商品图片不可携带菜单";
    private static final String INHERITED_IMAGE_BINDING_SUFFIX = "图片绑定凭证";
    private static final String INHERITED_IMAGE_BINDING_MESSAGE =
            INHERITED_IMAGE_BINDING_PREFIX + INHERITED_IMAGE_BINDING_SUFFIX;
    private static final Set<String> REJECTED_OPERATION_TARGET_MAY_BE_MISSING =
            Set.of("SALES_MENU_NOT_FOUND", "SALES_MENU_SCOPE_MISMATCH");
    private final SalesMenuRepository repository;
    private final TimeProvider time;
    private final ObjectMapper json;
    private final BusinessChannelOwnerApi channels;
    private final OrganizationOwnerApi organization;

    public SalesMenuDefinitionService(SalesMenuRepository repository, TimeProvider time, ObjectMapper json) {
        this(repository, time, json, null, null);
    }

    @Autowired
    public SalesMenuDefinitionService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            OrganizationOwnerApi organization,
            BusinessChannelOwnerApi channels) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.time = Objects.requireNonNull(time, "time");
        this.json = Objects.requireNonNull(json, "json");
        this.organization = organization;
        this.channels = channels;
    }

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
                SalesMenuReadModels::menuListRow,
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

    public SalesMenuReadback.MenuDetail readMenu(SalesMenuTarget target, UUID channelRef) {
        requireOwnerRead(target.scope(), channelRef);
        var menu = requireMenu(target, false);
        var activation = repository
                .query(
                        "SELECT channel_ref,status,version "
                                + "FROM sales_menu.sales_collection_activation "
                                + "WHERE collection_ref=? AND channel_ref=?",
                        SalesMenuReadModels::activationRow,
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
            Function<MenuCommandLock, SalesMenuCommandReadbackStatus> mutation) {
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
            Function<MenuCommandLock, SalesMenuCommandReadbackStatus> mutation) {
        requireGrant(context, true);
        return receipt(
                operation,
                context,
                request,
                () -> lockMenuTargetWithStore(context, recordChannel),
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
                        SalesMenuReadModels::receiptRow,
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
        return request;
    }

    private record ScheduleReceiptRequest(
            UUID salesMenuRef, String scheduleKind, String startLocalTime, String endLocalTime, long expectedVersion) {}

    private <T> T replay(String operation, SalesMenuOwnerApi.CommandContext context, String hash) {
        var row = repository
                .query(
                        "SELECT request_hash,status,readback_json::text readback_json "
                                + "FROM sales_menu.sales_command_receipt "
                                + "WHERE workspace_uuid=? AND operation_id=? AND idempotency_key=?",
                        SalesMenuReadModels::receiptRow,
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

    private void copyDraft(UUID source, UUID target, UUID targetVersion) {
        Map<UUID, UUID> sections = new HashMap<>();
        UUID sourceVersion = draftVersion(source);
        for (var row : repository.query(
                "SELECT section_ref,name,display_order FROM sales_menu.sales_version_section "
                        + "WHERE version_ref=? ORDER BY display_order",
                SalesMenuReadModels::sectionOrderRow,
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
                        + "v.display_media_mode,v.published_primary_image_asset_ref,"
                        + "v.published_catalog_image_asset_refs::text published_catalog_image_asset_refs,"
                        + "false AS can_move_up,false AS can_move_down "
                        + "FROM sales_menu.sales_version_item v "
                        + "JOIN sales_menu.sales_item i ON i.sales_item_ref=v.sales_item_ref "
                        + "WHERE v.version_ref=? ORDER BY v.display_order",
                SalesMenuReadModels::itemRow,
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

    private Map<UUID, List<SalesMenuReadback.SalesMenuOrderOption>> selectedOrderOptionsByItem(List<ItemRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs =
                rows.stream().map(ItemRow::salesItemRef).distinct().toList();
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
                SalesMenuReadModels::orderOptionGroupRow,
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
                SalesMenuReadModels::orderOptionValueRow,
                valueArguments.toArray());
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

    private Map<UUID, List<SkuRow>> persistedSkuRowsByItem(List<ItemRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<UUID> itemRefs =
                rows.stream().map(ItemRow::salesItemRef).distinct().toList();
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
                        SalesMenuReadModels::skuRow,
                        arguments.toArray())
                .forEach(row -> result.computeIfAbsent(row.salesItemRef(), ignored -> new ArrayList<>())
                        .add(row));
        result.replaceAll((ignored, values) -> List.copyOf(values));
        return Map.copyOf(result);
    }

    private Map<UUID, List<UUID>> mediaByItem(List<ItemRow> rows, boolean ignoredValidateAssets) {
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
                        SalesMenuReadModels::mediaItemRow,
                        arguments.toArray())
                .forEach(row -> result.computeIfAbsent(row.salesItemRef(), ignored -> new ArrayList<>())
                        .add(row.assetRef()));
        result.replaceAll((ignored, refs) -> List.copyOf(refs));
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

    private UUID draftVersion(UUID menu) {
        return repository
                .query(
                        "SELECT current_draft_version_ref FROM sales_menu.sales_collection " + "WHERE collection_ref=?",
                        SalesMenuReadModels::uuidValueRow,
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
        return channels != null && organization != null;
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

    private com.catering.v2s.salesmenu.domain.SalesMenuAggregate requireMenu(SalesMenuTarget target, boolean lock) {
        return (lock ? repository.findForUpdate(target) : repository.find(target))
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

    private static boolean draftDirty(long draftRevision, Long latestPublishedSourceDraftRevision) {
        return latestPublishedSourceDraftRevision == null || draftRevision != latestPublishedSourceDraftRevision;
    }

    private record MenuCommandLock(SalesMenuAggregate menu, OrganizationOwnerApi.SalesMenuStoreJudgment store) {}

    private record OptionKey(UUID salesItemRef, UUID definitionRef) {}
}
