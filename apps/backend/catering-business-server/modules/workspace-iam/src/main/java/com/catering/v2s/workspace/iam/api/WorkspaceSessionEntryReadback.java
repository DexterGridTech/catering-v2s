package com.catering.v2s.workspace.iam.api;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Owner-owned authenticated-entry task readback. Edge consumers map this to their generated wire. */
public record WorkspaceSessionEntryReadback(
    String groupWorkspaceKey,
    UUID accountId,
    String displayName,
    String workspaceName,
    String operationsTitle,
    String logoAssetRef,
    long contextVersion,
    Mode mode,
    Outcome outcome,
    List<RoleAssignmentCandidate> candidates,
    Set<String> actionGrants,
    List<VisibleDataNodeCandidate> dataNodeCandidates,
    RoleAssignmentCandidate selected,
    VisibleDataNodeCandidate selectedDataNode
) {
    public enum Mode { DIRECT, SELECT, EMPTY }
    public enum Outcome { HOME, SELECT_IDENTITY, SELECT_SCOPE, EMPTY_WORKBENCH }

    public record RoleAssignmentCandidate(
        UUID roleAssignmentId,
        UUID roleId,
        String roleName,
        UUID roleNodeId,
        String roleNodeType,
        String roleNodeName,
        String homePageDesignKey,
        List<String> pageDesignKeys,
        List<NavigationItem> navigation,
        Set<String> actionGrants
    ) { }

    public record NavigationItem(
        String pageDesignKey,
        String title,
        String menuGroup,
        int menuOrder,
        String kind,
        boolean pageAccessManaged,
        String requiredDataNodeType
    ) { }

    public record VisibleDataNodeCandidate(
        String dataNodeType,
        UUID dataNodeId,
        String dataNodeName,
        List<String> ancestorPath,
        UUID regionId,
        UUID projectId,
        UUID storeId
    ) { }
}
