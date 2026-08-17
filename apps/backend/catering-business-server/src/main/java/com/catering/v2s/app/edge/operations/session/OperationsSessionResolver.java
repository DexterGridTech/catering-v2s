package com.catering.v2s.app.edge.operations.session;

import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.runtime.RuntimeEnvironmentKeys;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts;
import com.catering.v2s.workspace.iam.application.WorkspaceReadAuthorizationFacts;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** The only operations edge component allowed to decode the operations session cookie. */
@Component
public final class OperationsSessionResolver {
    private static final String COOKIE = RuntimeEnvironmentKeys.V2S_OPERATIONS_SESSION;
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
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            return sessions.session(token(request));
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
    }

    /**
     * Fresh task-read authorization projection. This is deliberately separate from {@link #require} because commands
     * still use the legacy/session command path and must never mint read facts.
     */
    public WorkspaceSessionReadback requireRead(EdgeRequestContext request) {
        return requireReadFacts(request).sessionReadback();
    }

    /**
     * Read-only owner facts for a task that must make its authorization decision without re-querying the session or
     * rebuilding organization visibility in every branch.
     */
    public WorkspaceReadAuthorizationFacts requireReadFacts(EdgeRequestContext request) {
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            return sessions.readAuthorizationFacts(token(request));
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
    }

    public WorkspaceSessionReadback requireWorkspace(EdgeRequestContext request, String groupWorkspaceKey) {
        WorkspaceSessionReadback session = require(request);
        if (!groupWorkspaceKey.equals(session.groupWorkspaceKey())) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
        return session;
    }

    /** Fresh, non-cached workspace-iam command projection; callers still require owner scope judgment. */
    public WorkspaceCommandAuthorizationFacts requireWorkspaceCommandFacts(
            EdgeRequestContext request, String groupWorkspaceKey) {
        WorkspaceCommandAuthorizationFacts facts;
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            facts = sessions.commandAuthorizationFacts(token(request));
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
        if (!groupWorkspaceKey.equals(facts.sessionReadback().groupWorkspaceKey())) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
        return facts;
    }

    public WorkspaceSessionReadback requireWorkspaceCommand(EdgeRequestContext request, String groupWorkspaceKey) {
        return requireWorkspaceCommandFacts(request, groupWorkspaceKey).sessionReadback();
    }

    public WorkspaceSessionReadback requireWorkspaceCommandAtContextVersion(
            EdgeRequestContext request, String groupWorkspaceKey, long expectedContextVersion) {
        WorkspaceSessionReadback session = requireWorkspaceCommand(request, groupWorkspaceKey);
        if (session.contextVersion() != expectedContextVersion) {
            throw new WorkspaceAuthenticationService.SessionConflictException();
        }
        return session;
    }

    public WorkspaceSessionReadback requireWorkspaceRead(EdgeRequestContext request, String groupWorkspaceKey) {
        return requireWorkspaceReadFacts(request, groupWorkspaceKey).sessionReadback();
    }

    public WorkspaceReadAuthorizationFacts requireWorkspaceReadFacts(
            EdgeRequestContext request, String groupWorkspaceKey) {
        WorkspaceReadAuthorizationFacts facts = requireReadFacts(request);
        if (!groupWorkspaceKey.equals(facts.groupWorkspaceKey())) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
        return facts;
    }

    /**
     * A changed scope context is recoverable optimistic-concurrency state, not an authentication failure. Keeping this
     * check here prevents individual edge adapters from accidentally redirecting a still-authenticated operator to
     * login.
     */
    public WorkspaceSessionReadback requireWorkspaceAtContextVersion(
            EdgeRequestContext request, String groupWorkspaceKey, long expectedContextVersion) {
        WorkspaceSessionReadback session = requireWorkspace(request, groupWorkspaceKey);
        if (session.contextVersion() != expectedContextVersion) {
            throw new WorkspaceAuthenticationService.SessionConflictException();
        }
        return session;
    }

    public WorkspaceSessionReadback requireWorkspaceReadAtContextVersion(
            EdgeRequestContext request, String groupWorkspaceKey, long expectedContextVersion) {
        WorkspaceSessionReadback session = requireWorkspaceRead(request, groupWorkspaceKey);
        if (session.contextVersion() != expectedContextVersion) {
            throw new WorkspaceAuthenticationService.SessionConflictException();
        }
        return session;
    }

    /** Narrow escape hatch for the password-change route only. */
    public WorkspaceSessionReadback requireWorkspaceForPasswordChange(
            EdgeRequestContext request, String groupWorkspaceKey) {
        WorkspaceSessionReadback session = sessions.sessionForPasswordChange(token(request));
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
