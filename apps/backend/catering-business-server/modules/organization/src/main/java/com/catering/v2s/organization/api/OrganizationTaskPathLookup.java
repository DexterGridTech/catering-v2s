package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Owner-owned task path and scope judgment for workspace-IAM access tasks. */
public interface OrganizationTaskPathLookup {
    /** One owner read for the logical group root, including its opaque ref and display path. */
    default TaskPath requireGroupTaskPath(UUID workspaceUuid, String groupWorkspaceKey) {
        throw new UnsupportedOperationException("group task path lookup is not implemented by this owner");
    }

    TaskPath requireTaskPath(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId);

    /**
     * One bounded command projection for Store operations. It returns the Store's current immutable references together
     * with the enabled Project task path; command owners still re-read and validate the Store in their own transaction.
     */
    default StoreProjectCommandFacts requireStoreProjectCommandFacts(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        throw new UnsupportedOperationException("store project command facts are not implemented by this owner");
    }

    /**
     * One bounded owner read for the Store refs used by a command. The returned map contains every requested ref;
     * missing or out-of-scope organization facts fail closed in the owner implementation. Store status is deliberately
     * excluded: template saves may retain a VOIDED relation and the business-channel owner applies the separate
     * ENABLED-only gate when creating a new Store channel.
     */
    default Map<UUID, UUID> requireStoreProjectMemberships(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> storeIds) {
        throw new UnsupportedOperationException("store project membership lookup is not implemented by this owner");
    }

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
        TaskPath taskPath =
                requireTaskPathAllowingDisabledTarget(workspaceUuid, groupWorkspaceKey, targetType, targetId);
        return new CommandTaskPathFacts(
                taskPath, isScopeAllowed(workspaceUuid, groupWorkspaceKey, assignmentType, assignmentId, taskPath));
    }

    /**
     * One organization-owner projection for a catalog command. It combines the enabled target path with the persisted
     * catalog-brand judgment so a command does not read the same Store or Head Company once for scope and again for
     * brand selection. The caller still performs capability judgment and the catalog owner still rechecks its write
     * invariant in the command transaction.
     */
    default CatalogCommandScopeFacts resolveCatalogCommandScopeFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetType,
            UUID targetId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        throw new UnsupportedOperationException("catalog command scope facts are not implemented by this owner");
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
     * Bounded presentation read for immutable Store refs already persisted on an owner record. Only Stores still in
     * the selected Project are returned; missing, moved, and out-of-scope refs remain absent for the caller to render
     * as an unknown persisted reference without revealing another Project's facts.
     */
    default Map<UUID, PersistedStoreFact> describePersistedStoresInProject(
            UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, List<UUID> storeRefs) {
        throw new UnsupportedOperationException("persisted project store facts are not implemented by this owner");
    }

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

    /**
     * Invocation-local session composition facts. Production owners should load availability and labels from the same
     * owner read pass; this fact must not be cached across requests and does not replace command-time rechecks.
     */
    default SessionTaskTargetFacts sessionTaskTargetFacts(
            UUID workspaceUuid, String groupWorkspaceKey, List<TaskPathRef> targets) {
        return new SessionTaskTargetFacts(
                availableTaskTargets(workspaceUuid, groupWorkspaceKey, targets),
                describeTaskTargetLabels(workspaceUuid, groupWorkspaceKey, targets));
    }

    boolean isScopeAllowed(
            UUID workspaceUuid, String groupWorkspaceKey, String assignmentType, UUID assignmentId, TaskPath target);

    /**
     * Pure judgment over an organization-owned path that has already been loaded in this request. The path remains an
     * owner fact; this helper only prevents a second transaction from re-reading the same path when a capability
     * resolver consumes it. Command owners still re-check the persisted target in their own transaction.
     */
    static boolean scopeAllows(String assignmentType, UUID assignmentId, TaskPath target) {
        if (assignmentType == null
                || assignmentId == null
                || target == null
                || target.ancestorIds().isEmpty()
                || !target.ancestorIds().contains(target.targetId())) return false;
        return switch (assignmentType) {
            case "GROUP", "REGION", "PROJECT" -> target.ancestorIds().contains(assignmentId);
            case "HEAD_COMPANY", "STORE" -> assignmentType.equals(target.targetType())
                    && assignmentId.equals(target.targetId());
            default -> false;
        };
    }

    record TaskPath(
            String targetType, UUID targetId, List<UUID> ancestorIds, String displayPath, List<TaskPathNode> nodes) {
        public TaskPath {
            ancestorIds = List.copyOf(ancestorIds);
            nodes = List.copyOf(nodes);
        }

        /** Legacy owner call sites keep their existing display projection until their consumer is migrated. */
        public TaskPath(String targetType, UUID targetId, List<UUID> ancestorIds, String displayPath) {
            this(targetType, targetId, ancestorIds, displayPath, List.of());
        }
    }

    /** One organization-owned node fact; presentation layers choose labels and separators. */
    record TaskPathNode(UUID ref, String code, String name, String nodeType) {}

    record TaskPathRef(String targetType, UUID targetId) {}

    record PersistedStoreFact(UUID storeRef, String code, String name, String status) {}

    record CommandTaskPathFacts(TaskPath taskPath, boolean assignmentScopeAllowed) {}

    record CatalogCommandScopeFacts(TaskPath taskPath, CatalogScopeLookup.CatalogBrandJudgment brandJudgment) {}

    record StoreProjectCommandFacts(UUID projectId, UUID tenantId, UUID brandId, String code, TaskPath taskPath) {}

    record SessionTaskTargetFacts(Set<TaskPathRef> availableTargets, Map<TaskPathRef, String> labels) {
        public SessionTaskTargetFacts {
            availableTargets = Set.copyOf(availableTargets);
            labels = Map.copyOf(labels);
        }
    }
}
