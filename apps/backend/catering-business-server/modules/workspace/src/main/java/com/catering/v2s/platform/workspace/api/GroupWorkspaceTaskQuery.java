package com.catering.v2s.platform.workspace.api;

import com.catering.v2s.platform.access.PlatformExecutionContext;
import java.util.List;
import java.util.Optional;

public interface GroupWorkspaceTaskQuery {
    List<GroupWorkspaceSummary> list(PlatformExecutionContext context, String name, String groupWorkspaceKey);

    Optional<GroupWorkspaceDetail> detail(PlatformExecutionContext context, String groupWorkspaceKey);
}
