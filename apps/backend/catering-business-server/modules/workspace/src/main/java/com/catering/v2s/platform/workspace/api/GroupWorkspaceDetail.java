package com.catering.v2s.platform.workspace.api;

public record GroupWorkspaceDetail(
        long id,
        String groupWorkspaceKey,
        String workspaceName,
        String workspaceStatus,
        String commercialGroupStatus,
        CommercialGroupSummary commercialGroup) {}
