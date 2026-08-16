package com.catering.v2s.platform.foundation.persistence;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Request-local attribution for the closed BP-U05 read-budget vocabulary.
 *
 * <p>This deliberately records only work enclosed by an explicit owner/edge boundary. Any JDBC work that has not been
 * enclosed remains {@link Component#UNCLASSIFIED} at completion; callers cannot obtain a passing budget by relying on a
 * default section or by omitting a boundary.
 */
public final class ReadBudgetComponent {
    private static final ThreadLocal<Collector> CURRENT = new ThreadLocal<>();

    private ReadBudgetComponent() {}

    public enum Component {
        CONTEXT_WORKSPACE_IAM,
        CONTEXT_ORGANIZATION,
        CONTEXT_PLATFORM_IAM,
        CONTEXT_PLATFORM_WORKSPACE,
        PRIMARY_QUERY,
        OPTIONAL_COUNT,
        UNCLASSIFIED
    }

    public static Scope open() {
        Collector previous = CURRENT.get();
        Collector current = new Collector();
        CURRENT.set(current);
        return new Scope(previous, current);
    }

    /** Measures the JDBC operations performed by one explicit semantic component. */
    public static <T> T measure(Component component, Supplier<T> action) {
        Objects.requireNonNull(component, "component");
        Objects.requireNonNull(action, "action");
        if (component == Component.UNCLASSIFIED) throw new IllegalArgumentException("UNCLASSIFIED is completion-only");
        Collector collector = CURRENT.get();
        if (collector == null) return action.get();
        return collector.measure(component, action);
    }

    /** Snapshot physical JDBC operations and logical SQL statements independently. */
    public static Snapshot snapshot(DatabaseOperationTracker.Snapshot databaseSnapshot) {
        Objects.requireNonNull(databaseSnapshot, "databaseSnapshot");
        Collector collector = CURRENT.get();
        return collector == null ? Snapshot.unscoped(databaseSnapshot) : collector.snapshot(databaseSnapshot);
    }

    /**
     * Physical operation counts reconcile to the request diagnostic total. Logical statement counts exclude connection
     * and transaction mechanics and are the sole basis for B caps.
     */
    public record Snapshot(
            Map<Component, Long> counts,
            Map<Component, Long> logicalStatementCounts,
            long databaseOperationCount,
            long logicalStatementCount) {
        public Snapshot {
            if (databaseOperationCount < 0 || logicalStatementCount < 0)
                throw new IllegalArgumentException("negative database metric");
            EnumMap<Component, Long> normalized = normalizedCounts(counts);
            EnumMap<Component, Long> normalizedLogical = normalizedCounts(logicalStatementCounts);
            long total = normalized.values().stream().mapToLong(Long::longValue).sum();
            long logicalTotal = normalizedLogical.values().stream()
                    .mapToLong(Long::longValue)
                    .sum();
            if (total != databaseOperationCount) throw new IllegalArgumentException("physical component total drift");
            if (logicalTotal != logicalStatementCount)
                throw new IllegalArgumentException("logical statement component total drift");
            counts = Map.copyOf(normalized);
            logicalStatementCounts = Map.copyOf(normalizedLogical);
        }

        static Snapshot unscoped(DatabaseOperationTracker.Snapshot databaseSnapshot) {
            EnumMap<Component, Long> counts = emptyCounts();
            EnumMap<Component, Long> logicalCounts = emptyCounts();
            counts.put(Component.UNCLASSIFIED, databaseSnapshot.count());
            logicalCounts.put(Component.UNCLASSIFIED, ReadBudgetComponent.logicalStatementCount(databaseSnapshot));
            return new Snapshot(
                    counts,
                    logicalCounts,
                    databaseSnapshot.count(),
                    ReadBudgetComponent.logicalStatementCount(databaseSnapshot));
        }

        public long unclassifiedCount() {
            return counts.getOrDefault(Component.UNCLASSIFIED, 0L);
        }

        public long unclassifiedLogicalStatementCount() {
            return logicalStatementCounts.getOrDefault(Component.UNCLASSIFIED, 0L);
        }
    }

    private static EnumMap<Component, Long> normalizedCounts(Map<Component, Long> values) {
        EnumMap<Component, Long> normalized = new EnumMap<>(Component.class);
        for (Component component : Component.values()) {
            long value = values == null ? 0L : values.getOrDefault(component, 0L);
            if (value < 0) throw new IllegalArgumentException("negative component count");
            normalized.put(component, value);
        }
        return normalized;
    }

    public static final class Scope implements AutoCloseable {
        private final Collector previous;
        private final Collector current;
        private boolean closed;

        private Scope(Collector previous, Collector current) {
            this.previous = previous;
            this.current = current;
        }

        public Snapshot snapshot(DatabaseOperationTracker.Snapshot databaseSnapshot) {
            return current.snapshot(databaseSnapshot);
        }

        @Override
        public void close() {
            if (!closed) {
                closed = true;
                if (previous == null) CURRENT.remove();
                else CURRENT.set(previous);
            }
        }
    }

    private static final class Collector {
        private final EnumMap<Component, Long> counts = emptyCounts();
        private final EnumMap<Component, Long> logicalStatementCounts = emptyCounts();
        private boolean measuring;

        private synchronized <T> T measure(Component component, Supplier<T> action) {
            if (measuring) throw new IllegalStateException("nested read budget component");
            measuring = true;
            DatabaseOperationTracker.Snapshot before = DatabaseOperationTracker.snapshot();
            try {
                return action.get();
            } finally {
                DatabaseOperationTracker.Snapshot after = DatabaseOperationTracker.snapshot();
                if (after.count() < before.count())
                    throw new IllegalStateException("database operation count regressed");
                long beforeLogical = logicalStatementCount(before);
                long afterLogical = logicalStatementCount(after);
                if (afterLogical < beforeLogical) throw new IllegalStateException("logical statement count regressed");
                counts.merge(component, after.count() - before.count(), Long::sum);
                logicalStatementCounts.merge(component, afterLogical - beforeLogical, Long::sum);
                measuring = false;
            }
        }

        private synchronized Snapshot snapshot(DatabaseOperationTracker.Snapshot databaseSnapshot) {
            long attributed = counts.entrySet().stream()
                    .filter(entry -> entry.getKey() != Component.UNCLASSIFIED)
                    .mapToLong(Map.Entry::getValue)
                    .sum();
            long attributedLogical = logicalStatementCounts.entrySet().stream()
                    .filter(entry -> entry.getKey() != Component.UNCLASSIFIED)
                    .mapToLong(Map.Entry::getValue)
                    .sum();
            long logicalTotal = logicalStatementCount(databaseSnapshot);
            if (attributed > databaseSnapshot.count())
                throw new IllegalStateException("read budget component exceeds request count");
            if (attributedLogical > logicalTotal)
                throw new IllegalStateException("read budget component exceeds logical statement count");
            EnumMap<Component, Long> result = new EnumMap<>(counts);
            EnumMap<Component, Long> logicalResult = new EnumMap<>(logicalStatementCounts);
            result.put(Component.UNCLASSIFIED, databaseSnapshot.count() - attributed);
            logicalResult.put(Component.UNCLASSIFIED, logicalTotal - attributedLogical);
            return new Snapshot(result, logicalResult, databaseSnapshot.count(), logicalTotal);
        }
    }

    private static EnumMap<Component, Long> emptyCounts() {
        EnumMap<Component, Long> counts = new EnumMap<>(Component.class);
        for (Component component : Component.values()) counts.put(component, 0L);
        return counts;
    }

    private static long logicalStatementCount(DatabaseOperationTracker.Snapshot snapshot) {
        return snapshot.operations().stream()
                .filter(operation -> "QUERY".equals(operation.kind())
                        || "UPDATE".equals(operation.kind())
                        || "BATCH".equals(operation.kind()))
                .mapToLong(DatabaseOperationTracker.Operation::batchSize)
                .sum();
    }
}
