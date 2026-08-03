package com.catering.v2s.platform.workspace.api;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import java.util.Map;

public interface PlatformWorkspaceCoordinator {
    CommercialGroupReadback initializeCommercialGroup(
        PlatformExecutionContext context,
        String groupWorkspaceKey,
        String idempotencyKey,
        String commercialGroupCode,
        String commercialGroupName,
        Map<String, String> extensionValues,
        AuditActor actor
    );
}
