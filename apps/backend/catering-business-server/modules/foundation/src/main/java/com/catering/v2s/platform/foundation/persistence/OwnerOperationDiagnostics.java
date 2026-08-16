package com.catering.v2s.platform.foundation.persistence;

import java.util.Objects;
import java.util.function.Supplier;

/**
 * Owner-local request diagnostics at semantic command and readback boundaries.
 *
 * <p>The scope is deliberately opened only by a fresh owner command after its receipt replay decision. It does not
 * infer command work from a transaction, controller, or HTTP method.
 */
public final class OwnerOperationDiagnostics {
    private OwnerOperationDiagnostics() {}

    /** Marks the interval that persists a fresh owner command, including its terminal receipt. */
    public static CommandScope beginCommand() {
        DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.OWNER_COMMAND_BEGIN);
        return new CommandScope();
    }

    /** Attributes an actual post-command projection/readback, never a replay or precondition. */
    public static <T> T readback(Supplier<T> readback) {
        Objects.requireNonNull(readback, "readback");
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.READBACK)) {
            T result = readback.get();
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.READBACK_END);
            return result;
        }
    }

    public static final class CommandScope implements AutoCloseable {
        private boolean closed;

        private CommandScope() {}

        @Override
        public void close() {
            if (!closed) {
                closed = true;
                DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.OWNER_COMMAND_END);
            }
        }
    }
}
