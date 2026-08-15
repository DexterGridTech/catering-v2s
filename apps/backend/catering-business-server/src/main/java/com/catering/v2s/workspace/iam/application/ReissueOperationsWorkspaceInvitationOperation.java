package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Thin edge adapter shared by the five workspace-invitation reissue operations. */
@Component
public class ReissueOperationsWorkspaceInvitationOperation {
    private final WorkspaceOperationsCommandApi commands;

    public ReissueOperationsWorkspaceInvitationOperation(WorkspaceOperationsCommandApi commands) {
        this.commands = commands;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public WorkspaceInvitationService.ManagementInvitationView execute(
        WorkspaceCommandAuthorizationFacts facts,
        String expectedTargetType,
        UUID invitationId,
        WorkspaceOperationsInvitationActionRequest request,
        AuditActor actor
    ) {
        return commands.reissueInvitation(new WorkspaceOperationsCommandApi.InvitationActionCommand(
            facts,
            expectedTargetType,
            request.scopeRef(),
            invitationId,
            request.expectedVersion(),
            request.idempotencyKey(),
            actor
        ));
    }
}
