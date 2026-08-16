package com.catering.v2s.app.edge.operations.session;

import com.catering.v2s.app.edge.generated.wire.WorkspaceScopeContext;
import com.catering.v2s.app.edge.generated.wire.WorkspaceScopeNode;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntry;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntryCandidatesItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntryCandidatesItemNavigationItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntrySelected;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntrySelectedNavigationItem;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import java.util.UUID;

/** Generated-wire boundary for the owner-owned operations session-entry task readback. */
final class WorkspaceSessionWireMapper {
    private WorkspaceSessionWireMapper() {}

    static WorkspaceSessionEntry wire(WorkspaceSessionEntryReadback value, PlatformAssetService assets) {
        return new WorkspaceSessionEntry(
                value.groupWorkspaceKey(),
                value.accountId().toString(),
                value.displayName(),
                value.contextVersion(),
                value.mode().name(),
                value.outcome().name(),
                value.candidates().stream()
                        .map(WorkspaceSessionWireMapper::candidate)
                        .toList(),
                value.actionGrants().stream().sorted().toList(),
                value.dataNodeCandidates().stream()
                        .map(WorkspaceSessionWireMapper::dataNode)
                        .toList(),
                value.selected() == null ? null : selected(value.selected(), value.contextVersion()),
                scopeContext(value.scopeContext()),
                value.workspaceName(),
                value.operationsTitle(),
                logoUrl(value.logoAssetRef(), assets));
    }

    private static WorkspaceSessionEntryCandidatesItem candidate(
            WorkspaceSessionEntryReadback.RoleAssignmentCandidate value) {
        return new WorkspaceSessionEntryCandidatesItem(
                value.roleAssignmentId(),
                value.roleId().toString(),
                value.roleName(),
                value.roleNodeId(),
                value.roleNodeType(),
                value.roleNodeName(),
                value.homePageDesignKey(),
                value.pageDesignKeys(),
                value.navigation().stream()
                        .map(WorkspaceSessionWireMapper::candidateNavigation)
                        .toList());
    }

    private static WorkspaceSessionEntrySelected selected(
            WorkspaceSessionEntryReadback.RoleAssignmentCandidate value, long contextVersion) {
        return new WorkspaceSessionEntrySelected(
                value.roleAssignmentId(),
                value.roleId().toString(),
                value.roleName(),
                value.roleNodeId(),
                value.roleNodeType(),
                value.roleNodeName(),
                value.homePageDesignKey(),
                value.pageDesignKeys(),
                value.navigation().stream()
                        .map(WorkspaceSessionWireMapper::selectedNavigation)
                        .toList(),
                contextVersion);
    }

    private static WorkspaceSessionEntryCandidatesItemNavigationItem candidateNavigation(
            WorkspaceSessionEntryReadback.NavigationItem value) {
        return new WorkspaceSessionEntryCandidatesItemNavigationItem(
                value.pageDesignKey(),
                value.title(),
                value.menuGroup(),
                (long) value.menuOrder(),
                value.kind(),
                value.pageAccessManaged(),
                value.requiredDataNodeType());
    }

    private static WorkspaceSessionEntrySelectedNavigationItem selectedNavigation(
            WorkspaceSessionEntryReadback.NavigationItem value) {
        return new WorkspaceSessionEntrySelectedNavigationItem(
                value.pageDesignKey(),
                value.title(),
                value.menuGroup(),
                (long) value.menuOrder(),
                value.kind(),
                value.pageAccessManaged(),
                value.requiredDataNodeType());
    }

    private static WorkspaceScopeContext scopeContext(WorkspaceSessionEntryReadback.ScopeContext value) {
        return value == null
                ? null
                : new WorkspaceScopeContext(
                        dataNode(value.region()),
                        dataNode(value.project()),
                        dataNode(value.store()),
                        dataNode(value.headCompany()));
    }

    private static WorkspaceScopeNode dataNode(WorkspaceSessionEntryReadback.VisibleDataNodeCandidate value) {
        return value == null
                ? null
                : new WorkspaceScopeNode(
                        value.dataNodeType(),
                        value.dataNodeId(),
                        value.dataNodeName(),
                        value.dataNodeCode(),
                        value.ancestorPath(),
                        nullable(value.regionId()),
                        nullable(value.projectId()),
                        nullable(value.storeId()),
                        nullable(value.headCompanyId()));
    }

    private static String logoUrl(String assetRef, PlatformAssetService assets) {
        if (assetRef == null) return null;
        try {
            return assets.requireActivePublicReference(UUID.fromString(assetRef))
                    .publicUrl();
        } catch (PlatformAssetService.AssetNotFoundException | IllegalArgumentException ignored) {
            return null;
        }
    }

    private static java.util.UUID nullable(java.util.UUID value) {
        return value;
    }
}
