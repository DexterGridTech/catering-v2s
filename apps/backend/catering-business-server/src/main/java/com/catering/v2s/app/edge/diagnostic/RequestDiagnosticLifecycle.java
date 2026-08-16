package com.catering.v2s.app.edge.diagnostic;

import com.catering.v2s.platform.foundation.diagnostic.RequestDiagnosticContext;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.Objects;

/**
 * Request-thread phase façade for database diagnostics. It has a deliberately closed vocabulary and keeps phase marks
 * at reusable boundaries instead of scattering controller-specific logging.
 */
public final class RequestDiagnosticLifecycle {
    private static final ThreadLocal<Lifecycle> CURRENT = new ThreadLocal<>();

    private RequestDiagnosticLifecycle() {}

    static Lifecycle open(RequestDiagnosticContext context, String consumerFace) {
        Lifecycle lifecycle = new Lifecycle(context, consumerFace, CURRENT.get());
        CURRENT.set(lifecycle);
        mark(Phase.EDGE_IN);
        return lifecycle;
    }

    /** Records the current cumulative database counters at a fixed lifecycle boundary, when active. */
    public static void mark(Phase phase) {
        if (phase == null) throw new IllegalArgumentException("phase required");
        Lifecycle lifecycle = CURRENT.get();
        if (lifecycle != null) DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.valueOf(phase.name()));
    }

    static void close(Lifecycle lifecycle) {
        if (lifecycle != null && CURRENT.get() == lifecycle) {
            Lifecycle previous = lifecycle.previous();
            if (previous == null) CURRENT.remove();
            else CURRENT.set(previous);
        }
    }

    public enum Phase {
        EDGE_IN,
        SESSION_RESOLVED,
        AUTHORIZED,
        SCOPE_RESOLVED,
        OWNER_COMMAND_BEGIN,
        OWNER_COMMAND_END,
        READBACK_END,
        EDGE_OUT
    }

    static final class Lifecycle {
        private final RequestDiagnosticContext context;
        private final String consumerFace;
        private final Lifecycle previous;

        private Lifecycle(RequestDiagnosticContext context, String consumerFace, Lifecycle previous) {
            this.context = Objects.requireNonNull(context, "context");
            if (consumerFace == null || !consumerFace.matches("[A-Za-z0-9._:-]{1,128}")) {
                throw new IllegalArgumentException("invalid consumer face");
            }
            this.consumerFace = consumerFace;
            this.previous = previous;
        }

        RequestDiagnosticContext context() {
            return context;
        }

        String consumerFace() {
            return consumerFace;
        }

        Lifecycle previous() {
            return previous;
        }
    }
}
