package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/** Non-production server-canonical HTTP completion metric source for the isolated Seed and HTTP diagnostic modes. */
public final class HttpRequestMetricsInterceptor implements HandlerInterceptor {
    private static final String STATE = HttpRequestMetricsInterceptor.class.getName();
    private static final Object EVENT_LOCK = new Object();
    private final ObjectMapper mapper;
    private final Map<String, Definition> definitions;
    private final Mode mode;
    private final String runId;
    private final byte[] secret;
    private final Path eventsPath;
    private final boolean active;

    public HttpRequestMetricsInterceptor(ObjectMapper mapper) {
        this(mapper, env("V2S_RUNTIME_ENVIRONMENT"), env("V2S_DEV_PROFILE"), runIdFor(env("V2S_DEV_PROFILE")), secretFor(env("V2S_DEV_PROFILE")), env("V2S_DEV_NAMESPACE"), eventsFor(env("V2S_DEV_PROFILE")));
    }

    HttpRequestMetricsInterceptor(ObjectMapper mapper, String environment, String profile, String configuredRunId, String secretValue, String namespace, String eventFile) {
        this.mapper = mapper;
        this.definitions = loadDefinitions(mapper);
        this.mode = Mode.forProfile(profile);
        this.runId = configuredRunId;
        this.secret = secretValue == null ? new byte[0] : secretValue.getBytes(StandardCharsets.UTF_8);
        this.eventsPath = eventFile == null ? null : Path.of(eventFile);
        this.active = mode != null
                && "non-production".equals(environment)
                && runId != null && runId.matches("[A-Za-z0-9._:-]{8,128}")
                && secret.length >= 24
                && namespace != null && namespace.matches("v2s-(?:dev|http-diagnostic)-[a-z0-9-]{3,32}")
                && eventsPath != null;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!active || !validSecret(request.getHeader(mode.secretHeader()))) return true;
        if (!runId.equals(request.getHeader(mode.runIdHeader()))) return true;
        String correlationId = safe(request.getHeader("X-Correlation-Id"), "corr-" + UUID.randomUUID());
        String requestId = "req-" + UUID.randomUUID();
        String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String method = request.getMethod().toUpperCase(java.util.Locale.ROOT);
        Definition actual = definitions.get(method + " " + pattern);
        String assertedOperation = request.getHeader(mode.operationHeader());
        String assertedRoute = request.getHeader(mode.routeHeader());
        boolean mismatch = actual == null || !actual.operationId().equals(assertedOperation) || !actual.path().equals(assertedRoute);
        DatabaseOperationTracker.Scope scope = DatabaseOperationTracker.open();
        request.setAttribute(STATE, new State(scope, System.nanoTime(), correlationId, requestId, method, pattern, actual, mismatch));
        response.setHeader("X-Correlation-Id", correlationId);
        response.setHeader("X-Request-Id", requestId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        Object value = request.getAttribute(STATE);
        if (!(value instanceof State state)) return;
        try {
            DatabaseOperationTracker.Snapshot snapshot = state.scope().snapshot();
            Map<String, Object> event = new HashMap<>();
            event.put("runId", runId);
            event.put("correlationId", state.correlationId());
            event.put("requestId", state.requestId());
            event.put("method", state.method());
            event.put("routeTemplate", state.actual() == null ? state.pattern() : state.actual().path());
            event.put("operationId", state.actual() == null ? "route.unresolved" : state.actual().operationId());
            event.put("owner", state.actual() == null ? "unresolved" : state.actual().owner());
            event.put("consumerFace", state.actual() == null ? "unresolved" : state.actual().consumerFace());
            event.put("status", response.getStatus());
            event.put("durationMillis", Math.max(0, (System.nanoTime() - state.startedAtNanos()) / 1_000_000));
            event.put("databaseOperationCount", snapshot.count());
            event.put("databaseDurationMillis", snapshot.durationMillis());
            event.put("outcome", exception == null && response.getStatus() < 400 && !state.mismatch() ? "SUCCEEDED" : "FAILED");
            if (state.mismatch()) event.put("observationError", mode.mismatchError());
            if (exception != null) event.put("observationError", "REQUEST_EXCEPTION");
            append(event);
        } finally {
            state.scope().close();
        }
    }

    private boolean validSecret(String candidate) { return candidate != null && MessageDigest.isEqual(secret, candidate.getBytes(StandardCharsets.UTF_8)); }

    private void append(Map<String, Object> event) {
        if (eventsPath == null) return;
        try {
            synchronized (EVENT_LOCK) {
                Files.createDirectories(eventsPath.getParent());
                if (!Files.exists(eventsPath)) Files.createFile(eventsPath);
                try {
                    Files.setPosixFilePermissions(eventsPath, java.util.Set.of(java.nio.file.attribute.PosixFilePermission.OWNER_READ, java.nio.file.attribute.PosixFilePermission.OWNER_WRITE));
                } catch (UnsupportedOperationException ignored) { }
                Files.writeString(eventsPath, mapper.writeValueAsString(event) + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
        } catch (IOException ignored) {
            // A missing completion remains a client-report fail-closed condition.
        }
    }

    private static Map<String, Definition> loadDefinitions(ObjectMapper mapper) {
        Map<String, Definition> result = new HashMap<>();
        for (var entry : EdgeRouteFaceRegistry.loadExtended(mapper).entrySet()) {
            EdgeRouteFaceRegistry.Definition value = entry.getValue();
            result.put(entry.getKey(), new Definition(value.operationId(), value.method(), value.path(), value.owner(), value.consumerFace()));
        }
        return Map.copyOf(result);
    }

    private static String runIdFor(String profile) { Mode mode = Mode.forProfile(profile); return mode == null ? null : env(mode.variablePrefix() + "_RUN_ID"); }
    private static String secretFor(String profile) { Mode mode = Mode.forProfile(profile); return mode == null ? null : env(mode.variablePrefix() + "_SECRET"); }
    private static String eventsFor(String profile) { Mode mode = Mode.forProfile(profile); return mode == null ? null : env(mode.variablePrefix() + "_EVENTS"); }
    private static String env(String name) { return System.getenv(name); }
    private static String safe(String candidate, String fallback) { return candidate != null && candidate.matches("[A-Za-z0-9._:-]{1,128}") ? candidate : fallback; }

    private enum Mode {
        SEED("r5-full", "V2S_SEED_REPORT", "X-Seed", "SEED_OPERATION_METADATA_MISMATCH"),
        HTTP_DIAGNOSTIC("rm1-http-diagnostic", "V2S_HTTP_DIAGNOSTIC", "X-Http-Diagnostic", "HTTP_DIAGNOSTIC_OPERATION_METADATA_MISMATCH");

        private final String profile;
        private final String variablePrefix;
        private final String headerPrefix;
        private final String mismatchError;

        Mode(String profile, String variablePrefix, String headerPrefix, String mismatchError) {
            this.profile = profile;
            this.variablePrefix = variablePrefix;
            this.headerPrefix = headerPrefix;
            this.mismatchError = mismatchError;
        }
        static Mode forProfile(String profile) { for (Mode mode : values()) if (mode.profile.equals(profile)) return mode; return null; }
        String variablePrefix() { return variablePrefix; }
        String mismatchError() { return mismatchError; }
        String runIdHeader() { return headerPrefix + "-Run-Id"; }
        String secretHeader() { return this == SEED ? "X-Seed-Report-Secret" : headerPrefix + "-Secret"; }
        String operationHeader() { return headerPrefix + "-Operation-Id"; }
        String routeHeader() { return headerPrefix + "-Route-Template"; }
    }

    private record Definition(String operationId, String method, String path, String owner, String consumerFace) { }
    private record State(DatabaseOperationTracker.Scope scope, long startedAtNanos, String correlationId, String requestId, String method, String pattern, Definition actual, boolean mismatch) { }
}
