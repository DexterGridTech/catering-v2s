package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.List;
import java.util.UUID;

/** Organization-owned facts for the store service-point and QR management surface. */
public interface StoreServicePointOwnerApi {
    AreaPage listAreas(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String cursor, int pageSize);

    PointPage listPoints(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID areaRef, String cursor, int pageSize);

    Point readPoint(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID pointRef);

    QrConfiguration readQrConfiguration(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef);

    Area createArea(AreaCommand command);

    Area updateArea(AreaCommand command);

    Area transitionArea(StatusCommand command);

    Area moveArea(OrderCommand command);

    Point createPoint(PointCommand command);

    Point updatePoint(PointCommand command);

    Point transitionPoint(StatusCommand command);

    Point movePoint(OrderCommand command);

    QrConfiguration updateQrConfiguration(QrConfigurationCommand command);

    record AreaPage(List<Area> items, String nextCursor, long total) {
        public AreaPage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }

    record PointPage(List<Point> items, String nextCursor, long total) {
        public PointPage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }

    record Area(
            UUID areaRef,
            UUID storeRef,
            String name,
            String code,
            String areaType,
            String status,
            long displayOrder,
            long version,
            long createdAt,
            long updatedAt,
            boolean canMoveUp,
            boolean canMoveDown) {}

    record Point(
            UUID pointRef,
            UUID storeRef,
            UUID areaRef,
            String name,
            String code,
            String pointType,
            String status,
            long displayOrder,
            Long seatCapacity,
            String tableShape,
            Boolean reservable,
            UUID imageAssetRef,
            String extensionValuesJson,
            Long extensionRuleRevision,
            boolean effectiveAvailable,
            String qrUrl,
            long version,
            long createdAt,
            long updatedAt,
            boolean canMoveUp,
            boolean canMoveDown) {}

    record QrConfiguration(
            UUID storeRef,
            boolean enabled,
            UUID channelRef,
            String channelName,
            String channelCode,
            String urlRule,
            long version,
            long updatedAt) {}

    record AreaCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID areaRef,
            String name,
            String code,
            String areaType,
            String status,
            Long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {}

    record PointCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID pointRef,
            UUID areaRef,
            String name,
            String code,
            String pointType,
            String status,
            Long seatCapacity,
            String tableShape,
            Boolean reservable,
            UUID imageAssetRef,
            String imageBindGrant,
            ExtensionSubmission extensionSubmission,
            Long extensionRuleRevision,
            Long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {}

    record StatusCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID targetRef,
            String targetKind,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {}

    record OrderCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID targetRef,
            String targetKind,
            String direction,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {}

    record QrConfigurationCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            boolean enabled,
            UUID channelRef,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {}
}
