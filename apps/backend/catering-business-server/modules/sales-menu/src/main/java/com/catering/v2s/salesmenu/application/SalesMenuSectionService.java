package com.catering.v2s.salesmenu.application;

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

import static com.catering.v2s.salesmenu.application.SalesMenuReadModels.*;

/** Owns sales-menu section lifecycle and ordering facts. */

@Service

public class SalesMenuSectionService {

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
    private final CatalogOwnerApi catalog;
    private final InventoryOwnerApi inventory;
    private final BusinessChannelOwnerApi channels;
    private final OrganizationOwnerApi organization;

    public SalesMenuSectionService(SalesMenuRepository repository, TimeProvider time, ObjectMapper json) {
        this(repository, time, json, null, null, null, null);
    }

    @Autowired

    public SalesMenuSectionService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            CatalogOwnerApi catalog,
            InventoryOwnerApi inventory,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization) {

        this.repository = Objects.requireNonNull(repository, "repository");
        this.time = Objects.requireNonNull(time, "time");
        this.json = Objects.requireNonNull(json, "json");
        this.catalog = catalog;
        this.inventory = inventory;
        this.channels = channels;
        this.organization = organization;

    }

    public SalesMenuReadback.SectionList listDraftSections(SalesMenuVersionQuery query) {
        return sections(query.menu(), SalesMenuVersionKind.DRAFT);
    }

    public SalesMenuReadback.SectionList listPublishedSections(SalesMenuVersionQuery query) {
        return sections(query.menu(), SalesMenuVersionKind.PUBLISHED);
    }

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

    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command deleteSection(SalesMenuOwnerApi.SectionDeleteCommand command) {
        return mutate(
                "deleteOperationsSalesMenuSection", command.context(), command, command.expectedVersion(), locked -> {
                    UUID version = locked.draftVersion();
                    if (!repository
                            .query(
                                    "SELECT 1 FROM sales_menu.sales_version_item "
                                            + "WHERE version_ref=? AND section_ref=? LIMIT 1",
                                    SalesMenuReadModels::existsRow,
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
        }
        return new MutationLock(menu, draftVersion, moveCurrent);
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

    /** Asset bind grants are request-transient proof, not part of the business intent for replay. */
    private Object receiptRequest(Object request) {
        return request;
    }

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
                        SalesMenuSectionService::moveTargetRow,
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
                        SalesMenuReadModels::longValueRow,
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
                        SalesMenuReadModels::sectionRow,
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

    private UUID publishedVersion(UUID menu) {
        return repository
                .query(
                        "SELECT latest_published_version_ref FROM sales_menu.sales_collection "
                                + "WHERE collection_ref=?",
                        SalesMenuReadModels::uuidValueRow,
                        menu)
                .stream()
                .filter(row -> row.value() != null)
                .findFirst()
                .orElseThrow(() -> problem("PUBLICATION_NOT_FOUND", 404, "尚无发布版本"))
                .value();
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

    private com.catering.v2s.salesmenu.domain.SalesMenuAggregate requireMenu(SalesMenuTarget target, boolean lock) {
        return (lock ? repository.findForUpdate(target) : repository.find(target))
                .orElseThrow(() -> problem("SALES_MENU_NOT_FOUND", 404, "销售菜单不存在"));
    }

    private void requireSection(UUID menu, UUID version, UUID section) {
        if (repository
                .query(
                        "SELECT 1 FROM sales_menu.sales_version_section "
                                + "WHERE collection_ref=? AND version_ref=? AND section_ref=?",
                        SalesMenuReadModels::existsRow,
                        menu,
                        version,
                        section)
                .isEmpty()) throw problem("SECTION_NOT_FOUND", 404, "分组不存在");
    }

    private MoveCurrentRow requireSectionMoveCurrent(UUID menu, UUID version, UUID section) {
        return repository
                .query(
                        "SELECT section_ref,display_order FROM sales_menu.sales_version_section "
                                + "WHERE collection_ref=? AND version_ref=? AND section_ref=? FOR UPDATE",
                        SalesMenuSectionService::moveCurrentRow,
                        menu,
                        version,
                        section)
                .stream()
                .findFirst()
                .orElseThrow(() -> problem("SECTION_NOT_FOUND", 404, "分组不存在"));
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

    private static Boolean existsRow(ResultSet result, int ignored) throws SQLException {
        return result.getBoolean(1);
    }

    private static ReceiptRow receiptRow(ResultSet result, int ignored) throws SQLException {
        return new ReceiptRow(
                result.getString("request_hash"), result.getString("status"), result.getString("readback_json"));
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

    private static SectionRow sectionRow(ResultSet result, int ignored) throws SQLException {
        return new SectionRow(
                result.getObject("section_ref", UUID.class),
                result.getString("name"),
                result.getLong("display_order"),
                result.getLong("item_count"),
                result.getBoolean("can_move_up"),
                result.getBoolean("can_move_down"));
    }

    private static UuidValueRow uuidValueRow(ResultSet result, int ignored) throws SQLException {
        return new UuidValueRow(result.getObject(1, UUID.class));
    }

    private record MenuCommandLock(
            SalesMenuAggregate menu, OrganizationOwnerApi.SalesMenuStoreJudgment store) {}

    private record MutationLock(SalesMenuAggregate menu, UUID draftVersion, MoveCurrentRow moveCurrent) {}

    private record MoveCurrentRow(UUID sectionRef, long displayOrder) {}

    private record MoveTargetRow(UUID ref, long displayOrder) {}

}
