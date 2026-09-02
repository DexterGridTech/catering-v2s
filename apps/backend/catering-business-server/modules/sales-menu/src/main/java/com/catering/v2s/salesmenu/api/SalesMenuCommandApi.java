package com.catering.v2s.salesmenu.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.salesmenu.domain.SalesMenuActivationStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentInput;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** The narrow command boundary consumed by generated operation adapters. */
public interface SalesMenuCommandApi {
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

    SalesMenuReadback.Command publish(PublishCommand command);

    SalesMenuReadback.Command setManualSoldOut(ManualSoldOutCommand command);

    SalesMenuReadback.Command restoreManualSale(ManualRestoreCommand command);

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
            Objects.requireNonNull(actor, "actor");
            if (contextVersion < 0) throw new IllegalArgumentException("contextVersion cannot be negative");
            idempotencyKey = required(idempotencyKey, "idempotencyKey", 128);
        }

        public SalesMenuOwnerApi.CommandContext ownerContext() {
            return new SalesMenuOwnerApi.CommandContext(
                    scope, salesMenuRef, ownerScopeGrant, contextVersion, actor, idempotencyKey);
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

        public SalesMenuOwnerApi.CreateCommand ownerCommand() {
            return new SalesMenuOwnerApi.CreateCommand(context.ownerContext(), channelRef, name);
        }
    }

    record CopyCommand(CommandContext context, long expectedVersion) {
        public SalesMenuOwnerApi.CopyCommand ownerCommand() {
            return new SalesMenuOwnerApi.CopyCommand(context.ownerContext(), expectedVersion);
        }
    }

    record RenameCommand(CommandContext context, long expectedVersion, String name) {
        public RenameCommand {
            Objects.requireNonNull(context, "context");
            name = required(name);
        }

        public SalesMenuOwnerApi.RenameCommand ownerCommand() {
            return new SalesMenuOwnerApi.RenameCommand(context.ownerContext(), expectedVersion, name);
        }
    }

    record ArchiveCommand(CommandContext context, long expectedVersion) {
        public SalesMenuOwnerApi.ArchiveCommand ownerCommand() {
            return new SalesMenuOwnerApi.ArchiveCommand(context.ownerContext(), expectedVersion);
        }
    }

    record ActivationCommand(
            CommandContext context, UUID channelRef, SalesMenuActivationStatus status, long expectedVersion) {
        public ActivationCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(status, "status");
        }

        public SalesMenuOwnerApi.ActivationCommand ownerCommand() {
            return new SalesMenuOwnerApi.ActivationCommand(context.ownerContext(), channelRef, status, expectedVersion);
        }
    }

    record ScheduleCommand(CommandContext context, SalesMenuSchedule schedule, long expectedVersion) {
        public ScheduleCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(schedule, "schedule");
        }

        public SalesMenuOwnerApi.ScheduleCommand ownerCommand() {
            return new SalesMenuOwnerApi.ScheduleCommand(context.ownerContext(), schedule, expectedVersion);
        }
    }

    record SectionCreateCommand(CommandContext context, String name, long expectedVersion) {
        public SectionCreateCommand {
            Objects.requireNonNull(context, "context");
            name = required(name);
        }

        public SalesMenuOwnerApi.SectionCreateCommand ownerCommand() {
            return new SalesMenuOwnerApi.SectionCreateCommand(context.ownerContext(), name, expectedVersion);
        }
    }

    record SectionRenameCommand(CommandContext context, UUID salesSectionRef, String name, long expectedVersion) {
        public SectionRenameCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
            name = required(name);
        }

        public SalesMenuOwnerApi.SectionRenameCommand ownerCommand() {
            return new SalesMenuOwnerApi.SectionRenameCommand(
                    context.ownerContext(), salesSectionRef, name, expectedVersion);
        }
    }

    record SectionDeleteCommand(CommandContext context, UUID salesSectionRef, long expectedVersion) {
        public SectionDeleteCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
        }

        public SalesMenuOwnerApi.SectionDeleteCommand ownerCommand() {
            return new SalesMenuOwnerApi.SectionDeleteCommand(context.ownerContext(), salesSectionRef, expectedVersion);
        }
    }

    record SectionMoveCommand(
            CommandContext context, UUID salesSectionRef, SalesMenuMoveDirection direction, long expectedVersion) {
        public SectionMoveCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
            Objects.requireNonNull(direction, "direction");
        }

        public SalesMenuOwnerApi.SectionMoveCommand ownerCommand() {
            return new SalesMenuOwnerApi.SectionMoveCommand(
                    context.ownerContext(), salesSectionRef, direction, expectedVersion);
        }
    }

    record ItemsAddCommand(
            CommandContext context, UUID salesSectionRef, List<UUID> catalogItemRefs, long expectedVersion) {
        public ItemsAddCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesSectionRef, "salesSectionRef");
            catalogItemRefs = List.copyOf(Objects.requireNonNull(catalogItemRefs, "catalogItemRefs"));
        }

        public SalesMenuOwnerApi.ItemsAddCommand ownerCommand() {
            return new SalesMenuOwnerApi.ItemsAddCommand(
                    context.ownerContext(), salesSectionRef, catalogItemRefs, expectedVersion);
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
            if (displayNameOverride != null) displayNameOverride = required(displayNameOverride);
        }

        public SalesMenuOwnerApi.ItemUpdateCommand ownerCommand() {
            return new SalesMenuOwnerApi.ItemUpdateCommand(
                    context.ownerContext(),
                    salesItemRef,
                    displayNameOverride,
                    saleContent,
                    orderingConstraints,
                    displayMedia,
                    assetBindings,
                    expectedVersion);
        }
    }

    record ItemDeleteCommand(CommandContext context, UUID salesItemRef, long expectedVersion) {
        public ItemDeleteCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
        }

        public SalesMenuOwnerApi.ItemDeleteCommand ownerCommand() {
            return new SalesMenuOwnerApi.ItemDeleteCommand(context.ownerContext(), salesItemRef, expectedVersion);
        }
    }

    record ItemMoveCommand(
            CommandContext context, UUID salesItemRef, SalesMenuMoveDirection direction, long expectedVersion) {
        public ItemMoveCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
            Objects.requireNonNull(direction, "direction");
        }

        public SalesMenuOwnerApi.ItemMoveCommand ownerCommand() {
            return new SalesMenuOwnerApi.ItemMoveCommand(
                    context.ownerContext(), salesItemRef, direction, expectedVersion);
        }
    }

    record PublishCommand(CommandContext context, long expectedVersion) {
        public SalesMenuOwnerApi.PublishCommand ownerCommand() {
            return new SalesMenuOwnerApi.PublishCommand(context.ownerContext(), expectedVersion);
        }
    }

    record ManualSoldOutCommand(
            CommandContext context, UUID channelRef, UUID salesItemRef, String reason, long expectedVersion) {
        public ManualSoldOutCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
            reason = required(reason);
        }

        public SalesMenuOwnerApi.ManualSoldOutCommand ownerCommand() {
            return new SalesMenuOwnerApi.ManualSoldOutCommand(
                    context.ownerContext(), channelRef, salesItemRef, reason, expectedVersion);
        }
    }

    record ManualRestoreCommand(
            CommandContext context, UUID channelRef, UUID salesItemRef, boolean confirm, long expectedVersion) {
        public ManualRestoreCommand {
            Objects.requireNonNull(context, "context");
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(salesItemRef, "salesItemRef");
        }

        public SalesMenuOwnerApi.ManualRestoreCommand ownerCommand() {
            return new SalesMenuOwnerApi.ManualRestoreCommand(
                    context.ownerContext(), channelRef, salesItemRef, confirm, expectedVersion);
        }
    }

    private static String required(String value) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > 160) throw new IllegalArgumentException("name is invalid");
        return normalized;
    }
}
