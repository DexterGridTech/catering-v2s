package com.catering.v2s.app.edge.operations.audit;

import com.catering.v2s.app.edge.audit.AuditHistoryWireMapper;
import com.catering.v2s.app.edge.generated.wire.AuditHistoryPage;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.application.OrganizationAuditHistoryService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuditAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations audit edge inherits the active workspace session and dispatches only to owner task readers. */
@RestController
@RequestMapping("/api/operations/audit-history")
public final class OperationsAuditHistoryController {
    private final OperationsSessionResolver sessions;
    private final WorkspaceIamAuditHistoryService workspaceIamAudit;
    private final OrganizationAuditHistoryService organizationAudit;
    private final ContractAuditHistoryService contractAudit;
    private final WorkspaceAuditAuthorizationService authorization;
    private final OrganizationOverviewTaskReadService organizationOverview;
    private final ContractTaskReadService contractReads;

    public OperationsAuditHistoryController(
        OperationsSessionResolver sessions,
        WorkspaceIamAuditHistoryService workspaceIamAudit,
        OrganizationAuditHistoryService organizationAudit,
        ContractAuditHistoryService contractAudit,
        WorkspaceAuditAuthorizationService authorization,
        OrganizationOverviewTaskReadService organizationOverview,
        ContractTaskReadService contractReads
    ) {
        this.sessions = sessions;
        this.workspaceIamAudit = workspaceIamAudit;
        this.organizationAudit = organizationAudit;
        this.contractAudit = contractAudit;
        this.authorization = authorization;
        this.organizationOverview = organizationOverview;
        this.contractReads = contractReads;
    }

    @GetMapping
    AuditHistoryPage history(EdgeRequestContext request, @RequestParam String groupWorkspaceKey, @RequestParam String entityType, @RequestParam String entityId, @RequestParam(defaultValue = "1") long page, @RequestParam(defaultValue = "20") long pageSize) {
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        var scope = new AuditReadScope(session.workspaceUuid(), session.groupWorkspaceKey());
        var target = new AuditTarget(entityType, entityId);
        requireHostAuthorization(session, entityType, entityId);
        var result = switch (entityType) {
            case "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION" -> workspaceIamAudit.read(scope, target, page, pageSize);
            case "COMMERCIAL_GROUP" -> organizationAudit.readCommercialGroup(scope, target, page, pageSize);
            case "ORGANIZATION_NODE", "BRAND", "TENANT", "HEAD_COMPANY", "STORE" -> organizationAudit.read(scope, target, page, pageSize);
            case "STORE_CONTRACT" -> contractAudit.read(scope, target, page, pageSize);
            default -> throw new InvalidEdgeRequestException("unsupported operations audit target");
        };
        return AuditHistoryWireMapper.page(result);
    }

    private void requireHostAuthorization(
        com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
        String entityType,
        String entityId
    ) {
        UUID id = uuid(entityId);
        switch (entityType) {
            case "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION" ->
                authorization.requireWorkspaceSubject(session, entityType, id);
            case "COMMERCIAL_GROUP" -> authorization.requireGroupHost(session);
            case "ORGANIZATION_NODE" -> {
                var item = organizationOverview.detail(
                    session.workspaceUuid(), session.groupWorkspaceKey(), "HIERARCHY", id
                );
                authorization.requireScopedHost(session, item.type(), item.id());
            }
            case "BRAND" -> requireGroupEntity(session, "BRAND", id);
            case "TENANT" -> requireGroupEntity(session, "TENANT", id);
            case "HEAD_COMPANY" -> requireScopedEntity(session, "HEAD_COMPANY", id);
            case "STORE" -> {
                var item = organizationOverview.detail(
                    session.workspaceUuid(), session.groupWorkspaceKey(), "STORE", id
                );
                authorization.requireScopedHost(session, "PROJECT", item.project().id());
            }
            case "STORE_CONTRACT" -> {
                var contract = contractReads.view(
                    session.workspaceUuid(), session.groupWorkspaceKey(), id
                );
                authorization.requireScopedHost(session, "PROJECT", contract.project().id());
            }
            default -> throw new InvalidEdgeRequestException("unsupported operations audit target");
        }
    }

    private void requireGroupEntity(
        com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
        String entityType,
        UUID id
    ) {
        var item = organizationOverview.detail(
            session.workspaceUuid(), session.groupWorkspaceKey(), "BUSINESS_ENTITY", id
        );
        if (!entityType.equals(item.type())) {
            throw new InvalidEdgeRequestException("audit target type does not match host entity");
        }
        authorization.requireGroupHost(session);
    }

    private void requireScopedEntity(
        com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
        String entityType,
        UUID id
    ) {
        var item = organizationOverview.detail(
            session.workspaceUuid(), session.groupWorkspaceKey(), "BUSINESS_ENTITY", id
        );
        if (!entityType.equals(item.type())) {
            throw new InvalidEdgeRequestException("audit target type does not match host entity");
        }
        authorization.requireScopedHost(session, entityType, id);
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException invalid) {
            throw new InvalidEdgeRequestException("audit target identifier is invalid");
        }
    }
}
