package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceDetail;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceSummary;
import java.util.List;
import java.util.Optional;

public interface GroupWorkspaceRepository {
    List<GroupWorkspaceSummary> list(PlatformExecutionContext context, String name, String groupWorkspaceKey);

    Optional<GroupWorkspaceDetail> detail(PlatformExecutionContext context, String groupWorkspaceKey);
}
