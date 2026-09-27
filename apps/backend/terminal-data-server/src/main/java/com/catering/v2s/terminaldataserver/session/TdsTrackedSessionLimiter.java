package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Bounds active sessions and disconnects awaiting persistence on this TDS node. */
@Component
public final class TdsTrackedSessionLimiter {
    private final int limit;
    private final AtomicInteger active = new AtomicInteger();

    @Autowired
    public TdsTrackedSessionLimiter(TdsRuntimeSettings settings) {
        this(settings.maxTrackedSessions());
    }

    TdsTrackedSessionLimiter(int limit) {
        if (limit < 1) throw new IllegalArgumentException("limit is invalid");
        this.limit = limit;
    }

    public Permit tryAcquire() {
        while (true) {
            int current = active.get();
            if (current >= limit) return null;
            if (active.compareAndSet(current, current + 1)) return new Permit(this);
        }
    }

    private void release() {
        int remaining = active.decrementAndGet();
        if (remaining < 0) throw new IllegalStateException("TDS_TRACKED_SESSION_PERMIT_UNDERFLOW");
    }

    public static final class Permit implements AutoCloseable {
        private final TdsTrackedSessionLimiter owner;
        private final AtomicBoolean released = new AtomicBoolean();

        private Permit(TdsTrackedSessionLimiter owner) {
            this.owner = owner;
        }

        @Override
        public void close() {
            if (released.compareAndSet(false, true)) owner.release();
        }
    }
}
