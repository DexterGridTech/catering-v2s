package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.foundation.diagnostic.RequestDiagnosticContext;
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
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    private final Path databaseOperationsPath;
    private final Path statementDictionaryPath;
    private final byte[] databaseOperationHmacKey;
    private final boolean databaseCaptureActive;
    private final boolean databaseCaptureHmacMissing;
    private final boolean scopeActive;
    private final boolean eventActive;

    public HttpRequestMetricsInterceptor(ObjectMapper mapper) {
        this(mapper, env("V2S_RUNTIME_ENVIRONMENT"), env("V2S_DEV_PROFILE"), runIdFor(env("V2S_DEV_PROFILE")), secretFor(env("V2S_DEV_PROFILE")), env("V2S_DEV_NAMESPACE"), eventsFor(env("V2S_DEV_PROFILE")), env("V2S_DB_OPERATIONS_EVENTS"), env("V2S_DB_OPERATIONS_HMAC_KEY"), env("V2S_DB_STATEMENT_DICTIONARY"));
    }

    HttpRequestMetricsInterceptor(ObjectMapper mapper, String environment, String profile, String configuredRunId, String secretValue, String namespace, String eventFile) {
        this(mapper, environment, profile, configuredRunId, secretValue, namespace, eventFile, null, null, null);
    }

    HttpRequestMetricsInterceptor(ObjectMapper mapper, String environment, String profile, String configuredRunId, String secretValue, String namespace, String eventFile, String databaseOperationFile, String databaseOperationHmacValue, String dictionaryFile) {
        this.mapper = mapper;
        this.definitions = loadDefinitions(mapper);
        this.mode = Mode.forProfile(profile);
        this.runId = configuredRunId;
        this.secret = secretValue == null ? new byte[0] : secretValue.getBytes(StandardCharsets.UTF_8);
        this.eventsPath = eventFile == null ? null : Path.of(eventFile);
        this.databaseOperationsPath = databaseOperationFile == null ? null : Path.of(databaseOperationFile);
        this.statementDictionaryPath = dictionaryFile == null ? null : Path.of(dictionaryFile);
        this.databaseOperationHmacKey = decodeHmacKey(databaseOperationHmacValue);
        this.databaseCaptureActive = this.databaseOperationsPath != null && this.databaseOperationHmacKey != null;
        this.databaseCaptureHmacMissing = this.databaseOperationsPath != null && this.databaseOperationHmacKey == null;
        this.scopeActive = mode != null
                && "non-production".equals(environment)
                && namespaceMatches(mode, namespace);
        this.eventActive = scopeActive
                && runId != null && runId.matches("[A-Za-z0-9._:-]{8,128}")
                && secret.length >= 24
                && eventsPath != null;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!scopeActive) return true;
        String correlationId = safe(request.getHeader("X-Correlation-Id"), "corr-" + UUID.randomUUID());
        String requestId = "req-" + UUID.randomUUID();
        String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String method = request.getMethod().toUpperCase(java.util.Locale.ROOT);
        Definition actual = definitions.get(method + " " + pattern);
        String assertedOperation = request.getHeader(mode.operationHeader());
        String assertedRoute = request.getHeader(mode.routeHeader());
        PerformanceFixture fixture = performanceFixture(request);
        boolean credentialAuthorized = eventActive
                && validSecret(request.getHeader(mode.secretHeader()))
                && runId.equals(request.getHeader(mode.runIdHeader()));
        boolean metadataMismatch = actual == null
                || !actual.operationId().equals(assertedOperation)
                || !actual.path().equals(assertedRoute)
                || (mode == Mode.BACKEND_PERFORMANCE_FINAL && (fixture == null || !databaseCaptureActive));
        boolean eventAuthorized = credentialAuthorized;
        Definition resolved = actual == null ? new Definition("route.unresolved", method, safePattern(pattern), "unresolved", "unknown") : actual;
        RequestDiagnosticContext context = new RequestDiagnosticContext(correlationId, requestId, resolved.operationId(), resolved.path(), resolved.owner());
        DatabaseOperationTracker.Scope scope = DatabaseOperationTracker.open(new DatabaseOperationTracker.Options(
                databaseCaptureActive ? databaseOperationHmacKey : null,
                databaseCaptureActive,
                databaseCaptureActive && statementDictionaryPath != null));
        ReadBudgetComponent.Scope readBudget = ReadBudgetComponent.open();
        RequestDiagnosticLifecycle.Lifecycle lifecycle = RequestDiagnosticLifecycle.open(context, resolved.consumerFace());
        request.setAttribute(STATE, new State(scope, readBudget, System.nanoTime(), context, method, pattern, resolved, lifecycle, eventAuthorized, metadataMismatch, fixture));
        response.setHeader("X-Correlation-Id", correlationId);
        response.setHeader("X-Request-Id", requestId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        Object value = request.getAttribute(STATE);
        if (!(value instanceof State state)) return;
        try {
            RequestDiagnosticLifecycle.mark(RequestDiagnosticLifecycle.Phase.EDGE_OUT);
            DatabaseOperationTracker.Snapshot snapshot = state.scope().snapshot();
            ReadBudgetComponent.Snapshot readBudget = state.readBudget().snapshot(snapshot);
            // The snapshot validator joins every DB row to a managed completion event by the
            // request tuple. Keeping both artifacts behind the same credential gate prevents
            // browser/probe traffic from publishing an orphan DB row that makes the entire
            // run-scoped evidence snapshot unverifiable. The event is persisted first so a
            // completion-write failure cannot leave DB rows without their join target.
            if (!state.eventAuthorized()) return;
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("runId", runId);
            event.put("correlationId", state.context().correlationId());
            event.put("requestId", state.context().requestId());
            event.put("method", state.method());
            event.put("routeTemplate", state.actual().path());
            event.put("operationId", state.actual().operationId());
            if (state.fixture() != null) {
                event.put("performanceFixtureId", state.fixture().fixtureId());
                event.put("performanceArea", state.fixture().area());
            }
            event.put("owner", state.actual().owner());
            event.put("consumerFace", state.actual().consumerFace());
            event.put("status", response.getStatus());
            event.put("measurementSchemaVersion", DatabaseOperationTracker.MEASUREMENT_SCHEMA_VERSION);
            event.put("measurementBasis", DatabaseOperationTracker.MEASUREMENT_BASIS);
            event.put("durationMillis", Math.max(0, (System.nanoTime() - state.startedAtNanos()) / 1_000_000));
            event.put("databaseOperationCount", snapshot.count());
            event.put("logicalStatementCount", snapshot.logicalStatementCount());
            event.put("databaseDurationMillis", snapshot.durationMillis());
            event.put("logicalSectionCounts", sectionCounts(snapshot));
            // Keep the historical key during the measurement-schema transition; new consumers
            // must use the explicit logicalSectionCounts/kindCounts pair.
            event.put("sectionCounts", sectionCounts(snapshot));
            event.put("kindCounts", snapshot.kindCounts());
            event.put("kindDurationMillis", snapshot.kindDurationMillis());
            event.put("connectionBorrowCount", snapshot.connectionBorrowCount());
            event.put("connectionAcquireMillis", snapshot.connectionAcquireMillis());
            event.put("batchStatementTotal", snapshot.batchStatementTotal());
            event.put("readBudgetComponents", readBudgetCounts(readBudget));
            event.put("readBudgetUnclassified", readBudget.unclassifiedCount());
            event.put("readBudgetLogicalStatementComponents", readBudgetLogicalStatementCounts(readBudget));
            event.put("readBudgetLogicalStatementCount", readBudget.logicalStatementCount());
            event.put("readBudgetLogicalStatementUnclassified", readBudget.unclassifiedLogicalStatementCount());
            event.put("databaseOperationCapture", databaseCaptureActive ? "ENABLED" : databaseCaptureHmacMissing ? "DISABLED_HMAC_KEY_MISSING" : "NOT_CONFIGURED");
            event.put("phaseCheckpoints", snapshot.phaseCheckpoints());
            event.put("suspects", snapshot.suspects());
            if (mode == Mode.BACKEND_PERFORMANCE_FINAL && state.fixture() != null && databaseCaptureActive) {
                event.put("serverEvidenceHmac", serverEvidenceHmac(state, snapshot));
            }
            event.put("outcome", exception == null && response.getStatus() < 400 && !state.metadataMismatch() && !databaseCaptureHmacMissing ? "SUCCEEDED" : "FAILED");
            if (state.metadataMismatch()) event.put("observationError", mode.mismatchError());
            if (mode == Mode.BACKEND_PERFORMANCE_FINAL && state.fixture() == null) event.put("observationError", "BACKEND_PERFORMANCE_FINAL_FIXTURE_METADATA_INVALID");
            if (mode == Mode.BACKEND_PERFORMANCE_FINAL && !databaseCaptureActive) event.put("observationError", "BACKEND_PERFORMANCE_FINAL_INTEGRITY_KEY_MISSING");
            if (databaseCaptureHmacMissing) event.put("observationError", "DB_OPERATION_HMAC_KEY_MISSING");
            if (exception != null) event.put("observationError", "REQUEST_EXCEPTION");
            if (append(event)) {
                appendDatabaseOperations(state, snapshot, response.getStatus());
                appendStatementDictionary(snapshot.statementDictionary());
            }
        } finally {
            RequestDiagnosticLifecycle.close(state.lifecycle());
            state.readBudget().close();
            state.scope().close();
        }
    }

    private boolean validSecret(String candidate) { return candidate != null && MessageDigest.isEqual(secret, candidate.getBytes(StandardCharsets.UTF_8)); }

    static RequestDiagnosticContext context(HttpServletRequest request) {
        Object value = request.getAttribute(STATE);
        return value instanceof State state ? state.context() : null;
    }

    static boolean isManagedEventRequest(HttpServletRequest request) {
        Object value = request.getAttribute(STATE);
        return value instanceof State state && state.eventAuthorized();
    }

    private void appendDatabaseOperations(State state, DatabaseOperationTracker.Snapshot snapshot, int status) {
        // Never emit unhashed SQL/bind observations. A configured path without a valid HMAC key
        // is an explicit evidence failure, not permission to fall back to raw or bare hashes.
        if (!databaseCaptureActive || snapshot.operations().isEmpty()) return;
        try {
            synchronized (EVENT_LOCK) {
                createParent(databaseOperationsPath);
                if (!Files.exists(databaseOperationsPath)) Files.createFile(databaseOperationsPath);
                restrictToOwner(databaseOperationsPath);
                StringBuilder lines = new StringBuilder();
                for (DatabaseOperationTracker.Operation operation : snapshot.operations()) {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("runId", runId);
                    value.put("correlationId", state.context().correlationId());
                    value.put("requestId", state.context().requestId());
                    value.put("operationId", state.context().operationId());
                    value.put("routeTemplate", state.context().routeTemplate());
                    value.put("owner", state.context().owner());
                    value.put("measurementSchemaVersion", DatabaseOperationTracker.MEASUREMENT_SCHEMA_VERSION);
                    value.put("measurementBasis", DatabaseOperationTracker.MEASUREMENT_BASIS);
                    value.put("consumerFace", state.actual().consumerFace());
                    value.put("phase", operation.phase() == null ? "EDGE_IN" : operation.phase().name());
                    value.put("section", operation.section().name());
                    value.put("seq", operation.seq());
                    value.put("kind", operation.kind());
                    value.put("action", operation.action());
                    value.put("durationMillis", operation.durationMillis());
                    value.put("batchSize", operation.batchSize());
                    value.put("status", status);
                    if (operation.callSite() != null) value.put("callSite", operation.callSite());
                    if (operation.statementId() != null) value.put("statementId", operation.statementId());
                    if (operation.paramsHash() != null) value.put("paramsHash", operation.paramsHash());
                    if (mode == Mode.BACKEND_PERFORMANCE_FINAL) value.put("serverOperationHmac", serverOperationHmac(state, operation));
                    lines.append(mapper.writeValueAsString(value)).append('\n');
                }
                Files.writeString(databaseOperationsPath, lines.toString(), StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
        } catch (IOException ignored) {
            // Observability remains non-invasive; missing rows are detected by the managed report.
        }
    }

    private void appendStatementDictionary(Map<String, String> additions) {
        if (statementDictionaryPath == null || additions.isEmpty()) return;
        try {
            synchronized (EVENT_LOCK) {
                createParent(statementDictionaryPath);
                if (!Files.exists(statementDictionaryPath)) Files.createFile(statementDictionaryPath);
                restrictToOwner(statementDictionaryPath);
                Map<String, String> dictionary = new LinkedHashMap<>();
                if (Files.exists(statementDictionaryPath) && Files.size(statementDictionaryPath) > 0) {
                    JsonNode existing = mapper.readTree(Files.readString(statementDictionaryPath, StandardCharsets.UTF_8));
                    if (existing != null && existing.isObject()) {
                        existing.fields().forEachRemaining(entry -> {
                            if (entry.getKey().matches("[A-Za-z0-9_-]{8,64}") && entry.getValue().isTextual()) {
                                dictionary.put(entry.getKey(), entry.getValue().asText());
                            }
                        });
                    }
                }
                additions.forEach(dictionary::putIfAbsent);
                Files.writeString(statementDictionaryPath, mapper.writeValueAsString(dictionary) + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            }
        } catch (IOException ignored) {
            // Dictionary output is local-only diagnostic enrichment; it must not alter request work.
        }
    }

    private static Map<String, Long> sectionCounts(DatabaseOperationTracker.Snapshot snapshot) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (DatabaseOperationTracker.Section section : DatabaseOperationTracker.Section.values()) {
            result.put(section.name(), snapshot.sectionCounts().getOrDefault(section, 0L));
        }
        return Collections.unmodifiableMap(result);
    }

    private static Map<String, Long> readBudgetCounts(ReadBudgetComponent.Snapshot snapshot) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (ReadBudgetComponent.Component component : ReadBudgetComponent.Component.values()) {
            result.put(component.name(), snapshot.counts().getOrDefault(component, 0L));
        }
        return Collections.unmodifiableMap(result);
    }

    private static Map<String, Long> readBudgetLogicalStatementCounts(ReadBudgetComponent.Snapshot snapshot) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (ReadBudgetComponent.Component component : ReadBudgetComponent.Component.values()) {
            result.put(component.name(), snapshot.logicalStatementCounts().getOrDefault(component, 0L));
        }
        return Collections.unmodifiableMap(result);
    }

    private boolean append(Map<String, Object> event) {
        if (eventsPath == null) return false;
        try {
            synchronized (EVENT_LOCK) {
                createParent(eventsPath);
                if (!Files.exists(eventsPath)) Files.createFile(eventsPath);
                restrictToOwner(eventsPath);
                Files.writeString(eventsPath, mapper.writeValueAsString(event) + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
            return true;
        } catch (IOException ignored) {
            // A missing completion remains a client-report fail-closed condition.
            return false;
        }
    }

    private static void createParent(Path path) throws IOException {
        Path parent = path.getParent();
        if (parent != null) Files.createDirectories(parent);
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
    private static String safePattern(String candidate) { return candidate != null && candidate.matches("/[A-Za-z0-9._~{}:/-]{1,256}") ? candidate : "/unresolved"; }

    private static boolean namespaceMatches(Mode mode, String namespace) {
        if (namespace == null) return false;
        return mode == Mode.BACKEND_PERFORMANCE_FINAL
                ? namespace.matches("v2s-backend-performance-[a-z0-9-]{3,32}")
                : namespace.matches("v2s-(?:dev|http-diagnostic)-[a-z0-9-]{3,32}");
    }

    private PerformanceFixture performanceFixture(HttpServletRequest request) {
        if (mode != Mode.BACKEND_PERFORMANCE_FINAL) return null;
        String fixtureId = request.getHeader(mode.fixtureIdHeader());
        String area = request.getHeader(mode.areaHeader());
        if (fixtureId == null || !fixtureId.matches("[A-Za-z0-9._:-]{1,256}")
                || area == null || !java.util.Set.of("U05_TASK_READ", "U05_PROTOCOL", "U04_NUMERIC", "U04_CONTEXT_PARITY", "U07_ROUTE").contains(area)) return null;
        return new PerformanceFixture(fixtureId, area);
    }

    private String serverEvidenceHmac(State state, DatabaseOperationTracker.Snapshot snapshot) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(databaseOperationHmacKey, "HmacSHA256"));
            String canonical = String.join("\u0000", runId, state.context().correlationId(), state.context().requestId(), state.actual().operationId(), state.fixture().fixtureId(), state.fixture().area(), Long.toString(snapshot.count()), Long.toString(snapshot.logicalStatementCount()));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException("final evidence HMAC unavailable", failure);
        }
    }

    private String serverOperationHmac(State state, DatabaseOperationTracker.Operation operation) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(databaseOperationHmacKey, "HmacSHA256"));
            String canonical = String.join("\u0000", runId, state.context().correlationId(), state.context().requestId(), state.context().operationId(), Long.toString(operation.seq()), operation.section().name(), operation.kind(), operation.action(), operation.statementId() == null ? "" : operation.statementId());
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException("final database operation HMAC unavailable", failure);
        }
    }

    private static byte[] decodeHmacKey(String candidate) {
        if (candidate == null || candidate.isBlank()) return null;
        try {
            byte[] value = Base64.getUrlDecoder().decode(candidate);
            return value.length >= 16 ? value : null;
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static void restrictToOwner(Path path) throws IOException {
        try {
            Files.setPosixFilePermissions(path, java.util.Set.of(java.nio.file.attribute.PosixFilePermission.OWNER_READ, java.nio.file.attribute.PosixFilePermission.OWNER_WRITE));
        } catch (UnsupportedOperationException ignored) { }
    }

    private enum Mode {
        SEED("r5-full", "V2S_SEED_REPORT", "X-Seed", "SEED_OPERATION_METADATA_MISMATCH"),
        HTTP_DIAGNOSTIC("rm1-http-diagnostic", "V2S_HTTP_DIAGNOSTIC", "X-Http-Diagnostic", "HTTP_DIAGNOSTIC_OPERATION_METADATA_MISMATCH"),
        BACKEND_PERFORMANCE_FINAL("backend-performance-final-acceptance", "V2S_BACKEND_PERFORMANCE_FINAL", "X-Backend-Performance", "BACKEND_PERFORMANCE_FINAL_OPERATION_METADATA_MISMATCH");

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
        String fixtureIdHeader() { return headerPrefix + "-Fixture-Id"; }
        String areaHeader() { return headerPrefix + "-Area"; }
    }

    private record Definition(String operationId, String method, String path, String owner, String consumerFace) { }
    private record PerformanceFixture(String fixtureId, String area) { }
    private record State(DatabaseOperationTracker.Scope scope, ReadBudgetComponent.Scope readBudget, long startedAtNanos, RequestDiagnosticContext context, String method, String pattern, Definition actual, RequestDiagnosticLifecycle.Lifecycle lifecycle, boolean eventAuthorized, boolean metadataMismatch, PerformanceFixture fixture) { }
}
