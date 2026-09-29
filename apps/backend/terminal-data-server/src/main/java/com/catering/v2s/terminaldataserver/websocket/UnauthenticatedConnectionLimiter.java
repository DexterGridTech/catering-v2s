package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Bounds accepted WebSocket connections until authentication completes. */
@Component
public final class UnauthenticatedConnectionLimiter {
    private final Semaphore permits;

    @Autowired
    public UnauthenticatedConnectionLimiter(TdsRuntimeSettings settings) {
        this(settings.maxUnauthenticatedConnections());
    }

    UnauthenticatedConnectionLimiter(int limit) {
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
