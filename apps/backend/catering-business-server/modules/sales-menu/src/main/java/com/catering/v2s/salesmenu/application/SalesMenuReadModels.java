package com.catering.v2s.salesmenu.application;

import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuCursorIdentity;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTargetKind;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Typed persistence projections shared by the split SalesMenu targets. */
public final class SalesMenuReadModels {
    private SalesMenuReadModels() {}

    public record MenuListRow(
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

    public record ItemPage(List<ItemRow> rows, boolean hasNext, SalesMenuCursorIdentity identity) {}

    public record ActivationRow(UUID channelRef, String status, long version) {}

    public record PublicationItemRow(UUID salesItemRef, String resolvedItemName, String resolvedItemCode) {}

    public record OperationRecordRow(
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

    public record ReceiptRow(String requestHash, String status, String readbackJson) {}

    public record SectionOrderRow(UUID sectionRef, String name, long displayOrder) {}

    public record ItemRow(
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
            UUID publishedPrimaryImageAssetRef,
            String publishedCatalogImageAssetRefsJson,
            boolean canMoveUp,
            boolean canMoveDown) {}

    public record SkuRow(
            UUID salesItemRef,
            UUID skuRef,
            long listedPriceCents,
            String resolvedSkuCode,
            String resolvedSkuName,
            long defaultPriceCents,
            long displayOrder) {}

    public record MediaItemRow(UUID salesItemRef, UUID assetRef, long displayOrder) {}

    public record MediaRow(UUID assetRef, long displayOrder) {}

    public record LongValueRow(long value) {}

    public record CountByItemRow(UUID itemRef, long count) {}

    public record SectionRow(
            UUID sectionRef, String name, long displayOrder, long itemCount, boolean canMoveUp, boolean canMoveDown) {}

    public record ManualSaleStatusRow(
            UUID salesItemRef,
            SalesMenuManualSaleTargetKind targetKind,
            UUID targetRef,
            String state,
            String reason,
            Long changedAtEpochMillis,
            String actorDisplaySnapshot) {}

    public record OrderOptionGroupRow(
            UUID salesItemRef,
            UUID definitionRef,
            String name,
            String selectionMode,
            boolean required,
            Integer minSelectionCount,
            Integer maxSelectionCount,
            long displayOrder) {}

    public record OrderOptionValueRow(
            UUID salesItemRef,
            UUID definitionRef,
            UUID definitionValueRef,
            String name,
            long displayOrder,
            boolean defaultValue,
            Long extraPrice) {}

    public record UuidValueRow(UUID value) {}

    public record OrderingTargetRow(UUID ref, long displayOrder) {}

    public record SectionCurrentRow(UUID sectionRef, long displayOrder) {}

    public record ItemCurrentRow(UUID sectionRef, long displayOrder) {}

    public static MenuListRow menuListRow(ResultSet result, int ignored) throws SQLException {
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

    public static ActivationRow activationRow(ResultSet result, int ignored) throws SQLException {
        return new ActivationRow(
                result.getObject("channel_ref", UUID.class), result.getString("status"), result.getLong("version"));
    }

    public static PublicationItemRow publicationItemRow(ResultSet result, int ignored) throws SQLException {
        return new PublicationItemRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getString("resolved_item_name"),
                result.getString("resolved_item_code"));
    }

    public static Boolean existsRow(ResultSet result, int ignored) throws SQLException {
        return result.getBoolean(1);
    }

    public static OperationRecordRow operationRecordRow(ResultSet result, int ignored) throws SQLException {
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

    public static ReceiptRow receiptRow(ResultSet result, int ignored) throws SQLException {
        return new ReceiptRow(
                result.getString("request_hash"), result.getString("status"), result.getString("readback_json"));
    }

    public static SectionOrderRow sectionOrderRow(ResultSet result, int ignored) throws SQLException {
        return new SectionOrderRow(
                result.getObject("section_ref", UUID.class), result.getString("name"), result.getLong("display_order"));
    }

    public static ItemRow itemRow(ResultSet result, int ignored) throws SQLException {
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

    public static SkuRow skuRow(ResultSet result, int ignored) throws SQLException {
        return new SkuRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("sku_ref", UUID.class),
                result.getLong("listed_price_cents"),
                result.getString("resolved_sku_code"),
                result.getString("resolved_sku_name"),
                result.getLong("default_price_cents"),
                result.getLong("display_order"));
    }

    public static MediaItemRow mediaItemRow(ResultSet result, int ignored) throws SQLException {
        return new MediaItemRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("asset_ref", UUID.class),
                result.getLong("display_order"));
    }

    public static MediaRow mediaRow(ResultSet result, int ignored) throws SQLException {
        return new MediaRow(result.getObject("asset_ref", UUID.class), result.getLong("display_order"));
    }

    public static LongValueRow longValueRow(ResultSet result, int ignored) throws SQLException {
        return new LongValueRow(result.getLong(1));
    }

    public static CountByItemRow countByItemRow(ResultSet result, int ignored) throws SQLException {
        return new CountByItemRow(result.getObject("catalog_item_ref", UUID.class), result.getLong("item_count"));
    }

    public static SectionRow sectionRow(ResultSet result, int ignored) throws SQLException {
        return new SectionRow(
                result.getObject("section_ref", UUID.class),
                result.getString("name"),
                result.getLong("display_order"),
                result.getLong("item_count"),
                result.getBoolean("can_move_up"),
                result.getBoolean("can_move_down"));
    }

    public static ManualSaleStatusRow manualSaleStatusRow(ResultSet result, int ignored) throws SQLException {
        return new ManualSaleStatusRow(
                result.getObject("sales_item_ref", UUID.class),
                SalesMenuManualSaleTargetKind.valueOf(result.getString("target_kind")),
                result.getObject("target_ref", UUID.class),
                result.getString("state"),
                result.getString("reason"),
                result.getObject("changed_at_epoch_millis", Long.class),
                result.getString("actor_display_snapshot"));
    }

    public static OrderOptionGroupRow orderOptionGroupRow(ResultSet result, int ignored) throws SQLException {
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

    public static OrderOptionValueRow orderOptionValueRow(ResultSet result, int ignored) throws SQLException {
        return new OrderOptionValueRow(
                result.getObject("sales_item_ref", UUID.class),
                result.getObject("definition_ref", UUID.class),
                result.getObject("definition_value_ref", UUID.class),
                result.getString("resolved_value_name"),
                result.getLong("display_order"),
                result.getBoolean("default_value"),
                result.getObject("extra_price", Long.class));
    }

    public static UuidValueRow uuidValueRow(ResultSet result, int ignored) throws SQLException {
        return new UuidValueRow(result.getObject(1, UUID.class));
    }

    public static OrderingTargetRow orderingTargetRow(ResultSet result, int ignored) throws SQLException {
        return new OrderingTargetRow(result.getObject(1, UUID.class), result.getLong(2));
    }

    public static SectionCurrentRow sectionCurrentRow(ResultSet result, int ignored) throws SQLException {
        return new SectionCurrentRow(result.getObject("section_ref", UUID.class), result.getLong("display_order"));
    }

    public static ItemCurrentRow itemCurrentRow(ResultSet result, int ignored) throws SQLException {
        return new ItemCurrentRow(result.getObject("section_ref", UUID.class), result.getLong("display_order"));
    }

    private static LocalTime localTime(Time value) {
        return value == null ? null : value.toLocalTime();
    }
}
