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

/** Owns the salesmenuoperationrecord sales-menu facts. */

@Service

public class SalesMenuOperationRecordService {

    private static final String CAPABILITY = "EDIT_STORE_SALES_MENU";
    private static final String OPERATION_RECORD_LIST_OPERATION = "getOperationsSalesMenuOperationRecords";
    private static final Set<String> REJECTED_OPERATION_TARGET_MAY_BE_MISSING =
            Set.of("SALES_MENU_NOT_FOUND", "SALES_MENU_SCOPE_MISMATCH");

    private final SalesMenuRepository repository;
    private final TimeProvider time;
    private final ObjectMapper json;
    private final BusinessChannelOwnerApi channels;
    private final OrganizationOwnerApi organization;

    public SalesMenuOperationRecordService(SalesMenuRepository repository, TimeProvider time, ObjectMapper json) {
        this(repository, time, json, null, null);
    }

    @Autowired

    public SalesMenuOperationRecordService(
            SalesMenuRepository repository,
            TimeProvider time,
            ObjectMapper json,
            BusinessChannelOwnerApi channels,
            OrganizationOwnerApi organization) {

        this.repository = Objects.requireNonNull(repository, "repository");
        this.time = Objects.requireNonNull(time, "time");
        this.json = Objects.requireNonNull(json, "json");
        this.channels = channels;
        this.organization = organization;

    }

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
                        "SELECT record_ref,occurred_at_epoch_millis,operation_kind,collection_ref,target_ref,"
                                + "target_kind,"
                                + "target_display_snapshot,result,failure_code,actor_display_snapshot "
                                + "FROM sales_menu.sales_operation_record "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? "
                                + "AND collection_ref=? AND (channel_ref IS NULL OR channel_ref=?)"
                                + frontier
                                + " ORDER BY occurred_at_epoch_millis DESC,record_ref DESC LIMIT ?",
                        SalesMenuReadModels::operationRecordRow,
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

}
