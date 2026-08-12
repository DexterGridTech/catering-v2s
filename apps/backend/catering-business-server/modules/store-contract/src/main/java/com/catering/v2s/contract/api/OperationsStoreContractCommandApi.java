package com.catering.v2s.contract.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Typed operations-owner boundary for Store Contract commands. */
public interface OperationsStoreContractCommandApi {
    StoreContractReadback create(CreateCommand command);
    StoreContractReadback update(UpdateCommand command);
    StoreContractReadback invalidate(InvalidateCommand command);

    /** Public contract-owner projection used only to assemble a Contract command response. */
    interface TaskReadbackApi {
        StoreContractTaskReadback readTaskView(TaskViewQuery query);
    }

    /** Public contract-owner projection used only to assemble a Store command response. */
    interface StoreStatusReadbackApi {
        StoreDerivedStatusReadback readDerivedStoreStatus(StoreStatusQuery query);
    }

    record StoreStatusQuery(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        public StoreStatusQuery {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            storeId = Objects.requireNonNull(storeId, "storeId");
        }
    }

    record StoreDerivedStatusReadback(String status) { }

    record TaskViewQuery(UUID workspaceUuid, String groupWorkspaceKey, UUID contractId) {
        public TaskViewQuery {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            contractId = Objects.requireNonNull(contractId, "contractId");
        }
    }

    record StoreContractTaskReadback(
        UUID id,
        String groupWorkspaceKey,
        Reference project,
        Reference store,
        Reference tenant,
        String phaseName,
        String contractNo,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String note,
        List<ExtensionValue> extensionValues,
        long extensionRuleRevision,
        String status,
        long revision,
        String source,
        long createdAt,
        long updatedAt,
        List<ItemReadback> items,
        String phaseNameSnapshot
    ) {
        public StoreContractTaskReadback {
            extensionValues = extensionValues == null ? List.of() : List.copyOf(extensionValues);
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    record Reference(UUID id, String code, String name) { }
    record ExtensionValue(String fieldKey, String valueJson) { }
    record ItemReadback(String code, String name) { }

    record CreateCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String contractNo,
        UUID storeId,
        UUID projectId,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String phaseName,
        String notes,
        List<Item> items,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public CreateCommand {
            items = items == null ? List.of() : List.copyOf(items);
            extensionSubmission = extensionSubmission == null ? new ExtensionSubmission(List.of()) : extensionSubmission;
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record UpdateCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID contractId,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String phaseName,
        String notes,
        List<Item> items,
        long expectedVersion,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public UpdateCommand {
            items = items == null ? List.of() : List.copyOf(items);
            extensionSubmission = extensionSubmission == null ? new ExtensionSubmission(List.of()) : extensionSubmission;
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record InvalidateCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID contractId,
        long expectedVersion,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public InvalidateCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record Item(String itemCode, String itemName) { }
}
