package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.api.WorkspaceCurrentAuthorizationLookup;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver.ServerResolvedResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reuses the authentication owner and capability resolver for a current, session-correlated authorization check. */
@Service
public class WorkspaceCurrentAuthorizationLookupService implements WorkspaceCurrentAuthorizationLookup {
    private final WorkspaceAuthenticationService authentication;
    private final WorkspaceCapabilityScopeResolver capabilities;

    public WorkspaceCurrentAuthorizationLookupService(
            WorkspaceAuthenticationService authentication, WorkspaceCapabilityScopeResolver capabilities) {
        this.authentication = authentication;
        this.capabilities = capabilities;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isCurrentlyAuthorized(CurrentAuthorizationQuery query) {
        WorkspaceCommandAuthorizationFacts facts;
        try {
            facts = authentication.commandAuthorizationFacts(query.sessionId());
        } catch (WorkspaceAuthenticationService.SessionInvalidException invalidSession) {
            return false;
        }
        var session = facts.sessionReadback();
        if (!session.sessionId().equals(query.sessionId())
                || !session.workspaceUuid().equals(query.workspaceUuid())
                || !session.groupWorkspaceKey().equals(query.groupWorkspaceKey())
                || !session.accountId().equals(query.accountId())) {
            return false;
        }
        return capabilities.resolve(
                        session,
                        query.requirementId(),
                        new ServerResolvedResource(query.targetType(), query.targetId()))
                .decision() == WorkspaceCapabilityScopeResolver.Decision.ALLOW;
    }
}
