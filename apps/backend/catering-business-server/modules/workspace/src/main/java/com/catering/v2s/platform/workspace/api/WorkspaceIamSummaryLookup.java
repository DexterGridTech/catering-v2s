package com.catering.v2s.platform.workspace.api;

import java.util.UUID;

/** Consumer-owned aggregate port implemented by workspace-IAM. */
public interface WorkspaceIamSummaryLookup {
    record AccountAndRoleSummary(long accountCount, long roleCount) { }

    AccountAndRoleSummary accountAndRoleSummary(UUID workspaceUuid);

    long accountCount(UUID workspaceUuid);
    long roleCount(UUID workspaceUuid);
}
