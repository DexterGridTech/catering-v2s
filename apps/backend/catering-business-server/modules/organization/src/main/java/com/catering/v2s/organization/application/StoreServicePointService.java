package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.QrChannelEligibilityLookup;
import com.catering.v2s.organization.api.StoreServicePointAssetLifecycle;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Organization owner for store areas, service points and the store QR singleton. */
@Service
public class StoreServicePointService implements StoreServicePointOwnerApi {
    public static final String OPERATING_RULE_KEY = "tableManagementEnabled";
    public static final String EXTENSION_HOST = "SERVICE_POINT";
    private static final String AREA = "AREA";
    private static final String POINT = "POINT";
    private static final String QR = "QR_CONFIGURATION";
    private static final int PAGE_SIZE = 20;
    private static final String AREA_ENTITY = AuditEntityTypes.STORE_SERVICE_POINT_AREA;
    private static final String POINT_ENTITY = AuditEntityTypes.STORE_SERVICE_POINT;
    private static final String QR_ENTITY = AuditEntityTypes.STORE_QR_CONFIGURATION;
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final ObjectProvider<QrChannelEligibilityLookup> qrChannels;
    private final ObjectProvider<StoreServicePointAssetLifecycle> assets;
    private final StoreOperatingRuleGate operatingRules;

    public StoreServicePointService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            ObjectProvider<QrChannelEligibilityLookup> qrChannels,
            ObjectProvider<StoreServicePointAssetLifecycle> assets,
            StoreOperatingRuleGate operatingRules) {
        this.jdbc = jdbc;
        this.time = time;
        this.definitions = definitions;
        this.qrChannels = qrChannels;
        this.assets = assets;
        this.operatingRules = operatingRules;
    }

    @Override
    @Transactional(readOnly = true)
    public AreaPage listAreas(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String cursor, int pageSize) {
        validatePageSize(pageSize);
        requireStore(workspaceUuid, groupWorkspaceKey, storeRef);
        String identity = pageIdentity("store-service-point-area-page", workspaceUuid, groupWorkspaceKey, storeRef, null);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        long total = count(
                "SELECT count(*) FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED'",
                workspaceUuid,
                groupWorkspaceKey,
                storeRef);
        List<Object> arguments = new ArrayList<>();
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(storeRef);
        String frontier = "";
        if (position != null) {
            long displayOrder = cursorOrder(position);
            frontier = " AND (display_order > ? OR (display_order = ? AND area_ref > ?))";
            arguments.add(displayOrder);
            arguments.add(displayOrder);
            arguments.add(position.tieBreaker());
        }
        arguments.add(pageSize + 1);
        List<AreaRow> rows = jdbc.query(
                "SELECT area_ref, store_ref, name, code, area_type, status, display_order, version, created_at_epoch_millis, updated_at_epoch_millis "
                        + "FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED' "
                        + frontier
                        + " ORDER BY display_order, area_ref LIMIT ?",
                StoreServicePointService::areaRow,
                arguments.toArray());
        boolean hasNext = rows.size() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        List<AreaRow> pageRows = rows;
        return new AreaPage(
                indexedAreas(pageRows, position != null, hasNext),
                hasNext ? OpaqueCollectionCursor.encode(identity, Long.toString(pageRows.getLast().displayOrder), pageRows.getLast().areaRef) : null,
                total);
    }

    @Override
    @Transactional(readOnly = true)
    public PointPage listPoints(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID areaRef, String cursor, int pageSize) {
        validatePageSize(pageSize);
        requireArea(workspaceUuid, groupWorkspaceKey, storeRef, areaRef, false);
        String identity = pageIdentity("store-service-point-page", workspaceUuid, groupWorkspaceKey, storeRef, areaRef);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        long total = count(
                "SELECT count(*) FROM organization.store_service_point WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND area_ref=? AND status <> 'VOIDED'",
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                areaRef);
        List<Object> arguments = new ArrayList<>();
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(storeRef);
        arguments.add(areaRef);
        String frontier = "";
        if (position != null) {
            long displayOrder = cursorOrder(position);
            frontier = " AND (p.display_order > ? OR (p.display_order = ? AND p.point_ref > ?))";
            arguments.add(displayOrder);
            arguments.add(displayOrder);
            arguments.add(position.tieBreaker());
        }
        arguments.add(pageSize + 1);
        List<PointRow> rows = jdbc.query(
                "SELECT p.point_ref, p.store_ref, p.area_ref, p.name, p.code, p.point_type, p.status, p.display_order, p.seat_capacity, p.table_shape, p.reservable, p.image_asset_ref, p.extension_values::text, p.extension_rule_revision, p.version, p.created_at_epoch_millis, p.updated_at_epoch_millis, a.status AS area_status "
                        + "FROM organization.store_service_point p JOIN organization.store_service_point_area a ON a.area_ref=p.area_ref "
                        + "WHERE p.workspace_uuid=? AND p.group_workspace_key=? AND p.store_ref=? AND p.area_ref=? AND p.status <> 'VOIDED' "
                        + frontier
                        + " ORDER BY p.display_order, p.point_ref LIMIT ?",
                StoreServicePointService::pointRow,
                arguments.toArray());
        boolean hasNext = rows.size() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        List<PointRow> pageRows = rows;
        QrSnapshot qr = readQrSnapshot(workspaceUuid, groupWorkspaceKey, storeRef);
        return new PointPage(
                java.util.stream.IntStream.range(0, pageRows.size())
                        .mapToObj(index -> pointReadback(
                                pageRows.get(index),
                                qrUrl(qr, groupWorkspaceKey, pageRows.get(index).pointRef),
                                position != null || index > 0,
                                hasNext || index + 1 < pageRows.size()))
                        .toList(),
                hasNext ? OpaqueCollectionCursor.encode(identity, Long.toString(pageRows.getLast().displayOrder), pageRows.getLast().pointRef) : null,
                total);
    }

    @Override
    @Transactional(readOnly = true)
    public Point readPoint(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID pointRef) {
        PointRow row = requirePoint(workspaceUuid, groupWorkspaceKey, storeRef, pointRef, false);
        QrSnapshot qr = readQrSnapshot(workspaceUuid, groupWorkspaceKey, storeRef);
        return pointReadback(
                row,
                qrUrl(qr, groupWorkspaceKey, row.pointRef),
                hasPointBefore(workspaceUuid, groupWorkspaceKey, row),
                hasPointAfter(workspaceUuid, groupWorkspaceKey, row));
    }

    @Override
    @Transactional(readOnly = true)
    public QrConfiguration readQrConfiguration(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        requireStore(workspaceUuid, groupWorkspaceKey, storeRef);
        List<QrRow> rows = jdbc.query(
                "SELECT store_ref, enabled, channel_ref, version, updated_at_epoch_millis FROM organization.store_qr_configuration WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=?",
                (result, ignored) -> new QrRow(
                        result.getObject("store_ref", UUID.class),
                        result.getBoolean("enabled"),
                        result.getObject("channel_ref", UUID.class),
                        result.getLong("version"),
                        result.getLong("updated_at_epoch_millis")),
                workspaceUuid,
                groupWorkspaceKey,
                storeRef);
        QrRow row = rows.isEmpty() ? new QrRow(storeRef, false, null, 1, 0) : rows.getFirst();
        QrChannelEligibilityLookup.Candidate candidate = row.channelRef == null ? null : qrChannels().read(
                workspaceUuid, groupWorkspaceKey, storeRef, row.channelRef);
        return new QrConfiguration(
                row.storeRef,
                row.enabled,
                row.channelRef,
                candidate == null ? null : candidate.channelName(),
                candidate == null ? null : candidate.channelCode(),
                candidate == null ? null : candidate.urlRule(),
                row.version,
                row.updatedAt);
    }

    @Override
    @Transactional
    public Area createArea(AreaCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        String name = required(command.name(), 120);
        String code = required(command.code(), 64);
        String type = areaType(command.areaType());
        UUID areaRef = UUID.randomUUID();
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(),
                canonical(command), areaRef, AREA)) return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), areaRef);
        long now = time.currentEpochMillis();
        Long nextOrder = jdbc.queryForObject(
                "SELECT coalesce(max(display_order), -1) + 1 FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED'",
                Long.class,
                command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        try {
            jdbc.update(
                    "INSERT INTO organization.store_service_point_area(area_ref, workspace_uuid, group_workspace_key, store_ref, name, code, area_type, status, display_order, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,'ENABLED',?,1,?,?)",
                    areaRef, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), name, code, type,
                    nextOrder == null ? 0 : nextOrder, now, now);
        } catch (DuplicateKeyException conflict) {
            throw new BusinessEntityService.OrganizationConflictException(conflict);
        }
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), areaRef, AREA_ENTITY, "AREA_CREATED", command.actor(), now,
                List.of(AuditChange.forNullableScalar("name", null, name), AuditChange.forNullableScalar("code", null, code),
                        AuditChange.forNullableScalar("areaType", null, type), AuditChange.forNullableScalar("status", null, "ENABLED")));
        return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), areaRef);
    }

    @Override
    @Transactional
    public Area updateArea(AreaCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        AreaRow before = requireAreaForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.areaRef());
        if ("VOIDED".equals(before.status)) throw new BusinessEntityService.OrganizationConflictException();
        String name = required(command.name(), 120);
        String code = required(command.code(), 64);
        String type = areaType(command.areaType());
        String status = status(command.status());
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), before.areaRef, AREA))
            return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
        if (!Objects.equals(before.areaType, type) && count(
                "SELECT count(*) FROM organization.store_service_point WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND area_ref=? AND status <> 'VOIDED'",
                command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef) > 0)
            throw new BusinessEntityService.OrganizationValidationException();
        int updated;
        try {
            updated = jdbc.update(
                    "UPDATE organization.store_service_point_area SET name=?, code=?, area_type=?, status=?, version=version+1, updated_at_epoch_millis=? WHERE area_ref=? AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND version=?",
                    name, code, type, status, time.currentEpochMillis(), before.areaRef, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.expectedVersion());
        } catch (DuplicateKeyException conflict) {
            throw new BusinessEntityService.OrganizationConflictException(conflict);
        }
        if (updated != 1) throw new BusinessEntityService.OrganizationConflictException();
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), before.areaRef, AREA_ENTITY, "AREA_UPDATED", command.actor(), time.currentEpochMillis(),
                changes(before, name, code, type, status));
        return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
    }

    @Override
    @Transactional
    public Area transitionArea(StatusCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        AreaRow before = requireAreaForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.targetRef());
        String target = status(command.status());
        if ("VOIDED".equals(before.status)) throw new BusinessEntityService.OrganizationConflictException();
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), before.areaRef, AREA))
            return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
        int updated = jdbc.update(
                "UPDATE organization.store_service_point_area SET status=?, version=version+1, updated_at_epoch_millis=? WHERE area_ref=? AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND version=?",
                target, time.currentEpochMillis(), before.areaRef, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.expectedVersion());
        if (updated != 1) throw new BusinessEntityService.OrganizationConflictException();
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), before.areaRef, AREA_ENTITY, "AREA_STATUS_CHANGED", command.actor(), time.currentEpochMillis(),
                List.of(AuditChange.forNullableScalar("status", before.status, target)));
        return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
    }

    @Override
    @Transactional
    public Area moveArea(OrderCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        AreaRow before = requireAreaForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.targetRef());
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), before.areaRef, AREA))
            return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
        List<AreaRow> rows = jdbc.query(
                "SELECT area_ref, store_ref, name, code, area_type, status, display_order, version, created_at_epoch_millis, updated_at_epoch_millis FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED' ORDER BY display_order, area_ref FOR UPDATE",
                StoreServicePointService::areaRow, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        int index = indexOf(rows, before.areaRef);
        int neighbor = "UP".equals(command.direction()) ? index - 1 : index + 1;
        if (index < 0 || neighbor < 0 || neighbor >= rows.size()) return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
        swapOrders("organization.store_service_point_area", rows.get(index), rows.get(neighbor));
        return requireAreaRead(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
    }

    @Override
    @Transactional
    public Point createPoint(PointCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        AreaRow area = requireAreaForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.areaRef());
        String pointType = pointType(command.pointType());
        validatePointAttributes(pointType, command.seatCapacity(), command.tableShape(), command.reservable(), command.imageAssetRef());
        String name = required(command.name(), 120);
        String code = required(command.code(), 64);
        if (!compatible(area.areaType, pointType)) throw new BusinessEntityService.OrganizationValidationException();
        UUID pointRef = UUID.randomUUID();
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), pointRef, POINT))
            return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), pointRef);
        settleImage(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), pointRef, null,
                command.imageAssetRef(), command.imageBindGrant());
        ExtensionPayload extension = extension(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.extensionSubmission(),
                "{}",
                command.extensionRuleRevision());
        long now = time.currentEpochMillis();
        Long nextOrder = jdbc.queryForObject(
                "SELECT coalesce(max(display_order), -1) + 1 FROM organization.store_service_point WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND area_ref=? AND status <> 'VOIDED'",
                Long.class, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.areaRef());
        try {
            jdbc.update(
                    "INSERT INTO organization.store_service_point(point_ref, workspace_uuid, group_workspace_key, store_ref, area_ref, name, code, point_type, status, display_order, seat_capacity, table_shape, reservable, image_asset_ref, extension_values, extension_rule_revision, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,'ENABLED',?,?,?,?,?,CAST(? AS JSONB),?,1,?,?)",
                    pointRef, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.areaRef(), name, code, pointType,
                    nextOrder == null ? 0 : nextOrder, command.seatCapacity(), command.tableShape(), command.reservable(), command.imageAssetRef(),
                    extension.json(), extension.revision(), now, now);
        } catch (DuplicateKeyException conflict) {
            throw new BusinessEntityService.OrganizationConflictException(conflict);
        }
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), pointRef, POINT_ENTITY, "SERVICE_POINT_CREATED", command.actor(), now,
                pointChanges(null, name, code, pointType, "ENABLED", command.seatCapacity(), command.tableShape(), command.reservable(), command.imageAssetRef(), extension));
        return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), pointRef);
    }

    @Override
    @Transactional
    public Point updatePoint(PointCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        PointRow before = requirePointForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.pointRef());
        if ("VOIDED".equals(before.status)) throw new BusinessEntityService.OrganizationConflictException();
        AreaRow area = requireAreaForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
        String pointType = pointType(command.pointType());
        validatePointAttributes(pointType, command.seatCapacity(), command.tableShape(), command.reservable(), command.imageAssetRef());
        if (!compatible(area.areaType, pointType)) throw new BusinessEntityService.OrganizationValidationException();
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), before.pointRef, POINT))
            return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef);
        ExtensionPayload extension = extension(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.extensionSubmission(),
                before.extensionValuesJson,
                command.extensionRuleRevision());
        String status = status(command.status());
        settleImage(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef,
                before.imageAssetRef, command.imageAssetRef(), command.imageBindGrant());
        int updated;
        try {
            updated = jdbc.update(
                    "UPDATE organization.store_service_point SET name=?, code=?, point_type=?, status=?, seat_capacity=?, table_shape=?, reservable=?, image_asset_ref=?, extension_values=CAST(? AS JSONB), extension_rule_revision=?, version=version+1, updated_at_epoch_millis=? WHERE point_ref=? AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND version=?",
                    required(command.name(), 120), required(command.code(), 64), pointType, status, command.seatCapacity(), command.tableShape(), command.reservable(), command.imageAssetRef(), extension.json(), extension.revision(), time.currentEpochMillis(), before.pointRef, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.expectedVersion());
        } catch (DuplicateKeyException conflict) {
            throw new BusinessEntityService.OrganizationConflictException(conflict);
        }
        if (updated != 1) throw new BusinessEntityService.OrganizationConflictException();
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), before.pointRef, POINT_ENTITY, "SERVICE_POINT_UPDATED", command.actor(), time.currentEpochMillis(),
                pointChanges(before, command.name(), command.code(), pointType, status, command.seatCapacity(), command.tableShape(), command.reservable(), command.imageAssetRef(), extension));
        return readPointAfterMutation(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef, status);
    }

    @Override
    @Transactional
    public Point transitionPoint(StatusCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        PointRow before = requirePointForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.targetRef());
        String target = status(command.status());
        if ("VOIDED".equals(before.status)) throw new BusinessEntityService.OrganizationConflictException();
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), before.pointRef, POINT))
            return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef);
        int updated = jdbc.update(
                "UPDATE organization.store_service_point SET status=?, version=version+1, updated_at_epoch_millis=? WHERE point_ref=? AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND version=?",
                target, time.currentEpochMillis(), before.pointRef, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.expectedVersion());
        if (updated != 1) throw new BusinessEntityService.OrganizationConflictException();
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), before.pointRef, POINT_ENTITY, "SERVICE_POINT_STATUS_CHANGED", command.actor(), time.currentEpochMillis(),
                List.of(AuditChange.forNullableScalar("status", before.status, target)));
        return readPointAfterMutation(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef, target);
    }

    @Override
    @Transactional
    public Point movePoint(OrderCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        PointRow before = requirePointForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.targetRef());
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), before.pointRef, POINT))
            return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef);
        List<PointRow> rows = jdbc.query(
                "SELECT p.point_ref, p.store_ref, p.area_ref, p.name, p.code, p.point_type, p.status, p.display_order, p.seat_capacity, p.table_shape, p.reservable, p.image_asset_ref, p.extension_values::text, p.extension_rule_revision, p.version, p.created_at_epoch_millis, p.updated_at_epoch_millis, a.status AS area_status FROM organization.store_service_point p JOIN organization.store_service_point_area a ON a.area_ref=p.area_ref WHERE p.workspace_uuid=? AND p.group_workspace_key=? AND p.store_ref=? AND p.area_ref=? AND p.status <> 'VOIDED' ORDER BY p.display_order, p.point_ref FOR UPDATE",
                StoreServicePointService::pointRow, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.areaRef);
        int index = indexOfPoints(rows, before.pointRef);
        int neighbor = "UP".equals(command.direction()) ? index - 1 : index + 1;
        if (index < 0 || neighbor < 0 || neighbor >= rows.size()) return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef);
        swapOrders("organization.store_service_point", rows.get(index), rows.get(neighbor));
        return readPoint(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), before.pointRef);
    }

    @Override
    @Transactional
    public QrConfiguration updateQrConfiguration(QrConfigurationCommand command) {
        requireCommand(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        QrRow before = readQrRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        if (!claim(command.workspaceUuid(), command.groupWorkspaceKey(), command.idempotencyKey(), canonical(command), command.storeRef(), QR))
            return readQrConfiguration(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        if (command.enabled() && command.channelRef() == null) throw new BusinessEntityService.OrganizationValidationException();
        if (command.channelRef() != null) {
            if (command.enabled()) qrChannels().requireEligible(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.channelRef());
            else if (qrChannels().read(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.channelRef()) == null)
                throw new BusinessEntityService.OrganizationValidationException();
        }
        long now = time.currentEpochMillis();
        int updated = jdbc.update(
                "INSERT INTO organization.store_qr_configuration(store_ref, workspace_uuid, group_workspace_key, enabled, channel_ref, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?,?,?,?,?,1,?,?) ON CONFLICT (store_ref) DO UPDATE SET enabled=excluded.enabled, channel_ref=excluded.channel_ref, version=organization.store_qr_configuration.version+1, updated_at_epoch_millis=excluded.updated_at_epoch_millis WHERE organization.store_qr_configuration.workspace_uuid=excluded.workspace_uuid AND organization.store_qr_configuration.group_workspace_key=excluded.group_workspace_key AND organization.store_qr_configuration.version=?",
                command.storeRef(), command.workspaceUuid(), command.groupWorkspaceKey(), command.enabled(),
                command.channelRef(), now, now, command.expectedVersion());
        if (updated != 1) throw new BusinessEntityService.OrganizationConflictException();
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), QR_ENTITY, "QR_CONFIGURATION_UPDATED", command.actor(), now,
                List.of(AuditChange.forNullableScalar("enabled", Boolean.toString(before.enabled), Boolean.toString(command.enabled())),
                        AuditChange.forNullableScalar("channelRef", before.channelRef == null ? null : before.channelRef.toString(), command.channelRef() == null ? null : command.channelRef().toString())));
        return readQrConfiguration(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
    }

    private Point pointReadback(PointRow row, String url, boolean canMoveUp, boolean canMoveDown) {
        boolean available = "ENABLED".equals(row.status) && "ENABLED".equals(row.areaStatus);
        return new Point(
                row.pointRef, row.storeRef, row.areaRef, row.name, row.code, row.pointType, row.status, row.displayOrder,
                row.seatCapacity, row.tableShape, row.reservable, row.imageAssetRef, row.extensionValuesJson,
                row.extensionRuleRevision, available, url, row.version, row.createdAt, row.updatedAt,
                canMoveUp, canMoveDown);
    }

    private Point readPointAfterMutation(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID pointRef, String status) {
        PointRow row = requirePoint(workspaceUuid, groupWorkspaceKey, storeRef, pointRef, "VOIDED".equals(status));
        QrSnapshot qr = readQrSnapshot(workspaceUuid, groupWorkspaceKey, storeRef);
        return pointReadback(
                row,
                qrUrl(qr, groupWorkspaceKey, row.pointRef),
                hasPointBefore(workspaceUuid, groupWorkspaceKey, row),
                hasPointAfter(workspaceUuid, groupWorkspaceKey, row));
    }

    private Area requireAreaRead(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID areaRef) {
        AreaRow row = requireArea(workspaceUuid, groupWorkspaceKey, storeRef, areaRef, true);
        return new Area(row.areaRef, row.storeRef, row.name, row.code, row.areaType, row.status, row.displayOrder, row.version,
                row.createdAt, row.updatedAt,
                hasAreaBefore(workspaceUuid, groupWorkspaceKey, row), hasAreaAfter(workspaceUuid, groupWorkspaceKey, row));
    }

    private AreaRow requireArea(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID areaRef, boolean includeVoided) {
        String suffix = includeVoided ? "" : " AND status <> 'VOIDED'";
        List<AreaRow> rows = jdbc.query(
                "SELECT area_ref, store_ref, name, code, area_type, status, display_order, version, created_at_epoch_millis, updated_at_epoch_millis FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND area_ref=?" + suffix,
                StoreServicePointService::areaRow, workspaceUuid, groupWorkspaceKey, storeRef, areaRef);
        if (rows.isEmpty()) throw new BusinessEntityService.OrganizationNotFoundException();
        return rows.getFirst();
    }

    private AreaRow requireAreaForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID areaRef) {
        AreaRow row = requireArea(workspaceUuid, groupWorkspaceKey, storeRef, areaRef, true);
        jdbc.queryForList(
                "SELECT area_ref FROM organization.store_service_point_area WHERE area_ref=? AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? FOR UPDATE",
                areaRef, workspaceUuid, groupWorkspaceKey, storeRef);
        return row;
    }

    private PointRow requirePoint(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID pointRef, boolean includeVoided) {
        String suffix = includeVoided ? "" : " AND p.status <> 'VOIDED'";
        List<PointRow> rows = jdbc.query(
                "SELECT p.point_ref, p.store_ref, p.area_ref, p.name, p.code, p.point_type, p.status, p.display_order, p.seat_capacity, p.table_shape, p.reservable, p.image_asset_ref, p.extension_values::text, p.extension_rule_revision, p.version, p.created_at_epoch_millis, p.updated_at_epoch_millis, a.status AS area_status FROM organization.store_service_point p JOIN organization.store_service_point_area a ON a.area_ref=p.area_ref WHERE p.workspace_uuid=? AND p.group_workspace_key=? AND p.store_ref=? AND p.point_ref=?" + suffix,
                StoreServicePointService::pointRow, workspaceUuid, groupWorkspaceKey, storeRef, pointRef);
        if (rows.isEmpty()) throw new BusinessEntityService.OrganizationNotFoundException();
        return rows.getFirst();
    }

    private PointRow requirePointForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID pointRef) {
        PointRow row = requirePoint(workspaceUuid, groupWorkspaceKey, storeRef, pointRef, true);
        jdbc.query("SELECT point_ref FROM organization.store_service_point WHERE point_ref=? AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? FOR UPDATE",
                (result, ignored) -> result.getObject(1, UUID.class), pointRef, workspaceUuid, groupWorkspaceKey, storeRef);
        return row;
    }

    private void requireStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        if (jdbc.queryForObject(
                        "SELECT count(*) FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                        Long.class,
                        storeRef,
                        workspaceUuid,
                        groupWorkspaceKey)
                == 0)
            throw new BusinessEntityService.OrganizationNotFoundException();
    }

    private void requireCommand(OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        if (grant == null || !grant.matchesCapability(workspaceUuid, groupWorkspaceKey, "STORE", storeRef, "EDIT_STORE_SERVICE_POINT_QR"))
            throw new BusinessEntityService.OrganizationAuthorizationException();
        operatingRules.requireStoreOperatingRuleForStoreTarget(
                workspaceUuid, groupWorkspaceKey, "STORE", storeRef, OPERATING_RULE_KEY);
    }

    private ExtensionPayload extension(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            ExtensionSubmission requestedSubmission,
            String currentJson,
            Long requestedRevision) {
        ExtensionSubmission submission = requestedSubmission == null
                ? new ExtensionSubmission(List.of())
                : requestedSubmission;
        try {
            ExtensionDefinitionReadback definition = null;
            try {
                definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, EXTENSION_HOST);
            } catch (ExtensionDefinitionService.DefinitionNotFoundException ignored) {
                if (!submission.fields().isEmpty()) throw new BusinessEntityService.OrganizationValidationException();
            }
            if (requestedRevision != null && (definition == null || definition.version() != requestedRevision))
                throw new BusinessEntityService.OrganizationValidationException();
            String merged = definition == null
                    ? (currentJson == null || currentJson.isBlank() ? "{}" : currentJson)
                    : ExtensionDefinitionService.mergeValues(definition, currentJson, submission);
            return new ExtensionPayload(merged, definition == null ? null : definition.version(), definition, submission);
        } catch (BusinessEntityService.OrganizationValidationException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new BusinessEntityService.OrganizationValidationException(failure);
        }
    }

    private boolean claim(UUID workspaceUuid, String groupWorkspaceKey, String key, String canonical, UUID targetRef, String targetKind) {
        if (key == null || key.length() < 16 || key.length() > 128) throw new BusinessEntityService.OrganizationValidationException();
        String hash = Sha256Hex.digest(canonical);
        int inserted = jdbc.update(
                "INSERT INTO organization.store_service_point_command_receipt(receipt_ref, workspace_uuid, group_workspace_key, idempotency_key, request_hash, target_kind, target_ref, created_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (workspace_uuid, group_workspace_key, idempotency_key) DO NOTHING",
                UUID.randomUUID(), workspaceUuid, groupWorkspaceKey, key, hash, targetKind, targetRef, time.currentEpochMillis());
        if (inserted == 1) return true;
        String stored = jdbc.queryForObject(
                "SELECT request_hash FROM organization.store_service_point_command_receipt WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?",
                String.class, workspaceUuid, groupWorkspaceKey, key);
        if (!hash.equals(stored)) throw new BusinessEntityService.OrganizationConflictException();
        return false;
    }

    private void audit(UUID workspaceUuid, String groupWorkspaceKey, UUID entityRef, String entityType, String action, AuditActor actor, long now, List<AuditChange> changes) {
        AuditChangePolicy policy = new AuditChangePolicy(entityType, action, changes.stream().map(AuditChange::fieldKey).collect(Collectors.toSet()));
        AuditActor effectiveActor = actor == null ? AuditActor.system() : actor;
        jdbc.update(
                "INSERT INTO organization.audit_event(id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb)",
                UUID.randomUUID(), workspaceUuid, groupWorkspaceKey, entityType, entityRef.toString(), effectiveActor.actorType(), effectiveActor.actorId(), effectiveActor.displaySnapshot(), action, now,
                AuditChangeJson.write(policy.allow(changes)));
    }

    private static List<AuditChange> changes(AreaRow before, String name, String code, String type, String status) {
        return List.of(
                        AuditChange.forNullableScalar("name", before.name, name),
                        AuditChange.forNullableScalar("code", before.code, code),
                        AuditChange.forNullableScalar("areaType", before.areaType, type),
                        AuditChange.forNullableScalar("status", before.status, status))
                .stream().filter(change -> !Objects.equals(change.beforeValue(), change.afterValue())).toList();
    }

    private static List<AuditChange> pointChanges(
            PointRow before,
            String name,
            String code,
            String type,
            String status,
            Long capacity,
            String shape,
            Boolean reservable,
            UUID image,
            ExtensionPayload extension) {
        List<AuditChange> changes = new ArrayList<>(List.of(
                AuditChange.forNullableScalar("name", before == null ? null : before.name, name),
                AuditChange.forNullableScalar("code", before == null ? null : before.code, code),
                AuditChange.forNullableScalar("pointType", before == null ? null : before.pointType, type),
                AuditChange.forNullableScalar("status", before == null ? null : before.status, status),
                AuditChange.forNullableScalar("seatCapacity", before == null || before.seatCapacity == null ? null : before.seatCapacity.toString(), capacity == null ? null : capacity.toString()),
                AuditChange.forNullableScalar("tableShape", before == null ? null : before.tableShape, shape),
                AuditChange.forNullableScalar("reservable", before == null || before.reservable == null ? null : before.reservable.toString(), reservable == null ? null : reservable.toString()),
                AuditChange.forNullableScalar("imageAssetRef", before == null || before.imageAssetRef == null ? null : before.imageAssetRef.toString(), image == null ? null : image.toString())));
        List<AuditChange> changed = changes.stream()
                .filter(change -> !Objects.equals(change.beforeValue(), change.afterValue()))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if (extension != null && extension.definition() != null) {
            changed.addAll(BusinessEntityValueSupport.extensionChanges(
                    before == null ? null : before.extensionValuesJson,
                    extension.json(),
                    extension.definition(),
                    extension.submission()));
        }
        return List.copyOf(changed);
    }

    private static OpaqueCollectionCursor.Position decodeCursor(String cursor, String identity) {
        try {
            return OpaqueCollectionCursor.decode(cursor, identity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new BusinessEntityService.OrganizationValidationException(failure);
        }
    }

    private static long cursorOrder(OpaqueCollectionCursor.Position position) {
        try {
            long value = Long.parseLong(position.sortKey());
            if (value < 0) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException failure) {
            throw new BusinessEntityService.OrganizationValidationException(failure);
        }
    }

    private long count(String sql, Object... args) {
        Long result = jdbc.queryForObject(sql, Long.class, args);
        return result == null ? 0 : result;
    }

    private static AreaRow areaRow(ResultSet result, int ignored) throws SQLException {
        return new AreaRow(result.getObject("area_ref", UUID.class), result.getObject("store_ref", UUID.class), result.getString("name"), result.getString("code"), result.getString("area_type"), result.getString("status"), result.getLong("display_order"), result.getLong("version"), result.getLong("created_at_epoch_millis"), result.getLong("updated_at_epoch_millis"));
    }

    private static PointRow pointRow(ResultSet result, int ignored) throws SQLException {
        return new PointRow(result.getObject("point_ref", UUID.class), result.getObject("store_ref", UUID.class), result.getObject("area_ref", UUID.class), result.getString("name"), result.getString("code"), result.getString("point_type"), result.getString("status"), result.getLong("display_order"), (Long) result.getObject("seat_capacity"), result.getString("table_shape"), (Boolean) result.getObject("reservable"), result.getObject("image_asset_ref", UUID.class), result.getString("extension_values"), (Long) result.getObject("extension_rule_revision"), result.getLong("version"), result.getLong("created_at_epoch_millis"), result.getLong("updated_at_epoch_millis"), result.getString("area_status"));
    }

    private QrRow readQrRow(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        List<QrRow> rows = jdbc.query(
                "SELECT store_ref, enabled, channel_ref, version, updated_at_epoch_millis FROM organization.store_qr_configuration WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=?",
                (result, ignored) -> new QrRow(result.getObject("store_ref", UUID.class), result.getBoolean("enabled"), result.getObject("channel_ref", UUID.class), result.getLong("version"), result.getLong("updated_at_epoch_millis")),
                workspaceUuid, groupWorkspaceKey, storeRef);
        return rows.isEmpty() ? new QrRow(storeRef, false, null, 1, 0) : rows.getFirst();
    }

    private QrSnapshot readQrSnapshot(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        QrRow qr = readQrRow(workspaceUuid, groupWorkspaceKey, storeRef);
        if (!qr.enabled || qr.channelRef == null) return new QrSnapshot(qr, null, null);
        QrChannelEligibilityLookup provider = qrChannels();
        return new QrSnapshot(qr, provider.read(workspaceUuid, groupWorkspaceKey, storeRef, qr.channelRef), provider);
    }

    private String qrUrl(QrSnapshot snapshot, String groupWorkspaceKey, UUID servicePointRef) {
        if (!snapshot.qr.enabled || snapshot.qr.channelRef == null || snapshot.channel == null || snapshot.provider == null) return null;
        return snapshot.provider.deriveUrl(snapshot.channel, groupWorkspaceKey, servicePointRef);
    }

    private QrChannelEligibilityLookup qrChannels() {
        QrChannelEligibilityLookup provider = qrChannels.getIfAvailable();
        if (provider == null) throw new BusinessEntityService.OrganizationValidationException();
        return provider;
    }

    private StoreServicePointAssetLifecycle assets() {
        StoreServicePointAssetLifecycle provider = assets.getIfAvailable();
        if (provider == null) throw new BusinessEntityService.OrganizationValidationException();
        return provider;
    }

    private void settleImage(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID pointRef,
            UUID previousAssetRef,
            UUID requestedAssetRef,
            String imageBindGrant) {
        if (Objects.equals(previousAssetRef, requestedAssetRef)) {
            if (imageBindGrant != null && !imageBindGrant.isBlank())
                throw new BusinessEntityService.OrganizationValidationException();
            return;
        }
        if (requestedAssetRef == null) {
            if (imageBindGrant != null && !imageBindGrant.isBlank())
                throw new BusinessEntityService.OrganizationValidationException();
        } else {
            assets().claimStaged(workspaceUuid, groupWorkspaceKey, storeRef, pointRef, requestedAssetRef, imageBindGrant);
        }
        if (previousAssetRef != null)
            assets().releaseActive(workspaceUuid, groupWorkspaceKey, storeRef, pointRef, previousAssetRef);
    }

    private boolean hasAreaBefore(UUID workspaceUuid, String groupWorkspaceKey, AreaRow row) {
        return count(
                        "SELECT count(*) FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED' AND (display_order < ? OR (display_order = ? AND area_ref < ?))",
                        workspaceUuid, groupWorkspaceKey, row.storeRef, row.displayOrder, row.displayOrder, row.areaRef)
                > 0;
    }

    private boolean hasAreaAfter(UUID workspaceUuid, String groupWorkspaceKey, AreaRow row) {
        return count(
                        "SELECT count(*) FROM organization.store_service_point_area WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED' AND (display_order > ? OR (display_order = ? AND area_ref > ?))",
                        workspaceUuid, groupWorkspaceKey, row.storeRef, row.displayOrder, row.displayOrder, row.areaRef)
                > 0;
    }

    private boolean hasPointBefore(UUID workspaceUuid, String groupWorkspaceKey, PointRow row) {
        return count(
                        "SELECT count(*) FROM organization.store_service_point WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND area_ref=? AND status <> 'VOIDED' AND (display_order < ? OR (display_order = ? AND point_ref < ?))",
                        workspaceUuid, groupWorkspaceKey, row.storeRef, row.areaRef, row.displayOrder, row.displayOrder, row.pointRef)
                > 0;
    }

    private boolean hasPointAfter(UUID workspaceUuid, String groupWorkspaceKey, PointRow row) {
        return count(
                        "SELECT count(*) FROM organization.store_service_point WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND area_ref=? AND status <> 'VOIDED' AND (display_order > ? OR (display_order = ? AND point_ref > ?))",
                        workspaceUuid, groupWorkspaceKey, row.storeRef, row.areaRef, row.displayOrder, row.displayOrder, row.pointRef)
                > 0;
    }

    private static String pageIdentity(
            String operation, UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID areaRef) {
        return operation + "\u001f"
                + Objects.toString(workspaceUuid, "<null>") + "\u001f"
                + Objects.toString(groupWorkspaceKey, "<null>") + "\u001f"
                + Objects.toString(storeRef, "<null>") + "\u001f"
                + Objects.toString(areaRef, "<null>") + "\u001f"
                + PAGE_SIZE + "\u001fdisplay_order,ref";
    }

    private static List<Area> indexedAreas(List<AreaRow> rows, boolean hasPrevious, boolean hasNext) {
        return java.util.stream.IntStream.range(0, rows.size()).mapToObj(index -> {
            AreaRow row = rows.get(index);
            return new Area(row.areaRef, row.storeRef, row.name, row.code, row.areaType, row.status, row.displayOrder, row.version,
                    row.createdAt, row.updatedAt, hasPrevious || index > 0, hasNext || index + 1 < rows.size());
        }).toList();
    }

    private static int indexOf(List<AreaRow> rows, UUID ref) {
        return java.util.stream.IntStream.range(0, rows.size()).filter(index -> ref.equals(rows.get(index).areaRef)).findFirst().orElse(-1);
    }

    private static int indexOfPoints(List<PointRow> rows, UUID ref) {
        return java.util.stream.IntStream.range(0, rows.size()).filter(index -> ref.equals(rows.get(index).pointRef)).findFirst().orElse(-1);
    }

    private void swapOrders(String table, AreaRow one, AreaRow two) {
        jdbc.update("UPDATE " + table + " SET display_order=? WHERE area_ref=?", two.displayOrder, one.areaRef);
        jdbc.update("UPDATE " + table + " SET display_order=? WHERE area_ref=?", one.displayOrder, two.areaRef);
    }

    private void swapOrders(String table, PointRow one, PointRow two) {
        jdbc.update("UPDATE " + table + " SET display_order=? WHERE point_ref=?", two.displayOrder, one.pointRef);
        jdbc.update("UPDATE " + table + " SET display_order=? WHERE point_ref=?", one.displayOrder, two.pointRef);
    }

    private static String canonical(Object command) {
        return command.getClass().getName() + "|" + command.toString();
    }

    private static String required(String value, int limit) {
        if (value == null || value.isBlank() || value.trim().length() > limit) throw new BusinessEntityService.OrganizationValidationException();
        return value.trim();
    }

    private static String areaType(String value) {
        if (!List.of("TABLE_AREA", "SCAN_AREA").contains(value)) throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static String pointType(String value) {
        if (!List.of("TABLE", "SCAN").contains(value)) throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static String status(String value) {
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(value)) throw new BusinessEntityService.OrganizationValidationException();
        return value;
    }

    private static boolean compatible(String areaType, String pointType) {
        return ("TABLE_AREA".equals(areaType) && "TABLE".equals(pointType)) || ("SCAN_AREA".equals(areaType) && "SCAN".equals(pointType));
    }

    private static void validatePointAttributes(String pointType, Long capacity, String shape, Boolean reservable, UUID image) {
        if ("TABLE".equals(pointType)) {
            if (capacity == null || capacity <= 0 || shape == null || shape.isBlank() || reservable == null) throw new BusinessEntityService.OrganizationValidationException();
            if (!List.of("HALL", "PRIVATE_ROOM", "BOOTH", "OUTDOOR").contains(shape)) throw new BusinessEntityService.OrganizationValidationException();
        } else if (capacity != null || shape != null || reservable != null || image != null) {
            throw new BusinessEntityService.OrganizationValidationException();
        }
    }

    private static void validatePageSize(int pageSize) {
        if (pageSize != PAGE_SIZE) throw new BusinessEntityService.OrganizationValidationException();
    }

    private record AreaRow(UUID areaRef, UUID storeRef, String name, String code, String areaType, String status, long displayOrder, long version, long createdAt, long updatedAt) {}
    private record PointRow(UUID pointRef, UUID storeRef, UUID areaRef, String name, String code, String pointType, String status, long displayOrder, Long seatCapacity, String tableShape, Boolean reservable, UUID imageAssetRef, String extensionValuesJson, Long extensionRuleRevision, long version, long createdAt, long updatedAt, String areaStatus) {}
    private record QrRow(UUID storeRef, boolean enabled, UUID channelRef, long version, long updatedAt) {}
    private record QrSnapshot(
            QrRow qr, QrChannelEligibilityLookup.Candidate channel, QrChannelEligibilityLookup provider) {}
    private record ExtensionPayload(
            String json,
            Long revision,
            ExtensionDefinitionReadback definition,
            ExtensionSubmission submission) {}
}
