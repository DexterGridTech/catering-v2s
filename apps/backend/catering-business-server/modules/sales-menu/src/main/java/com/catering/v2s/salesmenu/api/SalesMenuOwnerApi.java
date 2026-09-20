package com.catering.v2s.salesmenu.api;

import com.catering.v2s.platform.foundation.contract.OwnerProblem;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.salesmenu.domain.SalesMenuActivationStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTargetMode;
import com.catering.v2s.salesmenu.domain.SalesMenuCandidateQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia;
import com.catering.v2s.salesmenu.domain.SalesMenuItemPageQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuManualSaleTargetKind;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentInput;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionQuery;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** The sales-menu owner boundary; HTTP edge types stay outside this module. */
public interface SalesMenuOwnerApi {
    SalesMenuReadback.MenuPage listMenus(SalesMenuListQuery query);

    SalesMenuReadback.MenuDetail readMenu(SalesMenuTarget target, UUID channelRef);

    SalesMenuReadback.SectionList listDraftSections(SalesMenuVersionQuery query);

    SalesMenuReadback.DraftItemPage listDraftItems(SalesMenuItemPageQuery query);

    SalesMenuReadback.DraftItemView readDraftItem(SalesMenuItemQuery query);

    SalesMenuReadback.SectionList listPublishedSections(SalesMenuVersionQuery query);

    SalesMenuReadback.PublishedItemPage listPublishedItems(SalesMenuItemPageQuery query);

    SalesMenuReadback.PublishedItemView readPublishedItem(SalesMenuItemQuery query);

    SalesMenuReadback.CandidatePage listItemCandidates(SalesMenuCandidateQuery query);

    SalesMenuReadback.PublicationPreview publicationPreview(SalesMenuTarget target, UUID channelRef);

    SalesMenuReadback.OperationRecordPage listOperationRecords(SalesMenuOperationQuery query);

    SalesMenuReadback.Command create(CreateCommand command);

    SalesMenuReadback.Command copy(CopyCommand command);

    SalesMenuReadback.Command rename(RenameCommand command);

    SalesMenuReadback.Command archive(ArchiveCommand command);

    SalesMenuReadback.Command setActivation(ActivationCommand command);

    SalesMenuReadback.Command updateSchedule(ScheduleCommand command);

    SalesMenuReadback.Command createSection(SectionCreateCommand command);

    SalesMenuReadback.Command renameSection(SectionRenameCommand command);

    SalesMenuReadback.Command deleteSection(SectionDeleteCommand command);

    SalesMenuReadback.Command moveSection(SectionMoveCommand command);

    SalesMenuReadback.Command addItems(ItemsAddCommand command);

    SalesMenuReadback.Command updateItem(ItemUpdateCommand command);

    SalesMenuReadback.Command deleteItem(ItemDeleteCommand command);

    SalesMenuReadback.Command moveItem(ItemMoveCommand command);

    SalesMenuReadback.AssetTargetReadback requireSalesMenuItemAssetTarget(
            SalesMenuAssetTargetMode mode,
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion);

    SalesMenuReadback.Command publish(PublishCommand command);

    SalesMenuReadback.Command setManualSoldOut(ManualSoldOutCommand command);

    SalesMenuReadback.Command restoreManualSale(ManualRestoreCommand command);

    SalesMenuReadback.OperationRecord recordRejectedOperation(RejectedOperationCommand command);

    record CommandContext(
            SalesMenuScope scope,
            UUID salesMenuRef,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            AuditActor actor,
            String idempotencyKey) {
        public CommandContext {
            Objects.requireNonNull(scope, "scope");
            Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
            if (contextVersion < 0) {
                throw new IllegalArgumentException("contextVersion cannot be negative");
            }
            Objects.requireNonNull(actor, "actor");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
        }

        public SalesMenuTarget target() {
            return new SalesMenuTarget(scope, Objects.requireNonNull(salesMenuRef, "salesMenuRef"));
        }

        private static String required(String value, String name, int maxLength) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty() || normalized.length() > maxLength) {
                throw new IllegalArgumentException(name + " is invalid");
            }
            return normalized;
        }
    }

    record CreateCommand(CommandContext context, UUID channelRef, String name) {
        public CreateCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            name = required(name);
        }

        private static String required(String value) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty() || normalized.length() > 160) {
                throw new IllegalArgumentException("name is invalid");
            }
            return normalized;
        }
    }

    record CopyCommand(CommandContext context, long expectedVersion) {}

    record RenameCommand(CommandContext context, long expectedVersion, String name) {
        public RenameCommand {
            Objects.requireNonNull(context, "context");
            name = CreateCommand.required(name);
        }
    }

    record ArchiveCommand(CommandContext context, long expectedVersion) {}

    record ActivationCommand(
            CommandContext context, UUID channelRef, SalesMenuActivationStatus status, long expectedVersion) {
        public ActivationCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(status, "status");
        }
    }

    record ScheduleCommand(CommandContext context, SalesMenuSchedule schedule, long expectedVersion) {
        public ScheduleCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(schedule, "schedule");
        }
    }

    record SectionCreateCommand(CommandContext context, String name, long expectedVersion) {
        public SectionCreateCommand {
            Objects.requireNonNull(context, "context");
            name = CreateCommand.required(name);
        }
    }

    record SectionRenameCommand(CommandContext context, UUID salesSectionRef, String name, long expectedVersion) {
        public SectionRenameCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
            name = CreateCommand.required(name);
        }
    }

    record SectionDeleteCommand(CommandContext context, UUID salesSectionRef, long expectedVersion) {
        public SectionDeleteCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
        }
    }

    record SectionMoveCommand(
            CommandContext context, UUID salesSectionRef, SalesMenuMoveDirection direction, long expectedVersion) {
        public SectionMoveCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
            Objects.requireNonNull(direction, "direction");
        }
    }

    record ItemsAddCommand(
            CommandContext context, UUID salesSectionRef, List<UUID> catalogItemRefs, long expectedVersion) {
        public ItemsAddCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
            catalogItemRefs = List.copyOf(Objects.requireNonNull(catalogItemRefs, "catalogItemRefs"));
        }
    }

    record ItemUpdateCommand(
            CommandContext context,
            UUID salesItemRef,
            String displayNameOverride,
            SalesMenuSaleContentInput saleContent,
            SalesMenuOrderingConstraints orderingConstraints,
            SalesMenuDisplayMedia displayMedia,
            List<SalesMenuAssetCommandApi.AssetBinding> assetBindings,
            long expectedVersion) {
        public ItemUpdateCommand(
                CommandContext context,
                UUID salesItemRef,
                String displayNameOverride,
                SalesMenuSaleContentInput saleContent,
                SalesMenuOrderingConstraints orderingConstraints,
                SalesMenuDisplayMedia displayMedia,
                long expectedVersion) {
            this(
                    context,
                    salesItemRef,
                    displayNameOverride,
                    saleContent,
                    orderingConstraints,
                    displayMedia,
                    List.of(),
                    expectedVersion);
        }

        public ItemUpdateCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
            Objects.requireNonNull(saleContent, "saleContent");
            Objects.requireNonNull(orderingConstraints, "orderingConstraints");
            Objects.requireNonNull(displayMedia, "displayMedia");
            assetBindings = assetBindings == null ? List.of() : List.copyOf(assetBindings);
            if (displayNameOverride != null) {
                displayNameOverride = CreateCommand.required(displayNameOverride);
            }
        }
    }

    record ItemDeleteCommand(CommandContext context, UUID salesItemRef, long expectedVersion) {
        public ItemDeleteCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
        }
    }

    record ItemMoveCommand(
            CommandContext context, UUID salesItemRef, SalesMenuMoveDirection direction, long expectedVersion) {
        public ItemMoveCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
            Objects.requireNonNull(direction, "direction");
        }
    }

    record PublishCommand(CommandContext context, long expectedVersion) {}

    record ManualSoldOutCommand(
            CommandContext context,
            UUID channelRef,
            UUID salesItemRef,
            SalesMenuManualSaleTarget target,
            String reason,
            long expectedVersion) {
        public ManualSoldOutCommand(
                CommandContext context, UUID channelRef, UUID salesItemRef, String reason, long expectedVersion) {
            this(
                    context,
                    channelRef,
                    salesItemRef,
                    new SalesMenuManualSaleTarget(SalesMenuManualSaleTargetKind.ITEM, salesItemRef),
                    reason,
                    expectedVersion);
        }

        public ManualSoldOutCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
            Objects.requireNonNull(target, "target");
            reason = requiredManualReason(reason);
        }

        private static String requiredManualReason(String value) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty() || normalized.length() > 240) {
                String message = "人工沽清原因不能为空且不能超过 240 个字符";
                throw new Problem("SALES_MENU_MANUAL_REASON_REQUIRED", 422, message);
            }
            return normalized;
        }
    }

    record ManualRestoreCommand(
            CommandContext context,
            UUID channelRef,
            UUID salesItemRef,
            SalesMenuManualSaleTarget target,
            boolean confirm,
            long expectedVersion) {
        public ManualRestoreCommand(
                CommandContext context, UUID channelRef, UUID salesItemRef, boolean confirm, long expectedVersion) {
            this(
                    context,
                    channelRef,
                    salesItemRef,
                    new SalesMenuManualSaleTarget(SalesMenuManualSaleTargetKind.ITEM, salesItemRef),
                    confirm,
                    expectedVersion);
        }

        public ManualRestoreCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
            Objects.requireNonNull(target, "target");
        }
    }

    record RejectedOperationCommand(
            CommandContext context,
            String operationKind,
            UUID targetRef,
            String targetKind,
            String targetDisplaySnapshot,
            String failureCode,
            UUID channelRef) {
        public RejectedOperationCommand(
                CommandContext context, String operationKind, UUID targetRef, String failureCode) {
            this(context, operationKind, targetRef, null, null, failureCode, null);
        }

        public RejectedOperationCommand(
                CommandContext context, String operationKind, UUID targetRef, String failureCode, UUID channelRef) {
            this(context, operationKind, targetRef, null, null, failureCode, channelRef);
        }

        public RejectedOperationCommand {
            Objects.requireNonNull(context, "context");
            operationKind = required(operationKind, "operationKind", 120);
            failureCode = required(failureCode, "failureCode", 120);
        }

        private static String required(String value, String name, int maxLength) {
            String normalized = Objects.requireNonNullElse(value, "").trim();
            if (normalized.isEmpty() || normalized.length() > maxLength) {
                throw new IllegalArgumentException(name + " is invalid");
            }
            return normalized;
        }
    }

    final class Problem extends RuntimeException implements OwnerProblem {
        private final String code;
        private final int status;

        public Problem(String code, int status, String message) {
            super(message);
            this.code = code;
            this.status = status;
        }

        public Problem(String code, int status, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
            this.status = status;
        }

        @Override
        public String code() {
            return code;
        }

        @Override
        public int status() {
            return status;
        }
    }
}
