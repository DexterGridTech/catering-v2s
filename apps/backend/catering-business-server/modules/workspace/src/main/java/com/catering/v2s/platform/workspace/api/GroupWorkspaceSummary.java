package com.catering.v2s.platform.workspace.api;

public record GroupWorkspaceSummary(
    String groupWorkspaceKey,
    String workspaceName,
    String commercialGroupStatus
) {
}
