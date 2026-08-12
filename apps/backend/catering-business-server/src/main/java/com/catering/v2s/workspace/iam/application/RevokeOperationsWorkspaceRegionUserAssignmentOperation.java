package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.app.edge.generated.wire.WorkspaceUserRevokeRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component public class RevokeOperationsWorkspaceRegionUserAssignmentOperation {
    public static final String OPERATION_ID = "revokeOperationsWorkspaceRegionUserAssignment";
    private final WorkspaceOperationsCommandApi commands;
    public RevokeOperationsWorkspaceRegionUserAssignmentOperation(WorkspaceOperationsCommandApi commands) { this.commands = commands; }
    @Transactional(propagation = Propagation.REQUIRED) public WorkspaceOperationsCommandApi.OperationsAssignmentRevokeReadback execute(WorkspaceCommandAuthorizationFacts facts, UUID assignmentId, WorkspaceUserRevokeRequest request, String idempotencyKey, AuditActor actor) { return commands.revokeAssignment(new WorkspaceOperationsCommandApi.AssignmentRevokeCommand(facts, ServiceNodeTypes.REGION, assignmentId, request.expectedVersion(), idempotencyKey, actor)); }
}
