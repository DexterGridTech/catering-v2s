package com.catering.v2s.workspace.iam.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.UUID;

/**
 * Module-public operations command boundary for invitation and assignment management.
 *
 * <p>The command facts are minted once at the authenticated edge. This owner resolves command target/scope, repeats the
 * capability check before receipt replay, and returns the required final owner readback in the same REQUIRED
 * transaction. Callers must never pass a pre-resolved target, scope or arbitrary operation selector.
 */
public interface WorkspaceOperationsCommandApi {
    WorkspaceInvitationService.ManagementInvitationView createInvitation(InvitationCreateCommand command);

    WorkspaceInvitationService.ManagementInvitationView cancelInvitation(InvitationActionCommand command);

    WorkspaceInvitationService.ManagementInvitationView reissueInvitation(InvitationActionCommand command);

    OperationsAssignmentRevokeReadback revokeAssignment(AssignmentRevokeCommand command);

    record InvitationCreateCommand(
            WorkspaceCommandAuthorizationFacts facts,
            String expectedTargetType,
            UUID requestedScopeRef,
            String mobile,
            List<UUID> roleIds,
            String idempotencyKey,
            AuditActor actor) {
        public InvitationCreateCommand {
            roleIds = roleIds == null ? List.of() : List.copyOf(roleIds);
        }
    }

    record InvitationActionCommand(
            WorkspaceCommandAuthorizationFacts facts,
            String expectedTargetType,
            UUID requestedScopeRef,
            UUID invitationId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {}

    record AssignmentRevokeCommand(
            WorkspaceCommandAuthorizationFacts facts,
            String expectedTargetType,
            UUID assignmentId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {}

    record OperationsAssignmentRevokeReadback(
            UUID assignmentId, UUID accountId, long contextVersion, WorkspaceUserService.User user) {}
}
