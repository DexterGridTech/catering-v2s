package com.catering.v2s.app.edge.platform.organization;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview")
public final class PlatformOrganizationOverviewController {
    private final PlatformSessionResolver sessions; private final WorkspaceAdministrationService workspaces; private final OrganizationOverviewTaskReadService overview;
    public PlatformOrganizationOverviewController(PlatformSessionResolver sessions, WorkspaceAdministrationService workspaces, OrganizationOverviewTaskReadService overview) { this.sessions = sessions; this.workspaces = workspaces; this.overview = overview; }
    @GetMapping OrganizationOverviewTaskReadService.Page page(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam String category, @RequestParam(required = false) String type, @RequestParam(required = false) String name, @RequestParam(required = false) String code, @RequestParam(required = false) String status, @RequestParam(required = false) String source, @RequestParam(required = false) String projectId, @RequestParam(required = false) String brandId, @RequestParam(required = false) String tenantId, @RequestParam(defaultValue = "UPDATED_AT") String sort, @RequestParam(defaultValue = "DESC") String direction, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int pageSize) { sessions.require(request); var workspace = workspaces.requireEnabled(groupWorkspaceKey); return overview.page(workspace.workspaceUuid(), groupWorkspaceKey, category, new OrganizationOverviewTaskReadService.Query(type, name, code, status, source, uuid(projectId), uuid(brandId), uuid(tenantId), sort, direction), page, pageSize); }
    @GetMapping("/hierarchy") OrganizationOverviewTaskReadService.HierarchyTree hierarchy(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) { sessions.require(request); var workspace = workspaces.requireEnabled(groupWorkspaceKey); return overview.hierarchyTree(workspace.workspaceUuid(), groupWorkspaceKey); }
    @GetMapping("/{category}/{itemId}") OrganizationOverviewTaskReadService.Item detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable String category, @PathVariable UUID itemId) { sessions.require(request); var workspace = workspaces.requireEnabled(groupWorkspaceKey); return overview.detail(workspace.workspaceUuid(), groupWorkspaceKey, category, itemId); }
    private static UUID uuid(String value) { if (value == null || value.isBlank()) return null; try { return UUID.fromString(value); } catch (IllegalArgumentException failure) { throw new InvalidEdgeRequestException("invalid overview UUID filter"); } }
}
