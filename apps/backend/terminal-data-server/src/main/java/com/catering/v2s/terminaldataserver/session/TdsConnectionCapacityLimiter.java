package com.catering.v2s.terminaldataserver.session;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Owns the two independent node-local connection capacity pools. */
@Component
public final class TdsConnectionCapacityLimiter {
    private final Semaphore unauthenticated;
    private final Semaphore trackedSessions;

    @Autowired
    public TdsConnectionCapacityLimiter(TdsRuntimeSettings settings) {
        this(settings.maxUnauthenticatedConnections(), settings.maxTrackedSessions());
    }

    public TdsConnectionCapacityLimiter(int unauthenticatedLimit, int trackedSessionLimit) {
        if (unauthenticatedLimit < 1 || trackedSessionLimit < 1) {
            throw new IllegalArgumentException("connection capacity limit is invalid");
        }
        unauthenticated = new Semaphore(unauthenticatedLimit);
        trackedSessions = new Semaphore(trackedSessionLimit);
    }

    public Permit tryAcquireUnauthenticated() {
        return acquire(unauthenticated);
    }

    public Permit tryAcquireTrackedSession() {
        return acquire(trackedSessions);
    }

    private static Permit acquire(Semaphore permits) {
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
