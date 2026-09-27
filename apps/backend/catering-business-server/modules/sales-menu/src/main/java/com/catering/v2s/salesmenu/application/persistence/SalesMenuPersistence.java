package com.catering.v2s.salesmenu.application.persistence;

import static com.catering.v2s.salesmenu.application.SalesMenuReadModels.*;

import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.application.SalesMenuReadModels;
import com.catering.v2s.salesmenu.domain.SalesMenuAggregate;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMediaMode;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScheduleKind;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Typed SQL execution boundary for the sales-menu owner.
 *
 * <p>Spring wiring uses the JdbcTemplate constructor; application services never receive SQL text, row mappers or
 * varargs.
 */
@Repository
public class SalesMenuPersistence {
    private final JdbcTemplate jdbc;

    @Autowired
    public SalesMenuPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<SalesMenuAggregate> find(SalesMenuTarget target) {
        return find(target, false);
    }

    public Optional<SalesMenuAggregate> findForUpdate(SalesMenuTarget target) {
        return find(target, true);
    }

    public boolean compareAndSetVersion(SalesMenuTarget target, long expectedVersion) {
        return update(
                        SalesMenuCollectionPersistenceSql.UPDATE_SALES_COLLECTION_VER_COLLECTION_005
                                + SalesMenuCollectionPersistenceSql.CONDITION_WS_UUID_GRP_WS_006,
                        target.salesMenuRef(),
                        target.scope().workspaceUuid(),
                        target.scope().groupWorkspaceKey(),
                        target.scope().storeRef(),
                        expectedVersion)
                == 1;
    }

    public void lockCommandReceipt(UUID workspaceUuid, String operationId, String idempotencyKey) {
        com.catering.v2s.platform.foundation.persistence.AdvisoryLock.acquire(
                jdbc, "sales-menu-receipt", workspaceUuid + ":" + operationId, idempotencyKey);
    }

    public List<SalesMenuReadModels.ReceiptRow> readCommandReceipt(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_007
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public int insertCommandReceipt(
            UUID receiptRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String operationId,
            String idempotencyKey,
            String requestHash,
            String status,
            String readbackJson,
            long createdAtEpochMillis) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_OPERATION_ID_IDEMPOTENCY_KEY_REQUEST_HASH_STATUS
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_VALUES_VALUES_JSONB
                        + SalesMenuDefinitionServiceSql.JOIN_CONDITION_WS_UUID_OP_008,
                receiptRef,
                workspaceUuid,
                groupWorkspaceKey,
                operationId,
                idempotencyKey,
                requestHash,
                status,
                readbackJson,
                createdAtEpochMillis);
    }

    public List<SalesMenuReadModels.ReceiptRow> readCommandReceiptForReplay(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_ALT_A_009
                        + SalesMenuDefinitionServiceSql.WHERE_WS_UUID_OP_ID_ALT_A_010,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public void recordSuccess(
            UUID recordRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID channelRef,
            UUID menuRef,
            String operation,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis,
            String idempotencyKey) {
        update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_TARGET_DISPLAY_SNAPSHOT_RESULT_ACTOR_TYPE_ACTOR_ID
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_OCCURRED_AT_EPOCH_MILLIS_IDEMPOTENCY_KEY,
                recordRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                channelRef,
                menuRef,
                operation,
                targetRef,
                targetKind,
                targetDisplaySnapshot,
                result,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis,
                idempotencyKey);
    }

    public List<MenuListRow> listMenuRows(
            SalesMenuListQuery query, OpaqueCollectionCursor.Position position, String filter) {
        List<Object> arguments = new ArrayList<>(List.of(
                query.channelRef(),
                query.scope().workspaceUuid(),
                query.scope().groupWorkspaceKey(),
                query.scope().storeRef(),
                "%" + filter + "%"));
        StringBuilder frontier = new StringBuilder();
        if (position != null) {
            frontier.append(SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CONDITION_NAME_COLLECTION_REF);
            arguments.add(position.sortKey());
            arguments.add(position.sortKey());
            arguments.add(position.tieBreaker());
        }
        arguments.add(query.page().pageSize() + 1);
        return query(
                SalesMenuDefinitionServiceSql.SELECT_COLLECTION_REF_STORE_REF_001
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_REVISION_DRAFT_REVISION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_REVISION_PUBLISHED_REVISION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_PUBLICATION
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SCHEDULE_KIND_SCHEDULE_START_LOCAL_TIME
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SCHEDULE_END_LOCAL_TIME
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SALES_COLLECTION
                        + SalesMenuDefinitionServiceSql.JOIN_SALES_COLLECTION_VER_REF_002
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SALES_COLLECTION_VERSION_LEFT_JOIN_SALES_MENU_SALES_C
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_JOIN_CONDITION_VERSION_REF_LATEST_PUBLISHED_VERSION_REF
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SALES_PUBLICATION_PUBLICATION
                        + SalesMenuDefinitionServiceSql.JOIN_CONDITION_PUBLICATION_PUBLISHED_VER_003
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_CONDITION_PUBLICATION_COLLECTION_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SALES_COLLECTION_ACTIVATION_LEFT_JOIN_SALES_MENU_SALES_C
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_JOIN_CONDITION_COLLECTION_REF_CHANNEL_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_REF_NAME
                        + frontier
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_ORDER_BY_NAME_COLLECTION_REF,
                SalesMenuReadModels::menuListRow,
                arguments.toArray());
    }

    public List<ActivationRow> readActivation(UUID menuRef, UUID channelRef) {
        return query(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SELECT_CHANNEL_REF_STATUS_VERSION
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_COLLECTION_ACTIVATION_004
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_WHERE_COLLECTION_REF_CHANNEL_REF,
                SalesMenuReadModels::activationRow,
                menuRef,
                channelRef);
    }

    public int createCollection(UUID menuRef, SalesMenuScope scope, String name) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_STORE_REF_NAME_VERSION,
                menuRef,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                scope.storeRef(),
                name);
    }

    public int attachDraftToCollection(UUID draftRef, UUID menuRef) {
        return update(
                SalesMenuDefinitionServiceSql
                        .SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF_COLLECTION_REF,
                draftRef,
                menuRef);
    }

    public int initializeCollectionActivation(UUID menuRef, UUID channelRef, String status) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_ACTIVATION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_VERSION,
                menuRef,
                channelRef,
                status);
    }

    public int renameCollection(String name, UUID menuRef) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_NAME_COLLECTION_REF,
                name,
                menuRef);
    }

    public int archiveCollection(long archivedAtEpochMillis, UUID menuRef) {
        return update(
                SalesMenuDefinitionServiceSql
                        .SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_ARCHIVED_AT_EPOCH_MILLIS_COLLECTION_REF,
                archivedAtEpochMillis,
                menuRef);
    }

    public int updateActivation(UUID menuRef, UUID channelRef, String status) {
        return update(
                SalesMenuDefinitionServiceSql.INSERT_INTO_SALES_COLLECTION_ACTIVATION_006
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_COLLECTION_REF_CHANNEL_REF_STATUS_VERSION
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_VALUES_SET_COLLECTION_REF_CHANNEL_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_STATUS_VERSION_SALES_COLLECTION_ACTIVATION,
                menuRef,
                channelRef,
                status);
    }

    public int updateSchedule(UUID versionRef, SalesMenuSchedule schedule) {
        return update(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_VERSION_SCHEDULE_KIND
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SCHEDULE_START_LOCAL_TIME
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SCHEDULE_END_LOCAL_TIME_VERSION_REF,
                schedule.kind().name(),
                schedule.startLocalTime(),
                schedule.endLocalTime(),
                versionRef);
    }

    public int copyCollection(UUID menuRef, SalesMenuScope scope, String name) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_STORE_REF_NAME_VERSION_ALTERNATE_A,
                menuRef,
                scope.workspaceUuid(),
                scope.groupWorkspaceKey(),
                scope.storeRef(),
                name);
    }

    public int attachCopiedDraft(UUID draftRef, UUID menuRef) {
        return update(SalesMenuDefinitionServiceSql.UPDATE_SALES_COLLECTION_CUR_DRAFT_ALT_A_005, draftRef, menuRef);
    }

    public List<SectionOrderRow> readSectionsForCopy(UUID sourceVersion) {
        return query(
                SalesMenuDefinitionServiceSql.SELECT_SALES_VER_SECTION_REF_011
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_DISPLAY_ORDER,
                SalesMenuReadModels::sectionOrderRow,
                sourceVersion);
    }

    public int createCopiedSection(UUID sectionRef, UUID menuRef) {
        return update(
                SalesMenuDefinitionServiceSql
                        .SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_SECTION_SECTION_REF_COLLECTION_REF,
                sectionRef,
                menuRef);
    }

    public int copySectionVersion(UUID targetVersion, UUID sectionRef, UUID menuRef, SectionOrderRow row) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_SECTION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DISPLAY_ORDER
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_VALUES,
                targetVersion,
                sectionRef,
                menuRef,
                row.name(),
                row.displayOrder());
    }

    public List<ItemRow> readItemsForCopy(UUID sourceVersion) {
        return query(
                SalesMenuDefinitionServiceSql.SELECT_VER_REF_SALES_ITEM_012
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_VERSION_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_RESOLVED_PRODUCT_SHAPE
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_RESOLVED_SALES_UNIT_NAME
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_LISTED_PRICE_CENTS_ORDERING_CONSTRAINTS_JSON
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_DISPLAY_MEDIA_MODE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CAN_MOVE_UP_CAN_MOVE_DOWN
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_VER_ITEM_013
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_JOIN_SALES_ITEM_SALES_ITEM_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_DISPLAY_ORDER_ALTERNATE_A,
                SalesMenuReadModels::itemRow,
                sourceVersion);
    }

    public int createCopiedItem(UUID itemRef, UUID menuRef, UUID catalogItemRef) {
        return update(SalesMenuDefinitionServiceSql.INSERT_INTO_SALES_ITEM_SALES_014, itemRef, menuRef, catalogItemRef);
    }

    public int copyItemVersion(
            UUID targetVersion, UUID itemRef, UUID sectionRef, UUID menuRef, long displayOrder, ItemRow row) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_RESOLVED_PRODUCT_SHAPE_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DISPLAY_MEDIA_MODE_VERSION,
                targetVersion,
                itemRef,
                sectionRef,
                menuRef,
                displayOrder,
                row.displayNameOverride(),
                row.resolvedItemName(),
                row.resolvedItemCode(),
                row.resolvedProductShape(),
                row.listedPriceCents(),
                row.orderingConstraintsJson(),
                row.displayMediaMode());
    }

    public int copySku(UUID targetVersion, UUID itemRef, SkuRow sku) {
        return update(
                SalesMenuDefinitionServiceSql.INSERT_INTO_SALES_VER_ITEM_015
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_LISTED_PRICE_CENTS
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DISPLAY_ORDER_ALTERNATE_B,
                targetVersion,
                itemRef,
                sku.skuRef(),
                sku.listedPriceCents(),
                sku.resolvedSkuCode(),
                sku.resolvedSkuName(),
                sku.defaultPriceCents(),
                sku.displayOrder());
    }

    public int copyOrderOption(UUID targetVersion, UUID itemRef, SalesMenuReadback.SalesMenuOrderOption option) {
        return update(
                SalesMenuDefinitionServiceSql.INSERT_INTO_SALES_VER_ITEM_016
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DEFINITION_REF
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_MAX_SELECTION_COUNT_DISPLAY_ORDER,
                targetVersion,
                itemRef,
                option.definitionRef(),
                option.name(),
                option.selectionMode(),
                option.required(),
                option.minSelectionCount(),
                option.maxSelectionCount(),
                option.displayOrder());
    }

    public int copyOrderOptionValue(
            UUID targetVersion, UUID itemRef, UUID definitionRef, SalesMenuReadback.SalesMenuOrderOptionValue value) {
        return update(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_ORDER_OPTION_VA
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DEFINITION_REF_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_DEFAULT_VALUE_EXTRA_PRICE,
                targetVersion,
                itemRef,
                definitionRef,
                value.definitionValueRef(),
                value.name(),
                value.displayOrder(),
                value.defaultValue(),
                value.extraPrice());
    }

    public int copyMedia(UUID targetVersion, UUID itemRef, UUID assetRef, int displayOrder) {
        return update(
                SalesMenuDefinitionServiceSql.INSERT_INTO_SALES_VER_ITEM_017
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_ASSET_REF_DISPLAY_ORDER,
                targetVersion,
                itemRef,
                assetRef,
                displayOrder);
    }

    public int insertVersion(
            UUID versionRef,
            UUID menuRef,
            SalesMenuVersionKind kind,
            long revision,
            SalesMenuSchedule schedule,
            UUID sourceDraftRef,
            Long sourceDraftRevision) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COLLECTION_VERSION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SCHEDULE_KIND
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SOURCE_DRAFT_VERSION_REF_SOURCE_DRAFT_REVISION_VERSION,
                versionRef,
                menuRef,
                kind.name(),
                revision,
                schedule.kind().name(),
                schedule.startLocalTime(),
                schedule.endLocalTime(),
                sourceDraftRef,
                sourceDraftRef == null ? null : sourceDraftRevision);
    }

    public int insertPublicationRecord(
            UUID publicationRef,
            UUID collectionRef,
            UUID publishedVersionRef,
            long sourceDraftRevision,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis) {
        return update(
                SalesMenuPublicationServiceSql.INSERT_INTO_SALES_PUBLICATION_REF_001
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_PUBLISHED_VERSION_REF
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_SOURCE_DRAFT_REVISION
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_OCCURRED_AT_EPOCH_MILLIS,
                publicationRef,
                collectionRef,
                publishedVersionRef,
                sourceDraftRevision,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis);
    }

    public int setLatestPublishedVersion(UUID publishedVersionRef, UUID collectionRef) {
        return update(
                SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_UPDATE_SALES_COLLECTION_LATEST_PUBLISHED_VERSION_REF
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_WHERE_COLLECTION_REF,
                publishedVersionRef,
                collectionRef);
    }

    public int removeUnpublishedChildManualStatuses(UUID collectionRef, UUID publishedVersionRef) {
        return update(
                SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_DELETE_SALES_MANUAL_STATUS_CURRENT_CURRENT_STATUS
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_USING_SALES_ITEM_ITEM
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_WHERE_CURRENT_STATUS_SALES_ITEM_REF_ITEM
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_CONDITION_ITEM_COLLECTION_REF
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_CONDITION_CURRENT_STATUS_TARGET_KIND_ITEM
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_CONDITION_AND_NOT_EXISTS
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_SELECT_SALES_VERSION_ITEM_SKU_SKU
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_WHERE_SKU_VERSION_REF_SALES_ITEM_REF_CURRENT_STATUS
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_CONDITION_CURRENT_STATUS_TARGET_KIND_SKU_SKU_REF
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_CONDITION_AND_NOT_EXISTS_ALTERNATE_A
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_SELECT_SALES_VERSION_ITEM_ORDER_OPTION_VA_OPTION_VALUE
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_WHERE_OPTION_VALUE_VERSION_REF_SALES_ITEM_REF
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_CURRENT_STATUS_SALES_ITEM_REF
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_CONDITION_CURRENT_STATUS_TARGET_KIND_ORDER_OPTION_VALUE
                        + SalesMenuPublicationServiceSql.CONDITION_OPT_VAL_DEF_VAL_002,
                collectionRef,
                publishedVersionRef,
                publishedVersionRef);
    }

    public int copyPublishedSections(UUID targetVersionRef, UUID sourceVersionRef) {
        return update(
                SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_INSERT_INTO_SALES_VERSION_SECTION
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_DISPLAY_ORDER
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_SELECT_SECTION_REF_COLLECTION_REF_NAME_DISPLAY_ORDER
                        + SalesMenuPublicationServiceSql.FROM_CLAUSE_SALES_VER_SECTION_003
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_WHERE_VERSION_REF,
                targetVersionRef,
                sourceVersionRef);
    }

    public int insertPublishedOrderOption(
            UUID versionRef, UUID itemRef, SalesMenuReadback.SalesMenuOrderOption option) {
        return update(
                SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_ORDER_OPTION
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_DEFINITION_REF
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_MAX_SELECTION_COUNT_DISPLAY_ORDER,
                versionRef,
                itemRef,
                option.definitionRef(),
                option.name(),
                option.selectionMode(),
                option.required(),
                option.minSelectionCount(),
                option.maxSelectionCount(),
                option.displayOrder());
    }

    public int insertPublishedOrderOptionValue(
            UUID versionRef, UUID itemRef, UUID definitionRef, SalesMenuReadback.SalesMenuOrderOptionValue value) {
        return update(
                SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_ORDER_OPTION_VA
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_DEFINITION_REF_ALTERNATE_A
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_DEFAULT_VALUE_EXTRA_PRICE,
                versionRef,
                itemRef,
                definitionRef,
                value.definitionValueRef(),
                value.name(),
                value.displayOrder(),
                value.defaultValue(),
                value.extraPrice());
    }

    public int insertPublishedItems(List<PublicationItemSeed> items) {
        if (items.isEmpty()) return 0;
        StringBuilder values = new StringBuilder();
        List<Object> arguments = new ArrayList<>(items.size() * 18);
        for (PublicationItemSeed item : items) {
            if (!values.isEmpty()) values.append(SalesMenuPublicationServiceSql.VALUE_SEPARATOR);
            values.append(SalesMenuPublicationServiceSql.PUBLICATION_ITEM_VALUE_ROW);
            arguments.add(item.versionRef());
            arguments.add(item.salesItemRef());
            arguments.add(item.sectionRef());
            arguments.add(item.collectionRef());
            arguments.add(item.displayOrder());
            arguments.add(item.displayNameOverride());
            arguments.add(item.resolvedItemName());
            arguments.add(item.resolvedItemCode());
            arguments.add(item.resolvedProductShape());
            arguments.add(item.resolvedSalesUnitRef());
            arguments.add(item.resolvedSalesUnitCode());
            arguments.add(item.resolvedSalesUnitName());
            arguments.add(item.resolvedSalesUnitDimension());
            arguments.add(item.resolvedSalesUnitPrecision());
            arguments.add(item.listedPriceCents());
            arguments.add(item.orderingConstraintsJson());
            arguments.add(item.displayMediaMode());
            arguments.add(item.publishedPrimaryImageAssetRef());
            arguments.add(item.publishedCatalogImageAssetRefsJson());
        }
        return update(
                SalesMenuPublicationServiceSql.INSERT_INTO_SALES_VER_ITEM_004
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_COLLECTION_REF
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_RESOLVED_PRODUCT_SHAPE
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_RESOLVED_SALES_UNIT_NAME
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_LISTED_PRICE_CENTS
                        + SalesMenuPublicationServiceSql
                                .SALES_MENU_PUBLICATION_SERVICE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF
                        + values,
                arguments.toArray());
    }

    public int insertPublishedSkus(List<PublicationSkuSeed> skus) {
        if (skus.isEmpty()) return 0;
        StringBuilder values = new StringBuilder();
        List<Object> arguments = new ArrayList<>(skus.size() * 8);
        for (PublicationSkuSeed sku : skus) {
            if (!values.isEmpty()) values.append(SalesMenuPublicationServiceSql.VALUE_SEPARATOR);
            values.append(SalesMenuPublicationServiceSql.PUBLICATION_SKU_VALUE_ROW);
            arguments.add(sku.versionRef());
            arguments.add(sku.salesItemRef());
            arguments.add(sku.skuRef());
            arguments.add(sku.listedPriceCents());
            arguments.add(sku.resolvedSkuCode());
            arguments.add(sku.resolvedSkuName());
            arguments.add(sku.defaultPriceCents());
            arguments.add(sku.displayOrder());
        }
        return update(
                SalesMenuPublicationServiceSql.INSERT_INTO_SALES_VER_ITEM_005
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_LISTED_PRICE_CENTS_ALTERNATE_A
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_DISPLAY_ORDER_ALTERNATE_A
                        + values,
                arguments.toArray());
    }

    public int insertPublishedMedia(List<PublicationMediaSeed> media) {
        if (media.isEmpty()) return 0;
        StringBuilder values = new StringBuilder();
        List<Object> arguments = new ArrayList<>(media.size() * 4);
        for (PublicationMediaSeed item : media) {
            if (!values.isEmpty()) values.append(SalesMenuPublicationServiceSql.VALUE_SEPARATOR);
            values.append(SalesMenuPublicationServiceSql.PUBLICATION_MEDIA_VALUE_ROW);
            arguments.add(item.versionRef());
            arguments.add(item.salesItemRef());
            arguments.add(item.assetRef());
            arguments.add(item.displayOrder());
        }
        return update(
                SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_MEDIA
                        + SalesMenuPublicationServiceSql.SALES_MENU_PUBLICATION_SERVICE_DISPLAY_ORDER_ALTERNATE_B
                        + values,
                arguments.toArray());
    }

    public List<UUID> readEnabledActivationChannels(UUID collectionRef) {
        return query(
                        SalesMenuPublicationServiceSql.SELECT_SALES_COLLECTION_ACTIVATION_CHANNEL_006
                                + SalesMenuPublicationServiceSql
                                        .SALES_MENU_PUBLICATION_SERVICE_CONDITION_STATUS_ENABLED_CHANNEL_REF,
                        SalesMenuReadModels::uuidValueRow,
                        collectionRef)
                .stream()
                .map(UuidValueRow::value)
                .toList();
    }

    public record PublicationItemSeed(
            UUID versionRef,
            UUID salesItemRef,
            UUID sectionRef,
            UUID collectionRef,
            long displayOrder,
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
            UUID publishedPrimaryImageAssetRef,
            String publishedCatalogImageAssetRefsJson) {}

    public record PublicationSkuSeed(
            UUID versionRef,
            UUID salesItemRef,
            UUID skuRef,
            long listedPriceCents,
            String resolvedSkuCode,
            String resolvedSkuName,
            long defaultPriceCents,
            long displayOrder) {}

    public record PublicationMediaSeed(UUID versionRef, UUID salesItemRef, UUID assetRef, int displayOrder) {}

    public List<OrderOptionGroupRow> readOrderOptionGroups(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuDefinitionServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuDefinitionServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(versionRef);
        arguments.addAll(itemRefs);
        return query(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_MIN_SELECTION_COUNT_MAX_SELECTION_COUNT_DISPLAY_ORDER
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CONDITION_SALES_ITEM_REF
                        + placeholders
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_DEFINITION_REF,
                SalesMenuReadModels::orderOptionGroupRow,
                arguments.toArray());
    }

    public List<OrderOptionValueRow> readOrderOptionValues(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuDefinitionServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuDefinitionServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(versionRef);
        arguments.addAll(itemRefs);
        return query(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_DEFAULT_VALUE_EXTRA_PRICE_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_VER_ITEM_018
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_A
                        + placeholders
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF,
                SalesMenuReadModels::orderOptionValueRow,
                arguments.toArray());
    }

    public List<SkuRow> readSkuRows(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuDefinitionServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuDefinitionServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(versionRef);
        arguments.addAll(itemRefs);
        return query(
                SalesMenuDefinitionServiceSql.SELECT_SALES_ITEM_REF_SKU_019
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SALES_VERSION_ITEM_SKU_DEFAULT_PRICE_CENTS_DISPLAY_ORDER
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF
                        + placeholders
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN_ALTERNATE_B
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_SKU_REF,
                SalesMenuReadModels::skuRow,
                arguments.toArray());
    }

    public List<MediaItemRow> readMediaItems(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuDefinitionServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuDefinitionServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(versionRef);
        arguments.addAll(itemRefs);
        return query(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_ITEM_REF_ASSET_REF_DISPLAY_ORDER
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_MEDIA_VERSION_REF
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_B
                        + placeholders
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_CLOSE_PAREN_ALTERNATE_C
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_ASSET_REF,
                SalesMenuReadModels::mediaItemRow,
                arguments.toArray());
    }

    public Optional<UUID> readDraftVersion(UUID menuRef) {
        return query(
                        SalesMenuDefinitionServiceSql
                                        .SALES_MENU_DEFINITION_SERVICE_SELECT_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF
                                + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_WHERE_COLLECTION_REF,
                        SalesMenuReadModels::uuidValueRow,
                        menuRef)
                .stream()
                .findFirst()
                .map(UuidValueRow::value);
    }

    public int advanceDraftRevision(UUID versionRef) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_UPDATE_SALES_COLLECTION_VERSION_REVISION
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_WHERE_VERSION_REF_KIND_DRAFT,
                versionRef);
    }

    public List<SalesMenuReadModels.ReceiptRow> readDefinitionCommandReceipt(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_007
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public int insertDefinitionCommandReceipt(
            UUID receiptRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String operationId,
            String idempotencyKey,
            String requestHash,
            String status,
            String readbackJson,
            long createdAtEpochMillis) {
        return update(
                SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT
                        + SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_OPERATION_ID_IDEMPOTENCY_KEY_REQUEST_HASH_STATUS
                        + SalesMenuDefinitionServiceSql.SALES_MENU_DEFINITION_SERVICE_VALUES_VALUES_JSONB
                        + SalesMenuDefinitionServiceSql.JOIN_CONDITION_WS_UUID_OP_008,
                receiptRef,
                workspaceUuid,
                groupWorkspaceKey,
                operationId,
                idempotencyKey,
                requestHash,
                status,
                readbackJson,
                createdAtEpochMillis);
    }

    public List<SalesMenuReadModels.ReceiptRow> readDefinitionCommandReceiptForReplay(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuDefinitionServiceSql
                                .SALES_MENU_DEFINITION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT_ALTERNATE_A
                        + SalesMenuDefinitionServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_ALT_A_009
                        + SalesMenuDefinitionServiceSql.WHERE_WS_UUID_OP_ID_ALT_A_010,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public void recordDefinitionOperation(
            UUID recordRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID channelRef,
            UUID menuRef,
            String operation,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis,
            String idempotencyKey) {
        recordSuccess(
                recordRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                channelRef,
                menuRef,
                operation,
                targetRef,
                targetKind,
                targetDisplaySnapshot,
                result,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis,
                idempotencyKey);
    }

    public enum OrderingTable {
        SECTION,
        ITEM
    }

    public int createSection(UUID sectionRef, UUID menuRef) {
        return update(
                SalesMenuSectionServiceSql
                        .SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_SECTION_SECTION_REF_COLLECTION_REF,
                sectionRef,
                menuRef);
    }

    public int createSectionVersion(UUID versionRef, UUID sectionRef, UUID menuRef, String name, UUID maxOrderVersion) {
        return update(
                SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_VERSION_SECTION
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_DISPLAY_ORDER
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_VALUES_DISPLAY_ORDER
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_VERSION_SECTION_VERSION_REF,
                versionRef,
                sectionRef,
                menuRef,
                name,
                maxOrderVersion);
    }

    public int renameSection(UUID versionRef, UUID sectionRef, String name) {
        return update(
                SalesMenuSectionServiceSql
                        .SALES_MENU_SECTION_SERVICE_UPDATE_SALES_VERSION_SECTION_NAME_VERSION_REF_SECTION_REF,
                name,
                versionRef,
                sectionRef);
    }

    public boolean sectionHasItems(UUID versionRef, UUID sectionRef) {
        return !query(
                        SalesMenuSectionServiceSql.SELECT_SALES_VER_ITEM_SELECT_001
                                + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF_SECTION_REF,
                        SalesMenuReadModels::existsRow,
                        versionRef,
                        sectionRef)
                .isEmpty();
    }

    public int deleteSection(UUID versionRef, UUID sectionRef) {
        return update(
                SalesMenuSectionServiceSql
                        .SALES_MENU_SECTION_SERVICE_DELETE_SALES_VERSION_SECTION_VERSION_REF_SECTION_REF,
                versionRef,
                sectionRef);
    }

    public List<SectionCurrentRow> readCurrentSection(UUID menuRef, UUID versionRef, UUID sectionRef) {
        return query(
                SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_SELECT_SALES_VERSION_SECTION_SECTION_REF_DISPLAY_ORDER
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_SECTION_REF_ALTERNATE_A,
                SalesMenuReadModels::sectionCurrentRow,
                menuRef,
                versionRef,
                sectionRef);
    }

    public List<SectionRow> readSections(UUID versionRef) {
        return query(
                SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_SELECT_SECTION_REF_NAME_DISPLAY_ORDER
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_VERSION_REF
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_CONDITION_SECTION_REF_ITEM_COUNT
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_SALES_VERSION_SECTION_PREVIOUS
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_PREVIOUS_VERSION_REF
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_PREVIOUS_SECTION_REF_CAN_MOVE_UP
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_SALES_VERSION_SECTION_NEXT_SECTION
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_NEXT_SECTION_VERSION_REF
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_OPEN_PAREN_NEXT_SECTION_DISPLAY_ORDER
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_OPEN_PAREN_NEXT_SECTION_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_NEXT_SECTION_SECTION_REF_CAN_MOVE_DOWN
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_FROM_CLAUSE_SALES_VERSION_SECTION_VERSION_REF_ALTERNATE_A
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_ORDER_BY_DISPLAY_ORDER_SECTION_REF,
                SalesMenuReadModels::sectionRow,
                versionRef,
                versionRef);
    }

    public Optional<UUID> readSectionDraftVersion(UUID menuRef) {
        return query(
                        SalesMenuSectionServiceSql
                                        .SALES_MENU_SECTION_SERVICE_SELECT_SALES_COLLECTION_CURRENT_DRAFT_VERSION_REF
                                + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF,
                        SalesMenuReadModels::uuidValueRow,
                        menuRef)
                .stream()
                .findFirst()
                .map(UuidValueRow::value);
    }

    public Optional<UUID> readSectionPublishedVersion(UUID menuRef) {
        return query(
                        SalesMenuSectionServiceSql
                                        .SALES_MENU_SECTION_SERVICE_SELECT_SALES_COLLECTION_LATEST_PUBLISHED_VERSION_REF
                                + SalesMenuSectionServiceSql
                                        .SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF_ALTERNATE_A,
                        SalesMenuReadModels::uuidValueRow,
                        menuRef)
                .stream()
                .filter(row -> row.value() != null)
                .findFirst()
                .map(UuidValueRow::value);
    }

    public List<OrderingTargetRow> findAdjacent(
            OrderingTable table,
            UUID versionRef,
            UUID targetRef,
            SalesMenuMoveDirection direction,
            UUID sectionRef,
            long currentOrder) {
        String tableName = table == OrderingTable.SECTION
                ? SalesMenuSectionServiceSql.SALES_VERSION_SECTION_TABLE
                : SalesMenuItemServiceSql.SALES_VERSION_ITEM_TABLE;
        String refColumn = table == OrderingTable.SECTION
                ? SalesMenuSectionServiceSql.SECTION_REF_COLUMN
                : SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN;
        boolean movingUp = direction == SalesMenuMoveDirection.UP;
        String adjacencyPredicate = movingUp
                ? SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_CONDITION_DISPLAY_ORDER
                        + refColumn
                        + SalesMenuSectionServiceSql.ADJACENCY_LESS_SUFFIX
                : SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_CONDITION_DISPLAY_ORDER_ALTERNATE_A
                        + refColumn
                        + SalesMenuSectionServiceSql.ADJACENCY_GREATER_SUFFIX;
        String adjacencyOrder = movingUp
                ? SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_ORDER_BY_DISPLAY_ORDER
                        + refColumn
                        + SalesMenuSectionServiceSql.DISPLAY_ORDER_DESC_LOCK_SUFFIX
                : SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_ORDER_BY_DISPLAY_ORDER_ALTERNATE_A
                        + refColumn
                        + SalesMenuSectionServiceSql.DISPLAY_ORDER_ASC_LOCK_SUFFIX;
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        String sectionPredicate = "";
        if (sectionRef != null) {
            sectionPredicate = SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_CONDITION_SECTION_REF;
            arguments.add(sectionRef);
        }
        arguments.add(currentOrder);
        arguments.add(currentOrder);
        arguments.add(targetRef);
        return query(
                SalesMenuSectionServiceSql.SELECT_PREFIX
                        + refColumn
                        + SalesMenuSectionServiceSql.DISPLAY_ORDER_PROJECTION
                        + tableName
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF
                        + sectionPredicate
                        + adjacencyPredicate
                        + adjacencyOrder,
                SalesMenuReadModels::orderingTargetRow,
                arguments.toArray());
    }

    public long maxDisplayOrder(OrderingTable table, UUID versionRef, UUID sectionRef) {
        String tableName = table == OrderingTable.SECTION
                ? SalesMenuSectionServiceSql.SALES_VERSION_SECTION_TABLE
                : SalesMenuItemServiceSql.SALES_VERSION_ITEM_TABLE;
        String sectionPredicate =
                sectionRef == null ? "" : SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_CONDITION_SECTION_REF;
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        if (sectionRef != null) arguments.add(sectionRef);
        return query(
                        SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_SELECT_DISPLAY_ORDER_VALUE
                                + tableName
                                + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF_ALTERNATE_A
                                + sectionPredicate,
                        SalesMenuReadModels::longValueRow,
                        arguments.toArray())
                .getFirst()
                .value();
    }

    public int setDisplayOrder(OrderingTable table, UUID versionRef, UUID targetRef, long displayOrder) {
        String tableName = table == OrderingTable.SECTION
                ? SalesMenuSectionServiceSql.SALES_VERSION_SECTION_TABLE
                : SalesMenuItemServiceSql.SALES_VERSION_ITEM_TABLE;
        String refColumn = table == OrderingTable.SECTION
                ? SalesMenuSectionServiceSql.SECTION_REF_COLUMN
                : SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN;
        return update(
                SalesMenuSectionServiceSql.UPDATE_PREFIX
                        + tableName
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_SET_DISPLAY_ORDER_VERSION_REF
                        + refColumn
                        + "=?",
                displayOrder,
                versionRef,
                targetRef);
    }

    public int advanceSectionDraftRevision(UUID versionRef) {
        return update(
                SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_UPDATE_SALES_COLLECTION_VERSION_REVISION
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_WHERE_VERSION_REF_KIND_DRAFT,
                versionRef);
    }

    public boolean sectionExists(UUID menuRef, UUID versionRef, UUID sectionRef) {
        return !query(
                        SalesMenuSectionServiceSql.SELECT_SALES_VER_SECTION_SELECT_005
                                + SalesMenuSectionServiceSql
                                        .SALES_MENU_SECTION_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_SECTION_REF,
                        SalesMenuReadModels::existsRow,
                        menuRef,
                        versionRef,
                        sectionRef)
                .isEmpty();
    }

    public List<SalesMenuReadModels.ReceiptRow> readSectionCommandReceipt(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT
                        + SalesMenuSectionServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_002
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public int insertSectionCommandReceipt(
            UUID receiptRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String operationId,
            String idempotencyKey,
            String requestHash,
            String status,
            String readbackJson,
            long createdAtEpochMillis) {
        return update(
                SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_OPERATION_ID_IDEMPOTENCY_KEY_REQUEST_HASH_STATUS
                        + SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_VALUES_VALUES_JSONB
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_JOIN_CONDITION_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY,
                receiptRef,
                workspaceUuid,
                groupWorkspaceKey,
                operationId,
                idempotencyKey,
                requestHash,
                status,
                readbackJson,
                createdAtEpochMillis);
    }

    public List<SalesMenuReadModels.ReceiptRow> readSectionCommandReceiptForReplay(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT_ALTERNATE_A
                        + SalesMenuSectionServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_ALT_A_003
                        + SalesMenuSectionServiceSql.WHERE_WS_UUID_OP_ID_ALT_A_004,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public void recordSectionOperation(
            UUID recordRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID channelRef,
            UUID menuRef,
            String operation,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis,
            String idempotencyKey) {
        update(
                SalesMenuSectionServiceSql.SALES_MENU_SECTION_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_TARGET_DISPLAY_SNAPSHOT_RESULT_ACTOR_TYPE_ACTOR_ID
                        + SalesMenuSectionServiceSql
                                .SALES_MENU_SECTION_SERVICE_OCCURRED_AT_EPOCH_MILLIS_IDEMPOTENCY_KEY,
                recordRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                channelRef,
                menuRef,
                operation,
                targetRef,
                targetKind,
                targetDisplaySnapshot,
                result,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis,
                idempotencyKey);
    }

    public List<OperationRecordRow> readOperationRecordRows(
            com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery query, OpaqueCollectionCursor.Position position) {
        List<Object> arguments = new ArrayList<>(List.of(
                query.menu().scope().workspaceUuid(),
                query.menu().scope().groupWorkspaceKey(),
                query.menu().scope().storeRef(),
                query.menu().salesMenuRef(),
                query.channelRef()));
        StringBuilder frontier = new StringBuilder();
        if (position != null) {
            long occurredAt;
            try {
                occurredAt = Long.parseLong(position.sortKey());
            } catch (NumberFormatException failure) {
                throw new IllegalArgumentException("occurredAt cursor is invalid", failure);
            }
            frontier.append(
                    SalesMenuOperationRecordServiceSql
                                    .SALES_MENU_OPERATION_RECORD_SERVICE_CONDITION_OCCURRED_AT_EPOCH_MILLIS
                            + SalesMenuOperationRecordServiceSql.OPEN_PAREN_OCCURRED_AT_EPOCH_001);
            arguments.add(occurredAt);
            arguments.add(occurredAt);
            arguments.add(position.tieBreaker());
        }
        arguments.add(query.page().pageSize() + 1);
        return query(
                SalesMenuOperationRecordServiceSql.SALES_MENU_OPERATION_RECORD_SERVICE_SELECT_RECORD_REF
                        + SalesMenuOperationRecordServiceSql.SALES_MENU_OPERATION_RECORD_SERVICE_TARGET_KIND
                        + SalesMenuOperationRecordServiceSql.SALES_MENU_OPERATION_RECORD_SERVICE_TARGET_DISPLAY_SNAPSHOT
                        + SalesMenuOperationRecordServiceSql.FROM_CLAUSE_SALES_OP_RECORD_002
                        + SalesMenuOperationRecordServiceSql
                                .SALES_MENU_OPERATION_RECORD_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STORE_REF
                        + SalesMenuOperationRecordServiceSql
                                .SALES_MENU_OPERATION_RECORD_SERVICE_CONDITION_COLLECTION_REF_CHANNEL_REF
                        + frontier
                        + SalesMenuOperationRecordServiceSql
                                .SALES_MENU_OPERATION_RECORD_SERVICE_ORDER_BY_OCCURRED_AT_EPOCH_MILLIS_RECORD_REF,
                SalesMenuReadModels::operationRecordRow,
                arguments.toArray());
    }

    public int insertRejectedOperation(
            UUID recordRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID channelRef,
            UUID menuRef,
            String operation,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String failureCode,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis,
            String idempotencyKey) {
        return update(
                SalesMenuOperationRecordServiceSql
                                .SALES_MENU_OPERATION_RECORD_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD
                        + SalesMenuOperationRecordServiceSql
                                .SALES_MENU_OPERATION_RECORD_SERVICE_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND
                        + SalesMenuOperationRecordServiceSql
                                .SALES_MENU_OPERATION_RECORD_SERVICE_TARGET_DISPLAY_SNAPSHOT_RESULT_FAILURE_CODE
                        + SalesMenuOperationRecordServiceSql.SALES_MENU_OPERATION_RECORD_SERVICE_ACTOR_TYPE
                        + SalesMenuOperationRecordServiceSql.SALES_MENU_OPERATION_RECORD_SERVICE_ACTOR_ID
                        + SalesMenuOperationRecordServiceSql.SALES_MENU_OPERATION_RECORD_SERVICE_VALUES,
                recordRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                channelRef,
                menuRef,
                operation,
                targetRef,
                targetKind,
                targetDisplaySnapshot,
                result,
                failureCode,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis,
                idempotencyKey);
    }

    public int upsertManualStatus(
            UUID itemRef,
            UUID channelRef,
            String targetKind,
            UUID targetRef,
            String state,
            String reason,
            long changedAtEpochMillis,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot) {
        return update(
                SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_INSERT_INTO_SALES_MANUAL_STATUS_CURRENT
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_TARGET_REF_STATE_REASON_CHANGED_AT_EPOCH_MILLIS
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_ACTOR_DISPLAY_SNAPSHOT_VERSION
                        + SalesMenuManualSaleServiceSql.JOIN_CONDITION_SALES_ITEM_REF_001
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_SET_DO_UPDATE_SET
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_STATE_REASON
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_CHANGED_AT_EPOCH_MILLIS
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_ACTOR_TYPE_ACTOR_ID
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_ACTOR_DISPLAY_SNAPSHOT
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_VERSION_SALES_MANUAL_STATUS_CURRENT,
                itemRef,
                channelRef,
                targetKind,
                targetRef,
                state,
                reason,
                changedAtEpochMillis,
                actorType,
                actorId,
                actorDisplaySnapshot);
    }

    public int insertManualStatusEvent(
            UUID eventRef,
            UUID itemRef,
            UUID channelRef,
            String targetKind,
            UUID targetRef,
            String eventKind,
            String reason,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis) {
        return update(
                SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_INSERT_INTO_SALES_MANUAL_STATUS_EVENT
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_TARGET_KIND_TARGET_REF_EVENT_KIND_REASON
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_ACTOR_DISPLAY_SNAPSHOT_OCCURRED_AT_EPOCH_MILLIS,
                eventRef,
                itemRef,
                channelRef,
                targetKind,
                targetRef,
                eventKind,
                reason,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis);
    }

    public List<String> readPublishedSkuName(UUID versionRef, UUID itemRef, UUID skuRef) {
        return query(
                SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_SELECT_SALES_VERSION_ITEM_SKU_RESOLVED_SKU_NAME
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_SKU_REF,
                (result, ignored) -> result.getString("resolved_sku_name"),
                versionRef,
                itemRef,
                skuRef);
    }

    public List<String> readPublishedOptionValueName(UUID versionRef, UUID itemRef, UUID valueRef) {
        return query(
                SalesMenuManualSaleServiceSql.SELECT_SALES_VER_ITEM_ORD_002
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_DEFINITION_VALUE_REF,
                (result, ignored) -> result.getString("resolved_value_name"),
                versionRef,
                itemRef,
                valueRef);
    }

    public List<SalesMenuReadModels.ReceiptRow> readManualCommandReceipt(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_SELECT_REQUEST_HASH_STATUS_READBACK_JSON_TEXT
                        + SalesMenuManualSaleServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_003
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_WHERE_WORKSPACE_UUID_OPERATION_ID_IDEMPOTENCY_KEY,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public int insertManualCommandReceipt(
            UUID receiptRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String operationId,
            String idempotencyKey,
            String requestHash,
            String status,
            String readbackJson,
            long createdAtEpochMillis) {
        return update(
                SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_INSERT_INTO_SALES_COMMAND_RECEIPT
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_OPERATION_ID_IDEMPOTENCY_KEY_REQUEST_HASH_STATUS
                        + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_VALUES_VALUES_JSONB
                        + SalesMenuManualSaleServiceSql.JOIN_CONDITION_WS_UUID_OP_004,
                receiptRef,
                workspaceUuid,
                groupWorkspaceKey,
                operationId,
                idempotencyKey,
                requestHash,
                status,
                readbackJson,
                createdAtEpochMillis);
    }

    public List<SalesMenuReadModels.ReceiptRow> readManualCommandReceiptForReplay(
            UUID workspaceUuid, String operationId, String idempotencyKey) {
        return query(
                SalesMenuManualSaleServiceSql.SELECT_REQ_HASH_STATUS_READBACK_ALT_A_005
                        + SalesMenuManualSaleServiceSql.FROM_CLAUSE_SALES_CMD_RECEIPT_ALT_A_006
                        + SalesMenuManualSaleServiceSql.WHERE_WS_UUID_OP_ID_ALT_A_007,
                SalesMenuReadModels::receiptRow,
                workspaceUuid,
                operationId,
                idempotencyKey);
    }

    public List<ItemRow> readManualItemRows(UUID versionRef, UUID sectionRef, UUID itemRef) {
        String sql = SalesMenuManualSaleServiceSql.SELECT_VER_REF_SALES_ITEM_008
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_DISPLAY_NAME_OVERRIDE
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_RESOLVED_PRODUCT_SHAPE
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_RESOLVED_SALES_UNIT_NAME
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_LISTED_PRICE_CENTS
                + SalesMenuManualSaleServiceSql
                        .SALES_MENU_MANUAL_SALE_SERVICE_ORDERING_CONSTRAINTS_JSON_TEXT_DISPLAY_MEDIA_MODE
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_SALES_VERSION_ITEM_PREVIOUS
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_WHERE_PREVIOUS_VERSION_REF_SECTION_REF
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER
                + SalesMenuManualSaleServiceSql
                        .SALES_MENU_MANUAL_SALE_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_A
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_PREVIOUS_SALES_ITEM_REF_CAN_MOVE_UP
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_SALES_VERSION_ITEM_NEXT_ITEM
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_WHERE_NEXT_ITEM_VERSION_REF_SECTION_REF
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER
                + SalesMenuManualSaleServiceSql
                        .SALES_MENU_MANUAL_SALE_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_A
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_NEXT_ITEM_SALES_ITEM_REF_CAN_MOVE_DOWN
                + SalesMenuManualSaleServiceSql
                        .SALES_MENU_MANUAL_SALE_SERVICE_FROM_CLAUSE_SALES_ITEM_FROM_SALES_MENU_SALES_VERSIO
                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_JOIN_CONDITION_SALES_ITEM_REF_VERSION_REF
                + (sectionRef == null
                        ? ""
                        : SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_CONDITION_SECTION_REF)
                + (itemRef == null
                        ? ""
                        : SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_CONDITION_SALES_ITEM_REF)
                + SalesMenuManualSaleServiceSql
                        .SALES_MENU_MANUAL_SALE_SERVICE_ORDER_BY_SECTION_REF_DISPLAY_ORDER_SALES_ITEM_REF;
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        if (sectionRef != null) arguments.add(sectionRef);
        if (itemRef != null) arguments.add(itemRef);
        return query(sql, SalesMenuReadModels::itemRow, arguments.toArray());
    }

    public Optional<UUID> readManualDraftVersion(UUID menuRef) {
        return query(
                        SalesMenuManualSaleServiceSql.SELECT_SALES_COLLECTION_CUR_DRAFT_009
                                + SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_WHERE_COLLECTION_REF,
                        SalesMenuReadModels::uuidValueRow,
                        menuRef)
                .stream()
                .findFirst()
                .map(UuidValueRow::value);
    }

    public Optional<UUID> readManualPublishedVersion(UUID menuRef) {
        return query(
                        SalesMenuManualSaleServiceSql.SELECT_SALES_COLLECTION_LATEST_PUBLISHED_010
                                + SalesMenuManualSaleServiceSql
                                        .SALES_MENU_MANUAL_SALE_SERVICE_WHERE_COLLECTION_REF_ALTERNATE_A,
                        SalesMenuReadModels::uuidValueRow,
                        menuRef)
                .stream()
                .filter(row -> row.value() != null)
                .findFirst()
                .map(UuidValueRow::value);
    }

    public void recordManualOperation(
            UUID recordRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID channelRef,
            UUID menuRef,
            String operation,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis,
            String idempotencyKey) {
        update(
                SalesMenuManualSaleServiceSql.SALES_MENU_MANUAL_SALE_SERVICE_INSERT_INTO_SALES_OPERATION_RECORD
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_STORE_REF_CHANNEL_REF_COLLECTION_REF_OPERATION_KIND
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_TARGET_DISPLAY_SNAPSHOT_RESULT_ACTOR_TYPE_ACTOR_ID
                        + SalesMenuManualSaleServiceSql
                                .SALES_MENU_MANUAL_SALE_SERVICE_OCCURRED_AT_EPOCH_MILLIS_IDEMPOTENCY_KEY,
                recordRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                channelRef,
                menuRef,
                operation,
                targetRef,
                targetKind,
                targetDisplaySnapshot,
                result,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis,
                idempotencyKey);
    }

    public int updateDraftItemSnapshot(
            UUID versionRef,
            UUID itemRef,
            String displayNameOverride,
            Long listedPriceCents,
            String resolvedItemName,
            String resolvedItemCode,
            String resolvedProductShape,
            String orderingConstraintsJson,
            String displayMediaMode) {
        return update(
                SalesMenuItemServiceSql.UPDATE_SALES_VER_ITEM_DISP_001
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_RESOLVED_ITEM_NAME_RESOLVED_ITEM_CODE_RESOLVED_PRODUCT_SHAPE
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_REF_RESOLVED_SALES_UNIT_CODE
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_NAME_RESOLVED_SALES_UNIT_DIMENSION
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_PRECISION
                        + SalesMenuItemServiceSql.ALT_ORDERING_CONSTRAINTS_JSON_DISP_002
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF,
                displayNameOverride,
                listedPriceCents,
                resolvedItemName,
                resolvedItemCode,
                resolvedProductShape,
                orderingConstraintsJson,
                displayMediaMode,
                versionRef,
                itemRef);
    }

    public int deleteDraftItemSkus(UUID versionRef, UUID itemRef) {
        return update(
                SalesMenuItemServiceSql
                        .SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_SKU_VERSION_REF_SALES_ITEM_REF,
                versionRef,
                itemRef);
    }

    public int insertDraftSku(UUID versionRef, UUID itemRef, SkuRow sku) {
        return update(
                SalesMenuItemServiceSql.INSERT_INTO_SALES_VER_ITEM_003
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_LISTED_PRICE_CENTS
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_DISPLAY_ORDER,
                versionRef,
                itemRef,
                sku.skuRef(),
                sku.listedPriceCents(),
                sku.resolvedSkuCode(),
                sku.resolvedSkuName(),
                sku.defaultPriceCents(),
                sku.displayOrder());
    }

    public int deleteDraftItemOrderOptionValues(UUID versionRef, UUID itemRef) {
        return update(
                SalesMenuItemServiceSql.DELETE_SALES_VER_ITEM_ORD_004
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_A,
                versionRef,
                itemRef);
    }

    public int deleteDraftItemOrderOptions(UUID versionRef, UUID itemRef) {
        return update(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF,
                versionRef,
                itemRef);
    }

    public int deleteDraftItemMedia(UUID versionRef, UUID itemRef) {
        return update(
                SalesMenuItemServiceSql
                        .SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF,
                versionRef,
                itemRef);
    }

    public int deleteDraftItem(UUID versionRef, UUID itemRef) {
        return update(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_VERSION_REF_SALES_ITEM_REF,
                versionRef,
                itemRef);
    }

    public List<LongValueRow> readCurrentDraftItemVersionForAssetTarget(UUID menuRef, UUID itemRef) {
        return query(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_VERSION
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_CURRENT_DRAFT_VERSION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_COLLECTION_COLLECTION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_A,
                SalesMenuReadModels::longValueRow,
                menuRef,
                itemRef);
    }

    public boolean existsSalesItemForAssetRelease(UUID menuRef, UUID itemRef) {
        return !query(
                        SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_COLLECTION_REF_SALES_ITEM_REF,
                        SalesMenuReadModels::existsRow,
                        menuRef,
                        itemRef)
                .isEmpty();
    }

    public void insertSalesItemsBatch(UUID collectionRef, List<UUID> itemRefs, List<UUID> catalogItemRefs) {
        if (itemRefs.isEmpty()) return;
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuItemServiceSql.DRAFT_ITEM_VALUE_TUPLE));
        List<Object> arguments = new ArrayList<>(itemRefs.size() * 3);
        for (int index = 0; index < itemRefs.size(); index++) {
            arguments.add(itemRefs.get(index));
            arguments.add(collectionRef);
            arguments.add(catalogItemRefs.get(index));
        }
        update(SalesMenuItemServiceSql.INSERT_INTO_SALES_ITEM_SALES_005 + placeholders, arguments.toArray());
    }

    public void insertDraftVersionItemsBatch(
            UUID versionRef, UUID sectionRef, UUID collectionRef, List<DraftItemSeed> items) {
        if (items.isEmpty()) return;
        StringBuilder values = new StringBuilder();
        List<Object> arguments = new ArrayList<>(items.size() * 5 + 6);
        for (int index = 0; index < items.size(); index++) {
            if (index > 0) values.append(',');
            DraftItemSeed item = items.get(index);
            values.append(SalesMenuItemServiceSql.VERSION_ITEM_VALUE_TUPLE);
            arguments.add(item.itemRef());
            arguments.add(item.resolvedItemName());
            arguments.add(item.resolvedItemCode());
            arguments.add(item.resolvedProductShape());
            arguments.add(item.ordinal());
        }
        arguments.add(versionRef);
        arguments.add(sectionRef);
        arguments.add(versionRef);
        arguments.add(sectionRef);
        arguments.add(collectionRef);
        arguments.add(SalesMenuDisplayMediaMode.INHERIT_CATALOG.name());
        update(
                SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_CTE_INPUT_SALES_ITEM_REF_RESOLVED_ITEM_NAME_RESOLVED_ITEM_CODE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN
                        + values
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_BASE_DISPLAY_ORDER_START_ORDER
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_VERSION_REF_SECTION_REF
                        + SalesMenuItemServiceSql.INSERT_INTO_SALES_VER_ITEM_006
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_COLLECTION_REF
                        + SalesMenuItemServiceSql.ALT_ORDERING_CONSTRAINTS_JSON_DISP_ALT_A_007
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_INPUT_SALES_ITEM_REF_BASE_START_ORDER
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_INPUT
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_BASE_ORDINAL,
                arguments.toArray());
    }

    public List<OrderingTargetRow> findItemAdjacent(
            UUID versionRef, UUID targetRef, SalesMenuMoveDirection direction, UUID sectionRef, long currentOrder) {
        boolean movingUp = direction == SalesMenuMoveDirection.UP;
        String adjacencyPredicate = movingUp
                ? SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_DISPLAY_ORDER
                        + SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN
                        + SalesMenuItemServiceSql.ADJACENCY_LESS_SUFFIX
                : SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN
                        + SalesMenuItemServiceSql.ADJACENCY_GREATER_SUFFIX;
        String adjacencyOrder = movingUp
                ? SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER
                        + SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN
                        + SalesMenuItemServiceSql.DISPLAY_ORDER_DESC_LOCK_SUFFIX
                : SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN
                        + SalesMenuItemServiceSql.DISPLAY_ORDER_ASC_LOCK_SUFFIX;
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        String sectionPredicate = "";
        if (sectionRef != null) {
            sectionPredicate = SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SECTION_REF;
            arguments.add(sectionRef);
        }
        arguments.add(currentOrder);
        arguments.add(currentOrder);
        arguments.add(targetRef);
        return query(
                SalesMenuItemServiceSql.SELECT_PREFIX
                        + SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN
                        + SalesMenuItemServiceSql.DISPLAY_ORDER_PROJECTION
                        + SalesMenuItemServiceSql.SALES_VERSION_ITEM_TABLE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF
                        + sectionPredicate
                        + adjacencyPredicate
                        + adjacencyOrder,
                SalesMenuReadModels::orderingTargetRow,
                arguments.toArray());
    }

    public long maxItemDisplayOrder(UUID versionRef, UUID sectionRef) {
        String sectionPredicate =
                sectionRef == null ? "" : SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SECTION_REF;
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        if (sectionRef != null) arguments.add(sectionRef);
        return query(
                        SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_DISPLAY_ORDER_VALUE
                                + SalesMenuItemServiceSql.SALES_VERSION_ITEM_TABLE
                                + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_ALTERNATE_A
                                + sectionPredicate,
                        SalesMenuReadModels::longValueRow,
                        arguments.toArray())
                .getFirst()
                .value();
    }

    public int setItemDisplayOrder(UUID versionRef, UUID itemRef, long displayOrder) {
        return update(
                SalesMenuItemServiceSql.UPDATE_PREFIX
                        + SalesMenuItemServiceSql.SALES_VERSION_ITEM_TABLE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SET_DISPLAY_ORDER_VERSION_REF
                        + SalesMenuItemServiceSql.SALES_ITEM_REF_COLUMN
                        + "=?",
                displayOrder,
                versionRef,
                itemRef);
    }

    public List<ItemRow> readVersionItemPage(
            UUID versionRef, UUID sectionRef, Long afterDisplayOrder, UUID afterItemRef, int limit) {
        List<Object> arguments = new ArrayList<>(List.of(versionRef, sectionRef));
        String frontier = "";
        if (afterDisplayOrder != null) {
            frontier = SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_DISPLAY_ORDER_ALTERNATE_B
                    + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_DISPLAY_ORDER_SALES_ITEM_REF;
            arguments.add(afterDisplayOrder);
            arguments.add(afterDisplayOrder);
            arguments.add(afterItemRef);
        }
        arguments.add(limit + 1);
        return query(
                SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_SELECT_VERSION_REF_SALES_ITEM_REF_CATALOG_ITEM_REF_SECTION_REF
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_DISPLAY_NAME_OVERRIDE_RESOLVED_ITEM_NAME_RESOLVED_ITEM_CODE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_RESOLVED_PRODUCT_SHAPE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_NAME
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_LISTED_PRICE_CENTS_ALTERNATE_A
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_ORDERING_CONSTRAINTS_JSON_TEXT_DISPLAY_MEDIA_MODE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_PREVIOUS
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_PREVIOUS_VERSION_REF_SECTION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_PREVIOUS_SALES_ITEM_REF_CAN_MOVE_UP
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_NEXT_ITEM
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_NEXT_ITEM_VERSION_REF_SECTION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_NEXT_ITEM_SALES_ITEM_REF_CAN_MOVE_DOWN
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_ITEM_FROM_SALES_MENU_SALES_VERSIO
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_JOIN_CONDITION_SALES_ITEM_REF_VERSION_REF_SECTION_REF
                        + frontier
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_ORDER_BY_DISPLAY_ORDER_SALES_ITEM_REF,
                SalesMenuReadModels::itemRow,
                arguments.toArray());
    }

    public List<ItemRow> readVersionItemRows(UUID versionRef, UUID sectionRef, UUID itemRef) {
        List<Object> arguments = new ArrayList<>();
        arguments.add(versionRef);
        if (sectionRef != null) arguments.add(sectionRef);
        if (itemRef != null) arguments.add(itemRef);
        return query(
                SalesMenuItemServiceSql.SELECT_VER_REF_SALES_ITEM_ALT_A_008
                        + SalesMenuItemServiceSql.DISP_NAME_OVERRIDE_RESOLVED_ITEM_ALT_A_009
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_RESOLVED_PRODUCT_SHAPE_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_RESOLVED_SALES_UNIT_NAME_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_LISTED_PRICE_CENTS_ALTERNATE_B
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_ORDERING_CONSTRAINTS_JSON_TEXT_DISPLAY_MEDIA_MODE_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_PUBLISHED_PRIMARY_IMAGE_ASSET_REF_ALTERNATE_A
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_PUBLISHED_CATALOG_IMAGE_ASSET_REFS_TEXT_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_PREVIOUS_ALTERNATE_A
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_WHERE_PREVIOUS_VERSION_REF_SECTION_REF_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_B
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_PREVIOUS_DISPLAY_ORDER_ALTERNATE_C
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_PREVIOUS_SALES_ITEM_REF_CAN_MOVE_UP_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_NEXT_ITEM_ALTERNATE_A
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_WHERE_NEXT_ITEM_VERSION_REF_SECTION_REF_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_B
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_OPEN_PAREN_NEXT_ITEM_DISPLAY_ORDER_ALTERNATE_C
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_NEXT_ITEM_SALES_ITEM_REF_CAN_MOVE_DOWN_ALTERNATE_A
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_ITEM_FROM_SALES_MENU_SALES_VERSIO_ALTERNATE_A
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_JOIN_CONDITION_SALES_ITEM_REF_VERSION_REF
                        + (sectionRef == null
                                ? ""
                                : SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SECTION_REF_ALTERNATE_A)
                        + (itemRef == null
                                ? ""
                                : SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_B)
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_ORDER_BY_SECTION_REF_DISPLAY_ORDER_SALES_ITEM_REF,
                SalesMenuReadModels::itemRow,
                arguments.toArray());
    }

    public List<OrderOptionGroupRow> readItemOrderOptionGroups(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        arguments.addAll(itemRefs);
        return query(
                SalesMenuItemServiceSql.SELECT_SALES_ITEM_REF_DEF_010
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_MIN_SELECTION_COUNT_MAX_SELECTION_COUNT_DISPLAY_ORDER
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VERSION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_C
                        + placeholders
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CLOSE_PAREN
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_DEFINITION_REF,
                SalesMenuReadModels::orderOptionGroupRow,
                arguments.toArray());
    }

    public List<OrderOptionValueRow> readItemOrderOptionValues(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        arguments.addAll(itemRefs);
        return query(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_DEFAULT_VALUE_EXTRA_PRICE
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_ORDER_OPTION_VA_VERSION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_D
                        + placeholders
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_A
                        + SalesMenuItemServiceSql.ORD_BY_SALES_ITEM_REF_011,
                SalesMenuReadModels::orderOptionValueRow,
                arguments.toArray());
    }

    public List<SkuRow> readItemSkuRows(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        arguments.addAll(itemRefs);
        return query(
                SalesMenuItemServiceSql.SELECT_SALES_ITEM_REF_SKU_012
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_SALES_VERSION_ITEM_SKU_DEFAULT_PRICE_CENTS_DISPLAY_ORDER
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_B
                        + placeholders
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_B
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_SKU_REF,
                SalesMenuReadModels::skuRow,
                arguments.toArray());
    }

    public List<MediaItemRow> readItemMediaRows(UUID versionRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(versionRef));
        arguments.addAll(itemRefs);
        return query(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_REF_ASSET_REF_DISPLAY_ORDER
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_VERSION_ITEM_MEDIA_VERSION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_E
                        + placeholders
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CLOSE_PAREN_ALTERNATE_C
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_ORDER_BY_SALES_ITEM_REF_DISPLAY_ORDER_ASSET_REF,
                SalesMenuReadModels::mediaItemRow,
                arguments.toArray());
    }

    public List<ManualSaleStatusRow> readCurrentManualStatuses(UUID channelRef, List<UUID> itemRefs) {
        if (itemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(itemRefs.size(), SalesMenuItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(channelRef));
        arguments.addAll(itemRefs);
        return query(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_ITEM_REF_TARGET_KIND_TARGET_REF_STATE
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_ACTOR_DISPLAY_SNAPSHOT
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_FROM_CLAUSE_SALES_MANUAL_STATUS_CURRENT_CHANNEL_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_CONDITION_SALES_ITEM_REF_ALTERNATE_F
                        + placeholders
                        + SalesMenuItemServiceSql.SQL_CLOSE_PAREN,
                SalesMenuReadModels::manualSaleStatusRow,
                arguments.toArray());
    }

    public Optional<UUID> readLatestPublishedVersion(UUID menuRef) {
        return query(
                        SalesMenuItemServiceSql
                                        .SALES_MENU_ITEM_SERVICE_SELECT_SALES_COLLECTION_LATEST_PUBLISHED_VERSION_REF
                                + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_COLLECTION_REF_ALTERNATE_A,
                        SalesMenuReadModels::uuidValueRow,
                        menuRef)
                .stream()
                .findFirst()
                .map(UuidValueRow::value);
    }

    public int deleteDraftItemMediaRows(UUID versionRef, UUID itemRef) {
        return update(
                SalesMenuItemServiceSql
                        .SALES_MENU_ITEM_SERVICE_DELETE_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF_ALTERNATE_A,
                versionRef,
                itemRef);
    }

    public int insertDraftItemMedia(UUID versionRef, UUID itemRef, UUID assetRef, int displayOrder) {
        return update(
                SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_INSERT_INTO_SALES_VERSION_ITEM_MEDIA_VERSION_REF_SALES_ITEM_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_ASSET_REF_DISPLAY_ORDER,
                versionRef,
                itemRef,
                assetRef,
                displayOrder);
    }

    public int insertDraftItemOrderOption(
            UUID versionRef, UUID itemRef, SalesMenuReadback.SalesMenuOrderOption option) {
        return update(
                SalesMenuItemServiceSql.INSERT_INTO_SALES_VER_ITEM_013
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_DEFINITION_REF_RESOLVED_DEFINITION_NAME_SELECTION_MODE_REQUIRED
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_MAX_SELECTION_COUNT_DISPLAY_ORDER,
                versionRef,
                itemRef,
                option.definitionRef(),
                option.name(),
                option.selectionMode(),
                option.required(),
                option.minSelectionCount(),
                option.maxSelectionCount(),
                option.displayOrder());
    }

    public int insertDraftItemOrderOptionValue(
            UUID versionRef, UUID itemRef, UUID definitionRef, SalesMenuReadback.SalesMenuOrderOptionValue value) {
        return update(
                SalesMenuItemServiceSql.INSERT_INTO_SALES_VER_ITEM_014
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_DEFINITION_REF
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_DEFAULT_VALUE_EXTRA_PRICE_ALTERNATE_A,
                versionRef,
                itemRef,
                definitionRef,
                value.definitionValueRef(),
                value.name(),
                value.displayOrder(),
                value.defaultValue(),
                value.extraPrice());
    }

    public List<CountByItemRow> countDraftItemsByCatalog(
            UUID collectionRef, UUID versionRef, Set<UUID> catalogItemRefs) {
        if (catalogItemRefs.isEmpty()) return List.of();
        String placeholders = String.join(
                SalesMenuItemServiceSql.VALUE_SEPARATOR,
                Collections.nCopies(catalogItemRefs.size(), SalesMenuItemServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>(List.of(collectionRef, versionRef));
        arguments.addAll(catalogItemRefs);
        return query(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_CATALOG_ITEM_REF_ITEM_COUNT
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_JOIN_SALES_ITEM_SALES_ITEM_REF
                        + SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_WHERE_COLLECTION_REF_VERSION_REF_CATALOG_ITEM_REF
                        + placeholders
                        + SalesMenuItemServiceSql.COUNT_BY_ITEM_GROUP_SUFFIX,
                SalesMenuReadModels::countByItemRow,
                arguments.toArray());
    }

    public boolean draftItemExists(UUID versionRef, UUID itemRef) {
        return !query(
                        SalesMenuItemServiceSql
                                .SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_VERSION_REF_SALES_ITEM_REF,
                        SalesMenuReadModels::existsRow,
                        versionRef,
                        itemRef)
                .isEmpty();
    }

    public List<ItemCurrentRow> readDraftItemMoveCurrent(UUID versionRef, UUID itemRef) {
        return query(
                SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_SELECT_SALES_VERSION_ITEM_SECTION_REF_DISPLAY_ORDER
                        + SalesMenuItemServiceSql.SALES_MENU_ITEM_SERVICE_WHERE_VERSION_REF_SALES_ITEM_REF_ALTERNATE_D,
                SalesMenuReadModels::itemCurrentRow,
                versionRef,
                itemRef);
    }

    public void recordItemOperation(
            UUID recordRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID channelRef,
            UUID menuRef,
            String operation,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String result,
            String actorType,
            UUID actorId,
            String actorDisplaySnapshot,
            long occurredAtEpochMillis,
            String idempotencyKey) {
        recordSuccess(
                recordRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                channelRef,
                menuRef,
                operation,
                targetRef,
                targetKind,
                targetDisplaySnapshot,
                result,
                actorType,
                actorId,
                actorDisplaySnapshot,
                occurredAtEpochMillis,
                idempotencyKey);
    }

    public record DraftItemSeed(
            UUID itemRef,
            String resolvedItemName,
            String resolvedItemCode,
            String resolvedProductShape,
            long ordinal) {}

    private Optional<SalesMenuAggregate> find(SalesMenuTarget target, boolean lock) {
        String sql = SalesMenuCollectionPersistenceSql.SELECT_COLLECTION_REF_WS_UUID_001
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_ARCHIVED_AT_EPOCH_MILLIS
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_REVISION
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_DRAFT_START
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_PUBLICATION
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_SCHEDULE_KIND
                + SalesMenuCollectionPersistenceSql
                        .SALES_MENU_COLLECTION_PERSISTENCE_SCHEDULE_END_LOCAL_TIME_PUBLISHED_END
                + SalesMenuCollectionPersistenceSql.FROM_CLAUSE_SALES_COLLECTION_FROM_002
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_JOIN_SALES_COLLECTION_VERSION
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_CONDITION_COLLECTION_REF
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_SALES_COLLECTION_VERSION
                + SalesMenuCollectionPersistenceSql
                        .SALES_MENU_COLLECTION_PERSISTENCE_CONDITION_COLLECTION_REF_ALTERNATE_A
                + SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_PERSISTENCE_SALES_PUBLICATION_PUBLICATION
                + SalesMenuCollectionPersistenceSql.JOIN_CONDITION_PUBLICATION_PUBLISHED_VER_003
                + SalesMenuCollectionPersistenceSql
                        .SALES_MENU_COLLECTION_PERSISTENCE_CONDITION_PUBLICATION_COLLECTION_REF
                + SalesMenuCollectionPersistenceSql.WHERE_COLLECTION_REF_WS_UUID_004
                + (lock ? SalesMenuCollectionPersistenceSql.SALES_MENU_COLLECTION_LOCK_SUFFIX : "");
        return query(
                        sql,
                        SalesMenuPersistence::aggregateRow,
                        target.salesMenuRef(),
                        target.scope().workspaceUuid(),
                        target.scope().groupWorkspaceKey(),
                        target.scope().storeRef())
                .stream()
                .findFirst()
                .map(SalesMenuPersistence::aggregate);
    }

    protected <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... arguments) {
        return jdbc.query(sql, rowMapper, arguments);
    }

    protected int update(String sql, Object... arguments) {
        return jdbc.update(sql, arguments);
    }

    private static AggregateRow aggregateRow(ResultSet result, int ignored) throws SQLException {
        return new AggregateRow(
                result.getObject("collection_ref", UUID.class),
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("store_ref", UUID.class),
                result.getString("name"),
                result.getObject("archived_at_epoch_millis", Long.class),
                result.getLong("version"),
                result.getObject("draft_revision", Long.class),
                result.getObject("published_revision", Long.class),
                result.getObject("latest_published_source_draft_revision", Long.class),
                result.getString("draft_schedule_kind"),
                localTime(result.getTime("draft_start")),
                localTime(result.getTime("draft_end")),
                result.getString("published_schedule_kind"),
                localTime(result.getTime("published_start")),
                localTime(result.getTime("published_end")));
    }

    private static SalesMenuAggregate aggregate(AggregateRow row) {
        SalesMenuScope scope = new SalesMenuScope(row.workspaceUuid(), row.groupWorkspaceKey(), row.storeRef());
        return new SalesMenuAggregate(
                row.collectionRef(),
                scope,
                row.name(),
                row.archivedAtEpochMillis() != null,
                row.version(),
                row.draftRevision(),
                row.publishedRevision(),
                row.latestPublishedSourceDraftRevision(),
                schedule(row.draftScheduleKind(), row.draftStart(), row.draftEnd()),
                row.publishedScheduleKind() == null
                        ? null
                        : schedule(row.publishedScheduleKind(), row.publishedStart(), row.publishedEnd()));
    }

    private static SalesMenuSchedule schedule(String kindValue, LocalTime startValue, LocalTime endValue) {
        SalesMenuScheduleKind kind = SalesMenuScheduleKind.valueOf(kindValue);
        if (kind == SalesMenuScheduleKind.ALL_DAY) return SalesMenuSchedule.allDay();
        return SalesMenuSchedule.daily(startValue, endValue);
    }

    private static LocalTime localTime(Time value) {
        return value == null ? null : value.toLocalTime();
    }

    private record AggregateRow(
            UUID collectionRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            String name,
            Long archivedAtEpochMillis,
            long version,
            Long draftRevision,
            Long publishedRevision,
            Long latestPublishedSourceDraftRevision,
            String draftScheduleKind,
            LocalTime draftStart,
            LocalTime draftEnd,
            String publishedScheduleKind,
            LocalTime publishedStart,
            LocalTime publishedEnd) {}
}
