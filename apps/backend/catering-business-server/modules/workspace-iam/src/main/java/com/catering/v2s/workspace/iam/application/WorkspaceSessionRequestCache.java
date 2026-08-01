package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;

/** Request-local immutable session readbacks; never a cross-request authorization cache. */
@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class WorkspaceSessionRequestCache {
    private final boolean enabled;
    private final Map<String, WorkspaceSessionReadback> values = new HashMap<>();

    public WorkspaceSessionRequestCache() {
        this(true);
    }

    WorkspaceSessionRequestCache(boolean enabled) {
        this.enabled = enabled;
    }

    WorkspaceSessionReadback read(String rawToken, Supplier<WorkspaceSessionReadback> loader) {
        return enabled ? values.computeIfAbsent(rawToken, ignored -> loader.get()) : loader.get();
    }

    void evict(String rawToken) {
        if (enabled) values.remove(rawToken);
    }
}
