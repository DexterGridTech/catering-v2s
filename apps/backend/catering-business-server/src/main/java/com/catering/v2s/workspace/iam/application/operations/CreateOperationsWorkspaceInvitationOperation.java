package com.catering.v2s.workspace.iam.application.operations;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Thin edge adapter shared by the five workspace-invitation create operations. */
@Component
public class CreateOperationsWorkspaceInvitationOperation {
    private final WorkspaceOperationsCommandApi commands;

    public CreateOperationsWorkspaceInvitationOperation(WorkspaceOperationsCommandApi commands) {
        this.commands = commands;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public WorkspaceInvitationService.ManagementInvitationView execute(
            WorkspaceCommandAuthorizationFacts facts,
            String expectedTargetType,
            WorkspaceOperationsInvitationCreateRequest request,
            AuditActor actor) {
        return commands.createInvitation(new WorkspaceOperationsCommandApi.InvitationCreateCommand(
                facts,
                expectedTargetType,
                request.scopeRef(),
                request.mobile(),
                request.roleIds().stream().map(UUID::fromString).toList(),
                request.idempotencyKey(),
                actor));
    }
}
