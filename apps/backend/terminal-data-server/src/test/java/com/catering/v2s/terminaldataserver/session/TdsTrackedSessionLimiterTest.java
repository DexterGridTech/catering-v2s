package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TdsTrackedSessionLimiterTest {
    @Test
    void boundsActiveAndPendingDisconnectSessionsUntilPermitIsReleased() {
        TdsTrackedSessionLimiter limiter = new TdsTrackedSessionLimiter(1);
        TdsTrackedSessionLimiter.Permit first = limiter.tryAcquire();

        assertThat(first).isNotNull();
        assertThat(limiter.tryAcquire()).isNull();

        first.close();
        first.close();

        TdsTrackedSessionLimiter.Permit second = limiter.tryAcquire();
        assertThat(second).isNotNull();
        second.close();
    }
}
