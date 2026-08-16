package com.catering.v2s.workspace.iam.application.operations;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Thin edge adapter shared by the five workspace-invitation cancel operations. */
@Component
public class CancelOperationsWorkspaceInvitationOperation {
    private final WorkspaceOperationsCommandApi commands;

    public CancelOperationsWorkspaceInvitationOperation(WorkspaceOperationsCommandApi commands) {
        this.commands = commands;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public WorkspaceInvitationService.ManagementInvitationView execute(
            WorkspaceCommandAuthorizationFacts facts,
            String expectedTargetType,
            UUID invitationId,
            WorkspaceOperationsInvitationActionRequest request,
            AuditActor actor) {
        return commands.cancelInvitation(new WorkspaceOperationsCommandApi.InvitationActionCommand(
                facts,
                expectedTargetType,
                request.scopeRef(),
                invitationId,
                request.expectedVersion(),
                request.idempotencyKey(),
                actor));
    }
}
