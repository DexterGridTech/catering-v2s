package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Bounds active sessions and disconnects awaiting persistence on this TDS node. */
@Component
public final class TdsTrackedSessionLimiter {
    private final Semaphore permits;

    @Autowired
    public TdsTrackedSessionLimiter(TdsRuntimeSettings settings) {
        this(settings.maxTrackedSessions());
    }

    TdsTrackedSessionLimiter(int limit) {
        if (limit < 1) throw new IllegalArgumentException("limit is invalid");
        permits = new Semaphore(limit);
    }

    public Permit tryAcquire() {
        return permits.tryAcquire() ? new Permit(permits) : null;
    }

    public static final class Permit implements AutoCloseable {
        private final Semaphore permits;
        private final AtomicBoolean released = new AtomicBoolean();

        private Permit(Semaphore permits) {
            this.permits = permits;
        }

        @Override
        public void close() {
            if (released.compareAndSet(false, true)) permits.release();
        }
    }
}
