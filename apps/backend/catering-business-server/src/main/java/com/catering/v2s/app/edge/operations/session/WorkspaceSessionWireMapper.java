package com.catering.v2s.app.edge.operations.session;

import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntry;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntryCandidatesItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntryCandidatesItemNavigationItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntryDataNodeCandidatesItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntrySelected;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntrySelectedNavigationItem;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;

/** Generated-wire boundary for the owner-owned operations session-entry task readback. */
final class WorkspaceSessionWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();
    private WorkspaceSessionWireMapper() { }

    static WorkspaceSessionEntry wire(WorkspaceSessionEntryReadback value, PlatformAssetService assets) {
        return new WorkspaceSessionEntry(value.groupWorkspaceKey(), value.accountId().toString(), value.displayName(), value.workspaceName(), value.operationsTitle(), logoUrl(value.logoAssetRef(), assets), value.contextVersion(), value.mode().name(), value.outcome().name(), value.candidates().stream().map(WorkspaceSessionWireMapper::candidate).toList(), value.actionGrants().stream().sorted().toList(), value.dataNodeCandidates().stream().map(WorkspaceSessionWireMapper::dataNode).toList(), value.selected() == null ? null : selected(value.selected(), value.contextVersion()), value.selectedDataNode() == null ? null : JSON.valueToTree(dataNode(value.selectedDataNode())));
    }

    private static WorkspaceSessionEntryCandidatesItem candidate(WorkspaceSessionEntryReadback.RoleAssignmentCandidate value) {
        return new WorkspaceSessionEntryCandidatesItem(value.roleAssignmentId().toString(), value.roleId().toString(), value.roleName(), value.roleNodeId().toString(), ServiceNodeType.valueOf(value.roleNodeType()), value.roleNodeName(), value.homePageDesignKey(), value.pageDesignKeys(), value.navigation().stream().map(WorkspaceSessionWireMapper::candidateNavigation).toList());
    }
    private static WorkspaceSessionEntrySelected selected(WorkspaceSessionEntryReadback.RoleAssignmentCandidate value, long contextVersion) {
        return new WorkspaceSessionEntrySelected(value.roleAssignmentId().toString(), value.roleId().toString(), value.roleName(), value.roleNodeId().toString(), ServiceNodeType.valueOf(value.roleNodeType()), value.roleNodeName(), value.homePageDesignKey(), value.pageDesignKeys(), value.navigation().stream().map(WorkspaceSessionWireMapper::selectedNavigation).toList(), contextVersion);
    }
    private static WorkspaceSessionEntryCandidatesItemNavigationItem candidateNavigation(WorkspaceSessionEntryReadback.NavigationItem value) {
        return new WorkspaceSessionEntryCandidatesItemNavigationItem(value.pageDesignKey(), value.title(), value.menuGroup(), (long) value.menuOrder(), value.kind(), value.pageAccessManaged(), value.requiredDataNodeType());
    }
    private static WorkspaceSessionEntrySelectedNavigationItem selectedNavigation(WorkspaceSessionEntryReadback.NavigationItem value) {
        return new WorkspaceSessionEntrySelectedNavigationItem(value.pageDesignKey(), value.title(), value.menuGroup(), (long) value.menuOrder(), value.kind(), value.pageAccessManaged(), value.requiredDataNodeType());
    }
    private static WorkspaceSessionEntryDataNodeCandidatesItem dataNode(WorkspaceSessionEntryReadback.VisibleDataNodeCandidate value) {
        return new WorkspaceSessionEntryDataNodeCandidatesItem(ServiceNodeType.valueOf(value.dataNodeType()), value.dataNodeId().toString(), value.dataNodeName(), value.ancestorPath(), nullable(value.regionId()), nullable(value.projectId()), nullable(value.storeId()));
    }
    private static String logoUrl(String assetRef, PlatformAssetService assets) {
        if (assetRef == null) return null;
        try {
            return assets.requireActivePublicReference(UUID.fromString(assetRef)).publicUrl();
        } catch (PlatformAssetService.AssetNotFoundException | IllegalArgumentException ignored) {
            return null;
        }
    }
    private static String nullable(java.util.UUID value) { return value == null ? null : value.toString(); }
}
