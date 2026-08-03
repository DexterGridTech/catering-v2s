package com.catering.v2s.platform.foundation.persistence;

import java.util.ArrayList;
import java.util.List;

/** Request-local logical database operation accounting; it never stores SQL or bind values. */
public final class DatabaseOperationTracker {
    private static final ThreadLocal<Collector> CURRENT = new ThreadLocal<>();

    private DatabaseOperationTracker() { }

    public static Scope open() {
        Collector previous = CURRENT.get();
        Collector current = new Collector();
        CURRENT.set(current);
        return new Scope(previous, current);
    }

    public static Snapshot snapshot() {
        Collector collector = CURRENT.get();
        return collector == null ? Snapshot.empty() : collector.snapshot();
    }

    static void record(String kind, long durationNanos) {
        Collector collector = CURRENT.get();
        if (collector != null) collector.record(kind, durationNanos);
    }

    public static final class Scope implements AutoCloseable {
        private final Collector previous;
        private final Collector current;
        private boolean closed;

        private Scope(Collector previous, Collector current) {
            this.previous = previous;
            this.current = current;
        }

        public Snapshot snapshot() {
            return current.snapshot();
        }

        @Override
        public void close() {
            if (!closed) {
                closed = true;
                if (previous == null) CURRENT.remove(); else CURRENT.set(previous);
            }
        }
    }

    public record Snapshot(long count, long durationMillis, List<Operation> operations) {
        public Snapshot {
            if (count < 0 || durationMillis < 0) throw new IllegalArgumentException("negative database metric");
            operations = List.copyOf(operations);
        }

        public static Snapshot empty() { return new Snapshot(0, 0, List.of()); }
    }

    public record Operation(String kind, long durationMillis) {
        public Operation {
            if (kind == null || !kind.matches("[A-Z_]{1,32}")) throw new IllegalArgumentException("invalid database operation kind");
            if (durationMillis < 0) throw new IllegalArgumentException("negative database operation duration");
        }
    }

    private static final class Collector {
        private final List<Operation> operations = new ArrayList<>();

        private synchronized void record(String kind, long durationNanos) {
            long durationMillis = Math.max(0, durationNanos / 1_000_000);
            operations.add(new Operation(normalizeKind(kind), durationMillis));
        }

        private synchronized Snapshot snapshot() {
            List<Operation> copy = List.copyOf(operations);
            return new Snapshot(copy.size(), copy.stream().mapToLong(Operation::durationMillis).sum(), copy);
        }

        private static String normalizeKind(String kind) {
            if (kind == null || !kind.matches("[A-Za-z_]{1,32}")) return "STATEMENT";
            return kind.toUpperCase(java.util.Locale.ROOT);
        }
    }
}
