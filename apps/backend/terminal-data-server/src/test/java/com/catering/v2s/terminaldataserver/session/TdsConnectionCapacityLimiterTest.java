package com.catering.v2s.terminaldataserver.session;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TdsConnectionCapacityLimiterTest {
    @Test
    void keepsUnauthenticatedAndTrackedSessionPoolsIndependentAndReleasesPermitsOnce() {
        TdsConnectionCapacityLimiter limiter = new TdsConnectionCapacityLimiter(1, 1);
        TdsConnectionCapacityLimiter.Permit unauthenticated = limiter.tryAcquireUnauthenticated();
        TdsConnectionCapacityLimiter.Permit tracked = limiter.tryAcquireTrackedSession();

        assertThat(unauthenticated).isNotNull();
        assertThat(tracked).isNotNull();
        assertThat(limiter.tryAcquireUnauthenticated()).isNull();
        assertThat(limiter.tryAcquireTrackedSession()).isNull();

        unauthenticated.close();
        unauthenticated.close();
        TdsConnectionCapacityLimiter.Permit anotherUnauthenticated = limiter.tryAcquireUnauthenticated();
        assertThat(anotherUnauthenticated).isNotNull();
        assertThat(limiter.tryAcquireTrackedSession()).isNull();
        anotherUnauthenticated.close();

        tracked.close();
        TdsConnectionCapacityLimiter.Permit anotherTracked = limiter.tryAcquireTrackedSession();
        assertThat(anotherTracked).isNotNull();
        anotherTracked.close();
    }
}
