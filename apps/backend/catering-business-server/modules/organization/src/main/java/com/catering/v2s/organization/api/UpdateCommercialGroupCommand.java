package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditActor;
import java.util.Map;
import java.util.UUID;

/** Owner command for the already-initialized commercial-group root. */
public interface UpdateCommercialGroupCommand {
    CommercialGroupReadback execute(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String idempotencyKey,
            String commercialGroupCode,
            String commercialGroupName,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor);
}
