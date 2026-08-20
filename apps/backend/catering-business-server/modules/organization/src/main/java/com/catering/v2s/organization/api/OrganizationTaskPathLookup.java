package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Owner-owned task path and scope judgment for workspace-IAM access tasks. */
public interface OrganizationTaskPathLookup {
    TaskPath requireTaskPath(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId);

    /**
     * Resolves the persisted target facts needed solely to authorize an owner status transition. This may include
     * disabled target and ancestry facts so an authorized actor can re-enable them, but it must not be used for
     * ordinary authority, session, candidate, or presentation reads.
     */
    TaskPath requireStatusTransitionTaskPath(
            UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId);

    /**
     * Resolves a task path for the explicitly supported case where the target Store may be disabled. The production
     * implementation keeps organization ancestors enabled-only; this is not a general disabled-tree authority path.
     */
    TaskPath requireTaskPathAllowingDisabledTarget(
            UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId);

    /**
     * One organization-owner command judgment: resolve the persisted target path and decide whether the
     * already-authenticated assignment may act on it. Production implementations must keep both facts in one owner
     * transaction; test doubles must implement the owner API they use.
     */
    default CommandTaskPathFacts commandTaskPathFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String assignmentType,
            UUID assignmentId,
            String targetType,
            UUID targetId,
            boolean statusTransition) {
        TaskPath taskPath = statusTransition
                ? requireStatusTransitionTaskPath(workspaceUuid, groupWorkspaceKey, targetType, targetId)
                : requireTaskPath(workspaceUuid, groupWorkspaceKey, targetType, targetId);
        return new CommandTaskPathFacts(
                taskPath, isScopeAllowed(workspaceUuid, groupWorkspaceKey, assignmentType, assignmentId, taskPath));
    }

    /** One owner judgment for a command whose explicitly supported target may be disabled. */
    default CommandTaskPathFacts commandTaskPathFactsAllowingDisabledTarget(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String assignmentType,
            UUID assignmentId,
            String targetType,
            UUID targetId) {
        TaskPath taskPath = requireTaskPathAllowingDisabledTarget(
                workspaceUuid, groupWorkspaceKey, targetType, targetId);
        return new CommandTaskPathFacts(
                taskPath, isScopeAllowed(workspaceUuid, groupWorkspaceKey, assignmentType, assignmentId, taskPath));
    }

    /**
     * Resolves display and ancestry facts for a bounded set of persisted task targets. This is a display/read API only:
     * it neither grants authority nor replaces {@link #isScopeAllowed(UUID, String, String, UUID, TaskPath)}.
     */
    Map<TaskPathRef, TaskPath> requireTaskPaths(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets);

    /**
     * Resolves display paths for persisted assignment or invitation references, including disabled organization facts.
     * This is presentation-only and must not be used for authority, candidates, or session scope.
     */
    Map<TaskPathRef, TaskPath> describePersistedTaskPaths(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets);

    /**
     * Owner-owned, non-throwing availability read for persisted role assignments. Missing or disabled targets are
     * deliberately absent, so session assembly can discard them without turning one stale assignment into a request
     * failure.
     */
    Set<TaskPathRef> availableTaskTargets(UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets);

    /**
     * Resolves the session-candidate label for a bounded set of enabled task targets. Labels preserve the existing
     * session wording and do not grant authority.
     */
    Map<TaskPathRef, String> describeTaskTargetLabels(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets);

    boolean isScopeAllowed(
            UUID workspaceUuid, String groupWorkspaceKey, String assignmentType, UUID assignmentId, TaskPath target);

    record TaskPath(String targetType, UUID targetId, List<UUID> ancestorIds, String displayPath) {
        public TaskPath {
            ancestorIds = List.copyOf(ancestorIds);
        }
    }

    record TaskPathRef(String targetType, UUID targetId) {}

    record CommandTaskPathFacts(TaskPath taskPath, boolean assignmentScopeAllowed) {}
}
