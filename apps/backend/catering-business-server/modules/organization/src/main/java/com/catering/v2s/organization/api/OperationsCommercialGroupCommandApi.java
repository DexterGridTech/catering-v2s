package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionSubmission;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Typed operations-owner boundary for commercial-group extension mutations. */
public interface OperationsCommercialGroupCommandApi {
    CommercialGroupReadback update(UpdateCommand command);

    record UpdateCommand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String idempotencyKey,
        String commercialGroupCode,
        String commercialGroupName,
        long expectedVersion,
        ExtensionSubmission extensionSubmission,
        AuditActor actor,
        OperationsOwnerScopeGrant ownerScopeGrant
    ) {
        public UpdateCommand {
            extensionSubmission = extensionSubmission == null ? new ExtensionSubmission(List.of()) : extensionSubmission;
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }
}
