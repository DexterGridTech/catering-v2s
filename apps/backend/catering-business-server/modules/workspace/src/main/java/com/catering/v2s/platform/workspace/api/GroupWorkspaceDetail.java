package com.catering.v2s.platform.workspace.api;

import java.util.UUID;

public record GroupWorkspaceDetail(
        long id,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String workspaceName,
        String workspaceStatus,
        String commercialGroupStatus,
        CommercialGroupSummary commercialGroup) {}
