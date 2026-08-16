package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

abstract class WorkspaceTestTaskPathLookup implements OrganizationTaskPathLookup {
    @Override
    public TaskPath requireStatusTransitionTaskPath(
            UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
        throw new UnsupportedOperationException("status-transition task paths are not used by this test double");
    }

    @Override
    public Map<TaskPathRef, TaskPath> requireTaskPaths(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("batch task paths are not used by this test double");
    }

    @Override
    public Map<TaskPathRef, TaskPath> describePersistedTaskPaths(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("persisted task path display is not used by this test double");
    }

    @Override
    public Set<TaskPathRef> availableTaskTargets(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("batch task availability is not used by this test double");
    }

    @Override
    public Map<TaskPathRef, String> describeTaskTargetLabels(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("batch task labels are not used by this test double");
    }
}
