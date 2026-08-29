package com.catering.v2s.platform.foundation.workspace;

import java.util.UUID;

/** Shared consumer port for reading the selected workspace's raw lifecycle status. */
public interface WorkspaceStatusLookup {
    String requireStatus(UUID workspaceUuid, String groupWorkspaceKey);

    default boolean isEnabled(UUID workspaceUuid, String groupWorkspaceKey) {
        return "ENABLED".equals(requireStatus(workspaceUuid, groupWorkspaceKey));
    }
}
