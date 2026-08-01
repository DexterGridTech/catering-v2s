package com.catering.v2s.organization.api;

import java.util.UUID;

/** Consumer-owned port implemented by the platform-workspace owner. */
public interface WorkspaceStatusLookup {
    boolean isEnabled(UUID workspaceUuid, String groupWorkspaceKey);
}
