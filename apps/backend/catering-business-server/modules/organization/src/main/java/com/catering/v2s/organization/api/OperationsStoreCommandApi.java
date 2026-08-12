package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Typed operations-owner boundary for Store commands. */
public interface OperationsStoreCommandApi {
    OrganizationEntityReadback createStore(CreateStoreCommand command);
    OrganizationEntityReadback updateStore(UpdateStoreCommand command);
    OrganizationEntityReadback transitionStoreStatus(StoreStatusCommand command);

    /** Public organization-owner projection used only to assemble a Store command response. */
    interface StoreDetailReadbackApi {
        StoreOrganizationDetailReadback readStoreDetail(StoreDetailQuery query);
    }

    record StoreDetailQuery(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        public StoreDetailQuery {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            storeId = Objects.requireNonNull(storeId, "storeId");
        }
    }

    record StoreOrganizationDetailReadback(Reference project, Reference brand, Reference tenant, Reference headCompany) { }
    record Reference(UUID id, String code, String name) { }

    record CreateStoreCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID projectId,
        UUID tenantId,
        UUID brandId,
        UUID headCompanyId,
        String code,
        String name,
        String notes,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public CreateStoreCommand {
            extensionSubmission = extensionSubmission == null ? new ExtensionSubmission(List.of()) : extensionSubmission;
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record UpdateStoreCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID storeId,
        UUID projectId,
        UUID tenantId,
        UUID brandId,
        UUID headCompanyId,
        String code,
        String name,
        String notes,
        long expectedVersion,
        ExtensionSubmission extensionSubmission,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public UpdateStoreCommand {
            extensionSubmission = extensionSubmission == null ? new ExtensionSubmission(List.of()) : extensionSubmission;
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }

    record StoreStatusCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID storeId,
        String targetStatus,
        long expectedVersion,
        String idempotencyKey,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public StoreStatusCommand {
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }
}
