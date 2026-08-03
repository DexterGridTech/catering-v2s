package com.catering.v2s.app.edge.operations.session;

import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.audit.contract.AuditActor;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** The only operations edge component allowed to decode the operations session cookie. */
@Component
public final class OperationsSessionResolver {
    private static final String COOKIE = "V2S_OPERATIONS_SESSION";
    private final WorkspaceAuthenticationService sessions;

    public OperationsSessionResolver(WorkspaceAuthenticationService sessions) {
        this.sessions = sessions;
    }

    public String token(EdgeRequestContext request) {
        return tokenIfPresent(request).orElseThrow(WorkspaceAuthenticationService.SessionInvalidException::new);
    }

    public Optional<String> tokenIfPresent(EdgeRequestContext request) {
        return Optional.ofNullable(request.operationsSessionCookie().rawValue()).filter(value -> !value.isBlank());
    }

    public WorkspaceSessionReadback require(EdgeRequestContext request) {
        return sessions.session(token(request));
    }

    public WorkspaceSessionReadback requireWorkspace(EdgeRequestContext request, String groupWorkspaceKey) {
        WorkspaceSessionReadback session = require(request);
        if (!groupWorkspaceKey.equals(session.groupWorkspaceKey())) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
        return session;
    }

    /** Captures the permitted immutable actor snapshot at the authentication boundary. */
    public AuditActor requireActor(EdgeRequestContext request, String groupWorkspaceKey) {
        return actor(requireWorkspace(request, groupWorkspaceKey));
    }

    /** Reuses an already authenticated and workspace-scoped session without a second owner read. */
    public AuditActor actor(WorkspaceSessionReadback session) {
        return new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName());
    }
}
