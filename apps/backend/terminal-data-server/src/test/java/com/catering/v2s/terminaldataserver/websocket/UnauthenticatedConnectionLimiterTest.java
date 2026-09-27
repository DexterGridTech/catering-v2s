package com.catering.v2s.terminaldataserver.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class UnauthenticatedConnectionLimiterTest {
    @Test
    void rejectsAboveLimitAndReusesReleasedPermit() {
        UnauthenticatedConnectionLimiter limiter = new UnauthenticatedConnectionLimiter(1);

        UnauthenticatedConnectionLimiter.Permit first = limiter.tryAcquire();

        assertThat(first).isNotNull();
        assertThat(limiter.tryAcquire()).isNull();

        first.close();
        assertThat(limiter.tryAcquire()).isNotNull();
    }

    @Test
    void permitReleaseIsIdempotent() {
        UnauthenticatedConnectionLimiter limiter = new UnauthenticatedConnectionLimiter(1);
        UnauthenticatedConnectionLimiter.Permit permit = limiter.tryAcquire();

        permit.close();
        permit.close();

        assertThat(limiter.tryAcquire()).isNotNull();
    }
}
