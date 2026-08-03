package com.catering.v2s.app.edge.platform.contract;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform-only read surface; contract task reads remain owned by contract. */
@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview")
public final class PlatformContractOverviewController {
    private final PlatformSessionResolver sessions;
    private final ContractTaskReadService reads;
    private final WorkspaceAdministrationService workspaces;

    public PlatformContractOverviewController(PlatformSessionResolver sessions, ContractTaskReadService reads, WorkspaceAdministrationService workspaces) { this.sessions = sessions; this.reads = reads; this.workspaces = workspaces; }

    @GetMapping ContractTaskReadService.PlatformOverviewPage page(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam(required = false) UUID projectId, @RequestParam(required = false) UUID storeId, @RequestParam(required = false) String contractNo, @RequestParam(required = false) String phaseName, @RequestParam(required = false) String tenantName, @RequestParam(required = false) String status, @RequestParam(defaultValue = "UPDATED_AT") String sort, @RequestParam(defaultValue = "DESC") String direction, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int pageSize) {
        sessions.require(request); UUID workspaceUuid = workspaces.requireEnabled(groupWorkspaceKey).workspaceUuid(); return reads.platformOverview(workspaceUuid, groupWorkspaceKey, projectId, storeId, contractNo, phaseName, tenantName, status, sort, direction, page, pageSize);
    }

    @GetMapping("/{contractId}") ContractTaskReadService.PlatformOverviewItem detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID contractId) {
        sessions.require(request); return reads.platformDetail(workspaces.requireEnabled(groupWorkspaceKey).workspaceUuid(), groupWorkspaceKey, contractId);
    }

}
