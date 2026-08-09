package com.catering.v2s.platform.foundation.persistence;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Request-local database operation accounting. It never retains SQL or bind values: statement
 * templates and bound values are converted to request-keyed HMAC identifiers before collection.
 */
public final class DatabaseOperationTracker {
    private static final ThreadLocal<Collector> CURRENT = new ThreadLocal<>();
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final int IDENTIFIER_LENGTH = 16;

    /** Frozen request-observation contract consumed by managed reports and evidence snapshots. */
    public static final int MEASUREMENT_SCHEMA_VERSION = 2;
    public static final String MEASUREMENT_BASIS = "JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH";

    private DatabaseOperationTracker() { }

    /** Opens a legacy scope without identifiers; retained for existing callers and focused tests. */
    public static Scope open() {
        return open(Options.legacy());
    }

    /** Opens a request scope. The supplied HMAC key is copied and never included in snapshots. */
    public static Scope open(Options options) {
        Collector previous = CURRENT.get();
        Collector current = new Collector(options == null ? Options.legacy() : options);
        CURRENT.set(current);
        return new Scope(previous, current);
    }

    /** Returns true only while an active request owns a collector on this thread. */
    public static boolean isActive() {
        return CURRENT.get() != null;
    }

    public static Snapshot snapshot() {
        Collector collector = CURRENT.get();
        return collector == null ? Snapshot.empty() : collector.snapshot();
    }

    /** Attributes subsequent operations to a closed section vocabulary until the returned scope closes. */
    public static SectionScope pushSection(Section section) {
        Collector collector = CURRENT.get();
        return collector == null ? SectionScope.noop() : collector.pushSection(section);
    }

    /** Captures a fixed edge lifecycle boundary with the cumulative metrics at that instant. */
    public static void markPhase(Phase phase) {
        Collector collector = CURRENT.get();
        if (collector != null) collector.markPhase(phase);
    }

    /** String entry point for edge lifecycle interceptors; rejects values outside the fixed phase vocabulary. */
    public static void markPhase(String phase) {
        if (phase == null) throw new IllegalArgumentException("phase required");
        markPhase(Phase.valueOf(phase));
    }

    static String parameterHash(Object value) {
        Collector collector = CURRENT.get();
        return collector == null ? null : collector.parameterHash(value);
    }

    static void record(String kind, long durationNanos) {
        record(kind, "RECORDED", durationNanos, null, null, 1);
    }

    static void record(String kind, String action, long durationNanos, String sqlTemplate, String paramsHash, int batchSize) {
        Collector collector = CURRENT.get();
        if (collector != null) collector.record(kind, action, durationNanos, sqlTemplate, paramsHash, batchSize);
    }

    /** Closed source attribution for database work. Unknown work is deliberately visible. */
    public enum Section {
        SESSION, AUTHZ, SCOPE, OWNER_READ, OWNER_WRITE, REFERENCE_CHECK, EXTENSION,
        IDEMPOTENCY, CAS, AUDIT, READBACK, CONNECTION, TRANSACTION, UNCLASSIFIED
    }

    /** Fixed phase vocabulary used to cross-check section attribution against request lifecycle deltas. */
    public enum Phase {
        EDGE_IN, SESSION_RESOLVED, AUTHORIZED, SCOPE_RESOLVED,
        OWNER_COMMAND_BEGIN, OWNER_COMMAND_END, READBACK_END, EDGE_OUT
    }

    /** Per-request non-secret telemetry settings owned by the edge diagnostic boundary. */
    public record Options(byte[] hmacKey, boolean captureCallSite, boolean retainStatementTemplatesForLocalDictionary) {
        public Options {
            hmacKey = hmacKey == null ? null : hmacKey.clone();
            if (hmacKey != null && hmacKey.length < 16) throw new IllegalArgumentException("hmac key too short");
        }

        @Override public byte[] hmacKey() { return hmacKey == null ? null : hmacKey.clone(); }
        public Options(byte[] hmacKey, boolean captureCallSite) { this(hmacKey, captureCallSite, false); }
        public static Options legacy() { return new Options(null, false, false); }
    }

    public static final class Scope implements AutoCloseable {
        private final Collector previous;
        private final Collector current;
        private boolean closed;

        private Scope(Collector previous, Collector current) {
            this.previous = previous;
            this.current = current;
        }

        public Snapshot snapshot() { return current.snapshot(); }

        @Override public void close() {
            if (!closed) {
                closed = true;
                if (previous == null) CURRENT.remove(); else CURRENT.set(previous);
            }
        }
    }

    public static final class SectionScope implements AutoCloseable {
        private static final SectionScope NOOP = new SectionScope(null, null);
        private final Collector collector;
        private final Section section;
        private boolean closed;

        private SectionScope(Collector collector, Section section) {
            this.collector = collector;
            this.section = section;
        }

        private static SectionScope noop() { return NOOP; }

        @Override public void close() {
            if (collector != null && !closed) {
                closed = true;
                collector.popSection(section);
            }
        }
    }

    public record Snapshot(
            long count,
            long logicalStatementCount,
            long durationMillis,
            long connectionAcquireMillis,
            long batchStatementTotal,
            List<Operation> operations,
            Map<Section, Long> sectionCounts,
            List<Suspect> suspects,
            Map<String, String> statementDictionary,
            List<PhaseCheckpoint> phaseCheckpoints) {
        public Snapshot {
            if (count < 0 || logicalStatementCount < 0 || durationMillis < 0 || connectionAcquireMillis < 0 || batchStatementTotal < 0) {
                throw new IllegalArgumentException("negative database metric");
            }
            operations = List.copyOf(operations);
            sectionCounts = immutableOrdered(sectionCounts);
            suspects = List.copyOf(suspects);
            statementDictionary = immutableOrdered(statementDictionary);
            phaseCheckpoints = List.copyOf(phaseCheckpoints);
        }

        /** Backward-compatible constructor for existing diagnostic code. */
        public Snapshot(long count, long durationMillis, List<Operation> operations) {
            this(count, count, durationMillis, 0, 0, operations, Map.of(), List.of(), Map.of(), List.of());
        }

        public static Snapshot empty() { return new Snapshot(0, 0, 0, 0, 0, List.of(), Map.of(), List.of(), Map.of(), List.of()); }

        /** Counts physical JDBC interaction kinds without confusing them with logical sections. */
        public Map<String, Long> kindCounts() {
            Map<String, Long> result = new LinkedHashMap<>();
            for (Operation operation : operations) result.merge(operation.kind(), 1L, Long::sum);
            return java.util.Collections.unmodifiableMap(result);
        }

        /** Sums physical JDBC duration by interaction kind. */
        public Map<String, Long> kindDurationMillis() {
            Map<String, Long> result = new LinkedHashMap<>();
            for (Operation operation : operations) result.merge(operation.kind(), operation.durationMillis(), Long::sum);
            return java.util.Collections.unmodifiableMap(result);
        }

        public long connectionBorrowCount() { return operations.stream().filter(operation -> "CONNECTION".equals(operation.kind())).count(); }

        public Map<Section, Long> logicalSectionCounts() { return sectionCounts; }
    }

    public record Operation(
            long seq,
            String kind,
            String action,
            long durationMillis,
            Section section,
            Phase phase,
            String callSite,
            String statementId,
            String paramsHash,
            int batchSize) {
        public Operation {
            if (seq < 1 || !validToken(kind) || !validToken(action) || durationMillis < 0 || section == null || batchSize < 1) {
                throw new IllegalArgumentException("invalid database operation");
            }
            if (callSite != null && callSite.length() > 512) throw new IllegalArgumentException("invalid call site");
            if (statementId != null && !statementId.matches("[A-Za-z0-9_-]{8,64}")) throw new IllegalArgumentException("invalid statement identifier");
            if (paramsHash != null && !paramsHash.matches("[A-Za-z0-9_-]{8,64}")) throw new IllegalArgumentException("invalid parameter hash");
        }

        /** Backward-compatible shape for callers that only know kind and duration. */
        public Operation(String kind, long durationMillis) {
            this(1, normalizeKind(kind), "RECORDED", durationMillis, Section.UNCLASSIFIED, null, null, null, null, 1);
        }
    }

    public record Suspect(String pattern, String statementId, String paramsHash, long count, long distinctParams, String callSite, Section section) {
        public Suspect {
            if (!("REDUNDANT_REPEAT".equals(pattern) || "N_PLUS_ONE".equals(pattern)) || statementId == null || count < 2 || distinctParams < 1 || section == null) {
                throw new IllegalArgumentException("invalid database suspect");
            }
        }
    }

    /** Cumulative operation counters at an edge lifecycle checkpoint. */
    public record PhaseCheckpoint(Phase phase, long databaseOperationCount, long logicalStatementCount, long databaseDurationMillis) {
        public PhaseCheckpoint {
            if (phase == null || databaseOperationCount < 0 || logicalStatementCount < 0 || databaseDurationMillis < 0) {
                throw new IllegalArgumentException("invalid database phase checkpoint");
            }
        }
    }

    private static final class Collector {
        private final Options options;
        private final List<Operation> operations = new ArrayList<>();
        private final Deque<Section> sections = new ArrayDeque<>();
        private final Map<String, String> statementDictionary = new LinkedHashMap<>();
        private final List<PhaseCheckpoint> phaseCheckpoints = new ArrayList<>();
        private Phase phase;
        private long sequence;

        private Collector(Options options) { this.options = options; }

        private synchronized SectionScope pushSection(Section section) {
            Section resolved = section == null ? Section.UNCLASSIFIED : section;
            sections.push(resolved);
            return new SectionScope(this, resolved);
        }

        private synchronized void popSection(Section expected) {
            if (!sections.isEmpty() && sections.peek() == expected) sections.pop();
            else sections.removeFirstOccurrence(expected);
        }

        private synchronized void markPhase(Phase phase) {
            if (phase == null) throw new IllegalArgumentException("phase required");
            this.phase = phase;
            long duration = operations.stream().mapToLong(Operation::durationMillis).sum();
            long logicalStatements = operations.stream().mapToLong(Operation::batchSize).sum();
            phaseCheckpoints.add(new PhaseCheckpoint(phase, operations.size(), logicalStatements, duration));
        }

        private synchronized String parameterHash(Object value) {
            if (options.hmacKey() == null) return null;
            byte[] encoded = encodeValue(value);
            return encoded == null ? "UNAVAILABLE" : hmac(encoded);
        }

        private synchronized void record(String kind, String action, long durationNanos, String sqlTemplate, String paramsHash, int batchSize) {
            // Section is the logical owner attribution while kind is the physical JDBC
            // interaction. A connection/transaction acquired inside an owner section keeps
            // that logical attribution; kindCounts/kindDurationMillis remain the authoritative
            // physical dimension and prevent it from being mistaken for a business statement.
            String statementId = sqlTemplate == null || options.hmacKey() == null ? null : hmac(sqlTemplate.getBytes(StandardCharsets.UTF_8));
            if (statementId != null && options.retainStatementTemplatesForLocalDictionary()) statementDictionary.putIfAbsent(statementId, sqlTemplate);
            int resolvedBatchSize = Math.max(1, batchSize);
            String callSite = options.captureCallSite() ? callSite() : null;
            operations.add(new Operation(
                    ++sequence,
                    normalizeKind(kind),
                    normalizeAction(action),
                    Math.max(0, durationNanos / 1_000_000),
                    sections.isEmpty() ? defaultSection(kind, callSite) : sections.peek(),
                    phase,
                    callSite,
                    statementId,
                    paramsHash,
                    resolvedBatchSize));
        }

        private synchronized Snapshot snapshot() {
            List<Operation> copy = List.copyOf(operations);
            EnumMap<Section, Long> counts = new EnumMap<>(Section.class);
            for (Operation operation : copy) counts.merge(operation.section(), 1L, Long::sum);
            long duration = copy.stream().mapToLong(Operation::durationMillis).sum();
            long logicalStatements = copy.stream().mapToLong(Operation::batchSize).sum();
            long connectionMillis = copy.stream().filter(operation -> operation.kind().equals("CONNECTION")).mapToLong(Operation::durationMillis).sum();
            long batchStatements = copy.stream().filter(operation -> operation.kind().equals("BATCH")).mapToLong(Operation::batchSize).sum();
            return new Snapshot(copy.size(), logicalStatements, duration, connectionMillis, batchStatements, copy, counts, suspects(copy), statementDictionary, phaseCheckpoints);
        }

        private List<Suspect> suspects(List<Operation> values) {
            Map<String, List<Operation>> exact = new LinkedHashMap<>();
            Map<String, List<Operation>> templates = new LinkedHashMap<>();
            for (Operation value : values) {
                if (value.statementId() == null || value.paramsHash() == null || "UNAVAILABLE".equals(value.paramsHash())) continue;
                String context = value.statementId() + "|" + value.section() + "|" + String.valueOf(value.callSite());
                exact.computeIfAbsent(context + "|" + value.paramsHash(), ignored -> new ArrayList<>()).add(value);
                templates.computeIfAbsent(context, ignored -> new ArrayList<>()).add(value);
            }
            List<Suspect> result = new ArrayList<>();
            for (List<Operation> repeated : exact.values()) {
                if (repeated.size() >= 2) {
                    Operation sample = repeated.getFirst();
                    result.add(new Suspect("REDUNDANT_REPEAT", sample.statementId(), sample.paramsHash(), repeated.size(), 1, sample.callSite(), sample.section()));
                }
            }
            for (List<Operation> candidate : templates.values()) {
                long distinct = candidate.stream().map(Operation::paramsHash).distinct().count();
                if (candidate.size() >= 3 && candidate.size() == distinct && isContiguous(candidate)) {
                    Operation sample = candidate.getFirst();
                    result.add(new Suspect("N_PLUS_ONE", sample.statementId(), null, candidate.size(), distinct, sample.callSite(), sample.section()));
                }
            }
            return List.copyOf(result);
        }

        private static boolean isContiguous(List<Operation> values) {
            for (int index = 1; index < values.size(); index++) if (values.get(index).seq() != values.get(index - 1).seq() + 1) return false;
            return true;
        }

        private String hmac(byte[] bytes) {
            try {
                Mac mac = Mac.getInstance(HMAC_ALGORITHM);
                mac.init(new SecretKeySpec(options.hmacKey(), HMAC_ALGORITHM));
                return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(bytes)).substring(0, IDENTIFIER_LENGTH);
            } catch (GeneralSecurityException exception) {
                throw new IllegalStateException("database diagnostic HMAC unavailable", exception);
            }
        }
    }

    private static byte[] encodeValue(Object value) {
        if (value == null) return "NULL".getBytes(StandardCharsets.UTF_8);
        if (value instanceof byte[] bytes) return bytes.clone();
        if (value instanceof char[] chars) return new String(chars).getBytes(StandardCharsets.UTF_8);
        if (value instanceof CharSequence || value instanceof Number || value instanceof Boolean || value instanceof Enum<?> || value instanceof java.util.UUID || value instanceof java.time.temporal.TemporalAccessor) {
            return String.valueOf(value).getBytes(StandardCharsets.UTF_8);
        }
        // Streams, LOBs, and driver-specific values are never consumed or fingerprinted.
        return null;
    }

    private static Section defaultSection(String kind, String callSite) {
        if ("CONNECTION".equalsIgnoreCase(kind)) return Section.CONNECTION;
        if ("TRANSACTION".equalsIgnoreCase(kind)) return Section.TRANSACTION;
        // JDBC work emitted from an owner implementation is still owner work even when that
        // implementation has no narrower semantic bucket. Edge/session/foundation callers must
        // remain visibly UNCLASSIFIED until they establish an explicit boundary.
        if (isOwnerImplementation(callSite)) {
            return "UPDATE".equalsIgnoreCase(kind) || "BATCH".equalsIgnoreCase(kind)
                ? Section.OWNER_WRITE : Section.OWNER_READ;
        }
        return Section.UNCLASSIFIED;
    }

    private static boolean isOwnerImplementation(String callSite) {
        if (callSite == null || !callSite.startsWith("com.catering.v2s.")) return false;
        return !callSite.startsWith("com.catering.v2s.app.")
            && !callSite.startsWith("com.catering.v2s.platform.foundation.");
    }

    private static boolean validToken(String value) { return value != null && value.matches("[A-Z_]{1,48}"); }
    private static String normalizeKind(String value) { return value != null && value.matches("[A-Za-z_]{1,48}") ? value.toUpperCase(Locale.ROOT) : "STATEMENT"; }
    private static String normalizeAction(String value) { return value != null && value.matches("[A-Za-z_]{1,48}") ? value.toUpperCase(Locale.ROOT) : "EXECUTE"; }

    private static <K, V> Map<K, V> immutableOrdered(Map<K, V> values) {
        return java.util.Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }

    private static String callSite() {
        return StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE).walk(frames -> frames
                .filter(frame -> frame.getClassName().startsWith("com.catering.v2s.")
                        && !frame.getClassName().startsWith("com.catering.v2s.platform.foundation.persistence."))
                .findFirst()
                .map(frame -> frame.getClassName() + "#" + frame.getMethodName() + ":" + frame.getLineNumber())
                .orElse(null));
    }
}
