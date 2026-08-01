package com.catering.v2s.app.edge.platform.audit;

import com.catering.v2s.app.edge.generated.wire.AuditHistoryPage;
import com.catering.v2s.app.edge.audit.AuditHistoryWireMapper;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceAuditHistoryService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.platform.iam.application.PlatformIamAuditHistoryService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import com.catering.v2s.extension.application.ExtensionAuditHistoryService;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform audit edge: authorization is resolved before dispatching the owner task read. */
@RestController
@RequestMapping("/api/platform/audit-history")
public final class PlatformAuditHistoryController {
    private final PlatformSessionResolver sessions;
    private final PlatformWorkspaceAuditHistoryService groupWorkspaceAudit;
    private final WorkspaceAdministrationService workspaces;
    private final PlatformIamAuditHistoryService platformIamAudit;
    private final WorkspaceIamAuditHistoryService workspaceIamAudit;
    private final ExtensionAuditHistoryService extensionAudit;
    private final ContractAuditHistoryService contractAudit;

    public PlatformAuditHistoryController(PlatformSessionResolver sessions, PlatformWorkspaceAuditHistoryService groupWorkspaceAudit, WorkspaceAdministrationService workspaces, PlatformIamAuditHistoryService platformIamAudit, WorkspaceIamAuditHistoryService workspaceIamAudit, ExtensionAuditHistoryService extensionAudit, ContractAuditHistoryService contractAudit) {
        this.sessions = sessions;
        this.groupWorkspaceAudit = groupWorkspaceAudit;
        this.workspaces = workspaces;
        this.platformIamAudit = platformIamAudit;
        this.workspaceIamAudit = workspaceIamAudit;
        this.extensionAudit = extensionAudit;
        this.contractAudit = contractAudit;
    }

    @GetMapping
    AuditHistoryPage history(EdgeRequestContext request, @RequestParam(required = false) String groupWorkspaceKey, @RequestParam String entityType, @RequestParam String entityId, @RequestParam(defaultValue = "1") long page, @RequestParam(defaultValue = "20") long pageSize) {
        sessions.require(request);
        var target = new com.catering.v2s.audit.contract.AuditTarget(entityType, entityId);
        var result = switch (entityType) {
            case "GROUP_WORKSPACE" -> groupWorkspaceAudit.readGroupWorkspace(scope(entityId), target, page, pageSize);
            case "PLATFORM_ADMIN" -> platformIamAudit.read(target, page, pageSize);
            case "WORKSPACE_ROLE", "WORKSPACE_ACCOUNT" -> workspaceIamAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey), target, page, pageSize);
            case "EXTENSION_DEFINITION" -> extensionAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey), target, page, pageSize);
            case "STORE_CONTRACT" -> contractAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey), target, page, pageSize);
            default -> throw new InvalidEdgeRequestException("unsupported platform audit target");
        };
        return AuditHistoryWireMapper.page(result);
    }

    private AuditReadScope scope(String groupWorkspaceKey) {
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        return new AuditReadScope(workspace.workspaceUuid(), workspace.groupWorkspaceKey());
    }
    private AuditReadScope scopeForWorkspaceTarget(String groupWorkspaceKey) {
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank()) throw new InvalidEdgeRequestException("audit host target requires group workspace key");
        return scope(groupWorkspaceKey);
    }
}
