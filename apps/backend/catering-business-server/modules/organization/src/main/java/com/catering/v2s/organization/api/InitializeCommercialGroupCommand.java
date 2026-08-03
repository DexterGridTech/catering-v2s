package com.catering.v2s.organization.api;

import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.audit.contract.AuditActor;
import java.util.Map;
import java.util.UUID;

public interface InitializeCommercialGroupCommand {
    CommercialGroupReadback execute(
        PlatformExecutionContext context,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        long groupWorkspaceId,
        String idempotencyKey,
        String commercialGroupCode,
        String commercialGroupName,
        AuditActor actor
    );

    default CommercialGroupReadback execute(
        PlatformExecutionContext context,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        long groupWorkspaceId,
        String idempotencyKey,
        String commercialGroupCode,
        String commercialGroupName,
        Map<String, String> extensionValues,
        AuditActor actor
    ) {
        return execute(context, workspaceUuid, groupWorkspaceKey, groupWorkspaceId, idempotencyKey, commercialGroupCode, commercialGroupName, actor);
    }
}
