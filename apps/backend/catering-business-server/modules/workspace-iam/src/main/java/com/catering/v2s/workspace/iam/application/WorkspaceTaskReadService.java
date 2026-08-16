package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;

/**
 * Closed workspace-IAM task-read boundary for authenticated operations GET routes.
 *
 * <p>The methods intentionally name a business read shape rather than accepting an operation id or dispatcher token.
 * They reuse the owner services that retain the JDBC projections and typed failures; the edge never recreates an IAM
 * query or borrows this boundary from a command.
 */
@org.springframework.stereotype.Service
public final class WorkspaceTaskReadService {
    private final WorkspaceUserService users;
    private final WorkspaceInvitationService invitations;
    private final WorkspaceAuthenticationService authentication;

    public WorkspaceTaskReadService(
            WorkspaceUserService users,
            WorkspaceInvitationService invitations,
            WorkspaceAuthenticationService authentication) {
        this.users = users;
        this.invitations = invitations;
        this.authentication = authentication;
    }

    public WorkspaceUserService.AccountPage userPage(WorkspaceUserService.AccountPageQuery query) {
        return primary(() -> users.page(query));
    }

    public WorkspaceUserService.User userDetail(WorkspaceUserService.AccountDetailQuery query) {
        return primary(() -> users.detail(query));
    }

    public WorkspaceUserService.CandidatePage invitationCandidates(WorkspaceUserService.CandidateQuery query) {
        return primary(() -> users.candidates(query));
    }

    public WorkspaceInvitationService.ManagementInvitationPage invitations(
            com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback session,
            String expectedTargetType,
            java.util.UUID requestedScopeRef,
            WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        return primary(
                () -> invitations.managementPageForOperations(session, expectedTargetType, requestedScopeRef, request));
    }

    /** Session entry is task read but has its own authentication-facts contract, not WRA. */
    public WorkspaceSessionEntryReadback sessionEntry(String rawToken, String groupWorkspaceKey) {
        return authentication.sessionEntry(rawToken, groupWorkspaceKey);
    }

    private static <T> T primary(java.util.function.Supplier<T> read) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, read);
    }
}
