package com.catering.v2s.app.edge.operations.session;

import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;

import com.catering.v2s.app.edge.catalog.WorkspaceSessionState;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceLoginEntry;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityOperation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;

/** Public pre-login workspace readback; it does not create or recover a session. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry")
public final class OperationsWorkspaceLoginEntryController {
    private final WorkspaceAdministrationService workspaces;
    private final OperationsSessionResolver sessionResolver;
    private final PlatformAssetService assets;

    public OperationsWorkspaceLoginEntryController(WorkspaceAdministrationService workspaces, WorkspaceAuthenticationService sessions, OperationsSessionResolver sessionResolver, PlatformAssetService assets) {
        this.workspaces = workspaces;
        this.sessionResolver = sessionResolver;
        this.assets = assets;
    }

    @GetMapping
    @PublicSecurityOperation(id = "getOperationsWorkspaceLoginEntry", owner = "workspace-iam")
    WorkspaceLoginEntry entry(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) {
        var workspace = workspaces.require(groupWorkspaceKey);
        String state = sessionState(request, groupWorkspaceKey);
        return new WorkspaceLoginEntry(workspace.groupWorkspaceKey(), workspace.name(), workspace.operationsTitle(), GroupWorkspaceStatus.valueOf(workspace.status()), state, logoUrl(workspace.logoAssetRef()));
    }

    private String sessionState(EdgeRequestContext request, String groupWorkspaceKey) {
        try {
            return sessionResolver.tokenIfPresent(request)
                .map(ignored -> groupWorkspaceKey.equals(sessionResolver.requireWorkspace(request, groupWorkspaceKey).groupWorkspaceKey()) ? WorkspaceSessionState.AUTHENTICATED.wire() : WorkspaceSessionState.NONE.wire())
                .orElse(WorkspaceSessionState.NONE.wire());
        } catch (WorkspaceAuthenticationService.SessionInvalidException | WorkspaceAuthenticationService.PasswordChangeRequiredException ignored) {
            return WorkspaceSessionState.NONE.wire();
        }
    }

    private String logoUrl(String assetRef) {
        if (assetRef == null) return null;
        try {
            return assets.requireActivePublicReference(UUID.fromString(assetRef)).publicUrl();
        } catch (PlatformAssetService.AssetNotFoundException | IllegalArgumentException ignored) {
            return null;
        }
    }

}
