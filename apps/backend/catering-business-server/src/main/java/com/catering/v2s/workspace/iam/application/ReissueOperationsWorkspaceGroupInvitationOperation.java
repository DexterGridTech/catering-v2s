package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component public class ReissueOperationsWorkspaceGroupInvitationOperation {
    public static final String OPERATION_ID = "reissueOperationsWorkspaceGroupInvitation";
    private final WorkspaceOperationsCommandApi commands;
    public ReissueOperationsWorkspaceGroupInvitationOperation(WorkspaceOperationsCommandApi commands) { this.commands = commands; }
    @Transactional(propagation = Propagation.REQUIRED) public WorkspaceInvitationService.ManagementInvitationView execute(WorkspaceCommandAuthorizationFacts facts, UUID invitationId, WorkspaceOperationsInvitationActionRequest request, AuditActor actor) { return commands.reissueInvitation(new WorkspaceOperationsCommandApi.InvitationActionCommand(facts, ServiceNodeTypes.GROUP, uuid(request.scopeRef()), invitationId, request.expectedVersion(), request.idempotencyKey(), actor)); }
    private static UUID uuid(String value) { return value == null || value.isBlank() ? null : UUID.fromString(value); }
}
