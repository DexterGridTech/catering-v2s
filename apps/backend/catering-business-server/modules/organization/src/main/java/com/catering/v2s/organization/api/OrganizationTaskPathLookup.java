package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Owner-owned task path and scope judgment for workspace-IAM access tasks. */
public interface OrganizationTaskPathLookup {
    TaskPath requireTaskPath(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId);

    /**
     * Resolves the persisted target facts needed solely to authorize an owner status transition.
     * This may include disabled target and ancestry facts so an authorized actor can re-enable
     * them, but it must not be used for ordinary authority, session, candidate, or presentation reads.
     */
    default TaskPath requireStatusTransitionTaskPath(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
        throw new UnsupportedOperationException("status-transition task paths are not provided by this test double");
    }

    /**
     * Resolves display and ancestry facts for a bounded set of persisted task targets.
     * This is a display/read API only: it neither grants authority nor replaces
     * {@link #isScopeAllowed(UUID, String, String, UUID, TaskPath)}.
     */
    default Map<TaskPathRef, TaskPath> requireTaskPaths(UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("batch task paths are not provided by this test double");
    }

    /**
     * Resolves display paths for persisted assignment or invitation references, including
     * disabled organization facts. This is presentation-only and must not be used for
     * authority, candidates, or session scope.
     */
    default Map<TaskPathRef, TaskPath> describePersistedTaskPaths(UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("persisted task path display is not provided by this test double");
    }

    /**
     * Owner-owned, non-throwing availability read for persisted role assignments.
     * Missing or disabled targets are deliberately absent, so session assembly can
     * discard them without turning one stale assignment into a request failure.
     */
    default Set<TaskPathRef> availableTaskTargets(UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("batch task availability is not provided by this test double");
    }

    /**
     * Resolves the session-candidate label for a bounded set of enabled task targets.
     * Labels preserve the existing session wording and do not grant authority.
     */
    default Map<TaskPathRef, String> describeTaskTargetLabels(UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        throw new UnsupportedOperationException("batch task labels are not provided by this test double");
    }

    boolean isScopeAllowed(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String assignmentType,
        UUID assignmentId,
        TaskPath target
    );

    record TaskPath(String targetType, UUID targetId, List<UUID> ancestorIds, String displayPath) {
        public TaskPath {
            ancestorIds = List.copyOf(ancestorIds);
        }
    }

    record TaskPathRef(String targetType, UUID targetId) { }
}
