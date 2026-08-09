package com.catering.v2s.app.edge.platform.session;

import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.audit.contract.AuditActor;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** The only platform edge component allowed to decode the platform session cookie. */
@Component
public final class PlatformSessionResolver {
    private static final String COOKIE = "V2S_PLATFORM_SESSION";
    private final PlatformAuthenticationService sessions;

    public PlatformSessionResolver(PlatformAuthenticationService sessions) {
        this.sessions = sessions;
    }

    public String token(EdgeRequestContext request) {
        String token = request.platformSessionCookie().rawValue();
        if (token != null && !token.isBlank()) return token;
        throw new PlatformAuthenticationService.SessionExpiredException();
    }

    public PlatformSessionReadback require(EdgeRequestContext request) {
        return requireUnmeasured(request);
    }

    private PlatformSessionReadback requireUnmeasured(EdgeRequestContext request) {
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            return sessions.requireActiveSession(token(request));
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
    }

    /**
     * Creates the immutable, request-local platform read fact.  Callers needing a selected
     * workspace must explicitly derive that second fact from the workspace owner; a global
     * platform read deliberately has no selected-workspace lookup.
     */
    public PlatformReadSessionFacts requireRead(EdgeRequestContext request) {
        return new PlatformReadSessionFacts(ReadBudgetComponent.measure(
            ReadBudgetComponent.Component.CONTEXT_PLATFORM_IAM,
            () -> requireUnmeasured(request)));
    }

    /** Captures the permitted immutable actor snapshot at the authentication boundary. */
    public AuditActor requireActor(EdgeRequestContext request) {
        return actor(require(request));
    }

    /** Reuses an already authenticated session to create the immutable audit actor snapshot. */
    public AuditActor actor(PlatformSessionReadback session) {
        return new AuditActor("PLATFORM_ADMIN", session.platformAdminId(), session.displayName());
    }

    /** Platform session fact with no public constructor and no command grant. */
    public static final class PlatformReadSessionFacts {
        private final PlatformSessionReadback session;

        private PlatformReadSessionFacts(PlatformSessionReadback session) {
            this.session = Objects.requireNonNull(session, "session");
        }

        public PlatformSessionReadback session() {
            return session;
        }

        /**
         * Resolves the selected workspace through its owning service, retaining the existing
         * enabled-only typed failure.  The key remains explicit because it is path-specific.
         */
        public EnabledSelectedWorkspaceFact requireEnabledSelectedWorkspace(
            WorkspaceAdministrationService workspaces,
            String groupWorkspaceKey
        ) {
            WorkspaceAdministrationReadback workspace = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.CONTEXT_PLATFORM_WORKSPACE,
                () -> Objects.requireNonNull(workspaces, "workspaces").requireEnabled(groupWorkspaceKey));
            return new EnabledSelectedWorkspaceFact(workspace.workspaceUuid(), workspace.groupWorkspaceKey());
        }
    }

    /** Immutable projection of an owner-validated enabled selected workspace. */
    public static final class EnabledSelectedWorkspaceFact {
        private final UUID workspaceUuid;
        private final String groupWorkspaceKey;

        private EnabledSelectedWorkspaceFact(UUID workspaceUuid, String groupWorkspaceKey) {
            this.workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            this.groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
        }

        public UUID workspaceUuid() {
            return workspaceUuid;
        }

        public String groupWorkspaceKey() {
            return groupWorkspaceKey;
        }
    }
}
