package com.catering.v2s.app.edge.session;

import org.springframework.stereotype.Component;

/** The only edge component that serializes session-cookie lifecycle headers. */
@Component
public final class EdgeSessionCookieWriter {
    public String issue(String cookieName, String token) {
        return issue(cookieName, token, 8 * 60 * 60);
    }

    /** Owner-bounded public flows may use a shorter server-enforced cookie lifetime. */
    public String issue(String cookieName, String token, long maxAgeSeconds) {
        if (maxAgeSeconds <= 0 || maxAgeSeconds > 8 * 60 * 60)
            throw new IllegalArgumentException("cookie lifetime is invalid");
        return cookieName + "=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAgeSeconds;
    }

    /** Dedicated public-flow cookie API: recovery secrets never use the general session-cookie policy. */
    public String issueSecureFlow(String cookieName, String token, long maxAgeSeconds) {
        if (maxAgeSeconds <= 0 || maxAgeSeconds > 30 * 60)
            throw new IllegalArgumentException("flow cookie lifetime is invalid");
        return cookieName + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + maxAgeSeconds;
    }

    public String clear(String cookieName) {
        return cookieName + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
    }

    public String clearSecureFlow(String cookieName) {
        return cookieName + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
    }
}
