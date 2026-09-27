package com.catering.v2s.terminaldataserver.websocket;

import com.catering.v2s.terminaldataserver.config.TdsRuntimeSettings;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Bounds accepted WebSocket connections until authentication completes. */
@Component
public final class UnauthenticatedConnectionLimiter {
    private final int limit;
    private final AtomicInteger active = new AtomicInteger();

    @Autowired
    public UnauthenticatedConnectionLimiter(TdsRuntimeSettings settings) {
        this(settings.maxUnauthenticatedConnections());
    }

    UnauthenticatedConnectionLimiter(int limit) {
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
        if (remaining < 0) throw new IllegalStateException("TDS_UNAUTHENTICATED_PERMIT_UNDERFLOW");
    }

    public static final class Permit implements AutoCloseable {
        private final UnauthenticatedConnectionLimiter owner;
        private final AtomicBoolean released = new AtomicBoolean();

        private Permit(UnauthenticatedConnectionLimiter owner) {
            this.owner = owner;
        }

        @Override
        public void close() {
            if (released.compareAndSet(false, true)) owner.release();
        }
    }
}
