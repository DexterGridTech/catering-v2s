package com.catering.v2s.salesmenu.api;

import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuCommandReadbackStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleState;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTargetKind;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationResult;
import com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints;
import com.catering.v2s.salesmenu.domain.SalesMenuPublicationBlockerKind;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContent;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Owner-native readbacks; HTTP models terminate outside this module. */
public final class SalesMenuReadback {
    private SalesMenuReadback() {}

    public record Activation(UUID channelRef, String status, long version) {}

    public record MenuSummary(
            UUID salesMenuRef,
            UUID storeRef,
            String name,
            boolean archived,
            long version,
            long draftRevision,
            Long latestPublishedRevision,
            boolean draftDirty,
            Activation activation,
            SalesMenuSchedule draftSchedule) {}

    public record MenuPage(List<MenuSummary> items, String cursor, String nextCursor) {
        public MenuPage {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    public record MenuDetail(
            UUID salesMenuRef,
            String groupWorkspaceKey,
            UUID storeRef,
            String name,
            boolean archived,
            long version,
            long draftRevision,
            Long latestPublishedRevision,
            boolean draftDirty,
            Activation activation,
            SalesMenuSchedule draftSchedule,
            SalesMenuSchedule latestPublishedSchedule) {}

    public record SectionView(
            UUID salesSectionRef,
            String name,
            long displayOrder,
            long itemCount,
            boolean canMoveUp,
            boolean canMoveDown) {}

    public record SectionList(List<SectionView> items) {
        public SectionList {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    public record SalesMenuOrderOptionValue(
            UUID definitionValueRef, String name, int displayOrder, boolean defaultValue, Long extraPrice) {}

    public record SalesMenuOrderOption(
            UUID definitionRef,
            String name,
            String selectionMode,
            int displayOrder,
            boolean required,
            Integer minSelectionCount,
            Integer maxSelectionCount,
            List<SalesMenuOrderOptionValue> values) {
        public SalesMenuOrderOption {
            values = List.copyOf(Objects.requireNonNull(values, "values"));
        }
    }

    public record DraftItemView(
            UUID salesItemRef,
            UUID catalogItemRef,
            String itemCode,
            String displayName,
            String productShape,
            List<SalesMenuOrderOption> catalogOrderOptions,
            List<SalesMenuSkuCandidate> skuCandidates,
            List<UUID> staleSelectedSkuRefs,
            Long defaultPriceCents,
            UUID catalogPrimaryImageAssetRef,
            List<UUID> catalogImageAssetRefs,
            SalesMenuSaleContent saleContent,
            SalesMenuOrderingConstraints orderingConstraints,
            SalesMenuDisplayMedia displayMedia,
            long displayOrder,
            boolean canMoveUp,
            boolean canMoveDown,
            long version) {
        public DraftItemView(
                UUID salesItemRef,
                UUID catalogItemRef,
                String itemCode,
                String displayName,
                String productShape,
                List<SalesMenuOrderOption> orderOptions,
                Long defaultPriceCents,
                UUID catalogPrimaryImageAssetRef,
                SalesMenuSaleContent saleContent,
                SalesMenuOrderingConstraints orderingConstraints,
                SalesMenuDisplayMedia displayMedia,
                long displayOrder,
                boolean canMoveUp,
                boolean canMoveDown,
                long version) {
            this(
                    salesItemRef,
                    catalogItemRef,
                    itemCode,
                    displayName,
                    productShape,
                    orderOptions,
                    List.of(),
                    List.of(),
                    defaultPriceCents,
                    catalogPrimaryImageAssetRef,
                    List.of(),
                    saleContent,
                    orderingConstraints,
                    displayMedia,
                    displayOrder,
                    canMoveUp,
                    canMoveDown,
                    version);
        }

        public DraftItemView {
            catalogOrderOptions = List.copyOf(Objects.requireNonNull(catalogOrderOptions, "catalogOrderOptions"));
            skuCandidates = List.copyOf(Objects.requireNonNull(skuCandidates, "skuCandidates"));
            staleSelectedSkuRefs = List.copyOf(Objects.requireNonNull(staleSelectedSkuRefs, "staleSelectedSkuRefs"));
            catalogImageAssetRefs = List.copyOf(Objects.requireNonNull(catalogImageAssetRefs, "catalogImageAssetRefs"));
        }
    }

    public record SalesMenuSkuCandidate(UUID skuRef, String skuName, String skuCode, long standardPriceCents) {
        public SalesMenuSkuCandidate {
            Objects.requireNonNull(skuRef, "skuRef");
            skuName = required(skuName, "skuName");
            skuCode = required(skuCode, "skuCode");
            if (standardPriceCents < 0) throw new IllegalArgumentException("standardPriceCents cannot be negative");
        }

        private static String required(String value, String field) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty() || normalized.length() > 160) {
                throw new IllegalArgumentException(field + " is invalid");
            }
            return normalized;
        }
    }

    public record InventoryAvailabilityFact(String applicability, String state, String reason) {}

    public record ManualSaleStatusFact(
            SalesMenuManualSaleState state, String reason, Long changedAt, String changedByDisplayName) {}

    public record PublishedItemView(
            UUID salesItemRef,
            UUID catalogItemRef,
            String itemCode,
            String displayName,
            String productShape,
            SalesMenuSaleContent saleContent,
            SalesMenuOrderingConstraints orderingConstraints,
            SalesMenuDisplayMedia displayMedia,
            UUID publishedPrimaryImageAssetRef,
            List<UUID> publishedCatalogImageAssetRefs,
            long displayOrder,
            InventoryAvailabilityFact inventoryAvailability,
            ManualSaleStatusFact manualSaleStatus,
            List<ManualSaleTargetStatus> manualSaleTargetStatuses,
            long version) {
        public PublishedItemView(
                UUID salesItemRef,
                UUID catalogItemRef,
                String itemCode,
                String displayName,
                String productShape,
                List<SalesMenuOrderOption> orderOptions,
                SalesMenuSaleContent saleContent,
                SalesMenuOrderingConstraints orderingConstraints,
                SalesMenuDisplayMedia displayMedia,
                long displayOrder,
                InventoryAvailabilityFact inventoryAvailability,
                ManualSaleStatusFact manualSaleStatus,
                long version) {
            this(
                    salesItemRef,
                    catalogItemRef,
                    itemCode,
                    displayName,
                    productShape,
                    saleContent,
                    orderingConstraints,
                    displayMedia,
                    null,
                    List.of(),
                    displayOrder,
                    inventoryAvailability,
                    manualSaleStatus,
                    List.of(),
                    version);
        }

        public PublishedItemView {
            manualSaleTargetStatuses =
                    List.copyOf(Objects.requireNonNull(manualSaleTargetStatuses, "manualSaleTargetStatuses"));
            publishedCatalogImageAssetRefs = List.copyOf(
                    Objects.requireNonNull(publishedCatalogImageAssetRefs, "publishedCatalogImageAssetRefs"));
        }
    }

    public record ManualSaleTargetStatus(
            SalesMenuManualSaleTargetKind targetKind,
            UUID targetRef,
            String resolvedTargetDisplayName,
            SalesMenuManualSaleState state,
            String reason,
            Long changedAt,
            String changedByDisplayName) {
        public ManualSaleTargetStatus {
            Objects.requireNonNull(targetKind, "targetKind");
            Objects.requireNonNull(targetRef, "targetRef");
            Objects.requireNonNull(state, "state");
            resolvedTargetDisplayName = required(resolvedTargetDisplayName, "resolvedTargetDisplayName");
        }

        private static String required(String value, String field) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty() || normalized.length() > 160) {
                throw new IllegalArgumentException(field + " is invalid");
            }
            return normalized;
        }
    }

    public record DraftItemPage(List<DraftItemView> items, String cursor, String nextCursor) {
        public DraftItemPage {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    public record PublishedItemPage(List<PublishedItemView> items, String cursor, String nextCursor) {
        public PublishedItemPage {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    public record ItemCandidate(
            UUID candidateRef,
            UUID catalogItemRef,
            String itemCode,
            String displayName,
            String productShape,
            List<UUID> categoryRefs,
            List<String> categoryNames,
            Long defaultPriceCents,
            long alreadyAddedCount) {
        public ItemCandidate {
            categoryRefs = List.copyOf(Objects.requireNonNull(categoryRefs, "categoryRefs"));
            categoryNames = List.copyOf(Objects.requireNonNull(categoryNames, "categoryNames"));
        }
    }

    public record CandidatePage(List<ItemCandidate> items, String cursor, String nextCursor) {
        public CandidatePage {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    public record PublicationBlocker(SalesMenuPublicationBlockerKind kind, UUID salesItemRef, String messageKey) {}

    public record PublicationPreview(
            UUID salesMenuRef, long draftRevision, boolean hasChanges, List<PublicationBlocker> violations) {
        public PublicationPreview {
            violations = List.copyOf(Objects.requireNonNull(violations, "violations"));
        }
    }

    public record OperationRecord(
            UUID operationRecordRef,
            long occurredAt,
            String operationKind,
            UUID salesMenuRef,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            SalesMenuOperationResult result,
            String failureCode,
            String actorDisplayName) {
        public OperationRecord(
                UUID operationRecordRef,
                long occurredAt,
                String operationKind,
                UUID salesMenuRef,
                UUID targetRef,
                SalesMenuOperationResult result,
                String failureCode,
                String actorDisplayName) {
            this(
                    operationRecordRef,
                    occurredAt,
                    operationKind,
                    salesMenuRef,
                    targetRef,
                    null,
                    null,
                    result,
                    failureCode,
                    actorDisplayName);
        }
    }

    public record OperationRecordPage(List<OperationRecord> items, String cursor, String nextCursor) {
        public OperationRecordPage {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    public record Command(
            String operationKind,
            UUID salesMenuRef,
            UUID targetRef,
            long version,
            SalesMenuCommandReadbackStatus readbackStatus) {}

    public record AssetTargetReadback(SalesMenuAssetTarget target) {
        public AssetTargetReadback {
            Objects.requireNonNull(target, "target");
        }
    }

    public record AssetStage(
            UUID assetRef,
            SalesMenuAssetTarget target,
            String bindGrant,
            String status,
            String mediaType,
            String contentDigest,
            long version) {}

    public record AssetRelease(SalesMenuAssetTarget target, UUID assetRef, long releasedAt, long version) {}

    public record AssetClaim(SalesMenuAssetTarget target, List<ClaimedAsset> assets) {
        public AssetClaim {
            Objects.requireNonNull(target, "target");
            assets = List.copyOf(Objects.requireNonNull(assets, "assets"));
        }
    }

    public record ClaimedAsset(UUID assetRef, String status, long version) {
        public ClaimedAsset {
            Objects.requireNonNull(assetRef, "assetRef");
            Objects.requireNonNull(status, "status");
        }
    }
}
