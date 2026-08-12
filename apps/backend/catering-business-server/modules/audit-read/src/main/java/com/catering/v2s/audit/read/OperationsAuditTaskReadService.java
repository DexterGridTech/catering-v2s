package com.catering.v2s.audit.read;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.organization.application.OrganizationAuditHistoryService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Closed operations-audit task reader with nine compile-time target branches. */
@Service
public class OperationsAuditTaskReadService {
    private final WorkspaceIamAuditHistoryService workspaceIamAudit;
    private final OrganizationAuditHistoryService organizationAudit;
    private final ContractAuditHistoryService contractAudit;

    public OperationsAuditTaskReadService(
        WorkspaceIamAuditHistoryService workspaceIamAudit,
        OrganizationAuditHistoryService organizationAudit,
        ContractAuditHistoryService contractAudit
    ) {
        this.workspaceIamAudit = Objects.requireNonNull(workspaceIamAudit, "workspaceIamAudit");
        this.organizationAudit = Objects.requireNonNull(organizationAudit, "organizationAudit");
        this.contractAudit = Objects.requireNonNull(contractAudit, "contractAudit");
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(WorkspaceReadAuthorizationFacts facts, OperationsAuditQuery query) {
        Objects.requireNonNull(facts, "facts");
        AuditReadScope scope = new AuditReadScope(facts.workspaceUuid(), facts.groupWorkspaceKey());
        return switch (Objects.requireNonNull(query, "query")) {
            case OperationsAuditQuery.WorkspaceAccount value -> workspaceIamAudit.readOperationsAuditProjection(facts, value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.WorkspaceInvitation value -> workspaceIamAudit.readOperationsAuditProjection(facts, value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.CommercialGroup value -> organizationAudit.readOperationsAuditProjection(scope, facts.assignmentNodeType(), facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.OrganizationNode value -> organizationAudit.readOperationsAuditProjection(scope, facts.assignmentNodeType(), facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.Brand value -> organizationAudit.readOperationsAuditProjection(scope, facts.assignmentNodeType(), facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.Tenant value -> organizationAudit.readOperationsAuditProjection(scope, facts.assignmentNodeType(), facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.HeadCompany value -> organizationAudit.readOperationsAuditProjection(scope, facts.assignmentNodeType(), facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.Store value -> organizationAudit.readOperationsAuditProjection(scope, facts.assignmentNodeType(), facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
            case OperationsAuditQuery.StoreContract value -> contractAudit.readOperationsAuditProjection(scope, facts.visibleOrganizationFacts(), value.target(), value.page(), value.pageSize());
        };
    }

    /** Each variant fixes the wire entity type at compile time; no operation-id dispatch is used. */
    public sealed interface OperationsAuditQuery permits OperationsAuditQuery.WorkspaceAccount, OperationsAuditQuery.WorkspaceInvitation, OperationsAuditQuery.CommercialGroup, OperationsAuditQuery.OrganizationNode, OperationsAuditQuery.Brand, OperationsAuditQuery.Tenant, OperationsAuditQuery.HeadCompany, OperationsAuditQuery.Store, OperationsAuditQuery.StoreContract {
        AuditTarget target();
        long page();
        long pageSize();
        record WorkspaceAccount(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public WorkspaceAccount { type(target, "WORKSPACE_ACCOUNT"); } }
        record WorkspaceInvitation(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public WorkspaceInvitation { type(target, "WORKSPACE_INVITATION"); } }
        record CommercialGroup(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public CommercialGroup { type(target, "COMMERCIAL_GROUP"); } }
        record OrganizationNode(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public OrganizationNode { type(target, "ORGANIZATION_NODE"); } }
        record Brand(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public Brand { type(target, "BRAND"); } }
        record Tenant(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public Tenant { type(target, "TENANT"); } }
        record HeadCompany(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public HeadCompany { type(target, "HEAD_COMPANY"); } }
        record Store(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public Store { type(target, "STORE"); } }
        record StoreContract(AuditTarget target, long page, long pageSize) implements OperationsAuditQuery { public StoreContract { type(target, "STORE_CONTRACT"); } }
        private static void type(AuditTarget target, String expected) {
            if (target == null || !expected.equals(target.entityType())) throw new IllegalArgumentException("unsupported operations audit target");
        }
    }
}
