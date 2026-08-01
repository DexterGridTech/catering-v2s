package com.catering.v2s.app.edge.platform.session;

import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.audit.contract.AuditActor;
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
        return sessions.requireActiveSession(token(request));
    }

    /** Captures the permitted immutable actor snapshot at the authentication boundary. */
    public AuditActor requireActor(EdgeRequestContext request) {
        PlatformSessionReadback session = require(request);
        return new AuditActor("PLATFORM_ADMIN", session.platformAdminId(), session.displayName());
    }
}
