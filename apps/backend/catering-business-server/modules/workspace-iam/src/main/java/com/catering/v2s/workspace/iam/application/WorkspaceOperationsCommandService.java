package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owner-native operations command implementation. It deliberately receives command facts, not a target/scope chosen by
 * an edge adapter, so workspace-IAM owns final authorization and receipt ordering for all twenty operations.
 */
@Service
public class WorkspaceOperationsCommandService implements WorkspaceOperationsCommandApi {
    private final WorkspaceInvitationService invitations;
    private final WorkspaceAccountService accounts;
    private final WorkspaceUserService users;

    public WorkspaceOperationsCommandService(
            WorkspaceInvitationService invitations, WorkspaceAccountService accounts, WorkspaceUserService users) {
        this.invitations = invitations;
        this.accounts = accounts;
        this.users = users;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public WorkspaceInvitationService.ManagementInvitationView createInvitation(InvitationCreateCommand command) {
        WorkspaceSessionReadback session = session(command.facts());
        OrganizationTaskPathLookup.TaskPath target =
                users.resolveCommandTarget(session, command.expectedTargetType(), command.requestedScopeRef());
        List<WorkspaceInvitationService.AssignmentIntent> intents = command.roleIds().stream()
                .map(roleId ->
                        new WorkspaceInvitationService.AssignmentIntent(roleId, target.targetType(), target.targetId()))
                .toList();
        return invitations.createForOperations(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                session.currentAssignmentId(),
                target,
                command.mobile(),
                intents,
                command.idempotencyKey(),
                command.actor());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public WorkspaceInvitationService.ManagementInvitationView cancelInvitation(InvitationActionCommand command) {
        WorkspaceSessionReadback session = session(command.facts());
        OrganizationTaskPathLookup.TaskPath scope =
                users.resolveTaskScope(session, command.expectedTargetType(), command.requestedScopeRef());
        return invitations.managementView(invitations.cancelForOperations(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                session.currentAssignmentId(),
                command.expectedTargetType(),
                scope,
                command.invitationId(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public WorkspaceInvitationService.ManagementInvitationView reissueInvitation(InvitationActionCommand command) {
        WorkspaceSessionReadback session = session(command.facts());
        OrganizationTaskPathLookup.TaskPath scope =
                users.resolveTaskScope(session, command.expectedTargetType(), command.requestedScopeRef());
        return invitations.managementView(invitations.reissueForOperations(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                session.currentAssignmentId(),
                command.expectedTargetType(),
                scope,
                command.invitationId(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public OperationsAssignmentRevokeReadback revokeAssignment(AssignmentRevokeCommand command) {
        WorkspaceSessionReadback session = session(command.facts());
        java.util.UUID accountId = accounts.revokeAssignmentForOperations(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                session.currentAssignmentId(),
                command.expectedTargetType(),
                command.assignmentId(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor());
        return new OperationsAssignmentRevokeReadback(
                command.assignmentId(),
                accountId,
                session.contextVersion(),
                users.detail(WorkspaceUserService.AccountDetailQuery.forOperations(
                        session, command.expectedTargetType(), accountId)));
    }

    private static WorkspaceSessionReadback session(WorkspaceCommandAuthorizationFacts facts) {
        if (facts == null || facts.sessionReadback() == null) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
        return facts.sessionReadback();
    }
}
