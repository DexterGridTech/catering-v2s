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

/** Owns the salesmenumanualsale sales-menu facts. */

@Service

public class SalesMenuManualSaleService {

    private static final String CAPABILITY = "EDIT_STORE_SALES_MENU";

    private final SalesMenuRepository repository;
    private final TimeProvider time;
    private final ObjectMapper json;
    private final CatalogOwnerApi catalog;
    private final InventoryOwnerApi inventory;
    private final BusinessChannelOwnerApi channels;
    private final OrganizationOwnerApi organization;

    public SalesMenuManualSaleService(SalesMenuRepository repository, TimeProvider time, ObjectMapper json) {
        this(repository, time, json, null, null, null, null);
    }

    @Autowired

    public SalesMenuManualSaleService(
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

    private SalesMenuAggregate lockMenuTarget(SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        return lockMenuTargetWithStore(context, channelRef).menu();
    }

    private MenuCommandLock lockMenuTargetWithStore(SalesMenuOwnerApi.CommandContext context, UUID channelRef) {
        SalesMenuAggregate menu = requireMenu(context.target(), true);
        OrganizationOwnerApi.SalesMenuStoreJudgment store = requireOwnerCommand(context, channelRef);
        requireNotArchived(menu);
        return new MenuCommandLock(menu, store);
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
                            .orElseThrow(() -> invalidManualTarget("人工销售目标不属于当前发布版本"));
                    return new ManualLock(menu, publishedItem);
                },
                locked ->
                        new ManualPreflight(locked.menu(), target, requirePublishedManualTarget(locked.item(), target)),
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
                    .orElseThrow(() -> invalidManualTarget("人工规格目标不属于当前发布版本"));
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
                .orElseThrow(() -> invalidManualTarget("人工选项值目标不属于当前发布版本"));
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
                + "v.published_primary_image_asset_ref,"
                + "v.published_catalog_image_asset_refs::text published_catalog_image_asset_refs,"
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
        return repository.query(sql, SalesMenuReadModels::itemRow, arguments.toArray());
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

    private SalesMenuSchedule schedule(String kind, LocalTime start, LocalTime end) {
        if (kind == null || "ALL_DAY".equals(kind)) return SalesMenuSchedule.allDay();
        return SalesMenuSchedule.daily(start, end);
    }

    private static SalesMenuOwnerApi.Problem problem(String code, int status, String message) {
        return new SalesMenuOwnerApi.Problem(code, status, message);
    }

    private static SalesMenuOwnerApi.Problem invalidManualTarget(String message) {
        return problem("SALES_MENU_MANUAL_TARGET_INVALID", 422, message);
    }

    private static SalesMenuOwnerApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new SalesMenuOwnerApi.Problem(code, status, message, cause);
    }

    private static ReceiptRow receiptRow(ResultSet result, int ignored) throws SQLException {
        return new ReceiptRow(
                result.getString("request_hash"), result.getString("status"), result.getString("readback_json"));
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
                result.getObject("published_primary_image_asset_ref", UUID.class),
                result.getString("published_catalog_image_asset_refs"),
                result.getBoolean("can_move_up"),
                result.getBoolean("can_move_down"));
    }

    private static UuidValueRow uuidValueRow(ResultSet result, int ignored) throws SQLException {
        return new UuidValueRow(result.getObject(1, UUID.class));
    }

    private record MenuCommandLock(
            SalesMenuAggregate menu, OrganizationOwnerApi.SalesMenuStoreJudgment store) {}

    private record ManualLock(SalesMenuAggregate menu, ItemRow item) {}

    private record ManualPreflight(
            SalesMenuAggregate menu, SalesMenuManualSaleTarget target, String targetDisplayName) {}

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

}
