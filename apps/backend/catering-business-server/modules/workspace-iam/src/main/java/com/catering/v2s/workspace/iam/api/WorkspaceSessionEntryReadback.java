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
    ScopeContext scopeContext
) {
    public enum Mode { DIRECT, SELECT, EMPTY }
    public enum Outcome { HOME, SELECT_IDENTITY, SELECT_SCOPE, EMPTY_WORKBENCH, PASSWORD_CHANGE_REQUIRED }

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
        String dataNodeCode,
        List<String> ancestorPath,
        UUID regionId,
        UUID projectId,
        UUID storeId,
        UUID headCompanyId
    ) { }

    /** Persisted owner-confirmed selections; the selector never supplies authorization truth. */
    public record ScopeContext(
        VisibleDataNodeCandidate region,
        VisibleDataNodeCandidate project,
        VisibleDataNodeCandidate store,
        VisibleDataNodeCandidate headCompany
    ) {
        public static ScopeContext empty() { return new ScopeContext(null, null, null, null); }

        public VisibleDataNodeCandidate selectionFor(String requiredDataNodeType) {
            return switch (requiredDataNodeType) {
                case "REGION" -> region;
                case "PROJECT" -> project;
                case "STORE" -> store;
                case "HEAD_COMPANY" -> headCompany;
                default -> null;
            };
        }
    }
}
